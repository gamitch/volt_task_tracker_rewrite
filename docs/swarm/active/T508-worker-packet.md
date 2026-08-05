# T508 — worker packet

**Row:** T508 · **Workflow:** W3 (Run a meeting) · **Tier:** HEAVY (constitution item 26 —
this is a write path) · **Branch:** `claude/w3-meeting-workflow-0bl669` off `main` = `6db85c6`

**Worker model tier:** default (sonnet). Item 18's four opus triggers are migrations, RLS /
`security definer`, metric-view SQL, and auth/role logic. **T508 is none of them** — it deletes a
write and gates another behind a checkbox. Do not bump the tier because "write path" sounds
serious; item 25 explicitly retires that reasoning.

---

## §0 — premise gate verdict

**Round 1: REVISE (BLOCKER).** One blocker, two majors, seven minors. The gate built the full
prescription in its own worktrees and ran every named mutation; §3's two refutations were
**confirmed**, and §3g's three-red-tests list was **confirmed complete by execution**.

**Round 2 status: ALL TEN required revisions are applied. ✅ CLEARED FOR DISPATCH.**

The tenth was blocked on the owner and is now resolved. **He re-confirmed the
`LiveConsole.endMeeting.test.tsx` grant at THREE mechanical lines** (2026-08-05 next morning,
`auto-mode-decisions.md`), correcting the two-line count the earlier record carried. §4c is updated.

Two further rulings behind this packet were **re-taken from scratch** in the same exchange, because
their provenance could not be evidenced after a session compaction: **T601 stays closed** (keep
`makeOnEditAttendance` as-is, documented) and **the tally line stays unconditional** (now **C11**).
Both came back identical to the retracted record; the grant count did not. See that file's
"re-taken" section — cite it, not the retracted one above it.

Applied in round 2: §4a.3's untestable no-default criterion replaced with T300's paired `tsc` replay
(now **C10**); **C8 re-sited** where the roster is actually in scope; explicit **Allowed Files**
added; §3e's "~21 tests" corrected to the measured **9**; §3d's past-EOF citation corrected; §3b's
17-row attribution downgraded from established cause to one reachable mechanism; the expected
**eslint delta declared**; the T602 fold extended from two stale ranges to four; and a criterion
added for the owner's unconditional-tally ruling (**C11**).

---

## §1 — Objective

Ending a meeting currently writes a false `absent` record for every roster member nobody marked.
Stop that. Replace the automatic write with an **explicit coach opt-in**, and make the session
summary report **only what was actually marked**.

This is live data corruption: it is writing false records against real students on every meeting
close, right now.

---

## §2 — The owner's ruling (the authority for this row)

`docs/swarm/auto-mode-decisions.md`, 2026-08-05, verbatim:

1. _"i think we should only count 'absent' if i click the pill for absent"_
2. _"it should just say 5 present unless i explicetly mark some as absent"_
3. _"the participation % shouldn't assume everyone is supposed to attend a meeting, even if it's
   scoped to p3. if i have the right tools to indicate absent students then it should use that as
   the calculation."_

And on the rows already written: _"leave as is."_

**The reason is a data-model fact, not a preference, and it decides the design.** The sub-teams that
determine who is expected at a given meeting — business, build, software — are deliberately NOT
modelled and the owner does not want them to be. `events.team_ids` means P3 / Gear Girls, one level
too coarse. So **the expected-attendee set is not derivable from any data this app holds**, and the
coach's markings are the only honest source of truth.

**Ruling 3 is conditional on ruling-item 3 of what was authorised: a one-click bulk control.**
Without it the whole-team case costs one tap per student. Shipping the deletion without the bulk
control silently withdraws the premise W4's T509 depends on. **Both halves ship together or neither
does.**

---

## §3 — Verified premises, and the two the ledger row gets WRONG

Every claim below was checked against `origin/main` with `git show`, not the working tree.
**Two load-bearing claims in T508's own ledger row are false.** Do not build against the row.

### 3a. CONFIRMED — the automatic write exists and is unconditional

- `loaders/endMeeting.ts:376-389` — `backfillAbsences` upserts
  `{status:'absent', method:'coach', recorded_by:null}` with
  `{onConflict:'session_id,student_id', ignoreDuplicates:true}`.
