# Worker Packet: T055

## Task ID
T055

## Objective
Build `src/pages/home/ParentHome.tsx` — Parent Home (HOME-03): one `Card` per linked student
(name + team badge, hours bar, participation %, next 3 events + RSVP status), with an
RSVP-on-behalf control per event, and a footer note ("You get a weekly summary by email every
Sunday — manage in Settings").

## Dependencies (status)
- T038 (`/outreach` list), T013 (metric views) — Passed.
- T037 (Student/parent meeting view + consistency strip) — Passed. **Read
  `src/pages/meetings/StudentMeetingView.tsx` in full (read-only)** — it exports a real, reusable
  `ConsistencyStrip` component (last-5-completed-meetings `StatusDot`s + participation %,
  BEH-06-compliant) plus its supporting types (`ConsistencyStripData`, `LoadConsistencyStripDataFn`,
  etc.). HOME-03's own spec doesn't explicitly require a meeting-history element per student, but
  this task's own Acceptance line is conditionally worded ("**if** a meeting-history element is
  shown per student..."), implying it's your call whether to include one. If you choose to show
  per-student meeting history, **reuse the real exported `ConsistencyStrip` component rather than
  building a second one** — it already solved this exact BLOCKER-class BEH-06 problem correctly and
  was independently checker-verified. If you choose not to include one, state that explicitly too.
  Either way, disclose your decision and reasoning.

## Allowed Files
- `src/pages/home/ParentHome.tsx` (new — confirm via `Glob` this doesn't exist yet)
- A colocated `ParentHome.test.tsx` is acceptable per established precedent — disclose it.

## Forbidden Files
- `src/pages/meetings/StudentMeetingView.tsx` — already-Passed sibling task's file. You MAY import
  its exported `ConsistencyStrip` component and types (that's the point of it being exported), but
  do not edit the file itself.
- `src/pages/home/CoachHome.tsx`, `StudentHome.tsx` (if it exists by the time you run), `StudentHomeSlot.tsx`
  — sibling/already-Passed tasks' files, read-only reference for conventions only.
- `src/pages/outreach/**`, `src/pages/meetings/**` (other than `StudentMeetingView.tsx`'s named
  exports) — read-only reference for conventions only. `ParentRsvp.tsx` (T043) does not exist yet
  (currently Blocked) — render an obvious RSVP-on-behalf control (e.g. a `SegmentedControl` per
  event, matching the pattern `OutreachList.tsx`/T038 already established for a student's own RSVP)
  with a real local-state update, but do not attempt to build T043's full real/persisted flow — that
  task explicitly owns "responder attribution" (student sees "Mom signed you up") and cross-role
  override semantics, which are out of scope here. State clearly what you built vs. deliberately
  left for T043.
- `src/app/router.tsx`, `src/app/guards.tsx` (import-only) — read-only.
- `src/lib/supabase/**` — read-only reference only, do not import directly. Build against an
  injectable `loadData`-style seam with obviously-fake fixture defaults.
- `supabase/migrations/**` — read-only.
- `docs/swarm/**`, `.claude/**`, `src/theme/**`.

## Known Context / Traps

**1. Constitution item 17 / BEH-06 (BLOCKER-class) — applies IF you include meeting history.** No
streak counters, no "don't break it" mechanics, excused marks never rendered as failures. Strongly
prefer reusing `StudentMeetingView.tsx`'s exported `ConsistencyStrip` (see Dependencies above) over
building new logic that could reintroduce this class of bug.

**2. A parent may have multiple linked students — this is the core structural requirement.** Render
one independent `Card` per linked student (via `guardian_links`, read
`supabase/migrations/20260716000000_identity_roster.sql` lines 72-79, read-only), never assuming a
single child. Match the "one `Section` per linked student" pattern `StudentMeetingView.tsx`'s parent
variant already established (read it, read-only) — each student's data loads/renders independently.

**3. MET-01/MET-04 sourcing (constitution item 3, BLOCKER-class).** Hours bar and participation %
must be sourced from `v_student_hours`/`v_student_participation`-shaped fixtures per student, zero
re-derivation. Same discipline every prior task in this batch has been held to.

**4. "Next 3 events" — both meeting and outreach sessions the student is scoped to** (read
`MeetingsList.tsx`/`OutreachList.tsx`, read-only, for how "upcoming sessions" was already modeled),
sorted chronologically, capped at exactly 3. Prove the boundary (a student with 5 upcoming events
shows only the nearest 3; a student with 1 shows just 1, no padding).

**5. RSVP-on-behalf — a real, working control with real local-state, but explicitly NOT T043's full
scope (see Forbidden Files).** No "responder attribution" copy ("Mom signed you up") is required
here — that's T043's job once it's dispatched.

**6. Footer note is a literal, specific copy string** — "You get a weekly summary by email every
Sunday — manage in Settings." Use it verbatim (DES-14/copy-fidelity discipline this project has
consistently enforced), not a paraphrase.

**7. No shared Supabase client wired in — deliberate scope, not a gap for you to solve.** Same
posture as every prior content page.

## Acceptance Criteria
- One `Card` per linked student, correctly handling multiple children.
- **BLOCKER-class (constitution item 17/BEH-06), if a meeting-history element is shown**: zero
  streak/loss-aversion framing — strongly prefer reusing `StudentMeetingView.tsx`'s
  `ConsistencyStrip`.
- MET-01/MET-04 sourced from view-shaped fixtures only, zero re-derivation (constitution item 3).
- "Next 3 events" boundary logic proven correct (padding-free, correctly capped).
- RSVP-on-behalf control real and working locally, explicitly scoped short of T043's full job.
- Footer digest note copy used verbatim.
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
None. This is attempt 1 for T055 (attempt count: 0).

## Required Worker Output
- Full contents of `ParentHome.tsx`.
- Explicit write-up of whether/how you reused `StudentMeetingView.tsx`'s `ConsistencyStrip` and why.
- Real test proof of correct multi-linked-student handling.
- Real test proof of the "next 3 events" boundary logic.
- Citation of the real `v_student_hours`/`v_student_participation`/`guardian_links` shapes your
  fixtures are modeled on (file + line).
- Astryx prop citations for every component used — grep `astryx-api.md` yourself, don't guess.
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
