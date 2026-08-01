# T307 — "Mark event complete" must stop destroying recorded attendance

**Packet v1.** Written 2026-08-01 while T305's worker was in flight.

**Branch:** `claude/t307-bulk-complete-preserve` — cut fresh **from `claude/t305-attendance-over-rsvp`
after T305 merges**, not from `main`. See §1: this task is unimplementable before T305 lands.
**Worker tier:** sonnet. Item 18's four triggers do not fire — no migration, no RLS, no
`security definer`, no metric SQL, no auth/role logic.
**Checker:** `checker-reviewer` (opus) — a write path that destroys real data today.
**Gate:** **light, one round** (item 19b). This packet rolls out a pattern T305's two full gate
rounds already verified by execution — the load seam, the preservation matrix, and
`resolveAttendanceWriteMethod` delegation are all settled. The gate should check §3's **failure
rule** and §4's **seeding decision**, which are genuinely new, and not re-audit T305's mechanics.

---

## 1. Hard dependency on T305 — read before planning anything

**Do not start this task until T305 has merged.** T305 changes
`buildAttendanceWriteRows(sessionId, checkedStudentIds, hoursOverrideByStudentId, recordedBy,
recordedRows)` — the required fifth parameter is the whole mechanism this task depends on, and
T305's own §5.1 already edits `MarkEventCompleteDialog.tsx:187` to pass an **empty** map there with
a comment naming this row.

**Your job is, in essence, to replace that empty map with real rows** — plus the load seam and
failure rule needed to obtain them honestly. If you are reading this and `buildAttendanceWriteRows`
still takes four parameters, stop: T305 has not landed and this packet does not apply yet.

---

## 2. The defect — live today, one click, no coach intent

`buildMarkEventCompletePayload` (`MarkEventCompleteDialog.tsx:176-192`) seeds its attendance rows
from `computeInitialAttendedStudentIds` — **`going` RSVPs** — and passes them to
`buildAttendanceWriteRows` with an empty hours map (`:187`). Each payload goes to `markDayComplete`,
whose upsert (`loaders/outreach.ts:1136-1152`) names `check_in_at`, `check_out_at`,
`hours_override`, `method` and `recorded_by` and passes `{onConflict: 'session_id,student_id'}`
with **no `ignoreDuplicates`** (`:1150`) — a full-column overwrite.

Payload captured from the real loader over a stubbed transport, by T305's gate:

```
{status:'present', check_in_at:null, check_out_at:null, hours_override:null, method:'coach'}
```

So a student who RSVP'd `going` **and** then checked in by QR — or had hours typed into the
`AttendancePanel` — has their check-in/check-out, hours override and QR provenance destroyed the
moment a coach clicks "Mark event complete".

**Why this is a bug and T305's version was latent.** In the per-day dialog nobody with recorded
attendance ever *started* checked, so no row was emitted for them. The bulk path checks everyone
with a `going` RSVP and writes immediately, with no checklist and no review step. **This is the
owner's own workflow** — T305 was filed off a screenshot of him typing 3 h into that panel.

**Sibling precedent, in-repo:** `makeUpsertAttendance` (`loaders/attendance.ts:293-327`) omits
`check_in_at`/`check_out_at` from its payload *on purpose* — its own doc names this as the
history-preservation mechanism, since Postgrest's `ON CONFLICT DO UPDATE SET` only touches columns
present in the payload. `makeMarkDayComplete` includes them. **You are not fixing that asymmetry in
the loader** (see §6); you are supplying real values so it stops mattering.

---

## 3. The load seam, and the failure rule that is NOT T305's

`MarkEventCompleteDialogProps` gains `loadAttendance?: LoadAttendanceForSessionsFn`, defaulting to
the real `loadAttendanceForSessions` (`loaders/attendance.ts:228`, `:266`). Same real-default
injectable convention as `onMarkSessionComplete = markDayComplete` (`:291`) in this same component.

- Load **once for all `remaining` session ids** — `partitionEventSessions(sessions)`'s `remaining`,
  not every session and not one call per session. `skipped` sessions are never written to.
- Load on the open transition. This component already has the right effect and the right key:
  `useEffect(… , [isOpen, sessionsKey])` at `:320-328`, where `sessionsKey` is the deliberately
  stable primitive built at `:319`. **Reuse `sessionsKey`; do not key on the `sessions` array
  reference** — the comment at `:315-318` records why (callers rebuild it every render).
- Mirror `useAttendanceLoadState` (`AttendancePanel.tsx:528-554`) for the `isMounted` guard and the
  `.then`/`.catch` shape. Unlike T305, you **do** want something close to its three-state union.

### The failure rule — the single most important line in this packet

**A load that is in flight or has failed must BLOCK the write. It must never fall back to
RSVP-only seeding.**

