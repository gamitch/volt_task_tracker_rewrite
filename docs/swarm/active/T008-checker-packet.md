# Checker Packet: T008 (MobileNav drawer + Student Home live-card slot) — Check Attempt 1
## (D004-amended scope — not the original T008 worker packet)

## Task ID
T008 — MobileNav drawer (NAV-05) + Student Home live-card slot placeholder

## Checker Agent
checker-accessibility (per task-ledger.md T008 row)

## Attempt
Check attempt 1 of 3 (max 3 before mandatory boss-arbiter escalation per constitution "Loop
Limit"). No checker verdict has been rendered on T008 yet — the task escalated mid-attempt-1
(worker self-report, no checker involvement) directly to boss-arbiter as dispute D004
(`docs/swarm/dispute-log.md`). T008's attempt counter stays at 1 per D004 Ruling D ("worker is not
at fault and no FAIL is recorded"). This check therefore covers the **entire** T008 deliverable
(MobileNav.tsx, StudentHomeSlot.tsx, AppShell.tsx, TopNav.tsx) as it now stands post-D004-fix, not
a narrow re-check of only the disputed piece — nothing here has been checker-verified before.

## Required Reading Before You Start (do not skip)
1. `docs/swarm/dispute-log.md` D004 in full — the ruling this fix implements. Rulings A–D are the
   authoritative scope; do not re-litigate the underlying spec-defect finding itself (that the
   ReactNode shorthand is broken in the installed library) — that has already been independently
   re-verified twice (worker, then boss-arbiter against the installed source). Your job is to
   verify the **fix was implemented correctly** and to **independently re-derive the mechanism
   yourself** (item 1 below), not to re-litigate whether D004's diagnosis was right.
2. `docs/swarm/active/T008-worker-packet.md` — the original packet (attempt 1's mandate). Useful
   for the parts of scope D004 did NOT touch: `StudentHomeSlot.tsx`, and all of MobileNav.tsx's own
   internal logic (item-list duplication, `as={Link}`, badge slot, keyboard/DES-17 criteria) which
   D004 did not require any change to.

## What Changed Since the Original Packet (do not trust this summary — verify independently)
Per D004 Rulings A–C, the worker's rework (already applied, per the orchestrating session's report
— treat as unverified narration until you inspect the files yourself):
1. `src/app/AppShell.tsx`: `mobileNav={<MobileNav />}` → `mobileNav={{ content: <MobileNav /> }}`
   (the `MobileNavConfig` object form), plus a module-doc update citing D004.
2. `src/components/nav/TopNav.tsx`: **reverted** — `MobileNavToggle` removed from the
   `@astryxdesign/core` import list, `startContent={<MobileNavToggle />}` removed from the
   `<AstryxTopNav>` JSX call. Claimed to be back to exact T006-Passed state (T006-Passed state was
   independently re-confirmed byte-unchanged by T007's checker on 2026-07-18 — see Section 3
   below for the reference baseline).
3. `src/components/nav/MobileNav.tsx`: doc-comment only — the "KNOWN BLOCKER" block rewritten to
   describe the resolved wiring, citing D004. Component logic/JSX (the actual `AstyrxMobileNav`
   call, `SideNavItem`/`SideNavSection`/`Badge` usage, `as={Link}`, the `document.title` effect,
   `NAV_ITEMS`) claimed unchanged from attempt 1.
4. `src/pages/home/StudentHomeSlot.tsx`: claimed untouched since attempt 1 (D004 did not touch this
   deliverable at all).

**None of the above is evidence. Read every file yourself, independently.**

---

## 1. Independently Re-Derive the Astryx Mechanism — Do Not Trust D004's or the Worker's Citations

D004 and astryx-api.md's own D004 annotation (both quoted below for your reference only — treat
as a hypothesis to verify, not ground truth) claim the installed `@astryxdesign/core@0.1.6` source
shows:
- `AppShell.tsx` (installed source) computes `mobileNavEnabled = !mobileNavDisabled && hasNavContent
  && mobileNavReactNode == null` — i.e. passing `mobileNav` as a raw `ReactNode` sets
  `mobileNavReactNode` non-null and permanently disables `mobileNavEnabled`.
