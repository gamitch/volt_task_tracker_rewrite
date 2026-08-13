# GAM-344 run log — E2E W3 Run a meeting: schedule → attendance → participation %

Append-only. One line per milestone, pushed immediately. If this file ends on a
dispatch line with no matching verdict line, **the run died holding that
subagent** — that is the failure shape AGENTS.md § "Two walls" records, and the
absence of the verdict line is the evidence, not an oversight.

Issue: <https://linear.app/gamitch/issue/GAM-344>
Branch: `claude/gam-344-w3-meeting-e2e`
Tier: HEAVY (label `heavy`, carried on the issue; not `tier/unreviewed`, so no
tiering judgement was required as part of claiming under item 28d).

## Milestones

- **11:37Z — claimed.** `GAM-344` moved `Todo → In Progress` via
  `scripts/linear/client.mjs`; read-back confirms `state.name = "In Progress"`,
  `updatedAt 2026-08-13T11:37:16.130Z`. Claim held before any file other than
  `AGENTS.md` / `docs/swarm/constitution.md` was opened.
- **11:38Z — branch created**, `claude/gam-344-w3-meeting-e2e` off `main`
  (`bebcded`).
- **11:38Z — run log created** (this file) and pushed.
- **11:40Z — environment measured, before any packet was written.** `npm ci`
  succeeded; `playwright` is not a repo dependency and was installed
  `--no-save --no-package-lock` (package.json / package-lock.json unmodified —
  verified with `git status`); chromium-headless-shell downloaded. The harness
  needs root (`initdb` refuses to run as root, so `scratch-postgres/start.sh`
  does `su postgres`), so it is started as `sudo -E bash
  tests/e2e-harness/start.sh`. That worked: cluster on 55432, API on 54321,
  seed reports `5 profiles / 6 students / 3 events / 8 sessions / 10 attendance`.
- **11:46Z — PREMISE FAILURE, measured not assumed: `npm run build` fails on a
  clean `main`.** `tsc --noEmit` reports 6 errors, all the same shape:
  `Type '"small"' is not assignable to type 'AvatarSize | undefined'`
  (`TopNav.tsx:218`, `ParentsTab.tsx:827,848,850`, `StudentsTab.tsx:1001`,
  `SettingsPage.tsx:1078` — the last is `"large"`). Cause: the installed
  `@astryxdesign/core` tarball pinned at `0.1.6` in `package-lock.json`
  (integrity verified by `npm ci`) contains a package whose own
  `package.json` says **0.1.9**, and whose `AvatarSize` is
  `'xsm'|'sm'|'md'|'lg'|'xl'`. `docs/swarm/astryx-api.md:472` documents
  `'tiny'|'xsmall'|'small'|'medium'|'large'` and says short names are NOT
  valid — the constitution-item-2 source of truth and the installed package
  disagree. This blocks the persona harness outright: its `webServer` command
  is `npm run build -- --mode e2e`, so no persona spec can run until the build
  passes. Investigating whether CI on `main` is green before deciding scope.
