# 2026-08-09 — the Linear → Claude dispatch webhook

Companion to `2026-08-09-tracker-migration.md`. That document moved the queue to Linear and left
dispatch as a manual act: the owner drags a card to `Todo`, then separately goes and starts an agent.
This one closes that gap — the drag *is* the dispatch.

**One-line summary:** four constraints could each have invalidated the design; all four were
resolved before any code was written, and one of them changed the design.

---

## 1. Where things stand

| | |
|---|---|
| Trigger | an issue enters `Todo` in Linear team `Gamitch` |
| Transport | Linear webhook → Supabase Edge Function `linear-dispatch` → GitHub `repository_dispatch` |
| Runner | `.github/workflows/claude-linear-dispatch.yml` → `anthropics/claude-code-action@v1` |
| Auth, inbound | HMAC-SHA256 over the raw body (`Linear-Signature`) + a 60s replay window |
| Auth, outbound | a **human-owned** GitHub PAT |
| Tests | 45, `deno test supabase/functions/linear-dispatch/` |
| Status | **built and unit-tested; not yet live.** Section 6 is the runbook that makes it live. |

Nothing in section 6 has been performed. Every step there needs a credential or an admin session
this session did not have, and none of it should be guessed at.

---

## 2. The four UNVERIFIED items, resolved

Recorded in full because each was load-bearing, and because "resolved" without its evidence is just
a more confident version of unverified.

### 2a. Webhooks on the Linear free plan — **AVAILABLE**

Three independent lines, because the first one alone is negative evidence:

- Linear's pricing matrix lists **"API and webhook access"** as a **Core** row, present on Free,
  Basic, Business and Enterprise alike.
- The webhooks doc gates creation on *role*, not plan: *"Only workspace admins, or OAuth
  applications with the `admin` scope, can create or read webhooks."*
- And that role gate is satisfied automatically here — Linear's own member docs state that
  **"All members of a workspace on the Free plan are considered an Admin."**

The negative evidence is worth something too, given how Linear writes docs: plan-gated features
carry an explicit banner (*"Available to workspaces on our Business and Enterprise plans"* on private
teams, Enterprise on audit log, Business/Enterprise on review Guides). The webhooks page carries no
such banner.

> **Residual.** No webhook was actually created — that needs the owner's admin session. Section 6
> step 1 is the empirical confirmation, and it is the cheapest of the six.

### 2b. `verify_jwt` — **HANDLED, and it is a trap worth naming**

Supabase Edge Functions reject any request without a valid Supabase JWT **before the function's own
code runs**. `verify_jwt` defaults to `true`. Linear does not send a Supabase JWT and cannot be made
to.

The trap is not the 401. It is that the 401 is issued by the platform, so **no `console.log` in
`index.ts` ever fires** — the function looks dead rather than misconfigured, and the natural next
move (adding logging) produces no new information.

Fixed in `supabase/config.toml`:

```toml
[functions.linear-dispatch]
verify_jwt = false
```

This travels with the deploy; it is not local-only. **"Public" is not "unverified"** — the platform
check is replaced by, not merely removed in favour of, the HMAC check in `signature.ts`.

> **Known sharp edge:** `supabase/cli#4059` reports the per-function `verify_jwt` setting being
> ignored on *update* deploys. Section 6 step 4 therefore verifies the deployed setting rather than
> assuming the config file won.

### 2c. The PAT scope for `repository_dispatch` — **RESOLVED, use fine-grained**

`POST /repos/{owner}/{repo}/dispatches`.

| Token type | Requirement | Source |
|---|---|---|
| **Fine-grained** (recommended) | **Contents: read & write** (Metadata: read is auto-selected) | GitHub fine-grained permissions reference |
| Classic | `repo` | GitHub REST reference, verbatim: *"need the `repo` scope"* |

`gamitch/volt_task_tracker_rewrite` is **public** (measured this session via the API, not assumed),
so the narrower classic `public_repo` is widely reported to suffice. That narrowing is **not stated
by GitHub itself** — it comes from `peter-evans/repository-dispatch`'s README — so it is flagged
rather than recommended. Prefer the fine-grained token: it is narrower than either classic option
and it expires.

Also verified, and easy to lose an afternoon to:

- `event_type` ≤ 100 characters.
- `client_payload` ≤ **10 top-level properties**, < **64KB**. Ours has 7 and weighs a few hundred
  bytes; a test asserts both bounds so a future field addition trips a test rather than a 422.
- **`repository_dispatch` only runs workflows from the DEFAULT BRANCH.** The workflow file does
  nothing until it is on `main`. A dispatch that matches no workflow still returns **204** — the
  success code — so this failure is completely silent from the caller's side.

