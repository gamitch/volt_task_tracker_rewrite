# T181 worker output — `ParentHome` gets a real backend

Worker: sonnet (`worker-implementer`, worktree). Packet revision 2, pinned
`c86e7fe0d5f04961d384d0f96074a0714565c9f7`. Commit produced by this task:
`a0d02fbeab915c643060809e1ff29219df795eb4` (HEAD moved from the merge
fast-forward tip `c86e7fe0d5f04961d384d0f96074a0714565c9f7`).

## Merge result

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z   # fast-forward: f7ff055 -> c86e7fe
npm ci                                       # 340 packages installed, clean
```

Fast-forward, no conflicts. Verified:

```
git log -1 --format=%H -- docs/swarm/active/T181-worker-packet.md
c86e7fe0d5f04961d384d0f96074a0714565c9f7
```

Matches the pinned SHA exactly — proceeded on revision 2 as instructed.
`docs/swarm/active/T181-gate-round1-findings.md` read in full before writing
any code.

## Citation verification (item 19c)

Every citation I relied on that materially shaped the implementation was
checked directly against the tree before use:

- `supabase/migrations/20260717000002_rls.sql`: `my_student_ids()` (lines
  20-26), `students`/`events`/`event_sessions`/`rsvps` `own_or_linked_read`
  policies, `teams` `read_all` (line 66) — all confirmed at the cited lines.
- `supabase/migrations/20260717000000_scheduling_attendance.sql`: `events`/
  `event_sessions`/`rsvps` column names/types — confirmed (lines 33-76).
- `supabase/migrations/20260723000001_dashboard_views.sql:322-334`:
  `v_student_goal_projection`'s `coalesce(s.goal_hours_override,
  se.default_goal_hours) as goal_hours` and its `where s.is_active` filter —
  confirmed verbatim at those exact lines (checked directly before writing
  both the loader's own module doc and `ParentHome.tsx`'s corrected module
  doc #2).
- `checkin.ts:405-411`/`:426`/`:455`/`:459`/`:489`, `students.ts:398-441`,
  `StudentMeetingView.tsx:354-373` — all read directly; the packet's
  description of the two `LoadLinkedStudentsFn` contracts, the
  factory-vs-singleton distinction, and `queryStudentsByIds`'s narrow
  `id, display_name` select all matched the tree exactly.

Nothing in the packet contradicted the tree. No stop-and-report needed on
this axis.

## Files changed

- `src/lib/supabase/loaders/parentHome.ts` (new) — real outer seam
  (`makeLoadLinkedStudentsForParentHome`/`loadLinkedStudentsForParentHome`)
  and per-card seam
  (`makeLoadStudentHomeCardDataForParentHome`/`loadStudentHomeCardDataForParentHome`).
- `src/lib/supabase/loaders/parentHome.test.ts` (new) — loader-level query
  proofs (14 tests).
- `src/pages/home/ParentHome.tsx` — module docs #1/#2/#7 corrected;
  `LinkedStudentRow`/`StudentHomeCardData`/`StudentHomeCardProps` reshaped
  (`goalHoursOverride`→`isActive`, `defaultGoalHours`→`goalHours`);
  `studentGoalHours()` deleted; factual `isActive` marker added; prop
  defaults rewired to the real loaders; fixture loader updated to source
  `goalHours` per-student directly instead of via the deleted coalesce.
- `src/pages/home/ParentHome.test.tsx` — `studentGoalHours` test/import
  removed (its own `it` block only, `hoursVsGoalPercent`'s own `it` left
  untouched per MINOR 10); "Ada: 62/100…" test updated for the renamed
  field; C1-C6/C10/C12 test blocks added (13 new `it`s).
- `src/pages/home/DashboardPage.test.tsx` — new module-level mock of
  `loaders/parentHome`; role-dispatch discriminators (coach/admin/student/
  parent) switched from `ParentHome`'s shipped fixture names to the new
  mocked non-fixture name.

## Per-criterion mutation evidence

Every mutation below was applied to the actual source, run, captured, then
reverted; `git status --short` / `git diff --stat` confirmed a clean
before/after state matching the Allowed Files list before committing.

### C1 — outer seam, regression proof (BLOCKER 1)

Positive (`renders injected non-fixture linked-student names/teams…`) — green
under the real code, unaffected by the mutation below (it injects its own
`loadLinkedStudents` prop explicitly).

**Mutation:** `ParentHome`'s prop default reverted
`loadLinkedStudents = loadLinkedStudentsForParentHome` →
`loadLinkedStudents = defaultLoadLinkedStudents`. Ran
`npx vitest run src/pages/home/ParentHome.test.tsx -t "C1"`:

```
× regression proof: no props at all renders the honest page-level error banner…
AssertionError: expected 'HomeCouldn\'t load this student\'s Ho…' to contain 'Couldn\'t load Home'
Received: "HomeCouldn't load this student's Home cardSomething went wrong loading this
student's data. Try refreshing the page.RetryCouldn't load this student's Home
card…Retry…Retry…You get a weekly summary by email every Sunday…"
```

Exactly the gate's own predicted shape (three fixture cards, each hitting
its own per-card error banner, page-level banner absent). Reverted; full
suite re-confirmed green.

### C2 — per-card data, regression proof (MAJOR 5)

**Mutation:** `loadStudentData = loadStudentHomeCardDataForParentHome` →
`loadStudentData = defaultLoadStudentHomeCardData` (loadLinkedStudents left
wired to the real default). Ran with `-t "C2"`:

```
× regression proof: per-card default omitted shows the per-card error banner…
AssertionError: expected 'HomeZara VossNova SquadHours vs. goal…' to contain
"Couldn't load this student's Home card"
Received: "HomeZara VossNova SquadHours vs. goalZara Voss's hours vs. goal0 / 100 h
(0%)…Nothing scheduled…"
```

Cards succeed instantly with the fixture-shaped honest-zero defaults (Zara's
`studentId` matches no fixture row) instead of the per-card error banner —
matches the prescribed mutation exactly. Reverted.

### C3 — verbatim `goalHours` passthrough (constitution item 3, BLOCKER 2)

**Mutation:** reintroduced a scratch TS-side coalesce in
`makeLoadStudentHomeCardDataForParentHome` — an extra `.from('students')
.select('goal_hours_override').eq('id', studentId)` read, with
`goalHours: overrideValue ?? scope?.goalHours ?? 0` replacing the verbatim
line. Ran with `-t "C3"`:

```
× renders resolveStudentScope's real goal_hours (63) verbatim, never a co-present raw override (999)
AssertionError: expected '10 / 999 h (1%)' to be '10 / 63 h (15.9%)'
```

`999` leaks in exactly as the gate's own round-1 finding predicted
(`"expected 999 to be 63"`). Reverted; grep re-confirmed zero `??` adjacent
to `goal_hours_override`/`goalHoursOverride` in any production code path in
either `parentHome.ts` or `ParentHome.tsx` (the one sanctioned exception,
`scope?.goalHours ?? 0`/`scope?.confirmedHours ?? 0`, is the disclosed
honest-null fallback for a deactivated student, not a re-derived coalesce —
documented inline and in both module docs).

### C4 — deactivated student's card

**Mutation 1:** removed the `{!isActive && <Badge … />}` line from
`StudentHomeCard`'s render. Ran with `-t "C4"`:

```
× renders exactly one card, the factual "Not currently active" marker…
AssertionError: expected … to contain 'Not currently active'
× a sibling active student's real, non-zero figures never leak onto the deactivated card…
AssertionError: expected … to contain 'Not currently active'
```

Both C4 tests go red on the marker assertion only — the card, its
honest-zero figures (`0 / 1 h (0%)`), and the sibling's real figures
(`77 / 120 h (64.2%)`) all still rendered correctly (visible in the full
`Received:` text), confirming the mutation isolates exactly the marker, not
the rest of the card. Reverted.

**Mutation 2** (per the packet's own wording) is a data-construction
technique, not a source mutation — already encoded as the second permanent
test (`a sibling active student's real, non-zero figures never leak onto the
deactivated card`), which asserts both cards' distinct `aria-valuetext`
values simultaneously.

### C5 — next-3-events, row-mapper mutation (MAJOR 6)

**Mutation:** `mapEventDbRow` hardcoded `type: 'meeting'` for every row
(instead of `row.type`). Ran with `-t "C5"`:

```
× each student's card shows only its own team's event(s)…
AssertionError: expected 'Farah Delacroix\'s next eventsRegiona…' not to contain 'Regional Qualifier'
Received: "Farah Delacroix's next eventsRegional QualifierWed, Sep 2 · 7:00 AM–8:00 AM
Meeting — read-onlyAll-Teams Robotics ExpoFri, Sep 4…Team A Build NightSat, Sep 5…"
```

The mislabeled competition event leaks into the Next-up list exactly as
gate-predicted. Reverted.

### C6/C12 — zero-linked-students vs. unresolved session (MINOR 8)

C12's own criterion text prescribes no separate throwaway mutation (unlike
C1-C5) — the paired positive/negative tests themselves are the proof. I also
ran a bonus verification mutation for extra evidence: reverted
`makeLoadLinkedStudentsForParentHome`'s `sessionUser === null` branch from
`throw new Error(...)` back to `return { students: [], teams: [] }` (the
round-1 default). Ran both the loader-level and component-level C12 tests:

```
× makeLoadLinkedStudentsForParentHome > throws … when the session itself fails to resolve
AssertionError: promise resolved "{ students: [], teams: [] }" instead of rejecting