- `:411-414` — it runs as step 1 of **every** `makeOnEndMeeting` call, with no condition.
- Its input is `payload.backfillAbsentStudentIds`, computed by
  `EndMeetingDialog.tsx`'s `computeBackfillAbsentStudentIds` (`:324-331`) via
  `buildEndMeetingPayload` (`:350-361`) — every roster member with no attendance row.
- The "will be marked absent" callout is real: `buildEndMeetingConfirmDescription` (`:443-447`),
  rendered at `:798`.

### 3b. ❌ FALSE — "the roster query has no team filter, it selects `team_id` and ignores it"

**`team_id` is used.** `endMeeting.ts:319-322` filters the roster client-side:

```ts
const teamIds = event.team_ids;
const roster = (studentRows ?? [])
  .filter((student) => teamIds === null || teamIds.includes(student.team_id))
```

`kiosk.ts:456-459` runs the identical filter for the live console. The query
(`queryActiveStudentsForRoster`, `:261-268`) has no team filter **server-side**, which is what the
row misread; the scoping happens after it.

**ONE REACHABLE MECHANISM — not the established cause of the owner's 17 rows.** One layer up,
`ScheduleMeetingsDialog.tsx:541` defaults the team picker to all teams selected, and
`resolveTeamScope` (`:491-500`) converts "all selected" into `team_ids = null`, which means *open to
every team*. A meeting created without narrowing the picker rosters the entire active student body.

⚠️ **The code path is confirmed; the attribution is NOT, and two in-repo records point the other
way.** `task-ledger.md:816` says *"A **P3-only** test meeting"* and the owner himself says *"even if
it's **scoped to p3**"* (`auto-mode-decisions.md:3345`) — and a P3-scoped meeting has **non-null**
`team_ids`, which is incompatible with this mechanism. An earlier version of this packet asserted it
as the cause and it was presented to the owner that way; that was wrong and is corrected here.
**Nothing in §4 changes either way** — the safety conclusion below holds under both readings.

**Why this matters to you and is not pedantry:** do NOT add a team filter to the roster query. It is
already there. The residual hazard is the opposite one — the new bulk control operates on that same
roster, so on a `team_ids = null` meeting one tick covers every active student. **That is why §4's
control must name its count.**

### 3c. ❌ FALSE — "the session summary already reports only what was marked"

Close, but it fails in a way that matters. `computeEndMeetingSummaryCounts` (`:403-413`) iterates
the **roster** and looks each member up:

```ts
for (const entry of roster) {
  const record = attendanceByStudentId[entry.studentId];
  if (record !== undefined) counts[record.status] += 1;
}
```

So a student with a **real** `present` row who is not on the roster is dropped from "5 present".

**This is reachable in one hop, on a write path, verified:** `loaders/selfCheckoff.ts:180-201`
(`makeInsertSelfCheckoff`) `.insert()`s a real `status: 'present', method: 'self'` row into
`attendance` with **no team or roster check anywhere in that file** (grepped: zero occurrences of
`team_id` or `roster`). A student who self-checks-off into a session they are not rostered for has a
real, coach-visible mark that the tally silently drops. **Count the records, not the roster.**

*(A second, weaker route also exists — `v_student_participation`
(`20260722000000_membership_views.sql:59-63`) scopes on `student_teams` ACTIVE memberships while this
roster scopes on the legacy `students.team_id` single FK, so a dual-team student is inside one and
outside the other. That view is a **read**; it creates no rows. Use the `selfCheckoff` route as the
argument — it is a one-hop write.)*

### 3d. TRAP — `onEditAttendance` cannot be reused for the bulk control

It is tempting: `LiveConsole.tsx:1191` already wires it with real coach identity, so reusing it
would need no new seam. **It does not work.** `makeOnEditAttendance` (`endMeeting.ts:448`; the
`.update()` at `:456`, its two `.eq()`s at `:457-458`) is an `.update()` scoped
`.eq('session_id').eq('student_id')`. The students being marked have **no row**, so it updates zero
rows and silently writes nothing. The upsert path is required.

### 3e. TRAP — do not add `useAuth()` to `EndMeetingDialog.tsx`

