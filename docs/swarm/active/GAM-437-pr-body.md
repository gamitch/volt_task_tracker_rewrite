Closes GAM-437

## What changed

The side nav's seven items now render a lucide icon each (always visible —
icon + label expanded, icon alone collapsed), and the label size goes from
14px to 16px via a new `.astryx-side-nav-item` theme override. `collapsible`
was already wired; a collapsed nav previously had nothing left to show.

_Work in progress — this PR is opened as a draft while the worker packet is
in flight (constitution item 28 wall 3: the PR credential is time-boxed, so
this opens early and gets pushed into rather than opened once at the end)._

## What the issue got wrong

`SideNavItem` **does** have a `size` prop (`'sm' | 'md' | 'lg'`), contrary to
the issue's claim that none exists. Verified against the installed
`@astryxdesign/core` package source and its compiled CSS: `size` only maps to
`height`/`padding-inline`, never `font-size`, so it doesn't help here — the
theme-level override the issue proposed is still the right DES-21 escalation
step, just for a narrower reason than stated.

## Tier, stated and defended

**STANDARD** (constitution item 26), as the issue itself was already
labeled: one component (`SideNavItem` usage in `SideNav.tsx`), one theme
override (`volt.ts` + regenerated `theme.css`), one new dependency
(`lucide-react`, already allowlisted per dispute-log D021), plus tests. No
write path, no schema/RLS/auth change, no signature another module imports.
One worker subagent, orchestrator replay of the diff and gates — no separate
checker round.

## Verification

_Pending — gates will be pasted here once the worker's diff lands._

## Scope: what this does and does not close

_Pending._

## Follow-ups filed

None expected — this is a self-contained nav change.

## Known gaps, disclosed

- `selectedIcon` goes unused: lucide is outline-only, so there is no filled
  variant to give it (disclosed divergence, recorded in dispute-log D021).
- The collapsed-nav accessible-name behavior (does `label` still name the
  item when only the icon renders?) has not been watched in a real browser
  as of this draft — the issue itself flags this as unverified, and it will
  be checked before this PR leaves draft.

Linear-Issue: GAM-437
