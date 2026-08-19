# GAM-387 task packet — app-wide route error boundary

**Tier:** HEAVY (constitution item 26). **Gate:** `checker-premise` must return
DISPATCH before this reaches a worker (item 19).
**Issue:** <https://linear.app/gamitch/issue/GAM-387/the-app-has-no-error-boundary-anywhere-so-any-render-throw-including-a>
**Branch:** `claude/gam-387-error-boundary` (off `main` @ `debe8e4`)
**Worker model:** `worker-implementer` on its pinned default (sonnet). None of
item 18's four override triggers apply — no migration, no RLS or `security
definer`, no metric-view SQL, no auth/session/role-resolution change. The
boundary is mounted *inside* `AppRoutes` and does not alter `RequireAuth`/
`RequireRole` evaluation; see "Do not touch" below.

---

## 1. What the issue asks for

A render throw anywhere in the app must produce a visible, honest message with a
recovery action instead of a blank document, **without** replacing the whole
tree (nav must survive), and chunk-load failures must offer a real page reload
rather than a re-render that fails identically.

## 2. Premises the author re-measured against this tree (item 19c)

Every claim below was checked against the working tree at `debe8e4`, not taken
from the issue text.

| Claim | Status | Evidence |
| -- | -- | -- |
| No error boundary exists in production source | **CONFIRMED** | `grep -rniE "componentDidCatch\|getDerivedStateFromError\|ErrorBoundary\|ChunkLoadError" src/ package.json` returns **only test files**: `src/app/AppShell.test.tsx:371,378`, `src/app/SeasonProvider.test.tsx:206,208,223,225`, `src/pages/home/CoachHome.test.tsx:1300`, `src/pages/home/StudentHome.test.tsx:2028`. No production hit. |
| `react-error-boundary` is not a dependency | **CONFIRMED** | `package.json` `dependencies` are exactly `@astryxdesign/cli`, `@astryxdesign/core`, `@astryxdesign/theme-neutral`, `@supabase/supabase-js`, `qrcode.react`, `react`, `react-dom`, `react-router-dom`. |
| Routes are code-split with `React.lazy` | **CONFIRMED** | `src/app/router.tsx:120-140` — 14 `lazy()` calls. |
| One `<Suspense>` wraps `<Routes>`, nothing handles failure | **CONFIRMED** | `src/app/router.tsx:189` opens `<Suspense fallback={<RouteLoadingFallback />}>`, `:190` opens `<Routes>`, `:308-309` close both. |
| Issue's provider stack `BrowserRouter > AuthProvider > AppRoutes` | **PARTLY STALE — CORRECTED HERE** | Actual stack, `src/App.tsx:69-81`: `BrowserRouter` > `AuthProvider` > `ThemeModeProvider` > `LayerProvider` > `ThemedShell`/`Theme` > **`AppShell`** > `AppRoutes`. The issue omits four levels. This *helps* — see next row. |
| "Put the boundary inside the router at route level so the shell and navigation survive" is achievable | **CONFIRMED, and this is the load-bearing correction** | The nav chrome is `AppShell` (`src/App.tsx:74`), which wraps `<AppRoutes />` as its `children`. `AppShell.tsx` renders `TopNav`/`SideNav`/`MobileNav` as Astryx `AppShell` slots around `{children}`. So **any boundary placed inside `AppRoutes` leaves the whole nav chrome mounted**, exactly as the issue requires. No change to `App.tsx` is needed or wanted. |
| No `@testing-library/react` | **CONFIRMED** | Absent from `package.json` `devDependencies`. (A `node_modules` check would prove nothing here — `node_modules` was empty when this packet was written; the manifest is the evidence.) House harness is raw `createRoot` + `act` + `MemoryRouter`, with a `// @vitest-environment jsdom` pragma on line 1 (`src/app/AppShell.test.tsx:1,40-42`, `src/app/SeasonProvider.test.tsx:206-232`). |
| GAM-352 is the narrower duplicate | **CONFIRMED, with a residue** | GAM-352 is in **`Backlog`** (not `Todo`), severity MINOR, labels `provenance/e2e-personas`, `area/w1`, `tier/unreviewed`. Its blank screen comes from `src/pages/checkin/CheckinResult.tsx:773` reading `state.attendance.check_in_at` on an object the code cast unvalidated at `:343`. A route boundary converts that white screen into a fallback — it does **not** fix the unvalidated cast. See §7. |

### Premise finding the issue does not contain, and the worker must handle

**Four routes render chromeless — they have no nav for the boundary to
preserve.** `AppShell.tsx` returns `children` directly, skipping the Astryx
shell entirely, for `/login`, `/accept-invite`, `/kiosk/:sessionId`, and
`/meetings/live/:sessionId` (T134 `CHROMELESS_PATTERNS`, matched with
`matchPath`). On those four routes, acceptance criterion 2's "navigation is
still present" is **structurally unavailable** — there is no nav on those pages
even when nothing is wrong. Therefore **the fallback must itself carry a way
out**, not rely on surrounding nav. That is a requirement on the fallback's own
content, not an exception to criterion 2.

