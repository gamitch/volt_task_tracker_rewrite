// @vitest-environment jsdom
/**
 * T126 (PRD v2 UXP-03): tests for `SelfCheckoffDialog.tsx` AND its paired
 * loader module `../../lib/supabase/loaders/selfCheckoff.ts` (that module
 * has no separate test file of its own -- same precedent
 * `AttendancePanel.test.tsx` already established for
 * `../../lib/supabase/loaders/attendance.ts`, `MarkDayCompleteDialog.test.tsx`
 * for `makeMarkDayComplete`: "stubbed `SupabaseClient` loader tests (assert
 * exact insert/delete payloads) + component tests for checklist render/
 * toggle/submit/role-neutral copy").
 *
 * No `@testing-library/react` is installed in this repo -- these tests use
 * the same raw `createRoot`/`act` pattern every sibling test file in this
 * directory already established, plus `AttendancePanel.test.tsx`'s own
 * `getFieldControl`/`clickElement`/`findButtonByText` helpers (proven there
 * to resolve `CheckboxListItem`'s real `<label htmlFor>` -> `<input
 * type="checkbox">` pair).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makeInsertSelfCheckoff,
  makeLoadSelfCheckoffAttendance,
  makeRemoveSelfCheckoff,
  type SelfCheckoffAttendanceRow,
} from '../../lib/supabase/loaders/selfCheckoff';
import {
  computeInitialSelfCheckedSessionIds,
  computeLockedSessionIds,
  computeSelfCheckoffConfirmLabel,
  computeSelfCheckoffPlan,
  computeSessionDurationHours,
  filterEligibleSelfCheckoffSessions,
  formatHours,
  formatSessionDateTime,
  PLACEHOLDER_CURRENT_VIEWER_PROFILE_ID,
  SelfCheckoffDialog,
  type SelfCheckoffSession,
} from './SelfCheckoffDialog';

// ---------------------------------------------------------------------------
// jsdom gap: `Dialog` renders a native `<dialog>` and calls
// `HTMLDialogElement.prototype.showModal()`, which this repo's installed
// jsdom does not implement -- same guarded, test-file-local polyfill every
// sibling dialog test file in this directory already established, reused
// verbatim here.
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
// Render harness -- mirrors `AttendancePanel.test.tsx`/`MarkDayCompleteDialog.test.tsx`.
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

function clickElement(el: Element): void {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

function findButtonByText(text: string): HTMLButtonElement | undefined {
  return Array.from(document.querySelectorAll('button')).find(
    (button) => button.textContent?.trim() === text,
  );
}

// ---------------------------------------------------------------------------
// Fixtures.
// ---------------------------------------------------------------------------

const SESSION_A: SelfCheckoffSession = {
  id: 'session-a',
  sessionDate: '2026-06-14',
  startsAt: '2026-06-14T14:00:00.000Z', // 9:00 AM America/Chicago (CDT)
  endsAt: '2026-06-14T17:00:00.000Z', // 12:00 PM America/Chicago -- 3h
  status: 'completed',
};

const SESSION_B: SelfCheckoffSession = {
  id: 'session-b',
  sessionDate: '2026-06-15',
  startsAt: '2026-06-15T14:00:00.000Z',
  endsAt: '2026-06-15T18:00:00.000Z', // 4h
  status: 'completed',
};

const SESSION_SCHEDULED: SelfCheckoffSession = {
  id: 'session-scheduled',
  sessionDate: '2026-08-02',
  startsAt: '2026-08-02T14:00:00.000Z',
  endsAt: '2026-08-02T17:00:00.000Z',
  status: 'scheduled',
};

const SESSION_CANCELED: SelfCheckoffSession = {
  id: 'session-canceled',
  sessionDate: '2026-06-16',
  startsAt: '2026-06-16T14:00:00.000Z',
  endsAt: '2026-06-16T17:00:00.000Z',
  status: 'canceled',
};

const STUDENT_ID = 'student-fixture-one';
const VIEWER_PROFILE_ID = 'profile-fixture-viewer';

function makeRow(overrides: Partial<SelfCheckoffAttendanceRow>): SelfCheckoffAttendanceRow {
  return {
    sessionId: SESSION_A.id,
    studentId: STUDENT_ID,
    status: 'present',
    method: 'self',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Pure functions.
// ---------------------------------------------------------------------------

describe('filterEligibleSelfCheckoffSessions (module doc #4 -- only completed days)', () => {
  it('keeps only completed sessions, sorted ascending by startsAt', () => {
    const result = filterEligibleSelfCheckoffSessions([
      SESSION_B,
      SESSION_SCHEDULED,
      SESSION_A,
      SESSION_CANCELED,
    ]);
    expect(result.map((s) => s.id)).toEqual(['session-a', 'session-b']);
  });
});

describe('computeSessionDurationHours / formatHours (module doc #2 -- UI seed only)', () => {
  it('computes plain (endsAt - startsAt) in hours, rounded/trimmed for display', () => {
    expect(computeSessionDurationHours(SESSION_A)).toBe(3);
    expect(computeSessionDurationHours(SESSION_B)).toBe(4);
    expect(formatHours(3)).toBe('3');
    expect(formatHours(3.25)).toBe('3.3');
  });
});

describe('computeInitialSelfCheckedSessionIds / computeLockedSessionIds (module doc #4)', () => {
  it('splits rows into self (removable) vs locked (any other real method)', () => {
    const rows: SelfCheckoffAttendanceRow[] = [
      makeRow({ sessionId: 'session-a', method: 'self' }),
      makeRow({ sessionId: 'session-b', method: 'coach' }),
      makeRow({ sessionId: 'session-c', method: 'qr' }),
      makeRow({ sessionId: 'session-d', method: 'import' }),
    ];
    expect(computeInitialSelfCheckedSessionIds(rows)).toEqual(['session-a']);
    expect(computeLockedSessionIds(rows)).toEqual(['session-b', 'session-c', 'session-d']);
  });

  it('both are empty for a day with no attendance row at all', () => {
    expect(computeInitialSelfCheckedSessionIds([])).toEqual([]);
    expect(computeLockedSessionIds([])).toEqual([]);
  });
});

describe('computeSelfCheckoffPlan (THE submit-plan function)', () => {
  it('a newly checked, previously-unrecorded day is an INSERT candidate', () => {
    const plan = computeSelfCheckoffPlan([], [], ['session-a']);
    expect(plan).toEqual({ toInsert: ['session-a'], toRemove: [] });
  });

  it('a newly unchecked, previously self-recorded day is a REMOVE candidate', () => {
    const plan = computeSelfCheckoffPlan(['session-a'], [], []);
    expect(plan).toEqual({ toInsert: [], toRemove: ['session-a'] });
  });

  it('a locked day (already recorded, not self) is NEVER an insert or remove candidate, checked or not', () => {
    const checkedInclLocked = computeSelfCheckoffPlan([], ['session-c'], ['session-c']);
    expect(checkedInclLocked).toEqual({ toInsert: [], toRemove: [] });
    // Even if a caller's `checkedSessionIds` somehow omitted the locked id
    // (it never should, per the component's own always-forced-checked
    // wiring), this function still refuses to treat it as removable --
    // "locked" wins over "not currently checked".
    const omittedLocked = computeSelfCheckoffPlan([], ['session-c'], []);
    expect(omittedLocked).toEqual({ toInsert: [], toRemove: [] });
  });

  it('a self day left checked (untouched) is neither inserted nor removed again', () => {
    const plan = computeSelfCheckoffPlan(['session-a'], [], ['session-a']);
    expect(plan).toEqual({ toInsert: [], toRemove: [] });
  });

  it('mixed: one new insert + one removal in the same plan', () => {
    const plan = computeSelfCheckoffPlan(['session-a'], ['session-c'], ['session-b', 'session-c']);
    expect(plan).toEqual({ toInsert: ['session-b'], toRemove: ['session-a'] });
  });
});

describe('computeSelfCheckoffConfirmLabel (DES-14 named outcome, constitution item 17 neutral)', () => {
  it('states the real counts, never a bare Save/Confirm/OK when there is a real change', () => {
    expect(computeSelfCheckoffConfirmLabel(0, 0)).toBe('Save');
    expect(computeSelfCheckoffConfirmLabel(1, 0)).toBe('Save — 1 day added');
    expect(computeSelfCheckoffConfirmLabel(2, 0)).toBe('Save — 2 days added');
    expect(computeSelfCheckoffConfirmLabel(0, 1)).toBe('Save — 1 removed');
    expect(computeSelfCheckoffConfirmLabel(1, 1)).toBe('Save — 1 day added, 1 removed');
  });

  it('contains no urgency/guilt/nagging language (constitution item 17)', () => {
    const label = computeSelfCheckoffConfirmLabel(1, 1);
    for (const banned of ['forgot', 'hurry', 'now!', 'streak', 'missed']) {
      expect(label.toLowerCase()).not.toContain(banned);
    }
  });
});

describe('formatSessionDateTime (NFR-09: America/Chicago)', () => {
  it('renders weekday/date + Chicago start-end clock times', () => {
    expect(formatSessionDateTime(SESSION_A)).toBe('Sun, Jun 14 · 9:00 AM–12:00 PM');
  });
});

// ---------------------------------------------------------------------------
// Loader tests (module doc: no separate test file for
// `../../lib/supabase/loaders/selfCheckoff.ts`).
// ---------------------------------------------------------------------------

describe('makeLoadSelfCheckoffAttendance', () => {
  it('queries attendance.select(session_id, student_id, status, method).in(session_id, ids).eq(student_id, id) and maps snake_case -> camelCase', async () => {
    const dbRow = {
      session_id: 'session-a',
      student_id: STUDENT_ID,
      status: 'present',
      method: 'self',
    };
    const eqSpy = vi.fn().mockResolvedValue({ data: [dbRow], error: null });
    const inSpy = vi.fn(() => ({ eq: eqSpy }));
    const selectSpy = vi.fn(() => ({ in: inSpy }));
    const fromSpy = vi.fn(() => ({ select: selectSpy }));
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const load = makeLoadSelfCheckoffAttendance(() => client);
    const rows = await load(['session-a', 'session-b'], STUDENT_ID);

    expect(fromSpy).toHaveBeenCalledWith('attendance');
    expect(selectSpy).toHaveBeenCalledWith('session_id, student_id, status, method');
    expect(inSpy).toHaveBeenCalledWith('session_id', ['session-a', 'session-b']);
    expect(eqSpy).toHaveBeenCalledWith('student_id', STUDENT_ID);
    expect(rows).toEqual([
      { sessionId: 'session-a', studentId: STUDENT_ID, status: 'present', method: 'self' },
    ]);
  });

  it('short-circuits to [] for an empty sessionIds array without querying the client at all', async () => {
    const fromSpy = vi.fn();
    const client = { from: fromSpy } as unknown as SupabaseClient;
    const load = makeLoadSelfCheckoffAttendance(() => client);
    expect(await load([], STUDENT_ID)).toEqual([]);
    expect(fromSpy).not.toHaveBeenCalled();
  });
});

describe('makeInsertSelfCheckoff (module doc #4 -- always present/self/null-hours/null-check-in-out)', () => {
  it('inserts the exact real column set', async () => {
    const dbRow = {
      session_id: 'session-a',
      student_id: STUDENT_ID,
      status: 'present',
      method: 'self',
    };
    const singleSpy = vi.fn().mockResolvedValue({ data: dbRow, error: null });
    const selectSpy = vi.fn(() => ({ single: singleSpy }));
    const insertSpy = vi.fn<(payload: Record<string, unknown>) => { select: typeof selectSpy }>(
      () => ({ select: selectSpy }),
    );
    const fromSpy = vi.fn(() => ({ insert: insertSpy }));
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const insert = makeInsertSelfCheckoff(() => client);
    const result = await insert({
      sessionId: 'session-a',
      studentId: STUDENT_ID,
      recordedBy: VIEWER_PROFILE_ID,
    });

    expect(fromSpy).toHaveBeenCalledWith('attendance');
    expect(insertSpy).toHaveBeenCalledWith({
      session_id: 'session-a',
      student_id: STUDENT_ID,
      status: 'present',
      check_in_at: null,
      check_out_at: null,
      hours_override: null,
      method: 'self',
      recorded_by: VIEWER_PROFILE_ID,
    });
    expect(selectSpy).toHaveBeenCalledWith('session_id, student_id, status, method');
    expect(result.method).toBe('self');
  });
});

describe('makeRemoveSelfCheckoff (module doc #4 -- client-side method=self mirror)', () => {
  it('deletes by session_id + student_id + method=self', async () => {
    const thirdEqSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const secondEqSpy = vi.fn(() => ({ eq: thirdEqSpy }));
    const firstEqSpy = vi.fn(() => ({ eq: secondEqSpy }));
    const deleteSpy = vi.fn(() => ({ eq: firstEqSpy }));
    const fromSpy = vi.fn(() => ({ delete: deleteSpy }));
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const remove = makeRemoveSelfCheckoff(() => client);
    await remove({ sessionId: 'session-a', studentId: STUDENT_ID });

    expect(fromSpy).toHaveBeenCalledWith('attendance');
    expect(firstEqSpy).toHaveBeenCalledWith('session_id', 'session-a');
    expect(secondEqSpy).toHaveBeenCalledWith('student_id', STUDENT_ID);
    expect(thirdEqSpy).toHaveBeenCalledWith('method', 'self');
  });
});

// ---------------------------------------------------------------------------
// Component tests.
// ---------------------------------------------------------------------------

function renderDialog(props: Partial<Parameters<typeof SelfCheckoffDialog>[0]> = {}): void {
  act(() => {
    root.render(
      <SelfCheckoffDialog
        isOpen
        onOpenChange={vi.fn()}
        eventTitle="Fixture Outreach Event"
        studentId={STUDENT_ID}
        sessions={[SESSION_A, SESSION_B]}
        currentUserProfileId={VIEWER_PROFILE_ID}
        loadAttendance={async () => []}
        onInsert={vi.fn()}
        onRemove={vi.fn()}
        {...props}
      />,
    );
  });
}

describe('<SelfCheckoffDialog /> DES-12 states', () => {
  it('loading -> a status region while the attendance fetch is pending', () => {
    renderDialog({ loadAttendance: () => new Promise<SelfCheckoffAttendanceRow[]>(() => {}) });
    expect(container.textContent).toContain('Loading');
  });

  it('error -> a Banner with a working Retry', async () => {
    let callCount = 0;
    renderDialog({
      loadAttendance: () => {
        callCount += 1;
        return callCount === 1 ? Promise.reject(new Error('boom')) : Promise.resolve([]);
      },
    });
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't load this event's days");

    const retryButton = findButtonByText('Retry');
    expect(retryButton).toBeTruthy();
    clickElement(retryButton as HTMLButtonElement);
    await flushMicrotasks();
    expect(container.textContent).not.toContain("Couldn't load this event's days");
    // Second call resolves `[]` (no existing attendance rows) against the
    // default two completed fixture sessions -- both days now render as a
    // real, checkable (unlocked) checklist.
    expect(container.textContent).toContain(formatSessionDateTime(SESSION_A));
    expect(container.querySelectorAll('input[type="checkbox"]').length).toBe(2);
  });

  it('empty -> zero completed sessions renders an EmptyState, not a checklist', async () => {
    renderDialog({ sessions: [SESSION_SCHEDULED, SESSION_CANCELED] });
    await flushMicrotasks();
    expect(container.textContent).toContain('No completed days yet');
    expect(container.querySelectorAll('input[type="checkbox"]').length).toBe(0);
  });

  it('populated -> one checklist row per eligible (completed) day only', async () => {
    renderDialog({ sessions: [SESSION_A, SESSION_B, SESSION_SCHEDULED, SESSION_CANCELED] });
    await flushMicrotasks();
    expect(container.textContent).toContain(formatSessionDateTime(SESSION_A));
    expect(container.textContent).toContain(formatSessionDateTime(SESSION_B));
    expect(container.textContent).not.toContain(formatSessionDateTime(SESSION_SCHEDULED));
    expect(container.querySelectorAll('input[type="checkbox"]').length).toBe(2);
  });
});

describe('<SelfCheckoffDialog /> module doc #4 -- locked (non-self) days cannot be toggled', () => {
  it('a coach-recorded day renders checked, disabled, and "Already recorded" -- clicking it does nothing', async () => {
    const onRemove = vi.fn();
    renderDialog({
      loadAttendance: async () => [makeRow({ sessionId: SESSION_A.id, method: 'coach' })],
      onRemove,
    });
    await flushMicrotasks();

    const checkbox = getFieldControl(formatSessionDateTime(SESSION_A)) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    expect(checkbox.disabled).toBe(true);
    expect(container.textContent).toContain('Already recorded');

    clickElement(checkbox);
    await flushMicrotasks();
    expect(checkbox.checked).toBe(true); // unchanged -- still locked

    // Save is disabled too (nothing genuinely changed).
    const saveButton = findButtonByText('Save');
    expect(saveButton?.hasAttribute('disabled')).toBe(true);
    clickElement(saveButton as HTMLButtonElement);
    await flushMicrotasks();
    expect(onRemove).not.toHaveBeenCalled();
  });

  it('a qr/import-recorded day is likewise locked (any non-self method, not just coach)', async () => {
    renderDialog({
      loadAttendance: async () => [makeRow({ sessionId: SESSION_A.id, method: 'qr' })],
    });
    await flushMicrotasks();
    const checkbox = getFieldControl(formatSessionDateTime(SESSION_A)) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    expect(checkbox.disabled).toBe(true);
  });
});

describe('<SelfCheckoffDialog /> checking a previously-unrecorded day + Save', () => {
  it('calls onInsert with sessionId/studentId/recordedBy, then closes', async () => {
    const onInsert = vi
      .fn()
      .mockResolvedValue(makeRow({ sessionId: SESSION_A.id, method: 'self' }));
    const onOpenChange = vi.fn();
    renderDialog({ loadAttendance: async () => [], onInsert, onOpenChange });
    await flushMicrotasks();

    const checkbox = getFieldControl(formatSessionDateTime(SESSION_A)) as HTMLInputElement;
    expect(checkbox.checked).toBe(false);
    clickElement(checkbox);
    await flushMicrotasks();
    expect(checkbox.checked).toBe(true);

    const saveButton = findButtonByText('Save — 1 day added');
    expect(saveButton).toBeTruthy();
    clickElement(saveButton as HTMLButtonElement);
    await flushMicrotasks();

    expect(onInsert).toHaveBeenCalledWith({
      sessionId: SESSION_A.id,
      studentId: STUDENT_ID,
      recordedBy: VIEWER_PROFILE_ID,
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('<SelfCheckoffDialog /> unchecking a previously self-recorded day + Save', () => {
  it('calls onRemove with sessionId/studentId, then closes', async () => {
    const onRemove = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();
    renderDialog({
      loadAttendance: async () => [makeRow({ sessionId: SESSION_A.id, method: 'self' })],
      onRemove,
      onOpenChange,
    });
    await flushMicrotasks();

    const checkbox = getFieldControl(formatSessionDateTime(SESSION_A)) as HTMLInputElement;
    expect(checkbox.checked).toBe(true);
    expect(checkbox.disabled).toBe(false); // self rows are NOT locked
    clickElement(checkbox);
    await flushMicrotasks();
    expect(checkbox.checked).toBe(false);

    const saveButton = findButtonByText('Save — 1 removed');
    clickElement(saveButton as HTMLButtonElement);
    await flushMicrotasks();

    expect(onRemove).toHaveBeenCalledWith({ sessionId: SESSION_A.id, studentId: STUDENT_ID });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe('<SelfCheckoffDialog /> submit failure', () => {
  it('shows an inline error Banner and leaves the dialog open', async () => {
    const onInsert = vi.fn().mockRejectedValue(new Error('network down'));
    const onOpenChange = vi.fn();
    renderDialog({ loadAttendance: async () => [], onInsert, onOpenChange });
    await flushMicrotasks();

    clickElement(getFieldControl(formatSessionDateTime(SESSION_A)));
    await flushMicrotasks();
    clickElement(findButtonByText('Save — 1 day added') as HTMLButtonElement);
    await flushMicrotasks();

    expect(container.textContent).toContain('network down');
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
  });
});

describe('<SelfCheckoffDialog /> default props (fabricated fixture data, constitution item 6)', () => {
  it('renders standalone with obviously-fake defaults, no crash', async () => {
    act(() => {
      root.render(
        <SelfCheckoffDialog isOpen onOpenChange={vi.fn()} loadAttendance={async () => []} />,
      );
    });
    await flushMicrotasks();
    expect(container.textContent).toContain('Mark attendance');
  });

  it('PLACEHOLDER_CURRENT_VIEWER_PROFILE_ID is an obviously-fake placeholder string', () => {
    expect(PLACEHOLDER_CURRENT_VIEWER_PROFILE_ID).toContain('placeholder');
  });
});

describe('<SelfCheckoffDialog /> constitution item 17 -- neutral copy only', () => {
  it('the visible dialog text contains no nagging/urgency/guilt language', async () => {
    renderDialog({ loadAttendance: async () => [] });
    await flushMicrotasks();
    const text = container.textContent?.toLowerCase() ?? '';
    for (const banned of [
      'you forgot',
      'hurry',
      'don’t miss',
      'streak',
      'act now',
      'last chance',
    ]) {
      expect(text).not.toContain(banned);
    }
  });
});
