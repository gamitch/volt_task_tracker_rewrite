// T032: unit tests for hmac.ts, the pure token/short-code derivation and
// validation logic. Run with `deno test supabase/functions/checkin/`.
//
// Fully offline: uses only Deno's built-in Web Crypto API and Node's
// built-in assert module (no network, no live Supabase project).
import assert from 'node:assert/strict';
import {
  bucketFor,
  digestFor,
  shortCodeFor,
  timingSafeEqual,
  tokenFor,
  verifyShortCode,
  verifyToken,
  SHORT_CODE_ALPHABET,
} from './hmac.ts';

const SECRET = 'fabricated-test-secret-not-a-real-credential';
const SESSION_ID = '123e4567-e89b-12d3-a456-426614174000';

Deno.test('bucketFor computes floor(unixSeconds / 60)', () => {
  assert.equal(bucketFor(0), 0);
  assert.equal(bucketFor(59), 0);
  assert.equal(bucketFor(60), 1);
  assert.equal(bucketFor(119), 1);
  assert.equal(bucketFor(120), 2);
  assert.equal(bucketFor(1_753_000_000), Math.floor(1_753_000_000 / 60));
});

Deno.test('tokenFor is deterministic for the same (secret, sessionId, bucket)', async () => {
  const a = await tokenFor(SECRET, SESSION_ID, 1000);
  const b = await tokenFor(SECRET, SESSION_ID, 1000);
  assert.equal(a, b);
  assert.equal(a.length, 32, 'token is 32 hex chars (16 truncated bytes)');
  assert.match(a, /^[0-9a-f]{32}$/);
});

Deno.test('tokenFor differs across buckets, sessionIds, and secrets', async () => {
  const base = await tokenFor(SECRET, SESSION_ID, 1000);
  const diffBucket = await tokenFor(SECRET, SESSION_ID, 1001);
  const diffSession = await tokenFor(SECRET, '00000000-0000-0000-0000-000000000000', 1000);
  const diffSecret = await tokenFor('different-secret', SESSION_ID, 1000);
  assert.notEqual(base, diffBucket);
  assert.notEqual(base, diffSession);
  assert.notEqual(base, diffSecret);
});

Deno.test('shortCodeFor is deterministic, 6 chars, and drawn only from A-Z2-9', async () => {
  for (let bucket = 0; bucket < 20; bucket++) {
    const code = await shortCodeFor(SECRET, SESSION_ID, bucket);
    assert.equal(code.length, 6);
    for (const ch of code) {
      assert.ok(SHORT_CODE_ALPHABET.includes(ch), `unexpected char '${ch}' in short code '${code}'`);
    }
    // PRD's "A-Z/2-9" spec excludes digits 0 and 1 (not the letters O/I,
    // which remain part of the full A-Z range).
    assert.ok(!/[01]/.test(code));
    const again = await shortCodeFor(SECRET, SESSION_ID, bucket);
    assert.equal(code, again);
  }
});

Deno.test('token and short code are derived from the same digest but are independent substrings', async () => {
  const digest = await digestFor(SECRET, SESSION_ID, 42);
  assert.equal(digest.length, 32, 'HMAC-SHA256 digest is 32 bytes');
  const token = await tokenFor(SECRET, SESSION_ID, 42);
  const code = await shortCodeFor(SECRET, SESSION_ID, 42);
  // token = hex of bytes [0..16), short code maps bytes [16..22) -- assert
  // the token hex matches the digest's first 16 bytes exactly.
  const expectedTokenHex = Array.from(digest.slice(0, 16))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  assert.equal(token, expectedTokenHex);
  assert.equal(code.length, 6);
});

Deno.test('timingSafeEqual: equal strings match, unequal do not, length mismatch is false', () => {
  assert.ok(timingSafeEqual('abc123', 'abc123'));
  assert.ok(!timingSafeEqual('abc123', 'abc124'));
  assert.ok(!timingSafeEqual('abc123', 'abc12'));
  assert.ok(!timingSafeEqual('', 'a'));
  assert.ok(timingSafeEqual('', ''));
});

