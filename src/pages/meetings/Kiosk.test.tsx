// @vitest-environment jsdom
/**
 * T103: tests for `Kiosk.tsx` (previously untested -- this task's own
 * Allowed Files list names `Kiosk.test.tsx`, the same "a colocated test
 * file is acceptable per established precedent" posture every prior ED-1
 * packet in this directory has already used, e.g. `LiveConsole.test.tsx`/
 * `StudentMeetingView.test.tsx`).
 *
 * Two halves, mirroring the exact split `MeetingsList.test.tsx`/
 * `StudentMeetingView.test.tsx` already established for their own paired
 * `loaders/*.ts` files (which have no dedicated test file of their own,
 * per this task's own Allowed Files list -- only `loaders/kiosk.ts` is
 * named, not a second `loaders/kiosk.test.ts`):
 *
 *   1. `KioskPage` component tests -- DES-12 four states via the explicit
 *      fixture-loader seam-injection pattern every prior ED-1 packet has
 *      used (`fixtureLoadKioskDisplayToken`/`notWiredLoadKioskTally`/
 *      `notWiredLoadKioskSessionTitle`, all three still exported,
 *      unchanged, per `Kiosk.tsx`'s own updated module doc), the ~45s
 *      polling cadence (fake timers), and that the two stale "fixture
 *      data"/"not wired" disclosure `Banner`s are gone now that both gaps
 *      are closed.
 *   2. `loaders/kiosk.ts` seam-level tests -- stubbed `SupabaseClient`
 *      (`makeLoadKioskTally`/`makeLoadKioskSessionTitle`) and a stubbed
 *      `functions.invoke` transport (`makeLoadKioskDisplayToken`), the same
 *      DI pattern every prior `loaders/*.ts` seam-level test in this repo
 *      already established (`MeetingsList.test.tsx`'s T096 tests,
 *      `InvitesTab.test.tsx`'s T090 `makeResendInvite` tests) -- zero real
 *      network calls.
 *
 * No `@testing-library/react` is installed in this repo -- these tests use
 * the same raw `createRoot`/`act` pattern every other page test in this
 * directory already established.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { FunctionsHttpError, type SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fixtureLoadKioskDisplayToken,
  KioskPage,
  KIOSK_REFRESH_INTERVAL_MS,
  notWiredLoadKioskSessionTitle,
  notWiredLoadKioskTally,
  type KioskDisplayTokenLoader,
  type KioskSessionTitleLoader,
  type KioskTallyLoader,
} from './Kiosk';
import {
  makeLoadKioskDisplayToken,
  makeLoadKioskSessionTitle,
  makeLoadKioskTally,
} from '../../lib/supabase/loaders/kiosk';

// ---------------------------------------------------------------------------
// Render harness -- mirrors `LiveConsole.test.tsx`'s `MemoryRouter`/`Routes`/
// `Route` wrapper (needed here too: `KioskPage` reads `useParams()`, which
// only resolves against an actually-matched route). No `AuthProvider`/
// `RequireRole` wrapper needed -- `Kiosk.tsx`'s own module doc documents
// that this component is intentionally unguarded at the component level
// (the route-level guard lives in `router.tsx`, out of this task's scope).
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

const TEST_SESSION_ID = 'session-fixture-1';
const TEST_PATH = `/kiosk/${TEST_SESSION_ID}`;

function renderKiosk(
  props: {
    loadDisplayToken?: KioskDisplayTokenLoader;
    loadTally?: KioskTallyLoader;
    loadSessionTitle?: KioskSessionTitleLoader;
  } = {},
): void {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[TEST_PATH]}>
        <Routes>
          <Route path="/kiosk/:sessionId" element={<KioskPage {...props} />} />
        </Routes>
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
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// 1. `KioskPage` component tests.
// ---------------------------------------------------------------------------

describe('KioskPage (T103 real wiring, DES-12 states)', () => {
  it('renders "No session selected" when the route param is missing', () => {
    // Rendered outside any matched `:sessionId` route -- `useParams()`
    // resolves `{}` (no param), the same real-world shape a mistyped/bare
    // `/kiosk` URL would produce.
    act(() => {
      root.render(
        <MemoryRouter initialEntries={['/kiosk']}>
          <KioskPage />
        </MemoryRouter>,
      );
    });
    expect(container.textContent).toContain('No session selected');
  });

  it('renders the real QR/short-code/tally/title once all three seams resolve (Populated state)', async () => {
    const loadDisplayToken: KioskDisplayTokenLoader = vi.fn().mockResolvedValue({
      qrUrl: 'https://portal.voltfrc.org/checkin?s=x&t=abc',
      shortCode: 'AB23CD',
      refreshesInSeconds: 45,
    });
    const loadTally: KioskTallyLoader = vi.fn().mockResolvedValue({ checkedIn: 12, expected: 18 });
    const loadSessionTitle: KioskSessionTitleLoader = vi
      .fn()
      .mockResolvedValue({ title: 'Tuesday Build Meeting' });

    renderKiosk({ loadDisplayToken, loadTally, loadSessionTitle });
    await flushMicrotasks();

    expect(container.textContent).toContain('Tuesday Build Meeting');
    expect(container.textContent).toContain('AB23CD');
    expect(container.textContent).toContain('12 of 18 checked in');
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('renders the DES-12 Empty state for each seam independently when a loader resolves null', async () => {
    renderKiosk({
      loadDisplayToken: notWiredLoadKioskDisplayTokenStub,
      loadTally: notWiredLoadKioskTally,
      loadSessionTitle: notWiredLoadKioskSessionTitle,
    });
    await flushMicrotasks();

    expect(container.textContent).toContain('QR not available yet.');
    expect(container.textContent).toContain('Live count not available yet');
    // Falls back to the generic page-purpose label, not a fabricated title.
    expect(container.textContent).toContain('Meeting Check-In');
    expect(container.textContent).toContain('------');
  });

  it('folds a rejected loader into the same Empty-state rendering (DES-12 Error bucket)', async () => {
    const rejectingLoader: KioskTallyLoader = vi.fn().mockRejectedValue(new Error('network down'));
    renderKiosk({ loadTally: rejectingLoader, loadDisplayToken: fixtureLoadKioskDisplayToken });
    await flushMicrotasks();

    expect(container.textContent).toContain('Live count not available yet');
  });

  it('never renders the two stale "fixture data"/"not wired" disclosure banners (T103 removed them)', async () => {
    renderKiosk({ loadDisplayToken: fixtureLoadKioskDisplayToken });
    await flushMicrotasks();

    expect(container.textContent).not.toContain('fixture data');
    expect(container.textContent).not.toContain('not wired');
  });

  it('re-polls all three seams on the existing ~45s cadence, unchanged by this task', async () => {
    vi.useFakeTimers();
    const loadDisplayToken: KioskDisplayTokenLoader = vi.fn().mockResolvedValue({
      qrUrl: 'https://portal.voltfrc.org/checkin?s=x&t=abc',
      shortCode: 'AB23CD',
      refreshesInSeconds: 45,
    });
    const loadTally: KioskTallyLoader = vi.fn().mockResolvedValue({ checkedIn: 1, expected: 2 });
    const loadSessionTitle: KioskSessionTitleLoader = vi.fn().mockResolvedValue({ title: 'T' });

    renderKiosk({ loadDisplayToken, loadTally, loadSessionTitle });
    await act(async () => {
      await Promise.resolve();
    });

    expect(loadDisplayToken).toHaveBeenCalledTimes(1);
    expect(loadTally).toHaveBeenCalledTimes(1);
    expect(loadSessionTitle).toHaveBeenCalledTimes(1);

    await act(async () => {
      vi.advanceTimersByTime(KIOSK_REFRESH_INTERVAL_MS);
      await Promise.resolve();
    });

    expect(loadDisplayToken).toHaveBeenCalledTimes(2);
    expect(loadTally).toHaveBeenCalledTimes(2);
    expect(loadSessionTitle).toHaveBeenCalledTimes(2);
  });
});

/** Local stub -- identical shape to `notWiredLoadKioskTally`, for the
 * display-token seam's own Empty-state test above (the exported
 * `fixtureLoadKioskDisplayToken` always resolves non-null by design, so a
 * dedicated null-resolving stub is needed to exercise this branch). */
