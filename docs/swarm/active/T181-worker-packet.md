# T181 worker packet — `ParentHome` gets a real backend

Ledger row: T181. Dependencies: none (T176/T184 are precedent, not blockers — both
already merged). Worker tier: **sonnet** (`worker-implementer`, worktree) — none of
item 18's four opus triggers apply (no migration edit, no RLS/`security definer`
edit, no new SQL view, no auth/session/role/permission *logic* change — this task
*reads* an existing session the same way `checkin.ts` already does, it does not
change how sessions/roles resolve). Checker: `checker-reviewer` (opus), matching
T155/T170/T176/T184.

**Premise gate: one full round, not skipped, not narrow-only.** Reasons, so this
can be argued with: (a) this is not "roll out an already-verified pattern to a new
surface" (item 19b's skip/light case) — it is a genuinely new composite: reuse
across three sibling loader files, a brand-new page-scoped loader file, a same-name
type collision that must not be resolved by wiring the wrong contract, and an
unruled `is_active` design decision; (b) the exact false premise that produced
T176's attempt-1 MAJOR is **already sitting in this file's own module doc** (cited
below) — a gate that builds the prescribed shape and runs the mutations, the way
T176's gate did, will catch it before a worker writes a second copy of that MAJOR;
(c) item 25's tiering rule is "genuine complexity, not topic sensitivity" — this
recommendation is made on (a) and (b), not because parents/minors are the subject.
Cap at two rounds per 19a as usual; do not pre-commit to a second round.

**First: merge `origin/claude/swarm-plan-zl575z` before doing anything.** Worktrees
are cut from `main` (`f7ff055`), which has none of today's work, including this
packet. All citations below are pinned to `5294412` on `claude/swarm-plan-zl575z`.

**Baselines — by reference, not measured here (no Bash in this session; the figures
below are read-verified via grep/`Read`, not executed).** Orientation only, from the
dispatching message: 67 files / 1605 tests repo-wide, eslint 0 errors / 357
warnings. `ParentHome.test.tsx` currently has 42 `it(`/`describe(` occurrences
(grep-counted at `5294412`, not run). **The worker must re-measure all gates at its
own dispatch SHA and flag any drift rather than reconcile it silently** — T155's
own packet had a stale baseline and the worker's own re-measurement was correct;
do the same here.

## Allowed / Forbidden files

