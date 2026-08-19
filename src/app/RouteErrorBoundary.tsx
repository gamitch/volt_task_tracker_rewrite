/**
 * GAM-387: an app-wide route error boundary. Scope, deliberately narrowed and
 * disclosed (see `docs/swarm/active/GAM-387-packet.md` §1): this catches a
 * render throw in ROUTED PAGE CONTENT -- anything rendered inside
 * `router.tsx`'s `<Routes>` -- not a throw from the app chrome (`AppShell`,
 * `SeasonProvider`, `TopNav`/`SideNav`/`MobileNav`, `KpiStrip`), which all
 * mount above `AppRoutes` in `App.tsx` (a frozen file for this task). That
 * gap is filed as GAM-422, not silently absorbed into this file's claims.
 *
 * -----------------------------------------------------------------------
 * Why a class component, not a hook.
 *
 * React has no hook equivalent of `getDerivedStateFromError`/
 * `componentDidCatch` -- catching a child's render throw is a class-only
 * capability. `RouteErrorBoundaryClass` below is therefore a plain class
 * component and stays hook-free by design (see "Reset mechanism" below for
 * why the hook logic lives in a SEPARATE wrapper instead of being merged in
 * here). No new dependency: `react-error-boundary` was confirmed absent from
 * `package.json` and unnecessary -- this is ~60 lines of plain React.
 *
 * -----------------------------------------------------------------------
 * Reset mechanism (R3) -- why `RouteErrorBoundary` (this file's one export)
 * is a small function wrapper around the class, not the class itself.
 *
 * Measured (not assumed) during this packet's premise gate: an error
 * boundary's caught state is sticky. Once `getDerivedStateFromError` sets an
 * error, the class keeps rendering its fallback on every subsequent
 * re-render, including across a route navigation -- the chrome above it
 * updates to the new path, but the fallback stays mounted and the new
 * route's element never renders at all. A plain `<RouteErrorBoundaryClass>`
 * with no reset would pass any test that only checks "fallback text
 * appears" while silently failing "navigating away recovers" -- exactly the
 * failure mode the originating issue warns about.
 *
 * The fix, also measured: give the class a `key` that changes when the
 * user navigates. Changing a component's `key` forces React to unmount the
 * old instance and mount a fresh one, wiping its state -- including a caught
 * error. `RouteErrorBoundary` below calls `useLocation()` and passes
 * `` key={`${location.pathname}${location.search}`} `` to the class. Both
 * `pathname` AND `search` are required in the key, not `pathname` alone:
 * measured that a `pathname`-only key passes "navigating to a different
 * path recovers" while leaving a same-path, search-only change (e.g.
 * `/checkin?s=1&t=A` -> `/checkin?s=1&t=B`) stuck on the fallback forever.
 * `src/pages/checkin/CheckinResult.tsx:359-361,607` reads `s`/`t`/`code`
 * entirely from search params on one pathname -- GAM-352's own page -- so a
 * pathname-only key would strand a student on the fallback for every
 * subsequent scan. `location.key` (react-router's own per-navigation-entry
 * id) was considered as an alternative and rejected: it is opaque (cannot be
 * reasoned about or reproduced in a test the way a plain string
 * concatenation can) and changes on EVERY navigation entry, including a
 * same-URL re-push, which is more resets than the one genuine defect this
 * key is fixing.
 *
 * This wrapper/class split is also why the reset key lives in THIS file and
 * not in `router.tsx`: `router.tsx` receives an import and a mount only (see
 * that file's own module doc). If the key computation lived there instead,
 * a test that builds its own `MemoryRouter` tree around
 * `<RouteErrorBoundary>` (as every test in `RouteErrorBoundary.test.tsx`
 * does) would never exercise `router.tsx` at all, so deleting the reset
 * logic would leave every such test green -- destroying the one pairing
 * (AC1 stays green while AC2a goes red) that distinguishes a working
 * boundary from a sticky one. Putting the wrapper here puts the reset logic
 * inside the same unit the tests import, so a mutation to it is actually
 * visible.
 *
 * No infinite-reset-loop hazard: a location-derived key changes at most once
 * per navigation and cannot change on its own, so it cannot re-trigger
 * itself. Measured directly: a route that throws immediately on mount
 * produced exactly one catch and a stable fallback, not a loop.
 *
 * -----------------------------------------------------------------------
 * Chunk-load detection (R4) -- reload, not retry.
 *
 * Measured: React's lazy payload sets an internal `_status = 2` on a
 * rejected import and never resets it, so unmounting and remounting the
 * failed `lazy()` component (which is all a `key`-driven reset can do) does
 * NOT re-invoke the failed `import()` -- a retry silently repeats the exact
 * same failure. A full page reload is the only recovery for this case, so a
 * detected chunk-load failure renders a distinct fallback whose one action
 * calls `window.location.reload()` instead of relying on the boundary's own
 * reset.
 *
 * `isChunkLoadError` below's predicate, and its provenance, stated
 * precisely (round 2 of this packet's gate caught an earlier overstatement):
 * the MECHANISM and the `"Unable to preload CSS for "` string are sourced
 * from the installed Vite (`node_modules/vite/dist/node/chunks/
 * dep-BK3b2jBa.js:64843,64857,64860-64866` -- Vite's `preload()` helper
 * rethrows the browser's own error unchanged on a dynamic-import failure,
 * and separately authors that one string itself for a CSS-preload failure).
 * The three browser-authored strings below (`dynamically imported module`,
 * `Importing a module script failed`, `Loading chunk`) are NOT verified
 * against this tree -- they appear nowhere under the installed `vite/`
 * package (0 grep hits) because they are authored by Chrome/Safari/Webpack
 * respectively, not by anything in this repo. They are included as
 * best-known values, not measured ones. `ChunkLoadError` is Webpack's own
 * error `name` for this failure family; this project is Vite, not Webpack,
 * but checking for it costs nothing and it is the name the most third-party
 * code in the wild checks for.
 *
 * Deliberately NOT built: a `vite:preloadError` window-event listener. Vite
 * dispatches that cancelable event (with the real error on `e.payload`)
 * before rethrowing, which would be a first-party signal immune to browser
 * message drift -- but round 2 measured that a jsdom
 * `lazy(() => Promise.reject(...))` never routes through Vite's own
 * `__vitePreload` helper, so the event can never fire in this test
 * environment and any code built against it would ship untested. Per the
 * packet's own conditional ("you may only build this path if you also test
 * it... using the string predicate alone is a fully acceptable outcome, not
 * a lesser one"), this file uses the string/name predicate alone.
 *
 * -----------------------------------------------------------------------
 * Fallback content (R5/R6/R7).
 *
 * Both fallbacks below follow `src/pages/no-access/AccessDeniedPage.tsx`'s
 * established `Center > VStack[Heading level=1 "VOLT", Card]` shell for this
 * screen family, per constitution item 13 (adapt content, don't invent a
 * layout) -- rather than composing a new one from scratch.
 *
 * Four routes (`/login`, `/accept-invite`, `/kiosk/:sessionId`,
 * `/meetings/live/:sessionId`) render chromeless (`AppShell.tsx`'s
 * `CHROMELESS_PATTERNS`) -- there is no surrounding nav for a user to
 * recover through on those routes even when nothing is wrong. Both
 * fallbacks below therefore carry their own way out (a real `Link` to `/`)
 * rather than relying on nav being present.
 *
 * Neither fallback claims anything about whether the user's data was saved
 * or lost (R5) -- the boundary genuinely cannot know that. Neither renders
 * the raw caught error's message or stack to the user (R5, on usability
 * grounds: DES-16 requires the message tell this audience what to do, and a
 * raw `TypeError` does not do that -- NOT a PII concern; constitution item 6
 * governs PII in logs/URLs/analytics/commits/fixtures, not user-facing
 * copy). Neither uses an apology ("Sorry"/"Oops") per DES-16, and both are
 * sentence case per DES-14.
 *
 * Accessibility (R7) comes from the primitives themselves, verified against
 * the installed source, not assumed: `EmptyState` renders `role="status"`
 * with its `title` as a real heading element
 * (`node_modules/@astryxdesign/core/src/EmptyState/EmptyState.tsx`), and
 * `Banner` renders `role="alert"` for `status="error"`
 * (`node_modules/@astryxdesign/core/src/Banner/Banner.tsx:341,426`). Both
 * recovery controls are a native `<button>` (`Button`, via `onClick`) or a
 * real anchor (`Link as={RouterLink}`) -- keyboard-reachable by construction,
 * so neither needs (and neither gets) an explicit `tabIndex` or key handler.
 *
 * `componentDidCatch` below logs the caught error only (never route/search
 * params or any user data, per this file's own disclosure above) -- and even
 * that is disclosed as optional: React 19 already `console.error`s every
 * caught render error on its own, so this is a duplicate, not the only
 * record. Kept anyway to give this file's own log line a distinct, greppable
 * prefix.
 */
