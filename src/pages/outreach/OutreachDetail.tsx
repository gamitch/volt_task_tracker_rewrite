/**
 * T041: `/outreach/:eventId` detail page (OUT-04): a `MetadataList`
 * (when/where/scope/creator), per-session signup lists grouped
 * Going/Maybe/Can't go/No response, a plain Google Maps link built from the
 * address, edit/cancel via `MoreMenu`, and a NAV-08 "Copy link" action.
 *
 * -----------------------------------------------------------------------
 * 1. Ground truth -- `events`/`event_sessions`/`rsvps` column shapes, cited
 *    directly from `supabase/migrations/20260717000000_scheduling_attendance.sql`
 *    (read-only), NOT redefined/renamed with invented fields:
 *
 *    `events` (lines 33-48): id, season_id, type (check: 'meeting' |
 *    'outreach' | 'competition'), title, description, location_name,
 *    address (the exact, confirmed column name -- NOT `location_address`),
 *    team_ids uuid[] NULL (null = all teams), counts_participation,
 *    counts_volunteer_hours, created_by uuid references profiles NULLABLE,
 *    created_at.
 *
 *    `event_sessions` (lines 53-63): id, event_id, session_date (date),
 *    starts_at (timestamptz), ends_at (timestamptz), status (check:
 *    'scheduled' | 'completed' | 'canceled'), people_reached, notes,
 *    created_at.
 *
 *    `rsvps` (lines 67-76): id, session_id, student_id, status (check:
 *    'going' | 'maybe' | 'declined'), responded_by uuid references profiles
 *    NULLABLE, updated_at, created_at, unique(session_id, student_id).
 *
 *    `OutreachDetailEvent`/`OutreachDetailSession`/`RsvpRow` below are
 *    camelCase renames of the subset of these columns this page needs --
 *    real status vocabularies used verbatim, never an invented string.
 *    `OutreachList.tsx`/`OutreachEventDialog.tsx`/`RsvpControl.tsx` (T038/
 *    T039/T040, all Forbidden Files, read-only reference per this task's own
 *    Dependencies) already established camelCase shapes for this same
 *    schema subset -- this file's shapes match their field names/casing
 *    (id, sessionId/eventId, studentId, status, respondedBy, updatedAt,
 *    createdAt) so a future wiring task can pass real fetched rows straight
 *    through with no reshaping, but are independently reimplemented here
 *    (not imported), since all three are Forbidden Files for this task.
 *
 * -----------------------------------------------------------------------
 * 2. THE CENTRAL TRAP -- "No response" is a UI-DERIVED bucket, never a
 *    fabricated fourth stored `rsvps.status` value.
 *
 * The real `rsvps.status` check constraint (module doc #1) only accepts
 * `'going' | 'maybe' | 'declined'` -- there is no `'no_response'`/
 * `'unanswered'`/etc. value anywhere in that check. `groupSessionSignups`
 * below is the ONE place the four signup buckets (Going/Maybe/Can't go/No
 * response) are computed, and it derives "No response" by DIFFING the
 * event's team roster (`resolveEventRoster`, module doc #3) against
 * whichever `rsvps` rows actually exist for that specific session: any
 * roster student with NO `rsvps` row at all for that `session_id` lands in
 * "No response"; a student with a `declined` row lands in "Can't go" (a
 * real answer, distinct from never having answered) -- never conflated.
 * Grep-provable: no string literal resembling a fourth status value is ever
 * written to an `rsvps`-shaped object anywhere in this file.
 *
 * -----------------------------------------------------------------------
 * 3. Roster resolution -- `events.team_ids` NULL/array semantics (module
 *    doc #1), reused for the "No response" diff (module doc #2).
 *
 * `resolveEventRoster` returns every student for `team_ids === null` (all
 * teams), or only students whose `students.team_id` (a single FK per
 * `20260716000000_identity_roster.sql` line 63 -- NOT a many-to-many
 * membership) is present in `team_ids` otherwise. This is the roster every
 * per-session grouping diffs against: for a team-scoped event, a student
 * OUTSIDE the scoped team(s) never appears in ANY bucket for that event's
 * sessions (not even "No response") -- proven in this task's own test file
 * by asserting an out-of-scope student's name is absent from the entire
 * rendered detail page for a team-scoped fixture event.
 *
 * -----------------------------------------------------------------------
 * 4. Per-session, NOT per-event, signup-list grouping (Known Context/Traps
 *    #4 -- explicit disclosure required).
 *
 * OUT-04's own text (quoted in this task's packet) reads "per-session
 * signup lists", and `event_sessions` is a real one-to-many child of
 * `events` (an outreach event may run several days, each with its own
 * attendance-relevant headcount). Flattening every session's RSVPs into one
 * event-wide bucket would silently discard which day a student is actually
 * committed to, which is exactly the information a coach opening this page
 * mid-multi-day-event needs. This file therefore renders ONE
 * `SessionSignupList` (its own four buckets) per `event_sessions` row,
 * ordered chronologically (`sortSessionsByStart`) -- never a single
 * event-wide flattened set. `groupSessionSignups` itself only ever takes a
 * single `sessionId`, not `eventId`, which is the grep-provable proof this
 * decision is structural, not incidental.
 *
 * -----------------------------------------------------------------------
 * 5. NAV-08 -- invalid/inaccessible ids reveal NOTHING (DES-12 error
 *    state), proven with a fixture "not found" result (Known Context/Traps
 *    #1).
 *
 * `LoadOutreachDetailFn` resolves to `OutreachDetailData | null` -- `null`
 * is the designed "not found / inaccessible" signal (distinct from a
 * REJECTED promise, which represents a transient fetch failure and gets its
 * own, separate `Banner` state; conflating the two would let a real network
 * blip render the same "you're not authorized" copy a genuinely-denied
 * request should show, which is its own (milder) leak). `defaultLoadOutreachDetail`
 * (module doc #7) returns `null` for any id not present in its own fixture
 * `FIXTURE_EVENTS` array -- this task's own test file passes exactly such
 * an id and asserts the ONLY thing in the container's text content is the
 * DES-12 `EmptyState` copy: no event title, no address, no signup names, no
 * `MetadataList`, nothing. `NoAccessPage.tsx` (T020, read-only reference
 * per this task's own instruction) established the same "reveal nothing,
 * generic copy" posture for its own distinct (auth-entry, not per-record)
 * scenario -- this page's `notFound` branch follows that same discipline
 * (a plain, generic `EmptyState`, no partial render of anything this page
 * would otherwise show) adapted to a per-record detail page rather than
 * reusing its literal `Card`/`Center` auth-screen chrome, which would be
 * the wrong visual register for a route nested inside the app shell.
 *
 * -----------------------------------------------------------------------
 * 6. NAV-08 Copy link -- `Toast` "Link copied", verbatim, real constructed
 *    URL, disclosed clipboard-API test limitation (Known Context/Traps #2).
 *
 * `buildOutreachDetailUrl(eventId, origin)` is the ONE place the copied URL
 * string is built (`${origin}/outreach/${eventId}`, the real route this
 * page itself is mounted at, with the real event id interpolated -- never a
 * placeholder/fake id). `handleCopyLink` fires the `Toast` (`body="Link
 * copied"`, the literal string this task's packet requires verbatim)
 * unconditionally on click and separately, best-effort, calls
 * `copyTextToClipboard` (module doc #7) -- a real `navigator.clipboard.writeText`
 * call when that API exists, silently absorbed otherwise. No real OS-level
 * clipboard *read-back* can be asserted in this project's `jsdom` test
 * environment (`jsdom` does not implement a persistent, readable clipboard
 * store) -- this task's own test file honestly tests only what is provable
 * from inside the page: (a) `buildOutreachDetailUrl`'s own string output is
 * correct and uses the real id, (b) the `Toast`'s literal "Link copied"
 * text renders after the click, and (c) a mocked `navigator.clipboard.writeText`
 * is called with that exact same URL string -- never a fabricated
 * clipboard-read-back assertion.
 *
 * -----------------------------------------------------------------------
 * 7. No shared Supabase client wired in (Forbidden Files: `src/lib/supabase/**`
 *    read-only reference only) -- deliberate scope, same posture as every
 *    prior content page in this batch.
 *
 * `defaultLoadOutreachDetail` is an obviously-fake fixture loader (constants
 * below, constitution item 6: fabricated names only), the injectable
 * default for `loadData`. `copyTextToClipboard` is a thin, directly-testable
 * wrapper around the real (when present) `navigator.clipboard.writeText`
 * Web API -- not a Supabase call, so it is not part of this disclosed gap;
 * it is exported specifically so this task's test file can spy on it.
 *
 * -----------------------------------------------------------------------
 * 8. T101 UPDATE (ED-1 Packet P10): Edit/Cancel `MoreMenu` items are NO
 *    LONGER stubs -- see module doc #10 below for the full real wiring.
 *    `OutreachEventDialog.tsx` (T039) was already built and already Passed;
 *    this task wires it into this page for the first time, in EDIT mode
 *    (Trap #5's own investigation found it genuinely supports editing an
 *    existing event -- the opposite finding from T096's
 *    `ScheduleMeetingsDialog.tsx` investigation). "Cancel event" is now a
 *    real, event-level `event_sessions.status = 'canceled'` mutation
 *    (module doc #10) -- this task's own packet explicitly resolved the
 *    ambiguity the earlier task's disclosed judgment call above had flagged
 *    ("cancel every session? which one?"): every currently-`'scheduled'`
 *    session for the event, leaving already-`'completed'` sessions
 *    untouched.
 *
 * -----------------------------------------------------------------------
 * 9. Astryx prop sourcing (constitution item 2) -- every prop used below,
 *    cross-checked directly against `docs/swarm/astryx-api.md` (grepped
 *    live for this task):
 *
 *  - `MetadataList` (line 4655 section, Props table): `children`,
 *    `columns` (`'single'`), `title` used. `MetadataListItem`'s own
 *    "Components" subsection is `undefined` (same disclosed doc-gap every
 *    sibling file in this batch has hit); cross-checked directly against
 *    the installed source
 *    (`node_modules/@astryxdesign/core/dist/MetadataList/MetadataListItem.d.ts`):
 *    `label` (required), `children` (required), `icon` -- only `label`/
 *    `children` used here.
 *  - `MoreMenu` (line 4786 section, Props table): `items`
 *    (`DropdownMenuOption[]`, re-exported from `@astryxdesign/core`'s
 *    `./DropdownMenu` barrel per `node_modules/@astryxdesign/core/dist/index.d.ts`,
 *    same as `MeetingsList.tsx`'s own confirmed citation), `label` used.
 *  - `Link` (line 1910 section, Props table): `href`, `isExternalLink`,
 *    `isStandalone`, `children` used.
 *  - `Button` (line 1768 section, Props table): `label`, `variant`,
 *    `onClick` used.
 *  - `Banner` (line 2694 section, Props table): `status`, `title`,
 *    `description`, `isDismissable`, `onDismiss` used.
 *  - `AlertDialog` (T101, "AlertDialog" Props table, same citation
 *    `MeetingsList.tsx`'s own T096 cancel wiring already established):
 *    `isOpen`, `onOpenChange`, `title`, `description`, `actionLabel`,
 *    `onAction` (all required) used; `actionVariant` left at its documented
 *    `'destructive'` default (canceling an outreach event is a
 *    destructive-shaped action).
 *  - `EmptyState` (line 3954 section, Props table): `title` (required),
 *    `description` used.
 *  - `Skeleton` (T081, "Skeleton" section, lines 621-655): `width`,
 *    `height`, `index` used to preview this screen's predictable detail-page
 *    shape (title bar + fixed-length `MetadataList` + signup sessions),
 *    replacing `Spinner`'s prior use here per Astryx's own guidance
 *    (known-dimension content). `VisuallyHidden` + the wrapping `VStack`'s
 *    `aria-busy` carry the "Loading event…" announcement `Spinner`'s
 *    `label` used to provide.
 *  - `Toast`: `astryx-api.md` line 5998 section's own Props table is a
 *    real, disclosed doc-gap already caught and cited by `OutreachList.tsx`'s
 *    own module doc #4 -- it names `uniqueID`/`onHide` where the installed
 *    `ToastProps` (`node_modules/@astryxdesign/core/dist/Toast/Toast.d.ts`,
 *    re-verified directly for this task) has neither. Only the installed-
 *    source-verified props are used: `type`, `body` (required), `isAutoHide`
 *    (required), `autoHideDuration` (required), `onDismiss` (required, not
 *    `onHide`). No `ToastViewport` exists anywhere in this app yet (same
 *    confirmed gap `OutreachList.tsx` already found) -- `<Toast>` is
 *    rendered directly in normal document flow, per the doc's own guidance
 *    for that scenario.
 *  - `List`/`ListItem` (line 4536 section, Props table + own `undefined`
 *    `ListItem` "Components" subsection, cross-checked via
 *    `node_modules/@astryxdesign/core/dist/List/ListItem.d.ts`, same
 *    citation `OutreachList.tsx`/`MeetingsList.tsx` already made): `children`,
 *    `hasDividers` (List); `label` (ListItem) used.
 *  - `Heading`: doc's own "Components > Heading" subsection is `undefined`
 *    (same disclosed CLI-cross-checked gap every sibling page in this batch
 *    already hit); `npm run astryx -- component Heading` resolves `level`
 *    (required) + `children` (required) -- only those two used.
 *  - `Text` (line 829 section, Props table): `type` (`'supporting'`),
 *    `color` used.
 *  - `VStack`/`HStack` ("Stack" section, `VStack`/`HStack` subsections):
 *    `gap`, `padding`, `hAlign`, `vAlign`, `wrap` used.
 *
 * -----------------------------------------------------------------------
 * 10. T101 (ED-1 Packet P10): real load + real Edit/Cancel wiring.
 *
 * `loadData` now defaults to `loadOutreachDetail`
 * (`../../lib/supabase/loaders/outreach.ts`, a real query resolving `null`
 * for a genuinely nonexistent OR RLS-inaccessible event -- module doc #5's
 * exact contract, unchanged).
 *
 * "Edit" opens the real, already-built `OutreachEventDialog.tsx` (T039) in
 * EDIT mode (`isEventDialogOpen` state). Trap #5's own investigation (this
 * task's own worker output has the full writeup) found -- by reading that
 * dialog's actual source, not by assuming the same finding T096 made for
 * `ScheduleMeetingsDialog.tsx` just because the situation rhymes -- that it
 * genuinely DOES support editing an existing event: its own
 * `OutreachEventDialogProps.initialEvent?: ExistingOutreachEvent` prop, when
 * present, pre-fills every field (loading existing sessions into "Custom
 * dates" mode) and its own `SaveOutreachEventPayload.event.id` carries the
 * existing event's id through to `onSaveEvent`. `buildInitialOutreachEvent`
 * above is the ONE place a real fetched `OutreachDetailEvent`/
 * `OutreachDetailSession[]` pair is reshaped into that dialog's own
 * `ExistingOutreachEvent` shape -- including a genuine UTC-to-Chicago-
 * wall-clock conversion (`formatChicagoWallTime`, the inverse of that
 * dialog's own `chicagoWallTimeToUtcIso`, independently reimplemented here
 * since that function isn't exported) for each session's `startTime`/
 * `endTime`. `handleSaveEventSubmit` wires the dialog's own `onSaveEvent`
 * prop to a real default (`saveOutreachEvent`, same loader module, module
 * doc #5 of that file for the full create-vs-edit reconciliation writeup)
 * and reloads this page's own data (`reloadDetail`) on success.
 *
 * "Cancel event" opens a real `AlertDialog` (DES-11) confirming an
 * event-level cancel, then calls a real mutation (`onCancelEvent`, default
 * `cancelOutreachEvent`, same loader module) that flips every currently-
 * `'scheduled'` session for this event to `'canceled'` -- optimistic local
 * flip + rollback-on-failure, mirroring `MeetingsList.tsx`'s own
 * `handleConfirmCancel` (T096) shape exactly, per this task's own packet
 * steer. This resolves the earlier task's own disclosed "cancel semantics
 * were ambiguous" judgment call (module doc #8 above): the packet's own Trap
 * #4 explicitly specifies "flip `event_sessions.status` to `'canceled'`",
 * scoped here to every still-scheduled session of the event (already-
 * completed sessions are left untouched, preserving their real attendance
 * history).
 *
 * `data`/`reloadDetail` (this file's own local state, kept in sync with
 * every successful `loadState` via a `useEffect`) is the mechanism that lets
 * this page reload/optimistically-mutate its own already-successfully-
 * loaded data in place, without re-triggering the top-level `loading`
 * DES-12 state -- same reasoning `OutreachList.tsx`'s own T101
 * `overrideData`/`reloadOutreachData` seam already established for the
 * identical architectural reason (this page's own single top-level
 * `loadState`, unchanged by this task, needed this narrower seam instead of
 * a larger `CoachMeetingsView`/`StudentMeetingsView`-style restructuring).
 *
 * -----------------------------------------------------------------------
 * 11. T117 (PRD v2 UXP-01): coach-managed attendance panel, staff-only
 *     (Known Context/Traps #5).
 *
 * This page previously had NO role derivation of its own (every prior
 * section rendered identically regardless of viewer role). `useAuth()`
 * (`../../app/guards.tsx`, read-only import, the same auth context
 * `OutreachList.tsx`'s own T101 module doc #6 already wired) is now called
 * unconditionally (React's rules-of-hooks, same posture
 * `OutreachList.tsx`'s own `useActiveSeason()` call already established),
 * and `isStaffViewer` uses the identical `user.role === 'coach' || user.role
 * === 'admin'` check `OutreachList.tsx`'s own `isCoachOrAdminView` already
 * established (that file's own module doc #6 -- only the two role literals
 * present in `guards.tsx`'s `Role` union are compared directly; a real
 * `'student'`/`'parent'` viewer, or nobody signed in at all (`user ===
 * null`), falls through to `false`). `<AttendancePanel>` (new this task) is
 * rendered ONLY when `isStaffViewer` -- a non-staff viewer sees this page
 * completely unchanged from before this task, grep-provable: the
 * `<AttendancePanel>` JSX is inside a single `isStaffViewer &&` guard, no
 * other branch references it. `roster`/`sessions`/`teams` (already computed
 * above for the Signups section) are passed straight through -- structurally
 * compatible with `AttendancePanel.tsx`'s own independently-reimplemented
 * `AttendancePanelSession`/`AttendancePanelStudent`/`AttendancePanelTeam`
 * types (that file's own module doc #1 explains why they are reimplemented
 * rather than imported from here: this file imports `AttendancePanel`, so
 * the reverse import would be circular), so no reshaping happens at this
 * call site. `currentUserProfileId={user.id}` -- `guards.tsx`'s own
 * `resolveSessionToAuthState` sets `AuthUser.id = session.user.id`, and
 * `public.profiles.id` (migration `20260716000000_identity_roster.sql` line
 * 17) is `references auth.users (id)` as its OWN primary key (not a
 * separate column) -- i.e. `profiles.id` and the signed-in `auth.users.id`
 * are the SAME value, so the signed-in coach's `user.id` IS their real
 * `profiles.id`, correctly attributable to `attendance.recorded_by` with no
 * separate lookup needed (unlike `students.id` vs. `students.profile_id`,
 * a genuinely different id space `RsvpControl.tsx`'s own module doc #3
 * already had to disclose).
 *
 * -----------------------------------------------------------------------
 * 12. T127 (PRD v2 UXP-07): "Mark event complete" bulk action, staff-only,
 *     on this page and only this page (packet Objective, verbatim).
 *
 * `isMarkEventCompleteDialogOpen` drives the one rendered
 * `<MarkEventCompleteDialog>` instance (`./MarkEventCompleteDialog.tsx`,
 * this task's own new sibling file -- see that file's own module doc for
 * the full reuse-evidence/partial-failure design writeup). The trigger is a
 * new `"Mark event complete"` `MoreMenu` item, pushed onto `menuItems`
 * ONLY when `isStaffViewer` (module doc #11's own role check, reused
 * unchanged) -- a non-staff viewer's `MoreMenu` is unaffected, grep-provable:
 * the push is inside a single `if (isStaffViewer)` guard, no other branch
 * references this item. `sessions`/`roster`/`rsvps` (already computed above
 * for the Signups section / `AttendancePanel`) are passed straight through
 * -- `MarkEventCompleteDialog` accepts the SAME `MarkDayCompleteSession`/
 * `RosterStudent`/`RsvpRow` shapes `MarkDayCompleteDialog.tsx` already
 * defines (imported by that file, not reshaped here), and this page's own
 * `OutreachDetailSession`/`RosterStudent`/`RsvpRow` types (module doc #1)
 * are structurally identical field-for-field, so no cast/remap is needed at
 * this call site (grep-provable: no `as unknown as`/manual field-mapping
 * function introduced for this wiring). `onFinished={reloadDetail}` is the
 * partial-failure-honesty seam (that dialog's own module doc #3): once the
 * bulk batch finishes (fully or partially), this page refetches its own
 * data so the Signups/`AttendancePanel` sections reflect the real
 * `event_sessions.status`/`people_reached`/`attendance` writes, never a
 * client-only optimistic guess.
 *
 * -----------------------------------------------------------------------
 * 13. T157 (OUT-06, PRD line 297): parent RSVP-on-behalf, mounted here for
 *     the first time.
 *
 * `ParentRsvp.tsx` (T043) has been finished and fully tested since T043 but
 * had ZERO production importers -- its own module doc #4 named this page as
 * the expected future host ("A future page (`ParentHome.tsx`,
 * `OutreachDetail.tsx`) is expected to render one `<ParentRsvp>` per linked
 * student, passing each student's own `studentId`/`studentProfileId`/
 * `guardianLinks` slice"). This task is that host, for this page only.
 * (`RsvpControl.tsx`, the STUDENT-facing self-service counterpart, is now
 * ALSO mounted here, by a later task -- see module doc #14 (T169) below for
 * the full writeup. This sentence previously read "deliberately NOT mounted
 * here"; that is no longer true and is corrected here rather than left
 * standing as a stale record of a decision this file no longer makes.)
 *
 * (a) REAL DATA, NOT FIXTURE DEFAULTS -- the point of the task. Every one of
 * `ParentRsvpProps`'s optional-with-a-plausible-default props is passed a
 * real value at the call site below: `currentUserProfileId={user.id}` (the
 * signed-in parent's own `profiles.id`, module doc #11's own
 * `AuthUser.id === profiles.id` proof -- NOT `ParentRsvp`'s disclosed
 * `PLACEHOLDER_CURRENT_PARENT_PROFILE_ID`), `studentProfileId` from the real
 * new `RosterStudent.profileId`, and `guardianLinks` from a real
 * `guardian_links` fetch. Each of those three is independently mutation-proven
 * in this file's own test: reverting any one of them to its default makes a
 * test fail with a WRONG-BUT-PLAUSIBLE render (a misattributed RSVP, not a
 * crash), which is exactly the defect class this wiring closes.
 *
 * (b) NEW READ-SIDE LOADER WORK, contrary to the ledger's own framing. The
 * RSVP submission path needed nothing (`submitRsvpChange` is already
 * `ParentRsvp`'s own real default -- see the import note above), but the READ
 * side needed two real additions in `loaders/outreach.ts`: `profile_id` on
 * `queryAllStudents`/`StudentDbRow`/`mapStudentDbRowToRosterStudent`, and a
 * new `makeLoadGuardianLinksForParent` factory. Neither existed.
 *
 * (c) SEPARATE LOAD SEAM, fetched only for a parent. `loadGuardianLinksForParent`
 * is its own injectable prop with its own `GuardianLinksLoadState`, mirroring
 * `loadRoster`/`RosterLoadState` (T147 Part A2) exactly rather than being
 * folded into `loadData` -- a coach/admin/student/signed-out viewer must never
 * issue this query at all, which this file's own test proves with a
 * `not.toHaveBeenCalled()` assertion per role. A non-parent viewer therefore
 * sits in `idle` forever; `idle` is the never-fetched variant, not an empty
 * state. A PARENT viewer never observes `idle`: the state initialises to
 * `loading` so the DES-12 loading window is real and observable rather than a
 * blank first paint (which would make a loading-state assertion pass
 * vacuously). "Empty" is a zero-length `ready`, matching this file's own
 * already-shipped `RosterLoadState` mapping of DES-12/item 12 -- a parent with
 * no linked students in scope sees no "Your RSVP" section at all, which is a
 * deliberate, separately-tested choice (there is nothing for them to RSVP
 * for), not a missing state.
 *
 * (d) PER-SESSION, matching module doc #4's OUT-04 discipline. One
 * `<ParentRsvp>` per (session x qualifying linked student), inside the same
 * `orderedSessions.map(...)` loop the signup lists use -- an RSVP is a
 * per-session fact, so a parent with a multi-day event sees one control per
 * day, not one for the whole event.
 *
 * (e) WHICH STUDENTS QUALIFY -- `resolveParentLinkedRosterStudents` above, the
 * one place it is computed, composed over the ALREADY team-scoped `roster`
 * (module doc #3), not the full `students` list. See that function's own doc
 * for why both of its predicates are load-bearing and why this is defence in
 * depth rather than the primary control.
 *
 * (f) THE HEADING IS BOTH THE ACCESSIBILITY REQUIREMENT AND THE TEST ANCHOR
 * (item 15). `SegmentedControl` emits its `label` as an `aria-label`, never as
 * `textContent`, and `ParentRsvp`'s own `controlLabel` carries the event title
 * and session date but NOT the student's name -- so two linked students in one
 * session render two `[role="radiogroup"]` elements with byte-identical
 * accessible names, indistinguishable to a screen reader user and to a test
 * locator alike. The page-owned `Heading level={4}` below carries BOTH the
 * student name and the session date, which disambiguates every
 * (session x student) instance on the page. Dropping the date would leave a
 * two-session single-student event with two identical headings -- the same
 * defect one level up.
 *
 * (g) THE CLOCK SEAM (`nowFn`). `ParentRsvp` locks a control once
 * `now >= session.startsAt` (its own module doc #5, the universal OUT-03
 * rule). This page's `FIXTURE_SESSIONS` are real fixed dates, so any test that
 * clicks a segment button would go permanently red the moment wall-clock time
 * passes those dates -- silently reported as a regression rather than as a
 * test that was never deterministic. `nowFn` (defaulting to the real clock, so
 * production behavior is unchanged) is threaded to every `<ParentRsvp>`'s own
 * already-existing `now` prop so this file's tests pin a fixed instant and are
 * wall-clock-independent forever. A future task adding another `<ParentRsvp>`
 * render site on this page must pass `now={nowFn}` too, or it reintroduces the
 * coupling.
 *
 * -----------------------------------------------------------------------
 * 14. T169 (OutreachDetail half): the STUDENT's own self-service
 *     `RsvpControl`, mounted here for the first time -- supersedes the
 *     "deliberately NOT mounted here" note module doc #13 above previously
 *     carried (now corrected in place, not left standing).
 *
 * (a) NO NEW LOADER WORK -- the opposite finding from T157's own parallel
 * check for `ParentRsvp`. `RsvpControlProps` (`RsvpControl.tsx:430-454`) has
 * no analogue of `ParentRsvp`'s `studentProfileId`/`guardianLinks` props: it
 * is the student's own single control, not a guardian-on-behalf-of-N-children
 * control, so there is no cross-person linkage data to fetch at all. Every
 * prop it needs is already real data this page holds today, post-T157:
 * `studentId` from the resolved roster row's own `id`, `session`/
 * `eventTitle`/`currentRsvp` the same already-computed values `<ParentRsvp>`'s
 * own call site already uses, `currentUserProfileId={user.id}` (module doc
 * #11's `AuthUser.id === profiles.id` proof, which is role-agnostic and so
 * holds for a student viewer exactly as it does for the parent/staff viewers
 * already wired), and `now={nowFn}` -- reusing the SAME clock seam (f) above
 * already anticipated a future `<RsvpControl>` render site would need, rather
 * than building a second one. `onRsvpChange` is left at its default (the real
 * `submitRsvpChange`, the same shared mutation (b) above documents).
 *
 * (b) `resolveOwnRosterStudent` -- self-to-self, NOT cross-person. Unlike
 * `resolveParentLinkedRosterStudents` (e) above, which answers "which of
 * *potentially several other people's* roster rows is this parent authorized
 * to act on" (a genuine cross-person authorization question), this predicate
 * answers a narrower one: "which roster row, if any, IS the signed-in
 * student's own." Composed over the ALREADY team-scoped `roster` (module doc
 * #3), not the full `students` list -- same reasoning (e) above already
 * established: a student's own record for a team outside this event's scope
 * must not surface a control for this event.
 *
 * (c) LOCATOR -- deliberately simpler than `ParentRsvp`'s own page-owned
 * `Heading` (f) above. A student only ever sees their own single control,
 * never another student's, so there is no cross-student `aria-label`
 * collision to disambiguate the way two DIFFERENT linked students in the same
 * session could produce for a parent. `RsvpControl`'s own `controlLabel`
 * (`` `Your RSVP for ${eventTitle} on ${date}` ``) already carries both the
 * event title and the session date, sufficient to disambiguate across this
 * event's own multiple sessions without any new page-owned markup.
 *
 * (d) EMPTY CASE. A student viewer with no matching roster row
 * (`ownRosterStudent === null` -- not on this event's team, or no `students`
 * row at all) sees no self-RSVP control anywhere on this page, with no
 * distinct empty-state message -- the same deliberate, tested "nothing to
 * RSVP for" choice (c) above already made for a parent with zero linked
 * students.
 *
 * -----------------------------------------------------------------------
 * 15. T179 (OUT-05, `docs/swarm/VOLT_Portal_PRD.md:318`): the per-session
 *     "Mark day complete" dialog, mounted here for the first time.
 *
 * `MarkDayCompleteDialog.tsx` (T042) was finished/tested since T042 but had
 * ZERO production importers -- its own module doc previously stated (now
 * corrected, since this task IS that wiring) that `OutreachDetail.tsx`
 * connects it "with its real fetched session/roster/rsvps data". This task is
 * that connection.
 *
 * (a) PART A -- REQUIRED PROPS, NOT FIXTURE DEFAULTS. `MarkDayCompleteDialog`'s
 * `eventTitle`/`session`/`roster`/`rsvps`/`currentUserProfileId` (and
 * `MarkEventCompleteDialog`'s `currentUserProfileId`, which shared the same
 * exported placeholder) were all optional-with-a-fixture-default -- a call
 * site that forgot one compiled cleanly and silently wrote real `attendance`
 * rows for FIXTURE students under a FAKE `recorded_by`. Both files' module
 * docs have the full per-file writeup; this page is the proof the compiler
 * now catches the omission (`tsc` `TS2739`/`TS2741` at the two call sites
 * below if any of these props is dropped).
 *
 * (b) PER-SESSION, NOT PER-EVENT (contrast with module doc #12). Unlike
 * `MarkEventCompleteDialog` (one instance, driven by the staff-only
 * `MoreMenu`, runs every remaining session of the event in one sequential
 * batch), `MarkDayCompleteDialog` takes ONE `session` -- its trigger lives
 * INSIDE this page's own `orderedSessions.map(...)` loop (module doc #4's
 * per-session discipline), never in `menuItems`. `markDayCompleteSessionId:
 * string | null` drives a SINGLE dialog instance, resolved to a real session
 * BY ID at render (`markDayCompleteSession` above) -- not N dialogs inside
 * the loop, which would mean N mounted subtrees, N duplicated labels, N
 * copies of form state for what is, at any moment, at most one open dialog.
 * The whole element (not just `isOpen`) is gated on
 * `markDayCompleteSession !== null`, because `session` is a required prop
 * (a) above -- there is no fixture session left to render against while
 * closed. This still composes correctly with the dialog's own lifecycle: its
 * `onOpenChange(false)` call on a successful submit unmounts this element
 * (this page's own `onOpenChange` handler clears `markDayCompleteSessionId`
 * in response), and its own reset-on-open `useEffect` still fires the next
 * time a different session's trigger mounts it fresh.
 *
 * (c) ELIGIBILITY -- GATED ON THE SESSION *DATE*, NOT `startsAt`. OUT-05's own
 * text (quoted above) reads "on/after a session **date**". `event_sessions
 * .session_date` (module doc #1) is a SQL `date`, a genuinely different
 * column from `starts_at` (a `timestamptz`) -- gating on `startsAt` instead
 * would be a NARROWING of the PRD requirement (constitution item 1: PRD
 * outranks any other prescription), hiding the trigger from a coach standing
 * at a session on its own morning (e.g. 8 AM for a 9 AM session), which
 * "on/after a session date" plainly permits. `isSessionMarkDayCompleteEligible`
 * (exported, own `describe` block in the test file -- matching this file's own
 * convention for `sortSessionsByStart`/`groupSessionSignups`/
 * `resolveOwnRosterStudent`) is the ONE place this is computed: TWO
 * independent halves, `session.status === 'scheduled'` AND
 * `formatChicagoDateOnly(now) >= session.sessionDate` -- a plain ISO-string
 * comparison (both sides are already `YYYY-MM-DD`), needing no `Date`
 * arithmetic and no DST edge case. `formatChicagoDateOnly` reuses this file's
 * own already-declared `CHICAGO_TIME_ZONE` (module doc #9) via
 * `Intl.DateTimeFormat('en-CA', ...)` -- `en-CA` is the one built-in locale
 * whose default format IS `YYYY-MM-DD`. `nowFn` (module doc #13(g)'s own
 * clock seam, already threaded to every `<ParentRsvp>`/`<RsvpControl>`) is
 * reused here rather than a second seam -- `new Date()` is never called
 * directly at this trigger. The dialog's OWN `isSessionEligible = session
 * .status === 'scheduled'` (its own module doc #5(ii)) is an unrelated
 * backstop, unchanged by this task, that only ever checks status -- it is not
 * a duplicate of the date half.
 *
 * (d) N TRIGGERS NEED N DISTINGUISHABLE ACCESSIBLE NAMES (item 15). A
 * multi-session event renders one trigger per session inside the same loop;
 * following OUT-05's literal "Mark day complete" wording alone would render
 * every trigger with the SAME `aria-label` -- indistinguishable to a screen
 * reader and to a test locator alike, the EXACT defect module doc #13(f)
 * above already identified and solved for `<ParentRsvp>`'s own heading. The
 * fix here uses Astryx `Button`'s own documented `label`/`children` split
 * (`astryx-api.md`, Button props: `children` is an optional override for
 * VISIBLE text only; `label` is still required and is what provides the
 * accessible name) -- `label={\`Mark day complete — ${formatSessionDateOnly
 * (session)}\`}` (three sessions -> three distinct accessible names) while
 * `children` keeps the VISIBLE text the same literal "Mark day complete" for
 * every trigger. `formatSessionDateOnly` is the same already-exported
 * function this file already uses for the identical purpose at the
 * `<ParentRsvp>` heading above.
 *
 * (e) NO RESHAPING (Trap 8). This page's `OutreachDetailSession` (module doc
 * #1) is field-for-field `MarkDayCompleteDialog.tsx`'s own
 * `MarkDayCompleteSession`, and this page's `RosterStudent` carries only one
 * EXTRA field (`profileId`, module doc #13) beyond that dialog's own
 * `RosterStudent` -- both assign straight through with no cast, no `as
 * unknown as`, no hand-written mapper. `roster`/`rsvps` passed to the new
 * dialog are the SAME page-level arrays the `MarkEventCompleteDialog` mount
 * (module doc #12) already passes, unfiltered by session -- the dialog's own
 * `computeInitialAttendedStudentIds` filters by `sessionId` itself (that
 * file's own module doc #6), so pre-filtering here would be a second place
 * for that filter to drift out of sync.
 *
 * (f) THE WRITE-THEN-REFETCH COMPOSITION, AND THE `void` DEFECT IT REPLACES.
 * `MarkDayCompleteDialog` has no `onFinished` prop (unlike
 * `MarkEventCompleteDialog`) -- it closes itself on success and surfaces
 * failures in its own error `Banner`, so the page's post-write refetch must
 * be composed INTO `onMarkComplete` itself: `await markDayComplete(payload);
 * reloadDetail().catch(() => {})`. Both halves are load-bearing. `await` on
 * the WRITE means a real write failure still rejects `onMarkComplete`, so the
 * dialog's own `catch` sets its error banner (B6(a)) -- an un-awaited write
 * would let the dialog treat every submission as successful regardless of
 * whether it actually was. `.catch(() => {})` on the RELOAD, not `void`
 * -- `void reloadDetail()` was measured (this task's own premise gate) to
 * leave an unhandled promise rejection whenever the refetch itself rejected
 * after a successful write: `void` discards a promise's VALUE, not its
 * REJECTION. That produced a fully green test file (every assertion passing)
 * that still failed the overall vitest run (`Errors 1 error`, process exit
 * 1) -- green tests, red suite, silently. `.catch(() => {})` absorbs a
 * refetch failure without reporting it as a write failure, which is the
 * correct behavior regardless: the write already committed by the time the
 * refetch runs, so surfacing a refetch failure as "couldn't mark this day
 * complete" would be false AND would invite the coach to retry a write that
 * already succeeded. Part C of this task applies the identical one-line fix
 * to the pre-existing `MarkEventCompleteDialog` mount's own `onFinished`
 * (module doc #12), which had the same defect, latent only because no
 * existing test rejected its reload.
 *
 * (g) EVERY `user !== null` GATE IN THIS FILE IS DEFENSIVE, NOT
 * COMPILER-REQUIRED. This file's role-scoped render sites -- `<ParentRsvp>`,
 * `<RsvpControl>`, `<AttendancePanel>`, this dialog, and the
 * `<OutreachEventDialog>` mount T300 later gated the same way -- each write an
 * explicit `user !== null` beside their `isParentViewer` / `isStudentViewer` /
 * `isStaffViewer` check. That is a deliberate, conventional belt-and-braces
 * choice -- it is NOT what makes `user.id` compile. (Deliberately not stated as
 * a count: this paragraph's earlier revision hard-coded one, and it went stale
 * the moment a gate was added. That is the same failure this section documents.)
 *
 * TypeScript 4.4+ narrows through ALIASED conditions. `user` is a `const`
 * destructured binding (`const { user } = useAuth()`, module doc #11) and
 * each viewer flag is itself a `const` initialised from a condition that
 * begins `user !== null && ...`, so the flag narrows `user` at every one of
 * its own uses, with no separate check.
 *
 * MEASURED TWICE, and the second measurement is the discriminating one.
 * T179's premise gate deleted all three pre-existing null checks at once and
 * got `tsc exit=0`. T301 reproduced that and added the control the first
 * measurement lacked: deleting the checks AND weakening the three flags from
 * `const` to `let` -- which is precisely what defeats aliased-condition
 * narrowing -- fails with `tsc exit=2` and three `TS18047: 'user' is possibly
 * 'null'` errors, one at each `currentUserProfileId={user.id}`. Exit 0 alone
 * would have been consistent with the narrowing coming from somewhere else
 * entirely; the paired run shows it comes from the `const` flags.
 *
 * T301 corrected the two pre-existing comments (at the `<ParentRsvp>` and
 * `<RsvpControl>` gates) that had claimed the opposite -- that the flags are
 * "plain booleans, not type predicates" and so "do not narrow `user`", making
 * the null checks "LOAD-BEARING". They are not load-bearing, and the reason
 * this was worth correcting rather than leaving alone is that the false claim
 * had already begun to propagate by imitation: T179's own packet copied it
 * verbatim and would have written a fourth copy into this very module doc had
 * its gate not caught it. NOTE that the `<AttendancePanel>` gate's own comment
 * never made the claim -- an earlier revision of this paragraph said three
 * comments carried it when only two ever did.
 *
 * -----------------------------------------------------------------------
 * 16. T306 (owner ruling, `docs/swarm/auto-mode-decisions.md`, "2026-08-03 --
 *     George's ruling on T306"): once ANY `attendance` row is recorded for a
 *     session, its Signups block shows what happened, not what was promised.
 *
 * Verbatim, the confusion this closes: *"i was on the UI and adding who
 * attended an outreach event... What was not clear to me on the UI was what
 * to do with the RSVP."* The RSVP buckets (module doc #2) looked actionable
 * to a coach who had just recorded real attendance for the same roster.
 *
 * (a) THE TRIGGER, AND WHY IT TAKES NO `session` AT ALL. The owner's own
 * follow-up ruled out the two obvious triggers himself (verbatim: *"pleae be
 * cognizant of what a 'past' event is. i may be doing this on the same day
 * of the event."*) -- NOT the date (he records attendance ON the event's own
 * day; a date test would show RSVP buckets during the exact workflow that
 * confused him, and would re-open T304, where these surfaces were settled to
 * never consult the date) and NOT `session.status === 'completed'` (while
 * recording attendance the session is normally still `scheduled` -- he has
 * not run "Mark day complete" yet -- so a status test would leave the RSVP
 * buckets up for the whole confusing moment). `hasRecordedAttendance
 * (sessionId, attendanceRows)` below takes ONLY those two arguments --
 * `session.status`/`session.sessionDate` are structurally unreachable inside
 * it, so neither ruled-out trigger can be reintroduced by editing this
 * function in isolation; both are only reachable by changing its ONE call
 * site inside `SessionSignupList` below, which is exactly where this task's
 * own mutations (C6/C7) are aimed and exactly why they need a real render,
 * not a pure-function test, to catch (harness note, this task's packet §7).
 *
 * (b) THE LOAD SEAM SITS ON THE PAGE, NOT ON `SessionSignupList`. Same
 * injectable, real-defaulted convention `AttendancePanel.tsx` (module doc
 * #11, prop `loadAttendance`) and `MarkDayCompleteDialog.tsx` (module doc #9)
 * already ship: `loadAttendance?: LoadAttendanceForSessionsFn`, defaulting to
 * the real `loadAttendanceForSessions`. It is called ONCE, for every session
 * on the page combined (mirrors `AttendancePanel`'s own `sessionIdsKey`
 * shape, not `MarkDayCompleteDialog`'s single-session shape) -- a
 * `SessionSignupList`-scoped seam would mean N independent fetches for an
 * N-session event, one per row, which is the wrong shape for data that is
 * naturally page-scoped (every session's attendance is already fetched in
 * one page-level call for `AttendancePanel` too). The fetch is keyed off
 * `data` -- this component's OWN top-level state (module doc #10), NOT
 * `detailData`/`sessions`, which only exist after the early
 * `loading`/`error`/`notFound` returns further down and so cannot back a
 * hook call placed before them without breaking rules of hooks. `data` starts
 * `null`, so the very first render's key is `''` (an empty `sessionIds`
 * array, which the real loader/the test's own mock both resolve to `[]` for
 * with no network/call-arg cost -- `loaders/attendance.ts`'s own module doc
 * on `makeLoadAttendanceForSessions` documents the empty-array
 * short-circuit); the effect re-fires once `data` populates with the page's
 * real session ids, and again whenever that id SET changes (a session
 * added/removed via edit), never on every unrelated re-render (the
 * `attendanceSessionIdsKey` string-join is the same anti-thrash technique
 * `AttendancePanel`'s own `sessionIdsKey` uses, not a coincidence).
 *
 * (c) THE FALLBACK IS `MarkDayCompleteDialog`'s SHAPE, NOT
 * `MarkEventCompleteDialog`'s. That dialog's own module doc #9 states the
 * distinction this task's packet requires verbatim: a display surface may
 * degrade a failed/in-flight load silently; a surface that WRITES must
 * abort. This section only ever displays -- `attendanceRows` state stays
 * `null` on failure (same "plain `.then`/`.catch`, no retry, no three-state
 * union" shape `MarkDayCompleteDialog`'s own attendance effect uses, module
 * doc #9 there) and every session's trigger treats `null` identically to a
 * genuinely-empty successful load (`attendanceRows ?? []` at the one call
 * site below) -- no error `Banner`, no blocked signups render, no spinner
 * over the RSVP fallback.
 *
 * (d) THE BUCKETING FUNCTION, `groupSessionAttendance`, MIRRORS
 * `groupSessionSignups` (module doc #2) FIELD FOR FIELD: same per-`sessionId`
 * filter, same roster-diff for the one derived bucket (`noRecord`, never a
 * fabricated stored status -- the exact discipline module doc #2 already
 * established for `noResponse`). `isAttendingStatus` is IMPORTED from
 * `AttendancePanel.tsx` (that file's own module doc #4/export, line ~308),
 * never re-derived here: it encodes `present`/`late`, the identical
 * predicate `v_student_hours` (`20260717000003_metric_views.sql:18`) uses to
 * decide which `attendance` rows count as attended, and duplicating a metric
 * formula in a second TypeScript location is constitution item 3's own
 * BLOCKER-class trap.
 *
 * (e) SWITCH PER SESSION, NEVER PER STUDENT (packet §4(c)). `SessionSignupList`
 * computes `showAttendance` ONCE per session and renders EITHER the RSVP
 * buckets OR the attendance buckets for that session's entire roster -- a
 * per-student switch would put two vocabularies in one row and reintroduce
 * the exact confusion this task exists to remove.
 *
 * (f) NO WRITE PATH (packet §5). `OutreachList.tsx:1685-1687`'s T121 finding
 * still governs: "RSVP is intent, not a real attendance record." Nothing in
 * this module doc's own load seam, `groupSessionAttendance`, or
 * `hasRecordedAttendance` ever constructs an `rsvps`-shaped write -- this is
 * a display change only, grep-provable: no `rsvps` insert/update/upsert call
 * is introduced anywhere in this file by this task.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useParams } from 'react-router-dom';
import {
  AlertDialog,
  Banner,
  Button,
  EmptyState,
  Heading,
  HStack,
  Link,
  List,
  ListItem,
  MetadataList,
  MetadataListItem,
  MoreMenu,
  Skeleton,
  Text,
  Toast,
  VisuallyHidden,
  VStack,
  type DropdownMenuOption,
} from '@astryxdesign/core';
import { isSupabaseLoaderError } from '../../lib/supabase';
// T117 (PRD v2 UXP-01): role-derivation seam -- module doc #11. Read-only
// import, same shared auth context `OutreachList.tsx`'s own T101 wiring
// already uses.
import { useAuth } from '../../app/guards';
// T101 (ED-1 Packet P10): real load/edit/cancel wiring -- module doc #10.
// `saveOutreachEvent`/`cancelOutreachEvent`/`OutreachEventDialog` are this
// task's own wiring of an ALREADY-BUILT, ALREADY-PASSED standalone dialog
// into this page for the first time; nothing inside `OutreachEventDialog.tsx`
// itself is modified (forbidden/read-only file).
import {
  cancelOutreachEvent,
  loadGuardianLinksForParent as defaultLoadGuardianLinksForParent,
  loadOutreachDetail,
  loadOutreachEventRoster,
  // T179 (module doc #15) -- the real `MarkDayCompleteDialog` onMarkComplete
  // mutation, composed into the page's own `reloadDetail()` at the new mount
  // below (module doc #15 has the full write-then-refetch writeup).
  markDayComplete,
  saveOutreachEvent,
  type LoadGuardianLinksForParentFn,
  type LoadOutreachEventRosterFn,
} from '../../lib/supabase/loaders/outreach';
import {
  OutreachEventDialog,
  type ExistingOutreachEvent,
  type OnSaveOutreachEventFn,
  type OutreachRosterStudent,
} from './OutreachEventDialog';
// T117 (PRD v2 UXP-01): the new coach-managed attendance panel -- module
// doc #11.
// T306 (module doc #16(d)) -- `isAttendingStatus` joins this same import:
// the ONE semantic owner of "which recorded `attendance.status` values count
// as attending", reused verbatim rather than re-derived (constitution item
// 3). `AttendancePanel.tsx` is a Forbidden File for this task (read-only
// reference/import only -- not modified).
import { AttendancePanel, isAttendingStatus } from './AttendancePanel';
// T306 (module doc #16(b)) -- the injectable load seam for this page's own
// attendance-vs-RSVP trigger. `loaders/attendance.ts` is W1's Forbidden File
// for this task (read-only reference/import only -- not modified).
import {
  loadAttendanceForSessions,
  type AttendanceRow,
  type LoadAttendanceForSessionsFn,
} from '../../lib/supabase/loaders/attendance';
// T127 (PRD v2 UXP-07): "Mark event complete" bulk action -- module doc #12.
// Not given its own injectable override prop here, same posture
// `AttendancePanel` above already established (module doc #11): the dialog's
// own `onMarkSessionComplete` prop already defaults to the real
// `markDayComplete` mutation internally.
import { MarkEventCompleteDialog } from './MarkEventCompleteDialog';
// T179 (PRD OUT-05, line 318): the per-session "Mark day complete" dialog --
// finished/tested since T042 but, until this task, had zero production
// importers. Module doc #15 has the full wiring writeup, including why this
// mount is separate from `MarkEventCompleteDialog` above (that one runs the
// whole event's remaining sessions in one bulk batch; this one is the
// single-session flow it is modeled on).
import { MarkDayCompleteDialog, type MarkDayCompletePayload } from './MarkDayCompleteDialog';
// T157 (OUT-06): the parent-facing RSVP-on-behalf control -- module doc #13.
// `GuardianLinkRow` is REUSED from that component's own export rather than
// redeclared page-locally: this page must import the component anyway, so
// reusing the exported prop contract of a thing it already calls removes a
// hand-sync seam rather than adding one (module doc #13). Not given its own
// injectable `onRsvpChange` override prop here -- same posture
// `MarkEventCompleteDialog` above already established (module doc #12): that
// component's own default is already the real `submitRsvpChange` mutation
// (`ParentRsvp.tsx` module doc #7).
import { ParentRsvp, type GuardianLinkRow } from './ParentRsvp';
// T169 (OutreachDetail half, module doc #14): the STUDENT-facing self-service
// RSVP control -- finished/tested since T040 but, until this task, had zero
// production importers. Named import, matching how `ParentRsvp` above is
// imported (`RsvpControl.tsx` also has a default export, unused here).
import { RsvpControl } from './RsvpControl';

// ---------------------------------------------------------------------------
// Types -- verbatim camelCase renames of real column subsets. Module doc #1.
// ---------------------------------------------------------------------------

export type EventType = 'meeting' | 'outreach' | 'competition';
export type SessionStatus = 'scheduled' | 'completed' | 'canceled';
export type RsvpStatus = 'going' | 'maybe' | 'declined';

export interface TeamOption {
  id: string;
  name: string;
  /** T143 (UXC-05 part 2/3) -- `teams.color text not null`
   * (`20260716000000_identity_roster.sql:34`), REQUIRED so `tsc` forces
   * every construction site (this interface's own two object-literal sites
   * below, plus `AttendancePanel.tsx`'s structurally-matched
   * `AttendancePanelTeam`) to supply a real value rather than letting the
   * colour silently never reach the chip it drives. Free text, no check
   * constraint -- may not be one of Astryx's known `TokenColor` values; the
   * consumer (`AttendancePanel.tsx`'s resolver) is the one place that is
   * handled. */
  color: string;
}

