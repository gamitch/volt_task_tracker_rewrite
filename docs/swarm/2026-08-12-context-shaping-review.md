# Process review — "progressive context shaping" against this repo's practice

**Status: PROPOSAL. Nothing here is binding and nothing here has been
implemented.** The owner accepts, rejects or defers each item. If an item is
accepted it lands in `constitution.md` or `AGENTS.md`; if it is rejected this
file becomes history and should be marked so at the top rather than left to be
read as guidance.

Source: <https://youtu.be/HZLPhPbw3fM> — argues that long agent runs fail not
from small context windows but from stale context holding authority, and
proposes separating four layers: **stable instruction**, **current state**,
**map** (what exists and where), and **history**. Its examples are OpenAI's
internal million-line build, Anthropic's progress-file harness, and Arize's
Alex agent, which burned 27 model calls reorganising its own to-do list until
the plan was moved out of the transcript and rebuilt in front of it each turn.

Everything below was measured against the repository on 2026-08-12 at
`7e56c7c`, not inferred from the video.

---

## 1. Verdict first: this repo is ahead of the video on most of it

The video is aimed at someone with one long conversation and no records. This
project already has the separation it recommends, and in three places exceeds
it. Recording that matters, because the temptation after watching a video like
this is to add a layer that already exists under a different name.

| Video's practice | This repo | Status |
|---|---|---|
| Stable instruction layer | `AGENTS.md` (284 lines), `constitution.md` (769 lines, 30 items), `.claude/agents/*.md`, 8 skills | present |
| Current state that outranks the transcript | Linear `Todo`/`In Progress`, binding under item 28 | present — this *is* the Symphony ticket board the video ends on |
| Per-run progress file | `docs/swarm/active/GAM-nnn-run-log.md`, appended and pushed at each milestone | present, **but unmandated** — see 2.1 |
| Structured handoff between sessions | run log + the crash line: *"If this line is the last one in this file, the run died after gates passed but before the PR was opened"* | **exceeds the video** |
| Failed approaches kept with their reason | `dispute-log.md`, `AGENTS.md`'s "Two walls a dispatched run hits" | present |
| History kept but demoted | `verification-log.md` (831 KB), `task-ledger.md` (725 KB, frozen under item 29) | present |
| Declaring what would make you wrong | item 19d — HEAVY packets end with 3-5 least-confident decisions, and the premise checker attacks that list first | **exceeds the video** |
| Recurring job that refreshes the map | `linear-export.yml`, daily 06:00 UTC | partial — refreshes the *data* mirror, never the *docs* |
| The map layer itself | — | **missing** |
| Retiring a document when it stops being current | — | **missing** |

The video's own headline advice — be bolder, put six-hour runs in motion — is
the one part this project should decline. Item 26's tiers, the two-round
premise-gate cap and the three-attempt worker cap answer the drift problem more
directly than progressive context shaping does: a run that cannot exceed its
bounds cannot spend six hours going the wrong way. Keep the tiers.

---

## 2. Four proposals

Ordered by value per unit of change. Each is small, and none touches the tier
system, the gate caps or the dispatch rules.

### 2.1 Write the run log into the constitution, and give it a state block

**Change.** A new constitution item making
`docs/swarm/active/<ISSUE>-run-log.md` mandatory for every tier above FAST, and
a short `docs/swarm/active/TEMPLATE-run-log.md` alongside the two existing
`EXAMPLE-*-packet.md` files.

**Why.** The run log is the best thing in this process and it is currently an
unwritten convention. It is specified in exactly one place — a dated session
report, `2026-08-10-heavy-task-lessons.md:86-92` — and nowhere in
`constitution.md`, `AGENTS.md` or any agent role body. That report also
measured its value on the same bug occurring twice: without the log, no work
pushed and no record, hand-salvaged from an artifact; with it, a worker commit
of 4 files and 8 run-log commits, *"already in git"*.

The drift is already visible. Of the five most recent run logs, four carry the
crash-recovery line and `GAM-335` does not. Headers vary — `GAM-332` opens with
`Title:` and a tier line, `GAM-318` with `Issue:` and a URL, `GAM-302` with the
crash line and no header at all. Sizes run 3.1 KB to 42 KB. Nothing is wrong
with any of them; there is simply no shared shape, so each run reinvents one and
each reinvention loses a piece.

**The state block is the part actually borrowed from the video.** The run log is
append-only, which makes it a transcript — and `GAM-325`'s is 31 KB, `GAM-315`'s
42 KB. An agent resuming a dead run reads the whole thing to find out where it
is. Arize's fix was to keep the plan *outside* the transcript and rebuild it in
front of the history on every call. The cheap equivalent here is four lines at
the top of the run log, **overwritten rather than appended** at each milestone:

```
## Current state (overwrite this block; the log below is append-only)
- Phase: <claimed | premise gate r1 | worker dispatched | gates | PR open>
- Branch / SHA: <branch> @ <sha>
- Next action: <the one thing a resuming session should do>
- Blocked on: <nothing | subagent in flight | owner ruling on X>
```

A resuming session reads sixteen lines instead of 31 KB, and the append-only
history underneath is untouched. This directly serves the wall recorded in
`AGENTS.md:71-79` — five runs died with a subagent in flight — because "Blocked
on: subagent in flight" is exactly the state a resuming session needs and
currently has to reconstruct.

**Cost.** ~25 lines of constitution, ~20-line template, four lines per
milestone during a run. **Risk.** The state block goes stale within its own
run if a milestone skips it, which would be worse than not having it — so the
item should require that it be overwritten *in the same commit* as each
milestone append, mirroring item 24's join of recording and merging.

### 2.2 Add the map layer — `docs/swarm/MAP.md`

**Change.** One screen listing every document under `docs/swarm/`, each with a
one-line description and a status word: **CURRENT**, **HISTORICAL**, **FROZEN**
or **GENERATED**. `AGENTS.md` gains one line pointing at it.

**Why.** This is the layer the video says everyone skips, and it is the one this
repo genuinely lacks. `docs/swarm/` holds 36 markdown files at its root plus 160
in `active/`. `AGENTS.md` names eight of the 36 — and three of those eight
(`RESUME-HERE.md`, `state-summary.md`, `dispute-log.md`) are named only to tell
you not to read them. That leaves five live pointers into a 196-file corpus.
Everything else is found by guessing at filenames.

The status word is where the value is, not the description. `AGENTS.md:102-108`
records the failure this prevents: an agent told to pick up the next ready task
spent nine commands reading `RESUME-HERE.md`, `state-summary.md` and the
migration docs before reaching the issue, and *"`state-summary.md` is known
stale and this file said so, and the agent read it anyway, because the path led
there."* A per-document status word catches that at the index, one hop earlier
than a warning buried inside the document does.

**Cost.** ~60 lines, written once. **Risk.** A map is itself a document that
can go stale — which is precisely why it should carry nothing but a path, a
sentence and a status word. Anything that needs updating when the *content*
changes does not belong in it.

### 2.3 Retire the three superseded orientation documents by moving them

**Change.** Move `RESUME-HERE.md` (1,337 lines) and `state-summary.md` (643
lines) to `docs/swarm/history/`, leaving a three-line tombstone at each old path
naming what replaced it. Split `SWARM-QUICKSTART.md` into the part its own
currency note vouches for and the part it disclaims.

**Why.** All three already carry self-warnings. `state-summary.md:3-7` opens by
saying its own task counts are stale and reconciliation was never attempted.
`RESUME-HERE.md:3-6` warns that its pin rots on every merge, then stacks dated
UPDATE sections that supersede each other, one of which contains a boxed
correction of a claim that *"is FALSE and it propagated"*.
`SWARM-QUICKSTART.md:3-9` states that everything outside four named sections
predates the Linear migration — and the body still instructs a new session to
run `/swarm-run T001` and create `state-summary.md`, both retired.

`AGENTS.md` has already demoted all three in prose. The measured incident above
is an agent reading one anyway. Prose demotion has been tried; moving the file
is the version that works, and git keeps every word. This is the video's
"helpful forgetting" — the evidence survives, its authority does not.

**Cost.** Two `git mv`s, two tombstones, one section split. **Risk.** Something
still cites a moved path. Mitigation: grep before moving, and tombstones make a
stale citation land somewhere that explains itself rather than 404.

### 2.4 Sweep `active/` at merge, as part of item 24

**Change.** One clause added to item 24, which already binds recording and
merging into a single action: when the PR merges, that issue's packet and run
log move from `active/` to `archive/` in the same commit.

**Why.** `active/` holds 160 files, of which 132 carry the retired `Tnnn` prefix
and belong to the pre-Linear era frozen under item 29 — 82% history, filed under
"active". `archive/` already holds 220 files, so the destination and the habit
both exist; what is missing is any rule saying when a file crosses over.
Neither `constitution.md` nor `AGENTS.md` contains the word "archive".

Item 24's own rationale applies unchanged: *"Splitting merge from record means
the second step is always optional under time pressure, and it is always the one
dropped."* A separate tidy-up task would be dropped the same way. Attached to
the merge commit, the directory maintains itself from that day forward.

