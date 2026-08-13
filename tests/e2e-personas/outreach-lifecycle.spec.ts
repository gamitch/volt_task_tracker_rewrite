/**
 * GAM-343 (W2) -- the full outreach lifecycle, driven end to end: a coach
 * creates an event, a student answers and changes their answer, a coach
 * records attendance on the page, the day is marked complete (with an
 * uncheck), and the resulting hours are read back from `v_student_hours`.
 *
 * Every assertion below is about POST-WRITE ROW STATE, never about the
 * request the app issued -- same discipline `coach-meeting.spec.ts` and
 * `coach-checkin.spec.ts` already use.
 *
 * The journey is written as ONE test rather than several, because every step
 * after the first depends on the event/session id the first step creates,
 * and the whole point (AC 1) is one continuous, driven journey through
 * create -> RSVP -> attend -> complete -> hours land. Read the packet's §4
 * for the exact terrain citations this file is built from
 * (docs/swarm/active/GAM-343-packet.md) -- selectors, caveats and the
 * `computeExpectedAttendeeRsvpPlan` fan-out trap are all measured there, not
 * guessed here.
 */
import { expect, test, type Page } from 'playwright/test';
import { PERSONAS, SEED, capture, execAdmin, readRows, signIn } from './personaHarness';

const TITLE_PREFIX = 'GAM343 Lifecycle';
const EVENT_TITLE = `${TITLE_PREFIX} — Outreach`;
const JORDAN_NAME = 'Jordan Okafor';

interface EventRow {
  id: string;
  title: string;
  team_ids: string[] | null;
}

interface SessionRow {
  id: string;
  session_date: string;
  status: string;
  people_reached: number | null;
}

interface RsvpRow {
  status: string;
  responded_by: string | null;
  updated_at: string;
}

interface AttendanceRow {
  id: string;
  status: string;
  method: string;
  recorded_by: string | null;
  hours_override: number | null;
}

function eventsTitled(title: string): EventRow[] {
  return readRows<EventRow>(`select id, title, team_ids from events where title = '${title}'`);
}

function sessionsFor(eventId: string): SessionRow[] {
  return readRows<SessionRow>(
    `select id, session_date::text, status, people_reached
     from event_sessions where event_id = '${eventId}' order by session_date`,
  );
}

function rsvpsFor(sessionId: string, studentId: string): RsvpRow[] {
  return readRows<RsvpRow>(
    `select status, responded_by, updated_at::text
     from rsvps where session_id = '${sessionId}' and student_id = '${studentId}'`,
  );
}

function attendanceFor(sessionId: string, studentId: string): AttendanceRow[] {
  return readRows<AttendanceRow>(
    `select id, status, method, recorded_by, hours_override
     from attendance where session_id = '${sessionId}' and student_id = '${studentId}'`,
  );
}

/** Straight out of `v_student_hours` (constitution item 3 -- never
 * re-derive the metric formula in the spec itself). */
function studentHours(studentId: string): number {
  const rows = readRows<{ confirmed_hours: number }>(
    `select confirmed_hours from v_student_hours
     where student_id = '${studentId}' and season_id = '${SEED.activeSeason}'`,
  );
  return rows[0]?.confirmed_hours ?? 0;
}

/** §2e -- derived in Chicago, never from `toISOString()`. Computed fresh at
 * run time so the spec keeps working across the Chicago-midnight rollover
 * rather than assuming "today" is a fixed calendar date. */
function chicagoToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Chicago' }).format(new Date());
}

/** What the Date combobox's `fill()` accepts. `chicagoToday()` is already
 * zero-padded `YYYY-MM-DD` (the `en-CA` locale's default shape). */
function usDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-');
  return `${m}/${d}/${y}`;
}

/** Byte-identical to `OutreachDetail.tsx`'s/`RsvpControl.tsx`'s own
 * independently-reimplemented `formatSessionDateOnly` -- both format
 * `{weekday:'short', month:'short', day:'numeric'}` in America/Chicago off a
 * noon-UTC-anchored `Date` (avoids the DST edge the two source files' own
 * module docs call out). Reproduced here rather than imported: neither file
 * is in this task's Allowed Files. */
function chicagoWeekdayDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const noon = new Date(Date.UTC(year, month - 1, day, 12));
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'America/Chicago',
  }).format(noon);
}

