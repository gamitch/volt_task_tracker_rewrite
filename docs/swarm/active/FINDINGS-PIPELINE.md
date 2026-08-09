# Findings pipeline — how a skill's discoveries become tracked work

**Status: DRAFT for owner approval.** The four findings from PR #118 were filed by hand as the
worked example (T808, T809, T615, T616). Nothing is automated yet.

## The problem, stated from the case that prompted it

PR #118 shipped a persona harness and found **four unfixed UI bugs**. They were recorded in the PR
body and an HTML artifact. Measured on the day it merged:

- **None of the four had a ledger row.** `created_by` appeared **zero** times anywhere in the ledger.
- The new `e2e-personas` skill's 175 lines mention ledgers, Linear, item 20 and follow-ups **zero
  times**.

So four evidenced bugs existed only in prose in a merged PR. That is **constitution item 20's exact
failure mode**, and item 20 exists because three production bugs shipped when deferrals were recorded
as comments rather than rows. **A merged PR body is worse than a code comment** — the comment at
least sits beside the code a future reader is editing.

One of the four proves the point twice over: `StudentHome.tsx:1443` reads
`// Module doc #7: local-only. No Supabase write happens here.` A student's RSVP is silently
discarded, the code says so, and no row ever tracked it (now T809).

## Principle

**Findings are data, not prose.** A skill that discovers things must emit them in a shape a machine
can file, dedupe and count. Prose is for humans reading one report; a queue needs records.

## Schema — `docs/swarm/inbox/<branch>-findings.json`

```jsonc
{
  "source": "e2e-personas",              // skill or agent name -> provenance label
  "branch": "claude/ui-e2e-testing-personas-h5ozm1",
  "commit": "42680a6",                   // what the findings were measured against
  "measuredAt": "2026-08-09T13:03:24Z",
  "findings": [
    {
      "findingKey": "e2e-personas/student-hours-unrounded",   // STABLE. The dedupe identity.
      "title": "Students and parents see raw float hours beside a rounded percentage",
      "severity": "MAJOR",               // constitution's scale: BLOCKER|MAJOR|MINOR|NIT
      "area": "w5",                      // -> area/* label; omit if genuinely unknown
      "evidence": [
        { "file": "src/pages/home/StudentHome.tsx", "line": 1483,
          "quote": "formatValueLabel={(value, max) => `${value} / ${max} h (${hoursPercent}%)`}" }
      ],
      "observed": "3.9999983633333334 / 100 h (4%)",
      "expected": "4.0 / 100 h (4%) — the coach dashboard already shows 4.0 for the same student",
      "verifiedBy": "browser",           // browser|source|mutation|database — HOW it was established
      "reproduction": "npx playwright test -c tests/e2e-harness/playwright.personas.config.ts",
      "proposedScope": "Round at the format boundary only. Do NOT round confirmedHours before the progress bar's arithmetic."
    }
  ]
}
```

**`findingKey` is the load-bearing field.** It is the dedupe identity, so it must be stable across
runs and independent of line numbers, which move. `<source>/<slug-of-the-defect>`, not
`<file>:<line>`.

**`verifiedBy` matters more than it looks.** This project has repeatedly filed rows whose premise was
false — T161, T162, T163, T167 and T321 were all measured wrong by one external audit that counted
filenames instead of invocations. A triager needs to know whether a finding was *watched happening*
or *read out of source*.

## Pipeline

1. **Skill emits** the JSON as its last step. Constitution item 20 becomes checkable: a skill that
   found something and filed nothing has an empty `findings` array, which is a claim rather than an
   omission.
2. **`scripts/linear-file-findings.mjs`, dry run by default.** Prints what it would file, what it
   would skip as duplicate, and anything it cannot map — same discipline as
   `scripts/linear-migrate.mjs`, for the same reason: a run that files 40 issues unreviewed poisons
   the board faster than any of them get fixed.
3. **`--execute` creates issues in `Backlog`.** Filing is not dispatching. The owner promotes to
   `Todo`; item 28 is unchanged.
4. **Dedupe on `findingKey`**, written into the issue body as `Finding-Key: <key>` and read back
   before creating. Same idempotency the migration used with `Tnnn`, and it must survive a re-run of
   the same suite finding the same four bugs.
5. **Labels on arrival:** `tier/unreviewed` (never a defaulted `standard` — §1.4 of
   LINEAR-MIGRATION.md), `area/*` when `area` is present, and `provenance/<source>`.

`provenance` finally earns its keep here. It was created during the migration and populated on
nothing, because the ledger had no such column. A finding's origin is exactly the signal a triager
needs, and this is where it starts existing.

## ⚠ This breaks constitution item 28 as written, and item 28 must change first

Item 28 says: *"ignore any issue whose title does not begin `Tnnn — `."* Every migrated issue carries
that prefix because the ledger numbered it. **A newly filed finding has no `Tnnn`, so under item 28
every agent would ignore it** — the pipeline would file work into a queue nobody may take.

Two ways out:

- **Allocate a `Tnnn`** per finding from the block table. Keeps one id space and 300 rows of
  cross-references intact, and is what was done by hand for T808/T809/T615/T616. Cost: the ledger
  stays a numbering registry forever, which is the dual-maintenance the migration exists to end.
- **Change the identity rule to the `tier/*` label.** Every migrated row has one, every filed finding
  gets `tier/unreviewed`, and Linear's own onboarding issues have none. More robust than title
  formatting, and it does not depend on a document staying authoritative.

**Recommended: the label rule**, with the `Tnnn —` prefix kept for migrated rows because their
cross-references are real and worth preserving. New findings may carry a `Tnnn` when one is cheap and
need not when it is not.

## Worked example — PR #118, filed by hand 2026-08-09

| Row | Finding | Verified how |
|---|---|---|
| **T808** | raw float hours beside a rounded percentage | source, re-read at `StudentHome.tsx:1483` |
| **T809** | Sign up / Can't go writes nothing and says nothing | source; the code's own comment states it |
| **T615** | schedule-meetings offers and pre-selects archived teams | source, `ScheduleMeetingsDialog.tsx:1160` |
| **T616** | `events.created_by` never written; reader exists, writer does not | source, `meetings.ts:1137` insert payload |

**Every claim was re-verified against the current tree before filing rather than trusted from the
report** — one of the four (the team picker) was reported against a component path that does not
exist, and had to be relocated before it could be confirmed. That is the check this pipeline must
keep: a findings file is an input to triage, not a verdict.
