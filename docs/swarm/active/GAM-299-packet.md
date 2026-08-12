# GAM-299 task packet (HEAVY) — revision 3, DISPATCH

> **Gate status: premise-gate round 2 returned DISPATCH** (5 MINOR, 2 NIT, no
> MAJOR, no BLOCKER), satisfying constitution item 19 and Definition of Ready #1.
> Revision 3 is revision 2 with those eight findings folded in; §12 tables them.
> Everything in this packet marked *(measured)* was executed against a real
> PostgreSQL 16 cluster by a gate agent, not reasoned about.

**Issue:** GAM-299 — `events`/`event_sessions` RLS scopes by the legacy
`students.team_id`, so a dual-team student never receives their second team's
events. Legacy id `T806`. Labels `area/w5`, `tier/heavy`.

**Branch:** `claude/gam-299-events-rls-memberships`

**Tier: HEAVY.** Item 26 names "RLS/auth/role logic" and "a migration" directly;
item 18's first two triggers (a file under `supabase/migrations/`, an RLS policy)
both fire, so the worker is dispatched with `model: "opus"`.

**Revision 2** answers premise-gate round 1 (REVISE: 3 MAJOR, 6 MINOR, 1 NIT, no
BLOCKER). Round 1's measurements are folded in below and its §9 records what
changed. **The gate confirmed the premise by running it** — see §2.

---

## 1. The defect, in one paragraph

Two `select` policies scope event visibility by the legacy single-team column
`students.team_id`. The page (`StudentHome`, via T187) and all four consuming
views moved to ACTIVE `student_teams` memberships (`left_on is null`). For a
student who is a member of two teams, an event scoped to their *second* team
satisfies the page's scope test and is filtered out by RLS before it reaches the
browser. Nothing on screen indicates rows are missing.

*(The four views are `v_student_participation` — defined at
`20260722000000_membership_views.sql:59` and **superseded** by
`20260806000000_met01_explicit_marks.sql:102-137`, membership join at `:109` —
plus `20260722000000_membership_views.sql:86`,
`20260723000000_kpi_views.sql:256` and
`20260723000001_dashboard_views.sql:205`. Round 1's MINOR-6 corrected revision 1,
which attributed all four to one file; round 2's NIT-6 corrected revision 2,
which then listed five sites for four views by counting one view twice.)*

## 2. The premise, measured

**This is the first time this row's claim has been executed rather than read.**
The filing says twice, in its own words, that its claim was read from the policy
text and never measured, and that the row must not be closed on a claim a
measurement was run.

Premise-gate round 1 stood up a scratch PostgreSQL 16 cluster carrying the real
migrations, seeded a student with ACTIVE memberships in teams A and B
(`students.team_id` = A), an event scoped to `team_ids = {B}` and a session on
it, and impersonated that student as `authenticated`:

```
          measurement          | value
-------------------------------+-------
 dual   events total           | 3        <- 4 events exist
 dual   sees event B           | 0        <- THE BUG
 dual   sees event A           | 1
 dual   sees event NULL        | 1
 dual   sessions total         | 3
 dual   sees session B         | 0        <- THE BUG, event_sessions agrees
 admin  events total           | 4
 coach  events total           | 4
```

**The bug reproduces.** Proceed.

## 3. Verified state of `main` (`28f7394`)

Every row below was verified by the author *and* independently by the gate.
Corrections from round 1 are folded in and marked.

