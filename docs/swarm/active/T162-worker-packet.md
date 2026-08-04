# T162 — worker packet **v2**: first tests for `loaders/meetings.ts`

**Workflow W3-A (unattended hygiene wave). Branch `claude/w3a-meetings-hygiene`. STANDARD tier.**
Base: `d5d420a`.

**Gate round 1 returned REVISE (1 BLOCKER, 1 MAJOR, 3 MINOR, 3 NIT). This is the revision.** Item 19a
caps the gate at two rounds. Every finding is addressed below; the two BLOCKERs were **the packet
author's own false claims**, not worker-facing ambiguity, and are corrected in place rather than
softened.

> ### What v1 got wrong, stated plainly so it is not re-derived
>
> 1. **v1 said `makeCreateMeetings` "rejects before any network call". IT DOES NOT.** It `await`s a
>    `seasons` query **first** (`:712`), then guards (`:713-717`). The true statement is *rejects
>    before either **write***.
> 2. **v1 drew an analogy to `endMeeting.ts`'s `makeOnEditAttendance`. That analogy is wrong.** That
>    guard calls a **closure** (`getRecordedBy()`) and genuinely precedes any network call. These are
>    not the same shape. The analogy is deleted, not repaired.
> 3. **v1's C4 was untestable by the assertion a worker would naturally write** — see §6.
> 4. **v1 framed this row as "novel" work.** It is substantially **copy-and-adapt** — see §5.1.

## 1. Citations — re-verified at `d5d420a`

| Claim | Status |
|---|---|
| `meetings.ts` is 726 lines; zero tests (no `meetings.test.ts`) | ✅ |
| `aggregateParticipationRows:465` · `makeLoadCoachMeetingsData:536` · `makeLoadStudentMeetingsData:581` · `makeCancelMeetingSession:618` · `makeResolveCurrentStudentId:636` · `makeCreateMeetings:670` | ✅ all six |
| `queryFirstLinkedStudentId` "EARLIEST-linked child only" doc `:503`, decl `:504`, `.order` `:512`, `.limit` `:513` | ✅ |
| The T147 real-teams comment block starts at **`:564`** | ✅ *(v1 said `:565` — corrected)* |

**Ledger claim corrected:** the row calls `:570` a *"fixture-fallback comment from the T147
incident."* That block documents **the fix** — threading real teams through so
`ScheduleMeetingsDialog` stops using its own fixture `DEFAULT_TEAMS`. A grep for
`fixture|fallback|DEFAULT_TEAMS|placeholder` across the file returns **only comments**. **No live
fixture path survives anywhere in this file. Do not go hunting for one.**

## 2. ⚠️ THE METRIC TRAP — `present_ct` ALREADY INCLUDES LATE

**Operative definition — `supabase/migrations/20260722000000_membership_views.sql:72-76`.** This is
the **live** view; `20260717000003_metric_views.sql:33-34` was superseded by a later
`create or replace` and `meetings.ts:446` cites the membership one itself. **Both are W4's —
read-only for you.**

```sql
count(*) filter (where a.status in ('present','late')) as present_ct,
count(*) filter (where a.status = 'late')              as late_ct,
```

`aggregateParticipationRows:477-478`:

```js
const denominator = Math.max(expectedCt - excusedCt, 1);
const participationPct = Math.round(((100.0 * presentCt) / denominator) * 10) / 10;
```

**PRD MET-01 (`VOLT_Portal_PRD.md:563`) says the numerator is "present+late marks". The code uses
`presentCt` alone. THAT IS CORRECT** — `present_ct` *is* `present ∪ late`. Confirmed independently
by the gate three ways: the view's own `participation_pct`, `v_team_participation` summing
`present_ct` alone, and `checkin.ts:340-373` doing the same.

**Two ways to ship a lie about a student's own participation:**

1. A test expecting `(present_ct + late_ct) / denominator` — **double-counts every late mark**, goes
   green, cements the error.
2. "Fixing" `aggregateParticipationRows` to add `lateCt`. **Do not touch that function's logic.** If
   you believe it is wrong, **STOP and raise a dispute** — do not edit it.

### 2.1 Fixture rules — and their exact scope

**These govern `ParticipationDbRow` fixtures ONLY** (the view-shaped rows this loader aggregates):

