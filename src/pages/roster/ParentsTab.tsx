/**
 * T025: Parents tab (ROS-04) -- `Table` of parent rows: linked-student
 * `AvatarGroup`, invite status, row `MoreMenu` -> Edit links (stub), Resend
 * invite, Remove (unlink + deactivate profile, `AlertDialog`).
 *
 * This is a STANDALONE component per this task's packet -- same posture
 * `StudentsTab.tsx` (T022) took: not wired into `RosterShell.tsx` (a
 * forbidden, read-only file here; T021 already shipped a placeholder
 * `EmptyState` in its Parents tab panel naming this task as the one that
 * eventually fills that slot).
 *
 * -----------------------------------------------------------------------
 * 1. Ground truth -- real column shapes, read directly from the real
 *    migrations (constitution item 3), NOT invented/renamed with extra
 *    fields:
 *
 *    `profiles` (`supabase/migrations/20260716000000_identity_roster.sql`
 *    lines 16-24): id, display_name, email, role (`role_enum`), avatar_url
 *    (`text not null`), theme_mode, created_at. A "parent" with a real
 *    account is a `profiles` row with `role = 'parent'`.
 *
 *    `guardian_links` (same file, lines 72-79): id, parent_profile_id (fk
 *    `profiles`), student_id (fk `students`), relationship, created_at,
 *    unique `(parent_profile_id, student_id)`. `relationship` is real but
 *    unused here -- ROS-04's literal text doesn't ask this tab to render it,
 *    so it's deliberately omitted from `GuardianLinkRow` below (same
 *    "verbatim subset, not the whole row" posture `StudentRow`/`TeamRow`/
 *    `InviteRow` already took in `StudentsTab.tsx`).
 *
 *    `students` (same file, lines 59-68): only `id`/`display_name` are
 *    needed here, to resolve a linked student's name for its `Avatar`.
 *
 *    `invites` (`supabase/migrations/20260717000000_scheduling_attendance.sql`
 *    lines 18-27): id, email, role, student_id (nullable -- "self for
 *    students, linked kid for parents" per that column's own migration
 *    comment), invited_by, status (`'pending' | 'accepted' | 'expired' |
 *    'revoked'`), expires_at. A "parent" who hasn't accepted an invite yet
 *    has NO `profiles` row at all -- they exist only as a `role='parent'`
 *    `invites` row targeting the child they're being invited for.
 *
 * -----------------------------------------------------------------------
 * 2. Known Context/Traps #1 (SEC-01) -- email visible only to admin/coach.
 *
 * This tab is coach/admin-only, enforced the same way `RosterShell.tsx`
 * (T021) established and several sibling standalone content pages already
 * reused directly (`SeasonSettings.tsx`, `LiveConsole.tsx`,
 * `ReportsShell.tsx` all nest `RequireRole` inside their own render tree):
 * `RequireRole` wraps the real content (`ParentsTabBody`) inside the gated
 * default export (`ParentsTab`) -- a `LiveConsoleBody`/`LiveConsolePage`
 * split, module doc #2 below (`router.tsx`'s `/roster` route has no role
 * gate of its own -- a forbidden, read-only file here, and the same
 * already-disclosed recurring gap every prior content page has hit).
 * Disclosed, mixed sibling precedent either way:
 * `StudentsTab.tsx`, `InvitesTab.tsx`, and `TeamsTab.tsx` (other roster tabs
 * in this same directory, all forbidden/read-only or out-of-scope here) do
 * NOT self-gate with `RequireRole` -- confirmed by grepping each directly,
 * zero `RequireRole`/`guards` references in any of them. That looks like an
 * unaddressed gap in those tasks' own packets, not a considered decision to
 * imitate; meanwhile `SeasonSettings.tsx`, `LiveConsole.tsx`, and
 * `ReportsShell.tsx` (standalone pages outside this directory) DO nest
 * `RequireRole` exactly this way. This task's own packet Dependencies
 * section specifically instructs reading `RosterShell.tsx` for "the
 * established `RequireRole`-nesting pattern" and this task's own Known
 * Context/Traps names SEC-01 explicitly (neither of which the other roster
 * tabs' packets are known to have done) -- so this file follows that
 * explicit instruction and the `RequireRole`-nesting precedent rather than
 * the sibling roster tabs' silent gap.
 * Because the viewer is always coach/admin, SEC-01 permits showing a
 * parent's email here -- no masking needed. What IS deliberately minimized:
 * this component never renders a profile-backed parent's email at all (only
 * their `display_name`) -- `invites` has no display-name column, so an
 * invite-only row (no profile yet) has no name to show and uses its email
 * as the only available identifier, which is not "gratuitous" PII (it's the
 * sole identifier that exists for that row), never shown alongside a
 * redundant already-known name. No student or other parent ever reaches
 * this component (route-level RequireRole + this component's own nested
 * RequireRole both gate on coach/admin), so "never show a parent's email to
 * a student/another parent" has no reachable surface in this task -- stated
 * explicitly as the reasoning per the packet's own instruction, not left as
 * an unstated assumption.
 *
 * -----------------------------------------------------------------------
 * 3. Known Context/Traps #2 -- "Remove" = unlink + deactivate profile. THE
 *    central trap. Read in full before touching `handleConfirmRemove`.
 *
 * ROS-04's literal text: "Remove (unlink + deactivate profile, AlertDialog)".
 * Two real, separate schema-backed effects are implied for a PROFILE-BACKED
 * parent row:
 *
 *   (a) Unlink -- a real `guardian_links` DELETE. Fully implementable
 *       against the real schema: `unlinkAllStudentsForParent` below deletes
 *       every `guardian_links` row for that `parent_profile_id`.
 *
 *   (b) Deactivate the parent's profile -- CONFIRMED, not guessed: I read
 *       `20260716000000_identity_roster.sql` lines 16-24 directly.
 *       `profiles` has NO `is_active`, `status`, `deactivated_at`, or any
 *       other active/inactive column at all -- only `id, display_name,
 *       email, role, avatar_url, theme_mode, created_at`. This is a GENUINE
 *       SCHEMA GAP, the same class of finding T009's own MINOR follow-ups
 *       already established a precedent for (a real column this feature
 *       needs doesn't exist yet, flagged rather than silently invented).
 *       Per this task's own packet ("this task is UI-only... do not invent
 *       a column/migration"), no migration is added here (`supabase/
 *       migrations/**` is a forbidden, read-only file set for this task
 *       regardless). Instead: `removedProfileIds` is a LOCAL-ONLY React
 *       `Set<string>` of profile ids, entirely client-side UI state, never
 *       written to any `profiles` field or any fixture "row" shape -- it
 *       exists solely so effect (b) is visibly demonstrable in this view
 *       (`Removed` `StatusDot`/`Badge`) and in this task's required test
 *       proof, exactly as honestly as it can be represented without a
 *       schema change. A real implementation of effect (b) needs a
 *       follow-up migration decision (e.g. `profiles.is_active boolean` or
 *       a `status` enum) before it can persist anywhere -- that decision is
 *       explicitly NOT made here.
 *
 * Multi-link interaction (ROS-04's text doesn't specify this -- disclosed
 * judgment call, not a silent guess): a row-level `MoreMenu` acts on the
 * whole PARENT, not one linked student at a time (this task's own Forbidden
 * Files list requires "Edit links" to be an inert disclosure stub, not a
 * real per-link editor -- so there is no shipped UI anywhere in this file
 * to pick "just one" of several links). Given that constraint, a row-level
 * "Remove" that silently unlinked only an arbitrary first link while
 * leaving the rest untouched would be an ambiguous, silently-lossy
 * interaction with no way to choose which link. `unlinkAllStudentsForParent`
 * therefore removes EVERY `guardian_links` row for that parent, and effect
 * (b)'s local "removed" marker is always set alongside it -- "removed from
 * the roster" is treated as a single, unambiguous, all-or-nothing row-level
 * action, not a partial one. `FIXTURE_GUARDIAN_LINKS` includes a
 * two-linked-student parent (Renata Alvarez) specifically to prove this is
 * not vacuous: removing her unlinks BOTH children in one action, not just
 * one -- see this task's worker output / `ParentsTab.test.tsx` for the real
 * proof.
 *
 * A SEPARATE, simpler case: an invite-only row (no profile, no
 * `guardian_links` row can exist yet -- `parent_profile_id` is `not null`)
 * has neither a profile to deactivate nor a link to remove. For these rows,
 * "Remove" degrades to the one real, applicable effect: revoking the
 * pending invite (`invites.status = 'revoked'`, a REAL value already in
 * that column's own check constraint -- no invented status is added).
 * `removeDialogDescription` below renders different, accurate copy for this
 * case rather than reusing the profile-backed row's two-effect copy
 * verbatim for an action that doesn't actually have two effects yet.
 *
 * -----------------------------------------------------------------------
 * 4. Known Context/Traps #3 -- `Remove` confirms via a real `AlertDialog`
 *    (DES-11), copy states both real effects, never "delete".
 *
 * `removeDialogDescription` states the unlink + deactivate effects in plain
 * language for profile-backed rows, and the invite-revoke effect for
 * invite-only rows. Neither uses "delete" (the unlink is a real permanent
 * removal of a `guardian_links` row, but "unlink"/"remove"/"deactivate" is
 * the accurate framing per ROS-04's own vocabulary, not "delete").
 *
 * -----------------------------------------------------------------------
 * 5. Known Context/Traps #4 -- Resend invite: real, working, stub-style.
 *
 * Per this task's packet: "a real, working stub-style action against the
 * `invites` row targeting this parent ... same posture as every other
 * not-yet-wired-to-Supabase action in this batch (injectable callback,
 * obviously-fake default)". Unlike the inert `EDIT_LINKS_STUB_NOTICE`
 * (which changes nothing), `handleResendInvite` REALLY mutates local state:
 * `setInviteStatusForEmail(..., 'pending')` flips every `role='parent'`
 * invite row sharing that email back to `'pending'` (working even after a
 * prior `Remove` revoked it -- "resend" is exactly how a coach would undo a
 * lapsed/revoked invite), then shows an info `Banner` disclosing that a
 * real send would call the real `supabase/functions/send-invite` edge
 * function, which this component cannot reach (no shared Supabase client
 * wired in yet -- Known Context/Traps #6, same posture as every prior
 * content page). Resend has no `AlertDialog` -- it is not destructive,
 * matching `AlertDialog`'s own "Don't: use for non-destructive actions"
 * guidance (`astryx-api.md` "AlertDialog" Best Practices), the same
 * Deactivate-vs-Reactivate reasoning `StudentsTab.tsx` already applied.
 *
 * -----------------------------------------------------------------------
 * 6. Known Context/Traps #5 -- `AvatarGroup` for linked students, empty
 *    case handled explicitly.
 *
 * `renderLinkedStudentsCell` renders a real `AvatarGroup` of up to 3 linked
 * students' `Avatar`s plus an `AvatarGroupOverflow` for any remainder, OR,
 * when a parent currently has zero linked students (a real edge case:
 * either every link was removed, or -- for an invite-only row -- the
 * `invites` row's own `student_id` was somehow null, which the real schema
 * technically allows even for a `role='parent'` row even though the
 * column's own migration comment describes it as "linked kid for
 * parents") -- a plain "No linked students" `Text`, never a broken/empty
 * `AvatarGroup`. `FIXTURE_PARENT_PROFILES` includes Denise Cole
 * specifically to prove the zero-linked-students case is real, not vacuous.
 *
 * -----------------------------------------------------------------------
 * 7. Known Context/Traps #6 -- no shared Supabase client wired in yet.
 *    Deliberate scope, not a gap for this task to solve (same posture as
 *    every prior content page -- `StudentsTab.tsx`/T022,
 *    `OutreachList.tsx`/T038, `ParticipationTab.tsx`/T056).
 *
 * `loadParentsTabData` is the injectable `loadData`-style seam
 * (`LoadParentsTabDataFn`), defaulting to the obviously-fake
 * `defaultLoadParentsTabData` (fixture data typed against the real schema
 * above, fabricated names only per constitution item 6).
 *
 * -----------------------------------------------------------------------
 * 8. No `PowerSearch` here -- a disclosed scope decision, not an omission.
 *
 * Unlike ROS-02's own literal "search by name via PowerSearch" instruction
 * (which `StudentsTab.tsx` implements), ROS-04's literal text names no
 * search/filter requirement for the Parents tab -- only "parent rows with
 * linked students, invite status, row MoreMenu". Adding a `PowerSearch` the
 * PRD doesn't ask for here would be scope invention, not a faithful build
 * of ROS-04.
 *
 * -----------------------------------------------------------------------
 * 9. Fixture data (constitution item 6: no PII, fabricated names only).
 *
 * `FIXTURE_PARENT_PROFILES`/`FIXTURE_GUARDIAN_LINKS`/`FIXTURE_STUDENTS`/
 * `FIXTURE_INVITES` cover:
 *   - Renata Alvarez: profile, TWO linked students (module doc #3's
 *     multi-link Remove proof).
 *   - Marcus Brandt: profile, ONE linked student (the common case).
 *   - Denise Cole: profile, ZERO linked students (module doc #6's empty
 *     `AvatarGroup` proof).
 *   - `harlan.fell@example.com`: invite-only, `status: 'pending'`, one
 *     targeted student -> "Invited" row, no profile.
 *   - `priya.quinn@example.com`: invite-only, `status: 'expired'` -> proves
 *     the non-pending invite-status label.
 *   - Decoy 1: a `role='parent'` invite sharing Renata Alvarez's OWN email
 *     (re-inviting an already-registered parent for a new child) -- proves
 *     the profile-row-wins de-dup in `buildParentDisplayRows` (Renata must
 *     appear exactly ONCE, not twice).
 *   - Decoy 2: a `role='student'` invite -- proves the role filter (a
 *     self-invite for a student must never produce a phantom "parent" row),
 *     the same class of role-filter subtlety `StudentsTab.tsx`'s
 *     `hasPendingSelfInvite` already proved for its own table.
 *
 * -----------------------------------------------------------------------
 * 10. Astryx prop sourcing (constitution item 2) -- every prop used below,
 *     cited directly against `docs/swarm/astryx-api.md`:
 *
 *  - `Table` (lines 738-753): `data`, `columns`, `idKey`, `density`,
 *    `dividers`, `hasHover`. `columns` entries use only `{key, header,
 *    width, align, renderCell}`, the same closed shape `StudentsTab.tsx`
 *    already restricted itself to (constitution item 2 -- `sortable`/
 *    `filter`/`resizable` exist on the installed package's own
 *    `TableColumn<T>` type but are absent from this Props table's own
 *    description, so out of bounds here).
 *  - `pixel`/`proportional` (same "Table" Props table `width` description).
 *  - `Avatar` (lines 464-473): `name`, `src`, `size` used. `src` accepts
 *    `undefined` cleanly (falls back to initials) -- used for invite-only
 *    rows (`avatarUrl: null` -> `undefined`) and for the small number of
 *    linked-student avatars, which have no `avatar_url` column on
 *    `students` at all (only `profiles` has one), so `name`-only initials
 *    is the only honest option for those, never an invented `src`.
 *  - `AvatarGroup` (lines 2667-2676 Props table): `children`, `size` used.
 *    `aria-label` is NOT used even though the installed component's own
 *    source (`node_modules/@astryxdesign/core/src/AvatarGroup/
 *    AvatarGroup.tsx` line 79) accepts one with a `'Avatars'` default --
 *    this Props table's own enumerated list (`children`, `size`, `ref`,
 *    `xstyle`, `data-testid`) omits it, and per constitution item 2 a prop
 *    absent from `astryx-api.md` is presumed hallucinated regardless of
 *    what the installed source additionally happens to accept -- the exact
 *    same "closed Props table wins over the broader installed source"
 *    reasoning `StudentsTab.tsx` already applied to `Table`'s `columns`
 *    shape. The default `'Avatars'` `aria-label` is left as-is.
 *  - `AvatarGroupOverflow`: this component's own `astryx-api.md`
 *    "Components > AvatarGroupOverflow" subsection (line 2681) is
 *    `undefined` -- a real doc-generation gap, the same class
 *    `RosterShell.tsx`/T021 already hit for `Tab`/`Heading`. Per the
 *    mandated cross-check, `node node_modules/@astryxdesign/cli/bin/
 *    astryx.mjs component AvatarGroupOverflow` output (verbatim, relevant
 *    rows) resolves it: `count` (`number`, required) and `children`
 *    (`ReactNode`, optional custom count text). Only `count` is used below
 *    (the default "+N" label is correct; no custom text is needed).
 *  - `Badge` (Props table below line 526): `variant` (`'neutral'` only --
 *    "No account yet"/"Removed" are informational tags, not a repeated
 *    system-status badge, matching `StudentsTab.tsx`'s own reasoning for
 *    picking `'neutral'` for its team-name badge), `label` used.
 *  - `StatusDot` (lines 5873-5879): `variant` (`'success'` active account /
 *    `'warning'` invited / `'neutral'` expired or removed / `'error'`
 *    revoked), `label` used, always paired with a visible `Text` label per
 *    its own "Do: always pair with a visible text label" guidance.
 *  - `MoreMenu` (lines 4809-4817): `items`, `label` used.
 *  - `AlertDialog` (lines 2518-2530): `isOpen`, `onOpenChange`, `title`,
 *    `description`, `actionLabel`, `onAction` used.
 *  - `Banner`: `status`, `title`, `description`, `isDismissable`,
 *    `onDismiss`, same usage `StudentsTab.tsx` already established.
 *  - `EmptyState`: `title`, `description`, `headingLevel` used (no
 *    `actions` -- there is no "invite a parent" flow reachable from THIS
 *    tab per ROS-04's own text; that flow is ROS-05, from a student row).
 *  - `Spinner`: `label` used.
 *  - `Heading`: `level`, `children` used (own `astryx-api.md` subsection is
 *    `undefined`, the same disclosed CLI-cross-checked gap `RosterShell.tsx`
 *    /T021 already hit and resolved identically).
 *  - `Text`: `type`, `color`, `weight` used.
 *  - `VStack`/`HStack` ("Stack" section, lines 350-396): `gap`, `padding`,
 *    `vAlign` used.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertDialog,
  Avatar,
  AvatarGroup,
  AvatarGroupOverflow,
  Badge,
  Banner,
  type DropdownMenuOption,
  EmptyState,
  Heading,
  HStack,
  MoreMenu,
  pixel,
  proportional,
  Spinner,
  StatusDot,
  Table,
  type TableColumn,
  Text,
  VStack,
} from '@astryxdesign/core';
import { RequireRole } from '../../app/guards';

// ---------------------------------------------------------------------------
// Types -- verbatim camelCase renames of real column subsets. Module doc #1.
// ---------------------------------------------------------------------------

export type ProfileRole = 'admin' | 'coach' | 'student' | 'parent';
export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface ParentProfileRow {
  id: string;
  displayName: string;
  email: string;
  avatarUrl: string;
}

export interface GuardianLinkRow {
  id: string;
  parentProfileId: string;
  studentId: string;
}

export interface StudentRow {
  id: string;
  displayName: string;
}

export interface InviteRow {
  id: string;
  email: string;
  role: ProfileRole;
  studentId: string | null;
  status: InviteStatus;
}

export interface ParentsTabLoadResult {
  parentProfiles: readonly ParentProfileRow[];
  guardianLinks: readonly GuardianLinkRow[];
  students: readonly StudentRow[];
  invites: readonly InviteRow[];
}

export type LoadParentsTabDataFn = () => Promise<ParentsTabLoadResult>;

// ---------------------------------------------------------------------------
// Fixture data -- module doc #9. Fabricated names only (constitution item 6).
// ---------------------------------------------------------------------------

const FIXTURE_STUDENTS: readonly StudentRow[] = [
  { id: 'student-elena-park', displayName: 'Elena Park' },
  { id: 'student-mateo-cruz', displayName: 'Mateo Cruz' },
  { id: 'student-owen-brandt', displayName: 'Owen Brandt' },
  { id: 'student-nadia-fell', displayName: 'Nadia Fell' },
  { id: 'student-sasha-reyes', displayName: 'Sasha Reyes' },
];

const FIXTURE_PARENT_PROFILES: readonly ParentProfileRow[] = [
  // Two linked students -- module doc #3/#9's multi-link Remove proof.
  {
    id: 'profile-renata-alvarez',
    displayName: 'Renata Alvarez',
    email: 'renata.alvarez@example.com',
    avatarUrl: '',
  },
  // One linked student -- the common case.
  {
    id: 'profile-marcus-brandt',
    displayName: 'Marcus Brandt',
    email: 'marcus.brandt@example.com',
    avatarUrl: '',
  },
  // Zero linked students -- module doc #6's empty-AvatarGroup proof.
  {
    id: 'profile-denise-cole',
    displayName: 'Denise Cole',
    email: 'denise.cole@example.com',
    avatarUrl: '',
  },
];

const FIXTURE_GUARDIAN_LINKS: readonly GuardianLinkRow[] = [
  {
    id: 'link-alvarez-elena',
    parentProfileId: 'profile-renata-alvarez',
    studentId: 'student-elena-park',
  },
  {
    id: 'link-alvarez-mateo',
    parentProfileId: 'profile-renata-alvarez',
    studentId: 'student-mateo-cruz',
  },
  {
    id: 'link-brandt-owen',
    parentProfileId: 'profile-marcus-brandt',
    studentId: 'student-owen-brandt',
  },
];

const FIXTURE_INVITES: readonly InviteRow[] = [
  // Invite-only, pending -- no profile exists yet.
  {
    id: 'invite-fell-parent',
    email: 'harlan.fell@example.com',
    role: 'parent',
    studentId: 'student-nadia-fell',
    status: 'pending',
  },
  // Invite-only, expired -- proves the non-pending invite-status label.
  {
    id: 'invite-quinn-parent',
    email: 'priya.quinn@example.com',
    role: 'parent',
    studentId: 'student-sasha-reyes',
    status: 'expired',
  },
  // Decoy 1: re-inviting an ALREADY-registered parent (shares Renata's own
  // email) -- must NOT create a second, duplicate "invite-only" row for her.
  {
    id: 'invite-alvarez-decoy',
    email: 'renata.alvarez@example.com',
    role: 'parent',
    studentId: 'student-owen-brandt',
    status: 'pending',
  },
  // Decoy 2: a role='student' self-invite -- must NOT create a phantom
  // "parent" row (role filter proof, module doc #9).
  {
    id: 'invite-nadia-self-decoy',
    email: 'nadia.fell.self@example.com',
    role: 'student',
    studentId: 'student-nadia-fell',
    status: 'pending',
  },
];

// ---------------------------------------------------------------------------
// Pure functions -- exported for direct testing. Module docs #3/#5/#9.
// ---------------------------------------------------------------------------

/**
 * Module doc #3: an email may have multiple `role='parent'` invite rows
 * (one per targeted child, since `invites.student_id` is singular). When
 * combining them into one display row, `'pending'` wins over `'expired'`
 * (still-actionable beats stale) which wins over `'revoked'`; `'accepted'`
 * is a last-resort fallback for a real-schema inconsistency that shouldn't
 * occur in practice (an accepted invite should have produced a profile,
 * which would route that email through the profile-row branch instead --
 * see module doc #3's `buildParentDisplayRows` de-dup).
 */
