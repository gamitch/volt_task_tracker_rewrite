/**
 * T039: New/edit outreach event dialog (OUT-02), PRD line 293:
 *
 * "**OUT-02 New/edit outreach event** `Dialog` (parity with current app):
 * title, description, location name + address, category fixed `outreach`,
 * schedule mode (single / multi-day / recurring / custom dates ->
 * `event_sessions`), per-session start/end times, expected **people
 * reached** placeholder per day, adult volunteers (`NumberInput` x 2: count
 * and hours -- persisted on `events` for grant reporting), team scope,
 * **Share to calendar feed** on by default. Disabled **Create event** until
 * title + >= 1 dated session."
 *
 * PRD line 385 (constitution item 13, cited in this task's own packet):
 * "Dialog forms render fields **in the exact order listed** in MTG-02 ...
 * and OUT-02." The field order below is therefore literal: title ->
 * description -> location name + address -> type -> schedule mode ->
 * per-session start/end times + expected people reached -> adult volunteers
 * -> team scope -> share to calendar feed.
 *
 * This is a standalone dialog component with its own injectable
 * `onSaveEvent` prop and its own fixture team list (Forbidden Files /
 * Allowed Files) -- `OutreachList.tsx` (T038) is a forbidden/read-only file
 * here and is NOT wired to this dialog by this task (see `OutreachList.tsx`
 * module doc #8a: its own "New outreach event" button shows a disclosure
 * `Banner` instead of opening this component -- a future wiring task
 * connects them).
 *
 * -----------------------------------------------------------------------
 * 1. THE CENTRAL SPEC TENSION (Known Context/Traps #1) -- "category fixed
 *    `outreach`" (OUT-02's own literal text, quoted above) vs. a real type
 *    `Selector` that can also create `competition`-type events.
 *
 * Three real PRD/ledger statements are in tension for this exact file:
 *   (a) OUT-02's own text (quoted above): "category fixed `outreach`".
 *   (b) This task's own ledger Objective (`docs/swarm/task-ledger.md` line
 *       417): "...category, schedule mode, ... type `Selector` exposes
 *       `counts_participation`/`counts_volunteer_hours` flags only for
 *       competitions (CMP-01/02)".
 *   (c) CMP-01 (PRD line 303): "Competitions are `events.type='competition'`,
 *       created from Calendar or **Outreach's New event dialog** via a type
 *       `Selector` (admin/coach)." -- this is CMP-01 naming THIS dialog
 *       specifically (Outreach's New event dialog is OUT-02, there is no
 *       other outreach "new event" dialog in this codebase) as the place a
 *       competition-creating type `Selector` lives.
 *
 * Resolution chosen: **the type `Selector` is real and DOES include
 * `'outreach'` (default) and `'competition'` as options** (`'meeting'` is
 * deliberately excluded -- meetings have their own separate dialog,
 * `ScheduleMeetingsDialog.tsx`/T031, so a meeting option here would let two
 * different dialogs create the same event type, which nothing in the PRD
 * asks for). Reasoning: (b) and (c) are both explicit, structural,
 * unambiguous requirements naming this exact file and its exact prop
 * surface (`counts_participation`/`counts_volunteer_hours` flags, a type
 * `Selector`); (a) is OUT-02's own short-form category summary in a section
 * that is describing the *common case* of this dialog (an outreach team
 * mostly creates outreach events here), not a technical constraint that
 * would leave CMP-01's own explicit sentence about this dialog
 * unimplementable anywhere in the app. Treating (a) as a hard constraint
 * would make (c) impossible to satisfy by ANY file in this codebase
 * (Calendar itself does not exist as a page in this batch's routes), which
 * is a strong signal (a) is the looser, non-literal statement of the two.
 * The type `Selector` below therefore defaults to `'outreach'` (so the
 * common case OUT-02 describes needs zero extra clicks -- "category fixed
 * outreach" is true BY DEFAULT, not true as a hard technical constraint)
 * while still allowing `'competition'` per CMP-01's explicit instruction.
 * This is a disclosed judgment call on a genuine spec tension, not a
 * silently-picked interpretation -- flagged for Foreman/Boss review; no
 * dispute filed by this worker (see "Known risks" in this task's worker
 * output for why this is disclosure, not a blocker).
 *
 * -----------------------------------------------------------------------
 * 2. CMP-02 flag gating (Known Context/Traps #2) -- fixed values sourced
 *    from `scripts/migrate/transform.ts`'s own `eventTypeMetricDefaults`
 *    (lines 102-114, read-only reference, not imported -- this dialog has
 *    no dependency on the migration ETL script), the one place in this
 *    codebase that already resolved CMP-02's literal
 *    "fixed true/false for meetings/outreach respectively" text into
 *    concrete booleans: `meeting -> {true, false}`,
 *    `outreach -> {false, true}`, `competition -> {false, false}` (default,
 *    admin-editable). `OUTREACH_FIXED_FLAGS` below matches the `outreach`
 *    row of that table exactly (not re-decided independently). Since this
 *    dialog's type `Selector` only ever offers `'outreach'`/`'competition'`
 *    (module doc #1), `resolveEventTypeFlags` only needs those two branches.
 *    `counts_participation`/`counts_volunteer_hours` `Switch` toggles are
 *    rendered ONLY when `type === 'competition'` (both default `false` per
 *    CMP-02's own text) -- for `type === 'outreach'` the flags are computed
 *    silently from `OUTREACH_FIXED_FLAGS` and never shown as editable
 *    controls (grep-provable: the two `Switch` elements below are the only
 *    UI for these flags in this file, and they sit inside a
 *    `type === 'competition'` guard).
 *
 * -----------------------------------------------------------------------
 * 3. `event_sessions.notes` nullability (Known Context/Traps #3) -- resolved
 *    IDENTICALLY to T031's `ScheduleMeetingsDialog.tsx` precedent (per this
 *    task's own packet instruction to match it exactly, not re-decide it).
 *
 * `supabase/migrations/20260717000000_scheduling_attendance.sql` line 61
 * defines `event_sessions.notes text not null` with no default.
 * `docs/swarm/archive/T031-worker-packet.md`'s Known Context/Traps #1 chose
 * option (a): always supply a value, never a migration.
 * `buildOutreachSessionsPayload` below always includes `notes: ''` (OUT-02
 * has no notes field in its own spec at all, unlike MTG-02, so there is no
 * user-facing value to carry through -- every session this dialog produces
 * satisfies the `not null` constraint with a disclosed empty-string
 * stand-in, same treatment T031 already established for its own
 * not-collected `events.description`/`events.address` columns). No new
 * migration is shipped by this task, and the T010 migration file itself is
 * untouched (read-only per Forbidden Files / constitution item 10). `git
 * log --oneline -- supabase/migrations/` was checked again for this task
 * (result unchanged since T031's own check: only T009/T010/T011/T012/T013/
 * T019 migrations exist -- no redundant/conflicting migration has landed).
 *
 * -----------------------------------------------------------------------
 * 4. BEH-07 confirm button (Known Context/Traps #4, PRD line 236) --
 *    checker-enforced, not cosmetic.
 *
 * This task's own packet Known Context/Traps #4 requires the literal text
 * '"Create event" (or an edit-mode equivalent), never a bare
 * "Submit"/"OK"'. `computeConfirmLabel` below satisfies that literally
 * ("Create event" for new events, "Save changes" for edit mode -- module
 * doc #8) AND additionally states the computed session count per BEH-07's
 * own general rule ("Confirm buttons state their computed outcome: 'Create
 * 14 meetings'...") -- "Create event -- 3 sessions" / "Save changes -- 1
 * session", never a bare "Create event"/"Save changes" alone. The em dash
 * separator matches this codebase's own established prose style
 * (`OutreachList.tsx` uses the same character in row descriptions, e.g.
 * `{formatSessionDateTime(session)} — {event.locationName}`) -- not a
 * box-drawing/bracket wireframe artifact (constitution item 13, which
 * targets literal ASCII-art wireframe rendering in the DOM, not ordinary
 * punctuation in prose).
 *
 * -----------------------------------------------------------------------
 * 5. "Disabled until title + >=1 dated session" (Known Context/Traps #5) --
 *    genuinely non-interactive, not just styled, same discipline
 *    `ScheduleMeetingsDialog.tsx`/T031 already established.
 *
 * The confirm `Button` below is given `isDisabled` with NO `tooltip` prop --
 * per the Button doc's own Props table, the absence of `tooltip` means a
 * real native HTML `disabled` attribute is rendered (not merely styled),
 * which the browser refuses to dispatch click events through at all.
 * `isValid` (title trimmed non-empty AND >=1 fully-formed session -- see
 * module doc #6) is the only thing gating it, proven for multiple schedule
 * modes in the test file.
 *
 * -----------------------------------------------------------------------
 * 6. Why "dated session" here means date + start/end time, not date alone.
 *
 * A bare calendar date cannot produce a valid `event_sessions` row --
 * `starts_at`/`ends_at` are both `timestamptz not null` (migration lines
 * 57-58). `buildOutreachSessionsPayload` below skips any date whose
 * per-session `startTime`/`endTime` is still `undefined`, so the confirm
 * button stays disabled in that case too. Every generated date gets a smart
 * BEH-07 default time (`DEFAULT_START_TIME`/`DEFAULT_END_TIME`, 9:00 AM-12:00
 * PM -- a disclosed daytime stand-in distinct from `ScheduleMeetingsDialog`'s
 * evening default, since outreach events skew daytime vs. evening team
 * meetings, per BEH-07's own "most common value" guidance) the moment the
 * date is added, via `syncSessionDetails`, so a user has to deliberately
 * clear a time field to reach the invalid state.
 *
 * -----------------------------------------------------------------------
 * 7. "Share to calendar feed" -- disclosed UI-only field, no backing
 *    `events` column exists yet.
 *
 * `supabase/migrations/20260717000000_scheduling_attendance.sql` (events
 * table, lines 33-48) has no per-event calendar-feed opt-out/opt-in column;
 * the only calendar-feed-related table in this schema is
 * `calendar_feeds` (`20260717000001_support_audit.sql`), which is a
 * per-profile subscription token, not a per-event flag. `shareToCalendarFeed`
 * is therefore carried on the `CreateOutreachEventPayload` this dialog
 * produces (default `true`, matching OUT-02's own "on by default" text) as
 * a disclosed placeholder for a future consumer/migration to interpret --
 * never assumed to already have a real column, and no migration is written
 * here to invent one (out of this task's Allowed Files).
 *
 * -----------------------------------------------------------------------
 * 8. Edit mode -- the "New/edit" half of this task's Objective.
 *
 * `initialEvent` (optional prop) pre-fills every field from an existing
 * event + its sessions when present; its absence means "new event" mode.
 * In edit mode, existing sessions are loaded into "Custom dates" schedule
 * mode (the most flexible mode -- lets a coach add/remove/retime individual
 * days of an existing multi-day outreach event without forcing it back
 * through a recurring/multi-day-range regeneration that could silently drop
 * a day that no longer fits a clean range). `isEditMode` drives both the
 * dialog title ("Edit outreach event" vs. "New outreach event") and the
 * confirm button verb (module doc #4).
 *
 * -----------------------------------------------------------------------
 * 9. No shared Supabase client wired in (Known Context/Traps #7) --
 *    deliberate scope, not a gap for this task to solve.
 *
 * The real `events`/`event_sessions` INSERT/UPDATE is an injectable
 * `onSaveEvent: (payload) => Promise<void>` prop, defaulting to
 * `defaultOnSaveEvent`, an obviously-fake stub that only `console.warn`s the
 * payload it would have persisted. Same posture as every prior content page
 * (`ScheduleMeetingsDialog.tsx`'s `onCreateMeetings`, `OutreachList.tsx`'s
 * `loadData`, etc.).
 *
 * -----------------------------------------------------------------------
 * 10. Astryx prop sourcing (constitution item 2) -- every prop below,
 *     cross-checked directly against `docs/swarm/astryx-api.md` (grepped
 *     live for this task):
 *
 *  - `Dialog` (line 2344 section, Props table): `isOpen`, `onOpenChange`,
 *    `children`, `purpose` ("form") used.
 *  - `DialogHeader`: doc's own "Components > DialogHeader" subsection is
 *    `undefined` (same disclosed gap `ScheduleMeetingsDialog.tsx`/T031 and
 *    every other dialog/page in this batch already hit) -- props taken from
 *    the "Dialog" section's own worked `## Example` code block (`title`,
 *    `onOpenChange`).
 *  - `Layout`/`LayoutContent`/`LayoutFooter` (line 167 section + own
 *    `undefined` Components subsections, same as `ScheduleMeetingsDialog.tsx`):
 *    `header`, `content`, `footer` (Layout); `children` (LayoutContent);
 *    `children`, `hasDivider` (LayoutFooter) used.
 *  - `FormLayout` (line 4128 section, Props table): `children` used
 *    (default `direction="vertical"`).
 *  - `TextInput` (line 1611 section, Props table): `label`, `value`,
 *    `onChange`, `isRequired`, `isOptional`, `placeholder` used.
 *  - `TextArea` (line 1542 section, Props table): `label`, `value`,
 *    `onChange`, `isOptional`, `rows` used.
 *  - `Selector` (line 1303 section, Props table): `label`, `options`,
 *    `value`, `onChange` used.
 *  - `Switch` (line 1471 section, Props table): `label`, `value`,
 *    `onChange`, `description` used.
 *  - `NumberInput` (line 1143 section, Props table): `label`, `value`,
 *    `onChange`, `min`, `step`, `units`, `isIntegerOnly`, `isOptional`,
 *    `hasClear` used.
 *  - `SegmentedControl`/`SegmentedControlItem` (line 5575 section + own
 *    `undefined` Components subsection, cross-checked via
 *    `node_modules/@astryxdesign/core/dist/SegmentedControl/
 *    SegmentedControlItem.d.ts`, same as `ScheduleMeetingsDialog.tsx`):
 *    `value`, `onChange`, `label`, `children` (SegmentedControl); `value`,
 *    `label` (SegmentedControlItem) used.
 *  - `DateInput` (line 977 section, Props table): `label`, `value`,
 *    `onChange`, `isRequired` used.
 *  - `TimeInput` (line 1686 section, Props table): `label`, `value`,
 *    `onChange`, `isRequired` used.
 *  - `DateRangeInput` (line 3786 section, Props table): `label`, `value`,
 *    `onChange`, `presets` used.
 *  - `CheckboxList`/`CheckboxListItem` (line 3278 section + own `undefined`
 *    Components subsection, cross-checked via
 *    `node_modules/@astryxdesign/core/dist/CheckboxList/
 *    CheckboxListItem.d.ts`, same as `ScheduleMeetingsDialog.tsx`): `label`,
 *    `value`, `onChange`, `hasDividers` (CheckboxList); `label`, `value`
 *    (CheckboxListItem) used.
 *  - `MultiSelector` (line 4828 section, Props table): `label`, `options`,
 *    `value`, `onChange`, `hasSelectAll`, `triggerDisplay="labels"` used.
 *  - `List`/`ListItem` (line 4536 section, Props table + own `undefined`
 *    `ListItem` Components subsection, cross-checked via
 *    `node_modules/@astryxdesign/core/dist/List/ListItem.d.ts`, same as
 *    `ScheduleMeetingsDialog.tsx`): `hasDividers`, `header`, `children`
 *    (List); `label`, `endContent` (ListItem) used.
 *  - `Button` (line 1768 section, Props table): `label`, `variant`, `size`,
 *    `isDisabled`, `onClick`, `clickAction` used (deliberately no `tooltip`
 *    on the disabled confirm button -- module doc #5).
 *  - `Banner` (line 2694 section, Props table): `status`, `title`,
 *    `description` used (submit-error state only).
 *  - `HStack`/`VStack` ("Stack" section, `HStack`/`VStack` subsections):
 *    `gap`, `vAlign`, `wrap` used.
 *  - `Text` (line 829 section, Props table): `type="supporting"` used.
 *
 * -----------------------------------------------------------------------
 * 11. T118 (UXP-02) -- "Expected attendees" roster checklist + planned-RSVP
 *     fan-out. New scope on top of T039's original OUT-02 field set.
 *
 * 11a. RSVP DDL findings (read directly, not assumed, per this task's own
 * packet Trap #1) -- `supabase/migrations/20260717000000_scheduling_
 * attendance.sql` lines 67-76: `rsvps` has `status text not null check
 * (status in ('going', 'maybe', 'declined'))`, `responded_by uuid
 * references public.profiles (id) on delete restrict` (nullable), and
 * `unique (session_id, student_id)` -- exactly the conflict target
 * `submitRsvpChange` (`../../lib/supabase/loaders/outreach.ts`) already
 * upserts on. "Planned RSVP" = `status = 'going'` (the only status this
 * checklist ever writes -- checking someone off never writes `'maybe'`/
 * `'declined'`, module doc below). `supabase/migrations/
 * 20260717000002_rls.sql` lines 197-199: `staff_all` on `rsvps` is `for all
 * ... using (is_staff()) with check (is_staff())` -- covers INSERT/UPDATE/
 * DELETE for staff, already verified real (T114/SCH-04), so the loader's new
 * delete-of-stale-staff-entered-rows step (module doc 11d below) needs no
 * new policy.
 *
 * 11b. Field placement -- "Expected attendees" is NOT part of OUT-02's own
 * literal field-order list (module doc at the top of this file quotes it in
 * full; it predates UXP-02). Placed AFTER "Team scope" and BEFORE "Share to
 * calendar feed": the checklist's own roster is scoped to whichever teams
 * are currently selected (Known Context/Traps #4 of this task's packet --
 * "scoped to the dialog's selected teams"), so it must render after that
 * value is already resolved; the capability map's own "New event form"
 * description (`docs/swarm/current-app-capability-map.md` line 65) also
 * lists "Expected attendees" near the end of the form, after "Adult
 * volunteers count". This is an additive field, not a reordering of any
 * existing OUT-02 field -- the exact top-level field-order test
 * (`OutreachEventDialog.test.tsx`) is updated to include it: the section's
 * own TEAM-level group headers ("Ravens"/"Titans") do NOT add `<label>`
 * entries (module doc 11c explains why), but each individual roster row
 * DOES -- `CheckboxListItem` composes a real `CheckboxInput` internally
 * (`isLabelHidden: true` only visually hides it via CSS, the `<label
 * htmlFor>` element itself is still real and present, same accessible-name
 * discipline every other checkbox/radio control in this design system
 * already follows) -- confirmed directly against the fixture's own default
 * roster (`DEFAULT_STUDENTS`, module doc 11e) when this task's own test
 * first ran red. The default (all-teams-selected) state therefore inserts
 * four individual student labels between "Team scope" and "Share to
 * calendar feed" -- a real, disclosed, deliberately-updated expectation, not
 * a pre-existing gap papered over.
 *
 * 11c. "Team chip groups" -- no dedicated `Chip`/`Badge`/`Tag` component
 * exists anywhere in `docs/swarm/astryx-api.md` (grepped live for this task,
 * zero matches). One `CheckboxList` per team, its own `label` prop set to
 * the team's name, is the group-header treatment this same file already
 * established for "Repeat on" (module doc #10's own Astryx citation) -- and
 * per `CheckboxList`'s real implementation
 * (`node_modules/@astryxdesign/core/dist/CheckboxList/CheckboxList.js`,
 * `Field`'s `isGroupLabel: true`), that GROUP label renders a `<span>`, NOT
 * a `<label htmlFor>` (`FieldLabel.js` line 57:
 * `const LabelElement = isGroupLabel ? 'span' : 'label'`) -- so team NAMES
 * never appear in the exact top-level `<label>` order test, same as
 * "Repeat on"/"Schedule mode" already don't (module doc 11b above has the
 * correction for the individual ITEM labels, which do appear). Every
 * `CheckboxList` in this section shares ONE `value`/`onChange` pair
 * (`expectedStudentIds` state) -- verified correct against
 * `CheckboxListItem.js`'s own toggle logic
 * (`ctx.onChange?.([...ctx.value, value], value)`), which always operates on
 * the FULL array the enclosing `CheckboxList` was given, not a value
 * filtered to that group's own children -- so toggling one team's student
 * never drops another team's already-checked picks.
 *
 * 11d. Trap #2 rules, as implemented (worker packet's own load-bearing
 * text, quoted): "unchecking removes only staff-entered planned RSVPs,
 * NEVER a student's own RSVP." The real reconciliation math lives in
 * `../../lib/supabase/loaders/outreach.ts`'s own new, independently-tested
 * pure function `computeExpectedAttendeeRsvpPlan` (that file's own module
 * doc has the full writeup); THIS file's only job is producing the two
 * payload fields that function needs:
 *   - `expectedStudentIds`: the checklist's checked ids, SANITIZED at
 *     submit time (`resolveExpectedAttendeeIds` below) against whichever
 *     roster rows are currently VISIBLE (active + on a currently-selected
 *     team) -- a student hidden by a team-scope change is dropped from the
 *     submitted set rather than silently carried through unioned with
 *     whatever is on screen.
 *   - `respondedBy`: `currentUserProfileId` (new injectable prop, same
 *     auth-seam pattern `RsvpControl.tsx`'s `currentUserProfileId`/
 *     `MarkDayCompleteDialog.tsx`'s `currentUserProfileId` already
 *     established), defaulting to `PLACEHOLDER_CURRENT_COACH_PROFILE_ID`
 *     below -- deliberately the SAME literal value
 *     `MarkDayCompleteDialog.tsx`'s own `PLACEHOLDER_CURRENT_COACH_PROFILE_ID`
 *     uses (`'profile-placeholder-current-coach'`), since both dialogs are
 *     coach-only surfaces attributing a write to the identical real-world
 *     actor (unlike `RsvpControl.tsx`'s own placeholder, which is a
 *     student/parent viewer and deliberately uses a DIFFERENT literal per
 *     that file's own module doc #7). Declared locally in this file (not
 *     imported from `MarkDayCompleteDialog.tsx`) -- same "no cross-dialog
 *     import" convention every sibling dialog in this directory already
 *     follows.
 *   Both fields are OPTIONAL on `SaveOutreachEventPayload` (never
 *   `undefined` when the payload actually comes from THIS component's own
 *   `handleSubmit`, which always populates them) specifically so pre-
 *   existing loader-level tests that construct a bare `{event, sessions}`
 *   payload literal (`OutreachList.test.tsx`/`OutreachDetail.test.tsx`,
 *   both out of this task's own Allowed Files) keep compiling and passing
 *   unchanged -- `makeSaveOutreachEvent`'s own module doc documents the
 *   corresponding `undefined` = "skip roster reconciliation entirely"
 *   backward-compatibility guard on the read side.
 *
 * 11e. Roster source (Known Context/Traps #4) -- `students` is a new,
 * OPTIONAL prop defaulting to `DEFAULT_STUDENTS`, a standalone fabricated
 * fixture (constitution item 6) -- same "independent duplicate, not a
 * shared import" precedent this file's own `DEFAULT_TEAMS` already
 * established (module doc above `DEFAULT_TEAMS`'s own declaration:
 * `OutreachList.tsx`'s fixtures are a forbidden/read-only file here). The
 * REAL reuse of `loaders/students.ts` this task's packet asks for
 * ("reuse exportable pieces of loaders/students.ts... rather than
 * duplicating mapping logic") lives in `../../lib/supabase/loaders/
 * outreach.ts`'s own new `makeLoadOutreachEventRoster`/
 * `loadOutreachEventRoster`, which wraps that file's own already-real
 * `makeLoadStudentsTabData` (T089) rather than re-querying/re-mapping the
 * `students` table here -- a ready, real default for this component's
 * `students` prop that NO page wires in yet (`OutreachList.tsx`/
 * `OutreachDetail.tsx` page-level wiring is out of this task's own Allowed
 * Files, same disclosed-scope posture `submitRsvpChange`/`markDayComplete`
 * already had before their own later wiring tasks landed).
 *
 * 11f. Edit-mode prefill -- `ExistingOutreachEvent` gains one new OPTIONAL
 * field, `expectedStudentIds?: readonly string[]`. Optional specifically so
 * `OutreachDetail.tsx`'s own `buildInitialOutreachEvent` (forbidden file,
 * unmodified by this task, concurrently being touched by sibling T117) does
 * not need to supply it to keep type-checking -- an edit-mode open with no
 * `expectedStudentIds` on `initialEvent` simply prefills an empty checklist
 * (a real, disclosed, honest gap: this page doesn't yet resolve "who
 * currently has a planned RSVP" into this prop; a future wiring task would
 * derive it from that event's real `rsvps` rows, status `'going'`, same
 * shape `resolveExpectedAttendeeIds` already expects).
 *
 * 11g. Non-atomicity disclosure (Trap #3) -- the RSVP reconciliation this
 * task adds is one MORE sequential, non-transactional Postgrest step tacked
 * onto `makeSaveOutreachEvent`'s already-disclosed create/edit sequence
 * (that file's own module doc 7 has the full writeup) -- no new transaction
 * is invented; a failure partway through
 * (event/sessions written, RSVP fan-out rejected) leaves the event/sessions
 * committed with a stale/incomplete roster, surfaced to the coach as the
 * same real, unmasked `SupabaseLoaderError` `handleSubmit`'s existing
 * `catch` block already renders in the submit-error `Banner`.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Banner,
  Button,
  CheckboxList,
  CheckboxListItem,
  DateInput,
  DateRangeInput,
  Dialog,
  DialogHeader,
  FormLayout,
  HStack,
  Layout,
  LayoutContent,
  LayoutFooter,
  List,
  ListItem,
  MultiSelector,
  NumberInput,
  SegmentedControl,
  SegmentedControlItem,
  Selector,
  Switch,
  Text,
  TextArea,
  TextInput,
  TimeInput,
  VStack,
  createISOTimeString,
  type DateRange,
  type ISODateString,
  type ISOTimeString,
} from '@astryxdesign/core';

// ---------------------------------------------------------------------------
// Types -- verbatim camelCase shapes of the real `events`/`event_sessions`
// columns this dialog's field set collects, plus the disclosed
// `shareToCalendarFeed` UI-only field (module doc #7).
// ---------------------------------------------------------------------------

/** Module doc #1 -- `'meeting'` deliberately excluded from this dialog's own
 * type `Selector`; meetings have their own separate dialog. */
