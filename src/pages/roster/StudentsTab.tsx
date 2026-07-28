/**
 * T022: Students tab (ROS-02) -- `Table` + `PowerSearch` (search by name;
 * filter by team, account status, active), columns: `Avatar`+name, team
 * `Badge`, grad year, account status (`StatusDot`: Active / Invited / No
 * account), goal override, row `MoreMenu` -> Edit, Invite (if email), Invite
 * parent, Deactivate (`AlertDialog`), View history.
 *
 * This is a STANDALONE component per this task's packet -- it is not wired
 * into `RosterShell.tsx` (a forbidden, read-only file here; T021 already
 * shipped a placeholder `EmptyState` in its Students tab panel naming this
 * task as the one that eventually fills that slot).
 *
 * -----------------------------------------------------------------------
 * 1. Ground truth -- `students`/`teams`/`invites` column shapes, read
 *    directly from the real migrations (constitution item 3), NOT
 *    invented/renamed with extra fields:
 *
 *    `students` (`supabase/migrations/20260716000000_identity_roster.sql`
 *    lines 59-68): id, profile_id (nullable, fk `profiles`), display_name,
 *    team_id (fk `teams`), grad_year (nullable), is_active (default true),
 *    goal_hours_override (nullable).
 *
 *    `teams` (same file, lines 29-38): id, name, short_name, program,
 *    color, archived, sort_order.
 *
 *    `invites` (`supabase/migrations/20260717000000_scheduling_attendance.sql`
 *    lines 18-27): id, email, role (`role_enum`: 'admin' | 'coach' |
 *    'student' | 'parent' -- defined in the identity_roster migration, line
 *    12), student_id (nullable -- "self for students, linked kid for
 *    parents" per that file's own comment), invited_by, status ('pending' |
 *    'accepted' | 'expired' | 'revoked'), expires_at.
 *
 *    `StudentRow`/`TeamRow`/`InviteRow` below are verbatim camelCase renames
 *    of the subset of these columns this screen needs -- no invented field,
 *    no renamed status vocabulary.
 *
 * -----------------------------------------------------------------------
 * 2. Known Context/Traps #1 -- "Invite (if email)" condition is genuinely
 *    ambiguous (PRD ROS-02, `docs/swarm/VOLT_Portal_PRD.md` line 334).
 *    DISCLOSED JUDGMENT CALL, not a silent guess.
 *
 * `students` has NO email column at all (confirmed directly against the
 * migration above -- grep-provable, zero `email` reference on that table).
 * Email only exists on `profiles.email` (only set once a student HAS an
 * account, via `profile_id`) or on a pending `invites.email` row. Two
 * readings were possible:
 *   (a) "Invite" shows whenever account status is "No account" (no
 *       `profile_id` AND no pending self-invite) -- the coach types the
 *       email into the invite flow itself (the real `send-invite` Supabase
 *       edge function, `supabase/functions/send-invite/index.ts`, already
 *       takes an email as its OWN input, not a stored `students.email`
 *       lookup), so "if email" is read as PRD shorthand for "assuming
 *       you're about to supply one," not a precondition sourced from
 *       already-stored data.
 *   (b) A genuine schema gap: ROS-02 assumes a `students.email` field that
 *       doesn't exist in this project's real migrations.
 * This file implements reading (a): `shouldShowInviteAction` below returns
 * true exactly when `accountStatus === 'no_account'`, and is the ONLY place
 * that decision is made. Reading (b) is explicitly NOT implemented -- no
 * `students.email` column, migration, or fixture field is invented anywhere
 * in this file; that would be schema-change overreach for a UI task, which
 * the packet explicitly warns against. This is the "more defensible"
 * reading per the packet's own steer: it requires no schema change and
 * matches how invites work everywhere else in this codebase (`invites.email`
 * is always operator-supplied at invite-creation time, never read off the
 * invitee's own row -- see `supabase/functions/send-invite/validation.ts`,
 * which validates an `email` field passed IN the request body, not looked up
 * from any table).
 *
 * -----------------------------------------------------------------------
 * 3. Known Context/Traps #2 -- account-status `StatusDot`, three real
 *    states, derived as a pure function.
 *
 * "Active" = `profileId !== null`. "Invited" = `profileId === null` AND a
 * matching PENDING invite exists. "No account" = neither.
 *
 * A subtlety NOT spelled out in the packet's own two-state description but
 * required by the real `invites` schema: `invites.student_id` is reused for
 * BOTH self-invites (role='student', inviting the student to create their
 * OWN account) and parent invites (role='parent', `student_id` pointing at
 * the linked child, per that column's own migration comment "self for
 * students, linked kid for parents"). A parent-invite row targeting this
 * student's `student_id` does NOT mean this STUDENT has a pending
 * self-invite -- it means someone is inviting one of THEIR PARENTS. So the
 * "pending invite" half of the "Invited" derivation must ALSO filter on
 * `role === 'student'`, not just `student_id` + `status === 'pending'`.
 * `hasPendingSelfInvite` below applies that filter; `FIXTURE_INVITES`
 * deliberately includes a `role: 'parent'` row targeting a "no_account"
 * student specifically to prove this is not vacuous (see module doc #7).
 * `deriveAccountStatus`/`hasPendingSelfInvite` are pure, exported, and
 * independently unit-tested (see `StudentsTab.test.tsx`) against all three
 * states plus both edge cases (parent-invite decoy, non-pending-status
 * decoy) -- proof independent of any one fixture render.
 *
 * -----------------------------------------------------------------------
 * 4. T089 (ED-1 Packet P2): real load/mutation wiring -- `loadData` no
 *    longer defaults to fixture data.
 *
 * `loadData`/`onCreateStudent`/`onUpdateStudent`/`onSetStudentActive` are
 * the four injectable seams. All four now default to real implementations
 * from `../../lib/supabase/loaders/students` (`loadStudentsTabData`,
 * `createStudent`, `updateStudent`, `setStudentActive` -- see that module's
 * own doc comment for the full per-table query/mutation reasoning): a real
 * three-table query (`students`/`teams`/`invites`) and real `insert`/
 * `update` mutations against `students`. `defaultLoadStudentsTabData`
 * (fixture data typed against the real schema above) is kept as a named
 * export, fixture literal unchanged, for tests (and any future caller) that
 * want fixture behavior explicitly rather than relying on it being the
 * implicit default -- same "the default changes, the fixture literal
 * doesn't" posture `InvitesTab.tsx` already established for its own
 * `loadData`/`onRevoke` (T087).
 *
 * -----------------------------------------------------------------------
 * 5. Known Context/Traps #4 -- ROS-09 Deactivate must be a reversible
 *    `is_active` flip, never a delete.
 *
 * `withActiveOverride` below is the ONLY place `isActive` is ever mutated in
 * this file, and it always returns the FULL row set with one row's
 * `isActive` flipped -- it never filters/removes a row. The `Deactivate`
 * `AlertDialog` (DES-11) copy explicitly says "removes them from future
 * expected rosters/leaderboards; history and past metrics are preserved,
 * and they'll still show up here" -- never "delete" or "remove" language.
 * Because the flip is reversible, an already-inactive row's `MoreMenu` shows
 * a plain "Reactivate" item INSTEAD of "Deactivate" (flips `isActive` back
 * to `true` directly, no `AlertDialog` -- per `AlertDialog`'s own
 * documented "Don't: use AlertDialog for non-destructive actions" guidance,
 * astryx-api.md "AlertDialog" Best Practices; reactivating is not
 * destructive). This is a disclosed ADDITION beyond ROS-02's literal text
 * (which only names "Deactivate"), included specifically so the
 * reversibility this task's packet calls out is provably demonstrable in
 * the UI, not just asserted in a comment -- see this task's worker output
 * for the real open/confirm -> flip -> row-still-visible proof, both
 * directions.
 *
 * -----------------------------------------------------------------------
 * 6. Known Context/Traps #5 -- `PowerSearch` must cover all three named
 *    axes (name / team / account status) PLUS active, not just name.
 *
 * `buildSearchConfig` below defines four independent `PowerSearchField`s
 * (`studentName` contains, `team` is, `accountStatus` is, `active` is) --
 * `matchesAllFilters` applies every active filter with AND semantics (same
 * shape `ParticipationTab.tsx`/T056 already established for its own
 * multi-field `PowerSearch`). `config.contentSearchFieldKey` is set to the
 * name field's key so typing free text (no explicit field/operator pick)
 * searches by name directly, matching ROS-02's literal "search by name via
 * PowerSearch" wording (`PowerSearchConfig.contentSearchFieldKey`,
 * `node_modules/@astryxdesign/core/src/PowerSearch/types.ts` line 318 --
 * `astryx-api.md`'s own "PowerSearch" Props table does not spell out
 * `PowerSearchConfig`'s own shape as a Props table, only via its abbreviated
 * JSX example, so this field is cross-checked directly against the
 * installed package's own exported types, same posture
 * `ParticipationTab.tsx`/T056 already took for the identical doc gap).
 *
 * -----------------------------------------------------------------------
 * 7. Fixture data (constitution item 6: no PII, fabricated names only).
 *
 * `FIXTURE_STUDENTS`/`FIXTURE_TEAMS`/`FIXTURE_INVITES` below are entirely
 * fabricated and exist ONLY as the default argument to
 * `defaultLoadStudentsTabData`. Deliberately covers every case module doc
 * #3 depends on:
 *   - `student-amara-voss`: `profileId` set -> Active.
 *   - `student-kellan-reyes`: no `profileId`, ONE matching
 *     `role: 'student', status: 'pending'` invite -> Invited.
 *   - `student-priya-anand`: no `profileId`, no invites at all -> No
 *     account (also carries a `goalHoursOverride`, proving that column).
 *   - `student-theo-mercer`: no `profileId`, but the ONLY invite targeting
 *     him is `role: 'parent'` (inviting his parent, not him) -> still No
 *     account -- proves module doc #3's role-filter subtlety is real, not
 *     vacuous.
 *   - `student-sofia-delgado`: no `profileId`, has a `role: 'student'`
 *     invite targeting her, but its `status` is `'expired'`, not
 *     `'pending'` -> still No account -- proves only a PENDING self-invite
 *     counts.
 *   - `student-marcus-whitfield`: `profileId` set (Active) AND
 *     `isActive: false` -- the ROS-09 "deactivated but still has an active
 *     account and still shows up on the roster" case, proving account
 *     status and roster-active status are independent axes.
 *
 * -----------------------------------------------------------------------
 * 8. T089 (ED-1 Packet P2): row-action wiring -- three of the four former
 *    stubs are now real; "View history" alone remains a disclosed stub.
 *
 *   a. "Edit" -- `StudentDialog.tsx` (T023, already Passed) is now imported
 *      and rendered for real. `handleEdit` opens it in edit mode
 *      (`initialData` built from the targeted row via
 *      `toStudentDialogInitialData` below) instead of showing the old
 *      `EDIT_STUB_NOTICE` banner (removed, along with its `StubNotice`
 *      plumbing, per this task's own packet Known Context/Traps #5).
 *   b. "Invite parent" -- `InviteParentDialog.tsx` (T024, already Passed,
 *      and already wired to the real `send-invite` Edge Function by T087)
 *      is now imported and rendered for real. `handleInviteParent` opens it
 *      for the targeted row instead of showing the old
 *      `INVITE_PARENT_STUB_NOTICE` banner (removed, same reasoning as (a)).
 *   c. "Invite" (module doc #2's "if email" condition; only shown when
 *      `accountStatus === 'no_account'`) -- Known Context/Traps #3's real
 *      judgment call, investigated and decided for this task (full
 *      reasoning in this task's own worker output, "Trap #3 investigation
 *      and decision"): `StudentDialog.tsx`'s own `inviteEmail` field
 *      (`StudentFormPayload.inviteEmail`, that file's own module doc #1) is
 *      the real, already-built mechanism for "invite this student by
 *      email" -- filling it in and submitting the edit form fires a real
 *      `send-invite` call (role `'student'`) alongside the `students`
 *      update, via this file's own `handleSubmitStudent` below (Known
 *      Context/Traps #6). Building a SEPARATE one-off email-entry dialog
 *      for this menu item would duplicate that already-real mechanism for
 *      no benefit -- `handleInvite` below therefore does exactly what
 *      `handleEdit` does (opens the same real `StudentDialog` in edit mode
 *      for the targeted row), which is precisely the case where
 *      `StudentDialog`'s own `computeEmailFieldDisabled` leaves the Email
 *      field enabled (edit mode + `hasAccount: false`, since this menu item
 *      only ever shows for `accountStatus === 'no_account'`). The old
 *      `inviteStudentStubNotice` helper is removed; no student-self-invite
 *      composition dialog is invented anywhere in this file.
 *   d. "View history" -- STILL a disclosed stub, correctly out of scope:
 *      no per-student detail/history route exists anywhere in this app yet
 *      (`router.tsx`, read-only here, has no `/roster/students/:id` route),
 *      and this task's Allowed Files do not include `router.tsx`. Same
 *      disclosure-`Banner` stub as before T089 (`viewHistoryStubNotice`,
 *      `StubNotice`, and the `stubNotice` state are all kept, scoped to
 *      this one remaining action only).
 *
 * -----------------------------------------------------------------------
 * 9. DES-12 four states (loading / error / empty / populated) -- same
 *    generic `useLoadState` hook shape every prior content page in this
 *    batch (`OutreachList.tsx`, `ParticipationTab.tsx`, `MeetingsList.tsx`)
 *    already established.
 *
 * -----------------------------------------------------------------------
 * 10. Astryx prop sourcing (constitution item 2) -- every prop used below,
 *     cited directly against `docs/swarm/astryx-api.md`:
 *
 *  - `Table` ("Table" Props table, `astryx-api.md` lines 738-753): `data`,
 *    `columns`, `idKey`, `density`, `dividers`, `hasHover` used.
 *    `columns` entries use ONLY `{key, header, width, align, renderCell}` --
 *    the closed shape that Props table itself enumerates (the installed
 *    package's `TableColumn<T>` source also has `sortable`/`filter`/
 *    `resizable` fields, but `astryx-api.md`'s own Props table describes
 *    `columns` with an explicit closed-looking list that omits them, so
 *    per constitution item 2 they are treated as out of bounds here --
 *    identical reasoning `ParticipationTab.tsx`/T056 already applied to
 *    `sortable` on this exact prop).
 *  - `pixel`/`proportional` (same "Table" Props table `width` description) --
 *    used for every column's `width`.
 *  - `PowerSearch` ("PowerSearch" Props table, lines 5388-5401): `config`,
 *    `filters`, `onChange`, `label`, `placeholder`, `resultCount` used.
 *  - `Avatar` ("Avatar" Props table, lines 464-473): `name`, `size` used.
 *  - `Badge` ("Badge" Props table, lines 526-533): `variant` (`'neutral'`
 *    only -- team names differ per row and the badge is a category tag, not
 *    a repeated system-status badge, but `teams.color` is unconstrained
 *    free text in the real schema with no documented mapping onto Badge's
 *    closed variant enum, so inventing a color-to-variant mapping would be
 *    guessing; `'neutral'` is the safe, always-valid choice), `label` used.
 *  - `StatusDot` ("StatusDot" Props table, lines 5873-5879): `variant`
 *    (`'success'` Active / `'warning'` Invited / `'neutral'` No account),
 *    `label` used. Per its own "Do: always pair with a visible text label"
 *    guidance, every `StatusDot` here is rendered next to a plain `Text`
 *    with the same human-readable label (not relying on the dot's
 *    aria-label alone).
 *  - `MoreMenu` ("MoreMenu" Props table, lines 4809-4817): `items`, `label`
 *    used.
 *  - `AlertDialog` ("AlertDialog" Props table, lines 2518-2530): `isOpen`,
 *    `onOpenChange`, `title`, `description`, `actionLabel`, `onAction` used.
 *  - `Banner` (used identically to `OutreachList.tsx`/`MeetingsList.tsx`):
 *    `status`, `title`, `description`, `isDismissable`, `onDismiss`.
 *  - `EmptyState`: `title`, `description`, `headingLevel` used. T089 adds a
 *    real "create student" flow (see module doc #13 below) -- the top-level
 *    "Add student" `Button` lives outside `EmptyState`, next to
 *    `PowerSearch` (same placement `TeamsTab.tsx`'s own "New team" `Button`
 *    already established for this exact page-level-primary-action pattern),
 *    not as `EmptyState`'s own `actions` prop, so it stays visible whether
 *    the roster is empty or not.
 *  - `Skeleton` (T081, "Skeleton" section, lines 621-655): `width`,
 *    `height`, `index` used to preview this screen's predictable `Table`
 *    row/column shape, replacing `Spinner`'s prior use here per Astryx's
 *    own guidance (known-dimension content) -- `VisuallyHidden` + the
 *    wrapping `VStack`'s `aria-busy` carry the "Loading students…"
 *    announcement `Spinner`'s `label` used to provide.
 *  - `Heading`: `level`, `children` used (own `astryx-api.md` subsection is
 *    `undefined`, the same disclosed CLI-cross-checked gap `RosterShell.tsx`
 *    /T021 and every other content page already hit; resolved identically).
 *  - `Text`: `type`, `color`, `weight` used.
 *  - `VStack`/`HStack` ("Stack" section, lines 350-396): `gap`, `padding`,
 *    `vAlign`, `hAlign`, `wrap` used.
 *
 * -----------------------------------------------------------------------
 * 11. T089 -- Deactivate/Reactivate: a real mutation, with optimistic
 *     local-state flip + rollback-on-failure (Known Context/Traps #2).
 *
 * `withActiveOverride` (module doc #5, unchanged, still pure) remains the
 * ONLY place the OPTIMISTIC local `isActive` flip happens. `handleReactivate`/
 * `handleConfirmDeactivate` below now ALSO call `onSetStudentActive` (real
 * default: `setStudentActive`, `../../lib/supabase/loaders/students`) --
 * the flip is applied to `rows` immediately (optimistic), then the real
 * mutation is awaited; on rejection, the exact same `withActiveOverride` call
 * is used to flip the row back to its pre-optimistic value, and an error
 * `Banner` (`feedback` state, new in T089) explains what happened using the
 * rejection's own message. This mirrors `RsvpControl.tsx`'s own
 * `handleChange` (`previousStatus`/optimistic-set/`catch`-rollback shape),
 * per this task's own packet steer. Success also surfaces a `feedback`
 * `Banner` (new in T089) for visible confirmation the real write happened --
 * same "success Banner + error Banner, dismissable, same `feedback` slot"
 * pattern `InvitesTab.tsx`'s own Resend/Revoke flows already established.
 *
 * -----------------------------------------------------------------------
 * 12. T089 -- `StudentDialog`'s `teams` prop is real; `season` is
 *     deliberately still fixture-backed (Known Context/Traps #4).
 *
 * `loadedTeams` (new state, populated from `loadState.data.teams` on
 * successful load -- the REAL, full team list, including `archived`, not
 * the `rows`-derived `teams` `useMemo` below that only covers teams with at
 * least one CURRENT student and has no `archived` field) is mapped to
 * `StudentDialogTeamOption[]` (`dialogTeamOptions`, `id`/`name`/`archived`
 * verbatim) and passed as `<StudentDialog teams={dialogTeamOptions} />`.
 * Nothing is excluded here beyond that verbatim map -- `StudentDialog`'s own
 * `filterSelectableTeams` already excludes archived teams from the
 * `Selector`'s option list, so this file does not duplicate that filtering.
 * `season` is NOT passed (the `<StudentDialog>` render below omits it
 * entirely, so it falls back to that component's own fixture default,
 * `DEFAULT_SEASON_INFO`) -- a parallel, independently-dispatched packet
 * (T091) is building the real season-data mechanism and will thread it
 * through every consumer that needs it, including this dialog; wiring
 * `season` here now would create a false ordering dependency between two
 * packets meant to run independently (this task's own packet, Known
 * Context/Traps #4). Disclosed, not silently left.
 *
 * -----------------------------------------------------------------------
 * 13. T089 -- wiring `StudentDialog`/`InviteParentDialog` into this page for
 *     the first time (Known Context/Traps #5).
 *
 * Neither dialog was ever imported into this file before T089 -- both
 * `StudentDialog`/`InviteParentDialog` remained genuinely unreachable from
 * this page, even though both dialogs themselves were already real,
 * Passed, standalone components. `isAddDialogOpen`/`editTarget` (new state)
 * together drive ONE rendered `<StudentDialog>` instance, switching between
 * create/edit purely via whether `initialData` is supplied (`editTarget !==
 * null ? toStudentDialogInitialData(editTarget) : undefined`) -- the same
 * single-source-of-truth mode detection `StudentDialog.tsx`'s own
 * `computeStudentDialogMode` already documents, never a separately-tracked
 * `mode` flag that could drift out of sync with which data is loaded.
 * `toStudentDialogInitialData` below is the ONE place a `StudentDisplayRow`
 * is resolved into `StudentDialogInitialData` -- `hasAccount` is derived as
 * `accountStatus === 'active'`, matching `StudentDialog.tsx`'s own module
 * doc #1 definition of that field exactly (`profileId !== null`, i.e. this
 * file's own "Active" status -- not "Invited", which still has no account).
 * A real "Add student" `Button` (`variant="primary"`, placed next to
 * `PowerSearch`, same placement `TeamsTab.tsx`'s own "New team" `Button`
 * already established) opens the dialog in create mode
 * (`setIsAddDialogOpen(true)`). `inviteParentTarget` (new state) drives one
 * rendered `<InviteParentDialog>` instance the same way, opened by the real
 * `handleInviteParent` (module doc #8b). `onOpenChange={false}` on either
 * dialog resets all three pieces of state, so closing (via Cancel, a
 * successful submit, or the backdrop) always leaves this page's own state
 * consistent with "nothing open".
 *
 * -----------------------------------------------------------------------
 * 14. T089 -- `handleSubmitStudent`: real create/edit mutation, plus the
 *     Trap #3 invite-on-submit flow (Known Context/Traps #6).
 *
 * `handleSubmitStudent` is this file's own `onSubmit` passed to
 * `<StudentDialog>` (`OnSubmitStudentFn`, that component's own exported
 * type). It strips `StudentFormPayload.inviteEmail` into a separate
 * `StudentWritePayload` (the real, editable `students` columns only) and
 * calls `onCreateStudent`/`onUpdateStudent` (real defaults: `createStudent`/
 * `updateStudent`, `../../lib/supabase/loaders/students`) depending on
 * `mode`. Edit mode closes over `editTarget.id` (the dialog's own open-state
 * for this file, NOT a field on `StudentFormPayload`, which has none --
 * exactly the "close over the id from the dialog's own open-state" approach
 * this task's own packet names as the likely answer) -- a defensive
 * `editTarget === null` guard throws rather than silently no-op-ing, since
 * `StudentDialog` only ever calls `onSubmit` with `mode === 'edit'` when it
 * was opened with `initialData`, which this file only ever supplies when
 * `editTarget !== null`. On success, the freshly-written `StudentRow`
 * (real DB id/fields, resolved via `.select().single()` inside the loader)
 * is turned back into a `StudentDisplayRow` via `buildDisplayRows` (reusing
 * `loadedTeams` and the load's own `loadedInvites`, both new state) and
 * merged into `rows` (`withCreatedStudent`/`withEditedStudent`, both new
 * pure, exported, independently-tested functions, same "one pure function
 * per state transition" discipline `withActiveOverride` already
 * established).
 *
 * Trap #3's real answer (module doc #8c): if `payload.inviteEmail !== null`,
 * this same handler ALSO calls the real `send-invite` Edge Function directly
 * (`invokeEdgeFunction` imported from `../../lib/supabase`, T086's helper --
 * this is a DIFFERENT flow from `InviteParentDialog.tsx`'s own T087 wiring,
 * which sends `role: 'parent'`; this file sends `{ email, role: 'student',
 * student_id }`) with the real, just-written student's id, AFTER the
 * `students` write has already succeeded. On success, `withInvitedStatus`
 * (new, pure, exported) optimistically flips that row's `accountStatus` to
 * `'invited'` locally (no full reload needed to see the change reflected).
 * Disclosed risk (same class T087's own `InviteParentDialog.tsx` module doc
 * #3 already discloses for ITS sequential multi-request design): if the
 * `students` write succeeds but the subsequent `send-invite` call fails, the
 * row already exists in the database (this handler does not/cannot roll
 * that back), but `handleSubmitStudent` still rejects (so `StudentDialog`'s
 * own `submitError` `Banner` shows the real failure and the dialog stays
 * open) -- resubmitting in CREATE mode at that point would attempt to
 * insert a SECOND `students` row for the same person. There is no
 * duplicate-row detection anywhere in this file or its allowed loader; see
 * this task's own worker output "Known risks" for whether this warrants a
 * dispute (same judgment T087 already made for its own analogous risk: it
 * does not block this task's deliverable, and is disclosed rather than
 * silently accepted).
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertDialog,
  Avatar,
  Badge,
  Banner,
  Button,
  type DropdownMenuOption,
  EmptyState,
  Heading,
  HStack,
  MoreMenu,
  pixel,
  PowerSearch,
  type PowerSearchConfig,
  type PowerSearchFilter,
  proportional,
  Skeleton,
  StatusDot,
  Table,
  type TableColumn,
  Text,
  VisuallyHidden,
  VStack,
} from '@astryxdesign/core';
// T089 (ED-1 Packet P2, module doc #13/#14): wiring this page to its own
// dialogs for the first time. `invokeEdgeFunction` is the Trap #3 real
// invite-student send (module doc #14) -- a different flow from
// `InviteParentDialog.tsx`'s own T087 `send-invite` wiring (that dialog
// sends `role: 'parent'`; this file sends `role: 'student'` directly, not
// through that dialog).
import { invokeEdgeFunction, isSupabaseLoaderError } from '../../lib/supabase';
import {
  createStudent,
  loadStudentsTabData,
  setStudentActive,
  updateStudent,
} from '../../lib/supabase/loaders/students';
import {
  InviteParentDialog,
  type StudentOption as InviteParentStudentOption,
} from './InviteParentDialog';
import {
  StudentDialog,
  type StudentDialogInitialData,
  type StudentDialogMode,
  type StudentDialogTeamOption,
  type StudentFormPayload,
} from './StudentDialog';

// ---------------------------------------------------------------------------
// Types -- verbatim camelCase renames of real column subsets. Module doc #1.
// ---------------------------------------------------------------------------

export type ProfileRole = 'admin' | 'coach' | 'student' | 'parent';
export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface StudentRow {
  id: string;
  profileId: string | null;
  displayName: string;
  teamId: string;
  gradYear: number | null;
  isActive: boolean;
  goalHoursOverride: number | null;
}

/**
 * T089: gains `archived` (`teams.archived`, real column) -- module doc #12 --
 * needed so `StudentDialog`'s real `teams` prop can be built without
 * inventing a second team type.
 */
