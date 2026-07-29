# Worker Output: T143 — team chips must honour `teams.color` (UXC-05, part 2 of 3)

## Packet SHA verified

`b521ab0746a2010fa2e8b52d15767e586a4e1888`

Confirmed via `git log -1 --format=%H -- docs/swarm/active/T143-worker-packet.md`
before writing this doc, matching the SHA given in the dispatch prompt.

## FIRST — merge result

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```

Fast-forward merge, **no conflicts**. `Updating 2146255..b521ab0`, 130 files
changed (this worktree had not yet picked up the working branch's history —
this packet file itself only existed after the merge).

## Criterion 1 — the new `select()` string and every hop

New `select()` string (`src/lib/supabase/loaders/outreach.ts`, `queryAllTeams`):

```ts
const result = await client.from('teams').select('id, name, color').order('sort_order', {
  ascending: true,
});
```

(previously `select('id, name')`).

Every hop `color` now passes through, unchanged end to end:

```
client.from('teams').select('id, name, color')   loaders/outreach.ts (queryAllTeams)
  → TeamDbRow { id, name, color }                 loaders/outreach.ts (interface, required)
  → mapTeamDbRowToTeamOption                       loaders/outreach.ts
  → TeamOption { id, name, color }                 OutreachDetail.tsx (interface, required)
      passed straight through as `teams={teams}`   OutreachDetail.tsx (`<AttendancePanel teams={teams} .../>`)
  → AttendancePanelTeam { id, name, color }         AttendancePanel.tsx (interface, required;
                                                     structurally duck-typed against `TeamOption`,
                                                     not imported — same "circular import avoided"
                                                     reason module doc #3 already documents)
  → resolveTeamBadgeVariant(student.teamId, teams)  AttendancePanel.tsx render site (was line 767,
                                                     `pickTeamBadgeVariant(student.teamId)`)
  → <Badge variant={teamBadgeVariant} label={teamName} />
```

`color` is `string` at every hop (not `TokenColor`) because `teams.color` has
no check constraint — it is free text. The one place a `TokenColor`-shaped
value is required is inside the resolver, which handles anything else by
falling back (criterion 4).

## Criterion 2 — required, not optional

`color: string` (no `?`) at all three construction/interface sites:

- `TeamDbRow` (`loaders/outreach.ts`)
- `TeamOption` (`OutreachDetail.tsx`)
- `AttendancePanelTeam` (`AttendancePanel.tsx`)

Every object-literal construction site was forced by `tsc` to supply a real
value — confirmed by running `npx tsc --noEmit` clean only after every one of
the following was updated (it failed with `TS2741`/`TS2739` "missing
property 'color'" errors before each fix, which is the intended compiler
policing effect):

- `FIXTURE_TEAMS` (`OutreachDetail.tsx`, `:504-505` now) — `team-ravens: 'blue'`, `team-titans: 'green'`
- `OutreachDetail.test.tsx:472` (`resolveCreatorName / formatScopeLabel pure-function proof`) — `team-ravens: 'blue'`
- `AttendancePanel.test.tsx` `TEAMS` fixture (`:146-149`) — `team-ravens: 'blue'`, `team-titans: 'orange'`
- Every new fixture added for the criterion 3/4/render tests (see below)

Not made optional anywhere. No justification needed since the default
(required) was used throughout.

## Criterion 3 — the decisive test

**Team used:** `team-ravens` (the packet's worked example).

**Hash colour:** computed directly from the real `pickTeamBadgeVariant`
implementation (verified by running it in Node before writing any test,
and again asserted inside the test itself):

```
pickTeamBadgeVariant('team-ravens') === 'cyan'
```

**Stored colour:** `'red'` (chosen deliberately different from `'cyan'`).

**Proof they differ:** asserted directly in the test —
`expect(storedColor).not.toBe(hashColor)` — before asserting anything about
the resolver's output, so the test would fail loudly (not silently pass) if
the hash ever stopped producing `cyan` for this id.

**The assertion** (`AttendancePanel.test.tsx`, `resolveTeamBadgeVariant /
mapStoredColorToBadgeVariant` describe block):

```ts
const hashColor = pickTeamBadgeVariant('team-ravens');
const storedColor = 'red';
expect(hashColor).toBe('cyan');
expect(storedColor).not.toBe(hashColor);

const teamsWithStoredColor: AttendancePanelTeam[] = [
  { id: 'team-ravens', name: 'Ravens', color: storedColor },
];
expect(resolveTeamBadgeVariant('team-ravens', teamsWithStoredColor)).toBe('red');
expect(resolveTeamBadgeVariant('team-ravens', teamsWithStoredColor)).not.toBe('cyan');
```

A second, render-level test (`<AttendancePanel /> team chip honours the
stored teams.color` describe block) additionally proves it at the DOM level,
against the real rendered `Badge` (`data-variant` attribute, confirmed by
reading the installed `@astryxdesign/core` `Badge.js`/`themeProps.js` source
— every `Badge` reflects its resolved `variant` as `data-variant`):

```ts
const teamsWithStoredColor: AttendancePanelTeam[] = [
  { id: 'team-ravens', name: 'Ravens', color: 'red' },
  { id: 'team-titans', name: 'Titans', color: 'default' },
];
renderPanel({ teams: teamsWithStoredColor, loadAttendance: async () => [] });
await flushMicrotasks();

const ravensChip = Array.from(container.querySelectorAll('[data-variant]')).find(
  (el) => el.textContent === 'Ravens',
);
expect(ravensChip?.getAttribute('data-variant')).toBe('red');
expect(ravensChip?.getAttribute('data-variant')).not.toBe('cyan');
expect(ravensChip?.textContent).toBe('Ravens'); // constitution item 15 — text label always present
```

## Criterion 4 — fallback behaviour, all three cases

`mapStoredColorToBadgeVariant` returns `undefined` for each; `resolveTeamBadgeVariant`
then falls back to `pickTeamBadgeVariant(teamId)`, and does not throw:

| Stored value | `mapStoredColorToBadgeVariant` | `resolveTeamBadgeVariant` |
|---|---|---|
| `'default'` | `undefined` | falls back to `pickTeamBadgeVariant(teamId)` |
| `'gray'` | `undefined` | falls back to `pickTeamBadgeVariant(teamId)` |
| `'crimson-legacy'` (unrecognised free text, mirrors `TeamsTab.tsx`'s own `team-legacy-alpha` fixture concept, independently reimplemented per the packet — `TeamsTab.tsx` was not imported from) | `undefined` | falls back to `pickTeamBadgeVariant(teamId)` |

All three asserted with `expect(() => resolveTeamBadgeVariant(...)).not.toThrow()`
plus an equality check against the real `pickTeamBadgeVariant(teamId)` output
(not a hardcoded literal, so the test stays correct if the hash function ever
changes). A fourth case — a team id absent from `teams` entirely — is also
tested and falls back the same way.

## Criterion 5 — `pickTeamBadgeVariant` determinism

Unchanged, signature unchanged, still exported. Its existing pinned assertion
(`AttendancePanel.test.tsx`) still passes as-is:

```ts
expect(pickTeamBadgeVariant('team-ravens')).toBe(pickTeamBadgeVariant('team-ravens'));
```

(Comment on that `it` block updated to note "unchanged by T143" — the
assertion text itself was not touched.)

## Constitution item 15 (accessibility)

Colour was never made the sole carrier of meaning: the `Badge`'s `label`
prop is always the real team name (`resolveTeamName`, unchanged), rendered
alongside whatever colour resolves. The render-level test above explicitly
asserts `ravensChip?.textContent === 'Ravens'` regardless of which colour
path fired.

## Files changed

- `src/lib/supabase/loaders/outreach.ts` — `TeamDbRow` gains required `color:
  string`; `queryAllTeams`'s `select()` grows `color`; `mapTeamDbRowToTeamOption`
  carries it through. Nothing else in this file touched.
- `src/pages/outreach/OutreachDetail.tsx` — `TeamOption` gains required
  `color: string`; `FIXTURE_TEAMS` (`:504-505`) gains a colour for each of
  its two entries (`'blue'`, `'green'`). Nothing else in this file touched.
- `src/pages/outreach/OutreachDetail.test.tsx` — the one `TeamOption`
  object-literal test site (`:472`, `resolveCreatorName / formatScopeLabel
  pure-function proof`) gains `color: 'blue'` so it still compiles.
- `src/pages/outreach/AttendancePanel.tsx` — `AttendancePanelTeam` gains
  required `color: string`; new `mapStoredColorToBadgeVariant` (pure,
  exported) and `resolveTeamBadgeVariant` (pure, exported) added next to
  `pickTeamBadgeVariant`, which is unchanged and still exported; the `:767`
  render site (now shifted a few lines by added module-doc prose) calls
  `resolveTeamBadgeVariant(student.teamId, teams)` instead of
  `pickTeamBadgeVariant(student.teamId)`. Module doc #3 amended in place
  (dated 2026-07-29, T143) to describe the new resolver rather than leave
  stale documentation claiming `pickTeamBadgeVariant` is the only input.
- `src/pages/outreach/AttendancePanel.test.tsx` — `TEAMS` fixture gains
  `color`; new imports (`mapStoredColorToBadgeVariant`, `resolveTeamBadgeVariant`);
  new `describe('resolveTeamBadgeVariant / mapStoredColorToBadgeVariant ...')`
  block (criteria 3/4, pure-function level, 5 new `it`s); new
  `describe('<AttendancePanel /> team chip honours the stored teams.color ...')`
  block (criterion 3, render/DOM level, 1 new `it`); existing determinism
  `it` comment updated (assertion itself unchanged).
- `docs/swarm/active/T143-worker-output.md` (this file, new).

## Explicitly out of scope — confirmed untouched

- `src/pages/roster/TeamsTab.tsx`, `src/pages/roster/StudentsTab.tsx` —
  not touched (`git status --porcelain` confirms).
- `src/lib/supabase/loaders/teams.ts` — not touched.
- `supabase/migrations/**` — not touched, no schema change.
- T138's territory (`CoachHome.tsx`, `EventsTab.tsx`, `CalendarPage.tsx`) —
  not touched.
- `OutreachEventDialog.tsx` (its own independent `OutreachTeamOption` type,
  `{id, name}`, is unrelated to `TeamOption`/`AttendancePanelTeam` and was
  confirmed by grep not to import either — left alone, still `{id, name}`,
  out of this packet's scope).

## Test count

Started from baseline **1469 across 63 files**. Ended at **1474 across 63
files** — 5 new tests added (the criterion-3/4 pure-function describe
block's 4 `it`s + the render-level DOM `it`), no test files added or
removed, no existing test deleted or changed in assertion meaning (only one
comment-string update, on the `pickTeamBadgeVariant` determinism `it`).

## Full command output

### `npx tsc --noEmit`

Clean, no output, exit 0.

### `npx vite build`

```
vite v5.4.21 building for production...
transforming...
✓ 2387 modules transformed.
rendering chunks...
computing gzip size...
[... normal asset list, unchanged shape from baseline ...]
(!) Some chunks are larger than 500 kB after minification. [pre-existing warning, unrelated to this task]
✓ built in 5.56s
```

Exit 0, no errors.

### `npm run format:check`

First run flagged `src/pages/outreach/AttendancePanel.test.tsx` (whitespace
only, from the new test blocks); ran `npx prettier --write` on that one file
and re-ran `format:check`, which then reported:

```
Checking formatting...
All matched files use Prettier code style!
```

### `npx eslint .`

```
✖ 355 problems (0 errors, 355 warnings)
```

**0 errors.** Warning count is **355**, baseline was **353**, a difference
of **+2**. Both new warnings are `react-refresh/only-export-components` on
the two new exported pure functions in `AttendancePanel.tsx`
(`mapStoredColorToBadgeVariant`, `resolveTeamBadgeVariant`) — that file
already exports 10 non-component pure functions (`rowKey`,
`computeSessionDurationHours`, `formatHours`, `isAttendingStatus`,
`sortRosterByTeam`, `resolveTeamName`, `pickTeamBadgeVariant`,
`sortAttendanceSessions`, `computeSessionAttendanceTotalHours`, plus the
formatter, each already producing this same warning before this task) next
to the `AttendancePanel` component, the same established
"exports both a component and its pure helpers, react-refresh warns on
every one" pattern this file (and sibling files, e.g. `Leaderboard.tsx`,
`MarkDayCompleteDialog.tsx`) already carried before this task. Not a new
violation category, not addressed by splitting the file into two, since the
packet's Allowed Files for this task did not ask for that restructuring and
the existing file already accepts this pattern for its other nine exports.

### `npx vitest run`

```
 Test Files  63 passed (63)
      Tests  1474 passed (1474)
```

All green, 0 failures.

## Anything unverified

- The exact rendered `data-variant` DOM attribute name/behaviour was
  confirmed by reading the installed `@astryxdesign/core` package source
  (`Badge/Badge.js`, `utils/themeProps.js`) directly, not merely assumed —
  and then further confirmed by the render-level test actually passing
  against the real component. Nothing here is unverified.
- I did not run `npm run test:e2e` / Playwright (not requested by this
  packet's acceptance criteria, which list `tsc`/`vite build`/
  `format:check`/`eslint`/`vitest` only). Unverified: whether any Playwright
  spec references the old `pickTeamBadgeVariant`-only chip colour — a
  repo-wide grep for `pickTeamBadgeVariant` and `data-variant` inside any
  `*.spec.ts`/e2e directory found none, but I did not execute the e2e suite.
- Do not certify this work — an independent checker should re-derive the
  hash value, the select-string diff, and the test/lint/build counts
  independently.

## Dispute

None. The packet was followed as written; no blocker encountered.

---

## Addendum 1 — merge onto `origin/claude/swarm-plan-zl575z` @ `24442fa` (T145 landed)

Coordinator asked for the branch to be brought up to date before checking
(it was 15 commits behind). `git fetch origin && git merge
origin/claude/swarm-plan-zl575z` produced a **clean automatic merge, no
conflicts** (merge commit `cbcd100`). T145 touched `src/lib/eventTypeBadge.ts`
(new), `CalendarPage.tsx`, `EventsTab.tsx`, `CoachHome.tsx` — none of which
this task's commit (`f13dedb`) touched, so there was nothing to reconcile.
Confirmed the merged tree still uses T145's shared-map approach for the
DES-04 legend (`CalendarPage.tsx` imports `EVENT_TYPE_BADGE`/`EVENT_TYPE_ORDER`
from `../../lib/eventTypeBadge` and renders the legend via
`EVENT_TYPE_ORDER.map(...)`, no hardcoded badge object reintroduced).

Diff of `f13dedb` against the new merge base (`b521ab0`, unchanged) is still
exactly **6 files, +530/-9** (`git diff f13dedb^ f13dedb --stat`), matching
the true scope of this task's own work.

**Falsifiability check performed at the coordinator's request:** temporarily
reverted `AttendancePanel.tsx`'s render site back to
`pickTeamBadgeVariant(student.teamId)` (the pre-fix call) and re-ran
`AttendancePanel.test.tsx`. The render-level DOM test (`<AttendancePanel />
team chip honours the stored teams.color`) failed exactly as expected:
`AssertionError: expected 'cyan' to be 'red'`, all other 36 tests in that
file unaffected. Restored the file byte-for-byte (`git status --porcelain`
came back empty, confirming an exact match to the committed version) and
reran the full suite (green, 1474/1474).

**Full verification re-run on the merged result** (integration-branch lint
baseline per coordinator: 352 warnings / 0 errors):

- `npx tsc --noEmit` — clean.
- `npx vite build` — clean (`✓ built in 6.68s`), same pre-existing chunk-size
  advisory only.
- `npm run format:check` — `All matched files use Prettier code style!`
- `npx eslint .` — **0 errors, 354 warnings** (baseline 352, +2 — same two
  `react-refresh/only-export-components` warnings on
  `mapStoredColorToBadgeVariant`/`resolveTeamBadgeVariant` already disclosed
  above; unchanged in cause, only the baseline number shifted because T145
  added its own shared module).
- `npx vitest run` — **63 files passed, 1474 tests passed**, 0 failures.

## Addendum 2 — MINOR fix: prototype-chain leak in `mapStoredColorToBadgeVariant`

Checker (via coordinator) found: `STORED_COLOR_TO_BADGE_VARIANT` was a plain
object literal indexed directly by unvalidated free text
(`STORED_COLOR_TO_BADGE_VARIANT[color]`), so a stored `teams.color` value of
`'constructor'` or `'toString'` resolved through JS's own inherited
`Object.prototype` chain to a real function value instead of `undefined`.
`resolveTeamBadgeVariant`'s `?? pickTeamBadgeVariant(...)` fallback never
fires for a function (not nullish), so the function itself would flow into
`Badge`'s `variant` prop. Reachable only via a direct DB write (the
`TeamsTab` swatch picker only ever writes one of the eleven known
`TokenColor` values), hence MINOR, not rework.

**Fix:** `mapStoredColorToBadgeVariant` now guards the lookup with
`Object.hasOwn(STORED_COLOR_TO_BADGE_VARIANT, color)`, returning `undefined`
for anything not an own property (`src/pages/outreach/AttendancePanel.tsx`).

**Verified the way the last fix was verified — fails before, passes after,**
not just "added the assertion and observed green":

1. Extended the criterion-4 test (`AttendancePanel.test.tsx`) with a fourth
   unrecognised value, `'constructor'` (a `team-proto` fixture team), and
   ran it **before** applying the `Object.hasOwn` fix:

   ```
   ✗ criterion 4 -- ... falls back to pickTeamBadgeVariant, without crashing
   AssertionError: expected [Function Object] to be undefined
   - Expected: undefined
   + Received: [Function Object]
     at src/pages/outreach/AttendancePanel.test.tsx:274
   ```

   This reproduces the checker's exact finding character for character
   (`mapStoredColorToBadgeVariant('constructor')` returning
   `function Object() { [native code] }` rather than `undefined`).

2. Applied the `Object.hasOwn` guard, re-ran the same test:

   ```
   ✓ src/pages/outreach/AttendancePanel.test.tsx (37 tests | 36 skipped)
   Tests  1 passed | 36 skipped (37)
   ```

3. Also directly re-ran the pre-existing `'every recognised TokenColor hue
   maps across...'` test to confirm the guard did not regress the nine real
   own-property hues — still green.

**Full verification re-run after the fix:**

- `npx tsc --noEmit` — clean.
- `npx vite build` — clean (`✓ built in 6.02s`).
- `npm run format:check` — `All matched files use Prettier code style!`
- `npx eslint .` — **0 errors, 354 warnings** (unchanged from Addendum 1 —
  the fix only changed internal logic in an already-exported function,
  no new export, no new warning).
- `npx vitest run` — **63 files passed, 1474 tests passed** (same total —
  the fourth case was added to the existing criterion-4 `it`, not a new
  `it`, so the count did not change).

## Files changed (cumulative, including this addendum)

- `src/pages/outreach/AttendancePanel.tsx` — `mapStoredColorToBadgeVariant`
  now uses `Object.hasOwn` instead of a bare index lookup.
- `src/pages/outreach/AttendancePanel.test.tsx` — criterion-4 test extended
  with a fourth `'constructor'` case (`team-proto` fixture), asserting the
  same fallback-to-hash behaviour as `'default'`/`'gray'`/`'crimson-legacy'`.
- `docs/swarm/active/T143-worker-output.md` (this addendum).

No other files changed in this pass.
