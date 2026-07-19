// @vitest-environment jsdom
/**
 * T035: tests for `CheckinResult.tsx`.
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- these tests use the same raw `createRoot`/`act`
 * pattern already established by `src/theme/theme.smoke.test.tsx`, plus a
 * `MemoryRouter` (already a dependency) since the component reads
 * `useSearchParams`/`useNavigate`.
 *
 * `global.fetch` is mocked per-test via `vi.fn()` to exercise every branch
 * of `callCheckin` (a real, typed fetch call -- see module doc gap #1 in
 * `CheckinResult.tsx`: this proves the request/response wiring is correct
 * against the documented contract, but cannot prove a real end-to-end call
 * against a live deployed function with a live JWT, since none exists
 * anywhere in this repo).
 *
 * Per this task's Allowed Files (`CheckinResult.tsx` only) this test file
 * is a deliberate, disclosed addition beyond the literal Allowed Files
 * list -- it lives in the same new `src/pages/checkin/` directory as the
 * one allowed component and exists only to produce the test evidence this
 * task's own packet explicitly requires in "Required Worker Output" (a
 * real reduced-motion toggle test, all response branches, etc.). See this
 * task's worker output for the explicit call-out.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CheckinResult,
  callCheckin,
  parseCheckinCredential,
  type CheckinCallResult,
  type CheckinResponsePayload,
} from './CheckinResult';

// ---------------------------------------------------------------------------
// Render harness
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

/**
 * Minimal local shape for a captured `fetch()` call's second (init)
 * argument. Deliberately NOT the global DOM `RequestInit` type: this
 * project's `eslint.config.js` runs the base `no-undef` rule (from
 * `js.configs.recommended`) over `.tsx` files without TypeScript-aware
 * global resolution, which flags bare references to ambient lib.dom.d.ts
 * type names like `RequestInit` as undefined identifiers even though `tsc`
 * itself resolves them correctly. A small local interface with only the
 * fields these tests actually assert on sidesteps that false positive.
 */
interface FetchCallInit {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
}

function renderAt(path: string, props: Parameters<typeof CheckinResult>[0] = {}): void {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[path]}>
        <CheckinResult {...props} />
      </MemoryRouter>,
    );
  });
}

