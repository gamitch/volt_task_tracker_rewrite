# 2026-08-09 — the Linear → Claude dispatch webhook

**Status: LIVE.** Proven end to end on 2026-08-09 — the owner dragged `GAM-308` to `Todo`, an agent
claimed it 87 seconds later, worked it, and opened PR #133 with CI green. §9 records every setup step
with its evidence.

This document was written twice: first as a design, by a session that ended before it could build
anything, and then extended by the session that built it. **Both halves are kept.** The design half
recorded constraints measured from primary sources that the build half never re-measured — the
5-second delivery timeout and the retry schedule in §3 especially — and discarding them to make room
for an implementation record would have thrown away the more expensive information.

The design half also marked four items **UNVERIFIED** and said any of them could invalidate the
design. All four are now resolved (§4). One of them changed the design.

---

## 1. What this is for

The owner's original question, asked at the start of the tracker migration and still the thing
driving all of it:

> _"how do you know if i move something from our backlog and wanting you to execute?"_

and, restated:

> _"part of the integration with linear over clickup is because linear also has a webhook that would
> allow me to put an item in the TODO state and trigger claude to take action"_

So the target is **not** merely refreshing the export faster. It is: **the owner drags a card to
`Todo`, and an agent starts working it.** No polling, no owner message in chat, no quota burned
idling. This was one of the stated reasons Linear beat ClickUp.

---

## 2. Where things stand

|                |                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------- |
| Trigger        | an issue enters `Todo` in Linear team `Gamitch`                                          |
| Transport      | Linear webhook → Supabase Edge Function `linear-dispatch` → GitHub `repository_dispatch` |
| Runner         | `.github/workflows/claude-linear-dispatch.yml` → `anthropics/claude-code-action@v1`      |
| Auth, inbound  | HMAC-SHA256 over the raw body (`Linear-Signature`) + a 60s replay window                 |
| Auth, outbound | a **human-owned** GitHub PAT                                                             |
| Tests          | 45, `deno test supabase/functions/linear-dispatch/`                                      |
| Setup          | **all 7 steps done and verified** (§9, `GAM-310`)                                        |

---

## 3. Why there must be a relay — and two constraints it imposes

**VERIFIED** from <https://linear.app/developers/webhooks>, and load-bearing:

| Property              | Value                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------- |
| Method / content type | `POST`, `application/json; charset=utf-8`                                             |
| Authentication        | `Linear-Signature` — hex HMAC-SHA256 of the **raw body**, keyed by the signing secret |
| **Custom headers**    | **Not supported**                                                                     |
| Filtering             | by `resourceTypes` (e.g. `["Issue"]`) and to all public teams **or a single team**    |
| **Timeout**           | **5 seconds**, then the delivery is a failure                                         |
| **Retries**           | **3 attempts, backing off 1 minute, 1 hour, 6 hours**                                 |

GitHub's `POST /repos/{owner}/{repo}/dispatches` requires an `Authorization: Bearer` header and a
`{"event_type", "client_payload"}` body. **Linear can supply neither.** So a relay is not an
architectural preference that can be simplified away — it is a consequence of two fixed APIs. Any
future session proposing "just point the Linear webhook at GitHub" should stop here.

Two consequences the build has to live with, both surfaced by reconciling this section against the
implementation:

**3a. The 5-second budget is real, and the handler spends it synchronously.** `index.ts` awaits the
GitHub dispatch before responding, so a Supabase cold start plus the GitHub round trip is on the
clock. In practice the dispatch call is a few hundred milliseconds and this fits — but it is not
guaranteed, and the alternative (respond 200 first, fire the dispatch afterwards) trades the
timeout risk for losing the ability to report a failed dispatch at all. Left synchronous
deliberately; the per-issue `concurrency` group in the workflow is what stops a timeout-plus-retry
from starting two agents on one issue.

**3b. The retry schedule and the replay window are in direct tension, and the replay window wins.**
Linear retries at 1 minute, 1 hour and 6 hours. `isFresh` rejects anything more than 60 seconds from
`webhookTimestamp`. So **if `webhookTimestamp` is not re-stamped on retry, the 1-hour and 6-hour
retries arrive as `STALE_DELIVERY` and the retry mechanism is defeated** — exactly when it would
matter, since a retry only happens after a real failure.

