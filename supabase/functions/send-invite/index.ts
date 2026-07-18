// supabase/functions/send-invite/index.ts
//
// T017 -- AUTH-03 step 2 / AUTH-06. Called by an authenticated admin/coach from
// `/roster` (a future task, T024/T027 -- not built here). On success it:
//   1. Verifies the caller is authenticated and is `admin` or `coach` (never
//      trusts a client-supplied role -- looks it up from `profiles`).
//   2. Inserts one row into `invites` with the correct role/student linkage and
//      a 14-day `expires_at` (AUTH-06).
//   3. Calls Supabase's `auth.admin.inviteUserByEmail()` (service-role only) so
//      the recipient gets a real Supabase invite link.
//
// Scope boundary (see the T017 worker packet in full before editing): this
// function intentionally stops after `inviteUserByEmail` succeeds. Branded
// Resend email + `email_log` writes belong to T048 ("Resend integration +
// branded layout + email_log", Allowed Files: `src/emails/layout/**` + "wiring
// in supabase/functions/send-invite/** (extend, not new function)"). Do not add
// Resend/SMTP calls here -- see the EXTENSION POINT comment below for exactly
// where that work plugs in.
//
// Two-client architecture (constitution item 5: no service-role key may ever
// reach the frontend or a client bundle):
//   - `callerClient`: built from the request's own `Authorization` header (the
//     caller's own JWT, forwarded by the frontend caller) plus the *anon* key.
//     Used only to identify who is calling (`auth.getUser()`) and to read their
//     own `profiles` row. RLS applies to every query this client makes -- it
//     can never bypass the `invites` table's `staff_all` policy on its own.
//   - `adminClient`: built from `SUPABASE_SERVICE_ROLE_KEY`, one of Supabase's
//     own auto-injected Edge Function env vars, read only via
//     `Deno.env.get(...)`. Never hardcoded, never echoed in a response or log.
//     Used for the actual `invites` insert and the `inviteUserByEmail` call,
//     both of which must bypass/exceed RLS (there is no RLS policy that would
//     let *any* authenticated session read/write `auth.users`, and the
//     `invites` table's own policy — `staff_all` — is enforced here in code,
//     not relied on, because a service-role client bypasses RLS entirely; see
//     supabase/migrations/20260717000002_rls.sql).
//
// Imported via the `npm:` specifier (Deno 2 native support), per constitution
// item 9's `@supabase/supabase-js` allowlist entry.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { computeExpiresAt, validateInviteRequest } from './validation.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

