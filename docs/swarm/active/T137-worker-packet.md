# Worker Packet: T137 — stop calendar meeting rows linking to a route that does not exist (D009)

Small, surgical task. One function, two files, six assertion sites.

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

PRD **NAV-08** (`VOLT_Portal_PRD.md:97` — `:89` is the D009 annotation, which
pushed the requirement itself down) does specify that route as a "meeting
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

**Use `routePaths.meetings`** (`router.tsx:165` — `:164` is `dashboard`), not a
string literal. The
whole defect came from hand-constructing a path that no route table entry
backed.

## Disclosed consequence — this is intended, not a defect

All meeting rows now share one href. **The calendar stops being a way to reach a
specific meeting**; clicking any of them lands on the meetings list.

That is inherent to the decision, not a flaw to design around. Do **not** try to
preserve per-row destinations by inventing query params or hash fragments — that
manufactures a fake deep link and re-creates the original problem in a subtler
form.

**On accessibility, the change is an improvement, and revision 1 said the
opposite.** Both fixture meeting sessions belong to the same event
(`CalendarPage.tsx:351-355`, sessions at `:375-391`), so their rows **already**
render identical link text, "Weekly Build Meeting". Today that is identical
accessible name pointing at *different* destinations — a WCAG 2.4.4 problem.
After your change it is identical name pointing at the *same* destination, which
conforms. Do not repeat revision 1's claim that "rows remain distinguishable to
assistive users"; they were never distinguishable by name, and that is fine.

## Allowed Files

- `src/pages/calendar/CalendarPage.tsx` — `detailHrefFor` (`:599-608`) and its
  comment, **plus module doc #7 (`:175-199`)**. That doc explains at length why
  the literal path is constructed by hand because no helper exists; your change
  makes it false, and revision 1 forbade fixing it while also forbidding
  shipping it stale. Correct it. The section header at `:595-597` points at it —
  check whether that needs a touch too.
- `src/pages/calendar/CalendarPage.test.tsx` — only the **six** sites named in
  Traps (`:461`, `:487`, `:489`, `:492-494`, `:538`, `:544`), plus the import
  line needed to bring `routePaths` into the file.
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

**Six assertion sites depend on the old href. All are authorized to change.**

1. **`:461`** — `a.getAttribute('href') === '/meetings/session-build-upcoming'`.
   Update to the new href. Note both meeting rows now match it, so a `.find()`
   returns the first — if the surrounding assertion needs a *specific* row, key
   off the link text instead.
2. **`:487` + `:489` — the pair, and the one place a worker could do real
   damage.** The filter regex at `:487` is `/^\/(meetings|outreach)\//`, which
   requires a **trailing slash**, so a bare `/meetings` does not match and the
   filtered collection drops from **4 links to 2**.

   Revision 1 of this packet claimed that made the test "pass vacuously". **That
   was wrong.** `:489` sits between the filter and the loop:

   ```js
   expect(links.length).toBeGreaterThanOrEqual(4);
   ```

   So the test **fails loudly at `:489`** and never reaches the loop. There is no
   silent pass. `:489` is therefore a **sixth authorized site** — its failure is
   expected, not an unreported regression under criterion 7.

   **Tighten it; do not relax it.** The obvious repair is to weaken it to
   `>= 2`, which would manufacture exactly the vacuity revision 1 imagined. Do
   the opposite: widen the regex so meeting rows are collected again, then make
   the count exact and assert the meeting share of it:

   ```js
   expect(links.length).toBe(4);
   expect(links.filter((h) => h === routePaths.meetings).length).toBe(2);
   ```

   Import `routePaths` into the test file rather than hardcoding `'/meetings'` —
   `Kiosk.test.tsx:165` already does this, and it applies the packet's own
   "no string literal path" rule to the test side.

3. **`:492-494`** — derives each row's expected title by parsing the session id
   out of the href (`href.replace('/meetings/', '')`). That derivation is
   impossible once the href carries no id. Rewrite the meeting branch to look
   the expected title up another way, or scope this assertion to outreach rows
   and cover meeting rows separately. **Do not delete the coverage.**
4. **`:538`** — this is a test **name**, not an assertion. It is literally
   `'a meeting row links to /meetings/:sessionId'`. Rename it to describe the
   new behaviour, and say in the name or a comment that it is interim pending
   NAV-08.
5. **`:544`** — same href lookup as `:461`.

**Everything else in that file stays green untouched**, in particular T133's
`role="group"` accessible-name assertions and the hex-literal guard at
`:287-291`.

**Do not certify your own work.**

(The numbered list above has five entries covering six sites — entry 2 covers
the `:487`/`:489` pair.)

## Acceptance Criteria

1. `detailHrefFor` returns `routePaths.meetings` for meeting rows and is
   unchanged for outreach rows.
2. No string literal path is constructed; the `routePaths` helper is used.
3. **Every link the calendar can render resolves to a route declared in
   `router.tsx`.** Enumerate **both branches of `detailHrefFor`**, not just one
   month's render state, and check each against the route table. (The default
   view renders 4 anchors; a different month or filter renders others.) This is
   the actual point of the task, and the check whose absence let the defect
   ship.
4. The comment above `detailHrefFor` explains the situation and cites D009.
5. All **six** sites in Traps are updated. `:487`'s regex genuinely matches
   meeting rows again, and `:489` is **tightened rather than relaxed** — the
   size assertion already exists there, so this is a strengthening, not an
   addition. A future narrowing of the regex must fail the count.
6. `npx tsc --noEmit`, `npx vite build`, `npm run format:check` clean;
   `npx eslint .` zero errors and no new warnings (baseline **0 errors / 353
   warnings**).
7. `npx vitest run` green. Baseline is **1440 across 62 files** and the expected
   end count is also 1440 — you are amending assertions, not adding tests,
   unless you split Trap 3's coverage, in which case state the new count and
   why. Any test outside the **six** named sites that changes is a regression —
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
- Each of the six sites, before/after, and how you kept Trap 3's coverage.
- The before/after of `:489`, showing it was tightened rather than relaxed.
- Test count started from and ended with.
- Full output of the commands in criteria 6–7.
- Anything unverified, stated plainly as unverified.
