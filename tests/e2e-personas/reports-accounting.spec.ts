/**
 * GAM-345 — W4 hours and goal accounting: do the same student's numbers agree
 * on every screen that shows them?
 *
 * This is a MEASUREMENT spec. It changes nothing in `src/` and fixes nothing.
 * Where a screen is wrong, the assertion below pins the WRONG behaviour on
 * purpose so the suite stays green and the defect stays visible — every such
 * place says so, names the mechanism by `file:line`, and states what to change
 * when it is fixed (the `e2e-personas` skill's "record behaviour, do not bless
 * it" rule). Findings are filed as data in
 * `docs/swarm/inbox/claude-gam-345-e2e-w4-hours-accounting-findings.json`.
 *
 * ---------------------------------------------------------------------------
 * What is and is not an independent witness here
 *
 * `readRows` goes straight to Postgres as the superuser. It is the ONLY
 * independent witness in this file, and every screen figure below is compared
 * against it.
 *
 * The three "hours" surfaces are NOT independent of each other:
 *
 *   - Reports → Hours tab: `v_student_hours.select('student_id, season_id,
 *     confirmed_hours').eq('season_id', …)` — `loaders/reports.ts:424-428`
 *   - CoachHome leaderboard: the byte-identical query —
 *     `loaders/leaderboard.ts:137-142`
 *   - StudentHome: `v_student_goal_projection`, which is
 *     `coalesce(sh.confirmed_hours, 0)` over the same view —
 *     `20260723000001_dashboard_views.sql:328-332`
 *
 * So a cross-SCREEN value agreement between those three could not fail, and
 * this spec does not pretend to make that comparison. What it asserts is
 * database → each screen (which can fail, and is what the mutation proofs
 * redden) plus the FORMATTING divergence the three renderers really do have.
 *
 * The staff KPI strip carries no per-student figure at all, so the honest
 * comparison there is the season rollup against the sum of the per-team
 * breakdown printed directly beneath it (`loaders/kpi.ts:175`, `:188`).
 *
 * ---------------------------------------------------------------------------
 * Fixtures
 *
 * `tests/e2e-harness/seed.sql` contains neither of the two cases this spec is
 * about — there is no all-excused student and no genuine 0% student. Both are
 * built here rather than in the shared seed, so the fixture other specs rely on
 * stays exactly as it is. `v_student_participation` (met01:102-130) joins
 * `student_teams`, not `students.team_id`, so BOTH must be set and must
 * intersect the event's `team_ids` — set only one and the view returns no row
 * at all, which silently turns the all-excused case into the no-marks case.
 */
import { expect, test, type Page } from 'playwright/test';
import { PERSONAS, PERSONA_PASSWORD, SEED, capture, execAdmin, readRows, signIn } from './personaHarness';

// ---------------------------------------------------------------------------
// Fixtures this spec owns. Named `E2E …` so `admin-roster.spec.ts:30-34`'s
// existing cleanup pattern covers them too — one pattern, not two (item 3).
// ---------------------------------------------------------------------------

interface SpecStudent {
  readonly id: string;
  readonly profileId: string;
  readonly email: string;
  readonly name: string;
}

/** Every mark excused → the view HAS a row and `participation_pct` is NULL. */
const ALL_EXCUSED: SpecStudent = {
  id: '57000000-0000-4000-8000-00000000a001',
  profileId: 'a0000000-0000-4000-8000-00000000a001',
  email: 'e2e-excused@volt.test',
  name: 'E2E Marisol Vantree',
};

/** Marks exist, none excused, none present → a genuine `0.0`, not a no-rate. */
const GENUINE_ZERO: SpecStudent = {
  id: '57000000-0000-4000-8000-00000000a002',
  profileId: 'a0000000-0000-4000-8000-00000000a002',
  email: 'e2e-zero@volt.test',
  name: 'E2E Bram Ostlund',
};

/**
 * The three COMPLETED sessions of `Weeknight Build Session`
 * (`counts_participation = true`, `team_ids = [FRC]`). Marks must land on
 * completed, participation-counting sessions or the view ignores them.
 * That event has `counts_volunteer_hours = false`, so neither student gains a
 * `v_student_hours` row — deliberate: the hours surfaces stay as seeded.
 */
