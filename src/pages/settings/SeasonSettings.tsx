/**
 * T029: `/settings/season` (SET-04), admin-only: create/edit seasons (name,
 * start/end `DateRangeInput`, default goal hours `NumberInput`), set the
 * active season. PRD line 357 (`VOLT_Portal_PRD.md`): "Season management
 * (admin only, `/settings/season`): create/edit seasons (name, start/end
 * `DateRangeInput`, default goal hours `NumberInput`), set active season.
 * Exactly one active season; switching prompts `AlertDialog`." That literal
 * field order (name -> start/end -> default goal hours) is followed below
 * for the create/edit form, even though constitution item 13's own
 * "exact order" mandate is worded around MTG-02/OUT-02 specifically, not
 * SET-04 -- this task's packet's own Objective line paraphrases SET-04 in
 * that same order, so it is followed here for consistency rather than as a
 * checker-enforced literal requirement.
 *
 * This is a STANDALONE component per this task's packet: `router.tsx` is a
 * forbidden (read-only) file here and its `/settings/season` route is not
 * wired to this component by this task (the same not-yet-built-route
 * reachability gap `RosterShell.tsx`/T021 and every other not-yet-wired page
 * already disclosed -- not re-derived here, just confirmed to apply).
 *
 * -----------------------------------------------------------------------
 * 1. `seasons_single_active_idx` -- the real, already-applied DB constraint
 *    (Dependencies / Known Context/Traps #1) -- cited directly, not
 *    reinvented.
 *
 * `supabase/migrations/20260716000000_identity_roster.sql` lines 40-49
 * define `public.seasons` (`id`, `name`, `starts_on date not null`,
 * `ends_on date not null`, `default_goal_hours numeric not null default
 * 100`, `is_active boolean not null`), and lines 52-55 add a real, applied
 * **partial unique index**:
 *
 *   create unique index seasons_single_active_idx
 *     on public.seasons (is_active)
 *     where is_active = true;
 *
 * This means the database itself already refuses a second `is_active=true`
 * row -- a real INSERT/UPDATE that tried to activate a season while another
 * was still active would hit a unique-violation at the DB layer. Nothing in
 * this file re-implements that constraint (no new migration is written or
 * proposed, per this task's Forbidden Files / constitution item 10). This
 * file's job is purely the **UX** around switching: `withActiveSeason`
 * below (the ONLY place `isActive` is ever mutated in this file) always
 * returns the full row set with exactly ONE row's `isActive` set to `true`
 * and every other row's set to `false` -- it can never produce a state with
 * two active rows or zero active rows once at least one season exists,
 * mirroring the DB index's own invariant in local UI state.
 *
 * The **atomicity contract** the packet asks for lives in
 * `SetActiveSeasonPayload`/`OnSetActiveSeasonFn`: the injectable callback
 * takes ONE payload naming BOTH the season being deactivated
 * (`deactivateSeasonId`, `null` only in the edge case where no season is
 * currently active yet) and the season being activated
 * (`activateSeasonId`) -- there is no separate "deactivate old" call
 * followed by a separate "activate new" call the UI could leave half-done
 * between them. `handleConfirmSetActive` below computes this single payload
 * from the current active row, awaits ONE `onSetActiveSeason(payload)` call,
 * and only then flips local state via `withActiveSeason` -- if the awaited
 * call rejects, local state is never touched (no optimistic half-flip). A
 * real backend implementation (a future wiring task, not this one) is
 * expected to implement `onSetActiveSeason` as a single transaction (e.g. an
 * RPC that runs both UPDATEs together, or two UPDATEs inside one
 * `supabase.rpc`/transaction) so the real `seasons_single_active_idx`
 * constraint is never transiently violated between the two writes either --
 * this file cannot prove that transactional detail (no Supabase client is
 * wired in here, module doc #5 below), but the callback's own shape is
 * deliberately built so a real implementation CAN satisfy it atomically,
 * rather than forcing two separate un-coordinated calls on the caller.
 *
 * -----------------------------------------------------------------------
 * 2. `DateRangeInput` / `NumberInput` citations (Known Context/Traps #2) --
 *    re-verified directly against `astryx-api.md`, not copied blindly from
 *    `ScheduleMeetingsDialog.tsx`/T031's own `DateRangeInput` usage.
 *
 * `DateRangeInput` ("DateRangeInput" Props table, `astryx-api.md` lines
 * 3833-3855): `label`, `value` (`DateRange | null`), `onChange`, `isRequired`,
 * `status`, `presets` used below. T031 (`ScheduleMeetingsDialog.tsx`) used
 * `presets` for a "Next 6 weeks" quick-pick appropriate to a recurring
 * meeting range -- NOT blindly copied here (re-verified against the doc's
 * own "Do: use presets for common ranges" guidance rather than re-using
 * T031's citation verbatim). Instead, `SEASON_DATE_PRESETS` below offers
 * "Current school year" (Aug 1 -> Jun 30, rolling forward once the current
 * month is past July): a genuinely common range for THIS domain -- PRD line
 * 702's own worked example names a `seasons` row spanning a school-year-like
 * range ("2025-2026"), and every fixture season in this file and
 * `AdminToggles.tsx`/T028's own worked reasoning both independently assume
 * an Aug-start/Jun-end program calendar. This is a real, useful quick-pick,
 * not a presets list invented only to make the input easier to drive from a
 * test (an August-June academic year is what most seasons in this program
 * actually look like), though it does also give this file's own test suite
 * the same real-popover-interaction path T031's test suite used, instead of
 * a state-injection shortcut.
 * `status`: `{type: 'error', message}` shown when a picked (non-null) range
 * fails `validateSeasonDateRange` (module doc #4) -- the same documented
 * `{type, message}` shape `TextInput`/`NumberInput` use for `status`, since
 * `DateRangeInput`'s own Props row just aliases it to `InputStatus` without
 * re-spelling the shape inline.
 * `NumberInput` ("NumberInput" Props table, lines 1179-1209): `label`,
 * `value` (`number | null | undefined`), `onChange`, `isRequired`, `min={0}`,
 * `units="hrs"` used. `step`/`isIntegerOnly` left at their documented
 * defaults (`default_goal_hours` is `numeric`, not an integer column, so
 * fractional hours are valid and `isIntegerOnly` is deliberately NOT set).
 *
 * -----------------------------------------------------------------------
 * 3. Create vs. edit: ONE reusable form, explicitly decided (Known Context/
 *    Traps #3) -- disclosed, not silently assumed.
 *
 * SET-04's own text doesn't say whether create/edit share a form. This file
 * uses a single reusable form-dialog rendering region (the "Season form"
 * block inside the one `<Dialog>` below), driven by one `editingSeason:
 * SeasonRow | null` piece of state (`null` = create mode, a real row = edit
 * mode, pre-filled via `openEditForm`). Reasoning: SET-04's three fields
 * (name, dates, default goal hours) are IDENTICAL in both create and edit --
 * there is no field that only appears in one mode (unlike, say, a "change
 * password" flow that might need a current-password field only when editing)
 * -- so a second, near-duplicate dialog component would just be copy-pasted
 * JSX with no behavioral difference beyond the submit branch and the initial
 * field values, which is exactly what `openCreateForm`/`openEditForm` below
 * already parameterize on a single component. This mirrors the more common
 * pattern the packet itself flags as "likely right," stated explicitly here
 * rather than assumed silently.
 *
 * -----------------------------------------------------------------------
 * 4. Season date-range validation (Known Context/Traps #4) -- client-side
 *    only, no DB CHECK constraint exists or is added here.
 *
 * Confirmed directly against `supabase/migrations/20260716000000_identity_
 * roster.sql` lines 42-50: `seasons` has NO `check` constraint relating
 * `starts_on` to `ends_on` (only `not null` on each column individually).
 * `validateSeasonDateRange` below is a pure, exported, independently tested
 * function enforcing "starts_on must be strictly before ends_on" (a
 * same-day season, `start === end`, is treated as invalid -- "before," not
 * "on or before," per the packet's own literal wording) purely client-side,
 * gating the Save/Create button's `isDisabled` (native, no `tooltip` prop,
 * so it is a real disabled `<button>`, not just styled -- same posture
 * `ScheduleMeetingsDialog.tsx`/T031 module doc #5 already established for
 * its own confirm button) and driving `DateRangeInput`'s `status` prop
 * (`{type: 'error', message}`, same documented shape `TextInput`/
 * `NumberInput` use, `astryx-api.md` line 3855's own `status: InputStatus`
 * cross-referenced against the `{type, message}` shape spelled out at e.g.
 * line 1672's `TextInput` `status` row, since `DateRangeInput`'s own
 * `InputStatus` alias isn't spelled out inline at its own Props row).
 *
 * Whether a DB-level `check (starts_on < ends_on)` constraint is ALSO
 * warranted is a genuine, disclosed follow-up question -- this file does
 * NOT add one (migrations are a forbidden file class here, and the packet
 * explicitly says to flag rather than resolve this). Flagged as a possible
 * dispute/follow-up candidate in this task's Required Worker Output, not
 * resolved here.
 *
 * -----------------------------------------------------------------------
 * 5. No shared Supabase client wired in (Known Context/Traps #5) -- same
 *    posture as every prior content page (`StudentsTab.tsx`/T022,
 *    `ScheduleMeetingsDialog.tsx`/T031, `OutreachList.tsx`, etc.).
 *
 * `loadData`/`onCreateSeason`/`onUpdateSeason`/`onSetActiveSeason` are all
 * injectable props, each defaulting to an obviously-fake stub
 * (`defaultLoad*`/`defaultOn*`) that only returns/echoes fixture data or
 * `console.warn`s the payload it would have sent. No `src/lib/supabase/**`
 * import exists anywhere in this file (that directory is read-only/
 * reference-only per this task's Forbidden Files). Because the create-stub
 * never returns a real DB-generated id, `makeLocalSeasonId` below produces a
 * temporary local id for the newly-created row's optimistic list entry only
 * -- a disclosed stand-in a future wiring task's real INSERT (which DOES
 * return a real `id`) replaces, not a schema decision.
 *
 * -----------------------------------------------------------------------
 * 6. Admin-only gating (Acceptance Criteria: "same posture as T028") --
 *    T028 (`src/pages/roster/AdminToggles.tsx`) landed concurrently with this
 *    task (confirmed via a fresh `Glob` immediately before writing this
 *    section) and, on inspection, deliberately does NOT use `RequireRole`:
 *    its own module doc #5 explains that `AdminToggles` is an EMBEDDED WIDGET
 *    inside `RosterShell.tsx`'s already-`RequireRole(['coach', 'admin'])`
 *    `/roster` page, so reusing `RequireRole` there a second time, with a
 *    stricter `['admin']` list, would incorrectly redirect a legitimately-
 *    present `coach` AWAY FROM THE WHOLE PAGE just because that one
 *    admin-only sub-widget happens to be present -- so it reads `useAuth()`
 *    directly and renders `null` instead.
 *
 *    That reasoning does NOT apply here: `SeasonSettings` is not an embedded
 *    widget inside an already-guarded page, it IS the whole page for
 *    `/settings/season` (a standalone, not-yet-wired route, `router.tsx`
 *    read-only here). There is no surrounding page-level guard a
 *    page-level `RequireRole` could conflict with or over-restrict, so this
 *    file follows `RosterShell.tsx`/T021's own WHOLE-PAGE precedent instead
 *    (the one this task's Forbidden Files section explicitly points at
 *    roster/** for, "e.g. for the admin-only gating pattern") -- nesting
 *    `guards.tsx`'s exported `RequireRole` directly in this component's own
 *    render tree (same byte-identical redirect-to-`/` + NAV-06 toast
 *    behavior `router.tsx`'s own `/settings` route, lines 213-222, uses at
 *    the route level for ITS placeholder). `allowedRoles={['admin']}` only
 *    -- SET-04 says "admin only," not "admin or coach," so (unlike
 *    `RosterShell.tsx`'s `['coach', 'admin']`) only `'admin'` is listed,
 *    matching `AdminToggles.tsx`'s own `role === 'admin'` check. `guards.tsx`'s
 *    `Role` union now matches AUTH-05's real `admin | coach | student |
 *    parent` vocabulary exactly (fixed by T073a; previously a stale T005
 *    placeholder, `'admin' | 'staff' | 'volunteer' | 'coach'` -- same gap
 *    `RosterShell.tsx`/`AdminToggles.tsx` already flagged, now likewise
 *    resolved), so `allowedRoles={['admin']}` continues to read correctly.
 *
 * -----------------------------------------------------------------------
 * 7. DES-12 four states (loading / error / empty / populated) -- same
 *    generic `useLoadState` hook shape every prior content page in this
 *    batch already established, necessarily reimplemented locally (not
 *    imported) since none of those sibling files are in this task's Allowed
 *    Files.
 *
 * -----------------------------------------------------------------------
 * 8. Astryx prop sourcing (constitution item 2) -- every prop used below,
 *    grepped live against `docs/swarm/astryx-api.md` for this task:
 *
 *  - `Table` ("Table" Props table, lines 738-753): `data`, `columns`,
 *    `idKey`, `density`, `dividers`, `hasHover` used. `columns` entries use
 *    only the closed `{key, header, width, align, renderCell}` shape.
 *  - `pixel`/`proportional` (same "Table" section) used for column widths.
 *  - `Badge` ("Badge" Props table, lines 526-533): `variant` (`'success'`,
 *    only on the one currently-active row -- Badge's own "Don't apply a
 *    success badge to every healthy/active item" guidance is respected
 *    because exactly one row ever carries it, never all of them), `label`
 *    used.
 *  - `AlertDialog` ("AlertDialog" Props table, lines 2518-2530): `isOpen`,
 *    `onOpenChange`, `title`, `description`, `actionLabel`, `onAction`,
 *    `isActionLoading` used.
 *  - `Dialog` ("Dialog" Props table, lines 2400-2412): `isOpen`,
 *    `onOpenChange`, `children`, `purpose="form"` used (module doc's own
 *    "Do: use purpose=form for dialogs with inputs" guidance).
 *  - `DialogHeader`: doc's own "Components > DialogHeader" subsection (lines
 *    2416-2418) is `undefined` -- same disclosed gap `ScheduleMeetingsDialog
 *    .tsx`/T031 already hit; resolved identically via the "Dialog" section's
 *    own worked `## Example` code block (`title`, `onOpenChange`).
 *  - `Layout`/`LayoutContent`/`LayoutFooter` ("Layout" Props table, lines
 *    257-266, `header`/`content`/`footer` used on `Layout`; `LayoutContent`/
 *    `LayoutFooter`'s own Components subsections are `undefined`, resolved
 *    via `node_modules/@astryxdesign/core/dist/Layout/LayoutContent.d.ts` /
 *    `LayoutFooter.d.ts`, confirmed directly, same posture T031 took):
 *    `children` (`LayoutContent`); `children`, `hasDivider` (`LayoutFooter`).
 *  - `FormLayout` ("FormLayout" Props table, lines 4158-4164): `children`
 *    used (default `direction="vertical"`, matching "Do: stack fields
 *    vertically for most forms").
 *  - `TextInput` ("TextInput" Props table, lines 1652-1675): `label`,
 *    `value`, `onChange`, `isRequired`, `placeholder` used.
 *  - `DateRangeInput`/`NumberInput`: see module doc #2 above.
 *  - `Button` ("Button" Props table, lines 1807-1827): `label`, `variant`,
 *    `size`, `isDisabled`, `isLoading`, `onClick`, `clickAction` used
 *    (module doc #4 -- deliberately no `tooltip` on disabled confirm
 *    buttons, so they stay natively `disabled`).
 *  - `Banner` ("Banner" Props table, lines 2749-2763): `status`, `title`,
 *    `description`, `isDismissable`, `onDismiss` used.
 *  - `MoreMenu` ("MoreMenu" Props table, lines 4807-4817): `items`, `label`
 *    used.
 *  - `EmptyState` ("EmptyState" Props table, lines 3991-4001): `title`,
 *    `description`, `actions` used -- UNLIKE `RosterShell.tsx`/
 *    `StudentsTab.tsx` (which both deliberately omit `actions` because no
 *    real create flow exists on those pages yet), this page DOES have a
 *    real "Create season" flow, so offering it from the empty state is a
 *    genuine next step, not a fabricated button with nowhere to go.
 *  - `Spinner` ("Spinner" Props table, lines 5832-5840): `label` used.
 *  - `Heading`: own `astryx-api.md` "Components > Heading" subsection is
 *    `undefined` (lines 882-884) -- same disclosed CLI-cross-checked gap
 *    `RosterShell.tsx`/T021 and every other content page already resolved
 *    identically (`npm run astryx -- component Heading`: `level`,
 *    `children`, both required). `level={1}` used once (this page's only
 *    heading), `level={2}`/`level={3}` for the dialog's own subheadings
 *    would skip nothing since no h1 already exists inside the dialog's own
 *    subtree -- `Heading` is NOT used inside the dialog at all here (the
 *    dialog's title comes from `DialogHeader`'s own `title` prop instead),
 *    so no heading-level-skip risk exists there.
 *  - `Text` ("Text" Props table, lines 858-878): `type`, `weight`,
 *    `hasTabularNumbers`, `color` used.
 *  - `HStack`/`VStack` ("Stack" section, lines 350-372 / 374-396): `gap`,
 *    `padding`, `vAlign`, `hAlign`, `wrap` used.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  AlertDialog,
  Badge,
  Banner,
  Button,
  DateRangeInput,
  Dialog,
  DialogHeader,
  type DropdownMenuOption,
  EmptyState,
  FormLayout,
  Heading,
  HStack,
  Layout,
  LayoutContent,
  LayoutFooter,
  MoreMenu,
  NumberInput,
  pixel,
  proportional,
  Spinner,
  Table,
  type TableColumn,
  Text,
  TextInput,
  VStack,
  type DateRange,
} from '@astryxdesign/core';
import { RequireRole } from '../../app/guards';

// ---------------------------------------------------------------------------
// Types -- verbatim camelCase rename of the real `seasons` columns (module
// doc #1). `extends Record<string, unknown>` is required by `Table`'s own
// generic constraint (astryx-api.md "Table" Props table, `data: T[]`
// description), same posture `StudentsTab.tsx`'s `StudentDisplayRow` used.
// ---------------------------------------------------------------------------

export interface SeasonRow extends Record<string, unknown> {
  id: string;
  name: string;
  /** ISO date string, `seasons.starts_on`. */
  startsOn: string;
  /** ISO date string, `seasons.ends_on`. */
  endsOn: string;
  defaultGoalHours: number;
  isActive: boolean;
}

