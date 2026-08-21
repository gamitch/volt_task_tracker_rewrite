/**
 * GAM-455: the coach dashboard's "Hours by team" and "Top events by student
 * hours" rows printed the raw float straight from `v_team_hours`/
 * `v_event_student_hours` with no rounding step -- confirmed against the real
 * seed, `v_team_hours.confirmed_hours` and `v_event_student_hours.total_hours`
 * both come back as `3.9999991469444444`. Watched here in a real browser, not
 * asserted from source.
 */
import { expect, test } from 'playwright/test';
import { readRows, signIn, capture } from './personaHarness';

test('coach dashboard rounds Hours-by-team and Top-events labels instead of printing the raw view float', async ({
  page,
}) => {
  const [{ confirmed_hours: teamHours }] = readRows<{ confirmed_hours: string }>(
    'select confirmed_hours::text from v_team_hours limit 1',
  );
  const [{ total_hours: eventHours }] = readRows<{ total_hours: string }>(
    'select total_hours::text from v_event_student_hours limit 1',
  );
  // Both views hand back the same raw-float shape this bug renders verbatim --
  // confirm the fixture still reproduces it before trusting the UI assertion.
  expect(teamHours).toMatch(/^3\.9+\d*$/);
  expect(eventHours).toMatch(/^3\.9+\d*$/);

  await signIn(page, 'coach');
  await page.goto('/');

  const hoursByTeam = page.getByRole('group', { name: 'Hours by team' });
  await expect(hoursByTeam).toBeVisible({ timeout: 20_000 });
  const topEvents = page.getByRole('group', { name: 'Top events by student hours' });
  await expect(topEvents).toBeVisible({ timeout: 20_000 });
  await capture(page, '60-coach-dashboard-hours-rounding');

  expect(await hoursByTeam.textContent()).not.toContain(teamHours);
  expect(await hoursByTeam.textContent()).toContain('4h');
  expect(await topEvents.textContent()).not.toContain(eventHours);
  expect(await topEvents.textContent()).toContain('4h');
});
