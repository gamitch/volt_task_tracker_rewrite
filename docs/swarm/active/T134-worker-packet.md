# Worker Packet: T134 — chromeless projection routes (UXC-12) + roster re-capture

**Revision 2** (2026-07-28), after `checker-premise` returned REVISE on
revision 1 with **2 BLOCKERs**, 3 MAJORs and 4 MINORs. Both BLOCKERs came from
revision 1 trusting stale module-doc comments in the source instead of the
current code. Round 1 of the 2 permitted by constitution item 19a.

Wave 5, packet W5-P3c. Runs in parallel with T132 and T133 in a separate
worktree. **Verified disjoint:** the only files in the whole suite that render
through `AppShell` are `src/app/AppShell.test.tsx` and
`src/theme/theme.smoke.test.tsx` — neither `OutreachList.test.tsx` nor
`CalendarPage.test.tsx` does, so your change cannot break their tests.

## Objective

The kiosk and the live console are meant to be **fullscreen projection
surfaces** (PRD v1 §7.1 "fullscreen", §4.2 wireframe). They render inside the
full app chrome because the chromeless check cannot match their routes.

## 1. UXC-12 — the chromeless check never fires

`src/app/AppShell.tsx:97-98`:

```tsx
const isChromeless =
  location.pathname === routePaths.login || location.pathname === routePaths.acceptInvite;
```

Exact string equality against two static paths. The projection routes are
**parameterised**, so they can never match:

- `/kiosk/:sessionId` — `router.tsx:197`, element at `:201`
- `/meetings/live/:sessionId` — `router.tsx:225`, element at `:228`

Both are genuinely routed and rendering: `router.tsx:124-125` lazy-imports the
real components. *(Module-doc comments at `LiveConsole.tsx:42-48` and
`Kiosk.tsx:20-28` claim the router still mounts an inline placeholder. Those are
**stale** — T074 wired both. Fix them; see §5.)*

**Ship this shape** — a local constant, no new module, no `router.tsx` edit:

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

`matchPath` comes from `react-router-dom` (v7.18.1, allowlisted under
constitution item 9). Runtime-verified behaviour:
`matchPath('/kiosk/:sessionId', '/kiosk/abc-123')` matches;
`matchPath('/kiosk/:sessionId', '/kiosk-settings')` does **not**;
`matchPath('/meetings', '/meetings/live/xyz')` does **not**. Static paths match
themselves as patterns, so `/login` and `/accept-invite` keep working.

Note in your output that `matchPath` is **case-insensitive by default**
(`/KIOSK/abc` matches). That is consistent with how `<Routes>` resolves the same
URL, so it is correct — record it so a checker does not flag it.

**`SeasonProvider` — already answered, do not re-investigate.** Going chromeless
returns `<>{children}</>` (`:100-102`), bypassing `SeasonProvider` and
`KpiStrip`. Neither projection page, nor anything they transitively import,
consumes `useActiveSeason()` — there are 20 consumer files and neither is among
them. Kiosk imports only `loaders/kiosk` (plain async, no React context);
LiveConsole imports `guards` and `routePaths`. Confirm this holds and move on.

## 2. Accessibility work this change creates

Removing the chrome removes more than navigation. **All three of these are in
scope** — they are consequences of your change, not pre-existing debt.

**(a) `Kiosk.tsx` has no escape path at all.** `:406-478` contains zero `Link`,
zero `href`, zero navigating button. Its only route away today is the nav you
are deleting. Add one low-prominence link back to `/meetings`, using the idiom
`LiveConsole.tsx:1012-1014` already establishes
(`<Link as={RouterLink} href={routePaths.meetings}>`). Keep it visually quiet —
this is projected on a wall — but present, because the same URL is reachable by
a signed-in coach on a laptop.

**(b) `LiveConsole.tsx:1018` renders its only `<Heading level={1}>` inside the
`session !== null` branch.** The loading (`:1037`) and error (`:1054`) branches
have no heading at all. With the chrome gone, those states have no heading
anywhere on the page. Make the `<h1>` unconditional.

