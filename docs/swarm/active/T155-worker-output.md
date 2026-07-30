# T155 Worker Output — wire `CoachHome` to the real active season

Worked in an isolated git worktree (`.claude/worktrees/agent-af54c8d9013f3f01d`),
branch `worktree-agent-af54c8d9013f3f01d`, dispatch base commit `f7ff055`
(merge of `#2 gamitch/claude/swarm-plan-zl575z`). All commands/measurements
below were executed by me, in this worktree, at that base — not relayed.

**Do not mark this task complete. A checker verifies it.**

## Files changed

- `src/pages/home/CoachHome.tsx` — split into outer `CoachHome`
  (season-status dispatch) + inner `CoachHomeContent` (everything the old
  single component did).
- `src/pages/home/CoachHome.test.tsx` — harness now wraps in
  `<SeasonProvider>`; 10 new `it(` blocks for criteria 1/3/4/5.
- `src/pages/home/DashboardPage.test.tsx` — harness-only change (the
  `renderAsUser` function gained an optional `loadActiveSeason` parameter and
  now wraps in `<SeasonProvider>`); **zero** individual `it(` bodies touched.
- `docs/swarm/active/T155-worker-output.md` — this file.

`src/pages/home/DashboardPage.tsx` — **untouched, byte-identical** (see
criterion 7 below). No other file in the repo was modified. No
`supabase/migrations/**` file was touched.

