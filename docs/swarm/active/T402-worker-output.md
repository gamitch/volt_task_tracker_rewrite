# T402 Worker Output — outreach.ts's own `queryAttendanceForSessions` pagination

Branch `claude/t402-work`, built on `claude/t402-outreach-truncation` (`04088c1`, itself on `dcd0dae`).
Worktree: `.../scratchpad/t402-work`. `.env.local` absent throughout.

## 1. Commit SHA and proof the work is in the committed blob

**HEAD: `e733c1a22486010c16931179fa73f21462fe207d`** (two commits on top of the packet):

```
e733c1a T402: prettier --write on outreach.test.ts (gate 3 fix)
6ced7f8 T402: paginate outreach.ts's own queryAttendanceForSessions (mirrors T320)
04088c1 docs(T402): worker packet v1 (packet only -- not implemented)   <- branch point
```

Working tree is byte-identical to `HEAD` (`git status --short` → empty, `git diff --stat` → empty).
The diff is real and committed — against the branch point, not just the working tree (item 21):

```
$ git diff --stat 04088c1 HEAD
 src/lib/supabase/loaders/outreach.test.ts | 320 ++++++++++++++++++++++++++++++
 src/lib/supabase/loaders/outreach.ts      | 114 ++++++++++-
 2 files changed, 427 insertions(+), 7 deletions(-)
```

Only the two Allowed Files were touched (plus this output doc). `loaders/attendance.ts` (W1's,
Forbidden) was read for its shape and never modified — confirmed by `git diff --stat` above listing
only `outreach.ts`/`outreach.test.ts`.

## 2. Baseline, measured on my own branch point (`04088c1`), not copied

Measured in a separate worktree checked out at `04088c1` before touching anything, exactly matching
the orchestrator's stated dcd0dae-era figures (04088c1 is a docs-only commit on top of dcd0dae):

`tsc` exit 0 · `vite build` exit 0 · `format:check` exit 0 (clean) · `eslint .` exit 0, **0 errors /
362 warnings** · `vitest run` exit 0, **78 files / 1910 tests**. `outreach.test.ts` itself: 10 tests,
all passing.

## 3. All six gates on `HEAD` (`e733c1a`)

| # | Gate | Baseline | Result | Exit |
|---|---|---|---|---|
| 1 | `npx tsc --noEmit` | exit 0 | exit 0, no output | **0** |
| 2 | `npx vite build` | exit 0 | `✓ built in 5.74s` (pre-existing chunk-size advisory only) | **0** |
| 3 | `npm run format:check` | exit 0 clean | **failed on first run** (see below), exit 0 after fix | **0** (after fix) |
| 4 | `npx eslint .` | 0 errors / 362 warnings | **0 errors / 362 warnings — unchanged** | **0** |
| 5 | `npx vitest run` (full) | exit 0, 78 files / 1910 tests | **exit 1**, 78 files (77 passed / **1 failed**), 1916 tests (1914 passed / **2 failed**) | **1** |
| 6 | `npx vitest run src/lib/supabase/loaders/outreach.test.ts` (targeted) | 10/10 passing | **16/16 passing** (10 pre-existing + 6 new T402 tests) | **0** |

**Gate 3 detail (self-fixed, no scope issue).** First `format:check` run failed:
```
> volt-team-portal@0.0.0 format:check
> prettier --check "src/**/*.{ts,tsx}" "!src/theme/volt.ts" "*.{ts,js,json,html}"
Checking formatting...
[warn] src/lib/supabase/loaders/outreach.test.ts
[warn] Code style issues found in the above file. Run Prettier with --write to fix.
```
Exit code was **1** (confirmed via `$?` captured directly after the command, not after a pipe to
`tail` — the first attempt at checking this printed a stale `$?` from the `tail` in the pipeline,
which is exactly the "assert exit codes" trap the gate doc warns about). Ran `npx prettier --write
src/lib/supabase/loaders/outreach.test.ts` (only the file I authored), committed the 8-line diff
separately (`e733c1a`), re-ran — clean, exit 0.