export type OutreachDialogEventType = 'outreach' | 'competition';

export type OutreachScheduleMode = 'single' | 'multiDay' | 'recurring' | 'custom';

export interface OutreachTeamOption {
  id: string;
  name: string;
}

/** T118 (UXP-02) module doc 11e -- roster row shape for the "Expected
 * attendees" checklist. `isActive` is carried through explicitly (not
 * assumed) so `groupActiveRosterByTeam` below is provably filtering it, not
 * silently trusting every row it's handed to already be active. */
export interface OutreachRosterStudent {
  id: string;
  name: string;
  teamId: string;
  isActive: boolean;
}

export interface OutreachSessionDetail {
  startTime: ISOTimeString | undefined;
  endTime: ISOTimeString | undefined;
  peopleReached: number | null;
}

export interface CreateOutreachEventPayload {
  /** Present only when editing an existing event (module doc #8). */
  id?: string;
  title: string;
  description: string;
  locationName: string;
  address: string;
  type: OutreachDialogEventType;
  countsParticipation: boolean;
  countsVolunteerHours: boolean;
  /** `null` = all teams (matches `events.team_ids` NULL semantics). */
  teamIds: string[] | null;
  adultVolunteersCount: number;
  adultVolunteerHours: number;
  /** Module doc #7 -- disclosed UI-only field, no backing `events` column. */
  shareToCalendarFeed: boolean;
}

