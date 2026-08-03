# T406 — worker packet v1: narrow `markDayComplete`'s attendance write so a concurrent scan survives

**Tier: HEAVY** (constitution item 26). **Stated and defended:** this changes **what columns reach a
write on the `attendance` table** — the exact surface T305 and T307 were created to stop destroying.
Item 26's trigger question, *can a mistake here corrupt data?*, is **yes**: narrow the wrong column and
the dialog stops recording something it should; narrow none and a student's real check-in stays
clobberable. Packet → premise gate → worker → checker, with the orchestrator replaying every mutation.

**Branch:** `claude/t406-attendance-toctou`, from `2a8f237`.

**Measure your own baseline.** `main` moved seven times on 2026-08-03. For orientation only it stood at
`tsc` 0 · eslint **0 errors / 364 warnings** · vitest **78 files / 1944 tests** — **re-measure and
report yours.**

---

## 1. The defect

`markDayComplete`'s batch `upsertAttendance` (`loaders/outreach.ts`, file-local — **grep the name, do
not trust a line number**) sends a **full-column payload** under
`{ onConflict: 'session_id,student_id' }`:

```ts
session_id, student_id, status, check_in_at, check_out_at,
hours_override, method, recorded_by, updated_at
```

Its only caller does a read-modify-write that carries existing values through
(`MarkDayCompleteDialog.tsx`), **so nothing is lost in normal use.** The exposure is a **TOCTOU**: the
dialog loads attendance **once on open** and `handleSubmit` writes that same snapshot. Any row written
in between is overwritten.

**The concrete case, in the owner's terms:** a student scans the QR kiosk while the coach has the
dialog open. The scan writes a real `check_in_at`. The dialog then writes its pre-scan snapshot over
it. The check-in is silently gone.

---

## 2. Allowed Files

```
src/lib/supabase/loaders/outreach.ts
src/lib/supabase/loaders/outreach.test.ts
src/pages/outreach/MarkDayCompleteDialog.tsx        (only if §4 proves it necessary)
src/pages/outreach/MarkDayCompleteDialog.test.tsx
```

