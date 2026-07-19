// supabase/functions/send-reminders/due_window.test.ts
//
// T051 -- real `Deno.test` proof for the due-window boundary logic (worker
// packet's own "Real test proof: ... per-template due-window boundary"
// requirement). Run with `deno test --allow-env` (no network, no database).
import assert from 'node:assert/strict';
import {
  computeDueWindowBounds,
  computeMinutesUntil,
  computeWeeklyDigestSentAtWindow,
  isDueForOffset,
  isWeeklyDigestDue,
} from './due_window.ts';

const NOW = new Date('2026-07-19T12:00:00.000Z');

Deno.test('computeMinutesUntil: positive for a future startsAt, negative for a past one', () => {
  assert.equal(computeMinutesUntil(new Date('2026-07-19T13:00:00.000Z'), NOW), 60);
  assert.equal(computeMinutesUntil(new Date('2026-07-19T11:00:00.000Z'), NOW), -60);
});

// --- event-reminder-48h (offsetHours=48) boundary behavior --------------

Deno.test('isDueForOffset (48h): exactly at the 48h lower bound is due (inclusive)', () => {
  const startsAt = new Date(NOW.getTime() + 48 * 60 * 60 * 1000);
  assert.equal(isDueForOffset(startsAt, NOW, 48), true);
});

Deno.test('isDueForOffset (48h): one minute before the 48h lower bound is NOT due', () => {
  const startsAt = new Date(NOW.getTime() + 48 * 60 * 60 * 1000 - 60 * 1000);
  assert.equal(isDueForOffset(startsAt, NOW, 48), false);
});

Deno.test('isDueForOffset (48h): 14 minutes past the lower bound (inside the 15-min window) is due', () => {
  const startsAt = new Date(NOW.getTime() + 48 * 60 * 60 * 1000 + 14 * 60 * 1000);
  assert.equal(isDueForOffset(startsAt, NOW, 48), true);
});

Deno.test('isDueForOffset (48h): exactly 15 minutes past the lower bound is NOT due (exclusive upper bound)', () => {
  const startsAt = new Date(NOW.getTime() + 48 * 60 * 60 * 1000 + 15 * 60 * 1000);
  assert.equal(isDueForOffset(startsAt, NOW, 48), false);
});

// --- event-reminder-3h / meeting-reminder-3h (offsetHours=3) same shape --

Deno.test('isDueForOffset (3h): exactly at the 3h lower bound is due (inclusive)', () => {
  const startsAt = new Date(NOW.getTime() + 3 * 60 * 60 * 1000);
  assert.equal(isDueForOffset(startsAt, NOW, 3), true);
});

Deno.test('isDueForOffset (3h): exactly 15 minutes past the lower bound is NOT due', () => {
  const startsAt = new Date(NOW.getTime() + 3 * 60 * 60 * 1000 + 15 * 60 * 1000);
  assert.equal(isDueForOffset(startsAt, NOW, 3), false);
});

Deno.test('isDueForOffset (3h): a session starting 4 hours out is not yet due', () => {
  const startsAt = new Date(NOW.getTime() + 4 * 60 * 60 * 1000);
  assert.equal(isDueForOffset(startsAt, NOW, 3), false);
});

Deno.test('isDueForOffset (3h): a session that already started is not due', () => {
  const startsAt = new Date(NOW.getTime() - 10 * 60 * 1000);
  assert.equal(isDueForOffset(startsAt, NOW, 3), false);
});

// --- computeDueWindowBounds agrees with isDueForOffset, for both offsets -

Deno.test('computeDueWindowBounds (48h): bounds agree with isDueForOffset across a spread of candidate starts_at values', () => {
  const bounds = computeDueWindowBounds(NOW, 48);
  const candidates = [-20, -1, 0, 1, 7, 14, 14.999, 15, 16, 60].map(
    (minuteOffset) => new Date(new Date(bounds.start).getTime() + minuteOffset * 60 * 1000),
  );
  for (const candidate of candidates) {
    const viaPredicate = isDueForOffset(candidate, NOW, 48);
    const viaBounds = candidate.toISOString() >= bounds.start && candidate.toISOString() < bounds.end;
    assert.equal(viaBounds, viaPredicate, `mismatch at ${candidate.toISOString()}`);
  }
});