/** §3 "Switching personas" -- required and not in the harness.
 * `personaHarness.ts` is NOT in this task's Allowed Files, so this is
 * inlined here rather than added there. A bare `signIn` while already
 * authenticated redirects `/login` -> `/` and then hangs to the 90s
 * timeout; clearing storage first is what makes the login form reappear. */
async function switchPersona(page: Page, persona: keyof typeof PERSONAS): Promise<void> {
  await page.context().clearCookies();
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await signIn(page, persona);
}

test.describe('GAM343 outreach lifecycle', () => {
  // AC 9 -- re-runnable without a reseed. Cleanup touches only rows this
  // file's own title prefix created, in FK-safe order (round 1's "cascade
  // from the events row" plan raises 23503: both `rsvps_session_id_fkey`
  // and `attendance_session_id_fkey` are ON DELETE RESTRICT).
  test.beforeEach(() => {
    execAdmin(`delete from attendance where session_id in (
      select id from event_sessions where event_id in (
        select id from events where title like '${TITLE_PREFIX}%'))`);
    execAdmin(`delete from rsvps where session_id in (
      select id from event_sessions where event_id in (
        select id from events where title like '${TITLE_PREFIX}%'))`);
    execAdmin(`delete from events where title like '${TITLE_PREFIX}%'`);
  });

  test('create -> RSVP -> attend -> complete -> hours land', async ({ page }) => {
    const today = chicagoToday();
    const sessionDateLabel = chicagoWeekdayDate(today);

    // =========================================================================
    // Step 1 -- coach creates the outreach event.
    // =========================================================================
    await signIn(page, 'coach');
    await page.goto('/outreach');
    await expect(page.getByRole('heading', { name: 'Outreach', exact: true })).toBeVisible({
      timeout: 20_000,
    });
    // Strict-mode hazard 1 -- "New outreach event" renders twice on an empty
    // list. The seed's own fixture is real data, so wait for it before
    // clicking, rather than trusting the transient empty state.
    await expect(page.getByText('Library STEM Night').first()).toBeVisible({ timeout: 20_000 });

    await page.getByRole('button', { name: 'New outreach event' }).click();
    const createDialog = page.getByRole('dialog').filter({ hasText: 'Basics' }).first();
    await createDialog.waitFor();

    await createDialog.getByLabel(/^Title/).fill(EVENT_TITLE);

    // CAVEAT 1 -- CLICK the date combobox BEFORE filling. The calendar
    // popover opens on pointer, not on `fill()`; without the opening click
    // there is no calendar layer, so the later Escape falls through and
    // destroys the form dialog instead of just closing the calendar.
    const dateField = createDialog.getByRole('combobox', { name: /^Date/ });
    await dateField.click();
    await dateField.fill(usDate(today));
    await page.keyboard.press('Enter');
    // Round 1's Escape guidance was backwards -- Escape here is REQUIRED,
    // not forbidden. The calendar popover is its own `role=dialog` layer;
    // without this Escape, the Team scope click below lands on the
    // calendar's footer instead (a pointer-event-intercepting overlay), and
    // the scope is silently never narrowed.
    await page.keyboard.press('Escape');
    await expect(createDialog).toBeVisible();

    // §2e -- start late in the Chicago day so `RsvpControl` (now <
    // starts_at) and "Mark day complete" (date >= session_date) are both
    // true on the same session, for as much of the day as possible.
    await createDialog.getByLabel(/^Start time/).fill('11:59 PM');
    await createDialog.getByLabel(/^End time/).fill('11:59 PM');

    // Team scope: all three teams start selected. Both Priya and Jordan are
    // on Volt Robotics 9911, so narrowing to it alone (by deselecting Volt
    // Junior 4402) still leaves both reachable in Expected attendees.
    const teamScope = createDialog.getByRole('combobox', { name: 'Team scope' });
    await teamScope.click();
    await page.getByRole('option', { name: 'Volt Junior 4402' }).click();
    await page.keyboard.press('Escape');
    await expect(teamScope).toHaveText('Volt Robotics 9911');

    // BLOCKER 2 (gate-measured) -- leave Priya UNCHECKED here. Checking her
    // in this dialog would pre-write her `rsvps` row as coach-authored
    // `going` before she ever acts, making both AC 2 and AC 3 unfalsifiable
    // (her own click would be a no-op against an already-`going` control).
    await createDialog.getByRole('checkbox', { name: JORDAN_NAME }).check();

    await capture(page, '70-coach-outreach-create-filled');

    const submit = createDialog.locator('button', { hasText: /^Create event — \d+ session/ });
    const submitLabel = (await submit.innerText()).trim();
    const promisedSessionCount = Number(/— (\d+) session/.exec(submitLabel)?.[1] ?? '0');
    expect(promisedSessionCount).toBeGreaterThan(0);
    await submit.click();

    await expect.poll(() => eventsTitled(EVENT_TITLE).length, { timeout: 20_000 }).toBe(1);
    const [event] = eventsTitled(EVENT_TITLE);
    const eventId = event.id;
    // The submit label promised a session count; the database has to agree.
    const sessions = sessionsFor(eventId);
    expect(sessions).toHaveLength(promisedSessionCount);
    expect(sessions[0].session_date).toBe(today);
    const sessionId = sessions[0].id;
    // Scope narrowed in the dropdown is the scope stored on the row.
    expect(event.team_ids).toEqual([SEED.teamFrc]);

    // Free bonus assertion documented in the packet §4 step 1 -- Jordan's
    // row exists already, coach-authored, proving the
    // `computeExpectedAttendeeRsvpPlan` fan-out (§2a: "the checklist wins",
    // T119/PRD v2 D-7).
    const jordanFanoutRows = rsvpsFor(sessionId, SEED.studentJordan);
    expect(jordanFanoutRows).toHaveLength(1);
    expect(jordanFanoutRows[0].status).toBe('going');
    expect(jordanFanoutRows[0].responded_by).toBe(PERSONAS.coach.profileId);
    // Priya was left unchecked -- no fan-out row for her at all.
    expect(rsvpsFor(sessionId, SEED.studentPriya)).toHaveLength(0);

    await page.goto(`/outreach/${eventId}`);
    await expect(page.getByText(EVENT_TITLE).first()).toBeVisible({ timeout: 20_000 });
    await capture(page, '71-coach-outreach-created');

    // =========================================================================
    // Step 2 -- student answers (AC 1 & AC 3): Sign up.
    // =========================================================================
    await switchPersona(page, 'student');
    await page.goto(`/outreach/${eventId}`);
    await expect(page.getByText(EVENT_TITLE).first()).toBeVisible({ timeout: 20_000 });

    const rsvpGroup = page.getByRole('radiogroup', {
      name: `Your RSVP for ${EVENT_TITLE} on ${sessionDateLabel}`,
    });
    await expect(rsvpGroup).toBeVisible({ timeout: 20_000 });
    await rsvpGroup.getByRole('radio', { name: 'Sign up' }).click();

    // AC 2's mutation detector: drop the upsert in `makeSubmitRsvpChange`
    // and this length assertion never reaches 1 -- it stays 0 until the
    // poll times out.
    await expect
      .poll(() => rsvpsFor(sessionId, SEED.studentPriya).length, { timeout: 20_000 })
      .toBe(1);
    let priyaRsvp = rsvpsFor(sessionId, SEED.studentPriya)[0];
    expect(priyaRsvp.status).toBe('going');
    // AC 3 -- written as the student herself, not the coach who fanned out
    // Jordan's row above. AC 3's mutation (send the coach's id as
    // `respondedBy` while acting as the student) also goes red on THIS
    // assertion's containing poll: the RLS `with check (responded_by =
    // auth.uid())` denies the INSERT outright (42501), so the row never
    // appears and the poll above times out at 0, not 1.
    expect(priyaRsvp.responded_by).toBe(PERSONAS.student.profileId);
    const goingUpdatedAt = priyaRsvp.updated_at;

    await capture(page, '72-student-outreach-signup');

    // =========================================================================
    // Step 3 -- student changes the answer (AC 4): Can't go.
    // =========================================================================
    await rsvpGroup.getByRole('radio', { name: "Can't go" }).click();

    // AC 4's mutation detector: switch the upsert to a plain `.insert()` and
    // the UNIQUE (session_id, student_id) constraint rejects the second
    // write with 23505 -- the row COUNT stays 1 either way (BLOCKER 6), so
    // the real detector is that `status` never reaches 'declined'.
    await expect
      .poll(() => rsvpsFor(sessionId, SEED.studentPriya)[0]?.status, { timeout: 20_000 })
      .toBe('declined');
    const declinedRows = rsvpsFor(sessionId, SEED.studentPriya);
    // Going then Can't go leaves ONE row with the later status, not two.
    expect(declinedRows).toHaveLength(1);
    expect(new Date(declinedRows[0].updated_at).getTime()).toBeGreaterThan(
      new Date(goingUpdatedAt).getTime(),
    );

    await capture(page, '73-student-outreach-cant-go');

    // =========================================================================
    // Step 4 -- coach records attendance directly on the page
    // (`AttendancePanel`, not the dialog). This gives step 5's uncheck a
    // recorded row to change (§2c/T309: an uncheck of a never-recorded
    // student is a legitimate no-op, not a bug).
    // =========================================================================
    await switchPersona(page, 'coach');
    await page.goto(`/outreach/${eventId}`);
    await expect(page.getByRole('heading', { name: 'Attendance', level: 2 })).toBeVisible({
      timeout: 20_000,
    });

    // The dialog is not open yet, so hazard 2's page-vs-dialog name collision
    // does not apply here -- these are unscoped page-level locators.
    const priyaPageCheckbox = page.getByRole('checkbox', { name: PERSONAS.student.displayName });
    const jordanPageCheckbox = page.getByRole('checkbox', { name: JORDAN_NAME });
    await expect(priyaPageCheckbox).toBeVisible({ timeout: 20_000 });

    await priyaPageCheckbox.check();
    await jordanPageCheckbox.check();

    // AC 1's "a saved record edited afterwards" needs a row that already
    // exists before step 5 touches it -- wait for the real writes, not the
    // optimistic UI state.
    await expect
      .poll(() => attendanceFor(sessionId, SEED.studentPriya).length, { timeout: 20_000 })
      .toBe(1);
    await expect
      .poll(() => attendanceFor(sessionId, SEED.studentJordan).length, { timeout: 20_000 })
      .toBe(1);
    expect(attendanceFor(sessionId, SEED.studentPriya)[0].status).toBe('present');
    expect(attendanceFor(sessionId, SEED.studentJordan)[0].status).toBe('present');
    const jordanAttendanceRowIdAfterStep4 = attendanceFor(sessionId, SEED.studentJordan)[0].id;

    // CAVEAT 2's remedy also applies here, one step early: give Jordan a
    // real, non-zero hours value now so step 6's delta(Jordan) == 0 detects
    // the AC 5 "absent" write actually firing, rather than being an
    // arithmetic tautology that would pass whether or not the write
    // happened (a checked, zero-duration session already writes
    // `hours_override: null`).
    await page.getByLabel(new RegExp(`^${JORDAN_NAME} hours`)).fill('1.5');
    await page.getByLabel(new RegExp(`^${JORDAN_NAME} hours`)).blur();
    await expect
      .poll(() => attendanceFor(sessionId, SEED.studentJordan)[0]?.hours_override, {
        timeout: 20_000,
      })
      .toBe(1.5);

    await capture(page, '74-coach-attendance-panel-checked');

    // Snapshot hours BEFORE completion (AC 6). While the session is still
    // 'scheduled', `v_student_hours` inner-joins `es.status = 'completed'`,
    // so this session contributes nothing to either total yet -- which is
    // what makes the after-snapshot's delta attributable to step 5's write
    // alone.
    const priyaHoursBefore = studentHours(SEED.studentPriya);
    const jordanHoursBefore = studentHours(SEED.studentJordan);

    // =========================================================================
    // Step 5 -- coach completes the day, unchecking Jordan, in ONE dialog
    // pass (BLOCKER 1: the trigger disappears once the session is
    // 'completed' -- there is no second pass to uncheck in).
    // =========================================================================
    const trigger = page.getByRole('button', { name: new RegExp(`^Mark day complete — `) });
    await expect(trigger).toBeVisible({ timeout: 20_000 });
    await trigger.click();

    // Hazard 2 (mandatory) -- scope every subsequent interaction to the
    // dialog. Its checklist and hours fields collide byte-for-byte with
    // `AttendancePanel`'s own controls for the same students.
    const dlg = page.getByRole('dialog');
    await dlg.waitFor();

    // CAVEAT 3 (binding) -- wait for the SETTLED arrival state with
    // auto-retrying `toBeChecked()` on BOTH students before touching
    // anything. The checklist seeds from a transient RSVP-derived state
    // before `loadAttendance` resolves (Priya declined -> false, Jordan
    // coach-authored going -> true), then settles to the real
    // attendance-derived state (both true). `handleCheckedStudentIdsChange`
    // latches `hasCoachTouchedChecklistRef` on first edit, so an edit made
    // during the transient window freezes the checklist at the wrong seed
    // forever and silently inverts AC 5/AC 6.
    await expect(dlg.getByRole('checkbox', { name: PERSONAS.student.displayName })).toBeChecked();
    await expect(dlg.getByRole('checkbox', { name: JORDAN_NAME })).toBeChecked();

    await capture(page, '75-coach-mark-day-complete-arrival');

    // AC 5 -- uncheck Jordan. His already-recorded 'present' row is what
    // makes the uncheck a real DB-changing write (§2c) rather than the
    // legitimate no-op an unrecorded student's uncheck would be.
    await dlg.getByRole('checkbox', { name: JORDAN_NAME }).uncheck();

    // CAVEAT 2 -- an explicit per-student hours override, or AC 6 passes
    // with the entire attendance write path deleted (the zero-duration
    // 11:59 PM session makes the unoverridden default `hours_override:
    // null`, and the confirm label + view delta would both read 0 either
    // way).
    await dlg.getByLabel(new RegExp(`^${PERSONAS.student.displayName} hours`)).fill('2.5');
    await dlg.getByLabel(new RegExp(`^${PERSONAS.student.displayName} hours`)).blur();

    await dlg.getByLabel(/^People reached/).fill('12');

    const confirm = dlg.locator('button', { hasText: /^Mark complete — / });
    const confirmLabelText = (await confirm.innerText()).trim();
    const hoursMatch = /· ([\d.]+) h$/.exec(confirmLabelText);
    expect(hoursMatch).not.toBeNull();
    const promisedHours = Number(hoursMatch?.[1] ?? 'NaN');
    // Only Priya remains checked, with her explicit 2.5h override.
    expect(promisedHours).toBeCloseTo(2.5, 6);

    await capture(page, '76-coach-mark-day-complete-filled');
    await confirm.click();

    await expect(page.getByRole('dialog')).toHaveCount(0, { timeout: 20_000 });

    // AC 5's mutation detector: make `buildAttendanceAbsenceRows` return `[]`
    // and this poll never reaches 'absent' -- Jordan's row stays 'present'
    // (from step 4) forever, and the poll times out.
    await expect
      .poll(() => attendanceFor(sessionId, SEED.studentJordan)[0]?.status, { timeout: 20_000 })
      .toBe('absent');
    const jordanRowAfterStep5 = attendanceFor(sessionId, SEED.studentJordan)[0];
    // AC 1 -- this is the "at least one saved record edited afterwards":
    // same row id as step 4 (an UPDATE via the (session_id, student_id)
    // upsert target, not a fresh insert), status changed present -> absent.
    expect(jordanRowAfterStep5.id).toBe(jordanAttendanceRowIdAfterStep4);

    const priyaRowAfterStep5 = attendanceFor(sessionId, SEED.studentPriya)[0];
    expect(priyaRowAfterStep5.status).toBe('present');
    expect(priyaRowAfterStep5.method).toBe('coach');
    expect(priyaRowAfterStep5.recorded_by).toBe(PERSONAS.coach.profileId);
    expect(priyaRowAfterStep5.hours_override).toBeCloseTo(2.5, 6);

    const completedSession = sessionsFor(eventId)[0];
    expect(completedSession.status).toBe('completed');
    expect(completedSession.people_reached).toBe(12);

    await capture(page, '77-coach-mark-day-complete-confirmed');

    // =========================================================================
    // Step 6 -- hours land. Before/after delta against `v_student_hours`,
    // never a re-derivation of MET-03's formula (constitution item 3 / PRD
    // DATA-01). "Priya > 0" alone would be VACUOUS: she already carries
    // ~4.0 seed hours from an unrelated completed session, so a bare
    // positivity check would pass even with the entire write path deleted.
    // =========================================================================
    const priyaHoursAfter = studentHours(SEED.studentPriya);
    const jordanHoursAfter = studentHours(SEED.studentJordan);

    // The confirm label (formatHours, rounded to 1dp) and the view
    // (unrounded numeric sum) are independent witnesses that can disagree in
    // the last few bits of a float -- hence the tolerance, not exact
    // equality (gate-measured: label "2.5" vs a view delta that can land at
    // e.g. 2.4999999999999996 once subtracted against the seed's own
    // floating hours).
    expect(priyaHoursAfter - priyaHoursBefore).toBeCloseTo(promisedHours, 6);
    // Jordan is 'absent' and contributes nothing, DESPITE carrying a real
    // non-zero `hours_override` (1.5, set in step 4) -- proving the delta
    // reflects `status`, not just whether an override happened to be unset.
    expect(jordanHoursAfter - jordanHoursBefore).toBeCloseTo(0, 6);
  });
});