import { Component, type ReactNode } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import {
  Banner,
  Button,
  Card,
  Center,
  EmptyState,
  Heading,
  Link,
  VStack,
} from '@astryxdesign/core';

/** See module doc "Chunk-load detection" above for the full provenance of
 * every string/name checked here. */
function isChunkLoadError(error: Error): boolean {
  if (error.name === 'ChunkLoadError') {
    return true;
  }
  return /dynamically imported module|Importing a module script failed|unable to preload|Loading chunk/i.test(
    error.message,
  );
}

/**
 * The generic fallback -- any caught render throw that is not identified as
 * a chunk-load failure. See module doc "Fallback content" above for the
 * copy/accessibility reasoning. The one action is a real client-side `Link`
 * back to `/`, not a retry: a plain re-render of the same broken subtree
 * (which is all a "try again" button could offer here, short of a full
 * reload) would very likely throw the exact same error again for a
 * code-level defect, so navigating to different, presumably-working content
 * is the honest recovery option to offer.
 */
function GenericFallback(): ReactNode {
  return (
    <Center axis="both" minHeight="100vh" width="100%">
      <VStack gap={6} hAlign="center">
        <Heading level={1}>VOLT</Heading>
        <Card width={400} maxWidth="100%" padding={6} variant="default">
          <EmptyState
            headingLevel={2}
            title="This page ran into a problem"
            description="Something went wrong while showing this page. Head back to your dashboard and try again from there."
            actions={
              <Link as={RouterLink} href="/" isStandalone>
                Go to your dashboard
              </Link>
            }
          />
        </Card>
      </VStack>
    </Center>
  );
}

