# T402 — worker packet v1: the second `queryAttendanceForSessions` truncates silently

**Tier: STANDARD** (constitution item 26). **Stated and defended:** single module
(`loaders/outreach.ts`), **no write path**, and it rolls out a pattern already built, reviewed and
merged as T320 — item 19b explicitly says a light check or skipped gate is right for *"applying a
proven pattern to a second surface."* The orchestrator replays every mutation; no separate checker
round.

**Escalate to HEAVY if** the implementation turns out to need anything beyond copying T320's shape —
in particular if `.order('id')` cannot be applied because the select list omits `id` (see §4, which
is the one real risk in this task).

**Filed by:** W1 (`claude/w1-checkin`), ledger row **T402**, which records *"W2 executes."*
**Branch:** `claude/t402-outreach-truncation`, from `dcd0dae`.

---

## 1. The defect

`loaders/outreach.ts` declares its **own** file-local `queryAttendanceForSessions` — unrelated to the
identically-named function in `loaders/attendance.ts`:

```ts
const result = await client
  .from('attendance')
  .select('session_id, student_id, status')
  .in('session_id', [...sessionIds]);        // no .range(), no .order()
```

PostgREST caps responses at `supabase/config.toml`'s `[api] max_rows = 1000` and returns **200 with a
partial `Content-Range`** — not an error. `createLoader` throws only on `result.error`, so a
truncated array resolves and every caller reads it as complete.

**T320 fixed the `attendance.ts` one and named only that one.** This duplicate has carried the
identical defect since it was written, and neither T307's checker nor T320's own row spotted it.

**Cite this function by symbol, never by line.** The ledger row says `:745-754`; it was at `:766` when
this packet was written. It has moved under T193/T309/T327 and will move again. **Grep the name.**

**There are two functions with this name and two more same-name collisions on this path** — two
`upsertAttendance` (one in `attendance.ts`, one file-local here) and two `AttendanceRecordState`. W1
miscounted call sites because of exactly this. **Check what each grep hit actually is.**

---

## 2. Allowed Files

```
src/lib/supabase/loaders/outreach.ts
src/lib/supabase/loaders/outreach.test.ts     (create if absent — see §5)
```

**Forbidden:** `src/lib/supabase/loaders/attendance.ts` — **W1's file. Read it, copy its shape,
never modify it.** Also `src/pages/checkin/**`, `LiveConsole.tsx`, `Kiosk.tsx` (W1),
`src/pages/home/**` (W5), `pages/reports/**`, `loaders/reports.ts` (W4).

---

## 3. What to build

Copy T320's shape from `makeLoadAttendanceForSessions` (`loaders/attendance.ts:303-372`). **Read that
function and the T320 entry in `verification-log.md:6706` before writing anything** — two parts of it
are load-bearing and must be taken rather than re-derived:

- **`.order('id', { ascending: true })` is load-bearing, not cosmetic.** Page N+1 is an offset into a
  result set, and Postgres guarantees **no** ordering without an explicit `order by` — paginating an
  unordered query can return one row twice and never return another. `id` is the table's uuid primary
  key.
- **Throw at the page bound rather than returning what was gathered.** T320 uses
  `ATTENDANCE_MAX_PAGES = 100` and throws on exhaustion. Returning a partial set reintroduces exactly
  the silent truncation being removed.

---

## 4. The one real risk — check this FIRST, before writing any code

**The current select list is `'session_id, student_id, status'`. It does not include `id`.**

`.order('id')` orders by a column; PostgREST can order by a column that is not selected, but **verify
that**, do not assume it. Then decide, and state which you chose and why:

- **(a)** order by `id` without selecting it, if that works; or
- **(b)** add `id` to the select list, and confirm nothing downstream breaks on the extra field —
  `AttendanceDbRow`'s type, its mapper, and every consumer of this loader.

**If neither works cleanly, stop and raise it rather than inventing a third ordering key.** An
ordering column that is not unique does not fix the pagination problem — it re-creates it. This is
the single most likely place for this task to go wrong, and it is why the tier escalates if the copy
is not clean.

---

## 5. Test seam

`loaders/outreach.ts` has **21 of 23 exports untested** (that is open row **T165**). Check whether
`outreach.test.ts` exists and what it covers before assuming a harness. `attendance.test.ts` landed
with T320 on current main — **read it first**; it is the closest model for testing exactly this
pattern, and reusing its shape is cheaper and more consistent than inventing one.

**This function is file-local, not exported.** Decide and state how you test it: export it, test
through its public caller, or inject the client. **Do not export something solely to test it without
saying so** — that is an API change, and item 20 requires deliberate decisions to be recorded rather
than left implicit.

---

## 6. Acceptance criteria — each names a mutation that must turn it red

| # | Criterion | Mutation |
|---|---|---|
| **C1** | A result set larger than one page returns **all** rows, not the first page | remove the pagination loop — return the first page only |
| **C2** | Pages are ordered by `id` | delete `.order('id', ...)` — must fail on a duplicate/missing row across pages, **not** merely on call-shape |
| **C3** | Exhausting the page bound **throws** rather than returning a partial set | replace the throw with `return rows` |
| **C4** | A short page terminates the loop (no extra request) | remove the `< PAGE_SIZE` break — assert the **request count**, not just the rows |
| **C5** | An error from any page propagates | swallow the error and return `[]` |

**C2 is the criterion most likely to be written vacuously.** Asserting *"`.order` was called"* proves
nothing about correctness — it is a call-shape assertion, the exact "passes for the wrong reason"
shape this repo has shipped 7+ times. Assert the **observable consequence**: build a fake whose pages
overlap when unordered, and prove a row is duplicated or lost without the ordering.

---

## 7. Required worker output

`docs/swarm/active/T402-worker-output.md`: commit SHA plus proof the work is in the **committed
blob**; all six gates with `.env.local` absent against a baseline **you measured on your own branch
point** (do not copy figures — they go stale within hours here); every mutation with real red output
pasted; your §4 decision and its evidence; your §5 decision on the test seam; and anything in this
packet that is wrong.