### 2d. Does a PAT-fired `repository_dispatch` pass the human-actor check? — **YES, conditionally**

This is the one that could have killed the design, so it was settled by reading the implementation
rather than the docs. `anthropics/claude-code-action`, `src/github/validation/actor.ts`:

```ts
const { data: userData } = await octokit.users.getByUsername({ username: actor });
actorType = userData.type;
...
if (actorType !== "User") { /* throws unless allowed_bots matches */ }
```

The whole test is `userData.type === "User"`. The chain, each link checked:

1. For `repository_dispatch`, `github.actor` is the identity that called the API — the **PAT's
   owner**.
2. The PAT will be owned by `gamitch`.
3. `gamitch` is `"type": "User"` — read directly from the GitHub API in this session, not inferred.
4. Therefore `checkHumanActor` passes.

**The condition, and it is the whole finding:** this holds *because the token belongs to a human
account*. A GitHub App installation token or a machine account resolves to type `Bot` and the run
dies before Claude starts. Issue #835 is exactly that case — a user whose dispatch broke after PR
#826 added the check, because they fired it with an automation token. Their bug report is this
design's confirmation: the mechanism is real, and the human-owned PAT is what steps around it.

`allowed_bots` is **not** the escape hatch. It would admit bot-triggered runs generally, which
discards the loop protection instead of satisfying it.

One further check, resolved favourably: `checkWritePermissions` applies *"on issue and pull request
events"*. `repository_dispatch` is neither, so it is skipped.

> **Residual, and it is real.** Steps 1–4 are each verified; the *composition* is not. Only a live
> dispatch proves it end to end, which is section 6 step 6.

---

## 3. The design

```
owner drags GAM-nnn  Backlog → Todo
        │
        ▼
Linear webhook  (Issue, action=update)
        │  Linear-Signature: HMAC-SHA256(secret, RAW body)
        ▼
supabase/functions/linear-dispatch/
        │  1. read raw body ONCE          index.ts
        │  2. verify signature            signature.ts   ← before any parse
        │  3. verify webhookTimestamp     signature.ts   ← 60s replay window
        │  4. parse
        │  5. decide                      filter.ts      ← 8 rules, section 4
        │  6. fire                        dispatch.ts
        ▼
POST /repos/gamitch/volt_task_tracker_rewrite/dispatches
        │  event_type: linear-issue-dispatch
        │  client_payload: 7 fields
        ▼
.github/workflows/claude-linear-dispatch.yml   (default branch only)
        ▼
anthropics/claude-code-action@v1  — automation mode
        ▼
agent reads AGENTS.md § "Where work comes from", claims per item 28
```

**Verify, then parse — never the reverse.** `JSON.stringify(JSON.parse(x))` is not byte-identical to
`x`; key order and whitespace both move. A signature check over a re-serialised object either always
fails (and gets "fixed" by weakening it) or silently compares the wrong bytes. Two tests pin this: a
key-reordered encoding and a pretty-printed one must both fail to verify.

| File | Holds |
|---|---|
| `signature.ts` | HMAC-SHA256 verify, constant-time compare, `isFresh` replay window |
| `filter.ts` | the 8 rules; returns a reason on every rejection; extracts the client payload |
| `dispatch.ts` | the GitHub POST; injectable `fetch`; asserts **204**, not "any 2xx" |
| `index.ts` | HTTP shell, env, status codes |
| `signature.test.ts` | 15 tests |
| `filter.test.ts` | 24 tests |

---

## 4. The filter, and why each rule exists

| # | Rule | Skip reason | Grounding |
|---|---|---|---|
| 1 | `type === 'Issue'` | `NOT_AN_ISSUE_EVENT` | belt-and-braces if the subscription widens |
| 2 | `action === 'update'` | `NOT_AN_UPDATE` | a dispatch is a *transition* |
| 3 | `data.id` and `data.identifier` present | `MALFORMED_ISSUE` | nothing to hand an agent otherwise |
| 4 | new state is `Todo` (by name, case-insensitive) | `NOT_TARGET_STATE` | item 28: *"the live queue is the `Todo` column"* |
| 5 | **`updatedFrom` contains `stateId`** | `STATE_UNCHANGED` | see below |
| 6 | a `labels` array exists at all | `LABELS_UNAVAILABLE` | distinguishes a payload-shape regression from a correct skip |
| 7 | carries a `tier` label (see 4a) | `NO_TIER_LABEL` | item 28b's identity test |
| 8 | does **not** carry `gate/human` | `HUMAN_GATED` | see section 5 |

