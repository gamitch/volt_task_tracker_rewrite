/**
 * GAM-344 Turn A (W3 "run a meeting"): schedule -> attendance -> end meeting
 * -> participation %. Covers the untested half of the end-meeting write path
 * (`src/lib/supabase/loaders/endMeeting.ts`'s `makeOnEndMeeting`) that GAM-344
 * was filed about -- criteria 3, 4 and 6 in particular.
 *
 * `eventsTitled`/`sessionsFor`'s shape is lifted verbatim from
 * `coach-meeting.spec.ts`, this suite's own longest worked example, rather
 * than inventing new row readers -- extended only with the `id` column this
 * file needs to navigate to `/meetings/live/<sessionId>`.
 *
 * Every meeting created here is narrowed to `Volt Robotics 9911` only
 * (`narrowScopeToFrc` below). The schedule dialog defaults to BOTH live
 * teams (measured default text: "Volt Robotics 9911, Volt Junior 4402"), and
 * without narrowing the roster would be 5 students, shifting the "Mark N
 * students..." counts this file asserts exactly. `admin-roster.spec.ts` runs
 * earlier in the full suite and leaves an active `teamFtc` student behind
 * (`E2E Rowan Adeyemi`), which would shift an all-teams roster count again --
 * narrowing removes the whole dependency rather than reasoning about it.
 *
 * Title prefix `W3END ` (NOT `E2E `, and NOT `W3SER `, which Turn B owns).
 * Measured: `'W3END Opt-Out Night' like 'E2E %'` is false, so an `E2E `
 * prefix would collide with `coach-meeting.spec.ts`'s own `beforeEach`
 * (`delete from events where title like 'E2E %'`), which runs AFTER this
 * file in path order (`-` sorts before `.`) and would try to delete rows
 * this file's own sessions still have `attendance`/`rsvps` children for.
 * `attendance_session_id_fkey`/`rsvps_session_id_fkey` are `ON DELETE
 * RESTRICT`, not cascade, so that collision would not just miss rows -- it
 * would THROW and fail every test in `coach-meeting.spec.ts`.
 */
import { expect, test, type Locator, type Page } from 'playwright/test';
import { PERSONAS, SEED, capture, execAdmin, readRows, readRowsAs, signIn } from './personaHarness';

/** Not exported from `personaHarness.SEED` -- `student-checkin.spec.ts`'s own
 * precedent for defining file-local seed ids the shared harness does not. Sam
 * Whitfield has no login persona (`profile_id` is null in the seed), so he is
 * only ever addressed by id, never signed in as. */
const STUDENT_SAM = '57000000-0000-4000-8000-000000000003';

/** Jordan Okafor's display name, as seeded (`seed.sql:52`) -- there is no
 * `PERSONAS` entry for him (he is a roster member, not a login persona). */
const JORDAN_DISPLAY_NAME = 'Jordan Okafor';

interface EventRow {
  id: string;
  title: string;
  type: string;
  season_id: string;
  location_name: string;
  team_ids: string[] | null;
}

interface SessionRow {
  id: string;
  session_date: string;
  starts_at: string;
  ends_at: string;
  status: string;
  notes: string;
}

interface AttendanceRow {
  student_id: string;
  status: string;
  method: string;
  recorded_by: string | null;
  check_out_at: string | null;
}

interface ParticipationRow {
  expected_ct: number;
  present_ct: number;
  participation_pct: number | null;
}

interface RawParticipationCounts {
  expected_ct: number;
  present_ct: number;
}

function eventsTitled(title: string): EventRow[] {
  return readRows<EventRow>(
    `select id, title, type, season_id, location_name, team_ids
     from events where title = '${title}'`,
  );
}

function sessionsFor(eventId: string): SessionRow[] {
  return readRows<SessionRow>(
    `select id, session_date::text, starts_at::text, ends_at::text, status, notes
     from event_sessions where event_id = '${eventId}' order by session_date`,
  );
}

function attendanceForSession(sessionId: string): AttendanceRow[] {
  return readRows<AttendanceRow>(
    `select student_id, status, method, recorded_by, check_out_at::text
     from attendance where session_id = '${sessionId}' order by student_id`,
  );
}

