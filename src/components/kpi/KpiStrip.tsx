/**
 * T123: PRD v2 UXD-01 ("Persistent KPI header") / UXP-05 ("Persistent KPI
 * strip") -- the ONE shared component every coach/admin page renders,
 * mounted once at `AppShell.tsx`'s own content-region level (this file's
 * own worker packet's Allowed Files -- `TopNav.tsx`/`SideNav.tsx` are
 * explicitly forbidden: "the strip is layout content, not nav chrome").
 * Reference figure (binding, per PRD v2 Sec.1's own directive): the
 * "Coach dashboard" KPI-card row in
 * `docs/swarm/current-app-capability-map.html` -- four cards, season
 * hours+category breakdown / active students+per-team split / events
 * logged+most recent title / % toward season goal+"confirmed / target h"
 * line.
 *
 * -----------------------------------------------------------------------
 * 1. Staff-only gating (trap #2). `useAuth().user?.role` is checked BEFORE
 *    any other render branch -- a `student`/`parent` session (or a session
 *    still resolving, `user === null`) renders nothing at all, matching
 *    `TopNav.tsx`'s own `isSeasonSelectorVisible` precedent
 *    (`user?.role === 'admin' || user?.role === 'coach'`, same two-role
 *    check, same source). Both `useAuth()` and `useActiveSeason()` are
 *    called unconditionally at the TOP of `KpiStrip`, before any
 *    conditional return -- Rules of Hooks are satisfied (every hook this
 *    component itself calls runs on every render, in the same order); the
 *    non-staff early return happens strictly AFTER both hook calls, not
 *    interleaved with them.
 *
 * 2. Chromeless/mount-point placement (trap #2). This component does NOT
 *    decide chromeless-route visibility itself -- `AppShell.tsx` only
 *    mounts `<KpiStrip />` inside its normal (`AstryxAppShell`-wrapped)
 *    branch, never on the `/login`/`/accept-invite` early-return branch
 *    (`AppShell.tsx`'s own module doc, unchanged by this task -- T115's
 *    verified chromeless-branch/`SeasonProvider`-mounting structure is left
 *    fully intact, only one new sibling element is added inside the
 *    existing normal branch). `KpiStrip` is therefore never even RENDERED
 *    on those two routes, regardless of role -- no redundant
 *    route-path check is duplicated here.
 *
 * 3. `useActiveSeason()` DES-12 states, scaled for a persistent strip (same
 *    "all four states, honestly, scaled to fit this slot" posture
 *    `TopNav.tsx`'s own `ActiveSeasonDisplay` and `ReportsShell.tsx`'s own
 *    `ReportsSeasonState` already established for this exact hook):
 *      - `'loading'`: `KpiStripSkeleton` -- four `Card`+`Skeleton` tiles,
 *        never a blank band (UXD-01's own explicit requirement).
 *      - `'none'`: a single compact `Banner status="info"` -- NOT a
 *        full-page `EmptyState` (`ReportsSeasonState`'s own choice for a
 *        whole-page section) -- because this strip sits ABOVE real page
 *        content on every route it renders on; UXD-05(b)'s own "compact
 *        when other content on the page has data" rule applies directly
 *        (the routed page below always has its own content/empty-state,
 *        so this slot should not also claim a large area).
 *      - `'error'`: `Banner status="error"` + a `Retry` button wired to
 *        `useActiveSeason().refresh()` (the season-level retry, distinct
 *        from `KpiStripContent`'s own inner KPI-fetch retry below).
 *      - `'ready'`: hands off to `KpiStripContent`, which owns its OWN
 *        second load state (the real `v_season_kpis`/
 *        `v_season_kpi_team_counts` fetch, `../../lib/supabase/
 *        loaders/kpi.ts`) -- two independent, honestly-modeled load
 *        states stacked (season resolution, then KPI data for that
 *        season), never conflated into one.
 *
 * 4. "One fetch per page load, not a refetch storm" (trap #3).
 *    `AppShell.tsx` mounts `<KpiStrip />` as a sibling of `{children}`
 *    INSIDE the persistent `AstryxAppShell` frame -- client-side route
 *    navigation (`react-router-dom`) swaps only `{children}`
 *    (`AppRoutes`'s own `<Routes>`/`<Route>` subtree) without unmounting
 *    `AppShell` itself, so `KpiStrip` (and the `useKpiStripData` effect
 *    inside `KpiStripContent` below) is NOT remounted on every route
 *    change -- its fetch effect's own dependency array (`[seasonId,
 *    loadKpiStripData, retryToken]`) only re-runs when the RESOLVED active
 *    season id itself changes (or a user-triggered retry), never once per
 *    routed page visited. No extra cache/store is needed to satisfy this
 *    requirement -- the persistent mount point itself is the caching
 *    mechanism.
 *
 * 5. Astryx prop sourcing (constitution item 2), every prop below grepped
 *    against `docs/swarm/astryx-api.md` for this task:
 *      - `Section` ("Section" Props table): `padding`, `dividers`,
 *        `variant` NOT used (default), `children` used. `padding={3}` (a
 *        real spacing-scale step) and `dividers={['bottom']}` are the
 *        UXD-05 "compact, must not crowd the page" choice -- a thin
 *        divided band, not a full `padding={4}`/bordered `Card`-wrapped
 *        page section.
 *      - `Grid` ("Grid" Props table): `columns` (the `{minWidth, repeat,
 *        max}` responsive-object form, `max: 4` capping the row at exactly
 *        the reference figure's four-card width so it never grows a FIFTH
 *        column even on an ultra-wide monitor), `gap` used.
 *      - `Card` ("Card" Props table): `children` only (default `padding`,
 *        default `variant`) -- same "one metric per Card" pattern
 *        `CoachHome.tsx`'s own `KpiCard` already established (not
 *        imported from that forbidden file -- mirrored locally, same
 *        `Card > VStack > Heading(label) > Heading(value) > Text(secondary)`
 *        shape).
 *      - `VStack`/`HStack` ("Stack" Props table): `gap`, `vAlign` used.
 *      - `Heading`: `level` used (levels 4/2, same as `CoachHome.tsx`'s
 *        own `KpiCard`).
 *      - `Text` ("Text" Props table): `type="supporting"`, `color`,
 *        `maxLines` used.
 *      - `Skeleton` ("Skeleton" Props table): `width`, `height`, `index`
 *        used (staggered wave, matching `CoachHome.tsx`'s own loading
 *        skeleton's `index` usage).
 *      - `Banner` ("Banner" Props table): `status`, `title`,
 *        `description`, `endContent` used.
 *      - `Button` ("Button" Props table): `variant="ghost"`, `label`,
 *        `onClick` used.
 *      - `VisuallyHidden` ("VisuallyHidden" Props table): `as`,
 *        `role="status"`, `children` used, same
 *        `TopNav.tsx`/`ReportsShell.tsx` loading-announcement pattern.
 *
 * 6. UXD-09 (density with accessibility) -- the loading skeleton carries
 *    `aria-busy="true"` plus a `VisuallyHidden role="status"`
 *    announcement (same pattern as every other `useActiveSeason()`
 *    consumer in this codebase); `Banner` supplies its own accessible
 *    status-icon semantics per its own Astryx implementation. Both light
 *    and dark themes are exercised purely through Astryx theme tokens (no
 *    hardcoded color anywhere in this file, grep-provable) -- same "no
 *    custom CSS" discipline every other component in this codebase
 *    follows.
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  Banner,
  Button,
  Card,
  Grid,
  Heading,
  Section,
  Skeleton,
  Text,
  VisuallyHidden,
  VStack,
} from '@astryxdesign/core';
import { useAuth } from '../../app/guards';
import { useActiveSeason } from '../../app/SeasonProvider';
import { isSupabaseLoaderError, type SupabaseLoaderError } from '../../lib/supabase/loader';
import {
  loadKpiStripData as defaultLoadKpiStripData,
  type KpiStripData,
  type KpiTeamBreakdownRow,
  type LoadKpiStripDataFn,
} from '../../lib/supabase/loaders/kpi';

export interface KpiStripProps {
  /** Injectable seam (same convention `SeasonProvider`'s own
   * `loadActiveSeason` prop and every `loadData`/`getClient` prop in this
   * codebase already establish). Defaults to the real loader. */
  loadKpiStripData?: LoadKpiStripDataFn;
}

