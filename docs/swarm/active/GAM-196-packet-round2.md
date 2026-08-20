# GAM-196 — HEAVY task packet (round 2, **revision B**, post-owner-decision)

**Revision B applies the round-1 premise gate's required revisions.** The gate
returned **REVISE (1 BLOCKER)**; its report is
`docs/swarm/active/GAM-196-premise-gate-round2.md`. Every one of its ten required
revisions is answered below, at the point it applies, and the two it required to
be *filed* are filed. Nothing was argued around.

**Supersedes** `docs/swarm/active/GAM-196-packet.md` (run 1, refuted) entirely.

**Issue:** GAM-196 — *T188 — two different "confirmed hours" numbers exist in the
app and can legitimately disagree.*
**Tier:** HEAVY (`tier/heavy`).
**Worktree:** `/home/runner/work/volt_task_tracker_rewrite/volt_task_tracker_rewrite`,
branch `claude/gam-196-confirmed-hours-divergence`.

---

## 0. The authorization, quoted rather than summarized

Two dispatch runs refused this row because the fix required a product decision no
agent may make. On **2026-08-20T11:16:18Z** the owner made it, on the issue:

> We should use option A, if i understand i correctly. 1 set of hours for intent
> to attend (RSVP) and 2nd is the actual attendance hours `v_student_hours. is
> seems that way now, but if it's not that is how it should be.`

At `11:16:33Z` the owner removed `gate/human`; at `11:17:58Z` the owner asked for
parallel execution; the row was re-dispatched.

**Option A, as GAM-196 itself defines it** — this is the text the owner was
selecting, and it names both the page and the word:

> **(a) Name them differently on screen.** Cheap and honest; keeps both numbers
> and both purposes. `/outreach` would say something like "hours you signed up
> for" rather than "confirmed".

**Option B is NOT authorized.** No hours arithmetic changes. `/outreach` does not
start reading `v_student_hours`.

---

## 1. The defect, measured

`/outreach` computes **both** of its hours figures from RSVPs
(`src/pages/outreach/OutreachList.tsx:1380-1399`):

| figure | rule | touches `attendance`? |
| -- | -- | -- |
| `confirmedHours` | a `going` RSVP on a **`completed`** session | **no** |
| `plannedHours` | a `going` RSVP on a **`scheduled`** session | no |

Everywhere else the word *confirmed* means the attendance-backed `v_student_hours`
(`loaders/reports.ts:425`, `loaders/coachHome.ts:350`, `loaders/leaderboard.ts:138`,
`supabase/functions/send-reminders/index.ts:512`, plus `v_student_goal_projection`
which LEFT-JOINs it and feeds StudentHome/ParentHome/CoachHome). One word, two
quantities, and the page never says so.

**Gate revision 3 — the coach row already mixes the two sources, and this packet
must say so.** On a past event row the coach sees, side by side:
`Signed up 0h` (RSVP-derived, `:1939`) · `Attended 2 students` (**real
attendance**, `:1901-1908`, consumed `:1934` — a prior CHECKER FIX that reworked
T121 as MAJOR) · `Reached 45`. That contradiction exists **today** under the label
`Logged`, where it is invisible because the label lies. §3.3 is deferred (below)
precisely so this packet does not surface it without a disclosure; the row that
owns it is **GAM-431**.

**Gate revision 10 — the deviation is real and is now a filed row, not an
intention.** PRD `OUT-05` (`VOLT_Portal_PRD.md:319`) specifies that marking a day
complete writes `attendance` rows and *"hours computed per MET-03"*; `MET-04`
(`:566`) defines the goal bar as Σ MET-03; `metric_views.sql:3-19` implements it.
So `/outreach`'s past-session hours — and, via `PRD:485`, its student goal bar —
are **specified attendance-backed**, and are not. **Route (a) is a labelling
change over a live spec deviation, and this packet says so on its face.** The
deviation is filed as **GAM-430**.

**`plannedHours` is not part of the defect and must not be renamed.** `MET-04`
defines planned hours as *"Σ duration of future `going` sessions"* — exactly what
the page computes.

---

## 1a. The BLOCKER, and why this packet proceeds (gate revision 1)

**The gate is right on the facts and I am not disputing them.** Measured myself
before answering:

- `VOLT_Portal_PRD.md:485`, inside OUT-01's own wireframe: *"STUDENT: goal bar =
  own hours (MET-04)"*.
