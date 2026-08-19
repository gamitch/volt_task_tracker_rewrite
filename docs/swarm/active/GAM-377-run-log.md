# GAM-377 run log

**Issue:** [GAM-377](https://linear.app/gamitch/issue/GAM-377/the-outreach-event-dialog-has-no-startend-ordering-guard-so-a-coach) —
the outreach event dialog has no start/end ordering guard.
**Tier:** `tier/heavy` (label `heavy`), labels `w2`, `Bug`.
**Branch:** `claude/gam-377-outreach-end-ordering-guard`
**Base:** `debe8e4`

This file is appended to at every milestone and pushed immediately. If the last
line is a dispatch with no matching verdict, **the run died holding that
subagent** — that is the failure signature `AGENTS.md` § "Two walls" describes,
not a run that merely ran out of things to say.

## Timeline

- **Claimed.** Read `AGENTS.md` § "Where work comes from" and
  `docs/swarm/constitution.md` items 18/19/26/28 before opening any source file.
  Fetched GAM-377 live from Linear: state `Todo`, labels `heavy` / `w2` / `Bug`,
  no `gate/human`, no executor label (item 28b: a missing route is the legacy
  Claude-only path, so this run may claim it). Tier is **not** `tier/unreviewed`,
  so item 28d's tiering-as-claiming step does not apply — the tier is given.
  Moved `Todo → In Progress` (`issueUpdate` returned `success: true`) and
  **read back**: `{"identifier":"GAM-377","state":{"name":"In Progress"}}`.
  Item 28c's read-after-write is satisfied; the claim is held, not hoped.
- **Run log created** and pushed as the first file write, before any packet work.
  Commit `9683853`, pushed.
- **Tier confirmed HEAVY** under item 26 without needing item 28d's judgement —
  the label is `heavy`, not `tier/unreviewed`. It is also the correct call on the
  merits: the change guards a **write path**, and the value it guards feeds
  metric SQL (`OUTREACH_FIXED_FLAGS.countsVolunteerHours: true`). HEAVY means
  packet → `checker-premise` → worker → `checker-reviewer`.
- **Citations re-verified first-hand before writing the packet** (item 19c),
  against base `debe8e4`, rather than trusting the issue text:
  `OutreachEventDialog.tsx:1200` `isValid` is presence-only (verbatim match);
  the two per-session `TimeInput`s at `:1492-1503` carry no `min` and no
  `status`; `computeEndTimeError` is at `ScheduleMeetingsDialog.tsx:534` as
  described; `OUTREACH_FIXED_FLAGS` at `:660-663`. Two things the issue did not
  say, both found by checking: `timeStringToMinutesSinceMidnight`
  (`ScheduleMeetingsDialog.tsx:512`) is **module-private and not exported**, so
  the port cannot be a bare cross-import; and `TimeInput`'s `status` and `min`
  props are real (`astryx-api.md:1755` and `:1747`), so item 2 is satisfied.
- **Packet written** — `docs/swarm/active/GAM-377-packet.md`, with the item 19d
  **Least confident decisions** list (5 entries). It rules on the open question
  the issue left ("whole save vs per-day"): block the whole save AND mark the
  offending day, because silently skipping the bad day is the accept-show-discard
  shape this codebase has a standing ruling against. Not yet dispatched to a
  worker — item 19 forbids that until `checker-premise` returns DISPATCH.
  Commit `94462dc`, pushed.
- **DISPATCHED: `checker-premise` round 1** on `docs/swarm/active/GAM-377-packet.md`,
  with `run_in_background: false`. Model pin `opus` applies itself from
  `.claude/agents/checker-premise.md`. Gate is capped at two rounds (item 19a);
  a third REVISE escalates to the human owner instead of looping.
  **If this line is the last one in this file, the run died holding this
  subagent** — not "the gate is still running", not "results pending". Dead,
  holding it, exactly the way runs 31354278407 / 31385764526 / 31514339272 /
  31523233268 / 31527801235 died.
- **VERDICT round 1: REVISE (2 × BLOCKER).** Subagent returned; run did not die
  holding it. The gate *ran* the prescription rather than reading it — a
  worktree (item 23), `npm ci`, five vitest experiment suites and the full
  suite. All five of my declared doubts (§9) came back **SOUND**; both BLOCKERs
  were things I had not declared, which is item 19d working as designed.
  - **BLOCKER-1 — the fix breaks a shipped e2e persona spec, silently.**
    `tests/e2e-personas/outreach-lifecycle.spec.ts:191-192` fills Start and End
    both `11:59 PM` — an **equal pair**, which §4a's `<=` turns into an error,
    disabling the submit the spec clicks at `:213`. The six `gate-run` gates do
    **not** run Playwright (`vite.config.ts` excludes `tests/e2e-personas/**`;
    `ci.yml` has no e2e job), so AC8 would go green while the W2 lifecycle chain
    broke. The spec's `:187-189` comment makes 23:59 load-bearing, and that file
    is outside my §6 Allowed Files — so a worker would have had to stall or ship
    the break. GAM-290 never hit this: that spec is the only persona spec that
    fills time fields at all.
  - **BLOCKER-2 — my acceptance criteria name a sequence that cannot exercise
    the guard.** Measured on the pristine tree: the first edit to either
    per-session time field **wipes the other field's default**, because
    `updateSessionDetail:1203-1211` seeds `{startTime: undefined, endTime:
    undefined, …}` and `syncSessionDetails:852-867`'s `??` then never falls back
    to `DEFAULT_START_TIME`/`DEFAULT_END_TIME`. So "set End before Start" yields
    `computeEndTimeError(undefined, …) === undefined`, no error copy, and a
    button disabled by the **pre-existing** `sessionsPayload.length > 0` — AC3
    would have passed for the wrong reason and **AC7's mutation was measured as
    a survivor** on that sequence. The only order that reaches the guard is
    End-first, then Start later.
  - Also returned: the DST claim is **confirmed by execution** (`wall 07:00 →
    13:00Z`, `wall 08:00 → 13:00Z`, collapsed — AC1's regression case is real),
    and the negative-hours chain is now **verified at the SQL** rather than
    inherited — `20260724000001_planned_hours_future_guard.sql:69` computes
    `epoch/3600.0` with no clamp and filters on `starts_at`, the later value in
    an inverted pair.
  - Two MINOR harness facts and two NITs to fold in; one item 20 follow-up
    identified (the default-wipe is its own defect, and a third copy of the
    DST-buggy comparison now exists in `EditMeetingSessionDialog.tsx:311-321`).
  Verdict recorded in commit `d5cda65`, pushed.
- **Both BLOCKERs re-verified by the orchestrator before revising**, rather than
  taken on the subagent's word: `outreach-lifecycle.spec.ts:191-192` does fill
  `11:59 PM` twice and is the only persona spec that touches time fields;
  `vite.config.ts:42-58` does exclude `tests/e2e-personas/**` from vitest; and
  the default-wipe follows by reading — `sessionDetails` starts `{}` (`:1027`),
  `updateSessionDetail:1204-1210` seeds both fields `undefined`, and
  `syncSessionDetails:860`'s `??` then cannot re-seed the untouched one.
- **Packet revised to revision 2.** New §3-bis (the default-wipe, and why it
  makes the intuitive test order unfalsifiable), new §5-bis (the e2e conflict
  and the exact `11:58 PM` / `11:59 PM` ruling, with `<=` deliberately NOT
  weakened to `<`), §2 rewritten — `min` and the comparison guard **disjoint**
  interaction orders on this dialog, so revision 1's inherited "`min` is
  secondary" framing was false here — `tests/e2e-personas/outreach-lifecycle.spec.ts`
  added to Allowed Files under a narrow two-line mandate, AC2/AC3/AC4/AC7
  rewritten around the End-then-Start order with an explicit `1 session` (not
  `0 sessions`) anti-criterion, harness facts and the 2505-test baseline added
  to AC8, and a **fresh** §9 of five new doubts (the old five are retired as
  SOUND and recorded as such). Commit `c0fed2d`, pushed.
- **DISPATCHED: `checker-premise` round 2** on packet revision 2, with
  `run_in_background: false`. **This is the last round item 19a allows** — a
  third REVISE escalates to the human owner rather than looping, and I will
  escalate rather than dispatch a round 3.
  **If this line is the last one in this file, the run died holding this
  subagent.** Not "awaiting the gate", not "verification in progress". Dead,
  holding it.
