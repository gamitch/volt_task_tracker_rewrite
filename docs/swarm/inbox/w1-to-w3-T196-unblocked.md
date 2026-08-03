# Inbox — for W3: T196 is UNBLOCKED. `LiveConsole` is real.

**From branch:** `claude/w1-checkin` (W1)
**Base commit SHA:** `aa900f3`
**Author:** W1's orchestrator session. **Read-only with respect to every W3 file** —
`EndMeetingDialog.tsx`, `loaders/endMeeting.ts`, `MeetingsList.tsx`, `ScheduleMeetingsDialog.tsx`,
`StudentMeetingView.tsx` and `loaders/meetings.ts` were **not** modified. `loaders/endMeeting.ts` was
read as a reference and, at one point, was going to be imported — that plan was dropped (see §4).

## The one-line version

**Your blocker is gone.** W3's kickoff says of the `EndMeetingDialog` mount: *"BLOCKED on W1 making
LiveConsole real. Do not start it."* **W1 has made it real.** T403 is complete — all three steps,
through the full HEAVY chain, re-review passed.

## 1. Why you were blocked, and why that reason no longer holds

`loaders/endMeeting.ts`'s own module doc records the owner-ruled reason for the split:

> a real End Meeting dialog mounted on top of that fixture-backed console would, on first real use,
> mark every actually-checked-in student a real `absent` row

That was true because the console's roster was **seven fabricated students** and its attendance
marking was an **intentional no-op**. Both are fixed:

| | before | now |
|---|---|---|
| QR panel | `FIXTURE_QR_TOKEN` / short code `FXTURE` | real `checkin-token` credential (T403 step 1) |
| Roster + attendance | 7 invented students, fixture rows | real team-scoped roster, real `attendance` rows (step 2) |
| Coach marking a student | `notWiredSetAttendanceStatus`, a no-op | **real database write** (step 3) |

All fixtures were **deleted**, not kept as fallbacks.

## 2. ⚠️ A RULE CHANGED UNDER YOU. Read this before you build anything.

**MTG-11's coach-precedence clause is SUPERSEDED. The rule is now LAST WRITE WINS.**

Owner ruling 2026-08-02, recorded verbatim in `auto-mode-decisions.md` under *"George's ruling on
MTG-11: LAST WRITE WINS, overturning coach precedence"*. `VOLT_Portal_PRD.md:307` carries the struck
clause under strikethrough, and §12's acceptance item 4 is superseded too. **Cite the ruling, never
paraphrase it.**

The case that broke the old rule: a coach marks a student `absent` before they arrive; the student
turns up late and scans the kiosk. Coach-precedence discarded the scan and left them `absent` while
standing in the room.

**Why this matters to you specifically:** `EndMeetingDialog`'s `applyEndMeetingResult` and
`computeBackfillAbsentStudentIds` reason about what a row already says. If you were assuming a
coach-set value is immutable by a later QR write, **that assumption is dead.**

**Second half of the ruling, equally important:** the owner ruled **option A** — last-write-wins is
scoped to `LiveConsole` **only**, not table-wide. So `attendance.method` deliberately means *"who set
the value that is there now"* when the meeting console writes it, and keeps original `'qr'`
provenance when W2's outreach screens write it. **That divergence is intentional. Do not "fix" it**
without a new owner decision. The re-reviewer checked and found the two meanings apply to disjoint
row sets in practice (meeting sessions vs outreach sessions), so they cannot collide on one row.

## 3. What you can now rely on

- **`makeSetAttendanceStatus`** (`loaders/attendance.ts`) — new, W1-added. Payload is exactly
  `{session_id, student_id, status, method, recorded_by}`.
- **`makeUpsertAttendance` is byte-identical** to before W1 touched anything (verified by sha256 over
  the extracted function body, 746/746 bytes). Nothing you or W2 already depended on has moved.
- **`resolveAttendanceWriteMethod` is unchanged**, contract intact. `LiveConsole` simply no longer
  calls it.

## 4. A trap W1 hit, so you don't have to

T403's ledger row originally prescribed composing the console's data from **your**
`loadEndMeetingSummary`, on the stated premise that *"`AttendanceRecordState` is already shared in
the reverse direction, so the shapes line up."*

**Both halves were false.** There are two independent `AttendanceRecordState` declarations —
`LiveConsole.tsx:436` and `EndMeetingDialog.tsx:313` — with no import between them, and
`EndMeetingDialog.tsx`'s own module doc §6 says its ground truth is *"re-derived directly … NOT
imported from `LiveConsole.tsx`"*. The shapes differ: `LiveConsole`'s requires `updatedAt`, yours has
no such field, and `endMeeting.ts:324-333` reads full `AttendanceRow`s (which **do** carry it) and
drops it when narrowing.

Also, the anti-duplication argument runs the other way: `endMeeting.ts:127-130` describes its roster
resolution as *"the `loaders/kiosk.ts` pattern, re-derived locally"* — kiosk.ts is the original.

**Net: W1 did not import from your file, and your file was not modified.** If you ever want to share
that roster logic, the honest direction is `endMeeting.ts` importing from `kiosk.ts`, not the
reverse.

## 5. Rows that touch your wave

- **T196** — the mount. **Yours.** W1 has not started it and must not (`WORKFLOWS.md` W1 is explicit).
- **T400** — `/checkin` needs a picker of currently-open sessions. **Owner-ruled option (a)**
  (`auto-mode-decisions.md`, *"George's ruling on T400"*). **Folded into T196's wave**, because it
  needs the same open-sessions query you must build anyway. Do not start it separately.
- **T404** — `trg_audit_attendance_post_completion` is `after update` only, so a post-completion
  attendance **INSERT** is never audited (observed on a real PostgreSQL 16 scratch DB: 0 audit rows
  for INSERT vs 1 for UPDATE). **Directly relevant to you** — ending a meeting and then correcting
  attendance is exactly the post-completion path. Schema change, owner's call, not W1's and not
  yours to land unilaterally.
- **T405** — `attendance.updated_at` never moves on conflict-update via `attendance.ts`'s writers
  (no `moddatetime` trigger). Relevant if your summary sorts or displays by it. **Do not render it.**

## 6. Where the detail lives

- `docs/swarm/active/T403-step3-worker-packet.md` — the full spec, including a premise gate's
  findings proven against a real PostgreSQL 16 database.
- `verification-log.md` — four entries for T403 (steps 1, 2, 3, and the rework + PASS).
- The T403 ledger row.

**A caveat worth carrying:** T403's packet shipped an acceptance criterion that contradicted the PRD
and nobody caught it until the owner read the behaviour in plain language. The premise gate
fact-checks a packet against the **codebase**; nothing in the chain fact-checks it against the
**PRD**. Check your own criteria against `VOLT_Portal_PRD.md` directly.
