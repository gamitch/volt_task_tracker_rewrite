# T503 — worker packet v1: widen `rsvps` SELECT so a student sees what their teammates actually answered

**Tier: HEAVY** (constitution item 26), and it is not close. This changes **RLS on a table**, which
item 26 names explicitly, and it ships a **migration**. Item 26's trigger question — *can a mistake
here corrupt data?* — is the wrong question here; the right one is *can a mistake here expose data
that should not be exposed, or silently change a number on a screen?*, and both are **yes** if the
policy is written wrong. Packet → premise gate → worker → checker, with the orchestrator replaying
every mutation.

**Branch:** `claude/t503-widen-rsvp-read`, from current `main` **`7fe4e56`**.

**Measure your own baseline.** `main` moves hourly. At `7fe4e56` it stands at `tsc` 0 · eslint
**0 errors / 364 warnings** · vitest **78 files / 1976 tests**.

---

## 1. The defect, and it is a display lie rather than a security hole

A non-staff viewer's Signups buckets show **every teammate under "No response"**, whatever they
actually answered.

`rsvps` RLS is `staff_all` plus `own_or_linked_read` (`20260717000002_rls.sql:197-203`), so a student
reads only their own row and a parent only their linked child's. `groupSessionSignups`
(`OutreachDetail.tsx`) builds its buckets by **diffing the roster** against the rsvps it can see, and
`<SessionSignupList>` renders for **every** viewer with no staff gate. So the page treats *"I am not
allowed to see this row"* as *"this student did not answer"*. Those are different facts and it
displays the wrong one.

**Pre-existing.** T306 did not cause it and deliberately did not extend it — T306's attendance view is
staff-gated precisely so it would not create a second, worse instance (attendance is a factual record;
RSVP is intent).

---

## 2. The owner's decision — build to exactly this

`auto-mode-decisions.md`, **"2026-08-03 — George's ruling on T503"** (the product half) and
**"2026-08-04 — George picks the SCOPE for T503"** (the scope). **Cite those entries, never this
paraphrase.**

**Widen SELECT on `rsvps` so any authenticated user may read any row.** He chose the widest of three
offered scopes, and gave his reasoning for visibility generally: the team already shares this
informally in chat, so the app showing it matches existing behaviour rather than introducing exposure.

### What is NOT authorised — exceeding any of these means stop and report

- **No change to the write policies.** `own_or_linked_write` and `own_or_linked_update`
  (`20260717000002_rls.sql:205-215`) stay **byte-identical**. A student still answers only for
  themselves; a parent only for their linked child. **Widening read is not widening write.**
- **No change to `attendance` RLS.** Attendance is a factual record and is deliberately staff-gated.
  This ruling is about RSVPs — intent — only.
- **No `anon` access.** The widened policy is for **`authenticated`** only. T205 exists because an
  `anon` grant leaked a view; do not re-create that shape.
- **Do not apply the migration to hosted Supabase.** **Item 16 reserves cutover for the owner.**
  Three migrations now await him. Your job ends at a committed migration plus a passing test.

---

## 3. THE QUESTION THE GATE MUST SETTLE — two migrations in this repo contradict each other

This decides whether the task's blast radius is "nothing outside the app's direct table reads" or
"every student's planned-hours figure changes".

**Claim A** — `20260723000001_dashboard_views.sql:52-56`:

> *"none of the views below are `security_definer`/`security_barrier`, so each runs under the
> querying session's own RLS against its base tables (… `rsvps` …)"*

**Claim B** — `20260803000001_revoke_anon_leaderboard_students.sql:25` and
`20260731000000_leaderboard_students_view.sql:33`:

> *"It carries no `security_invoker`, so it executes as its OWNER, which bypasses RLS."*

**These cannot both be true, and `v_planned_rsvp_hours` reads `rsvps` directly**
(`20260723000001:71-77`, redefined `20260724000001:64-70`), feeding `v_student_planned_hours` and
`v_season_upcoming_committed_hours`.

- If **B** is right, widening `rsvps` RLS changes **no view output at all** — the views never applied
  the querying user's RLS in the first place. The change is contained to the app's direct table reads.
- If **A** is right, widening `rsvps` **changes what every student's planned-hours views return**,
  which is a metric change on **W4's** surface and a far bigger task than this packet describes.

**PROVE IT BY EXECUTION.** Do not settle it by reading Postgres documentation and do not settle it by
reasoning from the comments — one of those comments is already wrong. Stand up a real PostgreSQL 16
(`/usr/lib/postgresql/16/bin/{initdb,pg_ctl}`; `psql` is on PATH), load this repo's migrations, create
a non-staff role, and **query `v_planned_rsvp_hours` as that role before and after widening the
policy.** If the returned rows differ, A is right and **this packet is wrong — return BLOCKER.**

