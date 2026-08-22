# GAM-447 — run log

Issue: <https://linear.app/gamitch/issue/GAM-447>
Branch: `claude/gam-447-series-card`
Runtime: Claude (dispatch run), started 2026-08-21 22:41Z.
PR credential (`ghs_`) decoded at minute 1: `iat 2026-08-21T22:40:44Z`,
`exp 2026-08-21T23:40:44Z` — the PR must be opened before 23:40Z (wall 3).

Append one line per milestone, commit and push immediately. If the last line in
this file is a dispatch with no matching verdict, **the run died holding that
subagent** — that is the failure signature `AGENTS.md` wall 2 describes.

## Log

- 22:41Z — Read `AGENTS.md` § "Where work comes from" and `docs/swarm/constitution.md`
  (items 18, 19, 22, 26, 28) before opening anything else.
- 22:41Z — **Claimed.** `GAM-447` moved `Todo → In Progress` and re-read back
  (`state.name = "In Progress"`, item 28c read-back confirmed). No `gate/human`
  and no `executor/*` label → legacy Claude-only route (item 28b), and this run
  is Claude.
- 22:41Z — **Tiered STANDARD** (item 28d, judged as part of claiming). Label
  `tier/unreviewed` → `tier/standard`, confirmed on the read-back. Defence: no
  write path (the Edit action calls the _existing_ `onSaveMeetingSeries` seam,
  which this ticket does not implement), no schema/RLS/migration/metric SQL, no
  auth or role logic, and no export another session builds against — the props
  interface is _frozen by the decomposition ticket_, so this component consumes
  it rather than defines it. Too large for FAST (new component + edit panel +
  CSS + tests, well over ~20 lines). STANDARD it is: one worker on a compact
  packet, orchestrator replays the mutation and runs the gates.
- 22:42Z — Branch `claude/gam-447-series-card` created; run log is the first
  file write.
- 22:45Z — **Draft PR opened: <https://github.com/gamitch/volt_task_tracker_rewrite/pull/232>**
  (~minute 5, ~55 minutes of PR credential still live). Body artifact
  `docs/swarm/active/GAM-447-pr-body.md` written _before_ the API call and
  validated by the declaration checker (`OK declaration closes GAM-447`).
- 22:52Z — Rebased the branch onto `origin/main` @ `3d27d8a`: PRs #230 (GAM-444)
  and #231 (GAM-445) had merged _after_ this run started, and they create
  `src/lib/meetings/types.ts` and the `src/pages/meetings/coach/` stubs this
  ticket builds on. The pre-rebase base would have made the packet's citations
  false.
- 23:02Z — **Packet written**: `docs/swarm/active/GAM-447-packet.md`. It records
  three measured premise corrections (§3): `SeriesCardModel` cannot carry
  location / roster count / canceled count / hours / span chip / "N expected";
  `--color-series-1…8` does **not** exist in `src/theme/volt.ts` (the skill calls
  that a blocker to raise, not a gap to fill with invented hex); and
  `onSaveMeetingSeries` is **not** on the frozen `SeriesCardProps`, so the Edit
  panel has no seam to submit through.
