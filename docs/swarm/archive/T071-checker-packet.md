# Checker Packet: T071 (Shared Supabase client + auth/session surface) — Check Attempt 1

## Task ID
T071 — Shared Supabase client + auth/session surface + typed loader seam (`src/lib/supabase/**`),
Epic E3. High-leverage infra task: six prior page tasks are blocked on this existing correctly.

## Checker Agent
checker-tests (per task-ledger.md T071 row) — deterministic build/lint/typecheck/test verification,
plus the secret-hygiene and schema-fidelity checks specified below (these are grep/read-based, not
UI/accessibility judgment calls, so checker-tests is the right fit).

## Objective
Verify a purely additive, correctly-scoped shared Supabase client module: exactly one client
instance, an auth surface matching `guards.tsx`'s existing contract, a loader helper with zero
fake-data fallback, and row types that are byte-faithful to the real migrations — with zero secrets
reaching the built bundle and zero re-derivation of RLS/metric-formula logic.

## Allowed Files (worker's only permitted edit)
- `src/lib/supabase/**` (new: `client.ts`, `auth.ts`, `loader.ts`, `types.ts`, `index.ts`, plus
  `client.test.ts`/`auth.test.ts`/`loader.test.ts`)
- `package.json` / `package-lock.json` — strictly for adding `@supabase/supabase-js`

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commit (`17ae532`) — do NOT
infer authorship from commit messages. Confirm `src/app/guards.tsx`, `src/app/router.tsx`,
`src/app/AppShell.tsx`, every `src/pages/**` file, `src/theme/**`, `supabase/**`, `.env.example`,
`.github/**`, and `vite.config.ts` are all byte-unchanged.

## Worker's Claimed Changes (do not trust — verify independently)
1. **`client.ts`**: exactly one `createClient(` call site in all of `src/` (claims grep-verified,
   `client.ts:79`). Reads only `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`. `isSupabaseConfigured()`
   never throws; `getSupabaseClient()` throws a typed `SupabaseNotConfiguredError` only when called
   while unconfigured; module import alone never throws. "Service role" appears only in a doc
   comment disclaiming its use.
2. **`auth.ts`**: `getInitialSession`, `subscribeToAuthStateChange` (returns unsubscribe),
   `signInWithPassword`, `signInWithGoogle(redirectTo)` (calls
   `signInWithOAuth({provider:'google', options:{redirectTo}})`), `signOut`, `resolveRole(userId)`
   returning `{status:'found', role}` or `{status:'no-profile'}` (AUTH-04) — never an exception
   folded into "no role"; genuine query errors still reject via `SupabaseLoaderError`. **Disclosed
   design choice**: the five direct `client.auth.*` wrappers propagate raw `AuthError` unwrapped,
   NOT DES-16-wrapped — worker claims the packet's DES-16 requirement was scoped only to the Loader
   helper. Judge whether this reading is correct or whether the packet intended broader coverage.
3. **`loader.ts`**: `createLoader<TArgs,TData>(query, getClient?)`. Claims only two `throw`
   statements exist, both `throw toLoaderError(...)`; only success path is
   `return result.data ?? null;`; zero fixture/placeholder literals (grep-confirmed by worker).
