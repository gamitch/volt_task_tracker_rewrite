# Checker Packet: T006 (AppShell + TopNav) — Check Attempt 1

## Task ID
T006 — AppShell + TopNav (NAV-01/NAV-02)

## Checker Agent
checker-accessibility (per task-ledger.md T006 row)

## Attempt
Check attempt 1 of 3 (max 3 before mandatory boss-arbiter escalation per constitution "Loop Limit").
This is the first check on this task — no prior checker verdict exists. Full task context:
`docs/swarm/active/T006-worker-packet.md`.

## What This Check Covers
Full first-pass verification of a new task — not a targeted re-check. Verify everything: the
Astryx prop cross-check, NAV-01/NAV-02 compliance, keyboard operability + visible focus (DES-17),
contrast in both modes, role-gated season Selector, the `user === null` no-crash case, and the
forbidden-file boundary. **In addition, this attempt carries a specific, non-negotiable
investigation into a self-reported test regression — see the "CRITICAL: Test Regression
Investigation" section below. Do not let this get rubber-stamped or waved through as an aside.**

## Worker's Claimed Changes (do not trust — verify independently)
1. New `src/app/AppShell.tsx` — composes Astryx `AppShell` with `topNav={<TopNav />}`,
   `sideNav={undefined}`, `mobileNav={false}`; chromeless bypass (returns `children` directly, no
   Astryx `AppShell`) for `routePaths.login` / `routePaths.acceptInvite` via `useLocation()`.
