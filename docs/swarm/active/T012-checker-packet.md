# Checker Packet: T012

## Task ID
T012 — RLS helper functions + policies (PRD Section 8.4 verbatim helpers + 8.3 access matrix)

## Checker Agent
checker-tests

## Attempt
Check attempt 1 of 3 (max 3 before mandatory boss-arbiter escalation per constitution "Loop Limit").

## Objective Being Checked
One new additive migration, `supabase/migrations/20260717000002_rls.sql`, that (a) creates PRD 8.4's three RLS helper functions as a byte-verbatim copy, (b) enables RLS with at least one policy on all 14 tables created by T009/T010/T011, and (c) applies policies per the PRD 8.3 access matrix without any self-referential (same-table) subqueries.

**This is the highest-stakes task run so far.** Constitution items 3 and 4 are both explicitly BLOCKER-class for this task:
- Item 3: "RLS policies ... come only from PRD Section 8.4, copied verbatim. Re-deriving ... → BLOCKER."
- Item 4: "RLS is default-deny; any table without policies → BLOCKER. Policies use only the 8.4 security definer helpers; a policy subquerying its own table → BLOCKER" — this is the exact profiles-recursion bug class.

Treat every worker claim below as a hypothesis to independently verify, not as evidence. Do not rubber-stamp this task. A BLOCKER you miss here ships a real security hole affecting minors' data.

## Allowed Files (yours to inspect only — you do not modify repo files)
- `supabase/migrations/20260717000002_rls.sql` (read-only inspection)
- `supabase/migrations/20260716000000_identity_roster.sql` (T009 — read-only, for zero-diff confirmation and `role_enum` ground truth)
- `supabase/migrations/20260717000000_scheduling_attendance.sql` (T010 — read-only, for zero-diff confirmation)
- `supabase/migrations/20260717000001_support_audit.sql` (T011 — read-only, for zero-diff confirmation)

If you need to stand up a scratch Postgres instance and write setup/seed SQL or shell scripts to do so, write those files to your own scratchpad/temp working area — never into this repository.

## Forbidden Files (BLOCKER if the worker touched any of these — verify by file-tree/content inspection, not git history)
- `supabase/migrations/20260716000000_identity_roster.sql` (T009)
- `supabase/migrations/20260717000000_scheduling_attendance.sql` (T010)
- `supabase/migrations/20260717000001_support_audit.sql` (T011)
- `docs/swarm/**`
- `.claude/**`
- Anything outside the single new migration file

## Ground Truth 1 — PRD Section 8.4 helper functions (byte-verbatim required)

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

These three functions appear in `20260717000002_rls.sql` lines 11–26. On a first visual read they match the ground truth exactly, including whitespace, blank lines, the `union` clause ordering, and the leading comment above `my_student_ids()` — but a visual read is not sufficient for a BLOCKER-stakes item. Extract both blocks into two files yourself and run `diff`/`sha256sum` (or equivalent) to get real byte-level proof, and report the actual command output.

## Ground Truth 2 — `role_enum` type mismatch claim (worker's justification for a flagged deviation)

T009's migration (`20260716000000_identity_roster.sql`, line 12) defines:
```sql
create type role_enum as enum ('admin', 'coach', 'student', 'parent');
```
and `profiles.role` (line 20) is declared `role_enum not null`.

The worker's on-disk comment (migration lines 39–41) states that because `auth_role()` returns `text` while `profiles.role` is `role_enum`, the canonical packet shape `with check (id = auth.uid() and role = auth_role())` would fail with `operator does not exist: role_enum = text`, and that the fix is an explicit `role::text = auth_role()` cast added only on the policy side (line 45), not inside `auth_role()` itself. Independently confirm this is real Postgres behavior (not just plausible-sounding) — test both the uncast and cast forms against your scratch instance — and confirm by direct text inspection that `auth_role()`'s own function body (lines 11–13) is untouched/byte-identical to ground truth despite this fix.

## Ground Truth 3 — PRD 8.3 access matrix (English spec, for cross-checking policy coverage)

| Table | admin/coach | student | parent |
|---|---|---|---|
| profiles | read all; admin updates roles | read+update own (name, avatar, theme) | same as student |
| students | full | read own row + name/team of teammates (leaderboard) | read linked students |
| events / event_sessions | full | read team-scoped | read linked students' scope |
| rsvps | full | read/write own | read linked; write linked (responded_by=self) |
| attendance | full (writes audited) | read own; insert own only via checkin function | read linked |
| invites, audit_log, email_log | admin/coach read (invites write) | none | none |
| notification_prefs, calendar_feeds | own | own | own |

`teams`, `seasons`, `guardian_links` are not named in this matrix (see Ground Truth 4).

