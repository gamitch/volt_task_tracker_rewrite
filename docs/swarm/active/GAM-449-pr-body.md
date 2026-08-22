Closes GAM-449

## What changed

Builds the coach view's right rail — `src/pages/meetings/coach/MeetingsRail.tsx`
(a GAM-444 stub until now) plus `MeetingsRail.css` and `MeetingsRail.test.tsx`.
A season-bounded single-month Astryx `Calendar`, a per-series color legend, and
an agenda of the next five meeting days from Chicago-today, each item emitting
`MeetingsFocusRequest { eventId, sessionId, monthKey }` and nothing else.
Overlap and Canceled badges, day-selection filtering with a Clear affordance, a
Today control, and all four DES-12 states.

Three files, no others.

## What the issue got wrong

Two premise-gate rounds falsified three things in the issue and in my own first
packet. All three are measurements, not readings.

**1. The issue's prescribed day-marking mechanism cannot work.** GAM-449's "one
constraint" — amended 2026-08-21, *after* GAM-441 merged, specifically to keep
this — says "day cells get GENERIC has-meeting marking only via those hooks"
(`astryx-calendar-day` / `data-today` / `data-selected`). Those hooks cannot
express *has a meeting*: `Calendar` sets exactly four attributes on a day cell
(`Calendar.tsx:984-990`, matching `astryx-api.md:2357`) and none is keyed to
caller data. The only per-day-unique hook is `data-date` (`:972`), reachable
only through a generated `<style>` tag, which T045 already rejected on the
record (`CalendarPage.tsx` module doc 1c).

The one remaining route was tried and **measured worse**: inverting the marking
with `dateConstraints` so `data-disabled` marks meeting days by contrast puts
**33 of 42 rendered day cells** into a real `disabled` state for a single Mon/Thu
series, makes an empty day unclickable, and trips `astryx-api.md:2317`'s own
"Don't disable large blocks of dates without context."

So the rail ships T045's already-shipped resolution: the `Calendar` navigates
months and selects days, and has-meeting information lives in the legend and
agenda. **The achievable half of the constraint is kept, not dropped** —
`astryx-calendar-day` with `data-today` / `data-selected` is themed in
`MeetingsRail.css` under `@layer app`, exactly as the issue asks. Escalated on
the issue before any code was written, not disclosed afterwards.

**2. A cleared day would have stayed highlighted.** `Calendar`'s
`effectiveValue = value !== undefined ? value : internalValue`
(`Calendar.tsx:250`) means a click sets an internal selection that
`value={undefined}` falls back to, and `value={null}` does not typecheck. Clear
and Today would have reset the agenda while leaving the grid lit on the wrong
day — green in every test that did not look at the grid. Fixed with T045's
`key={calendarResetKey}` remount, and criteria 6 and 14 now assert the grid.

**3. My round-1 packet claimed things that were not true.** It said deriving the
season window from `rows` was "the only option" (`useActiveSeason()` exists);
it forbade widening the props, which would have reversed merged GAM-447 work
that added `isLoading?`/`errorMessage?` to the equally frozen `SeriesCardProps`;
it said a follow-up was filed when none was; and it attributed a single tabbable
grid cell to `dateConstraints` when that is `Calendar`'s roving tabstop
regardless. Corrected in round 2.

## Tier, stated and defended

**STANDARD**, judged at claim time as item 28d requires, and it held. Item 26's
HEAVY triggers are all absent: no write path or destructive operation, no
RLS/auth/role logic, no migration or metric-view SQL. It is not FAST either —
FAST is bounded at roughly ≤20 lines of production change and forbids changing a
signature another module imports, and this ships a component whose props a
sibling integration ticket codes against.

The losing argument for HEAVY was that the frozen props are a contract other
sessions build against; it loses because this ticket *consumes* a contract the
GAM-444 decomposition already froze rather than defining one.

**One deviation from STANDARD, declared rather than relabelled:** STANDARD does
not require a premise gate, and this row got two rounds of one. That was not
ceremony — round 1 killed the mechanism the issue prescribed, and round 2 caught
a defect that would have shipped green. The tier is still STANDARD; the extra
gate is the deviation.

## Verification

Six gates, run by the orchestrator independently of the worker, on a clean tree:

