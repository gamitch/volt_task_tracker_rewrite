// @vitest-environment jsdom
/**
 * T046: tests for `SubscribePopover.tsx`.
 *
 * Per this task's Allowed Files ("A colocated `SubscribePopover.test.tsx` is
 * acceptable per established precedent") this is a deliberate, disclosed
 * addition, the same class of addition `EndMeetingDialog.test.tsx`/T036,
 * `SeasonSettings.test.tsx`/T029, and `InvitesTab.test.tsx`/T027 already made
 * in this same project -- existing to produce the packet's own "Required
 * Worker Output" proof requirements:
 *
 *   1. Real proof of the reset flow (module doc section 1): the old row is
 *      never mutated in place -- `onResetFeedToken` is called exactly once,
 *      with the single atomic `ResetFeedTokenPayload` naming the currently-
 *      active row's id, only after the real `AlertDialog`'s own action
 *      button is clicked (never before), and the resolved NEW row (new id,
 *      new token, `revokedAt: null`) fully replaces the displayed URL --
 *      proving "exactly one active row" locally the same way
 *      `applyEndMeetingResult` proved its own local-state mirror.
 *   2. Real proof of the copy-link flow: `navigator.clipboard.writeText` is
 *      called with the real constructed ICS URL, `pushToast('Link copied')`
 *      fires (captured via `subscribeToast`), and the clipboard-unavailable
 *      case degrades to a visible, non-throwing Banner instead of an
 *      unhandled rejection.
 *   3. Real proof of the `AlertDialog` confirmation copy (BEH-09): the
 *      dialog's title/description state what happens next, not a bare "Are
 *      you sure?".
 *   4. Pure-function proof for `buildIcsUrl`/`buildResetFeedTokenPayload`.
 *
 * jsdom gap note (same class of gap `OutreachEventDialog.test.tsx`/T039
 * already disclosed for `Selector`'s identical `useLayer`-based popover):
 * this repo's installed jsdom (29.1.1, confirmed via `package.json`) does
 * not implement `HTMLElement.prototype.showPopover`/`hidePopover`.
 * `Popover`'s own `usePopover`/`useLayer` implementation (`node_modules/
 * @astryxdesign/core/src/Layer/useLayer.tsx`, `show()`/`hide()`, read
 * directly) already gracefully degrades in that case: it falls back to
 * `popover.style.display = 'block'/'none'` instead of throwing, and the
 * popover content itself is ALWAYS mounted in the React tree regardless of
 * open/closed state (`Popover.tsx`'s `popover.render(...)` call is never
 * conditionally gated on `isOpen`) -- so no jsdom Popover-API polyfill is
 * needed here, and clicking the "Subscribe" trigger first (mirroring real
 * user interaction, even though the content is technically already
 * queryable beforehand in this jsdom environment) is enough to exercise the
 * real Copy link / Reset link buttons inside it.
 *
 * `AlertDialog` still renders a native `<dialog>` via `showModal()`, which
 * this repo's jsdom does not implement either -- the same guarded,
 * test-file-local polyfill `EndMeetingDialog.test.tsx`/`SeasonSettings.
 * test.tsx`/`ScheduleMeetingsDialog.test.tsx` already established is reused
 * verbatim below.
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- these tests use the same raw `createRoot`/`act` pattern
 * every prior content-page test file in this project already established.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { subscribeToast } from '../../app/guards';
import {
  buildIcsUrl,
  buildResetFeedTokenPayload,
  FEED_CONTENTS_DESCRIPTION,
  GOOGLE_CALENDAR_HELPER_TEXT,
  RESET_CONFIRM_DESCRIPTION,
  SubscribePopover,
  type CalendarFeedRow,
  type ResetFeedTokenPayload,
} from './SubscribePopover';

// ---------------------------------------------------------------------------
// jsdom gap: `AlertDialog` renders a native `<dialog>` and calls
// `HTMLDialogElement.prototype.showModal()`, which this repo's installed
// jsdom does not implement. Same guarded, test-file-local polyfill
// `EndMeetingDialog.test.tsx`/T036 already established, reused verbatim.
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
// Render harness.
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
  vi.restoreAllMocks();
});

function renderPopover(props: Parameters<typeof SubscribePopover>[0]): void {
  act(() => {
    root.render(<SubscribePopover {...props} />);
  });
}

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function findButtonByText(text: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === text,
  );
}

function clickButton(button: HTMLButtonElement): void {
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function clickButtonWithText(text: string): void {
  const button = findButtonByText(text);
  expect(button, `expected a <button> with text "${text}"`).toBeTruthy();
  clickButton(button as HTMLButtonElement);
}

// ---------------------------------------------------------------------------
// Fixture builders -- distinct, obviously-fabricated data from the shipped
// default fixture (constitution item 6), so tests exercise real injected
// data rather than only the shipped default.
// ---------------------------------------------------------------------------

const TEST_PROFILE_ID = 'profile-test-coach-quinn';

const TEST_FEED: CalendarFeedRow = {
  id: 'feed-test-001',
  profileId: TEST_PROFILE_ID,
  token: '12345678-1234-4234-8234-123456789abc',
  revokedAt: null,
  createdAt: '2026-06-01T12:00:00.000Z',
};

const TEST_FUNCTIONS_BASE_URL = 'https://test-project-ref.functions.supabase.co';

// ---------------------------------------------------------------------------
// Pure-function tests -- module doc sections 1/2.
// ---------------------------------------------------------------------------

describe('buildIcsUrl (module doc section 2 -- CAL-04 literal URL shape)', () => {
  it('builds the real Supabase Edge Function invocation shape', () => {
    expect(buildIcsUrl(TEST_FUNCTIONS_BASE_URL, TEST_FEED.token)).toBe(
      'https://test-project-ref.functions.supabase.co/ics?token=12345678-1234-4234-8234-123456789abc',
    );
  });

  it('strips a trailing slash on the base URL before joining', () => {
    expect(buildIcsUrl(`${TEST_FUNCTIONS_BASE_URL}/`, TEST_FEED.token)).toBe(
      'https://test-project-ref.functions.supabase.co/ics?token=12345678-1234-4234-8234-123456789abc',
    );
  });
});

describe('buildResetFeedTokenPayload (module doc section 1 -- the atomicity contract)', () => {
  it('names both the profile and the currently-active row id in ONE payload', () => {
    const payload: ResetFeedTokenPayload = buildResetFeedTokenPayload(TEST_PROFILE_ID, TEST_FEED);
    expect(payload).toEqual({
      profileId: TEST_PROFILE_ID,
      revokeFeedId: 'feed-test-001',
    });
  });
});

// ---------------------------------------------------------------------------
// Render tests -- DES-12 states.
// ---------------------------------------------------------------------------

describe('<SubscribePopover /> DES-12 states', () => {
  it('shows a loading spinner before data resolves', () => {
    renderPopover({
      profileId: TEST_PROFILE_ID,
      loadCalendarFeed: () => new Promise(() => {}),
    });
    expect(document.body.textContent).toContain('Loading your calendar link');
  });

  it('shows an error banner when loadCalendarFeed rejects', async () => {
    renderPopover({
      profileId: TEST_PROFILE_ID,
      loadCalendarFeed: () => Promise.reject(new Error('network down')),
    });
    await flushMicrotasks();
    expect(document.body.textContent).toContain("Couldn't load your calendar link");
  });
});

// ---------------------------------------------------------------------------
// Render tests -- the popover itself (module docs sections 3/6).
// ---------------------------------------------------------------------------

describe('<SubscribePopover /> subscribe popover content', () => {
  it('shows the constructed ICS URL, the feed-contents description, and the literal Google Calendar helper text', async () => {
    renderPopover({
      profileId: TEST_PROFILE_ID,
      loadCalendarFeed: () => Promise.resolve(TEST_FEED),
      functionsBaseUrl: TEST_FUNCTIONS_BASE_URL,
    });
    await flushMicrotasks();

    clickButtonWithText('Subscribe');

    expect(document.body.textContent).toContain(
      'https://test-project-ref.functions.supabase.co/ics?token=12345678-1234-4234-8234-123456789abc',
    );
    expect(document.body.textContent).toContain(FEED_CONTENTS_DESCRIPTION);
    expect(document.body.textContent).toContain(GOOGLE_CALENDAR_HELPER_TEXT);
    expect(document.body.textContent).toContain('Add to Google Calendar: Settings');
  });
});

// ---------------------------------------------------------------------------
// Render tests -- Copy link (module doc section 4).
// ---------------------------------------------------------------------------

describe('<SubscribePopover /> Copy link', () => {
  it('writes the real ICS URL to the clipboard and pushes the "Link copied" toast', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    const toastMessages: string[] = [];
    const unsubscribe = subscribeToast((message) => toastMessages.push(message));

    renderPopover({
      profileId: TEST_PROFILE_ID,
      loadCalendarFeed: () => Promise.resolve(TEST_FEED),
      functionsBaseUrl: TEST_FUNCTIONS_BASE_URL,
    });
    await flushMicrotasks();
    clickButtonWithText('Subscribe');
    clickButtonWithText('Copy link');
    await flushMicrotasks();

    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith(
      'https://test-project-ref.functions.supabase.co/ics?token=12345678-1234-4234-8234-123456789abc',
    );
    expect(toastMessages).toEqual(['Link copied']);

    unsubscribe();
    // @ts-expect-error -- test-only cleanup of the property defined above.
    delete navigator.clipboard;
  });

  it('shows a Banner instead of throwing when the Clipboard API is unavailable', async () => {
    // This repo's jsdom has no Clipboard API by default -- confirms the real
    // gap this component's fallback handles, not a fabricated scenario.
    expect((navigator as { clipboard?: unknown }).clipboard).toBeUndefined();

    renderPopover({
      profileId: TEST_PROFILE_ID,
      loadCalendarFeed: () => Promise.resolve(TEST_FEED),
      functionsBaseUrl: TEST_FUNCTIONS_BASE_URL,
    });
    await flushMicrotasks();
    clickButtonWithText('Subscribe');
    clickButtonWithText('Copy link');
    await flushMicrotasks();

    expect(document.body.textContent).toContain("Couldn't copy link");
    expect(document.body.textContent).toContain('Clipboard access is not available');
  });
});

// ---------------------------------------------------------------------------
// Render tests -- the reset flow (module doc section 1 -- the central trap).
// ---------------------------------------------------------------------------

describe('<SubscribePopover /> Reset link confirm flow', () => {
  it('opens a real AlertDialog with BEH-09-compliant copy and does not call onResetFeedToken before confirm', async () => {
    const onResetFeedToken = vi.fn();
    renderPopover({
      profileId: TEST_PROFILE_ID,
      loadCalendarFeed: () => Promise.resolve(TEST_FEED),
      onResetFeedToken,
    });
    await flushMicrotasks();

    clickButtonWithText('Subscribe');
    clickButtonWithText('Reset link');

    expect(document.body.textContent).toContain('Reset your calendar link?');
    expect(document.body.textContent).toContain(RESET_CONFIRM_DESCRIPTION);
    expect(document.body.textContent).toContain('Your old calendar link will stop working');
    expect(document.body.textContent).toContain('Any calendar app using it will need the new link');
    expect(onResetFeedToken).not.toHaveBeenCalled();
  });

  it('confirming calls onResetFeedToken exactly once with the single atomic payload, then replaces the active row (old id/token never reused)', async () => {
    const newFeed: CalendarFeedRow = {
      id: 'feed-test-002-new',
      profileId: TEST_PROFILE_ID,
      token: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      revokedAt: null,
      createdAt: '2026-07-19T15:00:00.000Z',
    };
    const onResetFeedToken = vi.fn().mockResolvedValue(newFeed);

    renderPopover({
      profileId: TEST_PROFILE_ID,
      loadCalendarFeed: () => Promise.resolve(TEST_FEED),
      onResetFeedToken,
      functionsBaseUrl: TEST_FUNCTIONS_BASE_URL,
    });
    await flushMicrotasks();

    clickButtonWithText('Subscribe');
    clickButtonWithText('Reset link'); // opens the AlertDialog.

    const dialogEl = document.querySelector('dialog[open]') as HTMLElement;
    expect(dialogEl).toBeTruthy();
    const actionButton = Array.from(dialogEl.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Reset link',
    );
    expect(actionButton).toBeTruthy();
    clickButton(actionButton as HTMLButtonElement);
    await flushMicrotasks();

    expect(onResetFeedToken).toHaveBeenCalledTimes(1);
    expect(onResetFeedToken).toHaveBeenCalledWith({
      profileId: TEST_PROFILE_ID,
      revokeFeedId: 'feed-test-001', // the OLD row's id -- never the new one.
    });

    // The displayed URL now reflects the brand-new row's token, not the old one.
    expect(document.body.textContent).toContain(
      'https://test-project-ref.functions.supabase.co/ics?token=ffffffff-ffff-4fff-8fff-ffffffffffff',
    );
    expect(document.body.textContent).not.toContain('token=12345678-1234-4234-8234-123456789abc');

    // The confirm dialog is closed after a successful reset.
    expect(document.querySelector('dialog[open]')).toBeNull();
  });

  it('shows an error banner and leaves the active row unchanged when onResetFeedToken rejects', async () => {
    const onResetFeedToken = vi.fn().mockRejectedValue(new Error('write failed'));
    renderPopover({
      profileId: TEST_PROFILE_ID,
      loadCalendarFeed: () => Promise.resolve(TEST_FEED),
      onResetFeedToken,
      functionsBaseUrl: TEST_FUNCTIONS_BASE_URL,
    });
    await flushMicrotasks();

    clickButtonWithText('Subscribe');
    clickButtonWithText('Reset link');
    const dialogEl = document.querySelector('dialog[open]') as HTMLElement;
    const actionButton = Array.from(dialogEl.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Reset link',
    );
    clickButton(actionButton as HTMLButtonElement);
    await flushMicrotasks();

    expect(document.body.textContent).toContain("Couldn't reset your calendar link");
    expect(document.body.textContent).toContain('write failed');
    // The old token is still the one displayed -- the row was never replaced.
    expect(document.body.textContent).toContain('token=12345678-1234-4234-8234-123456789abc');
  });
});
