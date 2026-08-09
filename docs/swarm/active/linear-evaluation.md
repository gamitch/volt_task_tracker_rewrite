# Linear as the dispatch board — measured evaluation, 2026-08-09

Written after ClickUp hit two hard walls in one day (a ~22 hour lockout at ~32 sequential calls, and
a custom-field cap that made `Tier` unwritable). **Everything below is measured against the live
workspace unless explicitly marked as documentation or unverified.**

## Why this evaluation exists

The ClickUp migration is complete and working — 33 rows imported, one task (T166) dispatched through
it end to end. It failed on operational limits, not on concept. This document measures whether
Linear clears those same limits before anyone invests in a second migration.

## Rate limits

| | Linear | ClickUp |
|---|---|---|
| Requests | **2,500/hour** — MEASURED from response headers | ~30–50/**day**, inferred from two lockouts |
| Remaining quota visible? | **Yes** — `X-RateLimit-Requests-Remaining` on every response | No |
| On exceeding | HTTP 400, `code: RATELIMITED` | ~22 hour lockout, **reads blocked too** |
| Reset | rolling hourly window, leaky bucket | ~1370 minutes |

**RESOLVED BY MEASUREMENT 2026-08-09 — and both documents were wrong.** A live fetch of
`linear.app/developers/rate-limiting` reported **5,000/hour**; third-party sources (merge.dev,
lifestack.ai) reported **1,500/hour**. A single authenticated `POST` to `api.linear.app/graphql` with
a personal API key returned the truth in its own headers:

```
x-ratelimit-requests-limit:        2500
x-ratelimit-requests-remaining:    2499
x-ratelimit-requests-reset:        1786278433099   (rolling 1h window)
x-ratelimit-complexity-limit:      3000000
x-complexity:                      2               (cost of `{ viewer { id name } }`)
```

**2,500/hour.** Neither published figure. This is the third time this session that a measurement
contradicted a document that sounded authoritative, and it is the cheapest of the three to have run.

**Practical scale:** the full 33-row migration at ~2 calls per issue is ~66 requests — **2.6% of one
hour's budget**. The identical work exhausted ClickUp's daily budget and cost a ~22 hour lockout.
Complexity is a non-issue: a trivial query costs 2 points against 3,000,000.

Complexity is limited separately: 2,000,000 points/hour (OAuth), max 10,000 points per single query.
Irrelevant for task pickup, relevant for bulk reads.

**The decisive difference is not budget size — it is that Linear tells you your remaining quota on
every response.** ClickUp's failure mode was invisible until it had already cost a day.

⚠️ **Caveat, and it is exactly what burned us on ClickUp:** these are limits for Linear's *GraphQL
API*. The MCP server at `mcp.linear.app` may impose its own on top — ClickUp's published limit was
100/min while the connector behaved far harsher. Treat these as an upper bound. **~26 calls were
made during this evaluation with no limit encountered**, which is only weak evidence.

## Free-plan caps (from `linear.app/pricing`)

**250 active issues · 2 teams · unlimited members · 10MB file uploads.**

Measured: the workspace currently holds **5 issues**, four of which are Linear's onboarding defaults.
So ~245 of the budget is free and the 33 open rows fit comfortably.

✅ **SETTLED 2026-08-09 by the owner, from the in-app plan comparison.** The row is labelled
**"Issues (excluding archive) — 250"**. **Archived issues do not count toward the cap.**

This also explains the API measurement, which was inconclusive on its own: `Organization.createdIssueCount`
read **5** before archiving an issue and **5** after, while the default `issues` query dropped from 5
nodes to 4. `createdIssueCount` is a lifetime ever-created counter and is simply **not** the field the
cap is enforced against; the active (non-archived) count is. Archiving genuinely frees a slot.

**Consequence, and it is a significant unlock.** The full ledger is 293 rows but only **33 are open**.
Migrating *everything* — closed rows archived on arrival — leaves ~33 active against a 250 ceiling,
with the complete history preserved and searchable rather than discarded. At ~2 requests per row
(create, then archive) that is ~586 requests, **23% of one hour's budget**. Feasible in a single
sitting.

Worth noting the API alone could not answer this. Two plausible counters existed and nothing exposed
which one billing used; the answer was a label in the plan comparison UI. A measurement that cannot
distinguish two hypotheses is not yet evidence for either.

## Write path — tested, and every ClickUp defect is absent

A probe issue (`GAM-5`, since canceled) was created carrying a deliberate torture test: the exact
characters ClickUp's CSV importer escaped and corrupted.

**Markdown survived completely intact.** `**bold**` stayed bold, backticks stayed backticks,
`v_student_participation` kept its underscores rather than becoming `v\_student\_participation`, the
pipe table survived, and `a \| b` — the construct that truncated ClickUp cells mid-sentence —
survived. Linear normalised `|---|` to `| -- |` and `-` list markers to `*`, both cosmetic.

This is the single largest practical difference. Repairing ClickUp's escaping cost 24 rewrite calls,
which is most of a daily budget.

## The six ClickUp custom fields map to ZERO Linear custom fields

| ClickUp custom field | Linear standard equivalent | Verified? |
|---|---|---|
| `Legacy ID` | issue identifier (`GAM-5`) plus the `Tnnn — ` title prefix | yes — every issue has one |
| `Tier` | **label group** `tier` with children `fast`/`standard`/`heavy` | **yes — created and applied** |
| `Provenance` | label group `provenance` | not created, same mechanism |
| `Premise gate` | label group `gate`, or a workflow state | not created, same mechanism |
| `Blocked by (legacy)` | native `blockedBy` relation | **yes — set and removed on GAM-5** |
| `Attempts` | comments (one per attempt, giving history not just a count) | not tested |

**Label groups are the key finding.** Linear label groups are mutually exclusive, which is exactly
dropdown-custom-field semantics, and they carry a description — so constitution item 26's own wording
lives on the label. Created `tier` (group) and `tier/fast` (child, description: *"Orchestrator
implements directly. No packet, no worker, no checker. Verification is NOT reduced."*). Both remain
in the workspace; they are harmless if this migration is not pursued.

Standard fields also available with no custom-field cost: `state`, `priority` (0–4), `estimate`,
`assignee`, `project`, `milestone`, `parentId`, `dueDate`, `links`, `cycle`.

## Workflow states already fit

The team ships with `Backlog · Todo · In Progress · In Review · Done · Canceled · Duplicate`, each
carrying a **type** (`backlog`/`unstarted`/`started`/`completed`/`canceled`). The swarm needs
`Ready to work → In progress → In review → Passed`, which maps onto these directly. ClickUp required
a bespoke 10-status set per list and still carried a competing default.

## Known gaps

- **No `delete_issue` in the MCP surface.** The probe was set to `Canceled` instead. Cleanup of a
  bad import would be manual or via the UI.
- **The closed-blocker gap is NOT solved by switching.** T166's blocker (T155) is a closed row, so it
  would be absent from a 33-row migration exactly as it was in ClickUp. Linear's advantage is that
  archived issues remain referenceable, so migrating closed rows as archived *may* fix it — untested,
  and gated on the archived-issues-count question above.
- **MCP-layer limits unmeasured** (see caveat above).

## Recommendation

Linear clears both walls that stopped ClickUp, and removes a third problem (Markdown corruption) that
cost a full day of repair. The migration payload already exists as structured JSON
(`clickup-migration-payload.json`), so a second migration is mostly a re-target, not re-work.

**Before committing, answer two questions:** (1) do archived issues count toward the 250 cap, and
(2) does the MCP server impose limits beyond the documented API ones. Both are cheap to test and both
are the kind of thing that ended the ClickUp attempt.

**Do not delete the ClickUp Space yet**, and do not freeze `task-ledger.md`. The ledger remains the
only complete, authoritative record and has survived both tool experiments intact.
