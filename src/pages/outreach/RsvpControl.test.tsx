// @vitest-environment jsdom
/**
 * T040: tests for `RsvpControl.tsx`.
 *
 * Per this task's Allowed Files, a colocated test file is an explicitly
 * sanctioned addition (same precedent `OutreachList.test.tsx`/T038,
 * `OutreachEventDialog.test.tsx`/T039, `ScheduleMeetingsDialog.test.tsx`/T031
 * already established) -- it exists to produce the DOM-text/behavior proof
 * this task's own packet requires in "Required Worker Output" (the
 * label-vs-stored-value mapping, the session-start lock boundary, and
 * `responded_by` attribution to a real profile id).
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- these tests use the same raw `createRoot`/`act`
 * pattern every other sibling test file in this batch already established.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildRsvpConfirmationCopy,
  isRsvpEditable,
  isSessionTimeEditable,
  PLACEHOLDER_CURRENT_USER_PROFILE_ID,
  RSVP_ITEMS,
  RsvpControl,
  rsvpStatusLabel,
  type OnRsvpChangeFn,
  type RsvpControlSession,
  type RsvpRow,
} from './RsvpControl';

/** Typed `vi.fn()` helper so `.mock.calls[0][0]` is inferred as
 * `RsvpChangeParams`, not an empty tuple -- avoids both the TS "no element
 * at index 0" error an untyped mock produces AND an unused-parameter lint
 * error from annotating the mock's own callback signature directly. */
function createRsvpChangeMock(
  impl: OnRsvpChangeFn = async () => {},
): ReturnType<typeof vi.fn<OnRsvpChangeFn>> {
  return vi.fn(impl);
}

// ---------------------------------------------------------------------------
// Render harness -- mirrors OutreachList.test.tsx / OutreachEventDialog.test.tsx.
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
  vi.useRealTimers();
});

