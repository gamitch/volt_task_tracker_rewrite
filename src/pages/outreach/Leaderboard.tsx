/**
 * T044: `Leaderboard.tsx` -- a `Section` on `/outreach` (OUT-08): top 10
 * students by season volunteer hours, visible to every role with no
 * `RequireRole` gate.
 *
 * -----------------------------------------------------------------------
 * 1. Ground truth -- `v_student_hours`, cited directly from
 *    `supabase/migrations/20260717000003_metric_views.sql` lines 3-19
 *    (read-only), NOT redefined/renamed with invented fields:
 *
 *    `v_student_hours`: `student_id`, `season_id`, `confirmed_hours`.
 *    `LeaderboardHoursRow` below is a camelCase rename of exactly this
 *    column set -- `studentId`, `seasonId`, `confirmedHours` -- and nothing
 *    else. This view's own definition already applies `hours_override`/
 *    `check_in_at`/`check_out_at` clamping/coalescing (module doc #2 of
 *    `OutreachList.tsx`, T038, documents the same distinction for a
 *    sibling case): this file never touches any of those raw `attendance`
 *    columns, only the already-computed `confirmed_hours` number the view
 *    hands back per student/season.
 *
 * -----------------------------------------------------------------------
 * 2. Constitution item 3 (BLOCKER-class) -- zero formula re-derivation.
 *
 * `topStudentsByHours` below is a sort (descending by `confirmedHours`,
 * already computed by `v_student_hours`) + `slice(0, limit)` -- ranking
 * logic over an already-computed number, never a reimplementation of how
 * that number itself is derived. Grep-provable: the only occurrences of
 * `hours_override`/`check_in_at`/`check_out_at` anywhere in this file are
 * the two mentions inside this module doc block (here and in module doc
 * #1) explaining that this file never touches them -- zero occurrences in
 * any executable code path. The `roundForDisplay` helper (see its own
 * doc comment below) only rounds an already-final number for
 * presentation -- it never recomputes hours from any lower-level input.
 *
 * -----------------------------------------------------------------------
 * 3. SEC-04/ROS-08 "First L." format (BLOCKER-class).
 *
 * `formatDisplayName` below is the ONLY place a student's raw
 * `displayName` is ever formatted for render. When the privacy setting is
 * ON (the default -- module doc #4), it returns `"${firstName} ${lastInitial}."`
 * -- first name plus a single capital initial and a period -- and NEVER
 * the raw `displayName` string. `LeaderboardEntry.displayName` (the raw,
 * unformatted name) is deliberately never passed to any rendered
 * JSX/attribute directly in this file's component tree -- every render
 * site calls `formatDisplayName` first. See this task's worker output for
 * the render-time DOM proof (a fixture student with a distinctive last
 * name, asserted absent from the DOM in its entirety, not just from
 * visible text) using `container.innerHTML` (not just `.textContent`) so
 * an attribute-level leak (e.g. a stray `title`/`aria-label` carrying the
 * raw name) would also be caught.
 *
 * -----------------------------------------------------------------------
 * 4. THE CENTRAL TRAP -- inherited schema gap from T028, disclosed here
 *    exactly as that task's packet frames it, not silently assumed away.
 *
 * `docs/swarm/active/T028-worker-packet.md` (read for this task, per this
 * task's own packet instruction) documents a real, genuine schema gap:
 * there is no `privacy`/`show_full_name`/leaderboard-privacy-shaped column
 * anywhere in the current schema (confirmed independently by grepping
 * every file under `supabase/migrations/` for this task: zero hits for
 * any such column on `teams`, `seasons`, `profiles`, or any other table).
 * `AdminToggles.tsx` (T028's own deliverable, the real UI for this
 * setting, admin-only, rendered on `/roster`) does not exist yet in this
 * repo as of this task's dispatch (confirmed via `Glob`/`ls` on
 * `src/pages/roster/` -- only `RosterShell.tsx`/`StudentsTab.tsx` exist).
 *
 * This file therefore builds its own privacy-setting consumption against
 * an injectable `loadPrivacySetting`-style seam
 * (`LoadPrivacySettingFn`/`defaultLoadPrivacySetting` below), of the same
 * shape T028's packet describes for its own `loadPrivacySetting`/
 * `onTogglePrivacy` seam -- **defaulting to `true` (ON)** per SEC-04/
 * ROS-08's stated default. This is a disclosed stand-in, not a real
 * Supabase read: once T028 ships a real column and `AdminToggles.tsx`
 * persists to it, a future small wiring task can swap
 * `defaultLoadPrivacySetting` for a real Supabase-backed implementation
 * with no change to this file's rendering logic. Flagged as a dispute
 * candidate / follow-up need, same as T028's own packet already flags it
 * -- this task does not resolve the missing-column gap, only inherits and
 * discloses it a second time from the consuming side.
 *
 * RESOLVED (T104, ED-1 Packet P11): the column now genuinely exists as
 * `seasons.leaderboard_privacy_enabled` (deliberately NOT the
 * `leaderboard_show_full_name` name speculated above -- see this task's own
 * migration, `supabase/migrations/20260720000000_leaderboard_privacy.sql`,
 * for the full re-verified reasoning, including why that guessed name would
 * have misdescribed a toggle that never reveals a full name in either
 * state, exactly as this file's own module doc #5 below already
 * establishes). `loadPrivacySetting` now defaults to the real, SHARED
 * `loadPrivacySetting` from `../../lib/supabase/loaders/leaderboard_privacy`
 * -- the SAME function `AdminToggles.tsx` also now defaults to (that
 * module's own doc comment documents the shared-vs-separate decision in
 * full) -- so both files read the exact same currently-active season's
 * real privacy flag. `defaultLoadPrivacySetting` below is KEPT as a named
 * export, fixture literal unchanged, for tests that want fixture behavior
 * explicitly.
 *
 * -----------------------------------------------------------------------
 * 5. Toggle-OFF semantics -- an explicit, disclosed investigation
 *    (Known Context/Traps #3 of this task's packet), CONFIRMED against
 *    T028's real, already-built `AdminToggles.tsx` -- not left as a guess.
 *
 * This task's own packet (Known Context/Traps #3) initially frames "OFF
 * renders full names" as one candidate reading, but explicitly instructs:
 * "confirm this reading against T028's actual established toggle semantics
 * once you have visibility into it ... this is a real, non-obvious semantic
 * question worth getting right, not assuming." At the time this file was
 * written, `src/pages/roster/AdminToggles.tsx` already existed in this
 * repo (confirmed via `Glob`/direct read, read-only reference per this
 * task's Forbidden Files), and its `Switch`'s own `description` prop
 * states the real, shipped semantics verbatim: "Controls whether
 * leaderboard and kiosk surfaces display students' full first name plus
 * last initial, **or a fully anonymized identifier**." That is decisive,
 * first-party ground truth, superseding the packet's own pre-T028
 * speculation: ON = "first name + last initial" (SEC-04's abbreviated
 * form, module doc #3 above); OFF = a **fully anonymized identifier**,
 * NOT a full-name reveal. Flipping this privacy toggle OFF makes the
 * leaderboard MORE anonymous (no name-derived information at all), never
 * less -- consistent with a default-private system where the only two
 * states are "abbreviated" and "fully anonymous," with a full-name reveal
 * never being an option this UI exposes at all. `formatDisplayName` below
 * implements this confirmed reading: OFF returns `ANONYMIZED_STUDENT_LABEL`
 * (a fixed, non-identifying string), never any part of `displayName`.
 *
 * -----------------------------------------------------------------------
 * 6. "All roles" visibility, no role gate (OUT-08).
 *
 * Unlike this batch's coach/admin-gated pages, this component renders
 * identical content for every viewer regardless of role -- it never
 * imports `useAuth`/`RequireRole` from `guards.tsx` at all (there is no
 * role-dependent branch anywhere in this file), which is the strongest
 * possible form of "no role gate": the gate doesn't exist because the
 * component has no role-conditional code path to gate.
 *
 * -----------------------------------------------------------------------
 * 7. No shared Supabase client wired in -- deliberate scope, not a gap for
 *    this task to solve (same posture as every prior content page in this
 *    batch, per this task's own Known Context/Traps #5).
 *
 * -----------------------------------------------------------------------
 * 8. Astryx prop sourcing (constitution item 2) -- every prop used below,
 *    cross-checked against `docs/swarm/astryx-api.md` directly:
 *
 *  - `Section` (line 5527 section, Props table): `variant`, `padding`
 *    used. Cross-checked against the installed source
 *    (`node_modules/@astryxdesign/core/dist/Section/Section.d.ts`) --
 *    matches the doc exactly, no gap found.
 *  - `Heading` (doc's own "Components > Heading" subsection is
 *    `undefined`, same disclosed CLI-cross-checked gap `OutreachList.tsx`/
 *    T038, `RosterShell.tsx`/T021, `MeetingsList.tsx`/T030 already hit;
 *    `npm run astryx -- component Heading` resolves `level` (required) +
 *    `children` (required) -- only those two used.
 *  - `Text` (line 829 section, Props table): `type` (`'supporting'`),
 *    `color` used.
 *  - `List` (line 4536 section, Props table): `children`, `hasDividers`,
 *    `header` used. `ListItem`'s own subsection is `undefined`; `npm run
 *    astryx -- component ListItem` resolves `label` (required),
 *    `description`, `endContent` -- only `label`/`endContent` used (no
 *    `onClick`/`href`, rows are not interactive).
 *  - `Badge` (line 493 section, Props table): `variant` (`'neutral'`
 *    only), `label` used.
 *  - `Banner` (line 2694 section, Props table): `status`, `title`,
 *    `description` used.
 *  - `EmptyState` (line 3954 section, Props table): `title` (required),
 *    `description`, `headingLevel` used.
 *  - `Skeleton` (T081, "Skeleton" section, lines 621-655): `width`,
 *    `height`, `index` used to preview this screen's predictable ranked
 *    student-list shape, replacing `Spinner`'s prior use here per Astryx's
 *    own guidance (known-dimension content). `VisuallyHidden` + the
 *    wrapping `VStack`'s `aria-busy` carry the "Loading leaderboard…"
 *    announcement `Spinner`'s `label` used to provide.
 *  - `VStack`/`HStack` ("Stack" section, `VStack`/`HStack` subsections):
 *    `gap`, `padding`, `vAlign` used.
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  Badge,
  Banner,
  Button,
  EmptyState,
  Heading,
  HStack,
  List,
  ListItem,
  Section,
  Skeleton,
  Text,
  VisuallyHidden,
  VStack,
} from '@astryxdesign/core';
import { loadPrivacySetting as realLoadPrivacySetting } from '../../lib/supabase/loaders/leaderboard_privacy';

// ---------------------------------------------------------------------------
// Types -- verbatim camelCase rename of `v_student_hours`'s real column
// subset. Module doc #1.
// ---------------------------------------------------------------------------

/** Camelcase rename of `v_student_hours`'s own output row shape (module
 * doc #1) -- `student_id`, `season_id`, `confirmed_hours`, nothing else. */
