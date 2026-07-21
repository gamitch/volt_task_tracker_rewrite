# Checker Packet: T058 (Events tab) — Check Attempt 1

## Task ID
T058 — Events tab (RPT-04), Epic E9.

## Checker Agent
checker-reviewer (per task-ledger.md T058 row).

## Objective
Verify all sessions (not events) rendered one row per session across all three types (the NAV-07
combined-list exception), correct type `Badge` per row, correctly disclosed attendance/signup-count
semantics per session type, a per-session "hours awarded" computation that faithfully mirrors
`v_student_hours`'s own fallback logic without re-deriving its aggregate, and correct
people-reached/adult-volunteer attribution at their real granularity.

## Allowed Files (worker's literal permitted edit)
- `src/pages/reports/EventsTab.tsx` (new)

**Scope flag**: worker also created `EventsTab.test.tsx`, outside the literal Allowed Files line —
same disclosed pattern already ruled in-scope by every prior checker in this batch. Re-derive the
judgment yourself.

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commit (`48fcd90`) — do NOT
infer authorship from commit messages. Confirm `ReportsShell.tsx`, `ParticipationTab.tsx`,
`HoursTab.tsx`, `CalendarPage.tsx`, `CoachHome.tsx`, `router.tsx`, `guards.tsx` untouched. Note: the
working tree may show other concurrently-running/landed tasks' files — not this task's concern.

## Worker's Claimed Changes (do not trust — verify independently)
1. **NAV-07 exception, per-session rows** — claims one `Table` row per session (not event) across
   all three types, each carrying a real `Badge` (meeting=purple, outreach=blue, competition=orange
   per DES-04), independently derived before `CalendarPage.tsx` existed then confirmed matching it
   after the fact (not imported — both files are Forbidden to each other).
2. **DISCLOSED FINDING (not fixed here, out of scope)**: claims `CoachHome.tsx`'s own
   `EVENT_TYPE_BADGE` constant does NOT match DES-04 (meeting=blue/outreach=purple/competition=teal
   there vs. the correct meeting=purple/outreach=blue/competition=orange) — flagged, not corrected,
   since `CoachHome.tsx` is outside this task's Allowed Files.
3. **Hours-awarded computation (Trap #3) — the central correctness claim.** Claims
   `v_student_hours` is season-grain (`(student_id, season_id)`, already summed) with NO
   session-grain view anywhere (grep-confirmed against the metric-views migration). Claims
   `computeAttendeeHours` is a line-for-line mirror of the view's own inner
   `coalesce(hours_override, clamped window, full duration)` expression at per-attendee grain, and
   `computeSessionHoursAwarded` reuses the same `status in ('present','late')` filter/sum, plus the
   view's two join-level gates at their own correct grain: `session.status !== 'completed'` → `null`
   ("—"); `!event.countsVolunteerHours` → real `0` (not "unknown"). Claims a fixture
   (`session-c1`, `countsVolunteerHours: false`, one present attendee with `hoursOverride: 8`)
   proves the zero-despite-attendance case.
4. **Attendance-vs-signup disclosure** — claims meeting rows show `signups: null` ("—", RSVPs never
   apply to meetings anywhere in this codebase), outreach/competition rows show real
   `{goingCt, maybeCt, declinedCt}`; `attendance` counts always populated for every row/type.
5. **People-reached/adult-volunteer attribution** — claims `people_reached` (per-session, nullable)
   rendered "—" for null; `adult_volunteers_count`/`adult_volunteer_hours` (per-EVENT, no session
   equivalent) claimed REPEATED on every session row of that event, with the column header reading
   "Adult Volunteers (per event)" to prevent misleading column-summing.
6. Claims 24 new tests pass; 735/735 repo-wide. typecheck/lint/build clean; discloses whole-repo
   `format:check` fails only on `Kiosk.tsx`, a pre-existing, untouched file (cites commit `dc7aa52`).

## Required Verification Steps
1. **Read `EventsTab.tsx` and `EventsTab.test.tsx` in full** — do not rely on the worker's module
   doc or this packet's paraphrasing.
2. **Hours-awarded computation — the single most important check in this packet.** Read
   `supabase/migrations/20260717000003_metric_views.sql` lines 3-19 yourself and confirm
   `v_student_hours` is genuinely season-grain with no session-grain equivalent. Confirm by source
   read that `computeAttendeeHours` genuinely mirrors the view's THREE-WAY fallback
   (`hours_override` → clamped window → full duration) faithfully, not an approximation. Render your
   own explicit verdict: is this a legitimate new per-session computation (not a constitution item 3
   violation), or does it cross into re-deriving the view's own aggregate? Reproduce the
   `session-c1` zero-despite-attendance test case yourself.
3. **NAV-07/DES-04 — confirm the type-Badge mapping is correct** against the PRD's own DES-04 table
   (read it directly), and independently verify the claimed `CoachHome.tsx` DES-04 mismatch (read
   that file, read-only) — confirm it's a real, pre-existing issue and not something this task
   should have fixed within its own scope.
4. **Attendance-vs-signup and people-reached/adult-volunteer disclosures — confirm by source read**
   that the stated semantics per session type are genuinely what's rendered, and judge whether the
   adult-volunteer per-event repetition choice (with the disclosed column-header caveat) is a
   reasonable design decision.
5. **"Grouped Table"/`Table` component usage** — confirm the real, documented `Table` component is
   used correctly.
6. **Astryx prop citations** — spot-check `Badge`, `Banner`, `EmptyState`, `Spinner`, `Table`/
   `TableColumn`, `Text`, `VStack` against `astryx-api.md`.
7. **Test-file scope question** and **RPT-06 gating posture (no self-gate)** — render explicit
   verdicts, independently re-derived.
8. **Re-run typecheck/lint/build/test yourself** — don't accept the worker's claimed counts without
   your own run. Confirm the `format:check` failure is genuinely isolated to `Kiosk.tsx`.
9. **No box-drawing/bracket characters** (constitution item 13) — grep sweep yourself.

## Relevant Constitution Excerpts
- Item 3 (BLOCKER-class): RLS/metric SQL formulas are never re-derived in TypeScript. *(Cited
  directly because Trap #3 is exactly the kind of finding a checker should scrutinize hardest on
  this task.)*
- Item 2: Astryx component usage must stay within the documented API surface.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase)
- commands run
- exact findings
- explicit verdict on the hours-awarded computation (legitimate new computation vs. constitution
  item 3 violation)
- explicit verdict on the attendance-vs-signup and adult-volunteer-repetition disclosures
- explicit verdict on the test-file scope question
- required rework if failed
- follow-up tasks if passed with minor issues
