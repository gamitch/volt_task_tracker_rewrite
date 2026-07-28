# Worker Packet: T113

## Task ID
T113 — PRD v2 SCH-01: `student_teams` membership junction + backfill (the B2
multi-team-membership schema foundation).

## Objective
Create the additive migration that lets a student belong to more than one team
(P3/Gear Girls students who are also VOLT members — org ground truth in
`docs/backlog.html` §1), backfilled from the existing single
`students.team_id`. **Migration + verification only** — no UI/loader changes in
this task; every current reader keeps using `students.team_id` untouched, and
the follow-up reader-migration work is later packets' job (SCH-03 first).

## Allowed Files
- `supabase/migrations/20260721000000_student_teams.sql` (new — use exactly this
  filename; timestamp chosen to sort after every shipped migration and to avoid
  colliding with sibling task T114's own new migration)

## Forbidden Files
- Every existing migration (read-only; additive-only, constitution item 10).
- All of `src/**` — this task changes no frontend code.
- Everything else. `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. Table shape.** `student_teams (student_id uuid not null references
public.students(id) on delete cascade, team_id uuid not null references
public.teams(id) on delete restrict, joined_on date not null default
current_date, left_on date null, primary key (student_id, team_id))` — or a
justified variant; if you deviate (e.g. surrogate key, uniqueness including
date ranges), document why against PRD v2 §3 SCH-01 and §8's simplicity
principle (default: don't — re-joining a team after leaving is an UPDATE of
`left_on` back to null, not a history ledger; we are not building an audit
trail nobody asked for).

**2. Backfill in the same migration.** `insert into student_teams (student_id,
team_id) select id, team_id from public.students;` — verify against the real
`students` DDL (`20260716000000_identity_roster.sql`) that `team_id` is `not
null` (it is) so no null-handling is needed. George's production DB has real
rows; the backfill must be safe to run there exactly once (the migration runs
once per database — do not add `on conflict` unless you document why).

**3. RLS — investigate, mirror, don't invent.** The table needs RLS enabled +
policies. Investigate how existing tables and the metric views handle
visibility before choosing: `teams` has `read_all` (any authenticated);
`students` has `staff_all` + `own_or_linked_read`, with broader teammate
visibility deliberately delegated to the metric views (see
`20260717000002_rls.sql`'s own comments). Membership rows contain no PII beyond
the pairing of two ids. Recommended default: `staff_all` (via `is_staff()`) for
writes + `read_all` for select (mirroring `teams`), so future views joining
through this table (SCH-03) work for every authenticated role without a
recursion hazard — but verify this reasoning against how
`v_student_participation`/`v_student_hours` currently interact with `students`'
RLS, and document what you find.

**4. Verification (checker will independently repeat).** Scratch-Postgres run
using the established harness precedent (T104/T105/T110 entries in
`docs/swarm/verification-log.md`; `supabase/tests/` stubs): apply the full
migration chain including your new file; confirm the junction exists, the
backfill copies every student exactly once, constraints/PK hold (duplicate
insert rejected), `on delete cascade`/`restrict` behave as declared, and RLS
session tests pass for your chosen policies (staff can write, non-staff cannot,
authenticated can read per your decision). Also `npm run typecheck && npm run
lint && npm run test && npm run build && npm run format:check` all clean —
this is a SQL-only change, zero frontend regressions expected.

**5. Do NOT touch `students.team_id`** — no drop, no nullability change, no
deprecation comment edits on the shipped migration. It remains the
legacy/primary read path until SCH-03+ migrate readers (PRD v2 §3).

## Acceptance Criteria
- Additive migration exactly as scoped; backfill correct on first run against a
  database with existing rows.
- RLS enabled with investigated, documented policies.
- Scratch-Postgres verification transcript included in your report.
- All five frontend gates clean; no `src/**` diffs.

## Relevant Constitution Excerpts
> Item 10: migrations are additive-only. No worker self-certifies; independent
> checker required.

## Most Recent Failure
None. Attempt 1 (attempt count: 0) — first task of the PRD v2 swarm.

## Required Worker Output
- Full migration SQL.
- Your Trap #3 RLS investigation and decision, in full.
- Scratch-Postgres verification output (Trap #4).
- Full gate output. Known risks; dispute flag if needed.
