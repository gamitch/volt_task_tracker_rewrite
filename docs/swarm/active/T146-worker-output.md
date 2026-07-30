# T146 Worker Output — the first loader test in this project

Packet SHA pinned and confirmed: `93109fadc1abb5a72480c493de7b4d42b7050fd9`
(verified via `git log -1 --format=%H -- docs/swarm/active/T146-worker-packet.md`
after the merge below).

## Step 1 — merge result

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```

Fast-forward, no conflicts. My worktree's prior HEAD
(`214625552faa731c85f7bc04d3c3596811372b7f`) was an ancestor of
`origin/claude/swarm-plan-zl575z`, so the merge fast-forwarded straight to
`93109fadc1abb5a72480c493de7b4d42b7050fd9` — the exact packet SHA — with no
merge commit and nothing to resolve.

## Citation verification (item 19c)

Before writing anything, I checked every line citation in the packet against
the post-merge tree. All matched exactly:

- `TeamDbRow` interface, `outreach.ts:453-457` — matches (`{ id, name, color }`).
- `mapTeamDbRowToTeamOption`, `outreach.ts:607-609` — matches.
- `queryAllTeams`, `outreach.ts:730-735`, select at `:731` — matches, including
  the exact string `'id, name, color'`.
- `makeLoadOutreachDetail`, `outreach.ts:858-860` — matches, injectable
  `getClient` param confirmed.
- Null-event short-circuit, `outreach.ts:873` — matches
  (`if (eventRow === null) return null;`), teams query is issued via
  `Promise.all` immediately after at `:875-879`.
- `mapEventDbRowToOutreachDetailEvent`, `outreach.ts:558-574` — matches, pure
  field copy, confirming a minimal stub row suffices.
- `OutreachDetail.test.tsx` fromSpy at `:943-961`, event row at `:903-920` —
  matches exactly (this is the citation the gate corrected in revision 3; the
  corrected range is right).
- `MeetingsList.test.tsx` thenable-plus-`.order()` precedent at `:1263-1279`
  (packet cites `:1268-1272` for the stub itself, `:1227-1241` for the
  `fromSpy` six-table shape) — both match.
- `teams.ts:173` and `students.ts:185`, both `select('*')` — both match,
  confirming the carve-out precedent is real.
- `src/lib/supabase/` test-file inventory — confirmed 4 test files
  (`auth`, `client`, `functions`, `loader`) and `loaders/` has zero, before
  this task.

No fourth citation error found. Everything the packet asserted about the tree
matched.

## The fake client I built

In `src/lib/supabase/loaders/outreach.test.ts`, one test, injected through
`makeLoadOutreachDetail(() => client)` — the real exported seam, not a lifted-
out `queryAllTeams`. Chain methods needed, one `fromSpy` branch per table:

- `events`: `select() -> eq() -> maybeSingle()`, resolving a full minimal
  `EventDbRow` (non-null — required, since `outreach.ts:873` short-circuits on
  null and the teams query would never fire otherwise; confirmed this by
  first writing the test with `created_by: null` too, which also lets the
  `profiles` query never fire, so I could leave `profiles` out of the
  `fromSpy` entirely).
- `event_sessions`: `select() -> eq() -> order()`, resolving `{ data: [], error: null }`
  — empty on purpose, since `.in()` for `rsvps` is only reached when the
  sessions stub returns a non-empty array (packet's own note); this keeps the
  test to the minimum tables actually exercised.
- `students`: `select() -> order()`, resolving `{ data: [], error: null }`.
- `teams`: `select` is the recorder itself — `vi.fn(() => ({ order: vi.fn().mockResolvedValue(...) }))`
  — returning a stubbed row `{ id: 't1', name: 'Ravens', color: 'blue' }`.
- Anything else: throws `unexpected table: ${table}` (same guard the template
  uses), so an unexpected additional query fails loudly rather than silently
  passing.

I did not need the thenable-plus-`.order()` single-stub pattern from
`MeetingsList.test.tsx` since I only needed one table's chain to differ
(`teams`, to record); every other table gets its own small per-table stub
instead, closer to `OutreachDetail.test.tsx`'s own template shape.

## Why I asserted columns, not the literal string

`parseSelectedColumns()` splits the recorded `.select()` argument on `,` and
trims each piece into a `Set<string>`. The assertion checks
`columns.has('*') || columns.has('color')` (plus, when not `'*'`, that `id`
and `name` are present too). This means:

- A revert to `.select('id, name')` fails the test (no `color` in the set).
- A harmless reformat — reordering to `'id, color, name'`, adding a space —
  would NOT fail it, because the check is set-membership, not string
  equality.
- `.select('*')` (the existing pattern for this exact table in `teams.ts:173`
  and `students.ts:185`) explicitly passes, since it returns every column and
  therefore cannot be the bug this test guards against.

## Mutation proof (criterion 3, constitution item 23)

Run entirely in this worktree (`agent-a99aa543a8cc166e5`), which I already
own — no separate worktree needed per item 23's "an agent without one creates
one" clause, since I have one.

1. **Baseline**: wrote the test, ran it — passed against the current,
   correct `outreach.ts` (`select('id, name, color')`). Output:
   ```
   ✓ src/lib/supabase/loaders/outreach.test.ts (1 test) 5ms
   Test Files  1 passed (1)
        Tests  1 passed (1)
   ```
2. **Mutation**: recorded the file's SHA-256
   (`b07b85a33b70cb37b8783fcf2fa776efb3fae7af33c9ab5d285de643438916d7`) and a
   full copy, then edited line 731 from
   `.select('id, name, color')` to `.select('id, name')` — the exact
   regression string the packet names.
3. **Confirmed my test fails.** Exact output:
   ```
   ❯ src/lib/supabase/loaders/outreach.test.ts (1 test | 1 failed) 15ms
     × queryAllTeams (via makeLoadOutreachDetail) -- T146 select-string guard
       > asks the `teams` table for `color` (plus `id`/`name`), and threads a
         stubbed row's color through to the loader's result 14ms
       → expected false to be true // Object.is equality
   AssertionError: expected false to be true
   - Expected: true
   + Received: false
    ❯ src/lib/supabase/loaders/outreach.test.ts:107:27
   Test Files  1 failed (1)
        Tests  1 failed (1)
   ```
   I also ran `npx tsc --noEmit` under the mutation: **exit 0, no errors** —
   confirming the packet's central claim that the cast at `outreach.ts:734`
   defeats the compiler and this bug is otherwise invisible to `tsc`.
4. Per criterion 4's explicit instruction ("do not burn a full suite run
   treating this as an open question"), I did **not** re-run the full 1476-
   test suite under the mutation to independently rediscover that nothing
   else notices — I relied on the gate's recorded measurement
   (post-merge at `origin/claude/swarm-plan-zl575z`/`d26c52a`: tsc exit 0,
   63 files/1476 tests passed, eslint 0 errors/354 warnings) per criterion 4.
   My own `tsc --noEmit` run under the mutation reproduced the "tsc exit 0"
   half of that claim directly.
5. **Restored** line 731 to `.select('id, name, color')`. Verified byte-
   identical restoration two ways:
   - `sha256sum src/lib/supabase/loaders/outreach.ts` →
     `b07b85a33b70cb37b8783fcf2fa776efb3fae7af33c9ab5d285de643438916d7`
     (identical to the pre-mutation hash above).
   - `git status --porcelain src/lib/supabase/loaders/outreach.ts` → empty
     (no diff against HEAD).
   Re-ran the test: passes again (1 test, 1 passed).

## Post-mutation-restoration full quality gate (criterion 8)

All run against the fully-restored tree, post-merge at
`93109fadc1abb5a72480c493de7b4d42b7050fd9` (== `origin/claude/swarm-plan-zl575z`,
which fast-forwarded onto `d26c52a`'s lineage):

- `npx tsc --noEmit` → exit 0, no output.
- `npx vite build` → succeeds, `✓ built in 6.28s` (one pre-existing chunk-size
  advisory, not an error, unrelated to this change).
- `npm run format:check` → `All matched files use Prettier code style!`
- `npx eslint .` → `✖ 354 problems (0 errors, 354 warnings)` — **matches the
  recorded baseline exactly** (0 errors, 354 warnings).
- `npx vitest run` (full suite) → `Test Files  64 passed (64)` /
  `Tests  1477 passed (1477)`.

Baseline was 63 files / 1476 tests. My change adds exactly one file
(`outreach.test.ts`) and exactly one test — so 64 files / 1477 tests is the
expected delta, and it's what I got. Nothing else moved.

## `queryAllTeams` stays module-private (criterion 5)

Not exported. `git diff` against the merge base touches only two files:
`src/lib/supabase/loaders/outreach.test.ts` (new) and
`docs/swarm/active/T146-worker-output.md` (new, this file).
`src/lib/supabase/loaders/outreach.ts` has zero net diff (the mutation was
made and reverted within the same working session, never committed).

## Other loaders with the same defect (findings only — not fixed)

Confirmed present, not fixed, per Scope:

- 15 other files under `src/lib/supabase/loaders/` besides `outreach.ts`,
  none of which have a test file. I did not audit each individually for
  which specific `.select(...)` calls under-select relative to their `as
  ...DbRow` cast target — the packet's own count (81 casts across 16 loader
  files, ~91 real `.select(` call sites) already establishes the class size
  and I did not re-derive it.
- The general shape of the defect (a `.select(...)` call whose result is
  immediately cast to an interface wider than what was actually selected) is
  structural to every loader file that isn't already using `select('*')`
  (about 10 sites do, per the packet).

**These deferrals require follow-up ledger rows under constitution item 20**,
which the foreman creates on receipt (`task-ledger.md` is Forbidden to me):

1. The ~81-cast / ~91-select-site class of "cast defeats compiler on
   under-selected columns" across the 16 loader files — same shape as the bug
   this task guards, not fixed here per explicit Scope.
2. The generated-`Database`-types structural alternative (see below) — not
   started, per the packet's instruction to note it, not build it.
3. Any other loader discovered in a future pass to have this exact defect
   (I did not individually audit the other 15 files' select strings against
   their cast targets beyond what the packet already measured).

## Structural alternative: generated `Database` types

Noted, not started, per Scope. Typing the Supabase client with a generated
`Database` type (`createClient<Database>(...)`) would let `tsc` catch a
`.select()` that omits a column the calling code reads, removing the need for
per-call `as ...DbRow` casts entirely. Not available today: no generated
database types exist in this repo, and `client.ts:79` (the only `createClient`
call in `src/`) passes no `Database` generic — confirmed by reading
`client.ts` directly. This is a separate, larger decision (would touch every
loader file), not attempted here.

## Anything unverified

- I did not independently re-derive the packet's exact counts ("81 `as
  ...DbRow` casts", "91 real `.select(` call sites", "16 doc-comment
  `.select(` occurrences") — these were the premise gate's own measurements
  and re-deriving them wasn't required by any acceptance criterion. Stated
  here as unverified by me specifically, not silently assumed correct.
- Everything else in this document — every line citation, every command, every
  test output shown above — I ran or read directly in this worktree during
  this session.

## Files changed

- `src/lib/supabase/loaders/outreach.test.ts` — new file, one test.
- `src/lib/supabase/loaders/outreach.ts` — **no net change**; mutated to
  `.select('id, name')` and restored to `.select('id, name, color')`
  within this session, confirmed byte-identical by SHA-256 and empty
  `git diff`.
- `docs/swarm/active/T146-worker-output.md` — this file.

Do not mark this task complete. A checker verifies it.