export interface TeamRow {
  id: string;
  name: string;
  archived: boolean;
}

export interface InviteRow {
  id: string;
  email: string;
  role: ProfileRole;
  studentId: string | null;
  status: InviteStatus;
}

export type AccountStatus = 'active' | 'invited' | 'no_account';

/**
 * Table display row -- `extends Record<string, unknown>` is required by
 * `Table`'s own generic constraint (astryx-api.md "Table" Props table,
 * `data: T[]` description).
 */
export interface StudentDisplayRow extends Record<string, unknown> {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  gradYear: number | null;
  accountStatus: AccountStatus;
  goalHoursOverride: number | null;
  isActive: boolean;
}

export interface StudentsTabLoadResult {
  students: readonly StudentRow[];
  teams: readonly TeamRow[];
  invites: readonly InviteRow[];
}

export type LoadStudentsTabDataFn = () => Promise<StudentsTabLoadResult>;

/**
 * T089 (module doc #14) -- the real, editable `students` columns only
 * (never `id`/`profile_id`). Deliberately NOT `StudentFormPayload` itself
 * (`./StudentDialog`, which also carries `inviteEmail` -- a non-column
 * signal this file strips out before calling `onCreateStudent`/
 * `onUpdateStudent`, see `toStudentWritePayload` below).
 */
