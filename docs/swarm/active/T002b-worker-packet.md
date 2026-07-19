# Worker Packet: T002b

## Task ID
T002b — Dark-mode `--color-on-accent` contrast fix (D005 corrective task)

## Objective
Close a real, live WCAG AA contrast shortfall confirmed by boss-arbiter ruling D005
(`docs/swarm/dispute-log.md`): the shared `Button variant="primary"` (and every other
`--color-on-accent` consumer — Badge `info`, CheckboxInput, RadioListItem, NavIcon, and the future
Bolt confirmation screen) renders navy `#0000B3` text on the `#9B7BFF` dark-mode accent
background, measuring 4.041:1 — below AA's 4.5:1 minimum for normal-size (14px/weight-500) text.

Root cause (verified by boss-arbiter against installed Astryx source, not inference): Astryx bakes
dark-mode `--color-on-accent` as a resolved hex computed against the *derived* dark accent tone,
and never re-derives it when a raw `tokens` override (like DES-03's `--color-accent`) replaces that
derived value at higher precedence. This is a genuine PRD-internal conflict between DES-03 (exact
theme token block) and DES-06 (WCAG AA both modes) — not a defect in any prior worker's or
checker's work. D005 authorizes a narrow, one-line fix. This is a same-day forward-fix in the
T002a/T006a/T016a pattern: **no rework of T002, T016, or T018 exists or is permitted.**

## Allowed Files
- `src/theme/volt.ts` — exactly one added line inside the existing `tokens` map, plus at most one
  comment line citing D005. Every other byte must stay identical to the DES-03 block, including
  `'--color-accent': ['#5B2EE5', '#9B7BFF']` (DES-04 brand palette — untouched).
- `src/theme/theme.css` — regenerate the generated block per that file's own header instructions
  (it documents the build command itself — read it directly). The baked
  `--color-on-accent: light-dark(#FFFFFF, #0000B3)` at line ~218 ships to production via DES-07's
  built-CSS path and **must** move in lockstep with `volt.ts`, or the fix won't actually reach the
  browser.

## Forbidden Files
- `package.json` — the existing `!src/theme/volt.ts` Prettier glob exclusion (from T002a) stays
  exactly as-is; do not touch it.
- `src/theme/theme.smoke.test.tsx`, `src/theme/astryx-augment.d.ts` — not this task.
- `src/pages/**`, `src/app/**`, `src/components/**` — not this task; these pages already consume
  the theme correctly and need no changes, only the token itself.
- `vite.config.ts`, `.github/**`, all `node_modules/**` content.
- `docs/swarm/**`, `.claude/**`.

## The Authorized Fix (D005 Ruling A — do not re-derive, do not substitute a different value)
Add exactly this to `volt.ts`'s `tokens` map:
```ts
'--color-on-accent': ['#FFFFFF', '#00008D'],
```
- Light value `#FFFFFF` is byte-identical to today's resolved value — zero light-mode change.
- Dark value `#00008D` is Astryx's own tonal-ramp stop (P[10], one step darker than the currently
  baked P[20] `#0000B3`) against the actual shipped `#9B7BFF` accent — independently recomputed by
  boss-arbiter at 4.818:1, clearing AA with margin. Do not substitute pure black or any other value
  — this exact hex was selected and verified.
- `--color-on-accent` is a valid, typed `defineTheme` `tokens` key (not a hallucinated prop) — see
  the D005-marked annotation now in `docs/swarm/astryx-api.md`'s Button Theming section
  (constitution item 2 — your checker has already been told not to flag this).

## Acceptance Criteria
1. `src/theme/volt.ts` diff vs. the current file is exactly the one added token line (+ optional
   one-line D005 comment) inside the `tokens` map — every other line byte-identical to DES-03,
   `--color-accent` unchanged.
2. `src/theme/theme.css` regenerated: contains `--color-on-accent: light-dark(#FFFFFF, #00008D)`,
   zero remaining occurrences of the stale `#0000B3`, `@layer reset, astryx-base, app;` structure
   and NFR-08 layer order unchanged, no new unlayered CSS introduced.
3. `npm run build` / `typecheck` / `lint` / `format:check` / `test` all exit 0.
4. `dist/assets/theme.css` still emitted as a static asset (DES-07, no runtime style injection);
   manually re-verify the CI bundle-size gate logic from `.github/workflows/ci.yml` still passes
   against a fresh build.
5. Pixel-level dark-mode re-measurement of the live `/login` page's primary button text (real
   browser render, not token arithmetic alone — same methodology T018's checker used: render,
   screenshot or sample actual pixel colors, compute WCAG contrast) — must be ≥4.5:1. Light-mode
   spot-check on the same button — must be unchanged (~7.08:1, white on `#5B2EE5`).
6. Computed-pair verification for at least one other reachable `--color-on-accent` consumer today
   (Badge `info` variant, if reachable anywhere in the built app — otherwise state clearly that
   none is currently reachable and rely on the direct computed value, `#00008D` on `#9B7BFF` =
   4.818:1).
7. Any scratch file used to regenerate `theme.css` (e.g. via `npx astryx theme build src/theme/volt.ts
   -o <scratch>.css`) is deleted before handoff — it is explicitly not in Allowed Files.

## Required Worker Output
- `volt.ts` diff (full, showing it is exactly the authorized one-line addition).
- `theme.css` diff or at minimum a grep showing the new `light-dark(#FFFFFF, #00008D)` value and
  the absence of `#0000B3` anywhere in the file.
- Full command output: build/typecheck/lint/format:check/test, all exit 0.
- Bundle-size gate re-check output.
- Pixel-measurement numbers for both modes, with method stated (how you rendered/sampled).
- Confirmation any scratch build file was deleted.
- Known risks; whether a dispute is needed (should not be — this is a fully specified, narrow fix).

## Relevant Constitution / Dispute-Log Excerpts
> D005 Ruling A: "PRD deviation AUTHORIZED, narrowly... this entry is that explicit approval (same
> override mechanism D003 used for the test Non-Negotiable)."

> D005 Ruling B: `astryx-api.md`'s Button Theming section carries a D005-marked annotation
> confirming `--color-on-accent` is a valid theme token, not a hallucinated prop.

> Non-Negotiable: "No worker may mark its own work complete." Every checker inspects the actual
> artifact, not your summary.

## Most Recent Failure
None. This is attempt 1 for T002b (attempt count: 0).