4. **`types.ts`**: `Role` (own union, deliberately NOT reusing `guards.tsx`'s stale `Role` name),
   `ProfileRow`, `TeamRow`+`TeamProgram`, `StudentRow`, `InviteRow`+`InviteStatus`,
   `EventSessionRow`+`EventSessionStatus`, `AttendanceRow`+`AttendanceStatus`+`AttendanceMethod`,
   `VStudentParticipationRow`. Claims zero arithmetic anywhere in the file.
5. **Citation table** mapping every row type to exact migration file/line (reproduced in worker's
   report) — re-verify every row of this table yourself against the real files, do not trust it.
6. **`@supabase/supabase-js@2.110.7`** added; claims `git diff package-lock.json | grep '^-'`
   produces zero output (no existing dependency version changed/bumped).
7. Claims 62/62 tests pass (30 new, all against stubbed transports, zero real network calls);
   `npm run build`/`typecheck`/`lint`/`format:check` all exit 0.
8. **Bundle-size gate**: claims before/after gzip size is identical (140881 bytes both ways) since
   the module isn't imported anywhere yet and is fully tree-shaken out of the production bundle.
9. **Secret hygiene**: claims `src/lib/supabase/` shows only an RFC-2606-style example URL
   (`https://example.supabase.co`) in test fixtures, zero JWT-shaped strings; `dist/` (rebuilt
   fresh) shows zero matches for any Supabase URL/JWT/service-role/env-var-name pattern, since the
   module isn't wired into any bundle-reachable code yet.
10. **`Role`-union mismatch with `guards.tsx`**: disclosed, not resolved, matching the T018
    `InviteRole` precedent (a separately-named type, no attempt to reconcile).
11. `getSupabaseClient()`'s return type is the SDK's default `SupabaseClient` (not
    `createClient<Database>()` with a fully-generated schema) — worker used per-query
    `.overrideTypes<T,{merge:false}>()` instead, disclosed as a known risk (no compile-time
    column-name checking from the client itself for future ad-hoc queries).

## Required Verification Steps
1. **Read all eight files in full** (5 implementation + 3 test files) — do not rely on the
   worker's summary or this packet's paraphrasing.
2. **Single client-instance claim — re-verify yourself.** Run `grep -rn "createClient(" src/`
   yourself and confirm exactly one hit, at the claimed location.
3. **Unconfigured-mode / lazy-init — the core safety property.** Read `client.ts` line by line:
   confirm module-level code (top-level statements executed on import) contains no call that could
   throw when env vars are absent — the `createClient` call itself must be deferred until
   `getSupabaseClient()` is actually invoked, not executed eagerly at module scope. Reproduce the
   worker's "blank env → configured=false, getter throws, import doesn't throw" test yourself
   (either re-run their test or write your own equivalent) rather than trusting the claim.
4. **Auth surface — confirm the `guards.tsx` contract match by reading `guards.tsx` yourself**
   (read-only), not by trusting the worker's citation of line numbers. Confirm `signInWithGoogle`
   genuinely calls `signInWithOAuth({provider:'google', options:{redirectTo}})` exactly (open
   `auth.ts` and check). Independently judge the DES-16-wrapping scope question (item 2 above) —
   is leaving the five direct `client.auth.*` wrappers unwrapped a reasonable, in-scope reading of
   the packet, or does it need rework? State your reasoning explicitly.
5. **`resolveRole` — re-derive the three-way behavior yourself.** Confirm by source read that a
   found profile returns `{status:'found', role}`, a genuinely-missing profile returns
   `{status:'no-profile'}` (not an exception), and a real query/transport error still rejects
   (is NOT silently coerced into `'no-profile'`). Reproduce or independently write a test for this
   distinction — it's the most safety-relevant behavior in the auth surface (conflating "no
   profile" with "query failed" would misroute a real error into the AUTH-04 no-access UI).
6. **`loader.ts` — the BLOCKER-adjacent "no fake-data fallback" claim.** Read the file yourself and
   confirm there is no branch, anywhere, that returns synthesized/fixture data on any error path.
   Grep it yourself for `FIXTURE`/`fixture`/`placeholder`/`mock` — don't trust the worker's grep
   output, reproduce it.
7. **`types.ts` citation table — re-verify EVERY row yourself** against the real migration files
   (`supabase/migrations/20260716000000_identity_roster.sql`,
   `supabase/migrations/20260717000000_scheduling_attendance.sql`,
   `supabase/migrations/20260717000003_metric_views.sql`). Open each cited line range and confirm
   column names/types/nullability genuinely match what's in `types.ts`. A column name/type/
   nullability mismatch is a MAJOR finding (per the packet's own acceptance bar). Also
   independently grep `types.ts` for any arithmetic operator to confirm the "zero formula
   re-derivation" claim (constitution item 3, BLOCKER-class).
8. **Dependency diff — reproduce yourself.** Run `git diff <prior-commit> HEAD -- package-lock.json
   | grep '^-'` (or equivalent) and confirm no existing dependency's resolved version changed —
   don't trust the worker's claim of zero output.
9. **Secret hygiene — reproduce the grep yourself, both `src/lib/supabase/` and a freshly-built
   `dist/`.** Build the project yourself (`npm run build`) and grep the real output for Supabase
   URL patterns, JWT-shaped strings, "service_role"/"service-role", and the literal env-var names.
   Confirm the module is genuinely tree-shaken out (not present at all) since nothing imports it
   yet — this is a stronger and more verifiable claim than "no secrets found" alone.
10. **Bundle-size gate — reproduce yourself** (remove/restore the module, rebuild both times,
    compare gzip sizes) or at minimum confirm via the single fresh build that the module
    contributes zero bytes to `dist/` currently.
11. **Re-run the full test suite, build, typecheck, lint, format:check yourself** — don't accept
    "62/62 passed" / "exit 0" without your own run.
12. **Scope discipline** — confirm nothing in any of these files imports from or references any
    `src/pages/**` file, and that `guards.tsx`'s `Role` type/union was left completely untouched.

## Relevant Constitution Excerpts
- Item 3 (BLOCKER-class): no RLS/metric-formula re-derivation in TypeScript — `types.ts` must be
  pure column-shape transcription, zero computed fields.
- Item 5 (BLOCKER-class): no secrets in the frontend bundle — the built `dist/` output is the
  actual ground truth here, not just the source files.
- Item 9: dependency allowlist — `@supabase/supabase-js` is allowlisted; confirm no other package
  was added and no existing dependency was silently bumped.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase)
- commands run
- exact findings
- explicit verdict on the DES-16-wrapping-scope judgment call (item 2)
- explicit verdict on the `types.ts` citation table's accuracy (row by row, or a summary
  confirming full re-verification)
- explicit verdict on whether the unconfigured/lazy-init safety property genuinely holds
- required rework if failed
- follow-up tasks if passed with minor issues