export interface LeaderboardHoursRow {
  studentId: string;
  seasonId: string;
  confirmedHours: number;
}

/** `students.display_name` (`supabase/migrations/20260716000000_identity_roster.sql`
 * line 62, read-only) -- `v_student_hours` itself carries no name column,
 * so a name lookup requires joining against the roster separately. */
export interface LeaderboardStudentFixture {
  id: string;
  displayName: string;
}

export interface LeaderboardLoadResult {
  hours: readonly LeaderboardHoursRow[];
  students: readonly LeaderboardStudentFixture[];
}

export type LoadLeaderboardDataFn = (seasonId: string) => Promise<LeaderboardLoadResult>;

/** Injectable seam for the T028-owned privacy setting (module doc #4).
 * `true` = ON = show the abbreviated "First L." form. */
export type LoadPrivacySettingFn = () => Promise<boolean>;

/** A ranked entry: raw (unformatted) name + already-computed hours. The
 * raw `displayName` is intentionally never rendered directly anywhere in
 * this file -- `formatDisplayName` (module doc #3) is always the render-time
 * boundary. */
export interface LeaderboardEntry {
  studentId: string;
  displayName: string;
  confirmedHours: number;
}

// ---------------------------------------------------------------------------
// Placeholder identifiers -- same disclosed-stand-in category as
// `PLACEHOLDER_CURRENT_SEASON_ID`/`PLACEHOLDER_CURRENT_STUDENT_ID`
// elsewhere in this batch (e.g. `OutreachList.tsx`).
// ---------------------------------------------------------------------------

