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

**The owner's dashboard shows `11 pending RSVPs`.** Responses from this page are being discarded.

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

**Mirror `RsvpControl.tsx:485-505` exactly** — it is the in-repo pattern for this and it is correct:

1. capture `previousStatus`
2. set the new status optimistically
3. `await onRsvpChange({...})`
4. **on rejection, roll the optimistic update back** and surface an honest error
5. clear the in-flight flag in `finally`

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
- **C4** On a rejected write the suite still exits **0** — no unhandled rejection.
  *Mutation: replace `await`/`try` with `void`.* Assert this explicitly; a green pass count with a
  nonzero exit is a real failure on this project.
- **C5** A **coach/admin** viewer's path is untouched — this control is student/parent only.
  *Mutation: call the writer from the coach branch too.*
- **C6** The optimistic update still happens **before** the promise settles (the control must not
  feel laggy). *Mutation: move the state set after the `await`.*

`container.textContent`, never `innerHTML`. Pair presence with absence where both are meaningful.

---

## 6. The harness trap — read before touching the test file

Adding a **defaulted loader prop** makes every existing test that renders this component reach the
**real** `submitRsvpChange`, which with `.env.local` absent rejects
(`loader.ts:168-175`) — landing the page in an error state. This exact seam has bitten the project
**three times**: `DashboardPage.test.tsx:39-42` and `OutreachList.test.tsx:158-165` both document it
verbatim, and T189 hit it again anyway.

**Before writing anything:** run `OutreachList.test.tsx`, record the passing count, and **pin it
back** by injecting a fake at every affected call site. Report the before/after counts explicitly.
**Do not weaken or delete an existing assertion to make a count match** — if you find yourself
editing what a test asserts, stop and file a dispute.

---

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
