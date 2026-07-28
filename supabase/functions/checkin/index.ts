// supabase/functions/checkin/index.ts
//
// T032 -- PRD MTG-06..MTG-12. Student self-check-in via a rotating QR token
// or a manually-entered 6-character short code. On success it:
//   1. Validates the presented token/code via HMAC-SHA256 (hmac.ts) against
//      the current and previous 60-second time bucket (<= 2 min validity).
//   2. Validates the session is live (liveness.ts: 15 min before starts_at
//      through ends_at, status='scheduled') and that the caller's own
//      student row is in scope for the session's parent event's team_ids.
//   3. Upserts one `attendance` row with `method='qr'`, auto-computing
//      `present`/`late` from the 10-minute grace rule (grace.ts).
//   4. Never overwrites an existing row (MTG-09 idempotency; MTG-11 coach
//      rows always win -- see attendance_upsert.ts for the exact guard).
//   5. Rate-limits short-code attempts to 5/min/user (rate_limit.ts).
//
// Two-client architecture (constitution item 5: no service-role key may
// ever reach the frontend or a client bundle) -- same pattern as T017's
// send-invite:
//   - `callerClient`: built from the request's own `Authorization` header
//     (the caller's own JWT) plus the *anon* key. Used only to identify who
//     is calling (`auth.getUser()`). Never used for any table read/write.
//   - `adminClient`: built from `SUPABASE_SERVICE_ROLE_KEY`, one of
//     Supabase's own auto-injected Edge Function env vars, read only via
//     `Deno.env.get(...)`. Never hardcoded, never echoed in a response or
//     log. Used for every actual `students` / `event_sessions` / `events` /
//     `attendance` read and write, because `attendance` deliberately has NO
//     student/parent insert policy (supabase/migrations/20260717000002_
//     rls.sql's own comment: "student self-check-ins happen only inside the
//     `checkin` Edge Function under the service role after token
//     validation") -- a client-writable path around that would be
//     incorrect per the access matrix, so this function's own logic (not
//     RLS) is the only gate on who may write which attendance row.
//
// `CHECKIN_HMAC_SECRET` (SEC-03: "lives only in Supabase Edge Function
// secrets") is read only via `Deno.env.get('CHECKIN_HMAC_SECRET')`, never
// hardcoded, never echoed in any response body, never logged.
//
// Imported via the `npm:` specifier (Deno 2 native support), per
// constitution item 9's `@supabase/supabase-js` allowlist entry.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { validateCheckinRequest } from './validation.ts';
import { verifyToken, verifyShortCode } from './hmac.ts';
import { computeAutoStatus } from './grace.ts';
import { checkSessionLiveness } from './liveness.ts';
import { shortCodeRateLimiter } from './rate_limit.ts';
import { resolveResponse, type AttendanceRow } from './attendance_upsert.ts';

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
// Shape is stable and intended for downstream tasks (T033/T034/T035) to
// match: { "error": { "code": "SOME_CODE", "message": "human-readable text" } }
function errorResponse(status: number, code: string, message: string): Response {
  return jsonResponse(status, { error: { code, message } });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Use POST to check in.');
  }

  // These three are Supabase's own auto-injected Edge Function secrets
  // (local and hosted). CHECKIN_HMAC_SECRET is this project's own secret
  // (SEC-03), set via `supabase secrets set` -- never committed, never
  // hardcoded. All four are read only via Deno.env.get.
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const hmacSecret = Deno.env.get('CHECKIN_HMAC_SECRET');

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !hmacSecret) {
    // Config/deployment problem, not a caller problem -- no detail on which
    // var is missing, to avoid leaking anything about the deployment.
    return errorResponse(500, 'CONFIG_ERROR', 'The check-in service is not configured correctly. Contact an administrator.');
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return errorResponse(401, 'UNAUTHENTICATED', 'Sign in and try again.');
  }

  // --- Client 1: caller-JWT client. Identifies the caller only. ---
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData?.user) {
    return errorResponse(401, 'UNAUTHENTICATED', 'Your session has expired. Sign in again and try checking in.');
  }
  const callerId = userData.user.id;

  // --- Request body validation (validation.ts -- pure, unit-tested). ---
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return errorResponse(400, 'INVALID_BODY', 'Send a valid JSON body with session_id and either token or code.');
  }

  const validated = validateCheckinRequest(rawBody);
  if (!validated.ok) {
    return errorResponse(400, validated.error.code, validated.error.message);
  }
  const { session_id: sessionId, token, code } = validated.value;

  // MTG-06: "Short-code attempts rate-limited to 5/min per user." QR-token
  // attempts (rotating, displayed on a screen/link, not something a user
  // guesses by typing) are not subject to this limit per the PRD's own
  // wording ("short-code attempts"). See rate_limit.ts for the flagged
  // in-memory-only limitation.
  if (code) {
    const allowed = shortCodeRateLimiter.attempt(callerId, Date.now());
    if (!allowed) {
      return errorResponse(429, 'RATE_LIMITED', 'Too many code attempts. Wait a minute and try again, or scan the QR code instead.');
    }
  }

  // MTG-08 validation order: token, then session liveness, then team scope.
  const nowSeconds = Math.floor(Date.now() / 1000);
  const credentialValid = token
    ? await verifyToken(hmacSecret, sessionId, token, nowSeconds)
    : await verifyShortCode(hmacSecret, sessionId, code as string, nowSeconds);

  if (!credentialValid) {
    // PRD's own worked example for this exact case.
    return errorResponse(
      401,
      'INVALID_OR_EXPIRED_CREDENTIAL',
      "That check-in code expired. Codes refresh every minute — grab the new one from the screen.",
    );
  }

  // --- Client 2: service-role client. Constructed only from
  // Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') -- never from a
  // client-supplied value, never logged, never returned in any response
  // body. Used for every table read/write below (attendance has no
  // student/parent write policy -- see file header). ---
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: session, error: sessionError } = await adminClient
    .from('event_sessions')
    .select('id, status, starts_at, ends_at, event:events(id, team_ids)')
    .eq('id', sessionId)
    .maybeSingle();

  if (sessionError) {
    return errorResponse(500, 'SESSION_LOOKUP_FAILED', 'Could not look up this session. Try again in a moment.');
  }
  if (!session) {
    return errorResponse(404, 'SESSION_NOT_FOUND', "That check-in link isn't valid. Ask your coach for the current QR code or short code.");
  }

  const startsAt = new Date(session.starts_at as string);
  const endsAt = new Date(session.ends_at as string);
  const liveness = checkSessionLiveness(session.status as string, startsAt, endsAt, new Date());
  if (!liveness.live) {
    if (liveness.reason === 'not_yet_open') {
      return errorResponse(
        409,
        'SESSION_NOT_OPEN',
        'Check-in isn’t open yet. It opens 15 minutes before the session starts — try again shortly.',
      );
    }
    // 'closed' (past ends_at) and 'not_scheduled' (canceled/completed) both
    // mean "this function will not accept a check-in right now" -- see
    // liveness.ts's file header for the MTG-04 manual-start schema gap this
    // simplification is a documented consequence of.
    return errorResponse(409, 'SESSION_CLOSED', 'Check-in has closed for this session. Ask your coach to record your attendance.');
  }

  const { data: student, error: studentError } = await adminClient
    .from('students')
    .select('id, team_id')
    .eq('profile_id', callerId)
    .maybeSingle();

  if (studentError) {
    return errorResponse(500, 'STUDENT_LOOKUP_FAILED', 'Could not verify your student account. Try again in a moment.');
  }
  if (!student) {
    return errorResponse(403, 'NO_STUDENT_ACCOUNT', 'No student account is linked to your login. Ask a coach to check you in instead.');
  }

  // supabase-js's generic (no Database type param) inference for an
  // embedded FK relation is looser than the actual single-object shape
  // PostgREST returns for a many-to-one embed (event_sessions.event_id ->
  // events.id) -- go through `unknown` first per TS2352's own guidance.
  const event = session.event as unknown as { id: string; team_ids: string[] | null } | null;
  const teamIds = event?.team_ids ?? null;
  if (teamIds !== null && !teamIds.includes(student.team_id as string)) {
    return errorResponse(403, 'TEAM_SCOPE_MISMATCH', "This session isn't open to your team. Check with your coach if you think this is wrong.");
  }

  const checkInAt = new Date().toISOString();
  const status = computeAutoStatus(startsAt, new Date(checkInAt));

  // MTG-09 + MTG-11: insert-or-do-nothing on the (session_id, student_id)
  // unique constraint. See attendance_upsert.ts's file header for the full
  // "unconditional DO NOTHING vs. method-conditioned DO UPDATE" design
  // rationale -- this call is the real-DB equivalent of that module's
  // `applyUpsertIgnoreDuplicates`.
  const { error: upsertError } = await adminClient.from('attendance').upsert(
    {
      session_id: sessionId,
      student_id: student.id,
      status,
      check_in_at: checkInAt,
      method: 'qr',
      recorded_by: callerId,
    },
    { onConflict: 'session_id,student_id', ignoreDuplicates: true },
  );

  if (upsertError) {
    console.error('checkin: attendance upsert failed', { session_id: sessionId, student_id: student.id });
    return errorResponse(500, 'CHECKIN_WRITE_FAILED', 'Could not record your check-in. Try again in a moment.');
  }

  const { data: row, error: readBackError } = await adminClient
    .from('attendance')
    .select('*')
    .eq('session_id', sessionId)
    .eq('student_id', student.id)
    .single();

  if (readBackError || !row) {
    console.error('checkin: attendance read-back failed', { session_id: sessionId, student_id: student.id });
    return errorResponse(500, 'CHECKIN_WRITE_FAILED', 'Could not confirm your check-in. Try again in a moment.');
  }

  // MTG-12: status is never accepted from the client -- it is always the
  // value computed above from the grace rule, never a caller-supplied
  // override. `excused` is never set by this function.
  const payload = resolveResponse(
    { session_id: sessionId, student_id: student.id, status, check_in_at: checkInAt, recorded_by: callerId },
    row as AttendanceRow,
  );

  return jsonResponse(200, payload);
});
