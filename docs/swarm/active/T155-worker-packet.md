# Worker Packet: T155 — wire `CoachHome` to the real active season

**Revision 3 — this is the version that ships. Read this note before anything
else.** Revision 1 gated REVISE (3 MAJORs, a 4th relayed alongside). Revision 2
gated REVISE again (1 MAJOR, 6 MINOR, 4 NIT). **Constitution item 19a's
two-round cap is now spent — there is no round 3 gate.** This revision goes
straight to a worker. Every correction below either comes from something I
re-verified myself by reading the live tree (I have no Bash — I could not
execute anything, only read), or is explicitly attributed to the round-2
premise gate's own executed measurement, relayed by the coordinator and
carried here as measured, not re-derived by me. Where I found the coordinator's
own relay to be *itself* imprecise against what I could independently read, I
say so and use my own reading instead — noted inline at that one spot.

**Round 2's MAJOR is below, and it is worse than the two residuals revision 2
already disclosed — not a new defect, the same one, in a place that outranks
both.** Read "The second finding" section in full; "two" has become "three"
throughout this packet for that reason.

**Priority: live, user-visible production failure.** The owner supplied
DevTools screenshots; root cause is confirmed from the actual 400 response
body, not inferred.

## The bug, confirmed from the response body

```json
{"code": "22P02", "message": "invalid input syntax for type uuid: \"season-placeholder-current\""}
```

`CoachHome.tsx:1997` declares `seasonId = PLACEHOLDER_SEASON_ID` (`:654` =
`'season-placeholder-current'`). `DashboardPage.tsx:120` renders
`<CoachHome />` with **no props**, so that placeholder string reaches
`.eq('season_id', …)` on eight real Supabase queries in
`src/lib/supabase/loaders/dashboard.ts` — `queryRosterStats`,
`queryAttendanceRate`, `querySessionDays`, `queryUpcomingCommittedHours`,
`queryDayOfWeekSessions`, `queryTeamHours`, `queryTopEvents`,
`queryGoalProjection` (each `.eq('season_id', seasonId)`, verified by
re-reading the file) — plus a ninth, `queryFeedEvents`
(`.from('events').eq('season_id', seasonId)`). Postgres rejects all nine with
`22P02`, since none of them is a valid UUID. This is what
`loadDashboardDataProp` (`CoachHome.tsx:1996`, defaulting to the real
`loadDashboardData` from that same loader file) fires on every mount.

**Migrations are not implicated — re-confirmed, not just repeated.** The
failures are 400, not 404; the views exist. Two sibling views,
`v_season_kpis`/`v_season_kpi_team_counts` (consumed by `KpiStrip`, a
different component — see below), return 200 for the same request because
they receive a real season id.

## Root cause of the asymmetry — why the KPI strip works and the page below it doesn't

`KpiStrip.tsx:133` imports `useActiveSeason` from `../../app/SeasonProvider`
and switches on its `status` (`KpiStrip.tsx:160-188`) before ever mounting the
child that fires a query. `CoachHome` has no equivalent: it takes `seasonId`
as an optional prop defaulting to the placeholder and fires
`loadData(seasonId)`/`loadDashboardDataProp(seasonId)` unconditionally, every
render, regardless of whether a real season has resolved.

`useActiveSeason()` (`SeasonProvider.tsx:117-121`) returns a discriminated
union — `{status:'loading'}` | `{status:'ready';season:SeasonRow}` |
`{status:'none'}` | `{status:'error';error:SupabaseLoaderError}` — plus
`refresh()`. `SeasonRow.id` (`src/lib/supabase/types.ts:129`) is the real
UUID. `AppShell.tsx` mounts `<SeasonProvider>` around its entire non-chromeless
branch (`:159-168`, T091/T140), and `DashboardPage`'s route ("/") is only ever
reached inside that branch — confirmed by reading `AppShell.tsx` directly, not
assumed — so `CoachHome` is always rendered inside a live `SeasonProvider` in
production. **Nothing needs to change in `AppShell.tsx`, `SeasonProvider.tsx`,
or `DashboardPage.tsx` to make `useActiveSeason()` available to `CoachHome`.**

## Read before you design anything: T140 and T141

T140 gave `AppShell`/`KpiStrip` this exact wiring and its round-1 premise gate
returned MAJOR on precisely the trap this task now walks into: **"the test
approach does not transfer."** `KpiStrip`'s season-consuming child
(`KpiStripContent`) only mounts in the `case 'ready':` branch
(`KpiStrip.tsx:184-187`); a test that renders `KpiStrip` without also
resolving `activeSeason` to `'ready'` sits on the season-level error/none
state and the seam under test never fires. T141 then found that T140's own
regression *guard* was vacuous: wrapping a chromeless route in
`<SeasonProvider>` (the literal forbidden regression) left **all 23 existing
tests green**, because `SeasonProvider` is DOM-transparent
(`SeasonProvider.tsx:208`, `<SeasonContext.Provider>{children}</...>`, nothing
else) and nothing on that branch calls `useActiveSeason()`. The only thing
that can detect "wrapped vs. not" is a probe that calls the hook itself and
observes whether it throws.

Both lessons apply directly here, in the opposite direction from T140/T141's
own task (which added a provider; this task adds a *consumer*):

1. **Any test proving `loadData`/`loadDashboardData` receive a real season id
   must first resolve `useActiveSeason()` to `'ready'`** (inject
   `loadActiveSeason` into a wrapping `<SeasonProvider>`), the same way
   `KpiStrip.test.tsx:91-105` and `AppShell.test.tsx:298-312` already do.
   Asserting against the loading/none/error states doesn't reach the code path
   this bug lives in.
