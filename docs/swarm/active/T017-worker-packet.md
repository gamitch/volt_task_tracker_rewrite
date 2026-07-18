# Worker Packet: T017

## Task ID
T017

## Objective
Build the `send-invite` Supabase Edge Function (Deno runtime). It is called by an authenticated admin/coach from `/roster` (a future task, T024/T027 — not this one) and must:
1. Verify the caller is authenticated and is `admin` or `coach` (never trust a client-supplied role).
2. Insert one row into `invites` with the correct role/student linkage and a 14-day `expires_at` (AUTH-06).
3. Call Supabase's `auth.admin.inviteUserByEmail()` (service-role only) so the recipient gets a real Supabase invite link.

**Scope boundary — read this before writing branded-email code.** AUTH-03 step 2 in the PRD describes the eventual end state as "email template branded via Resend (EML-01)," but the ledger's own T048 ("Resend integration + branded layout + `email_log`") explicitly lists its Allowed Files as `src/emails/layout/**` plus "wiring in `supabase/functions/send-invite/**` (extend, not new function)" and depends on T017. That means full Resend branding + `email_log` writes are T048's job, done by *editing this same directory later*, not yours now. Your job is the structurally correct invite-creation + `inviteUserByEmail` call. Do not attempt to wire Resend/SMTP yourself — there is no Resend/SMTP config anywhere in `supabase/config.toml` yet (checked directly; T015's config only covers `[auth.email]` self-serve-signup toggles and `[auth.external.google]`), so building it now would be guessing at a shape T048 is explicitly scoped to define. Structure your function so T048 can cleanly extend it (e.g. a clear point after the successful `inviteUserByEmail` call where a future branded-send + `email_log` write would go), and say so explicitly in your worker output rather than leaving it implicit.

## Dependencies (status)
- T009 (identity/roster migration) — Passed. Defines `profiles`, `students`.
- T012 (RLS) — Passed. Defines `auth_role()`, `is_staff()`, `my_student_ids()` and all table policies.
- T015 (Supabase Auth provider config) — Passed, relevant context only, not a hard dependency of this task's Allowed Files. `enable_signup = false` at both levels; email/password + Google both configured; no secrets committed.

## Allowed Files
- `supabase/functions/send-invite/**` (new directory — nothing exists there yet; verify with `ls supabase/functions/` yourself, expect it to not exist at all yet).

## Forbidden Files
- Any file under `supabase/migrations/**` — the `invites` table already exists (T010); do not alter it.
- `src/**` — this is a backend-only task; the frontend caller (`/roster` invite dialogs) is built later (T024, T027) against this function's contract, not by you.
- `docs/swarm/**`, `.claude/**`.

## Ground Truth — `invites` table schema (read directly from `supabase/migrations/20260717000000_scheduling_attendance.sql`, do not guess)
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
`student_id` is nullable per PRD: for a **student** invite it's the student's own row; for a **parent** invite it's the (first) linked student per ROS-05 ("optional additional linked students `MultiSelector`" — T024's job to send multiple, out of scope here, but your function should accept and store one `student_id` per invite row cleanly, since ROS-05's multi-student case is just multiple `invites` rows, one per student). For an `admin`/`coach` invite, `student_id` should be `null`.

## Ground Truth — RLS posture on `invites` (read directly from `supabase/migrations/20260717000002_rls.sql`)
```sql
alter table public.invites enable row level security;

create policy staff_all on invites
  for all to authenticated
  using (is_staff()) with check (is_staff());
```
There is **no** policy allowing students/parents to read or write `invites` at all — only `is_staff()` (admin/coach) sessions can touch this table under normal RLS. Since your Edge Function needs to insert regardless of the caller's session, and per constitution item 5 you must never expose the service-role key to the frontend, the correct architecture is:
1. Extract the caller's identity from the `Authorization` header the frontend sends (the user's own JWT, not a service-role key) — verify it (e.g. via a Supabase client constructed with the anon key + that Authorization header, calling `auth.getUser()`), then look up their `profiles.role` (or reuse `is_staff()` semantics) to confirm they are `admin`/`coach` **inside the function itself**. Do not rely on RLS alone here — a service-role write bypasses RLS entirely, so the function's own authorization check is the only gate. Reject with a 401/403 and a DES-16-style message if the caller is not staff.
2. Use a **separate, service-role-authenticated** Supabase client (constructed from `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`, one of Supabase's own auto-injected Edge Function env vars — never a project-defined secret you invent) to perform the actual `invites` insert and the `inviteUserByEmail` call.

## Ground Truth — PRD text (read the source yourself if anything below is ambiguous; PRD Section 6 is authoritative over this packet)
- **AUTH-03 steps 1–2:** "Admin/Coach creates a roster entry... and clicks Send invite. Edge Function `send-invite` creates an `invites` row and calls Supabase `inviteUserByEmail`..."
- **AUTH-06:** "Invites expire after 14 days; `/roster` shows status (Pending / Accepted / Expired) with Resend invite action." — your function sets `expires_at = now() + interval '14 days'` on creation. (The Pending/Accepted/Expired *display* logic and the Resend action are T027's job, not yours.)
- **SEC-03:** "`CHECKIN_HMAC_SECRET`, `RESEND_API_KEY` live only in Supabase Edge Function secrets." — not directly this task's concern (you need neither secret), but reinforces the general rule: nothing service-role-adjacent belongs in `src/`.

## External Blocker — flag this explicitly, do not fabricate live verification
There is no live Supabase project for this app yet (George's prerequisite — same category as the Google OAuth client blocking T015's live verification). This means:
- `inviteUserByEmail` cannot actually be invoked against a real project and observed to succeed end-to-end in this sandbox.
- You cannot prove a real invite email is sent or that the redirect lands correctly.

**What you can and must still do:** write structurally correct, secret-free code; verify request/response shapes, error handling, and authorization logic via local reasoning, static review, and — if a local Supabase instance can be started in this sandbox (`supabase start`) — a local Edge Function invocation against a local Postgres/Auth instance (local Supabase CLI dev setups do support `auth.admin.inviteUserByEmail` against the local Auth server and the local inbucket/`local_smtp` email-testing server on port 54324 per `supabase/config.toml`). If you can stand up a local instance, do so and report real output. If you cannot (or partially can), say exactly what you verified, what you couldn't, and why — do not claim an end-to-end pass you didn't actually observe. This mirrors how T015 handled its own external-blocker gap (see `docs/swarm/archive/T015-worker-packet.md` / checker packet for the precedent).

## Acceptance Criteria
- **BLOCKER-class (constitution item 5):** no service-role key ever appears in `src/` or any frontend-bundled file — not applicable here since you touch no `src/` file, but also confirm the service-role key is read only via `Deno.env.get(...)` inside the function, never hardcoded, never echoed back in any response body or error message, never logged.
- Invite row created with correct role/student linkage per the table above (role from the caller's request, `student_id` set correctly for student/parent invites and `null` for admin/coach invites, `invited_by` = the authenticated caller's own `profiles.id`, never client-supplied).
- `expires_at` = 14 days from creation (AUTH-06).
- The function rejects non-staff callers (403/DES-16-style error) before touching the database.
- `role` is never taken as an unvalidated free-text string — validate against the `role_enum` vocabulary (`admin`,`coach`,`student`,`parent`) before insert, since a bad value would otherwise fail at the DB check constraint with a less useful error.
- No PII in logs (constitution item 6) — if you log anything for debugging, do not log the invitee's email/name in a way that would persist in a real logging backend; prefer logging IDs.

## Relevant Constitution Excerpts
- Item 4: "RLS is default-deny; any table without policies → BLOCKER. Policies use only the 8.4 security definer helpers; a policy subquerying its own table → BLOCKER." (Not modifying RLS here, but your authorization check must not try to "helpfully" bypass or duplicate RLS logic incorrectly — read the caller's role from `profiles` via a proper query, don't invent a shortcut.)
- Item 5: "No secrets in the repo: `.env*` gitignored; service-role keys never appear in frontend code or client bundles → BLOCKER."
- Item 6: "No PII (student names, emails) in logs, URLs, analytics, commit messages, or test fixtures."
- Item 9: "Dependency allowlist: `@astryxdesign/*`, `@supabase/supabase-js`, ... Anything else requires boss-architect approval." (`@supabase/supabase-js` is allowlisted; import it in the Deno function via the standard `npm:@supabase/supabase-js@2` or `https://esm.sh/@supabase/supabase-js@2` specifier — either is fine, note which you used.)
- Item 14: "Copy follows PRD DES-14…16... Timestamps stored UTC, displayed America/Chicago (NFR-09)." — any error message text you write must follow DES-16 ("what happened + what to do," no apologies).
- Non-Negotiable: "No worker may mark its own work complete."

## Most Recent Failure
None. This is the first attempt (attempt count: 0).

## Required Worker Output
- files created (exact paths + full contents)
- explanation of the two-client architecture (caller-JWT client for authorization vs. service-role client for the writes)
- confirmation of exactly which env vars are used and that none are hardcoded (grep evidence)
- local Supabase invocation output if you managed to stand one up, or an explicit statement of what wasn't verifiable and why
- explicit confirmation you did NOT attempt Resend/branded-email wiring (per the Scope Boundary section) and where you left the extension point for T048
- known risks (e.g. the ROS-05 multi-student-invite case, exact error-response shape downstream tasks will need to match)
- whether a dispute is needed