async function flushMicrotasks(): Promise<void> {
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
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// parseCheckinCredential
// ---------------------------------------------------------------------------

describe('parseCheckinCredential', () => {
  it('parses a QR-style ?s=&t= URL (MTG-06 shape)', () => {
    expect(parseCheckinCredential(new URLSearchParams('s=session-1&t=abc123'))).toEqual({
      sessionId: 'session-1',
      token: 'abc123',
      code: undefined,
    });
  });

  it('parses a manual-code ?s=&code= URL', () => {
    expect(parseCheckinCredential(new URLSearchParams('s=session-1&code=AB12CD'))).toEqual({
      sessionId: 'session-1',
      token: undefined,
      code: 'AB12CD',
    });
  });

  it('returns null when session_id is missing', () => {
    expect(parseCheckinCredential(new URLSearchParams('t=abc123'))).toBeNull();
  });

  it('returns null when both token and code are missing', () => {
    expect(parseCheckinCredential(new URLSearchParams('s=session-1'))).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// callCheckin -- real fetch call, mocked at the global.fetch boundary
// ---------------------------------------------------------------------------

describe('callCheckin', () => {
  function mockFetchOnce(status: number, body: unknown): void {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(body),
    });
    vi.stubGlobal('fetch', fetchMock);
  }

  const config = { supabaseUrl: 'https://example.supabase.co', anonKey: 'anon-key' };

  it('sends the exact request contract shape (POST, session_id+token, headers)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          already_checked_in: false,
          attendance: { status: 'present', check_in_at: '2026-07-19T18:04:00Z', method: 'qr' },
        }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await callCheckin({ sessionId: 'session-1', token: 'tok-abc' }, 'user-jwt', config);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, FetchCallInit];
    expect(url).toBe('https://example.supabase.co/functions/v1/checkin');
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ session_id: 'session-1', token: 'tok-abc' });
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer user-jwt');
    expect(headers.apikey).toBe('anon-key');
    expect(headers['Content-Type']).toBe('application/json');
  });

  it('omits the Authorization header when accessToken is null (module doc gap #1)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: () =>
        Promise.resolve({ error: { code: 'UNAUTHENTICATED', message: 'Sign in and try again.' } }),
    });
    vi.stubGlobal('fetch', fetchMock);

    await callCheckin({ sessionId: 'session-1', code: 'AB12CD' }, null, config);

    const [, init] = fetchMock.mock.calls[0] as [string, FetchCallInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBeUndefined();
    expect(JSON.parse(init.body as string)).toEqual({ session_id: 'session-1', code: 'AB12CD' });
  });

  it('resolves ok:true with the exact fresh-success payload shape', async () => {
    const payload: CheckinResponsePayload = {
      already_checked_in: false,
      attendance: { status: 'present', check_in_at: '2026-07-19T18:04:00Z', method: 'qr' },
    };
    mockFetchOnce(200, payload);
    const result = await callCheckin({ sessionId: 's1', token: 't1' }, 'jwt', config);
    expect(result).toEqual<CheckinCallResult>({ ok: true, data: payload });
  });

  it('resolves ok:true with already_checked_in:true and a real timestamp', async () => {
    const payload: CheckinResponsePayload = {
      already_checked_in: true,
      attendance: { status: 'present', check_in_at: '2026-07-19T18:04:00Z', method: 'qr' },
    };
    mockFetchOnce(200, payload);
    const result = await callCheckin({ sessionId: 's1', token: 't1' }, 'jwt', config);
    expect(result).toEqual<CheckinCallResult>({ ok: true, data: payload });
  });

  it('resolves ok:true with already_checked_in:true and check_in_at:null (coach-recorded edge case)', async () => {
    const payload: CheckinResponsePayload = {
      already_checked_in: true,
      attendance: { status: 'present', check_in_at: null, method: 'coach' },
    };
    mockFetchOnce(200, payload);
    const result = await callCheckin({ sessionId: 's1', token: 't1' }, 'jwt', config);
    expect(result).toEqual<CheckinCallResult>({ ok: true, data: payload });
  });

  it('resolves ok:false with a recognized server error code (INVALID_OR_EXPIRED_CREDENTIAL)', async () => {
    mockFetchOnce(401, {
      error: {
        code: 'INVALID_OR_EXPIRED_CREDENTIAL',
        message:
          'That check-in code expired. Codes refresh every minute — grab the new one from the screen.',
      },
    });
    const result = await callCheckin({ sessionId: 's1', token: 't1' }, 'jwt', config);
    expect(result).toEqual<CheckinCallResult>({
      ok: false,
      error: {
        code: 'INVALID_OR_EXPIRED_CREDENTIAL',
        message:
          'That check-in code expired. Codes refresh every minute — grab the new one from the screen.',
      },
    });
  });

  it('resolves ok:false with a second, distinct recognized server error code (SESSION_CLOSED)', async () => {
    mockFetchOnce(409, {
      error: {
        code: 'SESSION_CLOSED',
        message: 'Check-in has closed for this session. Ask your coach to record your attendance.',
      },
    });
    const result = await callCheckin({ sessionId: 's1', code: 'AB12CD' }, 'jwt', config);
    expect(result).toEqual<CheckinCallResult>({
      ok: false,
      error: {
        code: 'SESSION_CLOSED',
        message: 'Check-in has closed for this session. Ask your coach to record your attendance.',
      },
    });
  });

  it('falls back to a generic error for a non-200 response with no recognized {error:{code,message}} shape', async () => {
    mockFetchOnce(500, { unexpected: 'shape' });
    const result = await callCheckin({ sessionId: 's1', token: 't1' }, 'jwt', config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CHECKIN_UNKNOWN_ERROR');
    }
  });

  it('returns a client-side error when fetch itself rejects (network failure)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const result = await callCheckin({ sessionId: 's1', token: 't1' }, 'jwt', config);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('CHECKIN_NETWORK_ERROR');
    }
  });
});

