# GAM-271 (T507) — worker packet

**Revision 3 — GATED, verdict DISPATCH** (constitution item 19). The gate ran
the full two rounds item 19a allows: round 1 returned REVISE with 4 MAJOR / 4
MINOR / 1 NIT, round 2 returned DISPATCH with 2 MINOR / 4 NIT, all of which are
folded in here. Every finding is addressed where it lands, and the corrections
are kept visible rather than edited away — the correction is the evidence that
the check happened.

**The two findings that changed the work:**

1. **Revision 1 prescribed two lines and only one of them did anything.** I had
   claimed both were load-bearing and measured. That was false; the gate showed
   line 272 alone is the whole fix, and I replayed it independently before
   adopting it.
2. **The Card prop I had written off as inert is in fact the clamp.** Round 2
   deleted it under the one-line fix and the overflow came straight back. See
   the T072 section — this reverses the framing, not the decision.

**Tier: STANDARD** (constitution item 26). No write path, no schema/RLS/migration,
no auth/session/role logic — this is a layout prop on one presentational module,
and item 25 forbids bumping the tier because the *word* "login" sounds sensitive.
No exported signature changes. **One changed line.** Not FAST, because FAST's
fifth condition — a named mutation that turns a test red — cannot be satisfied:
jsdom performs no layout, so no unit test in this repo can see this defect.

**Allowed Files — exactly one:**

- `src/pages/login/LoginPage.tsx`

Nothing else. Explicitly **not** `.github/workflows/**` (a dispatched run cannot
push those — `AGENTS.md` § "Two walls"), not `docs/swarm/**`, not `.claude/**`,
not the test file, and **not the three sibling pages carrying the same defect** —
those are follow-ups, listed at the bottom, not scope creep for this row.

---

## The defect, measured

`LoginPage.tsx:275` renders `<Card width={400} maxWidth="100%" …>`. The
defensive `maxWidth` does nothing, so the card demands 400px on phones narrower
than that and pushes the page sideways.

Measured in real Chrome against the real dev server, **presence-checked at every
width** (3 buttons, 2 inputs — so this is genuine overflow, not T325's
deleted-content artifact). Reproduced independently by the premise gate:

| viewport | 320 | 360 | 375 | 390 | 414+ |
| -- | -- | -- | -- | -- | -- |
| horizontal overflow | 40px | 20px | 13px | 5px | 0px |

**Mechanism, from the computed ancestor chain at 390 rather than from reading
CSS** (one zero-width wrapper `div` between the centre and its parent is elided
for readability — gate NIT 9):

```
div.astryx-card    rect=400  css-width=400px  max-width=100%   <- the card
div.astryx-stack   rect=400  css-width=400px  max-width=none   <- sized BY the card
div.astryx-center  rect=390  css-width=390px  max-width=none   <- first real constraint
```

`100%` resolves against the stack, and the stack is shrink-to-fit around the
card that just demanded 400px. The constraint is circular, so it is a no-op.

The repository had already measured this exact mechanism once:
`src/pages/outreach/OutreachList.tsx:3611` records `maxWidth="100%"` producing
"NO change, because 100% resolved against that same unconstrained parent"
(gate finding 8).

---

## The prescription — ONE line, verified by running it

Make exactly this edit, at **line 272**:

```diff
-      <VStack gap={6} hAlign="center">
+      <VStack gap={6} hAlign="center" width="100%" maxWidth={400}>
```

**Line 275 is not touched.** The `Card` keeps `width={400} maxWidth="100%"`
exactly as it is today.

`Stack.width` and `Stack.maxWidth` are both `SizeValue`, "numbers are treated as
pixels, strings are used as-is" (`docs/swarm/astryx-api.md`, Stack prop table
§374-396). Constitution item 2 is satisfied — neither prop is absent from that
file, and the gate confirmed this independently.

