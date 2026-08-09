# Linear migration plan — draft for owner approval

**Status: DRAFT. Nothing has been written to Linear beyond the disposable probe (`GAM-5`, archived)
and two labels.** Requires owner approval before execution.

Supersedes nothing yet. `docs/swarm/task-ledger.md` remains authoritative until this is executed and
verified, and the ClickUp Space is retained until then.

## Goal

Move the task ledger into Linear as the dispatch board, with **zero custom fields**, and with the
full history preserved rather than truncated to the open rows.

**Non-goals.** Not freezing the ledger in the same change. Not deleting the ClickUp Space. Not
changing any production code.

---

## 1. Field mapping — ZERO custom fields required

Polled `IssueCreateInput` (36 writable fields) against the ledger's 10 columns plus ClickUp's 6
custom fields. Mapped by **meaning**, not by name.

| Our field | Linear target | Kind | Notes |
|---|---|---|---|
| `ID` (`Tnnn`) | `title` prefix + Linear's own `GAM-n` | built-in | Already the convention (`T166 — …`). Linear's identifier is a second, independent handle. |
| `Title` | `title` | built-in | Direct. |
| `Last Result` | `description` | built-in | Markdown verified lossless — see §2. |
| `Status` (94 distinct) | `stateId` (7 states) **+ original string preserved verbatim in `description`** | built-in | Normalisation is lossy; preserving the source text makes it recoverable. See §3. |
| `Epic` (109 distinct) | `projectId` — the ~10 **W-block** workflows, not the 109 epic codes | built-in | Projects are Linear's grouping primitive. The raw epic code (`E4`, `UXC (PRD v3.1)`) stays in the description. |
| `Deps` | native `blockedBy` **issue relation** | built-in | Verified working on the probe. |
| `Tier` | label group `tier` → `fast` / `standard` / `heavy` | label | **Created and verified.** Groups are mutually exclusive = dropdown semantics, and carry a description, so item 26's wording lives on the label. |
| `Provenance` | label group `provenance` | label | Same mechanism. |
| `Premise gate` | label group `gate` | label | Same mechanism. |
| `Escalated` | label `escalated` | label | 247 of 251 rows read `No`. Only **1** row is `Resolved`. A field for this would be dead weight. |
| `Worker` (27 distinct) | `description` | — | See §1.1 — deliberately NOT `assigneeId`. |
| `Checker` (44 distinct) | `description` | — | Column is polluted with evidence prose (`orchestrator (4 mutations replayed, all red at exit 1)`). Not an enum. |
| `Attempts` (0–2) | `description` for history; **comments** going forward | — | See §1.2 — deliberately NOT `estimate`. |

**Result: zero custom fields.** Everything lands on built-ins, labels, relations, or projects.

### 1.1 Why `Worker`/`Checker` are not `assigneeId`

They are agent identities (`worker-implementer (sonnet, worktree)`), not workspace members.
Assigning to a non-existent user fails; fabricating users to satisfy the field would misrepresent
accountability, since the responsible human is the owner for every row. The information is
historical and belongs in the record, not in a routing field.

**Future option worth noting:** `IssueCreateInput` exposes `delegateId` — *"the identifier of the
agent user to delegate the issue to"*. Linear has a first-class agent-user concept. If agents are
ever registered as Linear agent users, that becomes the correct home for `Worker`. Not today.

### 1.2 Why `Attempts` is not `estimate`

`estimate` is the only writable integer that could hold it, and using it would be wrong on meaning —
which is the criterion set for this mapping. In Linear `estimate` is **complexity**, and it drives
velocity, burndown and cycle analytics. Writing attempt counts there would corrupt Linear's own
charts and mislead any human reading them. It also depends on team estimation settings being
enabled.

Attempts is genuinely low-value as a field: 146 rows are `0` and only 9 exceed `1`. Historical values
go in the description. Going forward, one comment per attempt records *what happened*, not just a
count — strictly more useful, and it is what the ledger's `Last Result` column already does in prose.

