# T203 worker packet — embed `<Leaderboard>` in `CoachHome.tsx`

**Basis: fresh `main` at `16fd9df`** (post-merge of T158's real `Leaderboard`
loader; this worktree is standalone, not a continuation of the T183/T173/T191/T158
branch). All line-number citations below were re-read directly against this
commit by the packet author (`foreman-planner`) — not carried over from the
ledger row unverified (constitution item 19c). Every citation that turned out
to still be accurate is marked so explicitly; two of the ledger row's own
claims turned out to be wrong and are corrected in §3, not silently fixed.

## 1. Objective

`Leaderboard.tsx` (T044, real data via T158's `loadLeaderboardData`) is
finished, tested, and mounted nowhere. Embed it in `CoachHome.tsx`'s
dashboard — the second half of T158, split out at that task's packeting time
because of a real CSS-nesting hazard and two test-harness fixes, neither
built yet. This rolls out the exact "mount a finished, unmounted, tested
component into an existing page" pattern T157 already proved for `ParentRsvp`
→ `OutreachDetail.tsx`, and the exact "one page renders another page-folder's
finished component" pattern already shipped in this repo for T177's
`SubscribePopover` → `SettingsPage.tsx` (`import { SubscribePopover } from
'../calendar/SubscribePopover'`, `SettingsPage.tsx:448` — confirmed by direct
read; a page in `src/pages/settings/` importing a component from
`src/pages/calendar/`, the same cross-folder shape this task needs for
`src/pages/home/` importing from `src/pages/outreach/`).

## 2. Authority

**OWNER RULING** (`auto-mode-decisions.md`, "2026-07-30 — George's rulings on
T157/T158", verbatim: *"embed the leaderboard in the dashboard"*): embedded
in the dashboard (`CoachHome.tsx`), **not** a standalone route. This settles
the product/placement question only. Everything else below — insertion
point, prop names, the CSS fix, the test-harness fixes, tier, and gate scope
— is the orchestrator's design call, not George's. If you disagree with a
design choice here, say so in your output doc; do not silently follow it if
you find it wrong, and do not silently deviate either.

## 3. Corrections to the T203 ledger row's own citations (item 19c)

The ledger row (`task-ledger.md`, T203) was written while packeting T158,
before T158 actually landed. Re-verified against the real, current file
(`16fd9df`) rather than accepted:

**Held up exactly, unchanged:**
- Insertion point: the "Top events by student hours" `VStack` still closes
  at `CoachHome.tsx:2784`, and `showSeasonSetupCard`'s block still starts at
  `:2786`, byte-for-byte the same lines the row predicted — because T158's
  own Allowed Files never touched `CoachHome.tsx` at all (confirmed: zero
  `Leaderboard` references anywhere in the file except one module-doc
  mention at `:398`). Do not assume this kind of citation survives future
  packets by default — it held here because the file genuinely wasn't
  touched, not because line numbers are generally stable across a merge.
- `CoachHomeProps` at `:2093-2111`, `CoachHomeContentProps` at `:2238-2246` —
  both exactly where the row said.
- The CSS hazard is real, and `Card` is the correct fix (see §6b — verified
  far more precisely than the row itself managed, see below).
- `loadLeaderboardData`'s real name/shape: `src/lib/supabase/loaders/
  leaderboard.ts:175`, `export const loadLeaderboardData: LoadLeaderboardDataFn
  = makeLoadLeaderboardData();`. `LoadLeaderboardDataFn` itself is declared at
  `Leaderboard.tsx:218`: `(seasonId: string) => Promise<LeaderboardLoadResult>`.
  Both exactly as the row described.
- Both named test files (`CoachHome.test.tsx`, `DashboardPage.test.tsx`)
  genuinely need changes, roughly as described — see §7 for the corrected,
  concrete diffs.
- Tier: sonnet is correct (see §9 — independently re-derived against all
  four item-18 triggers, not just accepted).

**Wrong, and corrected here:**
- **The row claims "the installed package's StyleX class names are
  obfuscated and unverifiable by reading source." This is false.** The
  component `.js` source (`node_modules/@astryxdesign/core/dist/Section/
  Section.js`) is obfuscated, but the package also ships its own
  **precompiled** stylesheet at `node_modules/@astryxdesign/core/dist/
  astryx.css` (this is the same file `theme.css:39` `@import`s as
  `@astryxdesign/core/astryx.css`) — and it is fully legible. Read directly,
  lines 809/819/1458/1460:
  ```css
  .x1fcf3bl:not(#\#)... { margin-inline-end: calc(-1 * var(--container-padding-inline-end, 0px)); }
  .xojxgvx:not(#\#)... { margin-inline-start: calc(-1 * var(--container-padding-inline-start, 0px)); }
  .xkibk3:first-child... { margin-top: calc(-1 * var(--container-padding-block-start, 0px)); }
  .xlayyun:last-child... { margin-bottom: calc(-1 * var(--container-padding-block-end, 0px)); }
  ```
  These four classes are exactly `Section.js`'s `nestedStyles.outer` (its
  outer wrapper `<div>`, applied unconditionally, every render). So the
  mechanism is not a guess from a doc comment — it is a literal, numeric
  formula: the outer div's negative margin equals whatever
  `--container-padding-inline-start/-end`/`-block-start/-end` custom
  property value is in scope at that point in the DOM, defaulting to `0px`
  if nothing ever set it.
  Tracing what sets that value: `LayoutContent padding={6}` (this page's own
  ancestor, unchanged) and `Card`/`Section` (via the shared `container(...)`
  helper, `node_modules/@astryxdesign/core/dist/Layout/container.stylex.js`)
  are the only things that write it, and nothing between `LayoutContent` and
  a bare `<Leaderboard>` mount (only `VStack`/`Heading`/`Divider`) rewrites
  it — confirmed by grep, none of those three call `container(...)`. So a
  bare mount inherits `LayoutContent`'s ambient value, spacing step 6 —
  `--spacing-6: 24px` (`tokens.stylex.js:233`) — meaning **the outer div
  gets `margin-inline: -24px` on each side**, bleeding 24px past every
  sibling `VStack` section on the page.
  `Card`'s own div (`Card.js:200-207`) unconditionally calls `container({
  useThemeDefault: 'card' })` on itself, which re-declares those same
  custom properties to `--astryx-card-padding`'s value **before** any
  descendant (including a nested `Section`'s outer div) reads them. This
  project's own theme overrides that token: `theme.css:518-519`,
  `.astryx-card { --astryx-card-padding: var(--spacing-3); }` — `--spacing-3:
  12px` (`tokens.stylex.js:230`). So **wrapping in `Card` changes the
  Section's own negative margin from -24px to -12px** — and because `Card`
  itself carries no negative margin of its own (it never bleeds past its own
  parent), the net effect is that the Card+Section combination's outer
  edge lines up exactly with every sibling `VStack` section's edge — not
  merely "a smaller bleed," but the bleed fully cancelled relative to the
  page's shared content column. This is a stronger, more precise
  confirmation than the row's own "matching Section's own doc comment"
  reasoning, and it is genuinely traceable through the package's shipped
  files, not merely theoretical — see §8 criterion 6/7 for what still needs
  a live-browser measurement to close out completely (I have no Bash tool;
  see §0 below).
- **The row's prescribed harness fix ("merge... the same mechanism this file
  already uses for `loadActiveSeason`") does not describe real code.**
  Re-read `CoachHome.test.tsx:133-155` directly: `loadActiveSeason` is a
  third **positional parameter** with its own default value
  (`loadActiveSeason: LoadActiveSeasonFn = async () => FIXTURE_ACTIVE_SEASON`)
  — it is never merged into a props object. There is in fact **no existing
  "merge a default into the caller's props" mechanism anywhere in this
  file** for `CoachHome`'s own component props: `renderAsUser` spreads
  `props` directly (`<CoachHome {...props} />`), and every one of the ~90
  existing call sites that needs `loadData`/`loadDashboardData`/`nowFn` to
  behave deterministically passes them explicitly, one by one (confirmed via
  grep — every populated-state test passes `loadData: fixtureLoadData` or an
  equivalent spy). §7a below prescribes the actual new code this fix
  requires — a genuinely new pattern for this file, not a reuse.
- **Incomplete, not wrong: the row names exactly two test files.** I swept
  further (the task explicitly asked for this) and found a third,
  `src/App.test.tsx`, that also reaches `CoachHome` — through the **real**
  route tree (`App.tsx`'s `<BrowserRouter><AuthProvider>...<AppRoutes/>`,
  jsdom's default location is `/`, and `router.tsx:212` renders
  `<DashboardPage/>` there). With `resolveRole` mocked to `'coach'`, these
  tests genuinely mount the real `CoachHome` with zero props end-to-end,
  the same "real default, unconfigured Supabase" hazard class. **No code
  change is needed there** — none of `App.test.tsx`'s four assertions
  inspect `CoachHome`'s rendered content at all (they check
  `document.documentElement`'s `data-theme` attribute and `loadThemeMode`
  call args only) — but it is now checked, not assumed clean. Also checked
  and ruled out: `src/theme/theme.smoke.test.tsx` renders `<App/>` with no
  session mocked at all, so the unauthenticated redirect away from `/` means
  `CoachHome` is never reached; `src/app/AppShell.test.tsx`'s `renderAt(...)`
  helper renders a static `page-marker` `<div>` as `AppShell`'s children,
  never the real route tree (`routePaths.dashboard` there only sets
  `MemoryRouter`'s `initialEntries` for nav-highlighting, it does not route
  through `DashboardPage`) — `CoachHome` never mounts in that file either.

## 4. Ground truth — the real names, re-verified

- `Leaderboard` (`src/pages/outreach/Leaderboard.tsx:470-474`):
  ```ts
  export interface LeaderboardProps {
    loadData?: LoadLeaderboardDataFn;       // defaults to defaultLoadLeaderboardData (fixture)
    loadPrivacySetting?: LoadPrivacySettingFn; // defaults to the REAL loadPrivacySetting already (T104) — leave alone
    seasonId?: string;                      // defaults to PLACEHOLDER_SEASON_ID
  }
  export function Leaderboard({ loadData, loadPrivacySetting, seasonId }: LeaderboardProps = {}): ReactNode
  ```
  `Leaderboard` renders `<Section variant="section" padding={4}>` at `:478`
  and owns its **entire** DES-12 lifecycle internally (loading skeleton,
  error `Banner`+Retry, `EmptyState` when `entries.length === 0`, populated
  `List`) — confirmed by direct read, `:482-534`. `CoachHome` does not need
  to build any additional loading/error orchestration around it; mount it
  and let it manage itself, the same "self-contained tested component" trust
  T157 already established for `ParentRsvp`.
  No role gate anywhere in the file (module doc #6, "OUT-08... visible to
  every role") — `CoachHome` only ever renders for `coach`/`admin` viewers
  anyway (`DashboardPage.tsx:117-124`, Forbidden/unchanged), so there is no
  negative-space/role-gating criterion needed here, unlike T157's `ParentRsvp`
  work (which added a genuinely new authorization predicate; this task adds
  none).
  No team scoping either — `Leaderboard` is season-wide by design (top 10
  students, season-wide), matching this file's own existing season-wide
  widgets (Hours by team, Goal projection, Top events — module doc #13(a)'s
  "D-2, we are just a team" reasoning). Do not thread `teamId` into it.
- `loadLeaderboardData` (`src/lib/supabase/loaders/leaderboard.ts:175`):
  `export const loadLeaderboardData: LoadLeaderboardDataFn =
  makeLoadLeaderboardData();` — real, Supabase-backed (T158), same
  "prop defaults to the real loader" convention `loadDashboardData`
  already established on this exact file (`CoachHome.tsx:2102`'s own doc
  comment: *"Defaults to the REAL Supabase-backed `loadDashboardData`...
  same 'prop defaults to the real loader' convention... already
  established."*).
- `defaultLoadLeaderboardData` (`Leaderboard.tsx:394-399`) — the **fixture**
  default, kept as a named export (per that file's own module doc #4
  UPDATE) — this is what the test-harness fix in §7a needs, **not** the real
  `loadLeaderboardData`.
- `Card` is already imported in `CoachHome.tsx` (`:618`) and already used
  with zero props (`:2789`, the Season-setup card) — no new Astryx prop
  usage is introduced by this task; nothing new to cross-check against
  `astryx-api.md` beyond what module doc §ground-truth already covers for
  `Card`/`Divider` (`CoachHome.tsx:301-304`).

## 5. Allowed / Forbidden files

**Allowed (write access):**
- `src/pages/home/CoachHome.tsx`
- `src/pages/home/CoachHome.test.tsx`
- `src/pages/home/DashboardPage.test.tsx`

**Forbidden (read for reference only):**
- `src/pages/outreach/Leaderboard.tsx`, `Leaderboard.test.tsx` — finished,
  tested. Import from it (`Leaderboard`, `LoadLeaderboardDataFn`,
  `defaultLoadLeaderboardData`); do not modify it, do not duplicate its
  internal state-machine/formatting/privacy logic. Its own module doc header
  (`:2`) still reads "a `Section` on `/outreach`" — stale since the owner's
  ruling ("embed in the dashboard, not a standalone route") superseded it;
  this is a one-word documentation triviality, already correctly described
  everywhere it actually matters (T158's own loader module doc, this
  packet), not worth its own follow-up task — leave it, do not fix it here
  (Forbidden file), and do not let it confuse you about where this mounts.
- `src/lib/supabase/loaders/leaderboard.ts`, `leaderboard.test.ts` — finished
  (T158). Import `loadLeaderboardData` from it; do not modify.
- `src/lib/supabase/loaders/leaderboard_privacy.ts` — untouched;
  `Leaderboard`'s own `loadPrivacySetting` default is already real, do not
  override it.
- `src/pages/home/DashboardPage.tsx` — read-only reference. Confirms
  `<CoachHome />` is mounted with **zero** props at `:120` for both
  `coach`/`admin` — this is why §7b's `DashboardPage.test.tsx` fix must be a
  module-level `vi.mock`, not a per-call-site prop override (structurally
  impossible here). Do not edit this file; nothing in it needs to change.
- `src/lib/supabase/loaders/dashboard.ts`, `coachHome.ts`, `loader.ts`,
  `client.ts` — untouched, pre-existing.
- `src/app/router.tsx`, `guards.tsx`, `SeasonProvider.tsx` — untouched,
  read-only reference for `useAuth`/`useActiveSeason`/routing, already wired
  since T005/T155.
- `src/App.test.tsx`, `src/theme/theme.smoke.test.tsx`,
  `src/app/AppShell.test.tsx` — checked directly (§3, last bullet); none of
  them need a change for this task, and none is in your Allowed Files. If
  your own work somehow makes any of these fail, stop and report it — do not
  edit them to make them pass.
- `docs/swarm/**`, `.claude/**` — standard, every task.
- Any file not listed above as Allowed.

**Environment note:** this worktree had no `node_modules/` installed as of
packeting time (a fresh worktree off `16fd9df`) — run your package
manager's install step before anything else; do not treat a missing
`node_modules/` as a repo defect.

## 6. Design — `CoachHome.tsx`

**6a. Imports.** Add to the existing `@astryxdesign/core` import list — no
change needed, `Card`/`Divider` already imported (`:618`/`:619`). Add two new
import statements near the existing loader imports (`:641-652`):
```ts
import { loadLeaderboardData } from '../../lib/supabase/loaders/leaderboard';
import { Leaderboard, type LoadLeaderboardDataFn } from '../outreach/Leaderboard';
```

**6b. Prop threading — mirrors `loadDashboardData`'s exact existing shape at
both boundaries, verified against the real code (`:2093-2111`,
`:2169-2227`, `:2238-2256`), not assumed.**

`CoachHomeProps` (`:2093-2111`) — add one field, after `loadDashboardData`:
```ts
export interface CoachHomeProps {
  loadData?: LoadCoachHomeDataFn;
  loadDashboardData?: LoadDashboardDataFn;
  /** T203: injectable data-loading seam for the embedded season volunteer
   * leaderboard (`Leaderboard.tsx`, OUT-08). Defaults to the real,
   * Supabase-backed `loadLeaderboardData` (`../../lib/supabase/loaders/
   * leaderboard`, built by T158) -- same "prop defaults to the real loader"
   * convention `loadDashboardData` above already established. */
  loadLeaderboardData?: LoadLeaderboardDataFn;
  teamId?: string;
  nowFn?: () => Date;
}
```

`CoachHome` (`:2169-2227`) — add to the destructuring, same rename-to-avoid-
shadowing-the-module-import convention `loadDashboardData: loadDashboardDataProp`
already uses on the very next line:
```ts
export function CoachHome({
  loadData = loadCoachHomeData,
  loadDashboardData: loadDashboardDataProp = loadDashboardData,
  loadLeaderboardData: loadLeaderboardDataProp = loadLeaderboardData,
  teamId = PLACEHOLDER_CURRENT_TEAM_ID,
  nowFn = () => new Date(),
}: CoachHomeProps = {}): ReactNode {
```
and pass it through in the `case 'ready':` branch (`:2214-2225`):
```ts
    case 'ready':
      return (
        <CoachHomeContent
          user={user}
          seasonId={activeSeason.season.id}
          teamId={teamId}
          loadData={loadData}
          loadDashboardData={loadDashboardDataProp}
          loadLeaderboardData={loadLeaderboardDataProp}
          defaultGoalHours={activeSeason.season.defaultGoalHours}
          nowFn={nowFn}
        />
      );
```

`CoachHomeContentProps` (`:2238-2246`) — add one required field:
```ts
interface CoachHomeContentProps {
  user: AuthUser;
  seasonId: string;
  teamId: string;
  loadData: LoadCoachHomeDataFn;
  loadDashboardData: LoadDashboardDataFn;
  loadLeaderboardData: LoadLeaderboardDataFn;
  defaultGoalHours: number;
  nowFn: () => Date;
}
```

`CoachHomeContent` (`:2248-2256`) — same rename convention again:
```ts
function CoachHomeContent({
  user,
  seasonId,
  teamId,
  loadData,
  loadDashboardData: loadDashboardDataProp,
  loadLeaderboardData: loadLeaderboardDataProp,
  defaultGoalHours,
  nowFn,
}: CoachHomeContentProps): ReactNode {
```

**6c. The mount itself — insert between `:2784` and `:2786` (re-verified
current, see §3).** Do not add any new load-state boundary around
`Leaderboard` — it owns its own DES-12 lifecycle (§4). Insert:
```tsx
              <Divider />

              {/* T203: `Leaderboard` (OUT-08, T044/T158) embedded per the
                owner's ruling ("embed the leaderboard in the dashboard").
                Wrapped in `Card` -- NOT mounted bare -- because `Section`
                (which `Leaderboard` renders internally) unconditionally
                applies a negative inline/block margin sized from whichever
                ancestor most recently set `--container-padding-*`
                (`Section.js`'s own `nestedStyles.outer`, confirmed against
                the package's own precompiled `astryx.css`:
                `margin-inline-start/-end: calc(-1 * var(--container-
                padding-inline-start/-end, 0px))`). This page's
                `LayoutContent padding={6}` is the nearest ancestor setting
                those vars, and nothing between it and here resets them
                (only `Card`/`Section`/`LayoutContent` call the shared
                `container(...)` helper -- not the intervening `VStack`s) --
                so a bare mount would bleed the leaderboard ~24px wider than
                every sibling section on this page (`--spacing-6`, this
                page's own ambient padding). `Card`'s own div re-declares
                those vars to its own, smaller, theme-overridden value
                (`--astryx-card-padding: var(--spacing-3)`, 12px,
                `theme.css:518-519`) before `Section` reads them, and `Card`
                itself carries no negative margin of its own -- so wrapping
                here makes the leaderboard's outer edge line up with every
                sibling section's edge instead of bleeding past it. Same
                nesting-hazard class this file's own T129 fix (module doc
                #14, `:2271-2278`) already found and fixed for a different
                wrapper. See this task's worker output for the live-browser
                measurement closing this out numerically (jsdom does not
                load real CSS in this project's test setup -- confirmed,
                `test-setup.ts`/`vite.config.ts` -- so a jsdom computed-style
                check cannot resolve the `calc()` math; see the acceptance
                criteria). */}
              <Card>
                <Leaderboard loadData={loadLeaderboardDataProp} seasonId={seasonId} />
              </Card>

              {showSeasonSetupCard && (
```
(The pre-existing `{showSeasonSetupCard && (...)}` block, `:2786-2803`, is
unchanged — its own conditional `<Divider />` still separates it from
whatever precedes it, now this new block instead of "Top events" directly.)

## 7. Design — test files

**7a. `CoachHome.test.tsx` — the harness fix (corrects §3's citation error;
this is genuinely new code, not a reuse).**

Add an import:
```ts
import { defaultLoadLeaderboardData } from '../outreach/Leaderboard';
```
Change `renderAsUser` (`:133-155`) to merge a safe fixture default for the
new prop before spreading the caller's `props` — the first "default-prop
object merge" this file has needed, because unlike `loadData`/
`loadDashboardData`/`nowFn`, none of the ~90 pre-existing `renderAsUser(...)`
call sites could possibly have supplied `loadLeaderboardData` (the prop did
not exist before this task), so requiring every one of them to be touched
individually is the wrong fix — a single harness-level default is:
```ts
function renderAsUser(
  user: AuthUser | null,
  props: Parameters<typeof CoachHome>[0] = {},
  loadActiveSeason: LoadActiveSeasonFn = async () => FIXTURE_ACTIVE_SEASON,
): void {
  // T203: CoachHome's own default `loadLeaderboardData` is now the real,
  // unconfigured-in-jsdom Supabase loader. Every pre-existing call site
  // below predates this prop and cannot have overridden it, so the fixture
  // default is merged here once rather than touching ~90 call sites; a
  // caller-supplied `loadLeaderboardData` in `props` still wins (spread
  // order below).
  const mergedProps: Parameters<typeof CoachHome>[0] = {
    loadLeaderboardData: defaultLoadLeaderboardData,
    ...props,
  };
  act(() => {
    root.render(
      <MemoryRouter>
        <SeasonProvider loadActiveSeason={loadActiveSeason}>
          <AuthProvider>
            {user === null ? (
              <CoachHome {...mergedProps} />
            ) : (
              <LoginAs user={user}>
                <CoachHome {...mergedProps} />
              </LoginAs>
            )}
          </AuthProvider>
        </SeasonProvider>
      </MemoryRouter>,
    );
  });
}
```
Do not touch any existing `it(` body in this file — this is a harness-only
change, matching item 10's "adding tests/fixture plumbing, not editing
existing assertions" posture T157 already established for the identical
class of fix.

**7b. `DashboardPage.test.tsx` — the sixth `vi.mock` block (corrects "a
sixth... block will be needed" from a prediction into concrete code).**

`DashboardPage.tsx` renders `<CoachHome />` with **zero** props (§5), so a
per-test override is structurally impossible here — this file already solves
the identical problem for five other real defaults via module-level
`vi.mock(...)` blocks (`:52-181`). Add a sixth, immediately after the
existing `loaders/dashboard` mock (which ends `:181`), before the "Render
harness" comment (`:183`):
```ts
// T203: `CoachHome` (routed here for coach/admin) now also embeds a real
// leaderboard (`loaders/leaderboard.ts`'s `loadLeaderboardData`,
// `CoachHome.tsx`'s own new prop default), which hits the real,
// unconfigured-in-jsdom `getSupabaseClient()` unless mocked at the module
// level -- same class of gap the five mocks above already close for their
// own real defaults.
vi.mock('../../lib/supabase/loaders/leaderboard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase/loaders/leaderboard')>();
  return {
    ...actual,
    loadLeaderboardData: async (_seasonId: string) => ({ hours: [], students: [] }),
  };
});
```
Then add a reachability assertion to **both** existing role-dispatch tests
(`renders CoachHome for role "coach"`, `:272-304`; `renders CoachHome for
role "admin"`, `:306-332`) — proving the embed survives the full real
route dispatch, not just `CoachHome.test.tsx`'s own isolated harness (the
same "reachability from the actual entry point" discipline this project's
own T157 OUT-03 finding exists to enforce — a component's own test file
being an importer says nothing about whether a user can reach it):
```ts
    expect(container.textContent).toContain('Season Volunteer Leaderboard');
```
(Add this line to each `it(` body; do not otherwise modify either test.)

## 8. Acceptance criteria

**Every criterion lives in `CoachHome.test.tsx` or `DashboardPage.test.tsx`
— never in `Leaderboard.test.tsx`** (a criterion satisfiable there reproduces
the exact blind spot this task exists to close, matching T157's §8
preamble). For each mutation-marked criterion: apply it, run the affected
test(s), paste the actual failure output, then restore byte-identically and
confirm green again — "I predict this would fail" is not evidence.

1. **Reachability + real `seasonId` threading (`CoachHome.test.tsx`).** With
   `loadData: fixtureLoadData`, `loadDashboardData: fixtureLoadDashboardData`,
   and an explicit `loadLeaderboardData` override resolving a small,
   distinct, fabricated fixture (hours + a matching student, names not
   reused from `Leaderboard.tsx`'s own shipped fixtures or this file's
   existing ones — item 6), assert the populated leaderboard list renders
   with the expected entry, and assert your `loadLeaderboardData` spy was
   called with `FIXTURE_ACTIVE_SEASON.id` — never `'season-placeholder-
   current'` (mirrors T155's own established idiom, `CoachHome.test.tsx:1197`).
   **Mutations:** (a) delete the `<Card><Leaderboard .../></Card>` block
   entirely — confirm the assertion fails. (b) revert `seasonId={seasonId}`
   to omitted — confirm the "never the placeholder" assertion fails (falls
   back to `Leaderboard`'s own `PLACEHOLDER_SEASON_ID` default). Restore
   both.

2. **Reachability via the real dispatcher (`DashboardPage.test.tsx`).** The
   two new `toContain('Season Volunteer Leaderboard')` assertions (§7b).
   **Mutation:** same as criterion 1(a), applied at the `CoachHome.tsx` call
   site — confirm both the "coach" and "admin" tests now fail. Restore.

3. **Harness safety — the merged default is load-bearing, not decorative.**
   In one existing populated-state test (or a small new one), assert
   `container.textContent` contains `'No volunteer hours recorded yet'`
   (`Leaderboard`'s own honest empty-state text when its fixture default's
   filtered hours come back empty against a non-placeholder `seasonId`) and
   does **not** contain `"Couldn't load the leaderboard"` (its error-state
   text). **Mutation:** remove the `mergedProps` merge in `renderAsUser`
   (spread `props` directly again) — confirm the same test now shows
   `"Couldn't load the leaderboard"` instead (the real, unconfigured loader
   rejects in jsdom). Restore.

4. **CSS-nesting — structural proof (the jsdom-provable ceiling; read §0
   before assuming more is possible here).** `Card`/`Section` both reflect a
   real, stable, intentionally-public class name for exactly this purpose
   (`node_modules/@astryxdesign/core/dist/utils/themeProps.js`'s own doc:
   *"so consumers target stable data-attribute selectors rather than
   collision-prone bare class names"*) — `astryx-card`/`astryx-section`.
   `CoachHome.tsx` uses no `Section` anywhere else, so
   `container.querySelector('.astryx-section')` uniquely resolves to
   `Leaderboard`'s own root. Assert
   `container.querySelector('.astryx-section')!.closest('.astryx-card')` is
   **not null** — proving `Card` is a genuine DOM ancestor of `Leaderboard`'s
   own `Section` root, not merely present elsewhere on the page (this holds
   regardless of viewer role — an admin viewer's page also has the
   season-setup `Card` elsewhere, but `.closest()` only walks ancestors, so
   it cannot false-positive off a sibling `Card`). **Mutation:** remove the
   `<Card>` wrapper (mount `<Leaderboard>` bare). Confirm `.closest('.astryx-
   card')` now returns `null`. Restore.

5. **CSS-nesting — the live-browser measurement (required, not optional;
   see §0 for why jsdom cannot substitute).** Using a real dev server +
   Playwright (matching this project's own established methodology for
   exactly this class of claim — T002b's contrast measurement, T006-T008's
   focus/contrast checks, T142's `minWidth` measurement), as a signed-in
   coach with a real active season, render `/` and measure, on the shipped
   `<Card><Leaderboard/></Card>` mount's own `.astryx-section` element:
   (a) its rendered outer-box width matches its sibling sections' width
   (e.g. compare against the "Top events by student hours" `VStack`'s own
   bounding rect) to within a few pixels (Card's own border width) — proving
   the fix actually closes the gap, not just that it changes something.
   Separately, build a **throwaway** reference-only probe (this project's
   `*.throwaway.*` convention, already excluded from the suite by
   `vite.config.ts:36`; delete it before finishing) that mounts `<Leaderboard>`
   bare (no `Card`) in the same page position, and confirm its `.astryx-
   section` renders measurably **wider** than its would-be siblings by
   approximately 24px per side (this packet's own traced numbers, §3) — this
   is the counterfactual proof that the hazard is real, not merely that the
   fix exists. Paste both measurements (numbers, not screenshots alone) into
   your output doc.

6. **Build/type safety.** `tsc` passes with the extended `CoachHomeProps`/
   `CoachHomeContentProps` shapes. Verify by actually running the compiler.

7. **Regression baseline — do not pin a number.** Record your own
   `CoachHome.test.tsx` and `DashboardPage.test.tsx` pass counts at your own
   dispatch SHA before changing anything, then confirm
   baseline-count-plus-your-new-tests after, zero baseline tests broken.

8. **No PII** (item 6): any new fixture names in criterion 1's override are
   fabricated, distinct from `Leaderboard.tsx`'s own shipped fixture names
   and from this file's/`DashboardPage.test.tsx`'s existing fixture names
   (so a bug returning the wrong constant can't accidentally satisfy two
   different tests at once — same discipline `DashboardPage.test.tsx:69-73`'s
   own comment already states for its `loadStudentHomeData` mock).

9. **Astryx props** (ledger-wide rule): confirm no new Astryx prop is
   introduced anywhere in this task — `Card` is used with zero props exactly
   as already verified in this file's own module doc (`:301-302`); state
   this explicitly in your output doc rather than leaving it implicit.

## 0. Epistemic status (read before assuming §8 criterion 5 can be skipped)

I (the packet author, `foreman-planner`) have no Bash tool — I cannot
execute anything, including a live browser. Everything CSS-related above is
one of two things, kept distinguishable:
- **Read-verified by me, directly, this packet**: the literal compiled CSS
  rules in `node_modules/@astryxdesign/core/dist/astryx.css` (a different
  worktree with `node_modules/` installed, same lockfile lineage — this
  worktree itself has no `node_modules/` yet, see §5), the theme override in
  `theme.css:518-519`, the spacing token values in `tokens.stylex.js`, and
  the fact that `Card`/`Section`/`LayoutContent` are the only three things
  that call `container(...)` anywhere in the installed package (grepped).
  This is real, numeric, and traced end-to-end — stronger evidence than the
  original ledger row's doc-comment citation, which I found to be
  incorrectly described as unverifiable (§3).
- **Not executable by me at all, stated plainly**: whether the real,
  running app actually renders the numbers I traced (a live Playwright
  measurement requires a running dev server, which requires `npm install`
  in a worktree that doesn't have `node_modules/` yet, which requires Bash).
  Criterion 5 is where this gets closed out — by the worker, who has Bash.
  Do not skip it on the reasoning that the mechanism is "already proven" by
  this packet's source tracing; source tracing and a live render measuring
  the same thing are different claims, and this project's own item 21
  ("existence is verified, not assumed") is exactly the discipline that
  distinguishes them.

## 9. Worker tier and checker assignment

**Worker: `worker-implementer`, tier `sonnet`, own worktree** (item 23 — this
packet has five mutation-marked criteria). Checked explicitly against all
four of item 18's opus triggers, not merely accepted from the ledger row:
- Not a migration file.
- Not an RLS policy or `security definer` helper.
- Not a SQL view / metric math.
- Not auth/session/role-resolution/permission logic — `Leaderboard` has no
  role gate to add or touch (§4), and this task adds no new authorization
  predicate of any kind (contrast with T157's `resolveParentLinkedRosterStudents`,
  which is exactly why T157 was opus and this is not). Per constitution item
  25's second obligation, this task is not bumped to opus merely because
  "family/roster data" is nearby in the file — there is no new logic here
  that reads or gates on it.

**Checker: `checker-reviewer`, default tier (sonnet).** Not bumped to opus:
no PII/security dimension (item 25 — this is a UI mount plus a test-harness
fix), and the CSS mechanism this checker must verify is now traced to exact,
numeric, sourced values (§3/§8 criterion 5) rather than left as an open
question requiring senior judgment to resolve from scratch. The checker's
job is to re-execute all five mutation-marked criteria independently
(including criterion 5's live-browser measurement) and confirm the numbers,
not to re-derive the CSS mechanism from zero.

**Premise gate scope (item 19b): light gate, one round, not skipped.**
This rolls out an already-twice-proven pattern (T157 same-folder,
T177 cross-folder) to a component with no role gate of its own — the
mount-pattern half needs no adversarial re-audit. What still needs a check
before dispatch is narrow and concrete: (a) does §7a's harness-merge code
actually compile and behave as prescribed (I have no Bash — I could not
execute it), and (b) is §6b's prop-threading internally consistent (no
missed rename, no shadowing) — both mechanical, both checkable by a single
non-adversarial read-plus-optional-execution pass, not a multi-round
adversarial gate. Do not skip the gate entirely: the harness fix in §7a is
genuinely new code this project has not shipped before (unlike everything
else in this packet, which is either read-verified against real files or a
direct rollout of a proven pattern), and a gate with Bash access can
actually execute it against a real `npm test` run before a worker's time is
spent on it, which I could not.

## 10. Deferral policy

If you discover a genuine out-of-scope defect or gap not already named
above, do not fix it and do not only leave a code comment (item 20) — report
it in your output doc:
```
FOLLOW-UP NEEDED (item 20):
- What: <one sentence>
- Why out of scope for T203: <one sentence>
- Suggested Allowed Files for the follow-up: <file list>
- Evidence: <symbol/citation>
```
One deferral already made by this packet, disclosed so you don't need to
rediscover it: `Leaderboard.tsx`'s own module-doc header still says "a
`Section` on `/outreach`" (§5) — stale, trivial, Forbidden file, not fixed
here.

## 11. Required worker output

- Every commit states its SHA (item 21); explicit pathspecs only, never
  `git add -A`/`git add .` (item 22).
- Your output doc includes: files touched, the executed mutation output for
  all five mutation-marked criteria (1a, 1b, 2, 3, 4), criterion 5's actual
  measured numbers from both the shipped and throwaway-probe renders, the
  `tsc` result, before/after test counts for both files (criterion 7), and
  any `FOLLOW-UP NEEDED` items.
- Confirm the throwaway probe file used for criterion 5 was deleted before
  your final commit.
- State plainly which of this packet's prescriptions (§6/§7) you followed
  as-written vs. deviated from, and why, if any.
- Do not mark your own work complete — a separate checker validates the
  actual artifact.

## 12. Constitution excerpts relevant to this task

- Item 6: no PII — fabricated names only (§8 criterion 8).
- Item 10: existing tests must pass; this task adds tests/fixture plumbing
  and edits two `it(` bodies to append one new assertion line each (§7b) —
  no existing assertion is removed or changed in meaning.
- Item 12: `Leaderboard` already ships its own full DES-12 lifecycle (§4);
  this task does not need to build a new one.
- Item 18: worker tier sonnet, all four triggers explicitly checked (§9).
- Item 19b/19c: gate scope reasoned explicitly (§9); every citation in this
  packet re-verified against the real repository, two of the ledger row's
  own claims corrected rather than carried forward (§3).
- Item 20: one deferral disclosed with a follow-up template (§10).
- Item 21/22: commit SHA + explicit pathspecs (§11).
- Item 23: mutation experiments in the worker's own worktree.
- Item 25: tier not bumped for proximity to family/roster data absent new
  logic that reads or gates on it (§9); fixture hygiene (item 6) still
  applies undiminished.