export function KpiStrip({ loadKpiStripData = defaultLoadKpiStripData }: KpiStripProps): ReactNode {
  const { user } = useAuth();
  const activeSeason = useActiveSeason();

  // Module doc #1: staff-only. `user === null` (no session yet / non-staff
  // role) renders nothing -- both hooks above have already run.
  const isStaff = user?.role === 'admin' || user?.role === 'coach';
  if (!isStaff) {
    return null;
  }

  switch (activeSeason.status) {
    case 'loading':
      return <KpiStripSkeleton />;
    case 'none':
      return (
        <Section padding={3} dividers={['bottom']}>
          <Banner
            status="info"
            title="No active season yet"
            description="An admin needs to create and activate a season in Season settings before season KPIs can show here."
          />
        </Section>
      );
    case 'error':
      return (
        <Section padding={3} dividers={['bottom']}>
          <Banner
            status="error"
            title="Couldn't load the active season"
            description={activeSeason.error.message}
            endContent={<Button variant="ghost" label="Retry" onClick={activeSeason.refresh} />}
          />
        </Section>
      );
    case 'ready':
      return (
        <KpiStripContent seasonId={activeSeason.season.id} loadKpiStripData={loadKpiStripData} />
      );
  }
}

// ---------------------------------------------------------------------------
// KPI data load state -- module doc #3/#4.
// ---------------------------------------------------------------------------

