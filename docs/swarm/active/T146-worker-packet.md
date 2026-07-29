# Worker Packet: T146 — the loader hop T143 left unguarded

Small in code, and the first test of its kind in this project. Read the Scope
section before you start — the temptation here is to fix far more than you should.

**Packet SHA: pin this.** Before writing your output doc, run
`git log -1 --format=%H -- docs/swarm/active/T146-worker-packet.md` and confirm it
matches the SHA in your dispatch prompt.

## FIRST — merge the working branch

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```

Report the result. **If it conflicts, stop and report.**

## Why this exists

T143 fixed a real bug: the outreach path never selected `teams.color`, so coach-set
team colours never reached the attendance chips. It threaded the column through and
shipped with a DOM test that genuinely fails when the fix is unwired.

T143's checker then found the hole, and this gate **independently reproduced it** —
so the finding below is measured, not attributed. It reverted the loader's select
string:

```ts
// src/lib/supabase/loaders/outreach.ts:731
const result = await client.from('teams').select('id, name, color').order(...)
//                                        back to  .select('id, name')
```

**That fully reinstates the original production bug — and `tsc` exits 0 and all
1476 tests pass.** Nothing in the project notices.

Two reasons:

1. **The cast defeats the compiler.** `outreach.ts:734` reads
   `(result.data as TeamDbRow[] | null) ?? null`. `TeamDbRow` (`:453-457`) declares
   `{ id: string; name: string; color: string }`, so downstream code is *told*
   `color` is present no matter what the query asked for. The cast asserts a shape
   the query does not guarantee.
2. **Nothing asserts select strings.** `src/lib/supabase/` has four test files
   (`auth`, `client`, `functions`, `loader`) and **`loaders/` has none at all**.
   `loader.test.ts` covers `createLoader`'s error normalisation, not queries.

T143 built a correct chain and left its first link unguarded. This task guards it.

---

## What to build

### Use the existing injectable seam — do not export internals

`queryAllTeams` is module-private (`outreach.ts:730`) and should stay that way.
`makeLoadOutreachDetail` is already exported and already takes an injectable client
factory (`outreach.ts:858-860`):

```ts
export function makeLoadOutreachDetail(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadOutreachDetailFn {
```

Inject a fake client that **records the arguments passed to `.select()`** per table,
then assert on what the `teams` query asked for. This exercises the real seam rather
than a function lifted out for testability.

**The fake client already exists — do not build one from scratch.**
`src/pages/outreach/OutreachDetail.test.tsx:943-961` is a complete six-table
`fromSpy` for `makeLoadOutreachDetail`, with a working non-null event row at
`:903-920` and an `unexpected table` guard. Copy it and replace the `teams` branch's
`select` with a recording spy — `select.mock.calls[0][0]` is the column string. A
second precedent, including a thenable-plus-`.order()` stub that satisfies both
awaited-select and chained-select shapes with one object, is at
`MeetingsList.test.tsx:1227-1241` and `:1268-1272`.

That file is in a Forbidden tree, so read it as a template; do not edit it.

**Your test runs in vitest's default node environment — do not add an
`@vitest-environment jsdom` docblock.** `vite.config.ts` sets no global environment,
and every page import in `outreach.ts` is `import type`, so nothing React-shaped is
pulled in.

**One constraint that will otherwise cost you an hour.** `outreach.ts:873`
short-circuits — `if (eventRow === null) return null;` — and the teams query is then
**never issued**. So the events `maybeSingle` stub must resolve a **non-null**
`EventDbRow`, not empty data. (`mapEventDbRowToOutreachDetailEvent` at `:558-574` is
a pure field copy, so a minimal row suffices.) `.in()` is reached only when the
sessions stub returns a non-empty array, so it is optional.

### Assert columns, not the string

**Do not assert `select` was called with the literal `'id, name, color'`.** That
couples the test to formatting: reordering to `'id, color, name'` or adding a space
would fail it while nothing is broken, and a brittle test gets weakened later by
someone who assumes it is wrong.

Parse the recorded select string into a normalised set of column names — split on
`,`, trim — and assert the `teams` select **contains `color`** (and `id` and
`name`). That fails for the reason we care about and only that reason.

**Treat a select of exactly `*` as satisfying the check.** `select('*')` returns
every column, so it fixes the bug rather than causing it — and it is the existing
in-repo pattern for this very table (`teams.ts:173`, `students.ts:185`). Without this
carve-out the test would fail a refactor that broke nothing, which is the brittleness
this whole section exists to avoid.

### Prove it discriminates

This is the whole point of the task, so do it explicitly and report what you saw:

1. Write the test. Confirm it passes against the current, correct code.
2. Revert `outreach.ts:731` to `.select('id, name')` — the exact regression the
   checker demonstrated.
3. Confirm **your new test fails**, and note whether anything else in the suite
   fails (the checker's finding was that nothing did).
4. Restore the select string. Confirm the file is byte-identical to its committed
   state and the suite is green again.

A test that passes either way is worth less than no test, and has cost this task set
two rounds this session.

---

## Scope — deliberately narrow

**In scope: one loader query — `queryAllTeams` in `outreach.ts` — and the test file
that covers it.**

### What you are NOT fixing, and why

The class is much bigger than this instance. Measured on the current tree:

- **81** `as …DbRow` casts across **16** loader files
- **91** real `.select(` call sites under `src/lib/supabase/loaders/` (a raw grep
  returns 107; **16** of those lines are `.select(` written inside doc comments — I
  miscounted this exact way before, so the correction is shown rather than hidden)
- **zero** test files in that directory

Most of those casts can hide a column omission exactly as this one did. About ten
real sites use `.select('*')` (e.g. `teams.ts:173`, `students.ts:185`), where a cast
cannot hide an omission — the class is real but smaller than all 81. **Do
not attempt to fix the class.** An 81-site change is not this task, would be
unreviewable, and the right remedy is probably not more tests anyway.

For the record, since the obvious structural fix will occur to you: typing the
Supabase client with a generated `Database` type would make the casts unnecessary
and let the compiler catch omitted columns at the source. **That option is not
available today** — there are no generated database types in this repo, and
`client.ts:79` — the only `createClient` call in `src/` — passes no `Database`
generic (`:23` is merely the import). Adopting them is a
separate, larger decision. Note it in your output doc as the structural path; do not
start it.

If you spot other loaders with the same defect, **list them in your output doc as
findings**. Do not fix them.

**The recorder stays a one-off, deliberately.** `src/test-utils/` exists
(`authHarness.tsx`) and would be the natural home for a shared select-recorder, but
promoting this to shared infrastructure on its first use presumes a second use that
may never come. Build it inline. If a second loader test lands, *that* task extracts
it — with two real call sites to design against instead of one guess.

---

## Allowed Files

- `src/lib/supabase/loaders/outreach.test.ts` (create — the first test in this directory)
- `src/lib/supabase/loaders/outreach.ts` — two distinct permissions:
  - **Explicitly authorized:** temporarily editing line 731 for criterion 3's
    mutation and restoring it byte-identically. This is required by the criteria and
    is **not** an Allowed Files violation; a checker should not read it as one.
  - **Only if genuinely required:** a minimal export to test through the seam. The
    gate confirmed this is *not* needed — `queryAllTeams` can stay private. Prefer
    touching it not at all beyond the mutation.
- `docs/swarm/active/T146-worker-output.md` (create)

## Forbidden Files

- `docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`, `dispute-log.md`
- Any other `docs/swarm/**` file, including other packets
- `.claude/**`
- Every other file under `src/lib/supabase/loaders/` — 15 other loaders share this
  defect and are explicitly out of scope
- `src/lib/supabase/client.ts`, `loader.ts`
- `src/pages/outreach/**` — T143 covered these and they are already green
- Anything under `node_modules/`

## Acceptance Criteria

1. A test file exists at `src/lib/supabase/loaders/outreach.test.ts` exercising
   `makeLoadOutreachDetail` with an injected fake client.
2. It asserts the `teams` query's selected columns **include `color`**, by parsed
   column set — not by literal string equality.
3. **Discrimination proved by mutation**, per the four steps above. Report the exact
   failure output you saw at step 3, and confirm at step 4 that the file was restored
   byte-identically.
4. Confirm against a recorded measurement rather than rediscovering it: the gate ran
   the mutation **post-merge at `origin/claude/swarm-plan-zl575z` (`d26c52a`)** — the
   tree step 1 actually gives you — and got **tsc exit 0, 63 files / 1476 tests
   passed, eslint 0 errors / 354 warnings** — i.e. nothing else in the suite notices.
   Report whether your run matches; do not burn a full suite run treating this as an
   open question.
5. `queryAllTeams` remains module-private. The gate confirmed no export is needed.
6. **Also assert the mapper hop.** Have the `teams` stub return
   `[{ id: 't1', name: 'Ravens', color: 'blue' }]` and assert the loader's result
   carries `color === 'blue'`. Two extra lines, and it guards
   `mapTeamDbRowToTeamOption` (`outreach.ts:607-609`) as well as the select string —
   so the test covers both ends of the chain rather than only the first.
7. No other loader file is modified.
8. `npx tsc --noEmit`, `npx vite build`, `npm run format:check`, `npx eslint .` and
   `npx vitest run` all clean. Baselines measured **post-merge at
   `origin/claude/swarm-plan-zl575z` (`d26c52a`)** — the tree step 1 gives you, not
   this packet's own commit, whose baseline you cannot reach:
   **0 errors, 354 warnings**, 63 test files, **1476 tests**. Your test count will
   rise; the file count rises by one. Report both and explain.

## Relevant Constitution Excerpt

- **Item 23** — mutation experiments run in your own worktree, never the shared tree.
  Criterion 3 IS a mutation experiment. You already work in your own worktree, so this
  is satisfied by default — but do not run it anywhere else.
- **Item 19c** — verify a citation before asserting it. If anything here does not
  match the tree, **stop and report the mismatch rather than guessing at intent.**
  Three orchestrator citation errors reached workers this session (D011, D012, and a
  gated packet revision); you are explicitly invited to find a fourth.
- **Item 2** — component props come only from `docs/swarm/astryx-api.md`. Not
  expected to bind here; this task touches no UI.

## Required Worker Output

Create `docs/swarm/active/T146-worker-output.md` covering: the fake-client shape you
built and which chain methods it needed; why you asserted columns rather than the
literal string; the full mutation evidence for criterion 3, including whether the
rest of the suite stayed green; any other loaders you noticed with the same defect,
as findings only — and state explicitly that these deferrals (the 81-cast class, the
generated-`Database`-types path, and any other defective loaders you spot) **require
follow-up ledger rows under constitution item 20**, which the foreman creates on
receipt, since `task-ledger.md` is Forbidden to you; a note on the generated-`Database`-types path as the structural
alternative; full command output; and anything you could not verify, stated plainly
as unverified rather than omitted.

Do not mark this task complete. A checker verifies it.
