---
name: linear-task-writing
description: Write or rewrite a Linear issue description so the owner can prioritize it and the next agent can implement it. Use whenever you file a Linear issue, rewrite one, or are told an existing issue is hard to understand. Also use before filing a deferral under item 20, and whenever a finding you measured is about to become someone else's work.
---

# Writing a Linear issue someone else can act on

Since item 29 froze the ledger, a Linear issue is the whole record of a piece of
work. It has exactly two readers and they need different things:

- **The owner**, deciding what to work on next. Needs to know what breaks, who
  sees it, how big it is, and whether it can wait.
- **The next agent**, implementing it cold. Needs current line numbers, the
  cause, the constraint that will trip them up, and the decisions left open.

The migrated rows serve a third reader who no longer exists: the filer, proving
they did the work. That is why they open with `Filed 2026-08-03 by the W4+W5
orchestrator during the T500 premise check (item 20)` and reach the actual defect
in paragraph two.

**Lead with the defect. Everything else is support.**

## Verify before you write

Re-check every line number, symbol, and claim against current `main`. A recorded
citation is historical evidence, not proof of current state, and rewriting an
unverified premise into clearer prose only makes a wrong claim easier to act on.

When re-verification contradicts the filing, **keep the correction in the issue**
under a `## Verification note`. Say what was wrong and why it matters. GAM-303's
filing put ParentHome at the wrong line and claimed it had two render sites when
it has one — small errors that would each have cost the implementer a search.

If you cannot verify a claim, mark it as unverified in the text. Do not quietly
drop it and do not restate it as fact.

## Structure

Use `TEMPLATE.md` in this directory. The sections, and what each is for:

| Section | Answers |
| -- | -- |
| Opening, no heading | What does a user see? One or two sentences, concrete. |
| Why it is worth fixing | What breaks, and for whom. Severity class, not adjectives. |
| Why it happens | The cause in one paragraph. Where the value really comes from. |
| Where it renders / lives | A table of file, line, what it does. |
| The one constraint | The trap that will bite the implementer. |
| Size and tier | Line count, blast radius, tier under item 26. |
| Suggested priority | Your call, with the reasons it can or cannot wait. |
| Verification note | What you re-checked, and what the filing got wrong. |

Drop a section when it has nothing to say. Do not pad it.

**Keep the original.** Put the pre-rewrite text in a `<details>` block at the
bottom and the ledger provenance table above it. Item 29 keeps Linear as the
source and git as the backup, so the original wording has to survive the rewrite.

## Give a priority, not a severity adjective

"Critical" and "high impact" do not help someone choose between two rows. These do:

- **Who is affected today, and whether anyone has actually seen it.** Several rows
  describe real defects on screens no user has reached yet. Say so, cite what
  makes it true, and note what would change it.
- **What it blocks.** Named issues, or "nothing".
- **What it costs.** Three display strings is a different decision from a migration.
- **When it stops being deferrable.** "Before real students use the app" is a
  usable trigger. "Soon" is not.

State a recommendation. The owner can overrule a recommendation; they cannot
overrule an absence of one.

## Titles

The title is what gets scanned in a column. Put the symptom in it, with the
concrete value where one exists:

> T808 — Students and parents see raw float hours (`3.9999983633333334 / 100 h`) beside a rounded percentage

Keep the `Tnnn — ` prefix on migrated rows: 300 rows of cross-references depend on
it. Newly filed issues have no `Tnnn` and need none (item 28b).

## Cite so the citation earns its place

Every reference should say what it proves. `StudentHome.tsx:1483` alone makes the
reader go look. This does not:

> `confirmedHours` is a verbatim passthrough from the `v_student_goal_projection`
> SQL view (`StudentHome.tsx:1431-1439` says so explicitly), so the render prints
> it as-is.

Name the near-miss when there is one. GAM-303's fix looks like it should reuse the
`round1` sitting a few hundred lines up in the same file — it should not, because
that helper belongs to a function this render path no longer calls. An implementer
who is not warned will reach for it.

## Anti-patterns, all of them from this repo's own rows

**Bold as shouting.** When `**MEASURED**`, `**CLOSED**` and `**Filed**` all appear
in one paragraph, bold stops meaning anything. Bold the row's single most
load-bearing claim, or nothing.

**Provenance before defect.** Who filed it and under which item belongs in the
provenance table, not the first sentence.

**Process narration ahead of the finding.** "Verified four ways rather than taken
on the row's word" is worth recording, under the verification heading, after the
reader knows what was verified.

**The 400-word single paragraph.** Break on the questions above. One idea per
paragraph.

**Prescriptions that outlived their premise.** A fix written months ago may now
encode a state the app cannot produce. When re-verification shows this, say so
plainly and say what replaces it — T703's prescribed fix would have added a
`peopleReached` value no write path can generate.

## Before you save

- Would the owner know whether to do this now or in three weeks?
- Could a cold agent start without asking a question?
- Is every line number checked against current `main` today?
- Does the opening say what breaks, before it says who found it?
- Is the original text preserved below?

`GAM-303` is the reference rewrite. Read it before your first one.
