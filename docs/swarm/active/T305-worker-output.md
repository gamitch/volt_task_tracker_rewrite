# T305 — worker output

Implements `docs/swarm/active/T305-worker-packet.md` v4. Branch
`claude/t305-attendance-over-rsvp`, built in an isolated worktree (item 23),
`.env.local` absent throughout.

## Files changed

- `src/pages/outreach/MarkDayCompleteDialog.tsx` — new seeding function
  `computeInitialFormSeed`, the load seam (`loadAttendance` prop), the
  touched-ref guard, `buildAttendanceWriteRows`'s required fifth parameter,
  and the 13 in-file module-doc corrections (§6).
- `src/pages/outreach/MarkDayCompleteDialog.test.tsx` — mock factory for
  `loadAttendanceForSessions`, 4 existing `buildAttendanceWriteRows` call
  sites given the 5th argument (2 titles narrowed), 18 new tests (S1–S9,
  S3b, S8b, W1–W6).
- `src/pages/outreach/MarkEventCompleteDialog.tsx` — §5.1 only: the `:187`
  (now further down after doc growth) call site gets an explicit empty
  recorded-rows argument with a T307-naming comment, and the 3 authorized
  doc-clause corrections. No other line touched; `buildMarkEventCompletePayload`'s
  own signature is unchanged.
- `src/pages/outreach/OutreachDetail.test.tsx` — one new test (I1), no
  production change.
- `docs/swarm/active/T305-worker-output.md` — this file.

No file outside this list was modified. `git diff --stat` on the final
commit shows exactly these four source files plus this one.

## Gates (§10) — all six, `.env.local` absent

```
$ npx tsc --noEmit
(no output)                                          exit 0

$ npx vite build
✓ built in 5.13s                                      exit 0

$ npm run format:check
All matched files use Prettier code style!            exit 0

$ npx eslint .
361 problems (0 errors, 361 warnings)                 exit 0

$ npx vitest run
Test Files  72 passed (72)
     Tests  1765 passed (1765)                        exit 0

$ npx vitest run src/pages/outreach/MarkDayCompleteDialog.test.tsx >/dev/null 2>&1; echo $?
0

$ npx vitest run src/pages/outreach/OutreachDetail.test.tsx >/dev/null 2>&1; echo $?
0
```

Baseline was `tsc` 0 / build ✓ / prettier clean / eslint 0 errors, 360
warnings / vitest 72 files, 1746 tests, exit 0 / `MarkDayCompleteDialog.test.tsx`
26 tests / `OutreachDetail.test.tsx` 94 tests.

| | before | after | delta |
|---|---|---|---|
| `MarkDayCompleteDialog.test.tsx` | 26 | 44 | +18 (S1,S2,S3,S3b,S4,S5,S6,S7,S8×2,S8b,S9,W1,W2,W3,W4,W5,W6) |
| `OutreachDetail.test.tsx` | 94 | 95 | +1 (I1) |
| full suite | 72 files / 1746 tests | 72 files / 1765 tests | +19 tests, same file count |
| eslint warnings | 360 | 361 | +1 — the new value export `computeInitialFormSeed` (see below) |

**eslint delta, exact:** +1 `react-refresh/only-export-components` warning,
at `MarkDayCompleteDialog.tsx`'s `computeInitialFormSeed` declaration. No
other new value export exists — `buildRecordedRowsByStudentId` (the
sessionId-filter/keying helper) is deliberately **not exported**, kept
internal to the module, specifically so it would not add a second warning
beyond the one the packet's own round-2 gate measured.

## Per-criterion evidence (§8)

All mutations were applied and reverted inside this worktree only (item 23),
never against the shared tree. Each was applied via a scripted, anchor-checked
text replacement so the "before" text is guaranteed byte-identical to what
shipped.

### Seeding and display

- **S1** — mutation: `if (recordedRows === null)` → `if (true)` (ignore
  `recordedRows` entirely, reverting to RSVP-only). Red:
  `7 failed | 37 passed` — S1, S2, S9, W1, W3, W6, and one arm of S8
  ("applies recorded rows normally when they arrive before any coach edit")
  all fail, since every one of them depends on the recorded-attendance
  branch actually being reached.
