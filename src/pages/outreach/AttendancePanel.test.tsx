// @vitest-environment jsdom
/**
 * T117 (PRD v2 UXP-01): tests for `AttendancePanel.tsx` AND its paired
 * loader module `../../lib/supabase/loaders/attendance.ts` (that module has
 * no separate test file of its own -- the worker packet's own "Required
 * Worker Output" instruction groups both under this file: "stubbed
 * `SupabaseClient` loader tests (assert exact upsert payloads incl.
 * `method:'coach'`, `recorded_by`, `onConflict`) + component tests for
 * checklist render/toggle/hours-edit/role-gating", same precedent
 * `MarkDayCompleteDialog.test.tsx` already established for
 * `makeMarkDayComplete` (`../../lib/supabase/loaders/outreach.ts`, also no
 * standalone test file).
 *
 * No `@testing-library/react` is installed in this repo -- these tests use
 * the same raw `createRoot`/`act` pattern every sibling test file in this
 * batch already established, plus `MarkDayCompleteDialog.test.tsx`'s own
 * `getFieldControl`/`setNativeInputValue`/`clickElement` helpers (proven
 * there to resolve `CheckboxInput`/`NumberInput`'s real `<label htmlFor>`
 * pairs).
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  makeLoadAttendanceForSessions,
  makeRemoveAttendance,
  makeUpsertAttendance,
  resolveAttendanceWriteMethod,
  type AttendanceRow,
} from '../../lib/supabase/loaders/attendance';
import {
  AttendancePanel,
  computeSessionAttendanceTotalHours,
  computeSessionDurationHours,
  formatHours,
  formatSessionDateTime,
  isAttendingStatus,
  pickTeamBadgeVariant,
  resolveTeamName,
  rowKey,
  sortAttendanceSessions,
  sortRosterByTeam,
  type AttendancePanelSession,
  type AttendancePanelStudent,
  type AttendancePanelTeam,
} from './AttendancePanel';

// ---------------------------------------------------------------------------
// Render harness -- mirrors `MarkDayCompleteDialog.test.tsx`.
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
 * same helper `MarkDayCompleteDialog.test.tsx` established. */
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

