# Checker Packet: T031 (Schedule meetings dialog) — Check Attempt 1

## Task ID
T031 — Schedule meetings dialog (MTG-02), Epic E5.

## Checker Agent
checker-reviewer (per task-ledger.md T031 row).

## Objective
Verify a `Dialog purpose="form"` with MTG-02's exact field order, correct session-generation math
across all three schedule modes (Single/Weekly recurring/Custom dates), a BEH-07 computed-outcome
confirm button, and a correctly-resolved `event_sessions.notes` nullability question.

## Allowed Files (worker's literal permitted edit)
- `src/pages/meetings/ScheduleMeetingsDialog.tsx` (new)

**Scope flag**: worker also created `ScheduleMeetingsDialog.test.tsx`, outside the literal Allowed
Files line — same disclosed pattern already ruled in-scope by prior checkers. Re-derive the
judgment yourself.

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commit (`4408ca9`) — do NOT
infer authorship from commit messages. **Critical check**: confirm
`supabase/migrations/20260717000000_scheduling_attendance.sql` (T010's applied migration) is
byte-unchanged — the worker claims it resolved the notes-nullability question WITHOUT a new
migration; verify no migration file was added or edited by this commit at all. Confirm
`MeetingsList.tsx`, `Kiosk.tsx`, `router.tsx`, `guards.tsx`, `src/lib/supabase/**` untouched. Note:
the working tree may currently also show `CoachHome.tsx`/`.test.tsx` (T053) as untracked — belongs
to a different, concurrently-running task; do not flag it against T031.

## Worker's Claimed Changes (do not trust — verify independently)
1. **`event_sessions.notes` nullability resolved as option (a)**: checked `git log --oneline --
   supabase/migrations/` first (no T039 migration existed), then chose to always supply a value —
   `buildEventSessionsPayload` defaults `notes` to `''`, never `undefined`/`null`. Same treatment
   extended to `events.description`/`events.address` (also `not null` with no default, also not
   part of MTG-02's field list) for the same reason. No migration file created.
2. **BEH-07 confirm button**: `computeConfirmLabel(sessionCount)` is the sole label source — "Create
   0 meetings" / "Create 1 meeting" / "Create 14 meetings", never a bare "Create".
3. **Session-generation math, all three modes + boundary case**: `generateSingleSessionDates`,
   `generateRecurringSessionDates`, `generateCustomSessionDates` dispatched via
   `computeScheduleSessionDates`. Claims a 6-week Mon/Wed/Fri range (2026-07-06→2026-08-16, both
   ends inclusive) produces exactly 18 sessions; shortening by one day past the last matching Friday
   drops the count to 17; shortening past a non-matching boundary day (Sunday) leaves it at 18.
4. **Disabled/enabled button state**: claims a genuine native `disabled` attribute (not merely
   `aria-disabled`) blocks click dispatch for all three modes, correctly transitioning as valid
   dates are added/removed and title is cleared. Claims the Weekly-mode enabled-transition test
   drives the real `DateRangeInput` popover via a documented `presets` prop (a "Next 6 weeks"
   quick-pick the worker added), not a state-injection shortcut.
5. Claims 31/31 new tests pass, 195/195 repo-wide; typecheck/build/lint(scoped)/format(scoped) all
   exit 0. Discloses whole-repo lint/format failures at the time of its run as caused by other
   concurrent workers' in-progress files (`CoachHome.tsx`, `renderEmailLayout.ts`, `Kiosk.tsx`),
   confirmed via git status not to be its own.
6. Discloses `chicagoWallTimeToUtcIso` uses an `Intl.DateTimeFormat` round-trip offset trick (not a
   date library) — tested for CDT/CST but not exhaustively fuzzed against every DST transition
   instant. Discloses reliance on internal Astryx DOM structure (real `label[for]`, popover-mounted
   preset buttons) for `DateRangeInput`/`CheckboxList` interaction tests since
   `@testing-library/react` isn't installed. Discloses recurring `act(...)` console warnings during
   Popover/Layer interactions as a pre-existing jsdom gap (same class as `MeetingsList.test.tsx`'s
   already-flagged `showModal` gap), not a new defect.

## Required Verification Steps
1. **Read `ScheduleMeetingsDialog.tsx` and `ScheduleMeetingsDialog.test.tsx` in full** — do not
   rely on the worker's module doc or this packet's paraphrasing.
2. **The `notes`-nullability resolution — the single highest-stakes check in this packet.** Confirm
   by direct diff (`git show 4408ca9 --stat` or equivalent) that NO migration file was created or
   modified — the worker chose option (a), always-supply-a-value, not option (b). Confirm by source
   read that `notes` (and the worker's extended treatment of `description`/`address`) is never
   `undefined`/`null` in the actual INSERT payload construction. Independently confirm via
   `git log --oneline -- supabase/migrations/` that no T039 migration landed first that this task
   should have coordinated with instead.
3. **Session-generation math — re-derive the boundary case yourself, don't just trust the claimed
   counts.** Manually compute (or write your own quick script) how many Mon/Wed/Fri dates fall in a
   2026-07-06→2026-08-16 inclusive range and confirm it's genuinely 18, not just accept the worker's
   assertion. Then verify the two claimed boundary-shift cases (17 and 18) are correct adjustments.
   Read the generation functions directly for off-by-one risk (inclusive vs. exclusive range
   endpoints, weekday-matching logic).
4. **BEH-07 button copy — confirm across all three modes**, not just the happy path. Check the
   0-sessions case too (does "Create 0 meetings" ever actually reach the user, or does the button
   stay disabled at 0? — read the disabled-state logic to understand the real relationship between
   these two claims).
5. **Disabled/enabled state — reproduce or independently verify.** Confirm by source read that a
   genuine `disabled` DOM attribute is used (open `Button`'s installed source/`astryx-api.md` to
   confirm this is the documented behavior when no `tooltip` prop is supplied, as the worker
   claims), not just a CSS/visual treatment that a real user could still click through.
6. **Astryx prop citations** — spot-check `Dialog`, `MultiSelector`, `SegmentedControl`,
   `DateInput`/`TimeInput`/`DateRangeInput`, `CheckboxList` against `astryx-api.md`, including the
   worker's claimed doc-gap resolutions (`DialogHeader`, `SegmentedControlItem`,
   `CheckboxListItem`, `ListItem`, `LayoutContent`, `LayoutFooter` — claimed `undefined` in the doc,
   resolved via installed `.d.ts` files) — verify these doc-gap claims yourself rather than
   accepting them.
7. **Test-file scope question** — render an explicit verdict, independently re-derived.
8. **Re-run typecheck/lint/build/test yourself** — don't accept "31/31"/"195/195"/"exit 0" without
   your own run. Confirm the disclosed whole-repo lint/format failures are genuinely caused by other
   concurrent workers' files, not this task's commit.
9. **No box-drawing/bracket characters, no fabricated real-looking PII** — grep sweep yourself.

## Relevant Constitution Excerpts
- Item 10 (BLOCKER-class): database changes are additive migrations via the Supabase CLI; editing
  an applied migration file is a BLOCKER. (This task correctly avoided touching T010's migration at
  all per the worker's claim — verify this is genuinely true.)
- Item 2: Astryx component usage must stay within the documented API surface.
- Item 13: templates/dialog field order (MTG-02) is exact, not a suggestion.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase)
- commands run
- exact findings
- explicit verdict on the `notes`-nullability resolution (correct choice, correctly implemented,
  no migration touched)
- explicit verdict on the session-generation boundary-case correctness
- explicit verdict on the test-file scope question
- required rework if failed
- follow-up tasks if passed with minor issues
