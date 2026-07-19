/**
 * T021: `/roster` shell (ROS-01) -- a `TabList` with four tabs, in the
 * PRD-literal order Students | Parents | Teams | Invites, restricted to
 * `coach`/`admin`. This is a *shell* task only: it establishes the tab
 * scaffold and the route-level role guard. No tab has real data, tables,
 * dialogs, or row actions yet -- that is T022-T028's job, layered on top of
 * this scaffold in later tasks.
 *
 * -----------------------------------------------------------------------
 * 1. Role guard mechanism (packet Known Context/Traps #1).
 *
 * `router.tsx` is a forbidden (read-only) file for this task, and its
 * current `/roster` route (lines 195-202) wraps an inline `RosterPage()`
 * placeholder in `RequireAuth` only -- no role restriction at all, so it is
 * weaker than ROS-01 requires (any authenticated user, not just
 * coach/admin, currently reaches that placeholder). Since `router.tsx`
 * cannot be edited here, this component enforces its own role restriction
 * internally, nesting `guards.tsx`'s exported `RequireRole` directly inside
 * this component's render tree instead of at the `<Route element={...}>`
 * level -- the exact same component, one level lower. `RequireRole`
 * (`guards.tsx` lines 225-234) is a plain function component with no
 * dependency on being used inside a `<Route>`; it reads `useAuth()`,
 * and if `!user || !allowedRoles.includes(user.role)` it calls
 * `pushToast(ACCESS_DENIED_TOAST_MESSAGE)` and renders `<Navigate to="/" />`
 * -- otherwise it renders `children`. Nesting it here therefore produces
 * byte-identical guard behavior (redirect to `/` + the exact NAV-06 toast)
 * to `router.tsx`'s own `/kiosk/:sessionId` and `/settings` routes
 * (`router.tsx` lines 127-136, 213-222), which use this same component at
 * the route level. This was live-verified, not just asserted -- see this
 * task's worker output for the real render + role-swap evidence (a
 * `student` role redirects to `/` and fires
 * `"You don't have access to that page."` verbatim, `ACCESS_DENIED_TOAST_MESSAGE`
 * itself, never a re-typed string).
 *
 * -----------------------------------------------------------------------
 * 2. `guards.tsx` `Role` vocabulary gap (packet Known Context/Traps #2) --
 * resolved by T073a, not by this task.
 *
 * `guards.tsx`'s exported `Role` union now matches AUTH-05's real
 * profile-role vocabulary confirmed live by T019 (`admin | coach | student
 * | parent`) exactly -- previously a stale T005 placeholder
 * (`'admin' | 'staff' | 'volunteer' | 'coach'`). `allowedRoles={['coach',
 * 'admin']}` below continues to read correctly, now for the real (not
 * merely coincidentally-overlapping) vocabulary.
 *
 * -----------------------------------------------------------------------
 * 3. `router.tsx` wiring gap (packet Known Context/Traps #3) -- flagged,
 * not a new finding.
 *
 * `RosterShell` is not reachable at `/roster` in the running app: the
 * inline `RosterPage()` placeholder in `router.tsx` stays exactly as-is,
 * because `router.tsx` is a forbidden file here. This is the same
 * class of gap T016/T016a/T018 hit, and per T018's checker's independent
 * finding (`docs/swarm/verification-log.md` `## T018` entry;
 * `docs/swarm/state-summary.md` Current Risks), it is not a one-off --
 * every not-yet-built page route in `router.tsx` has this same inline
 * placeholder. Not re-derived here, just confirmed to apply to `/roster`
 * too.
 *
 * -----------------------------------------------------------------------
 * 4. DES-12 four-state reasoning for this (currently dataless) shell.
 *
 * This task performs zero data fetching: no Supabase call, no loading
 * flag, no error boundary exists anywhere in this file, by design (each
 * tab's real data-loading is T022-T028's job, not this task's). Of DES-12's
 * four states (loading/empty/error/populated), only "empty" is actually
 * reachable today, because there is no async operation in this component
 * that could ever be loading, error, or populated -- inventing those
 * branches now, with no real request behind them, would itself be
 * fabricated content (constitution item 13). Each tab therefore renders an
 * honest `EmptyState` (title + description naming this task and the
 * upcoming range of tasks that build real content) rather than silence or
 * placeholder/fake roster rows. Once T022-T028 add a real per-tab data
 * source, that tab's panel gains real loading/error/populated branches --
 * this shell's `EmptyState` is the deliberate placeholder for the
 * currently-true "empty" state only.
 *
 * -----------------------------------------------------------------------
 * 5. Astryx prop sourcing (constitution item 2) -- every prop used below,
 * cited against `docs/swarm/astryx-api.md` directly, with two disclosed
 * CLI cross-checked doc gaps (same category as T007's `SideNavItem`/
 * `SideNavSection` gap):
 *
 *  - `TabList`: `docs/swarm/astryx-api.md` lines 2044-2055 (Props table).
 *    `value` (line 2048, required), `onChange` (line 2049, required),
 *    `children` (line 2054, required) are used. `size`/`layout`/
 *    `hasDivider`/`xstyle` are not used (no need to override any default).
 *    `orientation` (line 2053, default `'horizontal'`) is deliberately left
 *    at its default -- these four tabs are a single left-to-right page-level
 *    row (matching the PRD's own literal "Students | Parents | Teams |
 *    Invites" left-to-right ordering), so ArrowLeft/ArrowRight is the
 *    correct navigation axis, not ArrowUp/ArrowDown.
 *  - `Tab`: `astryx-api.md`'s own "Components > Tab" subsection (lines
 *    2059-2062) is `undefined` -- a real doc-generation gap, not a
 *    prop-table omission I'm working around. Per the mandated cross-check,
 *    `npm run astryx -- component Tab` output (verbatim, relevant rows)
 *    resolves it:
 *      | `value` | `string` | -- | Unique value for this tab, matched
 *        against TabListContext.value. (required) |
 *      | `label` | `string` | -- | Accessible label for this tab. Used as
 *        visible text by default... (required) |
 *    Only `value` and `label` are used below; `isLabelHidden`/`href`/`as`/
 *    `icon`/`selectedIcon`/`endContent`/`xstyle` are not needed for a plain
 *    four-item text tab row.
 *  - `Heading`: `astryx-api.md`'s "Text" section documents `Heading` only
 *    by cross-reference ("Don't: Use Text for headings; use Heading with a
 *    `level` prop (1-6)...", line 856); its own "Components > Heading"
 *    subsection (lines 882-884) is likewise `undefined` -- the same class
 *    of gap as `Tab` above. `npm run astryx -- component Heading` output
 *    (verbatim, relevant rows) resolves it:
 *      | `level` | `1 | 2 | 3 | 4 | 5 | 6` | -- | Heading level... (required) |
 *      | `children` | `ReactNode` | -- | Heading content. (required) |
 *    `level={1}` is used for the page's own top-level heading (this is the
 *    first, and only, heading on the page, so it is h1 -- no level is
 *    skipped).
 *  - `EmptyState`: `astryx-api.md` lines 3991-4001 (Props table). `title`
 *    (line 3995, required), `description` (line 3996), and `headingLevel`
 *    (default `3` per the component's own JSDoc) are used; `headingLevel={2}`
 *    is set explicitly (T080 MINOR fix) because this `EmptyState` is a direct
 *    sibling of the page's own `<Heading level={1}>` above -- the default h3
 *    would otherwise skip a level in the document outline.
 *    `icon`/`actions`/`isCompact`/`xstyle` are not used -- there
 *    is no action to offer yet (nothing is loaded, nothing to retry, no
 *    "create" flow exists on this shell), so `actions` is deliberately
 *    omitted rather than inventing a button with nowhere real to go.
 *  - `VStack`: `astryx-api.md` lines 374, 378-396 (Props table, "VStack"
 *    subsection). `gap` (line 380) and `padding` (line 381) are used for
 *    page-level vertical spacing; `AppShell`'s own `contentPadding` prop
 *    (`astryx-api.md` line 2594) is left at its `0` default in the
 *    forbidden `AppShell.tsx` (dashboards/tables use `0` per that prop's
 *    own documented guidance), so this component supplies its own padding
 *    instead of relying on the shell to do it.
 */
