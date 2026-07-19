/**
 * T056 (original shell + Participation wiring) + T085 (this task, corrective
 * wiring): `/reports` shell (RPT-01) -- a `TabList` with three tabs, in the
 * PRD-literal order Participation | Hours | Events, restricted to
 * coach/admin.
 *
 * T085 UPDATE (read this first -- supersedes this file's original "Hours/
 * Events are currently-Blocked" framing): Hours (RPT-03) and Events (RPT-04)
 * now render their real, already-Passed components (`HoursTab`/T057,
 * `EventsTab`/T058) -- both landed and were independently checker-Passed
 * well after this shell's own T056 dispatch, and this file's own module doc
 * was simply never updated afterward (T057/T058's own Allowed Files
 * forbade touching this shell, by design, to keep each tab task narrowly
 * scoped -- the same "STANDALONE component, not wired into
 * `ReportsShell.tsx`" posture `StudentsTab.tsx`/`ParentsTab.tsx`/etc. also
 * disclosed for `RosterShell.tsx`). The stale "currently-Blocked" claim
 * below was discovered via live manual testing of the real running app
 * (T085's own packet), the same wiring gap `RosterShell.tsx` had for its own
 * four tabs. Participation's own wiring (T056) was already correct and is
 * unchanged by this task -- it remains this file's own established
 * precedent for how a real tab gets rendered here.
 *
 * -----------------------------------------------------------------------
 * 1. Role guard mechanism -- unchanged from T056, same pattern
 *    `RosterShell.tsx` established.
 *
 * `router.tsx`'s `/reports` route wraps this component in `RequireAuth`
 * only, so this component enforces its own coach/admin restriction
 * internally via `guards.tsx`'s `RequireRole`, nested in this component's
 * own render tree. `RequireRole` renders `AccessDeniedPage` in place (T076's
 * corrected behavior) whenever `!user || !allowedRoles.includes(user.role)`.
 * `router.tsx` (read-only reference, not edited here) already imports and
 * renders the real `ReportsShell` at `/reports` -- the "not wired into
 * router.tsx" gap this file's original module doc flagged as a candidate for
 * a future corrective task was closed independently of this one.
 *
 * -----------------------------------------------------------------------
 * 2. Season scoping (RPT-01: "season-scoped") -- extended, not changed.
 *
 * No season-selection UI exists anywhere yet (unchanged from T056's own
 * disclosure). This shell threads ONE `seasonId` value (defaulting to
 * `ParticipationTab.tsx`'s own disclosed `PLACEHOLDER_CURRENT_SEASON_ID`
 * placeholder) to all THREE tabs now -- `ParticipationTab`, `HoursTab`, AND
 * `EventsTab` -- so all three share one season selection rather than
 * inventing a second, different placeholder for the two tabs this task
 * wires up (T085's own packet, Known Context/Traps #3, explicit
 * instruction). `HoursTab`/`EventsTab` each independently define their own
 * copy of the identical `PLACEHOLDER_CURRENT_SEASON_ID` literal (their own
 * module docs -- neither imports it from this forbidden/read-only
 * `ParticipationTab.tsx` file, since each is its own standalone component),
 * so this shell's own default continues to line up with both tabs' own
 * fixture data keyed to that same literal value.
 *
 * -----------------------------------------------------------------------
 * 3. `loadHoursData`/`loadEventsData` -- new optional injectable seams,
 *    added for parity with `loadParticipationData`'s already-established
 *    precedent (T056), not required by T085's own acceptance criteria but a
 *    direct, mechanical extension of it: `HoursTab`/`EventsTab` each already
 *    expose their own `loadData` prop (their own `HoursTabProps`/
 *    `EventsTabProps`), so this shell threads an optional override through
 *    to each, exactly the same shape `loadParticipationData` already uses
 *    for `ParticipationTab`. Both default to `undefined`, which each tab's
 *    own `loadData = default...` prop default then resolves to its own
 *    fixture-backed default loader -- no real Supabase wiring is added
 *    anywhere in this file (T085's own explicit scope boundary).
 *
 * -----------------------------------------------------------------------
 * 4. Astryx prop sourcing (constitution item 2) -- unchanged from T056 for
 *    every prop still used below; `EmptyState` is no longer imported or
 *    rendered anywhere in this file (Hours/Events no longer render
 *    placeholders), so its citation is removed rather than left describing a
 *    prop this file no longer uses:
 *
 *  - `TabList`/`Tab`/`Heading`/`VStack`: same citations T056 already
 *    established (`docs/swarm/astryx-api.md` "TabList"/"Stack" Props
 *    tables; `Tab`/`Heading`'s own subsections are `undefined` doc-
 *    generation gaps, resolved via `npm run astryx -- component <Name>`,
 *    same disclosed CLI-cross-check pattern every content page in this
 *    project uses).
 *
 * -----------------------------------------------------------------------
 * 5. DES-12 four-state reasoning -- T056's original module doc explained why
 *    the Hours/Events placeholder panels only modeled the "empty" DES-12
 *    bucket (no real data fetching existed yet for either). That reasoning
 *    is now obsolete: `HoursTab`/`EventsTab` each perform their own real
 *    data fetching and model all four DES-12 states internally (see each
 *    tab's own module doc), the same way `ParticipationTab` already did.
 *    This shell itself has no DES-12 state of its own to model -- it only
 *    decides WHICH already-self-contained tab component to render, unchanged
 *    from how it always treated `ParticipationTab`.
 */
