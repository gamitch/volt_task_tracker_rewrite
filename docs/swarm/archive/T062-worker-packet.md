# Worker Packet: T062

## Task ID
T062

## Objective
Build the idempotent ETL script `scripts/migrate.ts` (MIG-03): reads from the old Lovable Cloud Supabase project and writes to the new project, using service-role keys for both (env-provided, **never committed**), natural-key upserts, and a `--dry-run` mode that prints per-table counts plus a migration report (unmatched teams, unparseable times, attendees-backfill mismatches) **without writing anything**.

## Dependencies (status)
- T061 (schema verification + mapping doc copy, MIG-01/02) — Passed. Produced `docs/migration/mapping.md` (a verbatim copy of PRD Section 10.2) and `docs/migration/source-schema.md`. **Your column mapping must match `docs/migration/mapping.md` exactly** — read that file yourself before writing any mapping logic; it is reproduced in full in Ground Truth below, but the file itself is the source of truth if this packet and the file ever disagree (they shouldn't — both trace to the same PRD 10.2 text).

## Allowed Files
- `scripts/migrate.ts` (new — confirm via `Glob` that `scripts/` doesn't exist yet)
- `scripts/migrate/**` (new — supporting modules, e.g. per-table transform functions, a dry-run reporter, env/secret loading)

## Forbidden Files
- `supabase/migrations/**` — the new-project schema is frozen; this script writes *data* into the existing schema, it does not alter it.
- `docs/migration/**` — T061's deliverables (`mapping.md`, `source-schema.md`) are read-only references for you; do not edit them, even to "correct" something — if you find a genuine discrepancy between `mapping.md` and this packet, flag it as a dispute candidate rather than editing either.
- `.env`, `.env.example`, `.env.local.example` — do not commit any real credential to any of these or any other tracked file (constitution item 5, BLOCKER). If you need to document expected env var names, do so in a code comment in `scripts/migrate.ts` itself (values blank/absent), following the existing convention in `docs/swarm/COWORK-HANDOFF.md` (which already names `OLD_SUPABASE_URL` / `OLD_SERVICE_ROLE_KEY` as the expected env vars for this exact script — cite this, don't reinvent different names).
- `docs/swarm/**`, `.claude/**`.

## Ground Truth — `docs/migration/mapping.md` (verbatim copy of PRD Section 10.2; reproduced here in full so you don't have to context-switch, but treat the actual file as authoritative if any diff is ever suspected)

| Old | New | Rule |
|---|---|---|
| `teams.*` | `teams.*` | 1:1 including short_name, archived, sort_order; `program` left null for George to set later |
| `students.name` | `students.display_name` | direct |
| `students.team_affiliation` | `students.team_id` | join on `teams.name`; unmatched values create an archived team and appear in the migration report |
| `students.goal_hours` | `students.goal_hours_override` | direct |
| `students.active` | `students.is_active` | direct |
| `app_settings.season_goal` | `seasons.default_goal_hours` | create season "2025–2026" spanning min→max session dates, `is_active=false`; George creates the new active season at cutover (SET-04) |
| `events.name / location / notes / category / adult_volunteers_count / adult_volunteer_hours` | `events.title / location_name / description / type / adult_volunteers_count / adult_volunteer_hours` | direct (category vocabulary is identical); `team_ids = null` (all-team scope); counts flags per type defaults (CMP-02); `season_id` assigned by date; `created_by = null` |
| `events.date / start_time / end_time / is_multi_day / attendees / status / duration_hours` | — | dropped: sessions are authoritative. ETL asserts migration 2's backfill covered every event and every `attendees[]` uuid before dropping |
| `event_sessions.date + start_time/end_time` (text) | `event_sessions.starts_at / ends_at` (timestamptz) | parse in America/Chicago; unparseable strings fall back to 00:00 and are flagged in the migration report |
| parent `events.status` | `event_sessions.status` | 'completed' when old event status='completed' AND session date ≤ cutover date, else 'scheduled' |
| `session_attendance` where `planned=true` | `rsvps` | status `going`, `responded_by = null` |
| `session_attendance` where `planned=false` | `attendance` | status `present`, `method='import'`, `check_in_at/check_out_at = null`, **`hours_override = old hours`, always set** — guarantees hour totals match the old views exactly |

Mapping notes (verbatim from the same document): (a) migrated meetings carry all-team scope, so pre-cutover participation % is approximate — Reports label imported seasons "imported"; (b) no historical late/excused/absent data exists; imported attendance is present-only; (c) `notes` on old events lands in `events.description`.

## Ground Truth — old schema (from `docs/migration/source-schema.md` / PRD 10.1 — **NOT independently live-verified**, see External Blocker below)
| Old table | Columns |
|---|---|
| `students` | id, name, team_affiliation (text; joins against `teams.name`), active, goal_hours (nullable numeric), created_at |
| `events` | id, date, start_time (text), end_time (text), name, location, duration_hours, attendees uuid[] (legacy), adult_volunteers_count, adult_volunteer_hours, notes, is_multi_day, status ('planned'\|'completed'), category ('outreach'\|'meeting'\|'competition'), created_at |
| `event_sessions` | id, event_id (cascade), date, start_time (text), end_time (text), duration_hours, created_at |
| `session_attendance` | id, session_id, student_id, hours, planned (bool: true=expected/RSVP, false=confirmed actual), created_at, unique(session_id, student_id) |
| `teams` | id, name (unique), short_name, color, archived, sort_order, created_at |
| `app_settings` | singleton row: season_goal (default 100) |

**No `people_reached` column exists in the old schema** — that metric starts fresh in the new app, do not attempt to migrate it.

## Ground Truth — new schema tables you write to (read the actual migration files yourself before writing insert logic — do not guess column names)
- `teams`, `students`, `seasons` — `supabase/migrations/20260716000000_identity_roster.sql`
- `events`, `event_sessions`, `rsvps`, `attendance` — `supabase/migrations/20260717000000_scheduling_attendance.sql`

## Known Context / Traps

**1. Natural-key upserts and idempotency.** "Idempotent" (this task's own acceptance criterion) means running the script twice against the same old-project state must not create duplicate rows in the new project. Since the new schema uses generated `uuid` primary keys (not carried over from the old integer/uuid ids in a 1:1 way for every table — confirm which old ids *are* natural keys you can upsert against, e.g. `teams.name` is unique in both old and new schemas per the mapping table, making it a legitimate natural key; `students` has no such unique natural key in the new schema, so you likely need your own mapping-table/idempotency mechanism, e.g. tracking old-id→new-id correspondence in a side table or a deterministic derived key — document whichever approach you choose and why).

**2. The `events` "dropped" columns assertion (mapping table row: "ETL asserts migration 2's backfill covered every event and every `attendees[]` uuid before dropping").** This is a **data-integrity gate**, not a formality: before your script treats old `events.attendees[]` as safely droppable, it must verify every uuid in every event's `attendees[]` array has a corresponding `session_attendance` row (the "migration 2" backfill referenced is part of the *old* project's own history, not something this script performs) — if any `attendees[]` uuid has no matching `session_attendance` row, this is exactly the kind of "attendees-backfill mismatch" the dry-run report must surface, per this task's own acceptance criterion. Do not silently assume this backfill is always complete.

**3. Time parsing (America/Chicago) failure mode is explicitly specified — do not invent a different fallback.** Per the mapping table: "parse in America/Chicago; unparseable strings fall back to 00:00 and are flagged in the migration report." Implement exactly this fallback (not, e.g., skipping the row, not throwing) and make sure the flagged report actually lists which rows fell back, not just a count.

**4. `hours_override` "always set" is a correctness-critical detail, not a stylistic choice.** For every migrated `session_attendance` row where `planned=false`, `attendance.hours_override` must be set to the **old row's `hours` value**, always — per the mapping's own explanation, this is specifically so post-migration hour totals reconcile exactly against the old `student_hour_summary`/`event_hour_summary` views (this is what MIG-04's validation gate, T063, will check). Do not compute/derive an hours value from session duration instead — use the old row's literal `hours` value, unconditionally.

**5. `--dry-run` must write nothing.** Structure the script so the same transform/validation logic path is used for both dry-run and real-run modes, with only the final write step gated by the flag — this is the only way to guarantee dry-run output accurately previews what a real run would do, rather than being a separately-maintained (and inevitably divergent) reporting-only code path.

**6. Idempotent `seasons` creation.** Per the mapping table: create a season "2025–2026" spanning min→max session dates, `is_active=false`. Running the script twice must not create two such seasons — check for an existing season with that name (or another stable identifying marker you choose and document) before creating a new one.

## External Blocker — flag this explicitly, do not fabricate live verification
No live old-project connection is reachable in this sandbox (T061 already confirmed and documented this exhaustively in `docs/migration/source-schema.md` — read it yourself; it is the canonical record of what was checked: no `OLD_SUPABASE_URL`/`OLD_SERVICE_ROLE_KEY` in the environment, no local `.env` file, no filesystem mirror of the old project, GitHub access to `github.com/gamitch/volt-timetracker` returns a real HTTP 403 for this session, no network reachability to any old-project database). **This means you cannot run this script against real old-project data and cannot produce a real dry-run report from live data.** What you can and must do:
1. Write structurally correct, secret-free, idempotent TypeScript implementing every transform rule in the Ground Truth mapping table above.
2. Build and run the script against **fabricated fixture data** (constitution item 6 — fictional names only) shaped exactly like the old schema, covering: a normal team/student/event/session migration, an unmatched-team case (student's `team_affiliation` doesn't match any `teams.name`), an unparseable time string, an `attendees[]` uuid with no matching `session_attendance` row, and both `planned=true`/`planned=false` `session_attendance` rows. Show real `--dry-run` output against this fixture data.
3. State plainly that this is fixture-driven verification, not a real old-project dry run, and that the genuine MIG-03 acceptance (a real dry-run report against the actual old project) remains blocked on George supplying `OLD_SUPABASE_URL`/`OLD_SERVICE_ROLE_KEY` — same unblock path T061 already documented, do not re-litigate it, just cite it.

## Acceptance Criteria
- **BLOCKER-class (constitution item 5):** no service-role key (old or new project) ever committed to any tracked file — read only via `process.env.OLD_SERVICE_ROLE_KEY` / `process.env.OLD_SUPABASE_URL` / equivalent new-project env vars, never hardcoded, never logged in full (if you log anything for diagnostics, redact/truncate any key-shaped value).
- `--dry-run` mode writes nothing to the new project (proven via a real before/after row-count check against your fixture-backed new-project instance, not just asserted) and prints per-table counts plus the migration report (unmatched teams, unparseable times, attendees-backfill mismatches).
- Column mapping matches `docs/migration/mapping.md` exactly, including the `session_attendance.planned` split (→`rsvps` vs `attendance`) and the `hours_override`-always-set rule (Known Context/Traps #4) — cross-checked explicitly row-by-row against the mapping table in your output.
- Idempotent: running the script twice (dry-run or real) against the same fixture data produces no duplicate rows and no changed report (Known Context/Traps #1, #6).
- Natural-key/upsert strategy documented explicitly for every table, including tables with no obvious natural key in the new schema.
- `npm run build`/`typecheck`/`lint` all exit 0 (this script lives in the frontend TS toolchain's scope unless you determine otherwise — state which tsconfig/build path it falls under).

## Relevant Constitution Excerpts
> 5. No secrets in the repo: `.env*` gitignored; service-role keys never appear in frontend code or client bundles → BLOCKER. *(This is this task's single highest-severity constraint — a committed old- or new-project service-role key is exactly the kind of leak this rule exists to prevent, doubly so since MIG-06's own close-out note observes the *old* project's `anon` policies are already world-writable and its repo is public.)*

> 6. No PII (student names, emails) in logs, URLs, analytics, commit messages, or test fixtures — fixtures use fabricated names.

> 10. Database changes are additive migrations via the Supabase CLI; editing an applied migration file → BLOCKER. *(Not directly applicable — this script writes data, not schema — cited for the general principle that the new-project schema is frozen and this script must work within it as-is.)*

> 16. Migration cutover (MIG-04 validation + sign-off)... require explicit approval from the human owner recorded in the ledger. The old Lovable app is read-only reference — agents never write to the old project except via the reviewed `scripts/migrate.ts`. *(This task IS that reviewed script — but note it only ever *reads* from the old project and *writes* to the new one; never write/alter/delete anything in the old project, even in a hypothetical live run.)*

Non-Negotiable: "No worker may mark its own work complete." Every checker inspects the actual artifact.

## PRD Ground Truth (verbatim)
> **MIG-03 ETL script:** "idempotent `scripts/migrate.ts` using service-role keys for both projects (env-provided, never committed), natural-key upserts, `--dry-run` mode printing per-table counts plus the migration report (unmatched teams, unparseable times, attendees-backfill mismatches) without writing."

> **MIG-04 Validation gates (checker-enforced, T063, currently Blocked):** "per-table row counts match; per-student confirmed hours in new `v_student_hours` ≡ old `student_hour_summary.attended_hours`; per-event totals ≡ old `event_hour_summary`; adult volunteer count/hour sums match; George spot-checks 5 students." *(Context only — not this task's job to run, but your transform logic must be correct enough that this future check can pass; the `hours_override`-always-set rule in particular exists specifically to make this reconciliation exact.)*

## Most Recent Failure
None. This is attempt 1 for T062 (attempt count: 0).

## Required Worker Output
- Full contents of `scripts/migrate.ts` and any files under `scripts/migrate/**`.
- Explicit row-by-row cross-check of your transform logic against every row of `docs/migration/mapping.md`'s table.
- Explicit natural-key/upsert strategy for each table, including tables with no natural key in the new schema.
- Real `--dry-run` output against fabricated fixture data (Known Context/Traps + External Blocker sections), covering every edge case listed (unmatched team, unparseable time, attendees-backfill mismatch, both `planned` values).
- Real proof of idempotency (running twice, no duplicates/changed report).
- Real proof `--dry-run` writes nothing (row-count check before/after).
- Grep confirming no service-role key or other secret is committed anywhere in `scripts/**`.
- Explicit statement that live old-project verification remains blocked pending George's credentials, citing `docs/migration/source-schema.md` rather than re-investigating.
- `npm run build`/`typecheck`/`lint` output.
- Known risks; whether a dispute is needed.
