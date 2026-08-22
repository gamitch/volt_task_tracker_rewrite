// GAM-450: tests for `buildOverlapIndex` (`overlap.ts`), the single pure
// computation behind the three overlap-badge sites. All names/ids below are
// fabricated (item 6). Every `startsAt`/`endsAt` is a UTC ISO instant; every
// `sessionDate` is the stored Chicago calendar date string the function must
// bucket on -- see the packet's day-bucketing trap: evening sessions
// routinely end on the *next* UTC date, so bucketing must never re-derive a
// day from `startsAt`/`endsAt`.
import { describe, expect, it } from 'vitest';
import { buildOverlapIndex, type OverlapSessionInput } from './overlap';

function session(
  overrides: Partial<OverlapSessionInput> & Pick<OverlapSessionInput, 'sessionId' | 'eventId'>,
): OverlapSessionInput {
  return {
    sessionDate: '2026-07-22',
    startsAt: '2026-07-22T21:00:00.000Z',
    endsAt: '2026-07-22T23:00:00.000Z',
    status: 'scheduled',
    ...overrides,
  };
}

describe('buildOverlapIndex', () => {
  it('1. genuine overlap across two series is reported in both directions', () => {
    const fizzBuzzFour = session({
      sessionId: 'session-fizzbuzz-four',
      eventId: 'event-fizzbuzz-league',
      sessionDate: '2026-07-22',
      startsAt: '2026-07-22T21:00:00.000Z', // 4 PM Chicago
      endsAt: '2026-07-22T23:00:00.000Z', // 6 PM Chicago
    });
    const quokkaFive = session({
      sessionId: 'session-quokka-five',
      eventId: 'event-quokka-club',
      sessionDate: '2026-07-22',
      startsAt: '2026-07-22T22:00:00.000Z', // 5 PM Chicago
      endsAt: '2026-07-23T00:00:00.000Z', // 7 PM Chicago
    });

    const index = buildOverlapIndex([fizzBuzzFour, quokkaFive]);

    expect(index.get('session-fizzbuzz-four')).toEqual([
      { sessionId: 'session-quokka-five', eventId: 'event-quokka-club' },
    ]);
    expect(index.get('session-quokka-five')).toEqual([
      { sessionId: 'session-fizzbuzz-four', eventId: 'event-fizzbuzz-league' },
    ]);
  });

  it('2. touching intervals (4-6 PM then 6-8 PM) do not overlap, in either input order', () => {
    const fourToSix = session({
      sessionId: 'session-touching-four-to-six',
      eventId: 'event-alpha-league',
      sessionDate: '2026-07-22',
      startsAt: '2026-07-22T21:00:00.000Z', // 4 PM Chicago
      endsAt: '2026-07-22T23:00:00.000Z', // 6 PM Chicago
    });
    const sixToEight = session({
      sessionId: 'session-touching-six-to-eight',
      eventId: 'event-beta-league',
      sessionDate: '2026-07-22',
      startsAt: '2026-07-22T23:00:00.000Z', // 6 PM Chicago
      endsAt: '2026-07-23T01:00:00.000Z', // 8 PM Chicago
    });

    const forward = buildOverlapIndex([fourToSix, sixToEight]);
    expect(forward.has('session-touching-four-to-six')).toBe(false);
    expect(forward.has('session-touching-six-to-eight')).toBe(false);

    const reversed = buildOverlapIndex([sixToEight, fourToSix]);
    expect(reversed.has('session-touching-four-to-six')).toBe(false);
    expect(reversed.has('session-touching-six-to-eight')).toBe(false);
  });

  it('3. same-series sessions at identical times do not overlap', () => {
    const original = session({
      sessionId: 'session-weekly-original',
      eventId: 'event-weekly-standup',
      sessionDate: '2026-07-22',
      startsAt: '2026-07-22T21:00:00.000Z',
      endsAt: '2026-07-22T23:00:00.000Z',
    });
    const duplicate = session({
      sessionId: 'session-weekly-duplicate',
      eventId: 'event-weekly-standup',
      sessionDate: '2026-07-22',
      startsAt: '2026-07-22T21:00:00.000Z',
      endsAt: '2026-07-22T23:00:00.000Z',
    });

    const index = buildOverlapIndex([original, duplicate]);
    expect(index.size).toBe(0);
  });

  it('4. canceled sessions never overlap anything, in both directions', () => {
    const canceledSession = session({
      sessionId: 'session-canceled-otter',
      eventId: 'event-otter-league',
      sessionDate: '2026-07-22',
      startsAt: '2026-07-22T21:00:00.000Z',
      endsAt: '2026-07-22T23:00:00.000Z',
      status: 'canceled',
    });
    const survivingSession = session({
      sessionId: 'session-active-heron',
      eventId: 'event-heron-club',
      sessionDate: '2026-07-22',
      startsAt: '2026-07-22T21:30:00.000Z',
      endsAt: '2026-07-22T23:30:00.000Z',
      status: 'scheduled',
    });

    const index = buildOverlapIndex([canceledSession, survivingSession]);
    expect(index.has('session-canceled-otter')).toBe(false);
    expect(index.get('session-active-heron') ?? []).toEqual([]);
  });

  it('5a. sessions sharing a sessionDate whose endsAt lands on the next UTC day still overlap', () => {
    const buildSession = session({
      sessionId: 'session-crossmidnight-build',
      eventId: 'event-weekly-build',
      sessionDate: '2026-07-22',
      startsAt: '2026-07-22T23:00:00.000Z', // 6 PM Chicago
      endsAt: '2026-07-23T01:00:00.000Z', // 8 PM Chicago -- next UTC day
    });
    const ravensSession = session({
      sessionId: 'session-crossmidnight-ravens',
      eventId: 'event-ravens-strategy',
      sessionDate: '2026-07-22',
      startsAt: '2026-07-22T23:30:00.000Z', // 6:30 PM Chicago
      endsAt: '2026-07-23T01:30:00.000Z', // 8:30 PM Chicago -- next UTC day
    });

    const index = buildOverlapIndex([buildSession, ravensSession]);
    expect(index.get('session-crossmidnight-build')).toEqual([
      { sessionId: 'session-crossmidnight-ravens', eventId: 'event-ravens-strategy' },
    ]);
    expect(index.get('session-crossmidnight-ravens')).toEqual([
      { sessionId: 'session-crossmidnight-build', eventId: 'event-weekly-build' },
    ]);
  });

  it('5b. different sessionDates that would look same-day under a naive UTC derivation do not overlap', () => {
    // Both instants fall on UTC calendar date 2026-07-23, and the raw
    // epoch-ms intervals genuinely intersect -- but the two stored
    // `sessionDate`s (the real Chicago calendar days) differ, so the
    // function must not report an overlap.
    const lateNightSession = session({
      sessionId: 'session-latenight-panther',
      eventId: 'event-panther-league',
      sessionDate: '2026-07-22', // 9-11 PM Chicago on July 22
      startsAt: '2026-07-23T02:00:00.000Z',
      endsAt: '2026-07-23T04:00:00.000Z',
    });
    const nextDaySession = session({
      sessionId: 'session-nextday-falcon',
      eventId: 'event-falcon-league',
      sessionDate: '2026-07-23', // stored as the following Chicago day
      startsAt: '2026-07-23T03:00:00.000Z',
      endsAt: '2026-07-23T05:00:00.000Z',
    });

    const index = buildOverlapIndex([lateNightSession, nextDaySession]);
    expect(index.has('session-latenight-panther')).toBe(false);
    expect(index.has('session-nextday-falcon')).toBe(false);
  });

  it('6. three-way overlap: each session lists the other two', () => {
    const willow = session({
      sessionId: 'session-willow',
      eventId: 'event-willow-league',
      sessionDate: '2026-07-22',
      startsAt: '2026-07-22T21:00:00.000Z', // 4 PM
      endsAt: '2026-07-22T23:30:00.000Z', // 6:30 PM
    });
    const cedar = session({
      sessionId: 'session-cedar',
      eventId: 'event-cedar-league',
      sessionDate: '2026-07-22',
      startsAt: '2026-07-22T21:30:00.000Z', // 4:30 PM
      endsAt: '2026-07-23T00:00:00.000Z', // 7 PM
    });
    const maple = session({
      sessionId: 'session-maple',
      eventId: 'event-maple-league',
      sessionDate: '2026-07-22',
      startsAt: '2026-07-22T22:00:00.000Z', // 5 PM
      endsAt: '2026-07-23T00:30:00.000Z', // 7:30 PM
    });

    const index = buildOverlapIndex([willow, cedar, maple]);

    expect(index.get('session-willow')).toEqual([
      { sessionId: 'session-cedar', eventId: 'event-cedar-league' },
      { sessionId: 'session-maple', eventId: 'event-maple-league' },
    ]);
    expect(index.get('session-cedar')).toEqual([
      { sessionId: 'session-willow', eventId: 'event-willow-league' },
      { sessionId: 'session-maple', eventId: 'event-maple-league' },
    ]);
    expect(index.get('session-maple')).toEqual([
      { sessionId: 'session-willow', eventId: 'event-willow-league' },
      { sessionId: 'session-cedar', eventId: 'event-cedar-league' },
    ]);
  });

  it('7. is deterministic and pure: same input twice yields equal output, input untouched', () => {
    const inputA = session({
      sessionId: 'session-determinism-a',
      eventId: 'event-determinism-league-a',
      sessionDate: '2026-07-22',
      startsAt: '2026-07-22T21:00:00.000Z',
      endsAt: '2026-07-22T23:30:00.000Z',
    });
    const inputB = session({
      sessionId: 'session-determinism-b',
      eventId: 'event-determinism-league-b',
      sessionDate: '2026-07-22',
      startsAt: '2026-07-22T22:00:00.000Z',
      endsAt: '2026-07-23T00:00:00.000Z',
    });
    Object.freeze(inputA);
    Object.freeze(inputB);
    const sessions: readonly OverlapSessionInput[] = Object.freeze([inputA, inputB]);

    const firstCall = buildOverlapIndex(sessions);
    const secondCall = buildOverlapIndex(sessions);

    expect(firstCall).toEqual(secondCall);
    expect(sessions).toEqual([inputA, inputB]);
    expect(sessions.length).toBe(2);
  });
});
