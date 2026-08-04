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
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthProvider, type AuthUser } from '../../app/guards';
import { LoginAs } from '../../test-utils/authHarness';
import {
  makeLoadLinkedStudentsForParentHome,
  makeLoadStudentHomeCardDataForParentHome,
} from '../../lib/supabase/loaders/parentHome';
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
  WEEKLY_SUMMARY_FOOTER_NOTE,
  type HomeEventRow,
  type HomeRsvpRow,
  type HomeSessionRow,
  type LinkedStudentRow,
  type LinkedStudentsResult,
  type StudentHomeCardData,
  type StudentHoursMetric,
} from './ParentHome';

// ---------------------------------------------------------------------------
// Render harness -- mirrors CoachHome.test.tsx / OutreachList.test.tsx.
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

const PARENT_USER: AuthUser = { id: 'user-parent', email: 'parent@example.com', role: 'parent' };

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
// T181: a minimal chainable Postgrest-response stub, shared by every test
// below that exercises the REAL `loaders/parentHome.ts` factories
// (`makeLoadLinkedStudentsForParentHome`/`makeLoadStudentHomeCardDataForParentHome`)
// against an injected `getClient`, rather than a hand-written fixture-shaped
// object -- proves the real loader's own composition/mapping, not just this
// component's rendering. Every chain method (`select`/`eq`/`in`/`order`)
// returns the SAME thenable object, which resolves to the caller-supplied
// `{data, error}` no matter how many/which chain methods were called before
// it -- `.maybeSingle()` is the one exception, resolving a real `Promise`
// directly (matching real `supabase-js` behavior at that terminal call).
// ---------------------------------------------------------------------------

interface FakeQueryResult {
  data: unknown;
  error: { message: string } | null;
}

function makeChain(result: FakeQueryResult): Record<string, unknown> {
  const chain: Record<string, unknown> = {};
  chain.select = () => chain;
  chain.eq = () => chain;
  chain.in = () => chain;
  chain.order = () => chain;
  chain.is = () => chain;
  chain.maybeSingle = () => Promise.resolve(result);
  chain.then = (
    onFulfilled: (value: FakeQueryResult) => unknown,
    onRejected?: (reason: unknown) => unknown,
  ) => Promise.resolve(result).then(onFulfilled, onRejected);
  return chain;
}

/** `byTable` keys are real table/view names this file's own loaders query
 * (module doc in `loaders/parentHome.ts`). Querying an un-stubbed table
 * throws immediately, surfacing an unexpected-query bug loudly rather than
 * silently resolving `undefined`. */
function makeFakeClient(byTable: Record<string, FakeQueryResult>): SupabaseClient {
  return {
    from: (table: string) => {
      const result = byTable[table];
      if (result === undefined) {
        throw new Error(`unexpected table/view queried: ${table}`);
      }
      return makeChain(result);
    },
  } as unknown as SupabaseClient;
}

function makeFakeAuthClient(
  session: { userId: string } | null,
  extraTables: Record<string, FakeQueryResult> = {},
): SupabaseClient {
  const client = makeFakeClient({
    guardian_links: { data: [], error: null },
    students: { data: [], error: null },
    teams: { data: [], error: null },
    ...extraTables,
  });
  return {
    ...client,
    auth: {
      getSession: async () => ({
        data: { session: session ? { user: { id: session.userId } } : null },
        error: null,
      }),
    },
  } as unknown as SupabaseClient;
}

/** A fully-honest-empty per-card result -- every field genuinely absent/zero,
 * never a fabricated non-zero value. Reused by several tests below as a
 * minimal, valid `StudentHomeCardData`. */
const EMPTY_CARD_DATA: StudentHomeCardData = {
  goalHours: 0,
  confirmedHours: 0,
  participation: null,
  consistencyEntries: [],
  nextEvents: [],
  rsvps: [],
};

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

describe('isEventInTeamScope', () => {
  it('null team_ids means all teams', () => {
    expect(isEventInTeamScope({ teamIds: null }, ['team-a'])).toBe(true);
  });
  it('matches only listed team ids', () => {
    expect(isEventInTeamScope({ teamIds: ['team-a'] }, ['team-a'])).toBe(true);
    expect(isEventInTeamScope({ teamIds: ['team-b'] }, ['team-a'])).toBe(false);
  });
});

