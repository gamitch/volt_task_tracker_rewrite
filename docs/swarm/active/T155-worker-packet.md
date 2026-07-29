# Worker Packet: T155 — wire `CoachHome` to the real active season

**Priority: live, user-visible production failure.** The owner supplied
DevTools screenshots; root cause is confirmed from the actual 400 response
body, not inferred.

## The bug, confirmed from the response body

```json
{"code": "22P02", "message": "invalid input syntax for type uuid: \"season-placeholder-current\""}
```

`CoachHome.tsx:1997` declares `seasonId = PLACEHOLDER_SEASON_ID` (`:654` =
`'season-placeholder-current'`). `DashboardPage.tsx:120` renders
`<CoachHome />` with **no props**, so that placeholder string reaches
`.eq('season_id', …)` on eight real Supabase queries in
`src/lib/supabase/loaders/dashboard.ts` — `queryRosterStats`,
`queryAttendanceRate`, `querySessionDays`, `queryUpcomingCommittedHours`,
`queryDayOfWeekSessions`, `queryTeamHours`, `queryTopEvents`,
`queryGoalProjection` (each `.eq('season_id', seasonId)`, verified by
re-reading the file) — plus a ninth, `queryFeedEvents`
(`.from('events').eq('season_id', seasonId)`). Postgres rejects all nine with
`22P02`, since none of them is a valid UUID. This is what
`loadDashboardDataProp` (`CoachHome.tsx:1996`, defaulting to the real
`loadDashboardData` from that same loader file) fires on every mount.

**Migrations are not implicated — re-confirmed, not just repeated.** The
failures are 400, not 404; the views exist. Two sibling views,
`v_season_kpis`/`v_season_kpi_team_counts` (consumed by `KpiStrip`, a
different component — see below), return 200 for the same request because
they receive a real season id.

## Root cause of the asymmetry — why the KPI strip works and the page below it doesn't

`KpiStrip.tsx:133` imports `useActiveSeason` from `../../app/SeasonProvider`
and switches on its `status` (`KpiStrip.tsx:160-188`) before ever mounting the
child that fires a query. `CoachHome` has no equivalent: it takes `seasonId`
as an optional prop defaulting to the placeholder and fires
`loadData(seasonId)`/`loadDashboardDataProp(seasonId)` unconditionally, every
render, regardless of whether a real season has resolved.

`useActiveSeason()` (`SeasonProvider.tsx:117-121`) returns a discriminated
union — `{status:'loading'}` | `{status:'ready';season:SeasonRow}` |
`{status:'none'}` | `{status:'error';error:SupabaseLoaderError}` — plus
`refresh()`. `SeasonRow.id` (`src/lib/supabase/types.ts:129`) is the real
UUID. `AppShell.tsx` mounts `<SeasonProvider>` around its entire non-chromeless
branch (`:159-168`, T091/T140), and `DashboardPage`'s route ("/") is only ever
reached inside that branch — confirmed by reading `AppShell.tsx` directly, not
assumed — so `CoachHome` is always rendered inside a live `SeasonProvider` in
production. **Nothing needs to change in `AppShell.tsx`, `SeasonProvider.tsx`,
or `DashboardPage.tsx` to make `useActiveSeason()` available to `CoachHome`.**

## Read before you design anything: T140 and T141

T140 gave `AppShell`/`KpiStrip` this exact wiring and its round-1 premise gate
returned MAJOR on precisely the trap this task now walks into: **"the test
approach does not transfer."** `KpiStrip`'s season-consuming child
(`KpiStripContent`) only mounts in the `case 'ready':` branch
(`KpiStrip.tsx:184-187`); a test that renders `KpiStrip` without also
resolving `activeSeason` to `'ready'` sits on the season-level error/none
state and the seam under test never fires. T141 then found that T140's own
regression *guard* was vacuous: wrapping a chromeless route in
`<SeasonProvider>` (the literal forbidden regression) left **all 23 existing
tests green**, because `SeasonProvider` is DOM-transparent
(`SeasonProvider.tsx:208`, `<SeasonContext.Provider>{children}</...>`, nothing
else) and nothing on that branch calls `useActiveSeason()`. The only thing
that can detect "wrapped vs. not" is a probe that calls the hook itself and
observes whether it throws.

Both lessons apply directly here, in the opposite direction from T140/T141's
own task (which added a provider; this task adds a *consumer*):

1. **Any test proving `loadData`/`loadDashboardData` receive a real season id
   must first resolve `useActiveSeason()` to `'ready'`** (inject
   `loadActiveSeason` into a wrapping `<SeasonProvider>`), the same way
   `KpiStrip.test.tsx:91-105` and `AppShell.test.tsx:298-312` already do.
   Asserting against the loading/none/error states doesn't reach the code path
   this bug lives in.
