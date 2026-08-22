# GAM-450 — worker packet (STANDARD)

**Task.** Build `src/lib/meetings/overlap.ts`: one pure, synchronous function
that answers "which other sessions does this session clash with?" once, so
`SeriesCard`, `SchedulePanel` and `MeetingsRail` badge from a single answer
instead of computing it three ways.

## Allowed Files — nothing else

- `src/lib/meetings/overlap.ts` (new)
- `src/lib/meetings/overlap.test.ts` (new)

Forbidden: everything else, explicitly including `src/lib/meetings/types.ts`
(frozen by GAM-444), `src/pages/meetings/**`, `.github/workflows/**`,
`docs/swarm/**`, `.claude/**`.

**No file under `.github/workflows/**` is in scope** — checked at packet time,
per `AGENTS.md` wall 1.

## The frozen contract — import it, do not restate it

`src/lib/meetings/types.ts:350-356` already defines, and GAM-444 froze:

```ts
export interface OverlapRef { sessionId: string; eventId: string }
export type OverlapIndex = ReadonlyMap<string, readonly OverlapRef[]>;
```

Import both as types from `./types`. **Do not redeclare, widen or reshape
either one** — three sibling tickets are coding against them right now, and
`MeetingsRail.tsx:205-218,665` already consumes `OverlapIndex` with
`overlapIndex.get(sessionId) ?? []`.

The *name* `buildOverlapIndex` is frozen by the `meetings-design` skill's
"Don't re-derive these" table. Use exactly that name.

## The signature you are defining (the one shape not already frozen)

```ts
export interface OverlapSessionInput {
  sessionId: string;
  eventId: string;
  /** Stored Chicago calendar date, `YYYY-MM-DD`. The day bucket. */
  sessionDate: string;
  /** UTC ISO instant. */
  startsAt: string;
  /** UTC ISO instant. */
  endsAt: string;
  status: SessionStatus;
}

export function buildOverlapIndex(
  sessions: readonly OverlapSessionInput[],
): OverlapIndex;
```

`SessionStatus` is imported from `./types` (`'scheduled' | 'completed' |
'canceled'`).

**Why these exact field names, and why a flat list.** They are
`CoachMeetingSessionDetail`'s own field names (`types.ts:82-108`) plus
`eventId`, so the assembly ticket's call site is one expression and needs no
adapter or cast:

```ts
buildOverlapIndex(rows.flatMap((r) => r.sessions.map((s) => ({ ...s, eventId: r.eventId }))))
```

Taking `readonly CoachMeetingRow[]` directly was the alternative and was
rejected: it would couple a pure module to the coach page's row shape —
including nine optional metric fields (`attendancePct`, `gradedMarksCt`, …)
that have nothing to do with clash detection — and would lock the student view
out of reusing this.

## Rules — all six are acceptance criteria

1. **Different series only.** Two sessions with the same `eventId` never
   overlap each other, however much their times intersect.
2. **Same Chicago calendar day**, compared as `sessionDate === sessionDate`.
3. **Genuine intersection:** `a.start < b.end && b.start < a.end`. Strict on
   both sides, so **touching intervals do not overlap** — 4–6 PM then 6–8 PM is
   NOT a clash. Parse the instants to epoch milliseconds (`Date.parse`) and
   compare numbers; do not compare the ISO strings.
4. **Canceled sessions never overlap anything, in both directions.** A canceled
   session gets no entry of its own *and* is absent from every other session's
   list.
5. **Only non-empty entries are keys.** A session with no clash is simply absent
   from the map — `MeetingsRail.tsx:665`'s `?? []` is already the consumer
   idiom, and an all-keys map would make `.size` meaningless as a clash count.
6. **Pure and synchronous.** No `Date.now()`, no `new Date()` for "now", no
   Supabase import, no I/O, no mutation of the input. Same input ⇒ same output,
   including **ref ordering, which follows input order**.

## ⚠ The day-bucketing trap, measured — not hypothetical

The issue warns that "a 11 PM Chicago session is the next day in UTC" as
though it were an edge case. **It is the ordinary case in this codebase.**
Measured in `src/lib/meetings/coachModel.ts:169-174`:

```
sessionDate: '2026-07-22'
startsAt:    '2026-07-22T23:00:00.000Z'   // 6:00 PM Chicago
endsAt:      '2026-07-23T01:00:00.000Z'   // 8:00 PM Chicago — NEXT UTC DAY
```

Every evening meeting in this app already ends on the following UTC date. So
bucketing the day from `endsAt` — or from any `Date` re-derivation in the
viewer's zone — breaks on the **common** path, not a rare one. Bucket on the
stored `sessionDate` string and nothing else. Do not import a timezone
formatter; you do not need one, because the correct field is already a Chicago
calendar date.

## Tests — `src/lib/meetings/overlap.test.ts`

Cover all seven. Use fabricated names/ids only (item 6).

1. Genuine overlap across two series → both directions present, each ref
   carrying the *other* session's `sessionId` and `eventId`.
2. **Touching intervals** 4–6 PM vs 6–8 PM → no entry for either. This is the
   mutation target; make its assertion specific.
3. Same-series sessions at identical times → no overlap.
4. Canceled excluded **both directions**: assert the canceled session has no
   entry, *and* that the surviving session's list does not name it.
5. **Cross-midnight-UTC day integrity**: two sessions sharing a `sessionDate`
   whose `endsAt` lands on the next UTC day still overlap; and two sessions on
   *different* `sessionDate`s that would look same-day under a naive UTC
   derivation do not.
6. Three-way overlap → each of the three lists the other two.
7. Determinism/purity: calling twice on the same input yields equal results,
   and the input array and its objects are not mutated.

## Evidence you must produce

- The six gates via `python3 .claude/skills/gate-run/scripts/gates.py`, pasted
  verbatim with exit codes. Do not pipe it into `tail`/`grep`.
- The named mutation, run for real (`mutation-replay` skill): **change
  `a.start < b.end` to `a.start <= b.end`** and confirm the touching-interval
  test goes red. Report the actual failing assertion text, not a summary. Then
  restore and confirm green. **Commit before mutating** (item 26's fast-tier
  working rule — `git checkout --` has reverted an uncommitted fix here before).
- The commit SHA the work landed in (item 21). "Clean" is not "committed".

## Least confident decisions (item 19d — attack these first)

1. **`OverlapSessionInput` as a new flat exported type rather than reusing
   `CoachMeetingRow[]`.** Wrong if the assembly ticket GAM-452 or a landed
   sibling already calls `buildOverlapIndex` with a different argument shape —
   then I am freezing a second, conflicting contract. *Check: does any file
   under `src/` already call `buildOverlapIndex`?*
2. **Only non-empty entries are keys (rule 5).** Wrong if a landed consumer
   uses `overlapIndex.has(id)` or iterates the map expecting every session
   present. *Check: every `overlapIndex` read site in `src/pages/meetings/**`.*
3. **`sessionDate` string equality as the day bucket.** Wrong if any real
   loader emits `sessionDate` in a non-`YYYY-MM-DD` form, or emits it as a UTC
   date rather than a Chicago one — then string equality silently mis-buckets.
   *Check: `src/lib/supabase/loaders/meetings.ts` — what column feeds it.*
4. **Refs ordered by input order.** Wrong if a consumer renders refs directly
   and needs chronological order; input order is stable but arbitrary.
5. **Non-canceled statuses are otherwise equal.** I treat `completed` sessions
   as overlappable. Wrong if the design intends badges only on upcoming
   sessions — but the badge sites include a schedule panel showing past
   sessions, so I believe historical clashes should still show.
