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

## 1. What the issue asks for, and what this packet actually delivers

The issue asks that a render throw *anywhere* in the app produce a visible,
honest message with a recovery action instead of a blank document, **without**
replacing the whole tree (nav must survive), and that chunk-load failures offer
a real page reload rather than a re-render that fails identically.

**Scope delivered here, stated honestly because round 1 caught the packet
claiming more than it ships:** a render throw **in routed page content**
produces that message. Throws from the app chrome — `AppShell`,
`SeasonProvider`, `TopNav`/`SideNav`/`MobileNav`, and `KpiStrip`, all of which
mount *above* `AppRoutes` — are **not** covered, because catching them requires
editing `src/App.tsx`, which this packet freezes. `KpiStrip` in particular
mounts on **every** chrome-bearing route (`src/app/AppShell.tsx:165`), so this
is a live gap and not a theoretical one.

That deferral is filed, not promised: **GAM-422**
(<https://linear.app/gamitch/issue/GAM-422/a-throw-in-the-app-chrome-topnav-sidenav-kpistrip-or-seasonprovider>),
in `Backlog`, under item 20. No acceptance criterion below claims chrome
coverage, and the PR body must say so rather than implying the issue is
closed whole.

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

## 3. The mechanism — now measured, not assumed

Round 1 of the premise gate ran this in its own worktree rather than reasoning
about it. Take the following as established; do not re-derive it.

**An error boundary's caught state is sticky.** Once `getDerivedStateFromError`
sets an error, the boundary renders its fallback and keeps rendering it.
Measured: after a catch, navigating updated the surrounding chrome to the new
path while the fallback stayed mounted and the new route's element never
rendered at all. So a boundary wrapping `<Routes>` with no reset **fails
criterion 2 while every test that only checks "fallback text appears" passes** —
the exact shape the issue warns about.

**The reset must be driven by a component that subscribes to router context.**
Measured: a component whose element is created once (as `<AppRoutes />` is, in
`src/App.tsx:75`) and which does **not** call `useLocation()` rendered exactly
once across a navigation — React bails out because `oldProps === newProps` on
the stable element. A component that *does* call `useLocation()` re-rendered and
its derived key changed. **`AppShell`'s own `useLocation()` (`AppShell.tsx:149`)
does not rescue `AppRoutes`** — the bailout happens below it.

**There is no infinite-reset-loop hazard.** An earlier draft of this packet
warned about one. Measured false: a route that throws immediately on mount
produced one catch and a stable fallback in 2 ms, because a location-derived key
changes once per navigation and cannot self-drive. Only a key that changes on
*every render* could loop. The warning is removed so the worker does not chase
a phantom.

**`pathname` alone is the wrong key, measured.** With `key={location.pathname}`,
criterion 2 passes while `/checkin?s=1&t=A` → `/checkin?s=1&t=B` never resets.
`src/pages/checkin/CheckinResult.tsx:359-361,607` reads `s`, `t` and `code`
entirely from search params on a single pathname — that is GAM-352's own page.
A student whose first scan crashes would be stranded on the fallback for every
subsequent scan. See R3.

**A retry cannot work for a failed chunk, measured.** React's lazy payload sets
`_status = 2` on rejection and never resets it, so a full unmount and remount
does not re-invoke the import function (measured: 1 call across both). Reload
really is the only recovery, which is why R4 is not optional politeness.

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
matching this file's existing commenting density. (Both placements were measured
to catch a `lazy()` rejection, so this choice is safe on that axis.) It must be
inside `AppRoutes` so `AppShell`'s chrome stays mounted.

**`src/app/router.tsx` receives an import and a mount, and nothing else.**
No `useLocation()` call, no key computation, no error logic. `App.tsx` is not
edited. Round 1 rejected the earlier wording that let the reset key live here:
if the key is in `router.tsx` while the tests build their own `MemoryRouter`
tree in `RouteErrorBoundary.test.tsx`, then deleting the reset logic leaves
every test green and AC2's mutation becomes a no-op — destroying the one pairing
that distinguishes a working boundary from a sticky one.

