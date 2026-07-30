# Worker Packet: T002

## Task ID
T002

## Objective
Install `@astryxdesign/core`, `@astryxdesign/theme-neutral`, and `@astryxdesign/cli` (latest resolvable versions); add the `astryx` npm script (DES-18); create `src/theme/volt.ts` that reproduces the DES-03 code block below exactly.

## Allowed Files
- `package.json`
- `package-lock.json` (will update automatically from `npm install`)
- `src/theme/volt.ts`
- `src/theme/astryx-augment.d.ts` (new file, type augmentation only — added attempt 2, scope correction; same precedent as D001 approving index.html/package-lock.json as necessary build infrastructure)

## Forbidden Files
- `docs/swarm/**`
- `.claude/**`
- Any file outside the Allowed Files list above (includes `src/main.tsx`, `src/App.tsx`, `tsconfig*.json`, `vite.config.ts`, `.eslintrc*`, `.prettierrc*` — do not touch, T001 already passed on these)

## Steps
1. `npm install @astryxdesign/core@latest @astryxdesign/theme-neutral@latest @astryxdesign/cli@latest` — do not hardcode a version number; use whatever resolves as `latest` at install time.
2. Add this exact npm script to `package.json` (DES-18):
   ```json
   "astryx": "node node_modules/@astryxdesign/cli/bin/astryx.mjs"
   ```
3. Create `src/theme/volt.ts` with **exactly** this content (PRD Section 5.2, DES-03 — verbatim, no paraphrasing, no reordering, no added/removed fields):

```tsx
import {defineTheme} from '@astryxdesign/core/theme';
import {neutralTheme} from '@astryxdesign/theme-neutral';

export const voltTheme = defineTheme({
  name: 'volt',
  extends: neutralTheme,
  color: {accent: '#5B2EE5', neutralStyle: 'cool'},
  typography: {
    heading: {
      family: 'Space Grotesk',
      url: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&display=swap',
      fallbacks: 'system-ui, sans-serif',
    },
    body: {
      family: 'Inter',
      url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap',
      fallbacks: '-apple-system, sans-serif',
    },
  },
  radius: {base: 6, multiplier: 1},
  tokens: {
    // [light, dark]
    '--color-accent': ['#5B2EE5', '#9B7BFF'],
  },
});
```

4. Verify `npm run astryx -- component --list` runs without error (this is a discovery/cross-check command, DES-20 — it does not replace `astryx-api.md` as a source of truth).
5. Check WCAG AA contrast for accent-on-surface in both light mode (`#5B2EE5` accent) and dark mode (`#9B7BFF` accent) per DES-06. Report the actual contrast ratios computed against the theme's light/dark surface tokens.

## Acceptance Criteria
- `src/theme/volt.ts` matches the DES-03 code block verbatim: accent hex `#5B2EE5`/`#9B7BFF`, `neutralStyle: 'cool'`, heading font `Space Grotesk` with the exact Google Fonts URL above, body font `Inter` with the exact Google Fonts URL above, `radius: {base: 6, multiplier: 1}`, and the `tokens` object with `'--color-accent': ['#5B2EE5', '#9B7BFF']` in that order.
- `package.json` has the `astryx` script exactly as specified in DES-18.
- `npm run astryx -- component --list` runs successfully (exit 0).
- Both light and dark mode accent-on-surface combinations pass WCAG AA contrast (DES-06).
- Do not invent, add, or omit any Astryx theme-authoring API (e.g. `defineTheme`, `color`, `typography`, `radius`, `tokens` field names) beyond what's in the DES-03 block above — see constitution item 2 below. `docs/swarm/astryx-api.md` is a component-prop reference only and does not cover theme-authoring APIs, so it is not a valid source to consult or deviate toward for this task.

## Relevant Constitution Excerpt
Item 2 (Authority & sources of truth): "Astryx component props come only from `docs/swarm/astryx-api.md` (PRD DES-19). A prop absent from that file is presumed hallucinated → MAJOR. The CLI (`npm run astryx -- component <Name>`) is a cross-check, not a source." For this task, the theme-authoring shape itself is not sourced from `astryx-api.md` (it doesn't cover theming) — it is sourced from the exact PRD 5.2 / DES-03 code block reproduced above, verbatim. Do not modify, "improve," or extend that code block.

Item 9 (Stack locks): dependency allowlist includes `@astryxdesign/*` — these installs are pre-approved, no additional sign-off needed.

Workers may implement tasks, but they may not redefine success. Workers may not edit `docs/swarm/**` or `.claude/**`.

## Most Recent Failure
Attempt 1 FAILed on checker-accessibility: `volt.ts` verbatim vs DES-03 and confirmed correct, but `npx tsc --noEmit`/`npm run build` fail with TS2353 (`'url' does not exist in type 'TypographyRole'`) — a confirmed upstream `@astryxdesign/core@0.1.6` defect, not a worker error. Full detail, exact error text, root cause, and required fix (add `src/theme/astryx-augment.d.ts`; do not touch `volt.ts`) are in `docs/swarm/archive/T002-latest-failure.md` — read that file before starting attempt 2.

## Required Worker Output
- files changed (diff of `package.json`, new `src/theme/volt.ts`)
- exact installed versions of `@astryxdesign/core`, `@astryxdesign/theme-neutral`, `@astryxdesign/cli`
- `npm run astryx -- component --list` output/log
- contrast-check output for both light and dark accent-on-surface
- commands run
- known risks
- whether a dispute is needed

---
Archived 2026-07-16 after T002 Passed checker-accessibility (attempt 2). See `docs/swarm/verification-log.md` for the PASS entry and `docs/swarm/task-ledger.md` for the closed-out ledger row.
