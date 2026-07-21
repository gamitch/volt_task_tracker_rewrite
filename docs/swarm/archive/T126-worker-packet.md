# Worker Packet: T126

## Task ID
T126 — UXP-03: retroactive student/parent check-off, with its own additive
self-write migration ('self' method + RLS).

## Objective
A signed-in student (or parent for a linked student) can mark past-event
attendance from their existing event surfaces: pick a past event, pick days
for multi-day events, get default hours; the record is labeled `'self'` and
a coach can amend/remove it via the existing UXP-01 panel. Constitution item
17: copy stays strictly neutral — no nagging, no "you forgot", no urgency.

### Part A — migration `supabase/migrations/20260724000000_self_checkoff.sql`
1. Widen `attendance.method`: the shipped inline check is
   `method in ('qr','coach','import')` (20260717000000, line ~90 — NEVER edit
   that file). Drop the existing check constraint by its real name (verify
   the auto-generated name in scratch Postgres via `pg_constraint` — do not
   guess) and re-add including `'self'`.
2. Self-write policies on `attendance` (RLS matrix deliberately omitted them
   in v1 — the file's own comment says self check-ins were Edge-Function-only;
   this task is the sanctioned change):
   - INSERT: `student_id in (select my_student_ids()) and method = 'self'
     and recorded_by = auth.uid()`.
   - DELETE (own mistake correction): same student scope AND `method='self'`
     only — a student/parent can never remove qr/coach/import rows.
   - NO update policy (keep it simple: delete + re-insert).
3. Scratch-verify positive AND negative: student inserts self for own row;
   parent via guardian link; cannot insert method 'coach'/'qr'; cannot write
   another student's row; cannot delete a coach/qr/import row; staff_all
   unaffected; checkin Edge Function path (service role) unaffected.
4. Default hours: insert with `hours_override` NULL and no check-in/out —
   verify in scratch that `v_student_hours` then credits the session-length
   branch (that IS the "default hours"; no new hours math anywhere).

### Part B — UI
Investigate the real student surfaces (student view of `OutreachList` has
past events; `StudentHome` lists events; parents use `ParentRsvp`). Add the
check-off affordance where a student naturally finds their past events —
minimum: student past-event rows in `OutreachList` open a small
day-picker confirmation (new component in `src/pages/outreach/`, small
confirmation = dialog is fine per UXD-06). Days already attended (any
method) show as already-recorded, not re-checkable; un-check only removes
`'self'` rows (mirror the RLS truth in the UI). New loader file
`src/lib/supabase/loaders/selfCheckoff.ts` — do NOT touch
`loaders/attendance.ts` or `loaders/outreach.ts` (T127 owns outreach.ts).

RIDER (NIT from T121): remove the now-unused eslint-disable directive at
`OutreachList.tsx:1117` (auto-fixable; returns warning count to 338).

## Allowed Files
- `supabase/migrations/20260724000000_self_checkoff.sql` (new)
- `src/pages/outreach/OutreachList.tsx`, `OutreachList.test.tsx`
- new dialog component + test in `src/pages/outreach/`
- `src/pages/home/StudentHome.tsx`, `StudentHome.test.tsx` (only if you put
  an entry point there)
- `src/pages/outreach/ParentRsvp.tsx`, `ParentRsvp.test.tsx` (parent entry,
  optional but preferred)
- `src/lib/supabase/loaders/selfCheckoff.ts` (+ test) (new)

## Forbidden Files
- `OutreachDetail.*`, `MarkDayCompleteDialog.*`, `AttendancePanel.*`,
  `loaders/attendance.ts`, `loaders/outreach.ts` (T127); `OutreachEventDialog.*`,
  `ScheduleMeetingsDialog.*`, `src/components/forms/**` (T125); all meetings
  files + `docs/swarm/**` (T128); every shipped migration file.

## Traps
1. Constitution item 3: zero hours math in TS — the view's session-length
   branch is the default-hours mechanism; your loader only inserts/deletes
   rows and reads existing views.
2. Feed/AttendancePanel integration is FREE: T124's feed derives Self badges
   from `recorded_by` vs `students.profile_id`, and T117's panel renders any
   method — verify both pick up 'self' rows in tests WITHOUT editing their
   files.
3. RLS is the enforcement; UI mirrors it. Negative tests for the UI too
   (coach-recorded day not un-checkable by student).
4. Three siblings mid-flight (T125 dialogs/forms; T127 detail/day-complete;
   T128 meetings/docs). Migration timestamp 20260724000000 is yours alone.
   Never `git stash`.

## Required Output
Full diff + migration with scratch-verification transcript
(positive/negative matrix); surface decision notes; gate output; risks.