**R3 — Reset on navigation, keyed on path *and* search, implemented inside the
boundary module.** `src/app/RouteErrorBoundary.tsx` exports a small function
wrapper that calls `useLocation()` and renders the class boundary with
`` key={`${location.pathname}${location.search}`} `` (`location.key` is an
acceptable alternative — state which and why). The class component itself stays
hook-free.

The key **must** include `search`. Measured in round 1: a `pathname`-only key
passes criterion 2 as written while leaving `/checkin?s=1&t=A → ?t=B`
permanently stuck, and `src/pages/checkin/CheckinResult.tsx:359-361,607` drives
that page entirely from search params on one pathname. That is precisely
GAM-352's page — the motivating case in §7 — so a pathname-only key would strand
a student on the fallback for every rescan.

Putting the wrapper in `RouteErrorBoundary.tsx` also puts AC2's mutation target
inside the unit under test, which is what makes AC2 real.

**R4 — Chunk-load failures get a reload, not a retry.** Detect a
chunk/dynamic-import failure and render a recovery action that calls
`window.location.reload()`. Everything else gets the generic fallback. Both
branches must be tested.

*The strings below are sourced from the installed Vite, not invented.* Vite's
`preload()` helper rethrows the **browser's own** error unchanged
(`node_modules/vite/dist/node/chunks/dep-BK3b2jBa.js:64858-64866`), so the
message is browser-dependent — Chrome `Failed to fetch dynamically imported
module`, Firefox `error loading dynamically imported module`, Safari `Importing
a module script failed`. **But the same helper also authors its own error** at
`:64844`: `new Error("Unable to preload CSS for " + dep)`, which matches neither
those strings nor `ChunkLoadError`. So the predicate is:

- `error.name === 'ChunkLoadError'` (Webpack's name — this project is Vite, but
  it costs nothing and is the name most code checks), **or**
- `/dynamically imported module|Importing a module script failed|unable to preload|Loading chunk/i`
  against the message.

**Preferred, and worth the extra few lines:** Vite dispatches a cancelable
`vite:preloadError` event on `window` before rethrowing
(`dep-BK3b2jBa.js:64849-64857`), with the real error on `e.payload`. That is a
first-party signal immune to browser message drift. Use it as the primary
detector if the worker can do so cleanly, keeping the string predicate as the
fallback; if not, the string predicate alone is acceptable. State which was
done and why.

**R5 — Honest fallback copy.** PRD DES-14 (sentence case) and DES-16 (say what
happened and what to do; no apologies, no "Oops"). The fallback must **not**
claim anything about whether the user's data was saved or lost, because the
boundary cannot know.

Do not render raw error text or stack traces to the user — on **usability**
grounds (DES-16: the message must tell this audience what to do, and a
`TypeError` does not). *Round 1 corrected an earlier miscitation here:*
constitution item 6 forbids PII in logs, URLs, analytics, commit messages and
test fixtures — **not** on user surfaces. Where item 6 genuinely bites is R1's
`componentDidCatch` logging, not the copy.

**R1 logging is optional.** React 19 already `console.error`s every caught
error, so an additional log is duplicative. If the worker adds one, it logs the
error only — never route params, search params, or user data.

**R6 — Built from Astryx components** per constitution item 11 and PRD DES-19.
Props come only from `docs/swarm/astryx-api.md` (item 2) — a prop absent from
that file is presumed hallucinated. Round 1 confirmed the needed components are
documented today: `EmptyState` (`astryx-api.md:3997-4007` — `title`,
`description`, `actions`, `headingLevel`), `Banner` (`:2755-2769` — `status`,
`title`, `description`, `endContent`, `container`), `Button` (`:1809-1827` —
`label`, `variant`, `onClick`) and `Link` (`:1910`).

**Start from the existing precedent rather than composing from scratch:**
`src/pages/no-access/AccessDeniedPage.tsx:84-104` is already this exact shape —
`Center` > `VStack` > `Heading level={1}` > `Card` > `EmptyState` with a
`<Link as={RouterLink} …>` action — and it is already passed work. Follow it.

