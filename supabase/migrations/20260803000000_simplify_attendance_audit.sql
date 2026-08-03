-- Simplify post-completion attendance handling.
--
-- WHY (owner decision, 2026-08-03): this is a small volunteer team, not an
-- organization with a fraud problem. Adding a student to a completed session
-- after the fact is a NORMAL, legitimate correction here -- a coach or the
-- student notices they were present but never got marked, and someone fixes
-- it. Treating that as a suspicious event was the wrong model:
--
--   1. It filled `audit_log` with routine corrections, which makes the log
--      noise rather than signal.
--   2. `audit_log.actor` was NOT NULL and the trigger resolved the actor via
--      `coalesce(auth.uid(), current_setting('app.actor_id', true))`. When
--      neither resolved, the NOT NULL violation ABORTED the triggering write.
--      A logging failure could therefore destroy a real attendance record --
--      an audit trail must never be able to eat the data it is auditing.
--
-- WHAT REPLACES IT: nothing new. `attendance` already carries the honest,
-- simple answer to "who recorded this and when" on the row itself --
-- `recorded_by` (fk profiles) and `updated_at` -- and the activity feed
-- already derives self-vs-staff attribution from `recorded_by`. That is the
-- right level of record-keeping for this team.
--
-- SCOPE: this migration touches the ATTENDANCE audit only. The other four
-- DATA-02 triggers (profile role changes, student deactivations, session
-- cancellations, invite revocations) are kept -- they cover rare
-- administrative actions, they do not fire on anyone's routine workflow, and
-- a "who changed this" record for them is genuinely useful.
--
-- Idempotent: safe to apply more than once.

-- ---------------------------------------------------------------------------
-- 1. Drop the post-completion attendance audit trigger.
-- ---------------------------------------------------------------------------
-- No client code is affected: nothing in `src/` ever wrote `audit_log` for
-- attendance. Every reference to this trigger in the app is a comment
-- explaining that the database handled it automatically.

drop trigger if exists trg_audit_attendance_post_completion on public.attendance;
drop function if exists public.fn_audit_attendance_post_completion();

-- ---------------------------------------------------------------------------
-- 2. A failed audit write must never abort the write it is auditing.
-- ---------------------------------------------------------------------------
-- The four remaining DATA-02 triggers use the same
-- `coalesce(auth.uid(), app.actor_id)` actor resolution, so they carry the
-- same fail-closed hazard: a service-role or background-job UPDATE with no
-- resolvable actor would abort a legitimate change. Allowing NULL means such
-- a row is still recorded (with an unknown actor) instead of taking the real
-- write down with it. Recording "this happened, actor unknown" is strictly
-- more useful than recording nothing and losing the change.

alter table public.audit_log alter column actor drop not null;

-- ---------------------------------------------------------------------------
-- 3. Make `attendance.updated_at` trustworthy.
-- ---------------------------------------------------------------------------
-- `updated_at` is `not null default now()`, but nothing advanced it on
-- UPDATE -- it kept the row's INSERT time unless a caller happened to set it
-- explicitly, so "when was this last touched" was not reliably answerable.
-- Since `recorded_by`/`updated_at` are now the whole record-keeping story for
-- attendance, the timestamp needs to actually be maintained.
--
-- Deliberately plain plpgsql rather than the `moddatetime` contrib function:
-- moddatetime errors with "cannot process INSERT events", so it cannot cover
-- both legs, and using it would add an extension-schema dependency for four
-- lines of logic.

create or replace function public.fn_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_attendance_touch_updated_at on public.attendance;

create trigger trg_attendance_touch_updated_at
  before insert or update on public.attendance
  for each row
  execute function public.fn_touch_updated_at();
