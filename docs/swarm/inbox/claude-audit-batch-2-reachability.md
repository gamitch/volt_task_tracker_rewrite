# Inbox — reachability audit: finished feature areas shipped unmounted

**From branch:** `claude/audit-batch-2` (isolated worktree, separate session)
**Base commit SHA:** `f7ff055a83cc85513728ad14bc63279ec9a6f1de` (`f7ff055`, current tip of `origin/claude/swarm-plan-zl575z` at fetch time)
**Author:** same session as the T168-sweep inbox file in this same batch. Read-only; no source or ledger files touched.

Three known instances of this bug class already exist and are filed as T157/T169 — do not re-file, they're not repeated here: `Leaderboard`, `RsvpControl`, `ParentRsvp`. This audit found the three *more* the same class George expected, plus one separately-noted item that looks similar but isn't the same class.

**Router reachability baseline, confirmed:** exactly 14 pages mount via `src/app/router.tsx:120-138` (`LoginPage`, `AcceptInvitePage`, `DashboardPage`, `MeetingsList`, `LiveConsolePage`, `KioskPage`, `CheckinResult`, `OutreachList`, `OutreachDetail`, `CalendarPage`, `RosterShell`, `ReportsShell`, `SettingsPage`, `SeasonSettings`), plus `NoAccessPage`/`AccessDeniedPage` via `src/app/guards.tsx:441,500`. Everything else checked (see the full list in the closing section) resolved to a genuine production JSX call site — except the three below.

**Method, reusable by the active session:** for each exported component, `grep -rn "<ComponentName" src --include="*.tsx" | grep -v "\.test\.tsx"`, cross-checked against `router.tsx`'s `lazy()` imports and a bare-word sweep (`grep -rn "\bComponentName\b" src ...`) to rule out dynamic/indirect references. All three below returned zero hits by every method; verified again by direct file read in this session (not relayed from tool output alone).

---

## New confirmed findings — same bug class as T157/T169

### Draft T-D1 — `EndMeetingDialog` is fully built, tested, and never mounted

- `src/pages/meetings/EndMeetingDialog.tsx` — `export function EndMeetingDialog({...})` at `:713`, `export default EndMeetingDialog;` at `:909`.
- Test coverage: `src/pages/meetings/EndMeetingDialog.test.tsx`, 489 lines, 21 `it`/`test` blocks — this is finished, tested work, not a stub.
- `grep -rn "<EndMeetingDialog" src --include="*.tsx" | grep -v "\.test\.tsx"` → empty. No `lazy()` entry in `router.tsx`.
- **Self-disclosed in its own module doc** (`:1-8`): *"This is a standalone, injectable-seam component -- it is NOT wired into `LiveConsole.tsx`/any route by this task (both forbidden files here, read-only reference only per this task's packet)."*
- **Corroborating evidence at the intended host:** `src/pages/meetings/LiveConsole.tsx:254-264` — its "End meeting" button currently shows a dismissible `Banner` stating the real end-of-meeting summary dialog (T036, i.e. this file) "has not shipped yet," in place of rendering `EndMeetingDialog`.
- Draft allowed files: `src/pages/meetings/LiveConsole.tsx` — replace the stub banner/button with a real `<EndMeetingDialog>`, wiring whatever session/attendance data it needs per its own props signature.

### Draft T-D2 — `MarkDayCompleteDialog` is fully built, tested, and never mounted

- `src/pages/outreach/MarkDayCompleteDialog.tsx` — `export function MarkDayCompleteDialog({...})` at `:648`, `export default MarkDayCompleteDialog;` at `:881`.
- Test coverage: `src/pages/outreach/MarkDayCompleteDialog.test.tsx`, 643 lines, 26 `it`/`test` blocks.
- `grep -rn "<MarkDayCompleteDialog" src --include="*.tsx" | grep -v "\.test\.tsx"` → empty.
- `src/pages/outreach/OutreachDetail.tsx` (the page that logically hosts day-completion) imports its sibling `MarkEventCompleteDialog` (`:392`) but never imports this component at all.
- **Self-disclosed in its own module doc** (`:18-22`): *"`OutreachDetail.tsx` (T041) is a forbidden/read-only file here and is NOT wired to this dialog by this task; a future wiring task connects that page's own (currently-stubbed) 'Mark day complete' action to this component."*
- Note: this component also carries its own placeholder-defaulted prop (`currentUserProfileId = PLACEHOLDER_CURRENT_COACH_PROFILE_ID`, `:655`) — moot until it's mounted; see `claude-audit-batch-2-t168-sweep.md`'s cross-reference section.
- Draft allowed files: `src/pages/outreach/OutreachDetail.tsx` — wire the existing "Mark day complete" action to render this component instead of its current stub, threading `currentUserProfileId` from real auth context (not the placeholder default) at the same time.