const PLACEHOLDER_SEASON_ID = 'season-placeholder-current';
const OTHER_SEASON_ID = 'season-placeholder-previous';

/** Module doc #4 -- the real, stated SEC-04/ROS-08 default. */
const DEFAULT_PRIVACY_ON = true;

export const TOP_STUDENT_LIMIT = 10;

// ---------------------------------------------------------------------------
// Fixture data (constitution item 6: fabricated names only). Eleven current-
// season students (one more than TOP_STUDENT_LIMIT) so `slice(0, 10)` is
// genuinely exercised -- the 11th (lowest-hours) student must never appear
// anywhere this file renders. One student ("Zephyrine Wrzesniewski") has a
// deliberately distinctive last name for the SEC-04/ROS-08 zero-leakage
// proof (module doc #3). One extra student/hours row lives only in a
// DIFFERENT season, to prove season-scoping is real, not vestigial.
// ---------------------------------------------------------------------------

const FIXTURE_STUDENTS: readonly LeaderboardStudentFixture[] = [
  { id: 'student-zephyrine-wrzesniewski', displayName: 'Zephyrine Wrzesniewski' },
  { id: 'student-kestrel-abernathy', displayName: 'Kestrel Abernathy' },
  { id: 'student-orion-blackwood', displayName: 'Orion Blackwood' },
  { id: 'student-marisol-kowalczyk', displayName: 'Marisol Kowalczyk' },
  { id: 'student-thaddeus-okonkwo', displayName: 'Thaddeus Okonkwo' },
  { id: 'student-priyanka-ashworth', displayName: 'Priyanka Ashworth' },
  { id: 'student-soren-ekwueme', displayName: 'Soren Ekwueme' },
  { id: 'student-ines-falkenrath', displayName: 'Ines Falkenrath' },
  { id: 'student-callum-vasquez', displayName: 'Callum Vasquez' },
  { id: 'student-naledi-whitcombe', displayName: 'Naledi Whitcombe' },
  // 11th current-season student -- lowest hours, must be excluded by
  // slice(0, 10). Distinctive name so exclusion is provable, not assumed.
  { id: 'student-dashiell-ptak', displayName: 'Dashiell Ptak' },
  // Only ever has an hours row in OTHER_SEASON_ID below -- must never
  // appear regardless of privacy setting, proving season-scoping is real.
  { id: 'student-marguerite-thistlewood', displayName: 'Marguerite Thistlewood' },
];

