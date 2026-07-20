// @vitest-environment jsdom
/**
 * T042: tests for `MarkDayCompleteDialog.tsx`.
 *
 * Per this task's Allowed Files, a colocated test file is an explicitly
 * sanctioned addition (same precedent `OutreachDetail.test.tsx`/T041,
 * `RsvpControl.test.tsx`/T040, `ScheduleMeetingsDialog.test.tsx`/T031 already
 * established) -- it exists to produce the DOM-text/behavior proof this
 * task's own packet requires in "Required Worker Output" (the pre-checked-
 * from-RSVP checklist state and the live-computed BEH-07 button copy).
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- these tests use the same raw `createRoot`/`act` pattern
 * every other sibling test file in this batch already established, plus the
 * same `getFieldControl` helper `ScheduleMeetingsDialog.test.tsx` established
 * for locating labeled inputs (including `CheckboxListItem`'s own checkbox --
 * that file's own "Mon" weekday-checkbox assertions already prove this
 * helper resolves a real `<label htmlFor>` -> `<input type="checkbox">` pair
 * for `CheckboxListItem`, not just plain `NumberInput`/`TextInput`).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeMarkDayComplete } from '../../lib/supabase/loaders/outreach';
import {
  buildAttendanceWriteRows,
  computeInitialAttendedStudentIds,
  computeMarkCompleteConfirmLabel,
  computeSessionDurationHours,
  computeTotalHoursForCheckedStudents,
  formatHours,
  MarkDayCompleteDialog,
  PLACEHOLDER_CURRENT_COACH_PROFILE_ID,
  type MarkDayCompletePayload,
  type MarkDayCompleteSession,
  type RosterStudent,
  type RsvpRow,
} from './MarkDayCompleteDialog';

// ---------------------------------------------------------------------------
// jsdom gap: `Dialog` renders a native `<dialog>` and calls
// `HTMLDialogElement.prototype.showModal()`, which this repo's installed
// jsdom (29.x) does not implement. `MeetingsList.test.tsx`/
// `ScheduleMeetingsDialog.test.tsx` already established this exact guarded,
// test-file-local polyfill -- reused verbatim here.
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
// Render harness -- mirrors ScheduleMeetingsDialog.test.tsx.
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

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

/** Locates a labeled input via Astryx `Field`'s real `<label htmlFor>` --
 * same helper `ScheduleMeetingsDialog.test.tsx` established, proven there to
 * resolve `CheckboxListItem`'s own checkbox in addition to plain text/number
 * inputs. */
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

