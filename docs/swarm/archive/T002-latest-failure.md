# T002 — Most Recent Failure (attempt 1, checker-accessibility)

## Verdict
FAIL — build/typecheck blocked. Not a worker competence issue: `volt.ts` is byte-for-byte verbatim vs DES-03, the `astryx` npm script and CLI cross-check are correct, both light/dark accent-on-surface contrast ratios were independently recomputed and pass WCAG AA (7.08:1 light, 4.81:1 dark), and no forbidden-file violations were found.

## Exact failure

```
npx tsc --noEmit -p tsconfig.json

src/theme/volt.ts:11:5 - error TS2353: Object literal may only specify known
properties, and 'url' does not exist in type 'TypographyRole'.

11     url: 'https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&display=swap',
       ~~~

src/theme/volt.ts:16:5 - error TS2353: Object literal may only specify known
properties, and 'url' does not exist in type 'TypographyRole'.

16     url: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap',
       ~~~

Found 2 errors.
```

`npm run build` fails for the same reason (it runs `tsc` as part of the build step).

## Root cause (confirmed)

Upstream package defect in `@astryxdesign/core@0.1.6`, not a worker error and not a spec error.

- `node_modules/@astryxdesign/core/src/theme/types.ts` — `TypographyConfig.heading` JSDoc (line 76): "Heading font configuration. Inherits family/fallbacks/**url** from body if omitted." — the package's own docs promise a `url` field.
- Same file, `TypographyRole` interface (lines 40–49) declares only `family?`, `fallbacks?`, `weight?`, `weights?` — **no `url` field exists**. The JSDoc and the type are out of sync inside the package itself.
- Public export path confirmed via `node_modules/@astryxdesign/core/package.json` `exports["./theme"]` → `src/theme/index.ts` (types: `dist/theme/index.d.ts`), which is exactly the module volt.ts imports from (`import {defineTheme} from '@astryxdesign/core/theme'`). `src/theme/index.ts` re-exports `TypographyRole` (confirmed at line 159), so this is the correct, real public path to augment — not a made-up one.

## Required fix

1. **Do not modify `src/theme/volt.ts` in any way.** It must stay verbatim per DES-03 / constitution item 3. Routing around the upstream gap by editing volt.ts (e.g. dropping `url`, casting, `as any`) is itself a checker BLOCKER.
2. Add a new file `src/theme/astryx-augment.d.ts` containing a TypeScript module augmentation that adds the optional `url` field to `TypographyRole` on the real module path:

```ts
declare module '@astryxdesign/core/theme' {
  interface TypographyRole {
    url?: string;
  }
}
```

   This path (`@astryxdesign/core/theme`) has been verified against the package's actual `exports` map and matches the import path already used in `volt.ts` — do not substitute a different path (e.g. a deep `dist/theme/types` path) without re-confirming against `node_modules/@astryxdesign/core/package.json`.
3. Ensure this `.d.ts` file is picked up by the TS project (it will be automatically included if it sits under `src/` and `tsconfig.json`'s `include` covers `src/**/*`, which T001 already set up — no `tsconfig.json` edit should be necessary; if one turns out to be needed, flag it rather than editing `tsconfig.json` directly, since that file is outside T002's allowed scope).

## Verification commands to re-run before resubmitting

```
npx tsc --noEmit -p tsconfig.json
npm run build
```

Both must exit 0. Also re-run the original T002 evidence set (astryx CLI list command, contrast check) only if `astryx-augment.d.ts` is the only change — those already passed and do not need to be redone unless something else changed.

## Not blocking this task (tracked separately)

React 18 vs `@astryxdesign/core`'s `react>=19.0.0` peer-dependency conflict is real (confirmed via `npm ls` ELSPROBLEMS/invalid markers) but install works via `--legacy-peer-deps` and there is no proven runtime failure. This is logged as a risk in `docs/swarm/state-summary.md` under Current Risks, not as a T002 blocker — do not attempt to fix it as part of this rework.

---
Archived 2026-07-16. Attempt 2 (adding `src/theme/astryx-augment.d.ts` with a leading `export {}`) resolved this failure and Passed checker-accessibility. See `docs/swarm/verification-log.md` for the PASS entry.
