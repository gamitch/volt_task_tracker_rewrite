Closes GAM-456

## What changed

Wraps the three remaining bare `CoachHome.tsx` sections — Hours by team,
Goal projection, Top events by student hours — in the existing `Card`
primitive, matching the three already-panelled sections (Next up, Activity
feed, Leaderboard) GAM-438 shipped. Restores the page header's H1 to
46px/800 (`COACH_HOME_TITLE_STYLE`) and makes the eyebrow (season name)
uppercase/800-weight/accent-orange (`COACH_HOME_EYEBROW_STYLE` +
`color="accent"`), matching the approved design. All six dashboard sections
now render as consistent bordered panels; no more "two designs stacked"
seam.

## What the issue got wrong

Nothing — the issue's own measurements (line citations, computed-style
table) all checked out live against `main` @ `14708be` and against the real
rendered page in a browser. One thing the issue's own "Verification"
section already flagged as needing extra care checked out worse than
stated, not better: the page's real scroll container isn't one nested
`Layout`, it's two (`.astryx-layout-content` matches both the app-chrome
shell's own Layout and `CoachHome`'s own nested one) — resolved with a
descendant-combinator selector, see the e2e spec.

## Tier, stated and defended

**STANDARD.** Per constitution item 26: presentation-only change to one page
component, reusing existing `Card`/`style`-prop patterns this same file
already ships three times over. No write path, no schema/RLS/migration, no
auth/role logic, no signature another module imports. The issue's own "Size
and tier" section independently reaches STANDARD for the same reason. One
worker dispatch; the orchestrator independently inspected the full diff and
independently replayed both named mutations from a clean git state (not by
re-reading the worker's report).

Premise gate (item 19) was **skipped**, per item 19b: this rolls out an
already-verified pattern (`Card`-wrapping a bare section, present 3x already
in this exact file) to three more instances, plus a scoped `style`-prop
override that is this file's own established mechanism
(`KPI_TILE_GRADIENT_STYLE`/`KPI_GOAL_ACCENT_STYLE`) for a value with no
matching theme token. No novel pattern, no migration/RLS/metric-SQL risk.
Full reasoning in `docs/swarm/active/GAM-456-run-log.md`.

## Verification

Six-gate evidence, independently run by the orchestrator on the final clean
commit (`915066e`), baseline 2598 full / 228 scoped measured at the
pre-change commit:

```
GATE RUN — 915066e on claude/gam-456-coach-dashboard-panel-consistency — tree clean
  1 tsc                     exit 0  PASS
  2 vite build              exit 0  PASS
  3 format:check            exit 0  PASS
  4 eslint                  exit 0  PASS       0 errors, 380 warnings
  5 vitest (full)           exit 0  PASS       102 files / 2600 tests  baseline 2598 (+2)
  6 vitest src/pages/home/  exit 0  PASS       4 files / 230 tests  baseline 228 (+2)
VERDICT: PASS — all six gates exit 0
```

Mutation replay (run independently by the orchestrator, not just quoted from
the worker):

| Mutation | Result |
| -- | -- |
| Removed `<Card>`/`</Card>` around Hours by team | RED — `AssertionError: expected null not to be null` (`.astryx-card` ancestor check), restored → green |
| `COACH_HOME_TITLE_STYLE.fontWeight` 800 → 600 | RED — `AssertionError: expected '600' to be '800'`, restored → green |

Real-browser verification (`tests/e2e-personas/gam456-coach-home-panel-consistency.spec.ts`,
7/7 passing, coach + admin personas, both light/dark implications checked
where relevant): root font-size 16px, H1 computed `font-size: 46px`,
`font-weight: 800`; eyebrow computed `text-transform: uppercase`,
`font-weight: 800`, `color: rgb(168, 86, 10)` (the theme's real `--color-accent`,
light-mode branch — the harness's persona project runs light scheme).
All six sections confirmed live as `.astryx-card` ancestors. Admin
"Season setup" card confirmed absent under current seed data (3 seeded
teams, so its `teams.length === 0` gate is false) — matches GAM-438's own
spec comment, not a regression this PR introduced. Screenshots under
`tests/e2e-personas/screenshots/456-*.png`.

## Scope: what this does and does not close

This closes the structural-panelling and header-sizing delta only. The
issue's own "smaller divergences, same capture" list (stat-tile label size,
goal-panel right-aligned layout, milestone pills, next-up sub-line,
activity-row status dot, Hours-by-team/Leaderboard side-by-side pairing)
remains explicitly out of scope, per the boundary stated up front in the
claim comment on GAM-456.

## Follow-ups filed

- **GAM-461** (`tier/unreviewed`, `Backlog`) — pre-existing, unrelated:
  `CoachHome.tsx:2128,2160` render raw unrounded floats (`"3.99999708h"`)
  for Hours-by-team/Top-events rows, where `GoalProjectionRowItem`
  (`:2188`) already rounds via `.toFixed(1)`. Surfaced incidentally while
  screenshotting the now-panelled sections for this PR's own e2e spec; not
  fixed here since it predates and is unrelated to this row's scope.

GAM-439 (inline season-goal editor) already exists and is not this row's
concern.

## Known gaps, disclosed

- The 46px/800 literal and the eyebrow's `color="accent"` were taken at
  face value from the issue's own measured table, not independently
  re-derived from the design artboard pixel-for-pixel.
- The e2e spec's dispatch prompt assumed dark theme; the harness's persona
  Playwright project actually runs light scheme, so the color assertion
  checks the light-mode accent value (`rgb(168, 86, 10)`) rather than the
  dark one (`#f79a4a`) the issue's own capture used. Both resolve to the
  same `--color-accent` token; only the emulated color scheme differs.

Linear-Issue: GAM-456
