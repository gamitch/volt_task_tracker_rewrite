// @vitest-environment jsdom
import { act, type ComponentProps } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StudentMeetingHistoryRow, StudentMeetingsData } from '../../../lib/meetings/types';
import { StudentMeetingsView, StudentMeetingsViewContainer } from './StudentMeetingsView';

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: Root;

const participation = {
  studentId: 'priya',
  teamId: 'team-a',
  seasonId: 'season',
  expectedCt: 4,
  presentCt: 3,
  lateCt: 0,
  excusedCt: 0,
  participationPct: 75,
};

function row(
  sessionId: string,
  overrides: Partial<StudentMeetingHistoryRow> = {},
): StudentMeetingHistoryRow {
  const startsAt = overrides.startsAt ?? '2026-09-01T23:00:00Z';
  const endsAt =
    overrides.endsAt ?? new Date(new Date(startsAt).getTime() + 2 * 60 * 60 * 1000).toISOString();
  return {
    sessionId,
    title: sessionId,
    locationName: 'Shop Bay 2',
    sessionDate: '2026-09-01',
    startsAt,
    endsAt,
    status: 'scheduled',
    myAttendanceStatus: null,
    ...overrides,
  };
}

const populatedData: StudentMeetingsData = {
  history: [
    row('later', {
      title: 'Later meeting',
      sessionDate: '2026-09-05',
      startsAt: '2026-09-05T23:00:00Z',
    }),
    row('hero', { title: 'First meeting', locationName: 'Lab A', sessionDate: '2026-09-01' }),
    row('upcoming-2', {
      title: 'Second upcoming',
      sessionDate: '2026-09-10',
      startsAt: '2026-09-10T23:00:00Z',
    }),
    row('upcoming-3', {
      title: 'Third upcoming',
      sessionDate: '2026-09-11',
      startsAt: '2026-09-11T23:00:00Z',
    }),
    row('upcoming-4', {
      title: 'Fourth upcoming',
      sessionDate: '2026-09-12',
      startsAt: '2026-09-12T23:00:00Z',
    }),
    row('completed', {
      title: 'Completed meeting',
      sessionDate: '2026-08-20',
      startsAt: '2026-08-20T23:00:00Z',
      status: 'completed',
      myAttendanceStatus: 'present',
    }),
    row('canceled', {
      title: 'Canceled meeting',
      sessionDate: '2026-08-21',
      startsAt: '2026-08-21T23:00:00Z',
      status: 'canceled',
    }),
  ],
  participation,
};

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function renderStudent(
  data: StudentMeetingsData | Promise<StudentMeetingsData>,
  isActive: boolean | null = true,
): Promise<void> {
  await act(async () => {
    root.render(
      <StudentMeetingsView
        studentId="priya"
        loadData={() => Promise.resolve(data)}
        resolveStudentIsActive={() => Promise.resolve(isActive)}
      />,
    );
  });
  await flush();
}

function progressBars(): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="progressbar"]'));
}

function statusDots(): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="img"].astryx-statusdot'));
}

