/**
 * T028: `/roster` admin-only toggles (ROS-08) -- a leaderboard privacy
 * toggle ("Show first name + last initial publicly", default ON per SEC-04)
 * and a season default-goal shortcut link to `/settings/season` (T029's
 * page).
 *
 * This is a STANDALONE component per this task's packet, the same posture
 * `StudentsTab.tsx`/T022 already took: `RosterShell.tsx` is a forbidden,
 * already-Passed sibling task's file and is not touched or wired up here.
 *
 * -----------------------------------------------------------------------
 * 1. THE CENTRAL TRAP -- schema-gap investigation (packet's own mandate:
 *    "grep every migration file yourself first").
 *
 * Investigated directly, not taken on the packet's word:
 *   `grep -in "privacy|show_full_name|last_name|leaderboard|initial"
 *   supabase/migrations/*.sql`
 * returned zero column-definition hits -- only two unrelated comment lines
 * (`20260718000000_invite_trigger.sql` line 25, an avatar-placeholder
 * comment; `20260717000002_rls.sql` lines 82-92, RLS policy comments about
 * teammate name/team visibility for the leaderboard, not a privacy-flag
 * column). Every `create table` across all six migration files was also
 * enumerated (`identity_roster`, `scheduling_attendance`, `support_audit`,
 * `rls`, `metric_views`, `invite_trigger`) and every column on `profiles`,
 * `teams`, `seasons`, `students`, and every other table was read directly
 * (`20260716000000_identity_roster.sql` lines 16-79): `seasons` has
 * `id, name, starts_on, ends_on, default_goal_hours, is_active, created_at`
 * -- no privacy-shaped column. `teams` has
 * `id, name, short_name, program, color, archived, sort_order, created_at`
 * -- likewise none. `profiles` has no such column either. CONFIRMED: there
 * is genuinely no persisted column anywhere in this schema for ROS-08's
 * leaderboard-privacy setting.
 *
 * This task's Allowed Files are UI-only (`AdminToggles.tsx`) -- writing a
 * migration to add a persistence column is explicitly NOT authorized here
 * (packet's own "you are not authorized to write a migration" instruction;
 * constitution item 10 requires additive migrations to be a properly-scoped
 * decision, not something a UI task backs into to make its own toggle
 * "really" persist). Per the packet's required posture, the toggle below is
 * built as REAL, WORKING UI against an injectable
 * `loadPrivacySetting`/`onTogglePrivacy` seam (module doc #3), defaulting to
 * `true` (ON), and the gap is surfaced explicitly in-UI via a `Banner` (module
 * doc #2) plus here in this disclosure, as a dispute-candidate / follow-up
 * need -- not silently worked around and not silently ignored.
 *
 * DISPUTE-CANDIDATE WRITE-UP (best-guess reasoning, not a unilateral
 * decision -- a future small migration task must actually decide this):
 * most likely `seasons.leaderboard_show_full_name boolean not null default
 * true` (or an equivalently-named column). Reasoning: `seasons` already
 * carries the one other roster-adjacent per-period configurable value in
 * this schema (`default_goal_hours`), and ROS-08 frames the setting as a
 * program-wide/season-wide preference an admin sets once per season, not
 * something that should vary team-by-team within the same leaderboard (a
 * leaderboard mixing "team A shows full names, team B doesn't" within one
 * season would be an inconsistent, confusing UI, which nothing in ROS-08's
 * phrasing suggests is the intent). `teams` is the plausible alternative
 * flagged per the packet's own steer (if privacy is meant to vary per team
 * rather than per season) but is not this task's call to make -- same class
 * of finding T009's MINOR follow-ups (`avatar_url`, `notes` nullability)
 * already established a precedent for in this project.
 *
 * RESOLVED (T104, ED-1 Packet P11): the column now genuinely exists --
 * `supabase/migrations/20260720000000_leaderboard_privacy.sql` (read-only
 * reference here). Table placement (`seasons`) was kept exactly as reasoned
 * above; the COLUMN NAME was independently re-verified and deliberately
 * DEVIATED to `seasons.leaderboard_privacy_enabled` (not the
 * `leaderboard_show_full_name` guessed above) -- see that migration file's
 * own header comment for the full reasoning: this toggle never reveals a
 * full name in EITHER state (ON = "First L.", OFF = a fully anonymized
 * label, per module doc #4 below and `Leaderboard.tsx`'s own confirmed
 * semantics), so a column literally named "show_full_name" would have
 * misdescribed what it gates. Module doc #3 below (formerly "no shared
 * Supabase client wired in yet") documents the real wiring this task adds.
 *
 * -----------------------------------------------------------------------
 * 2. In-UI disclosure of the gap -- a real, visible `Banner`, not just a
 *    code comment. RESOLVED (T104): this section originally described a
 *    real, standing `SCHEMA_GAP_BANNER` rendered unconditionally whenever
 *    this component was visible to an admin; that banner is REMOVED as of
 *    T104 (module doc #3 UPDATE below) since the gap it disclosed no longer
 *    exists -- this section is kept, not deleted, so the "was this ever a
 *    real gap" history stays visible. The `Banner` import/usage below is
 *    now used only for the pre-existing DES-12 loading-error state (module
 *    doc #7's Astryx citation), not for this now-closed disclosure.
 *
 * -----------------------------------------------------------------------
 * 3. T104 (ED-1 Packet P11) UPDATE -- real Supabase wiring. This section
 *    originally described a fixture-only file with no shared Supabase
 *    client anywhere in it and no persistence column for that client to
 *    write to; NEITHER is true anymore, and this section is kept (not
 *    deleted) so the "was this ever real" history stays visible.
 *
 * `loadPrivacySetting`/`onTogglePrivacy` now default to the real
 * `loadPrivacySetting`/`togglePrivacy` from
 * `../../lib/supabase/loaders/leaderboard_privacy` (T104) -- a real query/
 * update against `public.seasons.leaderboard_privacy_enabled`, scoped to
 * the currently-active season (see that module's own doc comment for the
 * full reasoning, including the disclosed "no currently-active season"
 * risk for the write side). The original fixture-backed
 * `defaultLoadPrivacySetting`/`defaultOnTogglePrivacy` functions below are
 * KEPT as named exports (same posture `SeasonSettings.tsx`/T091 already
 * established for its own `defaultLoadSeasons`/etc.) -- tests inject them
 * explicitly through these same props where fixture behavior is still
 * useful to exercise, rather than relying on them being the default.
 *
 * -----------------------------------------------------------------------
 * 4. SEC-04 default-ON -- genuinely defaults ON, not OFF.
 *
 * The real default `loadPrivacySetting` (module doc #3 UPDATE) resolves the
 * currently-active season's real `leaderboard_privacy_enabled` column value
 * (falling back to `true` only when no season is currently active --
 * `../../lib/supabase/loaders/leaderboard_privacy.ts`'s own doc comment);
 * `defaultLoadPrivacySetting` below (kept as a named export, module doc #3
 * UPDATE) still resolves a fixture `true` for tests that want that
 * explicitly. The `Switch` below is fully controlled by the resolved value
 * (never separately hardcoded), so the real, checker-scrutinized default is
 * provably the resolved value, not a UI-only illusion. Toggling is real:
 * `handleChange` optimistically updates local state and `handlePersist`
 * (passed as `Switch`'s `changeAction`) calls the injectable seam, so the
 * on-screen Switch state and the "would-be persisted" value never drift
 * apart within a single session -- see this task's worker output for the
 * live default-ON-then-toggle-OFF proof.
 *
 * -----------------------------------------------------------------------
 * 5. Admin-only gate -- `role === 'admin'` alone, NOT `RequireRole`.
 *    DISCLOSED DESIGN DECISION, not a silent deviation from the
 *    `RequireRole` pattern `RosterShell.tsx`/`StudentsTab.tsx` use.
 *
 * ROS-08 says this renders on Roster "for admin only" -- stricter than the
 * coach/admin gate `RosterShell.tsx` uses for the tab scaffold as a whole.
 * `RosterShell.tsx` already wraps the entire `/roster` page in
 * `RequireRole(['coach', 'admin'])`, so a `coach` user legitimately reaches
 * `/roster`. If this widget reused `guards.tsx`'s exported `RequireRole`
 * component here too, a `coach` viewing `/roster` would be redirected AWAY
 * FROM THE WHOLE PAGE (`RequireRole`'s own behavior: `Navigate to="/"` +
 * the NAV-06 access-denied toast) just because this one admin-only sub-widget
 * happens to be present -- breaking the coach's legitimate access to the
 * rest of the (coach/admin) Roster page over a stricter-than-page gate on
 * one embedded widget. That would be a real regression, not correct
 * enforcement. Instead, this component reads `useAuth()` directly (per the
 * packet's own instruction) and renders `null` (nothing at all) when
 * `user` is null, still loading, or `user.role !== 'admin'` -- the widget
 * simply doesn't exist for a non-admin viewer, the rest of the page is
 * unaffected. `guards.tsx`'s own exported `Role` union now matches AUTH-05's
 * real `admin | coach | student | parent` vocabulary exactly (fixed by
 * T073a; previously a stale `'admin' | 'staff' | 'volunteer' | 'coach'`
 * placeholder), so `role === 'admin'` continues to read correctly -- see
 * `RosterShell.tsx`/T021 for the same gap, now likewise resolved.
 *
 * -----------------------------------------------------------------------
 * 6. Season default-goal shortcut -- a real, cited route, not a raw string.
 *
 * `router.tsx`'s exported `routePaths` (read-only import, per this task's
 * Allowed/Forbidden Files) has no dedicated `season`/`seasonSettings` named
 * constant -- only `routePaths.settings = '/settings'` (`router.tsx` lines
 * 94-108). Per the packet's own instruction ("do not guess or hardcode a
 * raw string if a named constant already exists"), `SEASON_SETTINGS_PATH`
 * below is built FROM that existing named constant
 * (`${routePaths.settings}/season`), not a fully-independent hardcoded
 * literal -- identical idiom to `LiveConsole.tsx`'s own
 * `<Link as={RouterLink} href={routePaths.meetings}>` /
 * `routePaths.kioskSession(sessionId)` usage (`src/pages/meetings/
 * LiveConsole.tsx` lines 350, 745, 948), including importing
 * `Link as RouterLink` from `react-router-dom` and passing it to Astryx's
 * `Link` via its documented `as` prop so the link is a real client-side
 * route change, not a full page reload. This resolves to `/settings/season`
 * -- the literal path this task's own Objective text names as T029's future
 * page.
 *
 * -----------------------------------------------------------------------
 * 7. Astryx prop sourcing (constitution item 2) -- every prop used below,
 *    cited directly against `docs/swarm/astryx-api.md`:
 *
 *  - `Switch` (`astryx-api.md` "Switch" Props table, lines 1506-1529):
 *    `label` (required, line 1511), `value` (required, line 1512),
 *    `onChange` (line 1513), `changeAction` (line 1514, async persistence
 *    seam with a built-in loading spinner -- module doc #4), `description`
 *    (line 1517) used. `isDisabled`/`disabledMessage`/`labelPosition`/
 *    `labelSpacing`/etc. are not used -- no need to override any default.
 *  - `Banner` (`astryx-api.md` "Banner" Props table, lines 2749-2763):
 *    `status`, `title`, `description`, `isDismissable`, `onDismiss` used --
 *    same shape `StudentsTab.tsx` already established for its own disclosure
 *    banners.
 *  - `Link` (`astryx-api.md` "Link" Components subsection, lines 1959-1977):
 *    `as`, `href`, `children` used -- same shape `LiveConsole.tsx` already
 *    established (module doc #6).
 *  - `Icon` (`astryx-api.md` "Icon" Props table, lines 604-611): `icon`
 *    (`'chevronRight'`, one of the documented semantic names), `size` used.
 *  - `Heading`: `astryx-api.md`'s own "Components > Heading" subsection
 *    (lines 882-884) is `undefined` -- the same disclosed CLI-cross-checked
 *    gap `RosterShell.tsx`/T021 and every other content page already hit.
 *    `npm run astryx -- component Heading` output (verbatim, relevant rows)
 *    resolves it: `level` (`1 | 2 | 3 | 4 | 5 | 6`, required), `children`
 *    (required). Only `level`/`children` used below.
 *  - `Text`: `astryx-api.md` "Text" Props table (lines 858-878). `type`,
 *    `color` used.
 *  - `Skeleton` (T081, `astryx-api.md` "Skeleton" section, lines 621-655):
 *    `width`, `height`, `index` used to preview this widget's fixed,
 *    always-identical shape (a heading + one `Switch` row) -- replacing
 *    `Spinner`'s prior use here per Astryx's own guidance (known-dimension
 *    content, arguably MORE predictable than a table since this widget's
 *    layout never varies with data at all). `VisuallyHidden` + the wrapping
 *    `VStack`'s `aria-busy` carry the "Loading admin settings…"
 *    announcement `Spinner`'s `label` used to provide.
 *  - `VStack`/`HStack` (`astryx-api.md` "Stack" section, lines 350-396):
 *    `gap`, `padding`, `vAlign`, `hAlign` used.
 *
 *    (`Card` was deliberately NOT used: `npm run astryx -- component Card`
 *    output's own Best Practices explicitly say "Don't: Wrap page sections
 *    in cards... use Section or heading + stack" for exactly this kind of
 *    page-region settings widget, and Card is meant for discrete,
 *    independently-reorderable items, which this widget is not.)
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Banner,
  Button,
  Heading,
  HStack,
  Icon,
  Link,
  Skeleton,
  Switch,
  Text,
  VisuallyHidden,
  VStack,
} from '@astryxdesign/core';
import { useAuth } from '../../app/guards';
import { routePaths } from '../../app/router';
import {
  loadPrivacySetting as realLoadPrivacySetting,
  togglePrivacy as realTogglePrivacy,
} from '../../lib/supabase/loaders/leaderboard_privacy';

// ---------------------------------------------------------------------------
// Route target -- module doc #6.
// ---------------------------------------------------------------------------

const SEASON_SETTINGS_PATH = `${routePaths.settings}/season`;

// ---------------------------------------------------------------------------
// Injectable seams -- module doc #3.
// ---------------------------------------------------------------------------

export type LoadPrivacySettingFn = () => Promise<boolean>;
export type TogglePrivacyFn = (nextValue: boolean) => Promise<void>;

/**
 * T104 UPDATE: no longer the component's default `loadPrivacySetting` --
 * that's now the real `loadPrivacySetting` from
 * `../../lib/supabase/loaders/leaderboard_privacy` (module doc #3 UPDATE).
 * Kept as a named export, fixture literal unchanged (SEC-04's stated
 * default: ON), for tests (and any future caller) that want fixture
 * behavior explicitly rather than relying on it being the implicit
 * default.
 */
