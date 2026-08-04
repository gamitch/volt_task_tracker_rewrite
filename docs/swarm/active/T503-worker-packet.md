# T503 — worker packet **v2**: widen `rsvps` SELECT so a student sees what their teammates actually answered

**Tier: HEAVY** (constitution item 26), and not close: this changes **RLS on a table** and ships a
**migration**. The right trigger question here is not *can a mistake corrupt data?* but *can a mistake
expose data that should not be exposed, or silently change a number on a screen?* — and both are
**yes** if the policy is written wrong. Packet → premise gate → worker → checker, orchestrator
replaying every mutation.

**v2 supersedes v1 after the premise gate returned REVISE** (round 1 of item 19a's two) with one
MAJOR, three MINORs and two NITs. **The §3 premise is now PROVEN by execution — do not re-derive it.**
The MAJOR was a real omission in v1 and is fixed in §2.1.

**Branch:** `claude/t503-widen-rsvp-read`, from current `main`. **Measure your own baseline.**

---

## 1. The defect — a display lie, not a security hole

A non-staff viewer's Signups buckets show **every teammate under "No response"**, whatever they
actually answered.

`rsvps` RLS is `staff_all` plus `own_or_linked_read` (`20260717000002_rls.sql:197-203`), so a student
reads only their own row. `groupSessionSignups` builds its buckets by **diffing the roster** against
the rsvps it can see, and `<SessionSignupList>` renders for **every** viewer (`OutreachDetail.tsx:2310`;
the staff gate at `:2329` covers the *attendance* view, not this one). So the page treats *"I am not
allowed to read this row"* as *"this student did not answer"* — a false statement on screen.

**Pre-existing.** T306 did not cause it and deliberately did not extend it (`:1925` staff-gates its
attendance view precisely so it would not create a second, worse instance).

---

## 2. The owner's decision, and the authority to deviate from the PRD

`auto-mode-decisions.md`: **"2026-08-03 — George's ruling on T503"** (product) and **"2026-08-04 —
George picks the SCOPE for T503"** (scope). **Cite those entries, never this paraphrase.**

**Widen SELECT on `rsvps` so any authenticated user may read any row.**

### 2.1 THIS IS A DELIBERATE PRD DEVIATION AND IT IS ALREADY RECORDED — read `D013` first

**The gate's MAJOR, and v1 missed it entirely.** Constitution **item 3**:

> *"RLS policies and metric SQL come **only** from PRD Section 8.4, copied verbatim. Re-deriving
> either … → **BLOCKER**."*

PRD §8.3's `rsvps` row says **`read/write own`**. A policy that widens read is therefore *not* 8.4
verbatim, and **a checker would be correct to BLOCKER it** unless the deviation is on the record.

**It is on the record: `dispute-log.md` → `D013`**, filed before any code was written, following the
**D002** pattern that constitution item 8 already uses for React 19.

- **Cite `D013` and both decision entries in the migration's header comment.** That is what makes this
  authorised rather than a violation.
- **Do NOT amend the PRD.** No owner entry authorises editing it, and D002's precedent is explicit
  that the PRD text stays unedited so the original specification survives.
- The exemption covers **this one SELECT policy and nothing else.**

### What is NOT authorised — exceeding any of these means stop and report

- **No change to the write policies.** `own_or_linked_write` / `own_or_linked_update`
  (`20260717000002_rls.sql:205-215`) stay **byte-identical**. **Widening read is not widening write.**
- **No change to `attendance` RLS.** Attendance is a factual record and is deliberately staff-gated.
- **No `anon` access.** The policy is for **`authenticated`** only. T205 exists because an `anon`
  grant leaked a view; do not recreate that shape.
- **Do not apply the migration to hosted Supabase.** **Item 16 reserves cutover for the owner.**

---

## 3. The load-bearing premise — ALREADY PROVEN. Quote it; do not re-derive it.

v1 asked the gate to settle a contradiction between two migrations. **It did, on a real
PostgreSQL 16.13 loaded with this repo's migrations.**

**Claim B is TRUE, Claim A is FALSE.** A view carrying no `security_invoker` **executes as its owner
and never applied the querying user's RLS to begin with**, so widening `rsvps` **changes no view
output at all**. Measured, as a non-staff student session:

| | Result |
|---|---|
| direct `rsvps` read, before | **1 row** (correctly trimmed) |
| `v_planned_rsvp_hours`, same session, same instant | **3 rows — teammates' included** |
| counterfactual `set (security_invoker = on)` | **1 row**; `reset` → **3 rows** |
| after adding the new policy | direct read → **3 rows** (the fix); all three planned-hours views **byte-identical to before** |

**It generalises to hosted Supabase.** The gate re-ran it with the objects owned by a
**NOSUPERUSER, NOBYPASSRLS** role — strictly weaker than hosted's `postgres` (table owner **with**
BYPASSRLS) — and the bypass still held, so it holds there *a fortiori*.

Also settled: **`anon` read 0 rows before and after** (no `rsvps` policy names it). **Cross-student
INSERT → `42501`.** **Cross-student UPDATE → `UPDATE 0`** (see §4.2 — this matters). **`my_student_ids()`
is referenced by 10 policies** — load-bearing, not dead; do not touch it.

