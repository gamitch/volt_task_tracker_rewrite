# Checker Packet: T007 (SideNav, role-filtered, + outreach badge scaffold) — Check Attempt 1

## Task ID
T007 — SideNav role-filtered nav (NAV-01/NAV-03/NAV-04/NAV-07, BEH-04)

## Checker Agent
checker-accessibility (per task-ledger.md T007 row)

## Attempt
Check attempt 1 of 3 (max 3 before mandatory boss-arbiter escalation per constitution "Loop
Limit"). This is the first check on this task — no prior checker verdict exists. Full task
context: `docs/swarm/active/T007-worker-packet.md` (read it in full before starting; it contains
the complete Astryx ground-truth excerpts, PRD tables, and Required Composition the worker was
given).

## What This Check Covers
Full first-pass verification of a new task — not a targeted re-check. Astryx prop cross-check
(including two live CLI reproductions the worker relied on for an undocumented-prop gap), NAV-03
role-matrix compliance across 5 role buckets, NAV-04 active-highlight/`document.title` wiring,
NAV-07/BEH-04 badge compliance, independent live Playwright verification (real dev server + real
`/login` flow, plus a self-built scratch harness for the other role variants), keyboard/focus in
both modes, the D001-method forbidden-file check, standard build/lint/typecheck/format:check, and
**an explicit severity verdict on a self-reported hard-navigation/session-loss defect** — this last
item is the most consequential judgment call in this packet; do not default to a lazy verdict.

## Worker's Claimed Changes (do not trust — verify independently)
1. New `src/components/nav/SideNav.tsx` — renders Astryx `SideNav` with `collapsible` (bare
   boolean), one `SideNavSection`, and 7 `SideNavItem`s (Home, Meetings, Outreach, Calendar,
   Roster, Reports, Settings) filtered by an `isStaffRole` check (`admin`/`coach` see all 7;
   everyone else, including `user === null`, sees 5 — no Roster/Reports). Active item computed via
   `useLocation()` (exact match for Home, prefix match otherwise) and drives both `isSelected` and
   a `useEffect`-set `document.title`. Outreach's item alone gets `endContent={<Badge
   variant="neutral" label={PLACEHOLDER_OUTREACH_BADGE_COUNT} />}` where the placeholder count is
   `0`. No `icon`/`selectedIcon`, no `header`.
2. Edited `src/app/AppShell.tsx` — worker claims exactly two mechanical changes: added `import {
   SideNav } from '../components/nav/SideNav';` and changed `sideNav={undefined}` to
   `sideNav={<SideNav />}`, plus an allowed module-doc comment update.
3. Worker claims `router.tsx`, `guards.tsx`, `TopNav.tsx`, `MobileNav.tsx` are byte-identical /
   zero diff.
4. Worker resolved the BEH-04 badge-slot problem via **Path 2** of the packet's resolution order
   (a real dedicated slot prop, not composing `label` as a `ReactNode`): claims
   `npm run astryx -- component SideNavItem` output shows a documented `endContent: ReactNode`
   ("Right-side content such as badges or counts") prop, used verbatim. Also claims
   `npm run astryx -- component SideNavSection` output shows `title: string` (not `heading`), used
   in place of the doc Example block's `heading="Main"` — worker's stated reason is that
   `astryx-api.md`'s own Example block is internally inconsistent between `heading` and `title` for
   this sub-component, and treats the CLI as the tie-breaker per the packet's explicit
   cross-check-gap allowance.
5. Worker claims build/typecheck/lint/format:check all exit 0.
6. Worker flags a **new** risk not present in the worker packet's own "known gap" list: SideNavItem
   renders a plain `<a href>` (no app-root `LinkProvider`/`as` wiring exists anywhere in the app),
   so clicking any SideNav item triggers a full browser reload; since `AuthProvider`
   (`guards.tsx`) is in-memory only, a full reload wipes the session and the user bounces back to
   `/login`. Worker states this is structurally identical to T006's already-Passed `TopNav`
   wordmark link (`TopNavHeading heading="VOLT" headingHref={routePaths.dashboard}` — see
   `src/components/nav/TopNav.tsx` line 64, quoted below), not a new class of bug T007 introduced,
   and declined to fix it because a real fix requires either editing `App.tsx` (outside T007's
   Allowed Files) or bolting on a partial `LinkProvider`/`as` shim that wouldn't address the
   systemic issue. Worker did not file this as a blocking dispute; flagged it as a known risk only.

## Astryx Ground Truth — Re-verify Every Line Reference Yourself, Do Not Trust the Worker's or This Packet's Citations

Foreman has independently spot-checked the line numbers below against the current
`docs/swarm/astryx-api.md` before writing this packet (Badge's `# Badge` header confirmed still at
line 493, matching the worker packet's own citation — the file has not drifted since T007 was
dispatched). Re-open the file yourself anyway; do not take this packet's word for any of it.