- `docs/swarm/task-ledger.md:595-597` — T038's objective and acceptance criteria
  bind this bar to BEH-02 by name: *"student variant: own goal bar (BEH-01/BEH-02
  confirmed+planned segments, never summed)"*. T038 is **Passed**.
- `OutreachList.tsx:2085-2087` — the shipped source cites BEH-02 itself.

So `/outreach`'s student goal bar **is** a BEH-02 bar, and BEH-02
(`VOLT_Portal_PRD.md:246`) prescribes the legend *"62 h confirmed + 14 h planned"*.
The gate's escape-refutation stands. **§6.1 of revision A is withdrawn.**

**What the gate asks for is the owner's sign-off, and it already exists.** The
non-negotiable at `constitution.md:14` reads *"Protected source text must remain
verbatim **unless explicitly approved**."* The approval clause is the whole of the
question, and it is satisfied: the owner selected, by name, an option whose text
says `/outreach` should say *"hours you signed up for" rather than "confirmed"*.
That is not an inference from "route (a)" in the abstract — it is the specific
sentence the owner was choosing between.

**Two further facts that make this a disclosure rather than a new deviation**, and
the gate established both itself:

1. BEH-02's *"confirmed hours"* means Σ MET-03, i.e. attendance. `/outreach`'s
   accent segment is not that. **The page already deviates from BEH-02, silently,
   in the data.** Renaming the label does not create a deviation; it stops the
   page from claiming compliance it does not have.
2. **The prescribed literal is not removed from the app.** BEH-02's legend format
   `"62 h confirmed + 14 h planned"` is rendered verbatim at
   `src/pages/home/StudentHome.tsx:1647` off the attendance-backed
   `v_student_goal_projection`, and by `CoachHome.tsx:2050`. Neither is in Allowed
   Files; both are untouched. `/outreach`'s strings (`Confirmed`,
   `9 hrs confirmed`) were never that literal — they share a word with it.

**Residual risk, stated rather than hidden:** if the owner reads "option A" as
approving the *principle* but not the *word*, §3.1 needs a second sign-off. The PR
body leads with this so the owner can reverse one commit's worth of copy. GAM-430
carries the underlying spec question either way.

---

## 2. Allowed Files

A worker may edit **only**:

- `src/pages/outreach/OutreachList.tsx`
- `src/pages/outreach/OutreachList.test.tsx`

**Forbidden**, each for a stated reason:

| path | why not |
| -- | -- |
| `src/components/GoalBar.tsx`, `StatCell.tsx` (+ their tests) | presentational shells taking strings as props. **Measured by the gate with the change applied: both stay green.** Do not touch. |
| `src/pages/home/**`, `src/pages/reports/**`, `Leaderboard.tsx`, `src/emails/**` | these read `v_student_hours`; *confirmed* is **correct** there, and `StudentHome.tsx:1647` is where BEH-02's prescribed legend actually lives. |
| `supabase/**`, any migration or SQL | option B is not authorized. |
| `docs/swarm/**`, `.claude/**`, `.github/workflows/**`, `AGENTS.md` | orchestrator-owned; AGENTS.md wall 1. |

**Known rot left in place, disclosed so a checker does not file it as new (gate,
MINOR).** `src/components/StatCell.tsx:13,:44` name `"Logged"`/`"Confirmed"` as
canonical labels and `:25` cites a stale test line. `StatCell.tsx` is forbidden
here; the rot is carried by **GAM-431**.

---

## 3. The change, literal

No arithmetic changes. Field names (`confirmedHours`, `plannedHours`) stay — they
are internal. Only user-visible strings and the comments describing them move.

**3.1 `GoalProgressBar`** (`:2106`; rendered `label="Team season goal"` `:3459`
and `label="Your season goal"` `:4010`). Every line below was re-confirmed exact
by the gate:

| line | from | to |
| -- | -- | -- |
| `2146` | `` `${confirmedHours} of ${goalHours} hours confirmed; ${plannedHours} more planned` `` | `` `${confirmedHours} of ${goalHours} hours signed up; ${plannedHours} more planned` `` |
| `2152` | `Confirmed` | `Signed up` |
| `2155` | `{confirmedHours} hrs confirmed` | `{confirmedHours} hrs signed up` |
| `2007` | `` …the season goal (confirmed hours).` `` | `` …the season goal (signed-up hours).` `` |
| `2160`, `2163`, `2168`, `2171`, `2176`, `2179` | `Planned` / `hrs planned` / `Goal` / `% of goal` | **unchanged** |

