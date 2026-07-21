# Worker Packet: T122

## Task ID
T122 — UXP-04 (meetings half): dense meeting rows with expand-in-place +
inline actions, plus `loaders/meetings.ts`'s dual-member `.limit(1)` fix
(T116 consumer finding #2).

## Objective
Reference: capability map "Events tab" figure (UXD-02/03/04). Rework
`MeetingsList`'s coach-view rows to the density standard: date/recurrence
chips, title, location (real columns), planned/logged hours, expected/attended
counts, inline Cancel (already real — keep) and expander revealing
per-session detail in place. Student view: keep its existing shape (it serves
a different persona) but apply UXD-05 space rules where violated. Also fix
`queryParticipationForStudent` (~line 325-337): `.limit(1)` picks an arbitrary
team row for dual members — same honest options as T120's twin (team-scope if
the call site has a team, else aggregate summing the view's own counters with
pct computed exactly as the view's expression, cited; prefer no-arithmetic).

## Allowed Files
- `src/pages/meetings/MeetingsList.tsx`, `MeetingsList.test.tsx`
- `src/lib/supabase/loaders/meetings.ts`

## Forbidden Files
- `StudentMeetingView.*`, `loaders/checkin.ts` (T120), all outreach files
  (T121), KPI/AppShell (T123), CoachHome (T124), `ScheduleMeetingsDialog.tsx`
  (read-only), `supabase/**`, `docs/swarm/**`.

## Traps
- `MeetingsList` has the T096 circular-import precedent with
  `loaders/meetings.ts` — preserve the hoisted-function pattern; don't break
  it.
- Row stats from real batched queries; no metric-formula re-derivation
  (constitution item 3).
- Astryx ListItem constraint per T112's pattern; expander keyboard-accessible.
- Dual-member fixtures in the participation-fix tests.
- Four siblings mid-flight; attribute noise honestly; never `git stash`.

## Required Output
Full diff; density comparison vs reference; `.limit(1)` fix decision; gate
output; risks.
