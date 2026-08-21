# GAM-444 task packet — split `MeetingsList.tsx`

**Tier:** HEAVY (packet → `checker-premise` → worker → `checker-reviewer`).
**Author:** orchestrator (Claude), 2026-08-21.
**Branch:** `claude/gam-444-split-meetingslist`. **Base:** `main` @ `bdfafcf`.

---

## 0. Corrections to the issue, measured before this packet was written (item 19c)

The issue carries a `Verification note` claiming a re-check against `main` on
2026-08-21. **Three of its headline numbers are wrong, and one instruction is
not implementable.** Every figure below was measured on `bdfafcf`.

| Issue says | Measured truth | Why it drifted |
| -- | -- | -- |
| `MeetingsList.tsx` is **2997** lines | **2910** | 2997 was exact at `0138bfc`. Then **`b7e9b1d` (GAM-443)** hoisted the formatters to `src/lib/meetings/format.ts` and removed 87 lines. The issue was verified against the commit *before* that merge. |
| role switch at **:2944–2996** | **:2857–2910** | Same 87-line shift. The cited range is past EOF. |
| **121** existing tests | **106** | Never 121 at any commit in the last 12 touching this file — it has been 106 since `f8cba40` (T605). `npx vitest run src/pages/meetings/MeetingsList.test.tsx` → `Tests 106 passed`. |
| `resolveCurrentStudentId.ts` is the precedent for `src/lib/meetings/` | `format.ts` (+ `format.test.ts`) also live there already | GAM-443 landed after the issue was written. |

**106 is the acceptance number.** A worker told "121" would have to invent 15
tests, which plan item 7 forbids ("no assertion changes"). This is the single
most dangerous error in the issue text.

### 0b. Plan item 6 is BLOCKED and is cut from this packet's scope

The issue says: *"Pre-declare the series-color palette tokens in
`src/theme/volt.ts` (names only, e.g. 8 `--color-series-N` slots)."*

**The route it names is impossible; a different route is legal; and the thing
that actually blocks is neither.** Round 1 of the premise gate corrected this
section's reasoning — the cut stands, the ground has been replaced.

**1. The `volt.ts` route is impossible.** Measured, not argued:

- `defineTheme.d.ts:201` — `tokens?: Partial<Record<TokenName, TokenValue>>`.
- `defineTheme.d.ts:42` — `TokenName = CoreTokenName | DomainTokenName`, a
  **closed** union of Astryx's own token keys.
- Adding one is a hard `tsc` failure, reproduced by the gate in its own worktree:
  `src/theme/volt.ts(71,5): error TS2353: Object literal may only specify known
  properties, and ''--color-series-1'' does not exist in type
  'Partial<Record<TokenName, TokenValue>>'.` — **exit 2.**
- Every entry in that block is a real `[light, dark]` hex pair, so there is no
  "names only" form to fall back to.

**2. A `theme.css` route IS legal, so do not record this as "impossible".**
DES-21 (`PRD:241`) makes custom CSS step 4 of an *authorized* escalation; only
ejecting component source needs boss approval. The gate measured eight
`--color-series-N` custom properties in `theme.css`'s `@layer app`, aliasing
Astryx's own `--color-data-categorical-*`, at **tsc exit 0** with `src/theme`
tests 7/7 green — and with zero invented hex.

**3. What actually blocks is an open owner decision.**
`docs/swarm/auto-mode-decisions.md:4345-4352`: *"GAM-444 pre-declares eight
`--color-series-N` slots…; the values, and their contrast behaviour in both
themes, are still open."* Shipping placeholder hues would put a user-visible
surface on a stub, which item 27 grades `Partial` rather than `Passed`.
Deferring an undecided design value is correct. Calling it impossible was not.

**For whoever unblocks it.** Astryx ships ten vetted categorical tokens
(`--color-data-categorical-{blue,brown,cyan,green,indigo,orange,pink,purple,red,teal}`,
`domainTokens/dataTokens.d.ts:17-26`). **But only `green` and `purple` are
actually emitted** (`theme.css:294-295`, the T136 `GoalBar` overrides) — the
other eight appear in no stylesheet, so each mapped slot still needs its own
`volt.ts` override *and* a fresh per-mode contrast measurement. T136 already
measured the shipped defaults as same-value-in-both-modes and contrast-failing,
so this is real work, not a rename.

