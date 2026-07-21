// T032: pure request-body validation for the `checkin` Edge Function,
// extracted from index.ts so it can be exercised with `deno test` without a
// live Supabase project, Postgres, or network access.
//
// Request body contract (this task's own definition -- documented here for
// T033/T034/T035, which call this function): exactly one of `token` (QR
// path) or `code` (manual short-code entry path) must be present alongside
// `session_id`. `s`/`t` are the QR *URL* query param names (PRD MTG-06);
// callers map `s` -> `session_id` and `t` -> `token` when building this
// function's request body.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export interface CheckinRequestBody {
  session_id: string;
  /** Present for the QR path; mutually exclusive with `code`. */
  token: string | null;
  /** Present for the manual short-code path; mutually exclusive with `token`. */
  code: string | null;
}

export type CheckinValidationErrorCode =
  | 'INVALID_BODY'
  | 'MISSING_SESSION_ID'
  | 'INVALID_SESSION_ID'
  | 'MISSING_CREDENTIAL'
  | 'AMBIGUOUS_CREDENTIAL';

export interface CheckinValidationError {
  code: CheckinValidationErrorCode;
  /** DES-16 style: what happened + what to do. No apologies. */
  message: string;
}

export type CheckinValidationResult =
  | { ok: true; value: CheckinRequestBody }
  | { ok: false; error: CheckinValidationError };

/**
 * Validates a parsed JSON request body against this function's contract:
 *   - `session_id`: required, must look like a uuid.
 *   - exactly one of `token` / `code` non-empty strings; neither or both
 *     present is rejected.
 * Does not check that the session actually exists or that the token/code
 * verifies -- those require HMAC computation and/or a DB round-trip and are
 * done separately in index.ts.
 */
export function validateCheckinRequest(body: unknown): CheckinValidationResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return {
      ok: false,
      error: { code: 'INVALID_BODY', message: 'Send a JSON body with session_id and either token or code.' },
    };
  }

  const raw = body as Record<string, unknown>;

  const sessionIdPresent = raw.session_id !== undefined && raw.session_id !== null && raw.session_id !== '';
  if (!sessionIdPresent) {
    return {
      ok: false,
      error: { code: 'MISSING_SESSION_ID', message: 'That check-in link is missing its session. Rescan the QR code.' },
    };
  }
  if (!isValidUuid(raw.session_id)) {
    return {
      ok: false,
      error: { code: 'INVALID_SESSION_ID', message: "That check-in link isn't valid. Rescan the QR code." },
    };
  }

  const tokenPresent = typeof raw.token === 'string' && raw.token.length > 0;
  const codePresent = typeof raw.code === 'string' && raw.code.length > 0;

  if (!tokenPresent && !codePresent) {
    return {
      ok: false,
      error: {
        code: 'MISSING_CREDENTIAL',
        message: 'Scan the QR code or enter the short code shown on the screen.',
      },
    };
  }
  if (tokenPresent && codePresent) {
    return {
      ok: false,
      error: {
        code: 'AMBIGUOUS_CREDENTIAL',
        message: 'Send either a QR token or a short code, not both.',
      },
    };
  }

  return {
    ok: true,
    value: {
      session_id: raw.session_id as string,
      token: tokenPresent ? (raw.token as string) : null,
      code: codePresent ? (raw.code as string) : null,
    },
  };
}
