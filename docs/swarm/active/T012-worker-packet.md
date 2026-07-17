# Worker Packet: T012

## Task ID
T012

## Objective
Author one new additive migration, `supabase/migrations/20260717000002_rls.sql`, that (a) creates PRD Section 8.4's three RLS helper functions as a **byte-verbatim copy** of the ground-truth SQL quoted below, (b) enables Row Level Security on **every** one of the 14 existing tables with no gaps, and (c) applies policies built **only** from the three canonical policy shapes below (or safe, non-self-referential adaptations of them per the scoping notes below) to satisfy the PRD 8.3 access matrix, table by table.

This is a BLOCKER-stakes task under constitution items 3 and 4:
- Item 3: re-deriving the helper functions/policy SQL instead of copying verbatim is BLOCKER.
- Item 4: RLS is default-deny — any table left without policies is BLOCKER. Policies must use only the 8.4 security-definer helpers; **a policy subquerying its own table is BLOCKER** (this is the exact profiles-recursion bug class the verbatim-copy rule exists to prevent).

## Allowed Files
- `supabase/migrations/20260717000002_rls.sql` (new file — this is the only file you may create or edit)

## Forbidden Files
- `supabase/migrations/20260716000000_identity_roster.sql` (T009 — do not edit, constitution item 10: editing an applied migration file is BLOCKER)
- `supabase/migrations/20260717000000_scheduling_attendance.sql` (T010 — do not edit)
- `supabase/migrations/20260717000001_support_audit.sql` (T011 — do not edit)
- `docs/swarm/**`
- `.claude/**`
- Any file not explicitly listed under Allowed Files

## PRD Section 8.4 — Ground Truth SQL (copy verbatim, do not re-derive or paraphrase)

```sql
create or replace function auth_role() returns text
language sql stable security definer set search_path = public
as $$ select role from profiles where id = auth.uid() $$;

create or replace function is_staff() returns boolean
language sql stable security definer set search_path = public
as $$ select coalesce(auth_role() in ('admin','coach'), false) $$;

-- students I am (student role) or I guard (parent role)
create or replace function my_student_ids() returns setof uuid
language sql stable security definer set search_path = public
as $$
  select id from students where profile_id = auth.uid()
  union
  select student_id from guardian_links where parent_profile_id = auth.uid()
$$;
```

These three functions, verbatim, must appear in your migration before any policy that references them.

## Canonical Policy Shapes (every table uses exactly these three patterns, scoped per table)

```sql
alter table attendance enable row level security;

create policy staff_all on attendance
  for all to authenticated
  using (is_staff()) with check (is_staff());

create policy own_or_linked_read on attendance
  for select to authenticated
  using (student_id in (select my_student_ids()));

-- profiles: no self-referential subqueries; auth.uid() + helpers only
create policy profiles_read on profiles
  for select to authenticated using (true);
create policy profiles_self_update on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid() and role = auth_role());  -- cannot change own role
```

Note: `attendance` above is illustrative of the shape only — its actual scoping per the 8.3 matrix is "staff full (writes audited); student read own; parent read linked; **no insert policy for students**" (student self-check-ins happen only inside the `checkin` Edge Function under the service role after token validation — do not add a student insert policy to `attendance`).

## Schema Ground Truth (all 14 tables — verified directly from T009/T010/T011's applied migrations; RLS must be enabled on every one, no exceptions)

From `20260716000000_identity_roster.sql` (T009):
- `profiles` (id = auth.uid(), role role_enum, ...)
- `teams` (id, ...)
- `seasons` (id, is_active, ...)
- `students` (id, profile_id nullable fk→profiles, team_id fk→teams, is_active, ...)
- `guardian_links` (id, parent_profile_id fk→profiles, student_id fk→students, ...)

From `20260717000000_scheduling_attendance.sql` (T010):
- `invites` (id, student_id nullable, invited_by fk→profiles, status, ...)
- `events` (id, season_id, type check in ('meeting','outreach','competition'), team_ids uuid[] nullable — **null means all teams**, created_by nullable, ...)
- `event_sessions` (id, event_id fk→events, status, ...) — no `team_ids`/scope column of its own; scope is inherited via `event_id → events.team_ids`
- `rsvps` (id, session_id fk→event_sessions, student_id fk→students, status, responded_by nullable fk→profiles, ...)
- `attendance` (id, session_id fk→event_sessions, student_id fk→students, status, recorded_by nullable fk→profiles, ...)

From `20260717000001_support_audit.sql` (T011):
- `notification_prefs` (id, profile_id unique fk→profiles, ...)
- `calendar_feeds` (id, profile_id fk→profiles, token, ...)
- `email_log` (id, session_id nullable **no FK**, profile_id nullable **no FK**, ...)
- `audit_log` (id, actor not null fk→profiles, ...) — populated only by T011's SECURITY DEFINER trigger functions; do not add a general write policy here.

