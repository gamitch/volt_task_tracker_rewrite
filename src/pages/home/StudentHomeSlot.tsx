/**
 * T008: isolated placeholder reserving where T054's real "Check in"
 * live-meeting card (MTG-10, part of NAV-05 / HOME-02) will later render on
 * Student Home.
 *
 * Scope (deliberately narrow -- see T008 worker packet "StudentHomeSlot
 * Scope"): there is no real Student Home page yet (`CoachHome`/
 * `StudentHome`/`ParentHome` are T053/T054/T055, all unstarted). This
 * component is NOT that page. It is a standalone component with a stable
 * on/off prop contract (`hasLiveSession`) that T054 will render inside the
 * real `StudentHome.tsx` it builds later. It is not added to `router.tsx`,
 * any page, or `AppShell.tsx` -- it is deliberately unreachable in the
 * running app today.
 *
 * MTG-10 (line 284): "Student Home live card (NAV-05): 'Meeting live now' +
 * 6-char code input + Check in button; same validation path as QR." Building
 * the real 6-char code input, the "Check in" button, any Supabase query, or
 * any real live-session detection logic is explicitly T054's job (ledger
 * T054: "live-meeting check-in card (MTG-10, wired into T008's slot)...
 * check-in path reuses T032's validation, not a re-implementation"). This
 * component's only obligations are: (1) render nothing by default/when
 * `hasLiveSession` is false or absent, and (2) exist with a stable enough
 * prop contract for T054 to render it.
 *
 * `Card` props used (`children` only, no other prop): astryx-api.md "Card"
 * Props table, line 2964 (`children: ReactNode`).
 */
import type { ReactNode } from 'react';
import { Card } from '@astryxdesign/core';

export interface StudentHomeSlotProps {
  /**
   * Whether a meeting session is currently live for this student. No real
   * query exists yet (T054 wires the real Supabase-backed value from MTG-10
   * / the live-session data model). Defaults to `false` so this component
   * is inert (renders nothing) until T054 passes real data through it.
   */
  hasLiveSession?: boolean;
}

export function StudentHomeSlot({ hasLiveSession = false }: StudentHomeSlotProps): ReactNode {
  if (!hasLiveSession) {
    return null;
  }

  // Minimal, explicitly-labeled reservation -- NOT the real MTG-10 UI
  // (6-char code entry, Check in button, QR-equivalent validation path).
  // That is T054's job, reusing T032's validation per T054's own acceptance
  // criteria. This is only proving the slot's on/off contract.
  return (
    <Card variant="default" padding={4}>
      Check-in card placeholder — reserved for MTG-10 live check-in UI (built in T054)
    </Card>
  );
}
