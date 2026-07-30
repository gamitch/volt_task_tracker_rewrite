# T154 Worker Output — key the theme seed by user, not by browser

**Packet:** `docs/swarm/active/T154-worker-packet.md`, revision 2.
**Dispatch SHA (pinned):** `af2891453e4343e1b183a0b04d234762b0c29ad2`.
**Attempt 2** — reworked after the checker's FAIL on `772acf9` (1 MAJOR, 3 MINOR,
1 NIT). `origin/claude/swarm-plan-zl575z` (`1c119ae`) merged in first; the merge
was clean and **docs-only** (4 files: T155 packet, auto-mode-decisions, an inbox
note, the ledger) with no conflicts and no source overlap with this task.
**Tier used: opus**, per packet "Tiering" and constitution item 18 — `client.ts`'s
one `createClient` call site now takes a real `auth: { storageKey }` option, which
is auth configuration and squarely inside item 18's trigger list. Recorded here
for the ledger row.

**Not marking this task complete. A checker verifies it.**

---

## 0a. Rework after FAIL — the in-page account switch (MAJOR), and one deviation I need reviewed

The checker returned FAIL (1 MAJOR, 3 MINOR, 1 NIT) on `772acf9`. All four items
are addressed below; the MAJOR was **fixed, not deferred**, per the coordinator's
override.

**The MAJOR, restated honestly.** Per-uid keying fixed the fresh-load path and
nothing else. The seed is read **once per mount**; `ThemeModeProvider` mounts
above the router in `App.tsx`; and neither `logout()` (`guards.tsx:311-321`) nor
`login()` (`:293-300`) reloads — both only call `setState`. I verified both line
ranges myself. So the ordinary sign-out → `/login` → sign-in-as-B flow never
remounted the provider and never re-read the seed, and because case 1
deliberately keeps the current value when the fetch resolves `null`, B kept A's
theme for **the rest of the page session**. My shipped source asserted the
opposite in three places; those are corrected, and the false "moot regardless"
claim is now explicitly labelled as wrong in both the module doc and this report.

**The fix.** The provider tracks `lastSeededUserId` and, when the signed-in user
id differs from it, re-seeds from the **new user's own key**, falling back to
`'system'`. State is assigned **during render**, not in an effect — React's
sanctioned "adjust state when input changes" pattern — which is what preserves
the synchronous-first-commit property: React re-renders before children render or
anything commits, so the stale theme never reaches the DOM even for one frame.

### DEVIATION — the literal rule as written would not have fixed the bug

The instruction was to re-seed only when `user.id` changes **"from one non-null
value to a different non-null value."** Implemented literally against the
previous *rendered* value, **that never fires on the flow this task exists to
fix.** I checked `guards.tsx` rather than assuming: `logout()` sets
`user: null`, then `login()` sets the new user. So the real transition is
**A → null → B**, and every individual step has `null` on one side. A
"previous render was a different non-null user" test would sit there permanently
inert while B kept A's theme.

I implemented the rule against **the last non-null user the provider has seeded
for**, ignoring null transitions. This fires on A → null → B *and* on a direct
A → B, while still honouring all three prohibitions exactly as stated:

- never re-seeds while `user` is null (guarded by `if (user && …)`);
- never re-seeds on null → first user (guarded by `lastSeededUserId !== null`);
- re-seeds on a genuine account switch, from B's own key.

`ThemeModeProvider.test.tsx`'s *"does not attempt a fetch while unauthenticated"*
test passes **unmodified**, as required. A dedicated test covers the direct
A → B case so the distinction is pinned either way.

**Flagging this rather than quietly widening the rule**, since it is a change to
the trigger condition the coordinator specified. If the narrower literal reading
was intended for a reason I have not seen, the one-line change is
`user.id !== lastSeededUserId` → a previous-render comparison, and the
A → null → B test is the one that would then go red. I believe that would ship
the MAJOR unfixed, which is why I did not do it.

