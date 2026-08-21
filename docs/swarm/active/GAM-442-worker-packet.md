# GAM-442 — worker packet (HEAVY) — **revision 3, GATED, dispatch-ready**

> **Round 2 verdict, and why this is dispatchable.** The gate re-stood a cluster
> and confirmed **both round-1 BLOCKERs closed by measurement** — a view written
> to §4/§4.1 gives `held_ct = 2` where the fan-out gave 5, and criterion (a2)
> goes **red** under mutant 3 while (a), (b1), (b2) and (c) all stay green. It
> then found two new MAJORs in §6(f), which revision 2 had introduced, plus
> three MINORs and a NIT — every one a prescribed text swap needing **no new
> measurement**. Revision 3 applies all of them verbatim. The gate stated
> explicitly that no round-3 gate is required; the item 19a two-round cap is
> spent and not breached.


> **Revision 2, after `checker-premise` round 1 returned REVISE.** The gate ran
> a real PostgreSQL 16.15 cluster, wrote four candidate versions of this view,
> and ran every criterion below against them. It found two BLOCKERs — a fan-out
> that corrupts `held_ct` while leaving `attendance_pct` correct (§4), and a
> declared doubt that was aimed at the wrong risk (§5.2/§8) — plus three
> criteria that passed for the wrong reason (§6 d/e/f). All are fixed below.
> **Every claim in this revision that says "measured" was measured by the gate
> in a live cluster, not read.** Round 2 of the item 19a two-round cap.


**Issue:** <https://linear.app/gamitch/issue/GAM-442>
**Branch:** `claude/gam-442-event-attendance-view` · draft PR #222
**Tier:** HEAVY (item 26: "a migration or metric-view SQL" — this is both).
**Worker model:** `opus` (item 18 triggers: creates a file under
`supabase/migrations/`; creates a SQL view containing metric math).

---

## 1. The task, in one sentence

Add **one new additive migration** creating a view `v_event_attendance` that
reports attendance per **event** (one row per `events.id`), so the coach series
card's "Attendance 96.5% across 21 held" figure comes from SQL and not from a
division in TypeScript (constitution item 3 / PRD DATA-01).

## 2. Allowed Files

Exactly three **new** files. No existing file may be edited, created-over, or
deleted.

1. `supabase/migrations/20260821000000_meetings_event_attendance_view.sql`
2. `supabase/tests/gam442_event_attendance_assertions.sql`
3. `supabase/tests/run_gam442_event_attendance.sh` (mode `755`)

**Forbidden:** every existing migration (item 10 — editing an applied migration
is a BLOCKER), all of `src/**`, all of `docs/**`, `.claude/**`,
`.github/workflows/**`.

**Three files is a real constraint and §6(f) pushes on it.** That criterion
needs a fixture load and two snapshots at three points in the runner's loop;
the in-repo precedent (T503) splits those into six files. **Inline them in
`run_gam442_event_attendance.sh`** (heredoc or `psql -c`) to stay inside these
three. If you conclude that is genuinely not workable, **say so in your report
and stop — do not add a fourth file silently.**

> **Deviation from the issue text, stated deliberately.** GAM-442 says "Allowed
> files: exactly one new file". This packet widens that to three because the
> issue *also* makes `scratch-postgres` mandatory and requires four proofs in
> the PR, and the skill's own closing rule is that assertions worth keeping live
> under `supabase/tests/`. Every sibling assertion set there has a runner
> (`run_t509_explicit_marks.sh`, `run_t205_anon_grant.sh`,
> `run_volunteer_hours_outreach_only.sh`); `run_t509_explicit_marks.sh`'s header
> records that shipping assertions *without* a runner was T509's own defect.
> Both added files are new, additive, and test-only. The widening is recorded
> here and in the PR body rather than done silently.

## 3. Verified premise — measured against `main` at `789e58b`, not taken from the issue

Every claim below was re-checked by the orchestrator before this packet was
written (item 19c). Citations are current.

