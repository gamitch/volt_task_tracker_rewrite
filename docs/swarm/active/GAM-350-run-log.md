# GAM-350 run log

`playwright` is imported by the persona E2E harness but declared in no
dependency section of `package.json`.

Dispatched from Linear. Branch `claude/gam-350-playwright-dependency`, base
`6e8a791`. Append-only; one line per milestone, pushed immediately.

- **11:54Z — claimed.** Read `AGENTS.md` § "Where work comes from" and
  `constitution.md` item 28 first, then fetched GAM-350 live from Linear
  (state `Todo`, labels `w10` / `unreviewed` / `e2e-personas`), moved it
  `Todo → In Progress` and **read it back**: `state.name = "In Progress"`,
  `updatedAt 2026-08-14T11:54:59.225Z`. Claim held, not hoped.
- **11:54Z — tier judged FAST (item 28d, stated before the move).** Item 26's
  question is "can a mistake here corrupt data, or lie to a user about their
  own data?" — no. A dependency declaration in `package.json`: no write path or
  destructive operation; no schema, RLS, migration or auth/role logic; no
  change to a signature another module imports; ~1 line of production change
  plus a generated lockfile; and the issue names the mutation itself
  (remove the declaration → `ERR_MODULE_NOT_FOUND` returns). Verification is
  **not** reduced — mutation replayed, six gates run, clean-checkout
  measurement taken, result through a PR. What FAST removes is coordination,
  which item 26 explicitly declines to manufacture.
- **11:58Z — premise measured on this branch; it HOLDS, and is wider than the
  row states.** `grep -n playwright package.json` → no match.
  `node_modules/playwright`, `node_modules/@playwright`,
  `node_modules/playwright-core` → all absent. In *this* container
  `/opt/node22/lib/node_modules/playwright` is **also** absent, so the import
  resolves nowhere at all — a stronger reproduction than the row's, which had
  the global present. **Wider:** the row's table lists only the personas
  surface, but the *root* suite imports the same specifier —
  `playwright.config.ts:84` and `tests/e2e/{public-routes,protected-route-redirects}.spec.ts`.
  14 files in total. One declaration fixes both suites.
- **11:59Z — the two facts that decide the design, measured from the published
  tarballs rather than recalled.** (a) `playwright@1.62.1`'s `package.json` has
  **no `scripts` field at all** — no `install`/`postinstall`, and the tarball
  ships no `install.js`; same for `playwright-core@1.62.1`. So declaring it
  cannot trigger a browser download, which is the row's one hard constraint,
  satisfied by construction rather than by an env var. (b) `playwright` really
  does export `./test` (`{"types":"./test.d.ts","import":"./test.mjs",
  "require":"./test.js"}`). **So the deliberate specifier the row asks me to
  engage with is correct** — `playwright/test` is a supported entry point of a
  real package. The decision that was made was sound; only the matching
  dependency entry was never added. No specifier change; no `@playwright/test`.
- **12:00Z — change made and pushed (`efded92`).** `"playwright": "1.62.1"` in
  `devDependencies` (+48 lines of lockfile), and the two config rationales that
  said "`package.json` is NOT modified" and prescribed a symlink to the global
  package — `playwright.config.ts:58-83` and
  `tests/e2e-harness/playwright.personas.config.ts:15-19` — corrected, since
  shipping the fix while leaving a comment that tells the next reader to
  `ln -s` the host's copy would reopen the row by hand. Pinned **exactly**,
  against this repo's caret house style, because browsers are supplied out of
  band and a floated minor looks for a Chromium revision nobody downloaded;
  reasoning recorded in the config, defended in the PR.
- **12:01Z — AC 1/2/4 measured in a clean clone at `/tmp/cleanco`, no global
  `playwright` on `PATH` (`which -a playwright` → nothing).** `npm ci` exit 0
  in 5.52s. **No browser download:** `~/.cache/ms-playwright` and
  `/opt/pw-browsers` absent both before and after — consistent with the tarball
  finding that the package ships no lifecycle scripts, so the constraint is met
  by construction and not by an env var. Documented command
  `npx playwright test -c tests/e2e-harness/playwright.personas.config.ts
  --list` → **40 tests in 9 files, exit 0**, resolving
  `/tmp/cleanco/node_modules/playwright/cli.js` (local, not global). Root suite
  → 90 tests in 2 files. AC 5 needs no skill edit: the command is unchanged.
