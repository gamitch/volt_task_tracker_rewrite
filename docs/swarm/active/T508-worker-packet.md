# T508 — worker packet

**Row:** T508 · **Workflow:** W3 (Run a meeting) · **Tier:** HEAVY (constitution item 26 —
this is a write path) · **Branch:** `claude/w3-meeting-workflow-0bl669` off `main` = `6db85c6`

**Worker model tier:** default (sonnet). Item 18's four opus triggers are migrations, RLS /
`security definer`, metric-view SQL, and auth/role logic. **T508 is none of them** — it deletes a
write and gates another behind a checkbox. Do not bump the tier because "write path" sounds
serious; item 25 explicitly retires that reasoning.

---

## §0 — premise gate verdict

> _To be filled by `checker-premise` before dispatch (constitution item 19). Do not dispatch a
> worker while this section reads PENDING._

**Status: PENDING.**

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

- `loaders/endMeeting.ts:376-388` — `backfillAbsences` upserts
  `{status:'absent', method:'coach', recorded_by:null}` with
  `{onConflict:'session_id,student_id', ignoreDuplicates:true}`.
- `:411-414` — it runs as step 1 of **every** `makeOnEndMeeting` call, with no condition.
- Its input is `payload.backfillAbsentStudentIds`, computed by
  `EndMeetingDialog.tsx`'s `computeBackfillAbsentStudentIds` (`:324-331`) via
  `buildEndMeetingPayload` (`:352-361`) — every roster member with no attendance row.
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

**The real mechanism behind the owner's 17 rows** is one layer up:
`ScheduleMeetingsDialog.tsx:541` defaults the team picker to all teams selected, and
`resolveTeamScope` (`:489-499`) converts "all selected" into `team_ids = null`, which means *open to
every team*. A meeting created without narrowing the picker rosters the entire active student body.

**Why this matters to you and is not pedantry:** do NOT add a team filter to the roster query. It is
already there. The residual hazard is the opposite one — the new bulk control operates on that same
roster, so on a `team_ids = null` meeting one tick covers every active student. **That is why §4's
control must name its count.**

### 3c. ❌ FALSE — "the session summary already reports only what was marked"

Close, but it fails in a way that matters. `computeEndMeetingSummaryCounts` (`:406-413`) iterates
the **roster** and looks each member up:

```ts
for (const entry of roster) {
  const record = attendanceByStudentId[entry.studentId];
  if (record !== undefined) counts[record.status] += 1;
}
```

So a student with a **real** `present` row who is not on the roster is dropped from "5 present".
That is reachable: `v_student_participation` (`20260722000000_membership_views.sql:59-63`) scopes on
`student_teams` ACTIVE memberships, while this roster scopes on the legacy `students.team_id` single
FK — a dual-team student is inside one and outside the other. **Count the records, not the roster.**

### 3d. TRAP — `onEditAttendance` cannot be reused for the bulk control

It is tempting: `LiveConsole.tsx:1191` already wires it with real coach identity, so reusing it
would need no new seam. **It does not work.** `makeOnEditAttendance` (`endMeeting.ts:~486`) is an
`.update()` scoped `.eq('session_id').eq('student_id')`. The students being marked have **no row**,
so it updates zero rows and silently writes nothing. The upsert path is required.

### 3e. TRAP — do not add `useAuth()` to `EndMeetingDialog.tsx`

`app/guards.tsx:339-345` — `useAuth()` **throws** outside an `<AuthProvider>`.
`EndMeetingDialog.test.tsx` renders the dialog bare. Adding the hook turns ~21 tests red for an
attribution nicety. See §6 for what to do about `recorded_by` instead.

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
   **The absence of a default is deliberate and is an acceptance criterion** — `tsc` must force every
   call site to state the choice. A defaulted parameter is not mutation-observable (this repo has a
   recorded instance: T300's C2, where restoring a default produced no `tsc` error at all).
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
4. **Fold T602 while you are here** (it is the same stale text this row makes wrong): the module doc
   still says the factory is "NOT wired into `EndMeetingDialog.tsx`/`LiveConsole.tsx`/any route",
   that the mount "is still filed as its own row, T196", and that `EndMeetingDialog.tsx` is "a
   frozen, forbidden file". **All false since `6271ac6`** — T196 shipped; `LiveConsole.tsx:1187`
   mounts the real dialog. Correct it and say what is true. Note T602 as folded in your report.

### 4c. `LiveConsole.endMeeting.test.tsx` — NARROW GRANT

**`LiveConsole.tsx` (source) is FORBIDDEN. Its test file gets a mechanical-fallout grant only.**
You may make exactly two changes, both forced by §4a's signature changes:

- `:276` — pass `false` as the new third argument to `buildEndMeetingConfirmDescription`.
- `:195` — rename the field in `EXPECTED_END_MEETING_PAYLOAD` and set it to `[]` (the checkbox
  defaults unticked, so no absence is written on a plain confirm).

**Nothing else in that file.** No new tests, no restructuring. If you find yourself needing a source
change in `LiveConsole.tsx`, **STOP and report it** — that is another workflow's file and a
cross-workflow reach is an ASK, never a judgement call.

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
| **C8** | The summary counts a real mark for a student who is **not** on the roster (§3c) | Restore the roster-walking loop in `computeEndMeetingSummaryCounts`. |
| **C9** | The summary invents no row for an unmarked student | Seed `counts.absent` from the unmarked count. |

**Fixture design requirements** (this repo has 7+ recorded assertions that passed for the wrong
reason):

- Give every fixture field a distinct value so a field swap is observable.
- C8 needs a student with a real record who is **deliberately absent from the roster array** — assert
  that absence explicitly in the test, so the fixture cannot silently drift into covering nothing.
- Prefer asserting against the **second** item in a list over the first.

---

## §6 — Known residual, to disclose and NOT fix

`recorded_by` on the bulk-marked rows stays `null`. Now that a coach ticks a box to produce them,
`null` under-attributes: `loaders/attendance.ts` module doc #2 says this column is "always the ACTING
coach's own" id, and marking the same student absent via the console pill **does** attribute.

**Closing it needs the identity passed into the factory, which is a prop change in
`LiveConsole.tsx` — another workflow's file.** Do not reach for it, and do not add `useAuth()` to the
dialog (§3e). The value is unchanged from the backfill it replaces, so this is a pre-existing gap
made visible, not a regression. **Disclose it in your report**; the orchestrator files the row.

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
`format:check` **clean** · vitest **80 files / 2027 tests, exit 0**.

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
