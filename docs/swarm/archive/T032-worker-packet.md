# Worker Packet: T032

## Task ID
T032

## Objective
Build the `checkin` Supabase Edge Function (Deno runtime) — the core of the whole MTG-06…MTG-12 QR/short-code check-in flow. It must:
1. Accept a rotating token (QR path) or a 6-char short code (manual entry path) and validate it via HMAC-SHA256.
2. Validate session liveness and that the checking-in student is in scope for the session's team.
3. Upsert one `attendance` row (`method='qr'`), auto-computing `present`/`late` per the 10-minute grace rule (OQ-3).
4. Be idempotent on duplicate check-ins (MTG-09) and never let a QR write clobber a coach's `method='coach'` row (MTG-11).
5. Rate-limit short-code attempts to 5/min/user.

## Dependencies (status)
- T010 (scheduling/attendance migration) — Passed. Defines `events`, `event_sessions`, `attendance`.
- T012 (RLS) — Passed. Defines `auth_role()`, `is_staff()`, `my_student_ids()` and confirms `attendance` deliberately has **no** student/parent insert policy (see below — this is why the check-in write must go through this Edge Function under the service role, not a client-side insert).

## Allowed Files
- `supabase/functions/checkin/**` (new directory — verify with `ls supabase/functions/` yourself; expect nothing there yet).

## Forbidden Files
- Any file under `supabase/migrations/**` — the schema is frozen; if you find you need a table/column that doesn't exist (see the rate-limit note below), flag it, do not add a migration.
- `src/**` — this is a backend-only task. The frontend callers (Kiosk T034, Live Console T033, Student Home check-in card T054, `/checkin` result screen T035) are all separate future tasks that will call this function's contract; you are not building any of them.
- `docs/swarm/**`, `.claude/**`.

## Ground Truth — table schemas (read directly from the migration files, do not guess)

From `supabase/migrations/20260717000000_scheduling_attendance.sql`:
```sql
create table public.events (
  id uuid primary key default gen_random_uuid(),
  season_id uuid not null references public.seasons (id) on delete restrict,
  type text not null check (type in ('meeting', 'outreach', 'competition')),
  title text not null, description text not null,
  location_name text not null, address text not null,
  team_ids uuid[],                       -- null = all teams
  counts_participation boolean not null, counts_volunteer_hours boolean not null,
  adult_volunteers_count integer not null default 0, adult_volunteer_hours numeric not null default 0,
  created_by uuid references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.event_sessions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  session_date date not null,
  starts_at timestamptz not null, ends_at timestamptz not null,
  status text not null check (status in ('scheduled', 'completed', 'canceled')),
  people_reached integer, notes text not null,
  created_at timestamptz not null default now()
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.event_sessions (id) on delete restrict,
  student_id uuid not null references public.students (id) on delete restrict,
  status text not null check (status in ('present', 'late', 'excused', 'absent')),
  check_in_at timestamptz, check_out_at timestamptz,
  hours_override numeric,
  method text not null check (method in ('qr', 'coach', 'import')),
  recorded_by uuid references public.profiles (id) on delete restrict,
  updated_at timestamptz not null default now(), created_at timestamptz not null default now(),
  unique (session_id, student_id)
);
```
`students(id, profile_id, display_name, team_id, ...)` is from T009's migration — `students.profile_id` links a student's own account; use `my_student_ids()`-equivalent logic (or a direct query) to resolve the caller's own student row.

## Ground Truth — RLS context (read directly from `supabase/migrations/20260717000002_rls.sql`)
```sql
alter table public.attendance enable row level security;
create policy staff_all on attendance for all to authenticated using (is_staff()) with check (is_staff());
create policy own_or_linked_read on attendance for select to authenticated using (student_id in (select my_student_ids()));
```
The RLS migration's own comment is explicit and load-bearing for your design: *"Deliberately NO insert/update policy for students/parents: ... student self-check-ins happen only inside the `checkin` Edge Function under the service role after token validation (service role bypasses RLS as table owner). Adding a student/parent write policy here would be incorrect per the matrix."* So: extract the caller's identity from their own JWT (same pattern as T017 — anon-key client + their `Authorization` header, or equivalent) to know *who* is checking in, resolve their `student_id`, then perform the actual upsert with a **separate service-role client**.