export interface ProfileOption {
  id: string;
  name: string;
}

export interface RosterStudent {
  id: string;
  name: string;
  teamId: string;
  /** T157 (module doc #13): that student's own `profiles.id`
   * (`students.profile_id`), or `null` when the student has no linked account
   * yet -- the column is nullable
   * (`20260716000000_identity_roster.sql`). A DIFFERENT id space than `id`
   * (a `students.id`). REQUIRED, not optional-with-a-default: an optional
   * field would reintroduce the exact "plausible default, silent
   * misattribution" defect this task exists to close -- with `studentProfileId`
   * silently `null`, `ParentRsvp.tsx`'s `resolveRsvpResponderAttribution`
   * cannot match the self case (its module doc #2(b)) and wrongly renders
   * "Someone else recorded this response on your student's behalf" over a
   * student's own answer. Same "page-local type grows one new field for a real
   * need" move `OutreachDetailEvent` above already made for T101, which itself
   * cites `loaders/students.ts :: TeamRow.archived` as the precedent. */
  profileId: string | null;
}

export interface OutreachDetailEvent {
  id: string;
  seasonId: string;
  type: EventType;
  title: string;
  description: string;
  locationName: string;
  address: string;
  /** `null` = all teams (matches `events.team_ids` NULL semantics, module
   * doc #1/#3). */
  teamIds: string[] | null;
  /** `events.created_by` is a nullable `profiles` FK (module doc #1). */
  createdBy: string | null;
  /** T101 (module doc #10) -- four real `events` columns this type did not
   * previously carry, added specifically so `buildInitialOutreachEvent`
   * below can pre-fill a real edit-mode `OutreachEventDialog` without
   * inventing values. Same "page-local type grows one new field for a real
   * need" precedent `loaders/students.ts`'s own module doc already
   * established for `StudentsTab.tsx`'s local `TeamRow.archived`. */
  countsParticipation: boolean;
  countsVolunteerHours: boolean;
  adultVolunteersCount: number;
  adultVolunteerHours: number;
}