- `late_ct <= present_ct` — late is a **subset**, not a sibling
- `present_ct + excused_ct <= expected_ct`
- **The only view-possible `expected_ct == excused_ct` fixture has `present_ct = 0`** (if every
  expected session was excused, none can be present). So dropping the denominator floor yields
  **`NaN`, not `Infinity`** — assert accordingly.

**⚠️ These rules do NOT apply to the coach-view `PastAttendanceSummary` shape**
(`MeetingsList.tsx:928-940`), whose `present`/`late` **are disjoint** and which `:1075` therefore
**correctly adds together**. Two different `{presentCt, lateCt}` shapes exist in this feature. If
you write fixtures for §4 item 5, do not import this rule into them.

## 3. Allowed files

- **NEW** `src/lib/supabase/loaders/meetings.test.ts` — this is the task.
- `src/lib/supabase/loaders/meetings.ts` — **only if a test reveals a genuine defect**, and only
  after raising it. **Default expectation: unmodified.**

**Read-only reference (W3's own files, but out of scope for this task):**
`endMeeting.ts`, `endMeeting.test.ts`, `checkin.ts`, `checkin.test.ts`.
**Not W3's at all:** `*metric_views.sql` / `*membership_views.sql` (W4's), `LiveConsole.tsx` /
`Kiosk.tsx` (W1's), any migration.

## 4. What to cover — priority order

**§4 items 4 and 5 are deliberately criterion-free.** If you run out of room, cover fewer things
properly rather than all six thinly. Items 1–3 carry the criteria and are the task's real content.

1. **`aggregateParticipationRows`** — highest value, the only pure function here. Empty → `null`;
   single row → returned **as-is**; multi-row summing; the `Math.max(…,1)` denominator floor;
   rounding (`Math.round(x*10)/10`); and `student_id`/`team_id`/`season_id` sourced from `rows[0]`.
2. **`makeCreateMeetings`** — the mutation behind the owner's own reported failure (T147). Its
   **domain rejection** when no season is active. Read §6 C6 carefully before writing this one.
3. **`makeResolveCurrentStudentId`** — `queryFirstLinkedStudentId` is *EARLIEST-linked child only*
   (`:503-513`). A parent with two linked children must resolve to the first-linked. Read §6 C5
   before writing this one.
4. `makeCancelMeetingSession` — call shape and scoping. *(no criterion)*
5. `makeLoadCoachMeetingsData` / `makeLoadStudentMeetingsData` — error propagation and row-shape
   mapping, not re-testing the aggregation. *(no criterion)*

## 5. How to test

**Outcome-provable, not call-shape.** This project has shipped **7+ assertions that passed for the
wrong reason** (`verification-log.md:7726-7733`) and **one that went vacuous rather than red**
(`:7791-7799`).

### 5.1 START HERE — this is largely copy-and-adapt, not novel work

**`src/lib/supabase/loaders/checkin.test.ts:45-123` already tests this exact formula.**
`checkin.ts:330-373`'s `aggregateParticipationForStudent` is `aggregateParticipationRows` **plus a
season filter** — same summing, same `Math.max(expectedCt - excusedCt, 1)`, same
`Math.round(x*10)/10`. That green file already covers:

| Case | Location |
|---|---|
| empty → `null` | `:50` |
| single row returned verbatim | `:54-59` |
| multi-row summing | `:63-71` |
| **denominator floor, `expected_ct == excused_ct`** — asserts `.toBe(0)` **and** `Number.isFinite(...)` | `:86-93` |
| rounding table | `:98-123` |

**`Number.isFinite(...)` at `:93` is the ready-made C2 assertion.** Adapt these; the difference is
that `aggregateParticipationRows` has **no season filter**. Do not reinvent them, and do not blindly
copy the season-filter cases that do not apply.

### 5.2 Other precedents

- **T197** (`endMeeting.test.ts`, landed on this branch) — same directory, same `runMutation` shape.
  Asserts final row state, not that `.eq()` was called.
- **T402's C2** (`verification-log.md`) — a fake whose *physical* behaviour makes the defect
  observable.

`getClient` is injectable on every factory here (`:537, :582, :619, :637, :671`), so a stubbed
transport needs zero network.

## 6. Acceptance criteria

**C1–C3 require a fixture of ≥2 rows.** `meetings.ts:469` returns `rows[0]` untouched for a single
row, so a one-row fixture cannot exercise the arithmetic at all.

| # | Criterion | Mutation → must go RED at exit 1 |
|---|---|---|
| C1 | Summing is real | `+ row.present_ct` → `+ 0` (`:471`) |
| C2 | Denominator floor is real | drop `Math.max(…, 1)` (`:477`) |
| C3 | Rounding is real | drop the `Math.round(x*10)/10` wrapper (`:478`) |
| C4 | Single-row identity holds | make the `rows.length === 1` branch fall through (`:469`) |
| C5 | Earliest-linked-child ordering is real | delete `.order('created_at', {ascending:true})` (`:512`) |
| C6 | The no-active-season **domain** rejection is real | remove the guard (`:713-717`) |
| C7 | Suite still green | — |

### C2 — assert `Number.isFinite`, not a magic number
The only view-possible `expected == excused` fixture has `present_ct = 0`, so the mutation yields
**`NaN`**. Copy `checkin.test.ts:86-93`.

### C4 — ⚠️ VALUE EQUALITY DOES NOT WORK HERE
Measured by the gate: with the short-circuit removed, the recomputed object is **byte-identical** to
`rows[0]` (`participation_pct: 66.7` both ways). `toEqual` stays **GREEN**.
**Use reference identity: `expect(result).toBe(rows[0])`.** That is the one assertion that reddens
(`Object.is equality`, exit 1). This is a deliberate exception to §5's outcome-provable framing — the
*outcome* is genuinely indistinguishable, so identity is the only honest probe. Do not instead build
a view-impossible fixture whose `participation_pct` contradicts its own counters; §2.1 forbids it.

### C5 — ⚠️ THE OBVIOUS HARNESS MAKES THIS VACUOUS
`endMeeting.test.ts:110`'s stub makes `.order()` a **no-op passthrough** (`chain.order = () => chain`).
**Copy that and C5 can never redden** — deleting `.order()` from the source changes nothing the fake
observes. **Build a fake that physically sorts its rows only when `.order()` is called**, then assert
the parent resolves to the **earliest-linked** child. Seed the fake with the children in
reverse-`created_at` order so an unsorted read returns the wrong one.

### C6 — ⚠️ THE NATURAL ASSERTION STAYS GREEN. READ THIS TWICE.
**`makeCreateMeetings` does NOT reject before any network call.** `:712` `await`s the `seasons`
query; the guard at `:713-717` runs after it and rejects **before either write**.

Removing the guard does **not** produce a write either — `activeSeason.id` at `:718` throws
`TypeError: Cannot read properties of null (reading 'id')` first. **So "no `events` insert happened"
is TRUE both with and without the guard, and a test asserting only that stays GREEN under the
mutation.**

**C6 must assert the rejection's identity:**

```
await expect(createMeetings(payload)).rejects.toThrow(/^No active season is set up yet\./)
```

Gate-verified red output for that form:
`expected [Function] to throw error matching /^No active season is set up yet\./ but got 'Cannot
read properties of null (reading 'id')'` — exit 1.

You may **additionally** assert `from()` was called with `'seasons'` only, as a scope check. It must
not be the only assertion.

### C7 — expected counts
Base at `d5d420a` is **78 files / 1946 tests, exit 0**. Adding `meetings.test.ts` makes it **79
files**. State your delta so a replay does not misread it as drift.

**Item 23: commit before mutating.** Record each mutation's exact failing assertion and exit code,
then restore and verify `git diff --quiet`. **A green suite at exit 0 after a mutation means that
criterion is not covered — say so rather than adjusting the test to hide it.**

## 7. Required output

- Each of C1–C7 with its mutation's **real** output (failing assertion text + exit code)
- Final gates: `tsc`, `eslint`, `prettier`, `vitest`. **Base at `d5d420a`: `tsc` 0 · eslint 0 errors
  / 364 warnings · prettier clean · vitest 78 files / 1946 tests, exit 0.** If yours differ, say so
  plainly rather than restating these.
- Confirmation that `meetings.ts` is unmodified — or the defect that justified touching it and the
  dispute you raised **first**
- Anything found and not fixed, **filed** rather than dropped. Your block is **T600–T699**.
