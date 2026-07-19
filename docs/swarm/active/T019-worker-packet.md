# Worker Packet: T019

## Task ID
T019

## Objective
Write the additive DB trigger (AUTH-03 step 4): on first successful sign-in, match `auth.users.email` to a pending invite, create a `profiles` row with the invited role, link `students.profile_id` (student invite) or create a `guardian_links` row (parent invite), and mark the invite `accepted`. Must be idempotent on re-trigger and must never take the role from anything client-supplied — only from the matched `invites.role`.

This task also carries an **amended acceptance criterion** (below) to resolve a real schema gap T009's checker found: `profiles.avatar_url` is `not null` with no default, which would block this trigger's own `INSERT INTO profiles` unless resolved.

## Dependencies (status)
- T017 (`send-invite` Edge Function) — Passed. Its architecture is directly load-bearing for this trigger's design — see Known Context/Traps #1 below.
- T009 (identity/roster migration) — Passed. Defines `profiles`, `students`, `guardian_links` (see Ground Truth).

## Allowed Files
- `supabase/migrations/<timestamp>_invite_trigger.sql` (new additive migration — do not edit any existing migration file, constitution item 10, BLOCKER if violated). Use a timestamp later than `20260717000003_metric_views.sql` (the latest existing migration — confirm the actual latest file yourself via `ls supabase/migrations/` before picking your timestamp).
- If the `avatar_url` resolution (see amended acceptance criterion) requires its own schema change, that may live in the **same** new migration file as this task's trigger (do not create a second migration file for it, and do not touch T009's own file).

## Forbidden Files
- `supabase/migrations/20260716000000_identity_roster.sql`, `20260717000000_scheduling_attendance.sql`, `20260717000001_support_audit.sql`, `20260717000002_rls.sql`, `20260717000003_metric_views.sql` — all already-applied migrations, editing any of them is a BLOCKER (constitution item 10).
- `src/**` — this is a backend-only task.
- `docs/swarm/**`, `.claude/**`.

## Ground Truth — table schemas (read directly from the migrations, do not guess)

`profiles` (from `20260716000000_identity_roster.sql`):
```sql
create table public.profiles (
  id uuid primary key references auth.users (id) on delete restrict,
  display_name text not null,
  email text not null unique,
  role role_enum not null,
  avatar_url text not null,        -- see Amended Acceptance Criterion below
  theme_mode text not null default 'system',
  created_at timestamptz not null default now()
);
```

`students` (student-invite linkage target):
```sql
create table public.students (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles (id) on delete restrict,  -- nullable; this trigger sets it
  display_name text not null,
  team_id uuid not null references public.teams (id) on delete restrict,
  grad_year integer,
  is_active boolean not null default true,
  goal_hours_override numeric,
  created_at timestamptz not null default now()
);
```

`guardian_links` (parent-invite linkage target):
```sql
create table public.guardian_links (
  id uuid primary key default gen_random_uuid(),
  parent_profile_id uuid not null references public.profiles (id) on delete restrict,
  student_id uuid not null references public.students (id) on delete restrict,
  relationship text not null,
  created_at timestamptz not null default now(),
  unique (parent_profile_id, student_id)
);
```

`invites` (from `20260717000000_scheduling_attendance.sql`; this is the record you match against):
```sql
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role role_enum not null,                       -- 'admin' | 'coach' | 'student' | 'parent'
  student_id uuid references public.students (id) on delete restrict,  -- nullable
  invited_by uuid not null references public.profiles (id) on delete restrict,
  status text not null check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
```
Per T017's packet/precedent: for a **student** invite, `student_id` is that student's own row; for a **parent** invite, `student_id` is the (first) linked student, and ROS-05's "additional linked students" case is handled as *multiple separate `invites` rows*, one per student, all sharing the same invitee email — your trigger logic must handle the case where more than one *pending* `invites` row exists for the same email (e.g. a parent invited for two students) by processing all of them, not just the first match, so all the resulting `guardian_links` rows get created. For `admin`/`coach` invites, `student_id` is `null` and no `students`/`guardian_links` row is touched at all.

## Known Context / Traps

