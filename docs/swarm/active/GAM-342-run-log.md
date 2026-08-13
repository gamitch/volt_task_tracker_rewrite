# GAM-342 run log

**Issue:** GAM-342 — E2E — W1 Check in: a student arrives and gets counted
**URL:** https://linear.app/gamitch/issue/GAM-342/e2e-w1-check-in-a-student-arrives-and-gets-counted
**Branch:** `claude/gam-342-e2e-w1-checkin`
**Run:** dispatched from Linear on `Todo → ` transition.

This log is append-only and is pushed after every milestone. If it ends
mid-sentence or ends on a dispatch line with no verdict beneath it, the run was
killed at that point — read the last line as the cause of death, not as a
summary.

---

- **Claimed.** Fetched GAM-342 live from Linear (state `Todo`, labels
  `other`/`w1`/`unreviewed`). Tiered **HEAVY** before moving it, per item 28d.
  Moved `Todo → In Progress` via `issueUpdate`, then re-read the issue:
  `state.name = "In Progress"`, `updatedAt = 2026-08-13T01:25:56.334Z`. The
  read-back is the claim; the write alone was only a hope (item 28c).
- **Tier reasoning (item 26, stated so a wrong call is correctable).** The
  question item 26 asks is whether a mistake here can corrupt data or lie to a
  user about their own data. No production code changes are expected, so the
  first half is out of scope. The second half is exactly what this issue is
  about: the deliverable is a *claim* that the check-in journey works, and the
  named failure mode is a green suite that reads as coverage it does not have
  (acceptance criteria 4, 5 and 9 all exist to prevent that). Scope is three
  screens, three loaders, two personas and nine acceptance criteria, over a
  harness with a documented trap list. STANDARD is arguable; item 26 says take
  the heavier tier when two are, so **HEAVY**. Per item 19b the premise gate is
  scoped rather than full: `coach-checkin.spec.ts` already proves the harness
  pattern, so the gate measures the environment and the issue body's factual
  claims instead of re-auditing a settled pattern.
- **Environment premise MEASURED, and it holds — but not out of the box.** The
  whole task is worthless if the harness cannot run here, so I measured that
  myself before writing a packet. Four gaps had to be closed, all environmental
  and none of them app faults:
  1. `tests/e2e-harness/start.sh` assumes root (`chown postgres`, `su postgres`);
     this container is uid 1001 `runner`. Passwordless `sudo` is available, and
     `sudo -E env "PATH=$PATH" bash tests/e2e-harness/start.sh` brings the whole
     stack up. Cluster seeded: 5 profiles, 6 students, 3 events, 8 sessions,
     10 attendance rows.
  2. `node_modules/` was empty on checkout — `npm ci` first.
  3. `playwright` is not in `package.json` (both configs document it as globally
     installed in the authoring sandbox; it is not present here). Installed with
     `npm install --no-save playwright@1.62.1` plus `npx playwright install
     chromium`, deliberately `--no-save` so `package.json` and the lockfile stay
     byte-identical (verified: `git status --porcelain` on both is empty).
  4. **The real trap.** `npm run preview` binds **IPv6-only** (`[::1]:4174`)
     while `playwright.personas.config.ts` polls `http://127.0.0.1:4174`, so the
     `webServer` block times out after its full 180s having never reached a
     server that was up and answering on `localhost`. Passing
     `--host 127.0.0.1` fixes it. Recorded as a finding rather than patched into
     the committed config, because the config is correct in the sandbox it was
     written for.
  With those closed, the baseline spec passes in a real browser:
  `coach-checkin.spec.ts` → **1 passed (5.4s)**. Premise holds; proceeding.
- **Packet written** — `docs/swarm/active/GAM-342-packet.md`. Corrects three
  wrong paths in the issue body (loaders live at `src/lib/supabase/loaders/`;
  `SelfCheckoffDialog` is an outreach surface; `selfCheckoff.ts` is
  INSERT+DELETE, so AC 3's upsert claim belongs to the coach console only), and
  records the structural finding that `/checkin`'s code field and session picker
  render inside the **error** state. Also measured that the `checkin` Edge
  Function stand-in (`tests/e2e-harness/server.mjs:475-492`) only *mints* a QR
  token and has **no redemption branch at all** — so no code submission can
  produce an `attendance` row here. Ends with five Least confident decisions
  (item 19d).