export interface StudentWritePayload {
  displayName: string;
  teamId: string;
  gradYear: number | null;
  isActive: boolean;
  goalHoursOverride: number | null;
}

/** T089 (module doc #14) -- resolves the freshly-inserted row. */
export type CreateStudentFn = (payload: StudentWritePayload) => Promise<StudentRow>;

/** T089 (module doc #14) -- resolves the freshly-updated row. */
export type UpdateStudentFn = (id: string, payload: StudentWritePayload) => Promise<StudentRow>;

/** T089 (module doc #11) -- the real `students.is_active` mutation. */
export type SetStudentActiveFn = (id: string, isActive: boolean) => Promise<void>;

// ---------------------------------------------------------------------------
// Fixture data -- module doc #7. Fabricated names only (constitution item 6).
// ---------------------------------------------------------------------------

const FIXTURE_TEAMS: readonly TeamRow[] = [
  { id: 'team-ironclad', name: 'Ironclad', archived: false },
  { id: 'team-voltage', name: 'Voltage', archived: false },
];

const FIXTURE_STUDENTS: readonly StudentRow[] = [
  // Active: has a profile_id.
  {
    id: 'student-amara-voss',
    profileId: 'profile-amara-voss',
    displayName: 'Amara Voss',
    teamId: 'team-ironclad',
    gradYear: 2027,
    isActive: true,
    goalHoursOverride: null,
  },
  // Invited: no profile_id, one matching role='student' status='pending' invite.
  {
    id: 'student-kellan-reyes',
    profileId: null,
    displayName: 'Kellan Reyes',
    teamId: 'team-ironclad',
    gradYear: 2026,
    isActive: true,
    goalHoursOverride: null,
  },
  // No account: no profile_id, no invites at all. Has a goal override.
  {
    id: 'student-priya-anand',
    profileId: null,
    displayName: 'Priya Anand',
    teamId: 'team-voltage',
    gradYear: 2028,
    isActive: true,
    goalHoursOverride: 15,
  },
  // No account: only invite targeting him is role='parent' (module doc #3's
  // role-filter subtlety -- a parent invite is NOT a student self-invite).
  {
    id: 'student-theo-mercer',
    profileId: null,
    displayName: 'Theo Mercer',
    teamId: 'team-voltage',
    gradYear: null,
    isActive: true,
    goalHoursOverride: null,
  },
  // No account: has a role='student' invite targeting her, but it's
  // status='expired', not 'pending'.
  {
    id: 'student-sofia-delgado',
    profileId: null,
    displayName: 'Sofia Delgado',
    teamId: 'team-ironclad',
    gradYear: 2025,
    isActive: true,
    goalHoursOverride: null,
  },
  // Active account, but deactivated on the roster (ROS-09: independent axes).
  {
    id: 'student-marcus-whitfield',
    profileId: 'profile-marcus-whitfield',
    displayName: 'Marcus Whitfield',
    teamId: 'team-voltage',
    gradYear: 2026,
    isActive: false,
    goalHoursOverride: 20,
  },
];

