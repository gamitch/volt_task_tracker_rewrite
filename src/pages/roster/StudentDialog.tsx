/**
 * T023: Add/edit student `Dialog` (ROS-03), PRD line 335:
 *
 * "**ROS-03 Add/edit student** `Dialog`: name, email (optional), team
 * `Selector`, grad year (optional), active `Switch`, individual goal
 * override `NumberInput` (blank = inherit season default)."
 *
 * Field order below is literal per constitution item 13 (the same
 * "exact order listed" rule `ScheduleMeetingsDialog.tsx`/T031 already applied
 * to MTG-02): name -> email -> team -> grad year -> active -> goal override.
 *
 * This is a standalone dialog component with its own injectable `onSubmit`
 * prop and its own fixture team/season data (Known Context/Traps #4/#5, this
 * task's Allowed Files) -- `StudentsTab.tsx` (T022, Passed) is a
 * forbidden/read-only file here and is NOT wired to this dialog by this
 * task; `StudentsTab.tsx`'s own module doc #8a already names this exact task
 * (T023) as the future filler of its "Edit" stub, and its "Invite (if
 * email)" MoreMenu item (module doc #2 there) is the row-action equivalent
 * of this dialog's own email-at-creation-time question below.
 *
 * -----------------------------------------------------------------------
 * 1. THE "email (optional)" FIELD (Known Context/Traps #1) -- DISCLOSED
 *    JUDGMENT CALL, engaging directly with `StudentsTab.tsx`'s precedent.
 *
 * Ground truth (`supabase/migrations/20260716000000_identity_roster.sql`
 * lines 59-68, re-read directly for this task, not assumed): `students` has
 * NO `email` column. Email only ever lives on `profiles.email` (set once a
 * student has an account, via `profile_id`) or on a pending `invites.email`
 * row. `StudentsTab.tsx`'s own module doc #2 already resolved the parallel
 * "Invite (if email)" MoreMenu-item ambiguity (ROS-02) as reading (a):
 * "Invite" shows exactly when `accountStatus === 'no_account'`, because the
 * real `send-invite` Edge Function (`supabase/functions/send-invite/
 * validation.ts`, confirmed directly again for this task) already takes
 * `email` as its OWN request-body field, never a stored `students.email`
 * lookup -- so "if email" is read as PRD shorthand for "assuming you're
 * about to supply one," not a precondition sourced from already-stored data.
 * `StudentsTab.tsx` explicitly declined reading (b) (treating this as a
 * genuine schema gap requiring a `students.email` migration) as schema-
 * change overreach for a UI task.
 *
 * This dialog's ROS-03 "email (optional)" field is the CREATION-TIME twin of
 * that same row-action: reading (a) is applied again here, for the same
 * reasons, with one addition this task's packet specifically calls out --
 * "filling it in triggers a follow-up invite flow reusing T017's
 * send-invite... leaving it blank just creates the roster row with no
 * account yet ('No account' status, same vocabulary `StudentsTab.tsx`
 * established)." Concretely: `StudentFormPayload.inviteEmail` (below) is
 * NOT a `students` column and is never merged into the roster-row fields
 * (`displayName`/`teamId`/`gradYear`/`isActive`/`goalHoursOverride`, the
 * verbatim real-schema subset) -- it is a SEPARATE, disclosed signal passed
 * alongside them, so the caller (once a real Supabase client and a real
 * invite-composition flow exist -- neither does yet, per `StudentsTab.tsx`
 * module doc #8c's own grep-confirmed finding that no send-invite UI dialog
 * exists anywhere in this codebase) can decide whether to also call
 * `send-invite` with that email + `student_id` + `role: 'student'`. This
 * dialog itself never calls `send-invite` -- same "no shared Supabase client
 * wired in" scope boundary as every prior content page (module doc #5).
 *
 * A second, EDIT-mode-only wrinkle this task's packet does not spell out but
 * the real schema forces: if the student being edited already HAS an
 * account (`profileId !== null`, i.e. `StudentsTab.tsx`'s "Active" status),
 * their email already lives on their own `profiles` row -- a field this
 * dialog has no access to and (per Forbidden Files / constitution item 10)
 * has no business editing. `computeEmailFieldDisabled` below disables the
 * Email field with an explicit `disabledMessage` in exactly that one case
 * (edit mode + `hasAccount: true`); it stays enabled for create mode and for
 * editing an "Invited"/"No account" student (both of which are still
 * legitimately missing an account and could still use an invite-at-edit-time
 * email). Independently exported/tested, not embedded only in JSX.
 *
 * No `students.email` column, migration, or fixture field is invented
 * anywhere below -- out of scope for a UI-only task (constitution item 10;
 * `supabase/migrations/**` is not in this task's Allowed Files).
 *
 * -----------------------------------------------------------------------
 * 2. BEH-07 computed confirm-button copy (Known Context/Traps #2) --
 *    checker-enforced, never a bare "Submit"/"OK".
 *
 * `computeStudentDialogMode` is the ONLY place "create" vs. "edit" is
 * decided -- derived purely from whether `initialData` was supplied (a
 * single source of truth, so a caller can never pass a `mode` prop that
 * disagrees with the data actually loaded into the form). `computeConfirmLabel`
 * is the ONLY place the confirm button's text is produced: "Add student"
 * (create) / "Save changes" (edit) -- ROS-03's own literal two labels, per
 * this task's packet. The dialog title (`computeDialogTitle`) is derived the
 * same way ("Add student" / "Edit student").
 *
 * -----------------------------------------------------------------------
 * 3. MET-04's "blank goal override inherits season default" (Known Context/
 *    Traps #3) -- a DISPLAY/COPY requirement here, not a computation this
 *    dialog performs.
 *
 * `goalHoursOverride` state is `number | null`; leaving the `NumberInput`
 * blank keeps it `null`, and `buildStudentFormPayload` below submits that
 * `null` verbatim -- never `0`, never a copied-in default value. The actual
 * `goal_hours_override ?? season.default_goal_hours` inheritance (MET-04's
 * real formula) happens at READ time, inside `v_student_hours`'s consuming
 * logic elsewhere -- not in this file. `computeGoalOverrideHelperText`
 * below produces the explicit UI copy explaining that inheritance, citing
 * the REAL season default value from this file's own injectable `season`
 * prop (default `DEFAULT_SEASON_INFO.defaultGoalHours = 100`, matching
 * `seasons.default_goal_hours numeric not null default 100` from the same
 * migration file, lines 44-51 -- not a hardcoded guess unrelated to the
 * schema). No real `seasons` row is fetched (no shared Supabase client
 * wired in yet, module doc #5) -- this is a disclosed fixture default whose
 * NUMBER matches the real column default, same posture `StudentsTab.tsx`'s
 * own fixture data took toward `students`/`teams`/`invites`.
 *
 * -----------------------------------------------------------------------
 * 4. Team `Selector`, archived teams excluded (Known Context/Traps #4).
 *
 * `StudentDialogTeamOption` is an independently-defined (not imported --
 * `StudentsTab.tsx` is forbidden/read-only here) verbatim camelCase subset
 * of the real `teams` columns this dialog needs: `id`, `name`, `archived`
 * (`supabase/migrations/20260716000000_identity_roster.sql` lines 29-38 --
 * `StudentsTab.tsx`'s own `TeamRow` didn't need `archived` for its screen,
 * so this is a superset built directly off the same migration, not copied
 * from that file). `filterSelectableTeams` is the ONLY place archived teams
 * are excluded from the `Selector`'s option list -- same "archived teams
 * disappear from selectors" rule `TeamsTab.tsx`/T026 will also need to
 * respect independently (no coordination needed; this file applies it on
 * its own). `DEFAULT_TEAMS` fixture below deliberately includes one archived
 * team specifically to prove the exclusion is real, not vacuous (see this
 * task's worker output / test file).
 *
 * -----------------------------------------------------------------------
 * 5. No shared Supabase client wired in yet (Known Context/Traps #5) --
 *    deliberate scope, not a gap for this task to solve. Same posture as
 *    every prior content page (`ScheduleMeetingsDialog.tsx`/T031,
 *    `OutreachList.tsx`/T038, `ParticipationTab.tsx`/T056,
 *    `MeetingsList.tsx`/T030). `onSubmit` defaults to
 *    `defaultOnSubmitStudent`, an obviously-fake stub that only
 *    `console.warn`s the payload it would have persisted.
 *
 * -----------------------------------------------------------------------
 * 6. Astryx prop sourcing (constitution item 2) -- every prop below,
 *    cross-checked directly against `docs/swarm/astryx-api.md` (grepped
 *    live for this task):
 *
 *  - `Dialog`: "Dialog" Props table (lines 2400-2412). `isOpen`,
 *    `onOpenChange`, `children`, `purpose` ("form", same MTG-02/T031
 *    reasoning: fields here can hold data the user shouldn't lose to an
 *    accidental backdrop click) used.
 *  - `DialogHeader`: doc's own "Components > DialogHeader" subsection is
 *    `undefined` (line 2416-2418) -- same disclosed gap `ScheduleMeetingsDialog.tsx`/
 *    T031, `RosterShell.tsx`/T021, `MeetingsList.tsx`/T030 already hit;
 *    props taken from the "Dialog" section's own worked `## Example` code
 *    block instead (`title`, `onOpenChange`), non-hallucinated doc content.
 *  - `Layout`/`LayoutContent`/`LayoutFooter`: "Layout" Props table (lines
 *    257-266) + `node_modules/@astryxdesign/core/dist/Layout/
 *    LayoutContent.d.ts`/`LayoutFooter.d.ts` (both doc Components
 *    subsections are `undefined`, same T031 posture). `header`, `content`,
 *    `footer` (Layout); `children` (LayoutContent); `children`, `hasDivider`
 *    (LayoutFooter) used.
 *  - `FormLayout`: "FormLayout" Props table (lines 4158-4164). `children`
 *    used (default `direction="vertical"`, per its own "Do: stack fields
 *    vertically for most forms" guidance).
 *  - `TextInput`: "TextInput" Props table (lines 1652-1676). `label`,
 *    `value`, `onChange`, `type` (`'email'` for the email field), `isRequired`
 *    (name only), `isOptional` (email only), `isDisabled`, `disabledMessage`,
 *    `description`, `placeholder` used.
 *  - `Selector`: "Selector" Props table (lines 1365-1387). `label`,
 *    `options`, `value`, `onChange`, `isRequired`, `placeholder` used.
 *  - `NumberInput`: "NumberInput" Props table (lines 1179-1204) +
 *    `node_modules/@astryxdesign/core/dist/NumberInput/NumberInput.d.ts`
 *    (confirms `hasClear: true` widens `onChange` to accept `number | null`,
 *    a detail the Props table's prose states but doesn't type -- verified
 *    directly, not guessed). `label`, `value`, `onChange`, `hasClear`,
 *    `isOptional`, `isIntegerOnly`, `min`, `max`, `units`, `description`
 *    used.
 *  - `Switch`: "Switch" Props table (lines 1506-1529). `label`, `value`,
 *    `onChange` used.
 *  - `Button`: "Button" Props table (lines 1807-1827). `label`, `variant`,
 *    `isDisabled`, `isLoading`, `onClick`, `clickAction` used (module doc #2
 *    -- deliberately no `tooltip` on the disabled confirm button, so it
 *    stays natively `disabled`, same T031 reasoning).
 *  - `Banner`: "Banner" Props table (lines 2749-2763). `status`, `title`,
 *    `description` used (submit-error state only).
 *  - `HStack`: "Stack" section (lines 319-396). `gap`, `hAlign` used.
 */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Banner,
  Button,
  Dialog,
  DialogHeader,
  FormLayout,
  HStack,
  Layout,
  LayoutContent,
  LayoutFooter,
  NumberInput,
  Selector,
  Switch,
  TextInput,
} from '@astryxdesign/core';

