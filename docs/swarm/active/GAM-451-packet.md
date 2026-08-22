# GAM-451 worker packet — student/parent meetings hero

## 0. Dispatch status

**OWNER RESOLUTION AFTER THE TWO-ROUND PREMISE CAP:** premise round 2 returned
`REVISE / MAJOR` only because the exact existing tests affected by the already
authorized loader and two-child persona changes were not named in §4. George's
2026-08-21 authorization explicitly covered the loader's unit tests and the
two-child e2e seed/persona coverage. That authorization therefore includes
`src/pages/meetings/MeetingsList.test.tsx`,
`tests/e2e-personas/personas.spec.ts`, and
`tests/e2e-personas/student-parent.spec.ts`. The corrections below resolve the
premise review; constitution item 19's two-round cap forbids a third premise
round. Dispatch is authorized from this corrected packet.

This is a HEAVY task under constitution item 26 because it changes exported
contracts and a user-visible surface that reports a student's own attendance
and participation data.

Measured base: `41c81a5` (`origin/main`, fetched 2026-08-21). The issue is
claimed in Linear by Codex on branch `claude/gam-451-student-meetings-hero`.

### Round 1 verdict and owner authorization

Premise round 1 returned **REVISE / BLOCKER**. It confirmed that location and
last-five attendance entries cannot reach the frozen student components, then
found a deeper correctness defect: the parent loader's event/session reads are
the union of every linked child's visible teams, so selecting one child does not
currently guarantee that child's hero/history.

George explicitly authorized the required GAM-451 scope expansion in Codex on
2026-08-21. This packet now incorporates all eight required revisions from
round 1. That authorization permits the shared type/model/loader/formatter and
e2e changes listed in §4, and specifically permits widening
`AttendanceCardProps` to accept the already-loaded history. It does not permit
changes to the legacy `StudentMeetingView.tsx`, its external consumers,
migrations, RLS, coach files, or unrelated loaders.

## 1. Authority and required contracts

In precedence order:

1. `docs/swarm/VOLT_Portal_PRD.md:292-399`, especially MTG-01c and MTG-01h.
2. `docs/swarm/constitution.md`, especially items 1-3, 6, 12, 14-17,
   19, 23, 26-28.
3. `.claude/skills/meetings-design/SKILL.md` in full.
4. Linear GAM-451.
5. This packet.

Required verification skills: `gate-run`, `mutation-replay`, `e2e-personas`,
and `layout-measurement`.

## 2. Measured current state

- `src/pages/meetings/student/{HeroCard,UpcomingList,AttendanceCard,PastList,ChildSwitcher}.tsx`
  are inert GAM-444 stubs. GAM-444 froze their props as contracts for the
  parallel redesign (`docs/swarm/active/GAM-444-pr-body.md:35-48`).
- `src/pages/meetings/student/StudentMeetingsView.tsx` is the live student and
  parent composition. It currently renders Upcoming and Past lists and mounts
  the legacy `StudentMeetingView variant="own"` consistency strip.
- The real route remains connected: `MeetingsList.tsx` supplies
  `loadStudentMeetingsData`, `resolveCurrentStudentId`, and
  `resolveStudentIsActive` as production defaults.
- The legacy `src/pages/meetings/StudentMeetingView.tsx` is not isolated.
  `ConsistencyStrip` and its types are imported by `ParentHome.tsx` and
  `src/lib/supabase/loaders/checkin.ts`; leave this file unchanged.
- GAM-446 deliberately cut its proposed `listGuardianChildren`. The real,
  already-tested equivalent is `loadLinkedStudents` in
  `src/lib/supabase/loaders/checkin.ts:517-547`; GAM-472 records only the
  pre-existing type-placement cleanup and states that it blocks nothing.
- `StudentMeetingHistoryRow` in `src/lib/meetings/types.ts:143-153` exposes
  title, date, start/end, status and the student's attendance mark, but no
  location. `buildStudentMeetingsData` likewise drops the fixture event's
  location. Therefore the PRD/issue requirement to render location in the hero
  and upcoming rows is not satisfiable from the frozen props currently passed
  to student components.
- `AttendanceCardProps` exposes only `participation`; the required last-five
  attendance entries are not in that frozen prop. The existing real
  `loadConsistencyStripData` can derive them from `participation.studentId`
  when a metric row exists, but outer `participation === null` carries no
  student id. A hidden loader inside a presentational card would also make its
  four states and fixture injection implicit.

