/**
 * T071: generic, typed loader seam -- the shared building block matching the
 * `(args) => Promise<Data | null>` pattern independently arrived at by every
 * one of the six pages this task closes the gap for: T018's
 * `LoadInviteFn` (`src/pages/accept-invite/types.ts`), T020's
 * `LoadNoAccessDataFn` (`src/pages/no-access/types.ts`), T056's
 * `LoadParticipationDataFn` (`src/pages/reports/ParticipationTab.tsx`), and
 * their siblings in T021/T034/T035 -- each of those modules' own doc
 * comments independently flag "no shared Supabase client exists anywhere in
 * `src/` yet" as the reason their own `loadData` prop defaults to fixture
 * data instead of a real query. This file does not wire into any of those
 * pages (forbidden -- see the worker packet); it only provides the shared
 * building block a future per-page wiring task would use.
 *
 * `createLoader` wraps a caller-supplied query function against the shared
 * client with normalized error semantics:
 *   - transport/query errors REJECT with a typed `SupabaseLoaderError`
 *     carrying DES-16-compatible fields (`code` + a fixed "what happened +
 *     what to do" `message`, no apologies -- see
 *     `DEFAULT_LOADER_ERROR_MESSAGE` below for why the message is a fixed
 *     string rather than the raw Postgrest/network error text).
 *   - "no rows" (the caller's query resolving `{ data: null, error: null }`,
 *     e.g. via `.maybeSingle()`) resolves `null`.
 *   - success resolves the typed data.
 *
 * There is NO catch-and-return-fake-data path anywhere in this file: every
 * failure mode above either rejects (`toLoaderError`, both call sites below)
 * or resolves `null` (bare `result.data ?? null`) -- grep-provable, this
 * file contains no fixture/placeholder literal of any kind. Honest fixtures
 * belong in each PAGE's own `loadData` default (T018/T020/T056 etc.), never
 * in this shared data layer (External-Prerequisite Posture, worker packet).
 *
 * T086 bug fix: `getClient()` (both here and in `runMutation` below) is
 * called INSIDE the `try` block, not before it. Previously `createLoader`
 * called `getClient()` before the `try`, so a thrown `SupabaseNotConfiguredError`
 * (from `getSupabaseClient()`, `client.ts`) propagated raw/unwrapped instead
 * of becoming a `SupabaseLoaderError` -- a dev with no `.env` file would see
 * a raw thrown error/crash instead of every wired page's normal DES-12 error
 * state. `SupabaseNotConfiguredError.message` is already good DES-16 copy
 * (see `client.ts`), so it is reused verbatim as the mapped error's
 * `message` rather than being replaced with `DEFAULT_LOADER_ERROR_MESSAGE`
 * -- see `toLoaderError`'s handling below.
 *
 * `runMutation` (T086, ED-1 Packet P0): the mutation-side counterpart to
 * `createLoader`, for plain RLS-enforced table writes (insert/update/
 * delete/upsert). Shares this file's error-normalization (`toLoaderError`)
 * rather than duplicating it, so every page's DES-16 error handling built
 * against `SupabaseLoaderError` works identically whether the rejection came
 * from a read (`createLoader`) or a write (`runMutation`). Return-type
 * design decision: `TResult` defaults to `void`. Most mutations in this
 * codebase (revoke, toggle, mark-read, etc.) have no meaningful return
 * payload -- their mutation function simply resolves `{ data: null, error:
 * null }` (e.g. an `.update(...).eq(...)` with no trailing `.select()`), and
 * `runMutation` resolves that as `undefined`, which type-checks against the
 * default `TResult = void`. A caller whose mutation DOES have a return
 * payload (e.g. an insert that `.select().single()`s the created row)
 * explicitly supplies a concrete `TResult` generic; that caller is
 * responsible for shaping its own query to guarantee non-null `data` on
 * success (the same `.single()`/`.select()` discipline `loader.ts`'s own
 * call sites and `auth.ts`'s `signInWithPassword`/`updateUserPassword`
 * already follow). `runMutation` deliberately does NOT itself throw on
 * `data === null, error === null` the way `signInWithPassword` throws on a
 * missing session -- for the `TResult = void` majority case, that outcome is
 * the expected/only one, not an anomaly worth guarding against here.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient, SupabaseNotConfiguredError } from './client';

/**
 * DES-16-compatible typed error: `message` states what happened + what to
 * do (fixed, hand-authored copy -- see `DEFAULT_LOADER_ERROR_MESSAGE`),
 * `code` is a stable machine-readable string a caller can branch on
 * (Postgrest's own `error.code` when present, else `'UNKNOWN'`), and
 * `cause` carries the raw underlying error for logging only -- `cause` is
 * never itself DES-16-compliant copy and must never be rendered to a user
 * directly.
 */
export interface SupabaseLoaderError {
  code: string;
  message: string;
  cause: unknown;
}

/**
 * Fixed DES-16 copy ("what happened + what to do", no apologies) --
 * deliberately NOT the raw Postgrest/network error message, which is
 * technical and was never written for end users. Same reasoning
 * `supabase/functions/checkin/validation.ts` and
 * `supabase/functions/send-invite/validation.ts` already use for their own
 * DES-16 error copy: fixed, hand-authored strings, not a passthrough of the
 * raw underlying error text.
 */
const DEFAULT_LOADER_ERROR_MESSAGE =
  "Couldn't load this data. Check your connection and try again.";