// ---------------------------------------------------------------------------
// Types -- verbatim camelCase renames of real column subsets, plus one
// disclosed non-column signal (`inviteEmail`, module doc #1). Module doc #1/#4.
// ---------------------------------------------------------------------------

export type StudentDialogMode = 'create' | 'edit';

/** Module doc #4 -- superset of `StudentsTab.tsx`'s `TeamRow`, independently
 * defined here since that file is forbidden/read-only for this task. */
export interface StudentDialogTeamOption {
  id: string;
  name: string;
  archived: boolean;
}

/** Module doc #3 -- the one real number this dialog needs from `seasons`. */
export interface ActiveSeasonGoalInfo {
  defaultGoalHours: number;
}

/** The real `students` row subset this dialog edits, plus `hasAccount`
 * (`profileId !== null`) -- module doc #1's edit-mode email-disable signal. */
export interface StudentDialogInitialData {
  id: string;
  displayName: string;
  teamId: string;
  gradYear: number | null;
  isActive: boolean;
  goalHoursOverride: number | null;
  hasAccount: boolean;
}

export interface StudentFormPayload {
  displayName: string;
  teamId: string;
  gradYear: number | null;
  isActive: boolean;
  goalHoursOverride: number | null;
  /** Module doc #1 -- NOT a `students` column. `null` when left blank. */
  inviteEmail: string | null;
}

