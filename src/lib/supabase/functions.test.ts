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
import { FUNCTION_NOT_DEPLOYED_CODE, invokeEdgeFunction } from './functions.ts';
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

/** Minimal fake `Response`-shaped object satisfying `FunctionsHttpError.context.json()`.
 * `status` is optional -- most existing tests below don't need it (their
 * fallback branch is reached regardless of status), but the GAM-388 404
 * tests do, since `FunctionsHttpError.context` is `Response`-shaped at
 * runtime and carries a real `status`. */
function fakeJsonResponse(
  body: unknown,
  status?: number,
): { json: () => Promise<unknown>; status?: number } {
  return { json: () => Promise.resolve(body), status };
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

  // GAM-388 acceptance criterion 1: a flat, unparsable 404 body -- the shape
  // the Supabase gateway itself returns for a function that does not exist
  // on the project -- is distinguished from the generic UNKNOWN fallback.
  it('rejects with code FUNCTION_NOT_DEPLOYED when a FunctionsHttpError is a 404 with a flat, unparsable gateway body', async () => {
    const httpError = new FunctionsHttpError(
      fakeJsonResponse({ code: 'NOT_FOUND', message: 'Requested function was not found' }, 404),
    );
    const invoke = vi.fn().mockResolvedValue({ data: null, error: httpError });
    const client = makeFakeClient({ invoke });

    await expect(invokeEdgeFunction('checkin-token', {}, () => client)).rejects.toMatchObject({
      code: FUNCTION_NOT_DEPLOYED_CODE,
      message: expect.any(String),
      cause: httpError,
    });
  });

  // GAM-388 acceptance criterion 2 (the trap): `checkin-token/index.ts:424`
  // itself returns a 404 for SESSION_NOT_FOUND -- but that body DOES parse
  // into the deployed functions' `{ error: { code, message } }` shape, so it
  // must take the `if (parsed)` branch above, never the new 404 narrowing.
  // A change that passes criterion 1 and fails this one is worse than no
  // change (packet's own words).
  it("still rejects with code SESSION_NOT_FOUND (not FUNCTION_NOT_DEPLOYED) for a 404 whose body IS the deployed function's own parseable error shape", async () => {
    const httpError = new FunctionsHttpError(
      fakeJsonResponse(
        {
          error: {
            code: 'SESSION_NOT_FOUND',
            message: "That session couldn't be found. Refresh and try again.",
          },
        },
        404,
      ),
    );
    const invoke = vi.fn().mockResolvedValue({ data: null, error: httpError });
    const client = makeFakeClient({ invoke });

    await expect(invokeEdgeFunction('checkin-token', {}, () => client)).rejects.toMatchObject({
      code: 'SESSION_NOT_FOUND',
      message: "That session couldn't be found. Refresh and try again.",
      cause: httpError,
    });
  });

  // GAM-388 acceptance criterion 3: an unparsable NON-404 status (e.g. 500)
  // still yields the generic UNKNOWN fallback, untouched by the new 404
  // narrowing.
  it('still rejects with code UNKNOWN for an unparsable, non-404 FunctionsHttpError body (e.g. a 500)', async () => {
    const httpError = new FunctionsHttpError(fakeJsonResponse({ not: 'the expected shape' }, 500));
    const invoke = vi.fn().mockResolvedValue({ data: null, error: httpError });
    const client = makeFakeClient({ invoke });

    await expect(invokeEdgeFunction('checkin-token', {}, () => client)).rejects.toMatchObject({
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
