// @vitest-environment jsdom
/**
 * T085: tests for `ReportsShell.tsx`.
 *
 * `ReportsShell.tsx` never had its own test file before this task (T056's
 * original shell + `ParticipationTab` wiring shipped with no colocated test,
 * and `HoursTab`/`EventsTab` -- T057/T058 -- were each built afterward as
 * their own standalone components with their own test files, never touching
 * this shell). This file proves this task's own acceptance criteria directly
 * against the real, composed page:
 *
 *   (a) Hours and Events, when selected, render their REAL components with
 *       the shared `seasonId` threaded through -- and the shell's old
 *       "currently-Blocked" placeholder `EmptyState` copy is gone.
 *       Participation (already wired by T056, unchanged by this task) is
 *       included too, as the established precedent this task followed.
 *   (b) the pre-existing `RequireRole` guard and `TabList` tab-switching
 *       mechanism (both untouched by this task) still work.
 *
 * Uses the same raw `createRoot`/`act` pattern (no `@testing-library/react`
 * installed in this repo) and the same `AuthProvider` + `LoginAsDeferred`
 * role-login harness every other gated content page's test file in this
 * project already established.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { AuthProvider, type AuthUser } from '../../app/guards';
import { LoginAsDeferred as LoginAs } from '../../test-utils/authHarness';
import { ReportsShell } from './ReportsShell';

// ---------------------------------------------------------------------------
// Render harness -- mirrors `RosterShell.test.tsx`'s own harness (same
// project-wide `AuthProvider` + `LoginAsDeferred` pattern).
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

const ADMIN_USER: AuthUser = { id: 'user-admin', email: 'admin@example.com', role: 'admin' };
const COACH_USER: AuthUser = { id: 'user-coach', email: 'coach@example.com', role: 'coach' };
const PARENT_USER: AuthUser = { id: 'user-parent', email: 'parent@example.com', role: 'parent' };

function renderReportsShell(
  user: AuthUser | null,
  props: Parameters<typeof ReportsShell>[0] = {},
): void {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={['/reports']}>
        <AuthProvider>
          <Routes>
            <Route
              path="/reports"
              element={
                user === null ? (
                  <ReportsShell {...props} />
                ) : (
                  <LoginAs user={user}>
                    <ReportsShell {...props} />
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

function clickTab(value: 'participation' | 'hours' | 'events'): void {
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
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

// ---------------------------------------------------------------------------
// (b) RequireRole guard -- unchanged from T056, quick regression check.
// ---------------------------------------------------------------------------

describe('<ReportsShell /> RequireRole guard (unchanged from T056)', () => {
  it('denies a non-coach/admin role (RPT-06) with AccessDeniedPage', async () => {
    renderReportsShell(PARENT_USER);
    await flushMicrotasks();
    expect(container.querySelector('[data-testid="redirected-home"]')).toBeNull();
    expect(container.textContent).toContain("This page isn't part of your role");
    expect(container.textContent).not.toContain('Reports');
  });

  it('admits a coach', async () => {
    renderReportsShell(COACH_USER);
    await flushMicrotasks();
    expect(container.textContent).toContain('Reports');
  });

  it('admits an admin', async () => {
    renderReportsShell(ADMIN_USER);
    await flushMicrotasks();
    expect(container.textContent).toContain('Reports');
  });
});

// ---------------------------------------------------------------------------
// (a) Real tab wiring -- the central acceptance criterion for this task.
// ---------------------------------------------------------------------------

const OLD_PLACEHOLDER_STRINGS = [
  'Hours report not built yet',
  'Events report not built yet',
  'currently-Blocked',
  'T057',
  'T058',
];

describe('<ReportsShell /> real tab wiring (T085 acceptance criteria)', () => {
  it('renders the real ParticipationTab (already-wired T056 precedent) on the default tab', async () => {
    renderReportsShell(COACH_USER);
    await flushMicrotasks();
    // Real ParticipationTab fixture row (ParticipationTab.tsx's own FIXTURE_STUDENTS).
    expect(container.textContent).toContain('Ava Thompson');
  });

  it('renders the real HoursTab when the Hours tab is selected', async () => {
    renderReportsShell(COACH_USER);
    await flushMicrotasks();
    clickTab('hours');
    await flushMicrotasks();
    // Real HoursTab content: its own "Season totals" cards + a real fixture
    // student row (HoursTab.tsx's own FIXTURE_STUDENTS), never present on
    // the old placeholder EmptyState.
    expect(container.textContent).toContain('Season totals');
    expect(container.textContent).toContain('Jordan Blake');
    expect(container.textContent).not.toContain('Hours report not built yet');
  });

  it('renders the real EventsTab when the Events tab is selected', async () => {
    renderReportsShell(COACH_USER);
    await flushMicrotasks();
    clickTab('events');
    await flushMicrotasks();
    // Real EventsTab fixture session row (EventsTab.tsx's own FIXTURE_EVENTS).
    expect(container.textContent).toContain('Weekly Team Meeting');
    expect(container.textContent).not.toContain('Events report not built yet');
  });

  it('never shows any old placeholder copy across the full tab tour', async () => {
    renderReportsShell(ADMIN_USER);
    await flushMicrotasks();
    for (const value of ['participation', 'hours', 'events'] as const) {
      clickTab(value);
      await flushMicrotasks();
      for (const placeholder of OLD_PLACEHOLDER_STRINGS) {
        expect(container.textContent).not.toContain(placeholder);
      }
    }
  });

  it('threads one shared seasonId to all three tabs (module doc #2 -- no second placeholder)', async () => {
    const seasonId = 'season-shared-test-id';
    let participationSeasonIdSeen: string | null = null;
    let hoursSeasonIdSeen: string | null = null;
    let eventsSeasonIdSeen: string | null = null;

    renderReportsShell(COACH_USER, {
      seasonId,
      loadParticipationData: async (id: string) => {
        participationSeasonIdSeen = id;
        return [];
      },
      loadHoursData: async (id: string) => {
        hoursSeasonIdSeen = id;
        return {
          seasonId: id,
          defaultGoalHours: 0,
          students: [],
          teams: [],
          studentHours: [],
          events: [],
          sessions: [],
          rsvps: [],
        };
      },
      loadEventsData: async (id: string) => {
        eventsSeasonIdSeen = id;
        return [];
      },
    });
    await flushMicrotasks();

    clickTab('hours');
    await flushMicrotasks();
    clickTab('events');
    await flushMicrotasks();

    expect(participationSeasonIdSeen).toBe(seasonId);
    expect(hoursSeasonIdSeen).toBe(seasonId);
    expect(eventsSeasonIdSeen).toBe(seasonId);
  });
});

// ---------------------------------------------------------------------------
// (b) TabList tab-switching + keyboard-nav scaffold -- unchanged from T056,
// quick regression check only.
// ---------------------------------------------------------------------------

describe('<ReportsShell /> tab scaffold regression check (unchanged from T056)', () => {
  it('renders all three tabs in RPT-01 literal order: Participation | Hours | Events', async () => {
    renderReportsShell(COACH_USER);
    await flushMicrotasks();
    const tabs = Array.from(document.querySelectorAll('button[data-tab-value]')).map((el) =>
      el.getAttribute('data-tab-value'),
    );
    expect(tabs).toEqual(['participation', 'hours', 'events']);
  });

  it('switches the active/selected tab (aria-current) when a different tab is clicked', async () => {
    renderReportsShell(COACH_USER);
    await flushMicrotasks();

    const participationTabButton = document.querySelector('button[data-tab-value="participation"]');
    expect(participationTabButton?.getAttribute('aria-current')).toBe('page');

    clickTab('events');
    await flushMicrotasks();

    const eventsTabButton = document.querySelector('button[data-tab-value="events"]');
    expect(eventsTabButton?.getAttribute('aria-current')).toBe('page');
    expect(participationTabButton?.getAttribute('aria-current')).toBeNull();
  });

  it('still supports roving-tabindex ArrowRight keyboard navigation across the tab strip', async () => {
    renderReportsShell(COACH_USER);
    await flushMicrotasks();

    const participationTabButton = document.querySelector(
      'button[data-tab-value="participation"]',
    ) as HTMLButtonElement;
    const hoursTabButton = document.querySelector(
      'button[data-tab-value="hours"]',
    ) as HTMLButtonElement;

    act(() => {
      participationTabButton.focus();
    });
    expect(document.activeElement).toBe(participationTabButton);

    act(() => {
      participationTabButton.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
      );
    });

    expect(document.activeElement).toBe(hoursTabButton);
  });
});
