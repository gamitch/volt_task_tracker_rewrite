# Inbox — T168 placeholder-default sweep, continued

**From branch:** `claude/audit-batch-2` (isolated worktree, separate session, same pattern as the first drop at `claude/loader-tests-audit-inbox` @ `2ec47d8`)
**Base commit SHA:** `f7ff055a83cc85513728ad14bc63279ec9a6f1de` (`f7ff055` — "Merge pull request #2 from gamitch/claude/swarm-plan-zl575z", current tip of `origin/claude/swarm-plan-zl575z` at fetch time, already includes the first drop's fold-in through T157-T168)
**Author:** a separate Claude Code session, per George's split: this session takes the mechanical audits, the active session keeps T155/T157/T169/T170/T171 (the four with multi-round gate context). Read-only against `docs/swarm/`; no source files touched.

Continues T168 (`docs/swarm/task-ledger.md:197`): the first pass covered 7 sites (`OutreachEventDialog.teams`, `ScheduleMeetingsDialog.teams`, `InviteParentDialog.additionalStudentOptions`, `SelfCheckoffDialog`'s four props). This pass swept the rest of `src/pages/**`/`src/components/**` not yet covered by that pass or by the sites already filed as their own tasks (`CoachHome.seasonId`/T155, `Leaderboard.seasonId`, `StudentDialog.season`, `OutreachList.viewerStudentId`/T170).

All citations verified against the base SHA above by direct file read, not relayed from tooling output alone.

---

## New confirmed bugs

### Draft T-C1 — `StudentHome.studentId`/`.teamId`/`.seasonId` default to placeholders; every student dashboard is affected

- **Default location:** `src/pages/home/StudentHome.tsx:1130-1137`:
  ```
  export function StudentHome({
    loadData = defaultLoadStudentHomeData,
    studentId = PLACEHOLDER_CURRENT_STUDENT_ID,   // :1132
    teamId = PLACEHOLDER_CURRENT_TEAM_ID,          // :1133
    seasonId = PLACEHOLDER_SEASON_ID,              // :1134
    nowFn = () => new Date(),
    submitCheckinCode = defaultSubmitCheckinCode,
  }: StudentHomeProps = {}): ReactNode {
  ```
- **Sole production render site:** `src/pages/home/DashboardPage.tsx:122` — `case 'student': return <StudentHome />;` inside the role dispatcher. Zero props passed.
- **Load-bearing, not decorative:** `StudentHome.tsx:1139-1142` — `loadData(studentId, seasonId)` is the actual data-fetch call, so every signed-in student gets their dashboard data fetched for the fixture student/season id, not their real one. `teamId` scopes team-filtered sections per the component's own module doc #8.
- **Same defect family as T155** (`CoachHome.seasonId`), same shape, same root cause (`DashboardPage.tsx`'s role-dispatcher renders all three home variants with zero props, per module doc #3's "genuinely exhaustive" switch) — but on the student dashboard, a different component, a distinct fix.
- Draft allowed files: `src/pages/home/StudentHome.tsx` (source `studentId`/`teamId`/`seasonId` from real context, mirroring whatever pattern T155 lands on for `CoachHome`) and/or `DashboardPage.tsx` if the fix threads props at the call site instead.
- Suggested sequencing: land after T155, so `StudentHome`'s fix can reuse T155's proven pattern (the ledger row for T155 explicitly names `useActiveSeason()` sourcing as the approach) rather than both being designed independently.

### Draft T-C2 — `SubscribePopover.functionsBaseUrl` defaults to a fake host; every calendar-feed subscription link is broken

- **Default location:** `src/pages/calendar/SubscribePopover.tsx:474-476, 483`:
  ```
  /** Injectable Supabase Functions base URL (module doc section 2). Defaults
   * to an obviously-fake placeholder. */
  functionsBaseUrl?: string;
  ...
  export function SubscribePopover({
    profileId,
    loadCalendarFeed = defaultLoadCalendarFeed,
    onResetFeedToken = defaultOnResetFeedToken,
    functionsBaseUrl = PLACEHOLDER_SUPABASE_FUNCTIONS_URL,   // :483
  }: SubscribePopoverProps): ReactNode {
  ```
  `PLACEHOLDER_SUPABASE_FUNCTIONS_URL` = `'https://volt-placeholder-project.functions.supabase.co'` (declared `:379-380`) — a non-existent host.
- **Sole production render site:** `src/pages/settings/SettingsPage.tsx:1207` — `<SubscribePopover profileId={profile.id} />`. Only `profileId` passed.
- **Consequence:** `functionsBaseUrl` feeds `buildIcsUrl(functionsBaseUrl, feed.token)` (`:556`) to build the `.ics` subscription URL shown/copied in Settings → Calendar feed. Every user who copies or subscribes gets a link to `volt-placeholder-project.functions.supabase.co`, which does not exist.
- **Note, not a separate bug:** `loadCalendarFeed` also isn't overridden at this call site, defaulting to `defaultLoadCalendarFeed` — worth checking whether that default is fixture data or the real loader as part of scoping this task, since if it's fixture too the feed metadata itself (not just the URL) may be fake.
- Draft allowed files: `src/pages/settings/SettingsPage.tsx` — thread the real Supabase Functions base URL (however other call sites in this codebase already source it, e.g. check `src/lib/supabase/client.ts`/env config for the established pattern) into the `<SubscribePopover>` call.

## Bonus note — not a new task, fold into T155

**`CoachHome.teamId`** (`src/pages/home/CoachHome.tsx:1997-1998`) — confirmed:
```
export function CoachHome({
  loadData = defaultLoadCoachHomeData,
  loadDashboardData: loadDashboardDataProp = loadDashboardData,
  seasonId = PLACEHOLDER_SEASON_ID,     // :1997 — this is T155's bug
  teamId = PLACEHOLDER_CURRENT_TEAM_ID,  // :1998 — sibling placeholder, NOT part of T155's current scope per its ledger row
  nowFn = () => new Date(),
}: CoachHomeProps = {}): ReactNode {
```
Sole render site is the same `DashboardPage.tsx:120`, `<CoachHome />`, zero props. T155's own ledger row explicitly scopes `teamId`/`PLACEHOLDER_CURRENT_TEAM_ID` out as a named follow-up ("`teamId`'s deferral reasoning strengthened to a fact... there is no correct value to wire, not just an out-of-scope one" — `AuthUser` has no team linkage at `:219-223`). Not re-filing this as a separate task since T155 already disclosed and deferred it correctly — flagging only so whoever picks it up next has this file:line handy.

## Cross-reference, not double-counted here

Two more placeholder-defaulted props exist but their component is unreachable, making the prop moot until the reachability finding is fixed — see `claude-audit-batch-2-reachability.md` instead:
- `MarkDayCompleteDialog.currentUserProfileId` (`:655`, `PLACEHOLDER_CURRENT_COACH_PROFILE_ID`)
- `ParentRsvp.currentUserProfileId` (`:505`, `PLACEHOLDER_CURRENT_PARENT_PROFILE_ID`) — already covered under T157's scope, not a new finding.

## Swept clean — verified real data flows in, no action needed

- `MarkEventCompleteDialog` — real render site `OutreachDetail.tsx:1450-1461` passes `eventTitle={event.title}`, `sessions`, `roster`, `rsvps`, `currentUserProfileId={user?.id}`, all real.
- `HoursTab`/`EventsTab`/`ParticipationTab` — `seasonId` has no default (required prop); real value from `ReportsShell.tsx:170` (`useActiveSeason()`), passed at `:188/191/194`.
- `OutreachList` — checked for placeholder-default props beyond the already-known `viewerStudentId`/T170; `seasonId` has no default, resolved via `useActiveSeason()` internally. No other instances.
- `OutreachDetail` — `PLACEHOLDER_SEASON_ID` at `:501` is used only inside an internal fixture loader, never as a component prop default.
- `MeetingsList`/`StudentMeetingView` — `studentId` defaults to `undefined` and is resolved via a real `resolveStudentId` function when omitted (documented as a prior, intentional fix), not a placeholder fallback.
- `KpiStrip` — `loadKpiStripData` defaults to the real loader (aliased import from `lib/supabase/loaders/kpi`); `seasonId` sourced from `useActiveSeason()` at its real call site (`:186`).
- `AdminToggles`, `InvitesTab`, `ParentsTab`/`ParentsTabBody`, `StudentsTab`, `TeamsTab`, `RosterShell`, `SeasonSettings`, `SettingsPage`, `CheckinResult`, `NoAccessPage`, `CalendarPage`, `ParentHome`, `LiveConsoleBody`/`LiveConsolePage`, `KioskPage`, `EndMeetingDialog` — only function-typed injectable-seam defaults (`loadX`/`onX`) pointing at real implementations, the app-wide DI convention; no identity/scope sentinel-value defaults.
- `MobileNav.tsx:133`/`SideNav.tsx:117` — `PLACEHOLDER_OUTREACH_BADGE_COUNT` is a bare module constant used directly in JSX, not a prop with a caller-overridable default — doesn't fit this discriminator at all (no caller involved); openly disclosed with a future-ticket comment (T038), not silently shipped.
- `GoalBar`, `StatCell`, `EventFormLayout`, `TopNav`, `AttendancePanel`, `AcceptInvitePage`, `LoginPage`, `AccessDeniedPage`, `Kiosk.tsx`'s hooks — no placeholder/fixture/mock sentinel-value prop defaults found.

## Handoff note

Same as the first drop: this session's job ends here. No fixes applied, no ledger/constitution edits. The active session reviews, assigns real `T1xx` numbers, and dispatches through its own worker/checker loop.
