# Worker Packet: T011

## Task ID
T011

## Objective
Author one additive Supabase migration creating the four remaining PRD 8.1 support tables (`notification_prefs`, `calendar_feeds`, `email_log`, `audit_log`) plus the DATA-02 database triggers that write `audit_log` rows for five specific events: attendance edits made after a session has completed, profile role changes, student deactivations, event/session cancellations, and invite revocations.

## Allowed Files
- One new file: `supabase/migrations/<timestamp>_support_audit.sql`, where `<timestamp>` follows the existing `YYYYMMDDHHMMSS` naming convention and must sort **after** T010's `20260717000000_scheduling_attendance.sql` (e.g. `20260717000001` or later — your choice, just keep the format and ordering).

## Forbidden Files
- `supabase/migrations/20260716000000_identity_roster.sql` (T009) — do not edit; constitution item 10, BLOCKER if violated.
- `supabase/migrations/20260717000000_scheduling_attendance.sql` (T010) — do not edit; constitution item 10, BLOCKER if violated.
- `docs/swarm/**`
- `.claude/**`
- Anything outside the single new migration file named above.

## Ground Truth — PRD 8.1 table specs (use directly, do not re-derive)
All tables: `id uuid primary key default gen_random_uuid()`, `created_at timestamptz not null default now()`. FKs `on delete restrict` unless noted. Reuse `role_enum` from T009's migration — do not redefine it.

| Table | Fields (beyond id/created_at) |
|---|---|
| `notification_prefs` | `profile_id` fk `profiles`, unique; one bool per EML-02 category: `invite`, `signup_confirm`, `event_reminder_48h`, `event_reminder_3h`, `meeting_reminder_3h`, `weekly_digest`; `digest_enabled` bool default true |
| `calendar_feeds` | `profile_id` fk `profiles`; `token` uuid unique default `gen_random_uuid()`; `revoked_at` timestamptz null |
| `email_log` | `to_email` text; `template` text; `session_id` uuid null; `profile_id` uuid null; `status` text; `sent_at` timestamptz |
| `audit_log` | `actor` fk `profiles`; `action` text; `entity` text; `entity_id` uuid; `meta` jsonb |

Existing tables you will reference (already created by T009/T010, do not redefine): `profiles`, `students`, `events`, `event_sessions`, `attendance`, `invites`. Their exact column names/types are visible in the two prior migration files on disk — read them before writing FK/trigger column references so your trigger `WHEN`/`NEW`/`OLD` logic lines up with the real column names (e.g. `attendance.session_id`, `event_sessions.status`, `profiles.role`, `students.is_active`, `events.status`/`event_sessions.status` for cancellation, `invites.status`).

## DATA-02 trigger requirements (five cases — one trigger each, or combined however you judge cleanest, but all five must fire correctly and independently)
1. **Attendance edits after session completion**: a trigger on `attendance` `UPDATE` that fires an `audit_log` write **only when the parent `event_sessions.status = 'completed'` at the time of the edit** — i.e. look up the current session status via `NEW.session_id` inside the trigger, not any stored/cached completion flag from insert time. Edits to attendance while the session is still `scheduled` must NOT audit-log (that's normal live check-in activity, not a post-completion correction).
2. **Role changes**: a trigger on `profiles` `UPDATE` that fires when `role` actually changes value (`OLD.role IS DISTINCT FROM NEW.role`), not on every profile update.
3. **Deactivations**: a trigger on `students` `UPDATE` that fires when `is_active` flips from `true` to `false` specifically (`OLD.is_active = true AND NEW.is_active = false`), not on every students update and not on the reverse (reactivation) unless you judge PRD DATA-02 implies both — if ambiguous, audit-log the `true→false` transition only and note the ambiguity in your output rather than guessing silently.
4. **Event/session cancellations**: a trigger (on `events` and/or `event_sessions`, whichever table actually carries the `status` transitioning to `'canceled'` per the existing schema — check both, since `events` has no status column in T010's migration and `event_sessions.status` is the one with the `'scheduled'|'completed'|'canceled'` check constraint) that fires when status transitions specifically to `canceled`.
5. **Invite revocations**: a trigger on `invites` `UPDATE` that fires when `status` transitions specifically to `'revoked'` (`OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'revoked'`).

Each trigger writes one `audit_log` row with:
- `actor`: the acting profile's id. Supabase Postgres exposes `auth.uid()` inside trigger functions running under RLS-authenticated contexts; use that as the primary source. Note explicitly in your output whether you also add a session-variable fallback (e.g. `current_setting('app.actor_id', true)`) for contexts where `auth.uid()` may not resolve (service-role/background writes) — your call, but state the choice and reasoning rather than silently picking one.
- `action`: a short text description of what happened (your naming convention — document it).
- `entity`: the table name the change occurred on (e.g. `'attendance'`, `'profiles'`, `'students'`, `'event_sessions'`, `'invites'`).
- `entity_id`: the id of the changed row.
- `meta`: jsonb. **No PII beyond IDs** — constitution item 6, BLOCKER if violated. Do not put student/parent names, emails, or any other identifying text into `meta`; only IDs, enum/status values, and non-identifying structural data (e.g. `{"old_status": "scheduled", "new_status": "completed"}` is fine; `{"student_name": "..."}` is not).

## Acceptance Criteria
- All four support tables (`notification_prefs`, `calendar_feeds`, `email_log`, `audit_log`) created exactly per the field lists above, following the same `id`/`created_at`/FK-restrict conventions T009 and T010 already established.
- `role_enum` reused from T009's migration, not redefined.
- All five DATA-02 trigger cases implemented and independently testable; each fires only on the correct transition (not on every unrelated update to the same table).
- `meta jsonb` contains no PII beyond IDs on any trigger (constitution item 6, BLOCKER if violated).
- T009's and T010's migration files are byte-identical to their current on-disk state — zero diff (constitution item 10, BLOCKER if violated).
- Exactly one new migration file exists for this task.

## Relevant Constitution Excerpt
Item 6 (Security & privacy): "No PII (student names, emails) in logs, URLs, analytics, commit messages, or test fixtures — fixtures use fabricated names... BLOCKER."

Item 10 (Stack locks): "Database changes are additive migrations via the Supabase CLI; editing an applied migration file → BLOCKER."

Item 1 (Precedence): PRD requirement IDs (DATA-02, and the 8.1 table field lists) outrank this packet's paraphrase — if this packet appears to conflict with actual PRD text, follow the PRD and flag the discrepancy in your output rather than improvising around it.

Definition of Done: no worker may mark its own work complete; the checker inspects the actual artifact, not your summary.

## Most Recent Failure
None. First attempt on T011.

## Required Worker Output
- file created (single migration file path)
- full SQL diff/content for the four tables and all five triggers
- explicit note of the `actor` resolution strategy chosen (auth.uid() only, or auth.uid() + session-variable fallback) and why
- explicit note of how you handled the deactivation-reactivation ambiguity (case 3) and the events-vs-event_sessions cancellation ambiguity (case 4)
- test output per DATA-02 case (five cases) demonstrating each trigger fires on the correct transition and does NOT fire on unrelated updates to the same table (e.g. attendance edited while session still `scheduled` should NOT audit-log)
- confirmation `meta jsonb` payloads contain no PII beyond IDs, with example payloads quoted
- confirmation T009's and T010's migration files are untouched (diff or explicit "no change")
- known risks
- whether a dispute is needed