export interface OutreachDetailSession {
  id: string;
  eventId: string;
  sessionDate: string;
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
  peopleReached: number | null;
  notes: string;
}

export interface RsvpRow {
  id: string;
  sessionId: string;
  studentId: string;
  status: RsvpStatus;
  respondedBy: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface OutreachDetailData {
  event: OutreachDetailEvent;
  sessions: readonly OutreachDetailSession[];
  rsvps: readonly RsvpRow[];
  students: readonly RosterStudent[];
  teams: readonly TeamOption[];
  profiles: readonly ProfileOption[];
}

/**
 * `null` = "not found / inaccessible" -- the designed DES-12/NAV-08 signal
 * (module doc #5). Distinct from a REJECTED promise, which represents a
 * transient fetch failure, not an invalid/inaccessible id.
 */
export type LoadOutreachDetailFn = (eventId: string) => Promise<OutreachDetailData | null>;

export interface SessionSignupGroups {
  going: RosterStudent[];
  maybe: RosterStudent[];
  cantGo: RosterStudent[];
  noResponse: RosterStudent[];
}

/** T306 (module doc #16(d)) -- `groupSessionSignups`'s attendance-side
 * counterpart. `attended` mirrors `isAttendingStatus` (`present`/`late`);
 * `excused`/`absent` are the two remaining real `attendance.status` values
 * (`loaders/attendance.ts :: AttendanceStatus`); `noRecord` is DERIVED by
 * diffing the roster, exactly as `noResponse` is above -- never a fabricated
 * stored status. */
export interface SessionAttendanceGroups {
  attended: RosterStudent[];
  excused: RosterStudent[];
  absent: RosterStudent[];
  noRecord: RosterStudent[];
}

// ---------------------------------------------------------------------------
// Fixture data (constitution item 6: fabricated names only). Module doc #7.
// ---------------------------------------------------------------------------

const PLACEHOLDER_SEASON_ID = 'season-placeholder-current';

const FIXTURE_TEAMS: readonly TeamOption[] = [
  { id: 'team-ravens', name: 'Ravens', color: 'blue' },
  { id: 'team-titans', name: 'Titans', color: 'green' },
];

const FIXTURE_PROFILES: readonly ProfileOption[] = [
  { id: 'profile-coach-owens', name: 'Jordan Owens' },
];

// T157: `profileId` is a `profiles.id` -- a DIFFERENT id space than `id`, which
// is a `students.id` (module doc #13). Deliberately prefixed `profile-` so the
// two can never be confused at a glance in a fixture, and deliberately non-null
// for all five so any test needing a real self-vs-guardian attribution
// distinction has a concrete value to assert against.
const FIXTURE_STUDENTS: readonly RosterStudent[] = [
  {
    id: 'student-amara-chen',
    name: 'Amara Chen',
    teamId: 'team-ravens',
    profileId: 'profile-amara-chen',
  },
  {
    id: 'student-marcus-bello',
    name: 'Marcus Bello',
    teamId: 'team-ravens',
    profileId: 'profile-marcus-bello',
  },
  {
    id: 'student-nina-ortiz',
    name: 'Nina Ortiz',
    teamId: 'team-ravens',
    profileId: 'profile-nina-ortiz',
  },
  {
    id: 'student-sofia-delgado',
    name: 'Sofia Delgado',
    teamId: 'team-titans',
    profileId: 'profile-sofia-delgado',
  },
  {
    id: 'student-ravi-kapoor',
    name: 'Ravi Kapoor',
    teamId: 'team-titans',
    profileId: 'profile-ravi-kapoor',
  },
];

const FIXTURE_EVENTS: readonly OutreachDetailEvent[] = [
  {
    id: 'event-food-bank-sort',
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'outreach',
    title: 'Community Food Bank Sort',
    description: 'Sorting and packing donated groceries for weekend distribution.',
    locationName: 'Riverside Food Bank',
    // Deliberately contains a space, comma, and "#" -- module doc #6's own
    // URL-encoding proof needs real special characters to be meaningful.
    address: '100 Riverside Dr, Suite #4',
    teamIds: null, // all teams
    createdBy: 'profile-coach-owens',
    // T101 -- CMP-02's real outreach defaults (matches
    // `OutreachEventDialog.tsx`'s own `OUTREACH_FIXED_FLAGS`).
    countsParticipation: false,
    countsVolunteerHours: true,
    adultVolunteersCount: 4,
    adultVolunteerHours: 12,
  },
  {
    id: 'event-park-cleanup',
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'outreach',
    title: 'Riverside Park Cleanup',
    description: 'Litter pickup and trail maintenance along the riverside path.',
    locationName: 'Riverside Park',
    address: '250 Parkway Ave',
    teamIds: ['team-ravens'], // module doc #3 -- team-scoped roster proof.
    createdBy: null, // module doc's "Unknown creator" fallback proof.
    countsParticipation: false,
    countsVolunteerHours: true,
    adultVolunteersCount: 0,
    adultVolunteerHours: 0,
  },
];

const FIXTURE_SESSIONS: readonly OutreachDetailSession[] = [
  {
    id: 'session-food-bank-day1',
    eventId: 'event-food-bank-sort',
    sessionDate: '2026-08-02',
    startsAt: '2026-08-02T14:00:00.000Z', // 9:00 AM America/Chicago (CDT)
    endsAt: '2026-08-02T17:00:00.000Z',
    status: 'scheduled',
    peopleReached: null,
    notes: '',
  },
  {
    id: 'session-food-bank-day2',
    eventId: 'event-food-bank-sort',
    sessionDate: '2026-08-09',
    startsAt: '2026-08-09T14:00:00.000Z',
    endsAt: '2026-08-09T17:00:00.000Z',
    status: 'scheduled',
    peopleReached: null,
    notes: '',
  },
  {
    id: 'session-park-cleanup',
    eventId: 'event-park-cleanup',
    sessionDate: '2026-07-26',
    startsAt: '2026-07-26T15:00:00.000Z', // 10:00 AM America/Chicago
    endsAt: '2026-07-26T17:00:00.000Z',
    status: 'scheduled',
    peopleReached: null,
    notes: '',
  },
];

const FIXTURE_RSVPS: readonly RsvpRow[] = [
  // session-food-bank-day1 -- all four buckets deliberately present
  // (roster = all 5 students, event.teamIds is null).
  {
    id: 'rsvp-1',
    sessionId: 'session-food-bank-day1',
    studentId: 'student-amara-chen',
    status: 'going',
    respondedBy: 'profile-amara-chen',
    updatedAt: '2026-07-20T09:00:00.000Z',
    createdAt: '2026-07-20T09:00:00.000Z',
  },
  {
    id: 'rsvp-2',
    sessionId: 'session-food-bank-day1',
    studentId: 'student-marcus-bello',
    status: 'maybe',
    respondedBy: 'profile-marcus-bello',
    updatedAt: '2026-07-20T09:05:00.000Z',
    createdAt: '2026-07-20T09:05:00.000Z',
  },
  {
    id: 'rsvp-3',
    sessionId: 'session-food-bank-day1',
    studentId: 'student-sofia-delgado',
    status: 'declined',
    respondedBy: 'profile-sofia-delgado',
    updatedAt: '2026-07-20T09:10:00.000Z',
    createdAt: '2026-07-20T09:10:00.000Z',
  },
  // Nina Ortiz + Ravi Kapoor deliberately have NO rsvp row for this session
  // -- the derived "No response" case (module doc #2).

  // session-food-bank-day2 -- a different mix (per-session grouping proof,
  // module doc #4): both Maybe and Can't go are empty here.
  {
    id: 'rsvp-4',
    sessionId: 'session-food-bank-day2',
    studentId: 'student-nina-ortiz',
    status: 'going',
    respondedBy: 'profile-nina-ortiz',
    updatedAt: '2026-07-21T09:00:00.000Z',
    createdAt: '2026-07-21T09:00:00.000Z',
  },
  {
    id: 'rsvp-5',
    sessionId: 'session-food-bank-day2',
    studentId: 'student-ravi-kapoor',
    status: 'going',
    respondedBy: 'profile-ravi-kapoor',
    updatedAt: '2026-07-21T09:05:00.000Z',
    createdAt: '2026-07-21T09:05:00.000Z',
  },
  // Amara, Marcus, Sofia deliberately unanswered for day2.

  // session-park-cleanup -- team-scoped roster (event.teamIds = ['team-ravens']
  // -- Sofia/Ravi, both Titans, are OUTSIDE this roster entirely).
  {
    id: 'rsvp-6',
    sessionId: 'session-park-cleanup',
    studentId: 'student-amara-chen',
    status: 'going',
    respondedBy: 'profile-amara-chen',
    updatedAt: '2026-07-18T09:00:00.000Z',
    createdAt: '2026-07-18T09:00:00.000Z',
  },
  {
    id: 'rsvp-7',
    sessionId: 'session-park-cleanup',
    studentId: 'student-nina-ortiz',
    status: 'declined',
    respondedBy: 'profile-nina-ortiz',
    updatedAt: '2026-07-18T09:05:00.000Z',
    createdAt: '2026-07-18T09:05:00.000Z',
  },
  // Marcus Bello (Ravens) has no rsvp row for this session -- "No response".
];

// ---------------------------------------------------------------------------
// Pure functions -- exported for direct testing. Module docs #2/#3/#4/#5/#6.
// ---------------------------------------------------------------------------

/** Module doc #3 -- `events.team_ids` NULL/array roster resolution. */
export function resolveEventRoster(
  event: OutreachDetailEvent,
  students: readonly RosterStudent[],
): RosterStudent[] {
  if (event.teamIds === null) return [...students];
  const teamIdSet = new Set(event.teamIds);
  return students.filter((student) => teamIdSet.has(student.teamId));
}

/**
 * THE CENTRAL TRAP (module doc #2) -- the ONE place the four signup buckets
 * are computed, per SESSION (module doc #4), by diffing `roster` against
 * whichever `rsvps` rows actually exist for `sessionId`. "No response" is
 * derived, never a fabricated fourth stored status.
 */
export function groupSessionSignups(
  sessionId: string,
  roster: readonly RosterStudent[],
  rsvps: readonly RsvpRow[],
): SessionSignupGroups {
  const rsvpByStudentId = new Map(
    rsvps
      .filter((rsvp) => rsvp.sessionId === sessionId)
      .map((rsvp) => [rsvp.studentId, rsvp] as const),
  );
  const going: RosterStudent[] = [];
  const maybe: RosterStudent[] = [];
  const cantGo: RosterStudent[] = [];
  const noResponse: RosterStudent[] = [];
  for (const student of roster) {
    const rsvp = rsvpByStudentId.get(student.id);
    if (rsvp === undefined) {
      noResponse.push(student); // Diffed, not a stored value (module doc #2).
      continue;
    }
    if (rsvp.status === 'going') going.push(student);
    else if (rsvp.status === 'maybe') maybe.push(student);
    else cantGo.push(student); // 'declined' -- OUT-04's "Can't go" bucket.
  }
  return { going, maybe, cantGo, noResponse };
}

/**
 * T306 (module doc #16(a)) -- THE TRIGGER, expressed as narrowly as possible
 * on purpose. Takes ONLY `sessionId` and `attendanceRows` -- no `session`
 * object, so `session.status`/`session.sessionDate` are structurally
 * unreachable here. The owner ruled out both of those himself
 * (`auto-mode-decisions.md`, "2026-08-03 -- George's ruling on T306"): not
 * the date (he records attendance the same day the event happens) and not
 * `session.status === 'completed'` (the session is normally still
 * `scheduled` while he is recording). Any rows recorded for this session ->
 * real data exists -> show it. No rows -> RSVP intent is the only
 * information that exists -> show that instead.
 */
export function hasRecordedAttendance(
  sessionId: string,
  attendanceRows: readonly AttendanceRow[],
): boolean {
  return attendanceRows.some((row) => row.sessionId === sessionId);
}

/**
 * T306 (module doc #16(d)) -- `groupSessionSignups`'s attendance-side
 * counterpart, same per-`sessionId` filter / roster-diff shape.
 * `isAttendingStatus` (imported from `AttendancePanel.tsx`, never
 * re-derived) decides `attended`; the two remaining real `attendance.status`
 * values each get their own bucket; a roster student with no row at all for
 * this session lands in `noRecord`, diffed from the roster exactly as
 * `groupSessionSignups`'s own `noResponse` is, never a fabricated status.
 */
export function groupSessionAttendance(
  sessionId: string,
  roster: readonly RosterStudent[],
  attendanceRows: readonly AttendanceRow[],
): SessionAttendanceGroups {
  const rowByStudentId = new Map(
    attendanceRows
      .filter((row) => row.sessionId === sessionId)
      .map((row) => [row.studentId, row] as const),
  );
  const attended: RosterStudent[] = [];
  const excused: RosterStudent[] = [];
  const absent: RosterStudent[] = [];
  const noRecord: RosterStudent[] = [];
  for (const student of roster) {
    const row = rowByStudentId.get(student.id);
    if (row === undefined) {
      noRecord.push(student); // Diffed, not a stored value (module doc #16(d)).
      continue;
    }
    if (isAttendingStatus(row.status)) attended.push(student);
    else if (row.status === 'excused') excused.push(student);
    else if (row.status === 'absent') absent.push(student);
  }
  return { attended, excused, absent, noRecord };
}

/**
 * T157 (module doc #13) -- the ONE place "which students does this parent get
 * an RSVP-on-behalf control for, on THIS event" is computed, matching this
 * file's own established `resolveEventRoster`/`groupSessionSignups` convention.
 *
 * Two independent predicates, each load-bearing and each separately tested:
 *  (a) `link.parentProfileId === parentProfileId` -- only the SIGNED-IN
 *      parent's own links count. The `own_read` RLS policy on `guardian_links`
 *      is a DISJUNCTION (`parent_profile_id = auth.uid() or student_id in
 *      (select my_student_ids())`), so the rows a viewer is permitted to read
 *      are not automatically self-scoped: a co-guardian row for the same
 *      student, carrying a different `parent_profile_id`, is readable and must
 *      not grant this viewer a control.
 *  (b) membership in `roster` -- note this filters the ALREADY team-scoped
 *      roster from `resolveEventRoster`, not the full `students` list: a
 *      parent's linked student who is outside this event's team scope must not
 *      get a control for this event, matching every other section on this
 *      page's team-scope discipline (module doc #3). The composition order is
 *      the point; a filter that is correct in isolation but wired against the
 *      wrong upstream array is the defect this separation guards.
 *
 * This is defence in depth, NOT the primary control. `students`'
 * `own_or_linked_read` RLS policy (`id in (select my_student_ids())`) already
 * server-scopes the roster, and `rsvps`' own write/update policies require
 * `student_id in (select my_student_ids()) and responded_by = auth.uid()`, so
 * a wrong client-side filter here cannot by itself surface or write another
 * family's data. It is still tested as an authorization predicate in its own
 * right, because an untested one is a real defect class regardless of what a
 * second layer happens to catch.
 */
export function resolveParentLinkedRosterStudents(
  roster: readonly RosterStudent[],
  guardianLinks: readonly GuardianLinkRow[],
  parentProfileId: string,
): RosterStudent[] {
  const linkedStudentIds = new Set(
    guardianLinks
      .filter((link) => link.parentProfileId === parentProfileId)
      .map((link) => link.studentId),
  );
  return roster.filter((student) => linkedStudentIds.has(student.id));
}

/** T169 (module doc #14(b)): which roster row, if any, is the signed-in
 * STUDENT's own. Composed over the ALREADY team-scoped `roster` (module doc
 * #3), not the full `students` list -- same reasoning as
 * `resolveParentLinkedRosterStudents` (module doc #13(e)): a student's own
 * record for a team outside this event's scope must not surface a control
 * for this event. `AuthUser.id === profiles.id` (module doc #11), so
 * `userProfileId` here is the signed-in student's own `user.id`. Self-to-self
 * matching, not person-to-person -- a student maps to exactly one roster row,
 * never several, so this returns a single row or `null`, not an array. */
export function resolveOwnRosterStudent(
  roster: readonly RosterStudent[],
  userProfileId: string,
): RosterStudent | null {
  return roster.find((student) => student.profileId === userProfileId) ?? null;
}

export function sortSessionsByStart(
  sessions: readonly OutreachDetailSession[],
): OutreachDetailSession[] {
  return [...sessions].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/** "When" `MetadataListItem` value -- a compact summary across every
 * session (the per-session date/time detail itself lives in each
 * `SessionSignupList` heading, module doc #4). */
export function formatWhenSummary(sessions: readonly OutreachDetailSession[]): string {
  if (sessions.length === 0) return 'No sessions scheduled yet.';
  const sorted = sortSessionsByStart(sessions);
  if (sorted.length === 1) return formatSessionDateTime(sorted[0]);
  const first = sorted[0];
  const last = sorted[sorted.length - 1];
  return `${sorted.length} sessions, ${formatSessionDateOnly(first)} – ${formatSessionDateOnly(last)}`;
}

/** "Scope" `MetadataListItem` value -- `events.team_ids` NULL/array
 * semantics (module doc #1/#3), rendered as team names, not raw ids. */
export function formatScopeLabel(
  teamIds: readonly string[] | null,
  teams: readonly TeamOption[],
): string {
  if (teamIds === null) return 'All teams';
  const names = teamIds
    .map((id) => teams.find((team) => team.id === id)?.name)
    .filter((name): name is string => name !== undefined);
  return names.length > 0 ? names.join(', ') : 'No teams';
}

/** "Created by" `MetadataListItem` value -- `events.created_by` is
 * NULLABLE (module doc #1), and a non-null id may not resolve against the
 * fixture/real profile set either; both cases fall back to the same
 * generic, honest label (never a blank/undefined render). */
export function resolveCreatorName(
  createdBy: string | null,
  profiles: readonly ProfileOption[],
): string {
  if (createdBy === null) return 'Unknown creator';
  return profiles.find((profile) => profile.id === createdBy)?.name ?? 'Unknown creator';
}

/** Module doc #6 -- a PLAIN Google Maps URL built from the address, not an
 * embedded map/iframe/SDK integration. `encodeURIComponent` handles every
 * special character (spaces, commas, "#", etc.) the fixture address
 * deliberately exercises. */
export function buildGoogleMapsUrl(address: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

/** Module doc #6 -- the ONE place the copied "Copy link" URL string is
 * built: the real `/outreach/:eventId` route this page is mounted at, with
 * the real event id interpolated. */
export function buildOutreachDetailUrl(eventId: string, origin: string): string {
  return `${origin}/outreach/${eventId}`;
}

/** Module doc #6/#7 -- a thin, directly-testable wrapper around the real
 * (when present) `navigator.clipboard.writeText` Web API. Silently
 * absorbed when the API is unavailable (e.g. an insecure context, or this
 * project's own `jsdom` test environment when not explicitly mocked) --
 * the "Link copied" `Toast` fires regardless (module doc #6), since the
 * constructed URL/toast are this component's own, fully-provable
 * responsibility, independent of whether the OS clipboard write itself
 * succeeds in any given browser/environment. */
export async function copyTextToClipboard(text: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
  }
}

// ---------------------------------------------------------------------------
// Fixture loader -- obviously-fake default for the injectable `loadData`
// seam (module doc #5/#7).
// ---------------------------------------------------------------------------

export async function defaultLoadOutreachDetail(
  eventId: string,
): Promise<OutreachDetailData | null> {
  const event = FIXTURE_EVENTS.find((candidate) => candidate.id === eventId);
  if (event === undefined) return null; // Module doc #5 -- DES-12/NAV-08 signal.
  return {
    event,
    sessions: FIXTURE_SESSIONS.filter((session) => session.eventId === eventId),
    rsvps: FIXTURE_RSVPS,
    students: FIXTURE_STUDENTS,
    teams: FIXTURE_TEAMS,
    profiles: FIXTURE_PROFILES,
  };
}

// ---------------------------------------------------------------------------
// NFR-09 date/time formatting -- timestamps stored UTC, displayed
// America/Chicago. Independently reimplemented here (not imported) --
// `OutreachList.tsx`/`RsvpControl.tsx` are not in this task's Allowed Files.
// ---------------------------------------------------------------------------

const CHICAGO_TIME_ZONE = 'America/Chicago';

const WEEKDAY_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: CHICAGO_TIME_ZONE,
});