const COMPLETED_MEETING_SESSIONS = [
  '5e550000-0000-4000-8000-000000000001',
  '5e550000-0000-4000-8000-000000000002',
  '5e550000-0000-4000-8000-000000000003',
] as const;

function cleanUpSpecStudents(): void {
  // FK order: `attendance.student_id` is ON DELETE RESTRICT, so the marks go
  // first. Leaving them behind would also break `admin-roster.spec.ts`'s own
  // `delete from students where display_name like 'E2E %'` on the next run.
  execAdmin(`delete from attendance where student_id in (select id from students where display_name like 'E2E %')`);
  execAdmin(`delete from rsvps where student_id in (select id from students where display_name like 'E2E %')`);
  execAdmin(`delete from student_teams where student_id in (select id from students where display_name like 'E2E %')`);
  execAdmin(`delete from students where display_name like 'E2E %'`);
  // Signing in creates rows the spec never asked for: `calendar_feeds` and
  // `notification_prefs` are provisioned per profile on first load, and both
  // reference `profiles` ON DELETE RESTRICT. Discovered by watching this
  // cleanup fail with 23503 on the second `beforeEach`.
  execAdmin(`delete from calendar_feeds where profile_id in (select id from profiles where email like 'e2e-%@volt.test')`);
  execAdmin(`delete from notification_prefs where profile_id in (select id from profiles where email like 'e2e-%@volt.test')`);
  execAdmin(`delete from audit_log where actor in (select id from profiles where email like 'e2e-%@volt.test')`);
  execAdmin(`delete from profiles where email like 'e2e-%@volt.test'`);
  execAdmin(`delete from auth.users where email like 'e2e-%@volt.test'`);
}

/**
 * Seed one student with a real login and one attendance `status` on each of
 * the three completed build sessions.
 *
 * `students.profile_id` is optional for the metric view, but AC2/AC3 read
 * StudentHome and `/meetings`, which need a real sign-in — hence `auth.users`
 * (harness SHA-256 password column, `seed.sql:40-45`) plus a `profiles` row.
 */
function seedSpecStudent(student: SpecStudent, status: 'excused' | 'absent'): void {
  execAdmin(
    `insert into auth.users (id, email, email_confirmed_at, last_sign_in_at, raw_user_meta_data, harness_password)
     values ('${student.profileId}', '${student.email}', now() - interval '30 days', null, '{}'::jsonb,
             encode(sha256('${PERSONA_PASSWORD}'::bytea), 'hex'))`,
  );
  execAdmin(
    `insert into profiles (id, display_name, email, role, theme_mode)
     values ('${student.profileId}', '${student.name}', '${student.email}', 'student', 'system')`,
  );
  execAdmin(
    `insert into students (id, profile_id, display_name, team_id, grad_year, is_active, goal_hours_override)
     values ('${student.id}', '${student.profileId}', '${student.name}', '${SEED.teamFrc}', 2028, true, null)`,
  );
  // met01:109/:114 — the view joins `student_teams` and compares
  // `st.team_id = any(e.team_ids)`. `students.team_id` alone yields ZERO rows.
  execAdmin(
    `insert into student_teams (student_id, team_id, joined_on, left_on)
     values ('${student.id}', '${SEED.teamFrc}', current_date - 80, null)`,
  );
  const sessionList = COMPLETED_MEETING_SESSIONS.map((id) => `'${id}'`).join(', ');
  execAdmin(
    `insert into attendance (session_id, student_id, status, check_in_at, check_out_at, method, recorded_by)
     select s.id, '${student.id}', '${status}', null, null, 'coach', '${PERSONAS.coach.profileId}'
     from event_sessions s where s.id in (${sessionList})`,
  );
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

interface ParticipationViewRow {
  expected_ct: number;
  present_ct: number;
  excused_ct: number;
  participation_pct: number | null;
}

function participationRows(studentId: string): ParticipationViewRow[] {
  return readRows<ParticipationViewRow>(
    `select expected_ct, present_ct, excused_ct, participation_pct
     from v_student_participation
     where student_id = '${studentId}' and season_id = '${SEED.activeSeason}'`,
  );
}

function confirmedHoursOf(studentId: string): number {
  const rows = readRows<{ confirmed_hours: number }>(
    `select confirmed_hours from v_student_hours
     where student_id = '${studentId}' and season_id = '${SEED.activeSeason}'`,
  );
  expect(rows).toHaveLength(1);
  return Number(rows[0].confirmed_hours);
}

/**
 * Drop the persisted session so the NEXT sign-in reaches the real login form.
 *
 * These tests deliberately read one screen as staff and another as the student
 * it is about, in one test, because that is the comparison the task is for. But
 * `LoginPage.tsx:168-172` navigates straight off `/login` whenever a resolved
 * user is already present, so a second `signIn` in the same context would hang
 * on a form that is never rendered. Clearing web storage is the smallest thing
 * that restores the anonymous state the harness's `signIn` assumes.
 */
async function signOutInBrowser(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
}

/** `signIn` only knows the four fixed personas; these students are ours. */
async function signInAsEmail(page: Page, email: string): Promise<void> {
  await signOutInBrowser(page);
  await page.goto('/login');
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(PERSONA_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 20_000 }).not.toBe('/login');
}

