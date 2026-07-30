# T181 worker packet — `ParentHome` gets a real backend

**REVISION 2 — final round.** Premise gate round 1 (`docs/swarm/active/T181-gate-round1-findings.md`,
committed `9621d6a`, measured at `1a4fbf0`) returned REVISE — 2 BLOCKER, 5 MAJOR, 5 MINOR. Per
item 19a this is round 2 of 2: **this revision goes to a worker with no gate behind it.** Every
correction below is gate-measured, not argued, except MINOR 8 and MINOR 9, which were mine to decide
and are decided explicitly below.

## Revision 2 changelog (what changed per gate item)

- **BLOCKER 1** (C1's regression proof could not fail — a mutation restoring the entire fabrication
  bug passed 3-cards-worth of error banners with the assertion still green): C1 rewritten. The
  regression proof now asserts the page-level honest error banner under the real
  (unconfigured-in-test) default, not fixture-name absence alone. Gate-measured red under the
  prescribed mutation.
- **BLOCKER 2** (C3/C5 unreachable — the singletons are pre-bound to the real client, an injected
  test client never reaches them): every reference to `loadConsistencyStripData`/`resolveStudentScope`
  (the singletons) changed to `makeLoadConsistencyStripData`/`makeResolveStudentScope` (the
  factories), bound to this task's own injected `getClient`.
- **MAJOR 3** (the false item-3 claim survives every prescribed code edit and now cites a deleted
  function): explicit line-numbered edits to `ParentHome.tsx:40-47` and `:20` added to the build
  plan and required fixes.
- **MAJOR 4** (`DashboardPage.test.tsx` undisclosed, its role-dispatch discriminators go vacuous):
  added to Allowed Files, a mocking step prescribed, C9 widened, new criterion C11.
- **MAJOR 5** (C2's mutation prediction was false — no-props hits the page-level banner, not
  per-card fixture figures): C2 rewritten to the outer-seam-injected shape the gate measured.
- **MAJOR 6** (C5's mutation target didn't exist — there is no `type` filter in the composition
  path): C5's mutation replaced with a row-mapper mis-map, gate-confirmed to produce a real failure.
- **MAJOR 7** (`innerHTML` absence assertions produce false failures on CSS/class-name collisions):
  every criterion changed to `textContent` for text checks and `aria-valuetext` for numeric checks.
- **MINOR 8** (unresolved-session false-empty claim): decided below — the loader now throws instead
  of resolving `[]` when the session itself fails to resolve. New criterion C12.
- **MINOR 9** (the hook-ordering dichotomy was false): re-argued on its actual merits below; the
  design is kept, the reasoning is corrected.
- **MINOR 10** (the cited test-deletion range over-deletes, spanning an untouched `it` block):
  corrected to the exact `it` block.
- **MINOR 11** (undisclosed double `event_sessions` scan / 7-per-card query fan-out): disclosed,
  not fixed — fixing it would mean abandoning the clean-reuse design, a worse trade on the final round.
- **MINOR 12** (the clock `buildNextEventsForStudent` needs was unmentioned): `nowFn` injection
  added to the build plan.

Everything under "What held up — do not re-litigate" in the gate's findings file is unchanged here
and is not reproduced in full; see that file for the gate's own evidence (the reuse claim, the
same-name-contract incompatibility, C10's real `TS2322`, and the `isActive` attribution all measured
clean, no misattribution).

---

Ledger row: T181. Dependencies: none (T176/T184 are precedent, not blockers — both already merged).
Worker tier: **sonnet** (`worker-implementer`, worktree) — none of item 18's four opus triggers apply.
Checker: `checker-reviewer` (opus), matching T155/T170/T176/T184.

**Merge `origin/claude/swarm-plan-zl575z` before doing anything.** Worktrees are cut from `main`
(`f7ff055`), which has none of today's work, including this packet or the gate's findings file.
Citations are pinned to `5294412` on `claude/swarm-plan-zl575z` unless marked as the gate's own
measurement at `1a4fbf0`.

**Baselines — by reference.** Orientation only: 67 files / 1605 tests repo-wide, eslint 0 errors /
357 warnings *before* this task. **The gate independently measured that deleting `studentGoalHours`
removes one export and its associated `react-refresh/only-export-components` warning: eslint must
land at 356, not 357 — a −1 delta is the correct, expected result, not drift to reconcile away.**
`ParentHome.test.tsx` has 42 `it(`/`describe(` occurrences pre-task (grep-counted, not run). **The
worker must re-measure every gate at its own dispatch SHA and flag any further drift rather than
silently reconcile it**, same as every prior task in this project.

## Allowed / Forbidden files

