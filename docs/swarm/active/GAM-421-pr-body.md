Closes GAM-421 — the credential's 60-minute lifetime is now measured exactly, and `AGENTS.md` carries the rule that avoids it

> **Read this before merging.** Merging closes GAM-421, and **the underlying
> defect is not fixed by this PR** — fixing it is a choice among four options
> and the choice is yours. That decision is tracked in **GAM-425** so it is not
> lost when this row closes. If you would rather GAM-421 stay open, close
> GAM-425 as a duplicate instead and reopen this one.

## What changed

Four markdown files. No source code.

- **`AGENTS.md` — a third wall.** The "Two walls a dispatched run hits" section
  is now three. Wall 3 carries the measurement, the instruction to read your own
  deadline, the evidence, the **open-the-PR-early-as-a-draft** order, and a table
  of which credential survives the hour. This is the behavioural form of the
  issue's **option 3**, and unlike the automated form it needs no workflow patch.
- **`docs/swarm/active/GAM-421-run-log.md`** — the measurements, the premise
  gate's verdict, and two corrections I had to make against my own published
  claims.
- **`docs/swarm/active/GAM-421-packet.md`** — the HEAVY packet, kept because the
  gate's review of it is the record of why its code change was withdrawn.

## What the issue got wrong, and what I got wrong

**GAM-421 understated one thing.** Its Verification note says the one-hour
lifetime "is GitHub's documented behaviour … and was **not** independently
measured here", bounding it only between minute 6 and minute 74. It is now
measured and it is exact: the credential is a JWT that **states its own expiry**,
`iat 2026-08-20T00:46:26Z` → `exp 2026-08-20T01:46:26Z`, **3600 s**. No long run
was needed. Any run can read its own deadline at minute 1.

**GAM-421 named nearly the right variable.** It proposes "run duration … is the
variable this predicts". The data separates duration from time-of-attempt, and
it is the latter. Across all 50 dispatch runs and every PR in the repository:

| Measurement | Result |
| -- | -- |
| PRs `claude[bot]` has opened inside a dispatch run | 21 |
| …at or before minute 60 | **21** |
| …after minute 60 | **0** |
| Latest ever, worst-case attribution across concurrent runs | **53.2 min** (PR #205) |
| Only PR anywhere opened later | #162 at 81.9 min — opened by `gamitch`, not the bot |

But run #42 lasted **94 minutes and opened two PRs**, and run #47 lasted 73
minutes and opened PR #205 at minute 53 before running another 20. Run #6 lasted
60 minutes and opened none. **A long run is not doomed; a run that defers its PR
is.** That is why option 3 works and why the fix does not require runs to get
faster. This answers the re-analysis GAM-421 asked for and explicitly labelled a
hypothesis rather than a result.

**I got the credential model wrong mid-run, and the premise gate caught it.**
I published a claim that there is only one credential, that `git push` is on the
same 60-minute clock, and that "the branch is not a safe harbour". All three are
**false and are retracted**. `http.https://github.com/.extraheader` is present,
carries a distinct long-lived 93-char `github_pat_`, and **outranks** the remote
URL's userinfo (`scripts/dispatch-preflight.mjs:31-41`). My probe missed it
because it is not in `.git/config` local scope — it lives in
`/home/runner/work/_temp/git-credentials-*.config`, so `git config --local
--get-regexp` returns nothing where `git config --get` returns it. **GAM-421's
two-credential model is correct exactly as filed.** I re-measured this myself
rather than taking the gate's word; wall 3 records the gotcha so the next agent
does not repeat it. This also **restores the issue's option 2** — the cheapest
of the four — which my error had written off.

## Tier, stated and defended

**HEAVY**, judged at claim time as item 28d requires, and **not** relabelled
afterwards to match what was actually built.

- **Trigger:** the credential path of the external dispatch write path. Item 26's
  HEAVY list names auth logic and "an export another session builds against";
  every later run builds against this, and a wrong credential path strands all of
  them rather than one task.
- **Losing argument:** options 2 and 4 are a settings toggle and a doctrine
  change — near-zero code, arguably STANDARD. Item 26 resolves an arguable pair
  to the heavier tier.

**Process deviation, declared rather than hidden.** This row got the HEAVY
premise gate. It did **not** get a worker or a `checker-reviewer`, because the
gate removed all production code from scope (below). What remains — the run log,
this body, `AGENTS.md` — are records the orchestrator owns and which the
constitution forbids a worker to edit. A worker with nothing it is permitted to
touch is ceremony, not verification.

## Verification

**The premise gate is the verification here, and it did real work.**
`checker-premise` (opus) returned **REVISE / BLOCKER** on my packet, ~94K tokens,
round 1 of item 19a's two. It falsified a claim I had already published, and it
killed the code change I intended to ship. Both of its BLOCKERs were correct:

1. **Nothing in this repository invokes `scripts/dispatch-preflight.mjs`.** No
   workflow step, no `AGENTS.md` order, no skill or hook. GAM-403's wiring is
   still an unmerged patch behind the credential wall. The `pr-window` check I
   specified would have shipped **dormant**. Verified by repo-wide grep. Refiled
   as **GAM-424**.
2. **My acceptance criterion 1 was not runnable** — the test file imports
   `vitest`, so `node --test` dies with `ERR_MODULE_NOT_FOUND`.

It also corrected an overbroad forbidden-files citation in my packet.

**Gates — run on the final committed branch state, `--require-clean`, five of
six.** Not "all six": gate 6 is genuinely skipped and the block says so.

```
GATE RUN — d66fddb on claude/gam-421-token-expiry-pr-window — tree clean

  1 tsc              exit 0  PASS
  2 vite build       exit 0  PASS
  3 format:check     exit 0  PASS
  4 eslint           exit 0  PASS       0 errors, 380 warnings
  5 vitest (full)    exit 0  PASS       100 files / 2566 tests  (no baseline given — regression not checked)
  6 vitest (scoped)      –  SKIP
                            no scope given and none derivable from the diff -- pass --scope <path> to run it

VERDICT: PASS — 5 of 6 gates. NOT all six: 1 skipped.
```

Gate 6 has no defensible scope because this branch changes **four markdown files
and zero `src/` files** — there is no path to scope it to. Gate 5 ran without a
baseline and the block says so rather than implying a comparison happened; for
the same reason (no source changed) the full-suite count cannot have regressed.
The 380 eslint warnings are the repo's standing pre-existing count — the
`gate-run` skill documents 377, and the difference predates this branch, which
touches no lintable file.

**No mutation was replayed, because no behaviour changed.** Item 26's fast path
requires a named mutation that turns a test red; there is no code here to mutate.
Saying so is more honest than manufacturing one — and per the `gate-run` skill,
green gates would not have answered that question anyway.

## Scope (item 27)

No user-visible surface. Nothing here reads from a fixture or a stub — the
figures are measurements taken from the live credential and the GitHub API
during this run. Not a Partial.

## Follow-ups filed

Both to `Backlog` carrying `tier/unreviewed`, per GAM-382 — promotion to `Todo`
is your signal, not mine.

- **[GAM-424](https://linear.app/gamitch/issue/GAM-424/the-dispatch-credential-preflight-is-dead-code-nothing-in-the)** —
  the preflight is dead code; nothing invokes it. Half of the fix
  (`--stage=pr` as an `AGENTS.md` standing order) is **not** behind the
  credential wall and can ship today. Carries the full `pr-window` specification
  for after it has a caller.
- **[GAM-425](https://linear.app/gamitch/issue/GAM-425/choose-the-fix-for-the-expiring-pr-credential-gam-421-measured-the)** —
  the decision this PR deliberately does not make. All four options with what
  each now costs, given that option 2's PAT is confirmed present.

## Known gaps, disclosed

- **The defect is mitigated, not fixed.** Wall 3 is an instruction to an agent,
  not a mechanism. A run that ignores it fails exactly as before. Options 1 and 2
  are mechanical; this is not. GAM-425 carries that argument.
- **No workflow patch is preserved here.** The gate asked for one under
  `AGENTS.md` lines 90-94 and the GAM-403 precedent, and it was right to ask.
  I did not produce it: with one gate round left and ~19 minutes of credential
  remaining, I chose correcting a false published claim and shipping wall 3 over
  authoring a patch whose option the owner has not chosen. Writing option 1's or
  option 3's patch before that choice risks preserving the wrong one. **This is a
  disclosed omission, not an oversight** — GAM-425 is where it lands once an
  option is picked.
- **`exp` is an upper bound on validity, not a guarantee of it.** Nothing here
  measures whether GitHub revokes earlier. Wall 3 says "no later than".
- The GAM-333 re-analysis shows zero bot PRs after minute 60, which is
  *consistent with* the expiry mechanism and does not alone prove it — PRs never
  attempted are absent from that population by construction. The direct JWT
  measurement is what establishes the mechanism; the correlation corroborates it.
- **Operational note from the gate, worth one line of your attention:** the
  long-lived PAT is recoverable in plaintext from the extraheader by anything
  running in the workspace, and `redact()` cannot see it there because it is
  base64-encoded inside `AUTHORIZATION: basic …`. That is stock `actions/checkout`
  behaviour and is not introduced here, but any future step that dumps
  `git config` output into a run log or Step Summary would leak it past the
  redaction backstop.

Linear-Issue: GAM-421