**R7 — Accessible.** The fallback is real content a user lands on after a
failure, so it needs an accessible name and a keyboard-reachable recovery
control (PRD DES-17 / NFR-07, constitution item 15). Round 1 verified against
the installed source that these come for free from the primitives: `Banner`
renders `role="alert"` when `status="error"` (`Banner.tsx:341,426`) and
`EmptyState` renders `role="status"` with its title as a real heading
(`EmptyState.tsx:123,157`). A native `<button>`/`<a>` is keyboard-reachable by
construction — do not add `tabIndex` or key handlers.

## 6. Acceptance criteria — each measurable today, with its mutation

The mutations are how the worker proves the tests guard the behaviour rather
than merely passing. Run each mutation, capture the **real red output**, revert,
re-run green. **Commit before mutating** (item 26's fast-tier working rule,
which applies to any mutation: `git checkout --` after an uncommitted fix
reverts the fix too).

| # | Criterion | Mutation that must turn it red |
| -- | -- | -- |
| AC1 | A child that throws during render produces visible fallback text, not an empty container, **and the surrounding chrome is still in the DOM**. | Make `getDerivedStateFromError` return no error → the assertion on fallback text goes red. |
| AC2a | **Navigation recovers.** After a route throws, navigating to a *different path* renders that route's content rather than the fallback. | Delete the reset-on-location logic in `RouteErrorBoundary.tsx` → red **while AC1 still passes**. This pairing is the point, and it only works because R3 puts the reset inside the unit under test. |
| AC2b | **Same path, different search recovers too.** After a throw at `/checkin?s=1&t=A`, navigating to `/checkin?s=1&t=B` renders the route rather than the fallback. | Reduce the key to `location.pathname` only → **AC2b goes red while AC2a stays green**. Round 1 measured exactly this. Without AC2b the suite certifies a boundary that strands a student on GAM-352's own page. |
| AC3 | A **real `lazy(() => Promise.reject(…))` rejection** propagating through `<Suspense>` renders the reload action; a plain generic throw does not. | Invert the chunk-error predicate → the generic case starts offering reload and the chunk case stops, both red. Drive this through an actual lazy rejection, not a hand-thrown `Error` with a message written to match the predicate — round 1 flagged the latter as circular, and a lazy rejection was measured to reach the boundary. |
| AC4 | The fallback text makes no claim about saved or lost data. | Assert the rendered fallback text does not match `/saved\|lost\|your changes/i`; adding such a claim to the copy turns it red. |
| AC4b | **Copy follows DES-14/DES-16** — sentence case, no apology or "Oops", and it names an action. | Follow the existing precedent for a copy test: `src/emails/templates/event-reminder-48h.test.tsx` already has a `DES-14 voice: no bare "Submit"/"OK"` test. Reuse that shape; changing the copy to an apology turns it red. |
| AC5 | The `Suspense` loading path still works — the `Loading page…` fallback still renders while a lazy route is pending. | **Write this assertion; it does not exist today.** Round 1 measured that `"Loading page…"` appears exactly once in the repo (`src/app/router.tsx:152`) with **zero** test references, and no test resolves the 14 routes — so the earlier claim that this was "covered by the existing suite" was false. Either add the assertion in the new test file, or delete AC5 and rely on AC6 alone. Do not restate the false claim. |
| AC6 | **The full suite is green and no existing test was edited or deleted.** | `npm run test` — **measured baseline on this branch: 98 files / 2505 tests, all passing** (`npm ci` first; `node_modules` starts empty on a fresh container). Both counts must go **up**, never down, and no pre-existing test may change. Constitution non-negotiable: "Existing tests must pass unless the boss explicitly approves a test update." |

**Test harness:** raw `createRoot` + `act` + `MemoryRouter`, with
`// @vitest-environment jsdom` as line 1. Follow
`src/app/SeasonProvider.test.tsx:200-232` and `src/app/AppShell.test.tsx` for
the exact house pattern. **Do not add `@testing-library/react`** — it is not
installed and adding a dependency is out of scope (item 9).

**Console noise:** React logs caught errors via `console.error`. If a test's
expected error output pollutes the run, silence it narrowly with a scoped
`vi.spyOn(console, 'error')` restored in the same test — never globally.

