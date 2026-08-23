# GAM-460 — worker packet (STANDARD)

**Issue:** GAM-460 — The `SeriesCard` must render `graded_marks_ct` beside
`attendance_pct`, or D014's inverted failure mode ships.
**Branch:** `claude/gam-460-graded-marks-ct-seriescard`
**Tier:** STANDARD (constitution item 26). User-visible display fix, no write
path, no schema/migration/RLS/auth change. Single small surface: one type
field + one component's render output. Orchestrator replays the mutation and
gates directly; no separate checker round.

## §0. Premise, measured against `main` before dispatch

- `SeriesCard.tsx` (GAM-447, Done) renders `model.attendancePct` (as `—` or
  `N%`) plus a caption `"across N held"` built from `model.sessionsCompleted`
  — **never** `graded_marks_ct`. Read in full at dispatch time; lines cited
  below are current.
- `SeriesCardModel` (`src/lib/meetings/types.ts:302-339`) is the frozen
  render-input type (GAM-444). It has exactly **nine** fields today and
  **no** `gradedMarksCt`.
- The data already exists two layers up and needs no new query:
  `CoachMeetingRow.gradedMarksCt` (`types.ts:139-149`) is already wired by
  GAM-446's loader (`src/lib/supabase/loaders/meetings.ts:1009`,
  `select(...)` at `:537`) from `v_event_attendance.graded_marks_ct`
  (`supabase/migrations/20260821000000_meetings_event_attendance_view.sql`),
  a real SQL `count(a.id)` — **never NULL**, unlike `attendancePct`.
  `CoachMeetingRow.gradedMarksCt`'s own JSDoc (`types.ts:139-147`) already
  states in the loader's own words: *"Mandatory whenever `attendancePct` is
  rendered, not optional value-wise ... A CONSUMER THAT RENDERS
  attendance_pct WITHOUT ALSO RENDERING graded_marks_ct REINTRODUCES D014's
  KNOWN REGRESSION."*
- **Nothing in `src/` builds a `SeriesCardModel` from real data yet**
  (`MeetingsRail.tsx`'s own module doc item 4 says so explicitly, and
  `SeriesCard` has no route-mounted caller). GAM-452 (In Progress, PR #242,
  still packet-only as of this dispatch) is building that first real builder
  in `src/lib/meetings/coachModel.ts`; its own packet **explicitly forbids
  it from touching `types.ts` or `SeriesCard.tsx`** and its dispatch
  addendum §9a already plans to pass `attendancePct` as a true passthrough
  while leaving a comment naming D014/GAM-460 at that exact line, because it
  cannot render the mitigation from a frozen type without this field. That
  makes this ticket's file set (`types.ts`, `SeriesCard.tsx`,
  `SeriesCard.test.tsx`) **disjoint from GAM-452's Allowed Files** — no
  collision — and this ticket unblocks GAM-452's own disclosed risk rather
  than fighting it.
