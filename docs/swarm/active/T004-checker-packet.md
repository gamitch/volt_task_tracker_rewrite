# Checker Packet: T004 (CI pipeline)

## Task ID
T004 — attempt 1 — checker: checker-tests

## Objective Being Checked
Add a real GitHub Actions CI workflow (typecheck/lint/unit test/build, all real-fail on error, NFR-01) plus a bundle-size gate enforcing NFR-04 ("initial route JS < 300 KB gz"). Full worker packet: `docs/swarm/active/T004-worker-packet.md`. Worker's self-report is summarized below — **do not trust any of it without independent verification.** Every numbered claim must be checked against the actual repo state.

## Allowed Files (for this task)
- `.github/workflows/ci.yml` (or an equivalently named file under `.github/workflows/`)
- `package.json` — `scripts` section only

## Forbidden Files
- `docs/swarm/**`, `.claude/**`
- Anything outside `.github/workflows/` and `package.json`'s `scripts` block
- `src/**` as a *shipped* change (temporary fully-reverted probes were permitted during the worker's own verification, per the worker packet's Verification Exception — but nothing may remain changed in the final state)

## Standing Rule D001 (how to check Allowed/Forbidden files)
Never use git commit history/authorship as evidence of which agent touched what — commits mix orchestrator, foreman, and hook-generated content and don't distinguish per-agent authorship. Instead, directly diff the current file tree (`git status`, `git diff --stat` against the pre-T004 baseline if available, or a straightforward walk of changed files) against the Allowed Files list above.

## Relevant Constitution Excerpts
- Non-Negotiable: "The app must build successfully." / "Existing tests must pass unless the boss explicitly approves a test update."
- Item 9 (dependency allowlist): `@astryxdesign/*`, `@supabase/supabase-js`, `@tanstack/react-query`, `react-router-dom`, `qrcode.react`, `ical-generator` (Edge Function), plus dev tooling (vitest, playwright, eslint, prettier). Anything else requires boss-architect approval recorded in the ledger — relevant here because the bundle-size gate must not add a new package.
- "No worker may mark its own work complete." / "Every checker must inspect the actual artifact, not just the worker's summary."
- Loop Limit: 3 failed attempts before mandatory escalation to boss-arbiter (this is attempt 1).

## Worker's Claims (unverified — your job is to check each one)
1. Workflow triggers on `push`/`pull_request` with no branch filter; Node `20.18.1` pinned via `actions/setup-node@v4`; `npm ci`; five real-fail steps (typecheck, lint, test, build, bundle-size gate) — no `continue-on-error`/`|| true` anywhere.
2. `package.json` was not touched at all — zero diff.
3. The bundle-size gate measures gzip size of only the eager `<script type="module">` entry chunk(s) referenced in `dist/index.html`, not the sum of everything in `dist/` — deliberately scoped this way so it won't falsely fail once T006+ adds `React.lazy()` route splitting.
4. Worker ran real break/confirm-fail/revert/confirm-pass cycles for typecheck, lint, and test (each via a genuinely injected error), with `git diff --stat` showing zero net change after reverting.
5. Worker ran a genuine bundle-size inflate test (~350KB incompressible blob wired into `main.tsx`, survived tree-shaking, gate reported FAIL at 414185 vs 307200 budget bytes), then fully reverted and reconfirmed PASS at 60236 bytes gzip.
6. YAML validated via PyYAML; worker notes PyYAML renders the `on:` key as boolean `True` in the parsed dict as a known generic-YAML-library artifact unrelated to GitHub's actual parser.

## What To Do (all steps required — this is a from-scratch independent check, not a review of the worker's transcript)

1. **Read the actual workflow file directly**: `.github/workflows/ci.yml`. Confirm the claimed structure — `actions/checkout@v4`, `actions/setup-node@v4` pinned to `node-version: '20.18.1'` with `cache: npm`, `npm ci`, then separate steps for typecheck/lint/test/build/bundle-size. Confirm there is no `continue-on-error:`, no `|| true`, no other exit-code-swallowing anywhere in the file.

2. **Confirm `package.json` has zero diff.** Use `git status`/`git diff` on `package.json` specifically (per D001, compare current file state, don't rely on commit authorship). If there IS a diff, that directly contradicts claim 2 and is itself a finding — report exactly what changed.

3. **Independently re-run each of the workflow's actual `run:` commands locally.** Extract them verbatim from the YAML yourself (do not retype from this packet or the worker's report) — i.e. `npm ci`, `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`. Confirm each exits correctly (0) against the current clean repo tree.

