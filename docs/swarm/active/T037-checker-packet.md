# Checker Packet: T037 (Student/parent meeting view + consistency strip) — Check Attempt 1

## Task ID
T037 — Student/parent meeting view + consistency strip (BEH-06), Epic E5.

## Checker Agent
checker-reviewer (per task-ledger.md T037 row).

## Objective
Verify a standalone, reusable BEH-06 consistency-strip component (last-5-completed-meetings as
`StatusDot`s + participation %), correctly scoped to avoid duplicating T030's already-Passed
`MeetingsList.tsx` student/parent view, with constitution item 17's BLOCKER-class anti-gamification
rule fully respected.

## Allowed Files (worker's literal permitted edit)
- `src/pages/meetings/StudentMeetingView.tsx` (new)

**Scope flag**: worker also created `src/pages/meetings/StudentMeetingView.test.tsx`, outside the
literal Allowed Files line — same disclosed pattern already ruled in-scope by T030/T035/T038's
checkers. Re-derive the judgment yourself.

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commit (`bedc957`) — do NOT
infer authorship from commit messages. Confirm `MeetingsList.tsx` (T030, Passed) is byte-unchanged.
Confirm `router.tsx`, `guards.tsx`, `src/lib/supabase/**` untouched. Note: the working tree may
currently also show `ScheduleMeetingsDialog.tsx` (T031) and `StudentsTab.tsx`/`.test.tsx`/
`__debug__/` (T022) as untracked — those belong to different, concurrently-running tasks, not this
one; do not flag them against T037.

## Worker's Claimed Changes (do not trust — verify independently)
1. **THE CENTRAL SCOPE QUESTION**: worker read `MeetingsList.tsx` (T030, Passed) first and found it
   already ships the *entire* MTG-14 read-only history page (own Upcoming/Past rows, DES-05
   attendance badges, participation % ProgressBar, all four DES-12 states) with an explicit
   placeholder `Section` whose copy states BEH-06's consistency strip is T037's job. Worker
   concluded — and did NOT file a dispute — that the correct scope is a **standalone, reusable
   `ConsistencyStrip` widget** (last-5 `StatusDot`s + participation %) plus a top-level
   `StudentMeetingView` orchestrator, NOT a duplicate rebuild of T030's history rows. Render your
   own independent verdict on whether this reading was correct, not just whether the worker
   followed it.
2. **BLOCKER-class BEH-06 claim**: grepped for streak-shaped language, claims all 6 matches are
   inside the module-doc comment (which cites the prohibition itself), zero in rendered JSX/logic.
   Excused entries map to `variant: 'neutral'`, never `'error'` — claims a dedicated test proves no
   `'error'` variant appears for an excused-only render.
3. **Last-5/fewer-than-5 boundary**: `selectLastCompletedAttendance` filters to
   `status === 'completed'` only, sorts descending by `startsAt`, slices to 5, **no padding**.
   Claims tests prove: 4-record history → 4 entries (not padded to 5); 8-record history → exactly 5,
   most-recent-first; scheduled/canceled sessions never selected even with an attendance record.
4. **DES-05 color mapping** claimed verbatim: present=success, late=warning, excused=neutral,
   absent=error — claims a test asserts all four `data-variant` values on real rendered
   `<span role="img">` elements.
5. **Parent variant** (`variant: 'linked'`, explicit prop not auto-detected from `useAuth()` —
   disclosed reason: `guards.tsx`'s `Role` union still lacks `student`/`parent`): renders one
   independent `Section` per linked student (never assumes a single child), each with its own
   DES-12 states — chosen over a selector dropdown, disclosed as the worker's own design call.
6. **Participation-% sourcing**: `StudentParticipationMetric` claimed a verbatim camelCase rename of
   `v_student_participation`'s 7 real columns (cites `20260717000003_metric_views.sql` lines 21-42,
   30-38), zero `100.0 *`/`/ greatest(` in executable code.
7. Claims 26/26 new tests pass; full-suite run shows 2 pre-existing failures in
   `StudentsTab.test.tsx` — claims these belong to a different, concurrently-running task (T022),
   not caused by or related to this change, evidenced by observing new untracked files
   (`_spike.test.tsx`, `__debug__/debug.test.tsx`) appearing mid-session from concurrent activity.

## Required Verification Steps
1. **Read `StudentMeetingView.tsx` and `StudentMeetingView.test.tsx` in full** — do not rely on the
   worker's module doc or this packet's paraphrasing.
2. **Read `MeetingsList.tsx` yourself (read-only)** and independently judge the central scope
   question: is the worker's narrower reading (standalone consistency-strip widget, not a duplicate
   full history rebuild) the correct interpretation of this task's ledger Objective line and the
   worker packet's explicit narrowing instruction? Or should this have been flagged as a dispute
   instead of resolved unilaterally? State your reasoning, not just agreement/disagreement.
3. **BEH-06 (constitution item 17, BLOCKER-class) — reproduce the grep yourself.** Confirm zero
   streak-shaped copy/logic exists outside comments. Confirm by source read that excused entries
   render `variant: 'neutral'`, never `'error'` or any alarming color — this is the single
   highest-stakes check in this packet.
4. **Last-5 boundary logic — re-derive independently.** Read `selectLastCompletedAttendance`
   yourself and confirm: filter-to-completed-only, correct descending sort, exact slice to 5, no
   padding. Reproduce or independently write a test for the fewer-than-5 case.
5. **DES-05 mapping — confirm by source read**, not just the test assertion.
6. **Participation-% sourcing (constitution item 3) — re-derive against the real view.** Open
   `supabase/migrations/20260717000003_metric_views.sql` yourself and confirm the column rename is
   faithful and zero arithmetic exists in executable code.
7. **Parent multi-student handling** — confirm by source read that the "one `Section` per linked
   student" claim is real, not a single-child assumption in disguise.
8. **Test-file scope question** — render an explicit verdict, independently re-derived.
9. **Re-run typecheck/lint/build/test yourself** — don't accept "26/26"/"exit 0" without your own
   run. Confirm the two disclosed `StudentsTab.test.tsx` failures are genuinely unrelated (check
   they're outside this task's Allowed Files and this task's commit didn't touch them).
10. **Astryx prop citations** — spot-check `StatusDot`, `ProgressBar`, `Section`, `Heading`,
    `EmptyState` against `astryx-api.md`.
11. **No box-drawing/bracket characters, no fabricated real-looking PII** — grep sweep yourself.

## Relevant Constitution Excerpts
- Item 17 (BLOCKER-class, no exceptions): no streak counters, "don't break it" mechanics, or
  gamification that could make an excused absence look like a failure.
- Item 3: no re-deriving RLS/metric SQL formulas in TypeScript.
- Item 2: Astryx component usage must stay within the documented API surface.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase)
- commands run
- exact findings
- explicit verdict on the scope-overlap question with T030 (correct call, or should have been a
  dispute?)
- explicit verdict on BEH-06/constitution item 17 compliance
- explicit verdict on the test-file scope question
- required rework if failed
- follow-up tasks if passed with minor issues