Deno.test('computeDueWindowBounds (3h): bounds agree with isDueForOffset across a spread of candidate starts_at values', () => {
  const bounds = computeDueWindowBounds(NOW, 3);
  const candidates = [-5, 0, 5, 14, 15, 30].map(
    (minuteOffset) => new Date(new Date(bounds.start).getTime() + minuteOffset * 60 * 1000),
  );
  for (const candidate of candidates) {
    const viaPredicate = isDueForOffset(candidate, NOW, 3);
    const viaBounds = candidate.toISOString() >= bounds.start && candidate.toISOString() < bounds.end;
    assert.equal(viaBounds, viaPredicate, `mismatch at ${candidate.toISOString()}`);
  }
});

Deno.test('computeDueWindowBounds: the window is exactly windowMinutes wide', () => {
  const bounds = computeDueWindowBounds(NOW, 48, 15);
  const widthMs = new Date(bounds.end).getTime() - new Date(bounds.start).getTime();
  assert.equal(widthMs, 15 * 60 * 1000);
});

// --- weekly-digest: separate Sunday-5pm-CT check, DST-independent -------

Deno.test('isWeeklyDigestDue: true at exactly Sunday 5:00pm CT (summer, CDT = UTC-5)', () => {
  // 2026-07-19 is a Sunday (verified). CDT = UTC-5, so 17:00 CDT = 22:00 UTC.
  assert.equal(isWeeklyDigestDue(new Date('2026-07-19T22:00:00.000Z')), true);
});

Deno.test('isWeeklyDigestDue: true at Sunday 5:14pm CT (still inside the 15-min window)', () => {
  assert.equal(isWeeklyDigestDue(new Date('2026-07-19T22:14:00.000Z')), true);
});

Deno.test('isWeeklyDigestDue: false at exactly Sunday 5:15pm CT (window closed, exclusive)', () => {
  assert.equal(isWeeklyDigestDue(new Date('2026-07-19T22:15:00.000Z')), false);
});

Deno.test('isWeeklyDigestDue: false at Sunday 4:59pm CT (too early)', () => {
  assert.equal(isWeeklyDigestDue(new Date('2026-07-19T21:59:00.000Z')), false);
});

Deno.test('isWeeklyDigestDue: false on a Saturday at the identical UTC clock time', () => {
  // 2026-07-18 is the Saturday immediately before the Sunday above.
  assert.equal(isWeeklyDigestDue(new Date('2026-07-18T22:00:00.000Z')), false);
});

Deno.test('isWeeklyDigestDue: true at Sunday 5:00pm CT in winter (CST = UTC-6) -- proves this is not hardcoded to a fixed UTC offset', () => {
  // 2026-01-04 is a Sunday (verified). CST = UTC-6, so 17:00 CST = 23:00 UTC
  // -- a DIFFERENT UTC hour than the summer case above, which is exactly
  // the point: a naive fixed-offset implementation would get one of these
  // two cases wrong.
  assert.equal(isWeeklyDigestDue(new Date('2026-01-04T23:00:00.000Z')), true);
  assert.equal(isWeeklyDigestDue(new Date('2026-01-04T22:00:00.000Z')), false);
});

Deno.test('computeWeeklyDigestSentAtWindow: returns the [17:00, 17:15) CT window in real UTC instants (summer)', () => {
  const bounds = computeWeeklyDigestSentAtWindow(new Date('2026-07-19T22:07:00.000Z'));
  assert.equal(bounds.start, '2026-07-19T22:00:00.000Z');
  assert.equal(bounds.end, '2026-07-19T22:15:00.000Z');
});

Deno.test('computeWeeklyDigestSentAtWindow: returns the [17:00, 17:15) CT window in real UTC instants (winter)', () => {
  const bounds = computeWeeklyDigestSentAtWindow(new Date('2026-01-04T23:11:30.500Z'));
  assert.equal(bounds.start, '2026-01-04T23:00:00.000Z');
  assert.equal(bounds.end, '2026-01-04T23:15:00.000Z');
});

Deno.test('computeWeeklyDigestSentAtWindow: the same window is returned for two different instants inside it (retry/overlap case)', () => {
  const first = computeWeeklyDigestSentAtWindow(new Date('2026-07-19T22:01:00.000Z'));
  const second = computeWeeklyDigestSentAtWindow(new Date('2026-07-19T22:09:30.000Z'));
  assert.deepEqual(first, second);
});