async function flushMicrotasks(): Promise<void> {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

function radiogroup(): Element | null {
  return container.querySelector('[role="radiogroup"]');
}

function segmentButton(value: 'going' | 'maybe' | 'declined'): HTMLButtonElement | null {
  return radiogroup()?.querySelector(`button[data-value="${value}"]`) ?? null;
}

const BASE_SESSION: RsvpControlSession = {
  id: 'session-1',
  eventId: 'event-1',
  sessionDate: '2026-08-02',
  startsAt: '2026-08-02T14:00:00.000Z',
  endsAt: '2026-08-02T17:00:00.000Z',
  status: 'scheduled',
  peopleReached: null,
};

const STUDENT_ID = 'student-lena-osei';
const REAL_PROFILE_ID = 'profile-real-lena-osei-uuid';

// ---------------------------------------------------------------------------
// 1. Label-vs-stored-value mapping (packet's own explicit disclosure
//    requirement) -- OUT-03's literal labels, "Can't go" -> 'declined'.
// ---------------------------------------------------------------------------

describe('RSVP_ITEMS label-vs-stored-value mapping', () => {
  it('uses OUT-03 literal labels ("Sign up" / "Maybe" / "Can\'t go"), not "Going"', () => {
    expect(RSVP_ITEMS).toEqual([
      { value: 'going', label: 'Sign up' },
      { value: 'maybe', label: 'Maybe' },
      { value: 'declined', label: "Can't go" },
    ]);
  });

  it('maps the "Can\'t go" label to the real rsvps.status enum value "declined" (not a literal "can\'t go" string)', () => {
    const cantGoItem = RSVP_ITEMS.find((item) => item.label === "Can't go");
    expect(cantGoItem?.value).toBe('declined');
    expect(rsvpStatusLabel('declined')).toBe("Can't go");
  });
});

// ---------------------------------------------------------------------------
// 2. Session-start lock boundary -- pure-function proof (packet's own
//    literal "1 minute in the future is editable / 1 minute ago is locked"
//    instruction).
// ---------------------------------------------------------------------------

describe('isSessionTimeEditable / isRsvpEditable -- session-start lock boundary', () => {
  it('a session starting in 1 minute is still editable', () => {
    const now = new Date('2026-08-02T13:59:00.000Z');
    const startsAt = '2026-08-02T14:00:00.000Z'; // 1 minute after `now`
    expect(isSessionTimeEditable(startsAt, now)).toBe(true);
    expect(isRsvpEditable({ ...BASE_SESSION, startsAt }, now)).toBe(true);
  });

  it('a session that started 1 minute ago is locked', () => {
    const now = new Date('2026-08-02T14:01:00.000Z');
    const startsAt = '2026-08-02T14:00:00.000Z'; // 1 minute before `now`
    expect(isSessionTimeEditable(startsAt, now)).toBe(false);
    expect(isRsvpEditable({ ...BASE_SESSION, startsAt }, now)).toBe(false);
  });

  it('a canceled/completed session is never editable, even if starts_at is still in the future', () => {
    const now = new Date('2026-08-02T13:00:00.000Z');
    const futureStartsAt = '2026-08-02T14:00:00.000Z';
    expect(isSessionTimeEditable(futureStartsAt, now)).toBe(true); // bare time check alone
    expect(
      isRsvpEditable({ ...BASE_SESSION, startsAt: futureStartsAt, status: 'canceled' }, now),
    ).toBe(false);
    expect(
      isRsvpEditable({ ...BASE_SESSION, startsAt: futureStartsAt, status: 'completed' }, now),
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 3. Component-level lock proof: editable vs. locked render, and a genuinely
//    inert (not merely styled) locked control.
// ---------------------------------------------------------------------------

describe('RsvpControl -- editable vs. locked rendering', () => {
  it('renders an interactive, enabled control + BEH-09 helper text when the session starts in 1 minute', async () => {
    const now = () => new Date('2026-08-02T13:59:00.000Z');
    act(() => {
      root.render(
        <RsvpControl
          studentId={STUDENT_ID}
          session={BASE_SESSION}
          eventTitle="Community Food Bank Sort"
          currentRsvp={null}
          now={now}
        />,
      );
    });
    await flushMicrotasks();

    const group = radiogroup();
    expect(group).toBeTruthy();
    expect(group?.getAttribute('aria-label')).toBe(
      'Your RSVP for Community Food Bank Sort on Sun, Aug 2',
    );
    expect(segmentButton('going')?.getAttribute('aria-disabled')).not.toBe('true');
    // BEH-09 literal helper text, verbatim.
    expect(container.textContent).toContain('You can change this until the event starts.');
    expect(container.textContent).not.toContain('RSVP locked');
  });

  it('renders a genuinely inert, clearly-labeled locked control when the session started 1 minute ago', async () => {
    const now = () => new Date('2026-08-02T14:01:00.000Z');
    const onRsvpChange = createRsvpChangeMock();
    act(() => {
      root.render(
        <RsvpControl
          studentId={STUDENT_ID}
          session={BASE_SESSION}
          eventTitle="Community Food Bank Sort"
          currentRsvp={null}
          onRsvpChange={onRsvpChange}
          now={now}
        />,
      );
    });
    await flushMicrotasks();

    const goingButton = segmentButton('going');
    expect(goingButton?.getAttribute('aria-disabled')).toBe('true');

    // Genuinely inert: clicking a locked segment must NOT invoke onRsvpChange
    // (SegmentedControlItem's own handleClick guards on isItemDisabled
    // before calling ctx.onChange -- module doc #4).
    act(() => {
      goingButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();
    expect(onRsvpChange).not.toHaveBeenCalled();

    // Clear, always-visible (not hover-only) locked messaging.
    expect(container.textContent).toContain(
      'RSVP locked — this session already started. Your recorded response: no response recorded.',
    );
    expect(container.textContent).not.toContain('You can change this until the event starts.');
  });

  it('locks live, without a remount, the moment the session-start boundary is crossed', async () => {
    vi.useFakeTimers();
    const start = new Date('2026-08-02T13:59:59.900Z').getTime(); // 100ms before starts_at
    vi.setSystemTime(start);
    const now = () => new Date();

    act(() => {
      root.render(
        <RsvpControl
          studentId={STUDENT_ID}
          session={BASE_SESSION}
          eventTitle="Community Food Bank Sort"
          currentRsvp={null}
          now={now}
        />,
      );
    });

    expect(segmentButton('going')?.getAttribute('aria-disabled')).not.toBe('true');

    act(() => {
      vi.setSystemTime(start + 200); // now past starts_at
      vi.advanceTimersByTime(200);
    });

    expect(segmentButton('going')?.getAttribute('aria-disabled')).toBe('true');
    expect(container.textContent).toContain('RSVP locked');
  });
});

// ---------------------------------------------------------------------------
// 4. `responded_by` -- a real profiles id, never a literal 'student' string
//    (packet's own explicit acceptance criterion).
// ---------------------------------------------------------------------------

describe('RsvpControl -- responded_by attribution', () => {
  it('passes the injected currentUserProfileId (a real profiles.id), never a hardcoded role string', async () => {
    const now = () => new Date('2026-08-02T13:00:00.000Z');
    const onRsvpChange = createRsvpChangeMock();

    act(() => {
      root.render(
        <RsvpControl
          studentId={STUDENT_ID}
          session={BASE_SESSION}
          eventTitle="Community Food Bank Sort"
          currentRsvp={null}
          currentUserProfileId={REAL_PROFILE_ID}
          onRsvpChange={onRsvpChange}
          now={now}
        />,
      );
    });
    await flushMicrotasks();

    act(() => {
      segmentButton('going')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();

    expect(onRsvpChange).toHaveBeenCalledTimes(1);
    const params = onRsvpChange.mock.calls[0]?.[0];
    expect(params).toEqual({
      sessionId: 'session-1',
      studentId: STUDENT_ID,
      status: 'going',
      respondedBy: REAL_PROFILE_ID,
    });
    expect(params?.respondedBy).not.toBe('student');
    expect(params?.respondedBy).not.toBe(STUDENT_ID); // profiles.id != students.id space
  });

  it('defaults to the disclosed placeholder profiles.id when no auth seam is injected', async () => {
    const now = () => new Date('2026-08-02T13:00:00.000Z');
    const onRsvpChange = createRsvpChangeMock();

    act(() => {
      root.render(
        <RsvpControl
          studentId={STUDENT_ID}
          session={BASE_SESSION}
          eventTitle="Community Food Bank Sort"
          currentRsvp={null}
          onRsvpChange={onRsvpChange}
          now={now}
        />,
      );
    });
    await flushMicrotasks();

    act(() => {
      segmentButton('maybe')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();

    const params = onRsvpChange.mock.calls[0]?.[0];
    expect(params?.respondedBy).toBe(PLACEHOLDER_CURRENT_USER_PROFILE_ID);
  });
});

// ---------------------------------------------------------------------------
// 5. BEH-09 post-save confirmation copy + rollback-on-failure.
// ---------------------------------------------------------------------------

describe('RsvpControl -- confirmation + rollback', () => {
  it('shows an honest, static BEH-09 confirmation naming T051 as not-yet-built after a successful save', () => {
    const copy = buildRsvpConfirmationCopy('going');
    expect(copy.title).toBe('RSVP saved: Sign up');
    expect(copy.description).toContain("We'll remind you 2 days before this event");
    expect(copy.description).toContain("hasn't been built yet");
    expect(copy.description).toContain('no reminder is actually scheduled');
  });

  it('renders the confirmation banner in the DOM after a real successful selection', async () => {
    const now = () => new Date('2026-08-02T13:00:00.000Z');
    const onRsvpChange = createRsvpChangeMock();

    act(() => {
      root.render(
        <RsvpControl
          studentId={STUDENT_ID}
          session={BASE_SESSION}
          eventTitle="Community Food Bank Sort"
          currentRsvp={null}
          onRsvpChange={onRsvpChange}
          now={now}
        />,
      );
    });
    await flushMicrotasks();

    act(() => {
      segmentButton('declined')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();

    expect(container.textContent).toContain("RSVP saved: Can't go");
    expect(segmentButton('declined')?.getAttribute('aria-checked')).toBe('true');
  });

  it('rolls back the optimistic selection and shows an error banner when the save fails', async () => {
    const now = () => new Date('2026-08-02T13:00:00.000Z');
    const currentRsvp: RsvpRow = {
      id: 'rsvp-1',
      sessionId: 'session-1',
      studentId: STUDENT_ID,
      status: 'maybe',
      respondedBy: REAL_PROFILE_ID,
      updatedAt: '2026-07-01T00:00:00.000Z',
      createdAt: '2026-07-01T00:00:00.000Z',
    };
    const onRsvpChange = createRsvpChangeMock(async () => {
      throw new Error('Network error');
    });

    act(() => {
      root.render(
        <RsvpControl
          studentId={STUDENT_ID}
          session={BASE_SESSION}
          eventTitle="Community Food Bank Sort"
          currentRsvp={currentRsvp}
          onRsvpChange={onRsvpChange}
          now={now}
        />,
      );
    });
    await flushMicrotasks();
    expect(segmentButton('maybe')?.getAttribute('aria-checked')).toBe('true');

    act(() => {
      segmentButton('going')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();

    expect(container.textContent).toContain("Couldn't save your RSVP");
    expect(container.textContent).toContain('Network error');
    // Rolled back to the previous, actually-persisted value.
    expect(segmentButton('maybe')?.getAttribute('aria-checked')).toBe('true');
    expect(segmentButton('going')?.getAttribute('aria-checked')).toBe('false');
  });
});

// ---------------------------------------------------------------------------
// 6. No box-drawing/bracket wireframe characters (constitution item 13).
// ---------------------------------------------------------------------------

describe('RsvpControl -- constitution item 13', () => {
  it('never renders literal box-drawing or bracket wireframe characters', async () => {
    const now = () => new Date('2026-08-02T13:00:00.000Z');
    act(() => {
      root.render(
        <RsvpControl
          studentId={STUDENT_ID}
          session={BASE_SESSION}
          eventTitle="Community Food Bank Sort"
          currentRsvp={null}
          now={now}
        />,
      );
    });
    await flushMicrotasks();

    expect(container.textContent ?? '').not.toMatch(/[─-╿]/); // box-drawing range
    expect(container.textContent ?? '').not.toMatch(/\[.*\|.*\]/); // "[a|b|c]" wireframe style
  });
});