const CLOCK_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: CHICAGO_TIME_ZONE,
});

function parseDateOnly(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)); // noon UTC avoids DST edge cases
}

export function formatSessionDateOnly(session: OutreachDetailSession): string {
  return WEEKDAY_DATE_FORMATTER.format(parseDateOnly(session.sessionDate));
}

export function formatSessionDateTime(session: OutreachDetailSession): string {
  const startText = CLOCK_TIME_FORMATTER.format(new Date(session.startsAt));
  const endText = CLOCK_TIME_FORMATTER.format(new Date(session.endsAt));
  return `${formatSessionDateOnly(session)} · ${startText}–${endText}`;
}

/** T101 (module doc #10) -- `starts_at`/`ends_at` (UTC) -> zero-padded
 * `"HH:MM"` Chicago wall-clock time, the exact shape
 * `OutreachEventDialog.tsx`'s own `ExistingOutreachEventSession.startTime`/
 * `endTime` (and `createISOTimeString`) expect. `formatToParts` (not a plain
 * locale-formatted string) is used deliberately -- the same defensive
 * pattern `OutreachEventDialog.tsx`'s own `getTimeZoneOffsetMinutes` already
 * established -- so this never depends on `en-US`'s exact separator/spacing
 * conventions for a 24-hour clock. */
