# Worker Packet: T147 — the outreach/meetings team picker shows fixture teams to real users

**Revision 3.** Revision 2's premise gate returned BLOCKER a second time, on
criterion 6, in a new form: the assertion could not pass at one site
(`OutreachDetail`) and could not fail at another (`MeetingsList`), and Part B's
premise (a reusable `FIXTURE_TEAMS` in `OutreachList.tsx`) was false — that fixture
does not exist there. This revision replaces the whole name-based assertion
approach with a UUID-shape assertion on the actual submitted payload. See
"What changed and why" at the bottom for the full record.

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

## Landing order — read before you start, and verify it yourself

**This task depends on T146.** As of this packet's own commit, T146 has been
dispatched but has **not landed**. Do not assume it has. Before relying on any line
citation past `loaders/outreach.ts:802`, check whether T146's changes are present
(it adds a test file, `loaders/outreach.test.ts`, and leaves `outreach.ts` itself
byte-identical when done). If T146 has not landed, **stop and report rather than
guessing at current line numbers** — this task inserts new lines inside
`makeLoadOutreachData`, which sits directly above functions T146 does not touch, so
the two tasks do not conflict in content, only in whichever citations this packet
gives you may have drifted by the time you start. Baselines below are measured on
the pre-T146 tree; T146 will add tests, so your own starting numbers may differ —
report what you actually see and explain any gap rather than treating it as a
failure.

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
`OutreachTeamOption` (`:506-509`) is `{ id: string; name: string }`. The dialog's
`MultiSelector` (`:1494-1501`) renders
`options={teams.map((team) => ({ value: team.id, label: team.name }))}` — the
option **values are the team ids**, unmodified. On submit,
`resolveTeamScope(selectedTeamIds, allTeamIds)` (`:891-898`) writes those same ids
straight into the outgoing payload's `teamIds` field (`:1183`) unless every team is
selected, in which case it sends `null` (meaning "all teams" — matches
`events.team_ids IS NULL`).

**`ScheduleMeetingsDialog`** (`src/pages/meetings/ScheduleMeetingsDialog.tsx`) has
the identical shape, verified independently, not assumed from the pattern above:
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
Same `allTeamIds`/`selectedTeamIds`/`resolveTeamScope` shape at `:503-511`,
`:551`, `:554`, submitted at `:626`. `ScheduleTeamOption` (`:281-284`) is
`{ id: string; name: string }` — structurally identical to `OutreachTeamOption`,
though the two are separate types in separate files; do not merge them, that is
out of scope.

No call site passes `teams` anywhere:

- `OutreachList.tsx:3161-3171` — outreach create/edit dialog.
- `OutreachDetail.tsx:1430-1437` — outreach edit dialog.
- `MeetingsList.tsx:2205-2209` — `ScheduleMeetingsDialog`, **the one that blocks
  meeting creation.**

Every one of these omissions is documented as a deliberate scope deferral from an
earlier task, and every one of those comments will become false once this task
lands. **Correct all four, don't just leave them:**