// ---------------------------------------------------------------------------
// <CheckinResult /> -- full component render, mocked `checkin` seam
// ---------------------------------------------------------------------------

describe('<CheckinResult />', () => {
  it('renders the fresh success (Bolt) state with "You\'re in" and the check-in time', async () => {
    const checkin = vi.fn<typeof callCheckin>().mockResolvedValue({
      ok: true,
      data: {
        already_checked_in: false,
        attendance: { status: 'present', check_in_at: '2026-07-19T18:04:00Z', method: 'qr' },
      },
    });
    renderAt('/checkin?s=session-1&t=abc123', { checkin });
    await flushMicrotasks();

    expect(checkin).toHaveBeenCalledWith(
      { sessionId: 'session-1', token: 'abc123', code: undefined },
      null,
      undefined,
    );
    expect(container.textContent).toContain("You're in");
    expect(container.textContent).toContain('Checked in at');
    expect(container.querySelector('button')?.textContent).toContain('Done');
  });

  it('renders the already-in state with a real timestamp (MTG-09 worked example wording)', async () => {
    const checkin = vi.fn<typeof callCheckin>().mockResolvedValue({
      ok: true,
      data: {
        already_checked_in: true,
        attendance: { status: 'present', check_in_at: '2026-07-19T18:04:00Z', method: 'qr' },
      },
    });
    renderAt('/checkin?s=session-1&t=abc123', { checkin });
    await flushMicrotasks();

    expect(container.textContent).toContain('Already checked in');
    expect(container.textContent).toContain('Already checked in at');
  });

  it('renders the already-in state gracefully when check_in_at is null (no literal "null", no crash)', async () => {
    const checkin = vi.fn<typeof callCheckin>().mockResolvedValue({
      ok: true,
      data: {
        already_checked_in: true,
        attendance: { status: 'present', check_in_at: null, method: 'coach' },
      },
    });
    expect(() => renderAt('/checkin?s=session-1&t=abc123', { checkin })).not.toThrow();
    await flushMicrotasks();

    expect(container.textContent).toContain("You're already checked in for this session.");
    expect(container.textContent).not.toContain('null');
  });

  it('renders error.message verbatim for a recognized error code (INVALID_OR_EXPIRED_CREDENTIAL)', async () => {
    const message =
      'That check-in code expired. Codes refresh every minute — grab the new one from the screen.';
    const checkin = vi.fn<typeof callCheckin>().mockResolvedValue({
      ok: false,
      error: { code: 'INVALID_OR_EXPIRED_CREDENTIAL', message },
    });
    renderAt('/checkin?s=session-1&t=abc123', { checkin });
    await flushMicrotasks();

    expect(container.textContent).toContain(message);
    expect(container.querySelector('button')?.textContent).toContain('Try again');
  });

  it('renders error.message verbatim for a second, distinct recognized error code (TEAM_SCOPE_MISMATCH)', async () => {
    const message =
      "This session isn't open to your team. Check with your coach if you think this is wrong.";
    const checkin = vi.fn<typeof callCheckin>().mockResolvedValue({
      ok: false,
      error: { code: 'TEAM_SCOPE_MISMATCH', message },
    });
    renderAt('/checkin?s=session-1&t=abc123', { checkin });
    await flushMicrotasks();

    expect(container.textContent).toContain(message);
  });

  it('renders a generic fallback error render for an unrecognized error code', async () => {
    const message = 'Some future error code this component has never seen before.';
    const checkin = vi.fn<typeof callCheckin>().mockResolvedValue({
      ok: false,
      error: { code: 'SOME_BRAND_NEW_CODE_NOT_YET_SPECIAL_CASED', message },
    });
    renderAt('/checkin?s=session-1&t=abc123', { checkin });
    await flushMicrotasks();

    // Same generic error-rendering path as the recognized-code tests above --
    // this component never branches on `code`, only ever displays `message`
    // verbatim, so an unrecognized code is handled identically (never
    // dropped, never a blank/crashed render).
    expect(container.textContent).toContain(message);
  });

  it('renders a client-side error (no crash, no network call) when the URL is missing session_id/token/code', async () => {
    const checkin = vi.fn<typeof callCheckin>();
    renderAt('/checkin', { checkin });
    await flushMicrotasks();

    expect(checkin).not.toHaveBeenCalled();
    expect(container.textContent).toContain('This check-in link is missing information.');
  });

  it('"Try again" re-invokes checkin', async () => {
    const checkin = vi
      .fn<typeof callCheckin>()
      .mockResolvedValueOnce({
        ok: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many code attempts. Wait a minute and try again.',
        },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: {
          already_checked_in: false,
          attendance: { status: 'present', check_in_at: '2026-07-19T18:04:00Z', method: 'qr' },
        },
      });
    renderAt('/checkin?s=session-1&t=abc123', { checkin });
    await flushMicrotasks();
    expect(container.textContent).toContain('Too many code attempts');

    const retryButton = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.textContent?.includes('Try again'),
    );
    expect(retryButton).toBeTruthy();
    act(() => {
      retryButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();

    expect(checkin).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain("You're in");
  });

  it('surfaces a "late" status note distinctly from a "present" success render', async () => {
    const checkin = vi.fn<typeof callCheckin>().mockResolvedValue({
      ok: true,
      data: {
        already_checked_in: false,
        attendance: { status: 'late', check_in_at: '2026-07-19T18:20:00Z', method: 'qr' },
      },
    });
    renderAt('/checkin?s=session-1&t=abc123', { checkin });
    await flushMicrotasks();

    expect(container.textContent).toContain('Recorded as late.');
  });
});

