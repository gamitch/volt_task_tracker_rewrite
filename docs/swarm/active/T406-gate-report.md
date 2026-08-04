# T406 premise-gate report — packet v1 "narrow the write" (d2d160e, rebased on main fa93516)

Gate: checker-premise (re-dispatch; prior instance died without a verdict — this run started clean).
Date: 2026-08-04. All evidence re-derived by execution in this gate's own worktree
(`claude/t406-gate`), constitution items 19/19c/23 observed. Scratch PostgreSQL 16 stood up in the
session scratchpad on port 55432, migrations loaded from this repo, shut down after use; tree left
with only this report added.

# Dispatch Verdict

**REVISE** — round 1 of item 19a's two. The load-bearing §6 premise is TRUE and proven by
execution (below), every §4 schema claim holds, and the design is the right one — but §1 carries a
false blast-radius claim (three `markDayComplete` call sites, not one) and C2's named mutation
cannot distinguish the outcome test this task exists for from the shape assertion it explicitly
forbids. Both have exact prescribed edits in the last section; nothing else blocks.

# Severity

MAJOR (two), MINOR (four), NIT (one). No BLOCKER: the §6 claim the task rests on is CONFIRMED.

# Evidence Inspected

- Files:
  - `docs/swarm/active/T406-worker-packet.md` (the artifact under review)
  - `docs/swarm/constitution.md` items 18/19/19a-c/20-26; `docs/swarm/auto-mode-decisions.md:2712-2759`
  - `src/lib/supabase/loaders/outreach.ts:1186-1333` (target upsert `:1258-1275`; rsvps decoys `:1194`, `:1535`; T327 ordering `:1296-1328`)
  - `src/pages/outreach/MarkDayCompleteDialog.tsx:762-840` (both row builders), `:1082-1123` (handleSubmit), `:936` (default `onMarkComplete = markDayComplete`)
  - `src/pages/outreach/MarkEventCompleteDialog.tsx:234` (imports `markDayComplete`), `:460` (default `onMarkSessionComplete = markDayComplete`), `:320-347` (bulk payload builder)
  - `src/pages/outreach/OutreachDetail.tsx:2484-2498` (third call site: page-level `onMarkComplete` wrapper `await markDayComplete(payload)`)
  - `src/pages/outreach/MarkDayCompleteDialog.test.tsx:50-58` (the `vi.mock` partial mock), `:1268-1376` (loader-level tests)
  - `src/pages/outreach/MarkEventCompleteDialog.test.tsx:114` (documents its own absence of `vi.mock`), `:886-1039` (payload-level assertions incl. `checkInAt` at `:1029`)
  - `src/lib/supabase/loaders/attendance.ts:117-199` (W1's payload-omission precedent + T403 gate history), `:466-499` (`makeSetAttendanceStatus`)
  - `node_modules/@supabase/postgrest-js/package.json` (v2.110.7), `src/PostgrestQueryBuilder.ts:1360-1421` (upsert request construction)
  - PostgREST server source `src/PostgREST/Query/QueryBuilder.hs` — scratchpad copy AND independently re-fetched upstream v13.0.7; the load-bearing line is byte-identical in both
  - `supabase/migrations/20260717000000_scheduling_attendance.sql:82-95`, `20260803000000_simplify_attendance_audit.sql:68-83`
  - `docs/swarm/task-ledger.md:240-246` (T305/T307/T309), `:789` (T327), `:802` (T406); `docs/swarm/verification-log.md:7000,7334,7398` (sha256 precedent)
- Commands: scratch PG16 (`initdb`/`pg_ctl` as the `postgres` user, port 55432, data dir in the
  session scratchpad, stopped after), `psql` migration loads + 7 experiments (E1-E7 below),
  `curl` of upstream QueryBuilder.hs, `git log/diff/merge-base` on the packet's base SHA,
  `npx tsc --noEmit` (exit 0), full `npx vitest run` (**78 files / 1951 tests, all pass**).
- Outputs: pasted inline below.

# §6 — the load-bearing premise, PROVED BY EXECUTION

Scratch DB: PostgreSQL 16.13, this repo's real migrations (`identity_roster`,
`scheduling_attendance`, `support_audit`, `simplify_attendance_audit` — a 3-line stub `auth`
schema for the Supabase-managed dependency). `\d public.attendance` matched
`20260717000000:82-95` exactly, with `trg_attendance_touch_updated_at BEFORE INSERT OR UPDATE`
present.

