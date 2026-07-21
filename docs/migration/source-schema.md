# MIG-01: Schema Verification — BLOCKER REPORT (live introspection NOT performed)

**Status: BLOCKED — unmet external prerequisite. This is not a completed schema verification.**

MIG-01, as specified in PRD Section 10.3 and this task's packet, requires introspecting the
**live** old (pre-rewrite) Lovable Cloud Supabase project's database and diffing it, column for
column, against PRD Section 10.1's "as-built" source-schema table. That live introspection could
**not** be performed in this environment. Per the constitution's acceptance criterion for this
task family ("any drift from PRD 10.1 halts and is documented for boss review, not silently
reconciled") and constitution item 6 (no fabricated data/schemas), this document records exactly
what was checked, what was found, and why — it does **not** contain a fabricated schema or a
fabricated "no drift found" / "drift found" claim.

## What was checked (steps taken, in order)

### 1. Environment variables in this sandbox
Ran `env | grep -i old` and `env | grep -i supabase` directly in this sandbox's shell (not just
reviewing committed files).

- `env | grep -i old` → matched only `NODE_OPTIONS=--max-old-space-size=8192` and
  `OLDPWD=/` — both unrelated to an old-project database connection.
- `env | grep -i supabase` → no matches at all.
- Full listing of every environment variable name present in this sandbox (values withheld where
  sensitive) was reviewed; no variable resembling `OLD_SUPABASE_URL`, `OLD_SERVICE_ROLE_KEY`, or
  any Supabase/database connection string exists.

### 2. Local `.env` / `.env.local` files not committed to git
`.env` and `.env.local*` are gitignored per `.gitignore`, so the committed `.env.example` alone
doesn't prove nothing exists on disk. Checked directly:

- `find /home/user/volt_task_tracker_rewrite -maxdepth 4 -iname ".env*"` → only
  `.env.example` was found (no `.env`, `.env.local`, etc.).
- `.env.example` was read in full; it contains only `VITE_SUPABASE_URL=` and
  `VITE_SUPABASE_ANON_KEY=`, both blank placeholders for the **new** project, with no
  `OLD_SUPABASE_URL` / `OLD_SERVICE_ROLE_KEY` entries anywhere, not even as blank placeholders.
- A broader filesystem search (`find / -maxdepth 6 -iname "*.env*"`, excluding
  `node_modules`) found no other `.env`-like file anywhere on disk apart from unrelated
  language-tooling files (`go.env`, `uv.env.fish`) and this repo's own `.env.example`.

### 3. Repo-wide search for any prior reference to old-project credentials
`grep -rn "OLD_SUPABASE\|OLD_SERVICE_ROLE"` across the repository found exactly one substantive
hit outside this task's own packet/ledger entry: `docs/swarm/COWORK-HANDOFF.md` line 10, which
lists `OLD_SUPABASE_URL` / `OLD_SERVICE_ROLE_KEY` only as a **forward-looking setup note** for
`scripts/migrate.ts` (the ETL script, task T062) — i.e. these are documented as needed in the
future, not as already supplied or available now. No value was ever committed for either.

### 4. Network reachability
Outbound HTTPS in this sandbox goes through a pre-configured agent proxy. Checked the proxy's own
status endpoint and attempted to reach the documented source-of-truth code repository:

- `curl -sS "$HTTPS_PROXY/__agentproxy/status"` confirmed the proxy is enabled and returned a log
  of `recentRelayFailures`, including repeated `403` "policy denial" rejections for unrelated
  hosts (e.g. `www.google.com`), demonstrating the proxy allowlists specific hosts only.
- `curl -sS -m 15 "https://github.com/gamitch/volt-timetracker"` returned HTTP 403 with body:
  `{"message":"GitHub access to this repository is not enabled for this session. Use add_repo to
  request access.","documentation_url":"https://docs.anthropic.com/en/docs/claude-code/github-actions"}`
  — i.e. this session does not have access to that specific GitHub repository, and no attempt was
  made to guess or reach any Supabase project URL because no such URL is known or documented
  anywhere accessible to this task.
