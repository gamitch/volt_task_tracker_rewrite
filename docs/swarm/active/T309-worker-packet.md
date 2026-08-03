# T309 — unchecking a student in "Mark day complete" must actually record the absence

**Branch:** `claude/t309-uncheck-absent` (off `main` = `e76515f`)
**Tier:** **HEAVY** (constitution item 26) — this changes what reaches the `attendance` table.
`WORKFLOWS.md` independently tiers it HEAVY. The diff is small; the tier is not about diff size.
**Gate:** `checker-premise` (fable) · **Worker:** sonnet · **Mutations replayed by the orchestrator**
**Workflow:** W2 (run an outreach event). Row 2 of W2's sequencing, after T193.

---

## 0. Gate outcome — packet v2, and what NOT to re-litigate

**Round 1: REVISE (1 MAJOR, 4 MINOR, 1 NIT). All six folded in; this is v2.** The gate did not read
the packet — it **built** the prescription in its own worktree, replayed every mutation, and
re-measured every baseline. **The prescription is therefore known to work before you see it.**

**The MAJOR was §6: v1 described the wrong test file.** See §6 — it is rewritten from measurement.

**Confirmed correct by execution — do not re-derive, re-check, or widen these:**

- **§3 is implementable exactly as sketched inside §8's two Allowed Files.** Measured: `tsc` exit 0,
  `vite build` ok, prettier clean, eslint **+1 exactly** (`react-refresh/only-export-components` on
  the new export), full suite **1830/1830 exit 0**. The verbatim sketch compiles as written —
  `noUncheckedIndexedAccess` is off, so the map index types as `AttendanceRow`.
- **§3(b)'s single guard is right and a separate `existing === undefined` arm would be dead code** —
  confirmed by reading *and* by execution.
- **§4 in full.** Bulk mode genuinely has no uncheck gesture (no `CheckboxList` in the file);
  `buildAttendanceWriteRows` stays byte-identical; C8 passes at 25 with zero edits. Only two
  production call sites exist (`:976` and bulk `:328`).
- **§2's ruling record.** The D-7 quote is verbatim at `attendance.ts:34-50`; `v_student_hours`'s
  `where a.status in ('present','late')` verified at `20260717000003_metric_views.sql:18`;
  `MeetingsList.tsx:937` and `EndMeetingDialog.tsx:432` both check out.
- **Every §6/§7 baseline number**, re-measured independently.
- **Mutations for C1, C2, C3, C4, C6, C7, C9 all discriminate as claimed.**
- **The W1 collision is real** — `origin/claude/w1-checkin` edits `loaders/attendance.ts` (T320).

**A reference implementation exists** on the gate's local branch `gate/t309-premise-verification`
(`2bdb0aa`, unpushed, in its own worktree). You may consult it, but **build and measure your own** —
you are accountable for the numbers you report, and a copied result you did not run is not evidence.

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
`UpsertAttendanceParams.recordedBy`'s own doc, `AttendancePanel.tsx:717`/`:790`, and T305's W5. Do
not "fix" it to `existing.recordedBy`.

**(e) The coach's live hours map is deliberately NOT consulted.** `hoursOverrideByStudentId` may hold
an edit the coach typed before unchecking; those hours belong to a student they have now said was not
present. Read `existing.hoursOverride` only.

### The module-doc corrections this diff owes — five, each verified against the real file

This file's header has been corrected twice already (T305, T307) and is load-bearing. **This diff
falsifies five specific claims. Fix each in place; a stale doc claim is a defect here.**

| Line | Claim today | Why the diff falsifies it |
|---|---|---|
| `:8-9` | *"checked students get `attendance` rows (`method='coach'`, status `present`)"* | **This is a verbatim OUT-05/PRD quote — do NOT edit the quote.** Add a `T309 UPDATE` note beside it, in the existing T305-UPDATE style at `:12-19`. |
| `:90` | *"that coalesce chain's raw inputs **per checked student**"* | Rows are now also written for *unchecked* students. |
| `:132` | *"every value it sums is a value this exact submit is constructing"* | The submit now constructs absence rows the sum deliberately **excludes**. One disclosed sentence — this is C9's label semantics. |
| `:494-499` | `AttendanceStatus` doc: *"this dialog now writes `'late'` too … `'excused'` remains real but not produced by this file"* | Must add `'absent'` to what this dialog writes. |
| `:693` | *"THE ONE place `attendance` rows are constructed"* | There are now **two**. |

---

## 4. Forbidden — and one of these is the whole trap

