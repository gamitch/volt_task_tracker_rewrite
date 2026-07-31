# Worker Packet: T173

**Status: fresh packet, not yet through `checker-premise`.** Foreman
recommendation (justification below the fold): **sonnet** worker tier
(constitution item 18 — no migration, no RLS/security-definer authoring, no
metric-SQL view, no auth/session/role logic touched), **checker-reviewer
(opus)** as checker (live-route, user-visible numeric surfaces — same tier
T183/T184 used), and a **light/narrow `checker-premise` round, not full**
(item 19b) — this rolls out an already-proven pattern (`createLoader` +
`getClient` DI reading plain tables, identical shape to
`loaders/dashboard.ts`'s own `queryDashboardTeams`/`queryDashboardStudents`
and `loaders/students.ts`'s `queryStudentGoalProjectionById`), but it also
contains one genuine, non-mechanical design judgment (the `hasGoalsConfigured`
resolution below) and touches two live on-screen numeric surfaces, so a full
skip is not warranted either. Suggested narrow-gate scope: re-verify this
packet's own line-number/RLS citations against live `main`, sanity-check the
`hasGoalsConfigured: true` reasoning for a missed alternative, and confirm the
test-harness hazard count (exactly one `CoachHome.test.tsx` site, two
`DashboardPage.test.tsx` sites) is complete.

## Task ID
T173

## Objective
Fix the three fabricated on-screen surfaces named in the T173 ledger row that
survived T155: `Hours vs. team goal`'s denominator (`0 / 38 hrs`), `Avg hours
/ active student`'s `Default goal 10h` secondary, and the admin `Season
setup` card's permanent false-positive. All three trace to two fields inside
`CoachHomeData` — `defaultGoalHours` and `seasonSetupStatus` — that stayed on
fixture data after T155's outer/inner split. Add a new, real Supabase-backed
loader that sources both fields for real (plus `teams`/`students`, needed as
inputs to the first two surfaces), wire it as `CoachHome`'s new production
`loadData` default, and leave everything else in `CoachHomeData`
(`events`/`sessions`/`rsvps`/`attendance`/`teamParticipation`/`studentHours`)
as literal honest-empty values — no new queries for those, no
`FIXTURE_*` reference. `defaultLoadCoachHomeData` itself is untouched and
stays exported for tests.

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
- PRD `HOME-01` (`docs/swarm/VOLT_Portal_PRD.md:274`) reads: *"KPI `Card`s:
  Team participation % (MET-02) · Total outreach hours vs team goal with
  `ProgressBar` · Attendance rate of last completed meeting · Events in next
  7 days"*, prefaced only by *"scoped to selected season"* — no "scoped to
  the viewer's team" language anywhere in the requirement.
- `CoachHome.tsx`'s own module doc #13(a) (lines 372-389) already reached the
  same conclusion for the newer T124 widgets, citing D-2 directly: those five
  widgets are deliberately season-wide, "never filtered by this file's
  existing `PLACEHOLDER_CURRENT_TEAM_ID`," because the binding capability-map
  reference and D-2's "P3 + GG = VOLT" framing show one combined program, not
  per-team views.

Taken together: this product has no data-model concept of "a coach's team,"
and every signal available (RLS, PRD wording, an already-approved precedent
in this exact file) points toward the *pre-existing* KPI grid's team-scoping
being a stale, pre-D-2 (T053-era) design decision rather than a real,
unmet requirement — not a genuine schema gap waiting on a migration. Deciding
between "make the remaining team-scoped widgads season-wide like T124's" and
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
  place a season is created, and its own validation
  (`isSeasonFormValid`, `:471-478`, checks `defaultGoalHours !== null &&
  defaultGoalHours >= 0`; `buildCreateSeasonPayload`, `:481-491`, returns
  `null` — blocking the create action — unless `isSeasonFormValid` passes)
  requires a non-null `defaultGoalHours` before the create action is
  enabled — so a
  human has explicitly set this value, even if left at the form's own
  100-hour pre-fill, before any season can exist in the database at all.
- `CoachHome`'s outer wrapper (`:2134-2146`) already handles "no season
  exists yet" as its own distinct `'none'` state (`activeSeason.status`),
  before `CoachHomeContent` (and this field) is ever reached. So by
  construction, every season this field is evaluated against already has a
  real, human-set `default_goal_hours`.
- Net effect: for any season that can reach this code path, "has this
  season's goal hours been configured" is always true — not an approximation
  or a guess, but a direct logical consequence of the NOT NULL constraint
  plus the mandatory create-time form field. **Resolve `hasGoalsConfigured`
  to the literal `true`, with a doc comment citing this reasoning**, rather
  than inventing a proxy or leaving it hardcoded `false`.
- Practical effect on `isSeasonMissingSetup` (`:1446-1451`,
  `teams.length === 0 || !status.hasGoalsConfigured`): the admin "Season
  setup" card will now correctly show only when `teams.length === 0`, and
  correctly stop permanently showing otherwise — closing the exact defect
  named in the ledger row ("permanently true").
- **If you disagree with this reasoning after reading `SeasonSettings.tsx`
  and the migration yourself, say so explicitly in your output rather than
  silently picking a different resolution** — this is the one genuinely
  non-mechanical call in this packet, flagged for premise-gate/checker
  scrutiny, not asserted as beyond question.

**Not in scope, disclosed, not silently dropped:** `events`, `sessions`,
`rsvps`, `attendance`, `teamParticipation`, `studentHours` stay literal
honest-empty values in the new loader (`[]`/`null`), not new Supabase
queries — even though the ledger row calls a real `teamParticipation`/
`studentHours` loader "mechanical... not new SQL design." For any real
season today, `defaultLoadCoachHomeData`'s existing season-filtered fixture
logic (`:1471`, `:1475-1476`) *already* evaluates to the same empty result
(no real season will ever equal `PLACEHOLDER_SEASON_ID`), so this is a
zero-regression, zero-behavior-change omission for now — genuinely real
queries for those four/two fields are additional, separable work, not
required to close the three defects this task targets. Filed as part of
follow-up T198 below (bundled with the wider "these widgets should probably
become season-wide" question, since building real per-team queries for them
would be wasted work if that question resolves toward season-wide instead).

## Allowed Files
- `src/lib/supabase/loaders/coachHome.ts` — new file, additive only.
- `src/lib/supabase/loaders/coachHome.test.ts` — new file.
- `src/pages/home/CoachHome.tsx` — exactly THREE edits, nothing else:
  1. One new import statement after the existing `loaders/dashboard` import
     block (after line 596): `import { loadCoachHomeData } from
     '../../lib/supabase/loaders/coachHome';` (or your own chosen export
     name — keep it consistent with your new file).
  2. The default-parameter value at line 2114 (`loadData =
     defaultLoadCoachHomeData` → `loadData = loadCoachHomeData`). Line 2116
     (`teamId = PLACEHOLDER_CURRENT_TEAM_ID`) is explicitly NOT touched (see
     Scope ruling #1).
  3. Module doc lines 545-555 (the stale closing paragraph of section 14):
     replace with a short pointer forward (e.g. "fixed by T173 — see section
     15 below"), and add a new section 15 immediately after (before the
     closing `*/` at line 556) documenting: `defaultGoalHours`/`teams`/
     `students`/`seasonSetupStatus` now real, sourced from
     `loaders/coachHome.ts`; `teamId` still a disclosed placeholder (Scope
     ruling #1, with the "floors to honest zero" consequence stated); the
     `hasGoalsConfigured: true` reasoning (Scope ruling #2), briefly, with a
     pointer to the fuller reasoning in the new loader file's own doc
     comment; `events`/`sessions`/`rsvps`/`attendance`/`teamParticipation`/
     `studentHours` still literal honest-empty (not real queries), filed as
     T198.
  `defaultLoadCoachHomeData` (lines 1465-1479), `isSeasonMissingSetup`
  (`:1446-1451`), `sumGoalHours`/`sumConfirmedHours` (`:979-1010`), and every
  other pure function/render line are byte-unchanged — diff the file and
  confirm nothing else moved.
- `src/pages/home/CoachHome.test.tsx` — ONLY the describe block at (current)
  lines 1358-1388 (the "T155 -- measured-reality proof" block) plus one new
  import line for whatever you export from `coachHome.ts` (e.g.
  `makeLoadCoachHomeData`). Do not touch any other test in this file — all
  ~30 other `renderAsUser(...)` call sites explicitly pass `loadData:
  fixtureLoadData` (which calls `defaultLoadCoachHomeData` directly,
  independent of `CoachHome`'s own default parameter) and are unaffected;
  confirm this yourself before you rely on it (see "The one test that must
  change on purpose" below for the full verification).
- `src/pages/home/DashboardPage.test.tsx` — scoped to exactly TWO regions:
  1. A new `vi.mock('../../lib/supabase/loaders/coachHome', ...)` block,
     added alongside the file's existing `loaders/meetings`/`loaders/
     students`/`loaders/parentHome` mocks (lines 52-122), returning a
     fabricated `CoachHomeData`-shaped payload from your new loader's
     production export.
  2. The `renders CoachHome for role "coach"` (lines 213-236) and `renders
     CoachHome for role "admin"` (lines 238-251) tests: each needs exactly
     one new positive assertion proving the mock's distinct, fabricated
     `defaultGoalHours` value reaches the DOM (see "Proving the wiring for
     real" below) — the file's existing assertions currently only prove
     `CoachHome` mounted at all, not that its `loadData` default actually
     changed. The admin test's existing `Season setup` comment (lines
     242-245) needs a one-line correction (see below); its assertion itself
     (`.toContain('Season setup')`) does not need to change if your mock
     returns `teams: []` (see "Proving the wiring for real").
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
at `:688-700`. `defaultGoalHours` is consumed at `:2235` (`sumGoalHours`,
feeds the `Hours vs. team goal` denominator) and `:2477` (`Default goal
{data.defaultGoalHours}h`, the `Avg hours / active student` secondary — this
surface is otherwise fully real, `avgHoursPerActiveStudent` comes from T124's
`v_season_roster_stats`). `seasonSetupStatus` is consumed at `:2285`
(`isSeasonMissingSetup(data.teams, data.seasonSetupStatus)`, gates the admin
"Season setup" card). `teams`/`students` are consumed by `sumGoalHours`/
`sumConfirmedHours` (`:2235,2238`) and `isSeasonMissingSetup` (`:2285`,
`teams` only).

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

**The exact pattern to mirror.** `loaders/dashboard.ts:198-302` (read-only
reference, do not edit): `queryRosterStats`/`queryDashboardTeams`/
`queryDashboardStudents` are the closest precedents — plain
`.select(...).eq(...)` or `.select(...)` query functions returning
`LoaderQueryResult<TRow>`, composed via `createLoader<TArgs, TRow>(queryFn,
getClient)`, combined in a `Promise.all` inside a `makeLoadXyz(getClient =
getSupabaseClient)` factory, exported as a named singleton
(`export const loadDashboardData: LoadDashboardDataFn =
makeLoadDashboardData();`, `:743`). Build your new file the same shape.

**The three real queries you need, verbatim columns:**
1. `seasons.default_goal_hours` (`identity_roster.sql:47`, `numeric not
   null`) — `.from('seasons').select('default_goal_hours').eq('id',
   seasonId).maybeSingle()`. Row-not-found: throw (matches T177/T183's
   fail-loud precedent — `seasonId` is always a real, already-resolved
   active season id by the time this loader runs, so a missing row is a
   genuine anomaly, not an expected empty state). Disclose your choice in a
   doc comment and cover it with a test either way.
2. `teams.id`/`teams.name` (`identity_roster.sql:29-38`) — `.from('teams')
   .select('id, name')`, unfiltered (matches `HomeTeamRow`
   (`CoachHome.tsx:607-610`) exactly; matches `queryDashboardTeams`'s own
   unfiltered-by-archived precedent, `dashboard.ts:297-302` — don't invent a
   new `archived` filter this task didn't ask for).
3. `students.id`/`display_name`/`team_id`/`is_active`/`goal_hours_override`
   (`identity_roster.sql:59-68`) — `.from('students').select('id,
   display_name, team_id, is_active, goal_hours_override')`, unfiltered
   (matches `HomeStudentRow`, `CoachHome.tsx:612-618`, exactly).

**RLS — re-verified directly, quoted verbatim per constitution item 3.**
Already shown in full in Scope ruling #1 above (`staff_all` on `teams`/
`students`, plus `read_all` on `teams`/`seasons`). `CoachHome` is
coach/admin-only (module doc #6/#7), so `is_staff()` is true for every
viewer who reaches this loader — all three queries resolve unrestricted.

**Return shape — real for four fields, literal honest-empty for the rest.
No `FIXTURE_*` import anywhere in the new file.**
```
{
  seasonId,                                  // verbatim passthrough
  defaultGoalHours,                          // real, from the seasons query
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

`CoachHome.test.tsx:1358-1388` — describe block `<CoachHome /> T155 --
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
before `loadData` would ever be called). Confirm this yourself by grepping
`renderAsUser(` before relying on it — do not assume the count from this
packet is still exactly right by the time you read it.

Once you swap `CoachHome.tsx:2114`'s default parameter, this test's own
default (`CoachHome`'s real parameter default) becomes your new, real,
`getSupabaseClient()`-backed `loadCoachHomeData` — which throws
`SupabaseNotConfiguredError` in this unconfigured jsdom test environment
(same mechanism T183's packet documented for `StudentHome.test.tsx`). Left
unedited, this test would flip to the `'Couldn't load Home'` DES-12 error
banner and fail outright (a much louder failure than T183's case, since here
`loadState` — not just one field — gates the entire primary content block).

**This test's own purpose was always to document what the shipped production
default does, field-by-field — exactly the class of test T183 established
"must change on purpose."** Fix it, don't just restore it to green:

1. Give it its own `loadData` override via `makeLoadCoachHomeData(() =>
   stubClient)` (your new file's exported factory), with a stub Supabase
   client returning controlled, fabricated data — mirror `students.test.ts`'s
   `makeRecordingClient` helper style (a minimal `.from(table)` dispatcher),
   not a `vi.mock` (this test lives in the same file as ~30 others that must
   stay on `fixtureLoadData`/`defaultLoadCoachHomeData`, so a module-level
   mock would be too broad).
2. Split it into TWO tests (the original tested one condition; the fix now
   needs two to avoid a vacuous absence on the "Season setup" surface — see
   below):
   - **Test A** (non-empty teams): stub `default_goal_hours` to a
     distinctive, non-`10`/non-`100`/non-`38` value (e.g. `45`) and at least
     one team + one student whose `team_id` is a real, non-placeholder value
     (i.e., NOT `PLACEHOLDER_CURRENT_TEAM_ID`). Assert:
     - The four already-fixed widgets stay honestly empty (keep the
       existing four assertions from the old test, lines 1371-1376 —
       unaffected by this change, still exercised the same way).
     - `'Default goal 45h'` appears (replaces the old `'Default goal 10h'`
       assertion at `:1382`) — proves the season query's real value reaches
       the DOM.
     - `'0 / 1 hrs'` appears, NOT `'0 / 38 hrs'` (replaces `:1381`) — proves
       the roster-sum now honestly floors to zero because no real student's
       `team_id` matches the still-placeholder `teamId` (Scope ruling #1's
       "floors to honest zero" consequence, measured, not just claimed).
     - `'Season setup'` does NOT appear (replaces `:1387`'s
       `.toContain('Season setup')`) — proves `hasGoalsConfigured: true` +
       non-empty teams correctly clears the admin card.
   - **Test B** (empty teams, a sibling, new): same stub shape but
     `teams: []`. Assert `'Season setup'` DOES appear — a positive control
     proving the card still correctly fires for the one condition that can
     still trigger it (genuinely zero teams), so Test A's negative assertion
     isn't vacuously true for the wrong reason (constitution's recurring
     anti-vacuous-absence requirement — pair every meaningful absence
     assertion with a positive control proving the mechanism still works).
3. Correct the stale comment at `:1362-1363` ("No `loadData` override -- the
   untouched real default") — it is no longer accurate once you DI a stub;
   explain why (the real default now hits an unconfigured Supabase client in
   this test environment).

## Proving the wiring for real in `DashboardPage.test.tsx` (anti-vacuous-
absence requirement, same class as T183's own requirement 7b)

`DashboardPage.test.tsx`'s `renders CoachHome for role "coach"`/`"admin"`
tests (`:213-251`) render `<DashboardPage />` → `<CoachHome />` with **zero
props**, through the real production dispatcher — this is the ONLY place in
the repo that would fail if `CoachHome.tsx:2114`'s default parameter never
actually got swapped (every `CoachHome.test.tsx` render either passes
`loadData` explicitly or is the one test you're rewriting above). Currently
neither test asserts anything that would discriminate a real swap from a
no-op — `'Team participation'`/`'Season setup'` render identically either
way.

1. Add a `vi.mock('../../lib/supabase/loaders/coachHome', ...)` block
   (mirroring the file's existing `loaders/meetings`/`loaders/students`
   pattern, `:52-86`), returning your new loader's production export with a
   fabricated payload: `defaultGoalHours` a THIRD distinct value (distinct
   from Test A's `45` above and from the `10`/`100` fixture/season-row
   defaults already in play in this file — e.g. `63`), `teams: []` (keeps
   the existing `Season setup` assertion's truth value unchanged for the
   admin test — see below), `students: []`, and the same literal
   honest-empty values for the rest.
2. In BOTH the "coach" and "admin" tests, add one new assertion:
   `expect(container.textContent).toContain('Default goal 63h')` (or
   whichever value you chose) — the positive proof the production default
   actually swapped, paired with the file's own existing negative assertions
   (`.not.toContain('Hi Ada Reyes')` etc.) rather than replacing them.
3. Correct the admin test's comment at `:242-245` ("Fixture season-setup
   status is incomplete... so an admin viewer sees the admin-only 'Season
   setup' card") — it's now inaccurate (there is no more fixture
   `seasonSetupStatus`); the card shows because your mock's `teams: []`
   makes `isSeasonMissingSetup` true via the teams branch, not the goals
   branch. The assertion itself (`.toContain('Season setup')`) does not need
   to change.

## Acceptance Criteria
1. New additive exports in `loaders/coachHome.ts` (suggested names:
   `makeLoadCoachHomeData`, `loadCoachHomeData`) follow the `dashboard.ts`
   shape exactly (injectable `getClient`, `createLoader`-wrapped query
   functions, `Promise.all` combination, a single production singleton
   export). Zero import of any VALUE from `CoachHome.tsx` — type-only
   imports only, if any are needed at all (diff-provable: no runtime
   circularity).
2. The new loader's `Promise<CoachHomeData>` return matches the "Return
   shape" section above exactly: real `defaultGoalHours`/`teams`/`students`,
   `seasonSetupStatus: { hasGoalsConfigured: true }`, and literal
   `[]`/`null` for `events`/`sessions`/`rsvps`/`attendance`/
   `teamParticipation`/`studentHours`. No `FIXTURE_*` symbol referenced
   anywhere in the new file.
3. Season row-not-found behavior is implemented, disclosed in a doc comment,
   and covered by a test.
4. `CoachHome.tsx` diff is exactly: one new import line, the
   default-parameter value at line 2114 (line 2116's `teamId` default
   UNCHANGED — diff-confirm this specifically), and the module-doc
   correction at lines 545-555 plus a new section 15. `defaultLoadCoachHomeData`
   (lines 1465-1479), `isSeasonMissingSetup` (`:1446-1451`),
   `sumGoalHours`/`sumConfirmedHours` (`:979-1010`) are byte-identical
   before/after — diff them directly to confirm.
5. `CoachHome.test.tsx`'s rewritten describe block (Test A + Test B, per
   above) passes, using a DI'd stub client (not a module-level `vi.mock`).
   Every other test in this file is byte-unchanged AND passes unmodified —
   confirm by running the full file, not by inspection alone.
6. `DashboardPage.test.tsx`'s new `vi.mock` block and the two new positive
   assertions (per above) pass; the admin test's comment is corrected; no
   other line in this file changes.
7. New unit tests in `coachHome.test.ts`, mirroring `dashboard.ts`'s own
   sibling query functions' test coverage style (or `students.test.ts`'s
   `makeResolveStudentScope` block if `dashboard.test.ts` doesn't exist —
   check first): spy-verified `.select(...)`/`.eq(...)` chains for all three
   queries, camelCase mapping tests for `teams`/`students`, the
   `hasGoalsConfigured: true` literal, the honest-empty literals for the
   remaining six fields, the row-not-found behavior from criterion 3, and at
   least one full `makeLoadCoachHomeData` integration test proving the
   composed `CoachHomeData` shape end-to-end against a stub client.
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
    diffs are each scoped exactly as described above; diff each file
    directly and confirm nothing else moved.

## Relevant Constitution Excerpt
- Non-Negotiables: "Existing tests must pass unless the boss explicitly
  approves a test update." This packet pre-authorizes content updates to a
  bounded, named set: `CoachHome.test.tsx`'s lines 1358-1388 (split into
  Test A/B, criterion 5) and `DashboardPage.test.tsx`'s two named regions
  (criterion 6). All other tests, including every other `CoachHome.test.tsx`
  render, must remain green AND unedited.
- Item 3: RLS/metric SQL come only from real migrations, copied verbatim; no
  re-deriving. The `staff_all`/`read_all` policies are quoted verbatim in
  Scope ruling #1 and the Context section above — cite them exactly as
  shown, not paraphrased. This task adds no metric math (no `%`/division on
  any new query — `defaultGoalHours` is a verbatim passthrough of
  `seasons.default_goal_hours`).
- Item 6: "No PII... in... test fixtures — fixtures use fabricated names."
  Use fabricated team/student names in every new stub/mock.
- Item 18: sonnet tier is correct — this reads three existing, RLS-covered
  tables the same shape `loaders/dashboard.ts`'s own `queryDashboardTeams`/
  `queryDashboardStudents`/`queryRosterStats` already do; it touches no
  migration, no RLS authoring, no security-definer SQL, and no auth/session/
  role logic (`AuthUser`/`guards.tsx` are read-only references here, never
  edited).
- Item 19c: "Verify your own citations before submitting." Every line number
  in this packet was re-read against this worktree's current HEAD, not
  inherited from the ledger row (which itself predates T155's outer/inner
  restructuring and has some stale numbers) — do the same before you rely on
  any of them; they may drift further before you start.
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
  (`dashboard.ts`) nor this packet asks for.

## Disclosure note (decided by the orchestrator, not yours to resolve)
This task deliberately does not resolve `teamId`, and deliberately does not
build real `events`/`sessions`/`rsvps`/`attendance`/`teamParticipation`/
`studentHours` queries even though the ledger row called the latter two
"mechanical." Both gaps are being filed as a single follow-up row, **T198**
(next available ID — verified against the current ledger max, T197), with
proposed content along these lines (final wording is the orchestrator's, not
yours to draft):

> **T198 — Product decision + follow-up: does `CoachHome` need a real
> per-coach "team" concept, or should its remaining team-scoped widgets
> become season-wide like T124's already-shipped ones?** `AuthUser` carries
> no team linkage, no table anywhere links a staff profile to a team, and
> every `staff_all` RLS policy grants program-wide (not team-scoped) access
> — confirmed directly, not inherited (T173 investigation). This is most
> likely a product-scope question for the human owner, not a pure schema
> gap: PRD HOME-01 describes the KPI grid as "scoped to selected season"
> with no team-scoping language, D-2 ("we are just a team... P3+GG=VOLT")
> and `CoachHome.tsx`'s own module doc #13(a) already resolved the identical
> question toward "season-wide" for T124's five newer widgets. Resolve the
> question first; only then decide whether it needs a schema/auth change
> (opus tier, its own migration task) or a widget-semantics change (no
> migration). Bundle in: real `events`/`sessions`/`rsvps`/`attendance`/
> `teamParticipation`/`studentHours` queries for `CoachHomeData` (currently
> literal honest-empty, T173) — building these before the team-scoping
> question resolves risks building the wrong shape twice.

## Most Recent Failure
None — fresh packet, not yet through `checker-premise` round 1.

## Required Worker Output
- Files changed (exact list).
- Summary of the new loader's shape, your season row-not-found decision, and
  your own independent read of the `hasGoalsConfigured: true` reasoning
  (agree, or flag a disagreement explicitly).
- Confirmation you ran the full suite at least twice: (1) your own measured
  baseline before any change; (2) final, after all edits — report exact
  counts both times, not a number copied from this packet or from
  `docs/swarm/`.
- `tsc`/eslint/prettier output, compared against your own measured baseline.
- Confirmation `defaultLoadCoachHomeData`, `isSeasonMissingSetup`, and
  `sumGoalHours`/`sumConfirmedHours` are byte-identical before/after (a `git
  diff` excerpt scoped to those lines, or equivalent).
- Confirmation `CoachHome.tsx:2116` (`teamId` default) is byte-unchanged.
- Confirmation the `CoachHome.test.tsx`/`DashboardPage.test.tsx` diffs each
  touch only their named regions (a `git diff` of each whole file, or
  equivalent).
- Known risks, and whether a dispute is needed (e.g. if you concluded Scope
  ruling #1 or #2 is wrong, or you disagree with leaving
  `events`/`sessions`/`rsvps`/`attendance`/`teamParticipation`/`studentHours`
  as literal honest-empty rather than real queries).
