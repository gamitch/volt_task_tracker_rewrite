// @vitest-environment jsdom
/**
 * Tests for `CoachMeetingsView.tsx`'s coach/admin role variant -- moved
 * verbatim out of `src/pages/meetings/MeetingsList.test.tsx` (GAM-444 Stage
 * C), then substantially rewritten by GAM-452 (this ticket) to match the
 * redesigned card/rail/panel composition that replaces the old Table-based
 * Upcoming/Past row UI. Renders through `<MeetingsList />` (imported from
 * `../MeetingsList`, the shell) -- these are role-variant integration tests
 * (auth -> role switch -> `CoachMeetingsView`), not isolated-component
 * tests.
 *
 * GAM-452 §3c -- `/meetings` renders inside `<SeasonProvider>` in production
 * (`App.tsx:74` -> `AppShell.tsx:158-168`); every render below is wrapped in
 * one too, via the same injected `loadActiveSeason` seam
 * `CalendarPage.test.tsx:154`/`:168` already establishes. Most tests default
 * to a resolved `null` (season `'none'`) -- `MeetingsRail` falls back to the
 * session-span bound in that case, which every pre-existing assertion below
 * is written to tolerate; two dedicated tests prove the `'ready'` half of
 * the threading (criterion 2).
 *
 * Per the original T030 packet's own disclosed-addition note (still true):
 * no `@testing-library/react` is installed in this repo -- these tests use
 * the same raw `createRoot`/`act` pattern `CheckinResult.test.tsx` and
 * `theme.smoke.test.tsx` already established.
 */
import { MemoryRouter } from 'react-router-dom';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, type AuthUser } from '../../../app/guards';
import { SeasonProvider, type LoadActiveSeasonFn } from '../../../app/SeasonProvider';
import type { SeasonRow } from '../../../lib/supabase/types';
import { LoginAs } from '../../../test-utils/authHarness';
import { MeetingsList, defaultLoadCoachMeetingsData, formatWeekdayDate } from '../MeetingsList';
import type { CoachMeetingsData, ResolveCurrentStudentIdFn } from '../../../lib/meetings/types';
import type { ResolveStudentIsActiveFn } from '../../../lib/supabase/loaders/students';
import { chicagoWallTimeToUtcIso } from '../ScheduleMeetingsDialog';
import type { CreateMeetingsPayload } from '../ScheduleMeetingsDialog';
import type { SaveMeetingSessionPayload } from '../EditMeetingSessionDialog';

// ---------------------------------------------------------------------------
// jsdom gaps, scoped to THIS test file's own jsdom globals only (not
// `src/test-setup.ts`, outside this task's Allowed Files):
//   - `AlertDialog` renders a native `<dialog>` and calls
//     `HTMLDialogElement.prototype.showModal()`, which this repo's installed
//     jsdom (29.x) does not implement (precedent already in this file,
//     pre-ticket, `:31-46` of the prior revision).
//   - `Element.prototype.scrollIntoView` does not exist in jsdom at all
//     (GAM-452 packet §3b) -- needed for the criterion-1 focus/scroll test.
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
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = function scrollIntoView(): void {
    // no-op stub -- jsdom has no layout engine, this only needs to exist so
    // the real call site doesn't throw.
  };
}

// ---------------------------------------------------------------------------
// Render harness
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

const COACH_USER: AuthUser = { id: 'user-coach', email: 'coach@example.com', role: 'coach' };
// T511 C3 -- the one test in this file that also mounts the student/parent
// view, to prove a role-gate widening would not silently leak a coach "Go
// live" link to a student. Same literal `AuthUser` shape
// `student/StudentMeetingsView.test.tsx` uses.
const STUDENT_OR_PARENT_USER: AuthUser = {
  id: 'user-student',
  email: 'student@example.com',
  role: 'student',
};

/** GAM-452 §3c -- `null` (season `'none'`) unless a test needs a real,
 * `'ready'` season (criterion 2). `MemoryRouter` is required, not
 * decorative: the composed page renders a real `Link as={RouterLink}` to
 * the live console, and `RouterLink` throws outside a router context (same
 * `LiveConsole.test.tsx`/`CheckinResult.test.tsx` precedent this file
 * already used pre-ticket). */