export type LoadSeasonsFn = () => Promise<SeasonRow[]>;

export interface CreateSeasonPayload {
  name: string;
  startsOn: string;
  endsOn: string;
  defaultGoalHours: number;
}

export type OnCreateSeasonFn = (payload: CreateSeasonPayload) => Promise<void>;

export interface UpdateSeasonPayload extends CreateSeasonPayload {
  id: string;
}

export type OnUpdateSeasonFn = (payload: UpdateSeasonPayload) => Promise<void>;

/**
 * Module doc #1 -- the atomicity contract. `deactivateSeasonId` is `null`
 * only when no season was previously active (e.g. activating the very first
 * season ever created); otherwise it always names the exact-one currently
 * active row, since `seasons_single_active_idx` guarantees at most one can
 * exist.
 */
export interface SetActiveSeasonPayload {
  activateSeasonId: string;
  deactivateSeasonId: string | null;
}

export type OnSetActiveSeasonFn = (payload: SetActiveSeasonPayload) => Promise<void>;

export interface SeasonFormValues {
  name: string;
  /**
   * `DateRangeInput`'s own `value` prop type (`astryx-api.md` "DateRangeInput"
   * Props table): `start`/`end` are the branded `ISODateString` template
   * literal type, not plain `string` -- kept as the real `DateRange` type
   * here (rather than a loosened `{start: string; end: string}`) so the
   * value flows straight from `onChange` without a lossy reconstruction.
   */
  dateRange: DateRange | null;
  defaultGoalHours: number | null;
}

