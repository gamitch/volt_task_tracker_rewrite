# Worker Packet: T096

## Task ID
T096 — ED-1 Packet P7 (expanded scope): real `MeetingsList.tsx` data + real Cancel
mutation + wiring `ScheduleMeetingsDialog.tsx` into `MeetingsList.tsx` for the first
time.

## Objective
Investigation before dispatch found the same class of gap found repeatedly elsewhere
this epic: `MeetingsList.tsx`'s "Schedule" and "Edit" actions are pure stub notices
today (`showScheduleStub`/`showEditStub`, literally titled "Scheduling dialog not built
yet") — even though `ScheduleMeetingsDialog.tsx` **already exists, is already built, and
already has a real injectable `onCreateMeetings` seam.** `MeetingsList.tsx` was written
before `ScheduleMeetingsDialog.tsx` and was never updated to actually import/render it.
Cancel is real-looking (a genuine `AlertDialog`) but only flips local state, never
persists.

This packet: (1) wires `MeetingsList.tsx`'s real load, (2) wires Cancel to a real
mutation, (3) wires `MeetingsList.tsx` to actually render `ScheduleMeetingsDialog` for
both Schedule (create) and Edit, replacing the stub notices, and (4) resolves the
`studentId = PLACEHOLDER_CURRENT_STUDENT_ID` placeholder used by the student/parent view
to a real value (see Trap #3 — this is a genuinely new kind of resolution problem, not
just a season-style hook reuse).

## Allowed Files
- `src/lib/supabase/loaders/meetings.ts` (new)
- `src/pages/meetings/MeetingsList.tsx`, `MeetingsList.test.tsx`

## Forbidden Files
- `src/pages/meetings/ScheduleMeetingsDialog.tsx` — already correct, read-only import
  (render it, do not modify its internals).
- `src/pages/meetings/LiveConsole.tsx`, `EndMeetingDialog.tsx`, `Kiosk.tsx`,
  `StudentMeetingView.tsx` — separate future packets (P8/P9), not this one.
- `src/lib/supabase/types.ts`, `loader.ts`, `functions.ts`, `client.ts`, `auth.ts`,
  `index.ts` — read-only, already correct.
- `src/app/SeasonProvider.tsx` — do not import `useActiveSeason` here; `MeetingsList`
  is not season-scoped in its own type signatures today, don't invent that scope.
- Every other file. `router.tsx`, `guards.tsx`, `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. Real load — two seams, coach view and student/parent view.**
`LoadCoachMeetingsDataFn = () => Promise<CoachMeetingsData>` (real query against
`events`/`event_sessions` where `events.event_type = 'meeting'`, verify the exact
enum/filter condition yourself against the migration — don't assume the column name).
`LoadStudentMeetingsDataFn = (studentId: string) => Promise<StudentMeetingsData>` —
likely also needs `attendance` joined in for the student's own consistency-strip/history
data; read `StudentMeetingsData`'s exact shape in the file before building the query.

**2. Cancel — a real mutation.** `handleConfirmCancel`'s current body only does
`setRows((prev) => prev.map(row => row.sessionId === cancelTarget.sessionId ? {...row,
status:'canceled'} : row))`. Pair this with a real `runMutation` updating
`event_sessions.status = 'canceled'` for the target session, with rollback-on-failure
matching the optimistic pattern used everywhere else in this codebase now (see
`StudentsTab.tsx`'s `setStudentActive` wiring, T089, for the exact shape to mirror).

**3. Wire `ScheduleMeetingsDialog` for real — both create and edit.** Add dialog-open
state to `MeetingsList.tsx` (mirroring exactly how T089 added `isAddDialogOpen`/
`editTarget` to `StudentsTab.tsx` for its own previously-stubbed Add/Edit actions).
Replace `showScheduleStub()`'s call site with opening the dialog in create mode; replace
`showEditStub(row)`'s call site with opening it in edit mode. **Investigate what "edit
mode" means for `ScheduleMeetingsDialog`** — its `CreateMeetingsPayload` shape
(`{event, sessions}`) suggests it may be purpose-built for CREATING a whole new
recurring-meeting series, not editing one already-scheduled session in place. Read the
dialog's own props/module doc in full before assuming it supports edit mode at all — if
it genuinely doesn't, that's a real, disclosable finding (not a task for you to solve by
inventing new dialog behavior in a forbidden file); in that case, leave Edit as a
clearly-labeled, honest stub (not the old "not built yet" copy, since the dialog IS
built — write accurate copy explaining what's actually still missing) and document why
in your output.

**4. `studentId = PLACEHOLDER_CURRENT_STUDENT_ID` resolution — genuinely new problem,
not solved by any existing hook.** The student/parent view needs to know which real
`students.id` to scope to. For a logged-in **student**, this should resolve via
`students.profile_id = auth.uid()` (a simple query keyed off the authenticated session
— `useAuth()` is already imported in this file). For a logged-in **parent**, there may
be multiple linked students (`guardian_links`) — investigate whether `MeetingsList`
is expected to handle multi-student parents at all today (check how other
already-real-wired parent-facing surfaces, e.g. `ParentHome.tsx`, handle this same
"which student" question, and follow the same precedent rather than inventing a new
one). State your resolution approach and reasoning clearly — this is a real design
decision within your scope, not a guess-and-hope situation.

**5. Do not silently drop the `PLACEHOLDER_CURRENT_STUDENT_ID` export if tests still
reference it** — check `MeetingsList.test.tsx` and any sibling file importing it before
removing/renaming.

**6. Test files.** Same "inject the fixture explicitly through the seam" pattern
established by every prior ED-1 packet. Add real tests for: real load (both views),
real cancel mutation with rollback, the dialog now genuinely opening/closing for
Schedule and (if applicable per Trap #3) Edit, and your `studentId` resolution logic.

## Acceptance Criteria
- `MeetingsList.tsx`'s coach and student/parent loads are both real.
- Cancel is a real mutation with rollback-on-failure.
- Schedule opens the real `ScheduleMeetingsDialog` in create mode. Edit either opens it
  in a genuinely-working edit mode, or is left as an honest, accurately-worded stub with
  your Trap #3 investigation documented — not the old misleading "dialog not built yet"
  copy either way.
- `studentId` resolves to a real value for the logged-in student/parent, with your
  resolution approach documented.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run
  format:check` all clean, zero regressions elsewhere.

## Relevant Constitution Excerpts
> No worker may mark its own work complete; every PASS requires independent
> checker-inspected evidence.

## Most Recent Failure
None. This is attempt 1 for T096 (attempt count: 0) — first dispatch.

## Required Worker Output
- Full diff of every changed/new file.
- Your Trap #3 (Edit-mode feasibility) and Trap #4 (`studentId` resolution) findings
  and decisions, in full.
- Full test/typecheck/lint/build/format:check output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
