# Checker Packet: T053 (Coach/Admin Home) — Check Attempt 1

## Task ID
T053 — Coach/Admin Home (HOME-01/HOME-04), Epic E9.

## Checker Agent
checker-accessibility (per task-ledger.md T053 row).

## Objective
Verify a HOME-01/HOME-04-compliant `Analytics Dashboard`-template-based dashboard with four
single-metric KPI cards, correct "Start check-in" time-windowing, BEH-01 milestone dedupe, and
HOME-04's admin-only role-gated card — with **every KPI number traced to a legitimate source**,
since this is the first task in the ledger to compute dashboard metrics that don't map 1:1 onto a
single T013 view.

## Allowed Files (worker's literal permitted edit)
- `src/pages/home/CoachHome.tsx` (new)

**Scope flag**: worker also created `CoachHome.test.tsx`, outside the literal Allowed Files line —
same disclosed pattern already ruled in-scope by prior checkers. Re-derive the judgment yourself.

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commit (`ce73de6`) — do NOT
infer authorship from commit messages. Confirm `src/pages/home/StudentHomeSlot.tsx` (T008,
already-Passed, reserved for T054) is byte-unchanged and not imported/referenced. Confirm
`router.tsx` untouched, `guards.tsx` only imported (`useAuth`), never edited. Confirm
`src/lib/supabase/**` untouched.

## Worker's Claimed Changes (do not trust — verify independently)
1. **`Analytics Dashboard` template investigation**: claims `npm run astryx -- template "Analytics
   Dashboard"` fails (not a valid literal id), but `npm run astryx -- search "analytics dashboard"`
   resolves the real id as `dashboard`. Claims it built on `dashboard`'s real structural skeleton
   (`Layout`→`LayoutContent`→`VStack`→`Grid` of `Card`-based metric tiles), but deliberately did NOT
   carry over the template's `recharts`-based chart/table sections since `recharts` isn't installed
   and none of it maps to any HOME-01 requirement — reasoning: fabricating fake chart data to "look
   complete" would itself be fabrication.
2. **THE CENTRAL QUESTION OF THIS CHECK — KPI number sourcing (constitution item 3, BLOCKER-class).**
   Four KPI cards: (a) Team participation %, (b) hours vs. team goal, (c) attendance rate of last
   completed meeting, (d) events in next 7 days. Worker's own disclosed risk #5 states items (b) and
   (c) are "new, non-duplicated formulas" not sourced from any single T013 view, since no
   `v_team_hours`/per-session-attendance-rate view exists in this project's migrations (confirmed:
   only `v_student_hours`, `v_student_participation`, `v_team_participation` exist — grep
   `supabase/migrations/20260717000003_metric_views.sql` yourself). Judge each of the four
   independently:
   - (a) Team participation % — should be a pure passthrough of `v_team_participation.participation_pct`
     (a real, existing, season+team-scoped view). Any deviation from a direct passthrough is
     suspect.
   - (b) Hours vs. team goal — the numerator (confirmed hours) should be a SUM of already-computed
     `v_student_hours.confirmed_hours` values across the team's active students (legitimate
     aggregation of correct per-row numbers, NOT a re-derivation of the underlying hours formula,
     which itself lives entirely inside `v_student_hours`'s SQL and must never be reproduced in
     TS). The denominator (team goal) is business logic with no existing view (sum of
     `students.goal_hours_override` or a season default) — legitimate new logic, not a metric
     re-derivation, but verify it's correct.
   - (c) Attendance rate of last completed meeting — a SINGLE-SESSION present+late/expected
     percentage. This is NOT literally `v_student_participation`'s formula (which is season-scoped
     with excused-shrinks-denominator logic across ALL of a student's sessions) — it's a
     structurally different, narrower metric with no existing view. Computing it fresh is
     defensible (not a "re-derivation" of an existing formula), but it still needs independent
     correctness verification since there's no golden SQL to check it against — in particular,
     confirm whether it correctly excludes excused attendees from the denominator (matching the
     NFR-03 excused-shrinks-denominator precedent established by T013/T014) or not, and whether
     that choice is defensible either way, explicitly disclosed.
3. **60-minute "Start check-in" boundary**: `isSessionCheckInEligible` — live OR
   `0 <= startsAt-now <= 60min`. Claims tests prove: 61 min out → not eligible; 59 min out →
   eligible; exactly 60 min out → eligible (inclusive); live → eligible; ended → not eligible;
   completed/canceled status → never eligible. `selectCheckInSession` additionally filters on
   `type === 'meeting'` + team scope.
4. **BEH-01 milestone dedupe**: same localStorage-key pattern as `OutreachList.tsx`/T038, claims a
   real remount-doesn't-refire test.
5. **HOME-04 admin-only role-gating**: three isolating tests (admin+incomplete-season → card shows;
   coach+identical-data → card absent; admin+complete-season → card absent).
