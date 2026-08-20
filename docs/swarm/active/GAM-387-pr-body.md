Closes GAM-387

## What changed

`src/app/RouteErrorBoundary.tsx` (new) is a class error boundary plus a small
`useLocation()` wrapper that keys it on `pathname + search`, mounted in
`src/app/router.tsx` around the existing `<Suspense>`/`<Routes>` tree. A render
throw in routed page content now shows a fallback with a way out instead of a
blank document, the app chrome stays mounted, and navigating away clears the
error. A failed dynamic import gets a **reload** action rather than a retry,
because a retry provably cannot work — React's lazy payload sets `_status = 2`
on rejection and never resets it, so a full unmount and remount does not
re-invoke the import (measured: 1 call across both).

Three files, no new dependency: the boundary, its tests, and the router wiring.

## What the issue got wrong

- **The provider stack.** GAM-387 describes it as `BrowserRouter > AuthProvider
  > AppRoutes`. It is `BrowserRouter > AuthProvider > ThemeModeProvider >
  LayerProvider > ThemedShell > AppShell > AppRoutes` (`src/App.tsx:69-81`).
  This helped: the nav chrome already sits *above* `AppRoutes`, so the issue's
  "put it at route level so the shell survives" prescription needed no
  `App.tsx` edit at all.
- **Four routes have no nav to preserve.** `/login`, `/accept-invite`,
  `/kiosk/:sessionId` and `/meetings/live/:sessionId` render chromeless
  (`AppShell.tsx:137-142`), so acceptance criterion 2's "navigation is still
  present" is structurally unavailable there. The fallback therefore carries its
  own recovery link rather than relying on surrounding nav.
- **`ChunkLoadError` is Webpack's name; this project is Vite.** The predicate
  also matches Vite's own `Unable to preload CSS for …`
  (`node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js:64843`), which neither
  `ChunkLoadError` nor the browser message strings catch.

## Tier: HEAVY — stated and defended (item 26)

**None of item 26's named HEAVY triggers apply.** No write path, no destructive
operation, no RLS/auth/role logic, no migration or metric-view SQL, no export
another session builds against. HEAVY was taken under the "if two tiers are
arguable, take the heavier one" clause, on three grounds:

1. The issue's central structural premise — that a route-level boundary keeps
   nav alive — was unverified, and its failure mode is a fix that looks green
   while the criterion it exists for is unmet.
2. Acceptance criterion 4 is an honesty-about-the-user's-own-data requirement,
   which is item 26's "lie to a user about their own data".
3. A boundary that catches too broadly is worse than none, so the tests needed a
   separate checker rather than the author's say-so.

**The losing argument was STANDARD** — single-module, no write path, and item 26
explicitly rules out both blast radius and file count as triggers, which were
therefore *not* used as reasons. What tipped it was item 19b's "novel pattern"
trigger: this pattern existed nowhere in the codebase.

**The tier paid for itself, which is the part worth recording.** The premise
gate ran experiments rather than reading, and round 1 returned REVISE with four
MAJORs. Two of them were defects a STANDARD path would have shipped:

- **AC2's mutation was a no-op as written.** The packet let the reset key live
  in `router.tsx` while the tests build their own tree — so deleting the reset
  logic would have left every test green. The pairing that distinguishes a
  working boundary from a sticky one did not exist until round 1 found this.
- **A `pathname`-only key passes the criterion while stranding a user.**
  Measured: `/checkin?s=1&t=A → ?t=B` never resets, and
  `CheckinResult.tsx:359-361,607` drives that page entirely from search params.
  A student whose first scan crashed would have been stuck on the fallback for
  every rescan — on the very page GAM-352 reports.

Round 2 then found that **no acceptance criterion proved the boundary was
mounted at all**: nothing in this repo mounts `AppRoutes`, so a flawless
component with no wiring would have passed everything. That became AC1b.

## Verification

