# Worker Packet: T148 — light/dark/system theme control does nothing

**Revision 4 (round 4, intended final).** Round 3's gate returned REVISE, but
**criterion 8 is now settled and unchanged** — the gate built it exactly as
round 3 specified and measured 1 call on mount, 2 after a successful `refresh()`,
still 1 after a rejected one, confirmed discriminating in both directions
(deleting the `refresh()` call drops it to 1; making `refresh()` fire
unconditionally pushes the rejected case to 2) and confirmed the rejected case is
non-vacuous (the click genuinely fires, the error genuinely renders). Do not
touch it. One design decision needed a call rather than a transcription — Design
section 2's logout/shared-browser case is now **disclosure-only**; the "clear it"
option is dropped entirely, both because it would have required editing the
Forbidden `guards.tsx` and because the in-scope alternative the gate tested
(clearing whenever `user` is `null`) is actively destructive — see Design section
2 for the full reasoning. Five further fold-ins throughout, all gate-measured; see
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
- **Keep the storage helpers module-private (not exported) — this is load-bearing
  for criterion 13's warning count, not a style preference (gate).** `guards.tsx`'s
  own analogues (`setIntendedUrl`/`getIntendedUrl`/`clearIntendedUrl`,
  `:351-374`) ARE exported, because other modules call them directly. Nothing
  outside `ThemeModeProvider.tsx` needs to call your read/write helpers — the
  provider is the only consumer. If you export them anyway (e.g. by copying
  `guards.tsx`'s shape too literally), each becomes a second export alongside the
  component in the same file, and `react-refresh/only-export-components` fires
  once per additional non-component export — two more warnings, landing on 357
  instead of criterion 13's stated 355. Module-private avoids this outright.

**Three cases the design above leaves unhandled — specify all three, do not leave
them to be discovered later (gate):**

1. **`resolveThemeMode` resolves `null` while a real `localStorage` seed is
   present.** (E.g. the row went missing, or the stored value failed validation
   server-side.) **Normative, not a choice: keep the existing seeded value.** Do
   not overwrite `mode` with `null`-coerced-to-`'system'` — that discards a real
   last-known preference for no reason. This matches the preference this section
   already states elsewhere; it is not left to your judgment. Criterion 5 requires
   a test for this case, not criterion 6.
2. **`resolveThemeMode` rejects.** Nothing above says what happens on a rejected
   promise — "on every successful resolve" (write-through) implies there is an
   unsuccessful case too, and it needs a `.catch`/`try` so a network failure
   doesn't produce an unhandled promise rejection. Fail safe (keep whatever `mode`
   is currently showing — seeded or previously resolved — rather than crashing or
   silently reverting to `'system'`).
3. **Logout, on a shared/kiosk browser — disclose only, do not attempt to clear
   (gate, corrected).** The `localStorage` seed is not user-scoped, so if user A
   sets Dark and signs out, user B's first paint on the same browser may use A's
   stored value for one frame until B's own `theme_mode` resolves. **Do not clear
   the stored value in `logout()`'s effect path — that function lives in
   `guards.tsx:311-321`, and `guards.tsx` is Forbidden for this task** (see
   Forbidden Files below); reaching into it would repeat the exact mistake Design
   section 4 already corrected once for `authHarness.tsx`. There is also no
   in-scope alternative: clearing the seed unconditionally whenever `user` reads
   `null` is not a safe substitute, since `user` is `null` during every normal
   page load while the session is still resolving, not only after a real sign-out
   — an unguarded clear there would wipe the seed on every boot (masked when the
   profile fetch later succeeds and rewrites it, but permanent when
   `resolveThemeMode` rejects, and permanent on any genuinely anonymous visit —
   `/login`, a signed-out landing page — since nothing ever restores it). State
   the shared-browser behaviour plainly in your output doc as a known, accepted
   limitation. Do not build a fix for it.

### 3. Mount it in `App.tsx`, above `Theme`