4. **Independently re-run the bundle-size gate's inflate test.** Extract the gate step's full `run:` block verbatim from the YAML yourself. Against the current clean build, first confirm the gate PASSes at whatever real size it reports today. Then inject a large file (your own probe — don't reuse worker's file if it left artifacts; confirm it didn't first via step 2/7) large enough and wired into the entry chunk so it survives tree-shaking, rebuild, and confirm the extracted gate script now reports FAIL with byte counts that make sense (over the 300*1024 = 307200 byte budget). Then fully revert your probe and reconfirm PASS at the real size. Use `git diff --stat` / `git status` before and after to prove zero net change once you're done. You do not need to match the worker's exact 414185/307200/60236 numbers — your own independent run's numbers are what matters; note if they materially disagree with the worker's claimed numbers and flag that as a discrepancy if so.

5. **Assess the NFR-04 scoping reasoning.** Is "eager entry chunk(s) referenced in `dist/index.html`, not total `dist/`" the correct interpretation of "initial route JS," given T006 (real route-level code splitting) hasn't landed yet and can't be tested live within T004's allowed files? Separately, static-review (no live multi-chunk build is constructible without violating T004's Allowed Files) whether the gate script's loop over `ENTRY_SCRIPTS` would correctly generalize to summing multiple eager `<script type="module">` tags if more than one existed — walk through the loop logic yourself rather than accepting the worker's assertion.

6. **Confirm `.github/workflows/**` as the deliverable location is a correct reading of the Allowed Files.** The worker packet's Allowed Files list (see `docs/swarm/active/T004-worker-packet.md`, "Allowed Files" section) phrases the workflow file as one bullet alongside `package.json`, but the Objective and "Required Workflow Steps" text explicitly name `.github/workflows/` as the deliverable location. Confirm this is packet phrasing imprecision, not an actual scope violation, and confirm the file that was created matches (`.github/workflows/ci.yml`, not some other path).

7. **Confirm no forbidden-file violations** via the D001 method above (diff current file tree against Allowed Files, not git commit authorship) — walk the full forbidden list (`docs/swarm/**`, `.claude/**`, anything outside the two allowed paths, `src/**`).

8. **Scope note on live CI:** there is no live GitHub Actions runner in this sandbox. Do not attempt to fake or claim a live GitHub run. Your job is to confirm: the workflow is syntactically valid YAML (do your own parse, don't just trust the worker's PyYAML note — a second independent parse, e.g. via Python's `yaml.safe_load` or another method of your choosing, is fine), the individual commands it runs are verified correct against the current repo (steps 3–4 above), and the gating logic is sound (step 5). "Passes on GitHub's infrastructure end-to-end" is explicitly out of scope to prove and should not block a PASS verdict if everything else above checks out.

## Acceptance Criteria (from worker packet, restated for reference)
- `.github/workflows/ci.yml` (or equivalent) exists, valid YAML, runs on `push`/`pull_request`.
- Separate real-fail steps for typecheck, lint, unit test, build — no error-swallowing.
- Node version explicitly pinned via `actions/setup-node`, `npm ci` used, `cache: npm` set.
- Bundle-size gate measures only initial/entry-point JS via `dist/index.html`'s eager `<script type="module">` tags, gzip-compared against 300 KB, fails job when over budget.
- No new npm dependency added; no `package.json` fields touched other than `scripts`.
- Zero net diff outside `.github/workflows/**` and `package.json`'s `scripts` block.

## Most Recent Failure
None — this is T004's first checker run (attempt 1).

## Required Checker Output
- PASS / FAIL / PASS-WITH-FINDINGS verdict, with severity (BLOCKER / MAJOR / MINOR) for any finding.
- For each of the 8 steps above: what you did, the actual command output (not paraphrased), and your conclusion.
- Explicit confirmation (or contradiction) of each of the worker's 6 claims, backed by your own independently-reproduced evidence — not by re-stating the worker's numbers.
- `git diff --stat` / `git status` output proving zero net change to the repo after your own probes.
- Any discrepancy between your independently-measured bundle sizes and the worker's claimed numbers (60236 / 414185 / 307200), even if immaterial to the verdict.
- Do not mark the task complete based on the worker's report alone — every claim above must have independent evidence in your output.
