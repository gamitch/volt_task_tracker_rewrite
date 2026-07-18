// T017: unit tests for validation.ts, the pure request-validation logic used
// by index.ts. Run with `deno test supabase/functions/send-invite/`.
//
// These tests cover everything that can genuinely be verified without a live
// Supabase project (auth, Postgres, inviteUserByEmail) -- see the T017 worker
// packet's "External Blocker" section for what could NOT be verified here and
// why.

// Uses Deno's built-in Node compatibility layer (`node:assert`) rather than a
// `jsr:`/`deno.land` import so this test file has zero external network
// dependency -- it type-checks and runs fully offline.
import assert from 'node:assert/strict';
import { computeExpiresAt, isValidEmail, isValidRole, isValidUuid, validateInviteRequest } from './validation.ts';

function assertFalse(value: unknown, msg?: string): void {
  assert.equal(Boolean(value), false, msg);
}
function assertEquals<T>(actual: T, expected: T, msg?: string): void {
  assert.deepStrictEqual(actual, expected, msg);
}

Deno.test('isValidRole accepts only the role_enum vocabulary', () => {
  assert(isValidRole('admin'));
  assert(isValidRole('coach'));
  assert(isValidRole('student'));
  assert(isValidRole('parent'));
  assertFalse(isValidRole('superadmin'));
  assertFalse(isValidRole(''));
  assertFalse(isValidRole(undefined));
  assertFalse(isValidRole(123));
});

Deno.test('isValidEmail rejects obviously malformed input', () => {
  assert(isValidEmail('coach@voltfrc.org'));
  assert(isValidEmail('  padded@voltfrc.org  '));
  assertFalse(isValidEmail('not-an-email'));
  assertFalse(isValidEmail(''));
  assertFalse(isValidEmail(undefined));
  assertFalse(isValidEmail(null));
});

Deno.test('isValidUuid matches only well-formed uuids', () => {
  assert(isValidUuid('123e4567-e89b-12d3-a456-426614174000'));
  assert(isValidUuid('123E4567-E89B-12D3-A456-426614174000'));
  assertFalse(isValidUuid('not-a-uuid'));
  assertFalse(isValidUuid(''));
  assertFalse(isValidUuid('123e4567e89b12d3a456426614174000'));
});

Deno.test('computeExpiresAt returns exactly 14 days from the given instant (AUTH-06)', () => {
  const now = new Date('2026-07-18T00:00:00.000Z');
  assertEquals(computeExpiresAt(now), '2026-08-01T00:00:00.000Z');
});

Deno.test('validateInviteRequest rejects a non-object body', () => {
  const result = validateInviteRequest('not an object');
  assert(!result.ok);
  if (!result.ok) assertEquals(result.error.code, 'INVALID_BODY');
});

Deno.test('validateInviteRequest rejects null and array bodies', () => {
  const nullResult = validateInviteRequest(null);
  assert(!nullResult.ok);
  if (!nullResult.ok) assertEquals(nullResult.error.code, 'INVALID_BODY');

  const arrayResult = validateInviteRequest([1, 2, 3]);
  assert(!arrayResult.ok);
  if (!arrayResult.ok) assertEquals(arrayResult.error.code, 'INVALID_BODY');
});

Deno.test('validateInviteRequest rejects a missing email', () => {
  const result = validateInviteRequest({ role: 'coach' });
  assert(!result.ok);
  if (!result.ok) assertEquals(result.error.code, 'MISSING_EMAIL');
});

Deno.test('validateInviteRequest rejects an invalid email', () => {
  const result = validateInviteRequest({ email: 'nope', role: 'coach' });
  assert(!result.ok);
  if (!result.ok) assertEquals(result.error.code, 'INVALID_EMAIL');
});

Deno.test('validateInviteRequest rejects a missing role', () => {
  const result = validateInviteRequest({ email: 'a@b.com' });
  assert(!result.ok);
  if (!result.ok) assertEquals(result.error.code, 'MISSING_ROLE');
});

