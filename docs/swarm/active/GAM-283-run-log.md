# GAM-283 run log

T607 — Ending a meeting can fail partway and the coach is told nothing useful.

Append-only. One line per milestone, committed and pushed immediately. If this
file ends on a dispatch line with no matching verdict line, **the run died
holding that subagent** — that is the failure mode AGENTS.md § "Two walls"
records, and it is what the reader should assume rather than that the work
silently succeeded.

| # | When (UTC) | Milestone |
| -- | -- | -- |
| 1 | 2026-08-12 | Read `AGENTS.md` § "Where work comes from" and `constitution.md` item 28 before opening any other file. |
| 2 | 2026-08-12 | Fetched GAM-283 live from Linear (not from the export). State `Todo`, labels `w3` + `tier/unreviewed`. |
| 3 | 2026-08-12 | **Tier judged HEAVY** (item 28d — tiering is part of claiming). Reasoning recorded below. |
| 4 | 2026-08-12 | **CLAIMED** — `Todo → In Progress`, read back and confirmed `In Progress`. Label `tier/unreviewed → tier/heavy`, read back and confirmed. |
| 5 | 2026-08-12 | Branch `claude/gam-283-end-meeting-failure-copy` created off clean `main` (`28f7394`). |
| 6 | 2026-08-12 | Run log created — first file write of this run. |

## Tier reasoning (item 26, stated so a wrong call is correctable)

**HEAVY.** Not on topic or ticket size — on item 26's actual question, *can a
mistake here corrupt data, or lie to a user about their own data?*

Acceptance criterion 3 requires the new copy to tell the coach **the meeting is
still open and a retry is safe**. That is a factual claim about database state,
and its truth rests entirely on a premise about `endMeeting.ts`'s write
ordering, its opt-in absence guard, and retry idempotency. If any reachable
failure path contradicts it, this row ships a message that confidently tells a
coach the wrong thing about attendance they just recorded — which is worse than
the uninformative fallback it replaces.

That is precisely the shape of the two precedents item 26 cites as having earned
the heavy tier's cost: T305 (proposed fix would have nulled recorded hours) and
T189 (proposed detector would have told every student their account was
deactivated). Both were data-correctness defects invisible to reading the code.

FAST is excluded outright: two catch blocks plus derived copy exceeds ~20 lines
of production change. STANDARD is arguable — single module, no write path
modified. Item 26 resolves an arguable pair by taking the heavier tier.

**Gate scoped per item 19b.** The premise gate is pointed at the load-bearing
premise (which partial states are reachable, and whether "still open, retry is
safe" is true for every one of them), not aimed as a full re-audit — GAM-319 is
a worked precedent for the call-site pattern itself.
