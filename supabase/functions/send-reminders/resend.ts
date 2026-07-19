// supabase/functions/send-reminders/resend.ts
//
// T051 -- Resend HTTP API client for the five reminder/digest templates
// (EML-03). This is an INDEPENDENT reimplementation of T048's
// `supabase/functions/send-invite/resend.ts` -- that file is a Forbidden
// File for this task (send-invite/** is read-only reference, not
// importable cross-directory), so this module intentionally duplicates its
// design rather than importing it, per this task's worker packet
// Dependencies section: "independently reimplement the same fetch-based
// Resend client and gate logic in this function's own directory, matching
// the established design exactly (same fail-closed RESEND_SEND_MODE gate,
// same env-var names) rather than inventing a different one." Everything
// below matches `send-invite/resend.ts` line-for-line in behavior (same
// `RESEND_API_URL`, same `RESEND_SEND_MODE`/`RESEND_API_KEY` env var names,
// same fail-closed default-to-'test' gate, same `SendEmailResult` shape) --
// see that file's own header comment for the full design rationale and the
// Resend-test-address research citation, not repeated verbatim here to
// avoid this comment block drifting out of sync with the original as a
// stale copy.
//
// DEPENDENCY CHOICE (constitution item 9), identical to send-invite's own:
// plain Deno `fetch`, not the `resend` npm package (not on the allowlist).
//
// SEC-03 / constitution item 5 (BLOCKER-class): `RESEND_API_KEY` is read
// ONLY via `Deno.env.get('RESEND_API_KEY')` here -- never hardcoded, never
// logged, never echoed in any response or error value returned by this
// module.
//
// CONSTITUTION ITEM 7 (BLOCKER-class) -- test-mode gate, reimplemented
// exactly: `resolveSendMode()` reads ONLY `Deno.env.get('RESEND_SEND_MODE')`
// and takes zero parameters -- nothing request-derived (which template,
// which recipient, which session) can ever reach it. It defaults to
// `'test'` for every value except the exact literal string `'production'`.
// `sendBrandedEmail()` takes the resolved `mode` as an explicit required
// parameter (not read internally), so every call site in index.ts makes the
// gate visually explicit. In every mode other than `'production'`, this
// returns `{ sent: false, reason: 'skipped_test_mode' }` BEFORE
// constructing any request -- it never builds the `fetch()` call, never
// reads `RESEND_API_KEY` for a network request, and never reaches
// `https://api.resend.com`.

export const RESEND_API_URL = 'https://api.resend.com/emails';

export type SendMode = 'production' | 'test';

/**
 * Resolves the test-mode gate from environment ONLY. Takes no parameters --
 * nothing request-derived can ever influence this. Fail-closed: anything
 * other than the exact string 'production' resolves to 'test'.
 */
export function resolveSendMode(): SendMode {
  return Deno.env.get('RESEND_SEND_MODE') === 'production' ? 'production' : 'test';
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  from: string;
}

export type SendEmailResult =
  | { sent: true; providerId: string }
  | { sent: false; reason: 'skipped_test_mode' }
  | { sent: false; reason: 'missing_api_key' }
  | { sent: false; reason: 'resend_error'; status: number };

/**
 * Sends a branded email via Resend's HTTP API -- but ONLY when `mode` is
 * exactly `'production'`. `mode` must be passed in explicitly by the caller
 * (index.ts calls `resolveSendMode()` itself and passes the result here),
 * so the gate check is visible at the call site, not hidden inside this
 * function.
 */
export async function sendBrandedEmail(input: SendEmailInput, mode: SendMode): Promise<SendEmailResult> {
  if (mode !== 'production') {
    // Constitution item 7 (BLOCKER-class): the real Resend API is never
    // reached here. No fetch() is constructed below this line in this
    // branch.
    return { sent: false, reason: 'skipped_test_mode' };
  }

  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) {
    // Misconfiguration, not a caller problem. Never includes the key (or
    // its absence detail beyond this generic reason) in any thrown error or
    // log line.
    return { sent: false, reason: 'missing_api_key' };
  }

  const response = await fetch(RESEND_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: input.from,
      to: input.to,
      subject: input.subject,
      html: input.html,
    }),
  });

  if (!response.ok) {
    return { sent: false, reason: 'resend_error', status: response.status };
  }

  const data = (await response.json().catch(() => ({}))) as { id?: string };
  return { sent: true, providerId: data.id ?? '' };
}
