# Checker Packet: T055 (Parent Home) — Check Attempt 1

## Task ID
T055 — Parent Home (HOME-03), Epic E9.

## Checker Agent
checker-accessibility (per task-ledger.md T055 row).

## Objective
Verify one `Card` per linked student with correctly-handled multi-child parents, a defensible
ConsistencyStrip-reuse decision (BLOCKER-class BEH-06 territory), a proven "next 3 events" boundary,
and an RSVP-on-behalf control correctly scoped short of T043's real job.

## Allowed Files (worker's literal permitted edit)
- `src/pages/home/ParentHome.tsx` (new)

**Scope flag**: worker also created `ParentHome.test.tsx`, outside the literal Allowed Files line —
same disclosed pattern already ruled in-scope by every prior checker in this batch. Re-derive the
judgment yourself.

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commit (`6b761f7`) — do NOT
infer authorship from commit messages. Confirm `StudentMeetingView.tsx` (T037, already-Passed) is
byte-unchanged — the worker claims it imports `ConsistencyStrip` and `selectLastCompletedAttendance`
from it directly, never edits it. Confirm `CoachHome.tsx`, `OutreachList.tsx`, `StudentHome.tsx`,
`router.tsx`, `guards.tsx` (import-only), `src/lib/supabase/**` all untouched.

## Worker's Claimed Changes (do not trust — verify independently)
1. **ConsistencyStrip reuse decision (the central judgment call)**: worker claims it deliberately
   included the real, already-checker-verified `ConsistencyStrip` component (imported directly, plus
   its `selectLastCompletedAttendance` pure function — claims zero new attendance-selection logic
   written). Reasoning claimed: HOME-03's own field list/wireframe don't separately show a dot-strip,
   but BEH-06 (constitution item 17, BLOCKER-class) explicitly names HOME-03 by name as a required
   consumer of the last-5-meetings strip — worker resolved this by having `ConsistencyStrip` serve
   as HOME-03's "participation %" field AND the BEH-06 meeting-history element simultaneously, rather
   than rendering participation twice.
2. **Multi-linked-student architecture**: claims it matches `StudentMeetingView.tsx`'s own
   `variant="linked"` two-tier design — an outer `loadLinkedStudents()` seam resolves the roster,
   then each student gets an independent `StudentHomeCard` with its own `loadData(studentId,
   teamId)` call and its own DES-12 states (no shared loading gate). Claims tests prove one card can
   be `loading` while a sibling is `populated`, and one can `error` while a sibling stays populated.
3. **"Next 3 events" boundary**: `buildNextEventsForStudent` claimed pure and exported, tested for
   5-qualifying-sessions→exactly 3 nearest-first, 1 session→exactly 1 (no padding), 0 sessions→`[]`,
   competition-type excluded even when dated earliest, wrong-team excluded, already-ended/non-
   scheduled excluded.
4. **RSVP-on-behalf scope**: claims a real `SegmentedControl` per outreach next-up row wired to
   local-only state updates (immediate `aria-checked` flip, tested); meeting-type rows render
   read-only. Claims NO Supabase persistence and NO "Mom signed you up"/`responded_by` attribution
   copy anywhere — explicitly left for T043, with the `respondedBy` field present on the row type
   for schema fidelity but never read/rendered.
5. **Metric sourcing (constitution item 3)**: `findConfirmedHours`/`findParticipationMetric` claimed
   pure lookups (never recompute) against `v_student_hours`/`v_student_participation`-shaped
   fixtures; the `v_student_participation` TYPE is claimed imported verbatim from
   `StudentMeetingView.tsx`, never redefined. Claims zero `100.0 *`/`/ greatest(`/arithmetic touching
   `participationPct` in executable code.
6. Footer note copy claimed verbatim: "You get a weekly summary by email every Sunday — manage in
   Settings."
7. Claims 338/338 tests pass (31 new); typecheck/build/lint(scoped) exit 0. Claims `format:check`'s
   repo-wide failure is caused by two pre-existing, unrelated files (`renderEmailLayout.ts`,
   `Kiosk.tsx`, confirmed via git status/log as untouched, from T034).

## Required Verification Steps
1. **Read `ParentHome.tsx` and `ParentHome.test.tsx` in full** — do not rely on the worker's module
   doc or this packet's paraphrasing.
2. **ConsistencyStrip reuse decision — the central judgment call of this check.** Confirm by direct
   import-statement read that `ConsistencyStrip`/`selectLastCompletedAttendance` are genuinely
   imported from `StudentMeetingView.tsx`, not reimplemented. Render your own explicit verdict: is
   using `ConsistencyStrip` to simultaneously satisfy HOME-03's "participation %" field AND BEH-06's
   meeting-history requirement a defensible reading, or does it stretch HOME-03's literal spec too
   far? A checker could reasonably disagree with this call (the worker itself disclosed this) — form
   your own independent position with reasoning, don't just accept or reject it reflexively.
3. **BLOCKER-class BEH-06 — re-verify by source read, don't just trust that reusing a Passed
   component makes this automatically safe.** Confirm the imported `ConsistencyStrip` is genuinely
   used unmodified (no wrapper logic re-introducing streak-shaped behavior around it).
4. **Multi-linked-student independence — reproduce or independently verify.** Confirm each student
   card's loading/error/populated state is genuinely independent (one card's error state must not
   propagate to or block a sibling's render).
5. **"Next 3 events" boundary — re-derive independently**, including the competition-type-exclusion
   and wrong-team-exclusion cases specifically (these are easy to get subtly wrong).
6. **RSVP-on-behalf scope — confirm the claimed absence is real.** Grep the file yourself for
   `responded_by`/"signed you up"/any Supabase write call — confirm genuinely zero persistence
   attempts and zero attribution copy, matching the disclosed T043 deferral.
7. **Constitution item 3 — re-verify independently**, same rigor `CoachHome.tsx`/T053's checker
   applied: confirm the `v_student_participation` type is genuinely imported, not redefined
   (a redefinition risks silent drift from the real view's columns over time even if currently
   identical).
8. **Footer copy — confirm exact match**, not a paraphrase.
9. **Astryx prop citations** — spot-check `Card`, `Heading`, `Badge`, `ProgressBar`,
   `SegmentedControl`/`SegmentedControlItem`, `List`/`ListItem`, `EmptyState` against `astryx-api.md`.
10. **Test-file scope question** — render an explicit verdict, independently re-derived.
11. **Re-run typecheck/lint/build/test yourself** — don't accept "338/338"/"exit 0" without your own
    run. Confirm the `format:check` baseline claim is genuine.
12. **No box-drawing/bracket characters, no fabricated real-looking PII** — grep sweep yourself.

## Relevant Constitution Excerpts
- Item 17 (BLOCKER-class): no streak counters/"don't break it" mechanics/loss-aversion framing —
  applies to the reused `ConsistencyStrip`, already proven compliant by T037's own check, but
  re-verify it's genuinely unmodified here.
- Item 3 (BLOCKER-class): no re-deriving RLS/metric SQL formulas in TypeScript.
- Item 2: Astryx component usage must stay within the documented API surface.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase)
- commands run
- exact findings
- explicit verdict on the ConsistencyStrip-reuse/scope decision
- explicit verdict on multi-linked-student independence
- explicit verdict on the test-file scope question
- required rework if failed
- follow-up tasks if passed with minor issues