const FIXTURE_HOURS: readonly LeaderboardHoursRow[] = [
  {
    studentId: 'student-zephyrine-wrzesniewski',
    seasonId: PLACEHOLDER_SEASON_ID,
    confirmedHours: 42.5,
  },
  { studentId: 'student-kestrel-abernathy', seasonId: PLACEHOLDER_SEASON_ID, confirmedHours: 38 },
  { studentId: 'student-orion-blackwood', seasonId: PLACEHOLDER_SEASON_ID, confirmedHours: 35.5 },
  { studentId: 'student-marisol-kowalczyk', seasonId: PLACEHOLDER_SEASON_ID, confirmedHours: 33 },
  { studentId: 'student-thaddeus-okonkwo', seasonId: PLACEHOLDER_SEASON_ID, confirmedHours: 30 },
  { studentId: 'student-priyanka-ashworth', seasonId: PLACEHOLDER_SEASON_ID, confirmedHours: 27.5 },
  { studentId: 'student-soren-ekwueme', seasonId: PLACEHOLDER_SEASON_ID, confirmedHours: 24 },
  { studentId: 'student-ines-falkenrath', seasonId: PLACEHOLDER_SEASON_ID, confirmedHours: 21.5 },
  { studentId: 'student-callum-vasquez', seasonId: PLACEHOLDER_SEASON_ID, confirmedHours: 19 },
  { studentId: 'student-naledi-whitcombe', seasonId: PLACEHOLDER_SEASON_ID, confirmedHours: 16.5 },
  // 11th-place row -- must be trimmed by slice(0, 10).
  { studentId: 'student-dashiell-ptak', seasonId: PLACEHOLDER_SEASON_ID, confirmedHours: 5 },
  // A different season entirely, with hours higher than every current-
  // season row -- if season-scoping were broken (or vestigial), this
  // student would wrongly rank #1. Proves the filter is load-bearing.
  {
    studentId: 'student-marguerite-thistlewood',
    seasonId: OTHER_SEASON_ID,
    confirmedHours: 500,
  },
];

