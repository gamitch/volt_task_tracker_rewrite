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
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  computeExpiresAt,
  evaluateResendEligibility,
  isResendRequestBody,
  validateInviteRequest,
  validateResendInviteRequest,
} from './validation.ts';
// T048 -- see the EXTENSION POINT comment near the bottom of this file for
// why these are imported here. `SENDER_ADDRESS` and `renderEmailLayout` are
// plain, zero-dependency TypeScript (no React/JSX) living under
// `src/emails/layout/**` so this exact source is importable, byte-unchanged,
// from both the src/ toolchain and this Deno runtime -- see that module's
// own header comment for the full reasoning and the residual risk flagged
// there (unverified against a live Supabase CLI/Docker bundler).
import { SENDER_ADDRESS } from '../../../src/emails/layout/constants.ts';
import { buildInviteFixtureBodyHtml, buildInviteFixturePreviewText } from '../../../src/emails/layout/inviteFixtureBody.ts';
import { renderEmailLayout } from '../../../src/emails/layout/renderEmailLayout.ts';
import { writeEmailLog, type EmailLogStatus } from './email_log.ts';
import { resolveSendMode, sendBrandedEmail } from './resend.ts';

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

// ---------------------------------------------------------------------------
// T090 -- ED-1 Packet P3: resend branch orchestration.
//
// `buildResendInviteBodyHtml` is a resend-specific email body -- deliberately
// NOT `buildInviteFixtureBodyHtml` (imported above, still used unchanged by
// the send path below): that fixture has no `actionLink` slot, and
// `src/emails/layout/inviteFixtureBody.ts` is a forbidden file for this task
// (its own T048 packet owns it). Unlike the send path -- where Supabase's own
// default `inviteUserByEmail` email already carries the real invite link, so
// this task's branded Resend email never needed to embed one -- a resend has
// no second "Supabase default" email going out (`inviteUserByEmail` cannot be
// called again for the same address, which is this whole task's premise), so
// the ONLY real, working invite link the recipient gets this time is the
// fresh one from `generateLink()` below. It must be embedded here.
function buildResendInviteBodyHtml(params: { role: string; actionLink: string }): string {
  return `
    <p style="margin:0 0 16px;">You've been invited to join <strong>VOLT Robotics</strong>'s team portal as a <strong>${params.role}</strong>.</p>
    <p style="margin:0 0 16px;"><a href="${params.actionLink}" style="color:#5b21b6;">Accept your invite</a> to finish setting up your account. This link replaces any earlier invite email you may have received.</p>
    <p style="margin:0; color:#6b6480; font-size:13px;">(This is a placeholder message reusing T048's shared-layout fixture pattern -- T049 owns the real invite template content.)</p>
  `;
}

/**
 * The resend branch's own orchestration, pulled out of the `Deno.serve`
 * handler below into a named function for readability only -- NOT
 * independently `deno test`-covered (disclosed, not an oversight): every
 * `index.ts` in this repo (`checkin`, `ics`, `send-reminders`, and this
 * file's own pre-existing send path) calls `Deno.serve(...)` unconditionally
 * at module scope, and importing any such module from a `deno test` file
 * trips Deno's default resource sanitizer the instant that top-level
 * `Deno.serve(...)` call runs (empirically verified while building this
 * task: a throwaway module reproducing exactly this shape fails with
 * `NotCapable: Requires net access ...` under a plain `deno test`, before any
 * test body even executes) -- there is no existing `index.test.ts` anywhere
 * in this repo for exactly this reason. `evaluateResendEligibility` and
 * `validateResendInviteRequest` (validation.ts, imported above) hold every
 * piece of this branch's logic that COULD be extracted into pure,
 * `deno test`-covered functions without touching that constraint; both are
 * fully covered in `validation.test.ts`. The DB lookup/update,
 * `generateLink`, and branded-email/`email_log` calls below are exactly as
 * untested via `deno test` as the send path's own equivalent
 * `invites` insert / `inviteUserByEmail` call already were before this task
 * -- this is not a new gap introduced here.
 */
