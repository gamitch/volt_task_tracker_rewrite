# GAM-449 run log — meetings right-rail calendar + agenda

Branch: `claude/gam-449-meetings-rail`
Runtime: Claude (Opus 5) orchestrator, dispatched from Linear.
PR credential (`ghs_`) `exp` decoded at minute ~1: **2026-08-22T01:53:48Z**
(`iat` 2026-08-22T00:53:48Z, 3600s lifetime). Draft PR must be opened well
before that.

Convention for this log: **if a "dispatched" line is the last line in this
file, the run died holding that subagent.** Each dispatch is written before
the wait; each verdict is written the moment it returns.

## Entries

- 2026-08-22T00:55Z — **Claimed.** GAM-449 `Todo → In Progress`, read back and
  confirmed. Tier judged as part of claiming (item 28d): `tier/unreviewed`
  replaced with `tier/standard`. Defence: no write path, no destructive
  operation, no schema/RLS/migration/auth-or-role logic — the rail is a
  read-only, fixture-driven presentation component, so item 26's HEAVY triggers
  are all absent. It is not FAST either: FAST is bounded at roughly ≤20 lines of
  production change and forbids changing a signature another module imports,
  and this ships a new component whose frozen props a sibling integration
  ticket codes against. STANDARD = worker implements, orchestrator replays the
  mutation and runs the gates. No executor label on the row, which under item
  28b's migration-compatibility rule is the legacy Claude-only path.
  Intent: build `src/pages/meetings/coach/MeetingsRail.tsx` + `.css` + tests
  against the frozen decomposition contract, emitting `MeetingsFocusRequest`
  only. Known-unresolved going in: whether the frozen prop/type names the
  issue refers to actually exist on `main` yet (sibling Wave-2 tickets froze
  them); to be measured before any packet is written.

- 2026-08-22T00:58Z — **Draft PR opened early** (wall 3): PR #235, at roughly
  minute 5 of a 60-minute PR credential. Body artifact written to
  `docs/swarm/active/GAM-449-pr-body.md` *before* the API call and validated by
  `.claude/skills/pr-body/scripts/check.mjs` (exit 0, `closes GAM-449`).

- 2026-08-22T01:02Z — **Packet written**: `docs/swarm/active/GAM-449-packet.md`.
  Orchestrator recon measured five things before writing it, all against the
  live tree with `node_modules` installed:
  * Astryx `Calendar`'s day cell sets exactly four theme attributes
    (`Calendar.tsx:984-990`) and hard-codes `{dayNumber}` as its whole body
    (`:1019`) — no per-day render slot, confirming GAM-441's merged ruling.
  * `data-date={day.iso}` (`:972`) is the only per-day-unique hook, and T045
    already measured and REJECTED building on it (`CalendarPage.tsx` module doc
    item 1c). The packet carries that rejection forward.
  * `dateConstraints` + the documented `data-disabled` hook is the mechanism
    chosen for generic has-meeting marking; recorded as least-confident #1.
  * Season-bounded nav needs no custom arrows — `Calendar` already derives
    `canNavigatePrevious`/`canNavigateNext` from `min`/`max` (`:311-330`) and
    disables its own header arrows (`:443`, `:460`).
  * `--color-series-1…8` does not exist in `src/theme/volt.ts` (zero grep hits)
    and nothing in `src/` builds a `SeriesCardModel`, so no shared palette-index
    hash exists. Packet follows the merged `SeriesCard.tsx` precedent: neutral
    swatches carrying `data-series-palette-index`, no invented hues.
  Packet ends with five least-confident decisions for the gate to attack.

- 2026-08-22T01:03Z — **Dispatched `checker-premise`** (opus, high effort) on
  the packet, `run_in_background: false`. *If this line is the last one in this
  file, the run died holding this subagent.*