**Allowed:**
- `src/pages/home/ParentHome.tsx`
- `src/pages/home/ParentHome.test.tsx`
- **New file** `src/lib/supabase/loaders/parentHome.ts`
- **New file** `src/lib/supabase/loaders/parentHome.test.ts`
- **`src/pages/home/DashboardPage.test.tsx`** — **added in revision 2 (MAJOR 4).** Not
  `DashboardPage.tsx` itself (still needs no edit — see below); only its test file, which hard-codes
  `ParentHome`'s fixture names as its role-dispatch discriminator (`:166`, `:179`, `:188`,
  `:196-198`) and breaks the moment those names stop reaching the DOM by default.

**Forbidden — read-only reference. Import types/functions freely; never edit:**
- `docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`, `dispute-log.md`,
  `.claude/**`, `node_modules/`, `guards.tsx` (as given).
- `src/pages/meetings/StudentMeetingView.tsx` — `ConsistencyStrip`/`selectLastCompletedAttendance`/
  types stay imported. Its `LoadLinkedStudentsFn`/`loadLinkedStudents` are a different contract with
  the same name — never import those two names.
- `src/lib/supabase/loaders/checkin.ts` — import the **factory** `makeLoadConsistencyStripData`
  (`:426`), bound to your own injected `getClient`. **Do not import the singleton
  `loadConsistencyStripData` (`:455`)** — it is pre-bound to the real `getSupabaseClient` and cannot
  be reached by an injected test double. Gate round 1, BLOCKER 2, measured:
  `SupabaseNotConfiguredError` at `client.ts:102` when the singleton is used. Never import
  `loadLinkedStudents`/`makeLoadLinkedStudents` from here — wrong contract, see below.
- `src/lib/supabase/loaders/students.ts` — import the **factory** `makeResolveStudentScope`
  (`:418`), bound to your own injected `getClient`. **Do not import the singleton
  `resolveStudentScope` (`:440`)** — same reason, same gate finding.
- `src/lib/supabase/loaders/parents.ts`, `src/pages/roster/ParentsTab.tsx` — a different,
  admin-facing feature; read for the "join client-side" convention only.
