/**
 * T056: RPT-02 Participation tab -- a team-grouped table of students with
 * meetings expected/present/late/excused and participation % (MET-01), a
 * `PowerSearch` filter (team / below-%-threshold / name), and a "below 70%"
 * quick-filter chip answering persona question P-COACH2 ("which students
 * are below 70%?").
 *
 * -----------------------------------------------------------------------
 * 1. Ground truth -- `v_student_participation` (constitution item 3, BLOCKER
 *    if re-derived).
 *
 * Read directly from `supabase/migrations/20260717000003_metric_views.sql`
 * (lines 21-42), NOT transcribed into a formula here:
 *
 *   create or replace view v_student_participation as
 *   with expected as (
 *     select s.id as student_id, s.team_id, es.id as session_id, e.season_id
 *     from students s
 *     join events e on e.counts_participation
 *       and (e.team_ids is null or s.team_id = any(e.team_ids))
 *     join event_sessions es on es.event_id = e.id and es.status = 'completed'
 *     where s.is_active
 *   )
 *   select
 *     x.student_id, x.team_id, x.season_id,
 *     count(*) as expected_ct,
 *     count(*) filter (where a.status in ('present','late')) as present_ct,
 *     count(*) filter (where a.status = 'late')    as late_ct,
 *     count(*) filter (where a.status = 'excused') as excused_ct,
 *     round(100.0 * count(*) filter (where a.status in ('present','late'))
 *           / greatest(count(*) - count(*) filter (where a.status = 'excused'), 1), 1)
 *       as participation_pct
 *   from expected x
 *   left join attendance a
 *     on a.session_id = x.session_id and a.student_id = x.student_id
 *   group by x.student_id, x.team_id, x.season_id;
 *
 * Columns: student_id, team_id, season_id, expected_ct, present_ct, late_ct,
 * excused_ct, participation_pct. `ParticipationMetricRow` below is a
 * verbatim camelCase RENAME of these seven columns -- every field maps
 * 1:1 to a column the view already computed, nothing is recomputed. The
 * migration's own implementation note (line 1) states the no-completed-
 * sessions case explicitly: "expected_ct = 0 rows simply absent; UI renders
 * '—'" -- i.e. a student with zero expected sessions has NO ROW in this
 * view at all (not a row with expected_ct=0). `buildDisplayRows` below
 * (a plain LEFT JOIN of the student roster against this view's rows, by
 * student_id) is how that absence is represented and rendered as "—"
 * rather than a fabricated 0%. Every number this tab renders (expected /
 * present / late / excused counts, participation %) is read directly off
 * `ParticipationMetricRow` -- grep-provable: this file contains no
 * `100.0 *`, no `/ greatest(`, no percentage arithmetic of any kind on
 * these fields.
 *
 * -----------------------------------------------------------------------
 * 2. RLS-on-views finding (Ground Truth section instruction: state the
 *    finding, don't assume).
 *
 * `v_student_participation` (and its sibling views in the same migration)
 * is a plain `create or replace view` -- no `security_definer`, no
 * `security_barrier` clause anywhere in
 * `20260717000003_metric_views.sql`. Per Postgres semantics, a plain view
 * runs with the QUERYING USER's own permissions against the underlying
 * base tables (`students`, `attendance`, `event_sessions`, `events`), not
 * the view owner's. Reading `20260717000002_rls.sql` directly: all three
 * of `students` (lines 94-102), `attendance` (lines 224-232), and
 * `event_sessions` (lines 170-182) carry a `staff_all` policy
 * (`using (is_staff())`, where `is_staff()` = `auth_role() in ('admin',
 * 'coach')`, line 15-17) granting `admin`/`coach` full read (and write)
 * access to every row of each underlying table. Conclusion: an
 * authenticated `admin`/`coach` querying `v_student_participation` directly
 * would see every row (bounded only by this component's own `seasonId`
 * filter), with NO additional RLS policy needed on the view itself --
 * access control for this screen is fully carried by the base tables'
 * existing `staff_all` policies, not by anything view-specific. (Students/
 * parents also technically COULD query this view under their own narrower
 * `own_or_linked_read` policies and would see only their own/linked rows --
 * RPT-06 additionally bars them from this route entirely at the UI level;
 * see gap #3 below.)
 *
 * -----------------------------------------------------------------------
 * 3. Known gap: router-level RPT-06 enforcement (flagged, not fixed here --
 *    `router.tsx` is a forbidden/read-only file for this task).
 *
 * `router.tsx`'s current `/reports` route (its own inline `ReportsPage()`
 * placeholder) is wrapped only in `RequireAuth`, no `RequireRole` -- unlike
 * `/kiosk/:sessionId` and `/settings`, which both nest `RequireRole` at the
 * route level. Per the worker packet's Known Context/Traps #1, this task's
 * `ReportsShell.tsx` (this component's caller) nests `guards.tsx`'s
 * exported `RequireRole` directly inside its own render tree instead --
 * the exact same pattern T021 (`RosterShell.tsx`) already established and
 * passed review for `/roster`'s identical gap. `RequireRole` has no
 * dependency on route-matching context (it just reads `useAuth()` and
 * redirects), so nesting it here produces byte-identical guard behavior
 * (redirect to `/` + `pushToast(ACCESS_DENIED_TOAST_MESSAGE)`) to a
 * route-level usage. This is a real, disclosed stopgap, not a full fix: a
 * component-level guard still executes this component's own render logic
 * before redirecting (however briefly), which a route-level guard would
 * avoid entirely. Flagged as a candidate for a future `router.tsx`-touching
 * corrective task (same shape as T016a) -- not resolved here since
 * `router.tsx` is forbidden to this task.
 *
 * -----------------------------------------------------------------------
 * 4. Known gap: no shared Supabase client exists anywhere in `src/` yet
 *    (confirmed via grep, zero hits for `createClient`/`supabase-js` under
 *    `src/`).
 *
 * `useParticipationData` below is the designed data-fetching seam: a typed
 * hook taking a `seasonId` and an injectable `loadData: LoadParticipationDataFn`
 * (`(seasonId) => Promise<ParticipationDisplayRow[]>`), defaulting to the
 * OBVIOUSLY-FAKE `defaultLoadParticipationData` (fixture data only, see
 * gap #6). The real implementation, once a shared Supabase client exists,
 * would `select` from `v_student_participation` joined against `students`/
 * `teams` for the two display-only fields the view itself does not carry
 * (`studentName`, `teamName` -- see `ParticipationDisplayRow` below) and
 * filter by `season_id`. This mirrors `NoAccessPage.tsx`'s (T020) already-
 * established `loadData` prop seam pattern. Flagged as a dispute candidate:
 * one shared-client task would likely unblock this and several other
 * Ready/Blocked UI tasks in this batch simultaneously, per every other
 * task in this batch hitting the identical gap.
 *
 * -----------------------------------------------------------------------
 * 5. "Grouped Table" reconciliation (Known Context/Traps #4 -- template
 *    name vs. documented component, same category as T016's "Basic Login").
 *
 * PRD 7.1 and RPT-02 both use "`Grouped Table`" as prose, but
 * `docs/swarm/astryx-api.md` has no `# Grouped Table` (or similarly named)
 * component section -- confirmed via direct grep of that file. Nor does the
 * *installed* `@astryxdesign/core` package expose a "GroupedTable"
 * component (confirmed via `find`/`grep` of `node_modules/@astryxdesign/core/src`).
 * There IS a `useTableGroupedRows` Table plugin in the installed package
 * (`node_modules/@astryxdesign/core/src/Table/index.ts`) -- but it is NOT
 * listed anywhere in `astryx-api.md`'s "Table" section (unlike
 * `useTableSortable`, which at least has an (empty/"undefined") named
 * subsection there -- `useTableGroupedRows` has no subsection at all), so
 * per constitution item 2 ("a prop absent from that file is presumed
 * hallucinated") this task treats it as out of bounds and does not use it.
 * Grouping is instead built the way the worker packet explicitly directs:
 * composing the real, documented `Table` component (props read verbatim
 * from `astryx-api.md`'s own "Table" Props table -- `data`, `columns`,
 * `idKey`, `density`, `dividers`, `isStriped`, `hasHover`, `verticalAlign`,
 * `textOverflow`) with `Section` (`astryx-api.md`'s own "Section" section --
 * `variant`, `dividers`, `padding`, `children`) for the team-level grouping
 * regions -- one `<Section>` per team, each containing a `<Heading level={2}>`
 * (team name) + one independent `<Table>` instance scoped to that team's
 * already-filtered row subset. No bespoke "Grouped Table" component was
 * invented and no undocumented `Table` prop was used to achieve grouping.
 *
 * -----------------------------------------------------------------------
 * 6. "sortable" column field -- a DELIBERATE non-use, disclosed rather than
 *    silently skipped, because RPT-02's own PRD text says "sortable".
 *
 * The installed package's `TableColumn<T>` type (`node_modules/@astryxdesign/core/src/Table/types.ts`,
 * line 172) genuinely has a real `sortable?: boolean | TableSortableColumnConfig`
 * field, paired with a real `useTableSortable` plugin
 * (`node_modules/@astryxdesign/core/src/Table/plugins/sortable/useTableSortable.tsx`,
 * cross-checked live via `npm run astryx -- component useTableSortable`,
 * which resolves its own "undefined" `astryx-api.md` subsection body to
 * `sort`/`onSortChange`/`allowUnsortedState`/`isMultiSortEnabled`, the same
 * "own subsection reads undefined, CLI/source resolves it" pattern T021
 * used for `Tab`/`Heading`). This task deliberately does NOT use `sortable`
 * on `columns`, however: unlike `Tab`/`Heading` (whose OWN named
 * subsections exist in `astryx-api.md`, just empty), the `Table` component's
 * own Props table in `astryx-api.md` describes the `columns` prop's shape
 * with an explicit, closed-looking enumeration -- "each column has {key,
 * header, width?, align?, renderCell?}" -- that does not mention `sortable`
 * at all, anywhere in the file. Treating an enumerated shape inside an
 * already-documented prop's own description as exhaustive is the more
 * conservative reading of constitution item 2, so `sortable`/
 * `useTableSortable`/`plugins` are not used here. Instead, "sortable" is
 * satisfied with ONLY unambiguously-cited components: a `SegmentedControl`
 * (astryx-api.md "SegmentedControl" Props table: `value`, `onChange`,
 * `label`, `children`) to pick the sort field (Student name /
 * Participation %) and a `ToggleButton` (astryx-api.md "ToggleButton" Props
 * table: `label`, `isPressed`, `onPressedChange`) to pick direction,
 * client-sorting the already-filtered row array (`compareParticipationRows`
 * below) before it is ever handed to `Table`'s plain, fully-documented
 * `data` prop. No column-level prop absent from `astryx-api.md`'s own text
 * is used anywhere in this file.
 *
 * -----------------------------------------------------------------------
 * 7. "below 70%" quick-filter chip -- component reconciliation.
 *
 * `astryx-api.md` has no "Chip" component at all (confirmed via grep).
 * `ToggleButton` (astryx-api.md "ToggleButton" section: "switches between
 * selected and unselected states to represent a persistent on/off choice
 * ... standalone for binary actions") is the documented component whose
 * own description is the closest real match for a single on/off quick
 * filter -- used here with only its cited `label`/`isPressed`/
 * `onPressedChange` props, no invented "Chip" component.
 *
 * -----------------------------------------------------------------------
 * 8. `PowerSearch` `config`/`filters`/`onChange` -- cited from
 *    `astryx-api.md`'s own "PowerSearch" Props table (`config`, `filters`,
 *    `onChange`, `label`, `placeholder`, `resultCount` -- all used below).
 *    The full `PowerSearchConfig`/`PowerSearchField`/`PowerSearchOperator`/
 *    `OperatorValue`/`FilterValue` shapes are NOT spelled out as their own
 *    Props tables in `astryx-api.md` (only shown via the file's own
 *    abbreviated JSX example), so this file's field/operator/value-type
 *    construction is cross-checked directly against the installed
 *    package's own exported types (`node_modules/@astryxdesign/core/src/PowerSearch/types.ts`,
 *    all re-exported from the package's public `index.ts`, not an internal
 *    detail) -- the same "doc gap resolved via the real shipped source"
 *    posture as gap #6 above, applied only to the parts `astryx-api.md`
 *    itself never attempted to enumerate (unlike `columns`, which it did).
 *
 * -----------------------------------------------------------------------
 * 9. Fixture data (constitution item 6: no PII, fabricated names only).
 *
 * `FIXTURE_STUDENTS`/`FIXTURE_TEAMS`/`FIXTURE_METRICS` below are entirely
 * fabricated (no real student/team names) and exist ONLY as the default
 * argument to `defaultLoadParticipationData`, the obviously-placeholder
 * default for the `loadData` seam (gap #4) -- a real caller (or a future
 * Supabase-backed implementation) supplies its own `loadData`. The fixture
 * set is deliberately built to exercise every case called out in the
 * worker packet's Known Context/Traps #3: a student below 70% (strict),
 * a student at exactly the 70% boundary, a student with no row in the view
 * (expected_ct=0 case), students split across two different teams, a
 * late-counted-within-present example, and an excused-shrinks-denominator
 * example (NFR-03). Full walkthrough reported in this task's worker
 * output, not merely asserted here.
 *
 * -----------------------------------------------------------------------
 * 10. "Below 70%" boundary decision (worker packet Known Context/Traps #3):
 *     STRICT `<`, not `<=`. PRD's literal wording is "below 70%", which
 *     reads as strict less-than; a student at exactly 70.0% is doing
 *     *at least* as well as the threshold, not below it. `isBelowThreshold`
 *     below is the single, shared implementation of this comparison --
 *     used identically by the PowerSearch "below-%-threshold" field and the
 *     "below 70%" quick-filter chip, so the decision is enforced in exactly
 *     one place, not duplicated.
 *
 * -----------------------------------------------------------------------
 * 11. T095 (ED-1 Packet P6): real load wiring -- `loadData` no longer
 *     defaults to fixture data.
 *
 * `loadData` now defaults to `loadParticipationData`, imported from
 * `../../lib/supabase/loaders/reports` -- a real `v_student_participation`
 * query (strict passthrough only, module doc #1's own no-re-derivation
 * discipline still holds; see that loader module's own doc comment for the
 * full column-by-column citation and RLS finding). `defaultLoadParticipationData`
 * (fixture data, unchanged) is kept as a named export for tests (and any
 * future caller) that want fixture behavior explicitly, same "the default
 * changes, the fixture literal doesn't" posture `StudentsTab.tsx` (T089)
 * already established.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Banner,
  Button,
  EmptyState,
  Heading,
  HStack,
  PowerSearch,
  ProgressBar,
  SegmentedControl,
  SegmentedControlItem,
  Section,
  Skeleton,
  Table,
  Text,
  ToggleButton,
  VisuallyHidden,
  VStack,
  pixel,
  proportional,
  type PowerSearchConfig,
  type PowerSearchFilter,
  type TableColumn,
} from '@astryxdesign/core';
import { loadParticipationData } from '../../lib/supabase/loaders/reports';

// ---------------------------------------------------------------------------
// Types -- see module doc #1.
// ---------------------------------------------------------------------------

/**
 * Verbatim camelCase rename of `v_student_participation`'s seven real
 * columns (student_id, team_id, season_id, expected_ct, present_ct,
 * late_ct, excused_ct, participation_pct). Nothing here is computed --
 * every field is a 1:1 copy of a column the view itself already produced.
 */
