# T063b worker output — manifest write path + manifest-driven teardown

Branch: `claude/t063b-manifest-teardown`, off `origin/claude/t063-file-source` @ `1d03fa7`
(per the packet — this branch is not merged into `main` yet, so this task depends on it
directly rather than on `main`).

## What this task builds

1. A migration manifest, written during a real (non-dry-run) run, recording exactly which
   rows that run **created** (never rows it merely matched via the natural-key upsert).
2. `--teardown=<manifest-path>` — deletes exactly the ids in the manifest, FK-safe order,
   structurally incapable of naming `profiles` / `guardian_links` / `auth.users`.
3. The interim SQL rule is untouched — not in this task's Allowed Files, not referenced by
   any code here, and this task does not claim it is replaced everywhere, only that a durable
   mechanism now exists alongside it.

## Files changed

- `scripts/migrate/manifest.ts` (new, 354 lines) — manifest types, `ManifestRecordingSink`,
  `buildManifest`/`writeManifest`/`readManifest`/`defaultManifestPath`.
- `scripts/migrate/manifest.test.ts` (new, 369 lines, 20 tests).
- `scripts/migrate/teardown.ts` (new, 192 lines) — `TEARDOWN_TABLE_ORDER`, `runTeardown`,
  `printTeardownSummary`, `performTeardown` (CLI-level orchestration).
- `scripts/migrate/teardown.test.ts` (new, 279 lines, 11 tests).
- `scripts/migrate.ts` — CLI wiring: `--manifest-out=<path>`, `--teardown=<path>`, updated
  help text and usage examples.
- `scripts/migrate/dataSink.ts` — **used the packet's conditional permission**. See the
  "created-vs-matched" section below for why this was genuinely necessary, not a convenience
  edit, and why it's additive-only (nothing existing changed shape).
- `docs/swarm/active/T063b-worker-output.md` (this file).

**Nothing under `src/` or `supabase/` touched.** Confirmed via `git status --short` before
every commit (see "Commands run").

## The created-vs-matched distinction — what I found, and what I built

**The packet was right to flag this as the load-bearing question.** Before this task,
`NewDataSink`'s public interface (`scripts/migrate/dataSink.ts`) only returns *counts*
(`UpsertResult { createdCount, updatedCount }`) from every upsert call — never which specific
ids were created vs matched. Internally, `idUpsert`/`compositeKeyUpsert`/`upsertTeams` already
*compute* that distinction (they need it to produce the counts) but were throwing the id-level
detail away before returning. **Without a change somewhere, a manifest genuinely cannot be
built** — this is exactly the condition the packet said would justify editing `dataSink.ts`.

**What I built, additive-only, so nothing outside this task's Allowed Files had to change:**

- New types in `dataSink.ts`: `UpsertResultWithIds extends UpsertResult { createdIds: string[] }`,
  `TeamsUpsertOutcomeWithIds extends TeamsUpsertOutcome { createdIds: string[] }`, and a new
  `IdentifyingNewDataSink` interface (same 7 methods as `NewDataSink`, wider return types).
- `idUpsert`/`compositeKeyUpsert`/`SupabaseNewDataSink.upsertTeams` now compute and return
  `createdIds` too — for `idUpsert`'s tables (students/events/event_sessions) this is free,
  since ids are deterministic uuidv5s already known before the upsert runs. For
  `compositeKeyUpsert` (rsvps/attendance), I added `.select('id, session_id, student_id')`
  onto the *existing* `.upsert()` call — one chained clause, **zero extra round trips** — to
  recover the DB-assigned `id` for newly-created rows, mirroring the pattern `upsertTeams`
  already used for exactly this reason.
