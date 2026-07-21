# Worker Packet: T037

## Task ID
T037

## Objective
Build `src/pages/meetings/StudentMeetingView.tsx` — a standalone, reusable component: `/meetings`
read-only history for students (own) and parents (per linked student) + participation % from
`v_student_participation` (T013), PLUS the real BEH-06 "consistency strip" (last 5 completed
meetings rendered as `StatusDot`s per DES-05) that T030 explicitly stubbed out as a placeholder.

## Dependencies (status)
- T030 (`/meetings` list) — Passed. **Read `MeetingsList.tsx` in full before writing any code** —
  it already contains a working `StudentMeetingsView` internal component (own history +
  participation %, sourced from a `v_student_participation`-shaped fixture) with an explicitly
  labeled placeholder `Section` where it says the real "consistency strip" is T037's job (search
  its module doc for "consistency strip" / "T037"). **This task is NOT a full duplicate rebuild of
  that view.** Your job is narrower and more specific: build the real, standalone, reusable
  consistency-strip component (last-5 `StatusDot`s + surrounding participation-%/BEH-06 compliance)
  that a future wiring task can drop into `MeetingsList.tsx`'s placeholder slot (and potentially
  into `ParentHome.tsx`/T055's "next 3 events" card, which needs similar attendance-history
  rendering). If, after reading `MeetingsList.tsx`, you judge the ledger's "Student/parent meeting
  view" framing to mean something broader than the consistency strip alone, **flag this scope
  question explicitly as a dispute candidate** rather than silently either (a) duplicating
  everything T030 already built, or (b) building only a trivial strip and ignoring the rest of the
  ledger's Objective line. State your read of the situation and your chosen scope clearly.
- T013 (metric views) — Passed. `v_student_participation` is the only legitimate source for the
  participation percentage (constitution item 3 — BLOCKER if re-derived in TypeScript).

## Allowed Files
- `src/pages/meetings/StudentMeetingView.tsx` (new — confirm via `Glob` this doesn't exist yet)
- A colocated `StudentMeetingView.test.tsx` is acceptable per established precedent — disclose it.

## Forbidden Files
- `src/pages/meetings/MeetingsList.tsx`, `Kiosk.tsx` — already-Passed tasks' files, **read-only**.
  Do not edit `MeetingsList.tsx` to wire your new component in — that's a separate future task.
- `src/app/router.tsx`, `src/app/guards.tsx` — read-only.
- `src/lib/supabase/**` — read-only reference only, do not import. Build against an injectable
  `loadData`-style seam with obviously-fake fixture defaults.
- `supabase/migrations/**` — read-only.
- `docs/swarm/**`, `.claude/**`, `src/theme/**`.

## Known Context / Traps

**1. Constitution item 17 / BEH-06 is BLOCKER-class here — read it carefully.** No streak counters,
no "don't break it" mechanics, anywhere in this component. Excused marks must never be rendered as
failures, visually or in copy — an excused absence's `StatusDot` uses the DES-05 `neutral` color
(same as any other non-failure state), never `error` or any red/alarming treatment. Grep your own
file for any streak-shaped copy ("day streak", "keep it up", "don't break", consecutive-count logic)
before calling this done — a BLOCKER finding here fails the task outright, no partial credit.

**2. DES-05's exact color mapping — use it verbatim.** Present = `success`, Late = `warning`,
Excused = `neutral`, Absent = `error`. This is a real constitution-cited PRD line
(`docs/swarm/VOLT_Portal_PRD.md` line 195) — do not invent your own semantic mapping.

**3. "Last 5 completed meetings" — get the selection logic right.** Only `event_sessions.status =
'completed'` sessions count, most-recent-first, capped at exactly 5 (fewer than 5 if the student's
history is shorter — render however many exist, don't pad with empty/placeholder dots). Prove this
boundary with a real test (a student with exactly 4 completed sessions should show 4 dots, not 5;
a student with 8 should show only the 5 most recent).

**4. Participation-% sourcing (constitution item 3, BLOCKER-class) — same standard every prior
content page has been held to.** The percentage must come from a `v_student_participation`-shaped
fixture field, never computed by this component from raw present/expected counts. Read
`supabase/migrations/20260717000003_metric_views.sql` yourself for the real column shapes.

**5. No shared Supabase client wired in — deliberate scope, not a gap for you to solve.** Same
posture as every prior content page — injectable `loadData`-style seam, obviously-fake fixture
defaults.

**6. Parent variant — per linked student, plural.** A parent may have more than one linked student
(via `guardian_links`); your component must handle rendering per-student (either one strip per
student, or an explicit student-selector — your call, disclose the choice), not silently assume a
parent only ever has one child.

## Acceptance Criteria
- **BLOCKER-class (constitution item 17 / BEH-06):** zero streak counters, zero "don't break it"
  copy or logic; excused marks never rendered as failures. Grep-provable.
- Last-5-completed-meetings selection logic proven correct via real tests, including the
  fewer-than-5 boundary case.
- DES-05 color mapping used verbatim (Present=success, Late=warning, Excused=neutral, Absent=error).
- Participation % sourced from a `v_student_participation`-shaped fixture only, zero re-derivation
  (constitution item 3, BLOCKER).
- Parent variant correctly handles multiple linked students.
- Explicit scope write-up addressing the overlap with T030's already-built `StudentMeetingsView`
  (Known Context/Traps #1) — flagged as a dispute candidate if genuinely ambiguous, not silently
  resolved either direction.
- No box-drawing/bracket characters rendered (constitution item 13).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` all exit 0.

## Relevant Constitution Excerpts
> 17. No streak counters, "don't break it" mechanics, or gamification that could make an excused
> absence look like a failure (BEH-06) → BLOCKER.

> 3. RLS policies and metric SQL come **only** from PRD Section 8.4, copied verbatim. Re-deriving
> either, or duplicating a metric formula in TypeScript (PRD DATA-01) → BLOCKER.

> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md`. A prop absent from that
> file is presumed hallucinated → MAJOR.

## Most Recent Failure
None. This is attempt 1 for T037 (attempt count: 0).

## Required Worker Output
- Full contents of `StudentMeetingView.tsx`.
- Explicit write-up of how you read the scope-overlap question with T030's `MeetingsList.tsx` and
  why (Known Context/Traps #1).
- Explicit grep-provable proof of zero streak-shaped copy/logic anywhere in the file.
- Real test proof of the last-5/fewer-than-5 selection logic and the DES-05 color mapping for all
  four attendance statuses.
- Citation of the real `v_student_participation` column shapes your fixture is modeled on (file +
  line).
- Astryx prop citations for every component used (`StatusDot`, `ProgressBar`, etc. — grep
  `astryx-api.md` yourself, don't guess).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
