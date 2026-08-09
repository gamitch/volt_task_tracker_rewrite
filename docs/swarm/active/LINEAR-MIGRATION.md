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
| `Epic` (109 distinct) | label group `area` (`w1`…`w10`), **not** `projectId` | label | **DECIDED: Option 3.** See §1.3. The raw epic code (`E4`, `UXC (PRD v3.1)`) stays in the description. |
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

### 1.3 Why `area` is a label and NOT a Linear Project — measured

**Owner decision 2026-08-09: tags, not projects.** Two measurements drove it.

**83% of rows predate the W-block system.** 245 of 295 are `T001`–`T399` and carry no W-number at
all; only 50 do. Under a project-per-workflow scheme, 245 rows would sit in no project, which reads
as "someone forgot to file this" rather than "this predates the scheme". An absent label reads as
nothing at all, which is the truth.

**The numbers are explicitly not ownership.** `WORKFLOWS.md` states it directly: *"the block is a
collision-avoidance reservation, not an ownership claim."* `T509` sits in W2's `T500-599` range but
is W4's work; `T508`/`T510`/`T511` are W3's. Deriving projects from id ranges would misfile them
**silently** — the same class of defect as §4.1.

**And a Linear Project is the wrong shape.** Projects carry a start date, target date, lead and
progress bar; they are built for efforts that *finish*. "Run a meeting" is a permanent area of the
app with no end date — every such project would sit at partial completion forever. An issue can also
belong to only one project, and `T507`–`T511` prove a row can genuinely span two areas (filed under
one workflow, living on another's surface). Labels are non-exclusive and cost one second to correct.

Projects are reserved for work that genuinely ends — a go-live, a migration — if wanted later.

### 1.4 `Tier` — `unreviewed`, not a defaulted `standard`

The owner proposed populating blank tiers with `standard` and having the premise gate validate them.
**The intent is right — every row should carry a tier so dispatch is never ambiguous — but a
defaulted `standard` is unsafe for two reasons, so the plan implements the intent differently.**

1. **It is the placeholder-default defect class**, which has produced more bugs in this project than
   any other single pattern: an optional value, a plausible default, and nothing forcing a real
   decision (T151, T155, T158, T159, T170, T176, T181, T407 — and T172 exists specifically to stop it
   recurring). A defaulted `standard` is **indistinguishable from a judged `standard`**, which is the
   exact property that makes the class dangerous. Item 26 requires the tier judgement to be *stated
   and defended* so a wrong call is visible.
2. **Only HEAVY runs `checker-premise`.** Item 26's FAST and STANDARD tiers have no gate at all — so a
   row defaulted to `standard` would never reach the validation the proposal relies on. The gate
   cannot catch what never reaches it.

**Implementation:** the `tier` label group carries a fourth value, **`unreviewed`**, applied to every
row with no tier in the ledger (31 of the 33 open rows). Nothing is blank, and "not yet judged" is
visibly different from "judged as standard".

**The enforcing rule is at pickup, not in a gate:** a row labelled `tier/unreviewed` may not be moved
to `In Progress`. Tiering it is the first act of picking it up, which is where the judgement belongs
and where item 26 already puts it.

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

**295 task rows.** Parsed by locating `Status` via the **header name**, never a fixed index (T512).

| Shape | Rows | Handling |
|---|---|---|
| 10 columns (matches header) | 258 | direct |
| 11–13 columns | **35** | **auto-repair, validated** |
| 9 columns | **2** (`T063`, `T330`) | **manual — do not guess** |

### 4.1 The count was wrong once already — 288, not 295

The first pass of this plan said **288**, and the owner initially accepted that figure. It was wrong.
The row pattern `^\|\s*T\d+\s*\|` requires a pipe immediately after the digits, which silently skipped
**7 suffixed corrective-task ids**: `T002a`, `T002b`, `T006a`, `T016a`, `T073a`, `T073b1`, `T073b2`.

Caught by cross-checking three independent counts against each other rather than trusting one:
297 table lines − 2 (header + separator) = 295, which reconciles exactly.

**This is the migration's own headline failure mode, committed by its own parser.** A regex that is
slightly too strict does not error — it returns a smaller, entirely plausible number, and 7 rows of
real history disappear with nothing to notice. It is the same shape as T512's `NARROWED`-treated-as-
closed defect and the ClickUp payload builder's escaped-pipe truncation.

**Consequence for the script:** it must assert `total == 295` and abort if the count moves
unexpectedly, and it must reconcile parsed rows against raw table lines rather than trusting a single
pattern. A count that cannot be cross-checked is not a count.

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

**Phase 0 — scaffolding (~20 requests).** Create label groups `tier` (`fast`/`standard`/`heavy`/
**`unreviewed`**), `area` (`w1`…`w10`), `provenance`, `gate`, plus the standalone `escalated` label.
`tier` and `tier/fast` already exist. **No projects are created** (§1.3).

**Phase 1 — dry run, writes nothing.** Parse all 288 rows, apply the mapping, and emit
`linear-migration-payload.json` plus a report: rows per state, per project, per label; unmapped
status strings; rows failing parse. **Owner reviews before any write.** This is the gate that the
ClickUp migration lacked, and the escaped-pipe truncation is exactly what it would have caught.

**Phase 2 — the 33 open rows (~40 requests).** Create active. Verify by count and by spot-reading
descriptions for Markdown fidelity. Stop here if anything looks wrong; 33 rows is a recoverable
mistake.

**Phase 3 — the ~260 closed rows (~525 requests).** Create, then archive each. Archived issues are
**exempt from the 250 cap** (plan comparison: *"Issues (excluding archive) — 250"*), so the workspace
settles at ~33 active with full history retained.

**Phase 4 — relations (~30 requests).** Apply `blockedBy` from the `Deps` column, after all issues
exist so both ends resolve. **This is where Linear beats ClickUp structurally:** ClickUp could not
express T166→T155 because closed rows were never imported. Here they exist, archived, and remain
referenceable.

**Phase 5 — records.** Update `task-ledger.md` with a header pointing at Linear, add the
`Linear-Issue:` commit trailer to `constitution.md` item 24, create the PR template, and add the CI
trailer check as a **warning first**.

**Total ≈ 620–720 requests ≈ 28% of ONE hour's budget** (measured limit: 2,500/hour). The same work
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

1. ~~**Migrate all rows, or only the 33 open?**~~ **DECIDED by the owner: all 295.** Plan assumes all — history is cheap now that
   archived rows are exempt, and the closed-blocker gap (T166→T155) only closes if closed rows exist.
2. ~~**Projects for W-blocks?**~~ **DECIDED: no projects — an `area` label group instead (§1.3).**
3. ~~**One team or two?**~~ **DECIDED: one team (`Gamitch`).**
4. ~~**Tier is blank on 31 of 33 open rows.**~~ **DECIDED: `tier/unreviewed`, enforced at pickup (§1.4)** —
   the owner's intent, implemented without a defaulted `standard`. **Owner: confirm this variation.**

## 9. Process note

This plan touches no production code and no schema; it moves records between external systems. Under
item 26 that is not HEAVY. But it **is** a bulk irreversible-ish write to an external system, so
Phase 1's dry run plus owner review is the substitute for a premise gate — and the specific failure
it exists to prevent (silent truncation producing a plausible-looking board) is one this project has
already suffered once, in the ClickUp payload builder.
