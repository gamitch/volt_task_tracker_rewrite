# T406 — worker output (packet v2)

**Worker:** worker-implementer (sonnet), own git worktree (`t406-work`), branch `claude/t406-work`,
cut from `main` `fa93516` (packet docs already on the branch as `d2d160e`/`bc9bd42`).

## 1. Commit SHA, and proof the work is in the committed blob (item 21)

**Commit:** `a9eae733a432f799fa230bba746bc8eb438092aa` (`claude/t406-work`, parent `bc9bd42`, which
sits on `fa93516`).

```
$ git log --oneline -3
a9eae73 T406: narrow markDayComplete's attendance upsert so a concurrent scan survives
bc9bd42 docs(T406): packet v2 after the premise gate returned REVISE — premise proven, two MAJORs folded in
d2d160e docs(T406): worker packet v1 -- narrow the write

$ git status --short
(nothing — clean)

$ git diff fa93516 a9eae73 --stat
 docs/swarm/active/T406-gate-report.md             | 194 +++++++++++++++++
 docs/swarm/active/T406-worker-packet.md           | 249 ++++++++++++++++++++++
 docs/swarm/auto-mode-decisions.md                 |  51 +++++
 src/lib/supabase/loaders/outreach.test.ts         | 233 ++++++++++++++++++++
 src/lib/supabase/loaders/outreach.ts              |  59 ++++-
 src/pages/outreach/MarkDayCompleteDialog.test.tsx |  79 ++++++-
 6 files changed, 852 insertions(+), 13 deletions(-)
```

This is not a working-tree claim — I additionally checked out `fa93516` **detached, in this same
worktree** to measure the independent baseline (§2 below), then `git checkout claude/t406-work`
back, and confirmed `git status --short` and `git diff --stat` were both empty against `a9eae73`
after returning — the work survives that round-trip, i.e. it is in the commit, not just in files I
happened to be looking at.

**Files changed by this task** (explicit pathspecs staged, never `git add -A`, item 22):
- `src/lib/supabase/loaders/outreach.ts` — the narrowed `upsertAttendance` DB mapping + module doc
  #4 update.
- `src/lib/supabase/loaders/outreach.test.ts` — new `makeMarkDayComplete (T406)` describe block:
  stateful fake `attendance` table, C2 (two tests) and C3.
- `src/pages/outreach/MarkDayCompleteDialog.test.tsx` — the one pre-existing test the packet
  predicted would redden (§9), switched from `objectContaining` to an exact shape (covers C1+C4),
  plus a new C5 test.
- `docs/swarm/active/T406-worker-output.md` — this file.

No other files touched. `MarkDayCompleteDialog.tsx` needed **zero** edits — confirmed, not assumed
(§4's conditional resolved "not necessary," matching the gate's own assessment).

## 2. All six gates, against my own measured baseline, `.env.local` absent

Per `docs/swarm/MACHINE-SETUP.md`'s "The six gates," I measured the baseline **myself** rather than
trusting the packet's quoted numbers — checked out `fa93516` detached in this worktree (item 23:
mutation/measurement work stays in my own worktree; this worktree is mine) and ran all five, plus a
sixth once the change existed:

```
$ ls -la .env.local
ls: cannot access '.env.local': No such file or directory

BASELINE (main @ fa93516, detached checkout, this worktree):
  npx tsc --noEmit        exit 0
  npm run lint            0 errors, 364 warnings, exit 0
  npm run format:check    "All matched files use Prettier code style!", exit 0
  npx vitest run          Test Files 78 passed (78) / Tests 1951 passed (1951), exit 0
  npm run build           "✓ built in 5.43s", exit 0
```

This **exactly** matches the packet's quoted baseline (`tsc` 0 · eslint 0/364 · vitest 78/1951) — I
did not need to correct it. `git checkout claude/t406-work` returned cleanly afterward (`git status
--short` empty, `git diff --stat` empty against `a9eae73`).

