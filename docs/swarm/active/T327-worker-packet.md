# T327 — outreach completion must not be a one-way trap door

**Branch:** `claude/t327-completion-ordering` (off `main` = `0016780`)
**Tier:** **HEAVY** (constitution item 26) — it changes the order of writes on a live write path.
`WORKFLOWS.md` independently tiers it HEAVY.
**Gate:** `checker-premise` (fable) · **Worker:** sonnet · **Mutations replayed by the orchestrator**
**Workflow:** W2 (run an outreach event). Row 3, after T193 and T309.

**Also referenced, but NOT in scope: T330.** v1 proposed closing it as no-change; the gate refuted
that and I verified the refutation. See §9 — **T330 stays open and needs its own packet.** No T330
work is authorized here.

---

## 1. The defect — sharper than the audit described it

The audit (SRC-009) said only *"outreach completion is non-atomic."* **The ledger's own warning to
re-verify was correct: the real failure mode is worse and more specific than that, and naming it
changes what the fix should be.**

`makeMarkDayComplete` (`loaders/outreach.ts:1174-1198`) performs three writes in this order:

1. `updateSession` — flips `event_sessions.status` to `'completed'` (and sets `people_reached`)
2. `upsertAttendance` — writes the attendance rows, **only if `payload.attendance.length > 0`**
3. the adult-volunteer `events` read-modify-write, **only if either delta is `> 0`**

**If (2) fails, the session is already `'completed'` and the attendance was never written.**

**Packet v1 called this an unrecoverable trap door. The gate measured that FALSE, and v2 states the
real severity instead. Do not work from v1's framing.** Two recovery paths exist:

1. **The dialog stays open on failure.** `handleSubmit` catches, sets `submitError`, and calls
   `onOpenChange(false)` **only on success** (`MarkDayCompleteDialog.tsx:1112-1122`). The flip
   carries no `.eq('status','scheduled')` guard, so **an immediate re-click retries and converges
   today.** v1's claim that there is "no error visible after the dialog closes" is simply wrong.
2. **`AttendancePanel` is a working post-completion editor.** Its `eligibleSessions` excludes only
   `'canceled'` (`AttendancePanel.tsx:648-649`), so a **completed** session is still editable there,
   under `staff_all` RLS. **The day's student hours are recoverable** by ticking students in the
   panel below.

**So the trap springs only if the coach abandons or reloads before a successful retry.** What is
genuinely stranded at that point is narrower but real:

- **T309's absence rows.** `AttendancePanel`'s uncheck **DELETEs** (T119/D-7) and never writes
  `'absent'`, so the absence records T309 just shipped have **no other writer** anywhere.
- **The adult-volunteer deltas.** Step (3) has no other writer either.

Both completion surfaces do refuse the session afterwards — `isSessionEligible = session.status ===
'scheduled'` (`MarkDayCompleteDialog.tsx:941`, module doc `:261-267`) and `partitionEventSessions`
filters to `scheduled` (`MarkEventCompleteDialog.tsx:257`) — which is why recovery has to happen
through a *different* surface that writes *less* than the dialog did.

**The reorder's true value, stated honestly:** retry-in-place convergence without depending on the
coach noticing, plus preservation of the two things nothing else can rewrite. That is worth doing.
It is not a rescue from total data loss, and the packet must not sell it as one.

**Reachability is ordinary**, not exotic: a dropped connection, an RLS rejection, a PostgREST error,
or a timeout between two sequential `await`s on a phone in a school gym.

---

## 2. The fix — reorder the writes. Do NOT build a transaction.

**Swap (1) and (2). Write attendance first, then flip the session status.** That is the whole change
to the mutation's control flow.

| Failure point | Today | After the reorder |
|---|---|---|
| attendance write fails | session flips to `completed` anyway; **an abandoned retry strands T309's absence rows and the adult-volunteer deltas** (§1) | session stays `scheduled`, nothing written — retry **converges**, and does so even if the coach comes back later |
| status flip fails | (n/a — it is first) | session stays `scheduled`, attendance written — retry converges, upsert is idempotent |

**Why this is enough, and why a real transaction is not authorized here.** Genuine atomicity needs a
Postgres function or edge function — a migration, a new deploy surface, and a second place the write
lives. For a ~20-student volunteer team (constitution item 25) the reorder makes **every** failure
leave a state the existing UI can still act on, instead of one the coach must notice immediately or
lose. **The retry is the recovery mechanism, and it works because the attendance upsert is
idempotent** — `{ onConflict: 'session_id,student_id' }` (`:1150`), and T309's absence rows go
through the same upsert.

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
- **C4** The adult-volunteer update still runs **last**, after the status flip, **and the happy path
  resolves normally** with all three writes issued in the order attendance → session → events.
  *Mutation: move step (3) above the flip.* **This is the guard for §3 and is not optional.**
  (v1 had the resolve-normally half as a separate C6; the gate measured that C6 never reddens unless
  C1 or C4 already has, so it is folded in here under item 25. Its one unique assertion —
  `.resolves.toBeUndefined()` — belongs on this criterion.)
