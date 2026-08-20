# GAM-428 run log

Planned volunteer hours count competitions that can never become confirmed hours.
Claude dispatch run, 2026-08-20. Branch `claude/gam-428-planned-hours-competition-filter`.

**Wall clock.** PR credential (`ghs_`) decoded at minute 1: `exp 2026-08-20T12:17:35Z`.
Run started ~11:17Z. The draft PR is opened immediately, per `AGENTS.md` wall 3 —
`git push` outlives that token, `gh pr create` does not.

**How to read a truncated log.** Every subagent dispatch is written here *before*
the wait, and its verdict is a separate line written the moment it returns. If a
dispatch line is the last line in this file, the run died holding that subagent.

| Time (UTC) | Milestone |
| -- | -- |
| 11:18 | Fetched GAM-428 live from Linear. State `Todo`, labels `tier/unreviewed` + `provenance/premise-gate`, no executor label (legacy Claude path, item 28b), no `gate/human`. |
| 11:19 | **Tiered `STANDARD`** and posted the reasoning as a Linear comment — item 28d requires the tier judgement *before* `In Progress`. Swapped `tier/unreviewed` → `tier/standard`. |
| 11:19 | **Claimed.** `Todo → In Progress`, read back: `In Progress`, labels `standard` + `premise-gate`. The claim holds. |
| 11:19 | Branch created. Run log written as the first file write. |
| 11:21 | PR body artifact written and validated (`check.mjs` exit 0, `declaration closes GAM-428`). |
| 11:22 | **Draft PR #213 opened** at ~minute 5, ~56 minutes of credential remaining. `AGENTS.md` wall 3 satisfied. |
| 11:26 | **Premise measured at source, independently.** Confirmed: `20260804000000_volunteer_hours_outreach_only.sql` joins `... and e.counts_volunteer_hours and e.type = 'outreach'`; `StudentHome.tsx:872` and `HoursTab.tsx:481` are both `if (!event \|\| !event.countsVolunteerHours) continue;` with no `type` test. Every line number in the filing verified. |
| 11:27 | Also measured, and **not** in the filing: both real loaders already select `type` (`students.ts:863`, `reports.ts:437`), so item 27 is satisfied — the fix runs on real data on the real path, not a fixture. And the Switch's own on-screen description ("Turn this on if this competition should count toward volunteer hours") is itself a false promise post-T322. |
| 11:28 | Packet written: `docs/swarm/active/GAM-428-packet.md`, with five Least confident decisions (item 19d). |
| 11:29 | **DISPATCHED `checker-premise`** on `docs/swarm/active/GAM-428-packet.md`, `run_in_background: false`, blocking on the result. Told to attack the five Least confident decisions first (its charter §0) and to *run* rather than only read — measure the applied view against a real PostgreSQL cluster via the `scratch-postgres` skill. **If this line is the last one in this file, the run died holding this subagent.** |
| 11:38 | **`checker-premise` VERDICT: REVISE (BLOCKER).** It ran rather than only read: stood up a scratch PostgreSQL cluster, applied 25 of 25 migrations, and read the applied definitions back. Three findings that change the work: |
| | **(1) BLOCKER — half the issue's diagnosis is false.** `computePlannedHours` in `StudentHome.tsx` **has no live caller.** T176 round 2 moved that card onto `v_student_goal_projection.planned_hours` (`StudentHome.tsx:1536-1543`, `students.ts:531`). The gate applied the packet's exact prescription to both files and ran the whole suite: 2583/2583 green, *nothing changed*. Fixing `StudentHome.tsx` fixes zero user-visible behaviour. |
| | **(2) BLOCKER — the real student-facing defect is in a metric view the packet forbids touching, and nobody had named it.** `v_planned_rsvp_hours` joins `events e on e.id = es.event_id and e.counts_volunteer_hours` with **no `type` test**. T322 fixed `v_student_hours` and `v_season_kpis` and left the *planned*-hours views behind. That view feeds the student card **and** CoachHome's projection (`CoachHome.tsx:1433/1439/2050`). It is metric SQL — item 3 routes it through the owner, not through this row. |
| | **(3) BLOCKER — criterion 7 ordered the worker to write a false comment.** `v_student_hours` is the *confirmed*-hours view and is not the authority for planned hours. Also surfaced: `HoursTab.tsx:54` claims "NO SQL view exists for this", which the cluster falsifies — two planned-hours views exist. |
| | Confirmed by measurement: `pg_get_viewdef('v_student_hours')` really does carry `and e.type = 'outreach'::text`; `events.type` is `text` with `CHECK (type = ANY (ARRAY['meeting','outreach','competition']))`, so the allow-list is correct and the domain is closed; no existing test asserts the old behaviour. Every line number in the packet was accurate — the error was the causal claim, not the citations. |
| 11:44 | **Packet v2 written**, scope cut from two files to one. `StudentHome.tsx` removed entirely (fixing dead code would put a false "fixed" claim on the student card); `HoursTab.tsx` kept, because that surface's defect is real, reaches the screen through the real loader, and is fixable inside STANDARD. v1's errors kept in the packet under "What v1 got wrong" per item 30c. Tier re-argued: **STANDARD survives**, but on new grounds — v1 defended it as student-facing and `Reports` is `staffOnly: true`. |
| 11:45 | **Independently re-verified the gate's BLOCKER-2** before filing on it: `20260724000001_planned_hours_future_guard.sql` is the last migration that *creates* `v_planned_rsvp_hours` (`20260805000000` only issues `comment on view`), and its join is `and e.counts_volunteer_hours` with no `type` test. The gate was right. |
| 11:46 | **Follow-up filed: [GAM-430](https://linear.app/gamitch/issue/GAM-430/planned-volunteer-hours-on-the-student-card-and-coach-projection-count)** — `Backlog`, `tier/unreviewed`, Medium. The metric-view half: student card + CoachHome projection, HEAVY, needs the owner ruling route under item 3. Filed *before* the PR leaves draft, per item 20. |
| 11:46 | Skipping a round-2 premise gate, and stating the ground so a wrong call is visible (item 19b): v2 is a strict **subset** of what round 1 already executed and measured green (it applied this exact predicate and ran 2583/2583), minus the falsified half. The residual new material is two comment corrections whose source text round 1 quoted and verified. Re-gating that is re-auditing settled ground, which 19b names as what the gate is *not* for. |
| 11:47 | **DISPATCHED `worker-implementer`** on packet v2, default model (`sonnet` — item 18's four triggers are all absent from v2's scope), `run_in_background: false`, blocking on the result. **If this line is the last one in this file, the run died holding this subagent.** |
| 11:54 | **`worker-implementer` returned.** Commit `7447a16`, two files, `+162/-14`. Predicate now `if (!event \|\| !event.countsVolunteerHours \|\| event.type !== 'outreach') continue;`. 39/39 in `HoursTab.test.tsx`, 2587/2587 full suite, `tsc` exit 0. Declared one doubt honestly: it also corrected a *third* false comment (the function-level JSDoc) not on the packet's named list, and flagged it rather than presenting it as authorized. Adjudicated below. |