**What the client actually sends** (`@supabase/postgrest-js` v2.110.7 — installed source, not
docs): `.upsert(rows, { onConflict })` issues `POST` with `Prefer: resolution=merge-duplicates`,
`on_conflict=<cols>` (`PostgrestQueryBuilder.ts:1393-1395`), and for an array body sets
`columns=` to the **union of `Object.keys` across all rows** (`:1403-1409`). `defaultToNull`
defaults true → no `Prefer: missing=default`.

**What the server generates from that** (PostgREST `QueryBuilder.hs`, `mutatePlanToQuery`,
verified byte-identical against upstream v13.0.7):
`DO UPDATE SET c = EXCLUDED.c` **only for `iCols`** — the payload-derived column list. An unsent
column never appears in `SET`. Missing keys on individual rows read as NULL from
`json_to_recordset` (no `missing=default`).

**E1 — conflict path preserves the unsent column.** Row seeded with `check_in_at =
2026-08-04 14:07:33+00`, `method = 'qr'`; the narrowed upsert (columns
`session_id,student_id,status,hours_override,method,recorded_by`) run in PostgREST's exact shape:

    check_in_at             | method | recorded_by            | updated_at_after              | trigger_bumped_updated_at
    2026-08-04 14:07:33+00  | coach  | ...c0ac                | 2026-08-04 04:21:50.758965+00 | t

`check_in_at` **survived**. (`method` went `qr`→`coach` in the same run — §5's residual, observed
live, correctly bounded by the packet.)

**E2 — the `updated_at` trigger fires on the UPDATE leg.** `updated_at` moved
`04:21:50.704679` → `04:21:50.758965` across the conflict-path update; `trigger_bumped_updated_at = t`.
And in E4, an explicitly-sent stale `updated_at: 2026-08-04T04:30:00Z` was overwritten by the
trigger to `04:22:33.266828` — §4's "dead weight the trigger overwrites anyway" is literally true.

**E3 — `method` genuinely cannot be dropped.** Method-less narrowed upsert:

    ERROR:  null value in column "method" of relation "attendance" violates not-null constraint

**Stronger than the packet claims**: it failed on the INSERT leg (no prior row) **and** on the
pure conflict leg (row exists) — PostgreSQL checks NOT NULL on the candidate insert tuple before
conflict arbitration. §4's "dropping it breaks every INSERT" is understated in the safe direction.

**E4 — the defect claim, reproduced.** The CURRENT full-column payload
(`outreach.ts:1261-1271` shape) with the dialog's stale pre-scan snapshot:
`before_bug = 2026-08-04 14:07:33+00` → `after_bug = NULL`. §1's bug is real.

**E5 — the batch-uniformity trap, reproduced.** Heterogeneous batch (row A omits `check_in_at`,
row B includes it) under the union-columns semantics the installed client actually produces:

    student_id ...aa | check_in_at NULL  | A CLOBBERED by union-columns null-fill
    student_id ...bb | 2026-08-04 15:00:00+00

§4's trap is real, and its mechanism is pinned to `PostgrestQueryBuilder.ts:1403-1409`.

**E7 — the fix as shipped, end to end.** Uniform narrowed batch, A on the conflict leg, B on the
insert leg:

    who | status  | check_in_at            | hours_override | method | updated_at_set
    aa  | present | 2026-08-04 14:07:33+00 | 2.5            | coach  | t
    bb  | present | NULL                   | NULL           | coach  | t

A's scan survived; B's fresh row is correct (NULL check-in for a coach-marked student who never
scanned; trigger-set `updated_at`).

# Claim-by-Claim Verdicts

