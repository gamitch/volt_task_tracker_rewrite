// @vitest-environment jsdom
/**
 * T025: tests for `ParentsTab.tsx`.
 *
 * Per this task's Allowed Files ("A colocated `ParentsTab.test.tsx` is
 * acceptable per established precedent") this test file is a deliberate,
 * disclosed addition -- the same class of addition `StudentsTab.test.tsx`
 * (T022) and `LiveConsole.test.tsx` (T033) already made in their own
 * directories, existing to produce this task's own "Required Worker Output"
 * proof requirements: the central Remove (unlink + deactivate) `AlertDialog`
 * flow, including the multi-linked-student case, plus the multi-avatar
 * `AvatarGroup` rendering proof and the `RequireRole` guard.
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- these tests use the same raw `createRoot`/`act`
 * pattern every prior content-page test file already established, including
 * `LiveConsole.test.tsx`'s own `AuthProvider` + `LoginAs` role-login harness
 * for the `ParentsTab` (gated) vs. `ParentsTabBody` (ungated) split.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, type AuthUser } from '../../app/guards';
import { LoginAsDeferred as LoginAs } from '../../test-utils/authHarness';
import {
  buildParentDisplayRows,
  defaultLoadParentsTabData,
  deriveGroupInviteStatus,
  ParentsTab,
  ParentsTabBody,
  setInviteStatusForEmail,
  unlinkAllStudentsForParent,
  type GuardianLinkRow,
  type InviteRow,
  type ParentProfileRow,
  type ParentsTabLoadResult,
  type StudentRow,
} from './ParentsTab';

// ---------------------------------------------------------------------------
// jsdom gap: `AlertDialog` renders a native `<dialog>` and calls
// `HTMLDialogElement.prototype.showModal()`, which this repo's installed
// jsdom does not implement -- same gap `StudentsTab.test.tsx`/`MeetingsList
// .test.tsx` already documented and polyfilled, scoped locally to this test
// file only (not the shared `src/test-setup.ts`, outside this task's
// Allowed Files).
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
// Render harness
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

function renderBody(props: Parameters<typeof ParentsTabBody>[0] = {}): void {
  act(() => {
    root.render(<ParentsTabBody {...props} />);
  });
}

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function clickButtonWithText(text: string): void {
  const button = Array.from(document.querySelectorAll('button')).find(
    (btn) => btn.textContent?.trim() === text,
  );
  expect(button, `expected a <button> with text "${text}"`).toBeTruthy();
  act(() => {
    button?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

/** Mirrors `StudentsTab.test.tsx`'s own `openMoreMenuFor`/scoped-menu
 * approach -- `MoreMenu` renders every row's items unconditionally into the
 * DOM (native popover semantics), so assertions must be scoped to one row's
 * own `role="menu"` element via its trigger's `aria-controls`. */
