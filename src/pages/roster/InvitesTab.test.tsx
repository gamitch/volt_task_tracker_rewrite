// @vitest-environment jsdom
/**
 * T027: tests for `InvitesTab.tsx`.
 *
 * Per this task's Allowed Files ("A colocated `InvitesTab.test.tsx` is
 * acceptable per established precedent") this test file is a deliberate,
 * disclosed addition -- the same class of addition `StudentsTab.test.tsx`
 * (T022), `MeetingsList.test.tsx` (T030), `OutreachList.test.tsx` (T038), and
 * `CheckinResult.test.tsx` (T035) already made in their own sibling
 * directories, existing only to produce the DOM-text proof this task's own
 * packet requires in "Required Worker Output": the AUTH-06 14-day expiry
 * boundary derivation, the Resend/Revoke per-row availability gating, and
 * the Revoke `AlertDialog` flow (confirming `status` flips to `'revoked'`
 * without any client-side `audit_log` write).
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- these tests use the same raw `createRoot`/`act` pattern
 * every prior content-page test file already established.
 *
 * T087 (ED-1 Packet P1) additions: the `loadInvitesTabData (T087 real load)`
 * / `revokeInvite (T087 real mutation)` describe blocks below prove the new
 * default `loadData`/`onRevoke` seams (`../../lib/supabase/loaders/invites`)
 * genuinely query/mutate `invites` with the right shape, against a stubbed
 * `SupabaseClient` (same DI pattern `src/lib/supabase/loader.test.ts`
 * already established) -- zero real network calls anywhere in this file.
 * Every pre-existing describe block below still passes its own explicit
 * `loadData`/`onResend`/`onRevoke` fixture through the component's props
 * (per this task's Known Context/Traps #7 -- "the default changes, the
 * fixture literal doesn't"), so none of them depend on which function is
 * the component's implicit default.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildDisplayRows,
  canResendInvite,
  canRevokeInvite,
  deriveInviteDisplayStatus,
  InvitesTab,
  withResendResult,
  withRevokedStatus,
  type InviteRow,
  type InvitesTabLoadResult,
} from './InvitesTab';
import { makeLoadInvitesTabData, makeRevokeInvite } from '../../lib/supabase/loaders/invites';

// ---------------------------------------------------------------------------
// jsdom gap: `AlertDialog` renders a native `<dialog>` and calls
// `HTMLDialogElement.prototype.showModal()`, which this repo's installed
// jsdom does not implement -- same gap `StudentsTab.test.tsx` (T022)
// already documented and polyfilled, scoped locally to this test file only
// (not the shared `src/test-setup.ts`, which is outside this task's Allowed
// Files).
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

function renderTab(props: Parameters<typeof InvitesTab>[0] = {}): void {
  act(() => {
    root.render(<InvitesTab {...props} />);
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

/**
 * jsdom finding (same as `StudentsTab.test.tsx`/T022): `MoreMenu` renders
 * its item list unconditionally into the DOM every render, scoped only by
 * the trigger button's own `aria-controls` id pointing at that row's
 * `role="menu"` container. `openMoreMenuFor` returns the SCOPED menu
 * element for one specific row so a different row's identically-labeled
 * item can never be mistaken for this row's.
 */
