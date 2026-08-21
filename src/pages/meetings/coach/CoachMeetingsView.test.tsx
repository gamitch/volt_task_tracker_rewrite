// @vitest-environment jsdom
/**
 * Tests for `CoachMeetingsView.tsx`'s coach/admin role variant -- moved
 * verbatim out of `src/pages/meetings/MeetingsList.test.tsx` (GAM-444 Stage
 * C), same assertions, same test names, only the import path/location
 * changed (GAM-444 packet criterion 2). Renders through `<MeetingsList />`
 * (imported from `../MeetingsList`, the shell) exactly as before the split
 * -- these are role-variant integration tests (auth -> role switch ->
 * `CoachMeetingsView`), not isolated-component tests, and rewriting them to
 * mount `<CoachMeetingsView />` directly would be a behavior/assertion
 * change criterion 2 forbids.
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
import { LoginAs } from '../../../test-utils/authHarness';
import { MeetingsList, defaultLoadCoachMeetingsData, formatWeekdayDate } from '../MeetingsList';
import type { CoachMeetingsData, ResolveCurrentStudentIdFn } from '../../../lib/meetings/types';
import type { ResolveStudentIsActiveFn } from '../../../lib/supabase/loaders/students';
import { chicagoWallTimeToUtcIso } from '../ScheduleMeetingsDialog';
import type { CreateMeetingsPayload } from '../ScheduleMeetingsDialog';
import type { SaveMeetingSessionPayload } from '../EditMeetingSessionDialog';

// ---------------------------------------------------------------------------
// jsdom gap: `AlertDialog` renders a native `<dialog>` and calls
// `HTMLDialogElement.prototype.showModal()`, which this repo's installed
// jsdom (29.x) does not implement. Scoped to THIS test file's own jsdom
// global only (not `src/test-setup.ts`, outside this task's Allowed Files).
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

/** T511 -- `MemoryRouter` is required, not decorative: the coach session row now
 * renders a real `Link as={RouterLink}` to the live console, and `RouterLink`
 * throws `Cannot destructure property 'basename'` outside a router context.
 * Same wrapper `LiveConsole.test.tsx` and `CheckinResult.test.tsx` already use
 * for the same reason. It is additive -- every pre-existing assertion in this
 * file is unaffected by having a router in the tree. */
