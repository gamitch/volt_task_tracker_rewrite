# T322 — worker packet

**Row:** T322 (W4 block) · **Tier: HEAVY, unconditional** · **Branch:**
`claude/t322-meeting-hours-not-volunteer-hours` off `origin/main` (`f5c730a`)

## Tier — not a judgement call

Constitution item 18 trigger 1 fires on anything that *"creates or edits a file under
`supabase/migrations/`"* (`constitution.md:75`), **and** on *"creates or modifies a SQL view
containing metric math (PRD 8.4 territory)"*. Item 26 lists metric-view SQL among its required HEAVY
triggers. `WORKFLOWS.md` puts the whole W4 workflow at HEAVY because *"a mistake lies to a user about
their own data"*. **A small diff does not lower this.**

## The rulings — cite the file, never a paraphrase

Three, all in `auto-mode-decisions.md`:

1. **2026-08-02** — meeting hours must not count toward volunteer hours.
2. **2026-08-03** — competition hours must not either. *"Volunteer hours = `type = 'outreach'`
   ONLY."*
3. **2026-08-04** — *"fix both"*: the fix extends to `v_student_hours`, not just the staff KPI card.

**The rule is by event `type`, never by event name. This has confused two reviewers and the
orchestrator once.** `GG FLL Team Meetings` and `P3 FLL Team Meetings` are `type = 'outreach'` and
**DO count**, despite "Meetings" in their titles — the students are *student coaches* running those
sessions for the community. They are **72 of 117 sessions, 62% of the migrated data**. Filtering by
`type` keeps them; filtering by title would destroy the majority of the team's volunteer hours.

**NOT AUTHORIZED:** retyping any event, or touching the FLL events.

## The defect — corrected from the ledger row, which is misleading

The T322 row says `total_hours` sums *"across all types including `meeting`"*. **Incomplete.** The
CTE feeding it already filters `and e.counts_volunteer_hours`, and meetings are created with that
flag `false` and fixed (`meetings.ts:690`). **Meeting hours do not reach the total today.** Do not go
looking for that leak.

**The real defect: the total is governed by an editable per-event boolean instead of by `type`.**

| Type | `counts_volunteer_hours` | Today |
|---|---|---|
| `outreach` | `true`, fixed | correct |
| `meeting` | `false`, fixed | already excluded |
| `competition` | **admin-editable, defaults `false`** | **one toggle from counting** |

Competition is the live gap. An admin flips that toggle and competition hours enter the
volunteer-hours total and the goal percentage, against the 2026-08-03 ruling.

## Prescription

Both views live in **applied** migrations. **Constitution item 10 makes editing an applied migration
a BLOCKER.** Write **one new additive migration** that `create or replace`s both views.

**1. `v_student_hours`** (currently `metric_views.sql:3-19`) — add a type filter to its join:

```sql
join events e on e.id = es.event_id and e.counts_volunteer_hours and e.type = 'outreach'
```

Keep the existing flag condition. It is a separate, pre-existing mechanism; removing it is a wider
behavioural change than the rulings authorize.

**2. `v_season_kpis`** (currently `kpi_views.sql`) — **do NOT filter the `hours_by_type` CTE.**
Filtering there would zero out `meeting_hours` and `competition_hours`, and the 2026-08-03 ruling
says those *"are still tracked and still displayed as their own figure"*. Instead change
`season_hours.total_hours` from an all-type sum to the outreach-only one:

```sql
sum(type_hours) filter (where type = 'outreach') as total_hours
```

The three breakdown columns at `:181-183` stay exactly as they are.

**Check `goal_pct` yourself.** It is computed inside the same view and consumed at
`KpiStrip.tsx:302`. If it derives from `total_hours` it inherits the fix automatically; if it
recomputes independently, **it needs the same change and the packet author missed it — say so.**

**3. `src/components/kpi/KpiStrip.tsx`** — the 2026-08-02 ruling also authorizes *"label the card so
it reads as volunteer hours rather than all hours."* `label="Season hours"` is at `:286`. Make it say
volunteer hours. Follow PRD DES-14…16 for copy (sentence case). **Do not restructure the card** —
`formatHoursBreakdown` (`:371-377`) and the `Meetings · Outreach · Competitions` line stay.

