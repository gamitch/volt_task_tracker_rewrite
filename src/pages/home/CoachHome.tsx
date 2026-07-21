/**
 * T053: `/` Coach/Admin Home (HOME-01/HOME-04).
 *
 * -----------------------------------------------------------------------
 * 1. `Analytics Dashboard` template investigation (Known Context/Traps #1) --
 *    a real, disclosed CLI naming gap, same category as T016's "Basic
 *    Login" / T056's "Grouped Table".
 *
 * `npm run astryx -- template "Analytics Dashboard"` (run live for this
 * task) errors: `Unknown template "Analytics Dashboard"` -- that exact
 * string is NOT a valid template id in the installed CLI. However
 * `npm run astryx -- search "analytics dashboard"` (also run live) resolves
 * it as a *display name* for a real template whose actual id is `dashboard`:
 *
 *   [template]   Analytics Dashboard
 *                Analytics dashboard with KPI cards, charts, and data tables
 *                -> npx astryx template dashboard
 *
 * So unlike T016's "Basic Login" (which the CLI could not resolve to ANY
 * real template even via search, only a generic `login` skeleton) and
 * T056's "Grouped Table" (which does not exist anywhere, CLI or installed
 * package), "Analytics Dashboard" DOES exist for real -- just under the
 * internal id `dashboard`, not the literal PRD/ledger prose string. Per
 * constitution item 13 ("templates are used as-is; inventing a layout
 * instead of using the named template is a violation"), `npm run astryx --
 * template dashboard` (run live, full output read) was used as the base,
 * not an invented KPI-grid layout.
 *
 * The real template's structural skeleton (its own literal JSX, not
 * paraphrased) this file reuses:
 *   `Layout(height="fill", content=<LayoutContent padding={6}>)` >
 *   `VStack gap={6}` > ... > a `MetricCard` pattern of
 *   `Card > VStack gap={2} > [Heading level={4} label, Heading level={2}
 *   value, Text supporting]`, laid out in
 *   `Grid columns={{minWidth: 320, repeat: 'fit'}} gap={4}` rows, with
 *   `Divider` separating each major section. This file's header row, KPI
 *   `Grid`, and section dividers below are built directly on that skeleton.
 *
 * What was deliberately NOT carried over from the template, and why: the
 * template's own "Active users" line chart, "Demographics" stacked-bar
 * cards, and "Engagement" data tables (all built on `recharts`, a dependency
 * not installed in this project -- confirmed via `package.json`) have no
 * corresponding HOME-01 requirement (KPI cards, hours-vs-goal bar, Start
 * check-in / New outreach event actions, Next up, Recent signups -- none of
 * which are charts or data tables). Per PRD 7.1's own template-citation
 * text ("template as-is" for the parts a page actually uses) and this same
 * batch's `LoginPage.tsx` precedent ("AUTH-02 (PRD) is definitive over the
 * generic CLI skeleton for the extra fields it explicitly requires ... no
 * *additional* layout beyond [the requirement]'s literal field list was
 * added"), fabricating a fake analytics chart with invented numbers just to
 * "look like" the full template would itself be fabricated content
 * (constitution item 6/13), not template fidelity. The template's own
 * `MetricCard`/`Grid`/`Layout`/`Divider` structural composition -- the part
 * that actually maps onto HOME-01's four KPI cards -- is what's reused.
 *
 * -----------------------------------------------------------------------
 * 2. BEH-05 KPI card discipline -- one metric per `Card`.
 *
 * `KpiCard` below renders exactly one large `Heading level={2}` value per
 * card, a small `Heading level={4}` label above it, and at most one
 * `secondary` slot (a single `Text type="supporting"` line -- never a
 * second number of equal visual weight). The hours-vs-goal card additionally
 * renders a `ProgressBar` beneath the single large percent value -- this is
 * a visualization OF that same one metric (the bar's own value-label text
 * is themed as supporting-weight by the component itself, never a second
 * competing large number), not a second KPI crammed into one card.
 *
 * -----------------------------------------------------------------------
 * 3. Ground truth -- `events`/`event_sessions`/`rsvps`/`attendance` column
 *    shapes (constitution item 3), cited directly from
 *    `supabase/migrations/20260717000000_scheduling_attendance.sql`
 *    (read-only), NOT redefined/renamed with invented fields. Same subset
 *    `OutreachList.tsx`/`MeetingsList.tsx` already cited:
 *
 *    `events` (lines 33-48): id, season_id, type (check: 'meeting' |
 *    'outreach' | 'competition'), title, team_ids uuid[] NULL (null = all
 *    teams), counts_participation, counts_volunteer_hours, ...
 *
 *    `event_sessions` (lines 53-63): id, event_id, starts_at (timestamptz),
 *    ends_at (timestamptz), status (check: 'scheduled' | 'completed' |
 *    'canceled'), ...
 *
 *    `rsvps` (lines 67-76): id, session_id, student_id, status (check:
 *    'going' | 'maybe' | 'declined'), updated_at, ...
 *
 *    `attendance` (lines 82-95): id, session_id, student_id, status (check:
 *    'present' | 'late' | 'excused' | 'absent'), ...
 *
 * -----------------------------------------------------------------------
 * 4. Metric-view sourcing (constitution item 3, BLOCKER if re-derived) --
 *    T013's real, already-Passed metric views used verbatim where they
 *    apply; a NEW, disclosed, distinct formula only where no view exists.
 *
 * `supabase/migrations/20260717000003_metric_views.sql`:
 *   - `v_team_participation` (lines 44-49, MET-02): `team_id, season_id,
 *     participation_pct`. `TeamParticipationMetric` below is a verbatim
 *     camelCase rename of these three columns; this file performs NO
 *     percentage arithmetic on it anywhere (grep-provable: no `100.0 *`, no
 *     `/ greatest(` in this file) -- the KPI card renders
 *     `teamParticipation.participationPct` directly, exactly like
 *     `ParticipationTab.tsx`/T056 already established for the sibling
 *     `v_student_participation` view.
 *   - `v_student_hours` (lines 3-19, feeds MET-04): `student_id, season_id,
 *     confirmed_hours` -- already applies the real `hours_override` /
 *     check-in-clamping logic server-side. `StudentHoursMetric` below is a
 *     verbatim camelCase rename of these three columns; `sumConfirmedHours`
 *     only ADDS already-computed `confirmedHours` values across a roster --
 *     it never recomputes an individual student's hours from raw
 *     attendance/session data (unlike `OutreachList.tsx`/T038, which had to
 *     compute its own confirmed/planned split because no metric view
 *     existed yet for outreach hours at the time it was built -- T013 has
 *     since shipped `v_student_hours`, so this file reads it instead of
 *     re-deriving the same logic).
 *   - MET-04 itself (PRD line 541: "Σ MET-03 ÷ (`goal_hours_override` ??
 *     season `default_goal_hours`)") has no SQL view for the RATIO -- only
 *     the numerator (`v_student_hours.confirmed_hours`) is a view column;
 *     the denominator is a plain roster sum of two real `students`/`seasons`
 *     columns (`goal_hours_override`, `default_goal_hours`), and dividing
 *     the two is UI-side percent math with no metric-view equivalent to
 *     duplicate -- the exact same reasoning `OutreachList.tsx`'s
 *     `confirmedPercent` already established and passed review for.
 *     `hoursVsGoalPercent` below reuses that identical idiom.
 *   - "Attendance rate of last completed meeting" (PRD line 260) has NO
 *     metric view at all -- `v_student_participation`/`v_team_participation`
 *     (MET-01/02) are SEASON-AGGREGATE numbers across every completed
 *     session, with an excused-shrinks-denominator formula (PRD line 539).
 *     This KPI is a SINGLE-SESSION snapshot ("last completed meeting"), a
 *     different grain the views do not provide, so nothing is being
 *     re-derived. `buildLastCompletedMeetingSummary` below counts
 *     present/late/excused/absent for exactly one session -- a plain COUNT,
 *     identical in kind to `MeetingsList.tsx`'s already-accepted
 *     `PastAttendanceSummary`/`summarizeAttendance` (a tally, not a
 *     percentage). `attendanceRatePercent` then divides
 *     `(present+late) / rosterSize` -- deliberately NOT MET-01/02's
 *     excused-exclusion formula, to avoid even superficially duplicating
 *     that specific SQL shape; this is a distinct, simpler, disclosed ratio
 *     ("how many of the active roster showed up"), not the participation
 *     metric re-implemented at a different grain.
 *
 * -----------------------------------------------------------------------
 * 5. "Start check-in" -- a real, testable 60-minute boundary rule (Known
 *    Context/Traps #4), scoped to meeting-type sessions in the viewer's team.
 *
 * `isSessionCheckInEligible(session, nowMs)` is the ONLY boundary predicate:
 * visible when `session.status === 'scheduled'` AND (currently live
 * [`startsAt <= now <= endsAt`] OR starts within the next 60 minutes
 * inclusive [`0 <= startsAt - now <= 60min`]). `selectCheckInSession` then
 * additionally restricts to `type === 'meeting'` sessions in team scope (the
 * check-in flow is meeting-attendance specific -- MTG-10/Kiosk -- unlike
 * OUT-05's separate "Mark day complete" outreach flow). See this task's
 * worker output / `CoachHome.test.tsx` for the literal 59-vs-61-minute
 * boundary proof plus the live-session and wrong-team/wrong-type exclusion
 * cases, all against the real exported function -- not asserted only via a
 * fixture snapshot.
 *
 * Clicking "Start check-in" is a REAL navigation (not a stub): it calls
 * `useNavigate()` to `routePaths.kioskSession(session.id)`
 * (`../../app/router`, PRD's own "deep-links to console" text). `router.tsx`
 * is a forbidden/read-only file here, but importing its already-exported
 * `routePaths` constant is the same import-only posture `TopNav.tsx`/
 * `MobileNav.tsx`/`SideNav.tsx`/`AppShell.tsx` already established for that
 * exact export. Disclosed gap: `router.tsx`'s own `/kiosk/:sessionId` route
 * still resolves to its own inline `KioskSessionPage()` placeholder (not the
 * real `Kiosk.tsx`, T034's forbidden deliverable) -- confirmed by reading
 * that file directly. So today this button navigates to a real, protected,
 * role-guarded route that currently shows a placeholder, pending a future
 * `router.tsx`-touching task wiring the real `Kiosk.tsx` in (not this task's
 * job -- `router.tsx` is forbidden here). This is the SideNav/TopNav
 * "route exists but isn't wired to real content yet" gap, not the
 * `OutreachList.tsx` "don't invent a link the PRD never asked for" case --
 * HOME-01's own text explicitly requires this deep link.
 *
 * -----------------------------------------------------------------------
 * 6. HOME-04 admin-only "Season setup" card -- role-gated inside this
 *    component (Known Context/Traps #5), since `router.tsx` has no
 *    Coach-Home-vs-Admin-Home route split (they are the same component).
 *
 * Gate: `user.role === 'admin' && isSeasonMissingSetup(teams,
 * seasonSetupStatus)`. `teams.length === 0` is grounded directly in the
 * real `teams` table (no invented field). `seasonSetupStatus.hasGoalsConfigured`
 * is a disclosed UI-only placeholder -- the `seasons`/`students` migration
 * has no "season goal configuration" flag distinct from
 * `default_goal_hours`/`goal_hours_override` themselves (confirmed by
 * reading `20260716000000_identity_roster.sql` directly), so this stands in
 * for "has a coach explicitly reviewed/set this season's goals", the same
 * category of disclosed UI-only placeholder `OutreachList.tsx`'s
 * `OutreachGoalConfig` already established. See this task's worker output
 * for the live render-time proof: shows for `admin` with the shipped
 * default (season-setup incomplete), absent for `coach` with the IDENTICAL
 * data (isolating the role variable), and absent for `admin` once the
 * season is marked fully set up (isolating the season-status variable).
 *
 * -----------------------------------------------------------------------
 * 7. `guards.tsx` `Role` vocabulary gap (same recurring gap `RosterShell.tsx`/
 *    T021, `MeetingsList.tsx`/T030, `OutreachList.tsx`/T038 already
 *    disclosed) -- resolved by T073a, not by this task.
 *
 * `guards.tsx`'s exported `Role` union now matches AUTH-05's real
 * `admin | coach | student | parent` vocabulary exactly (previously a
 * stale `'admin' | 'staff' | 'volunteer' | 'coach'` placeholder), so the
 * `user.role === 'admin'` HOME-04 check and this component's general
 * "Coach/Admin Home" framing continue to read correctly, now against the
 * real vocabulary rather than a coincidental overlap.
 *
 * Unlike `OutreachList.tsx`/`MeetingsList.tsx` (role-VARIANT pages: one URL,
 * different content per role, so they must branch on `user.role` internally
 * to decide WHICH view to show), `CoachHome.tsx` is one of three distinct
 * Home components (`CoachHome`/`StudentHome`/`ParentHome`, HOME-01/02/03) a
 * future dispatcher will choose AMONG based on role -- not a page that must
 * itself detect "wrong" roles. Per this task's Known Context/Traps #5, this
 * component therefore does not redirect/hide itself for a non-coach/admin
 * viewer (there is no `router.tsx`-level Home dispatcher yet to redirect
 * FROM); it only role-gates the one HOME-04-specific extra card internally,
 * exactly as instructed. Same "not wired into any dispatcher yet, standalone
 * and disclosed" posture `StudentHomeSlot.tsx`/T008 already established for
 * the sibling Home-family component.
 *
 * -----------------------------------------------------------------------
 * 8. No student/team linkage on `AuthUser` yet -- a real gap, disclosed and
 *    stood in for, not silently assumed (same class of gap `MeetingsList.tsx`/
 *    `OutreachList.tsx` already documented for `PLACEHOLDER_CURRENT_STUDENT_ID`).
 *
 * `AuthUser` (`guards.tsx`) carries only `{id, email, role}` -- no linkage to
 * which team(s) a coach/admin actually manages. `PLACEHOLDER_CURRENT_TEAM_ID`
 * below is a disclosed stand-in for "the one team this Coach/Admin Home is
 * currently scoped to" (every KPI, Next up row, Recent signups entry, and
 * check-in candidate on this page is scoped to it via `isEventInTeamScope`,
 * which correctly honors `event.team_ids === null` as "all teams" per the
 * real schema). A real implementation would resolve this from a future
 * coach-team-assignment data source and/or a team switcher, once one exists.
 *
 * -----------------------------------------------------------------------
 * 9. No shared Supabase client wired in yet (Known Context/Traps #6) -- same
 *    posture as every prior content page in this batch.
 *
 * `loadData` is the injectable seam (`(seasonId) => Promise<CoachHomeData>`),
 * defaulting to the OBVIOUSLY-FAKE `defaultLoadCoachHomeData` (fabricated
 * names only, constitution item 6). A real implementation, once a shared
 * Supabase client exists (a separate, not-yet-dispatched task per every
 * sibling task's identical disclosure), would query `v_team_participation`/
 * `v_student_hours`/`teams`/`students`/`events`/`event_sessions`/`rsvps`/
 * `attendance` directly.
 *
 * -----------------------------------------------------------------------
 * 10. Deliberate stubs (per Forbidden Files -- disclosed, not silently built
 *     as if real):
 *
 *    a. "New outreach event" button -- `OutreachEventDialog.tsx` is T039's
 *       (currently Blocked) deliverable, a forbidden file here. Real,
 *       visible, clickable button; `onClick` shows an inline `Banner`
 *       disclosure, same pattern `OutreachList.tsx`/`MeetingsList.tsx`
 *       already established for their own out-of-scope actions.
 *    b. `StudentHomeSlot.tsx` (T008) is a Student-Home-scoped component
 *       (its own module doc: "reserved for T054's later use") -- not
 *       imported or referenced anywhere in this file, per this task's
 *       Forbidden Files.
 *
 * T111 UPDATE: the "Season setup" card's "Go to season setup" button (item
 * `b` above, formerly) was a disclosed stub only because `/settings/season`
 * itself didn't exist yet. T108 (already-Passed) has since routed
 * `/settings/season` to the real, fully-built `SeasonSettings.tsx`, so this
 * is no longer a stub: `onClick` now does a real
 * `navigate(routePaths.settingsSeason)`, mirroring module doc #5's
 * "Start check-in" `useNavigate()`/`routePaths.kioskSession(...)` pattern in
 * this same file. `router.tsx` remains a forbidden/read-only file here;
 * `routePaths.settingsSeason` is an import-only reference to its
 * already-exported constant, same posture module doc #5 already established
 * for `routePaths.kioskSession`.
 *
 * -----------------------------------------------------------------------
 * 11. DES-12 four states.
 *
 * Not-signed-in (`user === null`, a plain sign-in prompt) / loading
 * (T081: `Skeleton`, previewing the known KPI-card-grid + "Next up"-list
 * shape, while `loadData` is pending -- replacing the prior `Spinner` per
 * Astryx's own guidance since this dashboard's dimensions are predictable)
 * / error (`loadData` rejects --
 * `Banner status="error"`) / populated (KPI `Grid`, Next up, Recent
 * signups, admin-gated Season setup card). "Empty" (zero sessions/RSVPs at
 * all) is not a separate top-level branch -- HOME-01's KPI cards and
 * actions are meaningful even at zero (e.g. "0 events in next 7 days");
 * each of "Next up" / "Recent signups" independently falls back to its own
 * `EmptyState` when its own list is empty, the same per-section-empty
 * pattern `OutreachList.tsx`/`MeetingsList.tsx` already established for
 * their Upcoming/Past sections.
 *
 * -----------------------------------------------------------------------
 * 12. Astryx prop sourcing (constitution item 2) -- every prop used below,
 *     cross-checked against `docs/swarm/astryx-api.md` directly (line
 *     numbers as of this task's read):
 *
 *  - `Layout` (line 167 section, Props table): `height`, `content` used.
 *  - `LayoutContent`: doc's own "Components > LayoutContent" subsection is
 *    `undefined` (same disclosed CLI-cross-checked gap as `Heading`/
 *    `ListItem` below); the real template's own literal usage
 *    (`<LayoutContent padding={6}>`, read live via
 *    `npm run astryx -- template dashboard`) is the source for the one prop
 *    used, `padding`.
 *  - `Grid` (line 98 section, Props table): `columns`, `gap` used, matching
 *    the template's own literal `columns={{minWidth: 320, repeat: 'fit'}}`.
 *  - `Card` (line 2935 section, Props table): `children` only (default
 *    `variant`/`padding`) used.
 *  - `Divider` (line 543 section, Props table): no props used (default
 *    `orientation`/`variant`).
 *  - `Heading`: doc's own "Components > Heading" subsection is `undefined`
 *    (same disclosed gap `RosterShell.tsx`/T021, `MeetingsList.tsx`/T030,
 *    `OutreachList.tsx`/T038 already hit); `npm run astryx -- component
 *    Heading --json` (run live for this task) resolves `level` (1-6,
 *    required) + `children` (required) -- only those two used.
 *  - `Text` (line 829 section, Props table): `type` (`'supporting'`),
 *    `color` used.
 *  - `VStack`/`HStack` ("Stack" section, `VStack`/`HStack` subsections):
 *    `gap`, `hAlign`, `vAlign`, `wrap`, `justify` used.
 *  - `Button` (line 1768 section, Props table): `label`, `variant`,
 *    `onClick` used. Real doc-gap found and cross-checked (constitution
 *    item 2's mandated cross-check): the doc's own Example block shows
 *    `<Button label="Visit site" href="https://example.com" .../>`, but
 *    Button's own Props table has NO `href`/`target`/`rel` row, and
 *    `npm run astryx -- component Button --json` (run live) likewise
 *    returns no `href` prop -- confirmed absent from BOTH the doc's table
 *    and the installed CLI, so per constitution item 2 ("a prop absent from
 *    that file is presumed hallucinated") `href` is treated as NOT a real
 *    Button prop here. "Start check-in" therefore uses a plain `onClick` +
 *    `useNavigate()` (react-router-dom), not `Button href`.
 *  - `Badge` (line 493 section, Props table): `variant`
 *    (`'blue'|'purple'|'teal'`, category-tag usage per the doc's own "Do:
 *    use color variants for category tags that group or classify items" --
 *    session TYPE is a category, not a system status, so the semantic
 *    success/warning/error variants are deliberately not used here), `label`
 *    used. RSVP/roster counts render as plain `Text type="supporting"`, NOT
 *    `Badge`, per the doc's own "Don't: use badges for metadata... counts...
 *    use description text instead" guidance.
 *  - `Banner` (line 2694 section, Props table): `status`, `title`,
 *    `description`, `isDismissable`, `onDismiss` used.
 *  - `EmptyState` (line 3954 section, Props table): `title` (required),
 *    `description`, `headingLevel` used.
 *  - `List`/`ListItem` (line 4536 section): `List`'s Props table
 *    (`children`, `hasDividers`, `header`) used directly. `ListItem`'s own
 *    subsection is `undefined`; `npm run astryx -- component ListItem
 *    --json` (run live) resolves `label` (required), `description`,
 *    `endContent` -- only those three used (no `onClick`/`href` -- rows are
 *    not interactive).
 *  - `ProgressBar` (line 5416 section, Props table): `label` (required),
 *    `value`, `max`, `isLabelHidden`, `hasValueLabel`, `formatValueLabel`
 *    used.
 *  - `Skeleton` (T081, "Skeleton" section, lines 621-655): `width`,
 *    `height`, `index` used to preview this dashboard's fixed, always-
 *    present KPI-card grid + "Next up" list shape, replacing `Spinner`'s
 *    prior use here per Astryx's own guidance (known-dimension content).
 *    `VisuallyHidden` + the wrapping `VStack`'s `aria-busy` carry the
 *    "Loading Home…" announcement `Spinner`'s `label` used to provide.
 *  - `Toast` (line 5998 section) -- same real, already-disclosed doc-gap
 *    `OutreachList.tsx`/T038 found and cross-checked against the INSTALLED
 *    source (`node_modules/@astryxdesign/core/dist/Toast/Toast.d.ts`): the
 *    doc's own Props table lists `uniqueID`/`collisionBehavior`/`onHide` as
 *    if they belonged to bare `<Toast>`, but those belong to the separate
 *    `ToastOptions` type `useToast()` accepts. Only the installed-source-
 *    verified real `<Toast>` props are used here: `body` (required), `type`,
 *    `isAutoHide` (required), `autoHideDuration` (required), `onDismiss`
 *    (required, not `onHide`). No `ToastViewport`/`useToast()` exists
 *    anywhere in this app yet (confirmed via grep, same as `OutreachList.tsx`
 *    already found) -- `<Toast>` is rendered directly in normal document
 *    flow, same as that file.
 *
 * -----------------------------------------------------------------------
 * 13. T124 (PRD v2 UXP-06/UXP-10, UXD-07 "Dashboard analytics parity") --
 *     secondary stat tiles, per-student goal projection, hours-by-team,
 *     top-events-by-hours, and a replacement activity feed. This section
 *     documents the additions; sections 1-12 above describe the
 *     PRE-EXISTING (T053) page this task adds onto, untouched.
 *
 * (a) Binding reference + scope decision. The capability map's "Dashboard"
 *     figure (`docs/swarm/current-app-capability-map.html` line 75's
 *     screenshot, decoded and viewed directly for this task) shows these
 *     five widgets as ONE combined-program view -- team badges appear
 *     PER-ROW inside a single goal-projection list (not two separately
 *     team-scoped lists), "Hours by team" is explicitly a cross-team
 *     comparison, and "Top events" carries no team dimension at all. This
 *     is consistent with D-2's own framing ("P3 + GG = VOLT ... reporting
 *     will handle the team metrics") and D-3's "personal numbers count
 *     once" half. All five new widgets below are therefore SEASON-scoped
 *     only, never filtered by this file's existing
 *     `PLACEHOLDER_CURRENT_TEAM_ID` (module doc #8) -- a disclosed,
 *     deliberate divergence from the PRE-EXISTING primary KPI grid / Next
 *     up / check-in / season-setup card, which remain team-scoped and
 *     UNCHANGED by this task (Required Output's own "keep the existing
 *     next-up/check-in/season-setup cards" instruction). See
 *     `supabase/migrations/20260723000001_dashboard_views.sql`'s own header
 *     comment for the same reasoning stated from the SQL side.
 *
 * (b) Constitution item 3 -- `../../lib/supabase/loaders/dashboard.ts`'s own
 *     module doc #1 documents the nine new SQL views (nine, since T116's
 *     `v_team_hours` is consumed unmodified, no tenth view for "hours by
 *     team" per the worker packet's explicit instruction) that own every
 *     percentage/sum/average/day-of-week-bucketing computation below. Every
 *     pure function in THIS file that touches dashboard data is a
 *     sort/slice/filter/format transform over those already-computed
 *     numbers (T044's `Leaderboard.tsx` precedent), with exactly ONE
 *     disclosed exception matching an ALREADY-ESTABLISHED idiom in this
 *     same file: `goalProjectionPercent`/`goalProjectionShortHours` divide
 *     two already-real, already-SQL-sourced numbers
 *     (`confirmedHours + plannedHours` vs. `goalHours`, both straight off
 *     `v_student_goal_projection`), the identical "UI-side percent math, no
 *     metric-view equivalent to duplicate" idiom this file's own
 *     `hoursVsGoalPercent` (module doc #4) already established for the
 *     PRE-EXISTING team-hours-goal bar -- not a second SQL view for a
 *     trivial division, not a re-derivation of anything already computed.
 *
 * (c) Astryx doc-vs-PRD tension, disclosed (constitution item 13/2): UXD-07's
 *     literal text asks for a "stacked confirmed + planned vs. goal line"
 *     bar. `ProgressBar`'s own doc (cross-checked live via
 *     `npm run astryx -- component ProgressBar --json` for this task)
 *     explicitly states, in its own "Best Practices": "Don't: Use multiple
 *     progress bars stacked together for the same operation; use one bar
 *     with a value label instead" -- there is no two-segment/stacked-fill
 *     prop anywhere in the real, installed component. Per constitution item
 *     13 (templates/components are used as-is, never invented past their
 *     real prop surface), `GoalProjectionRow` below renders exactly ONE real
 *     `ProgressBar` per student (`value = confirmedHours`, `max = goalHours`
 *     -- the same "confirmed vs. goal" semantics `HoursTab.tsx`'s own
 *     already-shipped per-student `ProgressBar` uses, read read-only for
 *     this task as the closest in-repo precedent), plus a plain `Text` line
 *     stating the full fact set the figure's own annotation shows
 *     (`"{confirmed}h confirmed + {planned}h planned = {total}h / {goal}h ·
 *     {percent}% · {status}"`). This conveys every fact UXD-07 requires
 *     (confirmed, planned, goal, on-track/short) through real, doc-verified
 *     components, without fabricating a stacked-fill bar the installed
 *     library does not support -- a disclosed, judgment-call substitution
 *     for the PRD's literal visual wording, not a silent scope-drop of the
 *     underlying DATA requirement (every number the figure shows is
 *     present). "Hours by team" and "Top events by student hours" are
 *     comparison-style bars, not "vs. goal" bars, and do not hit this same
 *     Don't -- each renders ONE real `ProgressBar` per row scaled against
 *     the largest value in its own list (a disclosed, presentation-only
 *     `Math.max` over already-fetched numbers, never a displayed metric
 *     itself -- see `maxOf` below), matching the figure's own bar-chart
 *     pattern faithfully.
 *
 * (d) Activity feed (UXP-10) REPLACES the PRE-EXISTING "Recent signups"
 *     section (module doc #9's old `buildRecentSignups`/`RecentSignupEntry`/
 *     `RSVP_VERB`, all REMOVED by this task), not added alongside it.
 *     UXP-10's own feed is a strict superset of what "Recent signups" did
 *     (future-outreach RSVP changes only, no self/staff label, no
 *     attendance/check-off entries) -- keeping both would be exactly the
 *     "duplicated ... for one concept" anti-pattern UXD-05(a) names,
 *     applied to two list SECTIONS instead of two headings for the same
 *     single metric. The Required Output's own "keep the existing
 *     next-up/check-in/season-setup cards" list deliberately does not name
 *     Recent signups, read as a disclosed, deliberate omission rather than
 *     an oversight, given UXP-10's explicit, much broader requirement.
 *
 * (e) Self-vs-staff origin (Trap #2, BLOCKER-class motivation-ethics
 *     posture) -- `isSelfOriginated` below compares `rsvps.responded_by` /
 *     `attendance.recorded_by` (a real `profiles.id`) against that
 *     student's OWN `students.profile_id` (nullable -- a student with no
 *     account yet can never self-originate a row, correctly falls through
 *     to "staff"). This is a plain equality check on two already-fetched
 *     foreign-key ids (not metric math, module doc (b) above) -- the same
 *     category of raw-row comparison this file's own PRE-EXISTING
 *     `isEventInTeamScope` already performs. Only a real "Self" `Badge` is
 *     ever rendered (module doc's own figure reading: the reference app
 *     shows a "Self" badge and no visually-distinct "Staff" badge at all) --
 *     never a ranking, a name-and-shame framing, or any read-receipt
 *     (constitution motivation-ethics rule, BLOCKER-class, users are
 *     minors): `buildActivityFeed` renders WHAT happened and WHEN, never WHO
 *     is behind on hours relative to a peer, and there is no per-entry "seen
 *     by" or acknowledgment affordance anywhere in this file.
 *
 * (f) Hard-delete feed limitation (Trap #3, D-7) -- disclosed a THIRD time
 *     here (also in the migration's own header and `dashboard.ts`'s own
 *     module doc #2): `attendance.ts`'s real `makeRemoveAttendance` and the
 *     event-edit checklist's own RSVP-uncheck path (D-7, "the checklist
 *     wins") are unconditional DELETEs with no history left behind. This
 *     file does NOT add a tracking table or a status-transition column to
 *     recover that history (worker packet's explicit instruction) --
 *     `buildActivityFeed` is built from CURRENT `rsvps`/`attendance` rows
 *     only, so a coach-driven removal is honestly invisible (never
 *     fabricated as a "dropped" entry). A student/parent's OWN self-service
 *     RSVP change (`RsvpControl.tsx`/OUT-03, a real status UPDATE, never a
 *     delete) remains genuinely feed-visible: `wasRsvpChanged` below uses
 *     the row's own `createdAt` vs. `updatedAt` gap (with a small clock-skew
 *     epsilon -- `loaders/outreach.ts`'s real upsert calls, read read-only
 *     for this task, confirmed `updated_at` is explicitly set on every write
 *     while `created_at` is left to the column's own `default now()`, so a
 *     genuine value CHANGE bumps `updated_at` measurably past `created_at`,
 *     while a first-ever write leaves the two only microseconds apart) to
 *     distinguish an honest "dropped" (was something else, now
 *     `'declined'`) from an honest "declined" (the student's very first
 *     response was already `'declined'` -- never actually "dropped"
 *     anything). Both are real, distinct, disclosed labels; neither is
 *     guessed.
 *
 * (g) Goal source (Trap #4) -- `v_student_goal_projection`'s own `goal_hours`
 *     column is `coalesce(students.goal_hours_override,
 *     seasons.default_goal_hours)`, both real columns (migration heading 9)
 *     -- `StudentGoalProjectionEntry.goalHours` is a verbatim passthrough,
 *     never recomputed here. "Planned" is future `'going'` RSVP hours,
 *     computed once in `v_planned_rsvp_hours` (migration heading 1) and
 *     read here via `v_student_goal_projection`'s own `planned_hours`
 *     column -- this file never touches `rsvps`/`event_sessions` directly
 *     for this number.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Badge,
  Banner,
  Button,
  Card,
  Divider,
  EmptyState,
  Grid,
  Heading,
  HStack,
  Layout,
  LayoutContent,
  List,
  ListItem,
  ProgressBar,
  SegmentedControl,
  SegmentedControlItem,
  Skeleton,
  Text,
  Toast,
  VisuallyHidden,
  VStack,
} from '@astryxdesign/core';
import { useAuth } from '../../app/guards';
import { routePaths } from '../../app/router';
import {
  loadDashboardData,
  type ActivityFeedSource,
  type DashboardData,
  type EventStudentHoursEntry,
  type FeedRsvpRow,
  type LoadDashboardDataFn,
  type SeasonDayOfWeekSessions,
  type StudentGoalProjectionEntry,
  type TeamHoursEntry,
} from '../../lib/supabase/loaders/dashboard';

// ---------------------------------------------------------------------------
// Types -- verbatim camelCase renames of real columns/views. Module docs #3/#4.
// ---------------------------------------------------------------------------

export type EventType = 'meeting' | 'outreach' | 'competition';
export type SessionStatus = 'scheduled' | 'completed' | 'canceled';
export type RsvpStatus = 'going' | 'maybe' | 'declined';
export type AttendanceStatus = 'present' | 'late' | 'excused' | 'absent';

type BadgeVariant =
  | 'neutral'
  | 'info'
  | 'success'
  | 'warning'
  | 'error'
  | 'blue'
  | 'cyan'
  | 'green'
  | 'orange'
  | 'pink'
  | 'purple'
  | 'red'
  | 'teal'
  | 'yellow';

export interface HomeTeamRow {
  id: string;
  name: string;
}

export interface HomeStudentRow {
  id: string;
  displayName: string;
  teamId: string;
  isActive: boolean;
  goalHoursOverride: number | null;
}

export interface HomeEventRow {
  id: string;
  seasonId: string;
  type: EventType;
  title: string;
  /** `null` = all teams, per `events.team_ids` (module doc #3). */
  teamIds: readonly string[] | null;
}