function openMoreMenuFor(name: string): HTMLElement {
  const trigger = document.querySelector(`button[aria-label="Actions for ${name}"]`);
  expect(trigger, `expected a MoreMenu trigger for "${name}"`).toBeTruthy();
  act(() => {
    trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  const menuId = trigger?.getAttribute('aria-controls') ?? null;
  const menu = menuId ? document.getElementById(menuId) : null;
  expect(menu, `expected a scoped menu element for "${name}"`).toBeTruthy();
  return menu as HTMLElement;
}

function menuItemTexts(menu: HTMLElement): string[] {
  return Array.from(menu.querySelectorAll('[role="menuitem"]')).map(
    (el) => el.textContent?.trim() ?? '',
  );
}

function clickMenuItem(menu: HTMLElement, text: string): void {
  const item = Array.from(menu.querySelectorAll('[role="menuitem"]')).find(
    (el) => el.textContent?.trim() === text,
  );
  expect(item, `expected a menu item "${text}" within the scoped menu`).toBeTruthy();
  act(() => {
    item?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
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
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Pure functions -- module docs #1/#3/#5/#9.
// ---------------------------------------------------------------------------

describe('deriveGroupInviteStatus', () => {
  it('prefers pending over expired/revoked', () => {
    expect(deriveGroupInviteStatus(['revoked', 'expired', 'pending'])).toBe('pending');
  });

  it('prefers expired over revoked when no pending exists', () => {
    expect(deriveGroupInviteStatus(['revoked', 'expired'])).toBe('expired');
  });

  it('falls back to revoked when only revoked rows exist', () => {
    expect(deriveGroupInviteStatus(['revoked'])).toBe('revoked');
  });

  it('falls back to accepted for the real-schema edge case (no pending/expired/revoked)', () => {
    expect(deriveGroupInviteStatus(['accepted'])).toBe('accepted');
  });
});

describe('buildParentDisplayRows', () => {
  const students: StudentRow[] = [
    { id: 's1', displayName: 'Student One' },
    { id: 's2', displayName: 'Student Two' },
  ];

  it('builds a profile row with every linked student, sorted by name', () => {
    const profiles: ParentProfileRow[] = [
      { id: 'p1', displayName: 'Zed Parent', email: 'zed@example.com', avatarUrl: '' },
      { id: 'p2', displayName: 'Ann Parent', email: 'ann@example.com', avatarUrl: '' },
    ];
    const links: GuardianLinkRow[] = [
      { id: 'l1', parentProfileId: 'p1', studentId: 's1' },
      { id: 'l2', parentProfileId: 'p1', studentId: 's2' },
    ];
    const rows = buildParentDisplayRows(profiles, links, students, [], new Set());
    expect(rows.map((r) => r.name)).toEqual(['Ann Parent', 'Zed Parent']);
    const zed = rows.find((r) => r.name === 'Zed Parent');
    expect(zed?.linkedStudents).toEqual([
      { id: 's1', name: 'Student One' },
      { id: 's2', name: 'Student Two' },
    ]);
    expect(zed?.hasProfile).toBe(true);
    expect(zed?.inviteStatus).toBe('active');
  });

  it('never produces a duplicate row for an invite sharing an existing profile email (decoy 1)', () => {
    const profiles: ParentProfileRow[] = [
      { id: 'p1', displayName: 'Existing Parent', email: 'existing@example.com', avatarUrl: '' },
    ];
    const invites: InviteRow[] = [
      {
        id: 'i1',
        email: 'existing@example.com',
        role: 'parent',
        studentId: 's1',
        status: 'pending',
      },
    ];
    const rows = buildParentDisplayRows(profiles, [], students, invites, new Set());
    expect(rows).toHaveLength(1);
    expect(rows[0].hasProfile).toBe(true);
  });

  it('never produces a phantom parent row from a role=student invite (decoy 2)', () => {
    const invites: InviteRow[] = [
      {
        id: 'i1',
        email: 'student.self@example.com',
        role: 'student',
        studentId: 's1',
        status: 'pending',
      },
    ];
    const rows = buildParentDisplayRows([], [], students, invites, new Set());
    expect(rows).toHaveLength(0);
  });

  it('groups multiple role=parent invites sharing one email into a single row', () => {
    const invites: InviteRow[] = [
      { id: 'i1', email: 'shared@example.com', role: 'parent', studentId: 's1', status: 'expired' },
      { id: 'i2', email: 'shared@example.com', role: 'parent', studentId: 's2', status: 'pending' },
    ];
    const rows = buildParentDisplayRows([], [], students, invites, new Set());
    expect(rows).toHaveLength(1);
    expect(rows[0].hasProfile).toBe(false);
    expect(rows[0].name).toBe('shared@example.com');
    expect(rows[0].inviteStatus).toBe('pending'); // pending wins over expired.
    expect(rows[0].linkedStudents.map((s) => s.id).sort()).toEqual(['s1', 's2']);
  });

  it('renders a zero-linked-students profile row (empty AvatarGroup case)', () => {
    const profiles: ParentProfileRow[] = [
      { id: 'p1', displayName: 'No Links Parent', email: 'nolinks@example.com', avatarUrl: '' },
    ];
    const rows = buildParentDisplayRows(profiles, [], students, [], new Set());
    expect(rows[0].linkedStudents).toEqual([]);
  });

  it('marks a row isRemoved when its profile id is in removedProfileIds', () => {
    const profiles: ParentProfileRow[] = [
      { id: 'p1', displayName: 'Removed Parent', email: 'removed@example.com', avatarUrl: '' },
    ];
    const rows = buildParentDisplayRows(profiles, [], students, [], new Set(['p1']));
    expect(rows[0].isRemoved).toBe(true);
  });
});

describe('unlinkAllStudentsForParent (module doc #3a -- never a partial unlink)', () => {
  it('removes every guardian_links row for the given parent, keeps other parents untouched', () => {
    const links: GuardianLinkRow[] = [
      { id: 'l1', parentProfileId: 'p1', studentId: 's1' },
      { id: 'l2', parentProfileId: 'p1', studentId: 's2' },
      { id: 'l3', parentProfileId: 'p2', studentId: 's1' },
    ];
    const result = unlinkAllStudentsForParent(links, 'p1');
    expect(result).toEqual([{ id: 'l3', parentProfileId: 'p2', studentId: 's1' }]);
  });
});

describe('setInviteStatusForEmail', () => {
  it('flips only role=parent invites matching the given email', () => {
    const invites: InviteRow[] = [
      { id: 'i1', email: 'a@example.com', role: 'parent', studentId: 's1', status: 'pending' },
      { id: 'i2', email: 'a@example.com', role: 'student', studentId: 's1', status: 'pending' },
      { id: 'i3', email: 'b@example.com', role: 'parent', studentId: 's1', status: 'pending' },
    ];
    const result = setInviteStatusForEmail(invites, 'a@example.com', 'revoked');
    expect(result[0].status).toBe('revoked'); // matches: role=parent, email=a
    expect(result[1].status).toBe('pending'); // role=student -- untouched
    expect(result[2].status).toBe('pending'); // different email -- untouched
  });
});

// ---------------------------------------------------------------------------
// Fixture-backed render tests against the real default loader.
// ---------------------------------------------------------------------------

describe('<ParentsTabBody /> DES-12 states', () => {
  it('shows a loading Skeleton (T081: table has predictable dimensions) before data resolves', () => {
    renderBody({ loadData: () => new Promise(() => {}) });
    expect(container.textContent).toContain('Loading parents');
  });

  it('shows an error banner when loadData rejects', async () => {
    renderBody({ loadData: () => Promise.reject(new Error('boom')) });
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't load parents");
  });

  it('shows an empty state when there are no parents at all', async () => {
    const empty: ParentsTabLoadResult = {
      parentProfiles: [],
      guardianLinks: [],
      students: [],
      invites: [],
    };
    renderBody({ loadData: () => Promise.resolve(empty) });
    await flushMicrotasks();
    expect(container.textContent).toContain('No parents on the roster yet');
  });

  it('loads the real default fixture data without throwing', async () => {
    const data = await defaultLoadParentsTabData();
    expect(data.parentProfiles.length).toBeGreaterThan(0);
  });
});

describe('<ParentsTabBody /> linked-student AvatarGroup rendering', () => {
  it('renders BOTH avatars for a parent with two linked students (Renata Alvarez)', async () => {
    renderBody();
    await flushMicrotasks();

    expect(container.textContent).toContain('Renata Alvarez');
    // Avatar renders role="img" aria-label={name} (Avatar.tsx) -- a robust,
    // implementation-accurate query independent of visual initials text.
    expect(document.querySelector('[role="img"][aria-label="Elena Park"]')).toBeTruthy();
    expect(document.querySelector('[role="img"][aria-label="Mateo Cruz"]')).toBeTruthy();
  });

  it('renders "No linked students" for a parent with zero links (Denise Cole)', async () => {
    renderBody();
    await flushMicrotasks();
    expect(container.textContent).toContain('Denise Cole');
    expect(container.textContent).toContain('No linked students');
  });

  it('renders an invite-only row using its email (no display name exists yet)', async () => {
    renderBody();
    await flushMicrotasks();
    expect(container.textContent).toContain('harlan.fell@example.com');
    expect(container.textContent).toContain('No account yet');
    expect(document.querySelector('[role="img"][aria-label="Nadia Fell"]')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Remove (unlink + deactivate) AlertDialog flow -- module docs #3/#4.
// ---------------------------------------------------------------------------

describe('<ParentsTabBody /> Remove -- profile-backed, multi-linked-student parent', () => {
  it('unlinks BOTH students and marks the profile Removed, in one confirmed action', async () => {
    renderBody();
    await flushMicrotasks();

    const menu = openMoreMenuFor('Renata Alvarez');
    expect(menuItemTexts(menu)).toEqual(['Edit links', 'Remove']); // no Resend for a profile-backed row.
    clickMenuItem(menu, 'Remove');

    // Real AlertDialog open, copy states BOTH effects, never "delete".
    expect(document.body.textContent).toContain('Remove Renata Alvarez?');
    expect(document.body.textContent).toContain('unlinks Renata Alvarez from 2 linked students');
    expect(document.body.textContent).toContain('deactivates their parent account');
    expect(document.body.textContent).not.toMatch(/delete/i);

    clickButtonWithText('Remove');

    // Row stays visible (matches StudentsTab's reversible-flip visibility
    // posture), both links gone, "Removed" badge/status shown.
    expect(container.textContent).toContain('Renata Alvarez');
    expect(document.querySelector('[role="img"][aria-label="Elena Park"]')).toBeNull();
    expect(document.querySelector('[role="img"][aria-label="Mateo Cruz"]')).toBeNull();
    expect(container.textContent).toContain('Removed');

    // Remove is no longer offered a second time.
    const menuAfter = openMoreMenuFor('Renata Alvarez');
    expect(menuItemTexts(menuAfter)).toEqual(['Edit links']);
  });
});

describe('<ParentsTabBody /> Remove -- invite-only row (no profile, no guardian_links yet)', () => {
  it('revokes the invite (the one real applicable effect), different dialog copy', async () => {
    renderBody();
    await flushMicrotasks();

    const menu = openMoreMenuFor('harlan.fell@example.com');
    expect(menuItemTexts(menu)).toEqual(['Edit links', 'Resend invite', 'Remove']);
    clickMenuItem(menu, 'Remove');

    expect(document.body.textContent).toContain('Revoke invite for harlan.fell@example.com?');
    expect(document.body.textContent).toContain('revokes the pending invite');
    expect(document.body.textContent).not.toMatch(/delete/i);
    // Not the profile-backed copy -- no account exists yet for this row.
    expect(document.body.textContent).not.toContain('deactivates their parent account');

    clickButtonWithText('Remove');

    expect(container.textContent).toContain('harlan.fell@example.com');
    expect(container.textContent).toContain('Invite revoked');

    // Remove is gone once already revoked; Resend remains (undo path).
    const menuAfter = openMoreMenuFor('harlan.fell@example.com');
    expect(menuItemTexts(menuAfter)).toEqual(['Edit links', 'Resend invite']);
  });
});

// ---------------------------------------------------------------------------
// Resend invite -- module doc #5 (real, working, not just a stub banner).
// ---------------------------------------------------------------------------

describe('<ParentsTabBody /> Resend invite', () => {
  it('really flips an expired invite back to pending, and shows a disclosure banner', async () => {
    renderBody();
    await flushMicrotasks();

    expect(container.textContent).toContain('Invite expired'); // priya.quinn's initial state.

    const menu = openMoreMenuFor('priya.quinn@example.com');
    clickMenuItem(menu, 'Resend invite');

    expect(container.textContent).toContain('Invited'); // real state flip, not just a banner.
    expect(container.textContent).not.toContain('Invite expired');
    expect(container.textContent).toContain('Invite marked pending again');
    expect(container.textContent).toContain('send-invite');
  });
});

// ---------------------------------------------------------------------------
// Edit links stub -- inert disclosure, per this task's Forbidden Files.
// ---------------------------------------------------------------------------

describe('<ParentsTabBody /> Edit links stub', () => {
  it('shows a disclosure banner, changes nothing', async () => {
    renderBody();
    await flushMicrotasks();
    clickMenuItem(openMoreMenuFor('Renata Alvarez'), 'Edit links');
    expect(container.textContent).toContain('Edit-links dialog not built yet');
    // Nothing was unlinked/removed by this action.
    expect(document.querySelector('[role="img"][aria-label="Elena Park"]')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// RequireRole guard -- the gated default export. Module doc #2.
// ---------------------------------------------------------------------------

const COACH_USER: AuthUser = { id: 'user-coach', email: 'coach@example.com', role: 'coach' };
// T073a: renamed from `STAFF_USER`/`role: 'staff'` (invalid under the
// corrected `Role` type) to `STUDENT_USER`/`role: 'student'`. Stands in
// generically for "not coach/admin" in the `RequireRole` guard test below.
const STUDENT_USER: AuthUser = {
  id: 'user-student',
  email: 'student@example.com',
  role: 'student',
};

// `LoginAsDeferred` (imported above, aliased to `LoginAs`) mirrors
// `LiveConsole.test.tsx`'s own original harness: logs in via a `useEffect`
// (not render-phase) and withholds rendering `children` until the login has
// actually taken effect, so `RequireRole` never observes an intermediate
// `user === null` render. T073b1 extracted it into
// `src/test-utils/authHarness.tsx`.

function renderGatedPage(user: AuthUser | null): void {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={['/roster']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/roster"
              element={
                user === null ? (
                  <ParentsTab />
                ) : (
                  <LoginAs user={user}>
                    <ParentsTab />
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

describe('<ParentsTab /> RequireRole guard', () => {
  // T073b2: `RequireRole` (`guards.tsx`) no longer redirects a role-denied
  // viewer to "/" -- it renders a screen in place instead (a real, disclosed
  // behavior change; see that file's own module doc).
  //
  // T078: T076 (Passed) subsequently corrected `RequireRole`'s role-mismatch
  // branch (a resolved `student` account hitting a coach/admin-only page,
  // exactly this test's scenario) to render `AccessDeniedPage`, not
  // `NoAccessPage` -- `NoAccessPage` is for AUTH-04's distinct no-profile
  // case and its "You're not on the roster yet." copy was simply false here
  // (this account IS on the roster; it just lacks this page's role). This
  // test now asserts `AccessDeniedPage`'s own real `EmptyState` title
  // instead of the stale `NoAccessPage` copy it originally targeted.
  it('renders AccessDeniedPage for a non-coach/admin role, not a redirect', async () => {
    renderGatedPage(STUDENT_USER);
    await flushMicrotasks();
    expect(container.querySelector('[data-testid="redirected-home"]')).toBeNull();
    expect(container.textContent).toContain("This page isn't part of your role");
    expect(container.textContent).not.toContain('Parents');
  });

  it('renders the real Parents tab for a coach role', async () => {
    renderGatedPage(COACH_USER);
    await flushMicrotasks();
    expect(container.querySelector('[data-testid="redirected-home"]')).toBeNull();
    expect(container.textContent).toContain('Renata Alvarez');
  });
});