function extractErrorCode(raw: unknown): string {
  if (typeof raw === 'object' && raw !== null && 'code' in raw) {
    const code = (raw as { code?: unknown }).code;
    if (typeof code === 'string' && code.length > 0) {
      return code;
    }
  }
  return 'UNKNOWN';
}

/**
 * `SupabaseNotConfiguredError` (thrown by `getSupabaseClient()`, `client.ts`,
 * when a dev has no `.env` file) is the one exception to the "always use
 * `DEFAULT_LOADER_ERROR_MESSAGE`" rule below: its own `.message` is already
 * good, hand-authored DES-16 copy (states exactly what happened -- Supabase
 * isn't configured -- and what to do -- set the two env vars and restart),
 * so it is reused verbatim rather than being replaced with the generic
 * "check your connection" copy, which would be actively misleading for this
 * specific failure mode (T086 bug fix -- see module doc above).
 */
function toLoaderError(raw: unknown): SupabaseLoaderError {
  if (raw instanceof SupabaseNotConfiguredError) {
    return { code: extractErrorCode(raw), message: raw.message, cause: raw };
  }
  return { code: extractErrorCode(raw), message: DEFAULT_LOADER_ERROR_MESSAGE, cause: raw };
}

/** Type guard for `SupabaseLoaderError`, for callers that need to
 * distinguish this module's rejections from other thrown errors. */
export function isSupabaseLoaderError(value: unknown): value is SupabaseLoaderError {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { code?: unknown }).code === 'string' &&
    typeof (value as { message?: unknown }).message === 'string' &&
    'cause' in value
  );
}

/**
 * The shape every Postgrest response already has (`.select()`,
 * `.select().maybeSingle()`, `.select().single()`, etc.) -- `data: null`
 * with `error: null` is the "no rows" case (e.g. `.maybeSingle()` finding
 * zero rows); `data: null` with a non-null `error` is a genuine
 * transport/query failure.
 */
export interface LoaderQueryResult<TData> {
  data: TData | null;
  error: { message: string; code?: string } | null;
}

export type LoaderQueryFn<TArgs, TData> = (
  client: SupabaseClient,
  args: TArgs,
) => PromiseLike<LoaderQueryResult<TData>>;

/**
 * Builds a `(args) => Promise<Data | null>` loader from a caller-supplied
 * query function -- the convergent shape named in the worker packet.
 * `getClient` defaults to the shared singleton (`getSupabaseClient`) but is
 * injectable so tests (and this module's own `auth.ts` `resolveRole`
 * helper) can supply a stubbed transport with zero real network calls.
 */
export function createLoader<TArgs, TData>(
  query: LoaderQueryFn<TArgs, TData>,
  getClient: () => SupabaseClient = getSupabaseClient,
): (args: TArgs) => Promise<TData | null> {
  return async (args: TArgs): Promise<TData | null> => {
    // T086 bug fix: `getClient()` is called INSIDE this `try` (not before
    // it) so a thrown `SupabaseNotConfiguredError` is also normalized into a
    // `SupabaseLoaderError` -- see module doc and `toLoaderError` above.
    let result: LoaderQueryResult<TData>;
    try {
      const client = getClient();
      result = await query(client, args);
    } catch (transportError) {
      throw toLoaderError(transportError);
    }
    if (result.error) {
      throw toLoaderError(result.error);
    }
    return result.data ?? null;
  };
}

/**
 * The shape a caller-supplied mutation function resolves -- structurally
 * identical to `LoaderQueryResult` (same Postgrest response shape every
 * `.insert()`/`.update()`/`.delete()`/`.upsert()` already has), but named
 * distinctly since a mutation's "no return payload" case (`data: null,
 * error: null`) is the ordinary/expected outcome for most callers (see
 * `runMutation`'s design-decision doc above), not a "not found" case the way
 * it is for `createLoader`'s reads.
 */
export type MutationFn<TArgs, TResult> = (
  client: SupabaseClient,
  args: TArgs,
) => PromiseLike<{ data: TResult | null; error: { message: string; code?: string } | null }>;

/**
 * Builds a `(args) => Promise<TResult>` mutation from a caller-supplied
 * mutation function -- the write-side counterpart to `createLoader` (see
 * module doc above for the shared error-normalization and the
 * `TResult = void` default design decision). `getClient` defaults to the
 * shared singleton but is injectable so tests can supply a stubbed
 * transport with zero real network calls, same as `createLoader`.
 */
export function runMutation<TArgs, TResult = void>(
  mutation: MutationFn<TArgs, TResult>,
  getClient: () => SupabaseClient = getSupabaseClient,
): (args: TArgs) => Promise<TResult> {
  return async (args: TArgs): Promise<TResult> => {
    // Same T086 bug fix as `createLoader` above: `getClient()` is called
    // INSIDE this `try`, not before it.
    let result: { data: TResult | null; error: { message: string; code?: string } | null };
    try {
      const client = getClient();
      result = await mutation(client, args);
    } catch (transportError) {
      throw toLoaderError(transportError);
    }
    if (result.error) {
      throw toLoaderError(result.error);
    }
    // See the `TResult = void` design-decision doc above: a mutation with no
    // return payload resolves `data: null`, which is coerced to `undefined`
    // here (valid for the default `TResult = void`); a caller with a
    // concrete `TResult` is responsible for shaping its own query
    // (`.select().single()`, etc.) to guarantee non-null `data` on success.
    return (result.data ?? undefined) as TResult;
  };
}
