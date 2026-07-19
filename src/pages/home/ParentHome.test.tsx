// @vitest-environment jsdom
/**
 * T055: tests for `ParentHome.tsx`.
 *
 * Per this task's Allowed Files ("A colocated `ParentHome.test.tsx` is
 * acceptable per established precedent -- disclose it") this test file is
 * the same class of addition `CoachHome.test.tsx`/T053,
 * `OutreachList.test.tsx`/T038, `StudentMeetingView.test.tsx`/T037 already
 * made in their own sibling directories.
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- these tests use the same raw `createRoot`/`act`
 * pattern `CoachHome.test.tsx`/`OutreachList.test.tsx` already established,
 * including their `AuthProvider` + `LoginAs` role-login harness.
 */
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthProvider, useAuth, type AuthUser } from '../../app/guards';
import {
  applyRsvpOverride,
  buildNextEventsForStudent,
  defaultLoadLinkedStudents,
  defaultLoadStudentHomeCardData,
  findConfirmedHours,
  findParticipationMetric,
  FIXTURE_REFERENCE_NOW,
  hoursVsGoalPercent,
  isEventInTeamScope,
  NEXT_EVENTS_LIMIT,
  ParentHome,
  studentGoalHours,
  WEEKLY_SUMMARY_FOOTER_NOTE,
  type HomeEventRow,
  type HomeRsvpRow,
  type HomeSessionRow,
  type LinkedStudentsResult,
  type StudentHoursMetric,
} from './ParentHome';

// ---------------------------------------------------------------------------
// Render harness -- mirrors CoachHome.test.tsx / OutreachList.test.tsx.
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

const PARENT_USER: AuthUser = { id: 'user-parent', email: 'parent@example.com', role: 'parent' };

function LoginAs({ user, children }: { user: AuthUser; children: ReactNode }): ReactNode {
  const { login, user: currentUser } = useAuth();
  if (currentUser === null) {
    login(user);
  }
  return <>{children}</>;
}

function renderAsUser(user: AuthUser | null, props: Parameters<typeof ParentHome>[0] = {}): void {
  act(() => {
    root.render(
      <MemoryRouter>
        <AuthProvider>
          {user === null ? (
            <ParentHome {...props} />
          ) : (
            <LoginAs user={user}>
              <ParentHome {...props} />
            </LoginAs>
          )}
        </AuthProvider>
      </MemoryRouter>,
    );
  });
}

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
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
  act(() => {
    root.unmount();
  });
  container.remove();
});

const REF_NOW_MS = FIXTURE_REFERENCE_NOW.getTime();

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

describe('isEventInTeamScope', () => {
  it('null team_ids means all teams', () => {
    expect(isEventInTeamScope({ teamIds: null }, 'team-a')).toBe(true);
  });
  it('matches only listed team ids', () => {
    expect(isEventInTeamScope({ teamIds: ['team-a'] }, 'team-a')).toBe(true);
    expect(isEventInTeamScope({ teamIds: ['team-b'] }, 'team-a')).toBe(false);
  });
});

describe('studentGoalHours / hoursVsGoalPercent (MET-04, no metric-view arithmetic duplicated)', () => {
  it('falls back to the season default when no override is set', () => {
    expect(studentGoalHours({ goalHoursOverride: null }, 100)).toBe(100);
    expect(studentGoalHours({ goalHoursOverride: 20 }, 100)).toBe(20);
  });

  it('computes percent, capped at 100, 0 when goal is 0', () => {
    expect(hoursVsGoalPercent(62, 100)).toBe(62);
    expect(hoursVsGoalPercent(150, 100)).toBe(100);
    expect(hoursVsGoalPercent(5, 0)).toBe(0);
  });
});

