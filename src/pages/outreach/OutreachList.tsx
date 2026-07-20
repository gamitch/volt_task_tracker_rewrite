/**
 * T038: `/outreach` list page (OUT-01). Coach (`coach`/`admin`) view: a
 * team season-goal `ProgressBar` pair (confirmed vs. planned hours, BEH-02)
 * with BEH-01 25/50/75/100% milestone ticks + deduped `Toast`, Upcoming
 * (`AvatarGroup` signup counts) / Past `List` sections, and a "New outreach
 * event" action. Student/parent view: the viewer's own goal-bar pair (same
 * BEH-01/BEH-02 rules) plus a per-row RSVP `SegmentedControl` on Upcoming
 * rows (OUT-01/OUT-03 preview).
 *
 * -----------------------------------------------------------------------
 * 1. Ground truth -- `events`/`event_sessions`/`rsvps` column shapes, cited
 *    directly from `supabase/migrations/20260717000000_scheduling_attendance.sql`
 *    (read-only), NOT redefined/renamed with invented fields:
 *
 *    `events` (lines 33-48): id, season_id, type (check: 'meeting' |
 *    'outreach' | 'competition'), title, description, location_name,
 *    address, team_ids uuid[] NULL, counts_participation,
 *    counts_volunteer_hours, adult_volunteers_count, adult_volunteer_hours,
 *    created_by, created_at.
 *
 *    `event_sessions` (lines 53-63): id, event_id, session_date (date),
 *    starts_at (timestamptz), ends_at (timestamptz), status (check:
 *    'scheduled' | 'completed' | 'canceled'), people_reached, notes,
 *    created_at.
 *
 *    `rsvps` (lines 67-76): id, session_id, student_id, status (check:
 *    'going' | 'maybe' | 'declined'), responded_by, updated_at, created_at,
 *    unique(session_id, student_id).
 *
 *    `OutreachEventRow`/`OutreachSessionRow`/`RsvpRow` below are camelCase
 *    renames of the subset of these columns this screen renders/needs --
 *    real status vocabularies used verbatim (never an invented string like
 *    "confirmed"/"pending" in place of the real `'going'|'maybe'|'declined'`
 *    or `'scheduled'|'completed'|'canceled'` checks).
 *
 * -----------------------------------------------------------------------
 * 2. NAV-07 -- this route must show ONLY outreach-type sessions, never
 *    meetings.
 *
 * `filterOutreachEvents` below is the ONLY `event.type` predicate in this
 * file, and every session ever rendered is reached exclusively by joining
 * through an already-filtered outreach event id (see `OutreachList`'s own
 * body). `FIXTURE_EVENTS` deliberately includes one `type: 'meeting'` event
 * (`event-team-meeting`, "Weekly Team Meeting") with its own session
 * specifically so this filter is genuinely exercised, not just vacuously
 * true -- grep-provable: no meeting-shaped field/import anywhere in this
 * file's rendered output. See this task's worker output for the render-time
 * proof that "Weekly Team Meeting" never appears.
 *
 * -----------------------------------------------------------------------
 * 3. BEH-02 -- confirmed vs. planned hour segments, never summed into one
 *    displayed number.
 *
 * `computeStudentHours`/`computeGroupHours` below each return a
 * `{ confirmedHours, plannedHours }` pair and NEVER add the two fields
 * together anywhere in this file (grep-provable: no
 * `confirmedHours + plannedHours` or `confirmed + planned` expression
 * exists). "Confirmed" = hours from a `going` RSVP on an already-`completed`
 * session; "planned" = hours from a `going` RSVP on a still-`scheduled`
 * session; a `canceled` session contributes to neither (disclosed
 * simplification: the real `attendance.hours_override`/check-in-check-out
 * ground truth, per the same migration's `attendance` table, is the more
 * precise source for confirmed hours once attendance recording exists for
 * outreach days -- out of this list page's scope, not re-derived here).
 * Session duration (`sessionHours`) is `ends_at - starts_at` in hours.
 *
 * `ProgressBar` (astryx-api.md "ProgressBar" Props table) has no
 * multi-segment/stacked-fill prop -- confirmed directly against its own
 * Props table, which only exposes a single `value`/`max` pair per bar. So
 * "two visually distinct segments of the same ProgressBar" (packet
 * wording) is built as TWO separate, adjacent `ProgressBar` instances
 * sharing one goal `max` (`GoalProgressBar` below): one `variant="accent"`
 * for confirmed hours, one `variant="neutral"` (the closest documented
 * "lighter" semantic variant) for planned hours -- each with its own
 * `label`/`formatValueLabel` referencing only its own number, never both.
 *
 * -----------------------------------------------------------------------
 * 4. BEH-01 -- 25/50/75/100% milestone ticks + a deduped `Toast`.
 *
 * Milestone crossing is computed from `confirmedPercent` (confirmed hours
 * only, per module doc #3 -- planned hours are provisional, so they never
 * contribute to "reaching" a milestone). `crossedMilestones` returns every
 * milestone at or below the current confirmed percentage; `GoalProgressBar`
 * fires a `Toast` for any milestone crossed that has not already fired
 * *for this exact season + goal-bar identity* (`hasMilestoneToastFired`/
 * `markMilestoneToastFired`, `localStorage` key
 * `volt.outreach.milestoneToast.<seasonId>.<goalBarId>.<milestone>`). The
 * dedupe key is deliberately scoped by BOTH `seasonId` and `goalBarId` (the
 * literal `'team'` for the coach bar, or the viewer's own student id for the
 * student/parent bar) -- not a single global flag -- per the packet's own
 * "dedupes per device/season" wording: a new season (or a different goal
 * bar) gets its own fresh set of milestone toasts. Milestone ticks
 * themselves render as a neutral `Badge` (reached) or plain `Text` (not yet
 * reached) row beneath the bars -- BEH-04 neutral-only styling applied here
 * too, per the packet's explicit instruction to extend it to every
 * badge/count this file renders.
 *
 * No `ToastViewport` is wired anywhere in this app yet (confirmed via grep:
 * zero hits for `ToastViewport`/`useToast` under `src/`, and
 * `node_modules/@astryxdesign/core/dist/index.d.ts` only re-exports
 * `Toast`/`useToast` from `./Toast` at the root, no viewport). Per the
 * Toast doc's own guidance ("The `Toast` component renders the visual toast
 * element inline ... useful for previews ... where the viewport lifecycle
 * is not needed"), this file renders `<Toast>` elements directly in normal
 * document flow (inside `GoalProgressBar`) rather than calling the
 * `useToast()` hook, which requires a `ToastViewport` ancestor that does
 * not exist. Flagged as a known, disclosed infra gap (same category as
 * every other "no shared X wired in yet" gap this batch has hit) -- a
 * future task wiring a real `ToastViewport` into `AppShell.tsx` would let
 * this switch to `useToast()` with no change to the dedupe logic itself.
 *
 * Real doc-gap found and cross-checked while wiring this up (constitution
 * item 2's mandated cross-check, same category as `Heading`/`ListItem`'s
 * "own subsection is undefined" gaps elsewhere in this file): `astyx-api.md`'s
 * "Toast" Props table lists `uniqueID`/`collisionBehavior`/`onHide` as if
 * they were props of the bare `<Toast>` element. The INSTALLED package's own
 * types (`node_modules/@astryxdesign/core/dist/Toast/Toast.d.ts`, the
 * `ToastProps` interface actually consumed by the `Toast` function
 * component) show those three belong to a DIFFERENT type,
 * `ToastOptions` (`.../Toast/types.d.ts`) -- the options bag `useToast()`'s
 * returned `ShowToastFn` accepts, not `<Toast>`'s own props. `<Toast>`'s
 * real props are `type`/`body`/`endContent`/`isAutoHide` (required)/
 * `autoHideDuration` (required)/`isExiting`/`onDismiss` (required, NOT
 * `onHide`). This file uses only the real, installed-source-verified set
 * (`type`, `body`, `isAutoHide`, `autoHideDuration`, `onDismiss`) -- `tsc`
 * itself rejected the doc's `uniqueID`/`onHide` names, which is how this was
 * caught. Deduplication is entirely carried by this file's own
 * `localStorage` check (`hasMilestoneToastFired`, module doc #4) before a
 * `Toast` is ever added to state -- no Astryx-level `uniqueID` mechanism is
 * needed or used for it; each rendered `<Toast>` gets a plain React `key`
 * only (list-rendering identity, not a deduplication API).
 *
 * -----------------------------------------------------------------------
 * 5. THE CENTRAL TRAP -- SideNav badge scope tension (Known Context/Traps
 *    #3), flagged as a dispute candidate, not silently skipped or worked
 *    around.
 *
 * The ledger's Acceptance line for T038 says "Outreach nav badge (BEH-04)
 * wired to real unanswered-RSVP count." `src/components/nav/SideNav.tsx`
 * (the file that actually renders that badge, via its own
 * `PLACEHOLDER_OUTREACH_BADGE_COUNT = 0` constant and an explicit module
 * comment reading "the real count is wired by T038") is a forbidden,
 * read-only file for this task -- it is rendered by `AppShell`, not by this
 * page, so this component's render tree cannot reach into it, and this
 * task must not edit it. That literal clause of the Acceptance line is
 * therefore NOT reachable from within `OutreachList.tsx` alone.
 *
 * What this file DOES instead: `getUnansweredRsvpCount` below is a real,
 * exported, reusable, well-named computation -- "unanswered" means an
 * upcoming (`status === 'scheduled'`) outreach session with NO `rsvps` row
 * at all (not `declined`/`maybe`, which ARE answers) for a given list of
 * student ids. It is generic over `studentIds` specifically so a future
 * small wiring task can call it with whichever set applies to the current
 * viewer (a single linked student for student/parent, or the full roster
 * for staff/coach) and plug the result straight into
 * `PLACEHOLDER_OUTREACH_BADGE_COUNT` in `SideNav.tsx`. This file also
 * exercises the function for real, visibly, in both views (a neutral
 * `Badge` count near each view's heading), so it is provably correct
 * against the fixture data, not just an inert unused export -- see this
 * task's worker output for the exact expected counts per role and the
 * dispute-candidate write-up.
 *
 * -----------------------------------------------------------------------
 * 6. `guards.tsx` `Role` vocabulary gap (same recurring gap `RosterShell.tsx`
 *    (T021), `ParticipationTab.tsx` (T056), and `MeetingsList.tsx` (T030)
 *    already disclosed) -- resolved by T073a, not by this task.
 *
 * `guards.tsx`'s exported `Role` union now matches AUTH-05's real
 * `admin | coach | student | parent` vocabulary exactly (previously a
 * stale `'admin' | 'staff' | 'volunteer' | 'coach'` placeholder). Since
 * `router.tsx` wires `/outreach` with `RequireAuth` only (no `RequireRole`
 * -- confirmed by reading that forbidden/read-only file directly; this is
 * CORRECT for this route, not a gap: OUT-01 is a role-*variant* page, not a
 * role-*gated* one, same posture as `/meetings`), this component never
 * imports/uses `RequireRole` -- it only reads `useAuth().user.role` to pick
 * which variant to render. `isCoachOrAdminView` below compares only against
 * the `'coach'`/`'admin'` literals by design (it only needs to distinguish
 * coach/admin from everyone else); everything else, including a real
 * `'student'`/`'parent'` value, now correctly type-checks too and falls
 * through to the student/parent variant.
 *
 * -----------------------------------------------------------------------
 * 7. No student/profile linkage on `AuthUser` yet -- a real gap, disclosed
 *    and stood in for (same category `MeetingsList.tsx`/T030 documented).
 *
 * `AuthUser` (`guards.tsx`) carries only `{id, email, role}` -- no
 * `students.id` linkage. `PLACEHOLDER_CURRENT_STUDENT_ID` below is a
 * disclosed stand-in for "the one student this viewer is currently looking
 * at" (deliberately the same literal value `MeetingsList.tsx` uses, since
 * both pages stand in for the same not-yet-resolved viewer-linkage gap).
 *
 * -----------------------------------------------------------------------
 * 8. Deliberate stubs (per Forbidden Files -- disclosed, not silently built
 *    as if real):
 *
 *    a. T101 UPDATE (ED-1 Packet P10): "New outreach event" (coach view) is
 *       NO LONGER a stub -- see module doc #11 below. `OutreachEventDialog.tsx`
 *       (T039) was already built and already Passed; this task wires it into
 *       this page for the first time, in CREATE mode.
 *    b. Per-row RSVP `SegmentedControl` (student/parent view, Upcoming rows
 *       only) -- built FOR REAL as an OUT-01/OUT-03 *preview* per the
 *       packet's own instruction ("row-level RSVP controls only to the
 *       extent OUT-01 itself calls for them on the list page"): selecting a
 *       segment immediately updates this component's own local state (and
 *       therefore the goal bar / unanswered-count numbers react live). Only
 *       the PERSISTENCE layer is a stub -- no Supabase write happens
 *       anywhere in this file (Known Context/Traps #1, same as every other
 *       content page so far). The fuller, validated, server-persisted RSVP
 *       flow -- especially the parent-facing multi-student version --
 *       belongs to `RsvpControl.tsx`/`ParentRsvp.tsx` (T040/T042). T101
 *       UPDATE: those two files' own default `onRsvpChange` is now wired to
 *       a real `rsvps` upsert (`../../lib/supabase/loaders/outreach.ts`,
 *       module doc #11) -- but this file still does NOT import/render
 *       either of them here; the packet's own Objective lists "real RSVP
 *       mutations (RsvpControl/ParentRsvp)" as wiring THOSE TWO components'
 *       own default, not as new integration work pulling them into this
 *       list page (a genuinely separate, larger UI change this task's
 *       packet never asked for). This page's own inline row-level preview
 *       therefore deliberately stays local-only, unchanged by this task.
 *    c. T112 HOTFIX UPDATE: this stub is CLOSED, not still open. Event
 *       titles were plain `Heading`/`ListItem` `label` text with no
 *       `Link`/`href` to `/outreach/:eventId`, justified at the time by
 *       "`router.tsx`'s existing `/outreach/:eventId` route still resolves
 *       to an inline placeholder div, not this page's own content, so
 *       linking there would be misleading." That justification went stale
 *       (false) once T101 wired `/outreach/:eventId` to the real
 *       `OutreachDetail.tsx` (confirmed by reading `router.tsx` directly,
 *       read-only import-only file: the route's own `element` is
 *       `<RequireAuth><OutreachDetail /></RequireAuth>`, not a placeholder)
 *       -- meaning every event George (or any coach/student/parent) created
 *       became a dead end on this list page: no way to reach the real
 *       Edit/Cancel/RSVP-visibility functionality that already lives on that
 *       page. Fixed here: every row (Upcoming AND Past, coach AND
 *       student/parent view) now carries a real "View details" `Link` to
 *       `routePaths.outreachEvent(event.id)` in its `ListItem`'s
 *       `endContent` -- see module doc #13 for the full precedent
 *       investigation and shape.
 *    d. `MarkDayCompleteDialog.tsx` (T040) and `Leaderboard.tsx` (T044) are
 *       not referenced, imported, or stubbed anywhere in this file: neither
 *       is part of OUT-01's list-page scope (this task's own objective
 *       text). T101 UPDATE: `MarkDayCompleteDialog.tsx`'s own default
 *       `onMarkComplete` is now wired to a real mutation (same loader
 *       module, module doc #11) but remains standalone/not imported here,
 *       same reasoning as (b) above. `Leaderboard.tsx` is P11's own separate
 *       scope, untouched.
 *
 * -----------------------------------------------------------------------
 * 9. DES-12 four states, reachable independently for both role variants.
 *
 * `OutreachList` itself owns the single `loadData` call (loading/error/
 * "signed out" states are identical regardless of which view would
 * eventually render), then branches by role only once data has loaded
 * successfully. Empty state text/actions differ per role (coach gets an
 * `EmptyState` with a "New outreach event" action; student/parent gets a
 * plain read-only `EmptyState`), and each Upcoming/Past `List` section
 * independently falls back to its own smaller empty message when only one
 * of the two buckets is empty (e.g. "no upcoming outreach, two past
 * events"). See this task's worker output for real render-output proof of
 * loading / error / empty / populated, for both roles.
 *
 * -----------------------------------------------------------------------
 * 10. Astryx prop sourcing (constitution item 2) -- every prop used below,
 *     cross-checked against `docs/swarm/astryx-api.md` directly (line
 *     numbers as of this task's read):
 *
 *  - `ProgressBar` (line 5416 section, Props table): `label` (required),
 *    `value`, `max`, `variant` (`'accent'`/`'neutral'`), `hasValueLabel`,
 *    `formatValueLabel` used.
 *  - `AvatarGroup` (line 2631 section, Props table): `children`, `size`
 *    used. `AvatarGroupOverflow`'s own subsection is `undefined`;
 *    `npm run astryx -- component AvatarGroupOverflow` (run live for this
 *    task) resolves `count` (required) + `children` -- only `count` used.
 *  - `Avatar` (line 419 section, Props table): `name`, `size` used.
 *  - `SegmentedControl` (line 5575 section, Props table): `value`
 *    (required), `onChange` (required), `label` (required) used.
 *    `SegmentedControlItem`'s own subsection is `undefined`;
 *    `npm run astryx -- component SegmentedControlItem` resolves `value`
 *    (required) + `label` (required) -- only those two used.
 *  - `Toast`: `astryx-api.md` line 5998 section's own Props table is a real,
 *    disclosed doc-gap (module doc #4 above) -- it names `uniqueID`/
 *    `onHide` where the installed `ToastProps`
 *    (`node_modules/@astryxdesign/core/dist/Toast/Toast.d.ts`) has neither.
 *    Only the installed-source-verified props are used: `body` (required),
 *    `type`, `isAutoHide` (required), `autoHideDuration` (required),
 *    `onDismiss` (required, not `onHide`).
 *  - `Badge` (line 493 section, Props table): `variant` (`'neutral'`
 *    only, everywhere in this file -- BEH-04), `label` used.
 *  - `Banner` (line 2694 section, Props table): `status`, `title`,
 *    `description`, `isDismissable`, `onDismiss` used.
 *  - `EmptyState` (line 3954 section, Props table): `title` (required),
 *    `description`, `actions`, `headingLevel` used.
 *  - `Skeleton` (T081, "Skeleton" section, lines 621-655): `width`,
 *    `height`, `index` used to preview this screen's predictable
 *    heading+goal-bar+session-list shape (shared by both the coach and
 *    student/parent views, whichever the already-known `user.role`
 *    resolves to), replacing `Spinner`'s prior use here per Astryx's own
 *    guidance (known-dimension content). `VisuallyHidden` + the wrapping
 *    `VStack`'s `aria-busy` carry the "Loading outreach events…"
 *    announcement `Spinner`'s `label` used to provide.
 *  - `List`/`ListItem` (line 4536 section): `List`'s Props table
 *    (`children`, `hasDividers`, `header`) used directly. `ListItem`'s own
 *    subsection is `undefined`; `npm run astryx -- component ListItem`
 *    resolves `label` (required), `description`, `endContent` -- only
 *    those three used (no `onClick`/`href` -- rows are not interactive,
 *    avoiding the doc's own "Don't place interactive elements inside an
 *    interactive list item" warning by never making the row itself
 *    interactive). T112 HOTFIX UPDATE: this constraint is still honored
 *    exactly -- the ONE real interactive element each row's `endContent`
 *    now also carries (alongside the pre-existing `AvatarGroup`/`Badge`/
 *    `SegmentedControl`) is a `Link` (below), never an `onClick`/`href` on
 *    the `ListItem` itself. See module doc #13.
 *  - `Link` (line 1910 section, Props table): `as` (`RouterLink`, matching
 *    `CalendarPage.tsx`'s/`LiveConsole.tsx`'s/`AdminToggles.tsx`'s own
 *    established `<Link as={RouterLink} href={...}>` SPA-navigation idiom --
 *    module doc #13), `href`, `isStandalone` used ("Do: Set isStandalone
 *    when the link appears outside of inline text", which this one does --
 *    it lives in a `ListItem`'s `endContent`, not inline body text). T112
 *    HOTFIX: newly added to this file.
 *  - `Button` (line 1768 section, Props table): `label`, `variant`,
 *    `onClick` used.
 *  - `Heading`: doc's own "Components > Heading" subsection is `undefined`
 *    (same disclosed CLI-cross-checked gap `RosterShell.tsx`/T021,
 *    `MeetingsList.tsx`/T030 already hit); `npm run astryx -- component
 *    Heading` resolves `level` (required) + `children` (required) -- only
 *    those two used.
 *  - `Text` (line 829 section, Props table): `type` (`'supporting'`),
 *    `color` used.
 *  - `VStack`/`HStack` ("Stack" section, `VStack`/`HStack` subsections):
 *    `gap`, `padding`, `hAlign`, `vAlign`, `wrap`, `justify` used.
 *
 * -----------------------------------------------------------------------
 * 11. T101 (ED-1 Packet P10): real load + real "New outreach event" wiring
 *     -- `loadData` now defaults to `loadOutreachData`
 *     (`../../lib/supabase/loaders/outreach.ts`, a real query), and the
 *     "New outreach event" button (coach view) now opens the real,
 *     already-built `OutreachEventDialog.tsx` (T039) in CREATE mode
 *     (`isEventDialogOpen` state) instead of showing a stub `Banner`.
 *     `handleSaveEventSubmit` wires the dialog's own `onSaveEvent` prop to a
 *     real default (`saveOutreachEvent`, same loader module) that inserts
 *     one real `events` row (type `outreach`, or `competition` per that
 *     dialog's own CMP-01 type `Selector`) + one real `event_sessions` row
 *     per session, then reloads this page's own data from `loadData(seasonId)`
 *     so the newly-created event appears without a manual refresh (a full
 *     reload, not a client-side merge, same "recomputing derived fields
 *     client-side would duplicate the loader's own DB-driven joins for no
 *     benefit" reasoning `MeetingsList.tsx`'s own T096 module doc #7a
 *     already established). `overrideData`/`reloadOutreachData` below are the
 *     mechanism that lets this page reload its own already-successfully-
 *     loaded data in place, without re-triggering the `loading` DES-12 state
 *     (a full top-level re-render through `loadState` would flash the
 *     Skeleton loading state again, which `MeetingsList.tsx`'s own
 *     `CoachMeetingsView`/`StudentMeetingsView` split avoids by owning their
 *     `loadData` calls independently -- `OutreachList.tsx`'s own single
 *     top-level `loadState`/dual-view-props architecture, unchanged by this
 *     task, needed this narrower `overrideData` seam instead of that larger
 *     restructuring).
 *
 *     `teams` (`OutreachEventDialog`'s own prop) is deliberately NOT
 *     overridden here -- it falls back to that component's own already-
 *     disclosed fixture team list, same "still fixture-backed" posture
 *     `MeetingsList.tsx`'s own T096 wiring of `ScheduleMeetingsDialog`
 *     already established for the identical reason (no second teams-loading
 *     mechanism is part of this task's own Allowed Files scope).
 *
 * -----------------------------------------------------------------------
 * 12. T106 HOTFIX: real active-season resolution, mirroring
 *     `ReportsShell.tsx`'s (T091/T095/T098, already-Passed) established
 *     pattern exactly -- closes a live regression George hit testing
 *     `/outreach` in the dev server.
 *
 * Before this fix, `OutreachList`'s own `seasonId` prop defaulted straight to
 * `PLACEHOLDER_SEASON_ID` (`'season-placeholder-current'`, not a valid
 * `uuid`) and was passed directly into the real `loadOutreachData` (module
 * doc #11's own T101 default), which runs a real Postgrest
 * `.eq('season_id', seasonId)` query against a `uuid`-typed column --
 * Postgres rejects that query outright (never even reaching RLS/filtering),
 * which the page's own error-state Banner surfaced generically as "Couldn't
 * load outreach events." T101's own worker packet explicitly scoped
 * `seasonId` resolution as out of scope and disclosed the risk, but its own
 * assumption that an unresolved/placeholder id would just "legitimately
 * return empty data" turned out to be wrong once verified against real
 * Postgrest behavior -- it is a hard query error, not an empty-data degrade.
 *
 * Fix: `OutreachList` now calls `useActiveSeason()` unconditionally (same
 * rules-of-hooks posture `ReportsShell.tsx` already established) and
 * resolves `resolvedSeasonId = seasonIdProp ?? (activeSeason.status ===
 * 'ready' ? activeSeason.season.id : null)` -- the identical precedence
 * `ReportsShell.tsx`'s own module doc #2 uses (an explicit prop always wins;
 * the hook is only consulted when no prop was supplied). Whenever
 * `resolvedSeasonId` is `null` (the hook is `'loading'`/`'none'`/`'error'`
 * and no explicit prop was given), this component renders
 * `OutreachSeasonState` -- a direct structural port of `ReportsShell.tsx`'s
 * own `ReportsSeasonState` (same `Banner`/`EmptyState`/`Skeleton`/
 * `VisuallyHidden` DES-12 four-state shape) -- INSTEAD of ever calling the
 * real `loadData`/`loadOutreachData`. The real per-event/session/RSVP data
 * load (this file's own pre-existing `OutreachListLoaded`, formerly inlined
 * directly in `OutreachList` itself) is now a separate child component that
 * only ever mounts once a real, non-null `seasonId` has been resolved -- so
 * its own `useLoadState(() => loadData(seasonId), ...)` call can never fire
 * with a null/placeholder id, satisfying React's rules-of-hooks the same way
 * `ReportsShell.tsx` does (delegating the data-fetching hook to a
 * conditionally-rendered child, rather than gating the hook call itself).
 *
 * `reloadOutreachData()` (module doc #11's own coach-create-event reload
 * path) now lives inside `OutreachListLoaded` and closes over that same
 * component's own `seasonId` prop -- i.e. the SAME resolved id the initial
 * load used, never the raw caller-supplied prop or the placeholder, so a
 * coach creating an event during a real season reloads against that same
 * real season.
 *
 * `PLACEHOLDER_SEASON_ID` itself: investigated, not assumed -- it remains
 * used (unchanged) as `FIXTURE_EVENTS`/`FIXTURE_GOAL_CONFIG`'s own fixture
 * `seasonId` value, which `defaultLoadOutreachData` (the fixture loader,
 * still exported for tests/callers that want to inject it explicitly) keys
 * its filtering to. It is NOT dead code -- only its former use as
 * `OutreachList`'s own real-loader-facing default was the bug, and that use
 * is what this fix removes.
 *
 * `viewerStudentId = PLACEHOLDER_CURRENT_STUDENT_ID` (module doc #7) is a
 * separate, already-disclosed gap (which student, not which season) --
 * untouched by this fix, out of scope per this task's own packet.
 *
 * -----------------------------------------------------------------------
 * 13. T112 HOTFIX: navigation affordance to `/outreach/:eventId` on every
 *     row -- Calendar-precedent investigation, in full (George live-reported
 *     dead-end event rows; module doc #8c UPDATE closes the stale stub).
 *
 * Investigation: `CalendarPage.tsx` (read-only Forbidden File, precedent
 * reference only, per this task's own Known Context/Traps #1) was read
 * directly rather than guessed at. Its `CalendarSessionRowItem` renders a
 * non-interactive `ListItem` (`label`/`description` only, no `onClick`/
 * `href`) whose `endContent` is an `HStack` containing a type `Badge`
 * followed by `<Link as={RouterLink} href={detailHrefFor(event, session)}
 * isStandalone>View details – {event.title}</Link>` -- a real Astryx `Link`
 * (`@astryxdesign/core`) rendered `as` `react-router-dom`'s own `Link`
 * (`RouterLink`) for real SPA client-side navigation, not a `Button`/
 * `onClick={() => navigate(...)}` and not an interactive `ListItem` itself.
 * For the outreach/competition branch specifically, `detailHrefFor` calls
 * the already-real `routePaths.outreachEvent(event.id)` helper (`router.tsx`,
 * import-only per that file's own Forbidden Files carve-out) -- the exact
 * same helper this file now uses below, for the exact same route.
 *
 * Mirrored here EXACTLY, not reinvented: `CoachOutreachRowItem`'s and
 * `StudentOutreachRowItem`'s own `endContent` (module docs #5/#7 above) now
 * each end with the identical `<Link as={RouterLink}
 * href={routePaths.outreachEvent(event.id)} isStandalone>View details –
 * {event.title}</Link>` element -- same component, same `as`/`href`/
 * `isStandalone` prop set, same "View details – <title>" text shape (this
 * file's own `astryx-api.md` "Link Best Practices" cross-check, same as
 * `CalendarPage.tsx`'s own already-Passed checker-fixed distinguishable-text
 * requirement -- module doc #10 above), same "non-interactive `ListItem`
 * row + one real interactive element in `endContent`" shape satisfying the
 * SAME Astryx `ListItem` constraint this file's own module doc #10 already
 * documents (`ListItem` resolves only `label`/`description`/`endContent`;
 * "Don't place interactive elements inside an interactive list item" is
 * honored by never making the row itself interactive, exactly as
 * `CalendarPage.tsx`'s own module doc #7/#8 already established for the
 * identical component).
 *
 * Both role variants, both buckets (the packet's own explicit requirement):
 * `CoachOutreachRowItem` is shared by both `CoachOutreachSection` instances
 * (`title="Upcoming"` and `title="Past"`, module doc #5 above) and
 * `StudentOutreachRowItem` is shared by both `StudentOutreachSection`
 * instances (module doc #7 above) -- each row component's `endContent` now
 * unconditionally includes the `Link` (previously the coach row's
 * `AvatarGroup`/`Badge` pair, and by extension its whole `endContent`, was
 * `undefined` for Past rows; the `Link` is now pulled out of that
 * conditional so it renders for every row regardless of session status),
 * meaning the fix reaches all four spots (coach Upcoming, coach Past,
 * student/parent Upcoming, student/parent Past) through exactly two shared
 * row components, not four separate edits.
 *
 * `routePaths.outreachEvent(eventId)` (relative `/outreach/${eventId}`,
 * confirmed by reading `router.tsx` directly) is used for this in-app
 * navigation, deliberately NOT `OutreachDetail.tsx`'s own
 * `buildOutreachDetailUrl(eventId, origin)` (an absolute
 * `${origin}/outreach/${eventId}` URL purpose-built for that page's own
 * "Copy link" clipboard feature, per that file's own module doc #6) -- the
 * packet's own Known Context/Traps #3 explicitly flags this distinction, and
 * `CalendarPage.tsx`'s own precedent likewise uses the relative
 * `routePaths.outreachEvent(...)` path, never an absolute URL, for its
 * in-app `Link`.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Avatar,
  AvatarGroup,
  AvatarGroupOverflow,
  Badge,
  Banner,
  Button,
  EmptyState,
  Heading,
  HStack,
  Link,
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
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../../app/guards';
// T106 HOTFIX: the same real active-season resolution mechanism
// `ReportsShell.tsx` already established (module doc #12) -- read-only
// import, this file is not `SeasonProvider.tsx`'s own module.
import { useActiveSeason } from '../../app/SeasonProvider';
// T112 HOTFIX (module docs #8c/#13): `routePaths.outreachEvent` is the SAME
// already-real, already-wired helper `CalendarPage.tsx` (its own read-only
// precedent for this task) already uses for its outreach-row `Link` --
// import-only, `router.tsx` itself remains a forbidden/read-only file.
import { routePaths } from '../../app/router';
// T101 (ED-1 Packet P10): real load/create wiring -- module doc #11.
// `saveOutreachEvent`/`OutreachEventDialog` are this task's own wiring of an
// ALREADY-BUILT, ALREADY-PASSED standalone dialog into this page for the
// first time; nothing inside `OutreachEventDialog.tsx` itself is modified
// (forbidden/read-only file).
import { loadOutreachData, saveOutreachEvent } from '../../lib/supabase/loaders/outreach';
import { OutreachEventDialog, type OnSaveOutreachEventFn } from './OutreachEventDialog';

// ---------------------------------------------------------------------------
// Types -- verbatim camelCase renames of real column subsets. Module doc #1.
// ---------------------------------------------------------------------------

export type EventType = 'meeting' | 'outreach' | 'competition';
export type SessionStatus = 'scheduled' | 'completed' | 'canceled';
export type RsvpStatus = 'going' | 'maybe' | 'declined';

export interface OutreachEventRow {
  id: string;
  seasonId: string;
  type: EventType;
  title: string;
  locationName: string;
}

export interface OutreachSessionRow {
  id: string;
  eventId: string;
  sessionDate: string;
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
  peopleReached: number | null;
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

export interface OutreachStudentFixture {
  id: string;
  name: string;
}

/**
 * UI-only season-goal target -- not present anywhere in `events`/
 * `event_sessions`/`rsvps`/`attendance` (confirmed by reading
 * `supabase/migrations/20260717000000_scheduling_attendance.sql` directly:
 * no `goal`/`target` column anywhere in that migration). Disclosed
 * placeholder pending a real season-goal-config data source, same class of
 * gap as `PLACEHOLDER_CURRENT_SEASON_ID` elsewhere in this batch.
 */