export interface HomeSessionRow {
  id: string;
  eventId: string;
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
}

export interface HomeRsvpRow {
  id: string;
  sessionId: string;
  studentId: string;
  status: RsvpStatus;
  updatedAt: string;
}

interface HomeAttendanceRow {
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
}

/** Verbatim camelCase rename of `v_team_participation`'s three real columns
 * (module doc #4, MET-02). Never recomputed in this file. */
export interface TeamParticipationMetric {
  teamId: string;
  seasonId: string;
  participationPct: number;
}

/** Verbatim camelCase rename of `v_student_hours`'s three real columns
 * (module doc #4, feeds MET-04). `confirmedHours` is never recomputed from
 * raw attendance in this file -- only summed across a roster. */
export interface StudentHoursMetric {
  studentId: string;
  seasonId: string;
  confirmedHours: number;
}

/** A plain per-session tally (module doc #4 -- NOT a percentage), same kind
 * of value as `MeetingsList.tsx`'s `PastAttendanceSummary`. */
export interface LastCompletedMeetingSummary {
  sessionId: string;
  title: string;
  presentCount: number;
  lateCount: number;
  excusedCount: number;
  absentCount: number;
  /** Count of active students on the team this session belongs to. */
  rosterSize: number;
}

/** Disclosed UI-only placeholder (module doc #6) -- no "season goal
 * configuration" flag exists in the real schema distinct from
 * `default_goal_hours`/`goal_hours_override` themselves. */
