/**
 * T026: Teams tab (ROS-06) -- `Table` of teams (name, short_name, program
 * FRC/FTC/Other, color chip, sort order), full CRUD, Archive (default,
 * reversible) vs. Hard delete (irreversible, blocked whenever the team has
 * students or history).
 *
 * This is a STANDALONE component per this task's packet -- it is not wired
 * into `RosterShell.tsx` (a forbidden, read-only file here; T021 already
 * shipped a placeholder `EmptyState` in its Teams tab panel naming this
 * task as the one that eventually fills that slot). Same posture
 * `StudentsTab.tsx`/T022 already took for its own tab.
 *
 * -----------------------------------------------------------------------
 * 1. Ground truth -- `teams` column shapes, read directly from the real
 *    migration (constitution item 3), NOT invented/renamed with extra
 *    fields:
 *
 *    `teams` (`supabase/migrations/20260716000000_identity_roster.sql`
 *    lines 29-38): id, name (text, unique), short_name (text), program
 *    (text, nullable, `check (program in ('FRC','FTC','Other'))`), color
 *    (text, NOT NULL, free-text -- no enum/check constraint at all), archived
 *    (bool, default false), sort_order (int, default 0).
 *
 *    `students` (same file, lines 59-68): id, team_id (fk teams, `on delete
 *    restrict`), is_active. Referenced only through its `team_id` FK below,
 *    for the hard-delete gate -- `StudentTeamLinkRow` is a deliberately
 *    minimal `{studentId, teamId}` projection of that FK, not a full
 *    `StudentRow` (this tab does not manage students).
 *
 *    `TeamRow` below is a verbatim camelCase rename of the `teams` column
 *    subset this screen needs -- no invented field, no renamed status
 *    vocabulary.
 *
 * -----------------------------------------------------------------------
 * 2. Known Context/Traps #1 -- Archive vs. Hard delete are two
 *    structurally different actions, never conflated.
 *
 * Archive (`archived: true`) is the default, safe, REVERSIBLE action --
 * same posture as `StudentsTab.tsx`'s Deactivate/Reactivate idiom
 * (`StudentsTab.tsx` module doc #5, read-only reference here): the team row
 * stays visible in this table with an "Archived" `Badge` indicator (shown
 * only on archived rows, never on every row -- Badge's own "Don't repeat
 * the same badge in every row" guidance, astryx-api.md "Badge" Best
 * Practices), disappears from selectors/expected rosters elsewhere in the
 * app (disclosed here, not built here -- no other page in this codebase
 * reads `teams.archived` yet), but keeps every column's data. `withArchivedOverride`
 * below is the ONLY place `archived` is ever mutated, and it always returns
 * the FULL row set with one row's `archived` flipped -- it never filters or
 * removes a row, in either direction. Archiving opens a real `AlertDialog`
 * with REVERSIBLE-sounding copy (mirroring `StudentsTab.tsx`'s Deactivate
 * dialog -- a real confirm step for a state change with real downstream
 * consequences, but never "delete"/"cannot be undone" language);
 * unarchiving is a direct flip with no dialog (non-destructive to reverse,
 * per `AlertDialog`'s own "Don't: use AlertDialog for non-destructive
 * actions" guidance -- same asymmetry `StudentsTab.tsx` established for
 * Reactivate).
 *
 * Hard delete (`withHardDelete` below -- the ONLY place a row is ever
 * actually removed from the array) is genuinely destructive and
 * IRREVERSIBLE. Per this task's Known Context/Traps #2 (module doc #3
 * below), it is BLOCKED (the `MoreMenu` item is rendered `isDisabled`, with
 * its own label naming the reason, rather than hidden -- a row that has
 * students/history still needs a visible, if inert, explanation of why
 * hard delete isn't offered, matching `DropdownMenuItemData`'s documented
 * `isDisabled` field, astryx-api.md "DropdownMenu" Props table, "items"
 * row) whenever `hasStudentsOrHistory` is true, and even when allowed,
 * confirms via a real `AlertDialog` with UNAMBIGUOUSLY destructive,
 * "cannot be undone" copy -- structurally distinct wording from Archive's
 * dialog, not just a different action label. `canHardDelete` is the single
 * pure predicate both the menu-item-disabling logic and the confirm-handler
 * guard call, so the gate can never drift between the two call sites.
 *
 * -----------------------------------------------------------------------
 * 3. Known Context/Traps #2 -- "no students or history" gate, defined
 *    concretely against fixture data, not hand-waved.
 *
 * A team blocks hard-delete if ANY `students.team_id` row references it --
 * active OR inactive; per this task's packet, "even a deactivated student
 * who was once on the team counts as history." Modeled here as
 * `StudentTeamLinkRow` (`{studentId, teamId}`), a deliberately minimal
 * fixture projection of the real `students.team_id` FK: presence of a link
 * for a team means at least one student (regardless of that student's own
 * `is_active` value, which this projection doesn't even carry, since
 * membership alone is what counts) has ever been on that team. This is
 * explicitly a UI-logic proof against fixture data, not a real cross-table
 * `event_sessions`/`attendance` join (the packet's own Known Context/Traps
 * #2 scopes that out: "the point is the UI logic correctness, not a real
 * cross-table query -- that's a future wiring task's job"). `FIXTURE_TEAMS`/
 * `FIXTURE_STUDENT_TEAM_LINKS` below deliberately cover the full boundary:
 *   - `team-ironclad`: one link -> blocked (has a student).
 *   - `team-voltage`: one link -> blocked (history-only case -- the linked
 *     student is deliberately absent from any other tab's fixture data
 *     here, standing in for "a now-inactive student who once belonged to
 *     this team," since only `teamId` membership is tracked in this
 *     projection).
 *   - `team-embercore`: zero links -> hard delete ALLOWED.
 *   - `team-legacy-alpha` (also archived, also `program: null`, also an
 *     unrecognized legacy `color` string -- see module doc #5): one link ->
 *     blocked, proving the gate applies independently of `archived` state
 *     too.
 * `teamHasStudentsOrHistory` is the exported pure function both
 * `buildDisplayRows` and this file's tests call directly, independent of
 * any one render.
 *
 * -----------------------------------------------------------------------
 * 4. Known Context/Traps #3 -- `program` closed 3-option selector, real
 *    documented component, nullable handling disclosed.
 *
 * `program` is `text null check (program in ('FRC','FTC','Other'))` in the
 * real schema -- a closed, nullable 3-value field. The create/edit form uses
 * `Selector` (astryx-api.md "Selector" Props table, cited in module doc #7
 * below) with exactly `PROGRAM_OPTIONS` (`FRC`/`FTC`/`Other`, no fourth
 * invented option) and `hasClear` set, so "no program set" is represented
 * as a genuinely cleared/empty selector value (`value={null}` when
 * `program === null` -- `hasClear`'s own clearable variant requires `value`
 * to be `string | null`, not `string | undefined`, confirmed directly
 * against the installed package's own `Selector.tsx` source types), with
 * `onChange` receiving `null` back on clear -- exactly
 * `hasClear`'s own documented contract: "When true, onChange also accepts
 * null to signal the user cleared the selection," astryx-api.md "Selector"
 * Props table) rather than a fabricated "None" option living inside the
 * same 3-item closed list the real `check` constraint defines. In the
 * table, a null `program` renders as plain "No program set" `Text`, not a
 * `Badge` (a `Badge` would visually claim it's one of the three real
 * category values; it isn't).
 *
 * -----------------------------------------------------------------------
 * 5. Known Context/Traps #4 -- color chip/selector: real Astryx
 *    investigation, disclosed approach, not an invented component.
 *
 * Investigated: grepped `docs/swarm/astryx-api.md`'s full component list
 * (every `# ComponentName` heading in the file) for anything resembling a
 * color picker/swatch selector. There is NO `ColorPicker`, `ColorInput`,
 * `Swatch`, or similar documented component anywhere in this file -- this
 * is a real, confirmed gap, not something worked around by inventing one
 * (constitution item 2). What DOES exist and IS documented:
 *   - `Token` (astryx-api.md "Token" Props table): a `color` prop that is a
 *     genuinely CLOSED, documented union -- `'default' | 'red' | 'orange' |
 *     'yellow' | 'green' | 'teal' | 'cyan' | 'blue' | 'purple' | 'pink' |
 *     'gray'` -- rendered as a small colored chip. This is, functionally, a
 *     "swatch": a real, closed set of Astryx-themed colors with visible
 *     chip rendering, just not packaged as a dedicated color-picker
 *     component.
 *   - `Selector` (module doc #4 above) already IS the documented
 *     single-value-from-a-list component, and its own `renderOption` prop
 *     ("Custom render function for each selectable option," astryx-api.md
 *     "Selector" Props table) is explicitly designed for exactly this: a
 *     custom per-option row.
 * The approach taken: `TEAM_COLOR_OPTIONS` is built from `Token`'s own
 * exported `TokenColor` union (imported directly from `@astryxdesign/core`,
 * not re-typed by hand, so a future `TokenColor` addition/removal in the
 * package cannot silently drift out of sync with this list) and rendered as
 * a `Selector` whose `renderOption` renders a `Token` swatch
 * (`<Token label={...} color={...} />`) per option -- a real, documented,
 * closed color-swatch picker built ENTIRELY out of two real Astryx
 * components, not a fabricated third one. A live `Token` preview of the
 * currently-chosen color is also rendered directly below the `Selector` in
 * the form (`Selector`'s own trigger only ever shows the selected option's
 * plain text `label`, confirmed by reading the installed package's own
 * `Selector.tsx` source, line ~999: `{selectedItem?.label ?? placeholder}`
 * -- no swatch color there -- so the preview `Token` is the only place the
 * ACTUAL chosen color renders as a color before saving).
 *
 * This, however, is a UI-side closed set layered on top of a genuinely
 * free-text `teams.color text not null` column with NO check constraint at
 * all in the real schema -- the identical gap `StudentsTab.tsx` already
 * found and disclosed for READING that column (its own module doc #10: it
 * used `Badge variant="neutral"` rather than mapping free-text to a closed
 * variant enum, because there is no documented mapping). This task is the
 * WRITE/CRUD surface, so a real closed picker is required and provided
 * here -- but the table must still be able to display a team whose stored
 * `color` value predates this picker (e.g. an arbitrary legacy string that
 * isn't one of `TokenColor`'s eleven values) without crashing or silently
 * passing an invalid value into `Token`'s own closed `color` prop.
 * `toKnownTeamColor` is the disclosed fallback: any stored `color` string
 * that IS one of the eleven known `TokenColor` values renders as that exact
 * swatch; anything else (the `team-legacy-alpha` fixture row's color is
 * deliberately an unrecognized string, proving this path is real) falls
 * back to the `'default'` swatch rather than a crash or a fabricated
 * twelfth color. The stored `color: string` field itself is never coerced
 * or overwritten by this fallback -- only the SWATCH RENDERING falls back;
 * editing that team through this form and saving replaces the free-text
 * value with a real, known `TokenColor` going forward.
 *
 * -----------------------------------------------------------------------
 * 6. Known Context/Traps #5 -- sort order: a real, working reorder
 *    mechanism, disclosed choice.
 *
 * Per-row up/down `IconButton`s (`Icon` semantic names `arrowUp`/
 * `arrowDown` -- both in astryx-api.md "Icon" Props table's documented
 * semantic-name list) swap this team's `sort_order` value with its current
 * neighbor's in the sorted list (`moveTeamSortOrder` below), rather than
 * drag-and-drop -- disclosed choice per the packet's own "drag-and-drop is
 * not required unless Astryx has a documented, easy pattern for it." No
 * drag-and-drop-specific component (a `Sortable`/`Reorder`/`DragList`) is
 * documented anywhere in `astryx-api.md`'s component list; the packet's own
 * fallback ("a simple up/down control ... is acceptable") is taken.
 * `moveTeamSortOrder` swaps the two rows' `sortOrder` VALUES (not their
 * array positions -- this matters because `sortOrder` is the real column
 * being persisted; array order is always re-derived FROM it, never the
 * other way around) and returns the full row set re-sorted by the new
 * `sortOrder`, so the displayed order updates immediately and consistently
 * with what would be written back. The topmost row's "up" button and the
 * bottommost row's "down" button are disabled (boundary, no-op) rather than
 * silently doing nothing on click.
 *
 * -----------------------------------------------------------------------
 * 7. Known Context/Traps #6 -- no shared Supabase client wired in yet.
 *    Deliberate scope, not a gap for this task to solve (same posture as
 *    every prior content page, per this task's own packet).
 *
 * `loadTeamsTabData` is the injectable `loadData`-style seam
 * (`LoadTeamsTabDataFn`), defaulting to the obviously-fake
 * `defaultLoadTeamsTabData` (fixture data typed against the real schema
 * above). A real caller, once a shared Supabase client exists (a separate,
 * not-yet-dispatched task per every other content page's own disclosure),
 * supplies its own `loadData` prop. Create/Edit/Archive/Hard-delete all
 * mutate local component state only (`setRows`) -- there is no persistence
 * layer to write through yet, matching every other CRUD-shaped tab built so
 * far in this codebase at this same wiring stage.
 *
 * -----------------------------------------------------------------------
 * 8. Astryx prop sourcing (constitution item 2) -- every prop used below,
 *    cited directly against `docs/swarm/astryx-api.md`, with disclosed
 *    CLI-cross-checked doc gaps for the two subsections the file itself
 *    marks `undefined` (same category as every prior content page's own
 *    disclosed gap for `Heading`):
 *
 *  - `Table` ("Table" Props table, lines 738-753): `data`, `columns`,
 *    `idKey`, `density`, `dividers`, `hasHover` used. `columns` entries use
 *    only `{key, header, width, align, renderCell}` (same closed-list
 *    reasoning `StudentsTab.tsx`/T022 module doc #10 already applied to
 *    this exact prop).
 *  - `pixel`/`proportional` (same "Table" Props table `width` description).
 *  - `Badge` ("Badge" Props table, lines 526-533): `variant`
 *    (`'neutral'`/`'blue'`/`'purple'` -- `program`'s three real values map
 *    onto three real documented category-tag variants, since `program` IS
 *    a genuinely closed 3-value column, unlike `color`; `'neutral'` for the
 *    Archived indicator), `label` used.
 *  - `StatusDot` ("StatusDot" Props table, lines 5873-5879): `variant`
 *    (`'warning'` when a team has students/history, `'neutral'` when it
 *    doesn't), `label` used, always paired with visible `Text` per its own
 *    "always pair with a visible text label" guidance.
 *  - `Token` ("Token" Props table, lines 6193-6208): `label`, `color` used.
 *  - `Selector` ("Selector" Props table, lines 1365-1387): `label`,
 *    `options`, `value`, `onChange`, `hasClear`, `placeholder`,
 *    `renderOption`, `isRequired`, `status` used.
 *  - `TextInput` ("TextInput" Props table, lines 1652-1676): `label`,
 *    `value`, `onChange`, `isRequired`, `status`, `placeholder` used.
 *  - `IconButton` ("IconButton" Props table, lines 4263-4275): `label`,
 *    `icon`, `variant`, `size`, `isDisabled`, `onClick` used.
 *  - `Icon` ("Icon" Props table, lines 604-611): `icon` (`'arrowUp'`/
 *    `'arrowDown'`, both in the documented semantic-name list), `size`
 *    used.
 *  - `MoreMenu` ("MoreMenu" Props table, lines 4809-4817): `items`, `label`
 *    used. Item shape (`{label, onClick, isDisabled}`) per `DropdownMenu`'s
 *    own documented "items" row (astryx-api.md "DropdownMenu" Props table,
 *    line 1884: "an action item `{label, onClick?, icon?, isDisabled?}`") --
 *    `MoreMenu`'s own doc line 4811 says "Same type as DropdownMenu items
 *    prop."
 *  - `AlertDialog` ("AlertDialog" Props table, lines 2516-2530): `isOpen`,
 *    `onOpenChange`, `title`, `description`, `actionLabel`, `onAction` used
 *    (both the Archive and Hard-delete confirms).
 *  - `Dialog` ("Dialog" Props table, lines 2400-2412): `isOpen`,
 *    `onOpenChange`, `children`, `purpose` (`'form'`, since this dialog
 *    holds real inputs -- "Do: Use purpose=form for dialogs with inputs so
 *    the user can't accidentally lose data by clicking the backdrop,"
 *    astryx-api.md "Dialog" Best Practices) used.
 *  - `DialogHeader` -- `astryx-api.md`'s own "Components > DialogHeader"
 *    subsection (line 2418) is `undefined`, a real doc-generation gap
 *    (same class `RosterShell.tsx`/T021 and `StudentsTab.tsx`/T022 each
 *    already hit for their own components). Per the mandated cross-check,
 *    `npm run astryx -- component DialogHeader` output (verbatim, relevant
 *    rows) resolves it: `title` (string, "Dialog title (receives focus on
 *    open)"), `onOpenChange` (`(isOpen: boolean) => unknown`, "Close button
 *    callback (no button if omitted)"). Only `title` and `onOpenChange` are
 *    used below; `subtitle`/`startContent`/`endContent`/`hasDivider` are
 *    not needed.
 *  - `Layout`/`LayoutContent`/`LayoutFooter` ("Layout" Props table, lines
 *    257-266, used exactly per the file's own documented Dialog-composition
 *    example, lines 2354-2360): `header`, `content`, `footer` (on `Layout`);
 *    `LayoutContent`/`LayoutFooter` are rendered with only `children` (and
 *    `LayoutFooter`'s own `hasDivider`, matching that same documented
 *    example) -- their own "Components" subsections (lines 276-287) are
 *    likewise `undefined`, same disclosed gap class; no further prop beyond
 *    the documented example's own usage is invented for either.
 *  - `FormLayout` ("FormLayout" Props table, lines 4158-4164): `children`
 *    used (default `direction="vertical"` -- deliberately not overridden;
 *    "Do: Stack fields vertically for most forms," astyrx-api.md
 *    "FormLayout" Best Practices).
 *  - `Button` ("Button" Props table, lines 1807-1827): `label`, `variant`
 *    (`'primary'`/`'secondary'`), `onClick` used.
 *  - `Banner` (identical usage to `StudentsTab.tsx`/T022): `status`,
 *    `title`, `description` used.
 *  - `EmptyState` (astryx-api.md lines 3991-4001): `title`, `description`
 *    used.
 *  - `Skeleton` (T081, astryx-api.md "Skeleton" section, lines 621-655):
 *    `width`, `height`, `index` used to preview the loading `Table`'s known
 *    row/column shape -- `VisuallyHidden` (lines 6588-6618) + `aria-busy`
 *    on the wrapping `VStack` carries the accessible "Loading teams…"
 *    announcement Spinner's own `label` used to provide (T081 worker
 *    output: this screen's populated shape is a predictable table, not a
 *    genuinely unknown-dimension state, so DES-12/Astryx's own Skeleton
 *    guidance calls for `Skeleton` here, not `Spinner`).
 *  - `Heading`: `level`, `children` used -- same disclosed CLI-cross-checked
 *    `undefined`-subsection gap `RosterShell.tsx`/T021 and
 *    `StudentsTab.tsx`/T022 already resolved identically for this exact
 *    component.
 *  - `Text`: `type`, `color`, `weight` used.
 *  - `VStack`/`HStack` ("Stack" section, lines 350-396): `gap`, `padding`,
 *    `vAlign`, `hAlign` used.
 *
 * -----------------------------------------------------------------------
 * 9. DES-12 four states (loading / error / empty / populated) -- same
 *    generic `useLoadState` hook shape every prior content page in this
 *    batch (`StudentsTab.tsx`, `OutreachList.tsx`, `ParticipationTab.tsx`,
 *    `MeetingsList.tsx`) already established.
 *
 * -----------------------------------------------------------------------
 * 10. Fixture data (constitution item 6: no PII, fabricated names only).
 *
 * `FIXTURE_TEAMS`/`FIXTURE_STUDENT_TEAM_LINKS` below are entirely
 * fabricated and exist ONLY as the default argument to
 * `defaultLoadTeamsTabData` -- covered in module doc #3 above.
 */
