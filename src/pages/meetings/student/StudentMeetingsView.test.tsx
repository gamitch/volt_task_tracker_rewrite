// @vitest-environment jsdom
/**
 * Tests for `StudentMeetingsView.tsx`'s student/parent role variant --
 * moved verbatim out of `src/pages/meetings/MeetingsList.test.tsx` (GAM-444
 * Stage C), same assertions, same test names, only the import path/location
 * changed (GAM-444 packet criterion 2). Renders through `<MeetingsList />`
 * (imported from `../MeetingsList`, the shell) exactly as before the split
 * -- these are role-variant integration tests (auth -> role switch ->
 * `StudentMeetingsViewContainer`), not isolated-component tests, and
 * rewriting them to mount a student component directly would be a
 * behavior/assertion change criterion 2 forbids.
 *
 * No `@testing-library/react` is installed in this repo -- these tests use
 * the same raw `createRoot`/`act` pattern `CheckinResult.test.tsx` and
 * `theme.smoke.test.tsx` already established.
 */
import { MemoryRouter } from 'react-router-dom';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, type AuthUser } from '../../../app/guards';
import * as meetingsLoadersNs from '../../../lib/supabase/loaders/meetings';
import { LoginAs } from '../../../test-utils/authHarness';
import {
  MeetingsList,
  PLACEHOLDER_CURRENT_STUDENT_ID,
  defaultLoadCoachMeetingsData,
  defaultLoadStudentMeetingsData,
} from '../MeetingsList';
import type {
  ResolveCurrentStudentIdFn,
  StudentMeetingHistoryRow,
  StudentMeetingsData,
  StudentParticipationMetric,
} from '../../../lib/meetings/types';
import { defaultLoadConsistencyStripData, type ConsistencyStripData } from '../StudentMeetingView';
import type { ResolveStudentIsActiveFn } from '../../../lib/supabase/loaders/students';

// ---------------------------------------------------------------------------
// T180 §3a (BLOCKER 1, gate round 1) -- the mount this task adds uses
// `StudentMeetingView`'s own default `loadStripData` seam
// (`loadConsistencyStripData`, `../../../lib/supabase/loaders/checkin.ts`),
// a REAL Supabase query. With `.env.local` absent that query rejects in
// every student/parent test below, landing the strip in its own DES-12
// error branch and breaking three pre-existing assertions (measured, gate
// round 1 BLOCKER 1). Same module-level-mock shape `DashboardPage.test.tsx`
// (T176 gate) and `OutreachList.test.tsx` (`loadSelfCheckoffAttendance`,
// T170) already established for this exact failure shape.
//
// Lazy-holder shape, not a factory-level `await import('../StudentMeetingView')`
// -- the gate measured that shape dying on the circular module graph
// (`TypeError: loadData is not a function`, and separately
// `ReferenceError: Cannot access '__vi_import_6__' before initialization`).
// `beforeEach` below points `stripSeam.load` at the real
// `defaultLoadConsistencyStripData` fixture builder (imported directly, not
// through the mocked module) so every pre-existing test that reaches the
// mount gets a real, resolving (if fixture-empty for most ids -- Trap #3's
// disjoint id-spaces) strip instead of the network error branch; individual
// criteria below override `stripSeam.load` per test.
// ---------------------------------------------------------------------------
const stripSeam = vi.hoisted(() => ({
  load: null as null | ((studentId: string) => Promise<ConsistencyStripData>),
}));
vi.mock('../../../lib/supabase/loaders/checkin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../lib/supabase/loaders/checkin')>();
  return {
    ...actual,
    loadConsistencyStripData: (studentId: string) => stripSeam.load!(studentId),
  };
});

