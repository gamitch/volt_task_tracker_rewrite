/**
 * T027: Invites tab (ROS-07) -- all invites with status (Pending / Accepted /
 * Expired), sent `Timestamp`, Resend/Revoke actions.
 *
 * This is a STANDALONE component per this task's packet -- it is not wired
 * into `RosterShell.tsx` (a forbidden, read-only file here; T021 already
 * shipped a placeholder `EmptyState` in its Invites tab panel naming the
 * T022-T028 range, which includes this task, as the one that eventually
 * fills that slot).
 *
 * -----------------------------------------------------------------------
 * 1. Ground truth -- `invites` column shapes, read directly from the real
 *    migration (constitution item 3), not invented/renamed with extra
 *    fields.
 *
 *    `invites` (`supabase/migrations/20260717000000_scheduling_attendance.sql`
 *    lines 18-27): id, email, role (`role_enum`: 'admin' | 'coach' |
 *    'student' | 'parent'), student_id (nullable), invited_by, status
 *    ('pending' | 'accepted' | 'expired' | 'revoked'), expires_at,
 *    created_at. `InviteRow` below is a verbatim camelCase rename of the
 *    subset this screen needs -- no invented field, no renamed status
 *    vocabulary (all four real status strings are represented, including
 *    'revoked', even though ROS-07's own literal text only names
 *    Pending/Accepted/Expired -- see module doc #3 below for why 'revoked'
 *    is still shown as a fourth, real, `Badge` state rather than hidden).
 *
 * -----------------------------------------------------------------------
 * 2. AUTH-06's 14-day expiry -- a real, testable DISPLAY-status derivation,
 *    not a blind read of the stored `status` column. Packet Known
 *    Context/Trap #1.
 *
 * `supabase/functions/send-invite/validation.ts`'s own `computeExpiresAt`
 * sets `expires_at = created_at + 14 days` (`INVITE_EXPIRY_DAYS = 14`,
 * read-only reference, NOT imported here -- `supabase/functions/send-invite/**`
 * is a forbidden file for this task; `INVITE_EXPIRY_DAYS` is redeclared
 * locally below, verbatim value, for the fixture "Resend" seam only).
 * `deriveInviteDisplayStatus` is the ONE place the four-state display
 * status is decided:
 *   - stored `status === 'accepted'` -> always displays "Accepted",
 *     regardless of `expires_at` (an accepted invite is resolved; a stale
 *     `expires_at` in its row is irrelevant history, never re-derived).
 *   - stored `status === 'revoked'` -> always displays "Revoked" (terminal,
 *     never re-derived from `expires_at` either).
 *   - stored `status === 'expired'` -> always displays "Expired" (trusts an
 *     already-flipped column).
 *   - stored `status === 'pending'` -> derives "Expired" vs. "Pending" by
 *     comparing `expires_at` against "now", NOT by trusting `status`
 *     blindly. This is the packet's core trap: a `pending` row whose
 *     `expires_at` has already passed must still display "Expired" even if
 *     no backend job has flipped the stored column yet (this task does not
 *     build that backend job -- it only builds the honest DISPLAY
 *     derivation).
 * Boundary rule: `expiresAt <= now` -> "Expired" (so an invite sent exactly
 * 14 days ago, whose `expires_at` therefore equals "now" to the millisecond,
 * shows Expired); `expiresAt > now` -> "Pending" (an invite sent 13 days ago
 * has one day of `expires_at` still ahead of "now", so it shows Pending).
 * Proven directly in `InvitesTab.test.tsx`'s
 * "AUTH-06 14-day boundary" describe block, both algebraically (14 days ago
 * -> exactly `now`) and with an explicit past-`expires_at` fixture rendered
 * through the real component, not just asserted against the pure function
 * in isolation.
 *
 * -----------------------------------------------------------------------
 * 3. Why "Revoked" is shown as a real fourth `Badge` state (disclosed
 *    judgment call, not a silent addition).
 *
 * ROS-07's literal text ("all invites with status ... Resend / Revoke")
 * names only three status words (Pending/Accepted/Expired) but ALSO says
 * every invite gets a "Revoke" action -- and the real schema's `status`
 * check constraint has a fourth value, `'revoked'`, that a successful
 * Revoke transitions a row into (see module doc #4). Once a row is revoked,
 * hiding it or mislabeling it as one of the other three would be dishonest
 * (a revoked invite is not "Expired" -- it was deliberately canceled, not
 * timed out) and would also make this file's own Revoke action look like it
 * does nothing (the row's badge would never visibly change). So
 * `INVITE_DISPLAY_STATUS_META` below defines a real "Revoked" `Badge`
 * (`variant='neutral'`, terminal/no-action-needed framing) as the fourth
 * state, and `deriveInviteDisplayStatus` maps stored `status === 'revoked'`
 * to it directly. This is additive to ROS-07's literal three-word list, not
 * a contradiction of it.
 *
 * -----------------------------------------------------------------------
 * 4. Revoke sets `invites.status = 'revoked'` only -- the `audit_log` write
 *    is already automatic at the database level. Packet Known Context/Trap
 *    #2, THE single most important ground-truth fact in this packet.
 *
 * `trg_audit_invite_revocation` (`supabase/migrations/20260717000001_support_audit.sql`
 * lines 253-276, already-applied migration, read-only reference here) is a
 * real, live Postgres trigger:
 *
 *   create trigger trg_audit_invite_revocation
 *     after update on public.invites
 *     for each row
 *     when (old.status is distinct from new.status and new.status = 'revoked')
 *     execute function public.fn_audit_invite_revocation();
 *
 * `fn_audit_invite_revocation()` itself inserts one `audit_log` row
 * (`action='invite_revoked'`, `entity='invites'`, `entity_id=new.id`,
 * `meta={old_status, new_status}`) automatically whenever an `invites` row's
 * `status` transitions TO `'revoked'`. This means DATA-02's audit-log
 * requirement for invite revocation is ALREADY satisfied at the database
 * level, before this task exists. Consequently, `RevokeInviteFn` below
 * (and its fixture default, `defaultOnRevokeInvite`) does exactly one
 * thing conceptually: "set this invite's `status` to `'revoked'`" -- no
 * `audit_log` insert, no `audit_log` import, no `audit_log` reference
 * anywhere in this file. Attempting one here would be redundant with (and
 * could race/conflict with) the trigger, and per the packet's own
 * ground-truth note, `audit_log` almost certainly has no client-writable
 * RLS policy anyway (same posture as every other audit table in this
 * project). CONFIRMED: this file contains zero `audit_log` references --
 * grep-provable.
 *
 * -----------------------------------------------------------------------
 * 5. Per-row Resend/Revoke availability -- packet Known Context/Trap #4,
 *    explicit disclosed reasoning (ROS-07's own text does not specify this).
 *
 * `canResendInvite`/`canRevokeInvite` below both return true for exactly
 * the two "unresolved" display statuses -- "pending" and "expired" -- and
 * false for "accepted" and "revoked":
 *   - Accepted: the invitee already has a real account (see T019's
 *     accept-invite trigger, cited only informationally, not read here --
 *     `student_id`/`profile_id` linkage isn't this task's concern). There is
 *     nothing left to resend (the invite link already worked) and nothing
 *     meaningful to revoke (revoking access to an account that already
 *     exists is not what this action does -- `invites.status` has no
 *     bearing on an already-created `profiles` row).
 *   - Revoked: already terminal. Resending a deliberately-canceled invite
 *     would silently un-cancel it through the back door, which is exactly
 *     the kind of surprising, undoing-a-decision behavior `AlertDialog`'s
 *     own "Don't: use AlertDialog for non-destructive actions" posture
 *     argues against normalizing. Revoking an already-revoked row is a
 *     no-op that also would not even satisfy `trg_audit_invite_revocation`'s
 *     own trigger condition (`old.status IS DISTINCT FROM new.status` --
 *     revoked-to-revoked never fires it), so offering it would be a button
 *     that visibly does nothing.
 *   - Pending: the natural target for both -- resend if the email did not
 *     arrive, or revoke if the invite should never have been sent / is no
 *     longer wanted.
 *   - Expired: still a natural target for both -- resend to give the
 *     invitee a fresh 14-day window (see module doc #6), or revoke to
 *     formally cancel a lapsed invite rather than leaving it dangling.
 * Both functions currently evaluate identically (pending/expired -> true,
 * accepted/revoked -> false) for this task's judgment call, but are kept as
 * two separately named, separately tested functions (not one shared
 * boolean) specifically so a future task can diverge them (e.g. blocking
 * Resend-but-not-Revoke on Expired rows) without restructuring this file's
 * gating mechanism -- each call site below calls its own named function,
 * never a shared local.
 *
 * -----------------------------------------------------------------------
 * 6. Resend -- packet Known Context/Trap #3, same posture as
 *    `ParentsTab.tsx`/T025's Resend action and every other not-yet-wired
 *    action in this batch: a real, working callback seam, obviously-fake
 *    default, modeled on `send-invite`'s real request/response contract
 *    (`supabase/functions/send-invite/index.ts`, read-only reference here,
 *    not called directly -- "no shared client exists yet", packet Known
 *    Context/Trap #5).
 *
 * `ResendInviteFn = (invite: InviteRow) => Promise<InviteRow>` mirrors the
 * real function's success response shape (`{ invite: { id, email, role,
 * student_id, status, expires_at, created_at } }`, `index.ts` lines
 * 302-312) minus the outer `{ invite: ... }` wrapper (this seam returns the
 * row directly, since the caller here already knows it is resending one
 * specific invite -- unwrapping is a UI-layer convenience, not a schema
 * change). `defaultOnResendInvite` fabricates a resolved invite with a
 * fresh `expires_at` computed the same way `computeExpiresAt()` does
 * (`now + INVITE_EXPIRY_DAYS days`, `INVITE_EXPIRY_DAYS = 14` redeclared
 * locally per module doc #2) and `status` reset to `'pending'` -- "resend"
 * conceptually gives the invitee a brand-new 14-day window, matching
 * AUTH-06's own expiry rule rather than inventing a different one. A real
 * caller, once a shared Supabase client + a real resend mechanism exist
 * (out of this task's scope, same as every other not-yet-wired action),
 * supplies its own `onResend` prop.
 *
 * -----------------------------------------------------------------------
 * 7. No shared Supabase client wired in yet -- packet Known Context/Trap #5,
 *    deliberate scope, not a gap for this task to solve (same posture as
 *    every prior content page -- `StudentsTab.tsx`/T022,
 *    `OutreachList.tsx`/T038, `ParticipationTab.tsx`/T056).
 *
 * `loadInvitesTabData`/`onResend`/`onRevoke` are the three injectable seams
 * (`LoadInvitesTabDataFn`/`ResendInviteFn`/`RevokeInviteFn`), each defaulting
 * to an obviously-fake fixture-backed implementation. A real caller, once a
 * shared Supabase client exists (a separate, not-yet-dispatched task per
 * every other content page's own disclosure), supplies its own props.
 *
 * -----------------------------------------------------------------------
 * 8. Fixture data (constitution item 6: no PII, fabricated names/emails
 *    only). `FIXTURE_INVITES` deliberately covers:
 *   - `invite-briar-pending`: stored `pending`, `expires_at` genuinely in
 *     the future -> displays Pending.
 *   - `invite-dax-stale-pending`: stored `pending`, but `expires_at`
 *     already in the past (the "backend hasn't flipped the column yet"
 *     case module doc #2 exists for) -> displays Expired, proving the
 *     derivation is real in the rendered component, not just the isolated
 *     pure function.
 *   - `invite-esme-expired`: stored `expired` directly -> displays Expired
 *     via the trusted-column branch.
 *   - `invite-farid-accepted`: stored `accepted` -> displays Accepted,
 *     Resend/Revoke both hidden.
 *   - `invite-greta-revoked`: stored `revoked` -> displays Revoked,
 *     Resend/Revoke both hidden.
 *
 * -----------------------------------------------------------------------
 * 9. DES-12 four states (loading / error / empty / populated) -- same
 *    generic `useLoadState` hook shape every prior content page in this
 *    batch (`StudentsTab.tsx`, `OutreachList.tsx`, `ParticipationTab.tsx`,
 *    `MeetingsList.tsx`) already established.
 *
 * -----------------------------------------------------------------------
 * 10. Astryx prop sourcing (constitution item 2) -- every prop used below,
 *     cited directly against `docs/swarm/astryx-api.md`:
 *
 *  - `Table` ("Table" Props table, `astryx-api.md` lines 738-753): `data`,
 *    `columns`, `idKey`, `density`, `dividers`, `hasHover` used. `columns`
 *    entries use only `{key, header, width, align, renderCell}` -- the
 *    closed shape that Props table itself enumerates (same reasoning
 *    `StudentsTab.tsx`/T022 and `ParticipationTab.tsx`/T056 already applied
 *    to this exact prop).
 *  - `pixel`/`proportional` (same "Table" Props table `width` description)
 *    -- used for every column's `width`.
 *  - `Badge` ("Badge" Props table, lines 526-533): `variant`, `label` used
 *    for both the status column (`INVITE_DISPLAY_STATUS_META`) and the role
 *    column (`variant='neutral'` category tag, identical reasoning
 *    `StudentsTab.tsx`'s team `Badge` already used -- role names are a
 *    closed, small vocabulary but have no documented Badge-variant mapping,
 *    so `'neutral'` is the safe always-valid choice).
 *  - `Timestamp` ("Timestamp" Props table, lines 5974-5987): `value`,
 *    `format` used. `format="date_time"` is used for both the "Sent" and
 *    "Expires" columns (absolute precision matters here -- AUTH-06's 14-day
 *    boundary is exactly the kind of precise-date fact `format="date_time"`
 *    is for, per its own doc's "'date_time' shows 'Mar 21, 2025, 2:51 PM'"
 *    description; `'relative'`/`'auto'` are deliberately not used, since
 *    "2 hours ago" for a 14-day-out expiry is not the precision this table
 *    needs). `hasTooltip`/`isTimezoneShown`/`isLive`/`autoThreshold` are
 *    left at their documented defaults -- no live-updating countdown is
 *    named anywhere in ROS-07's text.
 *  - `MoreMenu` ("MoreMenu" Props table, lines 4809-4817): `items`, `label`
 *    used.
 *  - `AlertDialog` ("AlertDialog" Props table, lines 2518-2530): `isOpen`,
 *    `onOpenChange`, `title`, `description`, `actionLabel`, `onAction`,
 *    `isActionLoading` used. Revoke is exactly the "revoking access"
 *    example the doc's own "Example" section names verbatim
 *    (`astryx-api.md` line 2475: "Use it for things like deleting content,
 *    revoking access, or discarding unsaved changes"), so `AlertDialog`
 *    (not a plain click-to-confirm) is the correct component here.
 *    `isActionLoading` is used while the injected `onRevoke` promise is in
 *    flight, since it is a real async seam that could be slow.
 *  - `Banner` (used identically to `StudentsTab.tsx`'s stub-notice Banner,
 *    repurposed here for real success/error feedback since Resend/Revoke
 *    are real callback seams, not stubs): `status`, `title`, `description`,
 *    `isDismissable`, `onDismiss` used. No `ToastViewport` is wired
 *    anywhere in this app (`OutreachList.tsx`/T038 already confirmed this
 *    via grep -- zero hits for `ToastViewport`/`useToast` under `src/` at
 *    the time of writing, disclosed there and not re-derived here), so a
 *    dismissable `Banner` is used instead of `useToast()`, matching that
 *    same disclosed posture.
 *  - `EmptyState` ("EmptyState" Props table, lines 3991-4001): `title`,
 *    `description`, `headingLevel` used. No `actions` -- there is no
 *    "create invite" flow named anywhere in this task's objective text (the
 *    real invite-creation UI is `StudentsTab.tsx`'s "Invite"/"Invite
 *    parent" stubs, T023/T024's job, not this one's), so inventing a button
 *    with nowhere real to go would be fabricated content.
 *  - `Skeleton` (T081, "Skeleton" section, lines 621-655): `width`,
 *    `height`, `index` used to preview this screen's predictable `Table`
 *    row/column shape, replacing `Spinner`'s prior use here per Astryx's
 *    own guidance (known-dimension content) -- `VisuallyHidden` + the
 *    wrapping `VStack`'s `aria-busy` carry the "Loading invites…"
 *    announcement `Spinner`'s `label` used to provide.
 *  - `Heading`: own `astryx-api.md` subsection (line 882-884) is
 *    `undefined` -- the same disclosed CLI-cross-checked gap
 *    `RosterShell.tsx`/T021 and `StudentsTab.tsx`/T022 already hit.
 *    `npm run astryx -- component Heading` output (verbatim, relevant
 *    rows): `level` (`1 | 2 | 3 | 4 | 5 | 6`, required), `children`
 *    (required). `level={1}` used for this page's own top-level heading.
 *  - `Text` ("Text" Props table, lines 858-878): `type`, `color` used for
 *    the fabricated-email cell text and the "no actions" placeholder.
 *  - `VStack` ("Stack" section, lines 374-395): `gap`, `padding` used for
 *    page-level vertical spacing.
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  AlertDialog,
  Badge,
  Banner,
  Button,
  type DropdownMenuOption,
  EmptyState,
  Heading,
  HStack,
  MoreMenu,
  pixel,
  proportional,
  Skeleton,
  Table,
  type TableColumn,
  Text,
  Timestamp,
  VisuallyHidden,
  VStack,
} from '@astryxdesign/core';

// ---------------------------------------------------------------------------
// Types -- verbatim camelCase renames of real column subsets. Module doc #1.
// ---------------------------------------------------------------------------

export type ProfileRole = 'admin' | 'coach' | 'student' | 'parent';
export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

export interface InviteRow {
  id: string;
  email: string;
  role: ProfileRole;
  studentId: string | null;
  status: InviteStatus;
  expiresAt: string; // ISO timestamp
  createdAt: string; // ISO timestamp -- the "sent" Timestamp ROS-07 names.
}

/** The four real DISPLAY states -- module docs #2/#3. */
export type InviteDisplayStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

