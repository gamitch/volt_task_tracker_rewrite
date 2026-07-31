# T158 worker packet — real Supabase data for `Leaderboard.tsx`'s `LoadLeaderboardDataFn`

**Scope of THIS packet, stated up front because the ledger row's own framing is incomplete
(not stale-wrong, just incomplete — see §1).** This task builds the missing real data layer
only: a new migration + a new loader implementing `LoadLeaderboardDataFn`. It does **not**
touch `CoachHome.tsx`, `DashboardPage.tsx`, or either of their test files. Embedding
`<Leaderboard>` in the dashboard is filed as a separate follow-up, **T203** (see §11) — the
reasons for the split are in §1 and are not a formality.

**Epistemic status.** I am `foreman-planner` — I have Read/Grep/Glob and no Bash, so every
citation below is a direct file read, not an inference from a summary. Where I reason about a
mechanism I cannot execute against a live database (the RLS/view-visibility question in §4), I
say so explicitly rather than asserting it as measured.

---

## 1. What the ledger row got right, and the one thing it didn't anticipate

The T158 ledger row (`task-ledger.md`, grep `T158`) correctly names two gaps: `Leaderboard.tsx`
is never mounted, and `LoadLeaderboardDataFn` has no real implementation (only the sibling
privacy toggle, `leaderboard_privacy.ts`, is real). It frames these as "two units of work: build
a real `loadLeaderboardData`, then embed." **Both of those citations are still byte-accurate
today** — re-verified directly against the live file:

- `Leaderboard.tsx:218` — `export type LoadLeaderboardDataFn = (seasonId: string) =>
  Promise<LeaderboardLoadResult>;` — declared, never implemented anywhere under `loaders/`.
- `Leaderboard.tsx:473` — `seasonId = PLACEHOLDER_SEASON_ID` (the prop default, confirmed
  unchanged since the row was written).
- `Leaderboard.tsx:458-460` — the module comment disclosing `defaultLoadLeaderboardData` as
  "still out of scope for T104" (the sibling privacy task) is still present verbatim.
- Only one file under `loaders/` matches the name: `leaderboard_privacy.ts` (confirmed via
  `Glob`), and it supplies exactly one boolean (`leaderboard_privacy_enabled`), nothing about
  hours or names.

**What the row did not anticipate, because nobody had traced the RLS path for a non-staff
viewer:** a real loader cannot be built by copying the obvious precedent (`coachHome.ts`'s
plain `.from('students').select(...)`, unfiltered) — that pattern is only safe on
staff-gated pages, and `Leaderboard.tsx` is explicitly **not** staff-gated (module doc #6:
*"this component renders identical content for every viewer regardless of role... there is no
role-dependent branch anywhere in this file"*). §4 below is the full finding. This is why the
"one loader function" unit of work is actually a **migration + a loader**, not just a loader,
and why I've split the embed out rather than writing one packet for three deliverables of three
different risk classes.

---

## 2. Authority — what's settled and what's mine to design

George's ruling (`auto-mode-decisions.md`, "2026-07-30 — George's rulings on T157/T158",
verbatim): *"embed the leaderboard in the dashboard."* This settles **one thing**: `Leaderboard`
is embedded in `CoachHome`, not a standalone route. The ruling explicitly does not cover loader
design or embedding position (`auto-mode-decisions.md` line 879: *"loader design, test shape,
embedding position within the dashboard... is expected to be closed... Those are mine"* — said
of T157/T158 as a pair). Everything in this packet past that one sentence is my design, stated
as such.

---

## 3. Ground truth re-verified against the live tree (post-T155, post-T173)

