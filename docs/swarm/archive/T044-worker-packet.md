# Worker Packet: T044

## Task ID
T044

## Objective
Build `src/pages/outreach/Leaderboard.tsx` — a `Section` on `/outreach`, top 10 students by season
volunteer hours, visible to all roles. Names render as "First L." (first name + last-initial) when
the privacy toggle (T028) is ON — the stated default (SEC-04/ROS-08).

## Dependencies (status)
- T038 (`/outreach` list), T013 (metric views) — both Passed. Read `OutreachList.tsx` (read-only)
  for established fixture conventions.
- T028 (Roster admin toggles) — **listed as this task's conceptual dependency for the privacy
  setting, though not a hard ledger dependency.** Read `docs/swarm/active/T028-worker-packet.md` (or,
  if T028 has since Passed, `AdminToggles.tsx` itself, read-only) — **T028 found a genuine schema
  gap: there is no real database column anywhere that persists the leaderboard-privacy setting.**
  This task inherits the same gap. Build your privacy-toggle consumption against the same kind of
  injectable `loadPrivacySetting`-style seam T028 used (or will use), **defaulting to ON** (per
  SEC-04/ROS-08's stated default), and disclose this exactly as T028 did — do not silently assume a
  real setting exists to read from.

## Allowed Files
- `src/pages/outreach/Leaderboard.tsx` (new — confirm via `Glob` this doesn't exist yet)
- A colocated `Leaderboard.test.tsx` is acceptable per established precedent — disclose it.

## Forbidden Files
- `src/pages/outreach/OutreachList.tsx`, `OutreachEventDialog.tsx`, `RsvpControl.tsx`,
  `OutreachDetail.tsx`, `MarkDayCompleteDialog.tsx`, `ParentRsvp.tsx` — already-Passed/sibling
  tasks' files, read-only reference only.
- `src/pages/roster/AdminToggles.tsx` — a separate, not-yet-built task (T028), read-only reference
  only if it exists by the time you're dispatched.
- `src/app/router.tsx`, `src/app/guards.tsx` (import-only) — read-only.
- `src/lib/supabase/**` — read-only reference only, do not import directly. Build against an
  injectable `loadData`-style seam with obviously-fake fixture defaults.
- `supabase/migrations/**` — read-only.
- `docs/swarm/**`, `.claude/**`, `src/theme/**`.

## Ground Truth — real schema (read the actual file yourself, do not guess column names)
`v_student_hours`: `student_id`, `season_id`, `confirmed_hours` —
`20260717000003_metric_views.sql` lines 3-19. This is the ONLY legitimate source for the hours
number this leaderboard ranks by.

## Known Context / Traps

**1. Constitution item 3 (BLOCKER-class) — hours sourced from `v_student_hours` only.** Your
"top 10" logic is a sort + slice(0,10) over already-computed `confirmed_hours` values from a
view-shaped fixture — this is legitimate ranking logic, NOT a re-derivation of the hours formula
itself (same "aggregation is fine, re-deriving the underlying computation is not" distinction
`CoachHome.tsx`/T053's checker already scrutinized closely for a similar case). Grep your own file
for any `hours_override`/`check_in_at`/`check_out_at` reference — zero hits should exist outside
comments, confirming you never reproduce `v_student_hours`'s real formula.

**2. SEC-04/ROS-08 "First L." format — BLOCKER-class, get this exactly right.** When the privacy
toggle is ON (the default), every rendered name must be first-name + a single capital initial +
period (e.g. "Ada Q."), NEVER a full last name, not even truncated-but-recognizable variants.
Prove this with a real test using a fixture student whose real (fabricated, per constitution item 6)
full name has a distinctive last name, and assert the literal rendered string matches the "First L."
pattern exactly, with the full last name asserted absent from the DOM entirely — this is the same
rigor `Kiosk.tsx`/T034 and `OutreachList.tsx`/T038 applied to their own zero-PII/name-format
requirements.

**3. When the toggle is OFF**, render full names — but confirm this reading against T028's actual
established toggle semantics once you have visibility into it (its label is "Show first name + last
initial publicly" — ON means the privacy-preserving abbreviated form is shown, per your own reading
of this task's packet; OFF means... investigate what OFF actually implies given the toggle's label
literally describes the ON-state behavior. State your reading explicitly — this is a real,
non-obvious semantic question worth getting right, not assuming).

**4. "All roles" visibility** — unlike most of this batch's coach/admin-gated pages, this component
is visible to every role (student, parent, coach, admin) per OUT-08's own text. Do not add any
`RequireRole` gate here.

**5. No shared Supabase client wired in — deliberate scope, not a gap for you to solve.** Same
posture as every prior content page.

## Acceptance Criteria
- **BLOCKER-class (SEC-04/ROS-08):** zero last-name leakage when the privacy toggle is ON (the
  default) — proven with a real, name-format-asserting test, not just a screenshot.
- Top 10 by season volunteer hours, sourced from `v_student_hours` only, zero formula re-derivation
  (constitution item 3, BLOCKER-class).
- Toggle OFF behavior explicitly investigated and disclosed.
- Visible to all roles, no role gate.
- No box-drawing/bracket characters rendered (constitution item 13).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` all exit 0.

## Relevant Constitution Excerpts
> 3. RLS policies and metric SQL come **only** from PRD Section 8.4, copied verbatim. Re-deriving
> either, or duplicating a metric formula in TypeScript (PRD DATA-01) → BLOCKER.

> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md`. A prop absent from that
> file is presumed hallucinated → MAJOR.

> 6. No PII... test fixtures use fabricated names. *(This task's whole point is enforcing this rule
> at the UI level for a public-facing surface — get it right.)*

## Most Recent Failure
None. This is attempt 1 for T044 (attempt count: 0).

## Required Worker Output
- Full contents of `Leaderboard.tsx`.
- Explicit write-up of the toggle-OFF semantic investigation (Known Context/Traps #3).
- Real test proof of the "First L." name-format enforcement (full last name provably absent from
  the DOM when the toggle is ON).
- Real test proof of the top-10 sort/slice logic against `v_student_hours`-shaped fixture data.
- Astryx prop citations for every component used — grep `astryx-api.md` yourself, don't guess.
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
