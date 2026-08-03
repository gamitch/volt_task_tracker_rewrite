# T306 — worker packet v1: a session with recorded attendance shows what happened, not what was promised

**Tier: STANDARD** (constitution item 26). **Stated and defended:** display-only change in a single
module, **no write path**, no schema/RLS/auth, and it adds a load seam of a shape already shipped
twice in this directory (`AttendancePanel.tsx:529-535`, `MarkDayCompleteDialog.tsx:1003`). Item 26's
trigger question — *can a mistake here corrupt data?* — is **no**: nothing here writes. It can lie to
a user about their own data, which is why the criteria below are display-truth criteria and why the
orchestrator replays every mutation. **Escalate to HEAVY and stop** if any part of this turns out to
need a write, or to need editing `rsvps`.

**Branch:** `claude/t306-signups-attendance`, from `76f8792`.

**Measure your own baseline on your branch point.** `main` moved five times on 2026-08-03; every
figure in older docs is stale. For reference only, `main` at `76f8792` measured tsc 0 · eslint
**0 errors / 362 warnings** · vitest **78 files / 1928 tests** — **re-measure and report yours.**

---

## 1. The defect, in the owner's own words

> *"i was on the UI and adding who attended an outreach event. I could select a student and input
> hours as i should. What was not clear to me on the UI was what to do with the RSVP. I belive i left
> it no response. it create a mental challenge from a user standpoint and was not clear."*

The Signups section on `OutreachDetail` buckets the roster from `rsvps` **alone**
(`groupSessionSignups`, `OutreachDetail.tsx:1035-1060`; rendered `:1466-1479`). So a student the coach
marked **present with hours** still sits under **"No response"**, while the Attendance panel directly
below shows them ticked.

**The filed defect was "the tallies are wrong". The real defect is that the RSVP section looks
actionable** — the coach reasonably wonders whether recording attendance also obliges him to fix each
RSVP. It does not, and nothing on screen says so.

---

## 2. Allowed Files

```
src/pages/outreach/OutreachDetail.tsx
src/pages/outreach/OutreachDetail.test.tsx
```

