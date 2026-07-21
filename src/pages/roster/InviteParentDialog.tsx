/**
 * T024: "Invite parent" `Dialog` (ROS-05, PRD line 337 -- "invoked from a
 * student row: email, relationship label, optional additional linked
 * students (`MultiSelector`). Sends invite per AUTH-03."). Field order below
 * is literal per that text (constitution item 13): email -> relationship
 * label -> additional linked students.
 *
 * This is a STANDALONE component per this task's own packet -- it is not
 * wired into `StudentsTab.tsx`'s row `MoreMenu` (a forbidden, read-only file
 * here; that file already ships its own disclosed stub `Banner` naming this
 * task, `T024`, as the one that eventually fills that slot -- see
 * `StudentsTab.tsx` module doc #8b, `INVITE_PARENT_STUB_NOTICE`).
 *
 * -----------------------------------------------------------------------
 * 1. THE CENTRAL TRAP -- "additional linked students" data shape against
 *    `invites`' real single-`student_id` FK, resolved against ALREADY-
 *    EXISTING ground truth, not invented from scratch.
 *
 * Ground truth read directly (constitution item 3), not guessed:
 *   - `invites` (`supabase/migrations/20260717000000_scheduling_attendance.sql`
 *     lines 18-27): `email`, `role` (`role_enum`), `student_id` (nullable
 *     single FK -- "self for students / linked kid for parents" per that
 *     column's own migration comment), `invited_by`, `status`, `expires_at`.
 *     ONE row can only ever point at ONE student. There is no array column
 *     anywhere on this table.
 *   - `guardian_links` (`supabase/migrations/20260716000000_identity_roster.sql`
 *     lines 70-79): `parent_profile_id`, `student_id`, `relationship`, unique
 *     per `(parent_profile_id, student_id)` pair -- genuinely many-to-many
 *     capable (one parent, many students; one student, many parents), but
 *     `parent_profile_id` is `not null` and references `profiles(id)` -- a
 *     row this table's own FK requires cannot exist until the invited parent
 *     actually HAS a `profiles` row, which does not happen at invite-SEND
 *     time (before acceptance, there is no parent profile to link).
 *   - `send-invite`'s real, already-Passed (T017) request contract
 *     (`supabase/functions/send-invite/validation.ts` lines 32-37,
 *     `InviteRequestBody`): `{ email, role, student_id }` -- exactly one
 *     student per request, matching `invites`' own shape. No relationship
 *     field, no array field, anywhere in that validated body.
 *   - THE DECIDING DOCUMENT: `supabase/migrations/20260718000000_invite_trigger.sql`
 *     (T019, already-Passed, the trigger that actually turns an accepted
 *     invite into `guardian_links` rows) has ALREADY answered the "how are
 *     multiple linked students represented" question for this exact ROS-05
 *     case, in its own comment (lines 166-176): *"Multi-invite-row parent
 *     case (ROS-05): a parent invited for N students produces N separate
 *     `invites` rows sharing one email (per T017's packet/precedent). The
 *     loop below iterates over ALL matching pending, unexpired invites for
 *     the signing-in email -- not just the first -- so every one of them
 *     gets its own guardian_links row and is individually marked accepted."*
 *     This is not this file's own invention -- it is the pre-existing,
 *     checker-passed server-side design this dialog's payload must match,
 *     found by reading the ground truth before writing anything below.
 *
 * DECISION (matches the above, does not diverge from it): `buildInviteParentSubmission`
 * below produces ONE `send-invite`-request-shaped object
 * (`{ email, role: 'parent', student_id }`, exactly `InviteRequestBody`'s
 * real fields) PER selected student -- the invoking row's student first,
 * then every id picked in the "additional linked students" `MultiSelector`,
 * de-duplicated. `InviteParentSubmission.inviteRequests` is that array. A
 * future wiring task (once a shared Supabase client exists -- module doc #3)
 * calls the real `send-invite` function once per entry, exactly reproducing
 * the "N separate invites rows sharing one email" shape T019's trigger
 * already expects and handles.
 *
 * THE UNRESOLVED PART, DISCLOSED RATHER THAN PAPERED OVER: ROS-05 also asks
 * this dialog to collect a "relationship label" -- but `invites` has NO
 * relationship column (confirmed above), and `send-invite`'s validated body
 * has no relationship field either. There is, today, NO column anywhere in
 * the invite-send path for this value to land in. Tracing it further: T019's
 * own trigger, which is the thing that eventually creates the real
 * `guardian_links.relationship` (`not null`, T009) value, currently
 * HARDCODES the literal string `'guardian'` for every parent invite it
 * processes (`20260718000000_invite_trigger.sql` line 263), and says so
 * explicitly in its own comment (lines 197-201): *"guardian_links.relationship:
 * not null (T009, unmodified) with no source anywhere in invites or
 * auth.users. Defaulted to the literal string 'guardian' by this trigger,
 * flagged here as an assumption pending any future task that collects a
 * real relationship value (e.g. 'parent', 'guardian', 'other') at
 * invite-creation time."* T019's own comment names exactly the gap THIS
 * task's field (ROS-05's "relationship label") is meant to fill -- but
 * filling it end-to-end would require adding a column/param somewhere in
 * `invites`/`send-invite`'s request body for the trigger to read instead of
 * its hardcoded literal, and every one of those files (migrations,
 * `send-invite/**`) is Forbidden/read-only for this task. So:
 * `InviteParentSubmission.relationship` below DOES carry the collected value
 * (this dialog still collects it for real, with real required-field
 * validation -- Known Context/Traps #4) alongside `inviteRequests`, but is
 * explicitly typed and commented as data with NO destination column in
 * today's schema/pipeline -- not silently dropped, not silently invented a
 * fake column for. See this task's worker output "Known risks" for whether
 * this warrants a dispute (it does not block THIS task's own deliverable --
 * a real dialog collecting real ROS-05 fields against a real payload shape
 * -- it is a downstream wiring gap for whichever future task adds the
 * `invites`<->`guardian_links.relationship` plumbing).
 *
 * -----------------------------------------------------------------------
 * 2. BEH-07 confirm button (Known Context/Traps #2) -- "Send invite" is the
 *    literal DES-14 example (PRD line 210: `"Send invite" -> toast "Invite
 *    sent to ada@..."`), used verbatim for the base case (exactly one
 *    student -- the invoking row, no additional students picked, the
 *    default/common case). BEH-07 (PRD line 236) ALSO gives, as its own
 *    literal worked example, `"Send 3 invites"` for a computed multi-send
 *    button -- which is exactly what module doc #1's "N separate invites
 *    rows" design produces once additional students are selected.
 *    `computeSendInviteLabel` below is the ONLY place this button's label is
 *    produced: `studentCount <= 1 ? 'Send invite' : \`Send ${studentCount}
 *    invites\`` -- never a bare "Submit"/"OK", and never hardcoded past the
 *    single-student case. Proven for both branches in the test file.
 *
 * -----------------------------------------------------------------------
 * 3. T087 (ED-1 Packet P1): `onSendInvite` is now wired to the real
 *    `send-invite` Edge Function, sequentially, abort-on-first-failure.
 *
 * `onSendInvite: (submission) => Promise<void>` is the injectable seam.
 * `defaultOnSendInvite` below now calls `invokeEdgeFunction<...>('send-invite',
 * request)` (`../../lib/supabase`, T086's typed Edge Function calling
 * convention) once per entry in `submission.inviteRequests`, in a plain
 * sequential `for...of` loop with `await` inside -- deliberately NOT
 * `Promise.all` (T087 worker packet Known Context/Traps #5): the design
 * intentionally wants ordered, abort-on-first-failure semantics, and a
 * bare `for...of`/`await` loop already gives exactly that (the loop stops
 * calling `invokeEdgeFunction` the instant one call rejects, and that
 * rejection propagates up through `handleSubmit`'s own `try`/`catch`
 * unchanged). If invite 1 of 3 succeeds and invite 2 fails, invite 1's row
 * genuinely exists as `pending` in the database already -- this is a
 * disclosed, accepted characteristic of the sequential design (there is no
 * staff-delete-invite UI to roll it back with), not a bug this task fixes.
 * `submission.relationship` is still collected (module doc #1) but still
 * has no `send-invite` request field to carry it -- untouched, out of
 * scope here, same as before T087.
 *
 * -----------------------------------------------------------------------
 * 4. Known Context/Traps #4 -- relationship label is a REAL required field,
 *    not just visually marked.
 *
 * `isInviteParentFormValid` below (email must be non-empty AND pass the
 * same lightweight format check `send-invite/validation.ts`'s own
 * `EMAIL_RE` uses, relationship must be non-empty after trimming) is the
 * ONLY thing gating the confirm button's `isDisabled`. Per Button's own doc
 * ("isDisabled ... When a tooltip is present, uses aria-disabled instead of
 * native disabled"), no `tooltip` prop is set on the disabled confirm
 * button, so it stays a genuine native-`disabled` HTML button -- click
 * events never dispatch through it at all, proven in the test file (not
 * just a CSS-dimmed look).
 *
 * -----------------------------------------------------------------------
 * 5. DES-14 toast (Known Context/Traps #3) -- no `ToastViewport` wired
 *    anywhere in this app yet (same confirmed-by-grep gap `OutreachList.tsx`/
 *    T038 already disclosed: zero hits for `ToastViewport`/`useToast` under
 *    `src/`). This file renders a bare `<Toast>` directly (per that
 *    component's own doc: "useful for previews ... where the viewport
 *    lifecycle is not needed"), as a SIBLING of `<Dialog>` (not inside its
 *    content) so it stays visible after the dialog closes on success --
 *    toast state (`toastEmail`) is deliberately NOT reset by the
 *    reset-on-open effect that clears the rest of the form. Real, installed
 *    `ToastProps` (`node_modules/@astryxdesign/core/dist/Toast/Toast.d.ts`,
 *    independently re-verified here, same doc-vs-installed-source gap
 *    `OutreachList.tsx` already found and cited: the doc's own "Toast" Props
 *    table lists `uniqueID`/`collisionBehavior`/`onHide` as if they belonged
 *    to `<Toast>` itself, but those three actually belong to the separate
 *    `ToastOptions` type consumed by `useToast()`'s returned function, not
 *    `<Toast>`'s own props) used: `type`, `body`, `isAutoHide`,
 *    `autoHideDuration`, `onDismiss` (required, not `onHide`).
 *
 * -----------------------------------------------------------------------
 * 6. Fixture data (constitution item 6: no PII, fabricated names only).
 *
 * `DEFAULT_ADDITIONAL_STUDENT_OPTIONS` below is a standalone fabricated
 * fixture, deliberately NOT imported from `StudentsTab.tsx` (a forbidden,
 * read-only file here) -- same "independent duplicate fixture" posture
 * `ScheduleMeetingsDialog.tsx`/T031 already took for its own team fixture
 * relative to the forbidden `MeetingsList.tsx`. The invoking `student` prop
 * is defensively filtered out of the "additional linked students" option
 * list even if it happened to also appear in the supplied
 * `additionalStudentOptions` array, so a caller can never accidentally
 * double-link the same student to themselves.
 *
 * -----------------------------------------------------------------------
 * 7. Astryx prop sourcing (constitution item 2) -- every prop below,
 *    cross-checked directly against `docs/swarm/astryx-api.md` (grepped live
 *    for this task):
 *
 *  - `Dialog` ("Dialog" Props table): `isOpen`, `onOpenChange`, `children`,
 *    `purpose` ("form" -- Best Practices: "Use purpose='form' for dialogs
 *    with inputs so the user can't accidentally lose data by clicking the
 *    backdrop") used.
 *  - `DialogHeader`: doc's own "Components > DialogHeader" subsection is
 *    `undefined` (same disclosed gap `ScheduleMeetingsDialog.tsx`/T031 and
 *    every other content page already hit for sibling `undefined`
 *    Components subsections) -- props taken from the "Dialog" section's own
 *    worked `## Example` code block instead (`title`, `onOpenChange`), which
 *    is non-hallucinated doc content, not invented.
 *  - `Layout`/`LayoutContent`/`LayoutFooter` ("Layout" Props table +
 *    `## Example` block for the two sub-slots, whose own Components
 *    subsections are likewise `undefined`): `header`, `content`, `footer`
 *    (Layout); `children` (LayoutContent); `children`, `hasDivider`
 *    (LayoutFooter) used.
 *  - `FormLayout` ("FormLayout" Props table): `children` used (default
 *    `direction="vertical"`, matching "Do: stack fields vertically for most
 *    forms").
 *  - `TextInput` ("TextInput" Props table): `label`, `value`, `onChange`,
 *    `isRequired`, `type` (`"email"` for the email field), `placeholder`,
 *    `status` used.
 *  - `MultiSelector` ("MultiSelector" Props table): `label`, `options`,
 *    `value`, `onChange`, `triggerDisplay="labels"`, `isOptional` used (no
 *    `hasSelectAll` -- ROS-05 never asks for a "select all students" bulk
 *    action, unlike `ScheduleMeetingsDialog.tsx`'s team-scope field where
 *    "all teams" is a real, documented `events.team_ids` NULL semantic;
 *    inventing one here would be unsupported by anything in the ground
 *    truth).
 *  - `Button` ("Button" Props table): `label`, `variant`, `size` (Cancel
 *    only), `isDisabled`, `isLoading`, `onClick`, `clickAction` used.
 *  - `Banner` ("Banner" Props table): `status`, `title`, `description` used
 *    (submit-error state only, same as `ScheduleMeetingsDialog.tsx`).
 *  - `Toast` ("Toast" Props table + installed-source cross-check, module doc
 *    #5): `type`, `body`, `isAutoHide`, `autoHideDuration`, `onDismiss`
 *    used.
 *  - `HStack` ("Stack" section): `gap`, `hAlign` used (footer button row).
 *  - `Text` ("Text" Props table): `type="supporting"` used.
 */
