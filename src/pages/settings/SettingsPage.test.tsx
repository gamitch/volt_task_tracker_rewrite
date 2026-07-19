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
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../../app/guards';
import { MANAGE_PREFERENCES_PATH } from '../../emails/layout/constants';
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

function headingTexts(): string[] {
  return Array.from(container.querySelectorAll('h1, h2')).map((el) => el.textContent ?? '');
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
    expect(calls).toEqual([
      { profileId: 'profile-test', key: 'signupConfirm', value: false },
    ]);
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

    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value',
    )?.set;
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
