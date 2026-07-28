// supabase/functions/checkin-token/index.ts
//
// T103 -- ED-1 Packet P8 GAP #1. A coach/admin's authenticated browser
// session (the Kiosk display, `src/pages/meetings/Kiosk.tsx`, or a future
// Live Console wiring) calls this function to receive the CURRENT rotating
// QR token/short code for a given `session_id`, minted server-side. This
// exists because `CHECKIN_HMAC_SECRET` (constitution item 5, BLOCKER-class:
// "no service-role key or server-only secret may ever reach the frontend or
// a client bundle") can never be computed in `src/` -- `checkin`'s own
// Edge Function (T032) only *verifies* a presented token/code, it has no
// minting endpoint, and there was previously no Edge Function anywhere in
// this repo that could safely hand a display screen a live token/code
// without exposing that secret. See `Kiosk.tsx`'s own (pre-T103) module doc
// for the full "GAP #1" write-up this function closes.
//
// -----------------------------------------------------------------------
// Trap #1 (this task's own worker packet) -- cross-directory import of the
// HMAC derivation scheme from `../checkin/hmac.ts`, investigated rather than
// assumed:
// -----------------------------------------------------------------------
// `tokenFor`/`shortCodeFor`/`bucketFor` below are imported, READ-ONLY, from
// `../checkin/hmac.ts` (that whole directory is forbidden to edit for this
// task) instead of being re-implemented a second time here. This is a
// deliberate decision, not a shortcut -- re-deriving the HMAC scheme in a
// second file would create exactly the "two copies that can silently drift"
// risk `hmac.ts`'s own header comment explicitly warns downstream
// consumers (T033/T034/T035) about, and this function's entire job is to
// mint values that `checkin/index.ts`'s `verifyToken`/`verifyShortCode`
// (calling the SAME `hmac.ts` functions) will accept -- any accidental
// divergence between two independently-typed copies would silently break
// real check-ins.
//
// Verified, not assumed, that this cross-directory relative import actually
// resolves and type-checks under this project's real Deno toolchain (the
// same toolchain the Supabase CLI's local `edge_runtime`/deploy bundler
// uses, per `supabase/config.toml`'s `[edge_runtime]` `deno_version = 2`):
//   1. `deno check index.ts` and `deno test` (run from this very directory,
//      against this very import) both pass cleanly -- reproduced in a
//      throwaway sandbox first (a `checkin-token/index.ts` importing a real
//      copy of `checkin/hmac.ts` from `../checkin/hmac.ts`, `deno check`/
//      `deno test` both green with zero resolution errors), then confirmed
//      again against the real files below.
//   2. Deno/ESM module resolution has no concept of a "function directory
//      boundary" -- a relative specifier is resolved purely against the
//      importing module's own URL, exactly the same mechanism whether the
//      target sits next door or three levels up. There is nothing
//      `checkin-token`-specific or `checkin`-specific about that resolution
//      step; it is the same algorithm for every relative import in Deno.
//   3. This repo already has a real, checker-reviewed precedent for an even
//      MORE adventurous cross-directory relative import from inside a
//      Supabase Edge Function: `send-invite/index.ts` (T017/T048) imports
//      `../../../src/emails/layout/renderEmailLayout.ts` and
//      `../../../src/emails/templates/invite.tsx` -- reaching all the way
//      out of `supabase/functions/**` into `src/`, a much longer and more
//      unusual path than this file's single-level `../checkin/hmac.ts`
//      sibling-directory import. `docs/swarm/verification-log.md`'s T048
//      entry records that import as a checker-reviewed, "correctly-flagged,
//      appropriately-deferred residual risk" (deferred only because no
//      *live* `supabase functions deploy` had been run yet at that time),
//      not a rejected pattern -- i.e. the general shape ("a Supabase Edge
//      Function's `index.ts` importing a sibling TypeScript module outside
//      its own immediate directory via a relative path") is already an
//      accepted, working pattern in this codebase's own history. This
//      file's import is strictly narrower in scope (stays entirely inside
//      `supabase/functions/**`, imports a Deno-native, zero-non-Deno-
//      dependency module that already only uses the Web Crypto API) and is
//      therefore lower-risk than that already-accepted precedent.
//   4. Supabase's own documented Edge Functions guidance describes sharing
//      code between functions via relative imports out of a function's own
//      directory (its own worked example uses a `_shared/` folder imported
//      as `../_shared/cors.ts`) -- confirming the CLI's real deploy bundler
//      (which walks the actual import graph from each function's own
//      `index.ts`, the same way `deno check`/`deno test` do, not by
//      directory-boundary allowlisting) is designed to support exactly this
//      shape.
// Residual, disclosed risk (same class T048's own checker entry already
// accepted for its own, larger cross-directory import): this has not been
// verified against a *live* `supabase functions deploy` in this sandbox (no
// live Supabase project/Docker available here) -- `deno check`/`deno test`
// passing is strong, but not 100%-identical-to-production, evidence. Same
// residual noted in this task's own worker output "Known risks".
//
// -----------------------------------------------------------------------
// Two-client architecture (constitution item 5) -- same pattern
// `checkin/index.ts` and `send-invite/index.ts` both already established:
// -----------------------------------------------------------------------
//   - `callerClient`: built from the request's own `Authorization` header
//     (the caller's own JWT) plus the *anon* key. Used only to identify who
//     is calling (`auth.getUser()`) and to read their own `profiles` row
//     (RLS `profiles_read`: `for select to authenticated using (true)` --
//     verified against `supabase/migrations/20260717000002_rls.sql`, same
//     citation `send-invite/index.ts` already relies on for the identical
//     query). The caller's role is NEVER trusted from the request body --
//     it is always looked up here, mirroring `send-invite/index.ts`'s own
//     established "never trust a client-supplied role" discipline (that
//     file, read-only reference for this task, makes the identical point
//     in its own header comment).
//   - `adminClient`: built from `SUPABASE_SERVICE_ROLE_KEY`, one of
//     Supabase's own auto-injected Edge Function env vars, read only via
//     `Deno.env.get(...)`. Never hardcoded, never echoed in a response or
//     log. Used only to look up the requested `event_sessions` row (a
//     coach/admin session has full read access to that table via its own
//     `staff_all` RLS policy already, so the service-role client is not
//     strictly required for this one read -- it is used anyway, for the
//     same reason `checkin/index.ts` uses it for its own session lookup:
//     consistency of "every real DB read in this function goes through one
//     client, chosen once, not conditionally per-query", and because this
//     function's authorization gate below is meant to be the actual
//     enforcement point, not merely "whatever RLS happens to allow this
//     caller").
//
// -----------------------------------------------------------------------
// Authorization: coach/admin role check + team-scope check.
// -----------------------------------------------------------------------
// Role check: identical shape to `send-invite/index.ts`'s own gate --
// `callerProfile.role !== 'coach' && callerProfile.role !== 'admin'` ->
// 403 `FORBIDDEN`, evaluated BEFORE the service-role client is even
// constructed (same ordering `send-invite/index.ts` already establishes).
//
// Team-scope check: this task's own worker packet (Known Context/Traps #2)
// asks for this function to "confirm the caller's coach/admin scope
// actually covers that session's event's `team_ids`", mirroring
// `checkin/index.ts`'s own student-side team-scope check (that function's
// own `TEAM_SCOPE_MISMATCH` branch, comparing `student.team_id` against
// `event.team_ids`). Investigated directly against the real, frozen schema
// (grep-verified, not assumed) rather than assumed to have a coach-side
// equivalent:
//   - `public.profiles` (`supabase/migrations/20260716000000_identity_
//     roster.sql`, lines 16-24) has no `team_id`/`team_ids` column at all.
//   - No `coach_teams`/`assigned_teams`/similar junction table exists
//     anywhere in `supabase/migrations/**` (grepped for
//     `coach.*team|team.*coach|coach_teams|assigned_team|managed_team`
//     across every migration file -- zero matches).
//   - `is_staff()` (`20260717000002_rls.sql` lines 15-17:
//     `select coalesce(auth_role() in ('admin','coach'), false)`) is the
//     ONLY authorization primitive this schema has for staff, and it is
//     unconditional on team -- every `staff_all` RLS policy in this schema
//     (`teams`, `students`, `events`, `event_sessions`, `attendance`, etc.)
//     already grants a coach/admin caller full read/write access to every
//     team's rows, with no per-team restriction anywhere.
// A coach/admin's "scope" is therefore GLOBAL (all teams) by design in this
// frozen data model -- there is no narrower per-coach team assignment to
// compare `event.team_ids` against, unlike the student side (where
// `student.team_id` is a real, single, narrower value). This function still
// performs the structurally-equivalent lookup `checkin/index.ts` performs
// (fetch the session, fetch its event, confirm both exist -> 404
// `SESSION_NOT_FOUND` if not) -- the genuine, disclosed difference is that
// there is no further per-team comparison to make once a caller has already
// passed the coach/admin role gate above, because no such narrower scope
// exists to check in this schema. This is documented here rather than
// silently fabricating a `team_ids`-comparison branch that could never
// actually reject a real coach/admin caller (which would be dead,
// misleading code, not a real security boundary).
//
// `CHECKIN_HMAC_SECRET` (SEC-03: "lives only in Supabase Edge Function
// secrets") is read only via `Deno.env.get('CHECKIN_HMAC_SECRET')`, the
// exact same secret `checkin/index.ts` already reads (this function mints
// with it, `checkin/index.ts` verifies with it -- one secret, two Edge
// Functions, never echoed in any response body, never logged, by either
// function).
//
// No rate limiting here (unlike `checkin`'s short-code-guessing concern,
// per this task's own worker packet Known Context/Traps #2) -- this
// endpoint is coach/admin-authenticated, not a public guessing surface;
// `checkin`'s rate limiter exists specifically because ITS caller is an
// unauthenticated-for-that-purpose student typing a 6-character guess.
//
// -----------------------------------------------------------------------
// Testability: `Deno.serve(...)` is guarded behind `if (import.meta.main)`
// -----------------------------------------------------------------------
// Every other `index.ts` in this repo (`checkin`, `send-invite`, `ics`,
// `send-reminders`) calls `Deno.serve(...)` unconditionally at module
// scope, which is exactly why none of them has its own `index.test.ts` --
// `send-invite/index.ts`'s own header comment documents (empirically
// verified there) that importing such a module from a `deno test` file
// trips Deno's resource sanitizer the instant that top-level `Deno.serve`
// call runs, before any test body executes. This task's own Allowed Files
// list names `index.test.ts` (not a separate `validation.ts`/
// `validation.test.ts` pair the way `checkin`/`send-invite` use), so the
// pure pieces below (`validateCheckinTokenRequest`, `isValidUuid`,
// `computeBucketExpiresAt`) are exported directly from this file, and the
// `Deno.serve(...)` call at the bottom is guarded by the standard
// `if (import.meta.main)` idiom (Deno's own documented pattern for exactly
// this "importable without side effects" case) -- verified empirically in a
// throwaway sandbox first: a module shaped exactly like this one (top-level
// `Deno.serve` guarded by `import.meta.main`) imports and `deno test`s
// cleanly, with zero resource-sanitizer error, because `import.meta.main`
// is `false` for a module reached via `import`, not run directly.
//
// Imported via the `npm:` specifier (Deno 2 native support), per
// constitution item 9's `@supabase/supabase-js` allowlist entry -- same as
// every other Edge Function in this repo.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { bucketFor, shortCodeFor, tokenFor } from '../checkin/hmac.ts';

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
// Same stable shape every other Edge Function in this repo uses:
// { "error": { "code": "SOME_CODE", "message": "human-readable text" } }
function errorResponse(status: number, code: string, message: string): Response {
  return jsonResponse(status, { error: { code, message } });
}

