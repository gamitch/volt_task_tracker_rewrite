Closes GAM-446

## What changed

`makeLoadCoachMeetingsData` now runs a seventh query against the
`v_event_attendance` metric view in its existing `Promise.all` batch, and
merges the result onto each `CoachMeetingRow` **keyed by `eventId`**. Five
optional fields carry it: `attendancePct`, `heldCt`, `gradedMarksCt`,
`attendedMarksCt`, `excusedCt`. `attendancePct` is a DATA-01 passthrough —
`null` stays `null` and is never coalesced to `0`.

Read-side only. No write path, no migration, no RLS change;
`saveMeetingSeries` / `cancelMeetingSession` semantics are untouched.

## What the issue got wrong

**Two of this ticket's three deliverables rested on premises that do not
hold.** The premise gate did not read them and object — it built each one in
its own worktree and measured the result. Both are cut, and both are filed.

**1. The roster count is cut → GAM-471.** Four independent grounds, any one of
which is sufficient:

- **No requirement.** MTG-01a (`VOLT_Portal_PRD.md:303-313`) enumerates the
  series card's contents and contains no roster count. Constitution item 1 puts
  PRD requirement IDs above issue text. The owner's own six rulings on this
  redesign (`auto-mode-decisions.md:4298-4341`) do not mention one either.
- **The consuming ticket was already told not to render it.** GAM-447's packet
  §3a ruled the "N on roster" supporting line off the card.
- **The data is wrong today.** `student_teams` has **no writer on `main`** —
  its writer is GAM-340 / PR #192, still open. Every student added since the
  `20260721` backfill has no membership row, and GAM-391 records a second
  broken population. The number would read "3 on roster" for a 12-student team.
- **It would break DATA-01.** The active-roster predicate
  (`s.is_active AND st.left_on is null`) already exists in SQL three times;
  re-deriving it in TypeScript is a BLOCKER under constitution item 3.

**2. `listGuardianChildren` is cut → it already exists.**
`makeLoadLinkedStudents` / `loadLinkedStudents`
(`src/lib/supabase/loaders/checkin.ts:517-547`) already returns
`{ studentId, displayName }[]` from `guardian_links` ordered `created_at`
ascending with **no `.limit()`**, display names joined client-side, green-tested
at `checkin.test.ts:237`. Building a second one is the "two competing
contracts" hazard this packet's own first revision invoked against itself.

That revision also proposed a `role !== 'parent' → []` short-circuit, and the
gate proved it would have been a **defect**: `Role` is single-valued,
`guardian_links.parent_profile_id` is an unconstrained FK to `profiles(id)`,
the invite trigger inserts links without checking role, and RLS `own_read`
scopes purely by `parent_profile_id`. A coach who is also a parent has readable
links, and the shortcut would have silently hidden their children.

**One correction to my own packet, kept rather than tidied away.** Revision 1
asserted `student_teams.left_on` as the active-membership filter and cited
`src/lib/meetings/types.ts:60-65` for it. Both were wrong — that citation is the
doc comment on `Team.archived`, and every shipped definition pairs `left_on is
null` with `s.is_active`. The gate also caught **its own** round-1 error
propagating into revision 2 (`MeetingsList.test.tsx:246` belongs to the student
loader and cannot be reached by this change); revision 3 struck it.

**Also fixed by the gate before a worker saw it:** revision 1 was
*unsatisfiable* — its seventh query turned three currently-green tests red
across two files, one of them (`MeetingsList.test.tsx`) on revision 1's own
Forbidden list. Measured: baseline 42/42 exit 0, after the patch 3 failed /
2630 passed exit 1.

## Tier, stated and defended

**HEAVY**, overriding the issue's own "STANDARD". The issue arrived
`tier/unreviewed`, so tiering it was part of claiming (item 28d).

Item 26's deciding question — *can a mistake here corrupt data, or lie to a
user about their own data?* — is yes: a wrong join against `v_event_attendance`
shows a student a false attendance percentage. Independently, item 26 lists
**"an export another session builds against"** as a HEAVY trigger, and this
loader's row model is what the parallel Wave-2 redesign tickets consume.

The losing argument is the issue's own: one loader module plus tests is
STANDARD-sized. Item 26 says explicitly that tier does not follow ticket size,
and that when two tiers are arguable you take the heavier one. FAST was never
available — the change alters a type other modules import.