T305's per-day dialog is allowed to fall back, and its packet says so. **Do not copy that.** The
reason the two differ is not style:

| | per-day dialog (T305) | bulk dialog (this task) |
|---|---|---|
| shows the coach who will be marked present | yes, an editable checklist | **no** |
| coach can correct a bad seed before writing | yes | **no** |
| falling back on load failure means | a degraded *display* the coach reviews | **silently destroying rows** |

Falling back here would reintroduce the exact bug this task exists to fix, on the exact path where
nobody can catch it. Concretely:

- **Loading:** confirm action disabled, with honest text saying attendance is still loading. Not a
  bare spinner over the whole dialog — the people-reached inputs stay usable.
- **Error:** confirm action disabled, a real `Banner` with `status="error"`, DES-16-style copy
  saying what happened and what to do next, and a **retry** that re-runs the load. The coach must
  not be able to write through this state.
- **Success:** rows available; confirm enabled.

This is constitution item 12's four-states requirement applied to a nested async region — the same
"second, smaller DES-12 seam" shape `AttendancePanel`'s own load state uses, and its comment at
`:515-521` is the precedent to cite.

**Disclose the asymmetry in the module doc**, explicitly naming T305's opposite choice and why, so
the next reader does not "harmonise" them.

---

## 4. Seeding — an orchestrator decision, not the owner's

`buildMarkEventCompletePayload` gains a recorded-rows parameter and threads it to
`buildAttendanceWriteRows`. That alone stops the destruction. The open question the ledger flagged is
whether the bulk path should **also seed from recorded attendance** the way T305's dialog now does —
i.e. write a `present` row for a student who has recorded attendance but never RSVP'd.

**Decision: yes, seed from recorded attendance, using T305's rule.** Recorded row → included iff
`isAttendingStatus(row.status)`; no row → included iff a `going` RSVP exists.