## 3. Intended user-visible result

For students and parents, render one read-only view:

1. Hero for the earliest scheduled meeting: "Your next meeting", weekday/date,
   series title, time plus duration, location, date square, and a static
   Chicago-calendar relative label (`Today`, `Tomorrow`, `in N days`). When no
   scheduled meeting exists, render the authored empty variant.
2. "Coming up after that" with at most the next three remaining scheduled
   meetings, preserving ascending time order.
3. One attendance summary containing the most recent five completed attendance
   marks as DES-05 `StatusDot`s, a visible legend, and exactly one participation
   bar. Participation is metric-view passthrough; outer null or percentage null
   renders `—`.
4. A collapsed "Show past meetings (N)" control with read-only past rows and
   DES-05 badges. No mark renders neutral "Not yet held" copy.
5. Parent only: one selected linked child at a time. More than one child renders
   the child switcher; one child does not. Student viewers never see it.
6. Loading, error, empty and populated states. Inactive-account copy and history
   visibility remain honest. No write affordance is rendered or reachable.

## 4. Allowed and forbidden files

Owner-authorized expanded scope:

- `src/pages/meetings/student/**` (components, CSS if needed, and tests)
- `src/lib/meetings/types.ts`
- `src/lib/meetings/studentModel.ts`
- `src/lib/meetings/studentModel.test.ts`
- `src/lib/meetings/format.ts`
- `src/lib/meetings/format.test.ts`
- `src/lib/supabase/loaders/meetings.ts`
- `src/lib/supabase/loaders/meetings.test.ts`
- `src/pages/meetings/MeetingsList.test.tsx` for existing fake-client fallout
  from the selected-student membership query
- `tests/e2e-harness/seed.sql`
- `tests/e2e-personas/personas.spec.ts` and
  `tests/e2e-personas/student-parent.spec.ts` for the two-child parent contract,
  plus GAM-451 student/parent flow evidence under `tests/e2e-personas/**`
- `docs/swarm/active/GAM-451-*` (primary orchestrator only)

Forbidden:

- `src/pages/meetings/coach/**`
- `src/pages/meetings/StudentMeetingView.tsx` and its tests
- every loader except `src/lib/supabase/loaders/meetings.ts`
- `src/pages/home/ParentHome.tsx`
- `.claude/**`, workflow files, and project governance records other than this
  orchestrator-owned packet/run evidence
- migrations, RLS, auth/role logic, and unrelated frozen contracts

## 5. Proposed implementation if the contract gap is resolved

1. Extend `StudentMeetingHistoryRow` with required `locationName: string`.
   Preserve the already-fetched event location through `buildStudentMeetingsData`;
   add no query for this field.
2. Widen `AttendanceCardProps` with
   `history: readonly StudentMeetingHistoryRow[]`. Derive the most recent five
   completed rows carrying a real attendance mark from that already-loaded,
   selected-student history. Do not mount or edit the legacy page-level
   `StudentMeetingView`, run a second consistency loader, or compute a metric.
3. Add shared formatter exports in `src/lib/meetings/format.ts` for the date
   square and static Chicago-relative-day label. The relative helper accepts a
   captured render-time `Date`, returns `null` for past dates, returns `Today`,
   `Tomorrow`, or `in N days` through six days, and falls back to
   `formatWeekdayDate` after that. Components do not declare their own `Intl`
   formatters.
4. Implement the five student components using documented Astryx props only.
   Use Astryx `Collapsible` for history disclosure and a real radiogroup
   primitive for the parent switcher; no custom keyboard recreation.
5. Make `makeLoadStudentMeetingsData` load the selected student's active team
   memberships and filter the already-loaded meeting events before passing them
   to `buildStudentMeetingsData`: an all-team event (`team_ids === null`) remains
   visible; a scoped event remains only when at least one `team_id` belongs to
   the selected student. Sessions then inherit the filtered event-id set. Do
   not rely on parent RLS visibility as selected-child presentation scope.
6. Parent composition uses the existing real `loadLinkedStudents` result and
   local selected-child state. Normalize each display name to first name plus
   last initial before `ChildSwitcher`; do not modify the loader or GAM-472.
   Keep both child-list and student-data seams injectable.
7. Keep `StudentMeetingView.tsx` and every external importer/test unchanged.
   Stop mounting its page-level wrapper from the redesigned composition.
8. Preserve production loader defaults and injectable test seams. Do not ship a
   fixture-backed real route. Use CSS only after Astryx composition and theme
   tokens are insufficient.