2. New `src/components/nav/TopNav.tsx` — `TopNavHeading` wordmark (`heading="VOLT"`,
   `headingHref={routePaths.dashboard}`) linking Home; season `Selector` shown only when
   `user?.role === 'admin' || user?.role === 'coach'`, backed by a hardcoded
   `PLACEHOLDER_SEASON_OPTIONS` array (no real season data source exists yet — expected,
   flagged by worker as a known placeholder pending future season-data wiring); user menu
   (`Avatar` inside a `DropdownMenu`'s icon-only `button` slot) with exactly three items in order
   — Profile (`navigate('/settings#profile')`), Appearance (`navigate('/settings#appearance')`),
   Sign out (`logout()` + `navigate(routePaths.login)`); entire `endContent` block (season selector
   + user menu) skipped when `user` is `null`.
3. Edited `src/App.tsx` — now wires `BrowserRouter > AuthProvider > LayerProvider > Theme >
   AppShell > AppRoutes` in place of the prior placeholder `<div><h1>VOLT Team Portal</h1></div>`.
4. Worker claims `src/app/router.tsx` and `src/app/guards.tsx` are byte-identical / zero diff
   (confirmed via `git diff --exit-code`, not just eyeballing).
5. Worker claims `npm run typecheck` / `npm run lint` / `npm run build` / `npm run format:check`
   all exit 0.
6. **Worker self-reports that its `App.tsx` wiring change broke the pre-existing, already-Passed
   `src/theme/theme.smoke.test.tsx` (authored by T002a, outside T006's Allowed Files and forbidden
   for this worker to edit) with `TypeError: window.matchMedia is not a function`.** Worker did not
   touch the forbidden test file; flagged this as a known risk in its output instead.

## Astryx Ground Truth — Re-verify Every Line Reference Yourself
Do not trust the worker's citations. Re-open `docs/swarm/astryx-api.md` at each line number below
and confirm the prop is actually documented there with that name/type. Also confirm no prop is used
anywhere in `AppShell.tsx` / `TopNav.tsx` that is absent from all of these sections (constitution
item 2 — MAJOR if a prop is hallucinated).

- `AppShell` props: `docs/swarm/astryx-api.md:2583-2595` (`children`, `contentPadding`, `topNav`,
  `sideNav`, `mobileNav`, `banner`, `height`, `variant`, `xstyle`). Worker uses `topNav`, `sideNav`,
  `mobileNav` only. `mobileNav={false}` is the doc's own documented example
  (`astryx-api.md:2550`) — not a hack.
- `TopNav` props: `docs/swarm/astryx-api.md:2215-2225` (`heading`, `startContent`, `children`,
  `centerContent`, `endContent`, `label`, `xstyle`). Worker uses `label`, `heading`, `endContent`
  only.
- `TopNavHeading`: **no formal props table exists** in astryx-api.md — its `## Components` entry at
  `astryx-api.md:2229-2233` literally says "undefined." The only ground truth is the example usage
  at `astryx-api.md:2093,2098-2099`: `<TopNavHeading logo={...} heading="My App" headingHref="/" />`.
  Worker uses only `heading` and `headingHref`, both attested by that example. Confirm this
  independently — also confirm (per the task instructions) that `TopNavHeading` is NOT used with an
  `as`/`LinkComponentType` prop anywhere in the worker's code, and confirm that `LinkComponentType`
  in astryx-api.md is documented **only** on `Link.as` (`astryx-api.md:1959`), `LinkProvider.component`
  (`astryx-api.md:1979`), and `BreadcrumbItem.as` (`astryx-api.md:2844`) — never on `TopNavHeading`.
  If that's confirmed, the worker's claim ("deliberately avoided TopNavHeading's `as`/
  `LinkComponentType` prop since it's CLI-only, not in astryx-api.md") is correct and the worker's
  choice not to use it is the right call, not a gap.
- `Selector` props: `docs/swarm/astryx-api.md:1365-1387` (`label`, `options`, `value`, `onChange`,
  `placeholder`, `size`, `isLabelHidden`, etc.). Worker uses `label`, `isLabelHidden`, `options`,
  `value`, `onChange`, `size="sm"` — all present in that table (`size` type is
  `'sm'|'md'|'lg'`, `astryx-api.md:1377`).
- `Avatar` props: `docs/swarm/astryx-api.md:419-458` region (see full component doc around line
  419) — worker uses `name`, `size="small"` only, both documented.
- `Button` props (inherited by `DropdownMenu`'s `button` slot — see next item):
  `docs/swarm/astryx-api.md:1807-1827`. **Specifically verify**: `icon` (`ReactNode`, line 1821)
  and `isIconOnly` (`boolean`, line 1822) are genuine documented `Button` props, and `label` (line
  1811) is explicitly documented as becoming the `aria-label` "when isIconOnly is true." The worker
  passes `button={{ label: 'Account menu for ...', icon: <Avatar .../>, isIconOnly: true }}` to
  `DropdownMenu` — confirm this is valid given `DropdownMenu.button`'s documented type is
  `DropdownMenuButtonProps` = "Button props except onClick" (`astryx-api.md:1877`), i.e. `icon`/
  `isIconOnly` are legitimately inherited from `Button`, not hallucinated on `DropdownMenu` itself.
- `DropdownMenu` props: `docs/swarm/astryx-api.md:1873-1884` (`button`, `items`, `isMenuOpen`,
  `onOpenChange`, `menuWidth`, `onClick`, `hasChevron`, `children`). Worker uses `button`, `items`,
  `hasChevron={false}` — all present; `items` shape (`{label, onClick?, icon?, isDisabled?}` per
  line 1878) matches the worker's three plain `{label, onClick}` entries.
- `LayerProvider` props: `docs/swarm/astryx-api.md:2459-2462` (`children`, `toast`). Worker uses
  `children` only (no `toast` config) — confirm exactly one `LayerProvider` instance exists in the
  whole render tree (astryx-api.md:2457 says "Nested providers pass through" but the worker packet
  and doc both still recommend exactly one at/near the root — confirm no accidental duplicate).
- `Theme`: confirmed **not documented anywhere** in `astryx-api.md` (no `# Theme` header exists —
  independently grep-confirm this yourself, do not take the worker's or this packet's word for it).
  This is a known, pre-existing gap (same one T002/T002a worked around). The established pattern is
  `<Theme theme={voltTheme}>{children}</Theme>` per `src/theme/theme.smoke.test.tsx` (T002a
  precedent) — confirm `App.tsx` matches that exact call shape and passes no additional
  undocumented props to `Theme`.

## Required Verification Steps (standard checker-accessibility scope for this task)
1. **Read the actual files.** Open `src/app/AppShell.tsx`, `src/components/nav/TopNav.tsx`, and
   `src/App.tsx` in full — do not rely on the worker's packet or the worker's own summary of its
   changes.
2. **NAV-01/NAV-02 compliance.** Confirm: `AppShell.tsx` wraps content in `LayerProvider` → `Theme`
   → Astryx `AppShell` (or equivalent, per `App.tsx`'s actual composition) except for
   `routePaths.login`/`routePaths.acceptInvite`, which render chromeless with `LayerProvider`/
   `Theme` still applied; `TopNav.tsx` shows wordmark→Home, season `Selector` gated to
   `admin`/`coach` only, and a user menu with exactly Profile/Appearance/Sign out in that order.
3. **Astryx prop cross-check.** Per the "Astryx Ground Truth" section above — re-open
   `astryx-api.md` yourself at each cited line, do not trust the worker's or this packet's line
   citations at face value. Flag any prop used in `AppShell.tsx`/`TopNav.tsx` that you cannot find
   documented anywhere in `astryx-api.md` as MAJOR (constitution item 2).
4. **Constitution item 2 / TopNavHeading `as` claim.** Independently confirm the worker did not use
   `TopNavHeading`'s undocumented `as`/`LinkComponentType` prop, and that this prop genuinely
   appears nowhere in `astryx-api.md`'s `TopNavHeading` treatment (only on `Link`, `LinkProvider`,
   `BreadcrumbItem`) — see the ground-truth note above.
5. **Keyboard operability + visible focus (DES-17, constitution item 15 — BLOCKER if broken).**
   Re-verify the worker's screenshots AND independently re-run (or run an equivalent independent
   check of) the keyboard walkthrough: Tab to the user-menu trigger, open with Enter/Space, arrow
   through Profile/Appearance/Sign out, activate with Enter, close with Escape — keyboard only, no
   mouse. Same for the season `Selector` when visible (admin/coach test user). Confirm a visible
   focus indicator on every interactive element in both `TopNav` and the season `Selector`/user
   menu, in both light and dark mode.
6. **Contrast, both modes.** Confirm WCAG-relevant contrast for `TopNav`'s rendered elements (text,
   icons, focus rings) in both light and dark mode from the worker's screenshots (and your own
   render if the screenshots are insufficient or you have doubts about their accuracy).
