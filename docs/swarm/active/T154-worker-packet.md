# Worker Packet: T154 — key the theme seed by user, not by browser

**Revision 2.** Revision 1 gated **DISPATCH with 4 MINOR + 2 NIT**, but the
gate's [F1] finding changes the design rather than being a follow-up — the
orchestrator is taking the cheaper, safer path the gate offered instead of
dispatching revision 1 as written. Authority for this revision:
`docs/swarm/auto-mode-decisions.md`, section **"2026-07-30 — T154: adopting
the app-owned storage key, and the fix that could have reintroduced its own
bug"**. That is the orchestrator's own decision, under delegated auto-mode
authority — not the human owner's. See "Authorization," below, for exactly
what is and isn't George's in this packet.

**What changed from revision 1, in one sentence:** instead of *deriving*
`supabase-js`'s internal storage-key format from `VITE_SUPABASE_URL`, this
revision has the app **own** the key outright, via `storageKey`, a public,
typed `supabase-js` option — which deletes the derivation logic, deletes
criterion 1's four URL-parsing cases, removes an "undocumented internal
format" caveat from shipping source, and closes a fail-dangerous branch the
gate measured in revision 1's design (below).

## Authorization — two different authorities, do not conflate them

1. **The user-centric design (key the seed by person, not by browser) is
   George's own ruling**, not the orchestrator's. Cited verbatim in
   `docs/swarm/auto-mode-decisions.md`, section **"2026-07-30 — George's
   rulings on the three items that were waiting for him,"** item 3: *"T154 —
   do not accept the shared-browser bleed. Fix it properly. He asked what the
   correct user-centric method is, and on being given it, authorized packeting
   it."* That section's sub-heading, **"The T154 design he approved, and why
   it is right rather than merely better,"** is the design this packet still
   implements — Bob's lookup should find nothing and fall through to his OS,
   not destroy Alice's preference on logout. Revision 2 changes *how* the
   user id is read (see below); it does not change this.

2. **Owning rather than deriving the storage key ([CP1]) is the
   orchestrator's decision**, made after revision 1 gated, under the same
   delegated auto-mode authority — not a second thing George ruled on. Do not
   attribute it to him in your output doc.

3. **Rewriting `ThemeModeProvider.test.tsx`'s existing seed-related tests is
   also the orchestrator's authorization, not George's**, and this is a
   correction to revision 1, which got this wrong. George's ruling (cited
   above) authorizes fixing the bleed; it says nothing about test files. The
   authorization to rewrite the four tests that reference the old flat
   `THEME_MODE_STORAGE_KEY` rests on the gate's own measurement in revision
   1's review — exactly four tests fail, and only because they read or write
   the key this task is replacing — combined with the orchestrator's
   standing delegated authority to approve exactly that kind of narrowly-scoped
   test update. See criterion 9 for the exact citation to use; do not cite
   "constitution item 10" (that is the additive-migrations rule) or George's
   ruling for this specific point.

**Do not build clear-on-logout, in any form.** Unchanged from revision 1:
T148's own gate already disproved every in-scope variant (see "What this
packet does NOT build" below).

## [F1] — why revision 1's derivation was rejected, not merely improved

Revision 1 proposed reading `user.id` out of `supabase-js`'s own
**default-derived** storage key (`` `sb-${hostname.split('.')[0]}-auth-token` ``,
`node_modules/@supabase/supabase-js/dist/index.mjs:680`). The gate's [F1]
measured what that costs: if a future SDK version ever changes that formula
and an **old-format key is left orphaned** in a browser holding whatever
session was last persisted there, `readSessionUserId()` reads the **stale**
user's id from the orphaned key — not the current one — and seeds the current
visitor with a stranger's theme. The mechanism that fixes the bleed becomes
the mechanism that causes it, in exactly the scenario (a shared/reused
browser) this task exists to protect. This is a real branch, not a contrived
edge case: it requires only an SDK upgrade plus one browser that hasn't
re-authenticated since.