- **Do not modify `buildAttendanceWriteRows`.** Bulk mode (`MarkEventCompleteDialog.tsx:328`) shares
  it, and bulk mode has **no check/uncheck UI at all** (its module doc #2(a)). T309 is *unreachable*
  there — so teaching that shared function to emit absences would fabricate absences from **no coach
  gesture whatsoever**, in the exact path T307 just fixed for destroying rows. Leave it byte-identical.
- **Do not touch `MarkEventCompleteDialog.tsx` or its test.** The byte-for-byte payload pin — the
  `buildMarkEventCompletePayload` describe at `MarkEventCompleteDialog.test.tsx:244-269` — must stay
  green **with zero edits**. That is C8. (v1 cited `:206-216`, which is the `makeAttendanceRow`
  fixture; that range was inherited stale from T307's packet, as the file's own comment at `:245`
  shows. Do not propagate it further.)
- **Do not touch `loaders/outreach.ts`.** `markDayComplete` upserts whatever it is given; it needs no
  change. Its `if (payload.attendance.length > 0)` guard now also passes when the only rows are
  absences, which is correct.
- **Do not touch `loaders/attendance.ts` or `AttendancePanel.tsx`.** `attendance.ts` belongs to **W1**
  and is being edited right now in **PR #28** — editing it is a cross-workflow collision. Import from
  it freely; do not modify it.
- **Do not change `AttendanceWriteRow`'s shape.** `status` is already `AttendanceStatus`, which
  includes `'absent'` (`loaders/attendance.ts:152`). No type change is needed.

---

## 5. Acceptance criteria — nine, each with the production-code mutation that must turn it red

**v1's C10 was deleted** (item 25) after the gate measured it redundant with C9; its label assertion
is folded into C9. Numbering is otherwise unchanged, so C1–C9 with no C10.


Run each mutation, paste the real red output. **A criterion whose mutation leaves the suite green is
not evidence — report that instead of shipping it.**

- **C1** An unchecked student with a recorded `present` row produces exactly one row, `status:
  'absent'`. Assert the whole row object. *Mutation: `return []` from `buildAttendanceAbsenceRows`.*
- **C2** That row carries the recorded `checkInAt`, `checkOutAt`, `hoursOverride` and `method`.
  *Mutation: hardcode `checkInAt: null, checkOutAt: null, method: 'coach'` — the pre-T305 shape.*
- **C3** `recordedBy` is the acting coach. *Mutation: `recordedBy: existing.recordedBy`* — note this
  is a **vitest-replay-only** mutation: it does not typecheck (`AttendanceRow.recordedBy` is
  `string | null`, `AttendanceWriteRow.recordedBy` is `string`), but esbuild strips types so the
  suite still runs. Replay it under `vitest`, not `tsc`.
- **C4/C5** An unchecked student with **no** recorded row, and one whose recorded row is already
  `'absent'` or `'excused'`, both produce **nothing**. Two assertions, one shared mutation:
  *delete the `isAttendingStatus` guard line.*
  **C5 needs its own fixture roster and this is not optional — measured by the gate.** Under the
  shared mutation a row-less roster student throws first
  (`TypeError: Cannot read properties of undefined (reading 'checkInAt')`), which **masks C5's
  assertion entirely**. So C5's roster must contain **only** students who all have a recorded
  non-attending row — e.g. exactly two, one `'absent'` and one `'excused'`. Over the natural shared
  4-student roster the packet's "at least one arm fails on an assertion" requirement is
  **unmeetable**. C4 crash-reds by design; that is expected and fine.
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
  **C9 also carries the label guard** (v1 had this as a separate C10, deleted per item 25 after the
  gate measured it redundant): locate the confirm button by its **full** label text
  (`Mark complete — 1 attended · 7 h`) and additionally assert that a `2 attended` button is
  **absent**. An absent student is not "attended" and contributes no hours, so the label must not
  move when absence rows are added. The gate measured that C10's own emulated mutation reddens C9
  anyway via the full-label lookup — one criterion, not two.

`container.textContent`, never `innerHTML`. Pair presence with absence where both are meaningful —
an absence-only assertion passes for the wrong reason, and this repo has shipped 7+ of those.

---

## 6. The harness reality — MEASURED by the gate, not assumed

**Packet v1 got this section wrong and described the wrong file. Corrected here; do not work from
memory of it.** v1 claimed `MarkDayCompleteDialog.test.tsx` has no `vi.mock` and that a green count
there proves nothing about the attendance seam. **Both halves are false.**

`MarkDayCompleteDialog.test.tsx` (**46 tests**, ~28 render sites) **partial-mocks exactly this seam**
at `:49-55`:

```ts
vi.mock('../../lib/supabase/loaders/attendance', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase/loaders/attendance')>();
  return { ...actual, loadAttendanceForSessions: vi.fn(async () => []) };
});
```

re-established in `beforeEach` at `:102-103` (`mockReset()` then `mockResolvedValue([])`), and **four
existing tests already assert the call** — S1 (`:679`), S2 (`:694`), S6 (`:771-772`), W3b (`:961`)
all `toHaveBeenCalledWith([SESSION.id])`. **The seam is pinned and a green count there does mean it
was honoured.**

**Use the file's own convention: `mockedLoadAttendanceForSessions.mockResolvedValueOnce(...)`.** Do
**not** invent a second injection mechanism — the one that exists is asserted-on and shared.

It is **`MarkEventCompleteDialog.test.tsx`** that has no `vi.mock` (its own comment at `:105`). v1
inverted the two files.

**Measured by the gate: implementing §3 with ZERO test pinning leaves all 46 existing tests green.**
No existing test pins the old silent-no-op semantics, so **there is no T193-style test adaptation in
this task.** The one plausible pin (`:536`, `toHaveLength(1)`) survives because its scenario has no
recorded rows. Full suite after the gate's reference implementation plus the new criteria:
**1830/1830, exit 0.**

**Measure the base yourself on the branch point before writing a line**, and report the real numbers
rather than trusting these. Measured at `e76515f`, `.env.local` absent, and **independently
re-verified by the gate**:

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