→ **Action: the worker does NOT touch `src/theme/volt.ts` or `src/theme/theme.css`.**
The orchestrator files the follow-up row before the PR opens (item 20) and
discloses it in the PR body. GAM-444 ships plan items 1–5 and 7 in full.

---

## 1. Goal

A mechanical, behavior-preserving split. **Move code; add no features.** If you
find yourself writing new rendering logic, you have left scope.

The point is file-disjointness: after this merges, the SeriesCard, SchedulePanel,
MeetingsRail, overlap and student-view tickets each own separate files and cannot
conflict.

## 2. Allowed files

Create / edit:

- `src/lib/meetings/types.ts` *(new)*
- `src/lib/meetings/coachModel.ts`, `src/lib/meetings/studentModel.ts` *(new)*
- their `*.test.ts` siblings *(new)*
- `src/pages/meetings/coach/CoachMeetingsView.tsx` *(new)*
- `src/pages/meetings/student/StudentMeetingsView.tsx` *(new)*
- `src/pages/meetings/coach/{SeriesCard,SchedulePanel,MeetingsRail}.tsx` *(new stubs)*
- `src/pages/meetings/student/{HeroCard,UpcomingList,AttendanceCard,PastList,ChildSwitcher}.tsx` *(new stubs)*
- `src/pages/meetings/MeetingsList.tsx` *(shrink to shell)*
- `src/pages/meetings/MeetingsList.test.tsx` *(split)*
- new test files alongside the modules they cover
- `src/lib/meetings/resolveCurrentStudentId.ts` — **import re-point only** (see §5)
- `src/lib/supabase/loaders/meetings.ts` — **import re-point only** (see §5)

## 3. Forbidden files — wider than the issue's list, deliberately

The issue forbids `ScheduleMeetingsDialog.*`, `src/lib/supabase/**`,
`LiveConsole.tsx`, `EndMeetingDialog.tsx`, `Kiosk.tsx`,
`EditMeetingSessionDialog.tsx`. **Three more are added here:**

1. **`src/pages/meetings/StudentMeetingView.tsx` (+ its test).** Singular
   "Meeting" — a *different* module from the `student/StudentMeetingsView.tsx`
   you are creating. It exports `ConsistencyStrip` and its four types, and
   `meetings-design` warns it is **not file-disjoint**: it is imported by
   `src/pages/home/ParentHome.tsx:402`, `src/lib/supabase/loaders/checkin.ts:210`
   and by `MeetingsList.tsx:608` (rendered at `:2683`). Editing it breaks two
   modules outside this label group. **The moved student view keeps importing
   `StudentMeetingView` from `../StudentMeetingView`, unchanged.** The gate
   confirmed this does not block the worker: `StudentMeetingView.tsx:321` imports
   from `./MeetingsList` **type-only**, so §6's re-export requirement keeps it
   green with zero edits there, and the moved view changes only its own specifier
   `./` → `../`.

   ⚠ **Disclosed consequence, deliberately accepted.** `StudentMeetingView.tsx`
   also exports `AttendanceStatus` (`:327`), `SessionStatus` (`:328`) and
   `StudentParticipationMetric` (`:357`) — structurally identical to the ones
   being frozen in `types.ts`. Because the file is Forbidden, GAM-444 creates a
   canonical home **without retiring the duplicates**, and TypeScript will not
   complain if a downstream ticket imports the wrong one. **Every meetings-redesign
   ticket imports these from `src/lib/meetings/types.ts`.** Retiring the
   duplicates is follow-up work, not this ticket's.
2. **`src/theme/volt.ts` and `src/theme/theme.css`** — §0b.
3. **`src/lib/meetings/format.ts`** — frozen by GAM-443. Import from it; never
   edit it, and never define a second copy of anything it exports.

## 4. The frozen contracts (`src/lib/meetings/types.ts`)

These names are frozen by the `meetings-design` skill's own table and five
tickets code against them. **Use these exact names and shapes.**

**Moved verbatim** from `MeetingsList.tsx` (current line numbers given so you can
find them; do not re-type them, move them):

