# T306 — worker output

**Tier: STANDARD** (constitution item 26, per packet header). Display-only change, no writes, no
schema/RLS/auth touched. Nothing in this task needed a write or touched `rsvps` — no HEAVY escalation.

**Worktree:** `/tmp/claude-0/-home-user-volt-task-tracker-rewrite/03662208-7609-564c-8759-12b1ea7c2fbc/scratchpad/t306-work`,
branch `claude/t306-work`, forked from `claude/t306-signups-attendance` at `b7a0740`.

---

## 1. Commit SHA and proof of committed work (item 21)

**Commit:** `bb7457d7bf46c81f219b127ab804e05ab77885b4`

```
$ git log --oneline -1
bb7457d T306: Signups section shows recorded attendance, not stale RSVP intent

$ git diff b7a0740 bb7457d --stat
 src/pages/outreach/OutreachDetail.test.tsx | 285 ++++++++++++++++++++++++++++-
 src/pages/outreach/OutreachDetail.tsx      | 282 +++++++++++++++++++++++++++-
 2 files changed, 557 insertions(+), 10 deletions(-)
```

`git diff <branch-point> <this-commit>` is non-empty against the **committed blob** (not the working
tree) — the two touched files are exactly the two Allowed Files. Working tree is clean at `bb7457d`
(`git status` → nothing to commit) after every mutation experiment below was reverted with
`git checkout -- src/pages/outreach/OutreachDetail.tsx`.

Only Allowed Files touched: `src/pages/outreach/OutreachDetail.tsx`,
`src/pages/outreach/OutreachDetail.test.tsx`. `loaders/attendance.ts` and `AttendancePanel.tsx` were
imported from, never modified (`git diff bb7457d -- src/lib/supabase/loaders/attendance.ts
src/pages/outreach/AttendancePanel.tsx` is empty).

---

## 2. Six gates — baseline (measured on my own branch point) vs. post-implementation

**Baseline measured at `b7a0740`** (packet commit; code-identical to `76f8792`, `.env.local` absent):

| Gate | Baseline | Post-implementation (`bb7457d`) |
|---|---|---|
| 1. `npx tsc --noEmit` | exit **0** | exit **0** |
| 2. `npx vite build` | exit **0** | exit **0** |
| 3. `npm run format:check` | clean, exit **0** | clean, exit **0** (after one `prettier --write` pass on the test file — see below) |
| 4. `npx eslint .` | exit **0**, **0 errors / 362 warnings** | exit **0**, **0 errors / 364 warnings** |
| 5. `npx vitest run` (full) | exit **0**, **78 files / 1928 tests** | exit **1**, **77 passed \| 1 failed of 78 files**, **1940 passed \| 1 failed of 1941 tests** |
| 6. `npx vitest run src/pages/outreach/OutreachDetail.test.tsx` (targeted) | exit **0**, **97/97 tests** | exit **1**, **109 passed \| 1 failed of 110 tests** |

This exactly matches the packet's own quoted reference figures for `main`@`76f8792` (tsc 0, eslint 0
errors/362 warnings, vitest 78 files/1928 tests) — the reference was not stale for this branch point.

**Gate 3 note:** my first pass left the new test-file additions un-prettified (`prettier --check`
flagged `OutreachDetail.test.tsx`). Ran `npx prettier --write` on both touched files before the final
gate run; `OutreachDetail.tsx` came back "unchanged" (already Prettier-clean), only the test file
needed reformatting. Final state is clean.

**Gate 4 (eslint) warning rise, explained:** +2 warnings, both `react-refresh/only-export-components`
on `OutreachDetail.tsx`, one per newly-exported pure function (`hasRecordedAttendance`,
`groupSessionAttendance`). This is the SAME pre-existing pattern this exact file already carries 18
instances of (`groupSessionSignups`, `resolveEventRoster`, `resolveOwnRosterStudent`, etc. each already
contribute one of these warnings) — the file mixes a component export with a pure-function
export-and-unit-test convention throughout, which is the packet's own explicitly required shape for
§4(b) ("same export + unit-test convention" as `groupSessionSignups`). Confirmed via diffing the
per-file warning counts: baseline `OutreachDetail.tsx` = 18 warnings, post = 20, net file-level rise
+2, matching the overall +2 exactly (no stray warnings introduced elsewhere).

