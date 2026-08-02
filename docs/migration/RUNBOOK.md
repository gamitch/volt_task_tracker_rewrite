# Migration runbook — Lovable Cloud → Supabase

**Written 2026-08-01 so this can be picked up cold.** A fresh session or George can follow this end
to end. Everything it depends on is in the repo; nothing important lives only in a conversation.

Read alongside `mapping.md` (the column-by-column contract) and `source-schema.md`. Owner rulings
are in `../swarm/auto-mode-decisions.md` — **cite that file, never a paraphrase of it.**

---

## 1. State of play

| Step | Status |
|---|---|
| **T061/T062** — schema mapping + ETL script | Passed |
| **T063** — MIG-04 validation dry run | **Passed, owner-signed-off 2026-08-01** |
| **First real run** | **EXECUTED 2026-08-02 by the owner against the live project** — see §8 |
| **T064** — roster → accounts verification | **Blocked** — see §6, no emails exist |
| **T065** — cutover | Not started. Owner-only decision (item 16) |
| Manifest + `--teardown` | **Built, branch `claude/t063b-manifest-teardown`, NOT merged and NOT verified** |

**The old-project credential blocker is closed permanently.** `OLD_SUPABASE_URL` /
`OLD_SERVICE_ROLE_KEY` **do not exist and cannot be obtained** — the old app runs on Lovable Cloud,
which keeps Postgres inside its own platform and exposes no service-role key. Verified: the owner's
Supabase org contains only `volt-timetracker`, and Lovable's Secrets page contains only
`LOVABLE_API_KEY`. **Do not spend another round looking for them.** The ETL reads exported JSON
instead, via `--from-dir`.

---

## 2. Getting the data — it is NOT in this repo, and must not be

**Constitution item 6 forbids PII in the repository.** `students.json` contains twenty real
children's first names. **Never commit these exports.** They are supplied per-run and thrown away.

Re-export takes about five minutes. In Lovable → **Cloud → SQL editor**, run each query and save the
single JSON cell it returns to a file of the matching name in one directory:

```sql
select json_agg(row_to_json(t)) from public.teams t;              -- teams.json
select json_agg(row_to_json(t)) from public.students t;           -- students.json
select json_agg(row_to_json(t)) from public.events t;             -- events.json
select json_agg(row_to_json(t)) from public.event_sessions t;     -- event_sessions.json
select json_agg(row_to_json(t)) from public.session_attendance t; -- session_attendance.json
select json_agg(row_to_json(t)) from public.app_settings t;       -- app_settings.json
```

**Do not export** `student_hour_summary` or `event_hour_summary` — they are views, and the new
schema recomputes them. **Do not export** `attendance_changes` — it is an audit log the mapping
deliberately drops (§6).

Expected shapes, measured 2026-08-01: teams **4**, students **20**, events **16**, event_sessions
**117**, session_attendance **333**, app_settings **1**.

---

## 3. Dry run — proves the transform, writes nothing

```bash
node --experimental-strip-types scripts/migrate.ts \
  --dry-run --from-dir="$HOME/volt-export" --cutover-date=YYYY-MM-DD
```

**Requires no environment variables at all.** That is deliberate and is the property that unblocked
this gate — verify it stays true.

> ⚠️ **Use `"$HOME/..."`, never `~/...`.** zsh does **not** perform tilde expansion after an `=` in
> an argument like `--from-dir=~/volt-export`, so Node receives a literal `~` and fails with
> `ENOENT: no such file or directory, open '~/volt-export/teams.json'`. This bit the owner on his
> first run, following instructions carrying the same defect. Extra files in the export directory
> (e.g. `attendance_changes.json`) are harmless — the reader opens only the six names it needs.

The 2026-08-01 run, which the owner signed off:

```
teams            : 4 created, 0 existing (0 unmatched-archived)
seasons          : 1 created, 0 existing
students         : 20
events           : 16
event_sessions   : 117
rsvps            : 254
attendance       : 79

Unmatched teams (0):               (none)
Unparseable times (0):             (none)
Attendees-backfill mismatches (0): (none)
```

The 79 attendance rows carry **341.75 hours**, and **4 of the 20 students have no activity rows at
all** — expected, not a defect. (Names deliberately omitted: constitution item 6 forbids PII in this
repository, and that applies to a runbook exactly as much as to a fixture.) **All three problem
sections must read `(none)`.** If any is non-empty, stop and report — do not proceed to a real run.

`session_attendance` splits on its `planned` flag: **254 `planned=true` → `rsvps`**,
**79 `planned=false` → `attendance`** with `hours_override` always set from the old `hours`, so hour
totals match the old system exactly.

---

## 4. Real run — writes to the new project

```bash
NEW_SUPABASE_URL=... NEW_SERVICE_ROLE_KEY=... \
node --experimental-strip-types scripts/migrate.ts \
  --from-dir="$HOME/volt-export" --cutover-date=YYYY-MM-DD
```

The service-role key is on the new project's **Settings → API Keys**. It bypasses RLS entirely:
never paste it into a chat, a doc, or a commit.

The ETL is **idempotent** — natural-key upserts — so re-running is the designed path, not a
workaround. That is what makes the test-then-teardown-then-cutover cycle safe.

---

## 5. Teardown — between the test run and cutover

The owner authorised a test migration now and a real one at cutover
(`auto-mode-decisions.md`, 2026-08-01), with the data cleared in between.