**Mutation proof (item 1).** Removing the re-seed block turns **4 tests red**
(the three switch tests plus the no-stale-frame test); restoring it returns all
green. The three "must NOT re-seed" guard tests correctly stay green under that
mutation — they constrain the fix rather than prove it, and I am not counting
them as evidence for it.

**Residual, disclosed not closed.** Between A signing out and B signing in, the
login screen still carries A's theme, because `user` is `null` there and we
deliberately do not re-seed. Resetting on null would re-introduce the T148 flash
on every page load and permanently on anonymous visits. A signed-out login screen
briefly showing the previous user's colour scheme leaks no name and no data — a
theme is not PII. Stated in the module doc as case 4's residual and covered by a
test that asserts exactly this behaviour, so it cannot regress silently.

---

## 0. Dispatch-base correction (read this first)

My worktree was created from a **stale base** and did not contain the code this
task modifies. `git rev-parse HEAD` was `2146255` (a merge commit dated
2026-07-27); `src/app/ThemeModeProvider.tsx` and `ThemeModeProvider.test.tsx`
**did not exist at all** in that tree, and the packet itself was absent from
`docs/swarm/active/`.

I did not treat this as a packet citation error, because I verified the
relationship rather than assuming:

- `git merge-base --is-ancestor HEAD af28914` → exit **0**: my HEAD was a strict
  ancestor of the pinned SHA.
- `git rev-list --count af28914..HEAD` → **0** commits ahead;
  `HEAD..af28914` → **155** commits behind.

