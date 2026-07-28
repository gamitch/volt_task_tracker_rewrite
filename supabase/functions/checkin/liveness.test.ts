// T032: unit tests for liveness.ts -- MTG-04's time-window liveness rule
// (see the file's own header comment for the flagged manual early/late
// start schema gap this deliberately does NOT implement).
import assert from 'node:assert/strict';
import { checkSessionLiveness, LIVE_WINDOW_BEFORE_START_MIN } from './liveness.ts';

const STARTS_AT = new Date('2026-07-18T18:00:00.000Z');
const ENDS_AT = new Date('2026-07-18T20:00:00.000Z');

Deno.test('LIVE_WINDOW_BEFORE_START_MIN is the documented 15-minute constant', () => {
  assert.equal(LIVE_WINDOW_BEFORE_START_MIN, 15);
});

Deno.test('not live before the 15-minute pre-window opens', () => {
  const now = new Date('2026-07-18T17:44:59.000Z'); // 15:01 before start
  const result = checkSessionLiveness('scheduled', STARTS_AT, ENDS_AT, now);
  assert.deepEqual(result, { live: false, reason: 'not_yet_open' });
});

Deno.test('live exactly at the 15-minute pre-window boundary (inclusive)', () => {
  const now = new Date('2026-07-18T17:45:00.000Z'); // exactly -15:00
  const result = checkSessionLiveness('scheduled', STARTS_AT, ENDS_AT, now);
  assert.deepEqual(result, { live: true });
});

Deno.test('live at starts_at itself', () => {
  const result = checkSessionLiveness('scheduled', STARTS_AT, ENDS_AT, new Date(STARTS_AT));
  assert.deepEqual(result, { live: true });
});

Deno.test('live in the middle of the session', () => {
  const now = new Date('2026-07-18T19:00:00.000Z');
  const result = checkSessionLiveness('scheduled', STARTS_AT, ENDS_AT, now);
  assert.deepEqual(result, { live: true });
});

Deno.test('live exactly at ends_at (inclusive)', () => {
  const result = checkSessionLiveness('scheduled', STARTS_AT, ENDS_AT, new Date(ENDS_AT));
  assert.deepEqual(result, { live: true });
});

Deno.test('not live one second past ends_at', () => {
  const now = new Date(ENDS_AT.getTime() + 1000);
  const result = checkSessionLiveness('scheduled', STARTS_AT, ENDS_AT, now);
  assert.deepEqual(result, { live: false, reason: 'closed' });
});

Deno.test('not live when status is canceled, even during the time window', () => {
  const now = new Date('2026-07-18T19:00:00.000Z');
  const result = checkSessionLiveness('canceled', STARTS_AT, ENDS_AT, now);
  assert.deepEqual(result, { live: false, reason: 'not_scheduled' });
});

Deno.test('not live when status is completed, even during the time window', () => {
  const now = new Date('2026-07-18T19:00:00.000Z');
  const result = checkSessionLiveness('completed', STARTS_AT, ENDS_AT, now);
  assert.deepEqual(result, { live: false, reason: 'not_scheduled' });
});
