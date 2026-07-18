# Worker Packet: T061

## Task ID
T061

## Objective
Two independent deliverables under `docs/migration/`:
- **MIG-01 (schema verification):** introspect the **live** old (pre-rewrite) Lovable Cloud project's database and diff it against PRD Section 10.1's "as-built" source-schema table. Any drift halts and gets documented in `docs/migration/source-schema.md` for boss review — it is never silently reconciled.
- **MIG-02 (mapping doc copy):** copy PRD Section 10.2's column-mapping table verbatim into `docs/migration/mapping.md`.

## Foreman pre-check on MIG-01 accessibility — read this before attempting to introspect anything
The foreman searched this entire repository for any live connection info, credentials, or prior reference to the old project before writing this packet, and found:
- `.env.example` contains only `VITE_SUPABASE_URL=` and `VITE_SUPABASE_ANON_KEY=` (both blank) — **no** `OLD_SUPABASE_URL` or `OLD_SERVICE_ROLE_KEY` entries anywhere, not even as blank placeholders.
- `docs/swarm/COWORK-HANDOFF.md` (line 10) is the only place `OLD_SUPABASE_URL` / `OLD_SERVICE_ROLE_KEY` are mentioned anywhere in the repo, and only as a forward-looking setup note: "...comments noting `CHECKIN_HMAC_SECRET` + `RESEND_API_KEY` live in Supabase Edge Function secrets, and `OLD_SUPABASE_URL` / `OLD_SERVICE_ROLE_KEY` are needed only for `scripts/migrate.ts`" — i.e. these are flagged as belonging to **T062** (the ETL script), not this task, and there is no evidence they were ever actually supplied anywhere.
- No local clone/mirror of `github.com/gamitch/volt-timetracker` (the old app's repo, per PRD Section 10) exists anywhere on disk in this sandbox (`**/*volt-timetracker*` glob returned nothing).
- PRD Section 10 itself states: "Source of truth: `github.com/gamitch/volt-timetracker`... Data lives in the Lovable Cloud Supabase project referenced by the repo's env vars" — i.e. even the GitHub code repo (schema-as-migrations) and the live database are two separate things; reading the GitHub repo's migration files, even if reachable, is not the same as "introspecting the live old project" that MIG-01 literally calls for.
- `docs/swarm/state-summary.md`'s "External prerequisites" list already tracks three George-only blockers (Supabase project creation, Google OAuth client, Vercel CNAME) as things "the swarm cannot create" — old-project database access for MIG-01 is the same category of gap, just not yet itemized there explicitly.

**Conclusion the foreman is providing you, which you must still independently confirm rather than take on faith:** this strongly indicates the live old project is **not accessible** from this environment right now — it is an unmet external prerequisite, not something you can work around by reading code instead of data. You must still do your own due diligence (see Required Steps below) before finalizing this conclusion in your worker output, since you have tools (Bash) the foreman does not, and it's possible something (e.g. an env var actually set in this sandbox's shell, not committed to any file) was missed.

## Dependencies (status)
T009, T010, T011 — all Passed. These define the *new* schema you're not touching in this task; they're listed as dependencies because 10.1/10.2 assume the new-side schema exists, not because this task edits it.

## Allowed Files
- `docs/migration/source-schema.md` (new)
- `docs/migration/mapping.md` (new)

## Forbidden Files
- Everything else, including the old project itself — constitution item 16: "The old Lovable app is read-only reference — agents never write to the old project except via the reviewed `scripts/migrate.ts`." Even if you do find live credentials, you may only read/introspect (e.g. `SELECT`/schema-inspection queries), never write, alter, or delete anything in the old project.
- `supabase/migrations/**`, `src/**`, `docs/swarm/**`, `.claude/**`.