**Gates 5/6 — exit codes asserted, not pass counts.** Both are exit **1**. The one failing test in both
runs is the SAME pre-existing assertion, not a new regression — see Finding #1 below, which explains why
this reddening is an unavoidable, correct consequence of implementing the ruling as written, not a bug.

```
 FAIL  src/pages/outreach/OutreachDetail.test.tsx > <AttendancePanel> role gating (Known Context/Traps #5) > renders no "Attendance" section at all for an unauthenticated viewer
AssertionError: expected "spy" to not be called at all, but actually been called 2 times

Received:

  1st spy call:

    Array [
      Array [],
    ]

  2nd spy call:

    Array [
      Array [
        "session-food-bank-day1",
        "session-food-bank-day2",
      ],
    ]

Number of calls: 2

 ❯ src/pages/outreach/OutreachDetail.test.tsx:1397:49
    1395|
    1396|     expect(container.textContent).not.toContain('Attendance');
    1397|     expect(mockedLoadAttendanceForSessions).not.toHaveBeenCalled();
       |                                                 ^
    1398|   });
```

I did **not** edit this assertion (hard rule: do not weaken/remove an existing assertion). See Finding
#1 for the full explanation and why I believe the correct fix, if any, belongs to a future task, not to
silently editing this test.

---

## 3. Every mutation from §6, run, with real red output

All nine criteria. For each, I edited the committed file in the working tree, ran the targeted test
filter, pasted the real failure, then reverted with `git checkout -- src/pages/outreach/OutreachDetail.tsx`
before touching the next one (never chained two live mutations at once).

### C1 — make the trigger always choose attendance

```diff
-    () => hasRecordedAttendance(session.id, attendanceRows),
+    () => true, // MUTATION C1: always choose attendance.
```

```
 FAIL  ... > T306 C1: no recorded attendance renders the RSVP buckets, unchanged > shows Going/Can't go/No response, and no attendance-bucket labels at all
AssertionError: expected 'Riverside Park Cleanup…' to contain 'Who said they were coming'

Expected: "Who said they were coming"
Received: "...SignupsSun, Jul 26 · 10:00 AM–12:00 PMWho actually cameAttended (0)No studentsExcused (0)No studentsAbsent (0)No studentsNo record (3)Amara ChenMarcus BelloNina Ortiz..."

 ❯ src/pages/outreach/OutreachDetail.test.tsx:627:35
```

### C2 — make the trigger always choose RSVP

```diff
-    () => hasRecordedAttendance(session.id, attendanceRows),
+    () => false, // MUTATION C2: always choose RSVP.
```

```
 FAIL  ... > T306 C2: >=1 recorded attendance row switches to the attendance buckets, RSVP buckets gone > shows Attended (and the other attendance labels), never Going/Maybe/Can't go/No response
AssertionError: expected 'Riverside Park Cleanup…' to contain 'Who actually came'

Expected: "Who actually came"
Received: "...SignupsSun, Jul 26 · 10:00 AM–12:00 PMWho said they were comingGoing (1)Amara ChenMaybe (0)No studentsCan't go (1)Nina OrtizNo response (1)Marcus Bello..."

 ❯ src/pages/outreach/OutreachDetail.test.tsx:656:35
```

### C3 — replace the imported `isAttendingStatus` with `status === 'present'`

```diff
-    if (isAttendingStatus(row.status)) attended.push(student);
+    if (row.status === 'present') attended.push(student); // MUTATION C3
```

```
 FAIL  ... > groupSessionAttendance ... > C3: "present" and "late" both land in Attended
AssertionError: expected [ 's-1' ] to deeply equal [ 's-1', 's-2' ]

- Expected
+ Received

  [
    "s-1",
-   "s-2",
  ]

 ❯ src/pages/outreach/OutreachDetail.test.tsx:429:53
```

