// T103: unit tests for `checkin-token/index.ts`'s pure pieces --
// `isValidUuid`, `validateCheckinTokenRequest`, `computeBucketExpiresAt`.
// Run with `deno test supabase/functions/checkin-token/`.
//
// Importing `index.ts` here does NOT trip Deno's resource sanitizer despite
// that file's own top-level `Deno.serve(...)` call, because that call is
// guarded by `if (import.meta.main)` (false when reached via `import`, only
// true when the file is run directly) -- see `index.ts`'s own module doc
// "Testability" section for the empirical verification behind this.
import assert from 'node:assert/strict';
import { computeBucketExpiresAt, isValidUuid, validateCheckinTokenRequest } from './index.ts';

const VALID_SESSION_ID = '123e4567-e89b-12d3-a456-426614174000';

Deno.test('isValidUuid matches only well-formed uuids', () => {
  assert.ok(isValidUuid(VALID_SESSION_ID));
  assert.ok(isValidUuid(VALID_SESSION_ID.toUpperCase()));
  assert.ok(!isValidUuid('not-a-uuid'));
  assert.ok(!isValidUuid(''));
  assert.ok(!isValidUuid(123));
  assert.ok(!isValidUuid(undefined));
});

Deno.test('validateCheckinTokenRequest rejects a non-object body', () => {
  const result = validateCheckinTokenRequest('not an object');
  assert.ok(!result.ok);
  if (!result.ok) assert.equal(result.error.code, 'INVALID_BODY');
});

Deno.test('validateCheckinTokenRequest rejects null and array bodies', () => {
  const nullResult = validateCheckinTokenRequest(null);
  assert.ok(!nullResult.ok);
  if (!nullResult.ok) assert.equal(nullResult.error.code, 'INVALID_BODY');

  const arrayResult = validateCheckinTokenRequest([1, 2, 3]);
  assert.ok(!arrayResult.ok);
  if (!arrayResult.ok) assert.equal(arrayResult.error.code, 'INVALID_BODY');
});

Deno.test('validateCheckinTokenRequest rejects a missing session_id', () => {
  const result = validateCheckinTokenRequest({});
  assert.ok(!result.ok);
  if (!result.ok) assert.equal(result.error.code, 'MISSING_SESSION_ID');
});

Deno.test('validateCheckinTokenRequest rejects an empty-string session_id', () => {
  const result = validateCheckinTokenRequest({ session_id: '' });
  assert.ok(!result.ok);
  if (!result.ok) assert.equal(result.error.code, 'MISSING_SESSION_ID');
});

Deno.test('validateCheckinTokenRequest rejects a malformed session_id', () => {
  const result = validateCheckinTokenRequest({ session_id: 'not-a-uuid' });
  assert.ok(!result.ok);
  if (!result.ok) assert.equal(result.error.code, 'INVALID_SESSION_ID');
});

Deno.test('validateCheckinTokenRequest accepts a valid session_id', () => {
  const result = validateCheckinTokenRequest({ session_id: VALID_SESSION_ID });
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.value.session_id, VALID_SESSION_ID);
  }
});

Deno.test('validateCheckinTokenRequest ignores extra fields (never accepts a client-supplied token/code/role)', () => {
  const result = validateCheckinTokenRequest({
    session_id: VALID_SESSION_ID,
    role: 'admin',
    token: 'client-supplied-should-be-ignored',
  });
  assert.ok(result.ok);
  if (result.ok) {
    // Only `session_id` is ever pulled out of the body -- no `role`/`token`
    // field exists anywhere on `CheckinTokenRequestBody`.
    assert.deepEqual(Object.keys(result.value), ['session_id']);
  }
});

Deno.test('computeBucketExpiresAt returns the START of the NEXT 60s bucket, as an ISO string', () => {
  // bucket 0 covers unix seconds [0, 60) -- expires at unix second 60.
  assert.equal(computeBucketExpiresAt(0), '1970-01-01T00:01:00.000Z');
  // bucket 16666700 covers [16666700*60, 16666701*60) seconds.
  const bucket = 16666700;
  const expected = new Date((bucket + 1) * 60 * 1000).toISOString();
  assert.equal(computeBucketExpiresAt(bucket), expected);
});

Deno.test('computeBucketExpiresAt is deterministic for the same bucket', () => {
  assert.equal(computeBucketExpiresAt(12345), computeBucketExpiresAt(12345));
});
