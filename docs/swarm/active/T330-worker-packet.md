# T330 — worker packet v1: a dateless outreach event becomes visible and fixable

**Tier: HEAVY** (constitution item 26 — `constitution.md:323`, "packet + premise gate + worker +
checker"). Trigger: this changes what renders on the **only** surface from which an event is
reachable, and the event carries figures that reach a grant-reporting total. Gate is capped at two
rounds (item 19a); a third escalates to the owner.

**Branch point:** `b1d6f4a`. **Branch:** `claude/t330-orphan-events`.

**Measured baseline at `b1d6f4a`, `.env.local` absent** — measured by the orchestrator on this
branch point, **not** copied from `W2-KICKOFF.md`, whose figures (361 warnings / 1842 tests) are
stale by two W6 merges:

```
tsc 0 · vite build ✓ · prettier clean · eslint 0 errors / 360 warnings · vitest 76 files / 1850 tests
```

---

## 1. The defect, in one paragraph

An `events` row whose `event_sessions` insert failed has zero sessions. `buildEventGroups` drops it
from **both** buckets — `if (eventSessions.length === 0) continue;` (`OutreachList.tsx:1730`), stated
in its own module doc at `:1711-1712`. Every in-app link to `/outreach/:eventId` is built from a
rendered row (`OutreachList.tsx:2450`, `:3547`, and `CalendarPage.tsx:514`, which is itself
session-driven at `:349`), so **no row means no link**: the coach cannot see the event, reach it, or
fix it. It is not an RLS problem — `staff_all on events` (`rls.sql:149`) lets the coach read the row
perfectly well.

---

## 2. Allowed Files

```
src/pages/outreach/OutreachList.tsx          (source)
src/pages/outreach/OutreachList.test.tsx     (tests)
```

**Forbidden, and these are owned by live sessions right now:**
`src/lib/supabase/loaders/attendance.ts` (W1, PR #28 — import only, never modify),
`src/pages/checkin/**`, `src/pages/meetings/LiveConsole.tsx`, `Kiosk.tsx`, `loaders/checkin.ts`,
`loaders/kiosk.ts` (W1), `src/pages/home/**` (W5), `src/pages/reports/**`, `loaders/reports.ts`
(**W4** — `WORKFLOWS.md:177`), `supabase/migrations/*metric_views.sql`, `*kpi_views.sql` (W4).

---

## 3. The owner's rulings — build to these, do not re-derive them

Recorded verbatim in `auto-mode-decisions.md`, entry **"2026-08-03 — George's ruling on T330"**.
**Cite that file, never this paraphrase.**

1. **Bucket: `Upcoming`, pinned to the top.** A dateless event is unfinished setup, not a finished
   event.
2. **Numeric cells: em dash (`—`), not zeros.**
3. **Marker: a "Needs dates" badge** on the row.
4. **Audience: BOTH views** — coach *and* student/parent. This was asked as a follow-up and the
   owner ruled against the orchestrator's coach-only recommendation. It is the simpler
   implementation: one change inside the shared function, no per-view filter.

**Already settled, do NOT re-open:** a third "Needs dates" bucket. The owner ruled against it on
T304 (`auto-mode-decisions.md:1320-1333`). Two buckets only.

---

## 4. The prescription in the ledger row and in `W2-KICKOFF.md` is WRONG. Do not follow it literally.

Both say the fix is *"delete the `continue` at `OutreachList.tsx:1730`"*. **Measured: that alone
ships a crash.**

`hasScheduled` is `false` for a zero-session event (`:1731`), so deleting the `continue` routes the
orphan into **`past`** — and `past`'s comparator dereferences
`a.sessions[a.sessions.length - 1].startsAt` (`:1739-1742`), which is `undefined` on an empty array.
`upcoming`'s comparator has the identical defect via `find(...) ?? a.sessions[0]` (`:1734-1737`).

**Neither throws while its bucket holds one event**, because a single-element array never invokes
the comparator. It surfaces only once a second event shares the bucket — taking out the entire
outreach list for every viewer. A worse defect than the one being fixed.

**This is the project's failure mode #2 inside the prescription itself:** written from reading the
`continue` line, without executing what happens downstream of removing it.

---

## 5. What to build

**(a) Route, don't just un-skip.** A zero-session event goes to **`upcoming`**, never `past`.

**(b) Make `upcoming`'s comparator empty-safe and pin dateless entries first.** A dateless entry has
no `startsAt` to compare; it sorts ahead of every dated entry, and two dateless entries tie.

**(c) `past`'s comparator.** After (a), `past` can no longer receive a zero-session entry.
**State explicitly in your output which you did and why:** left unchanged with a comment recording
that (a) is what keeps it safe, or guarded defensively. Do **not** add an unreachable guard and then
describe it as load-bearing — that is exactly T301's defect, which is an open row in this workflow.

**(d) Cells.** For a dateless row, hours and count render **`—`**, not `0h` / `0 students`. Coach
cells are `key: 'hours'` (`:2806-2818`, `StatCell label="Planned" value={...h}`) and `key: 'count'`
(`:2820-2841`, `StatCell label="Expected" value={... students}`). Mirror it on the student/parent
section.

> **Note, and check it before building:** the `Reached` secondary renders **only** in the `past`
> bucket (`:2836`, `bucket === 'past' && ...`). A dateless row is pinned to `upcoming`, so it has no
> `Reached` cell to dash. **Do not build a dashed `Reached`** — it would be unreachable code. The
> owner's "all three" ruling is satisfied by hours + count; report this rather than silently
> building or silently skipping it.

**(e) "Needs dates" badge** on the row. The row already renders a type badge
(`Outreach`/`Competition`) in `CoachEventDateCell` — reuse that shipped pattern.

**(f) The date cell needs no work.** `formatEventDateRangeLabel` already returns
`'No sessions scheduled yet.'` for an empty array (`:1565`). That branch is dead **today** only
because nothing reaches it; (a) is what makes it render. Do not duplicate the string.

**Do not touch** `computeEventRowStats` (`:1830-1855`). Verified: it is already total over an empty
session list — `dateRangeLabel` → the `:1565` branch, `weekdayChips` → `[]`, `expectedCount` /
`attendedCount` → `0`, `reached` → `null` (`sumPeopleReached` returns `null`, never a fabricated
`0`, `:1795-1801`), `hours` → `computeGroupHours` over no sessions. **Nothing there crashes and
nothing there needs changing.**

---

## 6. THE TRAP — an existing green test asserts the behaviour you are removing

`OutreachList.test.tsx:566-573`:

```js
it('omits an event with zero real sessions from both buckets', () => {
  const { upcoming, past } = buildEventGroups(events, sessions);
  expect(upcoming.some((entry) => entry.event.id === 'e3')).toBe(false);
  expect(past.some((entry) => entry.event.id === 'e3')).toBe(false);
});
```

**This test passes today and your change must make its first assertion false.**

**Amending it is explicitly authorized here** — Definition of Ready item 5 (`constitution.md:120`)
requires any reversal of previously-passed work to be explicit and authorized, and this packet is
that authorization. It is authorized **narrowly**:

- **Rewrite it to assert the new contract** — `e3` is now in `upcoming`, pinned first, and still
  **not** in `past`. **Keep the `past` half of the assertion.** It is the guard against the crash in
  §4 and it must survive.
- **Rename it** so its title states the new behaviour. A test whose name says "omits" while
  asserting inclusion is worse than no test.
- **Do not delete it**, do not `skip` it, and do not weaken any other assertion in the file.

The fixture you need already exists: `e3` (`'No sessions yet'`) is declared at `:525` with no
sessions in the array (`:559`).

**Nothing else in the suite may be amended.** If another test reddens, that is a finding — report it,
do not fix it by editing the assertion. `git diff | grep '^-' | grep -E 'expect|toBe|toEqual|toHave'`
must show **only** the lines from this one authorized test.

---

## 7. Harness facts — measured, not assumed

**Read this before writing a criterion.** Four consecutive tasks in this project wrote criteria
against an imagined harness.

- `OutreachList.test.tsx` (3300 lines) uses **raw `createRoot`/`act`**. There is **no
  `@testing-library/react`** in this repo. Follow the file's existing pattern.
- Its **only** `vi.mock` is a partial mock of `loaders/selfCheckoff` (`:57-64`), intercepting
  `loadSelfCheckoffAttendance`. **`loaders/outreach` is NOT mocked** — `makeLoadOutreachData` and
  `makeSaveOutreachEvent` are imported real (`:46`) and injected as props.
- Every render must be wrapped in a real `<SeasonProvider>` (T106) plus `AuthProvider`/`LoginAs`
  (`test-utils/authHarness`) and `MemoryRouter`.
- `buildEventGroups`, `computeEventRowStats` and `formatEventDateRangeLabel` are **all exported and
  directly unit-tested** (`:87`, `:91`, `:100`; existing blocks at `:521`, `:576`, `:630`). Put the
  routing and sort criteria at pure-function level — cheapest and most precise. The badge and
  em-dash criteria need DOM.
- jsdom does not implement `HTMLDialogElement.prototype.showModal()`; the file already polyfills it
  locally. Do not re-add.

---

## 8. Acceptance criteria — each names a mutation that MUST turn it red

The orchestrator will replay **every** mutation personally. A criterion whose mutation leaves the
suite green is not evidence and will be sent back.

| # | Criterion | Mutation that must redden it |
|---|---|---|
| **C1** | A zero-session event appears in `upcoming` | restore `if (eventSessions.length === 0) continue;` |
| **C2** | A zero-session event is **not** in `past` | route zero-session entries to `past` instead of `upcoming` |
| **C3** | It sorts **first** in `upcoming`, ahead of every dated event | remove the pin, let it fall through to `localeCompare` |
| **C4** | Two dateless events plus ≥1 dated event do not throw, and both dateless sort ahead | remove the empty-safe guard from `upcoming`'s comparator — **must throw `TypeError`, not merely misorder** |
| **C5** | `past` with ≥2 entries still sorts correctly | reverse the `bLast`/`aLast` operand order |
| **C6** | The row renders `—` for hours, not `0h` | return `` `${hoursValue}h` `` unconditionally |
| **C7** | The row renders `—` for count, not `0 students` | return `` `${countValue} students` `` unconditionally |
| **C8** | The row renders the **"Needs dates"** badge | drop the badge from the cell |
| **C9** | The date cell renders `'No sessions scheduled yet.'` from the shipped `:1565` branch | make `formatEventDateRangeLabel` return `''` for an empty array |
| **C10** | A **dated** event's row is unchanged — date, hours, count, no badge | apply the dateless formatting unconditionally |

**C4 is the crash criterion and the most important one here.** It must fail with a real `TypeError`
under its mutation, not an ordering assertion — a one-element bucket never invokes the comparator, so
**the fixture must put at least two entries in the same bucket**. State the fixture shape in your
output.

**C10 is the regression guard.** Without it every other criterion can be satisfied by formatting
every row as dateless.

**Paired assertions (this repo has shipped 7+ that passed for the wrong reason).** C1/C2 are a pair:
assert presence in `upcoming` **and** absence from `past` in the same test, so neither passes because
the event vanished entirely. C8's absence arm must be paired with proof the row itself rendered.

---

## 9. Out of scope — filed, not built (item 20)

**T330's other half is not yours to fix.** An orphan event's adult-volunteer figures double-count in
the season totals: the create dialog collects them (`OutreachEventDialog.tsx:1000-1001`),
`queryHoursEvents` selects `from('events')` filtered on `season_id` **alone**, with no session join
(`reports.ts:401-411`), and `buildSeasonTotals` sums across all season events with **no session
filter** (`HoursTab.tsx:593-596`, called `:1094`). A failed create plus a successful retry leaves two
events carrying the same figures, double-counted and — until this task — invisible.

`pages/reports/**` and `loaders/reports.ts` are **W4's** (`WORKFLOWS.md:177`). **Do not touch them.**
The orchestrator files this as a new row in the **T500–T599** block. Making the orphan visible (this
task) is what gives the coach the ability to delete or fix the duplicate; it does not make the totals
correct on its own. **Say so in your output rather than implying this task closes the wrong number.**

---

## 10. Required worker output

Write `docs/swarm/active/T330-worker-output.md`:

1. **The commit SHA** your work landed in, and confirmation that `git diff` against the branch point
   is non-empty in the **committed** blob (item 21 — T142 reported clean-and-complete work that was
   never committed).
2. **All six gates**, `.env.local` absent, with real numbers against the **measured** baseline
   (0 errors / **360** warnings, **76 files / 1850** tests). Explain any warning rise. Assert the
   **exit code** of the targeted run, not just the pass count.
3. **Every mutation from §8, run, with its real red output pasted.** Not "confirmed red" — the
   output.
4. **§5(c)**: which you did about `past`'s comparator, and why.
5. **§5(d)**: what you did about the `Reached` cell, and whether you agree it is unreachable.
6. **The §6 amendment**: the test's before/after, and the output of
   `git diff | grep '^-' | grep -E 'expect|toBe|toEqual|toHave'` — which must show only that test.
7. **Anything in this packet you found to be wrong.** The last four packets in this project each
   carried at least one false claim that a gate or worker caught. Finding one is a success, not an
   objection — report it rather than working around it silently.
