// GAM-443: tests for `format.ts` -- the shared home for the meeting
// date/time formatters GAM-443 moved out of `MeetingsList.tsx` (byte-
// identical body) and out of `CalendarPage.tsx`'s own reimplementation, plus
// the new `buildScheduleChips`, whose signature GAM-441 will freeze into
// `types.ts`. `MeetingsList.test.tsx`/`CalendarPage.test.tsx` already pin
// the moved formatters' behaviour through the page modules that re-export
// them; this file adds direct coverage colocated with the new home, same
// convention `src/lib/format/dates.test.ts` established, plus the acceptance
// criteria for `buildScheduleChips` (criterion 5).
import { describe, expect, it } from 'vitest';
import { buildScheduleChips, type ScheduleRule } from './format.ts';

describe('buildScheduleChips', () => {
  it("renders the issue's own worked example -- two rules, in input order", () => {
    const rules: ScheduleRule[] = [
      { dow: 2, startMinutes: 1080, endMinutes: 1200 },
      { dow: 0, startMinutes: 930, endMinutes: 1110 },
    ];
    expect(buildScheduleChips(rules)).toEqual(['Tue 6–8 PM', 'Sun 3:30–6:30 PM']);
  });

  it('renders a single-day rule', () => {
    const rules: ScheduleRule[] = [{ dow: 2, startMinutes: 1080, endMinutes: 1200 }];
    expect(buildScheduleChips(rules)).toEqual(['Tue 6–8 PM']);
  });

  it('returns [] for empty input', () => {
    expect(buildScheduleChips([])).toEqual([]);
  });

  it('shows both meridiems when the range straddles noon', () => {
    const rules: ScheduleRule[] = [{ dow: 3, startMinutes: 660, endMinutes: 780 }];
    expect(buildScheduleChips(rules)).toEqual(['Wed 11 AM–1 PM']);
  });

  it('renders midnight as 12, not 0 (catches the `h % 12` bug)', () => {
    const rules: ScheduleRule[] = [{ dow: 4, startMinutes: 0, endMinutes: 180 }];
    expect(buildScheduleChips(rules)).toEqual(['Thu 12–3 AM']);
  });

  it('renders noon as 12 PM, with both ends kept since the meridiem straddles noon', () => {
    const rules: ScheduleRule[] = [{ dow: 5, startMinutes: 690, endMinutes: 750 }];
    expect(buildScheduleChips(rules)).toEqual(['Fri 11:30 AM–12:30 PM']);
  });

  it('renders endMinutes:1440 (midnight ending the day) as 12 AM, not the false 12 PM the `>= 720` fall-through would print', () => {
    const rules: ScheduleRule[] = [{ dow: 1, startMinutes: 1320, endMinutes: 1440 }];
    expect(buildScheduleChips(rules)).toEqual(['Mon 10 PM–12 AM']);
  });

  it('throws RangeError when dow is out of 0..6 (deliberate out-of-contract probe, cast required)', () => {
    const rules = [{ dow: 7, startMinutes: 0, endMinutes: 60 }] as unknown as ScheduleRule[];
    expect(() => buildScheduleChips(rules)).toThrow(RangeError);
  });

  it('throws RangeError when endMinutes <= startMinutes', () => {
    const rules: ScheduleRule[] = [{ dow: 0, startMinutes: 600, endMinutes: 600 }];
    expect(() => buildScheduleChips(rules)).toThrow(RangeError);
  });

  it('throws RangeError when startMinutes is 1440 (out of the 0-1439 range, and no legal endMinutes exists above it either)', () => {
    const rules: ScheduleRule[] = [{ dow: 2, startMinutes: 1440, endMinutes: 1440 }];
    expect(() => buildScheduleChips(rules)).toThrow(RangeError);
  });
});
