/**
 * T605 §7 test 10: direct unit tests for `EditMeetingSessionDialog.tsx`'s
 * pure, exported validate/build functions -- no React, no fake
 * `SupabaseClient` needed, same shape `resolveAttendanceWriteMethod`
 * (`loaders/attendance.ts:287-291`) and `computeMeetingSeriesReconcilePlan`
 * already established.
 *
 * Per this task's Allowed Files, a colocated test file is an explicitly
 * sanctioned addition (same precedent `MeetingsList.test.tsx`/T030,
 * `ScheduleMeetingsDialog.test.tsx`/T031 already established for this class
 * of task).
 */
import { describe, expect, it } from 'vitest';
import {
  chicagoWallTimeToUtcIso,
  computeMeetingSessionEditPayload,
  sessionDateCollidesWithSibling,
} from './EditMeetingSessionDialog';

describe('chicagoWallTimeToUtcIso (packet §6.3 -- local reimplementation, parity proof)', () => {
  it('converts a summer (CDT, UTC-5) wall-clock time correctly -- same case ScheduleMeetingsDialog.test.tsx proves for its own copy', () => {
    expect(chicagoWallTimeToUtcIso('2026-07-22', '18:00')).toBe('2026-07-22T23:00:00.000Z');
  });

  it('converts a winter (CST, UTC-6) wall-clock time correctly -- same case ScheduleMeetingsDialog.test.tsx proves for its own copy', () => {
    expect(chicagoWallTimeToUtcIso('2026-01-15', '18:00')).toBe('2026-01-16T00:00:00.000Z');
  });
});

describe('computeMeetingSessionEditPayload (packet §6.5)', () => {
  const NOW = new Date('2026-08-06T12:00:00.000Z');

  it("incomplete inputs -> null (mirrors buildEventSessionsPayload's own shape, singular)", () => {
    expect(
      computeMeetingSessionEditPayload('sess-1', undefined, '18:00', '20:00', '', NOW),
    ).toBeNull();
    expect(
      computeMeetingSessionEditPayload('sess-1', '2026-08-13', undefined, '20:00', '', NOW),
    ).toBeNull();
    expect(
      computeMeetingSessionEditPayload('sess-1', '2026-08-13', '18:00', undefined, '', NOW),
    ).toBeNull();
  });

  it("a candidate startsAt that is not strictly after `now` -> null (B1 fix -- the ONLY enforcement point for a coach's own bad new value)", () => {
    // '2026-08-05' 18:00 Chicago -> before NOW ('2026-08-06T12:00:00.000Z').
    expect(
      computeMeetingSessionEditPayload('sess-1', '2026-08-05', '18:00', '20:00', '', NOW),
    ).toBeNull();
    // Exactly equal to `now` is also rejected (strict `>`, not `>=`) --
    // matches `isMeetingSessionReconcilable`'s own strict boundary.
    const exactlyNow = new Date(chicagoWallTimeToUtcIso('2026-08-06', '07:00'));
    expect(exactlyNow.getTime()).toBe(NOW.getTime());
    expect(
      computeMeetingSessionEditPayload('sess-1', '2026-08-06', '07:00', '09:00', '', NOW),
    ).toBeNull();
  });

  it('an end time at or before the computed start time -> null (m6 fix)', () => {
    expect(
      computeMeetingSessionEditPayload('sess-1', '2026-08-13', '18:00', '18:00', '', NOW),
    ).toBeNull();
    expect(
      computeMeetingSessionEditPayload('sess-1', '2026-08-13', '18:00', '17:00', '', NOW),
    ).toBeNull();
  });

  it('a genuinely valid future, well-ordered candidate returns the real payload, notes carried verbatim', () => {
    const payload = computeMeetingSessionEditPayload(
      'sess-1',
      '2026-08-13',
      '18:00',
      '20:00',
      'Bring extra batteries.',
      NOW,
    );
    expect(payload).toEqual({
      sessionId: 'sess-1',
      sessionDate: '2026-08-13',
      startsAt: chicagoWallTimeToUtcIso('2026-08-13', '18:00'),
      endsAt: chicagoWallTimeToUtcIso('2026-08-13', '20:00'),
      notes: 'Bring extra batteries.',
    });
  });
});

describe('sessionDateCollidesWithSibling (packet §6.5, §3.5)', () => {
  it('true when the candidate date matches an existing sibling date, any status', () => {
    expect(sessionDateCollidesWithSibling('2026-08-13', ['2026-08-06', '2026-08-13'])).toBe(true);
  });

  it('false when the candidate date matches no existing sibling date', () => {
    expect(sessionDateCollidesWithSibling('2026-08-20', ['2026-08-06', '2026-08-13'])).toBe(false);
  });

  it('false against an empty sibling list', () => {
    expect(sessionDateCollidesWithSibling('2026-08-20', [])).toBe(false);
  });
});
