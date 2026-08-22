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
