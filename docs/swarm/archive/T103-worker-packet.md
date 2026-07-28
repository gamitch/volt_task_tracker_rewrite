# Worker Packet: T103

## Task ID
T103 — ED-1 Packet P8: real Kiosk live tally/session-title (GAP #2) + a new
`checkin-token` Edge Function that safely mints the live rotating QR
token/short-code (GAP #1).

## Objective
`src/pages/meetings/Kiosk.tsx` currently shows three disclosed gaps, all fixture/
stub data. This packet closes all three:
- **GAP #2 (tally + session title):** real Supabase reads. No Edge Function needed —
  `attendance`'s RLS already allows coach/admin reads; the gap is only "no shared
  client used here yet," the same class of gap every ED-1 packet so far has closed.
- **GAP #1 (live QR token / short code):** this one is different in kind. The
  `CHECKIN_HMAC_SECRET` that derives a valid token must never reach the browser
  (constitution item 5) — the browser cannot compute this itself. This requires a
  **new Edge Function** (`supabase/functions/checkin-token/`) that a coach/admin's
  authenticated browser session calls to receive the live token/short code for a
  session, minted server-side.

## Allowed Files
- `src/pages/meetings/Kiosk.tsx`, `Kiosk.test.tsx`
- `src/lib/supabase/loaders/kiosk.ts` (new)
- `supabase/functions/checkin-token/index.ts` (new)
- `supabase/functions/checkin-token/deno.json` (new — mirror
  `supabase/functions/checkin/deno.json`'s exact `strict: true` shape)
- `supabase/functions/checkin-token/index.test.ts` (new)

## Forbidden Files
- `supabase/functions/checkin/**` — read-only. You will very likely need to import
  `tokenFor`/`shortCodeFor`/`bucketFor` from `../checkin/hmac.ts` (a relative import
  across function directories) rather than duplicating the HMAC derivation scheme —
  **investigate first** whether Supabase's Edge Function deploy/bundling genuinely
  supports this (it bundles by following the actual import graph from each
  function's own `index.ts`, not by directory boundary — verify this claim yourself,
  e.g. via `supabase functions --help` output, the Supabase CLI/Deno docs available
  to you, or a local `deno check`/`deno test` proving the cross-directory import
  resolves and type-checks). If you confirm it works, import read-only from
  `../checkin/hmac.ts` — do not modify that file, and do not re-implement the HMAC
  scheme a second time (that would create exactly the kind of two-copies-that-can-
  silently-drift risk the existing file's own header explicitly warns about). If you
  genuinely cannot confirm cross-directory imports are safe/supported for this
  project's deploy setup, document why and fall back to a small isolated
  re-implementation with an explicit "must stay byte-for-byte in sync with
  `checkin/hmac.ts`'s derivation scheme" comment — this is a real design decision,
  investigate before choosing either path.
- `src/lib/supabase/loaders/meetings.ts`, `client.ts`, `auth.ts`, `types.ts`,
  `loader.ts`, `functions.ts` — read-only imports as needed.
- Every other file. `router.tsx`, `guards.tsx`, `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. GAP #2 — real tally + session title, straightforward.**
`KioskTallyLoader`/`KioskSessionTitleLoader` types are already defined in
`Kiosk.tsx` (read the file for their exact shapes). Real tally: count real
`attendance` rows for the session (checked-in count) vs. an "expected" count (real
roster size in scope for the session's event/team — read `checkSessionLiveness`'s
sibling `liveness.ts`/`attendance_upsert.ts` only for context if useful, they are
read-only Edge-Function-side files, not something to import into frontend code).
Session title: real `event_sessions`/`events` join. Both are ordinary `loaders/
kiosk.ts` reads, same DI (`getClient`) convention every prior `loaders/*.ts` file
already established — no new pattern needed here.

**2. GAP #1 — the new `checkin-token` function, modeled directly on
`checkin/index.ts`'s own established two-client architecture (read it in full
before writing anything — same file, same repo, same constitution item 5 posture,
just minting instead of verifying).**
- `callerClient` (built from the request's `Authorization` header + anon key):
  identify the caller (`auth.getUser()`), then verify their **role is `coach` or
  `admin`** by querying their own `profiles` row — **never trust a client-supplied
  role** (mirror `send-invite/index.ts`'s own established "look role up from
  `profiles`, never accept it as input" pattern — that file is a useful read-only
  reference for this exact discipline, do not modify it).
- `adminClient` (service-role key from `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`):
  look up the requested `event_sessions` row and confirm the caller's coach/admin
  scope actually covers that session's event's `team_ids` (mirror
  `checkin/index.ts`'s own team-scope check, adapted for a coach/admin caller
  instead of a student).
- Once authorized: compute `bucketFor(Date.now()/1000)`, then `tokenFor`/
  `shortCodeFor` (from wherever Trap #1's investigation lands you) for the CURRENT
  bucket only (no need to also return the previous bucket — this endpoint mints,
  `checkin/index.ts`'s own `verifyToken`/`verifyShortCode` already accept a
  ±1-bucket window on the verifying side). Return `{ token, shortCode,
  bucketExpiresAt }` (an ISO timestamp for when the current bucket ends, so the
  frontend knows when to poll again) — **never** return the secret, never log it.
- No rate limiting needed here (unlike `checkin`'s short-code-guessing concern) —
  this endpoint is coach/admin-authenticated, not a public guessing surface.
- `CORS_HEADERS`/`jsonResponse`/`errorResponse` helper shapes: mirror
  `checkin/index.ts`'s own conventions exactly (same error body shape
  `{ error: { code, message } }`, same DES-16 tone) for consistency across this
  project's Edge Functions.
- Unit-test the pure pieces (request validation, response shaping) the same way
  `checkin/validation.test.ts` does; a `deno test` file is expected here too.

**3. Frontend wiring.** `Kiosk.tsx`'s `loadDisplayToken` prop (currently defaulting
to `fixtureLoadKioskDisplayToken`) should default to a new `loaders/kiosk.ts`
function that calls this new Edge Function (same `fetch` + bearer-token pattern
`CheckinResult.tsx`/T100 already established for calling `checkin` — read that file
for the precedent, it's a Forbidden read-only reference here) and re-polls on the
existing `~45s` `usePolling` cadence already wired into `useKioskDisplayToken`
(unchanged — do not touch the polling interval itself, only the loader it calls).

**4. Update the in-UI disclosure Banner.** The current "Check-in QR/code below use
fixture data" `Banner` (GAP #1's own disclosure) must be removed or updated once
this is real — do not leave a stale banner claiming fixture data once it's live.
Same for GAP #2's "Live tally not wired" banner.

**5. Test files.** Same "inject the fixture explicitly through the seam" pattern
established by every prior ED-1 packet for `Kiosk.test.tsx`, plus a new
`checkin-token/index.test.ts` mirroring `checkin`'s own Edge-Function test
conventions (read `supabase/functions/checkin/*.test.ts` for the established
`deno test` style in this repo).

## Acceptance Criteria
- `Kiosk.tsx`'s tally and session-title loads are real.
- A new `checkin-token` Edge Function mints a real, correctly-scoped (coach/admin +
  team-scope verified) token/short-code for the current time bucket, using the
  same HMAC derivation scheme as `checkin/hmac.ts` (either via a verified-safe
  cross-directory import or a documented, explicitly-synced fallback), with the
  signing secret never leaving the server.
- `Kiosk.tsx`'s `loadDisplayToken` real default calls this new function.
- Both stale "fixture data" banners are removed/updated to reflect real wiring.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run
  format:check` all clean for frontend files; `deno test`/`deno check`/`deno lint`
  clean for the new Edge Function files (mirror how prior Edge-Function tasks in
  this project's ledger verified this — check `docs/swarm/verification-log.md` for
  the exact commands a prior Edge Function task, e.g. T017/T032, used).
- Zero regressions elsewhere.

## Relevant Constitution Excerpts
> Constitution item 5: no service-role key or server-only secret may ever reach
> the frontend or a client bundle.

> No worker may mark its own work complete; every PASS requires independent
> checker-inspected evidence.

## Most Recent Failure
None. This is attempt 1 for T103 (attempt count: 0) — first dispatch.

## Required Worker Output
- Full diff of every changed/new file.
- Your Trap #1 investigation (cross-directory import vs. fallback) and final
  decision, in full — this is the packet's highest-risk design choice.
- Confirmation of the coach/admin + team-scope authorization check in the new
  function, with the exact query/logic used.
- Full frontend test/typecheck/lint/build/format:check output AND full
  `deno test`/`deno check`/`deno lint` output for the new Edge Function.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
