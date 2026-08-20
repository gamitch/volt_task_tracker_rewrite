Closes GAM-389

**DO NOT MERGE. This PR ships no fix, and it is being closed rather than
merged** — the line above is required verbatim by the `Linear declaration`
check (rule 3: the branch identifier and line 1 must match exactly), and
merging it would close a row that now needs the owner's decision. The work
product is the measurement, and it lives on this branch either way.

## What changed

No source change, deliberately. Four documents under `docs/swarm/active/`:
the HEAVY packet, the premise-gate outcome, a decision memo, and the run log.

## What the issue got wrong

GAM-389's measured facts all hold. Its conclusion does not.

The issue's position is that six sibling views hold two contradictory postures
and "one of the two is unintended." Measured: **neither is.** The distinction is
principled, was drawn knowingly, and is on the record.

1. **The five expose no names** — `student_id`, `season_id` and figures. The one
   view that carries `display_name` is `v_leaderboard_students`, the one already
   revoked. This was the issue's own declared open question ("Enumerate that
   before deciding, because it may change the answer"). It changed the answer.
2. **The owner's 2026-07-31 ruling explicitly excluded the nameless views.**
   `auto-mode-decisions.md:1297-1316`: the leaderboard was "the first view in
   this schema to expose `display_name` that way (**the pre-existing
   `v_student_hours` was already `anon`-readable; not new**)". The same
   paragraph warns that extending the disposition "without asking would have
   repeated exactly the kind of scope-creep-by-analogy this project's process
   has flagged before." *What this authorizes* names one statement on one view.
3. **`v_event_student_hours` is not a per-student view** — it groups by event
   (`20260723000001_dashboard_views.sql:269-291`).
4. **The `DELETE` hazard that made the leaderboard revoke urgent does not exist
   here.** All five measure `is_updatable = NO`; the leaderboard is the only
   `YES` among 16 public views. A granted `DELETE` on `v_student_hours` raises
   `SQLSTATE 55000`.
5. **The `anon` grant is not ours.** Without Supabase's stock default
   privileges, no migration in this repo grants `anon` anything on any of the
   six. The exposure is inherited from the platform.

## What the packet got wrong, and who caught it

**I wrote the error and the gate caught it.** My packet argued that revoking the
five merely *extends* the owner's ruling and so needs no new authority. That is
the opposite of what the ruling says. `checker-premise` graded it MAJOR; I then
read `auto-mode-decisions.md:1297-1316` myself rather than taking the subagent's
word for it, and upheld the finding. The wrong section is left in the packet
unedited, with the outcome appended — deleting it would delete the evidence.

Had this shipped, its required migration comment would have written a false
account of an owner ruling into a permanent applied migration. That is the same
defect class as `20260723000001:49-52`, which needed a whole migration
(`20260805000000`) to correct.

The gate settled the packet's other four least-confident decisions **in its
favour** by measurement, so if the owner picks the revoke, the prescription is
measured-correct as written — only its rationale was wrong.

## Tier, stated and defended

**HEAVY** (item 26), judged before the `In Progress` move per item 28d. Trigger
is mechanism, not severity: a `supabase/migrations/` file changing grants on
RLS-bypassing views. Item 18 pins the worker to opus for the same two triggers.

The losing argument was item 25 — volunteer team, no PII, and the issue itself
declines to claim exposure. Correct about severity, and it is why this is not
urgent. But item 25 lowers the security threat model, not the process tier, and
says correctness is unaffected by it. **The tier paid for itself**: HEAVY is the
only tier that puts a premise gate in front of a worker, and the gate is the
reason a false account of an owner ruling did not reach the database.

## Verification

`gate-run`'s six gates are not reported here because **no source file changed** —
reporting them would be a vacuous green, which the premise gate flagged as a
defect in my own acceptance criteria. What was actually run, by the gate, on
PostgreSQL 16.14:

| Measurement | Result |
|---|---|
| All 24 applicable migrations load in filename order | clean (`pg_cron` skipped, as every in-repo runner does) |
| `is_updatable`, all 16 public views | five = `NO`, `v_leaderboard_students` = `YES` |
| `delete from v_student_hours` as `authenticated` with DELETE granted | `SQLSTATE 55000` — grant is unusable |
| Baseline grants without platform defaults | 0 rows for `anon` on all six |
| Proposed migration applied | `anon` loses all on six; `authenticated` keeps `SELECT` on five |
| Mutation: one `revoke` line removed | `v_student_participation anon_select=true` — assertion is sensitive |
| `t205_anon_grant_assertions.sql` | 6/6 pass |
| `t700_updatable_view_guard_assertions.sql` | A1/A2/A3 pass, non-vacuity guard survives |

The live hosted project was **not** re-measured. Item 16 reserves it to the
owner, so the issue's 200→401 table stands unre-run and is not claimed otherwise.

## Scope

GAM-389 stays in `Todo` and gains `gate/human`. It is not `In Review`: no agent
should mark this finished, because what remains is a decision only the owner can
make, and its acceptance criterion 1 ("all six agree") is itself built on the
premise that was falsified.

The two options, costed, are in `docs/swarm/active/GAM-389-decision-memo.md`.
Option 2 (revoke the five) is measured to work and is a few minutes' work if he
picks it.

## Follow-ups filed

- **GAM-427** (`Backlog`, `tier/unreviewed`) — no CI assertion guards the `anon`
  grant posture on the five views, and `t700`'s guard cannot cover them because
  it only fires on auto-updatable views. Whichever posture the owner picks will
  be unenforced without it.

## Known gaps, disclosed

- The live project was not measured; only a scratch cluster and source.
- A scratch cluster has no `anon`/`authenticated` roles and no Supabase default
  privileges. The gate created both to measure, and said so. That the five are
  `anon`-readable in production rests on hosted Supabase carrying its stock
  defaults — consistent with the issue's live measurement, but reproduced rather
  than independently re-proved.
- `.claude/skills/scratch-postgres/scripts/start.sh` needs root and fails on
  this runner (`chown: Operation not permitted`). Recorded in GAM-427.

Linear-Issue: GAM-389
