# Worker Output: T148 — light/dark/system theme control does nothing

Packet SHA pinned and verified: `d27b0d5c40d76ed6faa86858a6f88e78790a37c4`
(`docs/swarm/active/T148-worker-packet.md`, Revision 4). Verified two ways:
byte-for-byte diff against `git show d27b0d5...:docs/swarm/active/T148-worker-packet.md`
inside this worktree's own object database (the commit object was reachable
here even before the branch merge, since worktrees share one git object
store), and, after the `FIRST — merge the working branch` step below, `git
log -1 --format=%H -- docs/swarm/active/T148-worker-packet.md` in this
worktree resolves to that exact SHA.

**Do not mark this task complete. A checker verifies it.**

## Branch merge (packet's own "FIRST" step)

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```

Fast-forwarded cleanly (`2146255..d27b0d5`), no conflicts. This worktree's
HEAD was several commits behind `claude/swarm-plan-zl575z` at dispatch time
(missing T142–T150 packet/output docs and several unrelated source changes
from T131–T150 already merged upstream); the merge brought it current. No
manual conflict resolution was needed.

## Shapes built (vs. the packet's suggested signatures)

**`resolveThemeMode` (`src/lib/supabase/auth.ts`)** — matches the suggested
signature exactly: `resolveThemeMode(userId: string, client: SupabaseClient =
getSupabaseClient()): Promise<ThemeMode | null>`. `ThemeMode` is declared
locally in this file (`'system' | 'light' | 'dark'`), per Design section 1's
corrected resolution — not imported from `@astryxdesign/core/theme` or from
`SettingsPage.tsx`. Uses the same `createLoader` + `.select('theme_mode').eq('id',
id).maybeSingle().overrideTypes()` chain shape `resolveRole` already
establishes for this file. Resolves `null` for a missing row AND for an
invalid free-text value, mirroring `SettingsPage.tsx`'s own `isValidThemeMode`
validation posture without importing it (a private `isValidThemeMode` is
declared locally in `auth.ts` too — not exported, so it does not collide with
`SettingsPage.tsx`'s own exported function of the same name; two independent
declarations, per the packet's own accepted "three independent,
structurally-identical declarations" posture for the `ThemeMode` type).

**`ThemeModeProvider`/`useThemeMode()` (`src/app/ThemeModeProvider.tsx`)** —
modeled directly on `SeasonProvider.tsx`/`useActiveSeason()`, as specified:
context + injectable `loadThemeMode` seam (default = the stable, module-level
`resolveThemeMode` reference itself, not a wrapper arrow) + `refresh()` +
fail-loud `useThemeMode()` outside the provider. One deviation from a literal
reading of the packet: the exposed context value is `{ mode, refresh }`, not
a bare `ThemeMode` plus a separate `refresh` — this is exactly what the
packet's own Design section 3 requires (`useThemeMode()` "must also expose
`refresh`... so the hook's return value is an object, not a bare
`ThemeMode`"), so it is not actually a deviation, just confirming it was
built as specified. The `localStorage` seed/write helpers
(`getStorage`/`readStoredThemeMode`/`writeStoredThemeMode`,
`THEME_MODE_STORAGE_KEY = 'volt.themeMode'`) are module-private (not
exported), per Design section 2's explicit instruction.

## Byte-unchanged confirmations

- `src/app/guards.tsx` — not modified (absent from `git status --porcelain`;
  only imported `useAuth`/`AuthProvider`/`AuthUser`/`AuthModule`, all
  pre-existing exports).
- `src/test-utils/authHarness.tsx` — not modified; only `LoginAs` imported
  into `ThemeModeProvider.test.tsx` and `SettingsPage.test.tsx`, per the
  packet's explicit "importing `LoginAs` is expected" carve-out.
- `src/theme/theme.css`, `src/theme/volt.ts` — not modified (absent from
  `git status --porcelain`); no token/palette/contrast work anywhere in this
  task.
- `src/lib/supabase/auth.ts` — every pre-existing export (`resolveRole` and
  all six others) is byte-unchanged; the diff is a pure insertion (`git diff`
  shows only `+` lines after the existing `signOut` function, confirmed by
  inspection).
- `src/lib/supabase/auth.test.ts` — every pre-existing test is
  byte-unchanged; the diff is one new import line plus one new `describe`
  block appended at the end of the file (confirmed by inspection — no `-`
  lines outside diff-context markers).
- `src/main.tsx` — not touched at all (not in Allowed Files; confirmed
  `git diff --stat -- src/main.tsx` is empty). `App`'s new `themeModeProviderProps`
  prop is optional and defaults to `undefined`, so `main.tsx`'s existing bare
  `<App />` behaves identically to before.

## Criterion 5 — the flash fix, localStorage seed-before-network proof

`ThemeModeProvider.tsx`'s `mode` state uses a **lazy** `useState` initializer
(`useState(() => readStoredThemeMode() ?? 'system')`), so the read happens
synchronously on first render, before any effect or network call.

Test (`ThemeModeProvider.test.tsx`, "flash fix: seeds mode synchronously from
localStorage before the network resolves the real value — criterion 5"):
pre-seeds `localStorage` with `'light'`, renders with a `loadThemeMode` whose
promise is deliberately held open (never resolved during the first
assertion), and asserts `modeOf()` is `'light'` **immediately after the
synchronous `act(() => root.render(...))` call, with no `await` in between**.
Then flushes microtasks (which resolves `LoginAs`'s own fake session and
triggers the fetch effect, but the `loadThemeMode` promise is still held
open) and re-asserts `'light'` is still showing. Only then does the test
resolve the held promise to `'dark'`, flush again, and confirm both the
exposed `mode` and `localStorage` update to `'dark'`. This is the strict
sequencing the packet requires — the assertion is made before the network
call is allowed to finish, not just checked against the final settled state.

**First-ever-visit residual, explicitly acknowledged**: with no `localStorage`
entry present, the lazy initializer falls back to `'system'`
(`ThemeModeProvider.test.tsx`'s first test asserts this explicitly). This is
the honestly-disclosed limitation the packet names — there is nothing to seed
from on that visit, and the `index.html`-inline-script approach that would
avoid it does not work in this app (`Theme`'s own wrapper `<div>` sets
`color-scheme` explicitly and, as a descendant of `<html>`, overrides
whatever a pre-hydration script set there — see the packet's own "Negative
knowledge" section, cited verbatim in `ThemeModeProvider.tsx`'s module doc).
**Not a missed case — a known, accepted residual.**

## The three unhandled cases from Design section 2

1. **Resolved `null` with a real `localStorage` seed present** — kept, never
   overwritten. Tested twice: with a seed present (`'dark'` stays `'dark'`
   after a `null` resolve) and with no seed present (`'system'` default stays
   `'system'`). Normative per the packet, asserted directly.
2. **Rejected `resolveThemeMode`** — caught by a real `.catch`, logged via
   `console.error('ThemeModeProvider: failed to resolve theme_mode.', error)`,
   `mode` left exactly as it was showing. **Named the actual mechanism, not
   just a per-test assertion**: I ran the packet's own prescribed mutation
   experiment directly against this worktree (constitution item 23 — this is
   my own, isolated worktree, and the change was fully reverted afterward
   with a byte-for-byte diff check confirming zero residual):
   - With the `.catch` **in place**: `npx vitest run
     src/app/ThemeModeProvider.test.tsx` → `Test Files 1 passed (1)`, `Tests
     11 passed (11)`, no `Errors` line, exit 0.
   - With the `.catch` **removed** (`.then(...)` only, no `.catch`, same
     mutation the packet describes): the SAME rejection-case test's
     `expect(consoleErrorSpy).toHaveBeenCalledWith(...)` assertion itself
     failed (proving my own test genuinely exercises the catch, not just the
     mode value), AND the run additionally reported: `Vitest caught 1
     unhandled error during the test run` / `Errors 1 error` / `Test Files 1
     failed (1)` / `Tests 1 failed | 10 passed (11)` — the process-level
     signal the packet says is the real proof. `git diff` confirmed zero
     residual after restoring the file from a pre-mutation backup.
   - I did the same mutation/restore for criterion 7's `App.test.tsx` (see
     below) — both experiments were run and reverted before any commit.
3. **Logout, shared/kiosk browser** — disclosure only, not built, per the
   packet's own explicit instruction. `guards.tsx` is untouched. Stated here
   plainly: the `volt.themeMode` `localStorage` key is not user-scoped, so on
   a shared browser, user B's very first paint after user A signs out may
   show A's last-set theme for one frame until B's own `theme_mode` resolves
   and overwrites it. This is a known, accepted limitation, not a defect —
   see `ThemeModeProvider.tsx`'s own module doc for the full reasoning why no
   in-scope fix exists (an unguarded clear on `user === null` would be
   destructive, wiping the seed on every normal page load, permanently on a
   rejecting loader or a genuinely anonymous visit).

## Criterion 7 — the discrimination proof (strongest criterion in the packet)

`App.test.tsx` mocks `./lib/supabase/auth` via
`vi.mock('./lib/supabase/auth', async (importOriginal) => ({ ...actual,
getInitialSession: vi.fn(), subscribeToAuthStateChange: vi.fn(() => () =>
{}), resolveRole: vi.fn() }))` — the first application of this codebase's
existing partial-mock-via-`importOriginal` convention to this specific
module, per Design section 4. Four tests: authenticated + `'dark'` →
`data-theme="dark"`; authenticated + `'light'` → `data-theme="light"`;
authenticated + `'system'` → attribute **absent**; and an explicitly-mocked
anonymous session (`getInitialSession` resolves `null`, not just an omitted
override) → attribute absent, `loadThemeMode` never called, `resolveRole`
never called.

**Mutation reproduction against this tree** (constitution item 23, own
worktree, reverted after): temporarily reverted `ThemedShell` in `App.tsx` to
render `<Theme theme={voltTheme}>` with no `mode` prop (the pre-fix state),
ran `npx vitest run src/App.test.tsx`:
- **`'dark'` case**: `expected null to be 'dark'` — failed.
- **`'light'` case**: `expected null to be 'light'` — failed.
- **2 failed | 2 passed (4)** overall (the `'system'` and anonymous cases
  still passed, since both expect an absent attribute either way — exactly
  the packet's own prediction: "with the fix removed... both the `'dark'` and
  `'light'` cases fail").

Restored `App.tsx` from a pre-mutation backup; `git diff --stat -- src/App.tsx`
against that backup showed zero difference; re-ran `npx vitest run
src/App.test.tsx` → all 4 pass again.

## Criterion 8 — the live-update call-count proof

Unobservable via a fake `refresh` function (context value not exported,
`loadThemeMode` is the only injectable surface) — proved instead via an
injected loader's own call count, following `SeasonSettings.test.tsx:620-660`'s
template exactly. Two new tests in `SettingsPage.test.tsx`, both rendering
`<SettingsPage>` inside `<LoginAs user={...}><ThemeModeProvider
loadThemeMode={spy}>`:

- **Success**: 1 call after mount (`ThemeModeProvider`'s own fetch-on-mount
  effect, once `LoginAs`'s fake session resolves) → click a `RadioListItem` →
  await `onChangeTheme`'s resolution → **2 calls** (the second call is
  `refresh()` actually firing).
- **Rejection**: 1 call after mount → click a `RadioListItem` with a
  rejecting `onChangeTheme` → **stays at 1 call** (`refresh()` does not fire
  on failure), and the error Banner ("Couldn't save your theme preference")
  is confirmed rendered.

## How many `SettingsPage.test.tsx` tests actually render `<SettingsPage>`

Verified the real number rather than assuming 45: the file has **45** total
`it(` blocks before this task's changes. Of those, **15** actually render
`<SettingsPage>` (1 section-order + 7 Notifications + 1 Appearance + 1
Calendar feed + 3 Danger zone + 2 Profile section), through exactly the two
sites the packet names — the shared `renderSettingsPage` helper (14 of the 15
render calls) and the one standalone inline render inside the `AuthObserver`
test (the 15th). The remaining **30** are pure unit tests of exported helper
functions and `makeLoadSettingsData`/`makeUpdateProfile`/`makeChangeTheme`/
`makeToggleNotificationPref`/`makeUploadAvatar`/`makeSignOutEverywhere`
loader-level tests against a stubbed `SupabaseClient` — none of them render
`<SettingsPage>` and none were ever going to fail either way. Both render
sites were wrapped in `<ThemeModeProvider>` (bare, no `loadThemeMode`
override — the outer `<AuthProvider>` at both sites is also bare, so `user`
stays `null` and no fetch is ever attempted by these 15 pre-existing tests).
This task adds 2 more render-based tests (criterion 8), for **47** total `it(`
blocks in the file after this task, confirmed green:
`npx vitest run src/pages/settings/SettingsPage.test.tsx` → `Test Files 1
passed (1)`, `Tests 47 passed (47)`.

## Stale disclaimer removed

`SettingsPage.tsx:1137-1139`'s "This saves your choice. It doesn't change how
the app looks right now." `<Text>` block is removed entirely (it would now be
false — the theme applies immediately in the same session once this task's
wiring lands). Confirmed by `git diff` — the block is a pure deletion, no
replacement text needed since the sentence claimed a limitation that no
longer exists.

## Tiering judgment

Agree with sonnet tier. `src/lib/supabase/auth.ts` is touched, but the added
`resolveThemeMode` is a single, self-contained, additive `select` under
`profiles_read` (already-permissive, already-verified RLS: `for select to
authenticated using (true)`) — it does not create or edit a migration, RLS
policy, `security definer` helper, or metric view, and it does not change
who can sign in, what role they get, or what they're permitted to do. No
disagreement.

## "Additional themes" — explicitly out of scope, not resolved

Restated plainly, per criterion 12: this task makes the existing
System/Light/Dark control actually work. It does **not** add, discuss as
feasible, or scope any additional named theme beyond the three PRD DES-06/D3
already name. No code, comment, or decision in this change set touches that
question either way — it remains a product question pending the human
owner's ruling, per the standing auto-mode rule cited in the packet.

## The localStorage seed — scope note (not owner-authorized)

The `localStorage`-seeded flash fix (Design section 2) is a real scope
addition beyond the human owner's one recorded decision on T148, which
authorizes wiring the existing control to the `Theme` provider and neither
mentions nor contemplates a client-side persistence layer. It was added
because a gate measured the flash this task would otherwise ship with
(full-dark-then-snap-to-light on every load, for the reporting user's own
picked preference) and judged that unacceptable as the fix for "it all stays
dark mode." This is the orchestrator's own auto-mode decision, not the human
owner's, and is logged as a REVIEW item pending his ruling — he may strike
it, and if he does, the wiring in `App.tsx`/`ThemeModeProvider.tsx` stands on
its own (the seed is additive to the wiring, not load-bearing for it).

## Full command output

```
$ npx tsc --noEmit
(clean, exit 0)

$ npx vite build
✓ built in 9.74s
(exit 0; pre-existing >500kB chunk-size advisory only, unrelated to this task)

$ npm run format:check
Checking formatting...
All matched files use Prettier code style!

$ npx eslint .
✖ 355 problems (0 errors, 355 warnings)
```

Baseline (post-merge, pre-change): 354 warnings, 0 errors. New count: **355**,
+1 exactly as the packet predicted — the single new warning is
`src/app/ThemeModeProvider.tsx:229` (`react-refresh/only-export-components`,
the `useThemeMode` hook exported alongside the `ThemeModeProvider` component
from the same file), reproducing `SeasonProvider.tsx:214`'s own identical
warning. No warning from the module-private storage helpers (they are not
exported, per Design section 2's explicit instruction) — confirmed the
warning count is 355, not 357.

```
$ npx vitest run
 Test Files  66 passed (66)
      Tests  1499 passed (1499)
(exit 0, no unhandled-error report)
```

Baseline (post-merge): 64 files / 1478 tests / 0 errors / 0 unhandled errors.
New: **66 files** (+2: `src/App.test.tsx`, `src/app/ThemeModeProvider.test.tsx`),
**1499 tests** (+21: 4 new in `auth.test.ts`'s `resolveThemeMode` describe
block, 11 new in `ThemeModeProvider.test.tsx`, 4 new in `App.test.tsx`, 2 new
in `SettingsPage.test.tsx`'s criterion-8 describe block). `theme.smoke.test.tsx`
(bare `<App />` render) passes unmodified, individually confirmed
(`npx vitest run src/theme/theme.smoke.test.tsx` → 1 passed).

## Files changed

- `src/App.tsx` — mounts `ThemeModeProvider` between `AuthProvider` and
  `Theme` (via a new `ThemedShell` nested component); adds
  `themeModeProviderProps` pass-through prop; updates the top-of-file
  provider-order doc comment.
- `src/App.test.tsx` (new) — criterion 7's regression tests.
- `src/app/ThemeModeProvider.tsx` (new) — the provider/hook itself.
- `src/app/ThemeModeProvider.test.tsx` (new) — criteria 5/6's tests.
- `src/lib/supabase/auth.ts` — additive `ThemeMode` type + `resolveThemeMode`
  function.
- `src/lib/supabase/auth.test.ts` — additive `describe('resolveThemeMode
  (T148 SET-03 read)', ...)` block.
- `src/pages/settings/SettingsPage.tsx` — imports `useThemeMode`; calls
  `refresh()` on a successful `persistTheme`; removes the stale disclaimer;
  updates the module doc #2 section to reflect the closed gap.
- `src/pages/settings/SettingsPage.test.tsx` — wraps both render sites in
  `<ThemeModeProvider>`; adds criterion 8's two new tests.
- `docs/swarm/active/T148-worker-output.md` (this file).

## Commit

Committed with explicit pathspecs (constitution item 22 — no `git add -A`/
`git add .` anywhere), one path per `git add` invocation. Commit SHA and
confirmation this worktree's HEAD actually moved (constitution item 21) are
reported in the final chat response, not here, since this file is written
before that commit exists.

## Anything not independently verified

- I did not independently re-verify `docs/swarm/auto-mode-decisions.md:276-278`'s
  exact line range for the human owner's recorded T148 decision — I trusted
  the packet's own citation for that specific line range, though I did
  confirm the file exists and is Forbidden (not read in full, only trusted
  as cited).
- I did not run this against a real Supabase backend (no `.env` present in
  this worktree, matching every other test file's own disclosed posture) —
  all `resolveThemeMode`/`ThemeModeProvider` proofs are against stubbed
  clients/injected loaders, per the codebase's existing convention.
- Manual/visual browser verification (actually toggling the control in a
  running dev server, observing no flicker in the reporter's own machine
  configuration) was not performed — this is a `vitest`/`jsdom` proof only,
  consistent with how every prior task in this batch has been verified.
