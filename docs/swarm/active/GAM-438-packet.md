# GAM-438 worker packet — STANDARD

Coach dashboard reads as a stock analytics template, not as the tracker it
replaces. Restructure `CoachHome.tsx`'s render body and `KpiStrip.tsx`'s goal
tile to match the production tracker's visual language. **Presentation only —
no schema, loader, RLS, or metric-math change of any kind.**

## Allowed Files

- `src/pages/home/CoachHome.tsx`
- `src/components/kpi/KpiStrip.tsx`

Do not touch `src/theme/volt.ts` or `src/theme/theme.css` — every value below
is already expressible through existing tokens (see "Tokens to use").

## Verified against current `main` 2026-08-21

All of the following were re-checked directly, not taken on the issue's word:

- `CoachHome.tsx` is 2850 lines (issue said 2851 — harmless, ignore).
- `:2398` — `<Heading level={1}>Home</Heading>` inside the header `HStack`. Confirmed.
- `:1880-1901` — `KpiCard` (label/value/secondary/children → `Card > VStack > Heading > Heading > secondary/children`). Confirmed.
- `:2430-2492` — primary KPI `Grid`: three `KpiCard`s ("Hours vs. team goal" with the `ProgressBar` + `GOAL_MILESTONES` badges at `:2452-2462`, "Last meeting attendance", "Events in next 7 days"). Confirmed.
- `:2521-2598` — secondary KPI `Grid`: six tiles (Avg hours/active student, Students at goal, Session days logged, Attendance rate, Upcoming commitment, Busiest day).
- `:2617` — start of the Next up / Activity feed paired `Grid`. Confirmed.
- `:2339-2340` — `showSeasonSetupCard = user.role === 'admin' && isSeasonMissingSetup(...)`. Confirmed exact admin-only gate.
- `KpiStrip.tsx:285-304` — four `KpiTile`s (Volunteer hours, Active students, Events logged, **% toward season goal** — this last one is "the goal card" the issue means).

## Production values, read live, not eyeballed

Fetched directly from the deployed reference app (`volt-timetracker.lovable.app`)
today, matching the issue's cited bundle names exactly
(`/assets/styles-B5BNo3Jc.css`, `/assets/routes-_guevisi.js` both present):

```css
.metric-card{border:1px solid var(--line);background:linear-gradient(180deg, var(--surface-1), var(--panel));border-radius:8px;padding:18px}
.accent-card{border-color:#f3b35d8c}
.goal-ring-card{border:1px solid var(--line);background:linear-gradient(#f79a4a14,#a494d50a);border-radius:10px}
```

Read this as: ordinary KPI cards get a subtle top-to-bottom two-stop
background gradient over their normal border; the one goal-related card in
each row additionally gets an accent-tinted border. Do not hand-copy the hex
literals above — they are production's own raw values on production's own
palette, not this app's tokens. **Use this app's existing tokens that encode
the same relationship instead** (all already in `src/theme/theme.css`, applied
via `xstyle` since `Card` has no `variant` that produces a gradient or a
custom border color — see "Astryx prop note" below):

- `var(--color-accent-muted)` — the accent already mixed to ~20-25% alpha,
  which is what production's `#f3b35d8c` (accent at partial alpha) and
  `#f79a4a14`/`#a494d50a` (near-transparent gradient stops) are both doing.
  Use it for the accent border color and as a gradient stop.
- `var(--color-background-card)` / `var(--color-background-muted)` — for the
  gradient's other stop, mirroring `.metric-card`'s `var(--surface-1) →
  var(--panel)` two-stop idea without inventing a new pair of tokens.
- `var(--color-accent)` for anything needing a solid accent line rather than
  a wash.

**Which cards get the treatment (regrouped per the issue):**
- The full-width "Hours vs. team goal" panel (was one of three cards in the
  `:2430` grid; becomes its own full-width section per "Regrouping" below) —
  gradient + accent border, matching `.goal-ring-card`.
- Every other `KpiCard`/`KpiTile` in both grids — the plain `.metric-card`
  gradient treatment (background gradient, ordinary border), no accent.
- `KpiStrip.tsx`'s "% toward season goal" tile only — accent border, same
  token, matching `.accent-card`. The other three `KpiStrip` tiles stay plain.

