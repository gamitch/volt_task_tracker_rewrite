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