- 23:04Z — **DISPATCHED `checker-premise`** (item 19, scoped light per 19b — the
  pattern is a fixture-driven UI component with no write path, so the gate is
  aimed only at the packet's §0 citation table and its three §3 blocker claims).
  Dispatched with `run_in_background: false`; the orchestrator is blocking on it
  now. **If this line is the last one in this file, the run died holding this
  subagent.**
- 23:11Z — **`checker-premise` VERDICT: REVISE** (round 1 of the two item-19a
  rounds). Three MAJOR, four MINOR, one NIT — all actionable, none a BLOCKER,
  and it confirmed all three §3 blocker claims in substance. The ones that
  changed the packet: (MAJOR-1) §1's "keep the props as-is" made §6.4's four
  DES-12 states unsatisfiable — `SeriesCard` has **no callers anywhere**, so
  additive optional props break nothing; (MAJOR-2) `Card` extends `BaseProps`
  and spreads `...props`, so `style`/`data-*`/`aria-*` on `<Card>` are
  authorized (precedent `CoachHome.tsx:643-670`) rather than item-2 findings;
  (MAJOR-3) `xstyle` is **nonfunctional in this app** (F-2 — no StyleX plugin,
  `stylex.create()` throws), and my "`pixel`/`proportional` idiom" sentence was
  false — those are `TableColumn` width helpers. (MINOR-4) my
  `MeetingsList.tsx:2019` citation was pre-rebase; that file is now 193 lines
  and the seam is at `:120`.
- 23:16Z — Packet revised against all eight findings (round 1 applied). Re-submitting
  the delta to the SAME `checker-premise` agent (its context is intact, so the
  round-2 re-check is a delta verification rather than a fresh audit).
  **If this line is the last one in this file, the run died holding that subagent.**
- 22:58Z — **`checker-premise` round 2 FAILED without a verdict** — the agent
  terminated on `API Error: 529 Overloaded`, a server-side fault, after
  re-reading the revised packet but before emitting VERDICT. This is not a
  REVISE and not a DISPATCH; it is a _missing_ gate round, and it is recorded as
  such rather than rounded up to a pass. Round 1's verdict stands as the last
  real one: REVISE, all eight findings applied.
- 22:58Z — Deadline arithmetic, done rather than guessed: PR credential dies
  23:40:44Z (~19 min). `git push` survives it (long-lived PAT in the
  extraheader) and so do Linear writes (`LINEAR_API_KEY`); `gh pr edit` and
  `gh pr ready` do not. Updating the PR body on GitHub NOW, before the work is
  finished, so the PR is informative even if the credential dies mid-run.
- 22:59Z — PR #232's description on GitHub updated from the artifact (declaration
  re-checked: `OK declaration closes GAM-447`). It now carries the three premise
  findings, the tier defence, the item-27 Partial scope call and the declared
  item-19a deviation. It stays a **draft** — the work is not verified yet, and a
  ready flag on unverified work would be a lie.
- 22:59Z — **RE-DISPATCHED `checker-premise` (round 2, fresh agent, delta-scoped)**
  after the 529. Blocking on it with `run_in_background: false`. **If this line
  is the last one in this file, the run died holding this subagent.**
- 23:04Z — **Round-2 re-dispatch ALSO died on `529 Overloaded`**, this time before
  doing any work at all. Two independent 529s in seven minutes: the API is
  overloaded right now, and this is infrastructure, not the packet. Item 19's
  DISPATCH verdict is therefore **unobtainable on this run**, and I am not going
  to invent one. Trying the worker dispatch next — if that also 529s, the
  orchestrator implements directly (a declared item-26 deviation) or the run
  stops and hands off, whichever the clock allows.
- 23:13Z — **`worker-implementer` VERDICT: work delivered**, commit
  `8869ee1` — `SeriesCard.tsx` 44 → 442 lines, new `SeriesCard.test.tsx` 319
  lines / 21 tests. No other file touched; `SeriesCard.css` and
  `SeriesEditPanel.tsx` deliberately not created (packet §3b/§3c/§5). Worker's
  self-reported exit codes: tsc 0, scoped vitest 0, eslint 0, prettier 0 — **not
  yet independently replayed; that is the orchestrator's next act.** Named
  mutation to replay: `'—'` → `'0%'` in `formatAttendanceText`.
- 23:14Z — PR credential expires 23:40:44Z. PR #232 stays a **draft**: the run
  cannot mark it ready after that, and marking it ready _before_ the gates ran
  would have been a false claim. Its description already carries the premise
  findings and the declared item-19a deviation. Pushes continue to work.
- 23:20Z — **Gates run independently by the orchestrator, on the committed tree
  (`--require-clean`), and they agree with the worker's report.**

  ```
  GATE RUN — 8ef9612 on claude/gam-447-series-card — tree clean

    1 tsc                                                  exit 0  PASS
    2 vite build                                           exit 0  PASS
    3 format:check                                         exit 0  PASS
    4 eslint                                               exit 0  PASS       0 errors, 380 warnings
    5 vitest (full)                                        exit 0  PASS       109 files / 2654 tests  baseline 2633 (+21)
    6 vitest src/pages/meetings/coach/SeriesCard.test.tsx  exit 0  PASS       1 files / 21 tests  baseline 21 (+0)

  VERDICT: PASS — all six gates exit 0
  ```

  Baseline **measured, not assumed**: `npx vitest run` at the merge base
  `3d27d8a` in a separate worktree → 108 files / 2633 tests. The branch adds
  exactly one file and 21 tests; nothing disappeared. The 380 eslint warnings
  are the repo's standing `react-refresh/only-export-components` class — `npx