- `src/pages/home/StudentHome.tsx`, `src/pages/home/CoachHome.tsx`, `src/pages/home/DashboardPage.tsx`,
  `src/lib/supabase/types.ts`, `supabase/migrations/**` — read-only precedent/schema citation only.
  **`DashboardPage.tsx` still needs no edit**: `<ParentHome />` is already rendered with zero props
  (`:124`), and `ParentHome`'s own props are already optional with function defaults
  (`ParentHome.tsx:1238-1241`) — the fix is swapping which function the defaults point at. Only its
  *test file* needs a matching update (see Allowed, above, and MAJOR 4's build-plan step below).

## The central trap — two contracts, one name. Unchanged from revision 1; gate confirmed it measured.

`checkin.ts:489` exports `loadLinkedStudents: LoadLinkedStudentsFn = makeLoadLinkedStudents()`
(factory at `:459`). That `LoadLinkedStudentsFn` (`StudentMeetingView.tsx:373`) is `() =>
Promise<LinkedStudentSummary[]>`, and `LinkedStudentSummary` (`:354-357`) is `{ studentId: string;
displayName: string }` — two fields, no team, no `isActive`. It feeds `StudentMeetingView`'s
`variant="linked"` list, a narrower need.

`ParentHome.tsx` declares its **own**, file-local `LoadLinkedStudentsFn` (`:437`) = `() =>
Promise<LinkedStudentsResult>`, `LinkedStudentsResult` (`:432-435`) = `{ students: readonly
LinkedStudentRow[]; teams: readonly HomeTeamRow[] }`.

**Same exported name, same file-local type name, incompatible shapes.** Gate round 1 measured the
real compiler error from attempting the substitution:

```
error TS2322: Type '…StudentMeetingView").LoadLinkedStudentsFn' is not assignable to
type '…ParentHome").LoadLinkedStudentsFn'.
  Type 'LinkedStudentSummary[]' is not assignable to type 'LinkedStudentsResult'.
```

**Resolution — build a second, real loader. Do not adapt, wrap, or cast the existing one.**
`checkin.ts:405-411`'s `queryStudentsByIds` selects `id, display_name` only; its one production
consumer, `StudentMeetingView.tsx:1054`, wants neither `team_id` nor `is_active` — gate-confirmed,
not just argued. Two genuinely different queries for two genuinely different pages.

**Name the new function so it does not re-collide** — e.g. `loadLinkedStudentsForParentHome` /
`makeLoadLinkedStudentsForParentHome` (exact name is the worker's call; the constraint is "not
literally `loadLinkedStudents`/`makeLoadLinkedStudents`").

**C10 below is unchanged and is the strongest criterion in this packet** — it produces the TS2322
above, not a hand-written claim.

## What's real already — the reuse claim is TRUE and gate-measured, with one correction

Gate round 1: *"Both existing loaders wire with `tsc --noEmit` clean and no adapter:
`loadConsistencyStripData`'s `entries`/`participation` assign directly to `StudentHomeCardData`, and
`resolveStudentScope` gives `goalHours`/`confirmedHours` with no shape mismatch. T181 really is far
smaller than filed."* **The one correction (BLOCKER 2): import the factories, not the singletons.**

1. **`makeLoadConsistencyStripData`** (`checkin.ts:426`, factory). Bind it to your own injected
   `getClient` once, near the top of `makeLoadStudentHomeCardDataForParentHome` (or your chosen
   name): `const loadStripData = makeLoadConsistencyStripData(getClient);` — then call
   `loadStripData(studentId)` inside the returned per-card function. Returns `ConsistencyStripData`
   = `{ entries: ConsistencyStripEntry[]; participation: StudentParticipationMetric | null }`
   (`StudentMeetingView.tsx:367-370`) — field name `entries` vs. `StudentHomeCardData
   .consistencyEntries` (`ParentHome.tsx:453-462`) differs, the type is identical. Map the field
   name when assembling `StudentHomeCardData`; do not write a new participation query.

2. **`makeResolveStudentScope`** (`students.ts:418`, factory). Same binding pattern:
   `const loadScope = makeResolveStudentScope(getClient);` then `loadScope(studentId)`. Returns
   `StudentScope | null` = `{ teamId, goalHours, confirmedHours, plannedHours } | null`
   (`StudentHome.tsx:489-494`), read verbatim from `v_student_goal_projection`
   (`dashboard_views.sql:322-334`). Do not write a new hours/goal query, and do not re-derive the
   goal coalesce — see the item-3 section below, unchanged from revision 1 and still the single most
   important correction in this packet.

**Genuinely new, no existing reusable query — unchanged from revision 1, gate did not dispute this
list:**
- **`events`**: `id, season_id, type, title, team_ids` (`scheduling_attendance.sql:33-48`). No
  existing export anywhere in the loader directory touches this table.
- **`event_sessions`, fuller than `checkin.ts`'s own private version**: needs `id, event_id,
  session_date, starts_at, ends_at, status`; `checkin.ts:287-295`'s private `queryEventSessions`
  lacks `event_id`/`ends_at`, both required by `HomeSessionRow` (`ParentHome.tsx:403-410`) and by
  `buildNextEventsForStudent` (`:843-882`). Cannot be reused as-is. **This is the query that
  duplicates a table scan already inside `makeLoadConsistencyStripData` — see MINOR 11, disclosed
  below, not fixed.**
- **`rsvps` by student**: `id, session_id, student_id, status, responded_by, updated_at`, filtered
  `.eq('student_id', studentId)`, same idiom as `checkin.ts:299-308`'s `queryAttendanceForStudent`
  (different table, independently written).
- **`teams`**: minimal `id, name`, optionally `.in('id', teamIds)`. Do not import
  `loaders/teams.ts`'s `loadTeamsTabData` — wrong ownership (`TeamsTab.tsx`'s admin CRUD loader),
  wrong shape.
- **`students`, wider than every existing version**: `id, display_name, team_id, is_active`. Do
  **not** select `goal_hours_override` — no longer needed once the per-card seam sources goal hours
  from `resolveStudentScope`.

**RLS reasoning — unchanged from revision 1, reasoned not measured, no live Supabase in this
environment.** `my_student_ids()` (`rls.sql:20-26`) unions a student's own row with every
`guardian_links`-linked student for the calling parent, with no `is_active` filter. `students`,
`events`, `event_sessions`, `rsvps` each carry `own_or_linked_read` keyed off this function
(`rls.sql:96-102`, `:153-163`, `:180-190`, `:201-203`); `teams` carries `read_all` (`:66`). A
parent's queries against all five resolve for their linked students, including a deactivated one.
Label this as reasoned, not measured, in the module doc.

## Item 3 finding — still the reason this packet exists, and it must now be closed with the code

**Gate round 1, MAJOR 3, measured after applying every other prescribed change: `ParentHome.tsx:40-47`
still reads, verbatim:**

> "MET-04's denominator (PRD line 541: `goal_hours_override ?? season default_goal_hours`) has no
> SQL view for the ratio itself, only the numerator is a view column -- `studentGoalHours`/
> `hoursVsGoalPercent`..."

**This is false, for the same reason T176's identical claim was false**, and following revision 1's
own prescribed fixes without touching this comment leaves it citing a function this same packet has
the worker delete. `v_student_goal_projection` (`dashboard_views.sql:322-334`) already computes
`coalesce(s.goal_hours_override, se.default_goal_hours) as goal_hours` in SQL. `students.ts`'s own
`resolveStudentScope` (`:398-437`) already reads it verbatim and documents the required posture:
*"Verbatim passthrough (constitution item 3) -- `goal_hours` is already the coalesced value; no
coalesce/override arithmetic happens here"* (`:428-429`).

**Required edits, explicit and mandatory (both were missing from revision 1's own "Required fix"
bullets and build plan — gate-caught):**

1. **`ParentHome.tsx:40-47`** (module doc #2) — rewrite to name `v_student_goal_projection` /
   `resolveStudentScope` as the verbatim source of `goalHours`, mirroring `StudentHome.tsx`'s own
   T176-round-2 correction (`StudentHome.tsx:471-488`). Must not cite `studentGoalHours` (deleted).
2. **`ParentHome.tsx:20`** (module doc #1, `LinkedStudentRow`'s field list) — drop
   `goalHoursOverride`, add `isActive`.

Everything else in this section is unchanged from revision 1:

- `StudentHomeCardData.defaultGoalHours: number` (`:454`) → replace with `goalHours: number`,
  populated verbatim from `resolveStudentScope`'s `goalHours` field. `plannedHours` is available at
  zero extra query cost from the same row; optional, not required by HOME-03's literal field list
  (PRD line 265, "hours bar," singular) — worker's call, disclose either way.
- `studentGoalHours()` (`:796-801`) becomes dead in production once the per-card loader supplies
  `goalHours` verbatim. **Gate-measured safe to delete: exactly one importer,
  `ParentHome.test.tsx`; `weekly-digest.tsx:211`, `HoursTab.tsx:450`, `StudentHome.tsx:816`,
  `CoachHome.tsx:982` each hold independent copies, none imports ParentHome's.** Delete it.
- `StudentHomeCard`'s render (`:1164-1165`) → use `data.goalHours` directly.
- `LinkedStudentRow.goalHoursOverride`/`StudentHomeCardProps.goalHoursOverride` (`:384`, `:1098`)
  removed, replaced by `isActive` (see below).
- The outer seam's `students` query correspondingly drops `goal_hours_override`.

**Do not re-prove `resolveStudentScope`'s own SQL correctness** — real, tested, checker-verified
(T176). This task's proof burden is that `ParentHome`'s card renders whatever `resolveStudentScope`
hands back, verbatim, with no stale TS-side coalesce (criterion C3).

## The `is_active` question — unchanged design from revision 1, gate found no misattribution

**Gate round 1: "The `isActive` attribution is accurate — no misattribution finding.
`auto-mode-decisions.md:974` records the owner's ruling complete, and it is about a deactivated
student signing in as herself; nothing addresses a parent's view. The packet explicitly flags the
factual-indicator design as 'the foreman's design call, not the owner's.' Copy is clean against item
17."** No change needed to the design itself. Restated briefly:

Add `isActive: boolean` to `LinkedStudentRow` (real column, `students.is_active`). When
`isActive === false`, `StudentHomeCard` renders one additional, small, factual marker (exact
component/copy the worker's call — factual only, e.g. "Not currently active," never loss-aversion
framing) alongside the team badge. The rest of the card renders the same honest-absence path it
already has for a genuinely new student with no data yet. Do not hide the card, redirect, or block
anything — this page has no auth question in play, unlike T184's actor-facing shape. This is the
foreman's design call, not an owner ruling — stated as such in the module doc and worker output.

## Decision — an unresolved session must never render "No linked students yet" (MINOR 8, mine)

**The problem, as the gate stated it and I accept it:** with the self-resolving outer-seam design
(below), a session that fails to resolve (`querySessionUserId` returns `null` with no error) causes
`makeLoadLinkedStudentsForParentHome`'s returned function to resolve `{students: [], teams: []}`,
which `ParentHome` renders as **"No linked students yet."** For a genuinely signed-in parent (the
only way to reach this component at all, per `RequireAuth`) whose Supabase-side session lookup
happens to disagree with the app's own `useAuth()` state, that is a **false, specific claim about
their own account** — the exact class of harm the T184 record names, even though the mechanism here
is different (an SQL loader design choice, not blocked sign-in).

**Decision: the loader throws instead of resolving empty, in exactly this one branch.**
`makeLoadLinkedStudentsForParentHome`'s returned function: when `querySessionUserId()` resolves
`null`, throw (e.g. `new Error('Unable to resolve the signed-in parent's session.')`) instead of
returning `{students: [], teams: []}`. This routes through `ParentHome`'s **already-existing,
already-honest** `loadState.status === 'error'` branch ("Couldn't load Home / Something went wrong
loading your linked students. Try refreshing the page.") — a generic, true statement, rather than a
specific, false one. **This changes only the `sessionUser === null` branch.** The separate, later
branch — a resolved session, genuinely zero `guardian_links` rows — is unchanged and correctly still
resolves to `{students: [], teams: []}` → "No linked students yet," because that claim is true in
that case.

**Why this, not "render 'No linked students yet' regardless" (the round-1 default):** the honest
error state already exists on this page (constitution item 12 requires it, and it is already built);
reusing it for a genuinely-failed identity resolution is a one-line change that closes exactly the
gap MINOR 8 names. `checkin.ts`'s own `return []` for the identical null-session case is fine
*there* specifically because it feeds a sub-list inside `StudentMeetingView`, not a terminal
per-page claim — the gate's own distinction, accepted here rather than re-argued.

**Required test (criterion C12, below):** stub session resolution to return null (no session, no
error) → assert "Couldn't load Home" renders, never "No linked students yet." Paired positive: stub
a resolved session with zero `guardian_links` rows → assert "No linked students yet" still renders
correctly — proves the fix narrows rather than removes the legitimately-empty case.

## What a parent with no linked students sees — already correct, do not redesign

`ParentHome.tsx:1292-1302`'s zero-students `EmptyState` ("No linked students yet") is already honest
and already reachable once the outer seam returns a real empty list. **No change needed to this
branch** — only verify it positively (criterion C6) through the real loader path, not just the
fixture path.

## Build plan

1. `src/lib/supabase/loaders/parentHome.ts` (new):
   - Private `querySessionUserId` (mirrors `checkin.ts:382-390`, independently reimplemented).
   - Private `queryGuardianLinksForParent(client, parentProfileId)` (mirrors `checkin.ts:393-403`).
   - Private `queryStudentsByIds(client, studentIds)` → `id, display_name, team_id, is_active`.
   - Private `queryTeamsByIds(client, teamIds)` (or full-table — worker's call) → `id, name`.
   - `makeLoadLinkedStudentsForParentHome(getClient = getSupabaseClient): LoadLinkedStudentsFn` —
     composes the four queries via `Promise.all` where independent, joins client-side. Zero-arg
     signature, self-resolving session (see "Known traps" #3 below for why this design is kept, on
     its own merits, not the false dichotomy round 1 used). **When `querySessionUserId()` resolves
     `null`, throw — do not resolve `{students: [], teams: []}`** (MINOR 8 decision above). When the
     session resolves but `guardian_links` is empty, resolve `{students: [], teams: []}` as before.
   - Private raw queries for the fuller `events`/`event_sessions` (full columns, above) and
     `queryRsvpsForStudent`.
   - `makeLoadStudentHomeCardDataForParentHome(getClient = getSupabaseClient, nowFn: () => Date =
     () => new Date()): LoadStudentHomeCardDataFn` — binds `const loadStripData =
     makeLoadConsistencyStripData(getClient)` and `const loadScope =
     makeResolveStudentScope(getClient)` once, then calls `loadStripData(studentId)` /
     `loadScope(studentId)` alongside the new events/sessions/rsvps queries via `Promise.all`.
     **`nowFn` is required** — `buildNextEventsForStudent`'s fourth argument, `nowMs`, needs a
     clock; thread `nowFn().getTime()` through, mirroring `StudentHome.tsx`'s own injectable
     `nowFn` convention (`ResolvedStudentHomeViewProps.nowFn`), so C5 can be deterministic. When
     `loadScope` returns `null`: honest zero/absent fallback for `goalHours`/`confirmedHours`
     (mirrors `StudentHome.tsx:1500-1504`'s own disclosed fallback), never a rejection.
   - Both real defaults exported under non-colliding names (see "The central trap").

2. `src/pages/home/ParentHome.tsx`:
   - **Module doc #1 (`:20`)**: drop `goalHoursOverride` from `LinkedStudentRow`'s field list, add
     `isActive`. **Mandatory — gate-caught omission in revision 1.**
   - **Module doc #2 (`:40-47`)**: rewrite the false MET-04-denominator claim to name
     `v_student_goal_projection`/`resolveStudentScope` as the verbatim source. **Mandatory — same.**
   - `LinkedStudentRow`: drop `goalHoursOverride`, add `isActive: boolean`.
   - `StudentHomeCardData`: `defaultGoalHours` → `goalHours`.
   - `StudentHomeCardProps`: drop `goalHoursOverride`, add `isActive: boolean`.
   - Delete `studentGoalHours()` (gate-confirmed safe, see item-3 section).
   - `StudentHomeCard` render: use `data.goalHours` directly; add the factual `isActive === false`
     marker.
   - `ParentHome`'s prop defaults (`:1239-1240`): point at the two new real loaders.
   - `FIXTURE_STUDENTS` (`:508-522`): add `isActive: true` to all three rows (now required by the
     compiler). A fourth, inactive fixture student is optional.

3. `ParentHome.test.tsx`: update fixture-shaped test data for the renamed/removed fields. **Delete
   only `ParentHome.test.tsx:108-111`** (the `studentGoalHours` `it` block) — **not** the full
   `:107-118` range cited in revision 1, which also spans `hoursVsGoalPercent`'s own `it` at
   `:113-117`, staying untouched (MINOR 10). Rename the enclosing `describe` at `:107` to drop
   "studentGoalHours /" from its title. Add the rewritten C1–C6/C10/C12 tests below.

4. `parentHome.test.ts` (new): stub `getClient` the same way every `loaders/*.ts` test in this repo
   already does — inject a fake `SupabaseClient`, assert the query column lists and the client-side
   join, independent of `ParentHome.tsx`'s own rendering tests.

5. **`DashboardPage.test.tsx` (MAJOR 4, new in revision 2):**
   - Add a `vi.mock('../../lib/supabase/loaders/parentHome', ...)` block, mirroring the existing
     `meetings`/`students` mocks at `:46-64` exactly in style and placement (module-level, above the
     render harness). Mock whichever real default export names step 1 chose, returning fast,
     deterministic, **distinct, non-fixture** linked-student data — not `Ada R.`/`Bea R.`/`Cleo R.`,
     not any other `ParentHome.tsx` fixture constant. Suggested shape, matching this file's own
     `-fixture-dashboardpage` naming convention: one student, `displayName: 'Dashboard Fixture
     Linked Student'`, a distinct team name.
   - `:196-198` (the "renders ParentHome for role 'parent'" positive discriminator): replace `'Ada
     R.'`/`'Bea R.'`/`'Cleo R.'` with the new mocked name.
   - `:166`, `:179`, `:188` (the coach/admin/student negative discriminators): replace `'Ada R.'`
     with the same new mocked name, so these checks stay genuinely discriminating instead of going
     vacuous (gate-measured: with the real default wired and unmocked, `'Ada R.'` never appears for
     *any* role in this file, so the negative checks currently pass for the wrong reason).
   - Widen C9's enumeration (below) to include this file's own touched assertions, same disclosure
     standard as `ParentHome.test.tsx`'s.

## Acceptance criteria — every one pairs a positive with a mutation. **All render-based assertions
use `container.textContent`, never `container.innerHTML`** (gate round 1, MAJOR 7: `innerHTML`
absence checks produced false failures against CSS `style` attributes and Astryx-generated class
names, e.g. `not.toContain('5')` hit `style="width: 65.07…%"`, `not.toContain('41')` hit class
`x141an7d`). **Any numeric distinctness proof (confirmed/goal hours, participation percent) must
additionally read the specific `aria-valuetext` attribute on the relevant `[role="progressbar"]`
element** — established by inspecting the actual rendered node, not predicted from source.

**C1 — Outer seam renders real, distinct names, both ways. Regression proof rewritten (BLOCKER 1).**
Positive: inject a `loadLinkedStudents` prop returning two students with names/teams entirely
outside this file's fixture id-space. Render, read `container.textContent`, assert the injected
names/teams appear and none of the three fixture names do.
**Regression proof (rewritten):** render `<ParentHome />` with **no props at all**, in the jsdom/
vitest environment where Supabase is unconfigured, so the real default (once wired per this packet)
runs and genuinely fails. Assert `container.textContent` contains **"Couldn't load Home"** (the
page-level honest error banner, `ParentHome.tsx:1281`) and does not contain "Ada R."/"Bea R."/
"Cleo R." — paired, not standalone. **Mutation:** revert the prop default back to
`defaultLoadLinkedStudents` → the same no-props render now succeeds instantly with fixture data:
"Couldn't load Home" disappears and "Ada R." appears — **gate round 1 measured this exact
replacement goes red under this exact mutation.**

**C2 — Per-card data is real, distinct, non-fixture. Mutation rewritten to the outer-seam-injected
shape (MAJOR 5).** Positive: inject a real-shaped, succeeding `loadLinkedStudents` (distinct outer
data) **and** a stubbed, succeeding `loadStudentData` (distinct, non-fixture confirmed/goal figures
and next-event title) via props. Assert the distinct figures/title render via `textContent`/
`aria-valuetext`, fixture figures/titles absent.
**Regression proof (corrected):** inject the same succeeding `loadLinkedStudents` via props, but
**omit `loadStudentData`** so its real (unconfigured, failing) default runs. Assert every card shows
its own **"Couldn't load this student's Home card"** banner (`ParentHome.tsx:1155`, per-card, not
page-level — the outer seam already succeeded) and none of the fixture figures/titles appear.
**Mutation:** point the per-card default back at `defaultLoadStudentHomeCardData` while still
supplying only `loadLinkedStudents` → cards now succeed instantly with fixture figures/titles
instead of the error banner.

**C3 — `goalHours` is a verbatim passthrough, never TS-recomputed (constitution item 3). Unblocked
by importing the factory (BLOCKER 2).** Stub the injected client so `v_student_goal_projection`'s
row for the test student returns `goal_hours = 63`, while a co-present raw `students
.goal_hours_override` (if the stub surfaces it) is a different number, e.g. `999` — a value a
TS-side `override ?? default` coalesce would still produce if it were running. Render, read the
`[role="progressbar"]` element's `aria-valuetext` (or whatever attribute the real render actually
carries — establish this by inspecting the DOM; C3's `'999'` passing "by luck, not design" is a
named gate finding, do not repeat it), assert `63` and not `999`. **Mutation:** reintroduce a
TS-side coalesce over raw `students` columns instead of `resolveStudentScope`'s verbatim
`goalHours` → must now show `999`. Inspection: grep the new loader file and `ParentHome.tsx` for
`??` near `goal_hours_override`/`goalHoursOverride`/`defaultGoalHours` in any production code path
— zero matches, or a named, justified exception.

**C4 — A deactivated linked student's card is honest and present.** Inject an outer-seam student
row with `isActive: false` and a per-card stub where the goal-projection query returns no row.
Render, read `textContent`: assert (a) exactly one card renders with the student's name/team badge
(count cards, don't just check for absence of an error), (b) the honest-absence figures render
(confirmed/goal at the real clamped zero state via `aria-valuetext`, participation "—", "Nothing
scheduled" — established by dumping the DOM), (c) the factual `isActive` marker's exact chosen copy
appears. **Mutation 1:** strip the `isActive` branch → the marker disappears, card and honest-zero
figures remain. **Mutation 2:** inject a non-zero, non-fixture confirmed/goal figure alongside
`isActive: false` and assert it does not leak onto this card. **Also assert exactly one card
renders, not zero** — rules out this being mistaken for the zero-students page-level `EmptyState`.

**C5 — Next-3-events sourced from real data, mutation replaced (MAJOR 6).** `buildNextEventsForStudent`
stays untouched and its own pure-function tests are unaffected — this criterion proves the real
loader feeds it correctly. Stub two students on two different non-fixture teams, a shared "all
teams" event, and an earliest-dated competition-type event, with the injected `nowFn` fixed to a
known instant. Render both cards, assert each shows only its own team's event(s) plus the shared
one, never the competition. **Mutation (corrected — there is no `type` filter to remove in the
composition path, gate-measured):** in the new events row-mapper, mis-map the `type` field (e.g.
swap the `'competition'`/`'outreach'` labels, or hardcode `type: 'meeting'` for every row) — this
lets the mislabeled competition event pass `buildNextEventsForStudent`'s own untouched type check
and leak into the Next-up list. Gate-confirmed to produce a real failure.

**C6 — Zero linked students, reached through the real (not fixture) empty result — a resolved
session with genuinely zero `guardian_links` rows, distinct from C12's unresolved-session case.**
Stub the real-shaped loader to return `{students: [], teams: []}` via a resolved-but-empty
`guardian_links` query (not a null session). Assert "No linked students yet" renders. Paired with
C1's non-empty case; not standalone.

**C7 — RLS/availability reasoning recorded, explicitly labeled reasoned-not-measured**, in the new
loader file's own module doc.

**C8 — the five standard gates**, worker's own dispatch SHA. eslint: **expect 356, not 357**
(gate-measured −1 from deleting `studentGoalHours`'s export). vitest: report the new file/test count
delta explicitly, matching T176's own "+10, exactly the new `it(` blocks" disclosure standard.

**C9 — no unexplained change to pre-existing passing tests, widened to `DashboardPage.test.tsx`
(MAJOR 4).** Enumerate every pre-existing assertion touched in **both** `ParentHome.test.tsx` and
`DashboardPage.test.tsx`, mechanical-rename vs. actual-behavior-change for each. Zero `.skip`/
`.only`/`.todo`. Sabotage check: no diff outside the Allowed list, in particular zero diff against
`guards.tsx`, `checkin.ts`, `students.ts`, `parents.ts`, `StudentMeetingView.tsx`, `StudentHome.tsx`,
`CoachHome.tsx`, `DashboardPage.tsx` (the component itself), and every `supabase/migrations/**` file.

**C10 — the two `loadLinkedStudents` contracts are never cross-wired.** Unchanged from revision 1;
gate-confirmed strongest criterion. Grep confirms no cross-import; proof-by-attempted-misuse
captures the real `TS2322` shown above, then discards the scratch edit.

**C11 — `DashboardPage.test.tsx`'s role-dispatch discriminators stay real and non-vacuous (new,
MAJOR 4).** With the mock from build-plan step 5 in place: the "renders ParentHome for role
'parent'" test asserts the new mocked distinct name, not a fixture name that no longer reaches the
DOM by default. The coach/admin/student tests' negative checks assert the same new mocked name is
absent — genuinely discriminating (a role-dispatch bug would make it leak), not vacuously true.
**Mutation:** swap the `parent` case in `DashboardPage.tsx`'s switch to render `<CoachHome />`
instead (a scratch, uncommitted edit, discarded after) → the "renders ParentHome" test must fail.

**C12 — an unresolved session never renders "No linked students yet" (new, MINOR 8 decision).**
Stub session resolution to return null (no session, no error). Assert "Couldn't load Home" renders,
never "No linked students yet." Paired positive: stub a resolved session with zero `guardian_links`
rows (C6's own case) and assert "No linked students yet" still renders correctly.

## Constitution excerpts relevant to this task

- **Item 3** (BLOCKER-class): governs the goal-hours finding — see item-3 section above.
- **Item 6:** fixtures use fabricated names — governs any new fixture data and the
  `DashboardPage.test.tsx` mock's chosen name.
- **Item 12:** all four DES-12 states — unaffected, already satisfied structurally; do not regress
  while rewiring.
- **Item 17** (BLOCKER-class): no loss-aversion/guilt/streak framing, including in the `isActive`
  marker's copy.
- **Item 18:** worker tier triggers — none apply; sonnet is correct.
- **Item 19/19a/19b:** premise gate capped at two rounds — this is round 2, no gate follows it.
- **Item 25:** tier follows genuine complexity, not topic sensitivity — governs both the worker-tier
  call and the gate-depth call made in revision 1, both unchanged here.

## Known traps, restated and corrected for revision 2

1. Do not import `loadLinkedStudents`/`LoadLinkedStudentsFn`/`makeLoadLinkedStudents` from
   `checkin.ts` for the outer seam. Different contract, same name.
2. Do not re-derive the goal-hours coalesce in TypeScript anywhere in the production path.
3. **Hook-ordering — re-argued on its actual merits, not the false dichotomy round 1 used (MINOR
   9).** Round 1 claimed the choice was "reorder the identity gate (risky) or self-resolve the
   session (the only safe option)." Gate round 1 measured that dichotomy is false: passing `user.id`
   directly gives `TS18047` (possibly null) as claimed, and reordering the null check before
   `useLoadState` passes `tsc` but trips a hard `eslint` error
   (`react-hooks/rules-of-hooks: React Hook "useLoadState" is called conditionally`) — that hazard
   is real, and only eslint catches it. **But a null-guarded closure (call the hook unconditionally,
   guard the async body: `if (user === null) return Promise.reject(...); return
   loadLinkedStudents(user.id)`) or an inner "authed" component (mirroring T155/T176's own outer-
   wrapper pattern) are both safe and need no reorder.** Decision, kept, argued on merits instead:
   self-resolve (mirror `checkin.ts`'s own already-shipped `querySessionUserId` pattern) — lowest
   risk available on a round with no gate behind it; zero change to `ParentHome.tsx`'s own already-
   declared zero-arg `LoadLinkedStudentsFn` signature, so `ParentHome.test.tsx`'s existing call
   sites and the fixture default stay untouched; the extra round trip is real but small next to the
   already-disclosed 7-per-card query fan-out (trap 5, below). A caller-supplied-identity design is
   a legitimate, arguably more efficient alternative for a *future* task — declined here specifically
   because of this being the final round, not because it is unsafe.
4. Do not copy T184's redirect/three-way-union design onto the deactivated-student card without
   re-deriving why — the situations differ (blocked actor vs. an unaffected observer's card).
5. **Disclose, do not silently accept, the double `event_sessions` scan and full query fan-out
   (MINOR 11, new).** `makeLoadConsistencyStripData`'s own internal query and this task's new fuller
   `event_sessions` query both scan the same table for the same student, once each, per card.
   Measured per-card table touches: `event_sessions`, `attendance`, `v_student_participation` (all
   three inside the reused strip loader), `v_student_goal_projection`, `events`, `event_sessions`
   (again), `rsvps` — 7 round trips per card; a parent with 3 linked students: 21 per-card queries
   plus ~4 outer-seam queries. **Not fixed here** — forking the strip loader's internals to dedupe
   the scan would mean abandoning the clean, checker-verified-elsewhere reuse this packet is built
   on, a worse trade for a final round. Record this in the new loader file's own module doc.
6. Do not leave `studentGoalHours()`, `goalHoursOverride`, or `defaultGoalHours` behind as unused-
   in-production exports "for symmetry." Delete (gate-confirmed safe) or justify with a real,
   checked call site.
7. `DashboardPage.tsx` itself does not need editing — only its test file (Allowed in revision 2). If
   a diff touches the component, that is a sign the prop-default-swap approach was abandoned
   somewhere; stop and reconsider rather than pushing the change upward.
8. `buildNextEventsForStudent` needs an injectable clock (`nowFn`) threaded through the new per-card
   loader factory — unmentioned in revision 1 (MINOR 12), required for C5 to be deterministic.
