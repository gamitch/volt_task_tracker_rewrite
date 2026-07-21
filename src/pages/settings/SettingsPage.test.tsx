// @vitest-environment jsdom
/**
 * T060: tests for `SettingsPage.tsx`.
 *
 * Per this task's Allowed Files ("A colocated `SettingsPage.test.tsx` is
 * acceptable per established precedent") this is a deliberate, disclosed
 * addition, the same class of addition `SeasonSettings.test.tsx`/T029,
 * `SubscribePopover.test.tsx`/T046, and `AdminToggles.test.tsx`/T028 already
 * made in this same project -- existing to produce the packet's own
 * "Required Worker Output" proof requirements:
 *
 *   1. Real proof of SET-01's exact section order (module doc #1).
 *   2. Real proof of the per-role Notifications `Switch` set (module doc #4):
 *      `student` sees 4 categories (no weekly digest), `parent` sees 5
 *      (including BOTH `weeklyDigest`/`digestEnabled` as distinct controls,
 *      never collapsed), `coach`/`admin` see the disclosure `Banner` instead
 *      of fabricated switches. `invite` is never rendered for any role.
 *   3. Real proof of theme-mode persistence (module doc #6): picking a
 *      `RadioListItem` calls the injected `onChangeTheme` with the real
 *      payload; `isValidThemeMode` rejects non-literal strings.
 *   4. Real proof `SubscribePopover` is genuinely rendered (module doc #10),
 *      not reimplemented -- its own real "Subscribe" trigger button text is
 *      present, sourced from the imported component, not a copy.
 *   5. Real proof of the Sign-out-everywhere `AlertDialog` flow (module doc
 *      #3): opening the dialog does NOT call anything; confirming calls the
 *      injected `onSignOutEverywhere` FIRST, and only after it resolves does
 *      `guards.tsx`'s `logout()` also run -- proven by observing
 *      `useAuth().user` transition to `null` only after the injected seam's
 *      own promise resolves, and that a bare `logout()`-only stub would NOT
 *      have satisfied it (the injected seam is independently asserted called).
 *   6. Real proof of `id="notifications"` matching `MANAGE_PREFERENCES_PATH`.
 *   7. Pure-function proof for `getNotificationCategoriesForRole`,
 *      `isValidThemeMode`, `buildUpdateProfilePayload`.
 *   8. T105: real proof of `../../lib/supabase/loaders/settings.ts`'s
 *      `makeLoadSettingsData`/`makeUpdateProfile`/`makeChangeTheme`/
 *      `makeToggleNotificationPref`/`makeUploadAvatar`/
 *      `makeSignOutEverywhere` against a stubbed `SupabaseClient` -- same
 *      "loader-level tests live in the page's own test file" precedent
 *      `SeasonSettings.test.tsx`'s own T091 `makeLoadSeasons`/
 *      `makeCreateSeason`/`makeUpdateSeason` block already established (that
 *      module likewise has no dedicated test file of its own). The Storage
 *      upload path (`client.storage.from('avatars').upload(...)`) is stubbed
 *      the same way every prior loader test in this project stubs
 *      `SupabaseClient` table methods -- no real network/Storage call runs
 *      in `vitest`.
 *
 * jsdom gaps: `AlertDialog` renders a native `<dialog>` via `showModal()`
 * (not implemented by this repo's installed jsdom) -- the same guarded,
 * test-file-local polyfill `SubscribePopover.test.tsx`/T046 already
 * established, reused verbatim. `SubscribePopover`'s own `Popover` gracefully
 * degrades without a `showPopover`/`hidePopover` polyfill (its own module doc
 * section 3, re-confirmed here) -- no polyfill needed for it either.
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- these tests use the same raw `createRoot`/`act` pattern
 * every prior content-page test file in this project already established,
 * including `AdminToggles.test.tsx`/T028's `AuthProvider` harness (needed
 * here too, since `SettingsPage` reads `useAuth()` directly for `logout`).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import type { AuthSession, SupabaseClient } from '@supabase/supabase-js';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../../app/guards';
import { MANAGE_PREFERENCES_PATH } from '../../emails/layout/constants';
import {
  makeChangeTheme,
  makeLoadSettingsData,
  makeSignOutEverywhere,
  makeToggleNotificationPref,
  makeUpdateProfile,
  makeUploadAvatar,
} from '../../lib/supabase/loaders/settings';
import {
  buildUpdateProfilePayload,
  getNotificationCategoriesForRole,
  isValidThemeMode,
  SettingsPage,
  type ChangeThemePayload,
  type NotificationPrefsRow,
  type SettingsData,
  type SettingsProfile,
  type ToggleNotificationPrefPayload,
} from './SettingsPage';

// ---------------------------------------------------------------------------
// jsdom gap: `AlertDialog` renders a native `<dialog>` and calls
// `HTMLDialogElement.prototype.showModal()`, which this repo's installed
// jsdom does not implement. Same guarded, test-file-local polyfill
// `SubscribePopover.test.tsx`/T046 already established, reused verbatim.
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
// Fixtures
// ---------------------------------------------------------------------------

function makeProfile(overrides: Partial<SettingsProfile> = {}): SettingsProfile {
  return {
    id: 'profile-test',
    displayName: 'Casey Nguyen',
    email: 'casey.nguyen@example.com',
    role: 'parent',
    avatarUrl: 'https://volt-placeholder-project.example/avatars/casey.png',
    themeMode: 'system',
    ...overrides,
  };
}

function makeNotificationPrefs(
  overrides: Partial<NotificationPrefsRow> = {},
): NotificationPrefsRow {
  return {
    profileId: 'profile-test',
    invite: true,
    signupConfirm: true,
    eventReminder48h: true,
    eventReminder3h: true,
    meetingReminder3h: true,
    weeklyDigest: true,
    digestEnabled: true,
    ...overrides,
  };
}

function makeSettingsData(overrides: Partial<SettingsProfile> = {}): SettingsData {
  const profile = makeProfile(overrides);
  return {
    profile,
    notificationPrefs: makeNotificationPrefs({ profileId: profile.id }),
  };
}

// ---------------------------------------------------------------------------
// Render harness -- mirrors AdminToggles.test.tsx.
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

function renderSettingsPage(props: Parameters<typeof SettingsPage>[0] = {}): void {
  act(() => {
    root.render(
      <AuthProvider>
        <SettingsPage {...props} />
      </AuthProvider>,
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
 * Only the page's own section headings -- `AlertDialog`/`Dialog` titles are
 * always mounted in the DOM (module doc note re: Popover's identical
 * always-mounted behavior) even while closed, so headings inside a native
 * `<dialog>` element (AlertDialog's own root, confirmed via
 * `SubscribePopover.test.tsx`'s own jsdom-gap note) are excluded here.
 */
