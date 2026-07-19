# Worker Packet: T030

## Task ID
T030

## Objective
Build `src/pages/meetings/MeetingsList.tsx` — the `/meetings` list page (MTG-01). Coach view:
`Section`-grouped Upcoming/Past rows (date, time range, team scope, status `Badge`, past-row
attendance summary) with row actions (Edit, Cancel via `AlertDialog`) and a "Schedule meetings"
action. Student/parent view: own meeting history + participation % instead of the coach's full
list/actions. All four DES-12 states (loading, empty, error, populated).

## Dependencies (status)
- T007 (SideNav, role-filtered) — Passed. Confirms which roles reach `/meetings` and how the nav's
  active-item/document.title mechanism works (read-only reference, do not import from it).
- T019 (invite-acceptance trigger) — Passed. Not directly consumed here; it's in the dependency
  chain only because it unblocked this epic's first content-page wave alongside T021/T030/T038.

## Allowed Files
- `src/pages/meetings/MeetingsList.tsx` (new — confirm via `Glob` that this file doesn't exist yet;
  `src/pages/meetings/Kiosk.tsx` already exists from T034, Passed — do not touch it)

## Forbidden Files
- `src/pages/meetings/Kiosk.tsx` — a separate, already-Passed task's deliverable. Read-only if you
  need to see an established pattern for this directory, but do not modify it.
- `src/pages/meetings/ScheduleMeetingsDialog.tsx`, `EndMeetingDialog.tsx`,
  `src/pages/meetings/StudentMeetingView.tsx` — separate, currently-Blocked tasks (T031, T036,
  T037). Render an obvious "Schedule meetings" action button and a "consistency strip"-shaped area
  reference only where MTG-01 calls for one, but do not build their real behavior — that's not this
  task's job. Say explicitly in your output what you deliberately left as a stub and why.
- `src/app/router.tsx` — **read-only**. `/meetings` is already wired (`RequireAuth` only, no role
  restriction — confirmed by reading the route table directly; this page is reachable by every
  role, unlike T021/T056's coach/admin-only pages, because MTG-01 itself is a role-*variant* page,
  not a role-*gated* one).
- `src/app/guards.tsx` — **read-only** (import `useAuth` from here if you need the current user's
  role to pick which variant to render; do not edit).
- `src/lib/supabase/**` — **read-only reference only, do not import from it in this task.** A real
  shared Supabase client now exists (T071, Passed) but wiring any page to it is explicitly a
  separate, not-yet-dispatched follow-up task. Build this page against an injectable
  `loadData`-style seam with an obviously-fake fixture default, same pattern as every other content
  page shipped so far (`RosterShell.tsx`, `ParticipationTab.tsx`, `Kiosk.tsx`) — do not wire T071
  in yourself.
- `src/components/nav/SideNav.tsx` — read-only, do not edit (see Known Context/Traps #3 for why
  this matters even though it's not obviously related to a meetings list).
- `docs/swarm/**`, `.claude/**`, `supabase/**`.

## Known Context / Traps

**1. No shared Supabase client wired in — this is deliberate scope, not a gap you need to solve.**
T071 (Passed) built `src/lib/supabase/**` but explicitly left every page unwired; wiring is a
separate future task. Build the real, complete UI (Upcoming/Past sections, row data, status
badges, both role variants) against a clearly-typed data shape, driven through an injectable
`loadData`-style prop/hook whose default is obviously-fake fixture data (fabricated names/dates
only, constitution item 6). Cite the real `event_sessions`/`events`/`attendance` column shapes from
`supabase/migrations/20260717000000_scheduling_attendance.sql` (read-only) when typing your fixture
data, so it's structurally realistic even though it's fake.

**2. NAV-07 — this route must never mix in outreach items.** `/meetings` and `/calendar`/`/reports`
are the only routes where meeting-type items may appear; `/meetings` specifically must show ONLY
meeting sessions, never outreach events, even though both are conceptually "things on a calendar."
Grep your own file for any outreach-shaped field/import before calling it done.

**3. Real per-role "past attendance summary" and "own participation %" must come from real view
shapes, not fabricated math.** Even though you're using fixture data (see Trap #1), the *shape* of
that fixture data and how you render it must respect constitution item 3: don't invent your own
participation-percentage formula. If your fixture data needs a participation % for the
student/parent variant, source the fixture's shape from `v_student_participation`'s real columns
(read `supabase/migrations/20260717000003_metric_views.sql`, read-only) — i.e. your fixture should
look like "here's what a real query result would contain," with the percentage already computed by
the (fixture-standing-in-for) database, never computed by your component from raw counts.

**4. BEH-08 — every date/duration anywhere in this app carries a weekday name and a computed
duration**, not a bare ISO string or a raw start/end pair with no derived duration shown. Apply
this to every session row (Upcoming and Past).

**5. Status `Badge` semantics.** Each row's status `Badge` should reflect the session's real status
vocabulary — read `event_sessions.status` in the migration file (read-only) for the real enum
values rather than inventing your own status strings.

**6. DES-12's four states apply per role-variant, not just once.** Loading/empty/error/populated
must all be reachable and distinguishable for both the coach view and the student/parent view —
don't build a single set of states and assume they cover both variants' different content shapes.

## Acceptance Criteria
- Coach view: `Section`-grouped Upcoming/Past rows (date+weekday, computed time range, team scope,
  status `Badge`, past-row attendance summary), "Schedule meetings" action, row `MoreMenu` with
  Edit/Cancel (Cancel confirms via `AlertDialog`, DES-11).
- Student/parent view: own meeting history + participation % sourced from a `v_student_participation`-shaped
  fixture (Known Context/Traps #3) — never a client-computed percentage.
- BEH-08: every date/duration rendered carries a weekday name and a computed duration.
- NAV-07: zero outreach-shaped content anywhere in this file.
- DES-12: all four states (loading, empty, error, populated) built and demonstrated for both role
  variants.
- No box-drawing/bracket characters rendered (constitution item 13).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` all exit 0.

## Relevant Constitution Excerpts
> 3. RLS policies and metric SQL come **only** from PRD Section 8.4, copied verbatim. Re-deriving
> either, or duplicating a metric formula in TypeScript (PRD DATA-01) → BLOCKER.

> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md`. A prop absent from that
> file is presumed hallucinated → MAJOR.

> 6. No PII... test fixtures use fabricated names.

> 12. Every async screen ships all four states — loading, empty, error, populated (PRD DES-12).
> Happy-path-only → MAJOR.

## Most Recent Failure
None. This is attempt 1 for T030 (attempt count: 0).

## Required Worker Output
- Full contents of `MeetingsList.tsx`.
- Explicit statement of what you deliberately stubbed (Schedule meetings dialog target, Cancel
  dialog target, consistency-strip area) and why, per Forbidden Files.
- Screenshots or DOM-text proof of both role variants across all four DES-12 states.
- Citation of the real `event_sessions`/`v_student_participation` column shapes your fixture data
  is modeled on (file + line).
- Astryx prop citations for every component used (`Section`, `Badge`, `MoreMenu`, `AlertDialog`,
  etc. — grep `astryx-api.md` yourself, don't guess).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
