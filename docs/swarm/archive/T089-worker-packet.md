# Worker Packet: T089

## Task ID
T089 — ED-1 Packet P2 (expanded scope): real Students tab load/mutations, AND wiring
`StudentsTab.tsx` to its own dialogs for the first time.

## Objective
The original ED-1 design scoped this packet as "real load + `StudentDialog` submit +
row actions." Investigation before dispatch found the real gap is bigger: **every row
action except Deactivate is currently a pure stub notice** ("not implemented yet"
banner text) — `StudentDialog` and `InviteParentDialog` are never even imported into
`StudentsTab.tsx`, and there is no "Add student" trigger anywhere on the page at all.
Deactivate is the one real interaction (opens a genuine `AlertDialog`), but its confirm
handler only flips local state (`withActiveOverride`), never writes to the database.

This packet does two things together, since they're inseparable in practice (a wired
mutation nobody can trigger via UI isn't actually done):
1. Real Supabase wiring: load, deactivate/reactivate mutations, invite-student send,
   `StudentDialog`'s create/edit submit.
2. UI wiring: an "Add student" trigger, and rendering `StudentDialog`/
   `InviteParentDialog` from within `StudentsTab.tsx` so the existing row-action menu
   items (Edit, Invite parent) actually open something instead of showing a stub
   banner.

This mirrors exactly the class of gap T085 found and fixed for `RosterShell.tsx` — a
component built correctly in isolation, never actually connected to its neighbors.

## Allowed Files
- `src/lib/supabase/loaders/students.ts` (new)
- `src/pages/roster/StudentsTab.tsx`, `StudentsTab.test.tsx`
- `src/pages/roster/StudentDialog.tsx`, `StudentDialog.test.tsx`

## Forbidden Files
- `src/pages/roster/InviteParentDialog.tsx` (T087, already real and Passed —
  import/render it, do not modify its internals).
- `src/lib/supabase/loaders/invites.ts`, `types.ts`, `loader.ts`, `functions.ts`,
  `client.ts`, `auth.ts`, `index.ts` — read-only imports, already correct.
