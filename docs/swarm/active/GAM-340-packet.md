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
- any backfill of students created between 2026-07-21 and this fix — that is an
  owner call and is being filed as its own `gate/human` row.

## Allowed Files

- `src/lib/supabase/loaders/students.ts`
- `src/lib/supabase/loaders/students.test.ts`

Nothing else. **Checked at packet time: no `.github/workflows/**` path is in
this list** (AGENTS.md "Two walls", wall 1). No file under `supabase/`,
`docs/swarm/`, or `.claude/`.

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
   `st.team_id` is *also* used at :113 in the `e.team_ids` predicate, so a
   membership row is not merely a filter, it supplies the team the event
   predicate matches on.

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
   - close exactly the old one — `left_on = current_date` (or the client's
     equivalent) where `student_id = id and team_id = previousTeamId and
     left_on is null`;
   - upsert the new one with `left_on: null`, as in (1).
4. If the team did not change, still ensure a membership exists for
   `payload.teamId` (upsert). This is what repairs the existing membership-less
   population as the owner edits those students, without a backfill.

**Do not touch any membership whose `team_id` is neither the previous nor the
new team.** That is Trap B.

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

## Acceptance criteria

Measurable with the fixtures that exist today — `students.test.ts` already has a
per-table fake client chain (`if (table === 'student_teams') return { select: teamsSelectSpy }`,
`students.test.ts:98`), which the worker extends with the write chains.

1. `createStudent` issues a `student_teams` write for the new student's id and
   `payload.teamId`, with `left_on` null, on conflict target `student_id,team_id`.
2. `updateStudent`, when `teamId` changes, closes exactly the previous team's
   ACTIVE membership (`left_on` set, filtered by `student_id` **and**
   `team_id = previous` **and** `left_on is null`) and opens the new one.
3. **Trap B regression test:** a student with two ACTIVE memberships (primary A,
   second C) edited from A to B ends with C **still active**. Assert no write
   targets C.
4. **Trap A regression test:** re-joining a previously-left team reactivates the
   existing row via upsert (`left_on: null`), not a plain insert.
5. `updateStudent` with an unchanged `teamId` still ensures a membership exists
   and closes nothing.
6. A failed membership write rejects — it does not resolve successfully.
7. `CreateStudentFn` / `UpdateStudentFn` signatures and return values unchanged;
   `StudentsTab.tsx` is not edited and its tests still pass.
8. All six gates green (`/gate-run`).
9. **Mutation proof** (`/mutation-replay`): removing the membership write from
   `createStudent` turns criterion 1's test red; removing the close from
   `updateStudent` turns criterion 2's test red. Report the real red output and
   exit codes. Commit before mutating (item 26's fast-tier working rule).

## Least confident decisions (item 19d) — attack these first

1. **Closing only the previous primary, rather than all non-matching active
   memberships.** Wrong if the owner's mental model is that the roster's team
   field is authoritative and single-valued — then a dual-team student's second
   row is stale data this should clean up. I chose it because deleting a
   legitimate membership is unrecoverable from the UI, while leaving one is
   visible and fixable. **What would make it wrong:** evidence that dual
   memberships are only ever created by the backfill and never intended.
2. **Repairing on unchanged-team edits (step 2.4) instead of leaving the
   existing membership-less population to a backfill.** Wrong if it masks the
   size of the population from the owner, who still has to decide about the
   backfill. **What would make it wrong:** the owner wanting an exact count of
   affected students before any repair happens.
3. **Reading `students.team_id` before the update rather than threading the
   previous team through from `StudentsTab.tsx`,** which already holds the
   editTarget row. The read costs a round trip; threading would change a
   cross-file type and pull `StudentsTab.tsx` into Allowed Files. **What would
   make it wrong:** the extra read racing a concurrent edit — two staff editing
   one student, which on a ~20-student volunteer portal I judged not real.
4. **Accepting non-atomicity rather than escalating for an RPC migration.**
   **What would make it wrong:** a measured failure mode where the membership
   write fails often enough that partial state is common rather than rare.
5. **`current_date` for `left_on`** (matching the column's `joined_on default
   current_date`) rather than a UTC-derived date. NFR-09 stores UTC and displays
   America/Chicago; `left_on` is a `date`, and a close stamped near midnight UTC
   could read as the following day locally. **What would make it wrong:** any
   consumer doing date arithmetic on `left_on` — I found none; every consumer
   tests `left_on is null`.
