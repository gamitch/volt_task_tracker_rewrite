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
- **11:52Z — the premise failure above was MY OWN and is retracted; `main` is
  fine.** Kept above rather than deleted, because deleting it would delete the
  evidence that the check happened (item 30c). The cause was the previous
  milestone's own `npm install --no-save --no-package-lock playwright`:
  `--no-package-lock` makes npm ignore the lockfile and re-resolve every
  dependency from its `package.json` range, and `@astryxdesign/core`'s range
  is `^0.1.6`, which admits 0.1.9. So I upgraded the design system under
  myself and then read the resulting 6 `tsc` errors as the repository's state.
  Measured refutation: a clean `npm ci` restores `@astryxdesign/core` 0.1.6
  and `npm run typecheck` exits 0 with no output. Cross-check: CI run
  `31696325414` on `main` (merge of PR #177, 11:37Z today) ran the identical
  `npm run typecheck` step and printed no errors — that is what prompted the
  re-measurement rather than the filing. **No finding is filed for this, and
  none should be:** there is no defect, and `docs/swarm/astryx-api.md:472` is
  accurate for the pinned version. The correct install is
  `npm install --no-save playwright` (no `--no-package-lock`), verified to
  leave `@astryxdesign/core` at 0.1.6, `package.json`/`package-lock.json`
  untouched, and typecheck clean.
- **12:02Z — harness proven end to end, and a second measured fact about
  `main`.** `vite preview` binds `[::1]` only in this container while the
  persona config polls `http://127.0.0.1:4174`, so the config's own `webServer`
  block times out at 180 s; pre-starting the preview with `--host 127.0.0.1`
  and letting `reuseExistingServer: true` adopt it works. With that,
  `coach-meeting.spec.ts` ran: **3 passed, 2 failed**. Both failures are the
  archived team `Volt Legacy 2201` no longer being offered in the scope picker
  — correct behaviour since GAM-305/T615 shipped `excludeArchivedTeams`
  (`src/lib/teams/archivedTeams.ts`), and the spec's own comment at `:101-105`
  nominates that exact line for deletion when it happens. So the spec is stale,
  not the app. Root cause of the rot: `grep -n "e2e-personas"
  .github/workflows/*.yml` returns nothing — **CI never runs this suite.**
  That is a finding and is in the packet.
- **12:05Z — packet written** (`docs/swarm/active/GAM-344-packet.md`), with the
  item-19d Least confident decisions list. Writing it surfaced one defect in my
  own plan before any agent saw it: `coach-meeting.spec.ts`'s `beforeEach` does
  `delete from events where title like 'E2E %'`, and `'E2E %'` matches the
  `'E2E END %'` prefix I had chosen for the new file. Recorded as decision 5
  rather than quietly renamed, because the premise checker should judge whether
  alphabetical file ordering is a property worth relying on.
- **12:06Z — DISPATCHED `checker-premise` (opus, blocking, `run_in_background:
  false`)** against the packet. *If this line is the last one in this file, the
  run died holding this subagent* — that is the failure `AGENTS.md` § "Two
  walls" item 2 records, and its absence of a verdict line below is the
  evidence, not an oversight.
- **12:17Z — `checker-premise` VERDICT: REVISE** (round 1 of the two item-19a
  rounds). Returned in ~11 min, 129,887 subagent tokens. It ran the gate rather
  than reading it — psql against the live cluster, a `begin … rollback`
  mutation experiment, its own `git worktree` (item 23) and three headless
  browser probes — and it was right on the things that mattered. Three
  BLOCKERs, four MAJORs:
  - **BLOCKER 1 — my §3.2 cites a superseded view.** `v_student_participation`
    was redefined by `20260806000000_met01_explicit_marks.sql` (T509/D014);
    `pg_get_viewdef` shows an INNER JOIN on `attendance`, so `expected_ct`
    counts **explicit marks**, not eligibility. Measured: an unmarked student
    contributes **no row at all**, so my headline claim — that the status flip
    is itself what moves the participation figure — is false for the journey I
    designed. Measured table: unmarked ⇒ `4/4/100.0`; present ⇒ `5/5/100.0`;
    absent ⇒ `5/4/80.0`. My `80.0` was right by accident, for the wrong reason.
  - **BLOCKER 2 — the `check_out_at` assertion is unreachable through any UI
    path.** `computeCheckoutStudentIds` needs `checkInAt !== null`, and no UI
    writer sets `check_in_at` (the coach upsert deliberately never includes it;
    self-checkoff writes `null`; only the QR Edge Function would, and it is a
    harness stand-in). So `checkoutStudentIds` is always empty.
  - **BLOCKER 3 — my decision-5 doubt was right and the ordering was backwards.**
    `'E2E END Opt-Out Night' like 'E2E %'` is `t`, and `--list` shows
    `coach-meeting-end.spec.ts` runs **before** `coach-meeting.spec.ts` (`-`
    0x2D < `.` 0x2E). Worse, `attendance_session_id_fkey` is **ON DELETE
    RESTRICT**, not cascade — so the sibling file's `beforeEach` delete would
    throw and take all five of its tests down with it.
  - MAJOR: mutation 3 is **vacuous** (`plan.toUpdate` is the whole loaded set
    for a fresh future-only series, so "run it over all sessions" is a no-op);
    the `Mark 2 students` label needs a team-scope step I never prescribed;
    criterion 6's rendered-value comparison cannot be literal string equality.
  Revising now — round 2 is the last one item 19a allows before escalation.
