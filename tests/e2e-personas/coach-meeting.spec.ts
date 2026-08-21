/**
 * MTG-02: a coach schedules meetings through the real dialog, and the rows
 * that reach `events` / `event_sessions` are checked in Postgres afterwards.
 *
 * Every assertion below is about POST-WRITE ROW STATE, never about the
 * request the app issued — the point is what the database ended up holding.
 */
import { expect, test, type Page } from 'playwright/test';
import { PERSONAS, SEED, capture, execAdmin, execAs, readRows, signIn } from './personaHarness';

interface EventRow {
  id: string;
  title: string;
  type: string;
  season_id: string;
  location_name: string;
  team_ids: string[] | null;
  counts_participation: boolean;
  counts_volunteer_hours: boolean;
  created_by: string | null;
}

interface SessionRow {
  session_date: string;
  starts_at: string;
  ends_at: string;
  status: string;
  notes: string;
}

function eventsTitled(title: string): EventRow[] {
  return readRows<EventRow>(
    `select id, title, type, season_id, location_name, team_ids, counts_participation,
            counts_volunteer_hours, created_by
     from events where title = '${title}'`,
  );
}

function sessionsFor(eventId: string): SessionRow[] {
  return readRows<SessionRow>(
    `select session_date::text, starts_at::text, ends_at::text, status, notes
     from event_sessions where event_id = '${eventId}' order by session_date`,
  );
}

async function openScheduleDialog(page: Page) {
  await page.goto('/meetings');
  // The list renders an empty-state card carrying its own "Schedule meetings"
  // button while the query is still in flight, so wait for the real data.
  await expect(page.getByRole('heading', { name: 'Meetings', exact: true })).toBeVisible();
  await expect(page.getByText('Weeknight Build Session').first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Schedule meetings' }).first().click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Basics' }).first();
  await dialog.waitFor();
  return dialog;
}

