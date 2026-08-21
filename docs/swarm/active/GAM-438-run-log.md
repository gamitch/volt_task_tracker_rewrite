# GAM-438 run log

Coach dashboard reads as a stock analytics template, not as the tracker it
replaces — restructure CoachHome to the production layout. Tier: STANDARD
(labeled `standard` in Linear, confirmed not `tier/unreviewed` — no tiering
judgment needed at claim time).

- 2026-08-21: **Claimed.** Moved GAM-438 `Todo → In Progress` via Linear
  GraphQL API (issue id `0e8c3424-89ae-4e82-b798-b7f7babe9f95`), then
  read the issue back and confirmed `state.name == "In Progress"`. Branch
  `claude/gam-438-coach-dashboard-restructure` created off `main` (clean
  tree at claim time, nothing pre-existing to preserve). Depends on GAM-436
  (accent tokens) per the issue body — checking whether that landed on
  `main` before proceeding is the next step. If this line is the last one
  in this file, the run died right after claiming, before any dependency
  check or dispatch happened.
- 2026-08-21: Verified GAM-436 (accent tokens) is merged to `main`
  (`72e9bb1`, PR #216) — the dependency this row is built against is
  satisfied, no blocker. Opened draft PR #220 at roughly minute 9 of the
  60-minute PR credential window (decoded `exp 2026-08-21T05:05:40Z` vs
  `iat 04:05:40Z`), carrying only the run log and PR-body artifact so far,
  per wall 3. If this line is the last one in this file, the run died
  before reading the actual `CoachHome.tsx`/`KpiStrip.tsx` source it was
  about to restructure.
- 2026-08-21: `npm ci` run (node_modules was absent — 342 packages
  installed). Read every cited line in `CoachHome.tsx`/`KpiStrip.tsx`
  directly and confirmed all of the issue's citations against `main`
  (header, KpiCard, both grids, Next-up pairing, the admin `showSeasonSetupCard`
  gate, KpiStrip's four tiles). Fetched the live reference app
  `volt-timetracker.lovable.app` and confirmed both bundle files the issue
  cites (`styles-B5BNo3Jc.css`, `routes-_guevisi.js`) exist verbatim and
  that `.metric-card`/`.accent-card`/`.goal-ring-card` carry the
  gradient/border treatment the issue describes. Found one real gap: the
  issue's claim that exact values are "recorded in the plan file" points at
  nothing that exists in this repo — no such file was ever written or
  linked; substituted a direct fetch of the live production CSS instead
  and recorded the real values in the packet. Also found
  `docs/swarm/astryx-api.md`'s `Card` entry stale (`undefined`, no props
  table) though `Card` genuinely has `variant`/`xstyle`/sizing props
  (cross-checked via `npm run astryx -- component Card`, item 2's
  "cross-check, not a source" caveat honored — `xstyle` is what the packet
  actually needs and it's already documented per-component). Wrote
  `docs/swarm/active/GAM-438-packet.md`. **Risk judgment (item 19b): light
  self-check performed in place of a separate `checker-premise` dispatch**
  — no migration/RLS/auth/metric-SQL surface, zero data-correctness risk,
  and every citation was independently re-verified against `main` and
  against the live reference app rather than trusted from the issue text.
  If this line is the last one in this file, the run died after writing
  the packet, before dispatching the worker.
