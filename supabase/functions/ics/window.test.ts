// T047: unit tests for window.ts. Run with `deno test supabase/functions/ics/`.
import assert from 'node:assert/strict';
import { computeWindowStart } from './window.ts';

Deno.test('computeWindowStart: returns exactly 30 days (in ms) before "now"', () => {
  const now = new Date('2026-07-19T12:00:00.000Z');
  const start = computeWindowStart(now);
  assert.equal(start.toISOString(), '2026-06-19T12:00:00.000Z');
});

Deno.test('computeWindowStart: is relative to the passed-in time, not a fixed date', () => {
  const now = new Date('2027-01-01T00:00:00.000Z');
  const start = computeWindowStart(now);
  assert.equal(start.toISOString(), '2026-12-02T00:00:00.000Z');
});
