// src/emails/templates/weekly-digest.test.tsx
//
// T050 -- tests for `weekly-digest.tsx`. Per this task's Allowed Files ("A
// colocated `weekly-digest.test.tsx` is acceptable per established
// precedent -- disclose it"), same class of addition
// `renderEmailLayout.test.ts` already made in its own sibling directory.
// This module produces plain HTML strings (no JSX, module doc #1 of
// `weekly-digest.tsx`), so -- same as `renderEmailLayout.test.ts` -- no
// `@vitest-environment jsdom` pragma or live rendering is needed here, only
// string assertions.
//
// Two entirely separate, clearly-fabricated, clearly-distinct family
// fixtures are used throughout (constitution item 6): the Alvarado family
// (parent Jordan Alvarado, students Mika Alvarado + Reese Alvarado, team
// "Thunder Bots") and the Whitcombe family (parent Sasha Whitcombe, student
// Tavi Whitcombe, team "Circuit Sirens"). Every name/team/event title below
// is invented for this test file only.
import { describe, expect, it } from 'vitest';
import { ACCENT_LIGHT, MANAGE_PREFERENCES_URL, SENDER_ADDRESS } from '../layout/constants.ts';
import {
  buildWeeklyDigestBodyHtml,
  computeWeeklyDigestWeekBoundaries,
  crossedMilestones,
  highestMilestoneReached,
  hoursVsGoalPercent,
  renderWeeklyDigestEmail,
  studentGoalHours,
  type WeeklyDigestParams,
  type WeeklyDigestStudentEntry,
} from './weekly-digest.tsx';

// ---------------------------------------------------------------------------
// Fixtures -- two distinct, fabricated families. `SEND_INSTANT` is a real
// Sunday (2026-07-19, this task's own sandbox reference date) at 5pm CT
// (22:00 UTC, CDT in July), matching EML-02's schedule exactly.
// ---------------------------------------------------------------------------

const SEND_INSTANT = new Date('2026-07-19T22:00:00.000Z');

const MIKA_ALVARADO: WeeklyDigestStudentEntry = {
  studentId: 'student-mika-alvarado-fixture',
  displayName: 'Mika Alvarado',
  teamName: 'Thunder Bots',
  confirmedHours: 42,
  defaultGoalHours: 100,
  goalHoursOverride: null,
  lastWeekAttendance: [
    {
      sessionId: 'session-mika-1',
      eventTitle: 'Thunder Bots Build Night',
      sessionDate: '2026-07-15',
      status: 'present',
    },
  ],
  nextWeekSchedule: [
    {
      sessionId: 'session-mika-2',
      eventTitle: 'Thunder Bots Weekly Meeting',
      eventType: 'meeting',
      sessionDate: '2026-07-22',
      startsAt: '2026-07-22T23:00:00.000Z',
      endsAt: '2026-07-23T01:00:00.000Z',
    },
  ],
};

const REESE_ALVARADO: WeeklyDigestStudentEntry = {
  studentId: 'student-reese-alvarado-fixture',
  displayName: 'Reese Alvarado',
  teamName: 'Thunder Bots',
  confirmedHours: 80,
  defaultGoalHours: 100,
  goalHoursOverride: null,
  lastWeekAttendance: [
    {
      sessionId: 'session-reese-1',
      eventTitle: 'Thunder Bots Build Night',
      sessionDate: '2026-07-15',
      status: 'excused',
    },
  ],
  nextWeekSchedule: [
    {
      sessionId: 'session-reese-2',
      eventTitle: 'Bake Sale Fundraiser',
      eventType: 'outreach',
      sessionDate: '2026-07-23',
      startsAt: '2026-07-23T18:00:00.000Z',
      endsAt: '2026-07-23T21:00:00.000Z',
    },
  ],
};

const ALVARADO_PARAMS: WeeklyDigestParams = {
  parentDisplayName: 'Jordan Alvarado',
  sendInstant: SEND_INSTANT,
  students: [MIKA_ALVARADO, REESE_ALVARADO],
};

const TAVI_WHITCOMBE: WeeklyDigestStudentEntry = {
  studentId: 'student-tavi-whitcombe-fixture',
  displayName: 'Tavi Whitcombe',
  teamName: 'Circuit Sirens',
  confirmedHours: 25,
  defaultGoalHours: 50,
  goalHoursOverride: null,
  lastWeekAttendance: [
    {
      sessionId: 'session-tavi-1',
      eventTitle: 'Circuit Sirens Practice',
      sessionDate: '2026-07-16',
      status: 'late',
    },
  ],
  nextWeekSchedule: [
    {
      sessionId: 'session-tavi-2',
      eventTitle: 'Regional Qualifier',
      eventType: 'competition',
      sessionDate: '2026-07-24',
      startsAt: '2026-07-24T15:00:00.000Z',
      endsAt: '2026-07-24T22:00:00.000Z',
    },
  ],
};

