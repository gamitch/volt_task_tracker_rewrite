/**
 * T102 (ED-1 Packet P13): real `AcceptInvitePage.tsx` invite-lookup wiring.
 * First file in `loaders/` that reads an authenticated SESSION rather than a
 * plain table query as its primary data source -- see the full Trap #1/#2
 * investigation below before touching this file.
 *
 * -----------------------------------------------------------------------
 * Trap #1 (packet Known Context/Traps #1) -- WHY this file never queries
 * `invites` directly.
 *
 * `public.invites`' only read RLS policy is `staff_all`
 * (`supabase/migrations/20260717000002_rls.sql`, read-only reference): "for
 * all to authenticated using (is_staff())". An invitee accepting their own
 * invite is, by definition, not staff (their own `profiles` row, once it
 * exists, carries `role in ('student','parent')` or occasionally
 * `'admin'`/`'coach'` -- but even then, `is_staff()` reads `profiles.role`
 * for `auth.uid()`, and at the moment this page needs to render, that
 * profiles row frequently does not exist yet at all -- see the Trap #2
 * investigation below for exactly when it does). A direct
 * `client.from('invites').select(...)` here would silently return zero rows
 * for every real invitee, while "working" for a developer testing as an
 * already-signed-in admin/coach session -- exactly the dangerous
 * false-positive the packet's Trap #1 warns about. This file contains no
 * `.from('invites')` call anywhere (grep-provable).
 *
 * The real source instead: `supabase/functions/send-invite/index.ts`
 * (read-only reference) calls `adminClient.auth.admin.inviteUserByEmail(
 * email, { data: { role, student_id, invite_id } })` at invite-*send* time.
 * Per Supabase Auth's documented behavior, that `data` object is merged into
 * the created `auth.users` row's `raw_user_meta_data`, which the client SDK
 * exposes as `session.user.user_metadata` on the session the invite email
 * link itself establishes (see `AcceptInvitePage.tsx`'s own "T077 -- Ground
 * Truth" module-doc section, already established by a prior, already-passed
 * task, not re-litigated here). `getInitialSession` (`../auth.ts`, already
 * exported, reused verbatim below -- no new session-read path written, per
 * the packet's explicit instruction to check `auth.ts`'s existing exports
 * first) is exactly the seam that resolves that session client-side.
 *
 * `role`/`student_id` therefore come from `session.user.user_metadata`,
 * `email` from `session.user.email` (the real `auth.users.email` the invite
 * was sent to), and `name` -- since neither `invites` nor
 * `raw_user_meta_data` carries a name column/key at all (confirmed against
 * `send-invite/index.ts`'s literal `{ role, student_id, invite_id }` payload
 * and `invites`' own column list, `20260717000000_scheduling_attendance.sql`
 * lines 18-27) -- from `profiles.display_name` once that row exists (a
 * `profiles_read` policy of `for select to authenticated using (true)`,
 * same migration file, makes this read safe for ANY authenticated session,
 * including this not-yet-fully-onboarded invitee -- no Trap-#1-style RLS
 * block here), falling back to the exact same client-derivable formula
 * `fn_handle_invite_acceptance` (`supabase/migrations/
 * 20260718000000_invite_trigger.sql`, read-only reference) uses server-side
 * when that row does not exist yet (`deriveFallbackName` below) -- a
 * disclosed mirror of real server logic, not a fabricated placeholder.
 *
 * -----------------------------------------------------------------------
 * Trap #2 (packet Known Context/Traps #2) -- `status` derivation
 * investigation. FULL reasoning, since this deliberately does NOT follow the
 * packet's own illustrative suggestion ("a `profiles` row already existing
 * for this user id is itself evidence of prior acceptance") -- that
 * suggestion turns out not to hold for THIS page once the invite-acceptance
 * trigger's actual fire condition is read closely, and this file's design
 * deviates from it for a specific, disclosed reason below.
 *
 * `trg_handle_invite_acceptance` (`20260718000000_invite_trigger.sql`) fires
 * `after update on auth.users ... when ((old.email_confirmed_at is null and
 * new.email_confirmed_at is not null) or (old.last_sign_in_at is null and
 * new.last_sign_in_at is not null))`. Per that migration's own module doc,
 * BOTH of those transitions happen at the moment the invitee's browser
 * completes the invite email link's own auth exchange -- i.e. the SAME
 * event that establishes the session `AcceptInvitePage.tsx`'s own "Ground
 * Truth" section says is already active "before the visitor has done
 * anything at all, let alone submitted the 'Set a password' form." That
 * means the trigger creates the `profiles` row (and flips `invites.status`
 * to `'accepted'`) at first-click time, NOT at password-set/Google-sign-in
 * completion time -- so for the intended, common case (a brand-new invitee
 * clicking their invite link for the first time, about to choose "Set a
 * password" or "Continue with Google"), `profiles` ALREADY exists by the
 * time this page's `loadInvite` runs, indistinguishable from a hypothetical
 * later revisit by someone who already fully completed onboarding earlier.
 * Treating "`profiles` row exists" as `'accepted'` (a terminal,
 * non-actionable status per `getInviteStatusError`, which replaces the
 * entire form with a blocking error banner) would therefore incorrectly
 * block EVERY normal, legitimate first-time visitor from ever seeing the
 * "Set a password" form -- a real correctness bug, not a defensible reading
 * of the packet's illustrative example. This file deliberately does NOT do
 * that.
 *
 * Nor is there any other reliable, session-observable signal for
 * `'accepted'`: `session.user.email_confirmed_at`/`last_sign_in_at` are, by
 * the same trigger-condition reasoning above, ALREADY non-null by the time
 * ANY resolved session reaches this page (that non-null transition is what
 * makes the session exist in the first place) -- so neither field
 * discriminates "just arrived, about to complete setup" from "revisiting
 * after already completing setup" either.
 *
 * `'expired'`/`'revoked'` are equally undiscoverable from a resolved
 * session: `user_metadata` is written once, at invite-*send* time, and is
 * never updated afterward, so it stays populated identically whether or not
 * the `invites` row was later revoked or has since expired -- there is no
 * client-observable proxy for either. The packet's own framing already
 * anticipates the one case that IS real and does get caught: an invite link
 * that is expired/used/invalid at Supabase's OWN auth-token layer (a
 * different, independent expiry from this app's `invites.expires_at`) never
 * reaches a resolved session at all -- `getInitialSession` resolves `null`,
 * which this file maps to a genuine rejected promise (the page's
 * "couldn't load this invite" error-with-Retry banner), never a domain
 * status.
 *
 * DECISION: `loadInvite` below resolves `status: 'pending'` for every
 * successful load (a resolved session + a recognizable `role` in
 * `user_metadata`), and REJECTS (mapped to the page's genuine-load-failure
 * banner, not a domain status) when no session/role is resolvable at all.
 * `'expired'`/`'revoked'`/`'accepted'` are consequently unreachable through
 * this real implementation -- `getInviteStatusError`'s exhaustive handling
 * of all four `InviteStatus` members remains defensively correct dead code
 * for those three (as its own module doc already discloses it is, for the
 * `'accepted'` case specifically), reachable only via directly-injected
 * fixture data in tests, never via this real loader. This is the
 * correctness-preserving choice: mis-classifying a genuine in-progress
 * acceptance as terminal `'accepted'` would actively break onboarding for
 * every real invitee, whereas re-showing the form to an already-onboarded
 * visitor who revisits a stale link is a harmless no-op (`updateUserPassword`
 * simply resets their password on their own already-authenticated session;
 * "Continue with Google" simply re-confirms the same identity) -- not a
 * security or data-integrity issue, only a slightly redundant UI.
 *
 * -----------------------------------------------------------------------
 * `token` (the `?token=` query param `AcceptInvitePage.tsx` reads via
 * `useSearchParams` and passes to `LoadInviteFn`) is intentionally UNUSED
 * here, same disclosed choice `defaultLoadInvite` (`AcceptInvitePage.tsx`)
 * already made: per the Ground Truth section cited above, the Supabase SDK
 * already auto-parses/consumes the invite link's own session tokens on
 * mount (`detectSessionInUrl`, already-established behavior, not something
 * this task re-verifies) -- there is nothing left for this loader to do
 * with a separate, manually-read `token` string.
 */
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { createLoader } from '../loader';
import { getSupabaseClient } from '../client';
import { getInitialSession } from '../auth';
import type {
  AcceptInviteData,
  InviteRole,
  LoadInviteFn,
} from '../../../pages/accept-invite/types';