export interface CreateOutreachSessionPayload {
  sessionDate: string;
  startsAt: string;
  endsAt: string;
  /** Module doc #3 -- Trap #3 resolution: always a string, never `null`/`undefined`. */
  notes: string;
  peopleReached: number | null;
}

export interface SaveOutreachEventPayload {
  event: CreateOutreachEventPayload;
  sessions: CreateOutreachSessionPayload[];
  /** T118 (UXP-02) module doc 11d -- checked-roster student ids, already
   * sanitized against the currently-visible roster (`resolveExpectedAttendeeIds`
   * below). `undefined` only for callers that never supply roster info at
   * all (back-compat, module doc 11d); this component's own `handleSubmit`
   * always populates it (an empty array when nothing is checked). */
  expectedStudentIds?: readonly string[];
  /** T118 (UXP-02) module doc 11d -- the acting coach's real `profiles.id`,
   * written verbatim to `rsvps.responded_by` for every fanned-out row. */
  respondedBy?: string;
}

export type OnSaveOutreachEventFn = (payload: SaveOutreachEventPayload) => Promise<void>;

export interface ExistingOutreachEventSession {
  sessionDate: string;
  /** `'HH:MM'` wall-clock time, America/Chicago (NFR-09). */
  startTime: string;
  endTime: string;
  peopleReached: number | null;
}