// DES-16: errors say what happened and what to do. No apologies, no "Oops".
// Shape is stable and intended for downstream tasks (T024/T027) to match:
//   { "error": { "code": "SOME_CODE", "message": "human-readable DES-16 text" } }
function errorResponse(status: number, code: string, message: string): Response {
  return jsonResponse(status, { error: { code, message } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Use POST to send an invite.');
  }

  // These three are Supabase's own auto-injected Edge Function secrets (local
  // and hosted). Never project-defined, never committed, never hardcoded.
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !anonKey || !serviceRoleKey) {
    // Config/deployment problem, not a caller problem -- no detail on which
    // var is missing, to avoid leaking anything about the deployment.
    return errorResponse(500, 'CONFIG_ERROR', 'The invite service is not configured correctly. Contact an administrator.');
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return errorResponse(401, 'UNAUTHENTICATED', 'Sign in and try again.');
  }

  // --- Client 1: caller-JWT client. Identifies the caller; every query it
  // makes is still subject to RLS. ---
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData?.user) {
    return errorResponse(401, 'UNAUTHENTICATED', 'Your session has expired. Sign in again and try sending the invite.');
  }

  const callerId = userData.user.id;

  // profiles_read RLS policy is `for select to authenticated using (true)`
  // (supabase/migrations/20260717000002_rls.sql), so the caller-JWT client can
  // read its own row without needing the service-role client for this lookup.
  const { data: callerProfile, error: profileError } = await callerClient
    .from('profiles')
    .select('id, role')
    .eq('id', callerId)
    .maybeSingle();

  if (profileError) {
    return errorResponse(500, 'PROFILE_LOOKUP_FAILED', 'Could not verify your account. Try again in a moment.');
  }

  // This is the function's own authorization gate -- the equivalent of
  // is_staff() from PRD 8.4, re-derived here (not shortcut) because RLS alone
  // cannot protect the write path once we switch to the service-role client
  // below. Rejects before any database write happens.
  if (!callerProfile || (callerProfile.role !== 'admin' && callerProfile.role !== 'coach')) {
    return errorResponse(403, 'FORBIDDEN', 'Only admins and coaches can send invites.');
  }

  // --- Request body validation (role_enum vocabulary, student linkage). See
  // validation.ts -- kept separate from I/O so it is unit-testable with
  // `deno test` independent of any Supabase project. ---
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, 'INVALID_BODY', 'Send a valid JSON body with email, role, and student_id.');
  }

  const validated = validateInviteRequest(body);
  if (!validated.ok) {
    return errorResponse(400, validated.error.code, validated.error.message);
  }

  const { email, role, student_id } = validated.value;

  // --- Client 2: service-role client. Constructed only from
  // Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') -- never from a client-supplied
  // value, never logged, never returned in any response body. ---
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (student_id) {
    const { data: student, error: studentError } = await adminClient
      .from('students')
      .select('id')
      .eq('id', student_id)
      .maybeSingle();
    if (studentError) {
      return errorResponse(500, 'STUDENT_LOOKUP_FAILED', 'Could not verify the selected student. Try again in a moment.');
    }
    if (!student) {
      return errorResponse(400, 'STUDENT_NOT_FOUND', 'That student could not be found. Refresh the roster and try again.');
    }
  }

  const expiresAt = computeExpiresAt();

  const { data: invite, error: insertError } = await adminClient
    .from('invites')
    .insert({
      email,
      role,
      student_id,
      invited_by: callerProfile.id,
      status: 'pending',
      expires_at: expiresAt,
    })
    .select('id, email, role, student_id, status, expires_at, created_at')
    .single();

  if (insertError || !invite) {
    // No PII in logs (constitution item 6): log the caller and role, never the
    // invitee's email/name.
    console.error('send-invite: invites insert failed', { invited_by: callerProfile.id, role });
    return errorResponse(500, 'INVITE_CREATE_FAILED', 'Could not create the invite. Try again in a moment.');
  }

  const { error: authInviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { role, student_id, invite_id: invite.id },
  });

  if (authInviteError) {
    // Compensate: an `invites` row with no invite email ever sent is a stale,
    // misleading "pending" row that can never be accepted, so remove it rather
    // than leaving it behind.
    await adminClient.from('invites').delete().eq('id', invite.id);

    console.error('send-invite: inviteUserByEmail failed', {
      invited_by: callerProfile.id,
      role,
      invite_id: invite.id,
    });

    const alreadyRegistered = /already registered|already exists/i.test(authInviteError.message ?? '');
    if (alreadyRegistered) {
      return errorResponse(
        409,
        'ALREADY_INVITED',
        'This person already has an account. They can sign in directly instead of using an invite.',
      );
    }
    return errorResponse(502, 'INVITE_SEND_FAILED', 'Could not send the invite email. Try again in a moment.');
  }

  // EXTENSION POINT for T048 ("Resend integration + branded layout +
  // email_log"; depends on T017; Allowed Files include "wiring in
  // supabase/functions/send-invite/** (extend, not new function)"):
  // `inviteUserByEmail` has just succeeded and Supabase's own default invite
  // email is already on its way. T048 adds, right here, before the response
  // below:
  //   1. A branded Resend send (template='invite') using `RESEND_API_KEY`
  //      (SEC-03: lives only in Supabase Edge Function secrets, never in src/).
  //   2. An `email_log` insert recording template/recipient/invite_id, per
  //      EML-03's "dedupe against email_log" requirement for the reminder
  //      pipeline (send-invite itself is not on a cron, but should still log
  //      consistently once T048 defines that table's write contract).
  // Nothing below this comment should need to change for that extension.

  return jsonResponse(201, {
    invite: {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      student_id: invite.student_id,
      status: invite.status,
      expires_at: invite.expires_at,
      created_at: invite.created_at,
    },
  });
});
