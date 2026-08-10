# 2026-08-09 — building the dispatch webhook: what was done, what broke, what to build next

Companion to `2026-08-09-linear-webhook-dispatch.md`, which is the design and runbook. This is the
session record: the order things happened in, the defects found, the mistakes made, and a proposal
for the skills this work suggests should exist.

**One-line summary:** the webhook went from nothing to live in one session; the two most valuable
outputs were a filter bug caught one commit before it would have silently disabled the queue, and a
CI gap that had left 224 tests unenforced since T032.

---

## 1. What was asked, and what shipped

The brief was §9 of the design doc, written by the previous session: resolve four UNVERIFIED items
first because any of them could invalidate the design, then build the edge function with `deno test`
coverage for signature verification and event filtering, mirroring `checkin/hmac.test.ts`.

| Shipped                                            |                                                                |
| -------------------------------------------------- | -------------------------------------------------------------- |
| `supabase/functions/linear-dispatch/`              | 4 modules, 45 tests                                            |
| `.github/workflows/claude-linear-dispatch.yml`     | `repository_dispatch` → `claude-code-action@v1`                |
| `.github/workflows/ci.yml`                         | new `edge-functions` job — 269 Deno tests across 6 directories |
| `supabase/config.toml`                             | `[functions.linear-dispatch] verify_jwt = false`               |
| `docs/swarm/2026-08-09-linear-webhook-dispatch.md` | design + runbook, merged with the prior session's              |
| `GAM-310`                                          | the setup runbook as a tracked issue                           |
| PRs #132, #134                                     | the build; the close-out and the item 28f correction           |

Beyond the brief: the CI job (§5), the item 28f correction (§4), and driving all seven setup steps
to a proven live state rather than stopping at "built".

---

## 2. The order things happened

1. **Read both docs.** The webhook doc did not exist locally — it was the _output_ of the previous
   session and had landed on `main` in PR #130 while this branch was cut from an older commit. That
   collision surfaced later as a merge conflict (§4).
2. **Resolved the four UNVERIFIED items before writing any code.** Web research plus reading
   `claude-code-action`'s source. Details in the design doc §4.
3. **Built the function**, splitting pure judgement (`filter.ts`, `signature.ts`) from side effects
   (`index.ts`, `dispatch.ts`) so the tests need no network.
4. **Wrote 39 tests, then proved them** by mutating three guards and watching each go red.
5. **Discovered CI had no Deno job** while wiring the tests in. Fixed for all six function
   directories.
6. **Filed `GAM-310`** via the Linear MCP, per constitution item 30 and the `linear-task-writing`
   skill.
7. **Reading the live label set for that filing exposed the filter bug** (§3). Fixed; tests to 45.
8. **Setup steps 1–7**, driven interactively with the owner: PAT → secrets → merge → deploy →
   webhook → live dispatch → negative case.
9. **A live agent worked `GAM-308`** and opened PR #133, reviewed in the design doc §9a.

---

## 3. The defect that nearly shipped

**`tier/fast` is not a label name.** Every document in this project writes the tiers with slashes,
and `linear-export.json` contains those strings verbatim. The obvious inference — that a Linear label
called `tier/fast` exists — is false. Linear stores a label **group** `tier` whose children are named
bare: `fast`, `standard`, `heavy`, `unreviewed`. The slashes are synthesised by
`scripts/linear-export.mjs`:

```js
.map((l) => (l.parent ? `${l.parent.name}/${l.name}` : l.name))
```

The filter matched `name.startsWith('tier/')`. It would have matched **nothing, ever** — skipping
every issue with the plausible-sounding reason `NO_TIER_LABEL`, producing a queue that never
dispatches and a log full of lines that each look like a correct decision.

**Why it was caught:** filing `GAM-310` required listing the real labels, and the API returned
`["unreviewed","human"]`. Not a review, not a test — a side effect of doing an unrelated task
against live data. That is uncomfortably close to luck.

**Why the tests would not have caught it:** the fixtures were written from the same wrong premise as
the code. Both said `tier/standard`. A test written from the implementer's assumption cannot
falsify the assumption. Reverting the fix now turns 6 tests red, but those 6 tests only exist
because the live data contradicted the docs first.

The generalisable lesson, and it is not the one the project already has: **a citation can be
accurate about a derived form and wrong about the source.** The export was not stale or mistaken —
it was correct, and correctly describing something that had been transformed on the way out.

---

## 4. Mistakes made in this session

Recorded because the pattern is more useful than the list — the same convention as the migration
doc's §6.