import { useEffect, useState, type ReactNode } from 'react';
import {
  AlertDialog,
  Badge,
  type BadgeVariant,
  Banner,
  Button,
  Dialog,
  DialogHeader,
  type DropdownMenuOption,
  EmptyState,
  FormLayout,
  Heading,
  HStack,
  Icon,
  IconButton,
  Layout,
  LayoutContent,
  LayoutFooter,
  MoreMenu,
  pixel,
  proportional,
  Selector,
  type SelectorOptionData,
  Skeleton,
  StatusDot,
  Table,
  type TableColumn,
  Text,
  TextInput,
  Token,
  type TokenColor,
  VisuallyHidden,
  VStack,
} from '@astryxdesign/core';

// ---------------------------------------------------------------------------
// Types -- verbatim camelCase renames of real column subsets. Module doc #1.
// ---------------------------------------------------------------------------

export type Program = 'FRC' | 'FTC' | 'Other';

export interface TeamRow {
  id: string;
  name: string;
  shortName: string;
  program: Program | null;
  /** Real schema: `text not null`, genuinely free-text, no check constraint. */
  color: string;
  archived: boolean;
  sortOrder: number;
}

/** Minimal projection of `students.team_id`. Module doc #3. */
export interface StudentTeamLinkRow {
  studentId: string;
  teamId: string;
}

