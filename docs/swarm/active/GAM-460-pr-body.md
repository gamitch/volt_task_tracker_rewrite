Closes GAM-460

## What changed

`SeriesCardModel` (frozen by GAM-444) gains a required `gradedMarksCt: number`
field, and `SeriesCard.tsx` renders it unconditionally beside `attendancePct`,
in the same block, with no responsive/viewport condition able to separate the
two. This closes D014's inverted failure mode at the card grain: since T508 an
unmarked student has no attendance row, so forgetting to mark someone
**inflates** `attendance_pct` rather than deflating it — measured 100% for an
event 60% of the roster skipped (GAM-442). `graded_marks_ct` is the migration's
own stated mitigation
(`supabase/migrations/20260821000000_meetings_event_attendance_view.sql`,
column comment on `graded_marks_ct`), and a consumer rendering the percentage
without it reintroduces the regression by the view's own words.

The data needed no new query: `loaders/meetings.ts` already carries
`gradedMarksCt` onto `CoachMeetingRow` (GAM-446). The only gap was the frozen
per-card render type and the component's own render output.

## What the issue got wrong

Nothing factual — the issue's measured example (`held_ct 20 / graded_marks_ct
40 / attendance_pct 100.0`) was re-verified against the cited migration
comment and used verbatim as this PR's own regression test. One scoping
correction: the issue frames this as work "best satisfied inside" GAM-447/
GAM-446, closed by their acceptance criteria rather than standalone. Both are
`Done` without this fix, so the constraint was never folded in — this row was
live, standalone work, not stale, and this PR is that standalone work.

## Coordination note (not a defect, disclosed for the record)

GAM-452 ("Assemble the redesigned meetings page") is `In Progress` (PR #242)
concurrently with this run. Its own packet independently found this identical
gap, could not fix it (its own Allowed Files forbid `types.ts` and
`SeriesCard.tsx`), and disclosed shipping the real `attendancePct` passthrough
with a comment naming D014/GAM-460 at that line — "if the owner promotes
GAM-460, that ticket removes the risk." This PR is that promotion. GAM-452's
own file set does not overlap this PR's, so there is no merge conflict; once
this merges, GAM-452's `coachModel.ts` model builder (not yet written as of
this PR) will need to populate `gradedMarksCt` on any `SeriesCardModel` it
constructs, from the `CoachMeetingRow.gradedMarksCt` GAM-446 already wires.
Flagging on GAM-452 directly as well.

## Tier, stated and defended (item 26)

**STANDARD.** No write path, no schema/migration/RLS/auth change. The
trigger that rules out FAST is explicit: this widens `SeriesCardModel`, an
interface other modules import, which FAST's own criteria (item 26) require
to hold *not* changed. One worker, no separate checker; the orchestrator
independently read the full diff, replayed a mutation, and ran all six gates
against the committed SHA.

## Verification

Mutation: with the new render line (`SeriesCard.tsx`, the
`${model.gradedMarksCt} marks graded` `Text` node) deleted, exactly the 3
new/extended assertions in `SeriesCard.test.tsx` went red and all 27
pre-existing tests stayed green; restored, 30/30 green again — the diff after
restore is identical to the committed state.

Baselines measured independently in a throwaway `git worktree` at `main`
(`2c8af85b`), not taken from the worker's self-report: full suite **2779**
tests, scoped `SeriesCard.test.tsx` **28** tests (the worker's own report of
"27" for the scoped baseline was off by one — noted, harmless).

```
GATE RUN — 8a20b80a on claude/gam-460-graded-marks-ct-seriescard — tree clean

  1 tsc                                                  exit 0  PASS
  2 vite build                                           exit 0  PASS
  3 format:check                                         exit 0  PASS
  4 eslint                                               exit 0  PASS       0 errors, 382 warnings
  5 vitest (full)                                        exit 0  PASS       114 files / 2781 tests  baseline 2779 (+2)
  6 vitest src/pages/meetings/coach/SeriesCard.test.tsx  exit 0  PASS       1 files / 30 tests  baseline 28 (+2)

VERDICT: PASS — all six gates exit 0
```

382 eslint warnings is within the repo's own documented standing ~377 of the
same `react-refresh/only-export-components` class (`gate-run` skill); not
independently re-counted per-class here.

## Scope (item 27)

`SeriesCard` still has no real caller anywhere in `src/` as of this PR — it is
not mounted on any route (that is GAM-452's job, in progress). This PR ships
correct rendering logic for real data the moment a real caller exists; it does
not itself put the fix in front of a coach. Recording this rather than
claiming the surface is reachable today: **the fix is Passed for what this
ticket owns** (the component correctly renders both values from any
`SeriesCardModel`, proven by tests using the issue's own measured numbers),
or is not user-visible in the sense item 27 gates. There is no fixture/stub in
the render path being papered over — the component takes its full input from
props, unconditionally.

## Follow-ups filed

None filed as a new Linear row. The remaining wiring is GAM-452's own,
already `In Progress` and already tracking this exact gap in its own packet
(§9a); a duplicate filing would fragment, not clarify, the same obligation.

## Known gaps, disclosed

- No real `SeriesCardModel` builder exists in `src/` yet, so this fix cannot
  be observed on a running page until GAM-452 (or its successor) merges and
  populates `gradedMarksCt`.
- The worker's self-report undercounted the scoped test baseline by one (27
  vs. the independently measured 28); does not affect the gate verdict, since
  both counts pass the "no reduction" bar the gate enforces (30 > either).

Linear-Issue: GAM-460