**The durable mechanism is the manifest** on branch `claude/t063b-manifest-teardown`: the real run
records exactly which rows it *created* (not merely matched), and `--teardown=<manifest>` deletes
exactly those. **That branch is unmerged and its mutations are unverified — verify before relying on
it.**

Until then, the interim SQL. **Run it in the new project's SQL editor:**

```sql
delete from attendance;
delete from rsvps;
delete from event_sessions;
delete from events;

delete from student_teams
 where student_id in (
   select id from students
    where profile_id is null
      and id not in (select student_id from guardian_links));

delete from students
 where profile_id is null
   and id not in (select student_id from guardian_links);
```

**The rule is "keep any student that any account depends on"** — its own `profile_id`, or a
guardian link. This is not cosmetic:

- Truncating `students` would break account linkage while leaving sign-in working, landing the owner
  on "No student account linked yet". `students.profile_id` and `guardian_links.parent_profile_id`
  both reference `profiles`.
- The owner's **`Test` student** has no account of its own but **is a second child on his parent
  account**, used to exercise the multi-student parent view. A narrower `profile_id is null` rule
  targets it, and because `guardian_links.student_id` is `on delete restrict`, the teardown would
  **fail mid-run and leave the database half-cleared.**

**`teams` and `seasons` are deliberately not deleted** — small config the ETL upserts by natural
key. **`profiles`, `guardian_links` and `auth.users` are never touched.**

> ⚠️ **This SQL is safe only before go-live.** It relies on migrated students having no accounts,
> which is true only because the old data has no emails. Once real account-less students exist it
> will delete real records. **After cutover, use the manifest or nothing.**

---

## 6. Known gaps — read before promising anyone a date

**No student emails.** The old `students` table has columns `active, created_at, goal_hours, id,
name, team_affiliation` — and no email. The migration therefore creates **zero accounts**, and
**T064 cannot proceed on migrated data alone.** ~20 addresses must be supplied separately, most
likely guardian addresses. This does not affect the data migration.

**`attendance_changes` (88 rows) is dropped.** It is an audit/history log; the old app's "Recent
signup activity" feed is built from it. The new app rebuilds that feed from `rsvps` timestamps, so
the *feature* survives and the *history* does not. Confirmed acceptable by the owner.

**The write path is unexercised.** T063 verified the transform via a dry run. No real write has been
made against a live project from this branch. Expect the first real run to be the first exercise of
that path.

---

## 7. Two rulings that change the data — do not re-derive them

**Season goal is 90 hours**, matching the old `app_settings.season_goal`. Every migrated student has
`goal_hours = null`, so this single number sets every goal bar. The new app currently displays 200;
90 is correct.

**"FLL Team Meetings" events are outreach, NOT meetings.** `GG FLL Team Meetings` and
`P3 FLL Team Meetings` are **72 of 117 sessions (62%)**. The team's own students are *student
coaches* for those FLL teams, so the sessions are volunteer service they perform for others.
`category → type` maps **1:1**; recategorising them as meetings would strip the majority of the
team's volunteer hours out of every student's goal progress. Full reasoning in `mapping.md`'s
closing section. **This has already been proposed once from the event titles alone and was wrong.**


---

## 8. First real run — executed 2026-08-02

The owner ran the migration against the live project (`ljuifkzktpqarndgxcxy`). It **succeeded**, and
every figure matched the signed-off dry run exactly:

```
teams            : 4 created, 0 existing (0 unmatched-archived)
seasons          : 1 created, 0 existing
students         : 20
events           : 16
event_sessions   : 117
rsvps            : 254
attendance       : 79
Unmatched teams (0) · Unparseable times (0) · Attendees-backfill mismatches (0)
Real run complete. Rows above were written to the new project.
```

**341.75 hours of real volunteer history now live in the new app.**

### Two failures on the way, both worth keeping

**1. `~` is not expanded after `=`.** `--from-dir=~/volt-export` reaches Node as a literal tilde and
fails with `ENOENT: ... open '~/volt-export/teams.json'`. zsh does not perform tilde expansion after
an `=` in an ordinary argument. **Always `"$HOME/..."`.**

**2. The publishable key looks like the secret key.** Passing `sb_publishable_…` as
`NEW_SERVICE_ROLE_KEY` fails with
`new row violates row-level security policy for table "teams"` — confusing, because it reads like a
policy bug rather than a credential mistake. The publishable key is the public one and is subject to
RLS; the migration needs `sb_secret_…` from **Settings → API Keys → Secret keys**.

The script echoes a masked prefix (`key sb_p***` vs `sb_s***`) which is the tell, but only if you
know to look. **This failed safely** — it stopped on `teams`, the first table, so nothing was
written and there was no partial state. RLS did exactly its job.

**Follow-up worth doing:** validate the key prefix at startup and fail with
*"NEW_SERVICE_ROLE_KEY looks like a publishable key (sb_p…); the migration needs a secret key"*
before touching the network.

### State after this run

The owner **did not** run the teardown first, so the project holds a **mixed** state: the four
migrated teams alongside his pre-existing test teams, and the 16 migrated events alongside his two
test events. Intentional and harmless for testing. The teardown SQL in §5 still applies and still
protects every account.

**T064 remains blocked**: the migration created **zero accounts**, because the old data has no
emails. The roster is correct and entirely unlinked.
