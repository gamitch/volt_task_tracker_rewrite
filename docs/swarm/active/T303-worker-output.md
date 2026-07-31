# T303 — worker output (evidence doc)

## Task

Make the outreach event Attendance badge's noun status-aware, per the
owner's ruling recorded in the T303 ledger row and restated verbatim in
the dispatch prompt: *"12h recorded is right, just fix the wording to say
'scheduled'."* `eventTotalHours`'s arithmetic (`AttendancePanel.tsx`,
`computeSessionAttendanceTotalHours` reduced over `eligibleSessions`) is
**unchanged**. Only the badge's trailing word changes, and it changes
per-event rather than globally:

- Any contributing session still `status === 'scheduled'` → `"{N}h scheduled"`.
- Every contributing session `completed` (canceled sessions never reach
  the decision — `eligibleSessions` already drops them before either this
  function or `eventTotalHours` see the array) → `"{N}h recorded"`.

## Files changed

- `src/pages/outreach/AttendancePanel.tsx`
  - Added `export function resolveEventHoursNoun(sessions): 'scheduled' | 'recorded'`
    directly below `computeSessionAttendanceTotalHours`, in the file's
    existing "Pure functions — exported for direct testing" section, doc
    comment following the file's existing citation style.
  - Badge render site (module doc line ~794 originally) now reads:
    `` `${formatHours(eventTotalHours)}h ${resolveEventHoursNoun(eligibleSessions)}` ``
    instead of the hardcoded `` `${formatHours(eventTotalHours)}h recorded` ``.
  - Added an "AMENDED 2026-07-31 (T303, ...)" paragraph to module doc
    section 7 (the "no metric-formula re-derivation" section, which is
    where the original badge text was documented), following the file's
    own convention for recording later amendments (see the existing T143
    amendment in section 3) rather than silently rewriting the original
    doc.
  - `eventTotalHours`'s `useMemo` (arithmetic) is byte-for-byte unchanged.

- `src/pages/outreach/AttendancePanel.test.tsx`
  - Imported `resolveEventHoursNoun`.
  - Added `COMPLETED_SESSION` fixture (`{...SESSION_1, id: 'session-completed',
    status: 'completed'}`) next to the existing `CANCELED_SESSION` fixture,
    isolating the noun decision from every other field.
  - New `describe('resolveEventHoursNoun ...')` block: three direct unit
    tests against the pure function — all-scheduled, all-completed, mixed
    (one scheduled among completed).
  - Rewrote the single existing `<AttendancePanel /> running totals` test
    (previously asserted the now-obsolete `'4h recorded'` against the
    default, still-`scheduled` `SESSION_1` fixture) into two tests, one per
    branch, both asserting on `container.textContent` (never `innerHTML`)
    and both **paired** — the expected noun present AND the other noun
    absent:
    - default `SESSION_1` (still scheduled) → contains `'4h scheduled'`,
      does not contain `'recorded'`.
    - `sessions: [COMPLETED_SESSION]` → contains `'4h recorded'`, does not
      contain `'scheduled'`.
  - Verified (by grepping the component source) that `'recorded'`/
    `'scheduled'` do not otherwise appear anywhere else in
    `AttendancePanel.tsx`'s rendered output, so the "absent" half of each
    paired assertion is actually testing the badge, not some unrelated copy.

- `docs/swarm/active/T303-worker-output.md` — this file (new).

No other files touched. `endMeeting.ts`, any migration,
`OutreachDetail.tsx`, and `MarkDayCompleteDialog.tsx` were not opened for
editing.

## Mutation proof (constitution item 23 — run in this agent's own worktree)