---

## 2. Why Markdown fidelity is settled

The ClickUp CSV importer escaped Markdown at the character level (`\*\*bold\*\*`,
`v\_student\_participation`) and truncated cells at escaped pipes. Repairing it cost 24 rewrite calls
— most of a ClickUp daily budget.

A probe issue carrying the identical torture-test content survived Linear **completely intact**:
bold, backticks, snake_case identifiers, a pipe table, and `a \| b`. Only cosmetic normalisation
(`|---|` → `| -- |`, `-` → `*` list markers).

---

## 3. Status normalisation — 94 values to 7 states

The ledger's `Status` column is not an enum. `Passed` covers 135 rows; the remainder is prose
(`**Passed — 1st attempt. ✅ MERGED — landed in PR #28 (bc53aab)…`).

| Ledger pattern | Linear state | Type |
|---|---|---|
| `Passed`, `MERGED`, `Voided` | `Done` | completed |
| `In review` | `In Review` | started |
| `In progress`, `Reserved` | `In Progress` / `Backlog` | started / backlog |
| `Ready to work` | `Todo` | unstarted |
| `Filed`, `Blocked`, `Blocked on …`, **`NARROWED`** | `Backlog` | backlog |
| `Human gate` | `Todo` + label `gate/human` | unstarted |

**Two rules carried from T512, which exist because a previous count got both wrong:**

1. **`NARROWED` is OPEN, not closed.** Treating it as closed silently dropped T333 from every count.
2. **Any status string matching no known pattern must FAIL LOUDLY and halt that row** — never fall
   through to a default. A migration that guesses produces a plausible board rather than an error.

Blocking is expressed as a **relation**, not a state — Linear has no "blocked" state, and the
relation is the better representation because it names *what* blocks.

---

## 4. Ledger parsing — measured, with a validated repair

288 `Tnnn` rows. Parsed by locating `Status` via the **header name**, never a fixed index (T512).

| Shape | Rows | Handling |
|---|---|---|
| 10 columns (matches header) | 251 | direct |
| 11–13 columns | **35** | **auto-repair, validated** |
| 9 columns | **2** (`T063`, `T330`) | **manual — do not guess** |

**The overflow cause is understood, not worked around.** Extra columns come from unescaped `|`
inside the prose-heavy `Last Result` cell. Rejoining cells `8 … n-2` restores it. Validated by
asserting, after rejoin, that `Attempts` is numeric and `Escalated` is a known value:
**35 of 35 pass, 0 failures.**

The 2 underflow rows are genuinely missing a column and shift every field after it — this is the
defect that made T063 read `worker-implementer (sonnet)` as its title during the ClickUp migration.
They are hand-mapped. T063's correct shape is already known and recorded.

---

## 5. Execution phases

Each phase is independently verifiable and independently abandonable.

**Phase 0 — scaffolding (~15 requests).** Create label groups `tier`, `provenance`, `gate`, plus the
standalone `escalated` label. Create ~10 projects for the W-blocks. `tier`/`tier:fast` already exist.

**Phase 1 — dry run, writes nothing.** Parse all 288 rows, apply the mapping, and emit
`linear-migration-payload.json` plus a report: rows per state, per project, per label; unmapped
status strings; rows failing parse. **Owner reviews before any write.** This is the gate that the
ClickUp migration lacked, and the escaped-pipe truncation is exactly what it would have caught.

**Phase 2 — the 33 open rows (~40 requests).** Create active. Verify by count and by spot-reading
descriptions for Markdown fidelity. Stop here if anything looks wrong; 33 rows is a recoverable
mistake.

**Phase 3 — the ~253 closed rows (~510 requests).** Create, then archive each. Archived issues are
**exempt from the 250 cap** (plan comparison: *"Issues (excluding archive) — 250"*), so the workspace
settles at ~33 active with full history retained.