**Allowed:**
- `src/pages/home/ParentHome.tsx`
- `src/pages/home/ParentHome.test.tsx`
- **New file** `src/lib/supabase/loaders/parentHome.ts` — this task's one new loader
  file. Named `parentHome.ts`, deliberately **not** `parents.ts` (already exists,
  owns `ParentsTab.tsx`'s unrelated admin roster loader) and deliberately not a name
  that collides with `checkin.ts`'s own `LoadLinkedStudentsFn`/`loadLinkedStudents`
  exports (see "The trap" below — this is load-bearing, not a style preference).
- **New file** `src/lib/supabase/loaders/parentHome.test.ts` — scoped to this one
  new file's own query/loader functions, mirroring `students.test.ts`'s own
  disclosed "scoped to this one function only, not a full coverage sweep" precedent
  (`students.ts` module doc, T176).

**Forbidden — read-only reference. Import types/functions freely; never edit:**
- `docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`,
  `dispute-log.md`, `.claude/**`, `node_modules/`, `guards.tsx` (all as given).
- `src/pages/meetings/StudentMeetingView.tsx` — already imported by `ParentHome.tsx`
  for `ConsistencyStrip`/`selectLastCompletedAttendance`/types; that import stays.
  Its own `LoadLinkedStudentsFn`/`loadLinkedStudents` are a **different contract**
  with the same name (see below) — do not import those two names from this file.
- `src/lib/supabase/loaders/checkin.ts` — real, tested, reusable: import
  `loadConsistencyStripData` from here (see "What's real" below). Do not import
  `loadLinkedStudents`/`makeLoadLinkedStudents`/`LoadLinkedStudentsFn` from here —
  wrong contract, see below.
- `src/lib/supabase/loaders/students.ts` — real, tested, reusable: import
  `resolveStudentScope` from here (see below).
- `src/lib/supabase/loaders/parents.ts`, `src/pages/roster/ParentsTab.tsx` — a
  different, admin-facing feature; read for the "join client-side" convention only.
- `src/pages/home/StudentHome.tsx`, `src/pages/home/CoachHome.tsx`,
  `src/pages/home/DashboardPage.tsx`, `src/lib/supabase/types.ts`,
  `supabase/migrations/**` — read-only precedent/schema citation only.
  **`DashboardPage.tsx` needs no edit**: `<ParentHome />` is already rendered with
  zero props (`:124`), and `ParentHome`'s own props are already optional with
  function defaults (`ParentHome.tsx:1238-1241`) — the fix is swapping which
  function the defaults point at, the same "keep the fixture as a distinct export,
  point the real default at the real loader" pattern `StudentMeetingView.tsx`'s own
  module doc #5/#9 already used for T100, and `StudentHome.tsx`'s own
  `loadData = defaultLoadStudentHomeData` / `resolveStudentScope =
  defaultResolveStudentScope` wiring already shows for T176.

## The central trap — two contracts, one name. Read this before writing any import.

`checkin.ts:489` exports `loadLinkedStudents: LoadLinkedStudentsFn =
makeLoadLinkedStudents()` (factory at `:459`). That `LoadLinkedStudentsFn`
(`StudentMeetingView.tsx:373`) is `() => Promise<LinkedStudentSummary[]>`, and
`LinkedStudentSummary` (`:354-357`) is `{ studentId: string; displayName: string }`
— two fields, no team, no `isActive`, no goal data. It exists to feed
`StudentMeetingView`'s `variant="linked"` consistency-strip list, a narrower need.

`ParentHome.tsx` declares its **own**, file-local `LoadLinkedStudentsFn`
(`:437`) = `() => Promise<LinkedStudentsResult>`, and `LinkedStudentsResult`
(`:432-435`) = `{ students: readonly LinkedStudentRow[]; teams: readonly
HomeTeamRow[] }`, where `LinkedStudentRow` (`:380-385`) carries `studentId`,
`displayName`, `teamId`, and (pre-fix) `goalHoursOverride`.

**Same exported name (`loadLinkedStudents`), same file-local type name
(`LoadLinkedStudentsFn`), structurally incompatible return shapes.** TypeScript
would reject assigning one where the other is expected (`LinkedStudentSummary[]`
has no `teams`/`teamId` field at all — TS2322 on any attempt to pass
`checkin.ts`'s `loadLinkedStudents` as `ParentHome`'s `loadLinkedStudents` prop).
That is real protection, but only if nobody reaches for a *cast* to silence it, and
only if nobody notices the name match and assumes "the real one already exists,"
which is the exact trap: a grep for `loadLinkedStudents` finds a real,
already-shipped, already-tested implementation and it is for the wrong page.

**Resolution — build a second, real loader. Do not adapt, wrap, or cast the
existing one.** `checkin.ts`'s version cannot serve `ParentHome`'s contract: it
queries `students(id, display_name)` only (`checkin.ts:405-411`, `StudentDbRow`
at `:250-253`) — no `team_id`, no `is_active`, no team join at all — so even
composing it with an extra teams query would mean editing a Forbidden file to add
columns to an existing exported function whose *other* real caller
(`StudentMeetingView`) does not want them. Two genuinely different queries for two
genuinely different pages, same as every other `loaders/*.ts` pair in this repo.

**Do not perpetuate the collision for the next reader.** Name the new function
something that does **not** re-collide, e.g. `loadLinkedStudentsForParentHome` /
`makeLoadLinkedStudentsForParentHome` (exact name is the worker's call — the
constraint is "not literally `loadLinkedStudents`/`makeLoadLinkedStudents`," so a
future grep for that bare name surfaces exactly one real implementation, not two
candidates for two different pages). The file-local **type** name
`LoadLinkedStudentsFn` staying as `ParentHome.tsx:437`'s own name is fine — it is
already page-scoped by file, unlike the function export.

**Required inspection proof (criterion C10 below):** verify, by attempting the
substitution in a scratch/uncommitted edit and reading the resulting `tsc` error,
that `checkin.ts`'s `loadLinkedStudents` genuinely cannot satisfy `ParentHome`'s
prop type — then discard the experiment. Same "prove by attempted misuse" technique
T151 used for its required-prop guarantee. Do not just assert the shapes differ —
show the compiler agreeing.

## What's real already — grep the migrations and the loader directory before
building anything new. (Item 1 of the brief's "establish before designing.")

`queryGuardianLinksForParent` (`checkin.ts:393-403`) already does the
parent→students hop (`guardian_links.eq('parent_profile_id', …)`), but it is a
**private, unexported** function in a Forbidden file — reference for the query
shape, not importable. `parentHome.ts` needs its own copy plus a session-user
lookup and a students query with more columns (below) — reimplementing a private
function from a Forbidden/read-only file, not importing it, is this codebase's
own established convention (`ParentHome.tsx`'s existing module doc #1/#5/#6 already
does this for `isEventInTeamScope`/`withRsvpOverride` against `CoachHome.tsx`/
`OutreachList.tsx`).

**Two things are directly, fully reusable — real imports, not reference-only —
and this is why the per-card half is much smaller than it looks:**

1. **`loadConsistencyStripData`** (`checkin.ts:455`, real, `students.test.ts`-style
   tested, already checker-verified via its own consumer `StudentMeetingView`).
   Signature `(studentId: string) => Promise<ConsistencyStripData>`, and
   `ConsistencyStripData` (`StudentMeetingView.tsx:367-370`) = `{ entries:
   ConsistencyStripEntry[]; participation: StudentParticipationMetric | null }`.
   `StudentHomeCardData.consistencyEntries`/`.participation`
   (`ParentHome.tsx:453-462`) need exactly this data — field name `entries` vs
   `consistencyEntries` differs, the *type* is identical. **Import and call this
   directly for the participation/consistency-strip half of each card. Do not
   write a new participation query.**

2. **`resolveStudentScope`** (`students.ts:440`, real, tested in
   `students.test.ts`, checker-verified in T176). Signature `(studentId: string)
   => Promise<StudentScope | null>`, `StudentScope` (`StudentHome.tsx:489-494`) =
   `{ teamId, goalHours, confirmedHours, plannedHours }`, read verbatim from
   `v_student_goal_projection` (`dashboard_views.sql:322-334`) via
   `queryStudentGoalProjectionById` (`students.ts:398-408`). **Import and call
   this directly for `confirmedHours`/goal-hours. Do not write a new hours query,
   and do not re-derive the goal coalesce — see the item-3 finding below, which is
   the single most important correction in this packet.**

**Genuinely new, no existing reusable query:**
- **`events`**: nothing in the loader directory exports a full-row `events` query
  (`checkin.ts` never touches the `events` table at all). Needs `id, season_id,
  type, title, team_ids` (`scheduling_attendance.sql:33-48`).
- **`event_sessions`, fuller than `checkin.ts`'s own version**: `checkin.ts`'s
  private `queryEventSessions` (`:287-295`) selects only `id, session_date,
  starts_at, status` — missing `event_id` and `ends_at`, both required by
  `HomeSessionRow` (`ParentHome.tsx:403-410`) and by `buildNextEventsForStudent`'s
  own filtering (`:843-882`, uses `endsAt`). Cannot be reused as-is; write a new
  query with the full column set (`scheduling_attendance.sql:53-63`).
- **`rsvps` by student**: nothing in the loader directory queries `rsvps` at all
  yet. Needs `id, session_id, student_id, status, responded_by, updated_at`
  filtered `.eq('student_id', studentId)` (`scheduling_attendance.sql:67-76`),
  same shape as `checkin.ts`'s own `queryAttendanceForStudent`
  (`:299-308`) — same idiom, independently written (different table).
- **`teams`**: no minimal `{id, name}` query exists anywhere reusable. Do not
  import `loaders/teams.ts`'s `loadTeamsTabData` — that is `TeamsTab.tsx`'s own
  admin CRUD loader, wrong ownership, wrong shape (carries `archived`,
  `sortOrder`, `color`, none of which `HomeTeamRow` needs). Write a minimal
  `select id, name from teams` (optionally `.in('id', teamIds)`, mirroring
  `queryStudentsByIds`'s own scoped-by-ids convention right next to it).
- **`students`, wider than every existing version**: `checkin.ts`'s
  `queryStudentsByIds` selects `id, display_name` only; `parents.ts`'s version is
  the same two columns. Neither carries `team_id`/`is_active`, both required
  here. Write a new query: `id, display_name, team_id, is_active` — **do not**
  select `goal_hours_override` here; see the item-3 finding, it is no longer
  needed once the per-card seam sources goal hours from `resolveStudentScope`.

**RLS — reasoned, not measured (no live Supabase in this environment, disclosed
gap every task in this repo carries).** `my_student_ids()` (`rls.sql:20-26`)
unions a student's own row (`profile_id = auth.uid()`) with every
`guardian_links`-linked student for the calling parent
(`select student_id from guardian_links where parent_profile_id = auth.uid()`),
**with no `is_active` filter of its own**. `students`, `events`, `event_sessions`,
and `rsvps` each carry an `own_or_linked_read` policy keyed off exactly this
function (`rls.sql:96-102`, `:153-163`, `:180-190`, `:201-203`), and `teams`
carries `read_all` (`:66`, any authenticated caller). So a parent's own queries
against all five tables/views this task touches genuinely resolve for their
linked students, including a **deactivated** one (RLS does not filter on
`is_active` anywhere in this chain — only the *views* do, which is the finding
below). This mirrors `students.ts`'s own module doc reasoning for
`resolveStudentScope` (`:361-383`), extended here to the `guardian_links` half of
`my_student_ids()` rather than the `profile_id` half. **Label this reasoning as
such in the module doc — it is not measured.**

## Item 3 finding — the goal-hours denominator, and a false claim already sitting
in this file

**`ParentHome.tsx`'s own module doc #2 (`:40-47`) already contains word-for-word
the same false premise that produced T176's attempt-1 MAJOR:**

> "MET-04's denominator (PRD line 541: `goal_hours_override ?? season
> default_goal_hours`) has no SQL view for the ratio itself, only the numerator is
> a view column -- `studentGoalHours`/`hoursVsGoalPercent` below are the identical
> UI-side-percent-math idiom..."

This is wrong, for the same reason T176's identical claim was wrong.
**`v_student_goal_projection`** (`dashboard_views.sql:322-334`) already computes
`coalesce(s.goal_hours_override, se.default_goal_hours) as goal_hours` in SQL,
alongside `confirmed_hours`/`planned_hours`, scoped to the current active season.
`students.ts`'s own `resolveStudentScope` (`:398-437`) already reads this view
verbatim for exactly one student and already documents the required posture:
*"Verbatim passthrough (constitution item 3) -- `goal_hours` is already the
coalesced value; no coalesce/override arithmetic happens here"* (`:428-429`).
**This is not a new finding requiring a new SQL read — it is the same view, same
column, already wired for a sibling page. Reuse `resolveStudentScope` directly
(see above); do not write a second query against this view, and do not keep the
TS-side coalesce.**

**Required fix, mirroring T176's exact correction:**
- `StudentHomeCardData.defaultGoalHours: number` (`:454`) → replace with
  `goalHours: number`, populated verbatim from `resolveStudentScope`'s own
  `goalHours` field. (Optional, zero extra query cost since the same row already
  carries it: also thread `plannedHours: number` through if useful — not required
  by HOME-03's literal field list, PRD line 265, which names only "hours bar," and
  the wireframe's own worked example (`:393`, "62/100 h") shows confirmed-only.
  Worker's call; disclose either way.)
- `studentGoalHours()` (`:796-801`, the `goalHoursOverride ?? defaultGoalHours` TS
  coalesce) becomes dead in production once the per-card loader supplies
  `goalHours` verbatim. **Delete it and its two-case unit test
  (`ParentHome.test.tsx:107-118`), or state a concrete surviving production call
  site if one exists — do not leave it as an unused-in-production export "for
  symmetry."** This is the same "dead export left behind" class T176's checker
  flagged the orchestrator for overstating in the other direction — get it right
  here by checking, not asserting.
- `StudentHomeCard`'s render (`:1164-1165`, `const goalHours =
  studentGoalHours({ goalHoursOverride }, data.defaultGoalHours)`) → use
  `data.goalHours` directly. `hoursVsGoalPercent` (`:805-808`) is untouched — it is
  genuine UI-side percent math with no metric-view equivalent to duplicate, the
  same posture `CoachHome.tsx`'s own established idiom already has (module doc
  #2 says this correctly; only the denominator-sourcing half was wrong).
- `LinkedStudentRow.goalHoursOverride: number | null` (`:384`) and
  `StudentHomeCardProps.goalHoursOverride` (`:1098`) become unused for this
  purpose once `goalHours` comes from `resolveStudentScope`. Remove them (see
  below — replaced by `isActive`, not left as dead fields either).
- The outer seam's `students` query correspondingly does **not** need
  `goal_hours_override` (see "genuinely new" list above) — one fewer column,
  one fewer reason for a future re-derivation temptation.

**Do not re-prove `resolveStudentScope`'s own SQL correctness.** It is already
real, already tested, already checker-verified (T176). This task's proof burden is
narrower: that `ParentHome`'s card renders whatever `resolveStudentScope` hands
back, verbatim, and that no stale TS-side coalesce silently overrides it (criterion
C3 below is built around exactly this, with an engineered divergence to make it
non-vacuous).

## The `is_active` question — genuinely new, not owner-ruled, and not the same
shape as T184

**Check first, do not assume:** `guardian_links` and the outer seam's `students`
query carry no `is_active` filter (confirmed above via RLS/schema reading) — a
deactivated linked student **stays on the parent's list**. `v_student_hours`
(`metric_views.sql:3-19`) does **not** filter `is_active` (it joins from
`attendance`, not `students`) — a deactivated student's *real, historical*
confirmed hours remain queryable. `v_student_goal_projection` **does** end
`where s.is_active` (`dashboard_views.sql:334`) — so once wired per this packet,
`resolveStudentScope` returns `null` for a deactivated student, and her card's
`confirmedHours`/`goalHours` go honestly absent **even though her real historical
hours still exist in `v_student_hours`**. This is the same two-view-disagreement
family already on record twice (T184: `StudentHome` vs. `v_student_goal_projection`;
T189: `MeetingsList` vs. `v_student_participation`, unresolved). **This packet does
not resolve the family-wide question — it disclose it, the same way `students.ts`'s
own module doc discloses it for `StudentHome`, and it prescribes the minimum
honest behavior for this one page.**

**Why this is not T184's shape, and must not get T184's design copied onto it
unexamined.** T184's owner ruling (`auto-mode-decisions.md`, "2026-07-30 — T184")
is specifically about a **deactivated student signing in as herself** — blocked at
auth if possible, "see nothing" as the named fallback. **No ruling exists for what
a parent viewing their deactivated child's card should see** — a materially
different situation: the parent is not blocked from anything, no auth question is
in play, and there is nothing to redirect. Do not silently reuse T184's
three-way-union-plus-redirect design here; that design solved a blocking problem
this task does not have.

**Prescribed design — a factual indicator, not a state swap.** Add
`isActive: boolean` to `LinkedStudentRow` (real column, `students.is_active`,
already cited in this file's own module doc #1) and thread it to
`StudentHomeCardProps`. When `isActive === false`, `StudentHomeCard` renders one
additional, small, factual marker (a `Badge`, `variant="neutral"` — astryx-api.md
already cited in this file's module doc #13 for this component — or equivalent;
exact component/copy is the worker's call) alongside the existing team badge. The
rest of the card renders **exactly the same honest-absence path it already has**
for a genuinely new student with no data yet (Cleo's existing fixture case) —
`goalHours`/`confirmedHours` at 0 (per `resolveStudentScope`'s own `null` →
absence convention), participation "—", "Nothing scheduled." **Do not** hide the
card, redirect, or block anything — nothing in HOME-03's PRD text or in the T184
ruling calls for that on this page, and inventing it without a ruling risks the
exact wrong-design cycle T184's *first* draft went through before the foreman
caught it. **This is the foreman's design call, not the owner's** — flag it as
such in the module doc and in the worker output, per the "nothing is owner-approved
unless cited" instruction. The premise gate should pressure-test this specific
paragraph before a worker builds it.

**Copy constraint (constitution item 17):** whatever text ships must be factual
("Not currently active" or similar), never loss-aversion/guilt framing. The
checker greps for banned words (streak, break, behind, miss, catch up) as part of
its review; the worker should self-check the same way before submitting.

## What a parent with no linked students sees — already correct, do not redesign

`ParentHome.tsx:1292-1302`'s zero-students `EmptyState` ("No linked students yet")
is already honest and already reachable once the outer seam returns a real empty
list. **No change needed to this branch** — only verify it positively (criterion
C6) through the real loader path, not just the fixture path, since "the branch
still exists in source" and "the real loader can actually produce the empty input
that reaches it" are different claims.

## Build plan

1. `src/lib/supabase/loaders/parentHome.ts` (new):
   - Private `querySessionUserId` (mirrors `checkin.ts:382-390`, independently
     reimplemented — Forbidden file).
   - Private `queryGuardianLinksForParent(client, parentProfileId)` (mirrors
     `checkin.ts:393-403`, independently reimplemented).
   - Private `queryStudentsByIds(client, studentIds)` → `id, display_name,
     team_id, is_active`.
   - Private `queryTeamsByIds(client, teamIds)` (or full-table — worker's call) →
     `id, name`.
   - `makeLoadLinkedStudentsForParentHome(getClient = getSupabaseClient):
     LoadLinkedStudentsFn` (name per "the central trap" above) — composes the
     four queries via `Promise.all` where independent, joins client-side (no
     nested `.select()`, matching every other loader in this repo), returns
     `LinkedStudentsResult`. Zero-arg signature, self-resolving session — **do
     not** widen `LoadLinkedStudentsFn` to take `parentProfileId` as a caller-
     supplied argument even though `ParentHome`'s own `useAuth()` already has
     `user.id` in scope. Reason: `ParentHome.tsx:1242-1243` currently calls
     `useLoadState(loadLinkedStudents, [loadLinkedStudents])` **before** its
     `user === null` check (`:1245`) — passing `user.id` in would mean either
     reordering those two (T155's own hard-won lesson: reordering an identity
     gate before a load is exactly the kind of change that needs its own
     dedicated proof, not a side effect of this task) or an unsafe `user!.id`/
     `user?.id ?? ''`. Self-resolving via `client.auth.getSession()`
     (`checkin.ts`'s own proven pattern) avoids the whole hazard for a cost of
     one extra round trip. If the worker has a concrete reason this reasoning is
     wrong, state it — don't silently pick the other design.
   - Private raw queries for `events` (full columns above) and the fuller
     `event_sessions` (full columns above), plus `queryRsvpsForStudent`.
   - `makeLoadStudentHomeCardDataForParentHome(getClient = getSupabaseClient):
     LoadStudentHomeCardDataFn` — calls `loadConsistencyStripData(studentId)`
     (imported from `checkin.ts`) and `resolveStudentScope(studentId)` (imported
     from `students.ts`) alongside the new events/sessions/rsvps queries via
     `Promise.all`, feeds `buildNextEventsForStudent` (imported from
     `ParentHome.tsx`, already exported, untouched), assembles
     `StudentHomeCardData`. When `resolveStudentScope` returns `null`: honest
     zero/absent fallback for `goalHours`/`confirmedHours` (mirrors
     `StudentHome.tsx`'s own disclosed T176-round-2 fallback reasoning,
     `:1500-1504`), never a rejection.
   - Both real defaults exported (`loadLinkedStudentsForParentHome` /
     `loadStudentHomeCardDataForParentHome`, or the worker's chosen names —
     just not the colliding ones).

2. `src/pages/home/ParentHome.tsx`:
   - `LinkedStudentRow`: drop `goalHoursOverride`, add `isActive: boolean`.
   - `StudentHomeCardData`: `defaultGoalHours` → `goalHours` (drop the
     `defaultGoalHours` name entirely — it is no longer "the season default before
     override," it is the fully-resolved figure).
   - `StudentHomeCardProps`: drop `goalHoursOverride`, add `isActive: boolean`.
   - Delete `studentGoalHours()` (or justify keeping it — see item-3 section).
   - `StudentHomeCard` render: use `data.goalHours` directly; add the factual
     `isActive === false` marker.
   - `ParentHome`'s prop defaults (`:1239-1240`): point at the two new real
     loaders instead of `defaultLoadLinkedStudents`/`defaultLoadStudentHomeCardData`
     — which stay, unchanged, as the fixture-producing exports (same "keep the
     fixture as a distinct export" pattern cited above), still directly imported
     by `ParentHome.test.tsx` for the pure-function/fixture-behavior tests that
     don't need real data.
   - `FIXTURE_STUDENTS` (`:508-522`) needs an `isActive: true` field added to all
     three existing rows (now a required field on `LinkedStudentRow` — the
     compiler will refuse to build the file otherwise, which is itself a
     T151-style structural guardrail worth noting, not fighting). A fourth,
     inactive fixture student is optional/nice, not required — the real
     discriminating proof for criterion C4 comes from the test file's own
     injected props, not the shipped fixture.

3. `ParentHome.test.tsx`: update fixture-shaped test data wherever it references
   `defaultGoalHours`/`goalHoursOverride` (renamed/removed fields — expected,
   disclosed blast radius, not a hidden surprise); delete or repurpose
   `studentGoalHours`'s own test block per the item-3 decision; add the new
   behavioral tests below.

4. `parentHome.test.ts` (new): stub `getClient` the same way `checkin.ts`'s own
   test conventions do (not read here — Forbidden — but every `loaders/*.ts` file
   in this repo already establishes the "inject a fake `SupabaseClient`, assert
   the query shape" pattern; follow it). Prove the query column lists and the
   client-side join, independent of `ParentHome.tsx`'s own rendering tests.

## Acceptance criteria — every one pairs a positive with a mutation. No
absence-only assertion ships alone (this shape has gone vacuous six times across
five tasks in this project, most recently T170's mutation-restoring-a-whole-bug
passing 90/90 today).

**Render-based assertions must come from a real render dumped via
`container.innerHTML` (or equivalent DOM query), not from reading source and
predicting the string.** I have not run this component and I am not asserting
exact rendered copy anywhere below (e.g. participation-percent formatting, the
exact ProgressBar label text) — the worker/checker must establish it by executing.

**C1 — Outer seam renders real, distinct names — not fixture names, both ways.**
Inject a loader (props override) returning two students with names/teams entirely
outside this file's own fixture id-space (not `Ada R.`/`Bea R.`/`Cleo R.`, not
`team-gear-girls`/`team-p3`/`team-iron-wolves`). Render, dump `innerHTML`, assert
the injected names AND team names appear, and assert none of the three fixture
names appear anywhere. Separately, an inspection check: `ParentHome`'s function
signature default for `loadLinkedStudents` is the new real loader's export, not
`defaultLoadLinkedStudents` (grep/read, not a render). **Mutation:** revert the
prop default to `defaultLoadLinkedStudents` → the injected-props test is
unaffected (it overrides via props either way) — so this criterion's *real*
regression proof is the inspection check plus a *separate* render with **no
props at all**, asserting the fixture names do NOT appear (they would, under the
reverted default). State this ordering explicitly so the criterion cannot pass by
accident.

**C2 — Per-card data is real, distinct, non-fixture, both ways.** Inject a
per-card loader stub (or a stubbed `getClient` for the real one) returning
confirmed/goal figures that do not equal any fixture figure (not 62, not 100, not
5, not 20, not 87, not 75 — this file's own fixture numbers, `:524-566`) and a
next-event title outside the fixture event titles (`:568-613`). Render a card for
a non-fixture-id student, dump `innerHTML`, assert the injected figures/title
appear and none of the fixture figures/titles do. **Mutation:** point the
component's default back at `defaultLoadStudentHomeCardData` with no props
supplied → must show fixture figures/titles, proving the positive test actually
discriminates.

**C3 — `goalHours` is a verbatim passthrough, never TS-recomputed (constitution
item 3).** Behavioral, engineered to be non-vacuous by construction: stub the
underlying transport so `v_student_goal_projection`'s row for the test student
returns `goal_hours = 63`, while the *raw* `students.goal_hours_override` (if the
stub surfaces it at all) is a **different** number, e.g. `999` — a value a
TS-side `override ?? default` coalesce would produce if it were still running.
Render, assert `63` reaches the DOM (via whatever the real ProgressBar
label/value renders — dump it, don't predict it) and `999` does not appear
anywhere. **Mutation:** reintroduce a TS-side coalesce over raw `students`
columns instead of `resolveStudentScope`'s verbatim `goalHours` → this test must
now show `999`, not `63`. Also inspection: grep the new loader file and
`ParentHome.tsx` for `??` near `goal_hours_override`/`goalHoursOverride`/
`defaultGoalHours` in any code path that still executes in production — zero
matches, or a named, justified exception.

**C4 — A deactivated linked student's card is honest and present, not hidden,
not fabricated, not silently identical to a brand-new student's card.** Inject an
outer-seam student row with `isActive: false` and a per-card stub where the
goal-projection query returns no row (mirrors `resolveStudentScope`'s real `null`
path). Render, dump `innerHTML`: assert (a) the student's name/team badge still
render (the card exists — count the rendered cards, do not just check for
absence of an error), (b) the honest-absence figures render (confirmed/goal at
the real clamped zero state, participation "—", "Nothing scheduled" — whatever
the actual DOM shows, established by dumping it), and (c) the factual `isActive`
marker's exact chosen copy string appears. **Mutation 1:** strip the `isActive`
branch entirely → the marker must disappear while the card and its honest-zero
figures remain (proves the marker is additive, not load-bearing for the rest of
the card). **Mutation 2:** combine with C2's distinct-value technique — inject a
*non-zero, non-fixture* confirmed/goal figure alongside `isActive: false` and
assert it does NOT leak onto this card (proves the "honest absence" path isn't
secretly still reading some other student's or the fixture's numbers). **Also
verify this is not accidentally the zero-students page-level `EmptyState`** —
assert exactly one card renders, not zero.

**C5 — Next-3-events sourced from real `events`/`event_sessions`, team scope and
type-exclusion (no competitions) hold through the real query path, with distinct
non-fixture ids.** `buildNextEventsForStudent`'s own pure-function tests are
untouched and already prove the filter logic — this criterion proves the **real
loader feeds it correctly**, not the logic itself. Stub two students on two
different non-fixture teams, one shared "all teams" event, and one
earliest-dated competition-type event. Render both cards, assert each shows only
its own team's event(s) plus the shared one, never the other team's, never the
competition. **Mutation:** drop the `type` filter from the query-composition path
(not from `buildNextEventsForStudent` itself, which stays untouched) → the
competition event must now appear.

**C6 — Zero linked students, reached through the real (not fixture) empty
result.** Stub the real-shaped loader to return `{students: [], teams: []}`.
Assert "No linked students yet" (or whatever the real DOM shows) renders. Paired
per this criterion's own framing with C1's non-empty case — do not let C6 stand
alone as the only proof the loader is wired.

**C10 — the two `loadLinkedStudents` contracts are never cross-wired.**
Inspection: grep confirms `ParentHome.tsx`/`parentHome.ts` never import
`loadLinkedStudents`/`makeLoadLinkedStudents`/`LoadLinkedStudentsFn` from
`checkin.ts`. Proof-by-attempted-misuse: in a scratch, uncommitted edit, try
passing `checkin.ts`'s `loadLinkedStudents` as `ParentHome`'s `loadLinkedStudents`
prop; capture the resulting `tsc` error (expect TS2322/TS2345 on the
`LinkedStudentSummary[]` vs. `LinkedStudentsResult` mismatch); discard the edit.
Report the exact error text as evidence, not just "it doesn't compile."

**C7 — RLS/availability reasoning recorded, explicitly labeled reasoned-not-
measured** (see "What's real already" above — the module doc should carry this,
not just this packet).

**C8 — the five standard gates** at the worker's own dispatch SHA: `tsc`,
`prettier`, `vite build`, `eslint` (compare against 357 warnings, flag any
delta with a benignity argument same as T176's own +1), `vitest` (compare
against 1605, report the new file count/test count delta explicitly, matching
T176's own "+10, exactly the new `it(` blocks" precedent for what a clean
disclosure looks like).

**C9 — no unexplained change to pre-existing passing tests.** Enumerate every
pre-existing `ParentHome.test.tsx` assertion that needed touching, and for each
one state whether it's a mechanical rename (field renamed, same intent) or an
actual behavior change. Zero `.skip`/`.only`/`.todo`. Sabotage check: no diff
outside the Allowed list above, in particular zero diff against `guards.tsx`,
`checkin.ts`, `students.ts`, `parents.ts`, `StudentMeetingView.tsx`,
`StudentHome.tsx`, `CoachHome.tsx`, `DashboardPage.tsx`, and every
`supabase/migrations/**` file.

## Constitution excerpts relevant to this task

- **Item 3** (BLOCKER-class): "RLS policies and metric SQL come only from PRD
  Section 8.4, copied verbatim. Re-deriving either, or duplicating a metric
  formula in TypeScript... → BLOCKER." Governs the goal-hours finding above.
- **Item 6:** "No PII... fixtures use fabricated names." Any new fixture data
  (if the worker adds a fourth, inactive fixture student) must be fabricated,
  matching this file's existing convention.
- **Item 12:** "Every async screen ships all four states — loading, empty,
  error, populated... Happy-path-only → MAJOR." Already satisfied structurally
  by this file at two levels (page-level and per-card); do not regress it while
  rewiring the loaders.
- **Item 17** (BLOCKER-class): no loss-aversion/guilt/streak framing anywhere,
  including in the new `isActive` marker's copy.
- **Item 18:** worker tier triggers (migrations/RLS/security definer/new metric
  view/auth-session-role logic) — none apply here; sonnet is correct.
- **Item 19/19a/19b:** premise gate required before dispatch, capped at two
  rounds, scoped by risk — this task gets a full round per the reasoning at the
  top of this packet.
- **Item 25:** "Grade... against that threat model, not a corporate one... do
  not bump a worker to opus because a topic sounds sensitive. Tier follows
  genuine complexity." Cited for both the tier call (sonnet — no genuine-
  complexity trigger from item 18) and the premise-gate-depth call (full round —
  genuine complexity, not "minors' data" sensitivity).

## Known traps, restated for the worker directly

1. Do not import `loadLinkedStudents`/`LoadLinkedStudentsFn`/
   `makeLoadLinkedStudents` from `checkin.ts` for the outer seam. Different
   contract, same name. See "The central trap."
2. Do not re-derive the goal-hours coalesce in TypeScript anywhere in the
   production path. Use `resolveStudentScope`'s verbatim `goalHours`.
3. Do not widen the outer seam's `LoadLinkedStudentsFn` to take an explicit
   `parentProfileId` argument — the hook-ordering hazard this creates
   (`useLoadState` currently runs before the `user === null` check) is a proven
   defect class in this exact codebase (T155). Self-resolve the session inside
   the loader instead, mirroring `checkin.ts`.
4. Do not copy T184's redirect/three-way-union design onto the deactivated-
   student card without re-deriving why — the situations differ (blocked actor
   vs. an unaffected observer's card). Use the smaller, factual-marker design
   prescribed above, and flag it as the foreman's call, not an owner ruling.
5. Do not leave `studentGoalHours()`, `goalHoursOverride`, or `defaultGoalHours`
   behind as unused-in-production exports "for symmetry." Delete or justify with
   a real, checked call site.
6. `DashboardPage.tsx` does not need editing. If a diff touches it, that is a
   sign the prop-default-swap approach was abandoned somewhere — stop and
   reconsider rather than pushing the change upward.