function headingOutline(): string[] {
  return Array.from(container.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(
    (heading) => `H${heading.tagName.slice(1)}:${heading.textContent}`,
  );
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe('StudentMeetingsView', () => {
  it('renders a measurable loading state', async () => {
    await act(async () => {
      root.render(
        <StudentMeetingsView
          studentId="priya"
          loadData={() => new Promise<StudentMeetingsData>(() => {})}
          resolveStudentIsActive={() => Promise.resolve(true)}
        />,
      );
    });
    expect(container.textContent).toContain('Loading your meetings');
  });

  it('renders the meeting-data error state', async () => {
    await act(async () => {
      root.render(
        <StudentMeetingsView
          studentId="priya"
          loadData={() => Promise.reject(new Error('nope'))}
          resolveStudentIsActive={() => Promise.resolve(true)}
        />,
      );
    });
    await flush();
    expect(container.textContent).toContain("Couldn't load your meeting history");
  });

  it('retries a failed meeting-data load', async () => {
    let attempts = 0;
    const loadData = vi.fn(() => {
      attempts += 1;
      return attempts === 1 ? Promise.reject(new Error('nope')) : Promise.resolve(populatedData);
    });
    await act(async () => {
      root.render(
        <StudentMeetingsView
          studentId="priya"
          loadData={loadData}
          resolveStudentIsActive={() => Promise.resolve(true)}
        />,
      );
    });
    await flush();
    const retry = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Retry',
    );
    expect(retry).toBeTruthy();
    await act(async () => retry?.click());
    await flush();
    expect(loadData).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('First meeting');
  });

  it('renders the authored empty state when there is no history or metric', async () => {
    await renderStudent({ history: [], participation: null });
    expect(container.textContent).toContain('No meeting history yet');
  });

  it('keeps real history visible for an inactive account', async () => {
    await renderStudent(populatedData, false);
    expect(container.textContent).toContain('Your student account is inactive');
    expect(container.textContent).toContain('First meeting');
  });

  it('shows inactive copy even when the inactive account has no data', async () => {
    await renderStudent({ history: [], participation: null }, false);
    expect(container.textContent).toContain('Your student account is inactive');
    expect(container.textContent).not.toContain('No meeting history yet');
  });

  it('does not confuse an active no-metric student with an inactive student', async () => {
    await renderStudent({ history: [], participation: null }, true);
    expect(container.textContent).toContain('No meeting history yet');
    expect(container.textContent).not.toContain('Your student account is inactive');
  });

  it('uses the earliest scheduled session as the hero', async () => {
    await renderStudent(populatedData);
    const hero = container.querySelector('h2');
    expect(hero?.textContent).toBe('First meeting');
  });

  it('never promotes a canceled session to the hero', async () => {
    await renderStudent({
      ...populatedData,
      history: [
        row('canceled-first', {
          title: 'Canceled first',
          startsAt: '2026-08-01T23:00:00Z',
          status: 'canceled',
        }),
        row('scheduled-next', { title: 'Scheduled next', startsAt: '2026-09-01T23:00:00Z' }),
      ],
    });
    expect(headingOutline()).toContain('H2:Scheduled next');
    expect(headingOutline()).not.toContain('H2:Canceled first');
  });

  it('caps the follow-up schedule at three meetings', async () => {
    await renderStudent(populatedData);
    expect(container.textContent).toContain('Later meeting');
    expect(container.textContent).toContain('Third upcoming');
    expect(container.textContent).not.toContain('Fourth upcoming');
  });

  it('shows the hero location, weekday, time, and duration', async () => {
    await renderStudent(populatedData);
    expect(container.textContent).toContain('Lab A');
    expect(container.textContent).toMatch(/Tue, Sep 1/);
    expect(container.textContent).toMatch(/2h/);
  });

  it('keeps past meetings collapsed until the disclosure opens', async () => {
    await renderStudent(populatedData);
    const trigger = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Show past meetings (2)'),
    );
    expect(trigger?.getAttribute('aria-expanded')).toBe('false');
    await act(async () => trigger?.click());
    expect(trigger?.getAttribute('aria-expanded')).toBe('true');
    expect(container.textContent).toContain('Completed meeting');
  });

  it('keeps the past-meeting disclosure keyboard focusable', async () => {
    await renderStudent(populatedData);
    const trigger = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Show past meetings (2)'),
    );
    trigger?.focus();
    expect(document.activeElement).toBe(trigger);
    expect(trigger?.tagName).toBe('BUTTON');
  });

  it('renders neutral pending copy for a past row without an attendance mark', async () => {
    await renderStudent(populatedData);
    const trigger = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Show past meetings (2)'),
    );
    await act(async () => trigger?.click());
    expect(container.textContent).toContain('Not yet held');
  });

  it('maps all completed attendance statuses to their DES-05 variants', async () => {
    await renderStudent({
      history: ['present', 'late', 'excused', 'absent'].map((status, index) =>
        row(status, {
          status: 'completed',
          startsAt: `2026-08-0${index + 1}T23:00:00Z`,
          myAttendanceStatus: status as StudentMeetingHistoryRow['myAttendanceStatus'],
        }),
      ),
      participation,
    });
    const variants = statusDots().map((dot) => dot.getAttribute('data-variant'));
    expect(variants).toEqual(expect.arrayContaining(['success', 'warning', 'neutral', 'error']));
    expect(container.textContent).toContain('Present');
    expect(container.textContent).toContain('Late');
    expect(container.textContent).toContain('Excused');
    expect(container.textContent).toContain('Absent');
  });

  it('caps completed attendance marks at the latest five', async () => {
    await renderStudent({
      history: Array.from({ length: 6 }, (_, index) =>
        row(`completed-${index}`, {
          status: 'completed',
          startsAt: `2026-08-${String(index + 1).padStart(2, '0')}T23:00:00Z`,
          myAttendanceStatus: 'present',
        }),
      ),
      participation,
    });
    // Five recent marks plus four legend dots; the oldest completed mark is excluded.
    expect(statusDots()).toHaveLength(9);
  });

  it('renders one determinate participation bar for a real metric percentage', async () => {
    await renderStudent(populatedData);
    expect(progressBars()).toHaveLength(1);
    expect(container.textContent).toContain('Participation: 75%');
  });

  it('renders one indeterminate participation bar and a dash when the outer metric is null', async () => {
    await renderStudent({ ...populatedData, participation: null });
    expect(progressBars()).toHaveLength(1);
    expect(progressBars()[0]?.getAttribute('aria-valuetext')).toBeNull();
    expect(container.textContent).toContain('Participation: —');
  });

  it('renders one indeterminate participation bar and a dash when the metric percentage is null', async () => {
    await renderStudent({
      ...populatedData,
      participation: { ...participation, participationPct: null },
    });
    expect(progressBars()).toHaveLength(1);
    expect(progressBars()[0]?.getAttribute('aria-valuetext')).toBeNull();
    expect(container.textContent).toContain('Participation: —');
  });

  it('does not render meeting write controls', async () => {
    await renderStudent(populatedData);
    expect(container.textContent).not.toMatch(
      /Schedule meetings|Cancel session|Edit meeting|Mark attendance/,
    );
  });
});