| Claim | Status |
| -- | -- |
| No view aggregates **attendance** per event; `v_event_attendance` does not exist anywhere in `supabase/` or `src/` | **TRUE** (grep, 0 hits). **Corrected by the gate:** the original wording said "none per-event", which is overstated — `v_event_student_hours` (`20260723000001_dashboard_views.sql:269-291`) *is* per-`events.id`, it just aggregates hours rather than attendance. That view is now this packet's structural precedent; see §4. |
| `attendance.status` is `check (status in ('present','late','excused','absent'))`, `unique (session_id, student_id)` | **TRUE** — `20260717000000_scheduling_attendance.sql:82-95` (the original citation `:79-93` was off by ~3 lines; corrected by the gate) |
| `event_sessions.status` is `check (status in ('scheduled','completed','canceled'))`, `event_id` FK `on delete cascade` | **TRUE** — same file, `:53-63` |
| `events.type` is `check (type in ('meeting','outreach','competition'))`; `team_ids uuid[]` nullable; `counts_participation boolean not null` | **TRUE** — same file, `:33-48` |
| The explicit-marks denominator convention is `count(*) - count(*) filter (where status='excused')`, returning **NULL** (not 0) when that is zero | **TRUE** — `20260806000000_met01_explicit_marks.sql:117-130`, and its `:38-61` states the rule and why the T509 row's literal phrasing would double-subtract |
| No view in this schema sets `security_invoker`, so every view executes as its **owner** and does **not** apply the querying session's RLS to base tables | **TRUE** — `20260805000000_dashboard_views_comment_corrections.sql:41-49`, measured there rather than reasoned |

**Three corrections to the issue's framing, found while measuring:**

1. **PRD 8.2 defines no per-event attendance metric.** MET-01…MET-05 are
   per-student and per-team, season-scoped. So there is **no 8.4 verbatim SQL to
   copy** for this view — item 3's "copy, do not re-derive" has no source text
   here. That is not a licence to improvise: see §5 for what governs instead.
2. **Two attendance conventions coexist on `main` today.** T509 moved
   `v_student_participation` / `v_team_participation` to explicit marks + NULL.
   It did **not** move `v_season_attendance_rate`, which still uses the old
   eligibility cross-product and `greatest(count(*),1)`
   (`20260723000001_dashboard_views.sql:197-222`). The issue names the T509
   convention and this packet holds it to that; the divergence is pre-existing,
   out of scope, and is **not** to be "fixed" here.
3. **The `held_ct` the card needs is per-event, but T509's convention counts
   marks, not sessions.** Both numbers are required and they are different
   things — see §4's column contract. Do not let one imply the other.

## 4. The column contract

One row per `events.id`, **all event types** (the issue permits this; restricting
to meetings would make the view useless to a later outreach surface for no gain).

| Column | Meaning |
| -- | -- |
| `event_id` | `events.id` — the grain. One row per event, always. |
| `held_ct` | **`count(distinct es.id)`** — that event's `event_sessions` with `status = 'completed'`. Counts **sessions**, not marks. Read the fan-out warning below before writing this. |
| `graded_marks_ct` | **`count(a.id)`** — `attendance` rows on those held sessions. Every explicit mark, including excused. |
| `excused_ct` | **`count(a.id) filter (where a.status = 'excused')`**. |
| `attended_marks_ct` | **`count(a.id) filter (where a.status in ('present','late'))`**. MET-05: late **is** present for every metric. |
| `attendance_pct` | `round(100.0 * attended_marks_ct / (graded_marks_ct - excused_ct), 1)`, or **NULL** when that denominator is `0`. |

### 4.1 The fan-out — BLOCKER-1, measured, read this before writing a line of SQL

The obvious single chain `events left join event_sessions (completed) left join
attendance` **multiplies held sessions by marks**: a held session carrying *n*
marks appears *n* times, so a bare `count(es.id)` counts that session *n* times.
The gate built exactly that view and measured it on the §6(a) fixture:

```
  ev  | held_ct | graded_marks_ct | excused_ct | attended_marks_ct | attendance_pct
------+---------+-----------------+------------+-------------------+----------------
 0001 |       5 |               5 |          1 |                 3 |           75.0   <-- held_ct 5, truth is 2
 0003 |       2 |               2 |          2 |                 0 |                  <-- held_ct 2, truth is 1
```

