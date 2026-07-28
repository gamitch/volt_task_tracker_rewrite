# Worker Output: T134 — chromeless projection routes (UXC-12) + roster re-capture

Implements the packet exactly as written (Revision 2). No packet requirement
was reinterpreted; no forbidden file was edited.

## Round 2 (rework after checker FAIL — one MAJOR, two MINORs)

The independent check returned FAIL with one MAJOR and two MINORs (plus
three NITs correctly left alone: the unreachable `!sessionId` branch and two
wording judgement calls). All three are addressed below; the checker's own
disclosure-verification of §7 (guard-denial) and §5 (LiveConsole heading
states) — done by executing, not just reading, and reported as accurate —
required no changes.

1. **MAJOR — `new-roster.webp` overwrite reverted.** Ran `git checkout HEAD
   -- docs/swarm/figures/ux-craft/new-roster.webp`, restoring the original
   populated-roster figure. The twelve `t134-*.webp` captures are unchanged
   and still discharge the "full chrome on /roster" proof this task actually
   needed (see the updated Captures section below). My original reasoning
   for the overwrite (packet §4 authorizes it, and "re-capture only" reads as
   "capture whatever is currently real") was sound as far as it went, but
   missed three consequences visible only from outside the task: (a)
   `new-roster-teams.webp` sits beside it showing the same page rendering
   normally one tab over, so the error-state replacement reads as "Students
   tab is broken" to anyone using the `new-*.webp` set as the canonical
   design reference; (b) my own disclosure explaining the error state lives
   in this document, but `docs/swarm/active/**` gets archived to
   `docs/swarm/archive/`, which `.gitignore` excludes from the repository —
   so the explanation would disappear from git history while the misleading
   figure remained; (c) the replacement didn't even serve §4's actual
   purpose (a figure showing the roster table and its seams) — the old
   figure showed an empty roster (no table, but no error either); the new
   one showed neither a table nor a working page. Net: strictly worse
   information for a future reader than not touching the file at all.
2. **MAJOR companion — dispute filed** (see new "Dispute" section below):
   packet §4's deliverable (a current roster figure showing the table/seams)
   is not achievable in this environment as specified, and I should have
   said so instead of shipping a capture that neither achieved the goal nor
   disclosed its own shortfall loudly enough to survive archiving.
3. **MINOR — `LiveConsole.tsx` stale/contradictory router-reachability
   comment fixed.** `:15-18`'s heading no longer claims a reachability gap
   "re-confirmed live for this route" (one no longer exists, and my own
   `:42-48`-region text already said so — the two were contradicting each
   other). The heading now reads "Role guard (packet Forbidden Files note)
   -- reachability is NOT a gap here." The stale `(lines ~155-162)` citation
   at the old `:22` was replaced with the same accurate `:225`/`:228` used
   elsewhere in this same comment block, so there is now one consistent
   citation for this route throughout the file, not two conflicting ones.
4. **MINOR — both new a11y behaviors now pinned by tests**, in the same two
   Allowed test files:
   - `Kiosk.test.tsx`: new test asserts an `a[href="/meetings"]` (via
     `routePaths.meetings`) renders in the populated branch, with visible
     text "Back to meetings".
   - `LiveConsole.test.tsx`: three new tests assert exactly one `<h1>` in
     each of the loading, error, and populated `DES-12 states`, with text
     `'Meeting Check-In'` (the `FALLBACK_SESSION_TITLE`) in loading/error and
     the real session title (`'Tuesday Build Meeting'`) in populated.

   All four new assertions are pure additions (no existing assertion in
   either file was changed or removed) — confirmed via `git diff` showing
   only new `it(...)` blocks appended, plus one new `import { routePaths }`
   line in `Kiosk.test.tsx`.