**In-repo precedent, so this is a rollout of a settled pattern rather than a
novel call** (item 19b, gate finding 8): `src/components/forms/EventFormLayout.tsx:123`,
`src/pages/calendar/CalendarPage.tsx:752` and `src/pages/home/CoachHome.tsx:2385`
all already use `VStack width="100%" maxWidth={N}` — and none of them puts a
`maxWidth` on the child.

### Why one line and not two — a correction, kept rather than deleted

Revision 1 also rewrote the Card to `width="100%" maxWidth={400}` and asserted
"both lines are load-bearing and each was measured without the other."
**That was false.** The gate measured line 272 alone and got results identical
to the two-line form in every cell, across all five phone widths, three desktop
widths, the reset panel and all three banner states. I replayed it myself in a
separate worktree before accepting it:

| | 320 | 360 | 375 | 390 | 414 | 768/1280/1920 |
| -- | -- | -- | -- | -- | -- | -- |
| overflow | 0 | 0 | 0 | 0 | 0 | 0 |
| card rect | 320 | 360 | 375 | 390 | **400** | **400** |

**One line is therefore not a shortcut — it is the whole fix**, and the second
line was decoration I would have shipped without the gate.

### The reason this matters beyond brevity: T072

`verification-log.md:2095` and `:2220` record `width={N}` + `maxWidth="100%"` as
"the exact `width`+`maxWidth` pairing already established elsewhere in the
codebase", naming **`LoginPage.tsx` as the exemplar**; passed task T072 changed
`LiveConsole.tsx:1277` purely to conform to it. Revision 1 inverted that pattern
on the exemplar file itself and said nothing about it, which Definition of Ready
item 5 would have required as an explicit, authorized reversal.

**The one-line fix does not merely preserve the pairing — it switches it on, and
the Card's `maxWidth="100%"` becomes load-bearing.** The gate proved this by
deleting that prop under the one-line fix: **the overflow returns in full, 40 /
20 / 13 / 5 / 0**, with the stack correctly capped at 320 but the card still
demanding 400 and escaping it. So line 272 supplies a real percentage basis and
`maxWidth="100%"` is the clamp that actually produces the 320/360/375/390 card.
Nothing is reversed and no waiver is owed.

The pairing was never wrong; it simply cannot work while the parent is
shrink-to-fit. T072's own patch site corroborates this from the other end:
`LiveConsole.tsx:1277` sits inside `HStack gap={6} wrap="wrap"` in a page-level
layout — a genuinely constrained parent — which is why the pairing works there
and was inert here.

**Consequence for the worker: `LoginPage.tsx:275` is now live code that looks
dead.** Anyone who reads this issue's title and then reads line 275 will be
tempted to delete a prop that is carrying the fix. Criterion 1a below requires a
one-line comment to prevent exactly that.

### What NOT to do

Do **not** "fix" this by putting `width="100%"` on the `Card` **instead of** the
stack change. Measured: overflow goes to 0 **and the card collapses to 247px at
every viewport, including 414 and 1280**, where it is 400px today — because
`hAlign="center"` stops the stack stretching its children and the stack is
itself shrink-to-fit, so both collapse to min-content. **The overflow number
improves while the screen gets worse**, which is T325's trap in a new costume.

*(Revision 2 of this packet said "with or without the stack change" here. The
gate measured that and it is false — with the stack change, the Card-only form
gives 0 overflow and a 400px card at 414/1280. The claim is corrected rather
than deleted, because the correction is the evidence that the check happened.)*

---

## How to measure — the repo's documented instrument is dead in this container

**Read this before attempting criteria 2-5** (gate MAJOR 3). The route the
`layout-measurement` skill documents does not exist here:

- `node .claude/skills/layout-measurement/scripts/measure.cjs …` **exits 2**.
- `/opt/node22/lib/node_modules` — **absent**. `/opt/pw-browsers` — **absent**.
- `playwright` is **not** in `node_modules` and **not** in `package.json`.

The working route, and it is a deliberate tooling escalation rather than an
undocumented hack:

```bash
mkdir -p /tmp/rig && cd /tmp/rig && npm init -y && npm i playwright-core
# then, in a .cjs harness:
chromium.launch({ executablePath: '/usr/bin/google-chrome' })   # Chrome 151 is installed
```

Install `playwright-core` **outside the repository**. It must not reach
`package.json` or `package-lock.json` — the dependency allowlist (item 9) is not
being amended by this task.

Working rigs may already exist in this container and take a URL argument:
`/tmp/pwrig/measure-login.cjs <url>` (five phone widths + ancestor chain),
`/tmp/pwrig/measure-wide.cjs <url>` (768/1280/1920),
`/tmp/pwrig/measure-reset.cjs <url>` (the reset panel). **Reuse them if present;
if `/tmp/pwrig` is not there, build your own from the install route above** —
the gate verified that route works from an empty directory. Do not assume you
inherit another process's `/tmp`.

Start the dev server with `npx vite --port <free port>`.

---

## Acceptance criteria

1. `src/pages/login/LoginPage.tsx:272` reads exactly as prescribed above.
   **The `<Card …>` line itself is unchanged** — its props keep reading
   `width={400} maxWidth="100%" padding={6} variant="default"`.
1a. **One comment line is added directly above the `<Card>`**, and it is the
   only other permitted change in the file. It exists because the gate proved
   that prop is load-bearing and looks dead. Use exactly:

   ```tsx
   {/* maxWidth="100%" is the clamp that keeps this card inside narrow
       viewports -- it works only because the VStack above sets an explicit
       width. Do not remove either half. Measured, GAM-271. */}
   ```

   No other line of the file changes.
2. **Zero horizontal overflow at 320 / 360 / 375 / 390 / 414**, measured in a
   real browser. jsdom cannot see this; do not claim it from a unit test.
3. **The card still measures 400px at 414, 768, 1280 and 1920.** This criterion
   exists specifically to catch the 247px collapse described above, and the gate
   verified that it does: under the Card-only variant criterion 2 passes while
   criterion 3 fails. A run reporting criterion 2 green without this one is not
   evidence.
4. **Presence, paired with every number:** 3 buttons and 2 inputs on the login
   panel at each width. A measurement that only reports a number is not
   evidence — the T325 prototype reported `overflow: 0` after silently deleting
   the buttons.
5. The "Forgot password" reset panel — the card's other content state — shows
   the same result: 0 overflow at 320/390, 400px card at 414/1280, with its
   `Reset your password` heading and email input present.
6. All six gates pass with no new failures and **no rise in the eslint warning
   count. The baseline is 0 errors / 378 warnings** — measured on this branch
   point in three independent trees, not quoted. **Do not trust the "364" figure
   in `docs/swarm/RESUME-HERE.md:110`; it is from 2026-08-04 and is stale by 14.**
   `docs/swarm/MACHINE-SETUP.md:112` says measure rather than quote, which
   revision 1 of this packet failed to do (gate MAJOR 1).
7. No new test is added. See below — this is deliberate, and narrower than
   revision 1 claimed.

## No new test here, and precisely why