- `MobileNavToggle.tsx` returns `null` when `!isMobileNavEnabled`.
- The `MobileNavConfig` object form (`{ content: <MobileNav /> }`) keeps `mobileNavReactNode ==
  null` (since the prop value is now an object, not a ReactNode directly), so `mobileNavEnabled`
  stays true, and `content` is rendered as custom drawer content while suppressing Astryx's own
  auto-generated drawer.
- Below the `breakpoint` (default `'md'` = 768px), `AppShell` puts `TopNav` into a "mobile-bar"
  render mode that renders only `heading` + `endContent` + an auto-injected `MobileNavToggle` —
  `startContent`/`centerContent` are dropped entirely in that mode, which is why the original
  packet's `TopNav.tsx` edit (`startContent={<MobileNavToggle />}`) was dead code and had to be
  reverted, not amended.

**Read the actual installed source yourself and re-derive this from scratch:**
- `node_modules/@astryxdesign/core/src/AppShell/AppShell.tsx` — confirmed present at this exact
  path (foreman spot-checked before writing this packet via `grep -l mobileNavEnabled` across
  `node_modules/@astryxdesign/core/src`, which matched this file). Find the `mobileNavEnabled`
  computation, the `mobileNavReactNode` derivation (how AppShell distinguishes "prop is a raw
  ReactNode" vs. "prop is a `MobileNavConfig` object" — read the actual type-narrowing/detection
  logic, e.g. `isValidElement` or similar), and the mobile-bar TopNav render branch (what it
  actually renders below breakpoint — confirm `startContent`/`centerContent` really are dropped,
  don't take D004's line-number citations (539–540, 606–607, 647) as correct without reading them
  yourself — the file may have been touched by other installs/changes since D004 was written,
  though foreman has no reason to believe so).
- Find and read the actual `MobileNavConfig` TypeScript interface/type definition in the installed
  package (D004 cites lines 131–174 of the same file for this — verify independently) — confirm the
  real field list (`hasToggle`, `isOpen`, `onOpenChange`, `content`, `breakpoint`,
  `defaultIsMobile`) and their actual types/defaults match what astryx-api.md's D004 annotation
  claims (quoted below).
- Find and read `MobileNavToggle`'s actual source (D004 cites a `MobileNavToggle.tsx` line 73
  `return null` under `!isMobileNavEnabled` — locate and verify this yourself; it may live in a
  different file in your installed version, e.g. co-located within `AppShell.tsx` or a sibling
  file — search, don't assume the path).
- Cross-check against `docs/swarm/astryx-api.md` lines 2583–2612 (AppShell Props table + the D004
  VOLT annotation immediately after it) and lines 4713–4718 (MobileNav section + its shorter D004
  cross-reference note) — both reproduced below for convenience only; re-open the real file and
  confirm the line numbers and content still match (the file may have shifted since this packet was
  written).