function headingTexts(): string[] {
  return Array.from(container.querySelectorAll('h1, h2'))
    .filter((el) => el.closest('dialog') === null)
    .map((el) => el.textContent ?? '');
}

function findButtonByText(text: string): HTMLButtonElement | undefined {
  return Array.from(container.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === text,
  );
}

function switchLabels(): string[] {
  return Array.from(container.querySelectorAll('input[type="checkbox"]')).map((input) => {
    const id = input.getAttribute('id');
    const label = id ? container.querySelector(`label[for="${id}"]`) : null;
    return label?.textContent?.trim() ?? '';
  });
}

// ---------------------------------------------------------------------------
// Pure functions
// ---------------------------------------------------------------------------

describe('isValidThemeMode (module doc #6)', () => {
  it('accepts exactly the three literal SET-03 values', () => {
    expect(isValidThemeMode('system')).toBe(true);
    expect(isValidThemeMode('light')).toBe(true);
    expect(isValidThemeMode('dark')).toBe(true);
  });

  it('rejects any other string -- profiles.theme_mode is a free-text column', () => {
    expect(isValidThemeMode('SYSTEM')).toBe(false);
    expect(isValidThemeMode('')).toBe(false);
    expect(isValidThemeMode('auto')).toBe(false);
  });
});

describe('buildUpdateProfilePayload', () => {
  it('returns a trimmed payload for a non-blank draft', () => {
    expect(buildUpdateProfilePayload('  Jamie Lee  ')).toEqual({ displayName: 'Jamie Lee' });
  });

  it('returns null for a blank draft', () => {
    expect(buildUpdateProfilePayload('   ')).toBeNull();
  });
});

describe('getNotificationCategoriesForRole (module doc #4, EML-02)', () => {
  it('student: signup-confirm, both event reminders, meeting reminder -- no weekly digest', () => {
    expect(getNotificationCategoriesForRole('student')).toEqual([
      'signupConfirm',
      'eventReminder48h',
      'eventReminder3h',
      'meetingReminder3h',
    ]);
  });

  it('parent: signup-confirm, both event reminders, weekly digest, digest master toggle -- no meeting reminder', () => {
    expect(getNotificationCategoriesForRole('parent')).toEqual([
      'signupConfirm',
      'eventReminder48h',
      'eventReminder3h',
      'weeklyDigest',
      'digestEnabled',
    ]);
  });

  it('coach: no EML-02 row names coach as a recipient', () => {
    expect(getNotificationCategoriesForRole('coach')).toEqual([]);
  });

  it('admin: no EML-02 row names admin as a recipient', () => {
    expect(getNotificationCategoriesForRole('admin')).toEqual([]);
  });

  it('never includes invite for any role (EML-04: not preference-gated)', () => {
    for (const role of ['student', 'parent', 'coach', 'admin'] as const) {
      expect(getNotificationCategoriesForRole(role)).not.toContain('invite');
    }
  });
});

// ---------------------------------------------------------------------------
// Section order -- module doc #1.
// ---------------------------------------------------------------------------

describe('<SettingsPage /> section order (SET-01, module doc #1)', () => {
  it('renders the five sections in SET-01s exact literal order', async () => {
    renderSettingsPage({ loadSettingsData: async () => makeSettingsData() });
    await flushMicrotasks();

    expect(headingTexts()).toEqual([
      'Settings',
      'Profile',
      'Appearance',
      'Notifications',
      'Calendar feed',
      'Danger zone',
    ]);
  });
});