const FIXTURE_INVITES: readonly InviteRow[] = [
  {
    id: 'invite-kellan-self',
    email: 'kellan.reyes.invite@example.com',
    role: 'student',
    studentId: 'student-kellan-reyes',
    status: 'pending',
  },
  // Decoy: a PARENT invite targeting Theo -- must NOT make Theo "Invited".
  {
    id: 'invite-theo-parent',
    email: 'parent.of.theo@example.com',
    role: 'parent',
    studentId: 'student-theo-mercer',
    status: 'pending',
  },
  // Decoy: a role='student' invite targeting Sofia, but already expired --
  // must NOT make Sofia "Invited".
  {
    id: 'invite-sofia-expired',
    email: 'sofia.delgado.invite@example.com',
    role: 'student',
    studentId: 'student-sofia-delgado',
    status: 'expired',
  },
];

// ---------------------------------------------------------------------------
// Pure functions -- exported for direct testing. Module docs #2/#3/#5/#6.
// ---------------------------------------------------------------------------

/**
 * Module doc #3: only a PENDING invite with role='student' targeting this
 * student counts as a self-invite. A `role: 'parent'` row sharing the same
 * `studentId` (inviting one of the student's parents) never counts, and
 * neither does a non-pending (`accepted`/`expired`/`revoked`) row.
 */