/** Module doc #8 -- passed as `initialEvent` to open the dialog in edit mode. */
export interface ExistingOutreachEvent {
  id: string;
  title: string;
  description: string;
  locationName: string;
  address: string;
  type: OutreachDialogEventType;
  countsParticipation: boolean;
  countsVolunteerHours: boolean;
  teamIds: string[] | null;
  adultVolunteersCount: number;
  adultVolunteerHours: number;
  shareToCalendarFeed: boolean;
  sessions: readonly ExistingOutreachEventSession[];
  /** T118 (UXP-02) module doc 11f -- optional (back-compat, see that module
   * doc) prefill for the "Expected attendees" checklist: the student ids
   * that currently have a planned (`status='going'`) RSVP for this event.
   * Absent/`undefined` prefills an empty checklist. */
  expectedStudentIds?: readonly string[];
}

// ---------------------------------------------------------------------------
// Fixture teams (constitution item 6: fabricated names only). Standalone
// default -- `OutreachList.tsx`'s own student/event fixtures are a
// forbidden/read-only file here, so this is a deliberate, independent
// duplicate reusing the same fabricated team identities
// `ScheduleMeetingsDialog.tsx` established (Ravens/Titans are the same
// fictional team's real roster across both dialogs), not a shared import.
// ---------------------------------------------------------------------------

const DEFAULT_TEAMS: readonly OutreachTeamOption[] = [
  { id: 'team-ravens', name: 'Ravens' },
  { id: 'team-titans', name: 'Titans' },
];

/** T118 (UXP-02) module doc 11e -- standalone fabricated roster fixture
 * (constitution item 6), same "independent duplicate, not a shared import"
 * precedent `DEFAULT_TEAMS` above already established. */
const DEFAULT_STUDENTS: readonly OutreachRosterStudent[] = [
  { id: 'student-ravens-1', name: 'Riley Chen', teamId: 'team-ravens', isActive: true },
  { id: 'student-ravens-2', name: 'Jordan Blake', teamId: 'team-ravens', isActive: true },
  { id: 'student-titans-1', name: 'Sam Okafor', teamId: 'team-titans', isActive: true },
  { id: 'student-titans-2', name: 'Casey Nguyen', teamId: 'team-titans', isActive: true },
];

/** T118 (UXP-02) module doc 11d -- same literal value
 * `MarkDayCompleteDialog.tsx`'s own `PLACEHOLDER_CURRENT_COACH_PROFILE_ID`
 * uses, deliberately (both are coach-only surfaces attributing a write to
 * the same real-world actor); declared locally, not imported (module doc
 * 11d). */
export const PLACEHOLDER_CURRENT_COACH_PROFILE_ID = 'profile-placeholder-current-coach';

