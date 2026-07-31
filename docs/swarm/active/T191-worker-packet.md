# Worker Packet: T191

## Task ID
T191

## Objective
On `ParentHome`'s per-student card (`StudentHomeCard` in
`src/pages/home/ParentHome.tsx`), when the linked student is not currently
active (`isActive === false`), stop rendering the numeric "Hours vs. goal"
`ProgressBar` — which today always renders, and for an inactive student
fabricates `0 / 1 h (0%)`, where the `1` is a UI clamp artifact
(`max={goalHours > 0 ? goalHours : 1}`) that exists in no data source. Replace
just that one card section with an honest, non-numeric absence marker. No
loader change, no new SQL, no migration. An active student's card is
completely unaffected.

## Scope ruling (read before starting)
**Owner ruling, verbatim** (`docs/swarm/auto-mode-decisions.md`, "2026-07-31 —
George's ruling on T191's display strategy"): presented with "season default
number" (opus tier, needs a new SQL view) vs. "no bar at all" (sonnet tier, no
new SQL, extends an already-proven honest-absence pattern), **he selected "No
bar at all."** That entry's own "What this authorizes" line: *"a
`T191-worker-packet.md` scoped to replacing the numeric hours-vs-goal bar with
an honest non-numeric state when a card's linked student isn't active, no new
SQL, sonnet tier."* This packet is exactly that scope — nothing more.

**Explicitly out of scope, split into its own row:** the `confirmedHours`
half of the original finding (a deactivated student's real historical hours
sit in `v_student_hours` with no `is_active` filter, but are invisible
through `v_student_goal_projection`, which does filter `where s.is_active`)
is tracked separately as **T201** (`docs/swarm/task-ledger.md`, currently the
ledger's highest-numbered row — re-confirm this is still true before you
finish, in case another task landed a higher number while you worked) and is
**unaffected by which display option was chosen.** Do not touch
`src/lib/supabase/loaders/parentHome.ts`'s `goalHours`/`confirmedHours`
computation for this task — the fix is a pure render-branch change in
`ParentHome.tsx`.

**Explicitly not a green light to copy `StudentHome.tsx`'s T184 three-way
union.** `StudentHomeCardProps.isActive`'s own doc comment
(`ParentHome.tsx:1150-1157`) already reasons through why: *"a parent viewing
a deactivated child's card is an unaffected observer, not a blocked actor...
not `StudentHome.tsx`'s own T184 three-way union (that union is about a
deactivated STUDENT signing in as herself, a genuinely different
situation)."* T184's fix swaps the ENTIRE page for one of three states. This
task swaps only the "Hours vs. goal" section of one card — the badge, the
team name, "Next up", and `ConsistencyStrip` all keep rendering exactly as
they do today, for both active and inactive students.

## Allowed Files
- `src/pages/home/ParentHome.tsx` — exactly these edits, nothing else:
  1. The "Hours vs. goal" render block, currently lines 1244-1254 (the
     `<VStack gap={1}>` containing the `Text` label and the `ProgressBar`),
     changed to conditionally render the `ProgressBar` only when `isActive`
     is true, and an honest absence marker otherwise. See "Design" below for
     the exact shape to mirror.
  2. One new named constant near the existing `INACTIVE_STUDENT_MARKER_LABEL`
     (currently line 1103), holding the absence marker's copy, with a doc
     comment in the same style as that constant's own (lines 1099-1102) —
     citing constitution item 17 (no loss-aversion/guilt framing, states a
     fact).
  3. `LinkedStudentRow.isActive`'s doc comment (currently lines 417-419) —
     one-line addition: it now also drives the Hours-vs.-goal section's
     display branch, not only the card marker. Do not reword the rest.
  4. `StudentHomeCardProps.isActive`'s doc comment (currently lines
     1150-1157) — its closing sentence ("The card, and its honest-absence
     figures, still render") is corrected: after this task, the hours figures
     for an inactive student are no longer numeric at all; they render as an
     honest absence marker instead of a fabricated number. State this
     plainly; do not delete the rest of the comment, which remains accurate.
  Nothing else in this file changes. `goalHours`/`hoursPercent`
  (currently computed unconditionally at lines 1226-1227) are NOT restructured
  — see "Design" below for why leaving them as-is is the correct, simplest
  choice.
- `src/pages/home/ParentHome.test.tsx` — the `describe('<ParentHome /> C4:
  a deactivated linked student's card is honest and present', ...)` block
  (currently lines 676-745, both `it(...)` blocks inside it) rewritten per
  "The test that must change on purpose" below. Nothing else in this file
  changes.

## Forbidden Files
- `src/lib/supabase/loaders/parentHome.ts`, `parentHome.test.ts` — no loader
  change; George's ruling is explicit that this needs no new SQL.
- `src/pages/home/StudentHome.tsx`, `StudentHome.test.tsx` — read-only
  reference for the `{kind:'inactive'}` union you are explicitly NOT
  replicating; the fix here is a narrower, section-level branch, not a
  page-level state union.
- `src/pages/home/CoachHome.tsx`, `CoachHome.test.tsx` — unrelated file,
  T173's own work landed there this session; stay out of it entirely.
- `src/pages/home/DashboardPage.tsx`, `DashboardPage.test.tsx` — its
  `ParentHome` mock (`DashboardPage.test.tsx:102-112`) fixture student is
  `isActive: true`, so it is unaffected by this change; keep it that way by
  not touching the file.
- `src/pages/meetings/StudentMeetingView.tsx`, `StudentMeetingView.test.tsx`
  — read-only reference for the `ConsistencyStrip` precedent this design
  mirrors; do not edit.
- `supabase/migrations/**` — no migration, per the owner's ruling.
- `docs/swarm/constitution.md`, `docs/swarm/task-ledger.md`,
  `docs/swarm/verification-log.md`, `docs/swarm/dispute-log.md`, `.claude/`.

## Context you need (re-verified against the current worktree this session —
cite these line numbers, not any other source, if you quote anything back)

