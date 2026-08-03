# T330 — worker packet v2: a dateless outreach event becomes visible and fixable

**Tier: HEAVY** (constitution item 26 — `constitution.md:323`, "packet + premise gate + worker +
checker"). Trigger: this changes what renders on the **only** surface from which an event is
reachable, and the event carries figures that reach a grant-reporting total.

**Gate history: round 1 returned REVISE** — 1 BLOCKER, 3 MAJOR, 5 MINOR/NIT. The gate **built the
entire prescription** in its own worktree and reached green (76 files / 1854 tests), which is why its
findings are prescriptive rather than advisory. **Every round-1 finding was verified by the
orchestrator directly against live code, not relayed.** Item 19a caps the gate at two rounds; a third
escalates to the owner.

**Branch point:** `b1d6f4a`. **Branch:** `claude/t330-orphan-events`. Branch from
`claude/t330-orphan-events` (commit `9fd98a2`), **not** from `b1d6f4a` — the owner's rulings in §3
exist only on that branch.

**Measured baseline at `b1d6f4a`, `.env.local` absent** — measured by the orchestrator and
independently re-measured by the gate. `W2-KICKOFF.md`'s figures (361 warnings / 1842 tests) are
**stale by two W6 merges**; do not use them:

```
tsc 0 · vite build ✓ · prettier clean · eslint 0 errors / 360 warnings · vitest 76 files / 1850 tests
```

---

## 1. The defect

An `events` row whose `event_sessions` insert failed has zero sessions. `buildEventGroups` drops it
from **both** buckets — `if (eventSessions.length === 0) continue;` (`OutreachList.tsx:1730`), stated
in its own module doc at `:1711-1712`. Every in-app link to `/outreach/:eventId` is built from a
rendered row (`OutreachList.tsx:2450`, `:3547`, and `CalendarPage.tsx:514`, itself session-driven at
`:349` — the gate grepped repo-wide and found no other non-test source), so **no row means no link**.
The coach cannot see the event, reach it, or fix it. Not an RLS problem: `staff_all on events`
(`rls.sql:149`) reads the row fine.

---

## 2. Allowed Files

```
src/pages/outreach/OutreachList.tsx          (source)
src/pages/outreach/OutreachList.test.tsx     (tests)
```

The gate's full build — including everything added in v2 — diffs **only** these two files.

**Forbidden, owned by live sessions:** `src/lib/supabase/loaders/attendance.ts` (W1, PR #28 — import
only), `src/pages/checkin/**`, `LiveConsole.tsx`, `Kiosk.tsx`, `loaders/checkin.ts`,
`loaders/kiosk.ts` (W1), `src/pages/home/**` (W5), `src/pages/reports/**`, `loaders/reports.ts`
(**W4** — `WORKFLOWS.md:177`), `*metric_views.sql`, `*kpi_views.sql` (W4).

---

## 3. The owner's rulings — build to these

Recorded in `auto-mode-decisions.md`, entry **"2026-08-03 — George's ruling on T330"** (on branch
`claude/t330-orphan-events`, commit `9fd98a2`). **Cite that file, never this paraphrase.**

1. **Bucket: `Upcoming`, pinned to the top.**
2. **Numeric cells: em dash (`—`), not zeros.**
3. **Marker: a "Needs dates" badge.**
4. **Audience: BOTH views** — coach *and* student/parent. He ruled against the orchestrator's
   coach-only recommendation.

**Settled, do NOT reopen:** a third "Needs dates" bucket, ruled out on T304
(`auto-mode-decisions.md:1320-1333`). Two buckets only.

---

## 4. The prescription in the ledger row and `W2-KICKOFF.md` is WRONG — confirmed by execution

Both say the fix is *"delete the `continue` at `OutreachList.tsx:1730`"*. **The gate ran it:**

```
CAUGHT: TypeError: Cannot read properties of undefined (reading 'startsAt')
```

`hasScheduled` is `false` for a zero-session event (`:1731`), so deleting the `continue` alone routes
the orphan into **`past`**, whose comparator dereferences `a.sessions[a.sessions.length - 1].startsAt`
(`:1739-1742`) — `undefined` on an empty array. `upcoming` has the identical defect via
`find(...) ?? a.sessions[0]` (`:1734-1737`).

**Confirmed: a single orphan alone does NOT throw** — it lands in `past` silently. A one-element array
never invokes the comparator. The crash needs a second entry in the same bucket, and then it takes out
the entire list for every viewer.

---

## 5. What to build

**(a) Route, don't just un-skip.** A zero-session event goes to **`upcoming`**, never `past`.

**(b) Empty-safe, pinned `upcoming` comparator.** Dateless entries sort ahead of every dated entry and
tie with each other. The gate's working shape, two lines:

```js
if (aDateless || bDateless) return Number(bDateless) - Number(aDateless);
```

**(c) `past`'s comparator.** After (a), `past` can no longer receive a zero-session entry — the gate's
probe confirms its safety depends **entirely** on (a). Leave it unchanged with a comment recording
that. **Do not add an unreachable guard and describe it as load-bearing** — that is T301's defect,
an open row in this workflow.

**(d) Em-dash cells — FOUR StatCells, not two.** *(round-1 MAJOR)*

The coach table renders through **two** branches and the packet v1 cited only one:

| Branch | Hours cell | Count cell |
|---|---|---|
| Desktop | `:2816` | `:2832` |
| **Narrow** (`if (isNarrow)`, `:2674`) | **`:2696`** | **`:2700`** |

Both render `` `${hoursValue}h` `` / `` `${countValue} students` ``. **Proven blind spot:** with only
the desktop cells dashed, un-dashing the narrow cell leaves the suite green — a coach on a phone still
sees `0h / 0 students`. Dash all four. The test file already has the `vi.stubGlobal('matchMedia', …)`
idiom for narrow-mode DOM tests, and `test-setup.ts` ships a guarded polyfill.

> **`Reached` is genuinely unreachable for a dateless row — do NOT build a dashed version.** The gate
> confirmed it doubly: it is gated on `bucket === 'past'` at **both** `:2836` and `:2729-2733`, and
> `reached` is `null` for empty `completedSessions` anyway (`:1800`). A dateless row is pinned to
> `upcoming`. The owner's "all three" is satisfied by hours + count. **Report this reasoning in your
> output** rather than silently skipping it.

**(e) "Needs dates" badge, both views.** Coach: alongside the type badge in `CoachEventDateCell`.
Student/parent: next to its own type badge at `:3445-3448`. `Badge variant="warning"` is verified
present in the installed Astryx source (`@astryxdesign/core/src/Badge/Badge.tsx:71,135`) — constitution
item 2 requires props come from `astryx-api.md`, so confirm there too before using it.

**There is nothing to mirror on the student row's numeric cells — it has none.** It reads only
`stats.dateRangeLabel` and `stats.weekdayChips`, stated in its own comment at `:3430-3436`. v1 told you
to mirror cells that do not exist; that instruction is withdrawn.

**(f) The date cell needs no work.** `formatEventDateRangeLabel` already returns
`'No sessions scheduled yet.'` for an empty array (`:1565`). That branch is dead **on the list**
specifically — it does render on `OutreachDetail` (`:1131`/`:2015`). (a) is what makes it render here.
Do not duplicate the string.

**(g) NEW, and without it this task does not fix its own primary scenario.** *(round-1 MAJOR)*

Both views gate the **entire list** on sessions, not events:

```js
const hasAnyOutreach = sessions.length > 0;   // coach :3241 → :3282 ; student :3770 → :3793
```

The gate built the full §5(a)–(f) fix, got it green, then probed a season containing **only** an orphan:

```
ROW RENDERED: false / EMPTYSTATE RENDERED: true
```

**A failed *first* create of a season stays invisible and unfixable, and all ten v1 criteria pass
anyway.** Change both gates to consider events as well as sessions (`events.length > 0 ||
sessions.length > 0`, or equivalent). Both are inside the Allowed File.

**Do not touch `computeEventRowStats` (`:1830-1855`).** The gate confirmed by execution that it is
already total over an empty session list and the row renders without crashing.

---

## 6. AUTHORIZED TEST AMENDMENTS — **two** tests, not one *(round-1 BLOCKER)*

v1 authorized amending one test and forbade everything else. **That was unsatisfiable.** The routing
change reddens **two** sibling tests that share the `e3` fixture, and the gate hit it on a correct
implementation:

```
2 failed | 94 passed
groups by EVENT … → expected [ 'e3', 'e1' ] to deeply equal [ 'e1' ]
```

Both are authorized to change, and **only** these two. Definition of Ready item 5
(`constitution.md:120`) requires reversals of passed work to be explicit and authorized; this is that
authorization.

**Test 1 — `groups by EVENT (one entry per event…)`, `:562-567`.** `upcoming.map(...)` becomes
`['e3', 'e1']`; the `upcoming[0].sessions` assertion must move to `upcoming[1]`. Keep
`past.map(...) === ['e2']` unchanged.

**Test 2 — `omits an event with zero real sessions from both buckets`, `:569-573`.** Rewrite to assert
`e3` is now in `upcoming`, pinned first, and **still not in `past`**. **Keep the `past` half** — it is
the guard against §4's crash. **Rename it**; a test named "omits" that asserts inclusion is worse than
no test. Do not delete or skip it.

Fixture `e3` (`'No sessions yet'`) already exists at `:525`, with no sessions in the array (`:559`).

**The rest of the suite is clean** — the gate ran it fully amended: **76 files / 1854 tests green**, no
student/parent-view test breaks, no other file depends on the omission. If anything else reddens, that
is a finding: **report it, do not fix it by editing an assertion.**

`git diff | grep '^-' | grep -E 'expect|toBe|toEqual|toHave'` must show removed assertion lines from
**these two tests only**.

---

## 7. Harness facts — verified by the gate, citations corrected

- `OutreachList.test.tsx` (3300 lines) uses **raw `createRoot`/`act`** (`:38`, `:246`). **No
  `@testing-library/react` is installed** — the gate confirmed the directory does not exist.
- **Exactly one `vi.mock`**, at **`:56`** (v1 said `:57-64`): a partial mock of `loaders/selfCheckoff`
  intercepting `loadSelfCheckoffAttendance`. **`loaders/outreach` is NOT mocked** — imported real at
  **`:44`** (v1 said `:46`).
- Renders need real `<SeasonProvider>` (T106) + `AuthProvider`/`LoginAs` + `MemoryRouter`.
- `buildEventGroups`, `computeEventRowStats`, `formatEventDateRangeLabel` are all exported and
  directly unit-tested (`:87`, `:91`, `:100`; blocks at `:521`, `:576`, `:630`). Put routing and sort
  criteria at pure-function level; badge, em-dash, empty-state and Edit-path criteria need DOM.
- jsdom lacks `HTMLDialogElement.prototype.showModal()`; the file already polyfills it locally.

---

## 8. Acceptance criteria — each names a mutation that MUST turn it red

The orchestrator replays **every** mutation personally. Every mutation below except C3's was executed
by the gate and reddened; C3's was reworded because the literal version stayed green.

| # | Criterion | Mutation that must redden it |
|---|---|---|
| **C1** | A zero-session event appears in `upcoming` | restore `if (eventSessions.length === 0) continue;` |
| **C2** | A zero-session event is **not** in `past` | route zero-session entries to `past` |
| **C3** | It sorts **first** in `upcoming` | make dateless entries compare equal to everything (`return 0`) — **must fail the `upcoming[0].event.id` assertion, not throw** |
| **C4** | Two dateless + ≥1 dated event do not throw | remove the dateless guard from `upcoming`'s comparator — **must throw a real `TypeError`** |
| **C5** | `past` with ≥2 entries still sorts correctly | reverse the `bLast`/`aLast` operands |
| **C6** | Hours renders `—`, **desktop and narrow** | return `` `${hoursValue}h` `` unconditionally — run it against **each** branch separately |
| **C7** | Count renders `—`, **desktop and narrow** | return `` `${countValue} students` `` unconditionally — **each** branch separately |
| **C8** | The **"Needs dates"** badge renders, both views | drop the badge from the cell |
| **C9** | The date cell renders `'No sessions scheduled yet.'` | make `formatEventDateRangeLabel` return `''` for `[]` |
| **C10** | A **dated** event's row is unchanged — date, hours, count, no badge | apply dateless formatting unconditionally |
| **C11** | *(new)* An **orphan-only season** renders the row, not the EmptyState — **both views** | revert `hasAnyOutreach` to `sessions.length > 0` |
| **C12** | *(new)* "Edit – {title}" renders on the dateless row and opens the dialog without crashing | — see note |

**C3's literal v1 mutation was measured GREEN** and is withdrawn: a `?? ''` sentinel sorts first in
`localeCompare` by accident, so the pin survived unpinned. The reworded mutation reddens correctly
(gate: `expected 'e1' to be 'e3'`).

**C4 needs ≥2 entries in one bucket** — a one-element bucket never invokes the comparator. State your
fixture shape.

**C2's fixture:** under its mutation with §5(c) left unguarded, the test reddens by §4's `TypeError`
**before** its `past.some` assertion runs. Include a **single-orphan** fixture variant so the assertion
arm itself fires, not just the crash.

**C11 is the criterion that makes this task fix its own headline scenario.** Without it every other
criterion passes on a build where a failed first create is still invisible.

**C12:** the gate verified `buildInitialOutreachEventFromRow` is total over `[]` and the dialog opens
(`DIALOG OPEN: true`), so no source change is expected — this is a regression guard. If no mutation
reddens it, say so and keep it as a smoke test rather than inventing one.

**C5, C9, C11, C12 need new tests** — no baseline test has ≥2 `past` entries, pins
`formatEventDateRangeLabel([])`, builds an orphan-only season, or exercises the Edit path.

**C10 is the regression guard.** Without it every other criterion is satisfiable by formatting every
row as dateless.

**Paired assertions** (this repo has shipped 7+ that passed for the wrong reason): C1/C2 assert
presence in `upcoming` **and** absence from `past` in the same test. C8's absence arm must be paired
with proof the row itself rendered. C11 must assert the row rendered **and** the EmptyState did not.

---

## 9. Out of scope — filed, not built (item 20)

**T330's other half is not yours.** An orphan's adult-volunteer figures double-count in the season
totals: the create dialog collects them (`OutreachEventDialog.tsx:1000-1001`), `queryHoursEvents`
selects `from('events')` on `season_id` **alone** with no session join (`reports.ts:401-411`), and
`buildSeasonTotals` sums across all season events with **no session filter** (`HoursTab.tsx:593-596`,
called `:1094`). All four citations verified exact by the gate.

`pages/reports/**` and `loaders/reports.ts` are **W4's** (`WORKFLOWS.md:177`). **Do not touch them.**
The orchestrator files this as a new row in the **T500–T599** block. Making the orphan visible gives
the coach the ability to delete or fix the duplicate; it does not make the totals correct.
**Say so in your output** rather than implying this task closes the wrong number.

---

## 10. Required worker output

Write `docs/swarm/active/T330-worker-output.md`:

1. **The commit SHA**, and confirmation the change is in the **committed blob** — `git diff` against
   the branch point non-empty (item 21; T142 reported complete work that was never committed).
2. **All six gates**, `.env.local` absent, against the measured baseline (**0 errors / 360 warnings**,
   **76 files / 1850 tests**). Explain any warning rise. Assert the **exit code** of the targeted run.
3. **Every mutation from §8, run, with real red output pasted.** Not "confirmed red" — the output.
   C6/C7 must show the desktop and narrow branches reddening **separately**.
4. **§5(c)**: what you did about `past`'s comparator and why.
5. **§5(d)**: your reasoning on `Reached` being unreachable — agree or disagree.
6. **§5(g)**: the orphan-only-season probe, before and after, both views.
7. **§6**: both tests' before/after, plus `git diff | grep '^-' | grep -E 'expect|toBe|toEqual|toHave'`,
   which must show only those two.
8. **Anything in this packet that is wrong.** v1 carried a BLOCKER, three MAJORs and three bad
   citations, all caught by a gate that executed rather than read. Finding another is a success, not
   an objection.
