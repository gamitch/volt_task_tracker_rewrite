// @vitest-environment jsdom
/**
 * T037: tests for `StudentMeetingView.tsx`. T100 (ED-1 Packet P9) adds real
 * `loaders/checkin.ts` seam-level tests (stubbed `SupabaseClient`, same DI
 * pattern `MeetingsList.test.tsx`'s own T096 loader-level tests already
 * established -- that module has no dedicated test file of its own, per this
 * task's own Allowed Files) plus real `resolveStudentId`/`useAuth()`
 * resolution-flow tests for `variant="own"`, mirroring
 * `MeetingsList.test.tsx`'s own T096 `resolveStudentId` test shape exactly.
 *
 * Per this task's Allowed Files (packet explicitly permits a colocated
 * `StudentMeetingView.test.tsx` "per established precedent") this is a
 * deliberate, disclosed addition -- the same class of addition
 * `MeetingsList.test.tsx` (T030) and `CheckinResult.test.tsx` (T035) already
 * made in this same directory tree, existing to produce the DOM-text/
 * data-attribute proof this task's own packet requires in "Required Worker
 * Output" (last-5/fewer-than-5 boundary logic, DES-05 color mapping for all
 * four attendance statuses, plural linked-student handling).
 *
 * No `@testing-library/react` is installed in this repo -- these tests use
 * the same raw `createRoot`/`act` pattern `MeetingsList.test.tsx` already
 * established.
 *
 * T120 (T116 checker-verified consumer-risk finding #3, `loaders/checkin.ts`
 * Trap #4): `queryParticipationForStudent` no longer `.limit(1)`s, and
 * `aggregateParticipationForStudent` is new -- the existing
 * `loadConsistencyStripData` seam test's participation mock is updated below
 * to drop the `.limit(...)` call from its stub chain (matches the loader's
 * new query shape), and new dual-member-specific tests are added for both
 * the loader seam and `aggregateParticipationForStudent` directly.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, type AuthUser } from '../../app/guards';
import {
  aggregateParticipationForStudent,
  makeLoadConsistencyStripData,
  makeLoadLinkedStudents,
} from '../../lib/supabase/loaders/checkin';
import { LoginAs } from '../../test-utils/authHarness';
import {
  buildConsistencyStripData,
  ConsistencyStrip,
  CONSISTENCY_STRIP_LIMIT,
  defaultLoadConsistencyStripData,
  defaultLoadLinkedStudents,
  selectLastCompletedAttendance,
  StudentMeetingView,
  type ConsistencyAttendanceRecord,
  type ConsistencySession,
  type ConsistencyStripData,
  type LinkedStudentSummary,
} from './StudentMeetingView';
import type { ResolveCurrentStudentIdFn } from './MeetingsList';

// ---------------------------------------------------------------------------
// Render harness -- mirrors `MeetingsList.test.tsx`.
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function render(node: ReactElement): void {
  act(() => {
    root.render(node);
  });
}

/** `astryx-statusdot`'s `data-variant` attribute (module doc #8) -- reads
 * the real rendered variant, not the source mapping table, so a bug in the
 * mapping table itself would still be caught. */
function statusDotVariants(): string[] {
  return Array.from(container.querySelectorAll('[role="img"]')).map(
    (el) => el.getAttribute('data-variant') ?? '',
  );
}

function statusDotLabels(): string[] {
  return Array.from(container.querySelectorAll('[role="img"]')).map(
    (el) => el.getAttribute('aria-label') ?? '',
  );
}

// ---------------------------------------------------------------------------
// `selectLastCompletedAttendance` -- last-5/fewer-than-5 boundary (Known
// Context/Traps #3, BLOCKER-adjacent acceptance criterion).
// ---------------------------------------------------------------------------