**Gate 5 detail — the warning rise/regression explained.** `vitest run` (full suite) is **exit 1**,
not 0. This is NOT a bug in `outreach.ts`/`outreach.test.ts` (both green — see gate 6). It is exactly
the collateral finding recorded in §6 below: changing `queryAttendanceForSessions`'s PostgREST chain
from `.select().in()` to `.select().in().order().range()` breaks the stub shape of two **pre-existing**
tests in `src/pages/outreach/OutreachList.test.tsx` — a file outside this task's Allowed Files. Full
failure output:

```
 FAIL  src/pages/outreach/OutreachList.test.tsx > loadOutreachData (T101 real load) > filters events by season_id server-side, joins sessions/rsvps by id, and resolves a real per-student goal from students.goal_hours_override / seasons.default_goal_hours
Unknown Error: Couldn't load this data. Check your connection and try again.
Caused by: TypeError: client.from(...).select(...).in(...).order is not a function
 ❯ queryAttendanceForSessionsPage src/lib/supabase/loaders/outreach.ts:839:6
 ❯ src/lib/supabase/loader.ts:170:22
 ❯ loadAttendance src/lib/supabase/loaders/outreach.ts:1029:16
 ❯ src/lib/supabase/loaders/outreach.ts:1070:53
 ❯ src/pages/outreach/OutreachList.test.tsx:2568:20

 FAIL  src/pages/outreach/OutreachList.test.tsx > loadOutreachData (T101 real load) > issues the teams query in the SAME batch as students/seasons (zero-dependency), never serialized after the session-dependent batch
Unknown Error: Couldn't load this data. Check your connection and try again.
Caused by: TypeError: client.from(...).select(...).in(...).order is not a function
 ❯ queryAttendanceForSessionsPage src/lib/supabase/loaders/outreach.ts:839:6
 ❯ src/lib/supabase/loader.ts:170:22
 ❯ loadAttendance src/lib/supabase/loaders/outreach.ts:1029:16
 ❯ src/lib/supabase/loaders/outreach.ts:1070:53
 ❯ src/pages/outreach/OutreachList.test.tsx:2671:5

 Test Files  1 failed | 77 passed (78)
      Tests  2 failed | 1914 passed (1916)
```

