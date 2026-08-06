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

## D006 - T134 packet §4's roster deliverable is unachievable in this environment (worker-filed, carried across by the orchestrator)

Nature:
Worker-filed dispute, T134 attempt 2. The packet asked for a fresh `/roster`
capture replacing a stale figure said to be missing the table's visible seams.
The worker could not produce it and, on attempt 1, shipped the error-state
screenshot instead while disclosing the problem in its output doc. Its checker
correctly failed that (MAJOR) and directed the dispute. Recorded here by the
orchestrator because `dispute-log.md` is forbidden to workers.

Worker position:
`/roster` cannot be captured with representative data in this environment.
`RosterShell.tsx` takes no props and renders `<StudentsTab />` bare, and there
is no `.env`, so `getSupabaseClient()` throws and every loader rejects. The page
renders "Couldn't load the active season" plus "Couldn't load students" — no
table, therefore no seams. The packet's §4 also says "change no code", so the
worker had no legal path to a populated capture.

Checker position:
Confirmed by viewing `t134-roster-1440-light.webp` directly. Judged the
attempt-1 overwrite a MAJOR on three grounds: it broke the convention of the
`new-*.webp` family (its sibling `new-roster-teams.webp` shows the same page
rendering normally, so a reader concludes the Students tab is broken); the
disclosure lived only in a doc bound for a gitignored archive; and the
replacement did not achieve §4's purpose anyway, since neither the old figure
(empty roster) nor the new one (error) shows the table.

Ruling (orchestrator, 2026-07-28):
Dispute upheld. The deliverable was impossible as specified. `new-roster.webp`
restored byte-identical; the four `t134-roster-*.webp` captures kept, since they
correctly discharge the "full chrome on /roster" proof the routing task actually
needed. Any future task needing a populated roster figure must be scoped with
either a configured backend or explicit authorization to change `RosterShell`.

**Correction to the premise, found after the ruling:** the tabs are not the
problem. `StudentsTab` (`:1064`), `ParentsTab` (`:939`), `TeamsTab` (`:1101`)
and `InvitesTab` (`:704`) each already expose an injectable `loadData` prop with
a real default. The only gap is that `RosterShell` accepts no props and passes
none down (`RosterShell.tsx:178`, `:204-207`). So the fix is a pass-through, not
a new seam — materially smaller than this dispute and D-2 both assumed. Note
also that a roster capture would still show the KPI strip's error, which is fed
by `SeasonProvider` in `AppShell`, not by this page.

## D007 - T133 packet self-contradiction: criterion 4 requires a UXC-01 assertion, criterion 10 forbids the test that would carry it

Nature:
Checker-raised (T133 review, MINOR). Not a worker/checker disagreement — a
defect in the packet, which is mine.

Position:
Criterion 4 required the `role="group"` accessible-name round-trip to be
"asserted ... Mirror `OutreachList.test.tsx:1520-1587`" — a citation to a test
file, i.e. an instruction to write a test. Criterion 10 pinned the suite at
exactly 1414 and permitted only one amended assertion, i.e. an instruction not
to add one. The worker resolved toward criterion 10 and proved the behaviour in
a throwaway rig instead. The checker independently confirmed the behaviour is
correct in both jsdom and Chromium, but noted that **30 of 31 tests still pass
against the pre-change component** — nothing in the suite would catch removal
of the wrapper.

Ruling (orchestrator, 2026-07-28):
The worker's resolution was correct: a numeric gate is unambiguous and an
instruction to "mirror" a file is not, so it read the stricter one. The packet
was wrong to state both. T133 stands as passed.

The gap is real and matters more here than it would elsewhere: T129 lost
accessible names on this exact pattern, and the protection against a recurrence
is currently a deleted rig. **Follow-up authorized:** add the two scoped
assertions to `CalendarPage.test.tsx` (populated + inner no-match branches,
selector scoped by heading id) as a pure addition, 1414 → 1416. To be folded
into the next task touching that file rather than dispatched alone.

Process note: when a packet pins an exact test count *and* asks for new
coverage, the count must be stated as the expected post-addition figure. Both
T132 and T134 got this right; T133 did not.

## D008 - T133 title weight moved 400 -> 600, mandated by the packet's own prescription while its criterion required "unchanged"

Nature:
Checker-raised (T133 review, NIT). Recorded so the next screen in this series is
consistent rather than re-deciding it.

Position:
§1 prescribed the exact JSX including `weight="semibold"`. Criterion 3 required
the title's rendered weight to be "unchanged". The calendar's pre-change title
was `weight` 400 (a plain `ListItem` string label); after, it is 600. The worker
followed the prescription and disclosed the delta accurately rather than
silently satisfying one clause or the other.

Ruling (orchestrator, 2026-07-28):
**The weight change is intended and accepted.** Criterion 3's "unchanged" was
written for the coach `Table` surface, where the title was already
`weight="semibold"` and the risk was that `Link` would alter it. On `ListItem`
surfaces the plain label was 400, so matching the coach rows necessarily moves
it to 600 — which is the parity UXC-04 exists to create. The same applies to
T132's student/parent rows, which moved 400 → 600 for the same reason and whose
checker measured it as achieving parity.

Canonical: a linked row title renders `weight` 600 / 14px / `--color-text-primary`
on every surface. Any future packet in this series should state that as the
target, not as "unchanged".

## D009 - NAV-08's `/meetings/:sessionId` route was never built, and CalendarPage links to it

Nature:
Orchestrator-found, 2026-07-28, while checking whether T135 should give meeting
rows linked titles for parity with the three surfaces that now have them. Not a
worker/checker disagreement — a gap between a PRD requirement and shipped code
that nothing had flagged.

Facts, each verified:
- `VOLT_Portal_PRD.md:89` (NAV-08) requires `/meetings/:sessionId` — "meeting
  detail page replacing the dialog in CAL-02".
- `router.tsx` declares 14 routes. `/meetings` is exact; there is no
  `/meetings/:sessionId` and **no catch-all**, so the URL matches nothing and
  `<Routes>` renders null — a blank content area.
