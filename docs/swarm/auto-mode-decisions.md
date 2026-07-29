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

### 2026-07-29 — T147, a user-reported bug: fixture teams reaching real users

George reported from manual testing that creating a new outreach shows the wrong
teams in the dropdown. Investigated and confirmed: `OutreachEventDialog`'s `teams`
prop is optional with a hardcoded `DEFAULT_TEAMS` fixture default
(`OutreachEventDialog.tsx:610-613`, `:964`, `:981`), and **neither call site passes
it**, so every real user sees `Ravens`/`Titans`.

**This is the most interesting failure in the session, because nothing went wrong.**
Both omissions are deliberate and documented — `OutreachList.tsx:3153-3160` and
`OutreachDetail.tsx:1420-1430` each record `teams` as intentionally not overridden
because it sat outside that task's Allowed Files. T101 and T121 both respected scope
correctly. The defect is purely that **no follow-up task was ever logged**, so a
scoping decision aged into a shipped bug that only manual testing caught.

**Decisions taken (auto mode):**

1. **Filed as T147 and packeted immediately** rather than queued behind T142/T146. A
   user-visible defect in a create flow outranks layout work and a test-coverage
   task.
2. **Scoped to include making `teams` required and deleting `DEFAULT_TEAMS`**, not
   just passing the prop at two sites. An optional prop with a plausible-looking
   fixture default is the mechanism that caused this; fixing only the instance leaves
   it armed for the next call site. Two call sites makes it cheap now. Same reasoning
   T143 used for `TeamOption.color`. **REVIEW** — this widens a bug fix into a small
   API change, which is exactly the kind of scope growth my own rule 5 warns about. I
   judged it in-bounds because the optional default *is* the bug, not an adjacent
   concern. George may disagree.
3. **Left `DEFAULT_STUDENTS` alone.** Same file, same smell, but T121 already wired
   the real roster into `students`, so it is a live default rather than a latent bug.
   Out of scope.
4. **Forbade `CoachHome.tsx` in T147's packet** because T142 is running against it.

**REVIEW — the process gap, which matters more than this bug.** Two workers each
correctly declined to fix something outside scope, and both said so in a comment
rather than in the ledger. Comments do not get triaged. If scope deferrals had been
required to produce a logged task, this would have been caught months earlier and by
a checker rather than by George. I am not changing the constitution unsupervised, but
I think it wants a rule: **a worker that deliberately leaves a known defect in place
must emit a follow-up task, not just a comment.** Flagging for George's decision.

Also worth noting: the grep that found this bug would have found it at any point
since T101. Nobody looked, because nothing was failing.
