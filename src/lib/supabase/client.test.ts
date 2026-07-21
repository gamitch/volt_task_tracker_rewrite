// T071: unconfigured-mode + singleton behavior for `client.ts`. Uses
// `vi.stubEnv`/`vi.unstubAllEnvs` to control `import.meta.env` per test --
// no real network calls anywhere in this file (constructing a real client
// with well-formed-but-fake credentials performs no network I/O by itself;
// this file never does that regardless, to keep the "no real network calls
// in tests" guarantee unambiguous).
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SupabaseNotConfiguredError,
  getSupabaseClient,
  isSupabaseConfigured,
  resetSupabaseClientForTests,
} from './client.ts';

describe('client (T071 singleton + fail-loud unconfigured mode)', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    resetSupabaseClientForTests();
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