**`attendance_pct` is correct in that output.** The percentage divides two
counts that fan out by the same factor, so the error cancels and the view looks
right. `held_ct` does not cancel, and `held_ct` is user-visible — it is the
"across 21 held" half of the card's own headline in §1. Every acceptance
criterion in revision 1 passed against this corrupted view.

Two correct shapes; take either:

- `count(distinct es.id)` for `held_ct` **and `count(a.id)` for every mark
  count**, or
- pre-aggregate held sessions in their own CTE over `event_sessions` alone and
  join that to the marks aggregate.

**The spellings in §4's table are the shape-1 answer.** If you take shape 2,
`count(*)` over a CTE that touches `event_sessions` alone (or `attendance`
alone) is correct, and the "never `count(*)`" rule below does not apply — that
rule is about `count(*)` **over the left-joined row set**, where the
null-extended row counts as a phantom mark. Both shapes were measured
byte-identical by the gate. **State in your header comment which shape you
took**, so the checker grades §4 by meaning rather than by token.

**Follow `v_event_student_hours` (`20260723000001_dashboard_views.sql:269-291`)
as the structural precedent.** It is this same `events → event_sessions
(completed) → attendance` join at `events.id` grain and already uses
`count(distinct …)` for exactly this reason. Its one divergence from what you
need is that it uses inner joins, so zero-session events vanish — which is the
one thing §4 already tells you to change.

**Never `count(*)`.** In a left join the null-extended row counts as 1, so
`count(*)` reports one phantom mark for an event with no marks at all. Measured:

```
 0002 |       1 |               1 |          0 |                 0 |            0.0   <-- fabricated 0, §4 forbids it
 0004 |       0 |               1 |          0 |                 0 |            0.0   <-- fabricated 0, and this event has no sessions
```

That is the NULL-never-zero rule below being violated by the aggregate's
spelling rather than by its logic.

Hard rules on this contract:

- **NULL, never a fabricated 0.** No `greatest(..., 1)` floor anywhere. An event
  with held sessions and zero marks has `attendance_pct = NULL`, and so does an
  event whose every mark is excused. The UI renders NULL as an em dash.
- **Every event gets a row, including one with zero held sessions** (`held_ct =
  0`, all mark counts `0`, `attendance_pct` NULL). The card must be able to say
  "0 held" rather than find no row and guess. Use `left join`s from `events`.
- **Marks on non-held sessions do not count**, anywhere, in any column. A
  `scheduled` or `canceled` session contributes nothing even if attendance rows
  exist against it.
- **No student-level filtering.** Do **not** join `students`, `student_teams`,
  or filter on `s.is_active` / `st.left_on` / `e.counts_participation`. See §5.2
  — this is the packet's most consequential decision and it is deliberate.
- Column types: the `*_ct` columns are `bigint` — that is the type `count()`
  returns, **not an instruction to write `count(*)`** (see §4.1).
  `attendance_pct` is `numeric` from `round(..., 1)`. Do not cast them narrower.

Also required in the migration file:

- `comment on view public.v_event_attendance is '…'` carrying: the grain, the
  explicit-marks denominator rule, the NULL-not-zero rule, that `held_ct` counts
  sessions while every other count counts marks, the owner-executes /
  `security_invoker`-is-off fact in the shape
  `20260805000000_dashboard_views_comment_corrections.sql` uses, **and D014's
  inverted-failure-mode warning** — including the sentence, in substance: *"a
  consumer that renders `attendance_pct` without also rendering
  `graded_marks_ct` reintroduces D014's known regression"* (§5.2).
- `comment on column public.v_event_attendance.held_ct` and
  `…​.graded_marks_ct`, because those two are the pair a reader will confuse —
  and §4.1 is the reason one of them is easy to get silently wrong.
