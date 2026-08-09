# Linear → Claude dispatch webhook — verified design, not yet built

**Status: DESIGN ONLY. No code exists yet.** This document is the research output of one
session, written because the session ended before implementation and the container holding the
conversation is discarded. Everything below marked **VERIFIED** was measured or read from primary
documentation on 2026-08-09; everything marked **UNVERIFIED** is inference that the next session
must check before relying on it. The distinction is the point of the document.

---

## 1. What this is for

The owner's original question, asked at the very start of the tracker migration and still the
thing driving all of it:

> *"how do you know if i move something from our backlog and wanting you to execute?"*

and, restated on the day this was written:

> *"part of the integration with linear over clickup is because linear also has a webhook that
> would allow me to put an item in the TODO state and trigger claude to take action"*

So the target is **not** merely refreshing the export faster. It is: **the owner drags a card to
`Todo`, and an agent starts working it.** No polling, no owner message in chat, no quota burned
idling.

This was one of the stated reasons Linear beat ClickUp. ClickUp could not do it inside its
request budget; Linear gives webhooks away on the free tier.

---

## 2. The blocking constraint, and why the design has a relay in it

**VERIFIED — Linear webhooks cannot call GitHub directly.** From
<https://linear.app/developers/webhooks>:

| Property | Value |
|---|---|
| Method / content type | `POST`, `application/json; charset=utf-8` |
| Authentication | `Linear-Signature` header — hex-encoded **HMAC-SHA256 of the raw body**, keyed by the webhook signing secret |
| **Custom headers** | **Not supported.** The docs describe only the headers Linear sends; there is no facility to add your own |
| Filtering | Yes — by `resourceTypes` (e.g. `["Issue"]`) and to **all public teams or a single team** |
| Timeout | **5 seconds (5000 ms)**, then the delivery is a failure |
| Retries | 3 attempts, backing off at 1 minute, 1 hour, 6 hours |

GitHub's `POST /repos/{owner}/{repo}/dispatches` requires `Authorization: Bearer <token>` and a
body of `{"event_type": "...", "client_payload": {...}}`. Linear can supply neither the header nor
the body shape.

**Therefore a relay is mandatory.** This is not an architectural preference that can be
simplified away — it is a consequence of two fixed APIs. Any next session that proposes "just
point the Linear webhook at GitHub" should stop and re-read this section.

The 5-second timeout also shapes the relay: it must **acknowledge immediately** and must not wait
on anything slow. Firing the GitHub dispatch is a single fast HTTPS call, which fits — but the
relay must never, for example, wait on a workflow to start.

---

## 3. The chain

