Closes GAM-455

## What changed

`src/pages/home/CoachHome.tsx`'s coach dashboard printed raw float hours
(`3.999998805h`) at two sites: the **Hours by team** row (`TeamHoursRowItem`,
`entry.confirmedHours`) and **Top events by student hours** row
(`TopEventRowItem`, `entry.totalHours`). Both interpolated the loader's raw
value straight into a template string with no rounding step — the third time
this same defect shape has shipped (after GAM-303 for students/parents and
GAM-308 for CoachHome's own goal-projection row).

Fixed by importing the already-exported `roundForDisplay` helper from
`../outreach/Leaderboard` (established by GAM-303, already used at
`Leaderboard.tsx:527`) and applying it at both printed-label call sites.
`CoachHome.tsx` already imports other symbols from `../outreach/Leaderboard`
(`Leaderboard`, `LoadLeaderboardDataFn`, `LoadPrivacySettingFn`), so this
follows existing precedent rather than introducing a new cross-module
dependency. The sibling `ProgressBar`'s `value` prop at both sites is
deliberately left unrounded — the issue explicitly warns that pinning the
bar's raw value "would be guarding the wrong thing," since the bar's geometry
wants full precision and only the printed label needs rounding.

## What the issue got wrong

Nothing measured — re-verified both line numbers (`CoachHome.tsx:2076`,
`:2108` pre-fix) and both helper claims (`Leaderboard.tsx:314`
`roundForDisplay`, `CoachHome.tsx:1080` local `round1`) against `main` @
`e1c49b8`; all held exactly as described.

## Tier: FAST (item 26)

Two-line production change in one file, no write path, no schema/RLS/auth
logic, no signature change another module imports, well under the ~20-line
ceiling, and a named mutation exists (revert either `roundForDisplay(...)`
call, guarding test goes red). No packet, no worker, no separate checker —
implemented directly per item 26's FAST tier. Two tests added and one
mutation-replayed per site; no argument for a heavier tier surfaced.

## Verification

Mutation-replay (both new tests, one per site): committed the fix at `e15d393`,
reverted both `roundForDisplay(...)` calls back to raw interpolation, reran the
scoped suite — both new GAM-455 tests failed exactly as expected (raw
`3.999998805h` reappeared). Restored the fix, reran — 103/103 green.

Six-gate block (commit `1810837`, tree clean; baseline derived from merge-base
`14708be` via a throwaway worktree — full suite 2598 tests, `src/pages/home/`
scope 228 tests):

```
GATE RUN — 1810837 on claude/gam-455-round-coach-dashboard-hours — tree clean

  1 tsc                     exit 0  PASS
  2 vite build              exit 0  PASS
  3 format:check            exit 0  PASS
  4 eslint                  exit 0  PASS       0 errors, 380 warnings
  5 vitest (full)           exit 0  PASS       102 files / 2600 tests  baseline 2598 (+2)
  6 vitest src/pages/home/  exit 0  PASS       4 files / 230 tests  baseline 228 (+2)

VERDICT: PASS — all six gates exit 0
```

`e2e-personas` as coach (issue's own required verification, matching this
issue's `e2e-personas` label): **in progress at PR-open time — this section
will be updated before the draft is cleared.**

## Scope (item 27)

No user-visible surface reads from a fixture/stub here — both sites already
read the real dashboard loader (`loadDashboardData`); this change only alters
how an already-real number is displayed. Not Partial.

## Follow-ups filed

None. This is the sweep GAM-455 itself asked for (Leaderboard and
goal-projection sites were already fixed by GAM-303/GAM-308); no other raw-float
site is known to remain.

## Known gaps, disclosed

None known. The e2e-personas run is the remaining verification step and will
be recorded here before this PR leaves draft.

Linear-Issue: GAM-455