**Forbidden:** `src/lib/supabase/loaders/attendance.ts` (**W1's** — import from it, never modify),
`AttendancePanel.tsx` (import `isAttendingStatus` from it; do not edit), `src/pages/checkin/**`,
`LiveConsole.tsx`, `Kiosk.tsx`, `loaders/checkin.ts`, `loaders/kiosk.ts` (W1), `src/pages/home/**`
(W5), `pages/reports/**`, `loaders/reports.ts` (W4).

---

## 3. The owner's ruling — build to this

`auto-mode-decisions.md`, **"2026-08-03 — George's ruling on T306"**. **Cite that file, never this
paraphrase.**

**Replace the buckets with what actually happened.** Not "alongside", not "keep RSVP plus an
explanatory line" — both were offered and both were declined. Once real attendance exists the RSVP
question disappears from that surface entirely.

### The trigger is NOT the date and NOT the session status

This is the part most likely to be got wrong, and the owner ruled out both obvious answers himself:

> *"pleae be cognizant of what a 'past' event is. i may be doing this on the same day of the event."*

- **Not the date.** He records attendance on the day of the event. A date test would still show RSVP
  buckets during the exact workflow that confused him — and it would re-open T304, where he settled
  that these surfaces do not consult the date (`auto-mode-decisions.md:1320-1333`).
- **Not `session.status === 'completed'`.** While he is recording attendance the session is normally
  still `scheduled`; he has not marked the day complete yet. A status test leaves the RSVP buckets up
  for the whole confusing moment and only fixes it afterwards.

**Trigger: does any attendance row exist for this session?** No rows → intent is genuinely the only
information that exists → show the RSVP buckets unchanged. Any rows → show what happened. It flips
the instant he ticks the first student.

---

## 4. What to build

**(a) A load seam for attendance on this page.** `OutreachDetail` currently has **no** attendance
data — `AttendancePanel` loads its own internally (`AttendancePanel.tsx:529`, effect at `:535`) and
receives only `sessions`/`roster`/`teams` (`OutreachDetail.tsx:2120-2125`).

Follow the shipped convention in this directory: an **injectable, real-defaulted** prop
(`loadAttendance?: LoadAttendanceForSessionsFn` defaulting to the real `loadAttendanceForSessions`),
exactly as `AttendancePanel` and `MarkDayCompleteDialog` already do. **Decide and state** whether the
seam sits on the page or on the Signups component, and why.

**Degrade the way `MarkDayCompleteDialog` does, not the way `MarkEventCompleteDialog` does.** Those
two deliberately differ, and the reason is recorded in `MarkDayCompleteDialog.tsx`'s module doc:
a **display** surface may fall back on a failed load; a surface that **writes** must abort. This is a
display surface. **On a failed or in-flight load, fall back to today's RSVP buckets** — no error
banner, no blocked UI. Do not invent a third behaviour.

**(b) A pure bucketing function, mirroring `groupSessionSignups`.** Same shape, same file, same export
+ unit-test convention. Four buckets, so the row keeps its existing visual rhythm:

| Bucket | Rule |
|---|---|
| **Attended** | `isAttendingStatus(row.status)` — **import it from `AttendancePanel.tsx:308`** |
| **Excused** | `status === 'excused'` |
| **Absent** | `status === 'absent'` |
| **No record** | roster student with no attendance row — **derived by diffing the roster**, exactly as `noResponse` is today (module doc #2), never a fabricated stored status |

**`isAttendingStatus` must be imported, not re-derived.** It encodes `present`/`late`, which is the
same predicate `v_student_hours` uses (`20260717000003_metric_views.sql:18`). Constitution item 3
forbids duplicating a metric formula in TypeScript, and `AttendancePanel.tsx:308` already exports it.

**(c) Switch per session, not per student.** A session shows *either* the RSVP buckets *or* the
attendance buckets — never a mix. A per-student switch would put two vocabularies in one row and
recreate the confusion this task exists to remove.

**(d) Copy.** Labels are sentence case per DES-14. **Make the heading say which thing is on screen**,
so the coach never has to infer it — e.g. the RSVP state reads as who said they were coming, the
attendance state as who actually came. Propose exact strings in your output; do not invent
user-facing copy beyond what this section needs.

---

## 5. Do NOT sync the two records

`OutreachList.tsx:1685-1687` carries T121's finding, still governing: *"RSVP is intent, not a real
attendance record."* Writing a `going` RSVP because a coach ticked an attendance box would claim a
student said yes in advance when they never responded.

**This task performs no writes at all.** If you find yourself adding one, stop and report — that is
the escalate-to-HEAVY condition in the header.

---

## 6. Acceptance criteria — each names a mutation that must turn it red

| # | Criterion | Mutation |
|---|---|---|
| **C1** | A session with **no** attendance rows renders the RSVP buckets, unchanged | make the trigger always choose attendance |
| **C2** | A session with **≥1** attendance row renders the attendance buckets, and **no** RSVP bucket labels | make the trigger always choose RSVP |
| **C3** | A student with `present` and a student with `late` both land in **Attended** | replace the imported `isAttendingStatus` with `status === 'present'` |
| **C4** | `absent` and `excused` land in their own buckets, not in Attended | route `excused` into Attended |
| **C5** | A roster student with **no** attendance row lands in **No record** | drop the roster diff and iterate attendance rows instead |
| **C6** | The trigger ignores `session.status` — a **`scheduled`** session with attendance rows still shows attendance | add `&& session.status === 'completed'` to the trigger |
| **C7** | The trigger ignores the **date** — a session dated today with attendance rows still shows attendance | add a date comparison to the trigger |
| **C8** | A **failed** attendance load falls back to the RSVP buckets, with no error banner and nothing blocked | route the failure to an error state instead |
| **C9** | No `rsvps` write occurs on any path this task touches | — assert no write seam is called; if no mutation reddens it, say so plainly rather than inventing one |

**C6 and C7 are the owner's constraint expressed as tests.** They are the two implementations a
future reader is most likely to "fix" this into, and both would reintroduce the reported confusion.
Pin them.

**C2's absence arm must be paired** with proof the row rendered at all — assert an attendance label is
present **and** an RSVP label is absent in the same test. This repo has shipped 7+ assertions that
passed for the wrong reason; an absence-only check here would pass if the section rendered nothing.

---

## 7. Harness facts — verify before writing a criterion

`OutreachDetail.test.tsx` already imports and unit-tests `groupSessionSignups` (`:80`, block at
`:329-390`) — put the bucketing criteria there, at pure-function level. The trigger, fallback and DOM
criteria need a render.

**The attendance seam is ALREADY mocked in this file — measured, not assumed.** `OutreachDetail.test.tsx:110-118`
partial-mocks `loaders/attendance` via the `importOriginal` convention, replacing
`loadAttendanceForSessions` with **`vi.fn(async () => [])`**, and exposes the handle
`mockedLoadAttendanceForSessions` at `:120`.

Three consequences, and they shape your criteria:

1. **If your seam defaults to the real `loadAttendanceForSessions`, this existing mock intercepts
   it.** You do not need to add a mock, and you should not add a second one.
2. **The default resolves to `[]` — a load that SUCCEEDS with zero rows, not a failure.** So every
   existing test in this file keeps seeing "no attendance", the trigger picks the RSVP buckets, and
   the existing suite should stay green **unchanged**. If any existing test reddens, that is a
   finding — report it, do not fix it by editing an assertion.
3. **That same default is a trap for C8.** "Resolved empty" and "rejected" are different states and
   only one of them is the fallback path C8 tests. Override the handle with a **rejection** for C8;
   a test that merely relies on the default proves nothing about failure handling.

**Confirm all three yourself before writing a criterion.** Four consecutive tasks in this project
wrote criteria against an imagined harness, and on T309 the packet had two dialog test files
inverted — the trap being documented verbatim in two files did not stop it.

---

## 8. Required worker output

Write `docs/swarm/active/T306-worker-output.md`:

1. **The commit SHA**, plus proof the work is in the **committed blob**, not merely the working tree
   (item 21 — T142 reported accurate, complete work that had never been committed).
2. **All six gates**, `.env.local` absent, against a baseline **you measured on your own branch
   point**. Explain any warning rise. Assert the **exit code** of the targeted run.
3. **Every mutation in §6, run, with real red output pasted.** Not "confirmed red" — the output.
4. **§4(a)**: where you put the load seam and why.
5. **§4(d)**: the exact copy strings you chose.
6. **Anything in this packet that is wrong.** Recent packets in this project have each carried at
   least one false claim caught by a gate or worker — a BLOCKER, three MAJORs and three bad citations
   on T330; an unsourced citation and a criterion with no mutation on T401. Finding another is a
   success, not an objection.