`app/guards.tsx:339-345` — `useAuth()` **throws** outside an `<AuthProvider>`.
`EndMeetingDialog.test.tsx` renders the dialog bare (`renderDialog`, `:91`, no provider).
**Measured directly on this file at `4115ef4`, in a throwaway worktree: 9 failed / 12 passed of 21.**
An earlier draft said "~21 tests", which was the file's *total* rather than the blast radius; the
other 12 are pure-function tests that never render. Nine red tests for an attribution nicety is
still the wrong trade. See §6 for what to do about `recorded_by` instead.

### 3f. Astryx — `CheckboxInput`, not `Switch`

Both exist in `docs/swarm/astryx-api.md` (the only permitted source, item 2). **`Switch`'s own Best
Practices rule it out**: _"Don't: Use for options that require a form submission to take effect."_
The opt-in takes effect on End meeting. `CheckboxInput` (`astryx-api.md:898`) is the documented fit
— _"opt-in choices"_. Props available and verified: `label` (required), `value` (required),
`onChange`, `description`, `isDisabled`.

### 3g. Three existing tests encode the OLD behaviour and must be re-derived

Measured by running them against a working implementation of §4 — these are the exact three that go
red, and they are **correct to go red**:

| File | Test | Why it fails |
|---|---|---|
| `EndMeetingDialog.test.tsx` | `opens a real AlertDialog with the live tally and disclosure sentences…` | asserts `'1 student has no attendance record yet'` + `'will be marked absent'` |
| `EndMeetingDialog.test.tsx` | `confirming calls onEndMeeting exactly once with the single atomic payload…` | asserts the old payload field |
| `LiveConsole.endMeeting.test.tsx` | `T196 C3 … calls the injected onEndMeeting exactly once with the single atomic payload on confirm` | asserts the old payload field (`EXPECTED_END_MEETING_PAYLOAD`, `:192-197`) |

**A test asserting the defect is not a reason to keep the defect** — but you must update each one
deliberately and say so, never delete one to get green.

---

## §4 — Prescription

### 4a. `EndMeetingDialog.tsx`

1. **Rename** `EndMeetingPayload.backfillAbsentStudentIds` → `markAbsentStudentIds`, and document it
   as "the students the coach EXPLICITLY chose to mark absent; empty unless opted in".
2. **Rename** `computeBackfillAbsentStudentIds` → `computeUnmarkedStudentIds`. Behaviour unchanged —
   it still returns roster members with no record. Computing the set is not acting on it.
3. **`buildEndMeetingPayload` takes a new 4th parameter `markRemainingAbsent: boolean`, with NO
   default.** `markAbsentStudentIds` is `computeUnmarkedStudentIds(...)` when true, `[]` when false.
   The absence of a default is deliberate — `tsc` must force every call site to state the choice.

   ⚠️ **This is verified by C10's PAIRED replay, not by a bare mutation.** Simply restoring
   `= false` leaves the whole suite green at exit 0 with `tsc` clean, because every call site still
   passes the argument — measured. That is precisely T300's C2 vacuity, which an earlier draft of
   this packet cited as a warning and then reproduced. T300's ledger row (`task-ledger.md:233`)
   records the working remedy: assert the *arity error* with a control. See **C10**.
4. **`computeEndMeetingSummaryCounts` drops its `roster` parameter** and iterates
   `Object.values(attendanceByStudentId)` (§3c).
5. **`buildEndMeetingConfirmDescription` takes `markRemainingAbsent: boolean`.** When true:
   `"N student(s) with no attendance record will be marked absent."` When false:
   `"N student(s) have no attendance record and will be left unmarked."` **Never assert the
   marked-absent branch unconditionally** — that sentence *is* the defect in copy form.
6. **Add `buildMarkRemainingAbsentLabel(count: number): string`**, exported. Singular/plural correct.
   Exported so the count-naming requirement is directly testable rather than buried in JSX.
7. **Add state `const [markRemainingAbsent, setMarkRemainingAbsent] = useState(false)`.**
   **MUST default `false`.** Defaulting it `true` restores the exact defect.
