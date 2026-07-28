// T047: unit tests for token.ts. Run with `deno test supabase/functions/ics/`.
import assert from 'node:assert/strict';
import { isValidTokenFormat } from './token.ts';

const VALID = '123e4567-e89b-12d3-a456-426614174000';

Deno.test('isValidTokenFormat accepts a well-formed lowercase uuid', () => {
  assert.ok(isValidTokenFormat(VALID));
});

Deno.test('isValidTokenFormat accepts a well-formed uppercase uuid', () => {
  assert.ok(isValidTokenFormat(VALID.toUpperCase()));
});

Deno.test('isValidTokenFormat rejects an empty string', () => {
  assert.ok(!isValidTokenFormat(''));
});

Deno.test('isValidTokenFormat rejects a non-uuid string', () => {
  assert.ok(!isValidTokenFormat('not-a-token'));
});

Deno.test('isValidTokenFormat rejects a uuid with the wrong segment lengths', () => {
  assert.ok(!isValidTokenFormat('123e4567-e89b-12d3-a456-42661417400')); // one char short
  assert.ok(!isValidTokenFormat('123e4567-e89b-12d3-a456-4266141740000')); // one char long
});

Deno.test('isValidTokenFormat rejects a uuid missing hyphens', () => {
  assert.ok(!isValidTokenFormat('123e4567e89b12d3a456426614174000'));
});

Deno.test('isValidTokenFormat rejects a uuid with a non-hex character', () => {
  assert.ok(!isValidTokenFormat('g23e4567-e89b-12d3-a456-426614174000'));
});