const CHICAGO_24H_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: CHICAGO_TIME_ZONE,
});

export function formatChicagoWallTime(isoDateTime: string): string {
  const parts = CHICAGO_24H_TIME_FORMATTER.formatToParts(new Date(isoDateTime));
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}

/** T179 (module doc #15) -- `now` (an `Intl`-formattable instant) rendered as
 * a plain `YYYY-MM-DD` Chicago-local calendar date, via `Intl.DateTimeFormat`'s
 * `'en-CA'` locale (the one built-in locale whose default date format IS
 * `YYYY-MM-DD`, so no manual zero-padding/reassembly is needed). Reuses this
 * file's own `CHICAGO_TIME_ZONE` (declared above, module doc #9) -- not
 * redeclared. Used ONLY to compare against `event_sessions.session_date`
 * (already a `YYYY-MM-DD` SQL `date`, module doc #1), which sorts correctly
 * as a plain ISO string -- no `Date` arithmetic, no DST edge case. */
const CHICAGO_DATE_ONLY_FORMATTER = new Intl.DateTimeFormat('en-CA', {
  timeZone: CHICAGO_TIME_ZONE,
});

function formatChicagoDateOnly(now: Date): string {
  return CHICAGO_DATE_ONLY_FORMATTER.format(now);
}

/** T179 (module doc #15) -- OUT-05 (`docs/swarm/VOLT_Portal_PRD.md:318`):
 * "on/after a session **date**, Mark day complete opens a `Dialog`". The PRD
 * says DATE, not `starts_at` (a `timestamptz`) -- gating on `startsAt` would
 * be a narrowing that hides the trigger from a coach on the session's own
 * morning (e.g. 8 AM for a 9 AM session), which "on/after a session date"
 * plainly permits. `sessionDate`/`now` are compared as plain
 * `YYYY-MM-DD` strings, which sorts correctly since both are ISO dates
 * (module doc #1 / `formatChicagoDateOnly` above) -- never `Date` arithmetic.
 * `session.status === 'scheduled'` is the second, independent half: an
 * already-`completed`/`canceled` session is never eligible regardless of the
 * clock (this dialog's own `isSessionEligible` backstop, unchanged, restates
 * this same rule one layer down -- module doc #15 below). */
export function isSessionMarkDayCompleteEligible(
  session: OutreachDetailSession,
  now: Date,
): boolean {
  return session.status === 'scheduled' && formatChicagoDateOnly(now) >= session.sessionDate;
}

/**
 * T121 item (b) (UXP-04 outreach half) -- distinct student ids with an
 * existing `status='going'` RSVP on ANY of the given sessions. The ONE
 * place this page derives the "Expected attendees" checklist prefill from
 * real RSVP rows it already loads (this page's own `rsvps`, already fetched
 * by `loadOutreachDetail` -- no new query). Not scoped to still-`scheduled`
 * sessions only -- the packet's own wording is "the event's existing
 * 'going' RSVPs", unqualified by session status, matching
 * `OutreachList.tsx`'s own identical `deriveExpectedStudentIds` (that
 * file's own Allowed Files, independently reimplemented here per this
 * module's own "not imported across `OutreachList.tsx`/`OutreachDetail.tsx`"
 * convention, module doc #1).
 */
export function deriveExpectedStudentIds(
  sessions: readonly OutreachDetailSession[],
  rsvps: readonly RsvpRow[],
): string[] {
  const sessionIds = new Set(sessions.map((session) => session.id));
  const ids = new Set<string>();
  for (const rsvp of rsvps) {
    if (rsvp.status === 'going' && sessionIds.has(rsvp.sessionId)) ids.add(rsvp.studentId);
  }
  return [...ids];
}