8. **Render a `CheckboxInput` in the `data.session.status === 'scheduled'` branch**, only when the
   unmarked count is `> 0`, labelled by `buildMarkRemainingAbsentLabel(count)`, with
   `description="Leave this unticked to end the meeting without recording anything for them."`

   **Placement is forced, not chosen — do not burn a cycle fighting it.** `AlertDialog` takes **no
   children**; its `description` is a required `string` (`astryx-api.md`, AlertDialog Props). The
   checkbox therefore renders **beside the End meeting trigger, inside `EndMeetingDialog.tsx`'s own
   scheduled branch** — not inside the confirm dialog. This needs no `LiveConsole.tsx` change; the
   trigger already lives in this file.
9. Update module doc sections 1 and 3, and add a section 1a carrying §2's ruling and its reasoning.

### 4b. `loaders/endMeeting.ts`

1. Rename `BackfillAbsencesArgs`/`backfillAbsences` → `MarkAbsencesArgs`/`markAbsences`. The upsert
   body is **unchanged** — same columns, same `ignoreDuplicates: true`.
2. **Guard the call:** `if (payload.markAbsentStudentIds.length > 0) { await markAbsences(...) }`.
   **This guard is an acceptance criterion, not an optimization.** Without it the ordinary case
   still issues an `upsert` with an empty row array against `attendance` — a write request the
   ruling says must not happen.
3. Steps 2 (checkout) and 3 (flip) are **unchanged and still unconditional**. Do not reorder them;
   the ordering rationale in the module doc is independent of this row.
4. **Fold T602 while you are here** (it is the same stale text this row makes wrong). The T602
   ledger row cites **four** stale ranges and all four must be corrected — an earlier draft named
   only two:
   - `:8` — `EndMeetingDialog.tsx` called "a frozen, forbidden file".
   - `:12-19` — "NOT wired into `EndMeetingDialog.tsx`/`LiveConsole.tsx`/any route"; the mount "is
     still filed as its own row, T196".
   - `:113-118` — "once T196 wires this factory to a real `useAuth()` ref"; "that wiring is T196's
     job"; "ready when T196 unblocks".
   - `:442-446` — "once T196 wires this factory to a real `useAuth()` ref (**not done by this
     task**)".

   **All false since `6271ac6`** — T196 shipped; `LiveConsole.tsx:1187` mounts the real dialog and
   `:1024` wires `makeOnEditAttendance` with real coach identity. Correct each and say what is true.
   Note T602 as folded in your report.

5. **Carry T601's owner-ruled comment while you are in this file — it has no other home.** T601 was
   CLOSED by owner ruling (`auto-mode-decisions.md`, 2026-08-05 later; `task-ledger.md` row marked
   *"owner ruling, no code"*): `makeOnEditAttendance` is **kept as-is**, and *"a comment at the
   factory records that it is deliberately unreachable rather than drifted-into-dead."* Add exactly
   that at `makeOnEditAttendance` (`:448`). T508 is the only row in flight touching this file; if you
   skip it, the ruling lands nowhere.

### 4c. `LiveConsole.endMeeting.test.tsx` — NARROW GRANT, THREE LINES, OWNER-CONFIRMED

**`LiveConsole.tsx` (source) is FORBIDDEN and the T196 grant is NOT inherited. Its test file holds a
mechanical-fallout grant only.** You may change **exactly these three lines**, all forced by §4a's
signature changes — no new tests, no restructuring, nothing else in the file:

| Line | Change |
|---|---|
| `:195` | `EXPECTED_END_MEETING_PAYLOAD` — rename the field to `markAbsentStudentIds`, set it to `[]` (the checkbox defaults unticked, so a plain confirm writes no absence) |
| `:276` | pass `false` as the new 3rd argument to `buildEndMeetingConfirmDescription` |
| `:396` | `backfillAbsentStudentIds: []` → `markAbsentStudentIds: []`, in the `defaultOnEndMeeting({...})` literal inside `describe("T196 -- the console's production defaults are the real backends")` |

**The third line is the one an earlier grant missed, and the miss was load-bearing.** With only
`:195` and `:276` changed, the gate measured:

```
LiveConsole.endMeeting.test.tsx(399,9): error TS2561:
  Object literal may only specify known properties, but 'backfillAbsentStudentIds'
  does not exist in type 'EndMeetingPayload'. Did you mean to write 'markAbsentStudentIds'?
TSC EXIT=2
```