export type OnSubmitStudentFn = (
  payload: StudentFormPayload,
  mode: StudentDialogMode,
) => Promise<void>;

// ---------------------------------------------------------------------------
// Fixture data (constitution item 6: fabricated names only). Standalone --
// `StudentsTab.tsx`'s own fixtures are a forbidden/read-only file here, so
// these are deliberate, independent defaults (module-level doc, top of file).
// ---------------------------------------------------------------------------

const DEFAULT_TEAMS: readonly StudentDialogTeamOption[] = [
  { id: 'team-ironclad', name: 'Ironclad', archived: false },
  { id: 'team-voltage', name: 'Voltage', archived: false },
  // Module doc #4 -- proves `filterSelectableTeams` actually excludes this.
  { id: 'team-legacy-forge', name: 'Legacy Forge', archived: true },
];

/** Module doc #3 -- matches `seasons.default_goal_hours`'s real column
 * default (`not null default 100`), not an arbitrary guess. */
const DEFAULT_SEASON_INFO: ActiveSeasonGoalInfo = { defaultGoalHours: 100 };

// ---------------------------------------------------------------------------
// Pure functions -- exported for direct testing. Module docs #1/#2/#3/#4.
// ---------------------------------------------------------------------------

/** Module doc #2 -- the ONLY place "create" vs. "edit" is decided. */
export function computeStudentDialogMode(
  initialData: StudentDialogInitialData | undefined,
): StudentDialogMode {
  return initialData === undefined ? 'create' : 'edit';
}