/**
 * The reports tabs are NOT `role=tab`. Astryx `Tab` renders
 * `<button type="button" … aria-current="page">` inside `<nav aria-label="Tabs">`
 * — `getByRole('tab')` counts 0 on this page.
 */
async function openReportsTab(page: Page, label: 'Participation' | 'Hours' | 'Events'): Promise<void> {
  await page.getByRole('button', { name: label, exact: true }).click();
}

/** The `<tr>` carrying this student, in whichever report table is on screen. */
function rowFor(page: Page, studentName: string) {
  return page.getByRole('row').filter({ hasText: studentName }).first();
}

/**
 * Both report tabs render ONE `<table>` PER TEAM (`ParticipationTab.tsx:1011`,
 * `HoursTab.tsx:1272`), so every column header exists twice on this page and an
 * unscoped `getByRole('columnheader')` is a strict-mode violation. Scope to the
 * table carrying the student under test.
 */
function tableWith(page: Page, studentName: string) {
  return page.getByRole('table').filter({ hasText: studentName }).first();
}

test.beforeEach(() => {
  cleanUpSpecStudents();
  seedSpecStudent(ALL_EXCUSED, 'excused');
  seedSpecStudent(GENUINE_ZERO, 'absent');
});

// Seeded students move `v_season_kpi_team_counts.active_students_count` and
// carry attendance rows that block `admin-roster.spec.ts`'s student delete.
// The suite must be re-runnable without a reseed, so they go at the end too.
test.afterAll(() => {
  cleanUpSpecStudents();
});

// ---------------------------------------------------------------------------
// AC1 — the run interacts, it does not just load.
// ---------------------------------------------------------------------------

