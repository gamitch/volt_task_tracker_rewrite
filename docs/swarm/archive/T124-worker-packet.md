# Worker Packet: T124

## Task ID
T124 — UXP-06 + UXP-10: coach dashboard analytics parity + activity feed.

## Objective
Reference: capability map "Dashboard" figure (binding — the full page).
Overhaul `CoachHome` to add: secondary stat tiles (avg hours/active student,
students at goal, session days logged, attendance rate, upcoming 30-day
committed hours, busiest day); per-student **goal projection** (stacked
confirmed+planned vs goal line, honest "on track / N h short" annotations,
All/Below-goal filter); **hours by team** (consume T116's `v_team_hours` —
built, unconsumed); **top events by student hours**; and the **activity feed**
(RSVP signup/drop/attendance entries, relative timestamps, self-vs-staff
origin from `responded_by`/`recorded_by`, "show all"). Keep the existing
next-up/check-in/season-setup cards; compose per UXD-05 (tiles over stacked
bars, no duplicate headings).

## Allowed Files
- `src/pages/home/CoachHome.tsx`, `CoachHome.test.tsx`
- `src/lib/supabase/loaders/dashboard.ts` (new)
- `supabase/migrations/20260723000001_dashboard_views.sql` (new — expected;
  see Trap #1)

## Forbidden Files
- `AdminHome/StudentHome/ParentHome` (follow-ups if needed), KPI/AppShell
  (T123), outreach/meetings/reports files (T120-T122), `guards.tsx`,
  `docs/swarm/**`.

## Traps
**1. Constitution item 3.** Stat-tile math (attendance rate, busiest day, avg
hours, projection inputs) is real formula territory → additive views in your
migration (scratch-verified with dual-member fixtures per D-3 — team-scoped
numbers double-count by membership, personal numbers count once; cite T116's
precedent). TS may only sort/slice/format view outputs (T044 precedent).
**2. Motivation ethics (BLOCKER-class).** Projection annotations state facts
("44h short"), never guilt/urgency; Below-goal filter is coach-facing
triage, no ranking-shame framing; feed has no read-receipts. This page is
coach-only — verify role dispatch keeps it so.
**3. Feed derivation.** `rsvps`/`attendance` rows + timestamps +
`responded_by`/`recorded_by` vs student profile → self/staff labels. If
hard-deletes (T119) erase feed history, show current-state-derived entries
honestly and note the limitation — do NOT add tracking tables.
**4. Goal source:** `seasons.default_goal_hours` + `students.goal_hours_override`
(both real). Projection "planned" = future `'going'` RSVP hours — investigate
the honest computation and put it in SQL.
**5. Four siblings mid-flight; your migration timestamp is yours alone; never
`git stash`.**

## Required Output
Full diff + migration SQL with scratch verification (dual-member fixtures);
figure comparison (honest); feed-derivation notes; gate output; risks.
