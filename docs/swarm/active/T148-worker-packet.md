# Worker Packet: T148 — light/dark/system theme control does nothing

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

Report the result. **If it conflicts, stop and report.**

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
same deferred-and-never-logged pattern named in T147. **The section's own rendered
copy already discloses this** (`:1137-1139`):
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
missing row (mirrors `resolveRole`'s `'no-profile'` case, but this function has no
caller that needs to distinguish "missing" from "invalid" — both should fall back to
`'system'` at the provider level, see below) and for a stored value outside
`'system'|'light'|'dark'` (the column is free text at the DB level —
`SettingsPage.tsx`'s own module doc #6, `:467-472`, already established this exact
validation posture for the same column; **mirror its semantics** — a whitelist
check falling back to `'system'` — rather than importing `isValidThemeMode` from a
page component into `lib/`, which would be a backwards layering dependency).

Import `ThemeMode` as a type from `@astryxdesign/core/theme` (verified export path;
`SettingsPage.tsx:46`'s own doc comment already cites this exact import for the same
type, and `node_modules/@astryxdesign/core/src/theme/types.ts:88` confirms
`export type ThemeMode = 'system' | 'light' | 'dark';` — structurally identical to,
but not the same declaration as, `SettingsPage.tsx`'s own local `ThemeMode`
(`:463`); do not attempt to merge the two, that is out of scope).

### 2. A new provider — `src/app/ThemeModeProvider.tsx`

Modeled on `SeasonProvider.tsx` (`:173-220`) — context + injectable seam + a
must-be-called-within-provider hook, `refresh()` for live updates:

- `ThemeModeProvider({ children, loadThemeMode? })`, default `loadThemeMode`
  wired to `resolveThemeMode` above (same `getClient`-free signature shape —
  `resolveThemeMode` takes `userId` directly, so the provider's default is a thin
  `(userId) => resolveThemeMode(userId)`, not a `getClient`-injecting factory;
  verify which shape actually composes cleanly and note your choice).
- Reads `useAuth()` internally (same reasoning `SeasonProvider` does **not** need
  auth but this provider does: no session, no profile to read). When
  `user === null` (anonymous, or still loading), expose `'system'` without
  attempting a fetch — this is not an error state, it's the same default the app
  already has today, so there is nothing to fix for that case.
- Exposes a plain `ThemeMode` value (not a `'loading'|'ready'|'error'` union like
  `ActiveSeasonState` — there is no page here to render different states for; a
  transient `'system'` while resolving is indistinguishable from today's shipped
  behavior, not a regression) plus `refresh(): void`, same token-bump idiom
  `SeasonProvider.tsx:180,200-204` already uses.
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

### 4. Testability — pass-through props, the established pattern

`App.tsx` today takes **zero props** and hardcodes bare `<AuthProvider>`/would
hardcode a bare `<ThemeModeProvider>` — meaning no test could ever inject a fake
signed-in user or a fake `theme_mode` without changing this. **Do not invent a new
convention for this.** `AppShell.tsx:112,159` (`seasonProviderProps?:
Omit<SeasonProviderProps, 'children'>`, spread as `<SeasonProvider
{...seasonProviderProps}>`) is exactly this problem, already solved and already
checker-verified twice (T139, T140 — `docs/swarm/task-ledger.md` rows for those
ids) as a safe, additive, zero-risk-to-existing-callers pattern. Mirror it exactly:

```ts
export interface AppProps {
  authProviderProps?: Omit<AuthProviderProps, 'children'>;
  themeModeProviderProps?: Omit<ThemeModeProviderProps, 'children'>;
}
export default function App({ authProviderProps, themeModeProviderProps }: AppProps = {}) {
  ...
  <AuthProvider {...authProviderProps}>
    <ThemeModeProvider {...themeModeProviderProps}>
```

Both default to `undefined`, spreading to nothing — `main.tsx`'s existing bare
`<App />` (no changes needed there) and `theme.smoke.test.tsx`'s existing bare
`<App />` render (`theme.smoke.test.tsx:30`, must keep passing unmodified) both
behave identically to today.

### 5. Live update after a Settings change

`src/test-utils/authHarness.tsx`'s `LoginAs`/`buildFakeAuthModule` (`:76-133`) is
the existing fake-session convention — use it for tests, do not build a second one.

