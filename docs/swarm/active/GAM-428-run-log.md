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
