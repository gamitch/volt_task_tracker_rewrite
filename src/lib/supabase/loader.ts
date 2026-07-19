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
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from './client';

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

function toLoaderError(raw: unknown): SupabaseLoaderError {
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
    const client = getClient();
    let result: LoaderQueryResult<TData>;
    try {
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
