Closes GAM-271

The login card demanded 400px on every phone narrower than that, pushing the page sideways — **40px of horizontal overflow on a 320px iPhone SE**, 20px at 360, 13px at 375, 5px at 390. The `maxWidth="100%"` written to prevent exactly this did nothing.

Fixed in **one line**.

## Tier: STANDARD, stated and defended (item 26)

No write path or destructive operation, no schema/RLS/migration, no metric SQL, no auth/session/role logic — a layout prop on one presentational component. **Item 25's second obligation is the operative one here:** tier follows genuine complexity, not a topic that *sounds* sensitive, and "login" sounds sensitive. Item 18's four override triggers are all absent, so the worker ran on its pinned default.

Not FAST, because FAST's fifth condition is a named mutation that turns a **test** red, and jsdom performs no layout. The evidence is a browser measurement instead — so the tier goes up one, not down.

## What changed

```diff
-      <VStack gap={6} hAlign="center">
+      <VStack gap={6} hAlign="center" width="100%" maxWidth={400}>
```

Plus one comment above the `<Card>`. **The `<Card>` props line is unchanged.** Four insertions, one deletion, one file.

## Why the card's own `maxWidth="100%"` was inert

From the computed ancestor chain at 390px, not from reading CSS:

```
div.astryx-card    rect=400  css-width=400px  max-width=100%   <- the card
div.astryx-stack   rect=400  css-width=400px  max-width=none   <- sized BY the card
div.astryx-center  rect=390  css-width=390px  max-width=none   <- first real constraint
```

`100%` resolved against a box the card had just sized. Circular, therefore inert. `OutreachList.tsx:3611` records the same discovery independently.

## Measured, before and after

Real Chrome, real dev server, real provider stack. Every number paired with a presence check, because a measurement that reports only a number is not evidence — T325's prototype reported `overflow: 0` after silently deleting the buttons.

| viewport | 320 | 360 | 375 | 390 | 414 | 768 / 1280 / 1920 |
| -- | -- | -- | -- | -- | -- | -- |
| **overflow before** | 40px | 20px | 13px | 5px | 0px | 0px |
| **overflow after** | **0px** | **0px** | **0px** | **0px** | **0px** | **0px** |
| card rect before | 400 | 400 | 400 | 400 | 400 | 400 |
| card rect after | 320 | 360 | 375 | 390 | **400** | **400** |
| buttons / inputs | 3/2 | 3/2 | 3/2 | 3/2 | 3/2 | 3/2 |

Desktop is unchanged at every width. The reset-password panel — the card's other content state — behaves identically, and all three banner states were measured too.

## Two wrong fixes, both measured rather than argued away

**The issue's own suggestion is a regression.** It proposed `maxWidth={400}` + `width="100%"` on the **Card**, while warning "measure it, do not assume it." That warning earned its keep: applied, the overflow goes to 0 **and the card collapses to 247px at every viewport, including 414 and 1280**, where it is 400px today. `hAlign="center"` stops the stack stretching its children and the stack is itself shrink-to-fit, so both collapse to min-content. **The number improves while the screen gets worse** — T325's trap in a new costume, caught only because the rig records the card's rect beside the overflow figure.

**My own first prescription was twice the size it needed to be.** Revision 1 changed two lines and asserted both were load-bearing and separately measured. The premise gate showed line 272 alone is the whole fix, and I replayed that independently before adopting it.

## This does not reverse T072 — it switches T072's convention on

`verification-log.md:2095`/`:2220` name `LoginPage.tsx` as the exemplar of the `width={N}` + `maxWidth="100%"` pairing, and T072 changed `LiveConsole.tsx:1277` purely to conform to it. So an inverted pairing here would be a reversal of passed work under Definition of Ready item 5.

It is the opposite. The gate deleted the Card's `maxWidth="100%"` under this fix and **the overflow came straight back, 40 / 20 / 13 / 5 / 0**. After the change that prop is not preserved-but-inert, it is **the clamp** — line 272 supplies the percentage basis it never had. The pairing was never wrong; it simply cannot work under a shrink-to-fit parent, which is why it works at T072's site (a constrained `HStack wrap="wrap"`) and did not work here.

That is also why the comment is there: line 275 is now live code that reads as dead, and the next person to read this bug's title will want to delete it.

## No new test, and a guard that exists but was blind

**jsdom performs no layout**, so no unit test can see a 40px overflow or its return. A test asserting the rendered prop would be a guard in appearance only — the family this project keeps catching (T325's three vacuous candidates, T330, T401).

Instead, a real mutation against the **committed** fix (item 26's "commit before mutating"): reverting **only** the `VStack` props in a throwaway worktree, leaving the comment and Card untouched, restored the defect exactly — **40 / 20 / 13 / 5 / 0**.

A guard *is* possible, and it is filed rather than skipped: `tests/e2e/public-routes.spec.ts:62-73` already asserts no horizontal overflow on `/login` in a real browser and **stayed green through this entire bug**, because its narrowest project is Pixel 7 at 412px and the card was 400. See GAM-371.

## Premise gate: two rounds, and it changed the work twice

Round 1 **REVISE** (4 MAJOR / 4 MINOR / 1 NIT) → round 2 **DISPATCH** (2 MINOR / 4 NIT). Item 19a's two-round cap was not reached. **Three of the four MAJORs were my own unverified claims**, which is item 19c's predicted shape almost exactly:

1. "Both lines are load-bearing and each was measured without the other" — **false**, one line does everything.
2. "eslint baseline 0 errors / 364 warnings" — **quoted from `RESUME-HERE.md:110` rather than measured**. The true figure is **378**. `MACHINE-SETUP.md:112` says measure, do not quote.
3. "the Card-only form collapses with or without the stack change" — **false**; with the stack change it gives 0 overflow and a 400px card. Five words contradicting my own table twenty lines above.

Each correction is kept visible in the packet rather than edited away, because the correction is the evidence that the check happened.

## Gates

At `cf9c130`, `--require-clean`, run independently by the worker, the premise gate and the orchestrator, with matching figures:

`tsc` **0** · `vite build` **0** · `format:check` **0** · eslint **0 errors / 378 warnings — no rise** · vitest **95 files / 2443 tests** (baseline 2443, +0) · scoped `src/pages/login/` **9 tests** (baseline 9, +0). **All six pass.**

## Filed, not fixed here (item 20)

- **GAM-370** — the identical defect on three more full-screen cards. `/accept-invite` **measured at 40 / 20 / 13 / 5 / 0**; the two `no-access` pages are guard-rendered and recorded as reasoned rather than measured; `CheckinResult.tsx:740` uses `width={420}` and needs its own measurement.
- **GAM-371** — a narrow-viewport project for `public-routes.spec.ts`.
- **GAM-372** — the `layout-measurement` skill documents three environment facts that are all false in a dispatched container, and `scripts/measure.cjs` exits 2 there. Cross-linked to the pre-existing **GAM-350**, which shares the root cause and would not close it.
- **GAM-373** — re-measure T072's `LiveConsole.tsx:1277`.

## Note on the rig

Throwaway, in `/tmp`, nothing committed; `package.json` and `package-lock.json` are unmodified. The `layout-measurement` skill's documented setup does not work here — the working route was `playwright-core` installed outside the repo driving the system `/usr/bin/google-chrome`. The skill's own instruction to *"verify these rather than trusting them — they drift"* is what kept this run alive; see GAM-372.

---

Files: `src/pages/login/LoginPage.tsx` (+4 −1). Run log: `docs/swarm/active/GAM-271-run-log.md`. Packet (revision 3, gated): `docs/swarm/active/GAM-271-packet.md`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