**1. `inviteUserByEmail` is called at invite-*send* time, not at acceptance time (T017, already Passed).** This has a direct, load-bearing consequence for this trigger's design: by the time a recipient actually completes sign-up (sets a password or completes Google OAuth), their `auth.users` row was likely **already created** back when `send-invite` ran `inviteUserByEmail`. This means a trigger fired on `auth.users` **INSERT** will very likely fire too early — at invite-send time, before the recipient has done anything — not at "first successful sign-in" as AUTH-03 step 4 literally describes. You must design this trigger against Supabase Auth's actual column-level signal for "the user has now completed account setup / signed in for the first time" (e.g. a transition on `encrypted_password` from null to non-null for the "set a password" path, or `last_sign_in_at` transitioning from null to non-null, or `email_confirmed_at`/`confirmed_at` being newly populated — verify which signal is actually reliable for **both** paths: password-set AND Google OAuth completion, since OAuth may not populate `encrypted_password` at all). State your chosen signal explicitly and justify it; if you conclude the available column-level signals are ambiguous or insufficient to distinguish "invite-row-created-by-send-invite" from "recipient-actually-completed-setup" with confidence, flag this explicitly as a dispute candidate rather than silently picking a signal that might misfire (e.g. firing again on unrelated profile updates). This is the single highest-risk design decision in this task — get it right or flag it, do not guess silently.

**2. Google OAuth identity-linking ambiguity.** If the recipient chooses "Continue with Google" and Supabase's automatic email-linking behavior attaches their Google identity to the *same* `auth.users.id` that `inviteUserByEmail` pre-created (matching by email), your trigger design from #1 should still work unchanged. If Supabase instead creates a distinct `auth.users` row for the Google identity (not linked), your email-match logic (`auth.users.email` → `invites.email`) still correctly finds the pending invite by email regardless of which `auth.users.id` ends up being used — but state explicitly in your output which behavior you are assuming and why, since you cannot test this end-to-end without a live Supabase project (see External Blocker below).

