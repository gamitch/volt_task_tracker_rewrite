# T309 — unchecking a student in "Mark day complete" must actually record the absence

**Branch:** `claude/t309-uncheck-absent` (off `main` = `e76515f`)
**Tier:** **HEAVY** (constitution item 26) — this changes what reaches the `attendance` table.
`WORKFLOWS.md` independently tiers it HEAVY. The diff is small; the tier is not about diff size.
**Gate:** `checker-premise` (fable) · **Worker:** sonnet · **Mutations replayed by the orchestrator**
**Workflow:** W2 (run an outreach event). Row 2 of W2's sequencing, after T193.

---

## 1. The defect

`markDayComplete` (`loaders/outreach.ts:1174-1179`) upserts exactly the rows the dialog hands it, and
`buildAttendanceWriteRows` (`MarkDayCompleteDialog.tsx:706-727`) maps **only `checkedStudentIds`**.
So unchecking a student emits **nothing** for them and their existing `attendance` row survives
untouched. The coach's correction is silently discarded.

**T305 is what made this reachable.** Before it, a recorded student never *started* checked, so there
was nothing to uncheck. After it, recorded attendance drives the checkbox — so unchecking someone
shown as attending reads unambiguously as "they weren't here", and does nothing.

**Mitigated but not fixed today** by the `AttendancePanel` on the same page, whose uncheck path
DELETEs. A coach who notices has a working control a few inches away.

---

## 2. The owner's ruling — record it, do not re-derive it

**Write `status: 'absent'`. Do not delete the row.** (`auto-mode-decisions.md`, 2026-08-02.)

**This does not reverse D-7.** `loaders/attendance.ts:34-50` records George's 2026-07-20 override —
*"As coach I am ultimate authority and should be able to overwrite an RSVP or check-ins"* — under
which T119 removed a `status: 'absent'` branch in favour of an unconditional DELETE. **D-7 is about
authority, not mechanism.** Marking `'absent'` fully preserves it: `v_student_hours` sums
`where a.status in ('present','late')`, so an absent row contributes zero hours exactly as a deleted
row does, and a `qr`-originated row is still overridable. **D-7 governs `AttendancePanel`'s uncheck,
which this task does not touch.**

**Why `'absent'` and not DELETE, stated so it is not re-litigated:** DELETE needs a second write step
in `markDayComplete`, a path already disclosed as non-atomic (module doc #4(c); T327 is the row for
that family). `'absent'` rides the **existing single upsert** — no new writer, no new partial-failure
mode. Nothing on the outreach side renders `absent` distinctly, so the two are indistinguishable to
the coach.

---

## 3. What to build

**One new exported pure function in `MarkDayCompleteDialog.tsx`**, plus a two-line concat at the one
call site. Sketch — match the file's existing style, do not paste verbatim:

```ts
export function buildAttendanceAbsenceRows(
  sessionId: string,
  roster: readonly RosterStudent[],
  checkedStudentIds: readonly string[],
  recordedBy: string,
  recordedRowByStudentId: Readonly<Record<string, AttendanceRow>>,
): AttendanceWriteRow[] {
  const checked = new Set(checkedStudentIds);
  const rows: AttendanceWriteRow[] = [];
  for (const student of roster) {
    if (checked.has(student.id)) continue;
    const existing = recordedRowByStudentId[student.id];
    if (!isAttendingStatus(existing?.status)) continue;
    rows.push({
      sessionId,
      studentId: student.id,
      status: 'absent',
      checkInAt: existing.checkInAt,
      checkOutAt: existing.checkOutAt,
      hoursOverride: existing.hoursOverride,
      method: resolveAttendanceWriteMethod(existing.method),
      recordedBy,
    });
  }
  return rows;
}
```

In `handleSubmit` (`:969-982`), hoist the keyed map to a local (it is currently built inline) and
concat: `attendance: [...buildAttendanceWriteRows(...), ...buildAttendanceAbsenceRows(...)]`.

### The five decisions, each load-bearing

