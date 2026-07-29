# Worker Packet: T148 — light/dark/system theme control does nothing

**Revision 2.** The premise gate returned REVISE (3 MAJORs, 6 MINORs, 1 NIT). It
confirmed the root-cause analysis below against installed source at every step, and
independently ran the mutation on criterion 6 itself (removed the `mode` prop,
confirmed the dark/light cases both fail) — **criterion 6 is unchanged from
revision 1.** Everything else in this revision addresses a specific finding; see
inline notes marked **(gate)**.

**User-reported:** "light mode/dark mode settings do not work, it all stays dark
mode." (A second half of the same report — "there were additional themes in the
original app that I thought we'd have" — is explicitly **out of scope**, see
"Scope boundary" below.)

**Packet SHA: pin this.** Before writing your output doc, run
`git log -1 --format=%H -- docs/swarm/active/T148-worker-packet.md` and confirm it
matches the SHA in your dispatch prompt.

## FIRST — merge the working branch

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```

Report the result. **If it conflicts, stop and report.** Baselines below are
measured **after** this merge — see criterion 13.

## Root cause — verified against the installed source, not assumed

PRD DES-06 (`docs/swarm/VOLT_Portal_PRD.md:211`):
> Theme provider: `<Theme theme={voltTheme} mode={userMode}>` where `userMode` ∈
> `system | light | dark`, persisted per profile (SET-03).

`src/App.tsx:29` mounts `<Theme theme={voltTheme}>` — **no `mode` prop at all.**

The installed component (`node_modules/@astryxdesign/core/src/theme/Theme.tsx:242-258`)
defaults `mode` to `'system'` when omitted, and its root-sync effect
(`:195-223`) does this for `'system'`:
```ts
} else {
  // system — remove attribute, let reset.css default apply
  document.documentElement.removeAttribute('data-theme');
}
```
`theme.css:115-117` then falls back to `:root { color-scheme: light dark; }`, which
follows the OS. **On a dark-set machine this is permanently dark with no manual
override possible** — exactly the report. This is a wiring gap, not a missing
palette: light tokens exist and are exercised throughout `theme.css` (98
`light-dark()` pairs, plus `html[data-theme="light"]`/`html[data-theme="dark"]`
overrides at `:116-117`), and D005's dark-mode contrast fix (already shipped,
`docs/swarm/dispute-log.md` D005) already covers both modes. **No token or
contrast work is needed here — this task is wiring only.**

`SettingsPage.tsx`'s Appearance section (`:1104-1141`) already has the real
control — a `RadioList`/`RadioListItem` trio (`:1128-1136`, System/Light/Dark) that
writes `profiles.theme_mode` through an injectable `onChangeTheme` seam
(`persistTheme`, `:903-912`; `handleThemeChange`, `:914-918`) — but that seam only
reaches the database. Its own module doc says so explicitly (`:54-62`): the live
`<Theme mode={...}>` provider is **not** reached, "a future task" — matching the
same deferred-and-never-logged pattern named in T147 (now constitution item 20).
**The section's own rendered copy already discloses this** (`:1137-1139`):
> "This saves your choice. It doesn't change how the app looks right now."

That line becomes false once this task lands and must be removed (see Acceptance).

`profiles.theme_mode` is `text not null default 'system'`
(`supabase/migrations/20260716000000_identity_roster.sql:22`), and
`profiles_read` RLS (`supabase/migrations/20260717000002_rls.sql:36-37`) is
`for select to authenticated using (true)` — any authenticated session can read any
profile's `theme_mode`, so reading your own row by id needs no new policy.

## Scope boundary — do not resolve this, it is not yours to resolve

"There were additional themes in the original app" is a **product** question, not
an engineering one. PRD D3/DES-06 specify light + dark only, and there is no
evidence of additional named themes anywhere in `docs/migration/`. Per the standing
auto-mode rule (`docs/swarm/auto-mode-decisions.md`, rule 6), a product judgement
waits for the human owner. **This task makes the existing System/Light/Dark control
actually work. It does not add, discuss, or scope any additional theme.** State this
plainly in your output doc so it is not read as a decision either way.

## Negative knowledge — an approach that looks obvious and does not work here

**(gate)** The obvious flicker fix is an inline script in `index.html` setting
`data-theme` on `<html>` before React hydrates (the exact trick
`Theme.tsx`'s own doc comment recommends for RSC/SSR, `:22-25`). **The gate
verified this does not work in this app's client-only setup and you should not
attempt it:** `Theme`'s own wrapper `<div>` (`Theme.tsx:272-277`) sets
`color-scheme` **explicitly** via its `colorSchemeStyle` (`:253-258`,
`'light dark'` for `mode='system'`, `'light'`/`'dark'` otherwise). `color-scheme`
is an inherited CSS property, and this div is a descendant of `<html>` — so once
React mounts it, its own explicit value **overrides** whatever the pre-hydration
script set on `<html>`, and every element inside it (i.e. the entire app) follows
that div's `color-scheme`, not the document's. Setting `data-theme` on `<html>`
only ever helped browser chrome (scrollbars, native form controls) via
`reset.css`'s own `html[data-theme]` rules — it was never going to reach app
content once `Theme` mounts. This is why the fix below seeds `ThemeModeProvider`'s
own React state synchronously instead of trying to beat React to the paint via the
document.

## Design — the seam this task builds

`guards.tsx`'s `AuthContextValue`/`AuthUser` (`:49-53`, `:88-155`) carries no
profile data beyond `id`/`email`/`role` — there is nowhere to hang `themeMode`
today, and this task does **not** widen `AuthUser` or touch `guards.tsx`'s auth/
session/role logic. Instead, build a new, additive provider modeled directly on the
one precedent this codebase already has for "a shared, app-wide resolved value
sourced from the user's own session, refreshable when something else edits the
underlying row": `src/app/SeasonProvider.tsx` / `useActiveSeason()`.

### 1. A small, additive query — `src/lib/supabase/auth.ts`

Add **one new exported function**, alongside `resolveRole` (`:233-251`), not
touching it or anything else in the file:

```ts
export function resolveThemeMode(
  userId: string,
  client: SupabaseClient = getSupabaseClient(),
): Promise<ThemeMode | null>
```

Same shape `resolveRole` already established: a `createLoader` reading exactly one
column (`theme_mode`) via `.eq('id', userId).maybeSingle()`. Resolve `null` for a
missing row and for a stored value outside `'system'|'light'|'dark'` (the column is
free text at the DB level — `SettingsPage.tsx`'s own module doc #6, `:467-472`,
already established this exact validation posture for the same column; **mirror
its semantics**, a whitelist check falling back to `null` here, letting the
provider below decide what `null` means — rather than importing
`isValidThemeMode` from a page component into `lib/`, which would be a backwards
layering dependency).

**MINOR — layering, corrected (gate).** An earlier revision of this section told
you to import `ThemeMode` from `@astryxdesign/core/theme` here, one paragraph
after refusing to import `isValidThemeMode` from `SettingsPage.tsx` into this same
file on backwards-layering grounds. Both positions are individually defensible,
but only one was argued — holding both at once is inconsistent, and it also cited
`SettingsPage.tsx:46` as already establishing the astryx import for the same type.
Verify that yourself before trusting it: `:46` cites `import {Theme}`, the
component, not `ThemeMode`. The export path itself is real
(`node_modules/@astryxdesign/core/src/theme/types.ts:88`,
`export type ThemeMode = 'system' | 'light' | 'dark';`), but the citation offered
in support of using it did not say what was claimed for it.

**Resolution: declare the three-literal union locally in `auth.ts`, import from
nowhere.** `export type ThemeMode = 'system' | 'light' | 'dark';`, module-level —
the same posture `SettingsPage.tsx` already takes for its own local `ThemeMode`
(`:463`). TypeScript's structural typing makes this local type assignable
everywhere Astryx's own `ThemeMode` is expected (identical literal union, no cast
needed), so `ThemeModeProvider` can still pass its value straight to
`<Theme mode={...}>`. Three independent, structurally-identical declarations
across three files (Astryx's, `SettingsPage.tsx`'s, and this one) is the correct
shape here, not something to unify.

### 2. A new provider — `src/app/ThemeModeProvider.tsx`

Modeled on `SeasonProvider.tsx` (`:173-220`) — context + injectable seam + a
must-be-called-within-provider hook, `refresh()` for live updates — with two
corrections the gate caught before you'd need to discover them the expensive way.

**MAJOR — fix the flash, do not defer it (gate).** As specified in revision 1, the
initial exposed value while the network resolves was `'system'`, unconditionally.
The gate measured what that actually means for the reporting user (picked Light,
OS is dark-set): **every page load boots fully dark and snaps to light**, across
two sequential round trips (session, then profile). Shipping that as the fix for
"it all stays dark mode" is not good enough — the reporter would still experience
it as broken.

**Fix: seed the provider's initial state synchronously from `localStorage`'s last
resolved mode, and write through on every resolve.** The repo already has the
exact storage-helper shape you need, just for a different key —
`guards.tsx:351-374`:
```ts
function getStorage(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}
```
Mirror the try/catch shape, not the specific storage instance: use
`window.localStorage` here, not `sessionStorage` — a theme preference should
survive across tabs and browser restarts, unlike the intended-URL redirect
artifact `sessionStorage` protects there. Build the analogous pair (a storage key
constant, e.g. `'volt.themeMode'`; a getter guarded by try/catch; a
read-and-validate function returning `ThemeMode | null`, reusing the same
whitelist semantics as `resolveThemeMode` above; a write function).

Seed `useState` with a **lazy initializer** (`useState(() => ...)`, not
`useState(readStoredThemeMode() ?? 'system')`) so the read happens synchronously
during the first render, before any effect or network call:
```ts
const [mode, setMode] = useState<ThemeMode>(() => readStoredThemeMode() ?? 'system');
```
On every successful resolve (initial load and `refresh()`), call the write
function too, so the next boot's synchronous seed reflects the latest known value.

**This is a real scope addition, and it is the orchestrator's auto-mode decision —
NOT the human owner's.** His only recorded decision on T148
(`docs/swarm/auto-mode-decisions.md:276-278`) authorizes wiring the existing
System/Light/Dark control to the `Theme` provider. It neither mentions nor
contemplates a client-side persistence layer. The seed is in scope because a gate
measured the flash — first paint `data-theme` null settling to dark, across two
network round trips, on every load — and shipping that as the fix for "it all stays
dark mode" would leave the reporter still calling it broken. **It is logged as a
REVIEW item pending his ruling, and he may strike it.** If he does, the rest of this
packet stands unchanged: the seed is additive to the wiring, not load-bearing for it.

**MINOR — the suggested default seam creates a fresh query per render (gate).**
Revision 1 suggested `loadThemeMode` default to an inline
`(userId) => resolveThemeMode(userId)`. **Do not do this** — an inline arrow is a
new function identity on every render, and if it sits in a `useEffect` dependency
array (it will, the same way `SeasonProvider.tsx`'s own `loadActiveSeason` does at
`:200`), the effect re-fires on every parent re-render, double-querying `profiles`
needlessly. `resolveThemeMode`'s own signature already matches
`(userId: string) => Promise<ThemeMode | null>` when called with just the one
argument (`client` has its own default) — so the fix is not a wrapper at all,
it's passing the function directly, the same **stable, module-level reference**
`SeasonProvider.tsx:175` uses for its own default:
```ts
// SeasonProvider.tsx:175, the pattern to match exactly:
loadActiveSeason = fetchActiveSeason,
```
```ts
// ThemeModeProvider.tsx, mirror this shape:
loadThemeMode = resolveThemeMode,
```
Both are stable top-level imports used directly as default values — never an
inline arrow. Criterion 7 below does not measure query counts on its own; get this
right the first time rather than relying on a test to catch it.

Rest of the shape, unchanged from revision 1:

- Reads `useAuth()` internally. When `user === null` (anonymous, or still
  loading), the exposed `mode` still comes from the synchronous `localStorage`
  seed above (there's no reason to discard a real last-known preference just
  because the current session hasn't resolved yet) — but no fetch is attempted
  until a `user` exists.
- `useThemeMode()` throws if called outside the provider, matching `useAuth()`/
  `useActiveSeason()`'s own posture.

### 3. Mount it in `App.tsx`, above `Theme`

`SeasonProvider` mounts in `AppShell.tsx` because that is already inside
`AuthProvider`'s tree. `Theme` is different: it lives in `App.tsx` itself, **above**
`AppShell`, so `ThemeModeProvider` must also mount in `App.tsx` — inside
`<AuthProvider>` (it needs `useAuth()`), wrapping `<Theme>` (so a small consumer can
read `useThemeMode()` and pass it as `mode`). `Theme` cannot itself call the hook
that provides its own `mode` prop — you need one small nested component (e.g. a
`ThemedShell` that renders `<Theme mode={useThemeMode()}>{children}</Theme>`)
between the two.

Resulting order: `BrowserRouter > AuthProvider > ThemeModeProvider > LayerProvider >
ThemedShell(Theme) > AppShell > AppRoutes`. **Update `App.tsx`'s own top-of-file doc
comment (`:1-16`) to describe the new order** — every other provider addition in
this codebase has kept that comment truthful; do not leave it describing the old
four-provider chain.

**`App.tsx` has been a Forbidden File in prior packets (e.g. T142) — that was
scope discipline for tasks that didn't need it, not a standing prohibition.** This
task deliberately opens it, because DES-06 cannot be satisfied without touching the
one file that mounts `Theme`. Do not read the file's history of being off-limits
as a reason to hesitate here.

### 4. Testability — MAJOR: use `vi.mock`, not a new `App` auth seam (gate)

**Revision 1's plan is unsatisfiable as specified.** It called for an
`authProviderProps` pass-through on `App` and for tests to use
`authHarness.tsx`'s `LoginAs` to inject a fake signed-in user. Three independent
problems, all gate-verified: `buildFakeAuthModule` is module-private
(`authHarness.tsx:103`, never exported); `LoginAs` renders its **own** scoped
`<AuthProvider>` around its children, which cannot reach `App`'s own internal
`<AuthProvider>` (nesting doesn't help — `App`'s own instance would still exist
and resolve independently); and `authHarness.tsx` is not in this packet's Allowed
Files, so even exporting `buildFakeAuthModule` would be an out-of-scope edit. A
worker following revision 1 literally would have had to violate the packet, edit
outside Allowed Files, or stall.

**Fix: `vi.mock` the auth module directly in `App.test.tsx`,** the same
partial-mock convention (`vi.mock(path, async (importOriginal) => ({ ...actual,
someExport: vi.fn() }))`, paired with `vi.mocked(...)`) already established
elsewhere in this codebase for other modules — **correction to an earlier claim**:
this convention is real and repo-wide (e.g. `RosterShell.test.tsx:105` mocks
`../../lib/supabase/loaders/invites`; `OutreachDetail.test.tsx:100` mocks
`../../lib/supabase/loaders/attendance`; `ReportsShell.test.tsx:109` mocks
`../../lib/supabase/loaders/reports`; `StudentsTab.test.tsx:74` and
`InviteParentDialog.test.tsx:63` both mock `../../lib/supabase` for
`invokeEdgeFunction`) — but **none of these five mock `lib/supabase/auth`
specifically**; verify this yourself before citing it further. Applying the same,
already-proven convention to `../lib/supabase/auth` for `App.test.tsx` is the
first instance of it for that module, not a sixth repeat of an existing one.

Mock `getInitialSession`/`subscribeToAuthStateChange`/`resolveRole` (and, since
`resolveThemeMode` lives in the same file, it can be mocked the same way when a
test needs to control theme resolution without going through
`themeModeProviderProps`) via `importOriginal`, keeping every other export real.
`App`'s own internal, unmodified `<AuthProvider>` then resolves against the
mocked module transparently — no new prop needed on `App` for auth at all.

**This also removes `authProviderProps` from the plan entirely — do not add it.**
`themeModeProviderProps` alone still needs to exist as a pass-through (the gate
flagged `authProviderProps` specifically as a broader seam than this task needs;
`themeModeProviderProps` is narrower — it only ever injects a loader function, not
an entire auth module — and keeps `ThemeModeProvider`'s own tests independently
controllable without also having to fake session/role resolution every time):

```ts
export interface AppProps {
  themeModeProviderProps?: Omit<ThemeModeProviderProps, 'children'>;
}
function App({ themeModeProviderProps }: AppProps = {}) {
  // ...
  <AuthProvider>
    <ThemeModeProvider {...themeModeProviderProps}>
    // ...
}
export default App;
```

**NIT, corrected (gate).** `App.tsx` today is `function App() { ... }` followed by
a separate `export default App;` at the bottom — two statements, not one. The
snippet above now matches that shape exactly; keep it. Do not collapse to
`export default function App(...) { ... }` — this file has never used that style,
and an earlier revision's snippet conflicted with the file it was describing.

Mirrors `AppShell.tsx:112,159`'s `seasonProviderProps` pattern (already
checker-verified twice, T139/T140). Defaults to `undefined`, spreading to nothing —
`main.tsx`'s existing bare `<App />` (no changes needed there) and
`theme.smoke.test.tsx`'s existing bare `<App />` render (`theme.smoke.test.tsx:30`,
must keep passing unmodified) both behave identically to today.

### 5. Live update after a Settings change

`SettingsPage.tsx`'s `persistTheme` (`:903-912`) currently only handles the failure
path (`.catch`). Add a success path that calls the new provider's `refresh()`, the
same way `SeasonSettings.tsx:727-728` already calls `useActiveSeason().refresh()`
after its own successful mutation (module doc #9 there, `:285`). `SettingsPage`
renders inside `App`'s normal (non-chromeless) tree, so `useThemeMode()` is reachable
there. Both the initial change (`handleThemeChange`) and the Retry button
(`:1119-1123`, calls `persistTheme` again) go through this one function, so wiring
`refresh()` there covers both.

**MINOR — this breaks `SettingsPage.test.tsx` at scale, expect it (gate).**
`SettingsPage.tsx` will call `useThemeMode()`, which throws outside a
`ThemeModeProvider`. `SettingsPage.test.tsx` has **45 tests**, and effectively all
of them render through one of two sites that do not currently wrap in any such
provider: the shared `renderSettingsPage` helper (`:165-173`) and one standalone
inline render inside an `AuthObserver` test (`:485-495`). Wrap both in
`<ThemeModeProvider>` (nested inside the `<AuthProvider>` already there at both
sites). **Expect all 45 tests to go red until you do this** — it is not a sign the
design is wrong, it is the direct, predictable consequence of adding a
provider-scoped hook call to a page that dozens of tests already render.

**Remove the now-false disclaimer at `SettingsPage.tsx:1137-1139`** ("This saves
your choice. It doesn't change how the app looks right now.") — once this task
lands, it does change how the app looks, immediately, in the same session.

## Acceptance Criteria

1. `resolveThemeMode` added to `src/lib/supabase/auth.ts`, additive only —
   `resolveRole` and every other existing export in that file byte-unchanged.
2. `ThemeModeProvider`/`useThemeMode()` built in `src/app/ThemeModeProvider.tsx`.
   Default `loadThemeMode` is the **stable, module-level `resolveThemeMode`
   reference itself**, not an inline wrapper — confirm this explicitly in your
   output doc, this is criterion 7's actual guarantee, not something a test alone
   catches.
3. `App.tsx` mounts `ThemeModeProvider` between `AuthProvider` and `Theme`, and
   `Theme` receives a real `mode` prop sourced from `useThemeMode()`. The top-of-file
   provider-order doc comment is updated to match.
4. `App.tsx` gains **only** `themeModeProviderProps` as a new pass-through prop —
   no `authProviderProps`. Mirrors `AppShell.tsx`'s `seasonProviderProps` pattern.
   `main.tsx` needs no changes. `theme.smoke.test.tsx` passes unmodified.
5. **The flash fix.** `ThemeModeProvider`'s initial React state is seeded
   synchronously from `localStorage` (lazy `useState` initializer, not an effect),
   and every successful resolve (initial load and `refresh()`) writes the resolved
   value back to `localStorage`. Regression test: pre-seed `localStorage` with
   `'light'`, inject a `loadThemeMode` whose promise you control and deliberately
   do not resolve during the assertion, render, and assert **synchronously, before
   any `await`/microtask flush** that the exposed mode is already `'light'` — not
   `'system'` (the pre-fix default) and not the eventual network value. Then
   resolve the promise, flush, and confirm it updates to the real value and that
   `localStorage` now reflects it. **Asserting only the final, settled state does
   not satisfy this criterion** — the whole point is proving the seeded value
   renders before the network call finishes, so the assertion must happen before
   that call is allowed to finish.
6. Regression test (new `ThemeModeProvider.test.tsx`, standalone — mirror
   `SeasonProvider.test.tsx`'s harness shape, not a full `<App/>` render): for an
   authenticated user with `theme_mode` stored as each of `'light'`/`'dark'`/
   `'system'`/an invalid free-text value/no matching row, the exposed `mode`
   resolves correctly in every case once the network value lands (the last two
   both resolve to `'system'` absent a usable `localStorage` seed).
7. Regression test (new `App.test.tsx`, using `vi.mock('../lib/supabase/auth', ...)`
   for a fake authenticated session and `themeModeProviderProps` injection for a
   controlled theme value): for an injected `loadThemeMode` returning `'dark'`,
   `document.documentElement.getAttribute('data-theme')` is `'dark'`; returning
   `'light'` → `'light'`; returning `'system'` → the attribute is **absent**
   (matches `Theme`'s own documented behavior, not an arbitrary choice — cite
   `Theme.tsx:208-213`).

   **Unauthenticated case — inject it explicitly, don't rely on the environment
   (gate MINOR).** Mock `getInitialSession` to resolve `null` (a genuinely
   anonymous session) via the same `vi.mock` from Design section 4, rather than
   omitting any override and letting the call fall through to the real,
   unconfigured module. The unmocked path does happen to end up anonymous today —
   it throws `SupabaseNotConfiguredError`, `guards.tsx:253` logs it, and the
   provider fails safe — but that passes the test by environmental accident, the
   same class of weakness T140's checker flagged, not by a fixture asserting what
   is actually under test. With `getInitialSession` explicitly mocked to resolve
   `null`: the attribute stays absent (system default), and no fetch is attempted
   (assert via a `loadThemeMode` spy never being called).

   **This is the strongest criterion in the packet — do not weaken it.** The
   premise gate ran this mutation itself: with the fix removed (`App.tsx`'s `mode`
   prop reverted to omitted), both the `'dark'` and `'light'` cases fail (attribute
   stays absent regardless of the injected value); restored, both pass. Reproduce
   that same proof yourself and report it.
8. `SettingsPage.tsx`'s `persistTheme` calls the new provider's `refresh()` on a
   successful `onChangeTheme`, not just on failure. Prove it: a test asserting a
   fake `refresh` (or equivalent observable) fires after a successful theme change
   but not after a rejected one. **Expect this to require wrapping
   `SettingsPage.test.tsx`'s two render sites (`:165-173`, `:485-495`) in
   `<ThemeModeProvider>` — see "Live update" above; do this before concluding
   something else is wrong when the existing 45 tests go red.**
9. `SettingsPage.tsx:1137-1139`'s stale disclaimer copy is removed.
10. No token, palette, or contrast change anywhere in `src/theme/**` — this task is
    wiring only. Confirm `theme.css`/`volt.ts` are byte-unchanged.
11. `AuthUser`/`AuthContextValue`/`guards.tsx`'s existing exports are byte-unchanged
    — this task does not touch role/session/permission logic (see tiering note
    below).
12. Your output doc states plainly that "additional themes" is out of scope pending
    the human owner's decision, and that no such theme was added, discussed as
    feasible, or scoped.
13. `npx tsc --noEmit`, `npx vite build`, `npm run format:check`, `npx eslint .` and
    `npx vitest run` all clean. Baselines **on the tree after this packet's own
    merge step** (not the pre-merge tree): **0 errors**, 63 test files,
    **1476 tests**. Warnings: expect **355, not 354** — `useThemeMode` exports a
    hook from the same file as the `ThemeModeProvider` component, reproducing
    `SeasonProvider.tsx:214`'s own `react-refresh/only-export-components` warning
    exactly (that file mixes a component and a hook export the same way). This is
    an expected, accounted-for warning, not a regression to chase down. You are
    adding two new test files (`ThemeModeProvider.test.tsx`, `App.test.tsx`) —
    report the new file/test counts and explain the delta.

## Allowed Files

- `src/App.tsx`
- `src/App.test.tsx` (create)
- `src/app/ThemeModeProvider.tsx` (create)
- `src/app/ThemeModeProvider.test.tsx` (create)
- `src/lib/supabase/auth.ts` (additive only — see criterion 1)
- `src/pages/settings/SettingsPage.tsx`
- `src/pages/settings/SettingsPage.test.tsx`
- `docs/swarm/active/T148-worker-output.md` (create)

## Forbidden Files

- `docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`,
  `dispute-log.md`, `auto-mode-decisions.md`
- Any other `docs/swarm/**` file, including other packets
- `.claude/**`
- `src/app/guards.tsx` — this task does not touch auth/session/role logic; if you
  find yourself needing to, stop and report rather than widening scope here
- `src/test-utils/authHarness.tsx` — read as precedent only; do not export
  `buildFakeAuthModule` from it or otherwise edit it. Use `vi.mock` per Design
  section 4 instead.
- `src/app/SeasonProvider.tsx`, `src/app/AppShell.tsx` — read as precedent only, do
  not edit
- `src/theme/**` (`volt.ts`, `theme.css`) — no token/contrast work in this task
- `src/main.tsx` — no changes needed (the new `App` prop is optional)
- Anything under `node_modules/`

## Relevant Constitution Excerpt

- **Item 18 (agent tiering)** — this task edits `src/lib/supabase/auth.ts`, a file
  in the auth surface, but adds one new, self-contained, additive function that
  performs a plain `select` under an already-verified, already-permissive RLS
  policy (`profiles_read`, cited above) — it does not create/edit a migration, RLS
  policy, security-definer helper, metric view, or change any auth/session/role/
  permission **logic** (nothing about who can sign in, what role they get, or what
  they're allowed to do changes). Recorded judgment: **sonnet tier**, not opus. If
  you disagree after reading the file, say so in your output doc rather than
  silently deciding either way.
- **Item 6** — no PII in fixtures/tests; this task introduces no new fixture data
  beyond theme-mode string literals, which are not PII.
- **Item 15 / DES-17** — accessibility. No new interactive control is added (the
  `RadioList` already exists and is unchanged); confirm the Banner's existing
  Retry action still works (criterion 8 depends on it not regressing).
- **Item 19c** — verify a citation before asserting it. Every citation in this
  packet was re-derived from the current tree and the installed
  `@astryxdesign/core` source, not assumed from the PRD text alone — including a
  correction to this packet's own prior revision (Design section 4's `vi.mock`
  precedent list). If anything here does not match the tree, **stop and report
  the mismatch rather than guessing at intent.**

## Required Worker Output

Create `docs/swarm/active/T148-worker-output.md` covering: the exact
`ThemeModeProvider`/`resolveThemeMode` shapes you built and why (especially if you
deviated from the suggested signatures in Design sections 1/2); confirmation
`guards.tsx`, `authHarness.tsx`, and `src/theme/**` are byte-unchanged; the
localStorage seed-before-network-resolves proof for criterion 5; the
discrimination proof for criterion 7; the live-update proof for criterion 8,
including how many `SettingsPage.test.tsx` tests failed before you wrapped the two
render sites and that all 45 pass afterward; confirmation the stale disclaimer
copy is gone; the tiering judgment call (agree or disagree, and why); explicit
restatement that "additional themes" was not resolved, discussed as feasible, or
scoped; full command output; and anything you could not verify, stated plainly as
unverified.

Do not mark this task complete. A checker verifies it.
