# GAM-387 run log — app-wide error boundary

Issue: <https://linear.app/gamitch/issue/GAM-387/the-app-has-no-error-boundary-anywhere-so-any-render-throw-including-a>
Branch: `claude/gam-387-error-boundary`
Runtime: Claude (legacy route — no executor label on the issue, item 28b migration compatibility)

Append-only. One line per milestone, pushed immediately after it is written.
Milestones: claimed; packet written/read; each subagent dispatched; each
subagent's verdict; gates run; PR opened.

---

- **Claimed.** Read `AGENTS.md` § "Where work comes from" and `constitution.md`
  items 19, 26, 28 before opening any other file. Fetched GAM-387 live from
  Linear. State was `Todo`; labels `provenance/other`, `Bug`, `tier/unreviewed`;
  no `gate/human`; no executor label → legacy Claude-only route (item 28b).
- **Tiered HEAVY** before the `In Progress` move (item 28d). Reasoning, to be
  restated and defended in the PR (item 26): *not FAST* — a boundary component
  plus router wiring plus tests exceeds ~20 lines and is not a single-site edit.
  *Not STANDARD* — this introduces a pattern that exists nowhere in the codebase,
  which item 19b names as a full-premise-check trigger, and the issue prescribes
  an unverified structural claim ("put the boundary inside the router at route
  level so the shell and navigation survive") whose failure mode is a fix that
  looks green while acceptance criterion 2 is unmet. *HEAVY* because two tiers
  are arguable and item 26 says take the heavier, on three grounds: the central
  structural premise is unmeasured; acceptance criterion 4 is an
  honesty-about-the-user's-own-data requirement, which is item 26's "lie to a
  user about their own data"; and a boundary that catches too broadly is worse
  than none, so the tests need a separate checker rather than the author's
  say-so. Blast radius and file count are explicitly **not** reasons — item 26
  rules both out.
- **Claim read back** (item 28c — Linear has no compare-and-set): `GAM-387`
  reads `In Progress` with labels `other`, `Bug`, `heavy`. We hold it.
- **Branch created**: `claude/gam-387-error-boundary` off `main` at `debe8e4`.
- **Premises re-measured** against the working tree at `debe8e4` before writing
  the packet (item 19c). Confirmed: no production error boundary (all 8 grep
  hits are test files); `react-error-boundary` absent from dependencies; 14
  `React.lazy` routes at `src/app/router.tsx:120-140`; one `<Suspense>` at
  `:189` wrapping `<Routes>` at `:190`. **Corrected one issue claim:** the
  provider stack is not `BrowserRouter > AuthProvider > AppRoutes` — it is
  `BrowserRouter > AuthProvider > ThemeModeProvider > LayerProvider >
  ThemedShell > AppShell > AppRoutes` (`src/App.tsx:69-81`), which means the nav
  chrome already sits *above* `AppRoutes`, so the issue's route-level
  prescription is achievable without editing `App.tsx`. **Found one thing the
  issue does not contain:** four routes render chromeless (`/login`,
  `/accept-invite`, `/kiosk/:sessionId`, `/meetings/live/:sessionId`), so on
  those the fallback must carry its own way out — nav is not there to survive.
- **Packet written**: `docs/swarm/active/GAM-387-packet.md`. Tier HEAVY, worker
  on pinned default (no item 18 trigger applies). Five Least confident decisions
  declared (item 19d).
- **`node_modules` was empty on this container**; `npm ci` started so gates can
  actually run. One packet evidence line that leaned on a `node_modules` check
  was corrected to cite the manifest instead.
- **Baseline suite measured** after `npm ci`: `npm run test` → **98 files /
  2505 tests, all passing**, exit 0. Written into the packet as AC6's gate.
- **DISPATCHED `checker-premise`** (opus, `run_in_background: false`) against
  `docs/swarm/active/GAM-387-packet.md`, round 1 of the two allowed by item 19a.
  *If this line is the last one in this file, the run died holding this
  subagent* — that is the failure signature `AGENTS.md` describes, and it means
  the premise gate's verdict was never seen.
- **VERDICT round 1: REVISE** (4 MAJOR, 4 MINOR, 1 NIT, no BLOCKER). The gate
  ran, it did not merely read — four instrumented probes in its own worktree
  (item 23), then removed it and left the shared tree clean. What it measured:
  * **Mechanism confirmed.** Boundary state *is* sticky (`PROBE-B`: after
    navigation the chrome updated but the fallback stayed and the new route
    never rendered). A component whose element is created once and does not
    call `useLocation()` renders 1→1 across a navigation; one that does calls
    renders 1→2 and its derived key changes. `AppShell`'s own `useLocation()`
    does **not** rescue `AppRoutes`. So §3's central claim holds.
  * **My §8.1 loop hazard is not real** — a location-derived key changes once
    per navigation and cannot self-drive (`PROBE-C2`: one catch, 2 ms, stable).
    Leaving it in would have sent the worker chasing a phantom.
  * **`pathname` alone is measurably wrong.** `PROBE-4` run 3: with
    `key={location.pathname}`, AC2 passes while `/checkin?s=1&t=A → ?t=B` stays
    stuck forever — and `CheckinResult.tsx:359-361,607` reads `s`/`t`/`code`
    entirely from search params on one pathname. That is GAM-352's own page: a
    student whose first scan crashes is stranded on every rescan.
  * **AC2's mutation was a no-op as written.** R2 let the reset key live in
    `router.tsx` while the test builds its own tree — deleting it would leave
    the test green, destroying the AC1/AC2 pairing that was the whole point.
  * **AC5's "covered by the existing suite" was false.** `"Loading page…"`
    (`router.tsx:152`) has zero test references and no test resolves the routes.
  * **R4's predicate has a source-provable hole**: Vite authors its own
    `Unable to preload CSS for …` error (`dep-BK3b2jBa.js:64844`) which neither
    the string predicate nor `ChunkLoadError` matches. It also found the
    first-party `vite:preloadError` window event at `:64849-64857`.
  * **Retry really is futile**, measured: `react.development.js:477-484` sets
    `payload._status = 2` and never resets, so a remount does not re-invoke the
    import (`PROBE2-RETRY`: `importFnCalls: 1`). Reload is the only recovery.
  * **One citation of mine was wrong**: item 6 is about logs/URLs/analytics/
    commits/fixtures, not user surfaces.
  * **Cheaper path found**: `src/pages/no-access/AccessDeniedPage.tsx:84-104` is
    already the exact fallback shape R5/R6/R7 describe, already passed.
  * Confirmed no passed work is reversed (`KpiStrip` sits above `{children}`)
    and no green test breaks.
- **Item 20 row filed: GAM-422** (`Backlog`, `Bug`/`tier/unreviewed`/
  `provenance/premise-gate`, priority Medium) — "A throw in the app chrome …
  still blanks the screen". Filed via the `linear-task-writing` skill per item
  30, with every line number re-verified against the tree first. Filed to
  `Backlog`, **not** `Todo`: promoting work is the owner's authorization (item
  28a), not the filer's. Its id is now in the packet, so revision #5's "file the
  row, don't promise it" is satisfied.