// Module doc #6 -- BEH-07 smart default, daytime (distinct from
// ScheduleMeetingsDialog's evening default), stand-in for "creator's
// last-used time" since no persisted per-creator history exists yet.
const DEFAULT_START_TIME: ISOTimeString | undefined = createISOTimeString('09:00') ?? undefined;
const DEFAULT_END_TIME: ISOTimeString | undefined = createISOTimeString('12:00') ?? undefined;

const WEEKDAY_OPTIONS: ReadonlyArray<{ value: string; label: string; dayIndex: number }> = [
  { value: 'mon', label: 'Mon', dayIndex: 1 },
  { value: 'tue', label: 'Tue', dayIndex: 2 },
  { value: 'wed', label: 'Wed', dayIndex: 3 },
  { value: 'thu', label: 'Thu', dayIndex: 4 },
  { value: 'fri', label: 'Fri', dayIndex: 5 },
  { value: 'sat', label: 'Sat', dayIndex: 6 },
  { value: 'sun', label: 'Sun', dayIndex: 0 },
];

// ---------------------------------------------------------------------------
// CMP-02 fixed flag defaults (module doc #2) -- matches
// `scripts/migrate/transform.ts`'s `eventTypeMetricDefaults` `outreach` row
// exactly (read-only reference, not imported, not re-decided).
// ---------------------------------------------------------------------------

const OUTREACH_FIXED_FLAGS = {
  countsParticipation: false,
  countsVolunteerHours: true,
} as const;

/** Module doc #2 -- the ONLY place `counts_participation`/
 * `counts_volunteer_hours` are resolved in this file. For `'outreach'`,
 * always the fixed pair above; for `'competition'`, whatever the (default
 * `false`/`false`) admin-editable toggles currently hold. */
export function resolveEventTypeFlags(
  type: OutreachDialogEventType,
  competitionFlags: { countsParticipation: boolean; countsVolunteerHours: boolean },
): { countsParticipation: boolean; countsVolunteerHours: boolean } {
  return type === 'competition' ? competitionFlags : OUTREACH_FIXED_FLAGS;
}

// ---------------------------------------------------------------------------
// Date helpers -- necessarily reimplemented (not imported) since
// `OutreachList.tsx`/`ScheduleMeetingsDialog.tsx` (both of which established
// the same noon-UTC trick) are forbidden/read-only files for this task.
// ---------------------------------------------------------------------------

function parseDateOnly(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

const RECURRING_RANGE_PRESETS: ReadonlyArray<{ label: string; getRange: () => DateRange }> = [
  {
    label: 'Next 6 weeks',
    getRange: () => {
      const start = toIsoDate(parseDateOnly(new Date().toISOString().slice(0, 10)));
      const end = toIsoDate(addDays(parseDateOnly(start), 41)); // 6 full weeks inclusive.
      return { start, end } as DateRange;
    },
  },
];

const MULTI_DAY_RANGE_PRESETS: ReadonlyArray<{ label: string; getRange: () => DateRange }> = [
  {
    label: 'Next 3 days',
    getRange: () => {
      const start = toIsoDate(parseDateOnly(new Date().toISOString().slice(0, 10)));
      const end = toIsoDate(addDays(parseDateOnly(start), 2)); // 3 calendar days inclusive.
      return { start, end } as DateRange;
    },
  },
];

// ---------------------------------------------------------------------------
// Pure session-date generators -- one per schedule mode, independently
// exported/testable (same discipline `ScheduleMeetingsDialog.tsx` established).
// ---------------------------------------------------------------------------

/** "Single" mode -- exactly one date, or none. */
export function generateSingleSessionDates(date: string | undefined): string[] {
  return date === undefined ? [] : [date];
}

/** "Multi-day" mode -- EVERY calendar day in `[range.start, range.end]`
 * (both boundaries inclusive), unlike "Recurring" this is NOT filtered by
 * weekday -- a genuinely consecutive multi-day outreach event. */
export function generateMultiDaySessionDates(
  range: { start: string; end: string } | null,
): string[] {
  if (range === null) return [];
  const start = parseDateOnly(range.start);
  const end = parseDateOnly(range.end);
  if (start.getTime() > end.getTime()) return [];
  const dates: string[] = [];
  for (let cursor = start; cursor.getTime() <= end.getTime(); cursor = addDays(cursor, 1)) {
    dates.push(toIsoDate(cursor));
  }
  return dates;
}

/** "Recurring" mode -- every date in `[range.start, range.end]` (BOTH
 * boundaries inclusive) whose weekday is in `weekdayValues`. */
export function generateRecurringSessionDates(
  range: { start: string; end: string } | null,
  weekdayValues: readonly string[],
): string[] {
  if (range === null || weekdayValues.length === 0) return [];
  const dayIndices = new Set(
    weekdayValues
      .map((value) => WEEKDAY_OPTIONS.find((option) => option.value === value)?.dayIndex)
      .filter((dayIndex): dayIndex is number => dayIndex !== undefined),
  );
  const start = parseDateOnly(range.start);
  const end = parseDateOnly(range.end);
  if (start.getTime() > end.getTime()) return [];

  const dates: string[] = [];
  for (let cursor = start; cursor.getTime() <= end.getTime(); cursor = addDays(cursor, 1)) {
    if (dayIndices.has(cursor.getUTCDay())) {
      dates.push(toIsoDate(cursor));
    }
  }
  return dates;
}

/** "Custom dates" mode -- de-duplicated, sorted list of explicitly picked dates. */
export function generateCustomSessionDates(dates: readonly string[]): string[] {
  return Array.from(new Set(dates)).sort();
}

export interface OutreachScheduleDatesInput {
  mode: OutreachScheduleMode;
  singleDate: string | undefined;
  multiDayRange: { start: string; end: string } | null;
  recurringRange: { start: string; end: string } | null;
  recurringWeekdays: readonly string[];
  customDates: readonly string[];
}

/** The only function in this file that branches on `mode`. */
export function computeOutreachScheduleSessionDates(input: OutreachScheduleDatesInput): string[] {
  switch (input.mode) {
    case 'single':
      return generateSingleSessionDates(input.singleDate);
    case 'multiDay':
      return generateMultiDaySessionDates(input.multiDayRange);
    case 'recurring':
      return generateRecurringSessionDates(input.recurringRange, input.recurringWeekdays);
    case 'custom':
      return generateCustomSessionDates(input.customDates);
    default: {
      const exhaustive: never = input.mode;
      return exhaustive;
    }
  }
}

// ---------------------------------------------------------------------------
// America/Chicago wall-clock -> UTC conversion (NFR-09), reimplemented (not
// imported) for the same reason as the date helpers above.
// ---------------------------------------------------------------------------

const CHICAGO_TIME_ZONE = 'America/Chicago';

function getTimeZoneOffsetMinutes(timeZone: string, date: Date): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  const parts = formatter.formatToParts(date);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );
  return (asUtc - date.getTime()) / 60000;
}

export function chicagoWallTimeToUtcIso(dateStr: string, timeStr: string): string {
  const naiveUtc = new Date(`${dateStr}T${timeStr}:00.000Z`);
  const offsetMinutes = getTimeZoneOffsetMinutes(CHICAGO_TIME_ZONE, naiveUtc);
  return new Date(naiveUtc.getTime() - offsetMinutes * 60000).toISOString();
}

// ---------------------------------------------------------------------------
// Per-session detail state helpers (module doc #6) -- "per-session
// start/end times" + "expected people reached ... per day", unlike
// ScheduleMeetingsDialog's single shared start/end applied to every session.
// ---------------------------------------------------------------------------

/** Keeps exactly one detail entry per currently-selected date: preserves an
 * existing entry's edited times/people-reached when its date survives a
 * mode/range change, drops entries for dates no longer selected, and seeds
 * brand-new dates with the BEH-07 smart default times + no expected count
 * yet. */
export function syncSessionDetails(
  dates: readonly string[],
  prevDetails: Readonly<Record<string, OutreachSessionDetail>>,
  defaultStartTime: string | undefined,
  defaultEndTime: string | undefined,
): Record<string, OutreachSessionDetail> {
  const next: Record<string, OutreachSessionDetail> = {};
  for (const date of dates) {
    next[date] = prevDetails[date] ?? {
      startTime: defaultStartTime as ISOTimeString | undefined,
      endTime: defaultEndTime as ISOTimeString | undefined,
      peopleReached: null,
    };
  }
  return next;
}