**(c) The `role="main"` landmark and the skip link disappear with the chrome.**
Astryx's `AppShell` supplies both — `dist/AppShell/AppShell.js:396`
(`role: "main"`) and `:461-462` (`"Skip to content"`). Losing them is arguably
correct for a single-purpose projection surface with no nav to skip past.
**Decide explicitly and record the decision in your output.** If you keep the
loss, confirm each page still has one unambiguous top-level heading, which is
what (a) and (b) are for. Do not silently ship it unremarked — note that
`AppShell.test.tsx:105,112` uses `querySelector('[role="main"]') === null` as
its *proof* of chromelessness, so your new tests will formally lock this in.

## 3. The disclosure banners — read this carefully

Revision 1 got both of these backwards. The corrected facts:

**LiveConsole's banner stays.** `LiveConsole.tsx:778-782` warns that the QR and
check-in code aren't live. Revision 1 claimed nothing can issue a token and told
you to delete the banner if that had changed. **It has changed** —
`supabase/functions/checkin-token/index.ts:428-431` mints real tokens
(`bucketFor`/`tokenFor`/`shortCodeFor`), shipped by T103 (Passed). **But the
banner is still true**, because `LiveConsole.tsx:871` still defaults to
`fixtureLoadLiveConsoleDisplayToken`, which returns
`FIXTURE-LIVE-CONSOLE-NOT-A-REAL-TOKEN` (`:440-447`). The endpoint exists; this
page was never wired to it.

So: **do not delete the banner, and do not wire the loader.** Earning the
banner's removal means swapping in `loadKioskDisplayToken`
(`src/lib/supabase/loaders/kiosk.ts:338`, whose return type is a superset of
`LiveConsoleDisplayToken`) — real work, deliberately **out of scope here**, and
banked as a follow-up. Verify only that the copy carries no jargon (no task IDs,
no "fixture", no "stub") and leave it alone.

**Kiosk has no disclosure banner. Do not add one.** T103 removed both
(`Kiosk.tsx:155-161`), and `Kiosk.test.tsx:173-179` is currently green pinning
their absence:

```
expect(container.textContent).not.toContain('fixture data');
expect(container.textContent).not.toContain('not wired');
```

Adding a disclosure reverses T103, a Passed task, and breaks that test. That
test file is in your Allowed Files — **do not modify that test.** Kiosk's one
remaining `Banner` (`:425-429`, "No session selected") is a real empty state for
a missing route param. Leave it.

## 4. Roster — re-capture only, no code change

An earlier review claimed the roster table lacked visible seams. **That claim
was withdrawn — the seams exist.** Replace the stale figure; change no code.

Capture `/roster` at 1440px and 375px, light and dark. **Overwriting
`docs/swarm/figures/ux-craft/new-roster.webp` is authorized.**

## 5. Stale comments to fix while you are in these files

`LiveConsole.tsx:42-48` and `Kiosk.tsx:20-28` both claim `router.tsx` renders an
inline placeholder rather than importing the real component. T074 wired both.
These comments cost this task's premise review real time and will cost the next
reader the same. Correct them.

## Allowed Files

- `src/app/AppShell.tsx`, `src/app/AppShell.test.tsx`
- `src/pages/meetings/Kiosk.tsx`, `src/pages/meetings/Kiosk.test.tsx`
- `src/pages/meetings/LiveConsole.tsx`, `src/pages/meetings/LiveConsole.test.tsx`
- `docs/swarm/active/T134-worker-output.md` (create)
- `.webp` figures under `docs/swarm/figures/ux-craft/`, including overwriting
  `new-roster.webp`

## Forbidden Files

- `src/pages/meetings/MeetingsList.tsx` — same directory, different task (T135).
- `src/pages/outreach/**`, `src/pages/calendar/**` — T132 and T133 are running
  concurrently.
- `src/app/router.tsx` — read it, do not edit it. The route table is correct;
  the defect is in `AppShell`'s matching.