So the pin was a clean fast-forward with nothing to lose, not a divergence. I ran
`git merge --ff-only af2891453e4343e1b183a0b04d234762b0c29ad2` and worked from
there. `9c863c1` (the packet's stated baseline HEAD) is also an ancestor of the
pin, confirmed by `--is-ancestor`. `node_modules/` was absent in the fresh
worktree; I ran `npm ci` (340 packages) so the SDK citations could be checked
against real installed source rather than assumed.

**One genuine packet inaccuracy found — reported, not worked around.** See §3.

---

## 1. Mechanism claims, re-derived independently against installed source

Every line number below is one I opened myself in this worktree after `npm ci`.
All of the packet's mechanism citations **hold**.

| Packet claim | Verified? | What I actually read |
|---|---|---|
| `persistSession` defaults `true`, `index.mjs:35-40` | yes | `dist/index.mjs:35-40` = `DEFAULT_AUTH_OPTIONS` with `persistSession: true` at `:37` |
| Derived default key formula, `index.mjs:680` | yes | `:680` `const defaultStorageKey = \`sb-${baseUrl.hostname.split(".")[0]}-auth-token\`` |
| `DEFAULTS.auth.storageKey` built at `:680-684` | yes | `:684` spreads `DEFAULT_AUTH_OPTIONS` then `{ storageKey: defaultStorageKey }` |
| `applySettingDefaults` shallow-spreads caller over defaults, `:400-421`, esp. `:408` | yes | `:400` function opens; `:408` is exactly `auth: _objectSpread2(_objectSpread2({}, DEFAULT_AUTH_OPTIONS$1), authOptions)` |
| `storageKey` is a public typed option | yes | `dist/index.d.mts:162` `storageKey?: string;` inside the public `auth?: {}` block, with its own doc comment |
| `GoTrueClient.js:83` JSDoc usage example | yes | `storageKey: 'supabase-auth',` inside the class's own `@example` |
| `GoTrueClient.js:160` `this.storageKey = settings.storageKey` | yes | verbatim at `:160`, taken from `Object.assign({}, DEFAULT_OPTIONS, options)` with no special-casing of default vs. caller value |
| `GoTrueClient.js:2467` `getItemAsync(this.storage, this.storageKey)` | yes | verbatim at `:2467` in `__loadSession` |
| `storage` defaults to `localStorage`, `:237-238` | yes | `if (supportsLocalStorage()) { this.storage = globalThis.localStorage; }` |
| `userStorage` only when configured, `:245-246` | yes | `if (settings.userStorage) { this.userStorage = settings.userStorage; }` — this app configures none |
| `_saveSession` `:4278-4313`, `else` branch `:4306-4312` writes the FULL session including `.user` | yes | `else` branch: `const clonedSession = deepClone(sessionToProcess); await setItemAsync(this.storage, this.storageKey, clonedSession);` — `sessionToProcess` still carries its original `.user` |

Two links the packet asserted but did not cite, which I checked because the whole
design rests on them:

1. **Our key actually reaches the auth client.** `index.mjs:690`
   `this.storageKey = settings.auth.storageKey ?? ""`, and `:852`/`:860`
   `_initSupabaseAuthClient({ ..., storageKey, ... })` forwards it into
   `GoTrueClient`. Without this the option would typecheck and do nothing.
2. **The on-disk encoding is plain JSON.** `auth-js/dist/module/lib/helpers.js:101`
   `setItemAsync = async (storage, key, data) => { await storage.setItem(key, JSON.stringify(data)); }`.
   So `JSON.parse(localStorage.getItem(SUPABASE_AUTH_STORAGE_KEY)).user.id` is a
   sound synchronous read, which is what makes the seed possible at all.

Net effect confirmed: passing `{ auth: { storageKey: OURS } }` overrides only the
derived default and leaves `persistSession`/`autoRefreshToken`/
`detectSessionInUrl`/`flowType` at their SDK defaults, because `:408` spreads the
caller's object *over* the defaults rather than replacing it.

---

## 2. Exact shapes built

### `src/lib/supabase/client.ts` — one additive export, one changed call

```ts
export const SUPABASE_AUTH_STORAGE_KEY = 'volt.supabaseAuthToken';
```

```ts
cachedClient = createClient(url, anonKey, {
  auth: { storageKey: SUPABASE_AUTH_STORAGE_KEY },
});
```

No deviation from the packet's suggested shape. `readEnv`, `isSupabaseConfigured`,
`SupabaseNotConfiguredError`, `getSupabaseClient`'s signature and
`resetSupabaseClientForTests` are **byte-unchanged** (see the diff in §7).
`grep -rn "createClient(" src/` still returns exactly one line, so the "one call
site" property T071 established is intact.

### `src/app/ThemeModeProvider.tsx` — per-uid keying, all helpers module-private

Kept module-private deliberately (no new exports) so the file picks up **no**
additional `react-refresh/only-export-components` warnings — the packet warned
this is the difference between 355 and 357. Confirmed: still 355.

```ts
function themeModeStorageKeyFor(userId: string): string {
  return `volt.themeMode.${userId}`;
}

interface PersistedSessionWithUserId { user: { id: string } }

function isPersistedSessionWithUserId(value: unknown): value is PersistedSessionWithUserId
function readSessionUserId(): string | null
function readSeededThemeMode(): ThemeMode | null
function writeStoredThemeMode(userId: string, mode: ThemeMode): void

// added by the rework:
function safeGetItem(key: string): string | null            // guards the getItem CALL
function readStoredThemeModeFor(userId: string): ThemeMode | null  // one user's key only
```

Plus the in-page re-seed in the provider body (§0a), which assigns state during
render:

```ts
const [lastSeededUserId, setLastSeededUserId] = useState<string | null>(() =>
  readSessionUserId(),
);
if (user && user.id !== lastSeededUserId) {
  setLastSeededUserId(user.id);
  if (lastSeededUserId !== null) {
    setMode(readStoredThemeModeFor(user.id) ?? 'system');
  }
}
```

All helpers remain **module-private** — no new exports — which is what holds the
eslint warning count at 355 (see §8).

Two deviations from the packet's literal sketch, both additive and reasoned:

1. The packet showed `readSessionUserId()` only. I added a thin
   **`readSeededThemeMode()`** wrapper that composes "read the uid, then read
   that uid's key". The packet's own lazy-initializer line
   (`readStoredThemeMode() ?? 'system'`) needed *some* single call to replace it;
   putting the composition in one named function keeps the fail-safe chain in one
   readable place instead of inlining it into `useState`.
2. `writeStoredThemeMode` takes the `userId` explicitly and the effect passes
   **`user.id` from `useAuth()`**, not a re-read of storage. Inside that branch
   `user` is known non-null, so a write can never land under another user's key
   even if storage were concurrently modified. The packet specified this
   ("the write-through using `user.id` from `useAuth()`"); noting it because it is
   the one place the code deliberately does *not* consult the session blob.

`refresh()`, the context shape, `useThemeMode()`, case 1 and case 2 handling are
otherwise unchanged from T148.

---

## 3. Criterion 1 technique — and a packet citation that does not hold

**I used option (b), `vi.mock('@supabase/supabase-js', ...)`, capturing the
third argument of the `createClient` call.**

Option (a) — reading the property back off a constructed client — is **not
possible in this project**, and I have hard evidence rather than a preference:

- `@supabase/supabase-js/dist/index.d.mts:433` declares
  **`protected storageKey: string;`** (same in
  `auth-js/dist/module/GoTrueClient.d.ts:34`). Reading a `protected` member from
  outside the class is a TypeScript error, and `npx tsc --noEmit` is one of this
  task's own acceptance gates. Option (a) would fail that gate.

**Packet inaccuracy (reporting, per the instruction to stop-and-report rather
than paper over):** criterion 1 says option (a) is what
"`client.test.ts`'s existing convention already does this, `:1-19`". That file's
header at `:1-19` says the **opposite** — verbatim: *"no real network calls
anywhere in this file (constructing a real client with well-formed-but-fake
credentials performs no network I/O by itself; **this file never does that
regardless**, to keep the 'no real network calls in tests' guarantee
unambiguous)"*. There is no existing convention of constructing a real client in
that file; the convention is explicitly to avoid it. Option (b) is therefore both
the only compiling choice and the one consistent with the file's stated
guarantee. This is a MINOR documentation error in the packet, not a blocker — it
pointed at the wrong justification for a choice that was already available.

Mocking is behaviorally inert for all ten pre-existing tests in that file: none
of them reach `createClient` (every `getSupabaseClient()` test throws
`SupabaseNotConfiguredError` at the configured-check before line 79). All ten
still pass unchanged.

---

## 4. Proofs, each with its mutation

Baseline re-confirmed at my own dispatch SHA before touching anything, exactly
matching the packet's figures: **66 test files / 1507 tests / 0 eslint errors /
355 warnings**. After the rework: **66 files / 1536 tests** (+29 from baseline:
4 in `client.test.ts`, 25 in `ThemeModeProvider.test.tsx`) / **0 errors / 355
warnings**. (Attempt 1 stood at 1528; the rework adds 8 — 7 account-switch tests
plus the throwing-`getItem` test.)

Every mutation below was run in my own worktree (item 23) and reverted from a
saved pristine copy.

### Criterion 3 — cross-user isolation, BOTH directions, distinguishable values

Three tests, values chosen so no single outcome can satisfy more than one:
Alice `'dark'`, Bob `'light'`, fallback `'system'`.

| Storage state | Live session | Asserted first-commit mode |
|---|---|---|
| `volt.themeMode.user-alice = 'dark'` | Bob | `'system'` — and `'dark'` never appears in ANY render |
| `...user-alice = 'dark'`, `...user-bob = 'light'` | Bob | `'light'` on render 0; `'dark'` never appears |
| identical storage to the row above | Alice | `'dark'` on render 0; `'light'` never appears |

The third row is the mirror image of the second across the *same* localStorage —
only the session differs — so the test proves the session is what selects the
value.

**Mutation 1: revert `themeModeStorageKeyFor` to the flat T148 key.** 8 tests
fail, including *"DOES serve user B his own seeded theme"*, *"serves Alice her own
theme"*, *"the old flat T148 key is never read"*, and criterion 5.

**This mutation also empirically confirmed the packet's tautology warning, which
I think is worth recording.** Under mutation 1 the negative-only test *"does NOT
serve user A's theme to user B"* **still passed** — vacuously, because the
mutated production code read a key the test never wrote, so the lookup returned
null for everyone. Exactly the dead-lookup-passes-anyway failure the gate
predicted. Only the paired positive assertion ("B reads *his own* value") caught
it. The pair is load-bearing; either half alone would be unsound.

### Criteria 2 + 4 — fail-safe on every axis: no seed, never a wrong one

Twelve cases, each asserting `'system'` **and** that the orphaned `'dark'` never
appears in any render:

- no session key present at all
- session key present but unparseable (`'not json{'`) → no throw
- truncated JSON (`'{"user":{"id":'`) with only one per-uid entry present — the
  fail-dangerous shape this design exists to make unreachable
- valid JSON but unusable, 7 sub-cases: no `.user`; `user: null`; no `.user.id`;
  `user.id` empty string; `user.id` not a string; blob is a bare JSON string;
  blob is JSON `null`
- valid session but an invalid stored theme value (`'chartreuse'`)

**Mutation 2: delete the `try/catch` around `JSON.parse`.** Exactly the two
corrupt-session tests fail. Confirms the catch is genuinely exercised, not
decorative.

Every path in `readSeededThemeMode` returns `null` → `'system'`: no storage, no
key, unparseable, non-object, missing/null `user`, missing/empty/non-string
`user.id`, invalid theme value. There is no default-to-last-known and no
cross-uid fallback anywhere.

**Correction to the first version's claim.** I wrote that I "audited every
branch… no exceptions found." That was **not exhaustive**, and the checker was
right to narrow it. `getStorage()` guards the property *access* to
`window.localStorage`, not the `getItem` **call**, which can itself throw. Both
render-path reads run inside a lazy `useState` initializer in a provider mounted
above the whole tree in `App.tsx`, so an escaping exception there is a **white
screen, not a flash** — a strictly worse failure than the one being prevented.

**I guarded rather than narrowed**, which the coordinator preferred conditional
on the warning count holding: both render-path reads now go through a
module-private `safeGetItem()` that try/catches the call. Measured — **eslint
stays at 0 errors / 355 warnings**, so guarding was free and no claim had to be
weakened. Proven by mutation 6 (remove the try/catch → the new
throwing-`getItem` test fails; restore → green).

The remaining un-guarded storage call is `writeStoredThemeMode`'s `setItem`
(quota-exceeded). That one is **not** on the render path — it runs inside the
resolve handler, where the existing `.catch` already contains it and logs. Listed
as residual risk item 3 rather than claimed as covered.

### Criterion 5 — synchronous first commit. **The packet's suggested test shape did not actually prove this.**

This is the most important finding in this report.

I first wrote criterion 5 the way the packet and T148 describe it: seed, render
with a never-resolving loader, assert the DOM synchronously with no `await`.
Then I ran the mutation that matters:

**Mutation 3: move the seed out of the lazy `useState` initializer into a
`useEffect`** (i.e. destroy the synchronous-first-commit property outright).

**All 28 tests passed.** The property was not being tested at all.

Cause: the harness wraps render in `act(() => root.render(...))`, and `act`
flushes passive effects before returning. So an effect-applied seed lands on the
DOM before any assertion runs, and a DOM-only assertion cannot distinguish
"seeded synchronously during render" from "seeded one commit later". T148's own
`criterion 5` test has the same weakness, and so does the packet's prescribed
shape for this revision.

**Fix:** I added a `RecordingProbe` that pushes `mode` into an array on **every**
render, and assert on `renders[0]`. A lazy initializer produces
`renders[0] === 'dark'` with `'system'` never present; an effect-based seed
necessarily renders `'system'` first and corrects on a second render.

**Corrected figure.** The first version of this doc claimed mutation 3 "fails
exactly one test." That was **wrong: it failed three** — the `renders[0]` /
`not.toContain` assertions in criterion 5, *"DOES serve user B his own seeded
theme"*, and *"serves Alice her own theme from the very same storage state."*
The coordinator measured 3 failed / 25 passed at `772acf9` and the checker
reproduced it; I re-ran it myself and confirm 3 on that tree. On the reworked
tree it now fails **four**, the fourth being the new *"does NOT re-seed on null
-> FIRST user"* test, which also asserts `renders[0]`. The direction was always
safe — I under-reported the mutation's blast radius, which understated how much
the recording probe actually covers — but it was the headline finding and the
number should have been right.

I applied the same recording technique to the cross-user and corrupt-session
tests via `expect(renders).not.toContain(...)`, because the reported bug was that
B *briefly* saw A's theme. "Never at any point," not "not in the settled DOM," is
the property that actually matches the bug report.

### Criterion 6 — anonymous mount touches no theme key

With no session entry and a genuinely anonymous `AuthModule`
(`buildAnonymousAuthModule()`), I spy on `Storage.prototype.getItem`/`setItem`,
collect every key touched across the whole mount-and-flush sequence, and assert
no key starting `volt.themeMode` appears. Also asserts `loadThemeMode` was never
called and mode is `'system'`. The lazy initializer does read
`SUPABASE_AUTH_STORAGE_KEY` (not a theme key), returns `null`, and stops before
constructing any per-uid key.

### Criterion 1 — the call site

**Mutation 4: drop the third argument from `createClient`.** All three call-site
tests fail. Tests assert: the constant is the literal `'volt.supabaseAuthToken'`;
the captured third argument carries it at `auth.storageKey`; `Object.keys(auth)`
is exactly `['storageKey']` (so `persistSession` is not accidentally shadowed);
and the key does **not** change when `VITE_SUPABASE_URL` changes — the
anti-derivation property stated as an executable assertion.

### Criterion 7 — T148 behavior preserved, migrated to per-uid

Case 1 (resolved `null` keeps the seed), case 2 (rejection caught, `console.error`
fired, mode kept), `refresh()` write-through to the per-uid key, and
`useThemeMode()` throwing outside a provider all still pass. The four tests keyed
to the old flat constant were reworked to seed both a session blob and the
per-uid entry (criterion 9).

---

## 5. Scope facts stated plainly

**One enforced re-login.** Changing the storage key orphans any session already
persisted under the SDK-derived key; those browsers sign in once more. **This
costs nothing today**: there is no production deployment. MIG-04 cutover (T063)
and the Vercel go-live (T052/T070) are both still **blocked human gates**, so the
affected population is developer/test browsers, not real users. That is why this
lands now rather than waiting for a cheaper mechanism.

**No migration of the old flat `volt.themeMode` key — because migrating it would
be incorrect, not merely uneconomic.** In my own words: at the only moment a
migration could run — the first read after upgrade — the code has no way to know
*whose* preference that flat value was. It was written by whoever last changed
their theme on this browser, and nothing recorded who that was. Copying it into
the first uid-keyed slot would therefore hand one person's setting to whoever
happens to open the page first, and **permanently**, since it would then be that
user's stored preference forever. That is strictly worse than the bug being
fixed: it converts a one-frame flash into a durable wrong value. An orphaned,
unread key is the safe outcome. A test asserts the old key is neither read nor
modified.

**No clear-on-logout was built, in any form.** `logout()` lives in `guards.tsx`
(Forbidden File) and is byte-unchanged. I built no variant of "clear when `user`
is `null`" anywhere — that branch is actively destructive, because `user` is
`null` during every normal page load while the session resolves, not only after a
real sign-out.

**Correction: I previously wrote that per-uid keying makes the question "moot
regardless." That was measurably false and is the MAJOR the checker caught.**
Per-uid keying fixes only the FRESH-LOAD path. The seed is read once per mount,
this provider mounts above the router, and `logout()`/`login()` only call
`setState` — so an in-page account switch never re-read the seed, and B inherited
A's theme *persistently* (case 1 keeps the current value when the fetch resolves
`null`). What actually closes the bleed is per-uid keying **plus** the in-page
re-seed added in this rework. Clear-on-logout remains unnecessary — but because
the re-seed handles it without destroying anyone's stored preference, not because
the question was moot.

