/**
 * T086 (ED-1 Packet P0): `invokeEdgeFunction`, the shared, typed calling
 * convention for the four deployed Edge Functions (`checkin`, `ics`,
 * `send-invite`, `send-reminders`). Verified against
 * `supabase/functions/send-invite/index.ts`'s own header comment describing
 * its "two-client architecture" (that file's lines 20-35): the deployed
 * function's `callerClient` is built from "the request's own `Authorization`
 * header (the caller's own JWT, forwarded by the frontend caller) plus the
 * *anon* key". `supabase-js` v2's `client.functions.invoke(name, { body })`
 * automatically attaches `Authorization: Bearer <current session access
 * token>` whenever a session exists (confirmed directly against
 * `@supabase/functions-js`'s own `FunctionsClient.invoke` doc comment: "we
 * automatically pass the Authorization header with the signed in user's
 * JWT") -- this is exactly the caller-JWT the deployed function's
 * `callerClient` expects. This file never reads a token from storage, never
 * passes one manually, and never references a service-role key anywhere
 * (constitution item 5, BLOCKER) -- grep-provable.
 *
 * Error mapping rethrows every failure mode as the same `SupabaseLoaderError`
 * shape `loader.ts` already exports (reused, not duplicated, here) so a
 * page's existing DES-16 error handling -- built against
 * `SupabaseLoaderError` -- works identically whether the rejection came from
 * a table query (`createLoader`/`runMutation`) or an Edge Function call
 * (`invokeEdgeFunction`):
 *
 *   - No active session: rejects immediately (before any network call, via
 *     `client.auth.getSession()`) with `code: 'UNAUTHENTICATED'`,
 *     `message: 'Sign in and try again.'` -- verified verbatim against
 *     `send-invite/index.ts` line 97's own copy for the same
 *     `!authHeader` case (consistency, not coincidence; also matches
 *     `checkin/index.ts` line 94's identical copy for the same case).
 *   - `FunctionsHttpError` (the Edge Function itself returned a non-2xx
 *     status): `error.context` is the raw `Response`; `await
 *     error.context.json()` is read to extract the deployed functions'
 *     stable failure shape (verified directly in `send-invite/index.ts`'s
 *     `errorResponse` helper, lines 70-72): `{ error: { code: string;
 *     message: string } }`, where `message` is already hand-authored DES-16
 *     copy (e.g. `ALREADY_INVITED` -> "This person already has an account.
 *     They can sign in directly instead of using an invite." -- verified
 *     verbatim against that same file's lines 213-217). That `{code,
 *     message}` pair is rethrown as-is. If the body is missing/unparsable/
 *     not in that shape (should not happen against any of the four deployed
 *     functions, all of which share this exact `errorResponse` shape, but
 *     defended against rather than assumed), falls back to
 *     `UNKNOWN_EDGE_FUNCTION_ERROR_MESSAGE` below.
 *   - `FunctionsFetchError` (network failure) or `FunctionsRelayError` (the
 *     Supabase Relay could not reach the function -- an infra-side failure
 *     with the same "nothing usable came back" shape as a network failure
 *     from this caller's point of view, so mapped identically): fixed
 *     `code: 'NETWORK'` with fixed, hand-authored DES-16 copy, consistent in
 *     tone with `loader.ts`'s own `DEFAULT_LOADER_ERROR_MESSAGE`.
 *   - Any other thrown value (defensive catch-all; should not happen per
 *     `@supabase/functions-js`'s documented error classes): `code: 'UNKNOWN'`
 *     with the same fallback copy as an unparsable `FunctionsHttpError` body.
 *
 * Same T086 "no-crash-when-unconfigured" posture as `loader.ts`'s
 * `createLoader`/`runMutation` fix: `getClient()` is called inside a `try`
 * so a thrown `SupabaseNotConfiguredError` (no `.env` file) also becomes a
 * `SupabaseLoaderError` instead of propagating raw.
 */
import {
  FunctionsFetchError,
  FunctionsHttpError,
  FunctionsRelayError,
  type SupabaseClient,
} from '@supabase/supabase-js';
import { getSupabaseClient, SupabaseNotConfiguredError } from './client';
import type { SupabaseLoaderError } from './loader';

/**
 * Fixed DES-16 copy for a network/infra failure (no response came back at
 * all) -- consistent in tone with `loader.ts`'s
 * `DEFAULT_LOADER_ERROR_MESSAGE` ("Couldn't load this data. Check your
 * connection and try again."), reworded for an action rather than a load.
 */
const NETWORK_ERROR_MESSAGE = "Couldn't reach the server. Check your connection and try again.";

/**
 * Fixed DES-16 copy for the defensive fallback case: an Edge Function
 * returned a non-2xx status but its body was missing/unparsable/not in the
 * `{ error: { code, message } }` shape every one of the four deployed
 * functions actually uses. Should not happen in practice (see module doc)
 * but this file never leaks the unparsable raw body to a user.
 */
