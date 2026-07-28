# Worker Packet: T112

## Task ID
T112 — HOTFIX: Outreach list events are dead ends — no navigation to the real
`/outreach/:eventId` detail page (live-reported by George).

## Objective
George created a real outreach event and then couldn't do anything with it: no
edit, no details, no way to see signups. All of those capabilities already exist
on `OutreachDetail.tsx` (T041/T101: real data, real Edit via `OutreachEventDialog`,
real Cancel, RSVP visibility), and `router.tsx` already routes
`/outreach/:eventId` to it for real. The gap is only in `OutreachList.tsx`: its
own module doc #8c deliberately rendered event titles as plain, non-interactive
text, justified by "`/outreach/:eventId` still resolves to an inline placeholder
div, so linking there would be misleading" — a justification that has been stale
(false) since the route was wired to the real detail page. Fix: give every event
row in the list (upcoming AND past, in BOTH the coach and student/parent views) a
real navigation affordance to its detail page.

## Allowed Files
- `src/pages/outreach/OutreachList.tsx`, `OutreachList.test.tsx`

## Forbidden Files
- `src/pages/outreach/OutreachDetail.tsx` — already correct, read-only.
- `src/app/router.tsx` — already correct, read-only import (`routePaths`).
- `src/pages/calendar/**` — read-only PRECEDENT reference (see Trap #1), do not
  modify.
- Every other file. `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. Follow the Calendar page's established pattern — investigate it first.**
The Calendar page already renders per-session "View details – <title>" links to
detail routes (George's own screenshots show them working). Read how the
calendar page builds those links (which component it uses — a real `Link`, a
`Button` with `onClick={() => navigate(...)}`, or Astryx's `ListItem`
`endContent` slot) and mirror that exact pattern here rather than inventing a
new one.

**2. The Astryx `ListItem` constraint is real — respect it, don't fight it.**
`OutreachList.tsx`'s module doc #10 records that Astryx's own docs warn "Don't
place interactive elements inside an interactive list item," and that `ListItem`
resolves only `label`/`description`/`endContent` (no `onClick`/`href`). The
correct shape (as Calendar's precedent presumably shows — verify) is a
non-interactive row with an explicit interactive element in `endContent` (a
"View details" link/button), NOT making the whole row clickable. Verify against
the real Astryx API doc (`docs/swarm/astryx-api.md`) / the installed component
the same way this file's module doc #10 already does for every other prop.

**3. Both views, both buckets.** The coach view and the student/parent view each
render Upcoming and Past lists — all four spots need the affordance. Use each
event's real `id` with the route (check how `router.tsx` names the param and
whether `routePaths` exposes a builder like it does for `kioskSession`; if
`routePaths` has no outreach-detail builder, `OutreachDetail.tsx` exports
`buildOutreachDetailUrl(eventId, origin)` — but note that builds an ABSOLUTE URL
for clipboard use; for in-app navigation you want the relative `/outreach/${id}`
path, consistent with however Calendar does it).

**4. Update the stale module-doc reasoning.** Module doc #8c's "placeholder div"
justification must be corrected — dated T112 update, same convention every prior
task used. Do not delete the history, amend it.

**5. Tests.** Assert each view's rows expose the navigation affordance with the
right target (mirroring however Calendar's own tests assert its links — read
them), and update any existing test that asserted rows are non-interactive.

## Acceptance Criteria
- Every outreach event row (coach + student/parent, upcoming + past) has a
  working navigation affordance to `/outreach/:eventId`.
- Pattern matches the Calendar page's established precedent and respects the
  Astryx ListItem interactivity constraint.
- Module doc #8c corrected with a dated update.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run
  format:check` all clean, zero regressions.

## Relevant Constitution Excerpts
> No worker may mark its own work complete; every PASS requires independent
> checker-inspected evidence.

## Most Recent Failure
None. Attempt 1 (attempt count: 0). HIGH PRIORITY — George is actively
live-testing and blocked from using events he creates.

## Required Worker Output
- Full diff.
- Your Calendar-precedent investigation (which mechanism it uses) and how you
  mirrored it.
- Full test/typecheck/lint/build/format:check output.
- Known risks; dispute flag if needed.
