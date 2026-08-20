# GAM-196 — HEAVY task packet (round 2, post-owner-decision)

**Supersedes** `docs/swarm/active/GAM-196-packet.md`, which was written before the
owner answered the product question and which the round-1 premise gate returned
**REVISE** on. That packet proposed a `counts_volunteer_hours` alignment; the gate
refuted it. **None of it is carried forward.**

**Issue:** GAM-196 — *T188 — two different "confirmed hours" numbers exist in the
app and can legitimately disagree.*
**Tier:** HEAVY (`tier/heavy`). Defence in the run log; unchanged from run 1.
**Branch / worktree:** `claude/gam-196-confirmed-hours-divergence` at
`/home/runner/work/volt_task_tracker_rewrite/volt_task_tracker_rewrite`.

---

## 0. The authorization, quoted rather than summarized

Two dispatch runs refused this row because the fix required a product decision no
agent may make. On **2026-08-20T11:16:18Z** the owner made it, on the issue:

> We should use option A, if i understand i correctly. 1 set of hours for intent
> to attend (RSVP) and 2nd is the actual attendance hours `v_student_hours. is
> seems that way now, but if it's not that is how it should be.`

At `11:16:33Z` the owner removed `gate/human`; at `11:17:58Z` the owner added
*"When executing, try to dispatch as many agents in parallel to perform the work
quickly, but with high quality"*; the row was then re-dispatched.

**Option A, as GAM-196 itself defines it:** *"Name them differently on screen.
Cheap and honest; keeps both numbers and both purposes. `/outreach` would say
something like 'hours you signed up for' rather than 'confirmed'."*

**Option B is NOT authorized.** Do not change any hours arithmetic. Do not make
`/outreach` read `v_student_hours`. This packet changes user-visible wording and
comments only.

---

## 1. The defect, measured

`/outreach` computes **both** of its hours figures from RSVPs
(`src/pages/outreach/OutreachList.tsx:1380-1399`, read 2026-08-20):

| figure | rule | touches `attendance`? |
| -- | -- | -- |
| `confirmedHours` | a `going` RSVP on a **`completed`** session | **no** |
| `plannedHours` | a `going` RSVP on a **`scheduled`** session | no |

Everywhere else in the app, the word *confirmed* means the attendance-backed
`v_student_hours` — four direct readers: `src/lib/supabase/loaders/reports.ts:425`,
`src/lib/supabase/loaders/coachHome.ts:350`,
`src/lib/supabase/loaders/leaderboard.ts:138`,
`supabase/functions/send-reminders/index.ts:512`.

So one word names two different quantities, and the page reading it never says so.
The coach event rows are worse: `OutreachList.tsx:2824` and `:2958` label that same
RSVP-derived number **`Logged`**, which asserts an attendance log that was never
consulted.

**`plannedHours` is not part of the defect and must not be renamed.** PRD `MET-04`
(`docs/swarm/VOLT_Portal_PRD.md:566`) defines planned hours as *"Σ duration of
future `going` sessions"* — exactly what the page computes. It is already correct.

---

## 2. Allowed Files

A worker may edit **only** these:

- `src/pages/outreach/OutreachList.tsx`
- `src/pages/outreach/OutreachList.test.tsx`

**Explicitly forbidden**, and each for a stated reason:

| path | why not |
| -- | -- |
| `src/components/GoalBar.tsx`, `StatCell.tsx` | presentational shells; they take the strings as props. No string of ours lives there. |
| `src/components/GoalBar.test.tsx`, `StatCell.test.tsx` | their `valueText` / `label` values are test-local **inputs**, not produced by `OutreachList`. They do not go red and must not be touched. |
| `src/pages/home/**`, `src/pages/reports/**`, `src/pages/outreach/Leaderboard.tsx`, `src/emails/**` | these read `v_student_hours`; *confirmed* is **correct** there. Renaming them would create the defect this task removes. |
| `supabase/**`, any migration, any SQL | option B is not authorized. No arithmetic changes. |
| `docs/swarm/**`, `.claude/**`, `.github/workflows/**`, `AGENTS.md` | orchestrator-owned (constitution ownership section; AGENTS.md wall 1). |

---

## 3. The change, literal

No arithmetic changes. Field names (`confirmedHours`, `plannedHours`) stay — they
are internal. Only user-visible strings and the comments that describe them move.