Whether Linear re-stamps on retry is **UNVERIFIED** and needs one real failed delivery to settle.
The window stays at 60 seconds regardless, because that is Linear's own published guidance and
widening it to six hours to accommodate a retry would trade a certain security property for a
speculative reliability one. **Recovery is by re-dragging the card**: `Todo → In Progress → Todo`
fires a fresh update with `stateId` in `updatedFrom`, which dispatches normally.

---

## 4. The four UNVERIFIED items, resolved

Recorded in full because each was load-bearing, and because "resolved" without its evidence is just
a more confident version of unverified.

### 4a. Webhooks on the Linear free plan — **AVAILABLE**

Three independent lines, because the first alone is negative evidence:

- Linear's pricing matrix lists **"API and webhook access"** as a **Core** row, present on Free,
  Basic, Business and Enterprise alike.
- The webhooks doc gates creation on _role_, not plan: _"Only workspace admins, or OAuth
  applications with the `admin` scope, can create or read webhooks."_
- That role gate is satisfied automatically here — Linear's member docs state **"All members of a
  workspace on the Free plan are considered an Admin."**

The negative evidence counts too, given how Linear writes docs: plan-gated features carry an
explicit banner (Business/Enterprise on private teams, Enterprise on audit log). The webhooks page
carries none.

> **Resolved.** The webhook was created on the free plan without obstacle and has delivered
> repeatedly. Free-plan availability is now observed rather than inferred.

### 4b. `verify_jwt` — **HANDLED, and it is a trap worth naming**

Supabase Edge Functions reject any request without a valid Supabase JWT **before the function's own
code runs**. `verify_jwt` defaults to `true`. Linear does not send one and cannot be made to.

The trap is not the 401. It is that the platform issues it, so **no `console.log` in `index.ts` ever
fires** — the function looks dead rather than misconfigured, and the natural next move (add logging)
produces no new information.

```toml
[functions.linear-dispatch]
verify_jwt = false
```

This travels with the deploy; it is not local-only. **"Public" is not "unverified"** — the platform
check is _replaced by_, not merely removed in favour of, the HMAC check in `signature.ts`.

> **Known sharp edge:** `supabase/cli#4059` reports the per-function setting being ignored on
> _update_ deploys. §9 step 4 verifies the deployed setting rather than assuming the file won.

### 4c. The PAT scope for `repository_dispatch` — **RESOLVED, use fine-grained**

| Token type              | Requirement         | Source                                      |
| ----------------------- | ------------------- | ------------------------------------------- |
| **Fine-grained** (used) | **Contents: write** | GitHub's own endpoint permissions reference |
| Classic                 | `repo`              | GitHub REST reference, verbatim             |

The repo is **public** (measured), so classic `public_repo` is widely reported to suffice — but that
narrowing is **not stated by GitHub itself**, so it is flagged rather than recommended.

Also verified, each easy to lose an afternoon to:

- `event_type` ≤ 100 characters.
- `client_payload` ≤ **10 top-level properties**, < **64KB**. Ours has 7; a test asserts both bounds
  so a future field addition trips a test rather than a 422.
- **`repository_dispatch` only runs workflows from the DEFAULT BRANCH**, and a dispatch matching no
  workflow still returns **204** — the success code. That failure is completely silent.

### 4d. Does a PAT-fired `repository_dispatch` pass the human-actor check? — **YES, conditionally**

Settled by reading the implementation rather than the docs. `src/github/validation/actor.ts`:

```ts
const { data: userData } = await octokit.users.getByUsername({ username: actor });
if (userData.type !== 'User') {
  /* throws unless allowed_bots matches */
}
```

The whole test is `type === "User"`. Each link checked: for `repository_dispatch` the actor is the
identity that called the API — the PAT's owner; the PAT is owned by `gamitch`; `gamitch` is
`"type": "User"`, read from the API, not inferred. So it passes.

**The condition is the finding:** this holds _because the token belongs to a human account_. A
GitHub App installation token or machine account resolves to `Bot` and the run dies before Claude
starts. Issue #835 is exactly that case, and its bug report is this design's confirmation.

