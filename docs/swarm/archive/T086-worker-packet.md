# Worker Packet: T086

## Task ID
T086 — ED-1 Packet P0: data-layer foundation (row types, mutation/Edge-Function call
helpers, unconfigured-error mapping fix). First packet of the ED-1 epic (wiring every
page's fixture-backed seam to the real Supabase data layer). Everything else in ED-1
depends on this packet.

## Objective
This is pure foundation work — no page gets wired to real data in this task. You are
extending `src/lib/supabase/` (the T071 data layer) with the pieces every subsequent
ED-1 packet needs:
1. Missing row types in `types.ts` (the six flagged pages only covered a subset of
   tables; ED-1 needs the rest).
2. A real bug fix: `ProfileRow.avatarUrl` is typed `string` but the column has been
   nullable since T019's migration — fix the type.
3. A shared `runMutation` helper for plain RLS-enforced table writes, with the same
   `SupabaseLoaderError` shape `createLoader` already produces (so every page's
   existing DES-16 error handling keeps working unchanged).
4. A shared `invokeEdgeFunction` helper for calling the four deployed Edge Functions
   (`checkin`, `ics`, `send-invite`, `send-reminders`), which supabase-js authenticates
   automatically via the current session — no manual token handling anywhere.
5. A real bug fix in `createLoader`: `getSupabaseClient()` is called *outside* the
   `try` block, so `SupabaseNotConfiguredError` propagates raw instead of becoming a
   `SupabaseLoaderError`. A dev with no `.env` file must still be able to load every
   wired page and see its normal DES-12 error state, not a crash.

## Allowed Files
- `src/lib/supabase/types.ts`
- `src/lib/supabase/loader.ts`, `src/lib/supabase/loader.test.ts`
- `src/lib/supabase/functions.ts` (new), `src/lib/supabase/functions.test.ts` (new)
- `src/lib/supabase/index.ts`

## Forbidden Files
- `src/lib/supabase/client.ts`, `src/lib/supabase/auth.ts` — already correct, read-only.
- Every `src/pages/**` file — no page gets wired in this task, that's every later
  packet's job. `router.tsx`, `guards.tsx` — out of scope, do not touch.
- `docs/swarm/**`, `.claude/**`, `supabase/migrations/**`, `supabase/functions/**`.

## Known Context / Traps

**1. Row types to add — cross-check every field against the cited migration file/line
yourself, do not trust this list blindly (same discipline the existing `types.ts`
already models):**
- `SeasonRow` — `supabase/migrations/20260716000000_identity_roster.sql` lines 42-50
  (`id, name, startsOn, endsOn, defaultGoalHours, isActive, createdAt`).
- `GuardianLinkRow` — same file, lines 72-79 (`id, parentProfileId, studentId,
  relationship, createdAt`).
- `EventRow` + `EventType` (`'meeting' | 'outreach' | 'competition'`) —
  `20260717000000_scheduling_attendance.sql` lines 33-48. Note `teamIds: string[] |
  null` and `createdBy: string | null`.
- `RsvpRow` + `RsvpStatus` (`'going' | 'maybe' | 'declined'`) — same file, lines 67-76.
  Note `respondedBy: string | null`.
- `NotificationPrefsRow` — `20260717000001_support_audit.sql` lines 32-43 (seven
  boolean columns + `profileId`).
- `CalendarFeedRow` — same file, lines 47-53. Note `revokedAt: string | null`.
- `EmailLogRow` — same file, lines 68-77. `sessionId`/`profileId` are both nullable by
  design (no FK).
- `AuditLogRow` — same file, lines 86-94. `meta: Record<string, unknown>`.
- `VStudentHoursRow` — `20260717000003_metric_views.sql` lines 3-19. **Passthrough
  only**: `studentId, seasonId, confirmedHours`. Do not compute or re-derive anything
  from this view's SQL — same non-re-derivation discipline the existing
  `VStudentParticipationRow` doc comment models (constitution item 3, BLOCKER).
- `VTeamParticipationRow` — same file, lines 44-49. `teamId, seasonId,
  participationPct`. Same passthrough-only discipline.

**2. `ProfileRow.avatarUrl` fix.** Currently typed `avatarUrl: string`. Migration
`20260718000000_invite_trigger.sql` line 44-45 runs `alter table public.profiles alter
column avatar_url drop not null` specifically because the invite-acceptance trigger's
own `insert into public.profiles` omits the column (SET-01's "upload later" flow — read
that migration's own module doc for the full reasoning if you want it). Fix: `avatarUrl:
string | null`. Update the doc comment's citation to reference both migration files
(the original `not null` and the later `drop not null`), the same way the file already
handles a multi-migration citation elsewhere if you find a precedent, or add one clearly
if this is the first.

**3. `runMutation` helper (new, in `loader.ts` alongside `createLoader` — they share the
error-normalization logic, do not duplicate `toLoaderError`).** Shape:
```ts
export type MutationFn<TArgs, TResult> = (
  client: SupabaseClient,
  args: TArgs,
) => PromiseLike<{ data: TResult | null; error: { message: string; code?: string } | null }>;

export function runMutation<TArgs, TResult>(
  mutation: MutationFn<TArgs, TResult>,
  getClient?: () => SupabaseClient,
): (args: TArgs) => Promise<TResult>;
```
Unlike `createLoader`, a mutation with `data: null, error: null` should resolve to
whatever the caller's own typed "no return payload expected" convention is — most
mutations in this codebase (see the design doc's mutation table) don't need a return
value at all (e.g. revoke, toggle), so consider whether `runMutation` should require a
non-null result or allow `TResult` to be `void`-compatible. Use your judgment, document
your decision, this is a real design choice within your scope (not a dispute — small
enough to decide yourself, per your role).

**4. `invokeEdgeFunction` helper (new file, `functions.ts`).** Concrete pattern (verified
against `supabase/functions/send-invite/index.ts`'s own header comment describing its
"two-client architecture" — read that file's header before writing this, it documents
exactly what the caller side must do):
```ts
export async function invokeEdgeFunction<TResponse>(
  name: string,
  body: unknown,
  getClient?: () => SupabaseClient,
): Promise<TResponse>
```
Implementation: `client.functions.invoke(name, { body })`. supabase-js v2 automatically
attaches `Authorization: Bearer <current session access token>` when a session exists —
this is exactly the caller-JWT `send-invite`'s `callerClient` expects; never read a token
from storage or pass one manually, and never reference a service-role key anywhere in
this file (constitution item 5, BLOCKER).

Error mapping — the deployed functions return a stable shape on failure (verified
directly in `send-invite/index.ts`'s `errorResponse`): `{ error: { code: string;
message: string } }`, where `message` is already hand-authored DES-16 copy (e.g.
`ALREADY_INVITED` → "This person already has an account..." — verify the exact string
yourself, don't guess). On a Supabase JS SDK `FunctionsHttpError`, read
`error.context.json()` to extract that `{code, message}` and rethrow as a
`SupabaseLoaderError`-shaped object (reuse the same interface `loader.ts` exports — the
whole point is that every page's existing DES-16 error handling, built against
`SupabaseLoaderError`, keeps working unchanged whether the rejection came from a table
query or an Edge Function call). On `FunctionsFetchError`/network failure: a fixed code
`'NETWORK'` with fixed DES-16 copy (author one, consistent with `DEFAULT_LOADER_ERROR_MESSAGE`'s
existing tone). On no active session: code `'UNAUTHENTICATED'`, message "Sign in and try
again." (matches `send-invite/index.ts` line 97's own copy for the same case — consistency,
not coincidence).

**5. `createLoader`'s `getSupabaseClient()`-outside-try bug.** Currently:
```ts
return async (args: TArgs): Promise<TData | null> => {
  const client = getClient();   // <-- throws SupabaseNotConfiguredError raw, uncaught
  let result: LoaderQueryResult<TData>;
  try { result = await query(client, args); } catch (transportError) { throw toLoaderError(transportError); }
  ...
```
Fix: move `getClient()` inside the `try`, so a thrown `SupabaseNotConfiguredError`
also becomes a `SupabaseLoaderError` (its `.message` is already good DES-16 copy —
reuse it verbatim as the mapped error's `message`, don't write a new one). Apply the
identical fix to `runMutation`. Add a test proving this: stub `getClient` to throw
`SupabaseNotConfiguredError`, assert the returned promise rejects with a
`SupabaseLoaderError` whose message matches. This is the mechanism that lets a dev with
no `.env` file load every future ED-1-wired page and see a normal error state instead of
an app crash — do not skip this test.

**6. `index.ts` barrel.** Add re-exports for everything new (`runMutation`,
`MutationFn`, `invokeEdgeFunction`, and every new type from `types.ts`), matching the
existing barrel's style exactly.

## Acceptance Criteria
- All 9 new types added, each cross-checked column-by-column against its cited
  migration file/line in your own output (not copied from this packet — verify it
  yourself, this packet's citations could contain a transcription error).
- `ProfileRow.avatarUrl` is `string | null`.
- `runMutation` and `invokeEdgeFunction` exist, are exported from the barrel, and share
  `loader.ts`'s existing `SupabaseLoaderError`/`toLoaderError` machinery (no duplicate
  error-shaping logic).
- The `getClient()`-outside-try bug is fixed in both `createLoader` and `runMutation`,
  with a passing test proving the unconfigured case now rejects with a
  `SupabaseLoaderError`, not a raw thrown error.
- Zero metric-formula arithmetic anywhere in `types.ts` (constitution item 3, BLOCKER) —
  the two new view row types are passthrough-only, same discipline as the existing
  `VStudentParticipationRow`.
- Zero secret/service-role-key reference anywhere in `functions.ts` (constitution item
  5, BLOCKER) — grep-provable.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run
  format:check` all clean. No page file changes anywhere (grep-provable — this packet
  touches only `src/lib/supabase/**`).

## Relevant Constitution Excerpts
> Metric formulas live in SQL views only, never re-derived in TypeScript — BLOCKER.

> No secrets or service-role keys anywhere in the frontend or committed files — BLOCKER.

> No worker may mark its own work complete; every PASS requires independent
> checker-inspected evidence.

## Most Recent Failure
None. This is attempt 1 for T086 (attempt count: 0) — first dispatch.

## Required Worker Output
- Full diff of every changed/new file.
- Column-by-column citation for every new type (file + line, independently re-verified
  by you, not copied from this packet).
- Your `runMutation` void-vs-required-result design decision and reasoning (Trap #3).
- The exact `ALREADY_INVITED` (and at least 2 other) error message strings you verified
  directly from `send-invite/index.ts`, proving you read the real source rather than
  guessing.
- Full test/typecheck/lint/build/format:check output, including the new
  unconfigured-error test's output specifically.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
