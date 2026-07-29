# Worker Packet: T154 — key the theme seed by user, not by browser

**Revision 1.**

**User-visible defect (T154 ledger row, filed under constitution item 20):**
`volt.themeMode` is a single browser-scoped `localStorage` key. If user A sets
Dark and signs out, user B's first paint on the same machine may show A's
last-set theme for one frame until B's own `theme_mode` resolves and
overwrites it.

## Authorization — this is George's own ruling, not the orchestrator's

Unlike several packets earlier in this project, **this one genuinely is
owner-authorized**, and the packet should be read that way. The authority is
`docs/swarm/auto-mode-decisions.md`, section **"2026-07-30 — George's rulings
on the three items that were waiting for him"**, item 3:

> **T154 — do not accept the shared-browser bleed. Fix it properly.** He asked
> what the correct user-centric method is, and on being given it, authorized
> packeting it.

That section's own sub-heading, **"The T154 design he approved, and why it is
right rather than merely better,"** is the design this packet implements:

> The defect was never "we remember the theme". It is that the memory was
> filed under **this browser** when it should be filed under **this person on
> this browser**. Bob should not inherit Alice's theme for the same reason he
> should not inherit her inbox.
>
> And critically, the fix is *not* to destroy Alice's preference when she
> signs out — which is what clearing on logout does, and why every version of
> that idea failed. It is to key the seed by user id so Bob's lookup simply
> finds nothing and falls through to his OS, while Alice's survives for her
> next sign-in, which is what she would expect.

**Do not build clear-on-logout, in any form.** T148's own gate already
disproved every in-scope variant of it (see "What this packet does NOT build"
below) — that finding is not being relitigated here, it is the reason this
packet exists at all.

## Mechanism — re-derived against the installed source, not assumed

The auto-mode-decisions entry above proposes a mechanism and explicitly flags
one branch as unverified. Both were re-checked here, directly against the
installed packages in this repo (not the entry's own citations, which were
independently re-confirmed to be accurate):

1. **`supabase-js`'s default storage key.**
   `node_modules/@supabase/supabase-js/dist/index.mjs:680`:
   ```js
   const defaultStorageKey = `sb-${baseUrl.hostname.split(".")[0]}-auth-token`;
   ```
   `baseUrl` (`:672`) is `validateSupabaseUrl(supabaseUrl)` (`:429-438`), which
   is `new URL(ensureTrailingSlash(trimmedUrl))` where `trimmedUrl` is exactly
   the string passed as `createClient`'s first argument — in this app, that is
   `readEnv().url`, i.e. `VITE_SUPABASE_URL.trim()`
   (`src/lib/supabase/client.ts:40-48,71-80`). Confirmed line and expression
   exactly as cited.

2. **`persistSession` defaults to `true`.**
   `node_modules/@supabase/supabase-js/dist/index.mjs:35-40`:
   ```js
   const DEFAULT_AUTH_OPTIONS = {
     autoRefreshToken: true,
     persistSession: true,
     detectSessionInUrl: true,
     flowType: "implicit"
   };
   ```
   `client.ts`'s one `createClient(url, anonKey)` call site (`:79`) passes no
   `auth` options at all, so this default applies unmodified. Confirmed.

3. **Where the user id actually lands — re-checked, not trusted either
   branch.** `node_modules/@supabase/auth-js/dist/module/GoTrueClient.js`'s
   `_saveSession` (`:4278-4312`):
   ```js
   async _saveSession(session) {
     ...
     if (this.userStorage) {
       // writes session.user to storageKey + '-user' instead
       ...
     } else {
       // No userStorage is configured.
       const clonedSession = deepClone(sessionToProcess); // still has .user
       await setItemAsync(this.storage, this.storageKey, clonedSession);
     }
   }
   ```
   `this.userStorage` is set only from `settings.auth.userStorage`
   (`GoTrueClient.js:245-246`), and `client.ts`'s one `createClient` call
   configures no `auth` options at all (point 2 above) — so `userStorage` is
   `undefined` in this app, unconditionally. **The `else` branch at
   `:4306-4311` is the one that runs**: the full session, including `.user`,
   is deep-cloned and written to `this.storage` (the default, `localStorage`)
   under the **main** `this.storageKey` — i.e. `sb-<host>-auth-token`, the
   exact key from point 1. `setItemAsync` (`helpers.js:101-103`) writes it as
   `JSON.stringify(data)`. **`user.id` is therefore synchronously readable**
   by `JSON.parse(localStorage.getItem(storageKey)).user.id`, at the same key
   the SDK itself reads from — no separate `-user` key is ever written or
   needed in this app's configuration. This is the branch that matters; the
   `userStorage` branch is dead code for this app and should not be built
   against.