Full re-run of all required commands after this rework is in the updated
§11/12 section at the bottom; final test count is **1432 tests / 61 files**
(1414 baseline + 14 from round 1's `AppShell.test.tsx` additions + 4 from
round 2's `Kiosk.test.tsx`/`LiveConsole.test.tsx` pinning additions).

## Files changed

- `src/app/AppShell.tsx` — replaced the exact-string chromeless check with
  `CHROMELESS_PATTERNS` + `matchPath` (the packet's prescribed snippet,
  shipped verbatim), plus module-doc updates.
- `src/app/AppShell.test.tsx` — extended (not weakened) with a new `describe`
  block: 14 new tests (2 projection-route chromeless checks, 1 static-route
  regression check, 10 parametrised "still full chrome" checks via
  `it.each`, 1 case-insensitivity check). All 5 pre-existing tests are
  untouched and still pass.
- `src/pages/meetings/Kiosk.tsx` — added the `/meetings` escape link (§2a),
  corrected the three stale module-doc claims (§5), added a `Link`/`routePaths`
  import and prop-sourcing citation.
- `src/pages/meetings/Kiosk.test.tsx` — (round 2) added one new test pinning
  the escape link's `href`/text in the populated branch. Nothing else in
  this file changed: the T103 disclosure-banner-absence test (originally
  cited at `:173-179`, now at `:193-199` purely because the new import and
  test above it shifted line numbers -- content byte-identical to before
  this task) is untouched.
- `src/pages/meetings/LiveConsole.tsx` — made the `<h1>` unconditional across
  all three DES-12 states with a `FALLBACK_SESSION_TITLE` fallback (§2b),
  corrected the stale module-doc claim (§5's `LiveConsole.tsx:42-48`), and
  (round 2) fixed the contradictory router-reachability citation at
  `:15-18`/old `:22`.
- `src/pages/meetings/LiveConsole.test.tsx` — (round 2) added three new tests
  pinning exactly one `<h1>` (with the correct text) in each of the loading,
  error, and populated DES-12 states.
- `docs/swarm/figures/ux-craft/new-roster.webp` — **restored to `HEAD`**
  (round 2; see "Round 2" section above). Not part of this task's final
  diff.
- `docs/swarm/figures/ux-craft/t134-{kiosk,live-console,roster}-{1440,375}-{light,dark}.webp` —
  12 new capture files (see Captures section), unchanged from round 1.
- `docs/swarm/active/T134-worker-output.md` — this file.

No other files were touched. Two throwaway files were created and deleted
before finishing, per the packet's instruction (see "Throwaway rig" section
below): `capture.throwaway.html`, `src/capture.throwaway.tsx`, and
`src/app/T134-guard-denial.throwaway.test.tsx`. None remain in the working
tree. Final `git status --short`:

```
 M src/app/AppShell.test.tsx
 M src/app/AppShell.tsx
 M src/pages/meetings/Kiosk.test.tsx
 M src/pages/meetings/Kiosk.tsx
 M src/pages/meetings/LiveConsole.test.tsx
 M src/pages/meetings/LiveConsole.tsx
?? docs/swarm/active/T134-worker-output.md
?? docs/swarm/figures/ux-craft/t134-kiosk-1440-dark.webp
?? docs/swarm/figures/ux-craft/t134-kiosk-1440-light.webp
?? docs/swarm/figures/ux-craft/t134-kiosk-375-dark.webp
?? docs/swarm/figures/ux-craft/t134-kiosk-375-light.webp
?? docs/swarm/figures/ux-craft/t134-live-console-1440-dark.webp
?? docs/swarm/figures/ux-craft/t134-live-console-1440-light.webp
?? docs/swarm/figures/ux-craft/t134-live-console-375-dark.webp
?? docs/swarm/figures/ux-craft/t134-live-console-375-light.webp
?? docs/swarm/figures/ux-craft/t134-roster-1440-dark.webp
?? docs/swarm/figures/ux-craft/t134-roster-1440-light.webp
?? docs/swarm/figures/ux-craft/t134-roster-375-dark.webp
?? docs/swarm/figures/ux-craft/t134-roster-375-light.webp
```

Note: `docs/swarm/verification-log.md` also shows as modified in a bare `git
status` in this shared worktree — that is the checker's own log entry from
its independent check run, not a change I made; I left it untouched (it is
a forbidden file for workers).

## 1. The matching mechanism + DOM evidence

Shipped exactly the packet's prescribed shape in `AppShell.tsx`:

```tsx
const CHROMELESS_PATTERNS = [
  routePaths.login,
  routePaths.acceptInvite,
  '/kiosk/:sessionId',
  '/meetings/live/:sessionId',
];

const isChromeless = CHROMELESS_PATTERNS.some(
  (pattern) => matchPath(pattern, location.pathname) !== null,
);
```

`matchPath` imported from `react-router-dom` (already allowlisted, no new
dependency). No new module was created and `router.tsx` was not edited (only
read).

**DOM evidence** — `AppShell.test.tsx`'s new `describe('T134 chromeless
pattern matching (UXC-12)')` block, all passing (`npx vitest run
src/app/AppShell.test.tsx`, 19/19 green):

- `renders /kiosk/:sessionId chromeless -- no TopNav/SideNav, no
  role="main", no KpiStrip` — asserts `container.querySelector('[role="main"]')`
  is `null`, `container.textContent` does not contain `'VOLT'` (TopNav
  wordmark), and does not contain the KpiStrip error banner text, while the
  page's own marker content IS present.
- `renders /meetings/live/:sessionId chromeless` — same three assertions.
- `/login and /accept-invite remain chromeless (regression...)` — confirms
  the two pre-existing static routes still match.
- `still renders full chrome (TopNav + role="main") on %s` — `it.each` over
  all ten of Acceptance Criterion 3's ordinary routes: `/`, `/meetings`,
  `/outreach/:eventId`, `/outreach`, `/calendar`, `/checkin`, `/roster`,
  `/reports`, `/settings`, `/settings/season`. Each asserts `container
  .textContent` contains `'VOLT'` and `[role="main"]` is present and
  contains the page marker. **`/outreach/:eventId` (Trap #3, the sloppy-
  pattern-list catch) and `/meetings`/`/settings` (Trap #2, the prefix trap)
  are all explicitly asserted here and all pass.**

Full command output (relevant slice; full run below in §11/12):

```
✓ src/app/AppShell.test.tsx (19 tests) 666ms
  ✓ renders /kiosk/:sessionId chromeless -- no TopNav/SideNav, no role="main", no KpiStrip
  ✓ renders /meetings/live/:sessionId chromeless -- no TopNav/SideNav, no role="main", no KpiStrip
  ✓ /login and /accept-invite remain chromeless (regression, still matched as static patterns)
  ✓ still renders full chrome (TopNav + role="main") on / (dashboard)
  ✓ still renders full chrome (TopNav + role="main") on /meetings
  ✓ still renders full chrome (TopNav + role="main") on /outreach/:eventId
  ✓ still renders full chrome (TopNav + role="main") on /outreach
  ✓ still renders full chrome (TopNav + role="main") on /calendar
  ✓ still renders full chrome (TopNav + role="main") on /checkin
  ✓ still renders full chrome (TopNav + role="main") on /roster
  ✓ still renders full chrome (TopNav + role="main") on /reports
  ✓ still renders full chrome (TopNav + role="main") on /settings
  ✓ still renders full chrome (TopNav + role="main") on /settings/season
  ✓ matchPath is case-insensitive by default (documented, not a bug): /KIOSK/abc still matches /kiosk/:sessionId
```

This was also independently re-confirmed with real pixels: the 12 Playwright
captures below show the kiosk and live-console routes with no top nav / side
nav / KPI strip visible, and the roster capture shows the full VOLT top nav
+ side nav present, at both 1440px and 375px, both color modes.

## 2. `matchPath` case-insensitivity note

Confirmed live (not just cited): `matchPath('/kiosk/:sessionId',
'/KIOSK/abc')` matches, and the corresponding test (`matchPath is
case-insensitive by default...`) passes. This is documented in
`AppShell.tsx`'s own new module doc as intentional/correct — it matches how
`<Routes>` itself resolves the same URL — not a bug.

## 3. Confirming both pages survive without `SeasonProvider`

Per the packet: this was pre-resolved and not to be re-investigated, only
confirmed. Confirmed two ways:

1. **Static**: `grep -rl "useActiveSeason" src` was re-run against the
   current tree. `Kiosk.tsx` and `LiveConsole.tsx` both appear in that
   grep's output, but in both cases the only match is a sentence *I added to
   the module doc* stating that the file does **not** consume
   `useActiveSeason()` (i.e., the grep hit is the word appearing in a
   negation, not a real usage) — confirmed by reading both hit lines
   directly. Neither file imports `useActiveSeason` or `SeasonProvider`
   anywhere in actual code. `Kiosk.tsx` imports only
   `../../lib/supabase/loaders/kiosk` (plain async functions, no React
   context); `LiveConsole.tsx` imports `../../app/guards` (`RequireRole`,
   `useAuth`) and `../../app/router` (`routePaths`) — neither is
   `SeasonProvider`.
2. **Dynamic**: the 8 kiosk/live-console captures (§9 below) were all
   produced by mounting the real `AppShell` (chromeless branch, so
   `SeasonProvider` genuinely never mounts on these routes) around the real
   `KioskPage`/`LiveConsolePage` components in a real Chromium browser, and
   both rendered their full populated content with no error, no missing
   context crash, and no blank screen.

## 4. `role="main"`/skip-link decision (recorded, per §2(d))

**Decision: accept the loss, do not attempt to reintroduce either landmark
on these two routes.**

Reasoning: `role="main"` and the "Skip to content" skip link both exist
specifically to let a keyboard/AT user skip past *navigation chrome* to
reach the main content. On `/kiosk/:sessionId` and `/meetings/live/:sessionId`
there is no navigation chrome anymore (that is the entire point of this
task) — so there is nothing to skip past. A skip-link with no chrome ahead
of it, or a lone `role="main"` landmark with no sibling landmarks to
distinguish it from, adds structure without adding navigability.

Per the packet's own instruction, I confirmed each page still has one
unambiguous top-level heading instead: Kiosk already had exactly one
`<Heading level={1}>` (unconditional, `sessionTitle?.title ??
FALLBACK_SESSION_TITLE`); LiveConsole's `<h1>` is now unconditional across
all three DES-12 states (§5 below) — so a screen-reader user landing on
either chromeless route has an immediate, unambiguous heading to orient by,
even without a `role="main"` landmark.

Confirmed (not just asserted) that this is formally locked in:
`AppShell.test.tsx:99-113` (pre-existing, unchanged) already used
`querySelector('[role="main"]') === null` as its proof of chromelessness for
`/login`/`/accept-invite`; the new T134 tests apply the exact same proof to
`/kiosk/:sessionId` and `/meetings/live/:sessionId`, so any future
regression that accidentally reintroduces `role="main"` on these routes (or
removes it from an ordinary route) will fail a test.

## 5. Kiosk escape path + LiveConsole unconditional `<h1>` evidence

**Kiosk escape path** (§2a): added

```tsx
<Link as={RouterLink} href={routePaths.meetings} isStandalone>
  Back to meetings
</Link>
```

as the last element inside the populated/empty-token render branch's
`VStack` (`Kiosk.tsx`), using the exact `as={RouterLink}` idiom
`LiveConsole.tsx:1012-1014`'s own "Back to meetings" link establishes.
`isStandalone` is set because this link sits as a bare `VStack` child with
no ambient `Text` sizing context (unlike `LiveConsole.tsx`'s copy of this
link, which sits inside that page's header `HStack`) — the same "Do: set
isStandalone when the link appears standalone" precedent
`CalendarPage.tsx`/`OutreachList.tsx`/`AccessDeniedPage.tsx` already
establish. Visually confirmed quiet/low-prominence (small, muted-color link
text, no visual weight competing with the QR/tally) in all 4 kiosk captures
(§9) — see `t134-kiosk-1440-light.webp`, where "Back to meetings" appears at
the very bottom in the same small link style used elsewhere in the app.

Left the "No session selected" (missing route param) `Banner` branch
untouched — the packet explicitly says "Leave it," and it is a distinct,
already-terminal empty state (no session id to navigate away *from*
meaningfully, and the packet did not ask for a second, redundant escape
link there).

**LiveConsole unconditional `<h1>`** (§2b): changed

```tsx
{session !== null && (
  <VStack gap={0} hAlign="center">
    <Heading level={1}>{session.title}</Heading>
    ...
```

to

```tsx
<VStack gap={0} hAlign="center">
  <Heading level={1}>{session?.title ?? FALLBACK_SESSION_TITLE}</Heading>
  {session !== null && (
    <Text type="supporting">
      {formatSessionTimeRange(session.startsAt, session.endsAt)}
    </Text>
  )}
</VStack>
```

with `const FALLBACK_SESSION_TITLE = 'Meeting Check-In';` added just above
`LiveConsoleBodyProps`, mirroring `Kiosk.tsx`'s own precedent exactly (same
constant name, same value, same `?? FALLBACK` shape), per the packet's
explicit instruction not to invent new fallback copy.

Confirmed by re-running `LiveConsole.test.tsx` (all 36 pre-existing tests
still pass — none of them asserted on the *absence* of the h1 in
loading/error, so this was a pure addition, not a content change to an
existing test) and visually: `t134-live-console-1440-light.webp` shows "Tuesday
Build Meeting" as the `<h1>` in the populated state.

**Round 2 update:** the checker independently executed (not just read) both
of this section's disclosed gaps and confirmed both correct against the
shipped code. In response, three new tests were added to `LiveConsole.test.tsx`'s
`describe('DES-12 states')` block, pinning exactly what was previously only
disclosed-but-unpinned:

```
✓ T134 (UXC-12): renders exactly one <h1>, with fallback text, in the loading state
✓ T134 (UXC-12): renders exactly one <h1>, with fallback text, in the error state
✓ T134 (UXC-12): renders exactly one <h1>, with the real session title, in the populated state
```

Each asserts both `container.querySelectorAll('h1')` has length 1 (no
duplicate/missing heading) AND the exact text (`'Meeting Check-In'` for
loading/error, `'Tuesday Build Meeting'` for populated, via
`defaultLoadLiveConsoleData`). This closes the "unverified by automated
test" gap this section previously disclosed. `npx vitest run
src/pages/meetings/LiveConsole.test.tsx` → 39/39 passed (36 pre-existing + 3
new).

## 6. Banner verification

- **LiveConsole** (`LiveConsole.tsx:778-782`, now shifted slightly by doc
  edits but unchanged in content): banner copy re-read verbatim — "This QR
  code and check-in code aren't live yet" / "Scanning or entering them won't
  check anyone in. A real, working code isn't ready yet." No jargon: no task
  ID, no literal "fixture", no literal "stub" anywhere in the rendered copy.
  Confirmed the loader wiring is unchanged: `LiveConsoleBody`'s default
  `loadDisplayToken = fixtureLoadLiveConsoleDisplayToken` (line ~871,
  unchanged) — **not** wired to `loadKioskDisplayToken`, per the packet's
  explicit "do not wire the loader" instruction. Visually present in all 4
  live-console captures (`t134-live-console-*.webp`).
- **Kiosk**: confirmed **no** disclosure banner was added. `grep -n
  "isDismissable\|status=\"warning\"" src/pages/meetings/Kiosk.tsx` shows
  exactly one `Banner` in the whole file — the pre-existing "No session
  selected" empty-state banner for a missing route param — nothing new.
  `Kiosk.test.tsx:193-199` (the `never renders the two stale... disclosure
  banners` test -- originally at `:173-179`; the line-number shift is only
  because the new import and test above it moved everything else down, the
  test's own content is byte-identical to before this task) is untouched and
  is green: `npx vitest run
  src/pages/meetings/Kiosk.test.tsx` → 14/14 passed, including that exact
  test.

**Round 2 addition:** the escape link itself (§5 above) was previously
disclosed but not pinned by a test. Added one new test to `Kiosk.test.tsx`
asserting `container.querySelector('a[href="/meetings"]')` (via
`routePaths.meetings`) is non-null with text containing "Back to meetings"
in the populated branch. `npx vitest run src/pages/meetings/Kiosk.test.tsx`
→ 14/14 passed (13 pre-existing + 1 new).

## 7. Guard-denial screens at both projection URLs (§2c)

Used a throwaway vitest file (`src/app/T134-guard-denial.throwaway.test.tsx`,
gitignored, **deleted before finishing** per the packet) to mount the real
`AppShell` around the real guard/page tree at both URLs, logged in as a fake
`student` user via `LoginAs` (`src/test-utils/authHarness.tsx`):

- `/kiosk/:sessionId` with `RequireAuth > RequireRole(['coach','admin'])`
  (matching `router.tsx:197-205`'s exact guard nesting) around a stub child:
  a signed-in student sees `AccessDeniedPage`'s real content ("This page
  isn't part of your role", "Go to your dashboard") and
  `container.querySelector('[role="main"]')` is `null` — chromeless, as
  expected, since the chromeless match is on URL alone.
- `/meetings/live/:sessionId` with `RequireAuth` at the router level and the
  real `LiveConsolePage` (whose own internal `RequireRole` nests one level
  deeper, matching `LiveConsole.tsx`'s actual export shape) — same result:
  `AccessDeniedPage` content present, `role="main"` absent.

Both tests passed (`2/2`) before the file was deleted. Output captured at
the time:

```
✓ src/app/T134-guard-denial.throwaway.test.tsx (2 tests) 80ms
  ✓ /kiosk/:sessionId: a signed-in student gets a chromeless AccessDeniedPage (router-level RequireRole)
  ✓ /meetings/live/:sessionId: a signed-in student gets a chromeless AccessDeniedPage (component-level RequireRole inside LiveConsolePage)
```

The `RequireAuth`/`noProfile` → `NoAccessPage` branch was **not** separately
exercised with a dedicated test (it required a third fake-auth shape beyond
what `LoginAs` conveniently supports, and the packet frames this branch as
lower-risk/"terminal by design, so losing nav costs nothing" already). This
is **unverified by an automated check** and stated plainly: I confirmed only
by reading `guards.tsx:432-450`/`488-504` directly that `RequireAuth`'s
`noProfile` branch renders `<NoAccessPage />` in place, at the same URL,
structurally identical to the `RequireRole` case just proven — so it is
subject to the exact same "chromeless is a URL match, not a content match"
mechanism — but I did not independently execute it in a browser or test.

## 8. Captures

All 12 required captures exist under `docs/swarm/figures/ux-craft/`:

| File | Real or stubbed data |
|---|---|
| `t134-kiosk-1440-light.webp` | Stubbed (`fixtureLoadKioskDisplayToken` QR/short-code; stubbed tally 12/18; stubbed title "Tuesday Build Meeting") |
| `t134-kiosk-1440-dark.webp` | Stubbed, same as above |
| `t134-kiosk-375-light.webp` | Stubbed, same as above |
| `t134-kiosk-375-dark.webp` | Stubbed, same as above |
| `t134-live-console-1440-light.webp` | Fixture (this page's own real default `defaultLoadLiveConsoleData`/`fixtureLoadLiveConsoleDisplayToken`, no rig override needed) |
| `t134-live-console-1440-dark.webp` | Fixture, same as above |
| `t134-live-console-375-light.webp` | Fixture, same as above |
| `t134-live-console-375-dark.webp` | Fixture, same as above |
| `t134-roster-1440-light.webp` | **Real error state** — see note below |
| `t134-roster-1440-dark.webp` | Real error state, same note |
| `t134-roster-375-light.webp` | Real error state, same note |
| `t134-roster-375-dark.webp` | Real error state, same note |

**`new-roster.webp` was reverted to `HEAD`, not overwritten** (round 2 — see
"Round 2" section at the top and the new "Dispute" section below). The
`t134-roster-*.webp` captures above remain in place and fully discharge the
"full chrome is present on /roster" proof this task actually needed (`VOLT`
top nav, side nav with Home/Meetings/Outreach/Calendar/Roster/Reports/
Settings, `role="main"` present — confirmed via the same DOM check used for
the other captures — i.e. `/roster` was correctly left out of
`CHROMELESS_PATTERNS` and still renders with normal chrome).

**Roster capture note (stated plainly, not glossed over):** unlike Kiosk
(which has an explicit `loadDisplayToken`/`loadTally`/`loadSessionTitle`
prop-injection seam I used) and LiveConsole (whose *defaults* are already
fixture data, no props needed), `RosterShell`/`StudentsTab` take **no
injectable props** and call their real Supabase-backed loaders
unconditionally. With no `.env` configured in this sandbox, those loaders
reject, so all 4 `t134-roster-*.webp` captures show the real, current app
rendering an honest **error state**: "Couldn't load the active season"
(KpiStrip) / "Couldn't load students" (StudentsTab), both citing
`SupabaseNotConfiguredError` verbatim. This is not a fabricated or
misleading empty state — it is exactly what `/roster` currently renders in
any environment without Supabase configured. It does **not**, however,
achieve packet §4's actual deliverable (a figure showing the roster table
and its seams) — see the "Dispute" section below, which is the correct
response to that gap rather than shipping a capture that neither achieves
the goal nor safely discloses its own shortfall (see "Round 2" section
above for why overwriting `new-roster.webp` with this error-state capture
was the wrong move).

## 9. Horizontal scroll at 375px (Criterion 10)

Checked via `document.documentElement.scrollWidth >
document.documentElement.clientWidth` inside the capture rig's own page,
evaluated at the 375px viewport for all three pages:

- Kiosk 375px: `hasHorizontalScroll: false`
- LiveConsole 375px: `hasHorizontalScroll: false`
- Roster 375px: `hasHorizontalScroll: false`

This evidence lives only in this document — the capture rig
(`capture.throwaway.html`/`src/capture.throwaway.tsx`) and the Playwright
script that drove it (a scratch file outside the repo) were both deleted
after use, so this is **not** a persisted, re-runnable regression check,
exactly as the packet anticipates ("this is not a persisted regression
check. Say so.").

## 10. Commands (Criteria 11-12) — final re-run, after round 2 rework

```
$ npx tsc --noEmit
(clean, no output, exit 0)

$ npx eslint .
✖ 352 problems (0 errors, 352 warnings)
(all 352 warnings pre-existing `react-refresh/only-export-components`
warnings, same count before and after this task's changes -- most are in
files this task did not touch at all, e.g. RsvpControl.tsx,
SelfCheckoffDialog.tsx, EventsTab.tsx, HoursTab.tsx, ParticipationTab.tsx,
AdminToggles.tsx, InviteParentDialog.tsx, InvitesTab.tsx, ParentsTab.tsx,
StudentDialog.tsx, StudentsTab.tsx, TeamsTab.tsx, SeasonSettings.tsx,
SettingsPage.tsx, etc. `Kiosk.tsx` (7 warnings) and `LiveConsole.tsx` (7
warnings) also carry pre-existing warnings of this same class, all on
exported hooks/pure helpers this task did not add or modify --
`useKioskDisplayToken`/`useKioskTally`/`useKioskSessionTitle`/
`buildCheckinUrl` in `Kiosk.tsx`, `mergeAttendanceUpdate`/
`filterRosterByQuery`/`computeAttendanceTally`/`formatSessionTimeRange` in
`LiveConsole.tsx` -- confirmed present, unchanged in kind, before this
task's edits too, since the total warning count (352) is identical across
every full `eslint .` run in this task, both before and after round 2.)

$ npx vite build
✓ 2385 modules transformed.
✓ built in 6.36s
(one pre-existing, unrelated informational warning about a >500kB chunk --
same warning present before this task's changes, not a new regression)

$ npm run format:check
Checking formatting...
All matched files use Prettier code style!
(round 2 note: the first `format:check` run after adding the new
`Kiosk.test.tsx` test failed on quote style in the new test's title string;
ran `npx prettier --write src/pages/meetings/Kiosk.test.tsx` to fix it --
the only formatting fix needed, re-confirmed clean afterward)

$ npx vitest run
 Test Files  61 passed (61)
      Tests  1432 passed (1432)
```

Baseline was **1414 tests / 61 files**. Final is **1432 tests / 61 files**:
+18 tests total, in three places:
- +14 in `AppShell.test.tsx` (round 1, the `describe('T134 chromeless
  pattern matching (UXC-12)')` block).
- +1 in `Kiosk.test.tsx` (round 2, the escape-link pinning test).
- +3 in `LiveConsole.test.tsx` (round 2, the three per-state `<h1>` pinning
  tests).

File count is unchanged (61) because the two throwaway test files created
during verification were both deleted before every final run. **No existing
test's assertions were touched or weakened** — confirmed via `git diff`:
`AppShell.test.tsx`'s, `Kiosk.test.tsx`'s, and `LiveConsole.test.tsx`'s
diffs each show only new `it(...)`/`describe(...)` blocks (plus one new
`import` line in `Kiosk.test.tsx`) appended; every pre-existing test in all
three files is byte-identical to before this task, including
`Kiosk.test.tsx:193-199` (the T103 disclosure-banner-absence test the
packet explicitly forbade touching -- originally cited at `:173-179`; only
the line number moved, due to new content added earlier in the file, not
the test itself).

## Throwaway rig (deleted before finishing)

Three throwaway artifacts were used and removed; `git status --short`
(reproduced below) confirms none remain:

1. `capture.throwaway.html` + `src/capture.throwaway.tsx` — a minimal Vite
   entry mounting the real `AppShell` + real `KioskPage`/`LiveConsolePage`/
   `RosterShell` inside a `MemoryRouter`, logged in via the real `LoginAs`
   test harness (`src/test-utils/authHarness.tsx:131`), selecting a page via
   `?page=kiosk|live|roster`. Served via a plain `npx vite --port 4174` dev
   server (not `build`/`preview`, since the throwaway HTML entry is not part
   of the production build's `index.html`). Kiosk was given
   `fixtureLoadKioskDisplayToken` plus locally-stubbed tally/title loaders
   (`{ checkedIn: 12, expected: 18 }` / `{ title: 'Tuesday Build Meeting' }`)
   as its own props, per the packet's explicit instruction; LiveConsole and
   RosterShell needed no props (see §9's captures table).
2. A Playwright script (kept only in the session scratch directory, never
   inside the repo) drove real Chromium
   (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`) against that rig:
   for each of 3 pages × 2 viewports (1440×900, 375×812) × 2 color schemes
   (`colorScheme: 'light'|'dark'`, the same Playwright mechanism
   `playwright.config.ts`'s own four projects already use), it navigated,
   waited for network-idle + a short settle delay, took a full-page PNG
   screenshot, and recorded `role="main"` presence + horizontal-scroll
   presence. PNGs were converted to `.webp` via Python's Pillow (`PIL`,
   already available in this sandbox; there is no `cwebp`/ImageMagick here)
   and the PNGs deleted, leaving only the 12 `.webp` files.
3. `src/app/T134-guard-denial.throwaway.test.tsx` — see §7.

See the "Files changed" section at the top for the final, post-round-2
`git status --short` (no throwaway artifacts remain in either round's
final state).

## Anything unverified (stated plainly)

1. ~~No dedicated automated test asserts `FALLBACK_SESSION_TITLE` text
   specifically appears as LiveConsole's `<h1>` during the loading/error
   states~~ — **resolved in round 2.** Three new tests in
   `LiveConsole.test.tsx` now pin exactly this (see §5/§10). No longer
   unverified.
2. **`RequireAuth`'s `noProfile` → chromeless `NoAccessPage` case** was
   confirmed only by reading `guards.tsx` directly (structurally identical
   mechanism to the `RequireRole` case that the checker independently
   executed and confirmed correct), not independently executed in a browser
   or test (see §7). Still unverified-by-execution; not addressed in round 2
   since it was not one of the two rework items requested.
3. **Packet §4's roster-figure deliverable (a current figure showing the
   roster table and its seams) could not be produced in this environment**
   — see the new "Dispute" section immediately below. This replaces item 3
   from the original submission ("the previous `new-roster.webp`'s
   populated-looking data was not reproduced"), which undersold the problem:
   it is not merely that I didn't reproduce the old figure, it's that §4's
   actual deliverable is not achievable here at all with the files available
   to this task.
4. **Kiosk visual "quietness" of the escape link** was judged by eye against
   the captures (small, muted link color, no visual competition with the
   QR/tally) rather than measured against any numeric design-token
   threshold — there is no documented "low-prominence" spec to check
   against beyond the packet's own qualitative wording.

## Dispute (filed in round 2 — packet §4 is unachievable as specified)

**Claim:** Packet §4's deliverable — "Replace the stale figure; change no
code. Capture `/roster` at 1440px and 375px, light and dark" — implicitly
assumes the resulting figure shows the roster page in a normal, working
state (the packet frames this as settling a withdrawn claim about "visible
seams" in "the roster table"). That deliverable is **not achievable** by
any worker operating under this packet's own constraints, for a mechanical
reason, not a matter of effort or cleverness:

- `RosterShell.tsx`/`StudentsTab.tsx` (and the other three roster tabs) take
  **no injectable data-loading props** — unlike `Kiosk.tsx` (which exposes
  `loadDisplayToken`/`loadTally`/`loadSessionTitle` seams this task's own
  packet explicitly told me to use) and unlike `LiveConsole.tsx` (whose
  *default* loader is already fixture data, needing no override). Roster's
  tabs call their real Supabase-backed loaders unconditionally, with no seam
  to substitute fixture data through.
- **No `.env` exists in this sandbox** (confirmed repeatedly throughout this
  task and independently by `playwright.config.ts`'s own module doc), so
  those real loaders always reject with `SupabaseNotConfiguredError`. There
  is no way to make `/roster`'s tab content render populated data in this
  environment without either (a) a real configured Supabase backend, which
  does not exist here, or (b) writing code into `RosterShell.tsx`/
  `StudentsTab.tsx`/`src/pages/roster/**` to add an injectable seam or a
  fixture default — and `src/pages/roster/**` is this task's own Forbidden
  Files list, "capture only," with §4 itself saying "change no code."
- The packet's own words for §4 are internally in tension: "change no
  code" + "capture a figure showing the table and its seams" are only both
  satisfiable if the environment already has a way to render that table
  populated without code changes. It doesn't. Under constitution item 1,
  that combination — an achievable-sounding deliverable that is actually
  blocked by an environment fact the packet didn't account for — is exactly
  what should be escalated as a dispute rather than worked around with a
  capture that either fakes data (out of scope, and this task has no
  fixture seam to fake it with) or ships something that doesn't serve the
  stated purpose (what round 1 did, and which the checker correctly
  rejected).

**What I did instead:** left `new-roster.webp` untouched (reverted the
round-1 overwrite), captured the four `t134-roster-*.webp` files showing the
real, current, honest state of `/roster` in this environment (chrome
present, tab content in a real Supabase-not-configured error state), and am
recording this dispute here rather than in `dispute-log.md` (forbidden to
workers) so the orchestrator can carry it across and a future task that
actually needs a populated roster figure is scoped with either (a) a real
`.env`/backend available, or (b) explicit authorization to add an
injectable loader seam to `RosterShell.tsx`/`StudentsTab.tsx` for capture
purposes.

**Everything else:** the packet's citations, prescribed snippet, and other
pre-resolved questions (matchPath behavior, `SeasonProvider`
non-consumption, the banner corrections) were all re-verified directly
against the current source and found accurate — no other conflict with the
current codebase was found that would
require a dispute.

I am not marking this task complete; an independent checker reviews this
artifact.