`CoachHome.tsx` has changed twice since the T158 row was written (T155's outer/inner split,
T173's real teams/students wiring). Re-verified directly, current line numbers:

- `CoachHomeProps` interface: `CoachHome.tsx:2093-2111`. Current fields: `loadData?`,
  `loadDashboardData?`, `teamId?`, `nowFn?` — each defaults to a real production value except
  `loadData` — wait, `loadData` **also** defaults to the real `loadCoachHomeData` (T173). All
  four existing props already follow the "optional prop, defaults to the real thing" shape a
  fifth (`loadLeaderboardData`) would extend consistently.
- `CoachHome` outer wrapper: `:2169-2227`. Season-status switch; only `case 'ready'` (`:2214-2225`)
  mounts `CoachHomeContent`, passing `seasonId={activeSeason.season.id}` — a real UUID, never
  `PLACEHOLDER_SEASON_ID`, confirmed by T155's own already-Passed row.
- `CoachHomeContentProps`: `:2238-2246`. `CoachHomeContent`: `:2248` onward, JSX return starting
  `:2373`, ending `:2810`.
- The last two sections before the function ends: "Top events by student hours"
  (`VStack` `:2761-2784`) then `{showSeasonSetupCard && (<><Divider /><Card>...</Card></>)}`
  (`:2786-2803`). This is the natural embed point for a follow-up task — noted here for T203,
  not built in this task.
- `defaultGoalHours`/`seasonSetupStatus` are now real (T173, `loaders/coachHome.ts`); `teamId`
  remains `PLACEHOLDER_CURRENT_TEAM_ID` pending T198 (unrelated, not this task's concern —
  `Leaderboard` has no team dimension in its own type at all, so `teamId`'s unresolved status
  cannot affect this task either way).

**T157's reusable pattern, checked for transferability (`docs/swarm/active/T157-worker-packet.md`,
already-Passed, merged `18b481c`):** its shape is "mount a finished, tested, previously-unmounted
component inside an existing page, thread real props, add a role gate if the mount needs one."
Two-thirds of that transfers (finished/unmounted/thread-real-data); the role-gate third does
**not** apply here — `Leaderboard` has no role branch to add, by design (module doc #6, OUT-08:
visible to everyone). What T157 does **not** have a precedent for, because `ParentRsvp` mounts
inside its own component's existing `Section`-less page: `Leaderboard.tsx` renders its **own**
top-level `<Section variant="section" padding={4}>` (`:478`), and `CoachHome.tsx` has an
existing, shipped, checker-fixed rule against nesting bare `Section`s inside its capped content
column (see §9 — this is new territory T157 didn't have to solve, one more reason the embed
gets its own packet with its own investigation later, not a paragraph borrowed from T157's).

---

## 4. The finding that reshapes this task: `students` has no read-all policy, and `Leaderboard` has no role gate

**`rls.sql:82-102` (read in full), the load-bearing text:**

```
-- students (PRD 8.3: full | read own row + name/team of teammates (leaderboard)
-- | read linked students)
--
-- Trap 1 scope-down (see worker packet): "teammate name/team for leaderboard"
-- is NOT implemented here via a self-referential subquery on students (that
-- would be the exact profiles-recursion bug class constitution item 4
-- prohibits). own_or_linked_read below covers "own row" ... and "linked
-- students" ... only. The broader teammate visibility for the leaderboard is
-- expected to be closed by T013's metric/leaderboard views, not by a direct
-- SELECT policy on this table.

create policy staff_all on students for all to authenticated
  using (is_staff()) with check (is_staff());
create policy own_or_linked_read on students for select to authenticated
  using (id in (select my_student_ids()));
```

There is **no `read_all` policy on `students`** — confirmed by reading the entire table's policy
block; only `staff_all` (is_staff() only) and `own_or_linked_read` (own/linked only) exist. A
second migration, `student_teams.sql:40-53`, independently restates the same design decision when
explaining why `student_teams` (a non-PII join table) gets `read_all` while `students` does not:
*"students: PII-bearing (real display names of minors), so it is deliberately NOT `read_all`...
That migration's own comments state broader teammate visibility (e.g. for the leaderboard) is
intentionally left to be closed by metric/leaderboard VIEWS, not by widening the base table's own
SELECT policy — explicitly to avoid a self-referential-subquery recursion hazard on `students`
itself."*

**Consequence, concretely:** a plain `.from('students').select('id, display_name')` query,
executed as a `student` or `parent` session, is RLS-filtered by `own_or_linked_read` down to at
most the caller's own row (student role) or their linked children's rows (parent role) — **not**
the roster needed to rank a top-10 list. The same query executed as `coach`/`admin` returns
everyone (`is_staff()` grants full access via `staff_all`). This is exactly the schema's own
documented "teammate visibility... closed by views, not a table policy" plan (`rls.sql:90-92`) —
**not yet built.** `Leaderboard.tsx`'s own module doc #6 states there is no role branch anywhere
in the file, so this is not a hypothetical: every non-staff viewer of the eventually-embedded
leaderboard would see at most 0-1 names today if the loader queried `students` directly,
while every staff viewer would see the full top 10 — a role-dependent silent breakage, the
exact defect class this project has been bitten by all session, just with a schema-level cause
instead of a missing-prop one.

**Why the obvious precedent (`coachHome.ts`'s plain `students` query) does not transfer, checked
directly rather than assumed:** the closest existing "query `students` unfiltered for names"
precedent is `reports.ts:379-388`'s `queryHoursStudents` (`.from('students').select('id,
display_name, team_id, goal_hours_override').eq('is_active', true)`, feeding `/reports`'
`HoursTab`). I checked whether `/reports` is actually reachable by non-staff roles before citing
this as a counter-example to my own finding: `router.tsx:272-279` mounts `ReportsShell` behind
only `RequireAuth` at the router level, **but** `ReportsShell.tsx:173` wraps its entire content in
`<RequireRole allowedRoles={['coach','admin']}>` (confirmed by reading the file directly) — so
`queryHoursStudents` never actually fires for a student/parent session; the component tree that
would call it never mounts for them. This precedent is safe precisely because it's staff-gated,
which is the one property `Leaderboard` deliberately lacks. It is not evidence this pattern
transfers here.

**The sanctioned mechanism, per the schema's own stated intent (not my invention):** both
`rls.sql:90-92` and `student_teams.sql:47-53` say, independently, that broader-than-own-row
visibility for exactly this purpose ("the leaderboard") is meant to be closed by a **view**, not
a table policy change. §6 below builds exactly that — the smallest possible view (two columns,
one filter), not a general-purpose "expose all students" hole.

**What I am deliberately not asserting as a verified mechanism, and why (constitution item
19c):** whether a plain Postgres view (no `security_invoker`, confirmed zero occurrences of that
keyword — or `FORCE ROW LEVEL SECURITY`, or `security_barrier` — anywhere under `supabase/`, via
direct grep) evaluates its base-table RLS using the invoking session's role or the view owner's is
a real mechanism question this project has gotten wrong once already: `dashboard_views.sql:49-52`
claims its views "run under the querying session's own RLS," which constitution item 25 records as
false (T176's checker's finding — the real per-view knob is `security_invoker`, PG15+, defaults
off, and appears nowhere in this schema). **I also found, while re-tracing this for this task, a
second instance of the same unverified claim:** `loaders/students.ts:365-387`'s own module doc
reasons from the *same* `dashboard_views.sql:49-52` sentence ("reasoned, not measured (no live
Supabase in this environment)... flagged for the checker to independently confirm") to justify
`v_student_goal_projection` being safely readable by a student for their own row. That comment
was never revisited after item 25 corrected the sentence it depends on. **This is a real, disclosed,
out-of-scope finding — not this task's to fix** (it's a doc-accuracy question on an unrelated,
already-shipped file, not a functional defect: item 25's own resolution treats broad, cross-student
read exposure through a view as the deliberate, working, intended mechanism regardless of exactly
how Postgres achieves it). Filed as **T204** (§11), not corrected here.