describe('findConfirmedHours / findParticipationMetric (module doc #2 -- lookup only, never re-derived)', () => {
  const hours: StudentHoursMetric[] = [
    { studentId: 's1', seasonId: 'season-1', confirmedHours: 62 },
  ];

  it('returns the pre-computed row verbatim', () => {
    expect(findConfirmedHours('s1', 'season-1', hours)).toBe(62);
  });

  it('defaults to 0 (never a fabricated value) when the student has no row yet', () => {
    expect(findConfirmedHours('s2', 'season-1', hours)).toBe(0);
  });

  it('returns null (never a fabricated %) when the student has no participation row', () => {
    expect(findParticipationMetric('nobody', [])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// "Next 3 events" boundary logic -- the packet's own required boundary
// proof: a student with 5 upcoming events shows only the nearest 3; a
// student with 1 shows just 1, no padding. Plus type- and team-scope
// exclusion, isolated from the date-sorting behavior.
// ---------------------------------------------------------------------------

describe('buildNextEventsForStudent (Next 3 events boundary proof)', () => {
  const events: HomeEventRow[] = [
    { id: 'e-meeting', seasonId: 's1', type: 'meeting', title: 'Build', teamIds: ['team-a'] },
    { id: 'e-outreach', seasonId: 's1', type: 'outreach', title: 'Fair', teamIds: ['team-a'] },
    {
      id: 'e-competition',
      seasonId: 's1',
      type: 'competition',
      title: 'Regionals',
      teamIds: ['team-a'],
    },
    {
      id: 'e-wrong-team',
      seasonId: 's1',
      type: 'outreach',
      title: 'Other Team',
      teamIds: ['team-b'],
    },
  ];

  function scheduledSession(id: string, eventId: string, offsetDays: number): HomeSessionRow {
    const startsAt = new Date(REF_NOW_MS + offsetDays * 86_400_000).toISOString();
    const endsAt = new Date(REF_NOW_MS + offsetDays * 86_400_000 + 3_600_000).toISOString();
    return {
      id,
      eventId,
      sessionDate: startsAt.slice(0, 10),
      startsAt,
      endsAt,
      status: 'scheduled',
    };
  }

  it('caps at exactly 3 (default limit) when 5 qualifying sessions exist, nearest-first', () => {
    const sessions: HomeSessionRow[] = [
      scheduledSession('s1', 'e-meeting', 2),
      scheduledSession('s2', 'e-outreach', 6),
      scheduledSession('s3', 'e-meeting', 9),
      scheduledSession('s4', 'e-outreach', 13),
      scheduledSession('s5', 'e-meeting', 16),
    ];
    const rows = buildNextEventsForStudent(sessions, events, 'team-a', REF_NOW_MS);
    expect(NEXT_EVENTS_LIMIT).toBe(3);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.sessionId)).toEqual(['s1', 's2', 's3']);
  });

  it('shows exactly 1 event for a student with only 1 upcoming -- never padded to 3', () => {
    const sessions: HomeSessionRow[] = [scheduledSession('only', 'e-outreach', 4)];
    const rows = buildNextEventsForStudent(sessions, events, 'team-a', REF_NOW_MS);
    expect(rows).toHaveLength(1);
    expect(rows[0].sessionId).toBe('only');
  });

  it('shows zero events (not padded, not a crash) for a student with none', () => {
    expect(buildNextEventsForStudent([], events, 'team-a', REF_NOW_MS)).toEqual([]);
  });

  it('excludes competition-type sessions even when they sort earliest', () => {
    const sessions: HomeSessionRow[] = [
      scheduledSession('comp', 'e-competition', 1), // earliest, but wrong type
      scheduledSession('meet', 'e-meeting', 5),
    ];
    const rows = buildNextEventsForStudent(sessions, events, 'team-a', REF_NOW_MS);
    expect(rows.map((r) => r.sessionId)).toEqual(['meet']);
  });

  it('excludes out-of-team-scope sessions', () => {
    const sessions: HomeSessionRow[] = [scheduledSession('other-team', 'e-wrong-team', 3)];
    expect(buildNextEventsForStudent(sessions, events, 'team-a', REF_NOW_MS)).toEqual([]);
  });

  it('excludes already-ended and non-scheduled sessions', () => {
    const past: HomeSessionRow = {
      id: 'past',
      eventId: 'e-meeting',
      sessionDate: '2026-07-01',
      startsAt: new Date(REF_NOW_MS - 86_400_000).toISOString(),
      endsAt: new Date(REF_NOW_MS - 82_800_000).toISOString(),
      status: 'scheduled',
    };
    const completed: HomeSessionRow = {
      id: 'completed',
      eventId: 'e-meeting',
      sessionDate: '2026-07-10',
      startsAt: new Date(REF_NOW_MS + 86_400_000).toISOString(),
      endsAt: new Date(REF_NOW_MS + 90_000_000).toISOString(),
      status: 'completed',
    };
    expect(buildNextEventsForStudent([past, completed], events, 'team-a', REF_NOW_MS)).toEqual([]);
  });
});

describe('applyRsvpOverride (local-only, module doc #6)', () => {
  it('synthesizes a new row when none existed (the unanswered case)', () => {
    const result = applyRsvpOverride([], 's1', 'sess-1', 'going');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ studentId: 's1', sessionId: 'sess-1', status: 'going' });
    // Never sets attribution copy -- T043's job (module doc #6).
    expect(result[0].respondedBy).toBeNull();
  });

  it('updates an existing row in place, leaving other rows untouched', () => {
    const initial: HomeRsvpRow[] = [
      {
        id: 'r1',
        sessionId: 'sess-1',
        studentId: 's1',
        status: 'maybe',
        respondedBy: null,
        updatedAt: '',
      },
      {
        id: 'r2',
        sessionId: 'sess-2',
        studentId: 's1',
        status: 'going',
        respondedBy: null,
        updatedAt: '',
      },
    ];
    const result = applyRsvpOverride(initial, 's1', 'sess-1', 'declined');
    expect(result).toHaveLength(2);
    expect(result.find((r) => r.sessionId === 'sess-1')?.status).toBe('declined');
    expect(result.find((r) => r.sessionId === 'sess-2')?.status).toBe('going'); // untouched
  });
});

// ---------------------------------------------------------------------------
// The shipped fixture -- proves the exported functions compose correctly
// against real, multi-student data (Ada/Bea/Cleo).
// ---------------------------------------------------------------------------

describe('defaultLoadLinkedStudents / defaultLoadStudentHomeCardData (shipped fixture)', () => {
  it('returns more than one linked student -- genuinely plural (core structural requirement)', async () => {
    const result: LinkedStudentsResult = await defaultLoadLinkedStudents();
    expect(result.students.length).toBeGreaterThan(1);
    expect(result.students.map((s) => s.displayName)).toEqual(['Ada R.', 'Bea R.', 'Cleo R.']);
  });

  it("Ada: 62/100 hours (62%), 87% participation, matching the PRD wireframe's own worked example", async () => {
    const { students } = await defaultLoadLinkedStudents();
    const ada = students.find((s) => s.displayName === 'Ada R.')!;
    const data = await defaultLoadStudentHomeCardData(ada.studentId, ada.teamId);
    expect(data.confirmedHours).toBe(62);
    expect(
      hoursVsGoalPercent(data.confirmedHours, studentGoalHours(ada, data.defaultGoalHours)),
    ).toBe(62);
    expect(data.participation?.participationPct).toBe(87);
    // 5 upcoming sessions in her own scope -> capped to 3 (boundary proof
    // against the real shipped fixture, not just a synthetic unit case).
    expect(data.nextEvents).toHaveLength(3);
    // 5 completed meeting sessions -> consistency strip caps at 5.
    expect(data.consistencyEntries).toHaveLength(5);
  });

  it('Bea: exactly 1 upcoming event (never padded), 2 completed meetings, unanswered RSVP', async () => {
    const { students } = await defaultLoadLinkedStudents();
    const bea = students.find((s) => s.displayName === 'Bea R.')!;
    const data = await defaultLoadStudentHomeCardData(bea.studentId, bea.teamId);
    expect(data.nextEvents).toHaveLength(1);
    expect(data.consistencyEntries).toHaveLength(2);
    expect(data.rsvps).toHaveLength(0); // unanswered -- no rsvp row yet
  });

  it('Cleo: genuinely empty (0 hours row, 0 participation row, 0 upcoming, 0 completed) -- never a crash', async () => {
    const { students } = await defaultLoadLinkedStudents();
    const cleo = students.find((s) => s.displayName === 'Cleo R.')!;
    const data = await defaultLoadStudentHomeCardData(cleo.studentId, cleo.teamId);
    expect(data.confirmedHours).toBe(5); // has an hours row, but...
    expect(data.participation).toBeNull(); // ...no participation row yet
    expect(data.nextEvents).toEqual([]);
    expect(data.consistencyEntries).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// <ParentHome /> component -- DES-12 states at both levels, real
// multi-student rendering, per-card independence, and the RSVP-on-behalf
// control working live.
// ---------------------------------------------------------------------------

describe('<ParentHome /> signed out', () => {
  it('shows a sign-in prompt', () => {
    renderAsUser(null);
    expect(container.textContent).toContain('Sign in to view Home');
  });
});

describe('<ParentHome /> page-level DES-12 states', () => {
  it('loading state', () => {
    renderAsUser(PARENT_USER, {
      loadLinkedStudents: () => new Promise<LinkedStudentsResult>(() => {}),
    });
    expect(container.textContent).toContain('Loading Home');
  });

  it('error state', async () => {
    renderAsUser(PARENT_USER, { loadLinkedStudents: () => Promise.reject(new Error('boom')) });
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't load Home");
  });

  it('empty state: zero linked students', async () => {
    renderAsUser(PARENT_USER, {
      loadLinkedStudents: () => Promise.resolve({ students: [], teams: [] }),
    });
    await flushMicrotasks();
    expect(container.textContent).toContain('No linked students yet');
  });
});

describe('<ParentHome /> populated: multi-student rendering (core structural requirement)', () => {
  it('renders one independent Card per linked student, never assuming a single child', async () => {
    renderAsUser(PARENT_USER, {
      loadLinkedStudents: defaultLoadLinkedStudents,
      loadStudentData: defaultLoadStudentHomeCardData,
    });
    await flushMicrotasks();

    // All three fixture children's names AND team badges appear.
    expect(container.textContent).toContain('Ada R.');
    expect(container.textContent).toContain('Gear Girls');
    expect(container.textContent).toContain('Bea R.');
    expect(container.textContent).toContain('P3');
    expect(container.textContent).toContain('Cleo R.');
    expect(container.textContent).toContain('Iron Wolves');

    // Ada's next-3 boundary is visible in the rendered DOM too.
    expect(container.textContent).toContain('Weekly Build Meeting');
    expect(container.textContent).toContain('STEM Fair');
    // Bea's only upcoming event.
    expect(container.textContent).toContain('Community Garden Day');
    // Cleo's genuinely-empty next-up section.
    expect(container.textContent).toContain('Nothing scheduled');

    // The literal footer note, verbatim.
    expect(container.textContent).toContain(WEEKLY_SUMMARY_FOOTER_NOTE);

    // Constitution item 13: no box-drawing/bracket characters rendered.
    expect(container.textContent).not.toMatch(/[┌─│[\]]/);
  });

  it('one card can still be loading while a sibling card is already populated (genuine per-card independence)', async () => {
    async function staggeredLoadData(
      studentId: string,
      teamId: string,
    ): Promise<Awaited<ReturnType<typeof defaultLoadStudentHomeCardData>>> {
      if (studentId.includes('bea')) {
        // Never resolves within this test -- Bea's card stays "loading".
        return new Promise(() => {});
      }
      return defaultLoadStudentHomeCardData(studentId, teamId);
    }

    renderAsUser(PARENT_USER, {
      loadLinkedStudents: defaultLoadLinkedStudents,
      loadStudentData: staggeredLoadData,
    });
    await flushMicrotasks();

    // Ada's card (resolved) is fully populated...
    expect(container.textContent).toContain('STEM Fair');
    // ...while Bea's card (never resolved) is still showing its own,
    // independent Spinner -- not blocked by/blocking Ada's card.
    expect(container.textContent).toContain("Loading Bea R.'s Home card");
  });

  it("a card-level load error on one student doesn't affect a sibling's populated card", async () => {
    async function partiallyFailingLoadData(
      studentId: string,
      teamId: string,
    ): Promise<Awaited<ReturnType<typeof defaultLoadStudentHomeCardData>>> {
      if (studentId.includes('cleo')) {
        throw new Error('boom');
      }
      return defaultLoadStudentHomeCardData(studentId, teamId);
    }

    renderAsUser(PARENT_USER, {
      loadLinkedStudents: defaultLoadLinkedStudents,
      loadStudentData: partiallyFailingLoadData,
    });
    await flushMicrotasks();

    expect(container.textContent).toContain("Couldn't load this student's Home card");
    // Ada's card, loaded via the same shared seam, is unaffected.
    expect(container.textContent).toContain('STEM Fair');
  });
});

describe('<ParentHome /> RSVP-on-behalf control (OUT-06 preview, real local state)', () => {
  it("reflects Ada's existing 'maybe' RSVP for STEM Fair as the pre-checked segment", async () => {
    renderAsUser(PARENT_USER, {
      loadLinkedStudents: defaultLoadLinkedStudents,
      loadStudentData: defaultLoadStudentHomeCardData,
    });
    await flushMicrotasks();

    const fairGroup = Array.from(container.querySelectorAll('[role="radiogroup"]')).find((el) =>
      el.getAttribute('aria-label')?.startsWith('RSVP on behalf of Ada R. for STEM Fair'),
    );
    expect(fairGroup).toBeTruthy();
    expect(
      fairGroup?.querySelector('button[data-value="maybe"]')?.getAttribute('aria-checked'),
    ).toBe('true');
  });

  it("Bea's unanswered outreach RSVP shows no pre-checked segment", async () => {
    renderAsUser(PARENT_USER, {
      loadLinkedStudents: defaultLoadLinkedStudents,
      loadStudentData: defaultLoadStudentHomeCardData,
    });
    await flushMicrotasks();

    const gardenGroup = Array.from(container.querySelectorAll('[role="radiogroup"]')).find((el) =>
      el
        .getAttribute('aria-label')
        ?.startsWith('RSVP on behalf of Bea R. for Community Garden Day'),
    );
    expect(gardenGroup).toBeTruthy();
    for (const value of ['going', 'maybe', 'declined']) {
      expect(
        gardenGroup?.querySelector(`button[data-value="${value}"]`)?.getAttribute('aria-checked'),
      ).toBe('false');
    }
  });

  it('clicking a segment updates the RSVP live (real local state, not a no-op)', async () => {
    renderAsUser(PARENT_USER, {
      loadLinkedStudents: defaultLoadLinkedStudents,
      loadStudentData: defaultLoadStudentHomeCardData,
    });
    await flushMicrotasks();

    const fairGroup = Array.from(container.querySelectorAll('[role="radiogroup"]')).find((el) =>
      el.getAttribute('aria-label')?.startsWith('RSVP on behalf of Ada R. for STEM Fair'),
    );
    const goingButton = fairGroup?.querySelector('button[data-value="going"]');
    expect(goingButton).toBeTruthy();

    act(() => {
      goingButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(
      fairGroup?.querySelector('button[data-value="going"]')?.getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      fairGroup?.querySelector('button[data-value="maybe"]')?.getAttribute('aria-checked'),
    ).toBe('false');
  });

  it('a meeting-type next-up row is read-only -- no SegmentedControl rendered for it', async () => {
    renderAsUser(PARENT_USER, {
      loadLinkedStudents: defaultLoadLinkedStudents,
      loadStudentData: defaultLoadStudentHomeCardData,
    });
    await flushMicrotasks();

    // "Weekly Build Meeting" (Ada's meeting-type next-up row) must never
    // have an associated radiogroup -- meetings are read-only (module doc #6).
    const meetingGroup = Array.from(container.querySelectorAll('[role="radiogroup"]')).find((el) =>
      el.getAttribute('aria-label')?.includes('Weekly Build Meeting'),
    );
    expect(meetingGroup).toBeUndefined();
    expect(container.textContent).toContain('Meeting — read-only');
  });
});

// ---------------------------------------------------------------------------
// BEH-06 no-streak-mechanics proof (rendered DOM) -- this file adds no NEW
// attendance-selection logic (it reuses `ConsistencyStrip`/
// `selectLastCompletedAttendance` verbatim), but this proves the reused
// widget's own BEH-06 guarantee survives being embedded on this page.
// ---------------------------------------------------------------------------

describe('BEH-06 no-streak-mechanics proof, embedded in ParentHome', () => {
  it('never renders streak-shaped copy anywhere on the fully populated page', async () => {
    renderAsUser(PARENT_USER, {
      loadLinkedStudents: defaultLoadLinkedStudents,
      loadStudentData: defaultLoadStudentHomeCardData,
    });
    await flushMicrotasks();

    const text = container.textContent ?? '';
    expect(text.toLowerCase()).not.toContain('streak');
    expect(text.toLowerCase()).not.toContain("don't break");
    expect(text.toLowerCase()).not.toContain('keep it up');
  });
});
