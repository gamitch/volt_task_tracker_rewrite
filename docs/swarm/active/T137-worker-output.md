# Worker Output: T137 — stop calendar meeting rows linking to a route that does not exist (D009)

## Packet SHA verified

`git log -1 --format=%H -- docs/swarm/active/T137-worker-packet.md` →
`75ca794ca7785751b6fcf9948ba08912f754a054` — matches the SHA named in the
dispatch prompt (revision 3).

## Pre-work merge

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```

Fast-forward, no conflicts: `2146255..75ca794`. Reported per the packet's
"FIRST" instruction before any other work.

## The change

In `src/pages/calendar/CalendarPage.tsx`, `detailHrefFor`'s meeting branch now
returns `routePaths.meetings` instead of the hand-built
`` `/meetings/${session.id}` ``. The outreach branch
(`routePaths.outreachEvent(event.id)`) is untouched. Since `session` is no
longer read in the meeting branch, it's marked `void session;` — the same
intentional-unused idiom already established in
`AcceptInvitePage.tsx`'s `defaultLoadInvite` / `accept.ts`'s loader — rather
than removed from the signature (both branches still take the same
`(event, session)` shape; `tsconfig.json`'s `noUnusedParameters: true` would
otherwise fail `tsc --noEmit`).

## Criterion 3 — every href the calendar can render, matched against `router.tsx`

`detailHrefFor(event, session)` has exactly two branches; every session row's
`href` is one of these two shapes, regardless of month, filter, or which of
the three `CalendarEventType`s (`'meeting' | 'outreach' | 'competition'`) the
row is:

| Branch | Condition | Href produced | Declared in `router.tsx`? |
|---|---|---|---|
| Meeting | `event.type === 'meeting'` | `routePaths.meetings` → `'/meetings'` (constant, same for every meeting row) | Yes — `<Route path="/meetings" element={<RequireAuth><MeetingsList /></RequireAuth>} />` (`router.tsx:216-223`) |
| Outreach/competition | `event.type !== 'meeting'` (i.e. `'outreach'` or `'competition'` — the `else` branch is not itself type-narrowed to `'outreach'` only) | `routePaths.outreachEvent(event.id)` → `` `/outreach/${event.id}` `` | Yes — `<Route path="/outreach/:eventId" element={<RequireAuth><OutreachDetail /></RequireAuth>} />` (`router.tsx:248-255`) |

No third branch exists. The default July 2026 render (the fixture month) is
one instance of this — 2 meeting-type sessions (`session-build-past`,
`session-build-upcoming`, both under the one `event-weekly-build` event) and
2 outreach-route sessions (`session-food-bank` under `event-food-bank-sort`,
`session-regional-july` under `event-regional-qualifier`, a `competition`
event routed through the same outreach branch) — 4 anchors total, all
resolving to declared routes. Navigating to August (`session-regional-august`,
same `event-regional-qualifier` competition event) or applying any
`CALENDAR_FILTER_ITEMS` filter only changes *which* of these two href shapes
get rendered and how many, never introduces a third shape — `filterByType`
subsets the enriched-session array before render; it does not touch
`detailHrefFor`. So every href the calendar can ever render, across both
branches and every month/filter state, resolves to a route in the table
above. `router.tsx` itself was not modified (Forbidden File) — verified by
`git status`/`git diff` below showing only the two Allowed test/component
files touched.

## The six sites (Traps), before/after

**1. `:461`** (original line numbering; test file grew by the new
`routePaths` import line, so this is now further down) — `a.getAttribute(
'href') === '/meetings/session-build-upcoming'` inside "two different rows
render different link text/accessible names...".

- Before: `links.find((a) => a.getAttribute('href') === '/meetings/session-build-upcoming')`
- After: `links.find((a) => a.getAttribute('href') === routePaths.meetings)`
- Both fixture meeting sessions now share the same href, so `.find()` returns
  whichever meeting row is first in DOM order. That's fine here — the
  assertion only checks the found link's text contains `'Weekly Build
  Meeting'`, which is true for both meeting sessions (they share one event),
  so it doesn't need to key off a specific row/text as the packet flagged as
  a possible necessity.

**2. `:487` + `:489`** (the pair) — filter regex + count, inside "every
rendered row link IS the event title itself...".