- 2026-08-22T01:14Z — **`checker-premise` verdict: REVISE** (round 1 of the
  two-round cap, item 19a). 2 BLOCKER, 6 MAJOR, 6 MINOR, 4 NIT. It ran real
  experiments in its own worktree rather than only reading, which is what item
  26 says makes a gate worth its cost — and it falsified my central design
  decision with a number:
  * **BLOCKER-1 — my `dateConstraints`-to-disable mechanism is wrong.** Probe:
    for one Mon/Thu series in Aug 2026, **33 of 42 rendered day cells** go
    `data-disabled` (I had guessed "18 of 31"), each a real `disabled` button
    with `tabIndex="-1"`, leaving one tabbable cell in the whole grid. It also
    makes clicking an empty day impossible, which the live issue does not ask
    for. Withdrawn; falling back to T045's shipped resolution — no grid
    marking, `Calendar` for navigation and day selection only.
  * **BLOCKER-2 — an off-by-one I would have shipped.** A `dateConstraints`
    predicate receives local midnight, and the Chicago `Intl` formatter I
    mandated returns the previous day for it under CI's `TZ=UTC`
    (`2026-08-22T00:00:00Z → 2026-08-21`). Moot now that BLOCKER-1 removes the
    predicate, but the same trap applies to `Calendar`'s own `data-today`,
    which is browser-zone and can disagree with Chicago-today by a day.
  * **MAJOR-3 — criterion 9 silently reversed merged work.** GAM-447 added
    `isLoading?`/`errorMessage?` as additive optional props to the equally
    frozen `SeriesCardProps` and passed. My "do not widen the props" reading
    would have reversed a passed sibling (Definition of Ready #5).
  * **MAJOR-4 — "the only option" was false.** `useActiveSeason()` carries the
    real season window, and is what the very precedent the issue cites uses.
  * **MAJOR-5 — this ticket closes Partial, not Passed**, linked to GAM-452:
    `MeetingsRail` has zero importers repo-wide today.
  * MAJOR-6/7/8 — no criterion exercised the frozen `focus` prop; the "Today"
    control the issue requires was dropped; tests need a pinned clock.
  Revising the packet now (round 2 of 2).

- 2026-08-22T01:22Z — **Follow-ups filed before dispatch** (items 20/30, gate
  MINOR-9/10): **GAM-476** (two components will hash the same event id
  independently — one series could render two colors) and **GAM-477**
  (`todayIsoChicago` duplication). Both `Backlog` + `tier/unreviewed`, written
  through the `linear-task-writing` skill. Round 1's packet claimed
  "(follow-up filed)" when none was — the gate caught that; it is true now.

- 2026-08-22T01:24Z — **Packet round 2 written.** All 18 findings applied. The
  three that changed the design: has-meeting grid marking is **withdrawn
  entirely** in favour of T045's shipped resolution (Calendar navigates and
  selects; marking lives in the legend and agenda); loading/error become
  additive optional props per the merged GAM-447 precedent instead of a
  disclosed gap; the season window becomes two additive optional props with a
  rows-derived fallback, rather than the false claim that deriving from `rows`
  was the only option. Two new criteria added: the frozen `focus` prop (nothing
  exercised it, so a worker could have `void`ed it and passed) and the "Today"
  control the issue requires. This ticket will close **Partial**, linked to
  GAM-452 — `MeetingsRail` has zero importers repo-wide.

- 2026-08-22T01:25Z — **Dispatched `checker-premise` round 2** (opus, scoped to
  the revisions per item 19b, not a re-audit), `run_in_background: false`. This
  is the last gate round the cap allows (item 19a); a third REVISE escalates to
  the owner. *If this line is the last one in this file, the run died holding
  this subagent.*