2. **`CoachHome` rendered without a `<SeasonProvider>` ancestor must now
   throw** the fail-loud `useActiveSeason() must be called within a
   <SeasonProvider>.` message (`SeasonProvider.tsx:216-218`). That is new,
   correct, and required — it is the only observable proof `CoachHome`
   genuinely consumes the shared context rather than merely importing it. Test
   for it the same way T141 did: assert the exact message, plus a companion
   case proving the same probe does *not* throw when a provider is present, so
   the first assertion can't pass because the probe itself is broken.

## Design — outer season-status wrapper, same shape as `KpiStrip`

Split `CoachHome` into an outer wrapper (season-status dispatch only) and an
inner content component (everything that exists today). This mirrors
`KpiStrip`/`KpiStripContent` exactly and is the smallest change that makes
"season not resolved yet" a real, representable state — which does not exist
today. Today, `loadData`/`loadDashboardData` fire on **every** render,
including while `user` is still resolving; nothing gates them on season
readiness because there is no season concept in this component at all.

**Split point:** `CoachHome.tsx:2001` (`const { user } = useAuth();`) stays in
the outer wrapper, immediately followed by `const activeSeason =
useActiveSeason();`. Everything from `:2002` (`const navigate =
useNavigate();`) through the function's closing brace (currently the rest of
the ~600-line body) becomes a new inner component — suggested name
`CoachHomeContent` — taking `user` (non-null `AuthUser`), `seasonId` (now
**required**, not optional-with-placeholder-default), `teamId`, `loadData`,
`loadDashboardData`, and `nowFn` as props. No logic inside that body changes;
only where `user` and `seasonId` come from changes (props instead of
`useAuth()`/a defaulted parameter).