6. **Real Astryx doc-gap found**: claims `Button`'s Example block shows `href="..."` but neither the
   Props table nor the CLI expose an `href` prop — treated as hallucinated (constitution item 2),
   "Start check-in" uses `onClick`+`useNavigate()` instead.
7. Claims 50 new tests pass, 245/245 repo-wide; typecheck/build/lint(scoped) exit 0.
   `format:check` claimed to fail repo-wide ONLY due to two pre-existing, untouched files
   (`renderEmailLayout.ts`, `Kiosk.tsx`) — the worker's own two files pass `prettier --check`
   directly.
8. Disclosed: `PLACEHOLDER_CURRENT_TEAM_ID` stand-in (no coach-to-team linkage in `AuthUser` yet);
   "Start check-in" navigates to a real `/kiosk/:sessionId` route that still resolves to
   `router.tsx`'s inline placeholder (pre-existing, out-of-scope wiring gap).

## Required Verification Steps
1. **Read `CoachHome.tsx` and `CoachHome.test.tsx` in full** — do not rely on the worker's module
   doc or this packet's paraphrasing.
2. **KPI sourcing — trace every one of the four numbers back to its source line by line. This is
   the single most important thing to get right in this check.**
   - Confirm (a) Team participation % is a direct, unmodified passthrough of
     `v_team_participation.participation_pct`-shaped fixture data — grep for any arithmetic on this
     specific value in executable code.
   - Confirm (b)'s numerator is a pure SUM of `v_student_hours.confirmed_hours`-shaped values with
     no re-implementation of the hours formula itself (no `hours_override`/check-in-clamping logic
     duplicated in TS — that must only ever exist inside `v_student_hours`'s SQL). Confirm the
     denominator (team goal) is simple, defensible aggregation (sum of goal overrides / season
     default), not a fabricated number.
   - Confirm (c)'s single-session attendance-rate calculation, read it fully, and render your own
     explicit verdict: is this legitimately a NEW metric (not covered by any T013 view, so
     computing it fresh doesn't violate constitution item 3), or does it in practice reproduce
     enough of `v_student_participation`'s logic to count as a re-derivation? Check specifically
     whether it handles a zero-expected-roster session sensibly (no divide-by-zero / fabricated
     100%), and whether its excused-attendee handling is reasonable and disclosed either way.
3. **60-minute boundary — reproduce or independently verify**, including the exactly-60-minutes
   inclusive edge and the completed/canceled-status exclusion.
4. **BEH-01 dedupe — reproduce or independently verify** the remount-doesn't-refire behavior.
5. **HOME-04 role-gating — reproduce or independently verify** all three isolating cases.
6. **`Analytics Dashboard`/`dashboard` template claim — reproduce the CLI investigation yourself.**
   Run `npm run astryx -- template "Analytics Dashboard"` and `npm run astryx -- search "analytics
   dashboard"` yourself and confirm the worker's account of the id mismatch is accurate. Judge
   whether omitting the `recharts`-based chart/table sections (since `recharts` isn't installed and
   no HOME-01 requirement needs it) is a reasonable, disclosed deviation from "use the template
   as-is" (constitution item 13), or a violation requiring rework.
7. **`Button`'s `href` doc-gap claim** — verify yourself against `astryx-api.md` and the installed
   package/CLI output.
8. **Test-file scope question** — render an explicit verdict, independently re-derived.
9. **Re-run typecheck/lint/build/test yourself** — don't accept "50 new"/"245/245"/"exit 0" without
   your own run. Confirm the `format:check` failure is genuinely caused by pre-existing files this
   task never touched.
10. **BEH-05 KPI card discipline** — confirm each of the four cards is genuinely single-metric-
    primary, no two equal-weight numbers in one card.
11. **No box-drawing/bracket characters, no fabricated real-looking PII** — grep sweep yourself.

## Relevant Constitution Excerpts
- Item 3 (BLOCKER-class, the central question of this check): RLS policies and metric SQL come only
  from PRD Section 8.4, copied verbatim. Re-deriving or duplicating a metric formula in TypeScript
  is a BLOCKER. **Note**: aggregating (summing) already-computed, view-sourced per-row values is NOT
  itself a formula re-derivation — the line to police is whether the underlying computation
  (percentage math, hours-clamping math, excused-denominator-shrinking math) is reproduced in TS,
  not whether any arithmetic at all appears (a plain SUM of correct inputs is fine; recreating how
  those inputs were computed is not).
- Item 13: templates are used as-is — judge the disclosed chart/table omission against this.
- Item 2: Astryx component usage must stay within the documented API surface.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase)
- commands run
- exact findings
- **explicit, separate verdict for EACH of the four KPI cards** on constitution item 3 compliance
- explicit verdict on the template-as-is question (chart/table omission)
- explicit verdict on the test-file scope question
- required rework if failed
- follow-up tasks if passed with minor issues
