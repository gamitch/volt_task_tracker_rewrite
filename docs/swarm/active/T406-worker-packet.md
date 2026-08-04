# T406 — worker packet **v2**: narrow `markDayComplete`'s attendance write so a concurrent scan survives

**Tier: HEAVY** (constitution item 26). **Stated and defended:** this changes **what columns reach a
write on the `attendance` table** — the exact surface T305 and T307 were created to stop destroying.
Item 26's trigger question, *can a mistake here corrupt data?*, is **yes**: narrow the wrong column and
the dialog stops recording something it should; narrow none and a student's real check-in stays
clobberable. Packet → premise gate → worker → checker, with the orchestrator replaying every mutation.

**v2 supersedes v1 after the premise gate returned REVISE** (round 1 of item 19a's two) with two
MAJORs, four MINORs and a NIT. **The load-bearing premise in §6 is now PROVEN and you do not have to
re-derive it.** Both MAJORs were independently re-verified by the orchestrator before this rewrite.

**Branch:** `claude/t406-attendance-toctou`, from current `main` **`fa93516`**. (v1 said `2a8f237`;
the seven intervening merges touch no in-scope file, but a fresh base keeps the six gates and C6's
hash comparison unambiguous.)

**Measure your own baseline.** For orientation only, `main` at `fa93516` stands at `tsc` 0 · eslint
**0 errors / 364 warnings** · vitest **78 files / 1951 tests** — that figure is measured on current
`main`, not the stale 1944 v1 quoted. **Re-measure and report yours.**

---

## 1. The defect

`markDayComplete`'s batch `upsertAttendance` (`loaders/outreach.ts`, file-local — **grep the name, do
not trust a line number**) sends a **full-column payload** under
`{ onConflict: 'session_id,student_id' }`:

```ts
session_id, student_id, status, check_in_at, check_out_at,
hours_override, method, recorded_by, updated_at
```

**`markDayComplete` has THREE call sites, not one** — v1 said "its only caller" and that was false:

| Call site | Shape |
|---|---|
| `MarkDayCompleteDialog.tsx:540` (import), default prop | the single-session dialog |
| `OutreachDetail.tsx:2498` | the page wrapper that composes the refetch |
| `MarkEventCompleteDialog.tsx:234`/`:460` | **bulk mode's `onMarkSessionComplete` default** |

All three originate in dialogs that carry recorded values through (T305/T307), so **nothing is lost in
normal use on any path** — and the narrowing closes the same load-once/write-later race in bulk mode
for free.

The exposure is a **TOCTOU**: the dialog loads attendance **once on open** and `handleSubmit` writes
that same snapshot. Any row written in between is overwritten.

**The concrete case, in the owner's terms:** a student scans the QR kiosk while the coach has the
dialog open. The scan writes a real `check_in_at`. The dialog then writes its pre-scan snapshot over
it. The check-in is silently gone. **The gate reproduced this against a real database** (§6, E4):
`before = 2026-08-04 14:07:33+00` → `after = NULL`.

---

## 2. Allowed Files

```
src/lib/supabase/loaders/outreach.ts
src/lib/supabase/loaders/outreach.test.ts
src/pages/outreach/MarkDayCompleteDialog.tsx        (only if §4 proves it necessary — the gate
                                                     assessed it likely needs no edit)
src/pages/outreach/MarkDayCompleteDialog.test.tsx
```

