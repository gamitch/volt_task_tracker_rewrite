# Worker Packet: T003

## Task ID
T003

## Objective
Declare explicit CSS cascade layers (`@layer reset, astryx-base, app` — NFR-08) and wire the Astryx `/built` theme import + a prebuilt `theme.css` build pattern (DES-07), with zero runtime style injection.

## Allowed Files
- `src/theme/theme.css` (generated/authored build output)
- `src/main.tsx` (import statement only — do NOT restructure `App.tsx`, do NOT add routes/components/providers here; that is out of scope for this task)
- `vite.config.ts` (only if genuinely required to wire the build step — do not touch speculatively)

## Forbidden Files
- `docs/swarm/**`
- `.claude/**`
- `src/theme/volt.ts` — already verbatim-correct per DES-03/D001/D002. Do not touch, even if it seems related.
- `src/theme/astryx-augment.d.ts` — already correct. Do not touch.
- `src/App.tsx` — no restructuring, no route/component additions in this task.
- Anything outside the three Allowed Files above.

## Acceptance Criteria
- Explicit `@layer reset, astryx-base, app` declared (NFR-08); layer order matches NFR-08 exactly.
- Astryx `/built` theme import + prebuilt `theme.css` pattern wired per DES-07 — no runtime style injection (e.g. no CSS-in-JS injecting `<style>` tags at runtime for this layer).
- No unlayered global CSS anywhere in the app.
- Production build (`npm run build`) emits a static `theme.css` file.
- `src/main.tsx` changes are import-only.

## Relevant Constitution Excerpt
Item 8 (Stack locks): "Vite + React 19 + TypeScript strict + Supabase. No Tailwind, no shadcn, no alternate UI/CSS libraries → BLOCKER."

Item 11 (UI & quality): "UI is built from Astryx components; styling escalation order per PRD DES-21 (component → theme token → xstyle → custom CSS); ejecting component source needs boss approval."

Item 1 (Precedence): PRD requirement IDs (NFR-08, DES-07) outrank this packet's paraphrase — if this packet appears to conflict with the actual PRD text, follow the PRD and flag the discrepancy in your output.

Definition of Done: no worker may mark its own work complete; the checker inspects the actual artifact, not your summary.

## Most Recent Failure
None. First attempt on T003.

## Required Worker Output
- files changed (should be within the three Allowed Files only)
- summary of the layer structure authored and how the `theme.css` build step is wired
- `npm run build` output showing the generated `theme.css`
- grep output for `@layer` declarations across `src/`
- confirmation `src/main.tsx` changes are import-only and `App.tsx`/`volt.ts`/`astryx-augment.d.ts` were not touched
- known risks
- whether a dispute is needed