/** BEH-07 (module doc #2) -- the ONLY place the confirm button's text is
 * produced. Never a bare "Submit"/"OK". */
export function computeConfirmLabel(mode: StudentDialogMode): string {
  return mode === 'create' ? 'Add student' : 'Save changes';
}

export function computeDialogTitle(mode: StudentDialogMode): string {
  return mode === 'create' ? 'Add student' : 'Edit student';
}

/** Module doc #1 -- the ONLY place the Email field's disabled state is
 * decided: disabled exactly when editing a student who already has an
 * account (their email lives on their own `profiles` row, out of reach and
 * out of scope here). */
export function computeEmailFieldDisabled(mode: StudentDialogMode, hasAccount: boolean): boolean {
  return mode === 'edit' && hasAccount;
}

/** Module doc #3 -- MET-04's inheritance explained as copy, not computed. */
export function computeGoalOverrideHelperText(defaultGoalHours: number): string {
  return `Uses the season default (${defaultGoalHours} h) if left blank`;
}

/** Module doc #4 -- the ONLY place archived teams are excluded from the
 * `Selector`'s option list. */
export function filterSelectableTeams(
  teams: readonly StudentDialogTeamOption[],
): StudentDialogTeamOption[] {
  return teams.filter((team) => !team.archived);
}