test.describe('RPT-01 reports shell', () => {
  test('a coach moves between all three tabs and drives the Participation filter and sort', async ({
    page,
  }) => {
    await signIn(page, 'coach');
    await page.goto('/reports');

    // Participation is the default tab. Wait for REAL rows: every list on this
    // app renders an empty-state card while its query is in flight.
    await expect(rowFor(page, 'Priya Raman')).toBeVisible({ timeout: 20_000 });
    await expect(
      tableWith(page, 'Priya Raman').getByRole('columnheader', { name: 'Participation %' }),
    ).toBeVisible();
    await capture(page, '70-coach-reports-participation');

    await openReportsTab(page, 'Hours');
    await expect(rowFor(page, 'Priya Raman')).toBeVisible({ timeout: 20_000 });
    await expect(
      tableWith(page, 'Priya Raman').getByRole('columnheader', { name: 'Confirmed hrs' }),
    ).toBeVisible();
    await capture(page, '71-coach-reports-hours');

    await openReportsTab(page, 'Events');
    await expect(page.getByText('Weeknight Build Session').first()).toBeVisible({ timeout: 20_000 });
    await capture(page, '72-coach-reports-events');

    await openReportsTab(page, 'Participation');
    await expect(rowFor(page, 'Priya Raman')).toBeVisible({ timeout: 20_000 });

    // --- the filter. `Below 70%` is a real filter, not a decoration:
    // `isBelowThreshold` (ParticipationTab.tsx:613) excludes `null` on purpose,
    // so the all-excused student must NOT survive it while the genuine 0% must.
    const namesBefore = await page.getByRole('row').allInnerTexts();
    expect(namesBefore.join('\n')).toContain(ALL_EXCUSED.name);

    await page.getByRole('button', { name: 'Below 70%' }).click();
    await expect(rowFor(page, 'Priya Raman')).toHaveCount(0);
    await expect(rowFor(page, GENUINE_ZERO.name)).toBeVisible();
    // 66.7% — below the threshold, so Jordan stays.
    await expect(rowFor(page, 'Jordan Okafor')).toBeVisible();
    // NULL is not "below" anything. This is the distinction the whole task is
    // about, seen through a filter rather than a cell.
    await expect(rowFor(page, ALL_EXCUSED.name)).toHaveCount(0);
    await capture(page, '73-coach-reports-participation-below-70');

    await page.getByRole('button', { name: 'Below 70%' }).click();
    await expect(rowFor(page, 'Priya Raman')).toBeVisible();

    // --- the sort. Sorting by Participation % must reorder the FRC table.
    await page.getByRole('radio', { name: 'Participation %' }).click();
    const ascending = await frcStudentOrder(page);
    await page.getByRole('button', { name: 'Sort descending' }).click();
    const descending = await frcStudentOrder(page);

    expect(ascending.length).toBeGreaterThan(3);
    expect(descending).not.toEqual(ascending);
    // Deliberately NOT `toEqual([...ascending].reverse())`: Priya and Sam are
    // both on 100.0, `compareParticipationRows` returns 0 for that pair, and
    // `Array.prototype.sort` is stable — so a tie keeps its incoming order in
    // BOTH directions and a strict reversal is not what the code promises.
    //
    // `compareParticipationRows` (ParticipationTab.tsx:632) places a NULL
    // participation with the `-1` sentinel, so the all-excused student sorts
    // BELOW a genuine 0.0 — which is exactly the ordering the three-state
    // distinction implies, and the ends of the list are unambiguous.
    expect(ascending[0]).toBe(ALL_EXCUSED.name);
    expect(ascending[1]).toBe(GENUINE_ZERO.name);
    expect(descending[descending.length - 1]).toBe(ALL_EXCUSED.name);
    expect(descending[descending.length - 2]).toBe(GENUINE_ZERO.name);
    await capture(page, '74-coach-reports-participation-sorted');
  });
});

/** Student names, in render order, from the FRC group's own table. */
async function frcStudentOrder(page: Page): Promise<string[]> {
  const rows = await tableWith(page, 'Priya Raman').getByRole('row').allInnerTexts();
  return rows
    .map((text) => text.split('\t')[0].split('\n')[0].trim())
    .filter((name) => name !== '' && name !== 'Student');
}

// ---------------------------------------------------------------------------
// AC2 + AC6 — one student's hours, read from every surface that shows them,
// compared against the database with a stated tolerance.
// ---------------------------------------------------------------------------

