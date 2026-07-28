# Worker Packet: T128

## Task ID
T128 — wave-3 debt batch: format gate, label honesty, Astryx doc accuracy,
planned-hours future guard.

## Objective
Four small, independent items. Each has a named origin — do exactly what it
asks, nothing adjacent.

1. **Format gate green (T120 debt):** run `prettier --write` on
   `src/pages/meetings/StudentMeetingView.test.tsx` and
   `src/pages/reports/ParticipationTab.test.tsx`. The diff must be
   whitespace/formatting ONLY (verify: tests pass before and after,
   `git diff -w` on both files is empty). Repo `format:check` must go green
   tree-wide.
2. **Meetings hours label (T122 NIT):** in `MeetingsList.tsx` the coach row
   renders "Nh planned · Nh logged"; "logged" collides with volunteer
   "hours logged" vocabulary. Reword to scheduled-duration language (e.g.
   "Nh scheduled · Nh held" — final wording yours, but it must not use
   "logged" and must stay compact). Update the row tests that pin the label;
   change nothing else in the file.
3. **`docs/swarm/astryx-api.md` accuracy (T123 finding):** the doc's
   `AppShell`/`Section` entries claim a semantic `<main>` landmark; the
   installed source renders `<div role="main">` (verified during T123 —
   see `src/app/AppShell.test.tsx` module doc). Correct the doc against
   `node_modules/@astryxdesign/core` installed source (read it, don't trust
   the CLI), and while in the file fix ONLY entries you can verify against
   source; note anything else suspicious without editing it.
4. **Planned-hours future guard (T124 NIT):** new migration
   `supabase/migrations/20260724000001_planned_hours_future_guard.sql` —
   `create or replace view public.v_planned_rsvp_hours` re-stating the
   shipped definition (20260723000001 — NEVER edit that file) with one added
   predicate: `es.starts_at >= now()`. Rationale in the header: a
   scheduled-but-past session is no longer a plannable commitment; the old
   header comment already claimed "future". Column list must be IDENTICAL
   (Postgres requires it for `create or replace view`; also its dependents
   `v_student_goal_projection` / `v_season_upcoming_committed_hours` — check
   which views actually select from it and scratch-verify each dependent
   still returns correct rows). Scratch-verify: a past scheduled session's
   hours vanish from planned/projection "planned", confirmed hours
   unaffected, 30-day window view unchanged in output (its own window
   already excluded the past).

## Allowed Files
- `src/pages/meetings/StudentMeetingView.test.tsx` (prettier only)
- `src/pages/reports/ParticipationTab.test.tsx` (prettier only)
- `src/pages/meetings/MeetingsList.tsx`, `MeetingsList.test.tsx` (label only)
- `docs/swarm/astryx-api.md`
- `supabase/migrations/20260724000001_planned_hours_future_guard.sql` (new)

## Forbidden Files
- Everything else. Three siblings are mid-flight on outreach/forms/home
  files — do not touch any outreach page, dialog, loader, or
  `src/components/forms/**`. Never edit a shipped migration. Never
  `git stash`.

## Traps
1. Item 2 changes user-visible copy — motivation-ethics quick check applies
   (neutral wording).
2. Item 4 is metric-adjacent: the ONLY change is the one predicate; any
   other formula token difference from the shipped view is a BLOCKER.
   Diff your view body against the shipped one token-by-token and include
   that diff in your output.
3. `loaders/dashboard.ts` and `CoachHome` consume these views via
   passthrough — confirm zero TS changes needed (column list identical) and
   that the full suite stays green.

## Required Output
Per-item diff + evidence (prettier-only proof, label test update, doc
corrections list with source citations, view token diff + scratch
transcript); gate output; risks.
