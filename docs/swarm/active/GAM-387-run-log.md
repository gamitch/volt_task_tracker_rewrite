# GAM-387 run log — app-wide error boundary

Issue: <https://linear.app/gamitch/issue/GAM-387/the-app-has-no-error-boundary-anywhere-so-any-render-throw-including-a>
Branch: `claude/gam-387-error-boundary`
Runtime: Claude (legacy route — no executor label on the issue, item 28b migration compatibility)

Append-only. One line per milestone, pushed immediately after it is written.
Milestones: claimed; packet written/read; each subagent dispatched; each
subagent's verdict; gates run; PR opened.

---

- **Claimed.** Read `AGENTS.md` § "Where work comes from" and `constitution.md`
  items 19, 26, 28 before opening any other file. Fetched GAM-387 live from
  Linear. State was `Todo`; labels `provenance/other`, `Bug`, `tier/unreviewed`;
  no `gate/human`; no executor label → legacy Claude-only route (item 28b).
- **Tiered HEAVY** before the `In Progress` move (item 28d). Reasoning, to be
  restated and defended in the PR (item 26): *not FAST* — a boundary component
  plus router wiring plus tests exceeds ~20 lines and is not a single-site edit.
  *Not STANDARD* — this introduces a pattern that exists nowhere in the codebase,
  which item 19b names as a full-premise-check trigger, and the issue prescribes
  an unverified structural claim ("put the boundary inside the router at route
  level so the shell and navigation survive") whose failure mode is a fix that
  looks green while acceptance criterion 2 is unmet. *HEAVY* because two tiers
  are arguable and item 26 says take the heavier, on three grounds: the central
  structural premise is unmeasured; acceptance criterion 4 is an
  honesty-about-the-user's-own-data requirement, which is item 26's "lie to a
  user about their own data"; and a boundary that catches too broadly is worse
  than none, so the tests need a separate checker rather than the author's
  say-so. Blast radius and file count are explicitly **not** reasons — item 26
  rules both out.
- **Claim read back** (item 28c — Linear has no compare-and-set): `GAM-387`
  reads `In Progress` with labels `other`, `Bug`, `heavy`. We hold it.
- **Branch created**: `claude/gam-387-error-boundary` off `main` at `debe8e4`.
