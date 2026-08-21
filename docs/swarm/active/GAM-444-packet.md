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

**There is no "names only" form, and the names are rejected by the type system.**

- `defineTheme.d.ts:201` — `tokens?: Partial<Record<TokenName, TokenValue>>`.
- `defineTheme.d.ts:42` — `TokenName = CoreTokenName | DomainTokenName`, a
  **closed** union of Astryx's own token keys.
- `'--color-series-1'` is in neither. Adding it is a `tsc` error, so gate 1
  fails. And every entry in `volt.ts`'s `tokens` block is a real
  `[light, dark]` **hex pair** — a slot cannot be declared without values.

The `meetings-design` skill independently forbids the workaround: *"The palette
hues themselves are still open… If you need them and they are not yet in
`volt.ts`, that is a blocker to raise, not a gap to fill with your own hex
values."*

**Worth recording for whoever unblocks it:** Astryx already ships a curated
categorical ramp of exactly ten vetted tokens —
`--color-data-categorical-{blue,brown,cyan,green,indigo,orange,pink,purple,red,teal}`
(`domainTokens/dataTokens.d.ts`) — with defaults in both modes, and this repo
already overrides two of them (`green`, `purple`) for `GoalBar` (T136). Mapping
the eight series slots onto eight of those names needs no new token, no invented
hex, and no `tsc` error. **That is a design decision for the owner or the design
contract, not for this ticket**, which is why it is filed rather than taken.

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
   `StudentMeetingView` from `../StudentMeetingView`, unchanged.**
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

`SeriesCardModel` — the view-model one coach series card renders, derived from a
`CoachMeetingRow`. Give it the fields the design contract names for a card:
event id, title, team-scope label, schedule chips, sessions-completed / total,
attendance %, next-session line, and the palette index. Document each field.

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

## 5. The import inversion this fixes — call it out, do not miss it

`src/lib/meetings/resolveCurrentStudentId.ts:52` and
`src/lib/supabase/loaders/meetings.ts:188` currently import **types from the page
module** (`src/pages/meetings/MeetingsList`). That is a `lib → pages` inversion.
Once the types live in `src/lib/meetings/types.ts`, re-point both to import from
there. This is an import-line change only — no logic, no behaviour.

## 6. Back-compat re-exports are load-bearing

**Ten modules import from `MeetingsList`** — `StudentHome.tsx:454`,
`StudentMeetingView.tsx:321`, `StudentMeetingView.test.tsx:56`,
`OutreachList.tsx:840`, `SideNav.test.tsx:45`, `MobileNav.test.tsx:44`,
`useOutreachBadgeCount.ts:103`, `useOutreachBadgeCount.test.ts:46`,
`resolveCurrentStudentId.ts:52`, `loaders/meetings.ts:188`.

`MeetingsList.tsx` keeps re-exporting every name it exports today. GAM-443
already established the pattern at `MeetingsList.tsx:1299-1308` — copy it.
**Every one of the 33 `export` statements currently in the file must still
resolve through `MeetingsList.tsx` after the split.**

## 7. Staging — three commits, pushed as each lands

Wall-clock insurance. Do them in order; each must leave the tree green.

- **Stage A** — `types.ts` + `coachModel.ts` + `studentModel.ts` + their tests;
  `MeetingsList.tsx` re-exports from them; §5 re-points. All 106 tests still pass.
- **Stage B** — move the coach and student views into `coach/` and `student/`;
  add the eight stubs. All 106 still pass.
- **Stage C** — split `MeetingsList.test.tsx` along the same boundaries;
  shell drops to ≤200 lines.

## 8. Acceptance criteria

1. `MeetingsList.tsx` is **≤200 lines**.
2. **Total test count across the split files is ≥106**, and no assertion text
   changes — only import paths. Verify with a full `npx vitest run`, not a
   per-file count.
3. Every one of the eight stubs exports a documented props `interface`.
4. `types.ts` exports every name in §4, with `ScheduleRule`/`Dow` re-exported
   from `format.ts` and **not redefined**.
5. All six gates green via the `gate-run` skill, `npx vite build` included
   (lazy-route chunking intact).
6. No file in §3 is modified. `git diff --stat` proves it.
7. No new behaviour: the diff is moves, import re-points and stub files.

## 9. Least confident decisions (item 19d)

1. **`ScheduleRule` re-exported from `format.ts` rather than defined in
   `types.ts`.** Wrong if the design contract's "input shape frozen by GAM-444"
   means GAM-444 was meant to *change* the shape GAM-443 shipped, rather than
   merely publish it at the frozen address. If so, the re-export freezes the
   wrong shape and five tickets inherit it.
2. **Cutting plan item 6 rather than finding a legal way to land it.** Wrong if
   a token can be declared outside `defineTheme`'s closed `TokenName` union —
   e.g. as raw custom properties in `theme.css`'s `@layer app` — in a way DES-21
   permits. I judged that custom CSS is the *last* escalation step and that
   inventing hues is separately forbidden, so the blocker stands. If a legal
   path exists, GAM-444 should have taken it and I have stranded five tickets on
   a follow-up row.
3. **`SeriesCardModel`'s field list is inferred from the design contract's
   card description, not from a spec.** Nothing in the repo defines it yet.
   Wrong if GAM-445 (SeriesCard) has already assumed a different shape — it
   would have to widen a frozen type, which the contract forbids.
4. **Forbidding `StudentMeetingView.tsx` outright.** The issue's own Allowed set
   includes it (everything under `src/pages/meetings/` except the dialog). If
   the student-view move genuinely requires an edit there, I have blocked the
   worker on a file it needs, and it must stop and say so rather than route
   around me.
5. **Three commits rather than one worker pass.** Wrong if the staging boundary
   leaves an intermediate commit that does not typecheck — Stage A re-points
   `lib` imports while the views still live in the page module, and if some type
   is only reachable through the page's own local scope, Stage A cannot be green
   on its own.
