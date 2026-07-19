# Worker Packet: T081

## Task ID
T081 — DES-12 loading-state sweep: `Spinner` → `Skeleton` where dimensions are known (MINOR
follow-up from T069), Epic E11.

## Objective
T069's copy audit (Passed) found DES-12's mandated `Skeleton` loading component is used **zero
times** anywhere in this codebase — every screen with a loading state uses `Spinner` instead.
Astryx's own component doc is explicit that this is the wrong choice for content with known
dimensions: `Skeleton` is for content whose shape is predictable (tables, card grids, list rows);
`Spinner` is correct only for content with genuinely unknown dimensions (e.g. a full-page loading
state before any layout is known). This task fixes the screens where `Skeleton` is genuinely the
right component — it is NOT a blind find-and-replace.

**Fresh, authoritative grep sweep (run today, not from memory — re-verify yourself before
starting)** of every file with `Spinner` usage in `src/pages/**`:
```
src/pages/accept-invite/AcceptInvitePage.tsx    src/pages/meetings/StudentMeetingView.tsx
src/pages/calendar/CalendarPage.tsx             src/pages/no-access/NoAccessPage.tsx
src/pages/calendar/SubscribePopover.tsx         src/pages/outreach/Leaderboard.tsx
src/pages/checkin/CheckinResult.tsx             src/pages/outreach/OutreachDetail.tsx
src/pages/home/CoachHome.tsx                    src/pages/outreach/OutreachList.tsx
src/pages/home/ParentHome.tsx                   src/pages/reports/EventsTab.tsx
src/pages/home/StudentHome.tsx                  src/pages/reports/HoursTab.tsx
src/pages/meetings/EndMeetingDialog.tsx         src/pages/reports/ParticipationTab.tsx
src/pages/meetings/LiveConsole.tsx              src/pages/roster/AdminToggles.tsx
src/pages/meetings/MeetingsList.tsx             src/pages/roster/InvitesTab.tsx
src/pages/settings/SeasonSettings.tsx           src/pages/roster/ParentsTab.tsx
src/pages/settings/SettingsPage.tsx             src/pages/roster/StudentsTab.tsx
                                                 src/pages/roster/TeamsTab.tsx
```

## Allowed Files
- Every file listed above, plus each one's own `*.test.tsx`.

## Forbidden Files
- Every other file. `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. Judge each site individually — this is the core skill this task requires.** For each file's
loading branch: is the content that appears once loaded a table, list, card grid, or other
shape with genuinely predictable dimensions (student rows, event cards, KPI cards, etc.)? If yes,
replace `Spinner` with `Skeleton`, shaped to approximate the real content's eventual layout (check
`docs/swarm/astryx-api.md`'s `Skeleton` doc, or the installed component source, for its real props
— don't guess at the API). If the loading state gates a genuinely unpredictable shape (e.g. a
full-page state before ANY layout is known, or a dialog whose eventual content varies widely), Astryx's own
guidance says `Spinner` remains correct — leave it as-is and say so explicitly in your output,
don't force a bad fit just to hit a number.

**2. `AcceptInvitePage.tsx`, `CheckinResult.tsx`, `NoAccessPage.tsx` may have structural reasons
their loading states are shaped differently** (e.g. `NoAccessPage.tsx`'s own module doc explicitly
disclosed why it deliberately does NOT model a distinct loading branch at all) — read each file's
own module doc before assuming a fix is needed; some may already have a disclosed, correct reason
for their current shape.

**3. This is a large sweep across ~24 files.** If partway through you find the actual diff is
becoming unwieldy or you're making judgment calls you're not confident in, STOP and report a
partial result with clear notes on what's done vs. remaining, rather than rushing a low-quality
pass across everything — a smaller, correct diff is better than a larger, shaky one. Say explicitly
in your output whether you completed the full sweep or a partial one and why.

**4. Do not change anything about a screen's error or empty states** — this task is loading-state
only. `EndMeetingDialog.tsx`/other dialogs: confirm whether their `Spinner` usage is genuinely a
loading state or a different UI purpose (e.g. an in-progress submit-button spinner is NOT a DES-12
loading state and should NOT be touched).

## Acceptance Criteria
- Every screen where `Skeleton` is genuinely the correct component per Astryx's own guidance has
  been switched, shaped reasonably to approximate real content.
- Every screen where `Spinner` remains correct (unknown-dimension content) is left as-is, with
  explicit reasoning in your output for each such case.
- No submit-button/in-progress-action spinners touched (different purpose, not DES-12 loading
  state).
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run format:check` all
  clean, zero regressions.

## Relevant Constitution Excerpts
> DES-12: every async list screen has all four states specified: loading (`Skeleton`), empty
> (`EmptyState` with one action), error (`Banner status="error"` with retry), populated.

> No worker may mark its own work complete; every PASS requires independent checker-inspected
> evidence.

## Most Recent Failure
None. This is attempt 1 for T081 (attempt count: 0) — first dispatch.

## Required Worker Output
- Full diff of every changed file.
- A per-file table: fixed (Skeleton) vs. left as Spinner (with reasoning) vs. not a DES-12 loading
  state at all (with reasoning).
- Full test/typecheck/lint/build output.
- Known risks; whether a dispute is needed (you flag, you don't resolve) — including whether you
  completed the full sweep or are reporting a deliberate partial result (Trap #3).
