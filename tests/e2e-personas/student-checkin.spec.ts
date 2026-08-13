/**
 * GAM-342: a student arrives and gets counted -- the check-in journey from
 * the student's side.
 *
 * Two tiers are in play here (see `.claude/skills/e2e-personas/SKILL.md`):
 *
 * - Self-checkoff (`SelfCheckoffDialog`) writes `attendance` straight through
 *   PostgREST -- Tier 1, fully covered here through the real UI (AC 4).
 * - QR / short-code redemption goes through the `checkin` Edge Function
 *   (`supabase/functions/checkin/`) -- HMAC token validation, rate limiting,
 *   session liveness and team scope. Deno does not run in this harness, so
 *   none of that is proven here (AC 5). `tests/e2e-harness/server.mjs:475-492`
 *   is a shallow stand-in that mints a rotating QR token and has no branch
 *   that accepts a short code and writes `attendance` -- a green suite below
 *   must not be read as QR coverage.
 */
import { expect, test } from 'playwright/test';
import { PERSONAS, SEED, capture, execAdmin, execAs, readRows, signIn } from './personaHarness';

/** Library STEM Night's second session -- `scheduled` (2026-08-23) in the
 * unmodified seed, which buckets it as Upcoming (`allowSelfCheckoff=false`).
 * Flipping it to `completed` is the one-line arrangement packet §4b measured
 * as sufficient to reach `SelfCheckoffDialog` for real. */
const STEM_NIGHT_SESSION = '5e550000-0000-4000-8000-000000000008';

/** Session `5e550000-…-0005`, per packet §9: Priya has no row there, and a
 * self row there leaves `v_student_hours` unchanged -- the session choice for
 * the RLS policy proof (§6b.3b). Do NOT reuse `…-0006` (23505, Priya already
 * has a coach row there) or `…-0004` (the coach-console fixture). */
const RLS_PROOF_SESSION = '5e550000-0000-4000-8000-000000000005';

interface SelfAttendanceRow {
  status: string;
  method: string;
  recorded_by: string | null;
}

function selfRowsFor(sessionId: string): SelfAttendanceRow[] {
  return readRows<SelfAttendanceRow>(
    `select status, method, recorded_by from attendance
     where session_id = '${sessionId}' and student_id = '${SEED.studentPriya}' and method = 'self'`,
  );
}

// File-level backstop (packet §6c, defence 3 of 3). `student-parent.spec.ts`
// runs after this file in path order and asserts, at :48-64, ZERO
// `method='self'` rows for Priya with NO session predicate; and at :66/:74-78
// it reads `…-0008` back in the "Sign-up opportunities" list expecting
// `scheduled`. This backstop does NOT run on a hard crash or timeout kill,
// which is exactly why the per-describe `beforeEach` and the per-test
// `try/finally` below also exist -- all three are required, not redundant.
test.afterAll(() => {
  execAdmin(`delete from attendance where student_id = '${SEED.studentPriya}' and method = 'self'`);
  execAdmin(`update event_sessions set status = 'scheduled' where id = '${STEM_NIGHT_SESSION}'`);
});

