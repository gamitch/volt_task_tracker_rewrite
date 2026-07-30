/**
 * T071: the single shared Supabase client singleton for all of `src/`.
 *
 * Exactly one invocation of the SDK's `createClient` factory exists in this
 * whole file (and therefore in all of `src/`) -- see the
 * `cachedClient = ` assignment inside `getSupabaseClient` below, and this
 * task's worker output for the grep-verifiable proof. Reads only the two
 * env var names T015 already committed to `.env.example`:
 * `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. Anon (public) key only --
 * this module never references a service-role key as a capability
 * anywhere (constitution item 5, BLOCKER); a real service-role key must
 * never ship in the frontend bundle.
 *
 * Lazy initialization: importing this module never throws, even with no
 * `.env` file present at all -- every developer without real Supabase
 * credentials must still be able to run `npm run dev` / `npm run build` /
 * `npm run test` without the app dying at import time (External-Prerequisite
 * Posture, worker packet: George's real Supabase project does not exist
 * yet). Only calling `getSupabaseClient()` while unconfigured throws --
 * fail loud, never fail silent-with-fake-data. This module never fabricates
 * a placeholder URL/key that could be mistaken for a real one.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Thrown by `getSupabaseClient()` when either env var is blank/absent.
 * Never thrown merely by importing this module -- see module doc above.
 */
export class SupabaseNotConfiguredError extends Error {
  constructor() {
    // DES-16 style: states what happened and what to do next.
    super(
      "Supabase isn't configured yet. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY " +
        'in your .env file (copy .env.example) and restart the dev server.',
    );
    this.name = 'SupabaseNotConfiguredError';
  }
}

/**
 * The `localStorage` key this app uses to persist the Supabase session,
 * passed explicitly to `createClient` below via `auth.storageKey` (a public,
 * typed SDK option -- `@supabase/supabase-js/dist/index.d.mts:162`). Owned by
 * this app, NOT derived from `supabase-js`'s own internal default
 * (`` `sb-${baseUrl.hostname.split('.')[0]}-auth-token` ``, `index.mjs:680` --
 * undocumented, free to change on an SDK upgrade with no deprecation notice).
 *
 * T154 rejected deriving that format, and the reason is worth keeping here:
 * `ThemeModeProvider.tsx` reads `user.id` out of the session blob stored under
 * this key to scope its theme seed per user. If a future SDK version changed
 * the derivation and left an OLD-format key orphaned in some browser still
 * holding whatever session was last persisted there, a derived lookup would
 * read the WRONG (stale) user's id and seed the current visitor with a
 * stranger's theme -- the mechanism meant to fix the shared-browser bleed
 * would instead cause it. That is fail-dangerous. Owning the key removes the
 * branch entirely: there is no formula to drift.
 *
 * Changing this value orphans any session already persisted under the old
 * derived key, forcing one re-login in that browser. That cost is currently
 * zero -- there is no production deployment (MIG-04 cutover and Vercel
 * go-live are both still blocked human gates), so the affected population is
 * developer/test browsers.
 */
export const SUPABASE_AUTH_STORAGE_KEY = 'volt.supabaseAuthToken';

function readEnv(): { url: string; anonKey: string } {
  const env = import.meta.env;
  const rawUrl: unknown = env.VITE_SUPABASE_URL;
  const rawAnonKey: unknown = env.VITE_SUPABASE_ANON_KEY;
  return {
    url: typeof rawUrl === 'string' ? rawUrl.trim() : '',
    anonKey: typeof rawAnonKey === 'string' ? rawAnonKey.trim() : '',
  };
}

/**
 * True only when both T015 env vars are present and non-blank. Never
 * inspects/returns their values -- callers that need to know "is this app
 * usable yet" should call this instead of reading `import.meta.env`
 * themselves.
 */
export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = readEnv();
  return url.length > 0 && anonKey.length > 0;
}

let cachedClient: SupabaseClient | null = null;

/**
 * Returns the single shared client, constructing it (the one
 * `createClient` call site) on first call -- lazy, see module doc. Throws
 * `SupabaseNotConfiguredError` when either env var is blank/absent. Callers
 * must not catch this and fall back to fake data (External-Prerequisite
 * Posture) -- let it propagate to whatever loading/error UI state the
 * caller already has, same as any other rejected/thrown loader error.
 */
export function getSupabaseClient(): SupabaseClient {
  if (cachedClient) {
    return cachedClient;
  }
  if (!isSupabaseConfigured()) {
    throw new SupabaseNotConfiguredError();
  }
  const { url, anonKey } = readEnv();
  // `auth.storageKey` is the ONLY auth option this app sets; every other
  // (`persistSession`, `autoRefreshToken`, `detectSessionInUrl`, `flowType`)
  // keeps its SDK default, because `applySettingDefaults` spreads the
  // caller's `auth` object OVER `DEFAULT_AUTH_OPTIONS` rather than replacing
  // it (`index.mjs:408`). `persistSession` therefore remains `true`
  // (`index.mjs:37`), which is what makes the session blob readable from
  // `localStorage` at all.
  cachedClient = createClient(url, anonKey, {
    auth: { storageKey: SUPABASE_AUTH_STORAGE_KEY },
  });
  return cachedClient;
}

/**
 * Test-only escape hatch: clears the cached singleton so tests can exercise
 * `getSupabaseClient()` / `isSupabaseConfigured()` against different
 * `import.meta.env` values (via `vi.stubEnv`) without leaking a client
 * instance across test cases. Production callers never need this -- the
 * singleton is meant to live for the lifetime of the page.
 */
export function resetSupabaseClientForTests(): void {
  cachedClient = null;
}
