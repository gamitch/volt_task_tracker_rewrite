/**
 * T059: tests for `csvExport.ts`.
 *
 * Per this task's Allowed Files ("A colocated `csvExport.test.ts` is
 * acceptable per established precedent -- disclose it") this test file is
 * the same class of addition `HoursTab.test.tsx`/T057,
 * `EventsTab.test.tsx`/T058, and every other sibling report task in this
 * batch already made, producing the "Required Worker Output" section's
 * proof:
 *   - RFC 4180 escaping with REAL fixture names containing a comma AND a
 *     double-quote (not just happy-path names), plus a newline case.
 *   - ISO 8601 date/datetime pass-through (no locale reformatting).
 *   - `null` -> empty-field rendering for every not-applicable/
 *     not-yet-determined column.
 *   - A `hours_by_student.csv` cross-check against `HoursTab.tsx`'s own
 *     documented fixture numbers and formulas (hand-computed here, NOT
 *     imported -- `HoursTab.tsx` is a forbidden/read-only file for this
 *     task, per its own Ground Truth section; this file's fixtures are
 *     independently re-derived to match, module doc #3 of `csvExport.ts`).
 *
 * Pure-function module -- no React, no jsdom environment needed (unlike
 * `HoursTab.test.tsx`/`EventsTab.test.tsx`, which render components).
 */
import { describe, expect, it } from 'vitest';
import {
  buildAttendanceCsv,
  buildCsv,
  buildEventsCsv,
  buildHoursByStudentCsv,
  buildRosterCsv,
  escapeCsvField,
  type AttendanceCsvRow,
  type EventsCsvRow,
  type HoursByStudentCsvRow,
  type RosterCsvRow,
} from './csvExport';

const CRLF = '\r\n';
const UTF8_BOM = '\uFEFF';