import { useState, type ReactNode } from 'react';
import { EmptyState, Heading, Tab, TabList, VStack } from '@astryxdesign/core';
import { RequireRole } from '../../app/guards';

type RosterTabValue = 'students' | 'parents' | 'teams' | 'invites';

interface RosterTabConfig {
  value: RosterTabValue;
  label: string;
  emptyTitle: string;
  emptyDescription: string;
}

/** ROS-01's literal tab order: Students | Parents | Teams | Invites. */
const ROSTER_TABS: readonly RosterTabConfig[] = [
  {
    value: 'students',
    label: 'Students',
    emptyTitle: 'Student roster not built yet',
    emptyDescription:
      'This tab is a placeholder shipped by the /roster shell (T021, ROS-01). The real student list, search, and detail actions are built by a later roster task (T022-T028).',
  },
  {
    value: 'parents',
    label: 'Parents',
    emptyTitle: 'Parent roster not built yet',
    emptyDescription:
      'This tab is a placeholder shipped by the /roster shell (T021, ROS-01). The real parent list, search, and detail actions are built by a later roster task (T022-T028).',
  },
  {
    value: 'teams',
    label: 'Teams',
    emptyTitle: 'Team management not built yet',
    emptyDescription:
      'This tab is a placeholder shipped by the /roster shell (T021, ROS-01). Real team rosters and management actions are built by a later roster task (T022-T028).',
  },
  {
    value: 'invites',
    label: 'Invites',
    emptyTitle: 'Invite tracking not built yet',
    emptyDescription:
      'This tab is a placeholder shipped by the /roster shell (T021, ROS-01). The real invites table and actions are built by a later roster task (T022-T028).',
  },
];

export function RosterShell(): ReactNode {
  const [activeTab, setActiveTab] = useState<RosterTabValue>(ROSTER_TABS[0].value);

  const activeConfig = ROSTER_TABS.find((tab) => tab.value === activeTab) ?? ROSTER_TABS[0];

  return (
    <RequireRole allowedRoles={['coach', 'admin']}>
      <VStack gap={6} padding={6}>
        <Heading level={1}>Roster</Heading>

        <TabList value={activeTab} onChange={(value) => setActiveTab(value as RosterTabValue)}>
          {ROSTER_TABS.map((tab) => (
            <Tab key={tab.value} value={tab.value} label={tab.label} />
          ))}
        </TabList>

        <EmptyState
          headingLevel={2}
          title={activeConfig.emptyTitle}
          description={activeConfig.emptyDescription}
        />
      </VStack>
    </RequireRole>
  );
}

export default RosterShell;