`allowed_bots` is **not** the escape hatch — it would admit bot-triggered runs generally, discarding
the loop protection instead of satisfying it.

Two further checks, both favourable:

- `checkWritePermissions` applies _"on issue and pull request events"_. `repository_dispatch` is
  neither, so it is skipped.
- **Does the action accept `repository_dispatch` at all?** It does. `src/github/context.ts` handles
  exactly `issues`, `issue_comment`, `pull_request` (+`_target`), `pull_request_review`,
  `pull_request_review_comment`, `workflow_dispatch`, **`repository_dispatch`**, `schedule`,
  `workflow_run`. Anything else hits `default: throw`. Measured the expensive way — the step-2 smoke
  test was first written `on: push` and died in 340ms with `Unsupported event type: push`.

> **RESOLVED by observation, and this was the item that could have killed the design.** Run
> `31341830136`, event `repository_dispatch`, carried `actor: gamitch` / `triggering_actor: gamitch`;
> `checkHumanActor` passed and the run worked for 7m 51s before opening PR #133. The PAT owner
> propagated through as the human account exactly as the source read predicted, so the composition —
> not just each link — is now proven.

---

## 5. The chain

```
owner drags GAM-nnn  Backlog → Todo
        │  Linear webhook (resourceTypes ["Issue"], team Gamitch), 5s budget
        ▼
supabase/functions/linear-dispatch/
        │  1. read raw body ONCE          index.ts
        │  2. verify signature            signature.ts   ← before any parse
        │  3. verify webhookTimestamp     signature.ts   ← 60s replay window
        │  4. parse
        │  5. decide                      filter.ts      ← 8 rules, §6
        │  6. fire                        dispatch.ts    ← asserts 204, not "any 2xx"
        ▼
POST /repos/gamitch/volt_task_tracker_rewrite/dispatches
        │  event_type: linear-issue-dispatch · client_payload: 7 fields
        ▼
.github/workflows/claude-linear-dispatch.yml   (default branch only)
        ▼
anthropics/claude-code-action@v1 — automation mode
        ▼
agent reads AGENTS.md § "Where work comes from", claims per item 28,
opens a PR whose body starts `Closes GAM-nnn`
```

**Verify, then parse — never the reverse.** `JSON.stringify(JSON.parse(x))` is not byte-identical to
`x`; key order and whitespace both move. A signature check over a re-serialised object either always
fails (and gets "fixed" by weakening it) or silently compares the wrong bytes. Two tests pin this: a
key-reordered encoding and a pretty-printed one must both fail to verify.

| File                                   | Holds                                                                 |
| -------------------------------------- | --------------------------------------------------------------------- |
| `signature.ts`                         | HMAC verify, constant-time compare, `isFresh` replay window           |
| `filter.ts`                            | the 8 rules; a reason on every rejection; extracts the client payload |
| `dispatch.ts`                          | the GitHub POST; injectable `fetch`                                   |
| `index.ts`                             | HTTP shell, env, status codes                                         |
| `signature.test.ts` / `filter.test.ts` | 15 + 30 tests                                                         |

---

## 6. The filter, and why each rule exists

| #   | Rule                                            | Skip reason          | Grounding                                        |
| --- | ----------------------------------------------- | -------------------- | ------------------------------------------------ |
| 1   | `type === 'Issue'`                              | `NOT_AN_ISSUE_EVENT` | belt-and-braces if the subscription widens       |
| 2   | `action === 'update'`                           | `NOT_AN_UPDATE`      | a dispatch is a _transition_                     |
| 3   | `data.id` and `data.identifier` present         | `MALFORMED_ISSUE`    | nothing to hand an agent                         |
| 4   | new state is `Todo` (by name, case-insensitive) | `NOT_TARGET_STATE`   | item 28 names the column                         |
| 5   | **`updatedFrom` contains `stateId`**            | `STATE_UNCHANGED`    | see below                                        |
| 6   | a `labels` array exists at all                  | `LABELS_UNAVAILABLE` | separates a shape regression from a correct skip |
| 7   | carries a `tier` label (§7)                     | `NO_TIER_LABEL`      | item 28b's identity test                         |
| 8   | does **not** carry `gate/human`                 | `HUMAN_GATED`        | §8                                               |