const INVITE_ROLES: readonly InviteRole[] = ['admin', 'coach', 'student', 'parent'];

function isInviteRole(value: unknown): value is InviteRole {
  return typeof value === 'string' && (INVITE_ROLES as readonly string[]).includes(value);
}

/** Minimal raw projection of `public.profiles` -- only `display_name`, the
 * one field this loader needs (see Trap #1 investigation above). */
interface ProfileDisplayNameRow {
  display_name: string;
}

/**
 * Client-side mirror of `fn_handle_invite_acceptance`'s own `display_name`
 * fallback formula (`20260718000000_invite_trigger.sql`: `coalesce(nullif(
 * trim(raw_user_meta_data ->> 'full_name'), ''), nullif(trim(
 * raw_user_meta_data ->> 'name'), ''), split_part(email, '@', 1))`) -- used
 * ONLY for the narrow case where `profiles` has no row yet for this user
 * (see Trap #2 investigation above for when that happens: an
 * expired/revoked invite whose trigger found no matching pending row).
 * Disclosed reuse of the real server-side formula, not a fabricated
 * placeholder.
 */
function deriveFallbackName(email: string, userMetadata: Record<string, unknown>): string {
  const fullName = typeof userMetadata.full_name === 'string' ? userMetadata.full_name.trim() : '';
  if (fullName) {
    return fullName;
  }
  const name = typeof userMetadata.name === 'string' ? userMetadata.name.trim() : '';
  if (name) {
    return name;
  }
  return email.split('@')[0];
}