## Ground Truth 4 — Interpretation notes for tables outside the 8.3 matrix (worker's stated reasoning, needs your independent adjudication)
- `teams`, `seasons`: worker applied `read_all` (authenticated, `using (true)`) + `staff_all` writes, reasoning these are non-sensitive reference data every role's UI needs.
- `guardian_links`: worker applied `staff_all` + an `own_read` select policy: `using (parent_profile_id = auth.uid() or student_id in (select my_student_ids()))`.

## Ground Truth 5 — Trap 1 (students teammate-visibility), expected to be a deliberate gap, not a defect
The worker packet explicitly instructed: do NOT write a self-referential `students` policy for "read teammates' name/team" (matrix row for student role); scope `students` down to `staff_all` + `own_or_linked_read` (`using (id in (select my_student_ids()))`) only, and flag the teammate-visibility gap as expected to be closed by T013's views instead. The migration's `students` block (lines 94–102) claims to follow this. Confirm: (a) no `students` policy anywhere subqueries `students` itself, and (b) this is correctly understood as an intentional, packet-sanctioned scope-down — not something to fail the task over.

## Ground Truth 6 — Trap 2 deviation (events/event_sessions), needs your own reasoned verdict, not a mechanical check

The worker packet's own illustrative Trap-2 SQL was:
```sql
using (
  team_ids is null
  or exists (select 1 from students s where s.id in (select my_student_ids()) and s.team_id = any(events.team_ids))
)
```
The worker did **not** ship this literal shape. On-disk (migration lines 153–161), the actual policy is:
```sql
create policy own_or_linked_read on events
  for select to authenticated
  using (
    exists (
      select 1 from students s
      where s.id in (select my_student_ids())
        and (events.team_ids is null or s.team_id = any(events.team_ids))
    )
  );
```
i.e. `team_ids is null` was moved *inside* the `exists(...)`, so a caller must have at least one linked student (own or guarded, via `my_student_ids()`) to see *any* event — global or team-scoped. Same pattern applied to `event_sessions` (lines 180–189).

Worker's stated reasoning (migration lines 134–145): the packet's literal snippet would let an "orphan" authenticated session — a real `auth.users` row with no `profiles`/`students`/`guardian_links` row at all — see every globally-scoped (`team_ids is null`) event, which contradicts the worker packet's own Acceptance Criterion 12 ("an unauthenticated/no-profile session gets zero rows from `students`, `attendance`, `events`"). Worker claims to have observed this failure mode directly pre-fix (count=1 for an orphan session) and re-verified post-fix that student1/parent1 still see both their team's event and the all-teams event (2/2).

