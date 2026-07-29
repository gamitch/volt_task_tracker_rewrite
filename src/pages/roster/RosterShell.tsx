/**
 * T021 (original shell scaffold) + T085 (this task, corrective wiring):
 * `/roster` shell (ROS-01) -- a `TabList` with four tabs, in the PRD-literal
 * order Students | Parents | Teams | Invites, restricted to `coach`/`admin`.
 *
 * T085 UPDATE (read this first -- supersedes the "placeholder shell" framing
 * this file's module doc originally had): every tab below now renders its
 * real, already-Passed content component (`StudentsTab`/T022,
 * `ParentsTab`/T025, `TeamsTab`/T026, `InvitesTab`/T027), and `AdminToggles`
 * (T028, ROS-08) is now rendered on this page too. T021 originally shipped
 * this file with four hardcoded placeholder `EmptyState`s naming "T022-T028"
 * as future work, and each of T022/T025/T026/T027/T028 was independently
 * built and checker-Passed as a STANDALONE component afterward, deliberately
 * never touching this file (each of those tasks' own Allowed Files forbade
 * editing `RosterShell.tsx`, to keep each tab task narrowly scoped -- see
 * e.g. `StudentsTab.tsx`'s own module doc, "This is a STANDALONE component
 * per this task's packet -- it is not wired into `RosterShell.tsx`"). Nobody
 * was ever dispatched to come back and do the actual wiring, so this page
 * silently kept showing "not built yet" placeholder text for every tab in
 * the real running app, months after the real tabs had shipped -- discovered
 * via live manual testing of the deployed app, not by any prior isolated-
 * component check (T085's own packet). This task fixes exactly that: swaps
 * each placeholder panel for the real component, matching each real
 * component's own already-established prop shape exactly (no invented
 * props), and does nothing else -- no `RequireRole`/keyboard-nav/tab-scaffold
 * changes, no real Supabase `loadData` wiring (every tab below keeps using
 * its own fixture-backed default, the same scope boundary `ReportsShell.tsx`
 * already established for its own real-content tab).
 *
 * -----------------------------------------------------------------------
 * 1. Role guard mechanism (unchanged from T021 -- reproduced here for
 *    context, not re-derived).
 *
 * `router.tsx` is a forbidden (read-only) file for this task (and was for
 * T021), and its `/roster` route wraps this component in `RequireAuth` only
 * -- no role restriction of its own, so this component enforces its own role
 * restriction internally by nesting `guards.tsx`'s exported `RequireRole`
 * directly in this component's render tree instead of at the
 * `<Route element={...}>` level. `RequireRole` reads `useAuth()` and renders
 * `AccessDeniedPage` in place (T076's corrected behavior -- no longer a
 * `Navigate to="/"` redirect, the way T021's original module doc described
 * it; that behavior changed after this file was first written, and is noted
 * here only so this comment does not itself go stale the way the placeholder
 * copy did) whenever `!user || !allowedRoles.includes(user.role)`.
 *
 * -----------------------------------------------------------------------
 * 2. `AdminToggles` placement -- T085 Known Context/Traps #2, a disclosed
 *    judgment call, not a silent choice.
 *
 * PRD line 340 says only "rendered on Roster for admin only" -- it does not
 * name a specific tab, and ROS-08's own settings (a leaderboard-privacy
 * toggle + a season default-goal shortcut) are not conceptually part of
 * Students/Parents/Teams/Invites roster DATA the way each of those four tabs
 * is. `AdminToggles` is rendered once below, between the `TabList` and the
 * active tab's panel -- visible regardless of which tab is selected, never
 * nested inside one specific tab's conditional render. Reasoning: (a) it is
 * genuinely page-wide settings content, not data belonging to any one tab,
 * so nesting it inside e.g. the Students panel would make it disappear the
 * moment an admin clicks over to Parents/Teams/Invites, for no reason tied
 * to what the widget actually controls; (b) placing it below the `TabList`
 * (rather than above, between the page `Heading` and the tabs) keeps the
 * `TabList` as the very first thing under the page title -- the primary
 * navigation for this page -- uninitialized reading order, rather than
 * inserting an admin-only settings block between the heading and the tab
 * strip a coach also uses. `AdminToggles` itself already self-gates on
 * `user.role === 'admin'` (its own module doc #5, deliberately NOT
 * `RequireRole`, specifically so a coach viewing this already-coach/admin
 * page is not redirected away just because this one stricter-than-page
 * sub-widget is present) and renders `null` for a non-admin, so no
 * additional gating is added here -- rendering it unconditionally in the JSX
 * below is the same "render everywhere, let the component itself decide" the
 * component's own module doc already documents and the widget's own test
 * suite already proves (`AdminToggles.test.tsx`'s "admin-only gate" describe
 * block).
 *
 * -----------------------------------------------------------------------
 * 3. `router.tsx` wiring -- CONFIRMED, unlike T021's original disclosed gap.
 *
 * T021's own module doc originally flagged `RosterShell` as unreachable at
 * `/roster` because `router.tsx` (forbidden here) allegedly still rendered
 * an inline placeholder. Re-checked directly against the current
 * `router.tsx` (read-only reference, not edited by this task): it already
 * imports and renders the real `RosterShell` at `/roster`, rendered inside
 * that route's `RequireAuth`. That gap was closed by a prior task,
 * independently of this one -- this file's wiring to the real tab content
 * (this task's own job) is the only remaining gap T085 exists to close.
 *
 * T139 UPDATE: the specific import quoted above by the original T085 doc
 * (`import { RosterShell } from '../pages/roster/RosterShell';`) no longer
 * exists -- T093 (a bundle-size fix, `d43fb3a`) made `router.tsx`'s own
 * import of this file lazy too; `router.tsx:130` is now
 * `const RosterShell = lazy(() => import('../pages/roster/RosterShell'));`.
 * The substance of this doc item (that `router.tsx` really does render this
 * component at `/roster`) is still true; only the quoted static-import
 * literal is stale, so it is removed rather than left to assert code that no
 * longer exists.
 *
 * -----------------------------------------------------------------------
 * 4. Astryx prop sourcing (constitution item 2) -- unchanged from T021 for
 *    every prop still used below; `EmptyState` is no longer imported or
 *    rendered anywhere in this file (every tab panel now renders a real
 *    component instead of a placeholder), so its citation is removed rather
 *    than left describing a prop this file no longer uses:
 *
 *  - `TabList`/`Tab`/`Heading`/`VStack`: same citations T021 already
 *    established (`docs/swarm/astryx-api.md` "TabList"/"Stack" Props
 *    tables; `Tab`/`Heading`'s own subsections are `undefined` doc-
 *    generation gaps, resolved via `npm run astryx -- component <Name>`,
 *    same disclosed CLI-cross-check pattern every content page in this
 *    project uses).
 *
 * -----------------------------------------------------------------------
 * 5. No new DES-12 state reasoning needed in this file. T021's original
 *    module doc explained why this shell rendered only the "empty" DES-12
 *    bucket (no tab did any real data fetching yet). That reasoning is now
 *    obsolete -- every tab rendered below performs its own real
 *    loading/error/empty/populated DES-12 handling internally (see each
 *    tab's own module doc), so this shell itself has nothing left to model:
 *    it only decides WHICH tab's already-self-contained component to render,
 *    the same "dumb router, smart children" shape `ReportsShell.tsx` already
 *    established for `ParticipationTab`.
 *
 * -----------------------------------------------------------------------
 * 6. `AdminToggles` is imported via `React.lazy`, not a static import --
 *    a circular-import bug that was real at T085 time, found and fixed while
 *    wiring that task, not a stylistic choice. See the T139 UPDATE at the end
 *    of this section: the specific failure no longer reproduces.
 *
 * `AdminToggles.tsx` (forbidden/read-only here) imports `routePaths` from
 * `../../app/router` for its own season-settings-shortcut link (its own
 * module doc #6). `router.tsx` (also forbidden/read-only here) imports THIS
 * file (`RosterShell`) to render at `/roster`, ABOVE the line that defines
 * `export const routePaths = {...}` in that same file. Before this task,
 * `RosterShell.tsx` never imported `AdminToggles.tsx`, so that fact never
 * mattered. A plain `import { AdminToggles } from './AdminToggles';` here
 * closes a real three-file cycle for the first time: `router.tsx` ->
 * `RosterShell.tsx` -> `AdminToggles.tsx` -> `router.tsx`. Verified live,
 * not just reasoned about: with a static import, `npm run test` failed five
 * unrelated suites that happen to import `App`/`router.tsx` before
 * `RosterShell.tsx` gets a chance to (e.g. `theme.smoke.test.tsx`) with
 * `TypeError: Cannot read properties of undefined (reading 'settings')` at
 * `AdminToggles.tsx`'s `routePaths.settings` line -- `router.tsx`'s own
 * module evaluation was still paused partway through its OWN import list
 * (the one that pulls in this file) when `AdminToggles.tsx` tried to read
 * `routePaths` off of it, so that binding was not yet initialized. This is
 * the exact same class of import-cycle risk `AccessDeniedPage.tsx`'s own
 * module doc already discloses avoiding for its own `router.tsx` link
 * (`"importing router.tsx back from here would create a real import cycle
 * through guards.tsx ... A hardcoded literal ... avoids introducing that
 * cycle"`) -- but `AdminToggles.tsx` is a forbidden file here, so its own
 * already-established `routePaths` import cannot be changed to match that
 * precedent. `React.lazy(() => import('./AdminToggles'))` fixes it instead,
 * entirely from this (allowed) file's side: a dynamic `import()` is not
 * evaluated synchronously as part of `RosterShell.tsx`'s own module-load
 * pass -- it only runs once this component actually renders, by which point
 * `router.tsx`'s own top-level module evaluation (including defining
 * `routePaths`) has already fully completed. Verified live at T085 time:
 * with this change, the same five previously-failing suites (plus this
 * task's own new `RosterShell.test.tsx`) all passed.
 *
 * T139 UPDATE: the cycle described above was real and verified AT T085 TIME,
 * but is no longer live today, and this doc previously presented it as a
 * current-day fact rather than history. T093 (a bundle-size fix, `d43fb3a`)
 * later made `router.tsx`'s own import of `RosterShell` lazy as well
 * (`router.tsx:130`, `const RosterShell = lazy(() => import('../pages/
 * roster/RosterShell'));`), which independently breaks the `router.tsx ->
 * RosterShell.tsx` edge of the three-file cycle above -- `router.tsx` no
 * longer evaluates this module synchronously at all. T139's own premise gate
 * verified this empirically, in an isolated worktree at that task's packet
 * SHA: reverting `AdminToggles` to a static value import here produced
 * *zero* failures (full suite green, clean `vite build`), where the same
 * change previously failed five suites at T085 time. `AdminToggles` is
 * still imported via `lazy()` regardless -- not because reverting it is
 * known to break something today, but because doing so is scope no task has
 * requested, against a documented failure history, for zero present
 * benefit.
 */
