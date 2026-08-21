/**
 * T030: `/meetings` list page (MTG-01 coach view / MTG-14 student+parent view).
 *
 * Coach (`coach`/`admin`) view: `Section` "Upcoming" / `Section` "Past"
 * `Table`s (T135, UXC-02/03/07 -- see that task's own module doc, below the
 * T122 one, for the full Table-migration record) of **meeting-type** EVENTS
 * only (NAV-07 -- never outreach/competition; one row per recurring-meeting
 * SERIES, not per session -- T122 module doc #10 below), each row showing
 * recurrence chips + a date range (UXD-02 "when"), location (UXD-02 "where",
 * UXP-08), planned/logged hours, expected/attended counts (UXD-02 "how
 * much"/"who"), a row-level "Edit" chip (T135 -- MTG-01's own literal text
 * below, "per-row MoreMenu (Edit, Cancel session)", is a disclosed, written-
 * authorized PRD deviation as of T135, recorded beside MTG-01 in
 * `VOLT_Portal_PRD.md` -- Cancel already left this menu for T122's
 * per-session buttons, below, leaving exactly one item behind a menu) and an
 * in-place expander (UXD-03) revealing every one of the event's own sessions
 * with their own inline Cancel action (DES-11 `AlertDialog`) -- MTG-01's
 * literal text (PRD line 272: "Actions: Schedule meetings, per-row MoreMenu
 * (Edit, Cancel session -- AlertDialog)") plus T122's own density rework
 * (module doc #10).
 *
 * Student/parent view (MTG-14, PRD line 288: "`/meetings` for students =
 * their own history (status per session) + participation %. ... Read-only.")
 * -- own Upcoming/Past history rows (no MoreMenu, no Schedule action -- this
 * variant is read-only per MTG-14's own text). T180 mounts the real BEH-06
 * consistency strip (`StudentMeetingView.tsx`, T037) beneath that history --
 * see module doc #7d, below -- which is now this view's sole participation
 * figure; this file no longer renders a participation `ProgressBar` of its
 * own (constitution item 3 / Known Context/Traps #3 still governs the strip
 * itself, a separate, already-Passed file this task only wires in).
 *
 * -----------------------------------------------------------------------
 * 1. Ground truth -- `event_sessions`/`events`/`attendance` column shapes
 *    (Known Context/Traps #1), cited directly from
 *    `supabase/migrations/20260717000000_scheduling_attendance.sql`
 *    (read-only), NOT redefined/renamed with invented fields:
 *
 *    `events` (lines 33-48): id, season_id, type (check: 'meeting' |
 *    'outreach' | 'competition'), title, description, location_name,
 *    address, team_ids uuid[] NULL (null = all teams), counts_participation,
 *    counts_volunteer_hours, adult_volunteers_count, adult_volunteer_hours,
 *    created_by, created_at.
 *
 *    `event_sessions` (lines 53-63): id, event_id, session_date (date),
 *    starts_at (timestamptz), ends_at (timestamptz), status (check:
 *    'scheduled' | 'completed' | 'canceled' -- Known Context/Traps #5's real
 *    status vocabulary, used verbatim below, never an invented string like
 *    "confirmed"/"active"), people_reached, notes, created_at.
 *
 *    `attendance` (lines 82-95): id, session_id, student_id, status (check:
 *    'present' | 'late' | 'excused' | 'absent'), check_in_at, check_out_at,
 *    hours_override, method, recorded_by, updated_at, created_at.
 *
 *    `FixtureEvent`/`FixtureEventSession`/`FixtureAttendanceRecord` below are
 *    camelCase renames of exactly these columns (only the subset this screen
 *    renders) -- no invented fields, no re-derived RLS.
 *
 * -----------------------------------------------------------------------
 * 2. NAV-07 -- this route must show ONLY meeting sessions, never outreach.
 *
 * `buildCoachMeetingRows`/`buildStudentMeetingsData` below both start with
 * `events.filter((event) => event.type === 'meeting')` -- the ONLY type
 * predicate anywhere in this file gating which sessions ever reach either
 * view's rows. `FIXTURE_EVENTS` deliberately includes one `type: 'outreach'`
 * event (`event-food-drive`) with its own session specifically so this
 * filter is genuinely exercised (grep-provable: no outreach-shaped field/
 * import anywhere in this file's rendered output -- see this task's worker
 * output for the render-time proof that its title never appears).
 *
 * -----------------------------------------------------------------------
 * 3. Known Context/Traps #3 -- participation % sourced from
 *    `v_student_participation`'s real shape, never computed here.
 *
 * `StudentParticipationMetric` below is a verbatim camelCase rename of
 * `v_student_participation`'s seven real columns, cited directly from
 * `supabase/migrations/20260717000003_metric_views.sql` lines 21-42
 * (student_id, team_id, season_id, expected_ct, present_ct, late_ct,
 * excused_ct, participation_pct) -- the exact same shape/citation
 * `ParticipationTab.tsx` (T056) already established for this metric.
 * `FIXTURE_PARTICIPATION_METRICS` below supplies already-computed
 * `participationPct` values (as the view's own SQL would have produced
 * them for the paired expected/present/excused counts); this file performs
 * NO percentage arithmetic anywhere -- grep-provable: no `100.0 *`, no
 * `/ greatest(`, no `presentCt / expectedCt` division of any kind.
 * `PastAttendanceSummary` (the coach view's per-session present/late/
 * excused/absent tally) is a DIFFERENT thing: a plain per-session COUNT
 * (`count(*) filter (where status = 'x')`, mirroring the view's own
 * internal counting step, not its percentage step) -- not a percentage,
 * so constitution item 3 does not bar computing it directly from
 * `FIXTURE_ATTENDANCE` records the same way the view's own `expected` CTE
 * would.
 *
 * -----------------------------------------------------------------------
 * 4. BEH-08 -- every date/duration carries a weekday name and a computed
 *    duration; NFR-09 -- timestamps display in America/Chicago.
 *
 * `formatWeekdayDate` (session_date -> "Sat, Jul 25") and
 * `formatTimeRangeWithDuration` (starts_at/ends_at -> "6:00-8:00 PM - 2h",
 * PRD line 237's own worked example) are the ONLY date-formatting functions
 * used for every Upcoming and Past row in both views -- no row anywhere
 * renders a bare ISO string or an un-computed start/end pair. GAM-443 moved
 * both of them, and the rest of this file's own date/duration formatters,
 * to `src/lib/meetings/format.ts` (a shared home now also imported by
 * `CalendarPage.tsx`); this file re-exports them so this doc's own claim
 * (and every existing importer) stays true. All three `Intl.DateTimeFormat`
 * instances that back them are pinned to `timeZone: 'America/Chicago'` per
 * NFR-09 ("Timestamps stored UTC, displayed America/Chicago"), not the
 * viewer's local browser timezone.
 *
 * -----------------------------------------------------------------------
 * 5. `guards.tsx` `Role` vocabulary gap (same recurring gap `RosterShell.tsx`/
 *    T021 and `ParticipationTab.tsx`/T056 already disclosed) -- resolved by
 *    T073a, not by this task.
 *
 * `guards.tsx`'s exported `Role` union now matches AUTH-05's real
 * `admin | coach | student | parent` vocabulary exactly (previously a
 * stale `'admin' | 'staff' | 'volunteer' | 'coach'` placeholder). Since
 * `router.tsx` wires `/meetings` with `RequireAuth` only (no `RequireRole`
 * -- confirmed by reading that file directly; it is a forbidden/read-only
 * file here, and per the worker packet this is CORRECT for this route, not
 * a gap to fix: MTG-01 is a role-*variant* page, not a role-*gated* one),
 * this component never imports/uses `RequireRole` -- it only reads
 * `useAuth().user.role` to pick which variant to render.
 * `isCoachOrAdminView` below compares only against the `'coach'`/`'admin'`
 * literals by design (it only needs to distinguish coach/admin from
 * everyone else); everything else, including a real `'student'`/`'parent'`
 * value, now correctly type-checks too and falls through to the
 * student/parent variant.
 *
 * -----------------------------------------------------------------------
 * 6. T096 (ED-1 Packet P7): `PLACEHOLDER_CURRENT_STUDENT_ID` resolution --
 *    `AuthUser` (`guards.tsx`) still carries only `{id, email, role}`, no
 *    direct `students.id` field, but this task DOES resolve a real
 *    `students.id` from that identity instead of leaving it a placeholder
 *    (Trap #4 of this task's own worker packet -- full reasoning restated
 *    here, since this is a genuinely new resolution problem, not a reused
 *    hook):
 *
 *    - Logged-in STUDENT: `students.profile_id = auth.uid()` is a direct,
 *      unambiguous 1:1 lookup -- exactly one (or zero, for a not-yet-linked
 *      account) row.
 *    - Logged-in PARENT: `guardian_links.parent_profile_id = auth.uid()` can
 *      match MULTIPLE rows (one per linked child) -- but `StudentMeetingsView`
 *      below (unchanged by this task) still only ever accepts ONE
 *      `studentId: string`, not a list, and this task's own Allowed Files
 *      (`MeetingsList.tsx` + a new `loaders/meetings.ts`) do not extend to
 *      redesigning this route into ParentHome.tsx's own multi-card-per-child
 *      architecture (`ParentHome.tsx`'s module doc #4) -- that would be a
 *      genuinely new, much larger UI (N independent cards, N independent
 *      loads) this task's packet never asks for and Trap #4 explicitly warns
 *      against inventing. Investigated `ParentHome.tsx` (an already-real-wired
 *      parent-facing surface) for precedent per Trap #4's own instruction:
 *      its OWN precedent for "which parent is this" is to NOT attempt any
 *      `guardian_links`-keyed-by-`auth.uid()` resolution at all (that file's
 *      own module doc #7: "this page does not attempt to resolve 'which
 *      parent is signed in' from `useAuth()`"), because at the time that page
 *      was built no shared Supabase client existed yet to do so. That
 *      specific limiting reason no longer applies to THIS task (a real client
 *      now exists, and Trap #4 explicitly directs a real
 *      `guardian_links.parent_profile_id = auth.uid()` lookup) -- so the
 *      precedent actually followed here is narrower than "don't resolve at
 *      all": resolve for real, but stay honest about the one-student-only
 *      limitation `MeetingsList`'s own pre-existing (not-this-task's)
 *      `studentId: string` signature already imposes, the same way
 *      `ParentHome.tsx` stays honest about ITS OWN pre-existing gap rather
 *      than silently faking a resolution. `resolveCurrentStudentId`
 *      (`../../lib/supabase/loaders/meetings.ts`) resolves a parent to their
 *      EARLIEST-linked child only (`guardian_links` ordered by `created_at`
 *      ascending, first row) -- a disclosed, minimal, real answer for a
 *      single-student parent (the common case), with a known limitation for a
 *      genuinely multi-student parent (documented in this task's own worker
 *      output "Known risks", not silently accepted as correct for that case).
 *    - Coach/admin: `resolveCurrentStudentId` is never called at all (the
 *      `isCoachOrAdminView` branch below renders `CoachMeetingsView`
 *      instead), but returns `null` defensively rather than throwing if it
 *      ever were.
 *
 *    `resolveStudentId` (new injectable prop on `MeetingsListProps`, default
 *    `resolveCurrentStudentId`) is only ever invoked when a caller does NOT
 *    supply an explicit `studentId` prop -- an explicit `studentId` (as every
 *    existing test in `MeetingsList.test.tsx` before this task already
 *    passes) bypasses resolution entirely and is used as-is, unchanged
 *    behavior. `PLACEHOLDER_CURRENT_STUDENT_ID` is KEPT as a named export
 *    (per this task's own Known Context/Traps #5 -- `MeetingsList.test.tsx`
 *    still imports and uses it) but its role changes: it is no longer this
 *    component's own runtime default for an unresolved `studentId` (that
 *    placeholder default is removed below); it now exists solely as the
 *    fixture literal identifying "the current viewer" inside `FIXTURE_*`
 *    data below, for tests/callers that want fixture data rendered
 *    explicitly.
 *
 * -----------------------------------------------------------------------
 * 7. T096 (ED-1 Packet P7): real load/mutation/dialog wiring -- three of the
 *    four former stubs are now real; "Edit" alone remains a disclosed stub
 *    (with new, accurate copy, since the underlying reason changed -- see
 *    (b) below). **T510 UPDATE (below, after (b)'s own historical record):
 *    "Edit" is no longer a stub** -- `ScheduleMeetingsDialog.tsx` now has a
 *    real edit mode (`initialData`/`onSaveMeetingSeries`), so a real
 *    edit-dialog opener replaces the old stub handler at both
 *    `CoachMeetingsSection` mounts, and the info-banner-notice machinery this
 *    module doc originally described for that stub is deleted (AC14, this
 *    task's own worker output).
 *
 *    a. "Schedule meetings" button (coach view) -- `ScheduleMeetingsDialog.tsx`
 *       (T031, already Passed, already built, already has its own real
 *       injectable `onCreateMeetings` seam) is now imported and rendered for
 *       real by `CoachMeetingsView` below, in CREATE mode. `onClick` opens
 *       the real dialog (`isScheduleDialogOpen` state) instead of showing a
 *       stub `Banner`. `handleCreateMeetingsSubmit` below wires the dialog's
 *       own `onCreateMeetings` prop to a real default
 *       (`createMeetings`, `../../lib/supabase/loaders/meetings.ts`) that
 *       inserts one real `events` row (type `meeting`) + one real
 *       `event_sessions` row per computed date, then reloads this page's own
 *       `rows` from `loadData()` so the newly-scheduled meeting(s) appear
 *       without a manual refresh (a full reload, not a client-side merge --
 *       recomputing `CoachMeetingRow`'s own `teamScopeLabel`/
 *       `attendanceSummary` fields client-side would duplicate
 *       `buildCoachMeetingRows`' real DB-driven joins for no benefit).
 *    b. Row "Edit" menu item (coach view) -- Trap #3 of this task's own
 *       worker packet directed investigating whether
 *       `ScheduleMeetingsDialog.tsx` genuinely supports an "edit an existing
 *       meeting" mode before assuming it does. It does NOT: its own props
 *       (`ScheduleMeetingsDialogProps`) have no `initialData`/"meeting to
 *       edit" field of any kind, its `resetForm()` always resets to the same
 *       hardcoded pristine defaults (never a passed-in existing row), and its
 *       own `CreateMeetingsPayload` shape (`{event, sessions}`, always a
 *       BRAND-NEW `events` insert + N BRAND-NEW `event_sessions` inserts) is
 *       purpose-built for creating a whole new recurring-meeting SERIES, not
 *       mutating one already-scheduled session's fields in place -- there is
 *       no code path in that file that could ever target an existing row for
 *       an UPDATE. Forcing "Edit" onto this dialog would mean either (i)
 *       silently creating a SECOND competing series alongside the original
 *       whenever "Edit" is used (wrong -- corrupts the schedule) or (ii)
 *       inventing new dialog behavior (an `initialData` prop, an edit-mode
 *       branch in its own submit handler) inside `ScheduleMeetingsDialog.tsx`
 *       itself, a forbidden/read-only file for this task. Per the packet's
 *       own explicit instruction for exactly this finding, "Edit" is left as
 *       a clearly-labeled, HONEST stub instead -- new, accurate copy (NOT the
 *       old "dialog not built yet" text, since the dialog genuinely IS built
 *       now; the real remaining gap is narrower and different: "this
 *       particular dialog has no edit mode to open").
 *
 *       **T510 UPDATE: the gap (b) describes is now closed.**
 *       `ScheduleMeetingsDialog.tsx` gained a real, additive edit mode
 *       (`initialData`/`onSaveMeetingSeries` -- see that file's own module doc)
 *       per George's fully-settled T510 design ruling
 *       (`docs/swarm/auto-mode-decisions.md`, "George closes out T510's
 *       design"). `openEditDialog(row)` (below) sets `editTarget(row)` and
 *       opens the SAME `<ScheduleMeetingsDialog>` instance already mounted for
 *       create mode -- one dialog serves both, same "one dialog, one
 *       `initialData`-computed-by-ternary" shape `OutreachEventDialog.tsx`/
 *       `OutreachList.tsx` already established. `handleSaveMeetingSeriesSubmit`
 *       wires the dialog's own `onSaveMeetingSeries` prop to a real default
 *       (`saveMeetingSeries`, `../../lib/supabase/loaders/meetings.ts`) that
 *       reconciles the event's own `events`/`event_sessions` rows
 *       (future-forward only -- George's own ruling), then reloads `rows` the
 *       same way `handleCreateMeetingsSubmit` above already does.
 *    c. Row "Cancel" menu item + `AlertDialog` (coach view) -- was already
 *       real-LOOKING before this task (a genuine `AlertDialog`, DES-11), but
 *       only ever flipped local `rows` state; this task pairs it with a real
 *       `event_sessions.status = 'canceled'` mutation
 *       (`onCancelSession`, default `cancelMeetingSession`,
 *       `../../lib/supabase/loaders/meetings.ts`), optimistic-update +
 *       rollback-on-failure, mirroring `StudentsTab.tsx`'s own
 *       `handleConfirmDeactivate` (T089) shape exactly per this task's own
 *       packet steer.
 *    d. "Consistency strip"-shaped area (student/parent view) -- BEH-06's
 *       "last 5 completed meetings as `StatusDot`s" widget is T037's
 *       already-built, already-Passed deliverable
 *       (`StudentMeetingView.tsx`'s `StudentMeetingView`/`ConsistencyStrip`).
 *       T180 mounts it directly beneath this view's Upcoming/Past history,
 *       passing the `studentId` this file has already resolved (Known
 *       Context/Traps #1 of that task's own packet) -- replacing the prior
 *       placeholder `Section`'s "isn't built yet" copy entirely. T180 also
 *       deletes this file's own participation `ProgressBar` (formerly above
 *       Upcoming) as part of the same change: the strip renders its own
 *       participation figure, and shipping both would put two independently-
 *       loaded participation regions on one page (T180's own packet, Part B)
 *       -- this file's own Upcoming/Past history rows (own status per
 *       session) are UNCHANGED, a distinct, narrower deliverable from the
 *       strip mounted beneath them.
 *
 * -----------------------------------------------------------------------
 * 8. DES-12 four states, reachable independently per role variant (Known
 *    Context/Traps #6).
 *
 *    Coach view (`CoachMeetingsView`): loading (T081: `Skeleton`,
 *    previewing the known Upcoming/Past meeting-list-row shape, while
 *    `loadCoachData()` is pending -- replacing the prior `Spinner` per
 *    Astryx's own guidance since this list's dimensions are predictable)
 *    / error (`loadCoachData()` rejects --
 *    `Banner status="error"`) / empty (`loadCoachData()` resolves zero
 *    meeting-type rows -- page-level `EmptyState` with an offer to open the
 *    stubbed "Schedule meetings" flow) / populated (Upcoming/Past `Section`s
 *    with real rows; each section independently falls back to its own
 *    smaller `EmptyState` when only ONE of the two buckets is empty, e.g.
 *    "no upcoming meetings, three past ones").
 *
 *    Student/parent view (`StudentMeetingsView`): loading / error / empty
 *    (zero history rows AND no participation row) / populated -- the exact
 *    same four-state shape, built independently against `loadStudentData`,
 *    with its own distinct copy (never sharing a message with the coach
 *    view's states, so the two variants are visually/textually
 *    distinguishable per the packet's Known Context/Traps #6).
 *
 * -----------------------------------------------------------------------
 * 9. Astryx prop sourcing (constitution item 2) -- every prop below,
 *    cross-checked against `docs/swarm/astryx-api.md` directly:
 *
 *  - `Section`: "Section" Props table. `dividers`, `padding`, `children`
 *    used, matching `ParticipationTab.tsx`'s established team-grouping
 *    idiom (one `Section` per Upcoming/Past bucket here, instead of per
 *    team).
 *  - `Heading`: doc's own "Components > Heading" subsection is `undefined`
 *    (same disclosed CLI-cross-checked gap `RosterShell.tsx`/T021 and
 *    `Kiosk.tsx`/T034 already hit); `npm run astryx -- component Heading`
 *    resolves `level` (1-6, required) + `children` (required) -- only those
 *    two used below.
 *  - `List`/`ListItem`: "List" Props table (`children`, `hasDividers`,
 *    `header`) + `ListItem`'s own doc subsection is likewise `undefined`;
 *    `npm run astryx -- component ListItem` (re-run live for this task, not
 *    assumed from a prior task) resolves: `label` (`string`, required),
 *    `description` (`ReactNode`), `startContent`, `endContent`, `onClick`,
 *    `href`, `target`, `rel`, `isDisabled`, `isSelected` -- only `label`,
 *    `description`, `endContent` used below (no `onClick`/`href` -- rows are
 *    not interactive/clickable per this task's scope, avoiding the doc's own
 *    "Don't place interactive elements inside an interactive list item"
 *    warning entirely by never making the row itself interactive).
 *  - `Badge`: "Badge" Props table. `variant`
 *    (`'neutral'|'info'|'success'|'warning'|'error'|...`), `label` used.
 *    Session-status badges use the real `event_sessions.status` enum
 *    (Known Context/Traps #5) mapped to Astryx's semantic variants (a
 *    system-state use, matching the doc's own "Do: use success/warning/
 *    error for system status" guidance, not the "Don't: use semantic
 *    variants for categories" warning). Attendance-status badges (student
 *    view) use DES-05's literal mapping (Present=success, Late=warning,
 *    Excused=neutral, Absent=error), cited from PRD line 195.
 *  - `MoreMenu`: T135 SUPERSEDES this bullet -- the coach row's own
 *    `MoreMenu` (previously documented here, `items`/`DropdownMenuOption[]`/
 *    `label`) is REMOVED (module doc above, T135's own module doc below):
 *    once Cancel left it for T122's per-session buttons, exactly one item
 *    ("Edit") remained, so the menu itself is gone, replaced by a plain
 *    `Button` chip. `MoreMenu` is no longer imported or rendered anywhere in
 *    this file (grep-provable).
 *  - `AlertDialog`: "AlertDialog" Props table. `isOpen`, `onOpenChange`,
 *    `title`, `description`, `actionLabel`, `onAction` (all required) used;
 *    `actionVariant` left at its documented `'destructive'` default
 *    (canceling a meeting is a destructive-shaped action).
 *  - `Button`: "Button" Props table. `label`, `variant`, `onClick` used.
 *  - `Banner`: "Banner" Props table. `status`, `title`, `description` used.
 *  - `EmptyState`: "EmptyState" Props table. `title` (required),
 *    `description`, `actions` used.
 *  - `Skeleton` (T081): "Skeleton" section, lines 621-655. `width`,
 *    `height`, `index` used, replacing `Spinner`'s prior use in both role
 *    variants per Astryx's own guidance (known-dimension content).
 *    `VisuallyHidden` + the wrapping `VStack`'s `aria-busy` carry the same
 *    "Loading…" announcements `Spinner`'s `label` used to provide.
 *  - T180: `ProgressBar` is no longer imported by this file -- the student
 *    view's own participation `ProgressBar` (formerly documented here) was
 *    deleted along with the `Section` it lived in (module doc #7d); the
 *    mounted `StudentMeetingView` strip renders the page's sole
 *    participation figure now, using its own `ProgressBar` internally
 *    (`StudentMeetingView.tsx`'s own module doc #8, not this file's).
 *  - `VStack`/`HStack`: "Stack" section, `VStack`/`HStack` subsections.
 *    `gap`, `padding`, `hAlign`, `vAlign`, `wrap` used.
 *  - `Text`: "Text" Props table. `type` (`'supporting'`), `color`,
 *    `hasTabularNumbers` used.
 *  - `Collapsible` (T122, new to this file at the time): T135 SUPERSEDES
 *    this bullet for the coach row -- `Collapsible` kept its own content
 *    always mounted (CSS-`display:none` while collapsed, never removed from
 *    the DOM, `Collapsible.tsx:102-104`), which is exactly the mechanism
 *    T135's own Table-migration module doc (below) found unsuitable for a
 *    `Table`'s flat `data` array; the coach row's expander is now a plain
 *    `Button` (module doc above `MIN_TOUCH_TARGET_STYLE`) driving real row
 *    splicing instead. `Collapsible` is no longer imported or rendered
 *    anywhere in this file (grep-provable).
 *
 * -----------------------------------------------------------------------
 * 10. T122 (PRD v2 UXP-04, "meetings half" of the row-density rework;
 *     capability map "Events tab" figure is the binding reference) --
 *     coach-view rows are RESTRUCTURED from one-row-per-SESSION to
 *     one-row-per-EVENT (recurring-meeting SERIES), with an in-place
 *     expander (UXD-03) revealing each session. Full decision record
 *     (density comparison against the reference figure, the `.limit(1)`
 *     fix) is in this task's own worker output; the parts that affect this
 *     file's own shape:
 *
 *     a. `CoachMeetingRow` is now `{ eventId, title, locationName,
 *        teamScopeLabel, sessions: CoachMeetingSessionDetail[] }` --
 *        `sessions` holds the SAME per-session facts the old flat row used
 *        to carry (`sessionId`, `sessionDate`, `startsAt`, `endsAt`,
 *        `status`, `attendanceSummary`), plus three NEW per-session facts
 *        this task adds: `durationHours` (plain `endsAt - startsAt`
 *        arithmetic -- the same subtraction `formatDuration` already did,
 *        factored into one shared `computeDurationMinutes` helper (now in
 *        `src/lib/meetings/format.ts`, GAM-443) so there is exactly one
 *        duration formula, not two),
 *        `expectedCt` (a real RSVP `status === 'going'` COUNT for that
 *        session -- a plain filter+length, the same class of computation
 *        `PastAttendanceSummary` already does per module doc #3, never a
 *        percentage), and `attendeeNames` (real `students.display_name`
 *        values for that session's present/late attendance rows, completed
 *        sessions only -- empty for a scheduled session, since no attendance
 *        exists yet to name).
 *     b. `summarizeCoachMeetingRow(sessions)` is a NEW pure function
 *        (exported, directly testable) that derives everything the row-level
 *        summary line needs from `sessions` alone -- UXD-02's own worked
 *        example ("MON (18) · THU (18)") is `buildRecurrenceChips`'s literal
 *        target shape (grouped by weekday, first-seen order, empty for a
 *        single-session event since a chip adds nothing for a one-off
 *        meeting -- the date range line covers that case alone);
 *        `buildDateRangeLabel` reuses `formatWeekdayDate` verbatim (BEH-08,
 *        module doc #4 -- still the ONLY weekday-date formatter, now shared
 *        via `src/lib/meetings/format.ts`, GAM-443); "planned hours" sums
 *        EVERY non-canceled session's own
 *        `durationHours`, "logged hours" sums only COMPLETED sessions' --
 *        both are plain scheduled-DURATION sums, never a re-derivation of
 *        `v_student_hours`'/`v_student_participation`'s own hours/percentage
 *        formulas (constitution item 3). Disclosed, deliberate scope
 *        decision (this task's own worker output has the full reasoning):
 *        meetings are created with `counts_volunteer_hours: false`
 *        (`loaders/meetings.ts`'s own `makeCreateMeetings`, T096, unchanged
 *        by this task) -- they never feed `v_student_hours` at all, so
 *        there is no metric-view-backed "volunteer hours credited" figure
 *        for a meeting row to show even if this task wanted one; "planned/
 *        logged hours" here means SCHEDULED MEETING TIME (how long this
 *        series is scheduled for vs. how much of it has actually happened),
 *        a real, honestly-labeled, non-metric figure, not a stand-in for
 *        volunteer-hours credit. "Expected"/"attended" counts are summed
 *        across every one of the event's own sessions (cumulative
 *        person-sessions across the whole series, e.g. an 18-Monday series
 *        with 20 students expected each week sums to 360) -- the same
 *        cumulative-count idiom `PastAttendanceSummary` already established
 *        per-session, applied across a row's own sessions instead of within
 *        one; per-session (non-cumulative) counts remain visible in the
 *        expander for exactly this reason.
 *     c. Upcoming/Past partitioning for these grouped rows can no longer
 *        reuse the old per-session `partitionByStatus` (a row can now hold
 *        BOTH completed and still-scheduled sessions at once, e.g. a
 *        weekly meeting three weeks in) -- `partitionCoachMeetingRows`
 *        (NEW, exported) buckets a row into Upcoming when ANY of its own
 *        sessions is still `'scheduled'`, else Past; sorted by the nearest
 *        upcoming session ascending (Upcoming) / the most recent session
 *        descending (Past) -- disclosed design decision: an ongoing weekly
 *        meeting with both past and future sessions stays in Upcoming until
 *        its LAST session is completed/canceled, matching how a coach would
 *        actually think of "is this meeting still going." `partitionByStatus`
 *        itself is UNCHANGED and still used by `StudentMeetingsView` below
 *        (module doc #7d / Known Context/Traps -- the student/parent view
 *        keeps its own existing per-session-row shape verbatim, per this
 *        task's own packet: "Student view: keep its existing shape").
 *     d. Row-level Cancel (module doc #7c, T096) MOVES from the row's own
 *        `MoreMenu` into each SESSION inside the expander (a plain `Button`,
 *        not a second `MoreMenu`, since a session only ever has the one
 *        action) -- semantically more correct than before (you cancel one
 *        OCCURRENCE, never a whole recurring series in one action), and the
 *        underlying mutation this task was told to "keep" (`onCancelSession`
 *        / `cancelMeetingSession`, `loaders/meetings.ts`, unchanged target
 *        shape: `(sessionId: string) => Promise<void>`) and its optimistic-
 *        update-with-rollback pattern are preserved byte-for-byte, only its
 *        UI trigger location moves. At the time of T122, the row's own
 *        `MoreMenu` carried only "Edit" (module doc #7b's stub reasoning is
 *        UNCHANGED and still reads MORE naturally: editing a whole meeting
 *        SERIES was always the real ask `ScheduleMeetingsDialog.tsx` cannot
 *        do, not editing one session) -- T135 SUPERSEDES the "MoreMenu"
 *        part of this sentence specifically: one item behind a menu is a
 *        menu that should not exist, so the row's own `MoreMenu` is REMOVED
 *        (this file's own T135 module doc, below, has the full authorized-
 *        deviation record) and replaced with a plain `Edit` `Button` chip.
 *        Edit's own stub behavior/copy is otherwise byte-for-byte unchanged.
 *     e. Location (`event.locationName`) is a real, already-existing column
 *        (UXP-08's own resolution note: `events.location_name`/`address`
 *        are `not null` in the v1 schema; this task is the first to surface
 *        them on this page) -- `loaders/meetings.ts`'s own `queryEvents`
 *        now selects both; the `FixtureEvent` fixture rows below gain real
 *        (fabricated per constitution item 6) location strings so the dense
 *        row has something honest to show without a live DB.
 *     f. UXD-05(b) fix (space rules): `CoachMeetingsSection`/
 *        `StudentHistorySection`'s own per-section `EmptyState` (e.g. "no
 *        upcoming meetings, three past ones") now passes `isCompact` --
 *        previously full-size regardless of whether the SIBLING section on
 *        the same page had real rows, which is exactly UXD-05(b)'s named
 *        violation ("a section with no rows yields its space; it does not
 *        center a message in half a viewport"). The page-level "zero
 *        meetings at all" `EmptyState` (both views) stays full-size --
 *        there is genuinely no other content on the page in that case, so
 *        `isCompact` would not apply per that prop's own documented purpose
 *        ("reduced spacing for constrained content areas"). UXD-05(a)/(c)
 *        reviewed against this page and found not applicable: no duplicated
 *        heading for one concept exists here (unlike the named Outreach
 *        anti-example), and no stacked full-width-bar pattern exists here
 *        for the tile pattern to replace. T180 UPDATE: this file no longer
 *        renders a participation `ProgressBar` of its own at all -- the
 *        single participation bar now lives inside the mounted
 *        `StudentMeetingView` strip (module doc #7d), one bar, not a stack,
 *        same conclusion.
 *     g. `.limit(1)` dual-member fix (`loaders/meetings.ts`
 *        `queryParticipationRowsForStudent`/`aggregateParticipationRows`) --
 *        this file's own consuming code (`buildStudentMeetingsData`'s
 *        `participationMetrics.find(...)`) is UNCHANGED: the loader now
 *        hands it an array with AT MOST one (already-aggregated) row
 *        instead of an arbitrary single row, so the existing `.find` still
 *        finds exactly the right thing with zero changes needed here. Full
 *        decision record lives in `loaders/meetings.ts`'s own module doc and
 *        this task's own worker output.
 */