2. **`CoachHome` rendered without a `<SeasonProvider>` ancestor must now
   throw** the fail-loud `useActiveSeason() must be called within a
   <SeasonProvider>.` message (`SeasonProvider.tsx:216-218`). That is new,
   correct, and required — it is the only observable proof `CoachHome`
   genuinely consumes the shared context rather than merely importing it. Test
   for it the same way T141 did: assert the exact message, plus a companion
   case proving the same probe does *not* throw when a provider is present, so
   the first assertion can't pass because the probe itself is broken.

## Design — outer season-status wrapper, same shape as `KpiStrip`

Split `CoachHome` into an outer wrapper (season-status dispatch only) and an
inner content component (everything that exists today). This mirrors
`KpiStrip`/`KpiStripContent` exactly and is the smallest change that makes
"season not resolved yet" a real, representable state — which does not exist
today. Today, `loadData`/`loadDashboardData` fire on **every** render,
including while `user` is still resolving; nothing gates them on season
readiness because there is no season concept in this component at all.

**Split point:** `CoachHome.tsx:2001` (`const { user } = useAuth();`) stays in
the outer wrapper, immediately followed by `const activeSeason =
useActiveSeason();`. Everything from `:2002` (`const navigate =
useNavigate();`) through the function's closing brace (currently the rest of
the ~600-line body) becomes a new inner component — suggested name
`CoachHomeContent` — taking `user` (non-null `AuthUser`), `seasonId` (now
**required**, not optional-with-placeholder-default), `teamId`, `loadData`,
`loadDashboardData`, and `nowFn` as props. No logic inside that body changes;
only where `user` and `seasonId` come from changes (props instead of
`useAuth()`/a defaulted parameter).

Outer `CoachHome`:

```tsx
export function CoachHome({
  loadData = defaultLoadCoachHomeData,
  loadDashboardData: loadDashboardDataProp = loadDashboardData,
  teamId = PLACEHOLDER_CURRENT_TEAM_ID,
  nowFn = () => new Date(),
}: CoachHomeProps = {}): ReactNode {
  const { user } = useAuth();
  const activeSeason = useActiveSeason();

  if (user === null) {
    return ( /* existing "Sign in to view Home" EmptyState, unchanged */ );
  }

  switch (activeSeason.status) {
    case 'loading':
      return ( /* loading skeleton — see below */ );
    case 'none':
      return ( /* Banner, mirrors KpiStrip.tsx:163-172 copy pattern */ );
    case 'error':
      return ( /* Banner + Retry, mirrors KpiStrip.tsx:173-183 exactly */ );
    case 'ready':
      return (
        <CoachHomeContent
          user={user}
          seasonId={activeSeason.season.id}
          teamId={teamId}
          loadData={loadData}
          loadDashboardData={loadDashboardDataProp}
          nowFn={nowFn}
        />
      );
  }
}
```

**Remove `seasonId` from `CoachHomeProps` entirely** — do not keep it as a
test-only override. No test in `CoachHome.test.tsx` or `DashboardPage.test.tsx`
currently passes `seasonId` as a render prop (grep-verified:
`renderAsUser\([^)]*seasonId` matches nothing in either file); every test that
needs a specific season id can supply it via an injected `loadActiveSeason`
resolving a fixture `SeasonRow` with that `.id`, exactly like
`AppShell.test.tsx:89-97`'s `T140_FIXTURE_SEASON`. Keeping a dead prop that
production never sets is the shape of the bug this task exists to close —
don't reintroduce it as an escape hatch.

**`teamId` (`:653` = `PLACEHOLDER_CURRENT_TEAM_ID`) is explicitly out of
scope for this task.** It has the identical shape (an optional prop, a
plausible-looking placeholder default, never passed by any call site), but it
never reaches a real query: `loaders/dashboard.ts`'s own module doc #4 states
every function there is season-scoped only, never team-scoped, and grep
confirms zero `teamId`/`team_id` references in that file. `teamId` only
filters the **fixture** rows `loadData` returns (see next section) — it causes
no 400, no wrong data reaching Postgres, nothing network-visible. Do not touch
it. It is filed as a follow-up below rather than folded in or left in a
comment (constitution item 20).

### Loading / none / error copy

