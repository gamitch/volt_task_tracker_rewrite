# GAM-447 task packet — the coach `SeriesCard`

Tier: **STANDARD** (item 26). One worker; the orchestrator replays the mutation
and runs the six gates. Repository path: `/home/runner/work/volt_task_tracker_rewrite/volt_task_tracker_rewrite`,
branch `claude/gam-447-series-card` (already rebased onto `origin/main` @ `3d27d8a`).

## 0. What the orchestrator measured before writing this packet

Every claim below was checked against `origin/main` at `3d27d8a` (after PRs
#230/#231 merged — the issue was written before those landed, so its "stub" and
"frozen props" references now point at real files).

| Claim in the issue | Measured state |
| -- | -- |
| `src/pages/meetings/coach/SeriesCard.tsx` is a stub with frozen props | **True.** 44 lines; `SeriesCardProps = { model: SeriesCardModel; overlapCount?: number; isSelected?: boolean; onSelect?: (r: MeetingsFocusRequest) => void }` |
| `buildScheduleChips` lives in `src/lib/meetings/format.ts` | **True**, `format.ts:291`, with `Dow`/`ScheduleRule` at `:202`/`:204` |
| `SeriesCardModel` is frozen in `src/lib/meetings/types.ts` | **True**, `types.ts:268-306` |
| `onSaveMeetingSeries` seam exists in `MeetingsListProps` | **True**, `MeetingsList.tsx:2019` — but it is **not** on `SeriesCardProps` (see §3) |
| Series palette `--color-series-1…8` in `src/theme/volt.ts` | **FALSE — absent.** Zero occurrences of `series` in `volt.ts` (see §3) |
| Card / ProgressBar / Badge documented in `astryx-api.md` | **True** — and they are the only legal prop source (item 2) |

## 1. Allowed Files — nothing else, at all

- `src/pages/meetings/coach/SeriesCard.tsx` (replace the stub body; **keep the
  exported `SeriesCardProps` shape as-is**)
- `src/pages/meetings/coach/SeriesEditPanel.tsx` (new, only if §3's decision
  says build it — read §3 before creating it)
- `src/pages/meetings/coach/SeriesCard.css` (only if genuinely required; see §5)
- `src/pages/meetings/coach/SeriesCard.test.tsx` (new)

Forbidden, and this is a BLOCKER if touched: `src/lib/meetings/**` (including
`types.ts` and `format.ts`), `src/theme/**`, `CoachMeetingsView.tsx`,
`MeetingsList.tsx`, `docs/swarm/**`, `.claude/**`, `.github/workflows/**`.

## 2. Read first, in this order

1. `.claude/skills/meetings-design/SKILL.md` — **mandatory**, it is the contract
   eleven parallel tickets agree through.
2. `src/lib/meetings/types.ts:253-325` — the frozen `SeriesCardModel`,
   `MeetingsFocusRequest`, `OverlapIndex`.
3. `src/lib/meetings/format.ts` — every formatter you may need already exists.
   **Never re-implement one**; that duplication is the whole reason GAM-443
   existed.
4. `docs/swarm/VOLT_Portal_PRD.md:303-313` (MTG-01a) — the authority. Item 1
   puts the PRD above the skill file and above the issue text.
5. `docs/swarm/astryx-api.md` — `Card`, `ProgressBar`, `Badge`, `Button`,
   `Text`, `Heading`, `HStack`, `VStack`, `Skeleton`, `EmptyState`, `Banner`.
   A prop not in that file is presumed hallucinated → MAJOR.
6. `src/pages/meetings/coach/CoachMeetingsView.tsx` — read-only, for the house
   idiom (`LoadState`, `pixel`/`proportional`, badge variants).

## 3. Three things the issue asks for that the frozen contract cannot carry

The orchestrator measured these; do **not** solve them by widening a frozen
type. The skill is explicit: *"Do not reshape a frozen type to fit your
component — a sibling ticket is coding against it right now."* Follow-ups are
being filed for all three; your job is to build the rest **completely** and
leave a clean seam.

**3a. Fields `SeriesCardModel` does not have.** The issue asks for a supporting
line "location · team scope · N on roster", a `N canceled` badge, a span chip
(`Sep – Mar 2027`), "Hours logged of planned", and a next-session value carrying
"· N expected". `SeriesCardModel` carries none of those — it has exactly
`eventId, title, teamScopeLabel, scheduleChips, sessionsCompleted,
sessionsTotal, attendancePct, nextSessionLabel, paletteIndex`.