export interface OutreachGoalConfig {
  seasonId: string;
  individualGoalHoursByStudentId: Readonly<Record<string, number>>;
}

export interface OutreachLoadResult {
  events: readonly OutreachEventRow[];
  sessions: readonly OutreachSessionRow[];
  rsvps: readonly RsvpRow[];
  students: readonly OutreachStudentFixture[];
  goalConfig: OutreachGoalConfig;
}

export type LoadOutreachDataFn = (seasonId: string) => Promise<OutreachLoadResult>;

export interface EnrichedOutreachSession {
  session: OutreachSessionRow;
  event: OutreachEventRow;
}

export interface HoursBreakdown {
  confirmedHours: number;
  plannedHours: number;
}

// ---------------------------------------------------------------------------
// Placeholder identifiers -- module doc #7.
// ---------------------------------------------------------------------------

export const PLACEHOLDER_CURRENT_STUDENT_ID = 'student-placeholder-current-viewer';
/**
 * T106 UPDATE (module doc #12): no longer `OutreachList`'s own default
 * `seasonId` (that was this hotfix's own root cause -- a non-UUID string
 * reaching a real Postgrest `uuid`-typed `.eq()` query). Still genuinely
 * used, unchanged, as `FIXTURE_EVENTS`/`FIXTURE_GOAL_CONFIG`'s own fixture
 * `seasonId` value below, which `defaultLoadOutreachData` (the fixture
 * loader, still exported for tests/callers that inject it explicitly) keys
 * its own filtering to -- not dead code.
 */
