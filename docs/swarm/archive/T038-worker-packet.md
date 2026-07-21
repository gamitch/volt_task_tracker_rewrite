# Worker Packet: T038

## Task ID
T038

## Objective
Build `src/pages/outreach/OutreachList.tsx` — the `/outreach` list page (OUT-01). Coach view:
season goal `ProgressBar` (team total vs. sum of individual goals) with BEH-01 milestone ticks at
25/50/75/100%, Upcoming (`AvatarGroup` signup counts) / Past sections, "New outreach event" action.
Student/parent view: own goal bar (BEH-02: confirmed vs. planned segments, never summed into one
number) + a per-row RSVP `SegmentedControl` (OUT-01/OUT-03 preview).

## Dependencies (status)
- T007 (SideNav, role-filtered) — Passed. Built the Outreach nav item's neutral `Badge` slot
  (BEH-04) with an explicitly-labeled placeholder count (`PLACEHOLDER_OUTREACH_BADGE_COUNT = 0` in
  `src/components/nav/SideNav.tsx`), with a module comment stating "the real count is wired by
  T038" — read Known Context/Traps #3 below before assuming you can fulfill that literally.
- T019 (invite-acceptance trigger) — Passed. Not directly consumed here; in the dependency chain
  because it unblocked this epic's first content-page wave alongside T021/T030/T038.

