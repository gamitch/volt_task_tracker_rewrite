# Checker Packet: T002b (D005 dark-mode `--color-on-accent` contrast fix) — Check Attempt 1

## Task ID
T002b — Dark-mode `--color-on-accent` contrast fix (D005 corrective task, Epic E1)

## Checker Agent
checker-accessibility (per task-ledger.md T002b row — the same checker discipline that found D005
originally, per boss-arbiter ruling D005 Ruling C: "checker: checker-accessibility — the checker
that found it and owns DES-06 verification").

## Attempt
Check attempt 1 of 3. First check on this task. Full task context:
`docs/swarm/active/T002b-worker-packet.md`, and the authorizing ruling in full:
`docs/swarm/dispute-log.md` `## D005`.

## What This Check Covers
This is a narrow, fully-specified one-line fix — the check should be correspondingly tight and
skeptical, not exploratory. Verify: (1) `volt.ts`'s diff is exactly the one authorized token line,
nothing else changed including `--color-accent`; (2) `theme.css` was regenerated correctly and the
stale value is gone everywhere, including the actual `dist/` build; (3) the fix genuinely resolves
the contrast failure when independently re-measured on a live render (pixel-level, not trusting the
worker's own screenshots or arithmetic); (4) light mode and every other token/layer structure is
unaffected; (5) standard build/typecheck/lint/format:check/test re-run; (6) forbidden-file boundary;
(7) scratch-file cleanup.

## Worker's Claimed Changes (do not trust — verify independently)
1. `src/theme/volt.ts`: added exactly one line inside the `tokens` map —
   `'--color-on-accent': ['#FFFFFF', '#00008D'],` — plus one comment line citing D005.
   `--color-accent` claimed byte-unchanged.
2. `src/theme/theme.css`: one line changed at ~line 218, from
   `--color-on-accent: light-dark(#FFFFFF, #0000B3);` to
   `--color-on-accent: light-dark(#FFFFFF, #00008D);`. Claims this was produced by running
   `npx astryx theme build src/theme/volt.ts -o <scratch>.css` and diffing the scratch output
   against the shipped file to confirm it was the only delta, then hand-applying that one line.
3. Claims: `grep` for `#00008D`/`#0000B3` across `theme.css` and the built `dist/assets/theme.css`
   shows exactly the expected pattern (new value present once, old value absent).
4. Claims all of build/typecheck/lint/format:check/test exit 0, and a manual bundle-size gate
   re-check passes (140881 bytes gzip vs. 307200 budget).
5. Claims a live Playwright pixel-measurement (via `vite preview` on the built `dist/`, canvas
   `getImageData` pixel sampling, not a hand-rolled PNG parser) of `/login`'s primary "Sign in"
   button found: dark mode background `rgb(155,123,255)`/text `rgb(0,0,141)` (exact `#00008D`
   match) → 4.818:1; light mode background `rgb(91,46,229)`/text ~near-white (anti-aliased) →
   6.895:1 (vs. exact-value arithmetic of 7.08:1, attributed to screenshot/canvas anti-aliasing
   noise, not a regression).
6. Claims grep of the installed `@astryxdesign/core` source shows Button/Badge/Calendar/NavIcon/
   CheckboxInput/RadioListItem all reference `--color-on-accent`, but that in this app only
   `Button` and `Badge variant="neutral"` (which doesn't consume this token at all, per this app's
   own `theme.css` `app`-layer override) are actually reachable/used anywhere in `src/` — so no
   other live consumer exists today to independently spot-check beyond the Button itself.
7. Claims all scratch files (astryx CLI build output, a transient in-repo Node/Playwright driver
   script) were deleted before handoff, and that `docs/swarm/verification-log.md`'s one new line is
   an automated hook artifact, not something the worker wrote.

## Required Verification Steps

1. **`volt.ts` diff — re-derive yourself, don't trust the worker's pasted diff.** Run
   `git diff HEAD~1 -- src/theme/volt.ts` (or equivalent against the pre-T002b commit) yourself.
   Confirm: exactly one added token line with the exact authorized value
   `['#FFFFFF', '#00008D']` (not a different hex — this exact value was independently computed and
   authorized by boss-arbiter in D005, do not accept a "close enough" substitute), at most one
   comment line added, and `'--color-accent': ['#5B2EE5', '#9B7BFF']` byte-identical to before (the
   DES-04 brand palette must not have moved). No other line in the file may differ.

2. **`theme.css` diff — confirm the regeneration is correct and complete.** Re-open the file
   yourself. Confirm the `--color-on-accent` line now reads
   `light-dark(#FFFFFF, #00008D)`. Grep the entire file (not just the one known line) for `0000B3`
   — must be zero matches anywhere (a stale second occurrence, e.g. in a duplicated dark-mode-only
   block, would be a real regression risk). Confirm `@layer reset, astryx-base, app;` is still the
   first statement (NFR-08) and no unlayered rule was introduced by the regeneration process.
   **Run the actual production build yourself** (`npm run build`) and grep the real
   `dist/assets/theme.css` output (not the source file) for both values — confirm the built artifact
   that ships to users also has the fix, not just the source `src/theme/theme.css`.

3. **Independent live pixel-level contrast re-measurement — your own render, don't trust the
   worker's screenshots or numbers.** Build your own minimal verification: serve the built `dist/`
   (e.g. `vite preview`) or run the dev server, load `/login` (the only currently-reachable page
   using `Button variant="primary"`) in the pre-installed Playwright chromium with dark-mode color
   scheme emulation, and independently sample the actual rendered pixel colors of the "Sign in"
   button's background and text (e.g. via canvas `getImageData` on an element screenshot, or
   equivalent). Compute WCAG 2.x relative-luminance contrast yourself from your own sampled values.
   **Must be ≥4.5:1.** Repeat for light mode — must remain far above AA (expect ~7:1, matching the
   pre-fix value, confirming zero light-mode regression). If your sampled dark-mode value differs
   meaningfully from the worker's claimed 4.818:1, investigate why before accepting either number —
   don't just average or defer to whichever number is more convenient.

4. **Computed-value cross-check for the token's other declared consumers.** Independently grep the
   installed `@astryxdesign/core` package source (`node_modules/@astryxdesign/core`) for
   `--color-on-accent` usage sites, and independently grep `src/` for actual usage of `Badge`,
   `CheckboxInput`, `RadioListItem`, `NavIcon` with any variant that would consume this token.
   Confirm the worker's claim that only `Button` is reachable today, and that `Badge`'s only used
   variant (`neutral`, in `SideNav.tsx`) genuinely does not consume `--color-on-accent` (re-open
   `theme.css`'s `.astryx-badge.info` override yourself to confirm it doesn't reference the token at
   all, as claimed). If you find any other currently-reachable consumer the worker missed, compute
   its contrast directly (`#00008D` on `#9B7BFF` = 4.818:1, or against whatever pairing it actually
   renders) and confirm/deny AA compliance for it too.

5. **Build/typecheck/lint/format:check/test — run all five yourself, quote real unparaphrased
   output.** Confirm 0 errors on each; the same pre-existing `react-refresh/only-export-components`
   warnings (if any) are expected/non-blocking, flag only new warning categories or any error.

6. **Bundle-size gate re-check.** Manually re-extract and re-run the exact shell logic from
   `.github/workflows/ci.yml`'s bundle-size step against your own fresh build — confirm it passes.
   This is a CSS-only change so a near-identical size to the pre-fix baseline is expected; flag
   anything surprising.

7. **D001-method forbidden-file check (file-tree/diff comparison, never git authorship).** Confirm
   the only tracked files with real content changes are `src/theme/volt.ts` and
   `src/theme/theme.css`. Confirm `package.json` is byte-unchanged (the T002a-era
   `!src/theme/volt.ts` Prettier glob exclusion must still be exactly as it was).
   `src/theme/theme.smoke.test.tsx`, `src/theme/astryx-augment.d.ts`, `src/pages/**`, `src/app/**`,
   `src/components/**`, `vite.config.ts`, `.github/**` all confirmed untouched. No leftover scratch
   files anywhere in the repository (the worker claims a transient in-repo Node/Playwright driver
   script and Astryx CLI scratch build outputs were both deleted — verify genuinely gone via your
   own `find`/`git status`). The one new `docs/swarm/verification-log.md` hook-appended line is an
   always-expected background artifact per standing calibration rule — do not file it as a finding.

## Astryx Ground Truth for the Fix Itself (constitution item 2 — confirm this, don't just accept it)
Confirm `'--color-on-accent'` is genuinely documented as a valid `defineTheme` `tokens` key by
re-reading the D005-marked annotation boss-arbiter added to `docs/swarm/astryx-api.md`'s Button
Theming section yourself (search for "D005" in that file) — confirm the annotation is source-cited
(references the installed package, not just asserted) and that it actually supports the claim that
this is a legitimate token, not a hallucinated prop. Per D005 Ruling B, this task's use of the token
should NOT be flagged as hallucinated — but verify the annotation itself is real and substantive
before relying on it, rather than taking the ruling's word for it.

## Relevant Constitution / Dispute-Log Excerpts
> D005 Ruling A: "PRD deviation AUTHORIZED, narrowly: `src/theme/volt.ts` may no longer be
> byte-identical to DES-03's code block — the delta is exactly ONE added token line... Both
> DES-03/DES-04 brand accent hexes remain byte-untouched." The standing verbatim check for
> `volt.ts` is amended to "byte-identical to DES-03 except the D005-authorized on-accent line" —
> apply that amended standard here, not the original unconditional verbatim rule.

> D005 Ruling C (full acceptance criteria — cross-check the worker's claims against these
> verbatim): "volt.ts diff is exactly the authorized addition (rest byte-identical to DES-03);
> theme.css regenerated with `--color-on-accent: light-dark(#FFFFFF, #00008D)` and NFR-08 layer
> structure unchanged; build/typecheck/lint/format:check/test all exit 0; `dist/assets/theme.css`
> still emitted and the bundle gate green; pixel-level dark-mode re-measurement... ≥4.5:1;
> light-mode /login spot-check unchanged (~7.08:1); computed-pair verification for the other
> on-accent consumers reachable today... `#5B2EE5`/`#9B7BFF` confirmed byte-unchanged."

> D005 Ruling E (standing rule, applies to future checker packets, not retroactively required of
> this one): "WCAG contrast checks MUST include foreground-on-accent pairings... in both modes...
> Pixel-level measurement of the rendered artifact is the preferred method over token arithmetic
> when the two disagree." — apply this standard now, in verifying this very fix.

> Non-Negotiable: "No worker may mark its own work complete." Every checker inspects the actual
> artifact, not the worker's summary.

## Most Recent Failure
None — this is check attempt 1 for T002b.

## Required Checker Output
- PASS or FAIL, with severity (BLOCKER/MAJOR/MINOR/NIT) for any finding.
- Exact commands run + real quoted output for all of: your own `git diff` re-derivation, build/
  typecheck/lint/format:check/test, the bundle-size gate re-check, your own independent pixel-level
  contrast measurement session (both modes), and your own greps (theme.css stale-value sweep,
  `dist/assets/theme.css` sweep, Astryx source + `src/` consumer sweep).
- Your own dark-mode and light-mode contrast numbers, with method stated, and an explicit
  confirmation of whether they match, closely approximate, or meaningfully diverge from the
  worker's claimed 4.818:1 / 6.895:1 — with your own explanation if they diverge.
- Confirmation the `--color-on-accent` astryx-api.md annotation is real/substantive, not just
  asserted to exist.
- D001-method forbidden-file check result.
- Scratch-file cleanup confirmation (your own `find`, not the worker's claim).
- Overall pass/fail verdict for T002b.
- Recommended next action (pass; rework; or dispute back to boss-arbiter if something doesn't add
  up — say which, and why).

Do not mark this task complete based on the worker's claimed-changes summary above — it is
unverified narration, not evidence. Do not flip `task-ledger.md` yourself — report your verdict
back; the orchestrating session updates the ledger. T002b stays "In Progress" until your verdict is
returned.

---
**ARCHIVED** 2026-07-19 — closed out as part of T002b PASS close-out.
