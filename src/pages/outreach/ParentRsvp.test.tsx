// @vitest-environment jsdom
/**
 * T043: tests for `ParentRsvp.tsx`.
 *
 * Per this task's Allowed Files, a colocated test file is an explicitly
 * sanctioned addition (same precedent `RsvpControl.test.tsx`/T040 already
 * established) -- it exists to produce the DOM-text/behavior proof this
 * task's own packet requires in "Required Worker Output" (the
 * `responded_by`-to-specific-parent-identity resolution, both the
 * `respondedBy` attributed-to-a-parent case and the non-parent cases, and
 * that `responded_by` is always written as a real `profiles.id`, never a
 * literal `'parent'` string).
 *
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- these tests use the same raw `createRoot`/`act` pattern
 * every other sibling test file in this batch already established.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildResponderAttributionLabel,
  isRsvpEditable,
  isSessionTimeEditable,
  ParentRsvp,
  PLACEHOLDER_CURRENT_PARENT_PROFILE_ID,
  resolveRsvpResponderAttribution,
  RSVP_ITEMS,
  rsvpStatusLabel,
  type GuardianLinkRow,
  type OnRsvpChangeFn,
  type RsvpControlSession,
  type RsvpRow,
} from './ParentRsvp';

function createRsvpChangeMock(
  impl: OnRsvpChangeFn = async () => {},
): ReturnType<typeof vi.fn<OnRsvpChangeFn>> {
  return vi.fn(impl);
}

// ---------------------------------------------------------------------------
// Render harness -- mirrors RsvpControl.test.tsx.
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

// Fabricated, obviously-not-real fixture identities (constitution item 6).
const STUDENT_ID = 'student-lena-osei';
const STUDENT_PROFILE_ID = 'profile-real-lena-osei-uuid';
const MOM_PROFILE_ID = 'profile-real-adaeze-osei-uuid';
const DAD_PROFILE_ID = 'profile-real-chibueze-osei-uuid';
const COACH_PROFILE_ID = 'profile-real-coach-morales-uuid';

const GUARDIAN_LINKS: GuardianLinkRow[] = [
  { id: 'link-1', parentProfileId: MOM_PROFILE_ID, studentId: STUDENT_ID, relationship: 'Mom' },
  { id: 'link-2', parentProfileId: DAD_PROFILE_ID, studentId: STUDENT_ID, relationship: 'Dad' },
];

// ---------------------------------------------------------------------------
// 1. Label-vs-stored-value mapping (reused idiom, same proof RsvpControl.tsx
//    established for its own copy).
// ---------------------------------------------------------------------------

describe('RSVP_ITEMS label-vs-stored-value mapping', () => {
  it('uses OUT-03 literal labels ("Sign up" / "Maybe" / "Can\'t go"), not "Going"', () => {
    expect(RSVP_ITEMS).toEqual([
      { value: 'going', label: 'Sign up' },
      { value: 'maybe', label: 'Maybe' },
      { value: 'declined', label: "Can't go" },
    ]);
  });

  it('maps "Can\'t go" to the real rsvps.status enum value "declined"', () => {
    expect(rsvpStatusLabel('declined')).toBe("Can't go");
  });
});

// ---------------------------------------------------------------------------
// 2. THE CRUX: `responded_by`-to-specific-parent-identity resolution --
//    pure-function proof of all four outcomes.
// ---------------------------------------------------------------------------

describe('resolveRsvpResponderAttribution -- the responded_by-to-parent-identity resolution', () => {
  it('resolves to "none" when responded_by is null (no RSVP recorded yet)', () => {
    const attribution = resolveRsvpResponderAttribution(
      null,
      STUDENT_ID,
      STUDENT_PROFILE_ID,
      GUARDIAN_LINKS,
    );
    expect(attribution).toEqual({ kind: 'none' });
    expect(buildResponderAttributionLabel(attribution)).toBeNull();
  });

  it('resolves to "self" when responded_by equals the STUDENT\'s own profiles.id (not rsvps.student_id)', () => {
    const attribution = resolveRsvpResponderAttribution(
      STUDENT_PROFILE_ID,
      STUDENT_ID,
      STUDENT_PROFILE_ID,
      GUARDIAN_LINKS,
    );
    expect(attribution).toEqual({ kind: 'self' });
    expect(buildResponderAttributionLabel(attribution)).toBeNull();
  });

  it('resolves to "guardian" with the real relationship text when responded_by matches a guardian_links row (Mom)', () => {
    const attribution = resolveRsvpResponderAttribution(
      MOM_PROFILE_ID,
      STUDENT_ID,
      STUDENT_PROFILE_ID,
      GUARDIAN_LINKS,
    );
    expect(attribution).toEqual({
      kind: 'guardian',
      relationship: 'Mom',
      guardianLink: GUARDIAN_LINKS[0],
    });
    expect(buildResponderAttributionLabel(attribution)).toBe('Mom signed you up');
  });

  it('resolves to "guardian" for a second, distinct guardian_links row (Dad) -- proves the label is read from the matched row, not hardcoded', () => {
    const attribution = resolveRsvpResponderAttribution(
      DAD_PROFILE_ID,
      STUDENT_ID,
      STUDENT_PROFILE_ID,
      GUARDIAN_LINKS,
    );
    expect(attribution.kind).toBe('guardian');
    expect(buildResponderAttributionLabel(attribution)).toBe('Dad signed you up');
  });

  it('resolves to "unrecognized" (the disclosed edge case) when responded_by matches neither the student nor any guardian_links row', () => {
    const attribution = resolveRsvpResponderAttribution(
      COACH_PROFILE_ID,
      STUDENT_ID,
      STUDENT_PROFILE_ID,
      GUARDIAN_LINKS,
    );
    expect(attribution).toEqual({ kind: 'unrecognized', respondedByProfileId: COACH_PROFILE_ID });
    expect(buildResponderAttributionLabel(attribution)).toBe(
      "Someone else recorded this response on your student's behalf",
    );
    // Never silently misattributed to a specific relationship.
    expect(buildResponderAttributionLabel(attribution)).not.toContain('Mom');
    expect(buildResponderAttributionLabel(attribution)).not.toContain('Dad');
  });

  it('a guardian_links row for a DIFFERENT student never matches (defensive studentId re-check)', () => {
    const otherStudentLinks: GuardianLinkRow[] = [
      {
        id: 'link-3',
        parentProfileId: MOM_PROFILE_ID,
        studentId: 'student-someone-else',
        relationship: 'Mom',
      },
    ];
    const attribution = resolveRsvpResponderAttribution(
      MOM_PROFILE_ID,
      STUDENT_ID,
      STUDENT_PROFILE_ID,
      otherStudentLinks,
    );
    expect(attribution).toEqual({ kind: 'unrecognized', respondedByProfileId: MOM_PROFILE_ID });
  });

  it('resolves to "unrecognized" (not "self") when studentProfileId is null and responded_by is some other real profile id', () => {
    // A student with no linked profile yet (students.profile_id is nullable)
    // must never be treated as a false-positive "self" match.
    const attribution = resolveRsvpResponderAttribution(
      MOM_PROFILE_ID,
      STUDENT_ID,
      null,
      GUARDIAN_LINKS,
    );
    expect(attribution).toEqual({
      kind: 'guardian',
      relationship: 'Mom',
      guardianLink: GUARDIAN_LINKS[0],
    });
  });
});

// ---------------------------------------------------------------------------
// 3. Session-start lock boundary -- pure-function proof (reused rule, module
//    doc #5, not a parent-only addition).
// ---------------------------------------------------------------------------

describe('isSessionTimeEditable / isRsvpEditable -- session-start lock boundary', () => {
  it('a session starting in 1 minute is still editable', () => {
    const now = new Date('2026-08-02T13:59:00.000Z');
    expect(isSessionTimeEditable(BASE_SESSION.startsAt, now)).toBe(true);
    expect(isRsvpEditable(BASE_SESSION, now)).toBe(true);
  });

  it('a session that started 1 minute ago is locked', () => {
    const now = new Date('2026-08-02T14:01:00.000Z');
    expect(isSessionTimeEditable(BASE_SESSION.startsAt, now)).toBe(false);
    expect(isRsvpEditable(BASE_SESSION, now)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4. Component-level attribution display -- the "Mom signed you up" +
//    Timestamp proof (Required Worker Output's own explicit ask), for BOTH
//    the parent-set (guardian) case and non-parent cases.
// ---------------------------------------------------------------------------

describe('ParentRsvp -- current-state + responder attribution display', () => {
  it('renders "Mom signed you up" + a real Timestamp when responded_by matches a guardian_links row', async () => {
    const currentRsvp: RsvpRow = {
      id: 'rsvp-1',
      sessionId: 'session-1',
      studentId: STUDENT_ID,
      status: 'going',
      respondedBy: MOM_PROFILE_ID,
      updatedAt: '2026-07-15T12:00:00.000Z',
      createdAt: '2026-07-15T12:00:00.000Z',
    };
    act(() => {
      root.render(
        <ParentRsvp
          studentId={STUDENT_ID}
          studentProfileId={STUDENT_PROFILE_ID}
          session={BASE_SESSION}
          eventTitle="Community Food Bank Sort"
          currentRsvp={currentRsvp}
          guardianLinks={GUARDIAN_LINKS}
          now={() => new Date('2026-08-02T13:00:00.000Z')}
        />,
      );
    });
    await flushMicrotasks();

    expect(container.textContent).toContain('Mom signed you up');
    expect(container.textContent).toContain('Current response: Sign up');

    const timeEl = container.querySelector('time');
    expect(timeEl).toBeTruthy();
    expect(timeEl?.getAttribute('datetime')).toBe(new Date(currentRsvp.updatedAt).toISOString());
  });

  it('renders "Dad signed you up" for the other real guardian_links relationship (not hardcoded to Mom)', async () => {
    const currentRsvp: RsvpRow = {
      id: 'rsvp-2',
      sessionId: 'session-1',
      studentId: STUDENT_ID,
      status: 'maybe',
      respondedBy: DAD_PROFILE_ID,
      updatedAt: '2026-07-16T09:30:00.000Z',
      createdAt: '2026-07-16T09:30:00.000Z',
    };
    act(() => {
      root.render(
        <ParentRsvp
          studentId={STUDENT_ID}
          studentProfileId={STUDENT_PROFILE_ID}
          session={BASE_SESSION}
          eventTitle="Community Food Bank Sort"
          currentRsvp={currentRsvp}
          guardianLinks={GUARDIAN_LINKS}
          now={() => new Date('2026-08-02T13:00:00.000Z')}
        />,
      );
    });
    await flushMicrotasks();

    expect(container.textContent).toContain('Dad signed you up');
    expect(container.textContent).not.toContain('Mom signed you up');
  });

  it("renders NO attribution line (plain display) when responded_by is the student's own profile id", async () => {
    const currentRsvp: RsvpRow = {
      id: 'rsvp-3',
      sessionId: 'session-1',
      studentId: STUDENT_ID,
      status: 'declined',
      respondedBy: STUDENT_PROFILE_ID,
      updatedAt: '2026-07-17T09:30:00.000Z',
      createdAt: '2026-07-17T09:30:00.000Z',
    };
    act(() => {
      root.render(
        <ParentRsvp
          studentId={STUDENT_ID}
          studentProfileId={STUDENT_PROFILE_ID}
          session={BASE_SESSION}
          eventTitle="Community Food Bank Sort"
          currentRsvp={currentRsvp}
          guardianLinks={GUARDIAN_LINKS}
          now={() => new Date('2026-08-02T13:00:00.000Z')}
        />,
      );
    });
    await flushMicrotasks();

    expect(container.textContent).toContain("Current response: Can't go");
    expect(container.textContent).not.toContain('signed you up');
    expect(container.textContent).not.toContain('recorded this response');
  });

  it('renders the disclosed generic line (not a fabricated relationship) when responded_by matches neither the student nor any guardian', async () => {
    const currentRsvp: RsvpRow = {
      id: 'rsvp-4',
      sessionId: 'session-1',
      studentId: STUDENT_ID,
      status: 'going',
      respondedBy: COACH_PROFILE_ID,
      updatedAt: '2026-07-18T09:30:00.000Z',
      createdAt: '2026-07-18T09:30:00.000Z',
    };
    act(() => {
      root.render(
        <ParentRsvp
          studentId={STUDENT_ID}
          studentProfileId={STUDENT_PROFILE_ID}
          session={BASE_SESSION}
          eventTitle="Community Food Bank Sort"
          currentRsvp={currentRsvp}
          guardianLinks={GUARDIAN_LINKS}
          now={() => new Date('2026-08-02T13:00:00.000Z')}
        />,
      );
    });
    await flushMicrotasks();

    expect(container.textContent).toContain(
      "Someone else recorded this response on your student's behalf",
    );
    expect(container.textContent).not.toContain('Mom signed you up');
    expect(container.textContent).not.toContain('Dad signed you up');
    const timeEl = container.querySelector('time');
    expect(timeEl?.getAttribute('datetime')).toBe(new Date(currentRsvp.updatedAt).toISOString());
  });

  it('renders "No response recorded yet." with no attribution/Timestamp when currentRsvp is null', async () => {
    act(() => {
      root.render(
        <ParentRsvp
          studentId={STUDENT_ID}
          studentProfileId={STUDENT_PROFILE_ID}
          session={BASE_SESSION}
          eventTitle="Community Food Bank Sort"
          currentRsvp={null}
          guardianLinks={GUARDIAN_LINKS}
          now={() => new Date('2026-08-02T13:00:00.000Z')}
        />,
      );
    });
    await flushMicrotasks();

    expect(container.textContent).toContain('No response recorded yet.');
    expect(container.querySelector('time')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// 5. `responded_by` write path -- a real profiles.id, never a literal
//    'parent' string (Acceptance Criteria's own explicit requirement).
// ---------------------------------------------------------------------------

describe('ParentRsvp -- responded_by write attribution', () => {
  it('writes responded_by as the ACTING PARENT\'s own real profiles.id (currentUserProfileId), never a literal "parent" string', async () => {
    const onRsvpChange = createRsvpChangeMock();
    act(() => {
      root.render(
        <ParentRsvp
          studentId={STUDENT_ID}
          studentProfileId={STUDENT_PROFILE_ID}
          session={BASE_SESSION}
          eventTitle="Community Food Bank Sort"
          currentRsvp={null}
          guardianLinks={GUARDIAN_LINKS}
          currentUserProfileId={MOM_PROFILE_ID}
          onRsvpChange={onRsvpChange}
          now={() => new Date('2026-08-02T13:00:00.000Z')}
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
      respondedBy: MOM_PROFILE_ID,
    });
    expect(params?.respondedBy).not.toBe('parent');
    expect(params?.respondedBy).not.toBe(STUDENT_ID); // profiles.id != students.id space
    expect(params?.respondedBy).not.toBe(STUDENT_PROFILE_ID); // this write is the PARENT's id, not the student's

    // Immediately, before any caller-driven re-fetch, the optimistic local
    // state already reflects the correct guardian attribution.
    expect(container.textContent).toContain('Mom signed you up');
  });

  it('defaults to the disclosed placeholder parent profiles.id when no auth seam is injected', async () => {
    const onRsvpChange = createRsvpChangeMock();
    act(() => {
      root.render(
        <ParentRsvp
          studentId={STUDENT_ID}
          studentProfileId={STUDENT_PROFILE_ID}
          session={BASE_SESSION}
          eventTitle="Community Food Bank Sort"
          currentRsvp={null}
          guardianLinks={GUARDIAN_LINKS}
          onRsvpChange={onRsvpChange}
          now={() => new Date('2026-08-02T13:00:00.000Z')}
        />,
      );
    });
    await flushMicrotasks();

    act(() => {
      segmentButton('maybe')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();

    const params = onRsvpChange.mock.calls[0]?.[0];
    expect(params?.respondedBy).toBe(PLACEHOLDER_CURRENT_PARENT_PROFILE_ID);
  });

  it('rolls back the optimistic RSVP and shows an error banner when the save fails', async () => {
    const currentRsvp: RsvpRow = {
      id: 'rsvp-5',
      sessionId: 'session-1',
      studentId: STUDENT_ID,
      status: 'maybe',
      respondedBy: MOM_PROFILE_ID,
      updatedAt: '2026-07-01T00:00:00.000Z',
      createdAt: '2026-07-01T00:00:00.000Z',
    };
    const onRsvpChange = createRsvpChangeMock(async () => {
      throw new Error('Network error');
    });
    act(() => {
      root.render(
        <ParentRsvp
          studentId={STUDENT_ID}
          studentProfileId={STUDENT_PROFILE_ID}
          session={BASE_SESSION}
          eventTitle="Community Food Bank Sort"
          currentRsvp={currentRsvp}
          guardianLinks={GUARDIAN_LINKS}
          currentUserProfileId={DAD_PROFILE_ID}
          onRsvpChange={onRsvpChange}
          now={() => new Date('2026-08-02T13:00:00.000Z')}
        />,
      );
    });
    await flushMicrotasks();
    expect(container.textContent).toContain('Mom signed you up');

    act(() => {
      segmentButton('going')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();

    expect(container.textContent).toContain("Couldn't save your student's RSVP");
    expect(container.textContent).toContain('Network error');
    // Rolled back to the previously-persisted attribution, not Dad's failed attempt.
    expect(container.textContent).toContain('Mom signed you up');
    expect(container.textContent).not.toContain('Dad signed you up');
  });
});

// ---------------------------------------------------------------------------
// 6. Student-override trap -- no parent-only locking beyond the universal
//    session-start rule (Ground Truth #2).
// ---------------------------------------------------------------------------

describe('ParentRsvp -- editable vs. locked rendering (universal rule, not a parent-only lock)', () => {
  it('renders an interactive, enabled control when the session starts in 1 minute', async () => {
    act(() => {
      root.render(
        <ParentRsvp
          studentId={STUDENT_ID}
          studentProfileId={STUDENT_PROFILE_ID}
          session={BASE_SESSION}
          eventTitle="Community Food Bank Sort"
          currentRsvp={null}
          guardianLinks={GUARDIAN_LINKS}
          now={() => new Date('2026-08-02T13:59:00.000Z')}
        />,
      );
    });
    await flushMicrotasks();
    expect(segmentButton('going')?.getAttribute('aria-disabled')).not.toBe('true');
  });

  it('renders a genuinely inert, locked control when the session started 1 minute ago -- clicking does not call onRsvpChange', async () => {
    const onRsvpChange = createRsvpChangeMock();
    act(() => {
      root.render(
        <ParentRsvp
          studentId={STUDENT_ID}
          studentProfileId={STUDENT_PROFILE_ID}
          session={BASE_SESSION}
          eventTitle="Community Food Bank Sort"
          currentRsvp={null}
          guardianLinks={GUARDIAN_LINKS}
          onRsvpChange={onRsvpChange}
          now={() => new Date('2026-08-02T14:01:00.000Z')}
        />,
      );
    });
    await flushMicrotasks();

    const goingButton = segmentButton('going');
    expect(goingButton?.getAttribute('aria-disabled')).toBe('true');

    act(() => {
      goingButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await flushMicrotasks();
    expect(onRsvpChange).not.toHaveBeenCalled();
    expect(container.textContent).toContain('RSVP locked');
  });
});

// ---------------------------------------------------------------------------
// 7. No box-drawing/bracket wireframe characters (constitution item 13).
// ---------------------------------------------------------------------------

describe('ParentRsvp -- constitution item 13', () => {
  it('never renders literal box-drawing or bracket wireframe characters', async () => {
    const currentRsvp: RsvpRow = {
      id: 'rsvp-1',
      sessionId: 'session-1',
      studentId: STUDENT_ID,
      status: 'going',
      respondedBy: MOM_PROFILE_ID,
      updatedAt: '2026-07-15T12:00:00.000Z',
      createdAt: '2026-07-15T12:00:00.000Z',
    };
    act(() => {
      root.render(
        <ParentRsvp
          studentId={STUDENT_ID}
          studentProfileId={STUDENT_PROFILE_ID}
          session={BASE_SESSION}
          eventTitle="Community Food Bank Sort"
          currentRsvp={currentRsvp}
          guardianLinks={GUARDIAN_LINKS}
          now={() => new Date('2026-08-02T13:00:00.000Z')}
        />,
      );
    });
    await flushMicrotasks();

    expect(container.textContent ?? '').not.toMatch(/[─-╿]/); // box-drawing range
    expect(container.textContent ?? '').not.toMatch(/\[.*\|.*\]/); // "[a|b|c]" wireframe style
  });
});
