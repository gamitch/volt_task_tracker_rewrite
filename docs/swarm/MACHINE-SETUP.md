# Setting up another machine to run the swarm

**Written 2026-08-02**, when a second laptop was brought online. The owner intends to run
**different computers on different workflows** (`WORKFLOWS.md`), so this stops being a one-time
note and becomes the Nth-machine checklist.

**The short version:** clone, install Node 22.22.2, `npm ci`, run `bash scripts/doctor.sh`, then
paste one block from `KICKOFF-PROMPTS.md` into a fresh Claude Code session. Nothing else is
required to work on most of the backlog — no Supabase account, no `.env.local`, no database.

---

## Why so little is required

Every gate this project measures runs **offline, against the repo alone**, and every packet
baseline in `docs/swarm/` was captured **with `.env.local` absent**. `getSupabaseClient()` throws
`SupabaseNotConfiguredError` without credentials and the app fails safe to anonymous, which is the
condition the whole test suite is written against (`playwright.config.ts` documents this at
length). So a machine that can run `npm ci` can run the full six-gate check on its first afternoon.

Credentials only matter for two things: seeing the app in a browser (`npm run dev`), and W9's
migration work.

---

## Required

| | Version | Why this one |
|---|---|---|
| **Node** | **22.22.2** | Pinned in `.github/workflows/ci.yml`. The floor is 22.12.0 — below it `jsdom` reaches `whatwg-url@16`, which needs `require(esm)`, and vitest dies with `ERR_REQUIRE_ESM`. This already broke real CI once on 20.18.1. Match CI exactly and the question never comes up. |
| **npm** | ships with Node | `npm ci` only — never `npm install`, which would rewrite the lockfile. |
| **git** | any recent | Worktrees are used heavily (constitution item 23). |
| **Claude Code** | latest | With access to opus, sonnet, haiku and fable — the agent files name all four. |

```bash
git clone https://github.com/gamitch/volt_task_tracker_rewrite.git
cd volt_task_tracker_rewrite
npm ci
bash scripts/doctor.sh
```

`npm ci` needs no registry auth. `@astryxdesign/*` resolves from public npmjs.org despite looking
private.

### The install-script prompt on npm 11

npm 11 gates package install scripts behind an `allowScripts` policy, so a machine on npm 11 sees
this on every `npm ci` where npm 10 (what Node 22.22.2 bundles, and what CI runs) sees nothing:

```
npm warn allow-scripts 1 package has install scripts not yet covered by allowScripts:
npm warn allow-scripts   esbuild@0.21.5 (postinstall: node install.js)
```

**Already handled** — `package.json` carries `"allowScripts": { "esbuild@0.21.5": true }`, committed,
so every clone is covered without anyone running anything. npm 10 ignores the field.

esbuild is vite's own bundler and the approval is pinned to the exact version, which is the point of
the feature: bump vite, esbuild's version changes, and the prompt returns for a deliberate decision.
Re-approve with `npm approve-scripts esbuild` and commit the one-line `package.json` change — don't
reach for `--no-allow-scripts-pin`, which approves every future version sight-unseen.

**If a machine sees npm 11 at all, check its Node.** Node 22.22.2 ships npm 10.9.x, so npm 11 means
either a separately-installed npm or the wrong Node. `scripts/doctor.sh` reports both.

## Optional, per workflow

Install these only if the machine is assigned the workflow that needs them.

| | Needed by | For |
|---|---|---|
| **psql** + a reachable Postgres | W4 (hours), W9 (migration) | `tests/rls/run.sh` and `supabase/tests/run.sh` create a scratch database, apply `supabase/migrations/` unchanged, and assert against fixtures. Deliberately plain psql — no client library is on the dependency allowlist (item 9). |
| **Deno** | W8 (email) | `supabase/functions/**/*.test.ts` are `Deno.test(...)` files. `vite.config.ts` excludes them from vitest on purpose; they run via `deno test`. |
| **Supabase CLI** | W9 (migration and go-live) | Applying migrations and `supabase secrets set` for `CHECKIN_HMAC_SECRET` / `RESEND_API_KEY`. |

**`@playwright/test` is not installed and is not in `package.json`.** `playwright.config.ts` and
`tests/e2e/**` are committed but cannot run until someone adds the dependency. That is a known gap,
not a setup step — do not "fix" it while setting up a machine.

## Only if this machine needs to see the app in a browser

```bash
cp .env.local.example .env.local   # then fill in VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY
npm run dev
```

Both values are in the Supabase dashboard under Project Settings → API. `.env` and `.env.*` are
gitignored (the old repo leaked a `.env` — that is why the rule exists).

**Move `.env.local` aside before running gates.** Every baseline in `docs/swarm/` was measured
without it, and `scripts/doctor.sh` warns when it finds one.

---

## The six gates

Run before any PR. `scripts/doctor.sh --gates` runs the first five.

```bash
npx tsc --noEmit          # exit 0
npx vite build            # exit 0
npm run format:check      # clean
npx eslint .              # 0 errors — the warning count is large and expected
npx vitest run            # exit 0
npx vitest run <the file you touched>; echo $?   # sixth: the targeted run
```

**Assert exit codes, not pass counts.** A green-looking count at exit 1 is this project's recurring
trap. And measure the baseline on your own branch point rather than quoting a number from a doc —
the numbers here go stale within days.

Baseline measured on a freshly cloned machine at `main` = `e76515f`, `.env.local` absent:
`tsc` exit 0 · `vite build` exit 0 · prettier clean · eslint **0 errors / 361 warnings** ·
vitest **75 files / 1821 tests, exit 0**. Full install-to-green took about four minutes.

---

## Then pick a workflow

1. Read `WORKFLOWS.md` — in particular the **assignment table's "safe to run beside" column**. Two
   workflows sharing a file cannot run at the same time, and that is decided by file overlap, not
   by topic.
2. Reserve that workflow's **row-number block** (W1 → T400-499, W2 → T500-599, … W10 → T1300-1399).
3. Paste that workflow's block from `KICKOFF-PROMPTS.md` **verbatim, as the first message of a
   fresh session.** Each block is standalone — a cold session knows nothing.

Three machines: **W1 + W4 + W7** (no shared files). Two: **W1 + W2** (every remaining data-loss
row). One: **W1**.

## What every machine owes the others

Straight from `WORKFLOWS.md`'s coordination rules — each written against a failure this project has
already had:

- Stage **named paths only**. Never `git add -A` (item 22).
- Mutation experiments run in **your own worktree**, and **commit before mutating** (item 23).
- Update the ledger row and the verification-log entry **in the same commit that merges the work**
  (item 24). With N machines this drift multiplies by N.
- Never resolve a `task-ledger.md` conflict by taking one side wholesale — both sides are real rows.
- State your tier (item 26) in the PR and defend it. If two are arguable, take the heavier one.