→ **Build MTG-01a's card from the fields that exist.** Render the supporting
line as the team scope alone. Render the next-session line from
`model.nextSessionLabel` (it is already a formatted string; `null` means
finished — supply the finished copy in the component, per `types.ts:296-300`).
Do **not** add fields, and do **not** fabricate a zero for a number you do not
have (that is the same defect class as a fabricated `0%`).

**3b. The series palette does not exist.** `--color-series-1…8` is absent from
`src/theme/volt.ts`, and the skill says in terms: *"If you need them and they
are not yet in `volt.ts`, that is a blocker to raise, not a gap to fill with
your own hex values."* `volt.ts` is also outside your Allowed Files.

→ **Do not invent hues, and do not substitute an unrelated existing token.**
Carry `model.paletteIndex` onto the card's root element as a
`data-series-palette-index` attribute (a stable, testable hook), and render the
color-dependent treatments — dot, tinted progress bar, tinted calendar icon —
in the component's *neutral/default* form for now. When the owner settles the
hues, one CSS rule keyed on that attribute lights all three up with no change
to this component. Say so in the file's module doc, naming the open decision.

**3c. `onSaveMeetingSeries` is not on `SeriesCardProps`.** The Edit affordance
in the issue submits through that seam, but the frozen props expose no such
callback, and adding a required one would break `CoachMeetingsView` (a sibling
ticket's file).

→ **Do not create `SeriesEditPanel.tsx` in this ticket.** Render the `Edit`
affordance only if it can be raised through an existing prop; it cannot, so
**omit it entirely** rather than shipping a button that does nothing (item 27 —
an inert control on a real surface is exactly the `SettingsPage` light/dark
failure). A follow-up is filed to add the seam and the panel together.

If you disagree with any of 3a–3c, **stop and say so in your report** rather
than working around it.

## 4. What to build — MTG-01a exactly

`SeriesCard` renders one fixed-size `Card` whose height does **not** grow with
session count. Contents, top to bottom:

1. **Header** — `model.title` as the card heading, `model.teamScopeLabel` as the
   supporting line. Truncate/clamp the title rather than letting it grow the
   card.
2. **Schedule chips** — `model.scheduleChips` rendered as `Badge`s, one per
   chip. The strings arrive pre-formatted from `buildScheduleChips`; **never
   reformat them**. Cap the visible chips at a fixed number (4) and render a
   `+N more` chip for the remainder — this is one of the two places height
   invariance is actually won.
3. **Overlap badge** — when `overlapCount` is truthy, one neutral `Badge`
   reading `N overlap` (BEH-04's precedent: a neutral computed count, never
   error/red, never urgency copy — item 17). Absent when `0`/`undefined`.
4. **Progress** — `ProgressBar` plus the label
   `"{sessionsCompleted} of {sessionsTotal} sessions held"`. **No percentage
   arithmetic in this component** (DATA-01/item 3). `ProgressBar`'s own
   `value`/`max` props (see `astryx-api.md`) take the two counts directly; if
   the documented API only accepts a 0–1 or 0–100 `value`, that ratio is a
   progress-bar rendering input and is permitted — but the *attendance* figure
   is never computed, only passed through.
5. **Attendance** — `model.attendancePct` rendered as `"{n}%"`, and as the
   em-dash `"—"` when `null` (`v_student_participation`'s convention; a
   fabricated `0%` is a BLOCKER), with the supporting words
   `"across {sessionsCompleted} held"`.
6. **Next session** — `model.nextSessionLabel` when non-null, under a
   `"Next session"` label; when `null`, the finished copy (`"No sessions
   remaining"` — sentence case, DES-14). The label text must state *when a
   thing is*, never what was missed (item 17).
7. **View full schedule** — a `Button` reading
   `"View full schedule ({sessionsTotal} sessions)"` calling
   `onSelect?.({ eventId: model.eventId })`. Exactly the frozen
   `MeetingsFocusRequest` shape — no extra keys.
8. **Selected state** — `isSelected` marks the card visually *and*
   programmatically (e.g. `aria-current`); do not rely on color alone.

**DES-12 four states (item 12).** The component takes no async props, so the
four states are rendered from what it is given, and all four must be reachable
in tests:
- **loading** — an explicit `Skeleton`-based branch (add an optional
  `isLoading?: boolean` prop **only if** it is additive and optional, so no
  existing caller breaks; otherwise render the loading shape from a
  documented Astryx skeleton and say in your report how a caller reaches it);
- **empty** — `sessionsTotal === 0`: an `EmptyState`-style body inside the same
  fixed-size card, no progress bar, no next-session line;
- **error** — an optional `errorMessage?: string` prop (additive, optional)
  rendering a `Banner`/inline error inside the card;
- **populated** — the full render above.

Every added prop must be **optional** and must not change the meaning of the
four frozen ones.

## 5. Styling

DES-21 escalation order: component → theme token → `xstyle` → custom CSS. The
repo has exactly one CSS file in `src/` (`src/theme/theme.css`) — there is no
per-component CSS convention here. **Prefer Astryx primitives and inline style
objects** (the `pixel`/`proportional` idiom `CoachMeetingsView.tsx` uses).
Create `SeriesCard.css` only if a fixed-height guarantee genuinely needs a
selector you cannot express inline, and justify it in your report.

The fixed size is the design's core promise: give the card a fixed height (or a
fixed min+max) and make the chip row and title clamp rather than reflow.