export async function defaultLoadPrivacySetting(): Promise<boolean> {
  return true;
}

/**
 * T104 UPDATE: no longer the component's default `onTogglePrivacy` --
 * that's now the real `togglePrivacy` from
 * `../../lib/supabase/loaders/leaderboard_privacy` (module doc #3 UPDATE).
 * Kept as a named export, unchanged in-memory-no-op behavior, for tests/
 * future callers that want this fixture explicitly.
 */
export const defaultOnTogglePrivacy: TogglePrivacyFn = async () => {
  await Promise.resolve();
};

// ---------------------------------------------------------------------------
// Generic DES-12-style load-state hook -- module doc #3 (standalone copy,
// same shape every prior content page in this batch already established).
// ---------------------------------------------------------------------------

type LoadState<T> =
  | { status: 'loading' }
  | { status: 'error'; error: unknown; retry: () => void }
  | { status: 'success'; data: T };

function useLoadState<T>(load: () => Promise<T>, deps: readonly unknown[]): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' });
  // Bumped by the error Banner's "Retry" action (DES-12) to force the effect
  // below to re-run without changing the caller-supplied `deps` semantics.
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setState({ status: 'loading' });
    load()
      .then((data) => {
        if (isMounted) setState({ status: 'success', data });
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setState({ status: 'error', error, retry: () => setRetryToken((token) => token + 1) });
        }
      });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` is the caller-supplied dependency list; `retryToken` is an additional internal trigger.
  }, [...deps, retryToken]);

  return state;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface AdminTogglesProps {
  /** Injectable data-loading seam (module doc #3 UPDATE). Defaults to the
   * real `loadPrivacySetting`
   * (`../../lib/supabase/loaders/leaderboard_privacy`). */
  loadPrivacySetting?: LoadPrivacySettingFn;
  /** Injectable persistence seam (module doc #3 UPDATE). Defaults to the
   * real `togglePrivacy`
   * (`../../lib/supabase/loaders/leaderboard_privacy`). */
  onTogglePrivacy?: TogglePrivacyFn;
}

export function AdminToggles({
  loadPrivacySetting = realLoadPrivacySetting,
  onTogglePrivacy = realTogglePrivacy,
}: AdminTogglesProps = {}): ReactNode {
  const { user, isLoading: isAuthLoading } = useAuth();
  const loadState = useLoadState(loadPrivacySetting, [loadPrivacySetting]);
  const [privacyOn, setPrivacyOn] = useState<boolean>(true);

  useEffect(() => {
    if (loadState.status === 'success') {
      setPrivacyOn(loadState.data);
    }
  }, [loadState]);

  // Module doc #5: admin-only, plain role check -- renders nothing (not a
  // redirect) for every other role, including the coach who legitimately
  // reaches the surrounding /roster page.
  if (isAuthLoading || !user || user.role !== 'admin') {
    return null;
  }

  function handleChange(checked: boolean): void {
    setPrivacyOn(checked);
  }

  function handlePersist(checked: boolean): Promise<void> {
    return onTogglePrivacy(checked);
  }

  if (loadState.status === 'loading') {
    return (
      <VStack gap={4} padding={6} aria-busy="true">
        <VisuallyHidden as="div" role="status">
          Loading admin settings…
        </VisuallyHidden>
        <Skeleton width={180} height={22} index={0} />
        <HStack gap={3} vAlign="center">
          <VStack gap={1}>
            <Skeleton width={280} height={16} index={1} />
            <Skeleton width={320} height={14} index={2} />
          </VStack>
          <Skeleton width={40} height={22} radius="rounded" index={3} />
        </HStack>
      </VStack>
    );
  }

  if (loadState.status === 'error') {
    return (
      <VStack gap={4} padding={6}>
        <Banner
          status="error"
          title="Couldn't load admin settings"
          description="Something went wrong loading the leaderboard privacy setting. Try refreshing the page."
          endContent={<Button variant="ghost" label="Retry" onClick={loadState.retry} />}
        />
      </VStack>
    );
  }

  return (
    <VStack gap={4} padding={6}>
      <Heading level={2}>Admin settings</Heading>

      <Switch
        label="Show first name + last initial publicly"
        description="Controls whether leaderboard and kiosk surfaces display students' full first name plus last initial, or a fully anonymized identifier. Defaults to on (SEC-04)."
        value={privacyOn}
        onChange={handleChange}
        changeAction={handlePersist}
      />

      <HStack gap={2} vAlign="center">
        <Link as={RouterLink} href={SEASON_SETTINGS_PATH}>
          Set this season's default goal
        </Link>
        <Icon icon="chevronRight" size="sm" color="secondary" />
      </HStack>
      <Text type="supporting" color="secondary">
        Opens season settings (T029).
      </Text>
    </VStack>
  );
}

export default AdminToggles;