// ---------------------------------------------------------------------------
// C4 -- module-level spy target for `resolveCurrentStudentId`
// (`../../../lib/supabase/loaders/meetings.ts`), the seam
// `StudentMeetingView.tsx`'s own `OwnStudentConsistencyStrip` falls back to
// when the mount does NOT receive an explicit `studentId` (module doc #9 of
// that file). C4 itself does `vi.spyOn(meetingsLoadersNs, 'resolveCurrentStudentId')`
// locally rather than a file-level `vi.mock('../../../lib/supabase/loaders/meetings', ...)`.
//
// T180 follow-up (checker PASS-with-MINOR item 2): stating only what was
// measured. Three facts, confirmed directly:
//   1. A `vi.mock('../../../lib/supabase/loaders/meetings', ...)` factory here
//      reads 0 calls on `spy` under BOTH correct code and the C4 mutation --
//      it never discriminates, so it cannot back this criterion.
//   2. That same mocked module DOES intercept a direct call made from this
//      test file itself.
//   3. `vi.spyOn(meetingsLoadersNs, 'resolveCurrentStudentId')` reads 1 under
//      the C4 mutation and 0 under correct code -- it discriminates, which is
//      why C4 uses it.
// A HYPOTHESIS, not established by measurement, for why (1) happens: this
// module sits one hop into the `checkin.ts` <-> `StudentMeetingView.tsx`
// circular import this file also routes around for the strip's own load
// seam, and the `resolveStudentId` default-parameter reference
// `StudentMeetingView.tsx` receives may bind to the real function instead of
// the `vi.mock`'d one as a result. The probe built to isolate this --
// removing `checkin`'s own mock to see whether the resolver is even reached
// -- was confounded: with that mock gone, the real `checkin` loader rejects,
// so "the resolver was never reached" could not be told apart from "the mock
// was never installed." Do not restate the circular-import mechanism as the
// established cause; only (1)-(3) above are measured. `vi.spyOn` on the
// shared namespace object works regardless of the mechanism -- it patches the
// property in place on the one module object every consumer already holds a
// live binding to, and does not go through a second `vi.mock`/
// `importOriginal` registration at all. Every other test in this file reaches
// the student/parent view via an explicit `studentId` prop or the host's own
// `resolveStudentId` prop (never the real default), so nothing else in this
// file exercises this seam; C4 is this spy's only consumer, and restores it
// with `spy.mockRestore()`. `makeResolveCurrentStudentId` (used directly,
// unmocked, by the `resolveCurrentStudentId (T096, Trap #4 real resolution)`
// describe block, kept in `MeetingsList.test.tsx` alongside the rest of the
// loader-integration tests -- see that file's own header) is a different
// export, untouched by this.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Render harness
// ---------------------------------------------------------------------------

let container: HTMLDivElement;
let root: Root;

const COACH_USER: AuthUser = { id: 'user-coach', email: 'coach@example.com', role: 'coach' };
// T073a: guards.tsx's `Role` union now includes 'student'/'parent'
// (previously it did not -- module doc #5/#6 gap, resolved). 'student'
// stands in for "not coach/admin" here, which is exactly the branch
// `MeetingsList`'s own `isCoachOrAdminView` check falls through on for any
// non-coach/admin role.
const STUDENT_OR_PARENT_USER: AuthUser = {
  id: 'user-student',
  email: 'student@example.com',
  role: 'student',
};

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

/** T096: a fast, synchronous-resolving fake for the new `resolveStudentId`
 * seam -- injected explicitly (same "inject the fixture explicitly through
 * the seam" pattern every prior ED-1 packet established) by every
 * student/parent-view test below that does NOT pass an explicit `studentId`
 * prop, so those tests never hit the real (network-backed) default. */
function fakeResolveStudentId(studentId: string | null): ResolveCurrentStudentIdFn {
  return () => Promise.resolve(studentId);
}

/** T189 (packet v2 §7) -- same "inject the fixture explicitly through the
 * seam" pattern as `fakeResolveStudentId` immediately above, for the new
 * `resolveStudentIsActive` seam. Injected at every resolved-path test below
 * that does NOT pass an explicit `studentId` prop, so those tests never hit
 * the real (network-backed) default -- same trap `fakeResolveStudentId`'s
 * own doc names, now a second, independent seam that reaches the same real
 * loader shape (`createLoader`, `.env.local`-dependent) if left
 * un-injected. Defaults every pre-existing (pre-T189) test back to `true`
 * ("active", i.e. today's behavior, unchanged) rather than leaving them to
 * hit the real default. */
function fakeResolveStudentIsActive(isActive: boolean | null = true): ResolveStudentIsActiveFn {
  return () => Promise.resolve(isActive);
}

/** T180 C3/C7 -- `[role="progressbar"]`'s accessible name resolves through
 * `aria-labelledby`, NOT `aria-label` (Trap #9, measured DOM:
 * `aria-labelledby="_r_9_"`). Never `aria-label`, which Astryx's
 * `ProgressBar` does not set. */
function progressBarNames(): string[] {
  return Array.from(container.querySelectorAll('[role="progressbar"]')).map((el) => {
    const labelledBy = el.getAttribute('aria-labelledby');
    if (!labelledBy) return '';
    return document.getElementById(labelledBy)?.textContent ?? '';
  });
}

/** T180 C1/C5/C7 -- the strip's dots are Astryx `StatusDot`s, rendered
 * `role="img"` PLUS the stable `astryx-statusdot` class. `role="img"` alone
 * is not unique on this page: this page's own `Table` pagination also
 * renders `role="img"` (Astryx `Kbd`, "Left arrow"/"Right arrow" hints) --
 * measured live, `StudentMeetingView.test.tsx`'s own `statusDotVariants`/
 * `statusDotLabels` helpers get away with the bare `role="img"` query only
 * because that file's own container never renders a `Table`/`Kbd` inside
 * it. The class selector is what actually discriminates on this page. */