**Rule 5 is the load-bearing one.** Linear sends an `update` for *every* edit — a label added, a
typo fixed, an estimate set — and on all of those the issue is still sitting in `Todo`. Rule 4 alone
would re-dispatch on each one and start a second agent on already-claimed work. `updatedFrom` carries
the previous values of exactly the fields that changed, so `stateId` appearing in it is the precise
signal *"the state moved in this event"*.

**Every skip is named, and that is deliberate.** The tracker-migration doc's section 6 names the
recurring defect: *"a silent no-op that looks like success."* A filter is that shape by nature. So
`decideDispatch` never returns a bare boolean — every rejection carries a reason and a detail, both
land in the 200 body and the log, and **the tests assert the reason, not merely that dispatch did not
happen.** Asserting `dispatch === false` alone would pass for a filter that rejected everything.

**The guards were proven by making them fire** (three mutations, each reverted):

| Mutation | Result |
|---|---|
| rule 5's `updatedFrom.stateId` check → `if (false)` | **2 tests red** |
| `isFresh` rewritten as the naive `Math.abs(now - ts) <= tol` | **1 test red** |
| `tierFromLabels` returns `'standard'` instead of `null` | **3 tests red** |

The `isFresh` mutation is the interesting one. The naive version is what anyone would write, and it
is wrong: a missing `webhookTimestamp` yields `NaN`, every comparison against `NaN` is `false`, so
`elapsed > tolerance` is false and **an unstamped delivery passes as fresh**. The explicit
`typeof !== 'number'` guard exists for that, and the test proves it by removing it.

### 4a. `tier/fast` is not a label name — caught one commit before shipping

**The filter was written wrong, and the queue would have silently never dispatched.**

Every document in this project writes the tiers as `tier/fast`, `tier/unreviewed`, and
`linear-export.json` contains exactly those strings. The obvious conclusion — that a Linear label
named `tier/fast` exists — is false. Read from the live workspace while filing the follow-up issue:

| What the docs show | What Linear actually stores |
|---|---|
| a label `tier/fast` | group `tier` → child named **`fast`** |
| a label `gate/human` | group `gate` → child named **`human`** |
| a label `area/w4` | group `area` → child named **`w4`** |

The slashes are **synthesised by the exporter**, `scripts/linear-export.mjs`:

```js
.map((l) => (l.parent ? `${l.parent.name}/${l.name}` : l.name))
```

So the original `name.startsWith('tier/')` test would have matched **nothing, ever**. And its failure
mode is the worst one available: every issue skipped with reason `NO_TIER_LABEL`, which is a
*plausible* reason. A queue that never dispatches, a log full of lines that each look like a correct
decision, and no error anywhere. The migration doc's own recurring shape — *"a silent no-op that
looks like success"* — reproduced exactly, by a filter written to prevent it.

Caught by reading the live label set rather than the documents describing it. This is the same
lesson as §6a of the migration doc: **the citation is evidence of what was believed, not proof of
current state.**

The fix normalises labels to the exporter's `group/name` path when the payload carries a `parent`,
and falls back to matching the bare child names (`unreviewed`, `fast`, `standard`, `heavy`)
otherwise. Both, because Linear's webhook docs do not pin the serialised shape of `labels` — they
say only that the payload *"reflects the corresponding GraphQL entity"* — and which of the two
arrives is not worth betting the queue on.

Reverting to the buggy version turns **6 tests red**, so the fix is load-bearing rather than
belt-and-braces.

> **Residual.** Which shape Linear actually sends is still unconfirmed — it needs one real delivery
> to settle. Both are handled, so this does not block; setup step 7 will reveal it.

---

## 5. Decisions, with their reasoning

**`gate/human` is not dispatched — and this is the one rule that is an inference.** AGENTS.md defines
the label as *"no machine may close it"*, which is strictly about closing, not about working. But
starting an autonomous agent on a row explicitly gated on a person is the quiet over-reach the
constitution exists to prevent, and the cost of being wrong is asymmetric: a wrongly-skipped issue
costs one drag of a card, a wrongly-dispatched one costs an agent's worth of unwanted change. The
skip is loud — reason `HUMAN_GATED` in the response body and the log — so it is a visible decision
rather than a silent drop. **Flagged for review** in section 8.

**`tier/unreviewed` *is* dispatched.** Item 28d: such a row *"may not enter `In Progress` until it is
tiered"*, and *"judging the tier is part of claiming, not part of finishing."* Tiering is therefore
the dispatched agent's first job, not a precondition for dispatching it. Filtering these out would
quietly strand every skill-filed finding, since the filer applies `tier/unreviewed` by design.