export interface SeasonSetupStatus {
  hasGoalsConfigured: boolean;
}

export interface CoachHomeData {
  seasonId: string;
  defaultGoalHours: number;
  teams: readonly HomeTeamRow[];
  students: readonly HomeStudentRow[];
  events: readonly HomeEventRow[];
  sessions: readonly HomeSessionRow[];
  rsvps: readonly HomeRsvpRow[];
  attendance: readonly HomeAttendanceRow[];
  teamParticipation: TeamParticipationMetric | null;
  studentHours: readonly StudentHoursMetric[];
  seasonSetupStatus: SeasonSetupStatus;
}

export type LoadCoachHomeDataFn = (seasonId: string) => Promise<CoachHomeData>;

// ---------------------------------------------------------------------------
// Placeholder identifiers -- module doc #8.
// ---------------------------------------------------------------------------

export const PLACEHOLDER_CURRENT_TEAM_ID = 'team-placeholder-current-viewer';
const PLACEHOLDER_SEASON_ID = 'season-placeholder-current';

// ---------------------------------------------------------------------------
// Fixture data (constitution item 6: fabricated names only). Module doc #9.
// ---------------------------------------------------------------------------

const FIXTURE_TEAMS: readonly HomeTeamRow[] = [
  { id: PLACEHOLDER_CURRENT_TEAM_ID, name: 'Ravens' },
  { id: 'team-titans', name: 'Titans' },
];

const FIXTURE_STUDENTS: readonly HomeStudentRow[] = [
  {
    id: 'student-amara-webb',
    displayName: 'Amara Webb',
    teamId: PLACEHOLDER_CURRENT_TEAM_ID,
    isActive: true,
    goalHoursOverride: null,
  },
  {
    id: 'student-cole-jennings',
    displayName: 'Cole Jennings',
    teamId: PLACEHOLDER_CURRENT_TEAM_ID,
    isActive: true,
    goalHoursOverride: 8,
  },
  {
    id: 'student-priya-patel',
    displayName: 'Priya Patel',
    teamId: PLACEHOLDER_CURRENT_TEAM_ID,
    isActive: true,
    goalHoursOverride: null,
  },
  {
    id: 'student-jordan-cole',
    displayName: 'Jordan Cole',
    teamId: PLACEHOLDER_CURRENT_TEAM_ID,
    isActive: true,
    goalHoursOverride: null,
  },
  // Inactive -- must drop out of every roster-scoped sum/count below, per
  // the metric views' own "activity is the current is_active boolean"
  // implementation note (20260717000003_metric_views.sql line 1).
  {
    id: 'student-devon-marsh',
    displayName: 'Devon Marsh',
    teamId: PLACEHOLDER_CURRENT_TEAM_ID,
    isActive: false,
    goalHoursOverride: null,
  },
  // Different team entirely -- proves team-scope exclusion (module doc #8).
  {
    id: 'student-nina-ortiz',
    displayName: 'Nina Ortiz',
    teamId: 'team-titans',
    isActive: true,
    goalHoursOverride: null,
  },
];