**Cost.** One clause, one `git mv` per merge. A one-time bulk move of the 132
`Tnnn` files is optional and independent — it can wait, or never happen, without
affecting the rule. **Risk.** A file is archived while a follow-up still needs
it. Low: `archive/` is a sibling directory, not a deletion, and the map (2.2)
would carry the pointer.

---

## 3. One habit worth adopting that costs nothing

The video's actual thesis is not the file layout — it is that **a correction
should reach the work that has not happened yet**, not just the draft in front
of you. This project does that well for defects: item 20 turns every deliberate
deferral into a filed issue rather than a code comment.

It does not do it for *process* corrections. `GAM-318` is the clean example. The
run declared a real tier deviation — STANDARD conduct run as FAST — put three
options to the owner, and recorded the ruling. Exemplary honesty, and the ruling
now lives in `GAM-318-run-log.md:12,15`, a file no future run will ever open. If
that deviation reflects something item 26 gets wrong about deletions that carry
a new test, nothing routes it to item 26.

**Proposed close-out line, no new artifact:** *if this run changed how the next
run should behave, name where that change lands — a constitution item, an
`AGENTS.md` section, a skill, the packet template — or state explicitly that it
lands nowhere.* "Nowhere" is a perfectly good answer and most runs will give it.
The value is that the question gets asked once per run instead of never.

---

## 4. What not to take from the video

- **No project-level `current.md`.** Linear is that file, and item 28 makes it
  authoritative. A markdown current-state file would be a fourth claimant to
  "what is true today" alongside Linear, `WORKFLOWS.md`'s summary table and
  whatever `RESUME-HERE.md` is currently asserting — which is the exact failure
  the migration spent effort escaping. The video's `current.md` is advice for
  people with no ticket board.
- **No `decisions.md`.** The constitution *is* the decision log — every item
  carries its ruling, its date, its authorising quote and the measurement that
  produced it. `dispute-log.md` holds the contested ones. A third would
  fragment, not consolidate.
- **No four-file starter kit, no restructure.** Item 25's proportionality
  applies to process as much as to security findings. Two of the four layers
  already exist here in stronger form.
- **Treat the video's numbers as anecdote.** The 500% PR figure, "a tenth of
  the time", "not a line typed by humans" — none is independently sourced, and
  this project's own standard is that a recorded figure is historical evidence
  rather than proof (`AGENTS.md:127-129`). The mechanisms are worth borrowing;
  the metrics are not worth quoting.

---

## 5. Suggested order

1. **2.1 run log + state block** — highest value, protects the failure mode
   that has actually killed runs here five times.
2. **2.4 archive-on-merge** — one clause, self-maintaining, no backfill needed.
3. **2.2 MAP.md** — write it after 2.4, so the map describes a directory that
   has stopped growing.
4. **2.3 retire the three documents** — do this last; it is the only item that
   moves paths other work might cite.
5. **§3 close-out line** — free, adopt whenever.

Deliberately excluded: a staleness-sweep CI job. `linear-export.yml` proves the
daily-cron pattern works here, and a job flagging `active/` files whose issue is
closed would be unambiguous — but after 2.4 there is nothing left for it to
find, and a doc-freshness linter that fires on age rather than on contradiction
produces noise the owner has to triage. Revisit only if 2.4 proves
insufficient.

---

## 6. Least confident decisions (item 19d applied to this proposal)

1. **That the run-log state block will be maintained.** It is the one item
   asking for work *during* a run rather than at its boundaries, and an
   unmaintained state block is worse than none — it lies with authority. What
   would make this wrong: two consecutive runs whose state block disagrees with
   the appended log at the same commit. Kill it if that happens; keep the rest
   of 2.1 either way.
2. **That `MAP.md` earns its keep.** It could become a ninth document nobody
   reads. What would make this wrong: a session that reads `MAP.md` and then
   greps for the file anyway. The status word is the load-bearing part; if it
   is dropped in favour of longer descriptions, the map has become a document
   and should be deleted.
3. **That moving `RESUME-HERE.md` is safe.** It is 1,337 lines and the dated
   UPDATE sections may hold operative rulings never migrated anywhere else. I
   read the first 45 lines, not all of it. What would make this wrong: a ruling
   in the middle of that file that no constitution item covers. **A read-through
   for unmigrated rulings should precede the move** — that check is not
   optional, and it is the reason 2.3 is ordered last.
4. **That the video's tier advice is wrong for this project.** I am confident
   bounded runs beat long ones *here*, given the two walls in `AGENTS.md:50-79`.
   What would make this wrong: evidence that the gate caps are themselves
   causing the abandonment they exist to prevent. Nothing in the eleven current
   run logs suggests that, but eleven runs is a small sample.