export type SeasonFormMode = 'create' | 'edit';

// ---------------------------------------------------------------------------
// Fixture data (constitution item 6: fabricated names only, no PII). Exists
// ONLY as the default argument to `defaultLoadSeasons` (module doc #5).
// ---------------------------------------------------------------------------

const FIXTURE_SEASONS: readonly SeasonRow[] = [
  {
    id: 'season-2025-2026',
    name: '2025-2026 Season',
    startsOn: '2025-08-01',
    endsOn: '2026-06-30',
    defaultGoalHours: 100,
    isActive: true,
  },
  {
    id: 'season-2024-2025',
    name: '2024-2025 Season',
    startsOn: '2024-08-01',
    endsOn: '2025-06-30',
    defaultGoalHours: 90,
    isActive: false,
  },
];

const DEFAULT_GOAL_HOURS = 100;

/**
 * Module doc #2 -- `DateRangeInput`'s own documented `presets` prop. "Current
 * school year" is a genuinely common range for this domain (Aug 1 -> Jun 30
 * of the following year, rolling forward once the current month is past
 * July), not a presets list invented only for test-drivability.
 */
export function computeCurrentSchoolYearRange(): DateRange {
  const now = new Date();
  const currentYear = now.getUTCFullYear();
  const currentMonth = now.getUTCMonth() + 1; // 1-12
  const startYear = currentMonth >= 8 ? currentYear : currentYear - 1;
  const endYear = startYear + 1;
  return { start: `${startYear}-08-01`, end: `${endYear}-06-30` } as DateRange;
}