`SeasonProvider` mounts in `AppShell.tsx` because that is already inside
`AuthProvider`'s tree. `Theme` is different: it lives in `App.tsx` itself, **above**
`AppShell`, so `ThemeModeProvider` must also mount in `App.tsx` — inside
`<AuthProvider>` (it needs `useAuth()`), wrapping `<Theme>` (so a small consumer can
read `useThemeMode()` and pass it as `mode`). `Theme` cannot itself call the hook
that provides its own `mode` prop — you need one small nested component (e.g. a
`ThemedShell` that renders `<Theme mode={useThemeMode().mode}>{children}</Theme>`)
between the two. **Note the `.mode` — corrected (gate).** `Theme.tsx:242-246`
takes a scalar `ThemeMode`, but `useThemeMode()` must also expose `refresh`
(the same shape `useActiveSeason()` uses, and criterion 8 depends on it), so
the hook's return value is an object, not a bare `ThemeMode`. `<Theme
mode={useThemeMode()}>` (no `.mode`) fails `tsc` immediately — a citation this
packet asserts, not merely an example to adapt loosely.

Resulting order: `BrowserRouter > AuthProvider > ThemeModeProvider > LayerProvider >
ThemedShell(Theme) > AppShell > AppRoutes`. **Update `App.tsx`'s own top-of-file doc
comment (`:1-16`) to describe the new order** — every other provider addition in
this codebase has kept that comment truthful; do not leave it describing the old
four-provider chain.

**`App.tsx` has been a Forbidden File in prior packets — that was scope discipline
for tasks that didn't need it, not a standing prohibition.** (**Corrected witness,
gate:** an earlier revision cited T142 for this; T142's own Forbidden Files list
does not mention `App.tsx` at all — verify that yourself before repeating it. The
real witness is `SettingsPage.tsx:57`, which names it directly: "doing so would
require editing `App.tsx` (this task's own Forbidden Files, confirmed
read-only)" — that's T105, the task that built the Appearance control itself.) This
task deliberately opens `App.tsx`, because DES-06 cannot be satisfied without
touching the one file that mounts `Theme`. Do not read the file's history of being
off-limits elsewhere as a reason to hesitate here.

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
this convention is real and repo-wide, but only **four** of the five sites
originally cited actually support the `importOriginal`-partial-mock claim —
verify each yourself before repeating any of them: `RosterShell.test.tsx:105`
mocks `../../lib/supabase/loaders/invites` via `importOriginal`;
`OutreachDetail.test.tsx:100` mocks `../../lib/supabase/loaders/attendance` via
`importOriginal`; `StudentsTab.test.tsx:74` and `InviteParentDialog.test.tsx:63`
both mock `../../lib/supabase` for `invokeEdgeFunction` via `importOriginal`.
**`ReportsShell.test.tsx:109` is different** — it's a full synthetic factory
mock with no `importOriginal` call at all (`vi.mock('../../lib/supabase/loaders/reports',
() => ({ loadParticipationData: vi.fn(), ... }))`), so it supports "vi.mock is a
real repo-wide convention" but not the specific partial-mock-via-importOriginal
shape the other four demonstrate. **None of these five mock `lib/supabase/auth`
specifically.** Applying the proven convention to `./lib/supabase/auth` (relative
from `src/App.test.tsx`, which sits beside `App.tsx` in `src/` — **not**
`../lib/supabase/auth`, which is one level too many and fails module resolution
at collection) for `App.test.tsx` is the first instance of it for that module, not
a sixth repeat of an existing one.

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
same way `SeasonSettings.tsx`'s own `refreshActiveSeason()` call (`:867`) already
calls `useActiveSeason().refresh()` after its own successful mutation (module doc
#9 there, `:285`). `SettingsPage` renders inside `App`'s normal (non-chromeless)
tree, so `useThemeMode()` is reachable there. Both the initial change
(`handleThemeChange`) and the Retry button (`:1119-1123`, calls `persistTheme`
again) go through this one function, so wiring `refresh()` there covers both.

**Not all of `SettingsPage.test.tsx` renders — verify the real number, don't
assume 45 (gate).** `SettingsPage.tsx` will call `useThemeMode()`, which throws
outside a `ThemeModeProvider`. The file has 45 `it(` blocks total, but a
substantial minority are pure unit tests of exported helper functions
(formatters, validators, etc.) that never render `<SettingsPage>` at all and are
unaffected either way — measure the real count yourself rather than trusting
either this packet's or an earlier revision's figure. What IS true: effectively
every test that **does** render goes through one of two sites that do not
currently wrap in any such provider — the shared `renderSettingsPage` helper
(`:165-173`) and one standalone inline render inside an `AuthObserver` test
(`:485-495`). Wrap both in `<ThemeModeProvider>` (nested inside the
`<AuthProvider>` already there at both sites), and confirm the full 45-test suite
is green afterward — the non-rendering tests were never going to fail, but the
suite-wide count is still the right thing to report.

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
   that call is allowed to finish. **A first-ever visit (no `localStorage` entry
   yet) still flashes** — this is the honestly-disclosed residual, not a defect:
   there is nothing to seed from on that visit, and the `index.html`-script
   approach that would avoid it is the one "Negative knowledge" above proves does
   not work in this app. State this plainly in your output doc so a checker reads
   it as a known, accepted limitation rather than a missed case.

   **Also cover the two remaining unhandled-case decisions from Design section 2,
   each with its own test — the third (logout) is disclosure-only, see Design
   section 2's own text, nothing to test there:**
   - A resolved `null` with a real `localStorage` seed present **keeps** the
     seeded value — this is normative (Design section 2, case 1), not a choice;
     assert it directly.
   - **A rejected `resolveThemeMode` is not directly assertable by its resulting
     `mode` value alone — name the actual mechanism (gate).** With the `.catch`
     genuinely missing, `mode` may still read correctly in every individual test
     (React doesn't crash on an unhandled rejection, it just leaks one), so
     `expect(mode).toBe('dark')`-shaped assertions can pass green even when the
     catch is absent — proving nothing about this specific case. The real,
     observable failure surfaces at the **process level**: an uncaught rejection
     makes `npx vitest run` report a nonzero error count (`"Errors 1 error"`) and
     exit non-zero, even while every individual `expect` in the run stays green.
     **The proof for this case is the full command's exit code and error count,
     not a per-test assertion** — write the test that exercises a rejecting
     `loadThemeMode`, then confirm via the actual `npx vitest run` output (not a
     single test's pass/fail) that it reports 0 errors with your `.catch` in
     place, and report what happens without it (a worker who only writes
     `expect(mode).toBe(...)` here will believe they've proven something they
     have not).
6. **Split across two files by what each actually exercises (gate) — do not put
   every case in the provider test.**
   - `src/lib/supabase/auth.test.ts` (**add to Allowed Files** — additive only,
     new `describe` block, do not touch existing tests in this file):
     `resolveThemeMode`'s own cases — a present valid `theme_mode`, an invalid
     free-text value, and no matching row — using the exact same
     `buildFakeProfilesClient` helper this file already has at `:209-219` for
     `resolveRole`'s own tests (same `.select().eq().maybeSingle()` chain
     shape; do not rebuild a second fake client). This is a plain unit test of a
     query function, not a component test — it belongs where `resolveRole`'s own
     equivalent cases already live, not duplicated into the provider test.
   - `ThemeModeProvider.test.tsx` (new, standalone — mirror
     `SeasonProvider.test.tsx`'s harness shape, not a full `<App/>` render): for
     an authenticated user, with an injected `loadThemeMode` resolving each of
     `'light'`/`'dark'`/`'system'`, the exposed `mode` resolves correctly once the
     network value lands. **Clear `localStorage` between cases yourself, inline in
     this test file** — `src/test-setup.ts` clears nothing globally and is not in
     this packet's Allowed Files, so a prior case's write-through will otherwise
     leak into the next one and produce a flaky or silently-wrong pass.
7. Regression test (new `App.test.tsx`, using `vi.mock('./lib/supabase/auth', ...)`
   — mind the path depth, `App.test.tsx` sits beside `App.tsx` in `src/`, so it's
   one level, not two — for a fake authenticated session and
   `themeModeProviderProps` injection for a controlled theme value): for an
   injected `loadThemeMode` returning `'dark'`,
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
   successful `onChangeTheme`, not just on failure.

   **This cannot be proved the way earlier revisions described, and the gate
   measured it directly.** "A fake `refresh` fires" is unobservable as stated:
   `refresh` lives inside `ThemeModeProvider`'s own internal context, the context
   value is not exported, and criterion 4 deliberately pins the only injectable
   surface to `loadThemeMode` — there is no seam to inject a spy `refresh` into.
   Wrapping `SettingsPage.test.tsx`'s two render sites in a **bare**
   `<ThemeModeProvider>` (no `themeModeProviderProps`) is also not enough on its
   own: the real, unmocked `<AuthProvider>` in those tests is unconfigured, `user`
   stays `null`, and the provider correctly skips the fetch — a `loadThemeMode`
   spy there is called zero times on mount and zero times after `refresh()`,
   proving nothing.

   **Use the template this codebase already has for exactly this shape**, from
   the same task that established the `refresh()` pattern in the first place:
   `SeasonSettings.test.tsx:620-660` (T091, checker-verified, green today) counts
   an **injected loader's own call count** — 1 call on mount, 2 after a
   successful mutation calls `refresh()`, still 1 after a rejected one — rather
   than trying to spy on `refresh` itself. Reproduce that shape here:
   - Render `SettingsPage` wrapped in **`LoginAs`** (`src/test-utils/authHarness.tsx`
     — importing it is expected and is the repo-wide convention for this exact
     need, used by 17 other test files including `SeasonSettings.test.tsx`
     itself; **do not edit `authHarness.tsx`**, only import `LoginAs` from it) so
     a real, resolved, authenticated `user` exists, **and** a scoped
     `<ThemeModeProvider loadThemeMode={injectedSpy}>` around `<SettingsPage>`.
     **NIT:** `SeasonSettings.test.tsx:90` actually imports
     `LoginAsDeferred as LoginAs`, not the plain `LoginAs` name — both are
     byte-identical implementations (`authHarness.tsx:131` and `:142`), so either
     import works here; don't stop if you see the aliased form instead of what
     this packet names.
   - Assert the injected `loadThemeMode` spy was called **once** after the
     initial mount (the provider's own real fetch-on-mount effect).
   - Trigger a successful `onChangeTheme` (the existing injectable prop
     `SettingsPage` already accepts) and assert the spy is now called **twice** —
     the second call is `refresh()` actually firing, the same proof
     `SeasonSettings.test.tsx:639` uses for its own analogous case.
   - Separately, trigger a **rejected** `onChangeTheme` and assert the spy stays
     at **one** call — `refresh()` must not fire on failure, mirroring
     `SeasonSettings.test.tsx:642-660`'s own negative case exactly.

   This is criterion 8's actual "equivalent observable" — not a fake `refresh`
   function, a real call-count assertion on the one seam that already exists.
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
    `npx vitest run` all clean. **Baselines corrected (gate) — measured at this
    packet's own SHA: 64 test files, 1478 tests, 0 errors, 354 warnings.** The
    branch merge step above is docs-only at the time of this measurement, so the
    post-merge tree is identical — but confirm this yourself rather than skipping
    the merge step or trusting that it stays true; other tasks may land before you
    start. Warnings: expect **355, not 354** — `useThemeMode` exports a
    hook from the same file as the `ThemeModeProvider` component, reproducing
    `SeasonProvider.tsx:214`'s own `react-refresh/only-export-components` warning
    exactly (that file mixes a component and a hook export the same way). **This
    figure assumes the storage helpers stay module-private per Design section 2
    — if you export them, expect 357, not 355** (two more
    `react-refresh/only-export-components` hits, one per additional non-component
    export from that file); keeping them private is the correct choice and avoids
    the discrepancy outright, not something to chase as a phantom regression
    either way. You are adding two new test files (`ThemeModeProvider.test.tsx`,
    `App.test.tsx`) and one new `describe` block in an existing file
    (`auth.test.ts`) — report the new file/test counts and explain the delta.

## Allowed Files

- `src/App.tsx`
- `src/App.test.tsx` (create)
- `src/app/ThemeModeProvider.tsx` (create)
- `src/app/ThemeModeProvider.test.tsx` (create)
- `src/lib/supabase/auth.ts` (additive only — see criterion 1)
- `src/lib/supabase/auth.test.ts` (additive only — one new `describe` block for
  `resolveThemeMode`, per criterion 6; every existing test in this file
  byte-unchanged)
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
- `src/test-utils/authHarness.tsx` — **do not edit this file or export anything
  new from it.** This is not a prohibition on using it: **importing `LoginAs`
  from it is expected** and is the repo-wide convention (17 other test files
  already do, including `SeasonSettings.test.tsx`, criterion 8's own template) —
  use it exactly as those files do, just don't modify the file itself. `App.tsx`
  auth-faking still goes through `vi.mock` per Design section 4, since `LoginAs`
  cannot reach `App`'s own internal `<AuthProvider>` (that reasoning is unchanged
  — the two mechanisms solve two different problems: `vi.mock` for `App.test.tsx`
  because `App` hardcodes its provider; `LoginAs` for `SettingsPage.test.tsx`
  because that page is rendered directly, not through `App`).
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
localStorage seed-before-network-resolves proof for criterion 5, including
explicit acknowledgment of the first-ever-visit residual; how you resolved each of
the three unhandled cases from Design section 2 (null-with-seed, rejection,
logout); the discrimination proof for criterion 7; the live-update call-count
proof for criterion 8 (1 on mount / 2 after success / 1 after rejection, per the
`SeasonSettings.test.tsx:620-660` template); how many `SettingsPage.test.tsx`
tests actually render `<SettingsPage>` (verify the real number, do not assume 45)
and confirmation the full 45-test suite passes after wrapping both render sites;
confirmation the stale disclaimer copy is gone; the tiering judgment call (agree
or disagree, and why); explicit restatement that "additional themes" was not
resolved, discussed as feasible, or scoped; full command output; and anything you
could not verify, stated plainly as unverified.

Do not mark this task complete. A checker verifies it.
