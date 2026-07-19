/**
 * T056: `/reports` shell (RPT-01) -- a `TabList` with three tabs, in the
 * PRD-literal order Participation | Hours | Events, restricted to
 * coach/admin. Participation (RPT-02) is built for real by this task (see
 * `./ParticipationTab.tsx`); Hours (RPT-03) and Events (RPT-04) are
 * separate, currently-Blocked tasks (T057, T058) whose content is NOT
 * built here -- this shell renders an explicit, clearly-labeled placeholder
 * for each of those two tabs' panels instead, per this task's own Forbidden
 * Files list.
 *
 * -----------------------------------------------------------------------
 * 1. Role guard mechanism -- same pattern `RosterShell.tsx` (T021) already
 *    established and passed review for the identical `/roster` gap.
 *
 * `router.tsx`'s current `/reports` route wraps an inline `ReportsPage()`
 * placeholder in `RequireAuth` only -- no role restriction at all (read
 * directly from `router.tsx`, a forbidden/read-only file for this task).
 * That is weaker than RPT-01 requires ("`/reports` (coach/admin)"). Since
 * `router.tsx` cannot be edited here, this component enforces its own role
 * restriction internally by nesting `guards.tsx`'s exported `RequireRole`
 * (read-only import) directly in this component's render tree, one level
 * lower than a `<Route element={...}>` would put it. `RequireRole`
 * (`guards.tsx` lines 225-234) has no dependency on being used inside a
 * `<Route>` -- it just reads `useAuth()` and, if `!user ||
 * !allowedRoles.includes(user.role)`, calls
 * `pushToast(ACCESS_DENIED_TOAST_MESSAGE)` and renders `<Navigate to="/" />`,
 * otherwise renders `children`. Nesting it here therefore produces
 * byte-identical guard behavior (redirect to `/` + the exact NAV-06 toast,
 * never a re-typed string) to `router.tsx`'s own `/kiosk/:sessionId` and
 * `/settings` routes, which use this same component at the route level.
 *
 * FLAGGED GAP (not fixed here, `router.tsx` is forbidden): this is a
 * reasonable stopgap, not as robust as a route-level guard -- a
 * component-level guard still executes this component's own render logic
 * before redirecting (however briefly), which a `<Route element={<RequireAuth><RequireRole>...`
 * wrapping at the route level would avoid entirely. Recommended as a
 * candidate for a future `router.tsx`-touching corrective task (same shape
 * as T016a), which would also need to swap the inline `ReportsPage()`
 * placeholder for this real `ReportsShell` (the same "not wired into
 * router.tsx yet" gap every not-yet-built route in `router.tsx` currently
 * has, per T018/T021's own disclosed findings).
 *
 * -----------------------------------------------------------------------
 * 2. `guards.tsx`'s `Role` vocabulary gap -- resolved by T073a, not by
 *    this task (same posture T007/T018/T021 were each told to take on
 *    this same recurring gap, before it was fixed).
 *
 * `guards.tsx`'s exported `Role` union now matches AUTH-05's real
 * profile-role vocabulary exactly (`admin | coach | student | parent`),
 * previously a stale `'admin' | 'staff' | 'volunteer' | 'coach'` T005
 * placeholder. `allowedRoles={['coach', 'admin']}` below continues to read
 * correctly, now against the real (not merely coincidentally-overlapping)
 * vocabulary.
 *
 * -----------------------------------------------------------------------
 * 3. Astryx prop sourcing (constitution item 2), everything used below:
 *
 *  - `TabList`/`Tab`: `docs/swarm/astryx-api.md` lines 2044-2055 (`TabList`
 *    Props table: `value`, `onChange`, `children` used) + `Tab`'s own
 *    subsection (line 2059) reads "undefined" in the file, resolved via
 *    `npm run astryx -- component Tab` (`value`, `label` used) -- same
 *    doc-gap-resolution pattern `RosterShell.tsx` used for the same two
 *    components.
 *  - `Heading`: `astryx-api.md` cross-references `Heading` from the "Text"
 *    section (line 856) but its own subsection (line 882) reads
 *    "undefined"; resolved via `npm run astryx -- component Heading`
 *    (`level`, `children` used). `level={1}` for this page's own top
 *    heading (first and only h1 on the page).
 *  - `EmptyState`: `astryx-api.md` lines 3991-4001 (Props table). `title`
 *    (required), `description`, and `headingLevel={2}` (so the Hours/
 *    Events placeholders sit correctly under this page's `level={1}`
 *    heading rather than skipping to the component's own default h3 --
 *    the exact MINOR finding T021's checker raised against `RosterShell.tsx`,
 *    applied here proactively) are used.
 *  - `VStack`: `astryx-api.md` lines 374-396 (Props table). `gap`/`padding`
 *    used for page-level spacing, same as `RosterShell.tsx`.
 *
 * -----------------------------------------------------------------------
 * 4. Season scoping (RPT-01: "season-scoped").
 *
 * No season-selection UI exists anywhere yet (no PRD excerpt available to
 * this task describes one, and building it is out of this task's scope --
 * it is not one of this task's two allowed files' stated jobs). This shell
 * passes `ParticipationTab.tsx`'s own disclosed placeholder
 * (`PLACEHOLDER_CURRENT_SEASON_ID`, see that file's module doc #4/"Placeholder
 * current season") through as the default `seasonId`, overridable via this
 * component's own `seasonId` prop for a future season-picker task to wire
 * up without touching this file's guard/tab-scaffold logic.
 *
 * -----------------------------------------------------------------------
 * 5. DES-12 four-state reasoning for the Hours/Events placeholder panels:
 *    same as `RosterShell.tsx`'s reasoning for its four dataless tabs --
 *    these two panels perform zero data fetching (T057/T058's job, not
 *    this task's), so only the "empty" bucket is reachable; inventing
 *    loading/error/populated branches with nothing real behind them would
 *    itself be fabricated content (constitution item 13). The Participation
 *    tab (`ParticipationTab.tsx`) DOES perform real data fetching and
 *    models all four DES-12 states -- see that file's own module doc.
 */