/** Table display row -- `extends Record<string, unknown>` per `Table`'s own generic constraint. */
export interface InviteDisplayRow extends Record<string, unknown> {
  id: string;
  email: string;
  role: ProfileRole;
  displayStatus: InviteDisplayStatus;
  sentAt: string;
  expiresAt: string;
}

export interface InvitesTabLoadResult {
  invites: readonly InviteRow[];
}

export type LoadInvitesTabDataFn = () => Promise<InvitesTabLoadResult>;

/** Module doc #6 -- mirrors `send-invite`'s response shape, unwrapped. */
export type ResendInviteFn = (invite: InviteRow) => Promise<InviteRow>;

/** Module doc #4 -- resolves once `invites.status` has been set to `'revoked'`. */
export type RevokeInviteFn = (invite: InviteRow) => Promise<void>;

// ---------------------------------------------------------------------------
// AUTH-06: mirrors `supabase/functions/send-invite/validation.ts`'s own
// `INVITE_EXPIRY_DAYS` constant (read-only reference, not imported --
// module doc #2/#6). Used only by the fixture "Resend" seam below.
// ---------------------------------------------------------------------------

const INVITE_EXPIRY_DAYS = 14;

// ---------------------------------------------------------------------------
// Fixture data -- module doc #8. Fabricated names/emails only (constitution item 6).
// ---------------------------------------------------------------------------

