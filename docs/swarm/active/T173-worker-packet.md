# Worker Packet: T173

**Status: ROUND 2 of `checker-premise`, revised in place (constitution item
19a — 2-round cap).** Round 1 returned REVISE: 1 BLOCKER, 1 MAJOR, 4 MINOR, 1
NIT. Every point is addressed below; see "Round 2 revision notes" immediately
below for a compact map of what changed and where. Tier (**sonnet**),
checker (**checker-reviewer, opus**), and gate scope (**light/narrow**) were
all independently confirmed correct in round 1 — unchanged.

## Round 2 revision notes (map of every round-1 finding to its fix)

1. **BLOCKER (fixed, approach (a) — the gate's preferred fix):** added a
   second `vi.mock('../../lib/supabase/loaders/dashboard', ...)` block to
   `DashboardPage.test.tsx`, alongside the new `loaders/coachHome` mock. See
   "Proving the wiring for real in `DashboardPage.test.tsx`" below and
   Allowed Files. Independently re-verified by direct read of
   `DashboardPage.test.tsx:1-122` (no `loaders/dashboard` mock existed) and
   `CoachHome.tsx:2466` (the `{dashboardData && (...)}` gate) — confirmed,
   not just trusted.
2. **MAJOR (adopted):** `defaultGoalHours` is no longer queried by the new
   loader at all. It's threaded as a new prop from `CoachHome`'s outer
   wrapper (`activeSeason.season.defaultGoalHours`, already fetched by
   `useActiveSeason()`) into `CoachHomeContent` — the exact pattern T176
   already shipped for `StudentHome`'s `goalHours`/`confirmedHours`/
   `plannedHours` (verified directly: `StudentHome.tsx:1290-1318`,
   `loaders/students.ts:519-547`). This deletes the season query and its
   row-not-found handling/test entirely (old criterion 3 is gone). Full
   redesign below — this touches more of `CoachHome.tsx` than round 1's
   "exactly THREE edits" (now eight named, still narrow, edit regions — see
   Allowed Files), which is the real cost of adopting this; independently
   verified every other test in `CoachHome.test.tsx`/`DashboardPage.test.tsx`
   stays unaffected (see verification notes inline).
3. **MINOR (harness-hazard scan):** `CoachHome.test.tsx:1295` (a zero-props
   `<CoachHome />` mount inside the "T155 — fail-loud without a
   `<SeasonProvider>` ancestor" block, `:1283-1309`) is now named explicitly
   below, with the safety reasoning stated in the packet, not just implied.
4. **MINOR (PRD claim):** citation fixed to `VOLT_Portal_PRD.md:275` (not
   `:274`); the claim reworded to not overstate what the PRD says. Corrected
   T198 wording is provided at the bottom for the orchestrator to apply to
   `docs/swarm/task-ledger.md` (Forbidden file, not editable here).
5. **MINOR (`hasGoalsConfigured: true` wording):** reworded to "pre-filled
   and un-blankable" instead of "explicitly set"; added the `default_goal_hours
   = 0` disclosed-edge-case note to the new loader's required doc comment.
6. **MINOR (citation drift):** `1358-1388` → `1358-1389` (both occurrences);
   `queryDashboardStudents` citation corrected to `:396`; "four assertions"
   reworded to "six `expect` calls covering four widgets"; added the
   transitive-step sentence for `sessions`/`rsvps`/`attendance` citing
   `selectCheckInSession` (`:1156-1173`).
7. **NIT:** the Test A/B rewrite instructions now say explicitly, in two
   places, that the existing `loadDashboardData: defaultLoadDashboardData`
   pin (currently `:1364`) must be RETAINED, not dropped.

## Task ID
T173

## Objective
Fix the three fabricated on-screen surfaces named in the T173 ledger row that
survived T155: `Hours vs. team goal`'s denominator (`0 / 38 hrs`), `Avg hours
/ active student`'s `Default goal 10h` secondary, and the admin `Season
setup` card's permanent false-positive. All three trace to two fields inside
`CoachHomeData` — `defaultGoalHours` and `seasonSetupStatus` — that stayed on
fixture data after T155's outer/inner split, plus `teams`/`students`
themselves (needed as inputs to the first two surfaces). Add a new, real
Supabase-backed loader that sources `teams`/`students`/`seasonSetupStatus`
for real; wire it as `CoachHome`'s new production `loadData` default; and
resolve `defaultGoalHours` by threading it as a separate prop from the
already-fetched active season object (Round 2 redesign — see below), the same
way T176 already threads `StudentHome`'s goal-hours fields. Leave everything
else in `CoachHomeData` (`events`/`sessions`/`rsvps`/`attendance`/
`teamParticipation`/`studentHours`) as literal honest-empty values — no new
queries for those, no `FIXTURE_*` reference. `defaultLoadCoachHomeData` itself
is untouched and stays exported for tests.

## Scope ruling (read before starting — two narrowing decisions, both
investigated directly against the live repo, not inherited from the ledger
row)

**1. `teamId` / `PLACEHOLDER_CURRENT_TEAM_ID` is explicitly OUT of scope for
this task, and no schema/auth change is being scoped here either — this
narrows the ledger row's "scope as one task, not sequentially" instruction,
on new evidence the row didn't have.** The ledger row treated the loader work
and team-resolution as one inseparable piece of work because it assumed a
real per-coach "team" value needs resolving. Direct investigation shows this
premise itself is unconfirmed and probably wrong, not merely technically
gapped:
- `AuthUser` (`src/app/guards.tsx:49-53`) is `{id, email, role}` — no team
  field, confirmed by direct read.
- No table anywhere links a staff profile to a team. `profiles`
  (`supabase/migrations/20260716000000_identity_roster.sql:16-24`) has no
  team column; there is no `staff_team_links`-shaped table anywhere in
  `supabase/migrations/`.
- RLS grants every admin/coach **unrestricted, program-wide** access, not
  team-scoped access. Quoted verbatim
  (`supabase/migrations/20260717000002_rls.sql`):
  ```sql
  -- teams (lines 62-64)
  create policy staff_all on teams
    for all to authenticated
    using (is_staff()) with check (is_staff());
  -- students (lines 96-98)
  create policy staff_all on students
    for all to authenticated
    using (is_staff()) with check (is_staff());
  ```
  Neither policy — nor any other `staff_all` policy in the file — filters by
  team. `teams`/`seasons` additionally carry a `read_all` policy
  (`:66-67`, `:78-79`) open to every authenticated user regardless of role.
- PRD `HOME-01` (`docs/swarm/VOLT_Portal_PRD.md:275`, re-verified — round 1
  cited `:274`, which is actually the line above, the section header) reads:
  *"KPI `Card`s: Team participation % (MET-02) · Total outreach hours vs
  **team goal** with `ProgressBar` · Attendance rate of last completed
  meeting · Events in next 7 days"*, prefaced only by *"scoped to selected
  season"* (`:274`). **Correction from round 1's checker-premise finding:**
  the PRD does name a "team goal" — it is not silent on team-scoping
  language. What's actually missing is a *data-model representation of which
  team a given coach belongs to* — the PRD assumes team-scoping is
  meaningful but the schema has no way to compute it per-viewer. That gap,
  not an absence of team wording in the PRD, is why this is a product
  question for the human owner (T198), not an engineering gap this packet
  can resolve.
- `CoachHome.tsx`'s own module doc #13(a) (lines 372-389) already reached a
  related conclusion for the newer T124 widgets, citing D-2 directly: those
  five widgets are deliberately season-wide, "never filtered by this file's
  existing `PLACEHOLDER_CURRENT_TEAM_ID`," because the binding
  capability-map reference and D-2's "P3 + GG = VOLT" framing show one
  combined program, not per-team views.

Taken together: this product has no data-model concept of "a coach's team,"
and every signal available (RLS, PRD wording naming a team goal with no way
to compute it per-viewer, an already-approved precedent in this exact file)
points toward the *pre-existing* KPI grid's team-scoping being a stale,
pre-D-2 (T053-era) design decision rather than a fully-specified, resolvable
requirement — not a genuine schema gap waiting on a migration. Deciding
between "make the remaining team-scoped widgets season-wide like T124's" and
"build a real team-assignment concept" is a product-scope call for the human
owner, not an engineering gap this packet can resolve or should attempt to.
**Do not touch `PLACEHOLDER_CURRENT_TEAM_ID`, the `teamId` prop, or its
default value in this task.** See the proposed follow-up row (T198) at the
end of this packet.

**Consequence, verified safe, not just assumed:** leaving `teamId` untouched
while making `students`/`teams` real does not reintroduce or worsen any
defect. `sumGoalHours` (`CoachHome.tsx:979-988`) filters students by
`student.teamId === teamId`. Once `students` is sourced from the real
`students` table, every row's `teamId` is a real team UUID, which will never
equal the literal string `'team-placeholder-current-viewer'`
(`PLACEHOLDER_CURRENT_TEAM_ID`, `:708`) — so the roster-sum this task's fix
touches will floor to `0` (an honest, if not yet richly functional, value),
the same "placeholder never matches a real id" resolution class T155 already
established and shipped for four sibling widgets on this same page (module
doc #14). This is not a new gap; it is the existing, accepted gap, now also
covering this specific tile instead of hiding behind a fabricated non-zero
number.

**2. `seasonSetupStatus.hasGoalsConfigured` has no backing schema signal at
all — resolved here via a disclosed, schema-grounded judgment call, not
deferred.** Unlike `teamId`, this field genuinely can be made honest without
any new column, but the reasoning takes a paragraph and you should verify it
yourself before relying on it:
- `seasons.default_goal_hours` (`identity_roster.sql:47`) is `numeric not
  null default 100` — every season row that exists has a real, non-null
  value.
- `SeasonSettings.tsx` (`src/pages/settings/SeasonSettings.tsx`) is the only
  place a season is created. `DEFAULT_GOAL_HOURS = 100` (`:435`) pre-fills
  the create form's initial state (`:742`) and re-seeds it again after every
  successful create (`:756`) — the field is **pre-filled and un-blankable**,
  not merely "explicitly set by a human": `isSeasonFormValid` (`:471-478`)
  requires `defaultGoalHours !== null && defaultGoalHours >= 0`, and
  `buildCreateSeasonPayload` (`:481-491`) returns `null` — blocking the
  create action — unless `isSeasonFormValid` passes. The form structurally
  cannot submit a null value; it can only submit some non-negative number,
  whether that's the 100-hour pre-fill left untouched or a value the admin
  typed over it.
- `CoachHome`'s outer wrapper (`:2134-2146`) already handles "no season
  exists yet" as its own distinct `'none'` state (`activeSeason.status`),
  before `CoachHomeContent` (and this field) is ever reached. So by
  construction, every season this field is evaluated against already has a
  real, non-null `default_goal_hours`.
- Net effect: for any season that can reach this code path, "has this
  season's goal hours been configured" is always true — not an approximation
  or a guess, but a direct logical consequence of the NOT NULL constraint
  plus the mandatory create-time form field. **Resolve `hasGoalsConfigured`
  to the literal `true`, with a doc comment citing this reasoning**, rather
  than inventing a proxy or leaving it hardcoded `false`.
- **Disclosed edge case, not a bug:** `isSeasonFormValid` accepts
  `defaultGoalHours >= 0`, so a season created with `default_goal_hours = 0`
  is possible and would still correctly report `hasGoalsConfigured: true` —
  zero is still "configured," just configured to zero. State this in the new
  loader's doc comment.
- Practical effect on `isSeasonMissingSetup` (`:1446-1451`,
  `teams.length === 0 || !status.hasGoalsConfigured`): the admin "Season
  setup" card will now correctly show only when `teams.length === 0`, and
  correctly stop permanently showing otherwise — closing the exact defect
  named in the ledger row ("permanently true").
- **If you disagree with this reasoning after reading `SeasonSettings.tsx`
  and the migration yourself, say so explicitly in your output rather than
  silently picking a different resolution** — this is the one genuinely
  non-mechanical call in this packet, flagged for checker scrutiny, not
  asserted as beyond question.

**Not in scope, disclosed, not silently dropped:** `events`, `sessions`,
`rsvps`, `attendance`, `teamParticipation`, `studentHours` stay literal
honest-empty values in the new loader (`[]`/`null`), not new Supabase
queries — even though the ledger row calls a real `teamParticipation`/
`studentHours` loader "mechanical... not new SQL design." For any real
season today, `defaultLoadCoachHomeData`'s existing season-filtered fixture
logic for `events` (`:1471`) *already* evaluates to the same empty result (no
real season will ever equal `PLACEHOLDER_SEASON_ID`), so this is a
zero-regression, zero-behavior-change omission for now: `teamParticipation`/
`studentHours` are ALSO already season-filtered (`:1475-1476`) the same way,
and every consumer of `sessions`/`rsvps`/`attendance` reaches them only by
first joining through `data.events` — e.g. `selectCheckInSession`
(`:1156-1173`, the `events`-filter at `:1162-1166` builds the `eventId` set
that everything else is matched against) — so once `events` is empty, those
three fields are unreachable regardless of their own (currently unfiltered)
fixture content. Genuinely real queries for those four/two fields are
additional, separable work, not required to close the three defects this
task targets. Filed as part of follow-up T198 below (bundled with the wider
"these widgets should probably become season-wide" question, since building
real per-team queries for them would be wasted work if that question
resolves toward season-wide instead).

## Round 2 redesign: how `defaultGoalHours` reaches the DOM (read before
starting — this replaces round 1's "query 1 of 3" design)

**`defaultGoalHours` is NOT a query the new loader performs.** `CoachHome`
already calls `useActiveSeason()` (`:2120`), and the `'ready'` branch
(`:2158-2168`) already holds `activeSeason.season`, a full `SeasonRow`
(`src/lib/supabase/types.ts:128-136`) that already carries
`defaultGoalHours: number` — real, sourced from `loaders/seasons.ts:172-174`'s
`queryActiveSeason` (`select('*')`), a query that already runs on every
`CoachHome` render, before this task, unrelated to anything you're adding.
Re-querying `seasons.default_goal_hours` inside the new `coachHome.ts` loader
would be a second, redundant read of a value already in memory — and per
Scope ruling #2's own point, `seasonId` passed into `loadData` is always
already the resolved active season's id, so a hypothetical "season not
found" branch inside the new loader could never actually be reached. This is
the exact pattern T176 already shipped for `StudentHome`: `goalHours`/
`confirmedHours`/`plannedHours` are threaded as separate props from
`resolveStudentScope` (`StudentHome.tsx:1286-1318`), NOT read through the
`loadData` seam's own return value — and `loadStudentHomeData`
(`loaders/students.ts:519-547`) returns a literal, inert `defaultGoalHours: 0`
(`:538`) for the exact same reason: the field stays declared on the type
(other tests still read it directly off the OLD fixture loader), but the
REAL production render path no longer consults it.

**Apply the identical pattern here:**
1. `CoachHomeData.defaultGoalHours: number` (`:690`) stays declared,
   byte-unchanged, on the interface — `defaultLoadCoachHomeData`'s own
   fixture return (`:1465-1479`, including `defaultGoalHours:
   FIXTURE_DEFAULT_GOAL_HOURS` at `:1468`) and the `defaultLoadCoachHomeData
   (shipped fixture composition...)` describe block (`:999-1030`, which reads
   `data.defaultGoalHours` directly, bypassing any render-path change) both
   stay completely unaffected — independently verified: no other test in
   `CoachHome.test.tsx` asserts the literal text `Default goal 10h` or `0 /
   38 hrs` outside the one describe block you're already rewriting (grepped
   directly, zero other matches).
2. Your new loader's `Promise<CoachHomeData>` still populates this field —
   with the literal `0`, not a query result — documented in a doc comment
   citing `loaders/students.ts:538`'s identical precedent and stating
   explicitly that this value is never read by `CoachHome.tsx`'s render path
   (see point 4 below), only kept because the type still declares the field.
3. `CoachHomeContentProps` (`:2181-2188`) gets one new field:
   `defaultGoalHours: number;` — a plain prop, NOT part of `loadData`'s
   return, NOT gated behind `loadState`. `CoachHomeContent`'s function
   signature (`:2190-2197`) destructures it. The `'ready'` case call site
   inside `CoachHome` (`:2158-2168`) passes
   `defaultGoalHours={activeSeason.season.defaultGoalHours}` — the SAME
   `activeSeason.season` object whose `.id` already becomes `seasonId`
   (`:2162`), so there is no staleness risk: both values come from one
   fetch, one render cycle.
4. Two consumption-site edits inside `CoachHomeContent`, both currently
   reading through `data`/`successData`:
   - `:2235` — `sumGoalHours(successData.students, teamId,
     successData.defaultGoalHours)` → `sumGoalHours(successData.students,
     teamId, defaultGoalHours)` (the new prop, not `successData`).
   - `:2477` — `Default goal {data.defaultGoalHours}h` → `Default goal
     {defaultGoalHours}h` (the new prop, not `data`).
   The FUNCTION DEFINITIONS of `sumGoalHours`/`sumConfirmedHours`
   (`:979-1010`) do not change at all — only this one call site's third
   argument changes.

**Net effect on the new loader:** it now performs exactly TWO real queries
(`teams`, `students`), not three. No row-not-found handling, no row-not-found
test — that entire code path doesn't exist because there's no season query
to have a missing row.

## Allowed Files
- `src/lib/supabase/loaders/coachHome.ts` — new file, additive only.
- `src/lib/supabase/loaders/coachHome.test.ts` — new file.
- `src/pages/home/CoachHome.tsx` — exactly EIGHT edits, nothing else (wider
  than a typical narrow packet because of the Round 2 redesign — each region
  is still small and individually enumerable; diff the whole file at the end
  and confirm nothing outside this list moved):
  1. One new import statement after the existing `loaders/dashboard` import
     block (after line 596): `import { loadCoachHomeData } from
     '../../lib/supabase/loaders/coachHome';` (or your own chosen export
     name — keep it consistent with your new file).
  2. The default-parameter value at line 2114 (`loadData =
     defaultLoadCoachHomeData` → `loadData = loadCoachHomeData`). Line 2116
     (`teamId = PLACEHOLDER_CURRENT_TEAM_ID`) is explicitly NOT touched (see
     Scope ruling #1).
  3. `CoachHomeContentProps` (`:2181-2188`): add one new field,
     `defaultGoalHours: number;`.
  4. `CoachHomeContent`'s function parameter destructuring (`:2190-2197`):
     add `defaultGoalHours` to the destructured list.
  5. The `'ready'` case's `<CoachHomeContent>` call site inside `CoachHome`
     (`:2158-2168`): add `defaultGoalHours={activeSeason.season.defaultGoalHours}`.
  6. Line `:2235`: `successData.defaultGoalHours` → `defaultGoalHours` (the
     new prop) as `sumGoalHours`'s third argument.
  7. Line `:2477`: `data.defaultGoalHours` → `defaultGoalHours` (the new
     prop) in the rendered text.
  8. Module doc lines 545-555 (the stale closing paragraph of section 14):
     replace with a short pointer forward (e.g. "fixed by T173 — see section
     15 below"), and add a new section 15 immediately after (before the
     closing `*/` at line 556) documenting: `teams`/`students`/
     `seasonSetupStatus` now real, sourced from `loaders/coachHome.ts`;
     `defaultGoalHours` now threaded as a prop from
     `activeSeason.season.defaultGoalHours` (Round 2 redesign above), NOT
     from `loadData` — the new loader's own `CoachHomeData.defaultGoalHours`
     field is populated with an inert literal `0`, unread by the render path,
     kept only because the type still declares it (cite
     `loaders/students.ts:538`'s identical T176 precedent); `teamId` still a
     disclosed placeholder (Scope ruling #1, with the "floors to honest
     zero" consequence stated); the `hasGoalsConfigured: true` reasoning
     (Scope ruling #2), briefly, with a pointer to the fuller reasoning in
     the new loader file's own doc comment; `events`/`sessions`/`rsvps`/
     `attendance`/`teamParticipation`/`studentHours` still literal
     honest-empty (not real queries), filed as T198.
  `defaultLoadCoachHomeData` (lines 1465-1479), `isSeasonMissingSetup`
  (`:1446-1451`), the FUNCTION DEFINITIONS of `sumGoalHours`/
  `sumConfirmedHours` (`:979-1010` — NOT their call site at `:2235`, which is
  edit 6 above), `CoachHomeData` (`:688-700`, the interface itself, including
  its still-declared `defaultGoalHours` field), and every other pure
  function/render line are byte-unchanged — diff the file and confirm
  nothing else moved.
- `src/pages/home/CoachHome.test.tsx` — ONLY the describe block at (current)
  lines 1358-1389 (the "T155 -- measured-reality proof" block) plus one new
  import line for whatever you export from `coachHome.ts` (e.g.
  `makeLoadCoachHomeData`). Do not touch any other test in this file — all
  ~30 other `renderAsUser(...)` call sites explicitly pass `loadData:
  fixtureLoadData` (which calls `defaultLoadCoachHomeData` directly,
  independent of `CoachHome`'s own default parameter) and are unaffected;
  confirm this yourself before you rely on it (see "The one test that must
  change on purpose" below for the full verification, including a completed
  harness-hazard scan).
- `src/pages/home/DashboardPage.test.tsx` — scoped to exactly TWO regions:
  1. TWO new `vi.mock` blocks, added alongside the file's existing
     `loaders/meetings`/`loaders/students`/`loaders/parentHome` mocks (lines
     52-122): `vi.mock('../../lib/supabase/loaders/coachHome', ...)` and
     `vi.mock('../../lib/supabase/loaders/dashboard', ...)` — the second one
     is required (round-1 BLOCKER fix): `CoachHome.tsx:2477`'s `Default goal
     {defaultGoalHours}h` text lives inside the `{dashboardData && (...)}`
     gate (`:2466`), which only opens once `loadDashboardData` resolves;
     `DashboardPage.tsx` mounts `<CoachHome />` zero-props and this file
     mocks no `loaders/dashboard` export today, so that gate never opens in
     the current file and no assertion inside it could ever pass. See
     "Proving the wiring for real" below for both mocks' exact shape.
  2. The `renders CoachHome for role "coach"` (lines 213-236) and `renders
     CoachHome for role "admin"` (lines 238-251) tests: each needs new
     assertions proving the mocks' wiring reaches the DOM for real (see
     "Proving the wiring for real" below) — the file's existing assertions
     currently only prove `CoachHome` mounted at all, not that its
     `loadData` default actually changed. The admin test's existing `Season
     setup` comment (lines 242-245) needs a one-line correction (see below).
  `DashboardPage.tsx` itself (the source component) stays Forbidden.

## Forbidden Files
- Everything under `supabase/migrations/` (read-only reference only).
- `src/app/guards.tsx`, `src/app/router.tsx`, `src/app/SeasonProvider.tsx`.
- `src/lib/supabase/loaders/dashboard.ts`, `src/lib/supabase/loaders/
  students.ts`, `src/lib/supabase/loader.ts`, `src/lib/supabase/client.ts`.
  (Your new file must not import any VALUE from `CoachHome.tsx` — see
  "Avoiding a circular import" below — and must not modify `dashboard.ts`,
  even though it is a close sibling in shape.)
- `src/pages/home/DashboardPage.tsx`, `src/pages/home/StudentHome.tsx`,
  `src/pages/home/ParentHome.tsx`.
- `docs/swarm/constitution.md`, `docs/swarm/task-ledger.md`,
  `docs/swarm/verification-log.md`, `docs/swarm/dispute-log.md`, `.claude/`.

## Context you need (re-verified against current repo state at this
worktree's HEAD; cite these line numbers, not the ledger row's, if you quote
anything back — they will have drifted further by the time you start,
per constitution item 19c)

**The production default and its consumers.** `CoachHome.tsx:2114`:
`loadData = defaultLoadCoachHomeData` is `<CoachHome />`'s own default
parameter, and `DashboardPage.tsx:103`/its render call mounts `<CoachHome
/>` with zero props, so this default is the only implementation that ever
runs in production. `LoadCoachHomeDataFn` is declared at `:702`
(`(seasonId: string) => Promise<CoachHomeData>`). `CoachHomeData` is declared
at `:688-700`. `defaultGoalHours` (the new PROP, per the Round 2 redesign
above — NOT `data`/`successData`) is consumed at `:2235` (`sumGoalHours`'s
third argument, feeds the `Hours vs. team goal` denominator) and `:2477`
(`Default goal {defaultGoalHours}h`, the `Avg hours / active student`
secondary — this surface is otherwise fully real, `avgHoursPerActiveStudent`
comes from T124's `v_season_roster_stats`). `seasonSetupStatus` is consumed
at `:2285` (`isSeasonMissingSetup(data.teams, data.seasonSetupStatus)`, gates
the admin "Season setup" card). `teams`/`students` are consumed by
`sumGoalHours`/`sumConfirmedHours` (`:2235,2238`) and `isSeasonMissingSetup`
(`:2285`, `teams` only) and `seasonSetupDescription` (`:2734`, both).

**Avoiding a circular import — read before choosing where the new
function's logic lives.** `CoachHome.tsx` already imports (value + types)
from `../../lib/supabase/loaders/dashboard` (`:586-596`). If your new file
also imports a VALUE (not just a type) from `CoachHome.tsx` — e.g. calling
`defaultLoadCoachHomeData` to compose your new function on top of it — you
create a real runtime circular import (`CoachHome.tsx` → your file → back to
`CoachHome.tsx`), unlike the type-only import direction T183 already proved
safe for `loaders/students.ts` ↔ `StudentHome.tsx` (type-only imports are
erased; a value-level cycle is not). **Do not call
`defaultLoadCoachHomeData` from your new file.** Return the literal
honest-empty values directly instead (see "Return shape" below) — this also
matches T183's own `loadStudentHomeData` convention exactly ("no FIXTURE_*
symbol referenced anywhere in the new code").

**The exact pattern to mirror.** `loaders/dashboard.ts:198-296`
(`queryRosterStats`) and `:297-302` (`queryDashboardTeams`) — read-only
reference, do not edit — are the closest precedents: plain
`.select(...).eq(...)` or `.select(...)` query functions returning
`LoaderQueryResult<TRow>`, composed via `createLoader<TArgs, TRow>(queryFn,
getClient)`, combined in a `Promise.all` inside a `makeLoadXyz(getClient =
getSupabaseClient)` factory, exported as a named singleton
(`export const loadDashboardData: LoadDashboardDataFn =
makeLoadDashboardData();`, `:743`). (`queryDashboardStudents`, same shape
again, is a further sibling at `:396` — not inside the `198-302` range,
correcting round 1's citation.) Build your new file the same shape, but with
only TWO queries (`teams`, `students` — no `seasons` query; see "Round 2
redesign" above for why).

**The two real queries you need, verbatim columns:**
1. `teams.id`/`teams.name` (`identity_roster.sql:29-38`) — `.from('teams')
   .select('id, name')`, unfiltered (matches `HomeTeamRow`
   (`CoachHome.tsx:607-610`) exactly; matches `queryDashboardTeams`'s own
   unfiltered-by-archived precedent, `dashboard.ts:297-302` — don't invent a
   new `archived` filter this task didn't ask for).
2. `students.id`/`display_name`/`team_id`/`is_active`/`goal_hours_override`
   (`identity_roster.sql:59-68`) — `.from('students').select('id,
   display_name, team_id, is_active, goal_hours_override')`, unfiltered
   (matches `HomeStudentRow`, `CoachHome.tsx:612-618`, exactly).

**RLS — re-verified directly, quoted verbatim per constitution item 3.**
Already shown in full in Scope ruling #1 above (`staff_all` on `teams`/
`students`). `CoachHome` is coach/admin-only (module doc #6/#7), so
`is_staff()` is true for every viewer who reaches this loader — both queries
resolve unrestricted. (`seasons`'s own `read_all` RLS policy is not this
loader's concern under the Round 2 redesign — it already governs the
pre-existing, untouched `activeSeason` read in `loaders/seasons.ts`, which
this task doesn't touch.)

**Return shape — real for `teams`/`students`, inert literal for
`defaultGoalHours`, literal honest-empty for the rest. No `FIXTURE_*` import
anywhere in the new file.**
```
{
  seasonId,                                  // verbatim passthrough
  defaultGoalHours: 0,                       // inert literal, unread by CoachHome.tsx's render path -- see doc comment; real value now comes from activeSeason.season.defaultGoalHours, threaded as a prop directly in CoachHome.tsx (Round 2 redesign) -- mirrors loaders/students.ts:538's identical loadStudentHomeData precedent
  teams,                                     // real, from the teams query
  students,                                  // real, from the students query
  events: [],
  sessions: [],
  rsvps: [],
  attendance: [],
  teamParticipation: null,
  studentHours: [],
  seasonSetupStatus: { hasGoalsConfigured: true },  // Scope ruling #2
}
```

## The one test that must change on purpose, not by accident

`CoachHome.test.tsx:1358-1389` — describe block `<CoachHome /> T155 --
measured-reality proof for a REAL, non-placeholder season (criterion 5)`.
Its one test (`:1359-1388`) calls `renderAsUser(ADMIN_USER, {
loadDashboardData: defaultLoadDashboardData, nowFn: ... })` — **no `loadData`
override**, per its own comment at `:1362-1363` ("the untouched real default,
`defaultLoadCoachHomeData`"). Verified directly, this is the ONLY call site
in this file that omits `loadData` while reaching a `'ready'` season state —
every other of the ~30 `renderAsUser(...)` sites either passes `loadData:
fixtureLoadData`/a custom fixture-derived function explicitly, or never
reaches `CoachHomeContent` at all (`renderAsUser(null)` at `:1078`; the
`'none'`/`'loading'` season-status tests at `:1211`/`:1254`, both resolved
before `loadData` would ever be called).

**Harness-hazard scan, completed (round-1 MINOR fix — named explicitly, not
just implied by the grep methodology):** `CoachHome.test.tsx:1295` is a
zero-props `<CoachHome />` JSX mount, inside the `<CoachHome /> T155 --
fail-loud without a <SeasonProvider> ancestor` block (`:1283-1309`). This
site is safe and needs no change: it renders with no `<SeasonProvider>`
ancestor at all, so `useActiveSeason()` (`CoachHome.tsx:2120`) throws
synchronously before `loadData` is ever invoked — the new module-level
singleton export (`loadCoachHomeData`) is never called, and does not
eagerly call `getSupabaseClient()` at import time (only when actually
invoked), so its mere existence in the import graph changes nothing about
this test's behavior. Confirm this yourself by re-grepping `renderAsUser(`
and `<CoachHome`/`<CoachHome />` before relying on it — do not assume the
site count from this packet is still exactly right by the time you read it.

Once you swap `CoachHome.tsx:2114`'s default parameter, the T155
"measured-reality proof" test's own default (`CoachHome`'s real parameter
default) becomes your new, real, `getSupabaseClient()`-backed
`loadCoachHomeData` — which throws `SupabaseNotConfiguredError` in this
unconfigured jsdom test environment (same mechanism T183's packet documented
for `StudentHome.test.tsx`). Left unedited, this test would flip to the
`'Couldn't load Home'` DES-12 error banner and fail outright (a much louder
failure than T183's case, since here `loadState` — not just one field —
gates the entire primary content block).

**This test's own purpose was always to document what the shipped production
default does, field-by-field — exactly the class of test T183 established
"must change on purpose."** Fix it, don't just restore it to green:

1. Give it its own `loadData` override via `makeLoadCoachHomeData(() =>
   stubClient)` (your new file's exported factory), with a stub Supabase
   client returning controlled, fabricated `teams`/`students` data — mirror
   `students.test.ts`'s `makeRecordingClient` helper style (a minimal
   `.from(table)` dispatcher that throws on any unexpected table name), not
   a `vi.mock` (this test lives in the same file as ~30 others that must
   stay on `fixtureLoadData`/`defaultLoadCoachHomeData`, so a module-level
   mock would be too broad). Under the Round 2 redesign your stub client
   only needs to handle `.from('teams')` and `.from('students')` — no
   `.from('seasons')` handler is needed (there is no season query to stub).
2. **`defaultGoalHours` no longer comes from the stub client at all** (Round
   2 redesign). To prove `activeSeason.season.defaultGoalHours` reaches the
   DOM, pass a THIRD argument to `renderAsUser` — `loadActiveSeason` — that
   resolves a season derived from `FIXTURE_ACTIVE_SEASON` with a distinctive
   `defaultGoalHours` override (e.g. `{ ...FIXTURE_ACTIVE_SEASON,
   defaultGoalHours: 45 }`; `renderAsUser`'s third parameter already exists
   for exactly this, `:131-134` — confirm the current signature yourself,
   it may have drifted).
3. **RETAIN the existing `loadDashboardData: defaultLoadDashboardData` pin**
   (currently `:1364`) in your rewritten `renderAsUser` call(s) — do not
   drop it while restructuring the call. Without it, `CoachHome`'s own real
   Supabase-backed `loadDashboardData` default rejects in this unconfigured
   jsdom environment, hiding the entire `{dashboardData && (...)}`-gated
   grid that the `Default goal 45h` assertion (below) lives inside — the
   exact BLOCKER-class failure this round's gate proved by instrumented
   test run. A worker could plausibly rewrite the whole `renderAsUser` call
   and drop this pin by accident; it must survive the rewrite.
4. Split it into TWO tests (the original tested one condition; the fix now
   needs two to avoid a vacuous absence on the "Season setup" surface — see
   below):
   - **Test A** (non-empty teams): stub client returns one team + one active
     student whose `team_id` is a real, non-placeholder value (i.e., NOT
     `PLACEHOLDER_CURRENT_TEAM_ID`), with a distinctive `goal_hours_override`
     (e.g. `18`, unused directly by any assertion but exercising the field).
     `loadActiveSeason` (per point 2) resolves `defaultGoalHours: 45`. Assert:
     - The four already-fixed widgets stay honestly empty (keep the
       existing six `expect` calls from the old test, lines 1371-1376 —
       covering four widgets total; unaffected by this change, still
       exercised the same way).
     - `'Default goal 45h'` appears (replaces the old `'Default goal 10h'`
       assertion at `:1382`) — proves `activeSeason.season.defaultGoalHours`
       reaches the DOM via the new prop-threading (Round 2 redesign),
       independent of the stub client.
     - `'0 / 1 hrs'` appears, NOT `'0 / 38 hrs'` (replaces `:1381`) — proves
       the roster-sum now honestly floors to zero because no real student's
       `team_id` matches the still-placeholder `teamId` (Scope ruling #1's
       "floors to honest zero" consequence, measured, not just claimed).
       This assertion is driven entirely by `teams`/`students` (the stub
       client), not by `defaultGoalHours`'s source, so it is unaffected by
       the Round 2 redesign.
     - `'Season setup'` does NOT appear (replaces `:1387`'s
       `.toContain('Season setup')`) — proves `hasGoalsConfigured: true` +
       non-empty teams correctly clears the admin card.
   - **Test B** (empty teams, a sibling, new): same stub shape but
     `teams: []`, same `loadDashboardData: defaultLoadDashboardData` pin
     (point 3). `loadActiveSeason` can reuse the file's default
     `FIXTURE_ACTIVE_SEASON` (no need for a custom override — this test's
     job is the Season-setup positive control, not another `defaultGoalHours`
     proof). Assert `'Season setup'` DOES appear — a positive control
     proving the card still correctly fires for the one condition that can
     still trigger it (genuinely zero teams), so Test A's negative assertion
     isn't vacuously true for the wrong reason (constitution's recurring
     anti-vacuous-absence requirement — pair every meaningful absence
     assertion with a positive control proving the mechanism still works).
5. Correct the stale comment at `:1362-1363` ("No `loadData` override -- the
   untouched real default") — it is no longer accurate once you DI a stub;
   explain why (the real default now hits an unconfigured Supabase client in
   this test environment).

## Proving the wiring for real in `DashboardPage.test.tsx` (anti-vacuous-
absence requirement, same class as T183's own requirement 7b; also the
site of round 1's BLOCKER)

`DashboardPage.test.tsx`'s `renders CoachHome for role "coach"`/`"admin"`
tests (`:213-251`) render `<DashboardPage />` → `<CoachHome />` with **zero
props**, through the real production dispatcher — this is the ONLY place in
the repo that would fail if `CoachHome.tsx:2114`'s default parameter never
actually got swapped (every `CoachHome.test.tsx` render either passes
`loadData` explicitly or is the one test you're rewriting above). Currently
neither test asserts anything that would discriminate a real swap from a
no-op — `'Team participation'`/`'Season setup'` render identically either
way.

**Two `vi.mock` blocks are required (the second one is the round-1 BLOCKER
fix):**

1. `vi.mock('../../lib/supabase/loaders/coachHome', ...)` (mirroring the
   file's existing `loaders/meetings`/`loaders/students` pattern, `:52-86`),
   returning your new loader's production export with:
   ```
   {
     seasonId,
     defaultGoalHours: 0,                              // inert -- see Round 2 redesign; never asserted against
     teams: [],
     students: [],
     seasonSetupStatus: { hasGoalsConfigured: true },
     events: [], sessions: [], rsvps: [], attendance: [], teamParticipation: null, studentHours: [],
   }
   ```
   `teams: []` is deliberate (not "distinctly non-empty") — it keeps the
   admin test's existing `.toContain('Season setup')` assertion's truth
   value unchanged (see point 3 below for how you strengthen it into a real
   proof instead of a vacuous one).
2. `vi.mock('../../lib/supabase/loaders/dashboard', ...)` — **new, required
   to fix round 1's BLOCKER.** `CoachHome.tsx:2477`'s `Default goal
   {defaultGoalHours}h` text sits inside the `{dashboardData && (...)}` gate
   (`:2466`), which only opens once `loadDashboardDataProp(seasonId)`
   resolves (`dashboardData = dashboardState.status === 'success' ?
   dashboardState.data : null`, `:2295-2296`). Without this mock, the real,
   unconfigured `getSupabaseClient()`-backed `loadDashboardData` default
   rejects in jsdom and this entire grid — including the `Default goal Xh`
   text — never renders, so no assertion inside it could ever pass (verified
   by the gate via an instrumented test run in round 1). The mock only needs
   to make the gate open; its field VALUES don't need to be realistic
   (`DashboardData`, `loaders/dashboard.ts:600-611`, is fully
   nullable/array-typed):
   ```
   {
     seasonId,
     rosterStats: null,
     attendanceRate: null,
     sessionDays: null,
     upcomingCommittedHours: null,
     dayOfWeekSessions: [],
     teamHours: [],
     topEvents: [],
     goalProjection: [],
     activityFeedSource: { events: [], sessions: [], rsvps: [], attendance: [], students: [] },
   }
   ```

**New assertions, both tests:**

3. In BOTH the "coach" and "admin" tests, add:
   `expect(container.textContent).toContain('Default goal 100h')` — `100` is
   `FIXTURE_ACTIVE_SEASON.defaultGoalHours` (`:158`, already in this file,
   unchanged by this task). This proves two things jointly: (a) the
   `loaders/dashboard` mock actually opened the `{dashboardData && (...)}`
   gate (BLOCKER fix), and (b) `CoachHome.tsx`'s render now reads the new
   `defaultGoalHours` PROP (sourced from `activeSeason.season`), not
   `data.defaultGoalHours` — if the render-source edit (Allowed Files edit 7)
   were missing, this would show `'Default goal 0h'` instead (your new
   loader's inert literal), not `100h`; if it were missing AND `loadData`
   were never swapped at all, it would show `'Default goal 10h'`
   (`FIXTURE_DEFAULT_GOAL_HOURS`, the pre-existing in-file fixture) — three
   distinguishable outcomes, only one of which is correct.
   This assertion alone does **not** prove `loaders/coachHome`'s wiring
   (`teams`/`students`/`seasonSetupStatus`) — it's entirely independent of
   that mock, since `defaultGoalHours` no longer flows through it. Point 4
   covers that separately.
4. In the admin test ONLY (`renders CoachHome for role "admin"`), add:
   `expect(container.textContent).toContain('The active season is missing
   teams.')` (the exact string `seasonSetupDescription` produces,
   `CoachHome.tsx:1453-1458,2734`, when `teams.length === 0` and
   `hasGoalsConfigured` is true). This is the real, non-vacuous proof of
   `loaders/coachHome`'s wiring: pre-fix (or if `loadData` were never
   swapped), `defaultLoadCoachHomeData`'s in-file `FIXTURE_TEAMS` is
   non-empty (`:715-718`, two teams) and `FIXTURE_SEASON_SETUP_STATUS.
   hasGoalsConfigured` is `false` (`:958`), so the description would read
   *"...missing season goals."* instead — a genuinely different, assertable
   string. The existing `.toContain('Season setup')` assertion (unchanged,
   still true either way) stays as-is; this new assertion is what turns it
   from a vacuous check into a real one. (There is no admin-only-card
   equivalent for the "coach" role test — `isSeasonMissingSetup`'s admin
   gate, `:2285`, means `loaders/coachHome`'s wiring for the coach role is
   covered by the SAME single code path at `CoachHome.tsx:2114` that the
   admin test already proves; the default parameter is not role-conditional,
   so proving it once is sufficient — the coach test's own job is proving
   correct role→component DISPATCH, which its pre-existing assertions
   already do.)
5. Correct the admin test's comment at `:242-245` ("Fixture season-setup
   status is incomplete... so an admin viewer sees the admin-only 'Season
   setup' card") — it's now inaccurate (there is no more fixture
   `seasonSetupStatus` in play for this render; the mock always reports
   `hasGoalsConfigured: true`); the card shows because your mock's
   `teams: []` makes `isSeasonMissingSetup` true via the teams branch, not
   the goals branch — say so, and point to the new `'...missing teams.'`
   assertion (point 4) as the proof.

## Acceptance Criteria
1. New additive exports in `loaders/coachHome.ts` (suggested names:
   `makeLoadCoachHomeData`, `loadCoachHomeData`) follow the `dashboard.ts`
   shape exactly (injectable `getClient`, `createLoader`-wrapped query
   functions, `Promise.all` combination, a single production singleton
   export), with exactly TWO queries (`teams`, `students` — no `seasons`
   query, per the Round 2 redesign). Zero import of any VALUE from
   `CoachHome.tsx` — type-only imports only, if any are needed at all
   (diff-provable: no runtime circularity).
2. The new loader's `Promise<CoachHomeData>` return matches the "Return
   shape" section above exactly: real `teams`/`students`, the literal
   `defaultGoalHours: 0` (documented per Round 2 redesign, citing
   `loaders/students.ts:538`), `seasonSetupStatus: { hasGoalsConfigured:
   true }` (documented per Scope ruling #2, including the disclosed
   `default_goal_hours = 0` edge case), and literal `[]`/`null` for
   `events`/`sessions`/`rsvps`/`attendance`/`teamParticipation`/
   `studentHours`. No `FIXTURE_*` symbol referenced anywhere in the new
   file.
3. `CoachHomeContentProps`/`CoachHomeContent` correctly thread the new
   `defaultGoalHours: number` prop from `activeSeason.season.defaultGoalHours`
   (the `'ready'`-case call site, Allowed Files edit 5) through to both
   consumption sites (edits 6/7, `:2235`/`:2477`) — no read of `data.
   defaultGoalHours`/`successData.defaultGoalHours` remains anywhere in
   `CoachHome.tsx`'s render path.
4. `CoachHome.tsx` diff is exactly the eight regions enumerated in Allowed
   Files (import; default-parameter swap, line 2116's `teamId` default
   UNCHANGED — diff-confirm this specifically; `CoachHomeContentProps`;
   `CoachHomeContent`'s signature; the `'ready'`-case call site; the two
   consumption-site edits; the module-doc correction plus new section 15).
   `defaultLoadCoachHomeData` (lines 1465-1479), `isSeasonMissingSetup`
   (`:1446-1451`), the FUNCTION DEFINITIONS of `sumGoalHours`/
   `sumConfirmedHours` (`:979-1010`), and `CoachHomeData` (`:688-700`,
   including its still-declared `defaultGoalHours` field) are byte-identical
   before/after — diff them directly to confirm.
5. `CoachHome.test.tsx`'s rewritten describe block (Test A + Test B, per
   above) passes, using a DI'd stub client for `teams`/`students` (not a
   module-level `vi.mock`) and a custom third `loadActiveSeason` argument for
   Test A's `defaultGoalHours` proof. The `loadDashboardData:
   defaultLoadDashboardData` pin is retained in both tests. Every other test
   in this file is byte-unchanged AND passes unmodified — confirm by running
   the full file, not by inspection alone.
6. `DashboardPage.test.tsx`'s two new `vi.mock` blocks (`loaders/coachHome`
   AND `loaders/dashboard`) and the new assertions (per above — `'Default
   goal 100h'` in both tests, `'The active season is missing teams.'` in the
   admin test) pass; the admin test's comment is corrected; no other line in
   this file changes.
7. New unit tests in `coachHome.test.ts`, mirroring `dashboard.ts`'s own
   sibling query functions' test coverage style (or `students.test.ts`'s
   `makeRecordingClient`-style `.from(table)` dispatcher if `dashboard.test.
   ts` doesn't exist — check first): spy-verified `.select(...)` chains for
   both queries (`teams`, `students`), camelCase mapping tests for each, the
   literal `defaultGoalHours: 0` value, the `hasGoalsConfigured: true`
   literal, the honest-empty literals for the remaining six fields, and at
   least one full `makeLoadCoachHomeData` integration test proving the
   composed `CoachHomeData` shape end-to-end against a stub client. No
   row-not-found test is needed (no season query exists to have a missing
   row).
8. Full repo test suite: report before/after counts. Measure your own
   baseline directly at the start (`npm test` or equivalent) — do not trust
   any number cited in this packet or elsewhere in `docs/swarm/`, they will
   have drifted on this branch since this packet was written. Zero
   newly-failing tests anywhere outside the two describe blocks you
   deliberately edited (criteria 5/6). Zero `.skip`/`.only`/`.todo`
   introduced.
9. `tsc`, eslint, and prettier all clean (or unchanged from your measured
   baseline, with any delta explained).
10. Zero diff on every Forbidden file. Zero diff outside the Allowed list —
    confirm the `CoachHome.tsx`/`CoachHome.test.tsx`/`DashboardPage.test.tsx`
    diffs are each scoped exactly as described above (`CoachHome.tsx`: the
    eight named regions; `DashboardPage.test.tsx`: the two `vi.mock` blocks
    plus the named assertion/comment edits); diff each file directly and
    confirm nothing else moved.

## Relevant Constitution Excerpt
- Non-Negotiables: "Existing tests must pass unless the boss explicitly
  approves a test update." This packet pre-authorizes content updates to a
  bounded, named set: `CoachHome.test.tsx`'s lines 1358-1389 (split into
  Test A/B, criterion 5) and `DashboardPage.test.tsx`'s two named regions
  (criterion 6). All other tests, including every other `CoachHome.test.tsx`
  render, must remain green AND unedited.
- Item 3: RLS/metric SQL come only from real migrations, copied verbatim; no
  re-deriving. The `staff_all` policies are quoted verbatim in Scope ruling
  #1 and the Context section above — cite them exactly as shown, not
  paraphrased. This task adds no metric math (no `%`/division on any new
  query — the `teams`/`students` reads are verbatim passthroughs; the
  `defaultGoalHours` prop is a verbatim passthrough of the already-fetched
  `activeSeason.season.defaultGoalHours`).
- Item 6: "No PII... in... test fixtures — fixtures use fabricated names."
  Use fabricated team/student names in every new stub/mock.
- Item 18: sonnet tier is correct — this reads two existing, RLS-covered
  tables the same shape `loaders/dashboard.ts`'s own `queryDashboardTeams`/
  `queryDashboardStudents` already do, plus a prop-threading refactor inside
  `CoachHome.tsx` of a kind (reading an already-fetched value from a
  different place) T176 already shipped; it touches no migration, no RLS
  authoring, no security-definer SQL, and no auth/session/role logic
  (`AuthUser`/`guards.tsx` are read-only references here, never edited). The
  Round 2 redesign widens the `CoachHome.tsx` diff footprint but not its
  risk class — still no migration, no RLS, no auth logic.
- Item 19c: "Verify your own citations before submitting." Every line number
  in this packet was re-read against this worktree's current HEAD, not
  inherited from the ledger row or from round 1's checker findings blindly
  (both were independently re-verified during this round-2 revision,
  including one instrumented consequence check: confirming no other
  `CoachHome.test.tsx` assertion depends on the literal text `Default goal
  10h`/`0 / 38 hrs` before relying on that as a safety claim for the Round 2
  redesign) — do the same before you rely on any of them; they may drift
  further before you start.
- Item 20: any deliberate narrowing beyond this packet's own scope decisions
  must produce a follow-up ledger row, not just a code comment. The
  `teamId`/team-linkage question (Scope ruling #1) and the
  `events`/`sessions`/`rsvps`/`attendance`/`teamParticipation`/`studentHours`
  real-query gap are both already being filed by the orchestrator as T198
  (see below) — **you do not need to file anything about either yourself**,
  beyond the module-doc pointer already instructed above.
- Item 25 (proportionality): small-team app; do not add defensive layers,
  retry logic, or caching beyond what's asked. Do not invent an `archived`
  filter on the `teams` query that neither the existing precedent
  (`dashboard.ts`) nor this packet asks for. Do not add a season query back
  in "for symmetry" with the teams/students queries — the Round 2 redesign
  deliberately removes it because it would be dead code (see "Round 2
  redesign" above).

## Disclosure note (decided by the orchestrator, not yours to resolve)
This task deliberately does not resolve `teamId`, and deliberately does not
build real `events`/`sessions`/`rsvps`/`attendance`/`teamParticipation`/
`studentHours` queries even though the ledger row called the latter two
"mechanical." Both gaps are being filed as a single follow-up row, **T198**
(next available ID — verified against the current ledger max, T197), with
proposed content along these lines (final wording is the orchestrator's, not
yours to draft — **the orchestrator's own already-filed T198 ledger row
needs the same PRD-citation correction applied below; corrected wording
provided separately in this round's reply, since `task-ledger.md` is
Forbidden to this packet's author**):

> **T198 — Product decision + follow-up: does `CoachHome` need a real
> per-coach "team" concept, or should its remaining team-scoped widgets
> become season-wide like T124's already-shipped ones?** `AuthUser` carries
> no team linkage, no table anywhere links a staff profile to a team, and
> every `staff_all` RLS policy grants program-wide (not team-scoped) access
> — confirmed directly, not inherited (T173 investigation). This is most
> likely a product-scope question for the human owner, not a pure schema
> gap: PRD HOME-01 names a "team goal" (`:275`) but the data model has no
> representation of which team a given coach belongs to, so there's no way
> to compute that scoping per-viewer — the gap is in the schema, not in the
> PRD's wording. D-2 ("we are just a team... P3+GG=VOLT") and
> `CoachHome.tsx`'s own module doc #13(a) already resolved a related
> question toward "season-wide" for T124's five newer widgets. Resolve the
> question first; only then decide whether it needs a schema/auth change
> (opus tier, its own migration task) or a widget-semantics change (no
> migration). Bundle in: real `events`/`sessions`/`rsvps`/`attendance`/
> `teamParticipation`/`studentHours` queries for `CoachHomeData` (currently
> literal honest-empty, T173) — building these before the team-scoping
> question resolves risks building the wrong shape twice.

## Most Recent Failure
Round 1 `checker-premise` (light/narrow scope, as recommended): REVISE — 1
BLOCKER (the prescribed `DashboardPage.test.tsx` assertion couldn't pass,
proven by an instrumented test run: `Default goal Xh` sits inside a gate
that never opens without a `loaders/dashboard` mock this file didn't have),
1 MAJOR (a cheaper, T176-precedented design — thread `defaultGoalHours` from
the already-fetched `activeSeason.season` instead of a third new query — was
available and not considered), 4 MINOR (a harness-hazard site not named
explicitly; an overstated PRD claim; imprecise `hasGoalsConfigured` wording;
several citation-drift errors), 1 NIT (an existing test pin that must
survive a rewrite, stated only implicitly). All addressed in this revision —
see "Round 2 revision notes" at the top. Per constitution item 19a, this is
the second and final `checker-premise` round for this packet.

## Required Worker Output
- Files changed (exact list).
- Summary of the new loader's shape (two queries, not three), your
  `defaultGoalHours: 0` inert-literal decision, the `CoachHomeContentProps`/
  `CoachHomeContent` prop-threading change, and your own independent read of
  the `hasGoalsConfigured: true` reasoning (agree, or flag a disagreement
  explicitly).
- Confirmation you ran the full suite at least twice: (1) your own measured
  baseline before any change; (2) final, after all edits — report exact
  counts both times, not a number copied from this packet or from
  `docs/swarm/`.
- `tsc`/eslint/prettier output, compared against your own measured baseline.
- Confirmation `defaultLoadCoachHomeData`, `isSeasonMissingSetup`,
  `sumGoalHours`/`sumConfirmedHours` (function definitions), and
  `CoachHomeData` (the interface) are byte-identical before/after (a `git
  diff` excerpt scoped to those lines, or equivalent).
- Confirmation `CoachHome.tsx:2116` (`teamId` default) is byte-unchanged.
- Confirmation the `CoachHome.test.tsx`/`DashboardPage.test.tsx` diffs each
  touch only their named regions (a `git diff` of each whole file, or
  equivalent).
- Known risks, and whether a dispute is needed (e.g. if you concluded Scope
  ruling #1 or #2 is wrong, if you disagree with the Round 2
  `defaultGoalHours` prop-threading redesign, or you disagree with leaving
  `events`/`sessions`/`rsvps`/`attendance`/`teamParticipation`/`studentHours`
  as literal honest-empty rather than real queries).
