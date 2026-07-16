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