const PLACEHOLDER_SEASON_ID = 'season-placeholder-current';

// ---------------------------------------------------------------------------
// Fixture data (constitution item 6: fabricated names only). Module doc #2.
// ---------------------------------------------------------------------------

const FIXTURE_STUDENTS: readonly OutreachStudentFixture[] = [
  { id: 'student-amara-webb', name: 'Amara Webb' },
  { id: 'student-cole-jennings', name: 'Cole Jennings' },
  { id: 'student-priya-patel', name: 'Priya Patel' },
  { id: 'student-devon-marsh', name: 'Devon Marsh' },
  { id: PLACEHOLDER_CURRENT_STUDENT_ID, name: 'Lena Osei' },
];

const FIXTURE_GOAL_CONFIG: OutreachGoalConfig = {
  seasonId: PLACEHOLDER_SEASON_ID,
  individualGoalHoursByStudentId: {
    'student-amara-webb': 10,
    'student-cole-jennings': 8,
    'student-priya-patel': 12,
    'student-devon-marsh': 10,
    [PLACEHOLDER_CURRENT_STUDENT_ID]: 12,
  },
};

const FIXTURE_EVENTS: readonly OutreachEventRow[] = [
  {
    id: 'event-food-bank-sort',
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'outreach',
    title: 'Community Food Bank Sort',
    locationName: 'Riverside Food Bank',
  },
  {
    id: 'event-park-cleanup',
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'outreach',
    title: 'Riverside Park Cleanup',
    locationName: 'Riverside Park',
  },
  {
    id: 'event-tutoring-drive',
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'outreach',
    title: 'After-School Tutoring Drive',
    locationName: 'Lincoln Elementary',
  },
  // Deliberately type: 'meeting' -- proves NAV-07 filtering (module doc #2).
  // This event's own session ("Weekly Team Meeting") must NEVER appear
  // anywhere this file renders.
  {
    id: 'event-team-meeting',
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'meeting',
    title: 'Weekly Team Meeting',
    locationName: 'Clubhouse',
  },
];

