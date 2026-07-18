// T032: unit tests for validation.ts, the pure request-body validation used
// by index.ts. Run with `deno test supabase/functions/checkin/`.
import assert from 'node:assert/strict';
import { isValidUuid, validateCheckinRequest } from './validation.ts';

const VALID_SESSION_ID = '123e4567-e89b-12d3-a456-426614174000';

Deno.test('isValidUuid matches only well-formed uuids', () => {
  assert.ok(isValidUuid(VALID_SESSION_ID));
  assert.ok(isValidUuid(VALID_SESSION_ID.toUpperCase()));
  assert.ok(!isValidUuid('not-a-uuid'));
  assert.ok(!isValidUuid(''));
  assert.ok(!isValidUuid(123));
});

Deno.test('validateCheckinRequest rejects a non-object body', () => {
  const result = validateCheckinRequest('not an object');
  assert.ok(!result.ok);
  if (!result.ok) assert.equal(result.error.code, 'INVALID_BODY');
});

Deno.test('validateCheckinRequest rejects null and array bodies', () => {
  const nullResult = validateCheckinRequest(null);
  assert.ok(!nullResult.ok);
  if (!nullResult.ok) assert.equal(nullResult.error.code, 'INVALID_BODY');

  const arrayResult = validateCheckinRequest([1, 2, 3]);
  assert.ok(!arrayResult.ok);
  if (!arrayResult.ok) assert.equal(arrayResult.error.code, 'INVALID_BODY');
});

Deno.test('validateCheckinRequest rejects a missing session_id', () => {
  const result = validateCheckinRequest({ token: 'abc' });
  assert.ok(!result.ok);
  if (!result.ok) assert.equal(result.error.code, 'MISSING_SESSION_ID');
});

Deno.test('validateCheckinRequest rejects a malformed session_id', () => {
  const result = validateCheckinRequest({ session_id: 'not-a-uuid', token: 'abc' });
  assert.ok(!result.ok);
  if (!result.ok) assert.equal(result.error.code, 'INVALID_SESSION_ID');
});

Deno.test('validateCheckinRequest rejects neither token nor code present', () => {
  const result = validateCheckinRequest({ session_id: VALID_SESSION_ID });
  assert.ok(!result.ok);
  if (!result.ok) assert.equal(result.error.code, 'MISSING_CREDENTIAL');
});

Deno.test('validateCheckinRequest rejects both token AND code present', () => {
  const result = validateCheckinRequest({ session_id: VALID_SESSION_ID, token: 'abc', code: 'XYZ123' });
  assert.ok(!result.ok);
  if (!result.ok) assert.equal(result.error.code, 'AMBIGUOUS_CREDENTIAL');
});

Deno.test('validateCheckinRequest rejects an empty-string token with no code', () => {
  const result = validateCheckinRequest({ session_id: VALID_SESSION_ID, token: '' });
  assert.ok(!result.ok);
  if (!result.ok) assert.equal(result.error.code, 'MISSING_CREDENTIAL');
});

Deno.test('validateCheckinRequest accepts a valid token-only request', () => {
  const result = validateCheckinRequest({ session_id: VALID_SESSION_ID, token: 'deadbeef' });
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.value.session_id, VALID_SESSION_ID);
    assert.equal(result.value.token, 'deadbeef');
    assert.equal(result.value.code, null);
  }
});

Deno.test('validateCheckinRequest accepts a valid code-only request', () => {
  const result = validateCheckinRequest({ session_id: VALID_SESSION_ID, code: 'AB23CD' });
  assert.ok(result.ok);
  if (result.ok) {
    assert.equal(result.value.session_id, VALID_SESSION_ID);
    assert.equal(result.value.token, null);
    assert.equal(result.value.code, 'AB23CD');
  }
});
