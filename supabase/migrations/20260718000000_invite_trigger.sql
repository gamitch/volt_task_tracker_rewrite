-- T019: AUTH-03 step 4 -- invite-acceptance DB trigger, plus the T009 MINOR
-- follow-up (profiles.avatar_url nullability). Additive migration only; does
-- not edit any prior migration file (constitution item 10, BLOCKER if
-- violated). Depends on tables created by T009's
-- 20260716000000_identity_roster.sql (profiles, students, guardian_links) and
-- T010's 20260717000000_scheduling_attendance.sql (invites), both applied
-- earlier and left untouched here.
--
-- NOTE: no PII in this file. No seed/fixture data is included. The trigger
-- function below never `raise notice`s an email or name (constitution item 6).
--
-- ---------------------------------------------------------------------------
-- Amended Acceptance Criterion (T009 MINOR follow-up): profiles.avatar_url
-- nullability
-- ---------------------------------------------------------------------------
-- T009's migration defines `avatar_url text not null` with no default,
-- following a literal reading of PRD 8.1's "no null-marker = NOT NULL" rule.
-- PRD SET-01 describes avatar upload as a post-creation settings action, so a
-- brand-new profile legitimately has no avatar yet at the moment this
-- trigger's own INSERT INTO profiles runs.
--
-- DECISION: made nullable (option (b) in the amended acceptance criterion),
-- not given a default value (option (a)). Reasoning: NULL is the semantically
-- correct representation of "no avatar has been set yet" -- it is what lets a
-- frontend component tell "no avatar, render an initials placeholder" apart
-- from "avatar_url is deliberately an empty/placeholder string", without
-- every consumer having to special-case a sentinel value. A default of `''`
-- (empty string) or a generated placeholder URL would instead force every
-- reader of this column to treat that sentinel as meaningful, which is a
-- worse fit for SET-01's "upload later" flow than a plain NULL. This does not
-- diverge from PRD 8.1 elsewhere: 8.1's own field list for `profiles` already
-- does not annotate avatar_url as populated-at-creation-time, and no other
-- INSERT INTO profiles exists anywhere in the repo yet (confirmed via
-- repo-wide search) that this change could conflict with.
--
-- Consistency with this task's own INSERT: because the choice is "nullable,
-- no default" (not "not null with a default"), the trigger's own
-- `insert into public.profiles (...)` below deliberately OMITS the
-- avatar_url column from its column/value list rather than passing an
-- explicit NULL -- omitting it lets Postgres apply the column's (now
-- unconstrained) implicit NULL the same way any future INSERT that also
-- omits the column would. This is the same behavior as explicitly setting it
-- to NULL; the omission is chosen purely for readability.
alter table public.profiles
  alter column avatar_url drop not null;

