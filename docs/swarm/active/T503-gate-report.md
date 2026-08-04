# T503 premise-gate report — round 1

**Verdict: REVISE** (one MAJOR, three MINOR, two NIT — no BLOCKER; the §3 premise held under execution).

Gate: checker-premise, worktree `claude/t503-gate` @ `debf8c5` (packet commit), base `main` @ `7fe4e56`.
All database findings below were **measured by execution** on a scratch PostgreSQL 16.13 cluster
(initdb'd fresh, port 55432, loopback TCP), with this repo's migrations applied byte-unchanged in
filename order via the shipped T205 harness pattern (`calendar_feed_platform_stub.sql` + the stock
default-privileges simulation + every migration except `20260719000000_cron.sql`).

---

## §3 — THE QUESTION, settled by execution: Claim B is TRUE, Claim A is FALSE. The packet stands.

Fixture: 2 non-staff students (One/Two) on one team, one hours-counting outreach event, 3 future
`scheduled` sessions (2h/3h/1h), 3 `going` rsvps (One→S1; Two→S1, S2).

**Shipped state (before any policy change), as `authenticated` with `request.jwt.claim.sub` = Student
One's profile id:**

Direct table read — RLS works, 1 row (own only):

```
                  id                  |              session_id              |              student_id              | status
--------------------------------------+--------------------------------------+--------------------------------------+--------
 10000000-0000-4000-8000-100000000051 | 10000000-0000-4000-8000-100000000041 | 10000000-0000-4000-8000-100000000021 | going
(1 row)
```

`v_planned_rsvp_hours`, same session, same instant — **all 3 rows, teammate's included**:

```
              student_id              |              season_id               |       starts_at        |   planned_hours
--------------------------------------+--------------------------------------+------------------------+--------------------
 10000000-0000-4000-8000-100000000021 | 10000000-0000-4000-8000-100000000001 | 2026-08-10 14:00:00+00 | 2.0000000000000000
 10000000-0000-4000-8000-100000000022 | 10000000-0000-4000-8000-100000000001 | 2026-08-10 14:00:00+00 | 2.0000000000000000
 10000000-0000-4000-8000-100000000022 | 10000000-0000-4000-8000-100000000001 | 2026-08-11 14:00:00+00 | 3.0000000000000000
(3 rows)
```

`v_student_planned_hours` → (One 2.0, Two 5.0); `v_season_upcoming_committed_hours` → 7.0. The
views **never applied the querying user's RLS**. Counterfactual, run both directions:
`alter view v_planned_rsvp_hours set (security_invoker = on)` collapses the same query to **1 row**;
`reset (security_invoker)` restores **3**. `pg_class.reloptions` is empty for all three planned-hours
views — no `security_invoker` anywhere in the schema.

**After widening** (`create policy read_all_authenticated on rsvps for select to authenticated using
(true)` — the packet §4.1's additive second-policy shape, which Postgres ORs with the shipped
`own_or_linked_read`):

- Direct read as Student One: **3 rows** (the intended fix).
- `v_planned_rsvp_hours` / `v_student_planned_hours` / `v_season_upcoming_committed_hours`:
  **byte-identical output to the before run** (3 rows / 2 rows / 7.0). Widening `rsvps` RLS changes
  **no view output at all**.

**Verdict on the two migration comments:**
- `20260723000001_dashboard_views.sql:50-56` ("each runs under the querying session's own RLS") —
  **FALSE**, proven by execution. Note the repo record had already found this twice: constitution
  item 25's rationale (T176's checker) and `20260731000000_leaderboard_students_view.sql:50-53`,
  which names that exact sentence as "the one … found to be false".