function renderAsUser(user: AuthUser, props: Parameters<typeof MeetingsList>[0] = {}): void {
  act(() => {
    root.render(
      <MemoryRouter>
        <AuthProvider>
          <LoginAs user={user}>
            <MeetingsList {...props} />
          </LoginAs>
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
// -- same helpers `ScheduleMeetingsDialog.test.tsx` (T031) already
// established (Astryx `Field` renders a real `<label htmlFor={id}>` for
// every labeled input; no testing-library `getByLabelText` equivalent is
// installed in this repo).
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

/** T135 (Table migration, Trap 1/2 of that task's own worker packet) --
 * expands a coach meeting row's session detail. Astryx's `Collapsible` used
 * to keep its content always mounted in the DOM (only CSS-hidden while
 * collapsed), so no click was ever needed to find session-detail text; row
 * splicing (the `Table` migration's mechanism) genuinely removes those rows
 * from the DOM until expanded, so a real click is now required. Finds the
 * expander by its accessible name (`Show session details – {title}` /
 * `Hide session details – {title}`) rather than its shared visible text
 * (`Session details (N)`, which is NOT unique across rows -- every row's
 * expander carries that same shape). */
function expandRow(eventTitle: string): void {
  const expander = Array.from(document.querySelectorAll('button')).find((button) =>
    button.getAttribute('aria-label')?.startsWith(`Show session details – ${eventTitle}`),
  );
  if (!expander) {
    throw new Error(`No expander button found for "${eventTitle}"`);
  }
  clickButton(expander);
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
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// <MeetingsList /> -- coach view, all four DES-12 states
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
    // DES-15 verbatim (PRD line 212, T083).
    expect(container.textContent).toContain('No meetings scheduled.');
    expect(container.textContent).toContain(
      'Set up your weekly build meetings once and check-in takes care of itself.',
    );
  });

  it('populated state: Upcoming/Past sections, status badges, team scope, dates, NAV-07 exclusion', async () => {
    renderAsUser(COACH_USER, { loadCoachData: defaultLoadCoachMeetingsData });
    await flushMicrotasks();

    expect(container.textContent).toContain('Weekly Build Meeting');
    expect(container.textContent).toContain('Ravens Strategy Session');
    expect(container.textContent).toContain('All teams');
    expect(container.textContent).toContain('Ravens');
    // T135 (Table migration) Trap 1, authorized: the hours `StatCell`'s own
    // label is literally the word "Scheduled" -- this assertion survives
    // only because §1 of that task's packet pins that label; it is not
    // independent proof of a session-status badge (see the expanded
    // assertions below for that).
    expect(container.textContent).toContain('Scheduled');
    // "Completed" survives via the Past section's own `EmptyState`
    // description ("Completed and canceled meetings will show up here.") --
    // by luck rather than design (T135 packet Trap 1), since this fixture's
    // Past bucket is empty. Not relied upon as proof of a session badge.
    expect(container.textContent).toContain('Completed');

    // T135 (Table migration) Trap 1: row splicing means a session's own
    // status badge ("Canceled") and its attendance summary ("present") only
    // exist in the DOM once this row's expander has been clicked -- unlike
    // the old `Collapsible`, whose content stayed mounted (CSS-hidden, not
    // removed) even while collapsed.
    expandRow('Weekly Build Meeting');
    expect(container.textContent).toContain('Canceled');
    expect(container.textContent).toContain('present');
    expect(container.textContent).toContain('Schedule meetings');

    // NAV-07: outreach content must never appear.
    expect(container.textContent).not.toContain('Community Food Drive');
  });

  // T122 (UXD-02 density standard) -- date/recurrence chips, location,
  // planned/logged hours, expected/attended counts all render on the row.
  it('renders UXD-02 dense-row fields: recurrence chip, date range, location, planned/logged hours, expected/attended', async () => {
    renderAsUser(COACH_USER, { loadCoachData: defaultLoadCoachMeetingsData });
    await flushMicrotasks();

    // "Weekly Build Meeting" has 3 sessions, all on Wednesdays.
    expect(container.textContent).toContain('WED (3)');
    expect(container.textContent).toContain('Wed, Jul 8 – Wed, Jul 22');
    expect(container.textContent).toContain('Robotics Lab');
    // T135 (Table migration) Trap 3, authorized: `StatCell` renders its
    // label and value with NO separator (`StatCell.tsx:56-61`; its own test
    // pins "Planned3h") and its `secondary` tier as its own separate line --
    // the old single-run "4h scheduled · 2h held" string no longer exists as
    // one run of text. Same real numbers (planned = scheduled 2h + completed
    // 2h = 4h, canceled excluded; logged = completed only = 2h), asserted in
    // their new per-cell homes instead of weakened to a substring-of-anything
    // check.
    expect(container.textContent).toContain('Scheduled4h');
    expect(container.textContent).toContain('2h held');
    // expected = session-upcoming-build's 5 'going' RSVPs; attended =
    // session-past-build-completed's 3 present + 1 late. Same split reason.
    expect(container.textContent).toContain('Expected5');
    expect(container.textContent).toContain('Attended 4');

    // "Ravens Strategy Session" has 2 sessions, both on Saturdays.
    expect(container.textContent).toContain('SAT (2)');
    expect(container.textContent).toContain('Ravens Team Room');
    expect(container.textContent).toContain('Scheduled3h');
    expect(container.textContent).toContain('1.5h held');
    expect(container.textContent).toContain('Expected2');
    expect(container.textContent).toContain('Attended 3');

    // UXD-03: expander trigger text is always visible (it is the `Button`'s
    // own children, not conditionally-rendered `Collapsible` content), so no
    // click is needed for these two.
    expect(container.textContent).toContain('Session details (3)');
    expect(container.textContent).toContain('Session details (2)');
    // T135 (Table migration) Trap 1, authorized: unlike the old `Collapsible`
    // (content always mounted, only CSS-hidden while collapsed), row
    // splicing genuinely removes a session-detail row from the DOM until its
    // parent row's expander is clicked -- the attendee-names line lives
    // inside that spliced-in row.
    expandRow('Weekly Build Meeting');
    expect(container.textContent).toContain('Attended: Alex Rivera, Bailey Chen, Casey Nguyen');
  });

  // -------------------------------------------------------------------------
  // T129/UXC-01: one heading per section. `CoachMeetingsSection`'s own
  // `List`'s `header` prop was removed (it used to print "Upcoming
  // meetings"/"Past meetings" a second time, per `List.tsx:194-201`); its
  // `Heading` now carries a `useId`-generated id, and a
  // `<div role="group">` wrapping the List/EmptyState ternary carries
  // `aria-labelledby={headingId}` -- present in BOTH branches, so the
  // region's accessible name survives even when there is no `List` to
  // attach a `header` to.
  //
  // CHECKER FIX (rework of T129, MAJOR): the wrapper was originally an
  // Astryx `Section`, which applies a full-bleed negative-margin band
  // unconditionally and renders a bare, role-less `<div>` that cannot
  // support `aria-labelledby` under ARIA. A plain `<div role="group">`
  // fixes both; the query below includes `role="group"` so a regression
  // back to a role-less wrapper fails the lookup itself, not just a later
  // assertion.
  // -------------------------------------------------------------------------
  describe('T129 UXC-01 -- exactly one heading per Upcoming/Past section', () => {
    function resolveAriaLabelledbyTarget(headingText: string): {
      headingId: string;
      resolvedText: string | null;
    } {
      const heading = Array.from(container.querySelectorAll('h2')).find(
        (h) => h.textContent === headingText,
      );
      expect(heading).toBeTruthy();
      const headingId = heading!.id;
      expect(headingId).toBeTruthy();
      const labelledEl = container.querySelector(`[role="group"][aria-labelledby="${headingId}"]`);
      expect(labelledEl).toBeTruthy();
      expect(labelledEl!.getAttribute('role')).toBe('group');
      const resolvedId = labelledEl!.getAttribute('aria-labelledby')!;
      const resolvedEl = document.getElementById(resolvedId);
      return { headingId, resolvedText: resolvedEl?.textContent ?? null };
    }

    it('populated branch: both "Upcoming" and "Past" resolve aria-labelledby back to their own Heading, printed exactly once', async () => {
      renderAsUser(COACH_USER, { loadCoachData: defaultLoadCoachMeetingsData });
      await flushMicrotasks();

      for (const title of ['Upcoming', 'Past']) {
        const { resolvedText } = resolveAriaLabelledbyTarget(title);
        expect(resolvedText).toBe(title);
        const leafMatches = Array.from(container.querySelectorAll('*')).filter(
          (el) => el.children.length === 0 && el.textContent === title,
        );
        expect(leafMatches.length).toBe(1);
      }
    });

    it('empty branch: "Upcoming" has no scheduled sessions -- its aria-labelledby still resolves to its Heading, even with no List rendered ("Past" stays populated in the same render)', async () => {
      const pastOnlyRow: CoachMeetingsData = {
        rows: [
          {
            eventId: 'event-past-only',
            title: 'Archived Strategy Session',
            locationName: 'Robotics Lab',
            teamScopeLabel: 'All teams',
            sessions: [
              {
                sessionId: 'session-past-only',
                sessionDate: '2026-01-05',
                startsAt: '2026-01-05T18:00:00.000Z',
                endsAt: '2026-01-05T20:00:00.000Z',
                status: 'completed',
                durationHours: 2,
                expectedCt: 0,
                attendanceSummary: { presentCt: 0, lateCt: 0, excusedCt: 0, absentCt: 0 },
                attendeeNames: [],
              },
            ],
          },
        ],
        teams: [],
      };
      renderAsUser(COACH_USER, { loadCoachData: () => Promise.resolve(pastOnlyRow) });
      await flushMicrotasks();

      // Confirm "Upcoming" really is the EmptyState branch (per its own
      // `emptyDescription`), not a load failure.
      expect(container.textContent).toContain('No meetings are currently scheduled.');
      expect(container.textContent).toContain('Archived Strategy Session');

      for (const title of ['Upcoming', 'Past']) {
        const { resolvedText } = resolveAriaLabelledbyTarget(title);
        expect(resolvedText).toBe(title);
      }
    });
  });

  // T096: "Schedule meetings" now opens the real `ScheduleMeetingsDialog`
  // (T031, already Passed) instead of showing the old "dialog not built yet"
  // stub -- that dialog genuinely IS built now (module doc #7a).
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

  // -------------------------------------------------------------------------
  // T147: the outreach/meetings team picker shows fixture teams to real
  // users -- the meetings half, "the one that actually blocks a core create
  // flow" (packet). `ScheduleMeetingsDialog`'s own `teams` prop now gets the
  // already-fetched `loaders/meetings.ts` teams (threaded through
  // `CoachMeetingsData`) instead of falling back to that dialog's own
  // `DEFAULT_TEAMS` fixture (`'team-ravens'`/`'team-titans'`, non-uuid
  // strings that fail the real `events.team_ids uuid[]` insert -- "Couldn't
  // create these meetings.").
  //
  // Create mode has no `initialData`/edit mode at all (module doc #7b) --
  // `allTeamIds` (derived straight from the `teams` prop) seeds
  // `selectedTeamIds` on open, so this dialog needs no edit-mode fixture
  // trick, unlike `OutreachEventDialog`'s edit-mode sites.
  //
  // Assertion mechanism -- UUID shape on the submitted payload, never a
  // name-based assertion (this file's own `FIXTURE_EVENTS`/`FIXTURE_TEAMS`
  // literally contain the text "Ravens" in unrelated fixture content --
  // `:737`/`:740` -- so a name-based assertion cannot discriminate here).
  // -------------------------------------------------------------------------
  it('T147: deselecting one team submits a teamIds array of real UUIDs from the teams prop, never the fixture strings', async () => {
    const onCreateMeetings = vi.fn().mockResolvedValue(undefined);
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    // UUID-shaped ids matching what the real `teams` table actually
    // produces (`teams.id uuid primary key`); fabricated names
    // (constitution item 6) -- never asserted on.
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

    // Title already defaults to a non-empty value (`DEFAULT_TITLE`,
    // `ScheduleMeetingsDialog.tsx`); only a date is needed for `isValid`.
    const dateInput = getFieldControl('Date') as HTMLInputElement;
    act(() => {
      setNativeInputValue(dateInput, '2026-08-05');
    });

    // Open the "Team scope" MultiSelector and deselect the LAST option in
    // its own listbox -- positional, not by label text (with the fix
    // reverted the injected UUID-fixture labels are absent, so a label
    // lookup would die with a harness-shaped failure instead of the UUID
    // mismatch this test exists to prove). Scoped to the trigger's own
    // `aria-controls` listbox. The last option is never the `hasSelectAll`
    // pseudo-option, which that component places FIRST.
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

  // T096 (module doc #7b, Trap #3 finding) -- Edit WAS left as an honest,
  // accurately-worded stub since `ScheduleMeetingsDialog` genuinely had no
  // edit mode, not the old misleading "dialog not built yet" copy.
  //
  // T135 (Table migration) §2, tenth authorized assertion change (on top of
  // Trap 1's nine): the row-level `MoreMenu` this test used to open no
  // longer exists (Edit is now a standalone chip, since Cancel already left
  // the menu for a per-session button under T122, leaving exactly one item
  // behind a menu). Before that rewrite, `moreMenuButton` resolved to
  // `undefined` (nothing has `aria-label^="Actions for Weekly Build
  // Meeting"` anymore), the optional-chained `?.dispatchEvent(...)` silently
  // no-opped, and a generic `el.textContent?.trim() === 'Edit'` search still
  // found the new Edit chip directly in the DOM (no menu-open needed) -- so
  // the test would have kept passing while asserting an affordance (open a
  // menu, click a menu item) that no longer existed. Rewritten then to find
  // and click the Edit chip directly, by its real accessible name.
  //
  // T510 UPDATE -- RE-DERIVED (boss ruling, `auto-mode-decisions.md`,
  // "2026-08-06 -- Boss ruling (constitution item 10): T510's test updates
  // are AUTHORIZED, with exact bounds"; precedent
  // `OutreachDetail.test.tsx:1058-1065`, stub -> real edit dialog). George
  // reversed the T096 decision this test encoded (`docs/swarm/
  // auto-mode-decisions.md`, "George closes out T510's design"):
  // `ScheduleMeetingsDialog.tsx` now has a real, additive edit mode
  // (`initialData`/`onSaveMeetingSeries`), so the honest-stub assertion this
  // test made is no longer true, and the ruling's Grant A six-property bar
  // governs its replacement below (re-derivation, NOT a deletion -- the Edit
  // affordance survives with new behavior).
  it('T510: Edit opens the real dialog in edit mode, prefilled from the clicked row (not the old stub)', async () => {
    // Grant A property 4 -- inherits the T096 stub's real duty: the edit
    // interaction, by itself, must never call the CREATE seam.
    const onCreateMeetings = vi.fn().mockResolvedValue(undefined);
    renderAsUser(COACH_USER, { loadCoachData: defaultLoadCoachMeetingsData, onCreateMeetings });
    await flushMicrotasks();

    // Grant A property 1 -- find the Edit control by its real accessible
    // name (en dash), same lookup the T135 rewrite already established.
    const editButton = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.getAttribute('aria-label')?.startsWith('Edit – Weekly Build Meeting'),
    );
    expect(editButton).toBeTruthy();
    clickButton(editButton as HTMLButtonElement);

    // Grant A property 2 -- prove edit mode by PREFILL, not by presence: the
    // real dialog is open with the edit-mode title AND Title/Location carry
    // the clicked row's own values (`FIXTURE_EVENTS`'s own
    // `event-weekly-build`: title 'Weekly Build Meeting', locationName
    // 'Robotics Lab') -- "a dialog opened" would pass against a mislabeled
    // create dialog; row-value prefill cannot.
    function findEditDialogElement(): HTMLElement | undefined {
      return Array.from(document.querySelectorAll('dialog')).find((dialog) =>
        dialog.textContent?.includes('Edit meeting series'),
      );
    }
    expect(findEditDialogElement()?.hasAttribute('open')).toBe(true);
    expect((getFieldControl('Title') as HTMLInputElement).value).toBe('Weekly Build Meeting');
    expect((getFieldControl('Location') as HTMLInputElement).value).toBe('Robotics Lab');

    // Grant A property 3 -- keep the negative space, widened by one: neither
    // the old stub copy nor its pre-T096 sibling ever appears.
    expect(container.textContent).not.toContain("Editing an existing meeting isn't supported yet");
    expect(container.textContent).not.toContain('not built yet');

    expect(onCreateMeetings).not.toHaveBeenCalled();
  });

  // T122 (module doc #10d) -- Cancel moved from the row's own MoreMenu into
  // a plain per-session `Button` inside that row's expander.
  //
  // T135 (Table migration) Trap 1, rewritten (was: "Collapsible content is
  // always in the DOM ... so no click needed" -- now FALSE): row splicing
  // (the `Table` migration's expansion mechanism) genuinely removes a
  // session-detail row from the DOM until its parent row's expander is
  // clicked, unlike `Collapsible`, which only CSS-hid its (always-mounted)
  // content. `expandRow` performs that click first.
  it('Cancel (inline, per-session) + AlertDialog (DES-11) really calls the injected onCancelSession mutation', async () => {
    const onCancelSession = vi.fn().mockResolvedValue(undefined);
    renderAsUser(COACH_USER, { loadCoachData: defaultLoadCoachMeetingsData, onCancelSession });
    await flushMicrotasks();

    // "Weekly Build Meeting" has exactly one still-scheduled session
    // (session-upcoming-build, 2026-07-22, a Wednesday).
    expandRow('Weekly Build Meeting');
    const cancelButton = findButtonByText('Cancel Wed, Jul 22 session');
    expect(cancelButton).toBeTruthy();
    clickButton(cancelButton as HTMLButtonElement);

    expect(document.body.textContent).toContain('Cancel "Weekly Build Meeting" on Wed, Jul 22?');

    const confirmButton = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Cancel session',
    );
    expect(confirmButton).toBeTruthy();
    clickButton(confirmButton as HTMLButtonElement);
    await flushMicrotasks();

    // T135 (Table migration) Trap 2: confirming the cancel means EVERY one
    // of "Weekly Build Meeting"'s sessions is now completed/canceled (none
    // still `scheduled`), so `partitionCoachMeetingRows` moves this row from
    // the Upcoming `CoachMeetingsSection`'s own `Table` into the Past one's
    // -- a different, separately-mounted `Table` instance. This assertion is
    // only satisfiable because expansion state is lifted to
    // `CoachMeetingsView` (ONE shared `Set`, not one per section, per that
    // task's own module doc) -- the row's expanded-ness survives the bucket
    // move, so its session-detail rows (including this "Canceled" copy) are
    // still spliced into the Past table without a second expand click.
    expect(container.textContent).toContain('Canceled — no attendance recorded.');
    // The real mutation seam was genuinely called, with the target session's id.
    expect(onCancelSession).toHaveBeenCalledTimes(1);
    expect(onCancelSession).toHaveBeenCalledWith('session-upcoming-build');
    expect(container.textContent).toContain('Meeting session canceled');
    // The Cancel button for that now-canceled session is gone (only
    // `scheduled` sessions render one) -- the Ravens session's own Cancel
    // button is untouched, but lives in a DIFFERENT row that has never been
    // expanded, so it needs its own expand click first (T135 Trap 1).
    expect(findButtonByText('Cancel Wed, Jul 22 session')).toBeUndefined();
    expandRow('Ravens Strategy Session');
    expect(findButtonByText('Cancel Sat, Jul 25 session')).toBeTruthy();
  });

  // T135 (Table migration) Trap 1: without an `expandRow` call first,
  // `findButtonByText` returns `undefined` and `clickButton(undefined)`
  // throws -- session-detail rows (including this Cancel button) are
  // spliced out of the DOM until expanded.
  it('Cancel rolls back the optimistic update and shows an error Banner when the mutation rejects', async () => {
    const onCancelSession = vi.fn().mockRejectedValue(new Error('network down'));
    renderAsUser(COACH_USER, { loadCoachData: defaultLoadCoachMeetingsData, onCancelSession });
    await flushMicrotasks();

    expandRow('Weekly Build Meeting');
    const cancelButton = findButtonByText('Cancel Wed, Jul 22 session');
    clickButton(cancelButton as HTMLButtonElement);
    const confirmButton = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Cancel session',
    );
    clickButton(confirmButton as HTMLButtonElement);
    await flushMicrotasks();

    // Rolled back -- the session's own Cancel button reappears, and (since
    // the mutation rejected) the row never actually left the Upcoming
    // section, so the same expanded `Table` instance still has it.
    expect(findButtonByText('Cancel Wed, Jul 22 session')).toBeTruthy();
    expect(container.textContent).toContain("Couldn't cancel meeting");
  });
});