`EventType` :627 · `SessionStatus` :628 · `AttendanceStatus` :629 ·
`PastAttendanceSummary` :715 · `CoachMeetingSessionDetail` :724 ·
`CoachMeetingRow` :754 · `CoachMeetingsData` :771 · `LoadCoachMeetingsDataFn` :781 ·
`StudentMeetingHistoryRow` :783 · `StudentParticipationMetric` :802 ·
`StudentMeetingsData` :813 · `LoadStudentMeetingsDataFn` :818 ·
`CancelMeetingSessionFn` :821 · `CurrentViewerIdentity` :829 ·
`ResolveCurrentStudentIdFn` :837 · `PartitionedRows<T>` :1121 ·
`CoachMeetingRowSummary` :1144 · `CoachMeetingEventTableRow` :1681 ·
`CoachMeetingSessionDetailTableRow` :1688 · `CoachMeetingTableRow` :1696

**Added new, empty of behaviour:**

```ts
/** Frozen by GAM-444; MeetingsRail and SeriesCard both read it. */
export interface MeetingsFocusRequest {
  eventId: string;
  sessionId?: string;
  monthKey?: string;
}
```

`SeriesCardModel` — **its field list is specified, not yours to infer. Copy it
from `docs/swarm/VOLT_Portal_PRD.md:303-313` (MTG-01a)**, which item 1 places
above the design skill. MTG-01a names: title and team scope; schedule chips;
season progress (sessions completed of total); attendance % across completed
sessions; and a next-session line (or the finished state). Add the event id and
the palette index, which the rendering needs and MTG-01a does not forbid.

⚠ **The attendance field is `attendancePct: number | null`.** MTG-01a's last
sentence is binding and is the reason this is called out rather than left to the
worker: *"The attendance % is **DATA-01 passthrough** from the metric view
(null → '—'), never computed in TypeScript."* Freezing it as `number` hands five
tickets a type that cannot represent `—`, and the design contract forbids
widening a frozen type — so GAM-445 would have to fabricate a `0`. Computing it
in TypeScript instead is a **BLOCKER** under constitution item 3. Put that
sentence in the TSDoc, on the field, so a downstream ticket cannot miss it.

`OverlapIndex` — map from session id to the overlapping session refs, per the
design contract's rules. **Type only. Do not create `src/lib/meetings/overlap.ts`
and do not write `buildOverlapIndex`** — that file and function belong to
GAM-450.

**`ScheduleRule` — do NOT define it here.** The design contract's table says the
`buildScheduleChips` *input shape* is "frozen by GAM-444 in `types.ts`", but
GAM-443 already shipped `ScheduleRule` and `Dow` in `format.ts:202-204`. Two
definitions is precisely the failure GAM-443 existed to end. **Re-export the
existing one** so both statements are true and there is exactly one definition:

```ts
export type { Dow, ScheduleRule } from './format';
```

The gate found the decisive evidence: `format.ts:168-169` says verbatim
*"buildScheduleChips -- new (GAM-443 prescription 4). The shape GAM-441 will
freeze into `types.ts`."* GAM-443's own author intended the shipped shape to be
**published at the frozen address, not replaced**. Re-export compiles and lints
clean (measured, exit 0/0).

⚠ **Carry `format.ts:180-183`'s disclosure forward into the TSDoc**: `ScheduleRule`
**cannot express a midnight-spanning rule**, and that file says explicitly that
whoever freezes the shape "needs to know the shape cannot express it". GAM-444 is
that act. Five tickets inherit the limitation, so they must inherit it knowingly.

**Also move `Team` (`MeetingsList.tsx:646`).** It is declared locally and *not
exported* today, and `CoachMeetingsData` (`:771-779`) requires it — so Stage A
cannot typecheck without it. It is a 21st moved type; criterion 4 does not forbid
`types.ts` exporting supporting types beyond this list. Note also that
`MeetingsList.tsx:537` imports `Role` from `src/app/guards`; carrying that into
`types.ts` makes `src/lib/**` depend on `src/app/**`. **That is accepted here**
— `guards` is the app-wide role vocabulary, not a page, so it is not the
`lib → pages` inversion §5 exists to remove — but say so in a comment rather than
leaving the next reader to wonder.

## 5. The import inversion this fixes — call it out, do not miss it

`src/lib/meetings/resolveCurrentStudentId.ts:52` and
`src/lib/supabase/loaders/meetings.ts:177-188` currently import from the page
module (`src/pages/meetings/MeetingsList`). That is a `lib → pages` inversion.
Once the types live in `src/lib/meetings/types.ts`, re-point both.

**The two are not the same change, and the packet previously said they were.**