**Rule 5 is the load-bearing one.** Linear sends an `update` for _every_ edit — a label added, a typo
fixed, an estimate set — and on all of those the issue is still in `Todo`, so rule 4 alone would
re-dispatch on every keystroke-level change and start a second agent on claimed work. `updatedFrom`
holds the previous values of exactly the fields that changed, so `stateId` appearing in it is the
precise signal "the state moved in this event".

This also settles the **loop-safety** question the design half flagged: the agent's own claim moves
the issue to `In Progress` (filtered by rule 4), and the merge moves it to `Done` (rule 4). An agent
that fails and leaves the issue in `Todo` cannot re-trigger itself, because no further state
transition occurs — rule 5 stops it.

**Every skip is named.** §6 of the migration doc names the recurring defect: _"a silent no-op that
looks like success."_ A filter is that shape by nature. So `decideDispatch` never returns a bare
boolean — every rejection carries a reason and a detail, both land in the 200 body and the log, and
**the tests assert the reason**, not merely that dispatch did not happen.

**The guards were proven by making them fire** (four mutations, each reverted):

| Mutation                                                     | Result    |
| ------------------------------------------------------------ | --------- |
| rule 5's `updatedFrom.stateId` check → `if (false)`          | **2 red** |
| `isFresh` rewritten as the naive `Math.abs(now - ts) <= tol` | **1 red** |
| `tierFromLabels` returns `'standard'` instead of `null`      | **3 red** |
| label handling reverted to the pre-§7 version                | **6 red** |

The `isFresh` mutation is the instructive one. The naive version is what anyone would write, and it
is wrong: a missing `webhookTimestamp` yields `NaN`, every comparison against `NaN` is `false`, so
`elapsed > tolerance` is false and **an unstamped delivery passes as fresh**.

---

## 7. `tier/fast` is not a label name — caught one commit before shipping

**The filter was written wrong, and the queue would have silently never dispatched.**

Every document in this project writes the tiers as `tier/fast`, and `linear-export.json` contains
exactly those strings. The obvious conclusion — that a label named `tier/fast` exists — is false.
Read from the live workspace:

| What the docs show   | What Linear actually stores            |
| -------------------- | -------------------------------------- |
| a label `tier/fast`  | group `tier` → child named **`fast`**  |
| a label `gate/human` | group `gate` → child named **`human`** |
| a label `area/w4`    | group `area` → child named **`w4`**    |

The slashes are **synthesised by the exporter**, `scripts/linear-export.mjs`:

```js
.map((l) => (l.parent ? `${l.parent.name}/${l.name}` : l.name))
```

So `name.startsWith('tier/')` would have matched **nothing, ever** — skipping every issue with the
_plausible_ reason `NO_TIER_LABEL`. A queue that never dispatches, a log full of lines that each look
like a correct decision, and no error anywhere.

The fix normalises to the exporter's `group/name` path when the payload carries a `parent`, and falls
back to the bare child names otherwise — both, because Linear's docs do not pin the serialised shape
of `labels`, saying only that the payload _"reflects the corresponding GraphQL entity"_.

> **Neutralised, not resolved — and the distinction is deliberate.** A live delivery for `GAM-80`
> returned `HUMAN_GATED`, a reason only reachable _through_ rules 6 and 7, so the label handling
> demonstrably works against a real Linear payload. It does **not** reveal _which_ shape arrived:
> that reason fires for either `gate/human` or a bare `human`, and the detail string quotes the
> constant rather than the payload. Both shapes stay handled. Had the fallback missed, the reason
> would have read `NO_TIER_LABEL` — which is precisely why every skip carries one.

---

## 8. Decisions, with their reasoning

**`gate/human` is not dispatched — the one rule that is an inference.** AGENTS.md defines it as _"no
machine may close it"_, which is about closing, not working. But starting an autonomous agent on a
row gated on a person is the quiet over-reach the constitution exists to prevent, and the cost is
asymmetric: a wrongly-skipped issue costs one drag, a wrongly-dispatched one costs an agent's worth
of unwanted change. The skip is loud. **Flagged for review** in §11.