**3.1 `GoalProgressBar`** (renders both `label="Team season goal"` at `:3459` and
`label="Your season goal"` at `:4010`):

| line | from | to |
| -- | -- | -- |
| `2146` | `` `${confirmedHours} of ${goalHours} hours confirmed; ${plannedHours} more planned` `` | `` `${confirmedHours} of ${goalHours} hours signed up; ${plannedHours} more planned` `` |
| `2152` | `Confirmed` | `Signed up` |
| `2155` | `{confirmedHours} hrs confirmed` | `{confirmedHours} hrs signed up` |
| `2160`, `2163` | `Planned` / `{plannedHours} hrs planned` | **unchanged** |
| `2168`, `2171`, `2176`, `2179` | `Goal` / `% of goal` tiles | **unchanged** |
| `2007` | `` `${label}: reached ${milestone}% of the season goal (confirmed hours).` `` | `` `${label}: reached ${milestone}% of the season goal (signed-up hours).` `` |

**3.2 One explanatory line — this is the half of the fix that renaming alone does
not deliver.** GAM-196's complaint is *"two screens describe the same thing with
different numbers and neither says which is which."* Add, immediately after the
four-tile `HStack` and **before** the milestone `HStack` (i.e. after `:2182`):

```tsx
<Text type="supporting" color="secondary">
  From outreach sign-ups, not check-in. Confirmed hours from attendance appear on
  the home page and in reports.
</Text>
```

Sentence case (DES-14). No urgency, scarcity, or loss framing (constitution item
17). `Text` is already imported.

**3.3 Coach event-row stat**, both render sites — `:2824` (narrow/stacked card)
and `:2958` (desktop column):

```
label={bucket === 'upcoming' ? 'Planned' : 'Logged'}
```
becomes
```
label={bucket === 'upcoming' ? 'Planned' : 'Signed up'}
```

**3.4 Comments that now state something false.** Update in place; do not delete:

- `OutreachList.tsx:715-720` — says the RSVP formula *"is tracked separately as
  T188, not reconciled here."* It is reconciled now, by naming rather than by
  arithmetic. Say that, and name GAM-196 and the owner's option-A decision.
- `OutreachList.tsx:1374-1379` — `computeStudentHours`'s doc says
  *"`going` + `completed` -> confirmed"*. Keep the mechanism description, but add
  that the **user-visible** name for that field is *signed up*, and that
  *confirmed* is reserved app-wide for the attendance-backed `v_student_hours`.
- The module doc at `:59-65` if it repeats either claim.

---

## 4. Tests the worker must update (they are supposed to go red)

`src/pages/outreach/OutreachList.test.tsx` — 25 assertions pin the current
strings. Update the **expected strings only**; do not weaken an assertion into a
regex or delete one.

`1264`, `1268` (`'Planned3h'`, `'Planned4h'` — these stay), `1272`
(`'Logged0h'` → `'Signed up0h'`), `1624`, `1625`, `1643-1648`, `1815`, `1816`,
`1867`, `1868`, `1911`, `1912`, `1931`, `1943`, `2259`, `2260`, `2268`, `2294`,
`2295`, `2300`, `2315`, `2331`, `3540`, `3572`, `3577`, `3579`, `3633`, `3641`,
`3643`.

**Add one new assertion** proving 3.2 renders: assert the container text contains
`From outreach sign-ups, not check-in.` in a `StudentParentOutreachView` test that
already mounts the goal bar.

---

## 5. Acceptance criteria (each is measurable today)

1. `/outreach`'s goal bar renders **`Signed up`** and **`{n} hrs signed up`**, and
   the string `hrs confirmed` **no longer appears anywhere** in
   `OutreachList.tsx`. (`grep -n 'hrs confirmed' src/pages/outreach/OutreachList.tsx` → no match.)
2. The bar's `aria-valuetext` reads `… hours signed up; … more planned`. The
   accessible name (`aria-labelledby` → `Team season goal` / `Your season goal`)
   is unchanged, and there is still exactly one `role="progressbar"` on the page
   (`OutreachList.test.tsx:1343` pins this).
3. `Logged` no longer appears as a `StatCell` label in `OutreachList.tsx`; both
   `:2824` and `:2958` read `Signed up`. Both sites changed — the desktop column
   and the narrow card are different code paths and a checker must confirm both.
