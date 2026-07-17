# Checker Packet: T011

## Task ID
T011 — Migration: support tables + audit triggers (DATA-02)

## Checker Agent
checker-tests

## Attempt
Check attempt 1 of 3 (max 3 before mandatory boss-arbiter escalation per constitution "Loop Limit").

## Objective Being Checked
One additive Supabase migration, `supabase/migrations/20260717000001_support_audit.sql`, creating the four remaining PRD 8.1 support tables (`notification_prefs`, `calendar_feeds`, `email_log`, `audit_log`) plus five DATA-02 database triggers that write `audit_log` rows: attendance edits made after session completion, profile role changes, student deactivations, event/session cancellations, and invite revocations. Do not trust the worker's self-report below — it is provided as a map of claims to independently re-verify, not as evidence.

## Allowed Files
- `supabase/migrations/20260717000001_support_audit.sql` (new file only)

## Forbidden Files (BLOCKER if touched)
- `supabase/migrations/20260716000000_identity_roster.sql` (T009)
- `supabase/migrations/20260717000000_scheduling_attendance.sql` (T010)
- `docs/swarm/**`, `.claude/**`
- Anything outside the single new migration file above

## Ground Truth — PRD 8.1 remaining tables (verified, use directly)
All tables: `id uuid primary key default gen_random_uuid()`, `created_at timestamptz not null default now()`. FKs `on delete restrict` unless noted.

| Table | Fields (beyond id/created_at) |
|---|---|
| `notification_prefs` | `profile_id` fk `profiles`, unique; one bool per EML-02 category: `invite`, `signup_confirm`, `event_reminder_48h`, `event_reminder_3h`, `meeting_reminder_3h`, `weekly_digest`; `digest_enabled` bool default true |
| `calendar_feeds` | `profile_id` fk `profiles`; `token` uuid unique default `gen_random_uuid()`; `revoked_at` timestamptz null |
| `email_log` | `to_email` text; `template` text; `session_id` uuid null; `profile_id` uuid null; `status` text; `sent_at` timestamptz |
| `audit_log` | `actor` fk `profiles`; `action` text; `entity` text; `entity_id` uuid; `meta` jsonb |

`role_enum` must be reused from T009's migration (`20260716000000_identity_roster.sql`), never redefined.

## What's on disk (context only — verify independently, do not trust this description)
- `notification_prefs`: all 4 base cols + 6 category bools + `digest_enabled`, all `not null default true`. Worker extended the `default true` beyond `digest_enabled` (the only column the ground truth explicitly defaults) to all 6 category bools — flagged as Design Decision 2 below, needs your verdict.
- `calendar_feeds`: matches ground truth as given (`profile_id` fk not null, `token` unique default gen_random_uuid(), `revoked_at` nullable).
- `email_log`: matches ground truth column list; `session_id`/`profile_id` have **no FK constraint** (bare `uuid`, nullable) — worker's stated reasoning is that the field list marks them `null` but not `fk`, and log rows should survive deletion of the referenced row. Flagged as Design Decision 3 below.
- `audit_log`: `actor uuid not null references public.profiles (id) on delete restrict` — NOT NULL, no default. Flagged as Design Decision 1 below.
- Five trigger functions, each `security definer`, `set search_path = public, pg_temp`, using the actor expression `coalesce(auth.uid(), nullif(current_setting('app.actor_id', true), '')::uuid)`:
  1. `fn_audit_attendance_post_completion` / `trg_audit_attendance_post_completion` — `after update on attendance`, no `WHEN` clause; inside the function body it does `select status into v_session_status from event_sessions where id = new.session_id` and only inserts the audit row `if v_session_status = 'completed'`. This means it looks up live status via `NEW.session_id` on every attendance UPDATE (not just checking `OLD`/`NEW` on `attendance` itself). Confirm this correctly excludes edits made while the session is `scheduled`/`canceled`.
  2. `fn_audit_profile_role_change` / `trg_audit_profile_role_change` — `after update on profiles`, `WHEN (old.role IS DISTINCT FROM new.role)`.
  3. `fn_audit_student_deactivation` / `trg_audit_student_deactivation` — `after update on students`, `WHEN (old.is_active = true AND new.is_active = false)`. Reactivation (`false -> true`) is deliberately NOT audited (worker cites packet's ambiguity-fallback instruction).
  4. `fn_audit_session_cancellation` / `trg_audit_session_cancellation` — `after update on event_sessions` (not `events`), `WHEN (old.status IS DISTINCT FROM new.status AND new.status = 'canceled')`. Worker's justification: `events` (per T010's migration on disk) has no `status` column at all; only `event_sessions.status` carries the `'scheduled'|'completed'|'canceled'` check constraint.
  5. `fn_audit_invite_revocation` / `trg_audit_invite_revocation` — `after update on invites`, `WHEN (old.status IS DISTINCT FROM new.status AND new.status = 'revoked')`.
