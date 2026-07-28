-- T126 (PRD v2 UXP-03): retroactive student/parent self check-off, with its
-- own additive self-write migration ('self' method + RLS). Additive-only
-- (constitution item 10); does NOT edit `20260717000000_scheduling_
-- attendance.sql` (the shipped `attendance.method` check-constraint origin)
-- or `20260717000002_rls.sql` (the shipped `attendance` RLS block, whose own
-- comment -- "Deliberately NO insert/update policy for students/parents...
-- Adding a student/parent write policy here would be incorrect per the
-- matrix" -- is the pre-v2 stance this task's own packet names as the
-- sanctioned exception: PRD v2 UXP-03 now explicitly wants a labeled
-- `'self'` retroactive check-off path).
--
-- -----------------------------------------------------------------------
-- 1. Widen `attendance.method` -- add-new-drop-old in one migration
--    (constitution item 10 / PRD v2 section 4 "Traps carried forward").
--
--    The shipped inline check constraint's real, auto-generated name was
--    independently confirmed against a live scratch-Postgres instance (all
--    real migrations through 20260724000001 applied in filename order, then
--    `select conname, pg_get_constraintdef(oid) from pg_constraint where
--    conrelid = 'public.attendance'::regclass and contype = 'c'`) -- NOT
--    guessed: `attendance_method_check`, defined as `CHECK ((method = ANY
--    (ARRAY['qr'::text, 'coach'::text, 'import'::text])))`
--    (`20260717000000_scheduling_attendance.sql` line 90). This migration
--    drops that constraint by its real, verified name and re-adds an
--    equivalent one (a fresh auto-generated name for the replacement is
--    fine -- Postgres does not require the same literal name) that also
--    permits the new `'self'` value.
alter table public.attendance
  drop constraint attendance_method_check;

alter table public.attendance
  add constraint attendance_method_check
  check (method in ('qr', 'coach', 'import', 'self'));

-- -----------------------------------------------------------------------
-- 2. Self-write policies on `attendance` (PRD v2 UXP-03's sanctioned
--    exception to the v1 RLS comment quoted above). `staff_all` and
--    `own_or_linked_read` (both already shipped by
--    `20260717000002_rls.sql`, both READ-ONLY by this migration) are
--    untouched -- these two new policies are strictly additive, matching
--    the `for insert`/`for delete` PostgreSQL policy-command granularity
--    every other multi-policy table in this schema already uses (e.g.
--    `rsvps`' own `own_or_linked_write`/`own_or_linked_update` split,
--    `20260717000002_rls.sql` lines 205-212).
--
--    `my_student_ids()` (the PRD 8.4 helper, already shipped, untouched --
--    "students I am (student role) or I guard (parent role)") is reused
--    verbatim, matching every other student/parent-scoped policy in this
--    schema (constitution item 4: policies use only the 8.4 helpers).
--
--    INSERT: a student/parent may only ever create their OWN student's row,
--    only ever labeled `'self'` (never `'qr'`/`'coach'`/`'import'` --
--    those remain exclusively staff/service-role-originated per the
--    shipped v1 comment), and only ever attributed to their OWN
--    `auth.uid()` (never impersonating another profile as `recorded_by`).
create policy self_insert on public.attendance
  for insert to authenticated
  with check (
    student_id in (select my_student_ids())
    and method = 'self'
    and recorded_by = auth.uid()
  );

-- DELETE (own-mistake correction): a student/parent may remove ONLY their
-- own student's `'self'`-method rows -- a real `'qr'`/`'coach'`/`'import'`
-- row (someone else's provenance) can never be removed via this policy,
-- regardless of student scope. No `recorded_by = auth.uid()` check here
-- deliberately: a parent correcting a mistake their linked student made
-- (or vice versa) is still "the same family correcting their own record",
-- matching `my_student_ids()`'s own existing student-OR-guardian union
-- semantics for every other self-scoped policy in this schema (e.g.
-- `own_or_linked_read`/`own_or_linked_write` on `rsvps`, which likewise
-- never require the ORIGINAL author and the acting session to be the exact
-- same `profiles.id`).
create policy self_delete on public.attendance
  for delete to authenticated
  using (
    student_id in (select my_student_ids())
    and method = 'self'
  );

-- NO update policy (packet's own explicit simplification: "keep it simple:
-- delete + re-insert"). A student/parent wanting to change a self-checked
-- day's status must delete the row (via `self_delete` above) and insert a
-- fresh one (via `self_insert` above) -- there is deliberately no path for
-- a student/parent to UPDATE an existing `attendance` row of any method,
-- matching `staff_all`'s already-exclusive hold on `for all` (which
-- includes UPDATE) for every other actor.
--
-- Default hours (packet item 4): a `'self'` insert's `hours_override` is
-- always left NULL and `check_in_at`/`check_out_at` are always left NULL by
-- this feature's own UI/loader (`src/lib/supabase/loaders/
-- selfCheckoff.ts`, not this migration) -- no new hours math exists
-- anywhere in this migration or that loader (constitution item 3).
-- `v_student_hours` (`20260717000003_metric_views.sql`, read-only,
-- unmodified) already coalesces exactly that shape to its own tier-3
-- session-length fallback (`extract(epoch from (es.ends_at -
-- es.starts_at)) / 3600.0`) for ANY qualifying `attendance` row regardless
-- of `method` -- that view's existing, unmodified coalesce chain is
-- therefore already the "default hours" mechanism for a `'self'` row with
-- no explicit override, verified directly against a live scratch-Postgres
-- instance below (this migration's own worker output has the full
-- transcript).
