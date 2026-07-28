# T135 Worker Output — coach `MeetingsList` rows → Astryx `Table`

Implemented exactly per `docs/swarm/active/T135-worker-packet.md` (Revision
2). Allowed Files only: `src/pages/meetings/MeetingsList.tsx`,
`src/pages/meetings/MeetingsList.test.tsx`, this file, plus four new `.webp`
figures. No Forbidden File was touched (`git status --porcelain` shows only
those two source files, this output, and the four figures).

## 0. Merge step

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```

Fast-forwarded cleanly (`Updating 2146255..23a38fa`, "Fast-forward"). No
conflicts — nothing to report there.

## 1. Final column widths and the measurement behind each

Measured live in real Chromium (`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`,
via Playwright) against a throwaway preview rig (§9 below) at 1440×1000,
against the real `defaultLoadCoachMeetingsData` fixture.

Shipped desktop `<th>` widths (measured directly, `getBoundingClientRect().width`
on each `<th>`, both Upcoming and Past — see §6, byte-identical):

| Column | Shipped width | Starting point (packet) | Measured `<th>` |
|---|---|---|---|
| expander | `pixel(170)` | ~170 (Trap 3b "keep the wording" branch) | 170px |
| date | `pixel(200)` | 200 | 200px |
| title | `proportional(2, { minWidth: 224 })` | 224 minimum | 394px (absorbed the slack the fixed columns didn't need) |
| hours | `pixel(130)` | 130 | 130px |
| count | `pixel(158)` | 158 | 158px |
| actions | `pixel(80)` | 80 | 80px |

Fixed-column sum: 170+200+130+158+80 = 738px. Title's 224px floor brings the
combined minimum to 962px, comfortably inside the measured 1132px available
width (§2) — the packet's own starting-point numbers held up under
measurement without needing rebalancing (unlike T130's first attempt, which
needed a second pass after a 44px-touch-target regression). `title`
absorbed the remaining slack automatically (`proportional()`), landing at
394px in practice, not just its 224px floor.

Trap 3b decision: **kept the `Session details (N)` wording** (not T130's
`Sessions (N)`) — the expander `Button`'s visible children are its own text,
so `:595`/`:596` (`toContain('Session details (3)')` /
`toContain('Session details (2)')`) needed zero test changes, matching the
"no test churn" branch the packet named. Measured natural width of the
expander at 170px: `139.17px` content + real Table cell padding, well under
170px with margin, not wrapping.

## 2. Scroll-wrapper `clientWidth`/`scrollWidth` at 1440px, before/after

**Before**: N/A as a `Table` scroll wrapper — the pre-T135 row is a `List`/
`ListItem`, which has no comparable scroll-wrapper concept (PRD v3.1 F-1's
own finding: `ListItem` cannot align columns at all, so there is nothing to
measure a scroll delta against). The relevant "before" fact is qualitative:
zero column alignment.

**After** (measured, real Chromium, 1440px, both fixture rows populated in
the Upcoming section — the shipped fixture's own Past section is an
`EmptyState`, see §3 below):

| | `clientWidth` | `scrollWidth` |
|---|---|---|
| Upcoming `Table` scroll wrapper | 1132px | 1132px |

**Result: `scrollWidth === clientWidth`** — zero `Table`-internal horizontal
scroll. Criterion 3 satisfied (the stronger `===`, not just the required
`<=`).

## 3. Fixture reality and the two-bucket rig

`defaultLoadCoachMeetingsData` produces 2 Upcoming rows, 0 Past rows (both
fixture events — Weekly Build Meeting, Ravens Strategy Session — have a
still-`scheduled` session). The Past section therefore renders its own
`EmptyState` ("No past meetings. Completed and canceled meetings will show
up here."), not a second `Table`, in the shipped app. This is stated
explicitly, per criterion 3/9's own instruction, rather than measuring
"both sections" against a table that does not exist in the shipped fixture.

To measure criteria 3/4/9 "across both sections" for real, the throwaway rig
(§9) injected a two-bucket fixture (`loadTwoBucketFixture`, rig-local only,
not in `MeetingsList.tsx`): it clones the two real fixture rows into two
Past rows with every session forced to `completed`/unchanged-non-scheduled
status. Screenshot: `t135-meetings-1440-twobucket.png` (not a required
capture, kept only in the scratchpad for this report — see §12 for the four
required captures).

With that injected fixture, both `Table`s render:

| | Upcoming | Past |
|---|---|---|
| `clientWidth` | 1132px | 1132px |
| `scrollWidth` | 1132px | 1132px |
| `<th>` widths | `[170, 200, 394, 130, 158, 80]` | `[170, 200, 394, 130, 158, 80]` |

Byte-identical `<th>` widths on both tables, confirming criterion 9
(`buildCoachMeetingColumns` takes no `bucket` parameter at all — this row's
content mapping, unlike T130's outreach row, is identical for Upcoming and
Past, so there is no per-bucket width variance to even risk).

## 4. Collapsed row heights, both sections, before/after

**Before**: not meaningful to measure as a "collapsed row height" — the
pre-T135 `ListItem` row always rendered its full `description` stack (four
`Text` lines + chip row + the `Collapsible`'s own always-visible trigger)
with no row/detail split at all, so there is no "collapsed" state to
compare against; the whole card was the row.

**After** (measured, real Chromium, 1440px):

| Section | Fixture | Collapsed row heights (px) |
|---|---|---|
| Upcoming (shipped fixture) | Weekly Build Meeting, Ravens Strategy Session | 69, 68.5 |
| Upcoming (two-bucket rig) | same two | 69, 68.5 |
| Past (two-bucket rig, injected) | Ravens (Past Clone), Weekly Build (Past Clone) | 69, 68.5 |

All ≤72px (UXC-07 ceiling). Both sections measured identical row heights
(expected — `buildCoachMeetingColumns` produces byte-identical columns and
the row content shape is bucket-independent per §3).

Expanding a row does **not** change any other row's collapsed height —
measured after expanding "Weekly Build Meeting": its own event row stayed
69px, the still-collapsed "Ravens Strategy Session" row stayed 68.5px; the
three newly-spliced session-detail rows measured 67px/121px/123px (multi-line
detail content — not subject to the 72px ceiling, which applies to
collapsed event rows only, same posture T131 documented for its own
narrow-viewport card rows).

At 375px (narrow stacked-card layout — a structurally different pattern,
not subject to UXC-07's ceiling, same disclaimer T131's own module doc
makes for its mobile card column): 273px / 272.5px (full card:
title+location+date+badges+stats+expander+Edit).

## 5. Touch-target measurements — Edit, expander, per-session Cancel

Measured (real Chromium, both 1440px and 375px):

| Control | 1440px | 375px |
|---|---|---|
| Expander (`Session details (N)`) | 139.17 × 44px | 139.17 × 44px |
| Edit | 48.13 × 44px | 311 × 44px (full-width card column stretches the chip; height unchanged) |
| Cancel (per-session, e.g. "Cancel Wed, Jul 22 session") | 196.5 × 44px | 196.5 × 44px |

All three ≥44px in their smaller dimension (height, in every case) at both
viewports. Criterion 5 satisfied. `MIN_TOUCH_TARGET_STYLE` (`{ minHeight:
'44px' }`, T130's mechanism, re-declared locally per the packet's explicit
instruction — see §8) is applied unconditionally, so desktop/narrow values
match on height.

## 6. Expansion mechanics

- Row splicing: `buildCoachMeetingTableRows` (exported, directly testable)
  inserts `kind: 'sessionDetail'` rows directly beneath their `kind: 'event'`
  parent in one flat array, only when `expandedEventIds.has(row.eventId)` —
  verified live (rig): collapsed, the row count in a table body matches the
  event count exactly; after one expand, exactly N extra rows appear (N =
  that row's own session count), and they disappear again on a second click.
- `aria-expanded` is always present (`true`/`false`).
- `aria-controls` is present **only while expanded**, referencing
  `sessionDetailAnchorId(eventId, sessionId)` ids that exist on the spliced
  rows' own first `Text` — omitted (`undefined`) while collapsed, since
  those ids do not exist in the DOM yet (an IDREF to a nonexistent id would
  be an invalid stale reference).
- Both are on the same `Button` — verified: `aria-expanded="false"` and no
  `aria-controls` attribute at all before the first click; after clicking,
  `aria-expanded="true"` and `aria-controls` resolves to real, present ids.

Criterion 6 satisfied.

## 7. Canceled `Badge` column home

`CoachMeetingDateCell` renders the canceled `Badge` (`variant="error"`,
label `` `${canceledCt} canceled` ``) inside the date column, alongside the
recurrence chips, exactly where T130 put its own type `Badge` on the coach
outreach row. It no longer floats in the row's `endContent` (the PRD's own
named defect, `VOLT_UX_Craft_PRD_v3.md:98-99`). Visible in every capture
(§12) as the red "1 canceled" chip beside "WED (3)" on the Weekly Build
Meeting row.

## 8. Helper re-declaration vs. import (packet's explicit split)

- **Re-declared locally** (non-exported locals in `OutreachList.tsx`, a
  Forbidden File — the packet's one "copy it" exception):
  - `MIN_TOUCH_TARGET_STYLE: CSSProperties = { minHeight: '44px' }`
  - `sessionDetailAnchorId(eventId, sessionId)` (own literal prefix,
    `meeting-session-detail-...`, distinct from the outreach one's
    `outreach-session-detail-...`, so the two never collide if both files'
    output were ever rendered on the same page — not a realistic scenario,
    but a cheap, honest distinction).
- **Imported, not copied** (real modules):
  - `StatCell` from `src/components/StatCell.tsx` — unmodified (verified:
    `git diff` shows zero changes to that file).
  - `useIsNarrowViewport` from `src/hooks/useIsNarrowViewport.ts` —
    unmodified (verified: zero changes to `src/hooks/**`).

Criteria 10/11 satisfied.

## 9. Rig setup and cleanup

Created `preview.throwaway.html` + `src/preview.throwaway.tsx` (both
gitignored via `*.throwaway.*`), rendering: `MemoryRouter` (route
`/meetings`, needed by `AppShell`'s own `useLocation()`) → `LoginAs`
(`src/test-utils/authHarness.tsx:131`, coach user) → `LayerProvider` →
`Theme` (`voltTheme`) → real `AppShell` chrome → `MeetingsList` with
`loadCoachData` set to either `defaultLoadCoachMeetingsData` (default) or a
rig-local `loadTwoBucketFixture` (via `?fixture=twoBucket`, §3). This
mirrors T131's own rig shape (`OutreachList` + `LoginAs` coach + real
`AppShell`).

Served via `npx vite --port 5183 --strictPort`, driven by a Playwright
script (`chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'
})`), for every measurement in §1–§5, §12.

**Deleted before finishing** — `git status --porcelain` after cleanup shows
no `*.throwaway.*` entries (confirmed in this session, both files removed
via `rm`, dev server killed).

## 9a. Criterion 8 baseline — 375px page-level `scrollWidth`, before and after

Measured `document.documentElement.scrollWidth` vs. `window.innerWidth` at
375px, using `git stash push --keep-index -- src/pages/meetings/MeetingsList.tsx`
to temporarily revert just that file to its pre-T135 (`ListItem`) state,
re-requesting the rig, then `git stash pop` to restore (confirmed via
`git status`/`tsc`/`vitest` immediately after popping — all clean, no drift
introduced by the round-trip):

| | `scrollWidth` | `innerWidth` |
|---|---|---|
| Before (pre-T135, `ListItem`) | 375px | 375px |
| After (T135, `Table`) | 375px | 375px |

**Zero delta — no new overflow**, and in fact exact equality both before and
after (the strongest form of criterion 8's own bar). The narrow-viewport
`isNarrow` branch (`buildCoachMeetingColumns`'s single `proportional(1)`
stacked-card column) fully absorbs the page width; verified directly against
the real fixture, not assumed.

## 10. Expander wording (Trap 3b)

**Kept `Session details (N)`** (did not switch to T130's `Sessions (N)`).
Reasoning: zero test churn on `:595`/`:596` (the visible `Button` children
are that literal string, unaffected by row splicing since it's not inside
the collapsible content), at the cost of a wider expander column (170px vs.
120px) — measured to fit comfortably inside the 1132px budget (§1), so the
width cost had no real downside. Stated per the packet's explicit
requirement to declare which branch was chosen and why.

## 11. Every test assertion amended, with before/after and which Trap authorized it

All in `src/pages/meetings/MeetingsList.test.tsx`. Original line numbers per
the packet (pre-edit); the file now has an added `expandRow` helper and
these amendments.

**Test `populated state: Upcoming/Past sections…` (originally `:550`, Trap 1):**

| Original line | Before | After | Authorized by |
|---|---|---|---|
| `:558` | `toContain('Scheduled')` | unchanged (kept, comment added pinning why it survives) | Trap 1 ("survives only by accident") |
| `:559` | `toContain('Completed')` | unchanged (kept, comment added) | Trap 1 (untouched, as instructed) |
| `:560` | `toContain('Canceled')` | unchanged text, but now preceded by `expandRow('Weekly Build Meeting')` | Trap 1 |
| `:561` | `toContain('present')` | unchanged text, same `expandRow` call covers it | Trap 1 |

**Test `renders UXD-02 dense-row fields…` (originally `:570`, Trap 1 + Trap 3):**

| Original line | Before | After | Authorized by |
|---|---|---|---|
| `:581` | `toContain('4h scheduled · 2h held')` | `toContain('Scheduled4h')` + `toContain('2h held')` | Trap 3 |
| `:584` | `toContain('Expected 5 · Attended 4')` | `toContain('Expected5')` + `toContain('Attended 4')` | Trap 3 |
| `:589` | `toContain('3h scheduled · 1.5h held')` | `toContain('Scheduled3h')` + `toContain('1.5h held')` | Trap 3 |
| `:590` | `toContain('Expected 2 · Attended 3')` | `toContain('Expected2')` + `toContain('Attended 3')` | Trap 3 |
| `:592-594` (comment) | "Collapsible content is always in the DOM … so no click needed" | rewritten — expander trigger text is always visible (`Button` children), but the attendee-names line now needs `expandRow('Weekly Build Meeting')` first | Trap 1 (comment correction, explicitly required) |
| `:597` | `toContain('Attended: Alex Rivera, Bailey Chen, Casey Nguyen')` | unchanged text, now preceded by `expandRow('Weekly Build Meeting')` | Trap 1 |

**Test `Edit shows an honest stub…` (originally `:791`, the tenth authorized change, §2 of the packet):**

Before:
```tsx
const moreMenuButton = Array.from(container.querySelectorAll('button')).find((btn) =>
  btn.getAttribute('aria-label')?.startsWith('Actions for Weekly Build Meeting'),
);
act(() => {
  moreMenuButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
const editMenuItem = Array.from(document.querySelectorAll('[role="menuitem"], button')).find(
  (el) => el.textContent?.trim() === 'Edit',
);
act(() => {
  editMenuItem?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
```
After:
```tsx
const editButton = Array.from(container.querySelectorAll('button')).find((btn) =>
  btn.getAttribute('aria-label')?.startsWith('Edit – Weekly Build Meeting'),
);
expect(editButton).toBeTruthy();
clickButton(editButton as HTMLButtonElement);
```
Authorized by: packet §2, "You must amend `it('Edit shows an honest stub…')` at `:791`" — the `MoreMenu` this test opened no longer exists after its removal (authorized PRD deviation), and the old lookup would have degraded into a silently-passing false positive (found the new Edit chip directly via the generic text search) rather than failing loudly.

**Test `Cancel (inline, per-session) …` (originally `:820`, Trap 1 + Trap 2):**

| Original line | Change | Authorized by |
|---|---|---|
| before `:827` | added `expandRow('Weekly Build Meeting')` | Trap 1 |
| `:842` | `toContain('Canceled — no attendance recorded.')` — text unchanged, but now satisfiable specifically because expansion state is the ONE shared `Set` in `CoachMeetingsView` (not per-section) | Trap 2 |
| before `:851` | added `expandRow('Ravens Strategy Session')` (a **different** row, needs its own expand) | Trap 1 |
| `:871-877` comment | rewritten (old comment claimed "Collapsible content is always in the DOM…so no click needed", now false) | Trap 1, explicitly required |

**Test `Cancel rolls back …` (originally `:854`, Trap 1):**

| Change | Authorized by |
|---|---|
| added `expandRow('Weekly Build Meeting')` before `findButtonByText('Cancel Wed, Jul 22 session')` | Trap 1 — without it, `findButtonByText` returns `undefined` and `clickButton(undefined)` throws (verified: this was the exact failure observed before the fix, `TypeError: Cannot read properties of undefined (reading 'dispatchEvent')`) |

**Total: 9 Trap-1 sites + 4 Trap-3 sites + 1 tenth (§2) = 14 assertion/setup
changes across 5 tests**, plus one new `expandRow` helper (packet: "Nine
call sites, one line each" — 5 `expandRow(...)` calls were added: one in the
populated-state test, one in the dense-row-fields test, one before the
Wednesday Cancel button in the Cancel-success test, one before the Saturday
Cancel button in the same test, one in the Cancel-rollback test — matching
the packet's own enumeration of nine *assertions* needing an expand, several
of which share one `expandRow` call). Trap 3b's own two extra sites (`:595`/
`:596`) were **not** changed, since the "keep the wording" branch was
chosen (§10) — the packet's "thirteen or fifteen sites" range accounted for
both branches; this task landed at the lower end (no Trap-3b churn) plus the
tenth, for **fourteen** total amended assertion/setup sites.

No other test's pass/fail status changed — confirmed by running the full
suite before and after (§13/§14): same 1440/1440, same 62/62 files, with
only this one file's failures ever appearing mid-work.

## 12. Captures

- `docs/swarm/figures/ux-craft/T135-meetings-1440-light.webp`
- `docs/swarm/figures/ux-craft/T135-meetings-1440-dark.webp`
- `docs/swarm/figures/ux-craft/T135-meetings-375-light.webp`
- `docs/swarm/figures/ux-craft/T135-meetings-375-dark.webp`

All four captured from the rig (real Chromium, real fixture data, coach
role), full-page, with the "Weekly Build Meeting" row expanded (so the
row-splicing/session-detail shape is visible, matching the reference
figure's own density). `old-events-tab.webp` (criterion 1) was opened and
compared before implementation, and again against these captures — expander
/ date+chips(+badge) / title / two stat columns / a compact action cluster,
matching the reference row shape. The one deliberate difference from the
reference: the action cluster is Edit-only (no destructive icon), per §2's
authorized MoreMenu-removal ruling — Cancel targets one session, not a row,
and stays inside the expander.

## 13–14. Full command output

**`npx tsc --noEmit`** — clean, exit 0, no output.

**`npx eslint .`** (full repo):
```
✖ 353 problems (0 errors, 353 warnings)
  0 errors and 1 warning potentially fixable with the `--fix` option.
```
Zero errors. All warnings are the pre-existing repo-wide
`react-refresh/only-export-components` pattern (this file already exported
many pure functions alongside components before this task, the same
established pattern `OutreachList.tsx` carries ~26 instances of) — none
newly introduced by logic changes, only by the added exported helpers
(`CoachMeetingEventTableRow`, `CoachMeetingSessionDetailTableRow`,
`CoachMeetingTableRow`, `buildCoachMeetingTableRows`) which are types/pure
functions, matching the file's pre-existing convention.

**`npx vite build`** — succeeded:
```
✓ built in 4.77s
```
(Same pre-existing >500kB chunk warning present before this task, unrelated.)

**`npm run format:check`** — clean:
```
Checking formatting...
All matched files use Prettier code style!
```

**`npx vitest run`** (full suite) — green:
```
Test Files  62 passed (62)
     Tests  1440 passed (1440)
```

**Baseline confirmed**: ran `npx vitest run` immediately after the merge
step, before any edit — **1440 tests across 62 files**, matching the
packet's stated baseline exactly. End count after all edits: **1440 tests
across 62 files** — zero net delta, confirming the task amended assertions
without adding or removing any (§11 accounts for every change).

**`npx vitest run src/pages/meetings/MeetingsList.test.tsx`** alone — 67/67
passed.

Zero `.skip`/`.only`/`.todo` — confirmed via grep, zero matches.

## 15. Anything unverified / known risks

- **Dark-mode pixel-level styling** was screenshotted (§12) but not
  measured with the same rigor as the light-mode numbers in §1–§5 (no
  separate dark-mode touch-target/row-height re-measurement) — visually
  inspected only. The packet does not call out a dark-theme-specific
  numeric requirement beyond the capture itself, so this is disclosed as a
  gap in measurement depth, not a known defect.
- **The rig's own chrome** (`AppShell`'s `KpiStrip` and default
  `SeasonProvider`) shows a "Couldn't load the active season" banner in
  every capture, because those loaders hit the real (unconfigured) Supabase
  client rather than fixture data — the same rig artifact T131's own output
  disclosed. `MeetingsList`'s own content (both sections, all fixture rows)
  renders correctly beneath it, visible in every capture.
- **`Edit`'s own box at 375px measured 311px wide** (§5) — this is the
  `Button`'s own natural stretch inside the narrow stacked-card `VStack`
  column, not a bug; only the smaller dimension (height, 44px) is the
  relevant touch-target measurement per criterion 5's own wording ("in
  their smaller dimension").
- **The stale top-of-file module doc** (module docs #9/#10d, describing the
  pre-T135 `MoreMenu`/`Collapsible`-based design) was updated in three spots
  to point at this task's own module doc rather than left describing
  removed code verbatim — a judgment call to keep the file's own internal
  documentation honest, not requested verbatim by the packet, but directly
  caused by this task's own edits (not scope creep into unrelated code).
  Flagged here for visibility per "do not silence findings."
- **`git stash` round-trip for the §9a baseline measurement** temporarily
  reverted `MeetingsList.tsx` to its pre-task state mid-session. Verified
  clean restoration immediately after (`git status`, `tsc --noEmit`,
  `vitest run` on the single test file all green) — no residual drift, but
  noting the mechanism plainly since it is an unusual step to include in a
  worker session.
- **Every collapsed-row/touch-target/scroll-width number above is a
  from-this-session, real-Chromium measurement** (not inferred or copied
  from another task's own numbers) — the only reused figures are the
  packet's own *starting-point* budget (§1's "Starting point (packet)"
  column), explicitly labeled as such, not presented as measured.

## Files changed

- `src/pages/meetings/MeetingsList.tsx`
- `src/pages/meetings/MeetingsList.test.tsx`
- `docs/swarm/figures/ux-craft/T135-meetings-1440-light.webp` (new)
- `docs/swarm/figures/ux-craft/T135-meetings-1440-dark.webp` (new)
- `docs/swarm/figures/ux-craft/T135-meetings-375-light.webp` (new)
- `docs/swarm/figures/ux-craft/T135-meetings-375-dark.webp` (new)
- `docs/swarm/active/T135-worker-output.md` (this file)

The throwaway preview rig (`preview.throwaway.html`, `src/preview.throwaway.tsx`)
was created, used for every measurement above, and deleted before finishing
— confirmed via `git status --porcelain` showing no `*.throwaway.*` files.

This worker does not certify its own work and is not filing a dispute. An
independent checker decides pass/fail.