import { useState, type ReactNode } from 'react';
import { EmptyState, Heading, Tab, TabList, VStack } from '@astryxdesign/core';
import { RequireRole } from '../../app/guards';
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

const HOURS_PLACEHOLDER = {
  title: 'Hours report not built yet',
  description:
    'This tab is a placeholder shipped by the /reports shell (T056, RPT-01). The real hours report (RPT-03, sourced from v_student_hours) is built by a separate, currently-Blocked task (T057).',
};

const EVENTS_PLACEHOLDER = {
  title: 'Events report not built yet',
  description:
    'This tab is a placeholder shipped by the /reports shell (T056, RPT-01). The real events report (RPT-04) is built by a separate, currently-Blocked task (T058).',
};

export interface ReportsShellProps {
  /** Overridable for a future season-picker task -- see module doc #4. */
  seasonId?: string;
  /** Threaded through to `ParticipationTab`'s injectable data seam. */
  loadParticipationData?: LoadParticipationDataFn;
}

export function ReportsShell({
  seasonId = PLACEHOLDER_CURRENT_SEASON_ID,
  loadParticipationData,
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
        {activeTab === 'hours' && (
          <EmptyState
            headingLevel={2}
            title={HOURS_PLACEHOLDER.title}
            description={HOURS_PLACEHOLDER.description}
          />
        )}
        {activeTab === 'events' && (
          <EmptyState
            headingLevel={2}
            title={EVENTS_PLACEHOLDER.title}
            description={EVENTS_PLACEHOLDER.description}
          />
        )}
      </VStack>
    </RequireRole>
  );
}

export default ReportsShell;