- **C5** The adult-volunteer update is still **skipped entirely** when both deltas are `0`.
  *Mutation: remove the delta guard.*

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

(`outreach.test.ts:94`, `:182`, `:234`). **`endMeeting.test.ts:613` has the richer version of the
same pattern** — it returns `{ client, fromSpy, updateArgs, eqArgs }` from a helper, which is what
lets a test assert *what* was written and *in what order*. **Read `endMeeting.test.ts:600-620`
before writing your fake**; it is the closest working model, and it is a Forbidden file for editing
but not for reading. (v1 also cited `:127`; that helper returns `{ client, recordedByTable }` and is
not the model you want.)

**Harness caveat the gate hit while building it — heed this or C1 will lie.** Your fake must record
**table *and* method**, not table alone: with nonzero adult-volunteer deltas, `event_sessions`
receives **both** an `update` (the flip) **and** a `select` (step 3's read at `:866-876`). A
table-only order recorder cannot tell the flip from the read, and C1 will assert on the wrong call.
`endMeeting.test.ts:353` is the "dispatches on the METHOD called" shape to copy.

**`makeMarkDayComplete` currently has no test of its own** — T165 records that 21 of 23 exports in
this loader are untested. So you are adding the first coverage of this mutation, not extending
existing coverage. **Nothing existing pins the current write order**, which is precisely why the
reorder is safe to make and why C1 is the criterion that matters.

**T305's gate already proved this is testable**: it drove the real `makeMarkDayComplete` over a
stubbed transport and captured the exact upsert payload (`T307-worker-packet.md:46`). You are
repeating a known-possible thing. (v1 credited T307's gate; it was T305's.)

### Two stale module-doc claims this reorder falsifies — fixing them is part of the deliverable

Both are in `loaders/outreach.ts`, which is an Allowed File:

| Line | Claim today | Why the diff falsifies it |
|---|---|---|
| `:117` | module doc #4: *"performs, **in order**: (a) `event_sessions` update … (b) `attendance` upsert …"* | The order is now (b) then (a). This one states an explicit order contract and must be rewritten, not annotated. |
| `:1122-1124` | `makeMarkDayComplete`'s own doc lists *"status flip, attendance upsert, …"* in the old order | Same reorder. |

Alongside these, record **§3's asymmetry** — idempotent writes may be reordered, non-idempotent ones
may not — so the next reader does not "finish the job" by moving step (3) too.

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

## 9. T330 — my closure proposal was WRONG. It needs its own packet.

**No T330 work is authorized in this packet.** This section exists so the corrected facts are on the
record before anyone packets it.

**Packet v1 proposed closing T330 as no-change**, on the argument that an orphan event (an `events`
row whose `event_sessions` insert failed) renders gracefully and that *"the coach reopens the event,
adds the days, and the state is correct."* **The gate refuted that, and I verified the refutation
myself.**

**`buildEventGroups` drops the event entirely.** `OutreachList.tsx:1730` — `if
(eventSessions.length === 0) continue;` — omits a zero-session event from **both** buckets, and its
own module doc at `:1711-1712` says so outright. So:

- The `'No sessions scheduled yet.'` branch I cited at `OutreachList.tsx:1565` is **dead code on the
  coach list.** It never renders there. (`OutreachDetail.tsx:1131`/`:2015` do render it — but only
  if you already have the URL.)
- **Every navigation affordance to `/outreach/:eventId` lives on a list row.** With no row, there is
  no link. The orphan is reachable only by a remembered or guessed URL.
- **"Self-correctable" is therefore false in-app.** That was the whole basis of the closure.

**This is not an RLS problem.** `staff_all` on `events` (`rls.sql:149-151`) lets the coach read the
row perfectly well. The row is invisible because the list omits it — which is worse, because nothing
signals that anything is wrong.

**And there is a wrong-number path, which kills "no figure is wrong".** The create dialog collects
adult-volunteer count and hours (`OutreachEventDialog.tsx:1000-1001`), and `HoursTab` sums
`adult_volunteers_count`/`adult_volunteer_hours` across **all** season events **with no session
filter** (`HoursTab.tsx:580-596`, called at `:1094`; `reports.ts:401-411`). A failed create followed
by a successful retry leaves **two** events carrying the same volunteer figures — **double-counted in
the season adult totals, invisible in the UI, and uneditable.** That is the same grant-reporting
number §3 goes out of its way to protect from double-counting.

**Disposition: T330 stays OPEN and needs its own packet.** `WORKFLOWS.md:109` already tiers it
HEAVY.

**The cheapest credible fix is not a transaction** — it is deleting the `continue` at
`OutreachList.tsx:1730` so a zero-session event renders as a visible "needs dates" row, activating
the already-shipped `:1565` branch and restoring the edit path (`:1384-1386` already inserts missing
sessions on save). Whoever packets it must decide what such a row shows for date/hours/count, which
is exactly what `buildEventGroups` currently avoids by skipping it — that is the real design work,
and it is why this is not a two-line change.

**Process note for the ledger:** the closure was proposed on a citation (`:1565`) that was real but
**dead on the surface that mattered**. Reading that a branch exists is not evidence that it renders.