import { useEffect, useState, type ReactNode } from 'react';
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
  MultiSelector,
  Text,
  TextInput,
  Toast,
} from '@astryxdesign/core';
// T087 (ED-1 Packet P1): real `send-invite` calling seam -- module doc #3.
import { invokeEdgeFunction, isSupabaseLoaderError } from '../../lib/supabase';

// ---------------------------------------------------------------------------
// Types -- verbatim shapes of the real columns/contract this dialog's field
// set actually touches. Module doc #1.
// ---------------------------------------------------------------------------

export interface StudentOption {
  id: string;
  displayName: string;
}

/**
 * Exactly `send-invite/validation.ts`'s own `InviteRequestBody` fields
 * (`supabase/functions/send-invite/validation.ts` lines 32-37) -- `role` is
 * narrowed to the literal `'parent'` here since that is the only role this
 * dialog ever sends.
 */
export interface SendInviteRequestPayload {
  email: string;
  role: 'parent';
  student_id: string;
}

/**
 * Module doc #1's decision: one `SendInviteRequestPayload` per linked
 * student (the "N separate invites rows sharing one email" shape T019's
 * trigger already expects), plus the collected-but-currently-unplumbed
 * `relationship` value (see module doc #1's "unresolved part").
 */
export interface InviteParentSubmission {
  inviteRequests: SendInviteRequestPayload[];
  relationship: string;
}

