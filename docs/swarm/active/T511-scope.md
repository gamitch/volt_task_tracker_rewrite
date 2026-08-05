# T511 — scope

**Row:** T511 · **Workflow:** W3 (Run a meeting) · **Branch:** `claude/w3-meeting-workflow-0bl669`

**Owner's ruling (2026-08-05 next morning, `auto-mode-decisions.md` item 5):** the entry point is a
**"Go live" action on a scheduled session row in the Meetings list.** Calendar and CoachHome were
both put to him and declined — each would also have been another workflow's surface, whereas
`MeetingsList.tsx` is W3's own file.

---

## §1 — Tier: FAST, and the defence (item 26 requires one)

**FAST — the orchestrator implements directly. No packet, no worker, no checker.** Every FAST
condition holds and is checked, not assumed:

| Condition | Status |
|---|---|
| No write path or destructive operation | ✅ pure navigation; adds no mutation of any kind |
| No schema, RLS, migration, or auth/role logic | ✅ the role gate already exists and is **not touched** (§4) |
| No change to a signature another module imports | ✅ `CoachMeetingSessionRow` and `renderMeetingSessionDetailCell` are module-private; nothing is exported or re-typed |
| ≲20 lines of production change | ✅ three imports + one `<Link>` in an existing conditional block |
| A named mutation turns a test red | ✅ four, in §5 |

**Verification is NOT reduced** — every mutation is run and its real red output reported, all gates
run, result goes through a PR. What is removed is coordination, not evidence.

**Counter-argument considered and rejected:** "it exposes a staff console, so it is auth-adjacent."
It is not. The gate is structural and pre-existing (§4); this row renders a link inside a subtree
that already only renders for coaches and admins. Item 25 explicitly retires "it sounds sensitive"
as a tier trigger.

---

## §2 — Verified premises

All checked against the working tree at `b6b4f89`, by reading the code.

- **The route is real and unreachable.** `routePaths.meetingLiveSession` is defined at
  `router.tsx:166`; `/meetings/live/:sessionId` is wired at `:224-230`. **Zero real call sites** —
  grepped across `src/` excluding tests, the only two hits are its own definition and a *comment* in
  `CalendarPage.tsx:184` explaining that it is a different path. Nothing links to it.
- **The insertion point already exists.** `CoachMeetingSessionRow` (`MeetingsList.tsx:1572-1632`)
  renders a per-session action `HStack` (`:1616-1629`) containing a `session.status === 'scheduled'`
  block whose sole occupant today is the Cancel `Button`. That block is exactly where "Go live"
  belongs.
- **The session id is in hand.** `CoachMeetingSessionDetail.sessionId` (`:641`). No new loader
  field, no new query.
- **No circular-import hazard.** `router.tsx` imports every page via `lazy(() => import(...))`, so a
  page importing `routePaths` back from it is safe — and is the established idiom, used at
  `LiveConsole.tsx:473`, `Kiosk.tsx:221` and in `SideNav.tsx`.
- **Harness exists.** `MeetingsList.test.tsx` runs **84 tests** and already renders the coach view.

---

## §3 — Decision: NO time window. Every `scheduled` session gets the link.

A window was genuinely considered, because a tested one already exists:
`isSessionCheckInEligible` (`CoachHome.tsx:1179-1190`) — live now, or starting within 60 minutes,
never for non-`scheduled`. **Rejected, for three reasons in descending weight:**

1. **A window re-creates the exact defect being fixed.** Outside it the console is unreachable
   again — including the case that matters most, a meeting that started 90 minutes ago and is still
   running. Fixing "no entry point" with "an entry point that is usually absent" is not a fix.
2. **Reusing the rule would duplicate it.** Importing it means `MeetingsList.tsx` (W3) importing
   from `CoachHome.tsx` (W5) — a page importing another page, across a workflow boundary.
   Re-deriving it locally is worse: that is precisely **T600**'s recorded debt shape, one expression
   maintained in two TypeScript copies with no test asserting they agree.
3. **There is no noise cost to pay for.** Session rows render only inside an **expanded** event row
   (`renderMeetingSessionDetailCell`, `:1685`, spliced in per `expandedEventIds`). A season of
   weekly meetings does not put 20 buttons on screen; it puts them behind a disclosure the coach
   opened deliberately.

**The console has no status gate of its own** — `checkSessionLiveness` does not exist anywhere in
`src/` (grepped), and `LiveConsole.tsx` performs no session-status check. So the link works for any
scheduled session and cannot land the coach on an error state.

---

## §4 — The staff gate is structural and must NOT be re-implemented

`CoachMeetingSessionRow` has exactly one render path: `renderMeetingSessionDetailCell` (`:1685`) →
`CoachMeetingsView` → gated at `MeetingsList.tsx:2666` on `isCoachOrAdminView`, computed at `:2649`
as `user.role === 'coach' || user.role === 'admin'`. **A student or parent never renders this
component at all**, so no role check goes on the link itself.

