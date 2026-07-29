// T071: unconfigured-mode + singleton behavior for `client.ts`. Uses
// `vi.stubEnv`/`vi.unstubAllEnvs` to control `import.meta.env` per test --
// no real network calls anywhere in this file (constructing a real client
// with well-formed-but-fake credentials performs no network I/O by itself;
// this file never does that regardless, to keep the "no real network calls
// in tests" guarantee unambiguous).
//
// T154 addition: the `auth.storageKey` assertions below use
// `vi.mock('@supabase/supabase-js')` to capture `createClient`'s third
// argument, NOT a property readback off a constructed client. Two reasons,
// both verified rather than assumed: (1) `storageKey` is declared
// `protected storageKey: string` on the client class
// (`@supabase/supabase-js/dist/index.d.mts:433`), so reading it back from
// outside the class does not compile under this project's `tsc --noEmit`
// gate; (2) mocking keeps this file's stated "never construct a real client"
// guarantee above intact. Mocking is behaviorally inert for every pre-T154
// test in this file: all of them either never reach `createClient`, or throw
// `SupabaseNotConfiguredError` at the configured-check before line 79.
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SUPABASE_AUTH_STORAGE_KEY,
  SupabaseNotConfiguredError,
  getSupabaseClient,
  isSupabaseConfigured,
  resetSupabaseClientForTests,
} from './client.ts';

// The signature is supplied as a generic rather than as named parameters: with
// a zero-arg factory `mock.calls` infers as the empty tuple `[]` and indexing
// `[2]` is a compile error (TS2493), while naming unused params trips
// `@typescript-eslint/no-unused-vars` (this config does not exempt a leading
// underscore).
const createClientMock = vi.hoisted(() =>
  vi.fn<(url: string, anonKey: string, options?: { auth?: { storageKey?: string } }) => unknown>(
    () => ({ mock: 'client' }),
  ),
);

vi.mock('@supabase/supabase-js', () => ({
  createClient: createClientMock,
}));

describe('client (T071 singleton + fail-loud unconfigured mode)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetSupabaseClientForTests();
    createClientMock.mockClear();
  });

  it('importing this module does not throw (proven implicitly: this file itself imports it at the top, and every test below runs)', () => {
    expect(typeof getSupabaseClient).toBe('function');
  });

  it('isSupabaseConfigured() is false when both env vars are blank', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    expect(isSupabaseConfigured()).toBe(false);
  });

  it('isSupabaseConfigured() is false when both env vars are absent (undefined)', () => {
    vi.stubEnv('VITE_SUPABASE_URL', undefined);
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', undefined);
    expect(isSupabaseConfigured()).toBe(false);
  });

  it('isSupabaseConfigured() is false when only the URL is set', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    expect(isSupabaseConfigured()).toBe(false);
  });

  it('isSupabaseConfigured() is false when only the anon key is set', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'fake-anon-key');
    expect(isSupabaseConfigured()).toBe(false);
  });

  it('isSupabaseConfigured() is false when both are whitespace-only', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '   ');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '   ');
    expect(isSupabaseConfigured()).toBe(false);
  });

  it('isSupabaseConfigured() is true when both env vars are non-blank', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'fake-anon-key');
    expect(isSupabaseConfigured()).toBe(true);
  });

  it('getSupabaseClient() throws SupabaseNotConfiguredError when both env vars are blank', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    expect(() => getSupabaseClient()).toThrow(SupabaseNotConfiguredError);
  });

  it('getSupabaseClient() throws SupabaseNotConfiguredError when only one env var is set', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    expect(() => getSupabaseClient()).toThrow(SupabaseNotConfiguredError);
  });

  it('SupabaseNotConfiguredError carries a DES-16-style message (what happened + what to do)', () => {
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
    try {
      getSupabaseClient();
      expect.unreachable('getSupabaseClient() should have thrown');
    } catch (error) {
      expect(error).toBeInstanceOf(SupabaseNotConfiguredError);
      expect((error as Error).message).toContain('VITE_SUPABASE_URL');
      expect((error as Error).message).toContain('VITE_SUPABASE_ANON_KEY');
    }
  });
});

describe('client (T154 app-owned auth storage key)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetSupabaseClientForTests();
    createClientMock.mockClear();
  });

  it('SUPABASE_AUTH_STORAGE_KEY is the app-owned literal, not derived from the SDK/URL', () => {
    // Pinned as a literal on purpose: the value must NOT vary with
    // VITE_SUPABASE_URL, which is what "owned, not derived" means.
    expect(SUPABASE_AUTH_STORAGE_KEY).toBe('volt.supabaseAuthToken');
  });

  it('the one createClient call site passes SUPABASE_AUTH_STORAGE_KEY via auth.storageKey', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'fake-anon-key');

    getSupabaseClient();

    expect(createClientMock).toHaveBeenCalledTimes(1);
    const [url, anonKey, options] = createClientMock.mock.calls[0];
    expect(url).toBe('https://example.supabase.co');
    expect(anonKey).toBe('fake-anon-key');
    expect(options?.auth?.storageKey).toBe(SUPABASE_AUTH_STORAGE_KEY);
  });

  it('sets ONLY auth.storageKey, leaving persistSession and the other auth defaults untouched', () => {
    // Guards the mechanism T154 depends on: `applySettingDefaults` spreads the
    // caller's `auth` object OVER `DEFAULT_AUTH_OPTIONS` (index.mjs:408), so
    // passing a lone `storageKey` must not shadow `persistSession: true`
    // (index.mjs:37). If this call site ever starts passing `persistSession`
    // or `storage` explicitly, that reasoning needs re-checking.
    vi.stubEnv('VITE_SUPABASE_URL', 'https://example.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'fake-anon-key');

    getSupabaseClient();

    const options = createClientMock.mock.calls[0][2];
    expect(Object.keys(options?.auth ?? {})).toEqual(['storageKey']);
  });

  it('the storage key does not change when VITE_SUPABASE_URL changes (the anti-derivation property)', () => {
    vi.stubEnv('VITE_SUPABASE_URL', 'https://completely-different.supabase.co');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'fake-anon-key');

    getSupabaseClient();

    const options = createClientMock.mock.calls[0][2];
    expect(options?.auth?.storageKey).toBe('volt.supabaseAuthToken');
  });
});
