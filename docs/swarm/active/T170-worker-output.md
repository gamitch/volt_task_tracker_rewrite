# T170 — Worker Output

**Packet SHA verified:** `git log -1 --format=%H -- docs/swarm/active/T170-worker-packet.md`
printed `d74dc203c7ff9b2026d13c0aa57731273909e820`, matching the required
revision-2 pin exactly.

## 1. Merge result

**Round 1 (initial dispatch):**
```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
npm ci
```
Fast-forward, no conflicts. Resulting HEAD (== `origin/claude/swarm-plan-zl575z`
tip == the packet's own pinned commit): `d74dc203c7ff9b2026d13c0aa57731273909e820`.
`npm ci` completed cleanly (340 packages, 9 pre-existing `npm audit`
vulnerabilities, unrelated to this task, not touched).

**Round 2 (checker gate round 1 MAJOR fix, this pass):**
```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```
Branch had moved (T184 packet added upstream). My branch had also diverged
(my own T170 commit `9682c82`), so this was a real, non-fast-forward merge —
merge strategy `ort`, **zero conflicts**, 3 files changed (all
`docs/swarm/**`, none touching my two files). Resulting HEAD:
`e8744bad2c715b3f7bfa60d268ca7a5e03c60d79`.

## 2. Files changed

- `src/pages/outreach/OutreachList.tsx` (allowed)
- `src/pages/outreach/OutreachList.test.tsx` (allowed, explicitly authorized
  by the packet as a "deliberate, disclosed addition" the same way prior
  tasks on this file already established)

No other file touched. `router.tsx`, `loaders/outreach.ts`,
`loaders/selfCheckoff.ts`, `loaders/meetings.ts`, `MeetingsList.tsx`,
`StudentHome.tsx` were all read-only references, never edited.

## 3. Summary of changes

`OutreachList.tsx`'s `viewerStudentId` no longer defaults to
`PLACEHOLDER_CURRENT_STUDENT_ID`. A new `resolveStudentId?: ResolveCurrentStudentIdFn`
prop (default `resolveCurrentStudentId`, imported verbatim from
`loaders/meetings.ts`; `CurrentViewerIdentity`/`ResolveCurrentStudentIdFn`
imported verbatim from `MeetingsList.tsx`, same relative-sibling import
`StudentHome.tsx:387` already uses) resolves the real, signed-in viewer's
`students.id`.

Design, exactly as prescribed in packet §5 (parallel, not sequential):
`OutreachListLoaded` now runs a **second** `useLoadState` call alongside its
existing season-data load, both firing on the same initial mount:

```ts
const viewerStudentIdState = useLoadState<string | null>(
  () =>
    isCoachOrAdminView
      ? Promise.resolve(null)
      : explicitViewerStudentId !== undefined
        ? Promise.resolve(explicitViewerStudentId)
        : resolveStudentId(viewer),
  [isCoachOrAdminView, explicitViewerStudentId, resolveStudentId, viewer.id, viewer.role],
);
```

A new `ViewerStudentIdGate` component owns the identity tier's own
loading/error/null DES-12 sub-states (distinguishable from the season-data
tier's own skeleton/error), reusing `StudentHome.tsx`'s established copy
verbatim ("Finding your student record…" / "Couldn't find your student
record" / "No student account linked yet"), adapting only the null-state
description's page-specific clause to "...your outreach view will show up
here." It renders `StudentParentOutreachView` (and therefore
`SelfCheckoffDialog`) only once identity has resolved to a real, non-null id
— so a `null` identity (no linked student) means `SelfCheckoffDialog` never
mounts.

`computeStudentHours`, `getUnansweredRsvpCount`, `computeEventRowStats`, and
the `myGoalHours` expression are byte-unchanged (verified by diff, §criterion
5 below) — only the argument now flowing into them changed.

## 3a. Checker gate round 1 — FAIL (one MAJOR), test-only fix, source untouched

The checker independently reproduced all five gates exactly, confirmed
sabotage-clean, confirmed assertion-integrity clean (82→90 `it(` titles, only
8 additions/0 removals/0 edits, no `.skip`/`.only`/`.todo`, blast radius 10/90
reproduced), confirmed the `ViewerStudentIdGate` deviation benign, and
confirmed the criterion-4 near-miss was correctly recorded rather than a real
weakness. **The implementation itself was judged correct and was not asked to
change.**

**The MAJOR:** a mutation at `OutreachList.tsx:3877` that discards the
resolver's real return value whenever non-null —

```ts
: resolveStudentId(viewer).then((id) => (id === null ? null : PLACEHOLDER_CURRENT_STUDENT_ID)),
```

— fully restores the original bug (every real student gets the placeholder
back on the exact no-props path `router.tsx:244` exercises) and **passed
90/90**. I reproduced this myself, verbatim, before making any change:

```
Test Files  1 passed (1)
     Tests  90 passed (90)
```

**Root cause, confirmed:** every one of criteria 1, 2(a), and 10's positive
assertions rendered with an **explicit** `viewerStudentId: DISTINCT_STUDENT_ID`
prop, which short-circuits `resolveStudentId` before it is ever called
(`:3875-3876`). No test rendered with **no** explicit prop and checked that
the resolver's own distinct return value reached the rendered figures or the
self-check-off dialog — the exact hazard the packet's own §3(c) flagged.

**Fix applied (test-only, source verified byte-identical to committed HEAD
before and after):** two new tests added, both rendering with **no**
explicit `viewerStudentId` prop, resolving via
`resolveStudentId: async () => DISTINCT_STUDENT_ID` instead:

- `criterion 1 (resolver path, no explicit prop)` — same positive figures
  (`"2 hrs confirmed"`, `"3 hrs planned"`, `"1 awaiting your RSVP"`,
  `GoalBar`'s `aria-valuetext`), reached via the resolver only.
- `criterion 10`'s own resolver-path test — same
  `loadSelfCheckoffAttendance` spy assertion, reached via the resolver only.

**Verification against the exact prescribed mutation, re-run myself:**
applied `resolveStudentId(viewer).then((id) => (id === null ? null :
PLACEHOLDER_CURRENT_STUDENT_ID))` at `:3877` again, with the two new tests
in place:

```
FAIL  ... criterion 1 (resolver path, no explicit prop): the SAME positive figures...
AssertionError: expected 'Outreach2 awaiting your RSVPYour seas…' to contain '2 hrs confirmed'
Expected: "2 hrs confirmed"
Received: "Outreach2 awaiting your RSVPYour season goalConfirmed0 hrs confirmed..."

FAIL  ... criterion 10 ... calls loadSelfCheckoffAttendance with the resolver-returned id, with NO explicit viewerStudentId prop
AssertionError: expected 'student-placeholder-current-viewer' to be 'student-real-c1'
Expected: "student-real-c1"
Received: "student-placeholder-current-viewer"

Test Files  1 failed (1)
     Tests  2 failed | 90 passed (92)
```

**RED, exactly as required.** Reverted the mutation (`git diff` on the
source file empty afterward, confirming the source file is unchanged from
the committed round-1 state); re-ran — **92/92 GREEN**.

**Audit of every other positive criterion** (checker's instruction: "for
each, ask whether it would still pass if resolution were broken but the
explicit prop supplied"):
- Criterion 2 — its own subject IS the explicit-prop-bypass behavior; its
  vacuity-probe half already renders with no explicit prop and a broken
  resolver, independently exercising the resolver-failure path. Not
  vulnerable to this defect class.
- Criterion 3 — coach view; never supplies `viewerStudentId` at all, and
  `isCoachOrAdminView` short-circuits before either the explicit-prop check
  or `resolveStudentId` is reached. Not vulnerable.
- Criterion 4 (loading/error/null) — none of the three tests supply an
  explicit `viewerStudentId`; all three exercise `resolveStudentId` directly.
  Not vulnerable.
- Criteria 1 and 10 were the only two vulnerable to this exact shape — both
  fixed above. No further instance found.

Two evidence imprecisions in this document (below, §4) were also corrected
per the checker's finding: criterion 4(ii)'s blast radius understated (it
also reds criterion 2's vacuity probe, not just criterion 4's own error
test), and criterion 6's `is_active` grep count was reported as 1 hit when
it is genuinely 2 (one doc comment, one real filter).

## 4. Per-criterion mutation evidence

All mutations run in this worktree only (item 23), applied via `Edit`,
confirmed RED with real `vitest` output, reverted, confirmed GREEN again.

### Criterion 1 — real resolved id reaches every consumer (positive, distinct fixture)

Test: `criterion 1: real resolved id reaches every consumer...` — constructs
`sessions`/`rsvps`/`goalConfig` keyed to fabricated `student-real-c1` (2h
confirmed / 3h planned / 1 unanswered / 20h goal), asserts rendered
`"2 hrs confirmed"`, `"3 hrs planned"`, `"1 awaiting your RSVP"`, and
`GoalBar`'s `aria-valuetext === "2 of 20 hours confirmed; 3 more planned"`.

**Mutation:** in `ViewerStudentIdGate`, changed
`viewerStudentId={state.data}` → `viewerStudentId={PLACEHOLDER_CURRENT_STUDENT_ID}`.

**RED (actual output):**
```
AssertionError: expected 'Outreach2 awaiting your RSVPYour seas…' to contain '2 hrs confirmed'
Expected: "2 hrs confirmed"
Received: "Outreach2 awaiting your RSVPYour season goalConfirmed0 hrs confirmedPlanned0 hrs plannedGoal0 hrs% of goal0%..."
```
(This same mutation also broke criterion 10's test in the same run —
`loadSelfCheckoffAttendance` was called with
`'student-placeholder-current-viewer'` instead of `'student-real-c1'` —
confirming the mutation's blast radius matches the design: one prop feeds
both the read-side figures and the write-side dialog.)

Reverted; re-ran — GREEN (2/2 passed).

**Round-2 addendum:** this test alone was insufficient — see §3a. A sibling
test, `criterion 1 (resolver path, no explicit prop)`, was added, rendering
with no explicit `viewerStudentId` and `resolveStudentId: async () =>
DISTINCT_STUDENT_ID` instead, asserting the identical positive figures.
Mutation and RED output for that test are in §3a.

### Criterion 2 — explicit `viewerStudentId` bypasses `resolveStudentId`, paired

Two tests: (a) explicit prop given, `resolveStudentId` spy never called +
distinguishable content renders; (b) vacuity probe — a broken
`resolveStudentId` (`throw`) is injected; the explicit-prop render stays
GREEN (`"2 hrs confirmed"` present, error banner absent), a **separate**
no-explicit-prop render with the same broken function goes RED — proving the
probe isn't vacuously green.

**Mutation A** (source): loader body changed from the conditional ternary to
always call `resolveStudentId(viewer)` regardless of `explicitViewerStudentId`.

**RED (actual output):**
```
AssertionError: expected "spy" to not be called at all, but actually been called 1 times
  1st spy call: [ { "id": "user-student", "role": "student" } ]

AssertionError: expected 'Couldn\'t find your student recordSom…' to contain '2 hrs confirmed'
Expected: "2 hrs confirmed"
Received: "Couldn't find your student recordSomething went wrong looking up your student record. Try refreshing the page.Retry"
```
Both criterion-2 tests failed under this one mutation. Reverted; re-ran —
GREEN (2/2 passed).

**Mutation B (vacuity probe)** is exercised directly inside the test itself
(no source edit needed): a broken `resolveStudentId` is passed as a prop in
two separate renders — one with an explicit `viewerStudentId`, one without.
Both assertions (explicit-prop stays green, no-explicit-prop goes red) are
captured in the single test's own pass/fail, already shown green above under
the real (unbroken) default resolver in the harness, and independently
verified against the real broken-resolver behavior in the same test run
(the "vacuity probe" `it(` itself passed, meaning both its internal
assertions — the green explicit-prop render and the red no-explicit-prop
render — were true in the same execution).

### Criterion 3 — coach/admin view never calls `resolveStudentId`, paired with a positive control

Test renders `COACH_USER` against `defaultLoadOutreachData` (populated,
successful), first asserts the coach-only "New outreach event" button is on
screen (positive control), then asserts `resolveStudentId` was never called.

**Mutation:** loader body changed to
`resolveStudentId(viewer).then((id) => isCoachOrAdminView ? null : ...)` —
i.e. the loader now unconditionally calls `resolveStudentId`, only
discarding its result for a coach.

**RED (actual output):**
```
AssertionError: expected "spy" to not be called at all, but actually been called 1 times
  1st spy call: [ { "id": "user-coach", "role": "coach" } ]
```
The positive control (`newEventButtons.length > 0`) was confirmed to still
pass under this same mutation (the test run reported only the spy assertion
line as the failure point, i.e. execution reached line 1949 having already
passed line 1947) — proving the mutation broke the right thing, not the
whole render. Reverted; re-ran — GREEN.

### Criterion 4 — identity tier's own loading/error/null sub-states, isolated

Three tests, one per sub-state. Each sub-state's own copy was mutated in
isolation (source-code copy strings, not the test assertions) and the other
two confirmed to stay GREEN:

**Mutation (i), loading copy** `"Finding your student record…"` →
`"Looking things up…"`:
```
× loading: shown while resolveStudentId is still pending
AssertionError: expected 'Looking things up…' to contain 'Finding your student record'
✓ error: shown when resolveStudentId rejects
✓ null: shown when resolveStudentId resolves null...
```
(Note: an earlier, weaker mutation — merely *prefixing* the loading text with
`"MUTATED-"` — stayed GREEN, since `.toContain('Finding your student record')`
is a substring match. This is recorded as a genuine near-miss the mutation
step caught: the assertion is not vacuous against a real content change, but
is insensitive to a prefix-only mutation. The stronger, fully-replacing
mutation above is the one that counts as the prescribed "mutate state (i)'s
copy" proof, and it produced the RED shown above.)

**Mutation (ii), error copy** `"Couldn't find your student record"` →
`"Something broke while looking things up"`:

**Correction (checker gate round 1):** the original version of this document
reported this mutation's blast radius as confined to criterion 4's own
describe block (1 failure). Re-run against the FULL test file, it is
genuinely **2 failures**, not 1 — criterion 2's own vacuity-probe test
(`vacuity probe: a broken resolveStudentId does not affect the explicit-prop
render, but DOES break a separate no-explicit-prop render`) also asserts on
this exact same copy string for its own no-explicit-prop half, and reds
under the identical mutation:

```
FAIL ... criterion 2 ... vacuity probe: a broken resolveStudentId does not affect the explicit-prop render, but DOES break a separate no-explicit-prop render
AssertionError: expected 'Something broke while looking things …' to contain 'Couldn\'t find your student record'
Expected: "Couldn't find your student record"
Received: "Something broke while looking things upSomething went wrong looking up your student record. Try refreshing the page.Retry"

FAIL ... criterion 4: identity tier own loading/error/null sub-states, isolated > error: shown when resolveStudentId rejects
AssertionError: expected 'Something broke while looking things …' to contain 'Couldn\'t find your student record'
Expected: "Couldn't find your student record"
Received: "Something broke while looking things upSomething went wrong looking up your student record. Try refreshing the page.Retry"

Test Files  1 failed (1)
     Tests  2 failed | 90 passed (92)
```

Isolation still holds — no OTHER test (criteria 1, 3, 4-loading, 4-null, 10,
or either resolver-path addition) failed under this mutation, so the claim
"(ii) RED / everything else GREEN" is correct, just with the correct count of
what "everything else" excludes (2 tests legitimately share this exact copy
string, not 1). Reverted; re-confirmed 92/92 GREEN.

**Mutation (iii), null copy** `"No student account linked yet"` →
`"Nothing here just yet"`:
```
✓ loading: shown while resolveStudentId is still pending
✓ error: shown when resolveStudentId rejects
× null: shown when resolveStudentId resolves null (no linked student)...
```

All three reverted; full describe block re-confirmed GREEN (3/3).

### Criterion 5 — no metric re-derivation (inspection-level, diff-based)

`git diff -U0 -- src/pages/outreach/OutreachList.tsx | grep '^@@'` shows every
hunk confined to: doc-comment lines 225–746 (module docs #7/#12/#15 + new
imports), and the `OutreachListLoaded`/`OutreachListProps`/`OutreachList`
region lines 3706–4152. `computeStudentHours` (defined at line 1277),
`getUnansweredRsvpCount` (1367), and `computeEventRowStats` (1766) are all
outside every hunk range — byte-unchanged. `myGoalHours`'s own expression
(`goalConfig.individualGoalHoursByStudentId[viewerStudentId] ?? 0`, line
3650) is likewise outside every hunk range — unchanged.

### Criterion 6 — T184 trap, both halves, independently re-verified

**Read side:** `loaders/outreach.ts:908-968`'s `makeLoadOutreachData` (the
exact range the packet asked me to independently trace) calls
`queryEventsBySeason` (`.eq('season_id', seasonId)`), `querySessionsForEvents`
(`.in('event_id', ...)`), `queryRsvpsForSessions` (`.in('session_id', ...)`),
`queryAttendanceForSessions` (`.in('session_id', ...)`), `queryAllStudents`
(no filter beyond `.order(...)`), and `queryAllTeams`. `grep -n "is_active"
src/lib/supabase/loaders/outreach.ts` returns **two** hits (corrected — the
original version of this document said "exactly one hit, at line 829"; the
substance was right, the count was wrong): line 184 (a doc-comment
paraphrase, "`is_active = true`, `.maybeSingle()`... same pattern", not
executable code) and line 829, the one real filter, inside
`queryActiveSeasonId` (`seasons.is_active`, unrelated to students and not
part of `makeLoadOutreachData`'s own load path at all — it backs a different
function). **No `students.is_active` filter exists anywhere in this file, in
either the doc comment or the code.** Confirms no third T184-class
disagreement: a deactivated student's own historical sessions/rsvps/attendance
are never silently dropped from `data.sessions`/`data.rsvps`/`data.attendance`.

**Write side:** re-confirmed directly against the real migration files
(not trusted from the packet's own citation): `my_student_ids()`
(`supabase/migrations/20260717000002_rls.sql:20-26`) is
`select id from students where profile_id = auth.uid() union select
student_id from guardian_links where parent_profile_id = auth.uid()` — no
`is_active` clause. `self_insert`/`self_delete`
(`supabase/migrations/20260724000000_self_checkoff.sql:56,75`) both gate on
`student_id in (select my_student_ids())` — also `is_active`-agnostic.
`queryStudentIdByProfileId` (`loaders/meetings.ts:491-501`, reused verbatim
for identity resolution) filters only `.eq('profile_id', profileId)`.

**Verdict, independently confirmed:** (i) a deactivated student's identity
resolves, personal figures render normally, self-check-off writes remain
RLS-authorized — no false-empty state anywhere on `/outreach`, unlike
`StudentHome`/T176. (ii) A signed-in user with no linked student row at all
resolves `null`, and every consumer including `SelfCheckoffDialog` is gated
behind that `null` check by `ViewerStudentIdGate` (criterion 4's `null` test
also confirms `SelfCheckoffDialog` never mounts in that state — `dialog`
element count is 0).

No new T184-class hazard found on this page; nothing new to file.

### Criterion 7 — blast radius reproduced and classified

At my own merge-base SHA, running the full test suite against my source
change with **no harness fix yet** produced exactly **10 of 82 failures**,
all in the `<OutreachList /> student/parent view` / T126 / T129 / T112
describe blocks — every one landed in the identity tier's own `'error'`
DES-12 state (`"Couldn't find your student record"`) because the real,
unmocked `resolveCurrentStudentId` default fired a genuine Supabase call in
the test environment. This matches the packet's "~10 of 82" figure exactly
(not the "3 of 82" default-only probe figure).

**Fix (harness-only, one line + a merge order):** `renderAsUser` now merges
a default `resolveStudentId: async () => PLACEHOLDER_CURRENT_STUDENT_ID`
into `props` (individual test overrides still win, spread order preserved).
Chosen to resolve to the placeholder specifically because this file's own
fixtures (`FIXTURE_RSVPS`/`FIXTURE_GOAL_CONFIG`) are keyed to it — unlike
`StudentHome.test.tsx`'s own T176 fix, which resolves to a **distinct**
id because that page's `loadData` takes `studentId` as an argument. No
`expect(...)` line was edited. Result at round-1 dispatch: **82/82 → 90/90**
(82 original + 8 new T170 tests), zero assertion rewrites. After the
round-2 checker fix (§3a, two more resolver-path tests added): **90/90 →
92/92**, still zero assertion rewrites to any pre-existing test.

### Criterion 8 — render-and-enumerate over `container.innerHTML`

Rendered `<OutreachList loadData={defaultLoadOutreachData}
viewerStudentId={PLACEHOLDER_CURRENT_STUDENT_ID} />` as `STUDENT_OR_PARENT_USER`
in a scratch, non-committed test (`src/pages/outreach/_scratch_enumerate.test.tsx`,
written, run, then deleted — never staged/committed), captured
`container.innerHTML` directly (not `.textContent`).

| Figure | Bucket | Basis |
|---|---|---|
| "1 awaiting your RSVP" badge | REAL | `getUnansweredRsvpCount(sessions, rsvps, [viewerStudentId])` over real fixture RSVP rows |
| `GoalBar` `aria-valuetext` ("3 of 12 hours confirmed; 0 more planned") | REAL-INPUTS-DISCLOSED-DIVERGENT-FORMULA | inputs (`viewerStudentId`, sessions, rsvps) are real; `computeStudentHours` itself is the disclosed RSVP-based BEH-02 heuristic, structurally divergent from `v_student_hours` (T188) |
| "3 hrs confirmed" / "0 hrs planned" stat tiles | REAL-INPUTS-DISCLOSED-DIVERGENT-FORMULA | same chain as above |
| "12 hrs" goal stat tile | REAL | `goalConfig.individualGoalHoursByStudentId[viewerStudentId]`, backed by real `students.goal_hours_override`/`seasons.default_goal_hours` columns (module doc #2 investigation) |
| "25%" %-of-goal stat tile | REAL-INPUTS-DISCLOSED-DIVERGENT-FORMULA | `confirmedPercent(confirmedHours, goalHours)`, inherits `confirmedHours`'s divergent formula |
| Milestone row ("25% reached" badge, 50/75/100% text) | REAL-INPUTS-DISCLOSED-DIVERGENT-FORMULA | derived from the same `confirmedPercent` chain |
| Toast "Your season goal: reached 25% of the season goal (confirmed hours)." | REAL-INPUTS-DISCLOSED-DIVERGENT-FORMULA | same chain, deduped per real `seasonId`+`goalBarId` (`viewerStudentId`) |
| "You RSVP'd: Going" / "No response recorded" per-row text | REAL | direct lookup of the real `rsvps` row (or its absence) for `viewerStudentId` on that session |
| Per-row RSVP `SegmentedControl` current selection | REAL | reflects the real, loaded `rsvps` row for `viewerStudentId`; write path is a pre-existing, disclosed, local-only stub (module doc #8b) unrelated to and unchanged by T170 |
| "Mark attendance – Canned Food Drive" button + `SelfCheckoffDialog` | REAL | eligibility computed from real session data; dialog opens scoped to the real resolved `viewerStudentId` (criterion 10 confirms `loadSelfCheckoffAttendance` receives it, not the placeholder) |
| still-fabricated-honestly-empty | **none found** | every personal figure driven by `viewerStudentId` on this page is either REAL or REAL-INPUTS-DISCLOSED-DIVERGENT-FORMULA after this fix — stated plainly, not omitted |

Also confirmed directly in the same render: "Weekly Team Meeting" (the
deliberate `type: 'meeting'` fixture event) never appears anywhere in the
captured `innerHTML` (NAV-07, unaffected by this task, still holds).

### Criterion 9 — no regression elsewhere

Full `OutreachList.test.tsx`: **92/92 green** (82 pre-existing + 10 new — the
8 from round 1 plus the 2 resolver-path additions from §3a; the ~10
pre-existing failures were harness-only, fixed with zero assertion edits —
see criterion 7). Full repo suite (round 2, at merge commit
`e8744bad2c715b3f7bfa60d268ca7a5e03c60d79`): 67 files / **1601** tests, all
green (1599 round-1 total + 2 new resolver-path tests; see §5 below). Coach
view and `OutreachDetail.tsx` (out of scope, unedited) both unaffected —
confirmed by the coach-view describe blocks and the `OutreachDetail.test.tsx`
file both passing unchanged in the full run.

### Criterion 10 — `SelfCheckoffDialog` carries the real resolved id, mutation-provable

`loaders/selfCheckoff` is mocked module-wide via the `importOriginal`
partial-mock convention (`OutreachDetail.test.tsx`'s own established idiom,
named in `task-ledger.md`'s T161 row): only `loadSelfCheckoffAttendance` is
replaced with a spy; `insertSelfCheckoff`/`removeSelfCheckoff` stay real
(unexercised by any test in this file). Test opens "Mark attendance" with an
explicit distinct `viewerStudentId="student-real-c1"`, flushes, and asserts
the spy's second argument (`studentId`) equals `'student-real-c1'` and is
not `PLACEHOLDER_CURRENT_STUDENT_ID`.

**Mutation:** `<SelfCheckoffDialog studentId={viewerStudentId} .../>` →
`studentId={PLACEHOLDER_CURRENT_STUDENT_ID}`.

**RED (actual output):**
```
AssertionError: expected 'student-placeholder-current-viewer' to be 'student-real-c1'
Expected: "student-real-c1"
Received: "student-placeholder-current-viewer"
```
Reverted; re-ran — GREEN.

This directly proves §1's claim: the self-check-off write path (via its own
`loadAttendance` re-query, the first step toward the eventual insert/delete)
now genuinely carries the real, resolved, non-placeholder id — the write
path is reachable with the correct id, not merely enumerated from reading
the code.

**Round-2 addendum:** this test alone was insufficient — see §3a (it uses an
explicit `viewerStudentId` prop, so it never observes the resolver's own
return value). A sibling test was added, rendering with no explicit prop and
`resolveStudentId: async () => DISTINCT_STUDENT_ID`, with the identical spy
assertion on `loadSelfCheckoffAttendance`'s `studentId` argument. Mutation
and RED output for that test are in §3a.

## 5. Five gates

### Round 1 (dispatch), measured at merge-base `d74dc203c...`

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | Exit 0, no output |
| Build | `npx vite build` | Exit 0, `✓ built in 7.8s` |
| Format | `npm run format:check` | Clean |
| Lint | `npx eslint .` | 0 errors / 357 warnings |
| Tests | `npx vitest run` | 67 files / 1599 tests, all passed |

### Round 2 (this pass, checker gate round 1 fix), measured at merge commit `e8744bad2c715b3f7bfa60d268ca7a5e03c60d79`

Re-measured, not assumed, per the coordinator's explicit instruction (test
count moves, do not reuse round-1's 1599):

| Gate | Command | Result |
|---|---|---|
| Typecheck | `npx tsc --noEmit` | Exit 0, no output |
| Build | `npx vite build` | Exit 0, `✓ built in 8.1s` (pre-existing >500kB chunk warning only, unrelated) |
| Format | `npm run format:check` | "All matched files use Prettier code style!" |
| Lint | `npx eslint .` | **0 errors / 357 warnings** (unchanged from round 1; all warnings pre-existing `react-refresh/only-export-components`) |
| Tests | `npx vitest run` | **67 files / 1601 tests, all passed** (round-1's 1599 + 2 new resolver-path tests from §3a) |

`OutreachList.tsx`/`OutreachList.test.tsx` in isolation: `npx eslint
src/pages/outreach/OutreachList.tsx src/pages/outreach/OutreachList.test.tsx`
→ 0 errors, 26 pre-existing warnings (all `react-refresh/only-export-components`
on already-exported pure functions, none new).

Source file (`OutreachList.tsx`) confirmed byte-identical to the round-1
committed state throughout this round: `git diff` against HEAD returns empty
both before writing the two new tests and after every mutation-revert cycle
in §3a — **no source change was made**, per the coordinator's explicit
instruction.

## 6. Known risks / disclosed judgment calls

- The `ViewerStudentIdGate` component was extracted as a separate,
  non-hook-owning function (branches only on an already-resolved
  `LoadState<string | null>` passed as a prop) rather than folding its
  branching inline into `OutreachListLoaded`'s own return — this keeps
  `OutreachListLoaded` itself hook-only at the top and push all render-time
  DES-12 branching for the identity tier into one small, independently
  readable component, mirroring `StudentHome.tsx`'s own
  `ResolvedStudentHomeView` shape (though that component owns its own hook;
  mine deliberately does not, since the packet's §5 design fires the
  identity hook inside `OutreachListLoaded` itself, in parallel with the
  season-data hook, not inside a child). Flagged per the packet's own
  invitation to state implementation-level deviations rather than silently
  diverge.
- One near-miss surfaced by mutation testing on criterion 4: a
  prefix-only mutation of the loading-state copy did not fail the
  `.toContain(...)` assertion (documented above, in criterion 4's evidence).
  The assertion is not vacuous against a genuine content change (proven by
  the stronger, fully-replacing mutation going RED), but a reader should be
  aware `.toContain` is a substring check, not an exact-text check, same as
  every other DES-12 copy assertion already in this file's own test suite
  (I did not change this file's own established assertion style).
- `computeStudentHours`'s RSVP-based formula divergence from
  `v_student_hours` (criterion 8's bucket 3) is real, disclosed, and
  correctly out of scope — tracked as **T188**, not touched here, per the
  packet's own explicit instruction.
- The pre-existing, disclosed, local-only RSVP-write stub (module doc #8b,
  `handleRsvpChange`) is unrelated to and unchanged by this task; noted in
  criterion 8's table as a caveat rather than forced into either enumeration
  bucket, since the packet's 3-bucket scheme is scoped to the
  `computeStudentHours`/`v_student_hours` divergence specifically.

## 7. Not verified / explicitly unowned

- I did not exercise `SelfCheckoffDialog`'s actual insert/delete
  (`insertSelfCheckoff`/`removeSelfCheckoff`) end-to-end against a real or
  mocked write — criterion 10 as prescribed only requires proving the
  dialog's own re-query (`loadAttendance`) carries the real id, which is
  what was tested and mutation-proven. No test in this file (before or
  after this task) exercises the dialog's own confirm/save action, so
  those two mutation functions remain real, unmocked exports, simply never
  invoked by anything in this test file.
- I did not modify or investigate `RsvpControl.tsx`/`ParentRsvp.tsx` — out
  of scope, forbidden files per the packet.

## 8. Commit

Committed in this worktree. SHA and `git status` are reported in the final
assistant message accompanying this document (not duplicated here to avoid
staleness if amended before review — see the worker's final response).

## 9. Dispute

None filed. The packet's revision 2 design, criteria, and citations all
checked out against the real tree; no contradiction or impossibility found.