Reuse `KpiStrip.tsx:160-188`'s exact three-state shape and adapt only the
copy (KpiStrip already established this project's convention for what a
season-level `'none'`/`'error'` state looks like — don't re-derive it):
- `'none'`: `Banner status="info" title="No active season yet"` with
  description text adapted from KpiStrip's ("An admin needs to create and
  activate a season in Season settings before Home can show data here.").
- `'error'`: `Banner status="error" title="Couldn't load the active season"
  description={activeSeason.error.message}
  endContent={<Button variant="ghost" label="Retry"
  onClick={activeSeason.refresh} />}` — verbatim shape of
  `KpiStrip.tsx:173-183`.
- `'loading'`: reuse or closely mirror the existing DES-12 loading skeleton at
  `CoachHome.tsx:2063-2091` (aria-busy, `VisuallyHidden role="status"`,
  `Skeleton` tiles) rather than inventing a second shape — extracting it into
  a small shared function so both the season-loading and the (unchanged, still
  present inside `CoachHomeContent`) data-loading skeleton use one
  implementation is encouraged but not required.

`Banner` and `Button` are already imported in this file (`:507-508`); no new
Astryx imports needed for this part.

## The second finding in the owner's report — corrected, not just relayed

The boss's diagnosis characterizes this as "when the analytics load fails, the
tiles render fixture values." **That's not quite the mechanism, and the real
one is more significant.** Re-derived from the file, not assumed:

`loadData` (the **primary** widget seam — KPI grid, Next up, last-meeting
attendance, check-in eligibility, season-setup card) has **no real Supabase
implementation anywhere in this codebase.** Grepped repo-wide for
`LoadCoachHomeDataFn`: the only value ever assigned to it is
`defaultLoadCoachHomeData` (`CoachHome.tsx:1410`), which filters hardcoded
`FIXTURE_*` arrays by `row.seasonId === seasonId`. No file imports a real
loader for this seam; `DashboardPage.tsx` passes no `loadData` prop; nothing
in the ED-1 fixture-replacement epic (T086–T112) or T124's later "dashboard
analytics parity" wave touched it — T124 built `loadDashboardData` (the
*secondary* T124 tiles, genuinely real, genuinely 400ing today) and left this
seam alone.

Today, `loadData(PLACEHOLDER_SEASON_ID)` **succeeds** (not fails) — it returns
`FIXTURE_TEAM_PARTICIPATION`'s `82.4%` (`:888`) etc. because the placeholder
argument happens to equal the fixture rows' own hardcoded `seasonId` key
(`:888, :896-898, :1439…`). It is a coincidental match, not a fallback. Once
this task wires a real UUID through, that match breaks — `defaultLoadCoachHomeData`
will filter every `FIXTURE_*` array against a season id it can never equal,
so `teamParticipation`/`studentHours`/etc. come back `null`/`[]` and the
primary tiles show their genuine empty/DES-12 states instead of fabricated
numbers. **That closes the symptom the owner saw as a direct, provable
consequence of fixing `seasonId` — it does not require building anything
new**, because `loadData` stays exactly what it is today (an injectable seam
defaulting to fixture data); only the value flowing into it changes.

**What this task does *not* fix, and must not attempt to:** the primary
widgets still show no *real* Supabase data after this ships — they show an
honest empty state instead of a fabricated one. Building a real
`LoadCoachHomeDataFn` (roster, sessions, rsvps, attendance, team
participation, student hours, all season-scoped, mirroring
`loaders/dashboard.ts`'s own pattern) is a data-wiring task on the order of
T124 itself, not a hotfix. **File it as a follow-up** (ledger text below) —
do not comment it, per constitution item 20 and its own stated rationale (three
production bugs this project has already shipped from exactly that omission).

## Explicitly out of scope

- Building a real backend for `loadData`/`LoadCoachHomeDataFn` (see above —
  filed, not built here).
- `teamId`/`PLACEHOLDER_CURRENT_TEAM_ID` (see above — filed, not built here).
- T156 (the loader swallowing the real Postgres error) — separate, already
  filed, depends on this task landing first per its own ledger row.
- Any change to `AppShell.tsx`, `SeasonProvider.tsx`, `KpiStrip.tsx`,
  `router.tsx`, `guards.tsx`, or `loaders/dashboard.ts` — all already correct;
  this bug is entirely in `CoachHome.tsx`'s own wiring.
- Any change to `supabase/migrations/**` — re-confirm the "migrations are not
  implicated" claim yourself (grep the season-scoped views exist, confirm no
  pending migration touches them) rather than trusting this packet's
  restatement of it, but do not add or edit one.

## Allowed Files

