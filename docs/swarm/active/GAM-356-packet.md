# GAM-356 task packet — STANDARD — **revision 2**

**Issue:** GAM-356 — the student meetings view labels a student with no
participation rate `Participation: null%` and announces it as 0%.
**Tier:** STANDARD (item 26; defended below against the gate's MINOR-4).
**Worker model:** pinned default (sonnet) — none of item 18's four triggers is
met: no migration, no RLS or `security definer`, no metric-view SQL, no
auth/session/role logic.
**Verified against:** `debe8e4`.

> **Revision 2** answers `checker-premise` round 1 (REVISE — 3 MAJOR, 4 MINOR,
> 2 NIT). Every change below is traceable to a numbered finding. Round 1's most
> valuable result was a **measured refutation** of this packet's own central
> claim; that claim is now corrected rather than defended. Round 2 of the
> two-round cap (item 19a) follows.

## The defect, in one path

`v_student_participation.participation_pct` is SQL `NULL` for a student whose
*recorded* counted meetings were all excused — the view's own
`when count(*) - count(*) filter (where status = 'excused') = 0 then null`
(`supabase/migrations/20260806000000_met01_explicit_marks.sql:124`), whose
column comment says *"the UI renders that as an em dash, never 0%"*.

Loaders declare that column as non-nullable `number`. The `/meetings`
consistency strip is the one surface with no runtime guard, so the `null`
reaches JSX:

1. `src/lib/supabase/loaders/checkin.ts:239` — `participation_pct: number;`.
   **The lie starts here.**
2. `checkin.ts:363-365` — `aggregateParticipationForStudent` returns the single
   season row **verbatim** when `seasonRows.length === 1`, so the
   `Math.max(expectedCt - excusedCt, 1)` floor at `:375` is not reached **in
   that case**. (See the Known Risk — this is a narrower claim than revision 1
   made.)
3. `checkin.ts:291` — `mapParticipationDbRow` renames it, untouched.
4. `src/pages/meetings/StudentMeetingView.tsx:757` —
   ``label={`Participation: ${participation.participationPct}%`}`` interpolates
   `null`, and `value={null}` at `:759` clamps the `ProgressBar` to
   `aria-valuenow="0"` / `aria-valuetext="0%"`. Mechanically confirmed by the
   gate in `@astryxdesign/core`'s own source: `ProgressBar.js:138` defaults only
   on `undefined`, `:159` `Number.isFinite(null)` → `safeValue = 0`.

**Which loader is on this path.** `MeetingsList.tsx:2769` renders
`StudentMeetingView` with no `loadStripData`, so `StudentMeetingView.tsx:1068`'s
default wins: `loadConsistencyStripData` from `loaders/checkin.ts` (imported at
`:317`). `loaders/meetings.ts` is not on this path — its participation now feeds
only `MeetingsList.tsx:2693`'s `isEmpty` test, its own bar having been deleted
by T180. Confirmed by the gate at all three call sites.
*(MINOR-2: revision 1 said "the GAM-345 packet is wrong about it." That is
withdrawn — GAM-345's shipped packet says the same thing this one does; only its
revision 1 was wrong, and it records its own correction.)*

**Reuse the pattern that already exists (item 3).** Two places get this right:
`ParticipationTab.tsx:838-839` (runtime `=== null` → `<Text>{'—'}</Text>`
*instead of* the `ProgressBar`), and `students.ts:758`
(`participation_pct: number | null`, the one already-honest DB row type).

## Known Risk — a second mechanism this task deliberately does not fix

**Round 1 measured this and it refutes revision 1.** The gate ran
`aggregateParticipationForStudent` against two same-season all-excused rows and
got `participation_pct: 0` — so a **dual-team all-excused student** reaches
`checkin.ts:367-376`, hits the `Math.max(expectedCt - excusedCt, 1)` floor, and
is shown a fabricated `Participation: 0%`. That is the same lie GAM-356 is about,
arriving by arithmetic instead of by type. **After this task ships, that student
still sees 0%.**

**It is not folded in here, on the issue author's own stated grounds and with a
row already open.** GAM-356's description says filing this under GAM-300 "would
bury a type-level defect inside an arithmetic one"; folding the arithmetic back
in is that same burial reversed. **GAM-300 is open in `Backlog`** and its title
is *"Two loaders still apply the `greatest(x, 1)` floor T509 removed, and three
row types still declare `participation_pct` non-nullable"* — the floor is
literally its subject. Item 20 is satisfied by an existing triageable row, not by
a comment. The orchestrator adds the gate's measured evidence to GAM-300 as a
comment and cross-links it.

**This Known Risk is stated in the PR body**, per item 26's requirement that a
scope judgement be visible and correctable rather than silent.

*Corollary the worker must respect:* **do not touch `checkin.ts:348-390`'s
arithmetic.** It is GAM-300's, it duplicates a metric formula in TypeScript
(item 3 / PRD DATA-01 territory), and `checkin.test.ts:88-96` is a green test
pinning its current behaviour. Changing it here would reverse passed work
without authorization (Definition of Ready #5).

## Allowed Files

| Path | Why |
| -- | -- |
| `src/lib/supabase/loaders/checkin.ts` | `:239` type only — **not** the arithmetic at `:348-390` |
| `src/lib/supabase/loaders/meetings.ts` | `:302` type only |
| `src/lib/supabase/loaders/reports.ts` | `:221` type only |
| `src/lib/supabase/types.ts` | `:524` — the **fourth** declaration the gate found (MINOR-3), plus its now-false doc at `:507-514` |
| `src/pages/meetings/StudentMeetingView.tsx` | render site `:757`, own metric type `:362` |
| `src/pages/meetings/MeetingsList.tsx` | own metric type `:790` — ripple only |
| `src/pages/reports/ParticipationTab.tsx` | own row type `:363` — ripple only |
| `src/pages/meetings/StudentMeetingView.test.tsx` | new unit coverage |
| `tests/e2e-personas/reports-accounting.spec.ts` | leg 3, per that file's own written instruction |

**Forbidden:** everything else — `supabase/migrations/**` (the SQL is already
correct), `src/lib/supabase/loaders/students.ts`, `src/pages/home/**`,
`src/lib/supabase/loaders/checkin.test.ts`, `.claude/**`, `docs/swarm/**`,
`.github/workflows/**`.

## Prescription

1. **Widen the column type to `number | null`** at `checkin.ts:239`,
   `meetings.ts:302`, `reports.ts:221`, and `types.ts:524`. **Never coalesce**
   — no `?? 0`, no `|| 0`, no `Number(...)`. A coalesce fabricates exactly the
   0% the em dash exists to avoid.

2. **Correct the false doc comment at `types.ts:507-514`** (MINOR-3), which
   still asserts that no row type is nullable and that the case "is represented
   by the ROW BEING ABSENT entirely". MET-01 made that false. Say instead that
   the column is `NULL` when no counted meeting remains after excusals, and
   point at the migration's `:124`.

3. **Follow the ripple with `tsc`, not grep.** Round 1 ran this: the complete
   set is `checkin.ts:507`, `meetings.ts:955`, `reports.ts:290`, closed by
   widening `StudentMeetingView.tsx:362`, `MeetingsList.tsx:790`,
   `ParticipationTab.tsx:363`; then one residual,
   `StudentMeetingView.tsx(759,13) TS2322: Type 'number | null' is not
   assignable to type 'number | undefined'`, closed by step 4. **Nothing else in
   the repo.** `types.ts:524` was not in that set — if widening it surfaces an
   error outside Allowed Files, **stop and report rather than widening scope.**

4. **Add a second guard at `StudentMeetingView.tsx:751-761` — alongside the
   existing one, not merged into it.** Round 1 confirmed the two no-rate causes
   are genuinely different and that merging would state something false:

   - `participation === null` (already there, `:751`) — no view row at all.
     Copy `— (no completed meetings recorded yet this season)` is correct and
     stays **verbatim**.
   - `participation.participationPct === null` (**new**) — a real row, real
     counts, no denominator. Render instead of the `ProgressBar`:

     ```tsx
     <Text type="supporting" color="secondary">
       {'—'} (no participation rate yet)
     </Text>
     ```

   **MAJOR-2: revision 1's copy is withdrawn.** It read "every meeting so far was
   excused, so there is no rate yet", which round 1 showed is *not* true by
   construction: `met01:95-100` documents that unmarked completed sessions are
   excluded from the view entirely, so a student with five unmarked meetings and
   one excused one would be told *every* meeting was excused. The replacement
   claims only that there is no rate — which is exactly what `NULL` means, under
   every cause, and needs no owner copy approval. Graded against PRD DES-14/16:
   sentence case, no fabricated value, no invented state.

   The load-bearing requirement is that **no `ProgressBar` is rendered at all**
   in this branch. Rendering one at any value *is* the fabricated zero.

5. **Unit coverage** in `StudentMeetingView.test.tsx`. **MAJOR-3: use this
   repo's own idiom — `container.querySelectorAll('[role="progressbar"]')`.**
   There is no `@testing-library/*` in `package.json` and item 9 forbids adding
   one; `StudentMeetingView.test.tsx:86-90` renders through a hand-rolled
   `createRoot` helper. In-repo precedent: `CoachHome.test.tsx:1735`,
   `ParentHome.test.tsx:644-647,768`. **Add no test dependency.**

   - `participationPct: null` → **zero** `[role="progressbar"]` elements, and the
     em-dash text is present.
   - `participationPct: 0` → **exactly one** `[role="progressbar"]`, with
     `aria-valuetext === '0%'` and its label text `Participation: 0%`. Assert via
     `aria-valuetext` and the labelled span, **not** `toHaveAccessibleName` —
     `isLabelHidden` routes the label through a `VisuallyHidden` span linked by
     `aria-labelledby` (`ProgressBar.js:205-212`), and jsdom computes no
     accessible name. This test is **not optional**: it is what stops the fix
     from turning a genuine zero into a no-rate.

6. **Flip e2e leg 3** exactly as `tests/e2e-personas/reports-accounting.spec.ts:544-553`
   instructs. **NIT-1:** that comment says "the two assertions below" but there
   are **three** defect-pinning assertions — `:545` (visible), `:548`
   (`aria-valuenow`), `:549` (`aria-valuetext`). All three are replaced by the
   comment's two em-dash assertions. **Do not delete them.** **NIT-2:** scope the
   text match — `page.getByText('Participation: —')` following leg 2's precedent
   at `:501`, never a bare `getByText('—')`, which is a substring match and would
   trip Playwright strict mode. Rewrite the "WHEN THIS IS FIXED" block into a
   past-tense record, keeping the mechanism notes and adding the Known Risk
   above.

   **MINOR-1, disclosed rather than closed: this edit ships unrun.**
   `tsconfig.json` includes only `["src", "vite.config.ts"]`, `vite.config.ts`
   excludes `tests/e2e-personas/**` from vitest, and the six gates contain no
   Playwright run — so the edit is neither typechecked nor executed by A6.
   Running it needs a live Postgres + harness, which is out of this task's
   scope. **This is why A1-A3's unit coverage is the real regression guard and
   the e2e flip is bookkeeping on top of it.** Stated here so nobody mistakes a
   green A6 for evidence that leg 3 passes.

## Acceptance criteria

| # | Criterion | How it is measured |
| -- | -- | -- |
| A1 | No `ProgressBar` is rendered for a `null` `participationPct` | unit test: `container.querySelectorAll('[role="progressbar"]')` has length 0 |
| A2 | The em dash and `(no participation rate yet)` render instead | unit test asserts the text |
| A3 | A genuine `0` still renders exactly one `ProgressBar`, `aria-valuetext="0%"` | unit test — the anti-overcorrection guard |
| A4 | No `?? 0`, `\|\| 0`, or `Number(...)` coalescing introduced on any participation path, and `checkin.ts:348-390` is untouched | orchestrator reads the diff |
| A5 | The strip still reads from the real loader, not a fixture (item 27) | `StudentMeetingView.tsx:1068`'s default remains `loadConsistencyStripDataFromSupabase`; the diff must not touch it |
| A6 | All six gates green | `/gate-run` |

A5 is stated because item 27 requires a user-visible surface's packet to name
the real source it reads from, so the check is on the *connection*. Round 1
graded A5 "measurable but weak" and it is kept on those terms: it proves the
wiring, and the null case reaching a screen from real data is only provable by
leg 3, which A6 does not run (MINOR-1).

## Mutation the orchestrator will replay (item 26, STANDARD)

Commit the fix first (item 26's fast-tier working rule: commit before mutating).
Then, **in an isolated worktree** (item 23), revert **only** step 4's
`participationPct === null` branch, leaving the widened types in place, so the
measurement is of the guard and not of the compiler. Confirm A1/A2 go **red**
with real captured output. Restore, confirm green. Round 1 notes `tsc` also
fails while reverted — that is expected and is not the signal being measured.

## Tier defence (gate MINOR-4)

Round 1 asked whether item 26's HEAVY trigger *"an export another session builds
against"* fires, since `StudentParticipationMetric` is imported across modules.
**It does not, and round 1's own measurement is the argument.** That trigger is
about a contract leaving this commit's verification boundary — something a
*different* session builds against later, which no gate here can check. This
ripple never leaves the commit: `tsc` names every consumer atomically, and the
gate proved the set is closed and small (four errors, then zero). Nothing is
exported to another session; there is no write path, no RLS, no migration, no
metric-view SQL. The tie-break in item 26 applies to *arguable* tiers, and FAST
vs STANDARD was the live tie — resolved to STANDARD. Recorded here so a wrong
call is visible and correctable.

## Least confident decisions

Not required at STANDARD (item 19d binds HEAVY); kept because round 1's most
valuable finding came from attacking this list.

1. **Excluding the dual-team floor (the Known Risk).** What would make it wrong:
   if dual-team membership is common on this team, then most all-excused
   students still see 0% and GAM-356 ships without fixing the symptom it names.
   The orchestrator cannot measure that prevalence from the repo.
2. **The copy `(no participation rate yet)`.** What would make it wrong: an
   owner who wants the *reason* on screen, not just the absence — round 1 killed
   the reason-giving version as not true by construction, so the honest options
   are this one or a bare em dash.
3. **Widening `types.ts:524` inside this task rather than leaving it to GAM-300**,
   whose title claims three row types. What would make it wrong: a ripple outside
   Allowed Files, which step 3 handles by stopping rather than expanding.
4. **Trusting round 1's tsc closure.** What would make it wrong: a consumer
   reached only through `any`, an assertion, or a Supabase generated type that
   `tsc` cannot see — which would fail silently at runtime rather than loudly at
   build.