const FIXTURE_SESSIONS: readonly OutreachSessionRow[] = [
  {
    id: 'session-food-bank-past',
    eventId: 'event-food-bank-sort',
    sessionDate: '2026-06-14',
    startsAt: '2026-06-14T14:00:00.000Z', // 9:00 AM America/Chicago (CDT)
    endsAt: '2026-06-14T17:00:00.000Z', // 12:00 PM America/Chicago -- 3h
    status: 'completed',
    peopleReached: 120,
  },
  {
    id: 'session-food-bank-upcoming',
    eventId: 'event-food-bank-sort',
    sessionDate: '2026-08-02',
    startsAt: '2026-08-02T14:00:00.000Z',
    endsAt: '2026-08-02T17:00:00.000Z', // 3h
    status: 'scheduled',
    peopleReached: null,
  },
  {
    id: 'session-park-cleanup-upcoming',
    eventId: 'event-park-cleanup',
    sessionDate: '2026-07-26',
    startsAt: '2026-07-26T15:00:00.000Z', // 10:00 AM America/Chicago
    endsAt: '2026-07-26T17:00:00.000Z', // 12:00 PM America/Chicago -- 2h
    status: 'scheduled',
    peopleReached: null,
  },
  {
    id: 'session-tutoring-canceled',
    eventId: 'event-tutoring-drive',
    sessionDate: '2026-06-01',
    startsAt: '2026-06-01T22:00:00.000Z', // 5:00 PM America/Chicago
    endsAt: '2026-06-02T00:00:00.000Z', // 7:00 PM America/Chicago -- 2h, but canceled
    status: 'canceled',
    peopleReached: null,
  },
  // Meeting session -- module doc #2. Must never render anywhere.
  {
    id: 'session-team-meeting',
    eventId: 'event-team-meeting',
    sessionDate: '2026-07-22',
    startsAt: '2026-07-22T23:00:00.000Z',
    endsAt: '2026-07-23T01:00:00.000Z',
    status: 'scheduled',
    peopleReached: null,
  },
];

