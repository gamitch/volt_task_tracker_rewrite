Closes GAM-340

## What changed

`student_teams` now has a writer. `createStudent` opens a membership for the new
student's team; `updateStudent` reads the student's previous team, closes exactly
that membership, and opens the new one. Students added through the roster stop
being dropped by `v_student_participation`'s INNER join.

Application code only — no migration, no schema change, no RLS change. Three
files: `src/lib/supabase/loaders/students.ts` and two test files.

## What the issue got wrong

The premise held — re-measured on a scratch PostgreSQL 16.14 cluster carrying all
25 migrations, executing the counterfactual rather than reading it: a
membership-less student returns **0** participation rows, the same student with a
membership returns **1**. But the gate falsified two things around it:

**The issue named one broken population; there are two.** It described students
created since the backfill (no membership row). It did not name the **re-teamed**
students, who hold an ACTIVE row for the team they *left* and none for the team
they are on — documented in a shipped migration's own header
(`20260812000000_events_rls_active_membership_read.sql:91-112`) and fixtured at
`tests/rls/gam299_seed.sql:129-135`. That population is corrupting
`v_student_participation` **today**, with no dependency on GAM-299's migration
being applied, and this writer deliberately does not repair it. Filed as GAM-391.

**The issue's `e.team_ids` citation and my own packet's were both off by one** —
the predicate is at `met01_explicit_marks.sql:114`, not `:113`.

Two traps the issue text did not carry, both proven by execution:

- **The primary key is `(student_id, team_id)`.** A student who leaves team A and
  later returns must **reactivate** the existing row. A plain insert raises
  `SQLSTATE 23505 duplicate key value violates unique constraint
  "student_teams_pkey"` — reproduced on a real cluster. Hence the upsert.
- **Closing every non-matching active membership would silently delete a
  dual-team student's legitimate second team.** Dual ACTIVE memberships are
  intended and fixtured (`20260721000000_student_teams.sql:1-4`'s P3/Gear Girls
  example). Measured under a real `coach` RLS session: the prescribed A→B move
  leaves team C active.

## Tier, stated and defended

**HEAVY** (item 26). The trigger is not the topic — it is that this is a **write
path** performing a **destructive close** (`left_on`) whose rows are **metric-view
input** and, once GAM-299's migration is applied, **RLS input**. A wrong row here
does not skew a number; it removes a student from the metric entirely.

The losing argument was STANDARD: it touches one production module, and file
count is explicitly not a trigger. Item 26 says take the heavier tier when two
are arguable, and the gate then justified the cost — round 1 returned a
**BLOCKER** that would have guaranteed worker failure.

Worker dispatched with `model: "opus"` per item 18, because the rows written are
role/permission scope input.

