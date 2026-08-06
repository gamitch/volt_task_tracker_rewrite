# T605 — attempt 1 failure record

**Verdict: FAIL, severity BLOCKER.** `checker-reviewer` against `docs/swarm/active/T605-checker-packet.md`,
anchored `a13c8fa..f8cba40`.

## The blocker

`npm run format:check` **exits 1** at `f8cba40` on a clean tree; it exits **0** at the parent. Confirmed
against the committed blobs directly (`git cat-file -p f8cba40:<path>`), so it is not worktree state.

```
[warn] src/lib/supabase/loaders/meetings.ts
[warn] src/pages/meetings/EditMeetingSessionDialog.test.tsx
[warn] src/pages/meetings/MeetingsList.test.tsx
FORMAT_EXIT:1
```

Five sites, all inside T605's own added lines — quote style and one wrap:

- `src/lib/supabase/loaders/meetings.ts:1081` — double-quoted string should be single-quoted
- `src/pages/meetings/EditMeetingSessionDialog.test.tsx:33`, `:45` — escaped `\'` in an `it()` title should be a double-quoted string
- `src/pages/meetings/EditMeetingSessionDialog.test.tsx:92-94` — over-wrapped `expect(...)` that fits on one line
- `src/pages/meetings/MeetingsList.test.tsx:2728` — escaped `\'id\'` in the test-9 title should be double-quoted

**`format:check` is a blocking CI step** (`.github/workflows/ci.yml:75`), so this commit fails CI as pushed.

## Root cause: a process gap, not a code defect

The worker's own evidence document (`T605-worker-output.md:316-323`) lists its gates as typecheck, two
focused vitest runs, and `npm test`. **`format:check` appears nowhere** — `grep -i format` on that
document returns only an unrelated `formatWeekdayDate`. The commit message repeats the same subset.
The packet required all four gates.

No logic, no assertion semantics, and no test outcome is affected. `npm run format` fixes it.

## What PASSED, and must not be re-litigated on rework

Everything else cleared, much of it the hard parts:

- **Scope**: exactly 5 files; `ScheduleMeetingsDialog.tsx`/`.test.tsx` produce **zero diff bytes**, so
  T611's fix and T613's fixtures are untouched; `MeetingsList.test.tsx` has **zero deletions**.
- **All four mutations genuinely RED**, transcripts read directly rather than via `replay.py` (T612).
- **The false pass is confirmed fixed, by reproduction**: with the future-guard deleted, the shipped
  test using `PAST_RETARGET_DATE` **fails** (correct), while the pre-fix `PAST_SCHEDULED_DATE` version
  **passes** — proving the original test proved nothing about the guard it named.
- **Test 9: the packet was wrong and the worker was right.** Third independent measurement confirms
  dropping `.select('id')` breaks assertions **(a) and (b)**, not (c); (c) stays green. Recorded as a
  packet defect.
- **Grant A byte-for-byte identical**, located by name after a 1094→1142 line shift.
- Counts independently derived: 81 files/2101 → 82 files/2121. Lint 371→375, all four
  `react-refresh/only-export-components` in the new dialog file, verified by rule and file.

## Required rework

1. Run `npm run format` and nothing else.
2. Re-run **all four** gates bare with `$?` captured — typecheck, **format:check**, lint, test — and
   record all four. Expect `0/0/0/0`, 82 files / 2121 tests.
3. Amend the evidence document's gate list to include `format:check`, so the omission does not recur.
