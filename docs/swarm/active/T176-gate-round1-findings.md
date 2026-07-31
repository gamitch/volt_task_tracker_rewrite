# T176 — narrow premise gate round 1 (verbatim required revisions)

**Gate:** general-purpose agent acting as a narrow gate, 2026-07-30, measured at `e375489`.
**Verdict:** REVISE — 2 BLOCKER, 6 MAJOR, 1 MINOR set. **Round 2 of 2 remains available** (item 19a).

Dispatched with **Write + Edit** deliberately: `checker-premise` has Bash but cannot write, which
is why T157's gate could not run its prescribed mutations. This gate **built the packet's §6
prescribed shape, wrote all 12 criteria as tests, and ran every mutation**, then reverted
everything. Worktree confirmed clean at `e375489`, suite back to 66 files / 1567 tests green.

Recorded here because the report existed only in an agent transcript. **Owner-authority check
came back clean** — `grep "StudentHome\|T176" auto-mode-decisions.md` → no matches, exactly as the
packet states. No falsely-promoted decision.

## BLOCKER 1 — criterion 3 is mathematically incapable of failing

The packet steers the worker to *"reuse this file's own Titans-only team-scope-exclusion fixture
pattern"*, then mutates by *"revert to the hardcoded `PLACEHOLDER_CURRENT_TEAM_ID`"*. In that
fixture the **in-scope** id *is* `PLACEHOLDER_CURRENT_TEAM_ID` (`StudentHome.tsx:805`, `:813`);
the excluded id is `'team-titans'` (`:823`). The injected "real" value and the mutation's
hardcoded value are **the same string**. Measured, both variants written and run:

```
===== MUTATION 3: const teamId = PLACEHOLDER_CURRENT_TEAM_ID =====
 ✓ C3 > (a) AS THE PACKET WORDS IT -- reuses this file's own Titans fixture pattern
 × C3 > (b) with a DISTINGUISHABLE resolved team id
```

The variant the packet's own sentence produces **stays green under the packet's own mutation.**

**Fix:** require the injected `resolveTeamId` value, the in-scope event's `teamIds`, and the
excluded event's `teamIds` to be **three distinct strings, none equal to
`PLACEHOLDER_CURRENT_TEAM_ID`**, and forbid reusing shipped fixture ids for the in-scope side.

## BLOCKER 2 — criteria 2 and 4 are negative-only and pass with the feature switched off

Both are prescribed as *"assert the spy was called zero times"*, unpaired. Vacuity probe —
`ResolvedStudentHomeView` returns `null`, so identity resolution never happens and the page
renders **nothing**:

```
===== VACUITY PROBE: identity tier disabled, container.textContent === '' =====
 ✓ C2 > AS PRESCRIBED (negative-only): resolveStudentId spy called zero times
 ✓ C4 > AS PRESCRIBED (negative-only): resolveTeamId spy called zero times
 × C2 > PAIRED variant the packet does not require
      Tests  8 failed | 6 passed (14)
```

They also pass if the bypass drops the value, passes `undefined`, or renders an error state.

**Fix:** pair each with a positive assertion on `loadData`'s received value **and** on rendered
content, e.g. `expect(loadData).toHaveBeenCalledWith('student-explicit-prop', REAL_SEASON.id)`
plus `expect(container.textContent).toContain('Hi Bex Nolan')`.

## MAJOR 3 — "a student has exactly one team" is false; a shipped migration contradicts it

`supabase/migrations/20260721000000_student_teams.sql` (T113 / PRD v2 SCH-01) ships a
`student_teams` junction — its own header, verified verbatim: *"a student may belong to more than
one team"* and `students.team_id` *"remains the legacy/primary-team read path until a later
SCH-03+ packet migrates readers over to this junction."*

**Every other reader has already migrated:** `membership_views.sql:63` (`v_student_participation`),
`:92` (`v_team_hours`), `dashboard_views.sql:205-206`, `kpi_views.sql:256`. `ParticipationTab.tsx:228`
records the SCH-03 migration and carries a purpose-built dual-member fixture; `checkin.ts:128`
discloses a live `.limit(1)` gap that *"arbitrarily picks one TEAM's row for a dual member"*.

**Behavioural consequence, not just prose:** `StudentHome`'s only team predicate is
`isEventInTeamScope(event, teamId)` (`StudentHome.tsx:531-535`) — a **single** `teamId` tested
against `event.teamIds`. It gates `selectLiveMeetingSession` (`:556`), `buildNextUp` (`:589`) and
`getUnansweredOutreachOpportunities` (`:644`). So resolving the primary `students.team_id` means a
dual-member student **silently loses her second team's meetings, live check-in and sign-up
opportunities** — the same defect class T120 already fixed once on `ParticipationTab`.