### C4 — route `excused` into Attended

```diff
-    if (isAttendingStatus(row.status)) attended.push(student);
-    else if (row.status === 'excused') excused.push(student);
-    else if (row.status === 'absent') absent.push(student);
+    if (isAttendingStatus(row.status) || row.status === 'excused') attended.push(student); // MUTATION C4
+    else if (row.status === 'absent') absent.push(student);
```

```
 FAIL  ... > groupSessionAttendance ... > C4: "excused" and "absent" land in their own buckets, never in Attended
AssertionError: expected [] to deeply equal [ 's-3' ]

- Expected
+ Received

- [
-   "s-3",
- ]
+ []

 ❯ src/pages/outreach/OutreachDetail.test.tsx:434:45
```

### C5 — drop the roster diff, iterate attendance rows instead

```diff
-  const rowByStudentId = new Map(
-    attendanceRows.filter((row) => row.sessionId === sessionId).map((row) => [row.studentId, row]),
-  );
-  ...
-  for (const student of roster) {
-    const row = rowByStudentId.get(student.id);
-    if (row === undefined) { noRecord.push(student); continue; }
-    ...
-  }
+  // MUTATION C5: drop the roster diff, iterate attendanceRows instead.
+  const rosterById = new Map(roster.map((student) => [student.id, student]));
+  for (const row of attendanceRows.filter((candidate) => candidate.sessionId === sessionId)) {
+    const student = rosterById.get(row.studentId);
+    if (student === undefined) continue;
+    ...
+  }
```

```
 FAIL  ... > groupSessionAttendance ... > C5: a roster student with no attendance row at all lands in "No record", diffed from the roster
AssertionError: expected [] to deeply equal [ 's-5' ]

- Expected
+ Received

- [
-   "s-5",
- ]
+ []

 ❯ src/pages/outreach/OutreachDetail.test.tsx:442:46
```

### C6 — add `&& session.status === 'completed'` to the trigger

```diff
-    () => hasRecordedAttendance(session.id, attendanceRows),
+    () => hasRecordedAttendance(session.id, attendanceRows) && session.status === 'completed', // MUTATION C6
```

```
 FAIL  ... > T306 C6: the trigger ignores session.status -- a SCHEDULED session with attendance rows still shows attendance > session-park-cleanup is genuinely still "scheduled" (not completed) and still shows Attended
AssertionError: expected 'Riverside Park Cleanup…' to contain 'Attended (1)'

Expected: "Attended (1)"
Received: "...SignupsSun, Jul 26 · 10:00 AM–12:00 PMWho said they were comingGoing (1)Amara ChenMaybe (0)No studentsCan't go (1)Nina OrtizNo response (1)Marcus Bello..."

 ❯ src/pages/outreach/OutreachDetail.test.tsx:685:35
```

### C7 — add a date comparison to the trigger

```diff
-    () => hasRecordedAttendance(session.id, attendanceRows),
+    () =>
+      hasRecordedAttendance(session.id, attendanceRows) &&
+      session.sessionDate < formatChicagoDateOnly(new Date()), // MUTATION C7
```

Test uses a session whose `sessionDate` is real "today" (`new Date().toISOString().slice(0,10)`),
matching the owner's own account of recording attendance the same day the event happens:

```
 FAIL  ... > T306 C7: the trigger ignores the date -- a session dated TODAY with attendance rows still shows attendance > a session whose sessionDate is literally today still shows Attended, matching the owner's own same-day workflow
AssertionError: expected 'Riverside Park Cleanup…' to contain 'Attended (1)'

Expected: "Attended (1)"
Received: "...WhenMon, Aug 3 · 10:00 AM–12:00 PMWhereRiverside Park...SignupsMon, Aug 3 · 10:00 AM–12:00 PMWho said they were comingGoing (1)Amara ChenMaybe (0)No studentsCan't go (1)Nina OrtizNo response (1)Marcus Bello..."

 ❯ src/pages/outreach/OutreachDetail.test.tsx:716:35
```