**3. Idempotency.** "Idempotent on re-trigger" (this task's own acceptance criterion) means: if this trigger fires more than once for the same invite-acceptance event (e.g. multiple column updates on the same `auth.users` row during a single sign-up flow, or Postgres re-running triggers on retried transactions), it must not create a duplicate `profiles` row (the primary key on `profiles.id = auth.users.id` already prevents a literal duplicate insert — use `ON CONFLICT DO NOTHING` or an existence check), must not create a duplicate `guardian_links` row (the `unique(parent_profile_id, student_id)` constraint helps, but guard explicitly rather than relying on an unhandled constraint violation to abort the whole auth transaction), and must not re-process an invite that's already `status='accepted'` (guard on `where status = 'pending'` in your invite-matching query, and don't re-fire the whole insert/link chain for an invite already marked accepted).

**4. Role is never client-supplied.** The role stamped onto the new `profiles` row must come **only** from the matched `invites.role` column — never from any value the client could have supplied during sign-up (this trigger runs server-side in Postgres regardless, so there is no literal "client value" to guard against here, but be explicit in your trigger's own logic/comments that role provenance is `invites.role`, full stop, so a future reader doesn't accidentally wire in some other role source).

**5. Expired invites.** If no *pending, unexpired* invite matches the signing-in email (i.e. only an `expired`/`revoked` row exists, or no row at all), this trigger should not create a `profiles` row at all — that case is AUTH-04's "You're not on the roster yet" / no-pending-invite path, which is **T020's** job (a separate, currently-Blocked ledger task), not yours. Do not attempt to build the AUTH-04 screen or its RLS-denial test here; just make sure your trigger correctly does nothing (no profile created, no error that would block the underlying `auth.users` write) when there's no valid pending invite to match.

## Amended Acceptance Criterion (2026-07-16, T009 MINOR follow-up — read task-ledger.md's own wording, reproduced verbatim below)
> Resolve `profiles.avatar_url` nullability. T009's migration defines `avatar_url text not null` with no default, following a literal reading of PRD 8.1's "no null-marker = NOT NULL" rule — but PRD SET-01 describes avatar upload as a post-creation settings action, so a NOT NULL column with no default blocks this task's own INSERT into `profiles` at invite acceptance. This task must either (a) add a sensible default for `avatar_url` (e.g. empty string or a generated placeholder URL) or (b) make the column nullable, whichever better matches how the invite-acceptance INSERT is written — and should do so via a new additive migration (do not edit T009's migration file per constitution item 10). Flag the choice explicitly in this task's worker output so the checker can confirm it doesn't silently diverge from PRD 8.1 elsewhere.

Resolve this via an `ALTER TABLE public.profiles ALTER COLUMN avatar_url ...` statement in this task's own new migration file (same file as the trigger, not a separate one). State explicitly which option (default vs. nullable) you chose and why, and confirm your trigger's own `INSERT INTO profiles` is consistent with that choice (e.g. if you chose a default, does your insert omit the column and let the default apply, or set it explicitly to the same value — say which and why).

## External Blocker — flag this explicitly, do not fabricate live verification
No live Supabase project exists yet (same category of blocker as T015/T017/T032). You cannot prove this trigger fires correctly against real Supabase Auth sign-up/OAuth events end-to-end. What you can and must do: write structurally correct, idempotent SQL; if a local Supabase instance (`supabase start`) or a scratch Postgres instance can be stood up in this sandbox, simulate the trigger's target signal (e.g. manually `UPDATE auth.users SET encrypted_password = ...` or whatever signal you chose, on a pre-seeded fixture `auth.users`/`invites` row) and show the trigger firing correctly for both a student invite and a parent invite, including the idempotency re-fire case and the no-matching-invite no-op case. State plainly what was and wasn't verified.

## Acceptance Criteria
- Trigger handles both student and parent invite types correctly, including the multi-`invites`-row parent case (Ground Truth note above).
- Idempotent on re-trigger (see Known Context/Traps #3) — proven via a real re-fire test, not just asserted.
- Role stamped from `invites.role`, never any other source (Known Context/Traps #4).
- No-matching-pending-invite case is a safe no-op (Known Context/Traps #5) — does not error, does not create a `profiles` row.
- `avatar_url` nullability resolved per the Amended Acceptance Criterion above, with the choice explicitly justified.
- Additive migration only; no edits to any prior migration file (constitution item 10, BLOCKER).
- No PII beyond what's already in the schema logged anywhere the migration/trigger touches (constitution item 6) — e.g. no `raise notice` with emails.

## Relevant Constitution Excerpts
> 3. RLS policies and metric SQL come **only** from PRD Section 8.4, copied verbatim... (Not applicable to writing a new trigger, but do not touch any RLS policy in this task.)

> 4. RLS is default-deny; any table without policies → BLOCKER... (Context only — you are not writing RLS; do not weaken any existing policy to make your trigger's job easier. Your trigger runs as the function owner / `SECURITY DEFINER` if needed, same pattern as T011's audit triggers — cite `20260717000001_support_audit.sql` as precedent for how a `SECURITY DEFINER` trigger function bypasses RLS correctly for a legitimate system-level write.)

> 10. Database changes are additive migrations via the Supabase CLI; editing an applied migration file → BLOCKER.

> 6. No PII... in logs... test fixtures use fabricated names.

Non-Negotiable: "No worker may mark its own work complete."

## PRD Ground Truth (verbatim)
> **AUTH-03** step 4: "On first successful sign-in, a DB trigger matches `auth.users.email` to the pending invite, creates `profiles` with the invited role, links `students.profile_id` or `guardian_links` as appropriate, and marks the invite accepted."

> **AUTH-05** Roles: `admin | coach | student | parent`, stored on `profiles.role`, enforced by RLS — never by frontend checks alone.

> **AUTH-07** Students may exist on the roster with no account (no email yet)... self check-in requires an account. (Context: this confirms `students.profile_id` is legitimately nullable prior to invite acceptance — your trigger is what fills it in.)

## Most Recent Failure
None. This is attempt 1 for T019 (attempt count: 0).

## Required Worker Output
- Full contents of the new migration file.
- Explicit statement of which `auth.users` column-transition signal you chose for "first successful sign-in" (Known Context/Traps #1) and why, including how it behaves for both the password-set path and the Google OAuth path.
- Explicit statement of your Google-identity-linking assumption (Known Context/Traps #2).
- Real test output proving: student-invite acceptance, parent-invite acceptance (including the multi-invite-row case), idempotent re-fire (no duplicate rows), no-matching-invite no-op, and the `avatar_url` resolution not breaking any other insert path.
- Explicit `avatar_url` nullability decision + justification (Amended Acceptance Criterion).
- Local Supabase/scratch-Postgres invocation output if you managed to stand one up, or an explicit statement of what wasn't verifiable and why.
- Known risks (e.g. anything about the chosen sign-in signal you're not fully confident in).
- Whether a dispute is needed.
