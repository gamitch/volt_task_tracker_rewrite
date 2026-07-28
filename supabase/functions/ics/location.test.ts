// T047: unit tests for location.ts. Run with `deno test supabase/functions/ics/`.
import assert from 'node:assert/strict';
import { buildLocation } from './location.ts';

Deno.test('buildLocation: joins name and address when both are present and distinct', () => {
  assert.equal(buildLocation('VOLT Shop', '123 Main St, Springfield'), 'VOLT Shop, 123 Main St, Springfield');
});

Deno.test('buildLocation: returns just the name when address is an empty string', () => {
  assert.equal(buildLocation('VOLT Shop', ''), 'VOLT Shop');
});

Deno.test('buildLocation: returns just the name when address is whitespace-only', () => {
  assert.equal(buildLocation('VOLT Shop', '   '), 'VOLT Shop');
});

Deno.test('buildLocation: does not duplicate when address equals the location name', () => {
  assert.equal(buildLocation('VOLT Shop', 'VOLT Shop'), 'VOLT Shop');
});

Deno.test('buildLocation: trims surrounding whitespace on both fields', () => {
  assert.equal(buildLocation('  VOLT Shop  ', '  123 Main St  '), 'VOLT Shop, 123 Main St');
});