const SEASON_DATE_PRESETS: ReadonlyArray<{ label: string; getRange: () => DateRange }> = [
  { label: 'Current school year', getRange: computeCurrentSchoolYearRange },
];

// ---------------------------------------------------------------------------
// Pure functions -- exported for direct testing. Module docs #1/#3/#4.
// ---------------------------------------------------------------------------

/**
 * Module doc #4: `starts_on` must be strictly BEFORE `ends_on` -- a
 * same-day range (`start === end`) is invalid. ISO `'YYYY-MM-DD'` strings
 * compare correctly with plain string comparison (lexicographic order
 * matches chronological order for that format).
 */
export function validateSeasonDateRange(range: { start: string; end: string } | null): boolean {
  if (range === null) return false;
  return range.start.length > 0 && range.end.length > 0 && range.start < range.end;
}

export function isSeasonFormValid(values: SeasonFormValues): boolean {
  return (
    values.name.trim() !== '' &&
    validateSeasonDateRange(values.dateRange) &&
    values.defaultGoalHours !== null &&
    values.defaultGoalHours >= 0
  );
}

/** Returns `null` when `values` is not yet valid -- callers gate on this. */
export function buildCreateSeasonPayload(values: SeasonFormValues): CreateSeasonPayload | null {
  if (!isSeasonFormValid(values) || values.dateRange === null || values.defaultGoalHours === null) {
    return null;
  }
  return {
    name: values.name.trim(),
    startsOn: values.dateRange.start,
    endsOn: values.dateRange.end,
    defaultGoalHours: values.defaultGoalHours,
  };
}

