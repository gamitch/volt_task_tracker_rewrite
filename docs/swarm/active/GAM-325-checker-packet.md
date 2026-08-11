# GAM-325 — checker packet (HEAVY)

Issue: [GAM-325](https://linear.app/gamitch/issue/GAM-325/build-the-explicit-linear-closer-pr-merge-declares-its-issue-one-sync)
Task packet under review: `docs/swarm/active/GAM-325-packet.md` **draft 3**
Premise gate: `GAM-325-gate-round1.md` (REVISE), `GAM-325-gate-round2.md` (final)
Written: 2026-08-11, orchestrator run 3

You are `checker-reviewer`. A worker cannot self-certify (item 26). Review the
lane's diff against **its own lane's acceptance criteria in draft 3** and against
the constraints below. Report findings by severity; do not edit code.

---

## 1. What this build is, in one paragraph

Merging a PR currently closes whatever Linear issue its branch name or title
happens to mention. This build replaces that with an explicit declaration:
`Closes GAM-nnn` on **body line 1**, one sync script that writes the state on the
merge event, and a named reason for every refusal. It ships in **shadow mode** —
computing and posting what it *would* do, writing nothing to the tracker.

## 2. The three things that make a finding a BLOCKER here

The failure this row exists to remove is the **silent** one. Weigh findings by
failure *direction*, not by size.

1. **Anything that can move a Linear issue while `SYNC_MODE` is not the exact
   string `live`.** Shadow mode must suppress the `issueUpdate`, the claim
   comment, and the "closed without merge" comment. Trace every write path; do
   not accept "the mode is checked at the top" without following each branch.
   A typo in the env value must fail *toward* shadow.
2. **Anything that turns a refusal into silence.** Every skip must carry one of
   the packet's verbatim codes and reach Slack. A code path that returns without
   an explicit exit code, or swallows a condition without naming it, is a
   BLOCKER even when it "works".
3. **Anything that reads a declaration from somewhere other than body line 1** —
   title, branch, commit message, a later body line. `branchIssue()` exists only
   to *cross-check* a declaration, never to supply one. The whole point of the
   row is that exactly one text channel is authoritative.

## 3. Boundary checks — run these before reading the logic

* **Allowed Files.** Each lane's table row in draft 3 §1 is exhaustive. A file
  outside it, in either direction, is a BLOCKER. Confirm with `git diff --name-only`.
* **`scripts/linear/client.mjs` is unmodified** and its logic is not copied.
  `git diff --stat` must not list it.
* **Nothing under `docs/swarm/**`, `.claude/**`, `AGENTS.md`, `package.json`,
  `eslint.config.js`, `vite.config.ts`** is touched by a worker, nor any existing
  workflow (`ci.yml`, `linear-export.yml`, `claude-linear-dispatch.yml`).
* **Out-of-scope work is a BLOCKER, not a bonus** — draft 3 §1 lists it:
  `SYNC_MODE` live by default, branch protection, disabling `merge → Done`,
  editing item 28f/28g or `WORKFLOWS.md`, a `REVERT_MERGED` heuristic, the
  `Also-fixes:` reminder state machine, or re-adding the `pull_request_target`
  apparatus. Round 6 of the design cut the last three deliberately; re-adding one
  without a measurement is the specific thing the issue forbids.
* **No secret value is ever printed.** The measure step prints booleans only.
  Grep the diff for `echo` near `secrets.`.

## 4. Evidence you must check rather than accept

The worker reports exit codes. Verify the ones that are cheap to re-run, and
**re-read the mutation proof rather than trusting its narration**:

* `npx eslint .`, `npm run typecheck`, `npm run test`, `npm run format:check`.
* The suite baseline is **83 test files / 2162 tests** (measured three times,
  most recently on run 3's container, 2026-08-11). The lane's after-count must
  differ by exactly the tests it added. A count that moved by more means it
  changed something it did not claim to.
* `format:check` scopes to `src/**` plus root configs, so `scripts/**` and
  `.github/**` are outside prettier's reach **by design**. A worker who adds
  them to the format globs has edited a protected config — BLOCKER.
* **The named mutation.** Item 26: the worker changes one thing, shows the test
  going red *with its real output*, restores, shows green. A mutation proof with
  no pasted failure output is not a proof. Check that the mutation actually
  targets the behaviour the criterion names — mutating an unrelated line and
  watching an unrelated test fail is the common cheat.

## 5. Lane-specific traps, drawn from the gate rounds

**Lane A** — the parse is the contract three files depend on. Check the strictness
cases individually: `Closes GAM-3251` must not yield `GAM-325` (the `\b`);
`Closes  GAM-325` (two spaces), `Closes: GAM-325` and `closes gam-325` are all
`HALF_DECLARATION`, not `ok`; a body whose line 1 is blank has **no** declaration
even if line 3 is canonical; `This PR does not close GAM-304` (a real PR's shape)
is `HALF_DECLARATION`. `parseAlsoFixes` must never close anything.

**Lane B** — (a) the write order is **claim comment → `issueUpdate` → read-back**,
and the read-back mismatch is the *one* place the script may exit non-zero;
(b) gate finding **F4**: the shadow history fixture must be built from the
worker's own printed probe of GAM-303, and the worker must have pasted that raw
response — a fixture matching the packet's prose but not the probe is a finding;
(c) gate finding **F2**: with no `merge → Done` automation present, the run emits
`INCUMBENT_DISABLED` and emits **neither** `MATCH` nor `MISMATCH`;
(d) claim detection parses the HTML marker `<!-- linear-sync:claim pr=N run=M -->`
and **never** matches prose — this is what separates `ALREADY_DONE` from
`DUPLICATE_CLOSE_CLAIM`.

**Lane C** — the gate must **never conditionally skip**: no `if:` on the job or on
any step, and every path exits an explicit 0 or 1. A required check that skips
reports Success and blocks nothing, which is the trap the issue names by name.
The sweep reads **state history, never `completedAt`** — measured on GAM-303,
where a reopen/re-close left `completedAt` frozen while only the history recorded
the truth. Confirm the fixture makes the two disagree, or the test proves nothing.

**Lane D** — gate finding **F1**: the three top-level `name:` keys must be exactly
`Linear sync`, `Linear declaration`, `Linear reconcile`, because an owner action
subscribes `#tracker` by workflow name and any other spelling matches nothing.
`queue: max` present exactly once and **never** paired with
`cancel-in-progress: true` (that pair is a validation error). The
`inputs.pr_number` → `env: PR_NUMBER` mapping must exist or lane B's replay path
is unreachable — a silent no-op, this project's named recurring defect shape.
Gate finding **F3**: lint passing on YAML proves nothing about whether GitHub will
accept it; criterion 10's parse-and-run proof is the orchestrator's at
integration, and you should confirm it was actually recorded rather than assumed.

**Lane E** — the notifier rides *after* the dispatch decision, tolerates its own
failure, and must not change `index.ts`'s status or body **byte-for-byte** whether
it succeeds, fails, or is absent. Absent `SLACK_WEBHOOK_URL` is the *normal quiet
path*, not an error — the secret does not exist yet. The 5 s budget must not move.

## 6. What you must not re-litigate

Premise gate round 1 ruled these settled, and round 2 was told not to re-derive
them. Neither should you, absent a measurement:

* the strict line-1 parse (measured against all 30 real PRs in #124–#153);
* gate rule 4 (red when the canonical form appears on a later line) — ruled keep;
* the 120 s shadow window — it degrades a comparison, never a write;
* the five-lane split, the behaviour table, the claim-comment format, and §5.0's
  owner-owned secrets.

## 7. Your verdict

**PASS** / **FAIL with numbered findings** (BLOCKER / MAJOR / MINOR), each naming
the file, the line, the criterion it violates, and what would make it right. If a
worker's evidence is *unverifiable* rather than wrong — a mutation proof with no
output, a count that cannot be reproduced — say so and mark it FAIL; under item 27
an unmeasured green is a green measured against nothing.
