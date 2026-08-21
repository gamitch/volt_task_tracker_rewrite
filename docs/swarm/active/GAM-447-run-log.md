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
  write path (the Edit action calls the *existing* `onSaveMeetingSeries` seam,
  which this ticket does not implement), no schema/RLS/migration/metric SQL, no
  auth or role logic, and no export another session builds against — the props
  interface is *frozen by the decomposition ticket*, so this component consumes
  it rather than defines it. Too large for FAST (new component + edit panel +
  CSS + tests, well over ~20 lines). STANDARD it is: one worker on a compact
  packet, orchestrator replays the mutation and runs the gates.
- 22:42Z — Branch `claude/gam-447-series-card` created; run log is the first
  file write.
- 22:45Z — **Draft PR opened: <https://github.com/gamitch/volt_task_tracker_rewrite/pull/232>**
  (~minute 5, ~55 minutes of PR credential still live). Body artifact
  `docs/swarm/active/GAM-447-pr-body.md` written *before* the API call and
  validated by the declaration checker (`OK declaration closes GAM-447`).
- 22:52Z — Rebased the branch onto `origin/main` @ `3d27d8a`: PRs #230 (GAM-444)
  and #231 (GAM-445) had merged *after* this run started, and they create
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
- 23:20Z — **`checker-premise` round 2 FAILED without a verdict** — the agent
  terminated on `API Error: 529 Overloaded`, a server-side fault, after
  re-reading the revised packet but before emitting VERDICT. This is not a
  REVISE and not a DISPATCH; it is a *missing* gate round, and it is recorded as
  such rather than rounded up to a pass. Round 1's verdict stands as the last
  real one: REVISE, all eight findings applied.
- 23:21Z — Deadline arithmetic, done rather than guessed: PR credential dies
  23:40:44Z (~19 min). `git push` survives it (long-lived PAT in the
  extraheader) and so do Linear writes (`LINEAR_API_KEY`); `gh pr edit` and
  `gh pr ready` do not. Updating the PR body on GitHub NOW, before the work is
  finished, so the PR is informative even if the credential dies mid-run.
- 23:24Z — PR #232's description on GitHub updated from the artifact (declaration
  re-checked: `OK declaration closes GAM-447`). It now carries the three premise
  findings, the tier defence, the item-27 Partial scope call and the declared
  item-19a deviation. It stays a **draft** — the work is not verified yet, and a
  ready flag on unverified work would be a lie.
- 23:25Z — **RE-DISPATCHED `checker-premise` (round 2, fresh agent, delta-scoped)**
  after the 529. Blocking on it with `run_in_background: false`. **If this line
  is the last one in this file, the run died holding this subagent.**
- 23:27Z — **Round-2 re-dispatch ALSO died on `529 Overloaded`**, this time before
  doing any work at all. Two independent 529s in seven minutes: the API is
  overloaded right now, and this is infrastructure, not the packet. Item 19's
  DISPATCH verdict is therefore **unobtainable on this run**, and I am not going
  to invent one. Trying the worker dispatch next — if that also 529s, the
  orchestrator implements directly (a declared item-26 deviation) or the run
  stops and hands off, whichever the clock allows.
- 23:38Z — **`worker-implementer` VERDICT: work delivered**, commit
  `8869ee1` — `SeriesCard.tsx` 44 → 442 lines, new `SeriesCard.test.tsx` 319
  lines / 21 tests. No other file touched; `SeriesCard.css` and
  `SeriesEditPanel.tsx` deliberately not created (packet §3b/§3c/§5). Worker's
  self-reported exit codes: tsc 0, scoped vitest 0, eslint 0, prettier 0 — **not
  yet independently replayed; that is the orchestrator's next act.** Named
  mutation to replay: `'—'` → `'0%'` in `formatAttendanceText`.
- 23:39Z — PR credential expires 23:40:44Z. PR #232 stays a **draft**: the run
  cannot mark it ready after that, and marking it ready *before* the gates ran
  would have been a false claim. Its description already carries the premise
  findings and the declared item-19a deviation. Pushes continue to work.
