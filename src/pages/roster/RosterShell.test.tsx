// @vitest-environment jsdom
/**
 * T085: tests for `RosterShell.tsx`.
 *
 * `RosterShell.tsx` never had its own test file before this task (T021's
 * original shell shipped with no colocated test, and every real tab
 * component built afterward -- T022/T025/T026/T027/T028 -- was deliberately
 * a STANDALONE component with its own test file, never touching this shell).
 * This file proves this task's own acceptance criteria directly, against the
 * real, running composed page (not against any one tab's isolated test):
 *
 *   (a) each of the four tabs, when selected, renders that tab's REAL
 *       content -- and the shell's old placeholder copy ("not built yet")
 *       is gone everywhere, not just on the initially-active tab.
 *   (b) `AdminToggles`' admin-only content is genuinely gated: a coach who
 *       legitimately reaches this coach/admin page does not see it; an
 *       admin does, regardless of which roster tab is currently active.
 *   (c) the pre-existing `RequireRole` guard and `TabList` tab-switching
 *       mechanism (both untouched by this task -- see this task's own
 *       diff) still work: a non-coach/admin role is denied, and clicking
 *       through all four tabs actually switches the rendered panel.
 *
 * Uses the same raw `createRoot`/`act` pattern (no `@testing-library/react`
 * installed in this repo) and the same `AuthProvider` + `LoginAsDeferred`
 * role-login harness every other gated content page's test file in this
 * project already established (see e.g. `ParentsTab.test.tsx`,
 * `AdminToggles.test.tsx`).
 *
 * T088: `InvitesTab.tsx`'s default `loadData` was switched (T087) from a
 * fixture stub to the real Supabase-backed `loadInvitesTabData`
 * (`../../lib/supabase/loaders/invites`), which correctly rejects in this
 * test environment (Supabase unconfigured). This file renders
 * `<RosterShell />` bare -- zero props into `InvitesTab`, matching
 * `RosterShell.tsx`'s own correct zero-props-per-tab design, a forbidden
 * file here -- so it cannot inject a fixture through props. Instead it mocks
 * `loadInvitesTabData` at the module boundary, mirroring the pattern
 * `InviteParentDialog.test.tsx` already established for `invokeEdgeFunction`
 * (mock only the one function needed, re-export everything else from the
 * real module via `importOriginal`). This proves the same thing the two
 * affected tests always proved -- `RosterShell` genuinely wires in
 * `InvitesTab`'s real, populated content -- just via an explicit mock
 * instead of an implicit fixture default.
 *
 * T092: T089 did the identical thing one tab over -- `StudentsTab.tsx`'s
 * default `loadData` was switched from a fixture stub to the real
 * Supabase-backed `loadStudentsTabData` (`../../lib/supabase/loaders/
 * students`), which also correctly rejects in this test environment. This
 * file mocks `loadStudentsTabData` at the same module boundary, identical
 * shape to T088's `loadInvitesTabData` mock directly above (mock only the
 * one function needed, re-export everything else via `importOriginal`),
 * fixing the one test that asserted the OLD `StudentsTab` fixture content
 * (`'Amara Voss'`) on the initially-active Students tab.
 *
 * T097: T094 did the identical thing to the remaining two roster tabs at
 * once -- `TeamsTab.tsx`'s and `ParentsTab.tsx`'s default `loadData` were
 * each switched from a fixture stub to a real Supabase-backed loader
 * (`loadTeamsTabData`/`../../lib/supabase/loaders/teams`,
 * `loadParentsTabData`/`../../lib/supabase/loaders/parents`), which also
 * correctly reject in this test environment. This file mocks both at the
 * same module boundary, identical shape to T088's/T092's mocks directly
 * above, fixing the two tests that asserted the OLD `TeamsTab`/`ParentsTab`
 * fixture content (`'Embercore'`/`'Renata Alvarez'`) when those tabs are
 * selected.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, type AuthUser } from '../../app/guards';
import { LoginAsDeferred as LoginAs } from '../../test-utils/authHarness';
import { RosterShell } from './RosterShell';
import type { InviteRow, InvitesTabLoadResult } from './InvitesTab';
import { loadInvitesTabData } from '../../lib/supabase/loaders/invites';
import type { StudentRow, StudentsTabLoadResult, TeamRow } from './StudentsTab';
import { loadStudentsTabData } from '../../lib/supabase/loaders/students';
import type { TeamRow as TeamsTabTeamRow, TeamsTabLoadResult } from './TeamsTab';
import { loadTeamsTabData } from '../../lib/supabase/loaders/teams';
import type {
  GuardianLinkRow,
  ParentProfileRow,
  ParentsTabLoadResult,
  StudentRow as ParentsTabStudentRow,
} from './ParentsTab';
import { loadParentsTabData } from '../../lib/supabase/loaders/parents';

// ---------------------------------------------------------------------------
// T088: mock `loadInvitesTabData` only -- every other
// `../../lib/supabase/loaders/invites` export (e.g. `revokeInvite`, unused
// by these tests but still real) is re-exported from the real module via
// `importOriginal`, same pattern `InviteParentDialog.test.tsx` established
// for `../../lib/supabase`'s `invokeEdgeFunction`.
// ---------------------------------------------------------------------------
vi.mock('../../lib/supabase/loaders/invites', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase/loaders/invites')>();
  return { ...actual, loadInvitesTabData: vi.fn() };
});

const mockedLoadInvitesTabData = vi.mocked(loadInvitesTabData);

// Small, deterministic fixture (same row shape as `InvitesTab.tsx`'s own
// `FIXTURE_INVITES`, not imported since that constant isn't exported) --
// covers exactly what these tests assert: the "briar" pending invite email.
const MOCK_INVITE_ROWS: readonly InviteRow[] = [
  {
    id: 'invite-briar-pending',
    email: 'briar.holloway.invite@example.com',
    role: 'student',
    studentId: 'student-briar-holloway',
    status: 'pending',
    createdAt: '2026-07-10T09:00:00.000Z',
    expiresAt: '2026-07-24T09:00:00.000Z',
  },
];

const MOCK_INVITES_RESULT: InvitesTabLoadResult = { invites: MOCK_INVITE_ROWS };

// ---------------------------------------------------------------------------
// T092: mock `loadStudentsTabData` only -- identical pattern to T088's
// `loadInvitesTabData` mock directly above, one module over. Every other
// `../../lib/supabase/loaders/students` export (`createStudent`,
// `updateStudent`, `setStudentActive`, unused by these tests but still
// real) is re-exported from the real module via `importOriginal`.
// ---------------------------------------------------------------------------
vi.mock('../../lib/supabase/loaders/students', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase/loaders/students')>();
  return { ...actual, loadStudentsTabData: vi.fn() };
});

const mockedLoadStudentsTabData = vi.mocked(loadStudentsTabData);

// Small, deterministic fixture (same row shape as `StudentsTab.tsx`'s own
// `FIXTURE_STUDENTS`/`FIXTURE_TEAMS`, not imported since those constants
// aren't exported) -- covers exactly what the affected test asserts: an
// "Amara Voss" student row. A real `TeamRow` is included since
// `StudentsTab.tsx`'s own `buildDisplayRows` resolves each student's
// `teamId` through the teams list to get `teamName`.
const MOCK_TEAM_ROWS: readonly TeamRow[] = [
  { id: 'team-ironclad', name: 'Ironclad', archived: false },
];

const MOCK_STUDENT_ROWS: readonly StudentRow[] = [
  {
    id: 'student-amara-voss',
    profileId: 'profile-amara-voss',
    displayName: 'Amara Voss',
    teamId: 'team-ironclad',
    gradYear: 2027,
    isActive: true,
    goalHoursOverride: null,
  },
];

const MOCK_STUDENTS_RESULT: StudentsTabLoadResult = {
  students: MOCK_STUDENT_ROWS,
  teams: MOCK_TEAM_ROWS,
  invites: [],
};

// ---------------------------------------------------------------------------
// T097: mock `loadTeamsTabData` only -- identical pattern to T088's/T092's
// mocks above, one module over. Every other
// `../../lib/supabase/loaders/teams` export (`createTeam`, `updateTeam`,
// `setTeamArchived`, `hardDeleteTeam`, `setTeamSortOrders`, unused by these
// tests but still real) is re-exported from the real module via
// `importOriginal`.
// ---------------------------------------------------------------------------
vi.mock('../../lib/supabase/loaders/teams', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase/loaders/teams')>();
  return { ...actual, loadTeamsTabData: vi.fn() };
});

const mockedLoadTeamsTabData = vi.mocked(loadTeamsTabData);

// Small, deterministic fixture (same row shape as `TeamsTab.tsx`'s own
// `FIXTURE_TEAMS`, not imported since that constant isn't exported) --
// covers exactly what the affected test asserts: an "Embercore" team row.
const MOCK_TEAMS_TAB_TEAM_ROWS: readonly TeamsTabTeamRow[] = [
  {
    id: 'team-embercore',
    name: 'Embercore',
    shortName: 'EMBR',
    program: 'Other',
    color: 'orange',
    archived: false,
    sortOrder: 0,
  },
];

const MOCK_TEAMS_RESULT: TeamsTabLoadResult = {
  teams: MOCK_TEAMS_TAB_TEAM_ROWS,
  studentTeamLinks: [],
};

// ---------------------------------------------------------------------------
// T097: mock `loadParentsTabData` only -- identical pattern to T088's/T092's
// mocks above, one module over. Every other
// `../../lib/supabase/loaders/parents` export (`unlinkAllStudents`, unused
// by these tests but still real) is re-exported from the real module via
// `importOriginal`.
// ---------------------------------------------------------------------------
vi.mock('../../lib/supabase/loaders/parents', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase/loaders/parents')>();
  return { ...actual, loadParentsTabData: vi.fn() };
});

const mockedLoadParentsTabData = vi.mocked(loadParentsTabData);

// Small, deterministic fixture (same row shape as `ParentsTab.tsx`'s own
// `FIXTURE_PARENT_PROFILES`, not imported since that constant isn't
// exported) -- covers exactly what the affected test asserts: a "Renata
// Alvarez" parent-profile row.
const MOCK_PARENT_PROFILE_ROWS: readonly ParentProfileRow[] = [
  {
    id: 'profile-renata-alvarez',
    displayName: 'Renata Alvarez',
    email: 'renata.alvarez@example.com',
    avatarUrl: null,
  },
];

const MOCK_PARENTS_TAB_STUDENT_ROWS: readonly ParentsTabStudentRow[] = [
  { id: 'student-elena-park', displayName: 'Elena Park' },
];

const MOCK_GUARDIAN_LINK_ROWS: readonly GuardianLinkRow[] = [
  {
    id: 'link-alvarez-elena',
    parentProfileId: 'profile-renata-alvarez',
    studentId: 'student-elena-park',
  },
];

const MOCK_PARENTS_RESULT: ParentsTabLoadResult = {
  parentProfiles: MOCK_PARENT_PROFILE_ROWS,
  guardianLinks: MOCK_GUARDIAN_LINK_ROWS,
  students: MOCK_PARENTS_TAB_STUDENT_ROWS,
  invites: [],
};

// ---------------------------------------------------------------------------
// jsdom gap: `AlertDialog`/`Dialog` render a native `<dialog>` and call
// `HTMLDialogElement.prototype.showModal()`, which this repo's installed
// jsdom does not implement -- same gap `ParentsTab.test.tsx`/`StudentsTab
// .test.tsx`/`TeamsTab.test.tsx` already document and polyfill, scoped
// locally to this test file only.
// ---------------------------------------------------------------------------
if (
  typeof HTMLDialogElement !== 'undefined' &&
  typeof HTMLDialogElement.prototype.showModal !== 'function'
) {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement): void {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement): void {
    this.removeAttribute('open');
  };
}

// ---------------------------------------------------------------------------
// Render harness -- mirrors `ParentsTab.test.tsx`'s own `renderGatedPage`.
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

const ADMIN_USER: AuthUser = { id: 'user-admin', email: 'admin@example.com', role: 'admin' };
const COACH_USER: AuthUser = { id: 'user-coach', email: 'coach@example.com', role: 'coach' };
const STUDENT_USER: AuthUser = {
  id: 'user-student',
  email: 'student@example.com',
  role: 'student',
};

function renderRosterShell(user: AuthUser | null): void {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={['/roster']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/roster"
              element={
                user === null ? (
                  <RosterShell />
                ) : (
                  <LoginAs user={user}>
                    <RosterShell />
                  </LoginAs>
                )
              }
            />
            <Route path="/" element={<div data-testid="redirected-home" />} />
          </Routes>
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

/**
 * `AdminToggles` is loaded via `React.lazy`/dynamic `import()`
 * (`RosterShell.tsx` module doc #6 -- a real fix for a real router.tsx
 * import cycle, not a stylistic choice). How many ticks the dynamic
 * import's first resolution takes varies with how much else Vitest/Node is
 * doing concurrently (observed directly: a fixed small loop of
 * microtask/macrotask flushes was reliably enough running this file alone,
 * but NOT reliably enough running the full `npm run test` suite, where
 * other work is contending for the event loop) -- so this polls the real
 * DOM with `vi.waitFor` (real timers, real retries up to a generous
 * timeout) instead of assuming a fixed number of ticks is always enough.
 */
