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
 * 4. Known Context/Traps #3 -- no shared Supabase client wired in yet.
 *    Deliberate scope, not a gap for this task to solve (same posture as
 *    every prior content page -- `OutreachList.tsx`/T038,
 *    `ParticipationTab.tsx`/T056, `MeetingsList.tsx`/T030).
 *
 * `loadStudentsTabData` is the injectable `loadData`-style seam
 * (`LoadStudentsTabDataFn`), defaulting to the obviously-fake
 * `defaultLoadStudentsTabData` (fixture data typed against the real schema
 * above). A real caller, once a shared Supabase client exists (a separate,
 * not-yet-dispatched task per every other content page's own disclosure),
 * supplies its own `loadData` prop.
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
 * 8. Forbidden-file stubs -- disclosed, not silently built as real dialogs
 *    (per this task's own Forbidden Files list).
 *
 *   a. "Edit" -- `StudentDialog.tsx` (T023, Ready-but-not-dispatched,
 *      forbidden here). Shows an inline disclosure `Banner` instead of a
 *      real edit form.
 *   b. "Invite parent" -- `InviteParentDialog.tsx` (T024, same posture).
 *      Same disclosure-`Banner` stub.
 *   c. "Invite" (module doc #2) -- no student-self-invite composition
 *      dialog exists anywhere in this codebase yet (confirmed via grep: the
 *      only "send-invite" hits under `src/`/`supabase/` are the backend
 *      edge function itself and email-rendering plumbing, never a UI
 *      dialog component). Not one of this task's named Forbidden Files
 *      (unlike Edit/Invite parent, it has no dedicated not-yet-built task
 *      referenced in the packet), but building a real email-entry-and-send
 *      flow is out of THIS task's objective text (`Table` + `PowerSearch` +
 *      columns + row `MoreMenu`, not a dialog). Same disclosure-`Banner`
 *      stub as (a)/(b), naming the real gap (no invite-composition UI
 *      exists yet) rather than silently doing nothing or faking a working
 *      send.
 *   d. "View history" -- no per-student detail/history route exists yet
 *      (`router.tsx`, read-only here, has no `/roster/students/:id` route).
 *      Same disclosure-`Banner` stub.
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
 *  - `EmptyState`: `title`, `description`, `headingLevel` used (no
 *    `actions` -- there is no "create student" flow named anywhere in this
 *    task's objective text, so inventing a button with nowhere real to go
 *    would be fabricated content).
 *  - `Spinner`: `label` used.
 *  - `Heading`: `level`, `children` used (own `astryx-api.md` subsection is
 *    `undefined`, the same disclosed CLI-cross-checked gap `RosterShell.tsx`
 *    /T021 and every other content page already hit; resolved identically).
 *  - `Text`: `type`, `color`, `weight` used.
 *  - `VStack`/`HStack` ("Stack" section, lines 350-396): `gap`, `padding`,
 *    `vAlign`, `hAlign`, `wrap` used.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertDialog,
  Avatar,
  Badge,
  Banner,
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
  Spinner,
  StatusDot,
  Table,
  type TableColumn,
  Text,
  VStack,
} from '@astryxdesign/core';

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

export interface TeamRow {
  id: string;
  name: string;
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

// ---------------------------------------------------------------------------
// Fixture data -- module doc #7. Fabricated names only (constitution item 6).
// ---------------------------------------------------------------------------

const FIXTURE_TEAMS: readonly TeamRow[] = [
  { id: 'team-ironclad', name: 'Ironclad' },
  { id: 'team-voltage', name: 'Voltage' },
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
// PowerSearch config -- module doc #6. Field keys shared between config
// construction and filter matching so the strings can never drift apart.
// ---------------------------------------------------------------------------

const SEARCH_FIELD_KEYS = {
  name: 'studentName',
  team: 'team',
  accountStatus: 'accountStatus',
  active: 'active',
} as const;

function buildSearchConfig(teams: readonly TeamRow[]): PowerSearchConfig {
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
// Row action stubs -- module doc #8.
// ---------------------------------------------------------------------------

interface StubNotice {
  title: string;
  description: string;
}

const EDIT_STUB_NOTICE: StubNotice = {
  title: 'Edit dialog not built yet',
  description:
    "Editing a student opens the student edit dialog (T023, ROS-02). That dialog hasn't shipped yet, so nothing was changed.",
};

const INVITE_PARENT_STUB_NOTICE: StubNotice = {
  title: 'Invite parent dialog not built yet',
  description:
    "Inviting a parent opens the parent-invite dialog (T024, ROS-02). That dialog hasn't shipped yet, so no invite was sent.",
};

function inviteStudentStubNotice(name: string): StubNotice {
  return {
    title: 'Invite flow not built yet',
    description: `Inviting ${name} would open an email-entry dialog that calls the real send-invite function (supabase/functions/send-invite). No such dialog exists in this codebase yet, so no invite was sent.`,
  };
}

function viewHistoryStubNotice(name: string): StubNotice {
  return {
    title: 'Student history page not built yet',
    description: `Viewing ${name}'s history would open a per-student detail page. No such route exists yet, so nothing was opened.`,
  };
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

export interface StudentsTabProps {
  /** Injectable data-loading seam (module doc #4). Defaults to fixture data. */
  loadData?: LoadStudentsTabDataFn;
}

export function StudentsTab({
  loadData = defaultLoadStudentsTabData,
}: StudentsTabProps = {}): ReactNode {
  const loadState = useLoadState(loadData, [loadData]);
  const [rows, setRows] = useState<StudentDisplayRow[]>(EMPTY_ROWS);
  const [filters, setFilters] = useState<ReadonlyArray<PowerSearchFilter>>([]);
  const [stubNotice, setStubNotice] = useState<StubNotice | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<StudentDisplayRow | null>(null);

  useEffect(() => {
    if (loadState.status === 'success') {
      setRows(
        buildDisplayRows(loadState.data.students, loadState.data.teams, loadState.data.invites),
      );
    }
  }, [loadState]);

  const teams = useMemo(() => {
    const byId = new Map<string, TeamRow>();
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

  function handleEdit(): void {
    setStubNotice(EDIT_STUB_NOTICE);
  }

  function handleInvite(row: StudentDisplayRow): void {
    setStubNotice(inviteStudentStubNotice(row.name));
  }

  function handleInviteParent(): void {
    setStubNotice(INVITE_PARENT_STUB_NOTICE);
  }

  function handleViewHistory(row: StudentDisplayRow): void {
    setStubNotice(viewHistoryStubNotice(row.name));
  }

  function handleReactivate(row: StudentDisplayRow): void {
    setRows((prev) => withActiveOverride(prev, row.id, true));
  }

  function handleConfirmDeactivate(): void {
    if (deactivateTarget === null) return;
    setRows((prev) => withActiveOverride(prev, deactivateTarget.id, false));
    setDeactivateTarget(null);
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
    onReactivate: handleReactivate,
    onViewHistory: handleViewHistory,
  });

  if (loadState.status === 'loading') {
    return (
      <VStack gap={4} padding={6}>
        <Spinner label="Loading students…" />
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

      <PowerSearch
        label="Filter students"
        placeholder="Search by name, or filter by team, account status, active…"
        config={searchConfig}
        filters={filters}
        onChange={(newFilters) => setFilters(newFilters)}
        resultCount={filteredRows.length}
      />

      {rows.length === 0 ? (
        <EmptyState
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
        onAction={handleConfirmDeactivate}
      />
    </VStack>
  );
}

export default StudentsTab;