- `OutreachList.tsx:406-411` (module doc #11 — asserts `teams` "deliberately NOT
  overridden").
- `OutreachList.tsx:3153-3160` (the same claim, restated immediately above the JSX).
- `OutreachDetail.tsx:1420-1429` (same claim, "still fixture-backed posture").
- `MeetingsList.tsx:2195-2204` (same claim, citing the same reasoning).

Do not read any of these four comments as a mistake by the tasks that wrote them —
each was correctly scoped to its own Allowed Files at the time. The defect is that
no follow-up was ever logged, per constitution item 20 (deliberate deferrals must
file a task, not just a comment) — added specifically because of this bug.

**Not a fourth instance:** `StudentDialog` (`src/pages/roster/StudentsTab.tsx`) also
takes a `teams` prop, but `StudentsTab.tsx:313` already passes real,
loader-sourced teams to it (`dialogTeamOptions`) — confirmed by direct read, not
assumed from the pattern. Nothing to fix there.

## The assertion mechanism — read this before writing any test

**Do not assert on team names anywhere in this task.** Two name-based approaches
were tried in earlier revisions of this packet and both failed for structural
reasons specific to this codebase's fixtures, verified directly:

1. `MeetingsList.tsx:737` has a fixture meeting titled `'Ravens Strategy Session'`
   and `:740` a location `'Ravens Team Room'` — both render unconditionally. A
   correctly-fixed page still contains the text "Ravens" three times over (title,
   location, and the real team-scope label if the loader's real teams happen to
   include one). `not.toContain('Ravens')` is unsatisfiable by a correct fix.
2. `OutreachDetail.tsx:1360` renders `formatScopeLabel(event.teamIds, teams)`
   directly into the page body — so if a test injects distinctly-named teams while
   leaving the *fixture ids* (`'team-ravens'`/`'team-titans'`) in place anywhere
   upstream, the positive assertion passes regardless of whether the real prop-pass
   fix is present. Name assertions here cannot discriminate.

**Use this instead.** `events.team_ids` is `uuid[]` — the entire defect is that a
non-uuid string can reach it. Assert directly on that shape, on the payload a
dialog actually submits, not on rendered text:

```ts
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
```

For each of the three call sites, the regression test must:

1. Inject a `loadData`/`loadCoachData` returning teams with realistic **UUID-shaped
   ids** (e.g. `'a1111111-1111-4111-8111-111111111111'`) and fabricated names
   (constitution item 6) — names may be anything; they are never asserted on.
2. Drive the dialog to a state where its submitted `teamIds` is a **real,
   non-null array** rather than the "all selected → `null`" shortcut
   (`resolveTeamScope`, cited above — returns `null` when every team is selected,
   which is the *default* state on open). Two verified ways to do this, pick
   whichever fits the call site:
   - **Edit mode (`OutreachDetail` only):** seed the injected event's own
     `teamIds` as a single real team (not all teams) — `:1051` seeds
     `selectedTeamIds` from `initialEvent.teamIds ?? allTeamIds`, so an
     already-team-scoped fixture event needs no dialog interaction at all; just
     open and submit.
   - **Create mode (`OutreachList`, `MeetingsList`):** open the `MultiSelector`
     (labeled "Team scope") and click one option to deselect it before submitting.
     `MultiSelector`'s rendered options carry `role="option"` with a click handler
     toggling that exact item (installed source,
     `node_modules/@astryxdesign/core/src/MultiSelector/MultiSelector.tsx:1082-1089`)
     — find the option by its visible label text (which the injected fixture
     controls) and click it. Verify the resulting interaction yourself; this
     packet gives you the anchor, not a copy-pasteable selector.
3. Assert the mock `onSaveEvent`/`onCreateMeetings` callback received a `teamIds`
   array where **every element matches `UUID_RE`**.

**Prove discrimination the same way as before** — revert the call site's prop pass
(dialog falls back to `DEFAULT_TEAMS`), confirm the same test now fails (the
submitted ids are `'team-ravens'`/`'team-titans'`, which do not match `UUID_RE`),
restore, confirm it passes. This works identically at all three sites with no
per-site special-casing, and it encodes the actual production failure (a non-uuid
reaching `events.team_ids`) rather than a proxy for it.

**Where a text assertion is still useful for something else** (e.g. confirming the
right team *names* render for a sighted user), scope it to the open dialog's own
DOM subtree, not `document.body.textContent`/full-page text — whole-page matching
is what made the name collisions at `MeetingsList` and `OutreachDetail` unavoidable
in the first place.

## The fix, part by part

### Part A — `OutreachDetail.tsx`: pass real teams (near one-line)

Real teams are already in scope. `:1299` destructures `teams` from `detailData`,
and it is already used at `:1360` (`formatScopeLabel`) and passed to
`AttendancePanel` at `:1385`. Pass it to the dialog too, at the call site
`:1430-1437`, and delete the stale comment at `:1420-1429`.

Types are compatible, verify rather than assume: `TeamOption`
(`OutreachDetail.tsx:402-415`) is `{ id, name, color }` (the `color` field is
T143's required addition); `OutreachTeamOption` is `{ id, name }`. The extra
`color` is fine for assignment.

### Part A2 — `OutreachDetail.tsx`: roster fetch has the same defect class — SEVERABLE

While in this file for Part A, this packet also asks you to fix a second, closely
related defect: the "Expected attendees" roster fetch silently falls back to
fixture **student** names on failure, the identical failure mode this task exists
to close for teams.

`:1114-1127` declares `eventDialogRoster` state, with a comment stating a rejected
`loadRoster()` call leaves it `undefined`, so `OutreachEventDialog`'s own
`students` prop default (`DEFAULT_STUDENTS`) silently takes over. The effect at
`:1135-1147` confirms it: `.catch(() => { /* Disclosed soft-fail */ })` — a real,
empty catch block. A coach opening Edit after any roster-fetch failure (e.g. a
transient network error) sees `DEFAULT_STUDENTS`'s four fabricated names (Riley
Chen, Jordan Blake, Sam Okafor, Casey Nguyen) presented as the live roster, with no
indication anything failed.

`OutreachList.tsx` already fixed the identical defect for its own roster fetch —
use it as the template, not a novel design. Two regions there, both needed:

- The state/effect/derivation: `:2925-2979` (a `RosterLoadState` union, a
  `rosterState`/`rosterRetryToken` pair, the load effect, `retryRosterLoad`, and
  the `rosterForDialog` derivation that resolves to a real empty array — never
  `undefined` — on error).
- The rendered notice: `:3081-3092` (an error `Banner` with a `Retry` action, only
  when `rosterState.status === 'error'`).

Port both to `OutreachDetail.tsx`'s own `eventDialogRoster` handling. The old
justification for leaving `OutreachDetail` on the soft-fail path — "T121 already
fixed it" — was true for `OutreachList` only; `OutreachDetail` never received the
fix. State that plainly in your output doc rather than repeating the stale
justification.

**This part is explicitly severable.** It is real, but it is not what blocks
meeting creation, and it touches a different failure surface (students, not
teams) than the rest of this task. If you hit a genuine blocker on Part A2 alone,
**do not let it hold up Parts A, B, or B2** — land those, report Part A2's problem
plainly, and let it become its own follow-up rather than stalling the
user-reported blocker behind it.

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
known). Teams depends on nothing — add it to the first batch. **Prove it, don't
just assert it:** in your test, use a fake client that records call order/timing
and assert the teams query is issued alongside the other zero-dependency queries,
not after them.

