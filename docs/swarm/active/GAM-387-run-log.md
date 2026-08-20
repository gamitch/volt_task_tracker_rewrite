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
- **Six fold-ins applied** to the packet, closing round 2's findings: §4's
  contradictory "and the reset key" struck; **AC1 rewritten to assert against
  the real `AppShell`** with the measured recipe, and **AC1b added** to close the
  N2 hole (nothing proved the `router.tsx` mount existed); R4's provenance claim
  corrected to distinguish the sourced mechanism from the browser-authored
  strings, with three off-by-one line cites fixed; the `vite:preloadError` path
  made conditional on its own test; and the two disclosure obligations plus the
  item 26 tier defence recorded as the orchestrator's, not the worker's.
- **Gate closed at DISPATCH after two rounds** — item 19a's cap respected, no
  escalation needed. Definition of Ready items 1-5 satisfied.
- **DISPATCHED `worker-implementer`** (pinned default model — no item 18 trigger
  applies; recorded per item 18's "record the tier used") with
  `run_in_background: false`. *If this line is the last one in this file, the run
  died holding this subagent.*
- **WORKER VERDICT: complete, no dispute.** Commits `3d51d3c` (the boundary) and
  `a86259a` (a fix to its own AC4b regex). **Existence verified rather than
  assumed (item 21):** HEAD moved, `git diff --name-only 4859b58 HEAD` returns
  exactly the three Allowed Files, working tree clean, and the boundary is in
  the committed blob (285 lines) and wired at `router.tsx:219`/`:341`. Nothing
  outside the allowlist was touched.
  * Suite **98/2505 → 99/2514**, both counts up, no existing test edited.
  * Every AC mutation was run with real red output captured: AC1, AC1b, AC2a,
    AC2b, AC3, AC4, AC4b, AC5. **AC2a and AC2b each went red while the other
    stayed green**, which is the pairing that was the whole point of the gate's
    round-1 finding.
  * **The worker reported a near-miss against itself**, which is the honest
    outcome: its first AC4b test used `\bsorry\b`, which does not match at a DOM
    text-node concatenation seam (`…problemSorry,…`, no space), so the mutation
    came back *green*. It caught this only by actually running the mutation,
    fixed the test, and committed the fix separately. That is precisely the
    failure mode "run the mutation" exists to catch, and it would have shipped a
    mutation-blind assertion otherwise.
  * Decisions it made where the packet left room: boundary placed **outside**
    `<Suspense>`; `vite:preloadError` path **not built** (so the string predicate
    alone, per the packet's condition — the honest choice, since building it
    untested was the alternative); `pathname+search` over `location.key`.
  * For AC1b it found a real throw rather than a synthetic one: `AppRoutes`
    alone never mounts `SeasonProvider`, so the real `CoachHome`'s
    `useActiveSeason()` throws for a genuine reason.
- **DISPATCHED `checker-reviewer`** (opus, `run_in_background: false`) — HEAVY
  requires a separate checker; a worker may not self-certify. *If this line is
  the last one in this file, the run died holding this subagent.*
- **CHECKER VERDICT: PASS** (one MINOR, plus NITs; no BLOCKER, no MAJOR). It
  replayed rather than trusted — seven mutations in its own worktree, removed
  after, shared tree never touched.
  * **The load-bearing pair holds, measured independently:** under
    `key={pathname}` exactly one test goes red and it is AC2b, with AC2a among
    the eight still passing. Not "both red", not "neither".
  * Removing the wrapper from `router.tsx` turns AC1b and nothing else red, so
    the mount is genuinely proven.
  * AC3 ruled **not circular**: the mechanism (a rejected lazy payload rethrowing
    through `Suspense` into the boundary) is real in the production nesting; only
    the rejection *value* is authored, which jsdom makes unavoidable and which
    the packet's own wording prescribes.
  * Every Astryx prop checked against `astryx-api.md` — none hallucinated.
    Accessibility verified against **rendered DOM**, not inferred:
    `role="status"` + real `<h2>` + native `<a>` for the generic case,
    `role="alert"` + native `<button>` for the chunk case, no `tabIndex`.
  * Gates all exit 0; suite 99 files / 2514 tests.
  * Item 27 checked explicitly and cleared: the surface reads real caught errors
    on the real user path, so this is Passed and not Partial.
  * **MINOR:** `RouteErrorBoundary.test.tsx:417` carries the *same* blind
    word-boundary defect the worker fixed one line above — `\bOK\b` cannot match
    at a `textContent` seam. The checker proved it: with a bare "OK" planted in
    the shipped copy, AC4b stayed **green**. Exactly the class of bug a green
    suite cannot show you, found twice in one file by two different agents
    running mutations.
- **MINOR fixed by the orchestrator rather than deferred.** A one-line regex
  with a mutation already named does not need a follow-up row — filing one would
  be the ceremony item 26 warns against. Committed first (`40d10b7`), then
  mutated **in a dedicated worktree** (item 23, `/tmp/gam387-orch`, removed
  after; shared tree never touched). Planting `"OK, head back to your
  dashboard…"` in the shipped copy now turns AC4b **red, exit 1**, on exactly
  the seam that defeated the old assertion:
  `expected 'VOLTThis page ran into a problemOK, head back…' not to match
  /Submit|OK/`. Reverted, re-ran green. The comment above both assertions now
  explains why *neither* carries word boundaries, so it cannot drift back.
- **GATES (all six, clean tree, `40d10b7`)** — run directly, not through a pipe:
  `tsc` 0 · `vite build` 0 · `format:check` 0 · `eslint` 0 (0 errors, 379
  warnings) · `vitest` full **99 files / 2514 tests**, baseline 2505 (+9) ·
  `vitest` scoped 1 file / 9 tests. **VERDICT: PASS — all six gates exit 0.**
  These figures match the checker's independent run, so three agents agree on
  the same numbers rather than one asserting them.
- **PR body written and validated BEFORE opening the PR** —
  `docs/swarm/active/GAM-387-pr-body.md`, `check.mjs` exit 0
  (`OK  declaration closes GAM-387`). Committed first, per the GAM-418 lesson
  that a run killed before writing its artifact leaves nothing to reconstruct
  from. Carries all three orchestrator obligations: narrowed scope disclosed,
  GAM-422 linked, HEAVY tier stated and defended with the losing argument named.
  `Ignore GAM-352` so merging cannot close a row whose actual cause is untouched.
- **PR COULD NOT BE OPENED — GAM-333's wall, hit with both credentials.**
  `gh pr create` returned `HTTP 401: Bad credentials` on the ambient token and
  again with `GH_TOKEN=$GITHUB_TOKEN`; a direct REST `POST /repos/.../pulls`
  returned 401 as well. Three channels, one answer. **Not retried further** —
  `AGENTS.md` is explicit that a refused credential is a boundary doing its job,
  not an obstacle to route around.
  **Nothing is lost, and that is by design:** the branch is pushed, and
  `docs/swarm/active/GAM-387-pr-body.md` is committed and validated (exit 0), so
  opening this is one paste for a human or a scoped session. That artifact was
  written *before* the API call precisely because the run that skips this step
  is the one whose work has to be reconstructed from a log.
  **To open it:**
  `gh pr create --base main --head claude/gam-387-error-boundary
   --title "GAM-387: app-wide route error boundary"
   --body-file docs/swarm/active/GAM-387-pr-body.md`
- **GAM-352 re-scoped by comment** (the issue's own acceptance criterion 5), not
  closed and not rewritten — item 30 binds the writer, and that row is neither
  claimed nor owned by this run. Recorded there: the boundary handles the blank
  screen, the unvalidated cast at `CheckinResult.tsx:343` feeding `:773` is
  untouched (both lines re-verified), so its remaining scope is payload
  validation and the "or add an error boundary" half of its proposed scope can
  be dropped. Its original triage caveat — that this was a harness-shaped input
  — still stands; GAM-387 made the consequence survivable, not impossible.
- **GAM-387 moved `In Progress → In Review`** (item 28e — never `Done`; the
  merge closes it, not the author), with a comment carrying the narrowed scope,
  the GAM-422 link, the gate figures, and the exact `gh pr create` command.
- **Read back** (item 28c discipline applied to the close, not just the claim):
  GAM-387 = `In Review`, labels `other`/`Bug`/`heavy`. GAM-422 = `Backlog`,
  labels `Bug`/`unreviewed`/`premise-gate`.
- **RUN COMPLETE.** No subagent was ever left in flight: three were dispatched
  (`checker-premise` ×2, `worker-implementer`, `checker-reviewer` — four in all),
  each with `run_in_background: false`, each waited for, each verdict written
  here before the next step. One item remains for a human: **open the PR from
  the preserved body.**
