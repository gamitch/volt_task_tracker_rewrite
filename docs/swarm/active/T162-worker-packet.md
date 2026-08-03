# T162 — worker packet: first tests for `loaders/meetings.ts`

**Workflow W3-A (unattended hygiene wave). Branch `claude/w3a-meetings-hygiene`. STANDARD tier.**

**Premise gate: REQUIRED for this packet** — orchestrator decision D2 in `auto-mode-decisions.md`.
T197's gate was skipped as a settled pattern; **this one is not that.** 726 lines of previously
untested loader, containing metric math a user sees, is 19b's "novel", not its "settled".

## 1. Citations, verified by the orchestrator at `4b0866c` (item 19c)

| Claim | Verified |
|---|---|
| `loaders/meetings.ts` is 726 lines | ✅ `wc -l` = 726 |
| Zero tests | ✅ no `meetings.test.ts` exists |
| `aggregateParticipationRows` | ✅ `:465` |
| `makeLoadCoachMeetingsData` | ✅ `:536` |
| `makeLoadStudentMeetingsData` | ✅ `:581` |
| `makeCancelMeetingSession` | ✅ `:618` |
| `makeResolveCurrentStudentId` | ✅ `:636` |
| `makeCreateMeetings` | ✅ `:670` |

**One ledger claim is imprecise and is corrected here:** the row says *"`meetings.ts:570` still
carries the fixture-fallback comment from that incident."* `:565-570` is a comment about *threading
real teams through so `ScheduleMeetingsDialog` gets real data instead of its own fixture
`DEFAULT_TEAMS`* — it describes the **fix**, not surviving fixture fallback. **There is no fixture
fallback left at that line.** Do not go hunting for one.

## 2. ⚠️ THE TRAP THAT DECIDES WHETHER THIS TASK HELPS OR HURTS

**`present_ct` ALREADY INCLUDES LATE. `late_ct` is a SUBSET of it, not a sibling.**

From `v_student_participation` (`*metric_views.sql`, read directly — W4's file, **read-only for
you**):

```sql
count(*) filter (where a.status in ('present','late')) as present_ct,
count(*) filter (where a.status = 'late')              as late_ct,
```

And `aggregateParticipationRows:478` computes:

```js
const denominator = Math.max(expectedCt - excusedCt, 1);
const participationPct = Math.round(((100.0 * presentCt) / denominator) * 10) / 10;
```

**PRD MET-01 says the numerator is "present+late marks". The code uses `presentCt` alone. THAT IS
CORRECT** — because `present_ct` is already `present ∪ late`. The code and the PRD agree.

**Two ways to get this wrong, both of which ship a lie about a student's own participation:**

1. **Writing a test that expects `(present_ct + late_ct) / denominator`.** That double-counts every
   late mark. Your test would go green against a formula that is wrong, and cement it.
2. **"Fixing" `aggregateParticipationRows` to add `lateCt`.** **Do not touch that function's
   logic.** If you believe it is wrong, STOP and report it as a dispute — do not edit it.

**Any fixture you build must satisfy `late_ct <= present_ct`.** A fixture with `present_ct: 3,
late_ct: 5` is impossible in the real view and a test built on it proves nothing.

## 3. Allowed files

- **NEW** `src/lib/supabase/loaders/meetings.test.ts` — this is the task.
- `src/lib/supabase/loaders/meetings.ts` — **only if a test reveals a genuine defect**, and then
  only after reporting it. Default expectation: **this file is not modified at all.**

**Not yours:** any `*metric_views.sql` (W4's — read as reference, never edit), `endMeeting.ts` /
`endMeeting.test.ts` (T197 just landed there), `LiveConsole.tsx` / `Kiosk.tsx` (W1's), any migration.

## 4. What to cover

**Priority order. If you run out of room, cover fewer things properly rather than all six thinly.**

1. **`aggregateParticipationRows`** — the highest-value target and the only pure function here.
   Cover: empty → `null`; single row → returned **as-is** (identity, not recomputed); multi-row
   summing; the **`Math.max(…, 1)` denominator floor** (a student with `expected == excused` must
   not divide by zero); the rounding contract (`Math.round(x*10)/10`, one decimal); and that
   `student_id`/`team_id`/`season_id` come from `rows[0]`.
2. **`makeCreateMeetings`** — the mutation behind the owner's own reported failure (T147). Cover its
   Supabase call shape and its **pre-condition rejection** (no active season → reject before any
   network call, the same shape `endMeeting.ts`'s `makeOnEditAttendance` uses for a null identity).
3. **`makeResolveCurrentStudentId`** — note `queryFirstLinkedStudentId` is documented
   *"EARLIEST-linked child only"* (`:504`, Trap #4) and orders by `created_at` ascending with
   `limit(1)`. **Assert that ordering** — a parent with two linked children must resolve to the
   first-linked one, and deleting the `.order()` must redden your test.
4. **`makeCancelMeetingSession`** — call shape and scoping.
5. **`makeLoadCoachMeetingsData` / `makeLoadStudentMeetingsData`** — the two composed loaders. Their
   value is in error propagation and in the row-shape mapping, not in re-testing the aggregation.

## 5. How to test — the standard this repo actually holds

**Outcome-provable, not call-shape.** This project has shipped **7+ assertions that passed for the
wrong reason**, and T401 produced one that went **vacuous rather than red**. Two patterns to copy,
both in `verification-log.md`:

- **T402's C2** — a fake whose physical behaviour makes the defect observable.
- **T197 (landed on this branch at `4b0866c`, `endMeeting.test.ts`)** — the closest precedent, same
  directory, same `runMutation` shape. **Read it before you start.** It asserts final row state, not
  that `.eq()` was called.

`getClient` is injectable on every factory here, so a stubbed transport needs zero network.

## 6. Acceptance criteria

| # | Criterion | Mutation that must turn it RED at exit 1 |
|---|---|---|
| C1 | Participation summing is real | change `+ row.present_ct` to `+ 0` in the reduce |
| C2 | The denominator floor is real | replace `Math.max(expectedCt - excusedCt, 1)` with `expectedCt - excusedCt` — a fixture with `expected == excused` must expose it (division by zero → `Infinity`/`NaN`) |
| C3 | Rounding is real | drop the `Math.round(x*10)/10` wrapper |
| C4 | Empty/single-row identity holds | make the `rows.length === 1` branch fall through to recomputation |
| C5 | Earliest-linked-child ordering is real | delete `.order('created_at', { ascending: true })` |
| C6 | `makeCreateMeetings`' pre-condition rejects before any network call | remove the no-active-season guard |
| C7 | Whole suite still green | — (no existing test weakened; base is 78 files / 1945 tests, exit 0) |

**Item 23: commit before mutating.** Record each mutation's exact failing assertion and exit code,
then restore and verify `git diff --quiet`. **A green suite at exit 0 after a mutation means that
criterion is not covered — say so rather than adjusting the test to hide it.**

## 7. Required output

- Each criterion with its mutation's **real** output (failing assertion text + exit code)
- Final gates: `tsc`, `eslint`, `prettier`, `vitest`. **Base measured by the orchestrator at
  `4b0866c`: `tsc` 0 · prettier clean · vitest 78 files / 1945 tests, exit 0.** If yours differ, say
  so plainly rather than restating these.
- Confirmation that `meetings.ts` is unmodified (or, if not, the defect that justified it and the
  dispute you raised first)
- Anything found and not fixed, **filed rather than dropped** — your row-number block is T600–T699