test.describe('RPT-03 hours accounting', () => {
  test("Priya's confirmed hours agree with the database on every surface that renders them", async ({
    page,
  }) => {
    // THE WITNESS. `v_student_hours` computes hours from `now()`-relative
    // timestamps through `extract(epoch …)/3600.0`
    // (20260717000003_metric_views.sql:7-14), so this is a non-terminating
    // float — 3.999999…-shaped, never exactly 4.
    const dbHours = confirmedHoursOf(SEED.studentPriya);
    expect(dbHours).toBeCloseTo(4, 3);
    // AC6: no screen carries the underlying value, so the comparison has to be
    // a tolerance, and it has to be tight enough that a wrong VALUE cannot hide
    // behind a formatting change. 1e-3 is ~2 seconds of volunteer time.
    expect(dbHours).not.toBe(4);
    expect(Math.abs(dbHours - 4)).toBeLessThan(1e-3);

    // --- surface 1: reports → Hours tab. `HoursTab.tsx:1017` renders
    // `{value.toFixed(1)}` — one decimal, always.
    await signIn(page, 'coach');
    await page.goto('/reports');
    await openReportsTab(page, 'Hours');
    const hoursRow = rowFor(page, 'Priya Raman');
    await expect(hoursRow).toBeVisible({ timeout: 20_000 });
    await expect(
      tableWith(page, 'Priya Raman').getByRole('columnheader', { name: 'Confirmed hrs' }),
    ).toBeVisible();
    const hoursTabConfirmed = (await hoursRow.getByRole('cell').nth(1).innerText()).trim();
    expect(hoursTabConfirmed).toBe(dbHours.toFixed(1));
    expect(hoursTabConfirmed).toBe('4.0');
    await capture(page, '75-coach-reports-hours-priya');

    // --- the KPI strip. It carries no per-student figure, so the honest check
    // is the season rollup against the sum of the per-team breakdown printed
    // beneath it: `v_season_kpis.active_students_count` (kpi.ts:175) vs the sum
    // of `v_season_kpi_team_counts.active_students_count` (kpi.ts:188).
    const [seasonKpi] = readRows<{ active_students_count: number }>(
      `select active_students_count from v_season_kpis where season_id = '${SEED.activeSeason}'`,
    );
    const teamCounts = readRows<{ team_name: string; active_students_count: number }>(
      `select team_name, active_students_count from v_season_kpi_team_counts order by team_sort_order`,
    );
    const teamSum = teamCounts.reduce((sum, row) => sum + Number(row.active_students_count), 0);
    // `v_season_kpi_team_counts` counts DISTINCT `student_teams` rows per team
    // (20260723000000_kpi_views.sql:247-259) while `v_season_kpis` counts
    // students (`:207`), so a dual-team student would be counted twice below
    // and once above. Every student this spec seeds is single-team, and the
    // shared seed has no dual-team student either, so on this fixture the two
    // must agree exactly. If this ever goes red on a fixture that grows a
    // dual-team member, the strip — not this assertion — is what is wrong.
    expect(teamSum).toBe(Number(seasonKpi.active_students_count));

    // And the same comparison as a user meets it: the strip prints the season
    // headline and its own per-team breakdown one line apart
    // (`KpiStrip.tsx:291-293`, `formatTeamBreakdown` at `:398-403`), so the two
    // can be read against each other without leaving the screen.
    const activeTile = page
      .getByRole('heading', { name: 'Active students', exact: true })
      .locator('..');
    await expect(activeTile).toBeVisible({ timeout: 20_000 });
    const tileLines = (await activeTile.innerText())
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line !== '');
    expect(tileLines[0]).toBe('Active students');
    const headlineCount = Number(tileLines[1]);
    expect(headlineCount).toBe(Number(seasonKpi.active_students_count));
    // "Volt Robotics 9911 5 · Volt Junior 4402 2" — the count is the trailing
    // integer of each segment (the team NAMES contain digits too).
    const breakdownCounts = tileLines[2]
      .split('·')
      .map((segment) => Number(/(\d+)\s*$/.exec(segment.trim())?.[1] ?? NaN));
    expect(breakdownCounts).toHaveLength(teamCounts.length);
    expect(breakdownCounts.reduce((sum, n) => sum + n, 0)).toBe(headlineCount);

    // --- surface 2: the CoachHome leaderboard. Same `v_student_hours` read as
    // the Hours tab (`leaderboard.ts:137-142`), so this is NOT an independent
    // value witness — the divergence it can show is FORMATTING.
    await page.goto('/');
    // Season privacy is on in the seed, so `formatDisplayName` renders
    // "Priya R." — the raw display name is deliberately never in this DOM.
    const leaderboardEntry = page.getByRole('listitem').filter({ hasText: 'Priya R.' }).first();
    await expect(leaderboardEntry).toBeVisible({ timeout: 20_000 });
    const leaderboardText = (await leaderboardEntry.innerText()).trim();
    await capture(page, '76-coach-home-leaderboard');

    // --- surface 3: StudentHome, through `v_student_goal_projection`, which is
    // `coalesce(sh.confirmed_hours, 0)` over the same view.
    await signOutInBrowser(page);
    await signIn(page, 'student');
    const goalBar = page.getByText(/ h \(/).first();
    await expect(goalBar).toBeVisible({ timeout: 20_000 });
    const studentHomeText = (await goalBar.innerText()).trim();
    await capture(page, '77-student-home-hours');

    // --- database → every screen, at a stated tolerance.
    const parseFirstNumber = (text: string): number => {
      const match = /(\d+(?:\.\d+)?)/.exec(text);
      expect(match, `no number in ${JSON.stringify(text)}`).not.toBeNull();
      return Number(match![1]);
    };
    expect(parseFirstNumber(hoursTabConfirmed)).toBeCloseTo(dbHours, 3);
    expect(parseFirstNumber(leaderboardText.replace(/^\d+\.\s*/, ''))).toBeCloseTo(dbHours, 3);
    expect(parseFirstNumber(studentHomeText)).toBeCloseTo(dbHours, 3);

    // --- the formatting divergence, recorded rather than blessed.
    // Hours tab:      `{value.toFixed(1)}`            -> "4.0"
    // Leaderboard:    `${roundForDisplay(h)} hrs`     -> "4 hrs"  (roundForDisplay
    //                 returns a NUMBER, Leaderboard.tsx:314-316, so `4` interpolates
    //                 as "4", never "4.0")
    // StudentHome:    `${value.toFixed(1)} / ${max.toFixed(1)} h (…%)` -> "4.0 / 100.0 h"
    // Three renderers, one number, three spellings. This is a NIT-grade
    // divergence filed in the findings JSON, not a defect this spec fixes —
    // if the leaderboard is ever changed to one decimal, update the literal
    // below to '4.0 hrs' rather than deleting the assertion.
    expect(leaderboardText).toContain('4 hrs');
    expect(leaderboardText).not.toContain('4.0 hrs');
    expect(hoursTabConfirmed).toBe('4.0');
    expect(studentHomeText).toContain('4.0 / 100.0 h');
    // The raw float reaches no screen at all — which is the point of AC6's
    // tolerance and why an equality assertion here would be the wrong test.
    expect(hoursTabConfirmed).not.toContain(String(dbHours));
    expect(leaderboardText).not.toContain(String(dbHours));
    expect(studentHomeText).not.toContain(String(dbHours));
  });
});