const FIXTURE_EVENTS: readonly HomeEventRow[] = [
  {
    id: 'event-weekly-build',
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'meeting',
    title: 'Weekly Build Meeting',
    teamIds: null, // all teams
  },
  {
    id: 'event-food-bank-sort',
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'outreach',
    title: 'Community Food Bank Sort',
    teamIds: [PLACEHOLDER_CURRENT_TEAM_ID],
  },
  {
    id: 'event-regionals-qualifier',
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'competition',
    title: 'Regionals Qualifier',
    teamIds: [PLACEHOLDER_CURRENT_TEAM_ID],
  },
  // Deliberately Titans-only -- proves team-scope exclusion everywhere
  // below (Next up, events-in-7-days, check-in, recent signups).
  {
    id: 'event-titans-meeting',
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'meeting',
    title: 'Titans Strategy Session',
    teamIds: ['team-titans'],
  },
  {
    id: 'event-titans-outreach',
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'outreach',
    title: 'Titans Bake Sale',
    teamIds: ['team-titans'],
  },
];

// Fixed reference instant the shipped fixture data is authored around
// (matches this task's real sandbox date, 2026-07-19). Component/page
// consumers pass their own `nowFn`; tests pass this exact instant so the
// shipped fixture's "live"/"within 7 days"/"recent" claims are provably
// correct rather than incidentally true only while the calendar agrees.
export const FIXTURE_REFERENCE_NOW = new Date('2026-07-19T12:00:00.000Z');

const FIXTURE_SESSIONS: readonly HomeSessionRow[] = [
  {
    id: 'session-build-completed-past',
    eventId: 'event-weekly-build',
    startsAt: '2026-07-15T23:00:00.000Z',
    endsAt: '2026-07-16T01:00:00.000Z',
    status: 'completed',
  },
  // Live relative to FIXTURE_REFERENCE_NOW (started 30 min ago, ends in 90
  // min) -- the one session `selectCheckInSession` must return.
  {
    id: 'session-build-live-now',
    eventId: 'event-weekly-build',
    startsAt: '2026-07-19T11:30:00.000Z',
    endsAt: '2026-07-19T13:30:00.000Z',
    status: 'scheduled',
  },
  {
    id: 'session-food-bank-upcoming',
    eventId: 'event-food-bank-sort',
    startsAt: '2026-07-19T14:00:00.000Z', // +2h -- within next 7 days
    endsAt: '2026-07-19T17:00:00.000Z',
    status: 'scheduled',
  },
  {
    id: 'session-food-bank-completed-past',
    eventId: 'event-food-bank-sort',
    startsAt: '2026-07-05T14:00:00.000Z',
    endsAt: '2026-07-05T17:00:00.000Z',
    status: 'completed',
  },
  {
    id: 'session-regionals-upcoming',
    eventId: 'event-regionals-qualifier',
    startsAt: '2026-07-24T15:00:00.000Z', // +5d -- within next 7 days
    endsAt: '2026-07-24T20:00:00.000Z',
    status: 'scheduled',
  },
  {
    id: 'session-build-far-future',
    eventId: 'event-weekly-build',
    startsAt: '2026-08-10T23:00:00.000Z', // >7 days out
    endsAt: '2026-08-11T01:00:00.000Z',
    status: 'scheduled',
  },
  // Titans-only -- starts in 30 min (would be check-in-eligible on time
  // alone) but must be excluded everywhere by team scope.
  {
    id: 'session-titans-meeting',
    eventId: 'event-titans-meeting',
    startsAt: '2026-07-19T12:30:00.000Z',
    endsAt: '2026-07-19T14:30:00.000Z',
    status: 'scheduled',
  },
  {
    id: 'session-titans-outreach-upcoming',
    eventId: 'event-titans-outreach',
    startsAt: '2026-07-21T12:00:00.000Z',
    endsAt: '2026-07-21T15:00:00.000Z',
    status: 'scheduled',
  },
];

const FIXTURE_RSVPS: readonly HomeRsvpRow[] = [
  {
    id: 'rsvp-amara-going',
    sessionId: 'session-food-bank-upcoming',
    studentId: 'student-amara-webb',
    status: 'going',
    updatedAt: '2026-07-19T10:00:00.000Z', // 2h before reference now
  },
  {
    id: 'rsvp-priya-maybe',
    sessionId: 'session-food-bank-upcoming',
    studentId: 'student-priya-patel',
    status: 'maybe',
    updatedAt: '2026-07-19T11:15:00.000Z', // 45m before reference now
  },
  {
    id: 'rsvp-jordan-declined',
    sessionId: 'session-food-bank-upcoming',
    studentId: 'student-jordan-cole',
    status: 'declined',
    updatedAt: '2026-07-16T12:00:00.000Z', // 3d before reference now
  },
  // Wrong session TYPE (meeting, not outreach) -- must never appear in
  // Recent signups.
  {
    id: 'rsvp-cole-on-meeting',
    sessionId: 'session-build-live-now',
    studentId: 'student-cole-jennings',
    status: 'going',
    updatedAt: '2026-07-19T11:00:00.000Z',
  },
  // Session is not FUTURE (already completed) -- must never appear.
  {
    id: 'rsvp-devon-on-past-outreach',
    sessionId: 'session-food-bank-completed-past',
    studentId: 'student-devon-marsh',
    status: 'going',
    updatedAt: '2026-07-05T13:00:00.000Z',
  },
  // Wrong TEAM scope (Titans outreach) -- must never appear.
  {
    id: 'rsvp-nina-on-titans-outreach',
    sessionId: 'session-titans-outreach-upcoming',
    studentId: 'student-nina-ortiz',
    status: 'going',
    updatedAt: '2026-07-19T09:00:00.000Z',
  },
];

const FIXTURE_ATTENDANCE: readonly HomeAttendanceRow[] = [
  // session-build-completed-past: 2 present, 1 late, 1 absent -- (2+1)/4 = 75%.
  { sessionId: 'session-build-completed-past', studentId: 'student-amara-webb', status: 'present' },
  {
    sessionId: 'session-build-completed-past',
    studentId: 'student-cole-jennings',
    status: 'present',
  },
  { sessionId: 'session-build-completed-past', studentId: 'student-priya-patel', status: 'late' },
  { sessionId: 'session-build-completed-past', studentId: 'student-jordan-cole', status: 'absent' },
];

/** Pre-computed `v_team_participation` row (module doc #4) -- never
 * recomputed by this file. */
const FIXTURE_TEAM_PARTICIPATION: readonly TeamParticipationMetric[] = [
  { teamId: PLACEHOLDER_CURRENT_TEAM_ID, seasonId: PLACEHOLDER_SEASON_ID, participationPct: 82.4 },
];

/** Pre-computed `v_student_hours` rows (module doc #4) -- never recomputed
 * by this file. Jordan deliberately has no row (no completed
 * counts_volunteer_hours sessions yet), the same "absence, not a fabricated
 * 0" convention `v_student_participation`'s own migration note describes. */
const FIXTURE_STUDENT_HOURS: readonly StudentHoursMetric[] = [
  { studentId: 'student-amara-webb', seasonId: PLACEHOLDER_SEASON_ID, confirmedHours: 6 },
  { studentId: 'student-cole-jennings', seasonId: PLACEHOLDER_SEASON_ID, confirmedHours: 4 },
  { studentId: 'student-priya-patel', seasonId: PLACEHOLDER_SEASON_ID, confirmedHours: 2 },
];

const FIXTURE_DEFAULT_GOAL_HOURS = 10;

const FIXTURE_SEASON_SETUP_STATUS: SeasonSetupStatus = { hasGoalsConfigured: false };

