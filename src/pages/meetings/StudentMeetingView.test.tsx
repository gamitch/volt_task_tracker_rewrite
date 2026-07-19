// @vitest-environment jsdom
/**
 * T037: tests for `StudentMeetingView.tsx`.
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
 */
import { act, type ReactElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
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
