# Worker Packet: T134 — chromeless projection routes (UXC-12) + roster re-capture

Wave 5, packet W5-P3c. Runs in parallel with T132 and T133 in a separate
worktree; their files are forbidden here and yours are forbidden there.

## Objective

The kiosk and the live console are meant to be **fullscreen projection
surfaces** (PRD v1 §7.1 "fullscreen", §4.2 wireframe). They currently render
inside the full app chrome — top nav, side nav, and the KPI strip — because the
chromeless check cannot match their routes.

## 1. UXC-12 — the chromeless check never fires

`src/app/AppShell.tsx:96-98`:

```tsx
const isChromeless =
  location.pathname === routePaths.login || location.pathname === routePaths.acceptInvite;
```

Exact string equality against two static paths. The projection routes are
**parameterised**, so they can never match:

- `/kiosk/:sessionId` — `router.tsx:197-201`, `routePaths.kioskSession(id)` (`:167`)
- `/meetings/live/:sessionId` — `router.tsx:225-228`,
  `routePaths.meetingLiveSession(id)` (`:166`)

Both are genuinely routed and genuinely rendering (`KioskPage` `:200`,
`LiveConsolePage` `:228`) — this is not a hypothetical.

Replace the equality check with real pattern matching. `matchPath` from
`react-router-dom` is already this app's router and handles the param segments
correctly; prefer it over `startsWith`, which would also match a future
`/kiosk-settings`. Match on the **route patterns**, not on constructed paths.

Keep `/login` and `/accept-invite` chromeless — they are today and must stay so.

When chromeless, the component returns `<>{children}</>` (`:100-102`), which
also bypasses `SeasonProvider` and `KpiStrip`. **Verify that both projection
pages still render correctly without `SeasonProvider` in their tree.** If either
consumes `useActiveSeason()`, say so and stop rather than working around it —
that is a real architectural question, not a judgement call for a worker.

## 2. Roster — re-capture only, no code change

The PRD lists the roster under this wave because an earlier review claimed its
table lacked visible seams. **That claim was withdrawn — the seams exist.** The
task here is to replace the stale figure, not to change any code.

Capture `/roster` fresh at 1440px and 375px, light and dark, and save as
`.webp`. Do not edit `src/pages/roster/**`.

## 3. Verify the disclosure banners are still accurate

`LiveConsole.tsx:778-782` renders a permanent warning:

> "This QR code and check-in code aren't live yet" /
> "Scanning or entering them won't check anyone in. A real, working code isn't
> ready yet."

Earlier PRD notes describe this copy as stale and jargon-laden. It is neither
any more — T129's UXC-10 sweep already rewrote it. **Confirm two things and
change nothing unless one is false:**

1. The copy contains no internal jargon (no task IDs, no "fixture", no "stub").
2. Its claim is still **true** — that the check-in code is not yet issuable.
   Module doc GAP #1 records that the `checkin` Edge Function only *validates*
   a presented token and nothing issues one. If that has since changed, the
   banner is now lying and must be removed; report it rather than guessing.

Do the same for the equivalent disclosure on `Kiosk.tsx`.

Removing an honest warning is worse than leaving it. The bar for deleting one
is proof the underlying gap is closed.

## Allowed Files

- `src/app/AppShell.tsx`
- `src/app/AppShell.test.tsx`
- `src/pages/meetings/Kiosk.tsx`, `src/pages/meetings/Kiosk.test.tsx`
- `src/pages/meetings/LiveConsole.tsx`, `src/pages/meetings/LiveConsole.test.tsx`
- `docs/swarm/active/T134-worker-output.md` (create)
- New `.webp` figures under `docs/swarm/figures/ux-craft/`

## Forbidden Files

- `src/pages/meetings/MeetingsList.tsx` — **same directory, different task.**
  T135 migrates it next wave; touching it now creates a conflict.
- `src/pages/outreach/**`, `src/pages/calendar/**` — **T132 and T133 are
  running concurrently.**
- `src/app/router.tsx` — read it, do not edit it. The route patterns are correct
  as they stand; the defect is in `AppShell`'s matching, not the route table.
- `src/pages/roster/**` — capture only.
- `docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`,
  `dispute-log.md`, `.claude/**`, `supabase/migrations/**`.

## Traps

1. **`AppShell` is shared by every route in the app.** A matching bug here
   silently strips navigation from ordinary pages. Assert explicitly that `/`,
   `/meetings`, `/outreach`, `/calendar`, `/roster`, `/reports`, and `/settings`
   still render the chrome.
2. **`/meetings/live/:sessionId` is a prefix of nothing, but `/meetings` is a
   prefix of it.** A naive `startsWith('/meetings')` would strip chrome from the
   entire meetings section. This is the specific mistake to avoid.
3. **Chromeless bypasses `SeasonProvider`, not just the visual chrome**
   (`:100-102`). That is a behavioural change for these two pages, not a
   cosmetic one. Check before you ship.
4. **`KpiStrip` also disappears.** That is intended for a projection surface —
   confirm neither page depended on it being mounted.
5. Existing tests for `AppShell` may assert the current chromeless set. Extend
   them; do not weaken them.
6. Do not certify your own work.

## Acceptance Criteria

1. `/kiosk/:sessionId` and `/meetings/live/:sessionId` render with **no** top
   nav, side nav, or KPI strip — verified in the DOM, not by reading code.
2. `/login` and `/accept-invite` are still chromeless.
3. All seven ordinary routes listed in Trap 1 still render full chrome, each
   asserted in a test.
4. Both projection pages render correctly without `SeasonProvider`; state
   explicitly how you verified it.
5. Both disclosure banners verified against §3 — either unchanged with the
   verification recorded, or changed with the evidence that justified it.
6. **Captures at 1440px and 375px, light and dark**, as `.webp`, for the kiosk,
   the live console, and the roster (UXC-13/14).
7. At 375px on both projection pages: no page-level horizontal scroll
   (`document.documentElement.scrollWidth === innerWidth`).
8. `npx tsc --noEmit`, `npx eslint .`, `npx vite build`,
   `npm run format:check` clean.
9. `npx vitest run` green. Baseline **1414 / 61 files**. New tests are expected;
   any *existing* test that changes content is a regression — report it, don't
   silence it.

## Relevant Constitution Excerpt

- Item 2 — Astryx props come only from `astryx-api.md`. `matchPath` is
  `react-router-dom`, an allowlisted dependency (item 9), not an Astryx prop.
- Item 12 — every async screen ships all four states; do not regress the
  projection pages' loading/error states while restructuring their frame.
- Item 15 — accessibility is a shipping requirement. Removing nav from a route
  must not strip its only means of orientation; confirm each projection page
  still has a heading and an escape path.
- Non-Negotiables — existing tests pass; no worker self-certifies.

## Required Worker Output

`docs/swarm/active/T134-worker-output.md`:

- The matching mechanism you chose and why, with the DOM evidence that chrome is
  absent on both projection routes and present on all seven ordinary ones.
- How you verified both pages survive without `SeasonProvider`.
- The banner verification result for each page, with the evidence.
- Paths of all twelve captures.
- Full output of the commands in criteria 8–9.
- Anything unverified, stated plainly as unverified.

Use a throwaway rig for captures (`*.throwaway.*` is gitignored; Chromium at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; `LoginAs` from
`src/test-utils/authHarness.tsx:131`). **Delete it before finishing.**
