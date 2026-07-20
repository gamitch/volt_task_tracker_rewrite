# Worker Packet: T091

## Task ID
T091 — ED-1 Packet P4: `SeasonProvider` (shared active-season resolution) + real
`SeasonSettings` CRUD/activate + real `seasonId` threading into `ReportsShell`.

## Objective
Every season-scoped page currently receives `PLACEHOLDER_CURRENT_SEASON_ID` (a fixture
constant) instead of a real active season. This packet builds the ONE shared mechanism
every later season-scoped ED-1 packet will consume (`useActiveSeason()`), and wires the
first two real consumers: `SeasonSettings.tsx` (full CRUD + activate) and
`ReportsShell.tsx` (threading the real value instead of the placeholder).

**Critical constraint:** the real production database currently has **zero seasons**
(fresh deploy, no data yet — see `docs/backlog.html`'s deployment-state note). Every
season-scoped page must degrade honestly when this is true — an empty, clearly-worded
state, never a crash, never a silent fallback to fake data.

## Allowed Files
- `src/lib/supabase/loaders/seasons.ts` (new)
- `src/app/SeasonProvider.tsx` (new), `SeasonProvider.test.tsx` (new)
- `src/app/AppShell.tsx` (mount line only — see Trap #5, this is a real judgment call
  about WHERE, not a rubber-stamp addition)
- `src/pages/settings/SeasonSettings.tsx`, `SeasonSettings.test.tsx`
- `src/pages/reports/ReportsShell.tsx`, `ReportsShell.test.tsx`

## Forbidden Files
- `src/pages/reports/ParticipationTab.tsx`, `HoursTab.tsx`, `EventsTab.tsx` — they
  already correctly receive `seasonId` as a prop from `ReportsShell`; you change what
  value flows in, not how they consume it.
- `src/app/App.tsx`, `router.tsx`, `guards.tsx` — do not restructure the provider
  nesting order already established there; you are adding one new provider inside the
  existing tree, not changing the tree's shape.
- `src/lib/supabase/types.ts`, `loader.ts`, `functions.ts`, `client.ts`, `auth.ts`,
  `index.ts` — read-only, already correct (T086).
- Every other file. `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. `loaders/seasons.ts` — real queries.**
- `loadActiveSeason`: `client.from('seasons').select('*').eq('is_active',
  true).maybeSingle()` — the DB's `seasons_single_active_idx` partial unique index
  guarantees at most one row; `createLoader` already resolves `null` on no-rows, which
  is exactly the "zero seasons exist" case, not an error.
- `loadSeasons`: all seasons, for `SeasonSettings`'s own table.
- Create/update/set-active mutations via `runMutation` (T086). **`onSetActiveSeason` is
  TWO separate updates, not one** — the unique index forces this: first
  `deactivateSeasonId` (if not null) → `is_active: false`, THEN `activateSeasonId` →
  `is_active: true`. Order matters (activating first would violate the index while the
  old row is still active). A failure between the two steps leaves zero seasons active
  — this is a real, disclosed risk your output must call out explicitly, not hide.

**2. `SeasonProvider`/`useActiveSeason()` — the shared mechanism.** State shape:
`{ status: 'loading' } | { status: 'ready'; season: SeasonRow } | { status: 'none' } |
{ status: 'error'; error: SupabaseLoaderError }`, plus a `refresh(): void` function
(so `SeasonSettings` can force a re-check right after activating a different season —
without this, the provider's state would go stale the moment an admin changes the
active season from within the same session). `status: 'none'` is a first-class, expected
outcome (zero seasons in the DB today) — every consumer must handle it as a real state,
not treat it as equivalent to `'error'`.

**3. `SeasonSettings.tsx` has its own local `SeasonRow` type** (`extends
Record<string, unknown>`, fields: `id, name, startsOn, endsOn, defaultGoalHours,
isActive` — no `createdAt`), separate from T086's shared `SeasonRow` in
`src/lib/supabase/types.ts`. Same category of decision T087 already made for
`InvitesTab.tsx`'s local types (read that precedent — `docs/swarm/archive/T087-worker-
packet.md` if useful) — decide whether to keep the local type (loader maps into it) or
switch the page to the shared type and drop the duplicate. State your decision and
reasoning; either is acceptable if justified.

**4. `SeasonSettings.onSetActiveSeason`'s existing retry machinery (T082, already
Passed) must keep working.** `lastFailedActivateTarget` + the retry `Banner` action
already exist and are correct — your job is to make the underlying
`onSetActiveSeason` call real (currently fixture-backed), not to change the
retry UI/state machine around it. If the real two-step mutation fails partway (Trap #1),
that failure should surface through this EXISTING retry path, not a new one.

**5. Where does `SeasonProvider` mount, exactly? Read `src/app/AppShell.tsx` in full
first — this is a real decision, not a formality.** `AppShell.tsx` has a chromeless
early-return branch for `/login`/`/accept-invite` (`if (isChromeless) return
<>{children}</>`) BEFORE the normal `AstryxAppShell`-wrapped branch. Mounting
`SeasonProvider` so it wraps ONLY the normal (chrome) branch — not the chromeless one —
means `/login` and `/accept-invite` (pre-auth entry points where no user session exists
yet) never attempt a season load at all, which is both correct (they don't need season
data) and avoids any question of whether an anonymous request should even be allowed to
query `seasons`. If you mount it wrapping the whole component (both branches), decide
and justify that instead — but the chrome-only placement is the recommended default
absent a reason found during your own reading of the file. Whichever you choose, `App.tsx`
already mounts `AuthProvider` outside `AppShell` (see `App.tsx`'s existing provider-order
doc comment) — `SeasonProvider` needs a real authenticated session to query `seasons`
meaningfully, so it must end up nested inside `AuthProvider`'s tree, which mounting it
inside `AppShell.tsx` naturally satisfies (do not verify this claim by guessing — read
`App.tsx` yourself to confirm the nesting order before you commit to the plan).

**6. `ReportsShell.tsx`'s `seasonId` prop stays** (do not remove it — it's still a
legitimate override seam for tests/future use, per the epic design's own "pages keep
receiving `seasonId` as a prop; only shells/route-level components consume the hook"
rule). Change only its DEFAULT: instead of defaulting to
`PLACEHOLDER_CURRENT_SEASON_ID`, the shell should call `useActiveSeason()` and, when
`status === 'ready'`, pass `season.id`; when `status === 'none'`, render an honest
"No active season yet" empty state instead of any tab content (do this ABOVE the
`TabList`, replacing the whole tab area — there's no meaningful season-scoped content to
show with zero seasons); when `status === 'loading'`, show a loading state consistent
with the rest of the app's DES-12 patterns; when `status === 'error'`, show the error
via the existing `SupabaseLoaderError.message`. The explicit `seasonId` prop, when
supplied by a caller, should still override the hook's value (existing tests likely rely
on this — check before changing the precedence).

**7. Nobody except this file's own new `loaders/seasons.ts` may import
`loadActiveSeason` directly** (the epic design's own rule — only the provider consumes
it, everything else goes through `useActiveSeason()`). Enforce this yourself; a checker
will grep for violations.

**8. Test files.** `SeasonProvider.test.tsx` (new): cover all four states including
`'none'` (zero seasons) and the two-step activate failure-midway scenario from Trap #1.
Update `SeasonSettings.test.tsx`/`ReportsShell.test.tsx` for the same "inject the
fixture explicitly through the seam" pattern T087 already established, plus new tests
for the real wiring.

## Acceptance Criteria
- `SeasonProvider`/`useActiveSeason()` exist, are mounted at your chosen (justified)
  point in `AppShell.tsx`, and correctly handle all four states including the real
  "zero seasons in production today" case.
- `SeasonSettings.tsx`'s CRUD + activate are real, using the existing T082 retry
  machinery for failures, with your Trap #1 two-step-mutation risk explicitly disclosed.
- `ReportsShell.tsx` sources its default `seasonId` from the real hook, with an honest
  empty state for zero seasons; explicit `seasonId` prop override still works.
- No other file imports `loadActiveSeason` directly.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run
  format:check` all clean, zero regressions elsewhere.

## Relevant Constitution Excerpts
> No worker may mark its own work complete; every PASS requires independent
> checker-inspected evidence.

## Most Recent Failure
None. This is attempt 1 for T091 (attempt count: 0) — first dispatch.

## Required Worker Output
- Full diff of every changed/new file.
- Your `AppShell.tsx` mount-point decision (Trap #5) and reasoning, quoting the exact
  provider-order facts you verified from `App.tsx`/`AppShell.tsx` yourself.
- Your Trap #3 (local vs. shared `SeasonRow`) decision and reasoning.
- Full test/typecheck/lint/build/format:check output, including the new
  `SeasonProvider.test.tsx` output specifically.
- Known risks (the two-step activate-failure window especially); whether a dispute is
  needed (you flag, you don't resolve).