### Astryx prop note (constitution item 2)

`docs/swarm/astryx-api.md`'s `Card` entry is stale (`undefined` — no props
table rendered) even though `Card` genuinely has `variant`, `padding`,
`width`/`height`/`maxWidth`/`minHeight`, and the universal `xstyle`
(`StyleXStyles`) prop, cross-checked via `npm run astryx -- component Card`
today. `variant` only ever sets one of a dozen flat named background colors
(no gradient, no border-color) — it cannot produce either effect this task
needs, so this is moot for `variant` specifically, but do **not** invent any
other undocumented `Card` prop. The only prop this task needs beyond what's
listed in `astryx-api.md` is `xstyle`, which **is** documented there (every
component's props table carries it) — per DES-21's escalation order
(component → theme token → xstyle → custom CSS), `xstyle` carrying
`stylex.create()` rules that reference the existing CSS custom properties
above is the correct rung: the component itself can't express this, and a new
global theme token isn't warranted for an instance-specific accent.

## Header (`:2397-2418`)

Replace the plain `<Heading level={1}>Home</Heading>` with: an eyebrow line
(season name — already available as `data.season` or equivalent in scope;
follow whatever the existing dashboard-load state already exposes, do not add
a new fetch) above a large title reading **"Coach dashboard"**, keeping the
existing action-button `HStack` alongside it per the issue's copy decisions
(button labels unchanged — "Start check-in", "New outreach event"). This
changes `document.title`'s sibling heading text only, not the nav item label
or route.

## Regrouping (`:2430-2492` and the `:2521` secondary grid)

- "Hours vs. team goal" (current first card of the `:2430` three-card grid,
  including its `ProgressBar` and the `GOAL_MILESTONES` badge/text row at
  `:2452-2462`) becomes its own full-width panel, placed before the tile
  grids. **The 25/50/75/100 milestone ticks (BEH-01) must render unchanged**
  — same `GOAL_MILESTONES` map, same badge-vs-text logic, just relocated.
- "Last meeting attendance" and "Events in next 7 days" (the other two cards
  from that same `:2430` grid) join the secondary tile row (`:2521`'s six
  tiles), making eight tiles total in one `Grid`.
- The `:2617` Next up / Activity feed pairing is unchanged in structure; wrap
  each side in the panel treatment (bordered rows) the issue describes —
  reuse the existing `Card`/`Divider` primitives already in this file rather
  than inventing new list-row markup.

## What must NOT change

- **No inline season-goal editor.** It is a write path, filed as its own
  HEAVY row — pulling it into this task promotes this row's risk class.
  Constitution item 26.
- **No metric arithmetic.** `hoursPercent`, `attendanceRate`, every
  `dashboardData.*` figure — read, not recomputed. Constitution item 3.
- **The admin-only Season setup card's gate must survive unchanged**:
  `showSeasonSetupCard = user.role === 'admin' && isSeasonMissingSetup(...)`
  (`:2339-2340`), still gating the card at `:2824`. This is the single easiest
  thing to lose in a layout restructure — verify it explicitly before
  reporting done.
- Section heading copy stays exactly as today ("Season volunteer
  leaderboard", "Goal projection · confirmed + planned", etc.) — the issue
  says explicitly these are not being re-litigated.

## Acceptance criteria

1. `npx tsc --noEmit` clean.
2. `npx vitest run src/pages/home/CoachHome.test.tsx src/components/kpi/KpiStrip.test.tsx` (if the latter exists — check) all pass, no baseline regressions.
3. Milestone badges (25/50/75/100) still render identically to today given
   the same `hoursPercent` fixture values — a mutation deleting/renaming
   `GOAL_MILESTONES` usage must turn a test red (name which test).
4. Admin-only Season setup card: still present when `user.role === 'admin'`
   and `isSeasonMissingSetup` is true, still absent for `coach`. Name the
   test(s) covering both branches, or add one if none exists.
5. No hardcoded hex color anywhere in the diff — every color comes from an
   existing `var(--color-*)` token via `xstyle`.
6. Report the exact `xstyle`/`stylex.create()` shape used, and the commit SHA.