**The fabricated artifact and its cause.**
`ParentHome.tsx:1250`: `max={goalHours > 0 ? goalHours : 1}` — a UI clamp
existing so `ProgressBar`'s `max` prop is never zero (which would make the
bar's percent math divide by zero), not a real value from any data source.
Combined with `parentHome.ts:482-483`'s `goalHours: scope?.goalHours ?? 0` /
`confirmedHours: scope?.confirmedHours ?? 0` (the loader's own honest
zero-fallback when `resolveStudentScope` returns `null` for a deactivated
student — this part is correct and unchanged by this task), an inactive
student's card renders `aria-valuetext="0 / 1 h (0%)"` today — confirmed
still present verbatim in both files, unmoved since the ledger row was
written.

**Where `isActive` already is, and isn't threaded further.**
`StudentHomeCardProps` (`ParentHome.tsx:1145-1160`) already declares
`isActive: boolean` as a required prop; `StudentHomeCard`
(`ParentHome.tsx:1162-1169`) already destructures it; the existing
`INACTIVE_STUDENT_MARKER_LABEL` badge already consumes it at line 1240,
inside the SAME component, in the SAME returned JSX tree as the
"Hours vs. goal" block six lines later (1244-1254). No new threading is
needed — `isActive` is already in scope exactly where the `ProgressBar`
renders. The call site already passes the real column value:
`ParentHome.tsx:1384`, `isActive={student.isActive}`, sourced from
`mapStudentDbRow` (`parentHome.ts:260-265`), `isActive: row.is_active` — the
real `students.is_active` column, not a placeholder.

**The precedent to mirror — already proven, already in this exact card, one
section below.** `ConsistencyStrip` (`src/pages/meetings/
StudentMeetingView.tsx:698-751`, already-Passed, T037/read-only reference) is
reused directly inside this same `StudentHomeCard`
(`ParentHome.tsx:1256`: `<ConsistencyStrip entries={data.consistencyEntries}
participation={data.participation} />`). Its own participation sub-widget
(`StudentMeetingView.tsx:735-748`) is the section-level "one metric inside a
card, replaced with an honest absence marker" pattern this task needs:
```
<VStack gap={1}>
  <Text type="label">Participation</Text>
  {participation === null ? (
    <Text type="supporting" color="secondary">
      {'—'} (no completed meetings recorded yet this season)
    </Text>
  ) : (
    <ProgressBar
      label={`Participation: ${participation.participationPct}%`}
      isLabelHidden
      value={participation.participationPct}
      hasValueLabel
    />
  )}
</VStack>
```
Same label-stays/bar-swaps-for-text shape, same `Text type="supporting"
color="secondary"` treatment (this exact prop pair is also already used
elsewhere in `ParentHome.tsx` itself, line 1391, for the footer digest note
— a verified-safe combination in this file, not borrowed sight-unseen from
another component). This is a stronger precedent than a "similar pattern
elsewhere" — it is the literal next section of the same rendered card
already doing this. Use it, not `StudentHome.tsx`'s page-level union.