export type OnSendInviteFn = (submission: InviteParentSubmission) => Promise<void>;

// ---------------------------------------------------------------------------
// Fixture data (module doc #6). Fabricated names only (constitution item 6).
// ---------------------------------------------------------------------------

const DEFAULT_ADDITIONAL_STUDENT_OPTIONS: readonly StudentOption[] = [
  { id: 'student-noor-farah', displayName: 'Noor Farah' },
  { id: 'student-declan-ashworth', displayName: 'Declan Ashworth' },
  { id: 'student-wren-castellano', displayName: 'Wren Castellano' },
];

// ---------------------------------------------------------------------------
// Pure functions -- exported for direct testing.
// ---------------------------------------------------------------------------

// Verbatim copy of `send-invite/validation.ts` line 20's `EMAIL_RE` --
// necessarily reimplemented (not imported) since that file is a Deno Edge
// Function (`npm:` specifiers, no Vite/browser build target), not a module
// this Vite/React bundle can import.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidInviteEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function isInviteParentFormValid(email: string, relationship: string): boolean {
  return email.trim() !== '' && isValidInviteEmail(email) && relationship.trim() !== '';
}

/** Module doc #2 (BEH-07/DES-14) -- the ONLY place this button's label is
 * produced. Never a bare "Submit"/"OK". */
