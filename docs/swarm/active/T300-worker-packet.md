# T300 — worker packet v1: `OutreachEventDialog`'s placeholder coach id becomes impossible, not merely unreachable

**Tier: STANDARD** (constitution item 26). **Stated and defended:** no write-path *logic* changes, no
schema/RLS/auth, and this rolls out a pattern **already built, reviewed and merged as T179** for the
two sibling dialogs on this same page — item 19b's *"applying a proven pattern to a second surface"*,
which is exactly when a full premise gate is not the right spend. It is **not FAST**, because making
`currentUserProfileId` required **changes a signature another module imports**, which item 26's FAST
tier explicitly excludes. Worker implements; the orchestrator replays every mutation; no separate
checker round.

**Escalate to HEAVY and stop** if the required-prop change turns out to force edits beyond §2's
Allowed Files.

**Branch:** `claude/t300-placeholder-coach`, from `33c9e24`.

**Measure your own baseline.** `main` moved eight times on 2026-08-03; every figure in older docs is
stale.

---

## 1. The defect

`OutreachEventDialog.tsx:619` declares its **own independent**
`PLACEHOLDER_CURRENT_COACH_PROFILE_ID = 'profile-placeholder-current-coach'` — the same literal as
`MarkDayCompleteDialog.tsx`'s was, but a separate declaration, so T179 deleting that one never touched
this. `currentUserProfileId` defaults to it at `:971`, and the live call site passes `user?.id`
(`string | undefined`), so a null `user` silently substitutes a **non-uuid string into a real
`profiles.id` position**.

**Latent, not live-firing.** The dialog's triggers are the staff-only `MoreMenu` "Edit" item and the
create flow, both requiring a signed-in user, so it cannot be reached with `user === null` today.

**Worth closing anyway, and the reason is the point:** the required-prop change makes the defect
**impossible** rather than **currently unreachable** — the distinction the whole T179 family exists to
draw. And the placeholder is a non-uuid, so if it ever did reach Postgres it would surface as a bare
`22P02 invalid input syntax for type uuid` rather than anything diagnosable (see T156).

---

## 2. Allowed Files

```
src/pages/outreach/OutreachEventDialog.tsx
src/pages/outreach/OutreachEventDialog.test.tsx
src/pages/outreach/OutreachDetail.tsx          (the call site gate ONLY — see §3.3)
src/pages/outreach/OutreachDetail.test.tsx     (only if the gate reddens something)
```

**Forbidden:** `loaders/attendance.ts` (W1), `MarkDayCompleteDialog.tsx` / `MarkEventCompleteDialog.tsx`
(**T179 already fixed those — do not re-touch them**), `src/pages/checkin/**`, `LiveConsole.tsx`,
`Kiosk.tsx` (W1), `src/pages/home/**` (W5), `pages/reports/**` (W4), `supabase/migrations/**`.

> **Concurrency note.** T406 is in flight on this same directory but touches
> `loaders/outreach.ts` and `MarkDayCompleteDialog.tsx` — **no overlap with your files.** If you find
> yourself needing either, stop and report rather than editing across the boundary.

---

## 3. What to build — mirror T179, do not invent

**3.1** Delete `export const PLACEHOLDER_CURRENT_COACH_PROFILE_ID` (`:619`) and its doc comment.

**3.2** Make `currentUserProfileId` a **required** prop: remove the `= PLACEHOLDER_...` default at
`:971` and drop the `?` from the interface. Update the prop's own doc at `:957` and the module-doc
references at `:354-356` and `:615` — **do not simply delete that prose**; record *why* the default
went, as T179's own module doc does (`MarkDayCompleteDialog.tsx:307-311`).

**3.3** Gate the call site. **`OutreachDetail.tsx:2537` currently passes `currentUserProfileId={user?.id}`.**

> **Citation correction, verified at `33c9e24`:** the T300 ledger row says this call site is at
> `:1946`. It is at **`:2537`** — the file grew by ~300 lines under T306. **This is the only remaining
> `user?.id` call site in the file**; every other `currentUserProfileId={user.id}` is already
> non-optional and already gated.

Use the precedent already in this file, `OutreachDetail.tsx:2401`:

```jsx
{isStaffViewer && user !== null && ( … currentUserProfileId={user.id} … )}
```

**Match what that call site actually needs.** The three existing role gates in this file are the
precedent for the *shape*; whether this one needs `isStaffViewer` as well as `user !== null` is yours
to determine from how the dialog is triggered — **state your reasoning in your output.** Do not widen
access, and do not narrow it either: this task removes a placeholder, it does not change who can open
the dialog.

**3.4** Fix the test file: the import at `:55` and the assertion at `:1075`
(`expect(payload.respondedBy).toBe(PLACEHOLDER_CURRENT_COACH_PROFILE_ID)`). That assertion's premise is
being deleted. **Rewrite it to assert the real injected id, do not delete it** — it is pinning that the
acting coach's id reaches `respondedBy`, which is a real property worth keeping. Every other test that
constructs the dialog will now need the prop supplied; that is expected, not a finding.

---

## 4. Acceptance criteria — each names a mutation that must turn it red

| # | Criterion | Mutation |
|---|---|---|
| **C1** | `PLACEHOLDER_CURRENT_COACH_PROFILE_ID` is no longer an export of the module | re-add the export — assert on the **module namespace object**, not a grep (§3.2 requires prose that names it, so a zero-occurrence grep would fail on the packet's own required comment — this exact contradiction was found on T401) |
| **C2** | `currentUserProfileId` is **required** — omitting it does not compile | restore the default; **this is a `tsc` criterion, not a vitest one** — say so plainly and report the real `tsc` exit code and error |
| **C3** | The acting coach's real id reaches `respondedBy` on save | hardcode a different id in the payload builder |
| **C4** | The call site cannot pass `undefined` | restore `user?.id` — must fail `tsc`, not merely a test |

**C2 and C4 are typecheck criteria and that is the whole point of this task** — the fix converts a
runtime substitution into a compile-time impossibility. **A green vitest run does not demonstrate
either.** T401 in this same session shipped a test that went *vacuous rather than red* when its
premise was deleted, and only `tsc` caught it. **Run `tsc` and paste its real output for C2 and C4.**

**C3 is the one that must not be lost** in the churn of supplying a prop to every test.

---

## 5. Harness facts — verify before writing a criterion

`OutreachEventDialog.test.tsx` imports the placeholder at `:55` and asserts it at `:1075`. **Open the
file's mock block yourself and confirm what is and is not intercepted** — four consecutive tasks in
this project wrote criteria against an imagined harness, and on T309 a packet had two dialog test
files inverted despite the trap being documented verbatim in both.

---

## 6. Required worker output

`docs/swarm/active/T300-worker-output.md`:

1. **Commit SHA**, plus proof the work is in the **committed blob** (item 21).
2. **All six gates** against your own measured baseline, `.env.local` absent. Assert the **exit code**
   of the targeted run.
3. **Every mutation in §4, run, with real output pasted** — including the **`tsc` output** for C2/C4.
4. **§3.3**: which gate shape you used at the call site and why.
5. **Anything in this packet that is wrong.** Its own line citations were re-verified at `33c9e24` and
   one was already stale (the ledger's `:1946` → `:2537`). Assume others may be.