- Before:
  ```js
  const links = Array.from(container.querySelectorAll('a')).filter((a) =>
    (a.getAttribute('href') ?? '').match(/^\/(meetings|outreach)\//),
  );
  expect(links.length).toBeGreaterThanOrEqual(4);
  ```
- After:
  ```js
  const links = Array.from(container.querySelectorAll('a')).filter((a) =>
    (a.getAttribute('href') ?? '').match(/^\/(meetings|outreach)(\/|$)/),
  );
  expect(links.length).toBe(4);
  expect(links.filter((a) => a.getAttribute('href') === routePaths.meetings).length).toBe(2);
  ```
  This is the packet's corrected snippet verbatim (`links.filter(...)`
  operating on `HTMLAnchorElement[]`, not a string comparison).
- The regex now matches the bare `/meetings` href (no trailing slash) in
  addition to `/outreach/:eventId`, so meeting rows are collected again. The
  count assertion is tightened, not relaxed: `toBe(4)` (was
  `toBeGreaterThanOrEqual(4)`) plus a new, stricter check that exactly 2 of
  those 4 point at `routePaths.meetings`. A future narrowing of the regex
  that dropped meeting rows again would fail both the `toBe(4)` total and the
  meeting-share count — confirmed by construction, not just asserted (see
  "Before/after of `:489`" section below for the explicit reasoning).

**3. `:492-496`** — the ternary deriving each row's expected title from its
href, in the same test/loop as site 2.

- Before:
  ```js
  const expectedTitle = href.startsWith('/meetings/')
    ? eventById.get(
        sessions.find((s) => s.id === href.replace('/meetings/', ''))?.eventId ?? '',
      )?.title
    : eventById.get(href.replace('/outreach/', ''))?.title;
  ```
- After (rewrote the meeting branch in place — did not take the split-into-
  new-`it()` option, since the in-place rewrite fully preserves coverage
  without changing the test count):
  ```js
  const { events } = await defaultLoadCalendarSessions(); // `sessions` dropped -- no longer read
  const eventById = new Map(events.map((event) => [event.id, event] as const));
  const meetingEventTitle = events.find((event) => event.type === 'meeting')?.title;
  ...
  const expectedTitle =
    href === routePaths.meetings
      ? meetingEventTitle
      : eventById.get(href.replace('/outreach/', ''))?.title;
  ```
  Coverage kept: every meeting-route link's text is still asserted to equal
  the fixture meeting event's title (`'Weekly Build Meeting'`) and to not
  contain `'View details'`, same as before, just looked up from the fixture
  `events` array directly instead of round-tripping through a session id
  that the href no longer carries. `sessions` was removed from the
  destructure since nothing in the rewritten test reads it anymore (kept it
  would have been an unused-variable lint/`tsc` failure).

**4. `:538`** — test name, in the `'NAV-08 click-through hrefs (CAL-02)'`
describe block.

- Before: `'a meeting row links to /meetings/:sessionId'`
- After: `'a meeting row links to routePaths.meetings -- interim destination pending NAV-08 (D009), not the unbuilt /meetings/:sessionId'`

**5. `:544`** — same href lookup pattern as site 1, in the renamed test from
site 4.

- Before: `links.find((a) => a.getAttribute('href') === '/meetings/session-build-upcoming')`
- After: `links.find((a) => a.getAttribute('href') === routePaths.meetings)`

Plus the import line: added `import { routePaths } from '../../app/router';`
to `CalendarPage.test.tsx`, matching `Kiosk.test.tsx:165`'s existing use of
the same helper rather than a hardcoded string.

**Trap 3's split option was not taken.** The meeting branch was rewritten in
place (option 1 of the two the packet offered) rather than split into a new
`it()`. Coverage of meeting-row title text is fully retained inside the
existing test; no new test block was added, and the total test count did not
change (see below).

## Before/after of `:489`, showing tightening not relaxation

- Before: `expect(links.length).toBeGreaterThanOrEqual(4);` — a floor, would
  silently tolerate 5, 6, or any larger count without failing.