**The `user === null` check MUST run before the `activeSeason.status`
switch — not after, and not merged into it.** This was already the design
intent in revision 1 but is now a hard, tested requirement: the gate built the
reordered version and it fails an existing test —
`CoachHome.test.tsx:1024`, `it('shows a sign-in prompt', ...)`, which renders
synchronously with no `flushMicrotasks()` and asserts `'Sign in to view
Home'` immediately. `<SeasonProvider>`'s own initial state is always
`{status:'loading'}` on the very first synchronous render regardless of who
the user is (`SeasonProvider.tsx:177`), so if the season switch ran first, that
test's first paint would show the season-loading skeleton (`'Loading
Home…'`) instead — measured failure: `expected 'Loading Home…' to contain
'Sign in to view Home'`. Keep the null check first.

Outer `CoachHome`:

```tsx
export function CoachHome({
  loadData = defaultLoadCoachHomeData,
  loadDashboardData: loadDashboardDataProp = loadDashboardData,
  teamId = PLACEHOLDER_CURRENT_TEAM_ID,
  nowFn = () => new Date(),
}: CoachHomeProps = {}): ReactNode {
  const { user } = useAuth();
  const activeSeason = useActiveSeason();

  if (user === null) {
    return ( /* existing "Sign in to view Home" EmptyState, unchanged */ );
  }

  switch (activeSeason.status) {
    case 'loading':
      return ( /* loading skeleton — see below */ );
    case 'none':
      return ( /* Banner, mirrors KpiStrip.tsx:163-172 copy pattern */ );
    case 'error':
      return ( /* Banner + Retry, mirrors KpiStrip.tsx:173-183 exactly */ );
    case 'ready':
      return (
        <CoachHomeContent
          user={user}
          seasonId={activeSeason.season.id}
          teamId={teamId}
          loadData={loadData}
          loadDashboardData={loadDashboardDataProp}
          nowFn={nowFn}
        />
      );
  }
}
```

**`CoachHomeContentProps.user: AuthUser` needs a type import that isn't
currently in this file.** `CoachHome.tsx:527` imports only the `useAuth`
function (`import { useAuth } from '../../app/guards';`). Change it to
`import { useAuth, type AuthUser } from '../../app/guards';` — without it,
typing the new inner component's `user` prop is `TS2304: Cannot find name
'AuthUser'`.

**Remove `seasonId` from `CoachHomeProps` entirely** — do not keep it as a
test-only override. No test in `CoachHome.test.tsx` or `DashboardPage.test.tsx`
currently passes `seasonId` as a render prop (grep-verified:
`renderAsUser\([^)]*seasonId` matches nothing in either file); every test that
needs a specific season id can supply it via an injected `loadActiveSeason`
resolving a fixture `SeasonRow` with that `.id`, exactly like
`AppShell.test.tsx:89-97`'s `T140_FIXTURE_SEASON`. Keeping a dead prop that
production never sets is the shape of the bug this task exists to close —
don't reintroduce it as an escape hatch.

**Two behavior changes this split causes, both improvements — disclose both,
don't let a checker discover them and mistake either for a regression:**

1. **`loadData`/`loadDashboardData` currently fire even when `user === null`.**
   Today, every hook in the function body — including the two `useLoadState`
   calls — runs before the `user === null` early return (rules-of-hooks: hooks
   can't be skipped, only the returned JSX can differ), so a signed-out render
   still fires both fetches. After the split, `CoachHomeContent` (and the
   fetches inside it) only mounts once `user !== null` **and**
   `activeSeason.status === 'ready'` — the signed-out path no longer fires
   either fetch at all. State the before/after call counts for the "signed out"
   case in your output doc.
2. **`useMilestoneToasts`'s dedupe key changes namespace.**
   `milestoneToastStorageKey(seasonId, milestone)` (`:1705-1706`) builds
   `` `volt.home.milestoneToast.${seasonId}.${HOME_HOURS_GOAL_BAR_ID}.${milestone}` ``.
   Today `seasonId` is always the same placeholder constant, so every real
   season a coach ever sees shares one dedupe namespace — a latent bug
   (crossing a milestone in season A would suppress the same milestone's toast
   in season B forever). After this fix, each real season gets its own
   namespace, which is correct, not a side effect to paper over. Any
   previously-fired-and-dismissed toast under the old placeholder key becomes
   inert dead `localStorage`, harmless, not cleaned up by this task (same
   "disclosed, not built" posture as T154's key-accumulation note).

### Loading / none / error copy — use these literals, not a paraphrase

Reuse `KpiStrip.tsx:160-188`'s three-state *content* shape (KpiStrip already
established this project's convention for a season-level `'none'`/`'error'`
state — don't re-derive the copy), but **not its wrapper markup.** Resolving
an ambiguity the round-2 gate flagged and I re-verified directly: `KpiStrip.tsx`
wraps both its `'none'` and `'error'` `Banner`s in `<Section padding={3}
dividers={['bottom']}>` (read-verified, `:165-171` and `:175-183`). Importing
that wrapper into `CoachHome.tsx` would reintroduce exactly what
`CoachHome.tsx:2016-2023`'s own comment records as a **T129 checker fix
(MAJOR)**: `Section` applies an unconditional full-bleed negative-margin band
that bleeds past this page's padded `LayoutContent`, and renders a bare,
role-less `<div>`. `Section` is not imported anywhere in `CoachHome.tsx` today
(grep-confirmed — the only two hits for the string `Section` in the whole file
are inside that T129 comment itself). So:
- `'none'`: `Banner status="info" title="No active season yet"` with
  description text adapted from KpiStrip's ("An admin needs to create and
  activate a season in Season settings before Home can show data here.") —
  **`Banner` only, no `Section` wrapper.**
- `'error'`: `Banner status="error" title="Couldn't load the active season"
  description={activeSeason.error.message}
  endContent={<Button variant="ghost" label="Retry"
  onClick={activeSeason.refresh} />}` — the `Banner`'s own prop shape matches
  `KpiStrip.tsx:173-183` verbatim; **its `<Section>` wrapper does not.** Cite
  the T129 fix (`CoachHome.tsx:2016-2023`) in your own comment if you add one,
  rather than re-deriving new justification prose.
- `'loading'`: reuse or closely mirror the existing DES-12 loading skeleton at
  `CoachHome.tsx:2063-2091` (aria-busy, `VisuallyHidden role="status"`,
  `Skeleton` tiles) rather than inventing a second shape. **Extract it into a
  small shared function so both the season-loading and the (unchanged, still
  present inside `CoachHomeContent`) data-loading skeleton use one
  implementation — required, not encouraged, as of this revision.** A
  hand-mirrored copy is nine magic `Skeleton` `index` values that can drift
  from the original with nothing comparing them; extraction removes that
  failure mode structurally instead of relying on a reviewer to notice a
  future edit only updated one copy.

`Banner` and `Button` are already imported in this file (`:507-508`); no new
Astryx imports needed for this part.

## The second finding in the owner's report — the measured reality, field by field

Revision 1 corrected the coordinator's original framing ("tiles render
fixture values when the analytics load fails") to "fixing `seasonId` makes
the primary tiles show their genuine empty/DES-12 states." **That correction
was also wrong, and it is the one that matters, because it was already
relayed to the owner.** `defaultLoadCoachHomeData` (`:1410-1424`, read-verified —
I opened this function directly) season-filters only **three** of
`CoachHomeData`'s eleven fields (the interface itself, `:633-645`, has exactly
eleven members — I counted them directly). **Correction to my own revision 2:
"the other eight" is wrong; it is the other seven.** The eleventh field is
`seasonId` itself, echoed back verbatim at `:1412` (`return { seasonId, ... }`)
— it is the real value the caller passed in, not a fixture array, and it isn't
part of either count below. Verified field by field, including tracing every
function that consumes each one:

| Field | Filtered by season? | After this fix |
|---|---|---|
| `seasonId` | N/A — the real argument, echoed back verbatim (`:1412`) | always the real, threaded id |
| `events` | Yes (`FIXTURE_EVENTS.filter(e => e.seasonId === seasonId)`) | `[]` for any real season id |
| `teamParticipation` | Yes (`FIXTURE_TEAM_PARTICIPATION.find(...)`) | `null` |
| `studentHours` | Yes (`FIXTURE_STUDENT_HOURS.filter(...)`) | `[]` |
| `teams` | **No** — `FIXTURE_TEAMS`, always | unfiltered, always the fixture teams |
| `students` | **No** — `FIXTURE_STUDENTS`, always | unfiltered, always the fixture roster |
| `sessions` | **No** — `FIXTURE_SESSIONS`, always | unfiltered, but see below |
| `rsvps` | **No** — `FIXTURE_RSVPS`, always | unfiltered, but see below |
| `attendance` | **No** — `FIXTURE_ATTENDANCE`, always | unfiltered, but see below |
| `defaultGoalHours` | **No** — `FIXTURE_DEFAULT_GOAL_HOURS = 10`, always (`:901`) | unfiltered, always `10` — **two separate on-screen surfaces, see below** |
| `seasonSetupStatus` | **No** — `FIXTURE_SEASON_SETUP_STATUS`, always `{hasGoalsConfigured:false}` | unfiltered, always "missing setup" |

**What this actually produces on screen, traced through every consuming
function (`buildNextUp`, `buildLastCompletedMeetingSummary`,
`countUpcomingSessionsInNextDays`, `selectCheckInSession`, all at
`CoachHome.tsx:971-1118`):** each of these builds its set of in-scope event
ids **from `events` first**, then filters `sessions`/`rsvps`/`attendance`
against that set. Because `events` genuinely does become `[]` after this fix,
those four functions' outputs genuinely do go empty even though `sessions`/
`rsvps`/`attendance` themselves are never filtered — the season-filter on
`events` alone is sufficient to neutralize them. So:

- **Team participation:** `—` (honest — `teamParticipation` is directly
  filtered).
- **Last meeting attendance:** `—` (honest — reaches empty via the `events`
  join, `CoachHome.tsx:2256`'s literal `'—'`).
- **Events in next 7 days:** `0` (honest — same join).
- **Next up:** "Nothing scheduled" empty state (honest — same join,
  `CoachHome.tsx:2415`).

**But `data.defaultGoalHours` does NOT go honest, and it leaks onto screen in
TWO separate places — one root cause, two surfaces, and this is the finding
that matters most in this packet.** One field, `defaultGoalHours` (unfiltered,
always `10` per the table above), feeds two independent renders:

**Surface 1 — `Hours vs. team goal`, already known as of revision 2.**
`sumGoalHours(data.students, teamId, data.defaultGoalHours)` (`:924-934`,
formula: sum of `goalHoursOverride ?? defaultGoalHours` across active students
on `teamId`) reads `students` and `defaultGoalHours` — **neither is
season-filtered.** The gate measured this fixture arithmetic, executed, at
**`38`** — reconfirm at your own dispatch, don't trust the number blindly, but
do not assume it becomes `0` or disappears. `sumConfirmedHours` reads
`data.studentHours`, which **is** season-filtered, so it correctly goes to
`0`. **The rendered value is `0 / 38 hrs`** (`CoachHome.tsx:2238`'s
`formatValueLabel`), with `38` still fabricated fixture data sitting directly
beside a genuinely honest `0`.

**Surface 2 — `Default goal {data.defaultGoalHours}h`, found by the round-2
gate, and it outranks Surface 1.** Read-verified directly, and it corrects a
citation error in the gate's own report (relayed by the coordinator): the
line is `CoachHome.tsx:2320`, not `:2396` — `:2396` is a comment about
`columns={2}` a few lines below; I confirmed `CoachHome.tsx` is byte-identical
between `3b0a17a` and this packet's own HEAD, so this was a citation slip, not
drift. This literal renders as the `secondary` of the **`Avg hours / active
student`** `KpiCard` (`:2311-2323`) — a *different* tile from `Hours vs. team
goal`, and it is not merely "beside" real data, it is **inside the same
tile**: that `KpiCard`'s own `value` reads `dashboardData.rosterStats.avgHoursPerActiveStudent`
(`loaders/dashboard.ts:115`'s real, Supabase-backed row mapping), and its own
`secondary`, a few lines down in the same component instance, reads the
fabricated `data.defaultGoalHours`. One tile, real number on top, fabricated
number under it.

**Why Surface 2 outranks Surface 1: it is currently invisible, and this fix is
what turns it on.** This entire `KpiCard` grid (`Avg hours / active student`,
`Students at goal`, `Session days logged`, `Attendance rate`, `Upcoming
commitment`, `Busiest day` — read-verified at `:2309-2388`) is gated by
`{dashboardData && (...)}`, i.e. it only renders once `dashboardState` (the
*separate* `loadDashboardDataProp`/`dashboard.ts` fetch stream, real and
Supabase-backed) succeeds. Today, that stream 400s on every load — this task's
whole reason for existing — so `dashboardData` is never truthy and the owner
has **never once seen** "Default goal 10h" on screen. `Hours vs. team goal`
(Surface 1), by contrast, is in the *other* grid (`:2218-2252`), gated only by
`loadState`/`data` (`loadData`/`defaultLoadCoachHomeData`, an in-memory
fixture function with no network dependency at all) — that grid already
renders today, bug or no bug. **Landing this fix is what puts Surface 2 on
screen for the first time**, at the exact moment the owner is told the
analytics-loading bug is fixed. If you tell him "the middle third goes
honest" and he then sees `0 / 38 hrs` *and* a brand-new "Default goal 10h"
appearing under a tile that wasn't visible before, that is a second and third
false-expectation report on the same screen in one day. **State the measured
reality, not the aspiration, in your output doc — both surfaces, one root
cause.**

**The admin "Season setup" card has the identical problem (a third fabricated
field, `seasonSetupStatus`, not `defaultGoalHours` — see the table above) and
is easy to miss because an existing test passes either way.**
`showSeasonSetupCard = user.role === 'admin' && isSeasonMissingSetup(data.teams,
data.seasonSetupStatus)` (`:2127-2128`); `isSeasonMissingSetup`
(`CoachHome.tsx:1391-1396` — read-verified directly; the coordinator's relay
of the gate's own correction proposed `:1392-1397` with the quoted body line
at `:1396`, but my own direct read puts the function's full span at
`:1391-1396` and the quoted `return` line at `:1395`. Using my own read here,
noted as a discrepancy from the relay, not silently reconciled) is
`teams.length === 0 || !status.hasGoalsConfigured`. `teams` and
`seasonSetupStatus` are both unfiltered fixtures, and
`FIXTURE_SEASON_SETUP_STATUS.hasGoalsConfigured` is hardcoded `false` — so
this is `true` for every season, real or fixture, before and after this fix.
**`DashboardPage.test.tsx:113`'s `expect(container.textContent).toContain('Season
setup')` will keep passing under the fully-shipped change** — that pass is
not evidence this is fixed, it is evidence the fixture never changes. Don't
read a green existing test here as a clean bill of health for this specific
behavior.

**What this means for scope: nothing changes.** This task still does not
build a real backend for `loadData` (see below) — that remains correctly out
of scope, for the same reasons as before. What changes is what you tell the
checker, and what the checker tells the owner: **the fix genuinely, honestly
empties four of eight primary widgets** (team participation, last-meeting
attendance, events-in-7-days, next up) **and leaves three fabricated
surfaces, from two root-cause fields** — `defaultGoalHours` (the `0 / 38 hrs`
denominator on `Hours vs. team goal`, *and* the "Default goal 10h" secondary
on `Avg hours / active student`, one field, two on-screen surfaces — see
above) and `seasonSetupStatus` (the admin season-setup card) — **because their
fixture inputs were never season-scoped to begin with.** All three surfaces
are captured as known output in criterion 5 below and named explicitly in the
follow-up, not left for a future report to rediscover.

## `teamId` — out of scope, and now for a fact, not a judgement call

`teamId = PLACEHOLDER_CURRENT_TEAM_ID` (`:653`) has the identical
never-passed-placeholder shape as `seasonId`, but **it is not fixable within
this task's scope, and not just as a scoping choice — there is no correct
value available to wire.** `AuthUser` (`guards.tsx`), disclosed at
`CoachHome.tsx:219-223`, carries only `{id, email, role}` — no linkage to
which team(s) a signed-in coach/admin actually manages. Fixing `teamId` the
way this task fixes `seasonId` would require the schema/auth layer to expose
data it does not currently surface to the client at all; there is nothing to
wire it to. This is a different situation from the four recent instances of
this defect family (`OutreachEventDialog.teams`, `ScheduleMeetingsDialog.teams`,
and `seasonId` itself here) where the correct value existed the whole time and
simply wasn't passed.

**It also causes no user-visible defect today, for a separate, verifiable
reason: it never reaches a real query.** `loaders/dashboard.ts`'s own module
doc #4 states every function in that file is season-scoped only, never
team-scoped. Re-verify, don't just cite the doc comment: grep for
`team_id`/`teamId` in that file finds **ten** occurrences
(`:269, :276, :292, :361, :371, :388, :715, :716, :725, :726`) — but every one
is a type-field declaration, a `.select(...)` column list, or row-mapping
output (`teamId: row.team_id`), never a query filter. There is **no**
`.eq('team_id', …)` or `.in('team_id', …)` anywhere in that file. `teamId`
only filters the **fixture** rows `loadData` returns (see above), so it
causes no 400, no wrong data reaching Postgres, nothing network-visible. Do
not touch it. It is filed as a follow-up below, folded together with the
`loadData`-has-no-real-backend gap (constitution item 20).

## Explicitly out of scope

- Building a real backend for `loadData`/`LoadCoachHomeDataFn` (see above —
  filed, not built here).
- `teamId`/`PLACEHOLDER_CURRENT_TEAM_ID` (see above — filed, not built here;
  blocked on a real data gap, not a scoping choice).
- T156 (the loader swallowing the real Postgres error) — separate, already
  filed, depends on this task landing first per its own ledger row.
- Any change to `AppShell.tsx`, `SeasonProvider.tsx`, `KpiStrip.tsx`,
  `router.tsx`, `guards.tsx`, or `loaders/dashboard.ts` — all already correct;
  this bug is entirely in `CoachHome.tsx`'s own wiring.
- Any change to `supabase/migrations/**` — re-confirm the "migrations are not
  implicated" claim yourself (grep the season-scoped views exist, confirm no
  pending migration touches them) rather than trusting this packet's
  restatement of it, but do not add or edit one.