async function handleResendInvite(body: Record<string, unknown>, adminClient: SupabaseClient): Promise<Response> {
  const validatedResend = validateResendInviteRequest(body);
  if (!validatedResend.ok) {
    return errorResponse(400, validatedResend.error.code, validatedResend.error.message);
  }

  const { data: existingInvite, error: lookupError } = await adminClient
    .from('invites')
    .select('id, email, role, student_id, status, expires_at, created_at')
    .eq('id', validatedResend.value.invite_id)
    .maybeSingle();

  if (lookupError) {
    console.error('send-invite: resend invite lookup failed', { invite_id: validatedResend.value.invite_id });
    return errorResponse(500, 'INVITE_LOOKUP_FAILED', 'Could not look up this invite. Try again in a moment.');
  }

  const eligibility = evaluateResendEligibility(existingInvite);
  if (!eligibility.ok) {
    const status = eligibility.error.code === 'INVITE_NOT_FOUND' ? 404 : 409;
    return errorResponse(status, eligibility.error.code, eligibility.error.message);
  }

  // `eligibility.ok === true` above only happens when `existingInvite` is a
  // real row (see evaluateResendEligibility's own `null` -> INVITE_NOT_FOUND
  // branch) -- non-null here.
  const invite = existingInvite as {
    id: string;
    email: string;
    role: string;
    student_id: string | null;
    status: string;
    expires_at: string;
    created_at: string;
  };

  // AUTH-06: a resend gives the invitee a brand-new 14-day window, extended
  // from *now* (this task's packet, Known Context/Traps #2) -- not extended
  // from the original expires_at.
  const newExpiresAt = computeExpiresAt();
  const { data: updatedInvite, error: updateError } = await adminClient
    .from('invites')
    .update({ expires_at: newExpiresAt })
    .eq('id', invite.id)
    .select('id, email, role, student_id, status, expires_at, created_at')
    .single();

  if (updateError || !updatedInvite) {
    console.error('send-invite: resend expires_at update failed', { invite_id: invite.id });
    return errorResponse(500, 'INVITE_UPDATE_FAILED', 'Could not resend this invite. Try again in a moment.');
  }

  // `inviteUserByEmail` cannot be called a second time for the same address
  // (this task's whole premise) -- `generateLink` is the documented way to
  // obtain a fresh action link for an existing, not-yet-confirmed invited
  // user without re-creating them. Verified against the installed
  // `@supabase/auth-js` types (`node_modules/@supabase/auth-js/dist/module/
  // lib/types.d.ts`, `GenerateInviteOrMagiclinkParams`): `{ type: 'invite' |
  // 'magiclink', email, options?: { data?, redirectTo? } }`, returning
  // `RequestResultSafeDestructure<{ properties, user }>` -- `data.properties`
  // is only non-null when `error` is null, so both are checked below.
  const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
    type: 'invite',
    email: updatedInvite.email,
    options: {
      data: { role: updatedInvite.role, student_id: updatedInvite.student_id, invite_id: updatedInvite.id },
    },
  });

  if (linkError || !linkData?.properties) {
    console.error('send-invite: resend generateLink failed', { invite_id: updatedInvite.id });
    return errorResponse(502, 'INVITE_SEND_FAILED', 'Could not send the invite email. Try again in a moment.');
  }

  // --- reuse T048's branded-email/email_log machinery -- same calls the
  // send path's own EXTENSION POINT section below makes, substituting the
  // fresh link/invite data. Not duplicated logic: `resolveSendMode`,
  // `sendBrandedEmail`, `renderEmailLayout`, and `writeEmailLog` are the
  // exact same imported functions, called the same way. -----------------
  const sendMode = resolveSendMode();

  const emailHtml = renderEmailLayout({
    previewText: buildInviteFixturePreviewText({ role: updatedInvite.role }),
    bodyHtml: buildResendInviteBodyHtml({ role: updatedInvite.role, actionLink: linkData.properties.action_link }),
  });

  const sendResult = await sendBrandedEmail(
    {
      to: updatedInvite.email,
      subject: 'Your VOLT Robotics invite',
      html: emailHtml,
      from: SENDER_ADDRESS,
    },
    sendMode,
  );

  // Trap #4 decision (this task's own worker packet): reuses the exact same
  // 'invite' template value the send path uses (email_log.ts's `template` is
  // free-text, not FK'd/enumerated) -- a resend is still logically an
  // "invite" template email, and nothing currently reads `email_log` in any
  // way that needs to distinguish an original send from a resend (grepped:
  // `send-reminders/**`'s own dedupe queries key on template values that are
  // never 'invite', per that task's own already-disclosed "not relevant to
  // this task" comment in `email_log_store.ts`). If a future task needs that
  // distinction (e.g. a resend-rate-limit query), it should add a real,
  // separate template value then, with its own reasoning -- not guessed here
  // ahead of any actual reader needing it.
  const emailLogStatus: EmailLogStatus = sendResult.sent
    ? 'sent'
    : sendResult.reason === 'skipped_test_mode'
      ? 'skipped_test_mode'
      : 'failed';

  if (!sendResult.sent && sendResult.reason !== 'skipped_test_mode') {
    console.error('send-invite: resend branded Resend send did not succeed', {
      invite_id: updatedInvite.id,
      reason: sendResult.reason,
    });
  }

  await writeEmailLog(adminClient, {
    to_email: updatedInvite.email,
    template: 'invite',
    session_id: null,
    profile_id: null,
    status: emailLogStatus,
  });
  // --- end reused T048 machinery -------------------------------------------

  // 200, not 201 -- a resend updates an existing row, it does not create a
  // new one (the send path's 201 above is for the genuinely-new-row case).
  // Shape matches the send path's own success response exactly (this task's
  // packet: "same shape as the existing success response"), so the frontend
  // (`ResendInviteFn = (invite: InviteRow) => Promise<InviteRow>`) can reuse
  // the exact same unwrap/mapper it already has for the send response.
  return jsonResponse(200, {
    invite: {
      id: updatedInvite.id,
      email: updatedInvite.email,
      role: updatedInvite.role,
      student_id: updatedInvite.student_id,
      status: updatedInvite.status,
      expires_at: updatedInvite.expires_at,
      created_at: updatedInvite.created_at,
    },
  });
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

  // --- Client 2: service-role client. Constructed only from
  // Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') -- never from a client-supplied
  // value, never logged, never returned in any response body. ---
  //
  // T090 (ED-1 Packet P3): moved up from just before the send path's insert
  // (its prior location) to right after the staff gate above -- this client
  // is constructed purely from already-validated env vars, never from
  // anything in the request body, so this move changes nothing about *when*
  // it becomes available relative to the auth/staff check (still strictly
  // after), and nothing about the send path's own behavior below (every line
  // of the send path from here down is unchanged). It has to exist before
  // body-shape branching now, because the new resend branch (below) needs it
  // too, and both branches must run only after this same staff gate --
  // duplicating a second `createClient(...)` call per branch would be the
  // alternative, but that is strictly worse (two separate client instances
  // doing the exact same thing) for no behavioral benefit.
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --- Request body validation (role_enum vocabulary, student linkage). See
  // validation.ts -- kept separate from I/O so it is unit-testable with
  // `deno test` independent of any Supabase project. ---
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse(400, 'INVALID_BODY', 'Send a valid JSON body with email, role, and student_id.');
  }

  // T090 (ED-1 Packet P3): resend branch point. A request body carrying a
  // truthy `invite_id` field is a resend request -- fully disjoint from the
  // send path below (see validation.ts's own module doc for why `invite_id`
  // was NOT folded into `InviteRequestBody`). This check runs strictly AFTER
  // the auth/staff gate above (same `callerProfile` staff check every send
  // request already passed through), so a non-staff caller cannot reach the
  // resend branch any more than they can reach the send branch -- there is
  // no separate/earlier bypass for resend requests.
  if (isResendRequestBody(body)) {
    return await handleResendInvite(body, adminClient);
  }

  const validated = validateInviteRequest(body);
  if (!validated.ok) {
    return errorResponse(400, validated.error.code, validated.error.message);
  }

  const { email, role, student_id } = validated.value;

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

  // --- T048: branded Resend send + email_log write -----------------------
  //
  // Constitution item 7 (BLOCKER-class): `resolveSendMode()` reads ONLY
  // `Deno.env.get('RESEND_SEND_MODE')` -- it takes no arguments, so nothing
  // derived from this request (email/role/student_id) can influence it.
  // It defaults to 'test' for anything other than the exact literal string
  // 'production'. `sendBrandedEmail()` never constructs a Resend API call
  // at all unless `sendMode === 'production'` -- see resend.ts for the full
  // gate design and Resend-test-mode research citation. Flipping
  // `RESEND_SEND_MODE` to 'production' anywhere is explicitly NOT this
  // task's decision -- that is T052's job (a human sign-off gate, "George
  // reviews T048-T051 test-mode output"), and no code path here defaults to
  // or silently enables it.
  const sendMode = resolveSendMode();

  const emailHtml = renderEmailLayout({
    previewText: buildInviteFixturePreviewText({ role }),
    bodyHtml: buildInviteFixtureBodyHtml({ role }),
  });

  const sendResult = await sendBrandedEmail(
    {
      to: invite.email,
      subject: 'You are invited to VOLT Robotics',
      html: emailHtml,
      from: SENDER_ADDRESS,
    },
    sendMode,
  );

  // Status vocabulary chosen and documented in email_log.ts: 'sent' |
  // 'failed' | 'skipped_test_mode'.
  const emailLogStatus: EmailLogStatus = sendResult.sent
    ? 'sent'
    : sendResult.reason === 'skipped_test_mode'
      ? 'skipped_test_mode'
      : 'failed';

  if (!sendResult.sent && sendResult.reason !== 'skipped_test_mode') {
    // No PII (constitution item 6): logs the failure reason/invite_id, not
    // the recipient's email.
    console.error('send-invite: branded Resend send did not succeed', {
      invite_id: invite.id,
      reason: sendResult.reason,
    });
  }

  // EML-03 ground truth: `email_log` has no FK on session_id/profile_id by
  // design (a delivery log must remain queryable even if the referenced row
  // is later deleted). Neither is set for an invite send: there is no
  // meeting session involved, and the invite recipient has no `profiles`
  // row yet at send time (that row is only created once the invite is
  // accepted -- see the T019 trigger). `invited_by`/`callerProfile.id`
  // (the *sender*, not the recipient) is deliberately NOT written into
  // `profile_id` here: that column represents the email's owner/recipient
  // in this table's design, not whoever triggered the send, so reusing the
  // sender's id there would be semantically wrong.
  await writeEmailLog(adminClient, {
    to_email: invite.email,
    template: 'invite',
    session_id: null,
    profile_id: null,
    status: emailLogStatus,
  });
  // --- end T048 extension --------------------------------------------------

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