4. **The key is derivable without new configuration.** `client.ts:40-48`'s
   private `readEnv()` already reads `VITE_SUPABASE_URL` — no new env var, no
   `.env.example` change. **`client.ts` is not a Forbidden File in T148's
   packet** (it is simply absent from that packet's Allowed list, since T148
   never needed it) — this packet **does** need it, and opens it deliberately:
   see Allowed Files below. `readEnv()` itself stays module-private; a new,
   narrow, exported wrapper is added instead (Design section 1).

**My diagnosis of a real fragility, disclosed rather than worked around:**
the hostname-splitting formula in point 1 is **not documented public API** —
it is `supabase-js`'s own internal default computation, free to change on a
future SDK upgrade with no deprecation notice. This packet's design accepts
that risk explicitly, because the failure mode is fail-safe: if the formula
ever drifts, the derived key simply won't match what the SDK actually wrote,
`readSessionUserId()` (Design section 2) returns `null`, and the app falls
back to exactly the pre-T154 single-flash behavior — never a wrong theme,
never a cross-user leak. State this plainly in the new code's module doc, not
just here.

## Design — the exact, minimal diff

### 1. One new export in `src/lib/supabase/client.ts` (additive only)

```ts
/**
 * Derives the localStorage key `@supabase/supabase-js` uses by default to
 * persist the current session (`persistSession: true`, this app's own
 * config — see this task's worker packet for the full citation trail). This
 * mirrors supabase-js's own undocumented internal default
 * (`sb-${hostname.split('.')[0]}-auth-token`,
 * `node_modules/@supabase/supabase-js/dist/index.mjs:680`) — NOT a public
 * API. Returns `null`, never throws, when `VITE_SUPABASE_URL` is blank or
 * malformed: this function backs a best-effort UI seed (T154), not a data
 * operation, so its contract is fail-safe (null on any doubt), unlike
 * `getSupabaseClient()`'s fail-loud contract.
 */
export function getPersistedSessionStorageKey(): string | null {
  const { url } = readEnv();
  if (!url) return null;
  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    return null;
  }
  const host = hostname.split('.')[0];
  return host ? `sb-${host}-auth-token` : null;
}
```

Reuses the existing private `readEnv()` — do not duplicate the
`VITE_SUPABASE_URL` literal a second time in this file. `readEnv` itself stays
private; this is the only new export.

### 2. `src/app/ThemeModeProvider.tsx` — rekey the seed by uid

Replace the single flat `THEME_MODE_STORAGE_KEY` constant and its
read/write functions with a per-uid scheme:

```ts
import { getPersistedSessionStorageKey } from '../lib/supabase/client';

function themeModeStorageKeyFor(uid: string): string {
  return `volt.themeMode.${uid}`;
}

function isPersistedSessionWithUserId(value: unknown): value is { user: { id: string } } {
  if (typeof value !== 'object' || value === null || !('user' in value)) return false;
  const user = (value as { user: unknown }).user;
  if (typeof user !== 'object' || user === null || !('id' in user)) return false;
  const id = (user as { id: unknown }).id;
  return typeof id === 'string' && id.length > 0;
}

/** Synchronous, fail-safe: returns the signed-in user's id from the SDK's
 * own persisted session blob, or null on any absence/corruption/mismatch —
 * never throws. This is what lets the flash-fix seed (below) be scoped to
 * the right person before `useAuth()` has resolved anything (it starts
 * `user: null, isLoading: true` synchronously — `guards.tsx:225-233` — so it
 * cannot supply a uid on the first render; this function reads the same
 * underlying persisted artifact directly instead, independent of React). */
function readSessionUserId(): string | null {
  const storage = getStorage();
  if (!storage) return null;
  const key = getPersistedSessionStorageKey();
  if (!key) return null;
  const raw = storage.getItem(key);
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return isPersistedSessionWithUserId(parsed) ? parsed.user.id : null;
}

function readStoredThemeMode(uid: string): ThemeMode | null {
  const raw = getStorage()?.getItem(themeModeStorageKeyFor(uid)) ?? null;
  return isValidThemeMode(raw) ? raw : null;
}

function writeStoredThemeMode(uid: string, mode: ThemeMode): void {
  getStorage()?.setItem(themeModeStorageKeyFor(uid), mode);
}
```

`getStorage()` and `isValidThemeMode()` (already in this file) are unchanged.