- `src/theme/theme.smoke.test.tsx` — **it renders `<App />` (`:19,31`), which
  mounts `AppShell`, so it is downstream of your change and you cannot edit it.**
  Risk is low (jsdom's default URL is `/`, hitting the chrome branch), but if it
  breaks, report it rather than working around it.
- `src/pages/roster/**` — capture only.
- `docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`,
  `dispute-log.md`, `.claude/**`, `supabase/**`.

## Traps

1. **`AppShell` is shared by every route.** A matching bug silently strips
   navigation from ordinary pages.
2. **`/meetings` is a routed path in its own right** (`router.tsx:217`), and
   `/settings` is a prefix of `/settings/season` (`:301`). A naive
   `startsWith` would strip chrome from whole sections. This is the specific
   mistake to avoid.
3. **`/outreach/:eventId` (`router.tsx:249`) is the other parameterised route** —
   the one a sloppy pattern list catches by accident. It **must** keep its
   chrome, and must be asserted.
4. Chromeless bypasses `SeasonProvider` and `KpiStrip`, not just visuals
   (`:100-102`). Already resolved above as safe — confirm, don't re-derive.
5. It also removes `role="main"` and the skip link. See §2(c).
6. **Do not modify `Kiosk.test.tsx:173-179`.** See §3.
7. Existing `AppShell` tests pin the current chromeless set
   (`AppShell.test.tsx:99,109`). Extend them; do not weaken them. The
   `renderAt(path, user)` harness at `:76-93` already does what you need — a
   loop over a path array, not new infrastructure.
8. Do not certify your own work.

## Acceptance Criteria

1. `/kiosk/:sessionId` and `/meetings/live/:sessionId` render with **no** top
   nav, side nav, or KPI strip — verified in the DOM, not by reading code.
2. `/login` and `/accept-invite` still chromeless.
3. **All ten of these still render full chrome, each asserted:** `/`,
   `/meetings`, **`/outreach/:eventId`**, `/outreach`, `/calendar`, `/checkin`,
   `/roster`, `/reports`, `/settings`, `/settings/season`.
4. Neither projection page regresses without `SeasonProvider`; state how you
   confirmed it.
5. Kiosk has a working escape path to `/meetings`; LiveConsole renders an `<h1>`
   in **all** of loading, error, and populated states.
6. The `role="main"`/skip-link decision is recorded with reasoning.
7. LiveConsole's banner is unchanged and jargon-free; Kiosk has no disclosure
   banner added and `Kiosk.test.tsx:173-179` is untouched and green.
8. Both stale module-doc comments corrected.
9. **Captures at 1440px and 375px, light and dark**, as `.webp`, for kiosk, live
   console, and roster. **The rig must inject `fixtureLoadKioskDisplayToken`
   (`Kiosk.tsx:277`) and stubbed tally/title** — no `.env` exists, so the real
   loaders reject and you would otherwise capture an empty shell reading "QR not
   available yet" / `------`. If you capture the empty state anyway, say so
   plainly rather than presenting it as the real screen.
10. At 375px on both projection pages: no page-level horizontal scroll. This
    evidence lives only in your output doc — the rig is deleted, so it is not a
    persisted regression check. Say so.
11. `npx tsc --noEmit`, `npx eslint .`, `npx vite build`,
    `npm run format:check` clean.
12. `npx vitest run` green. Baseline **1414 / 61 files**. New tests expected; any
    *existing* test that changes content is a regression — report it, don't
    silence it.

## Relevant Constitution Excerpt

- Item 9 — dependency allowlist. `matchPath` is `react-router-dom`, already
  allowlisted. No new dependency.
- Item 12 — all four async states. Your `<h1>` fix touches loading and error;
  do not regress either.
- Item 15 — accessibility is a shipping requirement; keyboard-path failures on
  core flows → BLOCKER. §2 exists because this change creates three.
- Non-Negotiables — existing tests pass; no worker self-certifies.

## Required Worker Output

`docs/swarm/active/T134-worker-output.md`:

- The matching mechanism, with DOM evidence that chrome is absent on both
  projection routes and present on all ten ordinary ones.
- The `matchPath` case-insensitivity note.
- How you confirmed both pages survive without `SeasonProvider`.
- The `role="main"`/skip-link decision and its reasoning.
- Evidence for the Kiosk escape path and LiveConsole's unconditional `<h1>`.
- The banner verification result for each page, and explicit confirmation you
  added nothing to Kiosk.
- Paths of all twelve captures, and whether each shows real or stubbed data.
- Full output of the commands in criteria 11–12.
- Anything unverified, stated plainly as unverified.

Use a throwaway rig (`*.throwaway.*` is gitignored; Chromium at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`; `LoginAs` from
`src/test-utils/authHarness.tsx:131`). **Delete it before finishing.**