/** Module doc #3/#6 -- builds the real `event_sessions` row payload. Skips
 * (does not emit a garbage row for) any date whose per-session
 * `startTime`/`endTime` is still unset, since a date alone cannot satisfy
 * `starts_at`/`ends_at not null`. */
export function buildOutreachSessionsPayload(
  dates: readonly string[],
  details: Readonly<Record<string, OutreachSessionDetail>>,
): CreateOutreachSessionPayload[] {
  const sessions: CreateOutreachSessionPayload[] = [];
  for (const date of dates) {
    const detail = details[date];
    if (detail === undefined || detail.startTime === undefined || detail.endTime === undefined) {
      continue;
    }
    sessions.push({
      sessionDate: date,
      startsAt: chicagoWallTimeToUtcIso(date, detail.startTime),
      endsAt: chicagoWallTimeToUtcIso(date, detail.endTime),
      notes: '', // Module doc #3 -- Trap #3 resolution, matches T031's precedent.
      peopleReached: detail.peopleReached,
    });
  }
  return sessions;
}

/** `null` when every known team is selected (matches `events.team_ids` NULL
 * = "all teams" semantics), otherwise the explicit selected list. */
export function resolveTeamScope(
  selectedTeamIds: readonly string[],
  allTeamIds: readonly string[],
): string[] | null {
  const allSelected =
    allTeamIds.length > 0 &&
    selectedTeamIds.length === allTeamIds.length &&
    allTeamIds.every((id) => selectedTeamIds.includes(id));
  return allSelected ? null : [...selectedTeamIds];
}

/** T118 (UXP-02) module doc 11c/11e -- active-students-scoped-to-selected-
 * teams grouping for the "Expected attendees" checklist. Skips a team
 * entirely when it has zero active students (UXD-05(b): an empty group
 * yields its own space rather than rendering a header over nothing). */
export function groupActiveRosterByTeam(
  students: readonly OutreachRosterStudent[],
  teams: readonly OutreachTeamOption[],
  selectedTeamIds: readonly string[],
): Array<{ team: OutreachTeamOption; students: OutreachRosterStudent[] }> {
  const selectedSet = new Set(selectedTeamIds);
  const groups: Array<{ team: OutreachTeamOption; students: OutreachRosterStudent[] }> = [];
  for (const team of teams) {
    if (!selectedSet.has(team.id)) continue;
    const teamStudents = students.filter(
      (student) => student.isActive && student.teamId === team.id,
    );
    if (teamStudents.length === 0) continue;
    groups.push({ team, students: teamStudents });
  }
  return groups;
}

/** T118 (UXP-02) module doc 11d -- sanitizes a checked-id list against
 * whichever roster ids are currently visible (used both for the payload's
 * `expectedStudentIds` at submit time and for computing the "All"/"Clear"
 * shortcuts' own target set). A student hidden by a team-scope change is
 * dropped, never silently carried through. */
export function resolveExpectedAttendeeIds(
  checkedIds: readonly string[],
  visibleRosterIds: readonly string[],
): string[] {
  const visibleSet = new Set(visibleRosterIds);
  return checkedIds.filter((id) => visibleSet.has(id));
}

/** BEH-07 (module doc #4) -- the ONLY place the confirm button's label is
 * produced. Never a bare "Create event"/"Save changes"/"Submit"/"OK" alone
 * -- always states the computed session count. */
export function computeConfirmLabel(isEditMode: boolean, sessionCount: number): string {
  const verb = isEditMode ? 'Save changes' : 'Create event';
  return `${verb} — ${sessionCount} session${sessionCount === 1 ? '' : 's'}`;
}

// ---------------------------------------------------------------------------
// Default injectable persistence seam (module doc #9).
// ---------------------------------------------------------------------------

export const defaultOnSaveEvent: OnSaveOutreachEventFn = async (payload) => {
  console.warn(
    '[OutreachEventDialog] No Supabase client wired in yet (module doc #9) -- this stub only ' +
      'logs the events/event_sessions payload that would have been inserted/updated.',
    payload,
  );
};

// ---------------------------------------------------------------------------
// Component.
// ---------------------------------------------------------------------------

export interface OutreachEventDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** Defaults to `DEFAULT_TEAMS` (fixture, module-level doc). */
  teams?: readonly OutreachTeamOption[];
  /** T118 (UXP-02) module doc 11e -- defaults to `DEFAULT_STUDENTS`
   * (fixture, module-level doc). */
  students?: readonly OutreachRosterStudent[];
  /** T118 (UXP-02) module doc 11d -- defaults to
   * `PLACEHOLDER_CURRENT_COACH_PROFILE_ID`. */
  currentUserProfileId?: string;
  /** Defaults to `defaultOnSaveEvent` (module doc #9). */
  onSaveEvent?: OnSaveOutreachEventFn;
  /** Present => "edit" mode, pre-filled from this existing event + its
   * sessions (module doc #8). Absent => "new" mode. */
  initialEvent?: ExistingOutreachEvent;
}