import { lazy, Suspense, useState, type ReactNode } from 'react';
import { Heading, Tab, TabList, VStack } from '@astryxdesign/core';
import { RequireRole } from '../../app/guards';
import { InvitesTab, type InvitesTabProps } from './InvitesTab';
import { ParentsTab, type ParentsTabProps } from './ParentsTab';
import { StudentsTab, type StudentsTabProps } from './StudentsTab';
import { TeamsTab, type TeamsTabProps } from './TeamsTab';
// T139: `import type` only -- erased at compile time, creates no runtime
// import edge, so it cannot affect module doc #6's `router.tsx` cycle either
// way. See module doc #6 for why the `AdminToggles` component itself still
// comes in via `lazy()` rather than a static value import.
import type { AdminTogglesProps } from './AdminToggles';

/** Module doc #6 -- lazy, not static, to break a real router.tsx import cycle. */
const AdminToggles = lazy(() => import('./AdminToggles'));

type RosterTabValue = 'students' | 'parents' | 'teams' | 'invites';

interface RosterTabConfig {
  value: RosterTabValue;
  label: string;
}

/** ROS-01's literal tab order: Students | Parents | Teams | Invites. */
const ROSTER_TABS: readonly RosterTabConfig[] = [
  { value: 'students', label: 'Students' },
  { value: 'parents', label: 'Parents' },
  { value: 'teams', label: 'Teams' },
  { value: 'invites', label: 'Invites' },
];