// ---------------------------------------------------------------------------
// Per-role Notifications set -- module doc #4.
// ---------------------------------------------------------------------------

describe('<SettingsPage /> Notifications section (SET-02, module doc #4)', () => {
  it('shows 4 categories for a student, never invite', async () => {
    renderSettingsPage({
      loadSettingsData: async () => makeSettingsData({ role: 'student' }),
    });
    await flushMicrotasks();

    const labels = switchLabels();
    expect(labels).toContain('Signup confirmations');
    expect(labels).toContain('48-hour event reminders');
    expect(labels).toContain('3-hour event reminders');
    expect(labels).toContain('3-hour meeting reminders');
    expect(labels).not.toContain('Weekly digest');
    expect(labels).not.toContain('Enable digest emails');
    expect(labels).not.toContain('Invite emails');
    expect(labels.length).toBe(4);
  });

  it('shows 5 categories for a parent, including both weeklyDigest AND digestEnabled as distinct Switches', async () => {
    renderSettingsPage({
      loadSettingsData: async () => makeSettingsData({ role: 'parent' }),
    });
    await flushMicrotasks();

    const labels = switchLabels();
    expect(labels).toContain('Weekly digest');
    expect(labels).toContain('Enable digest emails');
    expect(labels).not.toContain('3-hour meeting reminders');
    expect(labels.length).toBe(5);
  });

  it('shows a disclosure Banner instead of switches for a coach', async () => {
    renderSettingsPage({
      loadSettingsData: async () => makeSettingsData({ role: 'coach' }),
    });
    await flushMicrotasks();

    expect(container.textContent).toContain('No notification categories apply to your role yet');
    expect(container.querySelectorAll('input[type="checkbox"]').length).toBe(0);
  });

  it('shows a disclosure Banner instead of switches for an admin', async () => {
    renderSettingsPage({
      loadSettingsData: async () => makeSettingsData({ role: 'admin' }),
    });
    await flushMicrotasks();

    expect(container.textContent).toContain('No notification categories apply to your role yet');
    expect(container.querySelectorAll('input[type="checkbox"]').length).toBe(0);
  });

  it('toggling a Switch calls onToggleNotificationPref with the real payload', async () => {
    const calls: ToggleNotificationPrefPayload[] = [];
    renderSettingsPage({
      loadSettingsData: async () => makeSettingsData({ role: 'student' }),
      onToggleNotificationPref: async (payload) => {
        calls.push(payload);
      },
    });
    await flushMicrotasks();

    const checkboxes = Array.from(container.querySelectorAll('input[type="checkbox"]'));
    const first = checkboxes[0] as HTMLInputElement;
    expect(first.checked).toBe(true);

    act(() => {
      first.click();
    });
    await flushMicrotasks();

    expect(first.checked).toBe(false);
    expect(calls).toEqual([{ profileId: 'profile-test', key: 'signupConfirm', value: false }]);
  });

  it('reverts the optimistic flip when the injected seam rejects', async () => {
    renderSettingsPage({
      loadSettingsData: async () => makeSettingsData({ role: 'student' }),
      onToggleNotificationPref: async () => {
        throw new Error('boom');
      },
    });
    await flushMicrotasks();

    const first = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
    expect(first.checked).toBe(true);

    act(() => {
      first.click();
    });
    await flushMicrotasks();

    expect(first.checked).toBe(true);
    expect(container.textContent).toContain("Couldn't save your notification preference");
  });

  it('renders id="notifications" matching MANAGE_PREFERENCES_PATH (EML-04, module doc #7)', async () => {
    renderSettingsPage({ loadSettingsData: async () => makeSettingsData() });
    await flushMicrotasks();

    expect(MANAGE_PREFERENCES_PATH).toBe('/settings#notifications');
    const section = container.querySelector('#notifications');
    expect(section, 'expected a real element with id="notifications"').toBeTruthy();
    expect(section?.textContent).toContain('Notifications');
  });
});

// ---------------------------------------------------------------------------
// Appearance / theme persistence -- module doc #6.
// ---------------------------------------------------------------------------