**astryx-api.md D004 annotation (AppShell section, after the Props table, lines ~2597–2612) —
reference only, re-read the real file:**
```
> **[VOLT project annotation — D004 (docs/swarm/dispute-log.md), boss-arbiter, 2026-07-18. Verified
> against the installed `@astryxdesign/core@0.1.6` shipped source
> (`node_modules/@astryxdesign/core/src/AppShell/AppShell.tsx`), not vendor prose. The vendor text
> above is left unmodified.]**
>
> The `mobileNav` row above is incomplete, and the ReactNode example above
> (`mobileNav={<MobileNav title="Menu">...</MobileNav>}`) is **non-functional when combined with
> `MobileNavToggle`** in v0.1.6. The installed source computes `mobileNavEnabled =
> !mobileNavDisabled && hasNavContent && mobileNavReactNode == null` — the ReactNode shorthand is a
> "you own everything" escape hatch that disables AppShell's context state entirely:
> `MobileNavToggle` renders `null` and `openMobileNav()`/`toggleMobileNav()` become no-ops. With the
> shorthand you must manage `isOpen`/`onOpenChange` and your own trigger manually.
>
> To keep AppShell's context-managed open state with custom drawer content, use the
> **`MobileNavConfig` object form**. Verified v0.1.6 fields (source: `interface MobileNavConfig`):
>
> | Field | Type | Default | Description (verified from source) |
> |------|------|---------|-----------------------------------|
> | `hasToggle` | `boolean` | `true` | Auto-render the hamburger toggle. When `false`, place
>   `<MobileNavToggle />` yourself. Caveat: below the breakpoint, TopNav renders in "mobile-bar"
>   mode, which renders only `heading` + `endContent` + the auto toggle —
>   `startContent`/`centerContent` are NOT rendered there. |
> | `isOpen` | `boolean` | — | Controlled open state. |
> | `onOpenChange` | `(isOpen: boolean) => void` | — | Open-state change callback. |
> | `content` | `ReactNode` | — | Custom drawer content; replaces the auto-generated drawer.
>   Context-managed when `isOpen` is not supplied on the inner `MobileNav`. |
> | `breakpoint` | `'sm' \| 'md' \| 'lg' \| 'none'` | `'md'` | Breakpoint below which mobile nav
>   activates (`sm`=640px, `md`=768px, `lg`=1024px). |
> | `defaultIsMobile` | `boolean` | `false` | SSR hint seeding the initial breakpoint state. |
>
> **Sanctioned usage for this project** (per D004): `mobileNav={{ content: <MobileNav
> header="...">...</MobileNav> }}` — the drawer opens via the toggle Astryx TopNav auto-injects in
> mobile-bar mode below the breakpoint.
```

**Your job:** produce your own independent prop/mechanism table from the real source, state
explicitly whether it matches the above (confirm or refute each field/behavior claim), and only
then evaluate whether `AppShell.tsx`'s actual `mobileNav={{ content: <MobileNav /> }}` usage is
correct given what you found — not given what D004 said.

---

## 2. `TopNav.tsx` — Byte-Identity to T006-Passed State (diff against real history, not "looks unchanged")