**Identity is the `tier/*` label, never the `Tnnn` prefix.** Item 28b rules the prefix out
explicitly. A test asserts a `GAM-412` with no `Tnnn` still dispatches — the migration doc's whole
point that a skill-filed finding "has no `Tnnn` and is still ours" would otherwise decay silently
the first time it mattered.

**The issue description is not forwarded.** It is the largest field and the least useful to freeze:
item 28c requires the agent to re-read the issue and confirm it holds the claim before doing
anything, so it fetches live text regardless. A copy in `client_payload` would only ever be a
staler second version for the agent to disagree with. This also keeps the payload trivially inside
both GitHub limits.

**Skips return 200; failures return non-2xx.** Linear retries non-2xx deliveries, so the status code
is a statement about whether retrying could ever help. A correct decision not to dispatch is a
*successful* delivery and returns 200 with its reason. A bad signature returns 401 — not because
retrying helps, but because a 2xx would tell anyone probing the endpoint that their unsigned request
was accepted. GitHub rejecting the dispatch returns 502, which Linear *should* retry.

**State is matched by name, case-insensitively, and is configurable.** Item 28 names the column
`Todo`, and the name is what the owner actually drags a card into. Case-insensitivity means a rename
to `TODO` does not silently stop the queue; `LINEAR_DISPATCH_STATE` covers a real rename.

**Concurrency is grouped per issue, and does not cancel in progress.** Two agents on one row is the
race item 28c's claim-then-re-read exists to shrink. But a half-finished agent that has already
claimed the issue in Linear should be allowed to finish, so a later dispatch queues rather than
killing it.

**A separate Linear key for the workflow.** `linear-export.yml` deliberately uses a **read-only**
key. The dispatched agent must *write* (claim the issue, move it to `In Review`), so it gets its own
secret, `LINEAR_DISPATCH_API_KEY`, rather than the export's key being quietly widened to write.

---

## 6. Setup — what the owner still has to do

**Tracked as `GAM-310`** (`Backlog`, `tier/fast`, `gate/human`) — filed rather than left here alone,
because item 29 makes Linear the queue and a runbook that lives only in a document is a step nobody
is prompted to take.

**None of this has been done.** Each step needs a credential or an admin session this session did
not have. In order; step 3 before step 1, or the first deliveries hit nothing.

1. **Create the GitHub PAT.** Fine-grained, scoped to `gamitch/volt_task_tracker_rewrite` only, with
   **Contents: read & write**. It must be created under a **human** account (2d). Owning it with a
   machine account is the single most likely way to make this fail confusingly.

2. **Add the repository secrets** (Settings → Secrets and variables → Actions):

   | Secret | Value |
   |---|---|
   | `ANTHROPIC_API_KEY` | Claude API key (or use `CLAUDE_CODE_OAUTH_TOKEN` and change the workflow input) |
   | `LINEAR_DISPATCH_API_KEY` | a **write-capable** Linear key |
   | `CLAUDE_PR_TOKEN` | optional; the PAT from step 1. Without it the agent's pushes use `GITHUB_TOKEN`, and **commits made with `GITHUB_TOKEN` do not trigger CI** — a PR whose checks never run looks fine and is worse than a red one |

3. **Merge the workflow to `main`.** `repository_dispatch` runs workflows from the default branch
   only, and a dispatch matching no workflow still returns 204 (2c).

4. **Deploy the function and set its secrets:**

   ```sh
   supabase functions deploy linear-dispatch
   supabase secrets set LINEAR_WEBHOOK_SECRET=...   # from step 5
   supabase secrets set GITHUB_DISPATCH_TOKEN=...   # the PAT from step 1
   supabase secrets set GITHUB_DISPATCH_REPO=gamitch/volt_task_tracker_rewrite
   ```

   Then **confirm JWT verification is actually off** on the deployed function (Dashboard → Edge
   Functions → `linear-dispatch`), because of `supabase/cli#4059`. An unsigned `curl` should return
   **401 `INVALID_SIGNATURE`** — the function's own error shape. A 401 about a *missing JWT* means
   the platform is still intercepting and the config did not take.

5. **Create the Linear webhook.** Settings → API → Webhooks:
   - URL: `https://<project-ref>.supabase.co/functions/v1/linear-dispatch`
   - Resource type: **Issues** only
   - Copy the signing secret into `LINEAR_WEBHOOK_SECRET` (step 4)