function clickElement(el: Element): void {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function setNativeInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

// ---------------------------------------------------------------------------
// Fixtures -- deliberately span all four RSVP-derivation cases (module doc
// #6): going (pre-checked), maybe (unchecked), declined (unchecked), no rsvp
// row at all (unchecked).
// ---------------------------------------------------------------------------

const SESSION: MarkDayCompleteSession = {
  id: 'session-1',
  eventId: 'event-1',
  sessionDate: '2026-08-02',
  startsAt: '2026-08-02T14:00:00.000Z', // 9:00 AM Chicago
  endsAt: '2026-08-02T21:00:00.000Z', // 4:00 PM Chicago -- 7h duration.
  status: 'scheduled',
  peopleReached: null,
  notes: '',
};

const ROSTER: readonly RosterStudent[] = [
  { id: 'student-going', name: 'Gwen Going', teamId: 'team-a' },
  { id: 'student-maybe', name: 'Mateo Maybe', teamId: 'team-a' },
  { id: 'student-declined', name: 'Dana Declined', teamId: 'team-a' },
  { id: 'student-no-response', name: 'Noor NoResponse', teamId: 'team-a' },
];

const RSVPS: readonly RsvpRow[] = [
  {
    id: 'rsvp-1',
    sessionId: 'session-1',
    studentId: 'student-going',
    status: 'going',
    respondedBy: 'student-going',
    updatedAt: '2026-07-20T09:00:00.000Z',
    createdAt: '2026-07-20T09:00:00.000Z',
  },
  {
    id: 'rsvp-2',
    sessionId: 'session-1',
    studentId: 'student-maybe',
    status: 'maybe',
    respondedBy: 'student-maybe',
    updatedAt: '2026-07-20T09:00:00.000Z',
    createdAt: '2026-07-20T09:00:00.000Z',
  },
  {
    id: 'rsvp-3',
    sessionId: 'session-1',
    studentId: 'student-declined',
    status: 'declined',
    respondedBy: 'student-declined',
    updatedAt: '2026-07-20T09:00:00.000Z',
    createdAt: '2026-07-20T09:00:00.000Z',
  },
  // student-no-response: deliberately no rsvp row for session-1 at all.
];

// ---------------------------------------------------------------------------
// Pure functions -- module docs #2/#4/#5/#6.
// ---------------------------------------------------------------------------

describe('computeSessionDurationHours (module doc #2(a) -- MET-03 tier-3, UI default only)', () => {
  it('computes a plain (ends_at - starts_at) subtraction', () => {
    expect(computeSessionDurationHours(SESSION)).toBe(7);
  });

  it('clamps to zero rather than going negative for a malformed inverted window', () => {
    expect(
      computeSessionDurationHours({ startsAt: SESSION.endsAt, endsAt: SESSION.startsAt }),
    ).toBe(0);
  });
});

describe('computeInitialAttendedStudentIds (module doc #6 -- the central checklist-seeding trap)', () => {
  it('pre-checks only the going student; maybe/declined/no-response all start unchecked', () => {
    const initial = computeInitialAttendedStudentIds(SESSION.id, ROSTER, RSVPS);
    expect(initial).toEqual(['student-going']);
    expect(initial).not.toContain('student-maybe');
    expect(initial).not.toContain('student-declined');
    expect(initial).not.toContain('student-no-response');
  });

  it('ignores rsvps rows for a different session entirely', () => {
    const otherSessionRsvps: RsvpRow[] = [
      { ...RSVPS[1], sessionId: 'some-other-session', status: 'going' },
    ];
    expect(computeInitialAttendedStudentIds(SESSION.id, ROSTER, otherSessionRsvps)).toEqual([]);
  });
});

describe('computeTotalHoursForCheckedStudents (module doc #2(b) -- legitimate local sum, not a v_student_hours re-derivation)', () => {
  it('sums the default duration for every checked student with no explicit override', () => {
    expect(computeTotalHoursForCheckedStudents(['a', 'b', 'c'], {}, 7)).toBe(21);
  });

  it('uses each explicit override in place of the default for that student only', () => {
    expect(computeTotalHoursForCheckedStudents(['a', 'b', 'c'], { b: 3.5 }, 7)).toBe(7 + 3.5 + 7);
  });

  it('only sums CHECKED students -- an override for an unchecked student is not counted', () => {
    expect(computeTotalHoursForCheckedStudents(['a'], { a: 2, b: 100 }, 7)).toBe(2);
  });
});

describe('formatHours', () => {
  it('trims a trailing ".0" for whole-hour values', () => {
    expect(formatHours(7)).toBe('7');
    expect(formatHours(14)).toBe('14');
  });

  it('keeps one decimal place for a genuine partial value', () => {
    expect(formatHours(3.5)).toBe('3.5');
    expect(formatHours(7.25)).toBe('7.3'); // rounds to nearest 0.1
  });
});

describe('computeMarkCompleteConfirmLabel (BEH-07)', () => {
  it('renders the literal "Mark complete — N attended · M h" pattern, never a bare verb', () => {
    expect(computeMarkCompleteConfirmLabel(6, 42)).toBe('Mark complete — 6 attended · 42 h');
    expect(computeMarkCompleteConfirmLabel(0, 0)).toBe('Mark complete — 0 attended · 0 h');
  });
});

describe('buildAttendanceWriteRows (module doc #2/#5 -- the write-path proof)', () => {
  it('writes status "present" and method "coach" for every checked student, never anything else', () => {
    const rows = buildAttendanceWriteRows(
      SESSION.id,
      ['student-going', 'student-maybe'],
      {},
      'profile-x',
    );
    expect(rows).toHaveLength(2);
    for (const row of rows) {
      expect(row.status).toBe('present');
      expect(row.method).toBe('coach');
      expect(row.recordedBy).toBe('profile-x');
    }
  });

  it('never writes check_in_at/check_out_at (module doc #2(c) -- the reason the local sum cannot diverge from the real MET-03 SQL result)', () => {
    const [row] = buildAttendanceWriteRows(SESSION.id, ['student-going'], {}, 'profile-x');
    expect(row.checkInAt).toBeNull();
    expect(row.checkOutAt).toBeNull();
  });

  it('leaves hoursOverride genuinely null for an untouched student (never back-filled with the computed default)', () => {
    const [row] = buildAttendanceWriteRows(SESSION.id, ['student-going'], {}, 'profile-x');
    expect(row.hoursOverride).toBeNull();
  });

  it('writes the explicit override value for a student the coach did adjust', () => {
    const [row] = buildAttendanceWriteRows(
      SESSION.id,
      ['student-going'],
      { 'student-going': 3.5 },
      'profile-x',
    );
    expect(row.hoursOverride).toBe(3.5);
  });
});

// ---------------------------------------------------------------------------
// DOM behavior -- the checklist pre-check + live BEH-07 button proof this
// task's own "Required Worker Output" explicitly requires.
// ---------------------------------------------------------------------------

describe('<MarkDayCompleteDialog /> checklist pre-check from RSVPs (module doc #6)', () => {
  it('checks the going student and leaves maybe/declined/no-response unchecked on open', () => {
    act(() => {
      root.render(
        <MarkDayCompleteDialog
          isOpen
          onOpenChange={() => {}}
          session={SESSION}
          roster={ROSTER}
          rsvps={RSVPS}
        />,
      );
    });

    const goingCheckbox = getFieldControl('Gwen Going') as HTMLInputElement;
    const maybeCheckbox = getFieldControl('Mateo Maybe') as HTMLInputElement;
    const declinedCheckbox = getFieldControl('Dana Declined') as HTMLInputElement;
    const noResponseCheckbox = getFieldControl('Noor NoResponse') as HTMLInputElement;

    expect(goingCheckbox.checked).toBe(true);
    expect(maybeCheckbox.checked).toBe(false);
    expect(declinedCheckbox.checked).toBe(false);
    expect(noResponseCheckbox.checked).toBe(false);
  });

  it('lets the coach toggle any row regardless of its starting state', () => {
    act(() => {
      root.render(
        <MarkDayCompleteDialog
          isOpen
          onOpenChange={() => {}}
          session={SESSION}
          roster={ROSTER}
          rsvps={RSVPS}
        />,
      );
    });

    const goingCheckbox = getFieldControl('Gwen Going') as HTMLInputElement;
    const maybeCheckbox = getFieldControl('Mateo Maybe') as HTMLInputElement;

    // Uncheck the pre-checked "going" student.
    clickElement(goingCheckbox);
    expect(goingCheckbox.checked).toBe(false);

    // Check the not-pre-checked "maybe" student.
    clickElement(maybeCheckbox);
    expect(maybeCheckbox.checked).toBe(true);
  });
});

describe('<MarkDayCompleteDialog /> BEH-07 live-computed confirm button', () => {
  it('starts as "Mark complete — 1 attended · 7 h" (only Gwen Going pre-checked, default 7h duration)', () => {
    act(() => {
      root.render(
        <MarkDayCompleteDialog
          isOpen
          onOpenChange={() => {}}
          session={SESSION}
          roster={ROSTER}
          rsvps={RSVPS}
        />,
      );
    });
    expect(findButtonByText('Mark complete — 1 attended · 7 h')).toBeDefined();
  });

  it('recomputes live when a second student is checked (2 attended, 14 h)', () => {
    act(() => {
      root.render(
        <MarkDayCompleteDialog
          isOpen
          onOpenChange={() => {}}
          session={SESSION}
          roster={ROSTER}
          rsvps={RSVPS}
        />,
      );
    });
    clickElement(getFieldControl('Mateo Maybe'));
    expect(findButtonByText('Mark complete — 2 attended · 14 h')).toBeDefined();
  });

  it('recomputes live when a per-student hours override is entered (partial attendance)', () => {
    act(() => {
      root.render(
        <MarkDayCompleteDialog
          isOpen
          onOpenChange={() => {}}
          session={SESSION}
          roster={ROSTER}
          rsvps={RSVPS}
        />,
      );
    });
    // Gwen Going is pre-checked -- her per-row override NumberInput exists
    // immediately, defaulted to the 7h session duration.
    const gwenHoursInput = getFieldControl('Gwen Going hours') as HTMLInputElement;
    expect(gwenHoursInput.value).toBe('7');

    act(() => {
      setNativeInputValue(gwenHoursInput, '3.5');
    });

    expect(findButtonByText('Mark complete — 1 attended · 3.5 h')).toBeDefined();
  });

  it('drops back to 0 attended / 0 h when every checklist row is unchecked', () => {
    act(() => {
      root.render(
        <MarkDayCompleteDialog
          isOpen
          onOpenChange={() => {}}
          session={SESSION}
          roster={ROSTER}
          rsvps={RSVPS}
        />,
      );
    });
    clickElement(getFieldControl('Gwen Going'));
    expect(findButtonByText('Mark complete — 0 attended · 0 h')).toBeDefined();
  });

  it("removes a student's per-row hours override input once unchecked (module doc #3's own field-scoping choice)", () => {
    act(() => {
      root.render(
        <MarkDayCompleteDialog
          isOpen
          onOpenChange={() => {}}
          session={SESSION}
          roster={ROSTER}
          rsvps={RSVPS}
        />,
      );
    });
    expect(() => getFieldControl('Gwen Going hours')).not.toThrow();
    clickElement(getFieldControl('Gwen Going'));
    expect(() => getFieldControl('Gwen Going hours')).toThrow();
  });
});

describe('<MarkDayCompleteDialog /> submit payload + irreversibility guard (module docs #3/#5/#7)', () => {
  it('calls onMarkComplete with the real checked-student attendance rows, deltas, and recordedBy', async () => {
    const onMarkComplete = vi.fn<(payload: MarkDayCompletePayload) => Promise<void>>(
      async () => {},
    );
    act(() => {
      root.render(
        <MarkDayCompleteDialog
          isOpen
          onOpenChange={() => {}}
          session={SESSION}
          roster={ROSTER}
          rsvps={RSVPS}
          onMarkComplete={onMarkComplete}
        />,
      );
    });

    const peopleReachedInput = getFieldControl('People reached') as HTMLInputElement;
    act(() => {
      setNativeInputValue(peopleReachedInput, '120');
    });
    const volunteersCountInput = getFieldControl(
      'Adult volunteers (this session)',
    ) as HTMLInputElement;
    act(() => {
      setNativeInputValue(volunteersCountInput, '4');
    });
    const volunteerHoursInput = getFieldControl(
      'Adult volunteer hours (this session)',
    ) as HTMLInputElement;
    act(() => {
      setNativeInputValue(volunteerHoursInput, '12');
    });

    const confirmButton = findButtonByText('Mark complete — 1 attended · 7 h') as HTMLButtonElement;
    clickElement(confirmButton);
    await flushMicrotasks();

    expect(onMarkComplete).toHaveBeenCalledTimes(1);
    const payload = onMarkComplete.mock.calls[0][0];
    expect(payload.sessionId).toBe(SESSION.id);
    expect(payload.peopleReached).toBe(120);
    expect(payload.adultVolunteersCountThisSession).toBe(4);
    expect(payload.adultVolunteerHoursThisSession).toBe(12);
    expect(payload.recordedBy).toBe(PLACEHOLDER_CURRENT_COACH_PROFILE_ID);
    expect(payload.attendance).toHaveLength(1);
    expect(payload.attendance[0].studentId).toBe('student-going');
    expect(payload.attendance[0].status).toBe('present');
    expect(payload.attendance[0].method).toBe('coach');
    expect(payload.attendance[0].hoursOverride).toBeNull(); // untouched -- module doc #2.
  });

  it('never calls onMarkComplete when Cancel is clicked', () => {
    const onMarkComplete = vi.fn<(payload: MarkDayCompletePayload) => Promise<void>>(
      async () => {},
    );
    act(() => {
      root.render(
        <MarkDayCompleteDialog
          isOpen
          onOpenChange={() => {}}
          session={SESSION}
          roster={ROSTER}
          rsvps={RSVPS}
          onMarkComplete={onMarkComplete}
        />,
      );
    });
    clickElement(findButtonByText('Cancel') as HTMLButtonElement);
    expect(onMarkComplete).not.toHaveBeenCalled();
  });

  it('renders no checklist/hours inputs/confirm action for an already-completed session (module doc #5(ii))', () => {
    act(() => {
      root.render(
        <MarkDayCompleteDialog
          isOpen
          onOpenChange={() => {}}
          session={{ ...SESSION, status: 'completed' }}
          roster={ROSTER}
          rsvps={RSVPS}
        />,
      );
    });
    expect(container.querySelector('input[type="checkbox"]')).toBeNull();
    expect(
      Array.from(container.querySelectorAll('button')).some((button) =>
        button.textContent?.startsWith('Mark complete'),
      ),
    ).toBe(false);
    expect(findButtonByText('Close')).toBeDefined();
    expect(container.textContent).toContain("can't be marked complete from here");
  });
});

// ---------------------------------------------------------------------------
// T101 (ED-1 Packet P10): loader-level tests for the REAL `onMarkComplete`
// default (`markDayComplete`, `../../lib/supabase/loaders/outreach.ts`,
// module doc #4). Same "inject a fake SupabaseClient chain" pattern
// `loaders/meetings.ts`'s own tests (`MeetingsList.test.tsx`) already
// established.
// ---------------------------------------------------------------------------

describe('markDayComplete (T101 real onMarkComplete default)', () => {
  it('updates event_sessions (status=completed, people_reached) and upserts the attendance rows', async () => {
    const sessionUpdateEqSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const sessionUpdateSpy = vi.fn(() => ({ eq: sessionUpdateEqSpy }));
    const attendanceUpsertSpy = vi.fn().mockResolvedValue({ data: null, error: null });

    const fromSpy = vi.fn((table: string) => {
      if (table === 'event_sessions') return { update: sessionUpdateSpy };
      if (table === 'attendance') return { upsert: attendanceUpsertSpy };
      throw new Error(`unexpected table: ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const markComplete = makeMarkDayComplete(() => client);
    await markComplete({
      sessionId: 'session-1',
      peopleReached: 42,
      attendance: [
        {
          sessionId: 'session-1',
          studentId: 'student-1',
          status: 'present',
          checkInAt: null,
          checkOutAt: null,
          hoursOverride: null,
          method: 'coach',
          recordedBy: 'profile-coach-1',
        },
      ],
      adultVolunteersCountThisSession: 0,
      adultVolunteerHoursThisSession: 0,
      recordedBy: 'profile-coach-1',
    });

    expect(sessionUpdateSpy).toHaveBeenCalledWith({ status: 'completed', people_reached: 42 });
    expect(sessionUpdateEqSpy).toHaveBeenCalledWith('id', 'session-1');
    expect(attendanceUpsertSpy).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          session_id: 'session-1',
          student_id: 'student-1',
          status: 'present',
          check_in_at: null,
          check_out_at: null,
          hours_override: null,
          method: 'coach',
          recorded_by: 'profile-coach-1',
        }),
      ],
      { onConflict: 'session_id,student_id' },
    );
    // No adult-volunteer delta -- the additive events read-modify-write is
    // skipped entirely (module doc #4(c)).
    expect(fromSpy).not.toHaveBeenCalledWith('events');
  });

  it('performs the disclosed non-atomic additive events adult-volunteer update only when a delta is nonzero', async () => {
    const sessionUpdateSpy = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ data: null, error: null }),
    }));
    const sessionEventIdMaybeSingleSpy = vi
      .fn()
      .mockResolvedValue({ data: { event_id: 'event-1' }, error: null });
    const eventTotalsMaybeSingleSpy = vi.fn().mockResolvedValue({
      data: { adult_volunteers_count: 2, adult_volunteer_hours: 6 },
      error: null,
    });
    const eventUpdateEqSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const eventUpdateSpy = vi.fn(() => ({ eq: eventUpdateEqSpy }));

    let eventSessionsSelectCall = 0;
    const fromSpy = vi.fn((table: string) => {
      if (table === 'event_sessions') {
        eventSessionsSelectCall += 1;
        if (eventSessionsSelectCall === 1) return { update: sessionUpdateSpy };
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({ maybeSingle: sessionEventIdMaybeSingleSpy })),
          })),
        };
      }
      if (table === 'events') {
        return {
          select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: eventTotalsMaybeSingleSpy })) })),
          update: eventUpdateSpy,
        };
      }
      throw new Error(`unexpected table: ${table}`);
    });
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const markComplete = makeMarkDayComplete(() => client);
    await markComplete({
      sessionId: 'session-1',
      peopleReached: null,
      attendance: [],
      adultVolunteersCountThisSession: 4,
      adultVolunteerHoursThisSession: 12,
      recordedBy: 'profile-coach-1',
    });

    // Additive -- 2+4=6, 6+12=18, never a raw overwrite of the delta alone.
    expect(eventUpdateSpy).toHaveBeenCalledWith({
      adult_volunteers_count: 6,
      adult_volunteer_hours: 18,
    });
    expect(eventUpdateEqSpy).toHaveBeenCalledWith('id', 'event-1');
  });
});
