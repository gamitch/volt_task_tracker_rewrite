// T032: unit tests for grace.ts -- MTG-08 / OQ-3's 10-minute grace period,
// with explicit boundary coverage at exactly 10:00 and one second past.
import assert from 'node:assert/strict';
import { computeAutoStatus, LATE_GRACE_MIN } from './grace.ts';

Deno.test('LATE_GRACE_MIN is the documented 10-minute constant', () => {
  assert.equal(LATE_GRACE_MIN, 10);
});

Deno.test('check-in well before start is present', () => {
  const startsAt = new Date('2026-07-18T18:00:00.000Z');
  const checkInAt = new Date('2026-07-18T17:50:00.000Z');
  assert.equal(computeAutoStatus(startsAt, checkInAt), 'present');
});

Deno.test('check-in exactly at start is present', () => {
  const startsAt = new Date('2026-07-18T18:00:00.000Z');
  assert.equal(computeAutoStatus(startsAt, new Date(startsAt)), 'present');
});

Deno.test('check-in exactly at the 10:00 boundary is present (inclusive)', () => {
  const startsAt = new Date('2026-07-18T18:00:00.000Z');
  const checkInAt = new Date('2026-07-18T18:10:00.000Z'); // exactly +10:00
  assert.equal(computeAutoStatus(startsAt, checkInAt), 'present');
});

Deno.test('check-in one second past the 10:00 boundary is late', () => {
  const startsAt = new Date('2026-07-18T18:00:00.000Z');
  const checkInAt = new Date('2026-07-18T18:10:01.000Z'); // +10:00:01
  assert.equal(computeAutoStatus(startsAt, checkInAt), 'late');
});

Deno.test('check-in one millisecond past the 10:00 boundary is late', () => {
  const startsAt = new Date('2026-07-18T18:00:00.000Z');
  const checkInAt = new Date('2026-07-18T18:10:00.001Z');
  assert.equal(computeAutoStatus(startsAt, checkInAt), 'late');
});

Deno.test('check-in one millisecond before the 10:00 boundary is present', () => {
  const startsAt = new Date('2026-07-18T18:00:00.000Z');
  const checkInAt = new Date('2026-07-18T18:09:59.999Z');
  assert.equal(computeAutoStatus(startsAt, checkInAt), 'present');
});

Deno.test('check-in well after start is late', () => {
  const startsAt = new Date('2026-07-18T18:00:00.000Z');
  const checkInAt = new Date('2026-07-18T18:45:00.000Z');
  assert.equal(computeAutoStatus(startsAt, checkInAt), 'late');
});