## Allowed Files

- `src/pages/home/CoachHome.tsx`
- `src/pages/home/CoachHome.test.tsx`
- `src/pages/home/DashboardPage.test.tsx` (render harness only — see
  criterion 8; `DashboardPage.tsx` itself is Forbidden, see below)
- `docs/swarm/active/T155-worker-output.md` (create)

## Forbidden Files

- `src/pages/home/DashboardPage.tsx` — must stay a **zero-line diff**. T075's
  own design ("this dispatcher's ONLY job is role-based component selection…
  does not plumb any props through") holds after this task; `DashboardPage`
  renders `<CoachHome />` with no props today and must still do so when this
  ships, because the fix lives entirely inside `CoachHome`'s own default
  resolution of season/team, not in what its caller passes.
- `src/app/AppShell.tsx`, `src/app/SeasonProvider.tsx`,
  `src/components/kpi/KpiStrip.tsx`, `src/components/kpi/KpiStrip.test.tsx`,
  `src/app/AppShell.test.tsx` — all already correct; read for pattern only.
- `src/app/router.tsx`, `src/app/guards.tsx`.
- `src/lib/supabase/loaders/dashboard.ts` — already correctly wired to real
  Supabase; the 400 is a caller-side wiring bug, not a loader bug.
- `src/pages/home/StudentHome.tsx`, `src/pages/home/ParentHome.tsx`, and their
  test files — unaffected by this task; do not touch.
- `supabase/migrations/**`.
- `docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`,
  `dispute-log.md`, `auto-mode-decisions.md`, `state-summary.md`, any other
  `docs/swarm/**` file, `.claude/**`.

## Acceptance Criteria

Four rounds were lost this week to acceptance criteria that could not fail
(T147). **Correction to how revision 2 stated this section's own blanket
claim: not every criterion below is a revert-and-watch-it-fail proof, and
claiming they all are is itself the kind of unfalsifiable-criterion problem
this section exists to prevent — a checker who takes "every criterion below"
literally and can't make criterion 2 or 7 fail via mutation would be right to
flag that as a defect in the packet, not in their own testing.** Criteria 1,
3, 4, 5, and 6's first two bullets are genuine revert-and-fail
proofs — for each of those, state the mutation you ran, not just the passing
assertion. Criteria 2, 6's third bullet, 7, 9, and 10 are **inspection, grep,
or hash checks** — structural facts about the diff, not behavioral proofs —
and are labeled as such at each one below. Criterion 5's "Season setup card"
sub-bullet is a documented permanent residual, not a falsifiable check (see
its own note). Do not try to force a mutation-revert proof onto any of these;
state plainly which kind each one is in your output doc.

**Cheaper path, verified feasible, use it:** define **one** named fixture
`SeasonRow` constant (e.g. `FIXTURE_ACTIVE_SEASON`, id `'season-fixture-active'`
or similar — a distinctive string, not a literal UUID; matches
`AppShell.test.tsx:89-97`'s `T140_FIXTURE_SEASON` convention, not a stricter
one) and reuse it in **both** `CoachHome.test.tsx`'s and
`DashboardPage.test.tsx`'s `renderAsUser` harness. One constant, one non-
placeholder id, satisfies criterion 1 (the id the spy receives), criterion 5
(the fixture-coincidence proof needs a non-`PLACEHOLDER_SEASON_ID` id), and
criterion 8 (both harnesses behave identically) at once — don't invent three
different fixture seasons. For the call-count/argument spy test in criterion
1, reuse `KpiStrip.test.tsx:89-108`'s `renderStrip({user, loadActiveSeason,
...})` shape (wrap `<SeasonProvider loadActiveSeason={...}>` around
`<AuthProvider>`/`<LoginAs>`) rather than re-deriving a new harness pattern.

1. **The placeholder never reaches a query.** With an injected spy
   `loadData`/`loadDashboardData`, prove call count is **zero** while
   `activeSeason.status` is `'loading'`, `'none'`, or `'error'`, and prove the
   argument passed in the `'ready'` case is **exactly**
   `FIXTURE_ACTIVE_SEASON.id` (the shared fixture constant above — not
   `'season-placeholder-current'` and not anything else hardcoded in
   `CoachHome.tsx`). Revert the fix (restore the old default-parameter shape)
   and confirm this specific test fails — do not just assert it should.
2. **(Inspection check, not a mutation proof.) `CoachHomeProps` no longer
   declares `seasonId`.** `PLACEHOLDER_SEASON_ID` the module constant is
   untouched (still backs the `FIXTURE_*` fixture data `defaultLoadCoachHomeData`
   reads) — only the prop and its use as a default parameter are removed.
3. **All four `activeSeason.status` states render the exact literals
   prescribed in the "Loading / none / error copy" section above** — not just
   "distinct, correct content." Specifically: `'none'` → `'No active season
   yet'`; `'error'` → `"Couldn't load the active season"` plus
   `activeSeason.error.message` plus a working `Retry` calling
   `activeSeason.refresh`; `'loading'` → the DES-12 skeleton, no query fired
   (ties to criterion 1); `'ready'` → delegates to `CoachHomeContent`, which
   behaves exactly as `CoachHome` does today for every existing DES-12 state
   of its **own** `loadState`/`dashboardState`.