// ---------------------------------------------------------------------------
// AC3 — all-excused reads as NO RATE, not zero. Two screens get this right;
// `/meetings` does not, and this spec pins the wrong behaviour deliberately.
// ---------------------------------------------------------------------------

test.describe('MET-01 an all-excused student has no participation rate', () => {
  test('the database says NULL, and each screen says so in its own way', async ({ page }) => {
    // BEFORE any screen: prove the fixture really is the all-excused case and
    // not the no-marks case. A student with no `student_teams` row has NO row
    // here at all, which would make every assertion below pass for the wrong
    // reason.
    const rows = participationRows(ALL_EXCUSED.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].expected_ct).toBe(3);
    expect(rows[0].excused_ct).toBe(3);
    expect(rows[0].present_ct).toBe(0);
    expect(rows[0].participation_pct).toBeNull();

    // --- leg 1: the Participation tab. `ParticipationTab.tsx:838-839` runtime
    // `=== null` check → em dash. This em dash is a GENUINE database NULL: an
    // all-excused student takes the metric-driven branch (`:571,573-587`), not
    // the synthesised all-null row at `:589-602` that no-view-row students get.
    await signIn(page, 'coach');
    await page.goto('/reports');
    const tabRow = rowFor(page, ALL_EXCUSED.name);
    await expect(tabRow).toBeVisible({ timeout: 20_000 });
    // Counts are shown, so "Marked 3 / Excused 3, rate —" is legible as a
    // no-rate rather than as missing data (met01:99's D014 mitigation).
    await expect(tabRow.getByRole('cell').nth(1)).toHaveText('3');
    await expect(tabRow.getByRole('cell').nth(4)).toHaveText('3');
    await expect(tabRow.getByRole('cell').nth(5)).toHaveText('—');
    // A ProgressBar here would BE the fabricated 0% the em dash exists to
    // avoid, so its absence is the real assertion.
    await expect(tabRow.getByRole('progressbar')).toHaveCount(0);
    await capture(page, '78-coach-reports-all-excused');

    // --- leg 2: StudentHome. `loaders/students.ts:839-840` returns `null` when
    // the denominator is 0, and `StudentHome.tsx:1649` renders `—` for it.
    await signInAsEmail(page, ALL_EXCUSED.email);
    await expect(page.getByRole('heading', { name: `Hi ${ALL_EXCUSED.name}` })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText('Participation: —')).toBeVisible();
    await expect(page.getByText(/Participation: 0(\.0)?%/)).toHaveCount(0);
    await capture(page, '79-student-home-all-excused');

    // --- leg 3: /meetings. THIS ASSERTION PINS A DEFECT ON PURPOSE.
    //
    // Expected-by-a-user:  "—" or "no rate yet", the same as the other two.
    // Actually rendered:   an accessible name of "Participation: null%" over a
    //                      ProgressBar that reads 0%.
    //
    // Mechanism. NOTE: the loader on this path is `checkin.ts`, NOT
    // `meetings.ts`. `MeetingsList.tsx:2769` renders
    // `<StudentMeetingView variant="own" studentId={…} />` with no `loadStripData`,
    // so the default at `StudentMeetingView.tsx:1068` wins:
    // `loadConsistencyStripData` from `loaders/checkin.ts` (imported as
    // `loadConsistencyStripDataFromSupabase` at `StudentMeetingView.tsx:317`).
    // `meetings.ts`'s own `aggregateParticipationRows` feeds a DIFFERENT
    // consumer (`meetings.ts:949`'s `loadStudentMeetingsData`). Established by
    // mutation: changing `meetings.ts:519` left this assertion GREEN; changing
    // `checkin.ts:363-365` turned it red.
    //
    //   1. `loaders/checkin.ts:239` declares `participation_pct: number` for a
    //      column `v_student_participation` returns as SQL NULL (met01:123-128).
    //   2. `aggregateParticipationForStudent` (`checkin.ts:363-365`) returns the
    //      single row VERBATIM, so the `Math.max(expectedCt - excusedCt, 1)`
    //      floor at `checkin.ts:375` — GAM-300's floor — is never reached here.
    //   3. `checkin.ts:291` renames it to `participationPct` unchanged.
    //   4. `StudentMeetingView.tsx:757` interpolates it:
    //      label={`Participation: ${participation.participationPct}%`}
    //   5. `ProgressBar value={null}` clamps to 0 and renders "0%".
    //
    // `loaders/meetings.ts:302` and `loaders/reports.ts:221` carry the IDENTICAL
    // type lie. The Participation tab escapes the symptom only because
    // `ParticipationTab.tsx:838` does a runtime `=== null` check. One mistyped
    // column, three loaders, one guard.
    //
    // WHEN THIS IS FIXED — widen `participation_pct` to `number | null` in
    // `checkin.ts:239` (and, for the same reason, `meetings.ts:302` and
    // `reports.ts:221`) and give `StudentMeetingView.tsx:757` the same
    // `=== null` branch `ParticipationTab.tsx:838` already has — change the two
    // assertions below to the em-dash form:
    //     await expect(page.getByText('—')).toBeVisible();
    //     await expect(page.getByRole('progressbar', { name: /null/ })).toHaveCount(0);
    // Do not delete them; the defect must not be able to come back silently.
    await page.goto('/meetings');
    const defectiveBar = page.getByRole('progressbar', { name: 'Participation: null%' });
    await expect(defectiveBar).toBeVisible({ timeout: 20_000 });
    // The bar does not merely mislabel — it announces a real 0 to assistive
    // technology for a student who has no rate at all.
    await expect(defectiveBar).toHaveAttribute('aria-valuenow', '0');
    await expect(defectiveBar).toHaveAttribute('aria-valuetext', '0%');
    await capture(page, '80-student-meetings-participation-null');
  });
});