- Widening a NOT-YET-CONSUMED type is additive, not a breaking reshape of a
  type "a sibling ticket is coding against right now" (the
  `meetings-design` skill's freeze rule) — the one sibling actually building
  against it (GAM-452) is explicitly barred from `types.ts` and is treating
  this exact gap as GAM-460's job to close.

## §1. Task

**1. `src/lib/meetings/types.ts`** — add a new **required** field to
`SeriesCardModel` (`:302-339`), directly after `attendancePct`:

```ts
/**
 * `v_event_attendance.graded_marks_ct` — D014's mitigation, mandatory
 * whenever `attendancePct` is rendered. Since T508 an unmarked student has
 * no attendance row, so forgetting to mark someone INFLATES `attendancePct`
 * rather than deflating it (measured 100% for an event 60% of the roster
 * skipped). The view's own catalog comment states in capitals that a
 * consumer rendering `attendance_pct` without also rendering
 * `graded_marks_ct` reintroduces D014's known regression
 * (`20260821000000_meetings_event_attendance_view.sql`, column comment on
 * `graded_marks_ct`). A real SQL `count(...)`, never NULL — unlike
 * `attendancePct`, this field has no "no data yet" state to represent.
 * GAM-460.
 */
gradedMarksCt: number;
```

Required, not optional — every real call site must supply it; there are
none yet in `src/` (§0), so this cannot break an existing caller.

**2. `src/pages/meetings/coach/SeriesCard.tsx`** — render it beside
`attendancePct`, unconditionally, in the same block, with **no** responsive
or viewport-conditional rendering (this file has none today — do not add
any). Locate the existing Attendance block (search
`<Text type="label">Attendance</Text>`) and add one new line directly after
the existing `across ${model.sessionsCompleted} held` caption, inside the
same `<VStack gap={0.5}>`:

```tsx
<Text type="supporting">{`${model.gradedMarksCt} marks graded`}</Text>
```

Sentence case, no jargon (DES-14/UXC-10). Do not touch the existing
`attendanceText`/`formatAttendanceText` logic — this is additive, not a
rework of the percentage rendering.

Then, in the same file's module doc:
- Item 7(a) currently reads *"`SeriesCardModel` has exactly the nine fields
  at `types.ts:268-306` and none of those"* — update the count (now ten) and
  note that `gradedMarksCt` is the one exception, citing GAM-460, so a future
  reader does not trust the stale "nine" count.
- Add one new short numbered item (matching this file's existing convention,
  e.g. after item 1) recording: GAM-460 widened `SeriesCardModel` to add
  `gradedMarksCt`, why that widen is safe right now (§0's "no real caller
  yet" finding), and that GAM-452's model builder (`coachModel.ts`, once
  merged) is expected to populate it from `CoachMeetingRow.gradedMarksCt`.

**3. `src/pages/meetings/coach/SeriesCard.test.tsx`** — test changes
authorized:
- `baseModel()` (`:63-76`) must supply `gradedMarksCt` (TS will require it
  once the field is required) — use a value that is not equal to
  `sessionsCompleted`/`sessionsTotal`/`attendancePct`, so no assertion can
  pass by number coincidence (e.g. `26`).
- Extend the existing "splits into three nodes" test (`:207-213`) to also
  assert the new fourth node's text (`attendanceBlockTexts()` already
  returns all of the Attendance block's children — just destructure/assert
  the fourth element too, e.g. `26 marks graded`).
- Add one new test in the `attendancePct rendering` describe block asserting
  `gradedMarksCt` renders **even when `attendancePct` is `null`** — the
  mitigation is unconditional, not gated on a non-null percentage.
- Add one regression test using this ticket's own measured numbers (issue
  body): `sessionsCompleted: 20`, `attendancePct: 100`, `gradedMarksCt: 40` —
  assert both `100%` and `40 marks graded` render together, naming D014/
  GAM-460 in the test description.

## §2. Allowed files

- `src/lib/meetings/types.ts`
- `src/pages/meetings/coach/SeriesCard.tsx`
- `src/pages/meetings/coach/SeriesCard.test.tsx`

Forbidden: everything else, in particular `coachModel.ts`,
`CoachMeetingsView.tsx`, any loader, any migration, `docs/swarm/**`,
`.claude/**`. Explicit pathspecs only when staging (item 22).

## §3. Acceptance criteria

1. `SeriesCardModel.gradedMarksCt: number` exists, required, documented.
2. `SeriesCard` renders `${model.gradedMarksCt} marks graded` unconditionally
   beside the attendance percentage, in every state where the Attendance
   block itself renders (i.e., not gated on `attendancePct !== null`).
3. No responsive/viewport conditional separates the two.
4. Targeted vitest for `SeriesCard.test.tsx` green, including the two new
   tests (null-attendance case, D014 measured-example regression case).
5. `npm run typecheck`, `npm run build`, `npm run lint`,
   `npm run format:check`, `npm run test` all reported with exit codes.
6. Report the exact diff and the commit SHA. Do not self-certify pass/fail —
   the orchestrator replays the mutation independently.

## §4. Least confident decisions (item 19d)

1. **Required vs. optional field.** I chose required because no real caller
   exists yet (§0) so nothing can break, and `attendancePct`/
   `sessionsCompleted` are already required on this same type — optional
   would let a future builder silently omit the mitigation, which is the
   exact defect this ticket exists to prevent. Wrong if a future ticket
   needs to render `SeriesCardModel` before real mark data is available
   (no such caller exists today).
2. **New line vs. combined sentence.** I chose a new fourth `Text` node
   rather than folding into the existing `"across N held"` caption, to keep
   the existing pinned test string intact and because "N held" (sessions)
   and "N marks graded" (marks) are different units the file's own module
   doc (item 1) is careful never to conflate. Wrong if a reviewer wants one
   combined sentence for tighter copy.