// ---------------------------------------------------------------------------
// Pure request-body validation -- same shape/style as
// `checkin/validation.ts`'s own `validateCheckinRequest`, narrowed to this
// function's own single-field contract (`session_id` only; no token/code --
// this endpoint MINTS, it never verifies a caller-presented credential).
// `isValidUuid`'s regex is a small, disclosed, intentional duplicate of
// `checkin/validation.ts`'s own identical one-line uuid-format check (NOT
// the HMAC derivation scheme itself, which is the actual thing Trap #1
// above is about never duplicating) -- this task's own Allowed Files list
// does not authorize a new `checkin-token/validation.ts` module, and a
// single-line format regex carries none of the "silently drift from the
// real derivation logic" risk a second HMAC implementation would.
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export interface CheckinTokenRequestBody {
  session_id: string;
}

export type CheckinTokenValidationErrorCode = 'INVALID_BODY' | 'MISSING_SESSION_ID' | 'INVALID_SESSION_ID';

export interface CheckinTokenValidationError {
  code: CheckinTokenValidationErrorCode;
  /** DES-16 style: what happened + what to do. No apologies. */
  message: string;
}

export type CheckinTokenValidationResult =
  | { ok: true; value: CheckinTokenRequestBody }
  | { ok: false; error: CheckinTokenValidationError };