// ---------------------------------------------------------------------------
// Pure functions -- exported for direct testing. Module docs #2/#3.
// ---------------------------------------------------------------------------

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Rounds an already-final `confirmedHours` number for display only --
 * never recomputes hours from any lower-level input (module doc #2). */
export function roundForDisplay(confirmedHours: number): number {
  return round1(confirmedHours);
}

/**
 * Joins `v_student_hours`-shaped rows against the roster's `display_name`,
 * filters to one season, then ranks by `confirmedHours` descending and
 * takes the top `limit` (module doc #2: sort + slice over an already-
 * computed number, never a re-derivation of the formula itself). Rows
 * whose `studentId` has no matching roster entry are skipped (an orphan
 * hours row with nothing to render a name for).
 */
export function topStudentsByHours(
  hours: readonly LeaderboardHoursRow[],
  students: readonly LeaderboardStudentFixture[],
  seasonId: string,
  limit: number = TOP_STUDENT_LIMIT,
): LeaderboardEntry[] {
  const studentById = new Map(students.map((student) => [student.id, student] as const));
  const entries: LeaderboardEntry[] = [];
  for (const row of hours) {
    if (row.seasonId !== seasonId) continue;
    const student = studentById.get(row.studentId);
    if (!student) continue;
    entries.push({
      studentId: row.studentId,
      displayName: student.displayName,
      confirmedHours: row.confirmedHours,
    });
  }
  return entries
    .slice()
    .sort((a, b) => b.confirmedHours - a.confirmedHours)
    .slice(0, limit);
}

/** Module doc #5's confirmed OFF-state value -- a fixed, non-identifying
 * string, never derived from any student's real name. */
export const ANONYMIZED_STUDENT_LABEL = 'Anonymous student';

/**
 * The ONLY place a raw `displayName` is ever formatted for render (module
 * doc #3). `isPrivacyOn === true` (the default) returns
 * `"${firstName} ${lastInitial}."` and NEVER the raw last name -- a
 * single-token name (no discoverable last name) falls back to the first
 * token alone, still never fabricating a fake initial. `isPrivacyOn ===
 * false` returns `ANONYMIZED_STUDENT_LABEL` -- module doc #5's confirmed
 * reading (a fully anonymized identifier, not a full-name reveal) -- so
 * `displayName` is never rendered in ANY position of this toggle, not just
 * when privacy is ON.
 */
export function formatDisplayName(displayName: string, isPrivacyOn: boolean): string {
  if (!isPrivacyOn) return ANONYMIZED_STUDENT_LABEL;
  const trimmed = displayName.trim();
  const parts = trimmed.split(/\s+/).filter((part) => part.length > 0);
  if (parts.length === 0) return trimmed;
  const [firstName] = parts;
  if (parts.length === 1) return firstName;
  const lastName = parts[parts.length - 1];
  const lastInitial = lastName.charAt(0).toUpperCase();
  return `${firstName} ${lastInitial}.`;
}

// ---------------------------------------------------------------------------
// Fixture loaders -- obviously-fake defaults for the injectable seams
// (module docs #4/#7).
//
// `defaultLoadLeaderboardData` (`loadData`) remains this component's real
// default -- OUT OF SCOPE for T104 (that task's own Allowed Files wire only
// `loadPrivacySetting`, not `loadData`/`seasonId`; this component's own
// hours/roster data is still fixture-sourced pending a future wiring task,
// same disclosed limitation as before T104).
//
// `defaultLoadPrivacySetting` is T104 UPDATE: no longer the component's
// default `loadPrivacySetting` -- that's now the real, SHARED
// `loadPrivacySetting` from `../../lib/supabase/loaders/leaderboard_privacy`
// (module doc #4 UPDATE). Kept as a named export, fixture literal
// unchanged, for tests that want fixture behavior explicitly.
// ---------------------------------------------------------------------------

export async function defaultLoadLeaderboardData(seasonId: string): Promise<LeaderboardLoadResult> {
  return {
    hours: FIXTURE_HOURS.filter((row) => row.seasonId === seasonId),
    students: FIXTURE_STUDENTS,
  };
}

export async function defaultLoadPrivacySetting(): Promise<boolean> {
  return DEFAULT_PRIVACY_ON;
}

// ---------------------------------------------------------------------------
// Generic load-state hook -- independently reimplemented here (not
// imported), same as every other content page in this batch;
// `OutreachList.tsx` is not in this task's Allowed Files.
// ---------------------------------------------------------------------------

interface LeaderboardData {
  entries: LeaderboardEntry[];
  isPrivacyOn: boolean;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; error: unknown; retry: () => void }
  | { status: 'success'; data: LeaderboardData };

function useLeaderboardData(
  loadData: LoadLeaderboardDataFn,
  loadPrivacySetting: LoadPrivacySettingFn,
  seasonId: string,
): LoadState {
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  // Bumped by the error Banner's "Retry" action (DES-12) to force the effect
  // below to re-run without changing the other deps' semantics.
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setState({ status: 'loading' });
    Promise.all([loadData(seasonId), loadPrivacySetting()])
      .then(([result, isPrivacyOn]) => {
        if (!isMounted) return;
        const entries = topStudentsByHours(result.hours, result.students, seasonId);
        setState({ status: 'success', data: { entries, isPrivacyOn } });
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setState({ status: 'error', error, retry: () => setRetryToken((token) => token + 1) });
        }
      });
    return () => {
      isMounted = false;
    };
  }, [loadData, loadPrivacySetting, seasonId, retryToken]);

  return state;
}