- All five `meta jsonb` payloads observed in the file only contain: IDs (`session_id`, `student_id`, `event_id`), enum/status value pairs (`old_status`/`new_status`, `old_role`/`new_role`, `old_is_active`/`new_is_active`). No names/emails/free text appear in any payload in the file as read.

## Required Verification Steps
1. **Column-by-column diff.** Read `supabase/migrations/20260717000001_support_audit.sql` directly and diff every column of all four tables against the ground-truth table above. Flag any missing/extra/mistyped column, wrong nullability, wrong default, or wrong FK target/on-delete action.
2. **Trigger logic — real test preferred.** Check whether Postgres/psql (or a local Supabase CLI stack / docker postgres) is available in this environment. If so, apply T009 → T010 → T011 in order to a scratch database and independently re-run the five DATA-02 test cases yourself (do not reuse or trust the worker's reported test output):
   - attendance UPDATE while parent `event_sessions.status = 'scheduled'` → expect 0 audit_log rows; then flip the session to `'completed'` and UPDATE attendance again → expect exactly 1 row with `entity='attendance'`.
   - `profiles.role` UPDATE to the same value → 0 rows; UPDATE to a different value → exactly 1 row.
   - `students.is_active` `true -> false` → exactly 1 row; `false -> true` (reactivation) → 0 rows (confirm no spurious row); any other no-op update → 0 rows.
   - `event_sessions.status` transition to `'canceled'` → exactly 1 row with `entity='event_sessions'`; transition between other statuses (e.g. `scheduled -> completed`) → 0 rows.
   - `invites.status` transition to `'revoked'` → exactly 1 row; transition to any other status → 0 rows.
   If no Postgres is reachable, state that explicitly and instead do rigorous static review of each trigger function body and `WHEN` clause line-by-line against the five case definitions, treating any logic gap you find the same as a failed live test (do not pass on the basis of "looks right" alone — trace each branch).
3. **`role_enum` reuse.** Grep the T011 file for `create type role_enum` — confirm it does not appear (must not be redefined). Note that no table in this migration actually uses `role_enum` as a column type; confirm this is consistent with the ground truth (T011's four tables have no role column) rather than a missed requirement.
4. **events vs event_sessions cancellation table.** Read T010's migration file (`supabase/migrations/20260717000000_scheduling_attendance.sql`) directly yourself and confirm `events` has no `status` column and `event_sessions.status` is the only column with the `'scheduled'|'completed'|'canceled'` check constraint. Confirm the cancellation trigger is attached to `event_sessions`, not `events`.
5. **Design decision adjudication — give an explicit verdict and severity (BLOCKER/MAJOR/MINOR/NIT/not-an-issue) for each of the following three, do not skip any:**
   a. **`audit_log.actor` is `NOT NULL` with no default**, following the established fk-not-marked-null convention. Consequence: any future automated/background write (e.g. T051 `send-reminders`, an auto-complete-session cron, T036 End meeting, T042 Mark day complete) that fires one of these triggers without a resolvable `auth.uid()` or `app.actor_id` session variable will hard-fail the *entire* triggering UPDATE, not just skip the audit write. Assess whether this is the correct reading of constitution item 6 (no PII beyond IDs in `meta`) and the established NOT NULL convention, or whether `actor` should be nullable for system-initiated changes. If you rule this acceptable (non-blocking), explicitly recommend that it be flagged for T051, T036, and T042 (and any other task doing server-side/automated writes to `attendance`, `profiles`, `students`, `event_sessions`, `invites`) so those tasks know they must `SET LOCAL app.actor_id` before such writes.
   b. **`notification_prefs`: all 6 EML-02 category bools default to `true`**, not just `digest_enabled` (the only column the ground truth explicitly specifies a default for). Assess whether defaulting all prefs to opted-in is a reasonable, consistent interpretation or an overreach beyond the literal field spec.
   c. **No FK on `email_log.session_id`/`email_log.profile_id`.** Confirm against the ground-truth table above that these two columns are specified only as `null` (not `fk`), and assess whether omitting the FK constraint (so log rows survive deletion of the referenced session/profile) is the correct reading, or whether an FK with a softer `on delete set null`/similar was expected instead.
6. **T009/T010 zero-diff check.** Confirm `supabase/migrations/20260716000000_identity_roster.sql` and `supabase/migrations/20260717000000_scheduling_attendance.sql` are byte-identical to their on-disk content quoted in this packet's Ground Truth / What's-on-disk sections — i.e. confirm no edits were made to either file (constitution item 10, BLOCKER if any diff found). Do not use git commit history as evidence of authorship — compare current file content directly.
7. **PII check in `meta jsonb`.** Read all five trigger function bodies directly in the migration file and list exactly what goes into each `jsonb_build_object(...)` call. Confirm every key/value is an ID, enum/status string, or boolean — never a name, email, or other free-text/identifying field (constitution item 6, BLOCKER if violated). Do not accept the worker's example payloads as sufficient evidence; read the actual `jsonb_build_object` calls yourself.
8. **File count / scope check.** Confirm exactly one new file exists under `supabase/migrations/` beyond the T009/T010 baseline, and that nothing else in the repo was touched.

## Relevant Constitution Excerpt
Item 1 (Precedence): "PRD requirement IDs > this constitution > task-ledger text > agent judgment. Conflicts are disputes for boss-arbiter — never improvised around."

Item 6 (Security & privacy): "No PII (student names, emails) in logs, URLs, analytics, commit messages, or test fixtures — fixtures use fabricated names... BLOCKER."

Item 10 (Stack locks): "Database changes are additive migrations via the Supabase CLI; editing an applied migration file → BLOCKER."

Definition of Done: no task may be marked complete on a worker self-report; the checker inspects the actual artifact and generates its own evidence.

Failure Severity table applies to every finding, including the three design-decision adjudications in step 5 (BLOCKER/MAJOR/MINOR/NIT/not-an-issue).

## Known Context / Non-Issues (do not re-flag as new findings, but do verify each is actually true)
- Worker's claim that `events` has no `status` column (making `event_sessions` the correct cancellation-trigger table) is expected to be correct per T010's file as read for this packet — but re-confirm yourself in step 4 rather than accepting it as given.
- The three design decisions in step 5 are not automatically defects — they require your explicit adjudication and severity, not a rubber-stamp pass or fail.

## Most Recent Failure
None — this is T011's first check attempt.

## Required Checker Output (per constitution Evidence Requirements)
- files inspected
- exact commands run + real quoted output (not summarized/paraphrased) — including whether a scratch Postgres was available and, if so, the real SQL you ran and its real result rows for all five DATA-02 cases plus the reactivation/no-op negative checks
- column-by-column diff result for all four tables
- trigger-by-trigger pass/fail per DATA-02 case
- explicit verdict + severity for each of the three design decisions (5a, 5b, 5c)
- T009/T010 zero-diff confirmation
- PII scan result for all five `meta` payloads
- overall pass/fail result
- exact failure reason(s), if any, with severity classification (BLOCKER/MAJOR/MINOR/NIT)
- recommended next action

Do not mark this task complete based on the worker's self-report. Inspect the actual migration file and generate independent evidence (live DB test preferred, rigorous static trace if unavailable).
