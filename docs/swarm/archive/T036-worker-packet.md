# Worker Packet: T036

## Task ID
T036 — End meeting flow (MTG-13), Epic E5 (last task in this epic).

## Objective
Build `src/pages/meetings/EndMeetingDialog.tsx`: an "End meeting" action that opens a real
`AlertDialog` summarizing the live attendance state ("14 present · 2 late · 1 excused · 1 absent"),
and on confirm: sets the session's `event_sessions.status = 'completed'`, backfills a real `absent`
`attendance` row for every roster member with no attendance row at all, and sets
`check_out_at = ends_at` for any still-open check-in (a `present`/`late` row with `check_in_at` set
but `check_out_at` still null). Attendance remains coach-editable after completion — DATA-02's
already-applied DB trigger handles the audit logging for that, see Known Context/Traps #2 below.

## Dependencies (status)
- T033 (Live console `/meetings/live/:sessionId`) — Passed. This dialog is the natural next action
  from that screen (a coach ends the meeting they were just running live check-in for), but is NOT
  wired into `LiveConsole.tsx` by this task (that file is forbidden — see below). Read
  `src/pages/meetings/LiveConsole.tsx` for the real `AttendanceStatus` union
  (`'present' | 'late' | 'excused' | 'absent'`) and its `StatusDot`/`Badge` variant mapping
  (`present: success, late: warning, excused: neutral, absent: error`) so your summary counts and
  any status indicators use the same vocabulary and color mapping, not an invented one.

## Allowed Files
- `src/pages/meetings/EndMeetingDialog.tsx` (new)
- A colocated `EndMeetingDialog.test.tsx` is acceptable per established precedent — disclose it.

## Forbidden Files
- `src/pages/meetings/LiveConsole.tsx`, `MeetingsList.tsx`, `ScheduleMeetingsDialog.tsx`,
  `StudentMeetingView.tsx` — read-only reference only.
- `src/app/router.tsx`, `src/app/guards.tsx` (import-only) — read-only. This dialog is not wired
  into any route by this task.
- `src/lib/supabase/**` — read-only reference only, do not import directly. Build against an
  injectable `loadSummary`/`onEndMeeting`/`onEditAttendance`-style seam with obviously-fake fixture
  defaults, same posture as every prior content-page task in this batch.
- `supabase/migrations/**` — read-only. **Do not write a migration.**
- `docs/swarm/**`, `.claude/**`, `src/theme/**`.

## Ground Truth — real schema (read the actual files yourself, do not guess column names)
- `event_sessions`: `id`, `event_id`, `session_date`, `starts_at`, `ends_at`, `status` (check
  constraint `'scheduled' | 'completed' | 'canceled'`), `people_reached` (nullable int),
  `notes` (text, not null) — `supabase/migrations/20260717000000_scheduling_attendance.sql` lines
  53-63.
- `attendance`: `id`, `session_id`, `student_id`, `status` (check constraint
  `'present' | 'late' | 'excused' | 'absent'`), `check_in_at`, `check_out_at`, `hours_override`
  (nullable numeric), `method` (`'qr' | 'coach' | 'import'`), `recorded_by`, `updated_at` — same
  migration, lines 79-91. Unique on `(session_id, student_id)`.

## Known Context / Traps