## Ground Truth — PRD text (read the source yourself if anything here is ambiguous; PRD Section 6 is authoritative over this packet)
- **MTG-04 (session liveness):** "A session is live from 15 minutes before `start_time` until `end_time`. Coach can also manually Start check-in early/late from the session row." There is **no** schema column tracking a manual "started" state (`event_sessions` only has `status`/`session_date`/`starts_at`/`ends_at`/`people_reached`/`notes` — confirmed above). Implement liveness as: `status = 'scheduled'` AND `now() >= starts_at - interval '15 minutes'` AND `now() <= ends_at`. The "coach can manually start early/late" clause has no backing schema field to check against in the current (frozen) migrations — treat this as a known interpretation gap: implement the time-window rule as the sole liveness check, and flag the manual-override clause explicitly in your worker output as something a future task (most likely T033's Live Console) may need additional schema for, rather than inventing a new column yourself.
- **MTG-06 (token/short-code construction):** "QR encodes `https://portal.voltfrc.org/checkin?s=<sessionId>&t=<token>`; alongside it a 6-character A–Z/2–9 short code. Token = HMAC-SHA256(`sessionId` + 60-second time bucket, `CHECKIN_HMAC_SECRET`), truncated; short code derived from the same HMAC. The Edge Function `checkin` accepts current and previous bucket (≤ 2 min validity). ... Short-code attempts rate-limited to 5/min per user." Compute the 60-second bucket as `floor(unix_time / 60)`. Accept the current bucket and the immediately previous bucket (i.e. two valid buckets at any moment, giving ≤2 min effective validity as stated). Derive the 6-char short code deterministically from the same HMAC digest (e.g. base32-style mapping of digest bytes restricted to the `A-Z2-9` alphabet — document exactly how you derived it since T034 (Kiosk) and T035 (Student Home code entry) will need to independently reproduce/verify against your exact scheme later). Note QR *generation* (the token itself, and the client-side 45s refresh) belongs to T033/T034 — this task only needs to **validate** tokens/short codes presented to it, but you do need to implement the identical HMAC construction so your validation logic is self-consistent and so those future tasks have an unambiguous spec to target (state your exact derivation clearly in your output).
- **MTG-08 (auto status + validation order):** "validates token, session liveness, and that the student belongs to the session's team scope, then upserts `attendance` with `method='qr'`, `check_in_at=now()`. Status auto-set: `present` if `check_in_at ≤ start_time + 10 min`, else `late`." (`OQ-3`: 10-minute grace is the constant `LATE_GRACE_MIN`, not user-configurable in v1 — hardcode it, document it as a named constant.) "Team scope" = the student's `team_id` must be in the session's parent event's `team_ids` array, or that array must be `null` (all teams).
- **MTG-09 (idempotency):** "Duplicate check-in is idempotent — show 'Already checked in at 6:04 PM', no error." If an `attendance` row already exists for `(session_id, student_id)`, do not error and do not create a second row (the `unique(session_id, student_id)` constraint would reject a duplicate insert anyway) — detect the existing row first and return a success-shaped "already checked in" response using its `check_in_at` (if null — e.g. a coach-entered row with no recorded time — fall back to a generic "You're already checked in for this session" without a specific time; flag this edge case explicitly in your output rather than guessing at what UI copy to show, since the exact wording is T035's job, not yours — you just need the response payload to carry enough information for T035 to render either case).
- **MTG-11 (coach override always wins):** "A coach tap upserts with `method='coach'`, `recorded_by=coach`, and always wins over QR values (QR writes never overwrite a `method='coach'` row)." Your upsert's `ON CONFLICT (session_id, student_id) DO UPDATE` clause must include a `WHERE attendance.method <> 'coach'` guard (or equivalent) so a QR check-in against a session where a coach already recorded that student is a no-op on the attendance row itself — but MTG-09's idempotent-response behavior should still apply (respond as if checked in, using the existing coach-recorded state, not an error).
- **MTG-12:** Only coaches/admins may set `excused` — not directly relevant to this function (you only ever write `present`/`late` via the auto-status rule), but do not accept any caller-supplied `status` override in this function's request payload; the status is always computed by this function from the grace rule, never trusted from the client.
- **DES-16 error copy:** "Errors say what happened and what to do... No apologies, no 'Oops'." The PRD's own worked example for this exact function: *"That check-in code expired. Codes refresh every minute — grab the new one from the screen."* Write equivalent copy for each rejection case (expired/invalid token, session not live, student not on this team's roster) — do not just return raw error codes with no message.

## Rate limiting — flag this, do not invent schema
No rate-limit tracking table exists anywhere in the frozen schema (T009–T012). You cannot add one (forbidden — migrations are out of scope for this task). Implement the 5/min/user short-code limit using an in-process/in-memory mechanism scoped to the function's own runtime, and **explicitly document this as a known limitation** in your worker output: Deno Edge Functions can run as multiple isolated instances under load, so a purely in-memory counter is not perfectly enforced across cold starts or horizontal scale-out. If you believe correctness genuinely requires a persisted rate-limit store, say so explicitly as a flagged risk/open question for the foreman rather than silently working around the schema freeze (e.g. do not repurpose an unrelated existing table for this).

## External Blocker — flag this explicitly, do not fabricate live verification
No live Supabase project exists yet for this app (same category of blocker as T015/T017). You cannot prove this function end-to-end against a real deployed instance with real QR scans. What you can and must do: write structurally correct, secret-free code; unit-test the pure logic that doesn't need a live DB (HMAC token/short-code generation and validation across bucket boundaries, the grace-period boundary condition at exactly 10 minutes, the override-precedence guard clause, the rate-limiter's counting logic) with real, runnable tests — these don't require a live Supabase project, just Deno's test runner or an equivalent local harness. If a local Supabase instance (`supabase start`) can be stood up in this sandbox, additionally exercise the full upsert/idempotency/team-scope paths against it and report real output. State plainly what was and wasn't verified.