Deno.test('validateInviteRequest rejects an unrecognized role (not a free-text field)', () => {
  const result = validateInviteRequest({ email: 'a@b.com', role: 'owner' });
  assert(!result.ok);
  if (!result.ok) assertEquals(result.error.code, 'INVALID_ROLE');
});

Deno.test('validateInviteRequest requires student_id for a student invite', () => {
  const result = validateInviteRequest({ email: 'a@b.com', role: 'student' });
  assert(!result.ok);
  if (!result.ok) assertEquals(result.error.code, 'MISSING_STUDENT_ID');
});

Deno.test('validateInviteRequest requires student_id for a parent invite', () => {
  const result = validateInviteRequest({ email: 'a@b.com', role: 'parent' });
  assert(!result.ok);
  if (!result.ok) assertEquals(result.error.code, 'MISSING_STUDENT_ID');
});

Deno.test('validateInviteRequest rejects a malformed student_id', () => {
  const result = validateInviteRequest({ email: 'a@b.com', role: 'student', student_id: 'nope' });
  assert(!result.ok);
  if (!result.ok) assertEquals(result.error.code, 'INVALID_STUDENT_ID');
});

Deno.test('validateInviteRequest accepts a well-formed student invite', () => {
  const result = validateInviteRequest({
    email: 'student@example.com',
    role: 'student',
    student_id: '123e4567-e89b-12d3-a456-426614174000',
  });
  assert(result.ok);
  if (result.ok) {
    assertEquals(result.value, {
      email: 'student@example.com',
      role: 'student',
      student_id: '123e4567-e89b-12d3-a456-426614174000',
    });
  }
});

Deno.test('validateInviteRequest accepts a well-formed parent invite', () => {
  const result = validateInviteRequest({
    email: 'parent@example.com',
    role: 'parent',
    student_id: '123e4567-e89b-12d3-a456-426614174000',
  });
  assert(result.ok);
  if (result.ok) assertEquals(result.value.role, 'parent');
});

Deno.test('validateInviteRequest rejects a student_id on an admin invite', () => {
  const result = validateInviteRequest({
    email: 'admin@example.com',
    role: 'admin',
    student_id: '123e4567-e89b-12d3-a456-426614174000',
  });
  assert(!result.ok);
  if (!result.ok) assertEquals(result.error.code, 'UNEXPECTED_STUDENT_ID');
});

Deno.test('validateInviteRequest rejects a student_id on a coach invite', () => {
  const result = validateInviteRequest({
    email: 'coach@example.com',
    role: 'coach',
    student_id: '123e4567-e89b-12d3-a456-426614174000',
  });
  assert(!result.ok);
  if (!result.ok) assertEquals(result.error.code, 'UNEXPECTED_STUDENT_ID');
});

Deno.test('validateInviteRequest accepts an admin invite with no student_id', () => {
  const result = validateInviteRequest({ email: 'admin@example.com', role: 'admin' });
  assert(result.ok);
  if (result.ok) assertEquals(result.value.student_id, null);
});

Deno.test('validateInviteRequest accepts a coach invite with no student_id', () => {
  const result = validateInviteRequest({ email: 'coach@example.com', role: 'coach' });
  assert(result.ok);
  if (result.ok) assertEquals(result.value.student_id, null);
});

Deno.test('validateInviteRequest trims whitespace from email', () => {
  const result = validateInviteRequest({ email: '  admin@example.com  ', role: 'admin' });
  assert(result.ok);
  if (result.ok) assertEquals(result.value.email, 'admin@example.com');
});

Deno.test('validateInviteRequest treats an empty-string student_id as absent (admin/coach case)', () => {
  const result = validateInviteRequest({ email: 'admin@example.com', role: 'admin', student_id: '' });
  assert(result.ok);
  if (result.ok) assertEquals(result.value.student_id, null);
});