**Decision: own the key instead of deriving it ([CP1]).** `storageKey` is a
documented, public constructor option — confirmed directly against installed
source, not assumed: `GoTrueClient.js:83` shows it in the class's own JSDoc
usage example; `GoTrueClient.js:160` (`this.storageKey = settings.storageKey`)
and `:2467` (`getItemAsync(this.storage, this.storageKey)`) show it is read
verbatim from whatever the caller supplied, with no special-casing of the
default vs. a caller-supplied value. `supabase-js`'s own constructor
(`index.mjs:680-684`) builds its `DEFAULTS.auth.storageKey` from the derived
formula, then `applySettingDefaults` (`index.mjs:400-421`, specifically
`:408`: `auth: {...DEFAULT_AUTH_OPTIONS$1, ...authOptions}`) shallow-spreads
the **caller's** `authOptions` over those defaults — so passing
`{ auth: { storageKey: OURS } }` to `createClient` cleanly overrides the
derived default with no residual reference to it anywhere. Verified by
reading the merge function itself, not by trusting that spreading "should"
work.

With an app-owned key, [F1]'s branch is **unreachable** — there is no formula
to drift, so there is nothing for a future SDK change to silently break.
[CP2] (revision 1's proposed drift detector, testing that the derived key
still matches the SDK's actual default) is now unnecessary and is **not**
part of this revision: with nothing being derived, there is nothing to detect
drift in.

## Consequence: one enforced re-login, and why the cost is zero today

Changing the storage key orphans any session already persisted under the old,
`supabase-js`-derived key — the SDK will no longer find it, so that browser's
user is signed out and must sign in again once. **This costs nothing right
now.** T063 (MIG-04 migration cutover) and T052/T070 (Vercel go-live) are all
still blocked human gates — there is no production deployment, so the
"affected population" is developer/test browsers, not real users. State this
plainly in your output doc; it is the reason this is landing now rather than
being deferred until the mechanism is cheaper.

## Tiering: opus, not sonnet — revised from revision 1

Revision 1 recorded sonnet, reasoning it added "a new pattern, not a change to
auth logic." That reasoning does not survive this revision: `client.ts:79`'s
one `createClient(...)` call site now takes a real `auth: { storageKey }`
option — this **is** auth configuration, squarely inside constitution item
18's "changes auth, session, role-resolution, or permission logic" trigger.
**Opus tier for this dispatch.** Record it on the ledger row.

## Mechanism — re-verified against installed source for this revision

Only the parts still load-bearing after [CP1]:

1. **`persistSession` defaults to `true`.** `index.mjs:35-40`
   (`DEFAULT_AUTH_OPTIONS`), unaffected by adding `storageKey` alongside it in
   the same `auth` options object. `client.ts:79`'s one call site still passes
   no other `auth` options, so `persistSession`/`autoRefreshToken`/
   `detectSessionInUrl`/`flowType` all keep their defaults — this task changes
   exactly one field of that object.
2. **Where the user id lands, independent of which key is used.**
   `GoTrueClient.js`'s `_saveSession` (`:4278-4313`): when no `userStorage` is
   configured (`settings.userStorage`, `GoTrueClient.js:245-246` — this app
   configures none, confirmed by `client.ts:79` passing no such option), the
   `else` branch (`:4306-4312`) deep-clones the **full session, including
   `.user`**, and writes it to `this.storage` (defaults to `localStorage`,
   `GoTrueClient.js:237-238`) under `this.storageKey` — whatever that is. This
   was true under the derived key in revision 1 and is equally true under an
   app-owned key: `_saveSession` has no special-casing for which storage key
   it's given. `user.id` is therefore synchronously readable at
   `JSON.parse(localStorage.getItem(SUPABASE_AUTH_STORAGE_KEY)).user.id`.
3. **The key is now a compile-time constant, not a runtime derivation.** No
   `VITE_SUPABASE_URL` parsing, no `new URL(...)`, no malformed-URL branch —
   all of revision 1's Mechanism point 1 and Design section 1 are deleted, not
   modified.

## Design — the exact, minimal diff

### 1. `src/lib/supabase/client.ts` — one new export, one changed call

Replace revision 1's `getPersistedSessionStorageKey()` function entirely with
a plain exported constant, and pass it to the one `createClient` call site:

```ts
/**
 * The localStorage key this app uses to persist the Supabase session,
 * passed explicitly to `createClient` below via `auth.storageKey`. Owned by
 * this app, not derived from `supabase-js`'s own internal default
 * (`sb-${hostname}-auth-token` — undocumented, free to change on an SDK
 * upgrade with no deprecation notice). T154's worker packet: deriving that
 * format was rejected because an SDK format change could orphan an
 * old-format key still holding a stale session, and a naive lookup would
 * then read the WRONG user's id — fail-dangerous. Owning the key removes
 * that branch: there is no formula to drift.
 */
export const SUPABASE_AUTH_STORAGE_KEY = 'volt.supabaseAuthToken';
```

```ts
cachedClient = createClient(url, anonKey, {
  auth: { storageKey: SUPABASE_AUTH_STORAGE_KEY },
});
```

Every other existing export in `client.ts` byte-unchanged. `readEnv()` is
untouched (this design no longer needs it for anything new).

### 2. `src/app/ThemeModeProvider.tsx` — unchanged from revision 1 except the key source

The per-uid keying scheme (`themeModeStorageKeyFor(uid)`,
`isPersistedSessionWithUserId`, the lazy initializer, the write-through using
`user.id` from `useAuth()`) is **unchanged from revision 1** — re-read that
section if you're starting fresh. The only edit is inside `readSessionUserId`:

```ts
import { SUPABASE_AUTH_STORAGE_KEY } from '../lib/supabase/client';

function readSessionUserId(): string | null {
  const storage = getStorage();
  if (!storage) return null;
  const raw = storage.getItem(SUPABASE_AUTH_STORAGE_KEY);
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  return isPersistedSessionWithUserId(parsed) ? parsed.user.id : null;
}
```

No `getPersistedSessionStorageKey()` call, no null-key branch (the constant is
never null), no URL parsing. Everything else in this file — the write-through
in the effect, `refresh()`, the context shape, `useThemeMode()` — is unchanged
from what's already shipped (T148) and unchanged from revision 1's plan for
this file.

### 3. What this packet does NOT build, and why

- **No migration of the old flat `volt.themeMode` key.** Strengthened from
  revision 1's "not economical" framing to the gate's sharper reasoning:
  migrating it isn't merely uneconomic, **it's incorrect**, because at the
  only moment you could migrate it — first read after upgrade — the code
  cannot tell whose preference the old flat value belongs to. Copying it into
  the first uid-keyed slot would hand that value to whichever user happens to
  load the page first, **permanently**, rather than for the one honestly-
  disclosed frame the current design accepts. An orphaned old key is strictly
  safer than a guessed migration. State this in your output doc as the reason,
  not "not worth it."
- **No key migration for the storage-key change itself either** ([CP1]'s own
  consequence, new to this revision) — see "Consequence" above. One re-login,
  currently free.
- **No clear-on-logout, in any form.** Unchanged from revision 1: `logout()`
  is in `guards.tsx` (Forbidden File), and T148's own gate already measured
  every in-scope variant of "clear when `user` is `null`" as actively
  destructive. Per-uid keying (now via an app-owned session key) makes the
  clearing question moot regardless — Bob's lookup was never going to reach
  Alice's key.

### Disclosed, accepted limitation — key accumulation (new to this revision)

Per-uid keying means every distinct user who has ever signed in on a given
browser leaves a permanent `volt.themeMode.<uid>` entry behind — nothing ever
deletes an old uid's key when a different user signs in. On a browser several
people share over a season (plausible for this app specifically — team
laptops, a kiosk-adjacent machine), this accumulates one small entry per
distinct user, unbounded over the life of the browser profile. This is a real
property of the design, not a defect: each entry is a few bytes, contains no
PII beyond a uid already present elsewhere in the same browser's storage (the
session blob itself), and unbounded-but-tiny accumulation is a strictly better
trade than either overwriting a stranger's preference or building eviction
logic for a cosmetic setting. **Disclose this in the module doc alongside the
other two accepted limitations** (no key migration, no clear-on-logout) —
do not build cleanup for it in this task.