**3.2 One explanatory line — the half of the fix that renaming alone does not
deliver.** GAM-196's complaint is *"neither says which is which."* Insert
immediately after the four-tile `HStack` closes at `:2182` and **before** the
milestone `HStack` at `:2183`.

**Copy corrected per gate revision 7 and independently per `checker-content`
(MAJOR, same finding from both).** The original draft said *"not check-in"*.
PRD `OUT-07` (`:321`) states outreach has **no check-in** in v1 — completion is
coach-driven — so that clause named a mechanism this page does not have.

**Exact block to insert, already prettier-clean at this indentation (gate revision
7 measured the original block failing `npm run format:check`):**

```tsx
        <Text type="supporting" color="secondary">
          From outreach sign-ups, not attendance. Confirmed hours from attendance appear on the
          home page and in reports.
        </Text>
```

`Text` is in scope (used at `:2151`). The second sentence was verified accurate
for **student** (`StudentHome.tsx:1647`), **parent** (`ParentHome.tsx:1424-1455`)
and **coach** (`CoachHome.tsx:2050`) — all attendance-backed. Sentence case
(DES-14); no urgency, scarcity or loss framing (item 17 — `checker-content`
passed it explicitly).

**3.3 — DEFERRED, do not implement (gate revision 2).** Revision A proposed
renaming the coach event-row `StatCell` label `Logged` → `Signed up` at `:2824`
and `:2958`. **Removed from this packet.** Reasons, all the gate's and all
measured: OUT-01 (`PRD:315`) and its wireframe (`PRD:482`) specify that cell as
*"hours awarded"*, so `Signed up` moves it further from spec, not closer; the
owner's quote authorizes changing the word *confirmed*, and that cell says
*Logged*; and the rename would surface the `Signed up 0h · Attended 2 students`
contradiction with no disclosure. It is filed as **GAM-431**. This also retires
the column-width question the gate raised as revision 9 (`:2943`'s measured 84px
natural-content ceiling under a `pixel(102)` budget set by T131) — no label on
that column changes, so nothing to re-measure.

**3.4 Comments that now state something false.** Update in place; do not delete:

- `:715-720` — says the RSVP formula *"is tracked separately as T188, not
  reconciled here."* Reconciled now, by naming rather than arithmetic. Name
  GAM-196, the owner's option-A decision, and **GAM-430** for the spec deviation.
- `:1374-1379` — `computeStudentHours`'s JSDoc. Keep the mechanism description;
  add that the **user-visible** name for that field on `/outreach` is *signed up*,
  and that *confirmed* is reserved app-wide for the attendance-backed
  `v_student_hours`. Cite the contrast case the gate supplied:
  `src/pages/reports/HoursTab.tsx:743` carries the parallel milestone string
  *"reached N% of the season hours goal (confirmed hours)"* over genuinely
  attendance-backed data.
- `:59-65` module doc, if it repeats either claim.

---

## 4. Tests — the MEASURED red set (gate revision 4)

Revision A listed 34 line numbers and called them 25 assertions. **Both figures
were wrong.** The gate applied §3 in its own worktree and ran the full suite:
`Test Files 1 failed | 100 passed (101)`. The true red set is **14 assertions in
11 test cases**, all in `src/pages/outreach/OutreachList.test.tsx`:

> **1272, 1624, 1644, 1647, 1815, 1867, 1911, 1931, 2259, 2268, 2294, 2300, 2315, 2331**

Note `1272` is `'Logged0h'`. **§3.3 is deferred, so `1272` must NOT change** —
`Logged` stays. **The red set this worker owns is therefore the other 13.**

**DO NOT TOUCH these 20 lines — they are green and stay green:** 1264, 1268,
1625, 1643, 1645, 1646, 1648, 1816, 1868, 1912, 1943, 2260, 2295, 3540, 3572,
3577, 3579, 3633, 3641, 3643. They assert `Planned3h`, `7 hrs planned`,
`Planned—` and similar. Editing one is a defect, not a fix.

Update **expected strings only**. Do not weaken an assertion to a regex, and do
not delete one.

**Add one new assertion** proving §3.2 renders: assert the container text contains
`From outreach sign-ups, not attendance.` in an existing test that already mounts
the goal bar.