**There is a shipped harness for exactly this**: `supabase/tests/run.sh`, `auth_stub.sql`, `seed.sql`,
and the per-task precedents `run_t205_anon_grant.sh` (an RLS/grant task, the closest analogue) and
`run_volunteer_hours_outreach_only.sh`. **Use that harness rather than inventing one.**

Also settle, because it changes the wording of the policy:
- **Does `authenticated` include the `anon` role in this schema?** It must not. Prove the widened
  policy grants nothing to `anon`.
- **Is `my_student_ids()` (`:20-26`) used anywhere that would now be dead** for the read path? Report
  it; do not delete it — it is load-bearing for the write policies.

---

## 4. What to build

**4.1 A new migration**, additive, following the naming and header conventions of
`20260803000001_revoke_anon_leaderboard_students.sql`. It replaces `own_or_linked_read` on `rsvps`
with a policy granting SELECT to `authenticated` unconditionally — or adds a second permissive SELECT
policy alongside it, **whichever the gate proves is the cleaner shape** (Postgres ORs permissive
policies, so a second policy is sufficient and less destructive; state which you chose and why).

**Write the migration's own header comment to say what it does and does not do**, in this repo's
style: that this is read-only widening, that the write policies are untouched and why, and that
`responded_by` becomes visible.

**4.2 A test script** under `supabase/tests/`, mirroring `run_t205_anon_grant.sh`'s shape, asserting:
- a non-staff authenticated user **can** read another student's `rsvps` row;
- that same user **still cannot INSERT or UPDATE** another student's row;
- **`anon` gets nothing**;
- the planned-hours views return **the same rows before and after** (the §3 finding, pinned as a test
  so a future migration cannot silently change it).

**4.3 Application code: expect to change NOTHING.** `queryRsvpsForSessions`
(`loaders/outreach.ts:789-791`) already selects **all** rsvps for the session ids with no student
filter — RLS is the only thing trimming the result. **Verify that and say so.** If you find yourself
editing `OutreachDetail.tsx` to make the buckets correct, **stop and report** — that means the premise
is wrong.

---

## 5. Acceptance criteria — each names a mutation that must turn it red

| # | Criterion | Mutation |
|---|---|---|
| **C1** | A non-staff authenticated user can SELECT another student's `rsvps` row | drop the new policy — must fail on a real database, not a mock |
| **C2** | That same user **cannot** INSERT or UPDATE another student's row | widen the write policy too — C2 must go red, proving read and write are genuinely separate |
| **C3** | `anon` can read **nothing** from `rsvps` | grant the new policy to `public`/`anon` instead of `authenticated` |
| **C4** | The planned-hours views return identical rows before and after the widening | — this is §3's finding pinned; if it cannot be made to fail, say so plainly rather than inventing a mutation |
| **C5** | `own_or_linked_write` / `own_or_linked_update` are **byte-identical** to `main` | verify by **sha256** of the extracted policy text, not by reading the diff |
| **C6** | No application code changed | `git diff --stat -- src/` is **empty** |

**C2 is the criterion that keeps the owner's ruling honest.** He authorised *seeing*, not *answering
for other people*. A migration that widens both would satisfy C1 and silently exceed the ruling.

**C5 by hash.** T309 and T406 both established this as the way a "must not change" claim is verified
in this repo; reading a diff is a weaker claim.

---

## 6. What must survive — verify, do not assume

- **T205** — the `anon` revoke. Confirm this migration does not re-open what T205 closed.
- **T193 / T119 / T121** — RSVP is **intent**, not an attendance record, and self-authored rows are
  meaningful. Nothing here may blur that; this task changes **who can read**, never what a row means.
- **T306** — its attendance view is staff-gated on purpose. **Do not widen `attendance`** on the
  theory that this ruling generalises. It does not.

---

## 7. Required worker output

`docs/swarm/active/T503-worker-output.md`:

1. **Commit SHA**, plus proof the work is in the **committed blob** (item 21).
2. **All six gates** against your own measured baseline, `.env.local` absent, **plus** the SQL test
   script's own exit code.
3. **Every mutation in §5, run, with real output pasted** — C1/C2/C3 against a real PostgreSQL, and
   C5's sha256 pair.
4. **§3's answer**, with the before/after view rows pasted, and **which of the two contradictory
   migration comments is wrong.** File that as a finding — a false claim in a migration header is
   exactly the propagation-by-imitation shape T301 was filed for.
5. **A plain-English note for the owner** on what he will see change after he applies it, including
   that `responded_by` becomes visible.
6. **Anything in this packet that is wrong.** Every packet this session carried at least one false
   claim caught downstream — two MAJORs on T406, a bad scoping assumption on T165, a vacuous criterion
   on T300. Finding another is a success, not an objection.