- 23:57Z — **Gates run independently by the orchestrator, on the committed tree
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
- 00:12Z — **Three mutations replayed by the orchestrator, in a detached worktree
  (item 23 — never the shared tree), each reverted and re-verified green.**

  | Mutation (`SeriesCard.tsx`) | Result |
  | -- | -- |
  | `attendancePct === null ? '—'` → `? '0%'` — fabricate a zero where the metric view says nothing | **REDDENED** 21→20 passed, exit 1 (`attendancePct rendering (DATA-01 …)`) |
  | `MAX_VISIBLE_SCHEDULE_CHIPS = 4` → `999` — remove the cap that wins height invariance | **REDDENED** 21→20 passed, exit 1 (`height invariance > never renders …`, "expected 12 to be 5") |
  | `onSelect?.({ eventId: model.eventId })` → `{ eventId: model.title }` — raise the frozen focus request with the wrong identifier | **REDDENED** 21→20 passed, exit 1 (`onSelect > is called with exactly …`) |

  The first is the worker's own named mutation; the other two are the
  orchestrator's, chosen to attack the two claims a green suite is least likely
  to actually guard — the design's fixed-height promise and the contract a
  sibling ticket codes against. All three reverted cleanly; worktrees removed.
- 00:14Z — **DISPATCHED `checker-reviewer`** on the actual diff. Item 26 does not
  require a checker round at STANDARD — this one is added deliberately because
  the item-19 premise gate never returned a DISPATCH verdict (two 529s), so an
  independent read of the artifact is the closest available substitute for the
  round that could not run. Blocking on it. **If this line is the last one in
  this file, the run died holding this subagent.**
- 00:22Z — **`checker-reviewer` VERDICT: PASS**, highest severity MINOR — no
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
- 00:23Z — **RE-DISPATCHED the same `worker-implementer`** (context intact) to fix
  the cheap MINORs and NITs in place rather than file five follow-up rows for
  work that is inside its own Allowed Files. Blocking. **If this line is the last
  one in this file, the run died holding this subagent.**
- 00:36Z — **Fix round delivered**, commit `52362d3`: all 11 checker items applied,
  `SeriesCard.tsx` 442 → 470 lines, tests 21 → 28. One **disclosed behavior
  change**, and it is the one thing on this branch a reader should look at
  twice: the worker could not pin the title clamp at `maxLines={1}` because
  Astryx's `Heading` emits no DOM-observable signal at 1 (only an opaque StyleX
  class), so it widened the clamp to `maxLines={2}`, where `Heading`'s own
  runtime sets a real inline `WebkitLineClamp`. A test now pins it. The card's
  height is fixed unconditionally either way, so this changes how much of a long
  title shows, not whether the card grows — but it is a behavior change made to
  make a guard testable, and it is disclosed rather than buried.
- 00:37Z — **Gates re-run on `52362d3`, clean tree — all six PASS**: tsc 0, vite
  build 0, format:check 0, eslint 0 errors / 380 standing warnings, full vitest
  109 files / **2661** tests vs the measured 2633 baseline (+28), scoped 28/28.
- 00:38Z — **Two more mutations replayed** on the fix commit, isolated worktree,
  both reverted:

  | Mutation | Result |
  | -- | -- |
  | `buildSelectionStyle` → `return undefined` — delete the selected-state ring | **REDDENED** 28→27, exit 1 (`isSelected > renders a visible s…`) |
  | `TITLE_MAX_LINES = 2` → `99` — unclamp the title so it can grow the card | **REDDENED** 28→27, exit 1 (`height invariance > pins the tit…`, "expected '99' to be '2'") |

  Five mutations total across the two commits, five reddened. The two guards the
  checker specifically called unpinned are now pinned, and I watched both fail.
- 00:47Z — **Item-20 follow-ups filed**, to `Backlog` carrying `tier/unreviewed`
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
