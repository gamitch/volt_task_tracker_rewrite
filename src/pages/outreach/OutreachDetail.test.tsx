// @vitest-environment jsdom
/**
 * T041: tests for `OutreachDetail.tsx`.
 *
 * Per this task's Allowed Files, a colocated test file is an explicitly
 * sanctioned addition (same precedent `OutreachList.test.tsx`/T038,
 * `RsvpControl.test.tsx`/T040, `LiveConsole.test.tsx`/T033 already
 * established) -- it exists to produce this task's own packet's "Required
 * Worker Output" proof requirements:
 *
 *   1. The invalid-ID DES-12 error state reveals NOTHING else (no
 *      MetadataList, no signup lists, no other event data anywhere in the
 *      container).
 *   2. The "Copy link" `Toast` fires the literal "Link copied" text and the
 *      constructed URL is correct -- honestly NOT asserting a real
 *      clipboard read-back (see module doc #6 of the component file).
 *   3. Per-session Going/Maybe/Can't go/No response grouping is correct,
 *      including the team-scoped roster diff (an out-of-scope student never
 *      appears at all, not even in "No response").
 *   4. MetadataList when/where/scope/creator content, the plain
 *      URL-encoded Google Maps link, and the Edit/Cancel MoreMenu stubs.
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- these tests use the same raw `createRoot`/`act`
 * pattern every sibling test file in this batch already established, plus
 * `LiveConsole.test.tsx`'s own `MemoryRouter`/`Routes`/`Route` wrapper
 * (needed here too, since this component reads `useParams()`, which only
 * resolves against an actually-matched route).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildGoogleMapsUrl,
  buildOutreachDetailUrl,
  copyTextToClipboard,
  defaultLoadOutreachDetail,
  formatScopeLabel,
  groupSessionSignups,
  OutreachDetail,
  resolveCreatorName,
  resolveEventRoster,
  type OutreachDetailData,
  type RosterStudent,
  type RsvpRow,
  type TeamOption,
} from './OutreachDetail';

// ---------------------------------------------------------------------------
// Render harness -- mirrors LiveConsole.test.tsx / RsvpControl.test.tsx.
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
});

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** Renders `<OutreachDetail />` inside a real matched `/outreach/:eventId`
 * route so `useParams()` resolves, mirroring `LiveConsole.test.tsx`'s own
 * `renderBody` helper. */
function renderDetail(eventId: string, props: Parameters<typeof OutreachDetail>[0] = {}): void {
  act(() => {
    root.render(
      <MemoryRouter initialEntries={[`/outreach/${eventId}`]}>
        <Routes>
          <Route path="/outreach/:eventId" element={<OutreachDetail {...props} />} />
        </Routes>
      </MemoryRouter>,
    );
  });
}

// ---------------------------------------------------------------------------
// 1. NAV-08/DES-12 -- invalid/inaccessible id reveals NOTHING.
// ---------------------------------------------------------------------------

describe('DES-12 "not found" state (NAV-08 -- reveal nothing)', () => {
  it('renders only the generic EmptyState, no event data anywhere', async () => {
    renderDetail('event-does-not-exist', { loadData: defaultLoadOutreachDetail });
    await flushMicrotasks();

    expect(container.textContent).toContain("This outreach event isn't available");
    expect(container.textContent).toContain(
      'It may have been removed, or you may not have access to it.',
    );

    // Nothing about the real fixture event(s) ever leaks into this render.
    expect(container.textContent).not.toContain('Community Food Bank Sort');
    expect(container.textContent).not.toContain('Riverside Food Bank');
    expect(container.textContent).not.toContain('100 Riverside Dr');
    expect(container.textContent).not.toContain('Amara Chen');
    expect(container.textContent).not.toContain('Jordan Owens');
    expect(container.textContent).not.toContain('Signups');
    expect(container.textContent).not.toContain('Going');
    expect(container.textContent).not.toContain('No response');
    expect(container.textContent).not.toContain('Event details');
    expect(container.textContent).not.toContain('Copy link');

    // No MetadataList/List DOM structure rendered at all in this state.
    expect(container.querySelector('dl')).toBeNull();
  });

  it('a genuinely rejected loadData (network failure) gets its own, separate error Banner -- never the same copy as "not found"', async () => {
    renderDetail('event-food-bank-sort', {
      loadData: () => Promise.reject(new Error('network down')),
    });
    await flushMicrotasks();

    expect(container.textContent).toContain("Couldn't load this event");
    expect(container.textContent).not.toContain("isn't available");
  });

  it('loading state renders a Spinner before the load resolves', () => {
    renderDetail('event-food-bank-sort', {
      loadData: () => new Promise<OutreachDetailData | null>(() => {}),
    });
    expect(container.textContent).toContain('Loading event');
  });
});