| Claim | Where | Status |
| -- | -- | -- |
| `events` read policy tests `s.team_id = any(events.team_ids)` | `20260717000002_rls.sql:153-161` | verified verbatim, lines current |
| `event_sessions` policy repeats the test via `event_id` | `20260717000002_rls.sql:180-189` | verified; the issue's `:180-188` omits the closing `);` |
| `v_student_participation` joins `student_teams … left_on is null` | verbatim at `20260722000000_membership_views.sql:59-65` (join on `:63`), but **that definition is superseded**: `pg_get_viewdef` on a live cluster returns the `marked` CTE from `20260806000000_met01_explicit_marks.sql:102-137`, membership join at `:109` | verified *(round 2 MINOR-5; the substance — active memberships — holds in both, but cite the live one)* |
| Nothing writes `student_teams` | no `insert`/`upsert`/`update`/`delete` in `src/`, `supabase/functions/`, `scripts/`, or any migration except the one-time backfill at `20260721000000_student_teams.sql:37`; **and no trigger writes it** (gate enumerated `pg_trigger` on a live cluster) | verified |
| Its one non-test **query** in `src/` | `src/lib/supabase/loaders/students.ts:486` is `.from('student_teams')`, `:487` is `.select('team_id')` | verified *(MINOR-5: revision 1 put the `.select` on `:486`, and said "reference" where it meant "query" — there are ~20 non-test comment references)* |
| `student_teams` is readable by any authenticated session | `20260721000000_student_teams.sql:86-87`, `read_all … using (true)` | verified — **and load-bearing**, see §5.3 |
| `students.team_id` is `not null` | `20260716000000_identity_roster.sql:63` — `team_id uuid not null references public.teams (id) on delete restrict` | verified *(MINOR-7: revision 1 deferred this to the worker; 19c makes it the author's job)* |
| No later migration drops or replaces either policy | all 24 files under `supabase/migrations/`; `own_or_linked_read` appears later only in comments, except `20260804000001`, which touches `rsvps` only | verified |
| `ci.yml:227` runs `bash tests/rls/run.sh` in the `sql` job | `.github/workflows/ci.yml:227` | verified |
| `tests/rls/run.sh` applies the migrations **except two skipped by name** — `20260719000000_cron.sql` and `20260720000001_avatar_storage.sql` (`run.sh:90-93`) | the new migration is not in that skip list, so it is picked up | verified *(MINOR-4: revision 1 said "every file", the exact sentence `T701` had already corrected once at `run.sh:14-16`. Do not write it a third time.)* |

**Two corrections to the issue text**, to be recorded on the issue:

1. **"T705 is the open row for that missing writer" — T705 is GAM-298, and it
   reads `Done`** while the writer still does not exist. The constraint stands
   because it was re-measured in code, not because the tracker says so.
2. **The `event_sessions` policy ends at line 189, not 188.**

## 4. Authority to change this policy at all (item 3)

*Round 1's MAJOR-2: revision 1 never addressed item 3, which makes re-deriving an
RLS policy a BLOCKER. Decided here rather than left for `checker-reviewer` to
raise post-hoc.*

Item 3: *"RLS policies and metric SQL come only from PRD Section 8.4, copied
verbatim. Re-deriving either → BLOCKER."*

1. **Nothing shipped is re-derived.** §5 adopts the additive route: the existing
   `own_or_linked_read` policies stay **byte-for-byte intact**. No 8.4-derived
   text is edited, dropped or paraphrased. This is the single strongest reason to
   prefer the additive route and it is why MAJOR-2 largely dissolves rather than
   needing a ruling.
2. **The change stays inside PRD 8.3's matrix row.** That row reads
   *"events/sessions | student: read team-scoped."* A dual-team student reading
   both of their teams' events **is** team-scoped. What moves is the definition of
   "their team", not the shape of the grant.
3. **PRD v2 SCH-01 authorises that move**
   (`VOLT_Portal_PRD_v2.md:160-165`): `team_id` *"remains as legacy/primary-team
   until every reader migrates."* RLS is the last unmigrated reader.
4. **The in-repo precedent went the same way.**
   `20260804000001_widen_rsvp_read_all_authenticated.sql:7-14` faced this decision
   on this same policy name and chose an additive second policy, recording:
   *"Postgres ORs permissive policies together, so a second `using (true)` policy
   is sufficient; nothing is dropped or rewritten."*
5. **Two authorities stronger than the argument above, supplied by gate round 2
   (NIT-8) and cited here because they are cheaper and more durable.** First, the
   owner's ruling **D018, 2026-08-06, verbatim: *"it has to be multi-team"***
   (`docs/swarm/auto-mode-decisions.md`) — that fixes the direction of travel and
   is not an inference from matrix wording. Second, and directly on item 3:
   `20260722000000_membership_views.sql:59-65` moved a PRD-8.4-**normative** view
   onto memberships **with no dispute-log entry** — `grep -n
   "student_teams\|membership" docs/swarm/dispute-log.md` returns zero hits. Item
   3 names RLS and metric SQL in one sentence, so that is an uncontested in-repo
   precedent for exactly this decision, on the *stricter* half of the rule.
   *(Also verified by round 2: PRD 8.4 contains **no** `events` policy text at
   all — only canonical shapes — so the shipped `own_or_linked_read` is itself a
   derivation, and nothing 8.4-verbatim is touched by this change.)*

**Decision: no dispute-log entry is required.** D013 and D014 needed owner rulings
because each *widened access beyond the matrix* or *changed a metric denominator*.
This does neither: it adds no role, removes no restriction from the matrix, and
changes no metric. **`checker-reviewer` is asked to challenge this specific
paragraph** — if it disagrees, that is an escalation to `boss-arbiter`, not a
worker rework.

## 5. What "done" looks like

### 5.1 The route: an additive second policy, nothing dropped

*Round 1's MAJOR-3. Revision 1 proposed `drop policy if exists` + `create policy`
with a "bridge" clause. The gate measured a cheaper route working and this
revision adopts it.*

New file `supabase/migrations/20260812000000_events_rls_active_membership_read.sql`:

```sql
create policy active_membership_read on events
  for select to authenticated
  using (
    exists (
      select 1 from students s
      join student_teams st on st.student_id = s.id and st.left_on is null
      where s.id in (select my_student_ids())
        and st.team_id = any(events.team_ids)
    )
  );

create policy active_membership_read on event_sessions
  for select to authenticated
  using (
    exists (
      select 1 from events e
      join students s on s.id in (select my_student_ids())
      join student_teams st on st.student_id = s.id and st.left_on is null
      where e.id = event_sessions.event_id
        and st.team_id = any(e.team_ids)
    )
  );
```

Policy names are per-table, so one name on both tables is fine. Postgres ORs
permissive policies, so this **only ever adds** visibility.

**Why this beats revision 1's drop-and-replace, on four counts:**

| | additive (adopted) | drop-and-replace (rejected) |
| -- | -- | -- |
| Item 3 exposure | none — nothing shipped is re-derived | re-derives a shipped policy |
| Membership-less student | already covered by the shipped policy; **no bridge clause exists to get wrong** | needs a bridge clause, and the whole failure mode the issue feared lives in it |
| Worst case if the new policy is wrong | a student sees *fewer of the new* rows | a student sees **no events at all** |
| Criterion 3, legacy-team configuration | not satisfied (see §5.2) | satisfied |

Item 26's test is *"can a mistake here corrupt data, or lie to a user about their
own data?"* The additive route makes that outcome structurally unreachable: no
mistake in the new policy can remove a row a student can see today. That is worth
more than the one configuration it gives up.

`staff_all` on both tables is **not touched**. No `team_ids is null` branch is
needed — the shipped policy already covers global events, including its
deliberate deviation that a caller needs at least one linked student for **any**
event, documented at `20260717000002_rls.sql:133-145` (the `events` copy) and
`:176-179` (the `event_sessions` copy). *(Round 2's NIT-7: revision 2 cited only
the second and called it the `events` one.)*

**Item 10** is respected (new file; `20260717000002_rls.sql` untouched).
**Item 16** is respected: **the migration ships unapplied.** CI applies it to a
disposable scratch cluster; that is not cutover.

### 5.2 What this route gives up — TWO configurations, stated plainly

*Round 2's MINOR-1. Revision 2 said "the ONLY configuration", and that was
measurably false. Both are recorded here, and both belong in the migration
comment and the PR body.*

> **WITHDRAWN, post-merge-gate, by `boss-arbiter` (D019 §4).** The framing
> sentence below — *"Two states therefore keep a grant that a memberships-only
> policy would deny"* — **is false for (b)** and is withdrawn on the same terms
> revision 2's *"no code path can produce that state"* was. **Measured:** the
> rejected memberships-only route grants the former team **too** (the stale row
> reads `left_on is null`, so a membership test cannot tell it from a live one)
> **and additionally denies the student's current team** (1/1 → 0/0), because its
> bridge fires only for a student with *no* membership rows. So (b) is
> **route-independent and data-caused**, not a cost of this route:
>
> | re-teamed student | former team A | current team B |
> | -- | -- | -- |
> | shipped only (today) | 0 / 0 | 1 / 1 |
> | **shipped + additive (adopted)** | **1 / 1** | **1 / 1** |
> | memberships-only + bridge (rejected) | **1 / 1** | **0 / 0** |
>
> On the only configuration the application can actually produce, the adopted
> route is **strictly better on both axes** — so §5.1's table understates it. Only
> (a) below is genuinely given up by this route, and (a) is unreachable today.

Because the shipped policy stays live and grants by `students.team_id`, this
route does not *remove* any grant that column produces. Two states keep a grant a
memberships-only policy would deny **(a)** or that the missing writer produces
regardless of policy **(b)**:

**(a) Left team that is also the legacy team.** A student whose membership in a
team is `left_on`-set **and** whose `students.team_id` still names that same team
keeps seeing it. *(Measured: `leftlegacy` still sees event A.)*

**(b) Re-teamed student — and this one the application actually produces.** The
only write path, `loaders/students.ts`, updates `students.team_id` and never
touches memberships (D018). So a student moved from team A to team B has
`students.team_id` = B while the 2026-07-21 backfill row for **A** is still
`left_on is null`. The new policy therefore grants A as an "active" membership,
and the student gains read of their **former** team's events and sessions.
*(Measured: 0 → 1 on both tables — visibility that does not exist today.)*

**Revision 2's blanket defence — "no code path can produce that state" — is
withdrawn.** It is true of `left_on`, and false for (b): the app's only write path
produces (b), and D018 records the drift as already present in real data. Do not
repeat that sentence.

Three reasons this remains the right trade, and the packet takes responsibility
for it rather than hiding it in a criterion:

1. **RLS is moving *toward* what the app already computes, not away from it.**
   `v_student_participation` already counts that same stale membership
   (`20260806000000_met01_explicit_marks.sql:109`), so (b) makes the policy agree
   with the participation numbers the student is already shown. The alternative
   route would have made them disagree in the opposite direction.
2. **Criterion 3 as the issue words it is still satisfied**, with its named
   mutation still going red — measured, see §6.3.
3. **Neither is a security finding under item 25.** A former teammate seeing a
   meeting list, on a ~20-student volunteer robotics portal whose dashboard
   already shows every student's hours to every student, is not a concrete
   plausible harm in this threat model. Correctness is untouched: no number
   changes, and no student is shown anything about themselves that is false.

**Both are closed by the same trigger** — §8's deferral. When a `student_teams`
writer ships, it fixes (b) at the source *and* unblocks dropping the legacy
policies, which fixes (a).

**The trigger that closes it** is the same one that ends every other compromise
here: when a `student_teams` writer ships, the legacy `own_or_linked_read`
policies get dropped and memberships become the only source. That is §8's
deferral, and dropping them is what finally satisfies criterion 3 in every
configuration.

### 5.3 TWO dependencies the migration must name in its own comment

*Round 1's MINOR-8. Revision 1 asserted a subquery on `student_teams` inside an
`events` policy "is not silently filtered". Right conclusion, wrong mechanism.*

RLS on `student_teams` **is** evaluated inside the `events` policy expression.
The gate ran it in both directions:

```
 who                  | sees_event_b | sees_session_b
----------------------+--------------+----------------
 dual, read_all=false |            0 |              0     <- visibility COLLAPSES
 dual, read_all=true  |            1 |              1
```

So this policy works **because** `read_all … using (true)`
(`20260721000000_student_teams.sql:86-87`) admits every row — a hard coupling,
and it holds for `event_sessions` as well as `events`.

**There is a second coupling, and revision 2 missed it entirely** *(round 2's
MINOR-3)*: **RLS on `students`**. Under the orphan session,
`select count(*) from students` is **0** while `select count(*) from
student_teams` is **6** — so the orphan denial in criterion 4 rests on `students`'
own policy filtering the new policy's subquery, **not** on `my_student_ids()`.
This is why criterion 4's original mutation was vacuous (§6.4).

**The migration's comment must name both dependencies**, so that a future
narrowing of either table's read policy does not silently change event
visibility.

The grant question resolves the other way and does so loudly, not silently:

```
revoke select on student_teams from authenticated;
select count(*) from events;         -> ERROR:  permission denied for table student_teams
```

and production must already carry that grant, because T187 reads `student_teams`
from the browser as `authenticated` (`students.ts:486-487`) and `StudentHome`
works.

### 5.4 Performance: a real regression, accepted at this scale

*Round 2's MINOR-4, and revision 2 got this backwards. Revision 2 wrote "the doubt
is closed in the packet's favour" on the strength of round 1's "~33% faster" —
but that number belongs to the **rejected** drop-and-replace route, which
**replaced** the shipped subplan. The adopted route **stacks** a subplan on top of
it.*

Measured by gate round 2 on the route actually adopted (shipped + additive, both
live), same cluster, same query, only the policy set changing:

```
20,004 events, `select count(*) from events` as the dual student
  shipped policy alone (today):       1922.744 / 1931.783 / 1936.876 ms
  shipped + additive (ADOPTED):       2997.920 / 3038.421 / 3034.084 ms   <- +57%
500 events (realistic scale)
  shipped policy alone (today):         49.794 /  49.259 /  49.575 ms
  shipped + additive (ADOPTED):         71.260 /  71.383 /  71.747 ms     <- +22 ms
```

The plan says why: `Filter: (is_staff() OR (SubPlan 2) OR (SubPlan 4))` — the new
subplan runs for every row the shipped one rejects (`SubPlan 4 … loops=10002`).

**This is a regression and the packet accepts it.** +22 ms on a bare unfiltered
`count(*)` at the scale this team actually runs at is not a shipping concern, and
it buys the structural safety in §5.1. **Say this in the PR; do not let a reader
discover it.** The worker reproduces the number in its own worktree for the
completion report — the experiment is already designed, so this is a replay, not
a design task.

### 5.5 The assertions, and where they land

**Do not add a CI step.** `.github/workflows/**` is unpushable from a dispatched
run (`AGENTS.md`, "Two walls"), and it is not needed: `ci.yml:227` already runs
`bash tests/rls/run.sh` in the `sql` job, and that runner applies every migration
except the two it skips by name (§3), so the new file is picked up with no wiring
change. The gate proved this end to end.

Land the coverage as:

* `tests/rls/gam299_seed.sql` — fabricated fixtures (item 6) on a UUID prefix that
  cannot collide with `tests/rls/seed.sql`'s ids;
* `tests/rls/gam299_assertions.sql` — PASS/FAIL report, same `\gset` +
  `begin; set local role authenticated; … rollback;` method as
  `tests/rls/assertions.sql`;
* a small addition to `tests/rls/run.sh` loading the new seed and the new
  assertions **after** the existing assertions have run.

#### 5.5.1 `tee -a`, and why this is an acceptance criterion rather than a note

*Round 1's MAJOR-1, and it is the most dangerous finding of the round.*

Revision 1 said the new report could tee "into the same `$REPORT_FILE` … either
way". Those two options are not equivalent. `tee` **truncates**. The gate
implemented revision 1's wording literally, planted one deliberate FAIL in the
**pre-existing** `assertions.sql`, and ran it:

```
 B-own-profile-students-own-row        | 99  | 1  | FAIL     <- printed on screen
 G-dual-sees-team-b-event              | 0   | 0  | PASS
==> T020 NFR-02 RLS-denial test suite: ALL CASES PASSED
EXIT CODE = 0
```

`grep -q 'FAIL'` at `run.sh:118` only ever saw the new file. **Every pre-existing
RLS-denial case would have become advisory in CI** — a guard that no longer fires,
which is the exact defect class this repo keeps recording. With `tee -a`:

```
 B-own-profile-students-own-row        | 1   | 1  | PASS
 G-dual-sees-team-b-event              | 1   | 0  | FAIL
==> AT LEAST ONE CASE FAILED
EXIT CODE = 1
```

**`tee -a "$REPORT_FILE"` is mandatory** (or a second report file that `grep`
also reads). Criterion 10 makes it evidence rather than intent.

### 5.6 Fixtures needed

Fabricated names only (item 6). The new seed loads **after** the existing
assertions have run, so no existing case's counts can move — verify that, do not
assume it. At minimum:

* team B, an event scoped to `{B}` only, and a session on it;
* a **dual-team** student: `students.team_id` = A, active memberships in A and B;
* a **membership-less** student: a `students` row with `team_id` = A and no
  `student_teams` row. The backfill at `20260721000000_student_teams.sql:37` runs
  at migration time, *before* any seed, so a seeded student has no membership row
  unless the seed adds one — the gate confirmed this, including for the existing
  `tests/rls/seed.sql` students;
* a **left-team** student: `students.team_id` = A, membership in B with `left_on`
  set;
* the existing profile-less orphan session, reused for criterion 4;
* an admin and a coach profile for criterion 6.

## 6. Acceptance criteria

The issue's seven, plus three the packet adds. Each names the mutation that must
redden it; a criterion with no such mutation is not a criterion.

1. **A dual-team student receives both teams' events.** Active memberships in A
   and B; receives an event scoped to `{B}`, and its session.
   *Mutation: drop the new `active_membership_read` policy → red.*
   **(Substitution, stated openly:** the issue words this mutation as "restore the
   `s.team_id` test". That wording presumes replacement; under the additive route
   the equivalent falsifier is removing the new policy. Same question — does the
   membership test carry the visibility.**)**
2. **A student with no membership row is not made worse off.** They still receive
   the events they receive today.
   *Mutation: drop the shipped `own_or_linked_read` policy on `events` → red.*
   Under this route the shipped policy **is** what handles the gap, so this
   criterion also pins the rule that it must not be removed while no writer
   exists. The gate measured the failure it guards: removing that coverage drops
   the existing fixture student from 20,003 events to 1.
3. **A left team stops granting access.** A student with `students.team_id` = A
   and a `left_on`-set membership in B does not receive B's events.
   *Mutation: drop `st.left_on is null` from the new policy → red.*
   Scope is stated in §5.2 and is deliberate: this holds for the configuration the
   criterion describes, and not where the left team is also the legacy
   `students.team_id`.
4. **A session with no linked student still sees zero rows**, including for events
   with `team_ids is null`.
   *Mutation: **remove the `students` table from the new policy entirely**,
   leaving `exists (select 1 from student_teams st where st.left_on is null and
   st.team_id = any(events.team_ids))` → red (measured: orphan 0 → 2 events, 0 → 2
   sessions).*
   **Do not use revision 2's mutation ("relax the linked-student requirement",
   i.e. drop `s.id in (select my_student_ids())` and keep the rest) — gate round 2
   ran it and it stays GREEN**, because the orphan is denied by a second mechanism:
   RLS on `students` filters the subquery (§5.3). That was a packet defect, and a
   worker replaying it would have reported "mutation applied, still green" and
   burned a rework loop on it. Note also that the `team_ids is null` half of this
   criterion is carried entirely by the **shipped** policy, so no mutation of the
   new policy can redden it — criterion 2's mutation is what covers that half.
