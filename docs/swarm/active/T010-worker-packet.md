# Worker Packet: T010

## Task ID
T010

## Objective
Author an additive Supabase migration for the scheduling/attendance tables — `invites`, `events`, `event_sessions`, `rsvps`, `attendance` — exactly matching PRD Section 8.1's column-for-column field lists.

## Allowed Files
- `supabase/migrations/<timestamp>_scheduling_attendance.sql` (one new migration file only; timestamp must sort after T009's `20260716000000_identity_roster.sql`, per Supabase CLI migration naming convention)

## Forbidden Files
- `docs/swarm/**`
- `.claude/**`
- `supabase/migrations/20260716000000_identity_roster.sql` (T009's file) — editing an applied migration is a constitution item 10 BLOCKER. This task is additive only: one new file.
- Any other existing migration file.

## Ground Truth (PRD 8.1 — use directly, no PRD access needed)
All tables: `id uuid pk default gen_random_uuid()`, `created_at timestamptz default now()`. FKs `on delete restrict` unless noted below.

| Table | Fields (beyond id/created_at) |
|---|---|
| invites | email text, role role_enum, student_id uuid null (self for students / linked kid for parents), invited_by fk profiles, status text('pending','accepted','expired','revoked'), expires_at timestamptz |
| events | season_id fk, type text('meeting','outreach','competition'), title, description, location_name, address, team_ids uuid[] null (null = all teams), counts_participation bool, counts_volunteer_hours bool, adult_volunteers_count int default 0, adult_volunteer_hours numeric default 0, created_by fk profiles null (null for imports) |
| event_sessions | event_id fk **on delete cascade** (the only noted exception in this batch — all other FKs default to restrict), session_date date, starts_at timestamptz, ends_at timestamptz, status text('scheduled','completed','canceled'), people_reached int null, notes text |
| rsvps | session_id fk, student_id fk, status text('going','maybe','declined'), responded_by fk profiles null (null for imports), updated_at, unique(session, student) |
| attendance | session_id fk, student_id fk, status text('present','late','excused','absent'), check_in_at timestamptz null, check_out_at timestamptz null, hours_override numeric null, method text('qr','coach','import'), recorded_by fk profiles null, updated_at, unique(session, student) |

Notes:
- `role_enum` already exists (created in T009's migration) — reference/reuse it; do NOT redefine or recreate the type.
- `events.season_id` references `seasons(id)` from T009's migration. FKs across migration files to T009's already-applied tables (`profiles`, `seasons`) work fine since T009 applies first.
- `event_sessions.event_id` is the only FK in this batch with `on delete cascade`; every other FK in this batch defaults to `on delete restrict`.

## Acceptance Criteria
- Schema matches PRD 8.1 column-for-column for `invites`, `events`, `event_sessions`, `rsvps`, `attendance` — no invented columns, no omitted columns, no renamed columns.
- `attendance` has `unique(session_id, student_id)`; `method` is a constrained enum/check `('qr','coach','import')`; `hours_override` present and nullable.
- `rsvps` has `unique(session_id, student_id)`.
- FKs `on delete restrict` except `event_sessions.event_id` which is `on delete cascade` per the explicit PRD note.
- Additive only — no edits to T009's migration file (constitution item 10, BLOCKER if violated).
- Do not redefine `role_enum`; reference the type created in T009's migration.

## Relevant Constitution Excerpt
Item 10 (Database changes): "Database changes are additive migrations via the Supabase CLI; editing an applied migration file → BLOCKER."

Item 6 (No PII): fixtures/examples anywhere in this migration (comments, seed data if any) must use fabricated names only, never real student/family data.

Item 1 (Precedence): PRD requirement IDs (the 8.1 field lists) outrank this packet's paraphrase — if anything here appears to conflict with the actual PRD 8.1 text, follow the PRD and flag the discrepancy in your output.

Definition of Done: no worker may mark its own work complete; the checker inspects the actual artifact, not your summary.

## Most Recent Failure
None. First attempt on T010.

## Required Worker Output
- files changed (should be exactly one new file under `supabase/migrations/`)
- summary of the schema authored (table-by-table column list) for cross-check against the ground truth above
- exact validation method used (local Supabase CLI apply against local Postgres, static SQL syntax check, etc. — same discretion as T009's precedent) and its output; be explicit that no live George-owned Supabase project was used
- confirmation no prior migration file (including T009's) was modified
- known risks (e.g. any 8.1 ambiguity you had to interpret)
- whether a dispute is needed