4. **Fail-loud proof.** `CoachHome` rendered without a `<SeasonProvider>`
   ancestor throws `useActiveSeason() must be called within a
   <SeasonProvider>.` — assert the exact message, plus the T141-pattern
   companion case proving the same page does **not** throw when a
   `<SeasonProvider loadActiveSeason={...}>` wrapping the fixture-resolving
   loader is present.
5. **The measured-reality proof — replaces revision 1's "genuine empty state"
   framing entirely, and this criterion is the one that must actually see the
   round-2 MAJOR, not just describe it.** With `activeSeason` resolved to
   `FIXTURE_ACTIVE_SEASON`, the **default** `loadData` (`defaultLoadCoachHomeData`,
   untouched — do not inject a custom one for this test), **and
   `loadDashboardData` pinned to `defaultLoadCoachHomeData`'s sibling in-file
   fixture, `defaultLoadDashboardData` — do not leave `loadDashboardData` at
   `CoachHome`'s own real default for this test.** This pin is required, not
   optional: `CoachHome`'s own prop default for `loadDashboardData` is the
   real, Supabase-backed `loadDashboardData` (`dashboard.ts`), which has
   nothing to connect to in this test's `jsdom` environment and rejects, so
   `dashboardState.status` becomes `'error'` and the entire
   `{dashboardData && (...)}`-gated grid — where Surface 2 of the MAJOR above
   lives — never renders at all. Without this pin, this criterion cannot see
   the defect the round-2 gate found, which is exactly how it went unseen
   through revision 2. `defaultLoadDashboardData` already exists in
   `CoachHome.tsx` (`:1665`) and is already used by existing tests in this
   file — reuse it, don't build a new fixture loader.

   With both fixtures wired, assert **all** of the following in one rendered
   tree, matching the field-by-field table above exactly:
   - Team participation renders `'—'`, not `82.4%` or any other
     `FIXTURE_TEAM_PARTICIPATION` value.
   - Last meeting attendance renders `'—'`.
   - Events in next 7 days renders `0`.
   - Next up shows the "Nothing scheduled" empty state.
   - **Hours vs. team goal renders `0 / 38 hrs`** (or whatever you measure the
     fixture arithmetic to be at your own dispatch — state the exact figure)
     — assert this value explicitly as the known-residual fabricated output,
     not as a gap in coverage. A test that silently omits this tile is not a
     passing proof, it is a hole in one.
   - **`Avg hours / active student`'s secondary renders `Default goal 10h`**
     (or your own dispatch's measured `FIXTURE_DEFAULT_GOAL_HOURS` value) —
     the round-2 MAJOR, and the reason `loadDashboardData` had to be pinned
     above. Assert it explicitly, in the same tree, as a second known-residual
     surface of the same `defaultGoalHours` root cause as the bullet above —
     not a separate finding, not omitted because "it's basically the same
     bug" as the one above it.
   - **If rendered for an admin user, the "Season setup" card is present —
     assert this too, but label it honestly: this sub-assertion is
     documentation of a permanent residual, not a criterion that can fail.**
     `isSeasonMissingSetup` reads only unfiltered fixture fields
     (`teams`/`seasonSetupStatus`), so it is `true` for every season this
     task can produce, real or fixture, before this fix, after this fix, and
     under any mutation confined to this task's own scope — the round-2 gate
     confirmed this by trying three different mutations and getting `true`
     every time. Note in your output doc that `DashboardPage.test.tsx:113`'s
     pre-existing identical assertion passing is not evidence of a fix here
     either — same reason, restated: the fixture never changes.
6. **`teamId`/`PLACEHOLDER_CURRENT_TEAM_ID` unchanged — three concrete
   inspection checks, not mutation proofs, and not "byte-unchanged in
   behavior":**
   - `PLACEHOLDER_CURRENT_TEAM_ID`'s exported value is unchanged.
   - `CoachHomeProps.teamId`'s default parameter is still
     `= PLACEHOLDER_CURRENT_TEAM_ID`.
   - **(`git diff --exit-code` check, not a criterion that can fail via
     mutation — the file is Forbidden, so this is a structural guarantee, not
     a behavioral one.)** `loaders/dashboard.ts` gains no
     `.eq('team_id', …)`/`.in('team_id', …)` call anywhere.
7. **(Hash check, not a mutation proof.)** `DashboardPage.tsx` byte-identical
   (hash before/after).
8. **Existing tests survive with harness-only changes — verified feasible,
   not left as an open investigation. Breakdown corrected in this revision; I
   independently re-confirmed the totals below by direct grep/read, not just
   relayed them.** `CoachHome.test.tsx` has **90** `it(` blocks (I confirmed
   this by grep, pattern `^\s*it\(`, count 90 — not 126, that figure conflated
   `it(`/`describe(` occurrences with test count) and `DashboardPage.test.tsx`
   has **5** (I confirmed by direct read: "coach", "admin", "student",
   "parent", "null user" — one `it(` each), for a combined target of **95**.

   **Of those, 29 currently break under the naive/reverted version of this
   fix — corrected breakdown, the total was right by coincidence in revision
   2, the attribution was not:**
   - **27**, not 29, are in `CoachHome.test.tsx`. The string `renderAsUser`
     occurs 29 times in that file (I grep-confirmed this count directly), but
     one of those 29 is the function *definition* itself
     (`CoachHome.test.tsx:84` — I confirmed this line directly), leaving 28
     call sites spread across 27 distinct `it(` blocks (one block calls it
     twice). I did not individually re-derive which specific block is the one
     with two calls; that sub-detail is relayed, not independently confirmed
     by me — the 28-calls/27-blocks/1-definition arithmetic is internally
     consistent with my own 29-count grep either way.
   - **2** are in `DashboardPage.test.tsx` — I confirmed directly by reading
     both that file and `DashboardPage.tsx`: only the `"renders CoachHome for
     role \"coach\""` and `"renders CoachHome for role \"admin\""` tests
     (`:91`, `:105`) actually mount `CoachHome` at all (`DashboardPage.tsx`'s
     own role switch, `:117-129`, routes only `'admin'`/`'coach'` to
     `<CoachHome />`; `'student'`/`'parent'` go to different components
     entirely, and `user === null` renders `null`). **Drop "unaffected
     regardless" as a claim about the whole file — it's true for 3 of
     `DashboardPage.test.tsx`'s 5 tests (student, parent, null-user), not all
     5.** The other 2 (coach, admin) are exactly the ones counted in "29"
     above.

   **Confirmed sufficient, not merely expected to be (this part is the
   round-2 gate's own executed measurement, relayed by the coordinator — I
   have not re-executed it myself):** wrapping both files' `renderAsUser`
   function in `<SeasonProvider loadActiveSeason={...}>` resolving
   `FIXTURE_ACTIVE_SEASON`, with the existing `flushMicrotasks()` (its current
   `await Promise.resolve()` ×3) left as-is, is sufficient to restore all 95
   to green — no additional microtask-flush pass is needed, and no individual
   `it(` body needs to change. Re-run this yourself at your own dispatch SHA
   to confirm it still holds rather than trusting this figure, but do not
   budget time for an "investigate whether more flushing is needed" branch —
   it isn't. The one exception: if you find a test that specifically asserted
   behavior only reachable through the old placeholder-seasonId default, name
   it explicitly in your output doc rather than silently adjusting it — none
   is currently known to exist.
9. **(Build/health check, not a mutation proof.)** `npx tsc --noEmit`,
   `npx vite build`, `npm run format:check`, `npx eslint .` all clean. The
   round-2 gate reported this clean at 0 errors, 355 warnings, executed —
   relayed by the coordinator, attributed to the gate, not re-executed by me
   (I have no Bash). Re-confirm at your own dispatch SHA rather than trusting
   this figure regardless of who's reporting it.
10. **(Build/health check, not a mutation proof.)** `npx vitest run` green.
    Baseline **66 test files / 1507 tests** at HEAD `9c863c1`. The round-2
    gate reported **1510/1510 passing** on its own fully-built version of this
    fix, executed — relayed by the coordinator, attributed to the gate, not
    re-executed by me. Re-confirm your own baseline and end count at your own
    dispatch SHA rather than trusting either number. State your expected end
    count (pure addition of new `it(` blocks for criteria 1/4/5) and whether
    you hit it.

**Do not certify your own work.**

## Follow-up to file (constitution item 20 — do not leave this in a comment)

Record in your output doc, for the orchestrator to add as a ledger row (you
cannot write `task-ledger.md` yourself; the orchestrator has said it will file
this one directly in the merge commit per item 24):

> **`CoachHome`'s primary widgets have no real Supabase implementation, and
> three on-screen surfaces (from two fabricated fields) are now confirmed to
> render known-fabricated output even after T155.** `LoadCoachHomeDataFn`
> (`loadData` prop) is only ever `defaultLoadCoachHomeData`, a fixture —
> grep-confirmed, no other implementation exists anywhere in the repo, and no
> ED-1 or T124-era task ever built one. T155 stops the placeholder from
> reaching Postgres and, as a secondary effect, stops it from coincidentally
> matching the fixture's own season key — which correctly empties four widgets
> (team participation, last-meeting attendance, events-in-7-days, next up) but
> **not** three surfaces from two fields: `defaultGoalHours` (unfiltered,
> always `10`) feeds both `Hours vs. team goal`'s denominator (`sumGoalHours`
> over unfiltered `students`/`defaultGoalHours`, measured `38`, rendering
> `0 / 38 hrs`) *and*, separately, the `Avg hours / active student` tile's own
> "Default goal 10h" secondary (`CoachHome.tsx:2320` — this second surface only
> becomes visible once T155 ships, since it sits behind the `dashboardData`
> gate this task is what makes reachable) — and `seasonSetupStatus` feeds the
> admin "Season setup" card (`isSeasonMissingSetup` over unfiltered
> `teams`/`seasonSetupStatus`, permanently true). All three remain fabricated,
> on screen, indefinitely, until this follow-up lands. The real backing views
> for the two fields `defaultLoadCoachHomeData` already filters correctly —
> `TeamParticipationMetric`/`StudentHoursMetric` — already exist:
> `v_student_hours` at
> `supabase/migrations/20260717000003_metric_views.sql:3` and
> `v_team_participation` at the same file's `:44` (read-verified directly —
> revision 2 of this packet had this pairing backwards; also referenced again
> in `20260722000000_membership_views.sql`), so a real loader for at least
> those two is mechanical, mirroring `loaders/dashboard.ts`'s own pattern —
> not new SQL design. The remaining fields (`teams`, `students`, `sessions`,
> `rsvps`, `attendance`, `defaultGoalHours`, `seasonSetupStatus`) need their
> own real, season-scoped queries. `teamId = PLACEHOLDER_CURRENT_TEAM_ID`
> (`CoachHome.tsx:653`) is blocked on the same follow-up for a distinct
> reason: it's not merely unwired, there is **no correct value to wire** —
> `AuthUser` carries no team linkage at all (`CoachHome.tsx:219-223`) — so
> resolving it requires a schema/auth change, not just a loader. Scope all of
> this as one task, not sequentially, since the real loader and the team
> resolution are the same piece of work.