## Acceptance Criteria — all require mutation proofs

Unchanged framing from revision 1: a test that passes whether or not the fix
is present is worth less than none. Every criterion below must be checkable by
reverting the corresponding piece and observing the test **fail**.

1. **`SUPABASE_AUTH_STORAGE_KEY` is exported from `client.ts` as the literal
   string constant, and the one `createClient` call site (`:79`) passes it via
   `auth.storageKey`.** Every other existing export in that file byte-
   unchanged. Prove the value actually reaches the constructed client — verify
   yourself which of these compiles cleanly against this project's installed
   types before committing to one: (a) read the property back off a
   client constructed with `vi.stubEnv`-supplied fake-but-well-formed
   credentials (`client.test.ts`'s existing convention already does this,
   `:1-19`); or (b) `vi.mock('@supabase/supabase-js', ...)` and assert the
   captured `createClient` call's third argument. State which you used and
   why the other didn't work, if you tried both. This replaces revision 1's
   four URL-derivation cases entirely — there is no URL parsing left to test.
2. **`readSessionUserId()` is fail-safe on every axis**, each with its own
   test in `ThemeModeProvider.test.tsx`:
   - no key present at all (`storage.getItem(SUPABASE_AUTH_STORAGE_KEY)` is
     `null`) → `null`, synchronous first-render `mode` is `'system'`.
   - key present but not valid JSON (e.g. the literal string `'not json{'`) →
     no thrown error, `null`, synchronous `mode` is `'system'`.
   - key present, valid JSON, but missing `.user` or `.user.id`, or
     `.user.id` is not a non-empty string → same fallback.

   Revision 1's fourth sub-case (malformed `VITE_SUPABASE_URL`) is deleted —
   there is no URL involved in this revision's `readSessionUserId` at all.