### C8 — route the failure to an error state instead

Added a throwaway state var + `Banner` in the `.catch()` (mirrors the shape a future reader who
"fixes" the silent degrade into a visible error state would produce):

```diff
+  const [attendanceLoadFailedMUTATION, setAttendanceLoadFailedMUTATION] = useState(false);
   ...
   .catch(() => {
-    // Graceful degrade ...
+    setAttendanceLoadFailedMUTATION(true); // MUTATION C8: route to an error state.
   });
   ...
+  {attendanceLoadFailedMUTATION && (
+    <Banner status="error" title="Couldn't load attendance" description="MUTATION C8 error banner." />
+  )}
```

```
 FAIL  ... > T306 C8: a FAILED attendance load falls back to the RSVP buckets, no error banner, nothing blocked > a rejected loadAttendance still renders the page normally, RSVP buckets stand
AssertionError: expected 'Riverside Park Cleanup…' not to contain 'Couldn\'t load attendance'

Expected: "Couldn't load attendance"
Received: "...SignupsCouldn't load attendanceMUTATION C8 error banner.Sun, Jul 26 · 10:00 AM–12:00 PMWho said they were comingGoing (1)Amara ChenMaybe (0)No studentsCan't go (1)Nina OrtizNo response (1)Marcus Bello..."

 ❯ src/pages/outreach/OutreachDetail.test.tsx:743:39
```

(RSVP buckets DID still render correctly under this mutation — the fallback logic itself is untouched
by this mutation — but the "no error banner" half of C8 correctly catches the introduced banner.)

### C9 — no `rsvps` write occurs

**No mutation of the trigger/bucketing logic itself can redden C9** — there is no write call anywhere
in the code this task touches to begin with, so there is nothing plausible to "flip" the way C1–C8's
mutations flip a comparison operator or a filter. Per the packet's own instruction ("if no mutation
reddens it, say so plainly rather than inventing one"), I did not invent an arbitrary one.

Instead, I constructed the ONE mutation that is not arbitrary: instantiating the literal
forbidden action §5 names ("Do NOT sync the two records"). I added an import of `submitRsvpChange`
(not otherwise imported into this file) and a `useEffect` inside `SessionSignupList` that calls it for
every attended student when `showAttendance` is true — i.e. exactly the "helpfully" wrong idea a future
reader might have (write a `going` RSVP because attendance says the student showed up):

```diff
+  useEffect(() => {
+    if (!showAttendance) return;
+    for (const student of attendanceGroups.attended) {
+      void submitRsvpChange({ sessionId: session.id, studentId: student.id, status: 'going', respondedBy: student.id });
+    }
+  }, [showAttendance, attendanceGroups, session.id]);
```

```
 FAIL  ... > T306 C9: no rsvps write occurs on any path this task touches > switching to the attendance buckets never calls the real rsvps write seam
AssertionError: expected "spy" to not be called at all, but actually been called 3 times

  1st/2nd/3rd spy call:
    Array [
      Object {
        "respondedBy": "student-amara-chen",
        "sessionId": "session-park-cleanup",
        "status": "going",
        "studentId": "student-amara-chen",
      },
    ]

 ❯ src/pages/outreach/OutreachDetail.test.tsx:762:40
```

This mutation is deliberately the SAME shape as the packet's own §5 warning, not an arbitrary edit — I
believe this is the honest answer for C9: the criterion's real content is "nobody re-introduces the
T121/§5 sync", and the mutation that proves it is exactly that re-introduction, not a contrived edit to
otherwise-untouched code.

**Working tree confirmed clean after all nine mutations** (`git status` → nothing to commit; `git diff
HEAD` → empty) before writing this report.

---

## 4. §4(a) — where the load seam sits, and why