5. **`events` and `event_sessions` stay in agreement**, on every case above.
   *Mutation: change one policy and not the other → red.*
6. **Staff visibility is unchanged.** `staff_all` returns everything for admin and
   coach. *Mutation: scope staff reads by membership → red.*
7. **Proven on a real cluster.** Real PostgreSQL, real policies, real psql output
   in the completion report — not fixtures, not reasoning.
8. **No pre-existing `tests/rls` case changes its result or its expected value**,
   and `bash tests/rls/run.sh` exits 0.
9. **The six repo gates pass** (`gate-run`). No application code changes, so this
   is a regression check, not the main evidence.
10. **A planted FAIL in the *pre-existing* `tests/rls/assertions.sql` still fails
    the script after the `run.sh` change**, with a non-zero exit code, and the
    real output is in the completion report. *Mutation: use `tee` instead of
    `tee -a` → the script wrongly passes.* Run this in your own worktree
    (item 23), and revert the planted FAIL.

**Criterion 7 is the one this row has never had.** A completion report without
real psql output from a real cluster does not close this issue.

## 7. Allowed Files

* `supabase/migrations/20260812000000_events_rls_active_membership_read.sql` (new)
* `tests/rls/gam299_seed.sql` (new)
* `tests/rls/gam299_assertions.sql` (new)
* `tests/rls/run.sh` (add the two loads; do not restructure the script)