const FIXTURE_INVITES: readonly InviteRow[] = [
  // Pending, expires_at genuinely in the future -> displays Pending.
  {
    id: 'invite-briar-pending',
    email: 'briar.holloway.invite@example.com',
    role: 'student',
    studentId: 'student-briar-holloway',
    status: 'pending',
    createdAt: '2026-07-10T09:00:00.000Z',
    expiresAt: '2026-07-24T09:00:00.000Z',
  },
  // Stored 'pending' but expires_at already in the past -- must derive
  // Expired without any backend job having flipped the column (module doc #2).
  {
    id: 'invite-dax-stale-pending',
    email: 'dax.oduya.invite@example.com',
    role: 'parent',
    studentId: 'student-priya-anand',
    status: 'pending',
    createdAt: '2026-06-20T09:00:00.000Z',
    expiresAt: '2026-07-04T09:00:00.000Z',
  },
  // Stored 'expired' directly -> displays Expired via the trusted-column branch.
  {
    id: 'invite-esme-expired',
    email: 'esme.tanaka.invite@example.com',
    role: 'coach',
    studentId: null,
    status: 'expired',
    createdAt: '2026-06-01T09:00:00.000Z',
    expiresAt: '2026-06-15T09:00:00.000Z',
  },
  // Accepted -> Resend/Revoke both hidden (module doc #5).
  {
    id: 'invite-farid-accepted',
    email: 'farid.marchetti.invite@example.com',
    role: 'admin',
    studentId: null,
    status: 'accepted',
    createdAt: '2026-05-01T09:00:00.000Z',
    expiresAt: '2026-05-15T09:00:00.000Z',
  },
  // Revoked -> Resend/Revoke both hidden (module doc #5).
  {
    id: 'invite-greta-lindqvist',
    email: 'greta.lindqvist.invite@example.com',
    role: 'student',
    studentId: 'student-greta-lindqvist',
    status: 'revoked',
    createdAt: '2026-05-10T09:00:00.000Z',
    expiresAt: '2026-05-24T09:00:00.000Z',
  },
];