- `src/pages/home/CoachHome.tsx`
- `src/pages/home/CoachHome.test.tsx`
- `src/pages/home/DashboardPage.test.tsx` (render harness only — see
  criterion 8; `DashboardPage.tsx` itself is Forbidden, see below)
- `docs/swarm/active/T155-worker-output.md` (create)

## Forbidden Files

- `src/pages/home/DashboardPage.tsx` — must stay a **zero-line diff**. T075's
  own design ("this dispatcher's ONLY job is role-based component selection…
  does not plumb any props through") holds after this task; `DashboardPage`
  renders `<CoachHome />` with no props today and must still do so when this
  ships, because the fix lives entirely inside `CoachHome`'s own default
  resolution of season/team, not in what its caller passes.
- `src/app/AppShell.tsx`, `src/app/SeasonProvider.tsx`,
  `src/components/kpi/KpiStrip.tsx`, `src/components/kpi/KpiStrip.test.tsx`,
  `src/app/AppShell.test.tsx` — all already correct; read for pattern only.
- `src/app/router.tsx`, `src/app/guards.tsx`.
- `src/lib/supabase/loaders/dashboard.ts` — already correctly wired to real
  Supabase; the 400 is a caller-side wiring bug, not a loader bug.
- `src/pages/home/StudentHome.tsx`, `src/pages/home/ParentHome.tsx`, and their
  test files — unaffected by this task; do not touch.
- `supabase/migrations/**`.
- `docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`,
  `dispute-log.md`, `auto-mode-decisions.md`, `state-summary.md`, any other
  `docs/swarm/**` file, `.claude/**`.

## Acceptance Criteria — every one needs a proof that can fail

Four rounds were lost this week to acceptance criteria that could not fail
(T147). Every criterion below must be checkable by reverting the relevant
piece and watching the corresponding test fail — state the mutation you ran,
not just the passing assertion.

1. **The placeholder never reaches a query.** With an injected spy
   `loadData`/`loadDashboardData`, prove call count is **zero** while
   `activeSeason.status` is `'loading'`, `'none'`, or `'error'`, and prove the
   argument passed in the `'ready'` case is **exactly** `activeSeason.season.id`
   (a distinctive fixture UUID-shaped string, not `'season-placeholder-current'`
   and not anything hardcoded in `CoachHome.tsx`). Revert the fix (restore the
   old default-parameter shape) and confirm this specific test fails — do not
   just assert it should.
2. **`CoachHomeProps` no longer declares `seasonId`.** `PLACEHOLDER_SEASON_ID`
   the module constant is untouched (still backs the `FIXTURE_*` fixture data
   `defaultLoadCoachHomeData` reads) — only the prop and its use as a default
   parameter are removed.
3. All four `activeSeason.status` states render distinct, correct content:
   loading (skeleton, no query fired), none (info Banner), error (error Banner
   + working Retry calling `activeSeason.refresh`), ready (delegates to
   `CoachHomeContent`, which behaves exactly as `CoachHome` does today for
   every existing DES-12 state of its **own** `loadState`/`dashboardState`).
4. **Fail-loud proof.** `CoachHome` rendered without a `<SeasonProvider>`
   ancestor throws `useActiveSeason() must be called within a
   <SeasonProvider>.` — assert the exact message, plus the T141-pattern
   companion case proving the same page does **not** throw when a
   `<SeasonProvider loadActiveSeason={...}>` wrapping the fixture-resolving
   loader is present.
5. **The fixture-coincidence proof.** With `useActiveSeason()` resolved to a
   fixture season whose id is **not** `PLACEHOLDER_SEASON_ID` (e.g.
   `'season-fixture-real'`) and the **default** `loadData`
   (`defaultLoadCoachHomeData`, untouched — do not inject a custom one for
   this test), assert the rendered primary tiles show their genuine
   empty/DES-12 state — **not** `82.4%`, not any other value from
   `FIXTURE_TEAM_PARTICIPATION`/`FIXTURE_STUDENT_HOURS`. This is the proof
   that closes the owner's second symptom without building a new backend.
6. `teamId`/`PLACEHOLDER_CURRENT_TEAM_ID` byte-unchanged in behavior and
   default value.
7. `DashboardPage.tsx` byte-identical (hash before/after).
8. **Existing tests survive with harness-only changes.** `CoachHome.test.tsx`
   (126 `it`/`describe` occurrences today) and `DashboardPage.test.tsx` (5
   `it` blocks) must all still pass. The only permitted change is to each
   file's shared `renderAsUser` function: wrap the rendered tree in
   `<SeasonProvider loadActiveSeason={...}>` resolving a fixture `SeasonRow`
   (matching `AppShell.test.tsx:89-97`'s `T140_FIXTURE_SEASON` shape) so
   `activeSeason.status` reaches `'ready'` by default. No individual `it(`
   body may change **except** any test that specifically asserted behavior
   only reachable through the old placeholder-seasonId default (audit for
   this; if one exists, name it explicitly in your output doc rather than
   silently adjusting it). Note `fixtureLoadData()`/`fixtureLoadDashboardData()`
   (`CoachHome.test.tsx:1018-1076`) already ignore whatever `seasonId`
   argument they're called with, so most tests should be unaffected by the
   value change itself — the only real risk is the missing provider ancestor
   and any extra microtask hop the season resolution adds before
   `CoachHomeContent` mounts. **Verify by running the suite, not by
   asserting**; if `flushMicrotasks()`'s existing `await Promise.resolve()` x3
   is insufficient once a second async layer (season resolution) precedes the
   existing one (data loading), say so and fix it — don't leave flaky tests.
9. `npx tsc --noEmit`, `npx vite build`, `npm run format:check`,
   `npx eslint .` all clean (0 errors; baseline **355** warnings — re-confirm
   at your own dispatch SHA rather than trusting this figure).
10. `npx vitest run` green. Baseline **66 test files / 1507 tests** at HEAD
    `9c863c1` — re-confirm at your own dispatch SHA. State your expected end
    count (pure addition of new `it(` blocks for criteria 1/4/5) and whether
    you hit it.

**Do not certify your own work.**

## Follow-up to file (constitution item 20 — do not leave this in a comment)

Record in your output doc, for the orchestrator to add as a ledger row (you
cannot write `task-ledger.md` yourself):

> **`CoachHome`'s primary widgets have no real Supabase implementation.**
> `LoadCoachHomeDataFn` (`loadData` prop) is only ever
> `defaultLoadCoachHomeData`, a fixture — grep-confirmed, no other
> implementation exists anywhere in the repo, and no ED-1 or T124-era task
> ever built one. T155 stops it from coincidentally matching a placeholder
> season id, which converts the symptom from "fabricated numbers" to "honest
> empty state," but the KPI grid, Next up, last-meeting attendance, check-in
> eligibility, and season-setup card show no live data at all until a real
> loader (mirroring `loaders/dashboard.ts`'s own season-scoped pattern) is
> built for this seam. `teamId = PLACEHOLDER_CURRENT_TEAM_ID`
> (`CoachHome.tsx:653`) has the identical never-passed-placeholder shape and
> is currently harmless only because everything it scopes is already fixture
> data — it becomes a real defect the moment this follow-up wires a real
> loader, so scope the two together rather than sequentially.

## Relevant Constitution Excerpts

- **Non-Negotiable #2** (`constitution.md:11`) — existing tests pass unless
  explicitly approved. This task should need no approval: criterion 8 keeps
  every existing assertion, changing only two shared render-harness functions.
  If you find an existing test that cannot survive unmodified, stop and report
  rather than silently weakening it.
- **Item 12** (DES-12, all four async states) — this task adds a *new* async
  boundary (season resolution) on top of an existing one; all four states must
  exist at both layers, not just the layer that already had them.
- **Item 18** (tiering) — this task does not touch auth, session,
  role-resolution, permission logic, RLS, migrations, or metric SQL; it wires
  an existing, already-checked context (`useActiveSeason()`, built and PASSed
  under T091/T140) into a new consumer. **Sonnet tier**, matching T140/T141's
  own tier assignment for the identical class of change.
- **Item 20** — the `teamId`/no-real-`loadData`-backend findings above are
  filed, not commented.
- **Item 23** — any mutation experiment (reverting the fix to confirm a test
  fails, then restoring) runs in your own worktree.

## Required Worker Output

Create `docs/swarm/active/T155-worker-output.md` covering:

- The exact `CoachHome`/`CoachHomeContent` split as shipped, and any deviation
  from the suggested shape above, with reasoning.
- Criterion 1's mutation proof: the spy call-count/argument evidence, and the
  revert-and-fail result.
- Criterion 4's fail-loud proof (exact thrown message) and its companion.
- Criterion 5's fixture-coincidence proof: before/after DOM content for the
  primary tiles.
- Whether `flushMicrotasks()` needed adjustment in either test file, and why.
- Confirmation `DashboardPage.tsx` is byte-identical (hash).
- Confirmation no migration was touched.
- The follow-up-task text above, restated for the orchestrator to file.
- Full command output for criteria 9–10, with before/after counts.
- Anything unverified, stated plainly as unverified.

Do not mark this task complete. A checker verifies it.