- **`NewDataSink`, `TeamsUpsertOutcome`, `UpsertResult`, and the `SupabaseNewDataSink implements
  NewDataSink` declaration are all unchanged.** Every other implementation of `NewDataSink`
  (`fixtures.ts`'s `InMemoryNewDataSink`) and every caller holding only a `NewDataSink`-typed
  reference (`core.ts`, `migrate.ts`'s `sink` variable) is unaffected — verified by the fact
  that `core.ts`, `types.ts`, and `fixtures.ts` needed zero edits and the full 1815-test suite
  stayed green with no other file touched.
- `scripts/migrate/manifest.ts`'s `ManifestRecordingSink` decorates a `SupabaseNewDataSink`
  (typed as `IdentifyingNewDataSink`), delegates every real write unchanged, and records only
  `outcome.createdIds` after each call — never the full row list, never anything the inner
  sink reports as matched. `core.ts` needed **no changes at all**: it only ever calls
  `sink.upsertX(rows, dryRun)` on whatever object `migrate.ts` hands it, so wrapping the real
  sink is sufficient without touching orchestration.

I did **not** need to add a second Supabase client/duplicate-query approach (my first design) —
once I noticed `IdentifyingNewDataSink` alone (not intersected with `NewDataSink`) is
structurally assignable to `NewDataSink`, `ManifestRecordingSink` only needs the one, richer
interface. This also made the whole thing trivially unit-testable with a plain in-memory fake
object (no real Supabase client, no PGlite) — see `manifest.test.ts`'s `makeFakeIdentifyingSink`.

## Manifest write path

- `--manifest-out=<path>` (optional). If absent on a real run, `defaultManifestPath()` builds
  `docs/migration/manifests/migration-manifest-<sanitized-ISO-timestamp>.json` and the CLI
  prints it (`Manifest written: <path>`) — a real run cannot complete silently without one.
- `--dry-run` never writes a manifest: `migrate.ts` only calls `writeManifest` inside the
  `if (!options.dryRun)` branch, and `ManifestRecordingSink` records `[]` on a dry run
  regardless (belt-and-suspenders — `dataSink.ts`'s helpers return `createdIds: []` whenever
  `dryRun` is true, before the manifest layer even gets a say).
- `--fixture` mode never reaches the manifest path at all (`InMemoryNewDataSink`, never
  wrapped) — it never touches a real project, so a manifest for it would be meaningless.
- Manifest fields: `schemaVersion`, `runAt` (ISO 8601 UTC), `cutoverDate`, `source`
  (`{kind:'from-dir', path}` or `{kind:'live'}`), `newProjectUrl`, and `tables` (7 fixed keys,
  each `{createdIds, createdCount}`).
- `newProjectUrl` is recorded specifically so teardown can refuse to run against a *different*
  project than the manifest was written against (`TeardownProjectMismatchError`) — verified
  live in the CLI smoke test below.

## Teardown

- `TEARDOWN_TABLE_ORDER` (`teardown.ts`): a fixed 7-name literal —
  `attendance, rsvps, event_sessions, events, students, seasons, teams` — children before
  parents, derived from the FK graph in both T009/T010 migrations (`on delete restrict`
  everywhere in that batch except `event_sessions.event_id`). `profiles`, `guardian_links`,
  `auth.users` are absent by construction, not filtered out.
- **Structural guard, not convention:** `runTeardown` iterates this literal array, never
  `Object.keys(manifest.tables)`. `teardown.test.ts`'s "ignores an injected profiles key" test
  hand-constructs a manifest (bypassing this codebase's own types, simulating a tampered
  `manifest.json`) carrying an extra `profiles` entry with a fake owner-account id, and proves
  by execution that `runTeardown` never calls `.from('profiles')` and the fake "owner account"
  row survives untouched.
- `--dry-run --teardown=<path>` is supported and does the same existence check as a real run
  (read-then-maybe-delete, matching `dataSink.ts`'s own dry-run convention) — only the
  `.delete()` call is skipped.
- Idempotent: a second run against an already-torn-down manifest reports `alreadyGoneIds`
  populated and `deletedIds: []`, and does not throw (proven in `teardown.test.ts`).
- `performTeardown` (CLI orchestration): validates the manifest **before** loading env vars or
  touching the network, so a malformed/empty/missing manifest fails without needing
  `NEW_SUPABASE_URL`/`NEW_SERVICE_ROLE_KEY` at all — verified both by a unit test
  (`performTeardown` rejects with no env vars set in the test process) and by a live CLI smoke
  test (`env -i` with only `PATH`).
- Teardown requires `NEW_SUPABASE_URL`/`NEW_SERVICE_ROLE_KEY` (via `env.ts`'s existing
  `loadNewSupabaseEnv`) for both `--dry-run` and real runs, and fails clearly
  (`MissingEnvError`) if absent — confirmed live below.

## Mutation proofs (item 23 — run entirely in this task's own worktree)

Every behavioral property below was proven discriminating by making the exact mutation,
confirming the named test(s) go red, then reverting and re-confirming green. Each mutation
was applied with a standalone `python3`/`cp` edit (not the Edit tool, so the harness's own
diff tracking wasn't involved in the revert) and reverted from a `cp`-taken backup, then
re-diffed against the backup to confirm byte-identical restoration before moving on.

| # | Property | Mutation | Test(s) that went red |
|---|---|---|---|
| 1 | `ManifestRecordingSink` records only created ids | `upsertStudents` records `rows.map(r=>r.id)` instead of `outcome.createdIds` | "records only created ids, never matched/pre-existing ones", "records nothing on a dry run" |
| 2 | Teardown deletes exactly the manifest's ids, nothing else | `runTeardown`'s select drops the `.in('id', requestedIds)` filter (selects/deletes every row in the table) | "deletes only ids the manifest lists...", "dry run deletes nothing...", and (as a side effect) the idempotency test |
| 3 | Teardown idempotency reporting | (same mutation as #2 — the always-report-as-deleted-not-already-gone behavior) | "a second real run... finds everything already gone..." |
| 4 | FK-safe delete order | `runTeardown` iterates `Object.keys(manifest.tables)` instead of `TEARDOWN_TABLE_ORDER` | "touches tables in the declared children-before-parents order" |
| 5 | Forbidden tables never referenced | same mutation as #4 (this is what makes the injected `profiles` key actually get iterated) | "never calls .from() with a forbidden table name..." |
| 6 | `readManifest` rejects empty files | removed the dedicated `raw.trim().length === 0` check | "rejects an empty file" (**after a fix — see below**) |
| 7 | `readManifest` rejects tampered `createdCount` | removed the `createdCount !== createdIds.length` cross-check | "rejects a manifest whose createdCount was hand-edited..." |
| 8 | Manifest round-trip fidelity | `validateManifestShape` returns a hardcoded wrong `cutoverDate` | "reads back exactly what was written" |

**A real defect in my own test suite, found by mutation #6, worth reporting rather than
hiding:** the first version of the "rejects an empty file" test wrote its fixture to a file
literally named `empty.json`, then asserted the thrown message matched `/empty/`. Because
`readManifest`'s error messages interpolate the file path, `.../empty.json is not valid JSON:
...` satisfies `/empty/` **regardless of whether the dedicated empty-file check exists at
all** — I proved this by removing the check and watching the test still report green. This is
exactly the "a criterion whose mutation leaves the suite green is not evidence" failure mode
the packet warned about, and I found it by actually running the mutation rather than trusting
the assertion on inspection. **Fixed**: renamed the fixture to `blank-manifest-fixture.json`
and tightened the regex to `/is empty/`; re-ran the mutation and confirmed it now goes red
(see the table above). I also audited every other message-regex assertion in
`manifest.test.ts` for the same filename-pollution class of bug — one more instance found
(`no-tables.json` vs `/tables/` — the filename itself contains "tables"), fixed the same way
(renamed to `incomplete-fixture.json`, tightened to `/"tables"/`). The rest were already clear
of this problem (verified individually, not assumed).

## CLI smoke tests (live, not just unit tests)

Run from the worktree root, `.env.local` absent throughout:

- `--help` prints the new `--manifest-out`/`--teardown` sections correctly.
- `--fixture --dry-run --cutover-date=2026-02-01` — unchanged output vs. before this task
  (regression check on existing functionality).
- `--teardown=<missing-file>` → `Error: Manifest: failed to read ... ENOENT ...`, exit 1.
- `--teardown=<path> --fixture` → `Error: --teardown is mutually exclusive with --fixture /
  --from-dir / --cutover-date`, exit 1.
- `--teardown=<valid-manifest>` with `env -i` (no env vars at all) → `Error: Missing required
  env var: NEW_SUPABASE_URL`, exit 1 — proves manifest validation runs, and only afterward
  does env loading fail, without ever reaching the network.
- `--teardown=<manifest recorded against https://correct-project...>` with
  `NEW_SUPABASE_URL=https://wrong-project...` → `Error: Teardown: manifest ... was written
  against https://correct-project.supabase.co, but NEW_SUPABASE_URL is currently
  https://wrong-project.supabase.co -- refusing to run teardown against a different project
  than the manifest describes.`, exit 1 — the project-mismatch guard, proven live.

## Gates

All run from the worktree root, `.env.local` confirmed absent (`ls .env.local` → not found).

1. **`npx tsc --noEmit`** — exit 0, zero errors. As documented by T063's own worker output
   and re-confirmed here (`npx tsc --noEmit --listFiles | grep -c scripts/migrate` → 0),
   `tsconfig.json`'s `include` (`["src", "vite.config.ts"]`) does not type-check
   `scripts/migrate/**` at all — pre-existing, unrelated to this task. As a bonus (not part of
   the reported gate, since it isn't this project's actual typecheck path), I also ran a
   standalone `npx tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution
   Bundler --allowImportingTsExtensions --skipLibCheck --lib ES2022,DOM,DOM.Iterable
   scripts/migrate.ts scripts/migrate/*.ts`: 12 errors, **all** `Cannot find module
   'node:fs/promises'`-class (no `@types/node` dependency in this repo — the same class of
   error the pre-existing `jsonFileSource.ts`/`jsonFileSource.test.ts` already produce
   standalone, confirmed by running the same command against just those two files). Zero
   errors of any other kind — specifically, zero `createdIds does not exist on type...` errors
   (this was the actual risk from the `dataSink.ts` widening, and it's clean).
2. **`npx vite build`** — exit 0, `✓ built in ~6s`. Same pre-existing `(!) Some chunks are
   larger than 500 kB` advisory, unrelated to this change.
3. **`npm run format:check`** — exit 0, "All matched files use Prettier code style!". As
   T063's worker output already documented, this glob doesn't cover `scripts/**` at all. For
   transparency, `npx prettier --check scripts/migrate/*.ts scripts/migrate.ts` reports 12
   files as non-default-Prettier-formatted, including 6 pre-existing files unrelated to this
   task (`core.ts`, `dataSink.ts`, `report.ts`, `transform.ts`, `verify-fixture.ts`,
   `jsonFileSource.ts`/`.test.ts`) — this directory has never conformed to default Prettier
   width, and I matched its existing line-length/style conventions rather than introducing a
   second style within the same files.
4. **`npx eslint .`** — 0 errors, **361 warnings**, exit 0. Confirmed identical to T063's
   documented baseline (361 warnings / 0 errors) — **no rise**. `npx eslint scripts/migrate/
   scripts/migrate.ts` alone: 0 problems. (Two real errors surfaced during development —
   `writeManifest` imported-but-unused and an unused `_cols` parameter in
   `teardown.test.ts`'s fake client — both fixed before this final run; recorded here rather
   than silently cleaned up.)
5. **`npx vitest run`** — **75 files / 1815 tests, all passed**, exit 0. Base branch point
   (`1d03fa7`, per T063's own worker output, independently re-confirmed by running this exact
   suite before making any change) is **73 files / 1784 tests** — matching the packet's stated
   base exactly. This task's delta is **+2 files / +31 tests**
   (`manifest.test.ts`: 20, `teardown.test.ts`: 11), nothing else added, removed, or altered.

## Deferred — for the ledger (constitution item 20)

- **The interim SQL rule is not wired to anything new.** This task built the durable
  mechanism alongside it, per the packet's explicit instruction not to remove or alter it.
  Whether/when to actually run a manifest-driven teardown for the *current* pre-manifest data
  (which has no manifest, by definition — it was migrated before this task existed) is a
  human decision, not something this task resolves. No code path in this branch touches the
  interim SQL.
- **No manifest currently exists for any already-completed migration run.** This is expected
  — the manifest write path is new. If George has already run a real (non-`--dry-run`, non-
  `--fixture`) migration against the new project before this branch merges, there is no
  manifest for teardown to consume for that run, and the interim SQL rule (unmodified) remains
  the only mechanism for it.
- **`defaultManifestPath()`'s default directory (`docs/migration/manifests/`) is not yet
  `.gitignore`d.** A real run's manifest will land as an untracked file there unless the
  caller passes `--manifest-out=` pointing outside the repo, or someone adds a `.gitignore`
  entry. I did not add one myself since `.gitignore` is not in this task's Allowed Files and I
  did not want to guess at whether these should ever be committed (there's a real argument for
  keeping them as an audit trail, which is a product/ops decision, not an engineering default
  I should pick unilaterally). Flagging as a follow-up decision, not a defect in this task.
- **Teardown does not attempt to verify FK-consistency of a manifest across tables** (e.g., an
  `attendance` id whose `session_id` isn't present in the `event_sessions` table's
  `createdIds` — which would be fine, since that session might have already existed and been
  matched, not created — but a manifest with `event_sessions` ids that don't correspond to
  anything real would just show up as `alreadyGoneIds` on that table, which is the correct,
  safe behavior; not treating this as a defect, just naming it as something I deliberately did
  not add extra validation for, since the existing "does it currently exist" check already
  handles it safely).

## Known risks

- `ManifestRecordingSink` adds one extra method-call layer around every real upsert during a
  real run; it performs zero extra I/O beyond what `dataSink.ts` already does (confirmed by
  reading the implementation — no additional client, no additional query). Given this
  project's scale (item 25: one small volunteer team, run at most twice), this is not a
  performance concern.
- The `newProjectUrl` mismatch guard in `performTeardown` is a hard refusal with no override
  flag. If George ever legitimately needs to run teardown against a manifest whose recorded
  URL doesn't match current env (e.g., a project URL rotation), this refuses rather than warns.
  I judged hard-refuse safer for a delete path and did not add a bypass flag, since the packet
  frames this whole task around not deleting the wrong thing.
- I did not add `.gitignore` coverage for the default manifest output directory — see
  "Deferred" above.

## Commands run

```
git worktree add <scratchpad path> -b claude/t063b-manifest-teardown origin/claude/t063-file-source
ln -s <shared repo>/node_modules <worktree>/node_modules   # local only, not committed
npx vitest run scripts/migrate/manifest.test.ts scripts/migrate/teardown.test.ts
npx vitest run scripts/migrate/
npx tsc --noEmit --strict --target ES2022 --module ESNext --moduleResolution Bundler \
  --allowImportingTsExtensions --skipLibCheck --lib ES2022,DOM,DOM.Iterable \
  scripts/migrate.ts scripts/migrate/*.ts   (standalone, bonus check -- see Gate 1)
npx tsc --noEmit
npx vite build
npm run format:check
npx prettier --check scripts/migrate/*.ts scripts/migrate.ts   (transparency, out of scope glob)
npx eslint .
npx eslint scripts/migrate/ scripts/migrate.ts
npx vitest run
node --experimental-strip-types scripts/migrate.ts --help
node --experimental-strip-types scripts/migrate.ts --fixture --dry-run --cutover-date=2026-02-01
node --experimental-strip-types scripts/migrate.ts --teardown=<missing> --dry-run
node --experimental-strip-types scripts/migrate.ts --teardown=<path> --fixture
env -i PATH="$PATH" node --experimental-strip-types scripts/migrate.ts --teardown=<valid manifest, no env vars> --dry-run
env -i PATH="$PATH" NEW_SUPABASE_URL=... NEW_SERVICE_ROLE_KEY=... node --experimental-strip-types scripts/migrate.ts --teardown=<manifest recorded against a different URL> --dry-run
git add scripts/migrate.ts scripts/migrate/dataSink.ts scripts/migrate/manifest.ts \
  scripts/migrate/manifest.test.ts scripts/migrate/teardown.ts scripts/migrate/teardown.test.ts \
  docs/swarm/active/T063b-worker-output.md
git commit -m "..."
git push -u origin claude/t063b-manifest-teardown
```

## Whether I am filing a dispute

**No dispute on the created-vs-matched question** — the packet's own conditional permission
for `dataSink.ts` anticipated exactly the problem I found, and the additive fix stayed inside
that permission without needing `core.ts` or `types.ts`, which were not in the Allowed Files.

**One citation discrepancy worth recording, not disputing.** The packet states the two owner
quotes ("test migration while testing... then drop all data", "keep my accounts", "keep Test
student account...") are "both recorded in `docs/swarm/auto-mode-decisions.md` (2026-08-01)"
and instructs reading that file's last three sections before writing code. I read the full
file (both at the branch point `origin/claude/t063-file-source` and at the current tip of
`main` — byte-identical) and grepped it for `migration|teardown|guardian|Test student|keep my
accounts|manifest`: no match beyond incidental/unrelated hits (a different task's fixture
containing the substring "test student", and mentions of "migration" meaning *database schema*
migrations, constitution item 10's sense). The file's last three sections (T304, T203's
item-19a ruling, T305) do not mention this task, migration/teardown, or the owner's accounts at
all. This does not change what I built — the actual requirements were stated directly and
unambiguously in the prompt itself, and I built to those — but I'm not treating an unverified
citation as verified per constitution item 19c ("verify your own citations before
submitting"), and the packet did specifically invite filing a dispute if something in it were
wrong. I'm recording this as a citation discrepancy for the checker/foreman to resolve (maybe
the quotes exist in a channel this repo doesn't capture, or the entry hasn't been written yet)
rather than filing a formal dispute, since it doesn't block or change the engineering work.