import type { ReactNode } from 'react';
import { EmptyState, VStack } from '@astryxdesign/core';
import { useAuth } from '../../app/guards';
import {
  cancelMeetingSession,
  createMeetings,
  loadCoachMeetingsData,
  loadStudentMeetingsData,
  resolveCurrentStudentId,
  saveMeetingSeries,
  saveMeetingSession,
} from '../../lib/supabase/loaders/meetings';
import type { OnCreateMeetingsFn, OnSaveMeetingSeriesFn } from './ScheduleMeetingsDialog';
import type { OnSaveMeetingSessionFn } from './EditMeetingSessionDialog';
// T189 -- honest "your account is inactive" copy (packet v2). Aliased on
// import so the local default parameter below can share the prop's own name
// (same "import under a different local name, default param reuses the prop
// name" shape this file's own `resolveStudentId = resolveCurrentStudentId`
// line already uses -- there the names simply already differ; here they
// don't, so an explicit alias is needed).
import {
  resolveStudentIsActive as defaultResolveStudentIsActive,
  type ResolveStudentIsActiveFn,
} from '../../lib/supabase/loaders/students';
// GAM-444 Stage B -- the two role-variant views, moved out of this file into
// their own modules (`coach/CoachMeetingsView.tsx`, module doc #7/#8/#9/#10;
// `student/StudentMeetingsView.tsx`, module doc #3/#6/#7/#7d/#8). This file
// is now a shell: it picks a role variant and re-exports the moved surface
// (below) for back-compat.
import { CoachMeetingsView } from './coach/CoachMeetingsView';
import { StudentMeetingsViewContainer } from './student/StudentMeetingsView';
import type {
  CancelMeetingSessionFn,
  LoadCoachMeetingsDataFn,
  LoadStudentMeetingsDataFn,
  ResolveCurrentStudentIdFn,
} from '../../lib/meetings/types';

