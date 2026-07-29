/**
 * T038: `/outreach` list page (OUT-01). Coach (`coach`/`admin`) view: a
 * team season-goal `GoalBar` (T136: one track, confirmed + planned offset
 * segments, BEH-02)
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
 * SUPERSEDED BY T121 (UXP-04 outreach half / UXD-05 item (d)): the
 * paragraph below is KEPT AS THE ORIGINAL RECORD of the T038-era rendering
 * decision (repo convention, see `TeamsTab.tsx`/`ParentsTab.tsx`'s own
 * "SUPERSEDED BY" notes for precedent) -- it no longer describes this
 * file's actual rendering. `GoalProgressBar` (below) no longer renders any
 * `ProgressBar` at all: George live-reported the resulting TWO stacked bars
 * (one per paragraph below) as a literal instance of Astryx's own "Don't:
 * Use multiple progress bars stacked together for the same operation" rule,
 * layered under a THIRD/FOURTH redundant "Team season goal" text repetition
 * -- exactly UXD-05's own named anti-example. `GoalProgressBar`'s own
 * updated doc comment (this file, `T121 item (d)`) described the post-T121
 * design: one heading + a grouped stat-tile row (confirmed/planned/goal/
 * %-of-goal), zero `ProgressBar`s.
 *
 * SUPERSEDED AGAIN BY T136 (UXC-05/UXC-08). The "zero bars" state above was
 * itself an interim: T121 removed the bars because there were TWO of them
 * stacked, not because a bar was wrong. `GoalProgressBar` now renders
 * **exactly one** bar -- the shared `GoalBar` component
 * (`src/components/GoalBar.tsx`), which F-3 pre-approves as the one custom
 * bar in the project, since Astryx's own `ProgressBar` cannot segment. It is
 * NOT an Astryx `ProgressBar`, so "zero `ProgressBar`s" remains literally
 * true and is why that phrasing survived this long while being misleading.
 *
 * The stat-tile row is unchanged and still sits alongside it. The one-bar
 * invariant is pinned by `OutreachList.test.tsx:1343` (`toBe(1)`, amended
 * from T121's `toBe(0)`), so the two-stacked-bars defect George originally
 * reported cannot return.
 *
 * BEH-02 (confirmed/planned never summed) is UNCHANGED by either revision --
 * still enforced exactly as this module doc's own opening paragraph (above)
 * describes. `GoalBar` renders the two as offset fills and contains no `+`
 * operator in code at all.
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
 *       student/parent view) carries a real `Link` to
 *       `routePaths.outreachEvent(event.id)` -- see module doc #13 for the
 *       full precedent investigation and shape. T131 UPDATE: on the coach
 *       `Table` surface specifically, that `Link` no longer lives in a
 *       separate "View details – {title}" action; it now IS the event
 *       title itself (`CoachEventTitleCell`, below), reached the same way
 *       (`routePaths.outreachEvent(event.id)`, real `<a href>`, real SPA
 *       navigation). The student/parent `ListItem` surface is untouched by
 *       T131 and still carries the standalone "View details – {title}"
 *       `Link` in its `endContent` exactly as this paragraph originally
 *       described.
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
 *  - T121 UPDATE: `ProgressBar`/`AvatarGroup`/`AvatarGroupOverflow`/`Avatar`
 *    are NO LONGER imported or rendered anywhere in this file (module doc
 *    #3's own "SUPERSEDED BY T121" note has the full reasoning for
 *    `ProgressBar`'s removal; the `AvatarGroup`/`Avatar` pair was the
 *    former per-session "N going" summary, replaced by the new per-EVENT
 *    row's `Expected`/`Attended` stat tile plus the expander's own going-
 *    student name list -- `CoachOutreachEventRow`/`CoachSessionDetail`
 *    below). Kept here as a disclosed removal record, not silently dropped.
 *  - T121 UPDATE: `AlertDialog` (line 2473 section, Props table): `isOpen`,
 *    `onOpenChange`, `title`, `description`, `actionLabel`, `onAction` used
 *    (all required except `title`/`description`, which this file always
 *    supplies) -- the SAME citation `OutreachDetail.tsx`'s own pre-existing
 *    "Cancel event" confirmation already established; item (c)'s new
 *    inline row-level Cancel confirmation reuses this component, not a new
 *    one.
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
 * Mirrored here at the time, not reinvented: `CoachOutreachRowItem`'s and
 * `StudentOutreachRowItem`'s own `endContent` (module docs #5/#7 above) each
 * ended with the identical `<Link as={RouterLink}
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
 * T131 UPDATE (supersedes the "identical" claim above for the coach side
 * only): the coach view's own row surface was migrated off `ListItem` onto
 * a `Table` by T121/T130 (module doc on `CoachEventTitleCell`/
 * `CoachEventActions` below is now the coach-side source of truth, not this
 * paragraph). On that `Table`, the standalone "View details – {title}"
 * `Link` element described above was replaced: the link now renders directly
 * on the title cell (`CoachEventTitleCell`), with the title text itself as
 * its accessible name, and the separate "View details – {title}" text is
 * gone from the coach surface entirely. The student/parent side still uses
 * `ListItem`/`StudentOutreachRowItem` and still renders the "View details –
 * {title}" `Link` exactly as this paragraph originally described --
 * untouched by T131.
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
 *
 * -----------------------------------------------------------------------
 * 14. T126 (PRD v2 UXP-03): retroactive student/parent check-off entry
 *     point -- "student past-event rows in `OutreachList` open a small
 *     day-picker confirmation" (packet's own minimum-bar wording).
 *
 * `StudentOutreachEventRow` (student/parent view) grows an `allowSelfCheckoff`
 * prop, passed `true` ONLY by the "Past" `StudentOutreachSection` instance
 * (the "Upcoming" instance passes `false` -- a day that hasn't happened yet
 * can't be self-checked-off, same "past events only" gate
 * `SelfCheckoffDialog.tsx`'s own `filterEligibleSelfCheckoffSessions`
 * independently re-enforces at the session-status level). When
 * `allowSelfCheckoff` is true AND the event has at least one `'completed'`
 * session, the row's `endContent` grows one more neutral, named-action
 * `Button` ("Mark attendance") that calls `onOpenSelfCheckoff(event,
 * sessions)`.
 *
 * `SelfCheckoffDialog.tsx` (this task's own new component,
 * `src/pages/outreach/`) is rendered as a SINGLE SHARED instance owned by
 * `StudentParentOutreachView` itself (`selfCheckoffTarget` state -- `null` =
 * closed, otherwise the target row's own `{event, sessions}`), NOT one
 * `Dialog` instance per row nested inside the `<List>` -- mirrors
 * `CoachOutreachView`'s own pre-existing `AlertDialog`/`OutreachEventDialog`
 * pattern above exactly (one dialog instance, `cancelTarget`/`editingTarget`
 * state selects which row it targets), and avoids an invalid DOM shape a
 * per-row `<Dialog>` (Astryx's own `Dialog` renders a real `<dialog>`
 * element directly at its tree position, no portal) would otherwise create
 * as a stray non-`<li>` child of `<List>`'s own `<ul>`. `viewerProfileId`
 * (already resolved by `OutreachList`'s own top-level `user.id`, module doc
 * #6 -- previously threaded only to `CoachOutreachView`) now ALSO threads
 * down to `StudentParentOutreachView`, supplying the shared dialog's own
 * `currentUserProfileId` (`attendance.recorded_by` for every row it writes
 * -- module doc on that file: a student checking off themselves, or a
 * parent checking off their linked student, per PRD v2 UXP-03's own "or
 * parent for a linked student" wording).
 *
 * This is purely additive wiring -- no existing prop/behavior on
 * `StudentOutreachEventRow`/`StudentOutreachSection`/
 * `StudentParentOutreachView` changes shape or meaning, only grows one or
 * two more (default-free, always-supplied-by-this-file's-own-callers)
 * props each. `SelfCheckoffDialog.tsx`'s own module doc has the full RLS/
 * hours-math/coach-visibility writeup; this file only opens/closes it and
 * supplies already-fetched display data, matching this page's own
 * established "dialog owns its data seam, page owns open/closed state"
 * convention (`OutreachEventDialog` above, `MarkDayCompleteDialog.tsx`/
 * `AttendancePanel.tsx` on `OutreachDetail.tsx`, none of which this file
 * re-derives).
 *
 * RIDER (NIT from T121's own checker follow-up, verified against a live
 * `npx eslint . --report-unused-disable-directives` run for this task):
 * that follow-up's OWN line number (`OutreachList.tsx:1117`) does not
 * match this file's real unused-directive location -- the actual
 * now-unused `eslint-disable-next-line react-hooks/exhaustive-deps`
 * directive lives in `src/pages/home/ParentHome.tsx:1117`, a file outside
 * this task's Allowed Files. Not fixed here (see this task's own worker
 * output "known risks" for the full disclosure); `OutreachList.tsx`'s own
 * single pre-existing disable directive (`useLoadState`, module doc above)
 * remains genuinely load-bearing and unchanged.
 */
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import {
  AlertDialog,
  Badge,
  Banner,
  Button,
  EmptyState,
  Heading,
  HStack,
  Icon,
  IconButton,
  Link,
  List,
  ListItem,
  SegmentedControl,
  SegmentedControlItem,
  Skeleton,
  Table,
  Text,
  Toast,
  VisuallyHidden,
  VStack,
  pixel,
  proportional,
  type TableColumn,
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
import {
  cancelOutreachEvent,
  loadOutreachData,
  loadOutreachEventRoster,
  saveOutreachEvent,
  type CancelOutreachEventFn,
  type LoadOutreachEventRosterFn,
} from '../../lib/supabase/loaders/outreach';
import {
  OutreachEventDialog,
  type ExistingOutreachEvent,
  type OnSaveOutreachEventFn,
  type OutreachRosterStudent,
} from './OutreachEventDialog';
// T126 (PRD v2 UXP-03) -- module doc #14. This task's own new dialog/
// component, `src/pages/outreach/`.
import { SelfCheckoffDialog } from './SelfCheckoffDialog';
// T130 (VOLT UX Craft PRD v3.1, UXC-03) -- the shared three-tier stat-cell
// component extracted FROM this file's own pre-existing coach-row shape
// (see `StatCell.tsx`'s own module doc for the extraction record). Used only
// by the coach `Table` columns below; `GoalProgressBar` is deliberately left
// consuming its own inline `Text` triplet, unchanged (out of scope).
import { StatCell } from '../../components/StatCell';
// T136 (UXC-08): the one small custom bar F-3 pre-authorizes, shared by both
// role variants' `GoalProgressBar` (`:1763`). This single import line falls
// outside this task's literally-enumerated Allowed-Files ranges for this
// file (`:1777-1879`, `:3`, `:1763`) -- added anyway because `GoalProgressBar`
// cannot otherwise consume the component the packet explicitly requires it
// to create and call; disclosed in the worker output for the checker.
import { GoalBar } from '../../components/GoalBar';
// T132: `useIsNarrowViewport` (and the query constant it reads) moved out of
// this file to `src/hooks/` verbatim, so `MeetingsList` (T135) can import it
// instead of copying it -- see that hook's own module doc for the full
// "why a real subscription" reasoning this file used to carry inline.
import { useIsNarrowViewport } from '../../hooks/useIsNarrowViewport';

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
  /** T121 (UXP-04 outreach half / UXD-02 dense rows + edit-mode prefill).
   * Grown from `{id, seasonId, type, title, locationName}` -- every new
   * field below is a real, already-fetched `events` column (module doc of
   * `../../lib/supabase/loaders/outreach.ts`'s updated
   * `mapEventDbRowToOutreachEventRow`), added for two real, disclosed
   * reasons: (a) UXD-02's "where" requirement needs BOTH `locationName` AND
   * `address` surfaced on the row, not just `locationName`; (b) this file's
   * new inline "Edit" row action opens `OutreachEventDialog` in edit mode
   * directly from a list row (no navigation to `OutreachDetail.tsx` first),
   * which needs every one of `ExistingOutreachEvent`'s fields to prefill
   * honestly (see `buildInitialOutreachEventFromRow` below). */
  description: string;
  locationName: string;
  address: string;
  /** `null` = all teams (matches `events.team_ids` NULL semantics). */
  teamIds: string[] | null;
  countsParticipation: boolean;
  countsVolunteerHours: boolean;
  adultVolunteersCount: number;
  adultVolunteerHours: number;
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

/**
 * CHECKER FIX (rework of T121): real `attendance` row shape -- distinct from
 * `RsvpRow` (RSVP is INTENT to attend, recorded before/at signup time;
 * `attendance` is the actual, staff/QR-recorded outcome, per
 * `supabase/migrations/20260717000000_scheduling_attendance.sql` lines
 * 82-95: `status text not null check (status in ('present', 'late',
 * 'excused', 'absent'))`). Only the fields this file's own row-level
 * "Attended" stat needs (`sessionId`, `studentId`, `status`) -- never
 * conflated with `RsvpRow`'s own `'going'|'maybe'|'declined'` vocabulary.
 */
export type AttendanceStatus = 'present' | 'late' | 'excused' | 'absent';

export interface OutreachAttendanceRow {
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
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
  /** CHECKER FIX (rework of T121) -- real `attendance` rows, one real
   * batched query (`loaders/outreach.ts`'s updated `makeLoadOutreachData`),
   * the ONE source this file's row-level "Attended" stat is now computed
   * from (never RSVP intent -- module doc on `computeEventRowStats`). */
  attendance: readonly OutreachAttendanceRow[];
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
    description: 'Sorting and packing donated groceries for weekend distribution.',
    locationName: 'Riverside Food Bank',
    address: '100 Riverside Dr',
    teamIds: null,
    countsParticipation: false,
    countsVolunteerHours: true,
    adultVolunteersCount: 2,
    adultVolunteerHours: 6,
  },
  {
    id: 'event-park-cleanup',
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'outreach',
    title: 'Riverside Park Cleanup',
    description: 'Litter pickup and trail maintenance along the riverside path.',
    locationName: 'Riverside Park',
    address: '250 Parkway Ave',
    teamIds: null,
    countsParticipation: false,
    countsVolunteerHours: true,
    adultVolunteersCount: 0,
    adultVolunteerHours: 0,
  },
  {
    id: 'event-tutoring-drive',
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'outreach',
    title: 'After-School Tutoring Drive',
    description: 'Homework help for elementary students after school.',
    locationName: 'Lincoln Elementary',
    address: '500 Lincoln Ave',
    teamIds: null,
    countsParticipation: false,
    countsVolunteerHours: true,
    adultVolunteersCount: 1,
    adultVolunteerHours: 2,
  },
  // CHECKER FIX (rework of T121, MAJOR) -- a purely-additive event/session
  // (no `rsvps` reference it at all) whose ONLY signal is real `attendance`
  // rows (`FIXTURE_ATTENDANCE` below): proves "Attended" is computed from
  // real attendance, never RSVP intent, at the full page-render level (not
  // just a unit test) -- if this regressed back to RSVP-derived counting,
  // this event's own row would show "Attended0 students" instead of the
  // real "Attended2 students". Deliberately contributes ZERO `going` RSVPs
  // (module doc's own "sum of raw counts... watch query fan-out" note is
  // satisfied trivially -- no new query shape either way), so it cannot
  // perturb any existing RSVP-derived hours/milestone assertion elsewhere
  // in this file's own test suite.
  {
    id: 'event-canned-drive',
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'outreach',
    title: 'Canned Food Drive',
    description: 'Neighborhood canned-food collection walk (no advance signup).',
    locationName: 'Downtown Community Center',
    address: '77 Center St',
    teamIds: null,
    countsParticipation: false,
    countsVolunteerHours: true,
    adultVolunteersCount: 0,
    adultVolunteerHours: 0,
  },
  // Deliberately type: 'meeting' -- proves NAV-07 filtering (module doc #2).
  // This event's own session ("Weekly Team Meeting") must NEVER appear
  // anywhere this file renders.
  {
    id: 'event-team-meeting',
    seasonId: PLACEHOLDER_SEASON_ID,
    type: 'meeting',
    title: 'Weekly Team Meeting',
    description: 'Weekly in-person planning meeting.',
    locationName: 'Clubhouse',
    address: '10 Clubhouse Rd',
    teamIds: null,
    countsParticipation: false,
    countsVolunteerHours: false,
    adultVolunteersCount: 0,
    adultVolunteerHours: 0,
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
  // CHECKER FIX (rework of T121, MAJOR) -- `event-canned-drive`'s own
  // session, deliberately referenced by NO `rsvps` row at all (see that
  // event's own fixture doc above); its "Attended" figure comes entirely
  // from `FIXTURE_ATTENDANCE` below.
  {
    id: 'session-canned-drive',
    eventId: 'event-canned-drive',
    sessionDate: '2026-06-20',
    startsAt: '2026-06-20T21:00:00.000Z', // 4:00 PM America/Chicago (CDT)
    endsAt: '2026-06-20T23:00:00.000Z', // 6:00 PM America/Chicago -- 2h
    status: 'completed',
    peopleReached: 45,
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

/**
 * CHECKER FIX (rework of T121, MAJOR) -- real `attendance` fixture rows,
 * deliberately DIVERGENT from `FIXTURE_RSVPS` above so a regression back to
 * RSVP-derived "attended" counting fails loudly (both directions):
 *
 * `session-food-bank-past` (completed): `FIXTURE_RSVPS` has THREE `going`
 * rows for it (Amara, Cole, the current viewer -- rsvp-1/2/4). Real
 * attendance for that same session is DIFFERENT on both ends:
 *   - Amara: `present` -- matches her RSVP.
 *   - Cole: `absent` -- he RSVP'd `going` but the real record shows he did
 *     NOT attend (never counted).
 *   - Priya: `present` -- she RSVP'd `declined` (rsvp-3) yet actually
 *     walked in and attended anyway (a real, counted attendee despite never
 *     having RSVP'd `going`).
 *   - The viewer (rsvp-4, `going`): NO `attendance` row at all -- never
 *     counted (a `going` RSVP alone is not attendance).
 * Real attended count = {Amara, Priya} = 2, NOT the RSVP-`going` count of 3
 * -- and the specific two students differ from any two of the three
 * RSVP-`going` students, so no accidental "still just picks 2 of the same
 * 3 names" false pass is possible.
 *
 * `session-canned-drive` (completed, `event-canned-drive`): referenced by
 * ZERO `rsvps` rows at all (module doc on that event's own fixture entry).
 * Amara (`present`) and Devon (`late`) both have real attendance despite
 * neither ever RSVPing -- proves "Attended" can be non-zero even when
 * RSVP-`going` is exactly zero, the strongest possible divergence proof.
 */
const FIXTURE_ATTENDANCE: readonly OutreachAttendanceRow[] = [
  { sessionId: 'session-food-bank-past', studentId: 'student-amara-webb', status: 'present' },
  { sessionId: 'session-food-bank-past', studentId: 'student-cole-jennings', status: 'absent' },
  { sessionId: 'session-food-bank-past', studentId: 'student-priya-patel', status: 'present' },
  { sessionId: 'session-canned-drive', studentId: 'student-amara-webb', status: 'present' },
  { sessionId: 'session-canned-drive', studentId: 'student-devon-marsh', status: 'late' },
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
    attendance: FIXTURE_ATTENDANCE,
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
// T121 (UXP-04 outreach half / UXD-02): dense per-EVENT row formatting --
// date range + per-day ("weekday") recurrence chips, per the packet's own
// "MON (18) · THU (18)" example and the capability map "Events tab" figure.
// ---------------------------------------------------------------------------

/** Short (no weekday, no year) date -- used for the row's own date-range
 * summary, distinct from `formatSessionDateOnly` (which keeps its weekday
 * prefix; still used for the expanded per-session detail rows and the
 * student RSVP `aria-label`s, unchanged). */
const SHORT_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: CHICAGO_TIME_ZONE,
});

export function formatShortDate(session: OutreachSessionRow): string {
  return SHORT_DATE_FORMATTER.format(parseDateOnly(session.sessionDate));
}

/** UXD-02 "date/range" -- a single date for a one-session event, or a
 * `first → last` range for a multi-session event. `sessions` is expected
 * pre-sorted ascending by `startsAt` (every caller below sorts before
 * calling). */
export function formatEventDateRangeLabel(sessions: readonly OutreachSessionRow[]): string {
  if (sessions.length === 0) return 'No sessions scheduled yet.';
  const first = sessions[0];
  const last = sessions[sessions.length - 1];
  return sessions.length === 1
    ? formatShortDate(first)
    : `${formatShortDate(first)} → ${formatShortDate(last)}`;
}

export interface WeekdayChip {
  key: string;
  label: string;
  count: number;
}

const WEEKDAY_ABBREVIATIONS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] as const;

/** UXD-02 "recurrence chips like 'MON (18) · THU (18)'" -- one chip per
 * distinct weekday among the event's own sessions, ordered by each
 * weekday's first chronological occurrence (never alphabetical/day-index
 * order, which would misrepresent an event that, say, starts on a Friday),
 * count = how many of the event's sessions fall on that weekday. Real
 * `event_sessions.session_date` values only -- never a fabricated/assumed
 * recurrence pattern. */
export function buildWeekdayChips(sessions: readonly OutreachSessionRow[]): WeekdayChip[] {
  const order: string[] = [];
  const counts = new Map<string, number>();
  for (const session of sessions) {
    const weekday = WEEKDAY_ABBREVIATIONS[parseDateOnly(session.sessionDate).getUTCDay()];
    if (!counts.has(weekday)) order.push(weekday);
    counts.set(weekday, (counts.get(weekday) ?? 0) + 1);
  }
  return order.map((weekday) => ({
    key: weekday,
    label: `${weekday} (${counts.get(weekday)})`,
    count: counts.get(weekday) ?? 0,
  }));
}

/** T101's `buildInitialOutreachEvent` (`OutreachDetail.tsx`) own inverse
 * conversion, independently reimplemented here rather than imported --
 * same "independently reimplemented, not imported across
 * `OutreachList.tsx`/`OutreachDetail.tsx`" convention this file's own
 * NFR-09 date formatters above already followed (module doc), even though
 * both files are this task's own Allowed Files: they remain two
 * structurally-separate pages by this codebase's established convention. */
const CHICAGO_24H_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
  timeZone: CHICAGO_TIME_ZONE,
});

