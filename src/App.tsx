/**
 * T006: wires the router (T005), auth/role guards (T005), the app-level
 * `LayerProvider`/`Theme` providers (NAV-01), and the `AppShell`/`TopNav`
 * chrome (this task) together. Previously a placeholder
 * (`<div><h1>VOLT Team Portal</h1></div>`) -- `router.tsx`'s module doc
 * explicitly deferred this wiring to T006, since `TopNav` cannot be
 * keyboard-tested or screenshotted in either color mode unless it is
 * actually mounted in the running app.
 *
 * Provider order (outside-in): `BrowserRouter` > `AuthProvider` (NAV-06/
 * NAV-08 guards need router context for `useLocation`/`Navigate`) >
 * `LayerProvider` (NAV-01) > `Theme` (NAV-01, `voltTheme` from
 * `src/theme/volt.ts`) > `AppShell` (NAV-01 chrome, chromeless bypass for
 * `/login`/`/accept-invite`) > `AppRoutes` (T005's full Section 7 route
 * table).
 */
import { BrowserRouter } from 'react-router-dom';
import { LayerProvider, Theme } from '@astryxdesign/core';
import { AppShell } from './app/AppShell';
import { AppRoutes } from './app/router';
import { AuthProvider } from './app/guards';
import { voltTheme } from './theme/volt';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <LayerProvider>
          <Theme theme={voltTheme}>
            <AppShell>
              <AppRoutes />
            </AppShell>
          </Theme>
        </LayerProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