## 6. Acceptance criteria — each must be a real assertion in `SeriesCard.test.tsx`

1. **Height invariance:** rendering the same card with 4 sessions and with 56
   sessions produces identical structural height inputs — assert the applied
   fixed-height style/class is identical, and that the number of rendered chip
   badges never exceeds the cap regardless of `scheduleChips.length`.
2. **`attendancePct: null` renders `—`** and **never** `0%`.
3. **`attendancePct: 0` renders `0%`** (a real zero is not an em dash).
4. All four DES-12 states reachable and asserted: loading, empty
   (`sessionsTotal === 0`), error, populated.
5. `onSelect` is called with exactly `{ eventId }` when the schedule button is
   activated, and the button label carries `sessionsTotal`.
6. Overlap badge appears for `overlapCount > 0`, is absent for `0`/`undefined`,
   and carries no error/urgency variant.
7. `nextSessionLabel: null` renders the finished copy, not an empty line.
8. `paletteIndex` reaches the DOM as `data-series-palette-index`.
9. Chip strings are rendered verbatim from the model (no re-formatting).
10. Keyboard: the schedule button is a real `<button>` reachable by tab and
    activatable by Enter/Space (item 15 — keyboard failure on a core flow is a
    BLOCKER).

## 7. Verification you must run and report

- `npx tsc --noEmit`
- `npx vitest run src/pages/meetings/coach/SeriesCard.test.tsx`
- `npx eslint src/pages/meetings/coach/SeriesCard.tsx src/pages/meetings/coach/SeriesCard.test.tsx`
- `npx prettier --check` on every file you touched

Report **exit codes**, not prose. Then **name one mutation** the orchestrator
can replay: a single-line change to `SeriesCard.tsx` that must turn a named
test red (the `null → —` branch is the natural candidate). Do not run the
mutation in the shared tree — name it; the orchestrator runs it.

Commit your work with an explicit pathspec (`git add <paths>` — **never**
`git add -A`, item 22) and report the **commit SHA** (item 21).

## 8. Least confident decisions (19d — declared, though STANDARD does not require it)

1. **Capping the chip row at 4 + `+N more`.** Wrong if a real series has five
   weekday rules that a coach must all see at a glance — but height invariance
   is MTG-01a's stated promise and the drill-out carries the detail.
2. **Omitting the Edit affordance entirely (3c)** rather than shipping it wired
   to a prop that does not exist. Wrong if `CoachMeetingsView` already threads
   `onSaveMeetingSeries` somewhere reachable — the orchestrator grepped and
   found it only on `MeetingsListProps`.
3. **Neutral rendering for the series color (3b)** rather than borrowing
   `--color-data-categorical-*`. Wrong if those two tokens were in fact intended
   as the series palette — they are labelled "confirmed hours" / "planned hours"
   in `volt.ts`, which is why this packet says no.
4. **Adding optional `isLoading`/`errorMessage` props** to reach DES-12's four
   states. Wrong if the redesign intends the *parent* to own those states and
   render a skeleton card itself — in which case the four states belong to
   `CoachMeetingsView` and this component should only assert the populated and
   empty shapes.