/** Filtered by `student_id` -- measured (§4 A2 step 3 of the worker packet):
 * the student persona's own read of this view returns EVERY student's row,
 * not just their own (a candidate finding in its own right, filed below).
 * Reads through the real `student` persona/RLS, never `readRows` (superuser),
 * because the point of A2 step 7 is what the signed-in student can see. */
function participationForStudent(studentId: string): ParticipationRow[] {
  return readRowsAs<ParticipationRow>(
    'student',
    `select expected_ct, present_ct, participation_pct
     from v_student_participation where student_id = '${studentId}'`,
  );
}

/**
 * Independent witness for criterion 6 -- recomputes the counts directly
 * against `attendance`, NOT by re-running the view's own formula (recomputing
 * the view's arithmetic and comparing it to the view proves nothing).
 * Deliberately omits the view's team-scope predicate (`e.team_ids is null or
 * st.team_id = any(e.team_ids)`) and its `season_id` grouping -- neither can
 * diverge here (every Turn A meeting is FRC-scoped, and the seed carries
 * exactly one active season), but a reader should not have to work that out
 * unassisted.
 */
function rawParticipationCounts(studentId: string): RawParticipationCounts[] {
  return readRows<RawParticipationCounts>(
    `select count(*)::int as expected_ct,
            count(*) filter (where a.status in ('present', 'late'))::int as present_ct
     from attendance a
     join event_sessions es on es.id = a.session_id and es.status = 'completed'
     join events e on e.id = es.event_id and e.counts_participation
     where a.student_id = '${studentId}'`,
  );
}

function requireOne<T>(rows: readonly T[], context: string): T {
  if (rows.length !== 1) {
    throw new Error(`expected exactly one row for ${context}, got ${rows.length}`);
  }
  return rows[0];
}

/** Lifted from `coach-meeting.spec.ts` -- same shape, not reinvented. */
async function openScheduleDialog(page: Page) {
  await page.goto('/meetings');
  await expect(page.getByRole('heading', { name: 'Meetings', exact: true })).toBeVisible();
  await expect(page.getByText('Weeknight Build Session').first()).toBeVisible({ timeout: 20_000 });
  await page.getByRole('button', { name: 'Schedule meetings' }).first().click();
  const dialog = page.getByRole('dialog').filter({ hasText: 'Basics' }).first();
  await dialog.waitFor();
  return dialog;
}

/** Every meeting in this file is narrowed to `Volt Robotics 9911` only -- see
 * the module doc above for why. `Volt Legacy 2201` is not offered at all
 * (GAM-305's `excludeArchivedTeams`, repaired into `coach-meeting.spec.ts` by
 * this same task's Task 1), so only `Volt Junior 4402` needs deselecting. */
async function narrowScopeToFrc(dialog: Locator, page: Page) {
  const scope = dialog.getByRole('combobox').first();
  await scope.click();
  await page.getByRole('option', { name: 'Volt Junior 4402' }).click();
  await page.keyboard.press('Escape');
  await expect(scope).toHaveText('Volt Robotics 9911');
}

