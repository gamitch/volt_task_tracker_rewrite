# Worker Packet: T042

## Task ID
T042

## Objective
Build `src/pages/outreach/MarkDayCompleteDialog.tsx` — the "Mark day complete" `Dialog` (OUT-05,
coach-only, opens on/after a session date): attendee checklist pre-checked from `going` RSVPs
(coach adjusts), people-reached `NumberInput`, optional per-student hours override `NumberInput`
(defaults to session duration, for partial attendance). Confirm → session `completed`; checked
students get `attendance` rows (`method='coach'`, status `present`); hours computed per MET-03. Not
reversible without an audit-logged edit.

## Dependencies (status)
- T038 (`/outreach` list) — Passed. Read `OutreachList.tsx` (read-only) for established
  `events`/`event_sessions`/`rsvps` fixture conventions.
- T040 (RSVP control) — **listed as this task's ledger dependency; may or may not be Passed by the
  time you're dispatched.** If Passed, read `RsvpControl.tsx` (read-only) for its `RsvpRow` shape
  and cite it. If not, use `OutreachList.tsx`'s existing shapes and disclose that you did so.

## Allowed Files
- `src/pages/outreach/MarkDayCompleteDialog.tsx` (new — confirm via `Glob` this doesn't exist yet)
- A colocated `MarkDayCompleteDialog.test.tsx` is acceptable per established precedent — disclose it.

## Forbidden Files
- `src/pages/outreach/OutreachList.tsx`, `OutreachEventDialog.tsx`, `RsvpControl.tsx`,
  `OutreachDetail.tsx` — already-Passed/sibling tasks' files, read-only reference only.
- `src/app/router.tsx`, `src/app/guards.tsx` (import-only) — read-only.
- `src/lib/supabase/**` — read-only reference only, do not import directly. Build against an
  injectable `onMarkComplete`-style callback seam with an obviously-fake default.
- `supabase/migrations/**` — read-only.
- `docs/swarm/**`, `.claude/**`, `src/theme/**`.

## Ground Truth — real schema (read the actual files yourself, do not guess column names)
- `attendance`: `id`, `session_id`, `student_id`, `status` (`'present'|'late'|'excused'|'absent'`),
  `check_in_at`/`check_out_at` (nullable), `hours_override` (nullable), `method`
  (`'qr'|'coach'|'import'`), `recorded_by`, `updated_at` — `20260717000000_scheduling_attendance.sql`
  lines 82-95.
- `event_sessions`: `status` (`'scheduled'|'completed'|'canceled'`), `people_reached` (nullable),
  `starts_at`/`ends_at` — same file, lines 53-63.
- **MET-03 formula (read-only, cited here for context — you do NOT implement this formula
  yourself)**: `hours_override` if set, else `(check_out − check_in)` clamped to the session window
  if both exist, else scheduled session duration — this is entirely `v_student_hours`'s SQL, read
  `20260717000003_metric_views.sql` lines 3-19 for the real formula, but **never reproduce it in
  TypeScript**.

## Known Context / Traps

**1. MET-03 formula ownership — this is the single most important distinction in this task
(constitution item 3, BLOCKER-class).** This dialog WRITES `attendance.hours_override` per student
(or leaves it unset to fall back to session duration) — it does NOT need to independently compute
or verify a total-hours number. The `NumberInput` per student simply defaults its displayed value to
the session's duration (a plain, real, single subtraction of `ends_at - starts_at`, which is NOT a
re-derivation of MET-03's coalesce chain — it's the *third* fallback tier of that formula, computed
here only as a sensible starting default value for the coach to override, not as a claim about a
student's real confirmed-hours total). If this dialog shows any kind of summary total (e.g. "6
attended · 42 h" per BEH-07 below), that total must be computed by summing the same per-student
values you're about to write (a legitimate local sum of values you're constructing, not a
re-derivation of `v_student_hours`'s read-side formula) — state this reasoning explicitly in your
output since it's a subtle line to walk correctly.

**2. BEH-07 confirm button states the computed outcome**: e.g. "Mark complete — 6 attended · 42 h"
— never a bare "Confirm"/"Submit". The numbers must reflect the current checklist/hours-override
state at the moment of rendering (recompute live as the coach adjusts the checklist).

**3. "Not reversible without an audit-logged edit"** — this dialog itself performs a one-way action
(session → completed, attendance rows created). You are not building the "audit-logged edit" flow
itself (that's presumably `LiveConsole.tsx`/T033's or a future task's post-completion-edit path,
already noted as "attendance remains coach-editable post-completion" elsewhere in this project) —
just make sure your Confirm button's copy/behavior doesn't imply this action can be casually undone
from within this same dialog.

**4. Attendee checklist pre-checked from `going` RSVPs, coach adjusts.** Prove: a student with
`status='going'` starts checked; one with `'maybe'`/`'declined'`/no RSVP row starts unchecked; the
coach can toggle any row regardless of starting state.

**5. People-reached `NumberInput`** — writes to `event_sessions.people_reached` (a session-level
field, not per-student).

**6. No shared Supabase client wired in — deliberate scope, not a gap for you to solve.** Same
posture as every prior content page.

## Acceptance Criteria
- Attendee checklist pre-checked from `going` RSVPs, coach-adjustable.
- People-reached `NumberInput` present, session-scoped.
- Per-student hours override `NumberInput`, defaulting to session duration, coach-adjustable.
- BEH-07 confirm button states the live-computed outcome ("Mark complete — N attended · M h").
- MET-03's real formula never reproduced in TypeScript — only a legitimate default-value duration
  computation and a legitimate local sum of the values being written, both explicitly reasoned
  through in your output.
- No box-drawing/bracket characters rendered (constitution item 13).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` all exit 0.

## Relevant Constitution Excerpts
> 3. RLS policies and metric SQL come **only** from PRD Section 8.4, copied verbatim. Re-deriving
> either, or duplicating a metric formula in TypeScript (PRD DATA-01) → BLOCKER.

> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md`. A prop absent from that
> file is presumed hallucinated → MAJOR.

## Most Recent Failure
None. This is attempt 1 for T042 (attempt count: 0).

## Required Worker Output
- Full contents of `MarkDayCompleteDialog.tsx`.
- Explicit write-up of the MET-03 formula-ownership reasoning (Known Context/Traps #1).
- Real test proof of the pre-checked-from-RSVP checklist state and the live-computed BEH-07 button
  copy.
- Astryx prop citations for every component used — grep `astryx-api.md` yourself, don't guess.
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