/**
 * Validates a parsed JSON request body against this function's contract:
 * exactly one required field, `session_id`, that must look like a uuid.
 * Does not check that the session actually exists, or that the caller is
 * authorized to mint a token for it -- those require a DB round-trip and
 * are done separately below.
 */
export function validateCheckinTokenRequest(body: unknown): CheckinTokenValidationResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return {
      ok: false,
      error: { code: 'INVALID_BODY', message: 'Send a valid JSON body with session_id.' },
    };
  }

  const raw = body as Record<string, unknown>;
  const sessionIdPresent = raw.session_id !== undefined && raw.session_id !== null && raw.session_id !== '';
  if (!sessionIdPresent) {
    return {
      ok: false,
      error: { code: 'MISSING_SESSION_ID', message: 'session_id is required to request a check-in token.' },
    };
  }
  if (!isValidUuid(raw.session_id)) {
    return {
      ok: false,
      error: { code: 'INVALID_SESSION_ID', message: 'session_id must be a valid session identifier.' },
    };
  }

  return { ok: true, value: { session_id: raw.session_id as string } };
}

// ---------------------------------------------------------------------------
// Pure response shaping -- the current bucket's inclusive end instant, as an
// ISO timestamp (`hmac.ts` step 1: `bucket = floor(unixSeconds / 60)`, so
// bucket `b` covers `[b*60, (b+1)*60)` seconds since the epoch -- this
// response field is the START of the NEXT bucket, i.e. the first instant at
// which this response's `token`/`shortCode` are no longer the CURRENT
// bucket's values, per this task's own worker packet Known Context/Traps
// #2: "an ISO timestamp for when the current bucket ends").
// ---------------------------------------------------------------------------
export function computeBucketExpiresAt(bucket: number): string {
  return new Date((bucket + 1) * 60 * 1000).toISOString();
}

