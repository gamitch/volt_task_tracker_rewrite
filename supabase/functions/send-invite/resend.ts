// supabase/functions/send-invite/resend.ts
//
// T048 -- Resend HTTP API client for the branded "invite" email (EML-01).
//
// DEPENDENCY CHOICE (constitution item 9): Deno's built-in `fetch` is used
// instead of the `resend` npm package. `resend` is NOT on the allowlist
// (`@astryxdesign/*`, `@supabase/supabase-js`, `@tanstack/react-query`,
// `react-router-dom`, `qrcode.react`, `ical-generator`, plus dev tooling).
// `ical-generator` was allowlisted specifically because hand-rolling ICS is
// a checker BLOCKER (CAL-04) -- a real format-correctness risk. Resend's
// send API is a single, well-documented JSON POST to
// `https://api.resend.com/emails` with an `Authorization: Bearer <key>`
// header -- no comparable format-correctness risk, so this uses plain
// `fetch` (already built into the Deno runtime, zero new dependency, no
// constitution item 9 escalation needed) rather than requesting an
// allowlist exception for `resend`.
//
// SEC-03 / constitution item 5 (BLOCKER-class): `RESEND_API_KEY` is read
// ONLY via `Deno.env.get('RESEND_API_KEY')` here, exactly mirroring how
// `SUPABASE_SERVICE_ROLE_KEY` is handled in index.ts and how
// `CHECKIN_HMAC_SECRET` is handled in `supabase/functions/checkin/`. It is
// never hardcoded, never logged, never echoed in any response or error
// value returned by this module.
//
// ---------------------------------------------------------------------
// CONSTITUTION ITEM 7 (BLOCKER-class) -- test-mode gate. Read this in full.
// ---------------------------------------------------------------------
// `resolveSendMode()` is the ONLY thing that decides whether a real network
// call to Resend is ever made:
//   - it reads `Deno.env.get('RESEND_SEND_MODE')` and NOTHING else -- no
//     request body field, no header, no database value, no argument passed
//     in from index.ts can reach it. It takes zero parameters.
//   - it defaults to `'test'` for every value except the exact literal
//     string `'production'` (unset, `''`, `'prod'`, `'Production'`,
//     `'true'`, anything else -- all fall back to `'test'`). This is
//     fail-closed: the only way to reach `'production'` is an exact,
//     deliberate string match, not "anything truthy".
// `sendBrandedEmail()` below takes the resolved `mode` as an explicit,
// required parameter (not read internally) so callers/tests can drive it
// directly without needing to mock `Deno.env`, and so index.ts's own call
// site makes the gate visually explicit rather than hidden inside this
// module. In every mode other than `'production'`, this function returns
// immediately with `{ sent: false, reason: 'skipped_test_mode' }` BEFORE
// constructing any request: it never builds the `fetch()` call, never reads
// `RESEND_API_KEY` for a network request, and never reaches
// `https://api.resend.com`. There is no "safer recipient" fallback/redirect
// path taken instead -- the real send API is simply never invoked outside
// explicit production mode. This is a stronger guarantee than routing to
// Resend's own documented test recipients, because it requires no network
// call and no trust in Resend's behavior at all.
//
// Research note on Resend's OWN test/sandbox mechanism (cited, not
// fabricated -- see caveat below): Resend documents reserved "test email
// addresses" under the `resend.dev` domain -- `delivered@resend.dev`
// (always simulates a successful delivery, never reaches a real inbox),
// `bounced@resend.dev`, and `complained@resend.dev` (simulate failure
// states) -- for exercising the send API without emailing a real recipient.
// Resend does not offer a separate "test mode" API key the way e.g. Stripe
// has distinct test/live key pairs; the same API key is used regardless of
// recipient address. CAVEAT: this citation is based on Resend's publicly
// documented behavior as known from training; this sandbox's network
// egress policy blocks `resend.com` outright (confirmed via
// `curl $HTTPS_PROXY/__agentproxy/status`, which reported
// `connect_rejected` / gateway 403 for `resend.com:443` -- the same class
// of block already documented for `deno.land`/Docker Hub in T017/T032's
// "External Blocker" sections), so this could NOT be re-verified live from
// this environment. Because of that unverifiable gap, this implementation
// does NOT rely on Resend's test-address mechanism as its safety boundary
// at all -- `RESEND_SEND_MODE` is a complete, self-contained short-circuit
// that needs no assumption about Resend's own behavior to be correct. If a
// checker or T052 wants to layer Resend's `delivered@resend.dev` mechanism
// on top as an *additional* belt-and-suspenders check even once
// `RESEND_SEND_MODE=production` is eventually set, that is a reasonable
// follow-up, but is explicitly NOT implemented here, and flipping
// `RESEND_SEND_MODE` to `'production'` at all is explicitly NOT this task's
// decision -- see index.ts's EXTENSION POINT comment and this task's
// worker-output "test-mode gate design" section for why that is T052's
// (a human sign-off gate) job, not something this code path enables or
// defaults toward.

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
 * exactly `'production'`. `mode` must be passed in explicitly by the
 * caller (index.ts calls `resolveSendMode()` itself and passes the result
 * here), so the gate check is visible at the call site, not hidden inside
 * this function.
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
