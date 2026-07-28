# Worker Packet: T137 — stop calendar meeting rows linking to a route that does not exist (D009)

Small, surgical task. One function, one file, five assertion sites.

**Packet SHA: pin this.** Before writing your output doc, run
`git log -1 --format=%H -- docs/swarm/active/T137-worker-packet.md` and confirm
it matches the SHA named in your dispatch prompt. A sibling task shipped against
a superseded packet revision; this step exists because of it.

## FIRST — merge the working branch

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```

Report the result. **If it conflicts, stop and report.**

## Why this exists

`detailHrefFor` (`src/pages/calendar/CalendarPage.tsx:599-608`) returns
`` `/meetings/${session.id}` `` for every meeting-type calendar row. **That route
does not exist.** `router.tsx` declares 14 routes, none of them
`/meetings/:sessionId`, and there is **no catch-all** — so `<Routes>` matches
nothing and renders a blank content area. No meeting-detail component exists
anywhere in `src/pages/meetings/`.

PRD **NAV-08** (`VOLT_Portal_PRD.md:89`) does specify that route as a "meeting
detail page replacing the dialog in CAL-02". It was never built. The gap is
recorded as **D009** in `dispute-log.md` and annotated inline at NAV-08.

The link is pre-existing — T112 created it — but **T133 promoted it from a
secondary "View details" link to the row title itself**, so a dead end is now
each meeting row's primary affordance.

**George's decision (2026-07-28): option (b).** Point meeting rows at a
destination that exists now; build the real detail page as its own task later.

## The change

In `detailHrefFor`, return `routePaths.meetings` for meeting-type rows. Keep the
outreach branch (`routePaths.outreachEvent(event.id)`) exactly as it is.

Rewrite the comment above it. It currently cites NAV-08 as the authority for
constructing the path by hand; that is now the reason **not** to. Say that the
route is unbuilt, cite D009, and note this is an interim destination pending
NAV-08.

**Use `routePaths.meetings`** (`router.tsx:164`), not a string literal. The
whole defect came from hand-constructing a path that no route table entry
backed.

## Disclosed consequence — this is intended, not a defect

All meeting rows now share one href. **The calendar stops being a way to reach a
specific meeting**; clicking any of them lands on the meetings list.

That is inherent to the decision, not a flaw to design around. Do **not** try to
preserve per-row destinations by inventing query params or hash fragments — that
manufactures a fake deep link and re-creates the original problem in a subtler
form. The row's link text is still the event title (T133), so rows remain
distinguishable to sighted and assistive users alike; only the destination is
shared.

## Allowed Files

- `src/pages/calendar/CalendarPage.tsx` — **only** `detailHrefFor`
  (`:599-608`) and its comment
- `src/pages/calendar/CalendarPage.test.tsx` — only the five sites in Traps
- `docs/swarm/active/T137-worker-output.md` (create)

## Forbidden Files

- `src/app/router.tsx` — **do not add the missing route.** Building NAV-08's
  detail page is a separate, larger task; a stub route that renders nothing is
  worse than this fix.
- Everything in `CalendarPage.tsx` outside `detailHrefFor` — T133 landed the
  title-as-link, the `role="group"` labelling and the width cap very recently.
- `src/pages/meetings/**` — T135 landed there recently.
- `docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`,
  `dispute-log.md`, `.claude/**`.

## Traps

**Five assertion sites depend on the old href. All are authorized to change.**

1. **`:461`** — `a.getAttribute('href') === '/meetings/session-build-upcoming'`.
   Update to the new href. Note both meeting rows now match it, so a `.find()`
   returns the first — if the surrounding assertion needs a *specific* row, key
   off the link text instead.
2. **`:487`** — the filter regex `/^\/(meetings|outreach)\//` requires a
   **trailing slash**. `/meetings` does not match it, so this silently drops
   every meeting row from the collection and the loop below then asserts over
   outreach rows only — **passing vacuously**. This is the dangerous one: it
   will go green while testing half of what it claims. Widen it to match
   `/meetings` exactly as well as `/outreach/...`.
3. **`:492-494`** — derives each row's expected title by parsing the session id
   out of the href (`href.replace('/meetings/', '')`). That derivation is
   impossible once the href carries no id. Rewrite the meeting branch to look
   the expected title up another way, or scope this assertion to outreach rows
   and cover meeting rows separately. **Do not delete the coverage.**
4. **`:538`** — the test is literally named
   `'a meeting row links to /meetings/:sessionId'`. Rename it to describe the
   new behaviour, and say in the name or a comment that it is interim pending
   NAV-08.
5. **`:544`** — same href lookup as `:461`.

**Everything else in that file stays green untouched**, in particular T133's
`role="group"` accessible-name assertions and the hex-literal guard at
`:287-291`.

6. Do not certify your own work.

## Acceptance Criteria

1. `detailHrefFor` returns `routePaths.meetings` for meeting rows and is
   unchanged for outreach rows.
2. No string literal path is constructed; the `routePaths` helper is used.
3. **Every link rendered by the calendar resolves to a route declared in
   `router.tsx`.** Verify this directly — enumerate the hrefs the page renders
   and check each against the route table. This is the actual point of the task,
   and the check that would have caught the original defect.
4. The comment above `detailHrefFor` explains the situation and cites D009.
5. The five sites in Traps are updated; `:487`'s regex genuinely matches meeting
   rows again — prove it by asserting the collection's size, so a future
   narrowing cannot make it pass vacuously.
6. `npx tsc --noEmit`, `npx vite build`, `npm run format:check` clean;
   `npx eslint .` zero errors and no new warnings (baseline **0 errors / 353
   warnings**).
7. `npx vitest run` green. Baseline is **1440 across 62 files** and the expected
   end count is also 1440 — you are amending assertions, not adding tests,
   unless you split Trap 3's coverage, in which case state the new count and
   why. Any test outside the five named sites that changes is a regression —
   report it, don't silence it.

## Relevant Constitution Excerpt

- Item 1 — PRD requirement IDs outrank packet text. NAV-08 is **not** being
  satisfied here; it is being deferred, with the deviation recorded in D009 and
  annotated at NAV-08 itself. Do not treat this packet as implementing NAV-08.
- Item 15 — accessibility is a shipping requirement. A link to nowhere is a
  keyboard-path failure; this fixes one.
- Non-Negotiables — existing tests pass unless explicitly approved; no worker
  self-certifies.

## Required Worker Output

`docs/swarm/active/T137-worker-output.md`:

- The packet SHA you verified.
- The enumerated list of every href the calendar renders, each matched against a
  declared route (criterion 3).
- Each of the five sites, before/after, and how you kept Trap 3's coverage.
- Explicit confirmation that `:487` no longer passes vacuously, with the
  collection-size assertion you added.
- Test count started from and ended with.
- Full output of the commands in criteria 6–7.
- Anything unverified, stated plainly as unverified.
