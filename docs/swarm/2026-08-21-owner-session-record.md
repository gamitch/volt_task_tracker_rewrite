# Owner session record — 2026-08-21: coach dashboard redesign

Written so this session's context can be cleared without losing anything. Same
purpose as the 08-14 and 08-18 records.

**Written at `main` = `e1c49b8`.** That pin rots on every merge; run `git log -1`
for the true tip and do not treat a mismatch as evidence this file is stale.

An owner-driven `/design` session. It produced a design canvas, four merged
changes, and three open rows. Everything below is on disk, in Linear, or in a
published artifact — **except two things marked EPHEMERAL in §3, which need
reading before the container is reclaimed.**

---

## 1. Row state at the time of writing

| Row | What | Tier | State |
|---|---|---|---|
| [GAM-435](https://linear.app/gamitch/issue/GAM-435) | Record D020 (accent) + D021 (lucide-react) | `fast` `human` | **Done** (PR #218) |
| [GAM-436](https://linear.app/gamitch/issue/GAM-436) | Brand accent → Tracker Orange | `standard` | **Done** (PR #216) |
| [GAM-437](https://linear.app/gamitch/issue/GAM-437) | Side nav: 16px + lucide icons | `standard` | **Done** (PR #219) |
| [GAM-438](https://linear.app/gamitch/issue/GAM-438) | Coach dashboard restructure | `standard` | **Done** (PR #220) |
| [GAM-440](https://linear.app/gamitch/issue/GAM-440) | Run-log comment convention in `AGENTS.md` | `fast` | **Done** (PR #217) |
| [GAM-439](https://linear.app/gamitch/issue/GAM-439) | Inline season-goal editor | **`heavy`** | **In Progress** — picked up by another run |
| [GAM-455](https://linear.app/gamitch/issue/GAM-455) | Raw float hours on the dashboard | `fast` | **Todo** |
| [GAM-456](https://linear.app/gamitch/issue/GAM-456) | Dashboard is half-panelled; header lost display size | `standard` | **Todo** |

**GAM-439 is the one to watch.** It is the only write path in the set, and its
row records why: `updateSeason` (`loaders/seasons.ts:286`) is a **full-row**
update — `UpdateSeasonPayload` (`SeasonSettings.tsx:376`) requires all four of
`name`, `startsOn`, `endsOn`, `defaultGoalHours`, so an inline editor working
from a stale season copy silently reverts the season's name and dates. That is
the whole reason it is HEAVY.

---

## 2. Two owner rulings now in force

Both recorded in `dispute-log.md`, both merged, both cited by the code that
implements them. Their authority is
`auto-mode-decisions.md`, **"2026-08-21 — George rules on the brand accent and on
`lucide-react`"**.

- **D020** — the brand accent is **Tracker Orange**, not Volt Violet.
  `--color-accent` `['#A8560A', '#f79a4a']`, `--color-on-accent`
  `['#FFFFFF', '#081310']`. Dark values are the production app's own; the light
  value is derived for this repo because production ships no light mode and
  `#f79a4a` scores **2.11:1** on the light card. PRD DES-04's text is
  deliberately unamended — D020 is the record.
- **D021** — `lucide-react` joins the constitution item-9 allowlist. Astryx's
  semantic icon set is a closed 26-name list that cannot name four of the seven
  nav destinations. Disclosed divergence: lucide is outline-only, so
  `SideNavItem.selectedIcon` goes unused deliberately.

**One consequence of D020 that is easy to lose:** competition badges moved
`orange → teal` (`eventTypeBadge.ts`), because orange is now the accent and an
orange badge reads as *selected* rather than as a category.

---

## 3. Where things live — EPHEMERAL warnings

**Durable:**

- **Design canvas** — https://claude.ai/code/artifact/32350945-98a0-4c42-a5a4-df4bcae0c27b
  Three artboards: the coach dashboard, an accent blast-radius sheet, and side-nav
  expanded/collapsed states.
- Everything merged is in `main`. PR bodies are preserved under
  `docs/swarm/active/GAM-43{5,6}-pr-body.md` and `GAM-440-pr-body.md`.

**EPHEMERAL — dies with the container:**

1. **The canvas working files** (`Main.dc.html`, `Accent.dc.html`,
   `NavStates.dc.html`, `canvas.json`) live only in the session scratchpad.
   **Recoverable:** re-run `/design` to re-extract the skill, then
   `node <skill>/seed-canvas.mjs --extract <fetched-artifact.html> --to <fresh dir>`
   pulls them back out of the published artifact. Do this before editing the
   canvas from a new session, or you will re-seed from nothing.
2. **The comparison screenshots** (`<scratchpad>/compare/*.png`) are **not
   recoverable** — re-capture them with the recipe in §5 if needed. They are
   evidence for GAM-456, which is written to stand without them.

---

## 4. Decisions still open

- **The 46px H1 (GAM-456).** `Heading` has no display-size lever, so a display
  title means either a theme-level `heading-1` override — which resizes every H1
  in the app — or an `xstyle` escalation scoped to this page. **Not decided.**
  Do not raise the global heading scale to fix one page.
- **Space Grotesk vs Inter for the H1.** The artboard used Inter because the
  production tracker does; VOLT's own heading font is Space Grotesk. An owner
  choice, not a defect, and deliberately out of GAM-456's scope.
- **Panels: all six or none.** GAM-456 documents the inconsistency without
  prescribing which way to resolve it.

---

## 5. Traps this session measured — worth more than the rows

- **The coach dashboard does not scroll the document.** It scrolls inside an
  Astryx `Layout height="fill"` container, so
  `page.screenshot({ fullPage: true })` silently captures the viewport only and
  misses everything below the fold. There are **two** candidate scroll
  containers; the one you want is the larger `scrollHeight`. This cost a wasted
  capture.
- **Playwright's pinned browser build is not the one installed here.** The repo
  pins a version wanting `chromium_headless_shell-1234`; the container has
  `1194`. Do **not** run `playwright install`. Pass
  `launchOptions: { executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' }`.
- **Re-seeding `defineTheme`'s `color.accent` repaints every neutral.**
  `neutralStyle` bleeds the seed hue into surfaces — measured: card
  `#FEFBFF → #FFFBF7`, text `#1D1A21 → #211A16`. The seed is deliberately left
  violet; explicit `tokens` take precedence and every accent-derived token
  resolves through `var(--color-accent)`. `volt.ts` carries this note in full.
- **The progress bar had a pre-existing accessibility failure.**
  `neutralTheme` pins `.astryx-progressbar.accent` to `#0074e2` independently of
  the accent, scoring **2.00:1 light / 2.03:1 dark** against its own track —
  both under SC 1.4.11's 3:1, before this session touched anything. GAM-436
  fixed it to `light-dark(#6E3300, #f79a4a)`.
- **The accent token had no test at all.** Mutation replay: reverting
  `--color-accent` to violet left the full suite green — 2588 passed, 0 failed.
  `src/theme/accentTokens.test.ts` now closes that, and additionally enforces the
  email/theme accent mirror that `emails/layout/constants.ts` previously stated
  only in prose.
- **Linear comments authenticate as the owner's account.** Every row and comment
  filed by an agent shows `author: George Mitchom`. That is why GAM-440's
  convention requires the `**Run log · <agent> · <stage> · <date>**` prefix —
  without it an agent's reasoning is indistinguishable from an owner
  instruction.

**Re-capture recipe** (for GAM-456 or any dashboard visual check):
`bash tests/e2e-harness/start.sh`, then a spec using `signIn(page, 'coach')` with
`colorScheme: 'dark'`, `viewport: { width: 1440, height: 1000 }`, the
`executablePath` above, scrolling the larger inner container. `stop.sh` after.

---

## 6. What this session got wrong, recorded so it is not re-derived

- **A claim comment on GAM-436 named a branch that did not exist** and said work
  was proceeding when none had started. Corrected in-row by a follow-up comment
  rather than silently edited. If a row says work is underway, verify the branch
  and the diff before believing it.
- **GAM-436's own contrast table was measured against tokens the change moves.**
  The row flagged this as "an assumption, not a proof" — and the assumption was
  wrong on the first attempt. All final figures were re-measured from tokens read
  back out of the regenerated `theme.css`.
- **GAM-437's row claimed `SideNavItem` has no `size` prop.** That was wrong; it
  does (`NavItemSize`), but `size` maps only to height and padding, not font
  size — so the component-level `fontSize` override was still the right
  escalation. The implementer caught and corrected it; `volt.ts` records the
  correction.
- **The design canvas fabricated student names** on the grounds that real first
  names are PII. GAM-434 amended constitution item 6 the same day: first name +
  last-initial is explicitly **not** PII. The mockup is unaffected, but the
  reasoning was stricter than the rule now requires.

---

## 7. If you are picking this up cold

1. Read `constitution.md`, then `AGENTS.md` — **item 28's claim order is binding**
   and `AGENTS.md` now also carries GAM-440's three-transition run-log rule.
2. `GAM-455` is the cheapest real win: two lines, a `fast` row, and the fix
   already exists twice in the repo. Read its "near-miss" section first — the
   obvious local helper is the wrong one to reach for.
3. `GAM-456` needs the H1 decision in §4 before implementation, not during.
4. `GAM-439` is already In Progress under another run. Check its run log before
   touching `CoachHome.tsx`, or you will collide with it.