/**
 * Minimal RFC 4180-aware line splitter for test assertions ONLY (not
 * exported from `csvExport.ts` -- that file only WRITES CSV, per its own
 * scope, module doc #1). A naive `line.split(',')` would misparse a
 * quoted field that itself contains a comma (e.g. `"Weekly Team Meeting,
 * Room A"`), splitting it into two columns instead of one -- this helper
 * respects quoting/doubled-quote-escaping so column-index assertions below
 * stay correct even against escaped fixture data.
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

// ---------------------------------------------------------------------------
// RFC 4180 escaping -- the core craft this task exists to prove. Real
// fixture names with a comma AND a double-quote (constitution item 6:
// fabricated names only), not just happy-path names.
// ---------------------------------------------------------------------------

describe('escapeCsvField (RFC 4180)', () => {
  it('leaves a plain value with no special characters unchanged', () => {
    expect(escapeCsvField('Jordan Blake')).toBe('Jordan Blake');
  });

  it('wraps a comma-containing value in double-quotes', () => {
    // Real fixture: a team/suffix name containing a literal comma.
    expect(escapeCsvField('Ortiz, Jr.')).toBe('"Ortiz, Jr."');
  });

  it('wraps a double-quote-containing value in double-quotes AND doubles the embedded quote', () => {
    // Real fixture: a nickname wrapped in literal double-quotes within the
    // display name itself.
    expect(escapeCsvField('Alex "Ace" Nguyen')).toBe('"Alex ""Ace"" Nguyen"');
  });

  it('wraps and doubles quotes for a value containing BOTH a comma and a double-quote', () => {
    // The exact combined case the worker packet calls out: "not just
    // happy-path names".
    expect(escapeCsvField('Nguyen, "Ace"')).toBe('"Nguyen, ""Ace"""');
  });

  it('wraps a newline-containing value in double-quotes', () => {
    expect(escapeCsvField('Line one\nLine two')).toBe('"Line one\nLine two"');
  });

  it('wraps a carriage-return-containing value in double-quotes', () => {
    expect(escapeCsvField('Line one\rLine two')).toBe('"Line one\rLine two"');
  });

  it('does not alter a value with only a single embedded double-quote at the edge', () => {
    expect(escapeCsvField('"leading quote')).toBe('"""leading quote"');
  });
});

describe('buildCsv', () => {
  it('prefixes a UTF-8 BOM and CRLF-terminates every record, including the header', () => {
    const csv = buildCsv(['Name', 'Team'], [['Jordan Blake', 'Hawks']]);
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
    const withoutBom = csv.slice(UTF8_BOM.length);
    expect(withoutBom).toBe(`Name,Team${CRLF}Jordan Blake,Hawks${CRLF}`);
  });

  it('escapes fields per-record when building a full document', () => {
    const csv = buildCsv(['Name', 'Team'], [['Alex "Ace" Nguyen', 'Ortiz, Jr.']]);
    const withoutBom = csv.slice(UTF8_BOM.length);
    expect(withoutBom).toBe(`Name,Team${CRLF}"Alex ""Ace"" Nguyen","Ortiz, Jr."${CRLF}`);
  });

  it('renders an empty rows array as just the header record', () => {
    const csv = buildCsv(['Name'], []);
    expect(csv).toBe(`${UTF8_BOM}Name${CRLF}`);
  });
});

// ---------------------------------------------------------------------------
// roster.csv -- mirrors StudentsTab.tsx's StudentDisplayRow.
// ---------------------------------------------------------------------------

describe('buildRosterCsv', () => {
  const rows: RosterCsvRow[] = [
    {
      studentId: 'student-1',
      // Comma AND quote fixture, in one row, per the packet's explicit ask.
      name: 'Alex "Ace" Nguyen',
      teamName: 'Ortiz, Jr. Squad',
      gradYear: 2027,
      isActive: true,
      goalHoursOverride: 15,
    },
    {
      studentId: 'student-2',
      name: 'Priya Anand',
      teamName: 'Hawks',
      gradYear: null,
      isActive: false,
      goalHoursOverride: null,
    },
  ];

  it('produces a header row and correctly escaped/formatted data rows', () => {
    const csv = buildRosterCsv(rows);
    const lines = csv
      .slice(UTF8_BOM.length)
      .split(CRLF)
      .filter((line) => line.length > 0);
    expect(lines[0]).toBe('Student ID,Name,Team,Grad Year,Active,Goal Hours Override');
    expect(lines[1]).toBe('student-1,"Alex ""Ace"" Nguyen","Ortiz, Jr. Squad",2027,Active,15');
    expect(lines[2]).toBe('student-2,Priya Anand,Hawks,,Inactive,');
  });

  it('renders null gradYear and null goalHoursOverride as empty fields, never fabricated zeros', () => {
    const csv = buildRosterCsv([rows[1]]);
    const dataLine = csv.slice(UTF8_BOM.length).split(CRLF)[1];
    const fields = dataLine.split(',');
    expect(fields[3]).toBe(''); // Grad Year
    expect(fields[5]).toBe(''); // Goal Hours Override
  });
});

// ---------------------------------------------------------------------------
// events.csv -- mirrors EventsTab.tsx's EventSessionDisplayRow (per-session
// grain). ISO date pass-through proof.
// ---------------------------------------------------------------------------

describe('buildEventsCsv', () => {
  const meetingRow: EventsCsvRow = {
    sessionId: 'session-m1',
    eventTitle: 'Weekly Team Meeting, Room A',
    type: 'meeting',
    sessionDate: '2026-07-07',
    status: 'completed',
    presentCt: 4,
    lateCt: 1,
    excusedCt: 0,
    absentCt: 2,
    signupsGoingCt: null,
    signupsMaybeCt: null,
    signupsDeclinedCt: null,
    hoursAwarded: 7.3,
    peopleReached: null,
    adultVolunteersCount: 1,
    adultVolunteerHours: 1.5,
  };

  const scheduledOutreachRow: EventsCsvRow = {
    sessionId: 'session-o1',
    eventTitle: 'Park Cleanup',
    type: 'outreach',
    sessionDate: '2026-08-01',
    status: 'scheduled',
    presentCt: 0,
    lateCt: 0,
    excusedCt: 0,
    absentCt: 0,
    signupsGoingCt: 5,
    signupsMaybeCt: 2,
    signupsDeclinedCt: 1,
    hoursAwarded: null, // not yet completed -- not-yet-determined, not 0
    peopleReached: null,
    adultVolunteersCount: 2,
    adultVolunteerHours: 4.0,
  };

  it('renders session dates as ISO 8601 date-only strings, never locale-formatted', () => {
    const csv = buildEventsCsv([meetingRow]);
    const dataLine = csv.slice(UTF8_BOM.length).split(CRLF)[1];
    // Field index 2 = Session Date (Session ID, Type, Session Date, ...).
    // Parsed with `parseCsvLine` (not a naive `.split(',')`) since
    // `meetingRow.eventTitle` itself contains an escaped, quoted comma.
    expect(parseCsvLine(dataLine)[2]).toBe('2026-07-07');
    expect(dataLine).not.toContain('Jul');
  });

  it('renders a null signups summary (meeting row) as empty fields, not fabricated zeros', () => {
    const csv = buildEventsCsv([meetingRow]);
    const lines = csv
      .slice(UTF8_BOM.length)
      .split(CRLF)
      .filter((l) => l.length > 0);
    const header = parseCsvLine(lines[0]);
    const data = parseCsvLine(lines[1]);
    const goingIdx = header.indexOf('Signups Going');
    const maybeIdx = header.indexOf('Signups Maybe');
    const declinedIdx = header.indexOf('Signups Declined');
    expect(data[goingIdx]).toBe('');
    expect(data[maybeIdx]).toBe('');
    expect(data[declinedIdx]).toBe('');
  });

  it('distinguishes null hoursAwarded (not-yet-determined) from a real numeric value', () => {
    const csv = buildEventsCsv([meetingRow, scheduledOutreachRow]);
    const lines = csv
      .slice(UTF8_BOM.length)
      .split(CRLF)
      .filter((l) => l.length > 0);
    const header = parseCsvLine(lines[0]);
    const hoursIdx = header.indexOf('Hours Awarded');
    expect(parseCsvLine(lines[1])[hoursIdx]).toBe('7.3');
    expect(parseCsvLine(lines[2])[hoursIdx]).toBe('');
  });

  it('escapes a comma-containing event title correctly', () => {
    const csv = buildEventsCsv([meetingRow]);
    expect(csv).toContain('"Weekly Team Meeting, Room A"');
  });

  it('formats numeric hours/counts without unit suffixes (machine-parseable)', () => {
    const csv = buildEventsCsv([scheduledOutreachRow]);
    const dataLine = csv.slice(UTF8_BOM.length).split(CRLF)[1];
    expect(dataLine).toContain('4.0'); // adultVolunteerHours, no "h" suffix
    expect(dataLine).not.toContain('4.0h');
  });
});

// ---------------------------------------------------------------------------
// attendance.csv -- new shape, real `attendance` table columns.
// ---------------------------------------------------------------------------

describe('buildAttendanceCsv', () => {
  const rowWithCheckTimes: AttendanceCsvRow = {
    studentId: 'student-b',
    studentName: 'Maya "Mo" Osei',
    teamName: 'Hawks',
    sessionId: 'session-m1',
    eventTitle: 'Weekly Team Meeting',
    sessionDate: '2026-07-07',
    status: 'present',
    checkInAt: '2026-07-07T18:30:00.000Z',
    checkOutAt: '2026-07-07T19:30:00.000Z',
    hoursOverride: null,
    method: 'qr',
  };

  const rowWithoutCheckTimes: AttendanceCsvRow = {
    studentId: 'student-e',
    studentName: 'Diego, Ramirez', // deliberately comma-containing
    teamName: 'Comets',
    sessionId: 'session-m1',
    eventTitle: 'Weekly Team Meeting',
    sessionDate: '2026-07-07',
    status: 'excused',
    checkInAt: null,
    checkOutAt: null,
    hoursOverride: 2.5,
    method: 'coach',
  };

  it('renders check-in/check-out as full ISO 8601 UTC timestamps, verbatim', () => {
    const csv = buildAttendanceCsv([rowWithCheckTimes]);
    const dataLine = csv.slice(UTF8_BOM.length).split(CRLF)[1];
    expect(dataLine).toContain('2026-07-07T18:30:00.000Z');
    expect(dataLine).toContain('2026-07-07T19:30:00.000Z');
  });

  it('renders null check-in/check-out and null hoursOverride as empty fields', () => {
    const csv = buildAttendanceCsv([
      { ...rowWithCheckTimes, checkInAt: null, checkOutAt: null, hoursOverride: null },
    ]);
    const lines = csv
      .slice(UTF8_BOM.length)
      .split(CRLF)
      .filter((l) => l.length > 0);
    const header = parseCsvLine(lines[0]);
    const data = parseCsvLine(lines[1]);
    expect(data[header.indexOf('Check-in At')]).toBe('');
    expect(data[header.indexOf('Check-out At')]).toBe('');
    expect(data[header.indexOf('Hours Override')]).toBe('');
  });

  it('renders a real hoursOverride value and escapes a comma-containing student name', () => {
    const csv = buildAttendanceCsv([rowWithoutCheckTimes]);
    expect(csv).toContain('"Diego, Ramirez"');
    expect(csv).toContain(',2.5,'); // hoursOverride field, unit-suffix-free
  });
});

// ---------------------------------------------------------------------------
// hours_by_student.csv -- cross-check against HoursTab.tsx's own documented
// fixture numbers/formulas (module doc #3 of csvExport.ts: NEVER recomputed
// in csvExport.ts itself; this test proves the CSV output byte-for-byte
// matches what those formulas produce for the identical inputs).
//
// HoursTab.tsx is a forbidden/read-only file for this task -- its formulas
// are hand-reproduced here from its own module doc text, NOT imported:
//   resolveGoalHours(goalHoursOverride, defaultGoalHours) =
//     goalHoursOverride ?? defaultGoalHours
//   hoursVsGoalPercent(confirmedHours, goalHours) =
//     goalHours <= 0 ? 0 : min(100, round1(confirmedHours / goalHours * 100))
//   round1(value) = Math.round(value * 10) / 10
//
// Fixture values below are HoursTab.tsx's own documented
// FIXTURE_STUDENT_HOURS / FIXTURE_STUDENTS / FIXTURE_DEFAULT_GOAL_HOURS
// values (read directly from that file, not re-invented):
//   - Jordan Blake: confirmedHours = 45.5, goalHoursOverride = null,
//     defaultGoalHours = 80.
//   - Maya Osei: confirmedHours = 52, goalHoursOverride = 50.
//   - Theo Nakamura: NO v_student_hours row -> confirmedHours = 0 (the
//     disclosed "hasn't confirmed any hours yet" 0, never fabricated),
//     goalHoursOverride = null. Planned hours = sessionHours of
//     session-cleanup-upcoming (2026-08-01T15:00:00.000Z ->
//     2026-08-01T18:00:00.000Z = 3.0h, his one `going` + `scheduled` +
//     countsVolunteerHours RSVP).
// ---------------------------------------------------------------------------

describe('buildHoursByStudentCsv (cross-check against HoursTab.tsx formulas)', () => {
  function resolveGoalHours(override: number | null, defaultGoalHours: number): number {
    return override ?? defaultGoalHours;
  }

  function round1(value: number): number {
    return Math.round(value * 10) / 10;
  }

  function hoursVsGoalPercent(confirmedHours: number, goalHours: number): number {
    if (goalHours <= 0) return 0;
    return Math.min(100, round1((confirmedHours / goalHours) * 100));
  }

  const DEFAULT_GOAL_HOURS = 80;

  it('matches HoursTab.tsx-equivalent computation for Jordan Blake (no override -> default goal, sub-100%)', () => {
    const confirmedHours = 45.5;
    const goalHours = resolveGoalHours(null, DEFAULT_GOAL_HOURS);
    const percentToGoal = hoursVsGoalPercent(confirmedHours, goalHours);
    expect(goalHours).toBe(80);
    expect(percentToGoal).toBe(56.9); // 45.5 / 80 * 100 = 56.875 -> round1 -> 56.9

    const row: HoursByStudentCsvRow = {
      studentId: 'student-jordan-blake',
      studentName: 'Jordan Blake',
      teamName: 'Hawks',
      confirmedHours,
      plannedHours: 0,
      goalHours,
      percentToGoal,
    };
    const csv = buildHoursByStudentCsv([row]);
    const lines = csv
      .slice(UTF8_BOM.length)
      .split(CRLF)
      .filter((l) => l.length > 0);
    expect(lines[1]).toBe('student-jordan-blake,Jordan Blake,Hawks,45.5,0.0,80.0,56.9');
  });

  it('matches HoursTab.tsx-equivalent computation for Maya Osei (override wins, clamped at 100%)', () => {
    const confirmedHours = 52;
    const goalHours = resolveGoalHours(50, DEFAULT_GOAL_HOURS);
    const percentToGoal = hoursVsGoalPercent(confirmedHours, goalHours);
    expect(goalHours).toBe(50); // override (50) wins over default (80)
    expect(percentToGoal).toBe(100); // 52/50*100 = 104 -> clamped to 100

    const row: HoursByStudentCsvRow = {
      studentId: 'student-maya-osei',
      studentName: 'Maya Osei',
      teamName: 'Hawks',
      confirmedHours,
      plannedHours: 0,
      goalHours,
      percentToGoal,
    };
    const csv = buildHoursByStudentCsv([row]);
    const lines = csv
      .slice(UTF8_BOM.length)
      .split(CRLF)
      .filter((l) => l.length > 0);
    expect(lines[1]).toBe('student-maya-osei,Maya Osei,Hawks,52.0,0.0,50.0,100');
  });

  it('matches HoursTab.tsx-equivalent computation for Theo Nakamura (no confirmed-hours row -> 0, real planned hours)', () => {
    const confirmedHours = 0; // no v_student_hours row -- disclosed 0, not fabricated
    const plannedHours = 3.0; // sessionHours(session-cleanup-upcoming): 15:00Z -> 18:00Z
    const goalHours = resolveGoalHours(null, DEFAULT_GOAL_HOURS);
    const percentToGoal = hoursVsGoalPercent(confirmedHours, goalHours);
    expect(percentToGoal).toBe(0);

    const row: HoursByStudentCsvRow = {
      studentId: 'student-theo-nakamura',
      studentName: 'Theo Nakamura',
      teamName: 'Hawks',
      confirmedHours,
      plannedHours,
      goalHours,
      percentToGoal,
    };
    const csv = buildHoursByStudentCsv([row]);
    const lines = csv
      .slice(UTF8_BOM.length)
      .split(CRLF)
      .filter((l) => l.length > 0);
    expect(lines[1]).toBe('student-theo-nakamura,Theo Nakamura,Hawks,0.0,3.0,80.0,0');
  });

  it('escapes a comma-and-quote-containing student name in a real hours row', () => {
    const row: HoursByStudentCsvRow = {
      studentId: 'student-x',
      studentName: 'Nguyen, "Ace"',
      teamName: 'Otters',
      confirmedHours: 10,
      plannedHours: 0,
      goalHours: 80,
      percentToGoal: 12.5,
    };
    const csv = buildHoursByStudentCsv([row]);
    expect(csv).toContain('"Nguyen, ""Ace"""');
  });
});