describe('selectLastCompletedAttendance (BEH-06 last-5 selection)', () => {
  const sessions: ConsistencySession[] = [
    {
      id: 's1',
      sessionDate: '2026-01-01',
      startsAt: '2026-01-01T00:00:00.000Z',
      status: 'completed',
    },
    {
      id: 's2',
      sessionDate: '2026-01-08',
      startsAt: '2026-01-08T00:00:00.000Z',
      status: 'completed',
    },
    {
      id: 's3',
      sessionDate: '2026-01-15',
      startsAt: '2026-01-15T00:00:00.000Z',
      status: 'completed',
    },
    {
      id: 's4',
      sessionDate: '2026-01-22',
      startsAt: '2026-01-22T00:00:00.000Z',
      status: 'completed',
    },
    {
      id: 's5-scheduled',
      sessionDate: '2026-01-29',
      startsAt: '2026-01-29T00:00:00.000Z',
      status: 'scheduled',
    },
    {
      id: 's6-canceled',
      sessionDate: '2026-02-05',
      startsAt: '2026-02-05T00:00:00.000Z',
      status: 'canceled',
    },
  ];

  it('returns fewer than 5 entries (never padded) when history is shorter than the cap', () => {
    // Exactly 4 completed sessions have attendance records for this student.
    const attendance: ConsistencyAttendanceRecord[] = [
      { sessionId: 's1', studentId: 'stu-short', status: 'present' },
      { sessionId: 's2', studentId: 'stu-short', status: 'late' },
      { sessionId: 's3', studentId: 'stu-short', status: 'excused' },
      { sessionId: 's4', studentId: 'stu-short', status: 'absent' },
    ];
    const entries = selectLastCompletedAttendance(sessions, attendance, 'stu-short');
    expect(entries).toHaveLength(4);
    expect(entries.length).toBeLessThan(CONSISTENCY_STRIP_LIMIT);
  });

  it('caps at exactly 5, most-recent-first, when history is longer than the cap', () => {
    const longSessions: ConsistencySession[] = [
      ...sessions.filter((s) => s.status === 'completed'),
      {
        id: 's5',
        sessionDate: '2026-01-29',
        startsAt: '2026-01-29T00:00:00.000Z',
        status: 'completed',
      },
      {
        id: 's6',
        sessionDate: '2026-02-05',
        startsAt: '2026-02-05T00:00:00.000Z',
        status: 'completed',
      },
      {
        id: 's7',
        sessionDate: '2026-02-12',
        startsAt: '2026-02-12T00:00:00.000Z',
        status: 'completed',
      },
      {
        id: 's8',
        sessionDate: '2026-02-19',
        startsAt: '2026-02-19T00:00:00.000Z',
        status: 'completed',
      },
    ];
    const attendance: ConsistencyAttendanceRecord[] = longSessions.map((s, i) => ({
      sessionId: s.id,
      studentId: 'stu-long',
      status: (['present', 'late', 'excused', 'absent'] as const)[i % 4],
    }));
    const entries = selectLastCompletedAttendance(longSessions, attendance, 'stu-long');
    expect(entries).toHaveLength(5);
    // Most-recent-first: the 5 most recent of s1..s8 by startsAt are s4..s8.
    expect(entries.map((e) => e.sessionId)).toEqual(['s8', 's7', 's6', 's5', 's4']);
  });

  it('never selects a scheduled or canceled session, even with an attendance record', () => {
    const attendance: ConsistencyAttendanceRecord[] = [
      { sessionId: 's1', studentId: 'stu-x', status: 'present' },
      { sessionId: 's5-scheduled', studentId: 'stu-x', status: 'present' },
      { sessionId: 's6-canceled', studentId: 'stu-x', status: 'present' },
    ];
    const entries = selectLastCompletedAttendance(sessions, attendance, 'stu-x');
    expect(entries).toHaveLength(1);
    expect(entries[0].sessionId).toBe('s1');
  });

  it('returns zero entries for a student with no completed-session attendance records', () => {
    const entries = selectLastCompletedAttendance(sessions, [], 'stu-none');
    expect(entries).toEqual([]);
  });

  it("never mixes another student's attendance records into the selection", () => {
    const attendance: ConsistencyAttendanceRecord[] = [
      { sessionId: 's1', studentId: 'stu-a', status: 'present' },
      { sessionId: 's2', studentId: 'stu-b', status: 'absent' },
    ];
    const entries = selectLastCompletedAttendance(sessions, attendance, 'stu-a');
    expect(entries).toHaveLength(1);
    expect(entries[0].sessionId).toBe('s1');
  });
});