- `resolveCurrentStudentId.ts:52` is **type-only**. Genuinely no behaviour.
- `loaders/meetings.ts:177-188` imports **two runtime values** —
  `buildCoachMeetingRows` and `buildStudentMeetingsData` — alongside eight types.
  Re-pointing those **changes the module graph**: value imports move across the
  page/lib boundary and Vite re-chunks accordingly.

This is not hypothetical here. `loaders/meetings.ts:161-173` and
`resolveCurrentStudentId.ts:5-44` record that T605 measured exactly this class of
move as worth *"entry chunk +50.47 kB gz, 18 lazy chunks collapsed."* **Read
those two comments before doing the re-point**, and measure the result per
criterion 5 rather than asserting it is fine.

## 6. Back-compat re-exports are load-bearing

**Eleven modules import from `MeetingsList`** — `StudentHome.tsx:454`,
`StudentMeetingView.tsx:321`, `StudentMeetingView.test.tsx:56`,
`OutreachList.tsx:840`, `SideNav.test.tsx:45`, `MobileNav.test.tsx:44`,
`useOutreachBadgeCount.ts:103`, `useOutreachBadgeCount.test.ts:46`,
`resolveCurrentStudentId.ts:52`, `loaders/meetings.ts:177-188`, and — the one
the first draft missed — **`src/app/router.tsx:153`**, which is
`lazy(() => import('../pages/meetings/MeetingsList'))` and consumes the
**default** export.

⚠ **`export default MeetingsList` must survive the split.** It is the live route.
`router.tsx` is neither Allowed nor Forbidden here because it needs no edit —
but only if the default export stays.

`MeetingsList.tsx` keeps re-exporting every name it exports today. GAM-443
already established the pattern at `MeetingsList.tsx:1299-1306` — copy it.
**The preserved surface is 40 exported names**: 33 locally declared, plus
`default`, plus the 6 re-exported from `format.ts`. (The file has 35 line-start
`export` statements — a worker counting statements will not arrive at 33, which
is why the number is stated as names.)

## 7. Staging — three commits, pushed as each lands

Wall-clock insurance. Do them in order; each must leave the tree green.

- **Stage A** — `types.ts` + `coachModel.ts` + `studentModel.ts` + their tests;
  `MeetingsList.tsx` re-exports from them; §5 re-points. All 106 tests still pass.
- **Stage B** — move the coach and student views into `coach/` and `student/`;
  add the eight stubs. All 106 still pass.
- **Stage C** — split `MeetingsList.test.tsx` along the same boundaries;
  shell drops to ≤200 lines.

## 8. Acceptance criteria

1. `MeetingsList.tsx` is **≤200 lines**, and still carries `export default`.

2. **No test is lost or renamed — checked by name, not by count.** The count
   criterion the first draft used was self-contradicting (a full run reports
   2623, not a split-file subtotal) and blind to deletion (§7 *adds*
   `coachModel.test.ts` / `studentModel.test.ts`, so five deleted tests plus five
   new ones still reads "≥106"). Do this instead:

   ```bash
   npx vitest run src/pages/meetings/MeetingsList.test.tsx \
     --reporter=json --outputFile=/tmp/before.json     # at the merge base
   ```

   Collect `assertionResults[].fullName`. The baseline is **106 names, 106
   unique** (measured). After the split, run the same reporter over every file
   the tests were split into and assert the resulting set is a **superset** of
   the baseline. A rename or a deletion fails this; neither fails a count.
   **No assertion text changes — import paths only.**

3. Every one of the eight stubs exports a props `interface` carrying a TSDoc
   block on the interface **and on every field**. ("Documented" was undefined in
   the first draft; that is the bar.)

4. `types.ts` exports every name in §4 including `Team`, with `ScheduleRule`/`Dow`
   **re-exported** from `format.ts` and not redefined, and `attendancePct` typed
   `number | null`.

5. All six gates green via the **`gate-run`** skill. Baselines, measured on
   `bdfafcf` — hand these to the skill rather than inventing them:
   **full suite 2623 tests / 104 files; scoped run over
   `src/pages/meetings src/lib/meetings` 374 tests / 9 files.**

   **Chunking is measured, not asserted.** "Lazy-route chunking intact" had no
   defined measure and §5's re-point legitimately moves code between chunks.
   Instead: report the `dist/assets` table from `npx vite build` before and
   after. `MeetingsList` must **remain a lazy chunk**, and the **entry chunk must
   not grow**. Baseline: `MeetingsList-C3yCdT5f.js 35.60 kB │ gzip: 10.35 kB`.

