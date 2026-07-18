# Worker Packet: T014

## Task ID
T014

## Objective
Add **persisted, re-runnable** SQL/unit fixture tests that prove T013's three metric views (`v_student_hours`, `v_student_participation`, `v_team_participation`) behave correctly on the four NFR-03 cases:
1. excused-shrinks-denominator
2. `hours_override`-wins
3. check-in clamping to the session window
4. no-completed-sessions "—" case

This is different from T013's own validation, which was ad hoc (run against a scratch Postgres, reported conversationally, never persisted to disk — see `docs/swarm/archive/T013-checker-packet.md` line 17, which explicitly notes no artifact exists). T014's deliverable is a real, checked-in test suite someone can run again later (e.g. in CI) — not a one-off verification transcript.

## Dependencies (status)
T013 — Passed (2026-07-17, clean, no findings). The three views are byte-verbatim PRD 8.4 copies; do not re-derive or modify them. See `docs/swarm/archive/T013-worker-packet.md` / `docs/swarm/archive/T013-checker-packet.md` for T013's full record.

## Allowed Files
- `supabase/tests/**` or `tests/metrics/**` — pick ONE of these two locations for fixtures + a runner script, do not split across both. Fixtures and runner only.

## Forbidden Files
- `supabase/migrations/**` (all five existing files — T009 through T013's metric-views migration). Do not edit, do not add a new migration. If your tests need seed data, load it via your own runner script/fixture SQL executed against an already-migrated scratch database, never via a new migration file.
- `src/**` (no TS reimplementation of any metric formula — constitution item 3, BLOCKER).
- `package.json` — do not add npm scripts or new dependencies here. If you determine you need a new dependency to build the runner (e.g. a Postgres client), you must NOT install it silently; see the "Dependency constraint" note below.
- `docs/swarm/**`, `.claude/**`.

## Ground Truth — the three views under test (read directly from the live migration file, do not trust this transcript for anything you can re-verify yourself)
Read `supabase/migrations/20260717000003_metric_views.sql` yourself first. Verbatim contents as of packet-writing time:

```sql
create or replace view v_student_hours as
select
  a.student_id,
  e.season_id,
  sum(coalesce(
    a.hours_override,
    case when a.check_in_at is not null and a.check_out_at is not null
      then greatest(extract(epoch from
        (least(a.check_out_at, es.ends_at) - greatest(a.check_in_at, es.starts_at))) / 3600.0, 0)
    end,
    extract(epoch from (es.ends_at - es.starts_at)) / 3600.0
  )) as confirmed_hours
from attendance a
join event_sessions es on es.id = a.session_id and es.status = 'completed'
join events e on e.id = es.event_id and e.counts_volunteer_hours
where a.status in ('present','late')
group by a.student_id, e.season_id;

create or replace view v_student_participation as
with expected as (
  select s.id as student_id, s.team_id, es.id as session_id, e.season_id
  from students s
  join events e on e.counts_participation
    and (e.team_ids is null or s.team_id = any(e.team_ids))
  join event_sessions es on es.event_id = e.id and es.status = 'completed'
  where s.is_active
)
select
  x.student_id, x.team_id, x.season_id,
  count(*) as expected_ct,
  count(*) filter (where a.status in ('present','late')) as present_ct,
  count(*) filter (where a.status = 'late')    as late_ct,
  count(*) filter (where a.status = 'excused') as excused_ct,
  round(100.0 * count(*) filter (where a.status in ('present','late'))
        / greatest(count(*) - count(*) filter (where a.status = 'excused'), 1), 1)
    as participation_pct
from expected x
left join attendance a
  on a.session_id = x.session_id and a.student_id = x.student_id
group by x.student_id, x.team_id, x.season_id;

create or replace view v_team_participation as
select team_id, season_id,
  round(100.0 * sum(present_ct) / greatest(sum(expected_ct) - sum(excused_ct), 1), 1)
    as participation_pct
from v_student_participation
group by team_id, season_id;
```

Note the participation denominator arithmetic: `expected_ct - excused_ct` (not `expected_ct`), floored at 1 by `greatest(...,1)` to avoid division by zero. This is exactly what case 1 (excused-shrinks-denominator) below is testing.

## Ground Truth — table schemas your fixtures write into (read directly from the migration files, do not guess column names)
Relevant columns only; read the full files yourself for anything not listed here.

From `supabase/migrations/20260716000000_identity_roster.sql`:
- `teams(id, name, short_name, program, color, archived, sort_order, created_at)`
- `seasons(id, name, starts_on, ends_on, default_goal_hours, is_active, created_at)`
- `students(id, profile_id, display_name, team_id, grad_year, is_active, goal_hours_override, created_at)`

From `supabase/migrations/20260717000000_scheduling_attendance.sql`:
- `events(id, season_id, type, title, description, location_name, address, team_ids uuid[], counts_participation, counts_volunteer_hours, adult_volunteers_count, adult_volunteer_hours, created_by, created_at)` — `team_ids` null means "applies to all teams."
- `event_sessions(id, event_id, session_date, starts_at, ends_at, status ('scheduled'|'completed'|'canceled'), people_reached, notes, created_at)`
- `attendance(id, session_id, student_id, status ('present'|'late'|'excused'|'absent'), check_in_at, check_out_at, hours_override, method ('qr'|'coach'|'import'), recorded_by, updated_at, created_at)` — `unique(session_id, student_id)`.

Fabricated names only for every fixture row (constitution item 6) — no real VOLT student/parent names, e.g. use placeholders like "Fixture Student A".

## The four cases to cover — exact definitions (cross-referenced from T013's checker packet, `docs/swarm/archive/T013-checker-packet.md` step 6, which is the most precise existing statement of these cases)

**a. excused-shrinks-denominator** — a student with `expected_ct = 2` (one `present` session, one `excused` session against completed sessions of a `counts_participation` event) must show the excused row reducing the denominator (`expected_ct - excused_ct` = 1), not just failing to count in the numerator. With 1 present out of a denominator of 1, `participation_pct` should compute to 100.0, not 50.0 (which is what you'd get if excused only failed to count as present without shrinking the denominator). Assert the exact numeric value and show your arithmetic in the test/comment.

**b. hours_override-wins** — a student with a full `check_in_at`/`check_out_at` span that would otherwise compute to some duration X, but with `attendance.hours_override` explicitly set to a different value Y, must show `confirmed_hours = Y` in `v_student_hours`, not X. Pick X and Y far enough apart that a bug (override ignored) is unambiguous.

**c. check-in clamping to the session window** — two sub-cases, both required:
   - (i) a check-in before `es.starts_at` and/or a check-out after `es.ends_at` must clamp to `es.starts_at`/`es.ends_at` respectively — the credited duration must equal the session window length, not the (wider) actual check-in/check-out span.
   - (ii) a check-in/check-out pair that falls entirely outside the session window (e.g. both timestamps after `es.ends_at`) must clamp to zero hours, never a negative number (this is what `greatest(...,0)` in the view guards against — prove it actually holds).

**d. no-completed-sessions "—" case** — a student/team whose only session(s) never reach `status = 'completed'` (e.g. still `'scheduled'`) must produce **zero rows** from `v_student_participation`/`v_team_participation`, not a row with `expected_ct = 0`. Assert an empty result set directly (row count = 0), not by inference from some other field.

## Dependency constraint — read before choosing your test-runner mechanism
No Postgres client library (e.g. `pg`/`node-postgres`) is in the project's dependency allowlist (constitution item 9: `@astryxdesign/*`, `@supabase/supabase-js`, `@tanstack/react-query`, `react-router-dom`, `qrcode.react`, `ical-generator`, plus dev tooling — vitest, playwright, eslint, prettier). You may NOT `npm install` a new package to build this runner without boss-architect approval, which you do not have.

Acceptable approaches, in rough order of preference:
1. **pgTAP via the Supabase CLI** (`supabase test db`), if the Supabase CLI is installed and a local Postgres can be started in this sandbox (same precedent T009–T013 used for scratch-Postgres validation — check what tooling those tasks' workers actually had available; their archived packets/checker packets describe what worked). This is the standard, idiomatic way to ship persisted SQL fixture tests for a Supabase project and fits the `supabase/tests/**` Allowed Files path naturally.
2. A plain shell script (`.sh`) that pipes fixture SQL + assertions through `psql` against a scratch/local Postgres instance, with the assertions expressed as SQL that raises an error (or prints a clear FAIL line) on mismatch, and the script exiting non-zero on any failure. This needs no new npm dependency at all.
3. If genuinely neither `psql` nor a startable local Postgres is available in this sandbox, say so explicitly, do not fabricate passing output, and propose (but do not silently install) what you'd need — flag this as a risk in your worker output rather than working around it by, e.g., re-implementing the view logic in a Vitest/TS unit test (that would violate constitution item 3's formula-duplication BLOCKER).

Whichever mechanism you use, the runner must be self-contained inside your chosen Allowed Files location — you cannot add a `package.json` script to invoke it (that file is forbidden), so document the exact command to run it (e.g. `supabase test db` or `bash supabase/tests/run.sh`) in a short comment at the top of the runner file itself.

## Acceptance Criteria
- All four documented cases (a–d above) pass against T013's already-Passed, unmodified views.
- Fixtures use fabricated names only (constitution item 6).
- No existing migration file is touched (constitution item 10) — verify via direct read/diff of all five files in `supabase/migrations/`, not git history.
- No metric formula is reimplemented in TypeScript or anywhere under `src/` — this task shouldn't touch `src/` at all; confirm with `grep -rn "participation_pct\|confirmed_hours\|hours_override" src/` and report zero new hits versus T013's baseline (T013 already confirmed zero; this task must not introduce any).
- Tests are re-runnable, not a one-off transcript — another agent must be able to execute your documented command and get the same pass/fail result.
- If a scratch Postgres/psql/Supabase CLI genuinely isn't available, say so explicitly and explain exactly what you did instead — do not claim a live-DB pass you didn't actually run (same standard T009–T013 held to).

## Relevant Constitution Excerpts
- Item 3: "RLS policies and metric SQL come only from PRD Section 8.4, copied verbatim. Re-deriving either, or duplicating a metric formula in TypeScript (PRD DATA-01) → BLOCKER."
- Item 6: "No PII (student names, emails) in logs, URLs, analytics, commit messages, or test fixtures — fixtures use fabricated names."
- Item 9: "Dependency allowlist... Anything else requires boss-architect approval recorded in the ledger."
- Item 10: "Database changes are additive migrations via the Supabase CLI; editing an applied migration file → BLOCKER."
- Non-Negotiable: "No worker may mark its own work complete."

## Most Recent Failure
None. This is the first attempt (attempt count: 0).

## Required Worker Output
- files created (exact paths)
- full contents of fixture files and the runner
- the exact command to (re-)run the suite
- real command output showing all four cases passing (or an explicit, honest statement of what was NOT verifiable and why)
- grep output confirming no new TS formula duplication
- confirmation no migration file was touched (diff or explicit statement)
- known risks (e.g. tooling limitations, anything about case (d)'s "empty result set, not expected_ct=0 row" assertion that felt ambiguous)
- whether a dispute is needed
