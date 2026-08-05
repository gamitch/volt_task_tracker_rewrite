---
name: layout-measurement
description: Measure real layout in a real browser — overflow, wrapping, element widths, responsive breakpoints — instead of reasoning about CSS from source. Use whenever a task concerns how something renders at a given viewport, whether content overflows or collapses, why a flex or grid child will not shrink, or any claim a jsdom test cannot see. Also use before believing a source-read diagnosis of a visual bug, and before shipping a "fix" for one.
---

# Layout measurement

**jsdom performs no layout.** Every element has zero width, nothing wraps, nothing
overflows. So the entire class of responsive and overflow bugs is invisible to
this repo's 2000-test suite, and a unit test cannot be the evidence for one.

The counter-measure is a throwaway Playwright rig against the real dev server and
the real provider stack. **17 task entries** in `docs/swarm/verification-log.md`
record one.

## The rule that makes this worth doing

**Measure before diagnosing, and measure again after fixing.** Reading CSS to
work out which element overflows is guessing. On T325 the source strongly implied
a `SegmentedControl` was the culprit; measurement showed it was the design
system's `endContent` slot wrapper, `flex-shrink: 0` at 563px inside a 342px row.
The guess was wrong and would have produced a fix for a non-problem.

## Running it

`scripts/measure.cjs` starts nothing and assumes nothing — point it at a running
dev server and a selector:

```bash
npm run dev &                     # or vite preview
node .claude/skills/layout-measurement/scripts/measure.cjs \
  --url http://localhost:5173/outreach \
  --width 390 --height 844 \
  --expect-present "button:has-text('Mark attendance')" \
  --report-overflow
```

It prints `scrollWidth` vs `clientWidth`, the widest offending element with its
computed `flex-shrink` / `max-width`, and the count of every `--expect-present`
selector.

## The trap that invalidates a measurement

**A layout measurement that checks only the number is not evidence.**

On T325 the first prototype reported *"overflow: 0"* — because it had silently
deleted the buttons. Removing the thing that overflows does eliminate the
overflow. It was caught only because the same run also asserted the buttons were
still present.

So every measurement pairs a **number** with a **presence check**. That is what
`--expect-present` is for; use it every time, and give it the elements the fix
could plausibly destroy.

## Environment facts, current as of 2026-08

Verify these rather than trusting them — they drift:

- Playwright is installed **globally**, not in `node_modules`. Set
  `NODE_PATH=/opt/node22/lib/node_modules`.
- **The harness must be CommonJS.** ESM ignores `NODE_PATH`, so an `.mjs` rig
  cannot resolve `playwright` and fails confusingly. Use `.cjs`.
- Chromium lives under `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`. Do not run
  `playwright install`.
- The rig must inject the page's real data seams. For outreach pages that means
  `defaultLoadOutreachData` **and** a `resolveStudentId` stub pointing at a
  student who actually has fixture data — otherwise the rig measures an empty
  page and reports a comfortable, meaningless zero.

`scripts/measure.cjs` sets the first three itself.

## Afterwards

**Delete the rig and say so.** Nothing from it is committed — it is an
instrument, not a test. Record in the verification log what you measured, the
before and after numbers, and that the rig was removed. That convention comes
from T131/T142 and keeps a one-off harness from ossifying into a fixture nobody
maintains.

## When a measurement cannot become a regression test

It usually cannot, and that is worth stating plainly rather than papering over.
jsdom will not catch a re-regression, so a unit test written to "cover" a layout
fix tends to be vacuous. On T325 three candidate tests were attempted and all
three were measured vacuous or redundant; the task shipped with none, and the
measurement was the evidence.

If you find yourself writing a test that asserts DOM structure as a proxy for
layout, check whether reverting the fix actually reddens it. If it does not, do
not ship it — see the `mutation-replay` skill.
