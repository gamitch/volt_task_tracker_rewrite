# Checker Packet: T019 (DB trigger: invite acceptance → profile/link) — Check Attempt 1

## Task ID
T019 — AUTH-03 step 4 invite-acceptance trigger, plus the T009 MINOR follow-up (`profiles.avatar_url` nullability).

## Checker Agent
checker-reviewer (per task-ledger.md's T019 row)

## Attempt
Check attempt 1 of 3 (max 3 before mandatory boss-arbiter escalation per constitution "Loop Limit"). First check on this task — no prior checker verdict exists. Full task context: `docs/swarm/active/T019-worker-packet.md` (read it in full before starting — it contains the complete ground-truth schemas, PRD text, and the "Known Context/Traps" the worker was given, including Trap #1, which is this task's single highest-risk item).

## Why This Task Matters More Than Its Size Suggests
T021 (Roster), T030 (Meetings), T038 (Outreach), and effectively all of E4/E5/E6 depend on T019 being **genuinely correct**, not just plausible-looking SQL. This is the one place in the whole auth flow where a role gets stamped onto a real account. A false-positive re-fire, a silently-wrong signal, or a role leak would be a security/data-integrity defect discovered only much later, deep in downstream tasks. Be rigorous. Do not rubber-stamp.

## Deliverable Under Review
One new file: `supabase/migrations/20260718000000_invite_trigger.sql` (287 lines). Full contents already reproduced below for your reference — **re-read the actual file yourself at that path before relying on anything in this packet; do not treat this reproduction as ground truth.**

```sql
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
-- [... full comment block explaining Traps #1-#5, reproduced verbatim in the
-- real file -- re-read it directly, this packet does not re-quote all of it
-- here to save space; see the "Known Context/Traps to Re-verify" section
-- below for the specific claims within it you must check line-by-line.]

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
  v_display_name := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(new.email, '@', 1)
  );

  for v_invite in
    select
      i.*,
      row_number() over (order by i.created_at asc) as rn
    from public.invites i
    where i.email = new.email
      and i.status = 'pending'
      and i.expires_at > now()
  loop
    if v_invite.rn = 1 then
      insert into public.profiles (id, display_name, email, role)
      values (new.id, v_display_name, new.email, v_invite.role)
      on conflict (id) do nothing;
    end if;

    if v_invite.role = 'student' and v_invite.student_id is not null then
      update public.students
      set profile_id = new.id
      where id = v_invite.student_id;
    elsif v_invite.role = 'parent' and v_invite.student_id is not null then
      insert into public.guardian_links (parent_profile_id, student_id, relationship)
      values (new.id, v_invite.student_id, 'guardian')
      on conflict (parent_profile_id, student_id) do nothing;
    end if;

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
```

## Files to Inspect
- `supabase/migrations/20260718000000_invite_trigger.sql` (new — the deliverable, read in full at its real path)
- `supabase/migrations/20260716000000_identity_roster.sql` (read-only — T009, `profiles`/`students`/`guardian_links` ground truth; confirm zero diff)
- `supabase/migrations/20260717000000_scheduling_attendance.sql` (read-only — T010, `invites` ground truth; confirm zero diff)
- `supabase/migrations/20260717000001_support_audit.sql` (read-only — T011, cited by this task as the `SECURITY DEFINER` precedent; confirm zero diff)
- `supabase/migrations/20260717000002_rls.sql`, `supabase/migrations/20260717000003_metric_views.sql` (read-only — confirm zero diff; not otherwise relevant to this task's content)
- `supabase/functions/send-invite/index.ts` (read-only — T017, cited by this task's own comments re: `raw_user_meta_data` role key and `student_id`/`invite_id` metadata; confirm the citation is accurate)
- `docs/swarm/active/T019-worker-packet.md` (full task context, ground-truth schemas, Traps #1-#5 as given to the worker)
- `src/**` (read-only — confirm this backend-only task touched nothing here)

## Forbidden Modification Check (run first, per D001 standing rule — compare current file content directly against known ground truth, never git history/commit-bundling)
Worker's Allowed Files were exactly one new file: `supabase/migrations/<timestamp>_invite_trigger.sql`. Verify:
- All five pre-existing migration files (`20260716000000_identity_roster.sql`, `20260717000000_scheduling_attendance.sql`, `20260717000001_support_audit.sql`, `20260717000002_rls.sql`, `20260717000003_metric_views.sql`) are **byte-identical** to their pre-T019 state. Read each one directly and diff/checksum it — for `identity_roster.sql` and `support_audit.sql` you can cross-check against the full contents reproduced in the worker packet's "Ground Truth" section and this packet's own earlier reads, but do not treat either reproduction as sufficient on its own — open the real files and compare/hash them yourself.
- `src/**` has zero new/modified files.
- Nothing under `docs/swarm/**` or `.claude/**` was touched by the worker (do not flag this checker packet itself, the worker packet, or hook-appended `verification-log.md` lines as findings — normal swarm-operation byproducts).
- No file exists outside `supabase/migrations/20260718000000_invite_trigger.sql` that wasn't there before this task.
- Confirm the new file's timestamp (`20260718000000`) genuinely sorts after `20260717000003_metric_views.sql` (the latest pre-existing migration) — trivial but worth a direct check.

If any pre-existing migration file was edited, return **FAIL — BLOCKER — constitution item 10 violation**, independent of everything else in this packet.

## Required Verification Steps

### 1. Line-by-line claim verification against the real file
Do not trust the reproduction in this packet or the worker's narration. Open `supabase/migrations/20260718000000_invite_trigger.sql` directly and confirm, from the actual text:
- The `alter table public.profiles alter column avatar_url drop not null;` statement is present, unconditional, and is the only avatar_url-related DDL in the file.
- The `create or replace function public.fn_handle_invite_acceptance()` function is `security definer`, has `set search_path = public, pg_temp`, and the trigger `trg_handle_invite_acceptance` is `after update on auth.users for each row` with exactly the two-condition `OR`-combined `WHEN` clause quoted above — confirm the exact column names and null-transition direction (`old ... is null and new ... is not null`, not just "is distinct from" or any looser condition) for both `email_confirmed_at` and `last_sign_in_at`.

### 2. Independent scratch-Postgres re-verification — the most important step, actually re-fire the trigger
Do not just re-read the SQL and reason about what it should do. Stand up your own scratch Postgres instance and independently re-run all 6 scenarios yourself. Suggested reproducible setup (hand-build a minimal `auth` schema, same pattern the worker used — no real Supabase/GoTrue is available in this sandbox, same category of blocker as T015/T017/T032):

```sql
create extension if not exists pgcrypto;
create schema if not exists auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  email_confirmed_at timestamptz,
  last_sign_in_at timestamptz,
  raw_user_meta_data jsonb not null default '{}'::jsonb
);
```
Then apply the real migration files in order against this scratch database:
1. `psql -f supabase/migrations/20260716000000_identity_roster.sql` (creates `profiles`, `teams`, `seasons`, `students`, `guardian_links`, `role_enum`)
2. `psql -f supabase/migrations/20260717000000_scheduling_attendance.sql` (creates `invites`, among other tables — fine to apply in full)
3. `psql -f supabase/migrations/20260718000000_invite_trigger.sql` (the deliverable under review)

Then, using your **own** fixture design (do not reuse the worker's exact rows/UUIDs/emails — a genuinely independent re-derivation is the point), seed `teams`/`students`/`invites` rows and drive the trigger purely via `INSERT`/`UPDATE` against `auth.users` (simulating the two column-transition signals), and confirm real row-level output for all 6 scenarios the worker claims to have covered:
1. **Student invite acceptance** — a pending, unexpired `invites` row with `role='student'` and a `student_id`; fire the trigger; confirm exactly one `profiles` row is created with `role='student'`, `students.profile_id` is updated to the new profile's id, and the `invites` row flips to `status='accepted'`.
2. **Parent multi-invite acceptance (ROS-05)** — two (or more) pending `invites` rows for the same email, `role='parent'`, each with a different `student_id`; fire the trigger once; confirm exactly one `profiles` row is created (not one per invite row) and a `guardian_links` row is created for **every** matched invite, and every one of those invite rows flips to `accepted`.
3. **Idempotent re-fire** — after scenario 1 or 2 has already run and marked its invite(s) `accepted`, fire the trigger again on the same `auth.users` row (design your own second UPDATE that would satisfy the `WHEN` clause a second time, e.g. update the *other* of the two signal columns if only one fired the first time, or directly re-invoke the function). Confirm zero duplicate `profiles` rows, zero duplicate `guardian_links` rows, and no error.
4. **No matching invite (no-op)** — an `auth.users` row whose email matches no `invites` row at all; fire the trigger; confirm zero `profiles` rows are created and no error is raised.
5. **Expired invite (no-op)** — an `invites` row that matches by email but has `status='pending'` and `expires_at` in the past (or `status` already `expired`/`revoked`); fire the trigger; confirm zero `profiles` rows are created.
6. **Admin/coach invite** — a pending, unexpired `invites` row with `role='admin'` (or `coach`) and `student_id is null`; fire the trigger; confirm a `profiles` row is created with the correct role, and confirm **neither** `students` nor `guardian_links` is touched.

Report the real commands and real query output for every scenario — not a summary. If any scenario's result diverges from the worker's claim, that is a MAJOR-or-higher finding depending on which scenario and why.

### 3. Explicit, reasoned severity verdict on the sign-in-signal design decision (Trap #1) — do not rubber-stamp
This is the single highest-risk design decision in the task, and the worker explicitly flagged only "medium confidence" and asked for checker/foreman scrutiny rather than deciding it themselves. Read the migration file's own comment block under "KNOWN CONTEXT / TRAP #1" (lines ~55–112 of the real file) in full, and render your own explicit verdict on this question:

**Is the `WHEN ((old.email_confirmed_at is null and new.email_confirmed_at is not null) or (old.last_sign_in_at is null and new.last_sign_in_at is not null))` design a sound, defensible engineering judgment call given the unverifiable-without-a-live-Supabase-project constraint — or does it carry enough real risk that it should be escalated to boss-arbiter as a dispute rather than accepted as an ordinary worker judgment call?**

Weigh explicitly, do not default to a lazy verdict:
- **Rejected alternative (`encrypted_password`)**: the worker rejected this signal because it is never set for OAuth-only accounts. Independently assess whether this reasoning is correct — is there any Supabase Auth documented behavior you're aware of, or can find evidence for/against in this repo (e.g. T015's `supabase/config.toml`, T017's `send-invite/index.ts`), that would contradict this?
- **False-positive risk**: could either `email_confirmed_at` or `last_sign_in_at` transition from NULL to non-NULL for a reason **other** than "this specific invited user completed setup" — e.g. an admin action, a password-reset flow, or some other `auth.users` update path unrelated to invite acceptance? If such a path exists and this user has no matching pending invite, the trigger's own `where i.status = 'pending' and i.expires_at > now()` guard makes this safe (a no-op, not a false profile). If such a path exists and this user DOES coincidentally have an unrelated pending invite for the same email, could this fire "too early" the same way an INSERT-based trigger would have? Reason through this concretely, not abstractly.
- **False-negative risk**: is there a plausible real-world Supabase Auth behavior under which NEITHER column ever transitions from NULL to non-NULL in a way this trigger would catch (e.g. some invite-acceptance path that doesn't touch either column) — in which case the trigger would silently never fire and a legitimately accepted invite would leave the user permanently profile-less? Consider both the password-set and Google OAuth paths separately.
- **OR-of-two-transitions hedge**: assess whether combining two signals with OR, specifically to hedge against not knowing GoTrue's exact column-update ordering/grouping, is a reasonable mitigation — and whether the idempotency guard (Trap #3, re-verified in step 2 above) genuinely makes a double-fire safe, or whether there's a subtle correctness gap in that safety argument (e.g. a race between two near-simultaneous transactions both reading the invite as still-`pending` before either commits — is that a real risk in a single-row-at-a-time trigger context, or not?).
- **Verdict**: state plainly whether you accept this as a well-reasoned worker judgment call (PASS-level, logged as a known risk / follow-up item to re-verify against a live Supabase project once one exists) or whether it should be a dispute to boss-arbiter (and if so, on what specific, concrete failure mode — not just "unverifiable in the abstract," since the worker packet's own External Blocker section already acknowledges the lack of a live project as an accepted, structural limitation across T015/T017/T019/T032). If you dispute it, be specific about what boss-arbiter would need to decide that you cannot decide yourself.

### 4. Constitution item 10 compliance (additive migrations only)
Already covered under "Forbidden Modification Check" above — restate your conclusion here as a direct answer to this specific constitution item, with the checksum/diff evidence.

### 5. Role provenance — `invites.role` only, never `raw_user_meta_data`
Grep the function body (`fn_handle_invite_acceptance`) yourself and confirm:
- The only place `profiles.role` is ever written is `insert into public.profiles (id, display_name, email, role) values (new.id, v_display_name, new.email, v_invite.role) on conflict (id) do nothing;` — i.e. the value bound to the `role` column is `v_invite.role`, sourced from the `for v_invite in select i.*, ... from public.invites i where ...` loop, and nothing else.
- `new.raw_user_meta_data` is referenced exactly once in the function body (for `v_display_name` derivation via `full_name`/`name` keys) and is **never** read for a `role` key anywhere, despite T017's `send-invite/index.ts` populating `raw_user_meta_data` with a `role` value at invite-send time (confirm this claim about T017 by reading `supabase/functions/send-invite/index.ts` yourself). Report the exact grep command and output you used to confirm this.

### 6. Independent idempotency re-fire test (already folded into step 2, scenario 3) — design your own fixture
Do not reuse the worker's exact re-fire fixture (same emails/UUIDs/ordering). Design a fixture of your own — e.g. a different combination of which signal (email_confirmed_at vs last_sign_in_at) fires first vs second — and confirm independently: no duplicate `profiles` row, no duplicate `guardian_links` row, no duplicate/incorrect `students.profile_id` write, and the second firing is a genuine no-op (zero loop iterations, confirmed via row counts before/after, not just "no error").

### 7. `avatar_url` nullability — confirm no other insert path breaks
Read `supabase/migrations/20260716000000_identity_roster.sql` (T009) and `supabase/migrations/20260717000001_support_audit.sql` (T011) yourself and confirm there is no other `insert into public.profiles` statement anywhere in either file (or anywhere else in the repo — a repo-wide grep for `insert into public.profiles` / `insert into profiles` is the right check) that this task's `alter column avatar_url drop not null` could have broken or silently interacted with. Also confirm the claim in the migration's own comment ("no other INSERT INTO profiles exists anywhere in the repo yet") is accurate as of your own independent grep, not just trusted as stated.

### 8. D001-method forbidden-file check
Already covered above under "Forbidden Modification Check" — restate your conclusion here as a direct answer to this specific step.

### 9. Other disclosed judgment calls — note, don't fully re-litigate
The migration's comment block discloses two smaller judgment calls the worker flagged as placeholders, not spec-derived truth:
- `display_name` derivation: `coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1))`, with the local-part-of-email fallback used when neither Google-identity metadata field is present (e.g. the password-set path).
- `guardian_links.relationship` defaulted to the literal string `'guardian'`, since no `invites`/`auth.users` field carries a real relationship value.

Confirm these are reasonable, clearly-flagged, non-spec-violating placeholders (i.e. they don't silently contradict any PRD text you're aware of, and they don't touch the role-provenance guarantee from step 5) rather than something masquerading as spec-derived truth. A NIT/MINOR-level note is sufficient here; this is not the main focus of this check.

## Known Context / Non-Issues (verify, do not just accept)
- T020 (AUTH-04 "you're not on the roster yet" screen + its own RLS-denial test) is explicitly out of scope for this task — confirm the no-matching-invite case (step 2, scenario 4) really is a silent no-op with no error, since T020 depends on that behavior but does not build the screen itself here.
- No `raise notice` (or any other logging) of an email/name anywhere in the file — confirm via your own grep (constitution item 6). The file as reproduced above contains none, but confirm against the real file yourself.
- Do not flag this checker packet's own existence, the worker packet, or hook-appended `verification-log.md` lines as forbidden-file violations.

## Relevant Constitution Excerpts
> 4. RLS is default-deny; any table without policies → BLOCKER. Policies use only the 8.4 `security definer` helpers... (Context: this task does not touch RLS policies at all — confirm it doesn't, per the Forbidden Modification Check above. The trigger function itself is `security definer`, cited against T011's audit-trigger precedent — confirm that precedent citation is accurate by reading `20260717000001_support_audit.sql` yourself.)
>
> 6. No PII (student names, emails) in logs, URLs, analytics, commit messages, or test fixtures — fixtures use fabricated names → BLOCKER if violated.
>
> 10. Database changes are additive migrations via the Supabase CLI; editing an applied migration file → BLOCKER.
>
> **Non-Negotiables:** "No worker may mark its own work complete." / "Every checker must inspect the actual artifact, not just the worker's summary."
>
> **Failure Severity — BLOCKER:** "Cannot ship. Violates a core requirement, breaks the build, corrupts data, breaks security, breaks accessibility, or modifies forbidden files." **MAJOR:** "Should not ship without boss approval. Important functional, architectural, UX, or correctness issue." **MINOR:** "Acceptable for the current task but should become a follow-up task." **NIT:** "Cosmetic or preference-level issue. Does not block completion."
>
> **Decision rules:** BLOCKER fails the task. MAJOR fails the task unless the boss explicitly approves deferral. MINOR passes with a follow-up task. NIT passes and is logged only.
>
> **D001 standing rule:** never use git history/commit diffs as evidence of which agent touched a file. Compare file content/tree directly against known ground truth.

## PRD Ground Truth (verbatim, re-quoted from the worker packet — re-verify against `docs/swarm/VOLT_Portal_PRD.md` yourself if in doubt)
> **AUTH-03** step 4: "On first successful sign-in, a DB trigger matches `auth.users.email` to the pending invite, creates `profiles` with the invited role, links `students.profile_id` or `guardian_links` as appropriate, and marks the invite accepted."
>
> **AUTH-05** Roles: `admin | coach | student | parent`, stored on `profiles.role`, enforced by RLS — never by frontend checks alone.

## Most Recent Failure
None — this is T019's first check attempt (attempt count: 0 going into this check).

## Required Checker Output (per constitution Evidence Requirements)
- Files inspected (confirm you read the real migration file directly, not just this packet's reproduction).
- Exact scratch-Postgres setup commands and exact query output for all 6 scenarios in step 2 (your own independently-designed fixtures, not the worker's).
- Line-by-line confirmation (or refutation) of each claim in step 1.
- Explicit, reasoned severity verdict on the Trap #1 signal-choice design decision (step 3) — a real verdict with justification, not a vague "seems reasonable."
- Constitution item 10 checksum/diff evidence across all five pre-existing migration files (step 4 / Forbidden Modification Check).
- Grep output and narrative confirming role provenance (step 5).
- Independent idempotency re-fire fixture and result (step 6).
- Repo-wide grep confirming no other `insert into profiles` path exists (step 7).
- D001-method forbidden-file check result (step 8).
- Brief note on the two smaller judgment calls (step 9).
- Overall pass/fail result for T019 as a whole.
- Exact failure reason(s), if any, with severity classification (BLOCKER/MAJOR/MINOR/NIT).
- Recommended next action (pass; rework by this worker; new follow-up task; dispute to boss-arbiter — say which, and why, especially regarding step 3's verdict).

Do not mark this task complete based on the worker's self-report or the inline comments in the migration file. Generate your own evidence for every claim, especially the 6 scratch-Postgres scenarios and the Trap #1 severity verdict. Do not flip `task-ledger.md` yourself — report your verdict back; foreman-planner updates the ledger. T019 stays "In Progress" until your verdict is returned.
