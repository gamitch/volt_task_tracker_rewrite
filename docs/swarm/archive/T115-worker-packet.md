# Worker Packet: T115

## Task ID
T115 — PRD v2 SCH-02: TopNav shows the real active season (kills the
"placeholder active season" label George sees on every page).

## Objective
`src/components/nav/TopNav.tsx` still renders hardcoded
`PLACEHOLDER_SEASON_OPTIONS` ("2025-2026 Season (placeholder active season)").
Per D-2 (single combined season, decided by George), the control becomes a
display of the one real active season resolved via the app's existing
`useActiveSeason()` seam. UI-only task; no schema work exists for seasons
anymore (PRD v2 §3 SCH-02).

## Allowed Files
- `src/components/nav/TopNav.tsx`, `TopNav.test.tsx`
- `src/app/AppShell.tsx`, `AppShell.test.tsx` — **conditionally**: ONLY if your
  Trap #1 investigation proves `TopNav` currently mounts outside
  `SeasonProvider`'s subtree and a provider hoist is genuinely required. If you
  touch them, the diff must be limited to the provider-mount move + its test
  fallout, nothing else.

## Forbidden Files
- `src/app/SeasonProvider.tsx`, `src/lib/supabase/loaders/seasons.ts` —
  already correct (T091), read-only imports.
- `src/pages/settings/SeasonSettings.tsx` — season creation/activation lives
  there; unchanged.
- Everything else. `router.tsx`, `guards.tsx`, `docs/swarm/**`, `.claude/**`.

## Known Context / Traps

**1. Provider position — investigate before writing.** `SeasonProvider` is
mounted in `AppShell.tsx` "wrapping only the normal branch" (T091's own design
note, quoted in `SeasonProvider.tsx`'s module doc — read it). Determine
whether `TopNav` renders inside or outside that subtree. If inside: just call
`useActiveSeason()` in TopNav. If outside: hoist the provider mount in
`AppShell.tsx` so the whole chrome (TopNav included) is covered — verify the
hoist doesn't change behavior for the chromeless routes (`AppShell`'s module
doc documents which routes render without chrome) and doesn't double-mount.
Document what you found either way.

**2. D-2 semantics — display, not a multi-season switcher.** One combined
season is the model ("2026-27"). Render the real active season's `name`.
States, all honest (DES-12): loading → skeleton/muted placeholder sized like
the control; no active season → muted "No active season" (never a fabricated
year); error → same treatment as `ReportsShell`'s season-state precedent
scaled to a nav control (compact, non-blocking — the nav must not explode the
page). Historical-season switching is explicitly deferred (cite PRD §8
simplicity + D-2 in your module-doc update); if the current `Selector`
component demands ≥2 options to render sensibly, a non-interactive labeled
display is acceptable and arguably more honest than a one-option dropdown —
investigate what Astryx offers (`docs/swarm/astryx-api.md`, constitution item
2 prop-verification discipline applies) and choose, documenting why.

**3. Role visibility unchanged.** The control remains visible only for
admin/coach (`isSeasonSelectorVisible` logic stays).

**4. Tests.** Follow `ReportsShell.test.tsx`'s established `useActiveSeason`
harness pattern (real `SeasonProvider` with injected `loadActiveSeason`, or
the file's existing mock precedent — read it): ready state shows the real
season name and never the placeholder string (assert the old literal is
absent), loading/none/error states render their honest variants, role gating
preserved. Grep the repo for any other consumer of the removed
`PLACEHOLDER_SEASON_OPTIONS`/`PLACEHOLDER_ACTIVE_SEASON` exports before
deleting them.

## Acceptance Criteria
- Signed-in admin/coach sees the real active season name in the nav; the
  placeholder literal is gone from the runtime path.
- Honest loading/none/error states; role gating unchanged; chromeless routes
  unaffected (if AppShell was touched).
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`,
  `npm run format:check` all clean, zero regressions.

## Relevant Constitution Excerpts
> Astryx-only UI; verify props against the API doc, never guess. No worker
> self-certifies.

## Most Recent Failure
None. Attempt 1 (attempt count: 0).

## Required Worker Output
- Full diff; your Trap #1 provider-position finding; your Trap #2
  control-choice reasoning.
- Full gate output. Known risks; dispute flag if needed.