describe('StudentMeetingsViewContainer identity and parent composition', () => {
  const viewer = { id: 'parent', role: 'parent' as const };

  async function renderContainer(
    overrides: Partial<ComponentProps<typeof StudentMeetingsViewContainer>> = {},
  ) {
    await act(async () => {
      root.render(
        <StudentMeetingsViewContainer
          viewer={viewer}
          explicitStudentId={undefined}
          resolveStudentId={() => Promise.resolve('priya')}
          resolveStudentIsActive={() => Promise.resolve(true)}
          loadData={() => Promise.resolve(populatedData)}
          loadLinkedStudents={() => Promise.resolve([])}
          {...overrides}
        />,
      );
    });
    await flush();
  }

  it('renders resolver loading before student content', async () => {
    await renderContainer({ resolveStudentId: () => new Promise<string | null>(() => {}) });
    expect(container.textContent).toContain('Finding your student record');
  });

  it('renders resolver errors with retry affordance', async () => {
    await renderContainer({ resolveStudentId: () => Promise.reject(new Error('nope')) });
    expect(container.textContent).toContain("Couldn't find your student record");
    expect(container.textContent).toContain('Retry');
  });

  it('renders the no-linked-student empty state', async () => {
    await renderContainer({ resolveStudentId: () => Promise.resolve(null) });
    expect(container.textContent).toContain('No student account linked yet');
  });

  it('passes the resolved student identity into the meeting loader', async () => {
    const loadData = vi.fn(() => Promise.resolve(populatedData));
    await renderContainer({ loadData });
    expect(loadData).toHaveBeenCalledWith('priya');
  });

  it('uses one h1 Meetings followed by h2 sections on the real user composition', async () => {
    await renderContainer({ viewer: { id: 'student', role: 'student' } });
    expect(headingOutline().filter((heading) => heading === 'H1:Meetings')).toHaveLength(1);
    expect(headingOutline()).toContain('H2:First meeting');
    expect(headingOutline()).toContain('H2:Attendance summary');
  });

  it('shows a child switcher only when a parent has more than one child', async () => {
    await renderContainer({
      loadLinkedStudents: () =>
        Promise.resolve([{ studentId: 'priya', displayName: 'Priya Raman' }]),
    });
    expect(container.textContent).not.toContain('Viewing meetings for');
  });

  it('switches exactly one selected child and updates the visible history', async () => {
    const loadData = (studentId: string) =>
      Promise.resolve({
        ...populatedData,
        history: [
          row(studentId, { title: studentId === 'nina' ? 'Nina history' : 'Priya history' }),
        ],
      });
    await renderContainer({
      loadData,
      loadLinkedStudents: () =>
        Promise.resolve([
          { studentId: 'priya', displayName: 'Priya Raman' },
          { studentId: 'nina', displayName: 'Nina Kowalski' },
        ]),
    });
    expect(container.textContent).toContain('Priya history');
    const nina = container.querySelector<HTMLInputElement>('input[value="nina"]');
    expect(nina?.getAttribute('type')).toBe('radio');
    await act(async () => nina?.click());
    await flush();
    expect(container.textContent).toContain('Nina history');
    expect(container.textContent).not.toContain('Priya history');
  });
});