export function OutreachEventDialog({
  isOpen,
  onOpenChange,
  teams = DEFAULT_TEAMS,
  students = DEFAULT_STUDENTS,
  currentUserProfileId = PLACEHOLDER_CURRENT_COACH_PROFILE_ID,
  onSaveEvent = defaultOnSaveEvent,
  initialEvent,
}: OutreachEventDialogProps): ReactNode {
  const allTeamIds = useMemo(() => teams.map((team) => team.id), [teams]);
  const isEditMode = initialEvent !== undefined;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [locationName, setLocationName] = useState('');
  const [address, setAddress] = useState('');

  const [type, setType] = useState<OutreachDialogEventType>('outreach');
  const [competitionCountsParticipation, setCompetitionCountsParticipation] = useState(false);
  const [competitionCountsVolunteerHours, setCompetitionCountsVolunteerHours] = useState(false);

  const [mode, setMode] = useState<OutreachScheduleMode>('single');
  const [singleDate, setSingleDate] = useState<ISODateString | undefined>(undefined);
  const [multiDayRange, setMultiDayRange] = useState<DateRange | null>(null);
  const [recurringRange, setRecurringRange] = useState<DateRange | null>(null);
  const [recurringWeekdays, setRecurringWeekdays] = useState<string[]>([]);
  const [customDates, setCustomDates] = useState<string[]>([]);
  const [customDatePicker, setCustomDatePicker] = useState<ISODateString | undefined>(undefined);

  const [sessionDetails, setSessionDetails] = useState<Record<string, OutreachSessionDetail>>({});

  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>(allTeamIds);
  // T118 (UXP-02) -- "Expected attendees" checklist state.
  const [expectedStudentIds, setExpectedStudentIds] = useState<string[]>([]);
  const [adultVolunteersCount, setAdultVolunteersCount] = useState<number>(0);
  const [adultVolunteerHours, setAdultVolunteerHours] = useState<number>(0);
  const [shareToCalendarFeed, setShareToCalendarFeed] = useState(true);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function resetForm(): void {
    if (initialEvent !== undefined) {
      setTitle(initialEvent.title);
      setDescription(initialEvent.description);
      setLocationName(initialEvent.locationName);
      setAddress(initialEvent.address);
      setType(initialEvent.type);
      setCompetitionCountsParticipation(
        initialEvent.type === 'competition' ? initialEvent.countsParticipation : false,
      );
      setCompetitionCountsVolunteerHours(
        initialEvent.type === 'competition' ? initialEvent.countsVolunteerHours : false,
      );
      setMode('custom');
      setSingleDate(undefined);
      setMultiDayRange(null);
      setRecurringRange(null);
      setRecurringWeekdays([]);
      const dates = generateCustomSessionDates(
        initialEvent.sessions.map((session) => session.sessionDate),
      );
      setCustomDates(dates);
      setCustomDatePicker(undefined);
      const details: Record<string, OutreachSessionDetail> = {};
      for (const session of initialEvent.sessions) {
        details[session.sessionDate] = {
          startTime: createISOTimeString(session.startTime) ?? undefined,
          endTime: createISOTimeString(session.endTime) ?? undefined,
          peopleReached: session.peopleReached,
        };
      }
      setSessionDetails(details);
      setSelectedTeamIds(initialEvent.teamIds ?? allTeamIds);
      // T118 (UXP-02) module doc 11f -- optional, back-compat prefill.
      setExpectedStudentIds(
        initialEvent.expectedStudentIds !== undefined ? [...initialEvent.expectedStudentIds] : [],
      );
      setAdultVolunteersCount(initialEvent.adultVolunteersCount);
      setAdultVolunteerHours(initialEvent.adultVolunteerHours);
      setShareToCalendarFeed(initialEvent.shareToCalendarFeed);
    } else {
      setTitle('');
      setDescription('');
      setLocationName('');
      setAddress('');
      setType('outreach');
      setCompetitionCountsParticipation(false);
      setCompetitionCountsVolunteerHours(false);
      setMode('single');
      setSingleDate(undefined);
      setMultiDayRange(null);
      setRecurringRange(null);
      setRecurringWeekdays([]);
      setCustomDates([]);
      setCustomDatePicker(undefined);
      setSessionDetails({});
      setSelectedTeamIds(allTeamIds);
      setExpectedStudentIds([]);
      setAdultVolunteersCount(0);
      setAdultVolunteerHours(0);
      setShareToCalendarFeed(true);
    }
    setSubmitError(null);
  }

  // Nothing persists across opens -- every fresh open starts from either
  // pristine defaults (new mode) or `initialEvent`'s own values (edit mode).
  useEffect(() => {
    if (isOpen) resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only on the isOpen transition.
  }, [isOpen]);

  const sessionDates = useMemo(
    () =>
      computeOutreachScheduleSessionDates({
        mode,
        singleDate,
        multiDayRange,
        recurringRange,
        recurringWeekdays,
        customDates,
      }),
    [mode, singleDate, multiDayRange, recurringRange, recurringWeekdays, customDates],
  );

  // Module doc #6 -- a purely DERIVED merge of whichever dates are currently
  // selected with any per-date edits already in `sessionDetails` state,
  // seeding brand-new dates with the BEH-07 smart defaults. Deliberately a
  // `useMemo`, NOT a `useEffect` that writes back into `sessionDetails`: an
  // effect-based sync raced with `resetForm`'s own `setSessionDetails` call
  // on the very first commit after opening in edit mode (the effect's
  // closure captured the PRE-reset `sessionDates` -- computed from the
  // pristine 'single'/no-date defaults still in state during that same
  // render -- and its `syncSessionDetails([], prefilledDetails, ...)` call
  // wiped every prefilled `peopleReached`/time value back to the empty
  // record before the corrected dates ever arrived). A derived value has no
  // such ordering hazard: it is recomputed fresh every render directly from
  // whatever `sessionDates`/`sessionDetails` currently are, never "syncs"
  // stale state back into state.
  const effectiveSessionDetails = useMemo(
    () => syncSessionDetails(sessionDates, sessionDetails, DEFAULT_START_TIME, DEFAULT_END_TIME),
    [sessionDates, sessionDetails],
  );

  const sessionsPayload = useMemo(
    () => buildOutreachSessionsPayload(sessionDates, effectiveSessionDetails),
    [sessionDates, effectiveSessionDetails],
  );

  const effectiveFlags = resolveEventTypeFlags(type, {
    countsParticipation: competitionCountsParticipation,
    countsVolunteerHours: competitionCountsVolunteerHours,
  });

  // T118 (UXP-02) module doc 11c/11e -- roster scoped to currently-selected
  // teams, grouped for the checklist below.
  const rosterGroups = useMemo(
    () => groupActiveRosterByTeam(students, teams, selectedTeamIds),
    [students, teams, selectedTeamIds],
  );
  const visibleRosterIds = useMemo(
    () => rosterGroups.flatMap((group) => group.students.map((student) => student.id)),
    [rosterGroups],
  );
  // T118 (UXP-02) module doc 11d -- sanitized against the currently-visible
  // roster; this is what's actually shown as "checked" (a stale pick for a
  // now-hidden student never displays as checked) and what gets submitted.
  const effectiveExpectedStudentIds = useMemo(
    () => resolveExpectedAttendeeIds(expectedStudentIds, visibleRosterIds),
    [expectedStudentIds, visibleRosterIds],
  );

  const isValid = title.trim() !== '' && sessionsPayload.length > 0;
  const confirmLabel = computeConfirmLabel(isEditMode, sessionsPayload.length);

  function updateSessionDetail(date: string, patch: Partial<OutreachSessionDetail>): void {
    setSessionDetails((prev) => ({
      ...prev,
      [date]: {
        ...(prev[date] ?? { startTime: undefined, endTime: undefined, peopleReached: null }),
        ...patch,
      },
    }));
  }

  function handleCancel(): void {
    resetForm();
    onOpenChange(false);
  }

  async function handleSubmit(): Promise<void> {
    if (!isValid) return; // extra guard; the button is already natively disabled.
    setIsSubmitting(true);
    setSubmitError(null);
    const payload: SaveOutreachEventPayload = {
      event: {
        id: initialEvent?.id,
        title: title.trim(),
        description,
        locationName,
        address,
        type,
        countsParticipation: effectiveFlags.countsParticipation,
        countsVolunteerHours: effectiveFlags.countsVolunteerHours,
        teamIds: resolveTeamScope(selectedTeamIds, allTeamIds),
        adultVolunteersCount,
        adultVolunteerHours,
        shareToCalendarFeed,
      },
      sessions: sessionsPayload,
      // T118 (UXP-02) module doc 11d -- always populated by this component.
      expectedStudentIds: effectiveExpectedStudentIds,
      respondedBy: currentUserProfileId,
    };
    try {
      await onSaveEvent(payload);
      resetForm();
      onOpenChange(false);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Something went wrong saving this event.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function addCustomDate(): void {
    if (customDatePicker === undefined) return;
    setCustomDates((prev) => generateCustomSessionDates([...prev, customDatePicker]));
    setCustomDatePicker(undefined);
  }

  function removeCustomDate(date: string): void {
    setCustomDates((prev) => prev.filter((d) => d !== date));
  }

  // T118 (UXP-02) module doc 11b -- "All"/"Clear" shortcuts, full-replace
  // (not additive-union), scoped to whichever roster is currently visible.
  function selectAllVisibleRoster(): void {
    setExpectedStudentIds(visibleRosterIds);
  }

  function clearVisibleRoster(): void {
    setExpectedStudentIds([]);
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form">
      <Layout
        header={
          <DialogHeader
            title={isEditMode ? 'Edit outreach event' : 'New outreach event'}
            onOpenChange={onOpenChange}
          />
        }
        content={
          <LayoutContent>
            <FormLayout>
              {/* Field order per OUT-02 / constitution item 13 (module doc,
                  top of file): title -> description -> location name +
                  address -> type -> schedule mode -> per-session times +
                  expected people reached -> adult volunteers -> team scope
                  -> share to calendar feed -- exact, not a suggestion. */}
              <TextInput
                label="Title"
                value={title}
                onChange={setTitle}
                isRequired
                placeholder="e.g. Community Food Bank Sort"
              />

              <TextArea
                label="Description"
                value={description}
                onChange={setDescription}
                isOptional
                rows={3}
              />

              <HStack gap={2} wrap="wrap">
                <TextInput
                  label="Location name"
                  value={locationName}
                  onChange={setLocationName}
                  placeholder="e.g. Riverside Food Bank"
                />
                <TextInput
                  label="Address"
                  value={address}
                  onChange={setAddress}
                  placeholder="e.g. 100 Riverside Dr"
                />
              </HStack>

              {/* Module doc #1 -- the resolved central spec tension: a real
                  type Selector, default 'outreach', that can also create
                  'competition' events per CMP-01. */}
              <Selector
                label="Event type"
                options={[
                  { value: 'outreach', label: 'Outreach' },
                  { value: 'competition', label: 'Competition' },
                ]}
                value={type}
                onChange={(value) => setType(value as OutreachDialogEventType)}
              />

              {/* Module doc #2 -- CMP-02: these flags are only ever shown as
                  editable controls for type === 'competition'. */}
              {type === 'competition' && (
                <VStack gap={2}>
                  <Switch
                    label="Counts toward participation %"
                    value={competitionCountsParticipation}
                    onChange={(checked) => setCompetitionCountsParticipation(checked)}
                    description="Off by default for competitions (CMP-02); turn on to opt this event into MET-01/02."
                  />
                  <Switch
                    label="Counts toward volunteer hours"
                    value={competitionCountsVolunteerHours}
                    onChange={(checked) => setCompetitionCountsVolunteerHours(checked)}
                    description="Off by default for competitions (CMP-02); turn on to opt this event into MET-03/04."
                  />
                </VStack>
              )}

              <SegmentedControl
                value={mode}
                onChange={(value) => setMode(value as OutreachScheduleMode)}
                label="Schedule mode"
              >
                <SegmentedControlItem value="single" label="Single" />
                <SegmentedControlItem value="multiDay" label="Multi-day" />
                <SegmentedControlItem value="recurring" label="Recurring" />
                <SegmentedControlItem value="custom" label="Custom dates" />
              </SegmentedControl>

              {mode === 'single' && (
                <DateInput label="Date" value={singleDate} onChange={setSingleDate} isRequired />
              )}

              {mode === 'multiDay' && (
                <DateRangeInput
                  label="Date range"
                  value={multiDayRange}
                  onChange={setMultiDayRange}
                  presets={MULTI_DAY_RANGE_PRESETS}
                />
              )}

              {mode === 'recurring' && (
                <>
                  <DateRangeInput
                    label="Date range"
                    value={recurringRange}
                    onChange={setRecurringRange}
                    presets={RECURRING_RANGE_PRESETS}
                  />
                  <CheckboxList
                    label="Repeat on"
                    value={recurringWeekdays}
                    onChange={setRecurringWeekdays}
                    hasDividers
                  >
                    {WEEKDAY_OPTIONS.map((option) => (
                      <CheckboxListItem
                        key={option.value}
                        label={option.label}
                        value={option.value}
                      />
                    ))}
                  </CheckboxList>
                </>
              )}

              {mode === 'custom' && (
                <VStack gap={2}>
                  <HStack gap={2} vAlign="end" wrap="wrap">
                    <DateInput
                      label="Add a date"
                      value={customDatePicker}
                      onChange={setCustomDatePicker}
                    />
                    <Button
                      label="Add date"
                      variant="secondary"
                      onClick={addCustomDate}
                      isDisabled={customDatePicker === undefined}
                    />
                  </HStack>
                  {customDates.length === 0 ? (
                    <Text type="supporting">No custom dates added yet.</Text>
                  ) : (
                    <List hasDividers header="Picked dates">
                      {customDates.map((date) => (
                        <ListItem
                          key={date}
                          label={date}
                          endContent={
                            <Button
                              label={`Remove ${date}`}
                              variant="ghost"
                              size="sm"
                              onClick={() => removeCustomDate(date)}
                            />
                          }
                        />
                      ))}
                    </List>
                  )}
                </VStack>
              )}

              {/* Module doc #6 -- "per-session start/end times, expected
                  people-reached placeholder per day": one row per currently
                  selected date. Session-detail labels are suffixed with the
                  date so each row's controls have a unique, testable label
                  (ordinary parenthetical prose, not a wireframe artifact --
                  see module doc #4). */}
              {sessionDates.length === 0 ? (
                <Text type="supporting">Pick at least one date above to set its times.</Text>
              ) : (
                <VStack gap={3}>
                  <Text type="supporting">
                    Session details ({sessionDates.length}{' '}
                    {sessionDates.length === 1 ? 'session' : 'sessions'})
                  </Text>
                  {sessionDates.map((date) => {
                    const detail = effectiveSessionDetails[date];
                    return (
                      <VStack key={date} gap={2}>
                        <Text type="supporting">{date}</Text>
                        <HStack gap={2} wrap="wrap">
                          <TimeInput
                            label={`Start time (${date})`}
                            value={detail?.startTime}
                            onChange={(value) => updateSessionDetail(date, { startTime: value })}
                            isRequired
                          />
                          <TimeInput
                            label={`End time (${date})`}
                            value={detail?.endTime}
                            onChange={(value) => updateSessionDetail(date, { endTime: value })}
                            isRequired
                          />
                          <NumberInput
                            label={`Expected people reached (${date})`}
                            value={detail?.peopleReached ?? null}
                            onChange={(value: number | null) =>
                              updateSessionDetail(date, { peopleReached: value })
                            }
                            isOptional
                            hasClear
                            min={0}
                            isIntegerOnly
                          />
                        </HStack>
                      </VStack>
                    );
                  })}
                </VStack>
              )}

              <HStack gap={2} wrap="wrap">
                <NumberInput
                  label="Adult volunteers"
                  value={adultVolunteersCount}
                  onChange={setAdultVolunteersCount}
                  min={0}
                  isIntegerOnly
                  units="volunteers"
                />
                <NumberInput
                  label="Adult volunteer hours"
                  value={adultVolunteerHours}
                  onChange={setAdultVolunteerHours}
                  min={0}
                  step={0.5}
                  units="hrs"
                />
              </HStack>

              <MultiSelector
                label="Team scope"
                options={teams.map((team) => ({ value: team.id, label: team.name }))}
                value={selectedTeamIds}
                onChange={setSelectedTeamIds}
                hasSelectAll
                triggerDisplay="labels"
              />

              {/* T118 (UXP-02) module doc 11b -- placed after Team scope
                  (the roster is scoped to it) and before Share to calendar
                  feed, matching the capability map's own "New event form"
                  ordering. Module doc 11c -- one CheckboxList per team acts
                  as the "team chip" group (no dedicated Chip component
                  exists in this design system). */}
              <VStack gap={2}>
                <HStack gap={2} vAlign="center" wrap="wrap">
                  <Text type="supporting">
                    Expected attendees ({effectiveExpectedStudentIds.length} of{' '}
                    {visibleRosterIds.length})
                  </Text>
                  <Button
                    label="All"
                    variant="ghost"
                    size="sm"
                    onClick={selectAllVisibleRoster}
                    isDisabled={visibleRosterIds.length === 0}
                  />
                  <Button
                    label="Clear"
                    variant="ghost"
                    size="sm"
                    onClick={clearVisibleRoster}
                    isDisabled={effectiveExpectedStudentIds.length === 0}
                  />
                </HStack>
                {rosterGroups.length === 0 ? (
                  <Text type="supporting">No active students on the selected team(s) yet.</Text>
                ) : (
                  rosterGroups.map((group) => (
                    <CheckboxList
                      key={group.team.id}
                      label={group.team.name}
                      value={effectiveExpectedStudentIds}
                      onChange={setExpectedStudentIds}
                      hasDividers
                    >
                      {group.students.map((student) => (
                        <CheckboxListItem
                          key={student.id}
                          label={student.name}
                          value={student.id}
                        />
                      ))}
                    </CheckboxList>
                  ))
                )}
              </VStack>

              <Switch
                label="Share to calendar feed"
                value={shareToCalendarFeed}
                onChange={(checked) => setShareToCalendarFeed(checked)}
                description="Include this event's sessions in VOLT's subscribable ICS calendar feed."
              />

              {submitError !== null && (
                <Banner status="error" title="Couldn't save this event" description={submitError} />
              )}
            </FormLayout>
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack hAlign="end" gap={2}>
              <Button label="Cancel" variant="secondary" onClick={handleCancel} />
              <Button
                label={confirmLabel}
                variant="primary"
                isDisabled={!isValid || isSubmitting}
                isLoading={isSubmitting}
                clickAction={handleSubmit}
              />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}

export default OutreachEventDialog;