**Forbidden, explicitly:** `.github/workflows/**` (unpushable — §5.5),
`supabase/migrations/20260717000002_rls.sql` (item 10), `tests/rls/assertions.sql`
and `tests/rls/seed.sql` (criterion 8 depends on them being untouched; criterion
10's planted FAIL is a mutation in your own worktree that you revert, not an
edit you deliver), anything under `docs/swarm/**` or `.claude/**`
(orchestrator-owned), and any application source under `src/`. **This change
ships no application code.** If you believe it needs some, that is an escalation,
not an edit.

## 8. Deferral to file (item 20, via `linear-task-writing`)

**The `student_teams` writer, and the legacy-policy drop that depends on it.**
The additive route leaves both legacy policies granting by `students.team_id`
permanently. The row must state: when a membership writer ships, drop
`own_or_linked_read` on `events` and `event_sessions`, which is what finally
satisfies criterion 3 in every configuration — and note that doing so requires
adding `student_teams` rows to `tests/rls/seed.sql`, because the existing fixture
students have none and would otherwise lose all visibility (measured: 20,003
events → 1).

Check GAM-298 (T705) first: it reads `Done` while the writer is absent, so the
correct action may be reopening it rather than filing a new row.

## 9. What changed from revision 1

| Round 1 finding | Disposition |
| -- | -- |
| MAJOR-1 `tee` truncates, disarming the existing suite | §5.5.1 mandates `tee -a`; new criterion 10 makes it evidence |
| MAJOR-2 item 3 authority never addressed | §4, decided rather than deferred; largely dissolved by the route change |
| MAJOR-3 additive route never considered | **adopted** — §5.1, with the rejected route and the trade-off tabled |
| MINOR-4 "every migration" (a sentence T701 already fixed once) | §3, corrected |
| MINOR-5 `students.ts:486` vs `:487`; "reference" vs "query" | §3, corrected |
| MINOR-6 four views attributed to one file | §1, corrected |
| MINOR-7 `students.team_id not null` deferred to the worker | §3, verified by the author |
| MINOR-8 wrong mechanism for the `student_teams` subquery | §5.3, restated + required in the migration comment |
| MINOR-9 deferral must mention seeding memberships | §8 |
| NIT-10 "expression-for-expression identical" | dropped; the two policies are branch-for-branch semantically identical |
| §7.4 perf doubt resolved in the packet's favour | §5.4, with a re-measure asked for the route actually adopted |

