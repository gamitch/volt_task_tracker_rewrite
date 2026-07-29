# Worker Output: T140 — pass-through props for `AppShell`

## Packet SHA verified

`f6ebacaee377fc0b15aa7f95e580c850fc4cb451` (revision 3), confirmed via:

```
git log -1 --format=%H -- docs/swarm/active/T140-worker-packet.md
f6ebacaee377fc0b15aa7f95e580c850fc4cb451
```

Matches the SHA named in the dispatch prompt, both before writing code and
again immediately before writing this doc.

## Branch merge (FIRST step)

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```

Result: **fast-forward, no conflicts** (`Updating 2146255..f6ebaca`). 109
files changed. Working tree was clean before and after; no manual conflict
resolution was needed.

## The change

`src/app/AppShell.tsx`:

- Changed the `SeasonProvider` and `KpiStrip` imports to also import their
  own exported props types (`import type`): `SeasonProviderProps` from
  `./SeasonProvider`, `KpiStripProps` from `../components/kpi/KpiStrip`.
  Neither type is redeclared.
- Added and exported two new optional fields on `AppShellProps`.
- Changed `AppShell`'s signature from `AppShell({ children }: AppShellProps)`
  to `AppShell({ children, seasonProviderProps, kpiStripProps }: AppShellProps)`,
  spreading each into its child: `<SeasonProvider {...seasonProviderProps}>`
  and `<KpiStrip {...kpiStripProps} />`.
- The chromeless early-return branch (`if (isChromeless) return
  <>{children}</>;`) is untouched — still the first thing the function does,
  still no `SeasonProvider` anywhere near it.

### `AppShellProps` as shipped

```ts
export interface AppShellProps {
  children: ReactNode;
  seasonProviderProps?: Omit<SeasonProviderProps, 'children'>;
  kpiStripProps?: KpiStripProps;
}
```

`Omit<SeasonProviderProps, 'children'>` is used because `SeasonProviderProps`
itself declares `children: ReactNode` — `AppShell` supplies that one itself
(its own `children` prop), so re-exposing it would be redundant/conflicting.
`KpiStripProps` has no `children` field, so it passes through whole,
matching the packet's specified shape exactly.

## Criterion 2 — no-props call shape unchanged, 19 existing tests untouched

`AppShell.test.tsx`'s `renderAt(path, user)` helper (`:76`, the single
indirection point every test in the file goes through, cited by the packet)
was changed to `renderAt(path, user, appShellProps: Omit<AppShellProps,
'children'> = {})`, spreading `{...appShellProps}` into both `<AppShell>`
call sites (`:83` and `:86` before this change). Every one of the 19
pre-T140 `it(`-level invocations (9 top-level `it(` blocks + 1
`it.each(ORDINARY_CHROME_BEARING_PATHS)` generating 10 more — the packet's
own count, confirmed) still calls `renderAt(path, user)` with exactly two
arguments, so `appShellProps` defaults to `{}` there and
`<AppShell {...{}}>` renders identically to the old literal `<AppShell>`.

`git diff -- src/app/AppShell.test.tsx` confirms every pre-T140 `it(` body
is byte-for-byte untouched — the only changes inside the pre-T140 region of
the file are: two new `import type` lines, two new fixture constants
(`T140_FIXTURE_SEASON`, `T140_FIXTURE_KPI_DATA`), and the `renderAt` helper's
signature/JSX (an added optional third parameter with a safe `{}` default,
spread into both existing `<AppShell>` call sites). No existing assertion
line changed.

`npx vitest run src/app/AppShell.test.tsx` (scoped run): **23 tests passed**
— 19 pre-existing + 4 new (see below). All 19 pre-existing tests pass
unmodified, confirmed in the full suite run too (below).

## Criterion 3 — chromeless branch is byte-identical, proven with a test

Two lines of evidence:

1. **Source diff.** `git diff -- src/app/AppShell.tsx` shows the
   `if (isChromeless) { return <>{children}</>; }` block is completely
   unchanged — same early return, same lack of any `SeasonProvider`/`KpiStrip`
   nearby, before this change and after.
2. **A new test** (`'the chromeless branch stays unwrapped even when both
   pass-through props are supplied...'`) renders `/login` (chromeless) WITH
   both `seasonProviderProps.loadActiveSeason` and
   `kpiStripProps.loadKpiStripData` injected, each resolving a fixture whose
   content (`'T140 Fixture Regatta'`) is otherwise unreachable in this
   environment. It asserts: the page marker still renders, no
   `[role="main"]` region exists, no `'VOLT'` TopNav wordmark, and — the new
   part — neither injected fixture's content appears anywhere in the
   container. This is stronger than the pre-existing chromeless tests (which
   only ever exercised the no-props call shape): it proves that supplying
   the new props does not cause `SeasonProvider` to start mounting/fetching
   on a chromeless route, not merely that the old no-props behavior still
   holds.

The two pre-existing chromeless tests (`/login`, `/accept-invite`, plus the
T134 `it.each` chromeless-pattern tests for `/kiosk/:sessionId` and
`/meetings/live/:sessionId`) are unmodified and still pass, confirming the
default (no-props) chromeless behavior is also unchanged.

## New tests — four total (criterion 4)

All four live in a new `describe('T140 pass-through props
(seasonProviderProps / kpiStripProps)', ...)` block appended to
`AppShell.test.tsx`, after the pre-existing describe block's content (no
existing block was reordered or edited):

1. **`seasonProviderProps.loadActiveSeason` reaches `SeasonProvider` on its
   own.** Injects `async () => null` (the `'none'` state, per the packet's
   suggested cheapest-clean-route). Asserts the `'No active season yet'`
   banner text is present and the real default's error text
   (`"Couldn't load the active season"`) is absent. The real default loader
   in this unconfigured jsdom environment always rejects (never resolves
   `null`), so `'No active season yet'` can only appear if the injected
   loader ran — this is independent proof, with no `kpiStripProps`
   involved at all.

2. **`kpiStripProps.loadKpiStripData` reaches `KpiStrip`, entangled with
   `seasonProviderProps` as the packet requires.** Injects
   `seasonProviderProps.loadActiveSeason` resolving `T140_FIXTURE_SEASON`
   AND `kpiStripProps.loadKpiStripData` resolving `T140_FIXTURE_KPI_DATA`
   (whose `mostRecentEventTitle` is the distinctive string `'T140 Fixture
   Regatta'` — not a static label like `'Season hours'`, per the packet's
   explicit warning against weak assertions). Asserts `'T140 Fixture
   Regatta'` is present, and both the season-error and season-none banner
   texts are absent. Only the injected `loadKpiStripData` could have
   produced that string — the real default rejects before `KpiStrip` ever
   reaches its `'ready'`-status/`KpiStripContent` branch, and no other
   fixture anywhere in this file or in `KpiStrip.test.tsx` produces it.

3. **Chromeless-branch regression test** (described above under criterion
   3) — also serves as extra evidence that neither prop's seam leaks
   outside its intended mount point.

4. **Default (no-props) call shape still uses the real default loaders.**
   Calls `renderAt(routePaths.dashboard, COACH_USER)` with no third
   argument (i.e. the exact shape `App.tsx:30`'s own call uses) and asserts
   the pre-existing season-level error banner renders, and neither fixture
   string appears. This is additional evidence for criterion 2 specifically
   targeting the new prop-injection code paths (as opposed to the
   pre-existing tests, which predate the new props and only prove the
   pre-T140 render tree).

Each test asserts on content only the actually-injected fixture could have
produced (or, for test 4, content only the real default could have
produced) — not a static label that would pass regardless of which loader
ran.

## Test count

- Started from: **1445 tests across 62 files** (packet-stated baseline).
- Ended at: **1449 tests across 62 files** (same 62 files — no new test file
  was added; the 4 new tests were appended to the existing
  `AppShell.test.tsx`).
- Expected: 1445 + 4 = 1449. Matches exactly.
- No test outside `AppShell.test.tsx` changed, and no test anywhere
  regressed — the full run below is 100% green.

## Full command output — criteria 5–6

### `npx tsc --noEmit`

```
(no output, exit 0)
```

### `npx vite build`

```
✓ 2386 modules transformed.
...
dist/assets/index-CzN0ttpZ.js                   673.04 kB │ gzip: 198.38 kB

(!) Some chunks are larger than 500 kB after minification. ...
✓ built in 4.70s
```

(Pre-existing large-chunk advisory notice, unrelated to this task — same
notice a bare `main` build already emits, matching T139's own report of the
identical notice.)

### `npm run format:check`

```
> volt-team-portal@0.0.0 format:check
> prettier --check "src/**/*.{ts,tsx}" "!src/theme/volt.ts" "*.{ts,js,json,html}"

Checking formatting...
All matched files use Prettier code style!
```

(One intermediate run flagged `src/app/AppShell.test.tsx` before I ran
`prettier --write` on it — that formatting pass only reformatted the file I
had just edited, no logic change. The command above is the final,
passing state.)

### `npx eslint .`

```
✖ 353 problems (0 errors, 353 warnings)
  0 errors and 1 warning potentially fixable with the `--fix` option.
```

0 errors, 353 warnings — matches the packet's stated baseline exactly (0
errors / 353 warnings). Verified with `grep -n "AppShell"` against the full
eslint output: no match — neither `AppShell.tsx` nor `AppShell.test.tsx`
appears anywhere in the warning list, so no new warnings from this change.

### `npx vitest run`

```
 Test Files  62 passed (62)
      Tests  1449 passed (1449)
   Start at  00:49:36
   Duration  43.71s (transform 2.95s, setup 144ms, collect 30.88s, tests 47.20s, environment 34.95s, prepare 4.62s)
```

62 files (same count as baseline — no new test file), 1449 tests (baseline
1445 + this task's 4 new tests), 0 failures.

### Scoped `npx vitest run src/app/AppShell.test.tsx`

```
 ✓ src/app/AppShell.test.tsx (23 tests) 502ms

 Test Files  1 passed (1)
      Tests  23 passed (23)
```

23 = 19 pre-existing (9 `it(` + 10 from the `it.each`) + 4 new.

## The RLS-policy correction (not repeated here)

The packet's own correction is accurate per the packet text: `20260717000002_
rls.sql:74-79` declares two policies on `public.seasons` — `staff_all` (`for
all to authenticated using (is_staff())`) and `read_all` (`for select to
authenticated using (true)`) — not only `is_staff()`. I did not
independently re-verify the migration file's line numbers myself (I did not
open `20260717000002_rls.sql` in this task, since `SeasonProvider.tsx` and
the RLS policy are out of my allowed-files/blast-radius and the packet
states the citation as already-confirmed fact); I am relying on the
packet's own correction rather than re-deriving it, and I did not repeat the
stale "only policy is `is_staff()`" claim anywhere in this output doc or in
any code comment I wrote. `SeasonProvider.tsx` was not touched (forbidden
file, per the packet) — its stale module-doc comment remains as-is.

## Anything unverified

- I did not independently re-verify the `20260717000002_rls.sql:74-79`
  citation against the migration file itself — see above. This is stated
  plainly as unverified, not certified.
- I did not run a broader end-to-end/manual capture of any chrome-bearing
  page with these new props wired into an actual screenshot tool — the
  packet explicitly scopes "actually capturing any screenshot" out of this
  task, so this is intentionally unverified by design, not an oversight.
- Accessibility: no new a11y surface was introduced for the default
  (no-props) render path, since its rendered tree is byte-for-byte
  unchanged (same `<SeasonProvider>`/`<KpiStrip />` JSX shape, just with an
  added `{...undefined}` spread that is a no-op) — I did not run any
  additional accessibility audit tooling, per the packet's own instruction
  not to claim an audit not run.
- I did not go looking for other callers of `AppShell` besides `App.tsx`
  (confirmed forbidden/untouched) to check they still compile — `tsc
  --noEmit` and `vite build` both being clean across the whole project is
  the evidence that no other call site broke, since neither exists as a
  narrower scoped check for this.

I am not certifying this work as complete or correct — that is the
checker's determination.
