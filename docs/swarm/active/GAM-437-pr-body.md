Closes GAM-437

## What changed

The side nav's seven items now render a lucide icon each (always visible —
icon + label expanded, icon alone collapsed), and the label size goes from
14px to 16px via a new `.astryx-side-nav-item` theme override. `collapsible`
was already wired; a collapsed nav previously had nothing left to show.

## What the issue got wrong

`SideNavItem` **does** have a `size` prop (`'sm' | 'md' | 'lg'`), contrary to
the issue's claim that none exists. Verified against the installed
`@astryxdesign/core` package source and its compiled CSS: `size` only maps to
`height`/`padding-inline`, never `font-size`, so it doesn't help here — the
theme-level override the issue proposed is still the right DES-21 escalation
step, just for a narrower reason than stated.

Separately, the `defineTheme` component-style-map key is `'side-nav-item'`,
not the naively-lowercased `'sidenavitem'` the packet itself guessed from the
`progressbar` precedent — verified against the installed package's own
`SideNavItem.js` (`themeProps('side-nav-item', …)` call sites) before
committing, since that's what determines the real rendered
`.astryx-side-nav-item` class the generated CSS has to match.

## Tier, stated and defended

**STANDARD** (constitution item 26), as the issue itself was already
labeled: one component (`SideNavItem` usage in `SideNav.tsx`), one theme
override (`volt.ts` + regenerated `theme.css`), one new dependency
(`lucide-react`, already allowlisted per dispute-log D021), plus tests. No
write path, no schema/RLS/auth change, no signature another module imports.
One worker subagent, orchestrator replay of the diff and gates — no separate
checker round.

## Verification

```
GATE RUN — e105c03 on claude/gam-437-sidenav-icons — tree clean

  1 tsc                         exit 0  PASS
  2 vite build                  exit 0  PASS
  3 format:check                exit 0  PASS
  4 eslint                      exit 0  PASS       0 errors, 380 warnings
  5 vitest (full)               exit 0  PASS       102 files / 2598 tests  (no baseline given — regression not checked)
  6 vitest src/components/nav/  exit 0  PASS       4 files / 42 tests  (no baseline given — regression not checked)

VERDICT: PASS — all six gates exit 0
```

No literal pre-change baseline run (`gate-run` wasn't re-run at the merge
base), but the diff adds exactly 4 tests and removes none anywhere, so
2598/42 are each 4 above the pre-existing count.

Mutation table:

| Mutation | Result |
| -- | -- |
| Removed `icon={<item.icon aria-hidden="true" />}` from the `SideNavItem` call site | RED — 3 of the 4 new `SideNav.test.tsx` tests failed for the expected reason (`no lucide-house icon found…`, `expected undefined to be 'Home'`). Restored; suite back to 14/14 green. |

Real-browser check (constitution item 26's "a gate that only reads is worth
much less than one that runs", applied to accessibility rather than data
correctness): the issue explicitly flagged the collapsed-nav accessible-name
behavior as unverified — "read off the API surface, not something anyone has
watched happen." Verified via a new Playwright spec,
`tests/e2e-personas/gam-437-sidenav-icons.spec.ts`, driving the real
production bundle in a real Chromium against the persona harness
(`tests/e2e-harness/`), signed in as `admin@volt.test`. Asserts, via
`getByRole('link', { name })`, that all 7 items resolve by accessible name
both expanded and after clicking the nav's own built-in collapse toggle.
**1 passed.** Screenshots committed at
`tests/e2e-personas/screenshots/437-{expanded,collapsed}.png` — the collapsed
one shows all 7 distinct icons rendering with no overlap and the label gone,
exactly the target state.

One environment note, not a code defect: this sandbox's `vite preview`
listens on `[::1]` by default, not `127.0.0.1`, which the Playwright config's
`BASE_URL` targets — the harness's own `webServer` health check times out for
that reason. Worked around for this verification run by starting `vite
preview --host 127.0.0.1` manually first, so `reuseExistingServer: true`
picked it up; no harness file was changed. A future run in this same sandbox
will hit the same thing.

## Scope: what this does and does not close

Closes the surface named in the issue: all 7 side-nav items render a real
icon (expanded and collapsed), and the label reads at 16px. Does not touch
`TopNav`, `MobileNav`, or any other nav surface — out of scope per the issue.

## Follow-ups filed

None. Self-contained nav change; no fixture/stub surface introduced (item 27
does not apply — nothing here reads from a fixture on a real user path).

## Known gaps, disclosed

- `selectedIcon` goes unused: lucide is outline-only, so there is no filled
  variant to give it (disclosed divergence, recorded in dispute-log D021).
- Only the `admin` persona was checked live in-browser (all 7 items visible).
  The student/parent 5-item subset is exercised by the existing jsdom test
  (`does not render icons for staffOnly items to a non-staff (student)
  viewer`) but not by the live-browser spec.

Linear-Issue: GAM-437
