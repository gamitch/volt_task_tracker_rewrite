# Worker Packet: T018

## Task ID
T018

## Objective
Build the `/accept-invite` screen (AUTH-03 step 3): shows the invitee's name + role, and a choice of "Set a password" or "Continue with Google" to complete account creation. Use the `Login Card` pattern (PRD 7.1: "`/accept-invite` → `Login Card` pattern") adapted with content only — do not invent a custom layout (constitution item 13). Implement the DES-12 error state for expired/revoked invites.

## Dependencies (status)
- T016 (`/login` screen) — Passed. Read `src/pages/login/LoginPage.tsx` (read-only reference, do not import from it) for the established pattern this task should mirror: real Astryx components, DES-12 state mapping, `guards.tsx` placeholder wiring, and the "flag the gap, don't invent architecture" posture documented in `docs/swarm/archive/T016-worker-packet.md`.
- T017 (`send-invite` Edge Function) — Passed. Defines the `invites` row shape (see Ground Truth below) and the fact that `inviteUserByEmail` is called **at invite-send time**, not at acceptance time — this has a direct, non-obvious consequence for this task (see Known Context/Traps).

## Allowed Files
- `src/pages/accept-invite/**` (new directory — confirm with `Glob` yourself; expect nothing there yet).

## Forbidden Files
- `src/app/router.tsx` — **read-only**. The current `/accept-invite` route renders an inline placeholder `AcceptInvitePage()` function defined directly inside `router.tsx` (confirmed by reading the file directly: lines 39–41, `function AcceptInvitePage(): ReactNode { return <div>Accept Invite (placeholder)</div>; }`, wired at line 124). Building your real component will **not** make it reachable at `/accept-invite` in the running app — this is the exact same gap T016 hit and flagged, and it is already logged as an expected follow-up in `docs/swarm/state-summary.md` ("T018 will need its own router.tsx wiring task for AcceptInvitePage, same shape as T016a"). Do not edit `router.tsx` yourself. Build the complete component anyway, verify it via a temporary, self-deleted standalone render harness (same technique T016 used), and flag the wiring gap explicitly in your output.
- `src/app/guards.tsx` — **read-only** (import `useAuth`, `Role`, `AuthUser`, `consumeIntendedUrl` from here; do not edit).
- `src/app/AppShell.tsx`, `src/components/nav/**` — not this task (this route is chromeless, same as `/login`; you don't need to touch or reason about AppShell).
- `supabase/**` — this task is frontend-only. The `invites` table and its trigger (T019) are out of scope here.
- `docs/swarm/**`, `.claude/**`.

## Ground Truth — `invites` table (read directly from `supabase/migrations/20260717000000_scheduling_attendance.sql`, do not guess)
```sql
create table public.invites (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role role_enum not null,                       -- 'admin' | 'coach' | 'student' | 'parent'
  student_id uuid references public.students (id) on delete restrict,
  invited_by uuid not null references public.profiles (id) on delete restrict,
  status text not null check (status in ('pending', 'accepted', 'expired', 'revoked')),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
```
RLS on `invites` (from `20260717000002_rls.sql`) is `staff_all` only — **no policy lets an unauthenticated or non-staff caller read an `invites` row.** This means this page cannot query `invites` directly from the frontend even once a real Supabase client exists; whatever eventually supplies "invitee name + role" to this page must come through some other channel (e.g. a dedicated read-only Edge Function keyed by invite token, or data embedded in the invite-acceptance link itself). No such channel exists yet anywhere in the repo. See Known Context/Traps below — do not silently invent one.

## Known Context / Traps

**1. No real Supabase auth/data client exists anywhere in `src/` yet** (confirmed via repo-wide grep, zero hits for `createClient`/`supabase-js` under `src/`, per `docs/swarm/state-summary.md`'s "Current Risks"). `guards.tsx`'s `login()`/`loginWithGoogle()` are still T005's in-memory placeholder. Per T016's established precedent: build the full, real-looking UI (fields, validation, loading/error/success states, keyboard path) but wire the actual "complete sign-up" action to the existing placeholder contract (`login({ id, email, role })` / `loginWithGoogle()` / `consumeIntendedUrl()`), the same way `LoginPage.tsx` does. Do not build a one-off real Supabase client scoped to this page.

**2. Where does "invitee name + role" come from, given `invites` has no public read policy?** This is a genuine, unresolved architecture gap — not something you can correctly guess your way around. Design the component so it accepts the invite's display data (invitee name, role, status: pending/expired/revoked) via **props / a documented data-loading seam** (e.g. a small typed interface such as `AcceptInviteData { name: string; role: Role; status: 'pending'|'expired'|'revoked' }` and a clearly-named, obviously-a-placeholder loader function), rather than fabricating a live Supabase query against a table RLS explicitly forbids reading. State plainly in your output: (a) what data shape you designed against, (b) that a real mechanism to populate it (Edge Function, magic-link-embedded claims, or similar) does not exist yet and is a dispute candidate for the foreman/boss to schedule as its own task, and (c) how you exercised your DES-12 states in the interim (e.g. a temporary harness supplying fixture invite data for each of pending/expired/revoked/loading/error).

**3. `inviteUserByEmail` is called at invite-*send* time (T017), not at acceptance time.** This matters for how you think about "Continue with Google" on this screen: by the time a recipient reaches `/accept-invite`, Supabase Auth likely already has an unconfirmed `auth.users` row for their email (created when the coach clicked "Send invite"). This is context for T019 (the DB trigger), not something this task needs to resolve — but do not assume "Continue with Google" here is creating a brand-new account from scratch; document your understanding explicitly since it affects what copy/expectations you set on the button.

**4. AUTH-05 role vocabulary vs. `guards.tsx`'s `Role` type mismatch.** The DB's `role_enum` is `admin | coach | student | parent` (AUTH-05, confirmed in the `invites`/`profiles` migrations). `guards.tsx`'s `Role` type is currently `'admin' | 'staff' | 'volunteer' | 'coach'` — a stale placeholder from T005, explicitly flagged in that file's own doc comment as provisional and unreconciled. Since you cannot edit `guards.tsx`, do not attempt to "fix" this mismatch; when you call `login({ id, email, role })` to simulate account creation, use whatever role value `guards.tsx`'s actual current `Role` type accepts and flag the mismatch explicitly in your output (same category of gap T016 and T016a's ledger context already track) — do not silently coerce a `student`/`parent` role into `staff` without saying so.

## Acceptance Criteria
1. `Login Card` pattern used as-is (constitution item 13): shows invitee name + role, "Set a password" path (password + confirm fields) and "Continue with Google" path, VOLT wordmark treatment consistent with `LoginPage.tsx`'s established choice (cite which you use and why, same as T016 did).
2. All four DES-12 states mapped deliberately and documented, same rigor as T016 acceptance criterion 3: empty/initial, loading (submit in flight), error (expired/revoked invite — DES-16 "what happened + what to do," e.g. "This invite has expired. Ask your coach to send a new one." — no apologies), populated/ready-to-submit.
3. Every Astryx component prop used is cited against `docs/swarm/astryx-api.md` directly (line reference) — a prop not present there is presumed hallucinated (constitution item 2, MAJOR).
4. Full keyboard path, visible focus, both light and dark mode (DES-17/NFR-07, constitution item 15 — BLOCKER if broken).
5. No box-drawing/bracket characters rendered in the DOM (constitution item 13).
6. Submission wired to the existing `guards.tsx` placeholder contract (`login()`/`loginWithGoogle()`/`consumeIntendedUrl()`), not a new Supabase client (see Known Context/Traps #1).
7. Both open architecture gaps (router.tsx wiring; invite-data-loading seam per Known Context/Traps #2) explicitly flagged as dispute candidates in your Required Worker Output, with your recommendation on resolution — not silently worked around.
8. `npm run build` / `npm run typecheck` / `npm run lint` all exit 0.
9. Any temporary render-harness file used to produce evidence is deleted before handoff, and you say so explicitly.

## Relevant Constitution Excerpts
> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md` (PRD DES-19). A prop absent from that file is presumed hallucinated → MAJOR.

> 13. Wireframes are structural intent... Routes marked "template as-is" (PRD 7.1) get the named Astryx template; inventing custom layout there → MAJOR.

> 14. Copy follows PRD DES-14…16 (sentence case, named actions, prescribed empty/error text).

> 15. Accessibility per PRD DES-17 / NFR-07 is a shipping requirement; keyboard path failures on core flows → BLOCKER.

> 1. Precedence: PRD requirement IDs > this constitution > task-ledger text > agent judgment. Conflicts are disputes for boss-arbiter — never improvised around.

Non-Negotiable: "No worker may mark its own work complete." Every checker inspects the actual artifact, not your summary.

## PRD Ground Truth (verbatim)
> **AUTH-03 Invite flow (the only way in):**
> 1. Admin/Coach creates a roster entry... and clicks **Send invite**.
> 2. Edge Function `send-invite` creates an `invites` row and calls Supabase `inviteUserByEmail`...
> 3. Recipient lands on `/accept-invite`: shows their name + role, choice of "Set a password" or "Continue with Google".
> 4. On first successful sign-in, a DB trigger matches `auth.users.email` to the pending invite...

> **AUTH-06** Invites expire after 14 days; `/roster` shows status (Pending / Accepted / Expired)...

> 7.1: "**Template as-is:** ... `/accept-invite` → `Login Card` pattern..."

## Most Recent Failure
None. This is attempt 1 for T018 (attempt count: 0).

## Required Worker Output
- Files created under `src/pages/accept-invite/**` — full contents.
- Prop-by-prop cross-check against `astryx-api.md` (line references) for every Astryx component used.
- Explicit DES-12 four-state mapping decision + reasoning.
- Explicit statement of the data shape/seam you designed for invitee name/role/status, and confirmation you did not fabricate a live query against `invites` (RLS-forbidden).
- Explicit confirmation of how the submit/complete-signup handler is wired to `guards.tsx`'s `login()`/`loginWithGoogle()`/`consumeIntendedUrl()`.
- Explicit dispute-candidate flags for both gaps (router.tsx wiring; invite-data-loading seam), each with your recommendation (new task vs. folded into an existing one).
- Explicit note on the AUTH-05/`guards.tsx` `Role` vocabulary mismatch and how you handled it.
- Screenshots (both modes) covering all implemented states; keyboard walkthrough notes.
- Confirmation any temporary render-harness file was deleted.
- `npm run build`/`typecheck`/`lint` output.
- Known risks; whether a dispute is needed.