## 10. Least confident decisions (item 19d)

1. **Trading §5.2's two over-granting configurations for structural safety
   (§5.1/§5.2).** *Wrong if* the issue's author meant criterion 3 to be absolute,
   in which case the drop-and-replace route and its bridge clause come back and
   the packet has picked the wrong side of a stated requirement. **Round 2
   attacked this and returned "SOUND on the trade, WRONG on the scope of what is
   traded"** — the second configuration (b), a re-teamed student seeing their
   former team, is produced by the app's only write path, so half of revision 2's
   defence was withdrawn (§5.2). What survives is the argument that now carries
   the decision: the additive route makes "student sees no events at all"
   structurally unreachable, and (b) makes RLS agree with participation numbers
   the student is *already* shown. **This remains the decision `checker-reviewer`
   should attack first, on the amended facts.**
2. **Deciding no dispute-log entry is required (§4).** *Wrong if* "read
   team-scoped" in PRD 8.3 is read as naming `students.team_id` specifically
   rather than a student's team membership — then this is a widening beyond the
   matrix and D013 is the governing precedent, which took an owner ruling.
   *Round 2 graded this SOUND and supplied §4.5's two stronger authorities; the
   doubt is much reduced but the decision is still the orchestrator's, so it
   stays on this list.*
3. **The permanent residue is acceptable.** Both legacy policies keep granting by
   `students.team_id` indefinitely, with only a deferral row scheduling their
   removal. *Wrong if* that row goes the way of the deferrals item 20 was written
   about — filed, never triaged — in which case a second source of truth for event
   visibility lives in the schema forever.
