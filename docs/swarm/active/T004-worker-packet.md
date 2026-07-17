# Worker Packet: T004 (CI pipeline)

## Task ID
T004

## Objective
Add a real GitHub Actions CI workflow that runs typecheck, lint, unit tests (Vitest), and build on every push/PR and fails the job on any error, per NFR-01; add a bundle-size gate enforcing the NFR-04 "initial route JS < 300 KB gz" budget, architected so it will meaningfully gate future route-level code splitting even though no real routes are wired into `main.tsx`/`App.tsx` yet (that lands in T006+).

## Allowed Files
- `.github/workflows/ci.yml` (or an equivalently named workflow file under `.github/workflows/`)
- `package.json` — **`scripts` section only.** Do not add/change `dependencies`, `devDependencies`, or add fields like `engines` without flagging it explicitly in your output first — prefer zero new dependencies (see Bundle-Size Gate section below for why none should be needed).

No other files are in scope for the deliverable. See the **Verification Exception** note below for a narrow, fully-reversible carve-out that applies only to proving your gates work, not to the shipped artifact.

## Forbidden Files
- `docs/swarm/**`
- `.claude/**`
- Anything outside `.github/workflows/` and `package.json`'s `scripts` block
- `src/**` as a *shipped* change (temporary, fully-reverted probes for verification are allowed — see below)