const FIXTURE_RSVPS: readonly RsvpRow[] = [
  {
    id: 'rsvp-1',
    sessionId: 'session-food-bank-past',
    studentId: 'student-amara-webb',
    status: 'going',
    respondedBy: 'student-amara-webb',
    updatedAt: '2026-06-10T12:00:00.000Z',
    createdAt: '2026-06-10T12:00:00.000Z',
  },
  {
    id: 'rsvp-2',
    sessionId: 'session-food-bank-past',
    studentId: 'student-cole-jennings',
    status: 'going',
    respondedBy: 'student-cole-jennings',
    updatedAt: '2026-06-10T12:05:00.000Z',
    createdAt: '2026-06-10T12:05:00.000Z',
  },
  {
    id: 'rsvp-3',
    sessionId: 'session-food-bank-past',
    studentId: 'student-priya-patel',
    status: 'declined',
    respondedBy: 'student-priya-patel',
    updatedAt: '2026-06-10T12:10:00.000Z',
    createdAt: '2026-06-10T12:10:00.000Z',
  },
  {
    id: 'rsvp-4',
    sessionId: 'session-food-bank-past',
    studentId: PLACEHOLDER_CURRENT_STUDENT_ID,
    status: 'going',
    respondedBy: PLACEHOLDER_CURRENT_STUDENT_ID,
    updatedAt: '2026-06-10T12:15:00.000Z',
    createdAt: '2026-06-10T12:15:00.000Z',
  },
  {
    id: 'rsvp-5',
    sessionId: 'session-food-bank-upcoming',
    studentId: 'student-amara-webb',
    status: 'going',
    respondedBy: 'student-amara-webb',
    updatedAt: '2026-07-15T09:00:00.000Z',
    createdAt: '2026-07-15T09:00:00.000Z',
  },
  {
    id: 'rsvp-6',
    sessionId: 'session-food-bank-upcoming',
    studentId: 'student-cole-jennings',
    status: 'maybe',
    respondedBy: 'student-cole-jennings',
    updatedAt: '2026-07-15T09:05:00.000Z',
    createdAt: '2026-07-15T09:05:00.000Z',
  },
  {
    id: 'rsvp-7',
    sessionId: 'session-food-bank-upcoming',
    studentId: 'student-devon-marsh',
    status: 'declined',
    respondedBy: 'student-devon-marsh',
    updatedAt: '2026-07-15T09:10:00.000Z',
    createdAt: '2026-07-15T09:10:00.000Z',
  },
  // Priya and the current viewer deliberately have NO rsvp row for
  // session-food-bank-upcoming -- the "unanswered" case (module doc #5).
  {
    id: 'rsvp-8',
    sessionId: 'session-park-cleanup-upcoming',
    studentId: 'student-priya-patel',
    status: 'going',
    respondedBy: 'student-priya-patel',
    updatedAt: '2026-07-10T09:00:00.000Z',
    createdAt: '2026-07-10T09:00:00.000Z',
  },
  {
    id: 'rsvp-9',
    sessionId: 'session-park-cleanup-upcoming',
    studentId: 'student-devon-marsh',
    status: 'going',
    respondedBy: 'student-devon-marsh',
    updatedAt: '2026-07-10T09:05:00.000Z',
    createdAt: '2026-07-10T09:05:00.000Z',
  },
  {
    id: 'rsvp-10',
    sessionId: 'session-park-cleanup-upcoming',
    studentId: PLACEHOLDER_CURRENT_STUDENT_ID,
    status: 'maybe',
    respondedBy: PLACEHOLDER_CURRENT_STUDENT_ID,
    updatedAt: '2026-07-10T09:10:00.000Z',
    createdAt: '2026-07-10T09:10:00.000Z',
  },
  // Amara and Cole deliberately have NO rsvp row for
  // session-park-cleanup-upcoming -- the "unanswered" case (module doc #5).
  {
    id: 'rsvp-11',
    sessionId: 'session-tutoring-canceled',
    studentId: 'student-cole-jennings',
    status: 'going',
    respondedBy: 'student-cole-jennings',
    updatedAt: '2026-05-20T09:00:00.000Z',
    createdAt: '2026-05-20T09:00:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// Pure functions -- exported for direct testing. Module docs #2/#3/#4/#5.
// ---------------------------------------------------------------------------

/** The ONLY `event.type` predicate in this file (module doc #2). */
export function filterOutreachEvents(events: readonly OutreachEventRow[]): OutreachEventRow[] {
  return events.filter((event) => event.type === 'outreach');
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** `ends_at - starts_at`, in hours. */
export function sessionHours(session: OutreachSessionRow): number {
  const ms = new Date(session.endsAt).getTime() - new Date(session.startsAt).getTime();
  return Math.max(0, ms / 3_600_000);
}

/**
 * BEH-02 (module doc #3): `going` + `completed` -> confirmed; `going` +
 * `scheduled` -> planned; anything else (a `maybe`/`declined` RSVP, no RSVP
 * at all, or a `canceled` session) contributes to neither. Never returns a
 * combined number.
 */
export function computeStudentHours(
  studentId: string,
  sessions: readonly OutreachSessionRow[],
  rsvps: readonly RsvpRow[],
): HoursBreakdown {
  let confirmedHours = 0;
  let plannedHours = 0;
  for (const session of sessions) {
    const rsvp = rsvps.find(
      (r) => r.sessionId === session.id && r.studentId === studentId && r.status === 'going',
    );
    if (!rsvp) continue;
    if (session.status === 'completed') {
      confirmedHours += sessionHours(session);
    } else if (session.status === 'scheduled') {
      plannedHours += sessionHours(session);
    }
  }
  return { confirmedHours: round1(confirmedHours), plannedHours: round1(plannedHours) };
}

/** Sums each student's confirmed/planned hours SEPARATELY across the group
 * (module doc #3) -- confirmed totals never mix with planned totals. */
export function computeGroupHours(
  studentIds: readonly string[],
  sessions: readonly OutreachSessionRow[],
  rsvps: readonly RsvpRow[],
): HoursBreakdown {
  let confirmedHours = 0;
  let plannedHours = 0;
  for (const studentId of studentIds) {
    const breakdown = computeStudentHours(studentId, sessions, rsvps);
    confirmedHours += breakdown.confirmedHours;
    plannedHours += breakdown.plannedHours;
  }
  return { confirmedHours: round1(confirmedHours), plannedHours: round1(plannedHours) };
}

/** "sum of individual goals" -- the coach team bar's own goal denominator. */
export function sumIndividualGoals(
  studentIds: readonly string[],
  goalConfig: OutreachGoalConfig,
): number {
  return round1(
    studentIds.reduce((sum, id) => sum + (goalConfig.individualGoalHoursByStudentId[id] ?? 0), 0),
  );
}

/** `scheduled` -> Upcoming; anything else -> Past. Sorted by start time. */
export function buildUpcomingPast(
  sessions: readonly OutreachSessionRow[],
  events: readonly OutreachEventRow[],
): { upcoming: EnrichedOutreachSession[]; past: EnrichedOutreachSession[] } {
  const eventById = new Map(events.map((event) => [event.id, event] as const));
  const enriched: EnrichedOutreachSession[] = [];
  for (const session of sessions) {
    const event = eventById.get(session.eventId);
    if (event) enriched.push({ session, event });
  }
  const upcoming = enriched
    .filter((entry) => entry.session.status === 'scheduled')
    .sort((a, b) => a.session.startsAt.localeCompare(b.session.startsAt));
  const past = enriched
    .filter((entry) => entry.session.status !== 'scheduled')
    .sort((a, b) => b.session.startsAt.localeCompare(a.session.startsAt));
  return { upcoming, past };
}

export const GOAL_MILESTONES = [25, 50, 75, 100] as const;
export type GoalMilestone = (typeof GOAL_MILESTONES)[number];

/** Percentage of the goal reached by CONFIRMED hours only (module doc #4). */
export function confirmedPercent(confirmedHours: number, goalHours: number): number {
  if (goalHours <= 0) return 0;
  return Math.min(100, (confirmedHours / goalHours) * 100);
}

export function crossedMilestones(percent: number): GoalMilestone[] {
  return GOAL_MILESTONES.filter((milestone) => percent >= milestone);
}

/**
 * BEH-04 / Known Context/Traps #3 (module doc #5): a real, exported,
 * reusable "unanswered RSVP" count. "Unanswered" = an upcoming
 * (`status === 'scheduled'`) session with NO `rsvps` row at all for that
 * student -- `declined`/`maybe` ARE answers and are never counted.
 * Generic over `studentIds` so a future SideNav-wiring task can call this
 * with the viewer's own linked student(s) or the full roster, as
 * appropriate to who is signed in.
 */
export function getUnansweredRsvpCount(
  sessions: readonly OutreachSessionRow[],
  rsvps: readonly RsvpRow[],
  studentIds: readonly string[],
): number {
  const upcomingSessions = sessions.filter((session) => session.status === 'scheduled');
  let count = 0;
  for (const session of upcomingSessions) {
    for (const studentId of studentIds) {
      const hasResponse = rsvps.some(
        (rsvp) => rsvp.sessionId === session.id && rsvp.studentId === studentId,
      );
      if (!hasResponse) count += 1;
    }
  }
  return count;
}

/**
 * Applies a local (fixture-only, not persisted -- module doc #8b) RSVP
 * change for one student/session pair, synthesizing a new row when none
 * existed yet (the "unanswered" case being answered for the first time).
 */
export function withRsvpOverride(
  rsvps: readonly RsvpRow[],
  studentId: string,
  sessionId: string,
  status: RsvpStatus,
): RsvpRow[] {
  const now = new Date().toISOString();
  const existingIndex = rsvps.findIndex(
    (rsvp) => rsvp.studentId === studentId && rsvp.sessionId === sessionId,
  );
  if (existingIndex === -1) {
    const newRow: RsvpRow = {
      id: `local-rsvp-${studentId}-${sessionId}`,
      sessionId,
      studentId,
      status,
      respondedBy: studentId,
      updatedAt: now,
      createdAt: now,
    };
    return [...rsvps, newRow];
  }
  return rsvps.map((rsvp, index) =>
    index === existingIndex ? { ...rsvp, status, updatedAt: now } : rsvp,
  );
}

// ---------------------------------------------------------------------------
// Fixture loader -- obviously-fake default for the injectable `loadData`
// seam (Known Context/Traps #1). Real callers (once a shared Supabase
// client exists -- a separate, not-yet-dispatched task) pass their own.
// ---------------------------------------------------------------------------

export async function defaultLoadOutreachData(seasonId: string): Promise<OutreachLoadResult> {
  return {
    events: FIXTURE_EVENTS.filter((event) => event.seasonId === seasonId),
    sessions: FIXTURE_SESSIONS,
    rsvps: FIXTURE_RSVPS,
    students: FIXTURE_STUDENTS,
    goalConfig:
      FIXTURE_GOAL_CONFIG.seasonId === seasonId
        ? FIXTURE_GOAL_CONFIG
        : { seasonId, individualGoalHoursByStudentId: {} },
  };
}

// ---------------------------------------------------------------------------
// NFR-09 date/time formatting -- timestamps stored UTC, displayed
// America/Chicago. Independently reimplemented here (not imported) --
// `MeetingsList.tsx` is not in this task's Allowed Files.
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

/** `session_date` ('YYYY-MM-DD') -> a real calendar date, parsed without a
 * local-timezone day-shift. */
function parseDateOnly(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)); // noon UTC avoids DST edge cases
}

export function formatSessionDateOnly(session: OutreachSessionRow): string {
  return WEEKDAY_DATE_FORMATTER.format(parseDateOnly(session.sessionDate));
}

export function formatSessionDateTime(session: OutreachSessionRow): string {
  const startText = CLOCK_TIME_FORMATTER.format(new Date(session.startsAt));
  const endText = CLOCK_TIME_FORMATTER.format(new Date(session.endsAt));
  return `${formatSessionDateOnly(session)} · ${startText}–${endText}`;
}

// ---------------------------------------------------------------------------
// BEH-01 milestone-toast dedupe -- module doc #4.
// ---------------------------------------------------------------------------

function getLocalStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    // localStorage can throw in locked-down/private-browsing contexts.
    return null;
  }
}