/**
 * The chunk-load fallback -- a detected failed dynamic import (a stale
 * deployed chunk, a flaky network fetch, etc). See module doc "Chunk-load
 * detection" above for why a reload, not a retry, is this case's only real
 * recovery: React's lazy payload never re-attempts a rejected `import()` on
 * remount, so a "try again" action here would be silently inert.
 */
function ChunkLoadFallback(): ReactNode {
  return (
    <Center axis="both" minHeight="100vh" width="100%">
      <VStack gap={6} hAlign="center">
        <Heading level={1}>VOLT</Heading>
        <Card width={400} maxWidth="100%" padding={6} variant="default">
          <Banner
            status="error"
            title="This page couldn't finish loading"
            description="A newer version of VOLT may be available. Reload the page to get the latest version."
            endContent={
              <Button
                label="Reload page"
                variant="primary"
                onClick={() => window.location.reload()}
              />
            }
          />
        </Card>
      </VStack>
    </Center>
  );
}

interface RouteErrorBoundaryState {
  error: Error | null;
}

/**
 * The class boundary itself. Deliberately hook-free (see module doc "Why a
 * class component" above) -- `RouteErrorBoundary` below is the only export
 * from this file and is the only thing that ever renders this class.
 */
class RouteErrorBoundaryClass extends Component<{ children: ReactNode }, RouteErrorBoundaryState> {
  state: RouteErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: unknown): RouteErrorBoundaryState {
    return { error: error instanceof Error ? error : new Error(String(error)) };
  }

  componentDidCatch(error: Error): void {
    // See module doc's closing paragraph above: optional, additive, logs the
    // error object only.
    console.error('RouteErrorBoundary caught a render error:', error);
  }

  render(): ReactNode {
    const { error } = this.state;
    if (error) {
      return isChunkLoadError(error) ? <ChunkLoadFallback /> : <GenericFallback />;
    }
    return this.props.children;
  }
}

/**
 * The one export. Mounted inside `AppRoutes` (`./router.tsx`, import-and-mount
 * only per that file's own module doc) so the app chrome above it (rendered
 * by `AppShell`, which wraps `<AppRoutes />`) stays mounted no matter what
 * this boundary catches. See this file's own module doc "Reset mechanism"
 * above for why the `useLocation()` call and the `key` computation live
 * here, in the unit under test, rather than in `router.tsx`.
 */
export function RouteErrorBoundary({ children }: { children: ReactNode }): ReactNode {
  const location = useLocation();
  return (
    <RouteErrorBoundaryClass key={`${location.pathname}${location.search}`}>
      {children}
    </RouteErrorBoundaryClass>
  );
}
