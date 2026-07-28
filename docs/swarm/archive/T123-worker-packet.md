# Worker Packet: T123

## Task ID
T123 — UXP-05: persistent KPI strip on every coach/admin page (UXD-01).

## Objective
Reference: capability map "Dashboard" KPI cards (binding figure). A shared
`KpiStrip` rendered in the app chrome for staff viewers on every routed page:
season hours (with meetings/outreach/competition breakdown), active students
(per-team split), events logged (+ most recent title), % toward season goal.
Skeleton while loading (never a blank band), honest empty/error states,
compact — it must not crowd the page (UXD-05).

## Allowed Files
- `src/components/kpi/KpiStrip.tsx`, `KpiStrip.test.tsx` (new)
- `src/lib/supabase/loaders/kpi.ts` (new)
- `src/app/AppShell.tsx`, `AppShell.test.tsx` (mount point)
- `supabase/migrations/20260723000000_kpi_views.sql` (new — ONLY if needed per
  Trap #1)

## Forbidden Files
- `TopNav.tsx`/`SideNav.tsx` (the strip is layout content, not nav chrome —
  mount via AppShell's own content region), CoachHome (T124), all
  outreach/meetings/reports files (T120-T122), `docs/swarm/**`.

## Traps
**1. Constitution item 3 — metric math in SQL only.** Season-hours totals and
%-toward-goal involve real aggregation. Prefer a tiny additive migration
creating `v_season_kpis` (or reuse `v_team_hours`/`v_student_hours` with
ONLY passthrough/count aggregation in TS if you can justify it as
presentation-level counting, citing T044's sort/slice precedent — if in ANY
doubt, write the view; scratch-verify it like every prior view migration).
Goal target = sum of members' goal hours (default + overrides) or
`seasons.default_goal_hours × active students` — investigate which matches
the reference app's "337.75 / 1800h target" semantics; document.
**2. Chrome placement.** Staff-only, active-season-scoped (`useActiveSeason`),
never rendered for student/parent or on chromeless routes. AppShell edits are
allowed but keep the chromeless branch and SeasonProvider mounting intact
(T115 verified that structure — don't regress it).
**3. One fetch per page load,** cached/shared — not per-component refetch
storms. Astryx props verified; both themes; UXD-09.
**4. Four siblings mid-flight; migration timestamp is yours alone; never
`git stash`.**

## Required Output
Full diff (+ migration SQL if written, with scratch verification); the
goal-target semantics decision; gate output; risks.
