# Inbox — loader unit tests + placeholder-data audit

**From branch:** `claude/loader-tests-audit-inbox` (isolated worktree, separate session)
**Base commit SHA:** `af2891453e4343e1b183a0b04d234762b0c29ad2` (`af28914` — "packet T155 and revise T154 — and correct my diagnosis of the fixture tiles", tip of `origin/claude/swarm-plan-zl575z` at fetch time)
**Author:** a separate Claude Code session, run at George's request, deliberately isolated from the active swarm session to avoid touching `task-ledger.md`/`constitution.md` concurrently. This file is the only thing that session wrote — everything below is a *draft* for the active session to review, correct, fold into the real ledger, and dispatch. Nothing here has been executed; no source files were changed.

All line/file citations below are against the base SHA above — if the active session has landed more work since, re-verify before trusting a citation.

---

## Stream A — Placeholder/fixture-data audit

Discriminator used throughout (per the active session's own guidance): **does a prop with a placeholder default have a call site that actually passes it?** Checked by reading the component's prop defaults, then tracing every real render site (`<Component ... />` in production code, not tests) to confirm the value passed is sourced from a real loader, not left to fall through to the default.

### Re-verified — "Fixed (T147)" rows checked, not taken on trust

| Site | Result |
|---|---|
| `OutreachEventDialog.teams` (`src/pages/outreach/OutreachEventDialog.tsx:981`, default `DEFAULT_TEAMS`) | **Confirmed fixed.** Sole production render, `src/pages/outreach/OutreachList.tsx:3200`, passes `teams={teams}`; `teams` there is `data.teams` from `OutreachList`'s `loadData` prop, which defaults to the real `loadOutreachData` (`src/lib/supabase/loaders/outreach.ts`), and the route (`src/app/router.tsx:244`, `<OutreachList />`) uses that default with no override. Real data reaches the dialog in production. |
| `ScheduleMeetingsDialog.teams` (`src/pages/meetings/ScheduleMeetingsDialog.tsx:548`, default `DEFAULT_TEAMS`) | **Confirmed fixed.** Sole production render, `src/pages/meetings/MeetingsList.tsx:2224`, passes `teams={teams}`; that `teams` is component state (`useState<readonly FixtureTeam[]>([])`, line 1955) populated from `loadState.data.teams`/`fresh.teams` (lines 1986, 2076), sourced from `loadCoachMeetingsData` (`src/lib/supabase/loaders/meetings.ts`), which `MeetingsList`'s `loadCoachData` prop defaults to. Real data reaches the dialog in production. **NIT (not a bug):** the prop/state type is still named `FixtureTeam` after the fix — misleading leftover naming, worth a cosmetic rename follow-up, not urgent. |

### Re-verified — previously "unaudited" rows, turned out fine

| Site | Result |
|---|---|
| `InviteParentDialog.additionalStudentOptions` (`src/pages/roster/InviteParentDialog.tsx:392`, default `DEFAULT_ADDITIONAL_STUDENT_OPTIONS`) | **No bug.** Sole production render, `src/pages/roster/StudentsTab.tsx:1405`, passes `additionalStudentOptions={rows.map((row) => ({ id: row.id, displayName: row.name }))}` — real roster data. |
| `SelfCheckoffDialog` (`eventTitle`/`studentId`/`sessions`/`currentUserProfileId`, `src/pages/outreach/SelfCheckoffDialog.tsx:340-343`) | **No bug.** Sole production render, `src/pages/outreach/OutreachList.tsx:3631-3640`, passes real values for all four (`selfCheckoffTarget?.event.title`, `viewerStudentId`, `selfCheckoffTarget?.sessions ?? []`, `viewerProfileId`). |

### New findings — draft follow-up tasks

**Draft T-A1 — `Leaderboard.tsx` (T044) is never rendered anywhere in the app.**
- Objective: confirm whether the season volunteer leaderboard (`src/pages/outreach/Leaderboard.tsx`, `export function Leaderboard`) is meant to ship, and if so, mount it on a real route/page and wire its `loadData` prop to a real Supabase-backed loader.
- Evidence: `grep -rn "<Leaderboard" src` (excluding the component's own file and tests) returns zero matches; `src/app/router.tsx` has no reference to it. Every other in-repo mention of "Leaderboard" is a comment citing it as precedent, not an import/render. Compounding: even if it were mounted, `seasonId` defaults to `PLACEHOLDER_SEASON_ID` (line 473) with no caller to override it, and `loadData` defaults to `defaultLoadLeaderboardData` (fixture data), which the component's own doc comment (lines 458-460) discloses as "still out of scope for T104." No real `LoadLeaderboardDataFn`/`loadLeaderboardData` implementation exists anywhere under `src/lib/supabase/`.
- Allowed files (draft, active session should confirm): a new route entry in `src/app/router.tsx` (or the owning parent page, if the leaderboard belongs embedded in an existing screen — needs a product call), plus a new `loadLeaderboardData` in `src/lib/supabase/loaders/` (or extending `leaderboard_privacy.ts`, which already exports the sibling `loadPrivacySetting`).
- Open question for the active session/George: was this always meant to be a standalone route, or embedded inside an existing outreach/dashboard screen? That decision isn't recoverable from the code alone.

**Draft T-A2 — `RsvpControl.tsx`/`ParentRsvp.tsx` (student/parent self-service RSVP) are never rendered anywhere in the app.**
- Objective: mount the real, already-built self-service RSVP components into the screens that are supposed to host them.
- Evidence: `grep -rn "<RsvpControl" src` and `grep -rn "<ParentRsvp\b" src` (excluding their own files and tests) both return zero matches. Both components are fully built, export a real `default`, and their mutation path (`submitRsvpChange` in `src/lib/supabase/loaders/outreach.ts`) is real and Supabase-backed — this isn't an unfinished-logic gap, it's a wiring gap. Meanwhile the rest of the codebase's own comments repeatedly describe `RsvpControl.tsx`/`ParentRsvp.tsx` as "the real, persisted RSVP flow" that other components (`OutreachList.tsx:3565`, `OutreachDetail.tsx`, `MarkDayCompleteDialog.tsx`) explicitly defer to and deliberately don't duplicate — e.g. `OutreachDetail.tsx` reimplements `RsvpRow`/`RsvpStatus` types locally but never imports or renders either component. `ParentRsvp.tsx`'s own doc comment (line 113) says `OutreachDetail.tsx` "is expected to render one `<ParentRsvp>` per linked [student]" — it currently does not.
- Severity note: this looks like the same shape as the already-known "CoachHome's primary widgets were never wired to Supabase" finding, but for a whole feature area (OUT-03) rather than a widget — worth treating with similar priority.
- Allowed files (draft): whichever screen(s) are meant to host these — `OutreachDetail.tsx` for `ParentRsvp` per its own doc comment, and likely a student-facing outreach/event screen for `RsvpControl` (needs confirmation against PRD OUT-03's intended screen).

**Draft T-A3 — `StudentDialog.season` was deliberately deferred pending T091; T091 has since landed.**
- Objective: thread real season data into `<StudentDialog>` now that its blocking dependency is resolved.
- Evidence: `src/pages/roster/StudentsTab.tsx` (module doc, lines 305-324, live at base SHA) explicitly documents omitting the `season` prop on `<StudentDialog>` so it falls back to `DEFAULT_SEASON_INFO`, citing "a parallel, independently-dispatched packet (T091) is building the real season-data mechanism" as the reason, to avoid "a false ordering dependency between two packets." `docs/swarm/task-ledger.md:171` shows **T091 — Passed** ("Real `SeasonProvider`/`useActiveSeason()` built... `SeasonSettings`/`ReportsShell` wired as first consumers"). T091's own landed scope doesn't include `StudentDialog` — the dependency this comment was waiting on is resolved, but the follow-through was never filed.
- Allowed files (draft): `src/pages/roster/StudentsTab.tsx` — thread `useActiveSeason()` (or whatever T091 exposes) into the `<StudentDialog season={...} />` call.

**Reference only, do not re-audit:** `CoachHome.seasonId` — live bug, T155 already in flight. `T151` (placeholder-defaulted props, the general pattern this audit is an instance of), `T152` (loader parallelism guard), `T156` (discarded error), and the already-filed follow-up that CoachHome's primary widgets were never wired to Supabase at all.

**Not yet covered:** this pass covered the 5 originally-unaudited sites plus a spot re-check of the 2 "Fixed" sites. The rest of `src/pages/**`/`src/components/**` has not been swept with this discriminator yet — that's the natural continuation once these are triaged.

---

## Stream B — Loader unit tests (prioritized subset)

**Sequencing note, honored from the plan:** `dashboard.ts` is dropped from this pass — T155 has a worker actively changing it (per the active session), so tests written against today's shape would be stale before this inbox is even read. Filed below as blocked-on-T155, not as an active target.

Convention (already established in this codebase — don't invent a new one): one test file per source file (e.g. `checkin.test.ts` beside `checkin.ts`); `vi.mock(..., importOriginal)` partial-mocking of Supabase/auth, matching `App.test.tsx`/`RosterShell.test.tsx`/`OutreachDetail.test.tsx`; heavily-annotated test files explaining *why* a case is tested, matching `outreach.test.ts`'s existing style; no PII in fixtures (constitution item 6) — fabricated names only.

**Draft T-B1 — Unit tests for `src/lib/supabase/loaders/checkin.ts`**
- Objective: cover `aggregateParticipationForStudent`, consistency-strip data, linked-students, and access-token retrieval logic (521 lines, currently 0 tests).
- Allowed files: `src/lib/supabase/loaders/checkin.test.ts` (new).
- Acceptance: exercises the aggregation math (participation %, consistency strip) against constructed fixture rows, not just a single happy path; existing suite stays green.
- Evidence: `npm run test` output for the new file plus the full suite.

**Draft T-B2 — Unit tests for `src/lib/supabase/loaders/meetings.ts`**
- Objective: cover `aggregateParticipationRows`, `makeLoadCoachMeetingsData`, `makeLoadStudentMeetingsData`, `makeCancelMeetingSession`, `makeResolveCurrentStudentId`, `makeCreateMeetings` (726 lines, currently 0 tests).
- Allowed files: `src/lib/supabase/loaders/meetings.test.ts` (new).
- Acceptance: participation-aggregation math and each mutation's Supabase call shape are both covered.
- Evidence: `npm run test` output.

**Draft T-B3 — Unit tests for `src/lib/supabase/loaders/reports.ts`**
- Objective: cover `makeLoadParticipationData`, `makeLoadHoursData`, `makeLoadEventSessionsData` (729 lines, currently 0 tests).
- Allowed files: `src/lib/supabase/loaders/reports.test.ts` (new).
- Acceptance: per constitution item 3, confirm these read from `v_student_participation`/`v_student_hours`-style views and don't re-derive metric math in TypeScript — a duplicated formula here would be a BLOCKER-class finding worth flagging separately, not silently test-covering.
- Evidence: `npm run test` output.

**Draft T-B4 — Unit tests for `src/lib/supabase/loaders/kpi.ts`**
- Objective: cover `makeLoadKpiStripData` (255 lines, currently 0 tests).
- Allowed files: `src/lib/supabase/loaders/kpi.test.ts` (new).
- Acceptance: covers the KPI computation's edge cases (zero data, partial data), not just one populated case.
- Evidence: `npm run test` output.

**Draft T-B5 — Complete unit tests for `src/lib/supabase/loaders/outreach.ts`'s remaining exports**
- Objective: `outreach.ts` has 23 exports (verified: `grep -cE "^export " src/lib/supabase/loaders/outreach.ts`); the existing `outreach.test.ts` covers `makeLoadOutreachDetail`/`loadOutreachDetail` (2). Cover the remaining 21 — RSVP submission (`makeSubmitRsvpChange`), day-completion (`makeMarkDayComplete`), event save/cancel (`makeSaveOutreachEvent`, `makeCancelOutreachEvent`), roster loading (`makeLoadOutreachEventRoster`), and the pure helper `computeExpectedAttendeeRsvpPlan`.
- Allowed files: `src/lib/supabase/loaders/outreach.test.ts` (extend, don't replace — keep the existing T146 column-guard test as-is).
- Acceptance: extends the existing file rather than forking a second one; follows its established column-set-parsing pattern where relevant (see its own header comment for why).
- Evidence: `npm run test` output for the extended file plus the full suite.

**Blocked, draft only:**
- `src/lib/supabase/loaders/dashboard.ts` — blocked on T155 landing; re-open as an active target once T155 merges.

**Explicitly out of scope for this pass** (file as follow-up tasks, not silently dropped): `teams.ts`, `kiosk.ts`, `attendance.ts`, `seasons.ts`, `students.ts`, `invites.ts`, `parents.ts`, `accept.ts`, `selfCheckoff.ts`, `leaderboard_privacy.ts`.

---

## Handoff note

This session's job ends here — no `swarm-run`, no worker dispatch, no source edits happened in this worktree. The active session owns: reviewing the above, folding whatever it agrees with into `task-ledger.md` (assigning real `T1xx` numbers, worker/checker pairs) and `constitution.md` if needed, correcting anything that's drifted since the base SHA, and executing through its own worker/checker loop. Worktree path and branch are disposable once this is folded in — nothing else was committed here.