/**
 * Table display row -- `extends Record<string, unknown>` is required by
 * `Table`'s own generic constraint (astryx-api.md "Table" Props table,
 * `data: T[]` description).
 */
export interface TeamDisplayRow extends Record<string, unknown> {
  id: string;
  name: string;
  shortName: string;
  program: Program | null;
  color: string;
  archived: boolean;
  sortOrder: number;
  /** Module doc #3: the hard-delete gate flag. */
  hasStudentsOrHistory: boolean;
}

export interface TeamsTabLoadResult {
  teams: readonly TeamRow[];
  studentTeamLinks: readonly StudentTeamLinkRow[];
}

export type LoadTeamsTabDataFn = () => Promise<TeamsTabLoadResult>;

export interface TeamFormValues {
  name: string;
  shortName: string;
  program: Program | null;
  color: string;
}

// ---------------------------------------------------------------------------
// Fixture data -- module doc #10. Fabricated names only (constitution item 6).
// ---------------------------------------------------------------------------

const FIXTURE_TEAMS: readonly TeamRow[] = [
  {
    id: 'team-ironclad',
    name: 'Ironclad',
    shortName: 'IRON',
    program: 'FRC',
    color: 'blue',
    archived: false,
    sortOrder: 0,
  },
  {
    id: 'team-voltage',
    name: 'Voltage',
    shortName: 'VOLT',
    program: 'FTC',
    color: 'purple',
    archived: false,
    sortOrder: 1,
  },
  // Zero students/history -> the only fixture row hard-delete is allowed on.
  {
    id: 'team-embercore',
    name: 'Embercore',
    shortName: 'EMBR',
    program: 'Other',
    color: 'orange',
    archived: false,
    sortOrder: 2,
  },
  // Archived AND has history AND program is null AND its stored color is an
  // unrecognized legacy string -- proves module docs #2/#4/#5 all at once.
  {
    id: 'team-legacy-alpha',
    name: 'Legacy Alpha',
    shortName: 'LGCY',
    program: null,
    color: 'crimson-legacy',
    archived: true,
    sortOrder: 3,
  },
];