export function hasPendingSelfInvite(studentId: string, invites: readonly InviteRow[]): boolean {
  return invites.some(
    (invite) =>
      invite.studentId === studentId && invite.role === 'student' && invite.status === 'pending',
  );
}

/** Module doc #3: pure derivation, independent of any fixture. */
export function deriveAccountStatus(
  profileId: string | null,
  hasPendingSelfInviteFlag: boolean,
): AccountStatus {
  if (profileId !== null) return 'active';
  if (hasPendingSelfInviteFlag) return 'invited';
  return 'no_account';
}

/** Module doc #2: the ONE place the "Invite (if email)" condition is decided. */
export function shouldShowInviteAction(accountStatus: AccountStatus): boolean {
  return accountStatus === 'no_account';
}

export function buildDisplayRows(
  students: readonly StudentRow[],
  teams: readonly TeamRow[],
  invites: readonly InviteRow[],
): StudentDisplayRow[] {
  const teamNameById = new Map(teams.map((team) => [team.id, team.name] as const));
  return students.map((student) => {
    const accountStatus = deriveAccountStatus(
      student.profileId,
      hasPendingSelfInvite(student.id, invites),
    );
    return {
      id: student.id,
      name: student.displayName,
      teamId: student.teamId,
      teamName: teamNameById.get(student.teamId) ?? student.teamId,
      gradYear: student.gradYear,
      accountStatus,
      goalHoursOverride: student.goalHoursOverride,
      isActive: student.isActive,
    };
  });
}

/**
 * Module doc #5: the ONLY place `isActive` is ever mutated. Always returns
 * the full row set with one row flipped -- never removes a row. Used for
 * BOTH deactivate (`isActive: false`) and reactivate (`isActive: true`).
 */
export function withActiveOverride(
  rows: readonly StudentDisplayRow[],
  studentId: string,
  isActive: boolean,
): StudentDisplayRow[] {
  return rows.map((row) => (row.id === studentId ? { ...row, isActive } : row));
}

/** Module doc #14 -- strips `StudentFormPayload.inviteEmail` (not a
 * `students` column, see that field's own doc comment on `StudentDialog.tsx`)
 * before calling `onCreateStudent`/`onUpdateStudent`. */
export function toStudentWritePayload(payload: StudentFormPayload): StudentWritePayload {
  return {
    displayName: payload.displayName,
    teamId: payload.teamId,
    gradYear: payload.gradYear,
    isActive: payload.isActive,
    goalHoursOverride: payload.goalHoursOverride,
  };
}

/** Module doc #13 -- the ONE place a `StudentDisplayRow` is resolved into
 * `StudentDialog`'s own `initialData` shape. `hasAccount` is derived exactly
 * as `StudentDialog.tsx`'s own module doc #1 defines it: `profileId !==
 * null`, i.e. this file's own `'active'` status (NOT `'invited'`, which
 * still has no account). */
