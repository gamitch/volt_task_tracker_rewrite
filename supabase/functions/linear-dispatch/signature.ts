// Linear webhook signature verification + replay protection.
//
// Pure Web Crypto (`crypto.subtle`), exactly as checkin/hmac.ts is, so this
// module is fully unit-testable under `deno test` with no network, no live
// Supabase project, and without `LINEAR_WEBHOOK_SECRET` ever leaving the
// process.
//
// -----------------------------------------------------------------------
// THE SCHEME, AS LINEAR DEFINES IT (developers.linear.app/webhooks)
// -----------------------------------------------------------------------
// 1. Linear sends the header `Linear-Signature` on every delivery. Its value
//    is the lower-case hex encoding of
//       HMAC-SHA256(key = <the webhook's signing secret>, message = <the RAW
//       request body bytes>).
//
// 2. **The signature is over the raw body, not over a re-serialised object.**
//    `JSON.parse` then `JSON.stringify` is NOT signature-preserving --- key
//    order, whitespace and number formatting can all move. So `index.ts`
//    reads `await req.text()` ONCE and verifies that exact string before it
//    parses anything. Verify-then-parse, never parse-then-verify.
//
// 3. The body carries `webhookTimestamp`, a UNIX timestamp in
//    **milliseconds**. Linear's own guidance: "We recommend that you verify
//    it's within a minute of the time your system sees it to guard against
//    replay attacks." `isFresh` implements that, with the tolerance and
//    `nowMs` both injectable so the tests are deterministic.
//
//    Note the timestamp is INSIDE the signed body, so an attacker cannot
//    retune it without invalidating the signature --- freshness and
//    authenticity compose rather than duplicating each other.
//
// 4. Comparison is constant-time (fixed-length, non-short-circuiting XOR
//    accumulation) for the same reason checkin/hmac.ts does it: the operand
//    is secret-derived. The early length-mismatch return leaks nothing
//    secret-dependent --- a hex SHA-256 digest is always 64 characters, a
//    public fixed format.

/** Header Linear puts the hex HMAC in. Compared case-insensitively by `Headers`. */
export const SIGNATURE_HEADER = 'Linear-Signature';

/** Linear's own recommendation: "within a minute". */
export const DEFAULT_TIMESTAMP_TOLERANCE_MS = 60_000;

/** Lower-case hex of an HMAC-SHA256 digest is always 64 chars. */
const HEX_DIGEST_LENGTH = 64;

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * `HMAC-SHA256(secret, rawBody)` as lower-case hex --- the value Linear puts
 * in `Linear-Signature`. Exported so tests can construct genuine signatures
 * rather than hardcoding a digest that would silently rot if the scheme moved.
 */
export async function computeSignature(secret: string, rawBody: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  return toHex(new Uint8Array(sig));
}

/** Fixed-length, non-short-circuiting comparison. Same shape as checkin/hmac.ts. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * True when `presentedSignature` is a valid `Linear-Signature` for `rawBody`
 * under `secret`.
 *
 * Hex is case-insensitive as a format, so the presented value is lower-cased
 * before comparison --- otherwise an upper-case-hex sender would be rejected
 * for a formatting difference and the failure would look like a wrong secret.
 * Length is normalised first so `timingSafeEqual` still sees two 64-char
 * operands.
 *
 * An empty/missing signature returns false rather than throwing: `index.ts`
 * turns that into one 401, and a missing header should not be a different
 * observable outcome from a wrong one.
 */
export async function verifySignature(
  secret: string,
  rawBody: string,
  presentedSignature: string | null | undefined,
): Promise<boolean> {
  if (!presentedSignature) return false;
  const normalized = presentedSignature.trim().toLowerCase();
  if (normalized.length !== HEX_DIGEST_LENGTH) return false;
  const expected = await computeSignature(secret, rawBody);
  return timingSafeEqual(expected, normalized);
}

/**
 * Replay guard (scheme step 3). `webhookTimestampMs` is Linear's
 * `webhookTimestamp` field --- milliseconds since the epoch.
 *
 * The window is symmetric: a delivery from the future beyond tolerance is as
 * suspect as a stale one, and a symmetric window also absorbs ordinary clock
 * skew between Linear and the edge runtime in the benign direction.
 *
 * A non-finite or non-numeric timestamp is not fresh. That matters --- a
 * missing `webhookTimestamp` would otherwise become `NaN`, and every
 * comparison against `NaN` is false, which would make an absent timestamp
 * *pass* a naive `elapsed > tolerance` check. That is exactly the
 * silent-no-op-that-looks-like-success shape this project keeps recording, so
 * it is guarded explicitly and proven by a test.
 */
export function isFresh(
  webhookTimestampMs: unknown,
  nowMs: number,
  toleranceMs: number = DEFAULT_TIMESTAMP_TOLERANCE_MS,
): boolean {
  if (typeof webhookTimestampMs !== 'number' || !Number.isFinite(webhookTimestampMs)) return false;
  return Math.abs(nowMs - webhookTimestampMs) <= toleranceMs;
}