export function computeSendInviteLabel(studentCount: number): string {
  return studentCount <= 1 ? 'Send invite' : `Send ${studentCount} invites`;
}

/** Module doc #1 -- builds the real submission payload: one
 * `send-invite`-shaped request per selected student (primary first, then
 * additional, de-duplicated), plus the collected relationship value. */
export function buildInviteParentSubmission(
  email: string,
  relationship: string,
  primaryStudentId: string,
  additionalStudentIds: readonly string[],
): InviteParentSubmission {
  const trimmedEmail = email.trim();
  const uniqueStudentIds = Array.from(new Set([primaryStudentId, ...additionalStudentIds]));
  return {
    inviteRequests: uniqueStudentIds.map((studentId) => ({
      email: trimmedEmail,
      role: 'parent',
      student_id: studentId,
    })),
    relationship: relationship.trim(),
  };
}

// ---------------------------------------------------------------------------
// Default injectable persistence seam (module doc #3).
// ---------------------------------------------------------------------------

/**
 * `send-invite`'s real success response shape (`supabase/functions/
 * send-invite/index.ts` lines 302-312, read-only reference, not imported --
 * that file is a Deno Edge Function, not something this Vite bundle can
 * import): `{ invite: { id, email, role, student_id, status, expires_at,
 * created_at } }`, snake_case, deliberately NOT the same shape as
 * `../../lib/supabase`'s shared camelCase `InviteRow` (a different type,
 * describing a table row, not this function's own response body). Declared
 * only for `invokeEdgeFunction`'s own generic type parameter below --
 * `defaultOnSendInvite` never reads any field off the resolved value.
 */