export function buildUpdateSeasonPayload(
  id: string,
  values: SeasonFormValues,
): UpdateSeasonPayload | null {
  const base = buildCreateSeasonPayload(values);
  return base === null ? null : { id, ...base };
}

export function computeSeasonFormConfirmLabel(mode: SeasonFormMode): string {
  return mode === 'create' ? 'Create season' : 'Save changes';
}

/**
 * Module doc #1: the ONLY place `isActive` is ever mutated in this file.
 * Always returns the full row set with EXACTLY ONE row's `isActive` set to
 * `true` (the target) and every other row set to `false` -- mirrors
 * `seasons_single_active_idx`'s own "at most one active" invariant in local
 * UI state, never removes a row.
 */
export function withActiveSeason(rows: readonly SeasonRow[], targetId: string): SeasonRow[] {
  return rows.map((row) => ({ ...row, isActive: row.id === targetId }));
}

export interface ActivateConfirmCopy {
  title: string;
  description: string;
}

/** Module doc #1: the ONLY place the switch-confirmation copy is produced. */
export function computeActivateConfirmCopy(
  currentActive: SeasonRow | null,
  target: SeasonRow,
): ActivateConfirmCopy {
  const title = `Set "${target.name}" as the active season?`;
  const description =
    currentActive === null
      ? `"${target.name}" will become the active season. No other season is currently active.`
      : `"${currentActive.name}" will be deactivated and "${target.name}" will become the active season, in one action -- only one season can be active at a time.`;
  return { title, description };
}