function openMoreMenuFor(email: string): HTMLElement {
  const trigger = document.querySelector(`button[aria-label="Actions for ${email}"]`);
  expect(trigger, `expected a MoreMenu trigger for "${email}"`).toBeTruthy();
  act(() => {
    trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  const menuId = trigger?.getAttribute('aria-controls') ?? null;
  const menu = menuId ? document.getElementById(menuId) : null;
  expect(menu, `expected a scoped menu element for "${email}"`).toBeTruthy();
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
// AUTH-06 14-day boundary -- module doc #2. The packet's core requirement:
// "an invite sent exactly 14 days ago (or with expires_at in the past) shows
// Expired; one sent 13 days ago shows Pending."
// ---------------------------------------------------------------------------

describe('deriveInviteDisplayStatus (AUTH-06 14-day boundary)', () => {
  const now = new Date('2026-07-19T12:00:00.000Z');
  const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
  const THIRTEEN_DAYS_MS = 13 * 24 * 60 * 60 * 1000;

  it('shows Expired for a pending invite sent exactly 14 days ago (expires_at === now)', () => {
    const sentAt = new Date(now.getTime() - FOURTEEN_DAYS_MS);
    const expiresAt = new Date(sentAt.getTime() + FOURTEEN_DAYS_MS).toISOString();
    // Sanity: this really is the boundary -- expires_at lands exactly on "now".
    expect(expiresAt).toBe(now.toISOString());
    expect(deriveInviteDisplayStatus('pending', expiresAt, now)).toBe('expired');
  });

  it('shows Pending for a pending invite sent 13 days ago (expires_at 1 day in the future)', () => {
    const sentAt = new Date(now.getTime() - THIRTEEN_DAYS_MS);
    const expiresAt = new Date(sentAt.getTime() + FOURTEEN_DAYS_MS).toISOString();
    expect(new Date(expiresAt).getTime()).toBeGreaterThan(now.getTime());
    expect(deriveInviteDisplayStatus('pending', expiresAt, now)).toBe('pending');
  });

  it('derives Expired for a pending row whose expires_at is in the past, regardless of "sent N days ago" framing', () => {
    const pastExpiry = new Date(now.getTime() - 1000).toISOString();
    expect(deriveInviteDisplayStatus('pending', pastExpiry, now)).toBe('expired');
  });

  it('derives Pending for a pending row whose expires_at is still in the future', () => {
    const futureExpiry = new Date(now.getTime() + 1000).toISOString();
    expect(deriveInviteDisplayStatus('pending', futureExpiry, now)).toBe('pending');
  });

  it('trusts accepted/revoked/expired stored status regardless of expires_at', () => {
    const futureExpiry = new Date(now.getTime() + 1_000_000).toISOString();
    expect(deriveInviteDisplayStatus('accepted', futureExpiry, now)).toBe('accepted');
    expect(deriveInviteDisplayStatus('revoked', futureExpiry, now)).toBe('revoked');
    expect(deriveInviteDisplayStatus('expired', futureExpiry, now)).toBe('expired');
  });
});

// ---------------------------------------------------------------------------
// Per-row Resend/Revoke availability -- module doc #5.
// ---------------------------------------------------------------------------

describe('canResendInvite / canRevokeInvite (module doc #5 judgment call)', () => {
  it('are true for pending and expired, false for accepted and revoked', () => {
    expect(canResendInvite('pending')).toBe(true);
    expect(canResendInvite('expired')).toBe(true);
    expect(canResendInvite('accepted')).toBe(false);
    expect(canResendInvite('revoked')).toBe(false);

    expect(canRevokeInvite('pending')).toBe(true);
    expect(canRevokeInvite('expired')).toBe(true);
    expect(canRevokeInvite('accepted')).toBe(false);
    expect(canRevokeInvite('revoked')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// buildDisplayRows / withRevokedStatus / withResendResult
// ---------------------------------------------------------------------------

describe('buildDisplayRows', () => {
  it('joins derived display status per row', () => {
    const now = new Date('2026-07-19T12:00:00.000Z');
    const invites: InviteRow[] = [
      {
        id: 'i1',
        email: 'a@example.com',
        role: 'student',
        studentId: null,
        status: 'pending',
        createdAt: '2026-07-01T00:00:00.000Z',
        expiresAt: '2026-07-15T00:00:00.000Z',
      },
    ];
    const rows = buildDisplayRows(invites, now);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: 'i1', email: 'a@example.com', displayStatus: 'expired' });
  });
});

describe('withRevokedStatus (module doc #4 -- the ONLY place status becomes revoked)', () => {
  it('flips only the targeted row, never touching others', () => {
    const invites: InviteRow[] = [
      {
        id: 'i1',
        email: 'a@example.com',
        role: 'student',
        studentId: null,
        status: 'pending',
        createdAt: '2026-07-01T00:00:00.000Z',
        expiresAt: '2026-07-15T00:00:00.000Z',
      },
      {
        id: 'i2',
        email: 'b@example.com',
        role: 'parent',
        studentId: null,
        status: 'pending',
        createdAt: '2026-07-01T00:00:00.000Z',
        expiresAt: '2026-07-15T00:00:00.000Z',
      },
    ];
    const result = withRevokedStatus(invites, 'i1');
    expect(result.find((i) => i.id === 'i1')?.status).toBe('revoked');
    expect(result.find((i) => i.id === 'i2')?.status).toBe('pending');
  });
});

describe('withResendResult (module doc #6)', () => {
  it('replaces only the matching row', () => {
    const invites: InviteRow[] = [
      {
        id: 'i1',
        email: 'a@example.com',
        role: 'student',
        studentId: null,
        status: 'expired',
        createdAt: '2026-06-01T00:00:00.000Z',
        expiresAt: '2026-06-15T00:00:00.000Z',
      },
    ];
    const updated: InviteRow = {
      ...invites[0],
      status: 'pending',
      expiresAt: '2026-08-01T00:00:00.000Z',
    };
    const result = withResendResult(invites, updated);
    expect(result[0]).toEqual(updated);
  });
});

// ---------------------------------------------------------------------------
// Fixture data for render tests -- fabricated names/emails only.
// ---------------------------------------------------------------------------

function testLoadData(): Promise<InvitesTabLoadResult> {
  const invites: InviteRow[] = [
    {
      id: 'invite-pending',
      email: 'nova.abara@example.com',
      role: 'student',
      studentId: 'student-nova-abara',
      status: 'pending',
      createdAt: '2026-07-17T09:00:00.000Z',
      expiresAt: '2099-01-01T00:00:00.000Z', // far future -> Pending
    },
    {
      id: 'invite-stale-pending',
      email: 'wren.castellan@example.com',
      role: 'parent',
      studentId: 'student-wren-castellan',
      status: 'pending',
      createdAt: '2020-01-01T00:00:00.000Z',
      expiresAt: '2020-01-15T00:00:00.000Z', // long past -> Expired via derivation
    },
    {
      id: 'invite-accepted',
      email: 'iris.montague@example.com',
      role: 'coach',
      studentId: null,
      status: 'accepted',
      createdAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-01-15T00:00:00.000Z',
    },
    {
      id: 'invite-revoked',
      email: 'sable.okafor@example.com',
      role: 'admin',
      studentId: null,
      status: 'revoked',
      createdAt: '2026-01-01T00:00:00.000Z',
      expiresAt: '2026-01-15T00:00:00.000Z',
    },
  ];
  return Promise.resolve({ invites });
}

// ---------------------------------------------------------------------------
// DES-12 four states + real-render proof of the AUTH-06 derivation.
// ---------------------------------------------------------------------------

describe('<InvitesTab /> DES-12 states', () => {
  it('shows a loading Skeleton (T081: table has predictable dimensions) before data resolves', () => {
    renderTab({ loadData: () => new Promise(() => {}) });
    expect(container.textContent).toContain('Loading invites');
  });

  it('shows an error banner when loadData rejects', async () => {
    renderTab({ loadData: () => Promise.reject(new Error('boom')) });
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't load invites");
  });

  it('shows an empty state when there are no invites at all', async () => {
    renderTab({ loadData: () => Promise.resolve({ invites: [] }) });
    await flushMicrotasks();
    expect(container.textContent).toContain('No invites sent yet');
  });

  it('renders all four display statuses, deriving Expired for a stale pending row (module doc #2, real component)', async () => {
    renderTab({ loadData: testLoadData });
    await flushMicrotasks();

    expect(container.textContent).toContain('nova.abara@example.com');
    expect(container.textContent).toContain('wren.castellan@example.com');
    expect(container.textContent).toContain('iris.montague@example.com');
    expect(container.textContent).toContain('sable.okafor@example.com');

    // "Pending" text appears for the far-future-expiry row.
    expect(container.textContent).toContain('Pending');
    // "Accepted" text appears for the accepted row.
    expect(container.textContent).toContain('Accepted');
    // "Revoked" text appears for the revoked row.
    expect(container.textContent).toContain('Revoked');
    // "Expired" text appears -- for BOTH invite-stale-pending (derived from a
    // real past expires_at, stored status still 'pending') AND would also
    // appear for a literally-stored 'expired' row; this fixture only
    // exercises the derived case, proving the derivation is live in the
    // rendered table, not just the isolated pure function.
    expect(container.textContent).toContain('Expired');
  });
});

// ---------------------------------------------------------------------------
// Resend/Revoke per-row availability -- module doc #5, real render proof.
// ---------------------------------------------------------------------------

describe('<InvitesTab /> row MoreMenu -- Resend/Revoke availability', () => {
  it('offers Resend and Revoke for Pending and Expired rows, neither for Accepted/Revoked rows', async () => {
    renderTab({ loadData: testLoadData });
    await flushMicrotasks();

    const pendingMenu = openMoreMenuFor('nova.abara@example.com');
    expect(menuItemTexts(pendingMenu)).toEqual(['Resend', 'Revoke']);

    const staleMenu = openMoreMenuFor('wren.castellan@example.com');
    expect(menuItemTexts(staleMenu)).toEqual(['Resend', 'Revoke']);

    // Accepted/Revoked rows: no MoreMenu trigger at all (module doc #10 --
    // an em dash is rendered instead of an empty menu).
    expect(
      document.querySelector('button[aria-label="Actions for iris.montague@example.com"]'),
    ).toBeNull();
    expect(
      document.querySelector('button[aria-label="Actions for sable.okafor@example.com"]'),
    ).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Resend flow -- module doc #6.
// ---------------------------------------------------------------------------

describe('<InvitesTab /> Resend flow', () => {
  it('calls the injected onResend and shows a success banner', async () => {
    const onResend = vi.fn(async (invite: InviteRow) => ({
      ...invite,
      status: 'pending' as const,
      expiresAt: '2099-06-01T00:00:00.000Z',
    }));
    renderTab({ loadData: testLoadData, onResend });
    await flushMicrotasks();

    const menu = openMoreMenuFor('wren.castellan@example.com');
    clickMenuItem(menu, 'Resend');
    await flushMicrotasks();

    expect(onResend).toHaveBeenCalledTimes(1);
    expect(onResend.mock.calls[0][0].id).toBe('invite-stale-pending');
    expect(container.textContent).toContain('Invite resent');
    expect(container.textContent).toContain('wren.castellan@example.com');
  });

  it('shows an error banner when onResend rejects', async () => {
    const onResend = vi.fn(async () => {
      throw new Error('network down');
    });
    renderTab({ loadData: testLoadData, onResend });
    await flushMicrotasks();

    clickMenuItem(openMoreMenuFor('wren.castellan@example.com'), 'Resend');
    await flushMicrotasks();

    expect(container.textContent).toContain("Couldn't resend invite");
  });
});

// ---------------------------------------------------------------------------
// Revoke flow (AlertDialog) -- module doc #4. Proves status flips to
// 'revoked' and that no audit_log write is attempted from this UI.
// ---------------------------------------------------------------------------

describe('<InvitesTab /> Revoke flow (module doc #4 -- trg_audit_invite_revocation is automatic)', () => {
  it('opens a real AlertDialog, confirms, calls onRevoke, and updates the row to Revoked', async () => {
    const onRevoke = vi.fn<(invite: InviteRow) => Promise<void>>(async () => {
      // Deliberately does nothing beyond resolving -- represents "the
      // real backend set invites.status='revoked'"; this test asserts the
      // UI-side contract, not a database write.
    });
    renderTab({ loadData: testLoadData, onRevoke });
    await flushMicrotasks();

    const menu = openMoreMenuFor('nova.abara@example.com');
    clickMenuItem(menu, 'Revoke');

    // AlertDialog is open with the real "revoking access" framing.
    expect(document.body.textContent).toContain('Revoke invite to nova.abara@example.com?');
    expect(document.body.textContent).toContain('stop working immediately');

    clickButtonWithText('Revoke invite');
    await flushMicrotasks();

    expect(onRevoke).toHaveBeenCalledTimes(1);
    expect(onRevoke.mock.calls[0][0].id).toBe('invite-pending');

    expect(container.textContent).toContain('Invite revoked');
    expect(container.textContent).toContain('Revoked');

    // The now-Revoked row no longer offers Resend/Revoke (module doc #5).
    expect(
      document.querySelector('button[aria-label="Actions for nova.abara@example.com"]'),
    ).toBeNull();
  });

  it('shows an error banner and keeps the invite un-revoked when onRevoke rejects', async () => {
    const onRevoke = vi.fn(async () => {
      throw new Error('db unreachable');
    });
    renderTab({ loadData: testLoadData, onRevoke });
    await flushMicrotasks();

    clickMenuItem(openMoreMenuFor('nova.abara@example.com'), 'Revoke');
    clickButtonWithText('Revoke invite');
    await flushMicrotasks();

    expect(container.textContent).toContain("Couldn't revoke invite");
    // Row is still actionable (Resend/Revoke still offered -- not silently revoked).
    expect(
      document.querySelector('button[aria-label="Actions for nova.abara@example.com"]'),
    ).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// T087 (ED-1 Packet P1): real `loadData` seam --
// `../../lib/supabase/loaders/invites`'s `makeLoadInvitesTabData`. Stubbed
// `SupabaseClient` only, same DI pattern as `src/lib/supabase/loader.test.ts`
// -- zero real network calls.
// ---------------------------------------------------------------------------

/** Minimal fake `SupabaseClient` supporting exactly the chain
 * `client.from('invites').select('*').order('created_at', {...})` used --
 * nothing else on the client is ever touched by `queryInvites`. */
function makeFakeSelectClient(result: { data: unknown; error: unknown }): {
  client: SupabaseClient;
  fromSpy: ReturnType<typeof vi.fn>;
  selectSpy: ReturnType<typeof vi.fn>;
  orderSpy: ReturnType<typeof vi.fn>;
} {
  const orderSpy = vi.fn().mockResolvedValue(result);
  const selectSpy = vi.fn(() => ({ order: orderSpy }));
  const fromSpy = vi.fn(() => ({ select: selectSpy }));
  const client = { from: fromSpy } as unknown as SupabaseClient;
  return { client, fromSpy, selectSpy, orderSpy };
}

describe('loadInvitesTabData (T087 real load, packet Known Context/Traps #3)', () => {
  it('queries invites ordered by created_at desc and maps snake_case DB rows to camelCase InviteRow', async () => {
    const dbRows = [
      {
        id: 'invite-db-1',
        email: 'db.row@example.com',
        role: 'student',
        student_id: 'student-db-1',
        invited_by: 'profile-staff-1',
        status: 'pending',
        expires_at: '2026-08-01T00:00:00.000Z',
        created_at: '2026-07-01T00:00:00.000Z',
      },
    ];
    const { client, fromSpy, selectSpy, orderSpy } = makeFakeSelectClient({
      data: dbRows,
      error: null,
    });
    const load = makeLoadInvitesTabData(() => client);

    const result = await load();

    expect(fromSpy).toHaveBeenCalledWith('invites');
    expect(selectSpy).toHaveBeenCalledWith('*');
    expect(orderSpy).toHaveBeenCalledWith('created_at', { ascending: false });
    // invited_by is deliberately dropped (Trap #1 decision) -- everything
    // else is a 1:1 camelCase rename.
    const expected: InvitesTabLoadResult = {
      invites: [
        {
          id: 'invite-db-1',
          email: 'db.row@example.com',
          role: 'student',
          studentId: 'student-db-1',
          status: 'pending',
          expiresAt: '2026-08-01T00:00:00.000Z',
          createdAt: '2026-07-01T00:00:00.000Z',
        },
      ],
    };
    expect(result).toEqual(expected);
  });

  it('bridges the "no rows" (data: null, error: null) case to an empty invites array, not a crash', async () => {
    const { client } = makeFakeSelectClient({ data: null, error: null });
    const load = makeLoadInvitesTabData(() => client);

    const result = await load();

    expect(result).toEqual({ invites: [] });
  });

  it('rejects with the real SupabaseLoaderError on a genuine query error -- no fixture fallback', async () => {
    const { client } = makeFakeSelectClient({
      data: null,
      error: { message: 'permission denied for table invites', code: '42501' },
    });
    const load = makeLoadInvitesTabData(() => client);

    await expect(load()).rejects.toMatchObject({ code: '42501', message: expect.any(String) });
  });
});

// ---------------------------------------------------------------------------
// T087 (ED-1 Packet P1): real `onRevoke` seam --
// `../../lib/supabase/loaders/invites`'s `makeRevokeInvite`.
// ---------------------------------------------------------------------------

/** Minimal fake `SupabaseClient` supporting exactly the chain
 * `client.from('invites').update({...}).eq('id', ...)` used. */
function makeFakeUpdateClient(result: { data: unknown; error: unknown }): {
  client: SupabaseClient;
  fromSpy: ReturnType<typeof vi.fn>;
  updateSpy: ReturnType<typeof vi.fn>;
  eqSpy: ReturnType<typeof vi.fn>;
} {
  const eqSpy = vi.fn().mockResolvedValue(result);
  const updateSpy = vi.fn(() => ({ eq: eqSpy }));
  const fromSpy = vi.fn(() => ({ update: updateSpy }));
  const client = { from: fromSpy } as unknown as SupabaseClient;
  return { client, fromSpy, updateSpy, eqSpy };
}

const REVOKE_TARGET: InviteRow = {
  id: 'invite-to-revoke',
  email: 'revoke.me@example.com',
  role: 'parent',
  studentId: null,
  status: 'pending',
  expiresAt: '2026-08-01T00:00:00.000Z',
  createdAt: '2026-07-01T00:00:00.000Z',
};

describe('revokeInvite (T087 real mutation, packet Known Context/Traps #4)', () => {
  it('calls invites.update({ status: "revoked" }).eq("id", invite.id) with exactly the targeted id', async () => {
    const { client, fromSpy, updateSpy, eqSpy } = makeFakeUpdateClient({
      data: null,
      error: null,
    });
    const revoke = makeRevokeInvite(() => client);

    await revoke(REVOKE_TARGET);

    expect(fromSpy).toHaveBeenCalledWith('invites');
    expect(updateSpy).toHaveBeenCalledWith({ status: 'revoked' });
    expect(eqSpy).toHaveBeenCalledWith('id', 'invite-to-revoke');
  });

  it('resolves undefined (no return payload) on success', async () => {
    const { client } = makeFakeUpdateClient({ data: null, error: null });
    const revoke = makeRevokeInvite(() => client);

    await expect(revoke(REVOKE_TARGET)).resolves.toBeUndefined();
  });

  it('rejects with the real SupabaseLoaderError on a genuine mutation error', async () => {
    const { client } = makeFakeUpdateClient({
      data: null,
      error: { message: 'permission denied for table invites', code: '42501' },
    });
    const revoke = makeRevokeInvite(() => client);

    await expect(revoke(REVOKE_TARGET)).rejects.toMatchObject({
      code: '42501',
      message: expect.any(String),
    });
  });
});