**Forbidden:** `src/lib/supabase/loaders/attendance.ts` (**W1's** — import only),
`supabase/migrations/**` (**do not add a migration** — see §5), **`MarkEventCompleteDialog.tsx` and
`MarkEventCompleteDialog.test.tsx`**, `src/pages/checkin/**`, `LiveConsole.tsx`, `Kiosk.tsx` (W1),
`src/pages/home/**` (W5), `pages/reports/**` (W4).

> **`MarkEventCompleteDialog` is forbidden but is a real caller.** Its bulk path flows through the
> write you are narrowing. **Your output must state that**, and must confirm
> `MarkEventCompleteDialog.test.tsx` **stays green with zero edits** — it asserts the **camelCase**
> payload, which does not change (see §4's snake_case-only rule). If it reddens, stop and report:
> that means you narrowed the wrong layer.

---

## 3. The owner's decision

`auto-mode-decisions.md`, **"2026-08-03 — George lifts the T406 hold and picks the approach"**. Cite
that file, never this paraphrase.

**Narrow the write.** He chose it over re-reading at submit, and the reasoning is recorded: re-reading
*adds* a round trip and a new failure mode and only shrinks the race window, whereas narrowing removes
the possibility — **you cannot overwrite a column you never send.**

---

## 4. What the schema permits — verified by execution, not by reading

| Column | Constraint (`20260717000000_scheduling_attendance.sql`) | Action |
|---|---|---|
| `check_in_at` | nullable, no default | **DROP from the payload** |
| `check_out_at` | nullable, no default | **DROP from the payload** |
| `updated_at` | `not null default now()` | **DROP** — W1's `trg_attendance_touch_updated_at` (`20260803000000_simplify_attendance_audit.sql:78-83`, `before insert or update`) sets it on both legs. The gate observed an explicitly-sent stale value being **overwritten by the trigger** (§6, E2), so the dialog's explicit value is literally dead weight |
| `method` | **`not null`, NO default** | **KEEP — dropping it breaks every INSERT** |
| `status`, `recorded_by`, `hours_override` | — | **KEEP** — these are the coach's actual gesture |

**On INSERT** (a student with no prior row) the dropped columns land as `NULL`, which is correct: a
coach-marked student who never scanned genuinely has no check-in time. **On UPDATE** (the conflict
path) unsent columns are left untouched — **proven in §6, not assumed.**

### NARROW THE snake_case DB MAPPING ONLY

**This is a MINOR from the gate and it is easy to get wrong.** Narrow the snake_case object literal
built inside `upsertAttendance`. The camelCase `OutreachAttendanceWriteRow` / `AttendanceWriteRow`
types and **both row builders keep `checkInAt` / `checkOutAt`** — forbidden-file tests assert them at
the payload level (`MarkEventCompleteDialog.test.tsx:1025-1030`), and C6 requires the builders be
byte-identical anyway.

### The batch-uniformity trap — reproduced, with its mechanism pinned

PostgREST upserts an **array**, and `@supabase/postgrest-js` v2.110.7 sets the request's `columns=`
to the **union of `Object.keys` across all rows** (`PostgrestQueryBuilder.ts:1403-1409`, and the
orchestrator re-read that source independently). A key missing from *some* rows is therefore still in
the union, and those rows get **null-filled**. The gate reproduced exactly that (§6, E5).

**So the narrowing must be uniform across every row in the batch.** A heterogeneous batch is this bug
in a new costume.

### The shipped precedent — cite it, do not re-derive it

W1's `makeSetAttendanceStatus` (`attendance.ts:466-499`) is **the same payload-omission fix on the
same table**, T403-gate-proven the same way, and `attendance.ts:163-174` records why omission beats
read-modify-write (no extra round trip, no new TOCTOU window). You are applying a shipped pattern.

---

## 5. What this does NOT fix — say so, do not imply otherwise

**`method` cannot be dropped**, so a concurrent scan's `method: 'qr'` **can still be clobbered** by the
dialog's stale snapshot. The gate observed this live in E1 (`qr` → `coach` in the same run that
preserved `check_in_at`). The student's real `check_in_at` survives — the harm the owner described —
but the provenance that they scanned rather than being coach-marked does not.

**This is a partial fix and the ledger row and your output must both say so.** Closing the `method`
half needs either a schema default (a migration on a table W1 owns) or an insert/update split (which
re-introduces the multi-step shape T327 exists to avoid). Neither is proportionate for a provenance
flag on a ~20-student team (item 25). **The orchestrator files the residual; you do not build it, and
you do not add a migration.**

---

## 6. The load-bearing premise — ALREADY PROVEN. Do not re-derive it; quote it.

v1 required the gate to prove that **a PostgREST upsert with a narrowed column list leaves the unsent
columns untouched on the conflict path** — because if that were false, this fix would null
`check_in_at` for every student on every day-completion, strictly worse than the bug.

**The gate proved it by execution** against a scratch **PostgreSQL 16.13** loaded with this repo's real
migrations, cross-checked against the installed client source and PostgREST's own
`mutatePlanToQuery` (`DO UPDATE SET c = EXCLUDED.c` for the payload-derived column list only; an unsent
column never appears in `SET`).

| | Result |
|---|---|
| **E1** conflict path preserves the unsent column | seeded `check_in_at = 2026-08-04 14:07:33+00`, `method='qr'`; after the narrowed upsert `check_in_at` **survived** (`method` → `coach`, §5's residual) |
| **E2** trigger fires on the UPDATE leg | `updated_at` `04:21:50.704679` → `04:21:50.758965`; an explicitly-sent stale value was **overwritten by the trigger** |
| **E3** `method` cannot be dropped | `ERROR: null value in column "method" ... violates not-null constraint` — and **on BOTH legs**, not just INSERT: PostgreSQL checks NOT NULL on the candidate tuple before conflict arbitration. **Stronger than §4 claims**, so no future "conflict-path-only" shortcut is available either |
| **E4** the defect, reproduced | current full-column payload + stale snapshot: `14:07:33+00` → **NULL** |
| **E5** batch-uniformity trap, reproduced | heterogeneous batch → row A `check_in_at NULL`, clobbered by union-columns null-fill |
| **E7** the fix end-to-end, mixed batch | conflict-leg row kept its scan **and** took the coach's `status`/`hours_override`; insert-leg row correct with NULL check-in |

**The full report with raw output is `docs/swarm/active/T406-gate-report.md` on `claude/t406-gate`.**
Quote E3 in your output for C3's database half. **Do not stand up a database yourself** — that work is
done, and redoing it is not what this task needs.

---

## 7. Protections that must survive — verify, do not assume

The gate confirmed all four still say what v1 claimed:

- **T305** — the dialog seeds from recorded attendance and carries provenance through. Narrowing makes
  the *timestamp* carrying redundant; it must not break the *seeding*.
- **T307** — a failed/truncated load blocks the write. Untouched by this task; confirm it still does.
- **T309** — unchecking writes `status: 'absent'` through **this same payload**. Whatever shape you
  choose must be right for absence rows too, and `buildAttendanceWriteRows` must stay
  **byte-identical** (shared with `MarkEventCompleteDialog`'s bulk mode, which has no uncheck UI).
- **T327** — attendance is written **before** the status flip, and the adult-volunteer read-modify-write
  stays **last**. Do not reorder anything. (Order tests already exist at `outreach.test.ts:474`, `:520`.)

---

## 8. Acceptance criteria — each names a mutation that must turn it red

| # | Criterion | Mutation |
|---|---|---|
| **C1** | The payload no longer contains `check_in_at`, `check_out_at` or `updated_at` | re-add any one of them |
| **C2** | A row written **between** load and submit keeps its `check_in_at` after the dialog's write — **asserted on post-write ROW STATE** | see the two mutations below |
| **C3** | A student with **no** prior row still gets a correct row written (INSERT leg), carrying `method` | drop `method` — **must turn red on the INSERT-leg row assertion** (the fake's inserted row carries no `method`). The database-level `not null` proof is the gate's **E3**, quotable; vitest has no Postgres to raise 23502 |
| **C4** | `status`, `hours_override` and `recorded_by` still reach the write | drop each in turn |
| **C5** | T309's absence rows go through the narrowed payload unchanged | revert `buildAttendanceAbsenceRows`' contribution |
| **C6** | `buildAttendanceWriteRows` is **byte-identical** to `main` | verify by **sha256** of the extracted function, comparing against **`fa93516`** — record that SHA in your output |
| **C7** | T327's ordering is unchanged — attendance before the flip, adult totals last | move the adult-volunteer step above the flip |

### C2 is the criterion this task exists for, and v1's version did not discriminate

**The gate's MAJOR-2, and the orchestrator confirmed it.** v1's named mutation ("re-add
`check_in_at`") *also* reddens a plain payload-keys assertion — so a worker could satisfy C1 and C2
with one shape assertion and both mutations would pass the letter of §8. **A shape assertion is a
call-shape check and proves nothing about the outcome**; that is the "passes for the wrong reason"
trap this repo has shipped 7+ times.

**Required shape for C2:** drive `makeMarkDayComplete` (or the dialog) against a **stateful fake
client** whose `upsert` models the semantics proven in §6 — merge into an in-memory row store using
the **union of keys across the batch**, with a key missing from the union's rows landing as `NULL`
(E5's semantics). Then **assert the post-write row state**: the store's row still has
`check_in_at` equal to the mid-race scan time. **Never assert on `mock.calls`.**

**C2 carries two mutations, and the second is the discriminating one:**

1. re-add `check_in_at` to the payload — the bug, reproduced;
2. **re-add `check_in_at` to only a SUBSET of the rows** (e.g. absence rows) while the rest stay
   narrowed — the union-columns fake null-fills the scanned row and **C2 must go red**. A shape
   assertion cannot catch this; only an outcome assertion can.

---

## 9. Harness facts — verify before writing a criterion

`outreach.test.ts` gained a paging fake in T402 (`makePagingClient`-style) and is the natural home for
loader-level criteria — **and for C2's stateful fake.**

`MarkDayCompleteDialog.test.tsx` **partial-mocks the attendance seam** at its top (`:50`) and
**several existing tests already assert the call — 9 at last count**, not v1's "four". The gate
confirmed which file is which: `MarkEventCompleteDialog.test.tsx` has **no** `vi.mock` (`:114`).
T309's inversion is **not** repeated in this packet — but **open both and confirm it yourself.**

One existing snake_case assertion, `MarkDayCompleteDialog.test.tsx:1304-1318`, **will genuinely
redden** — it is in an Allowed File and you should update it. That is expected, not a finding.

---

## 10. Required worker output

`docs/swarm/active/T406-worker-output.md`:

1. **Commit SHA**, plus proof the work is in the **committed blob** (item 21).
2. **All six gates** against your own measured baseline, `.env.local` absent. Assert the **exit code**
   of the targeted run.
3. **Every mutation in §8, run, with real red output pasted** — including **both** of C2's, and C6's
   sha256 pair.
4. **§2's bulk-path statement**: that `MarkEventCompleteDialog`'s bulk mode flows through the narrowed
   write, and that its test file stays green with **zero** edits.
5. **§5 restated in your own words**, so the partial nature of this fix is on the record twice.
6. **Anything in this packet that is wrong.** v1 carried two MAJORs, four MINORs and a NIT, all caught
   by the gate. v2 folded them in — but assume it has its own. Finding one is a success.
