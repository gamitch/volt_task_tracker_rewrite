# Inbox — for W2, from W1: three rows filed in your files (T401, T402, T406)

**From:** W1's orchestrator, branch `claude/w1-checkin` (PR #28).
**Verified at:** `aa900f3`. Every line/behaviour claim below was re-checked against source when this
note was written, not carried forward from when the rows were filed.

**W1 has not touched `src/pages/outreach/**` or `src/lib/supabase/loaders/outreach.ts`, and will
not.** These are yours to execute or decline. W1 is not blocked on any of them.

Rows are numbered in W1's block (T400–T499) because the block rule says file inside your own block —
not because W1 owns the work. **The work is W2's.**

---

## Why you are getting a note and not just three ledger rows

**T401 is the urgent one, and it is W1's fault.** T320 changed `loaders/attendance.ts` — a loader
your pages import at runtime — and in doing so **falsified a guard in `MarkEventCompleteDialog.tsx`**
that T307 put there deliberately. It is latent, not live, but it is a defect W1 introduced into your
file and could not fix from W1.

The other two are observations, not obligations.

---

## T401 — T307's `ATTENDANCE_ROW_CAP` guard is now a false positive

**Where:** `src/pages/outreach/MarkEventCompleteDialog.tsx:448` and `:547` (both confirmed present).

```ts
export const ATTENDANCE_ROW_CAP = 1000;          // :448
...
if (rows.length >= ATTENDANCE_ROW_CAP) {         // :547  -> treat load as failed, block the write
```

**What changed.** T320 gave `makeLoadAttendanceForSessions` `.range()` pagination, because PostgREST
was silently truncating at `max_rows = 1000` and returning **200 with a partial `Content-Range`** —
not an error — so `createLoader` resolved a partial array every caller read as complete.

**Why the guard is now wrong.** Before T320, `rows.length >= 1000` was a sound proxy for *"this
response may have been truncated, so fail closed."* After T320 the loader pages until a short page
returns, so a length of 1000+ means **the data is complete**. The guard now blocks a legitimate write
on a correct load. T307's fail-closed intent was right; its detection mechanism is obsolete.

**Suggested fix:** delete the guard and the constant. The loader is now the single place that knows
about `max_rows`, which is what T320's own ledger row anticipated ("landing this row deletes that
duplication") — it just didn't anticipate the deletion landing outside W1's files.

**Urgency: low, but do not lose it.** Reaching it needs >1000 attendance rows across one event's
sessions; the live database holds 79 in total. It will bite silently and confusingly if it ever does.

---

## T402 — a second `queryAttendanceForSessions` with the same truncation defect

**Where:** `src/lib/supabase/loaders/outreach.ts`, the file-local `queryAttendanceForSessions`.
**Cited by symbol deliberately** — it sat at `:745` when the row was filed and moved under W2's own
T193/T309/T327 work before this note landed. Line numbers in this repo go stale fast; grep the name.

```ts
async function queryAttendanceForSessions(client, sessionIds) {
  const result = await client
    .from('attendance')
    .select('session_id, student_id, status')
    .in('session_id', [...sessionIds]);      // no .range(), no .order()
```

**There are two functions with this name.** T320 named only the one in `loaders/attendance.ts` and
fixed it. This one carries the identical bare shape, so PostgREST truncates it at `max_rows` and
returns a 200 that `createLoader` resolves as complete. Neither T307's checker nor T320's own row
spotted the duplicate, so it has been invisible since it was written.

**The fix is a direct copy of T320's** (`loaders/attendance.ts`, `makeLoadAttendanceForSessions`).
Two parts of it are worth taking rather than re-deriving:

- **`.order('id')` is load-bearing, not cosmetic.** Page N+1 is an offset into a result set, and
  Postgres guarantees no ordering without an explicit `order by` — paginating an unordered query can
  return one row twice and never return another. `id` is the table's uuid primary key.
- **Throw at the page bound rather than returning what was gathered.** Returning a partial set
  reintroduces exactly the silent truncation being removed.

See `verification-log.md`'s T320 entry for the reasoning behind each part.

---

## T406 — a TOCTOU on `markDayComplete`'s attendance write

**Full write-up already in this inbox:** `w1-to-w2-T406-markdaycomplete-toctou.md`. Read that one; it
has the detail. Summary: `loaders/outreach.ts:1136`'s upsert sends full-column payloads, so a student
scanning the kiosk while a coach has `MarkDayCompleteDialog` open is clobbered by the stale snapshot,
including their real `check_in_at`.

**This is on the path T305/T307 repaired**, which is why it warrants a note rather than a row alone.

---

## One thing to know before you grep

`upsertAttendance` resolves to **two unrelated functions**:

| Where | What |
|---|---|
| `loaders/attendance.ts` | single `UpsertAttendanceParams` in, `AttendanceRow` out. Consumed by `AttendancePanel` only. |
| `loaders/outreach.ts` (file-local, near `markDayComplete`) | local `runMutation<readonly OutreachAttendanceWriteRow[], void>` — batch in, `void` out. Was `:1136`; grep, don't trust the number. |

This branch produced **three** same-name-different-thing collisions: the two `upsertAttendance`s, two
`AttendanceRecordState`s (`LiveConsole.tsx:436` vs `EndMeetingDialog.tsx:313` — different fields), and
two `queryAttendanceForSessions` (which is T402). A grep-driven blast-radius estimate on this codebase
will be wrong unless you check what each hit actually is. W1 got this wrong once already and asserted
"four call sites" where there was one.

---

## What W1 changed in your files, so you can review or revert it

One edit, test-only, made under an explicit owner authorization because T320's fix broke it:

- `src/pages/outreach/AttendancePanel.test.tsx` — one stub chain extended with `.order()`/`.range()`
  to match the paginated loader. **No production file of yours was touched.** If it conflicts with
  your work, the stub is trivially re-derivable; take your version and re-apply the two spies.
