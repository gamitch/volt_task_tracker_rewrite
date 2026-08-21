/**
 * GAM-438: presentation-only restructure of the coach dashboard. Confirms
 * the restructured layout renders correctly against the real production
 * bundle in a real browser -- the risk unit tests (jsdom, no real CSS) can't
 * see.
 *
 * The admin-only "Season setup" card's *other* branch (teams.length === 0)
 * is deliberately NOT exercised here: `hasGoalsConfigured` is hardcoded
 * `true` by the real loader (`coachHome.ts:420`, schema-guaranteed via
 * `default_goal_hours not null`), so the only way to reach "missing setup"
 * live is `teams.length === 0` -- and `students.team_id` is
 * `not null references teams (id) on delete restrict`
 * (`20260716000000_identity_roster.sql:63`), so emptying `teams` in this
 * seed would require deleting/restoring students, guardian_links and
 * student_teams too, all FK-chained through it. That gate is instead
 * covered by `CoachHome.test.tsx`'s own `HOME-04` describe block plus a
 * mutation replay (deleting the `user.role === 'admin' &&` condition turns
 * those exact tests red) -- recorded in the GAM-438 run log, not repeated
 * here against real seed data this harness cannot safely reshape.
 */
import { expect, test } from 'playwright/test';
import { capture, signIn } from './personaHarness';

test.describe('GAM-438 coach dashboard restructure', () => {
  test('coach: full-width goal panel with milestones, 8-tile secondary grid, no Season setup card', async ({
    page,
  }) => {
    await signIn(page, 'coach');
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Coach dashboard', exact: true })).toBeVisible();

    const goalHeading = page.getByRole('heading', { name: 'Hours vs. team goal' });
    await expect(goalHeading).toBeVisible();
    // Milestone badges/text (BEH-01) live in the same card as the goal heading.
    const goalPanel = page.locator('.astryx-card', { has: goalHeading });
    await expect(goalPanel.getByText('25%', { exact: true })).toBeVisible();
    await expect(goalPanel.getByText('50%', { exact: true })).toBeVisible();

    // The secondary grid: "Last meeting attendance"/"Events in next 7 days"
    // (moved in) plus the six dashboard-analytics tiles, 8 total once loaded.
    await expect(page.getByRole('heading', { name: 'Last meeting attendance' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Events in next 7 days' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Attendance rate' })).toBeVisible();

    await expect(page.getByText('Season setup', { exact: true })).toHaveCount(0);
    await capture(page, '438-coach-dashboard');
  });
});