6. No file in §3 is modified. `git diff --stat` against the merge base proves it.

7. **No new behaviour**, with one disclosed and measured exception: §5's
   `loaders/meetings.ts` re-point moves two value imports across the page/lib
   boundary and therefore changes the module graph. That is the *point* of the
   ticket, it is bounded by criterion 5's chunk measurement, and it is the only
   permitted departure from "moves, import re-points and stub files".

## 8b. Who repairs the design contract, and when (round-1 MAJOR-4)

`.claude/skills/meetings-design/SKILL.md:31` states that `--color-series-1…8`
are frozen **by GAM-444** in `volt.ts`. After §0b's cut that row is false, and
five tickets read that table as authority. Filing a follow-up satisfies item 20
but does **not** stop five tickets each independently rediscovering the blocker.

**The worker may not fix it** — Authority Boundaries forbid workers editing
`.claude/skills/**`. **The orchestrator owns that file** (`AGENTS.md`,
"Ownership and protected files") and repairs it in the same PR as this work,
alongside the stale `SKILL.md:156` citation of `MeetingsList.tsx:602` (the true
line is `:608`; the packet is right and the skill is stale).

## 9. Least confident decisions (item 19d)

*Round 1 of the gate resolved three of these. Struck text is kept rather than
deleted — item 30c's rule, that removing the error removes the evidence the
check happened, applies to a packet as much as to an issue.*

1. **`ScheduleRule` re-exported from `format.ts` rather than defined in
   `types.ts`.** ~~Wrong if the design contract meant GAM-444 to *change* the
   shape GAM-443 shipped.~~ **RESOLVED — SOUND.** The gate found
   `format.ts:168-169` saying verbatim *"The shape GAM-441 will freeze into
   `types.ts`"*: GAM-443's author intended publication at the frozen address, not
   replacement. Re-export measured clean (tsc 0, eslint 0).
2. ~~**Cutting plan item 6 rather than finding a legal way to land it.**~~
   **RESOLVED, half against me.** A legal mechanism *does* exist — `theme.css`
   `@layer app`, DES-21 step 4, measured green with zero invented hex — so
   "not implementable" was wrong. The cut survives on different ground: the hues
   are an open owner decision, and placeholders would ship a stub surface under
   item 27. §0b now says this. **Still genuinely open:** whether the five
   downstream tickets can tolerate the wait, which is the owner's call.
3. ~~**`SeriesCardModel`'s field list is inferred… nothing in the repo defines
   it yet.**~~ **FALSE — this was the round-1 BLOCKER.** `VOLT_Portal_PRD.md:303-313`
   (MTG-01a) specifies it, and item 1 ranks the PRD above the design skill. My
   paraphrase dropped `attendancePct`'s nullability and its DATA-01 passthrough
   rule; §4 now cites the PRD directly. **What is still uncertain:** the two
   fields MTG-01a does *not* name — event id and palette index — remain my
   invention, and if GAM-445 assumed different names it would have to widen a
   frozen type, which the contract forbids.
4. **Forbidding `StudentMeetingView.tsx` outright**, against the issue's own
   Allowed set. **RESOLVED — SOUND, and it does not block the worker:**
   `StudentMeetingView.tsx:321` imports from `./MeetingsList` type-only, so §6's
   re-exports keep it green with zero edits there. Residual risk is disclosed in
   §3 instead: three duplicate type exports survive in that file.
5. **Three commits rather than one worker pass.** **The failure I feared is
   real** — `Team` (`:646`) is exactly the type reachable only through the page's
   local scope, and Stage A cannot typecheck without it. §4 now moves it.
   **Still open:** whether any *other* such symbol exists. Stage A is the proof;
   if it will not typecheck alone, stop and report rather than merging stages.
6. **NEW — the chunk-map criterion may be unsatisfiable rather than merely
   strict.** Criterion 5 requires the entry chunk not to grow while §5
   deliberately moves two value imports across the page/lib boundary. T605
   measured that class of move at *+50.47 kB gz* on the entry chunk. If the
   re-point makes growth unavoidable, the criterion is wrong and the right answer
   is to report the measured delta and escalate — **not** to skip the re-point,
   and **not** to quietly pass the criterion.