const UNKNOWN_EDGE_FUNCTION_ERROR_MESSAGE =
  "Couldn't complete this action. Check your connection and try again.";

/** Verified verbatim against `send-invite/index.ts` line 97 and
 * `checkin/index.ts` line 94's shared copy for the "no session" case. */
const UNAUTHENTICATED_MESSAGE = 'Sign in and try again.';

/**
 * The stable failure shape every deployed Edge Function's `errorResponse`
 * helper produces -- verified directly against `send-invite/index.ts`'s own
 * `errorResponse` (lines 70-72): `{ error: { code, message } }`.
 */
interface EdgeFunctionErrorBody {
  error: { code: string; message: string };
}

function isEdgeFunctionErrorBody(value: unknown): value is EdgeFunctionErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) {
    return false;
  }
  const inner = (value as { error?: unknown }).error;
  return (
    typeof inner === 'object' &&
    inner !== null &&
    typeof (inner as { code?: unknown }).code === 'string' &&
    typeof (inner as { message?: unknown }).message === 'string'
  );
}

/**
 * Reads and parses `FunctionsHttpError.context` (the raw `Response`) per
 * the SDK's own documented pattern (`await error.context.json()`). Returns
 * `null` -- never throws -- when the body is missing/unparsable/not in the
 * expected shape, so the caller can fall back to
 * `UNKNOWN_EDGE_FUNCTION_ERROR_MESSAGE` rather than leaking a parse error.
 */
async function tryParseEdgeFunctionErrorBody(
  httpError: FunctionsHttpError,
): Promise<{ code: string; message: string } | null> {
  try {
    const body: unknown = await httpError.context.json();
    if (isEdgeFunctionErrorBody(body)) {
      return body.error;
    }
  } catch {
    // Body wasn't parsable JSON in the expected shape -- fall through.
  }
  return null;
}

async function toEdgeFunctionError(raw: unknown): Promise<SupabaseLoaderError> {
  if (raw instanceof FunctionsHttpError) {
    const parsed = await tryParseEdgeFunctionErrorBody(raw);
    if (parsed) {
      return { code: parsed.code, message: parsed.message, cause: raw };
    }
    return { code: 'UNKNOWN', message: UNKNOWN_EDGE_FUNCTION_ERROR_MESSAGE, cause: raw };
  }
  if (raw instanceof FunctionsFetchError || raw instanceof FunctionsRelayError) {
    return { code: 'NETWORK', message: NETWORK_ERROR_MESSAGE, cause: raw };
  }
  if (raw instanceof SupabaseNotConfiguredError) {
    return { code: 'UNKNOWN', message: raw.message, cause: raw };
  }
  return { code: 'UNKNOWN', message: UNKNOWN_EDGE_FUNCTION_ERROR_MESSAGE, cause: raw };
}

function unauthenticatedError(): SupabaseLoaderError {
  return { code: 'UNAUTHENTICATED', message: UNAUTHENTICATED_MESSAGE, cause: null };
}

/**
 * Calls a deployed Edge Function by name (`'checkin' | 'ics' | 'send-invite'
 * | 'send-reminders'`, though this helper accepts any `string` -- it does
 * not hardcode the four deployed names, since page-specific wiring tasks own
 * which one they call) with a JSON-serializable `body`, returning the typed
 * response on success or rejecting with a `SupabaseLoaderError` on any
 * failure (see module doc for the full error-mapping table).
 *
 * `getClient` defaults to the shared singleton but is injectable so tests
 * can supply a stubbed transport with zero real network calls, same
 * convention as `loader.ts`'s `createLoader`/`runMutation`.
 */
export async function invokeEdgeFunction<TResponse>(
  name: string,
  body: unknown,
  getClient: () => SupabaseClient = getSupabaseClient,
): Promise<TResponse> {
  let client: SupabaseClient;
  try {
    client = getClient();
  } catch (configError) {
    throw await toEdgeFunctionError(configError);
  }

  const { data: sessionData, error: sessionError } = await client.auth.getSession();
  if (sessionError) {
    throw await toEdgeFunctionError(sessionError);
  }
  if (!sessionData.session) {
    throw unauthenticatedError();
  }

  let invokeResult: { data: TResponse | null; error: unknown };
  try {
    invokeResult = await client.functions.invoke<TResponse>(name, {
      // `body` is `unknown` here since this helper is intentionally generic
      // over any JSON-serializable payload (matching every one of the four
      // deployed functions' own request bodies, which vary per function).
      // The SDK's own `FunctionInvokeOptions.body` type only lists concrete
      // payload types; per `@supabase/functions-js`'s own doc comment, its
      // runtime JSON-serializes anything that isn't one of those
      // binary/string types, which covers every value this helper's callers
      // actually pass -- this cast documents that, it does not change
      // runtime behavior.
      body: body as Record<string, unknown>,
    });
  } catch (transportError) {
    throw await toEdgeFunctionError(transportError);
  }
  if (invokeResult.error) {
    throw await toEdgeFunctionError(invokeResult.error);
  }
  return invokeResult.data as TResponse;
}
