/**
 * T006: wires the router (T005), auth/role guards (T005), the app-level
 * `LayerProvider`/`Theme` providers (NAV-01), and the `AppShell`/`TopNav`
 * chrome (this task) together. Previously a placeholder
 * (`<div><h1>VOLT Team Portal</h1></div>`) -- `router.tsx`'s module doc
 * explicitly deferred this wiring to T006, since `TopNav` cannot be
 * keyboard-tested or screenshotted in either color mode unless it is
 * actually mounted in the running app.
 *
 * T148: closes the "light mode/dark mode settings do not work" report --
 * `Theme` now receives a real `mode` prop sourced from `ThemeModeProvider`
 * (`./app/ThemeModeProvider.tsx`), instead of always defaulting to
 * `'system'`. `ThemeModeProvider` mounts inside `AuthProvider` (it reads
 * `useAuth()`) and wraps `Theme` (a small nested `ThemedShell` component
 * reads `useThemeMode()` and passes `mode` through, since `Theme` cannot
 * itself call the hook that supplies its own `mode` prop). See
 * `ThemeModeProvider.tsx`'s own module doc for the full flash-fix / seam
 * design.
 *
 * Provider order (outside-in): `BrowserRouter` > `AuthProvider` (NAV-06/
 * NAV-08 guards need router context for `useLocation`/`Navigate`) >
 * `ThemeModeProvider` (T148, needs `useAuth()`) > `LayerProvider` (NAV-01) >
 * `ThemedShell`/`Theme` (NAV-01, `voltTheme` from `src/theme/volt.ts`, `mode`
 * from `useThemeMode()`) > `AppShell` (NAV-01 chrome, chromeless bypass for
 * `/login`/`/accept-invite`) > `AppRoutes` (T005's full Section 7 route
 * table).
 */
import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import { LayerProvider, Theme } from '@astryxdesign/core';
import { AppShell } from './app/AppShell';
import { AppRoutes } from './app/router';
import { AuthProvider } from './app/guards';
import {
  ThemeModeProvider,
  useThemeMode,
  type ThemeModeProviderProps,
} from './app/ThemeModeProvider';
import { voltTheme } from './theme/volt';

/**
 * T148: the one small component between `ThemeModeProvider` and `Theme` --
 * `Theme` cannot itself call the hook that supplies its own `mode` prop, so
 * this reads `useThemeMode()` and passes the resolved `mode` through.
 */
function ThemedShell({ children }: { children: ReactNode }): ReactNode {
  const { mode } = useThemeMode();
  return (
    <Theme theme={voltTheme} mode={mode}>
      {children}
    </Theme>
  );
}

export interface AppProps {
  /**
   * T148: injectable pass-through onto `ThemeModeProvider`, mirroring
   * `AppShell.tsx`'s own `seasonProviderProps` pattern -- narrower than an
   * `authProviderProps` seam would be, since it only ever injects a loader
   * function, never an entire auth module. Defaults to `undefined` (spreads
   * to nothing); production code never passes this, only tests do
   * (`App.test.tsx`).
   */
  themeModeProviderProps?: Omit<ThemeModeProviderProps, 'children'>;
}

function App({ themeModeProviderProps }: AppProps = {}) {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ThemeModeProvider {...themeModeProviderProps}>
          <LayerProvider>
            <ThemedShell>
              <AppShell>
                <AppRoutes />
              </AppShell>
            </ThemedShell>
          </LayerProvider>
        </ThemeModeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
