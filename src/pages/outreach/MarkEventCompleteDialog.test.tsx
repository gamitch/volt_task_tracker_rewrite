// @vitest-environment jsdom
/**
 * T127 (PRD v2 UXP-07): tests for `MarkEventCompleteDialog.tsx`.
 *
 * Same raw `createRoot`/`act` render harness (no `@testing-library/react`
 * installed) and `HTMLDialogElement.showModal` polyfill
 * `MarkDayCompleteDialog.test.tsx` already established for this exact
 * `Dialog` component.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MarkDayCompletePayload } from './MarkDayCompleteDialog';
import {
  buildMarkEventCompletePayload,
  computeCompletionSummaryText,
  computeMarkEventCompleteConfirmLabel,
  MarkEventCompleteDialog,
  partitionEventSessions,
  type MarkEventCompleteDialogProps,
} from './MarkEventCompleteDialog';

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
// Fixtures.
// ---------------------------------------------------------------------------

const SESSION_1: MarkEventCompleteDialogProps['sessions'][number] = {
  id: 'session-1',
  eventId: 'event-1',
  sessionDate: '2026-08-02',
  startsAt: '2026-08-02T14:00:00.000Z',
  endsAt: '2026-08-02T21:00:00.000Z', // 7h
  status: 'scheduled',
  peopleReached: null,
  notes: '',
};

const SESSION_2: MarkEventCompleteDialogProps['sessions'][number] = {
  id: 'session-2',
  eventId: 'event-1',
  sessionDate: '2026-08-09',
  startsAt: '2026-08-09T14:00:00.000Z',
  endsAt: '2026-08-09T21:00:00.000Z',
  status: 'scheduled',
  peopleReached: 30,
  notes: '',
};

const SESSION_COMPLETED: MarkEventCompleteDialogProps['sessions'][number] = {
  id: 'session-done',
  eventId: 'event-1',
  sessionDate: '2026-07-26',
  startsAt: '2026-07-26T14:00:00.000Z',
  endsAt: '2026-07-26T21:00:00.000Z',
  status: 'completed',
  peopleReached: 50,
  notes: '',
};

const SESSION_CANCELED: MarkEventCompleteDialogProps['sessions'][number] = {
  id: 'session-canceled',
  eventId: 'event-1',
  sessionDate: '2026-07-19',
  startsAt: '2026-07-19T14:00:00.000Z',
  endsAt: '2026-07-19T21:00:00.000Z',
  status: 'canceled',
  peopleReached: null,
  notes: '',
};

const ROSTER: MarkEventCompleteDialogProps['roster'] = [
  { id: 'student-going-1', name: 'Gwen Going', teamId: 'team-a' },
  { id: 'student-going-2', name: 'Gale Going', teamId: 'team-a' },
  { id: 'student-maybe', name: 'Mateo Maybe', teamId: 'team-a' },
];

const RSVPS: MarkEventCompleteDialogProps['rsvps'] = [
  {
    id: 'rsvp-1',
    sessionId: 'session-1',
    studentId: 'student-going-1',
    status: 'going',
    respondedBy: 'student-going-1',
    updatedAt: '2026-07-20T09:00:00.000Z',
    createdAt: '2026-07-20T09:00:00.000Z',
  },
  {
    id: 'rsvp-2',
    sessionId: 'session-2',
    studentId: 'student-going-2',
    status: 'going',
    respondedBy: 'student-going-2',
    updatedAt: '2026-07-20T09:00:00.000Z',
    createdAt: '2026-07-20T09:00:00.000Z',
  },
  {
    id: 'rsvp-3',
    sessionId: 'session-1',
    studentId: 'student-maybe',
    status: 'maybe',
    respondedBy: 'student-maybe',
    updatedAt: '2026-07-20T09:00:00.000Z',
    createdAt: '2026-07-20T09:00:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// Pure functions.
// ---------------------------------------------------------------------------

describe('partitionEventSessions (module doc #4 -- skipped sessions never reprocessed)', () => {
  it('splits scheduled sessions into remaining, everything else into skipped, both sorted chronologically', () => {
    const { remaining, skipped } = partitionEventSessions([
      SESSION_2,
      SESSION_CANCELED,
      SESSION_1,
      SESSION_COMPLETED,
    ]);
    expect(remaining.map((s) => s.id)).toEqual(['session-1', 'session-2']);
    expect(skipped.map((s) => s.id)).toEqual(['session-canceled', 'session-done']);
  });
});

describe('computeMarkEventCompleteConfirmLabel', () => {
  it('pluralizes correctly and never renders a bare verb', () => {
    expect(computeMarkEventCompleteConfirmLabel(1)).toBe('Mark 1 session complete');
    expect(computeMarkEventCompleteConfirmLabel(3)).toBe('Mark 3 sessions complete');
  });
});

describe('buildMarkEventCompletePayload (module doc #1/#2 -- reuse evidence)', () => {
  it('derives the attendance checklist from going RSVPs, same as the per-day dialog, with no manual override', () => {
    const payload = buildMarkEventCompletePayload(SESSION_1, 120, ROSTER, RSVPS, 'profile-coach-1');
    expect(payload.sessionId).toBe('session-1');
    expect(payload.peopleReached).toBe(120);
    expect(payload.recordedBy).toBe('profile-coach-1');
    expect(payload.attendance).toHaveLength(1);
    expect(payload.attendance[0].studentId).toBe('student-going-1');
    expect(payload.attendance[0].status).toBe('present');
    expect(payload.attendance[0].method).toBe('coach');
    expect(payload.attendance[0].hoursOverride).toBeNull();
  });

  it('always writes zero adult-volunteer deltas (module doc #2(b) -- disclosed scope narrowing)', () => {
    const payload = buildMarkEventCompletePayload(
      SESSION_1,
      null,
      ROSTER,
      RSVPS,
      'profile-coach-1',
    );
    expect(payload.adultVolunteersCountThisSession).toBe(0);
    expect(payload.adultVolunteerHoursThisSession).toBe(0);
  });

  it('passes peopleReached through verbatim, including null', () => {
    const payload = buildMarkEventCompletePayload(
      SESSION_1,
      null,
      ROSTER,
      RSVPS,
      'profile-coach-1',
    );
    expect(payload.peopleReached).toBeNull();
  });
});

describe('computeCompletionSummaryText', () => {
  it('always includes the completed count', () => {
    expect(computeCompletionSummaryText(2, 0, 0)).toBe('2 completed');
  });

  it('includes failed/skipped counts only when nonzero', () => {
    expect(computeCompletionSummaryText(1, 1, 2)).toBe('1 completed · 1 failed · 2 skipped');
    expect(computeCompletionSummaryText(0, 0, 3)).toBe('0 completed · 3 skipped');
  });
});

// ---------------------------------------------------------------------------
// DOM behavior.
// ---------------------------------------------------------------------------

describe('<MarkEventCompleteDialog /> listing (packet Objective)', () => {
  it('lists every remaining session with a people-reached input, and skipped sessions read-only', () => {
    act(() => {
      root.render(
        <MarkEventCompleteDialog
          isOpen
          onOpenChange={() => {}}
          eventTitle="Community Food Bank Sort"
          sessions={[SESSION_1, SESSION_2, SESSION_COMPLETED, SESSION_CANCELED]}
          roster={ROSTER}
          rsvps={RSVPS}
        />,
      );
    });

    expect(() => getFieldControl('People reached — ')).not.toThrow();
    expect(findButtonByText('Mark 2 sessions complete')).toBeDefined();
    expect(container.textContent).toContain('already completed');
    expect(container.textContent).toContain('already canceled');
    // Skipped sessions get no editable NumberInput -- only 2 remaining
    // sessions' worth of "People reached" labels exist.
    const peopleReachedLabels = Array.from(container.querySelectorAll('label')).filter((label) =>
      label.textContent?.startsWith('People reached'),
    );
    expect(peopleReachedLabels).toHaveLength(2);
  });

  it('seeds the people-reached input from the session’s own existing value', () => {
    act(() => {
      root.render(
        <MarkEventCompleteDialog
          isOpen
          onOpenChange={() => {}}
          sessions={[SESSION_2]}
          roster={ROSTER}
          rsvps={RSVPS}
        />,
      );
    });
    const input = getFieldControl('People reached') as HTMLInputElement;
    expect(input.value).toBe('30');
  });

  it('shows a "no sessions to mark complete" banner and only a Close button when nothing remains', () => {
    act(() => {
      root.render(
        <MarkEventCompleteDialog
          isOpen
          onOpenChange={() => {}}
          sessions={[SESSION_COMPLETED, SESSION_CANCELED]}
          roster={ROSTER}
          rsvps={RSVPS}
        />,
      );
    });
    expect(container.textContent).toContain('No sessions to mark complete');
    expect(findButtonByText('Close')).toBeDefined();
    expect(findButtonByText('Cancel')).toBeUndefined();
  });
});

describe('<MarkEventCompleteDialog /> confirm -> per-session mutation (module doc #1 -- reuse evidence)', () => {
  it('calls onMarkSessionComplete once per remaining session, never for a skipped one', async () => {
    const onMarkSessionComplete = vi.fn<(payload: MarkDayCompletePayload) => Promise<void>>(
      async () => {},
    );
    act(() => {
      root.render(
        <MarkEventCompleteDialog
          isOpen
          onOpenChange={() => {}}
          sessions={[SESSION_1, SESSION_2, SESSION_COMPLETED]}
          roster={ROSTER}
          rsvps={RSVPS}
          onMarkSessionComplete={onMarkSessionComplete}
        />,
      );
    });

    clickElement(findButtonByText('Mark 2 sessions complete') as HTMLButtonElement);
    await flushMicrotasks();

    expect(onMarkSessionComplete).toHaveBeenCalledTimes(2);
    const calledSessionIds = onMarkSessionComplete.mock.calls.map((call) => call[0].sessionId);
    expect(calledSessionIds).toEqual(['session-1', 'session-2']);
    expect(calledSessionIds).not.toContain('session-done');
  });

  it('never calls onMarkSessionComplete when Cancel is clicked', () => {
    const onMarkSessionComplete = vi.fn<(payload: MarkDayCompletePayload) => Promise<void>>(
      async () => {},
    );
    act(() => {
      root.render(
        <MarkEventCompleteDialog
          isOpen
          onOpenChange={() => {}}
          sessions={[SESSION_1]}
          roster={ROSTER}
          rsvps={RSVPS}
          onMarkSessionComplete={onMarkSessionComplete}
        />,
      );
    });
    clickElement(findButtonByText('Cancel') as HTMLButtonElement);
    expect(onMarkSessionComplete).not.toHaveBeenCalled();
  });
});

describe('<MarkEventCompleteDialog /> partial-failure honesty (module doc #3)', () => {
  it('reports done for a succeeding session and failed (with the real error message) for a rejecting one, then calls onFinished once', async () => {
    const onMarkSessionComplete = vi.fn<(payload: MarkDayCompletePayload) => Promise<void>>(
      async (payload) => {
        if (payload.sessionId === 'session-2') {
          throw new Error('RLS denied this write');
        }
      },
    );
    const onFinished = vi.fn();

    act(() => {
      root.render(
        <MarkEventCompleteDialog
          isOpen
          onOpenChange={() => {}}
          sessions={[SESSION_1, SESSION_2]}
          roster={ROSTER}
          rsvps={RSVPS}
          onMarkSessionComplete={onMarkSessionComplete}
          onFinished={onFinished}
        />,
      );
    });

    clickElement(findButtonByText('Mark 2 sessions complete') as HTMLButtonElement);
    await flushMicrotasks();

    expect(container.textContent).toContain('Done — marked complete');
    expect(container.textContent).toContain('Failed — RLS denied this write');
    expect(container.textContent).toContain('1 completed · 1 failed');
    expect(container.textContent).toContain("Some sessions couldn't be marked complete");
    expect(onFinished).toHaveBeenCalledTimes(1);
    // Editable inputs are gone once the batch has started/finished.
    expect(() => getFieldControl('People reached')).toThrow();
    // Only "Close" remains once submitted.
    expect(findButtonByText('Close')).toBeDefined();
    expect(findButtonByText('Cancel')).toBeUndefined();
  });

  it('shows a success banner and calls onFinished once when every session succeeds', async () => {
    const onMarkSessionComplete = vi.fn<(payload: MarkDayCompletePayload) => Promise<void>>(
      async () => {},
    );
    const onFinished = vi.fn();

    act(() => {
      root.render(
        <MarkEventCompleteDialog
          isOpen
          onOpenChange={() => {}}
          sessions={[SESSION_1, SESSION_2]}
          roster={ROSTER}
          rsvps={RSVPS}
          onMarkSessionComplete={onMarkSessionComplete}
          onFinished={onFinished}
        />,
      );
    });

    clickElement(findButtonByText('Mark 2 sessions complete') as HTMLButtonElement);
    await flushMicrotasks();

    expect(container.textContent).toContain('Event marked complete');
    expect(container.textContent).toContain('2 completed');
    expect(onFinished).toHaveBeenCalledTimes(1);
  });

  it('lets the coach change the people-reached value before confirming', async () => {
    const onMarkSessionComplete = vi.fn<(payload: MarkDayCompletePayload) => Promise<void>>(
      async () => {},
    );
    act(() => {
      root.render(
        <MarkEventCompleteDialog
          isOpen
          onOpenChange={() => {}}
          sessions={[SESSION_1]}
          roster={ROSTER}
          rsvps={RSVPS}
          onMarkSessionComplete={onMarkSessionComplete}
        />,
      );
    });
    const input = getFieldControl('People reached') as HTMLInputElement;
    act(() => {
      setNativeInputValue(input, '77');
    });
    clickElement(findButtonByText('Mark 1 session complete') as HTMLButtonElement);
    await flushMicrotasks();

    expect(onMarkSessionComplete).toHaveBeenCalledTimes(1);
    expect(onMarkSessionComplete.mock.calls[0][0].peopleReached).toBe(77);
  });
});