async function waitForAdminTogglesReady(): Promise<void> {
  await vi.waitFor(
    () => {
      if (!container.textContent?.includes('Admin settings')) {
        throw new Error('AdminToggles lazy chunk has not resolved yet');
      }
    },
    { timeout: 5000, interval: 25 },
  );
}

function clickTab(value: 'students' | 'parents' | 'teams' | 'invites'): void {
  const tab = document.querySelector(`button[data-tab-value="${value}"]`);
  expect(tab, `expected a Tab button for "${value}"`).toBeTruthy();
  act(() => {
    tab?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  mockedLoadInvitesTabData.mockReset().mockResolvedValue(MOCK_INVITES_RESULT);
  mockedLoadStudentsTabData.mockReset().mockResolvedValue(MOCK_STUDENTS_RESULT);
  mockedLoadTeamsTabData.mockReset().mockResolvedValue(MOCK_TEAMS_RESULT);
  mockedLoadParentsTabData.mockReset().mockResolvedValue(MOCK_PARENTS_RESULT);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

// ---------------------------------------------------------------------------
// (c) RequireRole guard -- unchanged from T021, quick regression check.
// ---------------------------------------------------------------------------

describe('<RosterShell /> RequireRole guard (unchanged from T021)', () => {
  it('denies a non-coach/admin role with AccessDeniedPage, not the roster content', async () => {
    renderRosterShell(STUDENT_USER);
    await flushMicrotasks();
    expect(container.querySelector('[data-testid="redirected-home"]')).toBeNull();
    expect(container.textContent).toContain("This page isn't part of your role");
    expect(container.textContent).not.toContain('Roster');
  });

  it('admits a coach', async () => {
    renderRosterShell(COACH_USER);
    await flushMicrotasks();
    expect(container.textContent).toContain('Roster');
  });

  it('admits an admin', async () => {
    renderRosterShell(ADMIN_USER);
    await flushMicrotasks();
    expect(container.textContent).toContain('Roster');
  });
});

// ---------------------------------------------------------------------------
// (a) Real tab wiring -- the central acceptance criterion for this task.
// ---------------------------------------------------------------------------

const OLD_PLACEHOLDER_STRINGS = [
  'Student roster not built yet',
  'Parent roster not built yet',
  'Team management not built yet',
  'Invite tracking not built yet',
  'not built yet',
  'T022-T028',
];

describe('<RosterShell /> real tab wiring (T085 acceptance criteria)', () => {
  it('renders the real StudentsTab (fixture data) on the initially-active Students tab', async () => {
    renderRosterShell(COACH_USER);
    await flushMicrotasks();
    // Real StudentsTab fixture row, not any placeholder copy.
    expect(container.textContent).toContain('Amara Voss');
    for (const placeholder of OLD_PLACEHOLDER_STRINGS) {
      expect(container.textContent).not.toContain(placeholder);
    }
  });

  it('renders the real ParentsTab when the Parents tab is selected', async () => {
    renderRosterShell(COACH_USER);
    await flushMicrotasks();
    clickTab('parents');
    await flushMicrotasks();
    // Real ParentsTab fixture row (ParentsTab.tsx's own FIXTURE_PARENT_PROFILES).
    expect(container.textContent).toContain('Renata Alvarez');
    expect(container.textContent).not.toContain('Parent roster not built yet');
  });

  it('renders the real TeamsTab when the Teams tab is selected', async () => {
    renderRosterShell(COACH_USER);
    await flushMicrotasks();
    clickTab('teams');
    await flushMicrotasks();
    // Real TeamsTab fixture row + its own "New team" create action, which no
    // placeholder EmptyState ever rendered.
    expect(container.textContent).toContain('Embercore');
    expect(container.textContent).toContain('New team');
    expect(container.textContent).not.toContain('Team management not built yet');
  });

  it('renders the real InvitesTab when the Invites tab is selected', async () => {
    renderRosterShell(COACH_USER);
    await flushMicrotasks();
    clickTab('invites');
    await flushMicrotasks();
    // Real InvitesTab fixture row (InvitesTab.tsx's own FIXTURE_INVITES).
    expect(container.textContent).toContain('briar.holloway.invite@example.com');
    expect(container.textContent).not.toContain('Invite tracking not built yet');
  });

  it('never shows any old placeholder copy across the full tab tour', async () => {
    renderRosterShell(ADMIN_USER);
    await flushMicrotasks();
    for (const value of ['students', 'parents', 'teams', 'invites'] as const) {
      clickTab(value);
      await flushMicrotasks();
      for (const placeholder of OLD_PLACEHOLDER_STRINGS) {
        expect(container.textContent).not.toContain(placeholder);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// (b) AdminToggles gating -- Known Context/Traps #2 placement + real gate.
// ---------------------------------------------------------------------------

describe('<RosterShell /> AdminToggles gating (T028, ROS-08)', () => {
  it('does not show admin-only settings content to a coach', async () => {
    renderRosterShell(COACH_USER);
    await flushMicrotasks();
    expect(container.textContent).not.toContain('Show first name + last initial publicly');
    expect(container.textContent).not.toContain('Admin settings');
  });

  it('shows the real admin-only settings widget to an admin on the default (Students) tab', async () => {
    renderRosterShell(ADMIN_USER);
    await flushMicrotasks();
    await waitForAdminTogglesReady();
    expect(container.textContent).toContain('Admin settings');
    expect(container.textContent).toContain('Show first name + last initial publicly');
  });

  it('keeps showing AdminToggles to an admin regardless of which tab is active', async () => {
    renderRosterShell(ADMIN_USER);
    await flushMicrotasks();
    await waitForAdminTogglesReady();
    clickTab('invites');
    await flushMicrotasks();
    expect(container.textContent).toContain('Show first name + last initial publicly');
    // And the real Invites content is also present -- AdminToggles isn't
    // hiding/replacing tab content, both coexist.
    expect(container.textContent).toContain('briar.holloway.invite@example.com');
  });
});

// ---------------------------------------------------------------------------
// (c) TabList tab-switching + keyboard-nav scaffold -- unchanged from T021,
// quick regression check only (not a full re-verification of the underlying
// Astryx TabList/Tab components, which this task never touches).
// ---------------------------------------------------------------------------

describe('<RosterShell /> tab scaffold regression check (unchanged from T021)', () => {
  it('renders all four tabs in ROS-01 literal order: Students | Parents | Teams | Invites', async () => {
    renderRosterShell(COACH_USER);
    await flushMicrotasks();
    const tabs = Array.from(document.querySelectorAll('button[data-tab-value]')).map((el) =>
      el.getAttribute('data-tab-value'),
    );
    expect(tabs).toEqual(['students', 'parents', 'teams', 'invites']);
  });

  it('switches the active/selected tab (aria-current) when a different tab is clicked', async () => {
    renderRosterShell(COACH_USER);
    await flushMicrotasks();

    const studentsTabButton = document.querySelector('button[data-tab-value="students"]');
    expect(studentsTabButton?.getAttribute('aria-current')).toBe('page');

    clickTab('teams');
    await flushMicrotasks();

    const teamsTabButton = document.querySelector('button[data-tab-value="teams"]');
    expect(teamsTabButton?.getAttribute('aria-current')).toBe('page');
    expect(studentsTabButton?.getAttribute('aria-current')).toBeNull();
  });

  it('still supports roving-tabindex ArrowRight keyboard navigation across the tab strip', async () => {
    renderRosterShell(COACH_USER);
    await flushMicrotasks();

    const studentsTabButton = document.querySelector(
      'button[data-tab-value="students"]',
    ) as HTMLButtonElement;
    const parentsTabButton = document.querySelector(
      'button[data-tab-value="parents"]',
    ) as HTMLButtonElement;

    act(() => {
      studentsTabButton.focus();
    });
    expect(document.activeElement).toBe(studentsTabButton);

    act(() => {
      studentsTabButton.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      );
    });

    expect(document.activeElement).toBe(parentsTabButton);
  });
});
