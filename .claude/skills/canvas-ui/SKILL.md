---
name: canvas-ui
description: Evaluate or integrate Canvas UI (canvasui.dev) WebGL and html-in-canvas effect components — Liquid, Glass, Shatter, Particle Reveal, Asciify, and ~40 others. Use whenever a task proposes a Canvas UI component, asks for a shader/WebGL/canvas visual effect over real HTML, or reaches for `npx shadcn add @canvas-ui/...`. Read this before installing anything, because the advertised install path does not work in this repo and the library trips a BLOCKER-level stack lock.
---

# Canvas UI

Canvas UI ships ~40 GPU visual effects that render *over* live HTML — WebGL
shaders and the experimental html-in-canvas API — so the content underneath stays
real, selectable DOM. Every component ships in six framework flavours (React,
Solid, Preact, Vue, Svelte, vanilla TS) and installs as source into your tree via
a shadcn registry. Docs: <https://canvasui.dev/docs>.

It is a well-built library. **In this repo it is blocked by default, and the
install command on its docs page cannot succeed as written.** Both facts are load-
bearing; do not skip to the integration section.

## The gate comes first

Constitution item 8 (Stack locks):

> Vite + React 19 + TypeScript strict + Supabase. **No Tailwind, no shadcn, no
> alternate UI/CSS libraries** (PRD D2/D3) → BLOCKER.

Canvas UI is distributed *by* shadcn and *is* an alternate UI library. It sits on
both halves of that clause. Item 9's dependency allowlist does not cover it
either.

So the answer to "can I add a Canvas UI component?" is **no, until a boss-architect
ruling says otherwise and that ruling is recorded in the ledger**. This is not an
agent's judgment call, and "it's only one component" is not an exception — item 8
is a BLOCKER, the most severe class in `docs/swarm/constitution.md`.

The precedent for a legitimate override is dispute-log **D002** (React 19 against
the PRD's React 18): a named deviation, human-authorized, evidence recorded, PRD
text deliberately left unedited. Anything less than that shape is a violation.

Before opening that dispute, answer the question a boss-architect will ask first:
what does PRD DES-21's escalation order (component → theme token → xstyle → custom
CSS) fail to deliver here? A decorative effect that no requirement asks for is not
a reason to breach a stack lock.

## Why the documented install fails here

Verified against this tree, not assumed:

```
npx shadcn@latest add @canvas-ui/liquid-react   # does not work here
```

- **No `components.json`.** The registry mapping the docs give you
  (`{"registries": {"@canvas-ui": "https://canvasui.dev/r/{name}.json"}}`) has
  nowhere to live. There is no such file at the repo root.
- **No Tailwind.** Not in `package.json`, not in `vite.config.ts`, not in
  `index.html`. The generated components assume Tailwind utility classes.
- **No `@/` path alias.** `tsconfig.json` declares no `paths`, and
  `vite.config.ts` declares no `resolve.alias`. Every emitted
  `import { Liquid } from "@/components/canvasui/Liquid"` fails to resolve.

Creating `components.json` to make the CLI work *is itself* the item 8 violation,
so do not do it as a workaround. If a ruling ever approves a component, take the
**manual** path: copy the React variant's source from its docs page into
`src/components/`, rewrite the import to a relative path, and strip the Tailwind
classes down to `src/theme/theme.css` tokens.

## Three traps if it is ever approved

**1. Half the library needs a Chrome flag.** The html-in-canvas components require
`chrome://flags/#canvas-draw-element`. In production that means registering a
Chrome origin trial for the domain. A volunteer-team portal on shared family
devices will not have that flag set — those components render nothing for most
real users. WebGL-only components (Liquid, Glass, Shatter) do not carry this
constraint; check which class a component is on before proposing it.

**2. The E2E suite cannot catch that failure.** `playwright.config.ts` runs four
projects — `desktop-light`, `desktop-dark`, `mobile-light`, `mobile-dark` — all on
Chromium (`Desktop Chrome`, `Pixel 7`). A Canvas UI component can pass every E2E
project and still be blank in Safari and Firefox. A green Playwright run is not
evidence of cross-browser support here. Use the `layout-measurement` skill against
a real page instead of trusting the suite.

**3. Accessibility is a shipping requirement, not a nice-to-have.** Constitution
item 15 makes PRD DES-17 / NFR-07 failures a BLOCKER. Canvas UI states it respects
reduced-motion, but that is the vendor's claim about the vendor's code — verify it
on the actual component, and confirm the DOM underneath keeps its focus order and
contrast with the effect painted on top. Item 17 also bars attention-grabbing
mechanics aimed at engagement; a decorative shader on a page minors use should be
justified by a requirement, not by taste.

## License

The site states **MIT + Commons Clause**: free to use personally and commercially,
but resale and redistribution are prohibited. That is not plain MIT. Vendoring
component source into this repo is a licensing decision as well as an
architectural one, and it belongs in the same ledger record as the item 8 ruling.

## What to do instead, most of the time

Reach for Astryx first — `docs/swarm/astryx-api.md` is the only legitimate source
for its props (item 2; a prop absent from that file is presumed hallucinated →
MAJOR). `Skeleton` covers shaped loading, `Spinner` covers unknown-dimension
loading. For a visual effect with no Astryx equivalent, DES-21's last step —
custom CSS against `src/theme/theme.css` tokens — clears the stack lock without a
dispute, and a CSS animation respects `prefers-reduced-motion` with one media
query.

## Provenance

Summarized from <https://canvasui.dev> and <https://canvasui.dev/docs> (fetched
2026-08-09). No Canvas UI source is vendored into this repo. The repo-side claims
above — missing `components.json`, no Tailwind, no path alias, Chromium-only
Playwright projects — were each checked against this tree and should be re-checked
before being cited as evidence in a packet.
