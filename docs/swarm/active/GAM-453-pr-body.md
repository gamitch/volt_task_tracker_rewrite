Closes GAM-453

## What changed

Adds the two missing meetings-redesign reference figures —
`docs/swarm/figures/ux-craft/redesign-meetings-coach-1440.webp` and
`redesign-meetings-student-1440.webp` — captured from the approved design
canvas's own artboard sources, not re-drawn. GAM-447/449/451 cite these
filenames as their binding craft standard.

## How the capture was produced

The GAM-441 run established that a dispatched container cannot read the
claude.ai artifact (SPA skeleton, 403 on the API) and correctly refused to
re-draw from memory. This PR was produced by the interactive session that
authored the design canvas and still holds its artboard source files
(`Main.dc.html`, `StudentParent.dc.html`): each artboard was rendered in the
canvas runtime in headless Chromium (Playwright, viewport 1600×1100, focused
artboard view) and the preview frame captured, then encoded to webp (q92,
1600×1052). The throwaway capture rig lived in the session scratchpad and is
not committed. Content is therefore byte-derived from the same .dc.html
sources the published artifact runs — no hand redrawing, no memory.

One rendering artifact to know about when grading against the coach figure:
the card badges render as `1CANCELED`/`18OVERLAP` (missing space) — a
cosmetic wrinkle of the prototype's badge markup, not a design intent; the
PRD amendment's text (`N canceled`, `N overlap` with a space) is the
authority where they differ.

## Tier

FAST, as filed: two binary doc assets, no `src/**` change, no schema. Run
owner-directed from the interactive session (plan approved by George
2026-08-21) because only that session can reach the canvas sources — the
normal dispatch path cannot deliver this row, per GAM-441's close-out.

## Verification

- Both figures Read back and visually verified against the approved canvas:
  coach view shows the four real series (FLL, FLL–Library, P3, GG), Active/
  Finished tabs, October 2026 calendar with per-series dots and legend,
  agenda with Overlap badges on the Thursday FLL pair; student view shows the
  Thu Oct 15 hero, coming-up list, BEH-06 attendance card, past-meetings
  collapse.
- Gates: this branch changes no code; tsc/build/eslint/vitest are unaffected
  by construction (two new binary files under `docs/`). Not re-run for that
  reason — stated rather than implied.

## Scope

Complete for GAM-453 (the figures exist at the cited paths). The 375px
variants UXC-13 requires at integration time are GAM-452's deliverable, not
this row's.

## Known gaps

Figures capture the light theme only, matching the `-1440` naming the
tickets cite; dark-theme captures land with GAM-452's UXC-14 evidence.

Linear-Issue: GAM-453
