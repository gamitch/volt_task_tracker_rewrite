// @vitest-environment jsdom
/**
 * T058: tests for `EventsTab.tsx`.
 *
 * Per this task's Allowed Files ("A colocated `EventsTab.test.tsx` is
 * acceptable per established precedent -- disclose it") this test file is a
 * deliberate, disclosed addition beyond the literal `EventsTab.tsx`-only
 * Allowed Files entry -- the same class of addition `MeetingsList.test.tsx`
 * (T030) and `OutreachList.test.tsx` made in sibling directories, existing
 * only to produce the DOM-text / hand-computed-hours proof this task's own
 * packet's "Required Worker Output" section requires.
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- these tests use the same raw `createRoot`/`act`
 * pattern `MeetingsList.test.tsx`/`OutreachList.test.tsx` already
 * established. `EventsTab` performs no self-gating (module doc #9 in
 * `EventsTab.tsx` -- `ReportsShell.tsx` already gates `/reports`), so
 * unlike those two files' tests, no `AuthProvider`/role wrapping is needed
 * here at all.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  buildDisplayRows,
  computeAttendeeHours,
  computeSessionHoursAwarded,
  defaultLoadEventSessionsData,
  EVENT_TYPE_BADGE,
  EventsTab,
  FIXTURE_ATTENDANCE,
  FIXTURE_EVENTS,
  FIXTURE_RSVPS,
  FIXTURE_SESSIONS,
  formatSessionDate,
  PLACEHOLDER_CURRENT_SEASON_ID,
  SESSION_STATUS_BADGE,
  summarizeAttendance,
  summarizeSignups,
  type EventSessionDisplayRow,
} from './EventsTab';

// ---------------------------------------------------------------------------
// Render harness -- same pattern as MeetingsList.test.tsx / OutreachList.test.tsx.
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

// ---------------------------------------------------------------------------
// Module doc #11's fixture walkthrough -- pure-function hand-computed
// cross-checks (worker packet Required Worker Output: "per-session hours
// cross-checked against a hand-computed expectation using the same
// fallback logic").
// ---------------------------------------------------------------------------

function sessionById(id: string) {
  const session = FIXTURE_SESSIONS.find((s) => s.id === id);
  if (!session) {
    throw new Error(`fixture session ${id} not found`);
  }
  return session;
}

function eventById(id: string) {
  const event = FIXTURE_EVENTS.find((e) => e.id === id);
  if (!event) {
    throw new Error(`fixture event ${id} not found`);
  }
  return event;
}

function attendanceFor(sessionId: string) {
  return FIXTURE_ATTENDANCE.filter((row) => row.sessionId === sessionId);
}

function rsvpsFor(sessionId: string) {
  return FIXTURE_RSVPS.filter((row) => row.sessionId === sessionId);
}

describe('computeAttendeeHours -- the three-way fallback mirrored from v_student_hours', () => {
  const session = sessionById('session-m1'); // 2026-07-07T18:00Z - 20:00Z (2h)

  it('hours_override wins over everything else (student-a: override 1.25)', () => {
    const row = attendanceFor('session-m1').find((r) => r.studentId === 'student-a');
    expect(row).toBeDefined();
    expect(computeAttendeeHours(row!, session)).toBe(1.25);
  });

  it('check-in/check-out fully inside the session window needs no clamping (student-b: 18:30-19:30 -> 1.0h)', () => {
    const row = attendanceFor('session-m1').find((r) => r.studentId === 'student-b');
    expect(row).toBeDefined();
    expect(computeAttendeeHours(row!, session)).toBe(1.0);
  });

  it('check-in/check-out window clamped on BOTH ends to the session bounds (student-c: 17:30-20:30 clamps to 18:00-20:00 -> 2.0h)', () => {
    const row = attendanceFor('session-m1').find((r) => r.studentId === 'student-c');
    expect(row).toBeDefined();
    expect(computeAttendeeHours(row!, session)).toBe(2.0);
  });

  it('no check-in/check-out at all falls back to the full session duration (student-d: 2h)', () => {
    const row = attendanceFor('session-m1').find((r) => r.studentId === 'student-d');
    expect(row).toBeDefined();
    expect(computeAttendeeHours(row!, session)).toBe(2.0);
  });
});

describe('computeSessionHoursAwarded -- per-session sum, cross-checked by hand', () => {
  it('session-m1 (completed, counts hours): hand sum = 1.25 (override) + 1.0 (clamped, inside) + 2.0 (clamped, both ends) + 2.0 (full-duration fallback, late) = 6.25 -> rounds to 6.3; excused/absent rows are correctly excluded', () => {
    const session = sessionById('session-m1');
    const event = eventById('event-weekly-meeting');
    const attendance = attendanceFor('session-m1');
    // Sanity: the fixture really does carry excused/absent rows for this
    // session, so this is a real exclusion test, not a vacuous one.
    expect(attendance.some((row) => row.status === 'excused')).toBe(true);
    expect(attendance.some((row) => row.status === 'absent')).toBe(true);
    expect(computeSessionHoursAwarded(session, event, attendance)).toBe(6.3);
  });

  it('session-m2 (scheduled, not completed): hours not yet determined -> null, not a fabricated 0', () => {
    const session = sessionById('session-m2');
    const event = eventById('event-weekly-meeting');
    expect(computeSessionHoursAwarded(session, event, attendanceFor('session-m2'))).toBeNull();
  });

  it('session-o1 (completed, outreach): hand sum = 3.0 (full-duration fallback) + 2.0 (clamped, inside) = 5.0; absent row excluded', () => {
    const session = sessionById('session-o1');
    const event = eventById('event-park-cleanup');
    const attendance = attendanceFor('session-o1');
    expect(attendance.some((row) => row.status === 'absent')).toBe(true);
    expect(computeSessionHoursAwarded(session, event, attendance)).toBe(5.0);
  });

  it('session-c1 (completed, but parent event does NOT count volunteer hours): real 0, even though present attendance (one with hoursOverride: 8) exists -- constitution item 3 distinction, module doc #4(c)', () => {
    const session = sessionById('session-c1');
    const event = eventById('event-regional-qualifier');
    expect(event.countsVolunteerHours).toBe(false);
    const attendance = attendanceFor('session-c1');
    expect(attendance.some((row) => row.status === 'present' && row.hoursOverride === 8)).toBe(
      true,
    );
    expect(computeSessionHoursAwarded(session, event, attendance)).toBe(0);
  });

  it('session-c2 (canceled): hours not yet determined -> null', () => {
    const session = sessionById('session-c2');
    const event = eventById('event-regional-qualifier');
    expect(computeSessionHoursAwarded(session, event, attendanceFor('session-c2'))).toBeNull();
  });
});

describe('summarizeAttendance / summarizeSignups -- real counts, never fabricated', () => {
  it('session-m1 attendance: 3 present, 1 late, 1 excused, 1 absent', () => {
    expect(summarizeAttendance(attendanceFor('session-m1'))).toEqual({
      presentCt: 3,
      lateCt: 1,
      excusedCt: 1,
      absentCt: 1,
    });
  });

  it('session-o1 signups: 2 going, 1 maybe, 1 declined', () => {
    expect(summarizeSignups(rsvpsFor('session-o1'))).toEqual({
      goingCt: 2,
      maybeCt: 1,
      declinedCt: 1,
    });
  });

  it('session-m2 (no attendance recorded yet): real zero counts, not fabricated', () => {
    expect(summarizeAttendance(attendanceFor('session-m2'))).toEqual({
      presentCt: 0,
      lateCt: 0,
      excusedCt: 0,
      absentCt: 0,
    });
  });
});

describe('buildDisplayRows -- row-count and per-type signup-null cross-checks', () => {
  const rows = buildDisplayRows(
    FIXTURE_EVENTS,
    FIXTURE_SESSIONS,
    FIXTURE_ATTENDANCE,
    FIXTURE_RSVPS,
  );

  it('row count matches the fixture session count exactly (one row per session, not per event)', () => {
    expect(rows).toHaveLength(FIXTURE_SESSIONS.length);
    expect(rows).toHaveLength(5);
  });

  it('meeting-type rows have signups: null (module doc #3, not applicable); outreach/competition rows have real signup summaries', () => {
    const byId = new Map(rows.map((row) => [row.sessionId, row] as const));
    expect(byId.get('session-m1')?.type).toBe('meeting');
    expect(byId.get('session-m1')?.signups).toBeNull();
    expect(byId.get('session-m2')?.signups).toBeNull();
    expect(byId.get('session-o1')?.type).toBe('outreach');
    expect(byId.get('session-o1')?.signups).toEqual({ goingCt: 2, maybeCt: 1, declinedCt: 1 });
    expect(byId.get('session-c1')?.type).toBe('competition');
    expect(byId.get('session-c1')?.signups).toEqual({ goingCt: 2, maybeCt: 0, declinedCt: 1 });
  });

  it('adult-volunteer figures are repeated identically on every session row of the same event (module doc #5 disclosed repetition choice)', () => {
    const byId = new Map(rows.map((row) => [row.sessionId, row] as const));
    const m1 = byId.get('session-m1');
    const m2 = byId.get('session-m2');
    expect(m1?.adultVolunteersCount).toBe(1);
    expect(m1?.adultVolunteerHours).toBe(1.5);
    expect(m2?.adultVolunteersCount).toBe(1);
    expect(m2?.adultVolunteerHours).toBe(1.5);
  });

  it('peopleReached is null (not a fabricated 0) for sessions with no recorded figure, and a real number where recorded', () => {
    const byId = new Map(rows.map((row) => [row.sessionId, row] as const));
    expect(byId.get('session-m1')?.peopleReached).toBeNull();
    expect(byId.get('session-o1')?.peopleReached).toBe(150);
    expect(byId.get('session-c1')?.peopleReached).toBe(75);
  });

  it('rows are sorted chronologically by session start time', () => {
    const startTimes = rows.map((row) => {
      const session = FIXTURE_SESSIONS.find((s) => s.id === row.sessionId);
      return session!.startsAt;
    });
    const sorted = [...startTimes].sort((a, b) => a.localeCompare(b));
    expect(startTimes).toEqual(sorted);
  });
});

describe('EVENT_TYPE_BADGE / SESSION_STATUS_BADGE -- DES-04 / status variant mappings', () => {
  it('DES-04: meeting=purple, outreach=blue, competition=orange', () => {
    expect(EVENT_TYPE_BADGE.meeting).toEqual({ variant: 'purple', label: 'Meeting' });
    expect(EVENT_TYPE_BADGE.outreach).toEqual({ variant: 'blue', label: 'Outreach' });
    expect(EVENT_TYPE_BADGE.competition).toEqual({ variant: 'orange', label: 'Competition' });
  });

  it('session status: scheduled=info, completed=success, canceled=error (canceled visually distinct)', () => {
    expect(SESSION_STATUS_BADGE.scheduled.variant).toBe('info');
    expect(SESSION_STATUS_BADGE.completed.variant).toBe('success');
    expect(SESSION_STATUS_BADGE.canceled.variant).toBe('error');
  });
});

describe('formatSessionDate -- NFR-09 America/Chicago rendering', () => {
  it('formats a session_date without a fabricated off-by-one day shift', () => {
    expect(formatSessionDate('2026-07-07')).toBe('Tue, Jul 7, 2026');
  });
});

// ---------------------------------------------------------------------------
// Full-component DOM render across DES-12's four states.
// ---------------------------------------------------------------------------

describe('EventsTab component -- DES-12 four states', () => {
  it('renders a loading Spinner, then the populated Table with real values from every fixture session', async () => {
    act(() => {
      root.render(<EventsTab seasonId={PLACEHOLDER_CURRENT_SEASON_ID} />);
    });
    expect(container.textContent).toContain('Loading events data');

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('Weekly Team Meeting');
    expect(container.textContent).toContain('Park Cleanup');
    expect(container.textContent).toContain('Regional Qualifier');
    expect(container.textContent).toContain('Meeting');
    expect(container.textContent).toContain('Outreach');
    expect(container.textContent).toContain('Competition');
    expect(container.textContent).toContain('Scheduled');
    expect(container.textContent).toContain('Completed');
    expect(container.textContent).toContain('Canceled');
    // session-m1's hand-computed 6.3h hours-awarded figure really renders.
    expect(container.textContent).toContain('6.3h');
    // session-c1's real-zero (event doesn't count hours) figure really
    // renders as 0.0h, not "—".
    expect(container.textContent).toContain('0.0h');
    // session-o1's signups summary.
    expect(container.textContent).toContain('2 going · 1 maybe · 1 declined');
    // session-m1's attendance summary.
    expect(container.textContent).toContain('3 present · 1 late · 1 excused · 1 absent');
    // session-o1's people-reached figure.
    expect(container.textContent).toContain('150');
  });

  it('renders an error Banner when loadData rejects', async () => {
    act(() => {
      root.render(
        <EventsTab
          seasonId={PLACEHOLDER_CURRENT_SEASON_ID}
          loadData={() => Promise.reject(new Error('network down'))}
        />,
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain("Couldn't load events data");
  });

  it('renders an EmptyState when a season has no sessions at all', async () => {
    act(() => {
      root.render(
        <EventsTab
          seasonId={PLACEHOLDER_CURRENT_SEASON_ID}
          loadData={() => Promise.resolve<EventSessionDisplayRow[]>([])}
        />,
      );
    });

    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(container.textContent).toContain('No sessions for this season yet');
  });

  it('defaultLoadEventSessionsData returns a season-scoped, empty array for an unknown season id (no cross-season leakage)', async () => {
    const rows = await defaultLoadEventSessionsData('season-does-not-exist');
    expect(rows).toEqual([]);
  });
});