type KpiLoadState =
  | { status: 'loading' }
  | { status: 'error'; error: SupabaseLoaderError; retry: () => void }
  | { status: 'success'; data: KpiStripData };

/**
 * Same shape/behavior as `SeasonProvider.tsx`'s own `toDisplayError` (the
 * closest sibling load-state hook in this codebase): a real
 * `SupabaseLoaderError` passes through unchanged (the expected case --
 * `loadKpiStripData` is built via `createLoader`, `../../lib/supabase/
 * loader.ts`, which only ever rejects with one of those); a plain `Error`
 * (a caller-injected `loadKpiStripData` in a test, say) keeps its own real
 * `.message`; anything else falls back to fixed DES-16 copy. This fallback
 * branch only exists for a non-conforming injected loader -- production
 * code never reaches it.
 */
function toDisplayError(raw: unknown): SupabaseLoaderError {
  if (isSupabaseLoaderError(raw)) {
    return raw;
  }
  return {
    code: 'UNKNOWN',
    message: raw instanceof Error ? raw.message : "Couldn't load season KPIs. Try again.",
    cause: raw,
  };
}

function useKpiStripData(seasonId: string, loadKpiStripData: LoadKpiStripDataFn): KpiLoadState {
  const [state, setState] = useState<KpiLoadState>({ status: 'loading' });
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setState({ status: 'loading' });
    loadKpiStripData(seasonId)
      .then((data) => {
        if (isMounted) {
          setState({ status: 'success', data });
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setState({
            status: 'error',
            error: toDisplayError(error),
            retry: () => setRetryToken((token) => token + 1),
          });
        }
      });
    return () => {
      isMounted = false;
    };
    // Module doc #4: this effect intentionally depends only on `seasonId`
    // (plus the injected loader and the retry token) -- NOT on route
    // location -- so it never re-fires on a plain page navigation.
  }, [seasonId, loadKpiStripData, retryToken]);

  return state;
}