export interface ParticipationMetricRow {
  studentId: string;
  teamId: string;
  seasonId: string;
  expectedCt: number;
  presentCt: number;
  lateCt: number;
  excusedCt: number;
  participationPct: number;
}

/**
 * Display row for this screen: `ParticipationMetricRow`'s fields (or `null`
 * for every metric field when the student has no row in the view at all --
 * the expected_ct=0 case, module doc #1) plus two DISPLAY-ONLY fields
 * (`studentName`, `teamName`) that do not exist on `v_student_participation`
 * itself and would come from a join against `students`/`teams` in the real
 * implementation (module doc #4). `extends Record<string, unknown>` is
 * required by `Table`'s own generic constraint (astryx-api.md "Table" Props
 * table, `data: T[]` description).
 */
export interface ParticipationDisplayRow extends Record<string, unknown> {
  studentId: string;
  studentName: string;
  teamId: string;
  teamName: string;
  seasonId: string;
  expectedCt: number | null;
  presentCt: number | null;
  lateCt: number | null;
  excusedCt: number | null;
  participationPct: number | null;
}

export type LoadParticipationDataFn = (seasonId: string) => Promise<ParticipationDisplayRow[]>;

interface FixtureStudent {
  id: string;
  name: string;
  teamId: string;
}

interface FixtureTeam {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Placeholder "current season" -- module doc #4. Real season selection (a
// `seasons where is_active` lookup, per `supabase/migrations/20260716000000_identity_roster.sql`'s
// `seasons_single_active_idx` partial unique index) is out of scope for this
// shell task; this constant stands in for it, disclosed rather than
// silently assumed.
// ---------------------------------------------------------------------------
export const PLACEHOLDER_CURRENT_SEASON_ID = 'season-placeholder-current';

// ---------------------------------------------------------------------------
// Fixture data -- module doc #9. Fabricated names only (constitution item 6).
// ---------------------------------------------------------------------------

const FIXTURE_TEAMS: readonly FixtureTeam[] = [
  { id: 'team-falcons', name: 'Falcons' },
  { id: 'team-comets', name: 'Comets' },
];

const FIXTURE_STUDENTS: readonly FixtureStudent[] = [
  { id: 'student-ava-thompson', name: 'Ava Thompson', teamId: 'team-falcons' },
  { id: 'student-liam-ortiz', name: 'Liam Ortiz', teamId: 'team-falcons' },
  // No completed sessions -- deliberately has NO matching row in
  // FIXTURE_METRICS below, reproducing v_student_participation's real
  // "expected_ct = 0 rows simply absent" behavior.
  { id: 'student-noah-bennett', name: 'Noah Bennett', teamId: 'team-falcons' },
  { id: 'student-maya-chen', name: 'Maya Chen', teamId: 'team-comets' },
  { id: 'student-zoe-martinez', name: 'Zoe Martinez', teamId: 'team-comets' },
  { id: 'student-diego-ramirez', name: 'Diego Ramirez', teamId: 'team-comets' },
];

/**
 * Fabricated rows shaped exactly like `v_student_participation`'s real
 * output (module doc #1) -- `participationPct` values below are what the
 * view's own SQL (`round(100.0 * present_ct / greatest(expected_ct -
 * excused_ct, 1), 1)`) would have produced for each row's expected/present/
 * excused counts; this file never performs that computation itself.
 */
const FIXTURE_METRICS: readonly ParticipationMetricRow[] = [
  // Ava Thompson: 9/10 present, no excused -> 90.0% (well above 70).
  {
    studentId: 'student-ava-thompson',
    teamId: 'team-falcons',
    seasonId: PLACEHOLDER_CURRENT_SEASON_ID,
    expectedCt: 10,
    presentCt: 9,
    lateCt: 0,
    excusedCt: 0,
    participationPct: 90.0,
  },
  // Liam Ortiz: 6/10 present -> 60.0% (BELOW 70%, ordinary case).
  {
    studentId: 'student-liam-ortiz',
    teamId: 'team-falcons',
    seasonId: PLACEHOLDER_CURRENT_SEASON_ID,
    expectedCt: 10,
    presentCt: 6,
    lateCt: 0,
    excusedCt: 0,
    participationPct: 60.0,
  },
  // Maya Chen: 7/10 present -> exactly 70.0% (BOUNDARY case -- see module
  // doc #10: strict "<" excludes this row from "below 70%").
  {
    studentId: 'student-maya-chen',
    teamId: 'team-comets',
    seasonId: PLACEHOLDER_CURRENT_SEASON_ID,
    expectedCt: 10,
    presentCt: 7,
    lateCt: 0,
    excusedCt: 0,
    participationPct: 70.0,
  },
  // Zoe Martinez: 8/10 present (6 present + 2 late; late_ct is a SUBSET of
  // present_ct per the view's own `status in ('present','late')` filter)
  // -> 80.0% (above 70; also demonstrates late-counted-within-present).
  {
    studentId: 'student-zoe-martinez',
    teamId: 'team-comets',
    seasonId: PLACEHOLDER_CURRENT_SEASON_ID,
    expectedCt: 10,
    presentCt: 8,
    lateCt: 2,
    excusedCt: 0,
    participationPct: 80.0,
  },
  // Diego Ramirez: 4 present, 3 excused, 10 expected -> denominator shrinks
  // to (10-3)=7 -> round(100*4/7,1) = 57.1% (BELOW 70%; NFR-03
  // excused-shrinks-denominator case, T014-tested).
  {
    studentId: 'student-diego-ramirez',
    teamId: 'team-comets',
    seasonId: PLACEHOLDER_CURRENT_SEASON_ID,
    expectedCt: 10,
    presentCt: 4,
    lateCt: 0,
    excusedCt: 3,
    participationPct: 57.1,
  },
  // student-noah-bennett has NO row here -- the expected_ct=0 case.
];

// ---------------------------------------------------------------------------
// Pure functions -- exported for direct testing (module doc #9's fixture
// walkthrough; see this task's worker output for the real run).
// ---------------------------------------------------------------------------

/**
 * Plain LEFT JOIN of the student roster against the metric view's rows --
 * module doc #1. Performs zero MET-01 arithmetic: every metric field is
 * either copied verbatim from a matching `ParticipationMetricRow` or `null`
 * when no such row exists (the expected_ct=0 / "no completed sessions"
 * case).
 */
export function buildDisplayRows(
  students: readonly FixtureStudent[],
  teams: readonly FixtureTeam[],
  metrics: readonly ParticipationMetricRow[],
): ParticipationDisplayRow[] {
  const teamNameById = new Map(teams.map((team) => [team.id, team.name] as const));
  const metricByStudentId = new Map(metrics.map((metric) => [metric.studentId, metric] as const));

  return students.map((student) => {
    const metric = metricByStudentId.get(student.id) ?? null;
    return {
      studentId: student.id,
      studentName: student.name,
      teamId: student.teamId,
      teamName: teamNameById.get(student.teamId) ?? student.teamId,
      seasonId: metric?.seasonId ?? PLACEHOLDER_CURRENT_SEASON_ID,
      expectedCt: metric?.expectedCt ?? null,
      presentCt: metric?.presentCt ?? null,
      lateCt: metric?.lateCt ?? null,
      excusedCt: metric?.excusedCt ?? null,
      participationPct: metric?.participationPct ?? null,
    };
  });
}

/**
 * The ONE shared "below threshold" comparison (module doc #10) -- used
 * identically by the PowerSearch "below-%-threshold" field and the "below
 * 70%" quick-filter chip. `null` (no row in the view -- expected_ct=0)
 * never matches: it is not a fabricated 0%, so it is never "below"
 * anything.
 */
export function isBelowThreshold(participationPct: number | null, threshold: number): boolean {
  return participationPct !== null && participationPct < threshold;
}

/** Hardcoded per RPT-02's literal "a 'below 70%' quick filter chip". */
export const BELOW_SEVENTY_THRESHOLD = 70;

export type ParticipationSortField = 'studentName' | 'participationPct';
export type ParticipationSortDirection = 'ascending' | 'descending';

/**
 * Client-side comparator used to sort the already-filtered row array before
 * handing it to `Table`'s plain `data` prop -- see module doc #6 for why
 * this exists instead of `Table`'s own `sortable` column field. The `-1`
 * sentinel for `null` participationPct values is ONLY an ordering
 * placement (so "—" rows sort predictably first) -- it is never
 * rendered, and never used by `isBelowThreshold`'s comparison.
 */
export function compareParticipationRows(
  a: ParticipationDisplayRow,
  b: ParticipationDisplayRow,
  field: ParticipationSortField,
  direction: ParticipationSortDirection,
): number {
  const raw =
    field === 'studentName'
      ? a.studentName.localeCompare(b.studentName)
      : (a.participationPct ?? -1) - (b.participationPct ?? -1);
  return direction === 'ascending' ? raw : -raw;
}

/**
 * Obviously-fake placeholder default for the `loadData` seam -- module doc
 * #4. Does NOT call Supabase (no shared client exists yet anywhere in
 * `src/`). Real callers should pass their own `loadData` prop.
 */
export async function defaultLoadParticipationData(
  seasonId: string,
): Promise<ParticipationDisplayRow[]> {
  const seasonMetrics = FIXTURE_METRICS.filter((metric) => metric.seasonId === seasonId);
  return buildDisplayRows(FIXTURE_STUDENTS, FIXTURE_TEAMS, seasonMetrics);
}

// ---------------------------------------------------------------------------
// Data-loading hook (DES-12 four-state seam) -- module doc #4.
// ---------------------------------------------------------------------------

type ParticipationLoadState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown; retry: () => void }
  | { status: 'success'; rows: ParticipationDisplayRow[] };