This matters because the row's own text says *"staff-gate it"*, and the naive reading — add a role
check beside the link — would add a second, redundant gate that can drift out of step with the
first. **Assert the existing gate instead (C3).**

For the record, the deeper gate is also intact: the route carries `RequireAuth`, with
`RequireRole allowedRoles={['coach','admin']}` nested inside the page (`LiveConsole.tsx:23-32`,
deliberate). A student who pasted the URL would be redirected either way.

---

## §5 — Prescription

In `src/pages/meetings/MeetingsList.tsx` only:

1. Add `Link` to the existing `@astryxdesign/core` import (`:488-506`).
2. Add `import { Link as RouterLink } from 'react-router-dom';`
3. Add `import { routePaths } from '../../app/router';`
4. In `CoachMeetingSessionRow`'s `session.status === 'scheduled'` block (`:1617-1627`), beside the
   Cancel `Button`:

```tsx
<Link
  as={RouterLink}
  href={routePaths.meetingLiveSession(session.sessionId)}
  isStandalone
>
  {`Go live — ${formatWeekdayDate(session.sessionDate)}`}
</Link>
```

**`Link`, not `Button`, and this is not a style preference.** `astryx-api.md`'s Link Best Practices
say *"Don't: Use Link for actions that do not navigate; use a Button instead"* — this navigates, so
the rule points the other way. The in-repo precedent is `LiveConsole.tsx:886`, which links out to
the kiosk exactly this way. **Disclosed asymmetry:** it will not look identical to the Cancel
`Button` beside it. That is the correct trade — a real anchor gives middle-click, ctrl-click, "open
in new tab" and the right screen-reader announcement, none of which a `Button onClick={navigate}`
gives. (`CoachHome.tsx:2398` uses the Button+navigate shape; it is the weaker of the two precedents
and should not be copied here.)

**The date is in the visible text, and that is required, not decorative.** `astryx-api.md` says
*"Don't: Set `label` on text links; `aria-label` prevents assistive technology from reading the
actual link content."* So the visible text **is** the accessible name — and a multi-session event
would otherwise produce several links all named "Go live" in one table. The Cancel button beside it
solves the identical problem the same way (`:1625`, `Cancel ${formatWeekdayDate(...)} session`).

---

## §6 — Acceptance criteria, each with its named mutation

Run every mutation in a throwaway worktree (item 23). Commit before mutating; `git diff --quiet`
after.

| # | Criterion | Named mutation that MUST turn it red |
|---|---|---|
| **C1** | A scheduled session row links to `/meetings/live/<that session's own id>`. **Assert the SECOND session of a multi-session event**, not the first, so an off-by-one or a first-iteration-only bug is observable. | Change the `href` to `routePaths.kioskSession(session.sessionId)`. Both are `/…/<sessionId>` shapes, so only a real path assertion catches it. |
| **C2** | A `completed` and a `canceled` session render **no** Go live link. | Move the `<Link>` outside the `session.status === 'scheduled'` block. |
| **C3** | The student/parent view renders no Go live link anywhere (§4's structural gate). | Change `:2649`'s `isCoachOrAdminView` to `user !== null`, so every signed-in role gets the coach view. |
| **C4** | Each link's accessible name is unique within one event's session list. | Drop the date from the link text, leaving a bare `Go live`. Two same-named links must fail the assertion. |

**Fixture requirement:** the event fixture needs **at least three sessions with distinct dates** —
one `scheduled`, one `completed`, one `canceled` — and a second `scheduled` session so C1 and C4
have a real second item to assert against. Give every date a distinct value; identical fixture
values are how this repo's 7+ recorded false-passes happened.

---

## §7 — Gates

`npx tsc --noEmit` · `npx eslint .` · `npm run format:check` · `npx vitest run`

Re-measure the baseline immediately before implementing — `main` moves hourly, and T508 is in flight
on this same branch. Report real before/after numbers.

**Expected `eslint` delta: none.** No new export, so no `react-refresh/only-export-components`
warning (contrast T508's declared 365 → 366).

---

## §8 — Do not

- Do not touch `LiveConsole.tsx`, `Kiosk.tsx`, `loaders/kiosk.ts`, `loaders/checkin.ts`,
  `loaders/attendance.ts`, `pages/home/**`, `pages/outreach/**`, `app/router.tsx`, or any migration.
  **`routePaths` is import-only** — the route already exists and needs no change.
- Do not add a role check beside the link (§4).
- Do not add a time window (§3).
- Do not import from `CoachHome.tsx` (§3, reason 2).
- Do not edit `EndMeetingDialog.tsx`, `loaders/endMeeting.ts`, or their tests while T508 is in
  flight on this branch.