## Relevant Constitution Excerpts

- **Non-Negotiable #2** (`constitution.md:10`, corrected from `:11` — I
  re-read the file directly: `:10` is "Existing tests must pass unless the
  boss explicitly approves a test update"; `:11` is "No worker may mark its
  own work complete," a different rule this packet also relies on separately,
  below. Revision 2 of this packet introduced this same `:11` mislabel, and it
  originated in T154's revision 2 while that packet was *fixing* a different
  citation error — worth noting only because it shows how a correction in one
  packet can seed a new error in another.) — existing tests pass unless
  explicitly approved. This task should need no approval: criterion 8 keeps
  every existing assertion, changing only two shared render-harness functions.
  If you find an existing test that cannot survive unmodified, stop and report
  rather than silently weakening it.
- **Item 12** (DES-12, all four async states) — this task adds a *new* async
  boundary (season resolution) on top of an existing one; all four states must
  exist at both layers, not just the layer that already had them.
- **Item 18** (tiering) — this task does not touch auth, session,
  role-resolution, permission logic, RLS, migrations, or metric SQL; it wires
  an existing, already-checked context (`useActiveSeason()`, built and PASSed
  under T091/T140) into a new consumer. **Sonnet tier**, matching T140/T141's
  own tier assignment for the identical class of change.
