# Worker Packet: T050

## Task ID
T050 — Weekly digest template (EML-02 row 6), Epic E8.

## Objective
Build `src/emails/templates/weekly-digest.tsx`: a parent-facing weekly digest — per linked
student: last week's attendance, hours vs. goal, next week's schedule. Sent Sundays 5pm CT (the
actual cron scheduling is T051's job, separate and currently Blocked — this task builds the
rendered content only).

## Dependencies (status)
- T048 (Resend integration + branded layout + `email_log`) — Passed. Same `renderEmailLayout`
  wrapper contract as T049 — read `src/emails/layout/renderEmailLayout.ts`/`constants.ts` in full
  first. This task is dispatched in parallel with T049; if T049 has landed by the time you read
  this, read its five templates (read-only) for the established `.tsx`-extension-vs-JSX resolution
  (see Known Context/Traps #1 below) and match its choice for consistency — do not independently
  redecide the same question differently.
- T013 (metric views) — Passed. **Ground truth for hours-vs-goal**: `v_student_hours`
  (`supabase/migrations/20260717000003_metric_views.sql` lines 3-18) computes `confirmed_hours`
  per `(student_id, season_id)` — never recompute this SUM yourself (constitution item 3, BLOCKER
  if violated); your template's props must carry an already-computed `confirmedHours` number, not
  raw attendance rows. The GOAL side (`goal_hours_override ?? seasons.default_goal_hours`) has NO
  SQL view of its own — this is the exact same situation `StudentHome.tsx`/`ParentHome.tsx`/
  `CoachHome.tsx` already resolved (their own `resolveGoalHours`/`studentGoalHours` +
  `hoursVsGoalPercent` helper pair, all independently checker-approved this session) — read one of
  those three files for the established pattern and reuse the same shape rather than inventing a
  fourth version.

## Allowed Files
- `src/emails/templates/weekly-digest.tsx` (new)
- A colocated `weekly-digest.test.tsx` is acceptable per established precedent — disclose it.

## Forbidden Files
- `src/emails/layout/**` — read-only reference only (import `renderEmailLayout`/its constants, do
  not edit).
- `src/emails/templates/invite.tsx`, `signup-confirm.tsx`, `event-reminder-48h.tsx`,
  `event-reminder-3h.tsx`, `meeting-reminder-3h.tsx` — a separate, parallel task's files (T049),
  read-only reference only if present.
- `src/pages/home/**` — read-only reference only (for the goal-hours helper pattern).
- `supabase/functions/send-reminders/**` — does not exist yet (T051, separate, Blocked). No cron/
  scheduling/send logic here.
- `src/lib/supabase/**` — read-only reference only, do not import directly.
- `supabase/migrations/**` — read-only.
- `docs/swarm/**`, `.claude/**`, `src/theme/**`.

## Known Context / Traps

**1. `.tsx`-extension resolution — match T049's choice if it exists, otherwise make and disclose
your own.** Same tension T049's packet documents in full: T048's `renderEmailLayout.ts`/
`constants.ts` are deliberately plain TS (no JSX) so they're importable unchanged from the Deno
`send-reminders`/`send-invite` runtime; a JSX-based renderer is not on the constitution item 9
dependency allowlist. Resolve consistently with T049 (check if it has landed and follow its
pattern) rather than independently reinventing the answer.

**2. EML-05 is BLOCKER-class for THIS template specifically — "a parent digest covers only linked
students, never another family's data."** This is the PRD's own literal EML-05 wording and this
task is the ONE template in the whole EML-02 set that structurally handles multiple students in a
single email (per-kid breakdown for however many children a parent has linked). Your template's
props interface must take an array scoped to exactly the calling parent's own linked students — no
"all students" fallback, no cross-family data ever reachable from a single props object. Prove this
with a real test: render the digest for a parent with 2 linked students and assert the OTHER
fixture family's student name/data never appears anywhere in the output (same class of proof
`ParentHome.tsx`'s multi-linked-student independence tests already used this session).

**3. Hours vs. goal — reuse the established pattern, don't recompute `confirmed_hours`.** Per
Dependencies above: `confirmedHours` is a prop (sourced from `v_student_hours`, never summed in
this file), `goalHours = goalHoursOverride ?? defaultGoalHours` (a plain nullish-coalesce, not a
formula), and the percent-to-goal uses the same `hoursVsGoalPercent`-style clamped ratio already
established and checker-approved in `StudentHome.tsx`/`ParentHome.tsx`/`CoachHome.tsx`. If any
BEH-01/BEH-02-style confirmed-vs-planned distinction is relevant to what you render, keep them
NEVER summed into one number, same rule every prior task in this batch has followed.

**4. "Last week's attendance" and "next week's schedule" — define your own week boundaries and
disclose them.** No PRD text pins down whether "last week" is the trailing 7 days from send time
or a Sun-Sat calendar week (relevant since sends are Sundays 5pm CT per EML-02) — state your
interpretation explicitly (a Sun-Sat calendar week aligned to the Sunday send time is the more
defensible reading, but this is your judgment call to make and disclose, not silently assume).

**5. BEH-01/BEH-02 apply to any progress display in this email** — no inflated totals, no summed
confirmed+planned into a single misleading number, milestone framing (if any) matches the same
25/50/75/100% pattern already established in `OutreachList.tsx`/home dashboards, not invented
independently.

**6. No shared Supabase client wired in, no real send path — deliberate scope.** Pure function of
typed props (parent name, an array of per-student digest data), obviously-fake fixture in your own
test file — same posture as T049 and every prior content-page task.

## Acceptance Criteria
- Per-linked-student breakdown: last week's attendance, hours vs. goal, next week's schedule.
- **EML-05 (BLOCKER if violated)**: proven, real test that a multi-child digest never leaks another
  family's data.
- `confirmedHours` sourced from `v_student_hours` only, never recomputed; goal-hours resolution
  matches the established `resolveGoalHours`/`hoursVsGoalPercent` pattern.
- BEH-01/BEH-02 never-summed rule respected in any progress display.
- Week-boundary interpretation explicitly disclosed.
- No box-drawing/bracket characters (constitution item 13).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` all exit 0.

## Relevant Constitution Excerpts
> 3. RLS/metric SQL formulas are never re-derived in TypeScript; UI reads already-computed view
> columns. → BLOCKER if violated. *(Cited because `confirmed_hours` must come from `v_student_hours`
> unchanged.)*

> 6. No PII; test fixtures use fabricated names only. *(Cited because EML-05's multi-family proof
> test needs two clearly-fabricated, clearly-distinct family fixtures.)*

## Most Recent Failure
None. This is attempt 1 for T050 (attempt count: 0).

## Required Worker Output
- Full contents of `weekly-digest.tsx`.
- Explicit write-up of the EML-05 cross-family-leakage proof test.
- Explicit write-up of the `.tsx`-extension decision and the week-boundary interpretation.
- Real test proof of the hours-vs-goal rendering matching the established helper pattern.
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