- `src/pages/settings/SeasonSettings.tsx`, any `SeasonProvider` — a parallel packet
  (T091) owns season wiring; do not attempt to source `StudentDialog`'s `season` prop
  from anything but its existing fixture default (see Trap #4).
- Every other file. `router.tsx`, `guards.tsx`, `RosterShell.tsx`, `docs/swarm/**`,
  `.claude/**`.

## Known Context / Traps

**1. Real load.** `LoadStudentsTabDataFn = () => Promise<StudentsTabLoadResult>` where
`StudentsTabLoadResult = { students: readonly StudentRow[]; teams: readonly TeamRow[];
invites: readonly InviteRow[] }` (types from T086's `src/lib/supabase/types.ts` — read
that file, don't guess the shapes). Build `loaders/students.ts` with a loader that
fetches all three (`students`, `teams`, `invites` tables — three separate `createLoader`
calls or one loader that issues three queries and combines them, your choice, document
it) and maps each into the shared row types. `staff_all`/`read_all` RLS applies
(`StudentsTab` only renders for admin/coach, same posture as T087's `InvitesTab`
reasoning — an empty result is genuinely "no students yet," not an RLS false-empty).

**2. Deactivate/Reactivate — a real mutation, not local state.** `withActiveOverride`
(existing, pure, keep it as the OPTIMISTIC local-state updater) should be paired with a
real `runMutation` call updating `students.is_active`. On mutation failure, the existing
optimistic update must roll back (mirror the pattern T082 already established
project-wide for this exact "optimistic update + rollback on rejection" shape — grep
`SeasonSettings.tsx`/`TeamsTab.tsx` for precedent if useful).

**3. Invite-student row action — a real `send-invite` call, role `'student'`.** Import
`invokeEdgeFunction` directly from `src/lib/supabase` (T086's helper — this is a
different flow from T087's `InviteParentDialog`, which sends `role: 'parent'`; here you
send `{ email, role: 'student', student_id: row.id }`). **Where does the email come
from?** There is currently no "enter an email for this student" UI at all — read
`shouldShowInviteAction`'s existing logic (only shown when `accountStatus ===
'no_account'`) and decide: does this action need its own small email-entry UI (e.g. a
tiny inline prompt/dialog), or does it belong on `StudentDialog`'s existing
`inviteEmail` field (module doc #1 notes this field already exists on
`StudentFormPayload`, "NOT a `students` column")? Investigate `StudentDialog.tsx`'s
`inviteEmail` handling before deciding — it may already be the intended real answer
(edit the student, supply an email, submit triggers both the `students` update AND a
`send-invite` call) rather than a separate one-off action. State your decision and
reasoning clearly; this is a real judgment call, not a guess-and-hope situation.

**4. `StudentDialog`'s `teams`/`season` props.** `teams` should become real — source it
from `StudentsTab`'s own already-loaded `teams` data when rendering `StudentDialog`
(map `TeamRow[]` to `StudentDialogTeamOption[]`, excluding nothing extra — the dialog's
own `filterSelectableTeams` already excludes archived ones). **`season` stays on its
existing fixture default (`DEFAULT_SEASON_INFO`)** — a parallel packet (T091) is
building the real season-data mechanism and threading it everywhere else; hooking this
one dialog into it now would create an ordering dependency between two packets meant to
run independently. Leave a one-line comment noting this is intentionally still fixture-
backed pending that follow-up.

**5. Wire the dialogs into the page for the first time.** Add local `isAddDialogOpen`/
`editTarget: StudentDisplayRow | null` (or equivalent) state; render `<StudentDialog
isOpen={...} onOpenChange={...} initialData={...} teams={...} onSubmit={...} />` once,
switching between create/edit via `initialData` (omit for create, per the component's
own documented mode-detection). Add a real "Add student" trigger (a `Button` near the
existing page controls — match the visual pattern other tabs use for their primary
action, e.g. check `TeamsTab.tsx`/`InvitesTab.tsx` for how they place a page-level
action button, if any exist there). Replace `handleEdit`'s stub-notice call with opening
the dialog in edit mode (you'll need to resolve a `StudentDisplayRow` back to
`StudentDialogInitialData` — check what fields `StudentDialogInitialData` needs
vs. what `StudentDisplayRow` has; some fields like `hasAccount` may need deriving from
`accountStatus`). Replace `handleInviteParent`'s stub-notice call with opening the real
`InviteParentDialog` (import it — no longer forbidden to you, it's the render target).
Remove the now-dead `EDIT_STUB_NOTICE`/`INVITE_PARENT_STUB_NOTICE` constants and their
`StubNotice` plumbing for exactly these two actions once real dialogs replace them —
`inviteStudentStubNotice`/`viewHistoryStubNotice` may stay if Trap #3/View-history
remain out of scope (View History has no destination page yet anywhere in the app —
correctly leave it as a stub, do not invent a history page).

**6. `StudentDialog.onSubmit` — real create/edit mutation.** `OnSubmitStudentFn =
(payload: StudentFormPayload, mode: StudentDialogMode) => Promise<void>`. Create: insert
into `students`. Edit: update the existing row by id (the dialog's `initialData` should
carry the id through — check how, since `StudentFormPayload` itself has no `id` field;
you may need to close over the id from the dialog's own open-state rather than the
payload). `StudentFormPayload.inviteEmail` — see Trap #3's investigation; if you
conclude this field is the real invite mechanism, the submit handler (in
`StudentsTab.tsx`, which owns the real `onSubmit` wiring, not `StudentDialog.tsx`
itself which just collects the payload) should fire the `send-invite` call after a
successful student create/update when `inviteEmail` is non-null.

**7. Test files.** Update both test files: existing tests that rendered bare and
asserted the old fixture-default behavior now need the fixture injected explicitly
through the seam (established pattern — see T087's own test updates for the exact
style). Add real tests proving: load genuinely queries the three tables and maps
correctly; deactivate/reactivate genuinely mutate with rollback-on-failure; Add/Edit
genuinely open `StudentDialog` in the right mode with the right `initialData`; Invite
Parent genuinely opens the real `InviteParentDialog`; your Trap #3 resolution is
genuinely tested end-to-end.

## Acceptance Criteria
- `StudentsTab.tsx`'s default `loadData` is real; Deactivate/Reactivate are real
  mutations with rollback-on-failure; "Add student" trigger exists and opens
  `StudentDialog` in create mode; Edit opens it in edit mode with correct pre-filled
  data; Invite Parent opens the real `InviteParentDialog`.
- Your Trap #3 (invite-student email source) decision is implemented, tested, and its
  reasoning is documented in your output.
- `StudentDialog`'s `teams` prop is real; `season` prop is deliberately still fixture-
  backed (documented, not silently left).
- No new hand-authored error copy — errors surface via existing
  `SupabaseLoaderError.message`.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run
  format:check` all clean, zero regressions elsewhere.

## Relevant Constitution Excerpts
> No worker may mark its own work complete; every PASS requires independent
> checker-inspected evidence.

## Most Recent Failure
None. This is attempt 1 for T089 (attempt count: 0) — first dispatch.

## Required Worker Output
- Full diff of every changed/new file.
- Your Trap #3 investigation and decision (invite-student email source) in full.
- Confirmation of what "Add student"/Edit/Invite Parent UI wiring now does, with enough
  detail a checker can verify without re-deriving your reasoning from scratch.
- Full test/typecheck/lint/build/format:check output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