## PRD Section 8.3 Policy Matrix (English spec — you write the SQL; apply the canonical shapes per table)

| Table | admin/coach | student | parent |
|---|---|---|---|
| profiles | read all; admin updates roles | read+update own (name, avatar, theme) | same as student |
| students | full | read own row + name/team of teammates (leaderboard) | read linked students |
| events / event_sessions | full | read team-scoped | read linked students' scope |
| rsvps | full | read/write own | read linked; write linked (responded_by=self) |
| attendance | full (writes audited) | read own; insert own only via checkin function | read linked |
| invites, audit_log, email_log | admin/coach read (invites write) | none | none |
| notification_prefs, calendar_feeds | own | own | own |

## Required Interpretation — Tables Not Explicitly in the 8.3 Matrix

`teams`, `seasons`, `guardian_links` exist (from T009) but are not named in the 8.3 matrix. Constitution item 4 ("any table without policies → BLOCKER") applies to every table in the schema, not just the ones the matrix explicitly names — you must still give these real RLS, not skip them. Apply reasonable defaults consistent with the matrix's spirit and **flag this as an interpretation in your worker output** since 8.3 doesn't explicitly cover them:
- `teams`, `seasons`: non-sensitive reference data needed by the UI for every role — readable by all authenticated users (`using (true)`), writable by staff only (`staff_all` shape, `is_staff()`).
- `guardian_links`: staff full (`staff_all`); a parent/student can read their own links — `using (parent_profile_id = auth.uid() or student_id in (select my_student_ids()))`.

Do not silently invent policy logic beyond this — if you think a different interpretation is warranted, flag it explicitly rather than guessing.

## Two Specific Recursion/Scoping Traps — Read Before Writing SQL

**Trap 1 — `students` "teammate visibility for leaderboard" (matrix says student reads "own row + name/team of teammates"):**
Do NOT write a policy on `students` that subqueries `students` itself to look up "my team, then other students on that team" (e.g. `team_id in (select team_id from students where id in (select my_student_ids()))`). A raw subquery inside a policy on the same table it's attached to is evaluated under normal RLS, not bypassed — this is exactly the self-referential recursion class constitution item 4 calls out as BLOCKER, the same bug class that motivated the whole verbatim-copy rule for `profiles`.
For `students`, apply only the safe, matrix-supported subset this task can implement with the three given helpers:
- `staff_all` (admin/coach full).
- `own_or_linked_read` for select: `using (id in (select my_student_ids()))` — this single policy already covers **both** "student reads own row" (their own id is in the set) **and** "parent reads linked students" (linked ids are in the set via the `guardian_links` union inside the helper).
Do not add a separate "teammate" read policy on `students` in this task. The broader "teammate name/team for leaderboard" requirement is expected to be satisfied downstream by T013's metric/leaderboard views (which may use different security semantics), not by a direct `SELECT` policy on the raw `students` table. Flag this explicitly in your worker output as a scoped-down interpretation of the matrix row, with the reasoning above, so foreman/boss can confirm T013 is expected to close the gap.

**Trap 2 — `events`/`event_sessions` "team-scoped" read is safe, but only if you subquery `students` (a different table), never `events`/`event_sessions` themselves:**
This is not a self-referential case — a policy on `events` may safely subquery `students` (a different table) to translate "my/my-kid's team" into visibility, because `students`' own policies are already recursion-safe (per Trap 1). Something in this shape is expected to work correctly and should be validated against your scratch Postgres instance:
```sql
create policy own_or_linked_read on events
  for select to authenticated
  using (
    team_ids is null
    or exists (
      select 1 from students s
      where s.id in (select my_student_ids())
        and s.team_id = any(events.team_ids)
    )
  );
```
`event_sessions` has no `team_ids` of its own — scope it by joining through `events` via `event_id` (again, a different table than the one the policy is on, so this is safe):
```sql
create policy own_or_linked_read on event_sessions
  for select to authenticated
  using (
    exists (
      select 1 from events e
      where e.id = event_sessions.event_id
        and (
          e.team_ids is null
          or exists (
            select 1 from students s
            where s.id in (select my_student_ids())
              and s.team_id = any(e.team_ids)
          )
        )
    )
  );
```
Verify these actually work (and actually deny out-of-scope rows) against your scratch Postgres instance rather than trusting the shape as given — you own final correctness, this is a starting point, not something to copy blindly.