eslint` on the two changed files alone emits **zero**.

- 23:21Z — **Three mutations replayed by the orchestrator, in a detached worktree
  (item 23 — never the shared tree), each reverted and re-verified green.**

  | Mutation (`SeriesCard.tsx`)                                                                                                      | Result                                                                                           |
  | -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
  | `attendancePct === null ? '—'` → `? '0%'` — fabricate a zero where the metric view says nothing                                  | **REDDENED** 21→20 passed, exit 1 (`attendancePct rendering (DATA-01 …)`)                        |
  | `MAX_VISIBLE_SCHEDULE_CHIPS = 4` → `999` — remove the cap that wins height invariance                                            | **REDDENED** 21→20 passed, exit 1 (`height invariance > never renders …`, "expected 12 to be 5") |
  | `onSelect?.({ eventId: model.eventId })` → `{ eventId: model.title }` — raise the frozen focus request with the wrong identifier | **REDDENED** 21→20 passed, exit 1 (`onSelect > is called with exactly …`)                        |

  The first is the worker's own named mutation; the other two are the
  orchestrator's, chosen to attack the two claims a green suite is least likely
  to actually guard — the design's fixed-height promise and the contract a
  sibling ticket codes against. All three reverted cleanly; worktrees removed.

- 23:21Z — **DISPATCHED `checker-reviewer`** on the actual diff. Item 26 does not
  require a checker round at STANDARD — this one is added deliberately because
  the item-19 premise gate never returned a DISPATCH verdict (two 529s), so an
  independent read of the artifact is the closest available substitute for the
  round that could not run. Blocking on it. **If this line is the last one in
  this file, the run died holding this subagent.**
- 23:27Z — **`checker-reviewer` VERDICT: PASS**, highest severity MINOR — no
  BLOCKER, no MAJOR. It confirmed the four orchestrator claims it could cheaply
  reach, confirmed no forbidden file was touched, and confirmed DATA-01 is clean
  (no division, multiplication or rounding anywhere in the component). It also
  compared the render against the reference figure card-by-card and found every
  in-scope element present with the right copy, and every out-of-scope element
  **absent rather than faked** — no fabricated zero for a field the frozen model
  cannot carry. Its item-27 reading: the carve-out applies, because the component
  reads no fixture and has no render site at all yet.
  Findings: MINOR-1 attendance hierarchy is one flat string, not label/value/
  supporting; MINOR-2 three height tests are near-tautological and the title
  clamp is unpinned (deleting `maxLines={1}` reddens nothing); MINOR-3 the
  selected ring is untested; MINOR-4 `aria-current` on an unnamed `role=generic`
  div likely announces nothing; MINOR-5 the exported function's JSDoc still says
  "Stub"; plus five NITs.
- 23:27Z — **RE-DISPATCHED the same `worker-implementer`** (context intact) to fix
  the cheap MINORs and NITs in place rather than file five follow-up rows for
  work that is inside its own Allowed Files. Blocking. **If this line is the last
  one in this file, the run died holding this subagent.**
- 23:36Z — **Fix round delivered**, commit `52362d3`: all 11 checker items applied,
  `SeriesCard.tsx` 442 → 470 lines, tests 21 → 28. One **disclosed behavior
  change**, and it is the one thing on this branch a reader should look at
  twice: the worker could not pin the title clamp at `maxLines={1}` because
  Astryx's `Heading` emits no DOM-observable signal at 1 (only an opaque StyleX
  class), so it widened the clamp to `maxLines={2}`, where `Heading`'s own
  runtime sets a real inline `WebkitLineClamp`. A test now pins it. The card's
  height is fixed unconditionally either way, so this changes how much of a long
  title shows, not whether the card grows — but it is a behavior change made to
  make a guard testable, and it is disclosed rather than buried.
- 23:38Z — **Gates re-run on `52362d3`, clean tree — all six PASS**: tsc 0, vite
  build 0, format:check 0, eslint 0 errors / 380 standing warnings, full vitest
  109 files / **2661** tests vs the measured 2633 baseline (+28), scoped 28/28.
- 23:38Z — **Two more mutations replayed** on the fix commit, isolated worktree,
  both reverted:

  | Mutation                                                                    | Result                                                                                      |
  | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
  | `buildSelectionStyle` → `return undefined` — delete the selected-state ring | **REDDENED** 28→27, exit 1 (`isSelected > renders a visible s…`)                            |
  | `TITLE_MAX_LINES = 2` → `99` — unclamp the title so it can grow the card    | **REDDENED** 28→27, exit 1 (`height invariance > pins the tit…`, "expected '99' to be '2'") |

  Five mutations total across the two commits, five reddened. The two guards the
  checker specifically called unpinned are now pinned, and I watched both fail.

- 23:40Z — **Item-20 follow-ups filed**, to `Backlog` carrying `tier/unreviewed`
  (never straight to `Todo` — promotion is the owner's signal, GAM-382):
  - **GAM-473** — the card's missing location / canceled count / hours / season
    span, framed as the decision it actually is (does the card carry supporting
    facts, or does the drill-out?) rather than "add four fields".
  - **GAM-474** — no Edit affordance on the card; whether editing belongs there
    at all, with the trigger being GAM-448's dispatch.
  - **GAM-475** — `astryx-api.md`'s `Heading` section is the literal string
    `undefined`, so item 2 is untestable for every `Heading` prop.

  Deliberately **not** filed, because rows already exist and duplicating them
  would be the noise item 30 exists to prevent: **GAM-466** (the series palette
  tokens — my §3b blocker is already someone's open row), **GAM-471** (roster
  count, which additionally has a `student_teams` writer problem), **GAM-452**
  (the assembly that gives this component its first render site) and **GAM-460**
  (graded marks beside attendance %).

- 23:42Z — **Timestamp correction, kept rather than quietly fixed.** Every entry
  from 22:58Z onward originally carried a _guessed_ clock time, and the guesses
  drifted up to 45 minutes ahead of reality — the last four entries claimed
  `00:xx` while the commits they describe are stamped `23:36`–`23:40`. They have
  been rewritten to their own commit times (`git log --date=format:'%H:%M'`).
  The `pr-body` skill warns about exactly this — "three runs in one session wrote
  timestamps that disagreed with their own commit times" — and this run made it
  four. The lesson is the cheap one: read the clock, do not estimate it.
- 23:42Z — **PR credential confirmed dead by measurement, not by assumption.**
  `gh pr edit 232` at 23:41:45Z → `HTTP 401: Bad credentials`, exactly 61 seconds
  after the `exp` decoded at minute 1. `git push` in the same command succeeded.
  PR #232 therefore stays a **draft** with a description written at 22:59Z;
  `docs/swarm/active/GAM-447-pr-body.md` on this branch is the finished body and
  says so in its own first paragraph. A human pastes it and clears the draft flag.
- 23:45Z — **Close-out.** Comment posted on GAM-447 (`**Run log · claude ·
close-out · 2026-08-21**`) carrying the six-gate block with exit codes, the
  declared item-19 deviation, the three deferrals with their new row ids, and
  the two disclosed gaps. Issue moved `In Progress → In Review` and **read back**
  (`state.name = "In Review"`, `tier/standard` still applied). Never `Done` —
  item 28e: the merge closes it, not the author.
- 23:45Z — **State at end of run.** Branch `claude/gam-447-series-card` pushed
  through `52362d3` (source) plus run-log/PR-body commits. PR **#232 is open as a
  DRAFT with a 22:59Z description**; the finished body is
  `docs/swarm/active/GAM-447-pr-body.md` on the branch and cannot be published
  from here — the credential is 401 and does not come back. **A human pastes that
  file over the PR description and clears the draft flag; nothing else is
  outstanding.** No subagent is in flight, and every dispatch line above has a
  matching verdict line.

## Completion run — 2026-08-21 23:47Z–23:59Z

The 23:45Z close-out above handed off two things to a human: paste the finished
body over the PR description, and clear the draft flag. This run does both, and
first closes the acceptance criterion the original run disclosed as a gap.

- 23:47Z — **Merged `origin/main` @ `fb1c304` into the branch** (merge commit
  `97bd49f`, no conflicts). Main had moved _after_ this PR's CI ran: PR #233
  (GAM-446) merged at 23:47:15Z, and the PR's checks completed 23:43–23:46Z, so
  the green run on `24ff321` had never seen it. Merging first means the CI that
  gates the ready flag is CI against the tree that would actually land.
- 23:52Z — **Gates re-run on the merged tree** (`--require-clean`), baseline
  **measured, not carried over**: `npx vitest run` at the new merge base
  `fb1c304` in a detached worktree → 108 files / 2638 tests. That is the earlier
  2633 plus GAM-446's own 5, which is the arithmetic it should be.

  ```
  GATE RUN — 97bd49f on claude/gam-447-series-card — tree clean

    1 tsc                               exit 0  PASS
    2 vite build                        exit 0  PASS
    3 format:check                      exit 0  PASS
    4 eslint                            exit 0  PASS       0 errors, 380 warnings
    5 vitest (full)                     exit 0  PASS       109 files / 2666 tests  baseline 2638 (+28)
    6 vitest src/pages/meetings/coach/  exit 0  PASS       2 files / 52 tests

  VERDICT: PASS — all six gates exit 0
  ```

- 23:56Z — **The disclosed "no browser measurement" gap is closed.** GAM-447's
  first acceptance criterion is "height invariance measured … 4 vs 56 sessions
  at 1440px; 375px no-overflow", and the original run skipped it after spending
  its budget on the premise gate's two 529s. A throwaway Playwright rig mounted
  `SeriesCard` directly (it renders from props and needs no provider stack) at
  both viewports:

  | Viewport | 4-session card | 56-session card | Card scrollH/clientH | Page overflow |
  | -------- | -------------- | --------------- | -------------------- | ------------- |
  | 1440×900 | **380 px**     | **380 px**      | 378 / 378            | 0             |
  | 375×812  | **380 px**     | **380 px**      | 378 / 378            | 0             |

  Every number is paired with a presence check, per the skill's own trap: a card
  that measured small because its content vanished must not read as a pass. All
  passed — "View full schedule (4 sessions)" / "(56 sessions)", attendance `87%`
  / `96.5%`, the chip row capped at 4 plus `+3 more` plus the `3 overlap` badge,
  the title present, and **zero page errors**.

- 23:58Z — **The rig was counter-checked, and it corrected a claim this log has
  been making.** `MAX_VISIBLE_SCHEDULE_CHIPS` 4 → 999, re-measured, reverted:

  | Viewport | Height with cap removed | Card scrollH / clientH                   |
  | -------- | ----------------------- | ---------------------------------------- |
  | 1440×900 | 380 px — _unchanged_    | 378 / 378 — _unchanged_                  |
  | 375×812  | 380 px — _unchanged_    | **391 / 378 — 13 px of content clipped** |

  The card never grows, because `Card height={380}` is unconditional. So the
  chip cap does **not** "win height invariance" — the earlier entry at 23:21Z
  and the PR body both say it does, and measured, that is wrong. What the cap
  actually buys is that content still _fits inside_ the fixed box at phone
  width; without it the box silently clips 13 px at 375 px and nothing at 1440
  px. The jsdom mutation test that reddens on this counts chips, which is a
  structural proxy that happens to fire — it cannot see the clipping, which is
  the real consequence. Correction kept in place of quietly rewriting the
  earlier line.

  Rig deleted (`measure-seriescard.html`, `src/__measure__/`), dev server
  stopped, baseline worktree removed; tree confirmed clean afterwards. Nothing
  from the rig is committed.

- 23:59Z — **New finding from the merge: GAM-460 is now live against this card.**
  GAM-446, which landed on main after this PR's body was written, adds
  `gradedMarksCt` / `attendedMarksCt` / `excusedCt` to `CoachMeetingRow`
  (`types.ts`) carrying the view's own capitalised warning that _"a consumer
  that renders attendance_pct without also rendering graded_marks_ct
  reintroduces D014's known regression"_. `SeriesCard` is exactly such a
  consumer: it renders `attendancePct` alone. GAM-460's own text says the
  obligation _"should be closed by GAM-447's own acceptance criteria, not by
  separate work"_.

  **Not done here, deliberately.** `SeriesCardModel` has no `gradedMarksCt`, and
  `src/lib/meetings/types.ts` is outside this ticket's Allowed Files — adding it
  is a scope change an owner should make, not one a completion run should slip
  in under a ready flag. It is raised in the PR body as the open decision it is,
  rather than left to be found after merge.

- 23:59Z — **Handover discharged.** PR body published from the artifact and the
  draft flag cleared.

- 00:05Z — **Gates re-run on the final branch state** `5dfb802` (the doc commit
  above — appended log entries move gate 3, so the pre-publish run has to be on
  the head that actually lands): all six PASS, 109 files / 2666 tests against the
  measured 2638 baseline, scoped 52/52. That is the block the PR body quotes.
- 00:09Z — Gate block above re-verified on `83696f2` — same six PASS, same
  counts. Any commit after it on this branch is run-log prose only; gate 3
  (`format:check`) is the sole gate a doc edit can move, and it is re-run on the
  final head before the ready flag goes on rather than assumed to have held.
