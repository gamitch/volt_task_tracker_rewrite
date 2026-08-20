# GAM-196 run log

**Issue:** [GAM-196 — T188 — two different "confirmed hours" numbers exist in the app and can legitimately disagree](https://linear.app/gamitch/issue/GAM-196/t188-two-different-confirmed-hours-numbers-exist-in-the-app-and-can)
**Branch:** `claude/gam-196-confirmed-hours-divergence`
**Runtime:** Claude (dispatch run). Route: no `executor/*` label → item 28b migration-only default, legacy Claude-only.
**Header note added by the second dispatch run:** the line above originally ended
*"No `gate/human`."* That was true for the first run and is **false now** — GAM-196
carries `gate/human` and a machine may not claim it (item 28b). Corrected rather
than deleted, because a stale header at the top of a log is what the second run
had to disprove.

Append-only. One line per milestone, pushed immediately. If the last line of this
file is a subagent dispatch with no matching verdict line, **the run died holding
that subagent** — that is the signature of the failure described in AGENTS.md
wall 2, not a run that is "still thinking".

---

## Tier judgment (item 26 / item 28d) — made BEFORE the `In Progress` move

**Verdict: HEAVY.**

- Item 26's deciding question is *"can a mistake here corrupt data, or lie to a
  user about their own data?"* This row **is** that question in its pure form:
  its entire subject is a student's own confirmed volunteer-hours total showing
  two different values on two screens. A wrong fix here does not merely look
  wrong — it tells a minor volunteer the wrong number of hours they have earned.
- The candidate fixes land on metric semantics. Route (b) in the issue would
  make `/outreach` read the attendance-backed number, i.e. `v_student_hours` —
  **metric-view SQL is an explicit HEAVY trigger** in item 26 and PRD 8.4
  territory under constitution item 3.
- The row is **contested and multi-part by its own admission**: it names four
  divergences, states that divergence (4) was *inferred* at the render layer
  rather than observed, and explicitly asks for an owner ruling between two
  fixes that point in opposite directions. Item 19's premise gate is the exact
  instrument for a plan resting on claims of that shape, and the claims are
  15 days old (diagnosed 2026-08-05, filed 2026-08-09, today 2026-08-20).
- FAST is excluded on its face: it requires *all* of no write path, ≤20 lines,
  and a named red-turning mutation — the scope here is not yet bounded enough to
  assert any of the three. STANDARD is excluded because the divergence-(4)
  measurement is the load-bearing claim and a worker must not be the one to
  confirm it.
- Item 26: *"If two tiers are arguable, take the heavier one."*

**Consequence:** packet → `checker-premise` (DISPATCH required, item 19) →
worker → `checker-reviewer`. Two-round gate cap (19a), three-attempt worker cap.

---

## Milestones

- `2026-08-20` **CLAIMED.** Fetched GAM-196 live from Linear. Tiered
  `tier/unreviewed` → `tier/heavy` FIRST (item 28d), then moved `Todo` →
  `In Progress`, then **read back**: `state = In Progress`,
  `labels = [tier/heavy]`. Read-back confirms the claim is held, not hoped for.
- `2026-08-20` Branch `claude/gam-196-confirmed-hours-divergence` created off
  `main` @ `b9396c9`. Run log is the first file write on it.
- `2026-08-20 02:59Z` **Credential deadline read, not guessed** (AGENTS.md wall 3):
  `ghs_` token `iat 2026-08-20T02:57:39Z` / `exp 2026-08-20T03:57:39Z` — 58 min
  of PR credential at the time of reading.
- `2026-08-20` **DRAFT PR OPENED EARLY:** [#210](https://github.com/gamitch/volt_task_tracker_rewrite/pull/210),
  at roughly minute 4, carrying only the run log and the PR-body artifact.
  Body artifact `docs/swarm/active/GAM-196-pr-body.md` written and validated
  (`check.mjs` → `OK declaration closes GAM-196`) BEFORE the API call, per the
  `pr-body` skill.
- `2026-08-20` **PACKET WRITTEN:** `docs/swarm/active/GAM-196-packet.md`
  (HEAVY, round 1). Orchestrator verified every citation against this branch
  first (item 19c). Headline: **3 of the row's 4 divergences survive; divergence
  (4) is FALSIFIED as written** — the render path already filters
  `type === 'outreach'` at `OutreachList.tsx:4254-4258` before sessions reach
  `computeStudentHours`, so a meeting cannot reach it on the live page. A
  different, unnamed divergence (4′) sits behind it: `v_student_hours` joins on
  `e.counts_volunteer_hours` while `/outreach` filters on `type`, so an outreach
  event with the flag false diverges. That slice needs no owner ruling and is the
  packet's work; (1)(2)(3) need the owner's (a)/(b) ruling and are escalated.
- `2026-08-20` **DISPATCHING `checker-premise`** (item 19, round 1 of max 2),
  `run_in_background: false`, blocking. **If this line is the last one in this
  file, the run died holding this subagent** — that is AGENTS.md wall 2, not a
  run still thinking.
- `2026-08-20` **`checker-premise` VERDICT: REVISE** (round 1/2). Returned, not
  lost — 62 tool calls, ~10 min, 115.6K tokens. It ran rather than read: scratch
  Postgres with the migrations applied, `pg_get_viewdef`, its own worktree,
  `tsc --noEmit`, 108 real tests, a behaviour probe. Findings that change the
  outcome:
  - **BLOCKER** — my divergence (4′) is **UI-unreachable**.
    `OutreachEventDialog.tsx` forces `countsVolunteerHours: true` for every
    outreach event (`OUTREACH_FIXED_FLAGS`); `meetings.ts` hard-codes `false`
    for meetings; `scripts/migrate/transform.ts` maps outreach → `true`. No DB
    constraint couples them, but **no writer can produce the combination**. The
    packet's shipped work would change no reachable number.
  - **MAJOR** — I cited a **superseded** migration. The live `v_student_hours`
    is `20260804000000_volunteer_hours_outreach_only.sql:44-60`, joining
    `counts_volunteer_hours AND type = 'outreach'` — so the predicate delta is
    `(type AND flag)` vs `(type)`, not "flag vs type" as I wrote.
  - **MAJOR** — the *reachable* member of this divergence family is elsewhere:
    a **competition** event with the admin volunteer-hours Switch on yields
    planned hours on `StudentHome`/`HoursTab` that can never become confirmed
    hours in the post-T322 view. Outside this packet's Allowed Files.
  - **MAJOR** — acceptance criterion 3 was unsatisfiable as written (measured
    `TS2554` at the three frozen call sites); a cheaper seam exists that needs
    zero test edits.
  - Divergence (4) dissolved: **UPHELD** (all four call sites traced).
  Verdict recorded here per item 19. Gate report to follow as an artifact.
- `2026-08-20` **NO ROUND 2, and the reason is not the clock.** A second gate
  round is for a packet whose *wording* is wrong (item 19a). This packet's
  *premise* is wrong: the slice it proposed is unreachable, and the slice the
  row proposed as separable is already implemented. A rewrite cannot manufacture
  work that does not exist.
- `2026-08-20` **FOLLOW-UP FILED (item 20): GAM-428** — *Planned volunteer hours
  count competitions that can never become confirmed hours*
  (`StudentHome.tsx:872`, `HoursTab.tsx:481`, no `type` test; reachable via the
  admin Switch at `OutreachEventDialog.tsx:1432-1437`). Filed to `Backlog` with
  `unreviewed` + `provenance/premise-gate`, per GAM-382. Written through the
  `linear-task-writing` skill (item 30); every line number re-opened first.
- `2026-08-20` **GAM-196 RELEASED to `Todo` with `gate/human`.** Read back:
  `state = Todo`, `labels = [tier/heavy, gate/human]`, original description
  preserved verbatim in a `<details>` block (item 30d, verified by string
  containment, not by eye). `gate/human` is what stops the `Todo` move from
  re-dispatching another machine into the same wall — `linear-assert-released.mjs`
  treats `Todo` as a PASS calling it "a correct refusal to proceed", and its own
  header (`:46-50`) names the self-re-dispatch incentive this label closes.
- `2026-08-20` **PR #210 finalized and CLOSED UNMERGED.** Four Markdown files,
  zero source changes. Merging would have driven GAM-196 to `Done` via the
  branch-name link and the `PR merge → Done` automation (item 28f: omitting a
  magic word protects nothing), and GAM-196 is not done. The branch stays pushed
  so the packet, the gate report and this log survive; both Linear rows link to it.
- `2026-08-20` **RUN COMPLETE.** No source changed, by decision and not by
  timeout. No subagent was ever left in flight: one `checker-premise` dispatched
  with `run_in_background: false`, waited on, and its verdict recorded above.
- `2026-08-20` **Refusal recorded on the issue itself**, not only in this file:
  comment posted to GAM-196 with the measurement, the two refutations, the
  recommendation (route (a)), and the disclosed limits. Final read-back —
  GAM-196: `Todo`, `[tier/heavy, gate/human]`, 1 comment.
  GAM-428: `Backlog`, `[unreviewed, provenance/premise-gate]`.

---

## Second dispatch, 2026-08-20 ~03:22Z — REFUSED AT THE CLAIM (item 28b)

This run is a different dispatch from the one above. It fired on the **release
move that run made** (`In Progress -> Todo`, 03:18:47.099Z), and it is the
counter-example to that run's last-but-one claim.

- `2026-08-20T03:23Z` **CLAIM REFUSED — `gate/human`, constitution item 28b.**
  GAM-196 read live before any other file was opened:
  `state = Todo`, `labels = [tier/heavy, gate/human]` (label parents read
  explicitly — `heavy`'s parent is `tier`, `human`'s parent is `gate`, so these
  are `tier/heavy` and `gate/human` and not two bare words). Item 28b: *"On a
  tiered issue in `Todo`, `gate/human` overrides every executor label and
  **forbids a machine claim**."* The issue was **not** moved to `In Progress`.
  No source file was changed. The issue stays in `Todo`.
- `2026-08-20T03:23Z` The issue's own body says *"there is no machine-shippable
  slice left here. The row is now a product decision and nothing else, which is
  why it carries `gate/human`."* **This is self-authored corroboration, not
  independent agreement** — that body text and the `gate/human` label were both
  written by the previous run of this same chain, not by the owner. The refusal
  stands on item 28b alone, which does not condition on who applied the label.

### The release move outran its own guard by 149 ms

**Corrected after `checker-premise` returned REVISE on the first wording of this
section.** The first version said no dispatch-side filter existed. It does; I
had grepped only `.github/workflows/`. What is left is a real defect, but a
narrower and more interesting one: a **sequencing** defect, not an absent guard.

The previous run's **mechanism** was right — `gate/human` is exactly what stops
a `Todo` move re-dispatching a machine. Its **application** was wrong: it
applied the label 149 ms *after* the move, so the guard evaluated a payload that
predated the label. Both statements are true at once, and this run is the
measurement of the second.

| Time (UTC) | Event |
| -- | -- |
| `03:18:47.099Z` | `In Progress -> Todo` — the release move |
| `03:18:47.248Z` | `+ human` (`gate/human`) applied — **149 ms later** |

**The guard that should have caught it.** `supabase/functions/linear-dispatch/
filter.ts:358-361` — rule 8 — skips any otherwise-dispatchable delivery carrying
`gate/human` with reason `HUMAN_GATED`, *before* `repository_dispatch` is ever
fired, so a gated row normally costs no workflow run and no tokens at all. It is
tested green in CI (`filter.test.ts:289-294`, `:417-426`, `:562-576`,
`:592-598`) and has shipped since `697c0df` (2026-08-09). The workflow YAML
carries no gate test because it does not need one; its own header says so at
`claude-linear-dispatch.yml:105-108` (*"The edge function already filters"*) —
its `if:` at `:109` is deliberately only a defence against a hand-fired
`repository_dispatch` bypassing `filter.ts` entirely.

**Why it did not fire: the label did not exist when the guard looked.**
`client_payload.labels` is built solely from the state-change webhook body
(`filter.ts:344`, emitted `:386-394`; `index.ts:137-160` reads that body once
and never re-reads Linear). Only a state move into `Todo` can dispatch at all
(`filter.ts:312-341`); a labels-only update returns `STATE_UNCHANGED`. So the
label-add event 149 ms later could not itself dispatch, and could not amend the
payload of the delivery already in flight.

**Executed against the committed `decideDispatch`**, re-run by this run rather
than taken on the subagent's word:

| Probe | Body | Result |
| -- | -- | -- |
| A | payload as observed, `labels: [heavy]` | `dispatch: true`, `labels: ["heavy"]` |
| B | same + bare `human` | `HUMAN_GATED` |
| C | same + grouped `human`/parent `gate` | `HUMAN_GATED` |
| D | label-add only (`updatedFrom: {labelIds}`) | `STATE_UNCHANGED` |

Probe A reproduces this run's dispatch-prompt line `Labels:   heavy` exactly.
B and C prove the payload cannot have contained `human` — or this run would
never have started.

**Measured / derived / inferred**, kept apart deliberately:

- *Measured*: the two Linear history timestamps (read live via GraphQL by this
  run — **not reproducible from this repository**); this run's dispatch prompt
  printing `Labels:   heavy`; the four probe outcomes above.
- *Derived from repo source*: that the trigger was the state move and not the
  label add; that `client_payload.labels` is that one webhook body's snapshot
  and nothing re-reads Linear; that the payload therefore did not contain
  `human`.
- *Inferred, not established*: that Linear serialises `data.labels` at event
  time rather than delivery time — i.e. that the 149 ms is the *cause*. It is
  the most parsimonious explanation and is consistent with everything measured,
  but this repository cannot prove Linear's serialisation moment. Also inferred:
  that the deployed edge function matches the committed source (`HUMAN_GATED`
  has been present since the function's first commit, so any deployment able to
  dispatch at all contains it — but deployment is not verifiable from here).

**The fix is an ordering rule, not new machinery:** apply `gate/human` **before**
the `-> Todo` move. With rule 8 in view that is not merely "at least visible in
the payload" — it is **dispositive**: `HUMAN_GATED`, no workflow run, nothing
billed. Do **not** file a row asking for a dispatch-side guard; it exists.

**Blast radius, stated so the row does not read as an open money tap:** GAM-196
now sits in `Todo` *carrying* `gate/human`, so any future move into `Todo`
carries the label into the payload and is skipped (probes B/C). This is a
one-shot window at the moment of release, not a standing loop.

**Prior art:** GAM-326 (`Done`, `tier/standard`, 2026-08-11) — *"An unfinished
dispatch run can turn its own job green by moving the issue to `Todo` — which
re-dispatches it four seconds later"* — is the parent phenomenon, and
`GAM-404-packet.md:374-382` records it as still unmitigated and unmeasured in
code. The label-ordering window is an increment on it, not a rediscovery.

**Publishable side-finding:** the prompt printed bare `heavy`, not `tier/heavy`.
That is live evidence that Linear's webhook `labels` carry **no `parent`**, so
`filter.ts`'s parentless fallback (`:137-140`, `:247`, `:256`) is the branch
actually running in production — which makes that file's warning at `:97-128` a
load-bearing measurement rather than defensive padding.

Filed as a follow-up row rather than patched into the constitution here —
amending the constitution is boss-architect/boss-arbiter authority, not the
orchestrator's.

### Delegation note

Item 26/HEAVY expects delegation, and this run has no implementation to
delegate — the row is refused at the claim, so there is no packet and no worker.
Manufacturing a worker for a refusal is the ceremony item 26 removes. One
`checker-premise` **is** dispatched, against this run's own two load-bearing
claims (the refusal premise and the 149 ms re-dispatch finding), because those
claims are about to be written into a new Linear row and the second one
contradicts a record already committed to this branch.
- `2026-08-20T03:24Z` **DISPATCHED `checker-premise`** (`model: opus`, item 18 /
  AGENTS.md HEAVY premise-checker tier) against this run's two claims:
  (1) item 28b forbids a machine claim on GAM-196 as it stands, and (2) the
  149 ms label-after-move ordering makes `gate/human` unable to suppress the
  dispatch its own release move fires. Dispatched with
  `run_in_background: false` and waited on.
  **If this line is the last one in this file, the run died holding this
  subagent** — the verdict never came back and nothing below it happened.
- `2026-08-20T03:30Z` **`checker-premise` VERDICT: REVISE (1 BLOCKER, 1 MINOR).**
  Subagent returned; nothing was left in flight. CLAIM 1 (the item-28b refusal)
  **SUPPORTED** — publishable as stated. CLAIM 2 **split**: the 149 ms ordering
  is supported, but *"nothing on the dispatch side filters it either"* is
  **REFUTED by shipped, CI-tested code**. The gate exists one layer above the
  workflow, in `supabase/functions/linear-dispatch/filter.ts:358-361` (rule 8,
  `HUMAN_GATED`) — I had grepped only `.github/workflows/`, which is why I
  missed it. Correction applied below rather than argued with.
  **Independently reproduced before accepting** (not taken on the subagent's
  word): the four probes below were re-run by this run against the committed
  `decideDispatch`, and `filter.ts:358-361` / `filter.test.ts:592-598` read
  directly.
- `2026-08-20T03:36Z` **GAM-429 FILED** —
  *"A run that releases its issue to `Todo` and then applies `gate/human`
  re-dispatches itself — the label landed 149 ms too late on GAM-196"*.
  `Backlog`, `[tier/unreviewed, provenance/premise-gate]`, priority Low. Read
  back from the create mutation. Written through the `linear-task-writing`
  skill (item 30); every line number re-opened first, and the checker's
  BLOCKER correction is carried in its `## Verification note` rather than
  quietly dropped. Body preserved at
  `docs/swarm/active/GAM-196-followup-body.md`.
- `2026-08-20T03:34Z` **Refusal recorded on the issue itself**, not only in this
  file: comment posted to GAM-196 carrying the item-28b reason, the 149 ms
  measurement, the GAM-429 pointer, and both corrections (this run's own first
  draft, and the previous run's log line) kept visible rather than buried.
- `2026-08-20T03:35Z` **Stale header corrected.** Line 5 of this file said
  *"No `gate/human`"* — true when the first run wrote it, false since
  `03:18:47.248Z`. Fixed in place with the reason.
- `2026-08-20T03:36Z` **FINAL READ-BACK.**
  GAM-196: `state = Todo`, `labels = [tier/heavy, gate/human]`, 2 comments —
  **unclaimed, exactly as item 28b requires.**
  GAM-429: `state = Backlog`, `labels = [tier/unreviewed, provenance/premise-gate]`.
- `2026-08-20T03:36Z` **RUN COMPLETE.** No source file changed and none should
  have been. No PR opened: a PR on this branch links GAM-196 by branch name and
  would drive it to `Done` on merge (item 28f — omitting a magic word protects
  nothing), and GAM-196 is not done. Precedent: the first run opened #210 and
  closed it unmerged for this exact reason. The branch stays pushed so this log,
  the packet, the gate report and the GAM-429 body survive.
- `2026-08-20T03:36Z` **Subagent accounting.** One `checker-premise`, dispatched
  with `run_in_background: false`, waited on, returned, verdict recorded above,
  and its BLOCKER independently re-verified by this run before being accepted.
  **Nothing was left in flight at any point** (AGENTS.md wall 2).

---

## Third dispatch run — 2026-08-20T11:18Z

**Header correction (again):** line 5's note above says GAM-196 carries
`gate/human`. That was true when the second run wrote it at `03:36Z`. It is
**false now.** Measured at `11:18Z` against the live tracker, GAM-196 carries
exactly one label — `tier/heavy` (`parent: tier`) — and `gate/human` is absent.
Corrected here rather than edited away, for the same reason the second run gave:
a stale header is what the next run has to disprove.

- `2026-08-20T11:18:01Z` **CLAIMED.** `Todo → In Progress`, write returned
  `success: true`, read back `state = In Progress` (item 28c). Tier was already
  `tier/heavy`, so item 28d's tiering-before-claim obligation did not apply —
  the second run's HEAVY judgment above stands unchanged and is not re-litigated.
  Route check before the move: `Todo` ✓, `tier/*` present ✓, `gate/human`
  **absent** ✓, no `executor/*` label → item 28b migration-only default, legacy
  Claude-only ✓.
- `2026-08-20T11:18Z` **Credential deadline read, not guessed** (AGENTS.md wall 3).
  `GH_TOKEN` payload decodes to `iat 2026-08-20T11:17:01Z`,
  `exp 2026-08-20T12:17:01Z`. The PR credential dies at **12:17:01Z**; `git push`
  uses the long-lived extraheader and is unaffected.
- `2026-08-20T11:19Z` **Branch reused, not recreated.** Continuing on
  `claude/gam-196-confirmed-hours-divergence` (10 commits ahead of `main`) so the
  two previous runs' packet, premise-gate report, refusal record and GAM-429 body
  survive in one place.
- `2026-08-20T11:19Z` **Open question this run must settle before anything else:**
  the second run refused under item 28b because `gate/human` was present; that
  label is now gone and the row was re-dispatched. **Who removed it, and does its
  removal answer the (a)/(b) product question the row exists to ask?** Removing a
  gate is not the same act as making a decision. Measuring this is the next step.
- `2026-08-20T11:23Z` **PREMISE MEASURED — it now HOLDS, and the reason is an
  owner act, not a label edit.** Linear issue history and comments read live:

  | UTC | Actor | Event |
  | -- | -- | -- |
  | `11:16:18.471Z` | **George (human)** | comment: *"We should use option A… 1 set of hours for intent to attend (RSVP) and 2nd is the actual attendance hours `v_student_hours`. is seems that way now, but if it's not that is how it should be."* — with a screenshot attached |
  | `11:16:33.919Z` | George | `-label human` (i.e. `gate/human` removed) |
  | `11:17:58.301Z` | **George (human)** | comment: *"When executing, try to dispatch as many agents in parallel to perform the work quickly, but with high quality"* |
  | `11:18:00.686Z` | (this run, via the owner's API key) | `Todo → In Progress` |

  **Caveat recorded rather than glossed:** every API write in this workspace is
  attributed to *George Mitchom*, because the scripts hold the owner's personal
  key — so "actor" alone cannot distinguish a human act from an agent's. The two
  `11:16`/`11:17` rows are read as human on independent evidence: they are prose
  comments, one carries an uploaded screenshot, and no agent in this run or the
  previous two wrote them.

  **So the (a)/(b) question the row exists to ask is answered: (a).** That is the
  authorization two previous runs correctly refused to invent. `gate/human` being
  gone is a consequence of the decision, not the decision itself, and this run
  does not rest on the label alone.
- `2026-08-20T11:24Z` **DRAFT PR #212 OPENED** at minute ~7 of the run, ~53 min of
  PR credential remaining (AGENTS.md wall 3: 21 of 21 in-run PRs were opened at or
  before minute 53, none after minute 60). Run 2's PR body preserved as
  `GAM-196-pr-body-run2-closed.md`; #210 stays closed and unmerged.
- `2026-08-20T11:25Z` **DISPATCHED 3 recon subagents CONCURRENTLY**, all with
  `run_in_background: false` in a single message so they run in parallel and this
  run blocks on all three (the owner's `11:17:58Z` instruction asks for
  parallelism; AGENTS.md wall 2 forbids leaving any of them in flight):
  **R1** — every hours figure rendered on `/outreach` and its exact label copy;
  **R2** — every other surface that shows hours, and the copy it uses;
  **R3** — PRD/BEH-02 wording constraints and every test asserting on that copy.
  All three are read-only; no worktree is needed (item 23 governs mutation, and
  none of these mutates).
  **If this line is the last one in this file, the run died holding these three
  subagents** — no verdict came back and nothing below it happened.
- `2026-08-20T11:32Z` **RECON VERDICTS — all 3 subagents RETURNED. Nothing left in
  flight.** Findings that change the plan:

  **R1 (the `/outreach` page).** The page draws a planned/confirmed split already,
  but **both sides of it are RSVP-derived** (`OutreachList.tsx:1380-1399`):
  `confirmedHours` = a `going` RSVP on a **completed** session; `plannedHours` =
  a `going` RSVP on a **scheduled** session. Neither touches `attendance`. The
  page reads `attendance` only for a head count (`:1867-1879`, consumed `:1934`),
  and its own doc comment `:1863-1866` says so. Live label strings: `Confirmed`
  (`:2152`), `{n} hrs confirmed` (`:2155`), `Planned` (`:2160`), `{n} hrs planned`
  (`:2163`), `aria-valuetext` (`:2146`), milestone toast `…(confirmed hours).`
  (`:2007`), and the coach event-row label `bucket === 'upcoming' ? 'Planned' :
  'Logged'` (`:2824`, `:2958`) — **`Logged` names the same RSVP number and implies
  an attendance log that does not exist.**

  **R2 (everywhere else).** `v_student_hours` has exactly four direct readers
  (`loaders/reports.ts:425`, `loaders/coachHome.ts:350`, `loaders/leaderboard.ts:138`,
  `functions/send-reminders/index.ts:512`) plus three SQL views over it. Those
  surfaces say `confirmed` and mean attendance. **Correction to the issue text:**
  the roster displays no confirmed-hours figure at all — `StudentsTab.tsx:1035` is
  a *goal override*, not `v_student_hours`. There is **no shared copy module**;
  every label is an inline literal.

  **R3 (the constraint that reshapes this task).** **PRD `BEH-02`
  (`VOLT_Portal_PRD.md:246`) prescribes a literal legend** — *"62 h confirmed +
  14 h planned"* — and constitution item 14 plus the non-negotiable at
  `constitution.md:14` make prescribed PRD copy owner-approval territory.
  **And BEH-02 does NOT disclose an RSVP heuristic**: the word RSVP does not
  appear in it. The "BEH-02 disclosed the heuristic" claim in GAM-196's own body
  traces only to a *code comment* (`OutreachList.tsx:715-720`). Any packet
  asserting BEH-02 discloses it is asserting something false.
  `MET-04` (`:566`) defines planned hours as future `going` sessions — which is
  what `/outreach` already computes — and confirmed hours as Σ`MET-03`, the
  attendance-backed formula, **which is not what `/outreach` computes.**
  25 existing assertions in `OutreachList.test.tsx` pin the current strings, plus
  `GoalBar.test.tsx:35,81-82` and `StatCell.test.tsx:34-36`.
- `2026-08-20T11:39Z` **PACKET WRITTEN** — `GAM-196-packet-round2.md`. Supersedes
  run 1's packet entirely (that one proposed the `counts_volunteer_hours`
  alignment the round-1 gate refuted; none of it is carried forward). Scope:
  user-visible wording on `/outreach` only, plus the comments that now state
  something false. **No arithmetic changes** — option B is not authorized.
  Allowed Files: `OutreachList.tsx` and its test, and nothing else. Ends with five
  **Least confident decisions** (item 19d), led by the BEH-02 prescribed-legend
  question.
- `2026-08-20T11:40Z` **DISPATCHED `checker-premise`** (`model: "opus"` per item 18
  / AGENTS.md HEAVY premise-checker tier) against the round-2 packet, with
  `run_in_background: false`. Item 19 forbids the packet reaching a worker until
  this returns **DISPATCH**. Round 1 of the two-round cap (item 19a) was spent by
  the first run on a *different* packet; this is round 1 for this packet.
  **If this line is the last one in this file, the run died holding this
  subagent** — no verdict came back and no worker was ever dispatched.
- `2026-08-20T11:44Z` **PREMISE GATE VERDICT: REVISE (1 BLOCKER).** Subagent
  returned; nothing left in flight. Report preserved as
  `GAM-196-premise-gate-round2.md`. It ran rather than read: its own worktree,
  `npm ci`, the change applied verbatim, `tsc` (exit 0), eslint, `format:check`,
  and the **full 2583-test suite** twice.
  **BLOCKER — my §6.1 escape was wrong, and I verified the refutation myself
  rather than taking it on the subagent's word:** `VOLT_Portal_PRD.md:485`
  (*"STUDENT: goal bar = own hours (MET-04)"*, inside OUT-01's own wireframe),
  `task-ledger.md:595-597` (T038's **passed** acceptance criteria bind this bar to
  BEH-02 by name) and `OutreachList.tsx:2085` (the shipped source cites BEH-02).
  `/outreach`'s student goal bar **is** a BEH-02 bar. Withdrawn.
  Four other measurements that changed the packet: my §4 test list was wrong in
  both directions (**14 red, not 25; 34 lines listed, 20 of them green and
  hazardous to "fix"**); acceptance criterion 2 cited a **blank line** (`:1343`;
  the real assertion is `:1621`); criterion 5 **forbade what §3.4 mandated**; and
  my §3.2 code block **fails `npm run format:check`** as pasted.
- `2026-08-20T11:44Z` **`checker-content` VERDICT: FAIL / MAJOR** (dispatched
  concurrently with the gate, `run_in_background: false`, both waited on).
  Independently caught the same copy defect the gate did: the draft line said
  *"not check-in"*, and **PRD `OUT-07` states outreach has no check-in in v1** —
  completion is coach-driven. Two agents, different charters, same finding.
  It **passed** every other proposed string on DES-14/15/16 and on item 17
  (motivation ethics), and it **dissented from the gate on BEH-02**, arguing the
  prescribed literal survives at `StudentHome.tsx:1647`. I followed the gate on
  the BLOCKER and recorded the dissent rather than burying it.
- `2026-08-20T11:46Z` **PACKET REVISION B WRITTEN.** All ten required revisions
  applied. Two substantive scope changes: **§3.3 (the coach-row `Logged` rename)
  is DEFERRED** to a filed row, which also retires the column-width risk; and
  **§1a states plainly that the BLOCKER is real and that the owner's explicit
  option-A approval is what carries it** — with the residual risk written into the
  packet and the PR body rather than argued away.
- `2026-08-20T11:45Z` **TWO FOLLOW-UP ROWS FILED** (item 20; gate required
  revisions 2 and 10 both said *file it before dispatch*, not *intend to*).
  Written through `.claude/skills/linear-task-writing` (item 30) — defect first,
  priority stated and defended, every line number re-opened, `Verification note`
  carrying what the gate measured rather than what the packet assumed. Ids read
  back from the create mutations:
  - **GAM-431** — *"/outreach counts volunteer hours from RSVPs, but the PRD
    specifies attendance — no-shows accrue hours, walk-ins accrue none"*.
    `Backlog`, `[tier/unreviewed, provenance/premise-gate]`, priority Medium.
    This is the substantive half of GAM-196 that route (a) deliberately does not
    fix.
  - **GAM-432** — *"Coach past-event row reads 'Logged 0h' beside 'Attended 2
    students' — the two labels come from different sources"*. `Backlog`, same
    labels, priority Low. Carries the deferred §3.3 rename, the T131 column-width
    re-measure, and `StatCell.tsx`'s stale doc.
  Packet references corrected from the placeholder ids I had written before
  Linear allocated (`GAM-430`/`GAM-431` → `GAM-431`/`GAM-432`) — Linear allocates
  atomically and an author cannot choose the number (item 29a).
- `2026-08-20T11:46Z` **DISPATCHED `checker-premise` ROUND 2** (`model: "opus"`),
  `run_in_background: false`. Round 2 of 2 under item 19a — a third REVISE
  escalates to the owner rather than looping. Mandate scoped to the deltas, not a
  re-audit, because the round-1 gate already executed the change end to end.
  **If this line is the last one in this file, the run died holding this
  subagent** — no verdict, and no worker was ever dispatched.
- `2026-08-20T11:51Z` **PREMISE GATE ROUND 2 VERDICT: REVISE (1 MAJOR, 1 MINOR) —
  and the BLOCKER is CLEARED.** Subagent returned; nothing left in flight.
  On the load-bearing question it says plainly: *"No additional owner act is
  required to dispatch."* It verified my §1a reading rather than accepting it —
  the phrase *"protected source text"* appears **nowhere else** in `docs/swarm/`,
  so it cannot be read as stricter than its own *"unless explicitly approved"*
  escape; BEH-02's prescribed literal survives verbatim at `StudentHome.tsx:1647`
  and `CoachHome.tsx:2050`, both untouched; and BEH-01's own toast literal was
  never the shipped string at `:2007`, so the milestone edit raises no second
  protected-text question. It also **corrected my citation of item 16** — item 16
  is migration cutover / production email / domain go-live, not a general human
  gate for product copy. Taken.
  It confirmed revisions 2, 3, 4, 5, 6, 8, 9, 10 correct, including reading all 13
  remaining red assertions and all 20 do-not-touch lines individually.
  **The two remaining findings are mechanical and it supplied both fixes
  verbatim:** my §3.2 code block was indented two levels too deep and broke one
  word early (`.prettierrc` `printWidth: 100`; the sibling nodes at `:2182`/`:2183`
  sit at six spaces), and my packet cited a round-1 report file that **was never
  committed** — the run log holds that verdict, the file does not exist.
- `2026-08-20T11:52Z` **BOTH APPLIED; NO THIRD GATE ROUND.** Item 19a caps the
  gate at two rounds and says a third REVISE escalates to the owner rather than
  looping. Round 2 cleared the BLOCKER, cleared eight of the ten revisions
  outright, and left two corrections it had already written out for me. Applying a
  correction an agent handed over verbatim is not a third round of gating, and
  re-submitting to buy a third opinion on an indentation level is exactly the
  net-negative loop 19a prices. **Recorded here so the call is visible and
  correctable rather than silent.** The packet is DISPATCH-able; the worker goes
  next.
- `2026-08-20T11:52Z` **DISPATCHED `worker-implementer`** on packet revision B,
  `run_in_background: false`. Model: the pinned default (sonnet). **Item 18's
  four `model: "opus"` triggers are all absent** and I checked each rather than
  defaulting: no `supabase/migrations/` file, no RLS policy or `security definer`
  helper, no metric-view SQL, no auth/session/role/permission logic — this packet
  changes user-visible strings and comments in one page component and its test.
  Item 25's second obligation is the operative one: *do not bump a worker to opus
  because a topic sounds sensitive.* Recorded per item 18.
  **If this line is the last one in this file, the run died holding this
  subagent** — the diff never landed and no checker ever saw it.
- `2026-08-20T11:59Z` **WORKER VERDICT: work landed, and it reported a failure of
  my own acceptance criterion rather than papering over it.** Commit
  **`c2c18c7`** — *"GAM-196: rename /outreach's RSVP-derived hours to 'signed
  up'"*. Subagent returned; nothing left in flight.
  **Existence verified independently (item 21 — "clean" and "committed" are
  different claims), against the committed blob and not the working tree:**
  `git show --stat c2c18c7` lists exactly the two Allowed Files;
  `git show c2c18c7:…/OutreachList.tsx | grep -c 'hrs signed up'` → **1**;
  `… grep -c 'hrs confirmed'` → **0** (acceptance criterion 1);
  `… grep -c "'Logged'"` → **2**, so the deferred §3.3 really is untouched
  (criterion 4). Pushed.
  Gates the worker ran: `tsc --noEmit` exit 0; `format:check` exit 0 — so the
  six-space block gate round 2 supplied is prettier-exact; `eslint .` exit 0;
  scoped vitest **129/129**; full suite **2583/2583** — both matching the
  gate-measured baselines exactly.
- `2026-08-20T12:00Z` **THE NAMED MUTATION DID NOT GO RED, and that is a real
  finding.** Reverting `Signed up` → `Confirmed` in the worker's own worktree left
  the scoped suite at exit 0, 129/129. Cause, measured by the worker: every
  assertion checks the concatenated sibling string `"{n} hrs signed up"`, and the
  standalone tile label renders adjacent with no separator, so the mutant DOM
  reads `Confirmed9 hrs signed up` and `.toContain('9 hrs signed up')` still
  matches. **The tile label is unguarded** — a pre-existing coverage hole this
  change neither created nor closed. The worker declined to close it because §4
  authorized exactly one new assertion, which is correct scope discipline and
  exactly what item 20 exists to catch. **I am closing it now rather than filing
  it**, because item 26 requires a named mutation that actually turns a test red
  and without one this task has no mutation proof at all.
- `2026-08-20T12:01Z` **DISPATCHED 2 subagents CONCURRENTLY**, both with
  `run_in_background: false`: the **worker** (continued, same context) to close
  the mutation gap and re-run the mutation; and **`checker-reviewer`** on
  `c2c18c7` against the packet's acceptance criteria. The added assertion is
  purely additive, so the checker's review of everything else holds regardless.
  **If this line is the last one in this file, the run died holding these two
  subagents.**