**jsdom performs no layout**, so it cannot see a 40px overflow and cannot see it
come back. A unit test asserting the rendered prop would be a test that looks
like a guard and is not — the family this project keeps catching (T325's three
vacuous candidates, T330's `?? ''` sentinel, T401).

**But "no guard is possible anywhere" would be false, and revision 1 implied it**
(gate MINOR 7). `tests/e2e/public-routes.spec.ts:62-73` **already** asserts
`scrollWidth <= clientWidth + 1` on `/login` in a real browser. It is blind to
this defect only because its narrowest project is Pixel 7 at **412px**, and
400 < 412. A narrow-viewport project there would be a genuine, non-vacuous
regression guard, and it provably reddens pre-fix (at 320: scrollWidth 360 vs
clientWidth 320).

It cannot be executed in this container — the `playwright` package the e2e suite
needs is not installed — so it is **deferred and filed**, not silently skipped.
See the follow-ups below (item 20: a comment is not triage).

## Least confident decisions

Not required at STANDARD (item 19d binds HEAVY); kept because round 1 showed it
earning its keep — the gate found #1 and #3 partly wrong.

1. **Leaving the Card's `width={400} maxWidth="100%"` untouched.** Revision 2
   defended this as keeping harmless-but-inert defensive code. **The gate showed
   that framing was wrong in my favour:** the prop is not inert after the fix,
   it is the clamp — remove it and 40 / 20 / 13 / 5 / 0 comes straight back. The
   decision stands and its justification got stronger. The residual doubt is now
   only whether criterion 1a's comment is the right guard, or whether the pair
   should be made structurally inseparable somehow. Wrong if a reviewer thinks a
   comment is too weak a guard for a prop this load-bearing.
2. *(Closed, not a doubt — kept for the record.)* `width="100%"` on the VStack
   changes it from shrink-to-fit to fill. Measured twice, once per round: the
   sibling `<Heading level={1}>VOLT</Heading>` is `w=66` with identical `left`
   (127/162/174/607 at 320/390/414/1280) before and after. `Center` was already
   the centring agent. **Settled.**
3. *(Closed by round 2.)* Content-state coverage. Revision 1 claimed two states
   were measured; the gate showed the reset rig opens the panel at
   `resetStatus === 'idle'` so **no banner state was actually covered**, and
   that the sign-in `formError` Banner (`LoginPage.tsx:332-339`) is in the
   sign-in branch, not the reset form. The gate measured all three
   (`signin-error`, `reset-error`, `reset-sent`): baseline 40/20/5/0/0, fixed 0
   at 320/360/390/414/1280, banner present in all. It then enumerated the render
   tree — exactly five conditionals (276, 284, 293, 332, and the two `TextInput
   status` props at 349-351/361-365) — and confirmed **there is no fourth
   structural branch**. My conclusion held; my stated evidence for it had not.
4. **400 is retained as the design width.** Treated as intent, not questioned.
   Wrong if the owner would rather the card grow past 400 on desktop — but that
   is a design change, not this bug fix. **Still open, and the only genuinely
   open one left.**

## Evidence the worker must return

- The commit SHA the change landed in (item 21 — "clean" and "committed" are
  different claims).
- The measurement table, before and after, at all five phone widths plus at
  least one desktop width, each number paired with its presence counts.
- Exit codes for the six gates, with the eslint warning count against 378.
- Confirmation that the rig was deleted, that nothing from it was committed, and
  that `package.json` / `package-lock.json` are unmodified.

## Follow-ups this task defers rather than absorbs (item 20)

Filed as Linear issues by the orchestrator, not left as comments:

- **The same defect on three sibling pages**, byte-identical
  `Center > VStack hAlign="center" > Card width={400} maxWidth="100%"`:
  `AcceptInvitePage.tsx:653-657` (**gate-measured**: 40 / 13 / 5 / 0 at
  320 / 375 / 390 / 412), `AccessDeniedPage.tsx:86-90`,
  `NoAccessPage.tsx:309-313`. Plus `CheckinResult.tsx:740`, which uses
  `width={420}` and so should overflow even at Pixel 7's 412 — **that one is
  reasoned from the identical shell shape, NOT measured**: `/checkin` is
  auth-gated and redirects to `/login` in this environment, so the follow-up
  must measure it rather than inherit the claim.
- **A narrow-viewport project for `tests/e2e/public-routes.spec.ts`**, which
  would convert this measurement into a real regression guard.
- **Re-measure T072's own `LiveConsole.tsx:1277`.** A source read says its
  parent is a genuinely constrained `HStack wrap="wrap"`, so its pairing is
  probably real — but this packet now asserts the pairing is inert under
  shrink-to-fit parents, and the one site that was changed *because of* that
  convention has never actually been measured.
- **The `layout-measurement` skill's environment facts are stale**, which cost
  this run a detour and would stop a run that trusted them.
