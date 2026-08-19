# GAM-403 — run log

**Issue:** [GAM-403](https://linear.app/gamitch/issue/GAM-403/a-dispatched-run-discovers-a-dead-credential-only-after-the) —
"A dispatched run discovers a dead credential only after the implementation is
spent — nothing preflights push or PR capability, and the token expression at
play is the availability-dependent fallback the plan forbids"
**Tier:** HEAVY (label `heavy`; re-affirmed below, not re-judged — the row was
not `tier/unreviewed`)
**Branch:** `claude/gam-403-dispatch-credential-preflight`
**Run:** GitHub Actions, dispatched from Linear on 2026-08-19.

Every line below is appended and pushed immediately. **If the last line of this
file is a subagent dispatch with no matching verdict line, the run died holding
that subagent** — that is the failure signature AGENTS.md names, and it means
the work after that point never happened.

## Log

- `21:28Z` — **CLAIMED.** `GAM-403` moved `Todo → In Progress` via
  `scripts/linear/client.mjs`; read-back confirms `state.name = "In Progress"`,
  `updatedAt = 2026-08-19T21:28:40.423Z`. Labels are `heavy`, `other`,
  `Improvement` — no `gate/human`, no `executor/*` route, so under item 28b the
  missing route is the legacy Claude-only path and this runtime may hold it.
- `21:30Z` — branch `claude/gam-403-dispatch-credential-preflight` created off
  `main` at `e37605f`. Run log written as the first file write (per the dispatch
  contract) and pushed before any other work.
- `21:35Z` — **PREMISE MEASURED (item 19c), before writing the packet.** All
  three of the issue's citations confirmed at the exact lines
  (`claude-linear-dispatch.yml:126,137` fallback expression; `:40-43` PAT
  comment; plan §5.3 at
  `docs/swarm/2026-08-15-durable-multi-agent-execution-plan.md:332-344`). Three
  facts the issue does **not** contain were measured live in this run and change
  the prescription:
  - the PAT (`CLAUDE_PR_TOKEN`) is **`403` on PR creation** and the agent's
    `ghs_` App token is **`422`** (authorized) — so the credentials are near
    complementary, and "pin `GH_TOKEN` to the push token" would break the only
    PR path that works;
  - `GET /repos/{repo}.permissions` reports `push:false` for the App token that
    then pushes successfully — a **false negative**, so capability must be
    probed, never read off a permissions field;
  - a `refs/preflight/*` probe push **creates no workflow run** (measured with
    both credentials, both refs deleted afterwards), so ref-write can be proven
    without spending CI or leaving evidence behind.
- `21:38Z` — **PACKET WRITTEN.** `docs/swarm/active/GAM-403-packet.md`. HEAVY
  defended on item 26's write-path and export triggers. Allowed Files for the
  worker are the preflight script and its tests only; the workflow half is
  orchestrator-owned and ships as a patch (GAM-328 wall). Five **Least confident
  decisions** declared per item 19d.
- `21:40Z` — **DISPATCHED `checker-premise` (round 1, opus pin, `run_in_background: false`).**
  Target: `docs/swarm/active/GAM-403-packet.md`, charter §0 first — the five
  Least confident decisions in packet §5. **If this line is the last one in this
  file, the run died holding this subagent** and the gate verdict below was never
  recorded.
- `21:51Z` — **VERDICT round 1: `REVISE`.** 1 BLOCKER, 4 MAJOR, 6 MINOR, 2 NIT.
  The gate ran the prescription rather than reading it (item 26) and the BLOCKER
  is one I could not have found by inspection:
  - **BLOCKER — the ref-write probe cannot test the credential it claims to
    test.** In an `actions/checkout` workspace, `http.…extraheader` outranks the
    URL userinfo, so `git push https://x-access-token:$TOKEN@…` authenticates
    with the *checkout's* credential. Measured: a garbage token
    (`ghp_FAKE…`) pushed successfully in this workspace, and failed with
    `Authentication failed` in a control repo with no extraheader. Stage A would
    have returned PASS for a dead token — the exact false positive the packet's
    own tier defence calls disqualifying. Verified fix:
    `git -c "http.https://github.com/.extraheader=" push …`, which the gate
    confirmed fails on the fake token and passes on both real ones.
  - MAJOR — the CI-trigger check compares against `GITHUB_TOKEN`, which is unset
    in Stage A (vacuous PASS) and is *not* the built-in token inside the agent
    (false FAIL). Must take an explicit `PREFLIGHT_BUILTIN_TOKEN` and SKIP when
    absent.
  - MAJOR — §6 item 2 pinned `GH_TOKEN` to the PAT, the one credential measured
    at 403 on PR-create, against plan §5.3's "pin the proven GitHub App path".
    Delete line 137 instead; the action sets `GH_TOKEN` itself.
  - MAJOR — "all six gates" is unsatisfiable: gate 6 scopes off `src/` changes
    and this task touches only `scripts/`, so the honest figure is 5 of 6.
  - MAJOR — criterion 3 was not performable: a worker has no `secrets.` context.
  - 6 MINOR / 2 NIT, incl. require the `No commits between` message rather than a
    bare 422 (the gate built the counter-case: a typo'd base yields a green
    422), stdlib-only imports (no `node_modules` in a dispatch checkout), and
    my "a dead push token strands 100% of runs" being unmeasured — GAM-333 is
    0 of 13 at push time, 8 of 13 at PR time.
  Gate isolated its mutations in `/tmp/gate-403` (item 23) and confirmed cleanup;
  remote left with no `refs/preflight/*`.
- `21:55Z` — baseline measured before any worker touches the tree:
  `npx vitest run` → **98 files, 2505 tests, 0 failures** (`npm ci` was needed
  first — a dispatch checkout has no `node_modules`, which is itself R1-9's
  evidence). This is the figure gates 5/6 are graded against.
- `21:58Z` — **PACKET REVISED (revision 2).** All 13 round-1 findings answered
  in `GAM-403-packet.md`, each marked `[R1-n]`: the extraheader BLOCKER is now
  §1.4b with the verified `-c` fix and both a unit assertion and a live negative
  control; check 5 requires the `No commits between` body; check 6 takes an
  explicit `PREFLIGHT_BUILTIN_TOKEN` and SKIPs when absent; §6 now **deletes**
  line 137 instead of pinning the PAT into it; gates restated as 5 of 6 with a
  named baseline; the PAT-recovery recipe is spelled out. §5 rewritten: four of
  five original doubts resolved, one reversed, one new doubt added as the
  BLOCKER's residue.
- `21:59Z` — **DISPATCHED `checker-premise` (round 2 of 2, opus pin, `run_in_background: false`).**
  This is the last round item 19a allows; a third REVISE escalates to the owner
  rather than looping. **If this line is the last one in this file, the run died
  holding this subagent.**
- `22:09Z` — **VERDICT round 2: `REVISE`, one blocking item — and the gate
  explicitly ruled it does not warrant owner escalation** ("a single
  character-class correction plus one test fixture, with no design uncertainty
  and nothing left to measure. Fix those two lines and dispatch; do not
  re-gate.").
  - **MAJOR, new — my own redaction rule leaked the credential it was written
    to hide.** `ghs_[A-Za-z0-9_]+` stops at the first `.`, and the `claude[bot]`
    installation token is JWT-shaped (`ghs_<id>_<hdr>.<payload>.<sig>`).
    Measured: **342 of 390 characters of a live write-capable token survive**
    the regex, and both acceptance criterion 9 and the natural unit test go
    green, because a hand-written fake token has no dots. That is this packet's
    own false-green failure class, inside the anti-leak rule. Fixed:
    `(?:ghs|ghp|gho|ghu|ghr)_[A-Za-z0-9_.-]+|github_pat_[A-Za-z0-9_.-]+`, a
    dot-bearing test fixture, and the criterion restated as "no 20-character
    substring survives".
  - Round 2 re-measured the BLOCKER fix live, four ways: fake token without
    `-c` → PASS (bug reproduced), fake token with `-c` → `Authentication
    failed` (correct FAIL), PAT and App token with `-c` → PASS + clean delete,
    no workflow runs created. It also proved `-c …extraheader=` replaces a
    *multi-valued* header list, narrowing least-confident decision 6.
  - It resolved decision 3 outright, against my own hedging: this repo is
    **public**, and a garbage *or empty* token still `ls-remote`s it exit 0 —
    so a dead `CLAUDE_PR_TOKEN` **does not fail the checkout**. The run burns
    the full implementation and finds out at push time. Stage A stays.
  - Four known risks folded into the packet: no short-circuiting (or criterion
    4 is unmeetable), the probe must never target `origin`, check 1 needs a
    test, and §6 said "three things" while listing four.
- `22:11Z` — **DISPATCHED confirmation request to the round-2 gate
  (`SendMessage`, same agent, same round — not a third round under 19a).**
  **If this line is the last one in this file, the run died holding it.**
- `22:14Z` — **CONFIRMATION RETURNED: `CONFIRMED`.** The gate re-ran the fix
  rather than reading it — `eval`'d the regex **verbatim from the packet line**
  against the live 390-char `ghs_` token, the live PAT and the mandated fixture:
  nothing survives, not even a 20-character substring, and ordinary report text
  passes through byte-identical (no over-redaction). It also verified the
  fixture *pins* the fix: under the old naive regex the same fixture leaves 7
  surviving 20-character substrings, so the test turns red if a worker ever
  narrows the character class back. One non-blocking wording conflict it found
  between `[R2-2]` (never short-circuit) and `[R2-5]` (don't call the network
  with an empty credential) is resolved by the clause it supplied, now appended.
- `22:15Z` — **PREMISE GATE CLOSED (item 19).** Two rounds used, which is the
  cap (19a). Round 1 `REVISE` (1 BLOCKER, 4 MAJOR, 6 MINOR, 2 NIT) → round 2
  `REVISE` (1 MAJOR, explicitly ruled not owner-escalation) → `CONFIRMED` on the
  required revision by the same round-2 checker. **Recorded honestly: the gate's
  formal round-2 verdict was REVISE, not DISPATCH.** What clears the packet for
  a worker is that checker's own written instruction — "fix those two lines and
  dispatch; do not re-gate" — plus its measured confirmation that the fix landed.
  A third round was available in neither letter nor spirit.
- `22:17Z` — **DISPATCHED `worker-implementer` (attempt 1 of max 3, pinned
  default model, `run_in_background: false`).** Item 18's opus override is
  **not** passed and that is deliberate: none of its four triggers is met — no
  migration, no RLS or security definer, no metric-view SQL, no auth/session/
  role logic. This is CI credential plumbing, and item 25 forbids bumping a
  worker because a topic sounds sensitive. The mitigation is the packet's
  specificity plus an opus `checker-reviewer` afterwards, which is what
  AGENTS.md prescribes for a non-item-18 HEAVY worker. **If this line is the
  last one in this file, the run died holding this subagent.**
- `22:28Z` — **WORKER VERDICT: complete, attempt 1 of 3, no dispute.** Commit
  `cee61bd`, two files, 547 + 503 lines, 38 new tests. Self-reported all nine
  §3 criteria PASS, including the two that matter most: criterion 4's negative
  control (garbage token → `exit 128: Invalid username or token` →
  `EXIT CODE: 1`, so the `-c` fix holds against the BLOCKER) and criterion 6's
  mutation replay in its own worktree (`3 failed | 35 passed`, exit 1, the
  packet-named test among the red). Suite 99 files / 2543 tests / 0 failures =
  baseline + exactly its 38.
  Two things it disclosed rather than concealed, both to its credit:
  1. **It leaked a credential into its own transcript** — it ran `git remote -v`
     early, which echoed `origin` with the live `ghs_` App token in the userinfo.
     Not in any committed file, and orchestrator verification below confirms
     that. Assessment: the token is an Actions-minted, job-scoped installation
     token that dies with this run, and the transcript is not published, so
     there is nothing to rotate — but it is recorded here because a disclosed
     exposure is the only kind anyone can act on.
  2. A judgment call it flagged: it also SKIPs check 6 (`ci-trigger`) on a
     missing credential, though that check is a string comparison rather than a
     network call, on the grounds that comparing an empty token is meaningless.
     Defensible, not dictated by the packet — handed to the checker to weigh.
  Verification by the orchestrator (item 21 — existence is verified, not
  assumed) follows before any of this is treated as done.
- `22:36Z` — **ORCHESTRATOR VERIFICATION of the worker (item 21 — existence is
  verified, not assumed).** `git show --stat cee61bd` = exactly the two Allowed
  Files, 1050 insertions, nothing else; both blobs read back from the commit at
  their claimed lengths, so the work survives worktree removal. Imports are
  `node:child_process` and `node:fs` only (stdlib rule holds). `EXTRAHEADER_CLEAR`
  and the corrected redaction pattern are both in the committed blob. A repo-wide
  grep for token-shaped strings in tracked files finds nothing but the deliberate
  fakes.
  **I re-ran the three live criteria myself rather than accepting the report:**
  - real PAT, `--stage=push` → every line PASS, `exit=0`;
  - garbage token, `--stage=push` → `repo-access`, `identity` and **`ref-write`**
    all FAIL (`exit 128: Invalid username or token`), `exit=1`. **This is the
    BLOCKER closed under measurement** — and note `ref-write` is reported even
    though check 2 already failed, so the no-short-circuit rule holds in the
    built artifact, which is what makes this criterion meaningful;
  - ambient `GH_TOKEN`, `--stage=pr` → `422 "No commits between"`, credential
    reported as `installation token`, `exit=0`.
  `git ls-remote origin 'refs/preflight/*'` empty afterwards: the probes left
  nothing behind.
- `22:40Z` — **WORKFLOW HALF WRITTEN AND PRESERVED AS A PATCH.** Cannot be
  pushed (GAM-328 wall), so it ships as
  `docs/swarm/active/GAM-403-dispatch-preflight.patch` — the #159→#160 pattern.
  Four changes, matching packet §6: checkout token pinned; `GH_TOKEN` **deleted**
  from the agent step rather than pinned; a `Credential preflight` step between
  checkout and the agent, mapping both tokens explicitly; and the prompt
  paragraph for `--stage=pr`, sequenced after claiming and the run log.
  Verified rather than eyeballed: the YAML parses, the new step is index 1 of 5
  (immediately after `Checkout`, before `Work the issue`), `GH_TOKEN` is absent
  from the agent step's `env`, the prompt carries the paragraph, and
  `git apply --check` on the branch exits 0 (87 insertions, 2 deletions). The
  workflow file itself is left untouched on the branch.
- `22:42Z` — **DISPATCHED `checker-reviewer` (opus pin, `run_in_background: false`)**
  over both halves: the worker's commit `cee61bd` against packet §3, and the
  orchestrator's own patch `GAM-403-dispatch-preflight.patch`, which nothing has
  independently reviewed yet. **If this line is the last one in this file, the
  run died holding this subagent.**
- `22:52Z` — **CHECKER VERDICT: `PASS`**, highest severity MINOR (no BLOCKER, no
  MAJOR). All nine §3 criteria verified **by execution**, and the checker
  independently reproduced the BLOCKER in the shared workspace shape before
  confirming the fix closes it: garbage token without `-c` → `* [new reference]`
  (false pass), with `-c` → `Authentication failed`. It verified `redact()`
  against the **live** 390-char `ghs_` token (0 surviving 20-character
  substrings, no over-redaction), re-ran the mutation replay itself, confirmed
  no test touches the network or pushes for real, and applied the workflow patch
  inside its own worktree to check the YAML parses and `GH_TOKEN` is genuinely
  deleted rather than pinned. Gates: eslint 0, tsc 0, prettier clean,
  99 files / 2543 tests (baseline + exactly 38).
  Two MINOR findings, and I am fixing both now rather than deferring them:
  - **MINOR-1 — the ESM entrypoint guard can make the whole preflight a silent
    `exit 0`.** `import.meta.url === \`file://${process.argv[1]}\`` fails to match
    when the path contains a space or a symlink, and `main()` then never runs:
    measured, `(no output) EXIT=0` with the criterion-4 garbage token. **A
    preflight that exits 0 silently is an authorization to proceed on a dead
    credential** — §0's disqualifying class. Held to MINOR because it is
    unreachable on both deployed surfaces (measured) and is the repo-wide house
    idiom the packet itself told the worker to copy; the checker explicitly
    invited a boss to grade it MAJOR instead.
  - **MINOR-2 — my own patch comment leads with the retracted justification.**
    It opens with GAM-333's 8-of-13 figure, which `[R1-8]` established is
    0-of-13 *at push time*, and omits the run-log durability argument that
    actually justifies the step. In an artifact a human applies by hand, the
    comment is the product.
  Four NITs recorded, none actioned; the checker judged the worker's check-6
  SKIP call correct.
- `22:47Z` — **Both MINOR findings fixed rather than deferred, and each fix
  measured.**
  - MINOR-1: entrypoint guard now compares real paths
    (`fs.realpathSync` on both sides, `fileURLToPath` for this module) instead
    of the string idiom, plus three spawned tests — ordinary path, path with a
    space, symlinked path — which are the first coverage `main()` has ever had.
    **Mutation replay in `/tmp/gam403-guard-mutation` (item 23, committed
    first): restoring the old guard turns exactly the space and symlink tests
    red with `expected '' not to be ''`** — empty output, which is the
    silent-exit-0 signature itself. Reverted, green again, worktree removed.
  - MINOR-2: the patch's lead comment now leads with the run-log durability
    argument and explicitly says the 8-of-13 figure belongs to `--stage=pr`,
    so nobody re-derives a justification the gate rejected. Patch regenerated;
    `git apply --check` exits 0 and the post-apply YAML still parses with
    `GH_TOKEN` absent.
- `22:50Z` — **GATES (`/gate-run`, `--require-clean`, on `1448b5d`, tree clean):
  `PASS — 5 of 6`.** tsc 0, vite build 0, format:check 0, eslint 0 errors,
  vitest 99 files / **2546 tests** against baseline 2505 (+41). Gate 6 SKIPPED —
  no `src/` change, so no defensible scope — which packet §3 criterion 7
  predicted and required be reported as five, not six.
  One number worth stating rather than glossing: eslint reports **379**
  warnings where the gate-run skill's prose says the standing count is 377. I
  checked `origin/main` in a scratch worktree and it reports 379 too, and
  linting my two files alone reports nothing at all — **this branch adds zero
  warnings**; the skill's figure is simply stale.