- `revoke all on public.v_event_attendance from anon;` — grounded in **PRD 8.3**
  ("no `anon` access except the `ics` and `checkin` Edge Functions"), which is
  normative text.

  **Two corrections the gate measured, both of which change what you write in
  the header comment:**

  1. **T205's rationale does not transfer.** `20260803000001:18-35` chose
     `revoke all` over `revoke select` because a plain `revoke select` left the
     `anon` DELETE privilege intact on an updatable view. `v_event_attendance`
     is an **aggregate** view and therefore not auto-updatable —
     `information_schema.views.is_updatable = 'NO'`, measured, against
     `v_leaderboard_students`'s `YES`. So there is no write path here. The
     statement stays (it is idempotent, `revoke all` is still the right
     spelling, and PRD 8.3 is normative), but do **not** repeat T205's DELETE
     argument as if it applied.
  2. **This is not a security finding and must not be written as one.** What is
     being withheld is event ids and integer counts — no PII. Constitution
     item 25 says verbatim *"Item 4 covers tables; do not extend it to views"*
     and warns against manufacturing a security-class finding out of an
     extension of a rule.

  **Cite GAM-389 and state the disposition.** The cross-view question — five
  existing student-hours views answer unauthenticated requests while the one
  view T205 revoked does not — is already filed as **GAM-389**
  (`docs/swarm/linear-export.md:95`), and its title says the correct posture is
  *undecided*. Your header comment must say, in substance: *"GAM-442 ships this
  revoke because PRD 8.3 is normative text. It does not resolve GAM-389, which
  owns the inconsistent posture across the other views, and it is not a
  precedent for that decision."*
- A header comment in the house style: what, why, what was measured, what was
  deliberately **not** done (the two divergences in §3).

## 5. What governs the SQL, given there is no 8.4 source text

### 5.1 Authority chain, stated so the checker can test it

Item 3 requires metric SQL to be copied from PRD 8.4 rather than re-derived.
**PRD 8.2/8.4 contain no per-event attendance metric**, so there is nothing to
copy. `boss-arbiter`'s ruling in `dispute-log.md:1873-1878` states the operative
rule this repository actually runs on: a dispute-log entry is required when the
**8.3 matrix grant** moves (D013) or an **8.4 normative formula** moves (D014).

Adding a new view for a metric the PRD never defined moves **neither**. It does
not redefine MET-01…MET-05, it does not touch `v_student_participation`,
`v_team_participation`, `v_student_hours` or `v_season_attendance_rate`, and it
does not widen a matrix grant (the view is `revoke`d from `anon`, and staff read
was already `full` on events/sessions/attendance in the 8.3 matrix,
`VOLT_Portal_PRD.md:577-579`).

**Therefore: no dispute-log entry and no `gate/human` for this task.** That
conclusion is the premise gate's first target — if it is wrong, this packet is
wrong before any SQL is written.

### 5.2 Why no student-level filtering — the decision most likely to be attacked

`v_student_participation` filters `s.is_active`, `st.left_on is null`,
`e.counts_participation`, and team scope. This view deliberately does none of
that, for three reasons:

1. **Different subject.** That view answers "how much of what was expected of
   *this student* did they attend". This one answers "how well attended was
   *this event*". Filtering an event's attendance by which students are still
   active today makes a historical event's percentage **change over time as
   students leave** — the number would silently rewrite itself.
2. **`counts_participation` is a student-metric switch, not an attendance-
   happened switch.** An event with `counts_participation = false` still had
   people show up, and a coach's series card is reporting turnout.
3. **Denominator honesty.** The T509 convention's whole point is that the
   denominator is *the marks that exist*. Filtering which marks are allowed to
   exist reintroduces an eligibility judgement through the back door.