**What I rely on instead of re-deriving the mechanism:** the empirical, already-shipped fact that
`v_student_hours`/`v_team_participation`/`v_student_goal_projection` are queried *today* from
surfaces reachable by every role (`loaders/students.ts` for `StudentHome`, `loaders/parentHome.ts`
for `ParentHome`, both already-Passed, merged, live routes) — and the project's own adjudicated
ruling (constitution item 25) that cross-student read exposure through a **view** for reporting/
leaderboard purposes is the intended, sanctioned pattern, distinct from and not blocked by item
4's table-scoped RLS rule. §6's new view follows that same, already-relied-upon shape. Nothing
below asserts a specific claim about *how* Postgres achieves this that isn't already either
directly grepped (the absence of `security_invoker` etc.) or cited to an adjudicated finding.

---

## 5. Scope ruling — one task here, two follow-ups filed, not silently dropped

**This task (T158): the migration + the loader. Nothing else.** Justification:

1. **Migration work is opus-tier and full-premise-gated by rule, unconditionally** (item 18
   trigger 1 fires the instant a file under `supabase/migrations/` is touched — no "arguable"
   analysis needed, unlike T157's trigger-4 discussion). Bundling a sonnet-shaped UI-wiring task
   into the same packet would force the whole thing to opus tier and a full gate for no benefit
   to the UI half.
2. **The embed has its own real hazard needing its own investigation**, not a rubber-stamp:
   `Leaderboard.tsx` renders its own top-level `Section`, and `CoachHome.tsx` has an existing,
   shipped fix (the T129 checker rework, cited in `CoachHome.tsx`'s own code comment at
   `:2270-2278`) removing exactly this class of nested-`Section` bleed elsewhere in the same
   file. Embedding `<Leaderboard>` naively risks reintroducing a smaller instance of the same
   bug (§9 in the T203 note below). This deserves its own focused packet, not a rushed paragraph
   riding along with a migration review.
3. **Two separate test files need two different fixes for the embed, neither built yet**
   (`CoachHome.test.tsx`'s per-test prop-override convention vs. `DashboardPage.test.tsx`'s
   module-level `vi.mock` convention — full detail in §11's T203 note). Getting this wrong
   silently breaks or silently no-ops dozens of pre-existing tests; it needs to be verified
   against the *actual* new loader's export name and shape once T158 has landed, not guessed at
   from this packet.
4. **This mirrors every prior split this session** (T155→T173, T157→T169, T173→T198,
   T183→T199) — narrowing rather than combining is the established, working pattern here, and
   I'm not deviating from it without a comparably strong reason to combine, which I don't have.

**Both named gaps are still tracked, not dropped:** "no real loader" closes with this task
(T158). "Never mounted" is explicitly filed as **T203** (§11), not silently deferred to a
module comment — satisfying item 20 directly, the same discipline this session's other
splits already followed.

---

## 6. Design

### 6a. Migration — new file, `supabase/migrations/20260731000000_leaderboard_students_view.sql`
(confirm no filename collision at dispatch time — latest existing file is
`20260724000001_planned_hours_future_guard.sql`, confirmed via `Glob`; this timestamp sorts
after it)

```sql
-- T158: closes the gap rls.sql/student_teams.sql both name explicitly --
-- "teammate name visibility for the leaderboard... closed by metric/
-- leaderboard VIEWS, not a direct SELECT policy on `students`"
-- (rls.sql:90-92, student_teams.sql:47-53, both read-only, quoted not
-- paraphrased). `students` deliberately has no `read_all` policy (PII --
-- real display names of minors); `own_or_linked_read` only lets a caller
-- see their own/linked row(s), which is correct for every OTHER consumer
-- of this table but not for OUT-08's leaderboard, which by design shows
-- every active student's name to every authenticated role
-- (`Leaderboard.tsx` module doc #6 -- no role gate anywhere in that file).
--
-- Two columns, one filter -- not a general-purpose "all students" view.
-- `is_active` filters at the view level (not merely at the TS layer) so a
-- deactivated student's historical `v_student_hours` row (that view has no
-- is_active filter of its own -- confirmed, metric_views.sql:3-19) finds no
-- matching name here and is silently skipped by `Leaderboard.tsx`'s own
-- existing `topStudentsByHours` ("rows whose studentId has no matching
-- roster entry are skipped" -- already-shipped behavior, unmodified by this
-- migration). This is a disclosed, narrow, precedented choice (matches
-- `v_student_participation`'s own `where s.is_active` convention,
-- metric_views.sql:28 and membership_views.sql:67) -- it does not resolve
-- the broader, still-open T201 question of whether a deactivated student's
-- historical hours should surface ANYWHERE; it only decides this one new
-- consumer follows the same "roster views are active-only" default every
-- other roster-shaped view in this schema already uses.
--
-- Additive only (constitution item 10): `create or replace view` in a new
-- file, this repo's own established convention (metric_views.sql,
-- membership_views.sql, dashboard_views.sql all say so in their own header
-- comments). No existing migration file is edited.
--
-- Mechanism note, deliberately NOT a specific claim (see this task's own
-- worker-packet §4): this view sets no `security_invoker` (PG15+), matching
-- every other view in this schema (zero occurrences of that keyword
-- anywhere under supabase/, confirmed by grep) -- it is not a new kind of
-- exposure, it is the same already-relied-upon shape v_student_hours/
-- v_team_participation/v_student_goal_projection already have, which are
-- already queried today from student/parent-facing surfaces
-- (loaders/students.ts, loaders/parentHome.ts). This comment does not
-- restate dashboard_views.sql:49-52's "runs under the calling session's own
-- RLS" claim -- that sentence is the one constitution item 25 found to be
-- wrong.
create or replace view v_leaderboard_students as
select id, display_name
from students
where is_active;
```

### 6b. Loader — new file, `src/lib/supabase/loaders/leaderboard.ts`

Mirrors `loaders/coachHome.ts`'s exact `createLoader` + `Promise.all` two-query composition
shape (same file, cited by symbol: `makeLoadCoachHomeData`, `coachHome.ts:186-216`), and imports
its return-shape types the same type-only, no-cycle way `coachHome.ts` already imports
`CoachHomeData`/etc. from `../../../pages/home/CoachHome` (`coachHome.ts`'s own module doc #6,
"Avoiding a circular import" — identical reasoning applies here: `Leaderboard.tsx` never imports
anything from this new file, so a type-only import back into it creates no cycle).

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLoader, type LoaderQueryResult } from '../loader';
import { getSupabaseClient } from '../client';
import type {
  LeaderboardHoursRow,
  LeaderboardLoadResult,
  LeaderboardStudentFixture,
  LoadLeaderboardDataFn,
} from '../../../pages/outreach/Leaderboard';

interface LeaderboardHoursDbRow {
  student_id: string;
  season_id: string;
  confirmed_hours: number;
}

interface LeaderboardStudentDbRow {
  id: string;
  display_name: string;
}

function mapHoursRow(row: LeaderboardHoursDbRow): LeaderboardHoursRow {
  return { studentId: row.student_id, seasonId: row.season_id, confirmedHours: row.confirmed_hours };
}

function mapStudentRow(row: LeaderboardStudentDbRow): LeaderboardStudentFixture {
  return { id: row.id, displayName: row.display_name };
}

async function queryLeaderboardHours(
  client: SupabaseClient,
  seasonId: string,
): Promise<LoaderQueryResult<LeaderboardHoursDbRow[]>> {
  const result = await client
    .from('v_student_hours')
    .select('student_id, season_id, confirmed_hours')
    .eq('season_id', seasonId);
  return { data: (result.data as LeaderboardHoursDbRow[] | null) ?? null, error: result.error };
}

async function queryLeaderboardRoster(
  client: SupabaseClient,
): Promise<LoaderQueryResult<LeaderboardStudentDbRow[]>> {
  const result = await client.from('v_leaderboard_students').select('id, display_name');
  return { data: (result.data as LeaderboardStudentDbRow[] | null) ?? null, error: result.error };
}

export function makeLoadLeaderboardData(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadLeaderboardDataFn {
  const loadHours = createLoader<string, LeaderboardHoursDbRow[]>(queryLeaderboardHours, getClient);
  const loadRoster = createLoader<void, LeaderboardStudentDbRow[]>(queryLeaderboardRoster, getClient);
  return async (seasonId: string): Promise<LeaderboardLoadResult> => {
    const [hoursRows, studentRows] = await Promise.all([loadHours(seasonId), loadRoster()]);
    return {
      hours: (hoursRows ?? []).map(mapHoursRow),
      students: (studentRows ?? []).map(mapStudentRow),
    };
  };
}

/** `Leaderboard.tsx`'s future real `loadData` default (wired by T203, not this task). */
export const loadLeaderboardData: LoadLeaderboardDataFn = makeLoadLeaderboardData();
```

This is a design prescription, not final code — adapt if a concrete conflict surfaces, and
disclose the deviation and why in your output doc, same standard every packet this session uses.

Do **not** implement any top-10 ranking/slicing in this file — `Leaderboard.tsx`'s own
`topStudentsByHours` (unmodified, Forbidden file) already does that client-side over whatever
this loader returns; re-implementing it here would duplicate logic that already exists and is
already tested.

---

## 7. Allowed / Forbidden files

**Allowed (write access):**
- `supabase/migrations/20260731000000_leaderboard_students_view.sql` (new file — confirm no
  timestamp collision with anything landed since this packet was written)
- `src/lib/supabase/loaders/leaderboard.ts` (new file)
- `src/lib/supabase/loaders/leaderboard.test.ts` (new file)

**Forbidden (read-only reference):**
- `src/pages/outreach/Leaderboard.tsx`, `Leaderboard.test.tsx` — finished, tested. You import
  four types from it (`LeaderboardHoursRow`, `LeaderboardLoadResult`, `LeaderboardStudentFixture`,
  `LoadLeaderboardDataFn`) via `import type` — not a write, same posture T157's packet already
  established and justified for an identical page↔loader type-only boundary (`T157-worker-packet.md`
  §6c/§5).
- `src/pages/home/CoachHome.tsx`, `CoachHome.test.tsx`, `src/pages/home/DashboardPage.tsx`,
  `DashboardPage.test.tsx` — **explicitly not this task.** T203 (§11) owns the embed. Do not
  mount `<Leaderboard>` anywhere, do not import it, do not reference it as in-scope.
- `src/lib/supabase/loaders/leaderboard_privacy.ts` — sibling, unrelated concern (the privacy
  toggle), read-only reference only if you need to confirm the naming convention.
- All other existing `supabase/migrations/*.sql` files — read-only reference; editing an
  applied migration is a BLOCKER (constitution item 10).
- `docs/swarm/**`, `.claude/**` — standard, every task.
- Any file not listed above as Allowed.

If you find a genuine defect or gap outside these files, do not fix it and do not only leave a
code comment (constitution item 20) — report it in your output doc; the foreman files the
ledger row.

---

## 8. Acceptance criteria

**Migration (SQL, static review — see the disclosed limit below):**

1. The view selects exactly `id, display_name` from `students`, filtered `where is_active` —
   verify by reading the file text; no other column, no join, no computed value.
2. No existing migration file is modified (`git diff` against `main`/branch tip touches only the
   one new file under `supabase/migrations/`).
3. **Disclosed limit, not silently glossed over:** the `is_active` filter is SQL-only and cannot
   be proven by a TypeScript unit test against a stubbed client — the mock in criterion 6 below
   has no way to exercise a real Postgres `WHERE` clause. State this explicitly in your output
   doc rather than implying the TS suite covers it.
4. **If any scratch-Postgres or Supabase-CLI-backed local database is available in your
   environment, use it** (same posture T104's own worker packet took for its own RLS claim,
   "independently confirmed against a real scratch-Postgres run") to apply this migration and
   confirm: (a) a `student`-role session querying `v_leaderboard_students` directly gets more
   than just their own row back, and (b) a deactivated student's row does not appear. If no such
   environment is available to you, say so explicitly in your output doc — do not claim this was
   verified if it wasn't.

**Loader (`leaderboard.test.ts`, mutation-provable, mirroring `coachHome.test.ts`'s established
shape exactly — cite it as your structural template):**

5. `queryLeaderboardHours` calls exactly `.from('v_student_hours').select('student_id, season_id,
   confirmed_hours').eq('season_id', seasonId)`. Build the recording-client stub the same
   resilient way `students.test.ts:26-62` does for its own `.eq(...)`-chained view query — expose
   the resolved value reachable both before and after the `.eq()` call, so a mutation that drops
   the `.eq(...)` filter fails on the intended assertion (`eqSpy` not called with the right args),
   not on an unrelated `TypeError`. **Mutation:** remove the `.eq('season_id', seasonId)` call at
   the call site; confirm the test fails on the eq-assertion, not a crash. Restore.
6. `queryLeaderboardRoster` calls exactly `.from('v_leaderboard_students').select('id,
   display_name')`, unfiltered — same exact-string-match convention `coachHome.test.ts` already
   uses for its own unfiltered `teams`/`students` queries (`toHaveBeenCalledWith('id, name')`
   idiom) — no `parseSelectedColumns` extraction needed here (that helper lives in
   `outreach.test.ts` for a same-file reuse case that doesn't apply to this new file). **Mutation:**
   drop `display_name` from the select string; confirm the test fails.
7. `makeLoadLeaderboardData` composes both queries via `Promise.all` and maps DB rows to
   camelCase (`student_id`→`studentId`, `season_id`→`seasonId`, `confirmed_hours`→`confirmedHours`,
   `id`→`id`, `display_name`→`displayName`) with no other transform — an end-to-end composed-shape
   test against a stub client returning non-trivial fixture rows for both queries (mirror
   `coachHome.test.ts`'s "composes the full ... shape end-to-end" test).
8. `hours`/`students` each resolve an empty array (never `null`) when the underlying query
   resolves `null` (zero rows) — test both independently.
9. A genuine query error on **either** query rejects with the real `SupabaseLoaderError` (no
   fixture fallback) — mirror `coachHome.test.ts`'s last test, adapted for two possible failure
   sites.
10. Calling the composed loader twice with two different `seasonId` values shows the hours query
    is a real passthrough (the `eq` spy called with each distinct value, and each call's returned
    `hours` differs accordingly) — not a hardcoded literal. The roster query has no `seasonId`
    argument at all; confirm it is called identically regardless of which season was requested
    (the same fixture roster feeding two different season's compositions).
11. `tsc`/`vite build`/`eslint`/`prettier --check` all clean. Full existing suite stays green —
    this is a new file only, so the only real risk is an import-path or naming collision; state
    the before/after test count (before = whatever the branch tip currently measures; after =
    before + your new `it(` count, zero removed/edited elsewhere).
12. No PII (constitution item 6): any fixture display names you write in the test file are
    fabricated, matching this repo's existing convention.

---

## 9. Worker tier and checker assignment

**Worker: `worker-implementer`, tier `opus`.** Unambiguous — constitution item 18's first
trigger ("creates or edits a file under `supabase/migrations/`") fires the instant the new
migration file is created, with no "arguable" analysis needed (unlike T157's trigger-4
discussion). Pass `model: "opus"` on the dispatch call.

**Checker: `checker-reviewer`, tier `opus`.** This task creates a new view exposing
previously-restricted student data more broadly (§4's finding); even though constitution item 25
retires "bump to opus because a topic sounds sensitive" as independent grounds, item 18's
migration trigger already justifies opus on its own for both roles here, and the RLS/visibility
reasoning in §4 is exactly the class of claim this session has gotten wrong twice already
(`dashboard_views.sql`, `students.ts`) — worth a careful second read, not a rubber stamp.

**Premise gate: full `checker-premise` round (item 19b) — not light, not skipped.** This is a
genuinely novel mount point (a view exposing PII-adjacent data to a wider audience than any
existing table policy allows) and it touches `supabase/migrations/`, both independently
sufficient triggers for a full gate per item 19b ("full premise check for novel patterns and for
anything touching migrations, RLS, or metric SQL"). The gate should independently re-verify: the
`students` table's actual policy list (§4), the `reports.ts`/`ReportsShell.tsx` staff-gating claim
(§4), and that this migration's own comment does not repeat the already-corrected
`dashboard_views.sql:49-52` claim (§4's closing paragraph).

---

## 10. Constitution excerpts relevant to this task

- Item 3: RLS policies and metric SQL come only from PRD 8.4, copied verbatim; this migration
  adds no policy and no metric formula (a plain two-column, one-filter view is not "metric SQL"
  in the percentage/sum/average sense item 3 targets).
- Item 4: RLS is default-deny for tables; **item 25 clarifies this does not extend to views** —
  this task creates a view, not a table, and adds no table policy.
- Item 6: no PII in fixtures — fabricated names only in the new test file.
- Item 10: existing tests must pass; no existing migration file or test file is edited by this
  task at all.
- Item 18: migration-touching → opus tier, both roles (§9).
- Item 19b: novel pattern + migration-touching → full premise gate (§9).
- Item 19c: verify your own citations before submitting — §4 documents exactly which claims are
  grepped/read-verified vs. reasoned-and-disclosed-as-such.
- Item 20: a deliberate deferral (the embed, the two stale RLS comments) produces a follow-up
  task, not a comment — §11.
- Item 25: proportionality — this view's exposure (active students' names, program-wide) is the
  same class of exposure item 25 already ruled acceptable for the leaderboard specifically ("a
  leaderboard shows everyone's hours... is the feature"); this task does not manufacture a new
  security-class finding out of that already-settled ruling.

---

## 11. Follow-ups filed alongside this packet (foreman-planner, ledger rows written directly —
see the accompanying report for exactly what changed)

**T203 — embed `<Leaderboard>` in `CoachHome.tsx`, wired to the real `seasonId` and this task's
new loader.** Depends on T158 landing (needs `loadLeaderboardData`'s real export name/shape to
exist first). Design notes for whoever packets it, so the investigation isn't repeated from
scratch:

- Insert point: a new `<Divider />` + section between "Top events by student hours"
  (`CoachHome.tsx`, ends `:2784`) and the admin `showSeasonSetupCard` block (starts `:2786`) —
  confirmed current line numbers, will drift once T158's loader import lines land above them.
- Add `loadLeaderboardData?: LoadLeaderboardDataFn` to both `CoachHomeProps` (`:2093-2111`) and
  `CoachHomeContentProps` (`:2238-2246`), defaulting to the real loader — same "prop defaults to
  the real thing" convention every existing field on that interface already uses.
- **Real hazard, investigated, not guessed:** `Leaderboard.tsx` renders its own top-level
  `<Section variant="section" padding={4}>` (`:478`). `Section`'s "outer" wrapper style
  (`node_modules/@astryxdesign/core/dist/Section/Section.js:60-67,159-166`) applies an
  unconditional negative margin sized to cancel the nearest ancestor's `--container-padding-*`
  vars — the exact mechanism `CoachHome.tsx`'s own already-shipped T129 checker fix
  (`:2270-2278` doc comment) removed a different instance of from this same file ("Section
  applies an unconditional full-bleed negative-margin band... that bled past the padded
  LayoutContent this page renders inside"). Nothing between `LayoutContent padding={6}` and a
  bare `<Leaderboard>` mount resets that CSS var (the intervening `VStack`s don't call
  `container(...)`; only `Card`/`Section`/`LayoutContent` do — confirmed by reading `Card.js`
  and `Section.js` directly), so a bare mount would make the leaderboard's own `Section` render
  wider than every sibling section on the page by a measurable, real amount — smaller than the
  original T129 bug (it won't reach the browser edge, since the nesting is deeper), but the same
  underlying defect class. **Fix, not yet built or measured:** wrap `<Leaderboard>` in a `<Card>`
  (already imported and used elsewhere in this exact file, `:301`'s own doc-citation) — `Card`
  calls `container(...)` too, resetting the ambient padding vars to its own (smaller, local)
  padding before `Section`'s negative margin ever computes against it, matching `Section`'s own
  doc comment ("Use inside `Card` to create visually distinct regions"). **Whoever packets T203
  must have the worker actually render this and measure the result** (bounding rect / computed
  style, matching this file's own T142 "measured, not theoretical" precedent) rather than trust
  this reasoning alone — the obfuscated StyleX class names in the installed package make the
  exact pixel values unverifiable by reading source.
- **Two test files, two different fixes, both needed:**
  - `CoachHome.test.tsx`'s `renderAsUser` helper (`:133-155`) merges per-test prop overrides —
    every existing `it(` that reaches `CoachHomeContent`'s populated state passes its own
    `loadData`/`loadDashboardData` overrides explicitly (confirmed: zero pre-existing calls with
    `props={}` reach the `'ready'` season state — the only two that use `{}` pin `loadActiveSeason`
    to `'none'`/pending, so `CoachHomeContent` never mounts for them). A new `loadLeaderboardData`
    prop defaulting to the real loader would make every *other* pre-existing test newly fire a
    real, unconfigured `getSupabaseClient()` call (which rejects, not crashes — `createLoader`
    wraps `getClient()` inside its own `try` per `loader.ts:163-173` — but still an unintended
    real-network-attempt on dozens of tests that have nothing to do with this feature). **Fix:**
    merge a safe default (e.g. `Leaderboard.tsx`'s own already-exported, already-fixture
    `defaultLoadLeaderboardData`) into `renderAsUser`'s own default-prop object before spreading
    the caller's `props` — the exact mechanism this same file already uses for `loadActiveSeason`
    (`:124-131`'s own doc comment explains why a default third parameter keeps every two-argument
    call site passing unmodified). One edit to the shared harness, not forty edits to individual
    `it(` bodies.
  - `DashboardPage.test.tsx` renders `<DashboardPage />` with **zero** props at every call site
    (confirmed: `DashboardPage.tsx` itself renders `<CoachHome />` passing no props at all, so
    per-test overrides are structurally impossible here) — this file already handles the
    identical problem for `loadCoachHomeData`/`loadDashboardData`/`resolveStudentScope`/
    `loadStudentHomeData`/`loadLinkedStudentsForParentHome`/`loadStudentHomeCardDataForParentHome`
    via five separate top-level `vi.mock(...)` blocks (`:52-181`, each with its own comment
    explaining which real default it intercepts and why). A sixth, matching block for
    `../../lib/supabase/loaders/leaderboard` (T158's new module) will be needed, or the existing
    "renders CoachHome for role coach/admin" tests (`:272-330`) will start exercising the real,
    unconfigured loader too.
- Given the CSS fix and the two-file test fix are both real but comparatively mechanical once
  T158's exports exist, T203 can reasonably get a **lighter** premise gate than T158's (item
  19b) — it rolls out an already-established mount pattern (T157) to a component with no role
  gate of its own, the one thing T157 didn't have precedent for being the CSS nesting question,
  which is resolved by inspection above, not left open.

**T204 — `loaders/students.ts`'s own RLS-reasoning comment (`:365-387`) still cites
`dashboard_views.sql:49-52`'s "runs under the calling session's own RLS" claim, which constitution
item 25 already found to be false** (the real per-view knob is `security_invoker`, PG15+, off by
default, absent from this schema entirely). `students.ts`'s comment predates item 25's finding and
was never revisited; it explicitly says "reasoned, not measured... flagged for the checker to
independently confirm," so this is a stale, disclosed-as-uncertain claim, not a confident wrong
one, and it does not describe a functional defect — item 25's own resolution treats this class of
cross-student view exposure as intended and working regardless of the exact mechanism. Low
severity (documentation accuracy only); no code change implied. Not fixed here (out of this
task's Allowed Files and unrelated to its own migration/loader).

---

## 12. Required worker output

- Every commit states its SHA (item 21); explicit pathspecs only, never `git add -A`/`git add .`
  (item 22).
- Output doc includes: files touched, the executed mutation output for criteria 5 and 6, the
  before/after test count (criterion 11), the `tsc`/build/lint/format results, and explicit
  confirmation of whether a live scratch-Postgres check was possible for criterion 4 (and its
  result if so).
- State plainly which design prescriptions in §6 you followed as-written vs. deviated from, and
  why, if any.
- Do not mark your own work complete — a separate checker validates the actual artifact.