**Correction — there is no existing `FIXTURE_TEAMS` in `OutreachList.tsx`.** An
earlier revision of this packet assumed one existed and told you to reuse it; grep
confirms zero occurrences. You must create one: a module-level
`FIXTURE_TEAMS: readonly TeamOption[]` (or the matching local type this file
already uses for `students`/similar fixtures — check the existing convention and
match it), used by `defaultLoadOutreachData` (`:1305-1317`) and by test literals.
Fabricate realistic UUID-shaped ids for it (matching what the real `teams` table
actually produces) and fabricated names (constitution item 6) — the exact names
don't matter under the new UUID-based assertion approach, so there is no naming
trap to avoid here the way earlier revisions worried about.

Three places construct an `OutreachLoadResult`-shaped object literal and will need
a `teams` field once the interface grows one — `tsc` will find every one, but the
three known today are: `defaultLoadOutreachData` itself, and two test fixtures in
`OutreachList.test.tsx` (at minimum `:970-977` and `:1404-1412` — grep the file for
`individualGoalHoursByStudentId` to find every literal, there may be more than
these two).

### Part B2 — `MeetingsList.tsx` / `loaders/meetings.ts`: this is the one that blocks meeting creation

**Do not treat this as "no team data available" — it is already fetched, just not
threaded to the dialog.** `loaders/meetings.ts` already has a real `queryTeams`
(`:352-357`) and already loads it in `makeLoadCoachMeetingsData`'s own parallel
batch (`loadTeamRows` at `:541`, inside the `Promise.all` at `:546-554`) — it feeds
`buildCoachMeetingRows` (`:559`) for the per-row team-scope label, but the raw list
never leaves that function. **No new query, no new round trip.**

What's missing:

1. `CoachMeetingsData` (`MeetingsList.tsx:641-643`) has only a `rows` field. Add
   `teams: readonly FixtureTeam[]` (the existing `{id, name}` interface, `:548-551`
   — check whether it's exported; if not, keep it module-private and rely on
   structural typing against `ScheduleTeamOption`, same as
   `OutreachTeamOption`/`TeamOption` above — do not force a shared type across
   files that don't otherwise share one).
2. In `loaders/meetings.ts`'s `makeLoadCoachMeetingsData` (`:536-566`), return
   `teams: (teamRows ?? []).map(mapTeamDbRow)` alongside `rows`.
3. `CoachMeetingsView` (`MeetingsList.tsx:1936-1974`) needs a `teams` state,
   populated the same two places `rows` is: the initial-load effect (`:1970-1974`,
   currently `setRows(loadState.data.rows)`) and the post-create reload
   (`handleCreateMeetingsSubmit`, `:2056-2061`, currently `setRows(fresh.rows)`).
4. Pass `teams={teams}` to `<ScheduleMeetingsDialog>` at `:2205-2209`.
5. `defaultLoadCoachMeetingsData` (the fixture default, `:1119-1130`) needs
   `teams: FIXTURE_TEAMS` added for type compatibility — that fixture already
   exists at `:716-719` for `buildCoachMeetingRows`' own team parameter (this one
   genuinely does already exist, verified directly — unlike `OutreachList.tsx`'s
   nonexistent one above), reuse it, don't redeclare.