**Key accumulation disclosed** (criterion 8) in `ThemeModeProvider.tsx`'s module
doc as limitation (c), alongside (a) no-migration and (b) no-clear-on-logout.
Every distinct user who signs in leaves a permanent `volt.themeMode.<uid>` entry;
nothing evicts them. Accepted, not built around.

---

## 6. Authorization — attributed exactly as the packet requires

- **The user-centric design** (key by person, not browser) is **George's own
  ruling**, per `auto-mode-decisions.md`, "George's rulings on the three items
  that were waiting for him," item 3.
- **Owning rather than deriving the storage key** is the **orchestrator's
  decision** under delegated auto-mode authority — **not** George's.
- **Rewriting the four seed-related tests** in `ThemeModeProvider.test.tsx` is
  the **orchestrator's authorization under delegated authority, not the human
  owner's.** George's ruling authorizes fixing the bleed and says nothing about
  test files. This satisfies the existing-tests non-negotiable at
  **`constitution.md:10`** — *"Existing tests must pass unless the boss
  explicitly approves a test update."* **Corrected from `:11` in the first
  version of this doc**, which was off by one: line 11 is *"No worker may mark
  its own work complete."* (The packet carried the same `:11` error; flagging
  the provenance, not to shift responsibility — I should have verified the line
  myself under item 19c, and did not.) Note the two referents that collide
  here: the **line** is `:10`, whereas the numbered Project-Specific Standard
  **item 10** is the additive-migrations rule and is *not* what this rests on.
  The gate measured that exactly four tests fail and only because they
  read or write the key being replaced; I confirmed that count myself (lines
  141, 201, 224, 249 of the original file were the only ones referencing
  `THEME_MODE_STORAGE_KEY`). **I am not describing this as owner-approved.**