An untracked `node_modules` symlink (`node_modules -> ../../../node_modules`,
pointing at the parent checkout's install, whose `package-lock.json` I
diffed byte-identical to this worktree's before creating it) exists in this
worktree so `tsc`/`eslint`/`vitest`/`vite build` could run at all — no
`node_modules` existed in this worktree before I created it. It is
`.gitignore`d, was never staged, and is not part of this task's diff. Safe
to remove or replace with a real `npm ci` before further work.

## The `CoachHome`/`CoachHomeContent` split as shipped

Matches the packet's prescribed shape with no deviation:

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
    return ( /* "Sign in to view Home" EmptyState, unchanged */ );
  }

  switch (activeSeason.status) {
    case 'loading':
      return <CoachHomeLoadingSkeleton />;
    case 'none':
      return ( /* Banner status="info" title="No active season yet" ... */ );
    case 'error':
      return ( /* Banner status="error" ... endContent Retry -> activeSeason.refresh */ );
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

`user === null` is checked strictly before the `activeSeason.status` switch
(both hooks — `useAuth()`, `useActiveSeason()` — still called unconditionally
first, satisfying Rules of Hooks). `seasonId` was removed entirely from
`CoachHomeProps` (no test-only override kept — grep-reconfirmed at my own
dispatch SHA: `renderAsUser\([^)]*seasonId` matches nothing in either test
file, same as the packet's own citation).

One extraction beyond the packet's literal code sample, explicitly
prescribed by the packet itself ("required, not encouraged, as of this
revision"): the DES-12 loading skeleton is factored into a standalone
`CoachHomeLoadingSkeleton()` function, used by both the new season-loading
branch above and the pre-existing, unchanged data-loading branch inside
`CoachHomeContent`. No other deviation from the prescribed shape.

`'none'`/`'error'` render a plain `<VStack gap={4} padding={6}><Banner .../></VStack>`,
**not** `KpiStrip`'s `<Section padding={3} dividers={['bottom']}>` wrapper —
per the packet's own instruction, citing the T129 checker-fix comment already
in this file (`CoachHome.tsx`, "module doc #14" / the pre-existing T129 note)
that documents why `Section` doesn't belong on this page.

`CoachHomeContentProps.user: AuthUser` required the import change the packet
called out: `import { useAuth, type AuthUser } from '../../app/guards';`
(previously only the `useAuth` function was imported). Also added:
`import { useActiveSeason } from '../../app/SeasonProvider';`.

## Criterion 1 — the placeholder never reaches a query (genuine mutation proof)

Four new tests in `CoachHome.test.tsx` (`describe('<CoachHome /> T155 -- the
placeholder never reaches a query (criterion 1)')`):

- Zero calls to `loadData`/`loadDashboardData` while `activeSeason.status` is
  `'loading'`, `'none'`, `'error'` (three separate `it(` blocks, one per
  state, each injecting a `loadActiveSeason` that produces that exact state).
- The fourth `it(` asserts the `'ready'` case: `loadData`/`loadDashboardData`
  are each called **exactly once**, with the argument **exactly**
  `FIXTURE_ACTIVE_SEASON.id` (`'season-fixture-active'`), and explicitly
  `.not.toBe('season-placeholder-current')`.

**Revert-and-fail proof, executed in this worktree (constitution item 23):**
I copied the fixed `CoachHome.tsx` aside, replaced it with `git show
HEAD:src/pages/home/CoachHome.tsx` (the pre-T155 version — old
default-parameter `seasonId = PLACEHOLDER_SEASON_ID`, no `useActiveSeason()`
call at all), and ran `npx vitest run src/pages/home/CoachHome.test.tsx -t
"T155"`. Result: **9 of the 10 new T155 tests failed** against the reverted
code (the 10th, criterion 4's "does not throw" companion, trivially still
passed because the old component never calls `useActiveSeason()` at all —
expected, and not evidence of anything). The criterion-1 "ready" test failed
with:

```
AssertionError: expected "spy" to be called with arguments: [ 'season-fixture-active' ]
Received:
  1st spy call:
  [
-   "season-fixture-active",
+   "season-placeholder-current",
  ]
```

I then restored the fixed file (`cp` back) and re-ran the same filtered
command: all 10 T155 tests passed again. `git diff --stat` confirmed the
file returned to the exact fixed state (no stray diff) before I moved on.

## Criterion 3 — season-status literals (inspection of rendered copy)

Three new `it(` blocks (`describe('<CoachHome /> T155 -- season-status
literals (criterion 3)')`):
- `'none'`: asserts the exact title `'No active season yet'` and the exact
  description text.
- `'error'`: asserts the exact title `"Couldn't load the active season"`,
  the real injected error message (`'Season load failed.'`), then clicks the
  rendered `Retry` button and confirms `activeSeason.refresh()` genuinely
  re-ran the injected `loadActiveSeason` (call count 1 → 2) and the page
  then shows `'ready'` content — proving `Retry` is wired to
  `activeSeason.refresh`, not a dead handler.
- `'loading'`: asserts `'Loading Home'` text and the exact `role="status"`
  announcement `'Loading Home…'`.

`'ready'` is covered by the pre-existing `<CoachHome /> DES-12 states`
describe block (all three of its `it(` blocks now run through the new
season-status switch via `renderAsUser`'s default fixture-resolving
`loadActiveSeason`, unmodified).

This criterion is **inspection of the rendered copy**, per the packet's own
classification — not a mutation-revert proof (the "loading"/"none" bodies
above are exact literal checks; the "error" body includes one genuine
behavioral proof, the Retry wiring, which is itself covered by the general
mutation-testing discipline but not a separate revert experiment beyond what
criterion 1 already exercised on the same code path).

## Criterion 4 — fail-loud proof (mutation proof)

`describe('<CoachHome /> T155 -- fail-loud without a <SeasonProvider>
ancestor (criterion 4)')`, same pattern `AppShell.test.tsx`'s own T141
provider-mount guard establishes (a class-based error boundary catching the
real thrown error, rather than asserting `root.render()` itself throws):

- `it('throws the exact "useActiveSeason() must be called within a
  <SeasonProvider>." message', ...)` — renders `<CoachHome />` (no
  `<SeasonProvider>` ancestor) inside a boundary and asserts the caught
  error's `.message` is **exactly** `'useActiveSeason() must be called
  within a <SeasonProvider>.'`.
- Companion: `it('the companion case: the same probe does NOT throw when a
  <SeasonProvider loadActiveSeason={...}> ... is present', ...)` — same
  `CoachHome` tree, now wrapped in `<SeasonProvider
  loadActiveSeason={async () => FIXTURE_ACTIVE_SEASON}>`; asserts the
  boundary's error marker is absent AND that `CoachHome` rendered real
  content (`'Team participation'`), proving the probe (`CoachHome` calling
  `useActiveSeason()` at its own top level) genuinely ran and didn't throw —
  not merely that nothing crashed before it.

Both pass. This is a genuine proof, not merely descriptive: `console.error`
is suppressed only for the throwing test (not globally), matching the
existing `AppShell.test.tsx` convention.

## Criterion 5 — the measured-reality proof

`describe('<CoachHome /> T155 -- measured-reality proof for a REAL,
non-placeholder season (criterion 5)')`. Rendered as `ADMIN_USER`, with
`activeSeason` resolved to `FIXTURE_ACTIVE_SEASON` (id
`'season-fixture-active'`), the **untouched default** `loadData`
(`defaultLoadCoachHomeData` — no override passed), and `loadDashboardData`
**pinned** to `defaultLoadDashboardData` (required — `CoachHome`'s own real
default is the Supabase-backed `loadDashboardData`, which rejects in this
unconfigured jsdom environment and would hide the entire
`{dashboardData && (...)}`-gated grid where Surface 2 of the round-2 MAJOR
lives).

**Before/after DOM content, all seven asserted tiles/cards, exactly as
measured in this worktree:**

| Tile/card | Rendered value | Honest or fabricated? |
|---|---|---|
| Team participation | `—` (KPI value); `82.4%` genuinely absent from the whole page | Honest empty |
| Last meeting attendance | `—`, secondary `No completed meetings yet this season` | Honest empty |
| Events in next 7 days | `0` | Honest empty |
| Next up | `Nothing scheduled` empty state | Honest empty |
| Hours vs. team goal | `0 / 38 hrs` (value-label text inside the `ProgressBar`) | **Known-residual fabricated** (Surface 1 — `defaultGoalHours`) |
| Avg hours / active student (secondary) | `Default goal 10h` | **Known-residual fabricated** (Surface 2 — same `defaultGoalHours` root cause, the round-2 MAJOR) |
| Season setup (admin) | Present (`Season setup` heading + description + button) | **Documented permanent residual**, not falsifiable |

The `38` and `10` figures are reconfirmed at my own dispatch SHA, not
trusted from the packet:
- `sumGoalHours(FIXTURE_STUDENTS, PLACEHOLDER_CURRENT_TEAM_ID, 10)` = Amara
  (10, no override) + Cole (8, override) + Priya (10) + Jordan (10) = **38**
  (Devon excluded, inactive; Nina excluded, different team). Matches the
  packet's own cited `38` exactly.
- `FIXTURE_DEFAULT_GOAL_HOURS = 10` (unchanged constant, grep-confirmed at
  `CoachHome.tsx`).

The Season-setup assertion is present in the test **and is explicitly
labeled in the test's own inline comment as a documented permanent residual,
not a falsifiable check** — `isSeasonMissingSetup` reads only unfiltered
fixture fields (`teams`/`seasonSetupStatus`), so it is `true` for every
season this task can produce, before and after this fix, under any mutation
confined to this task's own scope. I did not attempt to construct a mutation
that would make it fail; the packet's own round-2 gate already tried three
and got `true` every time, and re-deriving that same negative result would
not add information.

**Mutation coverage for this criterion:** the same revert-and-fail run
described under criterion 1 above also failed this criterion 5 test against
the reverted code (`expected '82.4%' to be '—'` — the reverted component
never season-filters `events`/`teamParticipation`/`studentHours` at all,
since its `seasonId` never becomes a real, distinct id). Restoring the fix
made it pass again. I did not additionally construct a *second*, narrower
mutation isolating only the `loadDashboardData`-pin requirement — the
packet's own text already establishes why the pin is load-bearing (an
un-pinned `dashboardData` fetch rejects in jsdom, hiding the entire grid,
which is a structural fact about the test environment I verified by reading
`CoachHome.tsx`'s own default-parameter wiring, not by re-running the
un-pinned variant separately.) Flagged here as the one part of this
criterion I verified by inspection rather than by an additional executed
mutation.

## Signed-out fetch-count behavior change (before/after)

Measured with a temporary scratch test (`src/pages/home/T155.scratch.test.tsx`,
written, run, and deleted before committing — never part of the shipped
diff): rendered `<CoachHome loadData={spy} loadDashboardData={spy} />` with
`user === null` (no `<LoginAs>`), wrapped in a real `<SeasonProvider
loadActiveSeason={async () => FIXTURE_SEASON}>`.

- **After (this fix):** `loadData` calls = **0**, `loadDashboardData` calls
  = **0**.
- **Before (`git show HEAD:...CoachHome.tsx`, the pre-T155 single-component
  version):** `loadData` calls = **1**, `loadDashboardData` calls = **1**
  (both fire once on mount regardless of `user === null`, because
  Rules-of-Hooks forced both `useLoadState` calls to run before the old
  single component's `user === null` early return).

This matches the packet's disclosed behavior change #1 exactly.

## Milestone-toast dedupe key now includes the real season id

Also measured with a temporary scratch test (written, run, deleted, not
committed): rendered `<CoachHome>` as a logged-in coach inside
`<SeasonProvider loadActiveSeason={async () => FIXTURE_SEASON}>` (id
`'season-fixture-active'`) with `loadData` returning
`defaultLoadCoachHomeData('season-placeholder-current')` (so the underlying
roster/hours fixture data is the same as every other test in this file —
only the *resolved active season id* differs). After the 25%-milestone toast
fired, the real `localStorage` key written was:

```
volt.home.milestoneToast.season-fixture-active.team-hours-goal.25
```

— the real resolved season id (`'season-fixture-active'`), not the retired
placeholder (`'season-placeholder-current'`). Confirms the packet's
disclosed behavior change #2: this page's own milestone-toast dedupe
namespace is now genuinely per-season.

## Criterion 8 — existing tests (numbers reconfirmed at my own dispatch SHA)

- `grep -c "^\s*it("` in `CoachHome.test.tsx` at dispatch (before any of my
  edits): **90**. In `DashboardPage.test.tsx`: **5**. Combined: **95** — I
  independently reconfirmed both counts; they match the packet exactly.
- `renderAsUser(` occurs **29** times in `CoachHome.test.tsx` at dispatch
  (including the one function definition) — I reconfirmed this grep count;
  matches the packet's own re-derived (not the original miscounted) figure.
- Sufficiency: wrapping both files' `renderAsUser` in `<SeasonProvider
  loadActiveSeason={...}>` (default resolving one shared fixture,
  `FIXTURE_ACTIVE_SEASON`), with the existing `flushMicrotasks()` (3×
  `await Promise.resolve()`) left completely unchanged, **was sufficient**:
  all 95 pre-existing tests pass unmodified (verified by running the full
  suite both before and after my change — see below). **Zero** individual
  `it(` bodies were changed in either file. No test was found that
  specifically asserted behavior only reachable through the old
  placeholder-`seasonId` default — none needed adjustment.
- I added **10** new `it(` blocks to `CoachHome.test.tsx` (4 for criterion
  1, 3 for criterion 3, 2 for criterion 4, 1 for criterion 5) and **0** new
  `it(` blocks to `DashboardPage.test.tsx` (harness-only change there, per
  this task's scope restriction).

## Criterion 7 — `DashboardPage.tsx` byte-identical (hash check)

```
$ git diff --stat HEAD -- src/pages/home/DashboardPage.tsx
(empty)
$ sha256sum src/pages/home/DashboardPage.tsx
4a5da47b46e14855dec428d545e0de70b12b73a51fc42c5ec7b1db3101fe7c81  src/pages/home/DashboardPage.tsx
$ git show HEAD:src/pages/home/DashboardPage.tsx | sha256sum
4a5da47b46e14855dec428d545e0de70b12b73a51fc42c5ec7b1db3101fe7c81  -
```

Identical hashes, empty diff. This is a structural/hash check, not a
mutation proof — the file is Forbidden, so this confirms it was never
touched, nothing more.

## No migration touched

```
$ git diff --stat HEAD -- supabase/migrations/
(empty)
$ git status --short supabase/migrations/
(empty)
```

Also re-confirmed the packet's own "migrations are not implicated" claim
independently: `supabase/migrations/20260717000003_metric_views.sql` still
defines `v_team_participation`/`v_student_hours` as described, and no
migration file in this worktree post-dates that one in a way that touches
either view (I did not need to add or edit any migration — this task's fix
is entirely inside `CoachHome.tsx`'s own wiring, as prescribed).

## Criterion 6 — `teamId`/`PLACEHOLDER_CURRENT_TEAM_ID` unchanged (inspection checks, not mutation proofs)

- `export const PLACEHOLDER_CURRENT_TEAM_ID = 'team-placeholder-current-viewer';`
  — unchanged (grep-confirmed, same line content as before my edit, only its
  line number shifted due to the new module-doc section above it).
- `CoachHomeProps.teamId`'s default parameter is still `= PLACEHOLDER_CURRENT_TEAM_ID`
  (now on the outer `CoachHome`, unchanged value).
- `git diff --stat HEAD -- src/lib/supabase/loaders/dashboard.ts` is empty
  (Forbidden file, untouched) and `grep -n ".eq('team_id'\|.in('team_id'"
  src/lib/supabase/loaders/dashboard.ts` returns nothing — no team-scoped
  query filter was added anywhere. This is a structural/grep check, not a
  behavioral mutation proof, exactly as the packet classifies it (its own
  third bullet).

## Criteria 9–10 — full command output, before/after counts

All commands below were run in this worktree at my final, committed state
(after restoring from the criterion-1 mutation experiment and deleting both
scratch test files).

**`npx tsc --noEmit`** — clean, 0 errors (both before my edits, at dispatch,
and after).

**`npx vite build`** — succeeds. Output includes the pre-existing "(!) Some
chunks are larger than 500 kB" advisory (unrelated to this task, present
before my change too) and `dist/assets/DashboardPage-bl9X_A1N.js  52.52 kB`
as part of a normal successful build; exit code 0.

**`npx prettier --check "src/**/*.{ts,tsx}" "!src/theme/volt.ts" "*.{ts,js,json,html}"`**
— `All matched files use Prettier code style!`, exit code 0.

**`npx eslint .`** — before my edit (measured by stashing my three changed
files and re-running): `355 problems (0 errors, 355 warnings)`. After my
edit: `355 problems (0 errors, 355 warnings)` — **identical count**, no new
warning introduced by this change (grep-confirmed the only `CoachHome.tsx`
warnings present both before and after are the same three pre-existing
`react-refresh/only-export-components` lines on already-exported pure
functions, unrelated to this task). The packet's own cited "0 errors, 355
warnings" figure is reconfirmed exactly at my dispatch SHA.

**`npx vitest run`** — before my edit (measured the same way, by stashing):
**66 test files / 1536 tests, all passing.** (This differs from the
packet's cited baseline of "66 test files / 1507 tests at HEAD `9c863c1`" —
that citation is from an earlier commit; my dispatch SHA is `f7ff055`, which
has several more merged tasks' tests landed since then. Reporting **my**
number, as instructed, since it differs: **1536**, not 1507.) After my edit:
**66 test files / 1546 tests, all passing** — exactly **+10**, matching the
10 new `it(` blocks I added to `CoachHome.test.tsx` for criteria 1/3/4/5,
with zero regressions and zero skips.

## Follow-up task to file (constitution item 20 — text for the orchestrator, restated verbatim from the packet)

> **`CoachHome`'s primary widgets have no real Supabase implementation, and
> three on-screen surfaces (from two fabricated fields) are now confirmed to
> render known-fabricated output even after T155.** `LoadCoachHomeDataFn`
> (`loadData` prop) is only ever `defaultLoadCoachHomeData`, a fixture — no
> other implementation exists anywhere in the repo, and no ED-1 or T124-era
> task ever built one. T155 stops the placeholder from reaching Postgres
> and, as a secondary effect, stops it from coincidentally matching the
> fixture's own season key — which correctly empties four widgets (team
> participation, last-meeting attendance, events-in-7-days, next up) but
> **not** three surfaces from two fields: `defaultGoalHours` (unfiltered,
> always `10`) feeds both `Hours vs. team goal`'s denominator
> (`sumGoalHours` over unfiltered `students`/`defaultGoalHours`, measured
> `38` at this dispatch SHA, rendering `0 / 38 hrs`) *and*, separately, the
> `Avg hours / active student` tile's own "Default goal 10h" secondary
> (`CoachHome.tsx` — this second surface only becomes visible once T155
> ships, since it sits behind the `dashboardData` gate this task is what
> makes reachable) — and `seasonSetupStatus` feeds the admin "Season setup"
> card (`isSeasonMissingSetup` over unfiltered `teams`/`seasonSetupStatus`,
> permanently true). All three remain fabricated, on screen, indefinitely,
> until this follow-up lands. The real backing views for the two fields
> `defaultLoadCoachHomeData` already filters correctly —
> `TeamParticipationMetric`/`StudentHoursMetric` — already exist:
> `v_student_hours` at `supabase/migrations/20260717000003_metric_views.sql:3`
> and `v_team_participation` at the same file's `:44`, so a real loader for
> at least those two is mechanical, mirroring `loaders/dashboard.ts`'s own
> pattern — not new SQL design. The remaining fields (`teams`, `students`,
> `sessions`, `rsvps`, `attendance`, `defaultGoalHours`, `seasonSetupStatus`)
> need their own real, season-scoped queries. `teamId =
> PLACEHOLDER_CURRENT_TEAM_ID` (`CoachHome.tsx`) is blocked on the same
> follow-up for a distinct reason: it's not merely unwired, there is **no
> correct value to wire** — `AuthUser` carries no team linkage at all — so
> resolving it requires a schema/auth change, not just a loader. Scope all
> of this as one task, not sequentially, since the real loader and the team
> resolution are the same piece of work.

I did not build any part of this follow-up here — filed as text only, per
the packet's own explicit scope boundary. I have no ability to write
`task-ledger.md`; the orchestrator has said (per the packet) it will file
this row directly in the merge commit per constitution item 24.

## Attribution boundary (kept intact, per the packet's own closing note)

Everything in the packet attributed to the human owner is limited to the
original bug report/DevTools screenshots/symptoms. The outer/inner split
design, both scope deferrals (`teamId`, no real `loadData` backend), the
tier assignment, and every acceptance criterion are the orchestrator's own
judgement, not George's. I did not attribute any of my own implementation
choices to him either.

## Explicitly out of scope (not touched, per the packet)

- No real backend for `loadData`/`LoadCoachHomeDataFn` was built.
- `teamId`/`PLACEHOLDER_CURRENT_TEAM_ID` was left exactly as-is (verified
  under criterion 6 above).
- T156 (the loader swallowing the real Postgres error) was not touched.
- `AppShell.tsx`, `SeasonProvider.tsx`, `KpiStrip.tsx`, `router.tsx`,
  `guards.tsx`, `loaders/dashboard.ts` — all read-only reference, all
  confirmed by empty `git diff --stat` against each.
- No `supabase/migrations/**` file was added or edited.

## What I could not verify / explicitly flagging as unverified

- I did not re-run the round-2 gate's own three-mutation attempt on the
  Season-setup permanent-residual claim myself (see criterion 5 section
  above) — I accepted the packet's own already-executed finding rather than
  re-deriving a negative result a third time. Flagged, not silently
  reconciled.
- I did not independently re-verify the packet's `9c863c1` baseline commit's
  own test count (`1507`) against that commit directly (e.g. via `git show
  9c863c1:...`) — I only measured my own dispatch SHA's baseline (`1536`)
  directly, which is the number I'm standing behind, and reported the
  discrepancy rather than reconciling it.
- The `node_modules` symlink I created to run any of these commands at all
  is untracked, gitignored, and not part of the diff — flagged above, not
  hidden.

## Commands run (chronological summary)

```
npx tsc --noEmit
npx vitest run src/pages/home/CoachHome.test.tsx
npx vitest run src/pages/home/DashboardPage.test.tsx
npx vitest run                                   # full suite, post-change: 66 files / 1546 tests
git stash push -u -- <3 changed files>; npx vitest run; git stash pop   # pre-change baseline: 66/1536
npx eslint .                                     # post-change: 0 errors / 355 warnings
git stash push -u -- <3 changed files>; npx eslint .; git stash pop      # pre-change: 0 errors / 355 warnings
npx prettier --check "src/**/*.{ts,tsx}" "!src/theme/volt.ts" "*.{ts,js,json,html}"
npx vite build
git diff --stat HEAD -- src/pages/home/DashboardPage.tsx
sha256sum src/pages/home/DashboardPage.tsx ; git show HEAD:src/pages/home/DashboardPage.tsx | sha256sum
git diff --stat HEAD -- supabase/migrations/ ; git status --short supabase/migrations/
git diff --stat HEAD -- src/lib/supabase/loaders/dashboard.ts
grep -n ".eq('team_id'\|.in('team_id'" src/lib/supabase/loaders/dashboard.ts
# Criterion-1 mutation experiment (constitution item 23, this worktree only):
cp src/pages/home/CoachHome.tsx /tmp/CoachHome.tsx.fixed
git show HEAD:src/pages/home/CoachHome.tsx > src/pages/home/CoachHome.tsx
npx vitest run src/pages/home/CoachHome.test.tsx -t "T155"   # 9/10 new tests failed, as expected
cp /tmp/CoachHome.tsx.fixed src/pages/home/CoachHome.tsx
npx vitest run src/pages/home/CoachHome.test.tsx -t "T155"   # all 10 passed again
# Scratch measurements (written, run, deleted -- never committed):
#   signed-out fetch-count before/after (src/pages/home/T155.scratch.test.tsx)
#   milestone-toast dedupe key format (src/pages/home/T155.scratch2.test.tsx)
```