**MET-01 rollup consistency is *not* the risk here, and revision 1 was wrong to
name it as one.** The gate settled it: `CoachHome.tsx:1168-1173` already ships a
deliberately divergent ratio carrying an in-code comment that says so — *"A NEW,
disclosed, distinct ratio (module doc #4) -- deliberately NOT MET-01/02's
excused-exclusion formula"*. Per-surface divergent ratios are established house
practice, not a defect.

### 5.3 The real risk, carried forward from D014 — BLOCKER-2

**This view can report 100% for an event most of the roster skipped**, and the
mechanism is one D014 already recorded rather than one this task invents.

`20260806000000_met01_explicit_marks.sql:24-30` states that T508 made "no
attendance row" the **normal** shape for an unmarked student — absences are
written only when a coach explicitly opts in. The explicit-marks denominator
then counts only marks that exist. So **forgetting to mark someone inflates the
percentage.** That file states the consequence verbatim at `:107-112`:

> this INVERTS the failure mode. Forgetting to mark a student now INFLATES
> participation … RPT-02's visible marked/present/late/excused counts are the
> mitigation. **If RPT-02 ever stops showing them, D014 must be revisited.**

The gate measured it at event grain: a 5-student roster across 20 held sessions
where the coach marked only the two students who turned up each night reports

```
  ev  | held_ct | graded_marks_ct | excused_ct | attended_marks_ct | attendance_pct
 0005 |      20 |              40 |          0 |                40 |          100.0
```

100 expected student-turns, 40 marks, **`attendance_pct = 100.0`**. A coach
reads "Attendance 100% across 20 held" for an event 60% of the roster skipped.
Item 26's tier test is *"can a mistake here … lie to a user about their own
data"*; this is that, which is a second independent confirmation of the HEAVY
call.

**The denominator does not change here.** Changing it would move MET-01's
denominator, which D014 owns by owner ruling, and would owe a dispute-log entry
under §5.1's test. **What this task does instead is discharge
D014's own stated mitigation at the new grain:** `graded_marks_ct` and
`attended_marks_ct` are exposed as first-class columns precisely so the
consuming card can show the counts beside the percentage, and the view's
`comment on view` carries the warning so the next reader meets it (§4).

**What would still make this wrong:** if the SeriesCard consumer renders
`attendance_pct` alone. That is a real, disclosed, accepted risk of this design
and the reason proof (b3) exists. It is not resolvable inside a migration — the
mitigation is a column plus a comment, and the consuming ticket has to honour
it. Say so in the PR body rather than letting it be discovered on screen.

## 6. Acceptance criteria — every one measured in a real cluster

Use the `scratch-postgres` skill. **Mandatory**, per the issue. Fixtures use
**fabricated names** (item 6).

### 6.0 The harness — three things the gate measured that will otherwise cost you a round

**(i) `start.sh` does not run in this container.** It aborts as a non-root user:
`chown: changing ownership of '/tmp/scratch-pg-…': Operation not permitted` —
its `su postgres` design assumes root, and this runner is uid 1001. Run `initdb`
and `pg_ctl` **directly as your own user**; `initdb` only refuses *root*, so it
is happy here. **This is not a blocked task and must not be reported as one.**

**(ii) Model the migration loop on `run_t509_explicit_marks.sh`** — same
scratch-DB lifecycle, same platform stub, same "apply every migration unchanged"
loop, same `SKIPPED_MIGRATIONS` list (`20260719000000_cron.sql`,
`20260720000001_avatar_storage.sql`).

**(iii) But that runner alone makes proofs (d) and (e) worthless, so add the
default-privilege simulation.** `run_t509_explicit_marks.sh` does not reproduce
Supabase's stock default privileges. Measured in that bare shape: `relacl` is
`<NULL: owner-only default>` on **every** view, `has_table_privilege('anon', …,
'select')` is already `f` before any revoke, and `authenticated` — the coach —
is **denied on every view in the schema, including the existing ones**:

```
NOTICE:  coach SELECT on new view: DENIED (permission denied for view v_ea_fixed)
NOTICE:  coach SELECT on v_student_participation: DENIED (permission denied for view v_student_participation)
```

So proof (e) would pass for the wrong reason and proof (d) could not pass at
all. Prepend `run_t205_anon_grant.sh:26-30`'s incantation, **before** the
migration loop (it must run before the view is created or it does not apply to
it):

```sql
alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
```

**`calendar_feed_platform_stub.sql` creates only `anon` and `authenticated`, not
`service_role`.** Create it in your runner (`create role service_role nologin;`)
or drop it from the grant list. **`run_t205_anon_grant.sh` is red on `main`
today for exactly this reason** — `ERROR: role "service_role" does not exist`,
exit 1. That is a pre-existing defect, it is **not yours to fix in this task**,
and it is not evidence your own work is broken. Note it in your report; the
orchestrator files it under item 20.

Each proof below must appear in your completion report as the SQL **and** its
real output. Not a description of the output.

**(a) Hand-computed percentage.** Seed one event with **2 held** (`completed`)
sessions, **1 `scheduled`**, **1 `canceled`**. Place `present`, `late`,
`excused` and `absent` marks across the held sessions, **and at least one mark
on the scheduled or canceled session that must not count**. State the
hand-computed expected value before showing the query, then show the view
agreeing with it. The `late` mark must be visibly counted as attended (MET-05)
and the `excused` mark visibly removed from the denominator.

**(a2) `held_ct` is sessions, not marks — the criterion revision 1 lacked.**
On the (a) fixture assert `held_ct = 2` and `graded_marks_ct = 5`. Then assert
`held_ct = 1` on an event with **one** held session carrying **two or more**
marks. Without (a2) the fan-out in §4.1 ships: the gate measured all four of
revision 1's criteria passing against a view reporting `held_ct = 5` for an
event with 2 held sessions.

**(b) NULL, twice.** An event with held sessions and **zero** marks →
`attendance_pct IS NULL`. An event whose **every** mark is `excused` →
`attendance_pct IS NULL`. Neither may be `0.0`. Assert `IS NULL`, not `= NULL`
and not a string comparison.

**(b3) The inflation case, reported as a Known Risk rather than a pass.** Seed
an event whose held-session marks are **all `present`** with no absences
recorded, on a roster materially larger than the number of marks. Assert the
**exact hand-computed numbers**, not a vague inequality: with a 5-student roster
and 20 held sessions marked `present` for only 2 students each night,
`held_ct = 20`, `graded_marks_ct = 40`, `attendance_pct = 100.0`, against **100
roster-turns**. State all four numbers. (Those are the gate's measured values;
reuse them.) This is §5.3 — it is not a bug in your SQL and you must
not "fix" it; it is D014's inverted failure mode arriving at event grain, and
the proof exists so the number and its mitigation are on the record together.
Report it under a heading that says Known Risk, not under the passing criteria.

**(c) Zero-session event.** An event with no sessions at all still produces a
row: `held_ct = 0`, `attendance_pct IS NULL`. Assert the row **count is 1** for
that `event_id` — this is the `left join` proof and a plain `select` that
returns nothing would pass a careless check.

**(d) Coach read, and the weaker ownership case.** With §6.0(iii)'s default
privileges in place, a coach-role (`authenticated`) session `SELECT`s the view
successfully. **Without them this proof is unpassable** — measured, every view
in the schema denies `authenticated`, because no migration grants it.

Then the generalisation question the skill's "Does the result generalise?"
section requires: re-run with the view owned by a `NOSUPERUSER NOBYPASSRLS`
role. **Grant that owner base-table access first.** Measured: without the grant
the run errors `42501 permission denied for table events` — a *harness* cause,
not an RLS one, and a report that reads it as RLS proves nothing. What you are
confirming is the fact recorded at
`20260805000000_dashboard_views_comment_corrections.sql:41-49`: no view here
sets `security_invoker`, so the view executes as its owner and does **not**
apply the querying session's RLS to base tables. Report which case actually
holds; do not generalise silently.

**(e) `anon` grant.** With §6.0(iii)'s simulation in place, report
`pg_class.relacl` **and** `has_table_privilege('anon', …)` before and after the
`revoke`, and run the `revoke select`-only counterfactual alongside `revoke
all`. Measured shape to expect:

```
 BEFORE revoke            | sel t | del t | anon=arwdDxt
 AFTER revoke SELECT only | sel f | del t | anon=awdDxt
 AFTER revoke ALL         | sel f | del f | (anon absent)
```

Note in your report that the surviving DELETE in the middle row is what T205 was
about and that it is **not** a live concern here — this view is `is_updatable =
'NO'` (§4). The counterfactual is run to show the statement does what it says,
not to claim a write path existed.

**(f) Nothing else moved — and the diff must be non-empty to mean anything.**
Snapshot `v_student_hours`, `v_student_participation`, `v_team_participation`
and `v_season_attendance_rate` **before** applying the new migration and
**after**, and diff. Applying everything at once cannot show what your migration
changed.

Split the migration loop **inside your own runner**: hold your migration back
until after the before-snapshot, exactly as
`supabase/tests/run_t503_widen_rsvp_read.sh:50-61` does (`"==> holding back
migration (applied after the BEFORE snapshot)"`). **Do not use `start.sh
--skip-last 1`** — that flag lives on the script §6.0(i) says will not run here.

**Seed first.** Measured on a migrations-only cluster, all four of those views
return **0 rows**, so revision 1's criterion diffed four empty result sets.

Before the before-snapshot, seed the (a) fixture **plus**: one `student_teams`
row per fixture student (`joined_on` set, `left_on` null); and one
`type = 'outreach'`, `counts_volunteer_hours = true` event carrying **one
`completed` session with at least one `present` or `late` attendance mark**.
That last clause is load-bearing — `v_student_hours`
(`20260804000000_volunteer_hours_outreach_only.sql:44-59`) filters on all three
of `es.status = 'completed'`, `e.counts_volunteer_hours and e.type = 'outreach'`,
and `a.status in ('present','late')`, so an outreach event with no completed
session and no marks leaves it at 0 rows and the rule below fails you for the
fixture's sake rather than the migration's. Measured: the recipe without that
clause yields `v_student_hours 0 | v_student_participation 3 |
v_team_participation 1 | v_season_attendance_rate 1`; with it, `1 | 3 | 1 | 1`.

State each view's row count in your report. **A snapshot where any of the four
returns 0 rows on both sides is not a pass — it is an unseeded fixture, and you
must say so rather than record it as green.**

**Load the (a) fixture once.** It touches only `seasons` / `teams` / `students`
/ `events` / `event_sessions` / `attendance`, all of which exist from
`20260717000000`, so it loads cleanly before your migration and needs no
re-seed after it. Seeding it a second time will hit `attendance`'s
`unique (session_id, student_id)`.

On `v_student_hours` specifically: byte-identity is guaranteed *by construction*
for a `create view`-only migration, so treat it as a cheap confirmation that you
did not accidentally touch it, not as an independent behavioural proof. The
property it protects is real and must stay true — meetings contribute **zero**
volunteer hours (`20260804000000_volunteer_hours_outreach_only.sql`).

**(g) A mutation proof, per item 26.** Commit the migration first, then break it
in your own worktree and watch the assertions go red. Run **three** mutations,
and report the real red output and exit code for each:
   - replace the NULL branch with `greatest(denominator, 1)` → proof (b) must
     fail. (Gate verified this is genuinely red: E2 reports `0.0`, not NULL.)
   - drop the `es.status = 'completed'` restriction → proof (a) must fail.
     (Gate verified: E1 reports `83.3`, not `75.0`.)
   - **Reintroduce the fan-out → proof (a2) must fail.** In shape 1, replace
     `count(distinct es.id)` with `count(es.id)`; in shape 2, drop the
     held-sessions CTE and count sessions off the joined row set. Either way
     (a2) must go red. The gate verified this mutation leaves **(a), (b1), (b2)
     and (c) all green** — so if (a2) also stays green, your (a2) assertion is
     not testing what it claims and the whole BLOCKER-1 fix is unguarded.

   Restore, re-run green. **Commit before mutating** (item 26's fast-tier rule,
   which cost T323 its fix).

**(h) Gates.** Run the `gate-run` skill and paste its evidence block verbatim.

## 7. Reporting

Your completion report must state **the commit SHA** your work landed in
(item 21) — "clean" and "committed" are different claims and only the second one
survives. List every file you touched. If you touched anything outside §2, say
so plainly; do not tidy it away.

**Your completion report is returned as text to the orchestrator — do not write
it to a file under `docs/`,** which §2 forbids you.

You do **not** certify your own work. A separate `checker-reviewer` grades this
against §4 and §6.

## 8. Least confident decisions (item 19d) — after round 1

Round 1's five are recorded below with the gate's verdict on each. **Four were
upheld** (one with its justification corrected) and **one was overturned and
re-declared**, which is the list doing its job.

1. **No dispute-log entry and no `gate/human` is required (§5.1).**
   **UPHELD.** The gate checked the actual PRD and dispute-log text: PRD 8.2
   (`:563-567`) defines MET-01…05 at student/team/season grain only, 8.4's
   normative block (`:635-683`) contains three views and none is per-event, and
   the 8.3 matrix row `| events / sessions | full | … |` (`:577`) is unchanged.
   Crucially it found that `boss-arbiter` at `dispute-log.md:1873-1878` states
   *why* its rule is a complete test rather than a sufficient-condition list:
   writing an entry where none is owed *"would falsely enlarge item 3."* SQL may
   be written today.

2. **No filtering by `counts_participation`, student activity, or team scope
   (§5.2).** **OVERTURNED AS DECLARED — the decision stands, the stated doubt
   was the wrong one.** MET-01 rollup consistency is not the live risk;
   `CoachHome.tsx:1168-1173` already ships a deliberately divergent ratio with a
   comment saying so. **Re-declared: the real exposure is unmarked-absence
   inflation (§5.3)** — measured at 100.0% for an event 60% of the roster
   skipped. Wrong if a consumer renders `attendance_pct` without
   `graded_marks_ct`; the mitigation is a column, a view comment, and proof
   (b3), and it cannot be enforced from inside a migration.

3. **A zero-held-session event gets a row rather than being absent (§4).**
   **UPHELD**, and the worry was misplaced: `v_student_participation`'s "no row"
   is the absence of a *student* that exists elsewhere, whereas here the event
   *is* the grain and the card must be able to render "0 held". Measured:
   `held_ct = 0`, `pct NULL`, row count 1.

4. **`revoke all … from anon` belongs in this migration (§4).** **UPHELD, with
   the justification corrected.** T205's DELETE-path rationale does **not**
   transfer — this view is `is_updatable = 'NO'` (measured). The statement stays
   on PRD 8.3's normative text alone, it is not a security finding (item 25:
   *"Item 4 covers tables; do not extend it to views"*), and it does not resolve
   **GAM-389**, which owns the cross-view posture question and is cited in §4.