-- ---------------------------------------------------------------------------
-- AUTH-03 step 4: invite-acceptance trigger
-- ---------------------------------------------------------------------------
-- PRD text (verbatim, per this task's worker packet): "On first successful
-- sign-in, a DB trigger matches auth.users.email to the pending invite,
-- creates profiles with the invited role, links students.profile_id or
-- guardian_links as appropriate, and marks the invite accepted."
--
-- KNOWN CONTEXT / TRAP #1 -- chosen "first successful sign-in" signal.
-- T017's send-invite Edge Function (already Passed; see
-- supabase/functions/send-invite/index.ts) calls
-- `adminClient.auth.admin.inviteUserByEmail(email, { data: { role,
-- student_id, invite_id } })` at invite-*send* time. Supabase Auth's
-- documented behavior for `inviteUserByEmail` is to create the `auth.users`
-- row immediately, in an UNCONFIRMED state: `email_confirmed_at` is NULL and
-- no session has ever been granted (`last_sign_in_at` is NULL), regardless of
-- whether the recipient ever completes sign-up. This means a trigger on
-- `auth.users` INSERT (the naive approach) would fire at invite-send time,
-- long before "first successful sign-in" -- exactly the trap this task's
-- packet calls out.
--
-- This trigger instead fires on UPDATE, gated on either of two independent,
-- one-time, monotonic column transitions, each guarded specifically as a
-- NULL -> NOT NULL transition (not "any change", so it cannot re-fire on
-- later, unrelated updates to the same row):
--   (a) old.email_confirmed_at is null and new.email_confirmed_at is not null
--   (b) old.last_sign_in_at   is null and new.last_sign_in_at   is not null
--
-- Why both, combined with OR, rather than committing to a single column:
--   - Both are NULL at invite-creation time for every invited user (per
--     `inviteUserByEmail`'s documented "unconfirmed, no session" starting
--     state), so neither signal fires at invite-send time -- resolving Trap
--     #1's core failure mode on its own.
--   - Password-set path: completing an invite (verifying the invite token,
--     then setting a password) confirms the email and establishes a session.
--     Supabase Auth's own account-creation trigger examples treat both
--     `email_confirmed_at` and `last_sign_in_at` as reliable "account is now
--     active" signals for this path.
--   - Google OAuth path: Google-verified emails let Supabase Auth
--     automatically link the OAuth identity to the pre-existing invited
--     (unconfirmed) `auth.users` row by matching email. This linking
--     necessarily sets `email_confirmed_at` (the verified-email linking
--     mechanism has nothing else to set it from) and, once a session is
--     granted, `last_sign_in_at`. Critically, `encrypted_password` is NEVER
--     set for an OAuth-only account, which is why that column -- an
--     initially tempting signal -- was rejected: it would silently never
--     fire for the Google OAuth path at all.
--   - Using OR instead of picking exactly one hedges against not being able
--     to verify, without a live Supabase project, the *exact* order/grouping
--     in which GoTrue's internal implementation updates these two columns
--     during the invite-acceptance handshake (i.e. whether they always land
--     in the same UPDATE statement, or sometimes in two). If they land in
--     two separate UPDATE statements, this trigger simply fires twice -- once
--     per transition -- which is safe, because every matched invite is
--     re-queried with `status = 'pending'` each time (see Trap #3 below): the
--     first firing processes and marks the invite(s) accepted; the second
--     firing finds zero matching pending rows and is a correct no-op.
--
-- CONFIDENCE / KNOWN RISK: this is a reasoned design against Supabase Auth's
-- documented column semantics, not something verified against a live
-- Supabase/GoTrue instance (see External Blocker in the worker packet; also
-- see this task's worker output for the scratch-Postgres simulation that
-- *is* included, and what it does and does not prove). If a future live
-- verification against a real Supabase project shows GoTrue behaves
-- differently than documented here for either path, this WHEN clause is the
-- first place to revisit.
--
-- KNOWN CONTEXT / TRAP #2 -- Google OAuth identity-linking assumption. This
-- trigger's matching logic joins on `auth.users.email = invites.email`, not
-- on any particular `auth.users.id`. The ASSUMPTION stated here explicitly
-- (per the packet's instruction) is that Supabase's automatic email-linking
-- behavior attaches the Google identity to the SAME pre-existing
-- `auth.users.id` that `inviteUserByEmail` created. But even if that
-- assumption is wrong -- i.e. Supabase instead creates a distinct, separate
-- `auth.users` row for the Google identity -- this trigger still works
-- correctly unchanged: it fires per-row on whichever `auth.users.id` actually
-- satisfies the email_confirmed_at/last_sign_in_at transition, looks up the
-- pending invite by that row's email (not by id), and stamps
-- `profiles.id = new.id` for whichever id that turns out to be. The
-- email-based join is what makes the design robust to either linking
-- behavior; only the join key (email) needs to be correct, not the identity
-- linking behavior itself.
--
-- KNOWN CONTEXT / TRAP #3 -- idempotency. Every invite row this function
-- touches is re-selected each time with `status = 'pending' and
-- expires_at > now()`. Once processed, a row's status is updated to
-- 'accepted' inside the same statement that touched it, so a second firing
-- (whether from the OR-combined dual-signal design above, or from Postgres
-- retrying/re-running triggers on a retried transaction) finds zero matching
-- rows and the loop body simply never executes: no duplicate profiles insert
-- (also independently protected by `on conflict (id) do nothing`, since
-- profiles.id is `auth.users.id`'s own primary key), no duplicate
-- guardian_links row (also independently protected by
-- `on conflict (parent_profile_id, student_id) do nothing`), no duplicate
-- students.profile_id write (a second `update ... set profile_id = new.id`
-- for the same value is a no-op by construction).
--
-- KNOWN CONTEXT / TRAP #4 -- role provenance. The role stamped onto the new
-- profiles row (`v_invite.role` below) comes ONLY from the matched
-- `invites.role` column -- selected from `public.invites` inside this
-- SECURITY DEFINER function, never from any parameter, session variable, or
-- other input. There is no "client-supplied" value in scope of this
-- server-side trigger at all; this comment exists so a future reader does
-- not accidentally wire in some other role source (e.g. auth.users'
-- raw_user_meta_data, which DOES carry a `role` key -- see
-- supabase/functions/send-invite/index.ts's `inviteUserByEmail(email, {
-- data: { role, ... } })` call -- but that metadata is deliberately NEVER
-- read for role in this function; it is treated as informational-only,
-- since trusting it would reopen exactly the "role from anything
-- client-supplied" hole this task's objective explicitly forbids).
--
-- KNOWN CONTEXT / TRAP #5 -- no matching pending invite. If no *pending,
-- unexpired* `invites` row matches `new.email` (only an expired/revoked row
-- exists, or no row at all), the loop below has zero iterations and the
-- function returns `new` having done nothing: no profiles row, no error, no
-- effect on the underlying auth.users write. Building the AUTH-04 "you're
-- not on the roster yet" screen or its RLS-denial test is explicitly T020's
-- job, not this task's.
--
-- Multi-invite-row parent case (ROS-05): a parent invited for N students
-- produces N separate `invites` rows sharing one email (per T017's
-- packet/precedent). The loop below iterates over ALL matching pending,
-- unexpired invites for the signing-in email -- not just the first -- so
-- every one of them gets its own guardian_links row and is individually
-- marked accepted. The one-time profiles insert is derived from the
-- earliest such invite by created_at (row_number() = 1), on the assumption
-- that every invites row for a given email shares the same role (true for
-- the parent multi-student case by construction; a hypothetical
-- mixed-role duplicate for the same email is an out-of-scope data anomaly
-- not modeled by anything in the ground truth schema).
--
-- display_name: `profiles.display_name` is `not null` with no default (T009,
-- unmodified by this migration) and the `invites` table itself carries no
-- name field at all (confirmed against its ground-truth schema) -- see also
-- T018's own worker packet, Known Context/Traps #2, which independently
-- flags that "invitee name" has no defined source anywhere in the schema yet
-- and is an open architecture gap. This trigger's ASSUMPTION (documented
-- here since the packet does not specify a source): prefer
-- `raw_user_meta_data ->> 'full_name'` / `->> 'name'` (the claims Supabase
-- Auth merges in from a linked Google identity), falling back to the local
-- part of the email address when neither is present (e.g. the password-set
-- path, where `inviteUserByEmail`'s own metadata --
-- `{ role, student_id, invite_id }`, see send-invite/index.ts -- carries no
-- name field at all). This is a reasonable placeholder, not a spec
-- requirement; PRD SET-01-style profile editing can let the user correct it
-- later. Flagged in worker output as a design choice, not a role-provenance
-- violation (Trap #4 only forbids the ROLE column from any source other than
-- invites.role; display_name is not similarly constrained anywhere in the
-- ground truth).
--
-- guardian_links.relationship: `not null` (T009, unmodified) with no source
-- anywhere in `invites` or `auth.users`. Defaulted to the literal string
-- 'guardian' by this trigger, flagged here as an assumption pending any
-- future task that collects a real relationship value (e.g. 'parent',
-- 'guardian', 'other') at invite-creation time.
--
-- SECURITY DEFINER rationale: same pattern as T011's audit triggers (see
-- 20260717000001_support_audit.sql) -- this function performs a legitimate
-- system-level write (creating a profile and roster linkage on behalf of a
-- user who, at the moment this fires, has no `profiles` row yet and
-- therefore cannot satisfy any RLS policy that assumes one exists). Running
-- as the function owner with a locked-down search_path lets the write
-- succeed regardless of RLS on profiles/students/guardian_links/invites,
-- without weakening any existing policy (none of which are touched by this
-- migration).
create or replace function public.fn_handle_invite_acceptance()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invite record;
  v_display_name text;
begin
  -- display_name derivation -- see the comment block above this function for
  -- full reasoning. Computed once per invocation; independent of role.
  v_display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(new.email, '@', 1)
  );

  -- Every PENDING, UNEXPIRED invites row for this email, oldest first. Zero
  -- rows here (Trap #5: no match, or only expired/revoked rows) means the
  -- loop body below never executes -- a safe no-op, no error, no write.
  for v_invite in
    select
      i.*,
      row_number() over (order by i.created_at asc) as rn
    from public.invites i
    where i.email = new.email
      and i.status = 'pending'
      and i.expires_at > now()
  loop
    -- Create the profiles row exactly once per auth.users.id, from the
    -- earliest matching invite. Role provenance is invites.role, full stop
    -- (Trap #4). on conflict (id) do nothing is the idempotency backstop on
    -- top of the outer "status = 'pending'" re-query guard (Trap #3).
    -- avatar_url is intentionally omitted -- see the ALTER TABLE comment
    -- above this function for why (nullable, no default; omission = NULL).
    if v_invite.rn = 1 then
      insert into public.profiles (id, display_name, email, role)
      values (new.id, v_display_name, new.email, v_invite.role)
      on conflict (id) do nothing;
    end if;

    -- Linkage: student invite -> students.profile_id; parent invite ->
    -- guardian_links row. admin/coach invites (student_id is null per the
    -- ground truth) touch neither table, matching PRD/packet intent exactly.
    if v_invite.role = 'student' and v_invite.student_id is not null then
      update public.students
      set profile_id = new.id
      where id = v_invite.student_id;
    elsif v_invite.role = 'parent' and v_invite.student_id is not null then
      insert into public.guardian_links (parent_profile_id, student_id, relationship)
      values (new.id, v_invite.student_id, 'guardian')
      on conflict (parent_profile_id, student_id) do nothing;
    end if;

    -- Mark THIS invite row accepted. Guarded by "and status = 'pending'" so
    -- a hypothetical concurrent second firing (Trap #3) cannot re-run this
    -- update against a row another firing already advanced.
    update public.invites
    set status = 'accepted'
    where id = v_invite.id
      and status = 'pending';
  end loop;

  return new;
end;
$$;

create trigger trg_handle_invite_acceptance
  after update on auth.users
  for each row
  when (
    (old.email_confirmed_at is null and new.email_confirmed_at is not null)
    or (old.last_sign_in_at is null and new.last_sign_in_at is not null)
  )
  execute function public.fn_handle_invite_acceptance();
