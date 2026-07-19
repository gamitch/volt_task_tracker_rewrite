# Worker Packet: T080

## Task ID
T080 — `EmptyState` heading-level sweep + `CoachHome.tsx` DES-04 color-mapping fix (MINOR follow-up
from T067), Epic E11.

## Objective
T067's accessibility audit (Passed) found two cross-screen MINOR findings that weren't in scope for
any single prior task to fix:

**NEW-1**: `EmptyState` rendered with no `headingLevel` prop defaults to `<h3>`. When it's a direct
sibling of a page's `<Heading level={1}>` (or, worse, the only heading in that render branch at
all), this skips or breaks the heading hierarchy for screen-reader navigation. Confirmed real,
citable locations (verify each yourself before fixing — line numbers may have drifted since the
audit):
- `RosterShell.tsx`, `StudentsTab.tsx` (one of its two `EmptyState`s only), `ParentsTab.tsx`,
  `InvitesTab.tsx`, `TeamsTab.tsx` — h1→h3 skip, direct sibling of the page's `<Heading level={1}>`.
- `LiveConsole.tsx` (empty-roster state) — same pattern, on the live check-in console.
- `SeasonSettings.tsx`, `NoAccessPage.tsx` — same pattern.
- `OutreachDetail.tsx` (its `notFound` branch) — worse than a skip: zero `<h1>` anywhere in that
  render branch (the real page title only exists in the `success` branch).
- Five duplicated "Sign in to view X" no-user boilerplate instances, each a lone `<h3>` with zero
  `<h1>` in that branch: `MeetingsList.tsx`, `OutreachList.tsx`, `ParentHome.tsx`, `CoachHome.tsx`,
  `StudentHome.tsx`.

**NEW-2**: `CoachHome.tsx`'s event-type `Badge` color mapping (`meeting: 'blue', outreach: 'purple',
competition: 'teal'`) is inconsistent with `CalendarPage.tsx`/`EventsTab.tsx` (both correctly
`meeting: 'purple', outreach: 'blue', competition: 'orange'`, matching DES-04's PRD-cited palette).

## Allowed Files
- `src/pages/roster/RosterShell.tsx`, `StudentsTab.tsx`, `ParentsTab.tsx`, `InvitesTab.tsx`,
  `TeamsTab.tsx`
- `src/pages/meetings/LiveConsole.tsx`, `MeetingsList.tsx`
- `src/pages/settings/SeasonSettings.tsx`
- `src/pages/no-access/NoAccessPage.tsx`
- `src/pages/outreach/OutreachDetail.tsx`, `OutreachList.tsx`
- `src/pages/home/ParentHome.tsx`, `CoachHome.tsx`, `StudentHome.tsx`
- Each file's own `*.test.tsx`, if a test needs updating to reflect the corrected heading level.

## Forbidden Files
- Every file not listed above. This is a narrow, mechanical polish sweep — do not expand into
  behavioral changes, refactors, or files outside this list. `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. NEW-1's fix is almost always a one-line `headingLevel` prop addition** (e.g. `headingLevel={2}`
on an `EmptyState` that's a direct sibling of a page's `<Heading level={1}>`) — verify each site's
actual heading structure yourself (line numbers in the Objective section may have drifted since the
audit) rather than blindly adding the same prop value everywhere; some sites may need
`headingLevel={2}`, others might already be nested one level deeper.

**2. The five duplicated "Sign in to view X" instances are prime candidates for a small shared
component**, since they're the same bug independently reintroduced five times. If you find they're
genuinely identical in structure, consider extracting a shared `SignInRequiredState`-style component
(T067's own audit suggested this) — but only if it's a clean, low-risk extraction; if each site has
real, non-trivial differences, five individual one-line fixes are also acceptable. State your choice
and why.

**3. `OutreachDetail.tsx`'s `notFound` branch needs a real fix, not just a `headingLevel` prop** —
since there's no `<h1>` anywhere in that branch at all, either add one (e.g. wrap the `EmptyState`
with a real page-level `<Heading level={1}>VOLT</Heading>`, matching the pattern
`NoAccessPage.tsx`/`LoginPage.tsx` already use for pages with no other natural page title) or give
the `EmptyState` itself `headingLevel={1}` if that's structurally correct for a page with no other
heading. Read the actual branch first before choosing.

**4. NEW-2's fix**: correct `CoachHome.tsx`'s event-type Badge variant mapping to
`meeting: 'purple', outreach: 'blue', competition: 'orange'`, matching `CalendarPage.tsx`/
`EventsTab.tsx` exactly. Verify against those two files' real current mapping first (don't assume
the values above are still accurate) and against `docs/swarm/astryx-api.md`'s DES-04 citation if
you want the PRD source. This is a one-line-per-row constant change; verify `CoachHome.test.tsx`'s
existing badge-rendering assertions still pass (they should, unless they specifically asserted the
old, wrong colors, in which case update them to the corrected values).

## Acceptance Criteria
- All listed `EmptyState` heading-level sites fixed with correct, verified `headingLevel` values.
- `OutreachDetail.tsx`'s `notFound` branch has a genuine `<h1>` (or equivalent) in that render path.
- `CoachHome.tsx`'s event-type color mapping matches `CalendarPage.tsx`/`EventsTab.tsx`.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run format:check` all
  clean, zero regressions.

## Relevant Constitution Excerpts
> No worker may mark its own work complete; every PASS requires independent checker-inspected
> evidence.

## Most Recent Failure
None. This is attempt 1 for T080 (attempt count: 0) — first dispatch.

## Required Worker Output
- Full diff of every changed file.
- Confirmation of each heading-level site's actual (verified, not assumed) fix.
- Your choice on the shared-component-vs-five-individual-fixes question (Trap #2) and why.
- Full test/typecheck/lint/build output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