Still the right thing to ship for T176 (the junction is a wider refactor and `students.team_id` is
the documented legacy path), but the packet must: delete the "exactly one team" claim; disclose the
primary-team narrowing as deliberate, citing the migration's own sentence; and **file a follow-up**
for moving `StudentHome`'s scoping onto `student_teams` ACTIVE memberships.

**Note this originated in the orchestrator's brief**, which asserted the team is resolvable because
`students.team_id` is not-null. Resolvable: correct. Single-valued: wrong.

## MAJOR 4 — `loaders/students.ts` exists; the packet says it does not

Packet §3.2 claims the students query *"lives in `loaders/outreach.ts:756-768`, not a shared
`loaders/students.ts` — **no such file exists**."* Measured: `src/lib/supabase/loaders/students.ts`
is **309 lines**, with `StudentDbRow.team_id: string` (`:103`), `queryStudents` (`:176`), and
`mapStudentDbRowToStudentRow` mapping `teamId: row.team_id` (`:144`). `loaders/teams.ts` is 350
lines. Both exist.

This sits in the section claiming *extra* verification rigor, and it props up §2b's decision to add
the new function to `loaders/meetings.ts`. **Re-open the placement decision** with the real option
set — `loaders/students.ts` is arguably the more natural home for an own-row `students` read.

## MAJOR 5 — the fabricated goal denominator has three DOM surfaces, and the honest value is already in hand

The packet predicted *"only the one surface"*. Measured: no second **visible-text** surface, but two
additional **accessible-name** surfaces, so a screen-reader user hears the fabricated number twice
more:

| Surface | Value |
|---|---|
| visible ProgressBar label | `0 / 100 h (0%)` |
| `aria-valuemax` | `100` |
| `aria-valuetext` | `0 / 100 h (0%)` |

**Criterion 10 must enumerate over `container.innerHTML`, not `textContent`.**

**And the residual is avoidable inside T176's own reach.** MET-04's denominator is
`goal_hours_override ?? season default_goal_hours`, and `season.defaultGoalHours` is a **real
Supabase-backed value** (`seasons.default_goal_hours` → `loaders/seasons.ts:137`, `:150`) already
loaded by `SeasonProvider` and handed to `StudentHome` by the very `useActiveSeason()` call §6
prescribes. Proof — re-rendered with the season's `defaultGoalHours` set to `7`:

```
season.defaultGoalHours = 7  →  screen still reads "0 / 100 h (0%)", aria-valuemax="100"
```

The fixture's `100` wins; the real value is ignored. §2c frames this as unfixable without a real
loader. That ground is false. Either bring it into scope or decline it **with accurate reasoning**.

⚠️ `DashboardPage.test.tsx`'s `FIXTURE_ACTIVE_SEASON.defaultGoalHours` is **also 100**, so any test
inferring the value's source from the rendered number will draw the wrong conclusion.

## MAJOR 6 — the `DashboardPage.test.tsx` remedy is insufficient as written

Trap confirmed: `grep -c "vi.mock"` → **0**; post-fix **exactly 1 of 5** tests breaks
(`× renders StudentHome for role "student"` → `expected "Couldn't find your student record…" to
contain 'Hi Ada Reyes'`), because `getSupabaseClient()` throws `SupabaseNotConfiguredError`,
normalised by `createLoader` (`loader.ts:168-173`) into a rejection.

**§4's snippet mocks `resolveCurrentStudentId` only, and still fails** — the new team resolver still
hits real Supabase. Adding it fixes it completely:

```
+ resolveStudentTeamId: async () => 'team-fixture-dashboardpage',
→ ✓ src/pages/home/DashboardPage.test.tsx (5 tests)
```

Harness-only **is** sufficient — zero assertion changes — and **no extra `flushMicrotasks()` is
needed**; the existing three flushes already cover both added async hops, so §4's "if needed" hedge
is measured unnecessary. The snippet must name **both** resolvers.

## MAJOR 7 — undisclosed blast radius

With the fix in place and no other file touched:

```
 ❯ src/pages/home/StudentHome.test.tsx (33 tests | 13 failed)
   — all: "useActiveSeason() must be called within a <SeasonProvider>."
 Test Files  1 failed | 67 passed (68)
```

**`StudentHome.test.tsx`: 13 of 33 break** (every render-path test; the 20 pure-function tests are
unaffected). `DashboardPage.test.tsx`: 1 of 5. **Nothing else in the repo breaks.** Both are
harness-only fixes, but the packet gives no expected number — and 13 of 33 is precisely the size at
which a worker starts rewriting assertions instead of the harness. **State it.**