function readUserMetadata(user: User): Record<string, unknown> {
  return (user.user_metadata ?? {}) as Record<string, unknown>;
}

/**
 * `getClient` is injectable (defaults to the shared singleton), same
 * convention every prior `loaders/*.ts` file in this directory already
 * established, so tests can supply a stubbed transport with zero real
 * network calls -- see `AcceptInvitePage.test.tsx`'s
 * `loadInvite (T102 real load, Trap #1/#2)` block.
 */
export function makeLoadInvite(getClient: () => SupabaseClient = getSupabaseClient): LoadInviteFn {
  const loadProfileDisplayName = createLoader<string, ProfileDisplayNameRow>(
    (client, id) =>
      client
        .from('profiles')
        .select('display_name')
        .eq('id', id)
        .maybeSingle()
        .overrideTypes<ProfileDisplayNameRow, { merge: false }>(),
    getClient,
  );

  return async (token: string | null): Promise<AcceptInviteData> => {
    // Deliberately unused -- see module doc's "`token` is intentionally
    // UNUSED here" section above.
    void token;

    const client = getClient();
    const session = await getInitialSession(client);
    if (!session?.user) {
      throw new Error(
        'No active invite session was found. Open this page from the link in your invite email.',
      );
    }

    const { user } = session;
    const metadata = readUserMetadata(user);
    const role = metadata.role;
    if (!isInviteRole(role)) {
      throw new Error('This invite session is missing its role information.');
    }
    if (!user.email) {
      throw new Error('This invite session has no email address.');
    }

    const profileRow = await loadProfileDisplayName(user.id);
    const name = profileRow ? profileRow.display_name : deriveFallbackName(user.email, metadata);

    // Trap #2 decision: always 'pending' on a successful resolve -- see
    // module doc investigation above for why 'expired'/'revoked'/'accepted'
    // are not honestly derivable here.
    return { name, email: user.email, role, status: 'pending' };
  };
}

/** Default `loadInvite` for `AcceptInvitePage.tsx` -- real session +
 * `profiles` lookup, per the Trap #1/#2 investigation above. */
export const loadInvite: LoadInviteFn = makeLoadInvite();
