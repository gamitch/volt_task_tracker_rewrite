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
