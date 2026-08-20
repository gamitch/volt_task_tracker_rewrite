Closes GAM-356

## What changed

A student whose every recorded attendance mark this season is `excused` has **no
participation rate** — `v_student_participation.participation_pct` is SQL `NULL`,
and MET-01's own column comment says *"the UI renders that as an em dash, never
0%"*. On `/meetings` it did not: the strip rendered a `ProgressBar` whose
accessible name was `Participation: null%`, announcing `aria-valuenow="0"` /
`aria-valuetext="0%"` to assistive technology. A student with no rate was being
told, out loud, that their rate was zero.

Two changes, both minimal:

- **Five row types stopped lying about the column.** `participation_pct` /
  `participationPct` widened to `number | null` in `loaders/checkin.ts:239`,
  `loaders/meetings.ts:302`, `loaders/reports.ts:221`, and — found by the premise
  gate, not previously catalogued — both `VStudentParticipationRow` and
  `VTeamParticipationRow` in `lib/supabase/types.ts`. Both of those types' doc
  blocks still asserted the column was never nullable and quoted the superseded
  pre-MET-01 SQL; both are corrected to cite `20260806000000_met01_explicit_marks.sql`.
  The type then ripples through `StudentMeetingView.tsx`, `MeetingsList.tsx` and
  `ParticipationTab.tsx`'s own metric types.
- **The render is guarded the way this repo already guards it.** A second branch
  at `StudentMeetingView.tsx:751-768` renders `— (no participation rate yet)` and
  **no `ProgressBar` at all**, reusing the shape `ParticipationTab.tsx:838-839`
  has shipped all along rather than inventing a second one.

**Nothing coalesces the null.** No `?? 0`, no `|| 0` — a coalesce would fabricate
exactly the 0% the em dash exists to avoid.

Two branches, not one merged branch, because the two no-rate causes are
different: `participation === null` means *no row at all* and keeps its existing
copy verbatim; the new branch means *a real row with real counts and no
denominator*. Merging them would tell an all-excused student that nothing was
"recorded yet this season", which is false.

`ParentHome` inherits the fix without being edited — it reuses the same
`ConsistencyStrip` — which closes the issue's own "the parent-facing
`variant=\"linked\"` strip was not exercised" caveat.

## What the issue got wrong

The issue was accurate on its own subject and its citations all held. Two
corrections, both from the premise gate:

1. **The issue's candidate scope was incomplete.** It named three loader row
   types; there are **five**, and the two in `lib/supabase/types.ts` carried
   false doc comments as well.
2. **A claim this packet made, and the gate destroyed by running it.** Revision 1
   asserted GAM-300's `Math.max(expectedCt - excusedCt, 1)` floor was *"never
   reached on this path."* False. The gate ran `aggregateParticipationForStudent`
   against two same-season all-excused rows and got `participation_pct: 0`. That
   is a **dual-team** student, and the claim is true only for the single-team
   case. See Known gaps.

The issue's own "PACKET CORRECTION" — that this strip is served by
`loaders/checkin.ts`, not `loaders/meetings.ts` — was **confirmed** at all three
call sites. Revision 1 of this packet said the GAM-345 packet was wrong about
that; **that accusation is withdrawn** — GAM-345's shipped packet says the same
thing, and only its own revision 1 was wrong.

## Tier, stated and defended (item 26)

**STANDARD.** Judged before the issue entered `In Progress`, per item 28d.

- **Not HEAVY.** None of the four triggers fires: no write path or destructive
  operation, no RLS/auth/role logic, no migration, no metric-view SQL — the
  MET-01 migration already emits the correct `NULL` and is untouched. Item 25
  forbids upgrading because a topic sounds sensitive.
- **Not FAST**, on one specific criterion: widening an exported row type *is* a
  change to a signature other modules import.
- **The gate challenged the tier** and asked whether *"an export another session
  builds against"* fires. It does not: that trigger is about a contract leaving
  this commit's verification boundary. This ripple never leaves the commit —
  `tsc` names every consumer atomically, and the gate proved the set closed at
  four errors, then zero.

**Process deviation, declared rather than hidden:** STANDARD does not require a
premise gate round, but item 19 binds every packet, so one ran — and it was worth
it twice over. Round 1 returned REVISE with 3 MAJOR and falsified this packet's
central claim by executing it. Round 2 returned DISPATCH.

