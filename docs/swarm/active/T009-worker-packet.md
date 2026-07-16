# Worker Packet: T009

## Task ID
T009

## Objective
Author an additive Supabase migration for the identity/roster tables — `profiles`, `teams`, `seasons`, `students`, `guardian_links` — exactly matching PRD Section 8.1's column-for-column field lists.

## Allowed Files
- `supabase/migrations/<timestamp>_identity_roster.sql` (one new migration file only; choose a timestamp prefix consistent with Supabase CLI migration naming convention)

## Forbidden Files
- `docs/swarm/**`
- `.claude/**`
- Any existing/prior migration file under `supabase/migrations/` — editing an applied migration is a constitution item 10 BLOCKER. This task is additive only: one new file.
- Anything outside the single allowed migration file.

## Acceptance Criteria
- Schema matches PRD 8.1 column-for-column for `profiles`, `teams`, `seasons`, `students`, `guardian_links` — no invented columns, no omitted columns, no renamed columns.
- Foreign keys use `on delete restrict` unless PRD 8.1 explicitly notes otherwise for a given relationship.
- No edits to any prior migration file (constitution item 10, BLOCKER if violated).
- This task does NOT require a live Supabase project. External blocker: George's new Supabase project does not yet exist (D1), so live-instance verification is not possible. Author the migration file and validate it structurally instead — e.g. apply it to a local/dev Supabase instance (`supabase db reset` / `supabase migration up` against local Postgres via the Supabase CLI) if the tooling is available in this environment, or otherwise validate the SQL is syntactically correct and self-consistent (checked with a local Postgres/SQL parser or dry static review) and clearly state in your output which validation method was used and why a live instance wasn't used.
- Do not assume or fabricate a live DB connection succeeded if one wasn't actually available — report exactly what validation you were able to perform.

## Relevant Constitution Excerpt
Item 10 (Database changes): "Database changes are additive migrations via the Supabase CLI; editing an applied migration file → BLOCKER."

Item 6 (No PII): fixtures/examples anywhere in this migration (comments, seed data if any) must use fabricated names only, never real student/family data.

Item 1 (Precedence): PRD requirement IDs (here, the 8.1 field lists) outrank this packet's paraphrase — if anything here appears to conflict with the actual PRD 8.1 text, follow the PRD and flag the discrepancy in your output rather than improvising.

Definition of Done: no worker may mark its own work complete; every checker must inspect the actual artifact, not just your summary. Your output below is evidence for the checker, not a self-certification.

## Most Recent Failure
None. First attempt on T009.

## Required Worker Output
- files changed (should be exactly one new file under `supabase/migrations/`)
- summary of the schema authored (table-by-table column list) for cross-check against PRD 8.1
- exact validation method used (local Supabase CLI apply, static SQL syntax check, etc.) and its output — be explicit that no live George-owned Supabase project was used
- confirmation no prior migration file was modified
- known risks (e.g. any PRD 8.1 ambiguity you had to interpret)
- whether a dispute is needed