## Allowed files — nothing else

```
supabase/migrations/<new timestamp>_volunteer_hours_outreach_only.sql   (NEW)
src/components/kpi/KpiStrip.tsx                                        (label only)
src/components/kpi/KpiStrip.test.tsx                                   (coverage)
supabase/tests/<new>                                                   (SQL proof, see below)
```

**Forbidden:** editing `20260717000003_metric_views.sql` or `20260723000000_kpi_views.sql` (item 10).
`loaders/kpi.ts` should need no change — the view's column names do not change; **if you think it
does, stop and report rather than editing it.** Nothing under `src/pages/outreach/**` (W2's),
`src/pages/checkin/**` (W1's), or `loaders/students.ts` (W7's).

## SQL proof — follow the pattern that is known to run here

`tests/rls/run.sh` is rotted and does not run on bare Postgres (filed as **T701**). Use the **proven
T195 pattern** instead: `supabase/tests/run_calendar_feed_lifecycle.sh` +
`calendar_feed_platform_stub.sql`, which skips `20260719000000_cron.sql` by name (`:29-31`) and stubs
the roles/schemas bare Postgres lacks. That suite was measured green in this container.

Seed fixtures for **all three types**, with attendance on completed sessions, and assert:

1. An `outreach` event's hours **count** toward `v_student_hours.confirmed_hours` and
   `v_season_kpis.total_hours`.
2. A `competition` event **with `counts_volunteer_hours = true`** contributes **zero** to both.
   *(This is the live gap — seed the flag ON deliberately.)*
3. A `meeting` event contributes zero to both.
4. `v_season_kpis.competition_hours` and `meeting_hours` are **still populated** — the breakdown
   survives.
5. An event titled like `GG FLL Team Meetings` but typed `outreach` **counts in full**.

## Acceptance criteria — each names a mutation that turns it red

| # | Criterion | Mutation that must turn it RED |
|---|---|---|
| 1 | Competition hours are out of the volunteer total | Revert `total_hours` to `sum(type_hours)` → assertion 2 must FAIL on `v_season_kpis` |
| 2 | Competition hours are out of a student's own hours | Drop `and e.type = 'outreach'` from `v_student_hours` → assertion 2 must FAIL on `confirmed_hours` |
| 3 | The breakdown survives | Filter the `hours_by_type` CTE by type instead → assertion 4 must FAIL (`competition_hours` goes null/0) |
| 4 | Title-based filtering is not what happened | Assertion 5 — change the fix to filter on title/name and it must FAIL |
| 5 | The card says volunteer hours | Revert the label → a `KpiStrip.test.tsx` assertion must FAIL |

Criterion 4 is the guard against the exact mistake that has now confused three people.
**A criterion whose mutation leaves the suite green is not evidence — report that instead of
shipping it.**

## Six gates, `.env.local` ABSENT — assert exit codes, not just counts

```
npx tsc --noEmit ; echo $?
npx vite build ; echo $?
npm run format:check ; echo $?
npx eslint . ; echo $?
npx vitest run ; echo $?
bash supabase/tests/<your new runner>.sh ; echo $?
bash supabase/tests/run_calendar_feed_lifecycle.sh ; echo $?   # cross-suite regression
```

Measure your own branch-point numbers and report them — `main` moves hourly with three other
machines merging. Do not inherit a figure from this packet.

## Environment

Postgres 16.13; `pg_ctlcluster 16 main start` if down. Roles `anon`/`authenticated`/`service_role`
and a superuser `root` login already exist cluster-wide. `pg_net` is Supabase-only and not
installable — your runner must skip `20260719000000_cron.sql` by name.

## Rules

Item 22 — named pathspecs only, never `git add -A`. Item 23 — your own worktree, **commit before
mutating**. Item 21 — report the commit SHA; the orchestrator verifies HEAD moved and the change is
in the committed blob. You do **not** self-certify. If the packet is wrong, contradictory, or
impossible, **say so** rather than quietly picking a side.