/**
 * Module doc #5: a temporary local id for a newly-created row's optimistic
 * list entry, since `defaultOnCreateSeason` never returns a real
 * DB-generated id. Not a schema/id-generation decision -- a disclosed
 * stand-in a future wiring task's real INSERT replaces.
 */
export function makeLocalSeasonId(): string {
  return `season-local-${Math.random().toString(36).slice(2, 10)}`;
}

export async function defaultLoadSeasons(): Promise<SeasonRow[]> {
  return [...FIXTURE_SEASONS];
}

export const defaultOnCreateSeason: OnCreateSeasonFn = async (payload) => {
  console.warn(
    '[SeasonSettings] No Supabase client wired in yet (module doc #5) -- ' +
      'this stub only logs the seasons INSERT payload that would have been sent.',
    payload,
  );
};

export const defaultOnUpdateSeason: OnUpdateSeasonFn = async (payload) => {
  console.warn(
    '[SeasonSettings] No Supabase client wired in yet (module doc #5) -- ' +
      'this stub only logs the seasons UPDATE payload that would have been sent.',
    payload,
  );
};

export const defaultOnSetActiveSeason: OnSetActiveSeasonFn = async (payload) => {
  console.warn(
    '[SeasonSettings] No Supabase client wired in yet (module doc #5) -- ' +
      'this stub only logs the deactivate-old+activate-new payload a real ' +
      'transaction would have applied atomically (module doc #1, ' +
      'seasons_single_active_idx).',
    payload,
  );
};

// ---------------------------------------------------------------------------
// Generic DES-12 load-state hook. Module doc #7.
// ---------------------------------------------------------------------------

type LoadState<T> =
  { status: 'loading' } | { status: 'error'; error: unknown } | { status: 'success'; data: T };

function useLoadState<T>(load: () => Promise<T>, deps: readonly unknown[]): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading' });

  useEffect(() => {
    let isMounted = true;
    setState({ status: 'loading' });
    load()
      .then((data) => {
        if (isMounted) setState({ status: 'success', data });
      })
      .catch((error: unknown) => {
        if (isMounted) setState({ status: 'error', error });
      });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `deps` is the caller-supplied dependency list.
  }, deps);

  return state;
}

// ---------------------------------------------------------------------------
// Table columns. Module doc #8.
// ---------------------------------------------------------------------------

interface BuildColumnsArgs {
  onEdit: (row: SeasonRow) => void;
  onRequestSetActive: (row: SeasonRow) => void;
}

function buildRowMenuItems(row: SeasonRow, args: BuildColumnsArgs): DropdownMenuOption[] {
  const items: DropdownMenuOption[] = [{ label: 'Edit', onClick: () => args.onEdit(row) }];
  if (!row.isActive) {
    items.push({ label: 'Set active', onClick: () => args.onRequestSetActive(row) });
  }
  return items;
}

