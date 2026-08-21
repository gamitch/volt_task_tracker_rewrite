# GAM-445 run log

Issue: <https://linear.app/gamitch/issue/GAM-445/a-series-meeting-tue-6-8-pm-and-sun-330-630-pm-cant-be-scheduled-the>
Branch: `claude/gam-445-per-weekday-times`
Runtime: Claude (Opus 5), dispatched 2026-08-21.

**Convention for the reader:** every subagent dispatch is written here *before*
the run waits on it, and its verdict is a separate line written the moment it
returns. **If a `dispatched` line is the last line in this file, the run died
holding that subagent** — that is the failure shape `AGENTS.md` wall 2
describes, and this log is worded so it is unmistakable rather than something
the next reader has to infer.

## Deadline read at minute 1 (wall 3)

`GH_TOKEN` decoded live: `iat 2026-08-21T19:17:31Z`, `exp 2026-08-21T20:17:31Z`
(3600s exactly, as `AGENTS.md` wall 3 records). The PR is therefore opened as a
**draft, early**, and finalized later; `git push` uses the long-lived
`github_pat_` extraheader (confirmed present) and survives past that expiry.

## Entries

- **19:17Z — orientation.** Read `AGENTS.md` § "Where work comes from" and
  `docs/swarm/constitution.md` before opening anything else. `git status` clean
  on `main` at `bdfafcf`; no pre-existing changes to preserve.
- **19:19Z — tier judged (item 28d, before the `In Progress` move).** Issue
  labels: `meetings-redesign`, `unreviewed`, `Improvement`. No `gate/human`, no
  executor label → legacy Claude-only route (item 28b), which this runtime is.
  **Tier: HEAVY**, against the issue's own suggestion of STANDARD.
  Defence (item 26 requires this stated and defendable): `ScheduleMeetingsDialog`
  is the sole producer of the `starts_at`/`ends_at` values persisted into
  `event_sessions`. A wrong per-day or DST-crossing conversion silently writes
  ~56 wrong session times and then displays the wrong meeting time to coaches
  and students — item 26's own test ("can a mistake here corrupt data, or lie to
  a user about their own data?") answers yes. FAST is excluded on size alone
  (per-weekday rows + generation logic ≫ 20 lines). STANDARD vs HEAVY is
  genuinely arguable, and item 26 says take the heavier one when it is.
  Worker tier stays on its pinned default: none of item 18's four triggers
  (migration, RLS/`security definer`, metric-view SQL, auth/role logic) is
  present, and item 25 forbids bumping because a topic sounds sensitive.
- **19:20Z — claimed.** `Todo → In Progress` via `issueUpdate`, then re-read
  (item 28c): `state.name = "In Progress"`. Claim held, not hoped.
- **19:21Z — branch created**, run log is the first file write on it.
- **19:23Z — draft PR #231 opened** at minute ~6, per wall 3. PR body artifact
  `docs/swarm/active/GAM-445-pr-body.md` written *before* the API call and
  validated by `.claude/skills/pr-body/scripts/check.mjs` (exit 0,
  `declaration closes GAM-445`).
- **19:25Z — claim comment posted** to GAM-445 (`commentCreate` success), lead
  line `**Run log · claude (Opus 5) · claim · 2026-08-21**` per `AGENTS.md`.
- **19:34Z — packet written** to `docs/swarm/active/GAM-445-packet.md`. HEAVY
  shape: verified-state table with every line number read from working tree
  `967170c` rather than copied from the issue (item 19c), Allowed/Forbidden file
  list checked against wall 1 at packet time (no `.github/workflows/**` in it),
  seven acceptance criteria, and the item 19d **Least confident decisions** list
  (five entries). Two facts the issue did not carry are in the packet: the
  `TimeInput` pair at `:1428-1454` is shared by all three modes, and edit mode
  has a separate build path (`buildEditDesiredFutureSessions`, `:829-857`) that
  knows nothing about per-day times — decision 3 asks the gate to attack exactly
  that as a possible data-corruption path.
- **19:36Z — `checker-premise` DISPATCHED** (round 1 of the item 19a two-round
  cap) against `docs/swarm/active/GAM-445-packet.md`, `run_in_background: false`,
  model pin `opus` applying itself from `.claude/agents/checker-premise.md`
  frontmatter — no override passed, and none is warranted.
  **If this line is the last one in this file, the run died holding this
  subagent** — that is wall 2 exactly, and the verdict line that should follow
  was never written because the process exited while waiting.
- **19:48Z — `checker-premise` round 1 VERDICT: REVISE (BLOCKER).** Subagent
  returned; the run did not die holding it. 132K tokens, 43 tool uses, ~11 min.
  The gate ran rather than only read (item 26): it built its own worktree
  (item 23 — shared tree never mutated), `npm ci`'d it, wrote a probe test,
  drove the dialog, and captured a real payload.

  **BLOCKER-1 — my least-confident decision 3 was wrong, and the gate proved it
  by running it.** I recorded that weekly mode was "create-mode-only in
  practice" because `resetForm()` forces `'custom'` (`:973`). It is reachable in
  **two clicks**: `SegmentedControl` (`:1336-1344`) renders all three items
  unconditionally, the weekly block has no `!isEditMode` guard, and the
  mode-derived `sessionDates` feed `buildEditDesiredFutureSessions` at
  `:1204-1210`. The probe drove it and wrote **12 Tue/Thu sessions onto an
  EXISTING series, all at one shared 21:00–22:30Z**, without touching a time
  field. Had this reached a worker, per-day rows would have rendered in edit
  mode and been silently discarded — the failure this very file already names
  unacceptable in its own T609 comment (`:1457-1465`).

  **Findings against my own citations (item 19c, exactly as advertised):**
  §2 row 11 was **false** — eight tests name weekly mode, not one, and the
  DOM-level `:979-1014` is the one most at risk; baseline is **94 green**.
  §3.2 and §7.1 described two different UIs (N rows vs N−1). §7.4's `:1927`
  was stale — the real site is `test.tsx:2101`; I copied it from a source
  comment instead of reading it. §4's Allowed Files could not hold the work:
  `capture()` is mandatory per the `e2e-personas` skill and
  `tests/e2e-personas/screenshots/**` is tracked but was not listed.

  **MAJOR-4, the cheapest finding of the round:** `src/lib/meetings/format.ts:201-211`
  already exports `Dow` and `ScheduleRule` — *one weekday-with-time rule* —
  frozen by GAM-443, whose module doc names this dialog as the caller. GAM-443
  wrote the shape anticipating GAM-445 and I was about to re-derive it.

  **Upheld:** decisions 2 and 4. Decision 5 upheld in substance but wrong in
  framing — no mode-switch reset exists at all, so preserving per-day times is
  the free option and resetting would be the new behaviour.