- **AppShell `sideNav`**: `astryx-api.md:2590` — `| \`sideNav\` | \`ReactNode\` | — | Side
  navigation slot, typically SideNav. |`. Confirm `AppShell.tsx` passes exactly `sideNav={<SideNav
  />}` and nothing else changed on that call (see D001-method section below).
- **SideNav props table**: `astryx-api.md:5732-5743`. Confirm `collapsible`
  (`astryx-api.md:5741`) is documented as `boolean | {...}`, default `false` — the worker's bare
  `collapsible` (uncontrolled mode) is the *documented* form, not a hack. Confirm no `header` prop
  is passed (per the doc's own Best Practice at `astryx-api.md:5729`, already independently
  confirmed by foreman: "Don't: Include a SideNavHeading when a TopNav is already providing app
  identity").
- **SideNavItem / SideNavSection — genuine doc gap, CLI is the disclosed tie-breaker.**
  `astryx-api.md:5753` (`### SideNavItem`) and `astryx-api.md:5759` (`### SideNavSection`) both
  read literally `undefined` where a Props table should be — foreman has independently confirmed
  this gap exists, it is not a worker fabrication. The **only** doc-native ground truth is the
  `SideNav` Example block (`astryx-api.md:5665-5715`), which foreman has read in full and confirms
  contains a genuine internal inconsistency the worker's module-doc comment describes accurately:
  line `5669` shows `<SideNavSection heading="Main">` but a **second, separate** example at line
  `5711` shows `<SideNavSection title="Main">` for the identical component — these are two
  different snippets in the same file, not a typo you're misreading. Neither `endContent` nor any
  badge/suffix-style prop appears anywhere in the Example block for `SideNavItem` at all (lines
  5699-5709 show only `label`, `icon`, `selectedIcon`, `isSelected`, `href`, `children`) — the
  worker's `endContent` claim rests **entirely** on the CLI, not the doc.
  **You must independently run both commands yourself and reproduce the worker's cited output
  verbatim — do not accept the worker's transcription as evidence, even if it looks plausible:**
  - `npm run astryx -- component SideNavItem`
  - `npm run astryx -- component SideNavSection`
  Confirm or refute, from your own real terminal output: (a) does `SideNavItem` genuinely expose an
  `endContent: ReactNode` prop described as being for badges/counts (or materially equivalent)? (b)
  does `SideNavSection` genuinely expose `title: string` rather than (or in addition to) `heading`?
  If the CLI output does not actually confirm what the worker claims, this is a MAJOR-class
  hallucinated-prop finding per constitution item 2 ("A prop absent from that file is presumed
  hallucinated" — the CLI is supposed to be a cross-check filling a *disclosed* doc gap here, not a
  license to use whatever the worker wants). If the CLI output genuinely matches, the worker's
  approach is correct and should be credited as a careful, well-disclosed doc-gap resolution, not
  penalized for deviating from the packet's illustrative (non-prescriptive) Required Composition
  example.
- **Badge**: `astryx-api.md:493-538` (header confirmed at line 493 by foreman). Confirm `variant`
  enum includes `'neutral'` and that `variant="neutral"` is passed explicitly (not relying on
  default) on the Outreach badge only — no other item gets a badge (NAV-07 nav-level separation —
  confirm Meetings and Outreach remain two distinct `SideNavItem`s with two distinct `href`s, never
  merged).

## NAV-03 Role-Matrix Compliance — PRD Verbatim Table (re-verify against the real file, not just this copy)

| Item | Route | Admin | Coach | Student | Parent |
|---|---|---|---|---|---|
| Home | `/` | Y | Y | Y | Y |
| Meetings | `/meetings` | Y | Y | Y | Y (read) |
| Outreach | `/outreach` | Y | Y | Y | Y (read+RSVP) |
| Calendar | `/calendar` | Y | Y | Y | Y |
| Roster | `/roster` | Y | Y | — | — |
| Reports | `/reports` | Y | Y | — | — |
| Settings | `/settings` | Y | Y | Y | Y |

Two visibility buckets only: Admin/Coach = all 7; everyone else (including `user === null`) = 5
(no Roster, no Reports). `guards.tsx`'s real `Role` union is `'admin' | 'staff' | 'volunteer' |
'coach'` (not the PRD's `student`/`parent` vocabulary — pre-existing K2 gap, `guards.tsx` is
read-only for this task). Per the worker packet's sanctioned substitution: use `'staff'` as the
Student stand-in and `'volunteer'` as the Parent stand-in, in addition to real `'admin'`/`'coach'`
values, **plus the `user === null` case** — that is 5 conditions total to verify, not 4. For each
of the 5, independently confirm the exact item **set** (not just count) rendered matches the table
above — e.g. confirm the 5-item non-staff set is specifically {Home, Meetings, Outreach, Calendar,
Settings} and not some other 5-item combination that happens to match the count.

## NAV-04 — Active Highlight + document.title, Trace Real State
Confirm `isSelected` on `SideNavItem` is driven by `activeItem?.route === item.route` from a real
`useLocation()` call (not hardcoded, not derived from props). Navigate between at least two
distinct routes in your own live/harness session and confirm the highlighted item actually changes
and `document.title` actually updates to `"<Item Label> · VOLT"` on each transition — read the real
`document.title` value in your test session, not the source code's intent. Also confirm the
prefix-match sub-route behavior (e.g. `/outreach/:eventId`-shaped path still highlights "Outreach"
and sets its title) if you can construct such a navigation in your harness.

## NAV-07 / BEH-04 — Read Real Rendered Props/DOM, Not Descriptions
- NAV-07: confirm Meetings and Outreach are two separate `SideNavItem` elements with two distinct
  `href` values in the actual rendered output (or component tree) — never a single combined item.
- BEH-04: confirm the Outreach item's badge is rendered with `variant="neutral"` in the actual
  props/DOM (not just present in source) — inspect the rendered badge's actual class/data-attribute
  or computed style if feasible, and confirm no other variant (`error`/`red`/anything else) is ever
  passed, including under the placeholder count. Confirm the placeholder count value renders (`0`)
  and is clearly a placeholder, not a fabricated real count.

## Live Verification — Real Dev Server + Your Own Scratch Harness (do not trust worker screenshots)
1. **Real flow.** Start the real dev server, sign in through the real `/login` page (this always
   lands on the `'staff'` role per `src/pages/login/LoginPage.tsx` line 103:
   `const PLACEHOLDER_SIGN_IN_ROLE: Role = 'staff';`). Confirm via real Playwright Chromium that
   `SideNav` genuinely renders inside the actual `AppShell`/route tree post-login, with the correct
   5-item non-staff-tier set (staff-as-Student-stand-in).
2. **Scratch harness for the other 4 conditions.** Since the real `Role` type cannot produce
   `admin`/`coach`/`volunteer` via the real login flow (`LoginPage.tsx` hardcodes `'staff'`) and
   `user === null` isn't reachable past `RequireAuth`, build your own **temporary, self-contained**
   Playwright/render harness (same pattern as T016/T016a's checkers used) to independently
   reproduce: `admin` (7 items), `coach` (7 items), `volunteer`-as-Parent-stand-in (5 items), and
   `user === null` (5 items, no crash). Do not import or reuse any harness file the worker may have
   left behind — build your own from scratch. **Declare the harness file's purpose in a header
   comment, then delete it before finishing — confirm deletion via `ls`/`find` showing it's gone,**
   same standard every prior checker packet has enforced.
3. Screenshot or equivalent DOM evidence for all 5 conditions, both light and dark mode.

## Keyboard + Focus, Both Modes — Real Interaction
Using real `KeyboardEvent` dispatch or Playwright's keyboard API (not just JSX inspection): confirm
Tab reaches every visible `SideNavItem` in DOM/tab order, Enter/Space activates navigation (or at
minimum triggers the expected click/href behavior), and a visible focus indicator is present on
every interactive element in both light and dark mode. BLOCKER per constitution item 15 if any
keyboard path is broken or focus isn't visible on a core flow.

## D001-Method Forbidden-File Check (file-tree comparison only — never git history)
Compare the current file tree directly against T007's Allowed Files (`src/components/nav/SideNav.tsx`
[new], `src/app/AppShell.tsx` [edit, scoped]). Specifically:
- Confirm no other new file exists anywhere under `src/`.
- Re-open `src/app/AppShell.tsx` yourself and diff it against the pre-T007 content quoted in the
  worker packet (reproduced below for convenience — do not treat this copy as ground truth, use it
  only to locate the diff, then read the real file):
  ```tsx
  import { AppShell as AstryxAppShell } from '@astryxdesign/core';
  import { routePaths } from './router';
  import { TopNav } from '../components/nav/TopNav';
  ...
    return (
      <AstryxAppShell topNav={<TopNav />} sideNav={undefined} mobileNav={false}>
        {children}
      </AstryxAppShell>
    );
  ```
  Confirm the only substantive changes are: (a) one new import line for `SideNav`, (b)
  `sideNav={undefined}` → `sideNav={<SideNav />}`, and (c) the module-doc comment update the packet
  explicitly sanctioned (the packet allowed correcting stale prose that described `sideNav={undefined}`
  as intentional). Flag as a violation anything beyond those three categories — e.g. any change to
  `mobileNav={false}`, the chromeless bypass logic, the `topNav` prop, or provider order.
- Confirm `src/app/router.tsx`, `src/app/guards.tsx`, `src/components/nav/TopNav.tsx`,
  `src/components/nav/MobileNav.tsx` are byte-unchanged (re-read them directly; `TopNav.tsx`'s
  current content is reproduced in full below for your reference/comparison baseline — do not treat
  this copy as ground truth, re-read the real file).
- New `docs/swarm/active/*.md` packet files and a hook-appended `verification-log.md` line are
  always-expected background swarm-process artifacts (standing T004 close-out calibration rule) —
  do not file these as a per-task finding.

### `TopNav.tsx` — Full Current Contents (reference baseline only, re-read the real file)
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

## Standard Build/Test Gate
Run `npm run build`, `npm run typecheck`, `npm run lint`, `npm run format:check` yourself and quote
real, unparaphrased output — confirm 0 errors. Pre-existing non-blocking warnings (if any, e.g.
`react-refresh/only-export-components`) are expected; only flag a *new* warning category or any
error.

---

## CRITICAL: Explicit Severity Verdict on the Hard-Navigation / Session-Loss Finding — Do Not Rubber-Stamp

The worker discovered and disclosed that `SideNavItem` renders a plain `<a href>` with no
app-root `LinkProvider` wired anywhere in the app. Because `AuthProvider` (`guards.tsx`) is a
purely in-memory placeholder (confirmed by T005/T016 close-out notes — no real Supabase session
persistence exists yet), **clicking any SideNavItem triggers a full browser page reload, which
wipes the in-memory session and bounces the user back to `/login`.** The worker's defense for not
fixing this: (a) `App.tsx` — where a `LinkProvider` would need to be wired — is outside T007's
Allowed Files; (b) a partial `as`/local shim on just `SideNavItem` would not fix the systemic
issue and could create an inconsistent navigation experience (some links hard-navigate, some
don't); (c) this is not new — T006's already-Passed `TopNav` wordmark link
(`TopNavHeading heading="VOLT" headingHref={routePaths.dashboard}`) has the structurally identical
plain-`<a>`-no-`LinkProvider` shape, and T006's checker-accessibility explicitly confirmed at the
time that `TopNavHeading` was **not** given an `as`/`LinkComponentType` prop (constitution item 2 —
that prop is undocumented for `TopNavHeading` in `astryx-api.md`) and did not flag the resulting
hard-navigation behavior as blocking T006.

**Reproduce this independently before ruling — do not take the worker's description on faith:**
1. In your live Playwright session (real dev server, signed in via `/login`), click a `SideNavItem`
   (e.g. "Meetings").
2. Confirm whether this triggers a full page navigation (check for a full reload — e.g. a
   `page.waitForNavigation` / full frame load event, not a client-side route transition) rather
   than an in-SPA route change.
3. Confirm whether, after that click, the app is signed out and the URL has bounced to `/login`
   (i.e. the session was actually lost, not just a benign hard reload that happens to preserve
   state some other way).

**Then render an explicit BLOCKER/MAJOR/MINOR/NIT verdict**, per the constitution's Failure
Severity rubric (quoted below), specifically on this question: **does this genuinely broken
primary-navigation click path (every SideNav click signs the user out) block T007's own PASS, or
is it correctly out-of-scope pre-existing debt — the same category as T016's flagged
no-real-Supabase-auth-client gap — that should be logged as a follow-up/risk instead of rework?**

Weigh, explicitly, rather than defaulting to NIT because "it's pre-existing":
- **Severity of the actual user-facing effect.** This is not a cosmetic nav-styling gap — it means
  the app's primary navigation component, once wired into the real app for the first time by this
  very task, **cannot currently be used to navigate at all** without ejecting the user's session.
  T007 is precisely the task that made `SideNav` "genuinely reachable in the running app" (per its
  own stated purpose, mirroring T006/T016a's "first real X reachable in the app" framing) — so
  unlike T006's wordmark link (one single link, arguably a minor/edge interaction) or T016's
  no-Supabase-client gap (auth isn't wired at all yet, so nothing regresses — you simply can't sign
  in for real), this defect sits directly on the component T007 exists to ship, and every one of
  its 5–7 items reproduces it.
- **Precedent cuts both ways — read it carefully, don't just cite it.** T006's checker did examine
  this exact structural shape (`TopNavHeading`'s plain `<a>`) and passed T006 without flagging the
  resulting hard-navigation-and-session-loss behavior as blocking. Consider whether that precedent
  was itself under-scrutinized (T006's checker's stated focus was the `as`/`LinkComponentType`
  prop-hallucination question, not the *functional consequence* of omitting it) rather than binding
  proof this class of bug is always acceptable. You are not bound to repeat a possibly-incomplete
  prior analysis — form your own independent judgment on the functional-consequence question, which
  may differ from T006's checker's conclusion even though the underlying code shape is the same.
- **Scope reality.** The worker is correct that a real fix requires `App.tsx` (forbidden here) or a
  systemic `LinkProvider` decision that is bigger than one task. A MAJOR or BLOCKER verdict does
  not necessarily mean *this worker* did something wrong or must rework `SideNav.tsx` itself — it
  may instead mean the finding is real, severe, and must be escalated (e.g. to boss-arbiter, or
  routed as an urgent same-day corrective task in the T002a/T006a pattern) rather than filed as an
  ordinary MINOR follow-up that could sit in the backlog indefinitely while every future nav-based
  task (T008 MobileNav, T021 Roster, T030 Meetings, etc.) piles on top of an app that cannot
  actually be clicked through end-to-end.
- **Constitution's own words:** BLOCKER = "Cannot ship... breaks the build... or modifies forbidden
  files" — note breaking accessibility/core-requirement functionality is also explicitly BLOCKER
  language ("breaks accessibility" sits in the same clause), and constitution item 15 states
  "keyboard path failures on core flows → BLOCKER" as an analogous core-flow-breaks-navigation
  standard, even though this specific defect is a mouse/click-and-reload issue rather than a
  keyboard-specific one — consider whether the same "core flow is broken" reasoning applies
  regardless of input modality.

Do not just list these considerations — pick a verdict and justify it. If you rule MAJOR or
BLOCKER, state plainly whether you are also failing T007 as a whole on this basis (per the
Decision Rules: "BLOCKER fails the task," "MAJOR fails the task unless the boss explicitly approves
deferral") or whether you judge this a defect that exists independently of `SideNav.tsx`'s own
correctness (i.e., `SideNav.tsx` itself is a correct, spec-compliant component; the break lives in
the surrounding app's lack of a `LinkProvider`) and therefore recommend an urgent-but-separate
follow-up task rather than failing T007's own deliverable. Either conclusion is defensible — the
requirement here is a reasoned, explicit verdict, not a particular answer.

---

## Relevant Constitution Excerpts

> **Non-Negotiables:** "The app must build successfully." / "No worker may mark its own work
> complete." / "Every checker must inspect the actual artifact, not just the worker's summary."

> 1. Precedence: PRD requirement IDs > this constitution > task-ledger text > agent judgment.
> Conflicts are disputes for boss-arbiter — never improvised around.

> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md` (PRD DES-19). A prop
> absent from that file is presumed hallucinated → MAJOR. The CLI (`npm run astryx -- component
> <Name>`) is a cross-check, not a source.

> 9. Dependency allowlist: `@astryxdesign/*`, `@supabase/supabase-js`, `@tanstack/react-query`,
> `react-router-dom`, `qrcode.react`, `ical-generator`, plus dev tooling. Anything else requires
> boss-architect approval recorded in the ledger.

> 11. UI is built from Astryx components; styling escalation order per PRD DES-21 (component →
> theme token → xstyle → custom CSS); ejecting component source needs boss approval.

> 15. Accessibility per PRD DES-17 / NFR-07 is a shipping requirement; keyboard path failures on
> core flows → BLOCKER.

> **Failure Severity — BLOCKER:** "Cannot ship. Violates a core requirement, breaks the build,
> corrupts data, breaks security, breaks accessibility, or modifies forbidden files."
> **MAJOR:** "Should not ship without boss approval. Important functional, architectural, UX, or
> correctness issue." **MINOR:** "Acceptable for the current task but should become a follow-up
> task." **NIT:** "Cosmetic or preference-level issue. Does not block completion."

> **Decision rules:** BLOCKER fails the task. MAJOR fails the task unless the boss explicitly
> approves deferral. MINOR passes with a follow-up task. NIT passes and is logged only.

> **Definition of Done:** a task is done only when (1) the worker produces the requested change,
> (2) the checker validates the actual artifact, (3) the checker records evidence, (4) the foreman
> updates the task ledger, (5) the boss or foreman accepts the checked result.

> **D001 standing rule:** never use git history/commit diffs as evidence of which agent touched a
> file. Compare the task's Allowed Files list against the current file tree state directly.

> **T004 close-out calibration rule:** new `docs/swarm/active/*.md` packet files and hook-appended
> `verification-log.md` completion lines are always-expected background swarm-process artifacts —
> do not file these as a per-task finding.

## PRD Ground Truth (verbatim, re-quoted from the worker packet — re-verify against
`docs/swarm/VOLT_Portal_PRD.md` yourself if you have any doubt about accuracy)

> **NAV-01** (line 72): "Use Astryx `AppShell` with `TopNav` (top slot) and `SideNav` (sidebar
> slot, `collapsible`); wrap the app in `Layer` provider and `Theme`."

> **NAV-03** (lines 74–85): role-matrix table — see reproduction above.

> **NAV-04** (line 86): "Active item highlighted by `SideNav`'s built-in state; current page also
> sets `document.title` (\"Meetings · VOLT\")."

> **NAV-07** (line 90): "Meetings and Outreach are separate routes with separate queries. No screen
> may render a combined meetings+outreach list except Calendar (`/calendar`) and per-student
> history in Reports, where every row carries a type `Badge`."

> **BEH-04** (line 233): "RSVP completion nudge: the SideNav Outreach item shows a neutral count
> `Badge` of unanswered future outreach sessions (student: own; parent: linked kids combined).
> Clears as answered. Neutral styling — never error/red, never urgency copy."

## Most Recent Failure
None — this is check attempt 1 for T007.

## Required Checker Output (per constitution Evidence Requirements)
- Files inspected (quote actual current contents of `SideNav.tsx`, `AppShell.tsx`, and the
  relevant lines of `TopNav.tsx`/`router.tsx`/`guards.tsx`/`MobileNav.tsx` you cross-checked).
- Exact commands run + real quoted output (not summarized/paraphrased) — including your own
  `npm run astryx -- component SideNavItem` / `npm run astryx -- component SideNavSection`
  reproductions (full verbatim output), your own build/typecheck/lint/format:check re-run, and your
  own Playwright session(s).
- Explicit prop-by-prop cross-check table against `astryx-api.md`'s actual current line numbers,
  including an explicit ruling on the `endContent`/`title` CLI-sourced claims (confirmed or
  refuted, with your own raw CLI output as evidence).
- Role-by-role verification for all 5 conditions (admin, coach, staff-as-Student, volunteer-as-
  Parent, `user === null`) — item set (not just count) confirmed per condition, your own
  screenshots/DOM evidence, both light and dark mode.
- NAV-04 trace: confirm `isSelected`/`document.title` genuinely change on real navigation in your
  own session (not source-code narration).
- NAV-07/BEH-04: confirm via actual rendered props/DOM (two separate SideNavItems/hrefs; badge
  `variant="neutral"` only, on Outreach only).
- Keyboard + focus walkthrough, both modes, real interaction (not JSX inspection).
- D001-method forbidden-file check result (file-tree comparison, exact AppShell.tsx diff
  characterization).
- **Explicit BLOCKER/MAJOR/MINOR/NIT severity verdict on the hard-navigation/session-loss finding,
  with your own Playwright reproduction and full reasoning shown** — not just a conclusion.
- Confirmation your own temporary scratch harness (for the 4 non-real-login role conditions) was
  declared and deleted before finishing, with proof (`ls`/`find` showing it's gone).
- Overall pass/fail result for T007 as a whole.
- Exact failure reason(s), if any, with severity classification.
- Recommended next action (pass; rework by this worker; new follow-up task; urgent same-day
  corrective task in the T006a pattern; or dispute to boss-arbiter — say which, and why).

Do not mark this task complete based on the worker's claimed-changes summary above — it is
unverified narration, not evidence. Inspect the actual files and generate your own independent
evidence via testing, rendering, and command runs. Do not flip `task-ledger.md` yourself — report
your verdict back; foreman-planner updates the ledger. T007 stays "In Progress" in the ledger until
your verdict is returned.