function buildColumns(args: BuildColumnsArgs): TableColumn<SeasonRow>[] {
  return [
    {
      key: 'name',
      header: 'Season',
      width: proportional(2),
      renderCell: (row) => (
        <HStack gap={2} vAlign="center">
          <Text weight="semibold">{row.name}</Text>
          {row.isActive && <Badge variant="success" label="Active" />}
        </HStack>
      ),
    },
    {
      key: 'dates',
      header: 'Dates',
      width: proportional(2),
      renderCell: (row) => <Text hasTabularNumbers>{`${row.startsOn} to ${row.endsOn}`}</Text>,
    },
    {
      key: 'defaultGoalHours',
      header: 'Default goal hours',
      width: pixel(180),
      align: 'end',
      renderCell: (row) => <Text hasTabularNumbers>{`${row.defaultGoalHours} hrs`}</Text>,
    },
    {
      key: 'actions',
      header: '',
      width: pixel(64),
      align: 'end',
      renderCell: (row) => (
        <MoreMenu items={buildRowMenuItems(row, args)} label={`Actions for ${row.name}`} />
      ),
    },
  ];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const EMPTY_ROWS: SeasonRow[] = [];

export interface SeasonSettingsProps {
  /** Injectable data-loading seam (module doc #5). Defaults to fixture data. */
  loadData?: LoadSeasonsFn;
  /** Injectable create seam (module doc #5). Defaults to a `console.warn` stub. */
  onCreateSeason?: OnCreateSeasonFn;
  /** Injectable update seam (module doc #5). Defaults to a `console.warn` stub. */
  onUpdateSeason?: OnUpdateSeasonFn;
  /**
   * Injectable atomic switch seam (module doc #1). Defaults to a
   * `console.warn` stub. See `SetActiveSeasonPayload` for the
   * deactivate-old + activate-new contract.
   */
  onSetActiveSeason?: OnSetActiveSeasonFn;
}

export function SeasonSettings({
  loadData = defaultLoadSeasons,
  onCreateSeason = defaultOnCreateSeason,
  onUpdateSeason = defaultOnUpdateSeason,
  onSetActiveSeason = defaultOnSetActiveSeason,
}: SeasonSettingsProps = {}): ReactNode {
  const loadState = useLoadState(loadData, [loadData]);
  const [rows, setRows] = useState<SeasonRow[]>(EMPTY_ROWS);

  useEffect(() => {
    if (loadState.status === 'success') setRows(loadState.data);
  }, [loadState]);

  // ---- Create/edit form dialog state (module doc #3: one reusable form). ----
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingSeason, setEditingSeason] = useState<SeasonRow | null>(null);
  const [formValues, setFormValues] = useState<SeasonFormValues>({
    name: '',
    dateRange: null,
    defaultGoalHours: DEFAULT_GOAL_HOURS,
  });
  const [isSubmittingForm, setIsSubmittingForm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const formMode: SeasonFormMode = editingSeason === null ? 'create' : 'edit';
  const dialogTitle = formMode === 'create' ? 'Create season' : 'Edit season';
  const confirmLabel = computeSeasonFormConfirmLabel(formMode);
  const isFormValid = isSeasonFormValid(formValues);
  const showDateRangeError =
    formValues.dateRange !== null && !validateSeasonDateRange(formValues.dateRange);

  function openCreateForm(): void {
    setEditingSeason(null);
    setFormValues({ name: '', dateRange: null, defaultGoalHours: DEFAULT_GOAL_HOURS });
    setFormError(null);
    setIsFormOpen(true);
  }

  function openEditForm(row: SeasonRow): void {
    setEditingSeason(row);
    setFormValues({
      name: row.name,
      // `SeasonRow.startsOn`/`endsOn` are plain `string` (module doc #1's
      // verbatim `seasons` column rename); a real row's dates are always
      // well-formed ISO dates already satisfying `DateRange`'s branded
      // `ISODateString` shape, so this cast is a type-system formality, not
      // a runtime guess.
      dateRange: { start: row.startsOn, end: row.endsOn } as DateRange,
      defaultGoalHours: row.defaultGoalHours,
    });
    setFormError(null);
    setIsFormOpen(true);
  }

  function closeForm(): void {
    setIsFormOpen(false);
    setEditingSeason(null);
  }

  async function handleSubmitForm(): Promise<void> {
    if (!isFormValid) return; // extra guard; the button is already natively disabled.
    setIsSubmittingForm(true);
    setFormError(null);
    try {
      if (editingSeason === null) {
        const payload = buildCreateSeasonPayload(formValues);
        if (payload === null) return;
        await onCreateSeason(payload);
        const newRow: SeasonRow = { id: makeLocalSeasonId(), ...payload, isActive: false };
        setRows((prev) => [...prev, newRow]);
      } else {
        const payload = buildUpdateSeasonPayload(editingSeason.id, formValues);
        if (payload === null) return;
        await onUpdateSeason(payload);
        setRows((prev) =>
          prev.map((row) =>
            row.id === payload.id
              ? {
                  ...row,
                  name: payload.name,
                  startsOn: payload.startsOn,
                  endsOn: payload.endsOn,
                  defaultGoalHours: payload.defaultGoalHours,
                }
              : row,
          ),
        );
      }
      closeForm();
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Something went wrong saving this season.',
      );
    } finally {
      setIsSubmittingForm(false);
    }
  }

  // ---- Set-active-season AlertDialog state (module doc #1). ----
  const [activateTarget, setActivateTarget] = useState<SeasonRow | null>(null);
  const [isActivating, setIsActivating] = useState(false);
  const [activateError, setActivateError] = useState<string | null>(null);

  const currentActiveRow = useMemo(() => rows.find((row) => row.isActive) ?? null, [rows]);
  const activateConfirmCopy = useMemo(
    () =>
      activateTarget === null ? null : computeActivateConfirmCopy(currentActiveRow, activateTarget),
    [activateTarget, currentActiveRow],
  );

  function requestSetActive(row: SeasonRow): void {
    setActivateError(null);
    setActivateTarget(row);
  }

  async function handleConfirmSetActive(): Promise<void> {
    if (activateTarget === null) return;
    setIsActivating(true);
    const payload: SetActiveSeasonPayload = {
      activateSeasonId: activateTarget.id,
      deactivateSeasonId: currentActiveRow?.id ?? null,
    };
    try {
      await onSetActiveSeason(payload);
      setRows((prev) => withActiveSeason(prev, activateTarget.id));
      setActivateTarget(null);
    } catch (error) {
      setActivateTarget(null);
      setActivateError(
        error instanceof Error
          ? error.message
          : 'Something went wrong switching the active season.',
      );
    } finally {
      setIsActivating(false);
    }
  }

  const columns = buildColumns({
    onEdit: openEditForm,
    onRequestSetActive: requestSetActive,
  });

  if (loadState.status === 'loading') {
    return (
      <RequireRole allowedRoles={['admin']}>
        <VStack gap={4} padding={6}>
          <Spinner label="Loading seasons…" />
        </VStack>
      </RequireRole>
    );
  }

  if (loadState.status === 'error') {
    return (
      <RequireRole allowedRoles={['admin']}>
        <VStack gap={4} padding={6}>
          <Banner
            status="error"
            title="Couldn't load seasons"
            description="Something went wrong loading season settings. Try refreshing the page."
          />
        </VStack>
      </RequireRole>
    );
  }

  return (
    <RequireRole allowedRoles={['admin']}>
      <VStack gap={4} padding={6}>
        <HStack hAlign="between" vAlign="center" wrap="wrap" gap={2}>
          <Heading level={1}>Season settings</Heading>
          <Button label="Create season" variant="primary" onClick={openCreateForm} />
        </HStack>

        {activateError !== null && (
          <Banner
            status="error"
            title="Couldn't switch the active season"
            description={activateError}
            isDismissable
            onDismiss={() => setActivateError(null)}
          />
        )}

        {rows.length === 0 ? (
          <EmptyState
            title="No seasons yet"
            description="Create your first season to start tracking goal hours."
            actions={<Button label="Create season" variant="primary" onClick={openCreateForm} />}
          />
        ) : (
          <Table
            data={rows}
            columns={columns}
            idKey="id"
            density="balanced"
            dividers="rows"
            hasHover
          />
        )}

        <Dialog
          isOpen={isFormOpen}
          onOpenChange={(open) => (open ? setIsFormOpen(true) : closeForm())}
          purpose="form"
        >
          <Layout
            header={
              <DialogHeader
                title={dialogTitle}
                onOpenChange={(open) => (open ? setIsFormOpen(true) : closeForm())}
              />
            }
            content={
              <LayoutContent>
                <FormLayout>
                  {/* Field order per SET-04's own literal text (module doc,
                      top of file): name -> start/end DateRangeInput ->
                      default goal hours NumberInput. */}
                  <TextInput
                    label="Season name"
                    value={formValues.name}
                    onChange={(value) => setFormValues((prev) => ({ ...prev, name: value }))}
                    isRequired
                    placeholder="e.g. 2026-2027 Season"
                  />

                  <DateRangeInput
                    label="Season dates"
                    value={formValues.dateRange}
                    onChange={(value) => setFormValues((prev) => ({ ...prev, dateRange: value }))}
                    isRequired
                    presets={SEASON_DATE_PRESETS}
                    status={
                      showDateRangeError
                        ? { type: 'error', message: 'End date must be after the start date.' }
                        : undefined
                    }
                  />

                  <NumberInput
                    label="Default goal hours"
                    value={formValues.defaultGoalHours}
                    onChange={(value) =>
                      setFormValues((prev) => ({ ...prev, defaultGoalHours: value }))
                    }
                    isRequired
                    min={0}
                    units="hrs"
                  />

                  {formError !== null && (
                    <Banner
                      status="error"
                      title="Couldn't save this season"
                      description={formError}
                    />
                  )}
                </FormLayout>
              </LayoutContent>
            }
            footer={
              <LayoutFooter hasDivider>
                <HStack hAlign="end" gap={2}>
                  <Button label="Cancel" variant="secondary" onClick={closeForm} />
                  <Button
                    label={confirmLabel}
                    variant="primary"
                    isDisabled={!isFormValid || isSubmittingForm}
                    isLoading={isSubmittingForm}
                    clickAction={handleSubmitForm}
                  />
                </HStack>
              </LayoutFooter>
            }
          />
        </Dialog>

        <AlertDialog
          isOpen={activateTarget !== null}
          onOpenChange={(open) => {
            if (!open) setActivateTarget(null);
          }}
          title={activateConfirmCopy?.title ?? ''}
          description={activateConfirmCopy?.description ?? ''}
          actionLabel="Set active"
          onAction={handleConfirmSetActive}
          isActionLoading={isActivating}
        />
      </VStack>
    </RequireRole>
  );
}

export default SeasonSettings;
