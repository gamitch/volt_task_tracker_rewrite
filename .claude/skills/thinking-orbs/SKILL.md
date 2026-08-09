---
name: thinking-orbs
description: Evaluate or integrate the `thinking-orbs` npm package — dotted canvas loading indicators for AI/agent UIs, nine animated states at two sizes. Use whenever a task proposes an animated "thinking", "working", or "searching" indicator, reaches for `npm install thinking-orbs`, or asks how the orb should behave with this repo's dark mode, reduced-motion, or jsdom tests. Read before installing: it needs an allowlist ruling, and it breaks naively-written vitest tests.
---

# Thinking orbs

`thinking-orbs` renders nine hand-tuned loading animations — `working`,
`searching`, `solving`, `listening`, `connecting`, `weaving`, `composing`,
`breathing`, `shaping` — on a plain 2D canvas. No WebGL, no CSS filters, no
runtime dependencies, React `>=18` as the only peer. Repo:
<https://github.com/Jakubantalik/thinking-orbs> (MIT, © 2026 Jakub Antalik).
Demo: <https://orbs.jakubantalik.com>.

Unlike Canvas UI, this does not trip the item 8 stack lock — it is one npm
component, not a UI system, and it ships no CSS framework. It trips **item 9**
instead.

## The gate

Constitution item 9 lists the allowed dependencies: `@astryxdesign/*`,
`@supabase/supabase-js`, `@tanstack/react-query`, `react-router-dom`,
`qrcode.react`, `ical-generator`, plus dev tooling. `thinking-orbs` is not on it,
so it needs **boss-architect approval recorded in the ledger** before
`npm install`.

Item 11 sets the question that approval turns on: *UI is built from Astryx
components.* Astryx already ships two loading affordances, documented in
`docs/swarm/astryx-api.md`:

- **`Skeleton`** — shaped shimmer for content whose dimensions you know, with an
  `index` prop for staggered waves.
- **`Spinner`** — for content with unknown dimensions. Astryx's own guidance says
  pick one loading pattern per area, never both.

An approval request that cannot say why `Skeleton` and `Spinner` both fail will
not survive review. The honest case for the orb is narrow: a long-running *agent*
surface where the animation names the verb the system is doing
(`state="searching"` vs `state="solving"`), which a generic spinner cannot
express. That is a real distinction; it is also not something the VOLT portal
currently has.

Whatever you do, item 12 still stands — loading is one of four required states,
and swapping the indicator does not discharge the empty and error states.

## API, if approved

```bash
npm install thinking-orbs
```

```tsx
import { ThinkingOrb } from 'thinking-orbs';

<ThinkingOrb state="searching" size={64} theme="auto" />;
```

- `size` is typed `64 | 20`, not `number`. They are two separate designs with
  their own dot counts and speed tuning, not one design scaled — `size={48}` is a
  type error, and TypeScript strict will catch it at `npm run typecheck`.
- `speed` multiplies the preset's baked speed; `paused` freezes the current frame.
- All other `<canvas>` props pass through (`className`, `style`, `data-*`).

## Theming already matches this repo — by luck, verify it anyway

`theme="auto"` (the default) resolves in three layers, live: an ancestor
`data-theme="dark|light"` attribute or `dark`/`light` class, then
`prefers-color-scheme`, watched via `MutationObserver` and a `matchMedia`
listener.

That happens to line up exactly with how this app already drives dark mode. The
attribute is set by Astryx's `Theme`, which `src/App.tsx` renders inside
`ThemedShell` with a `mode` resolved by `src/app/ThemeModeProvider.tsx` (T148):

- explicit modes put `data-theme="dark"` / `data-theme="light"` on `<html>`
  (asserted in `src/App.test.tsx:98` and `:110`), which layer 1 picks up;
- `system` mode leaves the attribute **absent** (asserted at `src/App.test.tsx:121`
  and `:132`), which correctly falls through to layer 2.

So `theme="auto"` is the right prop here and pinning `theme="dark"` would be a
bug — it would ignore the owner's Settings choice. Confirm this by measuring
rather than by trusting this paragraph: the `layout-measurement` skill drives a
real browser, and the four `playwright.config.ts` projects already cover
light/dark on desktop and mobile.

## The jsdom trap

This is where a task will lose an hour if nobody warns it.

**Canvas does not exist in jsdom.** `HTMLCanvasElement.prototype.getContext` is
unimplemented, so mounting `<ThinkingOrb>` in a vitest test throws or yields a
null context. Any test that renders a component containing an orb needs a
`getContext` stub in that test file.

**Do not put the stub in `src/test-setup.ts`.** That file says so itself: *"This
file is intentionally narrow — a single guarded polyfill, not a general mock
dumping ground. Do not add other global mocks here."* Stub it locally, in the
test that needs it.

**The shared `matchMedia` polyfill always returns `matches: false`.**
`src/test-setup.ts` installs it for jsdom. That means, in every vitest run:

- `prefers-color-scheme: dark` reads false → the orb resolves **light** whenever
  no ancestor `data-theme` is set;
- `prefers-reduced-motion: reduce` reads false → the orb takes the **animating**
  path, which is the path that needs canvas.

Both are silent. A test asserting "the orb renders dark" passes or fails for
reasons that have nothing to do with your change.

**Assert the accessible surface, not pixels.** The component ships `role="img"`
with a per-state `aria-label`, so `getByRole('img', { name: ... })` is a real
assertion that survives in jsdom. Canvas output is not observable there at all,
and a test that claims to check the animation is checking nothing — the exact
failure mode the `mutation-replay` skill exists to catch. Name the mutation that
would break your assertion before you write it.

## Accessibility

Out of the box: `role="img"`, a per-state default `aria-label`, a static
representative frame under `prefers-reduced-motion: reduce`, `IntersectionObserver`
pausing offscreen, pausing on hidden tabs, and DPR capped at 2. That is more than
most spinners do, and it lines up with item 15 / PRD DES-17.

Two things it does not do for you. Override `aria-label` with something the user
can act on — "Loading your sessions", not the default verb — because the state
names are the system's vocabulary, not a student's. And an indefinitely-spinning
orb is still a broken loading state under item 12; a slow load needs an error or
empty state behind it, exactly as Astryx's own `Skeleton` guidance says.

## Provenance

Summarized from the upstream README, `src/types.ts`, and `src/theme.ts` at
<https://github.com/Jakubantalik/thinking-orbs> (read 2026-08-09, package version
0.2.0). No upstream source is vendored here. The repo-side claims — the
`data-theme` assertions in `src/App.test.tsx`, the `matchMedia` polyfill in
`src/test-setup.ts`, and Astryx's `Skeleton`/`Spinner` guidance in
`docs/swarm/astryx-api.md` — were each checked against this tree, and should be
re-checked before being cited as evidence in a packet.