function stripDotCount(): number {
  return container.querySelectorAll('[role="img"].astryx-statusdot').length;
}

/** T180 C8 -- the rendered heading outline, `H{level}:{text}`. */
function headingOutline(): string[] {
  return Array.from(container.querySelectorAll('h1,h2,h3,h4,h5,h6')).map(
    (el) => `H${el.tagName.slice(1)}:${el.textContent}`,
  );
}

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
  // T180 §3a -- default every test to a real, resolving (fixture-driven)
  // strip load instead of the network-backed default, so pre-existing tests
  // that reach the mount (the populated student/parent branch) don't land
  // in the strip's own error branch. Individual criteria override this per
  // test.
  stripSeam.load = (studentId) => defaultLoadConsistencyStripData(studentId);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
  vi.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// <MeetingsList /> -- student/parent view, all four DES-12 states
// ---------------------------------------------------------------------------

describe('<MeetingsList /> student/parent view', () => {
  // T096: none of these three states pass an explicit `studentId` prop
  // (the real-world case) -- each injects a fast `resolveStudentId` fake
  // through the new seam (same "inject the fixture explicitly" pattern
  // every ED-1 packet establishes) so they never hit the real,
  // network-backed default.
  it('loading state', async () => {
    renderAsUser(STUDENT_OR_PARENT_USER, {
      resolveStudentId: fakeResolveStudentId('student-fixture'),
      resolveStudentIsActive: fakeResolveStudentIsActive(true),
      loadStudentData: () => new Promise<StudentMeetingsData>(() => {}),
    });
    // T073b2: auth resolution (even via the fake `authModule` this
    // harness's `LoginAs` now uses) is genuinely async -- a flush is needed
    // before the authenticated body (and its own DES-12 loading state)
    // mounts. See `src/test-utils/authHarness.tsx`'s module doc. T096 adds
    // one more real async layer (`resolveStudentId`) before
    // `StudentMeetingsView` itself mounts, so this flushes twice.
    await flushMicrotasks();
    await flushMicrotasks();
    expect(container.textContent).toContain('Loading your meetings');
  });

  it('error state', async () => {
    renderAsUser(STUDENT_OR_PARENT_USER, {
      resolveStudentId: fakeResolveStudentId('student-fixture'),
      resolveStudentIsActive: fakeResolveStudentIsActive(true),
      loadStudentData: () => Promise.reject(new Error('boom')),
    });
    await flushMicrotasks();
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't load your meeting history");
  });

  it('empty state (no history, no participation row)', async () => {
    renderAsUser(STUDENT_OR_PARENT_USER, {
      resolveStudentId: fakeResolveStudentId('student-fixture'),
      resolveStudentIsActive: fakeResolveStudentIsActive(true),
      loadStudentData: () => Promise.resolve({ history: [], participation: null }),
    });
    await flushMicrotasks();
    await flushMicrotasks();
    expect(container.textContent).toContain('No meeting history yet');
  });

  // T302 -- `isEmpty` (`MeetingsList.tsx`'s `history.length === 0 &&
  // participation === null`) was asserted by nothing: deleting the
  // `participation === null` conjunct left the whole suite green, both at
  // T180's head and at base (pre-existing gap, not a T180 regression). It
  // matters more now than it used to -- T180 deleted this file's own
  // `Participation` `ProgressBar`, so this clause is `participation`'s only
  // remaining render-path consumer. A student with zero history rows but a
  // real participation row must NOT collapse into the "No meeting history
  // yet" empty state.
  //
  // Paired, not absence-only (this project has shipped seven-plus
  // absence-only assertions that passed for the wrong reason, including two
  // in T180's own first draft): absence of the empty-state copy, PLUS the
  // "Recent attendance" heading, which the `isEmpty` branch never renders --
  // it only exists past `StudentMeetingsView`'s own loading/error gate, on
  // the same `else` branch as the empty-state check's alternative, so it
  // cannot pass because the page merely failed to load or errored.
  it('a student with zero history rows but a real participation row does not render the empty state', async () => {
    renderAsUser(STUDENT_OR_PARENT_USER, {
      resolveStudentId: fakeResolveStudentId('student-fixture'),
      resolveStudentIsActive: fakeResolveStudentIsActive(true),
      loadStudentData: () =>
        Promise.resolve({
          history: [],
          participation: {
            studentId: 'student-fixture',
            teamId: 'team-ravens',
            seasonId: 'season-placeholder-current',
            expectedCt: 5,
            presentCt: 4,
            lateCt: 0,
            excusedCt: 0,
            participationPct: 80,
          },
        }),
    });
    await flushMicrotasks();
    await flushMicrotasks();
    expect(container.textContent).not.toContain('No meeting history yet');
    expect(headingOutline()).toContain('H2:Recent attendance');
  });

  // T096, Trap #4 -- the resolution seam's own three states (loading /
  // error / "no student linked"), independent of `StudentMeetingsView`'s
  // own load state below it.
  it("resolveStudentId's own loading state renders before StudentMeetingsView mounts", async () => {
    renderAsUser(STUDENT_OR_PARENT_USER, {
      resolveStudentId: () => new Promise<string | null>(() => {}),
    });
    await flushMicrotasks();
    expect(container.textContent).toContain('Finding your student record');
  });

  it("resolveStudentId's own error state renders a real error Banner with Retry", async () => {
    renderAsUser(STUDENT_OR_PARENT_USER, {
      resolveStudentId: () => Promise.reject(new Error('boom')),
    });
    await flushMicrotasks();
    expect(container.textContent).toContain("Couldn't find your student record");
  });

  it('resolveStudentId resolving null renders a real "no student linked" EmptyState, not a crash', async () => {
    renderAsUser(STUDENT_OR_PARENT_USER, {
      resolveStudentId: fakeResolveStudentId(null),
    });
    await flushMicrotasks();
    expect(container.textContent).toContain('No student account linked yet');
  });

  // T180 §3a repair 1 (packet-authorized by name, `MeetingsList.test.tsx:1111`
  // in the packet's own pre-mount line numbering): Part B deletes this
  // file's own `Participation` `ProgressBar`, so `'57.1%'` -- this test's
  // sole prior observable -- no longer renders anywhere on a successful
  // resolution. Replaced, not deleted: a `vi.fn` spy on `loadStudentData`
  // proves the resolved id was genuinely threaded through to `loadData`,
  // keeping T096's own resolution proof alive without depending on the now-
  // deleted participation figure.
  it('resolveStudentId resolving a real id renders StudentMeetingsView scoped to that id', async () => {
    const loadStudentDataSpy = vi.fn(defaultLoadStudentMeetingsData);
    renderAsUser(STUDENT_OR_PARENT_USER, {
      resolveStudentId: fakeResolveStudentId(PLACEHOLDER_CURRENT_STUDENT_ID),
      resolveStudentIsActive: fakeResolveStudentIsActive(true),
      loadStudentData: loadStudentDataSpy,
    });
    await flushMicrotasks();
    await flushMicrotasks();
    expect(loadStudentDataSpy).toHaveBeenCalledWith(PLACEHOLDER_CURRENT_STUDENT_ID);
  });

  // T180 §3a repair 2 (packet-authorized by name, `:1124` in the packet's
  // own pre-mount line numbering): broken twice by Part A + Part B --
  // `'57.1%'` (the host's own deleted `Participation` `ProgressBar`) and the
  // placeholder copy (deleted by Part A) both retarget onto the now-mounted
  // strip.
  it('populated state: own history, and the real BEH-06 strip mounted where the placeholder used to be', async () => {
    stripSeam.load = (studentId) =>
      Promise.resolve({
        entries: [{ sessionId: 'cs-fixture', sessionDate: '2026-06-24', status: 'present' }],
        participation: {
          studentId,
          teamId: 'team-ravens',
          seasonId: 'season-placeholder-current',
          expectedCt: 5,
          presentCt: 4,
          lateCt: 0,
          excusedCt: 0,
          participationPct: 80,
        },
      });
    renderAsUser(STUDENT_OR_PARENT_USER, {
      studentId: PLACEHOLDER_CURRENT_STUDENT_ID,
      loadStudentData: defaultLoadStudentMeetingsData,
    });
    await flushMicrotasks();
    await flushMicrotasks();

    expect(container.textContent).toContain('Weekly Build Meeting');
    expect(container.textContent).toContain('Ravens Strategy Session');
    expect(container.textContent).toContain('Present');
    expect(container.textContent).toContain('Late');
    expect(container.textContent).toContain('Not yet held');

    // No row actions in the read-only student/parent view (MTG-14).
    expect(container.querySelector('[aria-label^="Actions for"]')).toBeNull();
    expect(container.textContent).not.toContain('Schedule meetings');

    // T180: the placeholder copy is gone, and the real strip's own
    // populated participation figure (sourced from its own loader, not the
    // deleted host `ProgressBar`) is what "57.1%" used to prove.
    expect(container.textContent).not.toContain('A visual "last 5 meetings" view isn\'t built yet');
    expect(container.textContent).not.toContain('T037');
    expect(container.textContent).toContain('Participation: 80%');
    expect(stripDotCount()).toBe(1);

    // NAV-07: outreach content must never appear here either.
    expect(container.textContent).not.toContain('Community Food Drive');
  });

  // T180 §3a repair 3 (packet-authorized by name, `:1152` in the packet's
  // own pre-mount line numbering) -- THE DANGEROUS ONE. Left unretargeted,
  // this title ("...when the student has no metric row") would start
  // passing again after the mount for an entirely different reason: the
  // strip's OWN em-dash empty state, sourced from a different loader
  // (`stripSeam`, not `loadStudentData`), with the host's own
  // now-deleted `Participation` section never in the render tree to have
  // rendered anything at all. Retargeted explicitly, by title, to the
  // thing it actually now proves.
  it("the strip's participation renders '—' (never a fabricated %) when its loader returns no metric row", async () => {
    stripSeam.load = () =>
      Promise.resolve({
        entries: [{ sessionId: 'cs-fixture', sessionDate: '2026-06-24', status: 'present' }],
        participation: null,
      });
    renderAsUser(STUDENT_OR_PARENT_USER, {
      studentId: 'student-with-zero-expected-sessions',
      loadStudentData: (studentId) => defaultLoadStudentMeetingsData(studentId),
    });
    await flushMicrotasks();
    await flushMicrotasks();
    // T180 follow-up (checker PASS-with-MINOR item 1): a bare `toContain('—')`
    // is satisfied by the DOT ROW's own em-dash separator
    // (`StudentMeetingView.tsx:735`, `${dot.label} — ${formatShortDate(...)}`),
    // which this test's own fixture entry also renders, NOT by the
    // participation branch this test is titled after
    // (`StudentMeetingView.tsx:751-754`). Measured: retargeting the
    // participation branch's own em-dash to `'N/A'` left this assertion green
    // (see T180-worker-output.md, "Follow-up round" section, for the pasted
    // mutation output). Assert the full participation string instead so the
    // assertion can only be satisfied by the branch the title names.
    expect(container.textContent).toContain('— (no completed meetings recorded yet this season)');
    expect(container.textContent).not.toMatch(/\d+%/);
  });

  // -------------------------------------------------------------------------
  // T129/UXC-01: one heading per section. `StudentHistorySection`'s own
  // `List`'s `header` prop was removed (it used to print "Upcoming
  // meetings"/"Past meetings" a second time, per `List.tsx:194-201`); its
  // `Heading` now carries a `useId`-generated id, and a
  // `<div role="group">` wrapping the List/EmptyState ternary carries
  // `aria-labelledby={headingId}` -- present in BOTH branches, so the
  // region's accessible name survives even when there is no `List` to
  // attach a `header` to. See `CoachMeetingsSection`'s own T129 describe
  // block above (CHECKER FIX, rework of T129, MAJOR) for why the wrapper
  // is a plain `<div role="group">`, not `Section`.
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
      renderAsUser(STUDENT_OR_PARENT_USER, {
        studentId: PLACEHOLDER_CURRENT_STUDENT_ID,
        loadStudentData: defaultLoadStudentMeetingsData,
      });
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
      const pastOnlyData: StudentMeetingsData = {
        history: [
          {
            sessionId: 'session-history-past-only',
            title: 'Archived Weekly Meeting',
            sessionDate: '2026-01-05',
            startsAt: '2026-01-05T18:00:00.000Z',
            endsAt: '2026-01-05T20:00:00.000Z',
            status: 'completed',
            myAttendanceStatus: 'present',
          },
        ],
        participation: {
          studentId: PLACEHOLDER_CURRENT_STUDENT_ID,
          teamId: 'team-placeholder-current-viewer',
          seasonId: 'season-placeholder-current',
          expectedCt: 1,
          presentCt: 1,
          lateCt: 0,
          excusedCt: 0,
          participationPct: 100,
        },
      };
      renderAsUser(STUDENT_OR_PARENT_USER, {
        studentId: PLACEHOLDER_CURRENT_STUDENT_ID,
        loadStudentData: () => Promise.resolve(pastOnlyData),
      });
      await flushMicrotasks();

      // Confirm "Upcoming" really is the EmptyState branch (per its own
      // `emptyDescription`), not a load failure.
      expect(container.textContent).toContain('You have no upcoming meetings scheduled.');
      expect(container.textContent).toContain('Archived Weekly Meeting');

      for (const title of ['Upcoming', 'Past']) {
        const { resolvedText } = resolveAriaLabelledbyTarget(title);
        expect(resolvedText).toBe(title);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // T180 -- Part A (mount the real BEH-06 strip) + Part B (delete the
  // host's own duplicate `Participation` region). Every criterion below
  // names the mutation that must turn it red (worker packet §5); the actual
  // mutation runs + captured failure output for each live in this task's
  // own worker output doc, not restated here.
  // ---------------------------------------------------------------------------
  describe('T180 -- the real BEH-06 consistency strip is mounted, and the host has exactly one participation region', () => {
    it('C1: the consistency strip renders for a student, inside the real student view', async () => {
      stripSeam.load = defaultLoadConsistencyStripData;
      renderAsUser(STUDENT_OR_PARENT_USER, {
        studentId: 'student-jordan-fixture',
        loadStudentData: defaultLoadStudentMeetingsData,
      });
      await flushMicrotasks();
      await flushMicrotasks();

      // Mutation: remove the mount -> `expected +0 to be 5`.
      expect(stripDotCount()).toBe(5);
      expect(container.textContent).toContain('Upcoming');
      expect(container.textContent).toContain('Past');
    });

    it('C2: the placeholder copy is gone and the real strip is there', async () => {
      stripSeam.load = defaultLoadConsistencyStripData;
      renderAsUser(STUDENT_OR_PARENT_USER, {
        studentId: 'student-jordan-fixture',
        loadStudentData: defaultLoadStudentMeetingsData,
      });
      await flushMicrotasks();
      await flushMicrotasks();

      // Mutation: restore the placeholder `Text` alongside the mount ->
      // only this absence half reddens. The absence half ALONE is not
      // evidence -- it also passes against a strip that failed to load
      // (measured, gate round 1 BLOCKER 2c); the paired positive below is
      // what keeps this criterion honest.
      expect(container.textContent).not.toContain("isn't built yet");
      expect(stripDotCount()).toBe(5);
    });

    // C3 (BLOCKER 2, gate round 1): rendered where the mutation is actually
    // visible -- `studentId = PLACEHOLDER_CURRENT_STUDENT_ID` so the HOST's
    // own participation fixture row is non-null (Trap #3: the two loaders'
    // fixture id-spaces are disjoint, so any id that populates the strip
    // leaves the host's own participation null and the mutation invisible).
    // Accessible names resolved through `aria-labelledby`, never
    // `aria-label` (Trap #9 -- Astryx `ProgressBar` does not set the
    // latter).
    it("C3: exactly one participation bar renders, and it is the strip's", async () => {
      stripSeam.load = () =>
        Promise.resolve({
          entries: [],
          participation: {
            studentId: PLACEHOLDER_CURRENT_STUDENT_ID,
            teamId: 'team-ravens',
            seasonId: 'season-placeholder-current',
            expectedCt: 8,
            presentCt: 6,
            lateCt: 2,
            excusedCt: 1,
            participationPct: 85.7,
          },
        });
      renderAsUser(STUDENT_OR_PARENT_USER, {
        studentId: PLACEHOLDER_CURRENT_STUDENT_ID,
        loadStudentData: defaultLoadStudentMeetingsData,
      });
      await flushMicrotasks();
      await flushMicrotasks();

      // Mutation: restore the host's `Participation` `VStack` ->
      // `["Your participation: 57.1%", "Participation: 85.7%"]`, red.
      expect(progressBarNames()).toEqual(['Participation: 85.7%']);
    });

    // C4 (MAJOR 3, gate round 1): module-level spy on the SAME
    // `resolveCurrentStudentId` `StudentMeetingView.tsx`'s own
    // `OwnStudentConsistencyStrip` would fall back to -- not a spy on the
    // host's own `resolveStudentId` prop, which the mount never forwards
    // and which stays at 1 in both trees regardless of this mutation.
    // `toBe(0)`, not "at most once" -- the mutation moves the count from 0
    // to 1, and `toBeLessThanOrEqual(1)` would be satisfied by 1 either way.
    it('C4: mounting the strip with an explicit studentId never triggers a second identity resolution', async () => {
      const spy = vi.spyOn(meetingsLoadersNs, 'resolveCurrentStudentId');
      renderAsUser(STUDENT_OR_PARENT_USER, {
        studentId: PLACEHOLDER_CURRENT_STUDENT_ID,
        loadStudentData: defaultLoadStudentMeetingsData,
      });
      await flushMicrotasks();
      await flushMicrotasks();

      // Paired positive: the page actually finished rendering (not stuck in
      // a resolution-error/loading state).
      expect(container.textContent).toContain('Weekly Build Meeting');
      // Mutation: drop `studentId` from the mount -> `expected 1 to be +0`.
      expect(spy.mock.calls.length).toBe(0);
      // T180 follow-up NIT: restore the spy -- `vite.config.ts` sets no
      // `restoreMocks`, and this is the only test in the file that installs
      // this particular spy.
      spy.mockRestore();
    });

    // C5 (MAJOR 4, gate round 1): the absence half asserts the strip's own
    // shared vocabulary string ("meeting consistency" -- present in its
    // loading, error AND empty branches, `StudentMeetingView.tsx:778-779`/
    // `:802`/`:951`), not its populated dot-row output. A coach viewer never
    // even reaches a rendered strip in this file (the mount only exists in
    // the student/parent branch), so asserting on populated output alone
    // would pass trivially without the mount ever having been hoisted out
    // of that branch -- string coverage of every non-populated state is
    // what actually catches that mutation.
    it('C5: the coach view has no strip -- string coverage of every one of its non-populated states -- and its own content still renders', async () => {
      renderAsUser(COACH_USER, { loadCoachData: defaultLoadCoachMeetingsData });
      await flushMicrotasks();

      // Mutation: hoist the mount out of the student/parent branch -> red.
      expect(container.textContent).not.toContain('meeting consistency');
      expect(stripDotCount()).toBe(0);
      expect(container.textContent).toContain('Weekly Build Meeting');
    });

    // C7 (MINOR 7, gate round 1): the real default `loadLinkedStudents` seam
    // is unstubbed here, so the stated mutation (switching the mount to
    // `variant="linked"`) reddens because that path hits a DIFFERENT,
    // unstubbed seam and renders "Couldn't load linked students" (0 dots),
    // not because it "fans out to more than one strip" -- the fan-out is
    // real but only observable with that seam stubbed (see this task's
    // worker output doc for that measurement); it is not what THIS
    // mutation, run against the default harness, demonstrates.
    it('C7: the parent/student path renders exactly one strip via variant="own", never a fan-out', async () => {
      stripSeam.load = defaultLoadConsistencyStripData;
      renderAsUser(STUDENT_OR_PARENT_USER, {
        studentId: 'student-jordan-fixture',
        loadStudentData: defaultLoadStudentMeetingsData,
      });
      await flushMicrotasks();
      await flushMicrotasks();

      // Mutation: switch the mount to `variant="linked"` -> red (0 dots,
      // via the unstubbed `loadLinkedStudents` error banner, not a fan-out).
      expect(stripDotCount()).toBe(5);
    });

    // C8 (Trap #8): two `<h2>`s are deliberately lost (`Participation`, and
    // the strip's own `variant="own"` branch emits no heading at all) --
    // the host's `Recent attendance` heading is kept so the page still has
    // a navigable heading over the mounted strip.
    it('C8: the student view heading outline is H1 Meetings / H2 Upcoming / H2 Past / H2 Recent attendance', async () => {
      stripSeam.load = defaultLoadConsistencyStripData;
      renderAsUser(STUDENT_OR_PARENT_USER, {
        studentId: 'student-jordan-fixture',
        loadStudentData: defaultLoadStudentMeetingsData,
      });
      await flushMicrotasks();
      await flushMicrotasks();

      // Mutation: drop the `Recent attendance` heading -> red.
      expect(headingOutline()).toEqual([
        'H1:Meetings',
        'H2:Upcoming',
        'H2:Past',
        'H2:Recent attendance',
      ]);
    });
  });

  // ---------------------------------------------------------------------------
  // T189 (packet v2 §6) -- honest "your account is inactive" copy. Only C1
  // discriminates against today's defect (a deactivated student's real
  // history/dots sitting directly beside a "no completed meetings"
  // participation claim); C2-C6 are regression guards, not proofs of the
  // fix, per the packet's own disclosure. Every criterion below still has a
  // named production-code mutation run against it (worker output records
  // the real red output for each).
  // ---------------------------------------------------------------------------
  describe('T189 -- honest copy for a deactivated student', () => {
    const REAL_UPCOMING_ROW: StudentMeetingHistoryRow = {
      sessionId: 'session-t189-upcoming',
      title: 'Upcoming Robotics Session',
      sessionDate: '2026-08-10',
      startsAt: '2026-08-10T18:00:00.000Z',
      endsAt: '2026-08-10T20:00:00.000Z',
      status: 'scheduled',
      myAttendanceStatus: null,
    };
    const REAL_PAST_ROW: StudentMeetingHistoryRow = {
      sessionId: 'session-t189-past',
      title: 'Past Robotics Session',
      sessionDate: '2026-01-12',
      startsAt: '2026-01-12T18:00:00.000Z',
      endsAt: '2026-01-12T20:00:00.000Z',
      status: 'completed',
      myAttendanceStatus: 'present',
    };
    const REAL_PARTICIPATION: StudentParticipationMetric = {
      studentId: 'student-t189-inactive',
      teamId: 'team-ravens',
      seasonId: 'season-placeholder-current',
      expectedCt: 5,
      presentCt: 4,
      lateCt: 0,
      excusedCt: 0,
      participationPct: 80,
    };

    // C1 -- the ONE criterion that discriminates against today's defect.
    // Mutation: delete the `isActive === false` branch.
    it('C1: inactive renders the honest copy; the strip\'s own "no completed meetings" copy is absent', async () => {
      renderAsUser(STUDENT_OR_PARENT_USER, {
        resolveStudentId: fakeResolveStudentId('student-t189-inactive'),
        resolveStudentIsActive: fakeResolveStudentIsActive(false),
        loadStudentData: () =>
          Promise.resolve({ history: [REAL_PAST_ROW], participation: REAL_PARTICIPATION }),
      });
      await flushMicrotasks();
      await flushMicrotasks();
      expect(container.textContent).toContain('Your student account is inactive');
      expect(container.textContent).toContain(
        "Participation isn't tracked while your account is inactive.",
      );
      expect(container.textContent).not.toContain('no completed meetings recorded yet');
    });

    // C2 -- the owner ruling's own most-likely-to-be-silently-dropped half:
    // Upcoming/Past keep their REAL rows even while inactive.
    // Mutation: drop the two `StudentHistorySection`s from the inactive branch.
    it('C2: inactive -- Upcoming and Past still render their real rows', async () => {
      renderAsUser(STUDENT_OR_PARENT_USER, {
        resolveStudentId: fakeResolveStudentId('student-t189-inactive'),
        resolveStudentIsActive: fakeResolveStudentIsActive(false),
        loadStudentData: () =>
          Promise.resolve({
            history: [REAL_UPCOMING_ROW, REAL_PAST_ROW],
            participation: null,
          }),
      });
      await flushMicrotasks();
      await flushMicrotasks();
      expect(container.textContent).toContain('Upcoming Robotics Session');
      expect(container.textContent).toContain('Past Robotics Session');
      expect(headingOutline()).toContain('H2:Upcoming');
      expect(headingOutline()).toContain('H2:Past');
    });

    // C3 -- active with a real scope renders exactly as today; honest copy absent.
    // Mutation: invert the branch to `isActive !== false`.
    it('C3: active renders as today; honest copy is absent', async () => {
      renderAsUser(STUDENT_OR_PARENT_USER, {
        resolveStudentId: fakeResolveStudentId('student-t189-active'),
        resolveStudentIsActive: fakeResolveStudentIsActive(true),
        loadStudentData: () =>
          Promise.resolve({ history: [REAL_PAST_ROW], participation: REAL_PARTICIPATION }),
      });
      await flushMicrotasks();
      await flushMicrotasks();
      expect(container.textContent).not.toContain('Your student account is inactive');
      expect(headingOutline()).toContain('H2:Recent attendance');
    });

    // C4 -- the exact trap packet v2 §3 names: an ACTIVE student with zero
    // completed sessions also has `participation === null`, same as an
    // inactive student. Mutation: use `participation === null` as the
    // detector instead of `isActive === false`.
    it('C4: active with zero completed sessions (participation null) does not trigger the honest copy', async () => {
      renderAsUser(STUDENT_OR_PARENT_USER, {
        resolveStudentId: fakeResolveStudentId('student-t189-active-new'),
        resolveStudentIsActive: fakeResolveStudentIsActive(true),
        loadStudentData: () => Promise.resolve({ history: [], participation: null }),
      });
      await flushMicrotasks();
      await flushMicrotasks();
      expect(container.textContent).not.toContain('Your student account is inactive');
      expect(container.textContent).toContain('No meeting history yet');
    });

    // C5 -- absence-only by nature (v1's blanket pairing rule was wrong,
    // packet v2 §6). Mutation: call it in the explicit-studentId branch too.
    it('C5: resolveStudentIsActive is never called when an explicit studentId prop is supplied', async () => {
      const resolveStudentIsActiveSpy = vi.fn(fakeResolveStudentIsActive(false));
      renderAsUser(STUDENT_OR_PARENT_USER, {
        studentId: PLACEHOLDER_CURRENT_STUDENT_ID,
        resolveStudentIsActive: resolveStudentIsActiveSpy,
        loadStudentData: defaultLoadStudentMeetingsData,
      });
      await flushMicrotasks();
      await flushMicrotasks();
      expect(resolveStudentIsActiveSpy).not.toHaveBeenCalled();
      // Also proves the page did not somehow honor the spy's `false` return
      // despite never calling it -- would indicate a stale/wrong wiring.
      expect(container.textContent).not.toContain('Your student account is inactive');
    });

    // C6 -- MAJOR 3 (gate round 1): fails today if the inactive check sits
    // BELOW the `isEmpty` ternary -- a deactivated student with zero
    // history and null participation would fall into "No meeting history
    // yet" instead, since the branch would be unreachable in that state.
    // Mutation: move the inactive check below the `isEmpty` ternary.
    it('C6: inactive AND zero history rows AND null participation -- honest copy renders, "No meeting history yet" is absent', async () => {
      renderAsUser(STUDENT_OR_PARENT_USER, {
        resolveStudentId: fakeResolveStudentId('student-t189-inactive-empty'),
        resolveStudentIsActive: fakeResolveStudentIsActive(false),
        loadStudentData: () => Promise.resolve({ history: [], participation: null }),
      });
      await flushMicrotasks();
      await flushMicrotasks();
      expect(container.textContent).toContain('Your student account is inactive');
      expect(container.textContent).not.toContain('No meeting history yet');
    });
  });
});