4. **`tests/rls/run.sh` is the right host.** *Wrong if* appending a second
   seed/assertions pair to a shared runner proves fragile in a way one green run
   does not reveal — e.g. a future third suite repeating the `tee` mistake.
   A separate runner + CI step is the alternative, and it is undeliverable from
   this run (workflow wall), which is a reason to prefer this host but not
   evidence that it is correct.
5. **The scratch-cluster result generalises to hosted Supabase.** *Wrong if* the
   hosted project's grant posture differs. The gate showed RLS enforced against a
   non-superuser `authenticated` role with no `BYPASSRLS`, and no view is
   involved, so ownership is not load-bearing. Production is unreachable from
   here; **say so in the PR rather than claiming full generalisation.**

## 11. Process

Premise gate: **round 1 REVISE → round 2 DISPATCH.** Item 19 is satisfied; the
two-round cap (19a) was not exceeded and no owner escalation is needed. Next:
worker (opus, item 18), then `checker-reviewer` replaying the criterion mutations
in its own worktree (item 23).

## 12. Round 2 findings, and where each landed

| Round 2 finding | Disposition in revision 3 |
| -- | -- |
| MINOR-1 §5.2 named only one given-up configuration; its blanket defence was false | §5.2 rewritten around **two** configurations; "no code path can produce that state" explicitly **withdrawn**; both required in the migration comment and the PR |
| MINOR-2 criterion 4's mutation is vacuous (measured green) | §6.4 replaced with the mutation that reddens, and the old one recorded as a trap so nobody re-derives it |
| MINOR-3 §5.3 named one coupling, there are two | §5.3 now names `student_teams.read_all` **and** `students`' RLS; both go in the migration comment |
| MINOR-4 §5.4's perf headline was wrong for the adopted route | §5.4 rewritten: **+57% at 20,004 events, +22 ms at 500**, cause named, accepted on the record, and required in the PR |
| MINOR-5 `v_student_participation` citation is superseded | §3 now cites the live definition (`met01_explicit_marks.sql:102-137`, join `:109`) alongside the original |
| NIT-6 five sites listed for four views | §1 corrected — one view was counted twice, before and after supersession |
| NIT-7 `rls.sql:176-179` is the `event_sessions` comment | §5.1 now cites `:133-145` (events) and `:176-179` (sessions) |
| NIT-8 §4 should cite D018 and the `membership_views` precedent | §4.5 added — the owner's *"it has to be multi-team"* ruling, and a PRD-8.4-normative view migrated with no dispute entry |

Two things round 2 supplied that the worker should **use rather than re-derive**:
the correct criterion-4 mutation (§6.4) and the performance experiment (§5.4).
