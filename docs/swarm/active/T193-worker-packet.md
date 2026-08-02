# T193 — a student's RSVP on `/outreach` must actually persist

**Branch:** `claude/swarm-plan-zl575z` (off `main` = `e422123`)
**Tier:** **HEAVY** (constitution item 26) — this adds a **write path**. `WORKFLOWS.md` independently
tiers it HEAVY. The diff is small; the tier is not about diff size.
**Gate:** `checker-premise` (fable) · **Worker:** sonnet · **Mutations replayed by the orchestrator**
**Workflow:** W2 (run an outreach event). Collides with any concurrent `OutreachList.tsx` work —
that file carries 8 open rows.

---

## 1. The defect

A student changes their RSVP on `/outreach`, the control updates, and **nothing is written to the
database.** On reload it is gone. Silent data loss on a core action, invisible from the UI.

`OutreachList.tsx:3656`:

```ts
function handleRsvpChange(sessionId: string, status: RsvpStatus): void {
  // Module doc #8b: local-only. No Supabase write happens here -- the
  // real persisted, validated RSVP flow is RsvpControl.tsx/ParentRsvp.tsx
  // (T040/T042, Forbidden Files, currently Blocked).
  setRsvps((prev) => withRsvpOverride(prev, viewerStudentId, sessionId, status));
}
```

**The comment's premise expired.** `RsvpControl.tsx`/`ParentRsvp.tsx` are no longer blocked — T101
wired their real default. This row is the `OutreachList` half of T169, split off at merge.

**The owner's dashboard shows `11 pending RSVPs`** (a live-DB observation, not repo-verifiable). Responses from this page are being discarded.

---

## 2. Everything you need already exists — do not build a mutation

- **The writer:** `submitRsvpChange` (`loaders/outreach.ts:1092`), type `SubmitRsvpChangeFn`, built
  by `makeSubmitRsvpChange`. Its doc calls it *"the ONE real `rsvps` upsert, shared by both
  `RsvpControl.tsx` and `ParentRsvp.tsx`"*. **Reuse it. Do not write a second `rsvps` upsert.**
- **Params:** `{ sessionId, studentId, status, respondedBy }` → upserts
  `session_id, student_id, status, responded_by, updated_at` on conflict `session_id,student_id`.
- **`studentId`:** `viewerStudentId`, already resolved for real by T170 (no longer a placeholder).
- **`respondedBy`:** `viewerProfileId`, already in scope in this component and already passed to
  `SelfCheckoffDialog` as `currentUserProfileId` (`:3732`).

So the change is **wiring plus failure handling**, not new persistence.

---

## 3. What to build

Give this component the same injectable-seam convention the file already uses: a
**`onRsvpChange?: SubmitRsvpChangeFn` prop on `OutreachListProps`, defaulting to the real
`submitRsvpChange`.** That mirrors `RsvpControl.tsx:462` (`onRsvpChange = submitRsvpChange`) and
this file's own `resolveStudentId` default. **Do not make it required** — that forces a change at
the router call site, which is out of scope.

**Follow `RsvpControl.tsx:482-506`'s *sequence*, but NOT its rollback value.** The gate built both
shapes and proved the literal mirror is impossible here:

1. **snapshot the previous `rsvps` ARRAY** (not a scalar `previousStatus`)
2. set the new status optimistically via `withRsvpOverride`
3. `await onRsvpChange({...})`
4. **on rejection, restore the snapshot array** and surface an honest error
5. clear a single component-wide in-flight flag in `finally` (ignore clicks while submitting — this
   also makes the snapshot rollback concurrency-safe)

**Why a scalar rollback cannot work here, measured:** `RsvpControl` rolls back a
`displayedStatus` that may be `null` (unanswered). This component's state is the shared `rsvps`
array, and `withRsvpOverride` (`OutreachList.tsx:1390-1412`, signature frozen by §4) takes a
**concrete `RsvpStatus`** and, when no row exists, **appends** one — it cannot remove a row, so it
cannot express "back to unanswered". A captured `previousStatus` is `undefined` in exactly the
dominant case: a student answering for the first time. A worker taking "capture `previousStatus`"
literally produces a **stuck phantom RSVP** — the failure §3 warns is worse than today's bug.

**Disclosed, do not fix here:** `withRsvpOverride`'s locally-appended row sets
`respondedBy: studentId` (`:1407`) — a `students.id` in a field that mirrors a `profiles.id` column.
That is **T174's exact open defect**, so the optimistic row and the persisted row disagree on that
one field until reload. It is local-only display state and out of scope; do not widen toward it.

**The rollback is the whole point of the tier.** An optimistic update with no rollback is *worse*
than today's bug: today the student loses the change on reload; a failed write with no rollback
tells them it saved when it did not, and they never reload to find out.

**Use `.catch`/`try` — never `void`.** T179 measured `void reloadDetail()` leaving 86 tests green
with the suite at **exit 1**; `void` discards a promise's *rejection*, not just its value.

---

## 4. Forbidden