With all three: **`TSC EXIT=0`**. The owner re-confirmed at three on 2026-08-05 (next morning) after
the miscount was measured — see `auto-mode-decisions.md`'s "re-taken" section.

**If you find yourself needing a FOURTH line here, or any change to `LiveConsole.tsx` source, STOP
and report it.** Do not extend this grant by judgement. It exists in the first place only because
the orchestrator had originally self-authorised it inside this packet, and a cross-workflow reach is
an ASK, never a log entry.

---

### 4d. Allowed Files — the complete list

Nothing outside this list may be edited. Two of these were implicit in earlier drafts and are now
named, because `tsc` fails without them and C1/C2 cannot be written anywhere else:

| File | Scope |
|---|---|
| `src/pages/meetings/EndMeetingDialog.tsx` | §4a, full |
| `src/lib/supabase/loaders/endMeeting.ts` | §4b, full |
| `src/pages/meetings/EndMeetingDialog.test.tsx` | re-derive §3g's two tests; add C3–C9 coverage |
| **`src/lib/supabase/loaders/endMeeting.test.ts`** | **required.** `SAMPLE_PAYLOAD: EndMeetingPayload` (`:453`) carries the renamed field, so `tsc` fails without it — and it is the **only** file with a mutation-recording Supabase stub, so **C1 and C2 can only be written here.** |
| `src/pages/meetings/LiveConsole.endMeeting.test.tsx` | ⛔ **three mechanical lines, BLOCKED — see §4c** |
| `docs/swarm/active/T508-worker-packet.md` | your completion report only |

---

## §5 — Acceptance criteria, each with its named mutation