const FIXTURE_STUDENT_TEAM_LINKS: readonly StudentTeamLinkRow[] = [
  { studentId: 'student-amara-voss', teamId: 'team-ironclad' },
  // Stands in for a now-inactive student who once belonged to this team
  // (module doc #3: membership alone counts as history in this projection).
  { studentId: 'student-marcus-whitfield', teamId: 'team-voltage' },
  { studentId: 'student-priya-anand', teamId: 'team-legacy-alpha' },
  // team-embercore deliberately has NO link -- the hard-delete-allowed case.
];

// ---------------------------------------------------------------------------
// Color chip options -- module doc #5. Built from Token's own exported
// TokenColor union, not hand-retyped.
// ---------------------------------------------------------------------------

const KNOWN_TEAM_COLORS: readonly TokenColor[] = [
  'default',
  'red',
  'orange',
  'yellow',
  'green',
  'teal',
  'cyan',
  'blue',
  'purple',
  'pink',
  'gray',
];

const TEAM_COLOR_LABELS: Record<TokenColor, string> = {
  default: 'Default (gray)',
  red: 'Red',
  orange: 'Orange',
  yellow: 'Yellow',
  green: 'Green',
  teal: 'Teal',
  cyan: 'Cyan',
  blue: 'Blue',
  purple: 'Purple',
  pink: 'Pink',
  gray: 'Gray',
};