**(a) Iterate `roster`, NEVER `Object.keys(recordedRowByStudentId)`.** A recorded row for a student
**not on this event's roster** must never be demoted. `computeInitialFormSeed` (`:630-661`) also
iterates `roster`, so such a student is never *checked* either — keying off the recorded map would
mark them absent purely for not appearing in a list they were never in. **That is the T307 failure
shape** (fabricating a write from a set the coach never saw) and it must not be recreated.

**(b) `isAttendingStatus(existing?.status)` as a single guard — do NOT add an `existing === undefined`
arm.** `isAttendingStatus` takes `AttendanceRow['status'] | undefined` and returns `false` for
`undefined` (`AttendancePanel.tsx:308-310`), so a separate null-check is **dead code**. T305's gate
measured exactly this: the equivalent guard there could not be reddened by any mutation because it
was unreachable. Import `isAttendingStatus` from `./AttendancePanel` — the file already does this.

**(c) Only `status` changes.** `checkInAt`, `checkOutAt`, `hoursOverride` and `method` carry through
verbatim; `method` via `resolveAttendanceWriteMethod` (provenance preserved — a `qr` row stays `qr`).
Preserving the check-in timestamp is the entire reason `'absent'` was chosen over DELETE.

**(d) `recordedBy` is the acting coach**, not the recorded row's own `recordedBy`. This matches
`UpsertAttendanceParams.recordedBy`'s own doc, `AttendancePanel.tsx:718`/`:791`, and T305's W5. Do
not "fix" it to `existing.recordedBy`.

**(e) The coach's live hours map is deliberately NOT consulted.** `hoursOverrideByStudentId` may hold
an edit the coach typed before unchecking; those hours belong to a student they have now said was not
present. Read `existing.hoursOverride` only.

---

## 4. Forbidden — and one of these is the whole trap