**Constitution item 6 (PII / minors):** confirmed. This task reads `user.id`, a
UUID, out of a session blob the SDK already persists in the same browser. It adds
no new PII to storage, logs, or fixtures; no value is logged. All test fixtures
use fabricated names and `@example.com` addresses (`fabricated.alice@example.com`,
`fabricated.bob@example.com`). The uid now appears in a localStorage *key* name,
but it is already present in the session blob in the same storage area, so this
exposes nothing new.

---

## 7. Files changed, and byte-unchanged confirmations

Exactly four files, matching Allowed Files:

- `src/lib/supabase/client.ts` — additive constant + third argument
- `src/lib/supabase/client.test.ts` — additive (mock + 4 tests)
- `src/app/ThemeModeProvider.tsx` — per-uid keying + module doc
- `src/app/ThemeModeProvider.test.tsx` — 4 tests reworked, 17 added
- `docs/swarm/active/T154-worker-output.md` — this file (create)

`git diff --name-only HEAD --` against every protected path returns **empty**,
confirming byte-unchanged: `src/app/guards.tsx`, `src/test-utils/authHarness.tsx`,
`src/App.tsx`, `src/App.test.tsx`, `src/pages/settings/SettingsPage.tsx`,
`SettingsPage.test.tsx`, `src/lib/supabase/auth.ts`, `auth.test.ts`,
`src/theme/**`, `src/main.tsx`, and all of `docs/swarm/**` except this output doc,
and `.claude/**`.

