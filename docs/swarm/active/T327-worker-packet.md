# T327 — outreach completion must not be a one-way trap door

**Branch:** `claude/t327-completion-ordering` (off `main` = `0016780`)
**Tier:** **HEAVY** (constitution item 26) — it changes the order of writes on a live write path.
`WORKFLOWS.md` independently tiers it HEAVY.
**Gate:** `checker-premise` (fable) · **Worker:** sonnet · **Mutations replayed by the orchestrator**
**Workflow:** W2 (run an outreach event). Row 3, after T193 and T309.

**Also in scope, as an assessment rather than a change: T330.** See §9 — it is proposed for
**closure as no-change**, and the gate is asked to attack that proposal specifically.

---

## 1. The defect — sharper than the audit described it

The audit (SRC-009) said only *"outreach completion is non-atomic."* **The ledger's own warning to
re-verify was correct: the real failure mode is worse and more specific than that, and naming it
changes what the fix should be.**

`makeMarkDayComplete` (`loaders/outreach.ts:1174-1198`) performs three writes in this order:

1. `updateSession` — flips `event_sessions.status` to `'completed'` (and sets `people_reached`)
2. `upsertAttendance` — writes the attendance rows, **only if `payload.attendance.length > 0`**
3. the adult-volunteer `events` read-modify-write, **only if either delta is `> 0`**

**If (2) fails, the session is already `'completed'` and the attendance was never written.** That is
not merely inconsistent — **it is unrecoverable from inside the app**:

- `MarkDayCompleteDialog.tsx:941`: `isSessionEligible = session.status === 'scheduled'`. Opened
  against a `'completed'` session the dialog renders **no checklist, no hours inputs and no
  "Mark complete" action** — only an informational banner (its own module doc at `:261-267`).
- `partitionEventSessions` gives bulk mode only `status === 'scheduled'` sessions
  (`MarkEventCompleteDialog.tsx:242-243`), so **"Mark event complete" skips it too.**

So a single failed request permanently strands a day's hours, with **both** completion surfaces
refusing to touch it and no error visible after the dialog closes. **A trap door, not a race.**

**Reachability is ordinary**, not exotic: a dropped connection, an RLS rejection, a PostgREST error,
or a timeout between two sequential `await`s on a phone in a school gym.

---

## 2. The fix — reorder the writes. Do NOT build a transaction.

**Swap (1) and (2). Write attendance first, then flip the session status.** That is the whole change
to the mutation's control flow.

| Failure point | Today | After the reorder |
|---|---|---|
| attendance write fails | session `completed`, hours lost, **no retry path** | session still `scheduled`, nothing written — coach retries, **converges** |
| status flip fails | (n/a — it is first) | session still `scheduled`, attendance written — coach retries, upsert is idempotent, **converges** |

**Why this is enough, and why a real transaction is not authorized here.** Genuine atomicity needs a
Postgres function or edge function — a migration, a new deploy surface, and a second place the write
lives. For a ~20-student volunteer team (constitution item 25) the reorder removes the *unrecoverable*
outcome entirely and leaves only *retryable* ones. **The retry is the recovery mechanism, and it works
because the attendance upsert is idempotent** — `{ onConflict: 'session_id,student_id' }`
(`:1150`), and T309's absence rows go through the same upsert.

---

## 3. The trap: do NOT also move step (3) before the flip

It looks like the same reasoning should apply to the adult-volunteer update. **It must not be moved,
and moving it would introduce a new bug.**

Step (3) is an **additive read-modify-write** — `currentCount + payload.adultVolunteersCountThisSession`
(`:1191-1195`). It is **not idempotent.** If it ran before the status flip and the flip then failed,
the coach's retry would **double-count** adult volunteers and their hours — silently corrupting a
figure kept for grant reporting.

**Leave step (3) exactly where it is: last.** Its own residual failure mode — flip succeeds, totals
fail, this session's volunteer contribution is lost with no retry path — is **unchanged by this
task**. Disclose it in the module doc; **do not fix it here.** A correct fix is an atomic SQL
increment (`update … set adult_volunteers_count = adult_volunteers_count + $1`) exposed as an RPC,
which is a migration and a different tier. **File it as a new row in your "Deferred" section.**