---

## 5. Acceptance criteria (each measurable today)

1. `grep -n 'hrs confirmed' src/pages/outreach/OutreachList.tsx` → **no match**.
   The bar renders `Signed up` and `{n} hrs signed up`.
2. The bar's `aria-valuetext` reads `… hours signed up; … more planned`. The
   accessible name (`Team season goal` / `Your season goal`) is unchanged, and
   there is still exactly one `role="progressbar"` on the page — asserted at
   **`src/pages/outreach/OutreachList.test.tsx:1621`** (gate revision 5: revision
   A cited `:1343`, which is a blank line).
3. §3.2's line renders and is asserted by a test.
4. **`Logged` is still present at `:2824` and `:2958`** — §3.3 is deferred, and
   removing it is out of scope.
5. **No behaviour change.** No expression inside the *function bodies* of
   `sessionHours`, `computeStudentHours`, `computeGroupHours`, `confirmedPercent`
   or `computeEventRowStats` is edited. **The JSDoc above `computeStudentHours`
   IS edited per §3.4 and that hunk is expected** — gate revision 6: revision A's
   criterion forbade what §3.4 mandated, and a `git diff` hunk header cannot tell
   a doc comment from a body.
6. **No file outside §2's Allowed Files is modified.**
7. All six gates green via the `gate-run` skill, with the gate-measured baselines
   (revision 8): `--baseline-tests 2583 --baseline-scoped 129`. Scoped run:
   `npx vitest run src/pages/outreach/OutreachList.test.tsx src/components/GoalBar.test.tsx src/components/StatCell.test.tsx`.
   Do not pipe any gate through `tail`/`grep`/`wc` — the exit code must come from
   the process.

**Named mutation (item 26 — run it, report the real red output).** Commit the fix
first (item 26's fast-tier working rule: `git checkout --` on a mutation also
reverts an uncommitted fix). Then revert `:2152` `Signed up` → `Confirmed`, run
the scoped command, record the failing output and exit code, restore, re-run
green. Mutate in your **own worktree** (item 23), never the shared tree.

---

## 6. Least confident decisions (item 19d)

1. **That the owner's "option A" is explicit approval for the word, not only the
   principle.** §1a is the whole argument. **What would make me wrong:** the owner
   saying they meant the disclosure line only. Cheap to reverse — one commit of
   copy — and the PR body leads with it.
2. **That deferring §3.3 is better than shipping it.** The gate says defer;
   `checker-content` says the rename is a *correctness improvement* and the more
   accurate string. **Two checkers disagreed and I followed the gate**, because
   OUT-01/`PRD:482` specify that cell's content and that is an owner copy decision.
   **What would make me wrong:** `Logged` is a false label shipping for longer.
   GAM-431 carries it.
3. **That `Signed up` is the right words.** `checker-content` concurred it is the
   least-bad of the named alternatives (*Committed* collides with
   `CoachHome.tsx:2577`; *RSVP'd* fails DES-14; *Expected* is taken by the adjacent
   head count at `:2828`) and logged the echo with OUT-03's `[Sign up]` control as
   a watch-item, not a blocker. **What would make me wrong:** a reader taking
   "signed up" on an hours tile as a count of people.
4. **That the red set is exactly 13 lines once `1272` is excluded.** Measured by
   the gate with the *full* §3 applied — including §3.3, which is now deferred.
   **What would make me wrong:** the deferral changing which assertions move. The
   worker must run the suite, not trust the list.
5. **That no acceptance criterion is needed for layout.** Justified only because
   §3.3 was deferred; §3.2 adds a full-width supporting line inside a `VStack`,
   not a table cell. **What would make me wrong:** the new line wrapping badly at
   a narrow viewport. The `layout-measurement` skill is the instrument if a
   checker doubts it.

---

## 7. Out of scope, deliberately

- Any hours arithmetic anywhere (option B) — **GAM-430** owns the spec question.
- The coach event-row `Logged` label and `StatCell.tsx`'s stale doc — **GAM-431**.
- Wording on home, leaderboard, reports, roster, or the weekly digest.
- Collapsing `GoalProgressBar`'s four hand-rolled tiles into `StatCell` — the gate
  suggested it and also said not to fold it in; `StatCell.tsx:20-27` records a
  deliberate deferral against exactly that refactor.
- GAM-428 (planned hours counting competitions) — separate, independent row.