## Repo Context You Need
- Stack: Vite + React 19 + TypeScript-strict + Astryx. No Tailwind/shadcn.
- `package.json` already has working scripts: `dev`, `build` (`tsc --noEmit && vite build`), `preview`, `typecheck` (`tsc --noEmit`), `lint` (`eslint .`), `format`, `format:check`, `astryx`, `test` (`vitest run`). All are confirmed exit-0 clean on the current tree (T001–T003, T002a, T005 all Passed).
- No `.github/workflows/` directory exists yet — you are creating CI from scratch.
- No `.nvmrc` or `engines` field exists in `package.json`. Pick an explicit Node LTS version (Node 20.x is a reasonable default given Vite 5 / Vitest 4's runtime requirements) and pin it in the workflow via `actions/setup-node`'s `node-version` input — do not leave it implicit/floating. Document your choice in worker output.
- Routing status: T005 built a route-table stub (`src/app/router.tsx`) with guards, but it is **deliberately not yet wired into `main.tsx`/`App.tsx`** (that's T006's job). This means the *current* production build is, in effect, a single undifferentiated entry bundle — there is no real "initial route vs. lazy route" split to measure today. That is expected and is not something T004 should try to fake or force by touching `src/`.

## Required Workflow Steps (all must genuinely fail the job on error — no `continue-on-error: true`, no `|| true`, no swallowed exit codes anywhere)
1. `actions/checkout@v4`
2. `actions/setup-node@v4` with an explicit pinned `node-version` and `cache: npm`
3. `npm ci` (not `npm install` — reproducible from `package-lock.json`, which already exists)
4. Typecheck: `npm run typecheck`
5. Lint: `npm run lint`
6. Unit tests: `npm run test`
7. Build: `npm run build` (this already runs `tsc --noEmit && vite build` — the redundancy with step 4 is fine and intentional: NFR-01 lists typecheck/lint/unit/build as separate required CI gates, and keeping typecheck as its own early step gives faster, clearer failure signal even though build re-checks it)
8. Bundle-size gate (NFR-04) — see next section. Must run after step 7, against the real `dist/` output.

Trigger on `push` and `pull_request`. Confirm the repo's actual default branch (check `git symbolic-ref refs/remotes/origin/HEAD` or equivalent) before hardcoding a branch filter — do not assume `main` blindly.

## Bundle-Size Gate (NFR-04) — Read Carefully
NFR-04: "Initial route JS < 300 KB gz; route-level code splitting present."

**"Initial route JS" means the entry chunk(s) actually loaded on first paint — the `<script type="module">` tag(s) Vite emits directly in `dist/index.html` — not the sum of every JS file in `dist/`.** Once real route-level code splitting lands (React.lazy / dynamic `import()` per route, in T006+), those lazy route chunks will NOT be referenced by an eager `<script>` tag in `index.html` — they only load on navigation. Your gate must measure only the eager entry-point file(s), so that it stays correctly scoped as routes are added later and doesn't falsely fail because the *total* app grew, nor falsely pass because it's summing everything.

Concretely:
- Build (`npm run build`), then parse `dist/index.html` for `<script type="module" ... src="...">` tags — those `src` files (resolved into `dist/`) are the initial route JS.
- Gzip each with the standard `gzip` CLI (`gzip -9 -c <file> | wc -c` — available on GitHub's `ubuntu-latest` runners, no new dependency needed) and sum the bytes.
- Fail the step (`exit 1`) if the sum exceeds `300 * 1024` bytes, printing the actual size vs. the budget clearly.
- You may implement this as an inline shell block in the workflow YAML, or as a one-line `package.json` script (e.g. `"check-bundle-size": "..."`) invoked from the workflow — either is fine, but do not create a new script *file* outside the two allowed paths.
- **Do not add a bundle-analyzer npm package.** The dependency allowlist (constitution item 9) doesn't include one, and plain `gzip`/`wc`/basic HTML parsing (e.g. `grep -oP` or a short inline `node -e` using a regex — regex-parsing `index.html`'s handful of `<script>` tags is fine here, this isn't general HTML parsing) is sufficient and dependency-free.

**On "route-level code splitting present":** because T004's allowed files exclude `src/`, you cannot add real `React.lazy()` route splitting yourself — that's T006+'s job once routes are actually wired in. What T004 *can* and must do to satisfy this half of NFR-04 today is make the CI gate itself structurally correct for that future state (measuring entry-chunk(s) via `index.html`, not total `dist/` size, per above). State this explicitly in your worker output as the intended reading: this task ships the *gate*, not the *splitting* — the gate is what will meaningfully enforce splitting once it exists. Flag this reasoning clearly so the checker isn't left to guess why no `React.lazy()` calls exist in the repo yet.

## Verification Exception (temporary, fully-reversible probes only)
There is no live GitHub Actions runner in this sandbox, so you cannot prove the workflow file itself executes end-to-end on GitHub. Required evidence instead:

(a) The workflow YAML file itself, syntactically valid (confirm with a YAML parse, e.g. `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml'))"` or equivalent — note in your output which method you used).

(b) Prove each gate command actually fails when it should: for typecheck, lint, and test, temporarily introduce a real, narrow error into a scratch/otherwise-untouched location (e.g. a deliberate type error or lint violation), run the exact command the workflow step runs, confirm a non-zero exit, then **fully revert** the change and re-run to confirm clean again. This is the one narrow exception to the `src/**` forbidden-file rule for this task: temporary, verification-only edits are permitted **only if fully reverted before you finish**, with a `git diff --stat` (or equivalent) shown in your output proving zero net change to any file outside `.github/workflows/` and `package.json`. Do not leave any such edit in the final state under any circumstance.

(c) Bundle-size measurement against the current real build: run `npm run build`, report the actual entry-chunk gzip size vs. the 300 KB budget (it will almost certainly be well under budget today, given the app is still minimal pre-T006). Then, using the same reversible-probe exception as (b), temporarily inflate the entry bundle (e.g. a large dummy string import in `main.tsx`, reverted immediately after) to prove the gate step actually exits non-zero when over budget — then revert and reconfirm the real build passes clean.

## Acceptance Criteria
- `.github/workflows/ci.yml` (or equivalent) exists, is valid YAML, and runs on `push`/`pull_request`.
- Separate (or clearly delineated) steps for typecheck, lint, unit test, and build, each of which fails the job on a real error — no error-swallowing.
- Node version explicitly pinned via `actions/setup-node`, `npm ci` used (not `npm install`), `cache: npm` set.
- A bundle-size gate step that measures only the initial/entry-point JS (via `dist/index.html`'s eager `<script type="module">` tags), gzip-compares against 300 KB, and fails the job when over budget — with clear reasoning in your output for why this scoping (entry-only, not total `dist/`) is the correct reading of NFR-04's "initial route JS," and how it will correctly gate route-level code splitting once T006+ lands real routes.
- No new npm dependency added for the bundle check; no `package.json` fields touched other than `scripts` (flag explicitly if you believe an exception is truly required, don't just add it).
- Evidence per the Verification Exception section above: (a) YAML validity, (b) break/confirm-fail/revert/confirm-pass cycle for typecheck, lint, and test, (c) real bundle-size measurement plus an inflate/confirm-fail/revert/confirm-pass cycle for the size gate.
- Zero net diff outside `.github/workflows/**` and `package.json`'s `scripts` block once you're done — confirm this explicitly in your output.

## Relevant Constitution Excerpt
- Non-Negotiable: "The app must build successfully." / "Existing tests must pass unless the boss explicitly approves a test update." Your temporary probes must never be left in a state that breaks these.
- Item 9 (Stack locks / dependency allowlist): `@astryxdesign/*`, `@supabase/supabase-js`, `@tanstack/react-query`, `react-router-dom`, `qrcode.react`, `ical-generator` (Edge Function), plus dev tooling (vitest, playwright, eslint, prettier). Anything else requires boss-architect approval recorded in the ledger — this is why the bundle-size gate must not add a new package.
- Item 10 (Stack locks / migrations): not directly relevant to this task, listed for completeness only.
- "No worker may mark its own work complete." / "Every checker must inspect the actual artifact, not just the worker's summary." — your evidence must let checker-tests independently re-run everything you claim, not just read your description of it.

## Most Recent Failure
None. This is T004's first dispatch (attempt 1).

## Required Worker Output
- Files changed (should be exactly `.github/workflows/ci.yml` and `package.json`'s `scripts` block, plus proof any temporary probe files/edits were fully reverted)
- Full text or diff of the new workflow file
- Commands run, with real output, for: typecheck/lint/test/build all green on the clean tree
- The break → confirm-fail → revert → confirm-pass cycle output for typecheck, lint, and test (per Verification Exception (b))
- Actual bundle-size measurement (entry-chunk files identified, individual + summed gzip sizes, vs. 300 KB budget) plus the inflate → confirm-fail → revert → confirm-pass cycle (per Verification Exception (c))
- YAML validity check output
- Explicit statement of the Node version chosen and why
- Explicit statement of your reasoning for why "route-level code splitting present" is satisfied by the gate's scoping today, not by adding real splitting (which is out of this task's allowed files)
- Known risks (e.g. anything you couldn't verify without a live GitHub runner)
- Whether a dispute is needed