- **Do not write a second `rsvps` upsert** anywhere. One writer, already shipped.
- **Do not touch `RsvpControl.tsx`, `ParentRsvp.tsx`, or `loaders/outreach.ts`.** They are correct.
- **Do not replace the inline `SegmentedControl` with `<RsvpControl>`.** That is a larger UI
  integration the owner has not scoped; this task makes the existing control honest.
- **Do not change `withRsvpOverride`'s signature** — `getUnansweredRsvpCount`, `computeStudentHours`
  and the goal bar all read the same `rsvps` state.

---

## 5. Acceptance criteria — each with the production-code mutation that must turn it red

Run each mutation, paste the real red output. **A criterion whose mutation leaves the suite green is
not evidence — report that instead of shipping it.**

- **C1** Changing an RSVP calls the injected writer **exactly once**, with
  `{ sessionId, studentId: viewerStudentId, status, respondedBy: viewerProfileId }`.
  Assert on the spy's argument object, not just the call count.
  *Mutation: revert `handleRsvpChange` to local-only.*
- **C2** `respondedBy` is the **profile** id, not the student id. These are different columns and
  T174 exists because they have already been confused once.
  *Mutation: pass `viewerStudentId` as `respondedBy`.*
- **C3** On a **rejected** write the control returns to its previous status and an honest error is
  visible. *Mutation: delete the rollback line in the `catch`.*
- **C4** On a rejected write there is **no unhandled rejection**. **This is a gate-level check, not
  an in-suite assertion** — no test can assert its own suite's exit code. Verify by applying the
  mutation and running §7's `npx vitest run …; echo $?`.
  *Mutation: replace `await`/`try` with `void`.* T179 precedent: 86 tests green, suite exit 1.
- **C5** A **coach/admin** viewer never triggers the writer — assert the spy is uncalled for a
  `COACH_USER` render. **Honest framing: this also passes against current code**, because the coach
  branch contains no RSVP handler at all. It is a **regression guard**, not a defect discriminator.
  *Mutation, since no natural site exists: fire the writer on coach-view mount.*
- **C6** The optimistic update still happens **before** the promise settles (the control must not
  feel laggy). *Mutation: move the state set after the `await`.*

`container.textContent`, never `innerHTML`. Pair presence with absence where both are meaningful.

---

## 6. The harness reality — MEASURED by the gate, not assumed

**An earlier draft of this packet claimed that adding a defaulted loader prop would make every
existing test reach the real writer and fail. The gate built it and proved that FALSE.**

Measured at `e422123` with `.env.local` absent, implementing §3 with **zero** test pinning:

```
OutreachList.test.tsx  before: 92 passed, exit 0
OutreachList.test.tsx  after : 92 passed, exit 0
full suite             after : 1817 passed (75 files), exit 0   ·  tsc exit 0
```

**Why the analogy failed:** `DashboardPage.test.tsx:39-42` and `OutreachList.test.tsx:158-165`
document a **mount-time loader** trap. `submitRsvpChange` is a **click-time mutation** — it fires
only on interaction, and exactly **one** of 92 tests clicks an RSVP segment. Count-delta pinning
detects nothing here, and **must not be treated as evidence of safety.**

**The real hazard is one named test, and it is worse than a failure.**
`OutreachList.test.tsx` → *"selecting a real RSVP segment updates the goal bar and the
unanswered-RSVP badge live (module doc #8b)"* (~`:1652-1673`) asserts the old local-only semantics.
Under this change it stays green **only by racing the rejection** — the gate added a single
`await flushMicrotasks()` after the click and it went **1 failed | 91 passed**, because the rollback
reverts the state it asserts.

**You are explicitly authorized to adapt that one test**, and §8's "do not weaken an assertion" does
not bar it: inject a **resolving** fake writer, flush after the click, and keep its live-update
assertions against that fake. Name it in your report. **Do not** silently leave it green-by-race.

## 7. Gates — all six, `.env.local` ABSENT, report every one

```
npx tsc --noEmit
npx vite build
npm run format:check
npx eslint .            (0 errors; report the warning count, explain any rise)
npx vitest run          (base: verify it yourself on the branch point and report the real number)
npx vitest run src/pages/outreach/OutreachList.test.tsx >/dev/null 2>&1; echo $?
```

A gate omitted from your report is treated as not run.

---

## 8. Allowed files

- `src/pages/outreach/OutreachList.tsx`
- `src/pages/outreach/OutreachList.test.tsx`
- `docs/swarm/active/T193-worker-output.md` (create — evidence doc)

Everything else Forbidden. Work in your own git worktree (item 23); do not move the shared
checkout's HEAD. **Commit before running any mutation** — reverting a mutation with
`git checkout --` also reverts uncommitted work (item 26's fast-tier note; it applies here too).
**Do not commit a `node_modules` symlink.** Stage with explicit pathspecs, never `git add -A`.

Commit to `claude/swarm-plan-zl575z`, push, report the SHA, and include a
"Deferred — for the ledger" section (item 20). You do not self-certify.
