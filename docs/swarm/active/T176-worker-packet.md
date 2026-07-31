
# T176 — Worker Packet (Revision 2 — final; no gate behind this one)

`StudentHome`'s `studentId`/`teamId`/`seasonId` default to placeholders; every
signed-in student's dashboard fetches a fixture identity's data.

**Header.** Branch tip `b2beb09` on `claude/swarm-plan-zl575z`. Round-1
packet gated **REVISE — 2 BLOCKER, 6 MAJOR, 1 MINOR set**, recorded verbatim
at `docs/swarm/active/T176-gate-round1-findings.md` (committed `641e97c`,
gate measured at `e375489`). **Round 2 of 2 — this revision goes straight to
a worker with no gate behind it.** Every figure below is either (a)
read-verified by the foreman directly against the live tree just now (no
Bash available to this role — stated, not measured), or (b) attributed
explicitly to the round-1 gate as **measured** (it had Write+Edit+Bash,
built the packet's own prescribed shape, ran every mutation, and reverted).
Do not conflate the two provenances; they're labeled throughout.

**FIRST ACTION, unchanged from revision 1: merge `origin/claude/swarm-plan-
zl575z` into your worktree before reading anything else.** Worktrees are
created from `main` (`f7ff055`), which contains neither T155's `CoachHome`
split nor `resolveCurrentStudentId` (T096). T157's worker discarded ~320
lines for exactly this omission.

**Nothing in this packet is owner-approved.** The round-1 gate independently
checked `auto-mode-decisions.md` for `StudentHome`/`T176` and found no
match — confirmed clean again by me. Three design decisions below are
recorded as the **foreman's own**, not George's (§3): bringing the
goal-hours denominator into scope, naming `Hi Ada Reyes` as the lead
follow-up item, and stating the blast-radius numbers as a requirement.

---

## 1. The bug (unchanged from revision 1, read-verified)

`StudentHome.tsx`, `export function StudentHome({...})` (hint `:1130-1137`):
defaults `studentId = PLACEHOLDER_CURRENT_STUDENT_ID`, `teamId =
PLACEHOLDER_CURRENT_TEAM_ID`, `seasonId = PLACEHOLDER_SEASON_ID`.
`DashboardPage.tsx`'s role switch renders `<StudentHome />` with zero props.
`loadData(studentId, seasonId)` (hint `:1139-1142`) is the real fetch call —
every signed-in student's dashboard is fetched for the fixture identity.

## 2. What changed since revision 1, and why — read this before §6/§7

### 2a. `studentId` resolution — unchanged, still correct

Reuse `resolveCurrentStudentId` (`loaders/meetings.ts:664`) and its types
`CurrentViewerIdentity`/`ResolveCurrentStudentIdFn` (exported from
`MeetingsList.tsx:698`/`:706`), mirroring `ResolvedStudentMeetingsView`'s
explicit-prop-bypass shape (`MeetingsList.tsx:2411-2484`). **Do not edit
`MeetingsList.tsx`, `MeetingsList.test.tsx`, or `loaders/meetings.ts` — all
three are now pure read-only reference (see §2b for why `loaders/meetings.ts`
moved out of Allowed Files entirely).**

### 2b. `teamId` — resolvable, but NOT single-valued. Corrected, and placement reopened.

**Deleted claim, mine, wrong:** revision 1 said "there is exactly one team."
**False.** `supabase/migrations/20260721000000_student_teams.sql` (read by
me just now, header verbatim): *"a student may belong to more than one
team... `students.team_id` remains the legacy/primary-team read path until a
later SCH-03+ packet migrates readers over to this junction."* Every other
current reader has already migrated: `v_student_participation`/
`v_team_hours` (per the gate's measured citations,
`membership_views.sql:63`/`:92`), `dashboard_views.sql:205-206`,
`kpi_views.sql:256`; `ParticipationTab.tsx` (module doc #12, hint `:223-277`)
carries a purpose-built dual-member fixture for exactly this; `checkin.ts`
(hint `:128-134`) discloses a live `.limit(1)` gap that "arbitrarily picks
one team's row for a dual member."

`StudentHome`'s only team predicate is `isEventInTeamScope(event, teamId)`
(`StudentHome.tsx:530-535`, read-verified — a **single** `teamId` tested
against `event.teamIds`), gating `selectLiveMeetingSession`, `buildNextUp`,
and `getUnansweredOutreachOpportunities`. **Resolving the primary
`students.team_id` therefore means a dual-team-member student silently
loses her second team's meetings, live check-in, and sign-up
opportunities** — the same defect class T120 already fixed once on
`ParticipationTab`.

**Still ship T176 against the legacy `students.team_id` path.** The junction
is a wider refactor (touching every reader, not just this one), and
`students.team_id` is the migration's own documented interim path. But:
**disclose this as a deliberate, known narrowing** (cite the migration's own
sentence above, don't paraphrase it), and **file the follow-up** (§7,
criterion 12b) for moving `StudentHome`'s scoping onto `student_teams`
ACTIVE memberships. Do not silently resolve `teamId` as if it were single-
valued by nature — it isn't; it's single-valued only in the column you're
reading.

**Placement reopened, per the gate's measured finding:** `src/lib/supabase/
loaders/students.ts` **exists** (309 lines, read by me just now) — it
already owns `StudentDbRow` (`:99-108`, including `team_id: string` and
`goal_hours_override: number | null`) and `mapStudentDbRowToStudentRow`
(`:139-149`) for `StudentsTab.tsx`. Revision 1 said no such file existed and
put the new function in `loaders/meetings.ts` on that false premise.
**Corrected: the new function goes in `loaders/students.ts`, not
`loaders/meetings.ts`.** Reasoning: `loaders/meetings.ts` owns *identity
resolution* — "which student is this" (`resolveCurrentStudentId`, a
genuinely different concern). `loaders/students.ts` already owns *what a
students row says* — the same concern this new function is. It's the
natural sibling of `queryStudents`/`mapStudentDbRowToStudentRow`, not a
second, unrelated addition to a file that already has its own filed
test-coverage gap (T162) unrelated to this task. **Consequence:** `loaders/
meetings.ts` needs **zero** edits for T176 — moved from Allowed to
Forbidden/reference-only (§5).

### 2c. The goal-hours denominator — brought into scope. Recorded as the foreman's decision, not George's.

Revision 1's §2c declined this on the ground that "no honest value exists
without a real loader." **That ground is false, and the gate proved it
false, not just asserted it:** it re-rendered `StudentHome` with
`season.defaultGoalHours` set to `7` and the screen still read `100` —
because `activeSeason.season.defaultGoalHours` (real Supabase data,
`loaders/seasons.ts:137/150`, already loaded by `SeasonProvider` and handed
to `StudentHome` the moment §6 wires `useActiveSeason()` at all) is already
in hand and simply never consulted.

MET-04's denominator is `goal_hours_override ?? season default_goal_hours`.
`season.defaultGoalHours` comes for free from the `useActiveSeason()` call
this task is already making. The student's own `goal_hours_override` comes
from the **same own-row `students` read** this task is already adding for
`team_id` (§2b) — one more selected column, already RLS-scoped identically.

**Decision (foreman's, not the owner's — no `auto-mode-decisions.md` entry
authorizes this or anything else in this packet): bring it into scope,
bounded explicitly.** This is the **one** additional real-data field in
scope for T176. Do **not** build a real loader, or thread real values, for
`events`/`sessions`/`rsvps`/`studentHours`/`participation`/`displayName` —
those stay exactly as fixture-fed as revision 1 planned, and go honestly
empty or stay fabricated per §7 criterion 11's enumeration.

**Three DOM surfaces carry this fabricated value, not one — the gate
measured this, revision 1 predicted only one:**

| Surface | Fabricated value today |
|---|---|
| Visible `ProgressBar` label | `0 / 100 h (0%)` |
| `aria-valuemax` | `100` |
| `aria-valuetext` | `0 / 100 h (0%)` |

A screen-reader user hears the fabricated number twice more than a sighted
one sees it. **Criterion 10/11 must enumerate over `container.innerHTML`,
not `textContent`** — `textContent` strips every ARIA attribute and would
have missed two of the three surfaces.

**Design (bounded, minimal):** `StudentHomeContent` computes `goalHours =
resolveGoalHours(realGoalHoursOverride, realSeasonDefaultGoalHours)` using
the real `activeSeason.season.defaultGoalHours` and the real,
own-row-resolved `goalHoursOverride` — **not** `data.defaultGoalHours`/
`data.goalHoursOverride` (the still-fixture `loadData`'s own fields, which
keep existing on the `StudentHomeData` type unchanged — this task does not
touch that type — but stop being consulted for this one computation).
`resolveGoalHours`/`hoursVsGoalPercent` themselves stay byte-unchanged
(criterion 9 — only which values feed them changes).

## 3. Decisions recorded as the foreman's, not the owner's

1. **§2c above** — bringing the goal-hours denominator into scope, bounded
   to exactly that one field.
2. **`Hi Ada Reyes` is the lead item of the follow-up ledger row (criterion
   12a), named first, explicitly.** The gate's own measured DOM dump (§7,
   the reproduced table) has it at the top of the screen:
   `defaultLoadStudentHomeData` returns the literal string `'Ada Reyes'`
   and **ignores both its parameters** — so every real signed-in student is
   greeted by a fabricated human name, unconditionally, and fixing the
   identity props this task closes does not touch it. It's the surface a
   student notices first and the one most likely to get reported as a bug
   by a real user, the same way George reported the `CoachHome` 400s
   himself. Name it first; don't bury it in a list.
3. **State the blast radius as a number (criterion 13).** Measured by the
   gate: **13 of 33** `StudentHome.test.tsx` tests break, **1 of 5** in
   `DashboardPage.test.tsx`, nothing else in the repo. Both harness-only.
   13/33 is exactly the size where a worker starts rewriting assertions
   instead of the harness — state the number so that doesn't happen here.

## 4. `DashboardPage.test.tsx` — corrected remedy (measured, gate's fix, not mine)

Revision 1's snippet mocked only `resolveCurrentStudentId` and **still
fails** — the gate measured it: `1 of 5` tests break
(`'renders StudentHome for role "student"'` →
`expected "Couldn't find your student record…" to contain 'Hi Ada Reyes'`),
because the new own-row query still hits the real, unconfigured
`getSupabaseClient()`, which `createLoader` normalizes into a rejection
(`loader.ts:168-173`). **Fix, measured sufficient:** the mock must name
**both** resolvers —

```ts
vi.mock('../../lib/supabase/loaders/meetings', async (importOriginal) => ({
  ...(await importOriginal()),
  resolveCurrentStudentId: async () => FIXTURE_STUDENT_ID,
}));
vi.mock('../../lib/supabase/loaders/students', async (importOriginal) => ({
  ...(await importOriginal()),
  resolveStudentScope: async () => ({ teamId: FIXTURE_TEAM_ID, goalHoursOverride: null }),
}));
```

(module paths/export name adjusted to match §2b/§2c's actual final shape).
**No extra `await flushMicrotasks()` is needed** — the gate measured the
existing three flushes already cover both added async hops; revision 1's
"if needed" hedge is dropped as unnecessary, not softened. Harness-only is
sufficient — **zero assertion changes expected** (once mocked to a fixture
id, `'Hi Ada Reyes'` still renders — it's unconditionally fabricated, §2c).

**Enumeration hazard, do not walk into this:** `DashboardPage.test.tsx`'s
own `FIXTURE_ACTIVE_SEASON.defaultGoalHours` is **also `100`** — the same
number as `StudentHome.tsx`'s fabricated `FIXTURE_DEFAULT_GOAL_HOURS`. **Do
not add any assertion in `DashboardPage.test.tsx` that infers the
denominator's source from the rendered number** — it would draw the wrong
conclusion regardless of which way the bug goes. If this harness's mock
needs a `goalHoursOverride`, use `null` (harmless) and prove nothing about
sourcing here; that proof belongs in `StudentHome.test.tsx` with its own
season fixture set to a value that is **not** `100` (criterion 10 below
uses `7` for exactly this reason).

## 5. Allowed / Forbidden files

**Allowed:**
- `src/pages/home/StudentHome.tsx`
- `src/pages/home/StudentHome.test.tsx`
- `src/lib/supabase/loaders/students.ts` — **additive only.** New exports:
  a query + resolver for the student's own `team_id`/`goal_hours_override`
  by `id`. Must not change `StudentDbRow`, `TeamDbRow`, `InviteDbRow`,
  `mapStudentDbRowToStudentRow`, `queryStudents`, `makeLoadStudentsTabData`,
  `makeSetStudentActive`, `makeCreateStudent`, `makeUpdateStudent`, or any
  other existing export's name/signature/behavior. If your diff touches an
  existing line, stop and explain why before proceeding.
- `src/lib/supabase/loaders/students.test.ts` — **new file.** Scope it to
  the new function only; this is not a full coverage sweep of
  `loaders/students.ts` (no ledger row currently claims that scope — say so
  explicitly so a future reader doesn't assume it's covered).
- `src/pages/home/DashboardPage.test.tsx` — harness-only (§4). No change to
  any `it(`/`describe(` assertion in the `'coach'`/`'admin'`/`'parent'`/
  `null` cases; the student case's assertions are expected to stay
  unchanged too (§4) — if you find they must change, say exactly what and
  why.

**Forbidden (task-specific, in addition to the standing list):**
- `src/pages/home/DashboardPage.tsx`
- `src/pages/home/CoachHome.tsx`, `CoachHome.test.tsx`
- `src/pages/home/ParentHome.tsx`, `ParentHome.test.tsx`
- `src/pages/meetings/MeetingsList.tsx`, `MeetingsList.test.tsx`,
  `ScheduleMeetingsDialog.tsx`
- `src/lib/supabase/loaders/meetings.ts`, `loaders/meetings.test.ts` (does
  not exist yet — not created by this task either; that's T162's scope) —
  **moved out of Allowed Files this revision** (§2b); import from only.
- `src/lib/supabase/loaders/outreach.ts`
- `src/pages/roster/StudentsTab.tsx`, `StudentsTab.test.tsx`,
  `StudentDialog.tsx` — read-only reference for `loaders/students.ts`'s
  existing conventions; do not edit the pages that consume that loader.
- `supabase/migrations/**` — no migration needed (§2b: `students.team_id`
  and `goal_hours_override` already exist and are already readable under
  the shipped `own_or_linked_read` policy).

**Standing Forbidden list:** `docs/swarm/constitution.md`,
`docs/swarm/task-ledger.md`, `docs/swarm/verification-log.md`,
`docs/swarm/dispute-log.md`, `.claude/**`, `node_modules/`.

`DashboardPage.tsx` stays Forbidden for the same reason as revision 1: both
precedents this task mirrors (`CoachHome`/T155, `MeetingsList`/T096) resolve
identity/season entirely inside the leaf component, keeping the dispatcher
untouched.

## 6. Prescribed shape (deviate only with a stated reason in your worker output)

Same three-tier split as revision 1, with the identity-resolution tier's
job widened per §2b/§2c:

1. **`StudentHome`** (outer, keeps the name). `useAuth()` + `useActiveSeason()`
   called unconditionally. `user === null` check **first**, strictly before
   the `activeSeason.status` switch (criterion 5a). Four-way
   `activeSeason.status` switch, independently authored (mirrors
   `CoachHome`'s outer wrapper; do not import from the Forbidden
   `CoachHome.tsx`). On `ready`, renders the identity-resolution tier,
   passing `activeSeason.season.defaultGoalHours` through.
2. **Identity-resolution tier.** Props: `explicitStudentId: string |
   undefined`, `explicitTeamId: string | undefined` (bypass triggers,
   mirroring `MeetingsList`'s own `explicitStudentId !== undefined`
   pattern), `viewer: CurrentViewerIdentity`, `resolveStudentId:
   ResolveCurrentStudentIdFn`, `resolveStudentScope: ResolveStudentScopeFn`
   (new — resolves `{ teamId: string; goalHoursOverride: number | null }`
   for an already-known `studentId`; type owned by `StudentHome.tsx`,
   imported as a type by `loaders/students.ts`, mirroring the existing
   `CurrentViewerIdentity`/`ResolveCurrentStudentIdFn` cross-file shape).
   Skip this tier's mount entirely only when **both** `explicitStudentId`
   and `explicitTeamId` are supplied (matches most reworked tests, §7
   criterion 13's zero-assertion-change expectation for `DashboardPage.
   test.tsx` once mocked). Otherwise mount it; internally, compose a single
   exported pure-ish async function (name it, e.g.,
   `resolveStudentIdentity(viewer, explicitStudentId, explicitTeamId,
   resolveStudentId, resolveStudentScope)`, exported so it's independently
   unit-testable the same way `buildNextUp`/`selectHeroState` already are):
   resolve `studentId` (skip the call if `explicitStudentId` is given), bail
   to the "no student linked" empty state on `null`; then, unless
   `explicitTeamId` is given (in which case `goalHoursOverride` for this
   render is `null` — no override, an honest default for the bypass path,
   never hit by real callers), resolve `{teamId, goalHoursOverride}` via
   `resolveStudentScope(studentId)`, bail to the same empty state on `null`.
   Own loading/error/no-student-linked DES-12 states here, **each with
   copy distinguishable from the data-loading/error copy the content tier
   already has** (criterion 7) — not a re-run of T173's shared-skeleton-text
   NIT.
3. **Content tier** (e.g. `StudentHomeContent`): everything the current
   `StudentHome` body does, parameterized by real `studentId`/`teamId`/
   `seasonId`/`seasonDefaultGoalHours`/`goalHoursOverride` — the last two
   feeding `resolveGoalHours` instead of `data.defaultGoalHours`/
   `data.goalHoursOverride` (§2c).

## 7. Acceptance criteria — each with its prescribed mutation

Baselines **by reference**: run `npm run typecheck`, `npm run lint`,
`npm run format:check`, `npm run build`, and `vitest run` at your own merged
worktree tip **before** any edit, and report all five — the round-1 gate
only ran `typecheck` against its experimental build (clean), so this
packet's shape is **unverified against the other four**. Run and report all
five yourself; do not assume the others are clean. `format:check`
specifically is not a formality: T157 shipped two prettier deviations that
every other CI gate missed (that gap is what T175 exists to close) — run it
for real.

1. **Real `studentId` reaches `loadData`.** Positive, paired (not
   negative-only): spy on `loadData`, inject a distinguishable fabricated
   (item 6) `resolveStudentId` resolving to e.g. `'student-fixture-
   resolved'`; assert `loadData` was called with exactly that id.
   *Mutation:* revert to the hardcoded placeholder default; confirm red;
   restore. Mutation-provable.

2. **Explicit `studentId` prop bypasses `resolveStudentId` — paired, not
   negative-only (BLOCKER 2 fix).** Assert **both**: (a) the
   `resolveStudentId` spy was called zero times, **and** (b) `loadData` was
   called with the explicit value **and** the rendered DOM reflects a
   distinguishable, non-generic value that could only have come from the
   explicit prop path (e.g. render with two different explicit
   `studentId`s across two test cases and show the resulting content
   differs). A mutation that disables identity resolution entirely (page
   renders nothing) must fail **(b)**, since `loadData` is never called and
   nothing renders. *Mutation:* remove the bypass branch so resolution
   always fires; confirm the spy's call count goes 0→1 and (a) fails.
   *Second mutation (the vacuity probe the gate ran):* stub
   `ResolvedStudentIdentity`-equivalent to always return `null`; confirm
   (b) now fails (nothing rendered, `loadData` never called). Both
   mutation-provable.

3. **Real, resolved `teamId` reaches the team-scoped widgets — three
   distinct, non-placeholder strings (BLOCKER 1 fix).** Do **not** reuse
   this file's own shipped `FIXTURE_EVENTS`/`FIXTURE_SESSIONS` Titans-scope
   literals for the in-scope side of this proof — `PLACEHOLDER_CURRENT_
   TEAM_ID` is the in-scope id in that fixture, which is exactly why
   revision 1's version of this criterion couldn't fail. Construct your own
   fixture events/sessions with: (i) an injected `resolveStudentScope`
   resolving `teamId` to a fabricated id, e.g. `'team-fixture-alpha'`; (ii)
   an in-scope event whose `teamIds` includes `'team-fixture-alpha'`; (iii)
   an excluded event whose `teamIds` is a **different** fabricated id, e.g.
   `'team-fixture-beta'` — all three strings distinct from each other and
   from `PLACEHOLDER_CURRENT_TEAM_ID`. Assert the in-scope session renders
   and the excluded one doesn't. *Mutation:* revert to
   `PLACEHOLDER_CURRENT_TEAM_ID`; confirm this now genuinely fails (the
   in-scope event no longer matches the resolved, differently-valued team
   id). Mutation-provable.

4. **Explicit `teamId` prop bypasses `resolveStudentScope` entirely —
   paired, same shape as criterion 2 (BLOCKER 2 fix, extended).** Assert
   the spy was called zero times **and** the rendered team-scope outcome
   reflects the explicit value (not a resolved one), using the same
   three-distinct-string discipline as criterion 3. Both the "always calls
   the seam" mutation and the "identity tier disabled → blank page" vacuity
   probe must fail this criterion's positive half. Mutation-provable.

5. **Ordering.** (a) `user === null` strictly precedes the
   `activeSeason.status` switch — *mutation:* move the null check inside
   the `'ready'` branch; confirm the synchronous sign-in-prompt test now
   shows the season-loading skeleton instead. Mutation-provable. (b) The
   season switch precedes identity-resolution mounting — **label this
   STRUCTURAL, not mutation-provable** (MAJOR 8): it's a direct consequence
   of the identity tier being a child rendered only inside the `'ready'`
   case, not a separately-testable runtime behavior. State this plainly in
   your output; do not write a test that can only pass vacuously for it.

6. **`seasonId` sourced from `useActiveSeason()`.** (a) Fail-loud probe
   outside `<SeasonProvider>` throws exactly `'useActiveSeason() must be
   called within a <SeasonProvider>.'`. Mutation-provable as in T155's own
   criterion 4. (b) `loadData` receives the real season id — **assert the
   `seasonId` argument in isolation** (`loadData.mock.calls[0][1]`), not
   the full call signature (MAJOR 8: revision 1's combined assertion went
   red for `studentId` reasons on six of fourteen tests during the gate's
   mutation 1, which is the wrong criterion reporting the wrong failure).
   *Mutation:* revert to the defaulted `seasonId` parameter; confirm only
   this criterion's isolated assertion goes red. Mutation-provable,
   positive+paired.

7. **Identity-resolution tier's own DES-12 states — three independent
   sub-mutations, not one (MINOR fix — the gate found the null-case
   survives a mutation aimed at the copy-collision case, so they are not
   redundant and must be reported separately).** (i) loading: never-
   resolving `resolveStudentId`/`resolveStudentScope`; assert this tier's
   own loading text, distinct from "Loading Home…". (ii) error: reject;
   assert a distinct error banner with a working Retry. (iii) null (no
   linked student): resolve `null`; assert a distinct EmptyState. Each
   independently mutation-provable; report all three separately, not as one
   combined pass/fail.

8. **The new own-row query is scoped only by the resolved student's own
   id.** Stubbed-client test asserting the exact `.eq('id', studentId)`
   args reaching the stub (mirrors T157's checker's own filter-guard
   technique). **The stub must expose `.maybeSingle()` (or your chosen
   terminal method) at both the filtered and unfiltered chain positions**
   (MINOR: the gate found a stub missing this fails via a misdirecting
   `TypeError: ...maybeSingle is not a function` instead of the intended
   assertion when `.eq(...)` is dropped) — build the stub so the mutation
   fails on the *intended* assertion, and confirm that in your report, not
   just that it's red. *Mutation:* drop the `.eq(...)` filter; confirm the
   guard assertion (not a `TypeError`) fails. Mutation-provable. Paired,
   **inspection-only, not mutation-provable, label it as such**: confirm by
   diff review that no new role/family authorization logic was added
   anywhere — RLS (`own_or_linked_read`) is the sole authorization boundary.

9. **No metric-math re-derivation (constitution item 3). Inspection-only,
   not mutation-provable, label it as such.** `resolveGoalHours`,
   `hoursVsGoalPercent`, `computePlannedHours`, `buildNextUp`,
   `getUnansweredOutreachOpportunities`, `selectLiveMeetingSession`
   function *bodies* byte-unchanged; only call-site argument sourcing
   changes (including, this revision, which values feed
   `resolveGoalHours` — §2c).

10. **The goal-hours denominator is real across all three DOM surfaces
    (§2c, §3 decision 1) — NEW criterion.** Enumerate over
    `container.innerHTML`, not `textContent` (MAJOR 5 — `textContent`
    strips `aria-valuemax`/`aria-valuetext`). Use a `StudentHome.test.tsx`-
    local `SeasonProvider` fixture with `defaultGoalHours` set to a value
    **other than `100`** (e.g. `7`) — deliberately distinct from both
    `StudentHome.tsx`'s own fabricated `FIXTURE_DEFAULT_GOAL_HOURS` and
    `DashboardPage.test.tsx`'s `FIXTURE_ACTIVE_SEASON.defaultGoalHours`
    (both `100`), so a test that renders the real value can't be
    coincidentally satisfied by the fabricated one. Cover both a `null`
    `goalHoursOverride` (falls to the season default) and a real override
    number (wins over the season default) — mirrors `resolveGoalHours`'s
    own existing pure-function test at `:519-522`, now proven live. Assert
    the visible label, `aria-valuemax`, and `aria-valuetext` all reflect
    the real value. *Mutation:* revert to reading `data.defaultGoalHours`/
    `data.goalHoursOverride` for this computation; confirm all three
    surfaces regress to the fabricated `100`. Mutation-provable,
    positive+paired.

11. **Render-and-enumerate, live, over `innerHTML` — not a re-trace of code
    (unchanged requirement from revision 1, scope corrected).** With real
    `studentId`/`teamId`/`seasonId`/`goalHoursOverride`/
    `seasonDefaultGoalHours` and the **default** `loadData`
    (`defaultLoadStudentHomeData`), render end-to-end and confirm or correct
    the gate's own measured enumeration below (attributed to the gate,
    **measured** at `e375489`, not the foreman's prediction this time):

    | # | String | Origin | Verdict |
    |---|---|---|---|
    | 1 | `Hi Ada Reyes` | `displayName` literal, ignores both params | **stays fabricated** — lead item, §3 decision 2 |
    | 2 | `0 / 100 h (0%)` visible label | `FIXTURE_DEFAULT_GOAL_HOURS` | **fixed by criterion 10** — confirm it now reads the real value |
    | 3 | `aria-valuemax="100"` | same field | **fixed by criterion 10** |
    | 4 | `aria-valuetext="0 / 100 h (0%)"` | same field | **fixed by criterion 10** |
    | 5 | `0 h confirmed + 0 h planned` | `studentHours` → `null` | honestly empty |
    | 6 | `Participation: —` | `participation` → `null` | honestly empty |
    | 7 | `Nothing scheduled` + helper copy | `events` → `[]` | honestly empty |
    | 8 | `You're all caught up` (Sign-up opportunities `EmptyState`) | `opportunities` → `[]` | honestly empty |
    | 9 | `You're all caught up. Nothing needs your attention right now.` (quiet-greeting hero) | `selectHeroState(false, 0)` | honestly empty, but state explicitly that it's a positive-reassurance string where the app in fact knows nothing — don't omit that judgement |
    | 10 | *(absent)* live check-in / unanswered-RSVP hero, all list rows | joins miss once `events` is `[]` | honestly empty |

    **Enumeration hazard:** row 8 and row 9 are both literally `You're all
    caught up` — a single `toContain('You\'re all caught up')` assertion
    cannot distinguish them. Scope your query to the specific section
    (e.g. by heading/`aria-labelledby` group, already wired for T129/
    UXC-01) rather than a bare substring match if you need to assert on
    one and not the other.

12. **File the follow-ups (item 20) — two, not one.**
    (a) `StudentHome`'s T173-sibling row: lead with `Hi Ada Reyes` (§3
    decision 2), then the rest of your criterion-11 enumeration, then
    `LoadStudentHomeDataFn` having no real implementation beyond the one
    field criterion 10 lands.
    (b) The `student_teams` follow-up (§2b): `StudentHome` scopes off the
    legacy `students.team_id` primary-team path, not `student_teams` ACTIVE
    memberships; a dual-team-member student silently loses her second
    team's meetings/live-check-in/sign-up-opportunities, the same class
    T120 already fixed on `ParticipationTab`.
    **Label both non-mutation-provable — they're documentation
    deliverables, not tests (MAJOR 8).**

13. **`DashboardPage.test.tsx`'s existing five tests stay green (§4).**
    **Label non-mutation-provable — a no-regression check, not a new
    behavior (MAJOR 8).** Report the exact diff and confirm zero assertion
    changes were needed, or explain precisely what had to change and why.

14. **State the blast radius (§3 decision 3, MAJOR 7).** In your worker
    output, before diving into individual test fixes: **13 of 33**
    `StudentHome.test.tsx` tests break (all render-path tests; the 20
    pure-function tests, `isEventInTeamScope` through `withLocalRsvpOverride`,
    are unaffected) and need harness-level fixes — add `<SeasonProvider>`
    and identity-resolution mocking to `renderAsUser`, mirroring
    `CoachHome.test.tsx`'s own T155-era harness change — not per-test
    assertion rewrites. **`DashboardPage.test.tsx`: 1 of 5** (§4). If your
    actual numbers differ from these, say so and explain the delta; these
    are the gate's measured baseline against its own experimental build,
    not a guarantee against your final implementation.

## 8. Worker/checker tier — unchanged reasoning from revision 1

**Worker: sonnet.** Item 18's four triggers, walked explicitly: no
migration, no RLS/`security definer` change, no metric-SQL view change.
"Changes auth/session/role-resolution/permission logic" — still judged not
to fire: the new query is a single own-row read of a column already
reachable to staff via `loaders/students.ts`'s existing `queryStudents`,
RLS-enforced identically whether or not this task's TypeScript gets the
filter right (§7 criterion 8's inspection half), and it follows the
literal, un-escalated precedent (`resolveCurrentStudentId`/T096) rather than
overriding it. Narrower than T157's own new cross-family `guardian_links`
read, which *was* escalated as a judgment call. Flag to the checker if this
reasoning is wrong — recorded, not assumed either way.

**Checker: `checker-reviewer`, opus.** Unchanged reasoning: matches T155's
template, and this task's hardest failure mode (criteria 10/11, live
render-and-enumerate over `innerHTML`) is exactly the class of judgment that
needed opus's rigor project-wide, on this exact sibling component, twice
already (revision 1's own §2c predictions were wrong on scope — the gate
caught it, not a re-trace).

Checker instructions, extended this revision: independently re-run **all
14** criteria's mutations, not a sample; specifically re-run the vacuity
probe (identity tier disabled → blank page) against criteria 2 and 4's
final implementation, since that's the exact probe that found BLOCKER 2;
re-render criterion 10 with your own season-fixture value (not `7` if the
worker also used `7` — pick a third distinct number, so a checker-side
coincidence can't mask a worker-side bug the same way `100`/`100` almost
would have); verify `format:check` actually passes, not just that the
worker claims it does (T157's own checker is the reason this project knows
CI can stay green while `format:check` breaks).

## 9. Required worker output

- All five gate commands run and reported individually (typecheck, lint,
  format:check, build, vitest) — §7 preamble.
- Criterion 14's actual numbers, stated explicitly, with any delta from the
  gate's baseline explained.
- Full `container.innerHTML` dump for criterion 11, with the enumeration as
  its own labeled section, confirming or correcting each row of the gate's
  table above.
- Every mutation's actual command/diff and actual failure output for every
  criterion marked mutation-provable; explicit statements for every
  criterion marked structural/inspection-only/non-mutation-provable.
- The exact `DashboardPage.test.tsx` diff, with reasoning.
- The exact text of both follow-up ledger rows (criterion 12a/12b).
- Any deviation from §6's prescribed shape, and why.
