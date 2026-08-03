# T401 — worker packet v1: delete the `ATTENDANCE_ROW_CAP` guard, now a false positive

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
(`loaders/attendance.ts:303-372`) now pages with `.order('id', { ascending: true })` and
`.range(...)`, looping until a short page returns. A resolve of ≥1000 rows now means **the data is
complete**. The guard blocks a legitimate write on a correct load.

**Verified on `dcd0dae` before this packet was written:** the constant and guard are present at
`:448`/`:547`, and the pagination is present at `attendance.ts:303-372`. T320 merged in PR #28.

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

Delete the guard **and** the constant. Per W1's note, the loader is now the single place that knows
about `max_rows`, which is what T320's own ledger row anticipated (*"landing this row deletes that
duplication"*) — it just did not anticipate the deletion landing outside W1's files.

1. Remove `export const ATTENDANCE_ROW_CAP = 1000;` (`:448`) and its doc comment, which explicitly
   says *"T320 (loader-side `.range()` pagination) removes the need for it entirely."*
2. Remove the `if (rows.length >= ATTENDANCE_ROW_CAP) { ...error... return; }` block (`:547`), so a
   resolved load goes straight to `setAttendanceState({ status: 'success', rows })`.
3. **Leave every other failure path exactly as it is.** The `.catch()` below it, the load-effect
   `isOpen` gate, and T307's block-on-failed-load rule are all still live and still correct. This
   task removes **one** obsolete detector, not T307's fail-closed design.
4. Update the module doc to record *why* it went, citing T320 — do not simply delete the prose.

---

## 4. THE TRAP — two existing tests assert this guard, and both must change

`MarkEventCompleteDialog.test.tsx` imports the constant (`:21`) and has two tests built on it:

- **`:774`** — builds `ATTENDANCE_ROW_CAP` rows and asserts the write is **blocked**. This is T307's
  F4 test. Its premise is now false.
- **`:812`** — builds `ATTENDANCE_ROW_CAP - 1` rows and asserts the guard is **not** a blanket block.
  Its whole reason to exist is the guard.

**Amending both is authorized here** — Definition of Ready item 5 (`constitution.md:120`) requires
any reversal of previously-passed work to be explicit and authorized, and this packet is that
authorization. It is authorized **narrowly**:

- The `:774` test must be **rewritten, not deleted**, to assert the **opposite**: a 1000-row load now
  reaches `status: 'success'` and the write **proceeds**. That is the behaviour change this task
  exists to make, and it must be pinned by a test, not merely un-asserted.
- The `:812` test becomes redundant once the cap is gone (there is no cap for it to sit below).
  **Delete it only if** the rewritten `:774` test covers the same ground; if you delete it, say so
  explicitly and justify it. Prefer folding it in over dropping it.
- Remove the now-dangling `ATTENDANCE_ROW_CAP` import at `:21`.
- **Nothing else in the suite may be amended.** If another test reddens, that is a finding — report
  it, do not fix it by editing an assertion.

---

## 5. Acceptance criteria — each names a mutation that must turn it red

| # | Criterion | Mutation |
|---|---|---|
| **C1** | A load of exactly 1000 rows reaches `success` and the write **proceeds** | reinstate the `>= ATTENDANCE_ROW_CAP` guard |
| **C2** | A **rejected** load still blocks the write (T307's rule intact) | delete the `.catch()` error branch |
| **C3** | A load resolving normally (<1000) still writes, unchanged | — regression guard; state honestly if no mutation reddens it beyond C1's |
| **C4** | `ATTENDANCE_ROW_CAP` no longer exists in the module | re-add the export — must fail a grep-style or import assertion, not just typecheck |

**C2 is the one that matters most.** It proves this task removed the obsolete *detector* without
touching T307's fail-closed *design*. Pair it: assert the write did **not** happen **and** that the
load was attempted, so it cannot pass because nothing ran.

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