## Verification

```
GATE RUN — 3a2262e on claude/gam-356-participation-null-percent — tree clean

  1 tsc                                                    exit 0  PASS
  2 vite build                                             exit 0  PASS
  3 format:check                                           exit 0  PASS
  4 eslint                                                 exit 0  PASS       0 errors, 379 warnings
  5 vitest (full)                                          exit 0  PASS       98 files / 2507 tests  baseline 2505 (+2)
  6 vitest src/pages/meetings/StudentMeetingView.test.tsx  exit 0  PASS       1 files / 44 tests  baseline 42 (+2)

VERDICT: PASS — all six gates exit 0
```

Run by the orchestrator with `--require-clean`, so the numbers describe commit
`3a2262e` and not a dirty tree. They independently match the worker's own
reported figures.

### Mutation replay

Run by the orchestrator, in an isolated worktree (item 23), against the
**committed** fix (item 26's commit-before-mutating rule).

| Mutation | Expected | Measured |
| -- | -- | -- |
| Disable **only** the new `participationPct === null` guard, leaving the widened types in place — so this measures the guard, not the compiler | A1/A2 red | **RED, exit 1** — `AssertionError: expected <div role="progressbar" …> to have a length of +0 but got 1` |
| Same mutation, A3 (the genuine-zero test) | stays green | **GREEN** — proves A3 measures a different property and is not a duplicate of A1 |
| Restore | green | **GREEN** |

**The mutation reproduces the reported symptom byte-for-byte.** Probing the
mutated render gave accessible name `Participation: null%`, `aria-valuenow="0"`,
`aria-valuetext="0%"` — identical to what GAM-356 reported from a real browser.
The new test guards the actual defect, not a proxy for it.

The suite carries an **anti-overcorrection** test as well as the fix's own: a
genuine `participationPct: 0` must still render exactly one `ProgressBar` reading
`0%`. If a no-rate must never show as 0%, a real 0% must never show as a no-rate.

## Scope (item 27)

**Passed, not Partial.** The surface reads from the real loader on the real path a
user takes: `MeetingsList.tsx` renders `StudentMeetingView` with no
`loadStripData`, so the component default — `loadConsistencyStripDataFromSupabase`
from `loaders/checkin.ts` — is what runs. The diff does not touch that default.
No fixture, stub, or hardcoded value is on this path.

## Follow-ups

**GAM-300** (already open in `Backlog`, carrying `unreviewed`) owns the residual
below; no new row was filed because that row's title is literally *"Two loaders
still apply the `greatest(x, 1)` floor T509 removed, and three row types still
declare `participation_pct` non-nullable"*. A comment was added to it carrying the
gate's measured evidence, the SQL expression to copy, and the test that blocks it.
Its **type half is now closed** by this PR (the real count was five, not three);
only the floor half remains, and it is worth retitling on triage.

## Known gaps, disclosed

1. **A dual-team all-excused student still sees a fabricated `Participation: 0%`.**
   They reach `checkin.ts:375`'s `Math.max(expectedCt - excusedCt, 1)` floor
   instead of the verbatim single-row return, so the null never arrives to be
   guarded. **This PR does not make that worse — the change is compile-time only,
   and that student renders byte-identically before and after.** It is not fixed
   here on the issue's own stated grounds: GAM-356 says folding this into the
   arithmetic defect *"would bury a type-level defect inside an arithmetic one"*.
   Fixing it also requires inverting `checkin.test.ts:88-96`, a currently-green
   test that pins the floor — a reversal of passed work needing explicit
   authorization (Definition of Ready #5). Tracked on GAM-300.
2. **The e2e leg-3 edit ships unrun.** `tsconfig.json` includes only
   `["src", "vite.config.ts"]`, vitest excludes `tests/e2e-personas/**`, and no
   gate runs Playwright — so that edit is neither typechecked nor executed by the
   six gates above. **The two unit tests are the real regression guard**; the e2e
   flip is bookkeeping on top of them. Its locator was corrected by the gate,
   which measured that `/meetings` renders the label and value as two sibling
   `<Text>` nodes, so the single string `Participation: —` never appears there.
3. **`format:check`'s glob does not cover `tests/e2e-personas/**`.** That file has
   pre-existing prettier drift, confirmed by stash/pop to predate this change.

Linear-Issue: GAM-356