- **Packet revised**, all 11 findings addressed: reset key mandated as
  `pathname + search` and moved inside `RouteErrorBoundary.tsx` so AC2's
  mutation targets the unit under test; AC2 split into AC2a/AC2b with the
  same-path-different-search case; AC5's false "covered by the existing suite"
  replaced with a real assertion to write; §1 restated to "routed page content"
  with the gap and GAM-422 named; R4 predicate extended with
  `unable to preload` and the three browser strings sourced from
  `dep-BK3b2jBa.js`, plus the `vite:preloadError` event; AC3 now driven by a
  real `lazy()` rejection instead of a hand-thrown error; the jsdom
  `vi.stubGlobal('location', …)` recipe supplied; the item 6 miscitation
  corrected; AC4b added for DES-14/16; the phantom loop hazard deleted; and the
  worker pointed at `AccessDeniedPage.tsx:84-104` as the existing fallback shape.
  §8 rewritten with four genuinely open doubts rather than the four now closed.
- **DISPATCHED `checker-premise` round 2** (opus, `run_in_background: false`) —
  the last round item 19a allows; a third REVISE escalates to the owner instead
  of looping. *If this line is the last one in this file, the run died holding
  this subagent.*
- **VERDICT round 2: DISPATCH** (MINOR only — no BLOCKER, no MAJOR), with six
  fold-ins to apply before the worker sees it. This gate also ran rather than
  read: three probes in its own worktree, since removed, shared tree verified
  clean.
  * **Verified the revisions by measurement, not by reading them:** re-ran the
    AC2a/AC2b pairing both ways (`mode=pathonly` → AC2a passes, AC2b fails;
    `mode=full` → both pass), reproduced the `Cannot redefine property: reload`
    failure and the `vi.stubGlobal` fix (`reloadCalls=1`), and drove a real
    `lazy(() => Promise.reject(…))` through the boundary in **both** Suspense
    placements — so R2's remaining freedom is safe.
  * **Caught a contradiction I left behind:** §4's Allowed Files still said
    `router.tsx` owned "the reset key", contradicting the R2 rewrite. That is
    exactly the line round 1's MAJOR was about, surviving in a second place.
  * **N2, the best finding of the round:** *no acceptance criterion proved the
    boundary is actually mounted in the real tree.* A worker could ship a
    perfect component, omit the `router.tsx` mount entirely, and every AC —
    including the full suite — would still pass, because **no test anywhere
    mounts `AppRoutes`**. It then built the ~20-line remedy against the real
    `AppShell` and measured it: `fallback=true`, `[role="main"]` present,
    `navCount=2`, fallback nested inside main, real `SeasonProvider`/`KpiStrip`
    executing. That answers open doubt 4 with "yes, required, and here it is".
  * **Open doubt 1 ruled sound: item 27 does not apply.** Item 27 is about a
    surface reading from a fixture or stub; this surface is real and usable —
    it proved that under the real shell. The chrome gap is item 20's territory
    and GAM-422 satisfies it. **One condition attached:** the packet bound only
    the PR body to disclose the narrowing, and *the owner reads the Linear row,
    not the PR* — so GAM-387's close comment must carry it too.
  * **Open doubt 2 ruled sound and closed the question:** `setSearchParams`
    appears nowhere in `src/`, no in-app link or `navigate()` carries a query
    string, so the app cannot produce a same-path search change at all — R3's
    key costs nothing. `CheckinResult` already re-runs on `searchParamsKey`.
  * **Three of my own citations were off by one** (`dep-BK3b2jBa.js` lines), and
    my "sourced from the installed Vite" claim was **false for the three browser
    strings** — they are browser-authored and appear nowhere under
    `node_modules/vite/`. Only the mechanism and `Unable to preload CSS` are
    sourced. Corrected rather than deleted, per item 30c.
  * **N4:** the *preferred* `vite:preloadError` detector cannot be exercised by
    AC3 — a jsdom lazy rejection never routes through `__vitePreload`, so it
    would ship untested unless a second test dispatches the event.