## Acceptance Criteria
1. The three 8.4 helper functions (`auth_role`, `is_staff`, `my_student_ids`) appear in the migration as a byte-verbatim copy of the ground-truth block above — no re-derivation, no paraphrasing, no reordering of the `union` clause, no different function signatures/language/security options.
2. All 14 tables listed under Schema Ground Truth have `alter table ... enable row level security;` — zero gaps. Provide an explicit list of all 14 in your worker output confirming each one.
3. Every table has at least one policy; no table is left effectively inaccessible-by-omission or wide-open-by-omission in a way that contradicts the matrix.
4. No policy subquerying its own table anywhere in the migration (Trap 1 above) — grep your own SQL for this before submitting.
5. Policies for `attendance`, `profiles`, and every other table needing role/ownership checks use only `is_staff()`, `auth_role()`, `my_student_ids()`, and direct `auth.uid()` comparisons — no new security-definer helper functions invented, no ad hoc re-implementation of what those three already do.
6. `attendance` has no insert policy granting students self-insert (student check-in writes happen only via the `checkin` Edge Function under service role, which bypasses RLS as noted).
7. `teams`/`seasons`/`guardian_links` policies applied per the "Required Interpretation" section above and explicitly flagged as an interpretation in your output.
8. The `students` "teammate visibility" matrix row is handled per Trap 1 (scoped down to own_or_linked_read only, gap flagged for T013) — not implemented via a self-referential subquery.
9. `events`/`event_sessions` team-scoping implemented per Trap 2's pattern (or an equivalent you've verified is not self-referential and actually works).
10. `invites` gets `staff_all` (admin/coach read+write per the matrix's "(invites write)" annotation). `audit_log` and `email_log` get a staff **read-only** policy (`for select to authenticated using (is_staff())`) and no general write policy — they are populated exclusively by T011's SECURITY DEFINER trigger functions / future service-role Edge Functions, which bypass RLS as the function/table owner.
11. `notification_prefs`/`calendar_feeds` get a self-only policy (`profile_id = auth.uid()`) for all commands — not `staff_all`; per the matrix even admin/coach only manage their own prefs/feeds row, not everyone else's.
12. **Validate against a real scratch Postgres instance** (same precedent as T009/T010/T011 — T011 in particular independently ran its triggers against a live scratch instance with positive AND negative controls). Do not just confirm the SQL applies without syntax errors. For at least a representative few cases per role, prove RLS actually blocks/allows access as intended — e.g.:
    - An unauthenticated/no-profile session gets zero rows from `students`, `attendance`, `events` (mirrors the AUTH-04/NFR-02 RLS-denial requirement T020 will build on).
    - A student's session can read their own `students`/`attendance` rows but not another team's students' rows, and cannot insert into `attendance`.
    - A parent's session can read their linked student's `attendance`/`rsvps` but not an unlinked student's.
    - An admin/coach session has full read/write on a representative staff-scoped table (e.g. `students`, `invites`).
    - Confirm no infinite-recursion/stack error occurs when querying `students` or `profiles` as any role (this is the specific failure mode Trap 1 exists to prevent — prove it doesn't happen, don't just avoid the pattern by inspection).
13. `20260716000000_identity_roster.sql`, `20260717000000_scheduling_attendance.sql`, and `20260717000001_support_audit.sql` confirmed byte-identical / zero diff (constitution item 10).
14. No secrets, no service-role keys anywhere in the migration file (constitution item 5).

## Relevant Constitution Excerpt

> 3. RLS policies and metric SQL come **only** from PRD Section 8.4, copied verbatim. Re-deriving either, or duplicating a metric formula in TypeScript (PRD DATA-01) → BLOCKER.
>
> 4. RLS is default-deny; any table without policies → BLOCKER. Policies use only the 8.4 `security definer` helpers; a policy subquerying its own table → BLOCKER.
>
> 5. No secrets in the repo: `.env*` gitignored; service-role keys never appear in frontend code or client bundles → BLOCKER.
>
> 10. Database changes are additive migrations via the Supabase CLI; editing an applied migration file → BLOCKER.

## Most Recent Failure
None — this is attempt 1 for T012.

## Required Worker Output
- Files changed (should be exactly the one new migration file).
- Full contents (or a clear diff-from-empty) of `supabase/migrations/20260717000002_rls.sql`.
- Explicit confirmation, table by table, that all 14 tables have RLS enabled and at least one policy (list them).
- Explicit note on the `teams`/`seasons`/`guardian_links` interpretation (per "Required Interpretation" above).
- Explicit note on the `students` teammate-visibility scope-down decision (Trap 1) and the resulting T013 dependency/gap.
- Commands run to stand up the scratch Postgres instance, apply all four migrations in order, and run the role-based access tests — plus the actual test output (row counts / allow-deny results) for each of the representative cases in Acceptance Criterion 12. A claim of "RLS works" without this evidence will not be accepted by the checker.
- Confirmation (e.g. `diff` or checksum) that T009/T010/T011's migration files are untouched.
- Known risks (e.g. anything you had to interpret, anything you're unsure about, anywhere the scratch-Postgres test coverage is thinner than you'd like).
- Whether a dispute is needed (e.g. if you believe any part of this packet's guidance is itself wrong, impossible, or contradicts PRD 8.3/8.4 as you understand them — do not silently deviate, file a dispute instead).