- No meeting-detail component exists anywhere in `src/pages/meetings/`.
- `CalendarPage.tsx:604` links to it regardless: `detailHrefFor` returns
  `/meetings/${session.id}` for every meeting-type row. Its own module doc at
  `:188` notes no `routePaths` helper exists for the path and constructs it
  directly from NAV-08's quoted shape.

Why it surfaced now:
The link is pre-existing — T112 built it as a secondary "View details" link.
**T133 promoted it to the row title itself**, so a dead end is now the row's
primary affordance rather than a secondary one.

T133's checker reported "both routes live (2×`/meetings/:sessionId`,
2×`/outreach/:eventId`)". It verified the hrefs *render*; it did not verify they
*resolve*. That is a real gap in an otherwise strong check, and the lesson is
cheap to apply: **future nav/a11y criteria should require that a link resolves
to a declared route, not merely that it has an href.**

Ruling (orchestrator, 2026-07-28) — interim, pending George:
T135 ships **no** linked title on meeting rows, and its packet says why, so a
checker does not flag the inconsistency with the other three surfaces.

Options for George:
- **(a)** Build the meeting detail page. Implements NAV-08 as written. Own
  packet, comparable in size to T133.
- **(b)** Point calendar meeting rows at `/meetings` (or the live-console route
  where applicable). Cheap; leaves NAV-08 unimplemented but stops shipping a
  link to nowhere.
- **(c)** Log it, change nothing.

**DECIDED 2026-07-28 by George: option (b).** Calendar meeting rows point at
`routePaths.meetings` — a destination that exists — pending a real NAV-08 detail
page as its own task. Implemented as **T137**.

Disclosed consequence, accepted: all meeting rows now share one href, so the
calendar stops being a way to reach a *specific* meeting; clicking any of them
lands on the meetings list. Strictly better than a blank page, and reversible
the moment the detail page exists.

**Correction (2026-07-28).** An earlier revision of this entry claimed "row link
text is still the event title (T133), so rows remain distinguishable to sighted
and assistive users." **That was wrong, and the change is an accessibility
improvement rather than a wash.** Both fixture meeting sessions belong to the
same event, so their rows already rendered the identical accessible name
"Weekly Build Meeting" — confirmed in the live DOM by T137's checker. Before
T137 that was one accessible name pointing at *different* destinations, which
violates WCAG 2.4.4; after it, the same name points at the same destination,
which conforms. The rows were never distinguishable by name, and that is fine.

NAV-08 remains unimplemented and remains annotated as such in the PRD.

## D010 - the KPI views' "defense in depth" RLS claim rests on a false premise, and the mechanism it names does not do what it says

**Filed by the orchestrator 2026-07-29**, from a finding T140's checker made
outside T140's blast radius while closing an unrelated disclosure. **Needs
George's decision. Nothing has been changed.**

### What the migration claims

`supabase/migrations/20260723000000_kpi_views.sql:136-152` argues the KPI views
are safe for non-staff sessions on two grounds:

1. "Both views are plain (non-`security definer`/`security barrier`) views ...
   so both views already run under the querying session's own RLS against those
   base tables";
2. "`seasons` in particular has ONLY a `staff_all` read policy (no `read_all`
   ... equivalent), so a non-staff session querying `v_season_kpis` gets
   RLS-filtered to zero rows regardless of any UI-level role gate."

### Both are wrong

**Claim 2's premise is false.** `20260717000002_rls.sql:74-79` declares **two**
policies on `seasons` — `staff_all` (`for all to authenticated using
(is_staff())`) **and** `read_all` (`for select to authenticated using (true)`).
Any authenticated user can read `seasons`. Verified directly, and no later
migration alters or drops either policy. `SeasonProvider.tsx:76-84` carries the
same stale claim; that one is harmless because it draws no security conclusion
from it.

**Claim 1 is a misreading of Postgres view semantics**, and it is the one that
matters. A plain view does **not** evaluate base-table RLS as the querying
session. `security_invoker` defaults to **false**, so RLS on the base tables is
evaluated with the **view owner's** rights. Grepped across all 15 migrations:

- no `security_invoker` set anywhere;
- no `force row level security` anywhere;
- no `grant`/`revoke` in the KPI views migration.

Absent `FORCE ROW LEVEL SECURITY`, a table's owner **bypasses RLS entirely**.
Supabase runs migrations as a role that owns these tables, so the views are
owned by a role for which base-table RLS does not apply. The stated mechanism
therefore does not deliver the protection claimed for it.

### What is NOT established

**This is a code-reading finding, not a demonstrated vulnerability.** Nothing in
this container can reach George's Supabase project (see the session log's
environment facts), so the following are unverified and must not be asserted:

- the actual owner of the two views in the live project;
- the effective `grant`s on them, and therefore whether PostgREST exposes them
  to an `authenticated` (or `anon`) session at all;
- whether any of this is reachable in practice.

Supabase commonly grants `authenticated` SELECT on new `public` objects by
default, which is why this is worth settling rather than assuming benign.

**Real mitigation that does exist:** `KpiStrip.tsx` gates on role at the UI
level, so the app itself never issues this query for a student or parent. The
defect is that the migration's comment presents a *second, independent* layer
that is not actually there — so anyone relying on it is relying on nothing.

### How George can settle it in one query

Run against the remote project:

```sql
select c.relname,
       c.relowner::regrole            as view_owner,
       c.reloptions                   as view_options,   -- looks for security_invoker
       has_table_privilege('authenticated', c.oid, 'SELECT') as authenticated_can_select
from pg_class c
join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public'
  and c.relname in ('v_season_kpis', 'v_season_kpi_team_counts');
```

If `authenticated_can_select` is true and `view_options` does not contain
`security_invoker=true`, a non-staff session can read season-wide aggregates
directly, and the fix is `alter view ... set (security_invoker = on)` in a new
migration — plus re-deriving the RLS posture of every base table the views join,
since `read_all` on `seasons` means season rows themselves were never the
barrier.

### RESOLVED 2026-07-29 — fix the comment, leave the schema alone

