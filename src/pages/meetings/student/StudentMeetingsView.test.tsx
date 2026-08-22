// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StudentMeetingsView, StudentMeetingsViewContainer } from './StudentMeetingsView';
import type { StudentMeetingsData } from '../../../lib/meetings/types';

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
const data: StudentMeetingsData = {
  history: [
    {
      sessionId: 'later',
      title: 'Later meeting',
      locationName: 'Lab B',
      sessionDate: '2026-09-05',
      startsAt: '2026-09-05T23:00:00Z',
      endsAt: '2026-09-06T01:00:00Z',
      status: 'scheduled',
      myAttendanceStatus: null,
    },
    {
      sessionId: 'hero',
      title: 'First meeting',
      locationName: 'Lab A',
      sessionDate: '2026-09-01',
      startsAt: '2026-09-01T23:00:00Z',
      endsAt: '2026-09-02T01:00:00Z',
      status: 'scheduled',
      myAttendanceStatus: null,
    },
    {
      sessionId: 'upcoming-2',
      title: 'Second upcoming',
      locationName: 'Lab C',
      sessionDate: '2026-09-10',
      startsAt: '2026-09-10T23:00:00Z',
      endsAt: '2026-09-11T01:00:00Z',
      status: 'scheduled',
      myAttendanceStatus: null,
    },
    {
      sessionId: 'upcoming-3',
      title: 'Third upcoming',
      locationName: 'Lab D',
      sessionDate: '2026-09-11',
      startsAt: '2026-09-11T23:00:00Z',
      endsAt: '2026-09-12T01:00:00Z',
      status: 'scheduled',
      myAttendanceStatus: null,
    },
    {
      sessionId: 'upcoming-4',
      title: 'Fourth upcoming',
      locationName: 'Lab E',
      sessionDate: '2026-09-12',
      startsAt: '2026-09-12T23:00:00Z',
      endsAt: '2026-09-13T01:00:00Z',
      status: 'scheduled',
      myAttendanceStatus: null,
    },
    {
      sessionId: 'past',
      title: 'Completed meeting',
      locationName: 'Lab F',
      sessionDate: '2026-08-20',
      startsAt: '2026-08-20T23:00:00Z',
      endsAt: '2026-08-21T01:00:00Z',
      status: 'completed',
      myAttendanceStatus: 'present',
    },
    {
      sessionId: 'canceled',
      title: 'Canceled meeting',
      locationName: 'Lab G',
      sessionDate: '2026-08-21',
      startsAt: '2026-08-21T23:00:00Z',
      endsAt: '2026-08-22T01:00:00Z',
      status: 'canceled',
      myAttendanceStatus: null,
    },
  ],
  participation,
};

async function flush(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
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
  it('keeps loading, error, empty, and inactive-account states measurable', async () => {
    act(() =>
      root.render(
        <StudentMeetingsView
          studentId="priya"
          loadData={() => new Promise<StudentMeetingsData>(() => {})}
          resolveStudentIsActive={() => Promise.resolve(true)}
        />,
      ),
    );
    expect(container.textContent).toContain('Loading your meetings');
    await act(async () =>
      root.render(
        <StudentMeetingsView
          studentId="priya"
          loadData={() => Promise.reject(new Error('nope'))}
          resolveStudentIsActive={() => Promise.resolve(true)}
        />,
      ),
    );
    await flush();
    expect(container.textContent).toContain("Couldn't load your meeting history");
    await act(async () =>
      root.render(
        <StudentMeetingsView
          studentId="priya"
          loadData={() => Promise.resolve({ history: [], participation: null })}
          resolveStudentIsActive={() => Promise.resolve(true)}
        />,
      ),
    );
    await flush();
    expect(container.textContent).toContain('No meeting history yet');
    await act(async () =>
      root.render(
        <StudentMeetingsView
          studentId="priya"
          loadData={() => Promise.resolve(data)}
          resolveStudentIsActive={() => Promise.resolve(false)}
        />,
      ),
    );
    await flush();
    expect(container.textContent).toContain('Your student account is inactive');
    expect(container.textContent).toContain('First meeting');
  });

  it('renders the earliest scheduled hero, locations, only three subsequent meetings, and no write controls', async () => {
    act(() =>
      root.render(
        <StudentMeetingsView
          studentId="priya"
          loadData={() => Promise.resolve(data)}
          resolveStudentIsActive={() => Promise.resolve(true)}
        />,
      ),
    );
    await flush();
    expect(container.textContent).toContain('First meeting');
    expect(container.textContent).toContain('Lab A');
    expect(container.textContent).toContain('Later meeting');
    expect(container.textContent).toContain('Third upcoming');
    expect(container.textContent).not.toContain('Fourth upcoming');
    expect(container.querySelector('[role="progressbar"]')).not.toBeNull();
    expect(container.textContent).not.toMatch(/Schedule meetings|Cancel session|Edit meeting/);
  });

  it('keeps past meetings collapsed until keyboard-accessible disclosure opens them', async () => {
    act(() =>
      root.render(
        <StudentMeetingsView
          studentId="priya"
          loadData={() => Promise.resolve(data)}
          resolveStudentIsActive={() => Promise.resolve(true)}
        />,
      ),
    );
    await flush();
    const trigger = Array.from(container.querySelectorAll('button')).find((button) =>
      button.textContent?.includes('Show past meetings (2)'),
    );
    expect(trigger).toBeTruthy();
    expect(trigger!.getAttribute('aria-expanded')).toBe('false');
    await act(async () => trigger!.click());
    expect(trigger!.getAttribute('aria-expanded')).toBe('true');
    expect(container.textContent).toContain('Completed meeting');
    expect(container.textContent).toContain('Not yet held');
  });

  it('renders an honest dash, not a fabricated percentage, when the metric is null', async () => {
    act(() =>
      root.render(
        <StudentMeetingsView
          studentId="priya"
          loadData={() => Promise.resolve({ ...data, participation: null })}
          resolveStudentIsActive={() => Promise.resolve(true)}
        />,
      ),
    );
    await flush();
    expect(container.textContent).toContain('Participation: —');
    expect(container.querySelectorAll('[role="progressbar"]')).toHaveLength(0);
  });

  it('loads parent children through an injectable seam and switches one selected child at a time', async () => {
    const loadData = (studentId: string) =>
      Promise.resolve({
        ...data,
        history: [
          { ...data.history[1], title: studentId === 'nina' ? 'Nina meeting' : 'Priya meeting' },
        ],
      });
    act(() =>
      root.render(
        <StudentMeetingsViewContainer
          viewer={{ id: 'parent', role: 'parent' }}
          explicitStudentId={undefined}
          resolveStudentId={() => Promise.resolve('priya')}
          resolveStudentIsActive={() => Promise.resolve(true)}
          loadData={loadData}
          loadLinkedStudents={() =>
            Promise.resolve([
              { studentId: 'priya', displayName: 'Priya Raman' },
              { studentId: 'nina', displayName: 'Nina Kowalski' },
            ])
          }
        />,
      ),
    );
    await flush();
    await flush();
    expect(container.textContent).toContain('Priya R.');
    expect(container.textContent).toContain('Nina K.');
    expect(container.textContent).toContain('Priya meeting');
    const nina = container.querySelector('input[value="nina"]') as HTMLInputElement;
    await act(async () => nina.click());
    await flush();
    expect(container.textContent).toContain('Nina meeting');
    expect(container.textContent).not.toContain('Priya meeting');
  });
});