test.describe('the /checkin picker (T400 -- no scannable credential in the URL)', () => {
  test('lands on the designed error card and offers the one open session, corroborated against the database', async ({
    page,
  }) => {
    await signIn(page, 'student');
    await page.goto('/checkin');

    // `CheckinResult.tsx`'s code field and open-sessions picker render INSIDE
    // the `error` state branch (`:809` onward) -- landing on `/checkin` with
    // no `?t=`/`?code=` in the URL shows "Couldn't check you in" BY DESIGN,
    // not as a bug. That card is where the journey continues. The Banner's
    // title and description are both plain text children, not its accessible
    // name (measured: `alert: Couldn't check you in This check-in link is
    // missing information. …`), so this filters an unnamed `alert` by text
    // rather than by `name`.
    const errorCard = page.getByRole('alert').filter({ hasText: "Couldn't check you in" });
    await expect(errorCard).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();

    // Corroborate the offered session against the database rather than
    // trusting the button's own label: it must be exactly the session
    // `loadOpenCheckinSessions` (`checkin.ts:578-608`) finds open right now.
    const openNow = readRows<{ session_id: string; title: string }>(
      `select es.id as session_id, e.title
       from event_sessions es
       join events e on e.id = es.event_id
       where es.status = 'scheduled'
         and es.ends_at >= now() - interval '2 hours'
         and es.starts_at <= now() + interval '2 hours'
       order by es.starts_at`,
    );
    expect(openNow.map((row) => row.title)).toContain('Weeknight Build Session');
    expect(openNow.find((row) => row.title === 'Weeknight Build Session')?.session_id).toBe(
      SEED.liveSession,
    );

    const sessionButton = page.getByRole('button', { name: 'Weeknight Build Session' });
    await expect(sessionButton).toBeVisible({ timeout: 20_000 });
    await capture(page, '30-student-checkin-picker');

    await sessionButton.click();

    // T321's manual short-code form only renders once a session id is known
    // -- picking the session supplies it.
    const codeField = page.getByRole('textbox', { name: 'Check-in code' });
    await expect(codeField).toBeVisible({ timeout: 20_000 });
    await expect(codeField).toHaveAttribute('placeholder', 'ABC234');
    await expect(page.getByRole('button', { name: 'Check in with code' })).toBeVisible();
    await capture(page, '31-student-checkin-code-form');
  });
});

test.describe('the code-submit boundary -- the harness has no redemption branch', () => {
  test('submitting a code white-screens on the stand-in response and writes no attendance row', async ({
    page,
  }) => {
    // This overlaps `student-parent.spec.ts:48-64` only in that both submit a
    // bad code through a form -- that test drives `StudentHome`'s OWN field
    // (which does not crash on this response) and only checks the DB
    // afterwards. The new ground here is the `/checkin` PICKER path, and the
    // measured outcome is different: a crash, not a quiet rejection.
    const pageErrors: Error[] = [];
    page.on('pageerror', (error) => pageErrors.push(error));

    await signIn(page, 'student');
    await page.goto('/checkin');
    await page.getByRole('button', { name: 'Weeknight Build Session' }).click();

    const codeField = page.getByRole('textbox', { name: 'Check-in code' });
    await expect(codeField).toBeVisible({ timeout: 20_000 });
    await codeField.fill('ABC234');

    // Scoped to `method='qr'` specifically -- the only method a real
    // redemption of this credential could ever produce -- rather than to
    // "any row for this session", because `coach-checkin.spec.ts` runs
    // before this file in the full suite and legitimately leaves a
    // coach-attributed row on `SEED.liveSession` for Priya. That row is not
    // this test's concern; it must stay exactly as it was.
    const beforeQr = readRows(
      `select 1 from attendance where student_id = '${SEED.studentPriya}' and method = 'qr'`,
    );

    await page.getByRole('button', { name: 'Check in with code' }).click();

    // NOT a production bug report -- label this plainly. The harness's
    // `checkin` stand-in (`server.mjs:475-492`) has no branch that accepts a
    // short code; it mints a rotating QR token instead and returns 200. That
    // is a harness-shaped input a deployed `checkin` Edge Function would not
    // produce for a code POST. `CheckinResult.tsx:343` casts that response
    // `as CheckinResponsePayload` without validating it, and `:773`/`:792`
    // then dereference `state.attendance.check_in_at`, which does not exist
    // on a token payload -- `TypeError: Cannot read properties of undefined
    // (reading 'check_in_at')`, with no error boundary to catch it. Filed as
    // finding `checkin/unvalidated-200-payload-white-screens-result-page`.
    await expect
      .poll(() => pageErrors.some((error) => error.message.includes("reading 'check_in_at'")), {
        timeout: 10_000,
      })
      .toBe(true);
    await expect(page.locator('body')).toHaveText('');

    // The point that actually matters for this journey: no `method='qr'`
    // attendance row was invented for a code the harness cannot redeem.
    const afterQr = readRows(
      `select 1 from attendance where student_id = '${SEED.studentPriya}' and method = 'qr'`,
    );
    expect(afterQr).toEqual(beforeQr);
    expect(afterQr).toHaveLength(0);
  });
});

