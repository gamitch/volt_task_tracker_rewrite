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
 *
 * T094 (ED-1 Packet P5) additions: real load/mutation wiring
 * (`loadParentsTabData`/`unlinkAllStudents`, `../../lib/supabase/loaders/
 * parents`; `resendInvite`/`revokeInvite` reused from `../../lib/supabase/
 * loaders/invites`) proven against stubbed `SupabaseClient`s (same DI
 * pattern `StudentsTab.test.tsx`/T089 already established); optimistic-
 * update-plus-rollback for Remove/Resend. Every pre-existing describe block
 * below now explicitly passes `loadData: defaultLoadParentsTabData` (per
 * T087's own precedent: "the default changes, the fixture literal doesn't"
 * -- this file's own default is now the REAL `loadParentsTabData`, which
 * this jsdom test environment cannot reach), so none of them depend on
 * which function is the component's implicit default.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { SupabaseClient } from '@supabase/supabase-js';
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
  type ResendParentInviteFn,
  type RevokeParentInviteFn,
  type StudentRow,
  type UnlinkAllStudentsFn,
} from './ParentsTab';
import { makeLoadParentsTabData, makeUnlinkAllStudents } from '../../lib/supabase/loaders/parents';

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

// T094: `InviteRow` gained `expiresAt`/`createdAt` (structural compatibility
// with `resendInvite`/`revokeInvite`'s own parameter type -- this file's own
// T094 module doc). Never asserted on below; only needed to satisfy the type.
const TEST_EXPIRES_AT = '2026-08-01T00:00:00.000Z';
const TEST_CREATED_AT = '2026-07-01T00:00:00.000Z';

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
        expiresAt: TEST_EXPIRES_AT,
        createdAt: TEST_CREATED_AT,
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
        expiresAt: TEST_EXPIRES_AT,
        createdAt: TEST_CREATED_AT,
      },
    ];
    const rows = buildParentDisplayRows([], [], students, invites, new Set());
    expect(rows).toHaveLength(0);
  });

  it('groups multiple role=parent invites sharing one email into a single row', () => {
    const invites: InviteRow[] = [
      {
        id: 'i1',
        email: 'shared@example.com',
        role: 'parent',
        studentId: 's1',
        status: 'expired',
        expiresAt: TEST_EXPIRES_AT,
        createdAt: TEST_CREATED_AT,
      },
      {
        id: 'i2',
        email: 'shared@example.com',
        role: 'parent',
        studentId: 's2',
        status: 'pending',
        expiresAt: TEST_EXPIRES_AT,
        createdAt: TEST_CREATED_AT,
      },
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
      {
        id: 'i1',
        email: 'a@example.com',
        role: 'parent',
        studentId: 's1',
        status: 'pending',
        expiresAt: TEST_EXPIRES_AT,
        createdAt: TEST_CREATED_AT,
      },
      {
        id: 'i2',
        email: 'a@example.com',
        role: 'student',
        studentId: 's1',
        status: 'pending',
        expiresAt: TEST_EXPIRES_AT,
        createdAt: TEST_CREATED_AT,
      },
      {
        id: 'i3',
        email: 'b@example.com',
        role: 'parent',
        studentId: 's1',
        status: 'pending',
        expiresAt: TEST_EXPIRES_AT,
        createdAt: TEST_CREATED_AT,
      },
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
    renderBody({ loadData: defaultLoadParentsTabData });
    await flushMicrotasks();

    expect(container.textContent).toContain('Renata Alvarez');
    // Avatar renders role="img" aria-label={name} (Avatar.tsx) -- a robust,
    // implementation-accurate query independent of visual initials text.
    expect(document.querySelector('[role="img"][aria-label="Elena Park"]')).toBeTruthy();
    expect(document.querySelector('[role="img"][aria-label="Mateo Cruz"]')).toBeTruthy();
  });

  it('renders "No linked students" for a parent with zero links (Denise Cole)', async () => {
    renderBody({ loadData: defaultLoadParentsTabData });
    await flushMicrotasks();
    expect(container.textContent).toContain('Denise Cole');
    expect(container.textContent).toContain('No linked students');
  });

  it('renders an invite-only row using its email (no display name exists yet)', async () => {
    renderBody({ loadData: defaultLoadParentsTabData });
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
  it('unlinks BOTH students, calls the real onUnlinkAllStudents once, and marks the profile Removed, in one confirmed action', async () => {
    const onUnlinkAllStudents = vi.fn<UnlinkAllStudentsFn>().mockResolvedValue(undefined);
    renderBody({ loadData: defaultLoadParentsTabData, onUnlinkAllStudents });
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
    await flushMicrotasks();

    // T094: the real `guardian_links` delete is called exactly once, for the
    // whole parent -- never once per link.
    expect(onUnlinkAllStudents).toHaveBeenCalledTimes(1);
    expect(onUnlinkAllStudents).toHaveBeenCalledWith('profile-renata-alvarez');

    // Row stays visible (matches StudentsTab's reversible-flip visibility
    // posture), both links gone, "Removed" badge/status shown.
    expect(container.textContent).toContain('Renata Alvarez');
    expect(document.querySelector('[role="img"][aria-label="Elena Park"]')).toBeNull();
    expect(document.querySelector('[role="img"][aria-label="Mateo Cruz"]')).toBeNull();
    expect(container.textContent).toContain('Removed');
    expect(container.textContent).toContain('Parent removed');

    // Remove is no longer offered a second time.
    const menuAfter = openMoreMenuFor('Renata Alvarez');
    expect(menuItemTexts(menuAfter)).toEqual(['Edit links']);
  });

  it('T094: rolls back the optimistic unlink and shows an error banner when the real mutation rejects', async () => {
    const onUnlinkAllStudents = vi
      .fn<UnlinkAllStudentsFn>()
      .mockRejectedValue({ code: '42501', message: 'Permission denied.', cause: null });
    renderBody({ loadData: defaultLoadParentsTabData, onUnlinkAllStudents });
    await flushMicrotasks();

    clickMenuItem(openMoreMenuFor('Renata Alvarez'), 'Remove');
    clickButtonWithText('Remove');
    await flushMicrotasks();

    expect(onUnlinkAllStudents).toHaveBeenCalledWith('profile-renata-alvarez');
    // Rolled back -- both links restored, not marked Removed.
    expect(document.querySelector('[role="img"][aria-label="Elena Park"]')).toBeTruthy();
    expect(document.querySelector('[role="img"][aria-label="Mateo Cruz"]')).toBeTruthy();
    expect(container.textContent).not.toContain('Removed');
    expect(container.textContent).toContain("Couldn't remove parent");
    expect(container.textContent).toContain('Permission denied.');
    // Remove is still offered (rollback restored the menu item too).
    const menuAfter = openMoreMenuFor('Renata Alvarez');
    expect(menuItemTexts(menuAfter)).toEqual(['Edit links', 'Remove']);
  });
});

describe('<ParentsTabBody /> Remove -- invite-only row (no profile, no guardian_links yet)', () => {
  it('calls the real onRevokeInvite once per matching raw invite row, different dialog copy', async () => {
    const onRevokeInvite = vi.fn<RevokeParentInviteFn>().mockResolvedValue(undefined);
    renderBody({ loadData: defaultLoadParentsTabData, onRevokeInvite });
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
    await flushMicrotasks();

    expect(onRevokeInvite).toHaveBeenCalledTimes(1);
    expect(onRevokeInvite).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'harlan.fell@example.com', role: 'parent' }),
    );
    expect(container.textContent).toContain('harlan.fell@example.com');
    expect(container.textContent).toContain('Invite revoked');

    // Remove is gone once already revoked; Resend remains (undo path).
    const menuAfter = openMoreMenuFor('harlan.fell@example.com');
    expect(menuItemTexts(menuAfter)).toEqual(['Edit links', 'Resend invite']);
  });

  it('T094: rolls back the optimistic revoke and shows an error banner when the real mutation rejects', async () => {
    const onRevokeInvite = vi
      .fn<RevokeParentInviteFn>()
      .mockRejectedValue({ code: '42501', message: 'Permission denied.', cause: null });
    renderBody({ loadData: defaultLoadParentsTabData, onRevokeInvite });
    await flushMicrotasks();

    clickMenuItem(openMoreMenuFor('harlan.fell@example.com'), 'Remove');
    clickButtonWithText('Remove');
    await flushMicrotasks();

    expect(onRevokeInvite).toHaveBeenCalled();
    expect(container.textContent).not.toContain('Invite revoked');
    expect(container.textContent).toContain("Couldn't revoke invite");
    expect(container.textContent).toContain('Permission denied.');
  });
});