```
GATE RUN — 5f0f83a2 on claude/gam-449-meetings-rail — tree clean

  1 tsc                               exit 0  PASS
  2 vite build                        exit 0  PASS
  3 format:check                      exit 0  PASS
  4 eslint                            exit 0  PASS       0 errors, 382 warnings
  5 vitest (full)                     exit 0  PASS       110 files / 2691 tests
  6 vitest src/pages/meetings/coach/  exit 0  PASS       3 files / 77 tests

VERDICT: PASS — all six gates exit 0
```

The 382 eslint warnings are the repo's standing
`react-refresh/only-export-components` class, unchanged. Gates 5 and 6 were run
without a baseline, so no regression comparison was made — stated rather than
implied.

**Mutations, replayed by the orchestrator in its own worktree** (item 23), each
reverted with a green re-verification. The worker's own three are not quoted
here; these are independent runs.

| # | Mutation | Result |
|---|---|---|
| A | Drop `monthKey` from the emitted `onFocusChange` payload | **red**, exit 1 — criterion 1: `- "monthKey": "2026-08"` |
| B | Remove `key={calendarResetKey}` from `<Calendar>` | **red**, exit 1 — criteria 6 and 14 both fail on the surviving `data-selected` |
| C | Reintroduce round-1's withdrawn `dateConstraints={[() => false]}` | **red**, exit 1 — criteria 4, 6 and 14 |
| — | Revert all three | **green**, exit 0 |

Mutation B is the one worth reading: it proves the round-2 gate's BLOCKER fix is
genuinely guarded rather than merely present.

Astryx prop discipline (item 2) checked by hand against
`docs/swarm/astryx-api.md`, including `Banner`'s `status`/`title`/`description`
and `EmptyState`'s `headingLevel`/`title`/`description`. No hex literal for a
series hue appears in either the component or its CSS.

## Scope — this closes **Partial**, not Passed

Constitution item 27. `MeetingsRail` has **zero importers repo-wide**: it is on
no route and no user can reach it today. **GAM-452** is the integration ticket
and its own description says "Until this merges, every component ticket in the
group is `Partial` by definition." The rail reads real `CoachMeetingRow` data
through its props — it is a genuine seam, not a fixture-fed screen — but it is
not on a user's path, so Passed would be a claim about a surface nobody can see.

## Follow-ups filed

Both `Backlog` + `tier/unreviewed`, written through the `linear-task-writing`
skill, before this PR opened.

- **GAM-476** — two components will hash the same event id independently, so one
  series could render one color on its card and another in the rail legend.
  `SeriesCardModel.paletteIndex` is declared but nothing builds a
  `SeriesCardModel` yet, so the rail exports its own hash for GAM-452 to adopt.
- **GAM-477** — `todayIsoChicago` is defined inside `CalendarPage.tsx` and a
  second copy now ships in `MeetingsRail`. GAM-443 exists because
  `formatWeekdayDate` did this once already.

## Known gaps, disclosed

1. **The month grid carries no has-meeting marker.** See "What the issue got
   wrong" #1. If that marker is the point of the ticket rather than one of its
   features, this needs a different calendar component or an owner-approved
   DES-21 escalation — flagged on the issue for the owner rather than decided
   here.
2. **Every series swatch ships neutral.** The ticket is titled "with per-series
   colors"; `--color-series-1…8` does not exist in `src/theme/volt.ts` and
   **GAM-466** owns those hues. Each swatch and agenda dot carries
   `data-series-palette-index`, so one CSS rule lights the page up once GAM-466
   lands — the same seam merged `SeriesCard.tsx` already uses.
3. **The season bound is opt-in and GAM-452 does not yet know about it.**
   `seasonStartsOn?`/`seasonEndsOn?` are additive optional props; without them
   the window silently falls back to the span of the rows' own sessions.
   GAM-452's description names no season window and does not list this file, and
   optional props raise no compile error — so "season-bounded" would quietly
   become "session-span-bounded". Recorded as a comment on GAM-452 while it is
   still `Backlog`.
4. **`layout-measurement` was skipped, not run.** The issue mandates it; the rail
   is mounted on no route, so there is no URL for a browser to load. GAM-452
   already carries that skill as mandatory and is the ticket that will have one.
   The 336px rail width is therefore a CSS constraint honoured by construction,
   not a measured result — said plainly rather than implied.

Linear-Issue: GAM-449
