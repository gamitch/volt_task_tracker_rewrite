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