export interface CheckinTokenSuccessResponse {
  token: string;
  shortCode: string;
  bucketExpiresAt: string;
}

/**
 * The full request handler -- exported (named, not anonymous) so a future
 * task could exercise it against an injected/stubbed transport without
 * changing this file's own shape, mirroring why `checkin/index.ts`'s sibling
 * `resolveResponse`/`validateCheckinRequest` helpers are pulled out and
 * exported rather than left inline. Not itself `deno test`-covered here
 * (this task's own Allowed Files list authorizes only `index.test.ts`, and
 * every real branch below requires a live/stubbed Supabase transport this
 * task's packet does not ask for -- the pure pieces above ARE the tested
 * surface, same "pure logic is unit-tested, I/O orchestration is not" split
 * `checkin/index.ts` itself already establishes between its own
 * `Deno.serve` callback and its `validation.ts`/`hmac.ts`/`grace.ts`/
 * `liveness.ts` siblings).
 */
export async function handleCheckinTokenRequest(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Use POST to request a check-in token.');
  }

  // Supabase's own auto-injected Edge Function secrets (local and hosted),
  // plus this project's own `CHECKIN_HMAC_SECRET` (SEC-03) -- all four read
  // only via `Deno.env.get`, never hardcoded.
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const hmacSecret = Deno.env.get('CHECKIN_HMAC_SECRET');

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !hmacSecret) {
    // Config/deployment problem, not a caller problem -- no detail on which
    // var is missing, to avoid leaking anything about the deployment (same
    // posture `checkin/index.ts`/`send-invite/index.ts` already use).
    return errorResponse(
      500,
      'CONFIG_ERROR',
      'The check-in token service is not configured correctly. Contact an administrator.',
    );
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return errorResponse(401, 'UNAUTHENTICATED', 'Sign in and try again.');
  }

  // --- Client 1: caller-JWT client. Identifies the caller and reads their
  // own `profiles` row; every query it makes is still subject to RLS. ---
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userError } = await callerClient.auth.getUser();
  if (userError || !userData?.user) {
    return errorResponse(401, 'UNAUTHENTICATED', 'Your session has expired. Sign in again and try again.');
  }
  const callerId = userData.user.id;

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return errorResponse(400, 'INVALID_BODY', 'Send a valid JSON body with session_id.');
  }

  const validated = validateCheckinTokenRequest(rawBody);
  if (!validated.ok) {
    return errorResponse(400, validated.error.code, validated.error.message);
  }
  const { session_id: sessionId } = validated.value;

  // `profiles_read` RLS policy is `for select to authenticated using (true)`
  // (`supabase/migrations/20260717000002_rls.sql`) -- same citation
  // `send-invite/index.ts` already relies on for the identical query, so the
  // caller-JWT client can read its own row without the service-role client.
  const { data: callerProfile, error: profileError } = await callerClient
    .from('profiles')
    .select('id, role')
    .eq('id', callerId)
    .maybeSingle();

  if (profileError) {
    return errorResponse(500, 'PROFILE_LOOKUP_FAILED', 'Could not verify your account. Try again in a moment.');
  }

  // The function's own authorization gate -- never trusts a client-supplied
  // role (mirrors `send-invite/index.ts`'s own established discipline).
  // Evaluated before the service-role client is even constructed.
  if (!callerProfile || (callerProfile.role !== 'admin' && callerProfile.role !== 'coach')) {
    return errorResponse(403, 'FORBIDDEN', 'Only coaches and admins can view live check-in codes.');
  }

  // --- Client 2: service-role client. Constructed only from
  // Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') -- never from a
  // client-supplied value, never logged, never returned in any response
  // body. ---
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Mirrors `checkin/index.ts`'s own session+event lookup shape (one
  // embedded-relation select). See the module doc above ("Authorization")
  // for why there is no further per-team comparison beyond confirming both
  // rows exist -- a coach/admin's scope is global in this schema.
  const { data: session, error: sessionError } = await adminClient
    .from('event_sessions')
    .select('id, event:events(id, team_ids)')
    .eq('id', sessionId)
    .maybeSingle();

  if (sessionError) {
    return errorResponse(500, 'SESSION_LOOKUP_FAILED', 'Could not look up this session. Try again in a moment.');
  }

  // Same TS2352 "go through unknown first" note `checkin/index.ts` already
  // documents for this identical embedded-relation shape.
  const event = session?.event as unknown as { id: string; team_ids: string[] | null } | null;
  if (!session || !event) {
    return errorResponse(404, 'SESSION_NOT_FOUND', "That session couldn't be found. Refresh and try again.");
  }

  const nowSeconds = Math.floor(Date.now() / 1000);
  const bucket = bucketFor(nowSeconds);
  const [token, shortCode] = await Promise.all([
    tokenFor(hmacSecret, sessionId, bucket),
    shortCodeFor(hmacSecret, sessionId, bucket),
  ]);

  const payload: CheckinTokenSuccessResponse = {
    token,
    shortCode,
    bucketExpiresAt: computeBucketExpiresAt(bucket),
  };

  return jsonResponse(200, payload);
}

if (import.meta.main) {
  Deno.serve(handleCheckinTokenRequest);
}