test.describe('W3 end-meeting journeys (GAM-344 Turn A)', () => {
  // Re-runnable without a full reseed (criterion 10): clear only the events
  // this file creates. Children first -- `attendance`/`rsvps` do NOT cascade
  // off `event_sessions` (`ON DELETE RESTRICT`), unlike `event_sessions`
  // itself, which does cascade off `events`. Verified directly:
  //   ERROR: update or delete on table "event_sessions" violates foreign key
  //   constraint "attendance_session_id_fkey" on table "attendance"
  // if the child deletes are skipped or reordered.
  test.beforeEach(() => {
    execAdmin(`delete from attendance where session_id in (
      select id from event_sessions where event_id in (
        select id from events where title like 'W3END %'))`);
    execAdmin(`delete from rsvps where session_id in (
      select id from event_sessions where event_id in (
        select id from events where title like 'W3END %'))`);
    execAdmin(`delete from events where title like 'W3END %'`);
  });

  test('A1: opt-in OFF writes exactly one attendance row, in UTC, and reaches the unreachable-from-the-UI checkout leg (criteria 1, 2, 3, 7)', async ({
    page,
  }) => {
    const title = 'W3END Opt-Out Night';
    await signIn(page, 'coach');
    const dialog = await openScheduleDialog(page);

    await dialog.getByLabel(/^Title/).fill(title);
    await dialog.locator('input[placeholder="e.g. Robotics Lab"]').fill('Fabrication Bay');
    await narrowScopeToFrc(dialog, page);

    const dateField = dialog.getByRole('combobox', { name: /^Date/ });
    await dateField.click();
    await dateField.fill('12/17/2026');
    await page.keyboard.press('Enter');
    await expect(dateField).toHaveValue('December 17, 2026');

    await dialog.locator('input[placeholder="Select a time"]').nth(0).fill('5:30 PM');
    await dialog.locator('input[placeholder="Select a time"]').nth(1).fill('7:45 PM');
    await dialog.locator('textarea').fill('W3END A1: opt-out ending.');

    const submit = dialog.locator('button', { hasText: /^Create \d+ meeting/ });
    await expect(submit).toHaveText('Create 1 meeting');
    await submit.click();

    await expect.poll(() => eventsTitled(title).length, { timeout: 20_000 }).toBe(1);
    const event = requireOne(eventsTitled(title), title);
    expect(event.type).toBe('meeting');
    expect(event.season_id).toBe(SEED.activeSeason);
    expect(event.location_name).toBe('Fabrication Bay');
    // Scope narrowed in the dropdown is the scope stored on the row.
    expect(event.team_ids).toEqual([SEED.teamFrc]);

    const session = requireOne(sessionsFor(event.id), `sessions for ${event.id}`);
    expect(session.status).toBe('scheduled');
    expect(session.notes).toBe('W3END A1: opt-out ending.');
    // Chicago wall time, stored UTC (§3.6 of the worker packet): 5:30 PM CST
    // is 23:30Z the SAME day; 7:45 PM is 01:45Z the NEXT day -- the date
    // rollover is the classic way a scheduling app drifts by a day, so it is
    // asserted, not assumed. Criterion 7.
    expect(session.starts_at).toContain('2026-12-17 23:30:00');
    expect(session.ends_at).toContain('2026-12-18 01:45:00');

    // No time gate to work around here (§3.3, measured in the browser on a
    // future-dated session): the End-meeting affordance is gated on
    // `data.session.status === 'scheduled'`, which this freshly created
    // session already satisfies.
    await page.goto(`/meetings/live/${session.id}`);

    const priyaMarks = page.getByRole('radiogroup', {
      name: `Attendance for ${PERSONAS.student.displayName}`,
    });
    await expect(priyaMarks).toBeVisible({ timeout: 20_000 });
    await priyaMarks.getByRole('radio', { name: 'Present' }).click();

    // `handleSetStatus` (`LiveConsole.tsx:1117`) fires the upsert
    // optimistically and does NOT await it, so an UPDATE that beats the
    // INSERT would touch 0 rows. Poll for the row to actually exist before
    // seeding `check_in_at` onto it below.
    await expect
      .poll(
        () => attendanceForSession(session.id).filter((r) => r.student_id === SEED.studentPriya).length,
        { timeout: 20_000 },
      )
      .toBe(1);

    // Harness bookkeeping (`personaHarness.ts:125`), never an assertion: NO
    // UI writer in this app ever sets `check_in_at` -- the coach console's
    // own upsert deliberately never includes it (`attendance.ts` module doc
    // :135-136), and the only real writer is the QR `checkin` Edge Function,
    // a shallow stand-in in this harness (§3.3 of the worker packet). Seeded
    // here purely to exercise `onEndMeeting`'s otherwise-unreachable checkout
    // leg (write-path step 2) -- a coach cannot walk this path through this
    // harness's UI today.
    execAdmin(
      `update attendance set check_in_at = now()
       where session_id = '${session.id}' and student_id = '${SEED.studentPriya}'`,
    );

    // REQUIRED, not hygiene (measured by the premise gate). `EndMeetingDialog`
    // loads its summary once at mount (`EndMeetingDialog.tsx:875`,
    // `useLoadState(() => loadSummary(sessionId), [loadSummary, sessionId])`)
    // and `LiveConsole.tsx:1187-1192` mounts it with no `key` and no refresh
    // trigger. Without this reload the checkbox below would still read
    // "Mark 3 students..." and the seeded `check_in_at` would be invisible to
    // `computeCheckoutStudentIds`. This staleness is a real, user-visible
    // product defect -- a coach who marks students present and opens End
    // meeting is shown a stale "0 present" and offered to mark everyone
    // absent -- filed as `meetings/end-meeting-summary-stale-after-console-marks`.
    await page.reload();
    await expect(priyaMarks).toBeVisible({ timeout: 20_000 });

    const endMeetingTrigger = page.getByRole('button', { name: 'End meeting' });
    await expect(endMeetingTrigger).toBeVisible({ timeout: 20_000 });

    // The count itself is an assertion about roster resolution: it proves
    // Casey (`is_active = false`) is excluded from the roster entirely, and
    // that Priya (just marked, now visible post-reload) is excluded from
    // "unmarked" -- leaving exactly Jordan and Sam.
    const optOutCheckbox = page.getByRole('checkbox', {
      name: 'Mark 2 students with no attendance record absent',
    });
    await expect(optOutCheckbox).toBeVisible();
    await expect(optOutCheckbox).not.toBeChecked();
    await capture(page, '70-coach-end-meeting-optout-unticked');
    // Leave it UNTICKED -- deliberate, this is criterion 3's setup.

    await endMeetingTrigger.click();
    // Measured (§3.3): once the confirm is open, TWO controls are named
    // "End meeting" -- the (now-obscured) trigger and the confirm action.
    // Scoped to the `alertdialog` deliberately, rather than `.first()`/
    // `.last()`, so a future reordering of the DOM cannot silently flip which
    // one this clicks.
    const confirmDialog = page.getByRole('alertdialog', { name: 'End this meeting?' });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole('button', { name: 'End meeting' }).click();

    await expect.poll(() => sessionsFor(event.id)[0]?.status, { timeout: 20_000 }).toBe('completed');

    // Criterion 3, scoped to exactly what these assertions can prove: with
    // the opt-in unticked, NO `attendance` ROW EXISTS for the unmarked
    // students. Asserting the total row count is exactly one is stronger than
    // "no rows with status='absent'" -- it also catches an unconditional
    // upsert that wrote `status: null` or otherwise malformed rows for
    // Jordan/Sam.
    //
    // GAM-344 checker MAJOR, corrected here: this does NOT prove the stronger
    // claim that no write REQUEST was issued. T508's ruling is about the
    // request, and database state cannot see it -- real PostgREST accepts an
    // empty-array insert and writes zero rows, so an unguarded upsert would
    // leave the rows below byte-identical and every assertion here would still
    // pass. The transport half is guarded, but by `endMeeting.test.ts:507`
    // (C1, T508 -- "asserted at the transport, not by reading the payload
    // object"), which CI runs on every push. This spec covers the state half.
    //
    // The mutation that discriminates THIS block is the dialog's opt-in
    // branch: make `buildEndMeetingPayload` (`EndMeetingDialog.tsx:456`)
    // compute `markAbsentStudentIds` unconditionally instead of honouring
    // `markRemainingAbsent`. That sends a NON-empty array, so the session
    // still completes and the assertions below are reached and go red.
    // Removing the `endMeeting.ts:434` length guard does NOT discriminate
    // here: the harness's mock PostgREST rejects an empty-array upsert
    // (`postgrest.mjs:255`, stricter than real PostgREST), so the whole chain
    // rejects and the `status='completed'` poll above times out first -- the
    // block never executes, and that red is the write path breaking, which
    // criterion 1's mutation already covers.
    const attendanceRows = attendanceForSession(session.id);
    expect(attendanceRows).toHaveLength(1);
    expect(attendanceRows.filter((r) => r.student_id === SEED.studentJordan)).toHaveLength(0);
    expect(attendanceRows.filter((r) => r.student_id === STUDENT_SAM)).toHaveLength(0);

    const priyaRow = requireOne(
      attendanceRows.filter((r) => r.student_id === SEED.studentPriya),
      'Priya attendance row',
    );
    expect(priyaRow.status).toBe('present');
    // Write-path step 2 (checkout), reachable only because of the seeded
    // `check_in_at` above -- the UI cannot walk this path today (§3.3).
    expect(priyaRow.check_out_at).toBe(session.ends_at);
  });

  test('A2: opt-in ON marks the rest absent without touching the existing mark, and moves the participation figure (criteria 1, 2, 4, 6)', async ({
    page,
  }) => {
    const title = 'W3END Opt-In Night';
    await signIn(page, 'coach');
    const dialog = await openScheduleDialog(page);

    await dialog.getByLabel(/^Title/).fill(title);
    await dialog.locator('input[placeholder="e.g. Robotics Lab"]').fill('Fabrication Bay');
    await narrowScopeToFrc(dialog, page);

    const dateField = dialog.getByRole('combobox', { name: /^Date/ });
    await dateField.click();
    await dateField.fill('12/18/2026');
    await page.keyboard.press('Enter');
    await expect(dateField).toHaveValue('December 18, 2026');

    await dialog.locator('input[placeholder="Select a time"]').nth(0).fill('5:30 PM');
    await dialog.locator('input[placeholder="Select a time"]').nth(1).fill('7:45 PM');
    await dialog.locator('textarea').fill('W3END A2: opt-in ending.');

    const submit = dialog.locator('button', { hasText: /^Create \d+ meeting/ });
    await expect(submit).toHaveText('Create 1 meeting');
    await submit.click();

    await expect.poll(() => eventsTitled(title).length, { timeout: 20_000 }).toBe(1);
    const event = requireOne(eventsTitled(title), title);
    expect(event.team_ids).toEqual([SEED.teamFrc]);

    const session = requireOne(sessionsFor(event.id), `sessions for ${event.id}`);
    expect(session.status).toBe('scheduled');

    await page.goto(`/meetings/live/${session.id}`);

    const jordanMarks = page.getByRole('radiogroup', {
      name: `Attendance for ${JORDAN_DISPLAY_NAME}`,
    });
    await expect(jordanMarks).toBeVisible({ timeout: 20_000 });
    // Deliberate: mark Jordan present, leave Priya and Sam unmarked -- this
    // is what makes criterion 6 measurable (§3.2: an unmarked student
    // contributes no row at all; only an explicit mark moves the figure).
    await jordanMarks.getByRole('radio', { name: 'Present' }).click();

    await expect
      .poll(
        () => attendanceForSession(session.id).filter((r) => r.student_id === SEED.studentJordan).length,
        { timeout: 20_000 },
      )
      .toBe(1);

    // Same mount-time-summary reason as A1 -- without this reload,
    // `EndMeetingDialog`'s stale snapshot would not know Jordan already has a
    // record, so the opt-in payload's `markAbsentStudentIds` would wrongly
    // include him too.
    await page.reload();
    await expect(jordanMarks).toBeVisible({ timeout: 20_000 });

    // Read BEFORE this ending, inside this same test. Turn A ends two
    // meetings across the file, and this file's own `beforeEach` deletes the
    // OTHER W3END-prefixed event before each test runs, so Priya's absolute
    // participation number here does not actually carry over from A1 -- but
    // the delta assertion below does not depend on that either way, which is
    // the point of reading a fresh "before" snapshot rather than hardcoding
    // a percentage (§3.2, §7 decision 1 of the worker packet).
    const beforePriya = requireOne(participationForStudent(SEED.studentPriya), 'Priya before');
    const beforeJordan = requireOne(participationForStudent(SEED.studentJordan), 'Jordan before');
    expect(beforePriya.participation_pct).not.toBeNull();
    expect(beforeJordan.participation_pct).not.toBeNull();

    const endMeetingTrigger = page.getByRole('button', { name: 'End meeting' });
    await expect(endMeetingTrigger).toBeVisible({ timeout: 20_000 });

    // Priya and Sam are unmarked; Jordan and Casey (inactive) are not counted.
    const optInCheckbox = page.getByRole('checkbox', {
      name: 'Mark 2 students with no attendance record absent',
    });
    await expect(optInCheckbox).toBeVisible();
    await optInCheckbox.check();
    await expect(optInCheckbox).toBeChecked();
    await capture(page, '71-coach-end-meeting-optin-ticked');

    await endMeetingTrigger.click();
    const confirmDialog = page.getByRole('alertdialog', { name: 'End this meeting?' });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole('button', { name: 'End meeting' }).click();

    await expect.poll(() => sessionsFor(event.id)[0]?.status, { timeout: 20_000 }).toBe('completed');

    // Criterion 4.
    const attendanceRows = attendanceForSession(session.id);
    expect(attendanceRows).toHaveLength(3);
    const priyaRow = attendanceRows.find((r) => r.student_id === SEED.studentPriya);
    const samRow = attendanceRows.find((r) => r.student_id === STUDENT_SAM);
    const jordanRow = attendanceRows.find((r) => r.student_id === SEED.studentJordan);
    expect(priyaRow).toBeDefined();
    expect(samRow).toBeDefined();
    expect(jordanRow).toBeDefined();

    expect(priyaRow?.status).toBe('absent');
    expect(priyaRow?.method).toBe('coach');
    expect(priyaRow?.recorded_by).toBeNull();
    expect(samRow?.status).toBe('absent');
    expect(samRow?.method).toBe('coach');
    expect(samRow?.recorded_by).toBeNull();
    // `ignoreDuplicates` working, and this is the half of criterion 4 a naive
    // row COUNT would miss: Jordan's own console-marked row is untouched --
    // still present, original method and attributed coach, not overwritten
    // by the absent-marking upsert.
    expect(jordanRow?.status).toBe('present');
    expect(jordanRow?.method).toBe('coach');
    expect(jordanRow?.recorded_by).toBe(PERSONAS.coach.profileId);

    // Criterion 6, as a delta against the "before" snapshot, not a
    // hardcoded percentage.
    const afterPriya = requireOne(participationForStudent(SEED.studentPriya), 'Priya after');
    const afterJordan = requireOne(participationForStudent(SEED.studentJordan), 'Jordan after');

    expect(afterPriya.expected_ct).toBe(beforePriya.expected_ct + 1);
    expect(afterPriya.present_ct).toBe(beforePriya.present_ct);
    expect(afterPriya.participation_pct).toBeLessThan(beforePriya.participation_pct as number);

    // Jordan corroborates in the other direction -- he was marked PRESENT,
    // so his own figure can only move up (or stay, if already at 100%; the
    // seed's Jordan baseline is 66.7%, so it strictly increases here).
    expect(afterJordan.expected_ct).toBe(beforeJordan.expected_ct + 1);
    expect(afterJordan.present_ct).toBe(beforeJordan.present_ct + 1);
    expect(afterJordan.participation_pct).toBeGreaterThan(beforeJordan.participation_pct as number);

    // Independent witness: the view's own counts agree with a count computed
    // directly against `attendance`, WITHOUT re-running the view's formula.
    const rawPriya = requireOne(rawParticipationCounts(SEED.studentPriya), 'Priya raw cross-check');
    expect(rawPriya.expected_ct).toBe(afterPriya.expected_ct);
    expect(rawPriya.present_ct).toBe(afterPriya.present_ct);

    // The rendered figure, read through the real student persona.
    // `StudentHome.tsx:1649` interpolates `participationPct` as a raw JS
    // number (`80.0` renders `80`, `66.7` renders `66.7`), so this parses the
    // rendered text back to a number rather than comparing strings/substrings.
    // `signIn` itself only drives `/login`'s own form -- an already
    // authenticated session (the coach's, still live on this page) redirects
    // `/login` straight back to that persona's own home instead of showing
    // the form, so the coach must be signed out first (`personas.spec.ts:42-44`'s
    // own precedent for a persona switch on one `page`). `/meetings/live/:id`
    // itself renders chromeless -- no TopNav, no account menu -- so navigate
    // to a page that has one before reaching for it.
    await page.goto('/');
    await page.getByRole('button', { name: `Account menu for ${PERSONAS.coach.email}` }).click();
    await page.getByRole('menuitem', { name: /sign out/i }).click();
    await expect.poll(() => new URL(page.url()).pathname, { timeout: 15_000 }).toBe('/login');

    await signIn(page, 'student');
    await page.goto('/');
    const participationText = page.getByText(/^Participation: /);
    await expect(participationText).toBeVisible({ timeout: 20_000 });
    const rawText = (await participationText.innerText()).trim();
    await capture(page, '72-student-participation-figure');

    if (afterPriya.participation_pct === null) {
      // NULL renders as an em dash (§3.2) -- not exercised by this scenario
      // (Priya always has marks by this point), but handled explicitly
      // rather than silently assuming a number is always present.
      expect(rawText).toBe('Participation: —');
    } else {
      const rendered = Number(rawText.replace('Participation:', '').replace('%', '').trim());
      expect(rendered).toBe(afterPriya.participation_pct);
    }
  });
});