function useParticipationData(
  seasonId: string,
  loadData: LoadParticipationDataFn,
): ParticipationLoadState {
  const [state, setState] = useState<ParticipationLoadState>({ status: 'loading' });
  // Bumped by the error Banner's "Retry" action (DES-12) to force the effect
  // below to re-run without changing `seasonId`/`loadData` deps semantics.
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setState({ status: 'loading' });
    loadData(seasonId)
      .then((rows) => {
        if (isMounted) {
          setState({ status: 'success', rows });
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setState({ status: 'error', error, retry: () => setRetryToken((token) => token + 1) });
        }
      });
    return () => {
      isMounted = false;
    };
  }, [seasonId, loadData, retryToken]);

  return state;
}

// ---------------------------------------------------------------------------
// PowerSearch field keys -- one shared source of truth for both the config
// (below) and the filter-matching switch, so field-key strings can never
// drift apart. Module doc #8 for the type sourcing.
// ---------------------------------------------------------------------------

const SEARCH_FIELD_KEYS = {
  name: 'studentName',
  team: 'team',
  belowPct: 'belowPct',
} as const;

function buildSearchConfig(teams: readonly { id: string; name: string }[]): PowerSearchConfig {
  return {
    name: 'ParticipationSearch',
    fields: [
      {
        key: SEARCH_FIELD_KEYS.name,
        label: 'Student name',
        operators: [{ key: 'contains', label: 'contains', value: { type: 'string' } }],
      },
      {
        key: SEARCH_FIELD_KEYS.team,
        label: 'Team',
        operators: [
          {
            key: 'is',
            label: 'is',
            value: {
              type: 'enum',
              values: teams.map((team) => ({ value: team.id, label: team.name })),
            },
          },
        ],
      },
      {
        key: SEARCH_FIELD_KEYS.belowPct,
        label: 'Below %',
        operators: [
          {
            key: 'below',
            label: 'below',
            value: { type: 'integer', minValue: 0, maxValue: 100, units: '%' },
          },
        ],
      },
    ],
  };
}