× C12: an unresolved session (null, no error) never renders "No linked students yet"…
AssertionError: expected 'No linked students yetOnce a student …' to contain "Couldn't load Home"
Received: "No linked students yetOnce a student is linked to your account, their Home
card will show up here."
```

Confirms the false, specific claim MINOR 8 exists to prevent is genuinely
reachable without the fix, and genuinely closed with it. Reverted.

### C10 — the two `loadLinkedStudents` contracts, proof by attempted misuse

Grep (real command, run against the committed source, not a permanent
test):

```
$ grep -n "loadLinkedStudents\|makeLoadLinkedStudents\|LinkedStudentSummary" src/lib/supabase/loaders/parentHome.ts
```

Every match is either a comment/module-doc citation or one of this file's
own non-colliding `…ForParentHome` names — confirmed no bare
`loadLinkedStudents`/`makeLoadLinkedStudents`/`LinkedStudentSummary` import
anywhere in the file (import block: `getSupabaseClient`, `createLoader`,
`makeLoadConsistencyStripData` from `checkin.ts`, `makeResolveStudentScope`
from `students.ts`, and types from `ParentHome.tsx` — nothing else).

Scratch compile experiment (`src/pages/home/__t181_c10_scratch.ts`, created,
run, then deleted — never committed, confirmed via `git status --short`
before commit):

```ts
import { loadLinkedStudents as checkinLoadLinkedStudents } from '../../lib/supabase/loaders/checkin';
import type { LoadLinkedStudentsFn } from './ParentHome';
const misused: LoadLinkedStudentsFn = checkinLoadLinkedStudents;
```

`npx tsc --noEmit` output (verbatim):

```
src/pages/home/__t181_c10_scratch.ts(9,7): error TS2322: Type 'import(".../src/pages/meetings/StudentMeetingView").LoadLinkedStudentsFn' is not assignable to type 'import(".../src/pages/home/ParentHome").LoadLinkedStudentsFn'.
  Type 'Promise<LinkedStudentSummary[]>' is not assignable to type 'Promise<LinkedStudentsResult>'.
    Type 'LinkedStudentSummary[]' is missing the following properties from type 'LinkedStudentsResult': students, teams
