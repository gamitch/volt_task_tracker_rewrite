Closes GAM-438

## What changed

Restructures `CoachHome.tsx` and `KpiStrip.tsx`'s goal tile from the current
hairline-bordered, plain layout to the production tracker's visual language:
an eyebrow (active season name) + large "Coach dashboard" title replacing the
plain "Home" heading, a subtle gradient background on every KPI card/tile,
an accent-tinted border on the one goal-related card/tile per row, a
regrouped primary section (the "Hours vs. team goal" panel — with its
25/50/75/100 milestone ticks intact — is now full-width; the other two old
primary-grid cards join the secondary tile row for eight tiles total), and
Next up / Activity feed sides wrapped in bordered `Card` panels. Presentation
only — no schema, loader, RLS, or metric-arithmetic change; the admin-only
"Season setup" gate (`showSeasonSetupCard = user.role === 'admin' &&
isSeasonMissingSetup(...)`) is untouched.

## What the issue got wrong

Two things, both minor and both worth recording:

- The issue said exact production values were "recorded in the plan file."
  No such file exists anywhere in this repo, and none is linked. Substituted
  a direct fetch of the live reference app instead: `volt-timetracker
  .lovable.app`'s current `/assets/styles-B5BNo3Jc.css` and
  `/assets/routes-_guevisi.js` match the issue's cited bundle names exactly,
  and `.metric-card`/`.accent-card`/`.goal-ring-card` do carry the
  gradient/border treatment described — the substance was right, the
  citation to a repo artifact was not.
- The issue's own packet-writing guidance (this run's own, not the issue's)
  prescribed `xstyle`/`stylex.create()` for the styling mechanism. That is
  provably nonfunctional in this app: `vite.config.ts`'s Vite plugins are
  `[react()]` only, no StyleX babel plugin, confirmed both by reading the
  config and by a throwaway runtime probe against the installed
  `@stylexjs/stylex` package (`stylex.create()` throws
  `Unexpected 'stylex.create' call at runtime`). This is also a
  **pre-existing, already-recorded** repo finding (F-2,
  `docs/swarm/VOLT_UX_Craft_PRD_v3.md:55-60`), independently reproduced
  here rather than taken on faith. The worker used `Card`'s own genuinely
  documented `style` prop instead (confirmed against the installed
  `Card.d.ts`, not hallucinated), which the F-2 finding itself names as the
  correct fallback rung.

## Tier, stated and defended

**STANDARD**, per constitution item 26 and the issue's own tiering: no write
path, no schema/RLS/migration/auth change, presentation-only restructure of
two files. The issue itself argues file/line count is not a tier trigger,
and that argument holds — nothing here creates or mutates data. Dispatched
as one `worker-implementer` packet; this orchestrator independently read
the full diff, cross-checked the worker's F-2 claim against the installed
source rather than trusting it, and replayed two mutations directly
(BEH-01 milestone logic, the admin-only gate) rather than trusting the
worker's own report of doing so.

**Item 19 (premise gate) scoping, stated:** no separate `checker-premise`
subagent was dispatched. Per item 19b's risk-based scoping, this task
touches no migration/RLS/auth/metric-SQL surface, so the light-check path
applies; the light check itself was performed directly — every citation in
the issue (six line ranges across two files) was re-read against `main`
before the packet was written, and the issue's one unverifiable claim (the
"plan file") was caught and replaced rather than passed through.

## Verification

```
GATE RUN — d77a347 on claude/gam-438-coach-dashboard-restructure — tree clean

  1 tsc                     exit 0  PASS
  2 vite build              exit 0  PASS
  3 format:check            exit 0  PASS
  4 eslint                  exit 0  PASS       0 errors, 380 warnings
  5 vitest (full)           exit 0  PASS       102 files / 2594 tests  baseline 2594 (+0)
  6 vitest src/pages/home/  exit 0  PASS       4 files / 228 tests  baseline 116 (+112)

VERDICT: PASS — all six gates exit 0
```

Baseline (102 files / 2594 tests) measured directly at the branch's
merge-base `a5d6909`, in a disposable worktree, not assumed.

format:check failed on the worker's first commit (Prettier line-wrap only,
two lines); fixed with `npx prettier --write`, re-ran clean.

### Mutations

| # | Mutation | Result |
|---|---|---|
| 1 | `showSeasonSetupCard = user.role === 'admin' && ...` → `false && ...` | 2 of `CoachHome.test.tsx`'s `HOME-04` tests turned **red** (`expected ... to contain 'Season setup'`, `expected undefined to be truthy`). Reverted; both green again. |
| 2 | `GOAL_MILESTONES = [25, 50, 75, 100]` → `[26, 50, 75, 100]` | The BEH-01 "reached 25% toast" test turned **red**. Reverted; green again. |

### e2e-personas

`tests/e2e-personas/gam438-coach-home-restructure.spec.ts` drives the real
production bundle in a real browser (harness in `tests/e2e-harness/`) as the
`coach` persona: confirms the "Coach dashboard" header, the full-width
"Hours vs. team goal" panel with its 25%/50% milestone text visible, all
eight secondary tiles present, and no "Season setup" text on the page.
Passed. Screenshot: `tests/e2e-personas/screenshots/438-coach-dashboard.png`.

**Not exercised live:** the admin-sees-"Season setup" branch. The real
loader hardcodes `hasGoalsConfigured: true` (schema-guaranteed —
`seasons.default_goal_hours` is `NOT NULL`), so that branch is only
reachable via `teams.length === 0`, and `students.team_id` is `NOT NULL
REFERENCES teams(id) ON DELETE RESTRICT` — emptying `teams` in the seed
isn't a safe, reversible mutation the way the harness's other specs' deletes
are (it would require deleting/restoring students, guardian_links and
student_teams too). That branch is covered by mutation 1 above plus
`CoachHome.test.tsx`'s pre-existing `HOME-04` describe block instead.

## Scope: what this does and does not close

Closes GAM-438 fully as scoped: every figure on this page already read real
data before this change and still does — this task changed presentation
only. No fixture or stub was introduced or touched (item 27 is not
implicated). The inline season-goal editor visible in the design canvas is
explicitly out of scope per the issue's own text (a write path, filed
separately, HEAVY).

## Known gaps, disclosed

- The Next up / Activity feed panels got a plain bordered `Card` wrap, not
  the gradient/accent treatment — the issue's own "which cards get the
  treatment" framing only named `KpiCard`/`KpiTile` instances. A reviewer
  who wants the panels to carry more visual weight can say so; this is a
  judgment call, not an oversight.
- Styling mechanism deviates from `xstyle` to `style` for the reasons in
  "What the issue got wrong" above — both a pre-existing repo finding (F-2)
  and independently reproduced here.

Linear-Issue: GAM-438