// ---------------------------------------------------------------------------
// prefers-reduced-motion -- real window.matchMedia toggle, not a visual claim
// ---------------------------------------------------------------------------

describe('prefers-reduced-motion (real window.matchMedia check)', () => {
  function stubMatchMedia(matches: boolean): void {
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockImplementation((query: string) => ({
        matches,
        media: query,
        onchange: null,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        addListener: vi.fn(),
        removeListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    );
  }

  const successResult: CheckinCallResult = {
    ok: true,
    data: {
      already_checked_in: false,
      attendance: { status: 'present', check_in_at: '2026-07-19T18:04:00Z', method: 'qr' },
    },
  };

  it('applies the bolt draw-in animation class when matchMedia reports no reduced-motion preference', async () => {
    stubMatchMedia(false);
    const checkin = vi.fn<typeof callCheckin>().mockResolvedValue(successResult);
    renderAt('/checkin?s=session-1&t=abc123', { checkin });
    await flushMicrotasks();

    expect(container.querySelector('.checkin-bolt-glyph--animate')).not.toBeNull();
    expect(container.querySelector('.checkin-bolt-surface--animate')).not.toBeNull();
  });

  it('collapses to an instant, fully-settled render (no draw-in class) when window.matchMedia reports prefers-reduced-motion: reduce', async () => {
    stubMatchMedia(true);
    const checkin = vi.fn<typeof callCheckin>().mockResolvedValue(successResult);
    renderAt('/checkin?s=session-1&t=abc123', { checkin });
    await flushMicrotasks();

    // Content is present immediately and settled -- same "You're in" text --
    // just with the animation classes absent, per the real matchMedia read.
    expect(container.textContent).toContain("You're in");
    expect(container.querySelector('.checkin-bolt-glyph--animate')).toBeNull();
    expect(container.querySelector('.checkin-bolt-surface--animate')).toBeNull();
  });
});