function KpiStripContent({
  seasonId,
  loadKpiStripData,
}: {
  seasonId: string;
  loadKpiStripData: LoadKpiStripDataFn;
}): ReactNode {
  const state = useKpiStripData(seasonId, loadKpiStripData);

  if (state.status === 'loading') {
    return <KpiStripSkeleton />;
  }

  if (state.status === 'error') {
    return (
      <Section padding={3} dividers={['bottom']}>
        <Banner
          status="error"
          title="Couldn't load season KPIs"
          description={state.error.message}
          endContent={<Button variant="ghost" label="Retry" onClick={state.retry} />}
        />
      </Section>
    );
  }

  const { data } = state;
  return (
    <Section padding={3} dividers={['bottom']}>
      <Grid columns={{ minWidth: 200, repeat: 'fit', max: 4 }} gap={3}>
        <KpiTile
          label="Season hours"
          value={data.totalHours.toFixed(1)}
          secondary={formatHoursBreakdown(data)}
        />
        <KpiTile
          label="Active students"
          value={String(data.activeStudentsCount)}
          secondary={formatTeamBreakdown(data.teamBreakdown)}
        />
        <KpiTile
          label="Events logged"
          value={String(data.eventsLoggedCount)}
          secondary={formatMostRecentEvent(data.mostRecentEventTitle, data.mostRecentEventDate)}
        />
        <KpiTile
          label="% toward season goal"
          value={`${data.goalPct}%`}
          secondary={formatGoalTarget(data)}
        />
      </Grid>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Tile + skeleton -- module doc #5.
// ---------------------------------------------------------------------------

function KpiTile({
  label,
  value,
  secondary,
}: {
  label: string;
  value: string;
  secondary: string;
}): ReactNode {
  return (
    <Card>
      <VStack gap={1}>
        <Heading level={4}>{label}</Heading>
        <Heading level={2}>{value}</Heading>
        <Text type="supporting" color="secondary" maxLines={2}>
          {secondary}
        </Text>
      </VStack>
    </Card>
  );
}

function KpiStripSkeleton(): ReactNode {
  return (
    <Section padding={3} dividers={['bottom']} aria-busy="true">
      <VisuallyHidden as="div" role="status">
        Loading season KPIs…
      </VisuallyHidden>
      <Grid columns={{ minWidth: 200, repeat: 'fit', max: 4 }} gap={3}>
        {[0, 1, 2, 3].map((tileIndex) => (
          <Card key={tileIndex}>
            <VStack gap={1}>
              <Skeleton width={120} height={14} index={tileIndex * 3} />
              <Skeleton width={72} height={26} index={tileIndex * 3 + 1} />
              <Skeleton width={150} height={14} index={tileIndex * 3 + 2} />
            </VStack>
          </Card>
        ))}
      </Grid>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Display formatting -- presentation only (constitution item 3: no metric
// arithmetic below, only string composition of already-final SQL numbers).
// No box-drawing/bracket characters (constitution item 13). Unlike a dense
// table cell (`ParticipationTab.tsx`/`EventsTab.tsx`'s own "—" em-dash
// convention for a single missing value), this strip's secondary lines have
// room for a short descriptive phrase ("No events logged yet", "No teams
// yet") -- DES-14's own "prescribed empty ... text" preference for a real
// sentence over a bare glyph where space allows.
// ---------------------------------------------------------------------------

/** e.g. "Meetings 0h · Outreach 10.5h · Competitions 10h" -- mirrors the
 * reference figure's own "Meetings 0h · Competitions 0h" separator/unit
 * style exactly (capability map "Coach dashboard" KPI card). */
function formatHoursBreakdown(data: KpiStripData): string {
  return [
    `Meetings ${data.meetingHours.toFixed(1)}h`,
    `Outreach ${data.outreachHours.toFixed(1)}h`,
    `Competitions ${data.competitionHours.toFixed(1)}h`,
  ].join(' · ');
}

/** e.g. "Fixture Team A 2 · Fixture Team B 2" -- D-3: a dual-member student
 * appears in full in every team's own count (view-level double count, no
 * arithmetic here). */
function formatTeamBreakdown(teamBreakdown: readonly KpiTeamBreakdownRow[]): string {
  if (teamBreakdown.length === 0) {
    return 'No teams yet';
  }
  return teamBreakdown.map((team) => `${team.teamName} ${team.activeStudentsCount}`).join(' · ');
}

function parseDateOnly(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)); // noon UTC avoids DST edge cases
}

/** NFR-09: rendered `America/Chicago`, same
 * `Intl.DateTimeFormat`-pinned-timezone technique `EventsTab.tsx`'s own
 * `formatSessionDate` already established (not imported from that
 * forbidden file -- mirrored locally), scaled down to a compact
 * "Mon D"-only format (no weekday/year) for this strip's tight secondary
 * line, matching the reference figure's own "Sep 6" short-date style. */
const KPI_MOST_RECENT_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'America/Chicago',
});

/** e.g. "Jul 18 · Fixture Off-Season Competition", or the honest "—" empty
 * case when zero events have been logged yet for this season. */
function formatMostRecentEvent(title: string | null, isoDate: string | null): string {
  if (title === null || isoDate === null) {
    return 'No events logged yet';
  }
  return `${KPI_MOST_RECENT_DATE_FORMATTER.format(parseDateOnly(isoDate))} · ${title}`;
}

/** e.g. "20.5 / 350h target" -- mirrors the reference figure's own
 * "337.75 / 1800h target" line exactly (capability map "Coach dashboard"
 * KPI card). */
function formatGoalTarget(data: KpiStripData): string {
  return `${data.totalHours.toFixed(1)} / ${data.goalTargetHours.toFixed(0)}h target`;
}
