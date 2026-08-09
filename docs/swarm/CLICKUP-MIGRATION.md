# Moving the ledger to ClickUp — spec and migration plan

**Written 2026-08-07 by W1**, on the owner's request to evaluate ClickUp as the home for task
tracking. **Nothing has been created yet.** This file is the spec; the payload is built and
waiting.

## The split: tasks move, reasoning stays

**ClickUp owns:** the ledger's tabular half — row, status, tier, dependencies, attempts,
provenance, and the long "Last Result" prose.

**Git keeps, unambiguously:** `constitution.md`, `WORKFLOWS.md`, `KICKOFF-PROMPTS.md`,
`verification-log.md`, `auto-mode-decisions.md`. These are reasoning artifacts that must be
reviewable in a PR and versioned against the code they describe. In ClickUp Docs they would lose
both.

`task-ledger.md` is **frozen in place** as the historical record — roughly 130 closed rows whose
value is their prose (T804's lesson, T199's arc). They are not imported.

## What this fixes, and what it costs

Fixes, all evidenced from the week of 2026-08-05:

- **Merge conflicts.** `WORKFLOWS.md:48` calls this file "the one guaranteed conflict"; W1 hit one
  on 2026-08-07 merging T199 against T705.
- **Row-number blocks.** T400–T499 per workflow exists *only* to stop machines colliding after
  T196/T197 collided twice. ClickUp assigns IDs; the mechanism becomes unnecessary.
- **Hand-counted open rows.** T512 was filed because these counts drift.
- **Corrections that overwrite.** T705 was restated three times in one day, each partly
  overwriting the last. As comments, the whole chain survives in order.

The cost, stated plainly:

**Constitution item 24 does not survive intact.** "Ledger row + verification-log entry move in the
SAME COMMIT that merges the work" is a git atomicity guarantee. ClickUp cannot provide it — a PR
can merge while the task stays open.

**Bridge:** a commit trailer, alongside the two already in use.

```
ClickUp-Task: https://app.clickup.com/t/<id>
```

CI rejects a merge whose body lacks it. `git log` still answers *which commit closed which row*;
ClickUp answers *what is true now*. Weaker than atomicity, but enforceable.

Smaller losses to accept knowingly: ledger changes stop appearing in PR diffs where checkers read
them today, and every agent needs API round-trips (the ClickUp MCP server dropped twice during the
session that wrote this file).

---

## Setup — three steps only the ClickUp UI can do

The MCP toolset exposes `create_folder`, `create_list`, `create_task`, dependencies, links and
comments. It has **no** tool for creating a Space, defining statuses, or defining custom fields
(only `get_custom_fields`, no setter). So these three are manual, once:

### 1. Create the Space

Name **`VOLT Portal`**, **private to the owner**. The workspace has six members — students,
parents and mentors — and rows discuss RLS policies and production data.

### 2. Define these 8 statuses on the Space

Each one names **who holds the ball**. Order matters; type in brackets.

| # | Status | Type | Holder | Meaning |
|---|---|---|---|---|
| 1 | `Filed` | not started | owner | A machine found and traced it. Nothing decided. |
| 2 | `Ready to work` | active | agents | **The owner's release gate.** Reviewed and approved. |
| 3 | `In progress` | active | one agent | Claimed. Packet, premise gate and implementation all happen here. |
| 4 | `In review` | active | checker | PR open / `checker-reviewer` running. |
| 5 | `Blocked on owner` | active | owner | An agent stopped mid-flight needing a decision. |
| 6 | `Human gate` | active | owner | Only a human can ever do this (T052, T063, T065, T070). |
| 7 | `Merged` | closed | — | Done. |
| 8 | `Won't fix` | closed | — | Closed deliberately (T505, T804). |

### 3. Define these 5 custom fields

| Field | Type | Options / notes |
|---|---|---|
| `Legacy ID` | Text | `T705`. Every doc and commit references these — the mapping must survive. |
| `Tier` | Dropdown | `FAST` · `STANDARD` · `HEAVY` — drives constitution item 26. |
| `Provenance` | Dropdown | `owner-live-testing` · `premise-gate` · `checker` · `audit` · `other`. |
| `Attempts` | Number | Constitution item 19's bounded loop. |
| `Premise gate` | Dropdown | `not-run` · `REVISE` · `DISPATCH` — item 19 blocks dispatch on this. |

**Premise gate is a field, not a status, on purpose.** HEAVY rows go through it; FAST rows do not.
As a status every FAST row would skip a column and the board would misrepresent the pipeline.

---

## The two rules that make the gate real

Both belong in `constitution.md` and in every kickoff prompt:

1. **An agent may only pick up a task in `Ready to work`.** Nothing else, ever. `Filed` is not an
   invitation.
2. **An agent moves `Ready to work → In progress` the moment it claims a task**, before doing
   anything else. That is an atomic claim, and it is strictly stronger than the row-number blocks
   it replaces — blocks only prevented ID collisions, never two machines working the same row.

Side effect: kickoff prompts get much shorter. "Read RESUME-HERE, then WORKFLOWS, then find your
rows" becomes *"filter this Space for `Ready to work`, take the top one, move it to
`In progress`."*

---

## The payload

Built 2026-08-07 from `task-ledger.md`, ready to create via API:
`active/clickup-migration-payload.json` — **33 tasks**, being the 43 open rows minus 10 placeholders
(T310/T311 VOID, T312–T319 RESERVED). Those simply do not come across; that is free cleanup.

Per task: `legacy_id`, `name`, target list, mapped status, tier, provenance, attempts, deps
(for native dependency links), worker, checker, and a Markdown description carrying the full
original prose (longest is 4,189 characters).

Distribution:

| Lists | Statuses | Provenance |
|---|---|---|
| Unassigned 10 · W7 5 · W5 5 · Human gates 4 · W3 3 · W10 3 · W4 1 · W8 1 · W9 1 | Filed 26 · Human gate 4 · Blocked on owner 3 | other 13 · audit 10 · checker 5 · owner-live-testing 3 · premise-gate 2 |

### Two gaps the migration surfaced — worth more than the migration

**`Tier` is absent on 31 of the 33 open rows.** It is what constitution item 26 dispatches on.
In markdown it is optional prose and nobody notices; as a required field it is 31 blanks.

**`WORKFLOWS.md` does not place 10 of the 33.** Every row filed after the workflow cut was written
— T705, T806, T807, T407, T614, T612 and others — belongs to no workflow in that document. They
are landing in an `Unassigned` list, which is the honest representation and also the argument for
doing this: the markdown hid it.

Both are review work for the owner, and they are exactly what the `Filed → Ready to work` gate is
for.

## Order of operations

1. Owner does the three UI steps above.
2. W1 creates Lists `W1`…`W10`, `Unassigned`, `Human gates`.
3. W1 migrates **W3 (3 rows) as a pilot** — most active workflow.
   *(Corrected 2026-08-07: this step originally justified W3 by saying its rows carry
   `owner-live-testing` provenance. They do not — T606, T607 and T608 are all `other`. The three
   `owner-live-testing` rows are T333, T806 and T407. W3 stands as the pilot on the
   most-active ground alone.)*
4. Owner reviews the pilot. If it holds up, W1 imports the remaining 30 and wires dependencies.
5. Freeze `task-ledger.md` with a header pointing at the Space; add the `ClickUp-Task` trailer
   requirement to `constitution.md` item 24 and to the PR template.