// ---------------------------------------------------------------------------
// Pure functions -- exported for direct testing.
// ---------------------------------------------------------------------------

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** The ONLY team-scope predicate in this file -- honors `team_ids === null`
 * as "all teams" per the real `events` schema (module doc #3/#8). */
export function isEventInTeamScope(
  event: { teamIds: readonly string[] | null },
  teamId: string,
): boolean {
  return event.teamIds === null || event.teamIds.includes(teamId);
}

/** MET-04's denominator (module doc #4): active roster only,
 * `goal_hours_override ?? default_goal_hours`, summed. */
export function sumGoalHours(
  students: readonly HomeStudentRow[],
  teamId: string,
  defaultGoalHours: number,
): number {
  return round1(
    students
      .filter((student) => student.teamId === teamId && student.isActive)
      .reduce((sum, student) => sum + (student.goalHoursOverride ?? defaultGoalHours), 0),
  );
}

/** Sums already-computed `v_student_hours.confirmed_hours` values across the
 * active roster (module doc #4) -- never recomputes an individual student's
 * hours. */
export function sumConfirmedHours(
  students: readonly HomeStudentRow[],
  teamId: string,
  hoursRows: readonly StudentHoursMetric[],
): number {
  const activeIds = new Set(
    students.filter((student) => student.teamId === teamId && student.isActive).map((s) => s.id),
  );
  return round1(
    hoursRows
      .filter((row) => activeIds.has(row.studentId))
      .reduce((sum, row) => sum + row.confirmedHours, 0),
  );
}

/** UI-side percent math, no metric-view equivalent to duplicate (module doc
 * #4) -- same idiom `OutreachList.tsx`'s `confirmedPercent` established. */
export function hoursVsGoalPercent(confirmedHours: number, goalHours: number): number {
  if (goalHours <= 0) return 0;
  return Math.min(100, round1((confirmedHours / goalHours) * 100));
}

export const GOAL_MILESTONES = [25, 50, 75, 100] as const;
export type GoalMilestone = (typeof GOAL_MILESTONES)[number];

export function crossedMilestones(percent: number): GoalMilestone[] {
  return GOAL_MILESTONES.filter((milestone) => percent >= milestone);
}

/** A plain per-session tally (module doc #4) -- picks the most recent
 * completed meeting-type session in team scope and counts each attendance
 * status. Returns `null` when no completed meeting exists yet for this team. */
export function buildLastCompletedMeetingSummary(
  sessions: readonly HomeSessionRow[],
  events: readonly HomeEventRow[],
  attendance: readonly HomeAttendanceRow[],
  students: readonly HomeStudentRow[],
  teamId: string,
): LastCompletedMeetingSummary | null {
  const meetingEventIds = new Set(
    events
      .filter((event) => event.type === 'meeting' && isEventInTeamScope(event, teamId))
      .map((e) => e.id),
  );
  const eventById = new Map(events.map((event) => [event.id, event] as const));

  const candidates = sessions
    .filter((session) => meetingEventIds.has(session.eventId) && session.status === 'completed')
    .sort((a, b) => b.startsAt.localeCompare(a.startsAt));

  const latest = candidates[0];
  if (!latest) return null;

  const records = attendance.filter((record) => record.sessionId === latest.id);
  const rosterSize = students.filter(
    (student) => student.teamId === teamId && student.isActive,
  ).length;

  return {
    sessionId: latest.id,
    title: eventById.get(latest.eventId)?.title ?? 'Untitled meeting',
    presentCount: records.filter((r) => r.status === 'present').length,
    lateCount: records.filter((r) => r.status === 'late').length,
    excusedCount: records.filter((r) => r.status === 'excused').length,
    absentCount: records.filter((r) => r.status === 'absent').length,
    rosterSize,
  };
}

/** A NEW, disclosed, distinct ratio (module doc #4) -- deliberately NOT
 * MET-01/02's excused-exclusion formula. `null` when the roster is empty. */
export function attendanceRatePercent(summary: LastCompletedMeetingSummary): number | null {
  if (summary.rosterSize <= 0) return null;
  return round1(((summary.presentCount + summary.lateCount) / summary.rosterSize) * 100);
}

/** Counts scheduled, team-scoped sessions of ANY type starting within the
 * next `days` days (inclusive), not yet started. */
export function countUpcomingSessionsInNextDays(
  sessions: readonly HomeSessionRow[],
  events: readonly HomeEventRow[],
  teamId: string,
  nowMs: number,
  days = 7,
): number {
  const inScopeEventIds = new Set(
    events.filter((event) => isEventInTeamScope(event, teamId)).map((event) => event.id),
  );
  const windowEndMs = nowMs + days * 24 * 60 * 60 * 1000;
  return sessions.filter((session) => {
    if (session.status !== 'scheduled' || !inScopeEventIds.has(session.eventId)) return false;
    const startMs = new Date(session.startsAt).getTime();
    return startMs >= nowMs && startMs <= windowEndMs;
  }).length;
}

export interface NextUpRow {
  sessionId: string;
  title: string;
  type: EventType;
  startsAt: string;
  endsAt: string;
  goingCount: number;
}

/** Next 5 sessions (any type, any status still relevant -- live or
 * scheduled and not yet ended), team-scoped, sorted ascending by start time. */
export function buildNextUp(
  sessions: readonly HomeSessionRow[],
  events: readonly HomeEventRow[],
  rsvps: readonly HomeRsvpRow[],
  teamId: string,
  nowMs: number,
  limit = 5,
): NextUpRow[] {
  const eventById = new Map(
    events
      .filter((event) => isEventInTeamScope(event, teamId))
      .map((event) => [event.id, event] as const),
  );
  return sessions
    .filter((session) => {
      if (session.status !== 'scheduled' || !eventById.has(session.eventId)) return false;
      return new Date(session.endsAt).getTime() >= nowMs;
    })
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
    .slice(0, limit)
    .map((session) => {
      const event = eventById.get(session.eventId);
      const goingCount = rsvps.filter(
        (r) => r.sessionId === session.id && r.status === 'going',
      ).length;
      return {
        sessionId: session.id,
        title: event?.title ?? 'Untitled event',
        type: event?.type ?? 'meeting',
        startsAt: session.startsAt,
        endsAt: session.endsAt,
        goingCount,
      };
    });
}

/**
 * "Start check-in" boundary rule (module doc #5): visible when the session
 * is currently live, or starts within the next 60 minutes (inclusive).
 * `status !== 'scheduled'` (completed/canceled) is never eligible.
 */
export function isSessionCheckInEligible(
  session: { startsAt: string; endsAt: string; status: SessionStatus },
  nowMs: number,
): boolean {
  if (session.status !== 'scheduled') return false;
  const startMs = new Date(session.startsAt).getTime();
  const endMs = new Date(session.endsAt).getTime();
  const isLive = nowMs >= startMs && nowMs <= endMs;
  const minutesUntilStart = (startMs - nowMs) / 60_000;
  const startsWithinSixtyMinutes = minutesUntilStart >= 0 && minutesUntilStart <= 60;
  return isLive || startsWithinSixtyMinutes;
}

/** The earliest eligible meeting-type session in team scope, or `null`. */
export function selectCheckInSession(
  sessions: readonly HomeSessionRow[],
  events: readonly HomeEventRow[],
  teamId: string,
  nowMs: number,
): HomeSessionRow | null {
  const meetingEventIds = new Set(
    events
      .filter((event) => event.type === 'meeting' && isEventInTeamScope(event, teamId))
      .map((e) => e.id),
  );
  const eligible = sessions
    .filter(
      (session) => meetingEventIds.has(session.eventId) && isSessionCheckInEligible(session, nowMs),
    )
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  return eligible[0] ?? null;
}

/** e.g. "Just now", "45m ago", "2h ago", "3d ago". */
export function formatRelativeTime(iso: string, nowMs: number): string {
  const diffMs = Math.max(0, nowMs - new Date(iso).getTime());
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// ---------------------------------------------------------------------------
// T124 activity feed (UXP-10) -- REPLACES the old `buildRecentSignups`/
// `RecentSignupEntry`/`RSVP_VERB` above (module doc #13(d)). Built from
// `dashboard.ts`'s raw `ActivityFeedSource` rows -- a plain join/format, no
// metric-view formula (module doc #13(b)).
// ---------------------------------------------------------------------------

export const ACTIVITY_FEED_DEFAULT_LIMIT = 10;

/**
 * Trap #2/module doc #13(e): a plain equality check on two already-fetched
 * `profiles.id` values, never a re-derivation of anything. `null` on either
 * side (no linked account, or an import-era row with no `responded_by`/
 * `recorded_by`) is always "not self" -- a row can only be self-originated
 * when BOTH the actor id and the student's own profile id are real and
 * equal.
 */
export function isSelfOriginated(
  actorProfileId: string | null,
  studentProfileId: string | null,
): boolean {
  return (
    actorProfileId !== null && studentProfileId !== null && actorProfileId === studentProfileId
  );
}

/**
 * Module doc #13(f): distinguishes a genuine "dropped" (the row changed
 * after creation, e.g. `'going' -> 'declined'`) from a first-ever response
 * that was already `'declined'`. `loaders/outreach.ts`'s real upsert calls
 * (read-only reference) always set `updated_at` explicitly while leaving
 * `created_at` to the column's own `default now()` -- on a genuine INSERT
 * the two land only milliseconds apart; `epsilonMs` (2s) absorbs that clock
 * skew without misreading a real same-second edit as "unchanged".
 */
export function wasRsvpChanged(row: FeedRsvpRow, epsilonMs = 2000): boolean {
  return new Date(row.updatedAt).getTime() - new Date(row.createdAt).getTime() > epsilonMs;
}

/** `event_sessions.session_date` is a plain SQL `date` (no time-of-day) --
 * formatted with an explicit `timeZone: 'UTC'` so the displayed calendar day
 * never shifts with the viewer's local timezone (a `date`-only string parsed
 * by `Date` is UTC-midnight; formatting in a negative-UTC-offset local zone
 * would otherwise silently roll it back a day). */
export function formatSessionDateLabel(sessionDate: string): string {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(sessionDate));
}

export interface ActivityFeedEntry {
  id: string;
  studentId: string;
  message: string;
  dateLabel: string;
  timeAgoLabel: string;
  /** Sort key only -- never rendered directly. */
  timestamp: string;
  isSelf: boolean;
}

/**
 * Every RSVP row (`'going'`/`'maybe'`/`'declined'`) plus every `'present'`/
 * `'late'` attendance row (module doc #13(a): "checked off" -- `'excused'`/
 * `'absent'` attendance rows are coach corrections, not a student "checking
 * off" anything, and are deliberately excluded), newest first by the row's
 * own `updatedAt`. `limit`/`"show all"` is the CALLER's job (a plain
 * `.slice`, T044 precedent) -- this function returns every eligible entry.
 */
export function buildActivityFeed(source: ActivityFeedSource, nowMs: number): ActivityFeedEntry[] {
  const sessionById = new Map(source.sessions.map((session) => [session.id, session] as const));
  const eventById = new Map(source.events.map((event) => [event.id, event] as const));
  const studentById = new Map(source.students.map((student) => [student.id, student] as const));

  const entries: ActivityFeedEntry[] = [];

  for (const rsvp of source.rsvps) {
    const session = sessionById.get(rsvp.sessionId);
    const event = session ? eventById.get(session.eventId) : undefined;
    if (!session || !event) continue; // orphaned row (should not happen) -- skip, never guess
    const student = studentById.get(rsvp.studentId);
    const studentName = student?.displayName ?? 'Someone';
    let verb: string;
    if (rsvp.status === 'going') verb = 'signed up for';
    else if (rsvp.status === 'maybe') verb = 'marked maybe for';
    else verb = wasRsvpChanged(rsvp) ? 'dropped' : 'declined';
    entries.push({
      id: `rsvp-${rsvp.id}`,
      studentId: rsvp.studentId,
      message: `${studentName} ${verb} ${event.title}`,
      dateLabel: formatSessionDateLabel(session.sessionDate),
      timeAgoLabel: formatRelativeTime(rsvp.updatedAt, nowMs),
      timestamp: rsvp.updatedAt,
      isSelf: isSelfOriginated(rsvp.respondedBy, student?.profileId ?? null),
    });
  }

  for (const record of source.attendance) {
    if (record.status !== 'present' && record.status !== 'late') continue;
    const session = sessionById.get(record.sessionId);
    const event = session ? eventById.get(session.eventId) : undefined;
    if (!session || !event) continue;
    const student = studentById.get(record.studentId);
    const studentName = student?.displayName ?? 'Someone';
    entries.push({
      id: `attendance-${record.id}`,
      studentId: record.studentId,
      message: `${studentName} checked off ${event.title}`,
      dateLabel: formatSessionDateLabel(session.sessionDate),
      timeAgoLabel: formatRelativeTime(record.updatedAt, nowMs),
      timestamp: record.updatedAt,
      isSelf: isSelfOriginated(record.recordedBy, student?.profileId ?? null),
    });
  }

  return entries.slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// ---------------------------------------------------------------------------
// T124 secondary stat tiles / hours-by-team / top-events / goal-projection --
// every function below is sort/slice/filter/format ONLY (module doc #13(b));
// the nine new SQL views already computed every number these touch.
// ---------------------------------------------------------------------------

const DAY_OF_WEEK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** ISO day-of-week (1=Monday..7=Sunday, `v_season_day_of_week_sessions`'s own
 * convention) -> a three-letter display label. A pure format transform, not
 * a re-derivation of the count itself. */
export function formatDayOfWeekLabel(dayOfWeek: number): string {
  return DAY_OF_WEEK_LABELS[dayOfWeek - 1] ?? '—';
}

/** Sort + take the max (T044 precedent) -- `null` when the season has no
 * sessions at all yet (absence, not a fabricated day). Ties break on the
 * LOWEST `dayOfWeek` (Monday-first) for a stable, deterministic pick. */
export function pickBusiestDay(
  rows: readonly SeasonDayOfWeekSessions[],
): SeasonDayOfWeekSessions | null {
  if (rows.length === 0) return null;
  const sorted = rows
    .slice()
    .sort((a, b) => b.sessionCount - a.sessionCount || a.dayOfWeek - b.dayOfWeek);
  return sorted[0];
}

/** Presentation-only `Math.max` for bar-chart relative scaling (module doc
 * #13(c)) -- never a displayed metric itself, only a `ProgressBar` `max`. */
export function maxOf(values: readonly number[]): number {
  return values.length === 0 ? 0 : Math.max(...values);
}

/** Descending by `confirmedHours`, ties broken by team name (T044
 * precedent: sort/slice over an already-computed number). */
export function sortTeamHoursDescending(rows: readonly TeamHoursEntry[]): TeamHoursEntry[] {
  return rows
    .slice()
    .sort((a, b) => b.confirmedHours - a.confirmedHours || a.teamName.localeCompare(b.teamName));
}

/** Descending by `totalHours`. */
export function sortEventsByHoursDescending(
  rows: readonly EventStudentHoursEntry[],
): EventStudentHoursEntry[] {
  return rows.slice().sort((a, b) => b.totalHours - a.totalHours);
}

/**
 * Module doc #13(b)/#4 (`hoursVsGoalPercent` precedent): a plain percent of
 * two already-real numbers, capped at a sane display ceiling never applied
 * to the underlying facts. `goalHours <= 0` guards the same way
 * `hoursVsGoalPercent` already does.
 */
export function goalProjectionPercent(row: StudentGoalProjectionEntry): number {
  if (row.goalHours <= 0) return 0;
  return round1(((row.confirmedHours + row.plannedHours) / row.goalHours) * 100);
}

/** `max(0, goal - confirmed - planned)` -- the annotation's "N h short"
 * half. `0` (not negative) once the goal is met or exceeded. */
export function goalProjectionShortHours(row: StudentGoalProjectionEntry): number {
  return Math.max(0, round1(row.goalHours - row.confirmedHours - row.plannedHours));
}

/**
 * Motivation-ethics BLOCKER-class posture (module doc #13(e), constitution):
 * states a fact, never guilt/urgency copy. "On track" once confirmed+planned
 * meets or exceeds goal; otherwise the exact remaining hours, nothing more.
 */
export function formatGoalProjectionAnnotation(row: StudentGoalProjectionEntry): string {
  const shortHours = goalProjectionShortHours(row);
  return shortHours <= 0 ? 'On track' : `${shortHours}h short`;
}

export type GoalProjectionFilter = 'all' | 'belowGoal';

/** Coach-facing triage, never a ranking/shame framing (Trap #2) -- a plain
 * boolean split on the same already-computed short-hours fact every row
 * already shows, not a new comparison between students. */
export function filterGoalProjectionRows(
  rows: readonly StudentGoalProjectionEntry[],
  filter: GoalProjectionFilter,
): StudentGoalProjectionEntry[] {
  if (filter === 'all') return rows.slice();
  return rows.filter((row) => goalProjectionShortHours(row) > 0);
}

/** Descending by projected percent (highest-first, matching the reference
 * figure's own row order), ties broken by name for stability. */
export function sortGoalProjectionRows(
  rows: readonly StudentGoalProjectionEntry[],
): StudentGoalProjectionEntry[] {
  return rows
    .slice()
    .sort(
      (a, b) =>
        goalProjectionPercent(b) - goalProjectionPercent(a) ||
        a.displayName.localeCompare(b.displayName),
    );
}

/** HOME-04 gate condition (module doc #6). */
export function isSeasonMissingSetup(
  teams: readonly HomeTeamRow[],
  status: SeasonSetupStatus,
): boolean {
  return teams.length === 0 || !status.hasGoalsConfigured;
}

function seasonSetupDescription(teams: readonly HomeTeamRow[], status: SeasonSetupStatus): string {
  const missing: string[] = [];
  if (teams.length === 0) missing.push('teams');
  if (!status.hasGoalsConfigured) missing.push('season goals');
  return `The active season is missing ${missing.join(' and ')}. Finish season setup before relying on these numbers.`;
}

// ---------------------------------------------------------------------------
// Fixture loader -- obviously-fake default for the injectable `loadData`
// seam (module doc #9).
// ---------------------------------------------------------------------------

export async function defaultLoadCoachHomeData(seasonId: string): Promise<CoachHomeData> {
  return {
    seasonId,
    defaultGoalHours: FIXTURE_DEFAULT_GOAL_HOURS,
    teams: FIXTURE_TEAMS,
    students: FIXTURE_STUDENTS,
    events: FIXTURE_EVENTS.filter((event) => event.seasonId === seasonId),
    sessions: FIXTURE_SESSIONS,
    rsvps: FIXTURE_RSVPS,
    attendance: FIXTURE_ATTENDANCE,
    teamParticipation: FIXTURE_TEAM_PARTICIPATION.find((row) => row.seasonId === seasonId) ?? null,
    studentHours: FIXTURE_STUDENT_HOURS.filter((row) => row.seasonId === seasonId),
    seasonSetupStatus: FIXTURE_SEASON_SETUP_STATUS,
  };
}

// ---------------------------------------------------------------------------
// T124 dashboard fixtures (module doc #13) -- fabricated names only
// (constitution item 6), dual-member-aware: "Dana Voss" plays the same
// verification role here `dashboard_views.sql`'s own scratch-Postgres
// fixtures (this task's worker output) prove at the SQL layer -- she
// contributes to BOTH `team-titans` and `PLACEHOLDER_CURRENT_TEAM_ID`'s
// `FIXTURE_TEAM_HOURS` totals below (D-3 team-scoped double-count), while
// her OWN `FIXTURE_GOAL_PROJECTION` row appears exactly ONCE, personal,
// single-counted (D-3's other half) -- this fixture set is a component-level
// ECHO of that already-verified SQL behavior, not a second proof of it.
// ---------------------------------------------------------------------------

const FIXTURE_DASHBOARD_ROSTER_STATS: NonNullable<DashboardData['rosterStats']> = {
  seasonId: PLACEHOLDER_SEASON_ID,
  activeStudentCount: 5,
  avgHoursPerActiveStudent: 3.7,
  studentsAtGoalCount: 1,
};

const FIXTURE_DASHBOARD_ATTENDANCE_RATE: NonNullable<DashboardData['attendanceRate']> = {
  seasonId: PLACEHOLDER_SEASON_ID,
  expectedCt: 20,
  presentCt: 14,
  attendanceRatePct: 70,
};

const FIXTURE_DASHBOARD_SESSION_DAYS: NonNullable<DashboardData['sessionDays']> = {
  seasonId: PLACEHOLDER_SEASON_ID,
  sessionDaysLogged: 12,
};

const FIXTURE_DASHBOARD_UPCOMING_COMMITTED_HOURS: NonNullable<
  DashboardData['upcomingCommittedHours']
> = {
  seasonId: PLACEHOLDER_SEASON_ID,
  committedHours30d: 19,
};

const FIXTURE_DASHBOARD_DAY_OF_WEEK_SESSIONS: readonly SeasonDayOfWeekSessions[] = [
  { seasonId: PLACEHOLDER_SEASON_ID, dayOfWeek: 1, sessionCount: 4 }, // Mon
  { seasonId: PLACEHOLDER_SEASON_ID, dayOfWeek: 6, sessionCount: 7 }, // Sat -- busiest
  { seasonId: PLACEHOLDER_SEASON_ID, dayOfWeek: 3, sessionCount: 2 }, // Wed
];

// Dana Voss's confirmed hours (10h) are already summed INTO both totals
// below, once per team, per D-3 -- 42 (Ravens) and 28 (Titans) each include
// her contribution; her own personal total stays 10h regardless (see her
// single `FIXTURE_GOAL_PROJECTION` row further down).
const FIXTURE_DASHBOARD_TEAM_HOURS: readonly TeamHoursEntry[] = [
  {
    teamId: PLACEHOLDER_CURRENT_TEAM_ID,
    teamName: 'Ravens',
    seasonId: PLACEHOLDER_SEASON_ID,
    confirmedHours: 42,
  },
  {
    teamId: 'team-titans',
    teamName: 'Titans',
    seasonId: PLACEHOLDER_SEASON_ID,
    confirmedHours: 28,
  },
];

const FIXTURE_DASHBOARD_TOP_EVENTS: readonly EventStudentHoursEntry[] = [
  {
    eventId: 'event-summer-stem-camp',
    seasonId: PLACEHOLDER_SEASON_ID,
    title: 'Summer STEM Camp',
    startsOn: '2026-06-01',
    endsOn: '2026-06-03',
    studentCount: 6,
    totalHours: 30,
  },
  {
    eventId: 'event-food-bank-sort',
    seasonId: PLACEHOLDER_SEASON_ID,
    title: 'Community Food Bank Sort',
    startsOn: '2026-07-05',
    endsOn: '2026-07-05',
    studentCount: 4,
    totalHours: 16,
  },
];

const FIXTURE_DASHBOARD_GOAL_PROJECTION: readonly StudentGoalProjectionEntry[] = [
  // Dual-member (see block comment above) -- ON TRACK (156%).
  {
    studentId: 'student-dana-voss',
    seasonId: PLACEHOLDER_SEASON_ID,
    displayName: 'Dana Voss',
    teamId: PLACEHOLDER_CURRENT_TEAM_ID,
    teamName: 'Ravens',
    goalHours: 90,
    confirmedHours: 64.5,
    plannedHours: 76,
  },
  // Below goal -- 84h short (real-number annotation, no urgency copy).
  {
    studentId: 'student-amara-webb',
    seasonId: PLACEHOLDER_SEASON_ID,
    displayName: 'Amara Webb',
    teamId: PLACEHOLDER_CURRENT_TEAM_ID,
    teamName: 'Ravens',
    goalHours: 90,
    confirmedHours: 6,
    plannedHours: 0,
  },
  // Below goal, different team -- 27.25h short.
  {
    studentId: 'student-nina-ortiz',
    seasonId: PLACEHOLDER_SEASON_ID,
    displayName: 'Nina Ortiz',
    teamId: 'team-titans',
    teamName: 'Titans',
    goalHours: 90,
    confirmedHours: 22.75,
    plannedHours: 40,
  },
];

const FIXTURE_DASHBOARD_ACTIVITY_FEED_SOURCE: ActivityFeedSource = {
  events: [
    {
      id: 'event-food-bank-sort',
      seasonId: PLACEHOLDER_SEASON_ID,
      title: 'Community Food Bank Sort',
      type: 'outreach',
    },
    {
      id: 'event-weekly-build',
      seasonId: PLACEHOLDER_SEASON_ID,
      title: 'Weekly Build Meeting',
      type: 'meeting',
    },
  ],
  sessions: [
    {
      id: 'session-food-bank-upcoming',
      eventId: 'event-food-bank-sort',
      sessionDate: '2026-07-19',
      startsAt: '2026-07-19T14:00:00.000Z',
    },
    {
      id: 'session-build-completed-past',
      eventId: 'event-weekly-build',
      sessionDate: '2026-07-15',
      startsAt: '2026-07-15T23:00:00.000Z',
    },
  ],
  rsvps: [
    // Amara, self, first-ever response, going -- "signed up for".
    {
      id: 'rsvp-amara-going',
      sessionId: 'session-food-bank-upcoming',
      studentId: 'student-amara-webb',
      status: 'going',
      respondedBy: 'profile-amara',
      createdAt: '2026-07-19T10:00:00.000Z',
      updatedAt: '2026-07-19T10:00:00.000Z',
    },
    // Dana, self -- was going, changed to declined -- "dropped".
    {
      id: 'rsvp-dana-dropped',
      sessionId: 'session-food-bank-upcoming',
      studentId: 'student-dana-voss',
      status: 'declined',
      respondedBy: 'profile-dana',
      createdAt: '2026-07-10T10:00:00.000Z',
      updatedAt: '2026-07-19T09:00:00.000Z',
    },
    // Cole -- no linked account (`profileId: null`) -- staff-entered on the
    // coach's expected-attendees checklist -- always non-self.
    {
      id: 'rsvp-cole-going',
      sessionId: 'session-build-completed-past',
      studentId: 'student-cole-jennings',
      status: 'going',
      respondedBy: 'profile-coach',
      createdAt: '2026-07-14T09:00:00.000Z',
      updatedAt: '2026-07-14T09:00:00.000Z',
    },
    // Amara -- first-ever response was ALREADY declined (never "dropped"
    // anything) -- "declined", not "dropped" (module doc #13(f)).
    {
      id: 'rsvp-amara-declined-build',
      sessionId: 'session-build-completed-past',
      studentId: 'student-amara-webb',
      status: 'declined',
      respondedBy: 'profile-amara',
      createdAt: '2026-07-13T08:00:00.000Z',
      updatedAt: '2026-07-13T08:00:00.000Z',
    },
  ],
  attendance: [
    // Dana checks herself off -- self, "checked off".
    {
      id: 'attendance-dana-present',
      sessionId: 'session-build-completed-past',
      studentId: 'student-dana-voss',
      status: 'present',
      recordedBy: 'profile-dana',
      createdAt: '2026-07-16T00:00:00.000Z',
      updatedAt: '2026-07-16T00:00:00.000Z',
    },
    // Coach records Cole present -- staff, "checked off".
    {
      id: 'attendance-cole-present',
      sessionId: 'session-build-completed-past',
      studentId: 'student-cole-jennings',
      status: 'present',
      recordedBy: 'profile-coach',
      createdAt: '2026-07-16T00:05:00.000Z',
      updatedAt: '2026-07-16T00:05:00.000Z',
    },
    // Amara marked ABSENT -- must never appear as a "checked off" entry
    // (module doc's own "present/late only" rule).
    {
      id: 'attendance-amara-absent',
      sessionId: 'session-build-completed-past',
      studentId: 'student-amara-webb',
      status: 'absent',
      recordedBy: 'profile-coach',
      createdAt: '2026-07-16T00:06:00.000Z',
      updatedAt: '2026-07-16T00:06:00.000Z',
    },
  ],
  students: [
    { id: 'student-amara-webb', displayName: 'Amara Webb', profileId: 'profile-amara' },
    { id: 'student-cole-jennings', displayName: 'Cole Jennings', profileId: null },
    { id: 'student-dana-voss', displayName: 'Dana Voss', profileId: 'profile-dana' },
  ],
};

/** Fixture default for the injectable `loadDashboardData` seam -- mirrors
 * `defaultLoadCoachHomeData` above's own "obviously-fake fixture, filtered
 * by `seasonId`" convention. `CoachHome.tsx`'s own prop default is the REAL
 * `loadDashboardData` from `dashboard.ts` (module doc #13); this fixture is
 * for tests/dev-preview to opt into explicitly, same as
 * `ParticipationTab.tsx`'s own `defaultLoadParticipationData` precedent. */
export async function defaultLoadDashboardData(seasonId: string): Promise<DashboardData> {
  return {
    seasonId,
    rosterStats:
      FIXTURE_DASHBOARD_ROSTER_STATS.seasonId === seasonId ? FIXTURE_DASHBOARD_ROSTER_STATS : null,
    attendanceRate:
      FIXTURE_DASHBOARD_ATTENDANCE_RATE.seasonId === seasonId
        ? FIXTURE_DASHBOARD_ATTENDANCE_RATE
        : null,
    sessionDays:
      FIXTURE_DASHBOARD_SESSION_DAYS.seasonId === seasonId ? FIXTURE_DASHBOARD_SESSION_DAYS : null,
    upcomingCommittedHours:
      FIXTURE_DASHBOARD_UPCOMING_COMMITTED_HOURS.seasonId === seasonId
        ? FIXTURE_DASHBOARD_UPCOMING_COMMITTED_HOURS
        : null,
    dayOfWeekSessions: FIXTURE_DASHBOARD_DAY_OF_WEEK_SESSIONS.filter(
      (row) => row.seasonId === seasonId,
    ),
    teamHours: FIXTURE_DASHBOARD_TEAM_HOURS.filter((row) => row.seasonId === seasonId),
    topEvents: FIXTURE_DASHBOARD_TOP_EVENTS.filter((row) => row.seasonId === seasonId),
    goalProjection: FIXTURE_DASHBOARD_GOAL_PROJECTION.filter((row) => row.seasonId === seasonId),
    activityFeedSource: FIXTURE_DASHBOARD_ACTIVITY_FEED_SOURCE,
  };
}

// ---------------------------------------------------------------------------
// BEH-01 milestone-toast dedupe -- same convention `OutreachList.tsx`/T038
// established, scoped to this page's own single team-hours goal bar.
// ---------------------------------------------------------------------------

function getLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

const HOME_HOURS_GOAL_BAR_ID = 'team-hours-goal';

function milestoneToastStorageKey(seasonId: string, milestone: GoalMilestone): string {
  return `volt.home.milestoneToast.${seasonId}.${HOME_HOURS_GOAL_BAR_ID}.${milestone}`;
}

export function hasMilestoneToastFired(seasonId: string, milestone: GoalMilestone): boolean {
  return getLocalStorage()?.getItem(milestoneToastStorageKey(seasonId, milestone)) === 'true';
}

export function markMilestoneToastFired(seasonId: string, milestone: GoalMilestone): void {
  getLocalStorage()?.setItem(milestoneToastStorageKey(seasonId, milestone), 'true');
}

interface ActiveMilestoneToast {
  id: string;
  message: string;
}

function useMilestoneToasts(
  seasonId: string,
  confirmedHours: number,
  goalHours: number,
): { toasts: ActiveMilestoneToast[]; dismissToast: (id: string) => void } {
  const [toasts, setToasts] = useState<ActiveMilestoneToast[]>([]);

  useEffect(() => {
    const percent = hoursVsGoalPercent(confirmedHours, goalHours);
    const newlyCrossed = crossedMilestones(percent).filter(
      (milestone) => !hasMilestoneToastFired(seasonId, milestone),
    );
    if (newlyCrossed.length === 0) return;
    newlyCrossed.forEach((milestone) => markMilestoneToastFired(seasonId, milestone));
    setToasts((prev) => [
      ...prev,
      ...newlyCrossed.map((milestone) => ({
        id: `${HOME_HOURS_GOAL_BAR_ID}-${milestone}`,
        message: `Team hours goal: reached ${milestone}% of the season goal.`,
      })),
    ]);
  }, [seasonId, confirmedHours, goalHours]);

  function dismissToast(id: string): void {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }

  return { toasts, dismissToast };
}

// ---------------------------------------------------------------------------
// Generic DES-12 load-state hook.
// ---------------------------------------------------------------------------

type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: unknown; retry: () => void }
  | { status: 'success'; data: T };

function useLoadState<T>(load: () => Promise<T>, deps: readonly unknown[]): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' });
  // Bumped by the error Banner's "Retry" action (DES-12) to force the effect
  // below to re-run without changing the caller-supplied `deps` semantics.
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setState({ status: 'loading' });
    load()
      .then((data) => {
        if (isMounted) setState({ status: 'success', data });
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setState({ status: 'error', error, retry: () => setRetryToken((token) => token + 1) });
        }
      });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` is the caller-supplied dependency list; `retryToken` is an additional internal trigger.
  }, [...deps, retryToken]);

  return state;
}

// ---------------------------------------------------------------------------
// KPI cards -- module doc #2 (BEH-05).
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  secondary,
  children,
}: {
  label: string;
  value: string;
  secondary?: ReactNode;
  children?: ReactNode;
}): ReactNode {
  return (
    <Card>
      <VStack gap={2}>
        <Heading level={4}>{label}</Heading>
        <Heading level={2}>{value}</Heading>
        {secondary}
        {children}
      </VStack>
    </Card>
  );
}

// T080 MINOR fix: was meeting=blue/outreach=purple/competition=teal, which
// was inconsistent with DES-04's real palette (`CalendarPage.tsx`'s own
// "Meeting Violet"/"Circuit Blue"/"Comp Orange" mapping, also matched
// verbatim by `EventsTab.tsx`) -- corrected to match both of those files
// exactly: meeting=purple, outreach=blue, competition=orange.
const EVENT_TYPE_BADGE: Record<EventType, { variant: BadgeVariant; label: string }> = {
  meeting: { variant: 'purple', label: 'Meeting' },
  outreach: { variant: 'blue', label: 'Outreach' },
  competition: { variant: 'orange', label: 'Competition' },
};

function NextUpRowItem({ row }: { row: NextUpRow }): ReactNode {
  const description = (
    <Text type="supporting">{row.goingCount > 0 ? `${row.goingCount} going` : 'No RSVPs yet'}</Text>
  );
  return (
    <ListItem
      label={row.title}
      description={description}
      endContent={
        <Badge
          variant={EVENT_TYPE_BADGE[row.type].variant}
          label={EVENT_TYPE_BADGE[row.type].label}
        />
      }
    />
  );
}

// ---------------------------------------------------------------------------
// T124 row components (module doc #13) -- every value rendered below is
// already-computed (a view column or a sort/slice/format pure function
// above); no arithmetic happens in JSX.
// ---------------------------------------------------------------------------

function ActivityFeedRowItem({ entry }: { entry: ActivityFeedEntry }): ReactNode {
  return (
    <ListItem
      label={entry.message}
      description={
        <Text type="supporting">
          {entry.dateLabel} · {entry.timeAgoLabel}
        </Text>
      }
      endContent={entry.isSelf ? <Badge variant="neutral" label="Self" /> : undefined}
    />
  );
}

function TeamHoursRowItem({
  entry,
  maxHours,
}: {
  entry: TeamHoursEntry;
  maxHours: number;
}): ReactNode {
  return (
    <ListItem
      label={entry.teamName}
      description={
        <ProgressBar
          label={`${entry.teamName} hours`}
          isLabelHidden
          value={entry.confirmedHours}
          max={maxHours > 0 ? maxHours : 1}
        />
      }
      endContent={<Text type="supporting">{`${entry.confirmedHours}h`}</Text>}
    />
  );
}

function TopEventRowItem({
  entry,
  maxHours,
}: {
  entry: EventStudentHoursEntry;
  maxHours: number;
}): ReactNode {
  const dateRange =
    entry.startsOn === entry.endsOn ? entry.startsOn : `${entry.startsOn} → ${entry.endsOn}`;
  return (
    <ListItem
      label={entry.title}
      description={
        <VStack gap={1}>
          <Text type="supporting">{`${dateRange} · ${entry.studentCount} students`}</Text>
          <ProgressBar
            label={`${entry.title} hours`}
            isLabelHidden
            value={entry.totalHours}
            max={maxHours > 0 ? maxHours : 1}
          />
        </VStack>
      }
      endContent={<Text type="supporting">{`${entry.totalHours}h`}</Text>}
    />
  );
}

/** Motivation-ethics BLOCKER-class posture (module doc #13(e)): the
 * annotation states a fact ("N h short"/"On track"), never guilt/urgency
 * copy -- see `formatGoalProjectionAnnotation` above, the ONLY place this
 * text is composed. */
function GoalProjectionRowItem({ row }: { row: StudentGoalProjectionEntry }): ReactNode {
  const percent = goalProjectionPercent(row);
  const annotation = formatGoalProjectionAnnotation(row);
  const totalHours = round1(row.confirmedHours + row.plannedHours);
  return (
    <ListItem
      label={row.displayName}
      startContent={<Badge variant="teal" label={row.teamName} />}
      description={
        <VStack gap={1}>
          <ProgressBar
            label={`${row.displayName} hours vs. goal`}
            isLabelHidden
            value={row.confirmedHours}
            max={row.goalHours > 0 ? row.goalHours : 1}
          />
          <Text type="supporting">
            {`${row.confirmedHours}h confirmed + ${row.plannedHours}h planned = ${totalHours}h / ${row.goalHours}h · ${percent}% · ${annotation}`}
          </Text>
        </VStack>
      }
    />
  );
}

interface StubNotice {
  title: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Top-level component -- module docs #1/#5/#6/#7/#11.
// ---------------------------------------------------------------------------

export interface CoachHomeProps {
  /** Injectable data-loading seam (module doc #9). Defaults to fixture data. */
  loadData?: LoadCoachHomeDataFn;
  /** Injectable seam for T124's new season-wide analytics (module doc #13).
   * Defaults to the REAL Supabase-backed `loadDashboardData`
   * (`../../lib/supabase/loaders/dashboard`), same "prop defaults to the
   * real loader" convention `ParticipationTab.tsx`'s own `loadData` prop
   * already established -- pass `defaultLoadDashboardData` explicitly (as
   * this file's own tests do) for fixture behavior. */
  loadDashboardData?: LoadDashboardDataFn;
  seasonId?: string;
  /** Which team this Coach/Admin Home is scoped to (module doc #8) --
   * scopes ONLY the pre-existing primary KPI grid / Next up / Recent-feed
   * team filter / check-in / season-setup card. T124's new season-wide
   * widgets (module doc #13(a)) deliberately ignore this prop. */
  teamId?: string;
  /** Injectable clock for the 60-minute check-in boundary / 7-day window /
   * relative-time formatting (module doc #5). Defaults to the real clock. */
  nowFn?: () => Date;
}

export function CoachHome({
  loadData = defaultLoadCoachHomeData,
  loadDashboardData: loadDashboardDataProp = loadDashboardData,
  seasonId = PLACEHOLDER_SEASON_ID,
  teamId = PLACEHOLDER_CURRENT_TEAM_ID,
  nowFn = () => new Date(),
}: CoachHomeProps = {}): ReactNode {
  const { user } = useAuth();
  const navigate = useNavigate();
  const loadState = useLoadState(() => loadData(seasonId), [loadData, seasonId]);
  const dashboardState = useLoadState(
    () => loadDashboardDataProp(seasonId),
    [loadDashboardDataProp, seasonId],
  );
  const [stubNotice, setStubNotice] = useState<StubNotice | null>(null);
  const [goalProjectionFilter, setGoalProjectionFilter] = useState<GoalProjectionFilter>('all');
  const [showAllActivity, setShowAllActivity] = useState(false);

  const nowMs = nowFn().getTime();

  // React Hooks must run unconditionally on every render (rules-of-hooks) --
  // `useMilestoneToasts` (which itself calls `useState`/`useEffect`) is
  // therefore called here, BEFORE the not-signed-in/loading/error early
  // returns below, using 0/0 fallbacks until real data has loaded (0/0
  // crosses no milestone, so this is inert until `loadState.status ===
  // 'success'`).
  const successData = loadState.status === 'success' ? loadState.data : null;
  const preGoalHours = successData
    ? sumGoalHours(successData.students, teamId, successData.defaultGoalHours)
    : 0;
  const preConfirmedHours = successData
    ? sumConfirmedHours(successData.students, teamId, successData.studentHours)
    : 0;
  const { toasts, dismissToast } = useMilestoneToasts(seasonId, preConfirmedHours, preGoalHours);

  function showStub(title: string, description: string): void {
    setStubNotice({ title, description });
  }

  if (user === null) {
    return (
      <VStack gap={4} padding={6}>
        <EmptyState
          headingLevel={1}
          title="Sign in to view Home"
          description="You need to be signed in to see this page."
        />
      </VStack>
    );
  }

  if (loadState.status === 'loading') {
    return (
      <VStack gap={6} padding={6} aria-busy="true">
        <VisuallyHidden as="div" role="status">
          Loading Home…
        </VisuallyHidden>
        <Skeleton width={100} height={28} index={0} />
        <Grid columns={{ minWidth: 240, repeat: 'fit' }} gap={4}>
          {[0, 1, 2, 3].map((card) => (
            <VStack key={card} gap={2} padding={4}>
              <Skeleton width={140} height={14} index={card * 2 + 1} />
              <Skeleton width={70} height={22} index={card * 2 + 2} />
            </VStack>
          ))}
        </Grid>
        <VStack gap={3}>
          <Skeleton width={110} height={20} index={9} />
          <VStack gap={2}>
            {[0, 1, 2].map((row) => (
              <HStack key={row} gap={4} vAlign="center">
                <Skeleton width={220} height={16} index={row * 2 + 10} />
                <Skeleton width={80} height={16} index={row * 2 + 11} />
              </HStack>
            ))}
          </VStack>
        </VStack>
      </VStack>
    );
  }

  if (loadState.status === 'error') {
    return (
      <VStack gap={4} padding={6}>
        <Banner
          status="error"
          title="Couldn't load Home"
          description="Something went wrong loading this season's dashboard. Try refreshing the page."
          endContent={<Button variant="ghost" label="Retry" onClick={loadState.retry} />}
        />
      </VStack>
    );
  }

  const data = loadState.data;

  const teamParticipation = data.teamParticipation;
  const goalHours = preGoalHours;
  const confirmedHours = preConfirmedHours;
  const lastMeetingSummary = buildLastCompletedMeetingSummary(
    data.sessions,
    data.events,
    data.attendance,
    data.students,
    teamId,
  );
  const attendanceRate = lastMeetingSummary ? attendanceRatePercent(lastMeetingSummary) : null;
  const upcomingIn7Days = countUpcomingSessionsInNextDays(
    data.sessions,
    data.events,
    teamId,
    nowMs,
  );
  const nextUp = buildNextUp(data.sessions, data.events, data.rsvps, teamId, nowMs);
  const checkInSession = selectCheckInSession(data.sessions, data.events, teamId, nowMs);
  const showSeasonSetupCard =
    user.role === 'admin' && isSeasonMissingSetup(data.teams, data.seasonSetupStatus);

  const hoursPercent = hoursVsGoalPercent(confirmedHours, goalHours);

  // T124 (module doc #13) -- the new season-wide analytics have their OWN
  // independent DES-12 load state (`dashboardState`), scoped to just the
  // sections built from it, so a slow/failed dashboard-analytics fetch
  // never blocks the rest of an already-successfully-loaded page (UXD-05(b)
  // spirit: a section with no data yet yields its own space, not the whole
  // viewport).
  const dashboardData: DashboardData | null =
    dashboardState.status === 'success' ? dashboardState.data : null;
  const busiestDay = dashboardData ? pickBusiestDay(dashboardData.dayOfWeekSessions) : null;
  const sortedTeamHours = dashboardData ? sortTeamHoursDescending(dashboardData.teamHours) : [];
  const maxTeamHours = maxOf(sortedTeamHours.map((row) => row.confirmedHours));
  const sortedTopEvents = dashboardData ? sortEventsByHoursDescending(dashboardData.topEvents) : [];
  const maxEventHours = maxOf(sortedTopEvents.map((row) => row.totalHours));
  const sortedGoalProjection = dashboardData
    ? sortGoalProjectionRows(
        filterGoalProjectionRows(dashboardData.goalProjection, goalProjectionFilter),
      )
    : [];
  const activityFeedEntries = dashboardData
    ? buildActivityFeed(dashboardData.activityFeedSource, nowMs)
    : [];
  const visibleActivityFeedEntries = showAllActivity
    ? activityFeedEntries
    : activityFeedEntries.slice(0, ACTIVITY_FEED_DEFAULT_LIMIT);

  return (
    <Layout
      height="fill"
      content={
        <LayoutContent padding={6}>
          <VStack gap={6}>
            {toasts.map((toast) => (
              <Toast
                key={toast.id}
                type="info"
                body={toast.message}
                isAutoHide
                autoHideDuration={5000}
                onDismiss={() => dismissToast(toast.id)}
              />
            ))}

            <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
              <Heading level={1}>Home</Heading>
              <HStack gap={2} wrap="wrap">
                {checkInSession !== null && (
                  <Button
                    label="Start check-in"
                    variant="primary"
                    onClick={() => navigate(routePaths.kioskSession(checkInSession.id))}
                  />
                )}
                <Button
                  label="New outreach event"
                  variant="secondary"
                  onClick={() =>
                    showStub(
                      'Event creation dialog not built yet',
                      "This action opens the new-outreach-event dialog (T039, OUT-01/OUT-02). That dialog hasn't shipped yet, so no event was created.",
                    )
                  }
                />
              </HStack>
            </HStack>

            {stubNotice !== null && (
              <Banner
                status="info"
                title={stubNotice.title}
                description={stubNotice.description}
                isDismissable
                onDismiss={() => setStubNotice(null)}
              />
            )}

            <Grid columns={{ minWidth: 240, repeat: 'fit' }} gap={4}>
              <KpiCard
                label="Team participation"
                value={teamParticipation !== null ? `${teamParticipation.participationPct}%` : '—'}
                secondary={
                  <Text type="supporting" color="secondary">
                    Season to date
                  </Text>
                }
              />

              <KpiCard label="Hours vs. team goal" value={`${hoursPercent}%`}>
                <ProgressBar
                  label="Hours vs. team goal"
                  isLabelHidden
                  value={confirmedHours}
                  max={goalHours > 0 ? goalHours : 1}
                  hasValueLabel
                  formatValueLabel={(value, max) => `${value} / ${max} hrs`}
                />
                <HStack gap={2} wrap="wrap">
                  {GOAL_MILESTONES.map((milestone) =>
                    hoursPercent >= milestone ? (
                      <Badge key={milestone} variant="neutral" label={`${milestone}% reached`} />
                    ) : (
                      <Text key={milestone} type="supporting" color="secondary">
                        {milestone}%
                      </Text>
                    ),
                  )}
                </HStack>
              </KpiCard>

              <KpiCard
                label="Last meeting attendance"
                value={attendanceRate !== null ? `${attendanceRate}%` : '—'}
                secondary={
                  lastMeetingSummary !== null ? (
                    <Text type="supporting" color="secondary">
                      {lastMeetingSummary.title} ·{' '}
                      {lastMeetingSummary.presentCount + lastMeetingSummary.lateCount} of{' '}
                      {lastMeetingSummary.rosterSize} on roster
                    </Text>
                  ) : (
                    <Text type="supporting" color="secondary">
                      No completed meetings yet this season
                    </Text>
                  )
                }
              />

              <KpiCard
                label="Events in next 7 days"
                value={String(upcomingIn7Days)}
                secondary={
                  <Text type="supporting" color="secondary">
                    Meetings, outreach &amp; competitions
                  </Text>
                }
              />
            </Grid>

            <Divider />

            {/* T124 secondary stat tiles (UXD-07, module doc #13). Own
                DES-12 states, scoped to just this section (module doc's
                own "independent load state" note above) -- a slow/failed
                fetch here never blocks the primary KPI grid or Next up. */}
            {dashboardState.status === 'loading' && (
              <Grid columns={{ minWidth: 200, repeat: 'fit' }} gap={4}>
                {[0, 1, 2, 3, 4, 5].map((card) => (
                  <VStack key={card} gap={2} padding={4}>
                    <Skeleton width={120} height={14} index={20 + card * 2} />
                    <Skeleton width={60} height={20} index={21 + card * 2} />
                  </VStack>
                ))}
              </Grid>
            )}
            {dashboardState.status === 'error' && (
              <Banner
                status="error"
                title="Couldn't load dashboard analytics"
                description="Secondary stat tiles, goal projection, hours by team, top events, and the activity feed couldn't load. Try refreshing the page."
                endContent={<Button variant="ghost" label="Retry" onClick={dashboardState.retry} />}
              />
            )}
            {dashboardData && (
              <Grid columns={{ minWidth: 200, repeat: 'fit' }} gap={4}>
                <KpiCard
                  label="Avg hours / active student"
                  value={
                    dashboardData.rosterStats
                      ? `${dashboardData.rosterStats.avgHoursPerActiveStudent}h`
                      : '—'
                  }
                  secondary={
                    <Text type="supporting" color="secondary">
                      Default goal {data.defaultGoalHours}h
                    </Text>
                  }
                />
                <KpiCard
                  label="Students at goal"
                  value={
                    dashboardData.rosterStats
                      ? String(dashboardData.rosterStats.studentsAtGoalCount)
                      : '—'
                  }
                  secondary={
                    <Text type="supporting" color="secondary">
                      {dashboardData.rosterStats
                        ? `of ${dashboardData.rosterStats.activeStudentCount} active`
                        : 'No active roster yet'}
                    </Text>
                  }
                />
                <KpiCard
                  label="Session days logged"
                  value={
                    dashboardData.sessionDays
                      ? String(dashboardData.sessionDays.sessionDaysLogged)
                      : '—'
                  }
                  secondary={
                    <Text type="supporting" color="secondary">
                      Completed only
                    </Text>
                  }
                />
                <KpiCard
                  label="Attendance rate"
                  value={
                    dashboardData.attendanceRate
                      ? `${dashboardData.attendanceRate.attendanceRatePct}%`
                      : '—'
                  }
                  secondary={
                    <Text type="supporting" color="secondary">
                      Of active roster per session
                    </Text>
                  }
                />
                <KpiCard
                  label="Upcoming commitment"
                  value={
                    dashboardData.upcomingCommittedHours
                      ? `${dashboardData.upcomingCommittedHours.committedHours30d}h`
                      : '0h'
                  }
                  secondary={
                    <Text type="supporting" color="secondary">
                      Planned in next 30 days
                    </Text>
                  }
                />
                <KpiCard
                  label="Busiest day"
                  value={busiestDay ? formatDayOfWeekLabel(busiestDay.dayOfWeek) : '—'}
                  secondary={
                    <Text type="supporting" color="secondary">
                      By offered sessions
                    </Text>
                  }
                />
              </Grid>
            )}

            <Divider />

            <VStack gap={3}>
              <Heading level={2}>Next up</Heading>
              {nextUp.length === 0 ? (
                <EmptyState
                  headingLevel={3}
                  title="Nothing scheduled"
                  description="Your team's next meetings, outreach events, and competitions will show up here."
                />
              ) : (
                <List hasDividers header="Next up">
                  {nextUp.map((row) => (
                    <NextUpRowItem key={row.sessionId} row={row} />
                  ))}
                </List>
              )}
            </VStack>

            <Divider />

            {/* T124 activity feed (UXP-10, module doc #13(d)) -- replaces
                the old team-scoped "Recent signups" section. Signup/drop/
                checked-off entries with Self origin labels, "Show all". */}
            <VStack gap={3}>
              <Heading level={2}>Activity feed</Heading>
              {dashboardData === null ? (
                <EmptyState
                  headingLevel={3}
                  title="No activity yet"
                  description="Signups, drops, and check-offs will show up here."
                />
              ) : visibleActivityFeedEntries.length === 0 ? (
                <EmptyState
                  headingLevel={3}
                  title="No activity yet"
                  description="Signups, drops, and check-offs will show up here."
                />
              ) : (
                <>
                  <List hasDividers header="Activity feed">
                    {visibleActivityFeedEntries.map((entry) => (
                      <ActivityFeedRowItem key={entry.id} entry={entry} />
                    ))}
                  </List>
                  {!showAllActivity && activityFeedEntries.length > ACTIVITY_FEED_DEFAULT_LIMIT && (
                    <Button
                      label="Show all"
                      variant="ghost"
                      onClick={() => setShowAllActivity(true)}
                    />
                  )}
                </>
              )}
            </VStack>

            <Divider />

            {/* T124 hours by team (UXP-06, module doc #13). Consumes T116's
                `v_team_hours` unmodified -- season-wide, every team. */}
            <VStack gap={3}>
              <Heading level={2}>Hours by team</Heading>
              {sortedTeamHours.length === 0 ? (
                <EmptyState
                  headingLevel={3}
                  title="No team hours yet"
                  description="Confirmed hours will appear here once attendance is recorded this season."
                />
              ) : (
                <List hasDividers header="Hours by team">
                  {sortedTeamHours.map((entry) => (
                    <TeamHoursRowItem key={entry.teamId} entry={entry} maxHours={maxTeamHours} />
                  ))}
                </List>
              )}
            </VStack>

            <Divider />

            {/* T124 per-student goal projection (UXD-07, module doc #13).
                Motivation-ethics BLOCKER-class: annotations state facts,
                the Below-goal filter is coach-facing triage, never a
                ranking/shame framing (Trap #2). */}
            <VStack gap={3}>
              <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
                <Heading level={2}>Goal projection · confirmed + planned</Heading>
                <SegmentedControl
                  label="Goal projection filter"
                  value={goalProjectionFilter}
                  onChange={(value) => setGoalProjectionFilter(value as GoalProjectionFilter)}
                >
                  <SegmentedControlItem value="all" label="All" />
                  <SegmentedControlItem value="belowGoal" label="Below goal" />
                </SegmentedControl>
              </HStack>
              {sortedGoalProjection.length === 0 ? (
                <EmptyState
                  headingLevel={3}
                  title={
                    goalProjectionFilter === 'belowGoal'
                      ? 'No one is below goal'
                      : 'No projection yet'
                  }
                  description={
                    goalProjectionFilter === 'belowGoal'
                      ? 'Every active student is projected to reach their season goal.'
                      : 'Confirmed and planned hours will appear here once recorded this season.'
                  }
                />
              ) : (
                <List hasDividers header="Goal projection">
                  {sortedGoalProjection.map((row) => (
                    <GoalProjectionRowItem key={row.studentId} row={row} />
                  ))}
                </List>
              )}
            </VStack>

            <Divider />

            {/* T124 top events by student hours (UXP-06, module doc #13). */}
            <VStack gap={3}>
              <Heading level={2}>Top events by student hours</Heading>
              {sortedTopEvents.length === 0 ? (
                <EmptyState
                  headingLevel={3}
                  title="No events with hours yet"
                  description="Events that award volunteer hours will show up here once attendance is recorded."
                />
              ) : (
                <List hasDividers header="Top events by student hours">
                  {sortedTopEvents.map((entry) => (
                    <TopEventRowItem key={entry.eventId} entry={entry} maxHours={maxEventHours} />
                  ))}
                </List>
              )}
            </VStack>

            {showSeasonSetupCard && (
              <>
                <Divider />
                <Card>
                  <VStack gap={2}>
                    <Heading level={3}>Season setup</Heading>
                    <Text type="supporting">
                      {seasonSetupDescription(data.teams, data.seasonSetupStatus)}
                    </Text>
                    <Button
                      label="Go to season setup"
                      variant="secondary"
                      onClick={() => navigate(routePaths.settingsSeason)}
                    />
                  </VStack>
                </Card>
              </>
            )}
          </VStack>
        </LayoutContent>
      }
    />
  );
}

export default CoachHome;