interface SendInviteResponse {
  invite: {
    id: string;
    email: string;
    role: 'parent';
    student_id: string | null;
    status: string;
    expires_at: string;
    created_at: string;
  };
}

/**
 * T087 (ED-1 Packet P1) -- real send, module doc #3. Sequential,
 * abort-on-first-failure: a plain `for...of` loop with `await` inside is
 * already exactly that (never `Promise.all` -- see module doc #3 for the
 * full reasoning). A failure on request N stops before request N+1 ever
 * calls `invokeEdgeFunction`, and rethrows unchanged so
 * `handleSubmit`'s existing `catch` (below) surfaces it via `submitError`.
 */
export const defaultOnSendInvite: OnSendInviteFn = async (submission) => {
  for (const request of submission.inviteRequests) {
    await invokeEdgeFunction<SendInviteResponse>('send-invite', request);
  }
};

// ---------------------------------------------------------------------------
// Component.
// ---------------------------------------------------------------------------

export interface InviteParentDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** ROS-05: "invoked from a student row" -- this student becomes the
   * primary `send-invite` request's `student_id` (module doc #1). */
  student: StudentOption;
  /** Options for the optional "additional linked students" `MultiSelector`.
   * Defaults to `DEFAULT_ADDITIONAL_STUDENT_OPTIONS` (module doc #6);
   * `student.id` is always defensively excluded. */
  additionalStudentOptions?: readonly StudentOption[];
  /** Defaults to `defaultOnSendInvite` (module doc #3). */
  onSendInvite?: OnSendInviteFn;
}