// ---------------------------------------------------------------------------
// Resend invite -- module doc #5 (T094: genuinely real now).
// ---------------------------------------------------------------------------

describe('<ParentsTabBody /> Resend invite', () => {
  it('really flips an expired invite back to pending, calls the real onResendInvite, and shows a success banner', async () => {
    const onResendInvite = vi
      .fn<ResendParentInviteFn>()
      .mockImplementation((invite) => Promise.resolve({ ...invite, status: 'pending' }));
    renderBody({ loadData: defaultLoadParentsTabData, onResendInvite });
    await flushMicrotasks();

    expect(container.textContent).toContain('Invite expired'); // priya.quinn's initial state.

    const menu = openMoreMenuFor('priya.quinn@example.com');
    clickMenuItem(menu, 'Resend invite');
    await flushMicrotasks();

    expect(onResendInvite).toHaveBeenCalledTimes(1);
    expect(onResendInvite).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'priya.quinn@example.com', role: 'parent' }),
    );
    expect(container.textContent).toContain('Invited'); // real state flip, not just a banner.
    expect(container.textContent).not.toContain('Invite expired');
    expect(container.textContent).toContain('Invite resent');
  });

  it('T094: rolls back the optimistic flip and shows an error banner when the real resend mutation rejects', async () => {
    const onResendInvite = vi
      .fn<ResendParentInviteFn>()
      .mockRejectedValue({ code: '42501', message: 'Permission denied.', cause: null });
    renderBody({ loadData: defaultLoadParentsTabData, onResendInvite });
    await flushMicrotasks();

    clickMenuItem(openMoreMenuFor('priya.quinn@example.com'), 'Resend invite');
    await flushMicrotasks();

    expect(onResendInvite).toHaveBeenCalled();
    // Rolled back -- still expired, not pending.
    expect(container.textContent).toContain('Invite expired');
    expect(container.textContent).toContain("Couldn't resend invite");
    expect(container.textContent).toContain('Permission denied.');
  });
});

