# Dispute Log

<!--
Format:
## D001 - TASK-ID Short Description

Worker position:
(what the worker claimed)

Checker position:
(what the checker enforced)

Boss decision:
(what boss-arbiter decided)

Outcome:
(task passed/failed/redesigned, constitution updated or not)
-->

## D001 - T001 Alleged forbidden-file modification (docs/swarm/**) by worker-implementer

Worker position:
Changed only: package.json, tsconfig.json, vite.config.ts, eslint.config.js,
.prettierrc.json, src/main.tsx, src/App.tsx, plus two files flagged as
unavoidable build infrastructure outside the literal Allowed Files list
(index.html, package-lock.json). Did not touch docs/swarm/**; attributed the
new verification-log.md line to an automatic system hook.

Checker position:
FAIL/BLOCKER. Evidence method: `git show d13c1dd --stat/--name-status`. Commit
d13c1dd's diff includes docs/swarm/active/T001-worker-packet.md (created) and
docs/swarm/verification-log.md (+1 line), therefore "the worker's commit
modified two files under the forbidden docs/swarm/** directory."

Boss decision:
Checker was wrong on the BLOCKER; its evidentiary method was flawed. Findings:

1. Commit d13c1dd was created by the orchestrating session via a blanket
   `git add` of every untracked/modified file in the repo. Git identity in
   this environment does not distinguish per-agent authorship, so commit
   contents are NOT evidence of what the worker wrote.
2. docs/swarm/active/T001-worker-packet.md was authored by foreman-planner,
   which is explicitly authorized to write docs/swarm/active/. Not a worker
   action, not a violation by anyone.
3. The verification-log.md line ("[2026-07-16T12:28:30Z] Worker finished.
   Checker required before completion.") exactly matches the SubagentStop hook
   defined in .claude/settings.json, which appends that line automatically
   whenever worker-implementer stops. Prior log lines are identical hook
   output. The worker did not write it.
4. Independent merits check by boss-arbiter: `npm run build` succeeds
   (tsc --noEmit + vite build), `npm run lint` clean, `npm run typecheck`
   clean, tsconfig.json has "strict": true, dependencies are React 18 +
   allowlisted dev tooling only (no Tailwind, no shadcn), src/ contains only
   main.tsx and App.tsx as scoped.
5. Scope exceptions APPROVED for T001: index.html (a Vite SPA cannot build or
   run without its HTML entry, and the acceptance criteria require build+run)
   and package-lock.json (mechanical npm artifact required for reproducible
   installs). The packet's literal Allowed Files list was defective — it made
   its own acceptance criteria unachievable. Ruled as spec ambiguity, resolved
   in the worker's favor; the worker correctly flagged the deviation rather
   than hiding it.

Directives:
- checker-tests: re-issue verdict evaluating the worker's actual output list
  on its merits. Do not use bundled WIP commits as authorship evidence; use
  the worker's reported file list cross-checked against artifact inspection.
  Foreman-authored packets and hook-generated log lines are out of scope.
- Orchestrating session: stop blanket `git add`-ing. Commit worker output
  separately (explicit pathspecs) from foreman packets and hook-generated log
  lines, so per-task diffs reflect a single actor.
- foreman-planner: future scaffold/app packets must include a standing
  carve-out for mechanical build artifacts (lockfiles, Vite index.html) or
  list them explicitly in Allowed Files.
- Note: the harness flagged the checker's raw output as instruction-shaped
  ("settings-json" pattern). Benign explanation on inspection: quoting
  .claude/settings.json hook command strings (shell commands) in evidence
  looks instruction-shaped to the sanitizer. No malicious payload found, but
  checkers should summarize rather than quote raw hook command strings.

Outcome:
Checker's FAIL/BLOCKER verdict on forbidden-file grounds is VACATED. T001
substance verified passing by boss-arbiter (build/lint/typecheck/strict/deps).
Formal PASS still requires checker-tests to re-run per the Definition of Done
(no worker or single agent marks work complete unverified). Constitution
unchanged; packet defect noted for foreman process fix.

## D002 - Stack lock reversal: PRD D2 React 18 -> React 19 (constitution item 8)

Nature:
Not a worker/checker dispute. A locked architectural decision (PRD Section 2,
D2: "Vite + React 18 + TypeScript (strict)") is in irreconcilable conflict
with another locked decision (D3: Astryx is the only permitted UI vocabulary;
constitution item 8 forbids all alternate UI/CSS libraries). Surfaced during
T002 (peer-dependency conflict, logged as a watch-item risk in
state-summary.md), escalated to a formal ruling once runtime evidence became
conclusive.

Evidence (independently verified by boss-architect against the real
artifacts on 2026-07-16, not taken from any agent's report):

1. node_modules/@astryxdesign/core/package.json (v0.1.6) declares
   peerDependencies react ">=19.0.0" and react-dom ">=19.0.0". T002 installed
   with `--legacy-peer-deps` to route around this.
2. This is a real runtime requirement, not conservative metadata. Grep of
   @astryxdesign/core/dist shows 20+ component source files calling React's
   `use()` hook, which exists only in React 19 (stable). Spot-check:
   dist/theme/Theme.js line 38 `import React, { use, useId,
   useInsertionEffect, useMemo } from 'react'` and line 223
   `const isNested = use(ThemeNestingContext);`.
3. Against the installed react@18.3.1, `typeof require('react').use` is
   `undefined`. Any Astryx component calling `use()` throws a TypeError at
   first render under React 18.
4. Critical finding: Theme.js is the exact component T002 shipped, and it
   itself calls `use()`. T002's PASS was based on build/typecheck/contrast
   checks with no runtime render, so the guaranteed runtime crash was never
   exercised. The already-accepted E1 foundation does not actually run under
   React 18.
5. @astryxdesign/core's CHANGELOG documents deliberate React 19 adoption as
   a breaking change (`on*Action` -> `*Action` per React 19 convention;
   CommandPalette startTransition fix for a React 19 warning). Upstream is
   not going to re-support React 18.

Human authorization:
George (human owner) stated via chat: "if React 19 is indeed a required
dependency, then we should update" - conditional authorization whose
condition is now met by the evidence above.

Boss decision (boss-architect):
D2's React 18 lock is REVERSED for this project. The stack is Vite +
React 19 + TypeScript strict + Supabase. Rationale: D2 and D3 cannot both
hold; D3 (Astryx-only UI) is the load-bearing decision - the entire UI plan,
task ledger, and PRD Section 7 templates are built on Astryx - while "18"
in D2 was incidental (the PRD predates knowledge of Astryx's React 19
floor). Constitution item 8 is amended accordingly. The PRD file itself is
an external authoritative input and is NOT edited; this entry is the
permanent record of the approved deviation from PRD D2. All other clauses
of D2 (greenfield SPA, Vite, TS strict, React Router, TanStack Query,
Supabase JS, no Tailwind, no shadcn) remain locked.

Corrective work directive (for foreman-planner to execute):
Insert ONE new corrective task between T002 and T003 (suggested ID T002a,
Epic E1, checker: checker-tests) rather than re-opening T001/T002 - both
passed the criteria they were given; the criteria changed, and a single
forward-fix task keeps the ledger append-only and independently checkable.
T002a scope:
- Upgrade react/react-dom to ^19 (and @types/react/@types/react-dom to 19)
  in package.json; clean reinstall WITHOUT `--legacy-peer-deps`; commit the
  regenerated package-lock.json.
- Acceptance: `npm ls react react-dom @astryxdesign/core` clean (no
  ELSPROBLEMS/invalid markers); `node -e` check that `typeof
  require('react').use === 'function'`; build/typecheck/lint/format all
  clean; tsconfig strict unchanged.
- Runtime smoke check (mandatory - this is the failure mode typecheck
  missed): render the app root with the Astryx Theme provider (vitest +
  jsdom or equivalent) and assert no throw. A green typecheck alone does
  not close this task.
- Re-verify src/theme/astryx-augment.d.ts (T002's TypographyRole
  workaround) still compiles against @types/react 19; adjust only if the
  compiler forces it.
- Verify allowlisted runtime deps present in package.json
  (@tanstack/react-query, react-router-dom, qrcode.react when added)
  declare React 19 peer support; any forced major-version bump is reported
  in the checker packet, not silently taken.
- Foreman also updates state-summary.md: Known Decisions stack line ->
  React 19 (cite D002); delete/resolve the "React 18 vs @astryxdesign/core
  peer-dependency conflict" risk entry.
T003 remains blocked until T002a passes.

Other locked decisions reviewed for impact:
- D3 (Astryx design system): unaffected; this ruling exists to preserve it.
- D9 (Resend + pg_cron reminders), D10 (ICS feed), D1 (Supabase): backend/
  Edge Function decisions, no React coupling, unaffected.
- Constitution item 9 (dependency allowlist): unchanged in content, but
  T002a must confirm React 19 peer compatibility of each allowlisted
  runtime dep as it lands.
- T001/T002 verdicts: NOT vacated. Their evidence remains valid for what
  was checked; the gap (no runtime render check) is closed by T002a's
  mandatory smoke check. Future E1+ UI tasks should include at least one
  runtime render assertion, not typecheck alone - foreman to carry this
  into packet templates.

Outcome:
D2 amended (React 18 -> React 19) with human-owner authorization.
Constitution item 8 updated, citing this entry. Corrective task T002a
directed; foreman-planner to write the packet. PRD file untouched by
design.

## D003 - T006 App wiring breaks pre-existing theme.smoke.test.tsx (CI test gate red); test-update + test-infra authorization

Worker position:
T006's deliverables (AppShell.tsx, TopNav.tsx, App.tsx wiring) are complete
and correct. The App.tsx wiring — explicitly mandated by T005's own
router.tsx module doc ("Wiring `AppRoutes` (and `AuthProvider` from
`./guards`) into `main.tsx` / `App.tsx` is T006's job") — broke the
T002a-authored `src/theme/theme.smoke.test.tsx`, which is outside T006's
Allowed Files and forbidden to the worker. Worker did not touch the
forbidden file; self-reported the regression instead of hiding it.

Checker position (checker-accessibility, T006 check attempt 1):
T006 verified correct on every substantive axis: NAV-01/NAV-02 compliance,
Astryx prop cross-check against astryx-api.md, DES-17 keyboard/focus,
season-Selector role-gating, `user === null` no-crash, forbidden-file
boundary clean, build/typecheck/lint/format:check all exit 0. But
`npm run test` fails, breaking the required CI gate (ci.yml runs
`npm run test` on every push, no branch filter) — a Non-Negotiable
("Existing tests must pass unless the boss explicitly approves a test
update") with no approval on record. Checker confirmed via real command
execution that the break has TWO independent causes: (1) no matchMedia
polyfill exists anywhere (no vitest setupFiles at all) and the real Astryx
component tree now calls `window.matchMedia` at mount, throwing in raw
jsdom; (2) even with a polyfill temporarily patched in, the test's
`'VOLT Team Portal'` h1 assertion fails — an unauthenticated `user: null`
session at `/` is now correctly redirected by RequireAuth to `/login`'s
placeholder (`<h1>Login (placeholder)</h1>`).

Boss decision (boss-arbiter, 2026-07-18):
All evidence re-verified independently — not taken from either party:

1. Reproduced failure mode 1 myself: `npx vitest run` fails with
   `TypeError: window.matchMedia is not a function` at
   theme.smoke.test.tsx:34. Grep confirms zero matchMedia polyfills and
   zero `setupFiles` config anywhere in the repo; vite.config.ts has no
   `test` block at all.
2. Reproduced failure mode 2 myself with a scratch test (created, run,
   deleted): with matchMedia polyfilled, the render succeeds without
   throwing and the first h1 is exactly `"Login (placeholder)"` — not
   `'VOLT Team Portal'`. Both failure modes are real and independent; both
   must be fixed.
3. Read router.tsx's module doc directly: the App.tsx wiring was T005's
   explicit standing instruction to T006, not scope creep. Read the old
   assertion's target: App.tsx's placeholder `<h1>VOLT Team Portal</h1>`
   was deleted by that mandated wiring. The redirect-to-/login behavior is
   the CORRECT new behavior (NAV-06); the old assertion describes a DOM
   state that structurally cannot recur. This is a stale test, not an app
   bug.
4. Confirmed ci.yml runs `npm run test` as a required step on every
   push/PR with no branch filter. CI is red on real infrastructure right
   now — same class as CI breaks #1/#2 (state-summary.md), both treated as
   same-day urgent fixes. Same treatment applies here.

Rulings:

A. Worker is NOT at fault and no rework of T006's own files is required or
   permitted. The regression was structurally unavoidable inside T006's
   Allowed Files: the worker was forbidden from src/theme/** and had no
   in-scope file in which to add test setup. The worker's self-report was
   the correct move (D001 precedent: flag deviations, don't hide them).

B. Checker's BLOCKER classification of the red CI gate is UPHELD as to the
   repo state — red required CI is a blocker regardless of whose fault it
   is — but the blocker is reassigned from T006-rework to a new corrective
   task T006a (mirroring D002's T002a forward-fix pattern: T006 met the
   criteria it was given; the fix belongs to files outside its scope).

C. Test update APPROVED (this entry is the explicit boss approval the
   Non-Negotiable requires) for `src/theme/theme.smoke.test.tsx`, exact
   scope:
   - Remove the outer `<Theme theme={voltTheme}>` wrapper and render
     `<App />` directly; App now owns the Theme provider internally per
     NAV-01, so the old wrapper double-wraps Theme and no longer represents
     the real app root. Remove the then-unused `Theme`/`voltTheme` imports.
   - Keep the `.not.toThrow()` render assertion as the core of the test —
     its documented purpose (exercising the React-19 `use()` runtime
     failure mode T002 missed) is unchanged and still served, now against
     the full real tree.
   - Replace `expect(container.querySelector('h1')?.textContent).toBe('VOLT
     Team Portal')` with a durable blank-render guard:
     `expect(container.textContent?.trim()).toBeTruthy()`. Deliberately do
     NOT assert the `'Login (placeholder)'` copy — that placeholder is
     scheduled to be replaced by T016 and asserting it would re-create this
     exact staleness problem; route/guard content behavior is T005/T016
     checker territory, not this smoke test's job.
   - Update the module doc: keep the T002a history, add one line citing
     D003 for the restructure.
   No other changes to this file. Restructuring to an authenticated-session
   render is REJECTED: it would couple a smoke test to placeholder auth
   machinery that is itself temporary (real Supabase auth lands E3),
   guaranteeing another stale-test cycle.

D. Shared test infrastructure APPROVED, exact scope:
   - New file `src/test-setup.ts`: a minimal, guarded matchMedia polyfill
     only (assign only if `window.matchMedia` is undefined; return a
     MediaQueryList stub with `matches: false`, `media: query`, no-op
     `addEventListener`/`removeEventListener`/`addListener`/
     `removeListener`/`dispatchEvent`, `onchange: null`). Nothing else in
     this file — it is not a general mock dumping ground.
   - `vite.config.ts` edit: add `test: { setupFiles: ['./src/test-setup.ts'] }`
     plus the one mechanical typing change the `test` key requires (either
     `/// <reference types="vitest/config" />` or switching the
     `defineConfig` import to `'vitest/config'` — worker's call). The
     `build.rollupOptions` block (T003's theme.css emission) must be
     byte-untouched; checker verifies `npm run build` still emits
     `dist/assets/theme.css` and the bundle-size gate stays green.

E. Delivery vehicle: ONE corrective task T006a (Epic E1, worker:
   worker-implementer, checker: checker-tests — deliberately a different
   checker than T006's checker-accessibility; this is test/CI-gate
   territory), dispatched immediately as a same-day fix per CI-break
   precedent. Allowed files: exactly `src/test-setup.ts` (new),
   `vite.config.ts` (scoped edit per D), `src/theme/theme.smoke.test.tsx`
   (scoped edit per C). Everything else forbidden — explicitly including
   `src/theme/volt.ts`, `src/App.tsx`, `src/app/**`, `src/components/**`,
   `package.json`, `.github/workflows/ci.yml`. Acceptance: `npm run test`
   exits 0 (full suite); build/typecheck/lint/format:check exit 0; the
   smoke test still renders the real App tree (no shallow/mock render);
   polyfill guarded and minimal; production build artifacts unchanged.
   Both fixes land in the one task — splitting them would leave CI red
   between tasks. Foreman-planner builds the packet verbatim from C/D/E;
   no further judgment calls are delegated.

F. Sequencing: T006 stays "In Progress". Ledger records check attempt 1 as
   FAIL (BLOCKER: required CI test gate red) with the notation that the
   FAIL is not a worker fault and no T006 rework exists — resolved via
   D003/T006a. T006 flips to Passed simultaneously with T006a's PASS: T006a's
   checker-tests run (`npm run test` green plus the other gates) IS the
   re-verification T006 is waiting on; no separate checker-accessibility
   re-run of T006 is required, since every accessibility/NAV/prop axis
   already passed on attempt 1 and T006a cannot touch T006's files.
   T007/T008/T016 remain blocked until T006 is Passed (i.e., until T006a
   passes). T006a's attempt counter starts fresh at 0.

Outcome:
Spec gap resolved (no task owned test infrastructure; the mandated wiring
inevitably invalidated a placeholder-era assertion). Test update to
theme.smoke.test.tsx explicitly boss-approved per the Non-Negotiable's own
override mechanism. Corrective task T006a directed with exact scope;
foreman-planner to write the packet and dispatch immediately. T006 held at
In Progress pending T006a PASS, then flips to Passed with no further
re-check. Constitution unchanged — its text already provided for exactly
this situation.

## D004 - T008 Packet-mandated `mobileNav={<MobileNav />}` wiring is non-functional in installed @astryxdesign/core@0.1.6; astryx-api.md's own example/prose is wrong for this version

Nature:
Worker-filed mid-task dispute (attempt 1, no checker verdict yet). The
worker built every T008 deliverable, then discovered the packet-mandated
`AppShell.tsx` wiring — `mobileNav={<MobileNav />}`, the exact ReactNode
shorthand astryx-api.md's own examples show (lines 2549 and 4703–4707) —
produces a drawer that can never open in the installed library version.
Per D001 precedent the worker flagged instead of silently deviating from
the packet's "exactly these two edits" instruction. This is a spec-defect
dispute (constitution item 1: conflicts are disputes, never improvised
around), not a worker/checker disagreement.

Worker position:
In `@astryxdesign/core@0.1.6`, passing `mobileNav` as a raw ReactNode sets
`mobileNavReactNode` non-null, which forces
`mobileNavEnabled = !mobileNavDisabled && hasNavContent && mobileNavReactNode == null`
to `false`, which makes `MobileNavToggle` render nothing and
`openMobileNav()`/`toggleMobileNav()` permanent no-ops — contradicting
astryx-api.md's prose that this usage is context-managed automatically.
Verified three ways: installed library source, CLI template output, and
live Playwright (zero toggle button in the DOM at any viewport). Proposed
fix: the `MobileNavConfig` object form,
`mobileNav={{ content: <MobileNav /> }}`. Separately disclosed (not
disputed): the drawer does not auto-close on nav-item selection, with no
exposed Astryx prop to change that.

Checker position:
None — escalated before check.

Boss decision (boss-arbiter, 2026-07-18):
All evidence re-verified independently against the installed package's own
shipped source (`node_modules/@astryxdesign/core/src/**`), the CLI, and
the repo's actual files — not taken from the worker's report:

1. Worker's core claim CONFIRMED. `AppShell.tsx` (installed source) lines
   539–540: `mobileNavEnabled = !mobileNavDisabled && hasNavContent &&
   mobileNavReactNode == null`. Lines 606–607 gate `toggleMobileNav`/
   `openMobileNav` on `mobileNavEnabled`; `MobileNavToggle.tsx` line 73
   returns `null` when `!isMobileNavEnabled`. The source's own doc comment
   (line 224) describes the ReactNode form as "Full escape hatch: provide
   your own `<MobileNav>` (you own everything)" — i.e. the shorthand
   INTENTIONALLY disables the shell's context state; the caller is expected
   to manage `isOpen`/`onOpenChange` and a trigger entirely themselves
   (the source's own example at lines 447–456 shows exactly that). The CLI
   template `MobileNavToggleBasic` confirms: it hand-builds a full
   `AppShellMobileContext.Provider` with manual `useState` rather than ever
   composing the shorthand with `MobileNavToggle`. astryx-api.md's prose
   ("Inside AppShell, use MobileNavToggle as the trigger; it reads state
   from context automatically", line 4698) and its examples at 2549/4703
   are wrong for the installed 0.1.6 when combined: the doc's ReactNode
   example and its MobileNavToggle prose describe mutually exclusive modes.

2. Worker's proposed fix CONFIRMED CORRECT as the mechanism, with one
   amendment (finding 3). `MobileNavConfig` (installed source, lines
   131–174) has fields `hasToggle?` (default true), `isOpen?`,
   `onOpenChange?`, `content?: ReactNode` ("Custom drawer content.
   Replaces the auto-generated drawer."), `breakpoint?` (default 'md' =
   768px — exactly NAV-05's threshold), `defaultIsMobile?`. With
   `mobileNav={{ content: <MobileNav /> }}`: `mobileNavEnabled` is true;
   the custom content renders below the breakpoint (line 816) and reads
   context state (`MobileNav.tsx` line 295: `isOpen = isOpenProp ??
   appShellMobile.isMobileNavOpen`) — the worker's component already
   correctly omits `isOpen`/`onOpenChange`, so no component change needed;
   the auto-generated drawer is suppressed (line 820 `!mobileNavConfigContent`),
   so exactly one drawer exists. The fix works.

3. NEW FINDING (mine, beyond the worker's report): the packet's OTHER
   mandated edit — `TopNav.tsx`'s `startContent={<MobileNavToggle />}` —
   becomes permanently dead code under the config form and must be
   REVERTED, not kept. With any non-ReactNode `mobileNav`, AppShell puts
   TopNav into "mobile-bar" render mode below the breakpoint (line 647),
   and Astryx TopNav's mobile-bar branch (installed `TopNav.tsx` lines
   201–221) renders ONLY `heading` + `endContent` + its own auto-injected
   `<MobileNavToggle />` (line 217, gated on config `hasToggle !== false`)
   — `startContent` is not rendered at all below the breakpoint, and at or
   above the breakpoint `MobileNavToggle` returns `null` (`!isMobile`). So
   the startContent toggle never renders in any state. The trigger users
   actually get is TopNav's own auto-injected toggle, rendered inside the
   real TopNav bar — which still satisfies NAV-05's "triggered from
   TopNav" literally and needs zero project code. The alternative
   (`hasToggle: false` + a manually-placed toggle) was checked and does
   NOT work for our layout: mobile-bar mode still drops `startContent`,
   and `hasToggle: false` also suppresses the auto toggle — no trigger at
   all. (astryx-api.md's `{ hasToggle: false }` example places the toggle
   in AppShell children, not TopNav — not our composition.)

4. Doc-gap ruling (differs from T002's "log only" treatment, deliberately):
   astryx-api.md documents NONE of `MobileNavConfig`'s fields — the
   `mobileNav` prop row (line 2591) says only "config object (tune auto
   behavior)" — so under constitution item 2 a checker would be OBLIGED to
   flag the authorized fix's `content` key as hallucinated (MAJOR). T002's
   TypographyRole gap needed no undocumented API to work around; this one
   does, so item 2's own machinery forces a doc amendment. astryx-api.md
   is an internal project doc (a vendored snapshot, not the third-party
   PRD): boss-arbiter has amended it with a clearly-marked, source-cited
   D004 annotation in the AppShell section (after the Props table) plus a
   one-line cross-reference in the MobileNav section — documenting the
   verified 0.1.6 `MobileNavConfig` fields and the ReactNode-shorthand
   trap. The vendor's original text is left in place and marked, not
   silently rewritten, so future doc-refresh tasks can diff cleanly.
   Constitution item 2 itself is UNCHANGED — astryx-api.md remains the
   sole prop source; it has simply been corrected.

Rulings:

A. Fix AUTHORIZED, amended from the worker's proposal per finding 3.
   Scoped continuation of T008 — same worker, same attempt (counter stays
   at 1; the worker is not at fault and no FAIL is recorded), delivered as
   an amended worker packet, not a new task. Exact scope:
   1. `src/app/AppShell.tsx`: change `mobileNav={<MobileNav />}` to
      `mobileNav={{ content: <MobileNav /> }}` (one line), plus
      module-doc accuracy edits only (the header comment's description of
      the trigger mechanism must describe the auto-injected mobile-bar
      toggle and cite D004).
   2. `src/components/nav/TopNav.tsx`: REVERT both T008 edits — remove
      `MobileNavToggle` from the import list and remove
      `startContent={<MobileNavToggle />}` — returning the file to its
      T006-passed functional state. The T008 doc-comment block may be
      replaced by a short note recording that NAV-05's trigger is
      auto-injected by Astryx TopNav's mobile-bar mode below 768px (cite
      D004), or removed entirely; no other changes.
   3. `src/components/nav/MobileNav.tsx`: module-doc edits only — rewrite
      the now-stale "KNOWN BLOCKER" block to describe the resolved
      config-object wiring, citing D004. Component logic unchanged
      (verified correct as-is: no `isOpen`/`onOpenChange`, context
      fallback works, `as={Link}` present, title effect load-bearing).
   4. Nothing else. `StudentHomeSlot.tsx`, `router.tsx`, `guards.tsx`,
      `SideNav.tsx` untouched.

B. Amended acceptance criteria replacing packet criteria 8–11 (all other
   packet criteria stand):
   - Below 768px, live (real dev server + Playwright + real sign-in):
     exactly ONE hamburger toggle in the DOM, inside the TopNav bar
     (Astryx auto-injected, default label 'Open navigation'); it opens the
     worker's MobileNav drawer; Escape, backdrop, and close button all
     close it; keyboard (Tab/Enter/Space) and touch paths verified —
     DES-17 remains BLOCKER-on-failure.
   - Exactly one drawer in the DOM (config content must suppress the
     auto-generated drawer — verify no duplicated nav item lists).
   - At >=768px, TopNav renders identically to its T006-passed state
     (revert verified by diff against git history).
   - `document.title` NAV-04 parity re-verified below 768px through the
     now-openable real drawer.
   - Checker note: `mobileNav={{ content: ... }}` is D004-authorized and
     documented in the D004-marked annotation now present in
     astryx-api.md's AppShell section — it is NOT a hallucinated prop.
     TopNav rendering in mobile-bar mode below 768px (heading + endContent
     + toggle; startContent/centerContent hidden) is the library's
     intended responsive behavior, not a regression — NAV-02's content
     (wordmark, season selector, user menu) all live in heading/endContent
     and remain present.

C. Drawer does NOT auto-close on nav-item selection: classified MINOR
   (follow-up, non-blocking), worker's disclosure accepted as correct
   handling. The only sanctioned lever (`useAppShellMobile`) is absent
   from astryx-api.md, so constitution item 2 forbids using it today; no
   workaround is authorized. Logged as a follow-up candidate for whenever
   astryx-api.md is legitimately refreshed (or upstream adds auto-close).
   The checker records the observed behavior in evidence; it does not fail
   the task on it.

D. Ledger: T008 stays In Progress, attempt 1. Orchestrating session /
   foreman dispatches the amended packet verbatim from Rulings A–C; no
   further judgment calls are delegated. Checker remains
   checker-accessibility, checking the full T008 including this amendment.

Outcome:
Spec defect confirmed against the installed artifact; packet's mandated
wiring vacated and replaced (Ruling A), including reverting the packet's
own now-dead TopNav.tsx edit. astryx-api.md corrected via marked D004
annotation (first correction of the vendored API doc — T002's "log only"
precedent distinguished, not overturned). Worker commended: correct
escalation under D001 precedent, and its three-way evidence held up fully
under independent re-verification. Constitution unchanged. Human decision
not required — the fix is source-verified against the installed library
and NAV-05's requirement is still met literally.

## D005 - T018 (incidental) Dark-mode `Button variant="primary"` text contrast measures ~4.04:1, below WCAG AA 4.5:1 — cross-cutting, also present in already-Passed T016

Worker position:
T018's worker did not touch this — the finding was made entirely by T018's checker, incidentally,
while independently measuring live contrast beyond the packet's explicit checklist. Not raised by
any worker.

Checker position:
checker-accessibility (T018 check, attempt 1) ran a pixel-level WCAG contrast measurement (not a
CSS-computed-style heuristic, which it first ran and discarded after finding it produced a
provably wrong result on this same page). Finding: the shared `Button variant="primary"` in dark
mode — navy text (`rgb(0,0,179)` / `#0000B3`) on the dark-mode accent background
(`rgb(155,123,255)` / `#9B7BFF`, `src/theme/volt.ts`'s dark-mode `--color-accent` token) — measures
~4.04:1 at 14px/weight-500 (not "large text" under WCAG's definition, which needs only 3:1).
WCAG AA requires 4.5:1 for normal-size text. All other measured text/banner/button pairs on the
page passed (7:1–13.6:1). The checker explicitly did not attribute this to T018: `AcceptInvitePage`
uses the same `Button variant="primary"` component and the same `volt.ts` theme tokens already
shipped on the already-Passed T016 `/login` page ("Sign in" / "Send reset link" buttons) — the
defect is in the shared component/theme, not anything T018 wrote, and is outside T018's Allowed
Files (`src/pages/accept-invite/**` only) to fix. Checker did not fail T018 for this and explicitly
recommended it be routed as its own cross-cutting follow-up.

Tension flagged, not resolved by the checker: this appears to be in some tension with two earlier
Passed verdicts:
1. T002's own acceptance criterion ("both light/dark accent-on-surface pass WCAG AA," DES-06) and
   its checker's contrast sign-off on `volt.ts` at the time — that check was of accent-on-surface
   backgrounds, not necessarily button-foreground-text-on-accent-background specifically, so it may
   not have covered this exact pairing.
2. T016's already-Passed `/login` screen ships the identical button/theme pairing today, unnoticed
   until now.
3. `volt.ts`'s accent hex values are BLOCKER-class verbatim-locked to PRD DES-03 (constitution item
   3) — a straightforward "just change the accent hex" fix may not be available without either a
   PRD/DES-03 amendment or a fix scoped to the `Button` component's dark-mode text-color logic
   instead of the theme token itself. Which lever is correct is a design/architecture call the
   checker was not positioned to make from within a single task's checker packet.

Boss decision (boss-arbiter, 2026-07-19):
All evidence re-verified independently against the real artifacts — the WCAG
math recomputed from scratch, the installed library's own source read
directly, and the shipped theme.css inspected — not taken from the checker's
report:

1. The checker's measurement is CORRECT. Independently recomputed WCAG 2.x
   relative-luminance contrast for `#0000B3` on `#9B7BFF`: 4.041:1 —
   matching the checker's ~4.04 exactly. Button md text is 14px/weight-500,
   which is "normal text" under WCAG's large-text definition (≥18pt, or
   ≥14pt bold), so the AA minimum is 4.5:1, not 3:1. The shipped pairing
   fails AA. Light mode independently confirmed fine: `#FFFFFF` on
   `#5B2EE5` = 7.078:1.

2. ROOT CAUSE (established from installed source, not inference): Astryx
   derives dark-mode `--color-on-accent` as tone 20 of the seed-accent HCT
   tonal palette and BAKES it as a resolved hex — the source's own comment
   (expandColorScale.ts lines 126–129) says "--color-on-accent stays baked:
   it is a contrast computation against the accent, which CSS cannot
   express." Running the installed hct.ts against DES-03's seed `#5B2EE5`
   reproduces the exact shipped values: derived dark accent P[80] =
   `#D6BAFF`, baked dark on-accent P[20] = `#0000B3`. That pair is
   self-consistent and passes AA handily (7.467:1). But DES-03's raw
   `tokens: {'--color-accent': ['#5B2EE5', '#9B7BFF']}` override replaces
   the dark background with a substantially darker violet (`#9B7BFF` ≠
   P[80] `#D6BAFF`) at defineTheme's highest precedence (defineTheme.ts
   step 2), while the baked on-accent foreground is NOT recomputed —
   producing the 4.04:1 mismatch. This is not an Astryx bug (its pipeline
   is internally consistent), not a T002/T016/T018 worker defect (all
   shipped exactly what their specs mandated), and not new: it has been
   latent in the theme since T002 and shipped/visible since T016a made
   /login reachable. It is a PRD-internal spec conflict — DES-03's exact
   token block vs DES-06's "Both modes must pass WCAG AA contrast" — of
   exactly the class constitution item 1 routes here.

3. Prior verdicts examined against their actual scope:
   - T002's PASS is NOT contradicted. Its packet criterion and evidence
     were accent-ON-surface (7.08:1 light / 4.81:1 dark, per the archived
     T002 checker packet) — accent-colored elements against page
     backgrounds. `#9B7BFF`-on-dark-surface genuinely passes (5.5–6:1
     recomputed). The on-accent-text-ON-accent-background pairing was
     never in its checklist. Scope gap in the criterion, not a false
     verdict.
   - T016's PASS contains one incorrect sub-claim: its evidence line
     "button-text pairs all pass" cannot be true for the dark-mode primary
     button (the baked pair is right there in theme.css line 218:
     `--color-on-accent: light-dark(#FFFFFF, #0000B3)` and computes to
     4.04). The claim is CORRECTED by this entry; the verdict is not
     vacated (see Ruling D).
   - T018's checker handled this exactly right: pixel-level measurement,
     discarded its own flawed first method, did not fail the task for an
     out-of-scope shared defect, routed it here. Commended — this is the
     model for incidental cross-cutting findings.

4. FIX LEVER (each alternative actually evaluated against the installed
   library):
   - Changing the brand accent hexes is REJECTED: `#5B2EE5`/`#9B7BFF` are
     DES-04's named brand palette (Volt Violet) and the core of the visual
     identity; a brand-color change is a George-level design decision no
     defect this size justifies forcing.
   - A Button-level override (theme `components:` map or CSS) is REJECTED:
     Button's documented theming vars expose no text color, and
     `--color-on-accent` is consumed by five installed components (Button,
     Badge info, CheckboxInput checked, RadioListItem inner dot, NavIcon)
     — a Button-only patch leaves four future surfaces broken, including
     DES-01's Bolt confirmation (text on accent flash).
   - The CORRECT lever is the theme-token override Astryx itself provides:
     `--color-on-accent` is a valid, typed `TokenName` (colorDefaults,
     tokens.stylex.ts line 27; `defineTheme` input `tokens?:
     Partial<Record<TokenName, TokenValue>>`), and explicit `tokens`
     entries are applied at highest precedence over the baked derivation
     (defineTheme.ts step 2, verified in source). One added line in
     volt.ts fixes every consumer at once — the same mechanism DES-03
     already uses one line above.
   - Authorized value: `['#FFFFFF', '#00008D']`. Light `#FFFFFF` is
     byte-identical to today's resolved value (zero light-mode change).
     Dark `#00008D` is P[10] of the same Astryx tonal ramp — the vendor's
     own palette one stop darker, preserving the intended navy-on-violet
     look — and measures 4.818:1 against `#9B7BFF` (recomputed
     independently), clearing AA. Interactive states verified safe: dark-
     mode hover/pressed overlays are white-alpha mixes (overlay-hover 5%,
     overlay-pressed 10% white, expandColorScale.ts), which lighten the
     background and only increase contrast against a dark foreground.
     Pure black (6.67:1) was considered and rejected as an unnecessary
     departure from the ramp; anything between P[10] and black remains
     available if the checker's pixel measurement lands under 4.5 (it
     should not — the math is exact and antialiasing was already accounted
     for by the T018 checker's methodology).

Rulings:

A. PRD deviation AUTHORIZED, narrowly: `src/theme/volt.ts` may no longer be
   byte-identical to DES-03's code block — the delta is exactly ONE added
   token line, `'--color-on-accent': ['#FFFFFF', '#00008D'],` (plus a
   one-line comment citing D005), inside the existing `tokens` map. Both
   DES-03/DES-04 brand accent hexes remain byte-untouched. Where two PRD
   requirement IDs conflict, constitution item 1 makes this a dispute for
   this office, and the Non-Negotiables resolve the tie twice over:
   "Accessibility … outrank[s] cosmetic preferences" and "Protected source
   text must remain verbatim unless explicitly approved" — this entry is
   that explicit approval (same override mechanism D003 used for the test
   Non-Negotiable). Unlike D002, no human-locked decision is being
   reversed (the brand palette, the stack, and the Astryx-only rule all
   stand), so no human gate is required; George is being informed in the
   ruling report and can veto before T002b dispatches. The PRD file itself
   remains unedited by design (D002 precedent); the standing verbatim
   check for volt.ts everywhere ("byte-identical to DES-03") is amended
   to "byte-identical to DES-03 except the D005-authorized on-accent
   line."

B. astryx-api.md AMENDED (D004 precedent, second marked correction): the
   Button section's Theming subsection now carries a D005-marked,
   source-cited annotation documenting that primary-variant text color is
   driven by the theme-level `--color-on-accent` token (baked by
   expandColorScale against the DERIVED accent, not raw token overrides)
   and that it is a valid `defineTheme` tokens key. Without this, T002b's
   checker would be obliged under constitution item 2 to flag the
   authorized fix as a hallucinated API — the same trap D004 closed.

C. Corrective task T002b (Epic E1, worker: worker-implementer, checker:
   checker-accessibility — the checker that found it and owns DES-06
   verification), forward-fix in the T002a/T006a/T016a pattern. Allowed
   files: exactly `src/theme/volt.ts` (the one authorized line + comment)
   and `src/theme/theme.css` (regenerate the generated block per that
   file's own header instructions — the baked `light-dark(#FFFFFF,
   #0000B3)` at line 218 ships to production via DES-07's built path and
   MUST move in lockstep with volt.ts). Everything else forbidden,
   explicitly including `package.json` (the volt.ts Prettier exclusion
   stays), `src/pages/**`, `src/app/**`, and all Astryx-installed files.
   Acceptance: volt.ts diff is exactly the authorized addition (rest
   byte-identical to DES-03); theme.css regenerated with
   `--color-on-accent: light-dark(#FFFFFF, #00008D)` and NFR-08 layer
   structure unchanged; build/typecheck/lint/format:check/test all exit 0;
   `dist/assets/theme.css` still emitted and the bundle gate green;
   pixel-level dark-mode re-measurement (T018-checker methodology, live
   Chromium) of the /login primary button text ≥4.5:1; light-mode /login
   spot-check unchanged (~7.08:1); computed-pair verification for the
   other on-accent consumers reachable today (Badge `info` at minimum);
   `#5B2EE5`/`#9B7BFF` confirmed byte-unchanged.

D. T016 and T002 verdicts NOT vacated; NO reopening (D002/D003 precedent:
   both passed the criteria they were given; the ledger stays
   append-only). T016's "button-text pairs all pass" evidence sub-claim is
   formally corrected by finding 3; T002b's PASS is the closing
   re-verification for the shipped defect on /login. T018 needed no
   correction of any kind. Forward-only.

E. Standing rule for all future checker packets (foreman to carry into
   templates): WCAG contrast checks MUST include foreground-on-accent
   pairings (text/icons rendered ON accent-filled surfaces) in both modes,
   not only accent-on-surface — the two are different measurements and
   this dispute is what the gap costs. Pixel-level measurement of the
   rendered artifact is the preferred method over token arithmetic when
   the two disagree.

F. Sequencing: T002b is dispatch-ready immediately (deps T002/T003 both
   Passed) and is a same-day-class fix — a live accessibility shortfall on
   the app's only reachable real page. It does NOT block T020/T021/T030/
   T034/T035/T038/T048/T056/T062 (independent files), but any NEW page
   task checked after T002b lands must be measured against the corrected
   token. Attempt counter starts at 0.

Outcome:
Checker's incidental finding CONFIRMED in full (4.041:1 recomputed
independently; below the 4.5:1 AA minimum for 14px/500 text). Root cause:
PRD-internal conflict — DES-03's raw dark-accent override silently
invalidates Astryx's baked on-accent contrast computation (verified against
installed expandColorScale/defineTheme source); DES-06 wins per the
constitution's accessibility Non-Negotiable. One-line theme-token fix
authorized (`--color-on-accent: ['#FFFFFF', '#00008D']`, Astryx's own P[10]
ramp stop, 4.818:1) via corrective task T002b; brand hexes untouched; PRD
file untouched; astryx-api.md given a second D004-style marked annotation.
T002/T016 verdicts stand with one evidence sub-claim corrected; forward-only
fix, no reopening. Constitution unchanged — item 1's dispute routing and the
Non-Negotiables' own override mechanism covered this exactly. Human decision
not required; George informed with veto opportunity before dispatch — George
approved dispatch 2026-07-19, no veto.

**D005 CLOSED 2026-07-19.** T002b Passed on its first attempt: `volt.ts`/
`theme.css` carry exactly the authorized one-line fix, and checker-
accessibility independently re-measured live pixel contrast on `/login`
from scratch (4.818:1 dark / 7.078:1 light), matching this ruling's
recomputed values exactly. No residual risk remains. Full close-out
evidence in `verification-log.md`'s `## T002b` entry and the archived
`docs/swarm/archive/T002b-{worker,checker}-packet.md`.
