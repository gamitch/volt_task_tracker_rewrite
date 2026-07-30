# Worker Output: T139 — pass-through props for `RosterShell`

## Packet SHA verified

`5182584093658c5ddec8985efad388a484e88348` (revision 2), confirmed via:

```
git log -1 --format=%H -- docs/swarm/active/T139-worker-packet.md
5182584093658c5ddec8985efad388a484e88348
```

Matches the SHA named in the dispatch prompt.

## Branch merge (FIRST step)

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```

Result: **fast-forward, no conflicts** (`Updating 2146255..24f48be`). 104 files
changed. Working tree was clean before and after; no manual conflict
resolution was needed.

## The change

`src/pages/roster/RosterShell.tsx`:

- Added `import type { AdminTogglesProps } from './AdminToggles';` and added
  `type StudentsTabProps` / `type ParentsTabProps` / `type TeamsTabProps` /
  `type InvitesTabProps` to the existing value imports of each tab component
  (no new import statements for those four — extended the existing ones).
- `AdminToggles` remains `const AdminToggles = lazy(() => import('./AdminToggles'));`
  — untouched.
- Added and exported `RosterShellProps`, and changed `RosterShell`'s
  signature from `RosterShell(): ReactNode` to
  `RosterShell({ ... }: RosterShellProps = {}): ReactNode`, spreading each
  prop into its child (`<AdminToggles {...adminTogglesProps} />`,
  `<StudentsTab {...studentsTabProps} />`, etc.).

### `RosterShellProps` as shipped

```ts
export interface RosterShellProps {
  studentsTabProps?: StudentsTabProps;
  parentsTabProps?: ParentsTabProps;
  teamsTabProps?: TeamsTabProps;
  invitesTabProps?: InvitesTabProps;
  adminTogglesProps?: AdminTogglesProps;
}
```

All five optional, each typed via an imported (not redeclared) child props
interface, matching the packet's specified shape exactly.

## Criterion 2 — no-props call shape unchanged

`RosterShell.test.tsx`'s `renderRosterShell` helper (the single indirection
point every test in the file goes through) was changed from
`function renderRosterShell(user: AuthUser | null): void` to
`function renderRosterShell(user: AuthUser | null, props?: RosterShellProps): void`,
spreading `{...props}` into `<RosterShell {...props} />`. Every one of the 14
pre-T139 call sites still calls it with exactly one argument
(`renderRosterShell(SOME_USER)`), so `props` is `undefined` at those call
sites and `<RosterShell {...undefined} />` renders identically to the old
`<RosterShell />`.

`git diff` confirms the 14 pre-existing `it(...)` bodies are byte-for-byte
untouched — the only changes inside the pre-T139 region of the file are the
import line (`RosterShell, type RosterShellProps`) and the
`renderRosterShell` helper's signature/JSX described above; every test
assertion is unchanged. The module-boundary `loadStudentsTabData` mock the
packet cited at `:136-139` is unchanged in content (now at line 138, one line
shifted by the added import) and still passes, proving the real default
loader (not a props-supplied one) is still what a bare `<RosterShell />`
uses.

All 14 pre-existing tests pass (see full `npx vitest run` output below —
`RosterShell.test.tsx` is included in the 62-file, 1445-test green run).

## Criterion 3 — `lazy()` retained, `import type` used, full suite + build clean

- `AdminToggles` is still `const AdminToggles = lazy(() => import('./AdminToggles'));`
  — not converted to a static import.
- The props type comes in via `import type { AdminTogglesProps } from './AdminToggles';`.
- Full `npx vitest run`: **62 files passed, 1445 tests passed**, 0 failures.
- Full `npx vite build`: clean, exit 0. `AdminToggles` still emits as its own
  chunk (`dist/assets/AdminToggles-BBZTB2cN.js`, 2.70 kB), confirming the
  dynamic `import()` still code-splits as before.

I did not attempt to reconstruct "the five cycle-sensitive suites" or revert
`AdminToggles` to a static import to re-probe the T085-era failure — the
packet explicitly says not to, and the clean full-suite run plus clean build
is the whole check per the packet's own criterion 3 wording.

## Module docs #3 and #6 — corrected (not left)

Both were corrected in place, comment-only, scoped to the stale sentences
the packet identified:

- **Module doc #3** (`RosterShell.tsx`, originally `:76-87`): removed the
  quoted-but-now-nonexistent static import literal
  (`import { RosterShell } from '../pages/roster/RosterShell';`) and added a
  short "T139 UPDATE" paragraph noting T093 made `router.tsx`'s own import of
  this file lazy (`router.tsx:130`), so only the quoted literal was stale —
  the substance (router.tsx does render this component at `/roster`) is
  still true and was left standing.
- **Module doc #6** (originally `:115-150`): added a "T139 UPDATE" paragraph
  stating the T085 cycle was real *at T085 time* (kept as history, not
  deleted) but is no longer live today because T093 independently broke the
  `router.tsx -> RosterShell.tsx` edge; cites this task's own premise-gate
  finding (zero failures reverting to a static import, in an isolated
  worktree at this packet's SHA) as the empirical check, and states plainly
  that `lazy()` is kept anyway as unrequested-scope avoidance, not because
  reverting it is known to break anything today.

I did not rewrite either doc wholesale, and did not touch `router.tsx`.

## New tests — one per pass-through, five total (criterion 4)

All five live in a new `describe('<RosterShell /> pass-through props
actually reach each child (T139, D-2/D006)', ...)` block appended to
`RosterShell.test.tsx`. Each renders `RosterShell` with exactly one
`RosterShellProps` field set to an injected fixture loader whose fixture
content differs from the file's existing module-boundary-mocked defaults,
and asserts the injected fixture's data appears while the default's does
not (or, for `AdminToggles`, that the injected boolean actually reaches the
rendered `Switch`'s DOM `checked` state):

1. **`studentsTabProps.loadData`** — injects a loader resolving `{ students:
   [Priya Kapoor / team-solstice], teams: [Solstice], invites: [] }`.
   Asserts `container.textContent` contains `'Priya Kapoor'` and does **not**
   contain `'Amara Voss'` (the module-mocked default's fixture name), on the
   initially-active Students tab.
2. **`parentsTabProps.loadData`** — injects a loader resolving a
   `ParentsTabLoadResult` with parent profile `Dana Whitfield`. After
   clicking to the Parents tab, asserts `'Dana Whitfield'` is present and
   `'Renata Alvarez'` (the default) is not.
3. **`teamsTabProps.loadData`** — injects a `TeamsTabLoadResult` with team
   `Nightfall`. After clicking to the Teams tab, asserts `'Nightfall'` is
   present and `'Embercore'` (the default) is not.
4. **`invitesTabProps.loadData`** — injects an `InvitesTabLoadResult` with
   invite email `tomas.farrow.invite@example.com`. After clicking to the
   Invites tab, asserts that email is present and
   `'briar.holloway.invite@example.com'` (the default) is not.
5. **`adminTogglesProps.loadPrivacySetting`** — injects `async () => false`,
   as an admin, and uses `waitForAdminTogglesReady()` (the packet-cited
   `:352-361` harness) to wait past the `lazy()` chunk resolution. Asserts
   the rendered `input[type="checkbox"]`'s `.checked` is `false`, which
   would only be possible if the injected loader — not the module-mocked
   default (`MOCK_PRIVACY_SETTING = true`, set in this file's own
   `beforeEach`) — actually reached `AdminToggles`.

Each test proves the injected fixture is what renders, not merely that
*something* renders (an error state, or the pre-existing default fixture,
would fail each of these assertions).

## Test count

- Started from: **1440 tests across 62 files** (packet-stated baseline).
- Ended at: **1445 tests across 62 files** (same 62 files — no new test file
  was added; the 5 new tests were appended to the existing
  `RosterShell.test.tsx`).
- Expected: 1440 + 5 = 1445. Matches exactly.
- No test outside `RosterShell.test.tsx` changed, and no test anywhere
  regressed — full run below is 100% green.

## Full command output — criteria 5–6

### `npx tsc --noEmit`

```
(no output, exit 0)
```

### `npx vite build`

```
dist/assets/AdminToggles-BBZTB2cN.js              2.70 kB │ gzip:   1.30 kB
dist/assets/index-CSPTAMwe.js                     3.23 kB │ gzip:   1.33 kB
dist/assets/useKeyboardHint-B-ItqDVe.js           3.45 kB │ gzip:   1.80 kB
dist/assets/Timestamp-D6IpnB-D.js                 3.78 kB │ gzip:   1.62 kB
dist/assets/Kiosk-BefEgbtL.js                     4.07 kB │ gzip:   1.71 kB
dist/assets/SegmentedControlItem-C-Pcf0Vj.js      4.16 kB │ gzip:   2.02 kB
dist/assets/NumberInput-BxC9askh.js               4.48 kB │ gzip:   1.96 kB
dist/assets/DateRangeInput-DE7ap8OW.js            5.02 kB │ gzip:   2.08 kB
dist/assets/index-C1wJSU6u.js                     5.14 kB │ gzip:   2.28 kB
dist/assets/Switch-CJOOdGCM.js                    5.47 kB │ gzip:   1.80 kB
dist/assets/ScheduleMeetingsDialog-CyG-tyNK.js    6.52 kB │ gzip:   2.89 kB
dist/assets/CheckinResult-D1MvEsDw.js             6.87 kB │ gzip:   2.93 kB
dist/assets/EventFormLayout-CSPqTZeC.js           6.88 kB │ gzip:   2.91 kB
dist/assets/FormLayout-DSDnxuGV.js                7.06 kB │ gzip:   2.97 kB
dist/assets/CalendarPage-DA1f8gae.js              7.20 kB │ gzip:   2.89 kB
dist/assets/SeasonSettings-C_T8tr-Z.js            8.70 kB │ gzip:   3.36 kB
dist/assets/LiveConsole-DB_p7Z4K.js               9.73 kB │ gzip:   3.93 kB
dist/assets/TextInput-B8uRwa1l.js                 9.80 kB │ gzip:   4.10 kB
dist/assets/Selector-BbCUJe4b.js                 11.29 kB │ gzip:   4.74 kB
dist/assets/TimeInput-UM7C1_CG.js                14.45 kB │ gzip:   4.94 kB
dist/assets/index-Bu_9LSlu.js                    16.68 kB │ gzip:   6.28 kB
dist/assets/MultiSelector-DAbnxyOJ.js            16.85 kB │ gzip:   6.67 kB
dist/assets/Table-OZuxkw__.js                    18.06 kB │ gzip:   7.02 kB
dist/assets/Calendar-DFFYXrp3.js                 18.20 kB │ gzip:   6.65 kB
dist/assets/OutreachEventDialog-DGYTQUIk.js      21.84 kB │ gzip:   6.94 kB
dist/assets/ReportsShell-BvANn7OC.js             26.20 kB │ gzip:   7.86 kB
dist/assets/OutreachDetail-Boq6h8oc.js           27.90 kB │ gzip:   9.49 kB
dist/assets/MeetingsList-DzTsfI00.js             28.29 kB │ gzip:   8.49 kB
dist/assets/SettingsPage-Dqnt7n5T.js             31.65 kB │ gzip:  10.92 kB
dist/assets/OutreachList-D4rDTog6.js             36.54 kB │ gzip:  10.82 kB
dist/assets/RosterShell-RHJVrisg.js              45.59 kB │ gzip:  13.32 kB
dist/assets/DashboardPage-wkNWzoFn.js            51.73 kB │ gzip:  13.64 kB
dist/assets/PowerSearch-DgJknmFD.js              66.37 kB │ gzip:  20.39 kB
dist/assets/index-BxeA9tJG.js                   672.99 kB │ gzip: 198.35 kB

(!) Some chunks are larger than 500 kB after minification. ...
✓ built in 5.04s
```

(Pre-existing large-chunk advisory notice, unrelated to this task — same
notice a bare `main` build already emits.)

### `npm run format:check`

```
> volt-team-portal@0.0.0 format:check
> prettier --check "src/**/*.{ts,tsx}" "!src/theme/volt.ts" "*.{ts,js,json,html}"

Checking formatting...
All matched files use Prettier code style!
```

### `npx eslint .`

```
✖ 353 problems (0 errors, 353 warnings)
  0 errors and 1 warning potentially fixable with the `--fix` option.
```

0 errors, 353 warnings — matches the packet's stated baseline exactly (0
errors / 353 warnings). Verified with `grep -n "RosterShell"` against the
full eslint output that neither `RosterShell.tsx` nor `RosterShell.test.tsx`
appears anywhere in the warning list — no new warnings from this change.

### `npx vitest run`

```
 Test Files  62 passed (62)
      Tests  1445 passed (1445)
   Start at  23:53:12
   Duration  44.85s (transform 3.06s, setup 187ms, collect 31.21s, tests 50.43s, environment 34.95s, prepare 4.45s)
```

62 files (same count as baseline — no new test file), 1445 tests (baseline
1440 + this task's 5 new tests), 0 failures.

## Anything unverified

- I did not run a broader end-to-end/manual capture of `/roster` with these
  new props wired into an actual screenshot tool — the packet explicitly
  scopes "actually taking any screenshot" out of this task, so this is
  intentionally unverified by design, not an oversight.
- I did not independently re-verify the T085-era "five failing suites"
  claim or the T093 commit `d43fb3a` cited in the packet's history section
  — I took the packet's premise-gate finding as given, per its explicit
  instruction not to go reconstructing that list. If that finding is itself
  wrong, this task's module-doc #6 correction would inherit the error; I am
  not independently certifying it, only reporting what the packet stated and
  what my own clean full-suite/build run (criterion 3) separately confirms
  at this SHA.
- Accessibility: no new a11y surface was introduced for the default
  (no-props) render path, since its rendered tree is byte-for-byte unchanged
  — I did not run any additional accessibility audit tooling, per the
  packet's own instruction not to claim an audit not run.

I am not certifying this work as complete or correct — that is the
checker's determination.