- **Item 20** — the `teamId`/no-real-`loadData`-backend findings above are
  filed, not commented.
- **Item 23** — any mutation experiment (reverting the fix to confirm a test
  fails, then restoring) runs in your own worktree.

## A note on attribution, since it matters and this packet got it right

Everything in this packet attributed to the human owner is limited to the
original bug report, the DevTools screenshots, and the symptoms he described.
The design (outer/inner split), both scope deferrals (`teamId`, the
`loadData` backend), the tier assignment, and every acceptance criterion are
presented as the orchestrator's own judgement, not his. Keep that boundary
intact in your output doc — after three packets this week attributed a
design or authorization decision to him incorrectly, this is the one place in
the project where it's currently clean.

## Required Worker Output

Create `docs/swarm/active/T155-worker-output.md` covering:

- The exact `CoachHome`/`CoachHomeContent` split as shipped, and any deviation
  from the suggested shape above, with reasoning.
- Criterion 1's mutation proof: the spy call-count/argument evidence, and the
  revert-and-fail result.
- Criterion 4's fail-loud proof (exact thrown message) and its companion.
- Criterion 5's measured-reality proof: the actual before/after DOM content
  for all seven asserted tiles/cards (team participation, last-meeting
  attendance, events-in-7-days, next up, `Hours vs. team goal`, `Avg hours /
  active student`'s secondary, and the admin Season-setup card), including
  the exact `Hours vs. team goal` and `Default goal` figures, both stated as
  known-residual output from the same `defaultGoalHours` root cause, and the
  Season-setup card noted as a documented permanent residual rather than a
  falsifiable result.
- The before/after call-count evidence for the "signed out never fetches"
  behavior change, and confirmation the milestone-toast dedupe key now
  includes the real season id.
- Confirmation criterion 8's numbers (90/5/95/29) and sufficiency claim
  (harness-only, no extra flush) reproduced at your own dispatch SHA.
- Confirmation `DashboardPage.tsx` is byte-identical (hash).
- Confirmation no migration was touched.
- The follow-up-task text above, restated for the orchestrator to file.
- Full command output for criteria 9–10, with before/after counts.
- Anything unverified, stated plainly as unverified.

Do not mark this task complete. A checker verifies it.