### Draft T-D3 — `StudentMeetingView`'s top-level wrapper is fully built, tested, and never mounted (its sibling export `ConsistencyStrip` IS reachable — don't conflate the two)

- `src/pages/meetings/StudentMeetingView.tsx` — `export function StudentMeetingView({...})` at `:1050`, `export default StudentMeetingView;` at `:1077`.
- Test coverage: `src/pages/meetings/StudentMeetingView.test.tsx`, 946 lines, 45 `it`/`test` blocks, including dedicated `describe` blocks for both the `"own"` and `"linked"` variants of the wrapper itself.
- `grep -rn "<StudentMeetingView" src --include="*.tsx" | grep -v "\.test\.tsx"` → empty.
- **Important nuance, confirmed by direct read:** the same file also exports `ConsistencyStrip` (`:698`, `<ConsistencyStrip` rendered internally at `:810`), which **is** reachable — `src/pages/home/ParentHome.tsx:1191` renders `<ConsistencyStrip entries={data.consistencyEntries} participation={data.participation} />`, imported at `ParentHome.tsx:341-347`. So this finding is scoped to the outer `StudentMeetingView` wrapper specifically, not "the whole file is dead" — don't file a task that would touch `ConsistencyStrip`'s already-working integration.
- **Corroborating evidence at the intended host:** `src/pages/meetings/MeetingsList.tsx:239-247` and `:2382-2385` still render a hand-written placeholder `Section` labeled "Recent attendance," with copy stating the real BEH-06 strip (T037, i.e. this file's wrapper) "is NOT built there."
- Draft allowed files: `src/pages/meetings/MeetingsList.tsx` — replace the placeholder "Recent attendance" section with a real `<StudentMeetingView>` render, in the same student-viewing-their-own-history slot the stub currently occupies.

## Separately noted — confirmed unreachable, but a different category, not one of the three

**`StudentHomeSlot`** (`src/pages/home/StudentHomeSlot.tsx`, `export function StudentHomeSlot({ hasLiveSession = false })` at `:41`, no default export) — confirmed unreachable (`grep -rn "<StudentHomeSlot" src --include="*.tsx" | grep -v "\.test\.tsx"` → empty; not in `router.tsx`, not lazy-loaded). **Does not fit the "finished feature shipped unmounted" pattern**, for one decisive reason: **no test file exists for it anywhere** (`find src -iname "*StudentHomeSlot*"` returns only the source file itself) — unlike all three findings above and all three already-filed ones, which all have substantial, real test coverage proving they're finished work. It is instead explicitly self-documented as an intentionally superseded scaffold: `StudentHomeSlot.tsx:6-13` states *"it is deliberately unreachable in the running app today,"* and `StudentHome.tsx:10-49` (the real page that replaced it, T054) documents that it built its own replacement (`LiveCheckInCard`) rather than reusing this file, closing with *"`StudentHomeSlot.tsx` itself is never imported, rendered, or edited anywhere in this file."*

Recommend treating this as a **dead-code-cleanup candidate** (delete `StudentHomeSlot.tsx`, since nothing references it and it was consciously superseded) rather than a wiring-gap task — the active session's call, not asserted here as a task packet.

## Everything else checked — confirmed reachable, no findings

`GoalBar`, `StatCell`, `EventFormLayout`/`EventFormSection`, `KpiStrip`, `MobileNav`, `SideNav`, `TopNav`, `AcceptInvitePage`, `CalendarPage`, `SubscribePopover`, `CheckinResult`, `CoachHome`, `DashboardPage`, `ParentHome`, `StudentHome`, `LoginPage`, `KioskPage`, `LiveConsoleBody`/`LiveConsolePage`, `MeetingsList`, `ScheduleMeetingsDialog`, `ConsistencyStrip`, `AttendancePanel`, `MarkEventCompleteDialog`, `OutreachDetail`, `OutreachEventDialog`, `CoachSessionDetail`, `OutreachList`, `SelfCheckoffDialog`, `EventsTab`, `HoursTab`, `ParticipationTab`, `ReportsShell`, `AdminToggles`, `InviteParentDialog`, `InvitesTab`, `ParentsTabBody`, `ParentsTab`, `RosterShell`, `StudentDialog`, `StudentsTab`, `TeamsTab`, `SeasonSettings`, `SettingsPage`, `NoAccessPage`, `AccessDeniedPage` — each has at least one genuine production JSX call site (e.g. `AdminToggles` is lazy-loaded from `RosterShell.tsx:192`; `NoAccessPage`/`AccessDeniedPage` from `guards.tsx:441,500`).

## Handoff note

Same as the T168-sweep file: diagnosis only, no fixes applied, no ledger/constitution edits. The active session reviews, assigns real `T1xx` numbers, and dispatches.