async function notWiredLoadKioskDisplayTokenStub(): ReturnType<KioskDisplayTokenLoader> {
  return null;
}

// ---------------------------------------------------------------------------
// 2. `loaders/kiosk.ts` seam-level tests (T103 real load).
// ---------------------------------------------------------------------------

describe('loadKioskTally (T103 real load)', () => {
  it('queries event_sessions/events/students/attendance and computes checkedIn/expected', async () => {
    const sessionMaybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: 'session-1', event_id: 'event-1' }, error: null });
    const eventMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'event-1', title: 'DB Meeting', team_ids: ['team-a'] },
      error: null,
    });
    const studentsEqSpy = vi.fn().mockResolvedValue({
      data: [
        { id: 'student-1', team_id: 'team-a' },
        { id: 'student-2', team_id: 'team-b' }, // out of scope -- excluded
        { id: 'student-3', team_id: 'team-a' },
      ],
      error: null,
    });
    const attendanceEqSpy = vi.fn().mockResolvedValue({
      data: [
        { status: 'present' },
        { status: 'late' },
        { status: 'excused' }, // not "checked in" for this tally
      ],
      error: null,
    });

    const fromSpy = vi.fn((table: string) => {
      if (table === 'event_sessions') {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: sessionMaybeSingle })) })),
        };
      }
      if (table === 'events') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: eventMaybeSingle })) })) };
      }
      if (table === 'students') {
        return { select: vi.fn(() => ({ eq: studentsEqSpy })) };
      }
      if (table === 'attendance') {
        return { select: vi.fn(() => ({ eq: attendanceEqSpy })) };
      }
      throw new Error(`unexpected table: ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const load = makeLoadKioskTally(() => client);
    const result = await load('session-1');

    expect(studentsEqSpy).toHaveBeenCalledWith('is_active', true);
    expect(attendanceEqSpy).toHaveBeenCalledWith('session_id', 'session-1');
    // team-scoped: only the two team-a students count toward "expected".
    expect(result).toEqual({ checkedIn: 2, expected: 2 });
  });

  it('treats a null team_ids as open to every team', async () => {
    const sessionMaybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: 'session-1', event_id: 'event-1' }, error: null });
    const eventMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'event-1', title: 'Open Meeting', team_ids: null },
      error: null,
    });
    const studentsEqSpy = vi.fn().mockResolvedValue({
      data: [
        { id: 'student-1', team_id: 'team-a' },
        { id: 'student-2', team_id: 'team-b' },
      ],
      error: null,
    });
    const attendanceEqSpy = vi.fn().mockResolvedValue({ data: [], error: null });

    const fromSpy = vi.fn((table: string) => {
      if (table === 'event_sessions') {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: sessionMaybeSingle })) })),
        };
      }
      if (table === 'events') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: eventMaybeSingle })) })) };
      }
      if (table === 'students') {
        return { select: vi.fn(() => ({ eq: studentsEqSpy })) };
      }
      if (table === 'attendance') {
        return { select: vi.fn(() => ({ eq: attendanceEqSpy })) };
      }
      throw new Error(`unexpected table: ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const load = makeLoadKioskTally(() => client);
    const result = await load('session-1');
    expect(result).toEqual({ checkedIn: 0, expected: 2 });
  });

  it('resolves null when the session cannot be found', async () => {
    const sessionMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const fromSpy = vi.fn((table: string) => {
      if (table === 'event_sessions') {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: sessionMaybeSingle })) })),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const load = makeLoadKioskTally(() => client);
    const result = await load('nonexistent-session');
    expect(result).toBeNull();
  });
});