**Lazy initializer** (load-bearing — this is the only place the synchronous
uid lookup is used; do not call `readSessionUserId()` anywhere else):

```ts
const [mode, setMode] = useState<ThemeMode>(() => {
  const uid = readSessionUserId();
  return uid ? (readStoredThemeMode(uid) ?? 'system') : 'system';
});
```

When there is no uid, `readStoredThemeMode` must not be called at all — this
is what "anonymous visitors read/write no seed" means at the code level (see
acceptance criterion 9).

**Write-through in the effect** — use the *authoritative* `user.id` from
`useAuth()` (already destructured at the top of the component), not the
synchronously-read uid, for both the initial resolve and every `refresh()`:

```ts
setMode(resolved);
writeStoredThemeMode(user.id, resolved);
```

Nothing else in the effect, the `refresh()` callback, the context shape, or
`useThemeMode()` changes. Case 1 (resolved `null` with a real seed present →
keep the seed) and case 2 (rejection → `.catch`, keep current `mode`) are
unchanged in behavior, just operating on a per-uid key now.

**Module doc:** update the "Three unhandled cases" section — case 3 (logout /
shared browser) is no longer a disclosed limitation, it is fixed. Replace its
text with a short description of the per-uid keying and cite this packet.
Keep the "no migration" disclosure (Design section 3 below) prominent, since
it is the one remaining, deliberate limitation.

### 3. What this packet does NOT build, and why — restate for a future reader