function renderAsUser(
  user: AuthUser,
  props: Parameters<typeof MeetingsList>[0] = {},
  loadActiveSeason: LoadActiveSeasonFn = async () => null,
): void {
  act(() => {
    root.render(
      <MemoryRouter>
        <AuthProvider>
          <SeasonProvider loadActiveSeason={loadActiveSeason}>
            <LoginAs user={user}>
              <MeetingsList {...props} />
            </LoginAs>
          </SeasonProvider>
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

// ---------------------------------------------------------------------------
// T096: DOM helpers for interacting with the now-real `ScheduleMeetingsDialog`
// -- unchanged from before this ticket (Astryx `Field` renders a real
// `<label htmlFor={id}>` for every labeled input; no testing-library
// `getByLabelText` equivalent is installed in this repo).
// ---------------------------------------------------------------------------

function getFieldControl(labelText: string): HTMLElement {
  const labels = Array.from(container.querySelectorAll('label'));
  const label = labels.find((el) => el.textContent?.trim().startsWith(labelText));
  if (!label) {
    throw new Error(
      `No label found for "${labelText}". Labels present: ${labels.map((l) => l.textContent).join(' | ')}`,
    );
  }
  const forId = label.getAttribute('for');
  if (!forId) throw new Error(`Label "${labelText}" has no htmlFor`);
  const control = document.getElementById(forId);
  if (!control) throw new Error(`No control found for id "${forId}"`);
  return control;
}

function findButtonByText(text: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === text,
  );
}

/** `Tab`'s own label renders TWICE in the DOM (a visible span plus an
 * `aria-hidden` width-measurement duplicate, `Tab.tsx:303-309`), so an
 * exact-text lookup never matches -- select by its real `data-tab-value`
 * attribute instead. */
function selectTab(value: 'active' | 'finished'): void {
  const tab = container.querySelector(`[data-tab-value="${value}"]`);
  if (!tab) throw new Error(`No tab found for "${value}"`);
  clickButton(tab as HTMLButtonElement);
}

function setNativeInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function clickButton(button: HTMLButtonElement): void {
  act(() => {
    button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

// ---------------------------------------------------------------------------
// GAM-452 -- new DOM helpers for the card/rail/panel composition, replacing
// the deleted `expandRow` (old coach-table expander) and the old
// `CoachMeetingSessionRow`-specific button lookups.
// ---------------------------------------------------------------------------

/** Finds a `<SeriesCard>` by its title (an `<h3>`) and clicks its "View full
 * schedule" button -- the card-select entry point that opens the drill-out
 * `<SchedulePanel>` (replaces the deleted table row expander). */
function selectCard(eventTitle: string): void {
  const heading = Array.from(container.querySelectorAll('h3')).find(
    (h) => h.textContent === eventTitle,
  );
  if (!heading) throw new Error(`No series card heading found for "${eventTitle}"`);
  let el: HTMLElement | null = heading;
  let button: HTMLButtonElement | undefined;
  for (let i = 0; i < 10 && el && !button; i += 1) {
    button = Array.from(el.querySelectorAll('button')).find((b) =>
      b.textContent?.startsWith('View full schedule'),
    );
    el = el.parentElement;
  }
  if (!button) throw new Error(`No "View full schedule" button found for "${eventTitle}"`);
  clickButton(button);
}

/** Finds the smallest ancestor of a given session's own date/time line that
 * also contains that row's Expand/Collapse toggle -- `SessionRow.tsx`'s own
 * row header -- then returns its PARENT (the row's full `<VStack>` root,
 * which also contains the conditionally-rendered expanded body). */
function findSessionRowRoot(sessionDate: string): HTMLElement {
  const dateText = formatWeekdayDate(sessionDate);
  const leaf = Array.from(container.querySelectorAll('*')).find(
    (el) => el.children.length === 0 && (el.textContent ?? '').startsWith(dateText),
  );
  if (!leaf) throw new Error(`No session row found for "${dateText}"`);
  let el: HTMLElement | null = leaf as HTMLElement;
  for (let i = 0; i < 10 && el; i += 1) {
    const hasToggle = Array.from(el.querySelectorAll('button')).some((b) => {
      const text = b.textContent?.trim();
      return text === 'Expand' || text === 'Collapse';
    });
    if (hasToggle) {
      return (el.parentElement ?? el) as HTMLElement;
    }
    el = el.parentElement;
  }
  throw new Error(`No session row root found for "${dateText}"`);
}

function findButtonInSessionRow(sessionDate: string, text: string): HTMLButtonElement | undefined {
  const root = findSessionRowRoot(sessionDate);
  return Array.from(root.querySelectorAll('button')).find((b) => b.textContent?.trim() === text);
}

/** Clicks a session row's own Expand/Collapse toggle (`SessionRow.tsx`'s own
 * control) -- required before its inline Cancel button (a `scheduled`
 * session) or roster region (a `completed` session) exists in the DOM. */
function toggleSessionExpand(sessionDate: string): void {
  const button =
    findButtonInSessionRow(sessionDate, 'Expand') ?? findButtonInSessionRow(sessionDate, 'Collapse');
  if (!button) throw new Error(`No Expand/Collapse toggle found for ${formatWeekdayDate(sessionDate)}`);
  clickButton(button);
}

function findButtonInDialogByTitle(
  titleSubstring: string,
  buttonText: string,
): HTMLButtonElement | undefined {
  const dialog = Array.from(document.querySelectorAll('dialog')).find((d) =>
    d.textContent?.includes(titleSubstring),
  );
  return Array.from(dialog?.querySelectorAll('button') ?? []).find(
    (b) => b.textContent?.trim() === buttonText,
  );
}

/** T511 C3 -- same fake `resolveStudentId(Fn)` seam
 * `student/StudentMeetingsView.test.tsx` defines; needed here only for the
 * one test in this file that also mounts the student/parent view. */
function fakeResolveStudentId(studentId: string | null): ResolveCurrentStudentIdFn {
  return () => Promise.resolve(studentId);
}

/** T511 C3 -- same fake `resolveStudentIsActive` seam
 * `student/StudentMeetingsView.test.tsx` defines; needed here only for the
 * one test in this file that also mounts the student/parent view. */
function fakeResolveStudentIsActive(isActive: boolean | null = true): ResolveStudentIsActiveFn {
  return () => Promise.resolve(isActive);
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
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// <MeetingsList /> -- coach view, all four DES-12 states (criterion 9)
// ---------------------------------------------------------------------------

describe('<MeetingsList /> coach view', () => {
  it('loading state', async () => {
    renderAsUser(COACH_USER, { loadCoachData: () => new Promise<CoachMeetingsData>(() => {}) });
    // T073b2: auth resolution (even via the fake `authModule` this
    // harness's `LoginAs` now uses) is genuinely async -- a flush is needed
    // before the authenticated body (and its own DES-12 loading state)
    // mounts. See `src/test-utils/authHarness.tsx`'s module doc.
    await flushMicrotasks();
    expect(container.textContent).toContain('Loading meetings');
  });

  it('error state', async () => {
    renderAsUser(COACH_USER, { loadCoachData: () => Promise.reject(new Error('boom')) });
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't load meetings");
  });

  it('empty state (zero meeting sessions)', async () => {
    renderAsUser(COACH_USER, { loadCoachData: () => Promise.resolve({ rows: [], teams: [] }) });
    await flushMicrotasks();
    // DES-15 verbatim (PRD line 212, T083) -- unchanged by this ticket.
    expect(container.textContent).toContain('No meetings scheduled.');
    expect(container.textContent).toContain(
      'Set up your weekly build meetings once and check-in takes care of itself.',
    );
  });

  // GAM-452 rewrite -- the old assertions here were about the deleted
  // Table's own `StatCell`/expander-button text ("Scheduled4h", "Session
  // details (3)") and cumulative "Expected"/"Attended" counts that
  // `SeriesCardModel` (frozen, GAM-444) simply has no field for
  // (`SeriesCard.tsx`'s own module doc item 7(a): "No location/roster-count/
  // canceled-count/span-chip/'N expected'"). These are REMOVED, not
  // adapted -- that surface is genuinely gone, not turned red by a mistake.
  // Replaced with the equivalent facts on the new card: title, team scope,
  // schedule chips (derived from real fixture sessions, GAM-452 §1),
  // progress caption, attendance "—" (fixture sets no `attendancePct`), and
  // the next-session line (criterion 12's own format).
  it('populated state: series cards, schedule chips, progress, attendance passthrough, NAV-07 exclusion', async () => {
    renderAsUser(COACH_USER, { loadCoachData: defaultLoadCoachMeetingsData });
    await flushMicrotasks();

    expect(container.textContent).toContain('Weekly Build Meeting');
    expect(container.textContent).toContain('Ravens Strategy Session');
    expect(container.textContent).toContain('All teams');
    expect(container.textContent).toContain('Ravens');

    // Schedule chips (GAM-452 §1): both series' real sessions dedupe to one
    // weekday-with-time rule each, canceled sessions excluded.
    expect(container.textContent).toContain('Wed 6–8 PM');
    expect(container.textContent).toContain('Sat 5:30–7 PM');

    // Progress caption -- "N of M sessions held", canceled excluded from
    // the denominator.
    expect(container.textContent).toContain('1 of 2 sessions held');

    // Attendance passthrough (§0d/§9a, criterion 6) -- the fixture sets no
    // `attendancePct`, so both cards render "—", never a fabricated 0%.
    expect(container.textContent).toContain('—');

    // Next-session line (criterion 12's literal shape).
    expect(container.textContent).toContain('Next: Wed, Jul 22 · 6–8 PM');
    expect(container.textContent).toContain('Next: Sat, Jul 25 · 5:30–7 PM');

    // NAV-07: outreach content must never appear.
    expect(container.textContent).not.toContain('Community Food Drive');
  });

  // T096: "Schedule meetings" now opens the real `ScheduleMeetingsDialog`
  // (T031, already Passed) instead of showing the old "dialog not built yet"
  // stub. Unaffected by the card/rail/panel redesign -- unchanged from
  // before this ticket except the `SeasonProvider` wrap.
  it('"Schedule meetings" opens the real ScheduleMeetingsDialog (module doc #7a)', async () => {
    renderAsUser(COACH_USER, { loadCoachData: defaultLoadCoachMeetingsData });
    await flushMicrotasks();

    expect(container.textContent).not.toContain('Scheduling dialog not built yet');
    // Both `AlertDialog` (Cancel) and `ScheduleMeetingsDialog` are always
    // MOUNTED (Astryx's `Dialog` keeps its content in the DOM tree
    // regardless of `isOpen`) -- "closed" is asserted via the specific
    // `<dialog>` containing "Team scope" (unique to the schedule dialog)
    // and its own native `open` attribute, not text presence/absence.
    function findScheduleDialogElement(): HTMLElement | undefined {
      return Array.from(document.querySelectorAll('dialog')).find((dialog) =>
        dialog.textContent?.includes('Team scope'),
      );
    }
    expect(findScheduleDialogElement()?.hasAttribute('open')).toBe(false);

    const scheduleButtons = Array.from(container.querySelectorAll('button')).filter((btn) =>
      btn.textContent?.includes('Schedule meetings'),
    );
    expect(scheduleButtons.length).toBeGreaterThan(0);
    act(() => {
      scheduleButtons[0].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(findScheduleDialogElement()?.hasAttribute('open')).toBe(true);

    // The real dialog's own field set (MTG-02 order) is now on the page --
    // proof it's genuinely rendered, not a stub Banner.
    expect(document.body.textContent).toContain('Schedule meetings');
    expect(getFieldControl('Title')).toBeTruthy();
    expect(getFieldControl('Team scope')).toBeTruthy();
    expect(getFieldControl('Location')).toBeTruthy();
  });

  it('creating a meeting via the real dialog calls the injected onCreateMeetings seam and reloads the list', async () => {
    const onCreateMeetings = vi.fn().mockResolvedValue(undefined);
    let loadCallCount = 0;
    const loadCoachData = (): Promise<CoachMeetingsData> => {
      loadCallCount += 1;
      return loadCallCount === 1
        ? defaultLoadCoachMeetingsData()
        : Promise.resolve({
            rows: [
              {
                eventId: 'event-new',
                title: 'Team meeting',
                locationName: 'Robotics Lab',
                teamScopeLabel: 'All teams',
                sessions: [
                  {
                    sessionId: 'session-new',
                    sessionDate: '2026-07-22',
                    startsAt: '2026-07-22T23:00:00.000Z',
                    endsAt: '2026-07-23T01:00:00.000Z',
                    status: 'scheduled' as const,
                    durationHours: 2,
                    expectedCt: 0,
                    attendanceSummary: null,
                    attendeeNames: [],
                  },
                ],
              },
            ],
            teams: [],
          });
    };

    renderAsUser(COACH_USER, { loadCoachData, onCreateMeetings });
    await flushMicrotasks();

    const scheduleButtons = Array.from(container.querySelectorAll('button')).filter((btn) =>
      btn.textContent?.includes('Schedule meetings'),
    );
    clickButton(scheduleButtons[0] as HTMLButtonElement);

    const dateInput = getFieldControl('Date') as HTMLInputElement;
    act(() => {
      setNativeInputValue(dateInput, '2026-08-05');
    });

    expect(onCreateMeetings).not.toHaveBeenCalled();
    clickButton(findButtonByText('Create 1 meeting') as HTMLButtonElement);
    await flushMicrotasks();

    expect(onCreateMeetings).toHaveBeenCalledTimes(1);
    const payload = onCreateMeetings.mock.calls[0][0] as CreateMeetingsPayload;
    expect(payload.sessions[0].sessionDate).toBe('2026-08-05');

    // Real reload after a successful create -- the dialog's own successful
    // submit closes it, and a real feedback Banner + the freshly-reloaded
    // row both appear.
    expect(loadCallCount).toBe(2);
    expect(container.textContent).toContain('Meetings scheduled');
  });

  // T147: unaffected by the card/rail/panel redesign -- interacts with
  // `ScheduleMeetingsDialog` directly via the unchanged "Schedule meetings"
  // button.
  it('T147: deselecting one team submits a teamIds array of real UUIDs from the teams prop, never the fixture strings', async () => {
    const onCreateMeetings = vi.fn().mockResolvedValue(undefined);
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    async function loadCoachDataWithRealTeams(): Promise<CoachMeetingsData> {
      const base = await defaultLoadCoachMeetingsData();
      return {
        ...base,
        teams: [
          { id: 'd4444444-4444-4444-8444-444444444444', name: 'Photon Phalanx', archived: false },
          { id: 'd5555555-5555-4555-8555-555555555555', name: 'Kinetic Krew', archived: false },
        ],
      };
    }

    renderAsUser(COACH_USER, { loadCoachData: loadCoachDataWithRealTeams, onCreateMeetings });
    await flushMicrotasks();

    const scheduleButtons = Array.from(container.querySelectorAll('button')).filter((btn) =>
      btn.textContent?.includes('Schedule meetings'),
    );
    clickButton(scheduleButtons[0] as HTMLButtonElement);

    const dateInput = getFieldControl('Date') as HTMLInputElement;
    act(() => {
      setNativeInputValue(dateInput, '2026-08-05');
    });

    const trigger = getFieldControl('Team scope');
    clickButton(trigger as HTMLButtonElement);
    const listboxId = trigger.getAttribute('aria-controls');
    expect(listboxId).toBeTruthy();
    const listbox = document.getElementById(listboxId ?? '');
    expect(listbox).toBeTruthy();
    const options = Array.from(listbox?.querySelectorAll('[role="option"]') ?? []);
    expect(options.length).toBeGreaterThan(0);
    act(() => {
      options[options.length - 1].dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onCreateMeetings).not.toHaveBeenCalled();
    clickButton(findButtonByText('Create 1 meeting') as HTMLButtonElement);
    await flushMicrotasks();

    expect(onCreateMeetings).toHaveBeenCalledTimes(1);
    const payload = onCreateMeetings.mock.calls[0][0] as CreateMeetingsPayload;
    const submittedTeamIds = payload.event.teamIds;
    expect(submittedTeamIds).not.toBeNull();
    expect(submittedTeamIds).not.toEqual([]);
    for (const id of submittedTeamIds ?? []) {
      expect(id).toMatch(UUID_RE);
    }
  });

  // GAM-452 -- re-derived (surface renamed, not removed). `SeriesCard.tsx`
  // (frozen) ships no card-level Edit affordance (its own module doc item
  // 7(b)), so this file supplies "Edit series" as a sibling of the card,
  // reusing the SAME already-built `ScheduleMeetingsDialog` edit mode T510
  // wired up. Old locator (`aria-label` starting with "Edit – Weekly Build
  // Meeting") -> new locator ("Edit series – Weekly Build Meeting").
  it('T510: "Edit series" opens the real dialog in edit mode, prefilled from the clicked card (not the old stub)', async () => {
    const onCreateMeetings = vi.fn().mockResolvedValue(undefined);
    renderAsUser(COACH_USER, { loadCoachData: defaultLoadCoachMeetingsData, onCreateMeetings });
    await flushMicrotasks();

    const editButton = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.getAttribute('aria-label')?.startsWith('Edit series – Weekly Build Meeting'),
    );
    expect(editButton).toBeTruthy();
    clickButton(editButton as HTMLButtonElement);

    function findEditDialogElement(): HTMLElement | undefined {
      return Array.from(document.querySelectorAll('dialog')).find((dialog) =>
        dialog.textContent?.includes('Edit meeting series'),
      );
    }
    expect(findEditDialogElement()?.hasAttribute('open')).toBe(true);
    expect((getFieldControl('Title') as HTMLInputElement).value).toBe('Weekly Build Meeting');
    expect((getFieldControl('Location') as HTMLInputElement).value).toBe('Robotics Lab');

    expect(container.textContent).not.toContain("Editing an existing meeting isn't supported yet");
    expect(container.textContent).not.toContain('not built yet');

    expect(onCreateMeetings).not.toHaveBeenCalled();
  });

  // GAM-452 -- rewritten. `CoachMeetingSessionRow` (deleted, module doc §4)
  // owned the old inline Cancel + its own confirmation copy
  // (`Cancel "{title}" on {date}?`). `SessionRow.tsx` (frozen, GAM-448) now
  // owns BOTH the inline Cancel button AND its own confirmation `AlertDialog`
  // (a DIFFERENT title shape: `Cancel this session on {date}?`) -- the
  // mutation seam (`handleCancelSession`) and the success feedback Banner
  // text are UNCHANGED from before this ticket.
  it('Cancel (inline, per-session) + AlertDialog (DES-11) really calls the injected onCancelSession mutation', async () => {
    const onCancelSession = vi.fn().mockResolvedValue(undefined);
    renderAsUser(COACH_USER, { loadCoachData: defaultLoadCoachMeetingsData, onCancelSession });
    await flushMicrotasks();

    // "Weekly Build Meeting" has exactly one still-scheduled session
    // (session-upcoming-build, 2026-07-22, a Wednesday).
    selectCard('Weekly Build Meeting');
    toggleSessionExpand('2026-07-22');
    const cancelButton = findButtonInSessionRow('2026-07-22', 'Cancel this session');
    expect(cancelButton).toBeTruthy();
    clickButton(cancelButton as HTMLButtonElement);

    expect(document.body.textContent).toContain('Cancel this session on Wed, Jul 22?');

    const confirmButton = findButtonInDialogByTitle('Cancel this session on Wed, Jul 22?', 'Cancel session');
    expect(confirmButton).toBeTruthy();
    clickButton(confirmButton as HTMLButtonElement);
    await flushMicrotasks();

    // The real mutation seam was genuinely called, with the target session's
    // id -- unchanged assertion from before this ticket.
    expect(onCancelSession).toHaveBeenCalledTimes(1);
    expect(onCancelSession).toHaveBeenCalledWith('session-upcoming-build');
    expect(container.textContent).toContain('Meeting session canceled');
    // The session's own status badge now reads "Canceled".
    expect(findSessionRowRoot('2026-07-22').textContent).toContain('Canceled');

    // Canceling "Weekly Build Meeting"'s own last scheduled session moves
    // it to Finished; the view follows the just-acted-on row there (GAM-452
    // fix, disclosed in this ticket's own report). Switch back to Active to
    // reach "Ravens Strategy Session", whose own Cancel button is
    // untouched, on a DIFFERENT card that has never been selected.
    selectTab('active');
    selectCard('Ravens Strategy Session');
    toggleSessionExpand('2026-07-25');
    expect(findButtonInSessionRow('2026-07-25', 'Cancel this session')).toBeTruthy();
  });

  it('Cancel rolls back the optimistic update and shows an error Banner when the mutation rejects', async () => {
    const onCancelSession = vi.fn().mockRejectedValue(new Error('network down'));
    renderAsUser(COACH_USER, { loadCoachData: defaultLoadCoachMeetingsData, onCancelSession });
    await flushMicrotasks();

    selectCard('Weekly Build Meeting');
    toggleSessionExpand('2026-07-22');
    const cancelButton = findButtonInSessionRow('2026-07-22', 'Cancel this session');
    clickButton(cancelButton as HTMLButtonElement);
    const confirmButton = findButtonInDialogByTitle('Cancel this session on Wed, Jul 22?', 'Cancel session');
    clickButton(confirmButton as HTMLButtonElement);
    await flushMicrotasks();

    // Rolled back -- the session's own Cancel button reappears, and the
    // status badge never actually changed to "Canceled".
    expect(findButtonInSessionRow('2026-07-22', 'Cancel this session')).toBeTruthy();
    expect(container.textContent).toContain("Couldn't cancel meeting");
  });
});

// ---------------------------------------------------------------------------
// T605 -- per-session Edit dialog (date/time/notes) + Cancel-from-edit-flow.
// GAM-452 rewrite: `clickEdit`/`expandRow` re-pointed at the new
// card-select -> session-row locators. Dialog interaction logic (fields,
// validation guards, save payload) is UNCHANGED from before this ticket.
// ---------------------------------------------------------------------------

describe('<MeetingsList /> coach view -- T605 per-session Edit dialog', () => {
  const EDIT_FIXTURE_NOW = new Date('2026-08-06T12:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: EDIT_FIXTURE_NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function daysFromFixtureNow(days: number): string {
    return new Date(EDIT_FIXTURE_NOW.getTime() + days * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
  }

  function chicagoEveningSession(dateOnly: string): { startsAt: string; endsAt: string } {
    const nextDay = new Date(new Date(`${dateOnly}T00:00:00.000Z`).getTime() + 86400000)
      .toISOString()
      .slice(0, 10);
    return { startsAt: `${dateOnly}T23:00:00.000Z`, endsAt: `${nextDay}T01:00:00.000Z` };
  }

  const RECONCILABLE_DATE = daysFromFixtureNow(7);
  const SIBLING_DATE = daysFromFixtureNow(14);
  const FREE_DATE = daysFromFixtureNow(21);
  const PAST_SCHEDULED_DATE = daysFromFixtureNow(-1);
  const COMPLETED_DATE = daysFromFixtureNow(-10);
  const CANCELED_DATE = daysFromFixtureNow(-5);
  const PAST_RETARGET_DATE = daysFromFixtureNow(-2);

  function buildEditFixtureData(): CoachMeetingsData {
    return {
      rows: [
        {
          eventId: 'event-edit-fixture',
          title: 'Edit Fixture Meeting',
          locationName: 'Robotics Lab',
          teamScopeLabel: 'All teams',
          sessions: [
            {
              sessionId: 'sess-edit-reconcilable',
              sessionDate: RECONCILABLE_DATE,
              ...chicagoEveningSession(RECONCILABLE_DATE),
              status: 'scheduled',
              durationHours: 2,
              expectedCt: 3,
              attendanceSummary: null,
              attendeeNames: [],
              notes: 'Bring extra batteries.',
            },
            {
              sessionId: 'sess-edit-sibling',
              sessionDate: SIBLING_DATE,
              ...chicagoEveningSession(SIBLING_DATE),
              status: 'scheduled',
              durationHours: 2,
              expectedCt: 2,
              attendanceSummary: null,
              attendeeNames: [],
              notes: '',
            },
            {
              sessionId: 'sess-edit-past-scheduled',
              sessionDate: PAST_SCHEDULED_DATE,
              ...chicagoEveningSession(PAST_SCHEDULED_DATE),
              status: 'scheduled',
              durationHours: 2,
              expectedCt: 0,
              attendanceSummary: null,
              attendeeNames: [],
              notes: '',
            },
            {
              sessionId: 'sess-edit-completed',
              sessionDate: COMPLETED_DATE,
              ...chicagoEveningSession(COMPLETED_DATE),
              status: 'completed',
              durationHours: 2,
              expectedCt: 4,
              attendanceSummary: { presentCt: 4, lateCt: 0, excusedCt: 0, absentCt: 0 },
              attendeeNames: ['Riley Doe'],
              notes: '',
            },
            {
              sessionId: 'sess-edit-canceled',
              sessionDate: CANCELED_DATE,
              ...chicagoEveningSession(CANCELED_DATE),
              status: 'canceled',
              durationHours: 2,
              expectedCt: 0,
              attendanceSummary: null,
              attendeeNames: [],
              notes: '',
            },
          ],
        },
      ],
      teams: [],
    };
  }

  function setNativeTextAreaValue(textarea: HTMLTextAreaElement, value: string): void {
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value',
    )?.set;
    setter?.call(textarea, value);
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
  }

  function formatLongDateForAssertion(isoDate: string): string {
    const [year, month, day] = isoDate.split('-').map(Number);
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(year, month - 1, day));
  }

  function formatTime12hForAssertion(isoTime: string): string {
    const [hourStr, minuteStr] = isoTime.split(':');
    const hour = Number(hourStr);
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const meridiem = hour < 12 ? 'AM' : 'PM';
    return `${hour12}:${minuteStr} ${meridiem}`;
  }

  /** GAM-452 -- `SessionRow.tsx`'s own Edit button reads plain "Edit" (no
   * date suffix, no `isMeetingSessionReconcilable` gate -- that gate lived
   * only in the now-deleted `CoachMeetingSessionRow`). Scoped to the target
   * session's own row via `findButtonInSessionRow`, not a global text
   * search. */
  function clickEdit(sessionDate: string): void {
    const editButton = findButtonInSessionRow(sessionDate, 'Edit');
    expect(editButton).toBeTruthy();
    clickButton(editButton as HTMLButtonElement);
  }

  function findEditSessionDialogElement(): HTMLElement | undefined {
    return Array.from(document.querySelectorAll('dialog')).find((dialog) =>
      dialog.textContent?.includes('Edit session'),
    );
  }

  function findButtonInEditSessionDialog(text: string): HTMLButtonElement | undefined {
    return Array.from(findEditSessionDialogElement()?.querySelectorAll('button') ?? []).find(
      (button) => button.textContent?.trim() === text,
    );
  }

  // GAM-452 -- REMOVED (surface gone, not turned red): the old test 2
  // asserted the Edit affordance was gated by `isMeetingSessionReconcilable`
  // per session. `SessionRow.tsx` (frozen, merged GAM-448) renders its own
  // "Edit" button unconditionally whenever `onEditSession` is supplied,
  // regardless of session status/reconcilability -- that gate has no home
  // in the new, already-shipped, checker-approved component. This is a
  // disclosed, genuine architecture change forced by composing with a
  // frozen sibling, not an oversight; see this ticket's own completion
  // report.

  it('test 3: clicking Edit opens the dialog prefilled with the real session’s own date/time/notes', async () => {
    renderAsUser(COACH_USER, { loadCoachData: () => Promise.resolve(buildEditFixtureData()) });
    await flushMicrotasks();
    selectCard('Edit Fixture Meeting');
    clickEdit(RECONCILABLE_DATE);

    expect(findEditSessionDialogElement()?.hasAttribute('open')).toBe(true);
    expect(container.textContent).toContain('Edit Fixture Meeting');

    expect((getFieldControl('Session date') as HTMLInputElement).value).toBe(
      formatLongDateForAssertion(RECONCILABLE_DATE),
    );
    expect((getFieldControl('Session start time') as HTMLInputElement).value).toBe(
      formatTime12hForAssertion('18:00'),
    );
    expect((getFieldControl('Session end time') as HTMLInputElement).value).toBe(
      formatTime12hForAssertion('20:00'),
    );
    expect((getFieldControl('Session notes') as HTMLTextAreaElement).value).toBe(
      'Bring extra batteries.',
    );
  });

  it('test 4: saving a valid change calls onSaveMeetingSession with the exact payload, then reloads and shows success', async () => {
    const onSaveMeetingSession = vi.fn().mockResolvedValue(undefined);
    let loadCallCount = 0;
    const loadCoachData = (): Promise<CoachMeetingsData> => {
      loadCallCount += 1;
      return Promise.resolve(buildEditFixtureData());
    };
    renderAsUser(COACH_USER, { loadCoachData, onSaveMeetingSession });
    await flushMicrotasks();
    selectCard('Edit Fixture Meeting');
    clickEdit(RECONCILABLE_DATE);

    const dateInput = getFieldControl('Session date') as HTMLInputElement;
    act(() => {
      setNativeInputValue(dateInput, FREE_DATE);
    });
    const notesArea = getFieldControl('Session notes') as HTMLTextAreaElement;
    act(() => {
      setNativeTextAreaValue(notesArea, 'Updated notes for this session.');
    });

    expect(onSaveMeetingSession).not.toHaveBeenCalled();
    clickButton(findButtonInEditSessionDialog('Save changes') as HTMLButtonElement);
    await flushMicrotasks();

    expect(onSaveMeetingSession).toHaveBeenCalledTimes(1);
    const payload = onSaveMeetingSession.mock.calls[0][0] as SaveMeetingSessionPayload;
    expect(payload).toEqual({
      sessionId: 'sess-edit-reconcilable',
      sessionDate: FREE_DATE,
      startsAt: chicagoWallTimeToUtcIso(FREE_DATE, '18:00'),
      endsAt: chicagoWallTimeToUtcIso(FREE_DATE, '20:00'),
      notes: 'Updated notes for this session.',
    });

    expect(loadCallCount).toBe(2);
    expect(container.textContent).toContain('Meeting session updated');
  });

  it('test 5: a candidate startsAt that lands in the past disables Save with an inline message; a future value re-enables it', async () => {
    renderAsUser(COACH_USER, { loadCoachData: () => Promise.resolve(buildEditFixtureData()) });
    await flushMicrotasks();
    selectCard('Edit Fixture Meeting');
    clickEdit(RECONCILABLE_DATE);

    const saveButton = (): HTMLButtonElement =>
      findButtonInEditSessionDialog('Save changes') as HTMLButtonElement;
    expect(saveButton().disabled).toBe(false);

    const dateInput = getFieldControl('Session date') as HTMLInputElement;
    act(() => {
      setNativeInputValue(dateInput, PAST_RETARGET_DATE);
    });
    expect(saveButton().disabled).toBe(true);
    expect(container.textContent).toContain('This start time has already passed.');

    act(() => {
      setNativeInputValue(dateInput, FREE_DATE);
    });
    expect(saveButton().disabled).toBe(false);
  });

  it('test 6: an end time at or before the computed start time disables Save with an inline message', async () => {
    renderAsUser(COACH_USER, { loadCoachData: () => Promise.resolve(buildEditFixtureData()) });
    await flushMicrotasks();
    selectCard('Edit Fixture Meeting');
    clickEdit(RECONCILABLE_DATE);

    const saveButton = (): HTMLButtonElement =>
      findButtonInEditSessionDialog('Save changes') as HTMLButtonElement;
    expect(saveButton().disabled).toBe(false);

    const endTimeInput = getFieldControl('Session end time') as HTMLInputElement;
    act(() => {
      setNativeInputValue(endTimeInput, '6:00 PM');
    });
    expect(saveButton().disabled).toBe(true);
    expect(container.textContent).toContain('End time must be after the start time.');
  });

  it('test 7: retargeting onto a sibling session’s existing date is rejected; retargeting onto a free date succeeds', async () => {
    renderAsUser(COACH_USER, { loadCoachData: () => Promise.resolve(buildEditFixtureData()) });
    await flushMicrotasks();
    selectCard('Edit Fixture Meeting');
    clickEdit(RECONCILABLE_DATE);

    const saveButton = (): HTMLButtonElement =>
      findButtonInEditSessionDialog('Save changes') as HTMLButtonElement;
    const dateInput = getFieldControl('Session date') as HTMLInputElement;

    act(() => {
      setNativeInputValue(dateInput, SIBLING_DATE);
    });
    expect(saveButton().disabled).toBe(true);
    expect(container.textContent).toContain(
      'Another session in this series is already scheduled on this date.',
    );

    act(() => {
      setNativeInputValue(dateInput, FREE_DATE);
    });
    expect(saveButton().disabled).toBe(false);
  });

  it('test 8: "Cancel this meeting" inside the edit dialog reuses the existing cancelTarget/AlertDialog seam', async () => {
    const onCancelSession = vi.fn().mockResolvedValue(undefined);
    renderAsUser(COACH_USER, {
      loadCoachData: () => Promise.resolve(buildEditFixtureData()),
      onCancelSession,
    });
    await flushMicrotasks();
    selectCard('Edit Fixture Meeting');
    clickEdit(RECONCILABLE_DATE);

    clickButton(findButtonByText('Cancel this meeting') as HTMLButtonElement);

    expect(document.body.textContent).toContain(
      `Cancel "Edit Fixture Meeting" on ${formatWeekdayDate(RECONCILABLE_DATE)}?`,
    );
    const confirmButton = findButtonInDialogByTitle(
      `Cancel "Edit Fixture Meeting" on ${formatWeekdayDate(RECONCILABLE_DATE)}?`,
      'Cancel session',
    );
    expect(confirmButton).toBeTruthy();
    clickButton(confirmButton as HTMLButtonElement);
    await flushMicrotasks();

    expect(onCancelSession).toHaveBeenCalledTimes(1);
    expect(onCancelSession).toHaveBeenCalledWith('sess-edit-reconcilable');
  });
});

// ---------------------------------------------------------------------------
// T511 -- the live console's entry point. GAM-452 §4/§9c: the link is now
// rendered by `CoachMeetingsView` itself, beside the selected card's
// drill-out panel (packet §8.2's own least-confident-decision record), not
// inside `SessionRow.tsx` (frozen, renders none). `selectCard` replaces
// `expandRow` -- clicking a card's "View full schedule" reveals its own
// "Live console" section without needing any per-session expand click,
// since the Go-live link is not gated behind `SessionRow`'s own
// Expand/Collapse toggle.
// ---------------------------------------------------------------------------

const T511_ROW: CoachMeetingsData = {
  rows: [
    {
      eventId: 'event-t511',
      title: 'Build Night',
      locationName: 'Robotics Lab',
      teamScopeLabel: 'All teams',
      sessions: [
        {
          sessionId: 'sess-live-1',
          sessionDate: '2026-09-02',
          startsAt: '2026-09-02T18:00:00.000Z',
          endsAt: '2026-09-02T20:00:00.000Z',
          status: 'scheduled',
          durationHours: 2,
          expectedCt: 3,
          attendanceSummary: null,
          attendeeNames: [],
        },
        // The one every T511 assertion targets. Distinct id AND distinct
        // date: the id makes "points at THIS session" falsifiable, the date
        // makes the two links' accessible names differ (C4).
        {
          sessionId: 'sess-live-2',
          sessionDate: '2026-09-09',
          startsAt: '2026-09-09T18:00:00.000Z',
          endsAt: '2026-09-09T20:00:00.000Z',
          status: 'scheduled',
          durationHours: 2,
          expectedCt: 4,
          attendanceSummary: null,
          attendeeNames: [],
        },
        {
          sessionId: 'sess-done',
          sessionDate: '2026-08-26',
          startsAt: '2026-08-26T18:00:00.000Z',
          endsAt: '2026-08-26T20:00:00.000Z',
          status: 'completed',
          durationHours: 2,
          expectedCt: 5,
          attendanceSummary: { presentCt: 5, lateCt: 0, excusedCt: 0, absentCt: 0 },
          attendeeNames: ['Ada L.'],
        },
        {
          sessionId: 'sess-scrapped',
          sessionDate: '2026-08-19',
          startsAt: '2026-08-19T18:00:00.000Z',
          endsAt: '2026-08-19T20:00:00.000Z',
          status: 'canceled',
          durationHours: 2,
          expectedCt: 6,
          attendanceSummary: null,
          attendeeNames: [],
        },
      ],
    },
  ],
  teams: [],
};

/** Every "Go live" anchor currently in the DOM, as {href, accessibleName}. */
function goLiveLinks(): { href: string; name: string }[] {
  return Array.from(document.querySelectorAll('a'))
    .filter((a) => (a.textContent ?? '').includes('Go live'))
    .map((a) => ({ href: a.getAttribute('href') ?? '', name: a.textContent ?? '' }));
}

describe('T511 -- live console entry point (coach session row)', () => {
  it('C1: a scheduled session links to /meetings/live/<that session’s own id>', async () => {
    renderAsUser(COACH_USER, { loadCoachData: () => Promise.resolve(T511_ROW) });
    await flushMicrotasks();
    selectCard('Build Night');

    const links = goLiveLinks();
    expect(links).toHaveLength(2);

    // The SECOND scheduled session, asserted against its own id -- not the
    // first, and not merely "some /meetings/live/ href exists".
    const second = links[1];
    expect(second.href).toBe('/meetings/live/sess-live-2');
    // And the first is genuinely a different target, so a single shared or
    // hardcoded href cannot satisfy both.
    expect(links[0].href).toBe('/meetings/live/sess-live-1');
  });

  it('C2: completed and canceled sessions get no Go live link', async () => {
    renderAsUser(COACH_USER, { loadCoachData: () => Promise.resolve(T511_ROW) });
    await flushMicrotasks();
    selectCard('Build Night');

    const hrefs = goLiveLinks().map((l) => l.href);
    // Both non-scheduled sessions render in the panel (proving the absence
    // is a status decision, not an absent fixture) -- their row headers are
    // visible without expanding.
    expect(container.textContent).toContain('Completed');
    expect(container.textContent).toContain('Canceled');
    // ... and neither contributes a live-console link.
    expect(hrefs).not.toContain('/meetings/live/sess-done');
    expect(hrefs).not.toContain('/meetings/live/sess-scrapped');
  });

  // §9c -- corrected: the danger is a VACUOUS green, not a red. Phase 1
  // proves this exact fixture + the new card-select interaction DOES
  // produce Go-live links when given a coach role (so `selectCard` is a
  // real, working mechanism against this fixture, not a broken selector
  // that would silently pass phase 2 for the wrong reason -- the exact
  // failure this test's own history already records, see the module doc
  // above). Phase 2 is the actual regression check: the SAME fixture,
  // rendered as a student/parent, must produce zero.
  it('C3: the student/parent view renders no Go live link at all', async () => {
    // Phase 1 -- coach role, same fixture: prove the mechanism works.
    renderAsUser(COACH_USER, { loadCoachData: () => Promise.resolve(T511_ROW) });
    await flushMicrotasks();
    selectCard('Build Night');
    expect(container.textContent).toContain('Build Night');
    expect(goLiveLinks().length).toBeGreaterThan(0);

    // Remount fresh for phase 2 (a real new render, not a leftover coach DOM
    // tree that phase 2's assertions could accidentally read from).
    act(() => {
      root.unmount();
    });
    container.remove();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    // Phase 2 -- student/parent role. BOTH loaders are supplied, and that is
    // the whole point: if the role gate ever widens, this student really
    // would be handed a rendered coach row (the coach fixture just proved,
    // in phase 1, that it renders real links when it can).
    renderAsUser(STUDENT_OR_PARENT_USER, {
      resolveStudentId: fakeResolveStudentId('student-fixture'),
      resolveStudentIsActive: fakeResolveStudentIsActive(true),
      loadStudentData: () => Promise.resolve({ history: [], participation: null }),
      loadCoachData: () => Promise.resolve(T511_ROW),
    });
    await flushMicrotasks();
    await flushMicrotasks();

    // Proves this really is a rendered student page, not a blank/crashed
    // one, before asserting the interesting negative.
    expect(container.textContent?.length ?? 0).toBeGreaterThan(0);
    expect(goLiveLinks()).toHaveLength(0);
    expect(container.textContent).not.toContain('Go live');
  });

  it('C4: each link’s accessible name is unique within one event', async () => {
    renderAsUser(COACH_USER, { loadCoachData: () => Promise.resolve(T511_ROW) });
    await flushMicrotasks();
    selectCard('Build Night');

    const names = goLiveLinks().map((l) => l.name);
    expect(names).toHaveLength(2);
    // Astryx forbids `label` on a text link, so the visible text IS the
    // accessible name. Two links both reading "Go live" would be two
    // indistinguishable targets to a screen reader.
    expect(new Set(names).size).toBe(2);
    expect(names[1]).toContain('Sep 9');
  });
});

// ---------------------------------------------------------------------------
// GAM-452 -- composition, focus wiring, subtitle, overlap (packet §7,
// acceptance criteria 1/2/3/4/8). Fixtures below are hand-built (not the
// July-2026 `FIXTURE_*` data) so their dates can be pinned relative to a
// fake clock, matching criterion 4's own instruction ("fixtures are
// absolute July 2026, so 'next 7 days' is 0 under a real clock").
// ---------------------------------------------------------------------------

describe('GAM-452 -- composition, focus wiring, subtitle, overlap', () => {
  const NOW = new Date('2026-07-20T12:00:00.000Z');

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'], now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /** Two series, one session each, on the SAME Chicago calendar day with
   * genuinely overlapping times (4-6 PM and 5-7 PM Chicago) -- a real
   * cross-series overlap pair for criterion 8. Both sessions also fall
   * inside the rail's default 5-day agenda window (`NOW` + 2 days). */
  function buildOverlapFixture(): CoachMeetingsData {
    return {
      rows: [
        {
          eventId: 'event-alpha',
          title: 'Alpha Squad',
          locationName: 'Robotics Lab',
          teamScopeLabel: 'All teams',
          sessions: [
            {
              sessionId: 'sess-alpha',
              sessionDate: '2026-07-22',
              startsAt: '2026-07-22T21:00:00.000Z', // 4 PM Chicago
              endsAt: '2026-07-22T23:00:00.000Z', // 6 PM Chicago
              status: 'scheduled',
              durationHours: 2,
              expectedCt: 3,
              attendanceSummary: null,
              attendeeNames: [],
            },
          ],
        },
        {
          eventId: 'event-beta',
          title: 'Beta Squad',
          locationName: 'Robotics Lab',
          teamScopeLabel: 'All teams',
          sessions: [
            {
              sessionId: 'sess-beta',
              sessionDate: '2026-07-22',
              startsAt: '2026-07-22T22:00:00.000Z', // 5 PM Chicago
              endsAt: '2026-07-23T00:00:00.000Z', // 7 PM Chicago
              status: 'scheduled',
              durationHours: 2,
              expectedCt: 2,
              attendanceSummary: null,
              attendeeNames: [],
            },
          ],
        },
      ],
      teams: [],
    };
  }

  // Criterion 1 + item 15 (BLOCKER) -- a keyboard-path/focus failure on this
  // core flow. Clicks a rail agenda item and asserts: the owning card is
  // selected (`aria-current` on its "View full schedule" button,
  // `SeriesCard.tsx`'s own contract), the panel opened with that session's
  // row visible, AND real programmatic focus landed on the drill-out
  // wrapper (not merely scrolled) -- `document.activeElement`, paired with
  // the local `scrollIntoView` stub declared at the top of this file.
  it('criterion 1: a rail agenda click selects the owning card, opens the panel, and moves real focus (not just scroll)', async () => {
    renderAsUser(COACH_USER, { loadCoachData: () => Promise.resolve(buildOverlapFixture()) });
    await flushMicrotasks();

    // Before selection: no card carries `aria-current`.
    expect(document.querySelector('[aria-current="true"]')).toBeNull();

    const agendaItem = Array.from(container.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Alpha Squad'),
    );
    expect(agendaItem).toBeTruthy();
    clickButton(agendaItem as HTMLButtonElement);

    // The owning card is now selected.
    const selectedButton = document.querySelector('[aria-current="true"]');
    expect(selectedButton).toBeTruthy();
    expect(selectedButton?.textContent).toContain('View full schedule');

    // The panel opened for Alpha Squad's own session.
    expect(container.textContent).toContain('Wed, Jul 22');

    // Real programmatic focus landed on the drill-out wrapper, not merely a
    // scroll -- `document.activeElement` is the tabIndex={-1} panel root
    // (the wrapper around `<SchedulePanel>` + the "Live console" section;
    // the card's own title lives in a sibling element, not inside it).
    expect(document.activeElement).not.toBe(document.body);
    expect(document.activeElement?.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement?.textContent).toContain('Wed, Jul 22');
    expect(document.activeElement?.textContent).toContain('Live console');
  });

  // Criterion 2 -- `MeetingsRail` receives real `seasonStartsOn`/
  // `seasonEndsOn` when the season is `'ready'`. Proven via `Calendar`'s own
  // documented `min` behavior (`isDisabled={!canNavigatePrevious}` on its
  // "Previous month" button, `Calendar.tsx:312-322`): with a season starting
  // September 2026 and `NOW` re-pinned inside that month, "Previous month"
  // is disabled at mount ONLY if the real season bound reached `Calendar`,
  // not the session-span fallback (a session exists in August).
  it('criterion 2a: MeetingsRail receives real seasonStartsOn/seasonEndsOn when the season is ready', async () => {
    vi.setSystemTime(new Date('2026-09-15T12:00:00.000Z'));
    const season: SeasonRow = {
      id: 'season-fixture',
      name: 'Fixture Season',
      startsOn: '2026-09-01',
      endsOn: '2026-09-30',
      defaultGoalHours: 0,
      isActive: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    const rowsWithAugustSession: CoachMeetingsData = {
      rows: [
        {
          eventId: 'event-bounds',
          title: 'Bounds Check',
          locationName: 'Robotics Lab',
          teamScopeLabel: 'All teams',
          sessions: [
            {
              sessionId: 'sess-bounds-aug',
              sessionDate: '2026-08-05',
              startsAt: '2026-08-05T23:00:00.000Z',
              endsAt: '2026-08-06T01:00:00.000Z',
              status: 'scheduled',
              durationHours: 2,
              expectedCt: 0,
              attendanceSummary: null,
              attendeeNames: [],
            },
          ],
        },
      ],
      teams: [],
    };
    renderAsUser(
      COACH_USER,
      { loadCoachData: () => Promise.resolve(rowsWithAugustSession) },
      async () => season,
    );
    await flushMicrotasks();

    // Scoped to `.meetings-rail` -- `ScheduleMeetingsDialog`'s own always-
    // mounted date picker also renders a `Calendar` with its own "Previous
    // month" button, unrelated to this one.
    const rail = container.querySelector('.meetings-rail');
    expect(rail).toBeTruthy();
    const prevButton = Array.from(rail?.querySelectorAll('button') ?? []).find(
      (b) => b.getAttribute('aria-label') === 'Previous month',
    );
    expect(prevButton).toBeTruthy();
    // Disabled -- `min` is September (the real `seasonStartsOn`), not
    // August (the earliest session, which the fallback would have used).
    expect((prevButton as HTMLButtonElement).disabled).toBe(true);
  });

  it('criterion 2b: MeetingsRail falls back to the session-span bound when the season is not ready', async () => {
    vi.setSystemTime(new Date('2026-09-15T12:00:00.000Z'));
    const rowsWithAugustSession: CoachMeetingsData = {
      rows: [
        {
          eventId: 'event-bounds',
          title: 'Bounds Check',
          locationName: 'Robotics Lab',
          teamScopeLabel: 'All teams',
          sessions: [
            {
              sessionId: 'sess-bounds-aug',
              sessionDate: '2026-08-05',
              startsAt: '2026-08-05T23:00:00.000Z',
              endsAt: '2026-08-06T01:00:00.000Z',
              status: 'scheduled',
              durationHours: 2,
              expectedCt: 0,
              attendanceSummary: null,
              attendeeNames: [],
            },
          ],
        },
      ],
      teams: [],
    };
    // Default `loadActiveSeason` resolves `null` -- status `'none'`.
    renderAsUser(COACH_USER, { loadCoachData: () => Promise.resolve(rowsWithAugustSession) });
    await flushMicrotasks();

    // Scoped to `.meetings-rail` -- `ScheduleMeetingsDialog`'s own always-
    // mounted date picker also renders a `Calendar` with its own "Previous
    // month" button, unrelated to this one.
    const rail = container.querySelector('.meetings-rail');
    expect(rail).toBeTruthy();
    const prevButton = Array.from(rail?.querySelectorAll('button') ?? []).find(
      (b) => b.getAttribute('aria-label') === 'Previous month',
    );
    expect(prevButton).toBeTruthy();
    // Enabled -- with no `seasonStartsOn`, `min` falls back to August (the
    // earliest real session), which is before the visible month.
    expect((prevButton as HTMLButtonElement).disabled).toBe(false);
  });

  // Criterion 3 -- Active/Finished tabs reuse `partitionCoachMeetingRows`
  // (unit-tested directly in `coachModel.test.ts`); this integration test
  // proves the renamed buckets show the right counts on the real page.
  it('criterion 3: Active/Finished tab counts reflect partitionCoachMeetingRows', async () => {
    const mixed: CoachMeetingsData = {
      rows: [
        {
          eventId: 'event-active',
          title: 'Still Going',
          locationName: 'Robotics Lab',
          teamScopeLabel: 'All teams',
          sessions: [
            {
              sessionId: 'sess-active',
              sessionDate: '2026-07-22',
              startsAt: '2026-07-22T23:00:00.000Z',
              endsAt: '2026-07-23T01:00:00.000Z',
              status: 'scheduled',
              durationHours: 2,
              expectedCt: 0,
              attendanceSummary: null,
              attendeeNames: [],
            },
          ],
        },
        {
          eventId: 'event-finished',
          title: 'All Done',
          locationName: 'Robotics Lab',
          teamScopeLabel: 'All teams',
          sessions: [
            {
              sessionId: 'sess-finished',
              sessionDate: '2026-07-08',
              startsAt: '2026-07-08T23:00:00.000Z',
              endsAt: '2026-07-09T01:00:00.000Z',
              status: 'completed',
              durationHours: 2,
              expectedCt: 0,
              attendanceSummary: { presentCt: 1, lateCt: 0, excusedCt: 0, absentCt: 0 },
              attendeeNames: [],
            },
          ],
        },
      ],
      teams: [],
    };
    renderAsUser(COACH_USER, { loadCoachData: () => Promise.resolve(mixed) });
    await flushMicrotasks();

    expect(container.textContent).toContain('Active (1)');
    expect(container.textContent).toContain('Finished (1)');
    // "Still Going" (has a scheduled session) is visible by default.
    expect(container.textContent).toContain('Still Going');
    expect(container.textContent).not.toContain('All Done');
  });

  // Criterion 4 -- plain counts, Chicago calendar days, no countdown/urgency
  // copy (item 17, BLOCKER). `NOW` is pinned to 2026-07-20; the default
  // `FIXTURE_SESSIONS` scheduled session (2026-07-22) falls inside the next
  // 7 days from that anchor.
  it('criterion 4: subtitle renders real "N active series · M sessions in the next 7 days" counts', async () => {
    renderAsUser(COACH_USER, { loadCoachData: defaultLoadCoachMeetingsData });
    await flushMicrotasks();

    // Both fixture events have a still-scheduled session -> both Active.
    // Both scheduled sessions (2026-07-22, 2026-07-25) fall within
    // [2026-07-20, 2026-07-26] -- 2 sessions in the next 7 days.
    expect(container.textContent).toContain('2 active series · 2 sessions in the next 7 days');
  });

  // Criterion 8 (rewritten, §9e) -- three badge sites, no page-level
  // overlap-specific copy. Every leaf DOM text node containing "overlap"
  // must match one of the three known badge shapes exactly -- a mechanical
  // check, not a `Banner`-absence assertion (feedback/DES-12 banners are
  // legitimate, `:1582-1590`).
  it('criterion 8: overlap badges render at exactly three sites, no page-level overlap banner copy', async () => {
    renderAsUser(COACH_USER, { loadCoachData: () => Promise.resolve(buildOverlapFixture()) });
    await flushMicrotasks();

    // Site 1 -- the series card's own count badge.
    expect(container.textContent).toContain('1 overlap');

    // Site 3 -- the rail's agenda item badge (both sessions fall inside the
    // default 5-day agenda window from `NOW`).
    const agendaButtons = Array.from(container.querySelectorAll('button')).filter(
      (b) => b.textContent?.includes('Alpha Squad') || b.textContent?.includes('Beta Squad'),
    );
    expect(agendaButtons.some((b) => b.textContent?.includes('overlap'))).toBe(true);

    // Site 2 -- the session row's own badge, inside the selected card's
    // drill-out panel.
    selectCard('Alpha Squad');
    expect(container.textContent).toContain('Overlap');

    // Mechanical check: every leaf text node mentioning "overlap" is one of
    // the three known badge shapes, never free-standing sentence copy (no
    // page-level banner, `meetings-design` skill's own owner ruling).
    const overlapLeafTexts = Array.from(container.querySelectorAll('*'))
      .filter((el) => el.children.length === 0)
      .map((el) => (el.textContent ?? '').trim())
      .filter((text) => /overlap/i.test(text));
    expect(overlapLeafTexts.length).toBeGreaterThan(0);
    for (const text of overlapLeafTexts) {
      expect(text === 'Overlap' || /^\d+ overlap$/.test(text)).toBe(true);
    }
  });
});