## MAJOR 8 — criteria entangled and mislabelled

- **Criterion 5 clause 3** ("the season switch precedes identity resolution") has no prescribed
  test, and the obvious one is vacuous by the probe above. Structurally the identity tier is a child
  rendered only in the `'ready'` branch, so this is a type-level consequence. Mark it structural or
  drop it. (Clause 1 **is** provable: moving the null check into `'ready'` →
  `× expected 'Loading the active season…' to contain 'Sign in to view Home'`.)
- **Criterion 6(b)** asserts `loadData` was called with `(resolvedStudentId, realSeasonId)`, so it
  goes red under a `studentId` regression — a `seasonId` criterion failing for a `studentId` reason.
  Six of fourteen tests went red on mutation 1 alone. Assert the `seasonId` argument in isolation
  (`loadData.mock.calls[0][1]`).
- **Criteria 11 and 12 are not mutation-provable and are not labelled**, unlike 8/9/10 which are
  correctly labelled. C11 ("state the exact ledger-row text") is a documentation deliverable; C12 is
  a no-regression check.

## MINOR set

- Criterion 8's stub needs `maybeSingle` exposed at **both** chain levels — dropping `.eq('id', …)`
  currently goes red via `TypeError: client.from(...).select(...).maybeSingle is not a function`
  rather than the intended `eqSpy` assertion. Red, but the message misdirects.
- `PLACEHOLDER_SEASON_ID` is **not exported** (`StudentHome.tsx:518`), unlike the other two
  placeholders (`:516-517`). Criterion 6(b) cannot import it — export it or hardcode the literal.
- §5 lists `StudentIdDbRow` and `GuardianLinkStudentIdDbRow` among *"existing exports"* of
  `meetings.ts`; both are module-private interfaces (`:253`, `:257`).
- Criterion 7's three sub-mutations are independent, not one — the **null** sub-case correctly
  survives the copy-collision mutation. Say so.

## Measured post-fix DOM — the enumeration, for criterion 10 and the follow-up row

Rendered as a student with a real season (`11111111-…`), resolved student `22222222-…`, resolved
team `33333333-…`, default fixture loader, `nowFn = FIXTURE_REFERENCE_NOW`.

| # | Exact string on screen | Origin | Verdict |
|---|---|---|---|
| 1 | `Hi Ada Reyes` | `defaultLoadStudentHomeData.displayName` literal (`:903-918`), **ignores both params** | **STAYS FABRICATED** — a fabricated human name shown to every real signed-in student, unconditionally |
| 2 | `0 / 100 h (0%)` | `FIXTURE_DEFAULT_GOAL_HOURS = 100` → `resolveGoalHours` → `formatValueLabel` (`:1284`) | **denominator fabricated**; `0` and `(0%)` honest |
| 3 | `aria-valuemax="100"` | same field | **STAYS FABRICATED** — packet missed |
| 4 | `aria-valuetext="0 / 100 h (0%)"` | same field | **STAYS FABRICATED** — packet missed |
| 5 | `0 h confirmed + 0 h planned` | `studentHours` → `null` (fixture gated on the placeholder) → `?? 0` | honestly empty |
| 6 | `Participation: —` | `participation` → `null` → `'—'` (`:1288`) | honestly empty |
| 7 | `Nothing scheduled` + helper copy | `events` filtered to `[]` → `buildNextUp` → `[]` | honestly empty |
| 8 | `You're all caught up` + helper copy | `getUnansweredOutreachOpportunities` → `[]` | honestly empty |
| 9 | `You're all caught up. Nothing needs your attention right now.` | `selectHeroState(false, 0)` → `quiet-greeting` | honestly empty, but it is a positive reassurance where the app knows nothing — require the worker to state that judgement rather than omit the string |
| 10 | *(absent)* `LiveCheckInCard`, `UnansweredRsvpHero`, all `List` rows | `sessions`/`rsvps` unfiltered but every `eventById.get()` misses | honestly empty |

⚠️ `You're all caught up` appears **twice** (rows 8 and 9) — a `toContain` assertion cannot
distinguish them.

## What the gate did not do

Did not re-verify the `meetings.ts`/`MeetingsList.tsx` type-split citations or the
`CoachHome`/`DashboardPage` module-doc line hints — outside the three narrow questions. Did not run
`lint`, `format:check` or `build` against its experimental implementation (only `typecheck`, clean),
so the packet's shape is unverified against those three gates.