- `gh` CLI is not installed in this sandbox (`gh: command not found`), so no alternate GitHub
  access path was available either.
- Note: even if the GitHub code repo (containing `supabase/migrations/*.sql`) were reachable,
  that is explicitly **not the same thing** as introspecting the live database per PRD Section
  10 itself ("Data lives in the Lovable Cloud Supabase project referenced by the repo's env
  vars" — the migrations files and the live database are two distinct things). No attempt was
  made to substitute reading migration files for live introspection.

### 5. Filesystem search for a local mirror/clone/backup of the old project
The PRD states the GitHub repo is a mirror of `/Users/georgemitchom/volt-timetracker` (George's
own local machine — not expected to be present in this sandbox, but checked anyway):

- `find / -iname "*volt-timetracker*"` (unrestricted, ignoring permission errors) → no matches
  anywhere on the filesystem.
- `find / -iname "*georgemitchom*"` → no matches.
- `find /home /root /opt /srv /var/www -maxdepth 6 -iname "*volt*"` → matches only this repo
  itself (`/home/user/volt_task_tracker_rewrite`), a theme file within it
  (`src/theme/volt.ts`), the PRD copy within it, and Claude Code's own session cache/upload
  directories referencing this repo/PRD by name — no independent old-project mirror exists.

## Conclusion

Steps 1–5 above were performed independently by this worker (not merely taken on the foreman's
word) and all confirm the foreman's pre-check: **no live connection to the old Lovable Cloud
Supabase project, and no local mirror/clone of the old project's code, is reachable from this
sandbox.** No credentials exist in the environment, on disk, or committed to this repository.
GitHub access to the old project's repository is explicitly disabled for this session (confirmed
via a real, non-guessed HTTP 403 response, not an assumption).

**MIG-01's live-introspection requirement is therefore unmet, pending George providing
`OLD_SUPABASE_URL` / `OLD_SERVICE_ROLE_KEY` (or equivalent read-only access to the live old
project).** This is an external prerequisite in the same category as the other George-only
blockers already tracked in `docs/swarm/state-summary.md`'s "External prerequisites" list
(Supabase project creation, Google OAuth client, Vercel CNAME) — it cannot be created or worked
around by any agent in this swarm.

No introspection query of any kind was run against any live database, and no write, alter, or
delete was ever attempted against the old project (constitution item 16), because no connection
to the old project could be established in the first place.

**No claim of "drift found" or "no drift found" is made anywhere in this document, because no
live diff was performed.** The section below reproduces PRD 10.1 for reference only — it is
explicitly **not** an independently-verified live schema and must not be treated as a completed
MIG-01 introspection by any downstream consumer of this document.

---

## Reference only — PRD 10.1 as transcribed, NOT independently re-verified against a live instance

The following is a verbatim transcription of PRD Section 10.1 (as read from
`docs/swarm/VOLT_Portal_PRD.md`, lines 675–691, on 2026-07-18), reproduced here **only** for
reference so downstream tasks (e.g. T062's ETL script) have the documented schema in one place.
It carries no independent verification weight of its own — the PRD text itself states it was
"read and verified 2026-07-12" against the GitHub migrations, which is a code-level review, not a
live-database introspection, and in any case this worker did not redo that review.

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

## Unblock path

To complete MIG-01 as originally scoped, George needs to supply, via a secure channel (not
committed to the repo), read-only access to the live old Supabase project — either
`OLD_SUPABASE_URL` + `OLD_SERVICE_ROLE_KEY` (or an equivalent read-only role/key) so an agent can
run schema-inspection queries (e.g. against `information_schema` / `pg_catalog`) and produce a
genuine column-for-column diff against PRD 10.1. Until then, this blocker report — not a
fabricated schema — is the correct and honest state of MIG-01.