// ---------------------------------------------------------------------------
// 2. Per-session Going/Maybe/Can't go/No response grouping -- the central
//    trap: "No response" diffed from the roster, never a fabricated status.
// ---------------------------------------------------------------------------

describe('groupSessionSignups -- roster-diff derivation, not a stored status', () => {
  const ROSTER: RosterStudent[] = [
    { id: 's-1', name: 'Amara Chen', teamId: 'team-ravens' },
    { id: 's-2', name: 'Marcus Bello', teamId: 'team-ravens' },
    { id: 's-3', name: 'Nina Ortiz', teamId: 'team-ravens' },
  ];

  const RSVPS: RsvpRow[] = [
    {
      id: 'r-1',
      sessionId: 'session-1',
      studentId: 's-1',
      status: 'going',
      respondedBy: 's-1',
      updatedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 'r-2',
      sessionId: 'session-1',
      studentId: 's-2',
      status: 'declined',
      respondedBy: 's-2',
      updatedAt: '2026-01-01T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    // s-3 has no rsvp row at all for session-1.
  ];

  it('"declined" is a real answer (Can\'t go), distinct from no row at all (No response)', () => {
    const groups = groupSessionSignups('session-1', ROSTER, RSVPS);
    expect(groups.going.map((s) => s.id)).toEqual(['s-1']);
    expect(groups.maybe).toEqual([]);
    expect(groups.cantGo.map((s) => s.id)).toEqual(['s-2']);
    expect(groups.noResponse.map((s) => s.id)).toEqual(['s-3']);
  });

  it('a session with zero rsvp rows puts the entire roster in "No response"', () => {
    const groups = groupSessionSignups('session-with-no-rsvps', ROSTER, RSVPS);
    expect(groups.going).toEqual([]);
    expect(groups.maybe).toEqual([]);
    expect(groups.cantGo).toEqual([]);
    expect(groups.noResponse.map((s) => s.id)).toEqual(['s-1', 's-2', 's-3']);
  });
});

describe('resolveEventRoster -- events.team_ids NULL/array semantics', () => {
  const STUDENTS: RosterStudent[] = [
    { id: 's-1', name: 'Amara Chen', teamId: 'team-ravens' },
    { id: 's-2', name: 'Sofia Delgado', teamId: 'team-titans' },
  ];

  it('team_ids === null resolves to every student (all teams)', () => {
    const roster = resolveEventRoster(
      {
        id: 'e-1',
        seasonId: 's',
        type: 'outreach',
        title: 't',
        description: '',
        locationName: '',
        address: '',
        teamIds: null,
        createdBy: null,
      },
      STUDENTS,
    );
    expect(roster.map((s) => s.id)).toEqual(['s-1', 's-2']);
  });

  it('a team-scoped event excludes out-of-scope students entirely', () => {
    const roster = resolveEventRoster(
      {
        id: 'e-1',
        seasonId: 's',
        type: 'outreach',
        title: 't',
        description: '',
        locationName: '',
        address: '',
        teamIds: ['team-ravens'],
        createdBy: null,
      },
      STUDENTS,
    );
    expect(roster.map((s) => s.id)).toEqual(['s-1']);
  });
});

// ---------------------------------------------------------------------------
// 3. Rendered proof: real fixture event, per-session grouping + team-scoped
//    roster exclusion.
// ---------------------------------------------------------------------------

describe('<OutreachDetail /> populated render -- per-session grouping (all-teams event)', () => {
  it('groups session-food-bank-day1 into all four buckets correctly', async () => {
    renderDetail('event-food-bank-sort', { loadData: defaultLoadOutreachDetail });
    await flushMicrotasks();

    // Two sessions -> two independently-labeled SessionSignupList blocks
    // (module doc #4's per-session, not per-event, decision).
    expect(container.textContent).toContain('Aug 2');
    expect(container.textContent).toContain('Aug 9');

    expect(container.textContent).toContain('Amara Chen');
    expect(container.textContent).toContain('Marcus Bello');
    expect(container.textContent).toContain('Sofia Delgado');
    expect(container.textContent).toContain('Nina Ortiz');
    expect(container.textContent).toContain('Ravi Kapoor');

    // Bucket counts for session-food-bank-day1 specifically.
    expect(container.textContent).toContain('Going (1)');
    expect(container.textContent).toContain('Maybe (1)');
    expect(container.textContent).toContain("Can't go (1)");
    // Two sessions each have a "No response (N)" bucket; day1's is (2).
    expect(container.textContent).toContain('No response (2)');
    // day2's own No-response bucket (Amara/Marcus/Sofia unanswered) is (3).
    expect(container.textContent).toContain('No response (3)');
  });
});

describe('<OutreachDetail /> populated render -- team-scoped roster exclusion', () => {
  it('a Titans student never appears anywhere on a Ravens-only-scoped event page', async () => {
    renderDetail('event-park-cleanup', { loadData: defaultLoadOutreachDetail });
    await flushMicrotasks();

    expect(container.textContent).toContain('Amara Chen'); // Ravens, going
    expect(container.textContent).toContain('Nina Ortiz'); // Ravens, declined -> Can't go
    expect(container.textContent).toContain('Marcus Bello'); // Ravens, no rsvp -> No response
    expect(container.textContent).toContain('No response (1)');

    // Sofia Delgado / Ravi Kapoor are Titans -- entirely outside this
    // event's team-scoped roster, so they must not appear at all, not even
    // as "No response" entries.
    expect(container.textContent).not.toContain('Sofia Delgado');
    expect(container.textContent).not.toContain('Ravi Kapoor');
  });
});

// ---------------------------------------------------------------------------
// 4. MetadataList when/where/scope/creator.
// ---------------------------------------------------------------------------

describe('<OutreachDetail /> MetadataList content', () => {
  it('shows when/where/scope/creator for the all-teams fixture event', async () => {
    renderDetail('event-food-bank-sort', { loadData: defaultLoadOutreachDetail });
    await flushMicrotasks();

    expect(container.textContent).toContain('When');
    expect(container.textContent).toContain('Where');
    expect(container.textContent).toContain('Riverside Food Bank');
    expect(container.textContent).toContain('100 Riverside Dr, Suite #4');
    expect(container.textContent).toContain('Scope');
    expect(container.textContent).toContain('All teams');
    expect(container.textContent).toContain('Created by');
    expect(container.textContent).toContain('Jordan Owens');
  });

  it('team-scoped "Scope" shows the real team name, not raw ids', async () => {
    renderDetail('event-park-cleanup', { loadData: defaultLoadOutreachDetail });
    await flushMicrotasks();
    expect(container.textContent).toContain('Ravens');
  });

  it('a null created_by falls back to "Unknown creator", never a blank render', async () => {
    renderDetail('event-park-cleanup', { loadData: defaultLoadOutreachDetail });
    await flushMicrotasks();
    expect(container.textContent).toContain('Unknown creator');
  });

  it('resolveCreatorName / formatScopeLabel pure-function proof', () => {
    const TEAMS: TeamOption[] = [{ id: 'team-ravens', name: 'Ravens' }];
    expect(formatScopeLabel(null, TEAMS)).toBe('All teams');
    expect(formatScopeLabel(['team-ravens'], TEAMS)).toBe('Ravens');
    expect(formatScopeLabel(['team-unknown'], TEAMS)).toBe('No teams');
    expect(resolveCreatorName(null, [])).toBe('Unknown creator');
    expect(resolveCreatorName('profile-x', [{ id: 'profile-x', name: 'Jordan Owens' }])).toBe(
      'Jordan Owens',
    );
    expect(resolveCreatorName('profile-missing', [])).toBe('Unknown creator');
  });
});

// ---------------------------------------------------------------------------
// 5. Plain, URL-encoded Google Maps link (module doc #6).
// ---------------------------------------------------------------------------

describe('buildGoogleMapsUrl -- plain URL, correctly encoded', () => {
  it('matches the well-known plain Google Maps search URL pattern', () => {
    const url = buildGoogleMapsUrl('100 Riverside Dr, Suite #4');
    expect(url).toBe(
      'https://www.google.com/maps/search/?api=1&query=100%20Riverside%20Dr%2C%20Suite%20%234',
    );
    // No raw spaces/commas/"#" leak through unescaped.
    expect(url).not.toMatch(/[ ,#]/);
  });

  it('the rendered "Open in Google Maps" link href is exactly this URL', async () => {
    renderDetail('event-food-bank-sort', { loadData: defaultLoadOutreachDetail });
    await flushMicrotasks();

    // `isExternalLink` appends a visually-hidden "(opens in new tab)" span
    // (`node_modules/@astryxdesign/core/src/Link/Link.tsx`'s own
    // `VisuallyHidden` usage) to the anchor's `textContent`, so this checks
    // `.includes(...)` rather than an exact match against the visible label.
    const mapLink = Array.from(container.querySelectorAll('a')).find((a) =>
      a.textContent?.includes('Open in Google Maps'),
    );
    expect(mapLink).toBeTruthy();
    expect(mapLink?.getAttribute('href')).toBe(buildGoogleMapsUrl('100 Riverside Dr, Suite #4'));
    // Plain URL -- not an embedded map/iframe/SDK integration.
    expect(container.querySelector('iframe')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 6. NAV-08 "Copy link" -- Toast "Link copied", correct constructed URL,
//    disclosed clipboard-API limitation (module doc #6).
// ---------------------------------------------------------------------------

describe('buildOutreachDetailUrl -- the real, constructible per-event URL', () => {
  it('interpolates the real event id into the real /outreach/:eventId route', () => {
    expect(buildOutreachDetailUrl('event-food-bank-sort', 'https://volt.example.com')).toBe(
      'https://volt.example.com/outreach/event-food-bank-sort',
    );
  });
});

describe('"Copy link" action', () => {
  it('fires the literal "Link copied" Toast text and calls the clipboard API with the correct URL', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    });

    renderDetail('event-food-bank-sort', { loadData: defaultLoadOutreachDetail });
    await flushMicrotasks();

    expect(container.textContent).not.toContain('Link copied');

    const copyButton = Array.from(container.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Copy link',
    );
    expect(copyButton).toBeTruthy();
    act(() => {
      copyButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();

    expect(container.textContent).toContain('Link copied');
    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/outreach/event-food-bank-sort`,
    );

    Reflect.deleteProperty(navigator, 'clipboard');
  });

  it('copyTextToClipboard is honestly a no-op (never throws) when navigator.clipboard is unavailable -- the disclosed test-environment limitation', async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });

    await expect(copyTextToClipboard('https://example.com/outreach/x')).resolves.toBeUndefined();

    if (originalDescriptor) {
      Object.defineProperty(navigator, 'clipboard', originalDescriptor);
    } else {
      Reflect.deleteProperty(navigator, 'clipboard');
    }
  });
});

// ---------------------------------------------------------------------------
// 7. Edit/Cancel MoreMenu stubs -- disclosure Banner, never a real dialog.
// ---------------------------------------------------------------------------

describe('Edit/Cancel MoreMenu -- disclosure stubs, per Forbidden Files', () => {
  it('"Edit" shows a disclosure Banner, not the real OutreachEventDialog', async () => {
    renderDetail('event-food-bank-sort', { loadData: defaultLoadOutreachDetail });
    await flushMicrotasks();

    const moreMenuButton = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.getAttribute('aria-label')?.startsWith('Actions for Community Food Bank Sort'),
    );
    expect(moreMenuButton).toBeTruthy();
    act(() => {
      moreMenuButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const editItem = Array.from(document.querySelectorAll('[role="menuitem"], button')).find(
      (el) => el.textContent?.trim() === 'Edit',
    );
    expect(editItem).toBeTruthy();
    act(() => {
      editItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Edit dialog not built yet');
  });

  it('"Cancel event" shows a disclosure Banner, no real event_sessions mutation', async () => {
    renderDetail('event-food-bank-sort', { loadData: defaultLoadOutreachDetail });
    await flushMicrotasks();

    const moreMenuButton = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.getAttribute('aria-label')?.startsWith('Actions for Community Food Bank Sort'),
    );
    act(() => {
      moreMenuButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const cancelItem = Array.from(document.querySelectorAll('[role="menuitem"], button')).find(
      (el) => el.textContent?.trim() === 'Cancel event',
    );
    expect(cancelItem).toBeTruthy();
    act(() => {
      cancelItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(container.textContent).toContain('Cancel action not built yet');
    // Sessions remain 'scheduled' -- still findable via their formatted
    // date text, never silently flipped to canceled.
    expect(container.textContent).not.toContain('— canceled');
  });
});