---

## 8. Command output

```
npx tsc --noEmit          → clean, no output
npx vite build            → ✓ built in 5.63s
npm run format:check      → All matched files use Prettier code style!
npx eslint .              → ✖ 355 problems (0 errors, 355 warnings)
npx vitest run            → Test Files 66 passed (66)
                            Tests 1536 passed (1536)
```

**eslint count reasoning, independently confirmed rather than only cited.** The
packet predicted warnings stay at 355 because `client.ts` exports no React
component, so `react-refresh/only-export-components` cannot fire on a new plain
constant. I confirmed that holds — and confirmed the *other* half the packet did
not mention, which is where the real risk was: `ThemeModeProvider.tsx` **does**
export a component, so any new non-component export there *would* have fired the
rule. Keeping all five storage helpers module-private is what holds the count at
355; exporting `themeModeStorageKeyFor` for the tests to import would have landed
on 356+. That is why the test file re-declares the key format locally instead of
importing it, and the duplication is deliberate: if the production format ever
changes without the tests changing, the cross-user tests stop finding their seeds
and fail loudly rather than silently passing.

Transient `"The current testing environment is not configured to support act(...)"`
stderr from `ThemeModeProvider.test.tsx` is **pre-existing harness noise, not
introduced here** — measured: 36 occurrences at the unmodified baseline with 11
tests. All tests pass regardless.

