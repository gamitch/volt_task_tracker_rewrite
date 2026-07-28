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
  cachedClient = createClient(url, anonKey);
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