// ---------------------------------------------------------------------------
// GAM-444 back-compat re-exports -- 11 external modules import from this
// page module (packet §6); every name it exported before the split is
// re-exported here, unchanged, so none of them need an edit.
// ---------------------------------------------------------------------------

export type {
  AttendanceStatus,
  CancelMeetingSessionFn,
  CoachMeetingEventTableRow,
  CoachMeetingRow,
  CoachMeetingRowSummary,
  CoachMeetingSessionDetail,
  CoachMeetingSessionDetailTableRow,
  CoachMeetingTableRow,
  CoachMeetingsData,
  CurrentViewerIdentity,
  EventType,
  LoadCoachMeetingsDataFn,
  LoadStudentMeetingsDataFn,
  PartitionedRows,
  PastAttendanceSummary,
  ResolveCurrentStudentIdFn,
  SessionStatus,
  StudentMeetingHistoryRow,
  StudentMeetingsData,
  StudentParticipationMetric,
} from '../../lib/meetings/types';

export {
  PLACEHOLDER_CURRENT_STUDENT_ID,
  buildCoachMeetingRows,
  buildCoachMeetingTableRows,
  defaultLoadCoachMeetingsData,
  partitionCoachMeetingRows,
  summarizeCoachMeetingRow,
} from '../../lib/meetings/coachModel';