// ---------------------------------------------------------------------------
// T605 -- per-session Edit dialog (date/time/notes) + Cancel-from-edit-flow.
//
// Fixture prerequisite + anti-rot requirement (packet §7, fixes B2): the
// default `FIXTURE_SESSIONS`/`T511_ROW` fixtures are all dated in their own
// eventual past relative to any real wall clock (§3.9/MINOR-4 of this task's
// own packet) -- `isMeetingSessionReconcilable` returns `false` for every one
// of them against any real clock from their own month onward, so they have no
// session the new Edit affordance would ever render on. This describe block
// freezes `Date` at ONE fixed instant and derives every one of its own
// fixture's dates as an offset from that SAME instant, so it stays correct
// forever regardless of when it actually runs -- never a bare hardcoded
// calendar-date string.
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

  /** Same 6:00-8:00 PM America/Chicago (CDT, UTC-5) shape `FIXTURE_SESSIONS`
   * already establishes (23:00 UTC same day -> 01:00 UTC next day). */
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
  // A past date that is NOT any existing sibling session's own date (unlike
  // `PAST_SCHEDULED_DATE`, which IS `sess-edit-past-scheduled`'s own date) --
  // test 5 retargets onto this one specifically so the future-forward guard
  // is exercised in isolation, not entangled with the duplicate-date guard.
  const PAST_RETARGET_DATE = daysFromFixtureNow(-2);

  /** Additive, dedicated `CoachMeetingsData` (not `FIXTURE_SESSIONS`/`T511_ROW`)
   * with at least one genuinely reconcilable session, a sibling session on
   * another date (for the duplicate-date guard), a scheduled-but-expired
   * session (distinct from `ScheduleMeetingsDialog.test.tsx`'s own
   * `PAST_SESSION`, which is `status: 'completed'`), one completed, and one
   * canceled session. */
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

  /** `DateInput`'s own displayed value is a long-form string
   * (`Intl.DateTimeFormat(undefined, {year:'numeric',month:'long',day:'numeric'})`
   * over a LOCAL-midnight `Date`, per `@astryxdesign/core`'s own
   * `DateInput.tsx`/`utils/plainDate.ts`) -- independently reimplemented here
   * the exact same way, so the prefill assertion (test 3) proves real VALUE
   * equality, not mere presence. */
  function formatLongDateForAssertion(isoDate: string): string {
    const [year, month, day] = isoDate.split('-').map(Number);
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(new Date(year, month - 1, day));
  }

  /** `TimeInput`'s own default `hourFormat="12h"` display
   * (`@astryxdesign/core`'s own `formatDisplayTime12h`), reimplemented here
   * for the same reason as `formatLongDateForAssertion` above. */
  function formatTime12hForAssertion(isoTime: string): string {
    const [hourStr, minuteStr] = isoTime.split(':');
    const hour = Number(hourStr);
    const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    const meridiem = hour < 12 ? 'AM' : 'PM';
    return `${hour12}:${minuteStr} ${meridiem}`;
  }

  function clickEdit(sessionDate: string): void {
    const editButton = findButtonByText(`Edit ${formatWeekdayDate(sessionDate)} session`);
    expect(editButton).toBeTruthy();
    clickButton(editButton as HTMLButtonElement);
  }

  /** `ScheduleMeetingsDialog`'s own edit-mode confirmation `AlertDialog`
   * ("Save changes to this meeting series?") is ALSO always mounted inside
   * `CoachMeetingsView` (same `Dialog`-children-render-unconditionally shape
   * this describe block's own module comment on `EditMeetingSessionDialog.tsx`
   * §6.4 already notes) and its own `actionLabel` is the SAME literal text,
   * "Save changes" -- a bare `findButtonByText('Save changes')` is genuinely
   * ambiguous on this page (measured: 2 matches). Scope every lookup to
   * `EditMeetingSessionDialog`'s own `<dialog>` element, same
   * `findButtonInAlertDialog` precedent `ScheduleMeetingsDialog.test.tsx`
   * already establishes for its own analogous ambiguity. */
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

  // Test 2 -- presence/absence, all four branches.
  it('test 2: the "Edit … session" button is present only for a genuinely reconcilable session', async () => {
    renderAsUser(COACH_USER, { loadCoachData: () => Promise.resolve(buildEditFixtureData()) });
    await flushMicrotasks();
    expandRow('Edit Fixture Meeting');

    // (a) absent for a `completed` session.
    expect(findButtonByText(`Edit ${formatWeekdayDate(COMPLETED_DATE)} session`)).toBeUndefined();
    // (b) absent for a `canceled` session.
    expect(findButtonByText(`Edit ${formatWeekdayDate(CANCELED_DATE)} session`)).toBeUndefined();
    // (c) absent for a **`scheduled`** session whose `startsAt` is in the
    // past -- distinct from `ScheduleMeetingsDialog.test.tsx`'s own
    // `PAST_SESSION` fixture (`status: 'completed'`), which cannot exercise
    // this branch.
    expect(
      findButtonByText(`Edit ${formatWeekdayDate(PAST_SCHEDULED_DATE)} session`),
    ).toBeUndefined();
    // Its Cancel button, by contrast, is still present -- "not stranded"
    // (§6.2) -- proving the Edit absence above is a deliberate, stricter gate
    // (`isMeetingSessionReconcilable`), not an accident of this fixture.
    expect(
      findButtonByText(`Cancel ${formatWeekdayDate(PAST_SCHEDULED_DATE)} session`),
    ).toBeTruthy();
    // (d) present for the new reconcilable fixture session.
    expect(findButtonByText(`Edit ${formatWeekdayDate(RECONCILABLE_DATE)} session`)).toBeTruthy();
  });

  // Test 3 -- prefill by VALUE, not presence (the same standard the T510
  // boss ruling required for the series dialog's own Grant A property 2).
  it('test 3: clicking Edit opens the dialog prefilled with the real session’s own date/time/notes', async () => {
    renderAsUser(COACH_USER, { loadCoachData: () => Promise.resolve(buildEditFixtureData()) });
    await flushMicrotasks();
    expandRow('Edit Fixture Meeting');
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

  // Test 4 -- save calls the injected mutation with the exact payload, then
  // reloads via `loadData()` and shows the success `Banner` -- mirrors
  // `handleSaveMeetingSeriesSubmit`'s/`handleCreateMeetingsSubmit`'s own
  // tested reload-and-feedback shape.
  it('test 4: saving a valid change calls onSaveMeetingSession with the exact payload, then reloads and shows success', async () => {
    const onSaveMeetingSession = vi.fn().mockResolvedValue(undefined);
    let loadCallCount = 0;
    const loadCoachData = (): Promise<CoachMeetingsData> => {
      loadCallCount += 1;
      return Promise.resolve(buildEditFixtureData());
    };
    renderAsUser(COACH_USER, { loadCoachData, onSaveMeetingSession });
    await flushMicrotasks();
    expandRow('Edit Fixture Meeting');
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

  // Test 5 -- future-value guard, both directions (new, fixes B1). Named
  // mutation: removing the `now`-comparison from
  // `computeMeetingSessionEditPayload` must turn the rejection case from a
  // real proof into a false pass (see this task's own worker output for the
  // measured before/after).
  it('test 5: a candidate startsAt that lands in the past disables Save with an inline message; a future value re-enables it', async () => {
    renderAsUser(COACH_USER, { loadCoachData: () => Promise.resolve(buildEditFixtureData()) });
    await flushMicrotasks();
    expandRow('Edit Fixture Meeting');
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

  // Test 6 -- end-after-start guard (new, fixes m6). Named mutation: removing
  // that comparison must turn the rejection case into a false pass.
  it('test 6: an end time at or before the computed start time disables Save with an inline message', async () => {
    renderAsUser(COACH_USER, { loadCoachData: () => Promise.resolve(buildEditFixtureData()) });
    await flushMicrotasks();
    expandRow('Edit Fixture Meeting');
    clickEdit(RECONCILABLE_DATE);

    const saveButton = (): HTMLButtonElement =>
      findButtonInEditSessionDialog('Save changes') as HTMLButtonElement;
    expect(saveButton().disabled).toBe(false);

    const endTimeInput = getFieldControl('Session end time') as HTMLInputElement;
    act(() => {
      // The fixture's own start time is 18:00 ("6:00 PM") -- setting End to
      // the SAME wall time makes `endsAt === startsAt`, not strictly after.
      setNativeInputValue(endTimeInput, '6:00 PM');
    });
    expect(saveButton().disabled).toBe(true);
    expect(container.textContent).toContain('End time must be after the start time.');
  });

  // Test 7 -- duplicate-date guard, both directions. Named mutation: removing
  // `sessionDateCollidesWithSibling` must turn the rejection case into a
  // false pass.
  it('test 7: retargeting onto a sibling session’s existing date is rejected; retargeting onto a free date succeeds', async () => {
    renderAsUser(COACH_USER, { loadCoachData: () => Promise.resolve(buildEditFixtureData()) });
    await flushMicrotasks();
    expandRow('Edit Fixture Meeting');
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

  // Test 8 -- Cancel reuses the existing mechanism, proven against the new
  // fixture (fixes B2's self-contradiction and m3). Opens the edit dialog,
  // clicks "Cancel this meeting", asserts the SAME confirmation-copy shape
  // already proven in 'Cancel (inline, per-session) + AlertDialog (DES-11)
  // really calls the injected onCancelSession mutation' -- built from THIS
  // fixture's own event title/date, not the July fixture's -- confirms it,
  // and asserts `onCancelSession` was called exactly once with this
  // session's id via the pre-existing `cancelTarget` seam.
  it('test 8: "Cancel this meeting" inside the edit dialog reuses the existing cancelTarget/AlertDialog seam', async () => {
    const onCancelSession = vi.fn().mockResolvedValue(undefined);
    renderAsUser(COACH_USER, {
      loadCoachData: () => Promise.resolve(buildEditFixtureData()),
      onCancelSession,
    });
    await flushMicrotasks();
    expandRow('Edit Fixture Meeting');
    clickEdit(RECONCILABLE_DATE);

    clickButton(findButtonByText('Cancel this meeting') as HTMLButtonElement);

    expect(document.body.textContent).toContain(
      `Cancel "Edit Fixture Meeting" on ${formatWeekdayDate(RECONCILABLE_DATE)}?`,
    );
    const confirmButton = Array.from(document.querySelectorAll('button')).find(
      (btn) => btn.textContent?.trim() === 'Cancel session',
    );
    expect(confirmButton).toBeTruthy();
    clickButton(confirmButton as HTMLButtonElement);
    await flushMicrotasks();

    expect(onCancelSession).toHaveBeenCalledTimes(1);
    expect(onCancelSession).toHaveBeenCalledWith('sess-edit-reconcilable');
  });
});

// ---------------------------------------------------------------------------
// T511 -- the live console's entry point.
//
// `/meetings/live/:sessionId` shipped wired and working, and
// `routePaths.meetingLiveSession` had ZERO call sites: the only way in was
// typing the URL. These four criteria pin the entry point that closes that,
// and each one has a named mutation recorded in
// `docs/swarm/active/T511-scope.md` §6.
//
// Every assertion below targets `sess-live-2`, the SECOND scheduled session,
// never the first. A link built from the wrong session's id, or rendered only
// on the first iteration, passes a first-item assertion and fails these.
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
        // The one every T511 assertion targets. Distinct id AND distinct date:
        // the id makes "points at THIS session" falsifiable, the date makes the
        // two links' accessible names differ (C4).
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
    expandRow('Build Night');

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
    expandRow('Build Night');

    const hrefs = goLiveLinks().map((l) => l.href);
    // Both non-scheduled sessions are present in this render (proving the
    // absence is a status decision, not an absent fixture) ...
    expect(container.textContent).toContain('Attended: Ada L.');
    expect(container.textContent).toContain('Canceled');
    // ... and neither contributes a live-console link.
    expect(hrefs).not.toContain('/meetings/live/sess-done');
    expect(hrefs).not.toContain('/meetings/live/sess-scrapped');
  });

  it('C3: the student/parent view renders no Go live link at all', async () => {
    // BOTH loaders are supplied, and that is the whole point. An earlier
    // version of this test passed `loadStudentData` only, and was VACUOUS:
    // widening the role gate handed the student the coach view, but with no
    // coach fixture and no expansion no session rows rendered, so "no Go live
    // links" was trivially true and the mutation left this test green while
    // turning 23 others red. Supplying the coach fixture too means that if the
    // gate ever widens, this student really would be handed a rendered coach
    // row -- which is the thing being guarded against.
    renderAsUser(STUDENT_OR_PARENT_USER, {
      resolveStudentId: fakeResolveStudentId('student-fixture'),
      resolveStudentIsActive: fakeResolveStudentIsActive(true),
      loadStudentData: () => Promise.resolve({ history: [], participation: null }),
      loadCoachData: () => Promise.resolve(T511_ROW),
    });
    await flushMicrotasks();
    await flushMicrotasks();

    // Expanding is what makes session rows exist at all. A student has no such
    // expander, so its absence is the expected path here -- but if the gate
    // widens, this call succeeds and the links appear.
    try {
      expandRow('Build Night');
    } catch {
      // No coach expander rendered -- the correct outcome for a student.
    }

    // The gate is structural: `CoachMeetingSessionRow` only renders under
    // `CoachMeetingsView`. This asserts that existing gate rather than adding
    // a second one beside the link that could drift out of step with it.
    expect(goLiveLinks()).toHaveLength(0);
    expect(container.textContent).not.toContain('Go live');
  });

  it('C4: each link’s accessible name is unique within one event', async () => {
    renderAsUser(COACH_USER, { loadCoachData: () => Promise.resolve(T511_ROW) });
    await flushMicrotasks();
    expandRow('Build Night');

    const names = goLiveLinks().map((l) => l.name);
    expect(names).toHaveLength(2);
    // Astryx forbids `label` on a text link, so the visible text IS the
    // accessible name. Two links both reading "Go live" would be two
    // indistinguishable targets to a screen reader.
    expect(new Set(names).size).toBe(2);
    expect(names[1]).toContain('Sep 9');
  });
});