## Allowed Files
- `src/pages/outreach/OutreachList.tsx` (new — confirm via `Glob` that `src/pages/outreach/`
  doesn't exist yet)

## Forbidden Files
- `src/pages/outreach/OutreachEventDialog.tsx`, `RsvpControl.tsx`, `OutreachDetail.tsx`,
  `MarkDayCompleteDialog.tsx`, `ParentRsvp.tsx`, `Leaderboard.tsx` — separate, currently-Blocked
  tasks (T039, T040, T041, T042, T043, T044). Render an obvious "New outreach event" action and
  row-level RSVP controls only to the extent OUT-01 itself calls for them on the list page, but do
  not build their real dialog/detail behavior. State explicitly what you left as a stub and why.
- `src/app/router.tsx` — **read-only**. `/outreach` is already wired (`RequireAuth` only, no role
  restriction — confirmed by reading the route table directly; role-variant page, not role-gated,
  same posture as T030's `/meetings`).
- `src/app/guards.tsx` — **read-only** (import `useAuth` for role-branching; do not edit).
- `src/components/nav/SideNav.tsx` — **read-only, do not edit.** See Known Context/Traps #3 — this
  is the single most important trap in this packet.
- `src/lib/supabase/**` — **read-only reference only, do not import from it in this task.** Same
  posture as every other content page so far (T071 exists, Passed, but wiring is a separate
  not-yet-dispatched follow-up). Build against an injectable `loadData`-style seam with an
  obviously-fake fixture default.
- `docs/swarm/**`, `.claude/**`, `supabase/**`.

## Known Context / Traps

**1. No shared Supabase client wired in — deliberate scope, not a gap for you to solve.** Same
posture as T030 and every prior content page. Build the real, complete UI against fixture data
(fabricated names only, constitution item 6), typed against the real `events`/`event_sessions`/
`rsvps` column shapes in `supabase/migrations/20260717000000_scheduling_attendance.sql` (read-only)
so it's structurally realistic even though it's fake.

**2. NAV-07 — this route must never mix in meeting items.** `/outreach` shows only outreach-type
events. Grep your own file for any meeting-session-shaped field/import before calling it done.

**3. THE CENTRAL TRAP: the ledger's Acceptance line says "Outreach nav badge (BEH-04) wired to
real unanswered-RSVP count," but `src/components/nav/SideNav.tsx` — the file that actually renders
that badge — is explicitly forbidden to you (it's a separate task's file, not yours to edit, and
editing it here would be a forbidden-file violation).** You cannot literally complete that
Acceptance clause from within `OutreachList.tsx` alone, because the badge lives in a component tree
this page doesn't render or control (`SideNav` is rendered by `AppShell`, not by any individual
page). What you CAN and MUST do instead: compute/expose the real (fixture-backed, for now)
unanswered-RSVP count as a clearly-named, reusable, exported value or hook within your own file
(e.g. an exported `getUnansweredRsvpCount(fixtureData)` or equivalent) so that a future small
wiring task can trivially plug it into `SideNav.tsx`'s existing `PLACEHOLDER_OUTREACH_BADGE_COUNT`
constant. **Flag this scope tension explicitly in your output as a dispute candidate** — do not
silently either (a) skip the badge-count logic entirely, or (b) attempt to edit `SideNav.tsx`
anyway. This is the same class of "flag, don't silently work around or silently skip" situation
every prior content-page task has correctly handled (T018's router-wiring gap, T034/T035/T056's
shared-client gap, etc.).

**4. BEH-01 — season goal milestone ticks at 25/50/75/100%, with a `Toast` fired on crossing each
milestone, deduplicated per device/season via `localStorage`.** The dedupe key must be scoped to
season (not just a global "have I ever seen this toast" flag) — read the ledger's own Acceptance
line wording carefully: "dedupes per device/season."

**5. BEH-02 — confirmed (accent-colored) vs. planned (lighter-colored) hour/goal segments must
never be summed into one displayed number.** This applies to both the coach's team-total bar and
the student/parent's own bar. If your fixture data has both confirmed and planned values, render
them as two visually distinct segments of the same `ProgressBar`, never as `confirmed + planned`
collapsed into a single figure anywhere in the UI (including alt text/aria-labels).

**6. BEH-04 — the badge (wherever it eventually lands) must use neutral styling only, never a
red/alert/error-colored badge variant**, even though "unanswered RSVPs" might intuitively read as
something needing urgent attention. Apply this same neutral-styling principle to any badge/count
you render directly within `OutreachList.tsx` itself (e.g. per-row signup counts).

## Acceptance Criteria
- Coach view: season goal `ProgressBar` with BEH-01 milestone ticks + deduped `Toast`; Upcoming
  (`AvatarGroup` signup counts) / Past sections; "New outreach event" action.
- Student/parent view: own goal bar with BEH-02 confirmed/planned segments never summed; per-row
  RSVP `SegmentedControl`.
- NAV-07: zero meeting-shaped content anywhere in this file.
- BEH-04: any badge/count rendered uses neutral styling only.
- The SideNav-badge scope tension (Known Context/Traps #3) is explicitly flagged in your output as
  a dispute candidate, with a concrete, reusable count-computation exposed for a future wiring task
  to consume — not silently skipped, not worked around by editing the forbidden file.
- DES-12: all four states (loading, empty, error, populated) built and demonstrated for both role
  variants.
- No box-drawing/bracket characters rendered (constitution item 13).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` all exit 0.

## Relevant Constitution Excerpts
> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md`. A prop absent from that
> file is presumed hallucinated → MAJOR.

> 6. No PII... test fixtures use fabricated names.

> 12. Every async screen ships all four states — loading, empty, error, populated (PRD DES-12).
> Happy-path-only → MAJOR.

## Most Recent Failure
None. This is attempt 1 for T038 (attempt count: 0).

## Required Worker Output
- Full contents of `OutreachList.tsx`.
- Explicit statement of what you deliberately stubbed (New event dialog target, RSVP control's
  real persistence, detail page links) and why, per Forbidden Files.
- Explicit, prominent write-up of the SideNav-badge scope tension (Known Context/Traps #3) and the
  exported count-computation you built for a future wiring task.
- Screenshots or DOM-text proof of both role variants across all four DES-12 states, plus the
  BEH-01 milestone-toast dedupe behavior (crossing a milestone twice fires the toast once).
- Citation of the real `events`/`event_sessions`/`rsvps` column shapes your fixture data is modeled
  on (file + line).
- Astryx prop citations for every component used (`ProgressBar`, `AvatarGroup`, `SegmentedControl`,
  `Toast`, etc. — grep `astryx-api.md` yourself, don't guess).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