// ---------------------------------------------------------------------------
// AC4 — a genuine zero still reads as zero. The mirror image of AC3: if a
// no-rate must never render as 0%, a real 0% must never render as a no-rate.
// ---------------------------------------------------------------------------

test.describe('MET-01 a genuine zero is not a no-rate', () => {
  test('marks with nothing present read 0.0 in the database and 0% on the screens', async ({ page }) => {
    const rows = participationRows(GENUINE_ZERO.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].expected_ct).toBe(3);
    expect(rows[0].excused_ct).toBe(0);
    expect(rows[0].present_ct).toBe(0);
    expect(Number(rows[0].participation_pct)).toBe(0);

    // --- Participation tab: a real ProgressBar at 0%, NOT an em dash.
    await signIn(page, 'coach');
    await page.goto('/reports');
    const tabRow = rowFor(page, GENUINE_ZERO.name);
    await expect(tabRow).toBeVisible({ timeout: 20_000 });
    await expect(tabRow.getByRole('cell').nth(1)).toHaveText('3');
    await expect(tabRow.getByRole('cell').nth(4)).toHaveText('0');
    const zeroBar = tabRow.getByRole('progressbar');
    await expect(zeroBar).toHaveCount(1);
    await expect(zeroBar).toHaveAccessibleName(new RegExp(`${GENUINE_ZERO.name} participation: 0(\\.0)?%`));
    await expect(tabRow).not.toContainText('—');
    await capture(page, '81-coach-reports-genuine-zero');

    // --- StudentHome: `Participation: 0%`, and specifically not the em dash
    // `loaders/students.ts:840` produces for a zero DENOMINATOR. Zero present
    // out of three marked is a rate; zero marks is not.
    await signInAsEmail(page, GENUINE_ZERO.email);
    await expect(page.getByRole('heading', { name: `Hi ${GENUINE_ZERO.name}` })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/Participation: 0(\.0)?%/)).toBeVisible();
    await expect(page.getByText('Participation: —')).toHaveCount(0);
    await capture(page, '82-student-home-genuine-zero');
  });
});

