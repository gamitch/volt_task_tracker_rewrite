# Resume point — T196, written 2026-08-04 before a usage-window pause

**Read this first if context was cleared.** Everything else is on disk; nothing important lives only
in a conversation.

## State

**Branch `claude/t196-endmeeting-mount`, HEAD `177798c`, pushed. Working tree clean. `main` =
`aabc7f1`.** Nothing is uncommitted or unpushed anywhere.

**T196 has NOT been implemented.** No worker has run. What exists is the packet and the rulings.

| Artifact | Where |
|---|---|
| Packet **v2** (post gate round 1) | `docs/swarm/active/T196-worker-packet.md` |
| Owner rulings (3, dated 2026-08-04) | `auto-mode-decisions.md`, bottom |
| Scoped grant | `WORKFLOWS.md` W3 section |

## What was in flight when the window closed

**A `checker-premise` round-2 gate was dispatched against packet v2 and may not have returned.**

- **If its verdict is unknown, RE-RUN IT.** Do not assume DISPATCH. Round 1 returned REVISE with 3
  BLOCKERs, all of which were the orchestrator's own false claims about code it had not run.
- **⚠️ Item 19a: round 2 is the LAST round.** If it returns REVISE, **park T196 for the owner** —
  do not gate a third time, do not override. Write the findings into the T196 ledger row and stop.
- If it returns **DISPATCH**: dispatch `worker-implementer` (sonnet — item 18's opus triggers do not
  apply: no migration, no RLS, no metric SQL, no auth logic), then `checker-reviewer`.

## The three owner rulings, in one line each

1. **Post-completion, only the console's own roster + check-in panel render.** No dialog correction
   list. Rendering it put the same student on screen twice with contradictory statuses.
2. **Keep the "This meeting has ended" banner, with corrected copy.** Its current text claims
   *"corrections are recorded automatically"* — **false since 2026-08-03**, when the audit trigger
   was removed by owner ruling. Drop that clause.
3. **Test updates authorized**, scoped to `LiveConsole.test.tsx:845` and `:864` only, plus a grant
   extension to `LiveConsoleBodyProps` for the injectable seams.

## One check that can still sink this

The packet's design rests on **the console's roster staying editable after the session completes**.
The gate was asked to verify it. **If the roster goes read-only post-completion, ruling 1's rationale
collapses and the shape needs to change** — that is a BLOCKER and an owner question, not something to
work around.

## After T196, in order

1. **T164** — the one *confirmed* test gap (255 lines of `kpi.ts`, zero runtime tests, premise
   verified twice). Safe unattended.
2. **T163** — measure before packeting. Genuinely unknown; do not assume phantom or 729 untested lines.
3. **T321** (W1) — `WORKFLOWS.md` calls it the best effort-to-impact ratio in the backlog.
4. **T400** — the live-session picker, un-sequenced from T196's wave by owner ruling.
5. **T600** — two TypeScript copies of the MET-01 formula, nothing asserts they agree. Needs an
   ownership call (crosses into W1's `checkin.ts`).

**Worth doing regardless:** grep for other stale copy left by the audit-trigger removal. The banner
string above was found by accident while reading a render tree; there may be more.

## Standing posture for unmonitored work

Decide alone: packet revisions after gate findings, dispatching workers/checkers, mechanical
MINOR/NIT fixes (disclosed as unreviewed), committing and pushing.

**Defer to the owner — park it and move on:** anything touching migrations, RLS, `security definer`,
metric SQL or auth; any third gate REVISE; any product decision where two readings give materially
different UI; **opening or merging any PR**.

Log every decision made alone in `auto-mode-decisions.md` under a **"T196 auto-mode window"**
heading, marked as the orchestrator's and reversible, **never attributed to the owner**.

## The lesson this session kept paying for

Five times, a claim inherited from a ledger row or asserted without running the code turned out
false — T403's criterion, T404's premise, T162's "0 tests", T161's retraction, and three separate
BLOCKERs in T196's own packet v1. **Verify the row, not just your own citations. Build the
prescription before writing it down.**