export function toStudentDialogInitialData(row: StudentDisplayRow): StudentDialogInitialData {
  return {
    id: row.id,
    displayName: row.name,
    teamId: row.teamId,
    gradYear: row.gradYear,
    isActive: row.isActive,
    goalHoursOverride: row.goalHoursOverride,
    hasAccount: row.accountStatus === 'active',
  };
}

/** Module doc #14 -- appends the newly-created row's display row. Never
 * mutates any existing row. */
export function withCreatedStudent(
  rows: readonly StudentDisplayRow[],
  created: StudentDisplayRow,
): StudentDisplayRow[] {
  return [...rows, created];
}

/** Module doc #14 -- replaces exactly the edited row, in place. */
export function withEditedStudent(
  rows: readonly StudentDisplayRow[],
  edited: StudentDisplayRow,
): StudentDisplayRow[] {
  return rows.map((row) => (row.id === edited.id ? edited : row));
}

/** Module doc #14 (Trap #3) -- the ONLY place `accountStatus` is
 * optimistically flipped to `'invited'` after a successful `send-invite`
 * call for a student row. */
export function withInvitedStatus(
  rows: readonly StudentDisplayRow[],
  studentId: string,
): StudentDisplayRow[] {
  return rows.map((row) => (row.id === studentId ? { ...row, accountStatus: 'invited' } : row));
}

export async function defaultLoadStudentsTabData(): Promise<StudentsTabLoadResult> {
  return { students: FIXTURE_STUDENTS, teams: FIXTURE_TEAMS, invites: FIXTURE_INVITES };
}

// ---------------------------------------------------------------------------
// Account status display metadata. Module doc #10 (StatusDot variant +
// paired visible text label).
// ---------------------------------------------------------------------------

const ACCOUNT_STATUS_META: Record<
  AccountStatus,
  { label: string; variant: 'success' | 'warning' | 'neutral' }
> = {
  active: { label: 'Active', variant: 'success' },
  invited: { label: 'Invited', variant: 'warning' },
  no_account: { label: 'No account', variant: 'neutral' },
};

// ---------------------------------------------------------------------------
// Generic DES-12 load-state hook. Module doc #9.
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
// PowerSearch config -- module doc #6. Field keys shared between config
// construction and filter matching so the strings can never drift apart.
// ---------------------------------------------------------------------------

const SEARCH_FIELD_KEYS = {
  name: 'studentName',
  team: 'team',
  accountStatus: 'accountStatus',
  active: 'active',
} as const;

function buildSearchConfig(teams: readonly Pick<TeamRow, 'id' | 'name'>[]): PowerSearchConfig {
  return {
    name: 'StudentsSearch',
    contentSearchFieldKey: SEARCH_FIELD_KEYS.name,
    fields: [
      {
        key: SEARCH_FIELD_KEYS.name,
        label: 'Name',
        operators: [{ key: 'contains', label: 'contains', value: { type: 'string' } }],
      },
      {
        key: SEARCH_FIELD_KEYS.team,
        label: 'Team',
        operators: [
          {
            key: 'is',
            label: 'is',
            value: {
              type: 'enum',
              values: teams.map((team) => ({ value: team.id, label: team.name })),
            },
          },
        ],
      },
      {
        key: SEARCH_FIELD_KEYS.accountStatus,
        label: 'Account status',
        operators: [
          {
            key: 'is',
            label: 'is',
            value: {
              type: 'enum',
              values: [
                { value: 'active', label: 'Active' },
                { value: 'invited', label: 'Invited' },
                { value: 'no_account', label: 'No account' },
              ],
            },
          },
        ],
      },
      {
        key: SEARCH_FIELD_KEYS.active,
        label: 'Active',
        operators: [
          {
            key: 'is',
            label: 'is',
            value: {
              type: 'enum',
              values: [
                { value: 'active', label: 'Active' },
                { value: 'inactive', label: 'Inactive' },
              ],
            },
          },
        ],
      },
    ],
  };
}

function rowMatchesFilter(row: StudentDisplayRow, filter: PowerSearchFilter): boolean {
  switch (filter.field) {
    case SEARCH_FIELD_KEYS.name: {
      if (filter.value.type !== 'string') return true;
      const needle = filter.value.value.trim().toLowerCase();
      return needle.length === 0 || row.name.toLowerCase().includes(needle);
    }
    case SEARCH_FIELD_KEYS.team: {
      if (filter.value.type !== 'enum') return true;
      return row.teamId === filter.value.value;
    }
    case SEARCH_FIELD_KEYS.accountStatus: {
      if (filter.value.type !== 'enum') return true;
      return row.accountStatus === filter.value.value;
    }
    case SEARCH_FIELD_KEYS.active: {
      if (filter.value.type !== 'enum') return true;
      const wantsActive = filter.value.value === 'active';
      return row.isActive === wantsActive;
    }
    default:
      return true;
  }
}

function matchesAllFilters(row: StudentDisplayRow, filters: readonly PowerSearchFilter[]): boolean {
  return filters.every((filter) => rowMatchesFilter(row, filter));
}

// ---------------------------------------------------------------------------
// Row action stubs -- module doc #8. T089: only "View history" remains a
// stub (`EDIT_STUB_NOTICE`/`INVITE_PARENT_STUB_NOTICE`/
// `inviteStudentStubNotice` are removed -- Edit/Invite parent/Invite are all
// real now, module docs #8a/#8b/#8c).
// ---------------------------------------------------------------------------

interface StubNotice {
  title: string;
  description: string;
}

function viewHistoryStubNotice(name: string): StubNotice {
  return {
    title: 'Student history page not built yet',
    description: `Viewing ${name}'s history would open a per-student detail page. No such route exists yet, so nothing was opened.`,
  };
}

// ---------------------------------------------------------------------------
// Feedback banner -- module doc #11. Real success/error messaging for
// Deactivate/Reactivate, same shape `InvitesTab.tsx`'s own `FeedbackBanner`
// already established for its Resend/Revoke flows.
// ---------------------------------------------------------------------------

