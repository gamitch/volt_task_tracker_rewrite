# GAM-299 task packet (HEAVY)

**Issue:** GAM-299 — `events`/`event_sessions` RLS scopes by the legacy
`students.team_id`, so a dual-team student never receives their second team's
events. Legacy id `T806`. Label `area/w5`, `tier/heavy`.

**Branch:** `claude/gam-299-events-rls-memberships`

**Tier: HEAVY**, and the judgement is defended in the run log. Item 26 names
"RLS/auth/role logic" and "a migration" directly; item 18's first two triggers
(a file under `supabase/migrations/`, an RLS policy) both fire, so the worker
is dispatched with `model: "opus"`.

---

## 1. The defect, in one paragraph

Two `select` policies scope event visibility by the legacy single-team column
`students.team_id`. Every other layer — the page (`StudentHome` via T187) and
all four consuming views (`20260722000000_membership_views.sql`) — moved to
ACTIVE `student_teams` memberships (`left_on is null`). For a student who is a
member of two teams, an event scoped to their *second* team satisfies the page's
scope test and is filtered out by RLS before it reaches the browser. Nothing on
screen indicates rows are missing.

## 2. Verified state of `main` (`28f7394`), re-checked for this packet

Every citation below was opened and read while writing this packet (item 19c).

| Claim | Where | Status |
| -- | -- | -- |
| `events` read policy tests `s.team_id = any(events.team_ids)` | `supabase/migrations/20260717000002_rls.sql:153-161` | **verified verbatim**, line numbers current |
| `event_sessions` read policy repeats the identical test via `event_id` | `supabase/migrations/20260717000002_rls.sql:180-189` | **verified**; filing said `:180-188`, the closing `);` is on 189 |
| `v_student_participation` already joins `student_teams … left_on is null` | `supabase/migrations/20260722000000_membership_views.sql:59-65` | **verified verbatim** |
| Nothing writes `student_teams` | one non-test reference in `src/`: a `.select('team_id')` at `src/lib/supabase/loaders/students.ts:486`. No `insert`/`upsert`/`update`/`delete` against that table anywhere in `src/`, `supabase/functions/`, `scripts/`, or any migration except the one-time backfill at `20260721000000_student_teams.sql:37` | **verified** |
| `student_teams` is readable by any authenticated session | `20260721000000_student_teams.sql`, `create policy read_all on student_teams for select to authenticated using (true)` | **verified** — so a subquery on it inside another table's policy is not silently filtered |
| `students.team_id` is `not null` | asserted by `20260721000000_student_teams.sql`'s backfill comment | **worker must re-verify** against `20260716000000_identity_roster.sql` |
| No later migration drops or replaces either policy | all 24 files under `supabase/migrations/` | **verified** |

**Two corrections to the issue text**, both to be recorded on the issue:

1. **The issue says "T705 is the open row for that missing writer." T705 is
   GAM-298, and GAM-298 reads `Done` in Linear** (queried live 2026-08-12) while
   the writer still does not exist in the code. The *constraint* is unchanged and
   was re-measured directly rather than taken from the tracker: no code path
   writes `student_teams`. Do not treat GAM-298's status as evidence that the gap
   is closed; treat the grep above as the evidence.
2. **The `event_sessions` policy ends at line 189, not 188.**

## 3. What "done" looks like

A new additive migration replaces both `own_or_linked_read` policies so that a
student receives events for every team they are **actively** a member of, plus a
narrow bridge that keeps a membership-less student exactly as visible as they are
today. Assertions prove it on a real PostgreSQL cluster, inside the existing
`sql` CI job.

### 3.1 The migration

New file, `supabase/migrations/20260812000000_events_rls_membership_scope.sql`.
Item 10 forbids editing `20260717000002_rls.sql`; the `drop policy if exists` +
`create policy` route is already established by
`20260720000001_avatar_storage.sql`. **Item 16 reserves cutover for the owner —
the migration ships unapplied.** CI applies it to a scratch cluster; that is not
cutover.

Proposed `events` policy (the worker may improve the SQL, not the semantics):

```sql
drop policy if exists own_or_linked_read on events;

create policy own_or_linked_read on events
  for select to authenticated
  using (
    exists (
      select 1 from students s
      where s.id in (select my_student_ids())
        and (
          events.team_ids is null
          -- ACTIVE membership in any team the event is scoped to
          or exists (
            select 1 from student_teams st
            where st.student_id = s.id
              and st.left_on is null
              and st.team_id = any(events.team_ids)
          )
          -- Bridge (§3.2): only for a student with NO membership row at all
          or (
            not exists (select 1 from student_teams st2 where st2.student_id = s.id)
            and s.team_id = any(events.team_ids)
          )
        )
    )
  );
```