- **Do not modify `buildAttendanceWriteRows`.** Bulk mode (`MarkEventCompleteDialog.tsx:328`) shares
  it, and bulk mode has **no check/uncheck UI at all** (its module doc #2(a)). T309 is *unreachable*
  there — so teaching that shared function to emit absences would fabricate absences from **no coach
  gesture whatsoever**, in the exact path T307 just fixed for destroying rows. Leave it byte-identical.
- **Do not touch `MarkEventCompleteDialog.tsx` or its test.** The byte-for-byte payload pin at
  `MarkEventCompleteDialog.test.tsx:206-216` must stay green **with zero edits**. That is C8.
- **Do not touch `loaders/outreach.ts`.** `markDayComplete` upserts whatever it is given; it needs no
  change. Its `if (payload.attendance.length > 0)` guard now also passes when the only rows are
  absences, which is correct.
- **Do not touch `loaders/attendance.ts` or `AttendancePanel.tsx`.** `attendance.ts` belongs to **W1**
  and is being edited right now in **PR #28** — editing it is a cross-workflow collision. Import from
  it freely; do not modify it.
- **Do not change `AttendanceWriteRow`'s shape.** `status` is already `AttendanceStatus`, which
  includes `'absent'` (`loaders/attendance.ts:152`). No type change is needed.

---

## 5. Acceptance criteria — each with the production-code mutation that must turn it red

Run each mutation, paste the real red output. **A criterion whose mutation leaves the suite green is
not evidence — report that instead of shipping it.**

- **C1** An unchecked student with a recorded `present` row produces exactly one row, `status:
  'absent'`. Assert the whole row object. *Mutation: `return []` from `buildAttendanceAbsenceRows`.*
- **C2** That row carries the recorded `checkInAt`, `checkOutAt`, `hoursOverride` and `method`.
  *Mutation: hardcode `checkInAt: null, checkOutAt: null, method: 'coach'` — the pre-T305 shape.*
- **C3** `recordedBy` is the acting coach. *Mutation: `recordedBy: existing.recordedBy`.*
- **C4/C5** An unchecked student with **no** recorded row, and one whose recorded row is already
  `'absent'` or `'excused'`, both produce **nothing**. Two assertions, one shared mutation:
  *delete the `isAttendingStatus` guard line.* (No-row students then throw on `existing.checkInAt`;
  an error-red is still red, but **assert the already-`absent` case too** so at least one arm fails
  on an assertion rather than a crash.)
- **C6** A student with a recorded attending row who is **not on the roster** produces nothing.
  *Mutation: iterate `Object.keys(recordedRowByStudentId)` instead of `roster`.* This is (a)'s guard.
- **C7** A recorded `'late'` student who is unchecked becomes `'absent'` — `isAttendingStatus` covers
  `late`, and a coach unchecking a late student means the same thing. Covered by C1's mutation; assert
  it separately so the `late` arm is not assumed.
- **C8** `MarkEventCompleteDialog.test.tsx` passes at **25** with **zero edits to any file it owns**.
  Gate-level, reported in §7 — bulk mode's payload is unchanged by construction.
- **C9** **End-to-end through the dialog**, not just the pure function: render, uncheck a student who
  starts checked from recorded attendance, confirm, and assert the object handed to `onMarkComplete`
  contains their absent row alongside the remaining present rows.
  *Mutation: drop the absence spread from `handleSubmit`'s `attendance` array.*
  **This criterion is not optional.** T305's gate measured a pure-function criterion passing while its
  DOM path was dead code; C1–C7 alone cannot detect an unwired function.
- **C10** The confirm label and total hours are **unchanged** by absence rows — an absent student is
  not "attended" and contributes no hours. **Honest framing: this also passes against current code**
  and is a **regression guard**, not a defect discriminator; there is no natural mutation site.
  *Mutation, artificial: pass `payload.attendance.length` to `computeMarkCompleteConfirmLabel`.*

`container.textContent`, never `innerHTML`. Pair presence with absence where both are meaningful —
an absence-only assertion passes for the wrong reason, and this repo has shipped 7+ of those.

---

## 6. The harness reality — verify, do not assume

`MarkDayCompleteDialog.test.tsx` (**46 tests**) has **no `vi.mock`** and renders the dialog at ~13
sites; T305 added a `loadAttendance` seam with a graceful fallback, **so those tests stay green
whether or not the seam is honoured — a green count there proves nothing about the seam.** Any
criterion that needs a controlled recorded-attendance load must inject its own resolving fake and
assert it was called.

**Measure the base yourself on the branch point before writing a line**, and report the real numbers
rather than trusting these. Measured at `e76515f`, `.env.local` absent:

```
tsc --noEmit                        exit 0
eslint .                            0 errors, 361 warnings
vitest run                          75 files, 1821 tests, exit 0
MarkDayCompleteDialog.test.tsx      46
MarkEventCompleteDialog.test.tsx    25
AttendancePanel.test.tsx            41
```

Expect eslint warnings to rise by **1** for one new value export; report and explain any other rise.

## 7. Gates — all six, `.env.local` ABSENT, report every one

```
npx tsc --noEmit
npx vite build
npm run format:check
npx eslint .            (0 errors; report the warning count, explain any rise)
npx vitest run          (verify the base yourself on the branch point and report the real number)
npx vitest run src/pages/outreach/MarkDayCompleteDialog.test.tsx src/pages/outreach/MarkEventCompleteDialog.test.tsx >/dev/null 2>&1; echo $?
```

A gate omitted from your report is treated as not run.

---

## 8. Allowed files

- `src/pages/outreach/MarkDayCompleteDialog.tsx`
- `src/pages/outreach/MarkDayCompleteDialog.test.tsx`
- `docs/swarm/active/T309-worker-output.md` (create — evidence doc)

Everything else Forbidden. Work in your own git worktree (item 23); do not move the shared
checkout's HEAD. **Commit before running any mutation** — reverting a mutation with
`git checkout --` also reverts uncommitted work (item 26). **Do not commit a `node_modules`
symlink.** Stage with explicit pathspecs, never `git add -A`.

Commit to `claude/t309-uncheck-absent`, push, report the SHA, and include a
"Deferred — for the ledger" section (item 20). You do not self-certify.