7. **Season Selector role-gating.** Confirm independently (not just via worker screenshot) that the
   Selector renders only when `user?.role` is `'admin'` or `'coach'`, and is absent for other roles
   (e.g. `'staff'`/`'volunteer'`) and when `user` is `null`.
8. **`user === null` no-crash case.** Confirm independently that `TopNav` does not throw when
   rendered with no authenticated user — do not just accept the worker's narration; render or test
   this yourself.
9. **Forbidden-file check (D001 standing rule — never use git history/commit diffs as evidence).**
   Compare T006's Allowed Files (`src/app/AppShell.tsx` [new], `src/components/nav/TopNav.tsx`
   [new], `src/App.tsx` [edit]) against the current file tree directly. Confirm: no changes under
   `src/app/router.tsx`, `src/app/guards.tsx`, `src/theme/**`, `src/pages/**`,
   `src/components/nav/SideNav.tsx`, `src/components/nav/MobileNav.tsx`; no scratch/leftover files
   anywhere in `src/`. New `docs/swarm/active/*.md` packet files and a hook-appended
   `verification-log.md` line are always-expected background swarm-process artifacts — do not file
   these as a per-task finding (standing calibration rule from T004's close-out).
10. **Build/typecheck/lint.** Run `npm run build`, `npm run typecheck`, `npm run lint` yourself and
    quote real output — confirm 0 errors. Pre-existing `react-refresh/only-export-components`
    warnings (if any) are expected/non-blocking; only flag a *new* warning category or any error.

---

## CRITICAL: Test Regression Investigation (do not rubber-stamp — render an explicit verdict)

The worker self-reports that this task's `App.tsx` wiring change broke the pre-existing,
already-Passed `src/theme/theme.smoke.test.tsx` (T002a-authored; outside T006's Allowed Files;
forbidden for this worker to edit) with `TypeError: window.matchMedia is not a function`. Per
task-ledger.md, T004's CI pipeline (`.github/workflows/ci.yml`) runs `npm run test` as a required,
non-skippable step on every push to any branch with no branch filter — this project has already had
two real production CI outages (see `docs/swarm/state-summary.md`'s "CI break on real GitHub
Actions infra" / "CI break #2" notes) from exactly this class of problem (a locally-invisible or
under-checked regression that only bites on the required gate). Treat this with the same rigor.

### Step 1 — Reproduce independently
Run `npm run test` (or `npx vitest run`) yourself. Do not trust the worker's claimed error text —
confirm the exact failure and its real root cause by reading the stack trace and the actual test
file, not by assuming the worker's diagnosis is complete.

**Also independently check for a second, deeper problem the worker may not have reached:**
`src/theme/theme.smoke.test.tsx` (read it directly — it currently asserts
`container.querySelector('h1')?.textContent === 'VOLT Team Portal'` after rendering
`<Theme><App/></Theme>`). Two structural issues exist in this test against the *new* `App.tsx`,
independent of each other:
  (a) `matchMedia` is not polyfilled in this test's jsdom environment, and `App`'s new tree
      (Astryx `AppShell`/`TopNav`/`Selector`/`DropdownMenu`, or `Theme` itself) apparently calls it
      internally — this throws before anything renders.
  (b) **Even if `matchMedia` were polyfilled**, trace what the DOM would actually contain: `App.tsx`
      now renders its own `BrowserRouter`/`AuthProvider` internally (so the smoke test's outer
      `<Theme>` wrapper double-wraps `Theme` — App renders `Theme` again internally — check whether
      that nested-`Theme` shape is itself a problem), and with no authenticated user (`AuthProvider`
      starts with `user: null`) at the default jsdom location (`/`), `RequireAuth` will redirect to
      `/login`, rendering `router.tsx`'s `LoginPage` placeholder (`<h1>Login (placeholder)</h1>`) —
      not the string `'VOLT Team Portal'` the test still asserts. Confirm whether this second,
      independent failure is real (i.e., whether the test would *still* fail on its content
      assertion even after a `matchMedia` fix) — this materially changes what "the fix" looks like.
      Show your actual work (the test's real behavior with a temporary/scratch `matchMedia` stub,
      if that's the fastest way to isolate the two failure modes — delete any scratch changes before
      finishing).

### Step 2 — Was this avoidable by the worker within its Allowed Files, or a structural consequence of T005?
Determine whether this regression is a genuine, unavoidable structural consequence of T005's own
`router.tsx` module doc mandating that the `AppRoutes`/`AuthProvider` wiring land in T006 (i.e. not
a worker mistake), or whether the worker could have avoided it while staying inside
`src/app/AppShell.tsx` / `src/components/nav/TopNav.tsx` / `src/App.tsx` only. Consider: the worker
was explicitly forbidden from touching `src/theme/**` (which includes the smoke test) and had no
Allowed File in which to add a `matchMedia` polyfill (no test-setup file was in scope). Render an
explicit judgment on this, don't just assert it.

### Step 3 — Explicit severity verdict
Render an EXPLICIT BLOCKER/MAJOR/MINOR/NIT verdict, per the constitution's Failure Severity rubric,
on this specific claim: **"T006 causes `npm run test` to fail on a pre-existing, already-Passed
test, which will break the required CI gate on every future push to this branch until fixed."**
Consider all of the following before ruling:
- Build/typecheck/lint/format:check all still pass — only `test` regresses.
- The constitution's **Non-Negotiables** section states: *"The app must build successfully"* and
  *"Existing tests must pass unless the boss explicitly approves a test update"* — the latter is
  phrased as a conditional override (an explicit approval mechanism exists), not an absolute ban on
  ever touching a passing test, but a break is still a break of a Non-Negotiable absent that
  approval.
- Failure Severity rubric: BLOCKER = "breaks the build... or modifies forbidden files"; the worker
  did NOT modify a forbidden file, but its allowed-file change caused a currently-forbidden file to
  start failing — decide whether that distinction changes the classification or not, and say why.
- This project has twice already (CI break #1 and #2, see state-summary.md) treated a CI-breaking
  regression discovered post-hoc as an urgent same-day fix, not a deferred follow-up — weigh whether
  that precedent should inform your severity call here, especially since this one is being caught
  *before* merge/push rather than after.

### Step 4 — If BLOCKER or MAJOR (rework required): what does an in-scope fix look like?
If you judge this BLOCKER or MAJOR, identify what the correct fix path is. Consider explicitly and
give a reasoned recommendation among these options (do not just list them — pick one and justify
it, or say the boss/arbiter must decide):
  (a) A `matchMedia` polyfill added via a **new** test-setup file (e.g. `src/test-setup.ts`) wired
      into `vite.config.ts`'s `test.setupFiles` — note `vite.config.ts` is **not** currently listed
      in T006's Allowed Files *or* Forbidden Files (the worker packet didn't anticipate this gap).
      State explicitly whether expanding T006's scope to include such a setup-file fix is the right
      call, or whether it should instead be routed as an immediate must-fix-before-close-out
      follow-up task (would need its own worker packet + checker), given the ledger's discipline
      around Allowed/Forbidden Files.
  (b) Editing the pre-existing, currently-forbidden `src/theme/theme.smoke.test.tsx` itself (e.g.
      adding a local `matchMedia` mock in that file, and/or updating its stale content assertion
      per your Step 1(b) finding) — note the constitution's Non-Negotiables explicitly allow a test
      update "if the boss explicitly approves," so this is not automatically off the table; say
      whether this is the more surgical fix and, if so, whether it's worth recommending a scoped
      forbidden-file exception / boss-arbiter dispute to authorize it.
  (c) Any other fix shape you judge more correct, with reasoning.
  Also state plainly: is this T006's problem to fix (rework), a new follow-up task, or a dispute for
  boss-arbiter given it touches a forbidden file and a Non-Negotiable simultaneously?

### Step 5 — If MINOR/NIT (acceptable to pass with a follow-up): justify against precedent
If you judge this MINOR or NIT instead, explain explicitly why breaking a required CI gate step
does not rise to blocking here, specifically addressing why this case is different from CI break #1
and #2 (both of which were treated as urgent, same-day, blocking-class fixes despite also not
touching "forbidden" files in the git-diff sense). Do not assert the distinction — argue it.