export function deriveGroupInviteStatus(statuses: readonly InviteStatus[]): InviteStatus {
  if (statuses.includes('pending')) return 'pending';
  if (statuses.includes('expired')) return 'expired';
  if (statuses.includes('revoked')) return 'revoked';
  return 'accepted';
}

export interface LinkedStudentRef {
  id: string;
  name: string;
}

/**
 * Table display row -- `extends Record<string, unknown>` is required by
 * `Table`'s own generic constraint (astryx-api.md "Table" Props table,
 * `data: T[]` description).
 */
export interface ParentDisplayRow extends Record<string, unknown> {
  id: string;
  hasProfile: boolean;
  profileId: string | null;
  inviteEmail: string | null;
  name: string;
  email: string;
  avatarUrl: string | null;
  linkedStudents: readonly LinkedStudentRef[];
  inviteStatus: 'active' | InviteStatus;
  /** UI-only. Module doc #3(b) -- never backed by any real `profiles` column. */
  isRemoved: boolean;
}

/**
 * Module doc #3/#9: builds one row per real parent (`profiles.role='parent'`)
 * plus one row per DISTINCT email among `role='parent'` invites that do NOT
 * already match a real profile's email (invite-only, not-yet-accepted
 * parents). `removedProfileIds` is the UI-only local "deactivated" marker
 * (module doc #3(b)) -- never mutates `parentProfiles` itself.
 */