/**
 * T139 (D-2/D006): optional pass-through props, one per child, each typed as
 * that child's own already-exported props interface (imported, not
 * redeclared). Every prop is optional and every child already defaults each
 * of its own props individually (`ParentsTab.tsx:1223` is the precedent this
 * mirrors one level up), so `<RosterShell />` with no props -- `router.tsx`'s
 * only call site, a forbidden file for this task -- keeps rendering exactly
 * the real default loaders it always has.
 */
export interface RosterShellProps {
  studentsTabProps?: StudentsTabProps;
  parentsTabProps?: ParentsTabProps;
  teamsTabProps?: TeamsTabProps;
  invitesTabProps?: InvitesTabProps;
  adminTogglesProps?: AdminTogglesProps;
}

export function RosterShell({
  studentsTabProps,
  parentsTabProps,
  teamsTabProps,
  invitesTabProps,
  adminTogglesProps,
}: RosterShellProps = {}): ReactNode {
  const [activeTab, setActiveTab] = useState<RosterTabValue>(ROSTER_TABS[0].value);

  return (
    <RequireRole allowedRoles={['coach', 'admin']}>
      <VStack gap={6} padding={6}>
        <Heading level={1}>Roster</Heading>

        <TabList value={activeTab} onChange={(value) => setActiveTab(value as RosterTabValue)}>
          {ROSTER_TABS.map((tab) => (
            <Tab key={tab.value} value={tab.value} label={tab.label} />
          ))}
        </TabList>

        {/* Module doc #2: page-wide admin settings, visible regardless of
            the active tab -- self-gates internally, renders null for a
            non-admin viewer. Module doc #6: lazy-loaded to avoid a real
            router.tsx import cycle -- `fallback={null}` is safe because
            `AdminToggles` itself resolves to nothing/null for non-admins
            and to real, fast, synchronous-feeling content for admins (no
            network call in its own lazy chunk beyond the module code
            already bundled for this page). */}
        <Suspense fallback={null}>
          <AdminToggles {...adminTogglesProps} />
        </Suspense>

        {activeTab === 'students' && <StudentsTab {...studentsTabProps} />}
        {activeTab === 'parents' && <ParentsTab {...parentsTabProps} />}
        {activeTab === 'teams' && <TeamsTab {...teamsTabProps} />}
        {activeTab === 'invites' && <InvitesTab {...invitesTabProps} />}
      </VStack>
    </RequireRole>
  );
}

export default RosterShell;
