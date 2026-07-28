# Worker Packet: T082

## Task ID
T082 — DES-12 error-state sweep: add real retry actions to error `Banner`s (MINOR follow-up from
T069), Epic E11.

## Objective
T069's copy audit (Passed) found DES-12's mandated error-state pattern (`Banner status="error"`
**with retry**) is genuinely implemented in only 2 screens (`AcceptInvitePage.tsx`,
`CheckinResult.tsx`) — every other screen's error `Banner` has no actual retry action, just static
"try refreshing the page" copy. This task adds real retry actions matching Astryx's own documented
pattern: `<Banner status="error" ... endContent={<Button variant="ghost" label="Retry"
onClick={handleRetry} />} />`.

**Fresh, authoritative grep sweep (run today, not from memory) of every file with
`status="error"` Banner usage in `src/pages/**`, EXCLUDING the 2 already-correct screens**:
```
src/pages/calendar/CalendarPage.tsx             src/pages/outreach/OutreachEventDialog.tsx
src/pages/calendar/SubscribePopover.tsx         src/pages/outreach/OutreachList.tsx
src/pages/home/CoachHome.tsx                    src/pages/outreach/ParentRsvp.tsx
src/pages/home/ParentHome.tsx                   src/pages/outreach/RsvpControl.tsx
src/pages/home/StudentHome.tsx                  src/pages/reports/EventsTab.tsx
src/pages/login/LoginPage.tsx                   src/pages/reports/HoursTab.tsx
src/pages/meetings/EndMeetingDialog.tsx         src/pages/reports/ParticipationTab.tsx
src/pages/meetings/LiveConsole.tsx              src/pages/roster/AdminToggles.tsx
src/pages/meetings/MeetingsList.tsx             src/pages/roster/InviteParentDialog.tsx
src/pages/meetings/ScheduleMeetingsDialog.tsx   src/pages/roster/InvitesTab.tsx
src/pages/meetings/StudentMeetingView.tsx       src/pages/roster/ParentsTab.tsx
src/pages/outreach/Leaderboard.tsx              src/pages/roster/StudentDialog.tsx
src/pages/outreach/MarkDayCompleteDialog.tsx    src/pages/roster/StudentsTab.tsx
src/pages/outreach/OutreachDetail.tsx           src/pages/roster/TeamsTab.tsx
src/pages/settings/SeasonSettings.tsx           src/pages/settings/SettingsPage.tsx
```

## Allowed Files
- Every file listed above, plus each one's own `*.test.tsx`.

## Forbidden Files
- Every other file, including `AcceptInvitePage.tsx`/`CheckinResult.tsx` (already correct, read-
  only reference for the pattern). `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. The retry callback is almost always "re-invoke the same load/fetch function that failed."**
Most of these screens already have a named load function (e.g. `runLoadInvite`,
`loadSettingsData`) wired to a `useState`/`useEffect` pattern — find each screen's own equivalent
and wire the `Retry` button's `onClick` to re-invoke it. Do not invent new loading logic; reuse
what each screen already has.

**2. `LOGIN_PAGE.tsx`'s error Banner may be a form-submission error, not a data-load error** — read
it first. A "Retry" action doesn't always make sense for every kind of error (e.g. a "wrong
password" error banner shouldn't get a generic retry button, since the fix is "type the right
password," not "retry the same failed call"). Judge each site: is this error genuinely something a
retry can fix (a transport/load failure), or is it a validation/credentials error where retry is
meaningless? Only add a `Retry` action where it's semantically correct — DES-12's own "with retry"
requirement is about load-failure recovery, not about literally covering every possible error type.
State your judgment per file in your output.

**3. Dialogs (`EndMeetingDialog.tsx`, `ScheduleMeetingsDialog.tsx`, `MarkDayCompleteDialog.tsx`,
`OutreachEventDialog.tsx`, `InviteParentDialog.tsx`, `StudentDialog.tsx`) — same judgment call as
Trap #2 applies. Some dialog errors are submit-failures (retry = resubmit the same form, which may
already effectively exist as "click the submit button again" — check whether a distinct `Retry`
action is even meaningful there, or whether the existing submit button already serves that role).

**4. Large sweep across ~29 files/sites.** Same guidance as T081's Trap #3: if the diff becomes
unwieldy or you're unsure about a judgment call, stop and report a partial, clearly-scoped result
rather than rushing every site.

## Acceptance Criteria
- Every screen where a retry action is genuinely semantically correct (a load/transport failure,
  not a validation/credentials error) has a real, working `Retry` button wired to re-invoke the
  actual failed operation.
- Screens/errors where retry doesn't semantically apply are left as-is, with explicit reasoning.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run format:check` all
  clean, zero regressions.

## Relevant Constitution Excerpts
> DES-12: error (`Banner status="error"` with retry).

> No worker may mark its own work complete; every PASS requires independent checker-inspected
> evidence.

## Most Recent Failure
None. This is attempt 1 for T082 (attempt count: 0) — first dispatch.

## Required Worker Output
- Full diff of every changed file.
- A per-file table: retry added (with what it re-invokes) vs. retry judged not applicable (with
  reasoning).
- Full test/typecheck/lint/build output.
- Known risks; whether a dispute is needed (you flag, you don't resolve) — including whether you
  completed the full sweep or are reporting a deliberate partial result (Trap #4).