**This is the orchestrator's call, recorded as such — the owner has NOT ruled on it.** His T305
ruling (`auto-mode-decisions.md`, 2026-08-01) is written in display terms (*"where a screen currently
shows RSVP intent … show what was actually recorded"*) and this dialog shows no checklist, so the
ruling does not cleanly reach it. Reasoning, so he can overrule cheaply:

1. **Cost is near zero once the rows are loaded.** With preservation in place, a student with a
   recorded row is written back exactly as they already are — the upsert is effectively a no-op for
   them.
2. **Not doing it creates a two-paths-two-answers defect,** which is the family that produced T188
   and T303. The per-day and bulk paths would disagree about who attended the same session.
3. **A recorded `absent` must still be excluded**, exactly as in T305 — `isAttendingStatus` is
   `'present' || 'late'` (`AttendancePanel.tsx:308`). Do not re-derive it; import it.

**Still NOT authorized, and for the same in-repo reason as T305:** writing `rsvps` rows from
attendance. `OutreachList.tsx:1685-1687` carries the T121 checker's *"RSVP is intent, not a real
attendance record."*

---

## 5. Acceptance criteria

Each names the mutation that must turn it red. Paste the real red output. **A criterion whose
mutation leaves the suite green is not evidence — report that instead of shipping it.** Four
criteria were caught this way across T305's two gate rounds.

**Mock-hardening (T305's hard-won lesson):** any criterion asserting behaviour that a *failed* load
also produces must additionally assert the loader was called — otherwise a mock that never
intercepts passes it silently. Criteria written as direct pure-function calls need no hardening and
cannot be hardened.

- **P1** — A student recorded `present` / `qr` / `hoursOverride: 3` / both timestamps set, who also
  RSVP'd `going`: the emitted payload carries **all five** through unchanged.
  **Five mutations**, one per field. *(This is the bug. It is the reason the row exists.)*
- **P2** — A `going`-RSVP student with **no** recorded row is written exactly as today:
  `status: 'present'`, `checkInAt`/`checkOutAt` `null`, `method: 'coach'`, `hoursOverride: null`.
  **Mutation:** `method: resolveAttendanceWriteMethod(existing?.method ?? 'qr')`.
  *This is the criterion `MarkEventCompleteDialog.test.tsx:206-216` currently pins; expect to extend
  that test rather than duplicate it.*
- **P3** — A student with a recorded **attending** row and **no RSVP** is included.
  **Mutation:** revert to RSVP-only seeding. *(§4's decision; if the owner overrules, this criterion
  inverts and P4 stands unchanged.)*
- **P4** — A student with a recorded **`absent`** row who RSVP'd `going` is **excluded**.
  **Mutation:** treat any recorded row as attending.
- **F1** — Load **rejects**: the confirm action is **disabled**, an error `Banner` is shown, and
  `onMarkSessionComplete` is called **zero times**. **Mutation:** fall back to RSVP-only seeding and
  proceed. *Assert the call count — "no rows destroyed" is only provable by the write never firing.*
- **F2** — Load **in flight**: confirm disabled, `onMarkSessionComplete` called zero times.
  **Mutation:** enable confirm while loading.
- **F3** — Error state's **retry** re-runs the load, and on success the confirm becomes enabled.
  **Mutation:** make retry a no-op.
- **L1** — `loadAttendance` is called **once**, with **exactly the `remaining` session ids** — not
  `skipped` ones, not one call per session. **Mutation:** pass `sessions.map(s => s.id)`. Requires a
  fixture with at least one already-`completed` or `canceled` session.
- **B1** — The per-session outcome tracking, sequential ordering and partial-failure summary are
  unchanged. **Mutation:** any change to the `for (const session of remaining)` loop's ordering.
  *This component's existing tests cover the batch semantics; do not regress them.*

---

## 6. Out of scope — report, do not fix

- **`loaders/outreach.ts`.** The root asymmetry (§2) is that `makeMarkDayComplete`'s upsert names
  `check_in_at`/`check_out_at` at all, where `makeUpsertAttendance` deliberately does not. Removing
  them would be a smaller fix than this whole packet — **and it is still wrong to do here**, because
  it orphans `OutreachAttendanceWriteRow.checkInAt`/`checkOutAt`, and a payload field the loader
  silently ignores is its own lie. Removing them *properly* changes `MarkDayCompletePayload`'s
  shape, which reaches T305's dialog, both test files and `OutreachDetail.tsx`. **File it as a
  follow-up**; do not touch the loader.
- **`loaders/outreach.ts:125-128`** — *"`checkInAt`/`checkOutAt` pass through as `null` verbatim"*,
  false after T305 and doubly so after this. Report it with the row above; it is not in your files.
- **T308** — the confirm-label-vs-`v_student_hours` divergence. Filed, unrelated to this surface.

---

## 7. Module-doc claims to correct

T305's §5.1 already corrects `:22`, `:44-51` and `:168-170` in this file. **Verify they landed
before assuming it** — if T305's worker missed one, correct it and say so. Then, newly false after
your change:

- **`:40-51`** (module doc #2(a)) — the whole "no per-session editable checklist is named … writes
  exactly the RSVP-derived default" justification. §4 changes what is written; §3 adds real async
  states. Rewrite it honestly.
- **The load seam and the §3 failure rule need their own module-doc section**, stating the
  asymmetry with T305 explicitly (§3).

---

## 8. Gates — all six, `.env.local` ABSENT

Baselines are **T305's post-merge figures, not the ones in T305's packet** — re-measure them on your
own branch point and report both. At T305's pre-merge base `8ac4150` they were: `tsc` 0 ·
`vite build` ✓ · prettier clean · eslint 0 errors / 360 warnings · vitest 72 files / 1746 tests ·
`MarkEventCompleteDialog.test.tsx` **15 tests**.

```
npx tsc --noEmit                 (expect exit 0)
npx vite build                   (expect success)
npm run format:check             (expect clean)
npx eslint .                     (0 errors; report the count, explain any rise)
npx vitest run                   (report totals against your measured base)
npx vitest run src/pages/outreach/MarkEventCompleteDialog.test.tsx >/dev/null 2>&1; echo $?
npx vitest run src/pages/outreach/OutreachDetail.test.tsx >/dev/null 2>&1; echo $?
```

Both targeted exits must be `0`. **A green pass count with a nonzero exit code is a real failure on
this project** and T305's criterion S4 reproduces it deliberately.

`OutreachDetail.test.tsx` mounts this dialog and already partial-mocks the attendance loader at
`:110-118` with `loadAttendanceForSessions: vi.fn(async () => [])` — a resolved `[]` means "no
recorded rows", so expect it to stay green. **Verify that rather than assuming it**: your §3 failure
rule means a *rejecting* mock would now block writes there, which is a behaviour change that file's
tests could notice.

---

## 9. Allowed files

- `src/pages/outreach/MarkEventCompleteDialog.tsx`
- `src/pages/outreach/MarkEventCompleteDialog.test.tsx`
- `src/pages/outreach/OutreachDetail.test.tsx` (test-only, if §8's verification requires it)
- `docs/swarm/active/T307-worker-output.md` (create)

Everything else Forbidden, including `loaders/outreach.ts`, `loaders/attendance.ts`,
`MarkDayCompleteDialog.tsx`, `AttendancePanel.tsx`, `OutreachDetail.tsx` and all migrations. If you
conclude one must change, **file a dispute rather than changing it.**

Work in your own git worktree (item 23). Stage with explicit pathspecs, never `git add -A` (item 22).
Report the commit SHA and verify HEAD actually moved (item 21). Include a **"Deferred — for the
ledger"** section (item 20) carrying §6's three items. You do not self-certify.