**Why `goalHours`/`hoursPercent` stay computed unconditionally (the simplest
correct option).** `ParentHome.tsx:1226-1227`:
```
const goalHours = data.goalHours;
const hoursPercent = hoursVsGoalPercent(data.confirmedHours, goalHours);
```
Both are pure, side-effect-free reads/calculations that already run before
today's unconditional `ProgressBar` render. Restructuring them to be
conditional on `isActive` would require either duplicating the `isActive`
check or hoisting new branching logic for no behavioral benefit — the
values are simply unused in JSX when the branch renders the absence marker
instead. Leave both lines exactly as-is; only the JSX consuming them changes.
This keeps the diff to the render block plus the two doc-comment
corrections and one new constant — nothing else moves.

## Design
1. **Trigger:** `!isActive`, the same flag already driving the adjacent
   "Not currently active" badge (`ParentHome.tsx:1240`). No new prop, no new
   state, no threading.
2. **New constant**, placed near `INACTIVE_STUDENT_MARKER_LABEL`
   (line 1103), in the same doc-comment style:
   ```
   /** T191 (owner ruling: "No bar at all",
    * `docs/swarm/auto-mode-decisions.md` 2026-07-31) -- factual-only copy
    * for a deactivated linked student's Hours-vs.-goal section, replacing
    * the numeric bar. Mirrors `ConsistencyStrip`'s own
    * `participation === null` branch (`StudentMeetingView.tsx:737-740`) --
    * an em dash plus a short factual parenthetical, never a fabricated
    * number (constitution item 17). */
   const INACTIVE_STUDENT_HOURS_MARKER =
     "hours vs. goal isn't shown for an inactive student";
   ```
   This exact wording is chosen deliberately distinct from the badge's own
   `'Not currently active'` string (case AND wording both differ) so a test
   asserting one can never accidentally match the other — do not reuse the
   badge's exact phrase here.