## Required Steps (do these in order; document what you found at each step)
1. Check this sandbox's actual environment for `OLD_SUPABASE_URL` / `OLD_SERVICE_ROLE_KEY` (or any similarly-named var — check broadly, e.g. `env | grep -i old` and `env | grep -i supabase`) and for any `.env`/`.env.local` file that might exist locally but isn't committed (`.env` is gitignored per `.gitignore` — check if one exists on disk anyway, don't assume from the committed `.env.example` alone).
2. Check for network reachability to a live Supabase project or to `github.com/gamitch/volt-timetracker` if you have `Bash` network access in this sandbox (the environment notes mention outbound HTTPS goes through a pre-configured proxy — if you attempt this, report exactly what you tried and what happened, success or failure, don't guess at the outcome).
3. Search the filesystem broadly (not just the repo) for anything that looks like a mirror/clone/backup of the old project (the PRD mentions it mirrors `/Users/georgemitchom/volt-timetracker` — that's George's local machine, almost certainly not this sandbox, but check for any similarly-named directory anywhere you have read access).
4. If any of steps 1–3 turns up real, usable access: proceed with MIG-01 as originally scoped — introspect the live schema, diff column-for-column against PRD 10.1's table (reproduced below), and write `docs/migration/source-schema.md` documenting either "no drift found" (with your introspection evidence) or the exact drift found (halt, do not reconcile, document for boss review per the Acceptance Criteria below).
5. If none of steps 1–3 turns up real access (the expected outcome based on the foreman's pre-check above): **do not fabricate or guess at a live schema.** Write `docs/migration/source-schema.md` as an explicit, honest blocker report: state exactly what you checked (mirroring steps 1–3), what you found (nothing), and that MIG-01's live-introspection requirement is therefore unmet pending George providing `OLD_SUPABASE_URL`/`OLD_SERVICE_ROLE_KEY` (or equivalent access). You may, as a clearly-labeled secondary section (not a substitute for MIG-01), reproduce PRD 10.1's table as the last-known/documented schema for reference — but label it unambiguously as "PRD 10.1 as transcribed, NOT independently re-verified against a live instance" so nobody downstream mistakes it for a completed introspection.
6. Regardless of steps 1–5's outcome, complete MIG-02 in full — it does not depend on live access at all, it is a verbatim copy task.

## Ground Truth — PRD Section 10.1 (source schema, "as-built") — read this yourself from `docs/swarm/VOLT_Portal_PRD.md` lines 675–691 to confirm this transcript is accurate before using it
```
Source of truth: github.com/gamitch/volt-timetracker (mirror of /Users/georgemitchom/volt-timetracker),
migrations in supabase/migrations/*.sql, read and verified 2026-07-12. Data lives in the Lovable Cloud
Supabase project referenced by the repo's env vars.

| Old table | Columns |
|---|---|
| students | id, name, team_affiliation (text; the app joins it against teams.name), active, goal_hours (nullable numeric), created_at |
| events | id, date, start_time (text), end_time (text), name, location, duration_hours, attendees uuid[] (legacy — backfilled into session_attendance by migration 2), adult_volunteers_count, adult_volunteer_hours, notes, is_multi_day, status ('planned'|'completed'), category ('outreach'|'meeting'|'competition'), created_at |
| event_sessions | id, event_id (cascade), date, start_time (text), end_time (text), duration_hours, created_at |
| session_attendance | id, session_id, student_id, hours, planned (bool: true = expected/RSVP, false = confirmed actual), created_at, unique(session_id, student_id) |
| teams | id, name (unique), short_name, color, archived, sort_order, created_at — seeded: Gear Girls, Polytechnic Puzzle Pieces (P3), Skyline Robotics (archived), VOLT (archived) |
| app_settings | singleton row: season_goal (default 100) |
| views | event_hour_summary, student_hour_summary (student hours already filter to category='outreach' — the old app agrees with MET-03's outreach-only rule) |

Notable: no people_reached column exists — the deployed form field is not persisted, so that metric starts
fresh in the new app. All old RLS policies are USING (true) for anon, including DELETE; the rewrite
eliminates this.
```

## Ground Truth — PRD Section 10.2 (column mapping, normative) — read this yourself from `docs/swarm/VOLT_Portal_PRD.md` lines 693–710 to confirm this transcript is accurate before copying it
```
| Old | New | Rule |
|---|---|---|
| teams.* | teams.* | 1:1 including short_name, archived, sort_order; program left null for George to set later |
| students.name | students.display_name | direct |
| students.team_affiliation | students.team_id | join on teams.name; unmatched values create an archived team and appear in the migration report |
| students.goal_hours | students.goal_hours_override | direct |
| students.active | students.is_active | direct |
| app_settings.season_goal | seasons.default_goal_hours | create season "2025–2026" spanning min→max session dates, is_active=false; George creates the new active season at cutover (SET-04) |
| events.name / location / notes / category / adult_volunteers_count / adult_volunteer_hours | events.title / location_name / description / type / adult_volunteers_count / adult_volunteer_hours | direct (category vocabulary is identical); team_ids = null (all-team scope); counts flags per type defaults (CMP-02); season_id assigned by date; created_by = null |
| events.date / start_time / end_time / is_multi_day / attendees / status / duration_hours | — | dropped: sessions are authoritative. ETL asserts migration 2's backfill covered every event and every attendees[] uuid before dropping |
| event_sessions.date + start_time/end_time (text) | event_sessions.starts_at / ends_at (timestamptz) | parse in America/Chicago; unparseable strings fall back to 00:00 and are flagged in the migration report |
| parent events.status | event_sessions.status | 'completed' when old event status='completed' AND session date ≤ cutover date, else 'scheduled' |
| session_attendance where planned=true | rsvps | status going, responded_by = null |
| session_attendance where planned=false | attendance | status present, method='import', check_in_at/check_out_at = null, hours_override = old hours, always set — guarantees hour totals match the old views exactly |

Mapping notes: (a) migrated meetings carry all-team scope, so pre-cutover participation % is approximate —
Reports label imported seasons "imported"; (b) no historical late/excused/absent data exists; imported
attendance is present-only; (c) notes on old events lands in events.description.
```

## Acceptance Criteria
- **MIG-01:** either (a) a genuine live-introspection diff against PRD 10.1 is performed and documented in `docs/migration/source-schema.md` (drift, if any, is documented for boss review, never silently reconciled), or (b) if no live access exists, `docs/migration/source-schema.md` explicitly and honestly documents that this is an unmet external prerequisite, exactly what was checked to reach that conclusion, and does not present PRD 10.1 as if it had been independently re-verified.
- **MIG-02:** `docs/migration/mapping.md` is an unchanged, verbatim copy of PRD Section 10.2's table and its two paragraphs (source note + mapping notes) — constitution item 3's "copied verbatim" standard, applied here by direct instruction of MIG-02 itself even though 10.2 isn't RLS/metric SQL.
- No write attempted against the old project under any circumstance (constitution item 16).
- No fabricated schema, no fabricated "drift found" or "no drift found" claim without real evidence backing it.

## Relevant Constitution Excerpts
- Item 16: "Migration cutover... require explicit approval from the human owner... The old Lovable app is read-only reference — agents never write to the old project except via the reviewed `scripts/migrate.ts`."
- Item 3 (applied by analogy per MIG-02's own "copy... unchanged" instruction): verbatim-copy discipline for protected source text.
- Non-Negotiable: "Protected source text must remain verbatim unless explicitly approved." / "No worker may mark its own work complete."

## Most Recent Failure
None. This is the first attempt (attempt count: 0).

## Required Worker Output
- exact steps taken to check for live old-project access (env vars checked, network attempts made and their real results, filesystem search results) — this is the most important part of your output for this task
- final determination: live access available or not, with evidence
- full contents of both `docs/migration/source-schema.md` and `docs/migration/mapping.md`
- if access was unavailable: explicit confirmation you did not present PRD 10.1 as an independently-verified live diff
- if access was available: the actual introspection commands/output and the diff result against PRD 10.1
- confirmation `docs/migration/mapping.md` is a verbatim, unmodified copy of PRD 10.2
- known risks
- whether a dispute is needed (e.g. if you believe MIG-01 as literally specified cannot be satisfied by anyone without George's direct action, that may itself be worth flagging to the foreman/boss rather than treating as a routine task note)
