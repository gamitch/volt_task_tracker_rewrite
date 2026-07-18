/**
 * T006: NAV-01 application chrome wrapper.
 *
 * Composes the Astryx `AppShell` (top-level layout frame) with `TopNav` as
 * its `topNav` slot. `SideNav` (T007) and `MobileNav` (T008) do not exist
 * yet, so `sideNav` is intentionally `undefined` and `mobileNav` is
 * intentionally `false` -- both are documented, sanctioned `AppShell` prop
 * values (astryx-api.md's own `AppShell` example shows
 * `<AppShell mobileNav={false} />` as the way to disable it), not a
 * workaround. See `docs/swarm/astryx-api.md` "AppShell" section for the
 * `topNav`/`sideNav`/`mobileNav` prop definitions this relies on.
 *
 * `/login` and `/accept-invite` are pre-auth public entry points. PRD 7.1
 * assigns `/login` the "Basic Login" template ("VOLT wordmark above the
 * card" as its own standalone identity element) and `/accept-invite` the
 * "Login Card" pattern -- neither route is described as living inside the
 * app's `TopNav`/`SideNav` chrome. Both routes therefore render chromeless
 * here (this component returns `children` directly, skipping the Astryx
 * `AppShell`/`TopNav`), so that the future real `/login` (T016) and
 * `/accept-invite` (T018) page implementations don't inherit an incorrect
 * "wrapped in app chrome" assumption from this task. `routePaths.login` /
 * `routePaths.acceptInvite` (from `./router`) are referenced instead of
 * hardcoded path strings so a future path rename doesn't silently break
 * this bypass.
 *
 * `LayerProvider` and `Theme` are NOT rendered here -- NAV-01 says wrap the
 * *app* in `Layer`/`Theme`, not just this shell, so both routes above still
 * need those providers. `App.tsx` wraps `AppShell` in `LayerProvider` and
 * `Theme` at the app root, covering every route including the chromeless
 * two.
 */
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { AppShell as AstryxAppShell } from '@astryxdesign/core';
import { routePaths } from './router';
import { TopNav } from '../components/nav/TopNav';

export interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps): ReactNode {
  const location = useLocation();
  const isChromeless =
    location.pathname === routePaths.login || location.pathname === routePaths.acceptInvite;

  if (isChromeless) {
    return <>{children}</>;
  }

  return (
    <AstryxAppShell topNav={<TopNav />} sideNav={undefined} mobileNav={false}>
      {children}
    </AstryxAppShell>
  );
}