| Mistake                                                                                                                                                                                                             | How it was caught                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| The first mutation run piped `deno test` through a `grep` that did not strip ANSI codes, so all three mutations printed **nothing** — and I nearly reported the guards as proven                                    | the output was suspiciously empty; re-ran with `sed` stripping escapes and got real failures                                                         |
| Mutations B and C then failed to **type-check** rather than fail behaviourally — a compile error is not evidence a test guards anything                                                                             | read the actual error instead of the exit code; rewrote both as mutations that compile                                                               |
| The test helper used destructuring defaults, so `issueEvent({ labels: undefined })` would have silently restored the default and the "missing field" tests would have passed against the fully-populated happy path | caught by reasoning before the first run; switched to spread, which preserves explicit `undefined`                                                   |
| Wrote the filter against `tier/*` from the documents rather than the live label set                                                                                                                                 | listing labels to file `GAM-310` (§3)                                                                                                                |
| Built the auth smoke test `on: push`, which `claude-code-action` rejects outright                                                                                                                                   | the run failed in 340 ms with `Unsupported event type: push`                                                                                         |
| Diagnosed the missing `pull_request` runs as GitHub App token recursion                                                                                                                                             | wrong; `ci.yml` had 681 historical `pull_request` runs, which ruled out a repo-level cause and pointed at the PR itself — `mergeable_state: "dirty"` |
| Flagged `claude[bot]` authoring PR #133 as the CI-blocking trap                                                                                                                                                     | wrong; CI had already run green — the _push_ used `CLAUDE_PR_TOKEN`, which is what CI triggers on                                                    |
| Recorded `STATE_UNCHANGED` for step 7 from the mechanism rather than from a log line, because the Supabase MCP dropped out mid-check                                                                                | flagged in the handover rather than presented as observed                                                                                            |

**The recurring shape, again: a verification that cannot fail.** Three of these are the same defect
in different clothes — a grep that matches nothing, a mutation that never runs, a fixture that
encodes the bug it should catch. This project already knows that guards must be proven by making
them fire. What this session adds is that **the proving apparatus needs the same treatment**: a
mutation run that prints nothing is indistinguishable from one that passed.

---

## 5. Found on the way: 224 tests nothing ran

`ci.yml` had three jobs and no Deno job. Five function directories carried 21 `*.test.ts` files —
**224 tests** — and CI executed none of them, including the `checkin` HMAC tests this task was told
to mirror, unenforced since T032.

Two details, both measured rather than assumed:

- **Per-directory, not one root-level run.** Each function owns a `deno.json`, and Deno applies the
  config nearest the working directory; the root-level form resolves every function's npm specifiers
  against the wrong config and dies at _collection_, before running a single test.
- **`--allow-env --allow-read`** — `send-invite` and `send-reminders` read `RESEND_*` to prove their
  fail-closed defaults.

The loop **discovers** directories rather than listing them, and errors if it finds none — a green
tick over an empty loop is the failure the job exists to prevent.

---

## 6. Item 28f's mechanism is false

PR #132 deliberately withheld `Closes GAM-310` because only three of seven steps were done, relying
on item 28f's claim that a title identifier _"links only"_. Linear closed the issue on merge anyway.

**The automation the migration doc lists as outstanding — "PR merged → Done" — is already live.** So
omitting the magic word is not a way to keep an issue open. Either keep the identifier out of the
title, or give partial work its own issue. PR #134 applies this to itself.

---

## 7. Skills worth creating

Filtered by one test: _did this cost real time today, and will it recur?_ Generic advice was
rejected; each of these encodes a specific sequence that was expensive to derive.

### 7a. `opaque-secret-handoff` — **strongest candidate**

**The problem.** A secret you cannot read back after setting. GitHub Actions secrets, Supabase
function secrets, Linear signing secrets — all write-only. "Did it paste correctly?" has no direct
answer, and the failure surfaces much later as an opaque auth error attributed to the wrong thing.

**What it cost today.** `CLAUDE_CODE_OAUTH_TOKEN` arrived with a whitespace character from a
terminal line-wrap. Left undetected it would have surfaced at setup step 6 with a live webhook, a
PAT, an edge function and a workflow all newly in play, any of which would have looked equally
guilty.

**What the skill encodes:**

- Capture with `IFS= read -rs VAR`, never as a command argument — a shell-history leak _and_ the
  cause of one wasted run today (`read -rs TOKEN github_pat_…` assigns nothing; `read` takes variable
  _names_).
- Sanitise with `tr -d '[:space:]'`, because a credential never legitimately contains whitespace and
  this fixes leading, trailing and embedded cases alike.
- Verify shape without printing the value: `echo "len=${#VAR} prefix=${VAR:0:11}"`.
- Copy with `printf %s`, never `echo` — the trailing newline is the classic corruption.
- Then **prove it with a use, not an inspection.** A throwaway job that (1) fails loudly on
  whitespace or an empty value, (2) classifies the prefix, and (3) performs one real authenticated
  call. Delete it afterwards.

That last step is the part worth packaging: today's smoke workflow caught the corruption _and_
established a separate fact about the action's supported events, in ten lines of YAML.

### 7b. `why-did-no-workflow-run` — **strong candidate**