```

Matches the gate's own captured error exactly. File deleted immediately
after; `git status --short` confirmed no trace before commit.

### C11 — `DashboardPage.test.tsx` role-dispatch discriminators (MAJOR 4)

**Mutation** (packet-prescribed, scratch, uncommitted): `DashboardPage.tsx`'s
`case 'parent':` temporarily changed to `return <CoachHome />;`. Ran
`npx vitest run src/pages/home/DashboardPage.test.tsx -t "parent"`:

```
× DashboardPage role dispatch > renders ParentHome for role "parent"
AssertionError: expected 'HomeNew outreach eventTeam participat…' to contain 'Dashboard Fixture Linked Student'
Received: "HomeNew outreach eventTeam participation—Season to date…" (CoachHome's own content)
```

Reverted; `git diff --stat src/pages/home/DashboardPage.tsx` confirmed empty
before commit (this file was never part of the Allowed list — only its test
file was — so it carries zero committed diff).

## Five gates — computed at my own merge base / dispatch SHA

Merge base: `c86e7fe0d5f04961d384d0f96074a0714565c9f7` (fast-forward tip).
Baselines per packet: 67 files / 1605 tests, eslint 0 errors / 357 warnings.

1. **`tsc --noEmit`** — clean, zero errors (re-confirmed after every
   mutation revert and after the final prettier pass).
2. **`vite build`** (`npm run build`) — succeeds, `2391 modules
   transformed`, `✓ built in ~7s`. Same pre-existing single "chunk >500kB"
   advisory as before this task (unrelated, not touched by this task).
3. **`format:check`** — clean after running `prettier --write` once on the
   three files it initially flagged (`parentHome.ts`, `parentHome.test.ts`,
   `ParentHome.test.tsx`); re-verified clean after that.
4. **`eslint`** — **0 errors, 356 warnings** — the expected `−1` from
   deleting `studentGoalHours()`'s export (confirmed, not drifted).
5. **`vitest run`** — **68 files / 1631 tests, all passed** (baseline 67/
   1605). Delta: **+1 file** (`parentHome.test.ts`, new), **+26 tests**:
   - `ParentHome.test.tsx`: pre-task 31 `it(` blocks (42 combined
     `describe(`+`it(` per the packet's own orientation, independently
     re-confirmed via `git show <pinned-sha>:…|grep -c`), now 43 `it(`
     blocks → **+12** (13 new C1-C6/C10/C12 tests, −1 removed
     `studentGoalHours` test).
   - `parentHome.test.ts`: **+14** (new file).
   - `DashboardPage.test.tsx`: unchanged count, **5 `it(` blocks both
     before and after** (independently confirmed against the pinned SHA) —
     only assertion content changed, no test added/removed.
   - `+12 +14 +0 = +26`, matching `1631 − 1605` exactly.

Zero `.skip`/`.only`/`.todo` anywhere (grep-confirmed empty across all three
touched test files).

## C9 — sabotage/enumeration check

`git diff --stat` against the merge base touches exactly:
`src/pages/home/DashboardPage.test.tsx`, `src/pages/home/ParentHome.test.tsx`,
`src/pages/home/ParentHome.tsx`, plus the two new files
`src/lib/supabase/loaders/parentHome.ts`/`parentHome.test.ts`. Zero diff
against `guards.tsx`, `checkin.ts`, `students.ts`, `parents.ts`,
`StudentMeetingView.tsx`, `StudentHome.tsx`, `CoachHome.tsx`,
`DashboardPage.tsx` (the component itself), or any `supabase/migrations/**`
file — confirmed via `git status --short`/`git diff --stat` immediately
before the commit.

Pre-existing assertions touched, mechanical-rename vs. behavior-change:

- `ParentHome.test.tsx` imports: removed `studentGoalHours` (deleted
  function) — mechanical.
- `describe('studentGoalHours / hoursVsGoalPercent …')` → renamed to
  `describe('hoursVsGoalPercent …')`, its own `it('falls back to the season
  default…')` deleted (the function it tested no longer exists) — mechanical,
  scoped to exactly `studentGoalHours`'s own `it` block, per MINOR 10;
  `hoursVsGoalPercent`'s own `it` untouched.
- `"Ada: 62/100 hours…"` test: `studentGoalHours(ada, data.defaultGoalHours)`
  → `data.goalHours` plus a new explicit `expect(data.goalHours).toBe(100)`
  — mechanical rename of the field being read, same underlying value (100),
  no behavior change.
- `DashboardPage.test.tsx`: four `it(` bodies (`coach`/`admin`/`student`/
  `parent`) had their `'Ada R.'`/`'Bea R.'`/`'Cleo R.'` literals replaced
  with the new mocked `'Dashboard Fixture Linked Student'`/`'Dashboard
  Fixture Parent Team'` — behavior-preserving rename of the discriminator
  value (the role-dispatch logic under test is unchanged); this was
  MAJOR 4's own explicit fix, not incidental.

## Disclosed query fan-out (MINOR 11, not fixed — final-round trade-off)

Per card: `event_sessions`, `attendance`, `v_student_participation` (all
three inside the reused `makeLoadConsistencyStripData`), plus this task's
own `v_student_goal_projection`, `events`, `event_sessions` (a second,
fuller scan of the same table), `rsvps` — **7 round trips per card**, with
`event_sessions` scanned twice. A parent with 3 linked students: **21
per-card queries plus ~4 outer-seam queries** (session lookup,
`guardian_links`, `students`, `teams`). Documented in
`loaders/parentHome.ts`'s own module doc; not fixed, per the packet's own
explicit instruction (forking the reused strip loader's internals to dedupe
would abandon the clean, checker-verified-elsewhere reuse this design is
built on — a worse trade on a round with no gate behind it).

## Design decisions implemented, not relitigated

- The outer-seam loader throws (not `{students: [], teams: []}`) when the
  session itself fails to resolve — MINOR 8, the foreman's decision,
  implemented verbatim and mutation-verified above (C12).
- The deactivated-student card gets a factual `"Not currently active"`
  marker (never T184's three-way union) — the foreman's design call,
  labeled as such in both the module doc and `StudentHomeCardProps`' own
  doc comment, not attributed to the owner.

## Unverified / stated plainly

- No live Supabase instance exists in this environment — every RLS claim in
  `loaders/parentHome.ts`'s own module doc (and this task's citation
  verification above) is **reasoned against the migration source, not
  measured against a live database** — same disclosed gap every loader in
  this codebase already carries, explicitly labeled as such in the new
  loader file's own module doc (criterion C7).
- `makeLoadConsistencyStripData`'s own internals (the reused strip loader)
  have no dedicated unit test file anywhere in this codebase yet
  (`checkin.test.ts` does not exist) — this task did not add one; it is
  outside this task's own scope (that loader is Forbidden-file/read-only
  reference), and its correctness is assumed on the strength of its own
  prior checker verification, not re-proven here.
- I did not attempt to measure real Supabase RLS behavior for the
  double-`event_sessions`-scan cost disclosed above; the "7 round trips per
  card" count is a static read of the composed `Promise.all` calls in
  `makeLoadStudentHomeCardDataForParentHome` plus the three calls inside the
  reused `makeLoadConsistencyStripData`, not a captured network trace.

## Known risks

- The 7-per-card/21-total query fan-out for a 3-child parent is real and
  disclosed, not fixed — a future task could dedupe the double
  `event_sessions` scan by forking or extending the reused strip loader.
- `queryTeams`/`queryEvents`/`queryEventSessionsFull` are unfiltered
  full-table reads (RLS-scoped, matching `checkin.ts`'s own established
  idiom for the identical `event_sessions` table) — fine at this
  environment's scale, a potential cost concern at a much larger team-count
  scale, not addressed here (out of this task's disclosed scope).

## Disputes

None filed. The packet's revision 2 was internally consistent with the tree
at every citation I checked; no BLOCKER-class conflict encountered.

**This task is not marked complete by me — a checker verifies it.**