// ---------------------------------------------------------------------------
// Pure functions -- exported for direct testing. Module docs #2/#3/#4/#5/#6.
// ---------------------------------------------------------------------------

/**
 * Module doc #2: the ONE place the four-state DISPLAY status is decided.
 * 'accepted'/'revoked'/'expired' stored statuses are trusted as-is;
 * 'pending' is re-derived against `expires_at` vs. `now` (AUTH-06's 14-day
 * boundary). `expiresAt <= now` -> Expired; `expiresAt > now` -> Pending.
 */
export function deriveInviteDisplayStatus(
  status: InviteStatus,
  expiresAt: string,
  now: Date = new Date(),
): InviteDisplayStatus {
  if (status === 'accepted') return 'accepted';
  if (status === 'revoked') return 'revoked';
  if (status === 'expired') return 'expired';
  // status === 'pending'
  const expiresAtMs = new Date(expiresAt).getTime();
  return expiresAtMs <= now.getTime() ? 'expired' : 'pending';
}

/** Module doc #5: Resend is only offered for the two unresolved states. */
export function canResendInvite(displayStatus: InviteDisplayStatus): boolean {
  return displayStatus === 'pending' || displayStatus === 'expired';
}

/** Module doc #5: Revoke is only offered for the two unresolved states. */
export function canRevokeInvite(displayStatus: InviteDisplayStatus): boolean {
  return displayStatus === 'pending' || displayStatus === 'expired';
}

