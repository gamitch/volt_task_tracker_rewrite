# T147 Worker Output

Packet: `docs/swarm/active/T147-worker-packet.md`, pinned SHA
`fa017afeba96441a533f2b0e9e0c68f476317999` (confirmed: `git log -1 --format=%H --
docs/swarm/active/T147-worker-packet.md` returns exactly this SHA in the worktree
after the required merge below; the file's own header still says "Revision 3" but
the commit message calls it "revision 4" -- transcribed recipe. Content is byte-
identical to the copy at the pinned SHA, checked with `diff`).

## Step 1 -- merge

`git fetch origin && git merge origin/claude/swarm-plan-zl575z` was a clean
fast-forward from `2146255` to `fa017afeba96441a533f2b0e9e0c68f476317999` (no
conflicts). This also brought in T146 (already merged into that branch), so my
starting baseline is POST-T146.

Baseline measured (not assumed) immediately after the merge, before any of my own
edits:

- `npx tsc --noEmit`: 0 errors.
- `npx eslint .`: 0 errors, 354 warnings.
- `npm run format:check`: clean.
- `npx vite build`: clean.
- `npx vitest run`: **64 test files, 1477 tests, all passing.**

This matches the dispatcher's stated post-T146 baseline (64 files / 1477 tests / 0
errors / 354 warnings) exactly -- reported because I measured it, not because it was
handed to me.

## Files changed, by call site

1. **`OutreachDetail.tsx`** (Part A + A2):
   - Part A: added `teams={teams}` to the `<OutreachEventDialog>` call site
     (destructured from `detailData` at the top of the component, already used for
     `formatScopeLabel`/`AttendancePanel`). Replaced the stale "`teams` deliberately
     NOT overridden" comment.
   - Part A2: replaced the `eventDialogRoster` state (a bare
     `readonly OutreachRosterStudent[] | undefined`, silently left `undefined` on a
     rejected `loadRoster()`) with a `RosterLoadState` union
     (`'loading' | 'ready' | 'error'`) plus a `rosterRetryToken`, ported verbatim
     from `OutreachList.tsx`'s own CHECKER FIX (rework of T121, NIT #6). Added an
     error `Banner` with a `Retry` action to the render, only when
     `rosterState.status === 'error'`. **Part A2 landed; nothing blocked it.**