## 3. The design decision this packet is least sure of, stated up front

**An error boundary's caught state is sticky.** Once `getDerivedStateFromError`
sets an error, the boundary renders its fallback and keeps rendering it. If the
boundary wraps `<Routes>`, then after a catch the user clicking a nav link
changes the URL while the boundary keeps showing the fallback — criterion 2
("the user can reach another page without reloading") would **fail while every
test that only checks 'fallback text appears' still passes**. This is the exact
shape the issue warns about: a boundary that looks right and is worse than none.

So the boundary must **reset when the location changes**, and the reset must be
driven by something that actually re-renders on navigation. Note the hazard:
`AppRoutes` is an element created once in `App.tsx`, so a parent re-render does
**not** necessarily re-render it — `<Routes>` re-renders because it consumes
router context itself. A reset key computed by a component that does not
subscribe to location will never change. **The worker must subscribe to
location in whatever component computes the reset key** (i.e. call
`useLocation()` inside `AppRoutes` or a small wrapper inside it), and must
prove the reset with a test that navigates after a catch — not by reasoning.

## 4. Allowed Files

- `src/app/RouteErrorBoundary.tsx` — **new**, the boundary component.
- `src/app/RouteErrorBoundary.test.tsx` — **new**, its tests.
- `src/app/router.tsx` — wiring only (import, mount, and the reset key).

**Forbidden — do not create, edit, or stage anything else.** Explicitly:
`src/App.tsx`, `src/app/AppShell.tsx`, `src/app/guards.tsx`, any file under
`src/pages/**`, `package.json` (no new dependency — the boundary is ~60 lines of
React and the allowlist in constitution item 9 does not include
`react-error-boundary`), `vite.config.ts`, `.github/workflows/**`,
`docs/swarm/**`, `.claude/**`.

**`.github/workflows/**` is not in Allowed Files and this task needs no workflow
change** — checked at packet time per `AGENTS.md` § "Two walls a dispatched run
hits", not at push time.

## 5. Requirements

**R1 — Boundary component.** A class component in
`src/app/RouteErrorBoundary.tsx` using `getDerivedStateFromError` (and
`componentDidCatch` for a `console.error`). No new dependency.

**R2 — Mount point.** Inside `AppRoutes` in `src/app/router.tsx`, wrapping
`<Routes>`, **inside** the existing `<Suspense>` boundary or immediately outside
it — the worker chooses and states which, and why, in a module-doc comment
matching this file's existing commenting density. It must be inside `AppRoutes`
so `AppShell`'s chrome stays mounted. `App.tsx` is not edited.

**R3 — Reset on navigation.** The boundary clears its error state when the
location changes, so a caught error does not persist onto the next route. See
§3 for the re-render hazard.

**R4 — Chunk-load failures get a reload, not a retry.** Detect a chunk/dynamic
import failure and render a recovery action that calls `window.location.reload()`.
Detection must not be a single brittle string match: `ChunkLoadError` is Webpack's
name and **this project is Vite**, whose dynamic-import failures surface as a
`TypeError` with a message like `Failed to fetch dynamically imported module`.
Match on a small set — `error.name === 'ChunkLoadError'`, or `/dynamically
imported module|Importing a module script failed|Loading chunk/i` against the
message — and treat everything else as a generic error. Both branches must be
tested.

**R5 — Honest fallback copy.** PRD DES-14…16 sentence case. The fallback must
**not** claim anything about whether the user's data was saved or lost, because
the boundary cannot know. It says what happened and offers the action. No
stack traces or error messages shown to the user (they may quote data; item 6
forbids PII on user surfaces, and a raw message is not useful to this audience).

**R6 — Built from Astryx components** per constitution item 11 and PRD DES-19.
Props come only from `docs/swarm/astryx-api.md` (item 2) — a prop absent from
that file is presumed hallucinated. Read that file for the components you use;
do not guess prop names from other libraries.

**R7 — Accessible.** The fallback is real content a user lands on after a
failure, so it needs an accessible name and a keyboard-reachable recovery
control (PRD DES-17 / NFR-07, constitution item 15).

## 6. Acceptance criteria — each measurable today, with its mutation

The mutations are how the worker proves the tests guard the behaviour rather
than merely passing. Run each mutation, capture the **real red output**, revert,
re-run green. **Commit before mutating** (item 26's fast-tier working rule,
which applies to any mutation: `git checkout --` after an uncommitted fix
reverts the fix too).