export {
  buildStudentMeetingsData,
  defaultLoadStudentMeetingsData,
  partitionByStatus,
} from '../../lib/meetings/studentModel';

// ---------------------------------------------------------------------------
// BEH-08 / NFR-09 date + duration formatting -- module doc #4. GAM-443 moved
// these to `src/lib/meetings/format.ts` (a shared home also imported by
// `CalendarPage.tsx`); re-exported here so `MeetingsList.test.tsx` and any
// other importer of this page module keep working unchanged.
// ---------------------------------------------------------------------------

export {
  buildDateRangeLabel,
  buildRecurrenceChips,
  formatDuration,
  formatHoursLabel,
  formatTimeRangeWithDuration,
  formatWeekdayDate,
} from '../../lib/meetings/format';

// ---------------------------------------------------------------------------
// Top-level component -- module doc #5/#6.
// ---------------------------------------------------------------------------

export interface MeetingsListProps {
  /** Coach/admin view seam. Defaults to a real query
   * (`../../lib/supabase/loaders/meetings.ts`). */
  loadCoachData?: LoadCoachMeetingsDataFn;
  /** Student/parent view seam. Defaults to a real query, same module. */
  loadStudentData?: LoadStudentMeetingsDataFn;
  /** T096 (module doc #7c). Defaults to a real mutation, same module. */
  onCancelSession?: CancelMeetingSessionFn;
  /** T096 (module doc #7a). Defaults to a real mutation, same module. */
  onCreateMeetings?: OnCreateMeetingsFn;
  /** T510 (module doc #7b). Defaults to a real future-forward reconciliation
   * mutation, same module. */
  onSaveMeetingSeries?: OnSaveMeetingSeriesFn;
  /** T605 (§6.2/§6.3). Defaults to a real guarded, in-place `event_sessions`
   * update mutation, same module. */
  onSaveMeetingSession?: OnSaveMeetingSessionFn;
  /** T096 (module doc #6, Trap #4). Defaults to a real resolution, same
   * module. Only ever invoked when `studentId` below is NOT supplied. */
  resolveStudentId?: ResolveCurrentStudentIdFn;
  /** T189. Defaults to a real query,
   * `../../lib/supabase/loaders/students.ts` -- reads `students.is_active`
   * directly for the resolved student id (packet v2 §3: NOT inferred from
   * `resolveStudentScope` or the participation figure -- both are unsound
   * detectors, see that loader's own module doc). Only ever invoked on the
   * resolved path -- when `studentId` below IS supplied, this seam is never
   * called (`StudentMeetingsViewContainer`'s own `NOOP_RESOLVE_STUDENT_IS_ACTIVE`,
   * C5). */
  resolveStudentIsActive?: ResolveStudentIsActiveFn;
  /**
   * Which student the student/parent view is currently scoped to (module
   * doc #6). When omitted (the real-world default), this is resolved for
   * real via `resolveStudentId` instead of falling back to a placeholder --
   * supplying it explicitly (as every fixture-driven caller/test does)
   * bypasses that resolution entirely.
   */
  studentId?: string;
}