/** T101 (module doc #10, Trap #5) -- the ONE place a real fetched
 * `OutreachDetailEvent`/`OutreachDetailSession[]` pair is reshaped into
 * `OutreachEventDialog.tsx`'s own real `ExistingOutreachEvent` edit-mode
 * shape. T121 item (b) UPDATE: now also takes this event's own `rsvps` so
 * `expectedStudentIds` can be prefilled from real data instead of being left
 * `undefined` (which the dialog treats as "prefill an empty checklist" --
 * honest for a brand-new event, but wrong for an event students have
 * already RSVP'd to). */
export function buildInitialOutreachEvent(
  event: OutreachDetailEvent,
  sessions: readonly OutreachDetailSession[],
  rsvps: readonly RsvpRow[],
): ExistingOutreachEvent {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    locationName: event.locationName,
    address: event.address,
    // `OutreachEventDialog.tsx`'s own type Selector only ever offers
    // 'outreach'/'competition' (that file's own module doc #1 -- 'meeting'
    // is deliberately excluded there). This route is only ever navigated to
    // for a real outreach/competition event in practice; any other real
    // `events.type` value collapses to 'outreach' here, a disclosed,
    // defensible fallback rather than a crash.
    type: event.type === 'competition' ? 'competition' : 'outreach',
    countsParticipation: event.countsParticipation,
    countsVolunteerHours: event.countsVolunteerHours,
    teamIds: event.teamIds,
    adultVolunteersCount: event.adultVolunteersCount,
    adultVolunteerHours: event.adultVolunteerHours,
    // No backing `events` column exists for this UI-only field
    // (`OutreachEventDialog.tsx`'s own module doc #7) -- defaults to `true`
    // (that dialog's own "on by default" semantics) since the event's
    // actual prior value can never be known. Disclosed, not fabricated as a
    // real fetched value.
    shareToCalendarFeed: true,
    sessions: sessions.map((session) => ({
      sessionDate: session.sessionDate,
      startTime: formatChicagoWallTime(session.startsAt),
      endTime: formatChicagoWallTime(session.endsAt),
      peopleReached: session.peopleReached,
    })),
    expectedStudentIds: deriveExpectedStudentIds(sessions, rsvps),
  };
}

// ---------------------------------------------------------------------------
// Generic DES-12 load-state hook -- extended with a `notFound` bucket
// (module doc #5) beyond the loading/error/success trio every sibling page
// in this batch already established.
// ---------------------------------------------------------------------------

type DetailLoadState =
  | { status: 'loading' }
  | { status: 'error'; retry: () => void }
  | { status: 'notFound' }
  | { status: 'success'; data: OutreachDetailData };

function useOutreachDetailLoadState(
  loadData: LoadOutreachDetailFn,
  eventId: string,
): DetailLoadState {
  const [state, setState] = useState<DetailLoadState>({ status: 'loading' });
  // Bumped by the error Banner's "Retry" action (DES-12) to force the effect
  // below to re-run without changing `loadData`/`eventId` deps semantics.
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setState({ status: 'loading' });
    loadData(eventId)
      .then((result) => {
        if (!isMounted) return;
        setState(result === null ? { status: 'notFound' } : { status: 'success', data: result });
      })
      .catch(() => {
        if (isMounted) {
          setState({ status: 'error', retry: () => setRetryToken((token) => token + 1) });
        }
      });
    return () => {
      isMounted = false;
    };
  }, [loadData, eventId, retryToken]);

  return state;
}

// ---------------------------------------------------------------------------
// Presentational subcomponents -- module doc #4.
// ---------------------------------------------------------------------------

function SignupBucket({
  label,
  students,
}: {
  label: string;
  students: readonly RosterStudent[];
}): ReactNode {
  return (
    <VStack gap={1}>
      <Text type="supporting">
        {label} ({students.length})
      </Text>
      {students.length === 0 ? (
        <Text type="supporting" color="secondary">
          No students
        </Text>
      ) : (
        <List hasDividers>
          {students.map((student) => (
            <ListItem key={student.id} label={student.name} />
          ))}
        </List>
      )}
    </VStack>
  );
}

function SessionSignupList({
  session,
  roster,
  rsvps,
  attendanceRows,
}: {
  session: OutreachDetailSession;
  roster: readonly RosterStudent[];
  rsvps: readonly RsvpRow[];
  /** T306 (module doc #16) -- already collapsed by the caller: the "no rows
   * known yet" (in-flight/failed load) case and the "genuinely zero rows"
   * case are indistinguishable here on purpose, both fall to the RSVP
   * buckets (module doc #16(c)). */
  attendanceRows: readonly AttendanceRow[];
}): ReactNode {
  // T306 (module doc #16(a)) -- THE TRIGGER's one call site. `session` is in
  // scope here only for `.id` -- `hasRecordedAttendance` itself never sees
  // `session.status`/`session.sessionDate` (module doc #16(a) explains why
  // that narrow signature is deliberate).
  const showAttendance = useMemo(
    () => hasRecordedAttendance(session.id, attendanceRows),
    [session.id, attendanceRows],
  );
  const signupGroups = useMemo(
    () => groupSessionSignups(session.id, roster, rsvps),
    [session.id, roster, rsvps],
  );
  const attendanceGroups = useMemo(
    () => groupSessionAttendance(session.id, roster, attendanceRows),
    [session.id, roster, attendanceRows],
  );

  return (
    <VStack gap={3}>
      <Heading level={3}>
        {formatSessionDateTime(session)}
        {session.status !== 'scheduled' ? ` — ${session.status}` : ''}
      </Heading>
      {showAttendance ? (
        <VStack gap={2}>
          {/* T306 (packet §4(d)) -- names which thing is on screen, so a
              coach recording attendance never has to infer whether this
              row is asking them to also go fix each RSVP (it isn't). */}
          <Heading level={4}>Who actually came</Heading>
          <HStack gap={5} wrap="wrap">
            <SignupBucket label="Attended" students={attendanceGroups.attended} />
            <SignupBucket label="Excused" students={attendanceGroups.excused} />
            <SignupBucket label="Absent" students={attendanceGroups.absent} />
            <SignupBucket label="No record" students={attendanceGroups.noRecord} />
          </HStack>
        </VStack>
      ) : (
        <VStack gap={2}>
          <Heading level={4}>Who said they were coming</Heading>
          <HStack gap={5} wrap="wrap">
            <SignupBucket label="Going" students={signupGroups.going} />
            <SignupBucket label="Maybe" students={signupGroups.maybe} />
            <SignupBucket label="Can't go" students={signupGroups.cantGo} />
            <SignupBucket label="No response" students={signupGroups.noResponse} />
          </HStack>
        </VStack>
      )}
    </VStack>
  );
}

/** T101 (module doc #10) -- real success/error messaging for Edit and
 * Cancel, same "success Banner + error Banner, dismissable" pattern
 * `MeetingsList.tsx`'s own `FeedbackBanner` (T096) already established. */