export function buildParentDisplayRows(
  parentProfiles: readonly ParentProfileRow[],
  guardianLinks: readonly GuardianLinkRow[],
  students: readonly StudentRow[],
  invites: readonly InviteRow[],
  removedProfileIds: ReadonlySet<string>,
): ParentDisplayRow[] {
  const studentNameById = new Map(
    students.map((student) => [student.id, student.displayName] as const),
  );
  const profileEmails = new Set(parentProfiles.map((profile) => profile.email));

  const profileRows: ParentDisplayRow[] = parentProfiles.map((profile) => {
    const linkedStudents: LinkedStudentRef[] = guardianLinks
      .filter((link) => link.parentProfileId === profile.id)
      .map((link) => ({
        id: link.studentId,
        name: studentNameById.get(link.studentId) ?? link.studentId,
      }));
    return {
      id: `profile:${profile.id}`,
      hasProfile: true,
      profileId: profile.id,
      inviteEmail: null,
      name: profile.displayName,
      email: profile.email,
      avatarUrl: profile.avatarUrl,
      linkedStudents,
      inviteStatus: 'active',
      isRemoved: removedProfileIds.has(profile.id),
    };
  });

  // Module doc #9 decoy 2: only role='parent' invites count. Module doc #9
  // decoy 1: an invite whose email already matches a real profile never
  // produces a second, duplicate row -- the profile row wins.
  const inviteGroups = new Map<string, InviteRow[]>();
  for (const invite of invites) {
    if (invite.role !== 'parent') continue;
    if (profileEmails.has(invite.email)) continue;
    const existing = inviteGroups.get(invite.email);
    if (existing) existing.push(invite);
    else inviteGroups.set(invite.email, [invite]);
  }

  const inviteOnlyRows: ParentDisplayRow[] = Array.from(inviteGroups.entries()).map(
    ([email, group]) => {
      const linkedStudentIds = Array.from(
        new Set(group.map((invite) => invite.studentId).filter((id): id is string => id !== null)),
      );
      return {
        id: `invite:${email}`,
        hasProfile: false,
        profileId: null,
        inviteEmail: email,
        // `invites` has no display-name column -- module doc #2's disclosed
        // reasoning for why email is the only honest identifier here.
        name: email,
        email,
        avatarUrl: null,
        linkedStudents: linkedStudentIds.map((id) => ({ id, name: studentNameById.get(id) ?? id })),
        inviteStatus: deriveGroupInviteStatus(group.map((invite) => invite.status)),
        isRemoved: false,
      };
    },
  );

  return [...profileRows, ...inviteOnlyRows].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Module doc #3(a): the ONLY place `guardian_links` rows are ever removed in
 * this file. Removes EVERY link for the given parent (the disclosed
 * all-or-nothing row-level Remove reasoning), never just one.
 */
export function unlinkAllStudentsForParent(
  guardianLinks: readonly GuardianLinkRow[],
  parentProfileId: string,
): GuardianLinkRow[] {
  return guardianLinks.filter((link) => link.parentProfileId !== parentProfileId);
}

/**
 * Module doc #3(invite-only Remove)/#5 (Resend): the ONLY place `invites`
 * rows' `status` is ever mutated in this file. Used for BOTH revoking
 * (`'revoked'`, invite-only Remove) and resending (`'pending'`) -- both are
 * real values from `invites.status`'s own check constraint, never invented.
 */
export function setInviteStatusForEmail(
  invites: readonly InviteRow[],
  email: string,
  status: InviteStatus,
): InviteRow[] {
  return invites.map((invite) =>
    invite.role === 'parent' && invite.email === email ? { ...invite, status } : invite,
  );
}

export async function defaultLoadParentsTabData(): Promise<ParentsTabLoadResult> {
  return {
    parentProfiles: FIXTURE_PARENT_PROFILES,
    guardianLinks: FIXTURE_GUARDIAN_LINKS,
    students: FIXTURE_STUDENTS,
    invites: FIXTURE_INVITES,
  };
}

// ---------------------------------------------------------------------------
// Invite-status display metadata. Module doc #10 (StatusDot variant + paired
// visible text label). "Removed" (module doc #3(b)) is handled separately in
// `renderInviteStatusCell` since it can override an otherwise-'active' row.
// ---------------------------------------------------------------------------

const INVITE_STATUS_META: Record<
  'active' | InviteStatus,
  { label: string; variant: 'success' | 'warning' | 'error' | 'neutral' }
> = {
  active: { label: 'Active account', variant: 'success' },
  pending: { label: 'Invited', variant: 'warning' },
  expired: { label: 'Invite expired', variant: 'neutral' },
  revoked: { label: 'Invite revoked', variant: 'error' },
  // Real-schema edge case (module doc #3's deriveGroupInviteStatus doc) --
  // shouldn't occur in practice, but rendered honestly if it ever does.
  accepted: { label: 'Invite accepted (no account yet)', variant: 'neutral' },
};

// ---------------------------------------------------------------------------
// Generic DES-12 load-state hook. Reimplemented locally (not imported from
// the forbidden, read-only `StudentsTab.tsx`) -- same shape every prior
// content page in this batch already established independently.
// ---------------------------------------------------------------------------

type LoadState<T> =
  { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'success'; data: T };

function useLoadState<T>(load: () => Promise<T>, deps: readonly unknown[]): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' });

  useEffect(() => {
    let isMounted = true;
    setState({ status: 'loading' });
    load()
      .then((data) => {
        if (isMounted) setState({ status: 'success', data });
      })
      .catch((error: unknown) => {
        if (isMounted) setState({ status: 'error', error });
      });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` is the caller-supplied dependency list.
  }, deps);

  return state;
}

// ---------------------------------------------------------------------------
// Row action stubs / notices -- module docs #3/#5.
// ---------------------------------------------------------------------------

interface StubNotice {
  title: string;
  description: string;
}

const EDIT_LINKS_STUB_NOTICE: StubNotice = {
  title: 'Edit-links dialog not built yet',
  description:
    "Editing a parent's linked students opens a real edit-linked-students dialog. No such dialog exists in this codebase yet, and building one is out of this task's own objective text (a Table + row MoreMenu, not a dialog) -- this task's Forbidden Files also explicitly require this to be a disclosure stub, not a real editor. Nothing was changed.",
};

function resendInviteNotice(email: string): StubNotice {
  return {
    title: 'Invite marked pending again',
    description: `${email}'s invite status was set back to pending in this view. Actually re-sending the invite email would call the real send-invite function (supabase/functions/send-invite), which this page can't reach yet -- no shared Supabase client is wired in (a separate, not-yet-dispatched task, same as every other content page in this batch).`,
  };
}

function removeDialogTitle(row: ParentDisplayRow): string {
  return row.hasProfile ? `Remove ${row.name}?` : `Revoke invite for ${row.email}?`;
}

/** Module doc #4: states BOTH real effects for a profile-backed row, and the
 * single real effect for an invite-only row -- never "delete". */
function removeDialogDescription(row: ParentDisplayRow): string {
  if (row.hasProfile) {
    const count = row.linkedStudents.length;
    const studentsPhrase =
      count === 0
        ? 'no currently linked students'
        : `${count} linked student${count === 1 ? '' : 's'}`;
    return `This unlinks ${row.name} from ${studentsPhrase} and deactivates their parent account. This can't be undone from here.`;
  }
  return `This revokes the pending invite sent to ${row.email}. They won't be able to accept it, and no account or linked students exist yet, so nothing else changes.`;
}

// ---------------------------------------------------------------------------
// Row rendering helpers. Module doc #10.
// ---------------------------------------------------------------------------

function renderParentNameCell(row: ParentDisplayRow): ReactNode {
  return (
    <HStack gap={2} vAlign="center">
      <Avatar name={row.name} src={row.avatarUrl ?? undefined} size="small" />
      <VStack gap={0.5}>
        <Text weight="semibold">{row.name}</Text>
        <HStack gap={1.5} vAlign="center">
          {!row.hasProfile && <Badge variant="neutral" label="No account yet" />}
          {row.isRemoved && <Badge variant="neutral" label="Removed" />}
        </HStack>
      </VStack>
    </HStack>
  );
}

const MAX_VISIBLE_AVATARS = 3;

function renderLinkedStudentsCell(row: ParentDisplayRow): ReactNode {
  if (row.linkedStudents.length === 0) {
    return <Text color="secondary">No linked students</Text>;
  }
  const visible = row.linkedStudents.slice(0, MAX_VISIBLE_AVATARS);
  const overflowCount = row.linkedStudents.length - visible.length;
  return (
    <AvatarGroup size="small">
      {visible.map((student) => (
        <Avatar key={student.id} name={student.name} size="small" />
      ))}
      {overflowCount > 0 && <AvatarGroupOverflow count={overflowCount} />}
    </AvatarGroup>
  );
}

function renderInviteStatusCell(row: ParentDisplayRow): ReactNode {
  const meta = row.isRemoved
    ? { label: 'Removed', variant: 'neutral' as const }
    : INVITE_STATUS_META[row.inviteStatus];
  return (
    <HStack gap={2} vAlign="center">
      <StatusDot variant={meta.variant} label={meta.label} />
      <Text>{meta.label}</Text>
    </HStack>
  );
}

// ---------------------------------------------------------------------------
// Table columns. Module doc #10.
// ---------------------------------------------------------------------------

interface BuildColumnsArgs {
  onEditLinks: (row: ParentDisplayRow) => void;
  onResendInvite: (row: ParentDisplayRow) => void;
  onRemove: (row: ParentDisplayRow) => void;
}

function buildRowMenuItems(row: ParentDisplayRow, args: BuildColumnsArgs): DropdownMenuOption[] {
  const items: DropdownMenuOption[] = [
    { label: 'Edit links', onClick: () => args.onEditLinks(row) },
  ];

  if (!row.hasProfile) {
    items.push({ label: 'Resend invite', onClick: () => args.onResendInvite(row) });
  }

  const canRemove = row.hasProfile ? !row.isRemoved : row.inviteStatus !== 'revoked';
  if (canRemove) {
    items.push({ label: 'Remove', onClick: () => args.onRemove(row) });
  }

  return items;
}

function buildColumns(args: BuildColumnsArgs): TableColumn<ParentDisplayRow>[] {
  return [
    {
      key: 'name',
      header: 'Parent',
      width: proportional(2),
      renderCell: renderParentNameCell,
    },
    {
      key: 'linkedStudents',
      header: 'Linked students',
      width: proportional(2),
      renderCell: renderLinkedStudentsCell,
    },
    {
      key: 'inviteStatus',
      header: 'Invite status',
      width: pixel(200),
      renderCell: renderInviteStatusCell,
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

const EMPTY_LOAD_RESULT: ParentsTabLoadResult = {
  parentProfiles: [],
  guardianLinks: [],
  students: [],
  invites: [],
};

export interface ParentsTabProps {
  /** Injectable data-loading seam (module doc #7). Defaults to fixture data. */
  loadData?: LoadParentsTabDataFn;
}

/**
 * UNGATED body -- all real content/logic lives here, exported directly so
 * tests can exercise it without needing an `AuthProvider`/`MemoryRouter`
 * login dance for every single assertion. `ParentsTab` (below) is the real,
 * GATED default export a caller should actually use; this split mirrors
 * `LiveConsole.tsx`'s own `LiveConsoleBody`/`LiveConsolePage` precedent
 * directly (module doc #2).
 */
export function ParentsTabBody({
  loadData = defaultLoadParentsTabData,
}: ParentsTabProps = {}): ReactNode {
  const loadState = useLoadState(loadData, [loadData]);
  const [data, setData] = useState<ParentsTabLoadResult>(EMPTY_LOAD_RESULT);
  const [removedProfileIds, setRemovedProfileIds] = useState<ReadonlySet<string>>(new Set());
  const [stubNotice, setStubNotice] = useState<StubNotice | null>(null);
  const [removeTarget, setRemoveTarget] = useState<ParentDisplayRow | null>(null);

  useEffect(() => {
    if (loadState.status === 'success') {
      setData(loadState.data);
    }
  }, [loadState]);

  const rows = useMemo(
    () =>
      buildParentDisplayRows(
        data.parentProfiles,
        data.guardianLinks,
        data.students,
        data.invites,
        removedProfileIds,
      ),
    [data, removedProfileIds],
  );

  function handleEditLinks(): void {
    setStubNotice(EDIT_LINKS_STUB_NOTICE);
  }

  function handleResendInvite(row: ParentDisplayRow): void {
    if (row.inviteEmail === null) return;
    const email = row.inviteEmail;
    setData((prev) => ({
      ...prev,
      invites: setInviteStatusForEmail(prev.invites, email, 'pending'),
    }));
    setStubNotice(resendInviteNotice(row.email));
  }

  function handleConfirmRemove(): void {
    const target = removeTarget;
    if (target === null) return;
    if (target.hasProfile && target.profileId !== null) {
      const profileId = target.profileId;
      setData((prev) => ({
        ...prev,
        guardianLinks: unlinkAllStudentsForParent(prev.guardianLinks, profileId),
      }));
      setRemovedProfileIds((prev) => {
        const next = new Set(prev);
        next.add(profileId);
        return next;
      });
    } else if (target.inviteEmail !== null) {
      const email = target.inviteEmail;
      setData((prev) => ({
        ...prev,
        invites: setInviteStatusForEmail(prev.invites, email, 'revoked'),
      }));
    }
    setRemoveTarget(null);
  }

  // Deliberately NOT memoized -- every handler is either a constant closure
  // or a functional `setState` update, so recomputing this small array each
  // render is cheap and correct (same reasoning `StudentsTab.tsx` already
  // documented for its own `columns`).
  const columns = buildColumns({
    onEditLinks: handleEditLinks,
    onResendInvite: handleResendInvite,
    onRemove: (row) => setRemoveTarget(row),
  });

  if (loadState.status === 'loading') {
    return (
      <VStack gap={4} padding={6}>
        <Spinner label="Loading parents…" />
      </VStack>
    );
  }

  if (loadState.status === 'error') {
    return (
      <VStack gap={4} padding={6}>
        <Banner
          status="error"
          title="Couldn't load parents"
          description="Something went wrong loading the parent roster. Try refreshing the page."
        />
      </VStack>
    );
  }

  return (
    <VStack gap={4} padding={6}>
      <Heading level={1}>Parents</Heading>

      {stubNotice !== null && (
        <Banner
          status="info"
          title={stubNotice.title}
          description={stubNotice.description}
          isDismissable
          onDismiss={() => setStubNotice(null)}
        />
      )}

      {rows.length === 0 ? (
        <EmptyState
          title="No parents on the roster yet"
          description="Parents with a linked student, or a pending parent invite, will show up here."
        />
      ) : (
        <Table
          data={rows}
          columns={columns}
          idKey="id"
          density="balanced"
          dividers="rows"
          hasHover
        />
      )}

      <AlertDialog
        isOpen={removeTarget !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setRemoveTarget(null);
        }}
        title={removeTarget !== null ? removeDialogTitle(removeTarget) : ''}
        description={removeTarget !== null ? removeDialogDescription(removeTarget) : ''}
        actionLabel="Remove"
        onAction={handleConfirmRemove}
      />
    </VStack>
  );
}

/**
 * GATED default export -- module doc #2. Route-level gate gap in
 * `router.tsx` (forbidden, read-only here) means this component enforces
 * its own coach/admin gate, matching `RosterShell.tsx`'s own established
 * `RequireRole`-nesting mechanism (and `LiveConsole.tsx`'s own
 * `LiveConsolePage` wrapper for the identical Body/Page split).
 */
export function ParentsTab(props: ParentsTabProps = {}): ReactNode {
  return (
    <RequireRole allowedRoles={['coach', 'admin']}>
      <ParentsTabBody {...props} />
    </RequireRole>
  );
}

export default ParentsTab;