interface StudentFormState {
  displayName: string;
  inviteEmail: string;
  teamId: string;
  gradYear: number | null;
  isActive: boolean;
  goalHoursOverride: number | null;
}

function buildInitialFormState(
  initialData: StudentDialogInitialData | undefined,
): StudentFormState {
  if (initialData === undefined) {
    return {
      displayName: '',
      inviteEmail: '',
      teamId: '',
      gradYear: null,
      isActive: true,
      goalHoursOverride: null,
    };
  }
  return {
    displayName: initialData.displayName,
    inviteEmail: '',
    teamId: initialData.teamId,
    gradYear: initialData.gradYear,
    isActive: initialData.isActive,
    goalHoursOverride: initialData.goalHoursOverride,
  };
}

/** `students` row is valid to submit once it has a non-blank name and a
 * selected team (`team_id not null` per the real schema). Module doc #2. */
export function isStudentFormValid(state: StudentFormState): boolean {
  return state.displayName.trim() !== '' && state.teamId !== '';
}

/** Module doc #1/#3 -- the ONLY place the submit payload is assembled.
 * Blank goal override submits `null` (module doc #3); blank email submits
 * `null` (module doc #1), never an empty string. */
export function buildStudentFormPayload(state: StudentFormState): StudentFormPayload {
  const trimmedEmail = state.inviteEmail.trim();
  return {
    displayName: state.displayName.trim(),
    teamId: state.teamId,
    gradYear: state.gradYear,
    isActive: state.isActive,
    goalHoursOverride: state.goalHoursOverride,
    inviteEmail: trimmedEmail === '' ? null : trimmedEmail,
  };
}

// ---------------------------------------------------------------------------
// Default injectable persistence seam (module doc #5).
// ---------------------------------------------------------------------------

export const defaultOnSubmitStudent: OnSubmitStudentFn = async (payload, mode) => {
  console.warn(
    '[StudentDialog] No Supabase client wired in yet (Known Context/Traps #5) -- this stub only ' +
      'logs the students row (and any invite-email signal) that would have been ' +
      `persisted (mode: ${mode}).`,
    payload,
  );
};

// ---------------------------------------------------------------------------
// Component.
// ---------------------------------------------------------------------------

export interface StudentDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** Omit to open in "create" mode; supply to open in "edit" mode
   * (module doc #2 -- `computeStudentDialogMode` is the single source of
   * truth, there is no separate `mode` prop to drift out of sync). */
  initialData?: StudentDialogInitialData;
  /** Defaults to `DEFAULT_TEAMS` (fixture, module-level doc). */
  teams?: readonly StudentDialogTeamOption[];
  /** Defaults to `DEFAULT_SEASON_INFO` (module doc #3). */
  season?: ActiveSeasonGoalInfo;
  /** Defaults to `defaultOnSubmitStudent` (module doc #5). */
  onSubmit?: OnSubmitStudentFn;
}