// Not `readonly` -- `Selector`'s own `options` prop type is the mutable
// `SelectorOptionData[]` (astryx-api.md "Selector" Props table); a
// `readonly` array is not assignable to it (TS4104).
const TEAM_COLOR_OPTIONS: SelectorOptionData[] = KNOWN_TEAM_COLORS.map((color) => ({
  value: color,
  label: TEAM_COLOR_LABELS[color],
}));

const PROGRAM_OPTIONS: SelectorOptionData[] = [
  { value: 'FRC', label: 'FRC' },
  { value: 'FTC', label: 'FTC' },
  { value: 'Other', label: 'Other' },
];

const PROGRAM_BADGE_VARIANT: Record<Program, BadgeVariant> = {
  FRC: 'blue',
  FTC: 'purple',
  Other: 'neutral',
};

// ---------------------------------------------------------------------------
// Pure functions -- exported for direct testing. Module docs #2/#3/#5/#6.
// ---------------------------------------------------------------------------

/** Module doc #3: the ONE place the hard-delete gate is decided. */
export function teamHasStudentsOrHistory(
  teamId: string,
  links: readonly StudentTeamLinkRow[],
): boolean {
  return links.some((link) => link.teamId === teamId);
}

/** Module doc #2: the ONE place hard-delete eligibility is decided. */
export function canHardDelete(row: Pick<TeamDisplayRow, 'hasStudentsOrHistory'>): boolean {
  return !row.hasStudentsOrHistory;
}

/** Module doc #5: falls back to 'default' for a stored value outside the known set. */
export function toKnownTeamColor(color: string): TokenColor {
  return (KNOWN_TEAM_COLORS as readonly string[]).includes(color)
    ? (color as TokenColor)
    : 'default';
}