**Forbidden:** `src/lib/supabase/loaders/attendance.ts` (**W1's** — import only),
`supabase/migrations/**` (**do not add a migration** — see §5), `MarkEventCompleteDialog.tsx`,
`src/pages/checkin/**`, `LiveConsole.tsx`, `Kiosk.tsx` (W1), `src/pages/home/**` (W5),
`pages/reports/**` (W4).

---

## 3. The owner's decision

`auto-mode-decisions.md`, **"2026-08-03 — George lifts the T406 hold and picks the approach"**. Cite
that file, never this paraphrase.

**Narrow the write.** He chose it over re-reading at submit, and the reasoning is recorded: re-reading
*adds* a round trip and a new failure mode and only shrinks the race window, whereas narrowing removes
the possibility — **you cannot overwrite a column you never send.**

---

## 4. What the schema permits — this decides the design, and it is already verified

| Column | Constraint (`20260717000000_scheduling_attendance.sql`) | Action |
|---|---|---|
| `check_in_at` | nullable, no default | **DROP from the payload** |
| `check_out_at` | nullable, no default | **DROP from the payload** |
| `updated_at` | `not null default now()` | **DROP** — W1's `trg_attendance_touch_updated_at` (`20260803000000_simplify_attendance_audit.sql:78-83`, `before insert or update`) now sets it on both legs, so the dialog's explicit value is dead weight the trigger overwrites anyway |
| `method` | **`not null`, NO default** | **KEEP — dropping it breaks every INSERT** |
| `status`, `recorded_by`, `hours_override` | — | **KEEP** — these are the coach's actual gesture |

**On INSERT** (a student with no prior row) the dropped columns land as `NULL`, which is correct: a
coach-marked student who never scanned genuinely has no check-in time. **On UPDATE** (the conflict
path) unsent columns are left untouched — **and that is the load-bearing assumption of this whole
task, which §6 requires the gate to PROVE rather than assume.**

### The batch-uniformity trap

PostgREST upserts an **array**. Do **not** omit a key on some rows and include it on others — a
heterogeneous batch can null-fill the missing ones, which would be this bug in a new costume. The
narrowing must be **uniform across every row in the batch**.

---

## 5. What this does NOT fix — say so, do not imply otherwise

**`method` cannot be dropped**, so a concurrent scan's `method: 'qr'` **can still be clobbered** by the
dialog's stale snapshot. The student's real `check_in_at` survives — the harm the owner described —
but the provenance that they scanned rather than being coach-marked does not.

**This is a partial fix and the ledger row and your output must both say so.** Closing the `method`
half needs either a schema default (a migration on a table W1 owns) or an insert/update split (which
re-introduces the multi-step shape T327 exists to avoid). Neither is proportionate for a provenance
flag on a ~20-student team (item 25). **The orchestrator files the residual; you do not build it, and
you do not add a migration.**

---

## 6. What the premise gate must PROVE by execution, not reading

**The entire task rests on one claim: a PostgREST upsert with a narrowed column list leaves the unsent
columns untouched on the conflict path.** If that is false, this fix silently nulls
`check_in_at` for every student on every day-completion — strictly worse than the bug.

**Do not take it from documentation.** W1's T403 gate stood up a real PostgreSQL 16 scratch database,
loaded this repo's migrations and ran the exact `ON CONFLICT` statements PostgREST generates. **That is
the standard here.** Failing a real database, prove it against the installed `@supabase/postgrest-js`
by capturing the generated request and the resulting SQL semantics — and say plainly which you did.

Also prove, because both change the answer:
- **The `updated_at` trigger fires on the UPDATE leg**, not just INSERT — otherwise dropping
  `updated_at` leaves it stale on every conflict.
- **`method` genuinely cannot be dropped** — that an INSERT without it violates `not null`.

---

## 7. Protections that must survive — verify, do not assume

- **T305** — the dialog seeds from recorded attendance and carries provenance through. Narrowing makes
  the *timestamp* carrying redundant; it must not break the *seeding*.
- **T307** — a failed/truncated load blocks the write. Untouched by this task; confirm it still does.
- **T309** — unchecking writes `status: 'absent'` through **this same payload**. Whatever shape you
  choose must be right for absence rows too, and `buildAttendanceWriteRows` must stay
  **byte-identical** (it is shared with `MarkEventCompleteDialog`'s bulk mode, which has no uncheck UI).
- **T327** — attendance is written **before** the status flip, and the adult-volunteer read-modify-write
  stays **last**. Do not reorder anything.

---

## 8. Acceptance criteria — each names a mutation that must turn it red

| # | Criterion | Mutation |
|---|---|---|
| **C1** | The payload no longer contains `check_in_at`, `check_out_at` or `updated_at` | re-add any one of them |
| **C2** | A row written **between** load and submit keeps its `check_in_at` after the dialog's write | re-add `check_in_at` to the payload — this is the bug, reproduced |
| **C3** | A student with **no** prior row still gets a correct row written (INSERT leg) | drop `method` — must fail on the `not null` violation, proving §4's claim |
| **C4** | `status`, `hours_override` and `recorded_by` still reach the write | drop each in turn |
| **C5** | T309's absence rows go through the narrowed payload unchanged | revert `buildAttendanceAbsenceRows`' contribution |
| **C6** | `buildAttendanceWriteRows` is **byte-identical** to `main` | verify by hash, not by reading the diff |
| **C7** | T327's ordering is unchanged — attendance before the flip, adult totals last | move the adult-volunteer step above the flip |

**C2 is the criterion this task exists for.** It must simulate the real race — a row appearing after
the dialog's load and before its submit — not merely assert a payload shape. A shape assertion is a
call-shape check and proves nothing about the outcome; that is the "passes for the wrong reason" trap
this repo has shipped 7+ times.

**C6 by hash.** T309's entry records `sha256` of the extracted function at both revisions as the way
this was verified before; reading a diff is not the same claim.

---

## 9. Harness facts — verify before writing a criterion

`outreach.test.ts` gained a paging fake in T402 (`makePagingClient`-style) and is the natural home for
loader-level criteria. `MarkDayCompleteDialog.test.tsx` **partial-mocks the attendance seam** at its
top and **four existing tests already assert the call** — T309's gate caught a packet that had this
file inverted with `MarkEventCompleteDialog.test.tsx` (the one with **no** `vi.mock`). **Open both and
confirm which is which before writing anything.**

---

## 10. Required worker output

`docs/swarm/active/T406-worker-output.md`:

1. **Commit SHA**, plus proof the work is in the **committed blob** (item 21).
2. **All six gates** against your own measured baseline, `.env.local` absent. Assert the **exit code**
   of the targeted run.
3. **Every mutation in §8, run, with real red output pasted.**
4. **Your §6 evidence** — how you proved the partial-upsert semantics, and against what.
5. **§5 restated in your own words**, so the partial nature of this fix is on the record twice.
6. **Anything in this packet that is wrong.** Every recent packet here carried at least one false
   claim caught downstream — a BLOCKER and three MAJORs on T330, an unsourced citation on T401, a
   missing staff gate on T306. Finding another is a success.
