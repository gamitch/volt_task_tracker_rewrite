# Worker Packet: T053

## Task ID
T053

## Objective
Build `src/pages/home/CoachHome.tsx` — Coach/Admin Home (HOME-01/HOME-04), using Astryx's
`Analytics Dashboard` template as the base (constitution item 13 — templates used as-is, not an
invented layout). KPI `Card`s (team participation %, hours-vs-goal `ProgressBar` with BEH-01
milestones, last-completed-meeting attendance rate, events in next 7 days); primary actions "Start
check-in" (visible when a session is live or starts within 60 min) and "New outreach event"; "Next
up" (next 5 sessions, any type); "Recent signups" (last 10 RSVP changes for future outreach). Admin
variant adds a "Season setup" shortcut card when the active season lacks goals/teams (HOME-04).

## Dependencies (status)
- T030 (`/meetings` list), T038 (`/outreach` list), T013 (metric views) — all Passed. Read
  `MeetingsList.tsx` and `OutreachList.tsx` (read-only) for established fixture-typing/loader-seam
  conventions in this codebase — match the pattern, don't invent a new one.

## Allowed Files
- `src/pages/home/CoachHome.tsx` (new — confirm via `Glob` this doesn't exist yet)
- A colocated `CoachHome.test.tsx` is acceptable per established precedent — disclose it.

## Forbidden Files
- `src/pages/home/StudentHomeSlot.tsx` — a separate, already-built (T008) standalone component
  reserved for T054's later use. **Read-only reference, do not edit or import it here** — it is
  explicitly scoped to Student Home, not Coach Home.
- `src/pages/meetings/**`, `src/pages/outreach/**`, `src/pages/reports/**` — already-Passed or
  in-progress sibling tasks' files. Read-only reference for conventions only.
- `src/app/router.tsx`, `src/app/guards.tsx` — read-only. `/` (dashboard) is already wired
  (`RequireAuth` only) to an inline placeholder `DashboardPage()` — this task does not wire itself
  in; that's a future task's job.
- `src/lib/supabase/**` — read-only reference only, do not import. Build against an injectable
  `loadData`-style seam with obviously-fake fixture defaults, same posture as every prior content
  page.
- `supabase/migrations/**` — read-only.
- `docs/swarm/**`, `.claude/**`, `src/theme/**`.

## Known Context / Traps

**1. `Analytics Dashboard` template — use it as-is, cite it.** Confirm via `npm run astryx --
template "Analytics Dashboard"` (or equivalent CLI/doc lookup — same discipline `RosterShell.tsx`/
T021 established for template citation) what the real template scaffold provides, and build within
it rather than assembling your own KPI-grid layout from raw `Card`+`Grid` primitives if the
template already provides that structure. If the template doesn't literally exist under that exact
name in the installed Astryx version (a real possibility — several prior tasks have hit doc/CLI
naming gaps, e.g. T016's "Basic Login"), investigate and disclose what you found rather than
silently building a look-alike layout and claiming template compliance.

**2. BEH-05 KPI card discipline is a real, checker-enforced acceptance bar.** One metric per `Card`
— large value, small label, optional secondary trend/delta line. Never two numbers of equal visual
weight in one card. Your four KPI cards (participation %, hours-vs-goal, last-meeting attendance
rate, next-7-days count) must each be visually single-metric-primary.

**3. BEH-01 milestone ticks apply to the hours-vs-goal `ProgressBar`.** Same 25/50/75/100% tick
pattern and deduped-`Toast`-on-crossing behavior already established by T038's `OutreachList.tsx`
(read it, read-only, for the exact localStorage-dedupe-key pattern — reuse the same convention,
scoped appropriately for this page's own goal-bar identity).

**4. "Start check-in" visibility logic — a real, testable time-window rule.** Visible when a
meeting session is live OR starts within 60 minutes. Prove this with real tests across the boundary
(a session starting in exactly 61 minutes should NOT show the action; one starting in exactly 59
minutes should).

**5. HOME-04 (admin-only "Season setup" shortcut) — role-gate this within the component**, since
`router.tsx` isn't wired yet and there's no route-level distinction between Coach Home and Admin
Home (they're the same component, HOME-04 says "Admin Home = Coach Home + one extra card"). Use
`useAuth()` from `guards.tsx` (read-only import) to check the current user's role and conditionally
render the extra card only for `admin`.

**6. No shared Supabase client wired in — deliberate scope, not a gap for you to solve.** Same
posture as every prior content page — injectable `loadData`-style seam, obviously-fake fixture
defaults, typed against real schema shapes (`event_sessions`, `rsvps`, `v_student_participation`,
`v_team_participation` if relevant — read the real migration files for exact column shapes).

**7. "Recent signups" copy format is specified verbatim in the PRD**: e.g. "Ada signed up for STEM
Fair · 2h ago" — match this exact style (name + verb + event title + relative timestamp), don't
invent a different format.

## Acceptance Criteria
- Four KPI cards per HOME-01, each single-metric-primary (BEH-05).
- Hours-vs-goal `ProgressBar` has BEH-01 milestone ticks + deduped `Toast`.
- "Start check-in" visibility correctly time-windowed (live or ≤60 min out), proven with boundary
  tests.
- "New outreach event" action present (stub is fine — disclosure Banner, same pattern as prior
  tasks' out-of-scope actions).
- "Next up" shows next 5 sessions of any type with a type `Badge` each.
- "Recent signups" shows last 10 future-outreach RSVP changes in the PRD's exact copy format.
- HOME-04 admin-only "Season setup" card correctly role-gated.
- `Analytics Dashboard` template used as-is (or the investigation/disclosure required by Known
  Context/Traps #1 if it doesn't cleanly exist).
- No box-drawing/bracket characters rendered (constitution item 13).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` all exit 0.

## Relevant Constitution Excerpts
> 13. Templates are used as-is; inventing a layout instead of using the named template is a
> violation.

> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md`. A prop absent from that
> file is presumed hallucinated → MAJOR.

> 6. No PII... test fixtures use fabricated names.

## Most Recent Failure
None. This is attempt 1 for T053 (attempt count: 0).

## Required Worker Output
- Full contents of `CoachHome.tsx`.
- Explicit write-up of your `Analytics Dashboard` template investigation and citation.
- Real test proof of the "Start check-in" 60-minute boundary logic.
- Real test proof of the BEH-01 milestone-toast dedupe on this page's own goal bar.
- Real proof of HOME-04's admin-only role-gating (renders for admin, not for coach).
- Astryx prop citations for every component used — grep `astryx-api.md` yourself, don't guess.
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