**George's standing guidance: this is a small robotics team's app, not an
enterprise system. Keep it simple.** Re-reading the finding against that, the
proportionate answer is clear, and the earlier three-option framing overstated
the problem.

**What these views actually expose, read directly rather than assumed:** season
totals of volunteer hours by event type, a completed-events count, the most
recent event's title and date, the active-student count, and the season's goal
target. **No PII.** No names, no emails, no per-student rows, no contact
details, no tokens.

So the worst realistic case — a student's session queries the view directly
instead of going through the UI — shows them their own team's aggregate stats:
"the team logged 812 hours across 47 events." That is close to what a leaderboard
shows anyway, and it is not worth a schema migration, an RLS audit, or a
`security_invoker` change that could plausibly break the coach and admin path
that actually works today.

**Decision:**

- **Do not change the schema.** No new migration, no `security_invoker`, no
  re-derivation of every base table's RLS. The risk does not justify touching
  working auth machinery.
- **Do fix the false comment**, because a wrong security claim left in the tree
  is how a future decision gets made on a bad premise — which is exactly what
  happened here twice already. Scope: the two prose blocks in
  `20260723000000_kpi_views.sql:136-152` and `SeasonProvider.tsx:76-84`. Editing
  an already-applied migration's *comment* is still George's call, so this stays
  proposed until he says go.
- **Revisit only if the data in these views changes.** If a future task adds
  per-student rows, names, or anything identifying to `v_season_kpis`, this
  finding stops being cosmetic and the `security_invoker` question becomes real.
  Noted here so that change trips over this entry.

The diagnostic query above is kept for the record, but nobody needs to run it.

### CLOSED 2026-08-04 — option B: the correction rides in a NEW migration's header

**George's ruling:** *"let's go with B"*. The comment fix does **not** edit any applied migration.
Instead the next new migration's header carries the correction, citing this entry — so **constitution
item 10 is respected with no exception**, and the applied files continue to match exactly what the
database ran.

**No schema change.** The 2026-07-29 decision above is unchanged and was not reopened.

**Where it lands:** T503's migration (packet v2 §3 already requires it). The same header also corrects
the copy of the claim in `20260723000001_dashboard_views.sql:50-56`, which D010 did not know about.

**Third occurrence, and the reason this was worth closing rather than leaving proposed:** T503's
premise gate had to stand up a real PostgreSQL 16.13 to determine which of two contradictory comments
in this repo was true — `dashboard_views.sql` (false) against the leaderboard migrations (correct).
It also supplied by execution the evidence D010's diagnostic query was written to obtain: a view with
no `security_invoker` returned **3 rows** to a session whose direct table read returned **1**, and
`set (security_invoker = on)` collapsed it to 1. Evidence in `docs/swarm/active/T503-gate-report.md`.
**Nobody needs to run the diagnostic query now.**

**Standing calibration, applies beyond this entry:** proportion findings to this
project's actual stakes. Real risks here are losing student data, leaking PII or
credentials, and breaking auth. Aggregate hour counts visible to the team they
describe are not in that class.

## D011 - UXC-05's "zero default-accent bars" is not achievable with Astryx `ProgressBar`, and the fix I specified would have made accessibility worse

**Filed by the orchestrator 2026-07-29.** T144's worker built exactly what its
packet specified, then reported a contrast problem rather than shipping quietly.
**The work is built and committed but deliberately NOT merged.** Needs George's
decision.

### What happened

T144's ruling was: every `<ProgressBar>` is a *measurement*, not a *status*, so
use `variant="neutral"` at all ten sites. The worker implemented it, measured the
result, and reported that `neutral` fails WCAG 1.4.11's 3:1 non-text threshold.

I re-derived the numbers independently and **they are worse than the worker
reported**, because it measured against the unscoped `--color-background-muted`
while the real track is the `.astryx-progressbar`-scoped remap to
`--color-border-emphasized` (`theme.css:497-500`).

### Every variant, measured against the real track

Track: `--color-border-emphasized` — light `#AFA9B7`, dark `#4A4551`. Fill
values are the **progressbar-scoped overrides** at `theme.css:502-516`, not the
global tokens. Formula sanity-checked at 21.00 for black/white.