6. **Prove it end to end, and watch the actor line.** Move one real issue `Backlog → Todo`. Then
   open the Actions run and confirm the log says:

   ```
   Actor type: User
   Verified human actor: gamitch
   ```

   That line is the composition in 2d actually happening. If it instead says *"Workflow initiated by
   non-human actor"*, the PAT is owned by the wrong kind of account — go back to step 1. Do not
   reach for `allowed_bots`.

7. **Check the negative case, because a filter that drops everything looks identical to one with
   nothing to do.** Edit the description of an issue already in `Todo`. The function should return
   **200 `{"dispatched": false, "reason": "STATE_UNCHANGED"}`** and no workflow should start.

---

## 7. Found on the way: 224 Edge Function tests that nothing ran

Not part of the ask, but discovered while wiring these tests into CI and worth more than the webhook
itself.

`.github/workflows/ci.yml` had three jobs — `ci`, `sql`, `skill-scripts` — and **no Deno job**. Five
function directories already carried 21 `*.test.ts` files, **224 tests**, and CI ran none of them.
The `checkin` HMAC tests this task was told to mirror have been unenforced since T032.

That is the defect class T701 was filed for, and the same shape as everything in the migration doc's
section 6: a guard that never fires is indistinguishable from a guard that works. Adding
`linear-dispatch`'s 39 tests without fixing this would have made it two directories of decorative
coverage instead of one.

The new `edge-functions` job runs all six. Two details, both measured rather than assumed:

- **Per-directory, not one root-level `deno test supabase/functions/`.** Each function owns a
  `deno.json`, and Deno applies the config nearest the working directory. The root-level form
  resolves every function's npm specifiers against the wrong config and dies at *collection* —
  before running a single test — on `ical-generator` in `ics/`.
- **`--allow-env --allow-read`.** `send-invite` and `send-reminders` read `RESEND_SEND_MODE` /
  `RESEND_API_KEY` to prove their fail-closed defaults, and `send-invite` asserts against its own
  source text. Without the flags those two directories are red for a reason that has nothing to do
  with their logic.

The loop **discovers** directories rather than listing them — a hardcoded list is exactly how this
gap would silently reopen — and errors if it finds none, because a green tick over an empty loop is
the failure this job exists to prevent.

**All 269 pass** — the 224 that were already there, plus this function's 45.

---

## 8. Open questions

1. **Is excluding `gate/human` right?** Section 5's reasoning is an inference from *"no machine may
   close it"*, not a quotation. The counter-argument is decent: an agent never closes its own issue
   anyway (item 28e), so the label may already be satisfied by the normal flow and rule 8 may be
   filtering work that should proceed. One line in `filter.ts` either way.

2. **Issues created directly in `Todo` are not dispatched** (rule 2 requires `update`). This is
   deliberate — item 28a makes promotion the owner's explicit signal — but a `create` straight into
   `Todo` is a plausible thing to do by accident, and it currently produces silence.

3. **Nothing tells the owner a dispatch was skipped.** The reason is in the function's response body
   and the Supabase log, and Linear's webhook delivery view shows the 200. Nobody is watching either.
   A skip for a *wrong* reason — say `LABELS_UNAVAILABLE` after a Linear payload change — would look
   exactly like a quiet week.

4. **`--allowedTools` in the workflow is broad** (`Bash` unrestricted, plus `WebFetch`/`WebSearch`).
   An agent that cannot run `npm test` is useless, so some breadth is required, but this has not been
   tuned against a real run.

5. **`--max-turns 80` and `timeout-minutes: 60` are guesses.** Neither is grounded in an observed
   run, because there has not been one.

6. **The replay window is 60s**, per Linear's own recommendation. If Supabase cold starts push
   delivery latency past that, deliveries will 401 with `STALE_DELIVERY` — which will look like a
   signature problem and is not. `DEFAULT_TIMESTAMP_TOLERANCE_MS` is the knob.

---

## 9. Files

| File | |
|---|---|
| `supabase/functions/linear-dispatch/signature.ts` | new |
| `supabase/functions/linear-dispatch/filter.ts` | new |
| `supabase/functions/linear-dispatch/dispatch.ts` | new |
| `supabase/functions/linear-dispatch/index.ts` | new |
| `supabase/functions/linear-dispatch/signature.test.ts` | new — 15 tests |
| `supabase/functions/linear-dispatch/filter.test.ts` | new — 24 tests |
| `supabase/functions/linear-dispatch/deno.json` | new |
| `.github/workflows/claude-linear-dispatch.yml` | new |
| `supabase/config.toml` | `[functions.linear-dispatch] verify_jwt = false` |
| `.github/workflows/ci.yml` | new `edge-functions` job (section 7) |