- **12:02Z — mutation replayed (item 26 "commit before mutating"; item 23, run
  in the disposable clone, never the shared tree).** RED, with the runner
  supplied from outside the repo so the condition matches the row exactly:
  `Error: Cannot find package 'playwright' imported from
  /tmp/cleanco/tests/e2e-harness/playwright.personas.config.ts`, **exit 1** —
  the row's reported error, reproduced. GREEN after restoring the declaration:
  40 tests in 9 files, exit 0. **One honest complication, recorded rather than
  tidied away:** my first green attempt reused the *external* runner against
  the now-local package and got `Total: 0 tests in 0 files`, exit 1. That is
  not a regression in the change but a real property of Playwright — an
  external runner and a local `playwright/test` are two module instances, so
  registrations land in a registry the runner never reads. It is also a live
  trap for anyone who still has a global install and runs it out of habit, so
  it is documented at the command's own doc site rather than left to be
  rediscovered.
- **12:08Z — gates run on `a151607`, clean tree, via `gate-run` with
  `--require-clean`. VERDICT: PASS — 5 of 6. Five, not six, and I am saying
  five.**

  ```
  GATE RUN — a151607 on claude/gam-350-playwright-dependency — tree clean
    1 tsc              exit 0  PASS
    2 vite build       exit 0  PASS
    3 format:check     exit 0  PASS
    4 eslint           exit 0  PASS       0 errors, 379 warnings
    5 vitest (full)    exit 0  PASS       95 files / 2458 tests  baseline 2458 (+0)
    6 vitest (scoped)      –  SKIP        no scope derivable from the diff
  ```

  Gate 6 has no defensible scope because the change touches no `src/` file —
  that is the expected shape for a dependency declaration, not a dodge.
  Baseline 2458 was **measured, not assumed**: a separate clone at the merge
  base `6e8a791`, `npm ci` then `npx vitest run` → 95 files / 2458 tests,
  exit 0. The suite is unmoved, which is the right result — vitest never
  collected `tests/e2e*`.
- **12:09Z — a discrepancy chased rather than quoted.** Gate 4 reported 379
  warnings where `gate-run`'s own SKILL.md documents a standing 377. I ran
  `npx eslint .` at the merge base: **also 379, 0 errors.** So this change adds
  no warnings, and the skill's figure has drifted by 2 on `main` independently
  of me. Left unfixed here deliberately — it is a `.claude/skills/**` doc
  number with nothing to do with this row, and folding it into a scoped PR is
  the staging habit item 22 exists to prevent — so it is filed as its own row
  under item 20 rather than left in this log, where nobody triages it.
  Consequence if ignored: anyone following the skill's instruction to pass
  `--max-warnings 377` gets a spurious FAIL on a clean tree.
- **12:09Z — CI checked for collisions.** No `.github/workflows/**` file
  mentions playwright, so the six workflows running `npm ci` gain one package
  and, per the no-lifecycle-scripts finding, no browser download. Nothing under
  `.github/workflows/**` needs editing — which is just as well, since a
  dispatched run cannot push there.
- **12:12Z — item 20 follow-up filed: [GAM-384](https://linear.app/gamitch/issue/GAM-384/gate-run-documents-a-377-warning-ceiling-but-main-measures-379-so-the)**,
  the drifted `gate-run` warning ceiling, written through the
  `linear-task-writing` skill per item 30 and filed to **Backlog** — promotion
  to `Todo` is the owner's signal and only the owner's (item 28a). A comment in
  this log would not have been triaged; that is the whole point of item 20.
- **12:14Z — PR [#190](https://github.com/gamitch/volt_task_tracker_rewrite/pull/190)
  opened**, `Closes GAM-350` as its first body line, `Ignore GAM-384` for the
  row this PR merely refers to so merging cannot move it.
- **12:16Z — gates re-run on the shipping commit `eda6aac`, clean tree:
  identical to `a151607` — 5 of 6 PASS, 0 errors / 379 warnings, 95 files /
  2458 tests, baseline (+0), gate 6 SKIPPED.** Re-run because the quoted
  verdict must describe the commit that ships, not an earlier one; four doc
  commits landed after the first run.
- **12:16Z — GAM-350 moved `In Progress → In Review` and read back.** Never
  `Done`: the merge closes it, not me (item 28e).

## Outcome

Premise held and was measured before anything changed. One line of production
change, three false doc comments corrected, no source touched. Every acceptance
criterion measured in a clean clone with no global `playwright`, the row's own
mutation replayed red-then-green, 5 of 6 gates green on the shipping commit.

**No subagent was dispatched.** The row is FAST under item 26, and item 26
forbids manufacturing the coordination it retired; there is no dispatch line in
this log without a matching verdict because there is no dispatch line at all.
