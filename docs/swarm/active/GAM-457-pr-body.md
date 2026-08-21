Closes GAM-457

## What changed

One file: `docs/swarm/2026-08-21-owner-session-record.md`, matching the 08-14 and
08-18 owner-session-record convention so the 2026-08-21 `/design` session's
context can be cleared without losing anything.

It carries the row state for the eight rows that session touched, the two owner
rulings now in force (**D020** accent, **D021** `lucide-react`) with D020's
easily-lost consequence recorded — competition badges moved `orange → teal`
because orange became the accent — the decisions still open, the traps the
session measured, and a section recording four things the session got wrong.

## Why it is urgent rather than merely tidy

Its `EPHEMERAL` section is only useful while the container it describes exists.
Two artifacts live only in the session scratchpad:

- **The canvas working files.** Recoverable, but by a route nobody would guess:
  re-run `/design`, then `seed-canvas.mjs --extract` against the published
  artifact. A later session that does not know this re-seeds from nothing.
- **The comparison screenshots.** Not recoverable.

## The traps worth more than the rows they came from

- The coach dashboard **does not scroll the document** — it scrolls inside an
  Astryx `Layout height="fill"` container, so `fullPage: true` silently captures
  the viewport only. Two candidate scroll containers; the obvious one is wrong.
- Playwright's pinned browser build is not the one installed (`1234` wanted,
  `1194` present). `playwright install` is the wrong fix.
- Re-seeding `defineTheme`'s `color.accent` repaints **every neutral** via
  `neutralStyle` hue bleed — the reason `volt.ts`'s seed stays violet.
- The accent progress bar carried a **pre-existing** SC 1.4.11 failure
  (2.00:1 / 2.03:1) before the session touched it.

## Tier, stated and defended

**FAST.** One documentation file, no source, no schema, no write path.

**Declared deviation:** item 26's FAST bar wants a named mutation that turns a
test red. A session record has no test to turn. Declared rather than relabelling
the row STANDARD to dodge the requirement — STANDARD would give a checker nothing
extra to act on either.

## Verification

Documentation only; prettier does not cover `*.md` and no source changed. Gates
were run on this tree at `9ef1a54`'s content and reported **5 of 6** — gate 6
skipped for want of a `src/` path to scope to, which is the correct outcome for a
docs-only diff, not a gap.

The record's own factual content was verified as it was written: row states were
**read from Linear at write time rather than recalled**, which is how it caught
that GAM-439 had moved to `In Progress` under another run.

## Scope

Closes GAM-457 fully. No user-visible surface, so item 27 does not apply.

## Known gaps, disclosed

- **The record pins `main` = `e1c49b8`.** That rots on the next merge. The file
  says so in its own header, matching `RESUME-HERE.md`'s convention.
- **The `EPHEMERAL` section describes a container that will not exist for long.**
  That is inherent to what it records, and the recovery route is written down
  precisely because the artifacts themselves are not.
- **§6's account of what the session got wrong is self-reported.** Nobody
  independently reviewed those four items.

Linear-Issue: GAM-457