export function buildDisplayRows(
  invites: readonly InviteRow[],
  now: Date = new Date(),
): InviteDisplayRow[] {
  return invites.map((invite) => ({
    id: invite.id,
    email: invite.email,
    role: invite.role,
    displayStatus: deriveInviteDisplayStatus(invite.status, invite.expiresAt, now),
    sentAt: invite.createdAt,
    expiresAt: invite.expiresAt,
  }));
}

/**
 * Module doc #4: the ONLY place `status` is ever set to `'revoked'` in this
 * file. Never inserts into `audit_log` -- `trg_audit_invite_revocation`
 * (already-applied DB trigger, cited in full in module doc #4 above) does
 * that automatically once the real `onRevoke` callback performs the actual
 * database update.
 */
export function withRevokedStatus(invites: readonly InviteRow[], id: string): InviteRow[] {
  return invites.map((invite) => (invite.id === id ? { ...invite, status: 'revoked' } : invite));
}

/** Module doc #6: replaces one row with the resend result, in place. */
export function withResendResult(invites: readonly InviteRow[], updated: InviteRow): InviteRow[] {
  return invites.map((invite) => (invite.id === updated.id ? updated : invite));
}

export async function defaultLoadInvitesTabData(): Promise<InvitesTabLoadResult> {
  return { invites: FIXTURE_INVITES };
}