import { useState, type ReactNode } from 'react';
import { Heading, Tab, TabList, VStack } from '@astryxdesign/core';
import { RequireRole } from '../../app/guards';
import { EventsTab, type LoadEventSessionsDataFn } from './EventsTab';
import { HoursTab, type LoadHoursDataFn } from './HoursTab';
import {
  ParticipationTab,
  PLACEHOLDER_CURRENT_SEASON_ID,
  type LoadParticipationDataFn,
} from './ParticipationTab';

type ReportsTabValue = 'participation' | 'hours' | 'events';

interface ReportsTabConfig {
  value: ReportsTabValue;
  label: string;
}

/** RPT-01's literal tab order: Participation | Hours | Events. */
const REPORTS_TABS: readonly ReportsTabConfig[] = [
  { value: 'participation', label: 'Participation' },
  { value: 'hours', label: 'Hours' },
  { value: 'events', label: 'Events' },
];

export interface ReportsShellProps {
  /** Overridable for a future season-picker task -- see module doc #2. */
  seasonId?: string;
  /** Threaded through to `ParticipationTab`'s injectable data seam. */
  loadParticipationData?: LoadParticipationDataFn;
  /** Threaded through to `HoursTab`'s injectable data seam -- module doc #3. */
  loadHoursData?: LoadHoursDataFn;
  /** Threaded through to `EventsTab`'s injectable data seam -- module doc #3. */
  loadEventsData?: LoadEventSessionsDataFn;
}

export function ReportsShell({
  seasonId = PLACEHOLDER_CURRENT_SEASON_ID,
  loadParticipationData,
  loadHoursData,
  loadEventsData,
}: ReportsShellProps = {}): ReactNode {
  const [activeTab, setActiveTab] = useState<ReportsTabValue>(REPORTS_TABS[0].value);

  return (
    <RequireRole allowedRoles={['coach', 'admin']}>
      <VStack gap={6} padding={6}>
        <Heading level={1}>Reports</Heading>

        <TabList value={activeTab} onChange={(value) => setActiveTab(value as ReportsTabValue)}>
          {REPORTS_TABS.map((tab) => (
            <Tab key={tab.value} value={tab.value} label={tab.label} />
          ))}
        </TabList>

        {activeTab === 'participation' && (
          <ParticipationTab seasonId={seasonId} loadData={loadParticipationData} />
        )}
        {activeTab === 'hours' && <HoursTab seasonId={seasonId} loadData={loadHoursData} />}
        {activeTab === 'events' && <EventsTab seasonId={seasonId} loadData={loadEventsData} />}
      </VStack>
    </RequireRole>
  );
}

export default ReportsShell;
