# T401 — worker packet v2: delete the `ATTENDANCE_ROW_CAP` guard, now a false positive

**Tier: HEAVY** (constitution item 26). **Stated and defended, per item 26's requirement:** this
deletes a **fail-closed guard that gates a write**. The guard's only behaviour is to block
`MarkEventCompleteDialog`'s bulk attendance write; removing it *permits writes that are currently
refused*. Item 26's trigger question — *can a mistake here corrupt data?* — is yes: get this wrong
and the dialog resumes writing under a truncated load, which is exactly the destructive shape T307
was created to stop. The diff is small; the tier is not about diff size.

**Filed by:** W1 (`claude/w1-checkin`), ledger row **T401**, which records *"W2 executes, W1 does not
own the file."* **Branch:** `claude/t401-attendance-row-cap`, from `dcd0dae`.

---

## 1. Why this is now a defect

`MarkEventCompleteDialog.tsx:547` treats a load of ≥1000 rows as a **failed** load and blocks the
write:

```ts
export const ATTENDANCE_ROW_CAP = 1000;              // :448
...
if (rows.length >= ATTENDANCE_ROW_CAP) {             // :547  -> error state, write blocked
```

**That was correct when T307 wrote it.** PostgREST caps responses at `supabase/config.toml`'s
`[api] max_rows = 1000` and returns **200 with a partial `Content-Range`** — not an error — so
`createLoader` resolved a truncated array every caller read as complete. `rows.length >= 1000` was a
sound proxy for *"this may have been truncated; fail closed."*

**T320 removed the thing it was proxying for.** `makeLoadAttendanceForSessions`
(`loaders/attendance.ts:303-375`) now pages with `.order('id', { ascending: true })` and
`.range(...)`, looping until a short page returns. A resolve of ≥1000 rows now means **the data is
complete**. The guard blocks a legitimate write on a correct load.

**Verified on `dcd0dae` before this packet was written:** the constant and guard are present at
`:448`/`:547`, and the pagination is present at `attendance.ts:303-375`. T320 merged in PR #28.

---

## 2. Allowed Files

```
src/pages/outreach/MarkEventCompleteDialog.tsx
src/pages/outreach/MarkEventCompleteDialog.test.tsx
```

**Forbidden:** `src/lib/supabase/loaders/attendance.ts` — **W1's file. Read it, import from it,
never modify it.** Also `src/pages/checkin/**`, `LiveConsole.tsx`, `Kiosk.tsx`, `loaders/checkin.ts`,
`loaders/kiosk.ts` (W1), `src/pages/home/**` (W5), `pages/reports/**`, `loaders/reports.ts` (W4).

---

## 3. What to build

Delete the guard **and** the constant. The loader is now the single place that knows about
`max_rows`.

> **Citation correction (gate round 1).** v1 said this was *"what T320's own ledger row anticipated
> ('landing this row deletes that duplication')."* **That quote is not in T320's row.** The gate
> grepped all of `docs/`: the phrase appears **only inside T401's own ledger row** (`task-ledger.md:797`).
> It was a second-hand quote with no locatable source — repeated from W1's inbox note without being
> checked. The *substance* stands (T320 does make the guard redundant); the attribution does not.

1. Remove `export const ATTENDANCE_ROW_CAP = 1000;` (`:448`) and its doc comment, which explicitly
   says *"T320 (loader-side `.range()` pagination) removes the need for it entirely."*
   **Careful:** that comment is the **second** of two stacked jsdoc blocks. The first (`:435-438`)
   documents `AttendanceLoadState` and **must stay**; delete only `:439-447`.
2. Remove the `if (rows.length >= ATTENDANCE_ROW_CAP) { ...error... return; }` block (`:547`), so a
   resolved load goes straight to `setAttendanceState({ status: 'success', rows })`.
3. **Leave every other failure path exactly as it is.** The `.catch()` below it, the load-effect
   `isOpen` gate, and T307's block-on-failed-load rule are all still live and still correct. This
   task removes **one** obsolete detector, not T307's fail-closed design.
4. Update the module doc to record *why* it went, citing T320 — do not simply delete the prose.
5. **While that module doc is open, fix one adjacent falsehood** (gate MINOR). The doc at `:582-587`
   still asserts T307's F1b claim — that *"jsdom's `disabled` attribute alone already suppresses a
   dispatched click,"* making the `handleConfirm` guard untestable. **T307's own checker disproved
   that** (`verification-log.md:6461`): Astryx's `Button` guards on the `isDisabled` **prop**, not the
   DOM attribute, and both layers are independently load-bearing. The gate re-proved it live on the
   guard-deleted build — stripping only the button's `isDisabled` clause still blocks the write
   (`writes=0`); stripping both lets one through (`writes=1`). One corrective sentence stops a known
   falsehood propagating out of an Allowed file. This is in scope precisely because §3.4 already
   opens this doc; do not widen further.

---

## 4. THE TRAP — two existing tests depend on this guard; one is rewritten, one is deleted

`MarkEventCompleteDialog.test.tsx` imports the constant (`:21`) and has two tests built on it:

- **`:774`** — builds `ATTENDANCE_ROW_CAP` rows and asserts the write is **blocked**. This is T307's
  F4 test. Its premise is now false.
- **`:812`** — builds `ATTENDANCE_ROW_CAP - 1` rows and asserts the guard is **not** a blanket block.
  Its whole reason to exist is the guard.

**Amending both is authorized here** — Definition of Ready item 5 (`constitution.md:119`) requires
any reversal of previously-passed work to be explicit and authorized, and this packet is that
authorization. It is authorized **narrowly**:

- The `:774` test must be **rewritten, not deleted**, to assert the **opposite**: a 1000-row load now
  reaches `status: 'success'` and the write **proceeds**. That is the behaviour change this task
  exists to make, and it must be pinned by a test, not merely un-asserted. Build its fixture length
  from the **imported** `ATTENDANCE_PAGE_SIZE` (`attendance.ts:303`, already exported, and §2 allows
  importing from that file) rather than a magic `1000` — that ties the fixture to the one remaining
  source of truth for the boundary.
- **Delete the `:812` test.** The gate ruled on this and the reasoning is measurable: with the guard
  gone there is **no length branch anywhere in the component**, so a 999-row load exercises the
  identical unconditional path as the rewritten 1000-row test, and the below-cap write path is
  already pinned four times over by the confirm-flow tests. Any mutation that reddens a 999-row test
  also reddens the 1000-row one, **but not conversely** — a reinstated `>= 1000` guard is caught only
  at 1000. It catches a strict subset. Deleting it is folding, not dropping coverage.
- Remove the now-dangling `ATTENDANCE_ROW_CAP` import at `:21`.
- **Nothing else in the suite may be amended.** If another test reddens, that is a finding — report
  it, do not fix it by editing an assertion.

> ### The trap inside the trap — measured by the gate, and it inverts v1's prediction
>
> v1 predicted **both** tests would redden. **Only `:774` does** (`1 failed | 24 passed`). **`:812`
> stays GREEN, and it stays green *vacuously*.** vite-node resolves the deleted named export as
> `undefined`, so `Array.from({ length: ATTENDANCE_ROW_CAP - 1 })` gets a `NaN` length and builds
> `[]` — the test passes while testing **nothing**.
>
> **Do not read `:812`'s green as evidence it is unaffected.** The only gate that catches the
> dangling import is **`tsc`** (`TS2614`, exit 2). This is this repo's "passes for the wrong reason"
> failure in a new shape: a test that goes *vacuous* rather than red when its premise is deleted.
> **Run `tsc` before you trust any green run in this task.**

---

## 5. Acceptance criteria — each names a mutation that must turn it red

| # | Criterion | Mutation | Gate-measured |
|---|---|---|---|
| **C1** | A load of exactly `ATTENDANCE_PAGE_SIZE` rows reaches `success` and the write **proceeds** | reinstate the `>= ATTENDANCE_ROW_CAP` guard | **3 red** |
| **C2** | A **rejected** load still blocks the write (T307's rule intact) | delete the `.catch()` error branch | **3 red** (F1, F3, throw-path) |
| **C4** | `ATTENDANCE_ROW_CAP` is no longer an export of the module | re-add the export | **1 red** |
| **C5** | *(new)* The **real** `makeLoadAttendanceForSessions`, driven through a paging fake, returns >1000 rows across pages and the write proceeds with provenance intact | reinstate the guard | — build it |

**C3 is DELETED.** The gate confirmed it has no mutation of its own: under C1's mutation the
below-cap confirm-flow tests stayed green, and only generic write-path breakage reddens them — which
reddens pre-existing T127/T307 tests, not C3. A criterion whose only mutation is another criterion's
is not evidence. What it was reaching for is covered by requiring the confirm-flow tests at `:449`,
`:503`, `:546` and `:578` to be **byte-unmodified and green**, which §4's "nothing else may be
amended" rule already enforces and your output must show.

**C4's grep form is struck as self-contradictory** — §3.4 requires prose recording *why* the constant
went, and that prose names it, so a zero-occurrence grep fails on the packet's own required comment.
Use the import form: `import * as Mod from './MarkEventCompleteDialog'` +
`expect(Mod).not.toHaveProperty('ATTENDANCE_ROW_CAP')`. Gate-built and mutation-proven.

**C2 is the one that matters most.** It proves this task removed the obsolete *detector* without
touching T307's fail-closed *design*. Pair it: assert the write did **not** happen **and** that the
load was attempted, so it cannot pass because nothing ran.

**C5 is the criterion the packet was missing, and it is the only one that pins the premise.** C1 as
written is satisfiable with an injected array, which pins the dialog but not the thing this task
actually depends on — that the *real* loader now returns complete data above 1000 rows. The gate
built this proof: 1500 rows over two `.range()` pages (`rangeCalls [[0,999],[1000,1999]]`) resolving
**1500 distinct rows** with a real `qr` / `hoursOverride: 6.5` / check-in row intact. **Reuse
`makePagingClient` (`attendance.test.ts:78-105`)** — an existing in-repo stub for exactly this fake
transport. Roughly 60 lines. It is the only test that would catch a future regression at the
loader/dialog seam.

---

## 6. Harness facts — verify before writing criteria

`MarkEventCompleteDialog.test.tsx` is the file with **no `vi.mock`** — this was established by
T309's premise gate, which caught a packet that had inverted the two dialog test files. **Confirm it
yourself before writing a single criterion** (four consecutive tasks in this project wrote criteria
against an imagined harness). The suite uses raw `createRoot`/`act`; there is no
`@testing-library/react`.

---

## 7. Required worker output

`docs/swarm/active/T401-worker-output.md`: commit SHA plus proof the work is in the **committed
blob**; all six gates with `.env.local` absent against the **measured** baseline (measure it on your
branch point — do **not** copy figures from another packet, they go stale within hours in this repo);
every mutation run with real red output pasted; what you did about the `:812` test and why; and
anything in this packet that is wrong.