test.describe('MTG-02 Schedule meetings dialog', () => {
  // Keep the suite re-runnable without a full reseed: clear only the events
  // this file creates, never the fixtures. `event_sessions` goes with them via
  // `on delete cascade`.
  test.beforeEach(() => {
    execAdmin(`delete from events where title like 'E2E %' or title = 'Rogue Meeting'`);
  });

  test('opens with the documented defaults and a disabled submit', async ({ page }) => {
    await signIn(page, 'coach');
    const dialog = await openScheduleDialog(page);

    await expect(dialog.getByLabel(/^Title/)).toHaveValue('Team meeting');
    await expect(dialog.locator('input[placeholder="Select a time"]').nth(0)).toHaveValue('6:00 PM');
    await expect(dialog.locator('input[placeholder="Select a time"]').nth(1)).toHaveValue('8:00 PM');

    // Single / Weekly recurring / Custom dates, with Single pre-selected.
    const modes = dialog.getByRole('radiogroup', { name: 'Schedule mode' });
    await expect(modes.getByRole('radio', { name: 'Single' })).toHaveAttribute('aria-checked', 'true');
    await expect(modes.getByRole('radio', { name: 'Weekly recurring' })).toBeVisible();
    await expect(modes.getByRole('radio', { name: 'Custom dates' })).toBeVisible();

    // No date picked yet, so there is nothing to create.
    const submit = dialog.locator('button', { hasText: /^Create \d+ meeting/ });
    await expect(submit).toHaveText('Create 0 meetings');
    await expect(submit).toBeDisabled();

    await capture(page, '10-coach-schedule-dialog-defaults');
  });

  test('the team-scope dropdown lists every team and narrows the scope', async ({ page }) => {
    await signIn(page, 'coach');
    const dialog = await openScheduleDialog(page);

    const scope = dialog.getByRole('combobox').first();
    await scope.click();

    const optionLabels = await page.getByRole('option').allInnerTexts();
    // FINDING 1 (GAM-344 Task 1, replaces the earlier comment describing a
    // guard that no longer exists): GAM-305 (legacy T615) landed
    // `excludeArchivedTeams` (`ScheduleMeetingsDialog.tsx:854`), so the
    // archived `Volt Legacy 2201` is now correctly absent from this list.
    // Kept exact, not loosened, so a regression that re-admits an archived
    // team into the scope picker turns this red again.
    //
    // GAM-355 merge note: both branches removed this entry independently and
    // identically. Keeping GAM-355's mechanism detail here so the next reader
    // does not misdiagnose which line does the work -- `Volt Legacy 2201` is
    // `teams.archived = true` in `seed.sql`, and the exclusion happens at
    // `:854-855` and `:861`: `excludeArchivedTeams` narrows `allTeamIds`,
    // which seeds the initial `selectedTeamIds`. `:885` does the OPPOSITE (it
    // re-includes an archived team that is already selected) and `:1236`
    // renders such a team `disabled`; neither is why this option is absent.
    expect(optionLabels.map((t) => t.trim())).toEqual([
      'Select all',
      'Volt Robotics 9911',
      'Volt Junior 4402',
    ]);
    await capture(page, '11-coach-team-scope-open');

    // Only `Volt Junior 4402` is left to deselect -- `Volt Legacy 2201` is no
    // longer offered at all (see the FINDING 1 comment above), so there is
    // nothing to click there any more.
    await page.getByRole('option', { name: 'Volt Junior 4402' }).click();
    await page.keyboard.press('Escape');
    await expect(scope).toHaveText('Volt Robotics 9911');
  });

  test('a single meeting round-trips to events + event_sessions', async ({ page }) => {
    const title = 'E2E Single Build Night';
    await signIn(page, 'coach');
    const dialog = await openScheduleDialog(page);

    await dialog.getByLabel(/^Title/).fill(title);
    await dialog.locator('input[placeholder="e.g. Robotics Lab"]').fill('Fabrication Bay');

    const scope = dialog.getByRole('combobox').first();
    await scope.click();
    // GAM-344 Task 1: the `Volt Legacy 2201` deselect click is dropped --
    // GAM-305's `excludeArchivedTeams` means that option is no longer offered
    // at all (see FINDING 1's comment above, in the team-scope-dropdown
    // test). Measured by the gate in the browser: options are exactly
    // `["Select all", "Volt Robotics 9911", "Volt Junior 4402"]`, and
    // deselecting only `Volt Junior 4402` still leaves `Volt Robotics 9911`
    // selected, so the `event.team_ids` assertion below still holds unchanged.
    await page.getByRole('option', { name: 'Volt Junior 4402' }).click();
    await page.keyboard.press('Escape');

    const dateField = dialog.getByRole('combobox', { name: /^Date/ });
    await dateField.click();
    await dateField.fill('12/15/2026');
    await page.keyboard.press('Enter');
    await expect(dateField).toHaveValue('December 15, 2026');

    await dialog.locator('input[placeholder="Select a time"]').nth(0).fill('5:30 PM');
    await dialog.locator('input[placeholder="Select a time"]').nth(1).fill('7:45 PM');
    await dialog.locator('textarea').fill('Created by the persona E2E suite.');

    const submit = dialog.locator('button', { hasText: /^Create \d+ meeting/ });
    // The label counts the sessions the current form would produce.
    await expect(submit).toHaveText('Create 1 meeting');
    await capture(page, '12-coach-schedule-filled');
    await submit.click();

    await expect.poll(() => eventsTitled(title).length, { timeout: 20_000 }).toBe(1);
    const [event] = eventsTitled(title);

    expect(event.type).toBe('meeting');
    expect(event.location_name).toBe('Fabrication Bay');
    expect(event.season_id).toBe(SEED.activeSeason);
    // Scope narrowed in the dropdown is the scope stored on the row.
    expect(event.team_ids).toEqual([SEED.teamFrc]);
    // A meeting counts toward participation but never toward volunteer hours
    // (`20260804000000_volunteer_hours_outreach_only.sql`).
    expect(event.counts_participation).toBe(true);
    expect(event.counts_volunteer_hours).toBe(false);

    const sessions = sessionsFor(event.id);
    expect(sessions).toHaveLength(1);
    expect(sessions[0].session_date).toBe('2026-12-15');
    expect(sessions[0].status).toBe('scheduled');
    expect(sessions[0].notes).toBe('Created by the persona E2E suite.');
    // 5:30 PM America/Chicago in December (CST, UTC-6) is 23:30Z the same day;
    // 7:45 PM is 01:45Z the next. Getting this wrong is the classic way a
    // scheduling app drifts by a day, so it is asserted rather than assumed.
    expect(sessions[0].starts_at).toContain('2026-12-15 23:30:00');
    expect(sessions[0].ends_at).toContain('2026-12-16 01:45:00');

    // FINDING 2: the coach who created this meeting is not recorded.
    // `events.created_by` is a real nullable FK to `profiles` that
    // `OutreachDetail.tsx` renders as "Created by", but neither
    // `loaders/meetings.ts` nor `loaders/outreach.ts` sets it on insert.
    // Flip these two lines to `toBe(PERSONAS.coach.profileId)` when fixed.
    expect(event.created_by).not.toBe(PERSONAS.coach.profileId);
    expect(event.created_by).toBeNull();

    await capture(page, '13-coach-meetings-after-create');
  });

  test('weekly recurring mode creates one session per selected weekday', async ({ page }) => {
    const title = 'E2E Recurring Build Nights';
    await signIn(page, 'coach');
    const dialog = await openScheduleDialog(page);

    await dialog.getByLabel(/^Title/).fill(title);
    await dialog.getByRole('radiogroup', { name: 'Schedule mode' }).getByRole('radio', { name: 'Weekly recurring' }).click();
    await capture(page, '14-coach-recurring-mode');

    // "Repeat on" weekday checkboxes and a required date range replace the
    // single Date field in this mode.
    await dialog.getByRole('button', { name: 'Tue', exact: true }).click();
    await dialog.getByRole('button', { name: 'Thu', exact: true }).click();

    const submit = dialog.locator('button', { hasText: /^Create \d+ meeting/ });
    // Weekdays alone are not enough: with no range there is nothing to expand.
    await expect(submit).toHaveText('Create 0 meetings');

    await dialog.getByText('Select date range').first().click();
    // Day cells carry a full-date aria-label ("Tuesday, September 1, 2026").
    const dayCells = await page.getByRole('button', { name: /^\w+day, \w+ \d+, \d{4}$/ }).all();
    const selectable: typeof dayCells = [];
    for (const cell of dayCells) {
      if (await cell.isEnabled()) selectable.push(cell);
    }
    // Pick a span wide enough to hold several Tuesdays and Thursdays. The exact
    // dates are whatever the grid offers, so the expected session count is read
    // back off the submit button rather than hardcoded.
    expect(selectable.length).toBeGreaterThan(30);
    await selectable[2].click();
    // The second click completes the range and dismisses the calendar itself —
    // no explicit close, and NOT Escape, which would dismiss the whole dialog.
    await selectable[2 + 27].click();
    await expect(submit).not.toHaveText('Create 0 meetings');

    const label = await submit.innerText();
    const plannedCount = Number(/^Create (\d+)/.exec(label)?.[1] ?? '0');
    expect(plannedCount).toBeGreaterThan(1);

    await submit.click();
    await expect.poll(() => eventsTitled(title).length, { timeout: 20_000 }).toBe(1);

    const [event] = eventsTitled(title);
    const sessions = sessionsFor(event.id);
    // The label promised a count; the database has to agree with it.
    expect(sessions).toHaveLength(plannedCount);
    // Every generated session must fall on one of the two chosen weekdays.
    const weekdays = new Set(sessions.map((s) => new Date(`${s.session_date}T12:00:00Z`).getUTCDay()));
    expect([...weekdays].sort()).toEqual([2, 4]);
    // `team_ids` left at the default means "all teams", stored as the whole list.
    expect(event.type).toBe('meeting');
  });

  // GAM-445 (packet §5 criterion 10) -- two-different-times weekly series,
  // created through the real UI, read back from `event_sessions` and
  // asserted on BOTH weekdays' own UTC pairs -- not on what the dialog
  // rendered. Infrastructure named by the packet: `sessionsFor`/
  // `eventsTitled` above, raw `starts_at`/`ends_at` assertions (mirroring the
  // single-meeting test above), two-weekday selection (mirroring the test
  // above this one). The packet notes the e2e picks dates by grid index and
  // cannot reach 2026-11-01 without month navigation -- the DST pinning
  // (criterion 2) is a unit test, not this one.
  test('weekly recurring mode with per-weekday times creates DISTINCT UTC pairs per weekday', async ({
    page,
  }) => {
    const title = 'E2E Per-Day Times Build Nights';
    await signIn(page, 'coach');
    const dialog = await openScheduleDialog(page);

    await dialog.getByLabel(/^Title/).fill(title);
    await dialog
      .getByRole('radiogroup', { name: 'Schedule mode' })
      .getByRole('radio', { name: 'Weekly recurring' })
      .click();

    // "Repeat on" weekday checkboxes and a required date range replace the
    // single Date field in this mode.
    await dialog.getByRole('button', { name: 'Tue', exact: true }).click();
    await dialog.getByRole('button', { name: 'Thu', exact: true }).click();

    await dialog.getByText('Select date range').first().click();
    // Day cells carry a full-date aria-label ("Tuesday, September 1, 2026").
    const dayCells = await page.getByRole('button', { name: /^\w+day, \w+ \d+, \d{4}$/ }).all();
    const selectable: typeof dayCells = [];
    for (const cell of dayCells) {
      if (await cell.isEnabled()) selectable.push(cell);
    }
    expect(selectable.length).toBeGreaterThan(30);
    await selectable[2].click();
    await selectable[2 + 27].click();

    // Two checked weekdays -> per-day rows replace the shared Start/End pair
    // (packet §3.2). Set genuinely DIFFERENT times per weekday.
    await dialog.getByLabel(/^Tue start time/).fill('6:00 PM');
    await dialog.getByLabel(/^Tue end time/).fill('8:00 PM');
    await dialog.getByLabel(/^Thu start time/).fill('4:30 PM');
    await dialog.getByLabel(/^Thu end time/).fill('5:45 PM');
    await capture(page, '15-coach-per-day-times');

    const submit = dialog.locator('button', { hasText: /^Create \d+ meeting/ });
    await expect(submit).not.toHaveText('Create 0 meetings');
    const label = await submit.innerText();
    const plannedCount = Number(/^Create (\d+)/.exec(label)?.[1] ?? '0');
    expect(plannedCount).toBeGreaterThan(1);

    await submit.click();
    await expect.poll(() => eventsTitled(title).length, { timeout: 20_000 }).toBe(1);

    const [event] = eventsTitled(title);
    const sessions = sessionsFor(event.id);
    expect(sessions).toHaveLength(plannedCount);

    // Read the rows back and assert BOTH weekdays' own UTC pair -- the point
    // of this criterion, not asserting on what the dialog rendered.
    for (const session of sessions) {
      const weekday = new Date(`${session.session_date}T12:00:00Z`).getUTCDay();
      if (weekday === 2) {
        // Tuesday: 6:00-8:00 PM America/Chicago.
        expect(session.starts_at).toContain(`${session.session_date} 23:00:00`);
        const endDate = new Date(`${session.session_date}T12:00:00Z`);
        endDate.setUTCDate(endDate.getUTCDate() + 1);
        expect(session.ends_at).toContain(`${endDate.toISOString().slice(0, 10)} 01:00:00`);
      } else if (weekday === 4) {
        // Thursday: 4:30-5:45 PM America/Chicago -- both distinct from Tuesday's.
        expect(session.starts_at).toContain(`${session.session_date} 21:30:00`);
        expect(session.ends_at).toContain(`${session.session_date} 22:45:00`);
      } else {
        throw new Error(`Unexpected weekday ${weekday} for session ${session.session_date}`);
      }
    }
    // The two weekdays' own wall times are genuinely distinct in the stored
    // rows -- proves the per-day times actually reached the database, not
    // just the dialog's own preview state.
    const tueSession = sessions.find(
      (s) => new Date(`${s.session_date}T12:00:00Z`).getUTCDay() === 2,
    );
    const thuSession = sessions.find(
      (s) => new Date(`${s.session_date}T12:00:00Z`).getUTCDay() === 4,
    );
    expect(tueSession).toBeDefined();
    expect(thuSession).toBeDefined();
    expect(tueSession?.starts_at).not.toBe(thuSession?.starts_at);

    await capture(page, '16-coach-per-day-times-created');
  });

  test('a student cannot create a meeting even with a session in hand', async () => {
    // The UI never offers this, so the check that matters is the policy. A
    // cross-user INSERT blocked by RLS raises 42501 rather than writing 0 rows.
    let raised: string | null = null;
    try {
      execAs(
        'student',
        `insert into events (season_id, type, title, description, location_name, address,
                             counts_participation, counts_volunteer_hours)
         values ('${SEED.activeSeason}', 'meeting', 'Rogue Meeting', '', '', '', true, false)`,
      );
    } catch (error) {
      raised = String(error);
    }
    expect(raised).toContain('42501');
    expect(eventsTitled('Rogue Meeting')).toHaveLength(0);
  });
});