test.describe('student self-checkoff through the real UI (AC 4)', () => {
  test.beforeEach(() => {
    // Arrangement, both lines gate-measured (packet §4b): moves STEM Night's
    // second session into Past, where `OutreachList`'s Past section passes
    // `allowSelfCheckoff={true}` (`OutreachList.tsx:4031`) -- Upcoming
    // (`:4019`) never does. The UI is not broken by this; the unmodified
    // seed simply has no Past outreach event with an unrecorded session.
    execAdmin(`update event_sessions set status = 'completed' where id = '${STEM_NIGHT_SESSION}'`);
    // Defence 1 of 3 (packet §6c): scoped to Priya's `method='self'` rows
    // only, so this never touches the coach-attributed row at `…-0006` that
    // `student-parent.spec.ts:27-46`/`:121-128` read via `v_student_hours`.
    execAdmin(`delete from attendance where student_id = '${SEED.studentPriya}' and method = 'self'`);
  });

  test('checking an eligible day writes status=present, method=self, recorded_by=the student', async ({
    page,
  }) => {
    try {
      expect(selfRowsFor(STEM_NIGHT_SESSION)).toHaveLength(0);

      await signIn(page, 'student');
      await page.goto('/outreach');

      // En dash (U+2013), copied verbatim from `OutreachList.tsx:3642` --
      // gate-measured, do not retype it.
      const markAttendance = page.getByRole('button', {
        name: 'Mark attendance – Library STEM Night',
      });
      await expect(markAttendance).toBeVisible({ timeout: 20_000 });
      await markAttendance.click();

      // The dialog carries no `aria-labelledby`-derived accessible name
      // (measured: `getByRole('dialog', { name: 'Mark attendance' })` finds
      // nothing even though the heading text is right there), so this
      // locates it by role only and asserts the title as a separate heading.
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible({ timeout: 20_000 });
      await expect(dialog.getByRole('heading', { name: 'Mark attendance', level: 2 })).toBeVisible();

      // `…-0006` carries Priya's existing coach row -- `computeLockedSessionIds`
      // renders it disabled with "Already recorded". That lock is itself real
      // evidence the dialog correctly refuses to let a student overwrite a
      // coach-recorded row from this surface.
      const lockedRow = dialog.getByText('Already recorded');
      await expect(lockedRow).toBeVisible();

      const eligibleDay = dialog.getByRole('checkbox', { name: /Sun, Aug 23/ });
      await expect(eligibleDay).toBeVisible();
      await expect(eligibleDay).not.toBeChecked();
      await eligibleDay.check();
      await capture(page, '50-student-self-checkoff-day-checked');

      await dialog.getByRole('button', { name: /^Save/ }).click();

      // Read the row back and compare values (AC 2) -- never the request.
      await expect.poll(() => selfRowsFor(STEM_NIGHT_SESSION).length, { timeout: 20_000 }).toBe(1);
      const [row] = selfRowsFor(STEM_NIGHT_SESSION);
      expect(row.status).toBe('present');
      expect(row.method).toBe('self');
      expect(row.recorded_by).toBe(PERSONAS.student.profileId);

      await capture(page, '51-student-self-checkoff-saved');
    } finally {
      // try/finally, defence 2 of 3 (packet §6c) -- runs whether the test
      // passed, failed an assertion, or the page threw.
      execAdmin(`update event_sessions set status = 'scheduled' where id = '${STEM_NIGHT_SESSION}'`);
      execAdmin(`delete from attendance where student_id = '${SEED.studentPriya}' and method = 'self'`);
    }
  });
});