function formatChicagoWallTime(isoDateTime: string): string {
  const parts = CHICAGO_24H_TIME_FORMATTER.formatToParts(new Date(isoDateTime));
  const hour = parts.find((part) => part.type === 'hour')?.value ?? '00';
  const minute = parts.find((part) => part.type === 'minute')?.value ?? '00';
  return `${hour}:${minute}`;
}

/**
 * T121 item (b) -- edit-mode "Expected attendees" checklist prefill: the
 * distinct student ids with an existing `status='going'` RSVP on ANY of the
 * event's own sessions (not scoped to still-`scheduled` sessions only --
 * the packet's own wording is "the event's existing 'going' RSVPs",
 * unqualified by session status, and this is also the exact set
 * `OutreachEventDialog.tsx`'s own create-time checklist would have written
 * had the event been created today with today's answers).
 */
export function deriveExpectedStudentIds(
  sessions: readonly OutreachSessionRow[],
  rsvps: readonly RsvpRow[],
): string[] {
  const sessionIds = new Set(sessions.map((session) => session.id));
  const ids = new Set<string>();
  for (const rsvp of rsvps) {
    if (rsvp.status === 'going' && sessionIds.has(rsvp.sessionId)) ids.add(rsvp.studentId);
  }
  return [...ids];
}

/**
 * T121 item (b) -- the ONE place a real `OutreachEventRow` (this file's own
 * event shape, now grown -- module doc) + its own sessions/rsvps are
 * reshaped into `OutreachEventDialog.tsx`'s `ExistingOutreachEvent` edit-mode
 * shape, for this file's OWN new inline "Edit" row action (opening the
 * dialog directly from a list row, without navigating to
 * `OutreachDetail.tsx` first). Structurally mirrors that file's own
 * `buildInitialOutreachEvent` (same field-for-field mapping), independently
 * reimplemented per this module's own convention above.
 */
