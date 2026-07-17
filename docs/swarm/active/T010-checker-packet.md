# Checker Packet: T010

## Task ID
T010 (attempt 1 — first check on this task)

## Checker Agent
checker-tests

## Artifact To Inspect
`/home/user/volt_task_tracker_rewrite/supabase/migrations/20260717000000_scheduling_attendance.sql`
(single new file — confirm via `ls supabase/migrations/` that exactly two files exist total: T009's `20260716000000_identity_roster.sql` and this one. Anything else present is itself a finding.)

Do not rely on the worker's own summary in `docs/swarm/active/T010-worker-packet.md` as evidence. Read the SQL file directly.

## Objective Being Checked
Additive Supabase migration creating `invites`, `events`, `event_sessions`, `rsvps`, `attendance` exactly matching PRD Section 8.1's column lists, with standard id/created_at/FK conventions, one scoped `on delete cascade` exception, and reuse (not redefinition) of `role_enum`.

## Ground Truth — PRD Section 8.1 (verified by foreman-planner via direct PRD read; you do not need to open the PRD)

General rule: **all tables** get `id uuid pk default gen_random_uuid()` and `created_at timestamptz default now()`. **FKs `on delete restrict` unless noted** — the one noted exception in this batch is `event_sessions.event_id`, which is `on delete cascade`.

| Table | Fields beyond id/created_at |
|---|---|
| invites | `email text`, `role role_enum`, `student_id uuid null` (self for students / linked kid for parents), `invited_by fk profiles`, `status text('pending','accepted','expired','revoked')`, `expires_at timestamptz` |
| events | `season_id fk`, `type text('meeting','outreach','competition')`, `title`, `description`, `location_name`, `address`, `team_ids uuid[] null` (null = all teams), `counts_participation bool`, `counts_volunteer_hours bool`, `adult_volunteers_count int default 0`, `adult_volunteer_hours numeric default 0`, `created_by fk profiles null` (null for imports) |
| event_sessions | `event_id fk` **on delete cascade** (the only exception in this batch), `session_date date`, `starts_at timestamptz`, `ends_at timestamptz`, `status text('scheduled','completed','canceled')`, `people_reached int null`, `notes text` |
| rsvps | `session_id fk`, `student_id fk`, `status text('going','maybe','declined')`, `responded_by fk profiles null` (null for imports), `updated_at`, `unique(session, student)` |
| attendance | `session_id fk`, `student_id fk`, `status text('present','late','excused','absent')`, `check_in_at timestamptz null`, `check_out_at timestamptz null`, `hours_override numeric null`, `method text('qr','coach','import')`, `recorded_by fk profiles null`, `updated_at`, `unique(session, student)` |

Note: fields marked "null" above are the only ones PRD 8.1 marks explicitly nullable. Every other field has no null marker, so — per the convention T009 established and T009's checker approved as a reasonable general inference principle — it should be `NOT NULL`. That general rule is not in question here. What's in question is one specific application of it (`event_sessions.notes`) — see Adjudication Item 1 below.

## Relevant Constitution Excerpts

- Item 1 (Precedence): "PRD requirement IDs > this constitution > task-ledger text > agent judgment. Conflicts are disputes for boss-arbiter — never improvised around."
- Item 6 (No PII): fixtures/examples must use fabricated names only, never real data. (This migration has no seed data — confirm that's true.)
- Item 10 (Database changes): "Database changes are additive migrations via the Supabase CLI; editing an applied migration file → BLOCKER."
- Non-Negotiable: "Every checker must inspect the actual artifact, not just the worker's summary."
- Definition of Done: worker output is evidence for the checker, not self-certification. Independently verify, do not trust, the worker's claim about applying T009+T010 to a scratch local Postgres and diffing `\d` output.

## Most Recent Verification Failure
None — first check attempt on T010.

## Checks To Perform

1. Read the migration SQL file directly. Compare column-by-column against the ground truth table above for all five tables (`invites`, `events`, `event_sessions`, `rsvps`, `attendance`). Flag any invented, omitted, renamed, or mistyped column.
2. Confirm every table uses `id uuid primary key default gen_random_uuid()` and `created_at timestamptz not null default now()`.
3. Confirm the FK `on delete` scoping is correct:
   - `event_sessions.event_id references events(id) on delete cascade` — the only cascade in this batch.
   - Every other FK across all five tables (`invites.student_id`, `invites.invited_by`, `events.season_id`, `events.created_by`, `rsvps.session_id`, `rsvps.student_id`, `rsvps.responded_by`, `attendance.session_id`, `attendance.student_id`, `attendance.recorded_by`) is `on delete restrict`. Any other cascade, or any restrict on `event_sessions.event_id`, is a deviation from the PRD's own stated exception — flag it.
4. Confirm `role_enum` is referenced, not redefined: grep this file for `create type role_enum` and confirm zero matches. Confirm `invites.role role_enum not null` correctly references the type created in T009's migration (`20260716000000_identity_roster.sql`).
5. Confirm nullable fields match the PRD's explicit null markers and nothing else:
   - `invites.student_id` — nullable (no `not null`).
   - `events.team_ids` — nullable array column.
   - `events.created_by` — nullable.
   - `event_sessions.people_reached` — nullable.
   - `rsvps.responded_by` — nullable.
   - `attendance.check_in_at`, `attendance.check_out_at`, `attendance.hours_override`, `attendance.recorded_by` — nullable.
   - All other columns in all five tables — `not null`.
6. Confirm `rsvps` has `unique (session_id, student_id)` and `attendance` has `unique (session_id, student_id)`, and that `attendance.method` is a constrained check `in ('qr','coach','import')`.
7. Confirm defaults: `events.adult_volunteers_count integer not null default 0`, `events.adult_volunteer_hours numeric not null default 0`.
8. Validate the worker's claim of having applied T009+T010 to a scratch local Postgres and diffed `\d` output:
   - If `psql`/a local Postgres instance is genuinely available in this environment, independently apply both migrations in order to a scratch DB (`supabase db reset` or raw `psql`) and run `\d` on all 10 tables, comparing against the ground truth yourself. Do not just trust the worker's report of having done this.
   - If no Postgres tooling is available, state that explicitly and fall back to rigorous static SQL review (syntax correctness, valid `references` targets, valid `check` constraint syntax, no typos in table/column names referenced across files).
   - State explicitly which method you used and why.
9. Constitution item 10 check — confirm T009's migration file (`supabase/migrations/20260716000000_identity_roster.sql`) has **zero diff** from its already-archived/passed state. Use `git diff` or `git status` against that file (and against the repo's last commit touching it) to confirm it was not modified by this task. List the `supabase/migrations/` directory contents as evidence (expect exactly two files).
10. Confirm no RLS or `create policy` statements appear anywhere in this file (RLS is T012's job, correctly out of scope here).
11. Confirm no PII/seed/fixture data appears in the file (constitution item 6) — this migration should contain schema only.
12. Adjudicate the flagged ambiguity below and give a clear verdict and severity (BLOCKER / MAJOR / MINOR / non-issue).

## Adjudication Item 1 — `event_sessions.notes` nullability

The worker made `notes text not null` with no default, applying the same "PRD lists a field with no null marker → NOT NULL" rule T009 used consistently and T009's checker approved as reasonable in general.

Flagged concern (raised by the foreman, not the worker): MTG-02's "Schedule meetings" dialog and OUT-02's outreach event dialog both list "notes" as a form field without indicating it is required at creation time. If notes is meant to be an optional field on session creation, a `NOT NULL` column with no default would block every `INSERT` into `event_sessions` that omits notes — the same operational shape as T009's `avatar_url` finding (a plausible-but-questionable literal application of the "no marker = NOT NULL" heuristic, where downstream UI context suggests the field may not actually be required at insert time).

Assess using the same severity framework T009's checker applied to `avatar_url`:
- Is this a genuine PRD 8.1 ambiguity (8.1's field list alone doesn't resolve create-time optionality, and downstream dialog specs suggest optional) — in which case land on: MINOR finding, log as a follow-up for whichever task first performs the `event_sessions` INSERT (most likely T031 Schedule Meetings dialog, or T039 outreach event dialog) to resolve (add a default such as `''`, or make the column nullable) — non-blocking for T010, since 8.1 alone (the literal acceptance criterion for this task) does not contradict what the worker wrote and the worker's convention was applied consistently.
- Or, is there a reason `NOT NULL` is clearly fine here (e.g., if the reasonable expectation is that the inserting code will always pass an empty string rather than omit the field, unlike `avatar_url` where SET-01 explicitly frames avatar upload as a deferred settings action with no equivalent "always pass something" assumption) — in which case: non-issue, no follow-up needed.

State your reasoning and final verdict explicitly. Do not default to whichever verdict T009 reached without independently reasoning through this table's specifics — the two cases are similar in shape but you should confirm whether they are actually analogous (e.g., is there a PRD signal for `notes` as strong as SET-01 was for `avatar_url`, or is this a weaker/stronger case?).

## Required Checker Output

Produce, as your evidence record (this becomes the verification-log entry the foreman will file — do not write to `docs/swarm/verification-log.md` yourself):

1. Overall verdict: PASS / PASS WITH FINDINGS / FAIL, with severity of any findings (BLOCKER / MAJOR / MINOR).
2. Column-by-column diff result for each of the 5 tables against the ground truth table above (explicitly confirm zero deltas, or list every delta found).
3. Confirmation (or refutation) of the id/created_at convention, the FK `on delete restrict` convention, and the single `on delete cascade` exception scoping — table by table.
4. Confirmation `role_enum` is referenced, not redefined (grep result).
5. Confirmation of the two unique constraints (`rsvps`, `attendance`) and the `attendance.method` check constraint.
6. Result of the schema-application verification (item 8 above), including which method (live Postgres vs. static review) you used and why.
7. Confirmation T009's migration file has zero diff (constitution item 10), with the directory listing showing exactly two files.
8. Confirmation no RLS/policy statements and no PII/seed data are present.
9. Explicit verdict + severity for Adjudication Item 1 (`event_sessions.notes` nullability).
10. Any additional findings not covered above.

Do not mark T010 complete yourself — report your findings; the foreman will update the ledger and route to boss-arbiter only if this fails 3 attempts.
