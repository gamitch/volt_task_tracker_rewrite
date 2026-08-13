Closes GAM-299

A student on two teams never received their second team's events. The page would show them; RLS filtered the rows out before they reached the browser, so the student silently missed those meetings, their live check-in and their sign-up opportunities.

**The premise had never been executed — only read.** The issue said so twice, in its own words, and asked not to be closed on a claim that a measurement was run. It has now been measured, by four agents on four independent PostgreSQL 16 clusters. On today's `main`:

```
 dual   sees event B   | 0        <- the bug
 dual   sees session B | 0
 admin  events total   | 4        <- staff see everything
```

## What changed

One additive migration, `supabase/migrations/20260812000000_events_rls_active_membership_read.sql`, adding a **second permissive `select` policy** on `events` and `event_sessions` scoped by ACTIVE `student_teams` memberships (`left_on is null`).

**Nothing is dropped or rewritten.** The shipped `own_or_linked_read` and `staff_all` policies are byte-for-byte intact, and `20260717000002_rls.sql` is untouched (item 10). Postgres ORs permissive policies, so this change can only ever *add* visibility — no mistake in the new policies can remove a row a student can see today. Same shape, and the same reasoning, as `20260804000001_widen_rsvp_read_all_authenticated.sql:7-14`.

**The migration ships unapplied** (item 16). CI applies it to a disposable scratch cluster; that is not cutover.

## Tier: HEAVY, and why

Item 26 names "RLS/auth/role logic" and "a migration" directly, and item 18's first two triggers both fire, so the worker carried a `model: "opus"` override. The full chain ran: packet → `checker-premise` ×2 → worker → `checker-reviewer` → `boss-arbiter`.

## Three things worth reading before approving

**1. There is a performance regression, and it is accepted rather than absent.** This route *stacks* a subplan on the shipped one rather than replacing it (`Filter: (is_staff() OR (SubPlan 2) OR (SubPlan 4))`). Measured, same cluster, only the policy set changing: **+~40% at 20,004 events, +~9 ms at 500 events**. At the scale this team runs at that is nine milliseconds on an unfiltered `count(*)`, and it buys the structural safety above. (The premise gate measured +57% / +22 ms on slower hardware — direction and cause reproduce, absolute numbers are machine-dependent.)

**2. A re-teamed student keeps seeing their former team's events — and no policy can fix that.** Nothing in the repository writes `student_teams`; the roster's only write path updates `students.team_id` alone. So a student moved from A to B has a backfill row for A still reading `left_on is null`, which any membership test reads as live. `boss-arbiter` measured all three routes:

| re-teamed student | former team | current team |
| -- | -- | -- |
| shipped only (today) | 0 / 0 | 1 / 1 |
| **shipped + additive (this PR)** | **1 / 1** | **1 / 1** |
| memberships-only + bridge (rejected alternative) | **1 / 1** | **0 / 0** |

The alternative grants the former team too **and** denies the student's current team. So this is caused by missing data, not by the route — and on the only configuration the app can actually produce, this PR is strictly better than the alternative on both axes. It is disclosed in the migration header and pinned by six assertions, and **GAM-340 is what ends it. Promoting GAM-340 from `Backlog` to `Todo` is your call — nothing here is blocked on it.**

**3. The suite guard was nearly disarmed, and that is now itself a test.** `tests/rls/run.sh` writes a report that `grep -q FAIL` checks. Using `tee` instead of `tee -a` truncates it, so a real FAIL in the *pre-existing* assertions prints on screen and the script still exits 0 — the premise gate demonstrated this, and every pre-existing RLS-denial case would have become advisory in CI. `tee -a` is mandatory and criterion 10 plants a FAIL to prove it.

## Verification

- `tests/rls/run.sh`: **exit 0, 43 PASS / 0 FAIL.** No CI wiring needed — `.github/workflows/ci.yml:227` already runs this in the `sql` job and it applies every migration.
- All six pre-existing cases PASS at their original expected values; the report block is byte-identical to a merge-base run.
- **Every acceptance criterion replayed in both directions** — green with the change, red under the mutation it names — by the worker and independently by `checker-reviewer`, plus the new re-teamed cases by me (`1 → 0`, suite exit 1).
- Gates: **5 of 6 PASS** — tsc, vite build, format:check, eslint (0 errors), full vitest (2437 tests). Scoped vitest is **SKIPPED**, not passed: this PR ships no `src/` code, so no scope is derivable.
- All measurements are scratch-cluster results. **The hosted Supabase project is unreachable from here**, so this does not claim to have verified production's grant posture — though `StudentHome` already reads `student_teams` from the browser as `authenticated`, so that grant must exist.

## Records

- **D019** (`docs/swarm/dispute-log.md`) — `checker-reviewer` disputed the packet's item-3 authority; the arbiter ruled no exemption entry and no human gate are required, and corrected the packet's own account of the route. **D019 authorises nothing and exempts nothing.**
- **GAM-340** — the `student_teams` writer, then dropping the legacy policies (item 20). Also records that GAM-299's text names T705/GAM-298 as the open row for this, while GAM-298 reads `Done` and the writer does not exist.
- **GAM-341** — the `my_student_ids()` test is an equivalent mutation today and becomes the sole guard if `students`' read policy is ever widened.
- Full run log: `docs/swarm/active/GAM-299-run-log.md`. Packet and both gate verdicts: `docs/swarm/active/GAM-299-packet.md`.

Ignore GAM-340 Ignore GAM-341

Linear-Issue: GAM-299 (T806)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