Ran in `/tmp/wt-t303` (this agent's own worktree, not the shared checkout),
per constitution item 23.

Mutated `resolveEventHoursNoun` to always return `'recorded'`:

```diff
-  return sessions.some((session) => session.status === 'scheduled') ? 'scheduled' : 'recorded';
+  return 'recorded';
```

`npx vitest run src/pages/outreach/AttendancePanel.test.tsx` under that
mutation — 3 of 41 tests went RED, exactly the branch-1 and mixed tests
(the all-completed test and everything else, correctly, stayed green
since the mutation happens to match that branch):

```
 × resolveEventHoursNoun (T303 -- badge noun, eventTotalHours arithmetic unchanged) > all sessions still scheduled -> "scheduled" 12ms
 ✓ resolveEventHoursNoun (T303 -- badge noun, eventTotalHours arithmetic unchanged) > all sessions completed -> "recorded" 1ms
 × resolveEventHoursNoun (T303 -- badge noun, eventTotalHours arithmetic unchanged) > mixed -- at least one still scheduled among completed -> "scheduled" 2ms
 ...
 × <AttendancePanel /> running totals (module doc #7 -- local sum, not a v_student_hours query) > shows per-day "N attending · M h", and the event badge (T303: still scheduled -> "scheduled", never "recorded") 20ms
 ✓ <AttendancePanel /> running totals (module doc #7 -- local sum, not a v_student_hours query) > event badge reads "recorded" once every contributing session is completed (T303) 18ms

 Test Files  1 failed (1)
      Tests  3 failed | 38 passed (41)
```

Actual failure text (verbatim from the run):

```
FAIL  src/pages/outreach/AttendancePanel.test.tsx > resolveEventHoursNoun (T303 -- badge noun, eventTotalHours arithmetic unchanged) > all sessions still scheduled -> "scheduled"
AssertionError: expected 'recorded' to be 'scheduled' // Object.is equality

Expected: "scheduled"
Received: "recorded"

 ❯ src/pages/outreach/AttendancePanel.test.tsx:362:48
    360| describe('resolveEventHoursNoun (T303 -- badge noun, eventTotalHours a…
    361|   it('all sessions still scheduled -> "scheduled"', () => {
    362|     expect(resolveEventHoursNoun([SESSION_1])).toBe('scheduled');
       |                                                ^
    363|   });
    364|

FAIL  src/pages/outreach/AttendancePanel.test.tsx > resolveEventHoursNoun (T303 -- badge noun, eventTotalHours arithmetic unchanged) > mixed -- at least one still scheduled among completed -> "scheduled"
AssertionError: expected 'recorded' to be 'scheduled' // Object.is equality

Expected: "scheduled"
Received: "recorded"

 ❯ src/pages/outreach/AttendancePanel.test.tsx:370:67
    368|
    369|   it('mixed -- at least one still scheduled among completed -> "schedu…
    370|     expect(resolveEventHoursNoun([COMPLETED_SESSION, SESSION_1])).toBe…
       |                                                                   ^
    371|   });
    372| });

FAIL  src/pages/outreach/AttendancePanel.test.tsx > <AttendancePanel /> running totals (module doc #7 -- local sum, not a v_student_hours query) > shows per-day "N attending · M h", and the event badge (T303: still scheduled -> "scheduled", never "recorded")
AssertionError: expected 'Attendance4h recordedSun, Aug 2 · 9:0…' to contain '4h scheduled'

Expected: "4h scheduled"
Received: "Attendance4h recordedSun, Aug 2 · 9:00 AM–5:00 PM1 attending · 4 hAmara ChenRavensAmara Chen hourshSofia DelgadoTitans"

 ❯ src/pages/outreach/AttendancePanel.test.tsx:816:35
    814|     // AND the other noun is absent, so this cannot pass on a badge th…
    815|     // simply failed to render.
    816|     expect(container.textContent).toContain('4h scheduled');
       |                                   ^
    817|     expect(container.textContent).not.toContain('recorded');
    818|   });
```

Restored the mutation (`git diff` against the committed version showed
zero diff after restore) and re-ran: 41/41 green.

This is real, run evidence, not an argued claim — the mutation drove the
exact two unit-test branches and the exact one component-test branch the
packet asked for red, and nothing else.

## Gates (run with `.env.local` ABSENT, in `/tmp/wt-t303`)

1. `npx tsc --noEmit` — exit 0, no output.
2. `npx vite build` — succeeded, exit 0 (`✓ built in 6.63s`; pre-existing
   "chunks larger than 500kB" advisory notice only, unrelated to this
   change).
3. `npm run format:check` — clean: `All matched files use Prettier code style!`
   exit 0.
4. `npx eslint .` — `✖ 360 problems (0 errors, 360 warnings)`, exit 0. All
   360 warnings are the pre-existing `react-refresh/only-export-components`
   pattern already present across the codebase's exported-pure-function
   files (this file itself already triggers several, unrelated to this
   task's new export). Zero errors.
5. `npx vitest run` — **70 files / 1701 tests passed** (base stated in the
   packet: 70 files / 1697 tests — this task adds exactly 4 new tests: 3
   direct unit tests for `resolveEventHoursNoun` + 1 additional
   component-level branch test, net of the 1 pre-existing test that was
   rewritten in place). Exit 0.
6. `npx vitest run src/pages/outreach/AttendancePanel.test.tsx >/dev/null 2>&1; echo $?`
   → `0`.

All six gates green.

## `git status` / node_modules note

This worktree's `node_modules` is a symlink to the shared checkout's
`node_modules` (added to `.git/worktrees/wt-t303`'s local exclude file so
it never shows as untracked, and confirmed via `git status --short` before
every stage/commit that only the two intended source files plus this
evidence doc are staged — never `node_modules`, never `git add -A`).

## Deferred — for the ledger (constitution item 20)

Nothing new found in scope. Two adjacent, already-filed rows
(`docs/swarm/task-ledger.md`) remain open and are explicitly out of this
task's Allowed Files, so no action was taken on them here:

- **T304** — `OutreachList.tsx`'s Upcoming/Past bucketing is date-blind
  (status-only), independent of this badge.
- **T305** — Signups vs. Attendance contradiction and
  `MarkDayCompleteDialog.tsx`'s RSVP-only checklist seeding, independent of
  this badge.

Neither was touched; both were already filed by the owner before this task
was dispatched.

## Commands run (chronological)

```
git fetch origin claude/t189-inactive-meetings
git worktree add /tmp/wt-t303 -b claude/t303-attendance-badge origin/claude/t189-inactive-meetings
ln -s /home/user/volt_task_tracker_rewrite/node_modules /tmp/wt-t303/node_modules
echo "node_modules" >> /home/user/volt_task_tracker_rewrite/.git/worktrees/wt-t303/info/exclude
npx tsc --noEmit
npx prettier --write src/pages/outreach/AttendancePanel.tsx src/pages/outreach/AttendancePanel.test.tsx
npx vitest run src/pages/outreach/AttendancePanel.test.tsx
# mutation experiment (resolveEventHoursNoun -> always 'recorded'), rerun, restore, rerun
npx tsc --noEmit
npx vite build
npm run format:check
npx eslint .
npx vitest run
npx vitest run src/pages/outreach/AttendancePanel.test.tsx >/dev/null 2>&1; echo $?
```

## Known risks

- The badge's noun now reflects live session status rather than always
  reading "recorded" — any other code or test elsewhere in the repo that
  greps for the literal string `"h recorded"` against a still-scheduled
  event's badge would now see `"h scheduled"` instead. A repo-wide grep for
  `'h recorded'` / `"h recorded"` found no other reference to this exact
  badge string outside `AttendancePanel.tsx`/`AttendancePanel.test.tsx`.
- `resolveEventHoursNoun` is called inline in the render body (not wrapped
  in its own `useMemo`, unlike `eventTotalHours`) — it's an O(n) `.some()`
  over `eligibleSessions`, the same array `eventTotalHours` already
  iterates with a full `.reduce()`, so this adds no meaningful cost; kept
  unmemoized to match the file's existing pattern of calling other pure
  helpers (`formatHours`, `computeSessionAttendanceTotalHours` inside the
  per-day map) directly in JSX rather than everything going through
  `useMemo`.

## Dispute

Not filing. The spec (owner's ruling, restated in the dispatch prompt) was
clear and implementable without contradiction.