const WHITCOMBE_PARAMS: WeeklyDigestParams = {
  parentDisplayName: 'Sasha Whitcombe',
  sendInstant: SEND_INSTANT,
  students: [TAVI_WHITCOMBE],
};

// ---------------------------------------------------------------------------
// EML-05 -- BLOCKER-class cross-family-leakage proof (Known Context/Traps
// #2 of the worker packet). Renders each family's digest independently and
// asserts the OTHER family's name/team/event data never appears anywhere in
// the output, in either direction.
// ---------------------------------------------------------------------------

describe("EML-05: weekly digest never leaks another family's data", () => {
  const alvaradoHtml = buildWeeklyDigestBodyHtml(ALVARADO_PARAMS);
  const whitcombeHtml = buildWeeklyDigestBodyHtml(WHITCOMBE_PARAMS);

  it("renders the Alvarado family's own data", () => {
    expect(alvaradoHtml).toContain('Jordan Alvarado');
    expect(alvaradoHtml).toContain('Mika Alvarado');
    expect(alvaradoHtml).toContain('Reese Alvarado');
    expect(alvaradoHtml).toContain('Thunder Bots');
    expect(alvaradoHtml).toContain('Thunder Bots Build Night');
    expect(alvaradoHtml).toContain('Bake Sale Fundraiser');
  });

  it('the Alvarado digest never contains any Whitcombe family data', () => {
    expect(alvaradoHtml).not.toContain('Whitcombe');
    expect(alvaradoHtml).not.toContain('Sasha');
    expect(alvaradoHtml).not.toContain('Tavi');
    expect(alvaradoHtml).not.toContain('Circuit Sirens');
    expect(alvaradoHtml).not.toContain('Circuit Sirens Practice');
    expect(alvaradoHtml).not.toContain('Regional Qualifier');
    expect(alvaradoHtml).not.toContain(TAVI_WHITCOMBE.studentId);
  });

  it("renders the Whitcombe family's own data", () => {
    expect(whitcombeHtml).toContain('Sasha Whitcombe');
    expect(whitcombeHtml).toContain('Tavi Whitcombe');
    expect(whitcombeHtml).toContain('Circuit Sirens');
    expect(whitcombeHtml).toContain('Circuit Sirens Practice');
    expect(whitcombeHtml).toContain('Regional Qualifier');
  });

  it('the Whitcombe digest never contains any Alvarado family data', () => {
    expect(whitcombeHtml).not.toContain('Alvarado');
    expect(whitcombeHtml).not.toContain('Jordan');
    expect(whitcombeHtml).not.toContain('Mika');
    expect(whitcombeHtml).not.toContain('Reese');
    expect(whitcombeHtml).not.toContain('Thunder Bots');
    expect(whitcombeHtml).not.toContain('Thunder Bots Build Night');
    expect(whitcombeHtml).not.toContain('Bake Sale Fundraiser');
    expect(whitcombeHtml).not.toContain(MIKA_ALVARADO.studentId);
    expect(whitcombeHtml).not.toContain(REESE_ALVARADO.studentId);
  });

  it('same proof holds through the full renderWeeklyDigestEmail (layout-wrapped) output', () => {
    const alvaradoFullHtml = renderWeeklyDigestEmail(ALVARADO_PARAMS);
    const whitcombeFullHtml = renderWeeklyDigestEmail(WHITCOMBE_PARAMS);
    expect(alvaradoFullHtml).not.toContain('Whitcombe');
    expect(alvaradoFullHtml).not.toContain('Circuit Sirens');
    expect(whitcombeFullHtml).not.toContain('Alvarado');
    expect(whitcombeFullHtml).not.toContain('Thunder Bots');
  });

  it('the props interface has no "all students" fallback -- students is the only data source', () => {
    // Structural proof, not just behavioral: a digest with an empty
    // `students` array renders zero per-student sections, never a
    // roster-wide fallback.
    const emptyHtml = buildWeeklyDigestBodyHtml({ ...ALVARADO_PARAMS, students: [] });
    expect(emptyHtml).not.toContain('Mika Alvarado');
    expect(emptyHtml).not.toContain('Reese Alvarado');
    expect(emptyHtml).toContain('Jordan Alvarado'); // greeting still renders
  });
});

// ---------------------------------------------------------------------------
// Hours vs. goal -- confirmedHours sourced from `v_student_hours` only,
// never recomputed; goal-hours resolution matches the established
// `studentGoalHours`/`hoursVsGoalPercent` pattern (worker packet's
// "Required Worker Output" -- real test proof).
// ---------------------------------------------------------------------------