5. **Widening Allowed Files to three (§2).** **UPHELD.** Both files are new and
   test-only; the skill's own "Leave nothing behind" rule mandates
   `supabase/tests/`, and `run_t509_explicit_marks.sh:8-12` records shipping
   assertions without a runner as T509's own defect.

### 8.1 What is still least confident, going into dispatch

1. **Decision 2's re-declared risk is disclosed, not eliminated.** The view can
   honestly report 100% for a badly-marked event. Nothing in this migration can
   prevent that; only the consuming card can. If the SeriesCard ticket ships a
   bare percentage, D014's condition (`…met01_explicit_marks.sql:107-112`) is
   breached at a new surface and D014 must be revisited. **Flag this in your
   completion report** so the orchestrator carries it into the PR body and, if
   needed, an item-20 follow-up against the consuming ticket.
2. **Two harness defects on `main` are load-bearing for your proofs and are not
   yours to fix**: `run_t205_anon_grant.sh` is red
   (`ERROR: role "service_role" does not exist`, exit 1) and `scratch-postgres`'s
   `start.sh` cannot run as non-root here. Both are worked around in §6.0.
   Report them; do not repair them inside this task's Allowed Files.
3. **`held_ct`'s correctness now rests entirely on criterion (a2) and its
   mutant.** Revision 1 had four criteria that all passed against a view with a
   corrupted `held_ct`. If (a2) is written loosely, the same hole reopens and
   nothing downstream will catch it.
