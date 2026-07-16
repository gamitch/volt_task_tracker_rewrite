# Checker Packet: T009

## Task ID
T009 (attempt 1 — first check on this task)

## Checker Agent
checker-tests

## Artifact To Inspect
`/home/user/volt_task_tracker_rewrite/supabase/migrations/20260716000000_identity_roster.sql`
(single new file — confirm via `ls supabase/migrations/` that it is the ONLY file in that directory; if anything else is present, that is itself a finding — see item 6 below.)

Do not rely on the worker's own summary in `docs/swarm/active/T009-worker-packet.md` as evidence. Read the SQL file directly.

## Objective Being Checked
Additive Supabase migration creating `profiles`, `teams`, `seasons`, `students`, `guardian_links` exactly matching PRD Section 8.1's column lists, with standard id/created_at/FK conventions.

## Ground Truth — PRD Section 8.1 (verified by foreman-planner via direct PRD read; you do not need to open the PRD)

General rule: **all tables** get `id uuid pk default gen_random_uuid()` and `created_at timestamptz default now()`. **FKs `on delete restrict` unless PRD 8.1 notes otherwise** (8.1 notes no exceptions for these five tables).

| Table | Fields beyond id/created_at |
|---|---|
| profiles | `id` = `auth.users.id` (pk, fk) — **override of the general id rule**, `display_name text`, `email text unique`, `role role_enum('admin','coach','student','parent')`, `avatar_url text`, `theme_mode text default 'system'` |
| teams | `name text unique`, `short_name text`, `program text null check in ('FRC','FTC','Other')`, `color text`, `archived bool default false`, `sort_order int default 0` |
| seasons | `name text`, `starts_on date`, `ends_on date`, `default_goal_hours numeric default 100`, `is_active bool` (partial unique index where true) |
| students | `profile_id uuid null fk profiles`, `display_name text`, `team_id fk teams`, `grad_year int null`, `is_active bool default true`, `goal_hours_override numeric null` |
| guardian_links | `parent_profile_id fk profiles`, `student_id fk students`, `relationship text`, `unique(parent, student)` |

Note: PRD 8.1 marks `program`, `grad_year`, `goal_hours_override`, and `profile_id` explicitly nullable ("null"). No other field in this ground truth is marked null, so the worker's rule "no null marker → NOT NULL" is correct as a general inference principle — that rule itself is not in question here. What's in question is one specific application of it (avatar_url) — see Adjudication Item 1 below.

## Relevant Constitution Excerpts

