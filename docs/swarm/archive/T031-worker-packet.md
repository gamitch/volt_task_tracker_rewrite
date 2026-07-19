# Worker Packet: T031

## Task ID
T031

## Objective
Build `src/pages/meetings/ScheduleMeetingsDialog.tsx` — the "Schedule meetings" dialog (MTG-02).
`Dialog purpose="form"` with fields in this exact order: title (default "Team meeting"), team scope
(`MultiSelector` of teams, default all), location, schedule mode (`SegmentedControl`: Single |
Weekly recurring | Custom dates), date/time pickers (`DateInput`/`TimeInput`,
`DateRangeInput` for recurring range, weekday `CheckboxList` for recurring), notes. Creates one
`events` row (type `meeting`) + one `event_sessions` row per date. Nothing persists until "Create
meetings" is clicked; the button is disabled until title + at least one valid date exist.

## Dependencies (status)
- T030 (`/meetings` list) — Passed. `MeetingsList.tsx` already has a stubbed "Schedule meetings"
  button that shows a disclosure Banner instead of opening this dialog — read it (read-only, do not
  edit) to understand the exact trigger point a future wiring task will connect. You are NOT wiring
  this dialog into `MeetingsList.tsx` in this task; you're building the dialog component itself,
  standalone, with its own props/test harness.

## Allowed Files
- `src/pages/meetings/ScheduleMeetingsDialog.tsx` (new — confirm via `Glob` that this file doesn't
  exist yet)
- A colocated `ScheduleMeetingsDialog.test.tsx` is acceptable per the established precedent (T030's
  checker, T035's checker, T038's checker all independently ruled this in-scope for a
  single-file-Allowed-Files task that also needs to produce test evidence) — same reasoning
  applies here, don't ask permission, just disclose it in your output.

## Forbidden Files
- `src/pages/meetings/MeetingsList.tsx`, `Kiosk.tsx` — already-Passed tasks' files, read-only.
- `src/app/router.tsx`, `src/app/guards.tsx` — read-only.
- `src/lib/supabase/**` — read-only reference only, do not import. No page/dialog is wired to the
  real client yet (T071 deliberately left every consumer unwired) — build this against an
  injectable `onCreateMeetings`-style prop (or equivalent), defaulting to an obviously-fake stub
  that logs/records what would have been created, same posture as every prior content page.
- `supabase/migrations/**` — **mostly read-only, with one narrow exception below (the notes-column
  question).**
- `docs/swarm/**`, `.claude/**`, `src/theme/**`.

## Known Context / Traps

**1. THE `event_sessions.notes` NULLABILITY QUESTION — resolve this, it's explicitly your job.**
T010's migration (`supabase/migrations/20260717000000_scheduling_attendance.sql` line 61) defines
`event_sessions.notes text not null` with no default — a literal reading of the schema convention.
But MTG-02's own field spec doesn't require `notes` to enable the "Create meetings" button, implying
it's meant to be optional. You must resolve this one of two ways:
  - (a) Always supply a value in your `event_sessions` INSERT payload, even an empty string
    (`notes: formValues.notes ?? ''`) — simplest, no migration needed, or
  - (b) Ship a small, additive migration making the column nullable/defaulted (e.g.
    `alter table event_sessions alter column notes set default ''`) — only if you judge (a)
    insufficient.
  **Do not edit T010's existing migration file** (constitution item 10 — editing an applied
  migration is a BLOCKER). If you go with (b), create a NEW migration file. **State explicitly in
  your output which option you chose and why** — this exact question is also flagged in T039's
  packet (a different, not-yet-dispatched task); whichever of you lands first should resolve it
  once, not twice — check `git log --oneline -- supabase/migrations/` yourself before writing a
  new migration, in case T039 already landed one.

**2. BEH-07 confirm-button copy is a real, checker-enforced acceptance bar.** The button must state
the computed outcome — e.g. "Create 14 meetings" for a 14-session recurring schedule, "Create 1
meeting" for a single session. A bare "Create" or "Submit" is a checker MAJOR per this project's
established pattern (see T023/T039/T042's identical BEH-07 requirement, and T021/RosterShell's
established `astryx-api.md` citation discipline for confirm-button copy).

**3. Recurring/custom-dates session generation is the core logic of this dialog — get the math
right and prove it with tests.** "Weekly recurring" needs a `DateRangeInput` (start/end) + a weekday
`CheckboxList` (e.g. Mon/Wed/Fri) generating one `event_sessions` row per matching date in range.
"Custom dates" needs an explicit list of picked dates. "Single" needs exactly one date. Prove each
mode independently with a real test (not just a screenshot) — e.g. a 6-week Mon/Wed/Fri range
should produce exactly 18 session rows, not 17 or 19 (off-by-one boundary errors on date-range
generation are a classic, checker-scrutinized bug class in this project).

**4. No shared Supabase client wired in — deliberate scope, not a gap for you to solve.** Build the
real dialog UI and real session-generation logic, but the actual `events`/`event_sessions` INSERT
must go through an injectable callback prop (e.g. `onCreateMeetings: (payload) => Promise<void>`)
with an obviously-fake default implementation, same posture as every prior content page.

**5. "Disabled until title + ≥1 valid date" is a real, testable acceptance criterion**, not just a
visual state — prove the button is genuinely non-interactive (not just styled to look disabled)
when the condition isn't met, and genuinely becomes clickable when it is, across all three schedule
modes.

## Acceptance Criteria
- Field order matches MTG-02 exactly: title, team scope, location, schedule mode, date/time
  pickers, notes.
- Confirm button states the computed outcome (BEH-07) — e.g. "Create 14 meetings" — for every
  schedule mode, not just the happy path.
- Session-generation math proven correct via real tests for all three modes (Single, Weekly
  recurring, Custom dates), including a boundary case for the recurring mode.
- Nothing persists (no callback invoked) until "Create meetings" is clicked.
- Button disabled state is genuinely non-interactive, correctly gated on title + ≥1 valid date.
- `event_sessions.notes` nullability question explicitly resolved and disclosed (Known Context/
  Traps #1).
- No box-drawing/bracket characters rendered (constitution item 13).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` all exit 0.

## Relevant Constitution Excerpts
> 10. Database changes are additive migrations via the Supabase CLI; editing an applied migration
> file → BLOCKER.

> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md`. A prop absent from that
> file is presumed hallucinated → MAJOR.

> 13. Templates are used as-is; MTG-02/OUT-02 dialog field order is exact, not a suggestion.

## Most Recent Failure
None. This is attempt 1 for T031 (attempt count: 0).

## Required Worker Output
- Full contents of `ScheduleMeetingsDialog.tsx`.
- Explicit statement of the `notes`-nullability resolution chosen and why, including confirmation
  you checked git log for a possible T039 migration first.
- Real test proof of session-generation math for all three modes, including the boundary case.
- Real proof of the disabled/enabled button state transition.
- Astryx prop citations for every component used (`Dialog`, `MultiSelector`, `SegmentedControl`,
  `DateInput`/`TimeInput`/`DateRangeInput`, `CheckboxList`, `Button` — grep `astryx-api.md`
  yourself, don't guess).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