// ---------------------------------------------------------------------------
// Edit links stub -- inert disclosure, per this task's Forbidden Files.
// ---------------------------------------------------------------------------

describe('<ParentsTabBody /> Edit links stub', () => {
  it('shows a disclosure banner, changes nothing', async () => {
    renderBody({ loadData: defaultLoadParentsTabData });
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

// T094: `<ParentsTab />` with no `loadData` override now defaults to the
// REAL `loadParentsTabData` (a genuine Supabase call this jsdom test
// environment can't make) -- explicitly injects the fixture-backed
// `defaultLoadParentsTabData` here (`ParentsTab`'s own gated wrapper
// forwards every prop straight through to `ParentsTabBody`), same "inject
// the fixture explicitly through the seam" pattern this task's packet
// itself names.
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
                  <ParentsTab loadData={defaultLoadParentsTabData} />
                ) : (
                  <LoginAs user={user}>
                    <ParentsTab loadData={defaultLoadParentsTabData} />
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

// ---------------------------------------------------------------------------
// T094: real `loaders/parents.ts` seams -- `makeLoadParentsTabData`,
// `makeUnlinkAllStudents`. Stubbed `SupabaseClient` only, same DI pattern as
// `StudentsTab.test.tsx`/T089 -- zero real network calls. `resendInvite`/
// `revokeInvite` are NOT re-tested here (T090's own `InvitesTab.test.tsx`
// already covers `loaders/invites.ts` directly; this file only proves
// `ParentsTab.tsx` calls them, above).
// ---------------------------------------------------------------------------

describe('loadParentsTabData (T094 real load)', () => {
  it('queries profiles(role=parent)/guardian_links/students/invites and maps snake_case DB rows to camelCase rows', async () => {
    const profilesEqSpy = vi.fn(() => ({
      order: vi.fn().mockResolvedValue({
        data: [
          {
            id: 'profile-db-1',
            display_name: 'DB Parent',
            email: 'db.parent@example.com',
            avatar_url: null,
          },
        ],
        error: null,
      }),
    }));
    const guardianLinksSelectSpy = vi.fn().mockResolvedValue({
      data: [{ id: 'link-db-1', parent_profile_id: 'profile-db-1', student_id: 'student-db-1' }],
      error: null,
    });
    const studentsOrderSpy = vi.fn().mockResolvedValue({
      data: [{ id: 'student-db-1', display_name: 'DB Student' }],
      error: null,
    });
    const invitesOrderSpy = vi.fn().mockResolvedValue({
      data: [
        {
          id: 'invite-db-1',
          email: 'invite@example.com',
          role: 'parent',
          student_id: 'student-db-1',
          invited_by: 'profile-staff-1',
          status: 'pending',
          expires_at: '2026-08-01T00:00:00.000Z',
          created_at: '2026-01-01T00:00:00.000Z',
        },
      ],
      error: null,
    });

    const fromSpy = vi.fn((table: string) => {
      if (table === 'profiles') return { select: vi.fn(() => ({ eq: profilesEqSpy })) };
      if (table === 'guardian_links') return { select: guardianLinksSelectSpy };
      if (table === 'students') return { select: vi.fn(() => ({ order: studentsOrderSpy })) };
      return { select: vi.fn(() => ({ order: invitesOrderSpy })) };
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const load = makeLoadParentsTabData(() => client);
    const result = await load();

    expect(fromSpy).toHaveBeenCalledWith('profiles');
    expect(fromSpy).toHaveBeenCalledWith('guardian_links');
    expect(fromSpy).toHaveBeenCalledWith('students');
    expect(fromSpy).toHaveBeenCalledWith('invites');
    // Trap #1: server-side role='parent' filter.
    expect(profilesEqSpy).toHaveBeenCalledWith('role', 'parent');

    expect(result).toEqual<ParentsTabLoadResult>({
      parentProfiles: [
        {
          id: 'profile-db-1',
          displayName: 'DB Parent',
          email: 'db.parent@example.com',
          avatarUrl: null,
        },
      ],
      guardianLinks: [
        { id: 'link-db-1', parentProfileId: 'profile-db-1', studentId: 'student-db-1' },
      ],
      students: [{ id: 'student-db-1', displayName: 'DB Student' }],
      invites: [
        {
          id: 'invite-db-1',
          email: 'invite@example.com',
          role: 'parent',
          studentId: 'student-db-1',
          status: 'pending',
          expiresAt: '2026-08-01T00:00:00.000Z',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      ],
    });
  });

  it('bridges the "no rows" case for all four tables to empty arrays, not a crash', async () => {
    const nullResult = { data: null, error: null };
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'profiles') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({ order: vi.fn().mockResolvedValue(nullResult) })),
            })),
          };
        }
        if (table === 'guardian_links') {
          return { select: vi.fn().mockResolvedValue(nullResult) };
        }
        return { select: vi.fn(() => ({ order: vi.fn().mockResolvedValue(nullResult) })) };
      }),
    } as unknown as SupabaseClient;

    const load = makeLoadParentsTabData(() => client);
    const result = await load();

    expect(result).toEqual({ parentProfiles: [], guardianLinks: [], students: [], invites: [] });
  });

  it('rejects with the real SupabaseLoaderError when any one of the four queries fails', async () => {
    const failResult = { data: null, error: { message: 'permission denied', code: '42501' } };
    const okResult = { data: [], error: null };
    const client = {
      from: vi.fn((table: string) => {
        if (table === 'guardian_links') {
          return { select: vi.fn().mockResolvedValue(failResult) };
        }
        if (table === 'profiles') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({ order: vi.fn().mockResolvedValue(okResult) })),
            })),
          };
        }
        return { select: vi.fn(() => ({ order: vi.fn().mockResolvedValue(okResult) })) };
      }),
    } as unknown as SupabaseClient;

    const load = makeLoadParentsTabData(() => client);
    await expect(load()).rejects.toMatchObject({ code: '42501', message: expect.any(String) });
  });
});

describe('unlinkAllStudents (T094 real mutation, Trap #5)', () => {
  it('calls guardian_links.delete().eq("parent_profile_id", id) with exactly the targeted parent', async () => {
    const eqSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const deleteSpy = vi.fn(() => ({ eq: eqSpy }));
    const fromSpy = vi.fn(() => ({ delete: deleteSpy }));
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const unlink = makeUnlinkAllStudents(() => client);
    await unlink('profile-1');

    expect(fromSpy).toHaveBeenCalledWith('guardian_links');
    expect(eqSpy).toHaveBeenCalledWith('parent_profile_id', 'profile-1');
  });

  it('rejects with the real SupabaseLoaderError on a genuine mutation error', async () => {
    const eqSpy = vi
      .fn()
      .mockResolvedValue({ data: null, error: { message: 'nope', code: '42501' } });
    const client = {
      from: vi.fn(() => ({ delete: vi.fn(() => ({ eq: eqSpy })) })),
    } as unknown as SupabaseClient;

    const unlink = makeUnlinkAllStudents(() => client);
    await expect(unlink('profile-1')).rejects.toMatchObject({ code: '42501' });
  });
});
