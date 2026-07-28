# Worker Packet: T121

## Task ID
T121 — UXP-04 (outreach half) + T118's wiring follow-ups: dense outreach event
rows with expand-in-place and inline actions, real roster into the pages,
edit-mode expected-attendees prefill.

## Objective
Reference standard: capability map "Events tab" figure (UXD-02/03/04) —
binding. Rework `OutreachList`'s rows: date/range + per-day chips, title +
badge, LOCATION (already real columns — surface them), planned/logged hours,
expected/attended counts, inline Edit (opens the existing dialog in edit mode)
and Cancel affordances, plus a "+" expander revealing per-session detail
(dates, times, RSVP names) in place. Keep the existing "View details" links
(T112). Also: (a) wire the real `loadOutreachEventRoster` (T118, built/tested,
unconsumed) into `OutreachList`/`OutreachDetail`'s `students` props replacing
placeholder rosters; (b) edit-mode prefill — when opening the dialog to edit,
supply `initialEvent.expectedStudentIds` derived from the event's existing
`'going'` RSVPs (investigate the cleanest source: detail page already loads
RSVPs); (c) fix the stale prose comment `OutreachDetail.test.tsx:76`
(references removed `resolveUnmarkAction`); (d) UXD-05: fix the triple-labeled
"Team season goal" section (one heading, compact bars/tiles).

## Allowed Files
- `src/pages/outreach/OutreachList.tsx`, `OutreachList.test.tsx`
- `src/pages/outreach/OutreachDetail.tsx`, `OutreachDetail.test.tsx`
- `src/lib/supabase/loaders/outreach.ts` (row-stat enrichment for
  `loadOutreachData` — counts/hours per event — and prefill support)

## Forbidden Files
- `OutreachEventDialog.tsx` (read-only — prefill goes through its existing
  `initialEvent` prop), `AttendancePanel.*`, `loaders/attendance.ts` (T117,
  read-only), all meetings files (T122), KPI/AppShell (T123), CoachHome
  (T124), `supabase/**`, `docs/swarm/**`.

## Traps
- Expected/attended/hours per row: derive from real queries in
  `loadOutreachData` (RSVP counts, attendance counts, session hours) — sums
  of raw counts are fine; NEVER re-derive metric-view formulas (constitution
  item 3). Watch query fan-out: prefer one batched query per table over
  N-per-event.
- Astryx ListItem non-interactivity constraint (module doc #10 precedent):
  expander + inline actions live in endContent/structured slots — follow
  T112's pattern; expander state per row, keyboard accessible (UXD-09).
- `seasonId` resolution (T106) must stay intact.
- Four siblings mid-flight on disjoint files; attribute noise honestly; never
  `git stash`.

## Required Output
Full diff; row-density comparison vs the reference figure (honest);
enrichment query shape; gate output; risks.