3. **Cross-user isolation (the criterion this task exists for) — unchanged
   from revision 1.** Pre-seed `localStorage` with
   `themeModeStorageKeyFor('user-alice') → 'dark'` and a persisted session
   blob at `SUPABASE_AUTH_STORAGE_KEY` whose `user.id` is `'user-bob'`. Assert
   synchronous first-render `mode` is `'system'`, not `'dark'`. Then also seed
   `themeModeStorageKeyFor('user-bob') → 'light'` and assert `mode` is
   `'light'` — not `'dark'`, not `'system'` — proving the *correct* per-uid
   key is read, not merely that the wrong one is avoided.
4. **Missing/corrupt session → no seed, never a wrong one.** Covered by
   criterion 2's three sub-cases; restate explicitly in the output doc.
5. **Synchronous-first-commit property, unweakened.** Same shape as T148's own
   criterion 5 and revision 1's criterion 5: pre-seed a per-uid theme value and
   a matching session blob at `SUPABASE_AUTH_STORAGE_KEY`, render with a
   `loadThemeMode` whose promise is deliberately held open, and assert the
   seeded mode shows **synchronously, before any `await`/microtask flush**.
6. **Anonymous mount reads/writes no seed.** With no `SUPABASE_AUTH_STORAGE_KEY`
   entry present and a genuinely anonymous `AuthModule`
   (`buildAnonymousAuthModule()`), spy on `Storage.prototype.getItem`/`setItem`
   and assert no call touches any `volt.themeMode.*` key across the whole
   mount-and-flush sequence.
7. Existing T148 behavior, migrated to per-uid and still tested: case 1
   (resolved `null` with a real seed present keeps the seed), case 2
   (rejection caught, `console.error` fired, `mode` kept), `refresh()` writes
   through to the authenticated user's per-uid key, `useThemeMode()` throws
   outside a provider (unchanged, untouched by this task).
8. The new "key accumulation" disclosure is present in `ThemeModeProvider.tsx`'s
   module doc, alongside the no-migration and no-clear-on-logout disclosures.
9. **This packet authorizes rewriting `ThemeModeProvider.test.tsx`'s existing
   seed-related tests** (the ones keyed to the old flat
   `THEME_MODE_STORAGE_KEY` constant) to use the new per-uid scheme — required,
   since the old flat key is being replaced. This satisfies the
   existing-tests non-negotiable at **`constitution.md:11`** (not item 10,
   which is the additive-migrations rule) via the "Authorization" section
   above, point 3: the orchestrator's own delegated authority, resting on the
   gate's measurement that exactly four tests fail and only because they read
   or write the key being replaced — **not** George's ruling, which covers the
   design, not the test files. Get this citation right in your output doc;
   revision 1 got it wrong in both the section number and the attribution.
10. `guards.tsx`, `authHarness.tsx`, `App.tsx`, `App.test.tsx`,
    `SettingsPage.tsx`, `SettingsPage.test.tsx`, `src/lib/supabase/auth.ts`,
    `auth.test.ts`, and everything under `src/theme/**` are byte-unchanged.
    This task touches exactly two production files (`client.ts`,
    `ThemeModeProvider.tsx`) and their two test files.
11. `npx tsc --noEmit`, `npx vite build`, `npm run format:check`,
    `npx eslint .`, `npx vitest run` all clean. **Baseline: 66 test files /
    1507 tests / 0 eslint errors / 355 warnings at HEAD `9c863c1`** —
    re-confirm at your own dispatch SHA, do not trust this figure blindly.
    Expect eslint warnings to **stay at 355**: `client.ts` exports no React
    component, so `react-refresh/only-export-components` cannot fire on the
    new plain constant regardless; confirm this reasoning yourself rather than
    only citing it.

