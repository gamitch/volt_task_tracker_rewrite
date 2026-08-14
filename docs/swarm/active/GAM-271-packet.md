# GAM-271 (T507) — worker packet

**Tier: STANDARD** (constitution item 26). No write path, no schema/RLS/migration,
no auth/session/role logic — this is a layout prop on one presentational module,
and item 25 forbids bumping the tier because the *word* "login" sounds sensitive.
No exported signature changes. Four changed tokens on two lines. Not FAST,
because FAST's fifth condition — a named mutation that turns a test red — cannot
be satisfied: jsdom performs no layout, so no unit test can see this defect.

**Allowed Files — exactly one:**

- `src/pages/login/LoginPage.tsx`

Nothing else. Explicitly **not** `.github/workflows/**` (a dispatched run cannot
push those — `AGENTS.md` § "Two walls"), not `docs/swarm/**`, not `.claude/**`,
not the test file.

---

## The defect, measured

`LoginPage.tsx:275` renders `<Card width={400} maxWidth="100%" …>`. The
defensive `maxWidth` does nothing, so the card demands 400px on phones narrower
than that and pushes the page sideways.

Measured in real Chrome against the real dev server, **presence-checked at every
width** (3 buttons, 2 inputs — so this is genuine overflow, not T325's
deleted-content artifact):

| viewport | 320 | 360 | 375 | 390 | 414+ |
| -- | -- | -- | -- | -- | -- |
| horizontal overflow | 40px | 20px | 13px | 5px | 0px |

**Mechanism, from the computed ancestor chain at 390 rather than from reading
CSS:**

```
div.astryx-card    rect=400  css-width=400px  max-width=100%   <- the card
div.astryx-stack   rect=400  css-width=400px  max-width=none   <- sized BY the card
div.astryx-center  rect=390  css-width=390px  max-width=none   <- first real constraint
```

`100%` resolves against the stack, and the stack is shrink-to-fit around the
card that just demanded 400px. The constraint is circular, so it is a no-op.

---

## The prescription — verified by running it, not by reading it

Make exactly these two edits.

**Line 272:**

```diff
-      <VStack gap={6} hAlign="center">
+      <VStack gap={6} hAlign="center" width="100%" maxWidth={400}>
```

**Line 275:**

```diff
-        <Card width={400} maxWidth="100%" padding={6} variant="default">
+        <Card width="100%" maxWidth={400} padding={6} variant="default">
```

Both props are legal on both components: `Stack.width` / `Stack.maxWidth` and
`Card.width` / `Card.maxWidth` are all `SizeValue`, "numbers are treated as
pixels, strings are used as-is" (`docs/swarm/astryx-api.md`, Stack and Card prop
tables). Constitution item 2 is satisfied — no prop here is absent from that
file.

### Why the cap must sit on the VStack, and not on the Card alone

**The issue's own suggested direction was tried first and is a regression.**
Applying `width="100%" maxWidth={400}` to the **Card only** does zero the
overflow — and collapses the card to **247px at every viewport, including 414
and 1280**, where it is 400px today. `hAlign="center"` means the stack does not
stretch its children, and the stack is itself shrink-to-fit, so card and stack
collapse together to min-content. **The overflow number improves while the
screen gets worse** — T325's trap in a new costume. Constraining the stack is
what gives `100%` something real to resolve against.

Do not "simplify" this by dropping either half. Both lines are load-bearing and
each was measured without the other.

---

## Acceptance criteria

1. `src/pages/login/LoginPage.tsx:272` and `:275` read exactly as prescribed
   above; no other line of the file changes.
2. **Zero horizontal overflow at 320 / 360 / 375 / 390 / 414**, measured in a
   real browser. jsdom cannot see this; do not claim it from a unit test.
3. **The card still measures 400px at 414, 768, 1280 and 1920.** This criterion
   exists specifically to catch the collapse described above. A run reporting
   criterion 2 green without this one is not evidence.
4. **Presence, paired with every number:** 3 buttons and 2 inputs on the login
   panel at each width. A measurement that only reports a number is not
   evidence — the T325 prototype reported `overflow: 0` after silently deleting
   the buttons.
5. The "Forgot password" reset panel — the card's other content state — shows
   the same result: 0 overflow at 320/390, 400px card at 414/1280, with its
   `Reset your password` heading and email input present.
6. All six gates pass with no new failures and **no rise in the eslint warning
   count** (the standing baseline is 0 errors / 364 warnings).
7. No new test is added. See below — this is deliberate.

## No regression test, and that is the honest call rather than an omission

**jsdom performs no layout**, so it cannot see a 40px overflow and cannot see it
come back. A test asserting `width="100%"` appears in the rendered props would
be a test that looks like a guard and is not — the exact family this project
keeps catching (T325's three vacuous candidates, T330's `?? ''` sentinel, T401).
The evidence for this task is the before/after measurement table, stated as
such. If you believe you have found a non-vacuous test, prove it with
`mutation-replay` — revert the fix and show the test actually reddens — before
adding it.

## Least confident decisions

Not required at STANDARD (item 19d binds HEAVY packets), included because it is
free and the gate attacks it first.

1. **Keeping `maxWidth={400}` on the Card when the VStack already caps at 400.**
   It is redundant in the measured layout. I kept it as self-documenting belt
   and braces. Wrong if the reviewer holds that a redundant prop is worse than a
   fragile one-place cap — this is a genuine style call, not a measurement.
2. **`width="100%"` on the VStack changes the stack from shrink-to-fit to
   fill.** The `Heading level={1}>VOLT` above the card is also its child. It
   stays centred under `hAlign="center"` and measured identically, but I checked
   this visually via the rect chain rather than by screenshot diff. Wrong if
   something depends on the stack hugging its content.
3. **Only two content states of this card exist and I measured both.** Wrong if
   a third branch (an error banner state, a Google-auth-disabled build) renders
   materially wider content. I read the file for branches and found `sent` and
   `error` banners *inside* the reset form, already covered by the reset-panel
   measurement.
4. **400 is retained as the design width.** I treated it as intent and did not
   question it. Wrong if the owner would rather the card grow past 400 on
   desktop — but that would be a design change, not this bug fix.

## Evidence the worker must return

- The commit SHA the change landed in (item 21 — "clean" and "committed" are
  different claims).
- The measurement table, before and after, at all five phone widths plus at
  least one desktop width, each number paired with its presence counts.
- Exit codes for the six gates.
- Confirmation that the rig was deleted and nothing from it committed.