**Disclosed process deviation:** after the gate cut two of three deliverables,
what remains would read STANDARD on its own. I kept HEAVY rather than
re-labelling the row, because re-tiering downward *after* a gate found real
BLOCKERs is the "relabel to match what I did" move item 26 forbids. Cost: one
checker round. The gate's own verdict on this call was to leave it.

## Verification

`gate-run`, on the clean tree at `bc1727c`:

```
GATE RUN — bc1727c on claude/gam-446-coach-card-loader-data — tree clean

  1 tsc                               exit 0  PASS
  2 vite build                        exit 0  PASS
  3 format:check                      exit 0  PASS
  4 eslint                            exit 0  PASS       0 errors, 380 warnings
  5 vitest (full)                     exit 0  PASS       108 files / 2638 tests  baseline 2633 (+5)
  6 vitest src/lib/supabase/loaders/  exit 0  PASS       15 files / 243 tests  baseline 238 (+5)

VERDICT: PASS — all six gates exit 0
```

Baselines were measured on clean `main` by the premise gate, not asserted:
2633 / 238 / 380 warnings. 380 is the baseline, not a regression — the
`gate-run` skill's own doc text says 377 and is stale by 3.

### Mutations replayed

Both in the worker's own worktree (item 23), candidate fix committed first
(item 26's working rule):

| Mutation | Result |
| -- | -- |
| `attendancePct` NULL passthrough → `?? 0` | **RED**, exit 1 — `AssertionError: expected +0 to be null` |
| merge keyed by array index instead of `eventId` | **RED**, exit 1 — `AssertionError: expected 9 to be 1` |

The premise gate independently wrote and reddened the same two criteria before
the worker was dispatched, so these guards were known-reddable in advance.

### Independently verified, not taken on the worker's word (item 21)

HEAD is `bc1727c`; the change is in the committed blob (4 files, +388/-19);
`git diff --name-only origin/main...HEAD` matches no forbidden path;
`coachModel.ts` is absent from the diffstat; `MeetingsList.test.tsx`'s only
hunk is inside `describe('loadCoachMeetingsData …')` with `:246` untouched.

## Scope (item 27)

The loader reads the **real** `v_event_attendance` view on the real path — no
fixture, no stub, no hardcoded value. Nothing user-visible is added by this PR,
so item 27's Partial test does not apply: the fields are one hop ahead of their
consumer, which is `SeriesCardModel`'s business (GAM-460 and the integration
ticket), not this ticket's.

## Follow-ups filed

Both to `Backlog` with `tier/unreviewed`, before this PR opened, written
through the `linear-task-writing` skill (item 30):

- **GAM-471** — roster count. Blocked on GAM-340; needs an owner decision on
  whether MTG-01a should carry the field at all, which is the cheap step.
- **GAM-472** — `LinkedStudentSummary` is declared in a page module and
  imported by a lib loader; move it to the frozen `src/lib/meetings/types.ts`
  address before GAM-451 consumes it. Compile-time-erased, zero bundle weight,
  so tidiness rather than a defect.

## Known gaps, disclosed

- **Nothing renders these fields yet.** `buildSeriesCardModel` does not exist
  anywhere; `CoachMeetingsView.tsx:1269` consumes `LoadCoachMeetingsDataFn`, so
  the fields are on the right rail but one hop ahead of a consumer.
- **`gradedMarksCt` is carried because the view demands it.** The view's own
  catalog comment: *"A CONSUMER THAT RENDERS attendance_pct WITHOUT ALSO
  RENDERING graded_marks_ct REINTRODUCES D014's KNOWN REGRESSION"* — since
  T508 an unmarked student normally has no attendance row, so forgetting to
  mark someone *inflates* the percentage. GAM-460 owns the render side; this PR
  makes it buildable and does not discharge it.
- **Zero-session events never become rows at all** (`coachModel.ts:321`), and
  only `type === 'meeting'` events do. Extra view rows are simply unused.
- **The run started on a stale base** (`bdfafcf`) and was rebased onto
  `3d27d8a` after PRs #230/#231 merged mid-run. On the stale base
  `src/lib/meetings/types.ts` did not exist and this issue's central premise
  looked false. It is true; the checkout was wrong.

Linear-Issue: GAM-446