`event_sessions` gets the same three-branch test, reached through
`e.id = event_sessions.event_id`, and **must stay expression-for-expression
identical** — they are two copies of one rule (criterion 5).

Both policies must preserve the deliberate deviation documented at
`20260717000002_rls.sql:176-179`: the caller needs at least one linked student
via `my_student_ids()` for **any** event, including `team_ids is null`. That is
why the `team_ids is null` branch stays *inside* the `exists`.

`staff_all` on both tables is **not touched**.

### 3.2 The bridge clause, and why it is shaped this way

Nothing writes `student_teams`. Today a student with no membership row still sees
their team's events, because the live policy reads `students.team_id`, which the
roster does populate. Move to memberships alone and that student sees **no events
at all** — the failure changes from "one team's events are missing" to "every
event is missing", which is worse than the bug.

The bridge fires **only when the student has zero membership rows** — not "zero
*active* rows". This is deliberate and is what keeps criteria 2 and 3 from
contradicting each other:

| Student's `student_teams` rows | Bridge fires? | Result |
| -- | -- | -- |
| none | yes | sees exactly what they see today (criterion 2) |
| active in A, active in B | no | sees A **and** B (criterion 1) |
| A with `left_on` set, active in B | no | sees B only; A is denied (criterion 3) |
| A with `left_on` set, nothing else | no | sees nothing — criterion 3 wins over legacy `team_id` |

The last row is the sharp edge and the packet is choosing it deliberately: a
membership row's `left_on` is an explicit statement about that student, and a
legacy column must not override it.

The bridge is a **bridge**, not a permanent design. Its comment says so, names
the missing writer, and says what deletes it. Under item 20 the deferral gets a
Linear row (see §6), filed via `.claude/skills/linear-task-writing`.

### 3.3 The assertions, and where they land

**Do not add a CI step.** `.github/workflows/**` is unpushable from a dispatched
run (`AGENTS.md`, "Two walls"), and it is not needed: `.github/workflows/ci.yml:227`
already runs `bash tests/rls/run.sh` inside the `sql` job, and that runner applies
**every** file under `supabase/migrations/` in filename order, so the new
migration is picked up with no wiring change at all.

Land the new coverage as two new files applied by that same runner:

* `tests/rls/gam299_seed.sql` — additional fabricated fixtures (item 6), with a
  distinct UUID prefix that cannot collide with the existing `tests/rls/seed.sql`
  ids.
* `tests/rls/gam299_assertions.sql` — the PASS/FAIL report, same `\gset` +
  `begin/set local role authenticated/rollback` method as
  `tests/rls/assertions.sql`.

and **three added lines** in `tests/rls/run.sh`, after the existing assertions
run, loading the new seed then the new assertions, teeing into the same
`$REPORT_FILE` the existing `grep -q 'FAIL'` already checks — or appending to it;
either way a FAIL in the new file must fail the script. **The new seed loads
after the existing assertions have already run**, so no existing case's expected
count can move.

Verify that last sentence rather than trusting it: run `bash tests/rls/run.sh`
before and after and confirm every pre-existing case still reports PASS with the
same expected values.

### 3.4 Fixtures needed

Fabricated names only (item 6). At minimum:

* team B (a second team) and an event scoped to `{B}` only;
* a **dual-team** student: active memberships in A and B;
* a **membership-less** student: a `students` row with `team_id = A` and no
  `student_teams` row (the backfill in `20260721000000_student_teams.sql:37`
  runs at migration time, before this seed, so a student inserted by this seed
  has no membership row unless the seed adds one — confirm that, do not assume);
* a **left-team** student: membership in B with `left_on` set;
* the existing profile-less orphan session, reused for criterion 4;
* a staff (coach or admin) profile for criterion 6.

## 4. Acceptance criteria

The issue's seven criteria are the acceptance criteria, unmodified, and each one
names the mutation that must redden it. Reproduced here so the worker and checker
grade against one list:

1. **A dual-team student receives both teams' events.** Active memberships in A
   and B; receives an event scoped to `{B}`. *Mutation: restore the `s.team_id`
   test → red.*
2. **A student with no membership row is not made worse off.** Still receives at
   least the events they receive today. *Mutation: remove the bridge clause → red.*
3. **A left team stops granting access.** A membership with `left_on` set does not
   admit that team's events. *Mutation: drop the `left_on is null` test → red.*
4. **A session with no linked student still sees zero rows**, including for events
   with `team_ids is null`. *Mutation: relax the linked-student requirement → red.*
