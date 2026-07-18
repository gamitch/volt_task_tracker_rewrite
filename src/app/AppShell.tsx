/**
 * T006: NAV-01 application chrome wrapper.
 *
 * Composes the Astryx `AppShell` (top-level layout frame) with `TopNav` as
 * its `topNav` slot, `SideNav` (T007) as its `sideNav` slot, and, as of
 * T008, `MobileNav` as its `mobileNav` slot (NAV-05: below 768px, `SideNav`
 * is replaced by the `MobileNav` drawer). See `docs/swarm/astryx-api.md`
 * "AppShell" section for the `topNav`/`sideNav`/`mobileNav` prop
 * definitions this relies on.
 *
 * `mobileNav` D004 note: this passes the `MobileNavConfig` OBJECT form,
 * `{ content: <MobileNav /> }`, not the plain `<MobileNav />` ReactNode
 * shorthand the original T008 packet mandated. In the actually-installed
 * `@astryxdesign/core@0.1.6`, the ReactNode shorthand sets an internal
 * "full escape hatch" flag that permanently disables the shell's own
 * mobile-nav-open context state, which in turn makes `MobileNavToggle`
 * render nothing and `openMobileNav`/`toggleMobileNav` permanent no-ops --
 * i.e. the drawer can never open. The `{ content }` object form keeps the
 * shell's context state enabled, renders our `MobileNav` as the drawer's
 * content (suppressing Astryx's own auto-generated drawer), and puts
 * `TopNav` into its "mobile-bar" render mode below the `breakpoint` (768px,
 * matching NAV-05), which auto-injects a working `MobileNavToggle` trigger
 * inside `TopNav` itself -- no `TopNav.tsx` edit needed to satisfy NAV-05's
 * "triggered from TopNav" requirement. See docs/swarm/dispute-log.md D004
 * for the full source-verified evidence and ruling (this is the
 * corrective, boss-arbiter-authorized fix superseding the original
 * packet's mandated wiring).
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
import { SideNav } from '../components/nav/SideNav';
import { MobileNav } from '../components/nav/MobileNav';

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
    <AstryxAppShell
      topNav={<TopNav />}
      sideNav={<SideNav />}
      mobileNav={{ content: <MobileNav /> }}
    >
      {children}
    </AstryxAppShell>
  );
}