I did **not** touch `OutreachList.test.tsx` — it is not in this task's Allowed Files
(`src/lib/supabase/loaders/outreach.ts` and its own test file, only), and my instructions are explicit:
"if a test outside your scope reddens, that is a finding — report it, do not fix it." See §6 for the
full writeup; this is stub-shape breakage (a `TypeError` from a chain the fake doesn't implement), not
a behavior regression, the identical class T320's own verification-log entry names for
`endMeeting.test.ts`/`AttendancePanel.test.tsx` when `attendance.ts` got the same treatment.

Net test delta: **+6 tests** (1910 → 1916: my 6 new `outreach.test.ts` tests), **+1 file-level
failure** (2 tests red in `OutreachList.test.tsx`, both pre-existing, both collateral, neither edited).

## 4. §4 decision — the one real risk — and the evidence behind it

**Decision: (a) — order by `id` without adding it to the `.select()` list.** The select stays exactly
`'session_id, student_id, status'`; only `.order('id', { ascending: true })` and `.range(from, to)`
were added to the query chain. `AttendanceDbRow` (this file's own narrower 3-column interface, byte-
identical), its mapper, and every downstream consumer are untouched.

**This was verified, not assumed, two independent ways** (the packet's own explicit requirement):

1. **PostgREST's own source.** I fetched `PostgREST/Query/QueryBuilder.hs` from the v14.16 tag
   (`cdn.jsdelivr.net/gh/PostgREST/postgrest@14.16/...`, via the environment's outbound proxy — direct
   `github.com` access is blocked by the sandbox, this CDN mirror is not). `readPlanToQuery`
   (`QueryBuilder.hs:46-68`) builds a plain table read as a single flat SQL statement:
   `SELECT <select-cols> FROM <table> [WHERE ...] [GROUP BY ...] ORDER BY <order-cols>
   LIMIT/OFFSET` — the `ORDER BY` clause operates on the underlying table scan, independent of what is
   projected in `SELECT`. Standard SQL allows `ORDER BY` to reference any column of the base table
   regardless of the `SELECT` list, for any plain, non-`DISTINCT`, non-grouped query — and this query
   has no aggregate `select` field, so PostgREST's own `groupF` never emits a `GROUP BY` that would
   change that. (I also fetched PostgREST's official docs pages — `Tables and Views` and `Errors` — and
   confirmed there is no error code or documented restriction for ordering by an unselected column; the
   `QueryBuilder.hs` read is the decisive evidence, the docs read is corroborating.)
2. **Live precedent already shipped in this exact codebase**, found by grep before writing any code:
   `outreach.ts`'s own `queryAllTeams` (a few functions below the one I edited) already does
   `.select('id, name, color').order('sort_order', { ascending: true })` — `sort_order` is not in the
   select list. `loaders/meetings.ts`'s `queryTeams` does the identical thing:
   `.select('id, name').order('sort_order', { ascending: true })`. Both are live, in production, today,
   and neither is part of this task's diff.

Both lines of evidence agree, so I did not add `id` to the select list. This is documented directly in
`queryAttendanceForSessionsPage`'s own doc comment in `outreach.ts` (not just here), so a future reader
does not have to re-derive it.

## 5. §5 decision — test seam

**Decision: test through the existing public caller, `makeLoadOutreachData` — no new function export.**
`queryAttendanceForSessions`/`queryAttendanceForSessionsPage` is file-local with exactly ONE caller
(`makeLoadOutreachData`'s own `loadAttendance` closure) and no other consumer anywhere in the codebase
— unlike `attendance.ts`'s `makeLoadAttendanceForSessions`, which `AttendancePanel.tsx` calls directly
and which T320 could therefore test in isolation. There is no pre-existing standalone factory to reach
this pagination behavior through without inventing new public API surface purely to shortcut testing.

All six new pagination tests (C1–C5, plus a secondary C2 call-shape check) go through
`makeLoadOutreachData(() => client)('season-1')`, with a shared `makeOutreachDataClient(attendanceTable)`
helper supplying minimal, fixed stubs for the loader's other five tables (`events`, `event_sessions`,
`rsvps`, `students`, `teams`, `seasons`) and letting each test swap in its own `attendance` table stub —
the same "compose a full client, vary the one table under test" shape `OutreachList.test.tsx`'s own
pre-existing `loadOutreachData` tests already use for this identical loader.

**One export was added, disclosed explicitly (item 20): `OUTREACH_ATTENDANCE_PAGE_SIZE`.** A plain
`export const = 1000` constant, not the query function. Added solely so the pagination boundary is
assertable from `outreach.test.ts` without a magic-number duplicate of `1000` that could silently drift
from the production value — the identical reason `attendance.ts`'s own `ATTENDANCE_PAGE_SIZE` is
exported (T320 precedent). No production consumer outside `outreach.ts` reads it.
`OUTREACH_ATTENDANCE_MAX_PAGES` (100) was deliberately kept **private**, matching T320's own choice —
the C3 test hardcodes `100` in its assertion (`/exceeded 100 pages/`) the same way `attendance.test.ts`
does.

## 6. Every mutation from §6, run, with real red output

All five run after committing (`e733c1a`), each applied, tested, reverted with
`git checkout -- src/lib/supabase/loaders/outreach.ts`, and confirmed byte-identical afterward
(`git status --short` empty). Command: `npx vitest run src/lib/supabase/loaders/outreach.test.ts`.

| Criterion | Mutation | Result | Exit |
|---|---|---|---|
| C1 | remove the pagination loop — return page 0 only | **3 red** (its own test + 2 collateral in the same describe block) | **1** |
| C2 | delete `.order('id', ...)` | **6 red** (its own two tests — the real proof AND the call-shape check — + 4 collateral) | **1** |
| C3 | replace the throw with `return rows` | **1 red** (isolated — only its own test) | **1** |
| C4 | remove the `< PAGE_SIZE` break | **4 red** (its own test + 3 collateral) | **1** |
| C5 | swallow the error, return `[]` | **1 red** (isolated — only its own test) | **1** |

**C1** (`return (await loadAttendancePage({ sessionIds, from: 0 })) ?? [];` in place of the loop):
```
AssertionError: expected [ …(1000) ] to have a length of 1001 but got 1000
 ❯ src/lib/supabase/loaders/outreach.test.ts:728:31
    728|     expect(result.attendance).toHaveLength(OUTREACH_ATTENDANCE_PAGE_SI…
```

**C2** (`.order('id', { ascending: true })` deleted from `queryAttendanceForSessionsPage`) — this is the
criterion the packet flags as most likely to be written vacuously, so the real proof is the
observable-consequence one, not the call-shape one:
```
AssertionError: expected 1463 to be 1500 // Object.is equality
- Expected
+ Received
- 1500
+ 1463
 ❯ src/lib/supabase/loaders/outreach.test.ts:804:35
    802|     expect(result.attendance).toHaveLength(TOTAL);
    803|     const uniqueStudentIds = new Set(result.attendance.map((row) => ro…
    804|     expect(uniqueStudentIds.size).toBe(TOTAL);
```
`1463 = 1500 - 37` — exactly the arithmetic the fake's design predicts by hand (37 duplicated ids from
the rotated page overlapping the first page's `0000-0036` range, 37 different ids in `1000-1036`
dropped entirely, net unique count `1500 - 37 = 1463`). Not a crash, not a call-count mismatch — an
actual duplicate/drop, which is the "observable consequence" the packet demanded rather than an
"`.order` was called" assertion. The secondary call-shape test (`orderSpy` called with `('id', {
ascending: true })`) also reddened, as expected, but that one alone would not have proven anything about
correctness — this is disclosed directly in that test's own name/comment.

**C3** (throw replaced with `return rows`):
```
AssertionError: promise resolved "{ events: [ { …(12) } ], …(6) }" instead of rejecting
- Expected
+ Received
- Error {
-   "message": "rejected promise",
+ {
+   "attendance": [ { "sessionId": "session-1", "status": "present", "studentId": "student-0" }, ... ],
...
 ❯ src/lib/supabase/loaders/outreach.test.ts:827:64
```

**C4** (the `if (pageRows.length < OUTREACH_ATTENDANCE_PAGE_SIZE) { return rows; }` block removed):
```
Error: queryAttendanceForSessions: exceeded 100 pages of 1000 rows without reaching the end of the result set
 ❯ loadAttendance src/lib/supabase/loaders/outreach.ts:1040:11
 ❯ src/lib/supabase/loaders/outreach.test.ts:838:20
```
With the break gone, the loop always runs all 100 iterations regardless of a short first page, then
hits the (still-present) exhaustion throw — the C4 test's own `await` on the loader rejects instead of
resolving with 2 rows and exactly 1 recorded `.range()` call.

**C5** (`loadAttendancePage(...)` wrapped in `try { ... } catch { pageRows = []; }`):
```
AssertionError: promise resolved "{ events: [ { …(12) } ], …(6) }" instead of rejecting
- Expected
+ Received
- Error {
-   "message": "rejected promise",
+ {
+   "attendance": [],
...
 ❯ src/lib/supabase/loaders/outreach.test.ts (assertion on rejects.toMatchObject)
```

All five reverted; `git status --short` empty after each; `npx tsc --noEmit` and
`npx vitest run src/lib/supabase/loaders/outreach.test.ts` both green (16/16, exit 0) on the restored
tree before moving to the next mutation.

## 7. Anything in the packet that is wrong

1. **The packet's framing understates the blast radius.** §0's tier justification says "single module
   (`loaders/outreach.ts`), no write path" and item 19b's "applying a proven pattern to a second
   surface" framing, implying an isolated change. In practice, copying T320's shape changes
   `queryAttendanceForSessions`'s PostgREST chain shape (`.select().in()` → `.select().in().order()
   .range()`), which is a **breaking change to the fake-client contract** any pre-existing test stub for
   this query must satisfy — and `OutreachList.test.tsx` (outside this task's Allowed Files) has two
   such tests. This is exactly the same "scope discovery" T320's own verification-log entry disclosed
   for `attendance.ts`'s callers (`endMeeting.test.ts`/`AttendancePanel.test.tsx`), but T402's packet
   does not mention it at all, and does not grant W2 the cross-boundary authorization T320's own
   worker/owner exchange used to fix it. I did not fix it (outside Allowed Files, and my own explicit
   instructions say report rather than fix a test outside scope) — flagging it here as the one thing
   most likely to need a follow-up decision, structurally identical to what became **T401** in T320's
   own row (a same-shape follow-up filed rather than silently absorbed).
2. **Minor: the packet's own line citation for the target function is already stale within this same
   packet.** §1 says "The ledger row says `:745-754`; it was at `:766` when this packet was written,"
   and correctly tells the worker to grep rather than trust either number — which is exactly right,
   since by the time I actually opened the file (after the packet's own v1 commit, no other edits in
   between) the function had NOT moved from `:766` — so the packet's own stated number happened to
   still be accurate for me, but only because no other task landed in between. Not a defect, just
   confirms the packet's own "grep the name, don't trust the number" instruction was the correct
   posture to take literally, including for line numbers that happen to look current.
3. Everything else in the packet — the defect description, the two-function-name collision warning
   (confirmed real: `queryAttendanceForSessions` exists in both `attendance.ts` and `outreach.ts`,
   `upsertAttendance` exists in both, `AttendanceRecordState`-shaped duplication is real per W1's own
   file), the T320 shape to copy, and the C1–C5 acceptance criteria — checked out accurate against the
   tree I actually worked on.

## 8. Files changed

- `src/lib/supabase/loaders/outreach.ts` — `queryAttendanceForSessions` replaced with
  `queryAttendanceForSessionsPage` (paginated, `.order('id').range(...)`) plus a pagination loop inside
  `makeLoadOutreachData`'s `loadAttendance`. New: `OUTREACH_ATTENDANCE_PAGE_SIZE` (exported, §5),
  `OUTREACH_ATTENDANCE_MAX_PAGES` (private). `AttendanceDbRow`'s doc comment gained a note explaining
  why `id` is not in the select list.
- `src/lib/supabase/loaders/outreach.test.ts` — 6 new tests (C1–C5 + a secondary C2 call-shape check),
  plus the shared `makeOutreachDataClient`/`makeAttendancePagingTable`/fixture helpers they use.
- `docs/swarm/active/T402-worker-output.md` — this file.

`src/lib/supabase/loaders/attendance.ts` (W1's, Forbidden) was read only, never modified — confirmed by
`git diff --stat 04088c1 HEAD` above.

## 9. Known risks

- **The `OutreachList.test.tsx` collateral (§3 gate 5, §6/§7 above) is the primary open item.** Two
  pre-existing tests outside my Allowed Files are red at `HEAD`. I did not fix them. Whoever owns that
  file needs either explicit cross-boundary authorization (T320's own resolution path) or a follow-up
  ledger row to update those two stubs' shape (adding `.order()`/`.range()` to their `attendance` table
  chain) — a stub-shape fix only, no assertion needs weakening.
- The C2 drift-based fake is a new testing pattern in this codebase (I found no prior example of a fake
  whose behavior depends on which chain methods were actually invoked, rather than canned per-call
  responses). It is deliberately over-engineered relative to `attendance.test.ts`'s own call-shape-only
  precedent, specifically because the packet named that exact shortfall as the most likely place to ship
  a vacuous test.

## Not filing a dispute

The task was implementable as specified; §4's escalation condition (`.order('id')` not applying
cleanly) did not occur. The one real problem found (§3/§6/§7's `OutreachList.test.tsx` collateral) is
outside this task's Allowed Files and is reported per explicit instruction, not resolved unilaterally.

Do not mark this task complete. The orchestrator replays every mutation independently (STANDARD tier,
no separate checker round).