- **No migration of the old flat `volt.themeMode` key.** It becomes a
  permanently orphaned, harmless, unread entry in any browser that already
  had it. A user who visited before this ships gets exactly **one** ordinary
  flash on their next visit after deploy — the same single-flash experience
  that existed before T148 shipped the seed at all, not a regression relative
  to any state a real user has ever seen. State this explicitly in the output
  doc so a checker reads it as a deliberate, disclosed trade, not an
  oversight (the "no migration" pattern this project has hit before, per
  constitution item 20's own rationale).
- **No clear-on-logout, in any form.** `logout()` lives in `guards.tsx`
  (Forbidden File, unrelated to this task's scope either way) and T148's own
  gate already measured every in-scope variant of "clear when `user` is
  `null`" as actively destructive — it fires on every normal page load while
  auth is still resolving, permanently wipes the seed on a rejecting loader,
  and permanently wipes it on any genuinely anonymous visit, since nothing
  ever restores it. This packet does not reopen that question; keying by uid
  makes the clearing question moot (Bob was never going to read Alice's key
  in the first place, so there is nothing that needs clearing on her behalf).

## Acceptance Criteria — all require mutation proofs

A test that passes whether or not the fix is present is worth less than
none — this project has spent multiple rework rounds on exactly that failure
shape. Every criterion below must be checkable by reverting the corresponding
piece of the fix and observing the test **fail**, not just by observing it
pass once with the fix in place.

1. `getPersistedSessionStorageKey` added to `client.ts`, additive only —
   every existing export in that file byte-unchanged. New `describe` block in
   `client.test.ts` (reuse the existing `vi.stubEnv`/`vi.unstubAllEnvs()`
   convention at `:1-19`): blank URL → `null`; undefined URL → `null`;
   malformed URL (no scheme, e.g. `'example.supabase.co'`) → `null`; a
   well-formed multi-label URL (e.g. `'https://abcdefgh.supabase.co'`) →
   exactly `'sb-abcdefgh-auth-token'` (only the first hostname label is
   used — assert the literal string, not just "is truthy", so a worker cannot
   satisfy this with a wrong-but-present key).

2. `ThemeModeProvider.tsx`'s storage helpers take `uid` as specified in
   Design section 2. `readSessionUserId()` is fail-safe on every axis, each
   with its own test in `ThemeModeProvider.test.tsx`:
   - no `sb-*-auth-token` key present at all → `null` (verify indirectly:
     synchronous first-render `mode` is `'system'` even with a per-uid seed
     present for some other uid).
   - `sb-*-auth-token` present but not valid JSON (e.g. the literal string
     `'not json{'`) → no seed, no thrown error, synchronous `mode` is
     `'system'`.
   - `sb-*-auth-token` present, valid JSON, but missing `.user` or
     `.user.id`, or `.user.id` is not a non-empty string → same fallback.
   Compute the expected key in the test by **calling
   `getPersistedSessionStorageKey()` after `vi.stubEnv`**, not by
   hand-writing a second, parallel `sb-...-auth-token` string literal — this
   avoids a test-only reimplementation of the same formula silently drifting
   from the production one.

3. **Cross-user isolation (the criterion this task exists for).** Pre-seed
   `localStorage` with `themeModeStorageKeyFor('user-alice') → 'dark'` and a
   persisted session blob (via `vi.stubEnv` + the real derived key) whose
   `user.id` is `'user-bob'`. Assert the synchronous first-render `mode` is
   **`'system'`**, not `'dark'` — Bob's lookup must find nothing, not Alice's
   value. Then, in a second case, also seed
   `themeModeStorageKeyFor('user-bob') → 'light'` and assert the synchronous
   first-render `mode` is **`'light'`**, not `'dark'` and not `'system'` —
   proving the *correct* per-uid key is read, not merely that the wrong one
   is avoided. Both cases must use the literal, distinguishable values above
   (not e.g. the same value for both users), so a broken implementation that
   reads *some* key rather than *the right* key cannot pass by accident.

4. **Missing/corrupt session → no seed, never a wrong one.** Covered by
   criterion 2's three sub-cases; restate explicitly in the output doc as
   satisfying this specific brief requirement.

5. **Synchronous-first-commit property, unweakened.** Reproduce T148's own
   criterion-5 shape exactly, against the new per-uid mechanism: pre-seed a
   per-uid theme value and a matching session blob for that same uid, render
   with a `loadThemeMode` whose promise is deliberately held open, and assert
   the seeded mode is showing **synchronously, before any `await`/microtask
   flush** — not just at the final settled state. This is the whole reason
   the seed exists; if this regresses, the fix is worthless even if every
   other criterion passes.

6. **Anonymous mount reads/writes no seed.** With no `sb-*-auth-token` key
   present and a genuinely anonymous `AuthModule` (the existing
   `buildAnonymousAuthModule()` pattern already in this test file), spy on
   `Storage.prototype.getItem`/`setItem` (or an equivalent narrower spy) and
   assert **no call** touches any key matching `volt.themeMode.*` across the
   whole mount-and-flush sequence. The existing "does not attempt a fetch
   while unauthenticated" test's `loadThemeMode` assertion stays; this is an
   additional, storage-level assertion, not a replacement.

7. Existing T148 behavior, migrated to per-uid and still tested: case 1
   (resolved `null` with a real seed present keeps the seed — now scoped to
   the authenticated test user's own key), case 2 (rejection caught,
   `console.error` fired, `mode` kept), `refresh()` writes the new value
   through to the **same authenticated user's** per-uid key,
   `useThemeMode()` throws outside a provider (unchanged, untouched by this
   task).

8. **This packet authorizes rewriting `ThemeModeProvider.test.tsx`'s existing
   seed-related tests** (the ones keyed to the old flat
   `THEME_MODE_STORAGE_KEY` constant) to use the new per-uid scheme —
   required, not optional, since the old flat key is being replaced. This
   satisfies constitution item 10 ("existing tests must pass unless the boss
   explicitly approves a test update") via the citation in the Authorization
   section above: George approved fixing this "properly," and the ledger row
   this packet implements records the exact mechanism.

9. `guards.tsx`, `authHarness.tsx`, `App.tsx`, `App.test.tsx`,
   `SettingsPage.tsx`, `SettingsPage.test.tsx`, `src/lib/supabase/auth.ts`,
   `auth.test.ts`, and everything under `src/theme/**` are byte-unchanged.
   This task touches exactly two production files
   (`client.ts`, `ThemeModeProvider.tsx`) and their two test files.

10. `npx tsc --noEmit`, `npx vite build`, `npm run format:check`,
    `npx eslint .`, `npx vitest run` all clean. **Baseline as given by the
    orchestrator, measured at HEAD `84bd6a4` (re-confirm at your own dispatch
    SHA, do not trust this figure blindly — this project has hit stale
    baselines repeatedly): 66 test files / 1507 tests / 0 eslint errors / 355
    warnings.** Expect eslint warnings to **stay at 355**: `client.ts` exports
    no React component, so `react-refresh/only-export-components` cannot fire
    on a new plain-function export there regardless of count, and every new
    helper in `ThemeModeProvider.tsx` (Design section 2) stays module-private
    exactly as T148's own already-warned-about file requires — confirm this
    reasoning yourself rather than only citing it, the same way T148's own
    checker confirmed 355 vs. 357 by diffing full eslint JSON output, not by
    comparing totals.

## Allowed Files

- `src/lib/supabase/client.ts` (additive only — one new exported function;
  every existing export byte-unchanged; see criterion 1)
- `src/lib/supabase/client.test.ts` (additive only — one new `describe`
  block; every existing test byte-unchanged)
- `src/app/ThemeModeProvider.tsx` (rework the storage helpers, the lazy
  initializer, and the write-through call per Design section 2; the context
  shape, `refresh()` mechanism, effect skeleton, and `useThemeMode()` are
  otherwise unchanged)
- `src/app/ThemeModeProvider.test.tsx` (rework the seed-related tests to the
  per-uid scheme per criterion 8; add the new tests for criteria 3, 4, 5, 6)
- `docs/swarm/active/T154-worker-output.md` (create)

## Forbidden Files

- `docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`,
  `dispute-log.md`, `auto-mode-decisions.md`, `state-summary.md`
- Any other `docs/swarm/**` file, including other packets
- `.claude/**`
- `src/app/guards.tsx` — this task does not touch logout/session lifecycle
  logic; it only reads an already-persisted artifact the SDK itself writes.
  If you find yourself needing to edit this file, stop and report rather than
  widening scope — see "What this packet does NOT build" above.
- `src/test-utils/authHarness.tsx`
- `src/App.tsx`, `src/App.test.tsx`
- `src/pages/settings/SettingsPage.tsx`, `SettingsPage.test.tsx`
- `src/lib/supabase/auth.ts`, `auth.test.ts` — `resolveThemeMode` is
  unrelated to this task and stays byte-unchanged
- `src/theme/**` (`volt.ts`, `theme.css`) — no token/contrast work here
- `src/main.tsx`
- Anything under `node_modules/`

## Relevant Constitution Excerpts

- **Item 6** (PII/minors). This task reads `user.id` (a UUID, not PII by
  itself) out of a session blob the SDK already persists in this browser;
  it does not add any new PII to storage, logs, or fixtures, and does not
  read email or name fields off that blob. Confirm this in your output doc.
- **Item 18** (agent tiering). This task does not create/edit a migration,
  RLS policy, security-definer helper, or metric view, and does not change
  how sign-in, sign-out, role resolution, or permission checks work —
  `getInitialSession`/`resolveRole`/`signOut` etc. are byte-unchanged. It
  does add a new, read-only, best-effort parse of an already-persisted
  session artifact for a cosmetic (theme) purpose — a new *pattern* for this
  codebase, though not a change to auth logic itself. Recorded judgment:
  **sonnet tier**, matching T148's own reasoning for `resolveThemeMode`. If
  you disagree after reading the file, say so in your output doc rather than
  silently deciding either way — this is a closer call than most sonnet-tier
  tasks and worth a second look either from you or the checker.
- **Item 19c** — verify every citation in this packet against the real,
  installed source before trusting it; several were re-derived specifically
  for this packet (see "Mechanism" above) rather than copied from the
  auto-mode-decisions entry that proposed the design.
- **Item 21** — your completion report must state a commit SHA, and confirm
  the orchestrator can verify HEAD actually moved (not just that your
  worktree is clean).
- **Item 22** — explicit pathspecs only when committing; never
  `git add -A`/`git add .`.
- **Item 23** — any mutation experiment (reverting a piece of this fix to
  confirm a test fails, then restoring it) runs in your own worktree, never
  a shared tree.

## Required Worker Output

Create `docs/swarm/active/T154-worker-output.md` covering: the exact shapes
built in `client.ts` and `ThemeModeProvider.tsx` (and any deviation from the
suggested signatures above, with reasoning); the point-by-point re-derivation
of the four "Mechanism" claims above, confirmed independently against your
own reading of the installed source (not just trusting this packet); the
cross-user isolation proof (criterion 3) with the actual before/after
values; the missing/corrupt-session proofs (criterion 2/4); the
synchronous-first-commit proof (criterion 5), including the held-promise
technique; the anonymous-mount proof (criterion 6); confirmation that
`guards.tsx`, `authHarness.tsx`, `App.tsx`, `SettingsPage.tsx`, `auth.ts`,
and `src/theme/**` are byte-unchanged; the tiering judgment call (agree or
disagree, and why); explicit confirmation that no migration of the old flat
`volt.themeMode` key was attempted, and why that is the deliberate,
disclosed choice rather than an oversight; explicit confirmation that no
clear-on-logout mechanism was built, in any form; full command output for
`tsc`/`build`/`format:check`/`eslint`/`vitest`, with the eslint-count
reasoning independently confirmed (not just asserted); and anything you could
not verify, stated plainly as unverified.

Do not mark this task complete. A checker verifies it.
