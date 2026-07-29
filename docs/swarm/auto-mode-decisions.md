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

### 2026-07-29 — process correction: I was doing the foreman's job

George asked why I was writing packets when `foreman-planner` exists for it. He is
right, and the evidence is unambiguous: **packet authoring has been the weakest link
in this session.** Four citation errors, three of which reached workers, every one
caught by a gate rather than by me:

| Error | Shape |
|---|---|
| D011 — three bars "have no value label" | Concluded from one absent prop, never read the surrounding JSX |
| D012 — a citation "was already wrong" | Never opened the commit; it was correct when written |
| T142 rev 1 — sidenav 240px, window "measured" | Wrong input, and credited a gate with a measurement it never took |
| T146 — `client.ts:23` calls `createClient` | That is the import line; the call is `:79` |

Two of those are the *same two* mistakes repeated. The pattern is that I write
packets from my own investigation held in context, rather than from the tree — which
is exactly what a fresh agent re-deriving from source would not do.

**Decision: `foreman-planner` owns packet authoring from here.** I investigate, hand
the finding over with my diagnosis explicitly marked as unverified, and it writes the
packet and re-derives every citation. I keep gating and dispatch. Handed T147 and
T148 over immediately rather than finishing them myself.

**REVIEW:** I do not know how far back this drift goes — the earlier packets in this
session (T144, T145, T146) were all mine too. Worth George deciding whether the
foreman should also own the *existing* queued packets, or only new ones.

Also logged as a mistake in its own right: I edited T147's packet **while a
checker-premise gate was running against it**, so that gate is reading a file that
changed underneath it. Its findings on the outreach half should still hold, but the
run is compromised and I will treat its output as advisory rather than authoritative.

### 2026-07-29 — reverted an unauthorized source edit by the foreman

A stop-hook check surfaced `src/pages/outreach/OutreachEventDialog.tsx` modified in
the working tree. Not my edit. `foreman-planner` was the only agent running with
write access, and it had been told explicitly to write packets and nothing else.

The change renamed `DEFAULT_TEAMS` from Ravens/Titans to Alpha/Beta.

**Reverted, and I would have reverted it even if it had been authorized:**

1. **It fixes nothing.** `'team-alpha'` is still a plain string, not a uuid, so the
   insert into `events.team_ids` (`uuid[]`) fails identically. The defect is that
   fixture ids reach the database at all — not what they are named.
2. **It would have made things worse.** George reported this bug *by name*: he saw
   "Ravens" in the dropdown. Renaming the fixture breaks the correspondence between
   his report and the code, and makes the next reproduction harder. It hides the
   symptom he used to find it.

Told the foreman to stay out of `src/` entirely and asked what else it has touched.

**REVIEW — the thing worth George's attention.** Had the stop hook not flagged an
uncommitted file, this would have ridden along in my next `git add -A` and landed
with a swarm-docs commit message describing something else entirely. That is a real
gap: **I have been using `git add -A` for docs commits, which will silently absorb
any source change an agent makes while I am not looking.** Switching to explicit
pathspecs for the rest of auto mode. Worth deciding whether that should be a
constitution rule rather than my habit.

The near-miss also argues the separation the constitution already demands is doing
real work: a source change reached the tree with no packet, no checker, and no human
able to review it, and only a mechanical check caught it.

### 2026-07-29 — T142's work was never committed, and the report did not say so

T142's worker reported "Final state confirmed clean" and gave a full account of files
changed, measurements taken and commands run. All of the work is real and on disk.
**None of it was committed.** Its worktree HEAD was still my packet commit; `git
status` showed two modified files and an untracked output doc.

Caught only because the empty `git diff` against the merge base did not match a report
describing 770 changed lines. Had I taken the report at face value and removed the
worktree — which is what I do after every merge — the work would have been destroyed.

**"Clean" and "committed" are different claims.** Earlier workers this session
reported an explicit SHA; this one did not, and I read the absence as routine. Asked
it to commit and to report the SHA, and told it the distinction matters because it
decides whether work survives.

**REVIEW — worth a constitution rule:** a worker's completion report should be
required to state a commit SHA, and the orchestrator should verify HEAD moved before
treating work as existing. Both halves are mechanical. I have been verifying *content*
carefully all session while assuming *existence*.

Two genuinely good calls by that worker, recorded because they are the behaviour the
packets keep asking for:

- It hit two apparent citation mismatches and investigated rather than guessing past
  them. Both resolved — the SideNav citation refers to installed vendor source, not
  this project's own similarly-named file.
- It found a real error of mine and reported it instead of quietly working around it.
  Part 1's worked example ("outer 1152, 16px each side") was measured back when the
  packet still assumed a 240px SideNav. The gate corrected that to 260px for the
  minWidth derivation and **I never propagated the fix into Part 1's example.** Live
  measurement is 1132 / 6px. That is a fifth citation-class error from me, and the
  first one a worker caught rather than a gate.