2. **`OutreachList.tsx`** (Part B):
   - Added `type OutreachTeamOption` to the existing `OutreachEventDialog` import.
   - Added `teams: readonly OutreachTeamOption[]` to `OutreachLoadResult`.
   - Added a new fixture `FIXTURE_TEAMS` (UUID-shaped ids, fabricated names --
     constitution item 6) since grep confirmed none existed (an earlier packet
     revision's premise was false; this revision correctly says so).
   - `defaultLoadOutreachData` now returns `teams: FIXTURE_TEAMS`.
   - Threaded `teams` through `OutreachListLoaded` (`data.teams`) →
     `CoachOutreachViewProps`/`CoachOutreachView` → `<OutreachEventDialog
     teams={teams} .../>`.
   - Updated the two stale comments (module doc #11's "deliberately NOT
     overridden" paragraph, and the identical claim restated directly above the
     `<OutreachEventDialog>` JSX).
   - Updated two pre-existing `OutreachLoadResult`-shaped test literals
     (`:969-977`ish and `:1403-1412`ish -- grep-confirmed the only two matching
     `attendance: []` / `students: []` sites) to add `teams: []`.
   - Fixed two roster-mock `teamId` values in pre-existing tests
     (`'team-ravens'` → a UUID matching the new `FIXTURE_TEAMS`) -- these were
     genuine regressions caused by correctly threading real teams:
     `groupActiveRosterByTeam` now filters a roster student by matching it
     against the real `teams` list, so a mock roster row scoped to the OLD
     `'team-ravens'` id no longer matches ANY team and silently disappears from
     the "Expected attendees" checklist. Not a test-only cosmetic fix; it is the
     direct, correct consequence of the production fix.
   - Added `teams` branches to the fake-client `fromSpy`s in the two
     `loadOutreachData` loader-level tests (they previously threw "unexpected
     table: teams").

3. **`loaders/outreach.ts`** (Part B, backing `makeLoadOutreachData`):
   - Added `const loadTeams = createLoader<void, TeamDbRow[]>(queryAllTeams,
     getClient)` (reusing the already-existing `queryAllTeams`/`TeamDbRow`
     `makeLoadOutreachDetail` already used).
   - Added `loadTeams()` to the FIRST `Promise.all` batch (alongside
     `loadStudents()`/`loadSeasonGoal(seasonId)`), not a new/serial call.
   - Return object gained `teams: (teamRows ?? []).map(mapTeamDbRowToTeamOption)`
     (reusing the existing mapper, already used by `makeLoadOutreachDetail`).

4. **`MeetingsList.tsx` / `loaders/meetings.ts`** (Part B2):
   - `loaders/meetings.ts`'s `makeLoadCoachMeetingsData` return object gained
     `teams: (teamRows ?? []).map(mapTeamDbRow)` -- `teamRows` was ALREADY being
     fetched inside the existing `Promise.all` batch (`loadTeamRows`, feeding
     `buildCoachMeetingRows`'s own team-scope-label parameter); this change adds
     zero new queries and zero new round trips, only a new field on an
     already-resolved value.
   - `MeetingsList.tsx`'s `CoachMeetingsData` interface gained
     `teams: readonly FixtureTeam[]` (the pre-existing, already-correct `{id,
     name}` interface at `:548-551`; not redeclared).
   - `defaultLoadCoachMeetingsData` (fixture default) gained `teams: FIXTURE_TEAMS`
     (the pre-existing fixture at `:716-719`, reused verbatim per the packet --
     this fixture keeps its `'team-ravens'`/`'team-titans'` ids deliberately,
     since it backs only the disconnected display fixture, not the real loader).
   - `CoachMeetingsView` gained a `teams` state, populated in the same two places
     `rows` already is: the initial-load effect and
     `handleCreateMeetingsSubmit`'s post-create reload.
   - `<ScheduleMeetingsDialog>` call site gained `teams={teams}`; updated the
     stale "`teams` is deliberately NOT overridden" comment.
   - Fixed three pre-existing `CoachMeetingsData`-shaped test literals (`{ rows:
     [] }` at three sites) to add `teams: []`, plus one loader-level test
     (`expect(result).toEqual({ rows: [] })`) that needed `teams: []` too.

`OutreachEventDialog.tsx` and `ScheduleMeetingsDialog.tsx` were NOT modified
(confirmed by `git status`/`git diff --stat` -- neither file appears) -- read-only
per Allowed Files, as intended (no behavior change was needed inside either
dialog).

## Parallel-load proof for `makeLoadOutreachData` (Part B) -- call order, not prose

Added a dedicated test, `loadOutreachData (T101 real load) > issues the teams
query in the SAME batch as students/seasons (zero-dependency), never serialized
after the session-dependent batch`, in `OutreachList.test.tsx`. It records
`client.from(table)` invocation order into an array and asserts:

- `teams` is called before `rsvps`/`attendance` (which are only reachable once
  the WHOLE first batch, including `teams`, has resolved and `sessionIds` is
  known).
- `['event_sessions', 'seasons', 'students', 'teams'].sort()` equals the
  four calls immediately following `events` (`callOrder.slice(1, 5)`), proving
  `teams` lands in the SAME `Promise.all` batch as the other zero-dependency
  queries, not serialized after them.

**Discrimination proof, run live in this worktree (item 23):** temporarily moved
`loadTeams()` out of the `Promise.all` array and re-added it as a serial `await
loadTeams()` AFTER the whole first batch + the `rsvps`/`attendance` conditional.
Re-ran the new test: it failed with `expected 4 to be greater than 6` (teams'
index moved past rsvps/attendance). Restored the parallel version; re-ran; passed
again. Full suite re-run clean afterward (`npx tsc --noEmit`, `npx vitest run
src/pages/outreach/OutreachList.test.tsx` -- 82/82 passing).

## Regression tests -- one per call site, plus Part A2's own, plus the ordering proof

All five use the UUID-shape assertion mechanism (`/^[0-9a-f]{8}-[0-9a-f]{4}-
[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`) on the SUBMITTED payload, never a
name-based assertion, per the packet's "assertion mechanism" section.

### 1. `OutreachDetail.tsx` (edit mode) -- `OutreachDetail.test.tsx`

Exact interaction sequence:
1. Inject `loadData` returning a fabricated `OutreachDetailData` whose `event.
   teamIds` is **`null`** (the recipe: this is what makes
   `OutreachEventDialog.tsx:1051`'s `initialEvent.teamIds ?? allTeamIds` fall
   through to `allTeamIds`, which is derived from `teams` -- the prop under
   test) and whose `teams` array has two UUID-shaped ids + fabricated names.
2. Render, open the "Actions for..." menu, click "Edit".
3. `getFieldControl('Team scope')` locates the `MultiSelector`'s trigger
   `<button>` (Astryx `Field` gives it `id=inputID`, `label htmlFor` matches);
   click it to open the popover.
4. Read the trigger's `aria-controls` attribute (the listbox id); scope the
   `[role="option"]` query to `document.getElementById(listboxId)` -- NOT the
   whole document (a second, unrelated `role="option"` group exists on this page,
   the dialog's own Event type `Selector`).
5. Click the LAST element in that scoped list (never index 0/1 by label text --
   `hasSelectAll` puts "Select all" first).
6. Click "Save changes...".
7. Assert `onSaveEvent`'s mock call's `event.teamIds` is a non-null,
   non-empty array where every element matches `UUID_RE`.

**Discrimination proof (run live, item 23):** temporarily removed `teams={teams}`
from the `<OutreachEventDialog>` call site in `OutreachDetail.tsx`. Re-ran the
test: failed with `expected 'team-ravens' to match /^[0-9a-f]{8}-.../i` -- the
dialog fell back to `DEFAULT_TEAMS`. Restored; re-ran; passed (`41/41` in the
file).

### 2. `OutreachList.tsx` (create mode) -- `OutreachList.test.tsx`

Create mode has no `initialEvent`, so no edit-mode fixture-event trick is needed;
`allTeamIds` (from the `teams` prop) directly seeds `selectedTeamIds` on open.
Sequence: open "New outreach event", set Title + Date (both required for
`isValid`, per the packet's disabled-button note), open "Team scope", deselect
the last option (same scoped/positional method as above), click "Create event —
1 session", assert `onSaveEvent`'s `event.teamIds` elements all match `UUID_RE`.
Used `defaultLoadOutreachData` directly (now resolves `teams: FIXTURE_TEAMS`,
UUID-shaped).

**Discrimination proof (run live):** removed `teams={teams}` from the
`<OutreachEventDialog>` call site in `OutreachList.tsx`. Re-ran: failed with
`expected 'team-ravens' to match /^[0-9a-f]{8}-.../i`. Restored; re-ran; passed
(`82/82` in the file, including the two roster-mock fixups above).

### 3. `MeetingsList.tsx` (create mode) -- `MeetingsList.test.tsx`

`ScheduleMeetingsDialog`'s title defaults to a non-empty `DEFAULT_TITLE` ("Team
meeting"), so only a Date is needed for `isValid`. Sequence: open "Schedule
meetings", set Date, open "Team scope" (same scoped/positional method), deselect
the last option, click "Create 1 meeting", assert `onCreateMeetings`'s
`event.teamIds` elements all match `UUID_RE`. Used a custom `loadCoachData`
wrapping `defaultLoadCoachMeetingsData()` and overriding `teams` with two
UUID-shaped/fabricated-name entries (the fixture default's own `FIXTURE_TEAMS`
deliberately keeps `'team-ravens'`/`'team-titans'`, per the packet's instruction
to reuse it as-is, so it is not itself UUID-shaped).

**Discrimination proof (run live):** removed `teams={teams}` from the
`<ScheduleMeetingsDialog>` call site in `MeetingsList.tsx`. Re-ran: failed with
`expected 'team-ravens' to match /^[0-9a-f]{8}-.../i`. Restored; re-ran; passed
(`68/68` in the file).

### 4. `OutreachDetail.tsx` Part A2 -- roster failure -- `OutreachDetail.test.tsx`

Two tests: (a) a rejected `loadRoster` shows the error `Banner` +
"Retry" and the edit-mode checklist never shows `DEFAULT_STUDENTS`' fabricated
names ("Riley Chen"/"Jordan Blake"/"Sam Okafor"/"Casey Nguyen"), landing on
"Expected attendees (0 of 0)" instead; (b) clicking "Retry" re-invokes
`loadRoster` and clears the notice on a subsequent success.

**Discrimination proof (run live):** temporarily changed the `.catch` handler
back to a no-op (the original soft-fail). Re-ran test (a): failed --
`container.textContent` did NOT contain "Couldn't load the student roster", and
the full captured text showed ALL FOUR fabricated `DEFAULT_STUDENTS` names
leaking through ("Riley Chen", "Jordan Blake", "Sam Okafor", "Casey Nguyen"),
plus "Expected attendees (0 of 4)" instead of "(0 of 0)". Restored the real
`.catch`; re-ran; both tests passed (`43/43` in the file).

### 5. Parallel-load ordering test -- see previous section (Part B, `loaders/outreach.ts`)

## Part C -- explicitly not built

Per the packet, making `teams` required on both dialogs and deleting both
`DEFAULT_TEAMS` fixtures was NOT attempted -- `teams` stays optional on both
`OutreachEventDialogProps`/`ScheduleMeetingsDialogProps`, and both `DEFAULT_TEAMS`
fixtures remain in place, unmodified (confirmed: neither `OutreachEventDialog.tsx`
nor `ScheduleMeetingsDialog.tsx` appears in `git diff --stat`). I did not create or
attempt to create any ledger row or file under `docs/swarm/**` for this deferral --
the orchestrator is filing that directly, per the packet's explicit instruction and
per constitution item 20 (the very item this bug caused to be authored).

## Full command output (final state, after all edits)

```
$ npx tsc --noEmit
(no output -- 0 errors)

$ npx eslint .
✖ 354 problems (0 errors, 354 warnings)

$ npm run format:check
Checking formatting...
All matched files use Prettier code style!

$ npx vite build
✓ built in ~7-8s (one pre-existing >500kB chunk warning, unrelated to this task)

$ npx vitest run
Test Files  64 passed (64)
Tests  1483 passed (1483)
```

1483 = the pre-existing 1477 baseline + 6 new tests (3 UUID-shape regression
tests at each call site, 2 Part A2 roster-failure tests, 1 parallel-load
ordering test). 64 test files -- unchanged from baseline (no new test files
were created; all additions are in the pre-existing colocated `*.test.tsx`
files already in Allowed Files).

## What I could not verify

- I did not run this against a real Supabase instance/Postgres -- all proof is
  against fake/mocked `SupabaseClient` objects and component-level DOM
  interaction, per this repo's existing test conventions (no live database in
  this environment). The `events.team_ids uuid[]`/`teams.id uuid` column
  definitions were verified by reading the migration files directly (cited in
  the packet, re-confirmed against the current tree), not by executing SQL.
- I did not do a live/manual browser check of the fix (no dev server / real
  Supabase credentials in this environment); all verification is via
  `vitest`/`tsc`/`eslint`/`vite build`.
- Mutation/discrimination experiments (reverting each fix, confirming the
  matching test fails for the right reason, then restoring) were all performed
  in this worktree only, never on the shared tree, per constitution item 23;
  each was restored and the full relevant test file re-run clean immediately
  after.

Not marking this task complete -- a checker verifies it.