describe('hoursVsGoalPercent (MET-04, no metric-view arithmetic duplicated)', () => {
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
    const rows = buildNextEventsForStudent(sessions, events, ['team-a'], REF_NOW_MS);
    expect(NEXT_EVENTS_LIMIT).toBe(3);
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.sessionId)).toEqual(['s1', 's2', 's3']);
  });

  it('shows exactly 1 event for a student with only 1 upcoming -- never padded to 3', () => {
    const sessions: HomeSessionRow[] = [scheduledSession('only', 'e-outreach', 4)];
    const rows = buildNextEventsForStudent(sessions, events, ['team-a'], REF_NOW_MS);
    expect(rows).toHaveLength(1);
    expect(rows[0].sessionId).toBe('only');
  });

  it('shows zero events (not padded, not a crash) for a student with none', () => {
    expect(buildNextEventsForStudent([], events, ['team-a'], REF_NOW_MS)).toEqual([]);
  });

  it('excludes competition-type sessions even when they sort earliest', () => {
    const sessions: HomeSessionRow[] = [
      scheduledSession('comp', 'e-competition', 1), // earliest, but wrong type
      scheduledSession('meet', 'e-meeting', 5),
    ];
    const rows = buildNextEventsForStudent(sessions, events, ['team-a'], REF_NOW_MS);
    expect(rows.map((r) => r.sessionId)).toEqual(['meet']);
  });

  it('excludes out-of-team-scope sessions', () => {
    const sessions: HomeSessionRow[] = [scheduledSession('other-team', 'e-wrong-team', 3)];
    expect(buildNextEventsForStudent(sessions, events, ['team-a'], REF_NOW_MS)).toEqual([]);
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
    expect(buildNextEventsForStudent([past, completed], events, ['team-a'], REF_NOW_MS)).toEqual([]);
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
    // T181: `goalHours` is now a verbatim per-student field (module doc #2),
    // not a TS-side `goalHoursOverride ?? defaultGoalHours` coalesce.
    expect(data.goalHours).toBe(100);
    expect(hoursVsGoalPercent(data.confirmedHours, data.goalHours)).toBe(62);
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
  it('loading state', async () => {
    renderAsUser(PARENT_USER, {
      loadLinkedStudents: () => new Promise<LinkedStudentsResult>(() => {}),
    });
    // T073b2: auth resolution (even via the fake `authModule` this
    // harness's `LoginAs` now uses) is genuinely async -- a flush is needed
    // before the authenticated body (and its own DES-12 loading state)
    // mounts. See `src/test-utils/authHarness.tsx`'s module doc.
    await flushMicrotasks();
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
    // independent Skeleton (T081) -- not blocked by/blocking Ada's card.
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

// ---------------------------------------------------------------------------
// T181: `ParentHome` gets a real backend. C1-C6/C10/C12 -- every negative
// assertion below is paired with a positive (the single most important rule
// in this task's own packet -- absence-only assertions have gone vacuous
// seven times on this project).
// ---------------------------------------------------------------------------

describe('<ParentHome /> C1: outer seam renders real, distinct names, both ways (BLOCKER 1)', () => {
  it('renders injected non-fixture linked-student names/teams; none of the three fixture names appear', async () => {
    const injected: LinkedStudentsResult = {
      students: [
        {
          studentId: 'student-c1-real',
          displayName: 'Priya Nkemelu',
          teamId: 'team-c1-real',
          isActive: true,
        },
      ],
      teams: [{ id: 'team-c1-real', name: 'Circuit Breakers' }],
    };
    renderAsUser(PARENT_USER, {
      loadLinkedStudents: async () => injected,
      loadStudentData: async () => EMPTY_CARD_DATA,
    });
    await flushMicrotasks();

    expect(container.textContent).toContain('Priya Nkemelu');
    expect(container.textContent).toContain('Circuit Breakers');
    expect(container.textContent).not.toContain('Ada R.');
    expect(container.textContent).not.toContain('Bea R.');
    expect(container.textContent).not.toContain('Cleo R.');
  });

  it('regression proof: no props at all renders the honest page-level error banner, never fixture names (mutation target: BLOCKER 1)', async () => {
    // No `loadLinkedStudents`/`loadStudentData` props at all -- the real
    // defaults (`loadLinkedStudentsForParentHome`/
    // `loadStudentHomeCardDataForParentHome`, wired per this task) run in
    // this jsdom/vitest environment where Supabase is unconfigured, and
    // genuinely fail. Gate round 1 measured this exact assertion pair goes
    // red when the prop default is reverted to `defaultLoadLinkedStudents`
    // (see this task's own worker output for the captured mutation run).
    renderAsUser(PARENT_USER);
    await flushMicrotasks();

    expect(container.textContent).toContain("Couldn't load Home");
    expect(container.textContent).not.toContain('Ada R.');
    expect(container.textContent).not.toContain('Bea R.');
    expect(container.textContent).not.toContain('Cleo R.');
  });
});

describe('<ParentHome /> C2: per-card data is real and distinct (MAJOR 5)', () => {
  const C2_STUDENT: LinkedStudentRow = {
    studentId: 'student-c2-real',
    displayName: 'Zara Voss',
    teamId: 'team-c2-real',
    isActive: true,
  };
  const C2_LINKED: LinkedStudentsResult = {
    students: [C2_STUDENT],
    teams: [{ id: 'team-c2-real', name: 'Nova Squad' }],
  };
  const C2_CARD_DATA: StudentHomeCardData = {
    goalHours: 47,
    confirmedHours: 31,
    participation: null,
    consistencyEntries: [],
    nextEvents: [
      {
        sessionId: 'session-c2-real',
        eventId: 'event-c2-real',
        title: 'Distinct Custom Workshop',
        type: 'outreach',
        sessionDate: '2026-08-01',
        startsAt: '2026-08-01T15:00:00.000Z',
        endsAt: '2026-08-01T17:00:00.000Z',
      },
    ],
    rsvps: [],
  };

  it('injected outer + per-card data renders distinct, non-fixture figures/title via textContent and aria-valuetext', async () => {
    renderAsUser(PARENT_USER, {
      loadLinkedStudents: async () => C2_LINKED,
      loadStudentData: async () => C2_CARD_DATA,
    });
    await flushMicrotasks();

    expect(container.textContent).toContain('Zara Voss');
    expect(container.textContent).toContain('Nova Squad');
    expect(container.textContent).toContain('Distinct Custom Workshop');
    const progressBar = container.querySelector('[role="progressbar"]');
    expect(progressBar).toBeTruthy();
    // hoursVsGoalPercent(31, 47) = 66.0 -> capped/rounded, matches the real render.
    expect(progressBar!.getAttribute('aria-valuetext')).toBe('31 / 47 h (66%)');
    // Never the shipped fixture's own figures/titles.
    expect(container.textContent).not.toContain('Weekly Build Meeting');
    expect(container.textContent).not.toContain('STEM Fair');
    expect(container.textContent).not.toContain('Community Garden Day');
  });

  it('regression proof: per-card default omitted shows the per-card error banner, not fixture figures/titles (mutation target: MAJOR 5)', async () => {
    // `loadLinkedStudents` succeeds (injected); `loadStudentData` is
    // deliberately OMITTED so the real, unconfigured-in-jsdom
    // `loadStudentHomeCardDataForParentHome` default runs and fails.
    renderAsUser(PARENT_USER, { loadLinkedStudents: async () => C2_LINKED });
    await flushMicrotasks();

    expect(container.textContent).toContain("Couldn't load this student's Home card");
    expect(container.textContent).not.toContain('Weekly Build Meeting');
    expect(container.textContent).not.toContain('STEM Fair');
    expect(container.textContent).not.toContain('Community Garden Day');
  });
});

describe('<ParentHome /> C3: goalHours is a verbatim passthrough, never TS-recomputed (constitution item 3, unblocked by BLOCKER 2)', () => {
  it("renders resolveStudentScope's real goal_hours (63) verbatim, never a co-present raw override (999)", async () => {
    const studentId = 'student-c3-real';
    const teamId = 'team-c3-real';
    const fakeClient = makeFakeClient({
      event_sessions: { data: [], error: null },
      attendance: { data: [], error: null },
      v_student_participation: { data: [], error: null },
      // The real view row: goal_hours = 63.
      v_student_goal_projection: {
        data: { team_id: teamId, goal_hours: 63, confirmed_hours: 10, planned_hours: 0 },
        error: null,
      },
      events: { data: [], error: null },
      rsvps: { data: [], error: null },
      // A co-present raw override this file's real query never selects and
      // never reads -- present here only to prove a reintroduced TS-side
      // coalesce (this criterion's own mutation) WOULD pick it up.
      students: { data: [{ id: studentId, goal_hours_override: 999 }], error: null },
      student_teams: { data: [], error: null },
    });
    const loadStudentData = makeLoadStudentHomeCardDataForParentHome(() => fakeClient);
    const injected: LinkedStudentsResult = {
      students: [{ studentId, displayName: 'Nadia Okafor', teamId, isActive: true }],
      teams: [{ id: teamId, name: 'Vector Vipers' }],
    };

    renderAsUser(PARENT_USER, { loadLinkedStudents: async () => injected, loadStudentData });
    await flushMicrotasks();

    const progressBar = container.querySelector('[role="progressbar"]');
    expect(progressBar).toBeTruthy();
    // value=confirmedHours(10), max=goalHours(63) -> hoursVsGoalPercent(10,63) = 15.9.
    expect(progressBar!.getAttribute('aria-valuetext')).toBe('10 / 63 h (15.9%)');
    expect(progressBar!.getAttribute('aria-valuetext')).not.toContain('999');
  });
});

describe("<ParentHome /> C4: a deactivated linked student's card is honest and present", () => {
  /** Scopes a `[role="progressbar"]` query to the Hours-vs-goal section's own
   * bar. Astryx's `ProgressBar` sets `aria-labelledby` (pointing at a sibling
   * label element) on the progressbar div itself, NOT `aria-label` --
   * verified against `node_modules/@astryxdesign/core/src/ProgressBar/
   * ProgressBar.tsx:333`. (This differs from this file's own `[role=
   * "radiogroup"]` queries above, e.g. line 940, which DO read `aria-label`
   * directly -- that's `SegmentedControl`, a different component with a
   * different implementation; do not assume the same attribute works here.)
   * A page-wide `[role="progressbar"]` count can't distinguish this bar from
   * `ConsistencyStrip`'s own Participation bar, which renders whenever
   * `participation !== null` regardless of `isActive` -- this scoping keeps
   * Acceptance Criterion 1 true regardless of what any fixture's
   * `participation` field holds, not true by fixture coincidence. */
  function hoursVsGoalProgressBars(root: HTMLElement): Element[] {
    return Array.from(root.querySelectorAll('[role="progressbar"]')).filter((el) => {
      const labelId = el.getAttribute('aria-labelledby');
      const labelEl = labelId ? document.getElementById(labelId) : null;
      return labelEl?.textContent?.includes('hours vs. goal') ?? false;
    });
  }

  const INACTIVE_STUDENT: LinkedStudentRow = {
    studentId: 'student-c4-inactive',
    displayName: 'Marisol Tan',
    teamId: 'team-c4-inactive',
    isActive: false,
  };
  const ACTIVE_STUDENT: LinkedStudentRow = {
    studentId: 'student-c4-active',
    displayName: 'Owen Petrov',
    teamId: 'team-c4-active',
    isActive: true,
  };
  const ACTIVE_CARD_DATA: StudentHomeCardData = {
    ...EMPTY_CARD_DATA,
    goalHours: 120,
    confirmedHours: 77,
  };

  it("renders exactly one card, the factual 'Not currently active' marker, and an honest non-numeric hours state", async () => {
    renderAsUser(PARENT_USER, {
      loadLinkedStudents: async () => ({
        students: [INACTIVE_STUDENT],
        teams: [{ id: 'team-c4-inactive', name: 'Delta Drift' }],
      }),
      loadStudentData: async () => EMPTY_CARD_DATA,
    });
    await flushMicrotasks();

    // (a) exactly one card renders -- rules out this being mistaken for the
    // zero-students page-level EmptyState.
    expect(hoursVsGoalProgressBars(container)).toHaveLength(0);
    expect(container.textContent).toContain('Marisol Tan');
    expect(container.textContent).toContain('Delta Drift');
    expect(container.textContent).not.toContain('No linked students yet');
    // (b) honest-absence figures: no numeric hours bar, "Nothing scheduled".
    expect(container.textContent).toContain('not shown while this student is inactive');
    expect(container.textContent).not.toContain('0 / 1 h');
    expect(container.textContent).toContain('Nothing scheduled');
    // (c) the factual marker's exact copy.
    expect(container.textContent).toContain('Not currently active');
  });

  it("a sibling active student's real, non-zero figures never leak onto the deactivated card (mutation 2)", async () => {
    renderAsUser(PARENT_USER, {
      loadLinkedStudents: async () => ({
        students: [INACTIVE_STUDENT, ACTIVE_STUDENT],
        teams: [
          { id: 'team-c4-inactive', name: 'Delta Drift' },
          { id: 'team-c4-active', name: 'Echo Rift' },
        ],
      }),
      loadStudentData: async (studentId: string) =>
        studentId === ACTIVE_STUDENT.studentId ? ACTIVE_CARD_DATA : EMPTY_CARD_DATA,
    });
    await flushMicrotasks();

    const valueTexts = hoursVsGoalProgressBars(container).map((el) =>
      el.getAttribute('aria-valuetext'),
    );
    expect(valueTexts).toHaveLength(1);
    // hoursVsGoalPercent(77, 120) = 64.2.
    expect(valueTexts).toContain('77 / 120 h (64.2%)');
    expect(container.textContent).toContain('Not currently active');
    // Only Marisol's card carries the marker, not Owen's active one -- the
    // marker text appears exactly once.
    expect(container.textContent?.split('Not currently active').length).toBe(2);
    expect(container.textContent).toContain('not shown while this student is inactive');
    expect(container.textContent?.split('not shown while this student is inactive').length).toBe(2);
  });
});

describe('<ParentHome /> C5: next-3-events sourced from real data (row-mapper mutation target, MAJOR 6)', () => {
  const TEAM_A = 'team-c5-a';
  const TEAM_B = 'team-c5-b';
  const NOW_MS = new Date('2026-09-01T12:00:00.000Z').getTime();

  const EVENT_ROWS = [
    {
      id: 'e-a-meeting',
      season_id: 'season-c5',
      type: 'meeting',
      title: 'Team A Build Night',
      team_ids: [TEAM_A],
    },
    {
      id: 'e-b-outreach',
      season_id: 'season-c5',
      type: 'outreach',
      title: 'Team B Canned Food Drive',
      team_ids: [TEAM_B],
    },
    {
      id: 'e-shared',
      season_id: 'season-c5',
      type: 'outreach',
      title: 'All-Teams Robotics Expo',
      team_ids: null,
    },
    // Earliest-dated, but must never appear regardless of team or date.
    {
      id: 'e-competition',
      season_id: 'season-c5',
      type: 'competition',
      title: 'Regional Qualifier',
      team_ids: [TEAM_A],
    },
  ];

  function sessionRow(id: string, eventId: string, offsetDays: number) {
    const startsAt = new Date(NOW_MS + offsetDays * 86_400_000).toISOString();
    const endsAt = new Date(NOW_MS + offsetDays * 86_400_000 + 3_600_000).toISOString();
    return {
      id,
      event_id: eventId,
      session_date: startsAt.slice(0, 10),
      starts_at: startsAt,
      ends_at: endsAt,
      status: 'scheduled',
    };
  }

  const SESSION_ROWS = [
    sessionRow('s-competition', 'e-competition', 1),
    sessionRow('s-shared', 'e-shared', 3),
    sessionRow('s-a', 'e-a-meeting', 4),
    sessionRow('s-b', 'e-b-outreach', 5),
  ];

  it("each student's card shows only its own team's event(s) plus the shared one, never the competition", async () => {
    const fakeClient = makeFakeClient({
      event_sessions: { data: SESSION_ROWS, error: null },
      attendance: { data: [], error: null },
      v_student_participation: { data: [], error: null },
      v_student_goal_projection: { data: null, error: null },
      events: { data: EVENT_ROWS, error: null },
      rsvps: { data: [], error: null },
      student_teams: { data: [], error: null },
    });
    const loadStudentData = makeLoadStudentHomeCardDataForParentHome(
      () => fakeClient,
      () => new Date(NOW_MS),
    );
    const students: readonly LinkedStudentRow[] = [
      { studentId: 'student-c5-a', displayName: 'Farah Delacroix', teamId: TEAM_A, isActive: true },
      { studentId: 'student-c5-b', displayName: 'Milo Andrade', teamId: TEAM_B, isActive: true },
    ];

    renderAsUser(PARENT_USER, {
      loadLinkedStudents: async () => ({
        students,
        teams: [
          { id: TEAM_A, name: 'Alpha Circuit' },
          { id: TEAM_B, name: 'Beta Circuit' },
        ],
      }),
      loadStudentData,
    });
    await flushMicrotasks();

    const fullText = container.textContent ?? '';
    const farahStart = fullText.indexOf("Farah Delacroix's next events");
    const miloStart = fullText.indexOf("Milo Andrade's next events");
    expect(farahStart).toBeGreaterThan(-1);
    expect(miloStart).toBeGreaterThan(-1);
    expect(farahStart).toBeLessThan(miloStart);

    const farahSection = fullText.slice(farahStart, miloStart);
    const miloSection = fullText.slice(miloStart);

    expect(farahSection).toContain('All-Teams Robotics Expo');
    expect(farahSection).toContain('Team A Build Night');
    expect(farahSection).not.toContain('Team B Canned Food Drive');
    expect(farahSection).not.toContain('Regional Qualifier');

    expect(miloSection).toContain('All-Teams Robotics Expo');
    expect(miloSection).toContain('Team B Canned Food Drive');
    expect(miloSection).not.toContain('Team A Build Night');
    expect(miloSection).not.toContain('Regional Qualifier');
  });
});

describe('<ParentHome /> C6/C12: zero-linked-students empty state, distinct from an unresolved session', () => {
  it('C6: a resolved-but-empty outer result (props-injected) renders "No linked students yet"', async () => {
    renderAsUser(PARENT_USER, {
      loadLinkedStudents: () => Promise.resolve({ students: [], teams: [] }),
    });
    await flushMicrotasks();
    expect(container.textContent).toContain('No linked students yet');
  });

  it('C6/C12 paired positive, via the REAL loader: a resolved session with zero guardian_links rows still renders "No linked students yet"', async () => {
    const fakeClient = makeFakeAuthClient({ userId: 'user-c12-resolved' });
    const loadLinkedStudents = makeLoadLinkedStudentsForParentHome(() => fakeClient);

    renderAsUser(PARENT_USER, { loadLinkedStudents });
    await flushMicrotasks();

    expect(container.textContent).toContain('No linked students yet');
    expect(container.textContent).not.toContain("Couldn't load Home");
  });

  it('C12: an unresolved session (null, no error) never renders "No linked students yet" -- the honest page-level error instead (MINOR 8 decision)', async () => {
    const fakeClient = makeFakeAuthClient(null);
    const loadLinkedStudents = makeLoadLinkedStudentsForParentHome(() => fakeClient);

    renderAsUser(PARENT_USER, { loadLinkedStudents });
    await flushMicrotasks();

    expect(container.textContent).toContain("Couldn't load Home");
    expect(container.textContent).not.toContain('No linked students yet');
  });
});

describe('<ParentHome /> C10: the two loadLinkedStudents contracts are never cross-wired', () => {
  it("the real loader module never re-exports checkin.ts's own loadLinkedStudents/makeLoadLinkedStudents names", async () => {
    // Runtime proxy for "grep confirms no cross-import" (this task's own
    // worker output separately records the literal `grep` run over the
    // source, plus the real `TS2322` from a scratch attempted-misuse
    // experiment -- a real cross-assignment does not compile, so that proof
    // cannot live as committed, running TS source here).
    const parentHomeModule = await import('../../lib/supabase/loaders/parentHome');
    expect(Object.keys(parentHomeModule)).not.toContain('loadLinkedStudents');
    expect(Object.keys(parentHomeModule)).not.toContain('makeLoadLinkedStudents');
  });

  it("the real outer-seam default resolves ParentHome's own LinkedStudentsResult shape ({students, teams}), never checkin.ts's LinkedStudentSummary[]", async () => {
    const fakeClient = makeFakeAuthClient(
      { userId: 'user-c10-real' },
      {
        guardian_links: { data: [{ student_id: 'student-c10' }], error: null },
        students: {
          data: [
            {
              id: 'student-c10',
              display_name: 'C10 Student',
              team_id: 'team-c10',
              is_active: true,
            },
          ],
          error: null,
        },
        teams: { data: [{ id: 'team-c10', name: 'C10 Team' }], error: null },
      },
    );
    const loadLinkedStudents = makeLoadLinkedStudentsForParentHome(() => fakeClient);

    const result = await loadLinkedStudents();

    // `LinkedStudentsResult` (`{students, teams}`), never `checkin.ts`'s own
    // `LinkedStudentSummary[]` (a bare array with no `.students`/`.teams`).
    expect(Array.isArray(result)).toBe(false);
    expect(result).toHaveProperty('students');
    expect(result).toHaveProperty('teams');
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