**Phase 4 — relations (~30 requests).** Apply `blockedBy` from the `Deps` column, after all issues
exist so both ends resolve. **This is where Linear beats ClickUp structurally:** ClickUp could not
express T166→T155 because closed rows were never imported. Here they exist, archived, and remain
referenceable.

**Phase 5 — records.** Update `task-ledger.md` with a header pointing at Linear, add the
`Linear-Issue:` commit trailer to `constitution.md` item 24, create the PR template, and add the CI
trailer check as a **warning first**.

**Total ≈ 600–700 requests ≈ 25% of ONE hour's budget** (measured limit: 2,500/hour). The same work
exhausted ClickUp's daily budget and cost a ~22 hour lockout.

---

## 5a. Execution mechanism — a reviewable GraphQL script, NOT 600 MCP calls

Two routes exist. **The script is better on every axis that matters here**, and this is a change from
the assumption the ClickUp migration ran on.

| | MCP tool calls | GraphQL script + API key |
|---|---|---|
| Rate-limit headers | **invisible** — MCP returns JSON bodies only | **visible** — `x-ratelimit-requests-remaining` on every response |
| Deletion for rollback | **not exposed** — no `delete_issue` | `issueDelete` available |
| Batching | one issue per call | many operations per request, cutting total requests |
| Reviewable before running | no — 600 individual decisions | **yes — one script the owner can read** |
| Resumable after failure | manual | checkpointed, re-runnable |

The ClickUp migration's worst moments — an invisible quota, an unreviewable sequence of writes, and
no way to undo — are all consequences of driving it through per-item tool calls. Running this as one
script removes all three.

**Credential handling.** The key used for this plan's introspection was pasted into a chat transcript
and must be revoked. At execution time, create a **fresh** key, and revoke it the moment the
migration verifies. Short-lived keys are the point: this one has already done its job.

## 6. Verification

- Row count per state and per project reconciles against the ledger parse.
- Every `Tnnn` id appears exactly once — duplicates detectable because the id prefixes the title.
- Spot-check 5 descriptions containing pipes, bold and backticks for fidelity.
- Every `Deps` entry resolves to a real issue, or is reported — no silent drops.
- **Zero custom fields exist in the workspace at the end.**

## 7. Rollback

- **Phase 0–1:** nothing written; delete the labels/projects.
- **Phase 2+:** archive everything created. ⚠️ **`delete_issue` is NOT exposed by the MCP surface** —
  bulk deletion is a UI action or a direct GraphQL `issueDelete`. Archiving is the cheap reversal;
  full deletion needs the API key path.
- **At every phase:** `task-ledger.md` is unmodified and complete, and the ClickUp Space still holds
  the 33 open rows. Two intact fallbacks.

---

## 8. Open questions for the owner

1. **Migrate all 288 rows, or only the 33 open?** Plan assumes all — history is cheap now that
   archived rows are exempt, and the closed-blocker gap (T166→T155) only closes if closed rows exist.
2. **Projects for W-blocks — confirm the ~10 groupings**, since `Epic`'s 109 distinct values are too
   granular to be projects and will live in descriptions.
3. **One team or two?** Free allows 2. A single `Gamitch` team is simplest; a second could separate
   swarm process rows from product rows.
4. **Tier is blank on 31 of 33 open rows.** Item 26 dispatches on tier. Migrating blanks is honest
   but leaves dispatch ambiguous — set them during Phase 1 review, or accept blanks and set on pickup.

## 9. Process note

This plan touches no production code and no schema; it moves records between external systems. Under
item 26 that is not HEAVY. But it **is** a bulk irreversible-ish write to an external system, so
Phase 1's dry run plus owner review is the substitute for a premise gate — and the specific failure
it exists to prevent (silent truncation producing a plausible-looking board) is one this project has
already suffered once, in the ClickUp payload builder.
