# GAM-340 — worker packet (Part 1: the `student_teams` writer)

**Tier:** HEAVY (item 26 — write path, destructive close, metric-view input,
RLS input once GAM-299's migration is applied).
**Worker model:** `opus` (item 18 — the rows written are role/permission scope input).
**Branch:** `claude/gam-340-student-teams-writer`. Base `9d84bed`.

## Scope

Give `student_teams` a writer on both roster write paths. **Application code
only — no migration, no schema change, no RLS change.**

**Explicitly OUT of scope**, on the issue's own constraint (*"Do not drop the
legacy policies in the same change as the writer"*):

- dropping the two legacy `own_or_linked_read` policies (`20260717000002_rls.sql:153-161, 180-189`)
- seeding `tests/rls/seed.sql`
- repairing **either** of the two already-broken populations. A code change
  cannot retroactively fix existing rows; both are owner calls, filed as their
  own rows.

### The two already-broken populations — name both, fix neither (round 2)

Round 1's gate caught that this packet had named only the first. They are
different shapes and only one of them was ever disclosed on the issue:

1. **Missing-membership** — students created through the roster since
   2026-07-21. No `student_teams` row at all, so `v_student_participation`
   returns **zero rows** for them.
2. **Stale-active-membership** — students *re-teamed* since the backfill. They
   carry an ACTIVE row for the team they **left** and none for their current
   team. Documented in a shipped migration's own header
   (`20260812000000_events_rls_active_membership_read.sql:91-112`) and fixtured
   deliberately at `tests/rls/gam299_seed.sql:129-135` (student `…d4`, whose
   comment says *"Do not 'fix' this fixture… the absence and the null ARE the
   fixture, and GAM-340 is what makes them impossible"*).

**Population 2 is corrupting `v_student_participation` today** — it needs no
GAM-299 migration to be applied, because the metric view has joined
`student_teams` since 2026-08-06. Their participation is attributed to the wrong
team.

**What this packet's writer does and does not do to population 2.** Step 2.4
opens a membership for their *current* team, which gives them a correct
participation row. It does **not** close the stale one. For these students the
roster team is unchanged by an ordinary edit, so step 3 does not run at all; and
even when it does, the close targets the *previous* `students.team_id`, for which
**no `student_teams` row exists** (that is the shape of population 2 — a row for
the team they left, none for the team they are on). The stale row therefore
**survives, and from the application it is indistinguishable from a legitimate
dual membership** (Trap B). Net effect: such a student gains a correct row *and*
keeps an incorrect one, where before they had only the incorrect one. That is an
improvement, not a repair, and it is deliberate — see LCD #1.

Both populations are being filed as separate rows before this one closes
(item 20). Do not attempt either repair here.

## Allowed Files

- `src/lib/supabase/loaders/students.ts`
- `src/lib/supabase/loaders/students.test.ts`
- `src/pages/roster/StudentsTab.test.tsx` — **test file only, added in round 2.
  `StudentsTab.tsx` source stays out.**

Nothing else. **Checked at packet time: no `.github/workflows/**` path is in
this list** (AGENTS.md "Two walls", wall 1). No file under `supabase/`,
`docs/swarm/`, or `.claude/`.

**Why the third file is here, and exactly what you may do to it.** Round 1's
gate implemented this packet's prescription verbatim and ran the suite: the two
currently-green tests in `StudentsTab.test.tsx:1014-1103`
(`describe('createStudent / updateStudent (T089 real mutation, module doc #14)')`)
fail with `TypeError: client.from(...).upsert is not a function` and
`client.from(...).select is not a function`. Their fake clients are
**table-agnostic** — `vi.fn(() => ({ insert: insertSpy }))` at :1031 and
`vi.fn(() => ({ update: updateSpy }))` at :1079 — so they answer the same shape
for every table. Any correct implementation of this packet breaks them.

**There are two distinct breakages, and round 2's gate proved that fixing only
the obvious one leaves the suite red.** Do not stop at table dispatch:

1. **`createStudent`** — a *second* `from()` call, on `student_teams`, needing
   `.upsert()`. Table dispatch alone fixes this one.
2. **`updateStudent`** — a *new entry point on `students` itself*:
   `.select('team_id').eq('id', id).single()`, the previous-team read-back. The
   existing `students` fake is `vi.fn(() => ({ update: updateSpy }))` and has no
   `select` branch at all, so **`students` keeping "its existing chain" is
   precisely what breaks.** Round 2's gate applied the round-1 wording of this
   paragraph literally and measured
   `TypeError: client.from(...).select is not a function` at `students.ts:336`
   — 1 failed | 3 passed. The remedy is to add `select` to the **`students`**
   branch and make `selectSpy`/`eqSpy` mutually recursive so both the update
   chain and the read-back chain resolve; that yields 34/34.

**The table-aware precedent already exists in this same file** —
`StudentsTab.test.tsx:919`, `vi.fn((table: string) => ({ select: selectSpies[table] }))`.
Follow it.

**You are authorized to amend those two tests, and only them.** **Every existing
assertion in them — the `insertSpy`/`updateSpy`/`eqSpy` argument expectations and
the mapped return value — must survive unchanged.** Adding a branch or a spy to a
fake client is not weakening an assertion; deleting, loosening or skipping one
is. If you find yourself doing the latter, stop: that is a signal the
implementation is wrong, not the test.

## Measured premise (orchestrator, 2026-08-14, against branch base `9d84bed`)

Re-measured rather than taken from the issue (item 30c). All four hold:

1. **No writer exists.** The only application access to `student_teams` is a
   read: `students.ts:486` `.from('student_teams').select('team_id')`. Repo-wide
   grep for `student_teams` across `src/`, `supabase/functions/`, `scripts/` and
   every migration returns no `insert`/`upsert`/`update`/`delete` outside
   the one-time backfill at `20260721000000_student_teams.sql:37` and test
   seed/fixture SQL (`tests/`, `supabase/tests/`), which are not application code.
2. **`makeCreateStudent` (`students.ts:274-295`)** inserts `display_name`,
   `team_id`, `grad_year`, `is_active`, `goal_hours_override` into `students`.
   No membership row.
3. **`makeUpdateStudent` (`students.ts:302-324`)** updates the same five columns
   on `students` by id. No membership row opened or closed.
4. **The join is INNER.** `20260806000000_met01_explicit_marks.sql:109` —
   `join student_teams st on st.student_id = s.id and st.left_on is null`.
   `st.team_id` is *also* used at **:114** in the `e.team_ids` predicate, so a
   membership row is not merely a filter, it supplies the team the event
   predicate matches on. (Round 1 gate correction: this packet first cited
   :113, which is `and e.counts_participation`.)

**Independently re-measured by round 1's premise gate on a scratch PostgreSQL
16.14 cluster carrying all 25 migrations**, executing the counterfactual rather
than reading it: membership-less student `vp_rows = 0`, student with membership
`vp_rows = 1`, everything else identical. The premise holds.

## Two traps the issue text does not carry — read these before designing

**Trap A — the primary key makes a naive insert wrong.**
`student_teams`' PK is `(student_id, team_id)`
(`20260721000000_student_teams.sql:19-26`), and that migration states the
intended semantics verbatim: *"re-joining a team after leaving is a future
UPDATE of `left_on` back to null, not a new row."* So a student who leaves team
A, joins B, then returns to A must **reactivate** the existing `(student, A)`
row. A plain `insert` raises a unique violation and the roster edit fails.
Use an upsert on `(student_id, team_id)` that sets `left_on = null`.

**Trap B — do not close memberships you were not asked to close.**
The schema is deliberately multi-team; `students.team_id` is the *legacy
primary* column only. A student may hold two legitimate ACTIVE memberships
(`StudentHome.tsx:274`, `parentHome.ts` and their tests all exercise the
dual-membership case, and the issue itself notes dual-team students receive both
teams' events).

The roster edit form carries **one** `teamId`. Therefore a writer that closes
*every* active membership whose `team_id` differs from the new one **silently
deletes a dual-team student's second team** — turning a participation-gap fix
into a participation-loss bug, in exactly the population the schema exists for.

**Required behaviour:** close *only* the membership matching the student's
**previous** `students.team_id`, and only when the team actually changed.

## Prescription

### 1. `makeCreateStudent` — open a membership

After the existing `students` insert resolves (it already does
`.select().single()`, so the new id is in hand), write the membership for
`payload.teamId`.

- Upsert on conflict target `student_id,team_id`, setting `left_on: null`.
- Keep the existing return value: the mapped `StudentRow` from the `students`
  insert. Do not change `CreateStudentFn`'s signature.

### 2. `makeUpdateStudent` — move the membership

The current signature `(id, payload)` does **not** carry the previous team, so
the writer must resolve it.

1. Read the student's current `students.team_id` **before** the update.
2. Perform the existing `students` update unchanged.
3. If `previousTeamId !== payload.teamId`:
   - close exactly the old one — set `left_on` to the value pinned below,
     filtered by `student_id = id` **and** `team_id = previousTeamId` **and**
     `left_on is null`. **Filter positively on the team id. Never use `.neq()`
     here** — see acceptance criterion 3.
   - upsert the new one with `left_on: null`, as in (1).
4. If the team did not change, still upsert `payload.teamId` with
   `left_on: null`, so an edit to any field reconciles a membership-less student.

**Do not touch any membership whose `team_id` is neither the previous nor the
new team.** That is Trap B.

### 2a. The exact upsert payload, and why `joined_on` is absent (round 2)

Send **exactly** `{ student_id, team_id, left_on: null }` with
`{ onConflict: 'student_id,team_id' }`. **Do not include `joined_on`.**

**Measured by round 2's gate through a real `postgrest/postgrest` container
bound to a scratch cluster — not taken from the documentation.** Against a row
seeded `joined_on = 2026-01-05, left_on = 2026-06-30`, the prescribed payload
generated:

```sql
ON CONFLICT("student_id","team_id") DO UPDATE SET "left_on" = EXCLUDED."left_on",
  "student_id" = EXCLUDED."student_id", "team_id" = EXCLUDED."team_id"
-- after: joined_on = 2026-01-05 (PRESERVED), left_on = NULL (REACTIVATED)
```

and the counterfactual — the same request *with* `joined_on` in the payload —
put `"joined_on" = EXCLUDED."joined_on"` into the `DO UPDATE SET` list and reset
the date to `2026-08-14`. So omitting the column is what preserves an existing
row's join date, while a new row still takes the column's `default current_date`.
Including it would silently reset the join date of every membership touched by an
unrelated edit.

**Disclosed consequence of step 2.4, which round 1's gate raised as MINOR-4.**
An unconditional upsert reactivates a membership that was deliberately closed
when `students.team_id` still names that same team — configuration (a) of
`20260812000000_events_rls_active_membership_read.sql:85-89`. **This packet
accepts that, deliberately**, rather than taking the gate's suggested "only if
no ACTIVE row exists" guard, for two reasons:

- The guard does not prevent it. In configuration (a) there *is* no active row
  for that pair, so the guarded upsert fires anyway. It would add a read and
  change nothing.
- The roster is the source of truth for a student's current team. A row saying
  "left team X" while the roster says "is on team X" is contradictory data, and
  reconciling it toward the roster is what this whole issue asks for. A student
  the roster says is on team X *should* have an active membership in X — that is
  precisely the participation gap being closed.
  **This is a positive claim only — "is on X", never "and only X".** That is why
  it does not contradict Trap B: it authorizes *opening* X, never *closing*
  anything else.

Say this in a code comment so the next reader does not "fix" it.

### 3. Non-atomicity is a Known Risk, not a defect to solve here

These are separate PostgREST statements from a browser; there is no transaction.
A membership write can fail after the `students` write succeeded. Two rules:

- Order as specified — the `students` write first, so the roster surface never
  shows a student whose base row failed to save.
- Let the membership failure **throw** through `runMutation`'s existing
  `toLoaderError` path. Do not swallow it. A silent catch here recreates the
  exact invisible-drift defect this issue exists to fix.

A trigger or RPC would be atomic and is the better long-term answer — it is
excluded because it is a migration, which item 16 reserves for the owner, and
the whole value of Part 1 is that it needs no migration applied. Say so in a
code comment.

**One measured caveat on "let it throw", from round 1's gate.** An RLS-filtered
`UPDATE` does *not* raise — it returns `UPDATE 0` silently. So the close
statement cannot be relied on to throw if the actor lacks staff rights. This is
**unreachable in production and needs no defensive code**: `/roster` is gated by
`RequireRole allowedRoles={['coach','admin']}` (`RosterShell.tsx:236`), and the
gate measured `is_staff() = t` for a `coach` profile under a non-superuser
`authenticated` role, with the prescribed writes succeeding. Recorded so nobody
re-derives it.

### 4. The exact `left_on` value (round 2)

Send `new Date().toISOString().slice(0, 10)` — a **UTC-derived** `YYYY-MM-DD`
string. Not `current_date`: you cannot send a SQL expression through PostgREST,
only a JSON value.

UTC is chosen over America/Chicago deliberately, against LCD #5's own worry.
**The precedent for deriving *today* this way is
`ScheduleMeetingsDialog.tsx:369` and `OutreachEventDialog.tsx:699,710`**, all
`new Date().toISOString().slice(0, 10)`. Introducing a second, Chicago-derived
date convention for one column would be the larger inconsistency.

**State the drift honestly rather than hiding it: a close stamped between 19:00
and midnight Chicago time records the following day.** It is inert — every
consumer of `left_on` in the repo tests `left_on is null` and nothing performs
date arithmetic on it (verified by the gate across all `.ts`, `.tsx` and `.sql`).
If a consumer ever *does* read the value, revisit this.

*Round 2 correction, recorded because the packet was wrong:* this section
previously cited `src/lib/format/dates.ts:41` as authority. It is not.
`dates.ts:21-24` pins `timeZone: 'UTC'` when **formatting an existing date-only
string**, so a UTC-parsed date does not roll *back* a day for a UTC-negative
viewer — the opposite direction from deriving today off a wall clock. It is
authority *against* this class of error, not for it.

## Acceptance criteria

**Where the coverage actually lives, corrected in round 2.** `students.test.ts`
has a per-table fake (`students.test.ts:98`) but **no `students` branch at all**
— its `fromSpy` throws `unexpected table: students` — and no write chains. The
existing coverage for `createStudent`/`updateStudent` is in
`StudentsTab.test.tsx:1014-1110`. Expect to work in both files.

1. `createStudent` issues a `student_teams` write for the new student's id and
   `payload.teamId`, with `left_on: null`, on conflict target
   `student_id,team_id`.
2. `updateStudent`, when `teamId` changes, closes exactly the previous team's
   ACTIVE membership (`left_on` set, filtered by `student_id` **and**
   `team_id = previousTeamId` **and** `left_on is null`) and opens the new one.
3. **Trap B regression test — rewritten in round 2, because the round-1 wording
   was proven to pass for the very design it forbids.** The gate implemented the
   forbidden `.neq('team_id', newTeam)` design and applied the old criterion
   ("assert no write targets C") to it: it **passed**, because a `neq` filter
   never names team C. A criterion that cannot fail is not a criterion.
   Replace it with all three of:
   - **positive filter** — the close issues `.eq('student_id', id)` **and**
     `.eq('team_id', previousTeamId)` **and** `.is('left_on', null)`;
   - **negative** — `.neq(...)` is never called on `student_teams`;
   - **row state** — with a *stateful in-memory* `student_teams` fake seeded
     with ACTIVE memberships {A, C}, moving the student A→B leaves final row
     state: **A closed, B active, C active**. Assert the rows, not the calls.
     This last one is the only shape that distinguishes the two designs, and it
     is the `scratch-postgres` skill's own standing rule — assert post-write row
     state, not the SQL you issued.

   **The stateful fake must expose `.neq()` even though the correct
   implementation never calls it**, and must also carry `students` doubles for
   the read-back and the update. Otherwise criterion 9's third mutation dies with
   `TypeError: ...neq is not a function` instead of failing on the intended
   assertion — a misdirecting red that this repo already has a documented
   convention against (`students.test.ts:38-46`: the mutation's failure must
   *"genuinely come from the intended `eqSpy` assertion going red, not from an
   unrelated crash"*).

   Round 2's gate built this criterion and ran it against both implementations:
   all three assertions pass for the prescribed writer and **all three fail for
   the forbidden `.neq` one**, 3c yielding the diff `"team-C": "active"` →
   `"team-C": "closed"`. It is no longer vacuous.
4. **Trap A regression test:** re-joining a previously-left team goes through
   the upsert path with `left_on: null` and `onConflict: 'student_id,team_id'`,
   and `.insert(...)` is **never** called on `student_teams`. *Only the call
   shape is observable from vitest.* Do **not** try to prove the database
   reactivation here — round 1's gate already proved it on a real cluster
   (plain re-insert → SQLSTATE 23505 `duplicate key value violates unique
   constraint "student_teams_pkey"`; the prescribed upsert → row reactivated,
   `vp_rows` 0 → 1). Cite that; do not re-derive it.
5. `updateStudent` with an unchanged `teamId` still upserts the membership and
   closes nothing.
6. A failed membership write rejects — it does not resolve successfully.
7. `CreateStudentFn` / `UpdateStudentFn` signatures and return values unchanged.
   **`StudentsTab.tsx` source is not edited.** `StudentsTab.test.tsx`'s two T089
   mutation tests are updated to table-aware fakes, and **every existing
   assertion in them (`insertSpy`/`updateSpy`/`eqSpy` arguments, mapped return
   value) survives unchanged.**
8. All six gates green (`/gate-run`), against these **measured baselines**
   (orchestrator, this branch, after `npm ci`):
   - full suite — **2458 passed**;
   - `src/lib/supabase/loaders/` — **14 files, 235 passed**;
   - `src/pages/roster/StudentsTab.test.tsx` — **34 passed**.
   Your totals must be these plus your new tests. A total that *drops* means you
   deleted or skipped coverage.
9. **Mutation proof** (`/mutation-replay`): removing the membership write from
   `createStudent` turns criterion 1's test red; removing the close from
   `updateStudent` turns criterion 2's test red; **and replacing the positive
   `.eq('team_id', previousTeamId)` filter with `.neq('team_id', payload.teamId)`
   turns criterion 3's row-state test red.** That third mutation is the one that
   proves criterion 3 is no longer vacuous — run it and report its real red
   output. Commit before mutating (item 26's fast-tier working rule).

## Least confident decisions (item 19d) — attack these first

Round 1's gate challenged #2, #3 and #5 and confirmed #1 and #4. Rewritten to
carry what it found; the confirmed entries stay, because a resolved doubt is
still the right place for the next reader to push.

1. **Closing only the previous primary, rather than all non-matching active
   memberships.** *Round 1 confirmed the rule and executed it:* dual ACTIVE
   memberships are intended and fixtured (`gam299_seed.sql:121-124`,
   `parentHome.test.ts:568`, the `student_teams` migration header's own
   P3/Gear-Girls example), and in a real `coach` RLS session an A→B move left
   team C active. **Its full cost, which round 1 said the entry understated:**
   this rule *permanently entrenches* the stale-active rows of population 2 —
   the close will never match them, and the application cannot tell them apart
   from a legitimate second team. I accept that: deleting a real membership is
   unrecoverable from the UI, while an extra row is visible and repairable by a
   targeted backfill. **What would still make it wrong:** the owner deciding the
   roster's team field is authoritative and single-valued.
2. **Reconciling on unchanged-team edits (step 2.4).** *Round 1 challenged this,
   round 2 withdrew the challenge after measuring it.* §2a discloses that an
   unconditional upsert reopens a deliberately-closed membership when the roster
   still names that team, and defends it rather than guarding it. The gate
   enumerated all four reachable seed states and ran both variants: the proposed
   guard ("upsert only if no ACTIVE row exists") changes the final row state in
   **zero** of them — it is true precisely when the row is closed, so it opens
   the gate for exactly the case it was meant to block. **What would make it
   wrong:** a real workflow where "closed but still the primary team" means
   *suspended, do not count* — none exists, and no UI can produce that state.
3. **Reading `students.team_id` back rather than threading the previous team
   from `StudentsTab.tsx:1226`,** which already has `editTarget.teamId`.
   *Round 1 was right that my stated reason was wrong*; **round 2 then measured
   the replacement reason and found that wrong too, in my favour.** The decision
   stands and round 2's gate formally withdrew its own cheaper-path suggestion.

   The corrected mechanism: threading does **not** close the wrong team. With
   the database already moved A→B by a second staff member while Staff 1's
   browser still holds `editTarget.teamId = 'A'`, the gate measured —

   - *Staff 1 edits an unrelated field:* threading sees `previous === payload`
     (both from the same stale snapshot), skips the close entirely, and leaves
     `[A:active, B:active]` — a spurious dual membership. Read-back:
     `[A:active, B:closed]`.
   - *Staff 1 moves the student to C:* threading closes A, which is already
     closed, so it matches nothing and leaves `[A:closed, B:active, C:active]`
     — **B ACTIVE with nobody on it, which is population 2 re-created by the
     very code meant to eliminate it.** Read-back: `[A:closed, B:closed,
     C:active]`.

   Threading fails to close *any* team; it does not close the wrong one. The
   read-back produces the roster-consistent state in both scenarios, for one
   round trip. Threading would also still require `StudentsTab.tsx` **source**
   (call site `:1226`) in Allowed Files, which this packet excludes — so the
   round-1 cost argument was not fully moot either. **What would make it wrong:**
   evidence that the round trip is a real latency problem.
4. **Accepting non-atomicity rather than escalating for an RPC migration.**
   *Round 1 confirmed this*, with the `UPDATE 0` caveat now recorded in §3.
   **What would make it wrong:** a measured failure mode where the membership
   write fails often enough that partial state is common rather than rare.
5. **`left_on` date derivation.** *Round 1 was right that "`current_date` (or
   the client's equivalent)" was not a prescription at all* — you cannot send a
   SQL expression through PostgREST. §4 now pins the exact literal and chooses
   **UTC**, matching `src/lib/format/dates.ts:41` and
   `ScheduleMeetingsDialog.tsx:353`, over the Chicago derivation this entry
   originally worried about. **What would make it wrong:** any consumer reading
   the `left_on` *value* rather than its nullness. The gate found none.

## Round 1 gate findings, and what each one changed

| Finding | Severity | Disposition |
| -- | -- | -- |
| `StudentsTab.test.tsx` breaks and was not in Allowed Files | BLOCKER | **Fixed** — file added, amendment scope and limits spelled out |
| Criterion 3 passes for the design Trap B forbids | MAJOR | **Fixed** — rewritten as positive filter + no-`neq` + stateful row-state assertion; new mutation added to criterion 9 |
| Stale-active-membership population never named | MAJOR | **Fixed** — both populations documented; effect of this writer on population 2 stated explicitly |
| Step 2.4 reopens a deliberately-closed membership | MINOR | **Accepted in writing** (§2a), not guarded — the suggested guard does not prevent the case |
| `left_on` value not a real prescription | MINOR | **Fixed** — §4 pins the literal and the timezone, with reasons |
| No gate baselines | MINOR | **Fixed** — 2458 / 235 / 34, measured on this branch |
| `met01` `e.team_ids` cited at :113 | NIT | **Fixed** — :114 |
| Acceptance preamble overstated `students.test.ts` coverage | NIT | **Fixed** — preamble rewritten |

## Round 2 gate: `DISPATCH`

No BLOCKER, no MAJOR. Round 1's BLOCKER and both MAJORs were verified closed **by
execution** — the gate implemented the prescription, ran the suite (`tsc` exit 0,
2458 passed, `StudentsTab.test.tsx` 34 passed), and ran the rewritten criterion 3
against the forbidden implementation to confirm it now fails. It also **withdrew
both of its own round-1 findings that this packet had declined** (the step-2.4
guard, proven a no-op; the read-back, proven more correct than threading).

Folded in before dispatch:

| Finding | Severity | Disposition |
| -- | -- | -- |
| Amendment instruction named the wrong failing call — it is `students.select()` (the read-back, the FIRST `from()`), so "`students` keeps its existing chain" is what breaks | MINOR | **Fixed** — both breakages spelled out, `:919` precedent cited |
| Criterion 3's stateful fake must expose `.neq()` and `students` doubles, or mutation 3 dies on a `TypeError` | MINOR | **Fixed** — requirement and rationale added |
| §4 cited `dates.ts:41`, which is authority *against* this derivation, and misquoted it | MINOR | **Fixed** — real precedents cited, drift window stated |
| LCD #3's mechanism wrong — threading leaves a stale ACTIVE row, it does not close the wrong team | MINOR | **Fixed** — measured scenarios written in |
| `:1029`/`:1078`/`1014-1110` stale by one or two lines | NIT | **Fixed** — `:1031`, `:1079`, `1014-1103` |
| Non-sequitur on why the close matches nothing for population 2 | NIT | **Fixed** |
| §2a claimed from docs rather than measured | — | **Upgraded** — real PostgREST result and generated SQL quoted |