**You must independently verify this failure mode is real** (reproduce the orphan-session leak against the packet's literal snippet, or accept the worker's fixed version as-is and confirm it denies the orphan case and still allows student1/parent1 both events), **and you must give an explicit, reasoned verdict** on the security posture, not just confirm the mechanics work. Specifically think through:
- Does `staff_all` (a separate permissive policy on the same table) already cover admin/coach regardless of this change? (Permissive RLS policies for the same command OR together — confirm this is actually how Postgres RLS combines them here.)
- The fix denies visibility to *any* authenticated session with zero rows in `students`/`guardian_links` for that profile — including the specific "orphan, no profile at all" case AC12 requires, but *also* a real `role='parent'` or `role='student'` profile that happens to have zero linked students yet (e.g. a parent invited but not yet linked to their kid, or a student profile created before roster assignment). Is denying that second case correct security posture (safer default-deny, consistent with the matrix's "read linked students' scope" framing — no links means no scope), or is it an over-restriction that would break a legitimate onboarding-lag use case the PRD might expect to work (e.g. seeing season-wide "all teams" announcements before roster linkage is complete)? PRD 8.3 does not explicitly address this edge case — reason it through using the matrix's spirit and constitution item 4's default-deny principle, and state your verdict with justification, not just "worker's call was fine" or "worker's call was wrong" without reasoning.

## Ground Truth 7 — Schema Ground Truth: all 14 tables (verify RLS + >=1 policy on each, zero gaps)

From T009: `profiles`, `teams`, `seasons`, `students`, `guardian_links`
From T010: `invites`, `events`, `event_sessions`, `rsvps`, `attendance`
From T011: `notification_prefs`, `calendar_feeds`, `email_log`, `audit_log`

## Required Verification Steps

1. **Byte-verbatim helper diff.** Read `20260717000002_rls.sql` directly yourself. Extract the three helper function definitions (lines 11–26) and diff them byte-for-byte against Ground Truth 1 above (use `diff`/checksum, not eyeballing). Report any difference, including whitespace, even if functionally inert. Any difference → BLOCKER per constitution item 3.

2. **Self-referential subquery sweep.** Grep every `create policy` statement in the file. For each one, confirm its `USING`/`WITH CHECK` clause only references: (a) the three helper functions (`auth_role()`, `is_staff()`, `my_student_ids()`), (b) `auth.uid()`, (c) direct column comparisons, or (d) a subquery/`exists`/`join` against a table *different* from the one the policy is attached to. Flag BLOCKER immediately, for any table, if a policy subqueries its own table (e.g., a `students` policy subquerying `students`, an `events` policy subquerying `events`). Pay particular attention to `students` (Trap 1), `events`/`event_sessions` (Trap 2), and `profiles` (the canonical recursion bug table) — confirm `profiles_read`, `profiles_self_update`, and `staff_all on profiles` never subquery `profiles` directly (calls to `is_staff()`/`auth_role()` are SECURITY DEFINER function calls, not direct subqueries under the caller's RLS context — confirm you understand and can articulate why that distinction makes them safe).

3. **14-table RLS + policy coverage.** Statically enumerate (or query, if your scratch Postgres is up) every `alter table ... enable row level security` and every `create policy ... on <table>` in the file. Cross-check against the 14-table list in Ground Truth 7. Confirm zero tables are missing RLS and zero tables have RLS enabled but no policy at all (which would make them fully inaccessible-by-default rather than intentionally scoped — distinguish an intentionally narrow policy set, e.g. `audit_log`'s staff-read-only, from an accidental gap).

4. **role_enum cast claim.** Read T009's migration yourself, confirm `profiles.role` is declared `role_enum not null` and that `role_enum` is a 4-value enum. In your scratch Postgres (see step 5), test the literal uncast canonical form (`with check (id = auth.uid() and role = auth_role())`) and confirm it actually errors with an operator-does-not-exist class error; then confirm the shipped cast form (`role::text = auth_role()`) works correctly, including correctly *blocking* a self role-escalation attempt. Confirm `auth_role()`'s own definition is unmodified from ground truth (already covered in step 1, but re-confirm the cast lives only in the policy, not the helper).

5. **Independent scratch Postgres validation — do not just re-read the worker's log.** Stand up your own scratch Postgres instance (same approach as the T009→T010→T011 precedent — see T011's checker packet for the established pattern: minimal `auth.uid()`/`auth.users` scaffolding, apply migrations in strict order T009 → T010 → T011 → T012). Build your own seed data (fabricated names only, per constitution item 6) covering at least: an anon/no-JWT session; an "orphan" authenticated session with a real `auth.users` row but no `profiles` row; a `student` role profile linked to their own `students` row; a `parent` role profile linked via `guardian_links`; an `admin` or `coach` role profile. At minimum, generate your own evidence (real commands + real output, not paraphrased) for:
   - anon/no-JWT: zero rows from every table tested.
   - orphan authenticated-no-profile: zero rows from `students`, `attendance`, `events`, `event_sessions` — this is the specific case the Ground Truth 6 fix targets; confirm it actually holds against the shipped SQL.
   - student1: reads own `students`/`attendance` row, cannot read another team's student's row, cannot insert into `attendance` (no insert policy should exist for non-staff).
   - parent1: reads only their linked student's `attendance`/`rsvps`/`students` rows, not an unlinked student's.
   - events/event_sessions team-scoping: student1/parent1 see both their own team's event and a `team_ids is null` ("all teams") event (expect 2/2, replicating the worker's claimed re-verification — do not just trust the worker's reported count).
   - admin or coach: full read/write on a staff-scoped table (e.g. `students`, `invites`), and confirm `is_staff()`-gated policies work.
   - `profiles`: query as every role type (anon, orphan, student, parent, admin/coach) and confirm zero infinite-recursion/stack-depth errors in any case — this is the specific failure mode the verbatim-copy rule exists to prevent.
   - `profiles` role-escalation: as a student or parent, attempt to `UPDATE profiles SET role = 'admin' WHERE id = auth.uid()` — confirm it is blocked (either 0 rows affected or an error), and that the same session's non-role self-updates (e.g. `display_name`) succeed.
   - `notification_prefs`/`calendar_feeds`: confirm self-only access (a profile cannot read/write another profile's row, including staff — matrix says "own | own | own" for these two, not staff_all).
   If Postgres is not reachable in this environment at all, state that explicitly and fall back to the most rigorous static trace you can — but this task's stakes (BLOCKER-class security surface for a minors' data app) mean a live-DB check is strongly expected; do not silently settle for static-only without first genuinely attempting to stand one up.

6. **Trap 2 verdict.** Deliver the explicit, reasoned security-posture verdict requested in Ground Truth 6 — cite what you actually tested in step 5, not just the worker's narrative.

7. **Interpretation adjudication (teams/seasons/guardian_links).** Give an explicit verdict (reasonable / questionable / wrong) on the `teams`/`seasons` "read_all authenticated, staff writes" and `guardian_links` "staff_all + own_read via parent_profile_id or my_student_ids()" interpretations from Ground Truth 4, since these tables are outside the literal 8.3 matrix and constitution item 1 requires disputes rather than silent improvisation when a spec is ambiguous — assess whether the worker's flagged interpretation is a reasonable spirit-consistent default or should have been a dispute instead.

8. **Trap 1 gap confirmation.** Confirm no `students` policy anywhere reintroduces a self-referential "teammate" subquery, and confirm your understanding (per Ground Truth 5) that the teammate-visibility gap is an intentional, packet-sanctioned scope-down for T013 to close, not a defect in T012.

9. **T009/T010/T011 zero-diff.** Read all three prior migration files directly and confirm byte-identical content to what's quoted/described in this packet and in their own archived checker packets (T009-checker-packet.md / T010-checker-packet.md / T011-checker-packet.md, if you want additional cross-reference). Use direct file-content comparison, never git commit/authorship history, per the D001 standing rule.

10. **Forbidden-file / scope check (D001 standing rule).** Compare the actual file tree against the Allowed Files list directly (file-tree/content state, never git-log/commit-bundling as evidence) — confirm exactly one new file exists under `supabase/migrations/` beyond the T009/T010/T011 baseline, and nothing else in the repository changed.

## Relevant Constitution Excerpt

> 1. Precedence: PRD requirement IDs > this constitution > task-ledger text > agent judgment. Conflicts are disputes for boss-arbiter — never improvised around.
>
> 3. RLS policies and metric SQL come **only** from PRD Section 8.4, copied verbatim. Re-deriving either, or duplicating a metric formula in TypeScript (PRD DATA-01) → BLOCKER.
>
> 4. RLS is default-deny; any table without policies → BLOCKER. Policies use only the 8.4 `security definer` helpers; a policy subquerying its own table → BLOCKER.
>
> 5. No secrets in the repo: `.env*` gitignored; service-role keys never appear in frontend code or client bundles → BLOCKER.
>
> 10. Database changes are additive migrations via the Supabase CLI; editing an applied migration file → BLOCKER.

Definition of Done: no task may be marked complete on a worker self-report; the checker inspects the actual artifact and generates its own evidence.

Failure Severity table applies to every finding, including the Trap 2 posture verdict (step 6) and the teams/seasons/guardian_links interpretation adjudication (step 7): classify each as BLOCKER/MAJOR/MINOR/NIT/not-an-issue with reasoning, don't leave any unclassified.

## Known Context / Non-Issues (do not re-flag as new findings, but do verify each is actually true — none of these are pre-approved without your own check)
- The `role::text` cast on `profiles_self_update` (Ground Truth 2) is expected to be a real, necessary fix, not a spec deviation to fail on — but you must still verify the type-mismatch claim yourself and confirm the helper function itself is untouched.
- The Trap 2 deviation (Ground Truth 6) is expected to be defensible given AC12's explicit no-profile-zero-rows requirement — but this still requires your own reasoned verdict, not a rubber stamp, per the task instructions.
- The Trap 1 scope-down (Ground Truth 5) is expected to be an intentional, packet-sanctioned gap for T013, not a defect.

## Most Recent Failure
None — this is T012's first check attempt.

## Required Checker Output (per constitution Evidence Requirements)
- files inspected
- exact commands run + real quoted output (not summarized/paraphrased) — including whether a scratch Postgres was reachable, and if so, the real SQL/psql commands and real result rows for every case in step 5
- byte-diff result for the three helper functions (step 1)
- full list of every `create policy` statement with a same-table-subquery determination for each (step 2)
- 14-table RLS+policy coverage table (step 3)
- role_enum cast test result, both uncast-errors and cast-works (step 4)
- explicit, reasoned Trap 2 security-posture verdict with severity classification (step 6)
- explicit interpretation adjudication for teams/seasons/guardian_links with severity classification (step 7)
- Trap 1 gap confirmation (step 8)
- T009/T010/T011 zero-diff confirmation (step 9)
- forbidden-file / scope check result (step 10)
- overall pass/fail result
- exact failure reason(s), if any, with severity classification (BLOCKER/MAJOR/MINOR/NIT)
- recommended next action

Do not mark this task complete based on the worker's self-report or on the inline comments left in the migration file. Those comments explain the worker's reasoning — they are not evidence. Generate your own evidence: live-DB test strongly preferred given this task's BLOCKER-class stakes; rigorous static trace only as a documented fallback if Postgres is genuinely unreachable.
