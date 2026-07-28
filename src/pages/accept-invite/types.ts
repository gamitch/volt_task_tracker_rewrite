/**
 * T018: data-loading seam for the `/accept-invite` screen.
 *
 * This module exists because of a genuine, unresolved architecture gap
 * (flagged in this task's worker packet, Known Context/Traps #2, and again
 * in this task's worker output as a dispute candidate): the `invites`
 * table's RLS policy is `staff_all` only (see
 * `supabase/migrations/20260717000002_rls.sql`), so there is no policy
 * that lets an unauthenticated or non-staff caller read an `invites` row.
 * `AcceptInvitePage.tsx` therefore cannot correctly query `invites`
 * directly from the frontend -- not now (no Supabase client exists in
 * `src/` yet at all), and not even once a real client exists later,
 * because RLS would still reject the read.
 *
 * Instead, this file defines the *shape* the page needs
 * (`AcceptInviteData`) and a *seam* for supplying it (`LoadInviteFn`),
 * so the component itself can be built completely and correctly against a
 * stable contract, independent of how that data eventually gets there.
 * Whatever real mechanism ends up populating this (a dedicated read-only
 * Edge Function keyed by an opaque invite token, claims embedded in the
 * invite-acceptance link itself, or something else) does not exist
 * anywhere in this repo today. See this task's worker output for the
 * dispute-candidate recommendation on how/where that should be built.
 *
 * Note on `AcceptInviteData.name`: the `invites` table itself has NO name
 * column at all (only `email`, `role`, `student_id`, `invited_by`,
 * `status`, `expires_at` -- see
 * `supabase/migrations/20260717000000_scheduling_attendance.sql`). A real
 * implementation of `LoadInviteFn` will need to resolve a display name via
 * a join against `profiles`/`students` server-side (e.g. inside the Edge
 * Function that would own this read), which is additional information
 * this frontend-only task cannot and should not guess at.
 */

/**
 * The real AUTH-05 role vocabulary (`role_enum` in
 * `supabase/migrations/20260717000000_scheduling_attendance.sql`).
 *
 * Deliberately distinct from `guards.tsx`'s `Role` type
 * (`'admin' | 'staff' | 'volunteer' | 'coach'`, a stale T005 placeholder --
 * see that file's own doc comment). `InviteRole` is used ONLY to *display*
 * the invitee's role on this page; it is never passed to `guards.tsx`'s
 * `login()`. See `AcceptInvitePage.tsx`'s module doc and
 * `PLACEHOLDER_SIGN_IN_ROLE` for how the AUTH-05/`Role` vocabulary mismatch
 * is handled at the point this page completes sign-up.
 */
export type InviteRole = 'admin' | 'coach' | 'student' | 'parent';

/** Mirrors the `invites.status` check constraint exactly (four values). */
export type InviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked';

/**
 * The data this page needs in order to render (AUTH-03 step 3: "shows
 * their name + role"). A designed seam, not a live query result -- see
 * module doc above.
 */
export interface AcceptInviteData {
  name: string;
  email: string;
  role: InviteRole;
  status: InviteStatus;
}

/**
 * Data-loading seam. Given an opaque invite token (however it eventually
 * arrives -- see module doc), resolves the invite's display data, or
 * rejects if the token itself is unrecognized/malformed.
 *
 * `AcceptInvitePage`'s default implementation of this (`defaultLoadInvite`
 * in `AcceptInvitePage.tsx`) is an obviously-fake placeholder that does
 * NOT call Supabase. Real callers (a future task, or a verification
 * harness exercising fixture data) should supply their own `loadInvite`
 * prop.
 */
export type LoadInviteFn = (token: string | null) => Promise<AcceptInviteData>;