This asymmetry — idempotent writes may be reordered freely, non-idempotent ones may not — is the
whole substance of the task. State it in the module doc so the next reader does not "finish the job".

---

## 4. Forbidden

- **Do not introduce a Postgres function, RPC, edge function, or migration.** Out of scope (§2).
- **Do not move, reorder or alter step (3)**, the adult-volunteer read-modify-write (§3).
- **Do not change `markDayComplete`'s signature or `OutreachMarkDayCompletePayload`.** Both dialogs
  call it; the bulk path builds the payload. This is an ordering change, not an interface change.
- **Do not touch `MarkDayCompleteDialog.tsx` or `MarkEventCompleteDialog.tsx`.** T309 just landed in
  the first; the second holds T307's protections. Neither needs to change for this.
- **Do not weaken the `length > 0` / delta guards.** They are what keep a no-attendance completion
  from writing an empty upsert, and T309 relies on the attendance guard now also passing when the
  only rows are absences.
- **Do not touch `loaders/attendance.ts`** — it belongs to **W1**.

---

## 5. Acceptance criteria — each with the production-code mutation that must turn it red

Run each mutation, paste the real red output. **A criterion whose mutation leaves the suite green is
not evidence — report that instead of shipping it.**

- **C1** `attendance` is written **before** `event_sessions` is flipped to `'completed'`. Assert on
  the **recorded order of `client.from(...)` calls**, not on two independent call assertions —
  order is the entire defect. *Mutation: restore the original order.*
- **C2** When the attendance write **rejects**, `event_sessions` is **never** flipped — assert no
  `update` carrying `status: 'completed'` was issued, and that `markDayComplete` rejects rather than
  resolving. *Mutation: swap back to flip-first.* **Pair the absence assertion with a presence one**
  (the attendance write *was* attempted) — an absence-only assertion here passes for the wrong reason
  if the fake client throws before either call.
- **C3** With **no** attendance rows (`attendance: []`) the session still flips to `'completed'` —
  the `length > 0` guard is preserved and an empty day can still be completed.
  *Mutation: drop the `length > 0` guard so an empty upsert is issued.*
- **C4** The adult-volunteer update still runs **last**, after the status flip.
  *Mutation: move step (3) above the flip.* **This is the guard for §3 and is not optional.**
- **C5** The adult-volunteer update is still **skipped entirely** when both deltas are `0`.
  *Mutation: remove the delta guard.*
- **C6** `markDayComplete` still resolves normally on the happy path with all three writes issued, in
  the order attendance → session → events. *Mutation: covered by C1's; assert it explicitly anyway so
  the happy path is pinned independently of the failure paths.*

`container.textContent`, never `innerHTML`, for any DOM assertion. Pair presence with absence where
both are meaningful — this repo has shipped 7+ absence-only assertions that passed for the wrong
reason.

---

## 6. The harness reality — MEASURED, not assumed

**`src/lib/supabase/loaders/outreach.test.ts` exists** (311 lines, **5 tests**) and is where this
work belongs. It already uses the repo's loader-test convention:

```ts
const client = { from: fromSpy } as unknown as SupabaseClient;
```

(`outreach.test.ts:94`, `:182`). **`endMeeting.test.ts` has the richer version of the same pattern**
— `:127` and `:613` return `{ client, fromSpy, updateArgs, eqArgs }` from a helper, which is what
lets a test assert *what* was written and *in what order*. **Read `endMeeting.test.ts:600-620`
before writing your fake**; it is the closest working model and it is a Forbidden file for editing
but not for reading.

**`makeMarkDayComplete` currently has no test of its own** — T165 records that 21 of 23 exports in
this loader are untested. So you are adding the first coverage of this mutation, not extending
existing coverage. **Nothing existing pins the current write order**, which is precisely why the
reorder is safe to make and why C1 is the criterion that matters.