test.describe('self-checkoff proven against real RLS (policy-level proof, complements §6b.3)', () => {
  // This does not touch the browser or the STEM Night fixture at all -- it
  // exercises `execAs`, which runs as `authenticated` with the persona's real
  // `auth.uid()` (`personaHarness.ts:138-150`), i.e. the REAL
  // `self_insert`/`self_delete` RLS policies, not a superuser bypass
  // (`execAdmin`). It complements §6b.3's UI proof; it does not replace it.
  test('self_insert lets the student write their own row; self_delete lets them remove it', () => {
    try {
      expect(selfRowsFor(RLS_PROOF_SESSION)).toHaveLength(0);

      // Verified INSERT, packet §9 -- column truth: `student_id` takes
      // `students.id` (`SEED.studentPriya`), `recorded_by` takes `profiles.id`
      // and must equal `auth.uid()` (`PERSONAS.student.profileId`). Getting
      // these backwards produces a `42501` that reads exactly like a policy
      // bug.
      execAs(
        'student',
        `insert into attendance (session_id, student_id, status, method, recorded_by)
         values ('${RLS_PROOF_SESSION}', '${SEED.studentPriya}', 'present', 'self', '${PERSONAS.student.profileId}')`,
      );

      const [row] = selfRowsFor(RLS_PROOF_SESSION);
      expect(row.status).toBe('present');
      expect(row.method).toBe('self');
      expect(row.recorded_by).toBe(PERSONAS.student.profileId);

      // Verified DELETE, packet §9 -- satisfies `self_delete`.
      execAs(
        'student',
        `delete from attendance
         where session_id = '${RLS_PROOF_SESSION}' and student_id = '${SEED.studentPriya}' and method = 'self'`,
      );
      expect(selfRowsFor(RLS_PROOF_SESSION)).toHaveLength(0);
    } finally {
      // Belt-and-braces: if the DELETE assertion above never ran (a failure
      // between INSERT and DELETE), do not leave a row for
      // `student-parent.spec.ts:48-64` to trip over.
      execAdmin(
        `delete from attendance where session_id = '${RLS_PROOF_SESSION}' and student_id = '${SEED.studentPriya}' and method = 'self'`,
      );
    }
  });
});

test.describe('kiosk (AC 1/6) -- degrading honestly without the checkin-token stand-in', () => {
  test('shows the live tally and states plainly that no QR is available', async ({ page }) => {
    // `kiosk.ts:369` invokes the Edge Function `checkin-token`, which
    // `EDGE_FUNCTIONS` (`server.mjs:474-500`) has no stand-in for -> 404, and
    // the page shows "QR not available yet." honestly rather than crashing.
    // Filed as finding `e2e-personas/harness-missing-checkin-token-stand-in`.
    await signIn(page, 'coach');
    await page.goto(`/kiosk/${SEED.liveSession}`);

    await expect(
      page.getByRole('heading', { level: 1, name: 'Weeknight Build Session' }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('QR not available yet.')).toBeVisible();
    await expect(page.getByText('No student names are shown on this screen.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to meetings' })).toBeVisible();

    // `1 of 3 checked in` is data-dependent: it only holds because
    // `coach-checkin.spec.ts` runs first (path order), clears `…-0004` and
    // re-marks Priya, and the final state left behind is `late`, which
    // `CHECKED_IN_STATUSES` (`kiosk.ts:38-43`, kept in lockstep with
    // `LiveConsole.tsx`'s own definition) still counts. Corroborated against
    // the database rather than hard-coded, per packet §6b.4.
    // Mirrors `kiosk.ts`'s own `makeLoadKioskTally` (`:300-329`): "expected"
    // is the active roster (`students.is_active`) scoped to the parent
    // event's `team_ids` (`null` = open to every team), "checked in" is
    // `attendance` rows in `CHECKED_IN_STATUSES` for this session.
    const [{ checked_in: checkedIn, expected }] = readRows<{ checked_in: number; expected: number }>(
      `with ctx as (
         select e.team_ids
         from event_sessions es join events e on e.id = es.event_id
         where es.id = '${SEED.liveSession}'
       )
       select
         (select count(*) from attendance
          where session_id = '${SEED.liveSession}' and status in ('present', 'late'))::int as checked_in,
         (select count(*) from students s, ctx
          where s.is_active
            and (ctx.team_ids is null or s.team_id = any (ctx.team_ids)))::int as expected`,
    );
    await expect(page.getByText(`${checkedIn} of ${expected} checked in`)).toBeVisible();

    await capture(page, '60-student-kiosk');
  });
});
