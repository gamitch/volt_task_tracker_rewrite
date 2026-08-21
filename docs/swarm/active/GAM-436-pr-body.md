Closes GAM-436

## What changed

The brand accent moves from Volt Violet to Tracker Orange — `--color-accent`
`['#A8560A', '#f79a4a']`, `--color-on-accent` `['#FFFFFF', '#081310']` — per
**D020**, the owner ruling recorded for this change. The dark pair is the
production app's own `--accent` / `--accent-ink`, read from its deployed
stylesheet, not chosen here.

Three consequences ride with it, all inside D020's stated scope:

- **Competition badges move `orange` → `teal`.** Orange is now the brand accent,
  so an orange badge reads as *selected* rather than as a category. Teal is
  furthest from meeting-purple and outreach-blue and carries no DES-05 status
  meaning (red/green/yellow map to error/success/warning).
- **The accent progress bar gets its own vivid stop**, `light-dark(#6E3300, #f79a4a)`.
- **Email accent constants follow**, under the invariant `constants.ts` states
  for itself.

`theme.css` is regenerated via `npx astryx theme build`, not hand-patched.

## What the issue got wrong

**The issue's contrast table was measured against tokens this change moves.**
The row said so explicitly — *"that is an assumption, not a proof"* — and the
assumption was wrong on the first attempt. Re-seeding `color.accent` to orange
repaints every neutral, because `ColorScaleConfig.neutralStyle` bleeds the seed
hue into surfaces: `--color-background-card` `#FEFBFF → #FFFBF7`,
`--color-text-primary` `#1D1A21 → #211A16`, `--color-border-emphasized`
`#AFA9B7 → #B8A89F`.

That is wider than D020 authorises, and *warmer* than the production app being
matched, whose neutrals are cool blue-greys (`#111318` / `#181c24` / `#323a49`).
Reverted: the seed stays `#5B2EE5` and drives only the neutral ramp.
`defineTheme`'s own contract makes this correct — explicit `tokens` take
precedence, and every accent-derived token resolves through
`var(--color-accent)`. The `theme.css` diff is consequently exactly three lines.

**The progress bar's blue was already failing accessibility.** The issue framed
the `#0074e2` pin as an open question. Measured against its own track
(`--color-border-emphasized`), that blue scores **2.00:1 light / 2.03:1 dark** —
both under SC 1.4.11's 3:1, before this task touched anything. `neutralTheme`
chose it to match the filled `variant:info` badge. This PR fixes a pre-existing
failure rather than introducing a change of taste.

**The accent token had no test at all.** See Verification.

## Tier, stated and defended

**STANDARD.** Trigger: no write path, no schema, no RLS, no migration, no
signature another module imports — so not HEAVY.

The losing argument was FAST. It fails on two counts: the change repaints every
accent surface in the app, and DES-06 makes both-mode WCAG AA a real acceptance
criterion, which is more than FAST's "≤20 lines plus a named mutation" bar
contemplates. Item 26's own rule that file count is *not* a tier trigger cuts the
other way too — seven files did not make this HEAVY.

## Verification

```
GATE RUN — ecd62d6 on claude/gam-436-accent-tracker-orange — tree clean

  1 tsc                 exit 0  PASS
  2 vite build          exit 0  PASS
  3 format:check        exit 0  PASS
  4 eslint              exit 0  PASS       0 errors, 380 warnings
  5 vitest (full)       exit 0  PASS       101 files / 2588 tests  baseline 2588 (+0)
  6 vitest src/emails/  exit 0  PASS       7 files / 80 tests  baseline 80 (+0)

VERDICT: PASS — all six gates exit 0
```

Baseline measured directly at `origin/main` (`faab36c`): 101 files / 2588 tests.

### Mutations

| # | Mutation | Result | Verdict |
|---|---|---|---|
| 1 | competition badge `teal` → `orange` | 3 failed / 59 passed, 2 files | guarded |
| 2 | email `ACCENT_LIGHT` → `#5B2EE5` | 1 failed / 79 passed | guarded |
| 3 | `--color-accent` → `['#5B2EE5', '#9B7BFF']` | **2588 passed, 0 failed** | **UNGUARDED** |

Mutation 3 is the finding. The brand accent — the token the whole theme derives
from — could be changed or silently reverted by a bad merge with every gate
green. `theme.smoke.test.tsx` does not cover it: it asserts the app renders
without throwing, which is true of any accent.

`src/theme/accentTokens.test.ts` closes that. It pins the ruled values, pins the
progress bar's separate stop, asserts the neutral seed stayed put, and — the part
worth more than the rest — **enforces the email/theme mirror that `constants.ts`
previously stated only in prose**. Replaying mutation 3 against it now fails 2 of
6 tests.

### Contrast, re-measured from tokens read back out of the regenerated `theme.css`

| Pairing | Light | Dark | Needs |
|---|---|---|---|
| accent on card | 5.11:1 | 7.92:1 | 4.5 (AA) |
| accent on body | 4.63:1 | 8.73:1 | 4.5 (AA) |
| on-accent on accent | 5.25:1 | 8.71:1 | 4.5 (AA) |
| progress bar on track | 4.30:1 | 4.28:1 | 3.0 (SC 1.4.11) |

## Scope: what this does and does not close

Closes GAM-436 fully. No part of this surface reads from a fixture or stub —
these are theme tokens consumed by the real render path, so item 27 does not
apply.

**Depends on D020**, which lives in `docs/swarm/dispute-log.md` on GAM-435's
branch and is **not in this diff or in `main` yet**. A reviewer checking whether
this deviation from PRD DES-04 is authorised will not find the ruling in `main`
until GAM-435 merges. Sequencing, not a gap — but worth knowing before approving.

## Known gaps, disclosed

- **Not verified in a browser.** All contrast figures are computed from token
  values, not sampled from rendered pixels. The arithmetic is WCAG's own, but
  nobody has looked at the running app.
- **`--color-accent-muted`** derives via `color-mix()` from the accent and was
  not separately measured; it is a background tint, not a text or UI-component
  colour, so 1.4.3/1.4.11 do not bind it.
- **The light accent `#A8560A` is derived, not inherited.** Production ships no
  light mode. It is measured and clears AA with margin, but it is this repo's
  choice rather than production's.

Linear-Issue: GAM-436