/** Module doc #6: fabricates a fresh 14-day `expires_at`, resets `status` to `'pending'`. */
export async function defaultOnResendInvite(invite: InviteRow): Promise<InviteRow> {
  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  return { ...invite, status: 'pending', expiresAt };
}

/**
 * Module doc #4/#7: fixture default. Represents "the real database update
 * that sets invites.status = 'revoked' happened" -- nothing else. No
 * audit_log write, no audit_log reference, anywhere in this function.
 */
export async function defaultOnRevokeInvite(): Promise<void> {
  // Deliberately empty: the real, not-yet-wired callback (once a shared
  // Supabase client exists) performs
  // `supabase.from('invites').update({ status: 'revoked' }).eq('id', invite.id)`,
  // and `trg_audit_invite_revocation` does the rest at the database level.
}

// ---------------------------------------------------------------------------
// Status/role display metadata. Module docs #3/#10.
// ---------------------------------------------------------------------------

const INVITE_DISPLAY_STATUS_META: Record<
  InviteDisplayStatus,
  { label: string; variant: 'info' | 'success' | 'warning' | 'neutral' }
> = {
  pending: { label: 'Pending', variant: 'info' },
  accepted: { label: 'Accepted', variant: 'success' },
  expired: { label: 'Expired', variant: 'warning' },
  revoked: { label: 'Revoked', variant: 'neutral' },
};