`SettingsPage.tsx`'s `persistTheme` (`:903-912`) currently only handles the failure
path (`.catch`). Add a success path that calls the new provider's `refresh()`, the
same way `SeasonSettings.tsx:727-728` already calls `useActiveSeason().refresh()`
after its own successful mutation (module doc #9 there, `:285`). `SettingsPage`
renders inside `App`'s normal (non-chromeless) tree, so `useThemeMode()` is reachable
there. Both the initial change (`handleThemeChange`) and the Retry button
(`:1119-1123`, calls `persistTheme` again) go through this one function, so wiring
`refresh()` there covers both.

**Remove the now-false disclaimer at `SettingsPage.tsx:1137-1139`** ("This saves
your choice. It doesn't change how the app looks right now.") — once this task
lands, it does change how the app looks, immediately, in the same session.

## Acceptance Criteria

1. `resolveThemeMode` added to `src/lib/supabase/auth.ts`, additive only —
   `resolveRole` and every other existing export in that file byte-unchanged.
2. `ThemeModeProvider`/`useThemeMode()` built in `src/app/ThemeModeProvider.tsx`,
   modeled on `SeasonProvider.tsx`'s shape (injectable `loadThemeMode`, `refresh()`,
   fail-loud-outside-provider hook). Anonymous/no-user resolves to `'system'`
   without a fetch attempt.
3. `App.tsx` mounts `ThemeModeProvider` between `AuthProvider` and `Theme`, and
   `Theme` receives a real `mode` prop sourced from `useThemeMode()`. The top-of-file
   provider-order doc comment is updated to match.
4. `App.tsx` gains `authProviderProps`/`themeModeProviderProps` pass-through props,
   both optional, mirroring `AppShell.tsx`'s `seasonProviderProps` pattern exactly.
   `main.tsx` needs no changes. `theme.smoke.test.tsx` passes unmodified.
5. Regression test (new `ThemeModeProvider.test.tsx`, standalone — mirror
   `SeasonProvider.test.tsx`'s harness shape, not a full `<App/>` render): for an
   authenticated user with `theme_mode` stored as each of `'light'`/`'dark'`/
   `'system'`/an invalid free-text value/no matching row, the exposed `mode` is
   correct in every case (the last two both resolve to `'system'`).
6. Regression test (new `App.test.tsx`, using `authProviderProps`/
   `themeModeProviderProps` injection): for an authenticated user with an injected
   `loadThemeMode` returning `'dark'`, `document.documentElement.getAttribute(
   'data-theme')` is `'dark'`; returning `'light'` → `'light'`; returning `'system'`
   → the attribute is **absent** (matches `Theme`'s own documented behavior, not an
   arbitrary choice — cite `Theme.tsx:208-213`). Unauthenticated → absent (system
   default), no fetch attempted (assert via a `loadThemeMode` spy never being called).

   **Prove discrimination:** with the fix removed (revert `App.tsx`'s `mode` prop to
   omitted), confirm the `'dark'`/`'light'` cases both fail (attribute stays absent
   regardless of the injected value). Restore, confirm both pass. Report what you
   saw.
7. Regression test proving live update: using `ThemeModeProvider.test.tsx`'s harness
   (mirror `SeasonProvider.test.tsx:174-188`'s `refresh()`-button pattern), change
   the injected `loadThemeMode`'s return value, call `refresh()`, confirm the exposed
   `mode` updates without remounting the provider.
8. `SettingsPage.tsx`'s `persistTheme` calls the new provider's `refresh()` on a
   successful `onChangeTheme`, not just on failure. Prove it: a test asserting a
   fake `refresh` (or equivalent observable) fires after a successful theme change
   but not after a rejected one.
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
    `npx vitest run` all clean. Baselines at this packet's commit: **0 errors, 354
    warnings**, 63 test files, **1474 tests**. You are adding two new test files
    (`ThemeModeProvider.test.tsx`, `App.test.tsx`) — report the new file/test counts
    and explain the delta.

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
- `src/app/SeasonProvider.tsx`, `src/app/AppShell.tsx` — read as precedent only, do
  not edit
- `src/theme/**` (`volt.ts`, `theme.css`) — no token/contrast work in this task
- `src/main.tsx` — no changes needed (new `App` props are optional)
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
  `@astryxdesign/core` source, not assumed from the PRD text alone. If anything
  here does not match the tree, **stop and report the mismatch rather than
  guessing at intent.**

## Required Worker Output

Create `docs/swarm/active/T148-worker-output.md` covering: the exact
`ThemeModeProvider`/`resolveThemeMode` shapes you built and why (especially if you
deviated from the suggested signatures in Design section 1/2); confirmation
`guards.tsx` and `src/theme/**` are byte-unchanged; the discrimination proof for
criterion 6; the live-update proof for criteria 7/8; confirmation the stale
disclaimer copy is gone; the tiering judgment call (agree or disagree, and why);
explicit restatement that "additional themes" was not resolved, discussed as
feasible, or scoped; full command output; and anything you could not verify, stated
plainly as unverified.

Do not mark this task complete. A checker verifies it.