**`tier/unreviewed` _is_ dispatched.** Item 28d: such a row _"may not enter `In Progress` until it is
tiered"_, and _"judging the tier is part of claiming, not part of finishing."_ Filtering these out
would quietly strand every skill-filed finding, since the filer applies `tier/unreviewed` by design —
and would make promotion look broken to the owner.

**Identity is the tier label, never the `Tnnn` prefix** (item 28b). A test asserts a `GAM-412` with
no `Tnnn` still dispatches.

**The issue description is not forwarded.** Item 28c requires the agent to re-read the issue and
confirm it holds the claim, so it fetches live text regardless; a copy would only ever be a staler
second version to disagree with.

**Skips return 200; failures return non-2xx.** Linear retries non-2xx, so the status code states
whether retrying could ever help. A bad signature returns 401 — not because retrying helps, but
because a 2xx would tell anyone probing the endpoint that their unsigned request was accepted.

**Concurrency is grouped per issue and does not cancel in progress.** Two agents on one row is the
race item 28c exists to shrink; but a half-finished agent that has already claimed the issue should
be allowed to finish.

**A separate Linear key for the workflow.** `linear-export.yml` deliberately uses a read-only key on
a daily schedule. The dispatched agent must _write_, so it gets `LINEAR_DISPATCH_API_KEY` (Read +
Write + Create comments, limited to `Gamitch`) rather than the export's key being widened.

**Subscription auth over an API key.** Owner's choice, 2026-08-09: runs draw on the Claude
subscription via `claude_code_oauth_token`.

---

## 9. Setup — done, with the evidence for each step

**Tracked as `GAM-310`** (`Backlog`, `tier/fast`, `gate/human`).

| #   | Step                                                                                         | State                                                                                                                                                              |
| --- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Fine-grained PAT, **Contents: write**, owned by `gamitch`                                    | **DONE** — verified `GET /user` → 200, `POST /dispatches` → 204                                                                                                    |
| 2   | Secrets: `CLAUDE_CODE_OAUTH_TOKEN`, `LINEAR_DISPATCH_API_KEY`, `CLAUDE_PR_TOKEN`             | **DONE** — token proven by a real authentication, not by inspection                                                                                                |
| 3   | Merge the workflow to `main`                                                                 | **DONE** — PR #132, merged `71d6ac9`                                                                                                                               |
| 4   | `supabase functions deploy linear-dispatch` + three `supabase secrets set`                   | **DONE** — deployed `--use-api`; an unsigned `curl` returned `500 FUNCTION_MISCONFIGURED` naming only the missing secret, which is what proves `verify_jwt` is off |
| 5   | Create the Linear webhook — Issues only, team `Gamitch`                                      | **DONE** — webhook `claude-dispatch`, Issues only, team `Gamitch`; the unsigned `curl` then flipped to `401 INVALID_SIGNATURE`                                     |
| 6   | Move a real issue `Backlog → Todo`; confirm `Verified human actor` in the log                | **DONE** — `GAM-308` dragged at 23:24:58, dispatched, `actor: gamitch`; agent claimed at 23:26:25 and opened PR #133                                               |
| 7   | Edit an issue already in `Todo`; expect `{"dispatched": false, "reason": "STATE_UNCHANGED"}` | **DONE** — `GAM-80` edited while sitting in `Todo` returned `STATE_UNCHANGED`, and no workflow ran                                                                 |

Step 3 must precede step 6: `repository_dispatch` only runs workflows from the default branch, and a
dispatch matching no workflow still returns 204.

Step 4's secrets: `LINEAR_WEBHOOK_SECRET` (from step 5), `GITHUB_DISPATCH_TOKEN` (the PAT),
`GITHUB_DISPATCH_REPO=gamitch/volt_task_tracker_rewrite`. Then confirm JWT verification is really off
— an unsigned `curl` should return **401 `INVALID_SIGNATURE`**, the function's own error shape. A 401
about a _missing JWT_ means the config did not take.

`CLAUDE_PR_TOKEN` matters more than it looks: without it the agent's pushes use `GITHUB_TOKEN`, and
**commits made with `GITHUB_TOKEN` do not trigger CI** — a PR whose checks never run looks fine and
is worse than a red one.