const ROLE_LABELS: Record<ProfileRole, string> = {
  admin: 'Admin',
  coach: 'Coach',
  student: 'Student',
  parent: 'Parent',
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
// Feedback banner -- real success/error messaging for Resend/Revoke.
// Module doc #10 (Banner citation).
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
  onResend: (row: InviteDisplayRow) => void;
  onRequestRevoke: (row: InviteDisplayRow) => void;
}

function buildRowMenuItems(row: InviteDisplayRow, args: BuildColumnsArgs): DropdownMenuOption[] {
  const items: DropdownMenuOption[] = [];

  // Module doc #5: the ONLY place per-row Resend/Revoke availability is decided.
  if (canResendInvite(row.displayStatus)) {
    items.push({ label: 'Resend', onClick: () => args.onResend(row) });
  }
  if (canRevokeInvite(row.displayStatus)) {
    items.push({ label: 'Revoke', onClick: () => args.onRequestRevoke(row) });
  }

  return items;
}

function buildColumns(args: BuildColumnsArgs): TableColumn<InviteDisplayRow>[] {
  return [
    {
      key: 'email',
      header: 'Invitee',
      width: proportional(2),
      renderCell: (row) => <Text type="body">{row.email}</Text>,
    },
    {
      key: 'role',
      header: 'Role',
      width: pixel(120),
      renderCell: (row) => <Badge variant="neutral" label={ROLE_LABELS[row.role]} />,
    },
    {
      key: 'displayStatus',
      header: 'Status',
      width: pixel(130),
      renderCell: (row) => {
        const meta = INVITE_DISPLAY_STATUS_META[row.displayStatus];
        return <Badge variant={meta.variant} label={meta.label} />;
      },
    },
    {
      key: 'sentAt',
      header: 'Sent',
      width: pixel(180),
      renderCell: (row) => <Timestamp value={row.sentAt} format="date_time" />,
    },
    {
      key: 'expiresAt',
      header: 'Expires',
      width: pixel(180),
      renderCell: (row) => <Timestamp value={row.expiresAt} format="date_time" />,
    },
    {
      key: 'actions',
      header: '',
      width: pixel(64),
      align: 'end',
      renderCell: (row) => {
        const menuItems = buildRowMenuItems(row, args);
        if (menuItems.length === 0) {
          return (
            <Text type="supporting" color="secondary">
              —
            </Text>
          );
        }
        return <MoreMenu items={menuItems} label={`Actions for ${row.email}`} />;
      },
    },
  ];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const EMPTY_ROWS: InviteRow[] = [];

export interface InvitesTabProps {
  /** Injectable data-loading seam (module doc #7). Defaults to fixture data. */
  loadData?: LoadInvitesTabDataFn;
  /** Injectable Resend seam (module doc #6). Defaults to a fixture-backed fake. */
  onResend?: ResendInviteFn;
  /** Injectable Revoke seam (module doc #4). Defaults to a fixture-backed fake. */
  onRevoke?: RevokeInviteFn;
}

export function InvitesTab({
  loadData = defaultLoadInvitesTabData,
  onResend = defaultOnResendInvite,
  onRevoke = defaultOnRevokeInvite,
}: InvitesTabProps = {}): ReactNode {
  const loadState = useLoadState(loadData, [loadData]);
  const [invites, setInvites] = useState<InviteRow[]>(EMPTY_ROWS);
  const [feedback, setFeedback] = useState<FeedbackBanner | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<InviteDisplayRow | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  useEffect(() => {
    if (loadState.status === 'success') {
      setInvites([...loadState.data.invites]);
    }
  }, [loadState]);

  const rows = buildDisplayRows(invites);

  async function handleResend(row: InviteDisplayRow): Promise<void> {
    const source = invites.find((invite) => invite.id === row.id);
    if (!source) return;
    try {
      const updated = await onResend(source);
      setInvites((prev) => withResendResult(prev, updated));
      setFeedback({
        status: 'success',
        title: 'Invite resent',
        description: `A fresh invite was sent to ${row.email}.`,
      });
    } catch {
      setFeedback({
        status: 'error',
        title: "Couldn't resend invite",
        description: `Something went wrong resending the invite to ${row.email}. Try again in a moment.`,
      });
    }
  }

  async function handleConfirmRevoke(): Promise<void> {
    if (revokeTarget === null) return;
    const source = invites.find((invite) => invite.id === revokeTarget.id);
    if (!source) {
      setRevokeTarget(null);
      return;
    }
    setIsRevoking(true);
    try {
      // Module doc #4: this callback's ONLY job is setting
      // invites.status = 'revoked'. trg_audit_invite_revocation writes the
      // audit_log row automatically -- no client-side audit_log write here.
      await onRevoke(source);
      setInvites((prev) => withRevokedStatus(prev, source.id));
      setFeedback({
        status: 'success',
        title: 'Invite revoked',
        description: `The invite to ${revokeTarget.email} has been revoked.`,
      });
      setRevokeTarget(null);
    } catch {
      setFeedback({
        status: 'error',
        title: "Couldn't revoke invite",
        description: `Something went wrong revoking the invite to ${revokeTarget.email}. Try again in a moment.`,
      });
    } finally {
      setIsRevoking(false);
    }
  }

  const columns = buildColumns({
    onResend: (row) => {
      void handleResend(row);
    },
    onRequestRevoke: (row) => setRevokeTarget(row),
  });

  if (loadState.status === 'loading') {
    return (
      <VStack gap={4} padding={6} aria-busy="true">
        <VisuallyHidden as="div" role="status">
          Loading invites…
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
          title="Couldn't load invites"
          description="Something went wrong loading the invites list. Try refreshing the page."
          endContent={<Button variant="ghost" label="Retry" onClick={loadState.retry} />}
        />
      </VStack>
    );
  }

  return (
    <VStack gap={4} padding={6}>
      <Heading level={1}>Invites</Heading>

      {feedback !== null && (
        <Banner
          status={feedback.status}
          title={feedback.title}
          description={feedback.description}
          isDismissable
          onDismiss={() => setFeedback(null)}
        />
      )}

      {rows.length === 0 ? (
        <EmptyState
          headingLevel={2}
          title="No invites sent yet"
          description="Invites sent to students, parents, coaches, or admins will show up here."
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
        isOpen={revokeTarget !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setRevokeTarget(null);
        }}
        title={`Revoke invite to ${revokeTarget?.email ?? ''}?`}
        description="This invite link will stop working immediately. The recipient will need a brand-new invite to join."
        actionLabel="Revoke invite"
        onAction={() => {
          void handleConfirmRevoke();
        }}
        isActionLoading={isRevoking}
      />
    </VStack>
  );
}

export default InvitesTab;
