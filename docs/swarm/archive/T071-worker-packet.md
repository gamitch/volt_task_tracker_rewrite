# Worker Packet: T071

## Task ID
T071

## Objective
Create the single shared, typed Supabase client module (`src/lib/supabase/**`) the whole frontend
will consume — closing the cross-cutting gap independently flagged by six prior tasks (T018, T020,
T021, T034, T035, T056), each of which confirmed via `grep -rn "createClient|supabase-js" src/`
that zero real client usage exists anywhere in `src/`, and each of which shipped its own page
against an injectable `loadData`-style seam defaulting to honest fixture/null data. This task
provides three things, all new files, and touches nothing else:

1. **Client singleton** — exactly one `createClient` call site in all of `src/`, lazily
   initialized (module import alone must never throw), reading `import.meta.env.VITE_SUPABASE_URL`
   / `import.meta.env.VITE_SUPABASE_ANON_KEY` (the exact names already in `.env.example` from
   T015). Anon key only — the words "service role" must never appear here as a capability
   (constitution item 5, BLOCKER).
2. **Auth/session surface** — thin, typed wrappers shaped to slot into `guards.tsx`'s existing
   `AuthContextValue` contract WITHOUT modifying `guards.tsx` in this task (read it first, see
   Ground Truth below): initial session retrieval, an auth-state-change subscription helper
   (returns an unsubscribe function), password sign-in, Google OAuth sign-in (the exact
   `signInWithOAuth({ provider: 'google', options: { redirectTo } })` shape `guards.tsx`'s own TODO
   comment anticipates), sign-out, and a role-resolution helper that reads the signed-in user's
   `profiles.role`. A signed-in auth user with no matching `profiles` row is the AUTH-04 no-access
   case (T019's trigger guarantees a row for any legitimately-invited user) — this must surface as
   a distinct typed result, never an exception swallowed into "no role."
3. **Typed loader seam** — a generic building block matching the convergent pattern all six flagged
   pages independently arrived at: `(args) => Promise<Data | null>`. Provide a small helper (e.g.
   `createLoader`) wrapping a query against the shared client with normalized error semantics:
   transport/query errors reject with a typed error carrying DES-16-compatible fields (what
   happened + what to do, no apologies), "no rows" resolves `null` where the return type allows it,
   and there is NO catch-and-return-fake-data path anywhere. Plus a `types.ts` with hand-authored
   row interfaces for the tables/views the six flagged pages need at minimum: `invites`, `students`,
   `teams`, `profiles`, `event_sessions`, `attendance`, `v_student_participation` — column
   names/types transcribed from the real migration files under `supabase/migrations/`, cited
   line-by-line in your output. Types only — re-deriving any metric formula or RLS logic in
   TypeScript is a BLOCKER (constitution item 3, DATA-01).

This task does NOT write any page-specific loader implementation and does NOT touch any page file.

## Dependencies (status)
- T015 (Supabase Auth provider config) — Passed. Owns the env-var names this client must match
  exactly.
- T019 (DB trigger: invite acceptance → profile/link) — Passed. Guarantees the
  profiles-row-at-first-sign-in invariant the role-resolution helper depends on, and is the live
  confirmation of the real role vocabulary (`role_enum`).

## Allowed Files
- `src/lib/supabase/**` — all new: implementation file(s), `types.ts`, a barrel `index.ts`, and
  unit tests colocated as `src/lib/supabase/*.test.ts`. Confirm via `Glob` that `src/lib/supabase/`
  doesn't exist yet before starting.
- `package.json` / `package-lock.json` — strictly for adding `@supabase/supabase-js`
  (allowlisted, constitution item 9). Report the exact version taken; if its peer ranges force any
  other dependency bump, report it explicitly in your output, never take it silently (same rule
  T002a established).

## Forbidden Files
- `src/app/guards.tsx` — **read-only**. Read it in full before designing your auth surface (its
  `AuthContextValue` interface, `Role` type, and the `loginWithGoogle` TODO comment are your
  ground truth for what shape to match). Do not edit it.
- `src/app/router.tsx`, `src/app/AppShell.tsx` — read-only, do not edit.
- Any `src/pages/**` file — do not wire this module into any page. That is a separate follow-up
  task per page/epic.
- `src/theme/**`, `supabase/**` (migrations are frozen ground truth, read-only), `.env.example`
  (byte-unchanged — read-only), `.github/**`, `vite.config.ts`.
- `docs/swarm/**`, `.claude/**`, constitution/ledger/verification-log/dispute-log files.

## Ground Truth — read these files directly yourself, do not guess or transcribe from this packet

**`src/app/guards.tsx`** (read in full, read-only): `AuthContextValue` interface (`user`,
`isLoading`, `login`, `loginWithGoogle`, `logout`), the `Role` type (currently
`'admin' | 'staff' | 'volunteer' | 'coach'` — a stale T005 placeholder, explicitly flagged in that
file's own doc comment), and `loginWithGoogle`'s TODO comment describing the exact
`signInWithOAuth` call it expects a real implementation to make eventually. Your auth surface's
exported shapes should be designed so a future wiring task can swap `guards.tsx`'s internals for
yours with minimal friction — but do NOT resolve the `Role` union mismatch yourself. Export the
real AUTH-05 role vocabulary as its own type (`'admin' | 'coach' | 'student' | 'parent'`, matching
`role_enum` verbatim — confirm by reading `supabase/migrations/20260716000000_identity_roster.sql`
line 12 yourself) and document the mismatch with `guards.tsx`'s stale union explicitly in your
output; reconciliation belongs to the follow-up wiring task that is allowed to edit `guards.tsx`.

**`.env.example`** (read-only): confirms the exact two env-var names (`VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`) already committed by T015. Use these exact names, nothing else.

**Migration files under `supabase/migrations/`** (read-only, frozen): read each one directly for
the row types you need (`invites`, `students`, `teams`, `profiles`, `event_sessions`, `attendance`
tables; `v_student_participation` view). Cite the exact file and line range for each column you
transcribe into `types.ts` — this citation is required checker evidence, not optional.

## External-Prerequisite Posture (staged, not blocked)
George's real Supabase project does not exist yet (same posture as T015/T061). This module must be
fully functional once credentialed, and honest when not:
- An `isSupabaseConfigured()` predicate.
- When either env var is blank/absent, the client getter throws a typed `SupabaseNotConfiguredError`
  (fail loud) — but module import alone must never throw, or the whole app dies at startup for
  every developer without a `.env` file. Use lazy initialization.
- Never fabricate a placeholder URL/key that could be mistaken for real.
- Never return fixture data from this module — honest fixtures live in each page's own loader
  defaults (as established by T018/T020/T034/T056 etc.), not in this data layer. This module either
  returns real data, `null` (no rows), or throws/rejects a typed error — nothing else.

## Acceptance Criteria
- Exactly one `createClient` call site under `src/` (grep-verifiable).
- Env access uses only the two T015 names; TypeScript strict, no `any` in any exported signature.
- Unconfigured mode verified by unit test: blank env → `isSupabaseConfigured()` returns `false`,
  the client getter throws the typed error, but module import itself does not throw.
- Auth surface verified by unit tests against a **stubbed transport** — no real network calls in
  tests: session retrieval, auth-state subscription fires and unsubscribes cleanly, OAuth sign-in
  invoked with provider `'google'` and a caller-supplied `redirectTo`, sign-out clears state,
  role-resolution helper returns the typed role for a present `profiles` row and a distinct
  "no profile" result for a missing one (the AUTH-04 path).
- Loader helper verified by unit tests: transport error → typed rejection with DES-16-compatible
  fields; no-rows → `null`; success → typed data. Prove (by source read, cite it in your output —
  the checker will re-read the source, not just run your tests) there is no fake-data fallback
  branch anywhere.
- Row types in `types.ts` cross-checked column-by-column against the real migration SQL — cite
  exact file/line for every column. Zero metric-formula arithmetic anywhere in this module
  (constitution item 3 — BLOCKER).
- Secret hygiene: no literal URL/key/JWT-shaped string anywhere in your new files, and none in the
  built `dist/` bundle (grep the actual build output, same three-pattern methodology T015 used).
  `.env.example` byte-unchanged.
- `npm run build` / `typecheck` / `lint` / `format:check` / `test` all exit 0.
- CI bundle-size gate stays green (`@supabase/supabase-js` lands in the eager entry chunk — if it
  blows the NFR-04 budget, flag it explicitly for a code-splitting decision in your output; do not
  silently raise the budget yourself).
- D001-method forbidden-file check: only `src/lib/supabase/**` plus the two package files changed.

## Required Worker Output
- Full file list (new files + the two package files' diffs).
- Summary of what each exported function/type does and why it's shaped that way (cite the
  `guards.tsx` contract it's designed to slot into).
- Column-by-column citation mapping every exported row type field to its migration file/line.
- Exact `@supabase/supabase-js` version taken; explicit note of any forced peer-dependency bump.
- Full test-runner output, plus build/typecheck/lint/format:check output.
- Bundle-size gate output with before/after gzip numbers.
- Secret-hygiene grep output (both `src/` and the built `dist/`).
- Explicit note of the `Role`-union mismatch with `guards.tsx` (documented, not resolved).
- Known risks, and whether you believe a dispute is needed (you decide whether to flag — you do
  not resolve disputes yourself).

## Relevant Constitution Excerpts
> 3. RLS policies and metric SQL come **only** from PRD Section 8.4, copied verbatim. Re-deriving
> either, or duplicating a metric formula in TypeScript (PRD DATA-01) → BLOCKER.

> 5. Secrets (service-role keys, HMAC secrets, API keys) must never appear in the frontend bundle.
> BLOCKER, no exceptions.

> 9. Dependencies come only from the allowlist unless boss-architect explicitly authorizes an
> addition. `@supabase/supabase-js` is allowlisted.

> 6. No PII in fixtures/logs; test fixtures use fabricated names.

## Most Recent Failure
None — first attempt.