```
GATE RUN — 40d10b7 on claude/gam-387-error-boundary — tree clean

  1 tsc                                         exit 0  PASS
  2 vite build                                  exit 0  PASS
  3 format:check                                exit 0  PASS
  4 eslint                                      exit 0  PASS       0 errors, 379 warnings
  5 vitest (full)                               exit 0  PASS       99 files / 2514 tests  baseline 2505 (+9)
  6 vitest src/app/RouteErrorBoundary.test.tsx  exit 0  PASS       1 files / 9 tests  baseline 9 (+0)

VERDICT: PASS — all six gates exit 0
```

Baseline 2505 measured on this branch before the change. The checker ran the
gates independently and reported the same figures.

### Mutations — every criterion turned red, then reverted

| AC | Mutation | Red result |
| -- | -- | -- |
| AC1 | `getDerivedStateFromError` returns no error | uncaught throw, fallback never rendered |
| AC1b | remove the wrapper from `router.tsx` | only AC1b red — proves the mount, not just the component |
| AC2a | delete the reset key | red **while AC1 stays green** |
| AC2b | reduce key to `pathname` only | **only AC2b red, AC2a green** — the pairing the gate existed for |
| AC3 | invert the chunk predicate | both directions red |
| AC4 | add "Your changes were saved." | `not to match /saved\|lost\|your changes/i` |
| AC4b | add an apology | `not to match /sorry\|oops/i` |
| AC5 | change the `Loading page…` label | `expected 'Please wait…' to contain 'Loading page…'` |

AC2a and AC2b were replayed independently by the checker in its own worktree and
produced the same one-red/one-green split.

**AC3 is not circular.** It drives a real
`lazy(() => Promise.reject(…))` through a real `<Suspense>` in the production
nesting; only the rejection *value* is authored, which jsdom makes unavoidable.

## Scope — Passed, not Partial (item 27)

The fallback renders real caught errors on the real user path. Verified against
the **real** `AppShell` with the real `SeasonProvider`/`KpiStrip`/`TopNav`
executing, and against the **real** `AppRoutes` route table — no fixture, no
stub, no hand-built stand-in.

## Follow-ups filed

- **GAM-422** (`Backlog`, `unreviewed`) — a throw in the app chrome still blanks
  the screen. See the disclosed gap below.

## Known gaps, disclosed

**This closes GAM-387 for routed page content only.** Throws from `AppShell`,
`SeasonProvider`, `TopNav`/`SideNav`/`MobileNav` and `KpiStrip` mount *above*
`AppRoutes` and are **not** caught — they still produce the blank page GAM-387
describes. `KpiStrip` runs a Supabase loader on every chrome-bearing route
(`AppShell.tsx:165`), so this is a live gap, not a theoretical one. Catching it
requires editing `src/App.tsx`, which this task deliberately froze so the
boundary could sit low enough to keep nav alive. **GAM-422** owns that half.

The premise gate ruled item 27 does not apply to this gap — the delivered
surface is real and usable — but the narrowing is stated here and on the Linear
row, because the owner reads the row.

**Not observed in production:** no chunk-load failure has been seen on this
deployment. The absence of the boundary was measured; the frequency of the
trigger was not. The three browser message strings in the predicate are
browser-authored and unverifiable from this tree — only the mechanism and Vite's
own `Unable to preload CSS` string are sourced from the installed package.

**`vite:preloadError` was not wired.** Vite dispatches it before rethrowing, and
it would be immune to browser message drift — but a jsdom lazy rejection never
routes through `__vitePreload`, so it would have shipped untested. The string
predicate alone is what ships.

## GAM-352

`Ignore GAM-352`

This work covers GAM-352's *symptom* — the blank page on `/checkin` — but not
its cause. The unvalidated cast at `CheckinResult.tsx:343`, feeding
`state.attendance.check_in_at` at `:773`, is untouched and that row stays open,
re-scoped to payload validation. Ignored here so merging this PR does not close
a row whose actual defect is still present.

Linear-Issue: GAM-387