**T307's gate already proved this is testable**: it drove the real `makeMarkDayComplete` over a
stubbed transport and captured the exact upsert payload. You are repeating a known-possible thing.

Baselines measured at `0016780`, `.env.local` absent — **verify them yourself and report the real
numbers**:

```
tsc --noEmit                        exit 0
eslint .                            0 errors, 361 warnings
vitest run                          76 files, 1837 tests, exit 0
loaders/outreach.test.ts            5
MarkDayCompleteDialog.test.tsx      54
MarkEventCompleteDialog.test.tsx    25
```

Both dialog files must stay green **with zero edits** — they are the two callers of this mutation.

## 7. Gates — all six, `.env.local` ABSENT, report every one

```
npx tsc --noEmit
npx vite build
npm run format:check
npx eslint .            (0 errors; report the warning count, explain any rise)
npx vitest run          (verify the base yourself on the branch point and report the real number)
npx vitest run src/lib/supabase/loaders/outreach.test.ts src/pages/outreach/MarkDayCompleteDialog.test.tsx src/pages/outreach/MarkEventCompleteDialog.test.tsx >/dev/null 2>&1; echo $?
```

A gate omitted from your report is treated as not run.

---

## 8. Allowed files

- `src/lib/supabase/loaders/outreach.ts`
- `src/lib/supabase/loaders/outreach.test.ts`
- `docs/swarm/active/T327-worker-output.md` (create — evidence doc)

Everything else Forbidden. Work in your own git worktree (item 23); do not move the shared
checkout's HEAD. **Commit before running any mutation** — reverting a mutation with
`git checkout --` also reverts uncommitted work (item 26). **Do not commit a `node_modules`
symlink.** Stage with explicit pathspecs, never `git add -A`.

Commit to `claude/t327-completion-ordering`, push, report the SHA, and include a
"Deferred — for the ledger" section (item 20) — it must contain the atomic-increment row from §3.
You do not self-certify.

---

## 9. T330 — assessed, and proposed for CLOSURE as no-change

**This section asks the gate for a verdict, not the worker for a change.** No T330 work is
authorized in this packet.

`WORKFLOWS.md` says to scope T327 and T330 together because they are the same "non-atomic" family.
Scoping them together is what showed they are **not the same severity**, and the difference is
recoverability.

**The path:** `makeSaveOutreachEvent`'s returned function (`loaders/outreach.ts:1447-1465`) inserts
the `events` row (`:1284-1292`, `.select('id').single()`), then inserts `event_sessions`
(`:1300-1315`), then reconciles expected-attendee RSVPs. If the session insert fails, an **event row
with no sessions** survives.

**Why that is not a trap door, unlike T327 — verified, not assumed:**

- Both surfaces render a session-less event **gracefully**, not as an error:
  `OutreachList.tsx:1565` and `OutreachDetail.tsx:1131` both return
  `'No sessions scheduled yet.'`, and `OutreachDetail.tsx:2015` renders it as ordinary supporting
  text.
- **The event remains fully editable**, and the edit path inserts missing sessions through the same
  `toInsert` → `insertSessions` branch (`:1384-1386`). The coach reopens the event, adds the days,
  and the state is correct.

So T330's worst case is an **untidy but visible and self-correctable** row — no data is lost and no
figure is wrong. Against a ~20-student volunteer team, constitution item 25 says that does not earn a
mechanism. The audit itself graded it **P2**.

**Proposed disposition: close T330 as no-change**, recording the recoverability reasoning above, in
the manner of T144 (`ProgressBar` variants, D011). **Gate: attack this.** Specifically —

1. Is there any surface where a session-less event **does** error, that §9 missed?
2. Can the `events` insert succeed while leaving state the coach cannot reach — e.g. is the event
   visible to its creator under RLS before any session exists?
3. Does the RSVP-reconciliation phase leave anything worse behind than the session insert does?

**If any of those is a yes, T330 is not closeable and needs its own packet — say so.**