describe('loadKioskSessionTitle (T103 real load)', () => {
  it("resolves the parent event's title", async () => {
    const sessionMaybeSingle = vi
      .fn()
      .mockResolvedValue({ data: { id: 'session-1', event_id: 'event-1' }, error: null });
    const eventMaybeSingle = vi.fn().mockResolvedValue({
      data: { id: 'event-1', title: 'Thursday Scrimmage Prep', team_ids: null },
      error: null,
    });
    const fromSpy = vi.fn((table: string) => {
      if (table === 'event_sessions') {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: sessionMaybeSingle })) })),
        };
      }
      if (table === 'events') {
        return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: eventMaybeSingle })) })) };
      }
      throw new Error(`unexpected table: ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const load = makeLoadKioskSessionTitle(() => client);
    const result = await load('session-1');
    expect(result).toEqual({ title: 'Thursday Scrimmage Prep' });
  });
});

// ---------------------------------------------------------------------------
// `loadKioskDisplayToken` -- calls the new `checkin-token` Edge Function via
// `invokeEdgeFunction`. Same stubbed-`functions.invoke` DI pattern
// `InvitesTab.test.tsx`'s own T090 `makeResendInvite` tests already
// established.
// ---------------------------------------------------------------------------

const ACTIVE_SESSION = { access_token: 'fake-token' };

function makeFakeFunctionsClient(overrides: {
  invoke?: (name: string, options: { body: unknown }) => Promise<{ data: unknown; error: unknown }>;
}): { client: SupabaseClient; invokeSpy: ReturnType<typeof vi.fn> } {
  const invokeSpy =
    (overrides.invoke as ReturnType<typeof vi.fn> | undefined) ??
    vi.fn().mockResolvedValue({ data: null, error: null });
  const client = {
    auth: {
      getSession: () => Promise.resolve({ data: { session: ACTIVE_SESSION }, error: null }),
    },
    functions: { invoke: invokeSpy },
  } as unknown as SupabaseClient;
  return { client, invokeSpy };
}

describe('loadKioskDisplayToken (T103 real load)', () => {
  it('calls checkin-token with { session_id }, unwraps the response, and builds the QR url via buildCheckinUrl', async () => {
    const invoke = vi.fn().mockResolvedValue({
      data: {
        token: 'a'.repeat(32),
        shortCode: 'AB23CD',
        bucketExpiresAt: '2026-07-20T00:01:00.000Z',
      },
      error: null,
    });
    const { client } = makeFakeFunctionsClient({ invoke });
    const load = makeLoadKioskDisplayToken(() => client);

    const result = await load('session-99');

    expect(invoke).toHaveBeenCalledWith('checkin-token', { body: { session_id: 'session-99' } });
    expect(result).toEqual({
      qrUrl: `https://portal.voltfrc.org/checkin?s=session-99&t=${'a'.repeat(32)}`,
      shortCode: 'AB23CD',
      refreshesInSeconds: 45,
    });
  });

  it('rejects with the real SupabaseLoaderError on FORBIDDEN (non-coach/admin caller)', async () => {
    const httpError = new FunctionsHttpError({
      json: () =>
        Promise.resolve({
          error: {
            code: 'FORBIDDEN',
            message: 'Only coaches and admins can view live check-in codes.',
          },
        }),
    });
    const invoke = vi.fn().mockResolvedValue({ data: null, error: httpError });
    const { client } = makeFakeFunctionsClient({ invoke });
    const load = makeLoadKioskDisplayToken(() => client);

    await expect(load('session-99')).rejects.toMatchObject({
      code: 'FORBIDDEN',
      message: expect.any(String),
    });
  });

  it('rejects with the real SupabaseLoaderError on SESSION_NOT_FOUND', async () => {
    const httpError = new FunctionsHttpError({
      json: () =>
        Promise.resolve({
          error: {
            code: 'SESSION_NOT_FOUND',
            message: "That session couldn't be found. Refresh and try again.",
          },
        }),
    });
    const invoke = vi.fn().mockResolvedValue({ data: null, error: httpError });
    const { client } = makeFakeFunctionsClient({ invoke });
    const load = makeLoadKioskDisplayToken(() => client);

    await expect(load('session-99')).rejects.toMatchObject({ code: 'SESSION_NOT_FOUND' });
  });
});