interface FeedbackBanner {
  status: 'success' | 'error';
  title: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Table columns. Module doc #10.
// ---------------------------------------------------------------------------

interface BuildColumnsArgs {
  onEdit: (row: StudentDisplayRow) => void;
  onInvite: (row: StudentDisplayRow) => void;
  onInviteParent: (row: StudentDisplayRow) => void;
  onDeactivate: (row: StudentDisplayRow) => void;
  onReactivate: (row: StudentDisplayRow) => void;
  onViewHistory: (row: StudentDisplayRow) => void;
}

function buildRowMenuItems(row: StudentDisplayRow, args: BuildColumnsArgs): DropdownMenuOption[] {
  const items: DropdownMenuOption[] = [{ label: 'Edit', onClick: () => args.onEdit(row) }];

  // Module doc #2: the ONLY place the "Invite (if email)" condition gates
  // menu-item visibility.
  if (shouldShowInviteAction(row.accountStatus)) {
    items.push({ label: 'Invite', onClick: () => args.onInvite(row) });
  }

  items.push({ label: 'Invite parent', onClick: () => args.onInviteParent(row) });

  // Module doc #5: Deactivate (destructive-framed, AlertDialog) vs.
  // Reactivate (non-destructive, direct flip) -- never both at once.
  if (row.isActive) {
    items.push({ label: 'Deactivate', onClick: () => args.onDeactivate(row) });
  } else {
    items.push({ label: 'Reactivate', onClick: () => args.onReactivate(row) });
  }

  items.push({ label: 'View history', onClick: () => args.onViewHistory(row) });

  return items;
}

function buildColumns(args: BuildColumnsArgs): TableColumn<StudentDisplayRow>[] {
  return [
    {
      key: 'name',
      header: 'Student',
      width: proportional(2),
      renderCell: (row) => (
        <HStack gap={2} vAlign="center">
          <Avatar name={row.name} size="small" />
          <Text weight="semibold">{row.name}</Text>
          {!row.isActive && <Badge variant="neutral" label="Deactivated" />}
        </HStack>
      ),
    },
    {
      key: 'teamName',
      header: 'Team',
      width: proportional(1),
      renderCell: (row) => <Badge variant="neutral" label={row.teamName} />,
    },
    {
      key: 'gradYear',
      header: 'Grad year',
      width: pixel(110),
      renderCell: (row) => <Text hasTabularNumbers>{row.gradYear ?? '—'}</Text>,
    },
    {
      key: 'accountStatus',
      header: 'Account status',
      width: pixel(180),
      renderCell: (row) => {
        const meta = ACCOUNT_STATUS_META[row.accountStatus];
        return (
          <HStack gap={2} vAlign="center">
            <StatusDot variant={meta.variant} label={meta.label} />
            <Text>{meta.label}</Text>
          </HStack>
        );
      },
    },
    {
      key: 'goalHoursOverride',
      header: 'Goal override',
      width: pixel(140),
      align: 'end',
      renderCell: (row) => (
        <Text hasTabularNumbers color={row.goalHoursOverride === null ? 'secondary' : 'primary'}>
          {row.goalHoursOverride === null ? '—' : `${row.goalHoursOverride} hrs`}
        </Text>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: pixel(64),
      align: 'end',
      renderCell: (row) => (
        <MoreMenu items={buildRowMenuItems(row, args)} label={`Actions for ${row.name}`} />
      ),
    },
  ];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const EMPTY_ROWS: StudentDisplayRow[] = [];
const EMPTY_TEAMS: readonly TeamRow[] = [];
const EMPTY_INVITES: readonly InviteRow[] = [];

export interface StudentsTabProps {
  /** Injectable data-loading seam (module doc #4). Defaults to a real query
   * against `students`/`teams`/`invites` (T089, `loadStudentsTabData`). */
  loadData?: LoadStudentsTabDataFn;
  /** Injectable create seam (module doc #4/#14). Defaults to a real
   * `students` insert (T089, `createStudent`). */
  onCreateStudent?: CreateStudentFn;
  /** Injectable update seam (module doc #4/#14). Defaults to a real
   * `students` update (T089, `updateStudent`). */
  onUpdateStudent?: UpdateStudentFn;
  /** Injectable deactivate/reactivate seam (module doc #4/#11). Defaults to
   * a real `students.is_active` mutation (T089, `setStudentActive`). */
  onSetStudentActive?: SetStudentActiveFn;
}

export function StudentsTab({
  loadData = loadStudentsTabData,
  onCreateStudent = createStudent,
  onUpdateStudent = updateStudent,
  onSetStudentActive = setStudentActive,
}: StudentsTabProps = {}): ReactNode {
  const loadState = useLoadState(loadData, [loadData]);
  const [rows, setRows] = useState<StudentDisplayRow[]>(EMPTY_ROWS);
  // T089 (module doc #12/#14): the REAL, full team/invite lists from the
  // most recent successful load -- kept separately from `rows` (the derived
  // display shape) so `handleSubmitStudent` can rebuild a display row for a
  // just-created/just-edited student without a full reload, and so
  // `dialogTeamOptions` (module doc #12) can offer every real team
  // (including ones with zero current students), not just the
  // `rows`-derived subset `teams` below covers for `PowerSearch`.
  const [loadedTeams, setLoadedTeams] = useState<readonly TeamRow[]>(EMPTY_TEAMS);
  const [loadedInvites, setLoadedInvites] = useState<readonly InviteRow[]>(EMPTY_INVITES);
  const [filters, setFilters] = useState<ReadonlyArray<PowerSearchFilter>>([]);
  const [stubNotice, setStubNotice] = useState<StubNotice | null>(null);
  const [feedback, setFeedback] = useState<FeedbackBanner | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<StudentDisplayRow | null>(null);
  // T089 (module doc #13): drives the one rendered `<StudentDialog>`
  // instance -- create mode when `isAddDialogOpen`, edit mode when
  // `editTarget !== null`. Both are reset together by the dialog's own
  // `onOpenChange={false}` below.
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<StudentDisplayRow | null>(null);
  const [inviteParentTarget, setInviteParentTarget] = useState<StudentDisplayRow | null>(null);

  useEffect(() => {
    if (loadState.status === 'success') {
      setRows(
        buildDisplayRows(loadState.data.students, loadState.data.teams, loadState.data.invites),
      );
      setLoadedTeams(loadState.data.teams);
      setLoadedInvites(loadState.data.invites);
    }
  }, [loadState]);

  const teams = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>();
    for (const row of rows) {
      byId.set(row.teamId, { id: row.teamId, name: row.teamName });
    }
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const searchConfig = useMemo(() => buildSearchConfig(teams), [teams]);

  const filteredRows = useMemo(
    () => rows.filter((row) => matchesAllFilters(row, filters)),
    [rows, filters],
  );

  // Module doc #12: verbatim map, `id`/`name`/`archived` -- `StudentDialog`'s
  // own `filterSelectableTeams` is the ONLY place archived teams are
  // excluded, not duplicated here.
  const dialogTeamOptions: StudentDialogTeamOption[] = useMemo(
    () => loadedTeams.map((team) => ({ id: team.id, name: team.name, archived: team.archived })),
    [loadedTeams],
  );

  function handleEdit(row: StudentDisplayRow): void {
    setEditTarget(row);
  }

  // Module doc #8c/#14 (Trap #3 decision): "Invite" reuses the same real
  // edit dialog as "Edit" -- `StudentDialog`'s own `inviteEmail` field is
  // the real invite-composition mechanism, not a separate one-off dialog.
  function handleInvite(row: StudentDisplayRow): void {
    setEditTarget(row);
  }

  function handleInviteParent(row: StudentDisplayRow): void {
    setInviteParentTarget(row);
  }

  function handleViewHistory(row: StudentDisplayRow): void {
    setStubNotice(viewHistoryStubNotice(row.name));
  }

  // Module doc #11: optimistic flip + real mutation + rollback-on-failure,
  // mirrored from `RsvpControl.tsx`'s own `handleChange`.
  async function handleReactivate(row: StudentDisplayRow): Promise<void> {
    setRows((prev) => withActiveOverride(prev, row.id, true));
    try {
      await onSetStudentActive(row.id, true);
      setFeedback({
        status: 'success',
        title: 'Student reactivated',
        description: `${row.name} is active again and will appear on future expected rosters.`,
      });
    } catch (error) {
      setRows((prev) => withActiveOverride(prev, row.id, false));
      setFeedback({
        status: 'error',
        title: "Couldn't reactivate student",
        description: isSupabaseLoaderError(error)
          ? error.message
          : `Something went wrong reactivating ${row.name}. Try again in a moment.`,
      });
    }
  }

  async function handleConfirmDeactivate(): Promise<void> {
    if (deactivateTarget === null) return;
    const target = deactivateTarget;
    setRows((prev) => withActiveOverride(prev, target.id, false));
    setDeactivateTarget(null);
    try {
      await onSetStudentActive(target.id, false);
      setFeedback({
        status: 'success',
        title: 'Student deactivated',
        description: `${target.name} is marked inactive. Their history and past metrics are preserved.`,
      });
    } catch (error) {
      setRows((prev) => withActiveOverride(prev, target.id, true));
      setFeedback({
        status: 'error',
        title: "Couldn't deactivate student",
        description: isSupabaseLoaderError(error)
          ? error.message
          : `Something went wrong deactivating ${target.name}. Try again in a moment.`,
      });
    }
  }

  // Module doc #14: the real `onSubmit` passed to `<StudentDialog>` --
  // create/edit mutation, plus the Trap #3 invite-on-submit flow.
  async function handleSubmitStudent(
    payload: StudentFormPayload,
    mode: StudentDialogMode,
  ): Promise<void> {
    const writePayload = toStudentWritePayload(payload);

    let studentRow: StudentRow;
    if (mode === 'create') {
      studentRow = await onCreateStudent(writePayload);
    } else {
      if (editTarget === null) {
        // Defensive only -- `StudentDialog` only calls `onSubmit` with
        // `mode === 'edit'` when it was opened with `initialData`, which
        // this file only ever supplies when `editTarget !== null` (module
        // doc #13/#14).
        throw new Error('No student selected to edit.');
      }
      studentRow = await onUpdateStudent(editTarget.id, writePayload);
    }

    let displayRow = buildDisplayRows([studentRow], loadedTeams, loadedInvites)[0];

    if (payload.inviteEmail !== null) {
      // Module doc #14 (Trap #3): fires AFTER the students write already
      // succeeded -- see that module doc for the disclosed duplicate-row
      // risk if this call fails in create mode.
      await invokeEdgeFunction('send-invite', {
        email: payload.inviteEmail,
        role: 'student',
        student_id: studentRow.id,
      });
      displayRow = withInvitedStatus([displayRow], displayRow.id)[0];
    }

    setRows((prev) =>
      mode === 'create'
        ? withCreatedStudent(prev, displayRow)
        : withEditedStudent(prev, displayRow),
    );
  }

  // Deliberately NOT memoized: every handler below is either a constant
  // closure (no external state) or a functional `setRows`/`setState` update
  // (no stale-state risk), so recomputing this small array each render is
  // both cheap and correct -- no `useMemo`-with-empty-deps
  // stale-closure trap to reason about.
  const columns = buildColumns({
    onEdit: handleEdit,
    onInvite: handleInvite,
    onInviteParent: handleInviteParent,
    onDeactivate: (row) => setDeactivateTarget(row),
    onReactivate: (row) => {
      void handleReactivate(row);
    },
    onViewHistory: handleViewHistory,
  });

  if (loadState.status === 'loading') {
    return (
      <VStack gap={4} padding={6} aria-busy="true">
        <VisuallyHidden as="div" role="status">
          Loading students…
        </VisuallyHidden>
        <Skeleton width={120} height={28} />
        <VStack gap={2}>
          {[0, 1, 2, 3, 4].map((row) => (
            <HStack key={row} gap={4} vAlign="center">
              <Skeleton width={160} height={16} index={row * 3} />
              <Skeleton width={100} height={16} index={row * 3 + 1} />
              <Skeleton width={80} height={16} index={row * 3 + 2} />
            </HStack>
          ))}
        </VStack>
      </VStack>
    );
  }

  if (loadState.status === 'error') {
    return (
      <VStack gap={4} padding={6}>
        <Banner
          status="error"
          title="Couldn't load students"
          description="Something went wrong loading the student roster. Try refreshing the page."
          endContent={<Button variant="ghost" label="Retry" onClick={loadState.retry} />}
        />
      </VStack>
    );
  }

  return (
    <VStack gap={4} padding={6}>
      <Heading level={1}>Students</Heading>

      {stubNotice !== null && (
        <Banner
          status="info"
          title={stubNotice.title}
          description={stubNotice.description}
          isDismissable
          onDismiss={() => setStubNotice(null)}
        />
      )}

      {feedback !== null && (
        <Banner
          status={feedback.status}
          title={feedback.title}
          description={feedback.description}
          isDismissable
          onDismiss={() => setFeedback(null)}
        />
      )}

      <PowerSearch
        label="Filter students"
        placeholder="Search by name, or filter by team, account status, active…"
        config={searchConfig}
        filters={filters}
        onChange={(newFilters) => setFilters(newFilters)}
        resultCount={filteredRows.length}
      />

      <HStack gap={2} hAlign="end">
        <Button label="Add student" variant="primary" onClick={() => setIsAddDialogOpen(true)} />
      </HStack>

      {rows.length === 0 ? (
        <EmptyState
          headingLevel={2}
          title="No students on the roster yet"
          description="Students added to this program will show up here."
        />
      ) : filteredRows.length === 0 ? (
        <EmptyState
          headingLevel={2}
          title="No students match these filters"
          description="Try clearing the search filters."
        />
      ) : (
        <Table
          data={filteredRows}
          columns={columns}
          idKey="id"
          density="balanced"
          dividers="rows"
          hasHover
        />
      )}

      <AlertDialog
        isOpen={deactivateTarget !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setDeactivateTarget(null);
        }}
        title={`Deactivate ${deactivateTarget?.name ?? ''}?`}
        description="This removes them from future expected rosters and leaderboards. Their history and past metrics are preserved, and they'll still show up here (marked inactive) — you can reactivate them at any time."
        actionLabel="Deactivate"
        onAction={() => {
          void handleConfirmDeactivate();
        }}
      />

      {/* Module doc #13: ONE rendered instance, create vs. edit decided
          purely by whether `initialData` is supplied. */}
      <StudentDialog
        isOpen={isAddDialogOpen || editTarget !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setIsAddDialogOpen(false);
            setEditTarget(null);
          }
        }}
        initialData={editTarget !== null ? toStudentDialogInitialData(editTarget) : undefined}
        teams={dialogTeamOptions}
        // Module doc #12: `season` is deliberately omitted here -- falls
        // back to `StudentDialog`'s own fixture default (`DEFAULT_SEASON_INFO`).
        // T091 (a parallel, independently-dispatched packet) owns real
        // season-data wiring; threading it through here now would create a
        // false ordering dependency between the two packets.
        onSubmit={handleSubmitStudent}
      />

      <InviteParentDialog
        isOpen={inviteParentTarget !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setInviteParentTarget(null);
        }}
        student={
          inviteParentTarget !== null
            ? ({
                id: inviteParentTarget.id,
                displayName: inviteParentTarget.name,
              } satisfies InviteParentStudentOption)
            : { id: '', displayName: '' }
        }
        additionalStudentOptions={rows.map((row) => ({ id: row.id, displayName: row.name }))}
      />
    </VStack>
  );
}

export default StudentsTab;