function setNativeInputValue(input: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

function blurElement(input: HTMLElement): void {
  act(() => {
    input.focus();
    input.blur();
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

const SESSION_1: AttendancePanelSession = {
  id: 'session-1',
  sessionDate: '2026-08-02',
  startsAt: '2026-08-02T14:00:00.000Z', // 9:00 AM Chicago
  endsAt: '2026-08-02T22:00:00.000Z', // 5:00 PM Chicago -- 8h duration
  status: 'scheduled',
};

const CANCELED_SESSION: AttendancePanelSession = {
  id: 'session-canceled',
  sessionDate: '2026-08-03',
  startsAt: '2026-08-03T14:00:00.000Z',
  endsAt: '2026-08-03T20:00:00.000Z',
  status: 'canceled',
};

const TEAMS: readonly AttendancePanelTeam[] = [
  { id: 'team-ravens', name: 'Ravens' },
  { id: 'team-titans', name: 'Titans' },
];

const ROSTER: readonly AttendancePanelStudent[] = [
  { id: 'student-amara', name: 'Amara Chen', teamId: 'team-ravens' },
  { id: 'student-sofia', name: 'Sofia Delgado', teamId: 'team-titans' },
];

const COACH_PROFILE_ID = 'profile-coach-1';

function makeRow(overrides: Partial<AttendanceRow>): AttendanceRow {
  return {
    id: 'attendance-fixture',
    sessionId: SESSION_1.id,
    studentId: 'student-amara',
    status: 'present',
    checkInAt: null,
    checkOutAt: null,
    hoursOverride: null,
    method: 'coach',
    recordedBy: COACH_PROFILE_ID,
    updatedAt: '2026-07-20T00:00:00.000Z',
    createdAt: '2026-07-20T00:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Pure functions.
// ---------------------------------------------------------------------------

describe('resolveAttendanceWriteMethod (Trap #2 decision -- checked-row write LABEL, unchanged by T119/D-7)', () => {
  it('a real qr/import row keeps its provenance on write; anything else becomes/stays coach', () => {
    expect(resolveAttendanceWriteMethod('qr')).toBe('qr');
    expect(resolveAttendanceWriteMethod('import')).toBe('import');
    expect(resolveAttendanceWriteMethod('coach')).toBe('coach');
    expect(resolveAttendanceWriteMethod(null)).toBe('coach');
  });
});

describe('computeSessionDurationHours (UI-default seed only, module doc #7)', () => {
  it('computes a plain (endsAt - startsAt) subtraction', () => {
    expect(computeSessionDurationHours(SESSION_1)).toBe(8);
  });

  it('clamps to zero for a malformed inverted window', () => {
    expect(
      computeSessionDurationHours({ startsAt: SESSION_1.endsAt, endsAt: SESSION_1.startsAt }),
    ).toBe(0);
  });
});

describe('formatHours', () => {
  it('trims a trailing ".0" for whole-hour values', () => {
    expect(formatHours(8)).toBe('8');
  });
  it('keeps one decimal place for a genuine partial value', () => {
    expect(formatHours(3.5)).toBe('3.5');
  });
});

describe('isAttendingStatus', () => {
  it('present/late are attending; absent/excused/undefined are not', () => {
    expect(isAttendingStatus('present')).toBe(true);
    expect(isAttendingStatus('late')).toBe(true);
    expect(isAttendingStatus('absent')).toBe(false);
    expect(isAttendingStatus('excused')).toBe(false);
    expect(isAttendingStatus(undefined)).toBe(false);
  });
});

describe('sortRosterByTeam (Known Context/Traps #3 -- grouped by team chips)', () => {
  it('clusters same-team students together, in team order, then by name', () => {
    const mixed: AttendancePanelStudent[] = [
      { id: 's-2', name: 'Zed Titan', teamId: 'team-titans' },
      { id: 's-1', name: 'Amara Chen', teamId: 'team-ravens' },
      { id: 's-3', name: 'Bo Raven', teamId: 'team-ravens' },
    ];
    const sorted = sortRosterByTeam(mixed, TEAMS);
    expect(sorted.map((s) => s.id)).toEqual(['s-1', 's-3', 's-2']);
  });
});

describe('resolveTeamName / pickTeamBadgeVariant', () => {
  it('resolves a real team name, falling back honestly for an unknown id', () => {
    expect(resolveTeamName('team-ravens', TEAMS)).toBe('Ravens');
    expect(resolveTeamName('team-unknown', TEAMS)).toBe('No team');
  });

  it('is deterministic for the same team id', () => {
    expect(pickTeamBadgeVariant('team-ravens')).toBe(pickTeamBadgeVariant('team-ravens'));
  });
});

describe('sortAttendanceSessions / formatSessionDateTime', () => {
  it('sorts chronologically by startsAt', () => {
    const sorted = sortAttendanceSessions([CANCELED_SESSION, SESSION_1]);
    expect(sorted.map((s) => s.id)).toEqual(['session-1', 'session-canceled']);
  });

  it('formats a Chicago-wall-clock date/time summary', () => {
    expect(formatSessionDateTime(SESSION_1)).toContain('Aug 2');
  });
});

describe('rowKey / computeSessionAttendanceTotalHours (module doc #7 -- legitimate local sum)', () => {
  it('rowKey combines session/student ids', () => {
    expect(rowKey('s1', 'st1')).toBe('s1:st1');
  });

  it('sums effective hours (override, else session duration) for attending students only', () => {
    const byKey: Record<string, AttendanceRow> = {
      [rowKey(SESSION_1.id, 'student-amara')]: makeRow({ status: 'present', hoursOverride: 3 }),
      [rowKey(SESSION_1.id, 'student-sofia')]: makeRow({
        studentId: 'student-sofia',
        status: 'absent',
      }),
    };
    // Amara: explicit 3h override, attending. Sofia: absent, excluded
    // entirely (even though a row exists).
    expect(computeSessionAttendanceTotalHours(SESSION_1, ROSTER, byKey)).toBe(3);
  });

  it('falls back to the session-duration default when no override is recorded', () => {
    const byKey: Record<string, AttendanceRow> = {
      [rowKey(SESSION_1.id, 'student-amara')]: makeRow({ hoursOverride: null }),
    };
    expect(computeSessionAttendanceTotalHours(SESSION_1, ROSTER, byKey)).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// Loader-level tests -- stubbed `SupabaseClient`, exact payload proof
// (packet's own "Required Worker Output").
// ---------------------------------------------------------------------------

describe('makeLoadAttendanceForSessions', () => {
  it('queries attendance.select(*).in(session_id, ids) and maps snake_case -> camelCase', async () => {
    const dbRow = {
      id: 'att-1',
      session_id: 'session-1',
      student_id: 'student-amara',
      status: 'present',
      check_in_at: '2026-08-02T14:05:00.000Z',
      check_out_at: null,
      hours_override: null,
      method: 'qr',
      recorded_by: 'student-amara',
      updated_at: '2026-08-02T14:05:00.000Z',
      created_at: '2026-08-02T14:05:00.000Z',
    };
    const inSpy = vi.fn().mockResolvedValue({ data: [dbRow], error: null });
    const selectSpy = vi.fn(() => ({ in: inSpy }));
    const fromSpy = vi.fn(() => ({ select: selectSpy }));
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const load = makeLoadAttendanceForSessions(() => client);
    const rows = await load(['session-1', 'session-2']);

    expect(fromSpy).toHaveBeenCalledWith('attendance');
    expect(inSpy).toHaveBeenCalledWith('session_id', ['session-1', 'session-2']);
    expect(rows).toEqual([
      {
        id: 'att-1',
        sessionId: 'session-1',
        studentId: 'student-amara',
        status: 'present',
        checkInAt: '2026-08-02T14:05:00.000Z',
        checkOutAt: null,
        hoursOverride: null,
        method: 'qr',
        recordedBy: 'student-amara',
        updatedAt: '2026-08-02T14:05:00.000Z',
        createdAt: '2026-08-02T14:05:00.000Z',
      },
    ]);
  });

  it('short-circuits to [] for an empty sessionIds array without querying the client at all', async () => {
    const fromSpy = vi.fn();
    const client = { from: fromSpy } as unknown as SupabaseClient;
    const load = makeLoadAttendanceForSessions(() => client);
    expect(await load([])).toEqual([]);
    expect(fromSpy).not.toHaveBeenCalled();
  });
});

describe('makeUpsertAttendance (module doc #3 -- onConflict, no check_in_at/check_out_at)', () => {
  it('upserts the exact real column set, onConflict session_id,student_id, never check_in_at/check_out_at', async () => {
    const dbRow = {
      id: 'att-2',
      session_id: 'session-1',
      student_id: 'student-sofia',
      status: 'present',
      check_in_at: null,
      check_out_at: null,
      hours_override: null,
      method: 'coach',
      recorded_by: COACH_PROFILE_ID,
      updated_at: '2026-07-20T00:00:00.000Z',
      created_at: '2026-07-20T00:00:00.000Z',
    };
    const singleSpy = vi.fn().mockResolvedValue({ data: dbRow, error: null });
    const selectSpy = vi.fn(() => ({ single: singleSpy }));
    const upsertSpy = vi.fn<
      (
        payload: Record<string, unknown>,
        options: { onConflict: string },
      ) => { select: typeof selectSpy }
    >(() => ({ select: selectSpy }));
    const fromSpy = vi.fn(() => ({ upsert: upsertSpy }));
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const upsert = makeUpsertAttendance(() => client);
    const result = await upsert({
      sessionId: 'session-1',
      studentId: 'student-sofia',
      status: 'present',
      hoursOverride: null,
      method: 'coach',
      recordedBy: COACH_PROFILE_ID,
    });

    expect(fromSpy).toHaveBeenCalledWith('attendance');
    expect(upsertSpy).toHaveBeenCalledWith(
      {
        session_id: 'session-1',
        student_id: 'student-sofia',
        status: 'present',
        hours_override: null,
        method: 'coach',
        recorded_by: COACH_PROFILE_ID,
      },
      { onConflict: 'session_id,student_id' },
    );
    const payload = upsertSpy.mock.calls[0][0];
    expect(Object.keys(payload)).not.toContain('check_in_at');
    expect(Object.keys(payload)).not.toContain('check_out_at');
    expect(result.id).toBe('att-2');
    expect(result.method).toBe('coach');
  });
});

describe('makeRemoveAttendance', () => {
  it('deletes by session_id + student_id', async () => {
    const secondEqSpy = vi.fn().mockResolvedValue({ data: null, error: null });
    const firstEqSpy = vi.fn(() => ({ eq: secondEqSpy }));
    const deleteSpy = vi.fn(() => ({ eq: firstEqSpy }));
    const fromSpy = vi.fn(() => ({ delete: deleteSpy }));
    const client = { from: fromSpy } as unknown as SupabaseClient;

    const remove = makeRemoveAttendance(() => client);
    await remove({ sessionId: 'session-1', studentId: 'student-sofia' });

    expect(fromSpy).toHaveBeenCalledWith('attendance');
    expect(firstEqSpy).toHaveBeenCalledWith('session_id', 'session-1');
    expect(secondEqSpy).toHaveBeenCalledWith('student_id', 'student-sofia');
  });
});

// ---------------------------------------------------------------------------
// Component tests.
// ---------------------------------------------------------------------------

function renderPanel(props: Partial<Parameters<typeof AttendancePanel>[0]> = {}): void {
  act(() => {
    root.render(
      <AttendancePanel
        sessions={[SESSION_1]}
        roster={ROSTER}
        teams={TEAMS}
        currentUserProfileId={COACH_PROFILE_ID}
        loadAttendance={async () => []}
        onUpsertAttendance={vi.fn()}
        onRemoveAttendance={vi.fn()}
        {...props}
      />,
    );
  });
}

describe('<AttendancePanel /> DES-12 states', () => {
  it('loading -> a skeleton + "Loading attendance" status text', () => {
    renderPanel({ loadAttendance: () => new Promise<AttendanceRow[]>(() => {}) });
    expect(container.textContent).toContain('Loading attendance');
  });

  it('error -> Banner with Retry, retry re-invokes loadAttendance', async () => {
    let calls = 0;
    const loadAttendance = vi.fn(async () => {
      calls += 1;
      if (calls === 1) throw new Error('network down');
      return [];
    });
    renderPanel({ loadAttendance });
    await flushMicrotasks();

    expect(container.textContent).toContain("Couldn't load attendance");
    const retryButton = findButtonByText('Retry');
    expect(retryButton).toBeTruthy();
    clickElement(retryButton as HTMLButtonElement);
    await flushMicrotasks();

    expect(loadAttendance).toHaveBeenCalledTimes(2);
    expect(container.textContent).not.toContain("Couldn't load attendance");
  });

  it('populated -> renders roster grouped by team chips; hours field only on checked rows', async () => {
    renderPanel({
      loadAttendance: async () => [makeRow({ status: 'present', hoursOverride: null })],
    });
    await flushMicrotasks();

    expect(container.textContent).toContain('Amara Chen');
    expect(container.textContent).toContain('Sofia Delgado');
    expect(container.textContent).toContain('Ravens');
    expect(container.textContent).toContain('Titans');

    const amaraCheckbox = getFieldControl('Amara Chen') as HTMLInputElement;
    const sofiaCheckbox = getFieldControl('Sofia Delgado') as HTMLInputElement;
    expect(amaraCheckbox.checked).toBe(true);
    expect(sofiaCheckbox.checked).toBe(false);

    // Figure-verified pattern (module doc #2): hours field only for the
    // checked row, defaulting to the session duration.
    const amaraHours = getFieldControl('Amara Chen hours') as HTMLInputElement;
    expect(amaraHours.value).toBe('8');
    expect(() => getFieldControl('Sofia Delgado hours')).toThrow();
  });

  it('excludes canceled sessions from the panel entirely', async () => {
    renderPanel({ sessions: [SESSION_1, CANCELED_SESSION], loadAttendance: async () => [] });
    await flushMicrotasks();
    expect(container.textContent).not.toContain('Aug 3');
  });

  it('shows a compact empty-state line when the roster is empty (UXD-05b)', async () => {
    renderPanel({ roster: [], loadAttendance: async () => [] });
    await flushMicrotasks();
    expect(container.textContent).toContain('No students on this event');
  });
});

describe('<AttendancePanel /> checking a student with no existing row (module doc #5/#6)', () => {
  it('upserts status present, method coach, hoursOverride null, recordedBy the acting coach', async () => {
    const onUpsertAttendance = vi
      .fn()
      .mockResolvedValue(
        makeRow({ studentId: 'student-sofia', status: 'present', method: 'coach' }),
      );
    renderPanel({ loadAttendance: async () => [], onUpsertAttendance });
    await flushMicrotasks();

    const sofiaCheckbox = getFieldControl('Sofia Delgado') as HTMLInputElement;
    clickElement(sofiaCheckbox);
    await flushMicrotasks();

    expect(onUpsertAttendance).toHaveBeenCalledWith({
      sessionId: 'session-1',
      studentId: 'student-sofia',
      status: 'present',
      hoursOverride: null,
      method: 'coach',
      recordedBy: COACH_PROFILE_ID,
    });
    expect((getFieldControl('Sofia Delgado') as HTMLInputElement).checked).toBe(true);
  });
});

describe('<AttendancePanel /> Trap #2 -- un-marking (unchecking) an attended student (T119/D-7: plain DELETE for every method)', () => {
  it('a coach-originated row is DELETED on uncheck, not upserted', async () => {
    const onRemoveAttendance = vi.fn().mockResolvedValue(undefined);
    const onUpsertAttendance = vi.fn();
    renderPanel({
      loadAttendance: async () => [makeRow({ method: 'coach', status: 'present' })],
      onUpsertAttendance,
      onRemoveAttendance,
    });
    await flushMicrotasks();

    const amaraCheckbox = getFieldControl('Amara Chen') as HTMLInputElement;
    expect(amaraCheckbox.checked).toBe(true);
    clickElement(amaraCheckbox);
    await flushMicrotasks();

    expect(onRemoveAttendance).toHaveBeenCalledWith({
      sessionId: 'session-1',
      studentId: 'student-amara',
    });
    expect(onUpsertAttendance).not.toHaveBeenCalled();
    expect((getFieldControl('Amara Chen') as HTMLInputElement).checked).toBe(false);
  });

  it('T119/D-7 inversion: a real qr-originated row is HARD-DELETED on uncheck too, never demoted to absent', async () => {
    const onRemoveAttendance = vi.fn().mockResolvedValue(undefined);
    const onUpsertAttendance = vi.fn();
    renderPanel({
      loadAttendance: async () => [
        makeRow({
          method: 'qr',
          status: 'present',
          checkInAt: '2026-08-02T14:05:00.000Z',
          recordedBy: 'student-amara',
        }),
      ],
      onUpsertAttendance,
      onRemoveAttendance,
    });
    await flushMicrotasks();

    const amaraCheckbox = getFieldControl('Amara Chen') as HTMLInputElement;
    clickElement(amaraCheckbox);
    await flushMicrotasks();

    // T117's `resolveUnmarkAction`/`setAbsent` branch is removed (T119/D-7:
    // "coach attendance corrections MAY remove QR-originated check-in rows
    // outright") -- a real qr row is now DELETED exactly like a coach row,
    // never upserted to `status: 'absent'`.
    expect(onRemoveAttendance).toHaveBeenCalledWith({
      sessionId: 'session-1',
      studentId: 'student-amara',
    });
    expect(onUpsertAttendance).not.toHaveBeenCalled();
    expect((getFieldControl('Amara Chen') as HTMLInputElement).checked).toBe(false);
  });

  it('T119/D-7 inversion: a real import-originated row is also HARD-DELETED on uncheck', async () => {
    const onRemoveAttendance = vi.fn().mockResolvedValue(undefined);
    const onUpsertAttendance = vi.fn();
    renderPanel({
      loadAttendance: async () => [makeRow({ method: 'import', status: 'present' })],
      onUpsertAttendance,
      onRemoveAttendance,
    });
    await flushMicrotasks();

    const amaraCheckbox = getFieldControl('Amara Chen') as HTMLInputElement;
    clickElement(amaraCheckbox);
    await flushMicrotasks();

    expect(onRemoveAttendance).toHaveBeenCalledWith({
      sessionId: 'session-1',
      studentId: 'student-amara',
    });
    expect(onUpsertAttendance).not.toHaveBeenCalled();
  });

  it('rolls back the checked display and shows an inline error when the mutation rejects', async () => {
    const onRemoveAttendance = vi.fn().mockRejectedValue(new Error('write failed'));
    renderPanel({
      loadAttendance: async () => [makeRow({ method: 'coach', status: 'present' })],
      onRemoveAttendance,
    });
    await flushMicrotasks();

    const amaraCheckbox = getFieldControl('Amara Chen') as HTMLInputElement;
    clickElement(amaraCheckbox);
    await flushMicrotasks();

    // Rolled back to committed truth (still checked -- the delete never
    // actually happened), never silently left showing an unpersisted state.
    expect((getFieldControl('Amara Chen') as HTMLInputElement).checked).toBe(true);
    expect(container.textContent).toContain('write failed');
  });
});

describe('<AttendancePanel /> hours edit persists on blur, only when actually changed (module doc #5)', () => {
  it('commits an explicit hoursOverride on blur after an edit', async () => {
    const onUpsertAttendance = vi
      .fn()
      .mockResolvedValue(makeRow({ status: 'present', hoursOverride: 5, method: 'coach' }));
    renderPanel({
      loadAttendance: async () => [makeRow({ method: 'coach', status: 'present' })],
      onUpsertAttendance,
    });
    await flushMicrotasks();

    const hoursInput = getFieldControl('Amara Chen hours') as HTMLInputElement;
    act(() => {
      setNativeInputValue(hoursInput, '5');
    });
    blurElement(hoursInput);
    await flushMicrotasks();

    expect(onUpsertAttendance).toHaveBeenCalledWith({
      sessionId: 'session-1',
      studentId: 'student-amara',
      status: 'present',
      hoursOverride: 5,
      method: 'coach',
      recordedBy: COACH_PROFILE_ID,
    });
  });

  it('does NOT write anything on blur when the coach never touched the hours field', async () => {
    const onUpsertAttendance = vi.fn();
    renderPanel({
      loadAttendance: async () => [makeRow({ method: 'coach', status: 'present' })],
      onUpsertAttendance,
    });
    await flushMicrotasks();

    const hoursInput = getFieldControl('Amara Chen hours') as HTMLInputElement;
    blurElement(hoursInput); // blur with no prior edit
    await flushMicrotasks();

    expect(onUpsertAttendance).not.toHaveBeenCalled();
  });

  it('leaves the typed value visible (no silent revert) and shows an inline error when the hours save rejects', async () => {
    const onUpsertAttendance = vi.fn().mockRejectedValue(new Error("couldn't save hours"));
    renderPanel({
      loadAttendance: async () => [makeRow({ method: 'coach', status: 'present' })],
      onUpsertAttendance,
    });
    await flushMicrotasks();

    const hoursInput = getFieldControl('Amara Chen hours') as HTMLInputElement;
    act(() => {
      setNativeInputValue(hoursInput, '2');
    });
    blurElement(hoursInput);
    await flushMicrotasks();

    expect((getFieldControl('Amara Chen hours') as HTMLInputElement).value).toBe('2');
    expect(container.textContent).toContain("couldn't save hours");
  });
});

describe('<AttendancePanel /> running totals (module doc #7 -- local sum, not a v_student_hours query)', () => {
  it('shows per-day "N attending · M h" and an event "recorded" total', async () => {
    renderPanel({
      loadAttendance: async () => [makeRow({ status: 'present', hoursOverride: 4 })],
    });
    await flushMicrotasks();

    expect(container.textContent).toContain('1 attending');
    expect(container.textContent).toContain('4 h');
    expect(container.textContent).toContain('4h recorded');
  });
});
