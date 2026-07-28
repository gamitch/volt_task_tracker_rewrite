// T086: `invokeEdgeFunction` unit tests against a STUBBED transport -- no
// real `getSupabaseClient()`/network call anywhere in this file. Every test
// supplies its own fake `getClient` returning a stubbed `SupabaseClient`-like
// object (`auth.getSession` + `functions.invoke` only -- `invokeEdgeFunction`
// never touches anything else on the client).
import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
} from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { SupabaseNotConfiguredError } from './client.ts';
import { invokeEdgeFunction } from './functions.ts';
import { isSupabaseLoaderError } from './loader.ts';

const ACTIVE_SESSION = { access_token: 'fake-token' };

function makeFakeClient(overrides: {
  getSession?: () => Promise<{ data: { session: unknown }; error: unknown }>;
  invoke?: (name: string, options: { body: unknown }) => Promise<{ data: unknown; error: unknown }>;
}): SupabaseClient {
  return {
    auth: {
      getSession:
        overrides.getSession ??
        (() => Promise.resolve({ data: { session: ACTIVE_SESSION }, error: null })),
    },
    functions: {
      invoke: overrides.invoke ?? vi.fn().mockResolvedValue({ data: null, error: null }),
    },
  } as unknown as SupabaseClient;
}

/** Minimal fake `Response`-shaped object satisfying `FunctionsHttpError.context.json()`. */
function fakeJsonResponse(body: unknown): { json: () => Promise<unknown> } {
  return { json: () => Promise.resolve(body) };
}

describe('invokeEdgeFunction (T086 Edge Function calling seam)', () => {
  it('resolves the typed response on success and passes body through to client.functions.invoke', async () => {
    const invoke = vi.fn().mockResolvedValue({ data: { ok: true }, error: null });
    const client = makeFakeClient({ invoke });

    const result = await invokeEdgeFunction<{ ok: boolean }>(
      'send-invite',
      { email: 'a@example.com' },
      () => client,
    );

    expect(result).toEqual({ ok: true });
    expect(invoke).toHaveBeenCalledWith('send-invite', { body: { email: 'a@example.com' } });
  });

  it('rejects with code UNAUTHENTICATED and "Sign in and try again." when there is no active session, without ever calling functions.invoke', async () => {
    const invoke = vi.fn();
    const client = makeFakeClient({
      getSession: () => Promise.resolve({ data: { session: null }, error: null }),
      invoke,
    });

    await expect(invokeEdgeFunction('send-invite', {}, () => client)).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
      message: 'Sign in and try again.',
    });
    expect(invoke).not.toHaveBeenCalled();
  });

  it('rejects with the deployed functions own {code, message} on a FunctionsHttpError, extracted via error.context.json()', async () => {
    // Verified verbatim against supabase/functions/send-invite/index.ts lines
    // 213-217 (the ALREADY_INVITED case).
    const httpError = new FunctionsHttpError(
      fakeJsonResponse({
        error: {
          code: 'ALREADY_INVITED',
          message:
            'This person already has an account. They can sign in directly instead of using an invite.',
        },
      }),
    );
    const invoke = vi.fn().mockResolvedValue({ data: null, error: httpError });
    const client = makeFakeClient({ invoke });

    await expect(invokeEdgeFunction('send-invite', {}, () => client)).rejects.toMatchObject({
      code: 'ALREADY_INVITED',
      message:
        'This person already has an account. They can sign in directly instead of using an invite.',
      cause: httpError,
    });
  });

  it('rejects with a fixed UNKNOWN fallback when a FunctionsHttpError body is unparsable/not in the expected shape', async () => {
    const httpError = new FunctionsHttpError(fakeJsonResponse({ not: 'the expected shape' }));
    const invoke = vi.fn().mockResolvedValue({ data: null, error: httpError });
    const client = makeFakeClient({ invoke });

    await expect(invokeEdgeFunction('send-invite', {}, () => client)).rejects.toMatchObject({
      code: 'UNKNOWN',
      message: expect.any(String),
      cause: httpError,
    });
  });

  it('rejects with a fixed code NETWORK and DES-16 copy on a FunctionsFetchError (network failure)', async () => {
    const fetchError = new FunctionsFetchError({ requestId: 'abc123' });
    const invoke = vi.fn().mockResolvedValue({ data: null, error: fetchError });
    const client = makeFakeClient({ invoke });

    await expect(invokeEdgeFunction('checkin', {}, () => client)).rejects.toMatchObject({
      code: 'NETWORK',
      message: expect.any(String),
      cause: fetchError,
    });
  });

  it('rejects with a fixed code NETWORK on a FunctionsRelayError (relay could not reach the function)', async () => {
    const relayError = new FunctionsRelayError({ region: 'us-east-1' });
    const invoke = vi.fn().mockResolvedValue({ data: null, error: relayError });
    const client = makeFakeClient({ invoke });

    await expect(invokeEdgeFunction('send-reminders', {}, () => client)).rejects.toMatchObject({
      code: 'NETWORK',
      message: expect.any(String),
      cause: relayError,
    });
  });

  it('rejects with a typed SupabaseLoaderError (not a raw thrown error) when client.functions.invoke itself throws', async () => {
    const invoke = vi.fn().mockRejectedValue(new TypeError('boom'));
    const client = makeFakeClient({ invoke });

    try {
      await invokeEdgeFunction('ics', {}, () => client);
      expect.unreachable('invokeEdgeFunction() should have rejected');
    } catch (error) {
      expect(isSupabaseLoaderError(error)).toBe(true);
    }
  });

  // T086 "no-crash-when-unconfigured" posture, same fix as loader.ts's
  // createLoader/runMutation applied to this file's getClient() call.
  it('rejects with a SupabaseLoaderError (not a raw thrown error) when getClient() throws SupabaseNotConfiguredError', async () => {
    const notConfiguredError = new SupabaseNotConfiguredError();
    const getClient = vi.fn((): SupabaseClient => {
      throw notConfiguredError;
    });

    await expect(invokeEdgeFunction('checkin', {}, getClient)).rejects.toMatchObject({
      message: notConfiguredError.message,
      cause: notConfiguredError,
    });
  });
});