// ---------------------------------------------------------------------------
// Top-level component -- module docs #3/#5/#6.
// ---------------------------------------------------------------------------

export interface LeaderboardProps {
  /** Injectable data-loading seam (module doc #7). Defaults to fixture
   * data (module doc #4 UPDATE: still out of scope for T104, unlike
   * `loadPrivacySetting` below). */
  loadData?: LoadLeaderboardDataFn;
  /** Injectable privacy-setting seam (module doc #4). Defaults to the real,
   * SHARED `loadPrivacySetting`
   * (`../../lib/supabase/loaders/leaderboard_privacy`, module doc #4
   * UPDATE) -- the same function `AdminToggles.tsx` also defaults to. */
  loadPrivacySetting?: LoadPrivacySettingFn;
  seasonId?: string;
}

export function Leaderboard({
  loadData = defaultLoadLeaderboardData,
  loadPrivacySetting = realLoadPrivacySetting,
  seasonId = PLACEHOLDER_SEASON_ID,
}: LeaderboardProps = {}): ReactNode {
  const state = useLeaderboardData(loadData, loadPrivacySetting, seasonId);

  return (
    <Section variant="section" padding={4}>
      <VStack gap={3}>
        <Heading level={2}>Season Volunteer Leaderboard</Heading>

        {state.status === 'loading' && (
          <VStack gap={2} aria-busy="true">
            <VisuallyHidden as="div" role="status">
              Loading leaderboard…
            </VisuallyHidden>
            {[0, 1, 2, 3, 4].map((row) => (
              <HStack key={row} hAlign="between" vAlign="center" gap={3}>
                <Skeleton width={200} height={16} index={row * 2} />
                <Skeleton width={60} height={20} radius="rounded" index={row * 2 + 1} />
              </HStack>
            ))}
          </VStack>
        )}

        {state.status === 'error' && (
          <Banner
            status="error"
            title="Couldn't load the leaderboard"
            description="Something went wrong loading this season's volunteer hours. Try refreshing the page."
            endContent={<Button variant="ghost" label="Retry" onClick={state.retry} />}
          />
        )}

        {state.status === 'success' && (
          <>
            <Text type="supporting" color="secondary">
              {state.data.isPrivacyOn
                ? 'Names are shown as first name and last initial for privacy.'
                : 'Names are fully anonymized.'}
            </Text>
            {state.data.entries.length === 0 ? (
              <EmptyState
                headingLevel={3}
                title="No volunteer hours recorded yet"
                description="Once outreach attendance is confirmed for this season, the top students will show up here."
              />
            ) : (
              <List hasDividers header="Top students by season volunteer hours">
                {state.data.entries.map((entry, index) => (
                  <ListItem
                    key={entry.studentId}
                    label={`${index + 1}. ${formatDisplayName(entry.displayName, state.data.isPrivacyOn)}`}
                    endContent={
                      <Badge
                        variant="neutral"
                        label={`${roundForDisplay(entry.confirmedHours)} hrs`}
                      />
                    }
                  />
                ))}
              </List>
            )}
          </>
        )}
      </VStack>
    </Section>
  );
}

export default Leaderboard;