3. **The render change**, replacing lines 1244-1254:
   ```
   <VStack gap={1}>
     <Text type="label">Hours vs. goal</Text>
     {!isActive ? (
       <Text type="supporting" color="secondary">
         {'—'} ({INACTIVE_STUDENT_HOURS_MARKER})
       </Text>
     ) : (
       <ProgressBar
         label={`${displayName}'s hours vs. goal`}
         isLabelHidden
         value={data.confirmedHours}
         max={goalHours > 0 ? goalHours : 1}
         hasValueLabel
         formatValueLabel={(value, max) => `${value} / ${max} h (${hoursPercent}%)`}
       />
     )}
   </VStack>
   ```
   Branch order (`!isActive` first) matches `ConsistencyStrip`'s own
   `participation === null ? ... : ...` ordering. The active-student branch
   is otherwise byte-identical to what exists today — no active-student
   render output changes.
4. **What happens to `goalHours`/`confirmedHours`:** they are still computed
   exactly as today (see "Context" above) — only whether the `ProgressBar`
   consuming them renders is now conditional. No fabricated value is deleted
   from data; the numeric fabrication was always in the JSX render, not the
   data, and this fix corrects the render.

## The test that must change on purpose, not by accident
`ParentHome.test.tsx:676-745`, `describe('<ParentHome /> C4: a deactivated
linked student's card is honest and present', ...)`, contains the two tests
that currently assert and prove today's fabricated behavior — re-verified
still present verbatim this session:
- Line 713: `expect(progressBar!.getAttribute('aria-valuetext')).toBe('0 / 1
  h (0%)')` (single-inactive-student test).
- Line 737: `expect(valueTexts).toContain('0 / 1 h (0%)')` (mixed
  active+inactive siblings test).

Both must be **deliberately rewritten**, not left to go silently stale — with
this fix, the inactive card renders zero `[role="progressbar"]` elements, so
`progressBar!.getAttribute(...)` on line 713 would throw on a `null` element
if left as-is (a loud failure, not a silent one, but still the wrong
assertion for what this task ships). Rewrite both, keeping every other
assertion in the block (student name, team badge, "Nothing scheduled", "Not
currently active" marker count) exactly as it is today:

**Test 1** (currently titled "renders exactly one card, the factual 'Not
currently active' marker, and honest clamped-zero figures" — retitle to
reflect the new behavior, e.g. "...and an honest non-numeric hours state"):
- Change `expect(container.querySelectorAll('[role="progressbar"]')).
  toHaveLength(1)` to `toHaveLength(0)` — the sole card is inactive, so no
  progressbar renders at all.
- Remove the `aria-valuetext` assertion (line 713); there is no
  `[role="progressbar"]` left to query.
- Add a positive assertion that `container.textContent` contains
  `INACTIVE_STUDENT_HOURS_MARKER`'s exact text (import or inline the
  literal string — your call, matching this file's existing convention for
  asserting against `INACTIVE_STUDENT_MARKER_LABEL`'s text elsewhere in this
  same file).
- Add a direct regression guard: `expect(container.textContent).not.
  toContain('0 / 1 h')` — the literal fabricated string this task removes.
- Keep: exactly one card, `'Marisol Tan'`, `'Delta Drift'`, not
  `'No linked students yet'`, `'Nothing scheduled'`, `'Not currently
  active'`.

**Test 2** (the anti-leak/positive-control test, "a sibling active student's
real, non-zero figures never leak onto the deactivated card"):
- `valueTexts` (the array of `[role="progressbar"]` `aria-valuetext`s) now
  has length **1**, not 2 — only `ACTIVE_STUDENT`'s card renders a bar.
  Change `expect(valueTexts).toHaveLength(2)` to `toHaveLength(1)`.
- Remove `expect(valueTexts).toContain('0 / 1 h (0%)')` (line 737) — there
  is no longer a progressbar to produce that string.
- Keep `expect(valueTexts).toContain('77 / 120 h (64.2%)')` unchanged —
  this is the positive control proving the active sibling's real figures
  still render correctly and are unaffected by this task.
- Add: `expect(container.textContent).toContain(INACTIVE_STUDENT_HOURS_
  MARKER)` (the inactive card's new marker renders) **and** a check that it
  appears exactly once — mirroring this same test's existing
  `expect(container.textContent?.split('Not currently active').length).
  toBe(2)` idiom (i.e. `.split(INACTIVE_STUDENT_HOURS_MARKER).length` should
  be `2`) — proving the marker does not leak onto the active student's card.
- Keep the existing `'Not currently active'` badge assertions unchanged.

**Mutation proof required before you report this done:** temporarily revert
your JSX change (force the `ProgressBar` branch to render unconditionally,
e.g. hardcode `isActive ? ... : ...` back to always-true) and confirm both
rewritten tests fail — specifically that the `toHaveLength(0)`/
`toHaveLength(1)` assertions and the marker-text assertions genuinely
distinguish the fix from its absence, not just that the suite goes red for
an unrelated reason. Restore your real fix afterward and confirm both pass
again. Report both runs' output.

## Acceptance Criteria
1. `ParentHome.tsx`'s "Hours vs. goal" section renders `[role="progressbar"]`
   for a card if and only if that card's `isActive` is `true`. Zero
   progressbars for an inactive-only render; exactly one progressbar per
   active card in a mixed render.
2. For an inactive card, the section instead renders `INACTIVE_STUDENT_
   HOURS_MARKER`'s exact text (an em dash plus a short factual
   parenthetical), never a number, never the string `'0 / 1 h'` or any
   variant of it.
3. An active card's rendered output for this section is byte-identical to
   today's — same `ProgressBar` props, same `aria-valuetext` format. Prove
   this with the existing C3 test (`ParentHome.tsx` "goalHours is a verbatim
   passthrough" describe block, currently lines 639-673) passing unmodified.
4. `goalHours`/`hoursPercent` (`ParentHome.tsx:1226-1227`) are byte-identical
   before/after — diff those two lines directly and confirm zero change.
   `parentHome.ts` and `parentHome.test.ts` have zero diff.
5. The C4 test block (`ParentHome.test.tsx:676-745`) is rewritten per "The
   test that must change on purpose" above, both tests passing, both proven
   by mutation to genuinely discriminate the fix from its absence (report
   the mutation run's failure output, not just the final green run).
6. Every other test in `ParentHome.test.tsx` passes unmodified — report a
   full-file before/after test count and confirm the delta is exactly the
   C4 block's content (same number of `it(...)` blocks, same titles except
   C4's first test's retitling).
7. `LinkedStudentRow.isActive`'s doc comment (`ParentHome.tsx:417-419`) and
   `StudentHomeCardProps.isActive`'s doc comment (`ParentHome.tsx:1150-1157`)
   are corrected per Allowed Files items 3-4 above. Diff both and confirm no
   other sentence in either comment changed.
8. Full repo test suite: report before/after counts. Zero newly-failing
   tests anywhere outside `ParentHome.test.tsx`'s deliberately-rewritten C4
   block.
9. `tsc`, eslint, and prettier clean (or unchanged from current baseline,
   with any delta explained).
10. Zero diff on every Forbidden file, including `parentHome.ts`,
    `StudentHome.tsx`, `CoachHome.tsx`, `DashboardPage.tsx`/`.test.tsx`, and
    everything under `supabase/migrations/`.
11. Before finishing, re-check `docs/swarm/task-ledger.md`'s highest task
    number. If it is no longer T201 (i.e. a task numbered higher has landed
    since this packet was written), note that in your Required Worker Output
    rather than silently assuming T201 is still the max — do not renumber
    anything yourself.

## Relevant Constitution Excerpt
- Non-Negotiables: "Existing tests must pass unless the boss explicitly
  approves a test update." (This packet pre-authorizes the two named C4
  edits — they are necessary consequences of George's own ruling that the
  numeric bar this test documents must stop rendering, the same reasoning
  already applied to the `CoachHome.test.tsx:1194-1196` amendment and to
  T183's criterion-6/7 test updates. Every other test in the file, and in
  the repo, must remain green AND unedited.)
- Item 3: no re-deriving RLS/metric SQL, no duplicating a metric formula in
  TypeScript. Not implicated — this task adds no metric math; `goalHours`/
  `hoursPercent` stay exactly as they are computed today (Acceptance
  Criterion 4).
- Item 12 (DES-12, PRD): "Every async screen ships all four states —
  loading, empty, error, populated. Happy-path-only → MAJOR." This task adds
  a fifth, section-level honest-absence variant of the populated state for
  one card widget, consistent with — not a violation of — this item; it does
  not touch the card's own loading/error/empty states, which are unaffected.
- Item 17: "Motivation mechanics are limited to honest progress signals...
  Loss-aversion framing, streak pressure, FOMO/scarcity, countdowns, guilt
  copy... are prohibited → BLOCKER." `INACTIVE_STUDENT_HOURS_MARKER`'s
  wording must state a fact plainly, matching `INACTIVE_STUDENT_MARKER_
  LABEL`'s own existing tone — do not soften, apologize, or add any framing
  beyond the literal fact.
- Item 18: sonnet tier is correct. This task creates/edits no file under
  `supabase/migrations/`, no RLS policy, no metric-math SQL view, and no
  auth/session/role/permission logic — none of the four opus triggers apply.
- Item 19b: "Light check or skip for packets that roll out an
  already-verified pattern to a new surface." This packet rolls out
  `ConsistencyStrip`'s own already-Passed `participation === null` branch
  pattern to a second metric in the same card — a light `checker-premise`
  pass is appropriate, not a full novel-pattern review.
- Item 19c: "Verify your own citations before submitting." Every line number
  and quoted string in this packet was re-read against the current worktree
  this session, not inherited from the ledger row — do the same before you
  rely on any of them; they may have drifted further by the time you start.
- Item 20: any deliberate deferral you notice beyond this packet's own scope
  must be reported in your output so it can be filed as a ledger row — do
  not leave it only in a code comment.
- Item 25 (proportionality): this is a small-team app; keep the fix to
  exactly what's described above. Do not add a tooltip, an icon, a link to
  documentation, or any other embellishment beyond the em-dash-plus-text
  pattern already established.

## Required Worker Output
- Files changed (exact list — expect exactly two: `ParentHome.tsx`,
  `ParentHome.test.tsx`).
- Confirmation of the render-block diff, the new constant, and both
  doc-comment corrections (a `git diff` excerpt or equivalent for each).
- The mutation-proof run required in "The test that must change on purpose"
  above: both the failing (reverted) and passing (real fix) output for the
  rewritten C4 tests.
- Full `ParentHome.test.tsx` before/after test counts, and full repo suite
  before/after counts.
- `tsc`/eslint/prettier output compared against current baseline.
- Confirmation of the current highest ledger task number (Acceptance
  Criterion 11).
- Known risks, and whether a dispute is needed (e.g. if you disagree with
  the marker wording, the branch ordering, or conclude the C4 test rewrite
  needs a different shape than prescribed).

## Most Recent Failure
None — this is this packet's first revision, not yet run through
`checker-premise`.