## Acceptance Criteria
- **BLOCKER-class (constitution item 5):** `CHECKIN_HMAC_SECRET` never appears in `src/` or any frontend-bundled file (not applicable here since you touch no `src/` file — but also confirm it: read only via `Deno.env.get('CHECKIN_HMAC_SECRET')`, never hardcoded, never echoed in a response body or logged).
- Coach `method='coach'` rows are never overwritten by a QR write (MTG-11) — prove this with a real test (insert a coach row, attempt a QR check-in for the same student/session, assert the row is unchanged).
- Expired/invalid tokens produce a DES-16-style error payload (what happened + what to do, no apologies) — not a bare error code.
- Duplicate check-ins are idempotent (MTG-09) — no error, no duplicate row, response is success-shaped.
- 10-minute grace boundary tested at the edges (exactly at 10:00 → `present`; one second past → `late`).
- Rate limiting implemented and its in-memory-only limitation explicitly documented as a known risk, not silently glossed over.

## Relevant Constitution Excerpts
- Item 4: "RLS is default-deny... a policy subquerying its own table → BLOCKER." (Context only — you're not writing RLS, but your service-role bypass logic must not accidentally reintroduce a client-writable path around it.)
- Item 5: "No secrets in the repo... service-role keys never appear in frontend code or client bundles → BLOCKER." Also covers `CHECKIN_HMAC_SECRET` by the same logic (SEC-03: "`CHECKIN_HMAC_SECRET`, `RESEND_API_KEY` live only in Supabase Edge Function secrets").
- Item 6: "No PII... in logs, URLs, analytics... test fixtures use fabricated names."
- Item 9: "Dependency allowlist: `@astryxdesign/*`, `@supabase/supabase-js`, ... Anything else requires boss-architect approval." Use only Deno's built-in `crypto.subtle` for HMAC-SHA256 (no external crypto package needed) and `@supabase/supabase-js` for the DB clients.
- Item 14: DES-14…16 copy rules apply to every error message this function returns.
- Non-Negotiable: "No worker may mark its own work complete."

## Most Recent Failure
None. This is the first attempt (attempt count: 0).

## Required Worker Output
- files created (exact paths + full contents)
- exact HMAC token and short-code derivation scheme, spelled out precisely (future tasks T033/T034/T035 depend on reproducing/verifying against this exact scheme)
- test output: token/bucket validity window, grace-period boundary, override-precedence guard, idempotency, rate-limit counting — real runnable test results, not narrative claims
- local Supabase invocation output if you managed to stand one up, or an explicit statement of what wasn't verifiable and why
- explicit flag on the MTG-04 "manual early/late start" schema gap and how you resolved it (time-window-only rule)
- explicit flag on the rate-limiter's in-memory-only limitation
- known risks (e.g. MTG-09's null-`check_in_at` response shape for coach-recorded rows)
- whether a dispute is needed
