Closes GAM-439

Adds an **admin-only inline editor for the active season's default goal hours**
to the coach dashboard, writing through a **new column-scoped loader** that
touches only `seasons.default_goal_hours`.

## The bug this had to avoid, and how it avoids it

`updateSeason` is a full-row write —
`.update({ name, starts_on, ends_on, default_goal_hours })`
(`src/lib/supabase/loaders/seasons.ts`) — and `UpdateSeasonPayload` requires all
four fields. `SeasonProvider` caches the season once per mount and only
re-fetches on `refresh()`, so `activeSeason.season.name` on the dashboard is
arbitrarily stale. Reusing `updateSeason` from a dashboard control would have
saved a number and **silently reverted the season's name and dates** to whatever
that tab happened to load. No error, no conflict, last write wins — on the row
every hours-vs-goal figure in the app divides by.

The packet considered read-then-write and rejected it: re-reading immediately
before writing **narrows** the race, it does not close it. This ships
`updateSeasonGoal`, which writes one column, so the three columns the dashboard
has no business editing are outside the write entirely and a concurrent rename
in Season settings is a non-conflicting write to a disjoint column. That is the
existing discipline on this table, not a new one — `makeTogglePrivacy`
(`loaders/leaderboard_privacy.ts`) does the same, and `makeUpdateSeason`'s own
doc comment already records the principle ("deliberately never touches
`is_active`").

`updateSeason` is **not** modified. `SeasonSettings` edits all four fields from a
form showing all four; its full-row write is correct there.

## What changed

| File | Change |
| -- | -- |
| `src/lib/supabase/loaders/seasons.ts` | `+35` — `UpdateSeasonGoalPayload`, `OnUpdateSeasonGoalFn`, `makeUpdateSeasonGoal`, `updateSeasonGoal`. No new imports. |
| `src/lib/supabase/loaders/seasons.test.ts` | `+77`, new file — the key-set assertion, plus resolve and reject cases. |
| `src/pages/home/CoachHome.tsx` | `+270/-14` — the `SeasonGoalEditor` control, its injectable seam, the D5 retention, `key={season.id}`, module-doc entry #18 (renumbered from #17 when `main` was merged in — GAM-456 landed its own entry 17 first). |
| `src/pages/home/CoachHome.test.tsx` | `+232` — role gating, all four write states, the post-save re-fetch, and the real-default seam. |

No dependency was added; `package.json` is unchanged. No migration: the column
`default_goal_hours numeric not null default 100` already exists.

### Four decisions the packet made rather than drifted into

1. **Column-scoped write, not full-row and not read-then-write** (above).
2. **Types live in the loader module.** `CoachHome.tsx` does not import from
   `SeasonSettings.tsx`; the page-to-page import is avoided by not creating one.
   The existing `UpdateSeasonPayload` is deliberately **not** relocated — that
   is a refactor of a passed, unrelated surface, and it would be its own row.
3. **Admin-only, and the gate is UI-only.** `/settings/season` is admin-gated,
   but `/` carries `RequireAuth` with no `RequireRole`, and RLS would let a coach
   write this column (`staff_all` / `is_staff()`). The control renders only for
   `user.role === 'admin'`, following the `AdminToggles` precedent — which also
   records *why* `RequireRole` is wrong for an embedded widget: it would eject a
   coach from the whole dashboard. **This is consistency with Settings, not a
   security control** (item 25), and it is stated as such rather than implied.
4. **A save re-fetches the season, and the dashboard no longer unmounts to do
   it.** See below — this is the part the premise gate rewrote.

### D5: the reason `refresh()` did not work as first specified

The premise gate did not merely read the plan; it probed it, and the probe
falsified the packet. `activeSeason.refresh()` re-enters `status: 'loading'`
synchronously, which returns `<CoachHomeLoadingSkeleton />` and **unmounts
`CoachHomeContent` entirely** — measured `hasDashboard=false, hasSkeleton=true`
immediately after `refresh()`, with `loadData` and `loadDashboardData` each
called twice per save. The packet's "success" state was *impossible as written*:
the component that would render the confirmation is destroyed in the same tick.

The fix is stale-while-revalidate retention inside `CoachHome`'s own wrapper —
keep rendering the last `'ready'` season while a refresh is in flight, so the
whole app still gets the new value and `SeasonProvider`'s **eight** other
consumers are untouched. First mount is unchanged. Round 2 then built it and
measured the success state rendering (`hasSuccess=true, hasSkeleton=false`) with
the double-fetch gone.

Round 2 also found a real defect the retention introduced: because
`CoachHomeContent` no longer unmounts, `useMilestoneToasts` state survives a
genuine season *switch*, and toast ids carry no `seasonId`, so React logged
`Encountered two children with the same key, 'team-hours-goal-25'`. Fixed by
`key={season.id}` — retention spans a refresh, not a change.

**Disclosed, not discovered later:** a *failed* post-save refresh now replaces a
working dashboard with the season-error banner. The save has already committed
and Retry recovers, but it is a new transition and it is on the record here.

## Tier, stated and defended

**HEAVY** (item 26). Trigger: **write path**. The losing argument was STANDARD on
size — "one input, one existing loader." Item 26 says tier follows risk, not the
size of the control, and this is the T305 shape: a small-looking write whose
payload corrupts a column nobody was editing. The tier paid for itself. The
premise gate's probe is what proved the specified success state could not render
and what produced D5 and the key collision; reading the render code could not
have found either.

Process actually run: packet → `checker-premise` round 1 (**REVISE** — 2 MAJOR,
6 MINOR, 2 NIT) → revision → round 2 (**DISPATCH** — 3 MINOR, 3 NIT, at the
item-19a two-round cap) → `worker-implementer` → `checker-reviewer`.

**Worker model tier: sonnet, no `model: "opus"` override, deliberately.** Item
18's four triggers are a migration file, an RLS policy or `security definer`,
metric-view SQL, and auth/session/role-resolution logic. This hits none:
migrations are forbidden by the packet, no policy is touched, there is no metric
SQL, and the admin gate is a render condition on a prop the component already
receives — not a change to how roles are resolved. Item 26's write-path trigger
sets the *process* tier, which this got in full; item 25 expressly retires
bumping a worker because a topic sounds sensitive.

## Verification

All of the following was produced by `checker-reviewer`, which ran the commands
itself rather than quoting the worker. Verdict: **PASS**, no BLOCKER, no MAJOR,
no MINOR — four NITs, logged below.

### Six gates

```
GATE RUN - 7318ae0 on claude/gam-439-inline-season-goal-editor - tree clean

  1 tsc                     exit 0  PASS
  2 vite build              exit 0  PASS
  3 format:check            exit 0  PASS
  4 eslint                  exit 0  PASS       0 errors, 380 warnings
  5 vitest (full)           exit 0  PASS       103 files / 2609 tests
  6 vitest src/pages/home/  exit 0  PASS       4 files / 236 tests

VERDICT: PASS - all six gates exit 0
```

**Re-run after merging `main` in.** The block above describes `7318ae0`, which is
no longer the head — `main` moved 21 commits while this branch was stalled and
had to be merged in (see *Run record*). Gates were therefore re-run on the merge
commit rather than left quoting a commit they no longer describe:

```
GATE RUN - bf4d01b on claude/gam-439-inline-season-goal-editor - tree clean

  1 tsc                     exit 0  PASS
  2 vite build              exit 0  PASS
  3 format:check            exit 0  PASS
  4 eslint                  exit 0  PASS       0 errors, 380 warnings
  5 vitest (full)           exit 0  PASS       104 files / 2623 tests
  6 vitest src/pages/home/  exit 0  PASS       4 files / 240 tests

VERDICT: PASS - all six gates exit 0
```

Baseline re-measured independently on `origin/main` @ `e66c79f`, in its own
worktree: **103 files / 2612 tests**. The merge is **+1 file / +11 tests** —
exactly this branch's own contribution (8 `CoachHome`, 3 `seasons`) — so it is a
clean union that dropped nothing from either parent. eslint warnings unchanged
at 380.

Baseline measured independently at the parent commit `c6561ea`:
**102 files / 2598 tests, exit 0**, and eslint **380 warnings**. So the suite
went 2598 → 2609 (+11: 8 CoachHome, 3 seasons) with **no test dropped**, and
**zero new eslint warnings**. A green suite that lost tests is not green, so
that comparison is the point of running the baseline.

### Mutation-replay — four mutants, each in the checker's own worktree (item 23)

A passing test nobody has watched fail is not evidence. Each was committed
first, mutated, reverted, and the tree re-verified.

```
[A2: .update({ ..., name: 'x' })]           3 passed  -> exit 1, 1 failed   REDDENED
  AssertionError: expected "spy" to be called with arguments: [ { default_goal_hours: 120 } ]
[D5: delete the retained-loading branch]  109 passed  -> exit 1, 1 failed   REDDENED
  expected '...' to contain 'Season goal saved'
[A4: widen user.role === 'admin']         109 passed  -> exit 1, 1 failed   REDDENED
  expected '...' not to contain 'Default season goal'
[A1: stub the default seam]               109 passed  -> exit 1, 1 failed   REDDENED
  expected '...' to contain "Couldn't save the season goal"
```

The first is the mutant the packet named. The other three were the checker's
own: they prove the retention, the admin gate and the real-loader default are
each actually guarded, not merely covered.

### `e2e-personas` — the read-back the issue asked for

Real Chromium against real PostgreSQL carrying this repo's migrations and RLS.
The checker wrote its own spec rather than replaying the worker's.

```
✓ A3: admin saves a new goal; only default_goal_hours changes (3.6s)
✓ A3b: keyboard-only path saves (Enter in the input commits)   (2.4s)
✓ A4: a coach sees no season-goal editor on the dashboard      (2.6s)
3 passed (9.4s)

✓ 768px: editor row does not overflow  (horizontal overflow px: 0)
```

A3 read `id, name, starts_on, ends_on, default_goal_hours` **before** the save,
saved through the real UI, polled the row to the new value, then asserted
`name`, `starts_on` and `ends_on` **byte-identical**. That is the assertion the
issue insisted on: *"a test that only asserts `default_goal_hours` would pass
while the bug ships."* The row was restored afterwards.

Item 27 was checked as a connection, not a render: the seam's default resolves
to the real `makeUpdateSeasonGoal()` over `getSupabaseClient`, and the live save
moved the KPI denominator 520h → 548h, so `refresh()` reached every
`useActiveSeason()` consumer.

### Accessibility (item 15), checked rather than assumed

`NumberInput` renders a real `<label htmlFor>` with `aria-required`;
Playwright's `getByLabel('Default season goal')` resolves it. The keyboard-only
path writes the database (A3b). The error Banner is `role="alert"` and the
success Banner `role="status"`, so both outcomes are announced.

### NITs, logged and not filed

1. The success Banner persists while the admin edits the value again, so
   "Season goal saved" can sit beside an unsaved number.
2. Save uses the default `secondary` variant while it is the row's primary
   action.
3. The input is seeded at mount only, so an externally-changed
   `defaultGoalHours` would not resync it — unreachable today, since this
   control is the only thing that triggers the refresh.
4. Focus lands on `<body>` while the button is disabled in flight; the
   `role="alert"`/`role="status"` banners still announce the outcome.

None is a deferred *defect*, so item 20 does not require a follow-up row for
them; they belong on a future dashboard-polish row if the owner wants them.

## Run record

**Merge, not rebase.** `main` had moved from `e1c49b84` to `e66c79f` while this
branch was stalled, leaving the PR `mergeable_state: dirty`. `origin/main` was
merged into the branch; it was deliberately **not** rebased, because this branch
carries two runs' history and a rebase would invalidate any existing checkout of
it. One conflict, in `CoachHome.tsx`, and it was **numbering, not code**:
GAM-456 merged meanwhile and had added its own module-doc entry numbered `17`.
Resolved by leaving GAM-456 at `17` (it landed first) and renumbering this run's
entry to `18`, with its 13 in-body back-references updated and GAM-456's own six
`#17(b)` references untouched. `CoachHome.test.tsx` auto-merged. Confirmed after
the merge that all three overlapping changes survived: this run's
`SeasonGoalEditor` / `updateSeasonGoal` / D5 retention / `key={season.id}`,
GAM-456's `COACH_HOME_TITLE_STYLE` and `COACH_HOME_EYEBROW_STYLE`, and GAM-455's
`roundForDisplay` at both float sites.


This branch carries two runs. The first opened this PR, wrote the packet and
closed the premise gate at **DISPATCH**, then died at the moment it dispatched
its worker — the failure AGENTS.md wall 2 describes, leaving a run log whose
last line was a dispatch with no verdict, exactly as that file was worded to do.
The second run recovered the branch, verified the first run's worker had
produced **nothing** (`git diff main...HEAD -- src/` empty, no orphan worktree),
and resumed at the worker rather than re-opening a gate already closed at its
two-round cap. `docs/swarm/active/GAM-439-run-log.md` is the contemporaneous
record of both.

Linear-Issue: GAM-439
