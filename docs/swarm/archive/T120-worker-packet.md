# Worker Packet: T120

## Task ID
T120 — dual-member row-multiplicity fixes in Reports + check-in consistency
strips (T116's checker-verified consumer-risk findings #1 and #3).

## Objective
T116's membership views emit one `v_student_participation` row per (student,
membership-team). Two consumers mishandle that:
1. `src/pages/reports/ParticipationTab.tsx` `buildDisplayRows` (~line 448)
   keys its metric Map by `studentId` alone — a dual member's second team row
   silently overwrites the first. Fix: key by `(studentId, teamId)` and join
   accordingly (the tab already renders per-team rows — investigate its exact
   shape before choosing key-vs-aggregate; document).
2. `src/lib/supabase/loaders/checkin.ts` `queryParticipationForStudent`
   (~239-251) uses `.eq('student_id', …).limit(1)` — arbitrary team for dual
   members. Fix minimally and honestly: aggregate across the student's rows
   (sum counts, recompute nothing — sum the view's own counters and derive pct
   the same way the VIEW does, or better: pick the row for the team in
   context if a teamId is available at the call site; investigate the caller,
   choose the honest option, document). The twin in `loaders/meetings.ts` is
   OWNED BY SIBLING T122 — do not touch it.

## Allowed Files
- `src/pages/reports/ParticipationTab.tsx`, `ParticipationTab.test.tsx` (create if absent — ED-2 notes it's missing)
- `src/lib/supabase/loaders/reports.ts`
- `src/lib/supabase/loaders/checkin.ts`
- `src/pages/meetings/StudentMeetingView.test.tsx` (checkin loader tests live here)

## Forbidden Files
- `loaders/meetings.ts`, `MeetingsList.*` (T122), all outreach files (T121),
  `AppShell/KpiStrip` (T123), `CoachHome` (T124), `supabase/**`, `docs/swarm/**`.

## Traps
- Constitution item 3: never re-derive the participation formula in TS. If you
  aggregate across team rows, sum the view's counters and compute pct exactly
  as the view's own expression (cite it) — or avoid TS arithmetic entirely by
  scoping to a team. Prefer the no-arithmetic option where the call site
  allows.
- Dual-member fixtures in every new test (10h/percentages must not
  double-count or last-team-win).
- Four sibling tasks are mid-flight on disjoint files — attribute noise
  honestly; never `git stash`.

## Required Output
Full diff; your key-vs-aggregate decisions with reasoning; gate output; risks.
