// Unit tests for signature.ts --- Linear webhook signature verification and
// replay protection. Run with `deno test supabase/functions/linear-dispatch/`.
//
// Fully offline, exactly as checkin/hmac.test.ts is: Deno's built-in Web
// Crypto plus Node's built-in assert. No network, no live Supabase project,
// no real webhook secret.
//
// Signatures are COMPUTED here rather than hardcoded. A pasted digest would
// pin the test to today's implementation detail and would still pass if the
// scheme drifted to something Linear no longer sends; deriving them means the
// tests describe the relationship (body + secret -> signature) instead of one
// frozen output of it.
import assert from 'node:assert/strict';
import {
  DEFAULT_TIMESTAMP_TOLERANCE_MS,
  SIGNATURE_HEADER,
  computeSignature,
  isFresh,
  timingSafeEqual,
  verifySignature,
} from './signature.ts';

const SECRET = 'fabricated-test-webhook-secret-not-a-real-credential';
const BODY = JSON.stringify({ action: 'update', type: 'Issue', webhookTimestamp: 1_754_700_000_000 });

Deno.test('SIGNATURE_HEADER is the header name Linear actually sends', () => {
  assert.equal(SIGNATURE_HEADER, 'Linear-Signature');
});

Deno.test('computeSignature is deterministic and returns 64 lower-case hex chars', async () => {
  const a = await computeSignature(SECRET, BODY);
  const b = await computeSignature(SECRET, BODY);
  assert.equal(a, b);
  assert.equal(a.length, 64, 'HMAC-SHA256 hex digest is 64 chars (32 bytes)');
  assert.match(a, /^[0-9a-f]{64}$/);
});

Deno.test('computeSignature differs across secrets and across bodies', async () => {
  const base = await computeSignature(SECRET, BODY);
  const diffSecret = await computeSignature('a-different-secret', BODY);
  const diffBody = await computeSignature(SECRET, `${BODY} `);
  assert.notEqual(base, diffSecret);
  assert.notEqual(base, diffBody);
});

Deno.test('verifySignature accepts a genuine signature', async () => {
  const sig = await computeSignature(SECRET, BODY);
  assert.ok(await verifySignature(SECRET, BODY, sig));
});

Deno.test('verifySignature rejects a body tampered with after signing', async () => {
  const sig = await computeSignature(SECRET, BODY);
  const tampered = BODY.replace('"update"', '"create"');
  assert.notEqual(tampered, BODY, 'guard: the tamper actually changed the body');
  assert.ok(!(await verifySignature(SECRET, tampered, sig)));
});

Deno.test('verifySignature rejects a signature computed with the wrong secret', async () => {
  const forged = await computeSignature('wrong-secret', BODY);
  assert.ok(!(await verifySignature(SECRET, BODY, forged)));
});

Deno.test('verifySignature rejects a missing, empty, or wrong-length signature', async () => {
  assert.ok(!(await verifySignature(SECRET, BODY, null)));
  assert.ok(!(await verifySignature(SECRET, BODY, undefined)));
  assert.ok(!(await verifySignature(SECRET, BODY, '')));
  assert.ok(!(await verifySignature(SECRET, BODY, 'deadbeef')), 'too short');
  const sig = await computeSignature(SECRET, BODY);
  assert.ok(!(await verifySignature(SECRET, BODY, `${sig}00`)), 'too long');
});

Deno.test('verifySignature is case-insensitive on hex and tolerates surrounding whitespace', async () => {
  const sig = await computeSignature(SECRET, BODY);
  assert.ok(await verifySignature(SECRET, BODY, sig.toUpperCase()));
  assert.ok(await verifySignature(SECRET, BODY, `  ${sig}  `));
});

// The reason index.ts reads req.text() once and verifies BEFORE JSON.parse.
// If it parsed first and re-serialised, this is the failure it would hit ---
// semantically identical JSON, different bytes, different HMAC.
Deno.test('verifySignature is over raw bytes: re-serialised, key-reordered JSON does not verify', async () => {
  const raw = '{"type":"Issue","action":"update"}';
  const reserialized = JSON.stringify(JSON.parse('{"action":"update","type":"Issue"}'));
  assert.notEqual(reserialized, raw, 'guard: the two encodings really do differ byte-wise');
  const sig = await computeSignature(SECRET, raw);
  assert.ok(await verifySignature(SECRET, raw, sig));
  assert.ok(!(await verifySignature(SECRET, reserialized, sig)));
});

// Whitespace is semantically irrelevant to JSON and completely relevant to an
// HMAC. Same lesson as above, stated for the pretty-printing case.
Deno.test('verifySignature rejects a pretty-printed copy of the signed body', async () => {
  const raw = '{"type":"Issue","action":"update"}';
  const pretty = JSON.stringify(JSON.parse(raw), null, 2);
  const sig = await computeSignature(SECRET, raw);
  assert.ok(!(await verifySignature(SECRET, pretty, sig)));
});

Deno.test('timingSafeEqual: equal strings match, unequal do not, length mismatch is false', () => {
  assert.ok(timingSafeEqual('abc123', 'abc123'));
  assert.ok(!timingSafeEqual('abc123', 'abc124'));
  assert.ok(!timingSafeEqual('abc123', 'abc12'));
  assert.ok(!timingSafeEqual('', 'a'));
  assert.ok(timingSafeEqual('', ''));
});

Deno.test('isFresh accepts a timestamp inside the window, in both directions', () => {
  const now = 1_754_700_000_000;
  assert.ok(isFresh(now, now), 'exactly now');
  assert.ok(isFresh(now - 30_000, now), '30s old');
  assert.ok(isFresh(now + 30_000, now), '30s in the future (clock skew)');
});

Deno.test('isFresh treats the tolerance as inclusive at the boundary and rejects beyond it', () => {
  const now = 1_754_700_000_000;
  const t = DEFAULT_TIMESTAMP_TOLERANCE_MS;
  assert.ok(isFresh(now - t, now), 'exactly at the boundary is still fresh');
  assert.ok(!isFresh(now - t - 1, now), 'one millisecond past the boundary is not');
  assert.ok(!isFresh(now + t + 1, now), 'and the same in the future direction');
});

Deno.test('isFresh honours a custom tolerance', () => {
  const now = 1_754_700_000_000;
  assert.ok(isFresh(now - 5_000, now, 10_000));
  assert.ok(!isFresh(now - 5_000, now, 1_000));
});

// The trap this guard exists for: `undefined - now` is NaN, and EVERY
// comparison against NaN is false --- so a naive `elapsed > tolerance` check
// would return false and let a delivery with NO timestamp through as fresh.
// The guard is proven by making it fire.
Deno.test('isFresh rejects an absent or non-numeric timestamp rather than letting NaN pass', () => {
  const now = 1_754_700_000_000;
  assert.ok(!isFresh(undefined, now), 'absent');
  assert.ok(!isFresh(null, now), 'null');
  assert.ok(!isFresh('1754700000000', now), 'string, even a numeric-looking one');
  assert.ok(!isFresh(NaN, now), 'NaN itself');
  assert.ok(!isFresh(Infinity, now), 'Infinity');
  assert.ok(!isFresh({}, now), 'object');
});
