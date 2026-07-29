# Worker Packet: T147 — the outreach/meetings team picker shows fixture teams to real users

**Revision 2 — full rewrite.** The prior version of this file was edited by the
orchestrator while a checker-premise gate was running against an earlier version of
it. This revision folds in the gate's findings (all independently re-verified against
the current tree by a second orchestrator pass before this rewrite — every citation
below was re-derived, not copied) and narrows scope in one real way: **Part C (make
`teams` required, delete the fixture) is deferred to a follow-up task, not built here.**
See "What changed and why" at the bottom.

**User-reported, and it is a hard blocker — not the cosmetic bug the first draft of
this packet described.**

Three separate reports turned out to be one root cause, present in **two** dialogs:

1. The outreach team dropdown lists `Ravens`/`Titans` instead of the coach's teams.
2. The **meetings** dialog does the same.
3. **Creating a meeting fails outright** — "Couldn't create these meetings."

Report 3 is caused by reports 1/2. `teams.id` is
`uuid primary key default gen_random_uuid()`
(`supabase/migrations/20260716000000_identity_roster.sql:30`) and `events.team_ids`
is `uuid[]` (`supabase/migrations/20260717000000_scheduling_attendance.sql:41`). The
fixture ids are the strings `'team-ravens'`/`'team-titans'`, not UUIDs.
`src/lib/supabase/loaders/meetings.ts:680` writes the dialog's selection straight
into the insert as `team_ids: args.payload.event.teamIds`, so Postgres rejects the
row with an invalid-uuid error. Because the fixtures are the **only** options
offered, every coach scheduling a team-scoped meeting hits this. **Treat the
meetings half as equal priority to the outreach half — it is the one that actually
blocks a core create flow, not a cosmetic dropdown.**

**Packet SHA: pin this.** Before writing your output doc, run
`git log -1 --format=%H -- docs/swarm/active/T147-worker-packet.md` and confirm it
matches the SHA in your dispatch prompt.

## Landing order — read before you start

**This task depends on T146 having already landed.** T146 leaves
`src/lib/supabase/loaders/outreach.ts` byte-identical (it only touches line 731
transiently, for its own mutation-and-restore proof), but this task inserts new lines
inside `makeLoadOutreachData` (currently `:802-853`), which sits directly above
`makeLoadOutreachDetail` (currently `:858-...`). If you are dispatched before T146
has merged, every line citation below past `:802` may be stale — **stop and report
the mismatch (constitution item 19c) rather than guessing.** If T146 has already
landed, its own citations of `:858-860`/`:873` are for functions below the point
where you are inserting lines, so your work does not invalidate anything it already
shipped.