- `20260803000001:25` / `20260731000000:33-46` ("no `security_invoker`, so it executes as its OWNER,
  which bypasses RLS") — **TRUE**, proven by execution and by the `security_invoker` counterfactual.

**Hosted-Supabase generalisation — the local result carries.** Local mechanism disclosure: the
migration-applying role here is `gate_super` (`rolsuper=t`, `rolbypassrls=t`). To close the gap T205's
migration comment names, the probe re-ran with `rsvps`/`events`/`event_sessions`/`v_planned_rsvp_hours`
reassigned to `sim_supabase_admin` — **nologin, NOSUPERUSER, NOBYPASSRLS**, `relforcerowsecurity=f` —
i.e. *strictly weaker* than hosted Supabase's `postgres` (which is table owner AND carries BYPASSRLS).
Result, shipped RLS restored: direct read 1 row, view **still 3 rows**. A table owner bypasses its own
tables' RLS unless FORCE ROW LEVEL SECURITY is set, and nothing in this schema sets it. Since the
bypass holds even without BYPASSRLS, it holds a fortiori on hosted Supabase. The one configuration that
would flip the answer — `security_invoker=on` views — appears zero times in `supabase/`.

**anon gets nothing, before and after — measured, not structural.** `anon` holds a table-level SELECT
grant on `rsvps` in the stock-privileges simulation (`information_schema.role_table_grants`: anon /
SELECT), exactly as hosted Supabase's defaults would give it — and still read **0 rows** in both
states, because no `rsvps` policy names it. The widened policy is `to authenticated`; `anon` is not a
member. This also means packet C3 is a genuine, mutation-sensitive criterion: re-pointing the policy
`to public` would leak real rows to anon in the harness.

**Write paths after widening — measured:**
- Student One INSERT of an rsvp for Student Two → **denied, SQLSTATE 42501** (`own_or_linked_write`'s
  `with check` holds).
- Student One UPDATE of Student Two's row → **`UPDATE 0`** — no error; the row is now *visible* via
  the widened SELECT but `own_or_linked_update`'s USING excludes it from the update set. Row
  re-checked unchanged (`going`).
- Control: Student One's own INSERT still succeeds.

**`my_student_ids()` — not dead, report only.** `pg_policies` survey: 10 policies reference it —
`rsvps` read/write/update, `students`/`events`/`event_sessions`/`attendance` `own_or_linked_read`,
`guardian_links.own_read`, and T128's `attendance` `self_insert`/`self_delete`. Under the additive
second-policy shape, `rsvps.own_or_linked_read` remains in place (redundant on the read path, since
`using (true)` subsumes it — harmless; permissive policies OR). The helper stays load-bearing
everywhere else. Do not delete anything.

**C4 IS mutation-testable — the packet's fear is resolved, affirmatively.** Injecting
`alter view v_planned_rsvp_hours set (security_invoker = on)` before the widening makes C4's
before/after comparison go red: measured **1 row before, 3 rows after** for the same non-staff
session. C4's mutation column should name that mutation instead of "—".

---

## Findings

### [F1] MAJOR — the packet ignores the PRD 8.3 / constitution item 3 collision its own authority entry declared blocking
PRD 8.3's matrix row (`VOLT_Portal_PRD.md:578`) is `rsvps | full | read/write own | read linked…`, and
constitution item 3 says RLS policies come **only** from PRD 8.4 verbatim, re-deriving → **BLOCKER**.
The packet's own cited authority — `auto-mode-decisions.md:2210-2218` (2026-08-03 T503 entry) — says
this widening "needs either a PRD amendment or an explicitly recorded, owner-authorised deviation".
The packet never mentions PRD 8.3, item 3, or the deviation record. As written, a worker ships a
policy that exists nowhere in 8.4 and a checker applying item 3 literally must fail it — a predictable
worker/checker collision on a HEAVY task.
**Prescribed edit:** add to §2 and §4.1: *"This policy is an owner-authorised deviation from PRD 8.3's
`rsvps` row ('read/write own' / 'read linked'), per the D002 precedent (PRD text intentionally
unedited; the deviation record is the authority). The migration header and the worker output must cite
both decision entries ('2026-08-03 — George's ruling on T503' and '2026-08-04 — George picks the SCOPE
for T503') as that record. Checkers: item 3 is satisfied by that owner authority, not by 8.4
verbatim-copy, for this one policy. The shipped `own_or_linked_read` (8.4's verbatim shape) stays in
place; the widening is an additional permissive policy."* No PRD edit is authorised by either entry —
do not amend `VOLT_Portal_PRD.md`.

### [F2] MINOR — §4.2's test recipe will mis-assert the UPDATE denial and cannot express "before/after" without a loop split
(a) The T205 assertion shape catches `insufficient_privilege`; a cross-student UPDATE under the
widened policy raises nothing — it returns **`UPDATE 0`** (measured). The test must assert 0 rows
affected + row unchanged, not an exception. The INSERT half does raise 42501.
(b) "Views return the same rows before and after" requires the runner to apply migrations **up to but
excluding** the new one, snapshot the three views as the non-staff role, apply the new migration, and
re-snapshot — `run_t205_anon_grant.sh`'s single apply-all loop cannot express "before"; prescribe the
loop split explicitly.
(c) C4's mutation exists: `security_invoker=on` on `v_planned_rsvp_hours` (see above). Name it.

### [F3] MINOR — §4.3 / §7.5 blast radius is understated by one loader (payload, not display)
`queryRsvpsForSessions` (`loaders/outreach.ts:784-792`) is confirmed unfiltered as claimed — but it
backs **both** `makeLoadOutreachDetail` (`:1129`) *and* `makeLoadOutreachData` (`:1034`, OutreachList),
plus T118's staff reconciliation path (`:1570`). After widening, a non-staff OutreachList session also
receives every row. Its student view does not currently render other students' rsvps
(`computeStudentHours` filters by own id; the Expected/Attended tiles are coach-row cells), so no
display bug — but the §7.5 owner note should say OutreachList's responses change too, not just the
Signups buckets. The other direct `rsvps` readers are unaffected and the packet's "nothing else
changes" holds for them: `meetings.ts:371-373` (coach-only loader), `reports.ts:427-437,636-645`
(role-gated Reports), `dashboard.ts:523-532` (CoachHome), `parentHome.ts:381-391` (explicit
`.eq('student_id')` defence-in-depth — output unchanged by design).

### [F4] MINOR — settle §4.1's open shape choice: additive second policy
The gate measured the additive shape end-to-end (all §5 criteria hold under it). Prescribe it:
(1) it leaves 8.4's verbatim `own_or_linked_read` untouched, softening F1; (2) `create policy` is
purely additive (item 10's spirit); (3) C5 trivially holds. Dropping/recreating `own_or_linked_read`
buys nothing and deletes a PRD-verbatim object.

### [F5] NIT — citation spans
`20260723000001:71-77` → the view body runs `:71-80` (the range omits the join/where);
`20260724000001:64-70` → runs `:64-74`. Both under-span the exact clauses that matter (`status`
filters, `starts_at >= now()`).

### [F6] NIT — §3 presents as open a question the repo had already answered twice
Constitution item 25's rationale and `20260731000000_leaderboard_students_view.sql:50-53` both already
name the dashboard_views sentence as the false one. Demanding fresh execution was still right for a
HEAVY RLS task; the packet should cite the prior record so the worker knows the finding it must file
(§7.4) is a *third* confirmation, and that the false comment cannot be fixed in place (item 10) —
the correction lives in the new migration's header, as `20260731000000` itself modelled.

---

## Claim-by-claim verdicts (packet §1, §2, §5, §6, baseline)

- §1 `rsvps` RLS = `staff_all` + `own_or_linked_read` (`rls.sql:197-203`) — **CONFIRMED** (read + measured).
- §1 `groupSessionSignups` roster-diff (`OutreachDetail.tsx:1165-1190`, `noResponse` at `:1181-1183`) — **CONFIRMED**.
- §1 `<SessionSignupList>` ungated (`:2310`, inside the sessions map; contrast the `isStaffViewer &&` gate at `:2329`) — **CONFIRMED**.
- §1 T306 attendance staff-gate (`OutreachDetail.tsx:1925`, `if (!isStaffViewer) return undefined`) — **CONFIRMED**.
- §2 boundary list vs both decision entries (`auto-mode-decisions.md:2198-2227`, `:2844-2876`) — **CONFIRMED faithful**: no write change, no attendance change, no anon, no hosted cutover, `responded_by` disclosure all trace to the entries.
- §2/§5 "criteria would catch a worker widening writes" — **CONFIRMED**: C2 (measured red-able: a `with check (true)` insert policy flips [2f]) and C5 both trip.
- §4.3 `queryRsvpsForSessions` unfiltered (`outreach.ts:784-792`) — **CONFIRMED**; packet's `:789-791` points inside the function.
- §5 C5 sha256 precedent — **CONFIRMED for T309** (ledger row: "verified byte-identical by sha256 at both revisions"); T406 not independently pinned, immaterial.
- Baseline at `7fe4e56`: `tsc` 0 — **CONFIRMED** (exit 0). eslint 0 errors / 364 warnings — **CONFIRMED**. vitest 78 files / 1976 tests — **CONFIRMED** (78 passed files, 1976 passed tests).
- `my_student_ids()` load-bearing for writes (`rls.sql:20-26`, `:205-212`) — **CONFIRMED** (pg_policies survey above).

## Feasibility verdicts (packet §4)
- 4.1 additive migration, either policy shape — **possible as specified** (additive shape measured end-to-end).
- 4.2 test script mirroring `run_t205_anon_grant.sh` — **possible with the F2 corrections** (UPDATE-0 assertion; loop split for before/after).
- 4.3 zero app-code change — **possible and correct** (F3's payload caveat noted for the owner note only).
- §5 C1–C6 — all measurable with today's harness; C4's mutation named in F2(c).

## Conflicts with shipped work
None found. T205's revokes untouched (this migration touches `rsvps`, not `v_leaderboard_students`).
T306's staff gate untouched. No green test asserts rsvp-read narrowness (searched; the
`groupSessionSignups` tests are pure-function tests over fixture arrays — they pass identically after
widening, since the function is fed whatever rows the loader returns).

## Scratch-cluster status
Shut down and deleted after the run (`pg_ctl stop`, data dir removed). Probe SQL retained at
`<scratchpad>/t503-pg/*.sql`. Worktree left with this report as its only change.