function milestoneToastStorageKey(
  seasonId: string,
  goalBarId: string,
  milestone: GoalMilestone,
): string {
  return `volt.outreach.milestoneToast.${seasonId}.${goalBarId}.${milestone}`;
}

export function hasMilestoneToastFired(
  seasonId: string,
  goalBarId: string,
  milestone: GoalMilestone,
): boolean {
  return (
    getLocalStorage()?.getItem(milestoneToastStorageKey(seasonId, goalBarId, milestone)) === 'true'
  );
}

export function markMilestoneToastFired(
  seasonId: string,
  goalBarId: string,
  milestone: GoalMilestone,
): void {
  getLocalStorage()?.setItem(milestoneToastStorageKey(seasonId, goalBarId, milestone), 'true');
}

interface ActiveMilestoneToast {
  id: string;
  message: string;
}

function useMilestoneToasts(
  seasonId: string,
  goalBarId: string,
  label: string,
  confirmedHours: number,
  goalHours: number,
): { toasts: ActiveMilestoneToast[]; dismissToast: (id: string) => void } {
  const [toasts, setToasts] = useState<ActiveMilestoneToast[]>([]);

  useEffect(() => {
    const percent = confirmedPercent(confirmedHours, goalHours);
    const newlyCrossed = crossedMilestones(percent).filter(
      (milestone) => !hasMilestoneToastFired(seasonId, goalBarId, milestone),
    );
    if (newlyCrossed.length === 0) return;
    newlyCrossed.forEach((milestone) => markMilestoneToastFired(seasonId, goalBarId, milestone));
    setToasts((prev) => [
      ...prev,
      ...newlyCrossed.map((milestone) => ({
        id: `${goalBarId}-${milestone}`,
        message: `${label}: reached ${milestone}% of the season goal (confirmed hours).`,
      })),
    ]);
  }, [seasonId, goalBarId, label, confirmedHours, goalHours]);

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
// Goal bar -- shared by both role variants. Module docs #3/#4.
// ---------------------------------------------------------------------------

interface GoalProgressBarProps {
  /** Unique per goal bar ('team', or a student id) -- scopes the BEH-01
   * milestone-toast dedupe key. */
  goalBarId: string;
  seasonId: string;
  label: string;
  confirmedHours: number;
  plannedHours: number;
  goalHours: number;
}

function GoalProgressBar({
  goalBarId,
  seasonId,
  label,
  confirmedHours,
  plannedHours,
  goalHours,
}: GoalProgressBarProps): ReactNode {
  const { toasts, dismissToast } = useMilestoneToasts(
    seasonId,
    goalBarId,
    label,
    confirmedHours,
    goalHours,
  );
  const percent = confirmedPercent(confirmedHours, goalHours);
  const safeMax = goalHours > 0 ? goalHours : 1;

  return (
    <VStack gap={2}>
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
      <Heading level={2}>{label}</Heading>
      <Text type="supporting">Season goal: {goalHours} hrs</Text>
      <ProgressBar
        label={`${label}: confirmed hours`}
        value={confirmedHours}
        max={safeMax}
        variant="accent"
        hasValueLabel
        formatValueLabel={(value) => `${value} hrs confirmed`}
      />
      <ProgressBar
        label={`${label}: planned hours`}
        value={plannedHours}
        max={safeMax}
        variant="neutral"
        hasValueLabel
        formatValueLabel={(value) => `${value} hrs planned`}
      />
      <HStack justify="between" wrap="wrap" gap={2}>
        {GOAL_MILESTONES.map((milestone) =>
          percent >= milestone ? (
            <Badge key={milestone} variant="neutral" label={`${milestone}% reached`} />
          ) : (
            <Text key={milestone} type="supporting" color="secondary">
              {milestone}%
            </Text>
          ),
        )}
      </HStack>
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// Coach view -- module docs #2/#5/#8a/#9/#11.
// ---------------------------------------------------------------------------

function CoachOutreachRowItem({
  session,
  event,
  rsvps,
  students,
}: {
  session: OutreachSessionRow;
  event: OutreachEventRow;
  rsvps: readonly RsvpRow[];
  students: readonly OutreachStudentFixture[];
}): ReactNode {
  const goingStudents = useMemo(() => {
    const goingIds = new Set(
      rsvps
        .filter((rsvp) => rsvp.sessionId === session.id && rsvp.status === 'going')
        .map((rsvp) => rsvp.studentId),
    );
    return students.filter((student) => goingIds.has(student.id));
  }, [rsvps, students, session.id]);

  const visibleStudents = goingStudents.slice(0, 3);
  const overflowCount = Math.max(0, goingStudents.length - visibleStudents.length);

  const description = (
    <VStack gap={0.5}>
      <Text type="supporting">
        {formatSessionDateTime(session)} — {event.locationName}
      </Text>
      {session.status !== 'scheduled' &&
        (session.status === 'canceled' ? (
          <Text type="supporting">Canceled — no attendance recorded.</Text>
        ) : (
          <Text type="supporting">
            {session.peopleReached !== null
              ? `${session.peopleReached} people reached`
              : 'No attendance summary recorded yet.'}
          </Text>
        ))}
    </VStack>
  );

  // T112 HOTFIX (module doc #13): every row -- scheduled (Upcoming) AND
  // completed/canceled (Past) alike -- now always carries a real "View
  // details" `Link` to this event's own `/outreach/:eventId` detail page,
  // mirroring `CalendarPage.tsx`'s own `CalendarSessionRowItem` `endContent`
  // shape exactly (a non-interactive `ListItem` row, with the one real
  // interactive element living in `endContent`, module doc #10). The
  // Upcoming-only going-count `AvatarGroup`/`Badge` pair is unchanged and
  // still only renders for `scheduled` sessions; the `Link` itself renders
  // unconditionally.
  const endContent = (
    <HStack gap={2} vAlign="center">
      {session.status === 'scheduled' && (
        <>
          {goingStudents.length > 0 && (
            <AvatarGroup size="small">
              {visibleStudents.map((student) => (
                <Avatar key={student.id} name={student.name} size="small" />
              ))}
              {overflowCount > 0 && <AvatarGroupOverflow count={overflowCount} />}
            </AvatarGroup>
          )}
          <Badge variant="neutral" label={`${goingStudents.length} going`} />
        </>
      )}
      <Link as={RouterLink} href={routePaths.outreachEvent(event.id)} isStandalone>
        View details – {event.title}
      </Link>
    </HStack>
  );

  return <ListItem label={event.title} description={description} endContent={endContent} />;
}

function CoachOutreachSection({
  title,
  enrichedSessions,
  rsvps,
  students,
  emptyDescription,
}: {
  title: string;
  enrichedSessions: readonly EnrichedOutreachSession[];
  rsvps: readonly RsvpRow[];
  students: readonly OutreachStudentFixture[];
  emptyDescription: string;
}): ReactNode {
  return (
    <VStack gap={3}>
      <Heading level={2}>{title}</Heading>
      {enrichedSessions.length === 0 ? (
        <EmptyState
          headingLevel={3}
          title={`No ${title.toLowerCase()} outreach events`}
          description={emptyDescription}
        />
      ) : (
        <List hasDividers header={`${title} outreach events`}>
          {enrichedSessions.map(({ session, event }) => (
            <CoachOutreachRowItem
              key={session.id}
              session={session}
              event={event}
              rsvps={rsvps}
              students={students}
            />
          ))}
        </List>
      )}
    </VStack>
  );
}

interface CoachOutreachViewProps {
  seasonId: string;
  events: readonly OutreachEventRow[];
  sessions: readonly OutreachSessionRow[];
  rsvps: readonly RsvpRow[];
  students: readonly OutreachStudentFixture[];
  goalConfig: OutreachGoalConfig;
  /** T101 (module doc #11). Defaults to a real `events`/`event_sessions`
   * insert, passed straight through to `<OutreachEventDialog
   * onSaveEvent={...} />`. */
  onSaveEvent: OnSaveOutreachEventFn;
  /** T101 (module doc #11). Reloads this page's own already-loaded data in
   * place after a successful create, without re-triggering the top-level
   * `loading` DES-12 state. */
  onReload: () => Promise<void>;
}

/** T101 (module doc #11) -- real success/error messaging for event
 * creation, same "success Banner + error Banner, dismissable" pattern
 * `MeetingsList.tsx`'s own `FeedbackBanner` (T096) already established. */
interface FeedbackBanner {
  status: 'success' | 'error';
  title: string;
  description: string;
}

function CoachOutreachView({
  seasonId,
  events,
  sessions,
  rsvps,
  students,
  goalConfig,
  onSaveEvent,
  onReload,
}: CoachOutreachViewProps): ReactNode {
  const { upcoming, past } = useMemo(() => buildUpcomingPast(sessions, events), [sessions, events]);
  const studentIds = useMemo(() => students.map((student) => student.id), [students]);
  const teamHours = useMemo(
    () => computeGroupHours(studentIds, sessions, rsvps),
    [studentIds, sessions, rsvps],
  );
  const teamGoalHours = useMemo(
    () => sumIndividualGoals(studentIds, goalConfig),
    [studentIds, goalConfig],
  );
  const unansweredCount = useMemo(
    () => getUnansweredRsvpCount(sessions, rsvps, studentIds),
    [sessions, rsvps, studentIds],
  );

  // T101 (module doc #11) -- drives the one rendered
  // `<OutreachEventDialog>` instance, in CREATE mode only (this view never
  // renders an edit-mode instance; that lives on `OutreachDetail.tsx`).
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackBanner | null>(null);

  function openEventDialog(): void {
    setIsEventDialogOpen(true);
  }

  // T101 (module doc #11) -- real `onSaveEvent` wiring. Reloads this page's
  // own data via `onReload()` on success (a full reload, not a client-side
  // merge -- module doc #11).
  async function handleSaveEventSubmit(
    payload: Parameters<OnSaveOutreachEventFn>[0],
  ): Promise<void> {
    await onSaveEvent(payload);
    try {
      await onReload();
      setFeedback({
        status: 'success',
        title: 'Outreach event created',
        description: `"${payload.event.title}" was created with ${payload.sessions.length} session${payload.sessions.length === 1 ? '' : 's'}.`,
      });
    } catch {
      // The create itself already succeeded (this catch only guards the
      // follow-up reload) -- disclosed, not fatal, same posture
      // `MeetingsList.tsx`'s own T096 `handleCreateMeetingsSubmit` already
      // established.
      setFeedback({
        status: 'success',
        title: 'Outreach event created',
        description: `"${payload.event.title}" was created. Refresh the page to see it in the list below.`,
      });
    }
  }

  const hasAnyOutreach = sessions.length > 0;

  return (
    <>
      <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
        <VStack gap={1}>
          <Heading level={1}>Outreach</Heading>
          <Badge variant="neutral" label={`${unansweredCount} pending RSVPs`} />
        </VStack>
        <Button label="New outreach event" variant="primary" onClick={openEventDialog} />
      </HStack>

      {feedback !== null && (
        <Banner
          status={feedback.status}
          title={feedback.title}
          description={feedback.description}
          isDismissable
          onDismiss={() => setFeedback(null)}
        />
      )}

      {!hasAnyOutreach ? (
        <EmptyState
          headingLevel={2}
          title="No outreach events yet"
          description="Outreach events for this season will show up here once they're scheduled."
          actions={
            <Button label="New outreach event" variant="primary" onClick={openEventDialog} />
          }
        />
      ) : (
        <>
          <GoalProgressBar
            goalBarId="team"
            seasonId={seasonId}
            label="Team season goal"
            confirmedHours={teamHours.confirmedHours}
            plannedHours={teamHours.plannedHours}
            goalHours={teamGoalHours}
          />
          <CoachOutreachSection
            title="Upcoming"
            enrichedSessions={upcoming}
            rsvps={rsvps}
            students={students}
            emptyDescription="No outreach events are currently scheduled."
          />
          <CoachOutreachSection
            title="Past"
            enrichedSessions={past}
            rsvps={rsvps}
            students={students}
            emptyDescription="Completed and canceled outreach events will show up here."
          />
        </>
      )}

      {/* T101 (module doc #11) -- `OutreachEventDialog.tsx` (T039, already
          Passed, already built) wired into this page for the first time, in
          CREATE mode only (no `initialEvent` prop). `teams` deliberately
          NOT overridden -- module doc #11. */}
      <OutreachEventDialog
        isOpen={isEventDialogOpen}
        onOpenChange={setIsEventDialogOpen}
        onSaveEvent={handleSaveEventSubmit}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Student/parent view -- module docs #3/#5/#7/#8b/#9.
// ---------------------------------------------------------------------------

const RSVP_ITEMS: readonly { value: RsvpStatus; label: string }[] = [
  { value: 'going', label: 'Going' },
  { value: 'maybe', label: 'Maybe' },
  { value: 'declined', label: "Can't go" },
];

/** Not a real RSVP status -- never matches an actual `SegmentedControlItem`
 * value, so passing it as `value` leaves the control visually unselected,
 * which is the correct representation of "no RSVP row exists yet". */
const UNANSWERED_RSVP_SEGMENT_VALUE = 'unanswered';

function rsvpStatusLabel(status: RsvpStatus): string {
  return RSVP_ITEMS.find((item) => item.value === status)?.label ?? status;
}

function StudentOutreachRowItem({
  session,
  event,
  status,
  onRsvpChange,
}: {
  session: OutreachSessionRow;
  event: OutreachEventRow;
  status: RsvpStatus | null;
  onRsvpChange: (sessionId: string, status: RsvpStatus) => void;
}): ReactNode {
  const isEditable = session.status === 'scheduled';

  const description = (
    <Text type="supporting">
      {formatSessionDateTime(session)} — {event.locationName}
    </Text>
  );

  // T112 HOTFIX (module doc #13): every row -- editable (Upcoming) AND
  // read-only (Past) alike -- now always carries a real "View details"
  // `Link` to this event's own `/outreach/:eventId` detail page too, same
  // shape as the coach view's own row above and `CalendarPage.tsx`'s
  // precedent. The RSVP `SegmentedControl`/read-only status `Text` is
  // unchanged; the `Link` is simply added alongside it.
  const endContent = (
    <HStack gap={2} vAlign="center">
      {isEditable ? (
        <SegmentedControl
          value={status ?? UNANSWERED_RSVP_SEGMENT_VALUE}
          onChange={(value) => onRsvpChange(session.id, value as RsvpStatus)}
          label={`Your RSVP for ${event.title} on ${formatSessionDateOnly(session)}`}
        >
          {RSVP_ITEMS.map((item) => (
            <SegmentedControlItem key={item.value} value={item.value} label={item.label} />
          ))}
        </SegmentedControl>
      ) : (
        <Text type="supporting" color="secondary">
          {status === null ? 'No response recorded' : `You RSVP'd: ${rsvpStatusLabel(status)}`}
        </Text>
      )}
      <Link as={RouterLink} href={routePaths.outreachEvent(event.id)} isStandalone>
        View details – {event.title}
      </Link>
    </HStack>
  );

  return <ListItem label={event.title} description={description} endContent={endContent} />;
}

function StudentOutreachSection({
  title,
  enrichedSessions,
  viewerStudentId,
  rsvps,
  onRsvpChange,
  emptyDescription,
}: {
  title: string;
  enrichedSessions: readonly EnrichedOutreachSession[];
  viewerStudentId: string;
  rsvps: readonly RsvpRow[];
  onRsvpChange: (sessionId: string, status: RsvpStatus) => void;
  emptyDescription: string;
}): ReactNode {
  return (
    <VStack gap={3}>
      <Heading level={2}>{title}</Heading>
      {enrichedSessions.length === 0 ? (
        <EmptyState
          headingLevel={3}
          title={`No ${title.toLowerCase()} outreach events`}
          description={emptyDescription}
        />
      ) : (
        <List hasDividers header={`${title} outreach events`}>
          {enrichedSessions.map(({ session, event }) => (
            <StudentOutreachRowItem
              key={session.id}
              session={session}
              event={event}
              status={
                rsvps.find(
                  (rsvp) => rsvp.sessionId === session.id && rsvp.studentId === viewerStudentId,
                )?.status ?? null
              }
              onRsvpChange={onRsvpChange}
            />
          ))}
        </List>
      )}
    </VStack>
  );
}

interface StudentParentOutreachViewProps {
  seasonId: string;
  viewerStudentId: string;
  events: readonly OutreachEventRow[];
  sessions: readonly OutreachSessionRow[];
  initialRsvps: readonly RsvpRow[];
  goalConfig: OutreachGoalConfig;
}

function StudentParentOutreachView({
  seasonId,
  viewerStudentId,
  events,
  sessions,
  initialRsvps,
  goalConfig,
}: StudentParentOutreachViewProps): ReactNode {
  const [rsvps, setRsvps] = useState<readonly RsvpRow[]>(initialRsvps);

  useEffect(() => {
    setRsvps(initialRsvps);
  }, [initialRsvps]);

  const { upcoming, past } = useMemo(() => buildUpcomingPast(sessions, events), [sessions, events]);
  const myHours = useMemo(
    () => computeStudentHours(viewerStudentId, sessions, rsvps),
    [viewerStudentId, sessions, rsvps],
  );
  const myGoalHours = goalConfig.individualGoalHoursByStudentId[viewerStudentId] ?? 0;
  const unansweredCount = useMemo(
    () => getUnansweredRsvpCount(sessions, rsvps, [viewerStudentId]),
    [sessions, rsvps, viewerStudentId],
  );

  function handleRsvpChange(sessionId: string, status: RsvpStatus): void {
    // Module doc #8b: local-only. No Supabase write happens here -- the
    // real persisted, validated RSVP flow is RsvpControl.tsx/ParentRsvp.tsx
    // (T040/T042, Forbidden Files, currently Blocked).
    setRsvps((prev) => withRsvpOverride(prev, viewerStudentId, sessionId, status));
  }

  const hasAnyOutreach = sessions.length > 0;

  return (
    <>
      <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
        <Heading level={1}>Outreach</Heading>
        <Badge variant="neutral" label={`${unansweredCount} awaiting your RSVP`} />
      </HStack>

      {!hasAnyOutreach ? (
        <EmptyState
          headingLevel={2}
          // DES-15 verbatim (PRD line 213): "No upcoming outreach yet. When
          // your coach posts an event, you can sign up here." -- title
          // carries the first sentence, description the second;
          // concatenated they reproduce the PRD text exactly. (This is the
          // student/parent-view empty state specifically; the coach view's
          // own empty state above is a distinct, non-DES-15-named copy.)
          title="No upcoming outreach yet."
          description="When your coach posts an event, you can sign up here."
        />
      ) : (
        <>
          <GoalProgressBar
            goalBarId={viewerStudentId}
            seasonId={seasonId}
            label="Your season goal"
            confirmedHours={myHours.confirmedHours}
            plannedHours={myHours.plannedHours}
            goalHours={myGoalHours}
          />
          <StudentOutreachSection
            title="Upcoming"
            enrichedSessions={upcoming}
            viewerStudentId={viewerStudentId}
            rsvps={rsvps}
            onRsvpChange={handleRsvpChange}
            emptyDescription="You have no upcoming outreach events."
          />
          <StudentOutreachSection
            title="Past"
            enrichedSessions={past}
            viewerStudentId={viewerStudentId}
            rsvps={rsvps}
            onRsvpChange={handleRsvpChange}
            emptyDescription="Your past outreach participation will show up here."
          />
        </>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Real-active-season state block -- module doc #12 (T106 hotfix). A direct
// structural port of `ReportsShell.tsx`'s own `ReportsSeasonState`: the one
// state block rendered in place of the coach/student view for every case
// where `resolvedSeasonId` is `null` (no explicit prop AND `useActiveSeason()`
// is not `'ready'`). `state.status === 'ready'` never reaches this component
// (the caller only renders it for the other three statuses) -- the
// exhaustive `switch` below still covers it defensively (renders nothing)
// rather than asserting it can't happen, so a future caller mistake fails
// safe instead of crashing.
// ---------------------------------------------------------------------------

function OutreachSeasonState({ state }: { state: ReturnType<typeof useActiveSeason> }): ReactNode {
  switch (state.status) {
    case 'loading':
      return (
        <VStack gap={3} aria-busy="true">
          <VisuallyHidden as="div" role="status">
            Loading the active season…
          </VisuallyHidden>
          <Skeleton width={240} height={28} />
          <Skeleton width={400} height={16} index={1} />
        </VStack>
      );
    case 'none':
      return (
        <EmptyState
          headingLevel={1}
          title="No active season yet"
          description="An admin needs to create and activate a season in Season settings before outreach events can be scoped to it."
        />
      );
    case 'error':
      return (
        <Banner
          status="error"
          title="Couldn't load the active season"
          description={state.error.message}
          endContent={<Button variant="ghost" label="Retry" onClick={state.refresh} />}
        />
      );
    case 'ready':
      return null;
  }
}

// ---------------------------------------------------------------------------
// Real-data-loaded body -- module docs #6/#7/#9/#11, T106 UPDATE (module doc
// #12): split out of `OutreachList` itself so this component (and its own
// `useLoadState`/`overrideData` hooks) only ever mounts once a real,
// resolved, non-placeholder `seasonId` is known -- `OutreachList` never
// renders this component while `resolvedSeasonId` is `null`, so `loadData`
// can never be called with a null/placeholder id.
// ---------------------------------------------------------------------------

interface OutreachListLoadedProps {
  loadData: LoadOutreachDataFn;
  /** Always a real, resolved season id -- module doc #12. Never the
   * placeholder/null case; `OutreachList` only mounts this component once
   * `resolvedSeasonId !== null`. */
  seasonId: string;
  viewerStudentId: string;
  onSaveEvent: OnSaveOutreachEventFn;
  isCoachOrAdminView: boolean;
}

function OutreachListLoaded({
  loadData,
  seasonId,
  viewerStudentId,
  onSaveEvent,
  isCoachOrAdminView,
}: OutreachListLoadedProps): ReactNode {
  const loadState = useLoadState(() => loadData(seasonId), [loadData, seasonId]);
  // T101 (module doc #11) -- lets the coach view reload this page's own
  // already-successfully-loaded data in place (after creating an event)
  // without re-triggering the top-level `loading` DES-12 state.
  const [overrideData, setOverrideData] = useState<OutreachLoadResult | null>(null);

  useEffect(() => {
    if (loadState.status === 'success') {
      setOverrideData(loadState.data);
    }
  }, [loadState]);

  // T106 UPDATE (module doc #12) -- closes over this component's own
  // `seasonId` prop, which is ALWAYS the same real, resolved id the initial
  // load used (never the raw caller-supplied prop or the placeholder), so a
  // coach creating an event reloads against that same real season.
  async function reloadOutreachData(): Promise<void> {
    const fresh = await loadData(seasonId);
    setOverrideData(fresh);
  }

  if (loadState.status === 'loading') {
    return (
      <VStack gap={6} padding={6} aria-busy="true">
        <VisuallyHidden as="div" role="status">
          Loading outreach events…
        </VisuallyHidden>
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
          <Skeleton width={140} height={28} index={0} />
          <Skeleton width={110} height={22} radius="rounded" index={1} />
        </HStack>
        <Skeleton width="100%" height={16} index={2} />
        <VStack gap={3}>
          <Skeleton width={100} height={20} index={3} />
          <VStack gap={2}>
            {[0, 1, 2].map((row) => (
              <HStack key={row} gap={4} vAlign="center">
                <Skeleton width={220} height={16} index={row * 2 + 4} />
                <Skeleton width={80} height={16} index={row * 2 + 5} />
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
          title="Couldn't load outreach events"
          description="Something went wrong loading this season's outreach events. Try refreshing the page."
          endContent={<Button variant="ghost" label="Retry" onClick={loadState.retry} />}
        />
      </VStack>
    );
  }

  // T101 (module doc #11) -- `overrideData` (kept in sync with every
  // successful `loadState` via the effect above) is preferred when present,
  // so a post-create reload (`reloadOutreachData`) is reflected immediately;
  // it is always populated by the time this line is reached (the effect
  // runs before this render's return commits) but falls back to
  // `loadState.data` defensively for the very first successful render.
  const data = overrideData ?? loadState.data;

  // Module doc #2 -- the only place events are filtered by type; every
  // session below is reached exclusively through an outreach event id.
  const outreachEvents = filterOutreachEvents(data.events);
  const outreachEventIds = new Set(outreachEvents.map((event) => event.id));
  const outreachSessions = data.sessions.filter((session) => outreachEventIds.has(session.eventId));

  return (
    <VStack gap={6} padding={6}>
      {isCoachOrAdminView ? (
        <CoachOutreachView
          seasonId={seasonId}
          events={outreachEvents}
          sessions={outreachSessions}
          rsvps={data.rsvps}
          students={data.students}
          goalConfig={data.goalConfig}
          onSaveEvent={onSaveEvent}
          onReload={reloadOutreachData}
        />
      ) : (
        <StudentParentOutreachView
          seasonId={seasonId}
          viewerStudentId={viewerStudentId}
          events={outreachEvents}
          sessions={outreachSessions}
          initialRsvps={data.rsvps}
          goalConfig={data.goalConfig}
        />
      )}
    </VStack>
  );
}

// ---------------------------------------------------------------------------
// Top-level component -- module docs #6/#7/#9/#12.
// ---------------------------------------------------------------------------

export interface OutreachListProps {
  /** Injectable data-loading seam (Known Context/Traps #1). T101: defaults
   * to a real query (`loadOutreachData`, `../../lib/supabase/loaders/
   * outreach.ts`); `defaultLoadOutreachData` (fixture) remains exported for
   * callers/tests that want to inject it explicitly. */
  loadData?: LoadOutreachDataFn;
  /**
   * T106 UPDATE (module doc #12): overridable for tests/an explicit caller --
   * same precedent `ReportsShell.tsx`'s own `seasonId` prop already
   * established. When omitted (`undefined`, the default -- no longer a
   * hardcoded placeholder), this component sources the value from
   * `useActiveSeason()` instead.
   */
  seasonId?: string;
  /** Which student the student/parent view is currently scoped to (module
   * doc #7). */
  viewerStudentId?: string;
  /** T101 (module doc #11). Defaults to a real `events`/`event_sessions`
   * insert, passed straight through to `<OutreachEventDialog
   * onSaveEvent={...} />` in the coach view. */
  onSaveEvent?: OnSaveOutreachEventFn;
}

export function OutreachList({
  loadData = loadOutreachData,
  seasonId: seasonIdProp,
  viewerStudentId = PLACEHOLDER_CURRENT_STUDENT_ID,
  onSaveEvent = saveOutreachEvent,
}: OutreachListProps = {}): ReactNode {
  const { user } = useAuth();
  // T106 UPDATE (module doc #12): called unconditionally (React's
  // rules-of-hooks), even when `seasonIdProp` is supplied and will end up
  // overriding this hook's own value -- same posture `ReportsShell.tsx`
  // already established.
  const activeSeason = useActiveSeason();

  if (user === null) {
    return (
      <VStack gap={4} padding={6}>
        <EmptyState
          headingLevel={1}
          title="Sign in to view outreach"
          description="You need to be signed in to see this page."
        />
      </VStack>
    );
  }

  // Module doc #12's override precedence: the explicit prop wins outright
  // when supplied; only falls back to the hook when it was not -- the same
  // precedent `ReportsShell.tsx`'s own module doc #2 established. Never call
  // the real `loadData` with a `null` or placeholder id.
  const resolvedSeasonId =
    seasonIdProp ?? (activeSeason.status === 'ready' ? activeSeason.season.id : null);

  if (resolvedSeasonId === null) {
    return (
      <VStack gap={4} padding={6}>
        <OutreachSeasonState state={activeSeason} />
      </VStack>
    );
  }

  // Module doc #6 -- only the two role literals present in guards.tsx's
  // stale `Role` union are compared directly; everything else (including a
  // real 'student'/'parent' value) falls through to the student/parent view.
  const isCoachOrAdminView = user.role === 'coach' || user.role === 'admin';

  return (
    <OutreachListLoaded
      loadData={loadData}
      seasonId={resolvedSeasonId}
      viewerStudentId={viewerStudentId}
      onSaveEvent={onSaveEvent}
      isCoachOrAdminView={isCoachOrAdminView}
    />
  );
}

export default OutreachList;