**Process deviation, declared rather than hidden:** the premise gate ran its full
two rounds (item 19a's cap). Round 1 `REVISE` — 1 BLOCKER, 2 MAJOR, 3 MINOR, 2
NIT. Round 2 `DISPATCH` — 4 MINOR, 2 NIT, all folded in before the worker saw the
packet. Round 2 also **withdrew two of its own round-1 findings** after measuring
them, which is recorded in the packet rather than quietly dropped.

## Verification

```
GATE RUN — 74340f0 on claude/gam-340-student-teams-writer — tree clean
  1 tsc                               exit 0  PASS
  2 vite build                        exit 0  PASS
  3 format:check                      exit 0  PASS
  4 eslint                            exit 0  PASS   0 errors, 379 warnings
  5 vitest (full)                     exit 0  PASS   95 files / 2476 tests  baseline 2458 (+18)
  6 vitest src/lib/supabase/loaders/  exit 0  PASS   14 files / 253 tests   baseline 235 (+18)
VERDICT: PASS — all six gates exit 0
```

No gate skipped. `src/pages/roster/StudentsTab.test.tsx` re-run separately: **34
passed**, unchanged from baseline. No total dropped; +18 both places is exactly
the new test count. Reproduced independently by `checker-reviewer`, not accepted
from the worker.

### Mutations

| # | Mutation | Result |
|---|---|---|
| 1 | drop the membership write from `createStudent` | RED — 5 tests |
| 2 | drop the close from `updateStudent` | RED — 5 tests |
| 3 | the forbidden `.neq('team_id', newTeam)` design | RED — criteria 2, 3a, 3b, 3c |
| 4 | drop `left_on: null` from the upsert payload | RED — 6 tests |
| 5 | move the read-back **after** the `students` update | **GREEN — see Known gaps** |
| 6 | `onConflict: 'student_id'` instead of the composite | RED — 4 tests |
| 7 | wrap the membership write in a swallowing `try/catch` | RED — criterion 6 |

Mutations 1-3 are the packet's; 4-7 are the checker's own, run in its own
worktree (item 23). Mutation 3 is the load-bearing one: the packet's **first**
version of that criterion was proven to **pass** for the very design it forbids,
so it was rewritten around post-write row state. The rewritten criterion produces

```
    "team-alder": "closed",
    "team-birch": "active",
-   "team-cedar": "active",
+   "team-cedar": "closed",
```

— the dual-team student's second team silently deleted. The criterion can now fail.

## Scope

**Passed, not Partial** (item 27). The checker traced the connection end to end
rather than grading the render: `router.tsx:268` → `RosterShell.tsx:258` →
`StudentsTab.tsx:1081-1082` defaults `onCreateStudent`/`onUpdateStudent` to the
real loaders → `getSupabaseClient`. The membership writes ride the same real
client as the pre-existing `students` writes on the actual path a roster user
takes. No fixture, no stub.

**This PR is Part 1 only.** Part 2 — dropping the two legacy `own_or_linked_read`
policies — is deliberately excluded on the issue's own constraint: *"Do not drop
the legacy policies in the same change as the writer."* With today's data a
memberships-only policy is strictly worse than what ships (measured during
GAM-299: a fixture student goes from 20,003 visible events to 1). Filed as
GAM-392.

## Follow-ups filed

All in `Backlog` carrying `tier/unreviewed`, before this PR opened.

| Row | What |
|---|---|
| GAM-390 | Backfill the missing-membership population (`gate/human` — item 16) |
| GAM-391 | Backfill the re-teamed / stale-active-membership population (`gate/human`) |
| GAM-392 | Part 2 — drop the two legacy `own_or_linked_read` policies |
| GAM-393 | Harden the read-back ordering test (the mutation-5 gap below) |
| GAM-394 | `gate-run` SKILL.md says 377 standing eslint warnings; it is 379 |

## Known gaps, disclosed

**1. The read-back ordering is not enforced by a test.** Mutation 5 moved the
previous-team read-back to *after* the `students` update and **the whole suite
stayed green** — yet in production that ordering makes `previousTeamId ===
payload.teamId` always, so no close would ever fire. The shipped code is correct;
the guard against a future reordering is not. Found by the checker's own
mutation, **not** by the packet's criterion-9 set. GAM-393.

**2. Neither broken population is repaired.** A code change cannot retroactively
create memberships. Missing-membership students self-heal on their next roster
edit (the unchanged-team path still upserts); stale-active-membership students
gain a correct row and **keep** the incorrect one, which the application cannot
distinguish from a legitimate dual membership. GAM-390 and GAM-391.

**3. Non-atomicity.** These are separate PostgREST statements from a browser;
there is no transaction. The `students` write goes first and membership failures
throw rather than being swallowed. The atomic answer is a trigger or RPC — a
migration, which item 16 reserves for the owner and which would forfeit this
change's whole property of needing nothing applied.

**4. `left_on` is UTC-derived**, so a close stamped between 19:00 and midnight
Chicago records the following day. Inert — every consumer tests `left_on is null`
and nothing does date arithmetic on the value.

**5. Which migrations the hosted project carries was not verified.** It is
unreachable from this environment, as GAM-299's PR also recorded. The
participation claim holds on the schema this repo defines.

Linear-Issue: GAM-340
