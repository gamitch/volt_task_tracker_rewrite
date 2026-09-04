# Starting over

This folder is the complete founding document set for rebuilding the VOLT
Team Portal from scratch. It was produced on 2026-08-23 by going through the
whole application — the code at `5bf0cb7`, the prior PRDs (v1.5 / v2 /
v3.1), the external UX audit and its triage, all 496 Linear issues, the
coaches-dashboard and meetings redesigns, the migration runbook, and the
session/lessons records — and distilling what should survive.

## The one-paragraph case for starting over

At the final commit every gate is green — 0 type errors, clean build, 2,792
passing tests — and the app still doesn't work for its users: the core
attendance loop shipped as a fixture shell, RSVPs silently wrote nothing,
dashboards showed fabricated data, and the launch gates never moved. The
backlog grew twice as fast as it closed (98 issues filed vs 52 completed in
the final week alone; 496 total at the 2026-08-23 survey, 131 still open),
and a third of what's open is about the development process itself.
The code isn't the asset. The **lessons, rulings, schema, and proven domain
logic are** — and this folder packages exactly those, so the rebuild starts
from everything the last seven weeks paid for and none of what they
accumulated.

## What's in here

| File | What it is | Read it when |
|---|---|---|
| **PRD.md** | The rebuild's product spec, **ratified 2026-08-26**: mission, domain rules, vertical-slice milestones M0–M4, NFRs from the old defect classes, persona acceptance suite, and §12 — the record of George's fourteen answered decisions | First — it's the plan |
| **CONSTITUTION.md** | The working rules, ~130 lines instead of 1,223: hard floors, working-software rules C-1..C-11 (each citing the failure that paid for it), agreements W-1..W-6 | Before any build session |
| **DECISIONS.md** | George's ~30 standing rulings, consolidated and dated, several verbatim — the project's real domain spec | When any "should it…?" comes up |
| **LESSONS.md** | The post-mortem with receipts: the five failures, what worked, and how each maps to a constitution rule | To understand *why* the rules exist |
| **SALVAGE.md** | The shopping list: schema/views/RLS, check-in HMAC, timezone modules, theme tokens, e2e harness, ETL — by file path in this repo | During M0, constantly |

## How to start (the first week)

All fourteen §12 decisions are answered (2026-08-26) — nothing is blocked
on George except two inputs he owns:

1. **George supplies the student roster spreadsheet** (usernames + default
   password, R-1) — needed by M1, not M0.
2. Create the fresh Supabase project; squash the schema per `SALVAGE.md` §2
   into one 10-table baseline migration; adapt and re-run the ETL from a
   fresh export (`SALVAGE.md` §5).
3. Stand up M0: auth, guards, error boundary, generated types, CI with the
   persona suite, deployed to the real domain.
4. Accept M0 the only way anything gets accepted now: **George signs in on
   the production URL and sees the real roster.**
5. Close the old Linear backlog whole (R-6): all 131 open issues,
   `rebuild` label, infrastructure tickets included.

## What this folder is not

It is not a migration plan for the current codebase — per `SALVAGE.md` §7,
`src/` is left behind except for the named pure modules. It is not a
process framework — the constitution fits on two screens on purpose. And it
stays alive the same way it was born: decisions land in `DECISIONS.md`
dated, and the PRD edits in place.