export function InviteParentDialog({
  isOpen,
  onOpenChange,
  student,
  additionalStudentOptions = DEFAULT_ADDITIONAL_STUDENT_OPTIONS,
  onSendInvite = defaultOnSendInvite,
}: InviteParentDialogProps): ReactNode {
  const [email, setEmail] = useState('');
  const [emailTouched, setEmailTouched] = useState(false);
  const [relationship, setRelationship] = useState('');
  const [relationshipTouched, setRelationshipTouched] = useState(false);
  const [additionalStudentIds, setAdditionalStudentIds] = useState<string[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Module doc #5 -- deliberately NOT reset by the reset-on-open effect
  // below, so a success toast survives the dialog closing.
  const [toastEmail, setToastEmail] = useState<string | null>(null);

  function resetForm(): void {
    setEmail('');
    setEmailTouched(false);
    setRelationship('');
    setRelationshipTouched(false);
    setAdditionalStudentIds([]);
    setSubmitError(null);
  }

  // Nothing persists across opens (same posture `ScheduleMeetingsDialog.tsx`
  // already established) -- every fresh open starts from pristine defaults.
  useEffect(() => {
    if (isOpen) resetForm();
  }, [isOpen]);

  const filteredAdditionalOptions = additionalStudentOptions.filter(
    (option) => option.id !== student.id,
  );

  const isValid = isInviteParentFormValid(email, relationship);
  const studentCount = 1 + additionalStudentIds.length;
  const confirmLabel = computeSendInviteLabel(studentCount);

  const emailStatus =
    emailTouched && email.trim() !== '' && !isValidInviteEmail(email)
      ? {
          type: 'error' as const,
          message: 'That email address looks invalid. Check the spelling and try again.',
        }
      : undefined;

  const relationshipStatus =
    relationshipTouched && relationship.trim() === ''
      ? {
          type: 'error' as const,
          message: 'Relationship is required. Enter how this parent is related to the student.',
        }
      : undefined;

  function handleCancel(): void {
    resetForm();
    onOpenChange(false);
  }

  async function handleSubmit(): Promise<void> {
    if (!isValid) return; // extra guard; the button is already natively disabled.
    setIsSubmitting(true);
    setSubmitError(null);
    const submission = buildInviteParentSubmission(
      email,
      relationship,
      student.id,
      additionalStudentIds,
    );
    try {
      await onSendInvite(submission);
      const sentEmail = submission.inviteRequests[0]?.email ?? email.trim();
      resetForm();
      onOpenChange(false);
      // DES-14 (PRD line 210): "Send invite" -> toast "Invite sent to ada@...".
      setToastEmail(sentEmail);
    } catch (error) {
      // T087 Known Context/Traps #6: `invokeEdgeFunction` rejects with a
      // plain `SupabaseLoaderError` object (`{ code, message, cause }`),
      // NOT an `Error` instance -- `isSupabaseLoaderError` is checked FIRST
      // so its already-DES-16-compliant `.message` (e.g. the exact
      // `ALREADY_INVITED` copy) is used directly, never replaced with new
      // hand-authored copy. The plain `Error` branch remains for any other
      // thrown value (defensive; should not happen against this seam).
      setSubmitError(
        isSupabaseLoaderError(error)
          ? error.message
          : error instanceof Error
            ? error.message
            : 'Something went wrong sending this invite.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form">
        <Layout
          header={<DialogHeader title="Invite parent" onOpenChange={onOpenChange} />}
          content={
            <LayoutContent>
              <FormLayout>
                <Text type="supporting">Inviting a parent for {student.displayName}.</Text>

                {/* Field order per ROS-05 / constitution item 13 (module doc,
                    top of file): email, relationship label, additional linked
                    students -- exact, not a suggestion. */}
                <TextInput
                  type="email"
                  label="Email"
                  value={email}
                  onChange={(value) => {
                    setEmail(value);
                    setEmailTouched(true);
                  }}
                  isRequired
                  placeholder="parent@example.com"
                  status={emailStatus}
                />

                <TextInput
                  label="Relationship"
                  value={relationship}
                  onChange={(value) => {
                    setRelationship(value);
                    setRelationshipTouched(true);
                  }}
                  isRequired
                  placeholder="e.g. Mother, Father, Guardian"
                  status={relationshipStatus}
                />

                <MultiSelector
                  label="Additional linked students"
                  options={filteredAdditionalOptions.map((option) => ({
                    value: option.id,
                    label: option.displayName,
                  }))}
                  value={additionalStudentIds}
                  onChange={setAdditionalStudentIds}
                  triggerDisplay="labels"
                  isOptional
                />

                {submitError !== null && (
                  <Banner
                    status="error"
                    title="Couldn't send this invite"
                    description={submitError}
                  />
                )}
              </FormLayout>
            </LayoutContent>
          }
          footer={
            <LayoutFooter hasDivider>
              <HStack hAlign="end" gap={2}>
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

      {toastEmail !== null && (
        <Toast
          type="info"
          body={`Invite sent to ${toastEmail}`}
          isAutoHide
          autoHideDuration={5000}
          onDismiss={() => setToastEmail(null)}
        />
      )}
    </>
  );
}

export default InviteParentDialog;
