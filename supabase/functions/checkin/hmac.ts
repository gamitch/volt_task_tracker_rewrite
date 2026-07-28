// T032: pure HMAC-SHA256 token/short-code construction and validation for the
// rotating QR check-in token and the 6-character manual short code (PRD
// MTG-06). Uses only the Web Crypto API (`crypto.subtle`), which is present
// both in the Deno Edge Function runtime and in `deno test`, so this module
// is fully unit-testable without a live Supabase project, network access, or
// the `CHECKIN_HMAC_SECRET` ever leaving this process.
//
// -----------------------------------------------------------------------
// EXACT DERIVATION SCHEME -- T033 (Live Console), T034 (Kiosk), and T035
// (`/checkin` result screen + manual code entry) must reproduce this
// precisely to generate/verify tokens and short codes that this function
// will accept. This is the canonical, load-bearing spec:
// -----------------------------------------------------------------------
// 1. Time bucket: `bucket = floor(unixSeconds / 60)` -- an integer that
//    changes once every 60 real-world seconds, anchored to the Unix epoch
//    (NOT anchored to the session's `starts_at`).
// 2. Canonical message: the UTF-8 string `` `${sessionId}:${bucket}` `` --
//    `sessionId` is the `event_sessions.id` uuid as its canonical string
//    form, `bucket` is the base-10 string of the integer from step 1,
//    joined with a single colon.
// 3. Digest: `digest = HMAC-SHA256(key = CHECKIN_HMAC_SECRET, message)` --
//    32 raw bytes, computed once per (sessionId, bucket) pair.
// 4. QR token (the `t` query param on `.../checkin?s=<sessionId>&t=<token>`):
//    the first 16 bytes of `digest`, lower-case hex-encoded -> a
//    32-character hex string ("truncated" per PRD MTG-06's wording).
// 5. Short code: bytes [16..22) (6 bytes) of the SAME `digest` (per PRD:
//    "short code derived from the same HMAC" -- token and short code are
//    two views into one HMAC computation, not two independent secrets).
//    Each of the 6 bytes is mapped independently via `byte % 34` into the
//    fixed 34-character alphabet `ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789`
//    (all 26 letters A-Z, plus digits 2-9, per PRD's literal "A-Z/2-9"
//    spec -- note this means the letters O and I ARE part of the alphabet
//    even though they can look like 0/1; the PRD's chosen scheme only
//    excludes the DIGITS 0 and 1 by starting the digit range at 2, it does
//    not exclude any letters). This yields a 6-character, always-uppercase
//    code.
//    NOTE (documented, not silently glossed over): `byte % 34` has a very
//    slight statistical bias since 256 is not evenly divisible by 34 (bytes
//    0-15 map to alphabet indices 0-15 twice as densely as bytes... in fact
//    every index gets floor(256/34)=7 or ceil=8 possible source bytes). This
//    is acceptable for a short-lived, human-read/typed display code -- it is
//    not used anywhere that requires uniform cryptographic randomness.
// 6. Validity window: at verification time, compute the CURRENT bucket and
//    the immediately PREVIOUS bucket (`currentBucket - 1`) and accept a
//    match against either. This gives an effective validity of somewhere
//    between just-over-60s and just-under-120s depending on where in the
//    current minute the check happens (PRD: "accepts current and previous
//    bucket (<= 2 min validity)").
// 7. Comparisons are constant-time (fixed-length, non-short-circuiting XOR
//    accumulation) to avoid timing side-channels on secret-derived values.
//    (The early length-mismatch return does not leak secret-dependent
//    information -- both operand lengths are always public/fixed-format.)

const SHORT_CODE_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789'; // 34 chars, A-Z + 2-9
const TOKEN_BYTE_LENGTH = 16; // digest bytes [0..16) -> 32 hex chars
const SHORT_CODE_BYTE_OFFSET = 16; // digest bytes [16..22)
const SHORT_CODE_LENGTH = 6;

export { SHORT_CODE_ALPHABET, TOKEN_BYTE_LENGTH, SHORT_CODE_BYTE_OFFSET, SHORT_CODE_LENGTH };

/** floor(unixSeconds / 60) -- the 60-second time bucket (PRD MTG-06). */
export function bucketFor(unixSeconds: number): number {
  return Math.floor(unixSeconds / 60);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function hmacDigest(secret: string, message: string): Promise<Uint8Array> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return new Uint8Array(sig);
}

/** Step 2-3 of the derivation scheme above. Exported for tests/inspection. */
export function digestFor(secret: string, sessionId: string, bucket: number): Promise<Uint8Array> {
  return hmacDigest(secret, `${sessionId}:${bucket}`);
}

/** Step 4: the 32-char hex QR token for a given (sessionId, bucket). */
export async function tokenFor(secret: string, sessionId: string, bucket: number): Promise<string> {
  const digest = await digestFor(secret, sessionId, bucket);
  return toHex(digest.slice(0, TOKEN_BYTE_LENGTH));
}

/** Step 5: the 6-char A-Z2-9 short code for a given (sessionId, bucket). */
export async function shortCodeFor(secret: string, sessionId: string, bucket: number): Promise<string> {
  const digest = await digestFor(secret, sessionId, bucket);
  const bytes = digest.slice(SHORT_CODE_BYTE_OFFSET, SHORT_CODE_BYTE_OFFSET + SHORT_CODE_LENGTH);
  let code = '';
  for (const b of bytes) {
    code += SHORT_CODE_ALPHABET[b % SHORT_CODE_ALPHABET.length];
  }
  return code;
}

/** Fixed-length, non-short-circuiting comparison (step 7). */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Validates a presented QR token against the current and previous 60-second
 * bucket for `sessionId` (step 6). `nowUnixSeconds` is injectable for
 * deterministic tests.
 */
export async function verifyToken(
  secret: string,
  sessionId: string,
  presentedToken: string,
  nowUnixSeconds: number,
): Promise<boolean> {
  const currentBucket = bucketFor(nowUnixSeconds);
  const candidates = await Promise.all([currentBucket, currentBucket - 1].map((b) => tokenFor(secret, sessionId, b)));
  return candidates.some((c) => timingSafeEqual(c, presentedToken));
}

/**
 * Validates a presented short code (case-insensitive, trimmed) against the
 * current and previous 60-second bucket for `sessionId` (step 6).
 */
export async function verifyShortCode(
  secret: string,
  sessionId: string,
  presentedCode: string,
  nowUnixSeconds: number,
): Promise<boolean> {
  const normalized = presentedCode.trim().toUpperCase();
  const currentBucket = bucketFor(nowUnixSeconds);
  const candidates = await Promise.all(
    [currentBucket, currentBucket - 1].map((b) => shortCodeFor(secret, sessionId, b)),
  );
  return candidates.some((c) => timingSafeEqual(c, normalized));
}
