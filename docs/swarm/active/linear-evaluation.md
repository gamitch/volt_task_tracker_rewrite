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
| Requests | **1,500–5,000/hour** (see discrepancy below) | ~30–50/**day**, inferred from two lockouts |
| Remaining quota visible? | **Yes** — `X-RateLimit-Requests-Remaining` on every response | No |
| On exceeding | HTTP 400, `code: RATELIMITED` | ~22 hour lockout, **reads blocked too** |
| Reset | rolling hourly window, leaky bucket | ~1370 minutes |

**Discrepancy, unresolved.** A live fetch of `linear.app/developers/rate-limiting` on 2026-08-09
reported **5,000/hour** for both API key and OAuth. Third-party sources (merge.dev, lifestack.ai)
report **1,500/hour**. The blogs are probably stale, but this was not resolved and the lower figure
should be assumed. Either way it is two orders of magnitude beyond ClickUp's observed budget.

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

⚠️ **Unverified:** whether archived issues count toward the 250. Third-party sources say they do not.
This was NOT tested and it matters — the full ledger is 293 rows, so migrating everything rather than
just the open rows depends entirely on this answer.

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