```
Linear: issue moves to `Todo`  (resourceTypes ["Issue"], team Gamitch only)
   │
   │  POST + Linear-Signature
   ▼
Supabase Edge Function  `linear-dispatch`
   │   1. verify HMAC-SHA256 over the RAW body (constant-time compare)
   │   2. reject stale payloads (replay defence — see §6)
   │   3. filter: state == "Todo"  AND  issue carries a `tier/*` label
   │   4. return 200 immediately
   │
   │  POST /repos/gamitch/volt_task_tracker_rewrite/dispatches
   │  Authorization: Bearer <PAT>
   │  {"event_type":"linear-todo","client_payload":{"identifier":"GAM-nnn", ...}}
   ▼
GitHub Actions  `.github/workflows/linear-dispatch.yml`   (on: repository_dispatch)
   │
   ▼
anthropics/claude-code-action@v1   (automation mode — `prompt:` input, no @claude mention)
   │
   ▼
Agent claims GAM-nnn (Todo → In Progress), works it, opens a PR whose body starts `Closes GAM-nnn`
```

The last line is already-working machinery: constitution item 28f records that `Closes GAM-nnn`
as the PR body's first line both links *and* closes the issue, proven by PR #126 → `GAM-303`.

---

## 4. Why the relay belongs in Supabase, and what to reuse

**VERIFIED by inspection of the repo.** `supabase/functions/` already contains five deployed Deno
edge functions: `checkin`, `checkin-token`, `ics`, `send-invite`, `send-reminders`. This is
already-owned infrastructure on the project's existing stack (constitution item 8 locks Supabase
in), so the relay adds **no new vendor and no new bill**.

Reuse, concretely:

- **`supabase/functions/checkin/hmac.ts`** already implements HMAC-SHA256 over the Web Crypto API
  and exports **`timingSafeEqual(a, b)`** — a fixed-length, non-short-circuiting comparison. It is
  unit-tested in `hmac.test.ts`. The relay's signature check is the same primitive; do not write a
  second one.
- **`supabase/functions/ics/index.ts`** is the house pattern for an *unauthenticated-by-design,
  token-validated* endpoint, and its header comment explains the reasoning. The relay is the same
  shape: no Supabase JWT is possible, because Linear is the caller and knows nothing about
  Supabase. **Read `checkin/index.ts` first** — `ics` itself says to.
- Every function directory carries `*.test.ts` run by `deno test`. The relay's signature
  verification and event filtering are pure functions and should be tested the same way, with **no
  network and no live Linear**.

**UNVERIFIED:** `verify_jwt` appears **nowhere** in `supabase/config.toml` (grepped, zero hits), so
how `ics`/`checkin` are exempted from JWT verification is *not* established. Find out before
deploying — a relay that silently sits behind JWT verification will reject every Linear delivery,
and Linear will retry 3 times and give up.

---

## 5. The GitHub side

**VERIFIED** from <https://code.claude.com/docs/en/github-actions>:

- The action is **`anthropics/claude-code-action@v1`**.
- **Automation mode**: *"when the workflow provides a `prompt` input, Claude runs without waiting
  for a mention"* and *"runs in automation mode on any GitHub event"*. So `repository_dispatch` is
  a legitimate trigger. Results land in the **workflow run log**, not as a comment.
- Auth is `anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}` **or**
  `claude_code_oauth_token: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}` (the latter generated by
  `claude setup-token`, and it bills the subscription rather than the API).
- Permissions used by the documented examples:
  ```yaml
  permissions:
    contents: write
    pull-requests: write
    issues: write
    id-token: write      # required for the action's default GitHub App auth
    actions: read        # lets Claude read CI results
  ```
- Cost controls the docs name explicitly: `--max-turns` in `claude_args`, workflow-level
  timeouts, and GitHub concurrency groups.
- **A trap worth knowing before it costs a debugging session:** the action *"rejects a bot actor
  unless you list it in `allowed_bots`"*. **UNVERIFIED** whether a `repository_dispatch` fired by a
  fine-grained PAT presents as its human owner (expected) or as a bot (would be rejected). Test
  this early — it is the single most likely reason a first attempt silently does nothing.
- Also required: the **Claude GitHub App** installed on the repository.

---

## 6. Risks that must be designed for, not discovered

1. **The endpoint is public.** The HMAC signature is the *only* gate. Verify over the **raw body
   bytes**, before any JSON parsing that might normalise them, and compare constant-time.
2. **Replay.** A captured valid delivery can be re-sent forever unless freshness is checked.
   Linear's payload carries a `webhookTimestamp`; reject anything outside a small window.
   **UNVERIFIED:** the exact field name and whether it is inside the signed body — confirm against
   a real delivery.
3. **This wires a money tap to a drag gesture.** Every promotion to `Todo` spawns a paid agent
   run. Bound it: a `concurrency` group keyed on the issue identifier, `--max-turns`, and a job
   `timeout-minutes`. Decide deliberately whether a failed run should be retryable by re-dragging.
4. **Loops.** The design is believed loop-safe because the filter is `state == "Todo"` only: the
   agent's own claim moves the issue to `In Progress` (fires a webhook, filtered out), and the
   merge moves it to `Done` (fires, filtered out). **Verify this rather than trusting it** — an
   agent that fails and leaves an issue in `Todo` must not be able to re-trigger itself.
5. **`tier/unreviewed`.** Constitution item 28d forbids an untiered issue entering `In Progress`
   until it is tiered, and says judging the tier is part of *claiming*. So the prompt must make
   tiering the agent's first act. Do not let the relay silently drop untiered issues instead —
   that would make promotion look broken to the owner.
6. **Non-ours issues.** Item 28b: identity is the **`tier/*` label**, not the title. Linear ships
   its own onboarding issues into `Todo` and they carry no labels. The relay must filter on the
   label or it will dispatch an agent at Linear's welcome card.

---

## 7. What only the owner can do

None of these can be done from an agent session:

1. Install the **Claude GitHub App** on `gamitch/volt_task_tracker_rewrite`.
2. Add **`ANTHROPIC_API_KEY`** (or `CLAUDE_CODE_OAUTH_TOKEN`) as a repository secret.
3. Create a **fine-grained GitHub PAT** that may call `repository_dispatch` on this one repo, and
   store it as a Supabase function secret. **UNVERIFIED:** the exact scope `repository_dispatch`
   needs — believed *Contents: read and write*, but confirm.
4. Deploy the edge function and set its secrets (`LINEAR_WEBHOOK_SECRET`, the PAT).
5. Create the **Linear webhook** in workspace settings: URL of the deployed function,
   `resourceTypes` = `["Issue"]`, scoped to the **`Gamitch` team**, and copy the signing secret.
6. Still outstanding from the migration: enable the Linear automation **PR merged → Done**.

**UNVERIFIED — worth confirming before building anything:** that webhooks are actually available
on the **free** plan. This was read off the pricing page in a screenshot during the migration
session; Linear's *developer* docs do not state a plan restriction either way. If it turns out to
be paid, the whole design is moot and §8 is the answer instead.

---

## 8. The cheaper alternative, recorded honestly

A **GitHub Actions cron polling Linear every 5 minutes** for issues in `Todo` needs **no relay, no
public endpoint, no signature verification, no PAT stored off-GitHub, and no Supabase deploy** — and
it reuses the `LINEAR_API_KEY` secret that already exists for the export. Cost is ~288 requests a
day against a measured budget of 2,500 *per hour*. The only loss is latency: up to 5 minutes.

This is recorded because constitution item 25 (proportionality) exists and because the owner's
standing instruction is *"please keep it simple"*. The owner asked for the webhook twice,
knowingly, and that is the decision — but if the next session hits real friction in §7, this is
the fallback that delivers the same outcome with a fraction of the surface area.

---

## 9. Suggested opening prompt for the next session

> Read `docs/swarm/2026-08-09-linear-webhook-dispatch.md` and
> `docs/swarm/2026-08-09-tracker-migration.md` first. Build the Linear → Claude dispatch webhook
> described there. Start by resolving the four UNVERIFIED items — free-plan webhook availability,
> `verify_jwt` handling, the PAT scope for `repository_dispatch`, and whether a PAT-fired
> `repository_dispatch` passes `claude-code-action`'s human-actor check — because any of them can
> invalidate the design. Then build the edge function with `deno test` coverage for signature
> verification and event filtering, mirroring `supabase/functions/checkin/hmac.test.ts`. I will
> supply a temporary Linear API key when you need one; tell me when, and tell me when you are done
> with it.

Judge the process tier deliberately (item 26). The reasoning that produced **HEAVY** here: this
introduces a **publicly reachable endpoint that triggers an autonomous agent holding
`contents: write` and `pull-requests: write`**. A mistake does not merely render something wrong —
it lets an unauthenticated caller spend money and open pull requests. Item 26's tie-break ("if two
tiers are arguable, take the heavier one") applies.
