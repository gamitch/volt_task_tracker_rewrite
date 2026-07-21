# Worker Packet: T020

## Task ID
T020

## Objective
Two independent deliverables under one task, per the ledger row:
1. **AUTH-04 "no-access" screen**: a Google sign-in whose email has no pending invite and no
   existing profile lands on a "You're not on the roster yet" screen (team contact name, zero data
   access), and the session is signed out.
2. **NFR-02 RLS-denial test**: independently prove RLS denies all data to a profile-less
   authenticated user across `students`, `events`, `attendance` (zero rows in every case).

These two deliverables are unrelated in mechanism (a React page vs. a database test) but share one
acceptance story (AUTH-04's UI claim and its underlying RLS guarantee), which is why they're one
ledger row. Build them independently; nothing in file 2 should be imported by file 1 or vice versa.

## Dependencies (status)
- T012 (RLS helpers + policies) — Passed. Already validated the exact "orphan authenticated
  session" scenario this task needs (a real `auth.users` row with no `profiles` row) as part of its
  own test matrix — see `docs/swarm/verification-log.md`'s `## T012` entry. You are not inventing
  this scenario from scratch; you are building a dedicated, focused test suite for it.
- T018 (`/accept-invite` screen) — Passed. Read `src/pages/accept-invite/{AcceptInvitePage.tsx,types.ts}`
  (read-only reference, do not import from it) for the established pattern this task's page should
  mirror: a data-loading-seam for information with no live backend source, explicit DES-12 state
  mapping, `guards.tsx` placeholder wiring, and "flag the gap, don't invent architecture."
- T019 (invite-acceptance trigger) — Passed. Confirms the shape of a "no profile exists" outcome:
  if no matching `invites` row existed for the signed-in email, the trigger never fires and no
  `profiles` row is created — this is exactly the AUTH-04 scenario.

## Allowed Files
- `src/pages/no-access/**` (new directory — confirm with `Glob`, expect nothing there yet).
- `tests/rls/**` (new top-level directory — confirm with `Glob`, expect nothing there yet).

## Forbidden Files
- `src/app/router.tsx` — **read-only**. There is currently no `/no-access` route anywhere in the
  route table, not even a placeholder (confirmed by reading the file directly — grep it yourself).
  Building the real component will **not** make it reachable in the running app. This is the same
  class of gap T016/T018 hit and flagged; do not edit `router.tsx`, build the component anyway, and
  flag the wiring gap explicitly in your output (this one is slightly different from T016/T018's
  gap since there isn't even a placeholder route yet — say so).
- `src/app/guards.tsx` — **read-only** (import `useAuth`, `Role`, `AuthUser` from here for the
  no-access page's sign-out call; do not edit).
- `supabase/migrations/**` — read-only reference for your RLS test (do not add a new migration;
  this task tests existing, already-Passed schema/policies, it does not change them).
- `supabase/tests/**` — read-only reference. T014's existing scratch-Postgres test suite there
  (`auth_stub.sql`, `seed.sql`, `assertions.sql`, `run.sh`) is a close methodological precedent for
  your own `tests/rls/**` suite — read it for the pattern, do not modify it or add your files there
  (your Allowed Files are `tests/rls/**`, a separate new top-level directory, matching this task's
  own ledger row).
- `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. No real Supabase auth/data client exists anywhere in `src/` yet.** Same situation T016/T018
faced. Build the full, real-looking UI (EmptyState content, sign-out call) but wire it to the
existing `guards.tsx` placeholder contract (`logout()`), the same way `LoginPage.tsx`/
`AcceptInvitePage.tsx` do. Do not build a one-off real Supabase client scoped to this page.

**2. Where does "team contact name" come from?** This is a genuine, unresolved gap, the same class
T018 hit for invitee name/role. The schema has no "team contact" concept anywhere: `teams` (per
`supabase/migrations/20260716000000_identity_roster.sql`) has only `name`, `short_name`, `program`,
`color`, `archived`, `sort_order` — no contact person/email/phone column at all, on `teams` or
anywhere else. Design the component so it accepts this via a **documented data-loading seam**
(props / a typed interface + an obviously-fake default), same pattern as T018's
`AcceptInviteData`/`LoadInviteFn`. State explicitly in your output: (a) the data shape you designed
against, (b) that no real mechanism to populate it exists yet (the schema itself would need a new
column or table before any real implementation is possible — this is a *schema* gap, not just a
missing Edge Function, worth saying explicitly since it's a different flavor of gap than T018's),
and (c) this as a dispute candidate for the foreman/boss to route.

**3. No `/no-access` route exists at all — not even a placeholder.** Unlike T016/T018, there isn't
even an inline placeholder function in `router.tsx` for this one. Flag this explicitly; it needs
its own wiring task same as T016a/T018's flagged gap, but starting from a blanker slate (a brand new
`<Route>` needs adding, not just swapping an import).

**4. The RLS test cannot exercise a live Supabase project** (none exists yet — external blocker,
per `docs/swarm/state-summary.md`'s Current Risks). Follow the disclosed-substitution precedent set
by T012/T013/T014 (all in `verification-log.md`/`docs/swarm/archive/`): stand up a scratch Postgres
instance, apply the existing migrations in order
(`20260716000000_identity_roster.sql` → `20260717000000_scheduling_attendance.sql` →
`20260717000002_rls.sql`, reading the real filenames yourself — do not guess), and reproduce the
"orphan authenticated session" scenario as its own focused, disclosed test suite: a real `auth.users`
row exists (so `auth.uid()` resolves to a real, non-null value under `SET LOCAL role authenticated;
SET LOCAL request.jwt.claims...` or equivalent), but zero matching `profiles` row exists for that
`auth.uid()`. Confirm zero rows returned from `students`, `events`, and `attendance` under that
session for every read attempt (SELECT with no WHERE clause, so RLS is the only thing limiting
rows). State explicitly if this genuinely fully satisfies NFR-02's literal wording ("student
fetching another student's attendance gets zero rows") or if that specific sub-case (a student
*with* a real profile trying to read a *different* student's row) is a distinct scenario from
AUTH-04's completely profile-less case — both are worth testing if time allows, but the ledger's
own T020 acceptance criteria is explicit that the profile-less case is the primary requirement.

## Acceptance Criteria
1. No-access page: shows a team-contact name (via the seam, not fabricated live data), a DES-16
   "what happened + no apologies" message ("You're not on the roster yet."), zero data access
   (nothing else rendered), and signs the session out (`logout()` from `guards.tsx`) — decide and
   document when the sign-out fires (on mount vs. on an explicit action) and why.
2. DES-12 states mapped and documented for the no-access page, same rigor as T016/T018's mapping
   (this page has fewer states than a form — document why, don't just skip the exercise).
3. Every Astryx component prop used is cited against `docs/swarm/astryx-api.md` directly (line
   reference) — a prop not present there is presumed hallucinated (constitution item 2, MAJOR).
4. Full keyboard path, visible focus, both light and dark mode (DES-17/NFR-07, constitution item
   15 — BLOCKER if broken) — even though this page likely has zero/minimal interactive elements,
   confirm and document that explicitly rather than skipping the check.
5. No box-drawing/bracket characters rendered in the DOM (constitution item 13).
6. RLS-denial test: a real, runnable, disclosed test suite under `tests/rls/**` proving zero rows
   for a profile-less authenticated session across `students`/`events`/`attendance`, following the
   T012/T014 scratch-Postgres precedent (state your method explicitly, do not silently substitute
   something weaker without saying so).
7. Both gaps (no `/no-access` route at all; no team-contact data source anywhere in the schema)
   explicitly flagged as dispute candidates in your Required Worker Output, with your
   recommendation on resolution.
8. `npm run build` / `npm run typecheck` / `npm run lint` all exit 0 (this task adds no JS/TS files
   under `tests/rls/**` unless you choose a JS/TS-based test runner — if you do, confirm it doesn't
   get swept into the default `npm run lint`/`npm run test` scope in a way that breaks CI, same
   proactive check the state-summary.md "Known Decisions" section flags for any new top-level
   directory; if you use plain SQL/shell like T014 did, this is moot — say which you chose and why).
9. Any temporary render-harness file used to produce evidence is deleted before handoff, and you
   say so explicitly. Any scratch Postgres instance/data is disclosed and not committed.

## Relevant Constitution Excerpts
> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md` (PRD DES-19). A prop
> absent from that file is presumed hallucinated → MAJOR.

> 4. RLS is default-deny; any table without policies → BLOCKER; a policy subquerying its own table
> → BLOCKER. (Not this task's job to change policies — this task independently *proves* the
> existing ones work as intended.)

> 14. Copy follows PRD DES-14…16 (sentence case, named actions, prescribed empty/error text).

> 15. Accessibility per PRD DES-17 / NFR-07 is a shipping requirement; keyboard path failures on
> core flows → BLOCKER.

Non-Negotiable: "No worker may mark its own work complete." Every checker inspects the actual
artifact, not your summary.

## PRD Ground Truth (verbatim)
> **AUTH-04** A Google sign-in with an email that has **no** pending invite or existing profile
> lands on a "You're not on the roster yet" screen (name of team contact, no data access) and the
> session is signed out. RLS independently guarantees zero data visibility for profile-less users.

> **NFR-02** Playwright smoke tests for the four persona flows... plus login and RLS-denial
> (student fetching another student's attendance gets zero rows).

## Most Recent Failure
None. This is attempt 1 for T020 (attempt count: 0).

## Required Worker Output
- Files created under `src/pages/no-access/**` and `tests/rls/**` — full contents.
- Prop-by-prop cross-check against `astryx-api.md` (line references) for every Astryx component
  used on the no-access page.
- Explicit DES-12 state mapping decision + reasoning for the no-access page.
- Explicit statement of the data shape/seam you designed for team-contact name, and confirmation
  you did not fabricate a live query (no such data exists anywhere in the schema).
- Explicit confirmation of how/when sign-out is wired to `guards.tsx`'s `logout()`.
- Explicit dispute-candidate flags for both gaps (no `/no-access` route at all; no team-contact
  schema column anywhere), each with your recommendation.
- Explicit statement of your RLS test methodology (scratch Postgres vs. any alternative), full test
  output showing zero-row results for every table/scenario, and an explicit statement on how fully
  this satisfies NFR-02's literal wording.
- Screenshots (both modes) of the no-access page; keyboard walkthrough notes (even if minimal).
- Confirmation any temporary render-harness file and scratch Postgres data were deleted/discarded.
- `npm run build`/`typecheck`/`lint` output, plus your RLS test suite's own run output.
- Known risks; whether a dispute is needed.

---
**ARCHIVED** 2026-07-19 — closed out as part of T020 PASS close-out.