**Harness recipe for AC3's reload assertion — measured in round 1, use it and
skip the round it would otherwise cost you.** `vi.spyOn(window.location,
'reload')` throws `TypeError: Cannot redefine property: reload` under the
installed jsdom. This works:

```ts
vi.stubGlobal('location', { ...window.location, reload: vi.fn() });
// … assert the action calls it …
vi.unstubAllGlobals();
```

There is **no existing precedent for this in the repo** (`grep -rn
"location.reload\|stubGlobal('location'" src/ tests/` → no hits), so this recipe
is the specification, not a hint.

## 7. GAM-352 (acceptance criterion 5 of the issue)

**Do not edit `CheckinResult.tsx` and do not touch GAM-352.** The worker's scope
ends at the boundary. The orchestrator will comment on GAM-352 recording that
this work covers its *symptom* (the blank page) and that its remaining, distinct
defect is the unvalidated cast at `CheckinResult.tsx:343` feeding
`state.attendance.check_in_at` at `:773` — i.e. GAM-352 is re-scoped to payload
validation, not closed. GAM-352 is in `Backlog`, so it is not dispatchable and
must not be claimed here (item 28a).

## 8. Least confident decisions (item 19d) — round 2

Round 1 resolved four of the five original entries by measurement; §3 now
carries those results as established fact. What remains genuinely open is
below. Entries 1-3 of the original list are **closed** — the reset mechanism is
measured, the loop hazard was measured false, the Vite strings are sourced from
the installed `dep-BK3b2jBa.js` rather than inferred, and `react-error-boundary`
is confirmed unnecessary (round 1 built a working boundary in ~25 lines).

### Still open

1. **That shipping GAM-387 with the chrome gap open is the right call at all.**
   Round 1 ruled the *decision* sound — `App.tsx` is correctly frozen for this
   scope — but it also found the gap wider than this packet had admitted:
   `KpiStrip` runs a Supabase loader on every chrome-bearing route. So the row
   the owner reads will say GAM-387 is done while a blank screen remains
   reachable. Wrong if the honest answer is that GAM-387 should not close until
   GAM-422 does. **This packet's position: ship it, because routed page content
   is where nearly all rendering and data loading lives, and a partial fix that
   is measured and disclosed beats a wider one that is not.** The gate should
   say whether that reasoning holds or whether this is item 27's "verified
   against a stub" in a different costume.

2. **That a keyed boundary remounting the whole route subtree on every
   navigation is free.** Round 1 checked the one case that looked risky
   (`KpiStrip` sits above `{children}`, so it is unaffected) and found no green
   test depending on route state surviving navigation. But that is an argument
   from the *current* test suite, not from the app's behaviour: any page holding
   unsaved local state across a same-path search change would now lose it.
   Wrong if such a page exists and no test covers it. The `/checkin` flow is the
   one to look at, since R3 deliberately makes its search changes remount.

3. **That AC3 is honest evidence rather than a dressed-up tautology.** R4 now
   sources its strings from the installed Vite and AC3 drives a real `lazy()`
   rejection, which is a genuine improvement on round 1's circular version. But
   **no chunk-load failure has ever been observed on this deployment** — the
   issue concedes this and nothing since has changed it. The test proves the
   boundary handles a rejection it was given; it does not prove production
   failures look like that. Wrong if the `vite:preloadError` path is the only
   one that actually fires in a real browser, in which case the string predicate
   is decoration. The `e2e-personas` skill could settle this and this packet is
   **not** spending a round on it — say if that is the wrong call.

4. **That `AppShell`'s chrome genuinely survives in the real tree, not just in
   a `MemoryRouter` test harness.** Every measurement so far — round 1's probes
   and every AC below — runs in jsdom against a hand-built tree. AC1 asserts
   "chrome still in the DOM" against a harness the worker writes, which is not
   the same claim as "the real `TopNav` is still usable after a real route
   throws." Wrong if something in the real provider stack (`LayerProvider`,
   `Theme`, `SeasonProvider`) behaves differently under a caught error. The
   cheap mitigation is one assertion against the real `AppShell`; the gate
   should say whether that is required or whether the harness suffices.