~~Also still outstanding from the migration: enable the Linear automation **PR merged → Done**.~~
**Done** — and three automations are live, not one, all unscoped. Constitution item 28g carries the
measured configuration, dated, with the query that reproduces it.

---

## 9a. The proving run, in full

`GAM-308` — _"CoachHome's goal-projection row prints the same raw float hours T808 fixed for students
and parents"_, `tier/fast`.

| Time (UTC) | Event                                                |
| ---------- | ---------------------------------------------------- |
| 23:24:58   | owner drags `Backlog → Todo`                         |
| 23:24:59   | function returns 200 in 381 ms; dispatch fired       |
| 23:25:01   | workflow run `31341830136` created, `actor: gamitch` |
| 23:26:25   | **agent claims the issue** `Todo → In Progress`      |
| 23:32:45   | PR #133 opened                                       |
| 23:33:06   | run completes, `success`, 8m 02s                     |

The claim at 23:26:25 is worth more than the dispatch. It proves `LINEAR_DISPATCH_API_KEY` is
genuinely write-capable — nothing had exercised it — and that the agent read `AGENTS.md`, found item
28c, and **claimed before working** rather than after. An agent that skipped that step would have
looked identical from GitHub's side.

**The work itself held up.** Reviewed as a checker would:

- It used **`.toFixed(1)`, not `round1`** — the trap §6a of the migration doc exists to warn about.
  `round1` would render `4` where the sibling surface renders `4.0`, replacing one cross-surface
  mismatch with a smaller one.
- **`ProgressBar` untouched**, so `aria-valuenow` keeps the real float — the constraint the issue
  named explicitly.
- `totalHours` and `percent` left bare, as the issue said they should be.
- Its test **deliberately picked a fixture that can fail**: Amara Webb (6 / 0 / 90, integers) rather
  than Dana Voss, whose values "already happen to look formatted". `(6).toFixed(1)` is `"6.0"`, so
  the assertion cannot pass pre-fix — non-vacuous by construction, not by luck. It also pins
  `= 6h /` and `6.7%` staying bare, guarding the opposite error.

That last point is the one worth keeping: the issue's tier note warned about the vacuous-negative
shape T808 hit, and the agent acted on the warning without being told to.

**One worry that proved unfounded.** PR #133 is authored by `claude[bot]`, which looks like the
`GITHUB_TOKEN`-doesn't-trigger-CI trap. It isn't: the _push_ used `CLAUDE_PR_TOKEN`, and CI triggers
on the push. All 8 checks ran and passed. The precaution in §9 step 2 is why.

---

## 10. Item 28f is wrong: a title identifier closes the issue too

**Observed on this work, and it contradicts the constitution.**

PR #132 deliberately withheld the `Closes GAM-310` magic word, because only three of GAM-310's seven
steps were done. It carried the identifier in its **title** only, on item 28f's own stated basis:

> An identifier in the title or branch name **links only**. Useful … but on its own it leaves the
> issue sitting in `In Review` after merge.

That is not what happened. Linear moved `GAM-310` `Backlog → In Progress` when the PR opened, and
`→ Done` when it merged, and assigned it. The magic word was never used. Reopened by hand.

Two consequences worth more than this issue:

1. **The migration doc's outstanding item "enable the Linear automation _PR merged → Done_" is
   already done.** The automation is live, and has been. That is why the title alone closes.
2. **Omitting the magic word is not a way to avoid closing an issue.** Any agent that completes part
   of a multi-step issue and names it in a PR title will have that issue closed on merge, whatever
   it writes in the body. The options are to keep the identifier out of the title entirely, or to
   give partial work its own issue.

Item 28f's _recommendation_ (use `Closes`) is unaffected and still right. Its stated _mechanism_ —
that a title links without closing — is false against this workspace's live automation, and an agent
relying on that sentence to keep an issue open will be wrong. **Correcting item 28f is the owner's
call and is not done here** (item 3: rules live in one place, and this document is not that place).

---

## 11. Found on the way: 224 Edge Function tests that nothing ran