- After:
  ```js
  expect(links.length).toBe(4);
  expect(links.filter((a) => a.getAttribute('href') === routePaths.meetings).length).toBe(2);
  ```
  An exact count plus a second exact assertion on the meeting-route share of
  that count. This is strictly stronger: the old assertion passed for any
  `links.length >= 4`; the new pair passes only for exactly 4 links with
  exactly 2 of them pointing at `routePaths.meetings`. If the `:487` regex
  were narrowed again in a way that dropped meeting rows from the filtered
  collection (reproducing the original defect this packet warned about), the
  collection would drop to 2, and `expect(links.length).toBe(4)` would fail
  loudly rather than the old assertion silently continuing to pass (since 2
  is not `>= 4`, the old form would *also* have failed here, but the new form
  additionally catches a regression that dropped one type's rows while
  fabricating enough of the other type to still clear a `>= 4` floor — a
  scenario the old assertion could not have caught at all).

## Test count

Started from and ended at **1440 tests across 62 files** — the packet's
stated baseline. Did not take Trap 3's split option, so no new test was
added; every change was an amendment to the six named assertion sites within
already-existing tests, none deleted, none added.

## Full command output

### `npx tsc --noEmit`

No output (clean).

### `npx vite build`

```
vite v5.4.21 building for production...
transforming...
✓ 2386 modules transformed.
rendering chunks...
computing gzip size...
[... asset list omitted, all chunks emitted successfully ...]
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
✓ built in 5.58s
```

The large-chunk advisory is a pre-existing Rollup informational note (present
before this change too, unrelated to `CalendarPage.tsx`'s own ~7 KB chunk);
the build itself succeeded with no errors.

### `npm run format:check`

First run flagged `src/pages/calendar/CalendarPage.test.tsx` for formatting
(my edit didn't match Prettier's line-wrapping for a couple of the new
lines). Ran `npx prettier --write src/pages/calendar/CalendarPage.test.tsx`,
then re-ran `format:check`:

```
> volt-team-portal@0.0.0 format:check
> prettier --check "src/**/*.{ts,tsx}" "!src/theme/volt.ts" "*.{ts,js,json,html}"

Checking formatting...
All matched files use Prettier code style!
```

### `npx eslint .`

```
✖ 353 problems (0 errors, 353 warnings)
  0 errors and 1 warning potentially fixable with the `--fix` option.
```

0 errors, 353 warnings — matches the packet's stated baseline exactly (no new
warnings introduced).

### `npx vitest run`

```
 Test Files  62 passed (62)
      Tests  1440 passed (1440)
   Start at  23:42:19
   Duration  44.97s
```

All 62 files, all 1440 tests green. `CalendarPage.test.tsx` is included in
that count (all its tests pass, including the six amended sites).

## Files changed

- `src/pages/calendar/CalendarPage.tsx` — `detailHrefFor` (return value +
  comment), the section header above it, and module doc #7. Nothing else in
  the file touched (confirmed by `git diff` — diff is scoped to lines
  172-207 and 596-620 of the current file, i.e. exactly the Allowed regions).
- `src/pages/calendar/CalendarPage.test.tsx` — the six named sites, the new
  `routePaths` import line, and the Prettier reformatting of the touched
  lines. No other test in the file modified.
- `docs/swarm/active/T137-worker-output.md` (this file, created).

`router.tsx` was not touched — confirmed via `git status --porcelain`, which
lists only the two files above as modified.

## Known risks / anything unverified

- I did not visually render the app in a browser to confirm clicking a
  meeting row lands on `/meetings` in practice; this rests on the automated
  test suite (which does assert the href attribute directly) and on manual
  cross-reference against `router.tsx`'s route table, not on a live
  click-through. Labeling this **unverified** by direct browser
  observation.
- The disclosed consequence (all meeting rows now share one destination) is
  as described in the packet; I did not independently re-derive a WCAG
  2.4.4 conformance judgment beyond re-checking the packet's own claim
  against the fixture data (both fixture meeting sessions do belong to the
  same event and already rendered identical link text before this change,
  confirmed by reading `CalendarPage.tsx:359-366` (`FIXTURE_EVENTS`) and
  `:383-399` (`FIXTURE_SESSIONS`) directly).
- I did not check downstream consumers of `CalendarPage.tsx` (if any) beyond
  what `tsc --noEmit` and `npx vite build` would already have caught via
  type/module resolution errors.

## Dispute

None filed. I found no factual error or infeasibility in this packet
(revision 3) during implementation — the corrected Trap 2 snippet typechecked
and worked as described, the six sites matched the file exactly as cited, and
the PRD/dispute-log citations (NAV-08 at `VOLT_Portal_PRD.md:97`, D009
annotation at `:89`, `router.tsx:161-176`'s `routePaths` object) all verified
against the actual files.