## Allowed Files

- `src/lib/supabase/client.ts` (additive-plus-one-line-changed: the new
  exported constant; the `createClient` call gains a third argument; every
  other existing export byte-unchanged)
- `src/lib/supabase/client.test.ts` (additive only)
- `src/app/ThemeModeProvider.tsx` (per Design section 2 — only
  `readSessionUserId` and its import differ from revision 1's plan; everything
  else per revision 1)
- `src/app/ThemeModeProvider.test.tsx` (rework the seed-related tests to the
  per-uid scheme per criterion 9; add the new tests for criteria 3–6, 8)
- `docs/swarm/active/T154-worker-output.md` (create)

## Forbidden Files

- `docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`,
  `dispute-log.md`, `auto-mode-decisions.md`, `state-summary.md`
- Any other `docs/swarm/**` file, including other packets
- `.claude/**`
- `src/app/guards.tsx` — this task does not touch logout/session lifecycle
  logic; it only reads an already-persisted artifact the SDK itself writes
  under a key this app now owns. Stop and report rather than widening scope.
- `src/test-utils/authHarness.tsx`
- `src/App.tsx`, `src/App.test.tsx`
- `src/pages/settings/SettingsPage.tsx`, `SettingsPage.test.tsx`
- `src/lib/supabase/auth.ts`, `auth.test.ts` — `resolveThemeMode` is unrelated
  and stays byte-unchanged
- `src/theme/**` (`volt.ts`, `theme.css`) — no token/contrast work here
- `src/main.tsx`
- Anything under `node_modules/`

## Relevant Constitution Excerpts

- **Item 6** (PII/minors). This task reads `user.id` (a UUID, not PII by
  itself) out of a session blob the SDK already persists under a key this app
  now owns; it does not add any new PII to storage, logs, or fixtures.
  Confirm in your output doc.
- **Item 18** (agent tiering) — **opus**, revised up from revision 1's sonnet.
  See "Tiering," above: `client.ts:79`'s `createClient` call now takes real
  `auth` configuration, which is squarely inside this item's trigger list.
  Record the tier used on the ledger row.
- **Item 19c** — verify every citation in this packet against real, installed
  source before trusting it; several were re-derived specifically for this
  revision (see "Mechanism"/"[F1]" above) rather than carried over from
  revision 1 unchecked.
- **Non-Negotiable #2** (`constitution.md:11`) — "existing tests must pass
  unless the boss explicitly approves a test update." Satisfied via criterion
  9's citation, not item 10.
- **Item 21** — your completion report must state a commit SHA; the
  orchestrator verifies HEAD actually moved.
- **Item 22** — explicit pathspecs only when committing; never `git add -A`.
- **Item 23** — any mutation experiment runs in your own worktree.

## Required Worker Output

Create `docs/swarm/active/T154-worker-output.md` covering: the exact shapes
built in `client.ts` and `ThemeModeProvider.tsx`, and any deviation from the
suggested signatures above with reasoning; which technique you used to prove
criterion 1 (property readback vs. `vi.mock`) and why; the point-by-point
re-derivation of the "Mechanism" claims above, confirmed independently against
your own reading of the installed source; the cross-user isolation proof
(criterion 3) with actual before/after values; the missing/corrupt-session
proofs (criterion 2/4); the synchronous-first-commit proof (criterion 5); the
anonymous-mount proof (criterion 6); confirmation the key-accumulation
disclosure landed in the module doc (criterion 8); confirmation that
`guards.tsx`, `authHarness.tsx`, `App.tsx`, `SettingsPage.tsx`, `auth.ts`, and
`src/theme/**` are byte-unchanged; the tiering confirmation (opus, per this
revision); explicit confirmation that no migration of the old flat
`volt.themeMode` key was attempted, restating the "incorrect, not just
uneconomic" reasoning in your own words; explicit confirmation that no
clear-on-logout mechanism was built, in any form; full command output for
`tsc`/`build`/`format:check`/`eslint`/`vitest`, with the eslint-count
reasoning independently confirmed; and anything you could not verify, stated
plainly as unverified.

Do not mark this task complete. A checker verifies it.