function rowMatchesFilter(row: ParticipationDisplayRow, filter: PowerSearchFilter): boolean {
  switch (filter.field) {
    case SEARCH_FIELD_KEYS.name: {
      if (filter.value.type !== 'string') {
        return true;
      }
      const needle = filter.value.value.trim().toLowerCase();
      return needle.length === 0 || row.studentName.toLowerCase().includes(needle);
    }
    case SEARCH_FIELD_KEYS.team: {
      if (filter.value.type !== 'enum') {
        return true;
      }
      return row.teamId === filter.value.value;
    }
    case SEARCH_FIELD_KEYS.belowPct: {
      if (filter.value.type !== 'integer') {
        return true;
      }
      return isBelowThreshold(row.participationPct, filter.value.value);
    }
    default:
      return true;
  }
}

function matchesAllFilters(
  row: ParticipationDisplayRow,
  filters: readonly PowerSearchFilter[],
): boolean {
  return filters.every((filter) => rowMatchesFilter(row, filter));
}

// ---------------------------------------------------------------------------
// Table columns -- astryx-api.md "Table" Props table: `columns:
// TableColumn<T>[]` -- {key, header, width?, align?, renderCell?}. Numeric
// columns always supply `renderCell` because Table's own default cell
// renderer is `String(item[key])` (verified directly in
// node_modules/@astryxdesign/core/src/Table/types.ts, line 196), which
// would print the literal string "null" for the expected_ct=0 case instead
// of "—".
// ---------------------------------------------------------------------------