---

## Relevant Constitution Excerpts

> **Non-Negotiables:** "The app must build successfully." / "Existing tests must pass unless the
> boss explicitly approves a test update." / "No worker may mark its own work complete." / "Every
> checker must inspect the actual artifact, not just the worker's summary."

> 1. Precedence: PRD requirement IDs > this constitution > task-ledger text > agent judgment.
> Conflicts are disputes for boss-arbiter — never improvised around.

> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md` (PRD DES-19). A prop
> absent from that file is presumed hallucinated → MAJOR. The CLI (`npm run astryx -- component
> <Name>`) is a cross-check, not a source.

> 15. Accessibility per PRD DES-17 / NFR-07 is a shipping requirement; keyboard path failures on
> core flows → BLOCKER.

> **Failure Severity — BLOCKER:** "Cannot ship. Violates a core requirement, breaks the build,
> corrupts data, breaks security, breaks accessibility, or modifies forbidden files."
> **MAJOR:** "Should not ship without boss approval. Important functional, architectural, UX, or
> correctness issue." **MINOR:** "Acceptable for the current task but should become a follow-up
> task." **NIT:** "Cosmetic or preference-level issue. Does not block completion."

> **Decision rules:** BLOCKER fails the task. MAJOR fails the task unless the boss explicitly
> approves deferral. MINOR passes with a follow-up task. NIT passes and is logged only.

> **Definition of Done:** a task is done only when (1) the worker produces the requested change,
> (2) the checker validates the actual artifact, (3) the checker records evidence, (4) the foreman
> updates the task ledger, (5) the boss or foreman accepts the checked result. "No worker may mark
> its own work complete: the checker inspects the actual artifact, not your summary."

## PRD Ground Truth (NAV-01/NAV-02, verbatim)
> **NAV-01** Use Astryx `AppShell` with `TopNav` (top slot) and `SideNav` (sidebar slot,
> `collapsible`); wrap the app in `Layer` provider and `Theme`.
>
> **NAV-02** `TopNav` contains: VOLT wordmark/logo (links Home), season selector (`Selector`,
> admin/coach only, defaults to active season), and user menu (`Avatar` + `DropdownMenu`: Profile,
> Appearance, Sign out).

## Most Recent Failure
None — this is check attempt 1 for T006.

## Required Checker Output (per constitution Evidence Requirements)
- files inspected (quote actual current contents of `AppShell.tsx`, `TopNav.tsx`, `App.tsx`, and
  the relevant lines of `theme.smoke.test.tsx`)
- exact commands run + real quoted output (not summarized/paraphrased) — including your own
  `npm run test` / `npx vitest run` reproduction
- your own screenshots or equivalent independent evidence for keyboard/focus/contrast, not just a
  re-statement of the worker's
- pass/fail per each of the 10 "Required Verification Steps" above
- **explicit BLOCKER/MAJOR/MINOR/NIT verdict on the test-regression question, with the Step 1–5
  reasoning shown, not just a conclusion**
- overall pass/fail result for T006 as a whole
- exact failure reason(s), if any, with severity classification
- recommended next action (pass; rework by this worker; new follow-up task; or dispute to
  boss-arbiter — say which, and why)

Do not mark this task complete based on the worker's claimed-changes summary above — it is
unverified narration, not evidence. Inspect the actual files and generate your own independent
evidence via testing and command runs. Do not flip `task-ledger.md` yourself — report your verdict
back; foreman-planner updates the ledger.