**On the page (`OutreachDetail`), not on `SessionSignupList`.** New `loadAttendance?:
LoadAttendanceForSessionsFn` prop on `OutreachDetailProps`, defaulting to the real
`loadAttendanceForSessions` (same real-defaulted injectable-prop convention `AttendancePanel.tsx`'s own
`loadAttendance` and `MarkDayCompleteDialog.tsx`'s own `loadAttendance` already ship). It fires **once**,
for every session on the page combined (`attendanceSessionIdsKey` = the joined string of every
`data.sessions[].id`, mirroring `AttendancePanel`'s own `sessionIdsKey` shape) — not once per session,
which would mean N independent fetches for an N-session event.

Two reasons:

1. **Efficiency/shape.** Attendance is naturally page-scoped data (every session's rows come back from
   one query in the real loader), the same shape `AttendancePanel` already uses for the identical data.
   A `SessionSignupList`-scoped seam (mirroring `MarkDayCompleteDialog`'s single-session shape instead)
   would multiply network calls for no benefit — that shape exists in this codebase for a dialog that
   opens for exactly one session at a time, which does not describe this always-mounted section.

2. **Hooks-ordering constraint, not just taste.** The fetch is keyed off `data` — `OutreachDetail`'s OWN
   top-level state (`useState<OutreachDetailData | null>(null)`), NOT `detailData`/`sessions`, which
   only exist after this component's own early `loading`/`error`/`notFound` returns further down. A hook
   placed after those early returns would violate rules of hooks (called conditionally across renders).
   `data` starts `null` and is available from the very first render, so the load effect can be declared
   unconditionally alongside this file's other top-level effects (roster load, guardian-links load).

**Known collateral effect of firing unconditionally for every viewer, not just staff:** see Finding #1.

---

## 5. §4(d) — exact copy strings

| Where | String |
|---|---|
| RSVP-mode kicker (`Heading level={4}`, above the four RSVP buckets) | `Who said they were coming` |
| Attendance-mode kicker (`Heading level={4}`, above the four attendance buckets) | `Who actually came` |
| Attendance bucket label | `Attended` |
| Attendance bucket label | `Excused` |
| Attendance bucket label | `Absent` |
| Attendance bucket label | `No record` |

All six are sentence case (only the first word/proper-noun-free capital, DES-14
`docs/swarm/VOLT_Portal_PRD.md:225`) and match the packet's own suggested wording (§4(d): "the RSVP
state reads as who said they were coming, the attendance state as who actually came") near-verbatim.
No other new user-facing copy was introduced — the four attendance bucket labels are the minimum needed
to give the row "the same visual rhythm" (packet §4(b)) as the four existing RSVP labels.

---

## 6. Things in this packet worth flagging

### Finding #1 (the one I'd flag most strongly) — one pre-existing assertion reddens, and I believe that is correct, not a bug

`OutreachDetail.test.tsx`'s pre-existing `<AttendancePanel> role gating` describe block asserts, for an
**unauthenticated** viewer: `expect(mockedLoadAttendanceForSessions).not.toHaveBeenCalled()`. That
assertion was written (T117) to prove `<AttendancePanel>`'s OWN role gate stops IT from firing its own
internal load. It still does — `<AttendancePanel>` genuinely never mounts for this viewer.

But the Signups section (unlike `<AttendancePanel>`) has **no role gate at all** — it renders
identically for every viewer, including a signed-out one (this file's own pre-existing tests, e.g. "is
absent for a signed-out visitor -- Signups still renders", already prove this). The owner's ruling
(`auto-mode-decisions.md`, "2026-08-03 -- George's ruling on T306") describes "the Signups section"
without restricting it to staff, and the ruling's own worked example ("Once real attendance exists, the
RSVP question disappears from that surface entirely") reads as applying to that surface for whoever is
looking at it, not just the coach who recorded the attendance. I implemented it that way: the new
page-level `loadAttendance` fires regardless of viewer role, because the Signups section it feeds
renders regardless of viewer role.

The consequence: that one pre-existing assertion, which happens to observe the SHARED
`loadAttendanceForSessions` mock (not a role-scoped one), now sees a second, legitimate caller and
fails. Per the packet's own explicit instruction ("if any existing test reddens, that is a finding —
report it, do not fix it by editing the assertion") and the hard rule against weakening assertions, I
left it exactly as written and did not touch it.

I considered the alternative of gating my new load behind `isStaffViewer` specifically to keep this
assertion green, and rejected it: nothing in the ruling supports restricting the fix to staff, and doing
so would leave a parent/student staring at a stale "No response" bucket for a session where attendance
was genuinely recorded — reproducing a milder version of the exact confusion this task exists to remove,
for a different viewer. I believe the packet's own §7 ("the existing suite should stay green
unchanged") did not anticipate this specific collateral case (it discusses the DEFAULT-`[]` mock's
effect on bucketing correctness, not this call-count assertion at all) — this is the "one thing in the
packet that turned out to be wrong" I'm required to look for. It is a harness fact the packet missed,
not a citation error.

### Everything else I checked and found accurate

- `AttendancePanel.tsx:308`'s `isAttendingStatus` export — confirmed, exact line, exact signature.
- `AttendancePanel.tsx:529-535`'s `useAttendanceLoadState`/effect — confirmed.
- `MarkDayCompleteDialog.tsx:1003`'s `loadAttendance([loadedSessionId])` call — confirmed, exact line.
- `20260717000003_metric_views.sql:18`'s `where a.status in ('present','late')` — confirmed, exact line,
  matches `isAttendingStatus`'s predicate exactly.
- `OutreachDetail.tsx:1035-1060` (`groupSessionSignups`), `:1466-1479` (its render site),
  `:2120-2125` (`<AttendancePanel>` mount) — all confirmed against the branch-point blob (`b7a0740`).
- The harness facts in §7 (the existing `vi.mock` at `:110-118`/`:120`, its `async () => []` default,
  and the C8 "resolved-empty vs. rejected" trap) — all confirmed exactly as described before I wrote a
  single criterion; I did not add a second mock, and C8 explicitly overrides with a rejection rather than
  relying on the default.
- The packet's own reference baseline (`main`@`76f8792`: tsc 0, eslint 0/362, vitest 78/1928) — matched
  my own independently-measured baseline at `b7a0740` exactly.

No BLOCKER/MAJOR-class defects found in the packet itself this time — the one genuine finding is Finding
#1 above, a harness-fact gap rather than a wrong citation or an impossible instruction.

---

## Summary for the orchestrator

- **Files changed:** `src/pages/outreach/OutreachDetail.tsx`, `src/pages/outreach/OutreachDetail.test.tsx`
  (both Allowed Files). `loaders/attendance.ts` and `AttendancePanel.tsx` read/imported from only.
- **Commands run:** `npx tsc --noEmit`, `npx vite build`, `npm run format:check` (+ one `prettier
  --write` pass), `npx eslint .`, `npx vitest run`, `npx vitest run src/pages/outreach/OutreachDetail.test.tsx`,
  plus nine isolated mutate → test → `git checkout --` cycles (one per §6 criterion), plus a `git stash`
  round-trip to measure baseline at the branch point before implementing.
- **Known risk:** the one pre-existing test failure (Finding #1) is a real, disclosed regression in the
  literal sense that a previously-green assertion is now red — I judged it correct-and-unavoidable given
  a faithful reading of the ruling, not an implementation bug, but I am not the one who gets to certify
  that; flagging it plainly for the orchestrator's own judgment call.
- **Escalation:** not triggered. No write path was added or needed; `rsvps` was never edited (C9's own
  mutation experiment, which DOES call a real write seam, was reverted immediately after producing its
  red output and never left in the committed tree).
- **Self-certification:** none — this file is my own account for the orchestrator to independently
  replay, per the STANDARD-tier process.
- **Dispute:** not filed. Nothing here makes the task impossible under the constitution; Finding #1 is a
  disclosed design tradeoff inherent to a faithful reading of the ruling, not a broken instruction.