// ---------------------------------------------------------------------------
// `buildConsistencyStripData` -- constitution item 3 (never re-derive %).
// ---------------------------------------------------------------------------

describe('buildConsistencyStripData (constitution item 3)', () => {
  it('never computes participationPct -- copies it verbatim from the metric row', () => {
    const data = buildConsistencyStripData(
      'stu-1',
      [],
      [],
      [
        {
          studentId: 'stu-1',
          teamId: 't1',
          seasonId: 's1',
          expectedCt: 8,
          presentCt: 6,
          lateCt: 2,
          excusedCt: 1,
          participationPct: 85.7,
        },
      ],
    );
    expect(data.participation?.participationPct).toBe(85.7);
  });

  it('returns participation: null when the student has no row in the metric view', () => {
    const data = buildConsistencyStripData(
      'stu-with-no-row',
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
});

// ---------------------------------------------------------------------------
// `defaultLoadConsistencyStripData` fixture -- proves the boundary logic
// against this file's own shipped fixture data too, not just synthetic
// inputs above.
// ---------------------------------------------------------------------------

describe('defaultLoadConsistencyStripData fixture', () => {
  it('jordan (8 completed records) is capped to 5 entries', async () => {
    const data = await defaultLoadConsistencyStripData('student-jordan-fixture');
    expect(data.entries).toHaveLength(5);
  });

  it('morgan (4 completed records) shows exactly 4, not padded to 5', async () => {
    const data = await defaultLoadConsistencyStripData('student-morgan-fixture');
    expect(data.entries).toHaveLength(4);
  });

  it('alex (0 completed records) shows zero entries and null participation', async () => {
    const data = await defaultLoadConsistencyStripData('student-alex-fixture');
    expect(data.entries).toHaveLength(0);
    expect(data.participation).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// `defaultLoadLinkedStudents` fixture -- proves the parent variant is
// genuinely plural (Known Context/Traps #6).
// ---------------------------------------------------------------------------

describe('defaultLoadLinkedStudents fixture', () => {
  it('returns more than one linked student', async () => {
    const students = await defaultLoadLinkedStudents();
    expect(students.length).toBeGreaterThan(1);
  });
});

// ---------------------------------------------------------------------------
// T100: real `loaders/checkin.ts` seams -- `makeLoadConsistencyStripData`,
// `makeLoadLinkedStudents`. Stubbed `SupabaseClient` only, same DI pattern
// `MeetingsList.test.tsx`'s own T096 loader-level tests already established
// -- `loaders/checkin.ts` has no dedicated test file of its own, per this
// task's own Allowed Files list.
// ---------------------------------------------------------------------------

describe('loadConsistencyStripData (T100 real load)', () => {
  it('scopes attendance/participation queries to the given studentId and reuses buildConsistencyStripData', async () => {
    const sessionsOrderSpy = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'sess-1',
          session_date: '2026-06-24',
          starts_at: '2026-06-24T23:00:00.000Z',
          status: 'completed',
        },
      ],
      error: null,
    });
    const attendanceEqSpy = vi.fn().mockResolvedValue({
      data: [{ session_id: 'sess-1', student_id: 'student-42', status: 'present' }],
      error: null,
    });
    const participationEqSpy = vi.fn().mockResolvedValue({
      data: [
        {
          student_id: 'student-42',
          team_id: 'team-1',
          season_id: 'season-1',
          expected_ct: 1,
          present_ct: 1,
          late_ct: 0,
          excused_ct: 0,
          participation_pct: 100,
        },
      ],
      error: null,
    });

    const fromSpy = vi.fn((table: string) => {
      if (table === 'event_sessions') return { select: vi.fn(() => ({ order: sessionsOrderSpy })) };
      if (table === 'attendance') return { select: vi.fn(() => ({ eq: attendanceEqSpy })) };
      // T120 (Trap #4): no more `.limit(...)` in the real query chain -- the
      // participation query now fetches every matching row so
      // `aggregateParticipationForStudent` has the full set (dual-member
      // fix, see the dedicated `describe` block below for multi-row cases).
      if (table === 'v_student_participation') {
        return { select: vi.fn(() => ({ eq: participationEqSpy })) };
      }
      throw new Error(`unexpected table: ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const load = makeLoadConsistencyStripData(() => client);
    const result = await load('student-42');

    expect(attendanceEqSpy).toHaveBeenCalledWith('student_id', 'student-42');
    expect(participationEqSpy).toHaveBeenCalledWith('student_id', 'student-42');
    expect(result).toEqual({
      entries: [{ sessionId: 'sess-1', sessionDate: '2026-06-24', status: 'present' }],
      participation: {
        studentId: 'student-42',
        teamId: 'team-1',
        seasonId: 'season-1',
        expectedCt: 1,
        presentCt: 1,
        lateCt: 0,
        excusedCt: 0,
        participationPct: 100,
      },
    });
  });

  // -------------------------------------------------------------------------
  // T120 (T116 checker-verified consumer-risk finding #3): dual-member
  // aggregation, both at the loader-seam level (real query -> real
  // aggregation -> real `buildConsistencyStripData` join) and directly
  // against `aggregateParticipationForStudent`'s own pure logic.
  // -------------------------------------------------------------------------

  it('aggregates a dual member\'s multiple team rows (same season) into one honestly-summed participation figure, not last-team-wins', async () => {
    const sessionsOrderSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const attendanceEqSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    // Dual member: 8/10 present on team-falcons (80.0%), 3/10 present on
    // team-comets (30.0%) -- SAME season. A `studentId`-only `.find()` over
    // this raw array (the pre-T120 bug, one layer up in
    // `buildConsistencyStripData`) would arbitrarily surface whichever row
    // sorts first (80.0% OR 30.0%, neither of which is the honest combined
    // total); a naive per-row average would give 55.0%, also wrong (not the
    // view's own counter-sum-then-round shape). The correct honest total,
    // reapplying the view's own expression over SUMMED counters:
    // round(100 * (8+3) / max((10+10)-(0+0), 1), 1) = round(100*11/20, 1) = 55.0.
    // (Deliberately coincides numerically with the naive average here ONLY
    // because both teams have equal expected_ct=10/excused_ct=0 -- the
    // dedicated `aggregateParticipationForStudent` unit tests below use
    // asymmetric counts specifically to distinguish the two.)
    const participationEqSpy = vi.fn().mockResolvedValue({
      data: [
        {
          student_id: 'student-dual',
          team_id: 'team-falcons',
          season_id: 'season-1',
          expected_ct: 10,
          present_ct: 8,
          late_ct: 0,
          excused_ct: 0,
          participation_pct: 80.0,
        },
        {
          student_id: 'student-dual',
          team_id: 'team-comets',
          season_id: 'season-1',
          expected_ct: 10,
          present_ct: 3,
          late_ct: 0,
          excused_ct: 0,
          participation_pct: 30.0,
        },
      ],
      error: null,
    });

    const fromSpy = vi.fn((table: string) => {
      if (table === 'event_sessions') return { select: vi.fn(() => ({ order: sessionsOrderSpy })) };
      if (table === 'attendance') return { select: vi.fn(() => ({ eq: attendanceEqSpy })) };
      if (table === 'v_student_participation') {
        return { select: vi.fn(() => ({ eq: participationEqSpy })) };
      }
      throw new Error(`unexpected table: ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const load = makeLoadConsistencyStripData(() => client);
    const result = await load('student-dual');

    expect(result.participation).not.toBeNull();
    expect(result.participation?.expectedCt).toBe(20);
    expect(result.participation?.presentCt).toBe(11);
    expect(result.participation?.participationPct).toBe(55.0);
  });

  it('resolves participation: null when a student has zero rows across every team (unchanged absence case)', async () => {
    const sessionsOrderSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const attendanceEqSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const participationEqSpy = vi.fn().mockResolvedValue({ data: [], error: null });
    const fromSpy = vi.fn((table: string) => {
      if (table === 'event_sessions') return { select: vi.fn(() => ({ order: sessionsOrderSpy })) };
      if (table === 'attendance') return { select: vi.fn(() => ({ eq: attendanceEqSpy })) };
      if (table === 'v_student_participation') {
        return { select: vi.fn(() => ({ eq: participationEqSpy })) };
      }
      throw new Error(`unexpected table: ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const load = makeLoadConsistencyStripData(() => client);
    const result = await load('student-no-rows');
    expect(result.participation).toBeNull();
  });
});

describe('aggregateParticipationForStudent (T120 pure unit tests)', () => {
  it('returns null for an empty row set (the "no completed sessions" absence case)', () => {
    expect(aggregateParticipationForStudent([])).toBeNull();
  });

  it('passes a single-row (non-dual-member) student through with the SAME counters and pct, unmodified', () => {
    const row = {
      student_id: 'student-solo',
      team_id: 'team-falcons',
      season_id: 'season-1',
      expected_ct: 10,
      present_ct: 7,
      late_ct: 1,
      excused_ct: 1,
      participation_pct: 77.8,
    };
    // Verbatim passthrough (checkin.ts's own `seasonRows.length === 1` early
    // return) -- not merely equal in value, the SAME object reference, so
    // this is provably zero recomputation, not a no-op recompute that
    // happens to match.
    expect(aggregateParticipationForStudent([row])).toBe(row);
  });

  it('sums counters across a dual member\'s two team rows and recomputes pct via the view\'s own expression -- excused-shrinks-denominator case', () => {
    // team-a: expected 10, present 6, excused 2 -> denom (10-2)=8
    // team-b: expected 5,  present 3, excused 0 -> denom (5-0)=5
    // summed: expected 15, present 9, excused 2 -> denom max(15-2,1)=13
    // round(100*9/13, 1) = round(69.23..., 1) = 69.2
    const result = aggregateParticipationForStudent([
      {
        student_id: 'student-dual-2',
        team_id: 'team-a',
        season_id: 'season-1',
        expected_ct: 10,
        present_ct: 6,
        late_ct: 0,
        excused_ct: 2,
        participation_pct: 75.0,
      },
      {
        student_id: 'student-dual-2',
        team_id: 'team-b',
        season_id: 'season-1',
        expected_ct: 5,
        present_ct: 3,
        late_ct: 0,
        excused_ct: 0,
        participation_pct: 60.0,
      },
    ]);
    expect(result?.expected_ct).toBe(15);
    expect(result?.present_ct).toBe(9);
    expect(result?.excused_ct).toBe(2);
    expect(result?.participation_pct).toBe(69.2);
  });

  it('only aggregates rows within one (the first-seen) season, ignoring a different season\'s rows entirely -- pre-existing season ambiguity stays disclosed, not conflated with the team fix', () => {
    const result = aggregateParticipationForStudent([
      {
        student_id: 'student-multi-season',
        team_id: 'team-a',
        season_id: 'season-current',
        expected_ct: 10,
        present_ct: 5,
        late_ct: 0,
        excused_ct: 0,
        participation_pct: 50.0,
      },
      {
        student_id: 'student-multi-season',
        team_id: 'team-a',
        season_id: 'season-past',
        expected_ct: 100,
        present_ct: 100,
        late_ct: 0,
        excused_ct: 0,
        participation_pct: 100.0,
      },
    ]);
    // Only the first row's season (season-current) is aggregated -- the
    // season-past row's 100/100 must NOT leak into the total.
    expect(result?.season_id).toBe('season-current');
    expect(result?.expected_ct).toBe(10);
    expect(result?.present_ct).toBe(5);
    expect(result?.participation_pct).toBe(50.0);
  });
});

describe('loadLinkedStudents (T100 real load)', () => {
  it('resolves an empty list when there is no real session (never crashes)', async () => {
    const client = {
      auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }) },
    } as unknown as SupabaseClient;

    const load = makeLoadLinkedStudents(() => client);
    const result = await load();
    expect(result).toEqual([]);
  });

  it('resolves an empty list for a signed-in parent with zero guardian_links rows', async () => {
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: 'profile-parent-1' } } },
          error: null,
        }),
      },
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({ order: vi.fn().mockResolvedValue({ data: [], error: null }) })),
        })),
      })),
    } as unknown as SupabaseClient;

    const load = makeLoadLinkedStudents(() => client);
    const result = await load();
    expect(result).toEqual([]);
  });

  it('joins guardian_links to students client-side, earliest-linked first, real display names threaded through', async () => {
    const guardianOrderSpy = vi.fn().mockResolvedValue({
      data: [{ student_id: 'student-a' }, { student_id: 'student-b' }],
      error: null,
    });
    const studentsInSpy = vi.fn().mockResolvedValue({
      data: [
        { id: 'student-a', display_name: 'Ada' },
        { id: 'student-b', display_name: 'Bea' },
      ],
      error: null,
    });
    const fromSpy = vi.fn((table: string) => {
      if (table === 'guardian_links') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ order: guardianOrderSpy })) })) };
      }
      if (table === 'students') return { select: vi.fn(() => ({ in: studentsInSpy })) };
      throw new Error(`unexpected table: ${table}`);
    });
    const client = {
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: { user: { id: 'profile-parent-2' } } },
          error: null,
        }),
      },
      from: fromSpy,
    } as unknown as SupabaseClient;

    const load = makeLoadLinkedStudents(() => client);
    const result = await load();

    expect(guardianOrderSpy).toHaveBeenCalledWith('created_at', { ascending: true });
    expect(studentsInSpy).toHaveBeenCalledWith('id', ['student-a', 'student-b']);
    expect(result).toEqual([
      { studentId: 'student-a', displayName: 'Ada' },
      { studentId: 'student-b', displayName: 'Bea' },
    ]);
  });
});

// ---------------------------------------------------------------------------
// <ConsistencyStrip /> -- DES-05 color mapping, all four statuses, rendered
// directly against synthetic props (independent of the fixture data above).
// ---------------------------------------------------------------------------

describe('<ConsistencyStrip /> DES-05 mapping', () => {
  it('maps present/late/excused/absent to success/warning/neutral/error respectively', () => {
    render(
      <ConsistencyStrip
        entries={[
          { sessionId: 'a', sessionDate: '2026-01-01', status: 'present' },
          { sessionId: 'b', sessionDate: '2026-01-08', status: 'late' },
          { sessionId: 'c', sessionDate: '2026-01-15', status: 'excused' },
          { sessionId: 'd', sessionDate: '2026-01-22', status: 'absent' },
        ]}
        participation={null}
      />,
    );

    expect(statusDotVariants()).toEqual(['success', 'warning', 'neutral', 'error']);

    const labels = statusDotLabels();
    expect(labels.some((l) => l.startsWith('Present'))).toBe(true);
    expect(labels.some((l) => l.startsWith('Late'))).toBe(true);
    expect(labels.some((l) => l.startsWith('Excused'))).toBe(true);
    expect(labels.some((l) => l.startsWith('Absent'))).toBe(true);
  });

  it('BLOCKER-class: excused never renders with the error variant (never looks like a failure)', () => {
    render(
      <ConsistencyStrip
        entries={[{ sessionId: 'c', sessionDate: '2026-01-15', status: 'excused' }]}
        participation={null}
      />,
    );
    expect(statusDotVariants()).toEqual(['neutral']);
    expect(statusDotVariants()).not.toContain('error');
  });

  it('renders exactly as many dots as entries -- no padding to a fixed count', () => {
    render(
      <ConsistencyStrip
        entries={[
          { sessionId: 'a', sessionDate: '2026-01-01', status: 'present' },
          { sessionId: 'b', sessionDate: '2026-01-08', status: 'present' },
        ]}
        participation={null}
      />,
    );
    expect(statusDotVariants()).toHaveLength(2);
  });

  it('renders participation % from the fixture-shaped prop verbatim, never recomputed', () => {
    render(
      <ConsistencyStrip
        entries={[]}
        participation={{
          studentId: 'stu-1',
          teamId: 't1',
          seasonId: 's1',
          expectedCt: 8,
          presentCt: 6,
          lateCt: 2,
          excusedCt: 1,
          participationPct: 85.7,
        }}
      />,
    );
    expect(container.textContent).toContain('85.7%');
  });

  it('renders "-" (never a fabricated %) when participation is null', () => {
    render(<ConsistencyStrip entries={[]} participation={null} />);
    expect(container.textContent).toContain('—');
    expect(container.textContent).not.toMatch(/\d+%/);
  });

  it('empty entries render inline text, not a crash, not padded dots', () => {
    render(<ConsistencyStrip entries={[]} participation={null} />);
    expect(statusDotVariants()).toHaveLength(0);
    expect(container.textContent).toContain('No completed meetings recorded yet.');
  });
});

// ---------------------------------------------------------------------------
// <StudentMeetingView /> -- top-level component, both variants, DES-12
// states.
// ---------------------------------------------------------------------------

describe('<StudentMeetingView variant="own" />', () => {
  it('loading state', () => {
    render(
      <StudentMeetingView
        studentId="student-jordan-fixture"
        loadStripData={() => new Promise<ConsistencyStripData>(() => {})}
      />,
    );
    expect(container.textContent).toContain('Loading your meeting consistency');
  });

  it('error state', async () => {
    render(
      <StudentMeetingView
        studentId="student-jordan-fixture"
        loadStripData={() => Promise.reject(new Error('boom'))}
      />,
    );
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't load meeting consistency");
  });

  it('populated state: the shipped fixture caps jordan at 5 dots and shows the fixture % verbatim', async () => {
    render(
      <StudentMeetingView
        studentId="student-jordan-fixture"
        loadStripData={defaultLoadConsistencyStripData}
      />,
    );
    await flushMicrotasks();
    expect(statusDotVariants()).toHaveLength(5);
    expect(container.textContent).toContain('85.7%');
  });

  it('populated state: morgan (fewer-than-5 history) shows exactly 4 dots', async () => {
    render(
      <StudentMeetingView
        studentId="student-morgan-fixture"
        loadStripData={defaultLoadConsistencyStripData}
      />,
    );
    await flushMicrotasks();
    expect(statusDotVariants()).toHaveLength(4);
  });
});

// ---------------------------------------------------------------------------
// T100 (module doc #9, Trap #1): `variant="own"` real `studentId` resolution
// -- reuses `MeetingsList.tsx`'s own already-Passed (T096) `resolveStudentId`
// seam type. None of these tests pass an explicit `studentId` (the
// real-world case); each injects a fast `resolveStudentId` fake through the
// seam (same "inject the fixture explicitly" pattern every ED-1 packet
// establishes) so they never hit the real, network-backed default. Mirrors
// `MeetingsList.test.tsx`'s own T096 `resolveStudentId` test shape.
// ---------------------------------------------------------------------------

const STUDENT_OR_PARENT_USER: AuthUser = {
  id: 'user-student',
  email: 'student@example.com',
  role: 'student',
};

function fakeResolveStudentId(studentId: string | null): ResolveCurrentStudentIdFn {
  return () => Promise.resolve(studentId);
}

function renderAsUser(user: AuthUser, node: ReactElement): void {
  render(
    <AuthProvider>
      <LoginAs user={user}>{node}</LoginAs>
    </AuthProvider>,
  );
}

describe('<StudentMeetingView variant="own" /> real studentId resolution (T100)', () => {
  it('an explicit studentId bypasses resolution entirely -- no AuthProvider required, unchanged pre-existing behavior', async () => {
    render(
      <StudentMeetingView
        studentId="student-jordan-fixture"
        loadStripData={defaultLoadConsistencyStripData}
      />,
    );
    await flushMicrotasks();
    expect(statusDotVariants()).toHaveLength(5);
  });

  it('signed-out viewer (no studentId supplied) renders a real "sign in" EmptyState, not a crash', async () => {
    render(
      <AuthProvider>
        <StudentMeetingView />
      </AuthProvider>,
    );
    await flushMicrotasks();
    expect(container.textContent).toContain('Sign in to view your meeting consistency');
  });

  it("resolveStudentId's own loading state renders before the strip card mounts", async () => {
    renderAsUser(
      STUDENT_OR_PARENT_USER,
      <StudentMeetingView resolveStudentId={() => new Promise<string | null>(() => {})} />,
    );
    // T073b2: auth resolution (even via the fake `authModule` `LoginAs` uses)
    // is genuinely async -- a flush is needed before the authenticated body
    // (and its own resolution loading state) mounts. Same reasoning
    // `MeetingsList.test.tsx`'s own T096 analogous test documents.
    await flushMicrotasks();
    expect(container.textContent).toContain('Finding your student record');
  });

  it("resolveStudentId's own error state renders a real error Banner with Retry", async () => {
    renderAsUser(
      STUDENT_OR_PARENT_USER,
      <StudentMeetingView resolveStudentId={() => Promise.reject(new Error('boom'))} />,
    );
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't find your student record");
  });

  it('resolveStudentId resolving null renders a real "no student linked" EmptyState, not a crash', async () => {
    renderAsUser(
      STUDENT_OR_PARENT_USER,
      <StudentMeetingView resolveStudentId={fakeResolveStudentId(null)} />,
    );
    await flushMicrotasks();
    expect(container.textContent).toContain('No student account linked yet');
  });

  it('resolveStudentId resolving a real id renders the strip scoped to that id (fixture data threaded through)', async () => {
    renderAsUser(
      STUDENT_OR_PARENT_USER,
      <StudentMeetingView
        resolveStudentId={fakeResolveStudentId('student-morgan-fixture')}
        loadStripData={defaultLoadConsistencyStripData}
      />,
    );
    await flushMicrotasks();
    await flushMicrotasks();
    expect(statusDotVariants()).toHaveLength(4);
  });
});

describe('<StudentMeetingView variant="linked" /> (parent, plural students)', () => {
  it('loading state', () => {
    render(
      <StudentMeetingView
        variant="linked"
        loadLinkedStudents={() => new Promise<LinkedStudentSummary[]>(() => {})}
      />,
    );
    expect(container.textContent).toContain('Loading linked students');
  });

  it('error state', async () => {
    render(
      <StudentMeetingView
        variant="linked"
        loadLinkedStudents={() => Promise.reject(new Error('boom'))}
      />,
    );
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't load linked students");
  });

  it('empty state: zero linked students', async () => {
    render(<StudentMeetingView variant="linked" loadLinkedStudents={() => Promise.resolve([])} />);
    await flushMicrotasks();
    expect(container.textContent).toContain('No linked students yet');
  });

  it('populated state: renders one independent strip per linked student, never assuming a single child', async () => {
    render(
      <StudentMeetingView
        variant="linked"
        loadLinkedStudents={defaultLoadLinkedStudents}
        loadStripData={defaultLoadConsistencyStripData}
      />,
    );
    await flushMicrotasks();

    // All three fixture children's names appear -- genuinely plural, not a
    // single-child assumption.
    expect(container.textContent).toContain('Jordan R.');
    expect(container.textContent).toContain('Morgan R.');
    expect(container.textContent).toContain('Alex R.');

    // jordan capped at 5 + morgan's 4 + alex's 0 = 9 dots total.
    expect(statusDotVariants()).toHaveLength(9);

    // Alex's zero-history card renders its own inline empty copy, not a
    // page-level EmptyState (module doc #7) and not a crash.
    expect(container.textContent).toContain('No completed meetings recorded yet.');
  });
});

// ---------------------------------------------------------------------------
// BLOCKER-class grep-shaped proof (Known Context/Traps #1): zero
// streak-shaped copy or logic anywhere in the shipped component source.
// A literal grep is run and asserted on in this task's worker output; this
// test additionally proves it at the rendered-DOM level for the richest
// populated scenario this file exercises.
// ---------------------------------------------------------------------------

describe('BEH-06 no-streak-mechanics proof (rendered DOM)', () => {
  it('the fully populated parent view never renders streak-shaped copy', async () => {
    render(
      <StudentMeetingView
        variant="linked"
        loadLinkedStudents={defaultLoadLinkedStudents}
        loadStripData={defaultLoadConsistencyStripData}
      />,
    );
    await flushMicrotasks();

    const text = container.textContent ?? '';
    expect(text).not.toMatch(/streak/i);
    expect(text).not.toMatch(/don't break/i);
    expect(text).not.toMatch(/keep it up/i);
    expect(text).not.toMatch(/in a row/i);
  });
});
