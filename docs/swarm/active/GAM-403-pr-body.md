Closes GAM-403

**Read this part first: half of this change cannot be delivered by the run that
wrote it.** The preflight step, the two token pins and the prompt paragraph all
live in `.github/workflows/claude-linear-dispatch.yml`, which neither credential
a dispatched run holds is permitted to push (GAM-328). That half is preserved as
an applyable patch at **`docs/swarm/active/GAM-403-dispatch-preflight.patch`**
and needs an owner to apply it as a normal PR, the #159→#160 pattern:

```
git apply docs/swarm/active/GAM-403-dispatch-preflight.patch
```

`git apply --check` exits 0 against this branch, the post-apply YAML parses, and
the resulting step order is `Checkout → Credential preflight → Work the issue`.
**Until that patch is applied, the script on this branch is not wired to
anything** — merging this PR alone changes no runtime behaviour.

## What changed

`scripts/dispatch-preflight.mjs` (new, stdlib-only) probes the dispatch loop's
credentials before expensive work, in two stages because the two credentials do
not exist in the same place:

- `--stage=push` runs as a workflow step before the agent starts, and proves the
  branch-publication credential can actually write refs.
- `--stage=pr` is run by the agent as its first act, and proves the PR-creation
  credential is authorized — that credential is minted by
  `claude-code-action` and does not exist before it.

Both fail loudly and terminally. Neither creates a pull request or a branch: the
PR probe posts `head == base`, which fails *validation* after passing
*authorization*, and the write probe pushes to `refs/preflight/*`, which is
outside `refs/heads/**` and so triggers no CI (measured), then deletes it.

The workflow patch also replaces both `secrets.CLAUDE_PR_TOKEN || github.token`
expressions that plan §5.3 forbids for changing behaviour with secret
availability.

## What the issue got wrong, and what the premise gate falsified

The issue is correct on every citation it makes. What it does not contain is the
fact that inverts the obvious fix — **the two credentials are close to
complementary, and each fails at what the other does:**

| Probe | `CLAUDE_PR_TOKEN` (PAT, `gamitch`) | agent's `GH_TOKEN` (`claude[bot]` App) |
| -- | -- | -- |
| `GET /user` | `200` | `403` |
| `GET /repos/{repo}` `.permissions` | all true | **all false — a false negative** |
| push a ref | ✅ | ✅ |
| create a PR | **`403` forbidden** | **`422` validation → authorized** |

So "pin `GH_TOKEN` to the proven push token", which is what §5.3 reads like at a
glance, would have handed the agent the one credential that cannot open a pull
request — breaking the only PR path that has ever worked here. Every PR a
dispatched run has opened was authored `claude[bot]`, never as the PAT. **The
patch therefore deletes that line rather than pinning it**, which is
behaviour-preserving today (the action overwrites `GH_TOKEN` with its own App
token regardless) and is literally §5.3's "pin the proven GitHub App path".

Two further corrections worth inheriting:

- **`.permissions` must never be the instrument.** The App token reports
  `push:false` and then pushes successfully. Capability is probed by attempting
  the operation.
- **The 8-of-13 stranding figure does not justify the push stage.** Those runs
  are 8-of-13 stranded at *PR* time and **0-of-13 at push time**. The push
  stage is justified instead by the run-log durability contract: if pushing is
  what is broken, the run produces no log, no branch and no artifact, and
  nothing else in the system says so.

## Tier: HEAVY, and it earned the cost twice

Item 26 triggers: this changes what the external dispatch write path does
*first*, and it ships an export another session applies by hand. The losing
argument was STANDARD — "one script and its tests, no product code" — which is
true about the diff and wrong about the blast radius: a preflight that wrongly
passes authorizes a doomed run, which is the failure it exists to prevent.

**The premise gate found a BLOCKER that no amount of reading would have found**,
and it found it by running the prescription. In an `actions/checkout` workspace,
`http.…extraheader` outranks a credential embedded in a push URL, so the obvious
probe authenticates as the *checkout's* credential:

```
$ git push "https://x-access-token:ghp_FAKEfake…@github.com/…" HEAD:refs/preflight/x
 * [new reference]   HEAD -> refs/preflight/x          <-- PASS, with a garbage token
```

The shipped probe passes `-c "http.https://github.com/.extraheader="` on both the
push and the delete, which the gate verified fails on a fake token and passes on
both real ones. **The first design would have shipped a preflight that reports
healthy for a dead credential** — the exact defect this issue was filed about,
reproduced inside its own fix.

Round 2 then found that the redaction rule leaked the credential it was written
to hide: `ghs_[A-Za-z0-9_]+` stops at the first `.`, and the installation token
is JWT-shaped, so **342 of 390 characters of a live write-capable token
survived** — while the acceptance criterion and the natural unit test both went
green, because a hand-written fake token has no dots in it.

## Verification