describe('<SettingsPage /> Appearance section (SET-03, module doc #6)', () => {
  it('calls onChangeTheme with the real payload when a RadioListItem is picked', async () => {
    const calls: ChangeThemePayload[] = [];
    renderSettingsPage({
      loadSettingsData: async () => makeSettingsData(),
      onChangeTheme: async (payload) => {
        calls.push(payload);
      },
    });
    await flushMicrotasks();

    const darkRadio = Array.from(container.querySelectorAll('input[type="radio"]')).find(
      (input) => (input as HTMLInputElement).value === 'dark',
    ) as HTMLInputElement;
    expect(darkRadio, 'expected a real radio input for value="dark"').toBeTruthy();

    act(() => {
      darkRadio.click();
    });
    await flushMicrotasks();

    expect(calls).toEqual([{ themeMode: 'dark' }]);
    expect(darkRadio.checked).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Calendar feed -- SubscribePopover genuinely rendered -- module doc #10.
// ---------------------------------------------------------------------------

describe('<SettingsPage /> Calendar feed section (module doc #10)', () => {
  it('renders the real, imported SubscribePopover (its own "Subscribe" trigger)', async () => {
    renderSettingsPage({ loadSettingsData: async () => makeSettingsData() });
    await flushMicrotasks();

    const subscribeButton = findButtonByText('Subscribe');
    expect(subscribeButton, 'expected SubscribePopovers own real "Subscribe" trigger').toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Danger zone -- Sign out everywhere vs. logout() -- module doc #3.
// ---------------------------------------------------------------------------

describe('<SettingsPage /> Danger zone: Sign out everywhere (module doc #3)', () => {
  it('opens a real AlertDialog and does NOT call anything before confirming', async () => {
    let calledOnSignOutEverywhere = false;
    renderSettingsPage({
      loadSettingsData: async () => makeSettingsData(),
      onSignOutEverywhere: async () => {
        calledOnSignOutEverywhere = true;
      },
    });
    await flushMicrotasks();

    const openButton = findButtonByText('Sign out everywhere');
    expect(openButton).toBeTruthy();
    act(() => {
      openButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();

    expect(calledOnSignOutEverywhere).toBe(false);
    expect(container.textContent).toContain('Sign out of every device?');
    expect(container.textContent).toContain('including this device');
  });

  it('confirming calls the injected onSignOutEverywhere seam AND clears local auth state via logout() -- distinct steps', async () => {
    const order: string[] = [];
    let authSnapshot: { user: unknown } | null = null;

    function AuthObserver(): null {
      const { user } = useAuth();
      authSnapshot = { user };
      return null;
    }

    act(() => {
      root.render(
        <AuthProvider>
          <AuthObserver />
          <SettingsPage
            loadSettingsData={async () => makeSettingsData()}
            onSignOutEverywhere={async () => {
              order.push('onSignOutEverywhere');
            }}
          />
        </AuthProvider>,
      );
    });
    await flushMicrotasks();

    const openButton = findButtonByText('Sign out everywhere');
    act(() => {
      openButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();

    const confirmButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Sign out everywhere' && btn !== openButton,
    );
    expect(confirmButton, 'expected the AlertDialogs own confirm button').toBeTruthy();

    act(() => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();

    // The real, distinct seam was awaited -- not skipped.
    expect(order).toEqual(['onSignOutEverywhere']);
    // logout() ran too (module doc #3's disclosed second step), proven by
    // observing the real AuthProvider's own user state clear -- but only
    // reachable because the injected seam above resolved successfully first.
    expect(authSnapshot).not.toBeNull();
    expect((authSnapshot as { user: unknown } | null)?.user).toBeNull();
  });

  it('shows a real error Banner and does NOT call logout() when onSignOutEverywhere rejects', async () => {
    renderSettingsPage({
      loadSettingsData: async () => makeSettingsData(),
      onSignOutEverywhere: async () => {
        throw new Error('network down');
      },
    });
    await flushMicrotasks();

    const openButton = findButtonByText('Sign out everywhere');
    act(() => {
      openButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();

    const confirmButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Sign out everywhere' && btn !== openButton,
    );
    act(() => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();

    expect(container.textContent).toContain("Couldn't sign out of every device");
    expect(container.textContent).toContain('network down');
  });
});

// ---------------------------------------------------------------------------
// Profile / avatar -- basic real-wiring proof.
// ---------------------------------------------------------------------------

describe('<SettingsPage /> Profile section', () => {
  it('Save changes is disabled until the display name draft actually changes', async () => {
    renderSettingsPage({ loadSettingsData: async () => makeSettingsData() });
    await flushMicrotasks();

    const saveButton = findButtonByText('Save changes');
    expect(saveButton?.disabled).toBe(true);
  });

  it('calls onUpdateProfile with the trimmed payload once the draft changes and Save is clicked', async () => {
    const calls: { displayName: string }[] = [];
    renderSettingsPage({
      loadSettingsData: async () => makeSettingsData(),
      onUpdateProfile: async (payload) => {
        calls.push(payload);
      },
    });
    await flushMicrotasks();

    const nameInput = Array.from(container.querySelectorAll('input[type="text"]')).find(
      (input) => (input as HTMLInputElement).value === 'Casey Nguyen',
    ) as HTMLInputElement;
    expect(nameInput).toBeTruthy();

    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
    act(() => {
      setter?.call(nameInput, 'Casey N.');
      nameInput.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await flushMicrotasks();

    const saveButton = findButtonByText('Save changes');
    expect(saveButton?.disabled).toBe(false);

    act(() => {
      saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();

    expect(calls).toEqual([{ displayName: 'Casey N.' }]);
  });
});

// ---------------------------------------------------------------------------
// T105 (ED-1 Packet P12): real data-layer wiring seams --
// `../../lib/supabase/loaders/settings.ts`'s `makeLoadSettingsData`/
// `makeUpdateProfile`/`makeChangeTheme`/`makeToggleNotificationPref`/
// `makeUploadAvatar`/`makeSignOutEverywhere`. Stubbed `SupabaseClient` only,
// same DI pattern as `SeasonSettings.test.tsx`'s own T091 loader-level block
// (module doc #8 above) -- no real network/Storage/Auth call runs here.
// ---------------------------------------------------------------------------

function buildFakeSession(userId: string): AuthSession {
  return {
    access_token: `fake-access-token-${userId}`,
    refresh_token: `fake-refresh-token-${userId}`,
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: userId,
      email: `${userId}@example.com`,
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: new Date(0).toISOString(),
    },
  } as AuthSession;
}

const TEST_USER_ID = 'profile-real-user-1';

/** Stubs `client.auth.getSession()` plus `client.from('profiles')
 * .select(...).eq('id', ...).maybeSingle()` and `client.from
 * ('notification_prefs').select(...).eq('profile_id', ...).maybeSingle()` --
 * exactly the two chains `makeLoadSettingsData` uses. */
function buildFakeLoadSettingsClient(options: {
  session?: AuthSession | null;
  profileRow?: Record<string, unknown> | null;
  profileError?: { message: string; code?: string } | null;
  prefsRow?: Record<string, unknown> | null;
  prefsError?: { message: string; code?: string } | null;
}): { client: SupabaseClient; fromSpy: ReturnType<typeof vi.fn> } {
  const {
    session = buildFakeSession(TEST_USER_ID),
    profileRow = null,
    profileError = null,
    prefsRow = null,
    prefsError = null,
  } = options;
  const getSession = vi.fn().mockResolvedValue({ data: { session }, error: null });

  const fromSpy = vi.fn((table: string) => {
    if (table === 'profiles') {
      const maybeSingle = vi.fn().mockResolvedValue({ data: profileRow, error: profileError });
      const eq = vi.fn().mockReturnValue({ maybeSingle });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
    }
    if (table === 'notification_prefs') {
      const maybeSingle = vi.fn().mockResolvedValue({ data: prefsRow, error: prefsError });
      const eq = vi.fn().mockReturnValue({ maybeSingle });
      const select = vi.fn().mockReturnValue({ eq });
      return { select };
    }
    throw new Error(`buildFakeLoadSettingsClient: unexpected table "${table}"`);
  });

  const client = { auth: { getSession }, from: fromSpy } as unknown as SupabaseClient;
  return { client, fromSpy };
}

describe('makeLoadSettingsData (T105 real load)', () => {
  it('maps snake_case profiles + notification_prefs DB rows to the camelCase SettingsData shape', async () => {
    const { client } = buildFakeLoadSettingsClient({
      profileRow: {
        id: TEST_USER_ID,
        display_name: 'Jordan Rivera',
        email: 'jordan.rivera@example.com',
        role: 'parent',
        avatar_url: 'https://example.test/storage/v1/object/public/avatars/x/1.png',
        theme_mode: 'dark',
      },
      prefsRow: {
        profile_id: TEST_USER_ID,
        invite: true,
        signup_confirm: true,
        event_reminder_48h: false,
        event_reminder_3h: true,
        meeting_reminder_3h: false,
        weekly_digest: true,
        digest_enabled: true,
      },
    });
    const load = makeLoadSettingsData(() => client);

    const result = await load();

    expect(result).toEqual({
      profile: {
        id: TEST_USER_ID,
        displayName: 'Jordan Rivera',
        email: 'jordan.rivera@example.com',
        role: 'parent',
        avatarUrl: 'https://example.test/storage/v1/object/public/avatars/x/1.png',
        themeMode: 'dark',
      },
      notificationPrefs: {
        profileId: TEST_USER_ID,
        invite: true,
        signupConfirm: true,
        eventReminder48h: false,
        eventReminder3h: true,
        meetingReminder3h: false,
        weeklyDigest: true,
        digestEnabled: true,
      },
    });
  });

  it('passes a null avatar_url through as null, never coerced to a placeholder string', async () => {
    const { client } = buildFakeLoadSettingsClient({
      profileRow: {
        id: TEST_USER_ID,
        display_name: 'Casey Nguyen',
        email: 'casey.nguyen@example.com',
        role: 'student',
        avatar_url: null,
        theme_mode: 'system',
      },
      prefsRow: {
        profile_id: TEST_USER_ID,
        invite: true,
        signup_confirm: true,
        event_reminder_48h: true,
        event_reminder_3h: true,
        meeting_reminder_3h: true,
        weekly_digest: true,
        digest_enabled: true,
      },
    });
    const load = makeLoadSettingsData(() => client);

    const result = await load();

    expect(result.profile.avatarUrl).toBeNull();
  });

  it('falls back to "system" for an invalid/legacy theme_mode value, never crashing or passing it through raw', async () => {
    const { client } = buildFakeLoadSettingsClient({
      profileRow: {
        id: TEST_USER_ID,
        display_name: 'Casey Nguyen',
        email: 'casey.nguyen@example.com',
        role: 'student',
        avatar_url: null,
        theme_mode: 'not-a-real-mode',
      },
      prefsRow: {
        profile_id: TEST_USER_ID,
        invite: true,
        signup_confirm: true,
        event_reminder_48h: true,
        event_reminder_3h: true,
        meeting_reminder_3h: true,
        weekly_digest: true,
        digest_enabled: true,
      },
    });
    const load = makeLoadSettingsData(() => client);

    const result = await load();

    expect(result.profile.themeMode).toBe('system');
  });

  it('rejects with a plain Error when there is no active session, never falling back to fixture data', async () => {
    const { client } = buildFakeLoadSettingsClient({ session: null });
    const load = makeLoadSettingsData(() => client);

    await expect(load()).rejects.toThrow('No active session was found');
  });

  it('rejects when the profiles row is missing (module doc #11 assumption violated)', async () => {
    const { client } = buildFakeLoadSettingsClient({
      profileRow: null,
      prefsRow: { profile_id: TEST_USER_ID },
    });
    const load = makeLoadSettingsData(() => client);

    await expect(load()).rejects.toThrow('No profile was found');
  });

  it('T109: resolves default notification prefs (all column defaults) when the notification_prefs row is missing, never rejecting -- this is every real user today, since nothing anywhere ever creates this row', async () => {
    const { client } = buildFakeLoadSettingsClient({
      profileRow: {
        id: TEST_USER_ID,
        display_name: 'Casey Nguyen',
        email: 'casey.nguyen@example.com',
        role: 'student',
        avatar_url: null,
        theme_mode: 'system',
      },
      prefsRow: null,
    });
    const load = makeLoadSettingsData(() => client);

    const result = await load();

    expect(result.notificationPrefs).toEqual({
      profileId: TEST_USER_ID,
      invite: true,
      signupConfirm: true,
      eventReminder48h: true,
      eventReminder3h: true,
      meetingReminder3h: true,
      weeklyDigest: true,
      digestEnabled: true,
    });
  });

  it('rejects with the real SupabaseLoaderError on a genuine profiles query error', async () => {
    const { client } = buildFakeLoadSettingsClient({
      profileError: { message: 'permission denied for table profiles', code: '42501' },
    });
    const load = makeLoadSettingsData(() => client);

    await expect(load()).rejects.toMatchObject({ code: '42501' });
  });
});

/** Stubs `client.auth.getSession()` plus `client.from('profiles')
 * .update({...}).eq('id', ...)` -- exactly the chain `makeUpdateProfile`/
 * `makeChangeTheme` use. */
function buildFakeProfileUpdateClient(options: {
  session?: AuthSession | null;
  error?: { message: string; code?: string } | null;
}): {
  client: SupabaseClient;
  fromSpy: ReturnType<typeof vi.fn>;
  updateSpy: ReturnType<typeof vi.fn>;
  eqSpy: ReturnType<typeof vi.fn>;
} {
  const { session = buildFakeSession(TEST_USER_ID), error = null } = options;
  const getSession = vi.fn().mockResolvedValue({ data: { session }, error: null });
  const eqSpy = vi.fn().mockResolvedValue({ data: null, error });
  const updateSpy = vi.fn(() => ({ eq: eqSpy }));
  const fromSpy = vi.fn(() => ({ update: updateSpy }));
  const client = { auth: { getSession }, from: fromSpy } as unknown as SupabaseClient;
  return { client, fromSpy, updateSpy, eqSpy };
}

describe('makeUpdateProfile (T105 real update)', () => {
  it("resolves the caller's own id from the session and updates only display_name for that row", async () => {
    const { client, fromSpy, updateSpy, eqSpy } = buildFakeProfileUpdateClient({});
    const update = makeUpdateProfile(() => client);

    await update({ displayName: 'Casey N.' });

    expect(fromSpy).toHaveBeenCalledWith('profiles');
    expect(updateSpy).toHaveBeenCalledWith({ display_name: 'Casey N.' });
    expect(eqSpy).toHaveBeenCalledWith('id', TEST_USER_ID);
  });

  it('rejects with a plain Error when there is no active session', async () => {
    const { client } = buildFakeProfileUpdateClient({ session: null });
    const update = makeUpdateProfile(() => client);

    await expect(update({ displayName: 'X' })).rejects.toThrow('No active session was found');
  });

  it('rejects with the real SupabaseLoaderError on a genuine update error', async () => {
    const { client } = buildFakeProfileUpdateClient({
      error: { message: 'permission denied', code: '42501' },
    });
    const update = makeUpdateProfile(() => client);

    await expect(update({ displayName: 'X' })).rejects.toMatchObject({ code: '42501' });
  });
});

describe('makeChangeTheme (T105 real update)', () => {
  it("resolves the caller's own id from the session and updates only theme_mode for that row", async () => {
    const { client, fromSpy, updateSpy, eqSpy } = buildFakeProfileUpdateClient({});
    const changeThemeFn = makeChangeTheme(() => client);

    await changeThemeFn({ themeMode: 'dark' } satisfies ChangeThemePayload);

    expect(fromSpy).toHaveBeenCalledWith('profiles');
    expect(updateSpy).toHaveBeenCalledWith({ theme_mode: 'dark' });
    expect(eqSpy).toHaveBeenCalledWith('id', TEST_USER_ID);
  });
});

/** T109: stubs exactly `client.from('notification_prefs').upsert({...}, {
 * onConflict: 'profile_id' })` -- `makeToggleNotificationPref` needs no
 * `client.auth` call at all (module doc #2 of
 * `../../lib/supabase/loaders/settings.ts`) -- this client deliberately has
 * NO `auth` key, so any accidental call to it would throw and fail the test,
 * proving the no-session-lookup claim. */
function buildFakeTogglePrefClient(options: {
  error?: { message: string; code?: string } | null;
}): {
  client: SupabaseClient;
  fromSpy: ReturnType<typeof vi.fn>;
  upsertSpy: ReturnType<typeof vi.fn>;
} {
  const { error = null } = options;
  const upsertSpy = vi.fn().mockResolvedValue({ data: null, error });
  const fromSpy = vi.fn(() => ({ upsert: upsertSpy }));
  const client = { from: fromSpy } as unknown as SupabaseClient;
  return { client, fromSpy, upsertSpy };
}

describe('makeToggleNotificationPref (T105 real update, T109 upsert fix)', () => {
  it('upserts (onConflict: profile_id) sending only profile_id + the real snake_case toggled column, trusting the caller-supplied profileId directly (no session lookup)', async () => {
    const cases: [ToggleNotificationPrefPayload, Record<string, unknown>][] = [
      [{ profileId: 'p1', key: 'signupConfirm', value: false }, { signup_confirm: false }],
      [{ profileId: 'p2', key: 'eventReminder48h', value: true }, { event_reminder_48h: true }],
      [{ profileId: 'p3', key: 'meetingReminder3h', value: false }, { meeting_reminder_3h: false }],
      [{ profileId: 'p4', key: 'weeklyDigest', value: false }, { weekly_digest: false }],
      [{ profileId: 'p5', key: 'digestEnabled', value: true }, { digest_enabled: true }],
    ];

    for (const [payload, expectedColumn] of cases) {
      const { client, fromSpy, upsertSpy } = buildFakeTogglePrefClient({});
      const toggle = makeToggleNotificationPref(() => client);

      await toggle(payload);

      expect(fromSpy).toHaveBeenCalledWith('notification_prefs');
      expect(upsertSpy).toHaveBeenCalledWith(
        { profile_id: payload.profileId, ...expectedColumn },
        { onConflict: 'profile_id' },
      );
    }
  });

  it('rejects with the real SupabaseLoaderError on a genuine upsert error', async () => {
    const { client } = buildFakeTogglePrefClient({
      error: { message: 'permission denied', code: '42501' },
    });
    const toggle = makeToggleNotificationPref(() => client);

    await expect(
      toggle({ profileId: TEST_USER_ID, key: 'signupConfirm', value: true }),
    ).rejects.toMatchObject({ code: '42501' });
  });

  it("T109: against a profile with no existing notification_prefs row, the upsert alone persists the toggled value -- no more silent zero-row UPDATE no-op on a user's first toggle", async () => {
    const { client, fromSpy, upsertSpy } = buildFakeTogglePrefClient({});
    const toggle = makeToggleNotificationPref(() => client);

    await toggle({ profileId: TEST_USER_ID, key: 'weeklyDigest', value: false });

    // Only profile_id + the toggled column are sent -- on INSERT (no
    // existing row), every other column falls back to its own real Postgres
    // `not null default true` (confirmed against
    // 20260717000001_support_audit.sql), so this single upsert call is
    // sufficient to persist a full defaults-plus-one-toggle row, matching
    // `loadSettingsData`'s own synthesized default row for the same case.
    expect(fromSpy).toHaveBeenCalledWith('notification_prefs');
    expect(upsertSpy).toHaveBeenCalledWith(
      { profile_id: TEST_USER_ID, weekly_digest: false },
      { onConflict: 'profile_id' },
    );
  });
});

/** Stubs `client.auth.getSession()`, `client.storage.from('avatars')
 * .upload(...)`/`.getPublicUrl(...)`, and `client.from('profiles')
 * .update({...}).eq('id', ...)` -- exactly the three calls `makeUploadAvatar`
 * makes. No real network/Storage call runs (Known Context/Traps #5). */
function buildFakeUploadAvatarClient(options: {
  session?: AuthSession | null;
  uploadError?: { message: string; name?: string } | null;
  publicUrl?: string;
  updateError?: { message: string; code?: string } | null;
}): {
  client: SupabaseClient;
  storageFromSpy: ReturnType<typeof vi.fn>;
  uploadSpy: ReturnType<typeof vi.fn>;
  getPublicUrlSpy: ReturnType<typeof vi.fn>;
  tableFromSpy: ReturnType<typeof vi.fn>;
  updateSpy: ReturnType<typeof vi.fn>;
  eqSpy: ReturnType<typeof vi.fn>;
} {
  const {
    session = buildFakeSession(TEST_USER_ID),
    uploadError = null,
    publicUrl = 'https://example.test/storage/v1/object/public/avatars/x/123.png',
    updateError = null,
  } = options;

  const getSession = vi.fn().mockResolvedValue({ data: { session }, error: null });

  const uploadSpy = vi
    .fn()
    .mockResolvedValue(
      uploadError
        ? { data: null, error: uploadError }
        : { data: { id: 'obj-1', path: 'x', fullPath: 'avatars/x' }, error: null },
    );
  const getPublicUrlSpy = vi.fn().mockReturnValue({ data: { publicUrl } });
  const storageFromSpy = vi.fn(() => ({ upload: uploadSpy, getPublicUrl: getPublicUrlSpy }));

  const eqSpy = vi.fn().mockResolvedValue({ data: null, error: updateError });
  const updateSpy = vi.fn(() => ({ eq: eqSpy }));
  const tableFromSpy = vi.fn(() => ({ update: updateSpy }));

  const client = {
    auth: { getSession },
    storage: { from: storageFromSpy },
    from: tableFromSpy,
  } as unknown as SupabaseClient;

  return { client, storageFromSpy, uploadSpy, getPublicUrlSpy, tableFromSpy, updateSpy, eqSpy };
}

describe('makeUploadAvatar (T105 real upload)', () => {
  it('uploads under {userId}/{timestamp}{extension}, upserts, resolves the public URL, and writes profiles.avatar_url', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_700_000_000_000);
    const { client, storageFromSpy, uploadSpy, getPublicUrlSpy, tableFromSpy, updateSpy, eqSpy } =
      buildFakeUploadAvatarClient({
        publicUrl:
          'https://example.test/storage/v1/object/public/avatars/profile-real-user-1/1700000000000.png',
      });
    const upload = makeUploadAvatar(() => client);
    const file = new File(['fake-bytes'], 'my-photo.png', { type: 'image/png' });

    const result = await upload(file);

    const expectedPath = `${TEST_USER_ID}/1700000000000.png`;
    expect(storageFromSpy).toHaveBeenCalledWith('avatars');
    expect(uploadSpy).toHaveBeenCalledWith(expectedPath, file, {
      upsert: true,
      contentType: 'image/png',
    });
    expect(getPublicUrlSpy).toHaveBeenCalledWith(expectedPath);
    expect(tableFromSpy).toHaveBeenCalledWith('profiles');
    expect(updateSpy).toHaveBeenCalledWith({
      avatar_url:
        'https://example.test/storage/v1/object/public/avatars/profile-real-user-1/1700000000000.png',
    });
    expect(eqSpy).toHaveBeenCalledWith('id', TEST_USER_ID);
    expect(result).toEqual({
      avatarUrl:
        'https://example.test/storage/v1/object/public/avatars/profile-real-user-1/1700000000000.png',
    });
  });

  it('never includes the original filename in the uploaded object path (SEC-02: no PII in URLs)', async () => {
    const { client, uploadSpy } = buildFakeUploadAvatarClient({});
    const upload = makeUploadAvatar(() => client);
    const file = new File(['fake-bytes'], 'jordan-rivera-headshot.jpg', { type: 'image/jpeg' });

    await upload(file);

    const uploadedPath = uploadSpy.mock.calls[0]?.[0] as string;
    expect(uploadedPath).not.toContain('jordan-rivera-headshot');
    expect(uploadedPath.startsWith(`${TEST_USER_ID}/`)).toBe(true);
    expect(uploadedPath.endsWith('.jpg')).toBe(true);
  });

  it('propagates a raw Storage upload error unwrapped, never calling getPublicUrl or updating profiles', async () => {
    const { client, getPublicUrlSpy, updateSpy } = buildFakeUploadAvatarClient({
      uploadError: { message: 'The resource already exists', name: 'Duplicate' },
    });
    const upload = makeUploadAvatar(() => client);
    const file = new File(['fake-bytes'], 'photo.png', { type: 'image/png' });

    await expect(upload(file)).rejects.toMatchObject({ message: 'The resource already exists' });
    expect(getPublicUrlSpy).not.toHaveBeenCalled();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('rejects with a plain Error when there is no active session, never uploading anything', async () => {
    const { client, storageFromSpy } = buildFakeUploadAvatarClient({ session: null });
    const upload = makeUploadAvatar(() => client);
    const file = new File(['fake-bytes'], 'photo.png', { type: 'image/png' });

    await expect(upload(file)).rejects.toThrow('No active session was found');
    expect(storageFromSpy).not.toHaveBeenCalled();
  });

  it('rejects with the real SupabaseLoaderError when the profiles.avatar_url write itself fails', async () => {
    const { client } = buildFakeUploadAvatarClient({
      updateError: { message: 'permission denied', code: '42501' },
    });
    const upload = makeUploadAvatar(() => client);
    const file = new File(['fake-bytes'], 'photo.png', { type: 'image/png' });

    await expect(upload(file)).rejects.toMatchObject({ code: '42501' });
  });
});

describe('makeSignOutEverywhere (T105 real global-scope sign-out)', () => {
  it('calls client.auth.signOut({ scope: "global" }) -- distinct from a bare signOut()', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    const client = { auth: { signOut } } as unknown as SupabaseClient;
    const signOutFn = makeSignOutEverywhere(() => client);

    await signOutFn();

    expect(signOut).toHaveBeenCalledWith({ scope: 'global' });
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it('propagates a raw AuthError unwrapped on failure', async () => {
    const authError = { message: 'network error', name: 'AuthError' };
    const signOut = vi.fn().mockResolvedValue({ error: authError });
    const client = { auth: { signOut } } as unknown as SupabaseClient;
    const signOutFn = makeSignOutEverywhere(() => client);

    await expect(signOutFn()).rejects.toBe(authError);
  });
});