4. The explanatory line from 3.2 renders on the page and is asserted by a test.
5. **`Planned` / `hrs planned` are untouched**, and no hours arithmetic changed:
   `git diff main...HEAD -- src/pages/outreach/OutreachList.tsx` shows no edit
   inside `sessionHours`, `computeStudentHours`, `computeGroupHours`,
   `confirmedPercent`, or `computeEventRowStats`.
6. **No file outside §2's Allowed Files is modified.**
7. All six gates green via the `gate-run` skill, including the scoped run
   `npx vitest run src/pages/outreach/OutreachList.test.tsx src/components/GoalBar.test.tsx src/components/StatCell.test.tsx`.
   Do not pipe any gate through `tail`/`grep`/`wc`.

**Named mutation (item 26 — it must be run and its red output reported).**
Commit the fix first. Then revert `:2152` `Signed up` back to `Confirmed`, run the
scoped vitest command, and record the real failing output and exit code. Restore,
re-run green. Mutation runs in an isolated worktree (item 23), never the shared
tree.

---

## 6. Least confident decisions (item 19d) — attack these first

1. **That renaming `/outreach`'s label does not violate PRD `BEH-02`.**
   `VOLT_Portal_PRD.md:246` prescribes a literal legend — *"62 h confirmed + 14 h
   planned"* — and constitution item 14 plus the non-negotiable at
   `constitution.md:14` make prescribed PRD copy owner-approval territory. My
   argument: BEH-02 governs *"the student hours bar"*, and that bar is
   `StudentHome.tsx:1647`, which renders `X h confirmed + Y h planned` from the
   attendance-backed `v_student_goal_projection` and is **not touched** by this
   packet. `/outreach`'s bar is OUT-01's *"season goal summary"*
   (`VOLT_Portal_PRD.md:315`). **What would make me wrong:** if BEH-01
   (`:245`) listing `OUT-01` among *"every hours-vs-goal ProgressBar"* means BEH-02's
   legend binds `/outreach` too. If so, this is a PRD-copy change and needs the
   owner's explicit sign-off on the words, not just on route (a).
2. **That the owner's "option A" authorizes changing the word `confirmed` on
   `/outreach` at all.** The owner's own sentence is a two-bucket model — RSVP
   intent, and actual attendance. `/outreach`'s past-session figure is *neither*:
   it is intent applied retrospectively. I read option A as requiring it be named
   as intent. **What would make me wrong:** if the owner meant only "leave both
   numbers alone, they are already fine" — the sentence *"is seems that way now"*
   admits that reading. The counter is the next clause, *"but if it's not that is
   how it should be"*, plus GAM-196's own definition of (a) naming `/outreach`
   and the word *confirmed* explicitly.
3. **That `Signed up` is the right words.** Alternatives: *Committed* (collides
   with `CoachHome.tsx:2577` `Upcoming commitment`), *RSVP'd* (jargon, fails
   DES-14's plain-verb rule), *Expected* (already used for a head count at
   `:2828`). **What would make me wrong:** a coach reading `Signed up` on a *past*
   event row and expecting a headcount rather than hours — `:2828`'s neighbouring
   `Attended … students` sits right beside it.
4. **That OUT-05 does not make this route (b) in disguise.**
   `VOLT_Portal_PRD.md:317` says marking a day complete creates `attendance` rows
   and *"hours computed per MET-03"*. That is an argument the PRD wants
   `/outreach`'s past figure to be attendance-backed — i.e. route (b). The owner
   chose (a), so this packet does not act on it. **What would make me wrong:**
   nothing about the change; but if OUT-05 does bind, then (a) is a labelling
   patch over a genuine spec deviation and a follow-up row must be filed under
   item 20. **I intend to file that follow-up regardless.**
5. **That the 25-assertion list in §4 is complete.** It comes from a recon
   subagent, and I have spot-verified `:2152`/`:2155`/`:2824`/`:2958`/`:2007`/
   `:2146` in the source myself but not every test line. **What would make me
   wrong:** an assertion elsewhere in the suite (e.g. an accessibility snapshot)
   pinning `hrs confirmed`. The full-suite gate catches this; the worker must not
   treat the list as exhaustive.

---

## 7. Out of scope, deliberately

- Any change to hours arithmetic anywhere (option B).
- Any change to `v_student_hours` or any migration.
- Any wording change on home, leaderboard, reports, roster, or the weekly digest.
- GAM-428 (planned hours counting competitions) — separate, independent row.
