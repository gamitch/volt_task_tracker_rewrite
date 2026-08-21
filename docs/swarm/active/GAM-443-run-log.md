# GAM-443 — run log

Issue: <https://linear.app/gamitch/issue/GAM-443/meeting-datetime-formatters-are-duplicated-between-meetingslist-and>
Branch: `claude/gam-443-meetings-format-extract`
Runtime: Claude (Opus 5), dispatched from Linear on `Todo` transition.

This log is appended and pushed at every milestone. If it ends mid-chain, the
last line says what the run was holding when it died.

## Credential deadline (AGENTS.md wall 3)

- `ghs_` App token `iat 2026-08-21T05:02:45Z`, `exp 2026-08-21T06:02:45Z` (3600s).
- Decoded at 05:04Z — 58.3 minutes of PR credential. Draft PR opens immediately.

## Milestones

- **05:03Z — claimed.** Fetched GAM-443 live from Linear (no Linear MCP tool in
  this runtime; used `scripts/linear/client.mjs` + `LINEAR_API_KEY`, which is
  this repo's own read/write path). No `gate/human`; no `executor/*` label, and
  item 28b makes a missing route legacy Claude-only, so this runtime may claim
  it. Moved `Todo → In Progress`, swapped `tier/unreviewed → tier/heavy`,
  read back: state `In Progress`, labels `meetings-redesign, Improvement,
  heavy`. Claim held.

- **05:04Z — tier judged HEAVY (item 26/28d), against the issue's own
  suggestion of STANDARD.** The filer's suggestion is input, not authority, and
  the row arrived `tier/unreviewed` precisely so the tier is decided here.
  Defence: item 26's HEAVY trigger list includes *"an export another session
  builds against"*, and that is this ticket's entire stated purpose — it creates
  `src/lib/meetings/format.ts` as the import surface for five parallel
  `meetings-redesign` components, and GAM-441's decomposition ticket **freezes
  `buildScheduleChips`'s input shape into `types.ts`**. A wrong signature here
  is not one rework, it is every Wave-2 ticket's rework. Item 26's tie-break
  ("if two tiers are arguable, take the heavier one") points the same way.
  What would make this wrong: if `buildScheduleChips` were already consumed by
  a merged component, the shape would be settled and STANDARD would be right.
  It is not — the function does not exist yet.

- **05:05Z — branch created, run log written, draft PR next.**

- **05:07Z — draft PR #223 opened** (<https://github.com/gamitch/volt_task_tracker_rewrite/pull/223>),
  at minute ~5 of the 60-minute credential, carrying only the run log and the
  PR-body artifact. Body artifact written *before* the API call and validated
  by `.claude/skills/pr-body/scripts/check.mjs` (exit 0, `closes GAM-443`).

- **05:08Z — reading the real code to verify the issue's citations** before
  writing the HEAVY packet (item 19c: roughly half of a gate's round-1 findings
  are the author's own unverified line numbers).

- **05:18Z — packet written** (`docs/swarm/active/GAM-443-packet.md`), carrying
  three corrections the orchestrator measured against the tree rather than
  inheriting from the issue: (1) the cited range 1278–1399 over-reaches by six
  lines and would drag `formatPastAttendanceSummary` along; (2) the move list
  omits `sessionDurationHours` (:1334), which shares `computeDurationMinutes`;
  (3) the acceptance criterion "no duplicate formatter bodies remain anywhere
  under `src/pages/`" is **not achievable** in the issue's own Allowed Files —
  `parseDateOnly` has 14 definitions under `src/` and `splitMeridiem` a third
  copy in `LiveConsole.tsx:746`. Criterion narrowed; item-20 follow-up owed.

- **05:19Z — dispatching `checker-premise` (round 1) on the packet**, model
  opus, `run_in_background: false`. **If this line is the last one in this
  file, the run died holding this subagent.**

- **05:33Z — `checker-premise` round 1 returned: VERDICT REVISE.** Subagent
  completed and its result is in hand; nothing was left in flight. It worked in
  its own detached worktree `/tmp/gam443wt` (item 23), removed it, and left the
  shared tree clean — verified.

  **1 BLOCKER, 2 MAJOR, 5 MINOR, 1 NIT.** The gate ran rather than only read,
  which is why it found the BLOCKER:

  - **BLOCKER — acceptance criterion 8(b) is impossible.** The packet told the
    worker to mutate `WEEKDAY_DATE_FORMATTER`'s `timeZone` to `'UTC'` and watch
    a test go red. The gate mutated it in *both* files and ran the full suite:
    **2598/2598 still green**. The reason is structural — `parseDateOnly`
    anchors to **noon UTC** (`MeetingsList.tsx:1304`) precisely so the calendar
    day cannot shift, and noon UTC is 06:00/07:00 in Chicago, the same calendar
    day always. It then proved this rather than asserted it: **0 divergences
    across 800 consecutive days.** My criterion asked a worker to demonstrate
    something false; the outcomes were a stalled packet or a fabricated
    evidence block. Replacement it measured: mutate `parseDateOnly`'s noon
    anchor → **9 tests red**.
  - **MAJOR — `src/lib/format/dates.ts` already exists** and its
    `formatFriendlyDate` is output-identical to `formatWeekdayDate` (0/800
    divergences). My packet cited that file only for its comment style and
    never said why this is not it. A de-duplication packet may not silently
    create a second shared home for date formatting.
  - **MAJOR — `buildScheduleChips` underspecified in five places** — the
    12-hour conversion (`0 → 12 AM` vs `0 AM`), `endMinutes` range,
    `endMinutes <= startMinutes`, midnight-spanning, `dow` outside `0..6`.
    This is precisely the shape GAM-441 freezes into `types.ts`. It did confirm
    the meridiem rule I wrote is correct and self-consistent (`11 AM–1 PM`).
  - MINOR ×5 / NIT ×1 — my `parseDateOnly` count was **16 under `src/`, not
    14** (14 is the count under `src/pages/`); missing export list; my
    module-doc requirement was asymmetric and let `MeetingsList.tsx`'s own doc
    keep saying "the ONLY date-formatting functions in this file"; no named
    gate baseline (measured: **2598 tests / 102 files**, scoped **141**);
    `buildScheduleChips` should ban `Date`/`Intl` outright, not just for the
    weekday; `CalendarPage.test.tsx` needs no edit at all.

  Every "Verified state" citation I wrote was confirmed exact **except** the
  `parseDateOnly` count. The gate also built the entire prescribed move in its
  worktree and measured it green: `tsc --noEmit` exit 0, 141/141 scoped,
  0 eslint errors.

- **05:34Z — revising the packet (round 2 of the 19a two-round cap).**

- **05:40Z — packet revision 2 written**, incorporating all 9 findings: the
  BLOCKER criterion replaced with the gate's measured 9-tests-red mutation and
  an explicit "do not attempt the impossible one, and do not report a red run
  that did not happen"; the `dates.ts` relationship decided and required in
  `format.ts`'s `@position` block; `buildScheduleChips` fully specified
  (`((h+11)%12)+1`, `endMinutes` 1..1440, `RangeError` on malformed input,
  midnight-spanning explicitly out of scope, no `Date`/`Intl` at all); the
  count corrected to 16/14; an explicit export list; `MeetingsList.tsx`'s four
  lying doc sites named; gate baselines 2598/102 and 141 written in. Two
  least-confident items closed by the gate's citations, two new ones declared.

- **05:41Z — dispatching `checker-premise` round 2, SCOPED (item 19b), model
  opus, `run_in_background: false`.** Scoped rather than a full re-audit
  because round 1 physically built and measured the prescription green, so
  re-auditing settled ground is what 19b says not to spend a round on. Round 2
  attacks only what revision 2 newly wrote. **If this line is the last one in
  this file, the run died holding this subagent.**

---

## Run 2 — resumed 2026-08-21 11:09Z (a second dispatch on the same row)

**That line WAS the last one in the file, and the warning it carries is
accurate: run 1 died holding the round-2 `checker-premise`.** The issue was back
in `Todo`, which is why this second run was dispatched. Nothing from round 2
exists — no verdict, no worktree, no artifact. Run 1's own log is why this run
knew where to resume instead of re-deriving the packet from scratch; that is the
entire argument for the log.

State inherited and verified by this run, not assumed:

- Remote branch `claude/gam-443-meetings-format-extract` @ `6dfe51c`, six
  commits, all documentation. **No source file has been touched yet** — the
  worker was never dispatched.
- Draft **PR #223** is open on this branch (`isDraft: true`, `state: OPEN`), so
  wall 3 is already discharged; this run pushes into it rather than opening one.
- `docs/swarm/active/GAM-443-packet.md` is at **revision 2**, carrying all 9 of
  round 1's findings.

- **11:09Z — re-claimed.** `GAM-443` was `Todo` again; moved
  `Todo → In Progress` and read back `state.name = "In Progress"` (item 28c).
  Labels unchanged: `heavy`, `Improvement`, `meetings-redesign`; no
  `gate/human`, no executor route → legacy Claude-only (item 28b). Run 1's
  HEAVY tier judgement stands and this run adopts it unchanged.
- **11:11Z — credential deadline for THIS run:** `iat 2026-08-21T11:09:27Z`,
  `exp 2026-08-21T12:09:27Z`. PR #223 already exists, so nothing this run needs
  depends on that token except a final `gh pr ready`; `git push` outlives it.
- **11:14Z — re-dispatching `checker-premise` round 2, SCOPED (item 19b), model
  opus, `run_in_background: false`.** This is round 2 of item 19a's two-round
  cap — run 1 spent round 1, and a dispatch that returned no verdict spends no
  round. A REVISE here escalates to the human owner rather than looping.
  **If this line is the last one in this file, the run died holding this
  subagent — for the second time on this row.**