```
GATE RUN — 1448b5d on claude/gam-403-dispatch-credential-preflight — tree clean

  1 tsc              exit 0  PASS
  2 vite build       exit 0  PASS
  3 format:check     exit 0  PASS
  4 eslint           exit 0  PASS       0 errors, 379 warnings
  5 vitest (full)    exit 0  PASS       99 files / 2546 tests  baseline 2505 (+41)
  6 vitest (scoped)      –  SKIP
                            no scope given and none derivable from the diff -- pass --scope <path> to run it

VERDICT: PASS — 5 of 6 gates. NOT all six: 1 skipped.
```

Gate 6 is SKIPPED because the change touches no `src/` file, so there is no
defensible scope — five, not six. eslint's 379 is not a regression: `origin/main`
reports 379 too, and linting the two new files alone reports nothing.

**Mutations run, not described:**

| Mutation | Expected | Measured |
| -- | -- | -- |
| Invert the `422`/`403` classification | packet's named test turns red | `3 failed \| 35 passed`, exit 1, incl. `422 … -> PASS (the authorized case)` → `expected 'FAIL' to be 'PASS'` |
| Restore the old entrypoint guard | space/symlink tests turn red | 2 failed, `expected '' not to be ''` — empty output, the silent-exit-0 signature itself |

**Live credential checks, re-run by the orchestrator and again by the checker
rather than taken from the worker's report:**

| Run | Result |
| -- | -- |
| `--stage=push`, real PAT | every line PASS, `exit 0`; `refs/preflight/*` empty afterwards |
| `--stage=push`, garbage token | `ref-write … exit 128: Invalid username or token`, `exit 1` |
| `--stage=pr`, ambient `GH_TOKEN` | `422 "No commits between"`, credential reported as `installation token`, `exit 0` |
| probe's effect on CI | no workflow run created |

The garbage-token run is the one that matters: it fails **and names the
ref-write check**, even though repo-access already failed, because the checks do
not short-circuit. A version that passed here would be worthless.

`redact()` was verified against the **live** 390-character `ghs_` token, not a
fixture: zero surviving 20-character substrings, and ordinary report text passes
through byte-identical.

## Scope

Item 27 does not apply — no user-visible surface, no fixture standing in for
real data. The preflight reads real credentials on the real path a dispatched
run takes to reach them, which is why every acceptance criterion is a live run
rather than a mock.

## Follow-ups filed

- **GAM-421** (`Backlog`, `tier/unreviewed`) — **the case this preflight cannot
  catch, found by this run living it.** The `claude[bot]` installation token
  that opens pull requests expires about an hour after it is minted, and a
  HEAVY run takes two. Measured on this very run: `POST /pulls` was authorized
  (`422`) at minute 6 and returned `401 Bad credentials` at minute 74. A
  preflight is a snapshot; this is a clock, so no amount of checking at minute 1
  prevents it. **That is why this PR was opened by hand** — see the note at the
  end. It also offers a candidate answer to GAM-333's unresolved question about
  which runs strand: run *duration*, not wall-clock window.
- **GAM-420** (`Backlog`, `tier/unreviewed`) — the same entrypoint-guard defect
  in the five sibling `scripts/*.mjs`, including `linear-assert-released.mjs`,
  where a silent exit 0 makes the `assert-released` job go green without
  checking anything. Fixed here for `dispatch-preflight.mjs` only; the other
  five are that row.

## Known gaps, disclosed

1. **The acceptance checker graded the entrypoint-guard defect MINOR and
   explicitly invited a boss to call it MAJOR.** I fixed it rather than
   deferring it, and added the three spawned tests `main()` never had — but the
   judgement that it was not a task-failing finding was the checker's, and it
   rested on the deployed paths having no spaces or symlinks, which is measured
   but is a fact about today's runner.
2. **The CI-trigger check is `DERIVED`, not measured**, and its report line says
   so. It infers from the credential's identity that pushes will trigger
   workflows; measuring it directly would require pushing a branch, which would
   run the full CI suite and violate the issue's own constraint.
3. **`--stage=push` cannot verify PR-create capability**, because that
   credential does not exist until the action runs. That is why the prompt
   paragraph exists, and it is why applying only part of the patch would leave
   the more common failure (8 of 13) uncovered.
4. **Two NITs left unfixed and deliberately not filed** (the severity rules log
   NITs rather than requiring a row): `GITHUB_REPOSITORY` is not explicitly
   validated, so a missing value reports `GET /repos/undefined returned 404`
   rather than naming the variable; and a transient network error maps to
   `status: 0` and fails closed with no retry, which is correct but means a DNS
   blip on the runner halts the dispatch loop.
5. **A worker disclosed running `git remote -v`**, which echoed a live `ghs_`
   token into its own transcript. Nothing landed in a committed file — verified
   by scanning every tracked file — and the token is job-scoped and dies with
   the run, so there is nothing to rotate. Recorded because a disclosed exposure
   is the only kind anyone can act on.

---

**This PR was opened by hand, because the run that wrote it could not open it.**
At minute 74 the run's `GH_TOKEN` returned `401 Bad credentials` and
`gh pr create` failed; the PAT is still alive and still pushes, but is measured
at `403` on PR creation. Everything above was written by the run before it
attempted the API call, and is published verbatim. GAM-421 is that failure,
filed with its measurements.

Linear-Issue: GAM-403
