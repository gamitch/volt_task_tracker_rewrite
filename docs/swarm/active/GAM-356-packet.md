# GAM-356 task packet — STANDARD

**Issue:** GAM-356 — the student meetings view labels a student with no
participation rate `Participation: null%` and announces it as 0%.
**Tier:** STANDARD (item 26). **Worker model:** pinned default (sonnet) — none
of item 18's four triggers is met: no migration, no RLS or `security definer`,
no metric-view SQL, no auth/session/role logic. This is a read-path type and
display fix.
**Verified against:** `debe8e4` (branch base). Every line number below was
re-read on this branch, not copied from the issue (item 19c).

## The defect, in one path

`v_student_participation.participation_pct` is SQL `NULL` for a student whose
counted meetings were all excused — the view's own
`when count(*) - count(*) filter (where status = 'excused') = 0 then null`
(`supabase/migrations/20260806000000_met01_explicit_marks.sql:124`), whose
column comment says *"the UI renders that as an em dash, never 0%"*.

Three loaders declare that column as non-nullable `number`. The `/meetings`
consistency strip is the one surface with no runtime guard, so the `null`
reaches JSX:

1. `src/lib/supabase/loaders/checkin.ts:239` — `participation_pct: number;` on
   `ParticipationDbRow`. **The lie starts here.**
2. `checkin.ts:363-365` — `aggregateParticipationForStudent` returns the single
   season row **verbatim** when `seasonRows.length === 1`, so GAM-300's
   `Math.max(expectedCt - excusedCt, 1)` floor at `checkin.ts:375` is *never
   reached on this path*. (This is why GAM-356 is a different defect from
   GAM-300 and must not be folded into it.)
3. `checkin.ts:291` — `mapParticipationDbRow` renames it to `participationPct`,
   untouched.
4. `src/pages/meetings/StudentMeetingView.tsx:757` —
   ``label={`Participation: ${participation.participationPct}%`}`` interpolates
   `null` into the accessible name, and `value={null}` at `:759` clamps the
   `ProgressBar` to `aria-valuenow="0"` / `aria-valuetext="0%"`.

**Which loader is on this path — settled, and the GAM-345 packet is wrong about
it.** `MeetingsList.tsx:2769` renders `StudentMeetingView` with no
`loadStripData`, so `StudentMeetingView.tsx:1068`'s default wins:
`loadConsistencyStripData` from `loaders/checkin.ts` (imported at `:317`).
`loaders/meetings.ts` feeds a different consumer. Established by mutation in
both directions by the filing run, and re-confirmed here by reading the import.

**The correct pattern already exists in this repo — reuse it, do not invent a
second one (item 3).** Two places get this right:

- `src/pages/reports/ParticipationTab.tsx:838-839` — a runtime `=== null` check
  that renders `<Text color="secondary">{'—'}</Text>` **instead of** the
  `ProgressBar`. Its display row type `:386` is already `number | null`.
- `src/lib/supabase/loaders/students.ts:758` — `participation_pct: number | null`,
  the one DB row type in the codebase that is already honest.

## Allowed Files

| Path | Why |
| -- | -- |
| `src/lib/supabase/loaders/checkin.ts` | the mistyped column on the live path |
| `src/lib/supabase/loaders/meetings.ts` | identical mistyping, `:302` |
| `src/lib/supabase/loaders/reports.ts` | identical mistyping, `:221` |
| `src/pages/meetings/StudentMeetingView.tsx` | the render site `:757` and its own `StudentParticipationMetric` `:362` |
| `src/pages/meetings/MeetingsList.tsx` | its own `StudentParticipationMetric` `:790` — type ripple only |
| `src/pages/reports/ParticipationTab.tsx` | its own `ParticipationMetricRow` `:363` — type ripple only |
| `src/pages/meetings/StudentMeetingView.test.tsx` | the new unit coverage |
| `tests/e2e-personas/reports-accounting.spec.ts` | flip leg 3, per that file's own written instruction |

**Forbidden:** everything else. Specifically `supabase/migrations/**` (the SQL
is already correct), `src/pages/home/StudentHome.tsx`,
`src/lib/supabase/loaders/students.ts`, `.claude/**`, `docs/swarm/**`,
`.github/workflows/**`.

## Prescription

1. **Widen the column type in all three loaders** to `number | null`:
   `checkin.ts:239`, `meetings.ts:302`, `reports.ts:221`. Do **not** coalesce
   to `0` anywhere — `?? 0` fabricates exactly the 0% the em dash exists to
   avoid, and is GAM-300's mistake in a new place.