**`20260723000001_dashboard_views.sql:50-56` is the false comment.** So is
`20260723000000_kpi_views.sql:136-152` — **D010 filed that on 2026-07-29 and it is still open,
awaiting the owner.** Yours is the **third** in-repo confirmation. **Item 10 forbids editing an applied
migration**, so correct it **in your new migration's header**, citing D010 and D013 — never in place.
Full evidence: `docs/swarm/active/T503-gate-report.md`.

---

## 4. What to build

### 4.1 The migration — **additive second policy** (the gate settled v1's open choice)

Add a **second permissive SELECT policy** for `authenticated` alongside the existing
`own_or_linked_read`; do **not** drop or rewrite the existing one. Postgres ORs permissive policies, so
this is sufficient, it is less destructive, it leaves 8.4's verbatim `own_or_linked_read` intact
(which softens §2.1's deviation to an addition rather than a replacement), and **C5 then holds
trivially**.

Follow the header conventions of `20260803000001_revoke_anon_leaderboard_students.sql`. The header must
record: that this is **read-only** widening; that the write policies are untouched **and why**; that
**`responded_by` becomes visible**; and the **D013 / D010** citations from §2.1 and §3.

### 4.2 The test script — three corrections the gate measured

Mirror `run_t205_anon_grant.sh`. Assert:

- a non-staff authenticated user **can** read another student's row;
- that user **still cannot INSERT** another student's row (**`42501`**);
- that user **still cannot UPDATE** another student's row — **and this manifests as `UPDATE 0`, NOT an
  exception.** The row is *visible* but not *updatable*, so RLS filters it out of the UPDATE's scope
  rather than raising. **T205's exception-catch shape will mis-assert this** — do not copy it blindly;
- **`anon` gets nothing**;
- the planned-hours views return **identical rows before and after**. This requires **splitting the
  migration loop**: apply all-but-the-new migration → snapshot → apply the new one → re-snapshot.

### 4.3 Application code: expect to change NOTHING

`queryRsvpsForSessions` (`loaders/outreach.ts:784-792`) already selects **all** rsvps for the session
ids with no student filter — RLS is the only thing trimming it. **Confirmed by the gate.** If you find
yourself editing `OutreachDetail.tsx` to make the buckets correct, **stop and report**: the premise is
wrong.

---

## 5. Acceptance criteria — each names a mutation that must turn it red

| # | Criterion | Mutation |
|---|---|---|
| **C1** | A non-staff authenticated user can SELECT another student's row | drop the new policy — must fail on a real database |
| **C2** | That user **cannot** INSERT or UPDATE another student's row | widen the write policy too — C2 goes red, proving read and write stayed separate |
| **C3** | `anon` reads **nothing** | grant the new policy to `public`/`anon` instead of `authenticated` |
| **C4** | The planned-hours views return identical rows before and after | **`alter view v_planned_rsvp_hours set (security_invoker = on)`** — the gate proved this makes C4's comparison go red (1 → 3), so C4 **is** mutation-testable |
| **C5** | `own_or_linked_write` / `own_or_linked_update` **byte-identical** to `main` | verify by **sha256** of the extracted policy text, not by reading the diff |
| **C6** | No application code changed | `git diff --stat -- src/` is **empty** |

**C2 is what keeps the owner's ruling honest.** He authorised *seeing*, not *answering for other
people*. A migration widening both would satisfy C1 and silently exceed the ruling.

---

## 6. What must survive — verify, do not assume

- **T205** — the `anon` revoke. Confirm this does not re-open what it closed.
- **T193 / T119 / T121** — RSVP is **intent**, not an attendance record. This changes **who can read**,
  never what a row means.
- **T306** — its attendance view is staff-gated on purpose. **Do not widen `attendance`** on the theory
  that this ruling generalises. It does not.

---

## 7. Required worker output

`docs/swarm/active/T503-worker-output.md`:

1. **Commit SHA**, plus proof the work is in the **committed blob** (item 21).
2. **All six gates** against your measured baseline, `.env.local` absent, **plus the SQL test script's
   own exit code.**
3. **Every mutation in §5, run, with real output pasted** — C1–C4 against a real PostgreSQL, C5's
   sha256 pair.
4. **The false-comment finding filed as a third confirmation**, citing D010, and where you corrected it
   (a new migration header — *never* in place, item 10).
5. **A plain-English note for the owner**, covering: that `responded_by` becomes visible (so a parent
   answering for their child is now visible to teammates), **and that `makeLoadOutreachData`
   (`outreach.ts:1034`) now returns every rsvp row to non-staff sessions in its payload** — display is
   unchanged, since the student view filters by their own id, but the data is in the response. All
   other direct readers were verified unaffected (coach-only or `.eq('student_id')`-filtered).
6. **Anything in this packet that is wrong.** v1 carried a MAJOR, three MINORs and two NITs — all
   caught by the gate, and the MAJOR was a BLOCKER-class miss. Assume v2 has its own.