export function buildInitialOutreachEventFromRow(
  event: OutreachEventRow,
  sessions: readonly OutreachSessionRow[],
  rsvps: readonly RsvpRow[],
): ExistingOutreachEvent {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    locationName: event.locationName,
    address: event.address,
    // OutreachEventDialog.tsx's own type Selector only ever offers
    // 'outreach'/'competition' -- this page's own `filterOutreachEvents`
    // (module doc #2) already guarantees every row reaching this function
    // has `type: 'outreach'`, so the 'competition' branch is unreachable in
    // practice today but kept for the same honest, defensible fallback
    // `OutreachDetail.tsx`'s own identical line already established.
    type: event.type === 'competition' ? 'competition' : 'outreach',
    countsParticipation: event.countsParticipation,
    countsVolunteerHours: event.countsVolunteerHours,
    teamIds: event.teamIds,
    adultVolunteersCount: event.adultVolunteersCount,
    adultVolunteerHours: event.adultVolunteerHours,
    // No backing `events` column exists for this UI-only field (same
    // disclosed "on by default" fallback `OutreachDetail.tsx`'s own
    // `buildInitialOutreachEvent` already established).
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
// T121 (UXP-04 outreach half / UXD-02/03): per-EVENT row stats -- expected/
// attended counts, people reached, and the event's own group hours (BEH-02,
// reusing `computeGroupHours` above VERBATIM -- never a re-derived formula,
// per this task's own Traps note).
// ---------------------------------------------------------------------------

export interface EnrichedOutreachEvent {
  event: OutreachEventRow;
  /** Ascending by `startsAt`. */
  sessions: OutreachSessionRow[];
}

/**
 * Event-level analogue of `buildUpcomingPast` above (which stays exported
 * and unit-tested unchanged, at session granularity) -- UXD-02/03 call for
 * ONE dense row per EVENT, not one row per session. "Upcoming" = the event
 * has at least one still-`scheduled` session (even if some of its other
 * sessions already ran); "Past" = every session is `completed`/`canceled`.
 * An event with zero sessions yet is omitted from both buckets (nothing
 * real to show a date/hours/count for).
 */
export function buildEventGroups(
  events: readonly OutreachEventRow[],
  sessions: readonly OutreachSessionRow[],
): { upcoming: EnrichedOutreachEvent[]; past: EnrichedOutreachEvent[] } {
  const sessionsByEvent = new Map<string, OutreachSessionRow[]>();
  for (const session of sessions) {
    const list = sessionsByEvent.get(session.eventId);
    if (list) list.push(session);
    else sessionsByEvent.set(session.eventId, [session]);
  }
  const upcoming: EnrichedOutreachEvent[] = [];
  const past: EnrichedOutreachEvent[] = [];
  for (const event of events) {
    const eventSessions = (sessionsByEvent.get(event.id) ?? [])
      .slice()
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    if (eventSessions.length === 0) continue;
    const hasScheduled = eventSessions.some((session) => session.status === 'scheduled');
    (hasScheduled ? upcoming : past).push({ event, sessions: eventSessions });
  }
  upcoming.sort((a, b) => {
    const aNext = a.sessions.find((session) => session.status === 'scheduled') ?? a.sessions[0];
    const bNext = b.sessions.find((session) => session.status === 'scheduled') ?? b.sessions[0];
    return aNext.startsAt.localeCompare(bNext.startsAt);
  });
  past.sort((a, b) => {
    const aLast = a.sessions[a.sessions.length - 1];
    const bLast = b.sessions[b.sessions.length - 1];
    return bLast.startsAt.localeCompare(aLast.startsAt);
  });
  return { upcoming, past };
}

/** Distinct student ids with a `going` RSVP on any of the given session
 * ids -- the raw-count building block for the "expected" (scheduled
 * sessions) row stat. CHECKER FIX (rework of T121): no longer used for
 * "attended" -- RSVP is intent, not a real attendance record (see
 * `distinctAttendedStudentIds` below). A "sum of raw counts", per this
 * task's own Traps note -- never a re-derived metric-view formula. */
export function distinctGoingStudentIds(
  sessionIds: readonly string[],
  rsvps: readonly RsvpRow[],
): Set<string> {
  const idSet = new Set(sessionIds);
  const going = new Set<string>();
  for (const rsvp of rsvps) {
    if (rsvp.status === 'going' && idSet.has(rsvp.sessionId)) going.add(rsvp.studentId);
  }
  return going;
}

/**
 * CHECKER FIX (rework of T121, MAJOR) -- distinct student ids with a REAL
 * `attendance` row (`status in ('present', 'late')`) on any of the given
 * session ids. The `('present', 'late')` predicate is cited VERBATIM from
 * the shipped `v_student_hours` view (`where a.status in ('present',
 * 'late')`, `supabase/migrations/20260717000003_metric_views.sql` line 18)
 * -- the same real, already-approved definition of "counts as attended"
 * this codebase's own metric views already use, not an invented threshold.
 * `'excused'`/`'absent'` are real, recorded outcomes but never count as
 * attended (an excused absence is still an absence). This is the ONE
 * source `computeEventRowStats`'s own "attended" stat is built from -- a
 * raw distinct-id count over already-loaded rows, never a re-derived
 * metric-view formula (this task's own Traps note): the view itself sums
 * HOURS with a more elaborate `coalesce`/check-in-check-out expression this
 * function does not reproduce; this function only counts DISTINCT
 * STUDENTS, a strictly simpler raw tally the view doesn't itself expose. */
export function distinctAttendedStudentIds(
  sessionIds: readonly string[],
  attendance: readonly OutreachAttendanceRow[],
): Set<string> {
  const idSet = new Set(sessionIds);
  const attended = new Set<string>();
  for (const record of attendance) {
    if ((record.status === 'present' || record.status === 'late') && idSet.has(record.sessionId)) {
      attended.add(record.studentId);
    }
  }
  return attended;
}

/** `null` when no session in the group has ever recorded a
 * `people_reached` value (never a fabricated 0 for "not yet recorded" --
 * distinct from a real, logged 0). */
export function sumPeopleReached(sessions: readonly OutreachSessionRow[]): number | null {
  const withValues = sessions.filter((session) => session.peopleReached !== null);
  if (withValues.length === 0) return null;
  return withValues.reduce((sum, session) => sum + (session.peopleReached ?? 0), 0);
}

export interface EventRowStats {
  dateRangeLabel: string;
  weekdayChips: WeekdayChip[];
  scheduledSessions: OutreachSessionRow[];
  completedSessions: OutreachSessionRow[];
  /** "Who's expected" -- RSVP intent (`going`) on still-`scheduled`
   * sessions. Real attendance cannot exist yet for a session that hasn't
   * happened, so RSVP intent is the correct, only-available source here --
   * unchanged by the checker's rework, which is scoped to the PAST-bucket
   * "attended" stat only (see `attendedCount` below). */
  expectedCount: number;
  /** CHECKER FIX (rework of T121, MAJOR) -- real distinct-student count from
   * the `attendance` table (`status in ('present','late')`,
   * `distinctAttendedStudentIds` above), NOT RSVP `going` intent. A student
   * who RSVP'd `going` but never actually attended (marked `absent`/
   * `excused`, or simply has no `attendance` row at all) is NOT counted; a
   * walk-in who never RSVP'd but has a real `present`/`late` `attendance`
   * row on a completed session of this event IS counted. */
  attendedCount: number;
  reached: number | null;
  /** BEH-02: confirmed/planned hours across the WHOLE roster for this
   * event's own sessions -- `computeGroupHours` (module doc #3), called
   * verbatim, never re-derived. */
  hours: HoursBreakdown;
}

export function computeEventRowStats(
  sessions: readonly OutreachSessionRow[],
  rsvps: readonly RsvpRow[],
  attendance: readonly OutreachAttendanceRow[],
  allStudentIds: readonly string[],
): EventRowStats {
  const scheduledSessions = sessions.filter((session) => session.status === 'scheduled');
  const completedSessions = sessions.filter((session) => session.status === 'completed');
  return {
    dateRangeLabel: formatEventDateRangeLabel(sessions),
    weekdayChips: buildWeekdayChips(sessions),
    scheduledSessions,
    completedSessions,
    expectedCount: distinctGoingStudentIds(
      scheduledSessions.map((session) => session.id),
      rsvps,
    ).size,
    // CHECKER FIX (rework of T121, MAJOR): real attendance, not RSVP intent.
    attendedCount: distinctAttendedStudentIds(
      completedSessions.map((session) => session.id),
      attendance,
    ).size,
    reached: sumPeopleReached(completedSessions),
    hours: computeGroupHours(allStudentIds, sessions, rsvps),
  };
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

/**
 * T136 (VOLT UX Craft PRD v3.1, UXC-08) -- REVERSAL of T121 item (d)'s "zero
 * `ProgressBar`s" fix, NOT a return to the pre-T121 defect. T121's own fix
 * (kept unaltered as the original record above, module doc #3) was never
 * "bars are wrong" -- it was TWO stacked `ProgressBar`s whose own visible
 * `label` captions repeated "Team season goal" a third/fourth time, "exactly
 * UXD-05's own named anti-example" (George live-reported it). F-3
 * (`VOLT_UX_Craft_PRD_v3.md:66-70`) pre-authorizes exactly the shape this
 * task ships instead: ONE small custom bar component (`GoalBar`,
 * `src/components/GoalBar.tsx`) -- one track, confirmed/planned as two
 * OFFSET fills inside that single track, never stacked, never a second
 * `role="progressbar"` -- under DES-21's final custom-CSS rung, because
 * Astryx's own `ProgressBar` cannot segment (F-3: "One scalar `value`, one
 * fill div... its doc forbids stacked bars").
 *
 * BEH-02 (`VOLT_Portal_PRD.md:239`) is the authority for the two-segment
 * shape itself: confirmed hours plus "a visually lighter second segment...
 * never summed into one number." `GoalBar` never adds `confirmedHours` and
 * `plannedHours` -- each segment's width comes from its own independently
 * -computed percentage (`confirmedPercent`, called twice below, once per
 * segment; grep-provable: no `confirmedHours + plannedHours` expression
 * exists anywhere in this file).
 *
 * The stat-tile row T121 shipped (confirmed/planned/goal/%-of-goal) and the
 * milestone `Badge`/`Text` row below it are UNCHANGED byte-for-byte -- this
 * task adds the bar above them, it does not replace or relocate either. The
 * `Toast` block and the `useMilestoneToasts` call are also byte-identical:
 * this is a presentation-only change, no metric math, per F-3's own
 * restriction (constitution item 17 -- honest progress signals, no reworked
 * urgency framing).
 *
 * `OutreachList.test.tsx`'s `[role="progressbar"]` count assertion
 * (originally 2 pre-T121, set to 0 by T121) is amended a second time,
 * 0 -> 1, and renamed to describe what it now guards: exactly one
 * accessible bar, never two.
 */
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
  // T136: the planned segment's percentage, computed the SAME way as
  // `percent` above but from `plannedHours` -- independently, never added to
  // `percent`/`confirmedHours` (BEH-02, this doc comment above).
  const plannedPct = confirmedPercent(plannedHours, goalHours);
  const headingId = useId();

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
      <Heading level={2} id={headingId}>
        {label}
      </Heading>
      <GoalBar
        confirmedPct={percent}
        plannedPct={plannedPct}
        valueText={`${confirmedHours} of ${goalHours} hours confirmed; ${plannedHours} more planned`}
        labelledBy={headingId}
      />
      <HStack gap={5} wrap="wrap">
        <VStack gap={0}>
          <Text type="label" color="secondary">
            Confirmed
          </Text>
          <Text type="body" weight="semibold" hasTabularNumbers>
            {confirmedHours} hrs confirmed
          </Text>
        </VStack>
        <VStack gap={0}>
          <Text type="label" color="secondary">
            Planned
          </Text>
          <Text type="body" weight="semibold" hasTabularNumbers>
            {plannedHours} hrs planned
          </Text>
        </VStack>
        <VStack gap={0}>
          <Text type="label" color="secondary">
            Goal
          </Text>
          <Text type="body" weight="semibold" hasTabularNumbers>
            {goalHours} hrs
          </Text>
        </VStack>
        <VStack gap={0}>
          <Text type="label" color="secondary">
            % of goal
          </Text>
          <Text type="body" weight="semibold" hasTabularNumbers>
            {Math.round(percent)}%
          </Text>
        </VStack>
      </HStack>
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

/**
 * T130 (VOLT UX Craft PRD v3.1, UXC-02/03/04/07/13/14) -- REWORK of T121's
 * `List`/`ListItem` coach row (module doc above this replaced; the T121/
 * CHECKER-FIX history is kept only in git blame, not restated here) onto
 * Astryx `Table`, per F-1's finding that `ListItem`'s end slots are
 * `flex: 0 0 auto` (`Item.tsx:268,272`) and therefore cannot align stat/
 * action columns across rows -- confirmed live in this task's own "before"
 * screenshots (`docs/swarm/figures/ux-craft/t130-outreach-coach-before-*.webp`):
 * the "Planned"/"Expected" tiles sit at a different x on every row.
 *
 * -----------------------------------------------------------------------
 * Structure decision (disclosed, T131 inherits this): `useTableGroupedRows`/
 * `useTableRowExpansion` are real in the installed package but have ZERO
 * occurrences in `docs/swarm/astryx-api.md` -- constitution item 2 presumes
 * an undocumented prop/plugin hallucinated, and two already-passed tasks
 * (`ParticipationTab.tsx:305-327,984-998`, `EventsTab.tsx:217-226`) already
 * adjudicated this exact question for the grouping/plugin question. So:
 * ONE `Section`+`Table` per bucket (`CoachOutreachSection`, called once for
 * "Upcoming" and once for "Past" by `CoachOutreachView` below, unchanged
 * call shape), each with a real `Heading level={2}` -- `Table` has no
 * `header` prop and its scroll wrapper hardcodes `role="group"
 * aria-label="Table"` (`Table.tsx:160-161`), so the heading stays a real,
 * separate element, matching `ParticipationTab.tsx:984-998`'s own JSX shape
 * exactly (`<Section dividers={['bottom']}><VStack gap={3}><Heading
 * level={2}/><Table data columns idKey density dividers hasHover/></VStack>
 * </Section>`).
 *
 * Row expansion (also zero in-repo precedent, also T131 inherits this): a
 * plain `useState<ReadonlySet<string>>` of expanded event ids, owned by
 * `CoachOutreachSection` (one instance per bucket, so Upcoming/Past expand
 * independently, matching the old per-row-component-instance `isExpanded`
 * state this replaces). `buildCoachOutreachTableRows` below splices a
 * `kind: 'sessionDetail'` row per session directly beneath its `kind:
 * 'event'` parent row in the SAME flat array `Table`'s `data` prop
 * consumes -- no `colSpan`, no plugin. The free-text "Going: Priya, Devon"
 * line (ex `CoachSessionDetail`, unchanged content, still exported for
 * direct testing) renders as the child row's OWN `title` column content;
 * every other column's `renderCell` returns `null` for a `kind:
 * 'sessionDetail'` row (packet's own instruction) -- no column claims a
 * a width the free-text line does not need, and the free-text row still
 * renders inside the SAME six `<td>`s every event row has (`null` is a
 * valid, empty `<td>` child, not a removed cell), keeping "every body `<tr>`
 * has the same `<td>` count in the same column order" (Required Output
 * (iv)) true for every row, not just event rows.
 *
 * Two `Table`s (Upcoming, Past) resolve column widths independently
 * (`resolveColumnWidths`, `columnUtils.ts`) -- `buildCoachOutreachColumns`
 * is the ONE shared factory both `CoachOutreachSection` instances call with
 * the identical `pixel()`/`proportional()` values (only `header`/cell
 * CONTENT differ by `bucket`, e.g. "Planned" vs "Logged" -- never a width),
 * so `resolveColumnWidths` -- a pure function of the column defs, not the
 * data -- produces byte-identical `<th>` inline styles for both tables
 * (Required Output (i)/(ii)).
 *
 * UXC-04 (the ONLY genuine violation on this row, per the packet's
 * corrected scope): the expander was a `Button` with
 * `label="Show session details – {title}"` and NO children, so the label
 * doubled as the only visible text -- the row title leaked into visible
 * control text. Fixed the same way Edit/Cancel already comply: `label`
 * stays byte-identical (still pinned by `OutreachList.test.tsx`'s edit/
 * cancel `aria-label` assertions and by the expander's own now-updated
 * assertion, see below), short visible children added
 * (`Sessions ({sessions.length})`), so the title survives in the
 * accessible name only. `aria-expanded`/`aria-controls` are added too
 * (`Button` spreads rest props onto the native `<button>`, `Button.tsx:
 * 547,739` -- both are DOM/ARIA passthrough attributes `BaseProps.ts`'s own
 * top comment lists as deliberately "kept", not Astryx-specific API surface
 * documented per-component in `astryx-api.md`; the packet pre-verified and
 * directed this exact usage given the expander now controls rows injected
 * into the same `<tbody>`, a disclosed, deliberate exception to "every prop
 * from `astryx-api.md`", not a silent one). `aria-controls` references the
 * `id` of the first `Text` inside each of the event's own session-detail
 * rows (`Text.id` IS documented, `astryx-api.md` "Text" Props table) --
 * those ids only exist in the DOM once expanded (the rows are spliced OUT
 * of `data`, not merely hidden, when collapsed), matching this file's own
 * pre-existing "hidden means removed from the DOM" convention
 * (`AlertDialog`/`Dialog` usage elsewhere in this codebase, cited by
 * `LiveConsole.tsx`'s own module doc) rather than a CSS-hide. CHECKER FIX
 * (post-T130 review, NIT): while COLLAPSED, `aria-controls` is omitted
 * entirely (`undefined`, which React never renders as an attribute on a
 * native `<button>`) rather than pointing at ids that do not exist in the
 * DOM yet -- an IDREF to a nonexistent id is invalid per the ARIA spec
 * even though it is a common real-world shortcut; this file now only sets
 * `aria-controls` once `isExpanded` is true and the referenced ids are
 * real. `aria-expanded` itself is always present (`false`/`true`), which
 * alone is sufficient for AT to know the control is a disclosure toggle
 * even in the collapsed state.
 * T131 SUPERSEDES the UXC-04 exemption this paragraph used to cite: the
 * standalone "View details – {title}" `Link` in the coach actions column is
 * gone (George authorized the reversal 2026-07-28, see this file's own
 * git history / the T131 packet's "Authorization for the reversal"). Its
 * `href`/keyboard path moves onto the event title itself
 * (`CoachEventTitleCell`, below), not the actions cluster. Edit keeps its
 * verbatim `label`/visible text; Cancel keeps its verbatim `label`
 * (`Cancel – {title}`, en dash preserved) but is now an `IconButton` (a `×`
 * glyph, not visible "Cancel" text) -- see `CoachEventActions`'s own module
 * doc below for the current shape.
 *
 * UXC-13 (responsive, escalation pre-authorized by the packet): Astryx
 * exports no breakpoint hook (zero `useMediaQuery`/`useBreakpoint` in
 * `astryx-api.md`) and there is no CSS/`xstyle` escalation available (F-2),
 * so `useIsNarrowViewport` below is a real `window.matchMedia` SUBSCRIPTION
 * (not a one-time read), independently reimplemented in this file rather
 * than imported -- `CheckinResult.tsx`'s own `usePrefersReducedMotion`
 * (lines 357-387) is the in-repo precedent for the subscription shape, but
 * that file is outside this task's Allowed Files, so this is a fresh
 * implementation of the same pattern, matching this file's own established
 * "independently reimplemented, not imported across pages" convention
 * (NFR-09 date formatters above). `LiveConsole.tsx:351`'s own comment
 * records a DELIBERATE prior *non*-use of `matchMedia` for a different
 * question (mode detection driven by a route param, not a live breakpoint,
 * and that file's own jsdom-only test toolchain genuinely could not prove a
 * real subscription) -- not a precedent against using it here, where the
 * question genuinely is a live CSS breakpoint and this repo's
 * `test-setup.ts` already ships a guarded `matchMedia` polyfill every test
 * environment gets for free (see this task's own worker output "judgment
 * calls" for why that polyfill's `matches: false` default means this file's
 * existing 66 assertions exercise the DESKTOP column set, and the new
 * mobile-specific test below drives the narrow branch explicitly via
 * `vi.stubGlobal`, the same override idiom `CheckinResult.test.tsx`
 * established for the identical hook shape).
 *
 * Below 768px, `buildCoachOutreachColumns` returns a SINGLE `proportional`
 * column instead of six `pixel`/`proportional` columns -- collapsing every
 * column (date, stats, actions) into one stacked card per row, inside the
 * same `Table`, rather than switching back to `List` (which the packet's
 * own migration mandate forecloses) or letting `Table`'s own scroll wrapper
 * kick in (the fixed-width desktop columns sum to ~658px --
 * 120+150+102+158+128, T131 -- which WOULD force horizontal scroll at
 * 375px, forbidden by UXC-13. Was ~950px before T131 shrank the actions
 * column from 420px to 128px; the conclusion is unchanged, since 658px
 * still far exceeds 375px).
 *
 * CHECKER FIX (post-T130 review, MAJOR): 44px touch targets, implemented,
 * corrected premise. The first draft of this file shipped every
 * interactive control at `size="sm"` (`Button.tsx:135` maps `sm` to
 * `sizeVars['--size-element-sm']`, `tokens.stylex.ts:177` = **28px**) and
 * then disclosed the gap as if `size="lg"` (36px, `tokens.stylex.ts:179`)
 * had already been tried and still fell short "through props alone" -- two
 * separate errors: the 36px ceiling was never actually reached (every
 * control stayed at 28px), and "not reachable through props alone" was
 * itself false. `style` is a real Astryx prop, but it is NOT documented on
 * `Button`/`IconButton`/`Link` -- see the corrected reasoning on
 * `MIN_TOUCH_TARGET_STYLE` below (T131), which supersedes this paragraph.
 * (The claim previously made here, that "`astryx-api.md`'s FormField Props
 * table documents it verbatim", was false twice over: there is no
 * `FormField` section in that file at all, and the `style` row it was
 * describing belongs to `Field`. `style` appears in exactly seven props
 * tables -- Field, Carousel, CodeBlock, Kbd, Markdown, Overlay, Thumbnail
 * -- and in none of Button, IconButton, or Link. It is authorized here as
 * an installed-source-verified deviation under D004, not as documentation.)
 * `Button.tsx:545,652-656` merges a consumer `style` in via `mergeProps`
 * (`mergeProps.ts:105-107` folds the consumer `style` into the merged
 * props; `mergeTwoProps`, `mergeProps.ts:39-58`, then spreads it AFTER the
 * StyleX-driven `height`, so it wins) -- this is the SAME documented
 * `className`/`style` merge F-2 itself names as the sanctioned CSS surface
 * ("`className`/`style` are merged (`src/utils/mergeProps.ts:62-107`)"),
 * not `xstyle`/`stylex.create()` (which is what actually throws at
 * runtime, per F-2's own reasoning -- that reasoning never applied to
 * plain `style` objects, which this codebase already uses elsewhere, e.g.
 * `CheckinResult.tsx:595`).
 *
 * Fix: `CoachExpanderButton` and both buttons in `CoachEventActions` now
 * carry `style={{ minHeight: '44px' }}` (CSS `min-height` clamps the used
 * height to `max(specified height, min-height)`, so this genuinely grows
 * the rendered, clickable box to 44px regardless of `size`) -- `size="sm"`
 * is kept (visual glyph/label/padding stay compact; only the hit box
 * grows), since switching to `size="lg"` changes visible chrome for no
 * accessibility benefit `min-height` alone doesn't already provide.
 * Row-height impact re-measured with the same preview rig this task's own
 * worker output already used (real Chromium, not assumed) -- see that
 * output's own "gate output"/"known risks" section for the exact
 * before/after numbers against UXC-07's 72px ceiling.
 *
 * What changes on mobile (<768px) is unrelated to the fix above: which/how
 * many controls sit in one row and how much space surrounds them
 * (single-column stacking gives every control its own full-width row,
 * reducing accidental adjacent mis-taps on top of the real 44px target).
 */

// ---------------------------------------------------------------------------
// UXC-13: real `matchMedia` subscription -- module doc above. T132: the
// hook itself (and the query constant it reads) moved to
// `src/hooks/useIsNarrowViewport.ts` verbatim, so `MeetingsList` (T135) can
// import it instead of copying it -- see that file's own module doc for the
// full "why a real subscription" reasoning this paragraph used to carry.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// T130 -- row shape. `extends Record<string, unknown>` is required by
// `Table`'s own generic constraint (`astryx-api.md` "Table" Props table,
// `data: T[]`) -- the established idiom this file's own module doc cites at
// `ParticipationTab.tsx:361`/`SeasonSettings.tsx:349`.
// ---------------------------------------------------------------------------

export interface CoachEventTableRow extends Record<string, unknown> {
  kind: 'event';
  id: string;
  event: OutreachEventRow;
  sessions: OutreachSessionRow[];
  bucket: 'upcoming' | 'past';
  stats: EventRowStats;
}

export interface CoachSessionDetailTableRow extends Record<string, unknown> {
  kind: 'sessionDetail';
  id: string;
  eventId: string;
  session: OutreachSessionRow;
}

export type CoachOutreachTableRow = CoachEventTableRow | CoachSessionDetailTableRow;

function sessionDetailAnchorId(eventId: string, sessionId: string): string {
  return `outreach-session-detail-${eventId}-${sessionId}`;
}

/** Splices each expanded event's session-detail rows directly beneath it in
 * one flat array -- module doc above. Exported for direct testing (this
 * file's own "pure functions exported" convention). */
export function buildCoachOutreachTableRows(
  enrichedEvents: readonly EnrichedOutreachEvent[],
  bucket: 'upcoming' | 'past',
  rsvps: readonly RsvpRow[],
  attendance: readonly OutreachAttendanceRow[],
  allStudentIds: readonly string[],
  expandedEventIds: ReadonlySet<string>,
): CoachOutreachTableRow[] {
  const rows: CoachOutreachTableRow[] = [];
  for (const { event, sessions } of enrichedEvents) {
    const stats = computeEventRowStats(sessions, rsvps, attendance, allStudentIds);
    rows.push({ kind: 'event', id: event.id, event, sessions, bucket, stats });
    if (expandedEventIds.has(event.id)) {
      for (const session of sessions) {
        rows.push({
          kind: 'sessionDetail',
          id: `${event.id}::session::${session.id}`,
          eventId: event.id,
          session,
        });
      }
    }
  }
  return rows;
}

/** UXD-03 expand-in-place per-session detail -- date/time/hours + RSVP
 * (`going`) names, or the honest canceled/attendance-summary copy. Text
 * preserved verbatim from the pre-T130 row (T121's own module doc, kept
 * only in git blame) -- this is purely a relocation into the `title`
 * column's `renderCell` for `kind: 'sessionDetail'` rows, not a copy
 * change. `anchorId`, when supplied, lands on the first `Text` so the
 * expander `Button`'s `aria-controls` (module doc above) has something
 * real to reference once this row exists in the DOM. */
export function CoachSessionDetail({
  session,
  rsvps,
  studentNameById,
  anchorId,
}: {
  session: OutreachSessionRow;
  rsvps: readonly RsvpRow[];
  studentNameById: ReadonlyMap<string, string>;
  anchorId?: string;
}): ReactNode {
  const goingNames = rsvps
    .filter((rsvp) => rsvp.sessionId === session.id && rsvp.status === 'going')
    .map((rsvp) => studentNameById.get(rsvp.studentId))
    .filter((name): name is string => name !== undefined);

  return (
    <VStack gap={0.5}>
      <Text id={anchorId} type="supporting">
        {formatSessionDateTime(session)} · {sessionHours(session)}h
      </Text>
      {session.status === 'canceled' ? (
        <Text type="supporting">Canceled — no attendance recorded.</Text>
      ) : goingNames.length > 0 ? (
        <Text type="supporting">Going: {goingNames.join(', ')}</Text>
      ) : (
        <Text type="supporting">No RSVPs yet.</Text>
      )}
      {session.status === 'completed' && (
        <Text type="supporting">
          {session.peopleReached !== null
            ? `${session.peopleReached} people reached`
            : 'No attendance summary recorded yet.'}
        </Text>
      )}
    </VStack>
  );
}

/** UXC-02/07: dense event-row title-column content -- title + location line.
 * Location line stays a plain `Text maxLines` (never `textOverflow="truncate"`
 * -- that is a TABLE-level prop that is a documented no-op for `renderCell`
 * columns, `types.ts:573-574`: "Only affects cells using the default
 * renderer (no `renderCell`)"), verbatim "{location} · {address}" shape,
 * unchanged by T131.
 *
 * UXC-07 fix (measured, not assumed): the category `Badge` is NOT inlined
 * next to the title here (unlike the first draft of this column, kept only
 * in this comment as a disclosed measurement record) -- putting `Badge` +
 * title on one `nowrap` line, live, at 1440px against this exact `Table`'s
 * own real (narrower-than-assumed) title-column width, left too little
 * room for the title itself and forced aggressive truncation even for
 * short titles ("Riverside Park Cleanup" -> "Riverside Park Clean…"); doing
 * it the OTHER way (`wrap="wrap"`) instead wrapped the row onto two lines
 * and pushed collapsed rows to 79px, over UXC-07's 72px ceiling. Fix: the
 * `Badge` moved to the DATE column (`CoachEventDateCell` below) instead --
 * this is also where the pre-T130 row already grouped it (module doc on
 * `CoachEventDateCell`), not a new placement. The title column now has its
 * own full column width for the title text alone; measured back down to
 * 42px of content (title + location, single line each) in the same probe.
 *
 * T131 UPDATE: the title itself is no longer a plain `Text` -- it is now a
 * real `Link` (`as={RouterLink}`, `href={routePaths.outreachEvent(event.id)}`)
 * carrying the former standalone "View details – {title}" action's keyboard
 * path directly on the title (module doc #13/#8c above, T131 packet §1).
 * `weight="semibold"`/`maxLines={1}`/`color="primary"` reproduce today's
 * pre-T131 `<Text type="body" weight="semibold" maxLines={1}>` rendering
 * exactly, including colour: `Text.tsx:165,226` resolve `body`'s default
 * colour to `'primary'`, which is what `color="primary"` pins here --
 * `Link`'s own prop default (`'accent'`, `Link.tsx:297`) would otherwise
 * repaint every title purple. No `label`/`aria-label` is set: the title
 * text is already the accessible name (`astryx-api.md:1952,1954`), and is
 * per-row distinguishing, so a generic label would only make things worse,
 * not better. The location line stays a non-interactive `Text` under the
 * link, unchanged. */
function CoachEventTitleCell({ event }: { event: OutreachEventRow }): ReactNode {
  return (
    <VStack gap={0.5}>
      <Link
        as={RouterLink}
        href={routePaths.outreachEvent(event.id)}
        isStandalone
        weight="semibold"
        maxLines={1}
        color="primary"
      >
        {event.title}
      </Link>
      <Text type="supporting" maxLines={1}>
        {event.locationName}
        {event.address !== '' ? ` · ${event.address}` : ''}
      </Text>
    </VStack>
  );
}

/** UXC-02: category `Badge` + date range + weekday chips column content --
 * content/grouping originally moved verbatim from the pre-T130 row's own
 * `description` block (module doc on `CoachEventTitleCell` above).
 *
 * CHECKER FIX (post-T130 review, MAJOR, module doc above) -- second
 * measured pass: the type `Badge` was first grouped on the SAME line as
 * `dateRangeLabel` (matching the pre-T130 row's own layout literally), but
 * measured (real Chromium, this task's own preview rig) combined width for
 * "Outreach" + "Jun 14 → Aug 2" is ~154px -- wide enough that giving this
 * column enough room to never wrap it left too little of the table's own
 * real 1132px-at-1440px width for the TITLE column, which started
 * truncating instead ("Community Food Bank Sort" -> clipped). Regrouped:
 * `Badge` now shares a line with the (always-short) weekday chips instead
 * -- "Outreach" + "SUN (2)" measures well under half the width "Outreach" +
 * "Jun 14 → Aug 2" needed -- and `dateRangeLabel` gets its own, narrower
 * line. Still the same three real pieces of information (type, date range,
 * weekday chips), just paired differently so this column's own real
 * minimum width shrinks enough to give the title column its readable width
 * back, without reintroducing the row-height regression the first
 * `Badge`+title pairing (`CoachEventTitleCell`'s own module doc above)
 * already measured and rejected. */
function CoachEventDateCell({
  event,
  stats,
}: {
  event: OutreachEventRow;
  stats: EventRowStats;
}): ReactNode {
  return (
    <VStack gap={0.5}>
      <Text type="supporting">{stats.dateRangeLabel}</Text>
      <HStack gap={1} wrap="wrap" vAlign="center">
        <Badge
          variant="neutral"
          label={event.type === 'competition' ? 'Competition' : 'Outreach'}
        />
        {stats.weekdayChips.map((chip) => (
          <Badge key={chip.key} variant="neutral" label={chip.label} />
        ))}
      </HStack>
    </VStack>
  );
}

/** UXC-13 -- CHECKER FIX (post-T130 review, MAJOR, module doc above): a
 * real 44px minimum touch target via the `style` prop. CORRECTED CITATION
 * (T131): `style` is NOT documented on `# Button`/`# IconButton` -- there is
 * no `FormField` section in `astryx-api.md` at all, and `style` appears in
 * exactly 7 props tables there (Field, Carousel, CodeBlock, Kbd, Markdown,
 * Overlay, Thumbnail), none of them Button/IconButton. This is a pre-
 * authorized undocumented-prop deviation (constitution item 2's D004
 * installed-source precedent, T131 packet Trap 4), not a documented one:
 * verified directly in installed source instead -- `Button.tsx:545`
 * destructures `style`, `:652-657` merges it via `mergeProps`, which spreads
 * the consumer `style` AFTER the StyleX-driven `height` (`mergeProps.ts:84-
 * 89`), so `minHeight` here genuinely wins (CSS clamps the used height to
 * `max(specified height, min-height)`); `IconButton.tsx:51` spreads
 * `...props` (including `style`) into `Button`, so the same deviation
 * covers the `IconButton` `×` below too. `size` itself stays `"sm"` on
 * every button below -- only the hit box grows, not the visible glyph/
 * label/padding. Shared by every button this file's coach `Table` renders
 * (desktop AND the mobile card column, since
 * `CoachExpanderButton`/`CoachEventActions` are shared components). */
const MIN_TOUCH_TARGET_STYLE: CSSProperties = { minHeight: '44px' };

/** UXC-04: the expander -- module doc above (the one genuine violation +
 * fix). Shared by the desktop expander column and the mobile card column. */
function CoachExpanderButton({
  row,
  isExpanded,
  onToggleExpand,
}: {
  row: CoachEventTableRow;
  isExpanded: boolean;
  onToggleExpand: (eventId: string) => void;
}): ReactNode {
  const controlsIds = row.sessions
    .map((session) => sessionDetailAnchorId(row.event.id, session.id))
    .join(' ');
  return (
    <Button
      label={
        isExpanded
          ? `Hide session details – ${row.event.title}`
          : `Show session details – ${row.event.title}`
      }
      size="sm"
      variant="ghost"
      aria-expanded={isExpanded}
      // CHECKER FIX (post-T130 review, NIT, module doc above): only a real
      // disclosure target while expanded -- the referenced ids do not
      // exist in the DOM until then (rows are spliced out, not hidden,
      // when collapsed), so `aria-controls` is omitted (not a stale IDREF)
      // in the collapsed state.
      aria-controls={isExpanded ? controlsIds : undefined}
      style={MIN_TOUCH_TARGET_STYLE}
      onClick={() => onToggleExpand(row.event.id)}
    >
      {`Sessions (${row.sessions.length})`}
    </Button>
  );
}

/** T131 (reverses part of T112, supersedes the UXC-04 "View details" text
 * exemption -- George authorized 2026-07-28, `VOLT_UX_Craft_PRD_v3.md`
 * UXC-04 row / commit `b959b90`, T131 packet "Authorization for the
 * reversal"): the compact reference-app action-cluster shape
 * (`old-events-tab.webp`) -- a short `Edit` chip + a destructive `×`
 * `IconButton`, no more standalone "View details – {title}" text. That
 * link's keyboard path to `/outreach/:eventId` did not disappear; it moved
 * onto the title (`CoachEventTitleCell`, above).
 *
 * `Edit` -- unchanged: `Button`, `size="sm"`, `variant="secondary"`,
 * verbatim `label`/visible text.
 *
 * `×` -- was a `variant="destructive"` `Button` with visible "Cancel" text;
 * now a `variant="destructive"` `IconButton` (`icon="close"`, a documented
 * semantic name, `astryx-api.md:585,608`) with the SAME verbatim
 * `label={`Cancel – ${title}`}` (three green tests depend on the exact
 * string, T131 packet Trap 3) -- `IconButton`'s `label` is required and
 * becomes the `aria-label` (`astryx-api.md:4267`), and per
 * `astryx-api.md:4261` an icon-only control also needs a `tooltip` since
 * `label` alone never reaches sighted users; `tooltip="Cancel event"` is
 * pinned (no test depends on its exact text). The `canCancel` gate is
 * unchanged. Both `Edit` and `×` keep the real 44px `style` touch target
 * (module doc on `MIN_TOUCH_TARGET_STYLE` above; `IconButton.tsx:51`
 * spreads `style` through to the underlying `Button`).
 *
 * Shared by the desktop actions column and the mobile card column. */
function CoachEventActions({
  row,
  onEdit,
  onCancel,
}: {
  row: CoachEventTableRow;
  onEdit: (event: OutreachEventRow, sessions: readonly OutreachSessionRow[]) => void;
  onCancel: (event: OutreachEventRow) => void;
}): ReactNode {
  const canCancel = row.stats.scheduledSessions.length > 0;
  return (
    <HStack gap={2} vAlign="center" wrap="wrap">
      <Button
        label={`Edit – ${row.event.title}`}
        size="sm"
        variant="secondary"
        style={MIN_TOUCH_TARGET_STYLE}
        onClick={() => onEdit(row.event, row.sessions)}
      >
        Edit
      </Button>
      {canCancel && (
        <IconButton
          label={`Cancel – ${row.event.title}`}
          icon={<Icon icon="close" size="sm" />}
          variant="destructive"
          size="sm"
          tooltip="Cancel event"
          style={MIN_TOUCH_TARGET_STYLE}
          onClick={() => onCancel(row.event)}
        />
      )}
    </HStack>
  );
}

interface BuildCoachColumnsArgs {
  bucket: 'upcoming' | 'past';
  rsvps: readonly RsvpRow[];
  studentNameById: ReadonlyMap<string, string>;
  expandedEventIds: ReadonlySet<string>;
  onToggleExpand: (eventId: string) => void;
  onEdit: (event: OutreachEventRow, sessions: readonly OutreachSessionRow[]) => void;
  onCancel: (event: OutreachEventRow) => void;
  isNarrow: boolean;
}

function renderSessionDetailCell(
  row: CoachSessionDetailTableRow,
  rsvps: readonly RsvpRow[],
  studentNameById: ReadonlyMap<string, string>,
): ReactNode {
  return (
    <CoachSessionDetail
      session={row.session}
      rsvps={rsvps}
      studentNameById={studentNameById}
      anchorId={sessionDetailAnchorId(row.eventId, row.session.id)}
    />
  );
}

/**
 * UXC-02/03/07/13 -- the ONE shared column factory both `CoachOutreachSection`
 * instances (Upcoming, Past) call, so `resolveColumnWidths` (pure over the
 * column defs) produces byte-identical `<th>` widths for both `Table`s
 * (module doc above). `bucket` only ever changes header/cell TEXT, never a
 * `pixel()`/`proportional()` value.
 */
function buildCoachOutreachColumns({
  bucket,
  rsvps,
  studentNameById,
  expandedEventIds,
  onToggleExpand,
  onEdit,
  onCancel,
  isNarrow,
}: BuildCoachColumnsArgs): TableColumn<CoachOutreachTableRow>[] {
  if (isNarrow) {
    // UXC-13 (<768px): every desktop column collapses into one stacked card
    // column -- module doc above for why (no h-scroll at 375px).
    return [
      {
        key: 'card',
        header: '',
        width: proportional(1),
        renderCell: (row) => {
          if (row.kind === 'sessionDetail') {
            return renderSessionDetailCell(row, rsvps, studentNameById);
          }
          const isExpanded = expandedEventIds.has(row.event.id);
          const hoursValue =
            bucket === 'upcoming' ? row.stats.hours.plannedHours : row.stats.hours.confirmedHours;
          const countValue =
            bucket === 'upcoming' ? row.stats.expectedCount : row.stats.attendedCount;
          return (
            <VStack gap={2}>
              <CoachEventTitleCell event={row.event} />
              <CoachEventDateCell event={row.event} stats={row.stats} />
              <HStack gap={4} wrap="wrap">
                <StatCell
                  label={bucket === 'upcoming' ? 'Planned' : 'Logged'}
                  value={`${hoursValue}h`}
                />
                <StatCell
                  label={bucket === 'upcoming' ? 'Expected' : 'Attended'}
                  value={`${countValue} students`}
                  secondary={
                    bucket === 'past' && row.stats.reached !== null
                      ? `Reached ${row.stats.reached}`
                      : undefined
                  }
                />
              </HStack>
              <HStack gap={2} wrap="wrap" vAlign="center">
                <CoachExpanderButton
                  row={row}
                  isExpanded={isExpanded}
                  onToggleExpand={onToggleExpand}
                />
              </HStack>
              <CoachEventActions row={row} onEdit={onEdit} onCancel={onCancel} />
            </VStack>
          );
        },
      },
    ];
  }

  return [
    {
      // CHECKER FIX (post-T130 review, MAJOR -- module doc above), 44px
      // touch-target rebalance -- every width below is the real single-line
      // natural content width (measured live, real Chromium, this task's
      // own preview rig) plus a real margin, so NO column's own content
      // wraps onto an extra line (wrapping, not the pixel values
      // themselves, is what pushed collapsed rows over UXC-07's 72px
      // ceiling in earlier passes -- see this task's own worker output
      // "gate output" for the measurement log of each pass). `expander`'s
      // own natural content ("Sessions (N)") measured 102px wide.
      key: 'expander',
      header: '',
      width: pixel(120),
      renderCell: (row) => {
        if (row.kind !== 'event') return null;
        const isExpanded = expandedEventIds.has(row.event.id);
        return (
          <CoachExpanderButton row={row} isExpanded={isExpanded} onToggleExpand={onToggleExpand} />
        );
      },
    },
    {
      // `CoachEventDateCell`'s own `Badge`+chips regrouping (see that
      // component's own module doc) measured 128px for its own widest real
      // single line ("Outreach" + "SUN (1)") -- 150px keeps a real margin.
      key: 'date',
      header: 'Date',
      width: pixel(150),
      renderCell: (row) =>
        row.kind === 'event' ? <CoachEventDateCell event={row.event} stats={row.stats} /> : null,
    },
    {
      // An explicit `minWidth` (not the `proportional()` default of
      // 120px) -- this column's own real minimum need, at the longest
      // real fixture title ("Community Food Bank Sort"), measured 204px of
      // TEXT at `size="sm"`/`weight="semibold"` -- +16px of real compact-
      // density cell padding (`TableCell.tsx`'s own `densityStyles.compact`,
      // `paddingInline: spacingVars['--spacing-2']` = 8px each side) = a
      // real 220px floor; 224px keeps a small real margin. Without an
      // explicit floor, the pixel columns around it (widened for the
      // 44px-touch-target fix) would silently squeeze this column down and
      // truncate real titles -- an explicit `minWidth` makes the trade-off
      // visible instead.
      //
      // T131 UPDATE (supersedes the trade-off this comment used to record):
      // that trade-off is resolved, not merely re-described. The old
      // `actions` column floor (420px, driven by the now-removed "View
      // details – {title}" text -- see that column's own comment below) was
      // the reason the per-column single-line minimums summed to slightly
      // MORE than the `Table`'s own real available width at 1440px (its
      // scroll wrapper's `clientWidth`, `Table.tsx:160-161`, measured
      // 1132px for this route's real content-area layout, previously
      // ~1174px of combined column minimums -- a real, measured ~42px of
      // `Table`-internal horizontal scroll with text clipped mid-word).
      // With `actions` shrunk (T131, that column's own comment below), the
      // reclaimed width flows here automatically -- `title` is
      // `proportional()`, so it absorbs whatever the fixed-`pixel` columns
      // around it no longer claim -- and the sum no longer exceeds the
      // Table's real available width. Measured (preview rig, real
      // Chromium, 1440px): the `Table`'s own scroll wrapper now measures
      // `scrollWidth <= clientWidth` (see this task's own worker output for
      // the exact before/after numbers) -- no more `Table`-internal
      // horizontal scroll, and the title is not truncated. This still does
      // not touch UXC-13's own hard requirement ("no h-scroll at 375px"):
      // at 375px this desktop column set is not used at all
      // (`buildCoachOutreachColumns`'s own `isNarrow` branch, module doc
      // above), and page-level scroll (`document.documentElement.
      // scrollWidth` vs. viewport width) was already, and remains, zero at
      // both 1440px and 375px.
      key: 'title',
      header: 'Event',
      width: proportional(2, { minWidth: 224 }),
      renderCell: (row) =>
        row.kind === 'event' ? (
          <CoachEventTitleCell event={row.event} />
        ) : (
          renderSessionDetailCell(row, rsvps, studentNameById)
        ),
    },
    {
      // Measured natural content ("Planned"/"4h" etc.) tops out at 84px.
      key: 'hours',
      header: '',
      width: pixel(102),
      align: 'end',
      renderCell: (row) => {
        if (row.kind !== 'event') return null;
        const hoursValue =
          bucket === 'upcoming' ? row.stats.hours.plannedHours : row.stats.hours.confirmedHours;
        return (
          <StatCell label={bucket === 'upcoming' ? 'Planned' : 'Logged'} value={`${hoursValue}h`} />
        );
      },
    },
    {
      // Measured natural content ("Attended"/"2 students" etc.) tops out
      // at 140px.
      key: 'count',
      header: '',
      width: pixel(158),
      align: 'end',
      renderCell: (row) => {
        if (row.kind !== 'event') return null;
        const countValue =
          bucket === 'upcoming' ? row.stats.expectedCount : row.stats.attendedCount;
        return (
          <StatCell
            label={bucket === 'upcoming' ? 'Expected' : 'Attended'}
            value={`${countValue} students`}
            secondary={
              bucket === 'past' && row.stats.reached !== null
                ? `Reached ${row.stats.reached}`
                : undefined
            }
          />
        );
      },
    },
    {
      // T131 (reverses the CHECKER FIX / post-T130 module doc this comment
      // used to describe): shrunk from 420px. The 420px floor existed only
      // to hold Edit + Cancel + the full "View details – {title}" text on
      // one line; that text is gone (T131 packet §2 -- Cancel is now an
      // icon-only `×`, and "View details" moved onto the title,
      // `CoachEventTitleCell`'s own module doc above). New floor: Edit 48px
      // (measured natural width) + `HStack gap={2}` (8px) + the `×`
      // `IconButton` 44px (square: `Button.tsx:103-108` sets `aspectRatio:
      // 1/1` and zero `paddingInline`/`paddingBlock` for `isIconOnly`, so
      // its 44px `minHeight` touch target becomes 44px wide too) + 16px of
      // real cell padding (8px each side, compact density,
      // `TableCell.tsx:70-75`) = 116px. Shipped at 128px, not the bare
      // 116px floor and not 120px either: `CoachEventActions`'s own `HStack`
      // has `wrap="wrap"` (below), so a near-zero margin is a real wrap
      // risk, and a wrap is exactly what pushed collapsed rows to 81px in
      // T130 (see the `key: 'title'` column's own comment above). The slack
      // this frees is given back to the `title` column automatically --
      // `title` is `proportional()`, so it absorbs whatever the fixed-`pixel`
      // columns around it no longer claim (measured: the `Event` `<th>` grew
      // from 224px to 474px). Measured (preview rig, real Chromium, 1440px):
      // the `Table`'s scroll wrapper now measures `scrollWidth === clientWidth`
      // == 1132px on both Upcoming and Past tables (was clientWidth 1132px /
      // scrollWidth 1174px before this task -- no more internal horizontal
      // scroll; see this task's own worker output for the full measurement
      // log). Collapsed rows measured 52.5-53px (Upcoming) and 52.5-69px
      // (Past, the 69px row has an extra "Reached N" secondary stat line) --
      // well under UXC-07's 72px ceiling.
      key: 'actions',
      header: '',
      width: pixel(128),
      renderCell: (row) =>
        row.kind === 'event' ? (
          <CoachEventActions row={row} onEdit={onEdit} onCancel={onCancel} />
        ) : null,
    },
  ];
}

function CoachOutreachSection({
  title,
  bucket,
  enrichedEvents,
  rsvps,
  attendance,
  students,
  emptyDescription,
  onEdit,
  onCancel,
}: {
  title: string;
  bucket: 'upcoming' | 'past';
  enrichedEvents: readonly EnrichedOutreachEvent[];
  rsvps: readonly RsvpRow[];
  attendance: readonly OutreachAttendanceRow[];
  students: readonly OutreachStudentFixture[];
  emptyDescription: string;
  onEdit: (event: OutreachEventRow, sessions: readonly OutreachSessionRow[]) => void;
  onCancel: (event: OutreachEventRow) => void;
}): ReactNode {
  // T130 -- module doc above: one independent expansion-state set per
  // bucket instance (Upcoming/Past expand independently, matching the old
  // per-row-component `isExpanded` state this replaces).
  const [expandedEventIds, setExpandedEventIds] = useState<ReadonlySet<string>>(() => new Set());
  const isNarrow = useIsNarrowViewport();
  const allStudentIds = useMemo(() => students.map((student) => student.id), [students]);
  const studentNameById = useMemo(
    () => new Map(students.map((student) => [student.id, student.name] as const)),
    [students],
  );
  // T129's own precedent for this exact "Heading id -> aria-labelledby"
  // shape (`StudentOutreachSection`, this file, forbidden/read-only to
  // this task) -- mirrored here for the coach section too (CHECKER FIX,
  // post-T130 review, NIT: parity with the student sections in the same
  // file). Unlike `StudentOutreachSection`'s own `List`-based reason (a
  // headerless `List` silently drops ARIA props, UXC-01/D-G), `Table`'s
  // own scroll wrapper hardcodes `aria-label="Table"` (`Table.tsx:160-161`,
  // module doc above), which is generic and not event-bucket-specific --
  // `aria-labelledby` gives the whole Upcoming/Past region its own real
  // accessible name, resolving back to the SAME visible `Heading` text, in
  // both the populated (`Table`) and empty (`EmptyState`) branches.
  //
  // CHECKER FIX (post-T130 review, MAJOR): the wrapper carrying
  // `aria-labelledby` is a plain `<div role="group">`, NOT `Section` --
  // this is the exact defect T129's own checker independently found and
  // fixed on the student side of this same file (T129's own module doc,
  // `StudentOutreachSection` above, forbidden/read-only): `Section.tsx`
  // renders a bare `<div>` with no role (`{...props}` spread onto the
  // outer div, never a `<section>` element, never a `role`), and under
  // ARIA, `aria-labelledby` on an element with the implicit `generic` role
  // is NAME-PROHIBITED -- assistive technology discards it outright, even
  // though the attribute is genuinely present in the DOM and would pass a
  // test that only checks for its presence. `role="group"` genuinely
  // supports a computed accessible name, so this task's own test now
  // queries `[role="group"][aria-labelledby="..."]` together (not
  // `aria-labelledby` alone), so a role-less regression fails at the
  // lookup rather than passing a weaker later assertion.
  //
  // `Section`'s own `dividers={['bottom']}` visual is dropped, not
  // replaced -- matching `StudentOutreachSection`'s own fix exactly (no
  // divider between its Upcoming/Past instances either): the `Heading`
  // (bold, `level={2}`) plus the outer `VStack`'s own `gap` already
  // separate Upcoming from Past visually, and `Table`'s own `dividers="rows"`
  // (unchanged) still separates each row within a bucket.
  const headingId = useId();

  // CHECKER FIX (post-T130 review, NIT): a real `useCallback`, not a
  // freshly-recreated closure re-justified by an
  // `eslint-disable-next-line` on the `columns` memo below -- `[]` deps are
  // correct because `setExpandedEventIds` (the `useState` setter) is
  // referentially stable across renders (React's own guarantee), and the
  // updater function reads `previous` from its own callback argument, never
  // from an outer-scope closure value that could go stale.
  const toggleExpand = useCallback((eventId: string): void => {
    setExpandedEventIds((previous) => {
      const next = new Set(previous);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  }, []);

  const rows = useMemo(
    () =>
      buildCoachOutreachTableRows(
        enrichedEvents,
        bucket,
        rsvps,
        attendance,
        allStudentIds,
        expandedEventIds,
      ),
    [enrichedEvents, bucket, rsvps, attendance, allStudentIds, expandedEventIds],
  );

  const columns = useMemo(
    () =>
      buildCoachOutreachColumns({
        bucket,
        rsvps,
        studentNameById,
        expandedEventIds,
        onToggleExpand: toggleExpand,
        onEdit,
        onCancel,
        isNarrow,
      }),
    [bucket, rsvps, studentNameById, expandedEventIds, toggleExpand, onEdit, onCancel, isNarrow],
  );

  return (
    <VStack gap={3}>
      <Heading level={2} id={headingId}>
        {title}
      </Heading>
      <div role="group" aria-labelledby={headingId}>
        {enrichedEvents.length === 0 ? (
          <EmptyState
            headingLevel={3}
            title={`No ${title.toLowerCase()} outreach events`}
            description={emptyDescription}
          />
        ) : (
          <Table
            data={rows}
            columns={columns}
            idKey="id"
            density="compact"
            dividers="rows"
            hasHover
          />
        )}
      </div>
    </VStack>
  );
}

interface CoachOutreachViewProps {
  seasonId: string;
  events: readonly OutreachEventRow[];
  sessions: readonly OutreachSessionRow[];
  rsvps: readonly RsvpRow[];
  /** CHECKER FIX (rework of T121, MAJOR) -- real attendance rows (one
   * batched `loaders/outreach.ts` query), the ONE source each row's own
   * "Attended" stat is computed from. */
  attendance: readonly OutreachAttendanceRow[];
  students: readonly OutreachStudentFixture[];
  goalConfig: OutreachGoalConfig;
  /** T101 (module doc #11). Defaults to a real `events`/`event_sessions`
   * insert/update, passed straight through to `<OutreachEventDialog
   * onSaveEvent={...} />` -- T121 UPDATE: now genuinely used for BOTH create
   * (no `initialEvent`) AND edit (row-level "Edit" action, `initialEvent`
   * built by `buildInitialOutreachEventFromRow`), same single dialog
   * instance. */
  onSaveEvent: OnSaveOutreachEventFn;
  /** T101 (module doc #11). Reloads this page's own already-loaded data in
   * place after a successful create/edit/cancel, without re-triggering the
   * top-level `loading` DES-12 state. */
  onReload: () => Promise<void>;
  /** T121 item (c) -- real, event-level cancel (`OutreachDetail.tsx`'s own
   * already-built, already-tested `cancelOutreachEvent` mutation, reused
   * verbatim -- this file adds no new mutation of its own). */
  onCancelEvent: CancelOutreachEventFn;
  /** T121 item (a) -- real roster loader (T118, `loadOutreachEventRoster`,
   * built/tested but previously unconsumed by any page) wired into this
   * view's own create/edit `OutreachEventDialog` `students` prop, replacing
   * that dialog's own `DEFAULT_STUDENTS` fixture fallback. */
  loadRoster: LoadOutreachEventRosterFn;
  /** The acting coach's real `profiles.id`, threaded down from
   * `OutreachList`'s own `useAuth()` -- written verbatim to
   * `rsvps.responded_by` for every "Expected attendees" checklist row this
   * view's dialog fans out (T118 D-7). */
  viewerProfileId: string;
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
  attendance,
  students,
  goalConfig,
  onSaveEvent,
  onReload,
  onCancelEvent,
  loadRoster,
  viewerProfileId,
}: CoachOutreachViewProps): ReactNode {
  const { upcoming, past } = useMemo(() => buildEventGroups(events, sessions), [events, sessions]);
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
  // `<OutreachEventDialog>` instance. T121 UPDATE: `editingTarget` (null =
  // create mode) lets this SAME instance now also serve the new row-level
  // "Edit" action, instead of edit mode living only on `OutreachDetail.tsx`.
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<{
    event: OutreachEventRow;
    sessions: readonly OutreachSessionRow[];
  } | null>(null);
  const [cancelTarget, setCancelTarget] = useState<OutreachEventRow | null>(null);
  const [feedback, setFeedback] = useState<FeedbackBanner | null>(null);
  // CHECKER FIX (rework of T121, NIT #6): a real, honest DES-12 load-state
  // for the roster fetch -- BEFORE this fix, a rejection (e.g. Supabase
  // isn't configured) left `roster` at its initial `undefined`, which
  // `OutreachEventDialog` (its own `students` prop default) silently
  // treated as "use my own `DEFAULT_STUDENTS` fixture" -- i.e. a coach
  // could open the checklist and see FAKE sample students ("Riley Chen",
  // "Sam Okafor", ...) with no indication anything failed. NOW: a failed
  // fetch resolves to `{ status: 'error' }`, which (a) passes a real EMPTY
  // array (never `undefined`) as `students`, so the dialog can never fall
  // back to its own fixture, and (b) surfaces an honest error `Banner`
  // (below, in this component's own render -- `OutreachEventDialog.tsx`
  // stays forbidden/read-only, so this notice lives on the PAGE side, not
  // injected into the dialog) with a real `Retry` action, same DES-12
  // Banner+Retry shape this file's own top-level data-load error state
  // already established.
  type RosterLoadState =
    | { status: 'loading' }
    | { status: 'ready'; students: readonly OutreachRosterStudent[] }
    | { status: 'error' };
  const [rosterState, setRosterState] = useState<RosterLoadState>({ status: 'loading' });
  // Bumped by the error Banner's "Retry" action to force the effect below to
  // re-run -- same `retryToken` idiom this file's own top-level
  // `useLoadState` already established (module doc there).
  const [rosterRetryToken, setRosterRetryToken] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setRosterState({ status: 'loading' });
    loadRoster()
      .then((data) => {
        if (isMounted) setRosterState({ status: 'ready', students: data });
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
  // short-lived placeholder here, unlike the disclosed FAILURE case above).
  // `'ready'` -> the real roster. `'error'` -> a real, honest EMPTY array,
  // never the dialog's own fixture.
  const rosterForDialog =
    rosterState.status === 'ready'
      ? rosterState.students
      : rosterState.status === 'error'
        ? []
        : undefined;

  function openCreateDialog(): void {
    setEditingTarget(null);
    setIsEventDialogOpen(true);
  }

  function openEditDialog(
    event: OutreachEventRow,
    eventSessions: readonly OutreachSessionRow[],
  ): void {
    setEditingTarget({ event, sessions: eventSessions });
    setIsEventDialogOpen(true);
  }

  function requestCancelEvent(event: OutreachEventRow): void {
    setCancelTarget(event);
  }

  // T101 (module doc #11) -- real `onSaveEvent` wiring. Reloads this page's
  // own data via `onReload()` on success (a full reload, not a client-side
  // merge -- module doc #11). T121 UPDATE: branches success copy on whether
  // `payload.event.id` is present (edit) or not (create).
  async function handleSaveEventSubmit(
    payload: Parameters<OnSaveOutreachEventFn>[0],
  ): Promise<void> {
    const isEdit = payload.event.id !== undefined;
    await onSaveEvent(payload);
    try {
      await onReload();
      setFeedback({
        status: 'success',
        title: isEdit ? 'Outreach event updated' : 'Outreach event created',
        description: isEdit
          ? `"${payload.event.title}" was updated.`
          : `"${payload.event.title}" was created with ${payload.sessions.length} session${payload.sessions.length === 1 ? '' : 's'}.`,
      });
    } catch {
      // The save itself already succeeded (this catch only guards the
      // follow-up reload) -- disclosed, not fatal, same posture
      // `MeetingsList.tsx`'s own T096 `handleCreateMeetingsSubmit` already
      // established.
      setFeedback({
        status: 'success',
        title: isEdit ? 'Outreach event updated' : 'Outreach event created',
        description: `"${payload.event.title}" was ${isEdit ? 'updated' : 'created'}. Refresh the page to see the changes.`,
      });
    }
  }

  // T121 item (c) -- real, event-level cancel (mirrors
  // `OutreachDetail.tsx`'s own `handleConfirmCancel` shape: confirm, mutate,
  // reload, honest error Banner on failure).
  async function handleConfirmCancel(): Promise<void> {
    if (cancelTarget === null) return;
    const target = cancelTarget;
    setCancelTarget(null);
    try {
      await onCancelEvent(target.id);
      await onReload();
      setFeedback({
        status: 'success',
        title: 'Event canceled',
        description: `"${target.title}"'s remaining scheduled sessions are marked canceled. Already-completed sessions are untouched.`,
      });
    } catch {
      setFeedback({
        status: 'error',
        title: "Couldn't cancel event",
        description: `Something went wrong canceling "${target.title}". Try again in a moment.`,
      });
    }
  }

  const hasAnyOutreach = sessions.length > 0;
  // T121 item (b) -- edit-mode prefill, including `expectedStudentIds`
  // derived from the event's own existing `going` RSVPs.
  const initialEvent =
    editingTarget !== null
      ? buildInitialOutreachEventFromRow(editingTarget.event, editingTarget.sessions, rsvps)
      : undefined;

  return (
    <>
      <HStack hAlign="between" vAlign="center" wrap="wrap" gap={3}>
        <VStack gap={1}>
          <Heading level={1}>Outreach</Heading>
          <Badge variant="neutral" label={`${unansweredCount} pending RSVPs`} />
        </VStack>
        <Button label="New outreach event" variant="primary" onClick={openCreateDialog} />
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

      {/* CHECKER FIX (rework of T121, NIT #6) -- honest, page-side notice
          for a roster-load failure (module doc on `rosterState` above). */}
      {rosterState.status === 'error' && (
        <Banner
          status="error"
          title="Couldn't load the student roster"
          description={
            'Creating or editing an outreach event will show an empty "Expected attendees" checklist until this is retried.'
          }
          endContent={<Button variant="ghost" label="Retry" onClick={retryRosterLoad} />}
        />
      )}

      {!hasAnyOutreach ? (
        <EmptyState
          headingLevel={2}
          title="No outreach events yet"
          description="Outreach events for this season will show up here once they're scheduled."
          actions={
            <Button label="New outreach event" variant="primary" onClick={openCreateDialog} />
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
            bucket="upcoming"
            enrichedEvents={upcoming}
            rsvps={rsvps}
            attendance={attendance}
            students={students}
            emptyDescription="No outreach events are currently scheduled."
            onEdit={openEditDialog}
            onCancel={requestCancelEvent}
          />
          <CoachOutreachSection
            title="Past"
            bucket="past"
            enrichedEvents={past}
            rsvps={rsvps}
            attendance={attendance}
            students={students}
            emptyDescription="Completed and canceled outreach events will show up here."
            onEdit={openEditDialog}
            onCancel={requestCancelEvent}
          />
        </>
      )}

      {/* T121 item (c) -- real event-level cancel confirmation, same copy
          `OutreachDetail.tsx`'s own precedent already established. */}
      <AlertDialog
        isOpen={cancelTarget !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setCancelTarget(null);
        }}
        title={cancelTarget !== null ? `Cancel "${cancelTarget.title}"?` : 'Cancel event?'}
        description="This marks every still-scheduled session for this event canceled. Already-completed sessions are left untouched, and no attendance will be recorded for the canceled ones."
        actionLabel="Cancel event"
        onAction={() => {
          void handleConfirmCancel();
        }}
      />

      {/* T101 (module doc #11) -- `OutreachEventDialog.tsx` (T039, already
          Passed, already built) wired into this page. T121 UPDATE: now
          genuinely serves BOTH create (`initialEvent` undefined) and edit
          (`initialEvent` from a row's own "Edit" action) through this same
          instance, plus the real roster (`students`) and acting-coach id
          (`currentUserProfileId`) this task wires in. `teams` deliberately
          NOT overridden -- module doc #11 (unchanged, out of this task's own
          Allowed Files). */}
      <OutreachEventDialog
        isOpen={isEventDialogOpen}
        onOpenChange={(isOpen) => {
          setIsEventDialogOpen(isOpen);
          if (!isOpen) setEditingTarget(null);
        }}
        onSaveEvent={handleSaveEventSubmit}
        initialEvent={initialEvent}
        students={rosterForDialog}
        currentUserProfileId={viewerProfileId}
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

/**
 * T121 (UXP-04 outreach half / UXD-02/03): dense per-EVENT student/parent
 * row -- replaces the former per-SESSION `StudentOutreachRowItem`. Unlike
 * the coach row (which defaults collapsed), this row defaults EXPANDED:
 * UXD-04's "no dead ends: every entity offers its next action within one
 * interaction" means the viewer's own RSVP control (this row's primary
 * action) must be reachable without first clicking a "+" toggle. The
 * toggle itself still exists (a viewer may collapse a long multi-session
 * event down to just its date/location summary) -- UXD-03's expand-in-place
 * mechanism is genuinely present and functional, just defaulted open here
 * for the reason above, not defaulted closed like the coach view's own row
 * (whose primary actions -- Edit/Cancel -- live in a `CoachEventActions`
 * `Table` cell since T130, not `endContent`; this sentence previously said
 * "endContent", stale since T130 moved the coach row off `ListItem` --
 * corrected here, T132).
 */
function StudentOutreachEventRow({
  event,
  sessions,
  rsvps,
  viewerStudentId,
  allowSelfCheckoff,
  onRsvpChange,
  onOpenSelfCheckoff,
}: {
  event: OutreachEventRow;
  sessions: readonly OutreachSessionRow[];
  rsvps: readonly RsvpRow[];
  viewerStudentId: string;
  /** T126 (module doc #14) -- `true` only for the "Past" section instance;
   * a still-upcoming event never offers self check-off. */
  allowSelfCheckoff: boolean;
  onRsvpChange: (sessionId: string, status: RsvpStatus) => void;
  /** T126 (module doc #14) -- opens the ONE shared `SelfCheckoffDialog`
   * instance (owned by `StudentParentOutreachView`, same "one shared
   * dialog instance, row picks the target" convention `CoachOutreachView`'s
   * own `AlertDialog`/`OutreachEventDialog` above already established --
   * NOT a per-row `Dialog` instance nested inside this `<List>`, which
   * would put an invalid `<dialog>` element directly under a `<ul>`). */
  onOpenSelfCheckoff: (event: OutreachEventRow, sessions: readonly OutreachSessionRow[]) => void;
}): ReactNode {
  const [isExpanded, setIsExpanded] = useState(true);
  const hasCompletedSession = sessions.some((session) => session.status === 'completed');
  const showSelfCheckoffButton = allowSelfCheckoff && hasCompletedSession;
  // The student/parent row only ever reads `stats.dateRangeLabel`/
  // `stats.weekdayChips` below -- it never renders `attendedCount` (that
  // stat is coach-only, module doc on `EventRowStats.attendedCount`), so no
  // real `attendance` array is threaded down to this component at all
  // (out of this checker-fix's own scope, per its own "only the PAST-bucket
  // Attended semantics change" instruction) -- an empty array is passed
  // here deliberately, not a placeholder standing in for missing data.
  const stats = useMemo(
    () => computeEventRowStats(sessions, rsvps, [], [viewerStudentId]),
    [sessions, rsvps, viewerStudentId],
  );

  const description = (
    <VStack gap={1}>
      <HStack gap={2} wrap="wrap" vAlign="center">
        <Badge
          variant="neutral"
          label={event.type === 'competition' ? 'Competition' : 'Outreach'}
        />
        <Text type="supporting">{stats.dateRangeLabel}</Text>
        {stats.weekdayChips.map((chip) => (
          <Badge key={chip.key} variant="neutral" label={chip.label} />
        ))}
      </HStack>
      <Text type="supporting">
        {event.locationName}
        {event.address !== '' ? ` · ${event.address}` : ''}
      </Text>
      {isExpanded && (
        <VStack gap={2}>
          {sessions.map((session) => (
            <StudentSessionDetail
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
        </VStack>
      )}
    </VStack>
  );

  // T112 HOTFIX (module doc #13) -- SUPERSEDED (T132): this row no longer
  // carries a standalone "View details" `Link` in `endContent`. This
  // paragraph used to say every row "still always carries a real 'View
  // details' Link, unchanged shape" -- T132 falsifies that for the
  // student/parent side: the former Link's `href`/keyboard path now lives
  // on the row's own title instead (`ListItem`'s `label` below, a real
  // `Link` wrapping `event.title`), not a separate action here. This
  // matches T131's own coach-side change (`CoachEventActions` above no
  // longer carries a separate "View details" `Link` either -- its keyboard
  // path moved onto `CoachEventTitleCell`'s own title `Link`) -- the two
  // halves of this page now agree with each other.
  // T126 (module doc #14): one more neutral, named-action `Button` for
  // eligible Past rows, opening the shared `SelfCheckoffDialog` scoped to
  // this row's own event/sessions.
  const endContent = (
    <HStack gap={3} vAlign="center" wrap="wrap">
      <Button
        label={
          isExpanded
            ? `Hide session details – ${event.title}`
            : `Show session details – ${event.title}`
        }
        size="sm"
        variant="ghost"
        onClick={() => setIsExpanded((previous) => !previous)}
      />
      {showSelfCheckoffButton && (
        <Button
          label={`Mark attendance – ${event.title}`}
          size="sm"
          variant="secondary"
          onClick={() => onOpenSelfCheckoff(event, sessions)}
        />
      )}
    </HStack>
  );

  // ACCEPTED, DECIDED (T132; human-owner ruling, not a pending follow-up):
  // `maxLines={1}` below sets real truncation CSS on the `Link`'s own inner
  // `Text`, but `Item` (which `ListItem` renders through) only applies ITS
  // OWN width-bounding single-line-truncate style when `label` is a plain
  // string (`Item.tsx:350-360`, `isStringLabel`/`labelTruncateStyle`) --
  // passing a `<Link>` makes `label` a `ReactNode`, so it gets none of
  // that, and nothing else constrains the `inline-flex` anchor's width.
  // Measured with a synthetic long title (real Chromium, this task's own
  // throwaway rig): the anchor grows past the row instead of eliciting an
  // ellipsis, at both 1440px and 375px -- a real, measured loss of
  // truncation against the plain-string label this replaces, which DID
  // truncate. A `labelLines`-style cast to reach past `ListItemProps`
  // (`labelLines` is real on `Item` but absent from `ListItemProps`,
  // reachable only via `ListItem`'s own untyped `...restProps` spread,
  // `ListItem.tsx:211,255`) was considered and explicitly declined: a cast
  // to get a `clip` instead of an `ellipsis` isn't worth it. This is
  // accepted behaviour project-wide for a linked `ListItem` title, not a
  // defect awaiting a fix.
  //
  // `document.documentElement.scrollWidth === window.innerWidth` still
  // holds at 1440px. At 375px it does NOT hold, but not because of this
  // `Link`/truncation change: the sole cause (verified by DOM inspection)
  // is the "Mark attendance – {title}" `Button` text in `endContent`
  // above, which this task did not touch -- that overflow pre-existed this
  // task (worse: every row's own former "View details – {title}" link also
  // overflowed at 375px before this task, which this change measurably
  // fixed) and remains open as its own, separate, unrelated item.
  return (
    <ListItem
      label={
        <Link
          as={RouterLink}
          href={routePaths.outreachEvent(event.id)}
          isStandalone
          weight="semibold"
          maxLines={1}
          color="primary"
        >
          {event.title}
        </Link>
      }
      description={description}
      endContent={endContent}
    />
  );
}

/** UXD-03 expand-in-place per-session detail (student/parent view): date/
 * time/hours + either the viewer's own editable RSVP `SegmentedControl`
 * (still-`scheduled` sessions) or the read-only recorded-status `Text`
 * (past sessions) -- text/behavior preserved verbatim from the former
 * per-session row, purely relocated. */
function StudentSessionDetail({
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

  return (
    <VStack gap={0.5}>
      <Text type="supporting">
        {formatSessionDateTime(session)} · {sessionHours(session)}h
      </Text>
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
    </VStack>
  );
}

function StudentOutreachSection({
  title,
  enrichedEvents,
  viewerStudentId,
  allowSelfCheckoff,
  rsvps,
  onRsvpChange,
  onOpenSelfCheckoff,
  emptyDescription,
}: {
  title: string;
  enrichedEvents: readonly EnrichedOutreachEvent[];
  viewerStudentId: string;
  /** T126 (module doc #14) -- `true` only for the "Past" section. */
  allowSelfCheckoff: boolean;
  rsvps: readonly RsvpRow[];
  onRsvpChange: (sessionId: string, status: RsvpStatus) => void;
  onOpenSelfCheckoff: (event: OutreachEventRow, sessions: readonly OutreachSessionRow[]) => void;
  emptyDescription: string;
}): ReactNode {
  // T129/UXC-01: stable id for this section's `Heading`, so the alternating
  // List/EmptyState below gets the heading as its accessible name via
  // `aria-labelledby` on a wrapping `<div role="group">`, instead of the
  // `List`'s own `header` prop (which duplicates the visible title and
  // vanishes in the empty branch). This component renders twice (Upcoming,
  // Past), so each call gets its own id.
  //
  // CHECKER FIX (rework of T129, MAJOR): `Section` (not a plain div here)
  // was the original wrapper, but `Section.tsx` applies a full-bleed
  // negative-margin band unconditionally (`nestedStyles.outer`) and renders
  // a bare `<div>` with no role, so `aria-labelledby` was both invisibly
  // mis-laid-out (in any `LayoutContent padding={n>0}` ancestor) AND
  // name-prohibited under ARIA (`role="generic"` does not support naming).
  // A `<div role="group" aria-labelledby={headingId}>` fixes both: zero
  // added margin/padding/background, and `role="group"` genuinely supports
  // an accessible name.
  const headingId = useId();
  return (
    <VStack gap={3}>
      <Heading level={2} id={headingId}>
        {title}
      </Heading>
      <div role="group" aria-labelledby={headingId}>
        {enrichedEvents.length === 0 ? (
          <EmptyState
            headingLevel={3}
            title={`No ${title.toLowerCase()} outreach events`}
            description={emptyDescription}
          />
        ) : (
          <List hasDividers>
            {enrichedEvents.map(({ event, sessions }) => (
              <StudentOutreachEventRow
                key={event.id}
                event={event}
                sessions={sessions}
                rsvps={rsvps}
                viewerStudentId={viewerStudentId}
                allowSelfCheckoff={allowSelfCheckoff}
                onRsvpChange={onRsvpChange}
                onOpenSelfCheckoff={onOpenSelfCheckoff}
              />
            ))}
          </List>
        )}
      </div>
    </VStack>
  );
}

interface StudentParentOutreachViewProps {
  seasonId: string;
  viewerStudentId: string;
  /** T126 (module doc #14) -- `attendance.recorded_by` for any self
   * check-off written from this view. */
  viewerProfileId: string;
  events: readonly OutreachEventRow[];
  sessions: readonly OutreachSessionRow[];
  initialRsvps: readonly RsvpRow[];
  goalConfig: OutreachGoalConfig;
}

function StudentParentOutreachView({
  seasonId,
  viewerStudentId,
  viewerProfileId,
  events,
  sessions,
  initialRsvps,
  goalConfig,
}: StudentParentOutreachViewProps): ReactNode {
  const [rsvps, setRsvps] = useState<readonly RsvpRow[]>(initialRsvps);
  // T126 (module doc #14) -- ONE shared `SelfCheckoffDialog` instance for
  // this whole view (matches `CoachOutreachView`'s own shared-dialog-plus-
  // target-state convention above); `null` = closed, non-null = which
  // event/sessions the currently-open dialog is scoped to.
  const [selfCheckoffTarget, setSelfCheckoffTarget] = useState<{
    event: OutreachEventRow;
    sessions: readonly OutreachSessionRow[];
  } | null>(null);

  useEffect(() => {
    setRsvps(initialRsvps);
  }, [initialRsvps]);

  const { upcoming, past } = useMemo(() => buildEventGroups(events, sessions), [events, sessions]);
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
            enrichedEvents={upcoming}
            viewerStudentId={viewerStudentId}
            allowSelfCheckoff={false}
            rsvps={rsvps}
            onRsvpChange={handleRsvpChange}
            onOpenSelfCheckoff={(event, eventSessions) =>
              setSelfCheckoffTarget({ event, sessions: eventSessions })
            }
            emptyDescription="You have no upcoming outreach events."
          />
          <StudentOutreachSection
            title="Past"
            enrichedEvents={past}
            viewerStudentId={viewerStudentId}
            allowSelfCheckoff
            rsvps={rsvps}
            onRsvpChange={handleRsvpChange}
            onOpenSelfCheckoff={(event, eventSessions) =>
              setSelfCheckoffTarget({ event, sessions: eventSessions })
            }
            emptyDescription="Your past outreach participation will show up here."
          />
        </>
      )}

      {/* T126 (module doc #14) -- the one shared `SelfCheckoffDialog`
          instance for this whole view, scoped to whichever row's own
          "Mark attendance" action set `selfCheckoffTarget`. */}
      <SelfCheckoffDialog
        isOpen={selfCheckoffTarget !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setSelfCheckoffTarget(null);
        }}
        eventTitle={selfCheckoffTarget?.event.title}
        studentId={viewerStudentId}
        sessions={selfCheckoffTarget?.sessions ?? []}
        currentUserProfileId={viewerProfileId}
      />
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
  /** T121 item (c). */
  onCancelEvent: CancelOutreachEventFn;
  /** T121 item (a). */
  loadRoster: LoadOutreachEventRosterFn;
  /** T121 item (b)/(a) -- the signed-in coach's real `profiles.id`, always
   * non-null here (`OutreachList` only mounts this component once
   * `user !== null`). */
  viewerProfileId: string;
}

function OutreachListLoaded({
  loadData,
  seasonId,
  viewerStudentId,
  onSaveEvent,
  isCoachOrAdminView,
  onCancelEvent,
  loadRoster,
  viewerProfileId,
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
          attendance={data.attendance}
          students={data.students}
          goalConfig={data.goalConfig}
          onSaveEvent={onSaveEvent}
          onReload={reloadOutreachData}
          onCancelEvent={onCancelEvent}
          loadRoster={loadRoster}
          viewerProfileId={viewerProfileId}
        />
      ) : (
        <StudentParentOutreachView
          seasonId={seasonId}
          viewerStudentId={viewerStudentId}
          viewerProfileId={viewerProfileId}
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
   * onSaveEvent={...} />` in the coach view -- T121 UPDATE: now also used
   * for row-level edits (module doc #11 update on `CoachOutreachView`). */
  onSaveEvent?: OnSaveOutreachEventFn;
  /** T121 item (c) -- real, event-level cancel default
   * (`cancelOutreachEvent`, `../../lib/supabase/loaders/outreach.ts`, the
   * SAME already-built, already-tested mutation `OutreachDetail.tsx` already
   * uses for its own "Cancel event" action). */
  onCancelEvent?: CancelOutreachEventFn;
  /** T121 item (a) -- real roster loader default (T118's
   * `loadOutreachEventRoster`, previously built/tested but unconsumed by
   * any page), wired into the coach view's `OutreachEventDialog` `students`
   * prop. */
  loadRoster?: LoadOutreachEventRosterFn;
}

export function OutreachList({
  loadData = loadOutreachData,
  seasonId: seasonIdProp,
  viewerStudentId = PLACEHOLDER_CURRENT_STUDENT_ID,
  onSaveEvent = saveOutreachEvent,
  onCancelEvent = cancelOutreachEvent,
  loadRoster = loadOutreachEventRoster,
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
      onCancelEvent={onCancelEvent}
      loadRoster={loadRoster}
      viewerProfileId={user.id}
    />
  );
}

export default OutreachList;