A criterion whose mutation leaves the suite green at exit 0 is **not covered**, and reporting that
honestly is the correct outcome. Run every mutation in your own worktree (item 23). **Commit before
mutating** (item 26's fast-tier working rule — it applies to anyone mutating).

| # | Criterion | Named mutation that MUST turn it red |
|---|---|---|
| **C1** | Ending a meeting with the box unticked writes **no** `attendance` row of any kind — asserted at the transport, not by reading code | Delete the `length > 0` guard in `4b.2`. The empty upsert is issued; the test must catch the call. |
| **C2** | The checkout and status-flip legs still run when no absence is written | Wrap steps 2+3 in the same guard as step 1. |
| **C3** | `buildEndMeetingPayload(..., false)` yields `markAbsentStudentIds: []`; `(..., true)` yields exactly the unmarked ids | Invert the ternary in `4a.3`. |
| **C4** | The confirm description never claims "will be marked absent" when opted out | Make both branches of `4a.5` return the marked-absent sentence. |
| **C5** | The confirm description DOES state the consequence when opted in | Make both branches return the left-unmarked sentence. |
| **C6** | The checkbox defaults to unticked | Change `useState(false)` → `useState(true)` in `4a.7`. |
| **C7** | The checkbox label names the count | Drop the count from `buildMarkRemainingAbsentLabel`, returning a fixed string. |
| **C8** | The summary counts a real mark for a student who is **not** on the roster — **asserted through `buildEndMeetingConfirmDescription`, which still receives the roster** | Inside `buildEndMeetingConfirmDescription`, re-scope the tally to roster members only, leaving `computeEndMeetingSummaryCounts` untouched. Signature-preserving, so `tsc` stays clean — the test is the only thing that can catch it. |
| **C9** | The summary invents no row for an unmarked student | Seed `counts.absent` from the unmarked count. |
| **C10** | `buildEndMeetingPayload`'s 4th parameter has **no default**, so every call site must state its choice — **paired `tsc` replay, per T300** | **(a)** drop the 4th argument at `EndMeetingDialog.tsx`'s call site → must be `tsc` **exit 2**, `TS2554 Expected 4 arguments, but got 3`. **(b)** control: restore `= false` *with the same omission* → must compile **clean**. Both legs required; (a) alone proves nothing. |
| **C11** | The tally line renders **unconditionally**, including the all-zero `0 present · 0 late · 0 excused · 0 absent` case (owner ruling, 2026-08-05 later: *"one format, always"*) | Make the tally sentence conditional on any count being `> 0`, so the nothing-marked case falls back to prose. |

**Fixture design requirements** (this repo has 7+ recorded assertions that passed for the wrong
reason):

- Give every fixture field a distinct value so a field swap is observable.
- **C8 must be asserted where the roster is still in scope.** After §4a.4,
  `computeEndMeetingSummaryCounts` **never receives a roster array**, so a unit test on it that
  "asserts the student is absent from the roster" is decorative — the array it checks is never
  passed in. Assert instead against `buildEndMeetingConfirmDescription(roster, attendance, false)`,
  which still takes both. Verified: one such line turns the signature-preserving mutation red at
  exit 1, where the roster-shaped unit fixture leaves it green.
- Prefer asserting against the **second** item in a list over the first.
- **C1/C2 must assert at the transport** — the recorded Supabase call — not by inspecting the
  payload object. An empty `upsert` is still a write request; only the stub sees it.

---

## §6 — Known residual, to disclose and NOT fix

`recorded_by` on the bulk-marked rows stays `null`. Now that a coach ticks a box to produce them,
`null` under-attributes: `loaders/attendance.ts` module doc #2 says this column is "always the ACTING
coach's own" id, and marking the same student absent via the console pill **does** attribute.

**Closing it needs the identity passed into the factory, which is a prop change in
`LiveConsole.tsx` — another workflow's file.** Do not reach for it, and do not add `useAuth()` to the
dialog (§3e). The value is unchanged from the backfill it replaces, so this is a pre-existing gap
made visible, not a regression. **Disclose it in your report**; the orchestrator files the row.

**A primitive does exist — this is unavoidable *within this row's file scope*, not in principle.**
`loaders/attendance.ts:495-515` (`makeSetAttendanceStatus`) is an existing `upsert` on
`(session_id, student_id)` that already carries `recorded_by`, and `LiveConsole.tsx` already wires it
with real coach identity. It is correctly out of reach here — `loaders/attendance.ts` is forbidden by
§8 and the seam lives in another workflow's file — so **do not change the prescription.** Stated
plainly so the residual reads as a scope boundary rather than a technical impossibility.

---

## §7 — Gates

Run all of these and report **real** before/after numbers, not "should pass":

```
npx tsc --noEmit
npx eslint .
npm run format:check
npx vitest run
```

**Baseline measured on `6db85c6`:** `tsc` **0** · eslint **0 errors / 365 warnings** ·
`format:check` **clean** · vitest **80 files / 2027 tests, exit 0**. (Independently re-measured by
the premise gate at the same commit; all four figures exact.)

**Expected eslint delta, declared up front: 365 → 366 warnings, still 0 errors.** The one new
warning is `react-refresh/only-export-components` on §4a.6's newly **exported**
`buildMarkRemainingAbsentLabel`, in `EndMeetingDialog.tsx` (11 → 12 for that file). It is a direct
and unavoidable consequence of exporting the helper, which §4a.6 requires so C7 can test it
directly. `format:check` stays clean. **Declaring this now so it is not litigated at review time**
— a warning delta that appears unannounced reads as a regression.

`format:check` is now enforced in CI (T175, PR #91) and is scoped to `src/**` — the
`docs/swarm/*.md` files still fail prettier and that is **pre-existing and out of scope**. Do not
reformat them; it collides with every other machine.

---

## §8 — Do not

- Do not touch `LiveConsole.tsx` source, `pages/checkin/**`, `loaders/checkin.ts`,
  `loaders/kiosk.ts`, `loaders/attendance.ts`, `pages/home/**`, `pages/outreach/**`, or any
  migration.
- Do not write a cleanup migration for the legacy absence rows. The owner ruled _"leave as is."_
- Do not add a team filter to the roster query (§3b).
- Do not add an audit trail, a confirmation step beyond the existing `AlertDialog`, or any
  fraud-prevention ceremony. A previous wave **removed** a fail-closed audit trigger on this exact
  reasoning because it was silently destroying legitimate writes. If you find yourself adding
  strictness, that is the moment to stop and ask.
- Do not mark your own work complete (constitution non-negotiable). Report and stop.
