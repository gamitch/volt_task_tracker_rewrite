Closes GAM-447

**DRAFT.** Opened at minute 5 per `AGENTS.md` wall 3. This body was last written
to GitHub at ~minute 40, while the `ghs_` PR credential was still alive
(`exp 2026-08-21T23:40:44Z`, decoded at minute 1). If the sections below still
read "pending", the credential expired before the run could refresh them —
**the branch's own `docs/swarm/active/GAM-447-pr-body.md` is then newer than
this description, and `docs/swarm/active/GAM-447-run-log.md` is the record of
what actually happened.**

## What changed

Builds the coach view's fixed-size `SeriesCard` under
`src/pages/meetings/coach/`, against the props GAM-444 froze on the stub and the
formatters GAM-443 put in `src/lib/meetings/format.ts`. Fixture-driven; real
data arrives via the integration ticket.

## What the issue got wrong

The premise gate (`checker-premise`, opus) measured three of the issue's
prescriptions as unbuildable as written, and confirmed all three:

1. **`SeriesCardModel` cannot carry half of what the issue asks the card to
   render.** The frozen type (`src/lib/meetings/types.ts:268-306`) has no
   location, no roster count, no canceled count, no hours logged/planned, no
   date span and no "N expected". The `meetings-design` skill forbids widening a
   frozen type that sibling tickets are coding against — and **the PRD agrees
   with the type, not with the issue**: MTG-01a
   (`docs/swarm/VOLT_Portal_PRD.md:303-313`) asks for title, team scope,
   schedule chips, progress, attendance % and a next-session line, and nothing
   else. Item 1 puts the PRD above the issue text.
2. **The series palette does not exist.** `--color-series-1…8` is absent from
   `src/theme/volt.ts` (zero occurrences of `series`), which is outside this
   ticket's Allowed Files anyway, and the skill says an unsettled palette is
   "a blocker to raise, not a gap to fill with your own hex values". The card
   therefore carries `paletteIndex` to the DOM as `data-series-palette-index`
   and renders the color-dependent treatments neutrally; one CSS rule lights
   them up once the owner settles the hues.
3. **The Edit affordance has no seam to submit through.** `onSaveMeetingSeries`
   exists on `MeetingsListProps` (`MeetingsList.tsx:120`),
   `CoachMeetingsViewProps` (`CoachMeetingsView.tsx:1282`) and
   `ScheduleMeetingsDialogProps` (`:932`) — but **not** on `SeriesCardProps`,
   and `CoachMeetingsView` does not render `SeriesCard` at all yet, so there is
   no render site to thread it through without editing a forbidden file. MTG-01a
   also puts no Edit on the card; `:315-317` puts the `Edit` chip in MTG-01b's
   drill-out, a sibling ticket. Shipping the button inert would be the
   `SettingsPage` light/dark failure (item 27), so it is omitted and filed.

The gate also falsified three of my own packet's citations, which is the point
of running it: a `MeetingsList.tsx:2019` line reference that no longer exists
(the file is 193 lines after GAM-444's split), a claim that `pixel`/
`proportional` are an inline-style idiom (they are `TableColumn` width helpers),
and a DES-21 ladder still naming `xstyle` — which is **nonfunctional in this
app** (F-2: no StyleX plugin, `stylex.create()` throws at runtime).

## Tier, stated and defended

**STANDARD** (item 26). No write path — the Edit action would have called an
*existing* seam and is not shipped at all; no schema, RLS, migration or metric
SQL; no auth or role logic. Too large for FAST (a new component and its tests,
well past FAST's ~20 production lines). The arguable heavier read is "a sibling
ticket builds against this file"; it loses because the shared contract lives in
GAM-444's frozen types, which this ticket only consumes.

## Process deviation, declared rather than hidden

Item 19 requires `checker-premise` to return **DISPATCH** before a packet
reaches a worker. Round 1 returned **REVISE** with 3 MAJOR / 4 MINOR / 1 NIT;
every finding was applied. **Round 2 never returned a verdict — the agent died
on a server-side `API Error: 529 Overloaded`.** That is a missing gate round,
not a passed one, and it is recorded here rather than rounded up. See the run
log for the exact sequence and for what was and was not dispatched afterwards.

## Verification

Pending — see the run log and the branch copy of this file for the `gate-run`
evidence block.

## Scope (item 27)

`SeriesCard` renders from props supplied by its caller, and it has **no caller
yet** — `CoachMeetingsView` does not render it. This ticket therefore closes
**Partial**, not Passed: the surface is not reachable by a user until the
integration ticket wires it. That was true of the stub before this PR and is
unchanged by it.

## Follow-ups filed (item 20)

Pending — see the run log.

Linear-Issue: GAM-447