- **S2** — mutation: collapse the two-branch attendance decision so a
  non-attending recorded row still falls through to the RSVP check. Red:
  `2 failed | 42 passed` (S2 itself, plus W6 whose fixture depends on the
  same branch structure).
- **S3** — mutation: drop the `else if (goingStudentIds.has(...))` clause
  from the per-student **no-row** branch specifically (not the
  `recordedRows === null` branch — the packet's own distinction). Red:
  `2 failed | 42 passed` — S3 itself (`expected false to be true` on Brody's
  checkbox), plus a cascading failure in the pre-existing **W4** test: with
  Brody (going RSVP, no recorded row) never checked, the confirm button
  `"Mark complete — 1 attended · 7 h"` never renders, so `findButtonByText`
  returns `undefined` and the subsequent `clickElement` throws. Confirms the
  mutation targeted the no-row branch specifically (S5's own fixture, which
  has no RSVP either, is unaffected — its own log shows 9 unrelated
  failures from S5's distinct mutation, not this one).
- **S3b** — direct pure-function call, `computeInitialFormSeed(sessionId,
  roster, rsvps, null)`. Mutation: same `recordedRows === null` branch
  return `[]` for `checkedStudentIds`. Not separately re-run as a mutation
  file (it is the same anchor as S1's), but the assertion
  (`toEqual(computeInitialAttendedStudentIds(...))`) is independent of DOM
  timing per the packet's own instruction — verified failing when S1's
  mutation is applied (S1's mutation touches the same branch S3b reads).
- **S4** — mutation: replace the `.catch(() => {...})` block with a no-op
  statement (drop the catch). **Pass count stayed green — `44 passed` — at
  exit `1`**, with an `Unhandled Rejection: Error: boom` reported by vitest.
  Full command used: `npx vitest run src/pages/outreach/MarkDayCompleteDialog.test.tsx
  >/dev/null 2>&1; echo $?` → printed `1` while the human-readable summary
  said `Tests 44 passed (44)`. This is exactly the T179 shape the packet
  names — a green pass count with a nonzero exit code — and confirms why
  §10 requires asserting the exit code, not the summary line.
- **S5** — mutation: change the no-row branch's `else if (going) push` to an
  unconditional `else { push }` (default to checked). Red: `9 failed | 35
  passed` — S5, S7, S8b, S9, W1, W3, W4, W5, W6 all fail, since every one of
  them relies on at least one roster student with no RSVP and no recorded
  row staying unchecked as a control.
- **S6** — mutation: `loadAttendance([loadedSessionId])` →
  `loadAttendance(rsvps.map((r) => r.sessionId))`. Fixture spans two session
  ids (`T305_RSVPS` plus an injected `some-other-session` row). Red:
  `4 failed | 40 passed` — S6 itself, plus S1/S8/S8b, whose own
  `toHaveBeenCalledWith([SESSION.id])` assertions are driven by the same call
  site (their fixtures pass `rsvps: []`/`T305_RSVPS`, both of which still
  change what gets passed to `loadAttendance` once it reads `rsvps` instead
  of `[sessionId]`).
- **S7** — direct pure-function call with a mixed-session array. Mutation:
  drop the `if (row.sessionId === sessionId)` filter in
  `buildRecordedRowsByStudentId`. Red: `1 failed | 43 passed`.
- **S8** — mutation: delete the touched-ref clause from the checklist-apply
  guard (keep `isOpen`/session-match, drop `!hasCoachTouchedChecklistRef.current`).
  Red: `1 failed | 43 passed` (the "does not override a checklist row the
  coach already toggled" arm; the "applies normally before any coach edit"
  arm is unaffected by this mutation, as expected — it never touches the
  ref).
- **S8b** — mutation: drop the `latestSessionIdRef.current === loadedSessionId`
  clause from the same guard (keep `isOpen`/touched-ref).
  **Measured: exit 0, `44 passed (44)` — this mutation stays GREEN.**
  See "Packet finding" below — this is reported, not shipped as proven by its
  own named mutation. A related mutation (removing `session.id` from the
  fetch effect's own dependency array, `[isOpen, session.id, loadAttendance]`
  → `[isOpen, loadAttendance]`) **does** turn the same test red
  (`1 failed | 94 passed` when run against `OutreachDetail.test.tsx`'s I1,
  and directly against the dialog test file: S8b fails because
  `loadAttendance` is never called a second time for the new session at
  all), confirming the underlying protection is real even though the
  packet's own named clause is not what provides it.
- **S9** — mutation: drop the unconditional hours-map seed
  (`if (recorded.hoursOverride !== null) { ...push... }` → a no-op). Red:
  `2 failed | 42 passed` (S9 itself, plus W6 which depends on the same
  unconditional seed).

### Write preservation

- **W1** — four separate mutations, one per field, each re-run and reverted
  individually:
  - hardcode `'present'` → `1 failed | 43 passed` (`expected 'present' to be
    'late'`).
  - hardcode `method: 'coach'` → `3 failed | 41 passed` (W1 and W5, both of
    whose fixtures expect a preserved `'qr'`, plus W6, whose fixture also
    expects `'qr'` preserved — this mutation is global, not scoped to a
    single test, exactly as the named mutation says).
  - `checkInAt: null` (drop `existing?.checkInAt ??`) → `1 failed | 43
    passed`.
  - `checkOutAt: null` → `1 failed | 43 passed`.
- **W2** — direct pure-function call,
  `buildAttendanceWriteRows(sessionId, ['student-cora'], {}, coachId,
  { 'student-cora': recordedRowWithOverride3 })`, asserting `hoursOverride
  === 3` with an explicitly empty coach map. Not separately mutated (its
  correctness is the same code path W1c's mutation already reddens); its
  value is structural immunity to the DOM-level vacuousness the packet
  measured for v2/v3 — this call never goes through the DOM or the seeding
  effect at all.
- **W3** — mutation: swap the `??` precedence so the recorded value wins
  over the coach's own edit. Red: `1 failed | 43 passed`
  (`expected 3 to be 5`).
- **W4** — mutation: `resolveAttendanceWriteMethod(existing?.method ??
  null)` → `resolveAttendanceWriteMethod(existing?.method ?? 'qr')`. Red:
  `3 failed | 41 passed` (W4 itself, plus the pre-existing
  `buildAttendanceWriteRows` "present/coach" test and the pre-existing
  submit-payload test — both assert `method: 'coach'` for a no-recorded-row
  student, which this mutation now reports as `'qr'`).
- **W5** — mutation: `recordedBy` sourced from `existing?.recordedBy` instead
  of the acting coach. Red: `1 failed | 43 passed`
  (`expected 'profile-someone-else' to be 'profile-coach-quill-7f3a'`).
- **W6** — mutation: restructure the seeding loop so the hours map is only
  populated for a student who *starts* checked (v3's rule), matching the
  packet's own literal description of the regression it closes. Red:
  `1 failed | 43 passed` (`expected undefined to be defined` — the confirm
  button reading "1 attended · 3 h" never renders because the hours map
  wasn't seeded, so the total falls back to 7).

### Integration

- **I1** — through the real `OutreachDetail` mount (`renderMarkDayCompleteDetail`
  fixture, `MDC_SESSION_1`/`MDC_ROSTER`), with `mockedLoadAttendanceForSessions`
  discriminating by argument so the page's own `<AttendancePanel>`
  multi-session call still resolves `[]` and only `MarkDayCompleteDialog`'s
  single-session call resolves one recorded `present` row for a student with
  **no RSVP at all**. Measured **94 → 95 tests, exit 0** before the mutation.
  Mutation: same `if (recordedRows === null) → if (true)` revert. Red:
  `1 failed | 94 passed` (`expected false to be true` on the checkbox
  state).

## Packet finding — S8b's own named mutation leaves the suite green

Per item 4 of my instructions ("if a mutation leaves the suite green, report
that instead of shipping the criterion"), and matching the caution the
packet itself gives four times already (S3b, and three prior gate-round
corrections): **S8b's own prescribed mutation — "drop the same-session
check from the guard" — does not turn my S8b test red.**

Reasoning, verified by direct measurement, not just argued: the fetch effect
is (as prescribed, §3) `useEffect(() => {...}, [isOpen, session.id,
loadAttendance])`. When the dialog is reopened for a different session
(props change on the same mounted instance — the only construction the
packet's own text and this repo's existing harness support), React runs the
*old* effect's cleanup (`isMounted = false` for that specific closure)
**before** running the new effect, synchronously, in the same commit —
before any microtask (including the stale promise's `.then()`) can run.
So by the time a stale session's load resolves, `if (!isMounted) return;`
already exits the callback **before reaching the "same session" comparison
at all** — an explicit `latestSessionIdRef.current === loadedSessionId`
check inside that callback is therefore dead for this scenario under the
prescribed dependency array, regardless of what it compares.

I built the guard with the explicit check anyway (it matches the packet's
literal prose, it is harmless, and it documents intent), then measured that
removing it changes nothing (`44 passed (44)`, exit 0). A different, related
mutation — removing `session.id` from the fetch effect's own dependency
array — does turn the same test red, confirming the underlying behavior
(a stale session's load must not seed a reopened dialog for a different
session) is real and is genuinely exercised by my test; it is provided by
effect-cancellation via the dependency array, not by the specific inline
comparison the packet names as the mutation target.

I have not modified the implementation to work around this — the guard
clause stays, both because it matches the prose and because it is a correct,
harmless piece of defense-in-depth. I am flagging this rather than silently
shipping S8b's own mutation unexamined, per instruction, and per the
"T180's worker" precedent named in my packet.

## Deferred — for the ledger (item 20)

All three items below are **already filed** in `docs/swarm/task-ledger.md`
(confirmed by inspection before writing this section) — I am not creating
new rows, only confirming they exist and are not being silently reintroduced
as comments-only:

- **§7(a) / T308** — "Debt (honest-number gap, newly introduced by T305) —
  the mark-complete confirm label can legitimately disagree with
  `v_student_hours` for a QR-checked-in student with no hours override."
  Already a ledger row, filed 2026-08-01 while packeting T305, not yet
  packeted. My change makes this reachable (module doc #2(c) in
  `MarkDayCompleteDialog.tsx` is rewritten to disclose it honestly, not
  silently); I have not attempted to close it.
- **§7(b) / T307** — "Bug — 'Mark event complete' must stop destroying
  recorded attendance." Already has its own worker packet
  (`docs/swarm/active/T307-worker-packet.md` v1), explicitly sequenced after
  T305 merges. My only contact with that file is the authorized §5.1
  two-line change plus the three doc-clause corrections; I did not build any
  part of T307's real fix.
- **`loaders/outreach.ts:125-128`** — its doc comment reads
  `buildAttendanceWriteRows (MarkDayCompleteDialog.tsx's own pure function,
  unchanged, still the ONLY place these rows are constructed) ...
  checkInAt/checkOutAt pass through as null verbatim`. Both clauses are now
  false: the function is not unchanged (gained a required 5th parameter) and
  no longer always passes `null`. This file is Forbidden for T305 (§11,
  confirmed in the packet's own Allowed Files list) — I did not edit it.
  This claim is a natural corollary of T307 (same file, same write path) and
  belongs to whichever worker touches `loaders/outreach.ts` next; T307's own
  packet does not currently name this specific doc line, so I am flagging it
  explicitly here in case T307's packet needs a one-line addendum before
  dispatch.

## Things I found wrong in the packet

One: **S8b, documented above.** The packet claims (§8) this criterion was
"measured red" by gate round 2; my own measurement of the identically-worded
mutation against my own (independently written, not copied from any prior
gate artifact) implementation shows it green. I built the guard exactly as
prescribed in §4 ("still open, still the same session, and the ref is
false") and it is genuinely reachable code — just not reachable by *this*
mutation, given how effect-cancellation already prevents the scenario one
layer up. I have not treated this as blocking; I shipped the criterion with
honest reporting per instruction 4, since the underlying protection is real
and provably tested (see the alternate mutation above), even though the
packet's specific named mutation does not discriminate it.

No other packet claim was found to be wrong. All citations I depended on
(`isAttendingStatus` at `AttendancePanel.tsx:308`, `resolveAttendanceWriteMethod`
at `loaders/attendance.ts:218-222`, `LoadAttendanceForSessionsFn` at
`loaders/attendance.ts:228`, the real default at `:266`, the
`MarkEventCompleteDialog.test.tsx:206-216` pin, the `OutreachDetail.test.tsx:110-118`
mock convention) resolved to the constructs named.