**The problem.** A workflow that does not run produces no error anywhere. Absence is the only
symptom, and at least six unrelated causes produce it identically.

**What it cost today.** Three of them, in one session:

| Cause                                                       | How it presents                                                                    |
| ----------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `repository_dispatch` only runs from the **default branch** | the API returns **204** — success — and nothing happens                            |
| The action rejects the event type outright                  | run appears, dies in ~340 ms                                                       |
| PR is `mergeable_state: "dirty"`                            | **no `pull_request` runs at all**, because there is no merge commit to run against |
| `workflow_dispatch` absent from the default branch          | no "Run workflow" button, no API trigger                                           |
| Commits pushed with `GITHUB_TOKEN`                          | no runs, by deliberate recursion prevention                                        |
| A filter upstream skipped correctly                         | indistinguishable from all of the above                                            |

**What the skill encodes:** the differential, in cheapest-first order, with the discriminating check
for each. The one that saved the most time today was _"query whether this workflow has ever run on
this event type"_ — 681 historical `pull_request` runs immediately ruled out a repo-level cause and
pointed at the PR's own state.

### 7c. `third-party-webhook-bringup` — **worth it, less frequent**

**The problem.** Standing up a signed webhook endpoint has a fixed set of decisions that are easy to
get subtly wrong, and a bring-up order that is not obvious.

**What the skill encodes** — the design invariants first:

- **Verify before parse, over the raw body.** `JSON.stringify(JSON.parse(x))` is not byte-identical
  to `x`; a signature check over a re-serialised object either always fails or silently compares the
  wrong bytes.
- **Freshness needs an explicit type guard.** `undefined - now` is `NaN`, every comparison against
  `NaN` is false, so the naive `elapsed > tolerance` lets an _unstamped_ delivery pass as fresh.
- **Status codes are a contract with the sender's retry logic** — a correct decision not to act is a
  2xx; a misconfiguration is a 5xx; a bad signature is 401 even though retrying will not help,
  because 2xx tells a prober their unsigned request was accepted.
- **Every skip carries a machine-readable reason**, in the response body and the log.

...then the **bring-up ladder**, which is the reusable part. Each rung is an expected _failure_ that
proves one specific thing:

| Step                                  | Expected                          | Proves                                                   |
| ------------------------------------- | --------------------------------- | -------------------------------------------------------- |
| Deploy, curl unsigned, no secrets set | `500`, naming the missing secrets | the platform auth gate is off and your code is executing |
| Set secrets, curl unsigned            | `401 INVALID_SIGNATURE`           | the handler owns authentication now                      |
| Real delivery that should be filtered | `200` + the _expected reason_     | the filter runs and its reasons discriminate             |
| Real delivery that should act         | the action happens                | the whole chain                                          |

Rung 3 is the one people skip, and it is the only one that distinguishes "filtering correctly" from
"dropping everything".

### 7d. Amend `shared-doc-merge` rather than add a skill

Today's conflict was an **add/add on two narrative documents at one path** — the prior session's
design and this session's build record. The skill correctly says this is not the mechanical case and
to "read both and decide on the merits", but offers no method for that case.

Worth adding: the **loss check for prose**. Extract each side's distinctive claims and grep the
merged result for all of them. Applied here it caught one apparent loss (a false positive from line
wrapping, confirmed by re-checking with whitespace normalised) and confirmed twelve genuine
survivals — including Linear's 5-second timeout and retry schedule, which the build half had never
measured and would have silently dropped.

### Rejected

- **A "verify the verifier" skill.** The three self-inflicted failures in §4 argue for it, but the
  fix is a habit — _look at the output, not the exit code_ — not a procedure. `mutation-replay`
  already owns the surrounding discipline; a note there would serve better than a new skill.
- **A Linear-webhook-specific skill.** Too narrow. The reusable content is 7c; the Linear specifics
  belong in the design doc, where they are.

---

## 8. Follow-ups that are not skills

1. **Nothing reports a skipped dispatch.** The sharpest open item. Every guard in this system was
   proven by making it fire, except the one that would tell you the queue has silently stopped. A
   skip for a _wrong_ reason looks exactly like a quiet week. Options, cheapest first: a scheduled
   check that the last successful dispatch is not older than N days; the function posting a Linear
   comment on any skip whose reason is not `NOT_TARGET_STATE`/`STATE_UNCHANGED`; or log-based
   alerting.
2. **Item 28f needs correcting in the constitution** (§6). Deliberately not done from a document —
   item 3 puts rules in one place.
3. **Whether Linear re-stamps `webhookTimestamp` on retry** is still unverified, and decides whether
   the 1-hour and 6-hour retries are usable at all.
4. **`--allowedTools`, `--max-turns 80` and `timeout-minutes: 60`** have exactly one data point
   between them (8m 02s on a `tier/fast` issue).
