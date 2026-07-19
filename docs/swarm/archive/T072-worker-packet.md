# Worker Packet: T072

## Task ID
T072 — Fix NFR-06 responsive gap on the live check-in console (`LiveConsole.tsx`), Epic E5.

## Objective
`src/pages/meetings/LiveConsole.tsx` (built by T033, already Passed) does not meet NFR-06's
literal, PRD-cited requirement: *"Responsive 375px → 1440px; coach console usable on a phone
(panes stack, QR collapses behind a button)."* T068's audit (Passed, both worker and checker
independently confirmed this) found two concrete, evidenced defects:

1. **No QR show/hide toggle exists anywhere in the file.** `QrPanel` (lines 719-750) is rendered
   unconditionally as a permanent sibling of the roster pane at every viewport width. There is no
   `useState` toggle, no conditional render, nothing gating its visibility. The only nearby
   interactive element, `"Open kiosk view"` (line 745-747), is a `Link` that *navigates to a
   different route* (`/kiosk/:sessionId`) — it does not show/hide the QR panel in place.
2. **The roster pane is the one fixed-width usage in the whole codebase missing the app's own
   established overflow-safety convention.** `<VStack gap={4} minHeight={200} width={480}>` (line
   994) has no `maxWidth`. Every other fixed-width usage in `src/pages` pairs `width={N}` with
   `maxWidth="100%"` (`LoginPage.tsx:228`, `NoAccessPage.tsx:178`, `AcceptInvitePage.tsx:375`,
   `CheckinResult.tsx:551`) so the element can shrink to fit a narrow viewport instead of forcing
   overflow. This pane doesn't follow that pattern.

Full evidence trail: `docs/swarm/verification-log.md` `## T068` (both worker's original findings
and the checker's independent re-derivation, including exact-pixel re-computation).

## Allowed Files
- `src/pages/meetings/LiveConsole.tsx`
- `src/pages/meetings/LiveConsole.test.tsx`

## Forbidden Files
Everything else, per the ledger-wide rule (`docs/swarm/**`, `.claude/**`, and any file outside the
two above). In particular: do not touch `guards.tsx`, `router.tsx`, any other page, or any Astryx
source under `node_modules/`.

## Known Context / Traps

**1. This is a narrow, surgical fix — do not redesign the screen.** Two specific defects, two
specific fixes. Don't refactor `LiveConsole.tsx` beyond what's needed to close these two gaps.

**2. Fix #1 (roster width)**: add `maxWidth="100%"` to the roster `VStack` at line 994, matching
the exact pattern already used elsewhere in this codebase (`width={N} maxWidth="100%"`). This is a
one-line change with no behavioral risk — `width` still acts as the preferred/target size, `maxWidth`
just lets it shrink instead of overflow when the container is narrower.

**3. Fix #2 (QR toggle) — the substantive part of this task.** Add a real, keyboard-accessible
toggle control that shows/hides `<QrPanel>`. Requirements:
- A real `Button` (or an Astryx disclosure-pattern component if one exists and fits — check
  `docs/swarm/astryx-api.md` and/or run the Astryx CLI to verify before using anything not already
  used elsewhere in this file, per this project's established "verify against ground truth, don't
  guess" practice) that a user can activate via mouse click OR keyboard (Enter/Space on a focused
  button — this is free if it's a real `<button>` element, which Astryx's `Button` is).
- Toggling the button must genuinely mount/unmount (or otherwise remove from the accessibility
  tree — not just visually hide with `opacity`/`visibility` CSS) the `<QrPanel>` content, since
  this project's established pattern (see `AlertDialog`'s real native `<dialog>` semantics used
  throughout the app) treats "hidden" as "not part of the accessible DOM," not "styled invisible."
  A simple `{showQr && <QrPanel ... />}` conditional render satisfies this.
- Default state: `showQr` should default to `true` (QR visible), so this is a pure *addition* of a
  collapse affordance — no existing desktop behavior changes, and no test currently asserting
  `QrPanel`'s content is present needs to be rewritten. The button lets a coach on a phone
  deliberately collapse it to reclaim screen space for the roster, which is what NFR-06 asks for.
- The button needs a real accessible label describing what it does and reflecting current state
  (e.g. `label={showQr ? 'Hide QR code' : 'Show QR code'}`, or `aria-expanded={showQr}` if you use
  a toggle-button pattern — check what Astryx's `Button` component actually supports for this
  before inventing custom ARIA).
- Place the button sensibly relative to the `HStack` containing `QrPanel`/roster (e.g. as a sibling
  before the `HStack`, or inside a small header row) — exact placement is your call, but it must be
  visible/reachable at every viewport width, not just conditionally rendered at narrow widths
  (that would make it untestable in this repo's jsdom-only environment and isn't what the PRD asks
  for — PRD just requires the *affordance* to exist, not that it be viewport-conditional).

**4. Do not introduce a `matchMedia`/breakpoint-conditional toggle.** T068's audit (and this
project's whole test toolchain) established this repo has no real browser layout engine (jsdom
only — `clientWidth`/`scrollWidth`/`getBoundingClientRect` always return 0). A viewport-conditional
show/hide would be untestable here and isn't what NFR-06 literally asks for (a manual toggle
button, not automatic breakpoint behavior).

**5. Re-run the full existing `LiveConsole.test.tsx` suite and confirm zero regressions** — this
file already has extensive DES-17 keyboard-path/roving-tabindex coverage (T033) that must not
break. Add new test coverage for the toggle button specifically: (a) `QrPanel`'s content is present
by default, (b) clicking/activating the button removes it from the DOM, (c) activating it again
restores it, (d) the button is reachable via keyboard.

## Acceptance Criteria
- Roster `VStack` (line ~994) has `maxWidth="100%"` added, matching the codebase's established
  `width`+`maxWidth` pairing.
- A real, keyboard-accessible toggle button exists that shows/hides `QrPanel`'s content by
  genuinely adding/removing it from the DOM (not CSS-only hiding).
- Default state is QR-visible (no behavior change for existing desktop users/tests beyond the new
  button appearing).
- New test coverage proves the toggle genuinely works (DOM presence/absence, not just a state
  variable flipping).
- Zero regressions in the existing `LiveConsole.test.tsx` suite or the repo-wide test suite.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build` all clean.

## Relevant Constitution Excerpts
> NFR-06: Responsive 375px → 1440px; coach console usable on a phone (panes stack, QR collapses
> behind a button).

> No worker self-certifies; every PASS requires independent checker-inspected evidence.

## Most Recent Failure
None. This is attempt 1 for T072 (attempt count: 0) — first dispatch.

## Required Worker Output
- Diff summary of the two fixes.
- Confirmation of which Astryx component you used for the toggle button and why (cite
  `astryx-api.md`/CLI verification, not a guess).
- Test run output (typecheck/lint/test/build all clean).
- Known risks; whether a dispute is needed (you flag, you don't resolve).