6. `MeetingsList.test.tsx` constructs `CoachMeetingsData`-shaped object literals at
   **three** sites, all verified directly: `:561` (`{ rows: [] }`), `:703`
   (`const pastOnlyRow: CoachMeetingsData = { rows: [...] }`), and `:786`
   (`Promise.resolve({ rows: [...] })`, implicitly typed via the enclosing
   function's `Promise<CoachMeetingsData>` return type at `:782`). Update all
   three; `tsc` will catch any you miss.

**Do not build a `students` prop or roster wiring for `ScheduleMeetingsDialog`.**
Unlike `OutreachEventDialog`, it has no such prop (`ScheduleMeetingsDialogProps`,
`:536-543`, is `isOpen`/`onOpenChange`/`teams`/`onCreateMeetings` only — no
attendee checklist exists on this dialog at all). If you find yourself adding one,
stop; that is not this task.

### Part C — explicitly NOT in this task

Making `teams` required on both dialogs and deleting both `DEFAULT_TEAMS`
fixtures is a real, defensible follow-up (the optional-prop-with-a-fixture-default
is the actual mechanism that shipped this bug) but is deferred, not built here:
`OutreachEventDialog.test.tsx` has 32 render sites mostly relying on the default,
and `DEFAULT_STUDENTS` (`:618-623`) hardcodes `teamId: 'team-ravens'`/`'team-titans'`
— a required-`teams` fix that also re-ids the fixture would break roster-matching
tests in a way that reads like a harness bug, not an obviously-related fixture
mismatch. `ScheduleMeetingsDialog.test.tsx` has 14 more render sites with the same
issue. This is test-fixture entanglement to unwind carefully, not a same-day
addition to a user-reported-blocker fix.

**Do not file the follow-up ledger row yourself.** `task-ledger.md` is a Forbidden
File for workers — the orchestrator is filing this one. State in your output doc
that Part C was not built and why, and stop there; do not attempt to create or
edit any ledger file.

## Acceptance Criteria

1. `OutreachDetail.tsx` passes its real `teams` to `OutreachEventDialog`.
2. `OutreachDetail.tsx`'s roster fetch (Part A2) never silently falls back to
   `DEFAULT_STUDENTS` on failure — a failed fetch resolves to a real empty array
   plus a visible error `Banner` with `Retry`, mirroring
   `OutreachList.tsx:2925-2979`/`:3081-3092`. **Severable per Part A2 — report
   separately from criteria 1/3/4 if it could not be completed.**
3. `OutreachList.tsx` loads real teams (parallel with the existing batch — show
   your evidence per Part B) and passes them to `OutreachEventDialog`.
4. `MeetingsList.tsx` threads the already-fetched `teamRows` from
   `loaders/meetings.ts` through `CoachMeetingsData` to `ScheduleMeetingsDialog`,
   with no new query and no new round trip.
5. All four stale comments (`OutreachList.tsx:406-411`, `OutreachList.tsx:3153-3160`,
   `OutreachDetail.tsx:1420-1429`, `MeetingsList.tsx:2195-2204`) are corrected —
   each currently asserts a fixture-backed posture that becomes false.
6. **Regression tests, one per call site (three: OutreachDetail, OutreachList,
   MeetingsList — plus Part A2's own roster-failure test if that part lands)**,
   using the UUID-shape assertion mechanism above — never a name-based assertion
   for this criterion.

   **Prove they discriminate:** revert each call site's fix, confirm the matching
   test fails for the right reason (submitted ids are the fixture strings, not
   UUIDs), restore, confirm it passes. Report what you saw for each.
7. `npx tsc --noEmit`, `npx vite build`, `npm run format:check`, `npx eslint .` and
   `npx vitest run` all clean. Baselines **at this packet's own commit** (before
   T146 lands — see "Landing order" above): **0 errors, 354 warnings**, 63 test
   files, **1476 tests**. Report yours and explain any change, including any
   delta attributable to T146 having landed in the meantime.
8. `teams` stays optional on both dialogs; `DEFAULT_TEAMS` stays in place on both
   — Part C is explicitly out of scope. State in your output doc that it was not
   built. **Do not file a ledger task for it** — the orchestrator is handling
   that directly.

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
- `src/pages/home/CoachHome.tsx` — T142 is in flight against this file right now
  (it does not render either dialog touched here — verified directly, no
  functional conflict — just don't touch it)
- `src/pages/roster/StudentsTab.tsx` — read `:313` for confirmation only; already
  correct, not this task's concern
- `src/pages/meetings/ScheduleMeetingsDialog.test.tsx` — read for the render-site
  pattern only if useful; not expected to need edits since Part C (which would
  touch it) is out of scope here
- Anything under `node_modules/`

## Relevant Constitution Excerpt

- **Item 6** — fixture data must use fabricated names. Relevant in reverse here:
  the fixtures are correctly fabricated, they are simply reaching real users. Any
  new fixture you create (Part B's `OutreachList.tsx` `FIXTURE_TEAMS`) follows the
  same rule.
- **Item 2** — component props come only from `docs/swarm/astryx-api.md`. Not
  expected to bind here for the dialogs themselves — this task changes no Astryx
  component usage, only which data reaches existing props — but the `MultiSelector`
  interaction in your tests should be verified against the installed source, cited
  above, not guessed.
- **Item 20** — a deliberate deferral must file a task, not just a comment. This is
  exactly the rule this bug caused to exist. Part C is the one deferral in this
  packet, and per the instruction above, the orchestrator files it — not you.
- **Item 19c** — verify a citation before asserting it. Every citation in this
  packet was re-derived from the current tree, not copied from an earlier draft.
  If anything here does not match the tree, **stop and report the mismatch rather
  than guessing at intent.**

## What changed and why (revision history, for your context only)

Revision 1 covered only the outreach half and scoped in Part C as a same-task
addition. Revision 2 folded in the meetings half, deferred Part C, and added Part
A2 — but its own criterion 6 asserted `not.toContain('Ravens'/'Titans')` against
whole-page text. A second premise gate found this unsatisfiable in both
directions: `MeetingsList.tsx` has fixture content genuinely named "Ravens" that
renders regardless of the fix (`:737`, `:740`), so the negative assertion can never
pass; and `OutreachDetail.tsx`'s own `formatScopeLabel` renders the loader's team
names directly into the page body (`:1360`), so the positive assertion passes even
with the fix reverted, given the earlier revision's fixture names collided with
`DEFAULT_TEAMS`'s own. It also found Part B's `FIXTURE_TEAMS` reuse instruction was
based on a fixture that does not exist in `OutreachList.tsx`. This revision
replaces the whole mechanism with a UUID-shape assertion on the actual submitted
mutation payload (see "The assertion mechanism" above), which is immune to name
collisions at every site and encodes the real defect more directly than either
name-based approach did.

## Required Worker Output

Create `docs/swarm/active/T147-worker-output.md` covering: files changed at each
of the four call sites; how you confirmed the `OutreachList`/`MeetingsList` team
queries run in parallel with no extra round trip (recorded call order, not prose);
whether Part A2 landed, and if not, exactly what blocked it; the exact interaction
sequence your tests use to reach a non-null `teamIds` at each create-mode site
(`OutreachList`, `MeetingsList`); the discrimination proof for each of the three
(or four) regression tests; explicit confirmation Part C was not built and that you
did not attempt to file a ledger task for it; full command output; and anything you
could not verify, stated plainly as unverified.

Do not mark this task complete. A checker verifies it.