interface FeedbackBanner {
  status: 'success' | 'error';
  title: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Component. Module docs #5/#6/#8/#10.
// ---------------------------------------------------------------------------

export interface OutreachDetailProps {
  /** Overrides the `:eventId` route param -- primarily for direct testing
   * (mirrors `LiveConsoleBody`'s own `sessionId`-via-`useParams` +
   * prop-override precedent). Falls back to `useParams<{ eventId: string }>()`
   * when omitted -- this page is NOT wired into `router.tsx` by this task
   * (Forbidden Files), so `useParams` only resolves when a test/future
   * caller renders this component inside an actually-matched route. */
  eventId?: string;
  /** Injectable data-loading seam (module doc #7). T101: defaults to a real
   * query (`loadOutreachDetail`, `../../lib/supabase/loaders/outreach.ts`);
   * `defaultLoadOutreachDetail` (fixture) remains exported for callers/tests
   * that want to inject it explicitly. `null` = not found/inaccessible
   * (module doc #5). */
  loadData?: LoadOutreachDetailFn;
  /** T101 (module doc #10). Defaults to a real `events`/`event_sessions`
   * insert/update, passed straight through to `<OutreachEventDialog
   * onSaveEvent={...} />` in EDIT mode. */
  onSaveEvent?: OnSaveOutreachEventFn;
  /** T101 (module doc #10, Trap #4). Defaults to a real, event-level
   * `event_sessions.status = 'canceled'` mutation. */
  onCancelEvent?: (eventId: string) => Promise<void>;
  /** T121 item (a) (UXP-04 outreach half) -- real roster loader default
   * (T118's `loadOutreachEventRoster`, previously built/tested but
   * unconsumed by any page), wired into this page's own edit-mode
   * `OutreachEventDialog` `students` prop, replacing that dialog's own
   * `DEFAULT_STUDENTS` fixture fallback. */
  loadRoster?: LoadOutreachEventRosterFn;
  /** T157 (module doc #13(c)) -- the signed-in parent's own `guardian_links`
   * rows. Its own seam, mirroring `loadRoster` above, NOT folded into
   * `loadData`: it is only ever called for a `parent`-role viewer. Defaults to
   * the real query. */
  loadGuardianLinksForParent?: LoadGuardianLinksForParentFn;
  /** T157 (module doc #13(g)) -- injectable clock seam, threaded to every
   * `<ParentRsvp>`'s own `now` prop so its session-start lock boundary is
   * deterministically testable against this page's fixed fixture session
   * dates. Defaults to the real system clock, so production behavior is
   * unchanged. Same `nowFn` naming/default convention `CoachHome.tsx` already
   * established for this identical purpose; disclosed as a new pattern for
   * THIS file, which had no clock seam of its own before. */
  nowFn?: () => Date;
  /** T306 (module doc #16(b)) -- injectable load seam for the Signups
   * section's own attendance-vs-RSVP trigger. Same real-defaulted,
   * injectable-prop convention `AttendancePanel.tsx`'s own `loadAttendance`
   * and `MarkDayCompleteDialog.tsx`'s own `loadAttendance` already ship.
   * Defaults to the real `loadAttendanceForSessions`. */
  loadAttendance?: LoadAttendanceForSessionsFn;
}

export function OutreachDetail({
  eventId: eventIdProp,
  loadData = loadOutreachDetail,
  onSaveEvent = saveOutreachEvent,
  onCancelEvent = cancelOutreachEvent,
  loadRoster = loadOutreachEventRoster,
  loadGuardianLinksForParent = defaultLoadGuardianLinksForParent,
  loadAttendance = loadAttendanceForSessions,
  nowFn = () => new Date(),
}: OutreachDetailProps = {}): ReactNode {
  const { eventId: routeEventId } = useParams<{ eventId: string }>();
  const eventId = eventIdProp ?? routeEventId ?? '';

  // T117 (module doc #11) -- called unconditionally (rules of hooks), same
  // posture `OutreachList.tsx`'s own `useActiveSeason()` call already
  // established for this exact reason.
  const { user } = useAuth();

  const loadState = useOutreachDetailLoadState(loadData, eventId);
  // T101 (module doc #10) -- kept in sync with every successful `loadState`
  // (effect below), so a post-edit reload / a post-cancel optimistic flip
  // can be reflected immediately without re-triggering the top-level
  // `loading` DES-12 state.
  const [data, setData] = useState<OutreachDetailData | null>(null);
  // T306 (module doc #16(b)/(c)) -- `null` doubles as "not loaded yet" AND
  // "load failed": both fall to the RSVP buckets at every session's trigger
  // (the one call site collapses this via `attendanceRows ?? []`, further
  // below), same "no error banner, no blocked render" degrade
  // `MarkDayCompleteDialog.tsx`'s own attendance effect uses (that file's
  // module doc #9).
  const [attendanceRows, setAttendanceRows] = useState<readonly AttendanceRow[] | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  // T101 (module doc #10) -- drives the one rendered
  // `<OutreachEventDialog>` instance, in EDIT mode (Trap #5: that dialog
  // genuinely supports editing an existing event, unlike T096's
  // `ScheduleMeetingsDialog.tsx` finding).
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [isCancelConfirmOpen, setIsCancelConfirmOpen] = useState(false);
  // T127 (module doc #12) -- drives the one rendered
  // `<MarkEventCompleteDialog>` instance.
  const [isMarkEventCompleteDialogOpen, setIsMarkEventCompleteDialogOpen] = useState(false);
  // T179 (module doc #15) -- drives the one rendered `<MarkDayCompleteDialog>`
  // instance, resolved to a session BY ID at render (Trap 5 in the packet):
  // `null` = closed; a real session id = open, showing that session. One
  // instance, not N inside the per-session loop -- N would mean N mounted
  // subtrees, N duplicated labels, N copies of form state.
  const [markDayCompleteSessionId, setMarkDayCompleteSessionId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<FeedbackBanner | null>(null);
  // T121 item (a) -- best-effort roster fetch for the edit-mode dialog's
  // "Expected attendees" checklist. Deliberately named `eventDialogRoster`
  // below (the DERIVED value, not this state), NOT `roster` -- this
  // component's own pre-existing `roster` local (module doc #3's
  // `resolveEventRoster(event, students)`, further below) is a DIFFERENT,
  // team-scoped `RosterStudent[]` shape used for the Going/Maybe/Can't-go/
  // No-response signup buckets and `AttendancePanel`; this is
  // `OutreachEventDialog`'s own unrelated `OutreachRosterStudent[]` checklist
  // shape (T118).
  //
  // T147 (Part A2) -- a real, honest DES-12 load-state, same
  // `RosterLoadState`/`rosterState`/`rosterRetryToken` shape
  // `OutreachList.tsx`'s own CHECKER FIX (rework of T121, NIT #6) already
  // established for its own roster fetch. BEFORE this fix, a rejection (e.g.
  // Supabase isn't configured) left `eventDialogRoster` at its initial
  // `undefined`, which `OutreachEventDialog` (its own `students` prop
  // default) silently treated as "use my own `DEFAULT_STUDENTS` fixture" --
  // i.e. a coach could open Edit after any roster-fetch failure and see FAKE
  // sample students ("Riley Chen", "Sam Okafor", ...) presented as the live
  // roster, with no indication anything failed. NOW: a failed fetch resolves
  // to `{ status: 'error' }`, which (a) passes a real EMPTY array (never
  // `undefined`) as `students`, so the dialog can never fall back to its own
  // fixture, and (b) surfaces an honest error `Banner` (below, in this
  // component's own render -- `OutreachEventDialog.tsx` stays
  // forbidden/read-only, so this notice lives on the PAGE side, not injected
  // into the dialog) with a real `Retry` action. The old justification for
  // leaving this page on the soft-fail path ("T121 already fixed it") was
  // true for `OutreachList.tsx` only -- this page never received the fix
  // until now.
  type RosterLoadState =
    | { status: 'loading' }
    | { status: 'ready'; students: readonly OutreachRosterStudent[] }
    | { status: 'error' };
  const [rosterState, setRosterState] = useState<RosterLoadState>({ status: 'loading' });
  // Bumped by the error Banner's "Retry" action to force the effect below to
  // re-run -- same `retryToken` idiom this file's own top-level
  // `useOutreachDetailLoadState` already established.
  const [rosterRetryToken, setRosterRetryToken] = useState(0);

  // T157 (module doc #13(c)) -- the role gate, computed HERE rather than
  // alongside `isStaffViewer` further down, because the guardian-links fetch
  // effect below depends on it and hooks must run before this component's own
  // early `loading`/`error`/`notFound` returns. Identical shape to
  // `isStaffViewer` (module doc #11) -- only role literals present in
  // `guards.tsx`'s `Role` union are compared, and `user === null` falls
  // through to `false`.
  const isParentViewer = user !== null && user.role === 'parent';
  const parentProfileId = user?.id ?? null;

  // T157 (module doc #13(c)) -- DES-12/item 12 for the "Your RSVP" region.
  // `idle` is the NEVER-FETCHED variant (a non-parent viewer, who must never
  // issue this query), not an empty state; "empty" is a zero-length `ready`,
  // the same mapping `RosterLoadState` above already ships. Initialised to
  // `loading` rather than `idle` so a parent viewer's FIRST paint is an
  // observable loading state -- a parent starting in `idle` (which renders
  // nothing) would make a loading assertion pass against an unrendered state.
  // The effect below immediately settles a non-parent viewer to `idle`.
  type GuardianLinksLoadState =
    | { status: 'idle' }
    | { status: 'loading' }
    | { status: 'ready'; guardianLinks: readonly GuardianLinkRow[] }
    | { status: 'error' };
  const [guardianLinksState, setGuardianLinksState] = useState<GuardianLinksLoadState>({
    status: 'loading',
  });
  // Same `retryToken` idiom `rosterRetryToken` / `useOutreachDetailLoadState`
  // above already established -- bumped by the error Banner's Retry action to
  // force the effect below to re-run.
  const [guardianLinksRetryToken, setGuardianLinksRetryToken] = useState(0);

  useEffect(() => {
    if (loadState.status === 'success') {
      setData(loadState.data);
    }
  }, [loadState]);

  // T306 (module doc #16(b)) -- ONE combined attendance fetch for every
  // session on this page (mirrors `AttendancePanel`'s own `sessionIdsKey`
  // shape, not `MarkDayCompleteDialog`'s single-session shape). Keyed off
  // `data` (this component's OWN top-level state, above) rather than
  // `detailData`/`sessions` further below, which only exist after this
  // component's own early `loading`/`error`/`notFound` returns and so cannot
  // back a hook placed before them (rules of hooks). The string-join key,
  // not `data` itself, is the effect's dependency so this only re-fires when
  // the real session id SET changes, not on every unrelated `data` update
  // (e.g. the optimistic cancel-event flip below only changes `status`
  // fields, never the id set) -- same anti-thrash technique `AttendancePanel`
  // already uses for its own identical `sessionIdsKey`.
  // T117 (module doc #11) -- staff-only gate for the attendance panel below.
  // T306 HOISTED it above the attendance load effect that follows: that load
  // is staff-only too, and duplicating the role literals inline would
  // re-derive a check this file already owns (module doc #11 warns about
  // exactly that). Every other branch/section on this page is unchanged for a
  // non-staff viewer.
  const isStaffViewer = user !== null && (user.role === 'coach' || user.role === 'admin');
  const attendanceSessionIdsKey = useMemo(
    () => (data === null ? '' : data.sessions.map((session) => session.id).join('|')),
    [data],
  );
  useEffect(() => {
    // T306 -- STAFF ONLY, and this is a correctness gate, not a permission
    // nicety. `attendance`'s RLS is `staff_all` plus `own_or_linked_read`
    // (`20260717000002_rls.sql:226-232`), so a student or parent can read
    // ONLY their own (or their linked child's) rows. Firing this for them
    // would return a partial set, and `groupSessionAttendance` diffs the
    // roster -- so every teammate would render under "No record" when the
    // truth is the viewer cannot see their rows. That is a FALSE statement
    // about a factual record, and worse than the RSVP intent it replaces.
    //
    // Leaving `attendanceRows` at `null` for non-staff means the trigger
    // sees no rows and the RSVP buckets stand -- byte-identical to this
    // page's pre-T306 behaviour for those viewers. It also honours T307's
    // recorded concern (`verification-log.md`) that an ungated load fires an
    // `attendance` SELECT for every signed-in viewer of this page.
    if (!isStaffViewer) return undefined;
    let isMounted = true;
    const sessionIds = attendanceSessionIdsKey === '' ? [] : attendanceSessionIdsKey.split('|');
    loadAttendance(sessionIds)
      .then((rows) => {
        if (isMounted) setAttendanceRows(rows);
      })
      .catch(() => {
        // Graceful degrade (module doc #16(c), mirroring
        // `MarkDayCompleteDialog.tsx`'s own module doc #9): `attendanceRows`
        // stays whatever it already was (`null` on a first failure), so
        // every session's trigger sees "no rows known" and the RSVP buckets
        // stand -- no error `Banner`, no blocked signups render, no
        // spinner. Deliberately different from `MarkEventCompleteDialog`
        // (a WRITE path, which must abort on a failed load instead): this
        // section only ever displays, so a degraded display is recoverable.
      });
    return () => {
      isMounted = false;
    };
  }, [loadAttendance, attendanceSessionIdsKey, isStaffViewer]);

  // T157 (module doc #13(c)) -- fetched ONLY for a parent viewer. Every other
  // role (and a signed-out visitor) settles to `idle` without ever calling the
  // loader, which this file's own test asserts directly per role.
  useEffect(() => {
    if (!isParentViewer || parentProfileId === null) {
      setGuardianLinksState({ status: 'idle' });
      return;
    }
    let isMounted = true;
    setGuardianLinksState({ status: 'loading' });
    loadGuardianLinksForParent(parentProfileId)
      .then((links) => {
        if (isMounted) setGuardianLinksState({ status: 'ready', guardianLinks: links });
      })
      .catch(() => {
        if (isMounted) setGuardianLinksState({ status: 'error' });
      });
    return () => {
      isMounted = false;
    };
  }, [isParentViewer, parentProfileId, loadGuardianLinksForParent, guardianLinksRetryToken]);

  function retryGuardianLinksLoad(): void {
    setGuardianLinksRetryToken((token) => token + 1);
  }

  useEffect(() => {
    let isMounted = true;
    setRosterState({ status: 'loading' });
    loadRoster()
      .then((rosterData) => {
        if (isMounted) setRosterState({ status: 'ready', students: rosterData });
      })
      .catch(() => {
        if (isMounted) setRosterState({ status: 'error' });
      });
    return () => {
      isMounted = false;
    };
  }, [loadRoster, rosterRetryToken]);

  function retryRosterLoad(): void {
    setRosterRetryToken((token) => token + 1);
  }

  // `undefined` only while genuinely still loading (a brief, transient
  // state -- `OutreachEventDialog`'s own fixture fallback is a defensible,
  // short-lived placeholder here, unlike the disclosed FAILURE case below).
  // `'ready'` -> the real roster. `'error'` -> a real, honest EMPTY array,
  // never the dialog's own fixture.
  const eventDialogRoster =
    rosterState.status === 'ready'
      ? rosterState.students
      : rosterState.status === 'error'
        ? []
        : undefined;

  async function reloadDetail(): Promise<void> {
    const fresh = await loadData(eventId);
    setData(fresh);
  }

  function openEditDialog(): void {
    setIsEventDialogOpen(true);
  }

  function openCancelConfirm(): void {
    setIsCancelConfirmOpen(true);
  }

  // T127 (module doc #12).
  function openMarkEventCompleteDialog(): void {
    setIsMarkEventCompleteDialogOpen(true);
  }

  // T101 (module doc #10, Trap #5) -- real `onSaveEvent` wiring (edit mode).
  // Reloads this page's own data via `reloadDetail()` on success (a full
  // reload, not a client-side merge -- same reasoning `MeetingsList.tsx`'s
  // own T096 `handleCreateMeetingsSubmit` already established, since
  // recomputing this page's own derived fields -- roster/signup groupings --
  // client-side would duplicate the loader's own DB-driven joins for no
  // benefit).
  async function handleSaveEventSubmit(
    payload: Parameters<OnSaveOutreachEventFn>[0],
  ): Promise<void> {
    await onSaveEvent(payload);
    try {
      await reloadDetail();
      setFeedback({
        status: 'success',
        title: 'Event updated',
        description: `"${payload.event.title}" was updated.`,
      });
    } catch {
      // The save itself already succeeded (this catch only guards the
      // follow-up reload) -- disclosed, not fatal.
      setFeedback({
        status: 'success',
        title: 'Event updated',
        description: `"${payload.event.title}" was updated. Refresh the page to see the changes.`,
      });
    }
  }

  // T101 (module doc #10, Trap #4) -- real, event-level cancel mutation,
  // optimistic update + rollback on failure, mirroring `MeetingsList.tsx`'s
  // own `handleConfirmCancel` (T096) shape.
  async function handleConfirmCancel(): Promise<void> {
    if (data === null) return;
    const target = data;
    const optimisticSessions = target.sessions.map((session) =>
      session.status === 'scheduled' ? { ...session, status: 'canceled' as const } : session,
    );
    setData({ ...target, sessions: optimisticSessions });
    setIsCancelConfirmOpen(false);
    try {
      await onCancelEvent(target.event.id);
      setFeedback({
        status: 'success',
        title: 'Event canceled',
        description: `"${target.event.title}"'s remaining scheduled sessions are marked canceled. Already-completed sessions are untouched.`,
      });
    } catch (error) {
      setData(target); // rollback
      setFeedback({
        status: 'error',
        title: "Couldn't cancel event",
        description: isSupabaseLoaderError(error)
          ? error.message
          : `Something went wrong canceling "${target.event.title}". Try again in a moment.`,
      });
    }
  }

  function handleCopyLink(): void {
    if (loadState.status !== 'success') return;
    const current = data ?? loadState.data;
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const url = buildOutreachDetailUrl(current.event.id, origin);
    setCopiedUrl(url);
    copyTextToClipboard(url).catch(() => {
      // Best-effort only -- module doc #6: no OS-level clipboard write can
      // be proven in this test environment; the Toast still fires above
      // regardless of whether this resolves or rejects.
    });
  }

  if (loadState.status === 'loading') {
    return (
      <VStack gap={6} padding={6} aria-busy="true">
        <VisuallyHidden as="div" role="status">
          Loading event…
        </VisuallyHidden>
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
          <Skeleton width={260} height={28} index={0} />
          <Skeleton width={100} height={32} index={1} />
        </HStack>
        <VStack gap={2}>
          {['When', 'Where', 'Scope', 'Created by'].map((label, index) => (
            <HStack key={label} gap={4} vAlign="center">
              <Skeleton width={80} height={14} index={index * 2 + 2} />
              <Skeleton width={220} height={14} index={index * 2 + 3} />
            </HStack>
          ))}
        </VStack>
        <VStack gap={3}>
          <Skeleton width={100} height={22} index={10} />
          <Skeleton width="100%" height={80} index={11} />
        </VStack>
      </VStack>
    );
  }

  if (loadState.status === 'error') {
    return (
      <VStack gap={4} padding={6}>
        <Banner
          status="error"
          title="Couldn't load this event"
          description="Something went wrong loading this outreach event. Try refreshing the page."
          endContent={<Button variant="ghost" label="Retry" onClick={loadState.retry} />}
        />
      </VStack>
    );
  }

  if (loadState.status === 'notFound') {
    // Module doc #5 -- DES-12/NAV-08 "reveal nothing" state: no
    // MetadataList, no signup lists, no other event data anywhere in this
    // render, grep/test-provable against this exact branch.
    return (
      <VStack gap={4} padding={6}>
        <EmptyState
          headingLevel={1}
          title="This outreach event isn't available"
          description="It may have been removed, or you may not have access to it."
        />
      </VStack>
    );
  }

  // T101 (module doc #10) -- `data` (kept in sync by the effect above) is
  // preferred when present so a post-edit reload / post-cancel optimistic
  // flip is reflected immediately; falls back to `loadState.data`
  // defensively for the very first successful render (before the effect has
  // committed).
  const detailData = data ?? loadState.data;
  const { event, sessions, rsvps, students, teams, profiles } = detailData;
  const roster = resolveEventRoster(event, students);
  const orderedSessions = sortSessionsByStart(sessions);
  // T157 (module doc #13(e)) -- composed over the ALREADY team-scoped `roster`
  // (module doc #3), NOT the full unfiltered `students` list: a parent's linked
  // student outside this event's team scope gets no control for this event.
  // `user.id` is the correct `parentProfileId` -- module doc #11 already
  // established that `AuthUser.id === profiles.id`.
  const parentLinkedStudents =
    isParentViewer && user !== null && guardianLinksState.status === 'ready'
      ? resolveParentLinkedRosterStudents(roster, guardianLinksState.guardianLinks, user.id)
      : [];
  // T169 (module doc #14) -- same shape `isStaffViewer`/`isParentViewer`
  // already use: only the role literals present in `guards.tsx`'s `Role`
  // union are compared, `user === null` falls through to `false`.
  const isStudentViewer = user !== null && user.role === 'student';
  // T169 (module doc #14(b)) -- computed once, outside the per-session loop
  // (same placement as `parentLinkedStudents` above -- this value also
  // doesn't vary per session). No new fetch, no new DES-12 state machine
  // (module doc #14(a)): this is a synchronous `.find` over data the page's
  // existing top-level `loadState` already resolved before any session
  // renders at all.
  const ownRosterStudent =
    isStudentViewer && user !== null ? resolveOwnRosterStudent(roster, user.id) : null;
  // T179 (module doc #15, Trap 5) -- the ONE place `markDayCompleteSessionId`
  // is resolved to a real session, by id, at render. `null` (closed, or a
  // stale/removed id after a reload) means the dialog element below isn't
  // rendered at all -- gating the WHOLE element (not just `isOpen`) is
  // required because `MarkDayCompleteDialog`'s `session` prop is required
  // (T179 Part A), so there is no fixture session left to fall back to.
  const markDayCompleteSession =
    markDayCompleteSessionId === null
      ? null
      : (orderedSessions.find((session) => session.id === markDayCompleteSessionId) ?? null);
  // T323 (external audit LIVE-015) -- EVERY item in this menu is an
  // event-management action and is staff-only. `Edit` and `Cancel event`
  // used to be built unconditionally here while only `Mark event complete`
  // was gated, so a parent opening "Actions for <event>" was offered real
  // Edit and Cancel controls on a team-wide event. The server already
  // refused them -- `events` and `event_sessions` both carry `staff_all
  // ... using (is_staff()) with check (is_staff())` (`rls.sql:149-151`,
  // `:172-174`), which is why this was a wrong-control defect rather than a
  // data-integrity one -- but a control that always errors should not be
  // offered at all.
  const menuItems: DropdownMenuOption[] = [];
  // T127 (module doc #12) -- staff-only, this page only (packet Objective).
  if (isStaffViewer) {
    menuItems.push({ label: 'Edit', onClick: openEditDialog });
    menuItems.push({ label: 'Cancel event', onClick: openCancelConfirm });
    menuItems.push({ label: 'Mark event complete', onClick: openMarkEventCompleteDialog });
  }

  return (
    <VStack gap={6} padding={6}>
      <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
        <Heading level={1}>{event.title}</Heading>
        <HStack gap={2} vAlign="center">
          <Button label="Copy link" variant="secondary" onClick={handleCopyLink} />
          <MoreMenu items={menuItems} label={`Actions for ${event.title}`} />
        </HStack>
      </HStack>

      {event.description !== '' && <Text type="supporting">{event.description}</Text>}

      {feedback !== null && (
        <Banner
          status={feedback.status}
          title={feedback.title}
          description={feedback.description}
          isDismissable
          onDismiss={() => setFeedback(null)}
        />
      )}

      {/* T147 (Part A2) -- honest, page-side notice for a roster-load
          failure (module doc on `rosterState` above), same shape
          `OutreachList.tsx`'s own CHECKER FIX (rework of T121, NIT #6)
          already established. */}
      {rosterState.status === 'error' && (
        <Banner
          status="error"
          title="Couldn't load the student roster"
          description={
            'Editing this event will show an empty "Expected attendees" checklist until this is retried.'
          }
          endContent={<Button variant="ghost" label="Retry" onClick={retryRosterLoad} />}
        />
      )}

      {copiedUrl !== null && (
        <Toast
          type="info"
          body="Link copied"
          isAutoHide
          autoHideDuration={3000}
          onDismiss={() => setCopiedUrl(null)}
        />
      )}

      <MetadataList columns="single" title="Event details">
        <MetadataListItem label="When">{formatWhenSummary(sessions)}</MetadataListItem>
        <MetadataListItem label="Where">
          <VStack gap={1}>
            <Text type="body">{event.locationName}</Text>
            <Text type="supporting" color="secondary">
              {event.address}
            </Text>
            <Link href={buildGoogleMapsUrl(event.address)} isExternalLink isStandalone>
              Open in Google Maps
            </Link>
          </VStack>
        </MetadataListItem>
        <MetadataListItem label="Scope">{formatScopeLabel(event.teamIds, teams)}</MetadataListItem>
        <MetadataListItem label="Created by">
          {resolveCreatorName(event.createdBy, profiles)}
        </MetadataListItem>
      </MetadataList>

      <VStack gap={5}>
        <Heading level={2}>Signups</Heading>

        {/* T157 (module doc #13(c)) -- the "Your RSVP" region's own DES-12
            loading state, scoped to that region rather than blocking the whole
            page. Mirrors this page's own top-level loading convention
            (`aria-busy` + `VisuallyHidden role="status"` + a `Skeleton`) at a
            smaller scope. Rendered once, not once per session: while the fetch
            is in flight this page does not yet know how many linked students
            exist, and N duplicate live regions would be worse for a screen
            reader than one. */}
        {isParentViewer && guardianLinksState.status === 'loading' && (
          <VStack gap={1} aria-busy="true">
            <VisuallyHidden as="div" role="status">
              Loading your RSVP options…
            </VisuallyHidden>
            <Skeleton width={240} height={20} index={0} />
          </VStack>
        )}

        {/* T157 (module doc #13(c)) -- honest DES-12 error state with a real
            Retry, same shape as the roster-load-failure banner above. Never a
            silent fallback: a failed fetch leaves `parentLinkedStudents` empty
            rather than guessing at a linkage. */}
        {isParentViewer && guardianLinksState.status === 'error' && (
          <Banner
            status="error"
            title="Couldn't load your linked students"
            description="Your RSVP controls can't be shown until this is retried."
            endContent={<Button variant="ghost" label="Retry" onClick={retryGuardianLinksLoad} />}
          />
        )}

        {orderedSessions.length === 0 ? (
          <Text type="supporting">No sessions scheduled yet.</Text>
        ) : (
          orderedSessions.map((session) => (
            <VStack key={session.id} gap={4}>
              <SessionSignupList
                session={session}
                roster={roster}
                rsvps={rsvps}
                attendanceRows={attendanceRows ?? []}
              />
              {/* T179 (module doc #15, Trap 9) -- staff-only, per-session
                  "Mark day complete" trigger, INSIDE this page's own
                  per-session loop (`MarkDayCompleteDialog` takes one
                  `session`, unlike `MarkEventCompleteDialog`'s plural
                  `sessions` from `menuItems` above) -- never in `menuItems`.
                  `isSessionMarkDayCompleteEligible` (module doc #15) gates on
                  PRD OUT-05's own "on/after a session date" wording, not
                  `startsAt`. `label` carries the session date so a
                  multi-session event's N triggers get N DISTINCT accessible
                  names (item 15) -- `children` overrides only the VISIBLE
                  text, which stays the same literal "Mark day complete" for
                  every trigger (Astryx `Button`'s documented `children`/
                  `label` split, `astryx-api.md:1810`). */}
              {isStaffViewer && isSessionMarkDayCompleteEligible(session, nowFn()) && (
                <Button
                  label={`Mark day complete — ${formatSessionDateOnly(session)}`}
                  variant="secondary"
                  onClick={() => setMarkDayCompleteSessionId(session.id)}
                >
                  Mark day complete
                </Button>
              )}
              {/* T157 (module doc #13(d)/(f)) -- one `<ParentRsvp>` per
                  (session x qualifying linked student), inside this page's own
                  per-session loop (OUT-04 is per-session, module doc #4). The
                  `user !== null` in this gate is DEFENSIVE and conventional,
                  NOT compiler-required -- `isParentViewer` is a `const`
                  initialised from `user !== null && ...`, and TypeScript 4.4+
                  narrows through aliased conditions, so it already narrows
                  `user` on its own and `currentUserProfileId={user.id}`
                  compiles without the extra check. Same shape module doc
                  #11's `<AttendancePanel>` gate uses, for the same defensive
                  reason. Module doc #15(g) has the measurement, including the
                  `const`->`let` control that proves where the narrowing comes
                  from. */}
              {isParentViewer &&
                user !== null &&
                guardianLinksState.status === 'ready' &&
                parentLinkedStudents.map((student) => (
                  <VStack key={`${session.id}-${student.id}`} gap={2}>
                    {/* Carries BOTH the student name and the session date --
                        module doc #13(f): `ParentRsvp`'s own `controlLabel` is
                        an `aria-label` carrying the date but not the name, so
                        neither piece alone disambiguates every instance. */}
                    <Heading level={4}>
                      {`Your RSVP for ${student.name} — ${formatSessionDateOnly(session)}`}
                    </Heading>
                    <ParentRsvp
                      studentId={student.id}
                      studentProfileId={student.profileId}
                      session={session}
                      eventTitle={event.title}
                      currentRsvp={
                        rsvps.find(
                          (rsvp) => rsvp.sessionId === session.id && rsvp.studentId === student.id,
                        ) ?? null
                      }
                      guardianLinks={guardianLinksState.guardianLinks.filter(
                        (link) => link.studentId === student.id,
                      )}
                      currentUserProfileId={user.id}
                      now={nowFn}
                    />
                  </VStack>
                ))}
              {/* T169 (module doc #14) -- the STUDENT's own self-service
                  control, one per session, for their own roster row only.
                  `user !== null` is DEFENSIVE here, not compiler-required,
                  for the identical reason documented at this file's other
                  role gates (`isParentViewer`/`isStaffViewer` above):
                  `isStudentViewer` is a `const` initialised from
                  `user !== null && ...`, and TypeScript 4.4+ narrows through
                  aliased conditions, so `user: AuthUser | null` is already
                  narrowed and `currentUserProfileId={user.id}` compiles
                  without the separate null check. Module doc #15(g) has the
                  measurement. No page-owned `Heading`
                  here, unlike `<ParentRsvp>` above -- module doc #14(c): a
                  student only ever sees their own single control, so there
                  is no cross-student `aria-label` collision to disambiguate;
                  `RsvpControl`'s own `controlLabel` already carries both the
                  event title and the session date. */}
              {isStudentViewer && user !== null && ownRosterStudent !== null && (
                <RsvpControl
                  studentId={ownRosterStudent.id}
                  session={session}
                  eventTitle={event.title}
                  currentRsvp={
                    rsvps.find(
                      (rsvp) =>
                        rsvp.sessionId === session.id && rsvp.studentId === ownRosterStudent.id,
                    ) ?? null
                  }
                  currentUserProfileId={user.id}
                  now={nowFn}
                />
              )}
            </VStack>
          ))
        )}
      </VStack>

      {/* T117 (module doc #11) -- staff-only, UXD-06 spacious page-level
          section (not a modal). Non-staff viewers see this page exactly as
          before this task -- no branch below this guard ever renders for
          them. */}
      {isStaffViewer && user !== null && (
        <AttendancePanel
          sessions={sessions}
          roster={roster}
          teams={teams}
          currentUserProfileId={user.id}
        />
      )}

      {/* T127 (module doc #12) -- "Mark event complete" bulk action,
          staff-only trigger (the `MoreMenu` item above), same
          `sessions`/`roster`/`rsvps` this page already fetched/derived for
          the Signups section, no reshaping needed (module doc #12).
          T179: `currentUserProfileId` is now a required prop on
          `MarkEventCompleteDialog` (that file's own module doc has the full
          writeup) -- gated here by an explicit `user !== null` check, same
          shape this file's other three role gates (`isParentViewer`/
          `isStudentViewer`/`isStaffViewer`) already use. This is defensive
          and matches the file's convention; it is not required by the
          compiler to narrow `user` -- `isStaffViewer` (a `const` derived from
          the same destructured `user` binding) narrows it too, TypeScript
          4.4+ narrows through aliased conditions (module doc #15 below has
          the full writeup, T179). Reachability is honest: this dialog's only
          trigger is the staff-only `MoreMenu` item above, which already
          requires `user !== null`, so this branch is latent (unreachable
          today), not live-firing -- it becomes impossible, not merely
          unreachable, once the prop is required. */}
      {user !== null && (
        <MarkEventCompleteDialog
          isOpen={isMarkEventCompleteDialogOpen}
          onOpenChange={setIsMarkEventCompleteDialogOpen}
          eventTitle={event.title}
          sessions={sessions}
          roster={roster}
          rsvps={rsvps}
          currentUserProfileId={user.id}
          onFinished={() => {
            // T179 (Part C) -- same one-character defect Trap 6 fixed at the
            // new `MarkDayCompleteDialog` mount below: `void` discards the
            // promise's VALUE, not its REJECTION, so a rejecting refetch here
            // was an unhandled rejection that failed the whole test run
            // (vitest `Errors 1 error`, exit 1) despite every assertion
            // passing. `.catch(() => {})` absorbs a refetch failure without
            // reporting it as a write failure -- the bulk write already
            // committed (per-session, module doc on `MarkEventCompleteDialog
            // .tsx`), so telling the coach it failed would invite a duplicate
            // attempt. No new test is added for this fix -- B6 on the new
            // `MarkDayCompleteDialog` mount already proves the mechanism, and
            // this is the identical one-line fix applied a second place.
            reloadDetail().catch(() => {});
          }}
        />
      )}

      {/* T179 (module doc #15, Trap 5) -- the single, staff-only
          "Mark day complete" dialog instance, driven by
          `markDayCompleteSessionId` resolved to `markDayCompleteSession`
          above. The WHOLE element is gated (not just `isOpen`) because
          `session`/`roster`/`rsvps`/`eventTitle`/`currentUserProfileId` are
          now all required props (T179 Part A) -- there is no fixture value
          left to render against while closed. This still works end to end:
          the dialog's own `onOpenChange(false)` on success unmounts it
          (clearing `markDayCompleteSessionId` below) and its reset-on-open
          `useEffect` still fires the next time it mounts for a different
          session. `roster`/`rsvps` are passed the SAME page-level arrays the
          `MarkEventCompleteDialog` mount above passes, unfiltered --
          `computeInitialAttendedStudentIds` filters by `sessionId` itself
          (that dialog's own module doc #6), so pre-filtering here would be a
          second place for the filter to drift (Trap 8). No reshaping: this
          page's `OutreachDetailSession` is field-for-field
          `MarkDayCompleteSession`, and `RosterStudent` carries only an EXTRA
          `profileId` field, which assigns fine. */}
      {user !== null && markDayCompleteSession !== null && (
        <MarkDayCompleteDialog
          isOpen
          onOpenChange={(isOpen) => {
            if (!isOpen) setMarkDayCompleteSessionId(null);
          }}
          eventTitle={event.title}
          session={markDayCompleteSession}
          roster={roster}
          rsvps={rsvps}
          currentUserProfileId={user.id}
          onMarkComplete={async (payload: MarkDayCompletePayload) => {
            // Trap 6 -- the `await`/`.catch()` split is both halves
            // load-bearing. `await` the WRITE so a real failure still
            // rejects and the dialog shows its own error `Banner` (B6(a)).
            // `.catch(() => {})` the RELOAD -- `void reloadDetail()` was
            // measured to leave the write's own promise rejection
            // unhandled whenever the refetch itself rejected: `void` only
            // discards the promise's VALUE, not its REJECTION. That
            // produced a green test suite (every assertion passing) with
            // vitest still exiting 1 on an "Unhandled Rejection" (B6(b));
            // `.catch()` absorbs a refetch failure without reporting it as
            // a write failure, which matters because the write already
            // committed -- telling the coach it failed would invite a
            // duplicate attempt.
            await markDayComplete(payload);
            reloadDetail().catch(() => {});
          }}
        />
      )}

      <AlertDialog
        isOpen={isCancelConfirmOpen}
        onOpenChange={(isOpen) => {
          if (!isOpen) setIsCancelConfirmOpen(false);
        }}
        title={`Cancel "${event.title}"?`}
        description="This marks every still-scheduled session for this event canceled. Already-completed sessions are left untouched, and no attendance will be recorded for the canceled ones."
        actionLabel="Cancel event"
        onAction={() => {
          void handleConfirmCancel();
        }}
      />

      {/* T101 (module doc #10, Trap #5) -- `OutreachEventDialog.tsx` (T039,
          already Passed, already built, genuinely supports edit mode) wired
          into this page for the first time, in EDIT mode
          (`initialEvent` pre-fills every field from the real fetched
          event/sessions/rsvps -- `buildInitialOutreachEvent`, T121 item (b)
          UPDATE: now also prefills `expectedStudentIds`). T121 item (a):
          `students`/`currentUserProfileId` now wired to the real roster
          loader / signed-in coach id. T147: `teams` now real too -- this
          page's own already-fetched `detailData.teams` (already used above
          for `formatScopeLabel`/`AttendancePanel`), replacing the dialog's
          own `DEFAULT_TEAMS` fixture fallback (`'team-ravens'`/
          `'team-titans'`, non-uuid strings that failed the real
          `events.team_ids uuid[]` insert).

          T300 UPDATE: `currentUserProfileId` is now a required prop on
          `OutreachEventDialog` (that file's own module doc 11d has the full
          writeup) -- this call site previously passed `user?.id`
          (`string | undefined`), so a null `user` would have silently
          compiled a `respondedBy` write attributed to that file's own
          now-deleted `PLACEHOLDER_CURRENT_COACH_PROFILE_ID` fixture default
          instead. Gated here by an explicit `user !== null` check, NOT also
          `isStaffViewer` -- unlike the `isStaffViewer && user !== null`
          shape this file's three role-VISIBILITY gates use (`isParentViewer`/
          `isStudentViewer`/`isStaffViewer` above, `AttendancePanel`), this
          element is not a page section whose visibility should track a role;
          it is a `Dialog` whose own `isOpen` already controls whether
          anything is shown, same as the `MarkEventCompleteDialog`/
          `MarkDayCompleteDialog` mounts below, both of which use this exact
          `user !== null`-only shape for the identical reason (see those
          mounts' own module docs). Reachability is honest: this element's
          only trigger, `openEditDialog`, is wired to the "Edit" `MoreMenu`
          item, which is itself only pushed onto `menuItems` `if
          (isStaffViewer)` above -- so this branch is latent (unreachable by
          a non-staff or signed-out viewer today, since they cannot flip
          `isEventDialogOpen` true), not live-firing; it becomes impossible,
          not merely unreachable, once the prop is required. Adding
          `isStaffViewer` here in addition would not change what any viewer
          can actually reach -- it would only additionally unmount this
          closed dialog for parents/students, which is not this task's
          purpose (removing a placeholder default, not changing who can open
          the dialog). */}
      {user !== null && (
        <OutreachEventDialog
          isOpen={isEventDialogOpen}
          onOpenChange={setIsEventDialogOpen}
          teams={teams}
          onSaveEvent={handleSaveEventSubmit}
          initialEvent={buildInitialOutreachEvent(event, sessions, rsvps)}
          students={eventDialogRoster}
          currentUserProfileId={user.id}
        />
      )}
    </VStack>
  );
}

export default OutreachDetail;
