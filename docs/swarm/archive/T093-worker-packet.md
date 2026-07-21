# Worker Packet: T093

## Task ID
T093 — URGENT: fix live CI failure on PR #1 (commit `b98c84e`). The NFR-04 bundle-size
gate failed: initial route JS is 311,051 bytes gzipped, exceeding the 300 KB (307,200
byte) budget by ~3.8 KB. Typecheck/lint/test(1010/1010)/build all passed cleanly — this
is purely the bundle-size check.

## Objective
`router.tsx` statically imports every page component, so the entire app — including
pages a given user will never visit in a session (Kiosk, Settings, Reports, etc.) — ships
in one eager entry chunk. Cumulative feature growth this session (the ED-1 data-wiring
epic added real Supabase client usage to most pages) pushed that chunk over budget.
Vite's own build output already suggests the fix: `dynamic import() to code-split the
application`. This is exactly the mechanism T085 already used (and had
checker-accessibility-verified) for one component, `AdminToggles.tsx` — apply the same
`React.lazy` + `Suspense` pattern to every route in `router.tsx`.

## Allowed Files
- `src/app/router.tsx`

## Forbidden Files
- Every page component file itself — do not touch their internals, only how they're
  imported.
- `src/app/AppShell.tsx`, `guards.tsx`, `App.tsx` — do not restructure anything outside
  `router.tsx`'s own route table.
- Every other file. `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. Convert every page-level static import to `React.lazy`.** All 13 imports at the
top of `router.tsx` (`LoginPage`, `AcceptInvitePage`, `DashboardPage`, `MeetingsList`,
`LiveConsolePage`, `KioskPage`, `CheckinResult`, `OutreachList`, `OutreachDetail`,
`CalendarPage`, `RosterShell`, `ReportsShell`, `SettingsPage`) become `const X =
React.lazy(() => import('../pages/.../X'))`. Watch for both default and named exports —
`LiveConsolePage`/`KioskPage`'s import lines look different from the others (check each
one's actual export shape before converting; a named export needs `.then(m =>
({default: m.ExportName}))` or an equivalent adapter — do not guess, check each file).

**2. Wrap in `Suspense`.** T085's precedent used `<Suspense fallback={null}>` for one
small, below-fold widget where a brief empty window is invisible/inconsequential. A
top-level ROUTE transition is different — the user is switching pages, so a `null`
fallback would produce a jarring blank-screen flash. Pick a fallback that's honest and
consistent with the rest of the app's loading-state language (check what loading
patterns other DES-12 states already use — `Spinner` is the established primitive
project-wide). Decide where the single `<Suspense>` boundary goes: wrapping the whole
`<Routes>` tree once (simplest — one fallback for any route transition) vs. per-route
(more granular, more code). State your choice and reasoning; either is defensible, but
don't leave it undecided/inconsistent across routes.

**3. Accessibility of the loading fallback.** T085's checker specifically evaluated
`Suspense fallback={null}`'s accessibility for a below-fold widget and found it
acceptable there BECAUSE nothing was ever in that slot before either. A full ROUTE's
fallback is a different situation — during a route transition, a screen reader user
needs SOME signal that navigation is in progress, not silence. Use a real `Spinner` (or
equivalent) with an accessible label, not a bare empty fallback, for this top-level case.

**4. Verify the actual bundle-size win.** After converting, rerun the exact NFR-04 gate
check locally (`npm run build`, then read `dist/index.html`'s `<script type="module"
src="...">` entries, gzip each with `gzip -9 -c <file> | wc -c`, sum them — this
mirrors the CI step exactly, read `.github/workflows/**` if you need the literal
script). Confirm the total drops meaningfully under 300 KB (not just barely under —
leave real headroom, since this exact gate will keep tightening as more features land).

**5. Do not regress any existing route-guard/redirect behavior.** `RequireAuth`/
`RequireRole` wrapping stays exactly as it is today around each route element — you are
changing what component renders, not the guard logic around it. Confirm
`tests/e2e/**`'s route/redirect Playwright suite (from T066) still passes conceptually
(you likely can't run Playwright in this sandbox per that suite's own disclosed
constraint — cite it if so, don't silently skip verification without saying why).

**6. Existing tests that render `<AppRoutes>` or navigate between routes.** Lazy-loaded
components resolve asynchronously even in tests — any existing test exercising
navigation through `router.tsx` may need an `await`/`flushMicrotasks`-style adjustment
to let the lazy chunk resolve before asserting on rendered content (same class of
timing consideration T085's `RosterShell.test.tsx` already handled for its own lazy
`AdminToggles`). Find and fix any test that breaks for exactly this reason — do not
mask a broken test by loosening its assertion.

## Acceptance Criteria
- Every route in `router.tsx` lazy-loads its page component.
- A real `Suspense` fallback with an accessible loading signal (not `null`) covers route
  transitions.
- `npm run build` + the local NFR-04 gzip-sum check both pass with real headroom under
  300 KB.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run format:check` all clean,
  zero regressions.
- No change to any file other than `router.tsx`.

## Relevant Constitution Excerpts
> No worker may mark its own work complete; every PASS requires independent
> checker-inspected evidence.

## Most Recent Failure
This task exists BECAUSE of a live CI failure — see PR #1, commit `b98c84e`, check run
`Typecheck, Lint, Test, Build, Bundle Size`, both duplicate job runs
(88254006655/88254004460), both failing identically at the bundle-size gate step
(build/tests themselves passed). Attempt 1 for T093.

## Required Worker Output
- Full diff of `router.tsx`.
- Your `Suspense` boundary placement decision (single vs. per-route) and fallback
  content, with reasoning.
- The exact before/after gzip byte totals for the initial route JS.
- Full test/typecheck/lint/build/format:check output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