- 2026-08-22T01:32Z — **`checker-premise` round 2 verdict: REVISE, narrowly** —
  1 BLOCKER, 1 MAJOR, 9 foldable. It confirmed 14 of round 1's 18 findings
  RESOLVED and caught one genuine defect I would have shipped:
  * **BLOCKER — a cleared day stays highlighted.** `Calendar`'s
    `effectiveValue = value !== undefined ? value : internalValue`
    (`Calendar.tsx:250`) means a click sets an internal selection that
    `value={undefined}` falls back to; the gate clicked 2026-08-12, re-rendered
    with `undefined`, and measured `data-selected` still on the cell.
    `value={null}` does not typecheck. Fix is T045's shipped `key={resetKey}`
    remount, and criteria 6 and 14 now assert the grid — without the assertion
    the defect ships green.
  * **MAJOR — the season seam had no handoff.** GAM-452's live description names
    no season window and does not list `MeetingsRail.tsx`, and optional props
    raise no compile error, so it would never pass them and "season-bounded"
    would silently become "session-span-bounded". §8 now requires the handoff be
    recorded on GAM-452 while it is still Backlog.
  * It also falsified one of my own supporting claims: "leaving one tabbable
    cell in the entire grid" is the roving tabstop, not a consequence of
    `dateConstraints` (measured `TABBABLE 1` with no constraints either).
    Struck. And it recovered something I had dropped — styling
    `astryx-calendar-day` via `data-today`/`data-selected` IS achievable and the
    issue asks for it; only *has-meeting* marking is not. Reinstated in §5.
  All 11 revisions applied. **No round 3** — item 19a caps the gate at two, and
  the checker specified each remaining fix concretely rather than disputing the
  design.

- 2026-08-22T01:33Z — **Escalation posted on GAM-449** (comment
  `#comment-f0732561`), before dispatch, so the DoR item-3 escalation is named
  on the record rather than disclosed after the fact: the issue's amended "one
  constraint" requires generic has-meeting day marking through hooks that two
  gate rounds measured cannot express it, and the inverted-marking alternative
  measured worse. Also disclosed there: neutral swatches (GAM-466 owns the
  hues), Partial close linked to GAM-452, and the GAM-476/477 follow-ups.

- 2026-08-22T01:34Z — **Dispatched `worker-implementer`** on the round-2 packet,
  pinned default model (no item-18 trigger), `run_in_background: false`.
  *If this line is the last one in this file, the run died holding this subagent.*

- 2026-08-22T01:55Z — **`worker-implementer` returned.** Commit
  `0be0c13e5a475449453cecdeeafd9b98013fd4bf`, three files only
  (`MeetingsRail.tsx` +654, `MeetingsRail.css` +58, `MeetingsRail.test.tsx`
  +851). Verified independently that HEAD moved and the change is in the
  committed blob, not just the tree (item 21). Reported gates all exit 0 and 25
  scoped tests; reported all three named mutations run, red output captured,
  reverted and re-verified. Reported none of the packet's §3 findings false.
  Orchestrator now replays a mutation and runs the gates itself — a worker
  cannot self-certify.

- 2026-08-22T02:10Z — **Gates run independently by the orchestrator** on a clean
  tree at `5f0f83a2`: all six exit 0 (tsc, vite build, format:check, eslint 0
  errors / 382 standing warnings, full suite 110 files / 2691 tests, scoped
  `src/pages/meetings/coach/` 3 files / 77 tests). No baseline was supplied, so
  gates 5 and 6 report no regression comparison — stated, not implied.

- 2026-08-22T02:10Z — **Mutations replayed by the orchestrator** in its own
  worktree `/tmp/gam449-mut` (item 23), not the branch tree, each reverted with
  a green re-verify. (A) dropping `monthKey` from the emitted payload → red,
  exit 1, criterion 1. (B) removing `key={calendarResetKey}` → red, exit 1,
  criteria 6 and 14 both fail on the surviving `data-selected` — this is the
  one that matters, because it proves the round-2 BLOCKER fix is genuinely
  guarded rather than merely present. (C) reintroducing round-1's withdrawn
  `dateConstraints` → red, exit 1, criteria 4, 6 and 14. Revert → green, exit 0.
  Diff inspected by hand: three files only, no forbidden path touched, no hex
  literal for a series hue, no jargon in rendered copy, and every Astryx prop
  used checked against `docs/swarm/astryx-api.md` (including `Banner`'s
  `status`/`title`/`description`).