export function StudentDialog({
  isOpen,
  onOpenChange,
  initialData,
  teams = DEFAULT_TEAMS,
  season = DEFAULT_SEASON_INFO,
  onSubmit = defaultOnSubmitStudent,
}: StudentDialogProps): ReactNode {
  const mode = computeStudentDialogMode(initialData);
  const selectableTeams = useMemo(() => filterSelectableTeams(teams), [teams]);

  const [formState, setFormState] = useState<StudentFormState>(() =>
    buildInitialFormState(initialData),
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Nothing persists across opens -- every fresh open starts from either
  // pristine "create" defaults or the current `initialData` snapshot, same
  // reset-on-open pattern `ScheduleMeetingsDialog.tsx`/T031 established.
  useEffect(() => {
    if (isOpen) {
      setFormState(buildInitialFormState(initialData));
      setSubmitError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only on the isOpen transition.
  }, [isOpen]);

  const isValid = isStudentFormValid(formState);
  const confirmLabel = computeConfirmLabel(mode);
  const dialogTitle = computeDialogTitle(mode);
  const emailDisabled = computeEmailFieldDisabled(mode, initialData?.hasAccount ?? false);
  const goalHelperText = computeGoalOverrideHelperText(season.defaultGoalHours);

  function updateField<K extends keyof StudentFormState>(key: K, value: StudentFormState[K]): void {
    setFormState((prev) => ({ ...prev, [key]: value }));
  }

  function handleCancel(): void {
    setFormState(buildInitialFormState(initialData));
    setSubmitError(null);
    onOpenChange(false);
  }

  async function handleSubmit(): Promise<void> {
    if (!isValid) return; // extra guard; the button is already natively disabled.
    setIsSubmitting(true);
    setSubmitError(null);
    const payload = buildStudentFormPayload(formState);
    try {
      await onSubmit(payload, mode);
      onOpenChange(false);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Something went wrong saving this student.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form">
      <Layout
        header={<DialogHeader title={dialogTitle} onOpenChange={onOpenChange} />}
        content={
          <LayoutContent>
            <FormLayout>
              {/* Field order per ROS-03 / constitution item 13 (module doc,
                  top of file): name -> email -> team -> grad year -> active
                  -> goal override -- exact, not a suggestion. */}
              <TextInput
                label="Name"
                value={formState.displayName}
                onChange={(value) => updateField('displayName', value)}
                isRequired
                placeholder="e.g. Amara Voss"
              />

              <TextInput
                label="Email"
                type="email"
                value={formState.inviteEmail}
                onChange={(value) => updateField('inviteEmail', value)}
                isOptional
                isDisabled={emailDisabled}
                disabledMessage={
                  emailDisabled
                    ? "This student already has an account. Email lives on their own profile and can't be changed here."
                    : undefined
                }
                description={
                  emailDisabled
                    ? undefined
                    : 'If provided, this queues an invite so the student can create their own account. Leave blank to add them with no account yet.'
                }
                placeholder="student@example.com"
              />

              <Selector
                label="Team"
                options={selectableTeams.map((team) => ({ value: team.id, label: team.name }))}
                value={formState.teamId}
                onChange={(value) => updateField('teamId', value)}
                isRequired
                placeholder="Select a team..."
              />

              <NumberInput
                label="Grad year"
                value={formState.gradYear}
                onChange={(value) => updateField('gradYear', value)}
                hasClear
                isOptional
                isIntegerOnly
                min={2000}
                max={2100}
              />

              <Switch
                label="Active"
                value={formState.isActive}
                onChange={(value) => updateField('isActive', value)}
              />

              <NumberInput
                label="Individual goal override"
                value={formState.goalHoursOverride}
                onChange={(value) => updateField('goalHoursOverride', value)}
                hasClear
                isOptional
                min={0}
                units="h"
                description={goalHelperText}
              />

              {submitError !== null && (
                <Banner
                  status="error"
                  title="Couldn't save this student"
                  description={submitError}
                />
              )}
            </FormLayout>
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack gap={2} hAlign="end">
              <Button label="Cancel" variant="secondary" onClick={handleCancel} />
              <Button
                label={confirmLabel}
                variant="primary"
                isDisabled={!isValid || isSubmitting}
                isLoading={isSubmitting}
                clickAction={handleSubmit}
              />
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}

export default StudentDialog;