## FIRST — merge the working branch

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```

Report the result. **If it conflicts, stop and report.**

## Root cause — verified, and it is not an accident

Two components, one defect shape: an optional `teams` prop defaulting to a
module-local fixture, with no call site passing real data.

**`OutreachEventDialog`** (`src/pages/outreach/OutreachEventDialog.tsx`):
```ts
// :610-613
const DEFAULT_TEAMS: readonly OutreachTeamOption[] = [
  { id: 'team-ravens', name: 'Ravens' },
  { id: 'team-titans', name: 'Titans' },
];
// :964
teams?: readonly OutreachTeamOption[];
// :981
teams = DEFAULT_TEAMS,
```
`OutreachTeamOption` (`:506-509`) is `{ id: string; name: string }`.

**`ScheduleMeetingsDialog`** (`src/pages/meetings/ScheduleMeetingsDialog.tsx`) has the
identical shape:
```ts
// :319-322
const DEFAULT_TEAMS: readonly ScheduleTeamOption[] = [
  { id: 'team-ravens', name: 'Ravens' },
  { id: 'team-titans', name: 'Titans' },
];
// :540
teams?: readonly ScheduleTeamOption[];
// :548
teams = DEFAULT_TEAMS,
```
`ScheduleTeamOption` (`:281-284`) is `{ id: string; name: string }` — structurally
identical to `OutreachTeamOption`, though the two are separate types in separate
files; do not merge them, that is out of scope.

No call site passes `teams` anywhere:

- `OutreachList.tsx:3161-3171` — outreach create/edit dialog.
- `OutreachDetail.tsx:1430-1437` — outreach edit dialog.
- `MeetingsList.tsx:2205-2209` — `ScheduleMeetingsDialog`, **the one that blocks
  meeting creation.**

Every one of these omissions is documented as a deliberate scope deferral from an
earlier task, and every one of those comments will become false once this task lands.
**Correct all four, don't just leave them:**

- `OutreachList.tsx:406-411` (module doc #11 — asserts `teams` "deliberately NOT
  overridden").
- `OutreachList.tsx:3153-3160` (the same claim, restated immediately above the JSX).
- `OutreachDetail.tsx:1420-1429` (same claim, "still fixture-backed posture").
- `MeetingsList.tsx:2195-2204` (same claim, citing the same reasoning).

Do not read any of these four comments as a mistake by the tasks that wrote them —
each was correctly scoped to its own Allowed Files at the time. The defect is that no
follow-up was ever logged, the same pattern named in
`docs/swarm/auto-mode-decisions.md`'s T147 entry.

## The fix, part by part

### Part A — `OutreachDetail.tsx`: pass real teams (near one-line)

Real teams are already in scope. `:1299` destructures `teams` from `detailData`, and
it is already used at `:1360` (`formatScopeLabel`) and passed to `AttendancePanel` at
`:1385`. Pass it to the dialog too, at the call site `:1430-1437`, and delete the
stale comment at `:1420-1429`.

Types are compatible, verify rather than assume: `TeamOption`
(`OutreachDetail.tsx:402-415`) is `{ id, name, color }` (the `color` field is T143's
required addition); `OutreachTeamOption` is `{ id, name }`. The extra `color` is fine
for assignment.

### Part A2 — `OutreachDetail.tsx`: the roster fetch has the same defect class, fix it too

While in this file for Part A, fix a second, closely related defect the gate found:
the "Expected attendees" roster fetch silently falls back to fixture **student**
names on failure, the identical failure mode this task exists to close for teams.

`:1113-1127` declares `eventDialogRoster` state, with a comment stating a rejected
`loadRoster()` call leaves it `undefined`, so `OutreachEventDialog`'s own `students`
prop default (`DEFAULT_STUDENTS`) silently takes over. The effect at `:1129-1147`
confirms it: `.catch(() => { /* Disclosed soft-fail */ })` — a real, empty catch
block. A coach opening Edit after any roster-fetch failure (e.g. a transient network
error) sees `DEFAULT_STUDENTS`'s four fabricated names (Riley Chen, Jordan Blake, Sam
Okafor, Casey Nguyen) presented as the live roster, with no indication anything
failed.

**`OutreachList.tsx:2925-2979` already fixed the identical defect for its own roster
fetch — use it as the template, not a novel design.** It replaced the
undefined-on-failure pattern with a real `RosterLoadState` (`'loading' | 'ready' |
'error'`), a `rosterForDialog` derivation that resolves to a real empty array (never
`undefined`) on error, and an honest error `Banner` with a `Retry` action wired to a
`retryToken` idiom. Port that shape to `OutreachDetail.tsx`'s own `eventDialogRoster`
handling. The reason given in earlier code for leaving `OutreachDetail` on the soft-fail
path — "T121 already fixed it" — was true for `OutreachList` only; `OutreachDetail`
never received the fix. State that plainly in your output doc rather than repeating
the stale justification.

### Part B — `OutreachList.tsx`: real threading

This page has no team data at all today. `makeLoadOutreachData`
(`loaders/outreach.ts:802-853`) builds loaders for events, sessions, rsvps,
attendance, students and season goal — no teams query.

You do not need to write a new query. `queryAllTeams` already exists at
`loaders/outreach.ts:730` and is already consumed by `makeLoadOutreachDetail` (its
`loadTeams` at `:865`). Add a `createLoader<void, TeamDbRow[]>(queryAllTeams,
getClient)` to `makeLoadOutreachData`, map it with the existing
`mapTeamDbRowToTeamOption` (`:607-609`), add `teams` to `OutreachLoadResult`
(`OutreachList.tsx:780-791`) and to the function's return object, thread it to
`OutreachListLoaded`/the page, and pass it to the dialog at `:3161-3171`.

**Fetch it in parallel with the existing batch, not serially.** `makeLoadOutreachData`
already runs two `Promise.all` batches (`:827-831` for
sessions/students/seasonGoal, `:833-836` for rsvps/attendance once session ids are
known). Teams depends on nothing — add it to the first batch. **Prove it, don't just
assert it:** in your test, use a fake client that records call order/timing (e.g. an
array pushed to on each query's invocation, or resolved promises with different
delays) and assert the teams query is issued alongside the other zero-dependency
queries, not after them.

Three places construct an `OutreachLoadResult`-shaped object literal and will need a
`teams` field once the interface grows one — `tsc` will find every one, but the three
known today are: `defaultLoadOutreachData` (`OutreachList.tsx:1305-1317`, use
`FIXTURE_TEAMS` — already declared in this file, confirm its exact location and
reuse it, do not redeclare) and two test fixtures in `OutreachList.test.tsx` (at
minimum `:970-977` and `:1404-1412` — grep the file for
`individualGoalHoursByStudentId` to find every literal, there may be more than these
two).

### Part B2 — `MeetingsList.tsx` / `loaders/meetings.ts`: this is the one that blocks meeting creation

**Do not treat this as "no team data available" — it is already fetched, just not
threaded to the dialog.** `loaders/meetings.ts` already has a real `queryTeams`
(`:352-357`) and already loads it in `makeLoadCoachMeetingsData`'s own parallel batch
(`loadTeamRows` at `:541`, inside the `Promise.all` at `:546-554`) — it feeds
`buildCoachMeetingRows` (`:559`) for the per-row team-scope label, but the raw list
never leaves that function. **No new query, no new round trip.**

What's missing:

1. `CoachMeetingsData` (`MeetingsList.tsx:641-643`) has only a `rows` field. Add
   `teams: readonly FixtureTeam[]` (the existing `{id, name}` interface, `:548-551`
   — already exported? verify; if not, keep it module-private and rely on structural
   typing against `ScheduleTeamOption`, same as `OutreachTeamOption`/`TeamOption`
   above — do not force a shared type across files that don't otherwise share one).
2. In `loaders/meetings.ts`'s `makeLoadCoachMeetingsData` (`:536-566`), return
   `teams: (teamRows ?? []).map(mapTeamDbRow)` alongside `rows`.
3. `CoachMeetingsView` (`MeetingsList.tsx:1936-1974`) needs a `teams` state,
   populated the same two places `rows` is: the initial-load effect (`:1970-1974`,
   currently `setRows(loadState.data.rows)`) and the post-create reload
   (`handleCreateMeetingsSubmit`, `:2056-2061`, currently `setRows(fresh.rows)`).
4. Pass `teams={teams}` to `<ScheduleMeetingsDialog>` at `:2205-2209`.
5. `defaultLoadCoachMeetingsData` (the fixture default, `:1119-1130`) needs
   `teams: FIXTURE_TEAMS` added for type compatibility — that fixture already exists
   at `:716-719` for `buildCoachMeetingRows`' own team parameter, reuse it, don't
   redeclare.
6. At least one object literal in `MeetingsList.test.tsx` constructs a bare
   `{ rows: [] }` as `CoachMeetingsData` (seen at `:561`) — grep for other
   `CoachMeetingsData`-shaped literals and update each; `tsc` will catch any you miss.

**Do not build a `students` prop or roster wiring for `ScheduleMeetingsDialog`.**
Unlike `OutreachEventDialog`, it has no such prop (`ScheduleMeetingsDialogProps`,
`:536-543`, is `isOpen`/`onOpenChange`/`teams`/`onCreateMeetings` only — no attendee
checklist exists on this dialog at all). If you find yourself adding one, stop; that
is not this task.

### Part C — explicitly NOT in this task

An earlier draft of this packet scoped in making `teams` required on both dialogs and
deleting both `DEFAULT_TEAMS` fixtures, reasoning that the optional-prop-with-a-fixture-
default is the actual mechanism that shipped this bug. **That reasoning still holds,
but the cost changed once the meetings half was in scope too, and it is deferred
here rather than built:**

- `OutreachEventDialog.test.tsx` has 32 render sites of `<OutreachEventDialog`, most
  omitting `teams` (relying on the default) — making the prop required breaks every
  one at the type level.
- Worse: `groupActiveRosterByTeam` matches `student.teamId` against `team.id`, and
  `DEFAULT_STUDENTS` (`:618-623`) hardcodes `teamId: 'team-ravens'`/`'team-titans'`.
  If a future required-`teams` fix also renames or re-ids the fixture teams, tests
  relying on `DEFAULT_STUDENTS` break with an error shaped like a harness bug
  ("No label found for ...") rather than an obviously-related fixture mismatch.
- `ScheduleMeetingsDialog.test.tsx` has 14 render sites, none passing `teams`
  explicitly.

This is real, but it is test-fixture entanglement to unwind carefully, not a
same-day addition to a user-reported-blocker fix. **File it as its own follow-up
task** (making `teams` required + deleting both `DEFAULT_TEAMS` fixtures + updating
the affected tests) rather than building it here. Note this in your output doc so it
is not lost.

## The vacuous-test trap — read this before writing criterion 6's tests

**`OutreachDetail.tsx`'s own `FIXTURE_TEAMS` (`:503-506`) is id- and name-identical
to `OutreachEventDialog`'s `DEFAULT_TEAMS`** — both are
`[{id:'team-ravens',name:'Ravens'},{id:'team-titans',name:'Titans'}]`. A test at that
call site asserting "the dropdown shows the loader's teams, not Ravens/Titans" using
the default loader is self-contradictory: the DOM is identical whether or not your
fix landed, so the revert-and-confirm proof in criterion 6 **cannot fail**, and a
checker mutating your fix would find a test that still passes.

**Fix:** inject a scoped `loadData` returning distinctly-named teams for this specific
test, the same way `OutreachDetail.test.tsx:614-620` already wraps
`defaultLoadOutreachDetail` for a different purpose (an instrumented function that
delegates to the real default, here overriding just the `teams` field of its result).
**Do not rename `FIXTURE_TEAMS` itself** — `OutreachDetail.test.tsx:458-462` and
`:1046-1057` both assert `'Ravens'`/`'Titans'` text content against it and are
currently green; renaming it breaks passing tests for no reason.

**`MeetingsList.tsx`'s own `FIXTURE_TEAMS` (`:716-719`) has the identical
Ravens/Titans collision against `ScheduleMeetingsDialog`'s `DEFAULT_TEAMS`.** Apply
the same fix there: an injected `loadCoachData` with distinctly-named teams for the
discrimination test, `FIXTURE_TEAMS` itself left alone.

`OutreachList.tsx`'s own fixtures do not have this problem to the same degree since
that page currently has no teams data source of its own to collide with — but verify
this yourself rather than assuming it from this packet.

## Acceptance Criteria

1. `OutreachDetail.tsx` passes its real `teams` to `OutreachEventDialog`.
2. `OutreachDetail.tsx`'s roster fetch (Part A2) never silently falls back to
   `DEFAULT_STUDENTS` on failure — a failed fetch resolves to a real empty array plus
   a visible error `Banner` with `Retry`, mirroring `OutreachList.tsx:2925-2979`.
3. `OutreachList.tsx` loads real teams (parallel with the existing batch — show your
   evidence per Part B) and passes them to `OutreachEventDialog`.
4. `MeetingsList.tsx` threads the already-fetched `teamRows` from
   `loaders/meetings.ts` through `CoachMeetingsData` to `ScheduleMeetingsDialog`, with
   no new query and no new round trip.
5. All four stale comments (`OutreachList.tsx:406-411`, `OutreachList.tsx:3153-3160`,
   `OutreachDetail.tsx:1420-1429`, `MeetingsList.tsx:2195-2204`) are corrected — each
   currently asserts a fixture-backed posture that becomes false.
6. **Regression tests, one per call site (four total: OutreachDetail, OutreachList,
   MeetingsList, plus Part A2's roster-failure test)**, asserting real data reaches
   the dialog/panel and the fixture does not, using the vacuous-test-trap workaround
   above wherever `Ravens`/`Titans` collide.

   **Prove they discriminate:** revert each call site's fix, confirm the matching
   test fails for the right reason, restore, confirm it passes. Report what you saw
   for each. A test that passes either way is worth less than none.
7. `npx tsc --noEmit`, `npx vite build`, `npm run format:check`, `npx eslint .` and
   `npx vitest run` all clean. Baselines at this packet's commit (post-T146): **0
   errors, 354 warnings**, 63 test files, **1474 tests**. Report yours and explain any
   change. File count should not change (no new test files, only edits to existing
   ones).
8. `teams` stays optional on both dialogs; `DEFAULT_TEAMS` stays in place on both —
   Part C is explicitly out of scope. State in your output doc that you filed it (or
   flagged it for the orchestrator to file) as a follow-up.

## Allowed Files

- `src/pages/outreach/OutreachEventDialog.tsx` (read for prop/type shapes only — no
  behavior change expected here; if you find you need one, stop and report)
- `src/pages/outreach/OutreachList.tsx`
- `src/pages/outreach/OutreachList.test.tsx`
- `src/pages/outreach/OutreachDetail.tsx`
- `src/pages/outreach/OutreachDetail.test.tsx`
- `src/lib/supabase/loaders/outreach.ts`
- `src/pages/meetings/ScheduleMeetingsDialog.tsx` (read for prop/type shapes only,
  same as `OutreachEventDialog.tsx` above)
- `src/pages/meetings/MeetingsList.tsx`
- `src/pages/meetings/MeetingsList.test.tsx`
- `src/lib/supabase/loaders/meetings.ts`
- `docs/swarm/active/T147-worker-output.md` (create)

## Forbidden Files

- `docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`,
  `dispute-log.md`, `auto-mode-decisions.md`
- Any other `docs/swarm/**` file, including other packets
- `.claude/**`
- Every other loader under `src/lib/supabase/loaders/` (including `outreach.ts`
  beyond what Part B describes, and `meetings.ts` beyond what Part B2 describes)
- `src/pages/outreach/AttendancePanel.tsx` — T143 landed here; do not disturb
- `src/pages/home/CoachHome.tsx` — T142 is in flight against this file right now (it
  does not render either dialog touched here — no functional conflict, just don't
  touch it)
- `src/pages/meetings/ScheduleMeetingsDialog.test.tsx` — read for the render-site
  pattern only if useful; not expected to need edits since Part C (which would touch
  it) is out of scope here
- Anything under `node_modules/`

## Relevant Constitution Excerpt

- **Item 6** — fixture data must use fabricated names. Relevant in reverse here: the
  fixtures are correctly fabricated, they are simply reaching real users.
- **Item 2** — component props come only from `docs/swarm/astryx-api.md`. Not
  expected to bind here — this task changes no Astryx component usage, only which
  data reaches existing props.
- **Item 19c** — verify a citation before asserting it. Every citation in this packet
  was re-derived from the current tree, not copied from an earlier draft. If anything
  here does not match the tree, **stop and report the mismatch rather than guessing
  at intent.**

## What changed and why (revision history, for your context only)

The first draft of this packet covered only the outreach half and scoped in Part C.
A checker-premise gate run against an intermediate version found: the meetings half
was a same-class, higher-severity instance (it blocks meeting creation outright);
Part C's cost was underestimated (test-fixture entanglement via `DEFAULT_STUDENTS`'
hardcoded team ids); `OutreachDetail.tsx`'s roster fetch has the identical
fixture-on-failure defect one function above the one this task already touches; and
several line citations in the first draft had drifted (`makeLoadOutreachData` is
`:802-853` not `:802-830`; `DEFAULT_STUDENTS` is `:618-623` not `:617-623`; the
`OutreachDetail.tsx` stale comment is `:1420-1429` not `:1420-1430`). All of the
above is folded into this revision and was independently re-verified against the
tree before being written down here — do not re-litigate it, but do still verify
anything you rely on per item 19c, the same as always.

## Required Worker Output

Create `docs/swarm/active/T147-worker-output.md` covering: files changed at each of
the four call sites; how you confirmed the `OutreachList`/`MeetingsList` team queries
run in parallel with no extra round trip (recorded call order, not prose); the
Part A2 roster-failure fix and how it mirrors `OutreachList.tsx:2925-2979`; how you
avoided the Ravens/Titans vacuous-test trap at the `OutreachDetail`/`MeetingsList`
call sites; the discrimination proof for each of the four regression tests; explicit
confirmation Part C was not built, and where you filed (or flagged) it as a
follow-up; full command output; and anything you could not verify, stated plainly as
unverified.

Do not mark this task complete. A checker verifies it.