- Item 1 (Precedence): "PRD requirement IDs > this constitution > task-ledger text > agent judgment. Conflicts are disputes for boss-arbiter — never improvised around."
- Item 6 (No PII): fixtures/examples must use fabricated names only, never real data. (This migration has no seed data — confirm that's true.)
- Item 10 (Database changes): "Database changes are additive migrations via the Supabase CLI; editing an applied migration file → BLOCKER."
- Non-Negotiable: "Every checker must inspect the actual artifact, not just the worker's summary."
- Definition of Done: worker output is evidence for the checker, not self-certification. You must independently verify, not trust, any claim the worker made (including its claim about testing the partial unique index empirically).

## Most Recent Verification Failure
None — first check attempt on T009.

## Checks To Perform

1. Read the migration SQL file directly. Compare column-by-column against the ground truth table above for all five tables. Flag any invented, omitted, renamed, or mistyped column.
2. Confirm every table uses `id uuid primary key default gen_random_uuid()` and `created_at timestamptz not null default now()`, **except** `profiles`, which must use `auth.users.id` as both PK and FK (per the PRD's explicit override) — confirm `profiles` does NOT also have a redundant `gen_random_uuid()` default on its id.
3. Confirm all foreign keys use `on delete restrict` with no unnoted exceptions (check `students.profile_id`, `students.team_id`, `guardian_links.parent_profile_id`, `guardian_links.student_id`, `profiles.id→auth.users.id`).
4. Confirm the partial unique index on `seasons(is_active) where is_active = true` exists and actually enforces "at most one active season." Do not just trust the worker's description of having tested this empirically — independently verify:
   - If `psql`/a local Postgres instance is available in this environment, apply the migration to a scratch DB and attempt to insert two rows with `is_active = true` to confirm the second insert fails with a unique-violation, then confirm two rows with `is_active = false` (or one true + others false) succeed.
   - If no Postgres tooling is available, perform careful static SQL review: confirm the index is a genuine partial unique index (`create unique index ... on seasons (is_active) where is_active = true`), confirm `is_active` is `not null boolean` (a nullable boolean would let multiple `NULL` rows through a naive unique constraint, though a partial index on `is_active = true` specifically is not affected by that — check this reasoning holds), and confirm there's no earlier `unique` constraint on the table that would be redundant/conflicting.
   - State explicitly which validation method you used and why.
5. Confirm no RLS or `create policy` statements appear anywhere in this file — RLS is correctly out of scope for T009 (that's T012's job per the ledger).
6. Constitution item 10 check: confirm `supabase/migrations/` contains exactly one file (this one) — i.e., no prior migration file exists that could have been edited. List the directory contents as evidence.
7. Adjudicate the two flagged ambiguities below and give each a clear verdict and severity (BLOCKER / MAJOR / MINOR / non-issue).

## Adjudication Item 1 — `avatar_url` nullability

The worker made `avatar_url text not null` (no default), reasoning "PRD lists 'avatar_url text' with no null marker → NOT NULL," applying the same rule it correctly applied elsewhere (e.g., `teams.program` explicitly marked null vs. `teams.color` not marked null → NOT NULL).

Problem: PRD SET-01 describes avatar upload as a settings action (implying avatar_url is populated *after* profile creation, not required *at* creation). A `NOT NULL` column with no default on `avatar_url` would make it impossible to insert a new profile row until the user uploads an avatar — this will very likely break whatever creates `profiles` rows (most plausibly T019's invite-acceptance trigger, which is downstream and blocked on T009).

Assess: is this a genuine PRD ambiguity/gap (8.1's field list doesn't actually resolve create-time nullability, and the worker's blanket "no marker = NOT NULL" heuristic, while correct as a general rule, produces a plausible-but-questionable result on this one field given SET-01 context), or is it something the worker should have inferred differently on its own authority? Your verdict should land on one of:
- MINOR finding, log as a follow-up for T019 (or whichever task first inserts into `profiles`) to resolve — do not block PASS on it, since 8.1 alone (which is this task's literal acceptance criterion) does not actually contradict what the worker wrote, and the worker disclosed the risk rather than silently guessing.
- Something stricter, if you find the worker had a way to resolve this correctly within its own task scope that it failed to use.

State your reasoning and final verdict explicitly.

## Adjudication Item 2 — `role_enum` type placement

The worker created `role_enum` as a new type in this migration (profiles needs it, and this is the earliest/only migration so far). Confirm:
- This is a reasonable place to define it (nothing in 8.1 mandates a specific migration for shared types).
- It won't collide with a later migration — specifically, any future migration for `invites` (referenced in the SQL's own comment, and plausibly part of T017/T019's scope) must be written to **reuse** `role_enum` via a normal type reference, not attempt to `create type role_enum` again (which would fail at apply time). This is a forward-looking risk note for whichever task authors that migration, not a defect in T009 itself.

Verdict should be: reasonable / non-issue for T009, with a note (not a blocking finding) for future migrations to reuse rather than redefine `role_enum`.

## Note For The Record (not an adjudication — informational only)

The worker's task output states it read PRD Section 8.1 directly, despite worker packets generally instructing workers not to read the full PRD. This was a packet-authoring gap (the packet's acceptance criteria required column-for-column PRD matching but did not excerpt 8.1 inline), not worker overreach — the worker scoped its reading narrowly to 8.1 only and disclosed exactly what it read. Do not treat this as a violation requiring rework or a PASS/FAIL factor. You may note it in your evidence log if you wish, but it should not affect your verdict.

## Required Checker Output

Produce, as your evidence record (this becomes the verification-log entry the foreman will file — do not write to `docs/swarm/verification-log.md` yourself):

1. Overall verdict: PASS / PASS WITH FINDINGS / FAIL, with severity of any findings (BLOCKER / MAJOR / MINOR).
2. Column-by-column diff result for each of the 5 tables against the ground truth table above (explicitly confirm zero deltas, or list every delta found).
3. Confirmation (or refutation) of the id/created_at convention and the FK `on delete restrict` convention, table by table.
4. Result of the partial-unique-index verification, including which method (live Postgres vs. static review) you used and why.
5. Confirmation that no RLS/policy statements are present.
6. Directory listing of `supabase/migrations/` and confirmation only one file exists (constitution item 10).
7. Explicit verdict + severity for Adjudication Item 1 (avatar_url) and Adjudication Item 2 (role_enum placement).
8. Any additional findings not covered above.

Do not mark T009 complete yourself — report your findings; the foreman will update the ledger and route to boss-arbiter only if this fails 3 attempts.