```
AFTER (claude/t406-work @ a9eae73):
  npx tsc --noEmit        exit 0
  npm run lint            0 errors, 364 warnings, exit 0   (unchanged)
  npm run format:check    "All matched files use Prettier code style!", exit 0
  npx vitest run          Test Files 78 passed (78) / Tests 1955 passed (1955), exit 0
  npm run build           "✓ built in 5.83s", exit 0

  SIXTH (targeted run, the files this task touched):
  npx vitest run src/lib/supabase/loaders/outreach.test.ts src/pages/outreach/MarkDayCompleteDialog.test.tsx
    Test Files  2 passed (2)
    Tests  74 passed (74)
    exit 0
```

1955 − 1951 = **4 net new tests**: 3 in `outreach.test.ts` (C2 ×2 + C3), 1 net new in
`MarkDayCompleteDialog.test.tsx` (the existing C1/C4 test was edited in place, not duplicated; one
new C5 test was added). 0 tests removed, 0 tests weakened (`git diff fa93516 a9eae73 -- '*.test.ts*'
| grep '^-' | grep -E 'expect|toBe|toEqual|toHaveBeenCalled'` shows only the one predicted-stale
assertion, §9, being replaced by a stricter one — not deleted).

**Assert exit codes, not pass counts** (`MACHINE-SETUP.md`'s own warning) — all six above are exit
0, pasted verbatim from the actual runs, not summarized from memory.

## 3. Every §8 mutation, run in this worktree (item 23), real red output, then reverted

Discipline used throughout: commit first (already done, §1), mutate, run the specific test(s), paste
the real failure, `git checkout -- <file>` to revert, confirm `git status --short` is clean again
before the next mutation. `git diff --stat` against `a9eae73` is empty after all of the below.

### C1 — payload no longer contains `check_in_at`/`check_out_at`/`updated_at`

**Mutation 1a, re-add `check_in_at`:**

```diff
+          check_in_at: row.checkInAt,
```

```
 FAIL  MarkDayCompleteDialog.test.tsx > ... T406 C1/C4: ...
AssertionError: expected "spy" to be called with arguments: [ [ { …(6) } ], …(1) ]
Received:
  [ [ { + "check_in_at": null, "hours_override": null, "method": "coach",
        "recorded_by": "profile-coach-1", "session_id": "session-1",
        "status": "present", "student_id": "student-1" } ], …(1) ]
Number of calls: 1
 ❯ MarkDayCompleteDialog.test.tsx:1312:33
Tests  1 failed | 54 skipped (55)
```

(Also independently reddened **both** C2 tests in `outreach.test.ts` — pasted under C2 below, since
that mutation is literally "the bug, reproduced," §8's C2 mutation 1.)

**Mutation 1b, re-add `check_out_at`:** same assertion, same failure shape —
`+ "check_out_at": null` appears in the diff, 1 failed / 54 skipped.

**Mutation 1c, re-add `updated_at`:** same assertion —
`+ "updated_at": "2026-08-04T04:49:32.384Z"` (a real, non-deterministic timestamp — proof this
wasn't a stale fixture value) appears in the diff, 1 failed / 54 skipped.

All three reverted (`git checkout -- src/lib/supabase/loaders/outreach.ts`), confirmed green again
each time.

### C2 — a row written between load and submit keeps `check_in_at` (post-write ROW STATE)

**Mutation 1, re-add `check_in_at` to the payload (the bug, reproduced):**

```
FAIL  outreach.test.ts > ... C2: a row written BETWEEN the dialog's load and its submit ...
AssertionError: expected null to be '2026-08-04T14:07:33.000Z' // Object.is equality
- Expected: "2026-08-04T14:07:33.000Z"
+ Received: null
 ❯ outreach.test.ts:682:30

FAIL  outreach.test.ts > ... C2 (subset-uniformity guard): a heterogeneous batch ...
AssertionError: expected null to be '2026-08-04T15:00:00.000Z' // Object.is equality
- Expected: "2026-08-04T15:00:00.000Z"
+ Received: null
 ❯ outreach.test.ts:739:37

Test Files  2 failed (2)
Tests  4 failed | 70 passed (74)
```

Both C2 tests (and, incidentally, the C1/C4 and C5 shape tests) go red on this mutation — expected,
since re-adding the key unconditionally is a strict superset of every narrower mutation.

**Mutation 2, re-add `check_in_at` to only a SUBSET of rows (the discriminating one)** — injected a
status-conditional into the mapper itself:

```diff
           recorded_by: row.recordedBy,
+          // re-add check_in_at ONLY for absence rows, leaving the rest narrowed
+          ...(row.status === 'absent' ? { check_in_at: row.checkInAt } : {}),
         })),
```

Ran only the discriminating test:

```
FAIL  outreach.test.ts > ... C2 (subset-uniformity guard): a heterogeneous batch -- one scanned
row plus one OTHER row -- still leaves the scanned row's check_in_at untouched ...
AssertionError: expected null to be '2026-08-04T15:00:00.000Z' // Object.is equality
- Expected: "2026-08-04T15:00:00.000Z"
+ Received: null
 ❯ outreach.test.ts:739:37
Tests  1 failed | 18 skipped (19)
```

This is the case a shape/call-args assertion cannot catch: the mutated code never adds `check_in_at`
to the **scanned** row's own object (student-1, status `'present'`) — only to the batch-mate absent
row (student-2). A test reading `mock.calls[0][0][0]` (student-1's own sent object) would see it
unchanged and pass. Only reading the fake's **post-write store** — where the union-of-keys
null-fill (E5) reaches student-1 even though its own row never named the key — catches it. Reverted;
confirmed clean.

### C3 — INSERT-leg row still carries `method`

**Mutation, drop `method`:**

```
FAIL  outreach.test.ts > ... C3: a student with NO prior row (the INSERT leg) still gets a
correct row written, carrying method ...
AssertionError: expected undefined to be 'coach' // Object.is equality
- Expected: "coach"
+ Received: undefined
 ❯ outreach.test.ts:771:25
Tests  1 failed | 2 passed | 16 skipped (19)
```

`T406-gate-report.md` E3, quoted verbatim for the DB-level half this vitest run cannot reach (no
Postgres present to raise 23502): `"ERROR:  null value in column \"method\" of relation
\"attendance\" violates not-null constraint"` — and on **both** the INSERT leg and the pure conflict
leg, per that report. Reverted; confirmed clean.

### C4 — `status`, `hours_override`, `recorded_by` still reach the write

Same test as C1 (`toEqual`, exact shape — dropping any required key leaves the sent object short one
key the expectation still names). Three separate mutations, each reverted before the next:

- **Drop `status`:** diff shows `- "status": "present"` missing from the received object; 1 failed
  / 54 skipped.
- **Drop `hours_override`:** `- "hours_override": null` missing; 1 failed / 54 skipped.
- **Drop `recorded_by`:** `- "recorded_by": "profile-coach-1"` missing; 1 failed / 54 skipped.

### C5 — T309's absence rows go through the narrowed payload unchanged

**Mutation, revert `buildAttendanceAbsenceRows`' contribution** (pre-T309 behaviour, return `[]`):

```
FAIL  MarkDayCompleteDialog.test.tsx > ... T406 C5: an absence row ... turns this red ...
AssertionError: expected [] to have a length of 1 but got +0
- 1
+ 0
 ❯ MarkDayCompleteDialog.test.tsx:1366:25
Tests  1 failed | 54 skipped (55)
```

Reverted (`git checkout -- src/pages/outreach/MarkDayCompleteDialog.tsx`); confirmed clean.

### C6 — `buildAttendanceWriteRows` byte-identical to `main` (`fa93516`), by sha256

Both `main`(`fa93516`) and this branch's `MarkDayCompleteDialog.tsx` have `buildAttendanceWriteRows`
at the **same** lines, 778–799 (I did not touch this file's code, only its test file):

```
$ sed -n '778,799p' src/pages/outreach/MarkDayCompleteDialog.tsx           > HEAD.txt
$ git show fa93516:src/pages/outreach/MarkDayCompleteDialog.tsx | sed -n '778,799p' > fa93516.txt
$ diff HEAD.txt fa93516.txt ; echo $?
0
$ sha256sum HEAD.txt fa93516.txt
0385ea2bc77a10ba08820d4180c23572432680528d70f58f41bb3c6278bbc3d8  HEAD.txt
0385ea2bc77a10ba08820d4180c23572432680528d70f58f41bb3c6278bbc3d8  fa93516.txt
```

**sha256 = `0385ea2bc77a10ba08820d4180c23572432680528d70f58f41bb3c6278bbc3d8`, identical on both sides.**
(Extraction boundary: the function's signature through its closing `}`, excluding its leading doc
comment — a disclosed, reasonable choice; the doc comment is also unedited, so hashing it in would
still match.)

### C7 — T327's ordering unchanged (attendance before the flip, adult totals last)

**Mutation, move the adult-volunteer step above the status flip:**

```
FAIL  outreach.test.ts > makeMarkDayComplete (T327) ... C1: writes attendance BEFORE flipping ...
FAIL  outreach.test.ts > makeMarkDayComplete (T327) ... C4: the adult-volunteer update still runs LAST ...
AssertionError: expected [ ... ] to deeply equal [ ... ]
  - "method": "update", "table": "event_sessions",   (expected here, second)
  + "method": "select", "table": "event_sessions",   (received here instead)
  ... "method": "update", "table": "event_sessions" moved to the END in Received
Tests  2 failed | 3 passed | 14 skipped (19)
```

Both of the **pre-existing** T327 order tests (`outreach.test.ts:474` and `:520`, exactly where the
packet's §7 says they already exist) go red — I added no new C7 test because these already
discriminate the named mutation. Reverted (`git checkout -- src/lib/supabase/loaders/outreach.ts`);
`npx tsc --noEmit` exit 0 afterward, confirming a clean revert, not just a green test suite.

## 4. The §2 bulk-path statement

`MarkEventCompleteDialog.tsx` is Forbidden but is a real caller: it imports `markDayComplete` from
this same loader module and its bulk-mode default `onMarkSessionComplete` prop is that exact
function (`:234` the import, `:460` the default — both grep-verified at those exact lines on my
branch). Its bulk path therefore flows through the identical narrowed `upsertAttendance` this task
changed, and gets the same TOCTOU protection for free — exactly as the packet's §1/§2 state.

**`MarkEventCompleteDialog.test.tsx` stays green with zero edits:**

```
$ git diff fa93516 a9eae73 -- src/pages/outreach/MarkEventCompleteDialog.tsx src/pages/outreach/MarkEventCompleteDialog.test.tsx | wc -l
0
$ npx vitest run src/pages/outreach/MarkEventCompleteDialog.test.tsx
 Test Files  1 passed (1)
      Tests  26 passed (26)
exit 0
```

It asserts the camelCase payload (`checkInAt` at `:1029`, confirmed by direct read) — this task
narrows only the snake_case DB mapping one layer downstream of that assertion, so it never sees the
change. I also ran `OutreachDetail.test.tsx` (mounts both dialogs) alongside it: 113 tests, all
green, zero edits to that file either — 139 combined, both files untouched by this task.

## 5. What this does NOT fix (§5, restated in my own words, for the record a second time)

This is a **partial** fix. `check_in_at`/`check_out_at`/`updated_at` are the only columns this task
can safely omit — `method` is `not null` with no column default, and the gate proved by executing
the narrowed upsert against a real PostgreSQL 16.13 that omitting it fails on **both** the INSERT
leg and the pure conflict leg (E3), not just INSERT as an earlier draft understated. So a coach's
stale dialog snapshot can still overwrite a concurrent QR scan's `method: 'qr'` with `'coach'`, even
after this fix — the scan's **timestamp** survives (the harm the owner actually described,
`auto-mode-decisions.md`'s "2026-08-03 — George lifts the T406 hold" entry), but its **provenance**
does not. My own C2 test asserts this directly (`row?.method` still equals `'coach'`, not `'qr'`,
in the very same assertion block that proves `check_in_at` survived) so the residual is pinned by a
running test, not just prose. Closing it needs a schema default or an insert/update split — out of
proportion for a provenance flag on a ~20-student team (item 25) — and per the packet, the
orchestrator files that follow-up; I did not build it and did not add a migration.

## 6. Findings against packet v2

I re-verified every citation in the packet I could check by execution or by reading the cited lines
directly (schema constraints against the real migration files, all three `markDayComplete` call
sites, the `vi.mock`/no-`vi.mock` claim for both test files, the "9 tests assert the load-seam call"
recount, the T327 order-test line numbers, §6's E1–E5/E7 quotes against the actual gate report). I
did not find a defect in the packet's own prose, prescriptions, or acceptance criteria — v2 appears
to have genuinely folded in both of v1's MAJORs and all four MINORs.

**One genuine, independent finding, outside the packet itself: this task's change makes a Forbidden
file's own documentation stale, and it was already partly stale before this task touched anything.**

`MarkEventCompleteDialog.tsx`'s own module doc (lines 191–193 on my branch, unedited — Forbidden
file, read-only) says:

> "a student with an existing recorded row is written back exactly as they already are, EXCEPT
> `attendance.recorded_by` (and `updated_at`), which `makeMarkDayComplete`'s upsert also names
> (`loaders/outreach.ts:1139-1149`)"

Two problems, one pre-existing and one this task adds:

1. **Pre-existing, predates T406 entirely:** the line citation `loaders/outreach.ts:1139-1149` was
   already wrong at `fa93516`, before I touched the file — those lines are
   `makeLoadGuardianLinksForParent`'s doc comment, not `upsertAttendance` (which lived at
   `:1258-1275` on `fa93516`; on my branch, after this task's own additions, `:1304-1315`). I did
   not introduce this drift and it is out of my Allowed Files to fix (Forbidden file); flagging it
   here since I found it while verifying §2's bulk-path claim.
2. **This task adds a second, substantive kind of staleness on top of it:** the sentence's claim —
   that `updated_at` is one of the two columns `makeMarkDayComplete`'s upsert "also names" — is now
   **false** in mechanism, even though the *outcome* it describes (the row's `updated_at` still
   moves on every write) is still true. Post-T406, the upsert no longer names `updated_at` at all;
   W1's DB trigger sets it implicitly on both legs. The comment's `recorded_by` half is unaffected
   (still explicitly named, still true).

This breaks no test — `MarkEventCompleteDialog.test.tsx` never asserts against this prose, confirmed
green above — so it is a **documentation-accuracy residual, not a functional regression**. I cannot
fix it: `MarkEventCompleteDialog.tsx` is Forbidden for this task. Per constitution item 20 (a
deliberate deferral must produce a follow-up ledger row, not just a comment), I am recording it here
rather than leaving it implicit, and recommend the orchestrator open a follow-up task — likely small,
likely FAST-tier (item 26: no write path, a prose-only change to one existing comment) — to correct
both the citation and the `updated_at` mechanism claim in `MarkEventCompleteDialog.tsx`'s module doc.

## Known risks

- The `method` residual (§5) is real and by design left open; a future task closing it needs either
  a migration (owned by W1, out of this task's Allowed Files) or an insert/update split (the exact
  shape T327 exists to avoid) — not proportionate here per item 25, filed rather than built.
- The documentation staleness in `MarkEventCompleteDialog.tsx` (§6 above) is cosmetic (a comment,
  not code or a test) but should not be left indefinitely, per item 20.
- This task does not change error handling: a rejected narrowed upsert still surfaces exactly as
  the pre-existing `runMutation`/`SupabaseLoaderError` path already did (untouched code).

## Dispute

None. The task was feasible as specified; no forbidden-file edit was needed; no acceptance
criterion was unmeasurable with today's fixtures.