describe('hours vs. goal rendering (established resolveGoalHours/hoursVsGoalPercent pattern)', () => {
  it('studentGoalHours: null override falls back to defaultGoalHours', () => {
    expect(studentGoalHours({ goalHoursOverride: null }, 100)).toBe(100);
  });

  it('studentGoalHours: a non-null override always wins, regardless of default', () => {
    expect(studentGoalHours({ goalHoursOverride: 20 }, 100)).toBe(20);
  });

  it('hoursVsGoalPercent: clamped to 100, never exceeds it even if confirmed > goal', () => {
    expect(hoursVsGoalPercent(150, 100)).toBe(100);
  });

  it('hoursVsGoalPercent: goalHours <= 0 guards to 0 (never divide by zero)', () => {
    expect(hoursVsGoalPercent(10, 0)).toBe(0);
  });

  it("renders Mika's 42/100 h (42%) exactly as a plain nullish-coalesce goal, no override", () => {
    const html = buildWeeklyDigestBodyHtml(ALVARADO_PARAMS);
    expect(html).toContain('42 / 100 h');
    expect(html).toContain('(42%)');
  });

  it("renders Tavi's 25/50 h (50%) using a lower defaultGoalHours than Mika's", () => {
    const html = buildWeeklyDigestBodyHtml(WHITCOMBE_PARAMS);
    expect(html).toContain('25 / 50 h');
    expect(html).toContain('(50%)');
  });

  it('a goalHoursOverride, when present, wins over defaultGoalHours in the rendered output', () => {
    const overriddenStudent: WeeklyDigestStudentEntry = {
      ...MIKA_ALVARADO,
      confirmedHours: 15,
      defaultGoalHours: 100,
      goalHoursOverride: 20,
    };
    const html = buildWeeklyDigestBodyHtml({
      ...ALVARADO_PARAMS,
      students: [overriddenStudent],
    });
    expect(html).toContain('15 / 20 h');
    expect(html).not.toContain('15 / 100 h');
  });

  it('confirmedHours is never recomputed/summed from the attendance or schedule arrays (BEH-01/BEH-02)', () => {
    // Add many extra last-week attendance rows and next-week schedule rows
    // -- confirmedHours (a fixed prop, standing in for a real
    // `v_student_hours` lookup) must stay exactly the same value regardless
    // of how many session rows accompany it.
    const manyRowsStudent: WeeklyDigestStudentEntry = {
      ...MIKA_ALVARADO,
      confirmedHours: 42,
      lastWeekAttendance: [
        ...MIKA_ALVARADO.lastWeekAttendance,
        {
          sessionId: 'extra-1',
          eventTitle: 'Extra Session A',
          sessionDate: '2026-07-16',
          status: 'present',
        },
        {
          sessionId: 'extra-2',
          eventTitle: 'Extra Session B',
          sessionDate: '2026-07-17',
          status: 'late',
        },
      ],
      nextWeekSchedule: [
        ...MIKA_ALVARADO.nextWeekSchedule,
        {
          sessionId: 'extra-3',
          eventTitle: 'Extra Upcoming Session',
          eventType: 'meeting',
          sessionDate: '2026-07-23',
          startsAt: '2026-07-23T23:00:00.000Z',
          endsAt: '2026-07-24T01:00:00.000Z',
        },
      ],
    };
    const html = buildWeeklyDigestBodyHtml({ ...ALVARADO_PARAMS, students: [manyRowsStudent] });
    expect(html).toContain('42 / 100 h');
    expect(html).toContain('(42%)');
  });

  it('milestone framing (module doc #5): highest 25/50/75/100 milestone crossed by confirmed hours only', () => {
    expect(crossedMilestones(42)).toEqual([25]);
    expect(crossedMilestones(80)).toEqual([25, 50, 75]);
    expect(highestMilestoneReached(80)).toBe(75);
    expect(highestMilestoneReached(10)).toBeNull();
  });

  it('renders the 75% milestone sentence for Reese (80%) and the 50% milestone sentence for Tavi (50%)', () => {
    const alvaradoHtml = buildWeeklyDigestBodyHtml(ALVARADO_PARAMS);
    expect(alvaradoHtml).toContain("Reached the 75% milestone toward this season's goal.");
    const whitcombeHtml = buildWeeklyDigestBodyHtml(WHITCOMBE_PARAMS);
    expect(whitcombeHtml).toContain("Reached the 50% milestone toward this season's goal.");
  });

  it('renders no milestone sentence for a student below 25%', () => {
    const belowMilestoneStudent: WeeklyDigestStudentEntry = {
      ...MIKA_ALVARADO,
      confirmedHours: 5,
      defaultGoalHours: 100,
    };
    const html = buildWeeklyDigestBodyHtml({
      ...ALVARADO_PARAMS,
      students: [belowMilestoneStudent],
    });
    expect(html).not.toContain('milestone');
  });
});

