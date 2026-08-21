Closes GAM-435

## What changed

Three documentation files record two owner rulings that the coach-dashboard
redesign depends on. Both decisions were made by the owner in a design session on
2026-08-21; this PR is the record, not the decision.

| File | What it adds |
|---|---|
| `docs/swarm/dispute-log.md` | **D020** (brand accent → Tracker Orange) and **D021** (`lucide-react` joins the allowlist), following the D002 / D013 / D014 owner-ruling shape |
| `docs/swarm/constitution.md` | item 9 gains `lucide-react` plus an inline note pointing at D021, matching item 8's style for the React 19 deviation |
| `docs/swarm/auto-mode-decisions.md` | the decision record both entries cite as their authority, quoting the owner rather than paraphrasing |

Without these, a checker meeting GAM-436's code reads a DES-04 violation with no
recorded exemption, and item 9 has no approval on file for a new dependency.

## What the issue got wrong

Nothing in the rulings. Two facts the row could not know at filing time:

- **`constitution.md` moved on `main`** — GAM-434 amended item 6 (PII: first name
  + last-initial is now explicitly permitted). This branch was cut from current
  `main` and cherry-picked; item 6 and item 9 do not overlap, so it auto-merged
  with no conflict. Both amendments verified present on this branch.
- The row said the records were "already drafted and pushed" on
  `claude/coaches-dashboard-design-i5wf1i`. True, but that branch carries no
  identifier the declaration gate can match, which is why this PR comes from a
  `claude/gam-435-*` branch instead.

## Tier, stated and defended

**FAST.** Three documentation files, no source, no schema, no write path, no
signature change.

**Declared deviation:** item 26's FAST bar asks for a named mutation that turns a
test red. There is none — governance prose has no test to turn. Declared rather
than relabelling the row to match what was actually done.

**The row carries `gate/human`, and that is the real gate here.** The label reads
"Requires the human owner. No machine may close this." The deliverable is the
owner's approval of the *wording*, which no automated check can supply. This run
therefore did **not** claim the row or move its state — it is still in `Todo`.
Merging this PR is the human gate being satisfied, and the owner is the one who
merges.

## Verification

```
GATE RUN — 3494e51 on claude/gam-435-record-d020-d021 — tree clean

  1 tsc              exit 0  PASS
  2 vite build       exit 0  PASS
  3 format:check     exit 0  PASS
  4 eslint           exit 0  PASS       0 errors, 380 warnings
  5 vitest (full)    exit 0  PASS       101 files / 2588 tests  baseline 2588 (+0)
  6 vitest (scoped)      –  SKIP
                            no scope given and none derivable from the diff

VERDICT: PASS — 5 of 6 gates. NOT all six: 1 skipped.
```

**5 of 6, not six.** Gate 6 is skipped because the diff touches no `src/` file.
Baseline measured directly at `origin/main` (`faab36c`).

Placement verified by reading the files: D020/D021 are numbered after D018-A /
D019, the last prior entry; item 9's amendment sits inline in the same style item
8 already uses.

## Scope

Closes GAM-435 fully. Documentation only — item 27 does not apply.

**GAM-436 (PR #216) depends on this.** That PR implements D020 and cites it, but
the ruling is not in its own diff. Merging #216 first leaves a DES-04 deviation
in `main` with no recorded exemption, so **this should merge first**.

## Five judgement calls in the drafts, for the owner specifically

These are the parts most worth disagreeing with — all mine, not the owner's:

1. **The light-mode orange `#A8560A` is derived, not inherited.** Production ships
   no light mode. Measured (5.11:1 on the light card), but it is my pick.
2. **D020 makes the competition-badge recolour binding scope**, on the grounds
   that an orange competition badge reads as "selected" once orange is the
   accent. Could reasonably have been a separate decision.
3. **D020 flags the `.astryx-progressbar.accent` pin** as a thing that would make
   the accent swap look broken. Recorded as a consequence, not ruled on.
4. **D021 records the unused `selectedIcon`** as an intentional divergence from
   Astryx's paired outline/filled best practice, so a checker reads it as the
   ruling rather than a defect.
5. **Item 9 says approval is "recorded in the ledger", but item 29 froze the
   ledger.** The drafts resolve that by recording to the dispute log, the
   decision record, and the Linear row. That is an interpretation of a clash
   between two constitution items and is the single most contestable line here.

## Known gaps, disclosed

- **The rulings' substance was decided verbally in a design session**, and the
  decision record quotes that session. Anyone auditing this has my transcription
  of the owner's choices, not an independent record of them.
- **D020's competition-hue reassignment is stated but not chosen in this PR** —
  teal was selected in GAM-436 (#216), not here.

Linear-Issue: GAM-435