- §1 full-column payload under `onConflict: 'session_id,student_id'` — **CONFIRMED** (`outreach.ts:1258-1275`; all nine columns exactly as listed).
- §1 TOCTOU (load once on open, submit the snapshot) — **CONFIRMED** (`MarkDayCompleteDialog.tsx:1044` load effect; `:1088` snapshot at submit; E4 reproduces the loss).
- §1 "**Its only caller** does a read-modify-write (`MarkDayCompleteDialog.tsx`)" — **FALSE**. Three call sites: `MarkDayCompleteDialog.tsx:936` (default prop), `MarkEventCompleteDialog.tsx:460` (default `onMarkSessionComplete`), `OutreachDetail.tsx:2484-2498` (page wrapper). The safety conclusion survives — every path originates in a dialog that carries recorded values (T305/T307) — and the narrowing protects the bulk path's identical race too, but the blast-radius statement is wrong. **MAJOR-1.**
- §3 owner decision, quote and reasoning — **CONFIRMED** (`auto-mode-decisions.md:2712-2759`, the file's last entry).
- §4 schema table — **CONFIRMED** on all four rows (migration `:82-95` + E1/E2/E3/E4). `method` row understated (breaks BOTH legs, per E3).
- §4 batch-uniformity trap — **CONFIRMED by execution** (E5).
- §6's premise (narrowed column list leaves unsent columns untouched on the conflict path, as the installed client actually behaves) — **CONFIRMED by execution** (E1/E7 + client source + server source).
- §5 residual (`method: 'qr'` still clobberable; `check_in_at` survives) — **CONFIRMED and correctly bounded** (E1 shows both halves in one run).
- §7 T305/T307/T309/T327 — **all CONFIRMED** (ledger `:240/:242/:244/:789`; code cited above; T327 ordering live at `outreach.ts:1296-1328`).
- §9 harness facts — **CONFIRMED as to which file is which**: `MarkDayCompleteDialog.test.tsx:50` has the partial `vi.mock`; `MarkEventCompleteDialog.test.tsx:114` documents having none. The T309 inversion is not repeated. But "**four** existing tests already assert the call" is **stale** — ~9 tests assert the seam call today (`:680,:695,:707,:729,:772,:806,:843,:962,:983`); the "four" is T309's era count copied forward. MINOR.
- Baseline "78 files / 1944 tests" — **PARTLY TRUE**: 78 files confirmed; this gate measured **1951 tests** on fa93516+docs (tsc 0 confirmed). 1944 was main at 2a8f237, before the seven merges. Packet says re-measure, so orientation-only. MINOR (same root as the stale base).
- "main moved seven times on 2026-08-03" — **CONFIRMED with a caveat**: exactly 7 first-parent merges land in `2a8f237..fa93516`; but 17 merges on main carry the 2026-08-03 date in total. The packet's meaning (7 since its baseline) is right.
- Dispatcher's pre-verified claim of three `onConflict: 'session_id,student_id'` upserts in `loaders/outreach.ts` — **CONFIRMED**: `.upsert(` at `:1194` (`rsvps`, `makeSubmitRsvpChange`), `:1260` (`attendance`, `makeMarkDayComplete` — the target), `:1535` (`rsvps`, expected-attendee reconciliation). The two `rsvps` ones are out of scope — different table, no `check_in_at`/`check_out_at` columns (`20260717000000:67-76`).

# Feasibility Verdicts

- Narrow the DB payload map inside `upsertAttendance` (drop `check_in_at`/`check_out_at`/`updated_at` keys, uniformly) — **possible as specified**, no escalation. Proven by E1/E7; exact in-repo precedent: W1's `makeSetAttendanceStatus` payload-omission (`attendance.ts:466-499`, T403-gate-verified the same way).
- Keep `method`/`status`/`recorded_by`/`hours_override` — **required**, per E3 (`method`) and §4.
- No migration, no dependency, no build change needed. `MarkDayCompleteDialog.tsx` likely needs **no** edit (§2's conditional is correctly conditional): the narrowing lives entirely in the loader's snake_case mapping. **The camelCase `OutreachAttendanceWriteRow`/`AttendanceWriteRow` types must KEEP `checkInAt`/`checkOutAt`** — forbidden-file green tests assert them at the payload level (`MarkEventCompleteDialog.test.tsx:1025-1030`, `OutreachDetail.test.tsx`), and C6 depends on `buildAttendanceWriteRows` still returning them. Feasible, but make it explicit (Required Revision 3).
- C6 by sha256 — **possible**; precedent `task-ledger.md:244` / `verification-log.md:7334`.

# Conflicts With Shipped Work

- **No reversal of any passed task.** T305's timestamp-carrying becomes redundant-but-unbroken (the builders still carry; the loader stops sending) — exactly what the owner's decision anticipates ("retires work T305 had to add"). T307's block-on-failure, T309's absence rows, T327's ordering all untouched by the prescribed change.
- **No green test outside the Allowed Files breaks.** The only existing DB-payload-shape assertion with `check_in_at` is `MarkDayCompleteDialog.test.tsx:1304-1318` (Allowed; worker updates it — flag to the worker, since `expect.objectContaining({check_in_at: null})` will genuinely redden when the key disappears). `MarkEventCompleteDialog.test.tsx` and `OutreachDetail.test.tsx` assert only the camelCase payload, which the narrowing does not touch. `attendance.test.ts:264-279` asserts W1's separate function.
- Frozen scope respected: no migration (§5 = owner ruling), W1's `attendance.ts` untouched.

# Unverifiable Acceptance Criteria

- **C2 (MAJOR-2).** The criterion's outcome is real and testable, but its named mutation —
  "re-add `check_in_at` to the payload" — also turns a **C1-style shape assertion** red, so it
  cannot force the race simulation the criterion text demands. A worker can satisfy C1+C2 with
  one payload-keys assertion and both mutations pass the letter of §8. This is the exact
  "passes for the wrong reason" trap the packet itself names. Fix prescribed below.
- **C3 (MINOR).** "must fail on the `not null` violation" cannot literally happen in the vitest
  harness — no Postgres is present to raise 23502. The DB-level half is this gate's E3; the
  test-level half should be reworded (below).
- C1, C4, C5, C6, C7 — all measurable with today's fixtures and tooling; each named mutation
  genuinely discriminates (C7's order tests already exist at `outreach.test.ts:474,:520`).

# Cheaper Paths Available

None cheaper — the prescription **is** the repo's established cheapest mechanism. W1's
`makeSetAttendanceStatus` (`attendance.ts:466-499`) is the same payload-omission fix on the same
table, T403-gate-proven on a real PG16 DB, and `attendance.ts:163-174` records why omission beats
read-modify-write (no extra round trip, no TOCTOU window). The packet should cite it as precedent
(NIT), but specifies nothing more expensive than it.

# Required Revisions

1. **(MAJOR-1) §1, replace the "only caller" sentence.** Suggested text: "`markDayComplete` has
   three call sites — `MarkDayCompleteDialog.tsx:936` (default prop), `OutreachDetail.tsx:2484-2498`
   (the page wrapper that composes the refetch), and `MarkEventCompleteDialog.tsx:460` (bulk mode's
   `onMarkSessionComplete` default). All three originate in dialogs that carry recorded values
   through (T305/T307), so nothing is lost in normal use on any path — and the narrowing closes the
   same load-once/write-later race in bulk mode for free. The worker's output must state that the
   bulk path flows through the narrowed write and confirm `MarkEventCompleteDialog.test.tsx` stays
   green with zero edits (it asserts the camelCase payload, which does not change)."
2. **(MAJOR-2) §8 C2, make the mutation discriminate.** Require C2's test to drive
   `makeMarkDayComplete` (or the dialog) against a **stateful fake client** whose `upsert` models
   the proven semantics: merge into an in-memory row store using the **union of keys across the
   batch** (missing key → NULL — E5's semantics), and assert the **post-write row state**
   (`store` row's `check_in_at` still equals the mid-race scan time), never the call args. Add a
   second named mutation only an outcome test catches: "map absence rows (or any subset of rows)
   with the `check_in_at` key re-added while the rest stay narrowed — the union-columns fake
   null-fills the scanned row and C2 must go red." Checker instruction: verify C2's assertion
   reads fake-DB state, not `mock.calls`.
3. **(MINOR) §4/§2, one sentence:** "Narrow the snake_case DB mapping inside `upsertAttendance`
   ONLY. The camelCase `OutreachAttendanceWriteRow`/`AttendanceWriteRow` types and both row
   builders keep `checkInAt`/`checkOutAt` — forbidden-file tests assert them at the payload level
   (`MarkEventCompleteDialog.test.tsx:1025-1030`) and C6 requires it."
4. **(MINOR) Branch base:** change `from 2a8f237` to current `main` (`fa93516` or later). The seven
   intervening merges touch no in-scope file (verified: empty `git diff --stat` over all six
   relevant paths), but a fresh base keeps the six gates and C6's hash comparison unambiguous;
   record the exact `main` SHA C6 is compared against.
5. **(MINOR) §9:** "four existing tests" → "several (9 at last count)"; §8 C3: replace "must fail
   on the `not null` violation" with "must turn red on the INSERT-leg row assertion (the fake's
   inserted row carries no `method`); the DB-level `not null` proof is the gate's E3, quotable in
   the worker output."
6. **(NIT) §6/§4:** cite `attendance.ts:466-499` + module doc #5 as the shipped precedent, and note
   the gate's stronger E3 result (method-less upsert fails on BOTH legs, so no future
   "conflict-path-only" shortcut is available either).

Round 1 of 2 (item 19a). Everything above is prescribed precisely enough to fold into packet v2
without re-derivation; nothing in the §6 premise needs revisiting — it is proven.