| # | Criterion | Mutation that must turn it red |
| -- | -- | -- |
| AC1 | A child that throws during render produces visible fallback text, not an empty container. | Remove the boundary from `router.tsx` (or make `getDerivedStateFromError` return no error) → the assertion on fallback text goes red. |
| AC2 | **Nav survives, and navigation recovers.** With the boundary mounted inside a router + `AppShell`-equivalent tree: after a route throws, the surrounding chrome is still in the DOM, **and** navigating to a different path renders that route's content rather than the fallback. | Delete the reset-on-location logic → the "navigate after error renders the new route" assertion goes red **while AC1 still passes**. This pairing is the point: it is what distinguishes a working boundary from a sticky one. |
| AC3 | A simulated dynamic-import rejection renders the reload action; a generic error does not. | Invert the chunk-error predicate → the generic case starts offering reload and the chunk case stops, both red. |
| AC4 | The fallback text makes no claim about saved or lost data. | Assert the rendered fallback text does not match `/saved\|lost\|your changes/i`; adding such a claim to the copy turns it red. |
| AC5 | `src/app/router.tsx`'s existing behaviour is unchanged — all 14 routes still resolve and the `Suspense` loading fallback still appears. | Covered by the existing suite; see AC6. |
| AC6 | **The full suite is green and no existing test was edited or deleted.** | `npm run test` — **measured baseline on this branch: 98 files / 2505 tests, all passing** (`npm ci` first; `node_modules` starts empty on a fresh container). Both counts must go **up**, never down, and no pre-existing test may change. Constitution non-negotiable: "Existing tests must pass unless the boss explicitly approves a test update." |

**Test harness:** raw `createRoot` + `act` + `MemoryRouter`, with
`// @vitest-environment jsdom` as line 1. Follow
`src/app/SeasonProvider.test.tsx:200-232` and `src/app/AppShell.test.tsx` for
the exact house pattern. **Do not add `@testing-library/react`** — it is not
installed and adding a dependency is out of scope (item 9).

**Console noise:** React logs caught errors via `console.error`. If a test's
expected error output pollutes the run, silence it narrowly with a scoped
`vi.spyOn(console, 'error')` restored in the same test — never globally.

## 7. GAM-352 (acceptance criterion 5 of the issue)

**Do not edit `CheckinResult.tsx` and do not touch GAM-352.** The worker's scope
ends at the boundary. The orchestrator will comment on GAM-352 recording that
this work covers its *symptom* (the blank page) and that its remaining, distinct
defect is the unvalidated cast at `CheckinResult.tsx:343` feeding
`state.attendance.check_in_at` at `:773` — i.e. GAM-352 is re-scoped to payload
validation, not closed. GAM-352 is in `Backlog`, so it is not dispatchable and
must not be claimed here (item 28a).

## 8. Least confident decisions (item 19d) — attack these first

1. **That resetting on `location.pathname` is the right reset key, and that the
   component computing it actually re-renders on navigation.** Wrong if
   `AppRoutes` does not re-subscribe to router context where the key is computed
   (see §3), or if resetting on pathname alone misses a same-path-different-search
   navigation, or — the opposite failure — if it resets so eagerly that a route
   which throws immediately on mount produces an infinite catch/reset loop. The
   worker must demonstrate the reset with a navigation test, and must think about
   the immediate-rethrow case.
2. **That the boundary belongs inside `AppRoutes` wrapping `<Routes>`, rather
   than inside each `<Route element>`.** Wrong if wrapping `<Routes>` also
   swallows router-level errors in a way that breaks guard redirects, or if
   per-route placement is needed to keep an error on one route from affecting
   another. Chosen because it is one mount point instead of 14 and because the
   nav chrome lives above it either way — but it is a real trade and the
   per-route alternative resets naturally on navigation without a key.
3. **That `Failed to fetch dynamically imported module` is what Vite actually
   throws here.** This is inferred from Vite's known behaviour, **not observed on
   this deployment** — the issue's own Verification note already concedes no
   chunk failure has been seen in production. Wrong if this Vite/React version
   surfaces it differently, in which case R4's predicate matches nothing and the
   reload branch is dead code that tests only because the test throws a
   hand-made error. The gate should say whether that test is honest evidence or
   circular.
4. **That the boundary must not be placed at the `App.tsx` level at all.** The
   issue states a single whole-app boundary "may be worse than nothing." Wrong if
   an error thrown by `AppShell`, `SeasonProvider`, `KpiStrip` or `TopNav` —
   all of which are *outside* `AppRoutes` — then still blanks the screen with no
   boundary anywhere above them. **This is a genuine coverage gap in the chosen
   design and the packet is deliberately accepting it**; the gate should rule on
   whether accepting it is correct or whether a second outer boundary is
   required. If accepted, it becomes an item 20 follow-up row, not a silent
   omission.
5. **That no new dependency is justified.** Wrong if a correct boundary with
   reset semantics is materially harder to get right by hand than the
   ~60 lines assumed, in which case `react-error-boundary` would need
   boss-architect approval under item 9. Chosen against because the allowlist is
   explicit and the component is small.
