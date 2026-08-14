Closes GAM-350

The persona and root E2E suites both import `playwright/test`, which appeared in
no dependency section of `package.json`. The suites ran only on a host that
happened to carry a global install. This declares the package.

## What changed

One line of production change:

```diff
+    "playwright": "1.62.1",
```

plus 48 generated lockfile lines, and three doc comments corrected (below).

## The specifier was right; only the declaration was missing

The row asked whoever took it to engage with the documented reasoning behind
`playwright/test` rather than work around it. Measured from the published
tarball: `./test` is a **declared export** of the `playwright` package —
`{"types":"./test.d.ts","import":"./test.mjs","require":"./test.js"}` — and
`@playwright/test` is a thin wrapper depending on that same package. So the
specifier skips a level of indirection rather than reaching around one. It
stands. No specifier change, no `@playwright/test`.

## The one constraint is met by construction, not by an env var

`npm ci` must not pull a browser download. Measured from the tarballs:
**`playwright@1.62.1` and `playwright-core@1.62.1` have no `scripts` field at
all** and ship no `install.js`. There is no lifecycle script to fire, so this
cannot download a browser regardless of whether `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD`
is set. Confirmed empirically too: `~/.cache/ms-playwright` and `/opt/pw-browsers`
were absent both before and after a clean `npm ci`.

## Pinned exactly, deviating from house style on purpose

Every other dependency here uses a caret. This one is exact (`1.62.1`) because
the runner and the browser build are a matched pair, and browsers are supplied
out of band via `PLAYWRIGHT_BROWSERS_PATH`. A floated minor would go looking for
a Chromium revision nobody downloaded, turning a green suite into a confusing
"executable doesn't exist". Bump runner and browsers together, deliberately.
Flagging it as the one judgement call here most worth challenging.

## Scope is wider than the row's table

The row listed only the personas surface. The **root** suite imports the same
specifier — `playwright.config.ts:84`, `tests/e2e/public-routes.spec.ts:18`,
`tests/e2e/protected-route-redirects.spec.ts:25`. 14 files in all. One
declaration fixes both suites; no source changed.

## Doc comments that had gone false

`playwright.config.ts:58-83` and
`tests/e2e-harness/playwright.personas.config.ts:15-19` stated that
"`package.json` is NOT modified" and prescribed a symlink,
`node_modules/playwright -> /opt/node22/lib/node_modules/playwright`. Shipping
the fix while leaving instructions to `ln -s` the host's copy would reopen this
row by hand, so both are corrected. The genuinely useful measured fact in the
old text — Node's ESM resolver does not honour `NODE_PATH` — is kept.

Also documented, because it cost me a confusing result: run the suite with
`npx`, not a global `playwright`. A global runner loading specs that import the
repo-local `playwright/test` yields two module instances, so tests register in a
registry the runner never reads and you get `Total: 0 tests in 0 files` rather
than an error naming the cause.

## Evidence

**Clean clone, no global `playwright` on `PATH`** (`which -a playwright` →
nothing):

| Acceptance criterion | Result |
| -- | -- |
| 1. Clean checkout reaches the tests | `npm ci` exit 0 (5.52s); documented command `--list` → **40 tests in 9 files, exit 0** |
| 2. No global install required | runner resolved `/tmp/cleanco/node_modules/playwright/cli.js` |
| 3. Version pinned in `package.json` | `"playwright": "1.62.1"`, exact |
| 4. `npm ci` downloads no browser | `~/.cache/ms-playwright`, `/opt/pw-browsers` absent before *and* after |
| 5. Documented skill command still works | unchanged; `e2e-personas` needed no edit |

Root suite also collects: 90 tests in 2 files.

**Mutation replay** (in a disposable clone, fix committed first — items 23, 26):

- **RED** — declaration removed, runner supplied from outside the repo so the
  condition matches the row exactly:
  `Error: Cannot find package 'playwright' imported from
  .../tests/e2e-harness/playwright.personas.config.ts`, **exit 1**. The row's
  reported error, reproduced.
- **GREEN** — declaration restored: 40 tests in 9 files, **exit 0**.

**Gates** on `a151607`, clean tree, `gate-run --require-clean`:

```
1 tsc          exit 0 PASS    2 vite build exit 0 PASS    3 format:check exit 0 PASS
4 eslint       exit 0 PASS    0 errors, 379 warnings
5 vitest full  exit 0 PASS    95 files / 2458 tests, baseline 2458 (+0)
6 vitest scope    –   SKIP    no scope derivable — the diff touches no src/ file
```

**VERDICT: PASS — 5 of 6, and I am saying five, not six.** Gate 6 has no
defensible scope because a dependency declaration changes no `src/` file.
Baseline 2458 was measured, not assumed: a separate clone at merge base
`6e8a791`, `npm ci`, `npx vitest run` → 95 files / 2458 tests, exit 0.

## Tier: FAST, and why

Item 26's question is "can a mistake here corrupt data, or lie to a user about
their own data?" No. No write path, no schema/RLS/migration, no auth or role
logic, no signature another module imports, ~1 line of production change, and
the row named the mutation itself. Verification was not reduced — mutation
replayed, gates run, clean-checkout measurement taken, result through this PR.
What FAST removed is coordination, which item 26 declines to manufacture.

## One thing chased, not quoted

Gate 4 reported 379 warnings against the 377 `gate-run`'s SKILL.md documents. I
measured the merge base: **also 379**. So this change adds no warnings and the
skill's figure has drifted independently. Filed as its own row under item 20
rather than folded into this diff — Ignore GAM-384.

Linear-Issue: GAM-350