`ci.yml` had three jobs — `ci`, `sql`, `skill-scripts` — and **no Deno job**. Five function
directories already carried 21 test files, **224 tests**, and CI ran none of them. The `checkin` HMAC
tests this work was told to mirror have been unenforced since T032.

The new `edge-functions` job runs all six. Two details, both measured:

- **Per-directory, not one root-level `deno test supabase/functions/`.** Each function owns a
  `deno.json`, and Deno applies the config nearest the working directory; the root-level form
  resolves every function's npm specifiers against the wrong config and dies at _collection_.
- **`--allow-env --allow-read`.** `send-invite` and `send-reminders` read `RESEND_SEND_MODE` /
  `RESEND_API_KEY` to prove their fail-closed defaults.

The loop **discovers** directories rather than listing them, and errors if it finds none. **All 269
pass.**

---

## 12. The cheaper alternative, recorded honestly

A **GitHub Actions cron polling Linear every 5 minutes** needs no relay, no public endpoint, no
signature verification, no PAT stored off-GitHub and no Supabase deploy — and reuses the
`LINEAR_API_KEY` secret that already exists. Cost is ~288 requests a day against a measured budget of
2,500 _per hour_. The only loss is latency: up to 5 minutes.

Recorded because item 25 (proportionality) exists and the owner's standing instruction is _"please
keep it simple"_. The owner asked for the webhook twice, knowingly, and that is the decision — but if
§9 hits real friction, this delivers the same outcome with a fraction of the surface area.

---

## 13. Open questions

1. **Is excluding `gate/human` right?** §8's reasoning is an inference, not a quotation. The
   counter-argument is decent: an agent never closes its own issue anyway (item 28e), so the label
   may already be satisfied by the normal flow. One line in `filter.ts` either way.
2. **Does Linear re-stamp `webhookTimestamp` on retry?** §3b — if not, the 1-hour and 6-hour retries
   are rejected as stale and recovery is by re-dragging the card.
3. **Issues created directly in `Todo` are not dispatched** (rule 2 requires `update`). Deliberate —
   item 28a makes promotion the owner's signal — but a `create` straight into `Todo` is a plausible
   accident and currently produces silence.
4. **Nothing tells the owner a dispatch was skipped, and this is now the sharpest open item.** The
   reason is in the response body and the Supabase log, and Linear's delivery view shows the 200.
   Nobody watches either. Setting this up required reading those logs by hand at every step — and a
   skip for a _wrong_ reason (`LABELS_UNAVAILABLE` after a Linear payload change, say) would look
   exactly like a quiet week. Every other guard here is proven; this is the one that fails silently.
5. **`--allowedTools` is broad** (`Bash` unrestricted, plus `WebFetch`/`WebSearch`). An agent that
   cannot run `npm test` is useless, so some breadth is required, but this is untuned.
6. **`--max-turns 80` and `timeout-minutes: 60` now have exactly one data point.** The `GAM-308`
   run finished in **8m 02s** without approaching either bound. That says the numbers are not too
   _low_ for a `tier/fast` issue; it says nothing about a `heavy` one, and nothing about whether
   they would stop a runaway.
7. **This wires a money tap to a drag gesture.** Bounded by the per-issue concurrency group,
   `--max-turns` and the job timeout — but the bound has never been tested against a runaway.

---

## 14. Files

| File                                                                      |                                                  |
| ------------------------------------------------------------------------- | ------------------------------------------------ |
| `supabase/functions/linear-dispatch/{signature,filter,dispatch,index}.ts` | new                                              |
| `supabase/functions/linear-dispatch/{signature,filter}.test.ts`           | new — 45 tests                                   |
| `.github/workflows/claude-linear-dispatch.yml`                            | new                                              |
| `supabase/config.toml`                                                    | `[functions.linear-dispatch] verify_jwt = false` |
| `.github/workflows/ci.yml`                                                | new `edge-functions` job (§10)                   |

---

## 15. The tier judgement, kept from the design

**HEAVY**, and the reasoning still holds: this introduces a **publicly reachable endpoint that
triggers an autonomous agent holding `contents: write` and `pull-requests: write`**. A mistake does
not merely render something wrong — it lets an unauthenticated caller spend money and open pull
requests. Item 26's tie-break ("if two tiers are arguable, take the heavier one") applies.