function renderCountCell(value: number | null): ReactNode {
  return <Text hasTabularNumbers>{value === null ? '—' : value}</Text>;
}

function buildColumns(): TableColumn<ParticipationDisplayRow>[] {
  return [
    { key: 'studentName', header: 'Student', width: proportional(2) },
    {
      key: 'expectedCt',
      header: 'Expected',
      width: proportional(1),
      align: 'end',
      renderCell: (row) => renderCountCell(row.expectedCt),
    },
    {
      key: 'presentCt',
      header: 'Present',
      width: proportional(1),
      align: 'end',
      renderCell: (row) => renderCountCell(row.presentCt),
    },
    {
      key: 'lateCt',
      header: 'Late',
      width: proportional(1),
      align: 'end',
      renderCell: (row) => renderCountCell(row.lateCt),
    },
    {
      key: 'excusedCt',
      header: 'Excused',
      width: proportional(1),
      align: 'end',
      renderCell: (row) => renderCountCell(row.excusedCt),
    },
    {
      key: 'participationPct',
      header: 'Participation %',
      width: pixel(200),
      renderCell: (row) =>
        row.participationPct === null ? (
          <Text color="secondary">{'—'}</Text>
        ) : (
          <ProgressBar
            label={`${row.studentName} participation: ${row.participationPct}%`}
            isLabelHidden
            value={row.participationPct}
            hasValueLabel
          />
        ),
    },
  ];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/** Stable empty-array reference so `useMemo`s downstream don't see a new
 * array identity every render while data is loading/erroring. */
const EMPTY_ROWS: ParticipationDisplayRow[] = [];

export interface ParticipationTabProps {
  seasonId: string;
  /** Injectable data-loading seam (module doc #4). Defaults to fixture data. */
  loadData?: LoadParticipationDataFn;
}

export function ParticipationTab({
  seasonId,
  loadData = loadParticipationData,
}: ParticipationTabProps): ReactNode {
  const loadState = useParticipationData(seasonId, loadData);
  const [filters, setFilters] = useState<ReadonlyArray<PowerSearchFilter>>([]);
  const [isBelowSeventyActive, setIsBelowSeventyActive] = useState(false);
  const [sortField, setSortField] = useState<ParticipationSortField>('studentName');
  const [sortDirection, setSortDirection] = useState<ParticipationSortDirection>('ascending');

  const rows = loadState.status === 'success' ? loadState.rows : EMPTY_ROWS;

  const teams = useMemo(() => {
    const byId = new Map<string, { id: string; name: string }>();
    for (const row of rows) {
      byId.set(row.teamId, { id: row.teamId, name: row.teamName });
    }
    return Array.from(byId.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [rows]);

  const searchConfig = useMemo(() => buildSearchConfig(teams), [teams]);
  const columns = useMemo(() => buildColumns(), []);

  const filteredRows = useMemo(() => {
    const searchFiltered = rows.filter((row) => matchesAllFilters(row, filters));
    const belowSeventyFiltered = isBelowSeventyActive
      ? searchFiltered.filter((row) =>
          isBelowThreshold(row.participationPct, BELOW_SEVENTY_THRESHOLD),
        )
      : searchFiltered;
    return [...belowSeventyFiltered].sort((a, b) =>
      compareParticipationRows(a, b, sortField, sortDirection),
    );
  }, [rows, filters, isBelowSeventyActive, sortField, sortDirection]);

  const groupedByTeam = useMemo(() => {
    const groups = new Map<
      string,
      { teamId: string; teamName: string; rows: ParticipationDisplayRow[] }
    >();
    for (const row of filteredRows) {
      const existing = groups.get(row.teamId);
      if (existing) {
        existing.rows.push(row);
      } else {
        groups.set(row.teamId, { teamId: row.teamId, teamName: row.teamName, rows: [row] });
      }
    }
    return Array.from(groups.values()).sort((a, b) => a.teamName.localeCompare(b.teamName));
  }, [filteredRows]);

  if (loadState.status === 'loading') {
    return (
      <VStack gap={4} aria-busy="true">
        <VisuallyHidden as="div" role="status">
          Loading participation data…
        </VisuallyHidden>
        <Skeleton width={280} height={32} />
        <VStack gap={3}>
          <Skeleton width={140} height={20} index={1} />
          <VStack gap={2}>
            {[0, 1, 2].map((row) => (
              <HStack key={row} gap={4} vAlign="center">
                <Skeleton width={160} height={16} index={row * 3 + 2} />
                <Skeleton width={100} height={16} index={row * 3 + 3} />
                <Skeleton width={80} height={16} index={row * 3 + 4} />
              </HStack>
            ))}
          </VStack>
        </VStack>
      </VStack>
    );
  }

  if (loadState.status === 'error') {
    return (
      <Banner
        status="error"
        title="Couldn't load participation data"
        description="Something went wrong loading this season's participation numbers. Try refreshing the page."
        endContent={<Button variant="ghost" label="Retry" onClick={loadState.retry} />}
      />
    );
  }

  return (
    <VStack gap={4}>
      <PowerSearch
        label="Filter students"
        placeholder="Filter by name, team, or below-% threshold…"
        config={searchConfig}
        filters={filters}
        onChange={(newFilters) => setFilters(newFilters)}
        resultCount={filteredRows.length}
      />

      <ToggleButton
        label="Below 70%"
        isPressed={isBelowSeventyActive}
        onPressedChange={setIsBelowSeventyActive}
      />

      <SegmentedControl
        value={sortField}
        onChange={(value) => setSortField(value as ParticipationSortField)}
        label="Sort by"
      >
        <SegmentedControlItem value="studentName" label="Student name" />
        <SegmentedControlItem value="participationPct" label="Participation %" />
      </SegmentedControl>
      <ToggleButton
        label="Sort descending"
        isPressed={sortDirection === 'descending'}
        onPressedChange={(pressed) => setSortDirection(pressed ? 'descending' : 'ascending')}
      />

      {groupedByTeam.length === 0 ? (
        <EmptyState
          headingLevel={2}
          // DES-15 verbatim (PRD line 214, the "Reports" example): "No
          // completed sessions this season yet. Stats appear after the
          // first meeting or outreach day is marked complete." -- title
          // carries the first sentence, description the second;
          // concatenated they reproduce the PRD text exactly. This example
          // genuinely fits THIS tab (RPT-02 specifically reports
          // completed-session participation, MET-01), unlike
          // HoursTab.tsx/EventsTab.tsx's own adapted copy -- see those
          // files' own module docs for why the same literal text does not
          // fit their different empty-state semantics.
          title={
            rows.length === 0
              ? 'No completed sessions this season yet.'
              : 'No students match these filters'
          }
          description={
            rows.length === 0
              ? 'Stats appear after the first meeting or outreach day is marked complete.'
              : 'Try clearing the search filters or the "Below 70%" chip.'
          }
        />
      ) : (
        groupedByTeam.map((group) => (
          <Section key={group.teamId} dividers={['bottom']}>
            <VStack gap={3}>
              <Heading level={2}>{group.teamName}</Heading>
              <Table
                data={group.rows}
                columns={columns}
                idKey="studentId"
                density="balanced"
                dividers="rows"
                hasHover
              />
            </VStack>
          </Section>
        ))
      )}
    </VStack>
  );
}

export default ParticipationTab;