| variant | light | dark | ≥3:1 both? |
|---|---|---|---|
| `accent` (current default) | 2.00 | 2.03 | no |
| `neutral` (T144's ruling) | **1.39** | **1.43** | no |
| `success` | 2.20 | 1.85 | no |
| `warning` | 1.54 | 6.25 | no |
| `error` | 1.81 | 2.24 | no |

**Not one variant passes in both themes.** So:

- UXC-05's "zero default-accent bars" **cannot be satisfied** by choosing a
  different variant. This is the same class of vendor limitation as D-1 and as
  T136's fill-vs-fill ceiling — the palette cannot express the requirement.
- **My ruling would have made it measurably worse**, 2.00 → 1.39. The worker
  built what I asked; the specification was wrong.

For contrast, `GoalBar` — the component T136 built *because* `ProgressBar` cannot
do this — measures **3.33 light / 7.09 dark** (confirmed) and **5.47 / 4.67**
(planned) against the same track. It passes because we chose its colours.

### The part that is a real accessibility problem, independent of colour

Seven of the ten bars pass `hasValueLabel`, so the number is rendered as text and
the bar is a redundant visualisation — WCAG 1.4.11's "required to understand the
content" arguably does not bite.

**Three do not**, all in `CoachHome.tsx`: the team-hours, event-hours and
per-student hours bars. All three also set `isLabelHidden`. **On those three the
coloured fill is the only carrier of the value**, at 2.00:1 against its track.
That is a genuine gap, it exists today, and T144 did not create it.

### Options

- **(a) Leave the colours alone; add value labels to the three bare bars.**
  Fixes the real problem with text instead of colour, three lines, no colour
  decision needed, and unambiguously an improvement. UXC-05's clause gets
  recorded as unachievable with this component. **Recommended.**
- **(b) Convert these bars to `GoalBar`.** The only option that satisfies both
  UXC-05 and 1.4.11 properly. But `GoalBar` is pre-approved under F-3 for the
  two-fill case only, so this widens that decision, and it touches seven files.
- **(c) Merge T144 as built.** Satisfies UXC-05 on paper while dropping contrast
  to 1.39. **Not recommended** — it is a knowing regression.

**Recommendation: (a) now, (b) as its own task if George wants the bars in the
semantic system.** T144's branch is preserved unmerged pending that call.

### Process note

T144's packet forbade `GoalBar` as a substitute and ruled `neutral` correct. Both
were my calls and the second was wrong on the evidence. The worker followed the
packet, measured anyway, and reported — which is the only reason this was caught
before merge. The instruction that produced that outcome ("check the rendered
contrast; if it is not visible, report it — do not silently pick a different
variant to work around it") is worth keeping in future packets.

### D011 addendum (2026-07-29) — the "three bare bars" finding was wrong; there is no 1.4.11 gap

George approved option (a). Reading the three call sites to implement it showed
its premise is false, so **(a) was not implemented — there is nothing to fix.**

I tested for `hasValueLabel` and read its absence as "no text value." That was a
grep artifact. All three carry the number in adjacent markup:

| site | how the value is rendered as text |
|---|---|
| `CoachHome.tsx:1839` team hours | `endContent={<Text>{entry.confirmedHours}h</Text>}` on the same `ListItem` |
| `CoachHome.tsx:1868` event hours | `endContent={<Text>{entry.totalHours}h</Text>}` |
| `CoachHome.tsx:1895` per-student | sibling `<Text>`: `Xh confirmed + Yh planned = Zh / Goalh · P% · annotation` |

The third is the most thorough label of any of the ten. Adding `hasValueLabel`
would print a second copy of a number already on screen — "12 / 40" in the bar
beside "12h" in `endContent`. A clarity regression, not an improvement.

Re-checked the other seven; those do use `hasValueLabel` as reported. **So all
ten bars convey their value as text.** WCAG 1.4.11's "unless required to
understand the content" carve-out therefore applies to every one: the fill is a
redundant visualisation and its 2.00:1 ratio is not a conformance failure.

**Unchanged:** no variant reaches 3:1 in both themes (table above), `neutral` is
worst at 1.39, T144 stays unmerged, and UXC-05's "zero default-accent bars" is
still unachievable by variant swap — recorded as a vendor limitation alongside
D-1 and T136's fill-vs-fill ceiling. The bars are faint; that is a visual-quality
question, not an accessibility one, and it needs no urgent change.

**Process:** the original entry asserted a gap from the absence of one prop
without reading the surrounding JSX, and I presented it as the recommended fix.
Presence of a rendered value is a question about the whole subtree, not one
attribute. A checker's grep would have reproduced my error exactly.

## D012 - T145's packet asserted a false citation, the worker wrote it into the code, and the checker caught it

**Filed by the orchestrator 2026-07-29.** Not a worker/checker dispute — the
checker was right, the worker did as instructed, and the instruction was wrong.
Recorded because it is the second instance this session of the same error shape.

### What happened

T145 existed to remove a comment in `EventsTab.tsx` that stated false history.
My packet directed the worker to correct it and, in doing so, asserted that the
comment's citation to `CoachHome.tsx` "~1191" had been wrong even when written.
The worker wrote that into the replacement comment. It is false.

Verified at `48fcd90` (T058, the commit that introduced the NOTE): line 1191 is
exactly `const EVENT_TYPE_BADGE: Record<EventType, ...> = {`, followed by
`meeting: 'blue'`, `outreach: 'purple'`, `competition: 'teal'`. **Line number
correct, all three colours correct — the citation was fully accurate when
written.** It went stale only at T080 (`82fafdf`), which both corrected the
mapping to purple/blue/orange and moved the constant to ~1210.

So the task meant to delete false history replaced it with different false
history. The checker caught it by opening the commit — which is the step I
skipped when writing the packet.

The companion claim, that `CalendarPage.tsx`'s "577-586" was wrong, is also
overstated: the constant spans 580-587 there, so the citation brackets the right
construct a few lines off.

### The pattern

Both of this session's orchestrator errors have the same shape — **a fact about
code asserted from a partial read, then propagated with confidence**:

- **D011:** concluded three bars had no text value from the absence of one prop,
  without reading the surrounding JSX. All three render the value in `endContent`
  or a sibling `<Text>`.
- **D012 (here):** concluded a line citation was wrong without opening the commit
  it referred to. It was correct at the time of writing.

In both cases the erroneous claim was specific, plausible and confidently framed,
which is what made it survive into a packet and, here, into shipped source. In
both cases a checker or a direct read caught it only afterward.

### Directive

Packets must not assert that a citation, comment or historical claim is wrong
unless the author has opened the referenced commit or file region and looked.
"This looks stale" is a prompt to check, not a finding. Where a packet asks a
worker to correct a factual claim, the packet must carry the evidence for the
correction, not merely the assertion — and workers should treat an unevidenced
"X is wrong" in a packet as something to verify before writing it into source.

Corollary, from D011: whether something is rendered is a question about the whole
subtree, not about one prop. A grep for an attribute is a way to find candidates,
never a way to conclude absence.

### Outcome

T145 FAIL stands; rework issued for the false clause and for a second, unrelated
MAJOR (the legend proof does not exercise the legend — it passes with zero legend
badges rendered). T145's other criteria passed and are unaffected.

---

## D013 - T503 widens `rsvps` SELECT beyond PRD 8.3, on the owner's explicit ruling (the D002 pattern)

**Filed by the orchestrator 2026-08-04**, before any code was written, because
**constitution item 3 makes this a BLOCKER unless it is recorded**: *"RLS
policies and metric SQL come **only** from PRD Section 8.4, copied verbatim.
Re-deriving either … → BLOCKER."* T503's premise gate caught that the T503
packet had omitted this entirely. **This entry is the record that makes the
deviation authorised rather than a violation.**

### What the PRD says, and what is being built instead

`VOLT_Portal_PRD.md` §8.3's `rsvps` row reads:

| rsvps | full | **read/write own** | read linked; write linked (responded_by=self) |

T503 widens the **read** half to *any authenticated user may read any row*. The
write half is **unchanged** and stays exactly as 8.3 specifies.

### The authority

Two owner rulings, both verbatim in `auto-mode-decisions.md`:

1. **2026-08-03** — *"for T503, it is ok if students see other teammates rsvp's
   they often want to know which freinds are coming to an event and we quite
   frankly do that currently through thumbs up in chat."* — settles that
   students **should** see teammates' RSVPs.
2. **2026-08-04** — *"let's go with the first option, anyone on the team"* —
   settles the **scope**, chosen from three put to him in plain language.

### Why this is the D002 pattern and not a PRD edit

Constitution item 8 records React 19 as *"an approved, human-authorized deviation
from PRD D2's 'React 18' … The PRD text itself is intentionally unedited; D002 is
the record of the deviation."*

**Same shape here. The PRD text is NOT to be amended** — no owner entry
authorises editing it, and editing it would destroy the record of what was
originally specified. This entry plus the two decision entries are the authority;
the migration header cites them.

**For checkers:** a `rsvps` SELECT policy that does not match 8.3 verbatim is
**expected** on and after T503, and this entry is why. It is not an item 3
violation. **Every other policy on every other table still comes from 8.4
verbatim, and this exemption extends to nothing else** — in particular not to
`rsvps`' write policies and not to `attendance`, which T306 deliberately
staff-gated.

### The defect it fixes, for the record

Under 8.3's read rule, `OutreachDetail`'s Signups section shows **every teammate
under "No response"** to a student viewer, because it diffs the roster against
the rsvps RLS lets it see and treats "not permitted to read" as "did not answer".
That is a false statement on screen, not a privacy protection.

### Blast radius, proven rather than argued

T503's premise gate stood up a real PostgreSQL 16.13 with this repo's migrations
and measured it: the planned-hours views (`v_planned_rsvp_hours`,
`v_student_planned_hours`, `v_season_upcoming_committed_hours`) return
**byte-identical rows before and after** the widening, because a view without
`security_invoker` executes as its owner and never applied the querying user's
RLS to begin with. It re-ran the check with a **NOSUPERUSER, NOBYPASSRLS** owner
to confirm the result holds on hosted Supabase a fortiori.

### This is the THIRD time that same false claim has been found in this repo

`20260723000001_dashboard_views.sql:50-56` asserts its views *"run under the
querying session's own RLS against its base tables"*. That is false, and it is
the same claim **D010** filed on 2026-07-29 about
`20260723000000_kpi_views.sql:136-152` — **a dispute still open and awaiting
George's decision.** The leaderboard migrations
(`20260731000000:33`, `20260803000001:25`) state the correct owner-semantics
reading, so the repo has contradicted itself in writing for over a week.

**T503's gate has now supplied by execution the evidence D010 was missing.**
Recommend closing D010 on that evidence rather than re-deriving it. **Item 10
forbids editing an applied migration**, so neither comment may be corrected in
place; the correction belongs in a new migration's header.

---

## D014 - MET-01's denominator changes from eligibility to explicit marks, on the owner's ruling (the D002/D013 pattern)

**Filed by the orchestrator 2026-08-05**, before any code, because **constitution item 3 makes this a
BLOCKER unless recorded**: *"RLS policies and metric SQL come **only** from PRD Section 8.4, copied
verbatim. Re-deriving either … → BLOCKER."* This entry is what makes the change authorised rather than
a violation.

### What the PRD says, and what replaces it

`VOLT_Portal_PRD.md:563`, **MET-01**, normative:

> Student participation % (season) = `present+late marks` ÷ (`completed meeting sessions in season, in
> the student's team scope, while student active` − `excused marks`) × 100.

The denominator is **eligibility** — every completed, `counts_participation` session the student was in
team scope for while active. `20260717000003_metric_views.sql:22-41` implements exactly that, via a
cross product of eligible students × completed sessions with `attendance` LEFT JOINed.

**It becomes:** `present + late` ÷ (`present + late + absent` − `excused`) × 100, over the sessions
where that student **has an attendance row**. Sessions with no row for that student do not count.
Denominator floor 1 and the `—` display rule survive; `—` now also covers a student with no marks at
all. **`counts_participation=true` still gates which sessions qualify.**

### The authority

`auto-mode-decisions.md`, **"2026-08-05 — George rules on absence marking and MET-01"**, three verbatim
rulings plus his *"leave as is"* on legacy rows.

### Why this is not a preference

The orchestrator proposed keeping eligibility and scoping meetings by `events.team_ids`, which the view
already honours. **The owner corrected it:** the sub-teams that determine who is expected — business,
build, software — sit *below* `teams` (P3, Gear Girls) and are **deliberately unmodelled**, to keep the
app simple.

**Expected-attendance is therefore not derivable from any data this app holds**, and an eligibility
denominator asserts knowledge the schema does not have. Marks become the only honest source.

### The known cost, recorded so it is not rediscovered as a bug

This **inverts the failure direction**. Today, forgetting to mark makes participation look *worse* than
reality; under marks-only it looks *better*, because unmarked students drop out of their own
denominator. RPT-02 mitigates it by displaying `expected / present / late / excused` beside the % — a
`100%` backed by `2 expected` is visibly thin. **If RPT-02 ever stops showing those counts, this
trade-off breaks and D014 must be revisited.**

### Same shape as D002 and D013

The PRD text is **deliberately not amended**. This entry plus the decision record are the authority, and
the migration header cites both. For checkers: a `v_student_participation` that does not match 8.4
verbatim is **expected** from this task onward, and the exemption covers **that view and MET-01 only** —
not `v_student_hours`, not MET-02's aggregation shape beyond the denominator it inherits, and nothing on
the volunteer-hours side.

## D015 - T510 packet's dropped-session removal sequence: item-19a rounds exhausted, arbiter rules per-session pairing

**Filed and ruled by boss-arbiter, 2026-08-06.** Escalated by the orchestrator after T510's packet
(`docs/swarm/active/T510-worker-packet.md`, v2 at `ceb1ce2`) consumed both `checker-premise` rounds
(item 19a) and both returned REVISE. Two different gate agents ran; neither wrote the packet. Worker
attempt count: 0 — this is a gate-rounds exhaustion, not a worker/checker loop, so the Loop Limit's
three-failure rule does not apply; the Dispute Rule does.

Worker position (here, the packet's — the foreman's v2 design):
Removal of dropped future sessions runs batched: (a) still-future guard query, (c) batched
`attendance` pre-check, (e) batched cancel for attendance-bearing sessions, (f) batched
`delete from rsvps where session_id in (:toDelete)` then batched
`delete from event_sessions where id in (:toDelete)`, with a residual `23503` fallback that cancels
the WHOLE `toDelete` batch. AC9 Branch D asserts the fallback path's promise resolves.

Checker position (gate round 2, proven in a live scratch Postgres cluster with all 24 migrations):
The batched fallback IS the data loss. Nothing in the schema references `rsvps`, so the rsvps delete
can never raise `23503`; the `23503` can only come from the SECOND call — by which time every batched
session's RSVPs are already gone in a separately-committed PostgREST transaction. Branch D then
cancels the whole batch, leaving innocent sessions visible as `canceled` with their RSVPs destroyed
(cluster output: `S5 | canceled | rsvps_left 0 | att 0` for a session that never had attendance).
Reachable in ordinary operation because `loaders/attendance.ts` has no `starts_at`/`now` guard — a
coach can pre-mark attendance on a still-future session from the LiveConsole while another coach
narrows the series. Separately: the packet's own AC9 Branch D would certify this defect green, since
it asserts only that the promise resolves, never that any RSVPs survive. The gate offered three fixes
(capture-and-restore; per-session pairing; a `security definer` RPC) and chose none.

Boss decision:

**1. The checker is right on the defect, and I verified its premises independently rather than
taking either side's word:** `rsvps` is referenced by no FK anywhere under `supabase/migrations/`
(its delete cannot `23503`); `attendance.session_id` and `rsvps.session_id` are both
`on delete restrict` against `event_sessions` (`20260717000000_scheduling_attendance.sql:69,84`);
`rsvps` carries `unique (session_id, student_id)` (`:75`); `loaders/attendance.ts` contains zero
occurrences of `starts_at`, `now(`, `new Date`, or `Date.now`. PostgREST commits each request as its
own transaction, so v2's two batched deletes cannot be atomic. v2's AC9 Branch D is a test that
passes while the data is lost — the exact vacuous-assertion class this project has caught before.

**2. Ruled path: PER-SESSION PAIRING (the gate's option 2), minimal delta from v2.** Steps a-e of
§4b step 6 stand unchanged — the batched still-future guard, the batched attendance pre-check, and
the batched cancel (whose keep-the-RSVPs semantics are preserved for every pre-check-detected
session). Only step f changes. For each id in `toDelete`, as an independent pair:

  f1. `delete from rsvps where session_id = :id` (RSVPs first — the owner's own ordering). If this
      fails with ANY error, do not attempt this session's delete; the save rejects.
  f2. `delete from event_sessions where id = :id`. On `23503` (attendance raced in, or a fresh RSVP
      raced in behind f1 — cancel is correct either way, and a fresh RSVP survives attached to a
      canceled session): `update event_sessions set status = 'canceled' where id = :id` for THIS id
      only. If that cancel itself errors, the save rejects — never swallow it. Any non-`23503`
      error: the save rejects.

  Cross-pair sequencing (sequential, or `Promise.all` over pairs — pairs touch disjoint rows and are
  independent) is the foreman's choice, but v3 must state which and align AC9's Branch D/E
  assertions to it. If parallel: a rejected pair rejects the save while sibling pairs may still
  complete — the same disclosed non-atomicity class the packet already carries for "events insert
  succeeds, sessions insert fails."

**Why this path, against each alternative:**

- **vs v2 (batched + batch fallback):** the blast radius drops from "every session in the batch" to
  "at most the one raced session," and the bound is enforced by the database's own FK — not by
  client code surviving to run a compensation step.
- **vs option 1 (capture-and-restore): REJECTED.** It is RLS-feasible (`staff_all on rsvps` is
  `for all ... is_staff() with check (is_staff())`, `20260717000002_rls.sql:197-199`, so a staff
  client can re-insert other students' rows) — but the primary path still deletes the whole batch's
  RSVPs before any session delete, meaning the only copy of live production rows is a browser tab's
  memory for the duration of the window. A closed tab, a navigation, or a network failure
  mid-restore loses everything, invisibly. And the restore-insert is itself failable: a student
  re-RSVPing to a batched session inside the window collides with `unique (session_id, student_id)`.
  A failable compensation for a failable operation, with a worst case strictly worse than option
  2's, at higher complexity.
- **vs option 3 (`security definer` RPC): REJECTED for T510, declared not absorbed.** It is the only
  fully atomic fix, and the gate was right that it must be escalated rather than smuggled — this
  entry is that escalation, and the owner may veto toward it. It is rejected on proportionality
  (item 25's spirit; the owner's standing "keep it simple"): it converts a race whose window is the
  sub-second gap between the attendance pre-check and that session's own delete — and whose worst
  case under pairing is "one coach-condemned session lingers as Canceled," which is the owner's own
  ruled fallback outcome — into a migration, an opus worker (item 18), an owner-applied cutover
  (item 16), and a §5/§6 rewrite. If a later migration wave touches this area (T606 already needs
  one), an atomic removal RPC may be reconsidered there on its own row.
- **vs option 4 (narrow to cancel-only): REJECTED outright.** It would overturn the owner's
  explicit, twice-confirmed ruling that dropped sessions VANISH and that `canceled` keeps meaning
  "a coach cancelled this on purpose" (auto-mode-decisions.md, "Sessions dropped by a narrowing
  edit are DELETED, RSVPs first" and "George closes out T510's design," Check 01). An arbiter does
  not overturn the owner, and there is no need to ask him: pairing delivers his rule set verbatim.

**3. The residual, stated so it is a disclosure and not a discovery:** if attendance lands between
the pre-check and that one session's delete, that session ends `canceled` with its RSVPs already
deleted. This satisfies the owner's fallback ruling verbatim ("the delete must fall back to
cancelling rather than failing the coach's save"), and the RSVP deletion that precedes it is the
owner's own ruled step one of dropping. The keep-the-RSVPs nicety remains for every pre-check-
detected case (Branch B). This is a disclosed limitation, not a deferred defect — no item-20 ledger
row is required — but it MUST appear in v3's Known Risks and the worker output's known-risks list.

**4. AC9 is rewritten to the pairing design (mandatory; supersedes round 2's version of the
complaint):**
- Branch A (clean): for each no-attendance id, the fake client shows that id's OWN rsvps delete
  strictly before that id's OWN session delete; no `event_sessions.update` for it.
- Branch B (unchanged): pre-check returns the id → batched cancel; `rsvps.delete` is NEVER called
  for it.
- Branch C (unchanged): an id absent from the still-future result reaches no subsequent call.
- Branch D (rewritten, the load-bearing one — at least TWO pairs in flight): session X's delete
  rejects `{ code: '23503' }`, session Y's resolves. Assert: X receives
  `update({ status: 'canceled' })` and X ONLY; Y is genuinely deleted and receives NO update; Y's
  rsvps delete is its own paired call, unconditioned on X's failure; no batch-wide cancel occurs
  anywhere; the promise resolves. The assertion that certifies the fix — Y's fate is independent of
  X's — is exactly what v2's Branch D lacked.
- Branch E: a non-`23503` error on any pair (either half) → the promise rejects; assertions on
  sibling pairs match the sequencing choice v3 states.

**5. The nine other round-2 revisions, ruled by class** (the arbiter was given severities, not
texts; the foreman holds the findings): the AC9 rewrite (covered above) and the one MAJOR land in v3
before dispatch — the constitution's decision rule lets a boss defer a MAJOR only knowingly, and I
will not blind-approve deferring one I cannot read. The seven MINOR/NITs land in v3 by default: a
packet is consumed at dispatch, so a packet correction deferred is a correction never made, and any
MINOR that corrects a fact a worker would cite (a line number, a count, a citation) MUST land —
item 19c's lesson. The foreman may accept an individual MINOR/NIT as-is only with a one-line reason.
**v3's §0 gate history must carry a disposition line for every round-2 label** (landed / accepted
as-is + reason), so this ruling is auditable against findings the log does not itself contain.

**6. Dispatch after v3 — what stands in for the gate round that no longer exists.** Item 19a's two
rounds are spent and its economics are respected: no third premise round runs. But the Definition of
Ready's first condition exists to guarantee no plan reaches a worker checked only by its author, and
that principle survives the cap. Mechanism: the foreman revises to v3; a FRESH `checker-premise`
instance (a third agent — not the foreman, not either prior gate) runs a LIGHT check under item
19b's own scoping, with a conformance-only charter: does §4b step 6 match this ruling's sequence
exactly; does AC9 match the branches above; did the MAJOR land; does §0 carry the full disposition
table. It re-opens nothing the two full rounds settled — item 19b says settled premises are not
re-audited. On conformance it returns DISPATCH, satisfying Definition of Ready item 1 literally; a
REVISE from it returns to the arbiter, not into a loop; a NEW finding outside its charter is
reported to the arbiter without a verdict. This is an interpretation of items 19a/19b recorded here
— the constitution's text is deliberately NOT amended; if the owner wants this mechanism ratified
into 19a, that is his edit to authorize.

Outcome:
Packet returns to the foreman for v3 per this entry. No worker dispatched by this ruling. The
constitution is not modified. The owner's T510 rule set is preserved verbatim — no migration, no
design change, and nothing here needs his input; the RPC option is declared above for his veto or
later opt-in, and the decisions log carries a dated pointer entry he will read.

## D016 - T510 follow-on to D015: the ruled f1/f2 pairing and the ruled time guard interact to create a silent zero-row orphan; arbiter orders the select-and-route fix

**Filed and ruled by boss-arbiter, 2026-08-06.** Raised by the D015 §6 conformance check on packet v3
(`6da5574`) as a NEW finding outside its charter, reported without a verdict exactly as D015 §6
prescribes. The conformance verdict itself was DISPATCH on all four questions and is NOT disturbed by
this entry — v3 conforms to D015; the defect ruled on here is D015's own, not the foreman's.

Worker position (the packet's, v3 — which implements D015 faithfully):
Step f runs per-id: f1 `deleteRsvpsForSession(id)`, then f2 `deleteSessionIfStillFuture(id)` —
`.eq('id', id).gt('starts_at', 'now')`, the chained server-side guard the D015-required MAJOR landed.
On `23503`, cancel that id. v3's comment (`:605-608`) presents the guard's zero-row outcome as purely
protective.

Checker position (conformance instance, proven in a live cluster against v3 as written):
If a session's `starts_at` crosses `now` between step a's batched guard and that id's own f2 — a
window of three-plus round trips, not sub-millisecond — f2 matches ZERO rows and raises NO error.
`runMutation` resolves on `{ data: null, error: null }` (`src/lib/supabase/loader.ts:203-227`,
verified: it throws only on `result.error`). No `23503`, so no cancel; no rejection; the save reports
success. But f1 has already run. End state, from the cluster: `scheduled | rsvps_left 0 | att 0 |
past` — an ordinary-looking scheduled session whose RSVPs are silently gone. A control run without
the chained guard deletes the session cleanly: **the guard is what creates the state.** Worse than
D015 §3's accepted residual on three axes: silent, invisible (v2's victims at least read `canceled`),
and absent from v3's Known Risks.

Boss decision:

**1. The finding is confirmed, and the fault is D015's, not the foreman's.** D015 §2 ordered f1
before f2 (the owner's RSVPs-first ordering); D015 §5 ordered the chained-guard MAJOR landed. Each is
correct alone; together they turn the guard's "affect zero rows rather than delete a protected
session" semantics into "leave a session whose RSVP data was already destroyed, and say nothing."
Verified independently before ruling: `runMutation`'s resolve-on-null behavior; the cluster
reproduction; the installed `@supabase/postgrest-js@2.110.7` supporting `.select()` after `.delete()`
(`node_modules/@supabase/postgrest-js/src/PostgrestTransformBuilder.ts`, `select<...>` on the
transform builder every mutation builder extends).

**2. Ruled fix: the checker's remedy 2 — detect at the destructive call, route to the ruled
fallback.** f2 becomes `.delete().eq('id', id).gt('starts_at', 'now').select('id')`, and its helper
inspects the result: empty (`[]`/`null`) means the guard fired after f1 had already acted — or the
session no longer exists at all (concurrently removed; indistinguishable over PostgREST and benign
either way) — and routes to the SAME `cancelSession(id)` D015 already blessed, which on a
nonexistent id updates zero rows and resolves. Non-empty means the session was genuinely deleted.
The `23503` branch is unchanged (`.select()` does not alter error surfacing). Two lines and one
helper-shape change; no migration, no new dependency, no tier change, no escalation.

**Remedy 1 (zero-code, disclose only) is REJECTED.** D015 §3's residual was accepted because its
outcome is visible (`canceled`) and matches the owner's own ruled fallback. This one reports success
while leaving a session that lies on screen — an ordinary `scheduled` meeting whose RSVP data was
destroyed. The Non-Negotiables rank data integrity and honest on-screen values above the cost of two
lines. Not close.

**3. `cancelSession` stays time-UNGUARDED, deliberately — do not "harden" it.** A symmetric
`.gt('starts_at', 'now')` on the cancel would silently no-op in exactly the raced case and re-open
this hole one call later. The cancel is the repair path; its entire purpose is to mark a session
whose RSVPs were already destroyed. v4 must state this in the code comment so no worker or checker
adds the symmetry back.

**4. The rule-1 tension, addressed rather than glossed:** canceling a session whose `starts_at`
crossed into the past mid-save does "touch" a past session. Ruled acceptable, and required: the
future-forward DECISION POINT is step a's server-side guarded read at save time — the coach's
confirmed intent to drop this session was formed and verified while it was strictly future. f2's
chained guard is defense-in-depth, not a second decision point. Once f1 has irreversibly acted, the
choice is between a session that claims to be an ordinary scheduled meeting with its RSVPs silently
gone, and the owner's own ruled fallback state, visibly canceled. The second is the least-false
state, and the session in question is one the coach dropped seconds earlier — the owner's "a
forgotten session can still be ended late" trade-off is not meaningfully implicated.

**5. Consequential packet requirements for v4 (foreman's edit, not mine):**
- **f-step helpers get explicit `runMutation` definitions** (the conformance check's smaller item,
  now MANDATORY rather than derivable): f2's return value is load-bearing, so
  `deleteSessionIfStillFuture` must carry a concrete result type (the `.select('id')` row array,
  zero-rows checked as `(data ?? []).length === 0` per `runMutation`'s null-coercion at
  `loader.ts:220-225`), alongside definitions for `deleteRsvpsForSession` and `cancelSession`,
  matching the batched precedent's explicitness.
- **AC9 gains Branch F**, mirrored on Branch D's two-pair independence shape: session X's guarded
  delete resolves `{ data: [], error: null }` while session Y's resolves with its row → assert
  `cancelSession` is called for X and X only; Y is genuinely deleted with no update; the save
  RESOLVES. Branch A additionally asserts the delete chain ends `.select('id')` and treats the
  returned row as success. Prove-it-can-fail: a named mutation (drop `.select('id')` or the
  empty-result routing) turns Branch F red.
- **The fake-client mirror** covers the full chain depth `delete → eq → gt → select` (the cited
  precedent is one filter deep), and the citation is corrected to `TeamsTab.test.tsx:1184-1194`
  (19c: a citation a worker will rely on must be true). There is no in-repo precedent for
  `.delete().select()`; the packet cites the installed source
  (`node_modules/@supabase/postgrest-js/src/PostgrestTransformBuilder.ts`) directly, the same
  verified-against-installed-artifact posture it already uses for `AlertDialog.d.ts`.
- **Known Risks merges the two triggers into ONE residual class:** a session raced at its own f2
  ends `canceled` with its RSVPs already deleted, whether the race was attendance/fresh-RSVP (the
  `23503` path) or the time boundary (the zero-row path). With this fix the two outcomes are
  identical and identically visible; both routes are disclosed in the packet and the worker output.

**6. Dispatch after v4 — the D015 §6 instrument, charter narrowed to this entry.** The DISPATCH on
D015's four questions stands and is not re-litigated. A fresh gate instance answers five conformance
questions only: (Q1) f2 chains `.select('id')` and empty-result routes to the time-unguarded cancel;
(Q2) AC9 Branch F present with the independence assertion and a named red mutation; (Q3) the three
helpers have explicit definitions with f2's concrete result type; (Q4) mirror chain depth and the
`:1184-1194` citation corrected; (Q5) Known Risks carries the merged two-trigger residual. DISPATCH
satisfies Definition of Ready item 1; REVISE returns to the arbiter; a new finding outside the
charter comes to the arbiter without a verdict, exactly as this one did — the channel worked and is
retained unchanged.

**7. For the record, the orchestrator's self-reported Q4 gloss:** its dispatch to the checker
parenthesized round-1 labels (B1-B3, M1-M4, m1-m10) where D015 §5 requires round-2 labels. The
checker judged against the ruling's text over the dispatch's paraphrase and flagged the discrepancy
instead of silently picking one. That was correct on both counts, no ruling needed: v3's nine-row
round-2 disposition table is what D015 requires, and Q4 conforms. Noted because it is the same
lesson as D015's own verify-don't-relay posture: the ruling text, not the relay, is the standard.

Outcome:
Packet returns to the foreman for v4 per §5 above. No worker dispatched by this ruling. The
constitution is not modified. No owner input required: the fix produces the identical outcome class
the owner already ruled acceptable, at a cost of two lines and one test branch. D016 does not reopen
D015's path choice — a per-session pair whose failure modes all terminate in "visibly canceled, save
honest" is the design working as ruled; this entry closes the one failure mode that terminated
somewhere silent.