export function MeetingsList({
  loadCoachData = loadCoachMeetingsData,
  loadStudentData = loadStudentMeetingsData,
  onCancelSession = cancelMeetingSession,
  onCreateMeetings = createMeetings,
  onSaveMeetingSeries = saveMeetingSeries,
  onSaveMeetingSession = saveMeetingSession,
  resolveStudentId = resolveCurrentStudentId,
  resolveStudentIsActive = defaultResolveStudentIsActive,
  studentId,
}: MeetingsListProps = {}): ReactNode {
  const { user } = useAuth();

  // Module doc #5 -- only the two role literals present in guards.tsx's
  // stale `Role` union are compared directly; everything else (including a
  // real 'student'/'parent' value) falls through to the student/parent view.
  const isCoachOrAdminView = user !== null && (user.role === 'coach' || user.role === 'admin');

  if (user === null) {
    return (
      <VStack gap={4} padding={6}>
        <EmptyState
          headingLevel={1}
          title="Sign in to view meetings"
          description="You need to be signed in to see this page."
        />
      </VStack>
    );
  }

  return (
    <VStack gap={6} padding={6}>
      {isCoachOrAdminView ? (
        <CoachMeetingsView
          loadData={loadCoachData}
          onCancelSession={onCancelSession}
          onCreateMeetings={onCreateMeetings}
          onSaveMeetingSeries={onSaveMeetingSeries}
          onSaveMeetingSession={onSaveMeetingSession}
        />
      ) : (
        <StudentMeetingsViewContainer
          viewer={{ id: user.id, role: user.role }}
          explicitStudentId={studentId}
          resolveStudentId={resolveStudentId}
          resolveStudentIsActive={resolveStudentIsActive}
          loadData={loadStudentData}
        />
      )}
    </VStack>
  );
}

export default MeetingsList;