---

## 9. Stated plainly as unverified / residual risk

1. **No real-browser verification.** Every proof is jsdom + vitest. I did not run
   a real browser against a real Supabase project (none exists yet — External-
   Prerequisite Posture), so "the SDK writes the session under our key and the
   seed reads it back" is verified by reading installed SDK source and by
   simulating the blob shape, **not** by observing a live round trip. The
   inference chain is tight and each link is cited in §1, but it is an inference.
2. **The re-login is untested by definition.** I cannot observe a session
   orphaned under the old derived key, because no such session exists in this
   environment.
3. **`Storage.prototype.setItem` can still throw** (quota exceeded) inside the
   write-through. `getStorage()` guards only the property *access*, not the
   `setItem` call. This is unchanged T148 behavior which I deliberately did not
   alter, and any throw lands in the existing `.catch` and is logged. Noting it
   as a pre-existing MINOR, not something T154 introduced or fixed.
4. **`[CP2]` (the derivation drift detector) is intentionally absent**, per the
   packet: with nothing derived there is nothing to detect drift in.
5. **The packet's criterion-1 citation to `client.test.ts:1-19` is wrong** (§3).
   Flagging for the checker rather than silently substituting.
6. **T148's own criterion-5 test, and the shape this packet prescribed for it, do
   not actually prove the synchronous-first-commit property** (§4, mutation 3).
   I strengthened T154's version so it does. I did **not** retrofit the same
   hardening onto T148's separate "flash fix" test beyond re-keying it, since
   rewriting it further was outside the four-test authorization; a follow-up
   could apply `RecordingProbe` there too. Flagging so the gap is recorded rather
   than assumed closed.
7. **The in-page re-seed is proven in jsdom by driving `AuthProvider`'s
   `subscribeToAuthStateChange` seam, not by clicking through the real UI.** The
   harness reproduces the mechanism faithfully (same provider, same state
   transitions, no remount — asserted), but it does not exercise
   `SettingsPage`/`LoginPage` or the router. A genuine two-account click-through
   remains unverified.
8. **The login-screen residual is deliberate, not fixed** (§0a). Between sign-out
   and the next sign-in, A's theme remains on screen. Disclosed in the module doc
   and pinned by a test so it cannot change silently.
9. **The re-seed reads storage during render.** This is intentional and is what
   holds the synchronous property, but it means a render can touch
   `localStorage` on an account switch. Both reads are guarded by `safeGetItem`
   so a throwing `getItem` cannot escape into a white screen (mutation 6), and
   the read happens only on the render where the user id actually changed — not
   on every render.
10. **I did not re-audit the T155 packet or ledger content** merged in from
    `1c119ae`. The merge was docs-only and touched nothing this task owns, but I
    read only enough to confirm that.