Deno.test('verifyToken: accepts the current bucket token', async () => {
  const nowSeconds = 100_000; // bucket 1666
  const currentBucketToken = await tokenFor(SECRET, SESSION_ID, bucketFor(nowSeconds));
  assert.ok(await verifyToken(SECRET, SESSION_ID, currentBucketToken, nowSeconds));
});

Deno.test('verifyToken: accepts the immediately previous bucket token (<= 2 min validity)', async () => {
  const nowSeconds = 100_000;
  const prevBucketToken = await tokenFor(SECRET, SESSION_ID, bucketFor(nowSeconds) - 1);
  assert.ok(await verifyToken(SECRET, SESSION_ID, prevBucketToken, nowSeconds));
});

Deno.test('verifyToken: rejects a token from 2 buckets ago (outside the validity window)', async () => {
  const nowSeconds = 100_000;
  const staleToken = await tokenFor(SECRET, SESSION_ID, bucketFor(nowSeconds) - 2);
  assert.ok(!(await verifyToken(SECRET, SESSION_ID, staleToken, nowSeconds)));
});

Deno.test('verifyToken: rejects a token computed with the wrong secret', async () => {
  const nowSeconds = 100_000;
  const wrongSecretToken = await tokenFor('wrong-secret', SESSION_ID, bucketFor(nowSeconds));
  assert.ok(!(await verifyToken(SECRET, SESSION_ID, wrongSecretToken, nowSeconds)));
});

Deno.test('verifyToken: rejects a token computed for a different session id', async () => {
  const nowSeconds = 100_000;
  const otherSessionToken = await tokenFor(SECRET, '00000000-0000-0000-0000-000000000000', bucketFor(nowSeconds));
  assert.ok(!(await verifyToken(SECRET, SESSION_ID, otherSessionToken, nowSeconds)));
});

Deno.test('verifyToken: bucket boundary -- token generated one second before a bucket rollover is still valid one second after', async () => {
  // bucket rolls over at every multiple of 60. Generate at t=119 (bucket 1),
  // verify at t=120 (bucket 2) -- t=119's bucket (1) is the "previous
  // bucket" relative to t=120's current bucket (2), so it must still verify.
  const genAt = 119;
  const verifyAt = 120;
  const token = await tokenFor(SECRET, SESSION_ID, bucketFor(genAt));
  assert.ok(await verifyToken(SECRET, SESSION_ID, token, verifyAt));
});

Deno.test('verifyToken: a token is no longer valid once its bucket is more than 1 behind current', async () => {
  // Generate at t=60 (bucket 1), verify at t=180 (bucket 3) -- bucket 1 is
  // 2 buckets behind bucket 3, outside the accepted {current, current-1} set.
  const token = await tokenFor(SECRET, SESSION_ID, bucketFor(60));
  assert.ok(!(await verifyToken(SECRET, SESSION_ID, token, 180)));
});

Deno.test('verifyShortCode: accepts current/previous bucket, case-insensitive and trimmed', async () => {
  const nowSeconds = 500_000;
  const currentCode = await shortCodeFor(SECRET, SESSION_ID, bucketFor(nowSeconds));
  assert.ok(await verifyShortCode(SECRET, SESSION_ID, currentCode, nowSeconds));
  assert.ok(await verifyShortCode(SECRET, SESSION_ID, currentCode.toLowerCase(), nowSeconds));
  assert.ok(await verifyShortCode(SECRET, SESSION_ID, `  ${currentCode}  `, nowSeconds));

  const prevCode = await shortCodeFor(SECRET, SESSION_ID, bucketFor(nowSeconds) - 1);
  assert.ok(await verifyShortCode(SECRET, SESSION_ID, prevCode, nowSeconds));
});

Deno.test('verifyShortCode: rejects a stale (2+ buckets old) or garbage code', async () => {
  const nowSeconds = 500_000;
  const staleCode = await shortCodeFor(SECRET, SESSION_ID, bucketFor(nowSeconds) - 2);
  assert.ok(!(await verifyShortCode(SECRET, SESSION_ID, staleCode, nowSeconds)));
  assert.ok(!(await verifyShortCode(SECRET, SESSION_ID, 'ZZZZZZ', nowSeconds)));
});
