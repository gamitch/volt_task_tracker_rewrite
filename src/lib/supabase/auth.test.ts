// T071: auth surface unit tests against a STUBBED transport -- no real
// `getSupabaseClient()`/network call anywhere in this file. Every test
// constructs its own fake `client` object and passes it explicitly.
import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getInitialSession,
  resolveRole,
  signInWithGoogle,
  signInWithPassword,
  signOut,
  subscribeToAuthStateChange,
} from './auth.ts';
import { isSupabaseLoaderError } from './loader.ts';

function buildFakeAuth(overrides: Record<string, unknown> = {}) {
  return {
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    onAuthStateChange: vi
      .fn()
      .mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    signInWithPassword: vi
      .fn()
      .mockResolvedValue({ data: { session: null, user: null }, error: null }),
    signInWithOAuth: vi
      .fn()
      .mockResolvedValue({ data: { provider: 'google', url: null }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
}

const FAKE_SESSION = {
  access_token: 'fake-access-token',
  refresh_token: 'fake-refresh-token',
  expires_in: 3600,
  token_type: 'bearer',
  user: { id: 'user-1', email: 'fabricated.user@example.com' },
} as const;

describe('getInitialSession', () => {
  it('resolves the session from client.auth.getSession()', async () => {
    const auth = buildFakeAuth({
      getSession: vi.fn().mockResolvedValue({ data: { session: FAKE_SESSION }, error: null }),
    });
    const client = { auth } as unknown as SupabaseClient;

    const session = await getInitialSession(client);

    expect(session).toEqual(FAKE_SESSION);
  });

  it('resolves null when there is no session', async () => {
    const client = { auth: buildFakeAuth() } as unknown as SupabaseClient;

    const session = await getInitialSession(client);

    expect(session).toBeNull();
  });

  it('rejects when the transport reports an error', async () => {
    const authError = { message: 'network error', name: 'AuthError', status: 0 };
    const auth = buildFakeAuth({
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: authError }),
    });
    const client = { auth } as unknown as SupabaseClient;

    await expect(getInitialSession(client)).rejects.toEqual(authError);
  });
});

describe('subscribeToAuthStateChange', () => {
  it('registers the callback and returns a working unsubscribe function', () => {
    const unsubscribe = vi.fn();
    const auth = buildFakeAuth({
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe } } }),
    });
    const client = { auth } as unknown as SupabaseClient;
    const callback = vi.fn();

    const stop = subscribeToAuthStateChange(callback, client);
    expect(auth.onAuthStateChange).toHaveBeenCalledWith(callback);
    expect(unsubscribe).not.toHaveBeenCalled();

    stop();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe('signInWithPassword', () => {
  it('resolves the session on success', async () => {
    const auth = buildFakeAuth({
      signInWithPassword: vi.fn().mockResolvedValue({
        data: { session: FAKE_SESSION, user: FAKE_SESSION.user },
        error: null,
      }),
    });
    const client = { auth } as unknown as SupabaseClient;

    const session = await signInWithPassword('fabricated.user@example.com', 'hunter2', client);

    expect(session).toEqual(FAKE_SESSION);
    expect(auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'fabricated.user@example.com',
      password: 'hunter2',
    });
  });

  it('rejects when the transport reports an error', async () => {
    const authError = { message: 'invalid credentials', name: 'AuthError', status: 400 };
    const auth = buildFakeAuth({
      signInWithPassword: vi
        .fn()
        .mockResolvedValue({ data: { session: null, user: null }, error: authError }),
    });
    const client = { auth } as unknown as SupabaseClient;

    await expect(signInWithPassword('a@example.com', 'wrong', client)).rejects.toEqual(authError);
  });
});

describe('signInWithGoogle', () => {
  it('calls signInWithOAuth with provider "google" and the caller-supplied redirectTo', async () => {
    const auth = buildFakeAuth();
    const client = { auth } as unknown as SupabaseClient;

    await signInWithGoogle('https://portal.voltfrc.org/auth/callback', client);

    expect(auth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'google',
      options: { redirectTo: 'https://portal.voltfrc.org/auth/callback' },
    });
  });

  it('rejects when the transport reports an error', async () => {
    const authError = { message: 'oauth misconfigured', name: 'AuthError', status: 500 };
    const auth = buildFakeAuth({
      signInWithOAuth: vi.fn().mockResolvedValue({ data: null, error: authError }),
    });
    const client = { auth } as unknown as SupabaseClient;

    await expect(
      signInWithGoogle('https://portal.voltfrc.org/auth/callback', client),
    ).rejects.toEqual(authError);
  });
});

describe('signOut', () => {
  it('resolves (clears state) on success', async () => {
    const auth = buildFakeAuth();
    const client = { auth } as unknown as SupabaseClient;

    await expect(signOut(client)).resolves.toBeUndefined();
    expect(auth.signOut).toHaveBeenCalledTimes(1);
  });

  it('rejects when the transport reports an error', async () => {
    const authError = { message: 'sign-out failed', name: 'AuthError', status: 500 };
    const auth = buildFakeAuth({ signOut: vi.fn().mockResolvedValue({ error: authError }) });
    const client = { auth } as unknown as SupabaseClient;

    await expect(signOut(client)).rejects.toEqual(authError);
  });
});

// resolveRole exercises the `client.from('profiles').select('role').eq(...).maybeSingle()`
// chain -- stub only that chain, never a real client.
function buildFakeProfilesClient(maybeSingleResult: {
  data: unknown;
  error: unknown;
}): SupabaseClient {
  const overrideTypes = vi.fn().mockResolvedValue(maybeSingleResult);
  const maybeSingle = vi.fn().mockReturnValue({ overrideTypes });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { from } as unknown as SupabaseClient;
}

describe('resolveRole (AUTH-04 no-access path)', () => {
  it('returns { status: "found", role } for a present profiles row', async () => {
    const client = buildFakeProfilesClient({ data: { role: 'coach' }, error: null });

    const result = await resolveRole('user-1', client);

    expect(result).toEqual({ status: 'found', role: 'coach' });
  });

  it('returns the distinct { status: "no-profile" } result for a missing profiles row (AUTH-04) -- not an exception', async () => {
    const client = buildFakeProfilesClient({ data: null, error: null });

    const result = await resolveRole('user-with-no-profile', client);

    expect(result).toEqual({ status: 'no-profile' });
  });

  it('rejects with a DES-16-compatible SupabaseLoaderError for a genuine query error (never coerced into "no-profile")', async () => {
    const client = buildFakeProfilesClient({
      data: null,
      error: { message: 'permission denied for table profiles', code: '42501' },
    });

    try {
      await resolveRole('user-1', client);
      expect.unreachable('resolveRole() should have rejected');
    } catch (error) {
      expect(isSupabaseLoaderError(error)).toBe(true);
      expect(error).toMatchObject({ code: '42501' });
    }
  });
});