**1. Two distinct real mutations on confirm, not one.** (a) `event_sessions.status` flips to
`'completed'` (one row). (b) Every roster member with **zero** `attendance` row for this session
gets a new `absent` row (real backfill, not a UI-only label) — the roster membership set has to come
from your injectable data seam (a list of active students for the session's team scope), not
invented. (c) Every existing `attendance` row that is `present`/`late` with `check_in_at` set but
`check_out_at` still null gets `check_out_at` set to the session's `ends_at`. Represent these as one
coherent `onEndMeeting` callback (single logical action from the caller's point of view), not three
independently-dispatchable calls that could leave state half-done if one leg failed — same
atomicity-contract shape T029's `SetActiveSeasonPayload` already established and passed review for.

**2. Post-completion attendance edits — a REAL, ALREADY-APPLIED DB trigger handles the audit
logging. Do not build your own audit_log write.** Read
`supabase/migrations/20260717000001_support_audit.sql` lines 120-156 yourself:
`fn_audit_attendance_post_completion()` / `trg_audit_attendance_post_completion` fires
`after update on public.attendance`, looks up `event_sessions.status` LIVE via `NEW.session_id`
(not a cached flag), and writes a real `audit_log` row whenever an `attendance` row is updated while
its session is already `'completed'`. This means: (a) your own backfill/checkout mutations in
Known Context/Traps #1 happen BEFORE the session flips to `'completed'` in the same logical action
(or are exempt some other well-reasoned way you disclose) so they don't themselves spuriously
trigger this audit path, and (b) any FUTURE coach edit to attendance after this dialog's confirm
(e.g. correcting a status later) is a plain `attendance` UPDATE through whatever callback seam you
expose for it — the DB trigger fires automatically, you must NOT write a second, duplicate
`audit_log` insert anywhere in this file. Grep your own file for `audit_log` before calling this
done: it should appear only in comments citing the trigger, never as a real write. This is the same
non-duplication safety property T027's checker already validated for `trg_audit_invite_revocation` —
same class of trap, different trigger.

**3. Summary counts must reflect LIVE state at click time, not be independently recomputed
elsewhere.** "14 present · 2 late · 1 excused · 1 absent" is a plain tally of the current
`attendance` rows for this session (grouped by `status`) — no formula, no view, just a `.filter`/
count. State clearly that the summary shown in the `AlertDialog` before backfill matches what the
final state will be (i.e., the summary should account for the fact that no-response roster members
will become `absent` on confirm — decide and disclose whether the pre-confirm summary already
folds in the about-to-be-backfilled absences, or shows only currently-recorded rows with a
separate "N with no record" callout; either is defensible, but state your choice explicitly).

**4. `AlertDialog` (DES-11-style confirm), not a plain `Dialog`.** Cite the real documented props
from `astryx-api.md` — the same component already used by T026 (Hard Delete confirm), T027 (Revoke
confirm), T029 (season-switch confirm).

**5. No shared Supabase client wired in — deliberate scope, not a gap for you to solve.** Same
posture as every prior content page.

## Acceptance Criteria
- "End meeting" action opens a real `AlertDialog` with an accurate, live-derived summary.
- Confirm sets `event_sessions.status='completed'`, backfills `absent` for every no-record roster
  member, and sets `check_out_at=ends_at` for every open check-in — represented as one coherent
  callback, not three independent ones.
- Post-completion attendance edits rely on the real `trg_audit_attendance_post_completion` trigger
  — zero client-side `audit_log` writes anywhere in this file (grep-provable).
- Summary counts match live roster/attendance state at click time.
- No box-drawing/bracket characters rendered (constitution item 13).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` all exit 0.

## Relevant Constitution Excerpts
> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md`. A prop absent from that
> file is presumed hallucinated → MAJOR.

> 10. Database changes are additive migrations via the Supabase CLI; editing an applied migration
> file → BLOCKER. *(Cited because the audit trigger already exists — do not duplicate it or write a
> migration.)*

## Most Recent Failure
None. This is attempt 1 for T036 (attempt count: 0).

## Required Worker Output
- Full contents of `EndMeetingDialog.tsx`.
- Explicit citation of `trg_audit_attendance_post_completion` and proof (grep output) that no
  client-side `audit_log` write exists anywhere in your file.
- Explicit write-up of the atomicity-contract shape for the three-part confirm action.
- Explicit write-up of your pre-confirm-summary-vs-backfill design choice (Known Context/Traps #3).
- Real test proof of the confirm flow (status flip, backfill, checkout) and the summary-count
  accuracy.
- Astryx prop citations for every component used — grep `astryx-api.md` yourself, don't guess.
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