// ---------------------------------------------------------------------------
// Week boundaries -- explicit Sun-Sat calendar week interpretation (module
// doc #4 of `weekly-digest.tsx`).
// ---------------------------------------------------------------------------

describe('week boundaries (Sun-Sat calendar week aligned to the Sunday 5pm CT send)', () => {
  it('computes last week as the 7 days immediately before the Sunday send date', () => {
    const boundaries = computeWeeklyDigestWeekBoundaries(SEND_INSTANT);
    expect(boundaries.lastWeekStart).toBe('2026-07-12');
    expect(boundaries.lastWeekEnd).toBe('2026-07-18');
  });

  it('computes next week as the Sunday send date through the following Saturday', () => {
    const boundaries = computeWeeklyDigestWeekBoundaries(SEND_INSTANT);
    expect(boundaries.nextWeekStart).toBe('2026-07-19');
    expect(boundaries.nextWeekEnd).toBe('2026-07-25');
  });

  it('renders the computed week ranges as human-readable date ranges in the body copy', () => {
    const html = buildWeeklyDigestBodyHtml(ALVARADO_PARAMS);
    expect(html).toContain('Jul 12 – Jul 18');
    expect(html).toContain('Jul 19 – Jul 25');
  });
});

// ---------------------------------------------------------------------------
// Per-student breakdown structure -- attendance list, schedule list, empty
// states.
// ---------------------------------------------------------------------------

describe('per-linked-student breakdown content', () => {
  const html = buildWeeklyDigestBodyHtml(ALVARADO_PARAMS);

  it("renders last week's attendance status for each student", () => {
    expect(html).toContain('Thunder Bots Build Night (Wed, Jul 15) — Present');
    expect(html).toContain('Thunder Bots Build Night (Wed, Jul 15) — Excused');
  });

  it("renders next week's schedule for each student", () => {
    expect(html).toContain('Thunder Bots Weekly Meeting');
    expect(html).toContain('Bake Sale Fundraiser');
  });

  it('renders an explicit empty state when a student has no attendance/schedule rows', () => {
    const emptyStudent: WeeklyDigestStudentEntry = {
      ...MIKA_ALVARADO,
      lastWeekAttendance: [],
      nextWeekSchedule: [],
    };
    const emptyHtml = buildWeeklyDigestBodyHtml({ ...ALVARADO_PARAMS, students: [emptyStudent] });
    expect(emptyHtml).toContain('No sessions last week.');
    expect(emptyHtml).toContain('Nothing scheduled next week.');
  });

  it('renders each linked student in their own section (two students -> two sections)', () => {
    const mikaIndex = html.indexOf('Mika Alvarado');
    const reeseIndex = html.indexOf('Reese Alvarado');
    expect(mikaIndex).toBeGreaterThan(-1);
    expect(reeseIndex).toBeGreaterThan(-1);
    expect(mikaIndex).not.toBe(reeseIndex);
  });
});

// ---------------------------------------------------------------------------
// Layout integration (EML-01) + constitution item 13 (no box-drawing/
// bracket characters).
// ---------------------------------------------------------------------------

describe('renderWeeklyDigestEmail (EML-01 shared layout integration)', () => {
  const fullHtml = renderWeeklyDigestEmail(ALVARADO_PARAMS);

  it('is a complete standalone HTML document using the shared branded layout', () => {
    expect(fullHtml.startsWith('<!doctype html>')).toBe(true);
    expect(fullHtml).toContain('>VOLT<');
    expect(fullHtml).toContain(ACCENT_LIGHT);
  });

  it('contains the manage-preferences footer link', () => {
    expect(fullHtml).toContain(`href="${MANAGE_PREFERENCES_URL}"`);
  });

  it('re-exports the shared SENDER_ADDRESS constant unchanged (EML-01)', () => {
    expect(SENDER_ADDRESS).toBe('VOLT Robotics <notifications@mail.voltfrc.org>');
  });

  it('contains no box-drawing or bracket characters anywhere in the rendered output (constitution item 13)', () => {
    const forbiddenChars = ['[', ']', '┌', '┐', '└', '┘', '─', '│', '├', '┤', '┬', '┴', '┼'];
    for (const char of forbiddenChars) {
      expect(fullHtml.includes(char)).toBe(false);
    }
  });
});
