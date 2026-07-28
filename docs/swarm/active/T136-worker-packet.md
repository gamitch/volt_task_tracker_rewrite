# Worker Packet: T136 — semantic colour tokens + the shared progress bar (UXC-05 foundation, UXC-08)

Wave 5, packet W5-P5. Runs after T135. **Scoped deliberately narrower than the
PRD's W5-P4 line** — see "Scope" below.

## FIRST — merge the working branch

Your worktree is created from `main`, not from the branch this work lives on.
Before anything else:

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```

Report the result. **If it conflicts, stop and report** rather than resolving.

## Scope — and what was deliberately left out

The PRD bundles UXC-05 (colour system), UXC-06 (layout composition) and UXC-08
(goal bar) into one packet. That is three unrelated areas, a new shared
component, and a reversal of a passed task whose defect the human owner reported
live. **This packet builds and proves the primitives; T137 rolls them out.**

**In scope here:**
1. Semantic colour tokens in `src/theme/volt.ts`.
2. One shared custom progress-bar component (F-3's pre-approved escalation).
3. UXC-08: the outreach goal strip becomes a real bar, using that component.

**Deferred to T137 — do not do these:** per-team hues, type-badge hue variants,
dashboard module pairing (UXC-06), leaderboard bars, student/parent home colour.
Building the tokens without consumers is the point: T130 proved the `Table` on
one surface before T132/T133 rolled it out, and that sequencing is why those
rollouts were cheap.

## 1. Semantic tokens in `volt.ts`

`src/theme/volt.ts` is **27 lines** and defines only `--color-accent` and
`--color-on-accent`. There is no semantic colour system; UXC-05 needs one built,
not extended.

Add tokens for the two meanings this wave actually needs, each as a
`[light, dark]` pair in the existing `tokens` block:

- **confirmed** — hours actually logged. Green family.
- **planned** — hours committed but not yet logged. Purple family.

Both must reach **WCAG AA contrast against the bar track in both themes**, and
you must report the measured ratios, not assert them. `D005` in the dispute log
is the precedent for why: an earlier accent pairing measured 4.04:1 and had to
be re-pinned.

Do **not** invent tokens for things this packet does not use. Per-team hues and
badge variants are T137's, and unused tokens are indistinguishable from wrong
ones until someone consumes them.

## 2. The shared bar component

**F-3 pre-authorizes exactly this and nothing more** (`VOLT_UX_Craft_PRD_v3.md`,
Feasibility constraints): Astryx's `ProgressBar` has one scalar `value` and one
fill div, and its own documentation forbids stacked bars. The architect ruling
is that **one small custom bar — track, one or two fills, optional ticks — is
approved under DES-21's final rung for UXC-05 and UXC-08 only.** Presentation
only, no metric math, one shared module, contrast verified in both themes.

Create it as a single component (suggested `src/components/GoalBar.tsx`,
alongside the shared `StatCell.tsx` that T131's wave extracted). Requirements:

- Renders a **two-tone** fill: confirmed (green) and planned (purple), where
  planned continues from where confirmed ends against a shared max.
- Renders an optional **goal tick** at a given fraction.
- Takes already-computed numbers as props. **It performs no arithmetic beyond
  turning a value into a percentage width.** Constitution item 3 and PRD DATA-01
  are absolute here: metric formulas live only in SQL views, and a bar that
  computes hours is a BLOCKER.
- Carries `role="progressbar"` with `aria-valuenow`/`aria-valuemin`/
  `aria-valuemax`/`aria-valuetext`. See §3 — this is the crux.

## 3. UXC-08 — the goal strip, and the passed task it reverses

**Read this whole section before writing any code.**

`GoalProgressBar` (`OutreachList.tsx:1803`) currently renders **zero** bars. Its
module doc (`:71-79`) records why: George **live-reported** that the previous
implementation showed two stacked bars layered under a third and fourth
redundant "Team season goal" text repetition — "exactly UXD-05's own named
anti-example". T121 fixed it by removing the bars entirely and shipping tiles.

That fix is pinned by `OutreachList.test.tsx:1328-1347`, and the load-bearing
line is `:1343`:

```js
expect(container.querySelectorAll('[role="progressbar"]').length).toBe(0);
```

So: **you cannot add an accessible bar without amending that assertion.** And
you cannot dodge it by omitting `role="progressbar"` — that would trade a failing
test for an inaccessible control, and constitution item 15 makes accessibility a
shipping requirement, not a preference.

**Authorized resolution.** UXC-08's own text requires the disclosure ("Must
disclose it reverses T121 and … exactly ONE bar"). Amend `:1343` from `toBe(0)`
to `toBe(1)` and rename the test to say what it now guards. **The rest of that
test must survive unchanged** — in particular:

- `:1337-1342` — exactly **one** `Team season goal` heading element. The
  duplicated-concept half of UXD-05 is not reversed and must keep passing.
- `:1346-1347` — `'9 hrs confirmed'` and `'7 hrs planned'` still render.

**Exactly one bar.** Not one per metric, not a confirmed bar beside a planned
bar. The original defect was two stacked bars; shipping two again reproduces the
exact thing the human owner reported. Two *fills* inside one track is the
requirement.

**Do not touch the milestone toasts.** `BEH-01` (`:1349` onwards) asserts
milestone toast copy at 25% and 50%. That system is `motivation-ethics` sensitive
(constitution item 17: honest progress signals only, no streaks or urgency) and
is out of scope. If your change alters when a toast fires, you have changed
metric behaviour — stop and report.

*(Citation note: `VOLT_UX_Craft_PRD_v3.md` cites this test as
`OutreachList.test.tsx:1279-1298`. That is **stale** — that range is now T121's
edit-dialog test. The real range is `:1328-1347`, verified.)*

## Allowed Files

- `src/theme/volt.ts`
- `src/components/GoalBar.tsx` + `GoalBar.test.tsx` (new)
- `src/pages/outreach/OutreachList.tsx` — **only** `GoalProgressBar`
  (`:1803` onwards) and its module-doc paragraph at `:71-79`
- `src/pages/outreach/OutreachList.test.tsx` — **only** the assertions named in
  §3
- `src/theme/theme.css` — only if a token needs a CSS surface; disclose why
- `docs/swarm/active/T136-worker-output.md` (create)
- New `.webp` figures under `docs/swarm/figures/ux-craft/`

## Forbidden Files

- `src/pages/home/**`, `src/pages/outreach/Leaderboard.tsx`,
  `src/pages/roster/**` — T137's rollout surfaces.
- Everything in `OutreachList.tsx` outside `GoalProgressBar` — the coach
  `Table` (T131), the student/parent rows (T132) and the shared hook all passed
  recently. If your change requires touching them, stop and report.
- `src/pages/meetings/**` — T135 may still be in flight.
- `supabase/**` — no metric may move into or out of SQL.
- `docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`,
  `dispute-log.md`, `.claude/**`.

## Traps

1. **The bar must not compute anything.** `GoalProgressBar`'s doc at `:1298`
   notes `goalHours` is "never a displayed metric itself, only a `ProgressBar`
   `max`". Keep that property: pass confirmed, planned and goal in, render
   widths out. Any hours arithmetic inside the component is a BLOCKER
   (constitution item 3, PRD DATA-01).
2. **One bar, two fills.** See §3. Two `<div role="progressbar">` elements on
   that page fails `:1343` even after you amend it to `toBe(1)` — which is
   exactly the guard you want.
3. **`ProgressBar` is still the right choice elsewhere.** This custom component
   is authorized for the *goal strip* only. Do not replace Astryx's
   `ProgressBar` where it already ships correctly (`CoachHome.tsx`'s `KpiCard`).
   F-3's approval is scoped to UXC-05 and UXC-08.
4. **Contrast is measured, not asserted.** Report ratios for confirmed-on-track
   and planned-on-track in **both** themes. `D005` exists because a
   plausible-looking pairing measured 4.04:1.
5. **The milestone toasts are motivation-ethics territory.** Do not adjust
   thresholds, copy, or firing conditions.
6. Do not certify your own work.

## Acceptance Criteria

1. `volt.ts` defines confirmed and planned tokens as `[light, dark]` pairs, and
   nothing unused.
2. **Measured contrast ratios reported** for both fills against the track, in
   both themes, each ≥4.5:1. State the method.
3. `GoalBar` is one shared module, renders one track with up to two fills and an
   optional goal tick, and contains **no arithmetic beyond percentage width**.
4. The outreach page renders **exactly one** `role="progressbar"`, with valid
   `aria-valuenow`/`min`/`max` and a human-readable `aria-valuetext`.
5. `OutreachList.test.tsx:1343` amended `toBe(0)` → `toBe(1)` and the test
   renamed to describe what it now guards. `:1337-1342` (one heading) and
   `:1346-1347` (both hour figures) pass **unchanged**.
6. `BEH-01`'s milestone assertions (`:1349` onwards) pass unchanged.
7. **Captures at 1440px and 375px, light and dark**, as `.webp` — the bar is a
   colour deliverable, so dark theme is not optional here.
8. Keyboard and screen-reader path unaffected: the bar is not focusable (it is a
   status indicator, not a control) but is announced.
9. `npx tsc --noEmit`, `npx eslint .`, `npx vite build`,
   `npm run format:check` clean.
10. `npx vitest run` green. Baseline after your merge is **1440 across 62
    files** — confirm that is what you start from and say so if not. You are
    **adding** a test file, so report the expected end count explicitly
    (baseline + your new `GoalBar` tests). The only permitted change to an
    *existing* test is the single assertion named in §3. Any other existing test
    that changes is a regression — report it, don't silence it. Zero
    `.skip`/`.only`/`.todo`.

## Relevant Constitution Excerpt

- Item 3 — metric SQL and RLS come only from PRD 8.4; duplicating a metric
  formula in TypeScript is a **BLOCKER**. This is the rule most at risk here.
- Item 11 — DES-21 escalation ladder. The custom bar is F-3's pre-approved
  final-rung escalation for this requirement only; `xstyle` does not work in
  this app (F-2).
- Item 15 — accessibility is a shipping requirement. This is why the bar carries
  `role="progressbar"` even though that costs a test amendment.
- Item 17 — motivation ethics. Honest progress signals only. A goal bar is
  factual; do not add urgency, streak, or scarcity framing around it.
- Non-Negotiables — existing tests pass unless explicitly approved; no worker
  self-certifies.

## Required Worker Output

`docs/swarm/active/T136-worker-output.md`:

- The token values chosen and **measured** contrast ratios, both themes, with
  the method used.
- The bar's props and a statement of what arithmetic it does (should be:
  percentage width only).
- Rendered proof that exactly one `role="progressbar"` exists on the page, with
  its ARIA values.
- The exact test line amended, before/after, and confirmation that the other
  assertions in that test and in `BEH-01` pass untouched.
- Test count started from and ended with, with the delta accounted for.
- Paths of the four captures.
- Full output of the commands in criteria 9–10.
- Anything unverified, stated plainly as unverified.

Use a throwaway rig for measurement and capture (`*.throwaway.*` is gitignored
**and excluded from vitest collection**, so it cannot affect your counts;
Chromium at `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; `LoginAs` from
`src/test-utils/authHarness.tsx:131`). **Delete it before finishing.**
