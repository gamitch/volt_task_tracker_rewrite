/**
 * Tests for `studentModel.ts`'s pure builder functions -- moved verbatim
 * from `src/pages/meetings/MeetingsList.test.tsx` (GAM-444 Stage A), same
 * assertions, same test names, only the import path and file location
 * changed (GAM-444 packet criterion 2: "no assertion text changes -- import
 * paths only").
 */
import { describe, expect, it } from 'vitest';
import { buildStudentMeetingsData, partitionByStatus } from './studentModel';

// T122 (module doc #10a): reused by `buildStudentMeetingsData` below --
// `partitionByStatus` needs no shared fixture of its own.
const MULTI_SESSION_EVENT = {
  id: 'e1',
  seasonId: 's1',
  type: 'meeting' as const,
  title: 'M',
  teamIds: null,
  countsParticipation: true,
  locationName: 'Robotics Lab',
  address: '123 Main St',
};

describe('partitionByStatus', () => {
  it('splits scheduled into upcoming and completed/canceled into past, sorted', () => {
    const rows = [
      { id: 'a', status: 'completed' as const, startsAt: '2026-07-01T00:00:00.000Z' },
      { id: 'b', status: 'scheduled' as const, startsAt: '2026-07-10T00:00:00.000Z' },
      { id: 'c', status: 'scheduled' as const, startsAt: '2026-07-05T00:00:00.000Z' },
      { id: 'd', status: 'canceled' as const, startsAt: '2026-07-02T00:00:00.000Z' },
    ];
    const { upcoming, past } = partitionByStatus(rows);
    expect(upcoming.map((r) => r.id)).toEqual(['c', 'b']); // ascending
    expect(past.map((r) => r.id)).toEqual(['d', 'a']); // descending (most recent first)
  });
});

describe('buildStudentMeetingsData (constitution item 3)', () => {
  it('never computes participationPct -- copies it verbatim from the metric row', () => {
    const data = buildStudentMeetingsData(
      'stu-1',
      [{ ...MULTI_SESSION_EVENT }],
      [],
      [],
      [
        {
          studentId: 'stu-1',
          teamId: 't1',
          seasonId: 's1',
          expectedCt: 7,
          presentCt: 4,
          lateCt: 1,
          excusedCt: 0,
          participationPct: 57.1,
        },
      ],
    );
    expect(data.participation?.participationPct).toBe(57.1);
  });

  it('returns participation: null when the student has no row in the metric view', () => {
    const data = buildStudentMeetingsData(
      'stu-with-no-completed-sessions',
      [],
      [],
      [],
      [
        {
          studentId: 'other-student',
          teamId: 't1',
          seasonId: 's1',
          expectedCt: 5,
          presentCt: 5,
          lateCt: 0,
          excusedCt: 0,
          participationPct: 100,
        },
      ],
    );
    expect(data.participation).toBeNull();
  });

  it('keeps the already-loaded event location on each history row', () => {
    const data = buildStudentMeetingsData(
      'stu-1',
      [{ ...MULTI_SESSION_EVENT }],
      [
        {
          id: 'session-1',
          eventId: 'e1',
          sessionDate: '2026-08-24',
          startsAt: '2026-08-24T23:00:00Z',
          endsAt: '2026-08-25T01:00:00Z',
          status: 'scheduled',
        },
      ],
      [],
      [],
    );
    expect(data.history[0]?.locationName).toBe('Robotics Lab');
  });
});