5. **`events` and `event_sessions` stay in agreement.** *Mutation: change one
   policy and not the other → red.*
6. **Staff visibility is unchanged.** `staff_all` still returns everything for
   admin and coach. *Mutation: scope staff reads by membership → red.*
7. **Proven on a real cluster.** Real PostgreSQL, real policies, not fixtures.
   `scratch-postgres` is the tool and the `sql` CI job is where it lands.

Plus two this packet adds:

8. **No pre-existing `tests/rls` case changes its result or its expected value.**
9. **The six repo gates pass** (`gate-run`): tsc, vite build, format:check,
   eslint, full vitest, scoped vitest. No application code changes, so this is a
   regression check, not the main evidence.

**Criterion 7 is the one that has never been satisfied for this row.** The filing
says twice, in its own words, that its claim was read from the policy text and
never executed. A completion report that does not carry real psql output from a
real cluster does not close this issue.

## 5. Allowed Files

* `supabase/migrations/20260812000000_events_rls_membership_scope.sql` (new)
* `tests/rls/gam299_seed.sql` (new)
* `tests/rls/gam299_assertions.sql` (new)
* `tests/rls/run.sh` (append the two loads; do not restructure the script)

**Forbidden, explicitly:** `.github/workflows/**` (unpushable — see §3.3),
`supabase/migrations/20260717000002_rls.sql` (item 10), any file under
`docs/swarm/**` or `.claude/**` (orchestrator-owned), and any application source
under `src/`. This change ships **no** application code; if the worker believes
it needs some, that is an escalation, not an edit.

## 6. Deferrals to file (item 20, via `linear-task-writing`)

* **The `student_teams` writer.** The bridge clause exists only because no code
  path writes memberships. The row states the trigger that removes it: when a
  writer ships, the bridge clause is deleted and criterion 2 is retired. Check
  GAM-298 (T705) first — it reads `Done` while the writer is absent, so the
  correct action may be reopening it rather than filing a new row.

## 7. Least confident decisions (item 19d)

1. **The bridge keys on "no membership rows at all", not "no active membership
   rows".** *Wrong if* the intended semantics of a `left_on`-only student is
   "fall back to the roster column", in which case criterion 3 and criterion 2
   are in genuine conflict and the issue's author should break the tie. It is
   also wrong if real data contains students whose only membership row is a
   left one — unmeasurable from here, since the production database is not
   reachable and has been ruled non-evidential for this class of question
   (GAM-298's own ⚠ note).
2. **Extending `tests/rls/run.sh` instead of adding a new suite + CI step.**
   *Wrong if* the new seed perturbs an existing assertion — the existing report
   is built from whole-table `count(*)` with no `WHERE`, so a new row in
   `students`, `events` or `attendance` visible to an existing fixture session
   would move a count. Load order (new seed strictly after the existing
   assertions) is the mitigation, and it must be **measured**, not argued. If it
   cannot be made safe, the fallback is a separate runner script plus a CI step —
   which is undeliverable from this run and would ship as a `git format-patch`
   artifact instead.
3. **A subquery on `student_teams` inside an `events` policy is not filtered
   away.** The reasoning is that `student_teams` carries `read_all … using (true)`,
   so RLS on the referenced table admits every row. *Wrong if* policy-expression
   subqueries behave differently than an ordinary query here, or if the
   `authenticated` role lacks `select` on `student_teams` in production despite
   `tests/rls/grants.sql` granting it in the harness. **Measure both directions:**
   the dual-team student sees B's event, and the same query under a role without
   that grant does not silently succeed for the wrong reason.
4. **Three OR branches in a hot read policy is acceptable.** *Wrong if* the
   planner cannot use them and `events` reads become slow at real row counts. Not
   measured, and the honest reason is that the table is small for this team; if
   the gate wants a measurement, the packet will take one rather than argue.
5. **The migration ships unapplied and CI is therefore the only place it ever
   runs before the owner applies it.** *Wrong if* a scratch-cluster result does
   not generalise to hosted Supabase — the `scratch-postgres` skill raises exactly
   this question. The generalisation argument is that both policies are plain
   `create policy` statements with no platform dependency, but state it in the PR
   rather than leaving it implicit.

## 8. Process

`checker-premise` (opus) attacks §7 first, and **must run**, not only read — item
26: "a gate that only reads is worth much less than one that runs." Its
non-negotiable job is criterion 7's measurement, in both directions: reproduce
the dual-team denial on today's policies, then show the proposed policy admits
the row. Worker (opus, item 18) implements. `checker-reviewer` grades against §4
and replays the named mutations.