// ---------------------------------------------------------------------------
// AC5′ — the CSV builders RPT-05/06 shipped are unreachable from any user path.
// ---------------------------------------------------------------------------

test.describe('RPT-05/06 CSV export', () => {
  test('no export, download or CSV control exists on any reports tab', async ({ page }, testInfo) => {
    await signIn(page, 'coach');
    await page.goto('/reports');
    await expect(rowFor(page, 'Priya Raman')).toBeVisible({ timeout: 20_000 });

    const perTab: Record<string, string[]> = {};
    for (const tab of ['Participation', 'Hours', 'Events'] as const) {
      await openReportsTab(page, tab);
      await page.waitForTimeout(1000);
      const labels = (await page.getByRole('button').allInnerTexts())
        .map((text) => text.replace(/\s+/g, ' ').trim())
        .filter((text) => text !== '');
      perTab[tab] = labels;
      for (const label of labels) {
        expect(label, `unexpected export-shaped control on the ${tab} tab`).not.toMatch(
          /export|download|csv|\.csv/i,
        );
      }
      // Nor is there a link that would download one.
      const links = await page.getByRole('link').allInnerTexts();
      for (const link of links) {
        expect(link).not.toMatch(/export|download|csv/i);
      }
    }
    // The enumerated control list is the evidence for the finding, so it is
    // attached to the report rather than only asserted on.
    await testInfo.attach('reports-tab-controls', {
      body: JSON.stringify(perTab, null, 2),
      contentType: 'application/json',
    });
    await capture(page, '83-coach-reports-no-export-control');
  });
});
