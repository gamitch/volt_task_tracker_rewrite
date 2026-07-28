# Worker Packet: T111

## Task ID
T111 — HOTFIX: `CoachHome.tsx`'s "Go to season setup" button still shows a stub
notice instead of navigating to the now-real `/settings/season` route
(live-reported by George).

## Objective
`CoachHome.tsx`'s "Season setup" card has a "Go to season setup" button whose
`onClick` calls `showStub('Season setup screen not built yet', ...)` — this was
correct when it was written (the route genuinely didn't exist yet), but T108
(already-Passed, checker-verified) has since routed `/settings/season` to the
real, fully-built `SeasonSettings.tsx`. This is the same "component built but
never wired to its sibling" pattern seen repeatedly this project — this time the
sibling is a route, not a dialog. Fix the button to navigate for real.

## Allowed Files
- `src/pages/home/CoachHome.tsx`, `CoachHome.test.tsx`

## Forbidden Files
- `src/app/router.tsx` — already correct (T108), read-only import
  (`routePaths.settingsSeason`).
- `src/pages/settings/SeasonSettings.tsx` — already correct, out of scope.
- Every other file. `guards.tsx`, `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. The fix, mirroring an existing pattern in the SAME file.** `CoachHome.tsx`
already has the exact right precedent a few dozen lines above the season-setup
button: the check-in-session card's button does
`onClick={() => navigate(routePaths.kioskSession(session.id))}` (`useNavigate()`
from `react-router-dom`, `routePaths` imported from `../../app/router`, both
already imported in this file — read the file's own top-of-file imports to
confirm). Change the season-setup button's `onClick` from the `showStub(...)`
call to `navigate(routePaths.settingsSeason)`.

**2. Confirm the exact export name.** T108 added `settingsSeason: '/settings/
season'` to `router.tsx`'s `routePaths` object — read that file (read-only) to
confirm the exact key name before using it, don't guess.

**3. `showSeasonSetupCard`/`seasonSetupDescription` and the card's own copy stay
unchanged** — only the button's `onClick` behavior changes. This card's whole
point (showing when `data.seasonSetupStatus.hasGoalsConfigured` is false) is
still valid and correct; it's only the destination that was stale.

**4. Check for other stale stub references to this same gap.** Grep this file
(and `AdminHome.tsx`/`StudentHome.tsx`/`ParentHome.tsx` if they exist and are
NOT forbidden — check the Allowed Files above first, they are NOT in this
packet's scope, do not touch them even if you find the same pattern there; just
note it in your report as a possible follow-up) for any other place that shows
"season setup screen not built yet"-style copy that should now point to the real
route. Fix only within `CoachHome.tsx`/`CoachHome.test.tsx`.

**5. Test files.** Update/add a test asserting the button now calls
`navigate(routePaths.settingsSeason)` (mirroring however the existing
kiosk-session button's navigation is already tested in this file), removing or
updating whatever test previously asserted the stub-notice behavior.

## Acceptance Criteria
- The "Go to season setup" button genuinely navigates to `/settings/season`.
- No stale "not built yet" stub-notice code path remains reachable from this
  button.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run
  format:check` all clean, zero regressions elsewhere.

## Relevant Constitution Excerpts
> No worker may mark its own work complete; every PASS requires independent
> checker-inspected evidence.

## Most Recent Failure
None. Attempt 1 (attempt count: 0). HIGH PRIORITY — live-reported by George
immediately after using T108's newly-shipped route.

## Required Worker Output
- Full diff.
- Confirmation of the exact `routePaths` key used, read directly from
  `router.tsx`.
- Note on whether the same stale-stub pattern exists in other Home variants
  (informational only, not fixed here, out of Allowed Files).
- Full test/typecheck/lint/build/format:check output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