9. Extend the persona seed with a second child on a different team and distinct
   next meeting. Add student/parent browser assertions proving switching changes
   hero/history and never leaks the other child's team meeting. Assert no
   accessible `Schedule meetings`, `Edit`, `Cancel session`, or attendance-write
   control for either role.
10. Give the two guardian links deterministic, distinct `created_at` values.
    Update `personas.spec.ts:59-64` and
    `student-parent.spec.ts:117-151` to expect exactly two linked children while
    retaining the unlinked-student negative checks. Do not select a participation
    bar or child by positional index; scope assertions to the named child and
    visible selected-child panel.

## 6. Acceptance criteria

1. Earliest scheduled meeting across all selected-student series is the hero;
   **up to three** remaining scheduled meetings are listed after it;
   past/canceled rows never become the hero.
2. Hero and upcoming rows display weekday date, Chicago time, computed duration,
   and real location. Relative labels are static Chicago-calendar facts and do
   not render for past rows.
3. Attendance summary shows at most the five most recent completed marks with
   Present=`success`, Late=`warning`, Excused=`neutral`, Absent=`error`; a legend
   labels all four; exactly one participation bar exists.
4. `participation === null` and `participation.participationPct === null` both
   render `—`; no percentage is computed in TypeScript.
5. Past list begins collapsed, announces its count, expands by keyboard, and
   renders neutral pending copy for a row without a mark.
6. Student persona sees only their own next meeting and no child switcher.
   Parent persona has two seeded children on different teams, sees all
   linked-child choices, one child's data at a time, and switching changes the
   hero/history without displaying the other child's scoped meeting. Neither
   role can reach `Schedule meetings`, `Edit`, `Cancel session`, or an
   attendance-write control.
7. Loading, error, empty and populated states remain measurable. Retry re-runs
   the failed real seam.
8. At a 375px viewport the hero and its required content are present,
   `document.documentElement.scrollWidth <= clientWidth`, and no required
   control is removed to obtain that result.
9. Targeted tests turn red under named mutations: choose a later scheduled row
   as hero; change Chicago current-date bucketing to UTC; coerce null
   participation to zero; remove the selected-student team filter; show two
   children simultaneously; insert an `Edit meeting` button into the student
   composition; render a second participation bar; remove the latest-five
   attendance cap; make the failed real loader's Retry button a no-op.
10. All six repository gates pass with no test-count regression. Measured base
    at `41c81a5`: student scope 25/25. Full collection is 2,666 tests; three
    pre-existing child-process failures in
    `scripts/linear-declaration-check.test.mjs` were isolated before source
    work and are not GAM-451 evidence. A final verdict must run in a clean
    dedicated worktree so the owner's pre-existing untracked files do not
    affect format/provenance gates.

## 7. Required premise round-2 decision

Verify that every round-1 required revision is now explicit and feasible:

- `locationName` is preserved from the existing events query; no fabricated
  field or extra query.
- attendance entries come from selected-student history through the now-authorized
  prop, with exactly one participation bar and no second loader.
- student-team filtering is defined strongly enough to prevent a two-child
  parent from seeing child B's meeting while child A is selected.
- shared date-square and relative-day helpers are centralized and testable.
- the two-child persona seed/spec and 375px measurement are within scope.
- legacy `StudentMeetingView.tsx` and its external consumers remain untouched.

## 8. Least confident decisions

1. **Filtering event `team_ids` against the selected student's active team ids
   is the correct parent isolation seam.** This is wrong if membership is
   represented elsewhere, all-team semantics differ, or the query cannot be
   expressed without changing RLS/auth.
2. **Passing full selected-student history to `AttendanceCard` is the smallest
   honest contract expansion.** This is wrong if it duplicates a frozen
   selection rule that can be imported without touching the legacy page module,
   or if canceled/no-mark rows make the proposed derivation ambiguous.
3. **A six-day cutoff before falling back to weekday-date is faithful to the
   approved relative examples.** This is wrong if the owner ruling fixes a
   different horizon; the PRD names examples but no explicit cutoff.
4. **The existing `loadLinkedStudents` runtime dependency is acceptable while
   GAM-472 remains backlog.** This is wrong if using it from the redesigned
   composition worsens the measured runtime cycle or prevents chunking.
5. **The expanded e2e seed can add a second child without destabilizing other
   persona tests.** This is wrong if existing tests assume the parent has exactly
   one linked child or select the first relationship implicitly.