2. **Follow the type ripple with `tsc`, not with grep.** Widening `checkin.ts:239`
   makes `checkin.ts:507`'s call into `buildConsistencyStripData` fail until
   `StudentMeetingView.tsx:362` widens too; the other two loaders push into
   `MeetingsList.tsx:790` and `ParticipationTab.tsx:363`. Widen exactly what the
   compiler names and nothing more. Note `checkin.ts:376`'s computed
   `participationPct` stays `number` and remains assignable — leave the
   multi-row aggregate arithmetic alone.

3. **Add the guard at `StudentMeetingView.tsx:751-761`, alongside the existing
   one — not merged into it.** There are two distinct no-rate causes and they
   must not share copy:

   - `participation === null` (already present, `:751`) — the student has **no
     row in the view at all**. Existing copy
     `— (no completed meetings recorded yet this season)` is correct and stays
     verbatim.
   - `participation.participationPct === null` (**new**) — the student has a
     row, with real counts, but no denominator. Render, in place of the
     `ProgressBar`:

     ```tsx
     <Text type="supporting" color="secondary">
       {'—'} (every meeting so far was excused, so there is no rate yet)
     </Text>
     ```

   The load-bearing part is that **no `ProgressBar` is rendered at all** in this
   branch — that is what `ParticipationTab.tsx:838` does, and rendering a bar at
   any value would itself be the fabricated zero.

4. **Unit coverage** in `StudentMeetingView.test.tsx`, both directions:
   - a metric with `participationPct: null` renders no `progressbar` role and
     renders the em dash;
   - a metric with `participationPct: 0` **still renders a `ProgressBar`** whose
     accessible name is `Participation: 0%`. This second test is not optional —
     it is what stops the fix from turning a genuine zero into a no-rate, which
     is the mirror defect the e2e AC4 block already guards at a higher level.

5. **Flip e2e leg 3**, exactly as `tests/e2e-personas/reports-accounting.spec.ts:544-553`
   instructs in its own comment: replace the two defect-pinning assertions with
   the em-dash form, and **do not delete them**. Rewrite the "WHEN THIS IS FIXED"
   comment block into a past-tense record of what was fixed, keeping the
   mechanism notes.

## Acceptance criteria

| # | Criterion | How it is measured |
| -- | -- | -- |
| A1 | No `ProgressBar` is rendered for a `null` `participationPct` on the strip | new unit test asserts `queryAllByRole('progressbar')` is empty |
| A2 | The em dash and its copy render instead | new unit test asserts the text |
| A3 | A genuine `0` still renders a `ProgressBar` named `Participation: 0%` | new unit test — the anti-overcorrection guard |
| A4 | No `?? 0`, `\|\| 0`, or `Number(...)` coalescing was introduced on any participation path | orchestrator reads the diff |
| A5 | The strip's data still reaches the screen from the real loader, not a fixture (item 27) | `StudentMeetingView.tsx:1068`'s default remains `loadConsistencyStripDataFromSupabase`; the diff must not touch that default |
| A6 | All six gates green | `/gate-run` |

**A5 is stated because item 27 requires it**: this surface is user-visible, so
the packet names the real source it reads from and the check is on the
*connection*, not the render.

## Mutation the orchestrator will replay (item 26, STANDARD)

Commit the fix first. Then revert **only** the `=== null` branch at
`StudentMeetingView.tsx` (leave the widened types in place, so this measures the
guard and not the compiler) and confirm the A1/A2 tests go **red**, with the
real output captured. Restore and confirm green.

## Least confident decisions

Not required at STANDARD (item 19d binds HEAVY packets), recorded anyway because
these are where this packet is most likely to be wrong:

1. **The new copy at step 3.** "every meeting so far was excused" is true by
   construction — `NULL` occurs exactly when `expected − excused = 0` — but it
   is copy no owner has approved, and PRD DES-14/16 govern it. What would make
   it wrong: a second cause of a `NULL` `participation_pct` that is not
   all-excused, which would make the sentence a false claim about a student's
   own record.
2. **Keeping the two no-rate branches separate rather than merging them into one
   em-dash branch.** Merging is less code; it would also tell a student with
   three excused meetings that nothing was "recorded yet this season", which is
   false. What would make separation wrong: if the owner would rather have one
   uniform no-rate string on the screen.
3. **Widening `MeetingsList.tsx:790` and `ParticipationTab.tsx:363` rather than
   narrowing at the loader boundary.** What would make it wrong: a consumer that
   does arithmetic on `participationPct` and would silently start producing
   `NaN` under a `null` instead of failing to compile.
4. **Leaving `StudentHome.tsx:529` at `number`.** Its loader
   (`students.ts:833-846`) returns `null` for the *whole metric* on a zero
   denominator, so a `null` pct cannot reach it. What would make it wrong: a
   future caller mapping `students.ts:758`'s already-nullable row straight into
   that type.