**Reference baseline** (independently confirmed twice already — T006's own checker attempt 1
passed this file with zero findings on 2026-07-18, and T007's checker attempt 2 independently
re-confirmed it byte-unchanged via `git log`/direct re-read on the same date, quoted verbatim into
`docs/swarm/archive/T007-checker-packet.md`'s reference section). Reproduced here for your
convenience only — **do not treat this as ground truth; find the real historical commit yourself**:

```tsx
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Avatar,
  DropdownMenu,
  Selector,
  TopNav as AstryxTopNav,
  TopNavHeading,
  type SelectorOptionType,
} from '@astryxdesign/core';
import { routePaths } from '../../app/router';
import { useAuth } from '../../app/guards';

const PLACEHOLDER_SEASON_OPTIONS: SelectorOptionType[] = [
  { value: '2025-2026', label: '2025-2026 Season (placeholder active season)' },
  { value: '2024-2025', label: '2024-2025 Season (placeholder)' },
];
const PLACEHOLDER_ACTIVE_SEASON = '2025-2026';

export function TopNav(): ReactNode {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [seasonValue, setSeasonValue] = useState(PLACEHOLDER_ACTIVE_SEASON);
  const isSeasonSelectorVisible = user?.role === 'admin' || user?.role === 'coach';
  const handleSignOut = () => {
    logout();
    navigate(routePaths.login, { replace: true });
  };
  return (
    <AstryxTopNav
      label="Main navigation"
      heading={<TopNavHeading heading="VOLT" headingHref={routePaths.dashboard} />}
      endContent={
        user ? (
          <>
            {isSeasonSelectorVisible ? (
              <Selector label="Season" isLabelHidden options={PLACEHOLDER_SEASON_OPTIONS}
                value={seasonValue} onChange={setSeasonValue} size="sm" />
            ) : null}
            <DropdownMenu hasChevron={false}
              button={{ label: `Account menu for ${user.email}`, icon: <Avatar name={user.email} size="small" />, isIconOnly: true }}
              items={[
                { label: 'Profile', onClick: () => navigate('/settings#profile') },
                { label: 'Appearance', onClick: () => navigate('/settings#appearance') },
                { label: 'Sign out', onClick: handleSignOut },
              ]}
            />
          </>
        ) : null
      }
    />
  );
}
```

**Do this yourself, do not skip the actual diff:**
1. Run `git log --follow --oneline -- src/components/nav/TopNav.tsx` (or equivalent) to find every
   commit that has touched this file. Identify the commit corresponding to T006's Passed state
   (before T008's attempt-1 edit ever landed) — note the note above that T007's checker
   independently re-confirmed this file byte-unchanged as of T007's close-out (2026-07-18), so the
   relevant historical commit is whichever one T007's checker resolved to, not necessarily T006's
   very first commit if intermediate no-op commits exist.
2. Diff the CURRENT `src/components/nav/TopNav.tsx` content against that historical commit's
   content directly (`git show <commit>:src/components/nav/TopNav.tsx` piped to `diff` against the
   current file, or equivalent). Confirm zero diff — byte-identical, not "looks the same."
3. Explicitly confirm the specific things attempt-1's now-reverted edit added are fully absent:
   `MobileNavToggle` is not in the `@astryxdesign/core` import list, and no `startContent` prop
   exists anywhere on the `<AstryxTopNav>` JSX call.
4. Per the standing D001 rule (constitution/state-summary.md), do not use git history/commit
   authorship to infer *who* made a change or to make any per-agent attribution claim — this step
   is purely a content-history lookup to establish a verified historical baseline for a byte
   comparison, which is a different, permitted use (T007's checker used exactly this method to
   confirm TopNav.tsx's unchanged status — see `docs/swarm/verification-log.md` T007 attempt-2
   entry, "D001-method forbidden-file check: confirmed via git log/direct re-read...").

---

## 3. `MobileNav.tsx` — Component Logic Byte-Identity to Attempt 1 (only the doc comment should differ)

There is no separate "attempt 1" checker-verified snapshot of this file to diff against (attempt 1
never reached a checker — it went straight to dispute). You must instead verify internal
consistency: read the current file and confirm every functional/behavioral element the original
T008 worker packet mandated is still present and unchanged in substance, changing only in
surrounding prose:
- `AstryxMobileNav` is called with `header="Navigation"` (or the worker's originally-disclosed
  header choice) and children only — still no `isOpen`/`onOpenChange` passed (per the doc's
  context-managed-inside-AppShell rule, still correct under the new object-form wiring — confirm
  this reasoning still holds given your own Section 1 findings, not just because the file says so).
- `SideNavItem`s: `as={Link}` present on every item (T007's proven fix, applied from the start per
  the original packet's explicit instruction) — confirm literally, in the JSX, for every item.
- `NAV_ITEMS` array: same 7-item table (Home/Meetings/Outreach/Calendar/Roster/Reports/Settings),
  same `staffOnly` flags, same `routePaths` references.
- `isStaffRole` check: `user?.role === 'admin' || user?.role === 'coach'` (K2 workaround, same as
  SideNav/TopNav).
- Active-item matching logic: exact match for Home, prefix match otherwise.
- `document.title` `useEffect`: present, keyed off `activeItem`.
- Outreach `Badge`: `variant="neutral"`, `endContent` slot, placeholder count `0`.
- Confirm the ONLY substantive change vs. what the original packet mandated is the module doc-
  comment content (the "KNOWN BLOCKER" section rewritten to a "D004 resolution" section). If you
  find ANY change to the component's actual logic/JSX beyond documentation, flag it explicitly —
  it would be undisclosed scope creep even if it happens to be harmless.

---

## 4. Live Playwright Verification — Real Dev Server, Real Chromium, Real `/login` Sign-In

Do not trust the worker's screenshots or narration. Build your own live verification:
1. Start the real dev server. Sign in through the real `/login` page (lands on `'staff'` role per
   `src/pages/login/LoginPage.tsx`'s `PLACEHOLDER_SIGN_IN_ROLE`).
2. **Below 768px** (e.g. 375px viewport): confirm exactly ONE toggle button exists in the DOM that
   functions as the mobile-nav trigger — this should be Astryx TopNav's own auto-injected
   `MobileNavToggle` inside the mobile-bar render mode (not a project-authored one; confirm there is
   no second, project-added toggle anywhere, e.g. no leftover `startContent` toggle). Confirm its
   accessible label (default `'Open navigation'` per astryx-api.md, unless the worker disclosed a
   custom one — check).
3. **At/above 768px**: confirm ZERO toggle buttons exist in the DOM.
4. Click/tap/keyboard-activate the toggle: confirm exactly ONE drawer/dialog opens (not two — this
   is the key regression risk of the object-form fix: confirm Astryx's own auto-generated drawer is
   genuinely suppressed and only your `MobileNav` content renders, no duplicated nav-item lists).
5. Close paths, independently verified: Escape key, backdrop click, and an explicit close button (if
   one is rendered) each close the drawer on their own — test each independently, don't assume one
   implies the others work.
6. Keyboard walkthrough in both light and dark mode: Tab reaches the toggle, Enter/Space opens it,
   Tab moves through drawer items in order, every interactive element (toggle, each nav item, close
   button if present) has a visible focus indicator in both modes. **DES-17 — BLOCKER-class if any
   keyboard path is broken or focus isn't visible**, per constitution item 15.
7. `document.title` parity: click/activate the real (now-functional) toggle, navigate to at least
   two different drawer nav items, confirm `document.title` updates correctly on each (read the real
   `document.title` value in your session, not source-code narration).
8. **Zero full-page reloads on drawer nav-item clicks** (T007's `as={Link}` fix must still hold in
   this new component): for each drawer nav-item click, confirm no full navigation/reload event
   fires. Use `performance.getEntriesByType('navigation').length` (should stay at 1 across multiple
   in-drawer navigations) or Playwright's `page.on('load')` listener (should NOT fire on in-drawer
   clicks) — pick one method, apply it consistently, and also confirm the session survives (still
   signed in, not bounced to `/login`) after each drawer nav click.
9. **At >=768px**, confirm TopNav renders identically to T006's Passed behavior — no visible
   toggle, no layout shift, same heading/endContent/season-selector/user-menu behavior as T006's
   already-verified state (see the reference `TopNav.tsx` content in Section 2 — cross-check
   rendered output against that known-good source, not just "looks fine").

---

## 5. `StudentHomeSlot.tsx` — Confirm Untouched, Isolated, Correctly Inert

Current content (foreman has already read this file; reproduced below for reference only — re-read
the real file yourself):

```tsx
export interface StudentHomeSlotProps {
  hasLiveSession?: boolean;
}

export function StudentHomeSlot({ hasLiveSession = false }: StudentHomeSlotProps): ReactNode {
  if (!hasLiveSession) {
    return null;
  }
  return (
    <Card variant="default" padding={4}>
      Check-in card placeholder — reserved for MTG-10 live check-in UI (built in T054)
    </Card>
  );
}
```

Verify directly:
1. Renders `null` when `hasLiveSession` is `false` or omitted (test both cases in a self-contained,
   self-deleted scratch render harness — same pattern prior checkers have used; declare the
   harness's purpose in a header comment, then delete it and confirm deletion via `ls`/`find`).
2. Renders a clearly-labeled, explicitly non-final placeholder (`Card` with the "reserved for
   MTG-10... built in T054" copy) when `hasLiveSession` is `true`.
3. `Card` props used (`variant="default"`, `padding={4}`, `children`) are genuine per
   `docs/swarm/astryx-api.md`'s Card Props table — re-check the actual current line number yourself
   (the module doc cites line 2964 for `children`; verify `variant`/`padding` are also real
   documented props, not assumed).
4. **Confirm NOT wired into `router.tsx`** — grep `router.tsx` for `StudentHomeSlot`; must be zero
   matches. Confirm it is not imported/rendered anywhere else in `src/` either (grep the whole
   `src/` tree for `StudentHomeSlot` imports — should show only this file's own definition, since
   nothing else is supposed to reference it yet per the packet's explicit "deliberately unreachable
   in the running app today" scope).

---

## 6. D001-Method Forbidden-File Check (file-tree comparison, never git history for authorship)

Per the standing D001 rule: never infer *who* touched a file from git history/commit bundling.
Compare the current file tree directly against what should have changed since the D004 ruling
landed:
- Only these three files should show any change since D004: `src/app/AppShell.tsx`,
  `src/components/nav/TopNav.tsx`, `src/components/nav/MobileNav.tsx`.
- `src/pages/home/StudentHomeSlot.tsx` — confirm unchanged since attempt 1 (no D004 scope touched
  it at all).
- `src/app/router.tsx`, `src/app/guards.tsx`, `src/components/nav/SideNav.tsx` — confirm byte-
  unchanged (re-read directly; these were never in scope for T008 at all, original packet or
  amended).
- No other new files anywhere under `src/`.
- New `docs/swarm/active/*.md` packet files and hook-appended `verification-log.md` lines are
  always-expected background swarm-process artifacts (standing T004 close-out calibration rule) —
  do not file these as a per-task finding.

---

## 7. Standard Build/Test Gate

Run `npm run build`, `npm run typecheck`, `npm run lint`, `npm run format:check`, `npm run test`
yourself and quote real, unparaphrased output. Confirm 0 errors on all five. Pre-existing
non-blocking warnings (e.g. `react-refresh/only-export-components`, same ~8 that prior tasks have
consistently reported) are expected; flag only a *new* warning category or any error. `npm run
test` in particular re-exercises T006a's `theme.smoke.test.tsx` — confirm it still passes given the
new AppShell.tsx wiring (the object-form `mobileNav` prop and reverted TopNav.tsx should not
regress it, but verify rather than assume).

---

## 8. MINOR Follow-Up — Note, Do Not Re-Litigate

D004 Ruling C already classified "drawer does not auto-close on nav-item selection" as a
non-blocking MINOR follow-up, with no sanctioned lever available (the only fix,
`useAppShellMobile`, is undocumented in astryx-api.md, so constitution item 2 forbids using it
today). Confirm this is STILL true given the now-functional drawer (click a nav item in your live
session, confirm the drawer/dialog does not auto-close), and confirm the worker has not attempted
any undocumented workaround. Log it as a non-blocking observed-and-confirmed follow-up in your
verdict — do not fail the task on it, and do not propose a fix yourself.

---

## Relevant Constitution Excerpts

> **Non-Negotiables:** "The app must build successfully." / "No worker may mark its own work
> complete." / "Every checker must inspect the actual artifact, not just the worker's summary."

> 1. Precedence: PRD requirement IDs > this constitution > task-ledger text > agent judgment.
> Conflicts are disputes for boss-arbiter — never improvised around.

> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md` (PRD DES-19). A prop
> absent from that file is presumed hallucinated → MAJOR. The CLI (`npm run astryx -- component
> <Name>`) is a cross-check, not a source. Note: astryx-api.md's `MobileNavConfig` fields ARE
> documented as of the D004 annotation — `content`/`hasToggle`/`breakpoint`/etc. are NOT
> hallucinated props; this is the one case where the doc itself was amended (D004 finding 4), not a
> gap the worker is filling unilaterally.

> 11. UI is built from Astryx components; styling escalation order per PRD DES-21 (component →
> theme token → xstyle → custom CSS); ejecting component source needs boss approval.

> 15. Accessibility per PRD DES-17 / NFR-07 is a shipping requirement; keyboard path failures on
> core flows → BLOCKER.

> **Failure Severity — BLOCKER:** "Cannot ship. Violates a core requirement, breaks the build,
> corrupts data, breaks security, breaks accessibility, or modifies forbidden files."
> **MAJOR:** "Should not ship without boss approval." **MINOR:** "Acceptable for the current task
> but should become a follow-up task." **NIT:** "Cosmetic or preference-level issue."

> **Decision rules:** BLOCKER fails the task. MAJOR fails the task unless the boss explicitly
> approves deferral. MINOR passes with a follow-up task. NIT passes and is logged only.

> **D001 standing rule:** never use git history/commit diffs as evidence of which agent touched a
> file (authorship attribution). Comparing current content against a known historical commit's
> content to verify byte-identity is a different, permitted use (see T007 checker precedent).

> **T004 close-out calibration rule:** new `docs/swarm/active/*.md` packet files and hook-appended
> `verification-log.md` completion lines are always-expected background swarm-process artifacts —
> do not file these as a per-task finding.

## PRD Ground Truth (verbatim)

> **NAV-05** (line 87): "Mobile (< 768px): `SideNav` is replaced by Astryx `MobileNav` drawer
> triggered from `TopNav`. Student Home additionally surfaces a persistent **Check in** card
> whenever a meeting session is live (MTG-10) so check-in never requires navigation." (The Check-in
> card itself is T054's job; T008 only reserves the slot — see Section 5 above.)

## Most Recent Failure
None — this is the first checker verdict T008 has ever received. Attempt 1 never reached a checker
(escalated to dispute D004 before check). D004 Rulings A–D are the operative scope; see the
dispute-log.md excerpt at the top of this packet.

## Required Checker Output (per constitution Evidence Requirements)
- Your own independently re-derived Astryx `mobileNav`/`MobileNavConfig`/`MobileNavToggle`
  mechanism table from the real installed source (Section 1) — confirm or refute D004's claims
  point by point, with your own file paths/line numbers/quoted source excerpts as evidence.
- `TopNav.tsx`: the actual historical commit you diffed against, the diff command output (should be
  empty/no diff), and explicit confirmation `MobileNavToggle`/`startContent` are fully absent.
- `MobileNav.tsx`: explicit confirmation every functional element listed in Section 3 is present
  and unchanged in substance; explicit statement of whether ONLY the doc comment changed.
- `AppShell.tsx`: quote the actual current `mobileNav` prop value and confirm it matches
  `mobileNav={{ content: <MobileNav /> }}` exactly.
- Live Playwright evidence for every sub-item in Section 4 (real commands/scripts + real output,
  not paraphrased) — toggle count above/below 768px, drawer count, three independent close paths,
  keyboard+focus in both modes, `document.title` parity, zero-reload confirmation with your chosen
  method's raw output, >=768px regression check against the Section 2 reference.
- `StudentHomeSlot.tsx` verification per Section 5, including scratch-harness declare/delete proof.
- D001-method forbidden-file check result (file-tree comparison; explicit "only these N files
  changed" statement).
- Full `npm run build`/`typecheck`/`lint`/`format:check`/`test` output.
- Explicit confirmation the drawer-close-on-navigate MINOR from D004 Ruling C is still true and
  still correctly unfixed (Section 8) — logged, not re-litigated.
- Overall pass/fail verdict for T008 as a whole, with severity classification on any finding.
- Recommended next action (pass; rework by this worker; new follow-up task; dispute to
  boss-arbiter — say which, and why).

Do not mark this task complete based on the orchestrating session's or worker's claimed-changes
summary above — it is unverified narration, not evidence. Inspect the actual files and generate
your own independent evidence via reading source, testing, rendering, and command runs. Do not flip
`task-ledger.md` yourself — report your verdict back; foreman-planner updates the ledger. T008
stays "In Progress" in the ledger until your verdict is returned.
