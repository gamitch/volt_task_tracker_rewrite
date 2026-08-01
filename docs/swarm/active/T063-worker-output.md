# T063 Worker Output — JSON-file old-data source for the migration ETL

Branch: `claude/t063-file-source`, off `origin/main` at `9c8af9378b4ceffd62e10e92d77becb516648540`
("T305 + T307 — mark-complete shows recorded attendance, and stops destroying
it (#18)") — later than the `1aede0c` floor named in the prompt.

Worked in an isolated worktree at
`/tmp/claude-0/-home-user-volt-task-tracker-rewrite/f07aff68-1e9a-51d1-a45c-ac88b7b5b3ed/scratchpad/t063-worktree`
(constitution item 23); the shared checkout's HEAD was never touched.

## Files changed

- `scripts/migrate/jsonFileSource.ts` (new) — `JsonFileOldDataSource`, one
  class implementing `OldDataSource` by reading `teams.json`, `students.json`,
  `events.json`, `event_sessions.json`, `session_attendance.json`,
  `app_settings.json` from a directory. Each `list*` method reads its file,
  parses it as JSON, confirms the result is an array, and returns the rows
  exactly as read (same "no coercion, transform layer owns mapping" contract
  as `SupabaseOldDataSource`). `getAppSettings()` additionally requires the
  parsed array to have exactly one element (app_settings is a singleton
  table) and returns that one row as-is. Every failure mode names the exact
  file and the problem: missing file, unreadable file, invalid JSON,
  JSON that parses but isn't an array, and (for app_settings only) an array
  with zero or more-than-one rows. Nothing in the class ever writes to the
  source directory.
- `scripts/migrate/jsonFileSource.test.ts` (new) — 7 vitest tests: a
  well-formed directory (asserts every table is returned unmodified), a
  missing file, a non-array file, invalid JSON, `app_settings.json` with
  zero rows, `app_settings.json` with two rows, and a read-only-contract
  check (directory listing unchanged after all six reads).
- `scripts/migrate.ts` — CLI wiring only, per the Allowed Files scope:
  - New `--from-dir=<path>` flag, parsed into `CliArgs.fromDir`.
  - New branch in `main()`: `--fixture` and `--from-dir` together is now a
    hard error (`process.exit(1)`) before anything else runs.
  - `--from-dir` builds `source = new JsonFileOldDataSource(args.fromDir)`.
    `OLD_SUPABASE_URL` / `OLD_SERVICE_ROLE_KEY` are never read in this
    branch.
  - Sink selection under `--from-dir`: if `--dry-run` is also set, the sink
    is `InMemoryNewDataSink` (same one `--fixture` mode already uses) so a
    dry run needs **zero** env vars, matching this task's explicit
    requirement. If `--from-dir` is used **without** `--dry-run` (a genuine
    write), the sink is the real `SupabaseNewDataSink`, which still requires
    `NEW_SUPABASE_URL` / `NEW_SERVICE_ROLE_KEY` — a real run has to write
    somewhere real; only the *old*-side connection is replaced by the file
    source. This distinction, and why it doesn't contradict "no env vars for
    dry run", is documented inline in `migrate.ts`.
  - Help text and the file's top-of-file usage-examples comment updated to
    document the new flag.
- `docs/swarm/active/T063-worker-output.md` (this file).

`scripts/migrate/dataSource.ts` was **not** touched — the existing
`OldDataSource` interface (all six methods) was sufficient as-is;
`JsonFileOldDataSource` implements it directly, matching how `fixtures.ts`'s
`FixtureOldDataSource` already does.

Nothing under `src/` or `supabase/` was touched.

## Why the sink choice for `--from-dir` + non-dry-run isn't a scope overreach

The task only asked for the *old-project* side to be file-backed; the
new-project write side (`NewDataSink`) is untouched — `SupabaseNewDataSink`
is still exactly what a real `--from-dir` run (no `--dry-run`) uses. The one
place `InMemoryNewDataSink` gets reused for `--from-dir` is specifically
when `--dry-run` is also set, which is required by the prompt's explicit
"`--dry-run` must work with `--from-dir` and no env vars at all" — the
existing `SupabaseNewDataSink` cannot satisfy that even in dry-run mode,
because `dataSink.ts`'s `idUpsert`/`compositeKeyUpsert`/`upsertTeams`
helpers all perform a real `select` against the new project (to compute
accurate created-vs-existing counts) *before* the dry-run gate skips the
write — so a live NEW-project connection would still be required. Reusing
the in-memory sink for the dry-run path was the only way to meet that
explicit "no env vars at all" requirement without inventing a new,
unspecified sink type.

## Real dry-run report against George's actual export (`/tmp/oldexport/`)

Command run exactly as specified:

```
node --experimental-strip-types scripts/migrate.ts --dry-run --from-dir=/tmp/oldexport --cutover-date=2026-08-01
```

Also re-run with a fully empty environment (`env -i PATH="$PATH" node ...`)
to confirm the "no env vars at all" requirement — identical report, no
env-var errors.

Full, verbatim report (nothing trimmed):

```
************************************************************************
* FILE MODE
* Reading old-project tables from /tmp/oldexport (George's Lovable Cloud SQL-editor
* export -- see this task's worker report). OLD_SUPABASE_URL /
* OLD_SERVICE_ROLE_KEY are not required: the old project has no service-role key
* to obtain (Lovable Cloud keeps Postgres inside its own platform), so this file
* is the real MIG-04 source, not a stand-in for a live connection.
************************************************************************
========================================================================
VOLT migration report -- DRY RUN (nothing written)
Cutover date: 2026-08-01
========================================================================

Per-table counts:
  teams            : 4 created, 0 existing (of which 0 unmatched-archived)
  seasons          : 1 created, 0 existing
  students         : 20
  events           : 16
  event_sessions   : 117
  rsvps            : 254
  attendance       : 79

Unmatched teams (0):
  (none)

Unparseable times (0):
  (none)

Attendees-backfill mismatches (0):
  (none)

========================================================================
```

(There is no "Orphaned session_attendance rows" section at all — `report.ts`
only prints it when the count is `> 0`, so its absence here means the count
is exactly 0.)

## Cross-check against the independently-measured figures in the prompt

All eight match exactly — **no disagreement to raise**:

| Claim in the prompt | Report / independent script | Match |
|---|---|---|
| `session_attendance` splits 254 `planned=true` → rsvps | `rsvps : 254` | matches |
| 79 `planned=false` → attendance | `attendance : 79` | matches |
| those 79 rows total 341.75 hours | computed directly from `/tmp/oldexport/session_attendance.json` (`planned===false` rows summed): `341.75` | matches |
| every student's `team_affiliation` matches a real team; zero unmatched | `Unmatched teams (0)` | matches |
| zero attendance rows reference an unknown student or missing session | no "Orphaned session_attendance rows" section printed (count 0) | matches |
| `Indycar Race` `attendees[]` holds 7 ids, all 7 covered | `events.json`: `Indycar Race` → `attendees.length === 7`; `Attendees-backfill mismatches (0)` confirms all 7 are covered by session rows | matches |
| 4 students with no activity: Aubrie, Aspen, Olivia S., Olivia A. | computed directly from `students.json` minus every `student_id` appearing in `session_attendance.json`: exactly `['Aubrie', 'Aspen', 'Olivia S.', 'Olivia A.']` | matches |

The two figures not printed by `printReport()` itself (the 341.75-hour total
and the 4 no-activity student names) were checked with small one-off Node
snippets reading the same `/tmp/oldexport/*.json` files directly — shown
below for reproducibility, not committed anywhere (throwaway, run from the
shell, not saved as files):

```js
// hours total for planned=false rows
const att = require('/tmp/oldexport/session_attendance.json');
att.filter(a => a.planned === false).reduce((s, a) => s + Number(a.hours || 0), 0);
// => 341.75

// students with zero attendance rows
const students = require('/tmp/oldexport/students.json');
const withActivity = new Set(att.map(a => a.student_id));
students.filter(s => !withActivity.has(s.id)).map(s => s.name);
// => [ 'Aubrie', 'Aspen', 'Olivia S.', 'Olivia A.' ]
```

## Additional CLI behavior verified

- `--from-dir` + `--dry-run` with a fully empty environment (`env -i`):
  succeeds, identical report, no env-var errors.
- `--fixture` + `--from-dir` together: exits 1 with
  `Error: --fixture and --from-dir are mutually exclusive -- pick one old-project source.`
- `--from-dir=/tmp/does-not-exist` (missing directory): fails loudly —
  `Error: Old project (--from-dir): failed to read /tmp/does-not-exist/teams.json: ENOENT: no such file or directory, open '/tmp/does-not-exist/teams.json'`,
  process exits with a nonzero code (`1`), not a clean-looking empty report.

## Gates (`.env.local` absent throughout; confirmed with `ls .env.local` → not found)

All run from the worktree root.

1. **`npx tsc --noEmit`** — exit 0, zero errors. (Note: `tsconfig.json`'s
   `include` is `["src", "vite.config.ts"]` — confirmed via
   `npx tsc --noEmit --listFiles | grep -c scripts/migrate` → `0` — so this
   gate does not, and did not before this task, type-check `scripts/migrate/**`
   at all; this is a pre-existing, documented condition of this file tree,
   not something this task changed.)
2. **`npx vite build`** — exit 0, `✓ built in 5.41s`. One pre-existing
   `(!) Some chunks are larger than 500 kB` advisory warning, unrelated to
   this change (main `index-*.js` bundle), present on `origin/main` before
   this task too.
3. **`npm run format:check`** — exit 0, "All matched files use Prettier
   code style!". Note: this script's glob (`src/**/*.{ts,tsx}` plus root
   `*.{ts,js,json,html}`) does not cover `scripts/**` at all, so it never
   touched the new/changed files either way. For transparency: I ran
   `npx prettier --check scripts/migrate/*.ts scripts/migrate.ts` directly
   and 8 of the (now 9, including my 2 new/1 changed) files report as
   non-default-Prettier-formatted, including 6 pre-existing files
   (`core.ts`, `dataSink.ts`, `report.ts`, `transform.ts`,
   `verify-fixture.ts`, plus `migrate.ts` itself before my edits) — this
   entire directory has never conformed to default Prettier width/style and
   is simply out of `format:check`'s scope; I matched the file's existing
   line-length/style conventions rather than introducing a second style
   within the same files.
4. **`npx eslint .`** — 0 errors, **361 warnings** (all
   `react-refresh/only-export-components` in unrelated `src/pages/**` files
   with mixed component+helper exports). Confirmed via `git stash` that
   `origin/main` at `9c8af93` (before this task's changes) also reports
   exactly 361 warnings / 0 errors with the identical command — **no rise**.
   Grepped the full output for `jsonFileSource` and `migrate.ts`: zero
   matches, i.e. the new/changed files produced no warnings or errors of
   their own.
5. **`npx vitest run`** — **73 files / 1784 tests, all passed**, exit 0.
   The prompt's stated base ("72 files / 1746 tests") does not match this
   branch's actual pre-change baseline — confirmed via `git stash` that
   `origin/main` at `9c8af93` (this task's actual starting point) is
   **72 files / 1777 tests**, not 1746. The delta this task introduces is
   exactly **+1 file / +7 tests** (`1777 + 7 = 1784`), matching the 7 new
   `jsonFileSource.test.ts` cases with nothing else added or altered. I'm
   flagging this per the prompt's own instruction to challenge a number
   that doesn't match — the 1746 figure is stale (main has moved since it
   was written), not a discrepancy introduced by this task.

## Known risks

- `getAppSettings()`'s "exactly one row" validation is strict by design
  (per the task spec) — if George's export tooling ever produces a
  differently-shaped `app_settings.json` (e.g. wrapped in an extra object
  instead of a one-element array), this will fail loudly rather than guess,
  which is the intended behavior but does mean any future re-export must
  keep the same `json_agg(...)` shape.
- The CLI's non-dry-run `--from-dir` path (a genuine write using file-backed
  old data) is wired and consistent with the rest of `migrate.ts`'s
  structure, but this task's testing focused on the `--dry-run` path per the
  prompt's explicit ask — a real (write) run was not executed against any
  new project (there is no reachable `NEW_SUPABASE_URL` in this sandbox
  either), consistent with constitution item 16's human-gate requirement
  that cutover itself needs George's explicit sign-off, not a worker's.

## Deferred — for the ledger

None identified. This task's Allowed Files list was sufficient to implement
the full spec (`dataSource.ts` did not need to change); no defect or
out-of-scope wiring gap was found that needs a follow-up task per
constitution item 20.

## Commit

Committed to `claude/t063-file-source` and pushed to `origin`. SHA recorded
in the final response to the dispatcher (not self-certified — checker
verifies against the actual pushed commit, per constitution item 21).

## Dispute

None. The spec was implementable as written; no premise disagreement found.