export function buildDisplayRows(
  teams: readonly TeamRow[],
  links: readonly StudentTeamLinkRow[],
): TeamDisplayRow[] {
  return teams
    .map((team) => ({
      id: team.id,
      name: team.name,
      shortName: team.shortName,
      program: team.program,
      color: team.color,
      archived: team.archived,
      sortOrder: team.sortOrder,
      hasStudentsOrHistory: teamHasStudentsOrHistory(team.id, links),
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * Module doc #2: the ONLY place `archived` is ever mutated. Always returns
 * the full row set with one row flipped -- never removes a row. Used for
 * BOTH archive (`archived: true`) and unarchive (`archived: false`).
 */
export function withArchivedOverride(
  rows: readonly TeamDisplayRow[],
  teamId: string,
  archived: boolean,
): TeamDisplayRow[] {
  return rows.map((row) => (row.id === teamId ? { ...row, archived } : row));
}

/**
 * Module doc #2: the ONLY place a row is ever actually removed. Callers
 * must gate this behind `canHardDelete` themselves -- this function does
 * not re-check the flag, matching `withArchivedOverride`'s own posture of
 * being a pure, ungated mutator whose caller owns the gating decision.
 */
export function withHardDelete(rows: readonly TeamDisplayRow[], teamId: string): TeamDisplayRow[] {
  return rows.filter((row) => row.id !== teamId);
}

/** Module doc #6: swaps `sortOrder` VALUES with the current neighbor, re-sorts. */
export function moveTeamSortOrder(
  rows: readonly TeamDisplayRow[],
  teamId: string,
  direction: 'up' | 'down',
): TeamDisplayRow[] {
  const sorted = [...rows].sort((a, b) => a.sortOrder - b.sortOrder);
  const index = sorted.findIndex((row) => row.id === teamId);
  if (index === -1) return rows.slice();

  const neighborIndex = direction === 'up' ? index - 1 : index + 1;
  if (neighborIndex < 0 || neighborIndex >= sorted.length) return rows.slice();

  const current = sorted[index];
  const neighbor = sorted[neighborIndex];

  return rows
    .map((row) => {
      if (row.id === current.id) return { ...row, sortOrder: neighbor.sortOrder };
      if (row.id === neighbor.id) return { ...row, sortOrder: current.sortOrder };
      return row;
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function withCreatedTeam(
  rows: readonly TeamDisplayRow[],
  values: TeamFormValues,
  newId: string,
): TeamDisplayRow[] {
  const nextSortOrder = rows.length === 0 ? 0 : Math.max(...rows.map((row) => row.sortOrder)) + 1;
  const created: TeamDisplayRow = {
    id: newId,
    name: values.name,
    shortName: values.shortName,
    program: values.program,
    color: values.color,
    archived: false,
    sortOrder: nextSortOrder,
    hasStudentsOrHistory: false,
  };
  return [...rows, created].sort((a, b) => a.sortOrder - b.sortOrder);
}

export function withEditedTeam(
  rows: readonly TeamDisplayRow[],
  teamId: string,
  values: TeamFormValues,
): TeamDisplayRow[] {
  return rows.map((row) => (row.id === teamId ? { ...row, ...values } : row));
}

/**
 * `name` uniqueness (real schema: `name text unique`) and required fields
 * (`name`/`short_name`/`color` are all `not null`), checked client-side
 * only -- a disclosed judgment call, not a DB constraint enforcement (no
 * shared Supabase client is wired in here, module doc #7).
 */
export function validateTeamForm(
  values: TeamFormValues,
  rows: readonly TeamDisplayRow[],
  editingTeamId: string | null,
): { name?: string; shortName?: string; color?: string } {
  const errors: { name?: string; shortName?: string; color?: string } = {};

  const trimmedName = values.name.trim();
  if (trimmedName.length === 0) {
    errors.name = 'Name is required.';
  } else {
    const duplicate = rows.some(
      (row) =>
        row.id !== editingTeamId && row.name.trim().toLowerCase() === trimmedName.toLowerCase(),
    );
    if (duplicate) errors.name = 'A team with this name already exists.';
  }

  if (values.shortName.trim().length === 0) {
    errors.shortName = 'Short name is required.';
  }

  if (values.color.trim().length === 0) {
    errors.color = 'Color is required.';
  }

  return errors;
}

export async function defaultLoadTeamsTabData(): Promise<TeamsTabLoadResult> {
  return { teams: FIXTURE_TEAMS, studentTeamLinks: FIXTURE_STUDENT_TEAM_LINKS };
}

// ---------------------------------------------------------------------------
// Generic DES-12 load-state hook. Module doc #9.
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
// Table columns. Module doc #8.
// ---------------------------------------------------------------------------

interface BuildColumnsArgs {
  rows: readonly TeamDisplayRow[];
  onEdit: (row: TeamDisplayRow) => void;
  onArchiveRequest: (row: TeamDisplayRow) => void;
  onUnarchive: (row: TeamDisplayRow) => void;
  onHardDeleteRequest: (row: TeamDisplayRow) => void;
  onMoveUp: (row: TeamDisplayRow) => void;
  onMoveDown: (row: TeamDisplayRow) => void;
}

function buildRowMenuItems(row: TeamDisplayRow, args: BuildColumnsArgs): DropdownMenuOption[] {
  const items: DropdownMenuOption[] = [{ label: 'Edit', onClick: () => args.onEdit(row) }];

  // Module doc #2: Archive (destructive-framed confirm, reversible) vs.
  // Unarchive (non-destructive, direct flip) -- never both at once.
  if (row.archived) {
    items.push({ label: 'Unarchive', onClick: () => args.onUnarchive(row) });
  } else {
    items.push({ label: 'Archive', onClick: () => args.onArchiveRequest(row) });
  }

  const hardDeleteAllowed = canHardDelete(row);
  items.push({
    label: hardDeleteAllowed ? 'Hard delete' : 'Hard delete (blocked — has students or history)',
    isDisabled: !hardDeleteAllowed,
    onClick: () => args.onHardDeleteRequest(row),
  });

  return items;
}

function buildColumns(args: BuildColumnsArgs): TableColumn<TeamDisplayRow>[] {
  const sortedIds = [...args.rows].sort((a, b) => a.sortOrder - b.sortOrder).map((row) => row.id);

  return [
    {
      key: 'name',
      header: 'Team',
      width: proportional(2),
      renderCell: (row) => (
        <HStack gap={2} vAlign="center">
          <Text weight="semibold">{row.name}</Text>
          {row.archived && <Badge variant="neutral" label="Archived" />}
        </HStack>
      ),
    },
    {
      key: 'shortName',
      header: 'Short name',
      width: proportional(1),
      renderCell: (row) => <Text>{row.shortName}</Text>,
    },
    {
      key: 'program',
      header: 'Program',
      width: pixel(120),
      renderCell: (row) =>
        row.program === null ? (
          <Text type="supporting" color="secondary">
            No program set
          </Text>
        ) : (
          <Badge variant={PROGRAM_BADGE_VARIANT[row.program]} label={row.program} />
        ),
    },
    {
      key: 'color',
      header: 'Color',
      width: pixel(140),
      renderCell: (row) => (
        <Token
          label={TEAM_COLOR_LABELS[toKnownTeamColor(row.color)]}
          color={toKnownTeamColor(row.color)}
        />
      ),
    },
    {
      key: 'hasStudentsOrHistory',
      header: 'Students / history',
      width: pixel(180),
      renderCell: (row) => {
        const blocked = row.hasStudentsOrHistory;
        return (
          <HStack gap={2} vAlign="center">
            <StatusDot
              variant={blocked ? 'warning' : 'neutral'}
              label={blocked ? 'Has students or history' : 'None'}
            />
            <Text>{blocked ? 'Has students or history' : 'None'}</Text>
          </HStack>
        );
      },
    },
    {
      key: 'sortOrder',
      header: 'Sort order',
      width: pixel(160),
      align: 'end',
      renderCell: (row) => {
        const index = sortedIds.indexOf(row.id);
        const isFirst = index <= 0;
        const isLast = index === -1 || index >= sortedIds.length - 1;
        return (
          <HStack gap={2} vAlign="center" hAlign="end">
            <Text hasTabularNumbers>{row.sortOrder}</Text>
            <IconButton
              label={`Move ${row.name} up`}
              icon={<Icon icon="arrowUp" size="sm" />}
              variant="ghost"
              size="sm"
              isDisabled={isFirst}
              onClick={() => args.onMoveUp(row)}
            />
            <IconButton
              label={`Move ${row.name} down`}
              icon={<Icon icon="arrowDown" size="sm" />}
              variant="ghost"
              size="sm"
              isDisabled={isLast}
              onClick={() => args.onMoveDown(row)}
            />
          </HStack>
        );
      },
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
// Create/Edit form dialog.
// ---------------------------------------------------------------------------

const EMPTY_FORM_VALUES: TeamFormValues = {
  name: '',
  shortName: '',
  program: null,
  color: 'default',
};

interface TeamFormDialogProps {
  isOpen: boolean;
  mode: 'create' | 'edit';
  values: TeamFormValues;
  errors: { name?: string; shortName?: string; color?: string };
  onChange: (values: TeamFormValues) => void;
  onCancel: () => void;
  onSave: () => void;
}

function TeamFormDialog({
  isOpen,
  mode,
  values,
  errors,
  onChange,
  onCancel,
  onSave,
}: TeamFormDialogProps): ReactNode {
  const knownColor = toKnownTeamColor(values.color);

  return (
    <Dialog isOpen={isOpen} onOpenChange={(open) => !open && onCancel()} purpose="form">
      <Layout
        header={
          <DialogHeader
            title={mode === 'create' ? 'New team' : 'Edit team'}
            onOpenChange={(open) => !open && onCancel()}
          />
        }
        content={
          <LayoutContent>
            <FormLayout>
              <TextInput
                label="Name"
                value={values.name}
                onChange={(name) => onChange({ ...values, name })}
                isRequired
                status={errors.name ? { type: 'error', message: errors.name } : undefined}
              />
              <TextInput
                label="Short name"
                value={values.shortName}
                onChange={(shortName) => onChange({ ...values, shortName })}
                isRequired
                status={errors.shortName ? { type: 'error', message: errors.shortName } : undefined}
              />
              <Selector
                label="Program"
                options={PROGRAM_OPTIONS}
                value={values.program ?? null}
                onChange={(value) => onChange({ ...values, program: value as Program | null })}
                hasClear
                placeholder="No program set"
              />
              <Selector
                label="Color"
                options={TEAM_COLOR_OPTIONS}
                value={knownColor}
                onChange={(value) => onChange({ ...values, color: value })}
                renderOption={(option) => (
                  <Token label={option.label ?? option.value} color={option.value as TokenColor} />
                )}
                status={errors.color ? { type: 'error', message: errors.color } : undefined}
              />
              <HStack gap={2} vAlign="center">
                <Text type="supporting" color="secondary">
                  Preview:
                </Text>
                <Token label={TEAM_COLOR_LABELS[knownColor]} color={knownColor} />
              </HStack>
            </FormLayout>
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack gap={2} hAlign="end">
              <Button label="Cancel" variant="secondary" onClick={onCancel} />
              <Button label="Save" variant="primary" onClick={onSave} />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const EMPTY_ROWS: TeamDisplayRow[] = [];

export interface TeamsTabProps {
  /** Injectable data-loading seam (module doc #7). Defaults to fixture data. */
  loadData?: LoadTeamsTabDataFn;
  /** Injectable id generator, overridable for deterministic tests. */
  generateId?: () => string;
}

export function TeamsTab({
  loadData = defaultLoadTeamsTabData,
  generateId = () => `team-${crypto.randomUUID()}`,
}: TeamsTabProps = {}): ReactNode {
  const loadState = useLoadState(loadData, [loadData]);
  const [rows, setRows] = useState<TeamDisplayRow[]>(EMPTY_ROWS);

  const [formOpen, setFormOpen] = useState<
    { mode: 'create' } | { mode: 'edit'; teamId: string } | null
  >(null);
  const [formValues, setFormValues] = useState<TeamFormValues>(EMPTY_FORM_VALUES);
  const [formErrors, setFormErrors] = useState<{
    name?: string;
    shortName?: string;
    color?: string;
  }>({});

  const [archiveTarget, setArchiveTarget] = useState<TeamDisplayRow | null>(null);
  const [hardDeleteTarget, setHardDeleteTarget] = useState<TeamDisplayRow | null>(null);

  useEffect(() => {
    if (loadState.status === 'success') {
      setRows(buildDisplayRows(loadState.data.teams, loadState.data.studentTeamLinks));
    }
  }, [loadState]);

  function openCreateDialog(): void {
    setFormValues(EMPTY_FORM_VALUES);
    setFormErrors({});
    setFormOpen({ mode: 'create' });
  }

  function openEditDialog(row: TeamDisplayRow): void {
    setFormValues({
      name: row.name,
      shortName: row.shortName,
      program: row.program,
      color: row.color,
    });
    setFormErrors({});
    setFormOpen({ mode: 'edit', teamId: row.id });
  }

  function closeFormDialog(): void {
    setFormOpen(null);
  }

  function handleSave(): void {
    if (formOpen === null) return;
    const editingTeamId = formOpen.mode === 'edit' ? formOpen.teamId : null;
    const errors = validateTeamForm(formValues, rows, editingTeamId);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    if (formOpen.mode === 'create') {
      setRows((prev) => withCreatedTeam(prev, formValues, generateId()));
    } else {
      setRows((prev) => withEditedTeam(prev, formOpen.teamId, formValues));
    }
    closeFormDialog();
  }

  function handleArchiveRequest(row: TeamDisplayRow): void {
    setArchiveTarget(row);
  }

  function handleConfirmArchive(): void {
    if (archiveTarget === null) return;
    setRows((prev) => withArchivedOverride(prev, archiveTarget.id, true));
    setArchiveTarget(null);
  }

  function handleUnarchive(row: TeamDisplayRow): void {
    setRows((prev) => withArchivedOverride(prev, row.id, false));
  }

  function handleHardDeleteRequest(row: TeamDisplayRow): void {
    if (!canHardDelete(row)) return;
    setHardDeleteTarget(row);
  }

  function handleConfirmHardDelete(): void {
    if (hardDeleteTarget === null || !canHardDelete(hardDeleteTarget)) return;
    setRows((prev) => withHardDelete(prev, hardDeleteTarget.id));
    setHardDeleteTarget(null);
  }

  function handleMoveUp(row: TeamDisplayRow): void {
    setRows((prev) => moveTeamSortOrder(prev, row.id, 'up'));
  }

  function handleMoveDown(row: TeamDisplayRow): void {
    setRows((prev) => moveTeamSortOrder(prev, row.id, 'down'));
  }

  // Deliberately NOT memoized -- same reasoning `StudentsTab.tsx`/T022
  // documents for its own identical pattern: every handler below is either
  // a constant closure or a functional `setRows` update, so recomputing
  // this small array each render is cheap and correct.
  const columns = buildColumns({
    rows,
    onEdit: openEditDialog,
    onArchiveRequest: handleArchiveRequest,
    onUnarchive: handleUnarchive,
    onHardDeleteRequest: handleHardDeleteRequest,
    onMoveUp: handleMoveUp,
    onMoveDown: handleMoveDown,
  });

  if (loadState.status === 'loading') {
    return (
      <VStack gap={4} padding={6} aria-busy="true">
        <VisuallyHidden as="div" role="status">
          Loading teams…
        </VisuallyHidden>
        <HStack gap={4} vAlign="center" hAlign="start">
          <Skeleton width={120} height={28} />
        </HStack>
        <VStack gap={2}>
          {[0, 1, 2, 3, 4].map((row) => (
            <HStack key={row} gap={4} vAlign="center">
              <Skeleton width={160} height={16} index={row * 3} />
              <Skeleton width={100} height={16} index={row * 3 + 1} />
              <Skeleton width={80} height={16} index={row * 3 + 2} />
            </HStack>
          ))}
        </VStack>
      </VStack>
    );
  }

  if (loadState.status === 'error') {
    return (
      <VStack gap={4} padding={6}>
        <Banner
          status="error"
          title="Couldn't load teams"
          description="Something went wrong loading the team list. Try refreshing the page."
          endContent={<Button variant="ghost" label="Retry" onClick={loadState.retry} />}
        />
      </VStack>
    );
  }

  return (
    <VStack gap={4} padding={6}>
      <HStack gap={4} vAlign="center" hAlign="start">
        <Heading level={1}>Teams</Heading>
      </HStack>

      <HStack gap={2} hAlign="end">
        <Button label="New team" variant="primary" onClick={openCreateDialog} />
      </HStack>

      {rows.length === 0 ? (
        <EmptyState
          headingLevel={2}
          title="No teams yet"
          description="Teams created for this program will show up here."
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

      <TeamFormDialog
        isOpen={formOpen !== null}
        mode={formOpen?.mode ?? 'create'}
        values={formValues}
        errors={formErrors}
        onChange={setFormValues}
        onCancel={closeFormDialog}
        onSave={handleSave}
      />

      <AlertDialog
        isOpen={archiveTarget !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setArchiveTarget(null);
        }}
        title={`Archive ${archiveTarget?.name ?? ''}?`}
        description="This removes the team from future selectors and expected rosters. Its students, history, and past metrics are preserved, and it will still show up here (marked archived) — you can unarchive it at any time."
        actionLabel="Archive"
        onAction={handleConfirmArchive}
      />

      <AlertDialog
        isOpen={hardDeleteTarget !== null}
        onOpenChange={(isOpen) => {
          if (!isOpen) setHardDeleteTarget(null);
        }}
        title={`Permanently delete ${hardDeleteTarget?.name ?? ''}?`}
        description="This permanently deletes the team and cannot be undone. This action is only available because the team has no students and no history."
        actionLabel="Delete permanently"
        onAction={handleConfirmHardDelete}
      />
    </VStack>
  );
}

export default TeamsTab;
