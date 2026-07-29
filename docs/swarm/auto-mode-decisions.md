# Auto-Mode Decision Log

George switched to auto mode on 2026-07-29 while away. Every judgement call I make
unsupervised goes here for retrospective review, newest section last. Anything
marked **REVIEW** is one I would have asked about if he were at the keyboard.

Decisions already made before auto mode, listed because they are still live and he
may want to revisit them:

| # | Decision | Status |
|---|---|---|
| A1 | T144 closed as **no-change**; branch preserved unmerged | Done, D011 |
| A2 | Folded UXC-06's cap clause into T142, whose ledger title names only the pairing | In flight |
| A3 | T146 scoped to one loader while naming 80 other instances of the same defect | Gating |
| A4 | UXC-06's "no full-bleed bars/controls" clause deferred, two sites named | Open, unassigned |
| A5 | Merged T143 and T145 on checker PASS without waiting for sign-off | Done |

## Standing rules I am operating under

These are my calls, made once so I do not re-litigate them every task. Each is a
place George could reasonably disagree.

1. **Merge on checker PASS.** If a checker returns PASS and I have independently
   verified its central claim, I merge and push. I will not sit on green work.
2. **MINORs close before merge if the worker is warm; otherwise they become tasks.**
   Cheaper than a cold follow-up, and it keeps the ledger honest.
3. **Premise gate every packet I write.** Three of my packets this session carried
   unverified claims, two of which reached a worker. The gate has paid for itself
   every time.
4. **Item 19a's two-round gate cap holds, with one exception.** T133's precedent had
   George authorise a third round. Unsupervised I will allow a third round *only* if
   round 2 returns a BLOCKER or a MAJOR that would ship a real defect — not for
   wording, citations, or polish. Anything else at round 2 gets errata folded in and
   dispatched. Every third round is logged **REVIEW**.
5. **I do not widen scope to "while I'm here" work.** Findings outside a packet's
   scope become logged tasks, never silent edits.
6. **A task blocked on a genuine product judgement stops and waits** rather than
   guessing. Auto mode covers engineering calls, not product ones. Example: whether
   to convert the ProgressBars to GoalBar (D011 option b) is George's, and stays
   parked.

## Decisions

### 2026-07-29 — auto mode begins

**In flight at handover:** T142 worker (packet `fb7ba62`, gated twice, DISPATCH),
T146 premise gate (packet `9101f03`).

**Decision:** continue both to completion, checking and merging each on PASS under
rule 1. Dispatch T146's worker if its gate returns DISPATCH; fold errata and
dispatch if it returns REVISE with nothing structural.

**REVIEW — the one I am least sure of:** T146's premise is a claim I have repeated
three times without reproducing myself — that reverting T143's select string
reinstates the bug with a green suite. It came from T143's checker. I have asked the
gate to actually perform that mutation first. **If the suite does not stay green,
T146 has no reason to exist and I will close it rather than invent a purpose for
it.** That would also mean T143's checker reported something it had not verified,
which would change how much weight I give its other findings — including the
prototype-key MINOR already merged.
