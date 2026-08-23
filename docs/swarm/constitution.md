# Project Constitution

## Mission

A private, role-aware portal for VOLT (FRC Team 11195) that separates meeting attendance (participation %) from outreach attendance (volunteer hours toward season goals), makes check-in dead simple via rotating QR codes with coach override, and keeps students and parents informed through email reminders and a subscribable calendar feed. Authoritative spec: `VOLT_Portal_PRD.md` v1.5 — requirement IDs (e.g., MTG-08) outrank everything below except safety.

## Non-Negotiables

- The app must build successfully.
- Existing tests must pass unless the boss explicitly approves a test update.
- No worker may mark its own work complete.
- Every task receives the verification required by its tier. FAST is verified by the orchestrator through deterministic evidence—named mutation replay and the repository gates. STANDARD is verified by the orchestrator or its required checker, as item 26 assigns. HEAVY receives independent premise and acceptance verdicts.
- Every checker must inspect the actual committed artifact and execute the required evidence, not merely read the packet or accept the worker’s summary.
- Protected source text must remain verbatim unless explicitly approved.
- Accessibility, security, data integrity, and usability outrank cosmetic preferences.
- No agent is above verification, including the boss and orchestrator.

## Authority Boundaries

Workers may implement tasks, but they may not redefine success.

Only the following agents may modify this constitution:
- boss-architect
- boss-arbiter

Workers may not edit:
- docs/swarm/constitution.md
- docs/swarm/task-ledger.md
- docs/swarm/verification-log.md
- docs/swarm/dispute-log.md
- .claude/agents/
- .claude/skills/
- .claude/settings.json

If a worker believes the standard is wrong, impossible, contradictory, or harmful, the worker must file a dispute instead of modifying the standard.

## Project-Specific Standards

### Authority & sources of truth
1. Precedence: PRD requirement IDs > this constitution > task-ledger text > agent judgment. Conflicts are disputes for boss-arbiter — never improvised around.
2. **Astryx is the preferred source, and `astryx-api.md` is the only legal source
   for an Astryx prop** (PRD DES-19). Two different questions have been living
   inside this item and getting the same answer: *what props does an Astryx
   component have*, and *may we use a component Astryx does not ship*. This item
   answers the first. It has **no authority over the second** — items 8, 9 and 11
   do. A checker that cites item 2 to block a non-Astryx component has cited the
   wrong rule.

   a. **Astryx props — unchanged.** They come **only** from
      `docs/swarm/astryx-api.md`. A prop absent from that file is presumed
      hallucinated → MAJOR. The CLI (`npm run astryx -- component <Name>`) is a
      cross-check, not a source. DES-19 is not deviated from here and its
      presumption is not weakened: the remedy for a doc gap is to *correct the
      file* (2b), never to use an undocumented prop and argue it is real.

   b. **Correcting `astryx-api.md` is a legal move, and any agent may make it —
      the gate is evidence, not rank.** D004 already amended this file once, by
      boss-arbiter, and kept the mechanism to itself; the cost of that showed up
      in the same ruling (D004 Ruling C left `useAppShellMobile` — a real,
      shipped API — unusable purely because it was undocumented). An addition is
      legal when **all** of these hold:
      - it cites the **installed** package source by path and line under
        `node_modules/@astryxdesign/`, not the vendor's website or memory;
      - the CLI cross-check (DES-20) was run and its output agrees;
      - the entry is **marked as an annotation** in D004's style, source-cited
        and dated, and the vendor's original text is left in place rather than
        silently rewritten — doc-refresh tasks must still diff cleanly;
      - it lands **in the same PR as the code that uses it**, so the claim and
        its use are reviewed together;
      - the checker **independently re-verifies against the installed package**
        and does not take the annotation's own citation on trust.

      A checker that accepts an annotation without re-running the citation has
      not checked it. An annotation failing any bullet above is graded exactly as
      the undocumented prop would have been — MAJOR. `astryx-api.md` is
      deliberately **not** on the forbidden-files list under Authority
      Boundaries: that is what makes this route available to a worker, and the
      five bullets are what stop it from becoming a way to launder a
      hallucination into the record by typing it into the source of truth.

   c. **Reaching outside Astryx is legal when the gap is measured first.**
      Astryx-first is a requirement, not a taste. Before any non-Astryx
      component — third-party or hand-built — the gap is **measured and written
      down**: name what Astryx actually ships for the need, cite it from
      `astryx-api.md`, and state what it cannot do. "Astryx doesn't have one" is
      an assertion; D021 is the standard — it quoted `Icon`'s complete 26-name
      semantic set and showed that only one of seven nav destinations had a
      match. A component introduced without that measurement is MAJOR on the
      **choice**, independent of whether its code is any good.

      The record carries three things, and D021 is the model for all three: the
      **measured gap**, the **alternatives considered and why they lost**, and
      the **disclosed divergence** — what the substitute makes worse, stated up
      front so a checker meeting it later has found this ruling rather than a
      defect. It is a dispute-log entry plus a Linear issue per item 30; the
      ledger is frozen (item 29) and is not where this goes.

      If the component is a **new dependency**, item 9 still governs it and
      boss-architect approval is still required — 2c is the design half of that
      case, not a replacement for it. If it is **hand-built in `src/`**, no
      dependency approval is needed and the gap record still is.

   d. **Its props are verified against its own source, to the same standard.**
      Item 2a's presumption is Astryx-scoped and does not transfer, but the
      discipline behind it does: a non-Astryx component's props are cited from
      its own installed types or source under `node_modules/`, or from the
      component's own definition if we wrote it. Unverified props are MAJOR
      wherever they come from. Item 11's styling escalation (DES-21) and item 12's
      four states apply to it unchanged — a substitute component is not a
      quieter corner of the app.

   e. **What this does not open.** **Item 8 is untouched and still BLOCKER:** no
      Tailwind, no shadcn, no alternate UI or CSS library. One component or one
      icon set is not a design system, and 2c is not a route to a second one — if
      the honest answer to "what Astryx ships for this" is *most of a UI kit*,
      that is item 8's question and the answer is no. Nor does 2c license
      preference: "the Astryx one is awkward" is a styling escalation under item
      11, not a gap. A gap means Astryx ships **nothing** that can do the job.

   **Authorized by the human owner 2026-08-22**, verbatim: *"the Constitution
   item 2 makes astryx-api.md the only legal source for an Astryx prop and says a
   prop absent from it is presumed hallucinated. i need astryx as the preferred
   source, but we have instances where we need to bring in other components."*
   Scope and the 2b authority were his rulings, taken the same day. Rationale:
   item 2 was being read as the wall around the whole design system when its text
   only ever governed props, and that misreading has already cost real work
   twice — D004 Ruling C forbade a shipped Astryx hook for being undocumented,
   and D021 had to be argued as a dependency question because there was no rule
   describing how to leave Astryx on purpose. Both were handled correctly and
   neither left anything reusable behind. This item is that residue.
3. RLS policies and metric SQL come **only** from PRD Section 8.4, copied verbatim. Re-deriving either, or duplicating a metric formula in TypeScript (PRD DATA-01) → BLOCKER.

### Security & privacy (students are minors)
4. RLS is default-deny; any table without policies → BLOCKER. Policies use only the 8.4 `security definer` helpers; a policy subquerying its own table → BLOCKER.
5. No secrets in the repo: `.env*` gitignored; service-role keys never appear in frontend code or client bundles → BLOCKER.
6. No PII (student **full** names, emails) in logs, URLs, analytics, commit messages, or test fixtures — fixtures use fabricated names. Kiosk and public leaderboard surfaces follow PRD SEC-04/ROS-08 → BLOCKER. **First name + last-initial is not PII under this item** and is permitted anywhere a full name would not be. **Team visibility is permitted**: a student seeing other team members — on a leaderboard, an event signup, or any other authenticated surface — is the product, not a leak, provided what is shown is first name + last-initial rather than the full name. Authorized by the human owner 2026-08-21 (GAM-434), verbatim: *"No PII (student FULL names, emails) in logs, URLs, analytics, commit messages, or test fixtures — fixtures use fabricated names. Kiosk and public leaderboard surfaces follow PRD SEC-04/ROS-08 → BLOCKER. First Names and initial of last is permitted. Seeing other team members is permitted (for example, leaderboards, event signups, etc)."*
7. No email sends outside Resend test mode until E8's checker approves production sending; reminder dedupe per PRD EML-03 is a correctness requirement, not an optimization.

### Stack locks
8. Vite + React 19 + TypeScript strict + Supabase. **No Tailwind, no shadcn, no alternate UI/CSS libraries** (PRD D2/D3) → BLOCKER. *React 19 is an approved, human-authorized deviation from PRD D2's "React 18" — see dispute-log D002 for the ruling and evidence (`@astryxdesign/core` requires React 19 at runtime, not just in peer metadata). The PRD text itself is intentionally unedited; D002 is the record of the deviation.*
9. Dependency allowlist: `@astryxdesign/*`, `@supabase/supabase-js`, `@tanstack/react-query`, `react-router-dom`, `qrcode.react`, `lucide-react`, `ical-generator` (Edge Function), plus dev tooling (vitest, playwright, eslint, prettier). Anything else requires boss-architect approval recorded in the ledger. **A UI dependency also needs item 2c's measured gap record** — this item asks whether we may take the dependency, 2c asks whether Astryx already had an answer. *`lucide-react` is a human-authorized addition (owner, 2026-08-21) — Astryx's semantic icon set is a closed 26-name list that cannot name four of the seven side-nav destinations, and `Icon`'s own props table directs callers to lucide or heroicons for anything outside it. See dispute-log D021 for the measured gap, the choice between the two, and the disclosed divergence (lucide is outline-only, so `SideNavItem.selectedIcon` goes unused). Recorded there rather than in the ledger, which item 29 froze.*
10. Database changes are additive migrations via the Supabase CLI; editing an applied migration file → BLOCKER.

### UI & quality
11. UI is built from Astryx components; styling escalation order per PRD DES-21 (component → theme token → xstyle → custom CSS); ejecting component source needs boss approval. **Where Astryx ships nothing for the need, item 2c is the route out** — the gap is measured and recorded before the substitute is written, and item 8's ban on an alternate UI library is unaffected by it. Reaching for a non-Astryx component because the Astryx one is awkward to style is a DES-21 escalation, not a gap.
12. Every async screen ships all four states — loading, empty, error, populated (PRD DES-12). Happy-path-only → MAJOR.
13. Wireframes are structural intent: rendering box-drawing/bracket characters in the DOM → MAJOR. Routes marked "template as-is" (PRD 7.1) get the named Astryx template; inventing custom layout there → MAJOR.
14. Copy follows PRD DES-14…16 (sentence case, named actions, prescribed empty/error text). Timestamps stored UTC, displayed America/Chicago (NFR-09).
15. Accessibility per PRD DES-17 / NFR-07 is a shipping requirement; keyboard path failures on core flows → BLOCKER.

### Human gates (George)
16. Migration cutover (MIG-04 validation + sign-off), production email enablement, and Vercel domain go-live require explicit approval from the human owner recorded in the ledger. The old Lovable app is read-only reference — agents never write to the old project except via the reviewed `scripts/migrate.ts`.

### Motivation ethics 
17. Motivation mechanics are limited to honest progress signals (PRD Section 5.7: milestones, planned-vs-confirmed hours, consistency strips). Loss-aversion framing, streak pressure, FOMO/scarcity, countdowns, guilt copy, and re-engagement hooks are prohibited → BLOCKER. Users are minors and volunteers; the app never optimizes for its own engagement.

### Agent tiering & pre-dispatch verification
18. **Worker model tier.** `worker-implementer` runs on its pinned default
    (sonnet) for ordinary tasks — the worker/checker loop catches the errors
    that tier makes, and upgrading every worker costs more than the reworks it
    would prevent. The orchestrator MUST pass a `model: "opus"` override when
    dispatching a task that matches any of these, where a silent error is a
    data or privacy problem and is hard to detect after the fact:
    - creates or edits a file under `supabase/migrations/`
    - creates or modifies an RLS policy, or any `security definer` helper
    - creates or modifies a SQL view containing metric math (PRD 8.4 territory)
    - changes auth, session, role-resolution, or permission logic
    The override goes on the dispatch call, not in the agent definition —
    there is one worker prompt, not two. Record the tier used in the ledger row.

19. **Planning artifacts receive independent premise review before dispatch
    when their tier or scope requires it.** Every HEAVY task packet must receive
    a `checker-premise` verdict of **DISPATCH** before reaching a worker. A FAST
    task has no worker packet and therefore no premise dispatch. A STANDARD task
    uses an orchestrator-authored, repository-verified compact packet and does
    not require a separate premise checker unless the orchestrator escalates it
    or measurement reveals a HEAVY trigger.

    A PRD or multi-task packet set still requires `DISPATCH` before any worker
    packet derived from it may dispatch. Tiering an individual derived packet
    as STANDARD does not bypass errors inherited from an unchecked parent plan.

    A required `REVISE` verdict is not advisory: the author revises and
    resubmits. Record every required verdict alongside the planning artifact.
    The independent premise layer exists because a real PRD in this project
    reached approval carrying two false defect claims, one physically impossible
    prescription, one proposed fix that would have stripped accessible names
    from six screens, and a silent reversal of passed work.

    **19a. The gate is capped at two rounds.** A third REVISE escalates to the
    human owner instead of looping. Measured on wave 5's first packets: round 1
    cost ~130K opus tokens and caught 4 BLOCKERs; round 2 cost ~105K and caught
    2 MAJORs. One round costs roughly one prevented rework cycle, so two rounds
    is break-even-to-positive and a third is net negative. A plan still failing
    after two rounds has something wrong with the plan, not the wording.

    **19b. Scope the required premise review by risk, without author self-waiver.**
    Use a full premise review for novel patterns and anything touching migrations,
    RLS, security-definer helpers, authentication or permissions, metric SQL,
    destructive writes, authoritative persisted-data reporting, active frozen
    contracts, or other unconditional HEAVY triggers in item 26. A light review may
    be used when the task rolls out a previously verified pattern through an
    already-settled seam. Every HEAVY packet still requires an independent
    `DISPATCH` verdict; “light” changes the review’s scope, not whether it occurs.

    **19c. Verify your own citations before submitting.** Roughly half of
    round 1's findings were the author's own unverified line numbers and
    claims. That is cheap to prevent and expensive to have an opus agent
    discover.

    **19d. Declare your least confident decisions.** Every HEAVY packet ends
    with a numbered **Least confident decisions** list: the calls the author
    would most want challenged while changing them is still free. Three to
    five entries, each naming the decision *and* what would make it wrong.
    An empty list is a claim, not a default — either write the list or write
    "none, and here is why." `checker-premise` attacks this list before
    anything else (its charter §0), and a HEAVY packet arriving without one is
    itself a MINOR finding. Authorized by the human owner 2026-08-09.
    Rationale: 19c records that roughly half of round 1's findings were the
    author's own unverified claims — which means the author was, in half the
    cases, already in a position to know where the weak ground was. A packet
    that says where it is weakest converts the gate from a uniform re-audit of
    a large document into targeted work on the parts most likely to be wrong,
    at a round 19a prices at ~105-130K opus tokens. **A Known Risk is not this
    list:** a Known Risk is a disclosed and accepted hazard (T510's DST window,
    for example); this is an undisclosed and unresolved doubt. Declaring one
    costs nothing and is not held against the author — concealing one is what
    costs a round.

## Definition of Ready (dispatch gate)

A worker packet may be dispatched only when:

1. the task’s FAST, STANDARD, or HEAVY tier has been measured, stated, and
   defended;
2. every required premise review has returned `DISPATCH`;
3. any parent PRD or multi-task packet set has returned `DISPATCH` before its
   derived worker packets dispatch;
4. every factual claim and current line citation relied upon by the packet has
   been verified against the real repository;
5. every prescription is feasible, or its escalation is named and pre-approved;
6. every acceptance criterion is measurable with fixtures and environments
   that exist today;
7. every worker has explicit allowed files and a non-overlapping worktree;
8. any parallel-worker split satisfies item 26’s tier-specific split rules; and
9. any reversal of previously passed work is explicit and authorized.

FAST has no worker dispatch and therefore does not pass through this
worker-packet gate. Its evidence obligations are defined directly by item 26.

## Definition of Done

A task is done only when:

1. the orchestrator or dispatched worker has produced the requested change;
2. the verification actor required by item 26 has inspected the actual committed
   artifact;
3. the required tests, mutations, repository gates, and specialized checks have
   been executed with their exit codes or authorized `SKIPPED` results recorded;
4. the final diff, allowed-file boundary, and integration records have been
   checked;
5. every deliberate deferral has a linked follow-up issue under item 20;
6. the PR contains the required Linear declaration and is ready for human
   review;
7. the issue has been moved to `In Review`, never self-certified as `Done`; and
8. the orchestrator has accepted only evidence produced by the tier’s designated
   verifier.

For FAST, the designated verifier is the orchestrator using deterministic
evidence. For STANDARD, it is the orchestrator unless item 26 requires a
separate checker. For HEAVY, it is the independent acceptance checker. A worker
never verifies or accepts the worker’s own result.

## Evidence Requirements

Each checker response must include:

- files inspected
- commands run
- relevant output
- pass/fail result
- exact failure reason, if any
- severity classification
- recommended next action

## Failure Severity

BLOCKER:
Cannot ship. Violates a core requirement, breaks the build, corrupts data, breaks security, breaks accessibility, or modifies forbidden files.

MAJOR:
Should not ship without boss approval. Important functional, architectural, UX, or correctness issue.

MINOR:
Acceptable for the current task but should become a follow-up task.

NIT:
Cosmetic or preference-level issue. Does not block completion.

Decision rules:
- BLOCKER fails the task.
- MAJOR fails the task unless the boss explicitly approves deferral.
- MINOR passes with a follow-up task.
- NIT passes and is logged only.

## Dispute Rule

If a worker believes the checker is wrong, the worker may file a dispute.

The boss-arbiter decides whether:
- the worker must redo the task,
- the checker was wrong,
- the spec was ambiguous,
- the constitution must be clarified,
- or the human owner must decide.

## Loop Limit

A worker/checker loop may run at most 3 failed attempts.

After the third failure, the task must be escalated to boss-arbiter.

20. **A deliberate deferral must file a task, not just a comment.** When a
    worker or checker knowingly leaves a defect in place because it falls
    outside its Allowed Files or scope, recording that in a code comment is not
    sufficient — it must produce a follow-up task in the ledger. Comments are
    not triaged; ledger rows are. Authorized by the human owner 2026-07-29.
    Rationale, all three found by the owner in manual testing on the same day:
    outreach and meetings team pickers shipped fixture teams because T101 and
    T121 each correctly declined the out-of-scope wiring and said so only in a
    comment — and because `events.team_ids` is `uuid[]` while the fixture ids
    are plain strings, that deferral escalated into meeting creation failing
    outright in production. The light/dark control shipped inert for the same
    reason: `SettingsPage` documented live-wiring as "a future task" in a
    comment, and no such task was ever created. Every one of these was correct
    scope discipline undone by the absence of a triage record.

21. **Completion reports state a commit SHA; existence is verified, not
    assumed.** A worker's completion report must give the commit SHA its work
    landed in. Before merging work, removing a worktree, or treating a task as
    done, the orchestrator verifies that HEAD actually moved and that the change
    is in the committed blob — not merely in the working tree. "Clean" and
    "committed" are different claims: the first means no uncommitted diff, the
    second means the work survives worktree removal. Authorized by the human
    owner 2026-07-29. Rationale: T142's worker reported "final state confirmed
    clean" alongside an accurate account of 770 changed lines, live browser
    measurements at three viewports, and every command it ran. All of it was
    real and none of it was committed — the worktree HEAD was still the packet
    commit. It surfaced only because an empty `git diff` against the merge base
    contradicted the report. Routine worktree cleanup would have destroyed the
    work. Content was being verified carefully all session while existence was
    assumed.

22. **Explicit pathspecs only — never `git add -A` or `git add .`.** Every
    commit, by any agent and by the orchestrator, stages named paths. A commit
    may then only ever contain what someone deliberately chose to include.
    Authorized by the human owner 2026-07-29. Rationale: a subagent modified
    `src/pages/outreach/OutreachEventDialog.tsx` without authorization during a
    documentation commit. A habitual `git add -A` would have swept that source
    change into a commit whose message described packet authoring, pushed to the
    branch, with no packet defining it, no checker verifying it, and the human
    owner away — bypassing all three safeguards at once, not by defeating them
    but by staging too broadly. It surfaced only because a stop hook happened to
    flag an uncommitted file. The edit itself was a harmless fixture rename; the
    mechanism is indifferent to severity.

23. **Mutation experiments run in the agent's own worktree, never the shared
    tree.** Reading the shared working tree is unrestricted — a premise gate
    must check citations against live state, including uncommitted work. But any
    agent that *modifies* files to run an experiment — reverting a fix to prove a
    test fails, re-iding a fixture to measure breakage, probing a type error —
    does so in an isolated worktree it owns. An agent without one creates one
    (`git worktree add`) rather than mutating the shared tree. Corollary for the
    orchestrator: **a dirty working tree is not automatically an unauthorized
    change.** Before reverting unexpected modifications, establish which agents
    are running and whether one is mid-experiment; reverting another agent's
    in-flight mutation corrupts its measurement. Authorized by the human owner
    2026-07-29. Rationale: a `checker-premise` gate ran four instrumented
    mutation experiments against the shared tree, intending to revert each. The
    orchestrator found the tree dirty mid-experiment, reverted it, and
    misattributed the change to a different agent that was operating correctly —
    three failures from one missing convention. The practice that caused it is
    correct and must not be discouraged: mutation proofs have caught more real
    defects in this project than any other technique, including a test that
    passed with the feature entirely removed. This rule isolates the practice
    rather than restricting it.

24. **Recording a task and merging it are one action, not two.** The ledger row
    and the verification-log entry are updated **in the same commit that merges
    the work**. A merge commit that lands source changes without also moving the
    ledger row out of its pre-merge status is incomplete, and the orchestrator
    should treat an unmerged-looking row on merged work as a bug in its own
    process rather than as bookkeeping to catch up on later. Authorized by the
    human owner 2026-07-29. Rationale, measured on the day it was written: ledger
    rows for T142-T150 were backfilled at 11:39, accurately describing the state
    at that moment. Five tasks then merged over the following ten hours and not
    one row was updated, so the ledger still read "packet gated" and "filed" for
    work that was live on the branch — the exact document the human owner would
    read to decide whether to merge. The verification log was worse: its last
    entry predated the entire wave, and **a gate had explicitly flagged the gap**
    ("no verification-log entry despite being merged; Definition of Done items
    3-4 are unsatisfied"), which was acknowledged and not acted on. **This is item
    20's failure shape turned on the process itself** — a record written once,
    never triaged, silently drifting from reality. Splitting merge from record
    means the second step is always optional under time pressure, and it is
    always the one dropped. Joining them removes the choice.


25. **Proportionality.** Volt serves one small volunteer team — the owner, his
    students, and their parents. No PII is stored. **Grade security findings
    against that threat model, not a corporate one:** a finding is
    security-class only when there is a concrete, plausible harm *in this
    context*. **Item 4 covers tables; do not extend it to views**, and do not
    manufacture a security-class finding out of an extension of a rule.
    Correctness, data integrity and honest on-screen values are **unaffected**
    by this item — it lowers no bar other than the security threat model.
    Authorized by the human owner 2026-07-30, verbatim: *"while i admire the
    diligence and thoughtfulness, let's not overcomplicate our application
    becasue of it. This is a volunteer group, not a company. We store no PII,
    it is just a small team with me and thier parents. please keep it simple"*
    (`auto-mode-decisions.md`, "2026-07-30 — George's ruling on security
    scope"). Rationale, and it is a record of the orchestrator's error rather
    than a relaxation of anything: T176's checker found that
    `dashboard_views.sql:49-52` claims its views run under the caller's RLS,
    which is false — `security_definer` is a *function* attribute, the
    view-level knob is `security_invoker` (PG 15+), it defaults off, and it
    appears zero times in `supabase/`. True, and the orchestrator escalated it
    to a security-class task (T185) on two bad steps: it read item 4's
    table-scoped rule as covering views, then graded its own extension as
    BLOCKER-adjacent. **The "exposure" was in fact the product** — the owner had
    already ruled the leaderboard is embedded in the dashboard, and a
    leaderboard shows everyone's hours, so "any authenticated caller can read
    active students' team and hours" is the feature. T185 closed as no-change;
    its one real residue, a wrong comment, folded into T186. Net task count went
    down. **Item 6's fixture hygiene is deliberately untouched by this item** —
    fabricated names in fixtures cost nothing, are already universal in the
    codebase, and mean no one has to think about whether a test file is safe to
    paste into an issue. **Second, narrower obligation:** do not bump a worker
    to opus because a topic *sounds* sensitive. Tier follows genuine complexity
    (item 18's four triggers). T157 was bumped sonnet→opus on "minors' family
    linkage" reasoning that this item retires.

26. **Three process tiers, triggered by measured risk—not by topic, ticket size,
    file count, or habit.** The full chain of packet, independent premise
    review, worker, and independent acceptance review is the HEAVY tier. It must
    be used when its triggers apply, but it must not become the default for work
    whose risk does not justify it.

    Begin with this question:

    **Can a mistake here corrupt persisted data, or materially misrepresent a
    user’s own persisted records?**

    The unconditional HEAVY triggers below decide that question for the named
    classes. For changes not covered by those triggers, measure the actual seam,
    affected records, consumers, and deterministic evidence before selecting
    FAST or STANDARD.

    A read-only or reversible change is not HEAVY merely because it is
    user-visible, role-specific, accessible, responsive, spread across several
    components, affects minors, or changes an internal TypeScript signature.
    Those properties may require evidence and a checker; they do not by
    themselves select the tier. Tier and model strength remain separate
    decisions under item 18.

    This item preserves the owner’s original authorization for a faster path,
    quoted verbatim:

    *"For small fixes like items T321 and T323 is there a faster path we can take
    to get those done? the Boss->Checker->Foreman->Worker->Checker path seems to
    eat up alot of time for a few line bug fix"*

    The expanded tier definitions, parallel-execution rules, and verification
    budgets in this revision require fresh authorization by the human owner.
    **Authorization date: 2026-08-23.**

    **Tier-selection order**

    1. **Measure before classifying.** Inspect the current repository and identify
       the actual behavior, affected data, write seam, consumers, test evidence, and
       active sibling-task dependencies. Historical labels, ticket estimates, prior
       line references, and the apparent size of the requested edit do not
       substitute for current measurement.

    2. **Apply the HEAVY triggers first.** If any unconditional HEAVY trigger
       applies, the task is HEAVY. An established seam, a small diff, or an existing
       deterministic test does not lower an unconditional trigger.

    3. **FAST is available, not mandatory.** A task may use FAST only when the
       orchestrator will implement it directly and every FAST condition holds. Once
       implementation is delegated to a worker, the task is at least STANDARD.

    4. **STANDARD is the default bounded tier.** Work that is not FAST and does not
       meet a HEAVY trigger is STANDARD.

    5. **Take the heavier tier when two tiers remain reasonably arguable after
       measurement.** “It sounds important,” ticket size, and file count are not
       reasons to raise a tier, but unresolved risk is. Record and defend the
       decision in the claim comment and PR.

    **FAST — direct implementation with deterministic evidence**

    The orchestrator implements and verifies FAST work directly. FAST has no
    worker, no worker packet, no premise checker, and no separate acceptance
    checker.

    FAST is permitted only when **all** of the following hold:

    - no unconditional HEAVY trigger applies;
    - the change contains no production write path or destructive operation;
    - it does not change schema, migrations, RLS, security-definer functions,
      authentication, sessions, role resolution, or permissions;
    - it does not change a signature or contract imported by another module;
    - the production change is approximately twenty lines or fewer and remains
      locally bounded;
    - the expected behavior can be verified deterministically;
    - a named mutation can be made that causes the relevant check to fail for the
      expected reason; and
    - the orchestrator can inspect the complete diff and all affected consumers
      without delegating implementation.

    FAST removes coordination, not evidence. The orchestrator must:

    - commit the candidate fix before mutation;
    - create a disposable worktree for the mutation;
    - mutate only inside that disposable worktree;
    - capture the real failing result and exit code;
    - restore the committed candidate and capture the corresponding green result;
    - run all six repository gates, recording an exit code or an authorized
      `SKIPPED` result for each;
    - inspect the final diff and forbidden-file boundary; and
    - deliver the result through the normal PR and Linear integration path.

    FAST verification may use test-runner concurrency or isolated process-level
    lanes when that reduces wall-clock time. For a genuinely small task, sequential
    execution is acceptable when process setup would cost more than it saves.

    T323 is the genuine historical FAST calibration point. T321 appeared in the
    owner’s original request for a faster path but was not itself a few-line FAST
    task: it exceeded the size boundary, added exported symbols, and received
    STANDARD treatment.

    **STANDARD — compact packet, bounded implementation, proportionate verification**

    For STANDARD work, the orchestrator writes a compact, repository-verified
    packet and a worker implements from that packet.

    The packet must identify:

    - the measured defect or requested outcome;
    - allowed and forbidden files;
    - relevant existing contracts and consumers;
    - measurable acceptance criteria;
    - the named deterministic tests and mutation;
    - the required repository gates;
    - known risks and escalation conditions; and
    - verification ownership.

    A separate premise checker is not required for an ordinary STANDARD task. The
    packet author remains responsible for verifying every operative claim and
    citation before dispatch. The orchestrator may request a premise review when
    uncertainty warrants it, but may not use STANDARD to avoid an applicable HEAVY
    trigger.

    STANDARD may include a **bounded, reversible write** only when all of the
    following are demonstrated before dispatch:

    - it uses an established, already-reviewed write seam;
    - it targets one preidentified record or one tightly bounded entity set;
    - it is idempotent or has a deterministic cleanup or rollback;
    - it cannot overwrite, clear, or replace unrelated persisted fields;
    - the test captures the complete relevant row before and after the write and
      proves that only the intended fields changed; and
    - its pre-dispatch verification runs against an isolated disposable database or
      fixture environment.

    If any of those conditions cannot be demonstrated, or if the write can
    overwrite or null another user’s existing persisted values, the task is HEAVY.

    One worker is the STANDARD default. The orchestrator may dispatch **at most two
    workers** when their implementation packets are genuinely disjoint. A
    two-worker split must declare:

    - non-overlapping allowed files;
    - separate acceptance criteria;
    - separate commits;
    - the integration order;
    - any shared contract and its single owner; and
    - how each result can be verified independently before integration.

    Two workers may not edit the same worktree or overlapping files. Owner
    authorization does not turn a three-worker split into STANDARD; a proposed
    three-worker implementation must satisfy the HEAVY split rules.

    A separate acceptance checker is required at STANDARD when the result depends
    on specialized independent judgment, including:

    - role- or tenant-sensitive presentation that does not itself change
      authorization logic;
    - user-data reporting whose underlying source-of-truth contract is already
      settled but whose mapping or presentation could still mislead;
    - a core keyboard or accessibility path;
    - a cross-surface mapping or shared contract;
    - a frozen contract with no active sibling task still building against it; or
    - evidence whose interpretation is materially less deterministic than its
      execution.

    Authentication, permission, or role-resolution logic itself remains HEAVY. A
    change capable of materially falsifying a user’s own persisted records remains
    HEAVY.

    Final verification has one owner:

    - when no separate checker is required, the orchestrator inspects the committed
      implementation, replays the mutation, and runs the final repository gates;
    - when a checker is required, that checker performs the final mutation replay
      and repository gates, while the orchestrator integrates the checked result
      without duplicating the complete verification run.

    STANDARD verification may use process-level parallelism. Static checks,
    deterministic tests, and isolated integration or browser checks may run
    concurrently against the same committed SHA when their resources do not
    collide.

    One bounded correction round may return to the same worker and, when present,
    the same checker. A replacement worker, a second correction round, arbitration,
    an additional checker, or an additional high-capability model requires owner
    authorization.

    Historical calibration:

    - T302 and T303 were STANDARD because their implementation was delegated. Both
      would have been FAST-eligible if the orchestrator had implemented them
      directly and every FAST evidence condition had been met.
    - GAM-451 is STANDARD only once no active sibling task is building against the
      contracts it changes. As GAM-451 actually ran on 2026-08-21, active sibling
      work was coding against GAM-444’s frozen forms, so the frozen-contract trigger
      correctly held it at HEAVY.
    - Under this revised process, a future GAM-451-sized task that has no active
      frozen-contract dependency would ordinarily receive one compact packet, one
      worker, and one integrated checker where its user-data and accessibility
      surfaces require one. Verification would use process-level lanes before any
      additional checker was considered.

    **HEAVY — independently challenge the premise and the result**

    A task is unconditionally HEAVY when it does any of the following:

    - creates or modifies a database migration;
    - creates or modifies RLS, a security-definer helper, or another database
      authorization boundary;
    - changes authentication, session handling, role resolution, or permission
      logic;
    - creates or modifies metric SQL or another authoritative persisted-data
      calculation;
    - introduces or changes a destructive, bulk, or non-idempotent write;
    - changes a write that can overwrite, clear, or null another user’s previously
      persisted fields, even when the write uses an existing seam;
    - changes the logic that derives, reconciles, or denies the existence, status,
      or history of a user's own persisted records; presenting values through an
      already-settled source-of-truth contract is not this trigger — it routes to
      STANDARD with its required checker;
    - changes a contract frozen for an active sibling task or a contract against
      which another active task is currently implementing;
    - changes an external protocol, generated contract, or contract consumed
      outside the repository; or
    - introduces a novel architectural pattern whose effects cannot yet be bounded
      through existing seams and deterministic evidence.

    These triggers are unconditional. The packet author may not waive a HEAVY
    trigger by declaring the seam established, the edit small, the test
    comprehensive, or the risk acceptable.

    Every HEAVY task receives:

    1. an orchestrator-authored implementation packet;
    2. an independent `checker-premise` verdict of `DISPATCH`;
    3. implementation by one or more workers;
    4. independent verification of the committed result; and
    5. integration by the orchestrator only after the required evidence passes.

    The packet must satisfy item 19, including its numbered **Least confident
    decisions** section. The premise checker attacks those decisions first.

    Every HEAVY packet receives an independent premise review. Item 19b decides
    whether that review is full or light, but a HEAVY packet may not skip the
    independent verdict. The packet author cannot certify that the author’s own
    claims are sufficiently measured to bypass the premise checker.

    One worker is the HEAVY default. The orchestrator may use up to **three parallel
    workers** only when the premise checker has returned `DISPATCH` on an explicit
    split showing:

    - disjoint allowed files and worktrees;
    - independently testable outputs;
    - separate commits;
    - an unambiguous integration order;
    - one owner for every shared contract;
    - no circular dependency between packets; and
    - a mutation and acceptance boundary for each packet.

    At most one worker may own the dangerous core: the migration, authorization
    boundary, destructive write, authoritative metric, persisted-data mapping, or
    frozen shared contract that caused the HEAVY classification. The other workers
    may own disjoint adapters, tests, UI, documentation, or other independently
    integrable surfaces.

    HEAVY uses **one independent acceptance checker by default**. That checker may
    run three isolated verification lanes against the same committed SHA:

    1. static analysis and build gates;
    2. deterministic tests and mutation replays; and
    3. integration, browser, accessibility, or content checks required by the
       packet.

    The lanes are process-level parallelism, not three agents independently
    rereading the same work. Each lane must preserve its real exit code and use
    isolated resources where applicable, including separate worktrees for source
    mutations, separate databases or schemas, unique ports, and distinct browser or
    test output directories. The checker aggregates the lane results into one
    verdict.

    A second specialized checker always requires explicit owner authorization.
    This applies even when the proposed specialist is accessibility-, content-,
    security-, or test-focused. The owner’s authorization must identify the
    unresolved question the additional checker will answer. Merely wanting more
    confidence is not sufficient justification for repeating the full review.

    One bounded correction round may return to the same worker and the same checker
    without another owner decision. More correction rounds, a replacement worker,
    arbitration, a second checker, or model escalation beyond the tier required by
    item 18 requires owner authorization.

    The orchestrator does not repeat a checker’s complete final verification. There
    should be one deliberate run for each evidence class. CI may repeat those
    checks after push because CI is the repository’s independent integration
    boundary, not another agent verification round.

    Historical calibration:

    - T305 remains HEAVY because its write could set `hours_override`,
      `check_in_at`, and `check_out_at` to null and overwrite `method` with
      `'coach'`, destroying or replacing a student’s existing attendance values.
      The premise gate’s measured payload exposed the defect.
    - T189 remains HEAVY because the proposed behavior could show real attendance
      dots beside “no completed meetings recorded yet this season,” producing
      contradictory claims about the student’s own records. This is a deliberately
      conservative calibration for that class.
    - GAM-451, as run on 2026-08-21, remains HEAVY because it changed a contract
      frozen for active sibling implementation. Once no sibling task still builds
      against that contract, the same bounded work would ordinarily be STANDARD.

    **Verification concurrency for every tier**

    Use the test runner’s own safe concurrency before creating additional
    processes.

    When separate process lanes are useful:

    - run them against the same committed SHA;
    - preserve each process’s real exit code;
    - isolate mutable resources;
    - never let two source mutations share a worktree;
    - never let database tests share a disposable database when their writes can
      collide;
    - assign unique ports and output directories to browser or integration lanes;
      and
    - aggregate every lane, including failures and authorized skips, into the final
      evidence record.

    Process-level parallelism primarily reduces wall-clock time. It does not promise
    reduced model usage. Agent-level parallelism is reserved for disjoint
    implementation packets whose outputs can be integrated independently.

    **Principles retained**

    **A check that executes is stronger than one that only reads.** Cognitive
    review is useful for deciding what to run and where to attack; it does not
    substitute for executing the prescription, mutation, or acceptance path. Every
    checker inspects the artifact and runs the evidence required by the packet.

    **Commit before mutating.** Every mutation begins from a committed candidate
    and runs in a disposable worktree under item 23. A restoration command is not
    evidence that an uncommitted fix survived.

    **Verification belongs to the tier, not the agent’s confidence.** FAST receives
    deterministic orchestrator evidence, STANDARD receives bounded independent
    verification appropriate to its risks, and HEAVY independently challenges both
    the premise and the completed implementation.

    **Self-test calibration summary**

    | Work class | Result under this item |
    | --- | --- |
    | T323-class local fix, implemented directly with deterministic mutation evidence | FAST |
    | T302/T303 as historically delegated | STANDARD |
    | T302/T303 if implemented directly and all FAST conditions hold | FAST-eligible |
    | GAM-451 after no active sibling depends on its frozen contracts | STANDARD, with the required specialized checker |
    | GAM-451 as run on 2026-08-21 while sibling work used the frozen contracts | HEAVY |
    | T305-class write capable of nulling or overwriting another user’s persisted fields | HEAVY |
    | T189-class contradictory or materially false reporting of a user’s own records | HEAVY |
    | Any migration, RLS/security-definer, auth/session/permission, or metric-SQL change | HEAVY |

27. **A user-visible surface that reads from a fixture, stub, or hardcoded
    value is not Passed — it is Partial, and the wiring task is filed and
    linked before the row moves.** Item 20 requires a deliberate deferral to
    produce a ledger row; this item governs what the *deferring* task's own
    status may be while that row is still open. A task whose acceptance
    criteria are all green against a surface no user can actually use has not
    been verified — it has been verified against a stub. Authorized by the
    human owner 2026-08-09.

    Rationale: item 20's three cited failures are one failure shape seen three
    times. T101 and T121 each correctly declined out-of-scope wiring, and each
    shipped a team picker rendering fixture teams; `SettingsPage` shipped an
    inert light/dark control for the same reason. Every one of them passed a
    checker, because in each case the checker was asked whether the component
    *rendered* — never whether it was connected to anything. Item 20's remedy
    is bookkeeping: file the follow-up. Bookkeeping does not stop the row from
    reading Passed in the meantime, and the ledger is the exact document the
    human owner reads to decide what is done. The escalation prices the gap:
    because `events.team_ids` is `uuid[]` while the fixture ids were plain
    strings, a deferral recorded as Passed became meeting creation failing
    outright in production. T407 — the Outreach nav badge that is a hardcoded
    zero — is the same shape, still open.

    **Scope — this is not a demand for horizontal completeness, and it does not
    enlarge any task.** Small, independently checkable tasks remain the unit of
    work, and a task may still legitimately ship one thin capability and stop.
    The test is narrow: *does the surface this task ships read real data, on the
    real path a user takes to reach it?* A loading, empty, or error state backed
    by the real loader satisfies this — item 12's four states are the standard,
    not an exception to it. A picker populated from a fixture array does not.
    Internal seams, test doubles, and work with no user-visible surface are
    untouched. Deliberately shipping Partial remains a correct outcome; what is
    no longer available is recording it as Passed.

    **Consequence for packets and checkers.** A packet for a task with a
    user-visible surface names, as one of its own acceptance criteria, the real
    source that surface reads from — the loader, query, or prop chain — so the
    checker verifies the *connection*, not the render. `checker-reviewer`
    grades a criterion satisfied only against a fixture as MAJOR, not NIT. This
    is the positive form of a rule item 26 already implies: a check that only
    reads the component is worth much less than one that follows the data.

    **`Partial` is a new ledger status value**, added by this item. The prior
    vocabulary was Passed / Filed / Blocked / Escalated. It is none of those:
    the work is done and merged (unlike Filed), nothing prevents progress
    (unlike Blocked), and no one is disputing anything (unlike Escalated) — the
    surface simply is not connected yet. A Partial row carries the id of the
    wiring task that will close it, and becomes Passed when that task passes.
    Rows already marked Passed are **not** retroactively re-graded; this item
    governs new work. T407 is the exception worth correcting by hand, because
    it is open and its surface is a hardcoded zero on screen today.

28. **Work is dispatched from Linear, and claiming it is the first act — not a
    later one.** The live queue is the `Todo` column of the `Gamitch` Linear
    team. `Backlog` means filed, not dispatchable. `docs/swarm/task-ledger.md`
    remains the historical record and is **not** superseded for provenance, but
    it is no longer where an agent discovers what to work on.

    **The rules, in order:**

    a. **Take only from `Todo`.** Never start a `Backlog` row because it looks
       ready. Promotion to `Todo` is the owner's authorization to work and the
       only ordinary authorization; it does not by itself choose an executor.
       **GAM-397 is the one-time bootstrap exception:** on 2026-08-15 the owner
       authorized its direct `Backlog → In Progress` move because the missing
       route guard made the ordinary path unsafe. This exception is not a
       reusable dispatch route.

    b. **Our issues are the ones carrying a `tier/*` label.** Linear ships its
       own onboarding issues and they live in `Todo` too; they carry no labels.
       Migrated rows also begin `Tnnn — `, and that prefix is worth preserving
       because 300 rows of cross-references depend on it — but it is **not** the
       identity test. A finding filed by a skill has no `Tnnn` and is still
       ours. Keying identity to the title would make newly filed work invisible
       to every agent, which is a queue nobody may take from.

       **Executor labels route authorized work; they do not authorize it.** On
       a tiered issue in `Todo`, `gate/human` overrides every executor label and
       forbids a machine claim. Otherwise, an explicit `executor/claude` route
       may be claimed only by Claude, and an explicit `executor/codex` route
       only by Codex; neither runtime may claim the other's route.

       **The initial missing-route behavior is migration-only compatibility.**
       Until GAM-398 completes the rollout, an executor label is not required
       and a missing route belongs only to the legacy Claude path. Do not create
       or apply `executor/codex` before GAM-398 deploys the accepted guard and
       then creates the executor label group; that blocked issue also owns the
       live canary. This amendment is not authorization to start the rollout.

    c. **Claim before reading anything else.** Move the issue `Todo → In
       Progress` the moment you pick it up, *before* opening a file. Then
       **re-read the issue and confirm you hold it** — Linear has no
       compare-and-set, so two agents can both read `Todo` and both claim. A
       read-after-write shrinks the race to milliseconds; without it there is no
       claim at all, only a hope.

    d. **A `tier/unreviewed` row may not enter `In Progress` until it is
       tiered.** Judging the tier is part of claiming, not part of finishing.
       Item 26 already requires that judgement to be stated and defended; this
       says *when*.

    e. **On completion move the issue to `In Review` — never to `Done`.**
       `In Review` means "the agent is finished; a human has not accepted it."
       An agent that closes its own issue is grading its own work, which the
       Definition of Done forbids and `worker-implementer`'s own definition
       rules out ("does not self-certify completion"). **The merge closes the
       issue, not the author.**

    f. **Keep the identifier out of the PR title unless the PR is that issue's
       work, and keep the commit trailer.** Linking and closing are two
       different mechanisms. The previous wording of this item conflated them
       and was false in this workspace; the correction is GAM-315, measured
       2026-08-10.

       **What links a PR to an issue.** Three channels link: the **branch
       name**, the **PR title**, and a **magic word** beside the identifier in
       the body. A bare prose mention elsewhere in the body does not (measured).
       Linear documents that PR **comments** do not link either, and this
       repository could not test that channel — take the documentation, not our
       silence, as the reason.

       **The magic words are a fixed list, quoted here rather than paraphrased,
       because an earlier version of this item guessed at it and left a hole.**
       From <https://linear.app/docs/github#link-through-pull-requests>, read
       2026-08-11:

       - **Closing** — `close`, `closes`, `closed`, `closing`, `fix`, `fixes`,
         `fixed`, `fixing`, `resolve`, `resolves`, `resolved`, `resolving`,
         `complete`, `completes`, `completed`, `completing`, `implement`,
         `implements`, `implemented`, `implementing`, **`linear issue`**.
       - **Non-closing** ("contributing") — `ref`, `refs`, `references`,
         `part of`, `related to`, `relates to`, `contributes to`, `toward`,
         `towards`. These link, and the issue still moves through the earlier
         statuses, but the *On PR or commit merge* status is **not** applied.

       **`implements GAM-nnn` closes.** So does `completes GAM-nnn`. A rule that
       only watches `close`/`fix`/`resolve` — as an earlier version of this item
       did — passes both.

       **`skip GAM-nnn` or `ignore GAM-nnn` prevents linking entirely, even when
       the branch name carries the identifier.** This is the escape hatch, and
       it is better than the branch-renaming workaround this repository invented
       before reading the documentation: it works when the identifier must stay
       in the branch name. `WORKFLOWS.md` rule 2 leads with it.

       ⚠ **The commit trailer this item requires contains a closing magic word,
       and it is inert only because a workspace toggle is off.**
       `Linear-Issue: GAM-nnn` is `linear issue` with a hyphen. Linear links
       from commit messages when the workspace setting *Link commits to issues
       with magic words* is enabled.

       **Measured 2026-08-11: that setting is off.** The clean exhibit is
       **PR #125** — branch `claude/w1-linear-autoclose` (no identifier), title
       `GAM-000` (a placeholder, not a real issue), body never naming GAM-303 —
       whose commit `56d9bc2` and merge commit `042ba45` both carry
       `Closes GAM-303`. **GAM-303 has exactly one attachment, PR #126.** The
       commit magic word produced nothing.

       **Two positive controls, so the empty result is informative** — the thing
       three earlier attempts on this subject lacked. PRs do produce attachments
       (#126, on this same issue), and they do so *even when the issue is
       already* `Done` (#151 attached to a closed GAM-304 at `22:48:31.430Z`).
       GAM-303 was `Done` before #125 merged, so the *state* instrument was
       blind here; the *attachment* instrument was not.

       **The hazard is latent, not absent.** Enable that setting and every
       commit carrying this trailer may become a closing instruction. Anything
       built on the trailer being invisible to Linear rests on a workspace
       setting, not on a property of the trailer.

       **A question three gate rounds left open is closed by the documentation,
       not by an experiment.** Those rounds could not separate the title channel
       from a magic-word token in negated prose, because every candidate PR in
       this repository carried both, and declined to run a live experiment to
       find out. Linear documents both independently: the title links, and a
       magic word links. There was never a disjunction — there are two channels,
       and both are live. **The cheaper instrument was the vendor's own
       documentation, and nobody read it for three rounds.** Record that, because
       the same reflex will recur.

       So the safe rule for a PR that must not move an issue: keep the
       identifier out of the branch name *and* the title, keep it away from
       **any** closing magic word above — or, more robustly, write
       `Ignore GAM-nnn` and let Linear suppress the link outright.

       **What closes the issue is the automation, not the magic word** — but
       the PR body can *suppress* it. The closer is the `Gamitch` team's Linear
       automation *PR merged → Done* (item 28g), firing when the **last open
       linked PR** merges. What the body controls is whether that automation is
       allowed to apply, in three cases:

       | Link created by | On merge |
       | -- | -- |
       | **No magic word** — branch name or title alone | automation **applies** |
       | A **closing** magic word (`Closes GAM-nnn`) | automation applies |
       | A **contributing** magic word (`ref`, `related to`, …) | **suppressed** |

       **The first row is the finding this item exists for, and it is the one
       measured here.** PR #141 carried no magic word of any kind, linked only
       by its branch name, and drove GAM-304 to `Done` 2.1 seconds after merge.
       So a closing magic word is *not required* for the automation to fire —
       omitting it is not a safeguard. A contributing magic word is a
       safeguard; silence is not.

       Two consequences to act on:

       1. **Once a PR is linked, its merge participates in that issue's state,
          and omitting the magic word protects nothing.** A branch named for an
          issue it merely mentions will close that issue on merge.
       2. **An issue with more than one linked PR can be moved backwards by the
          merge of its own fix** — that is what happens when the merge rule
          finds another linked PR still open. Keep the linked set to one PR.

       - **`Closes GAM-nnn` as the PR body's first line — still required, on
         different grounds.** It is the explicit human-readable record of
         *which* PR is the work, and it survives a branch rename. It is **not**
         what closes the issue. Wherever this repository states what closes an
         mechanism and date the statement; never attribute closing to a token in
         a PR body. If the mechanism is ever replaced, one dated sentence
         changes and this requirement does not.
       - **Commit trailer** — `Linear-Issue: GAM-nnn (Tnnn)`. **Commit messages
         do not link in this workspace, for both forms and for different
         reasons.** A *bare identifier* does not link at all — measured on
         GAM-318/319/320, which took no attachment and no state change, with a
         positive control in the same PR delivery. A *magic word* in a commit
         message does not link either, but only because the *Link commits to
         issues with magic words* setting is off — see the ⚠ above, and PR #125
         / GAM-303. **The first is a property of Linear; the second is a
         property of your settings, and only one of them is yours to keep
         true.** So the trailer gives traceability and no automation, and it
         survives in git history independently of any hosted account, which is
         the same reason item 29 keeps an export. Item 24 joins recording to
         merging; this is that rule's Linear form.

    g. **Branch names carry the issue identifier — `WORKFLOWS.md` rule 2 is
       the rule and is not restated here** (item 3). It already existed; item 29
       only changed its format from `claude/t<row>-` to `claude/gam-<n>-`. Its
       original rationale is unchanged and worth knowing: a session-scoped name
       looks reserved and is not, and two sessions once worked one mutable ref
       because of it.

       **Only ONE PR automation is live. Changed by the owner on 2026-08-11**
       (Phase 0 of `docs/swarm/2026-08-11-linear-github-integration-proposal.md`),
       read from the settings UI at *Settings → Team → Workflows & automations →
       Pull request and commit automations*:

       ```
       On draft PR open              -> No action
       On PR open                    -> No action   (was: In Progress)
       On PR review request/activity -> No action   (was: In Review)
       On PR ready for merge         -> No action
       On PR merge                   -> Done        (unchanged — the only closer)
       Branch-specific rules         -> none
       ```

       The two that were disabled are the ones that moved an issue **backwards**
       when a second linked PR was still open, and **reopened** a closed issue
       when a PR opened on a stale branch carrying its identifier — four of the
       thirteen catalogued wrong moves. Nothing is lost: items 28c and 28e
       already require the agent to make both of those moves by hand, with a
       read-back the automation could never provide.

       **Three further state-writers exist. Two are off; one is ON and nobody
       had catalogued it.** All read from the UI on 2026-08-11:

       | Setting | Where | State |
       | -- | -- | -- |
       | Link commits to issues with magic words | workspace → GitHub integration | **OFF** — keeps the item-28f trailer inert (see 28f) |
       | On git branch copy → started status | account → Code & reviews | **OFF** (was on; the likely cause of GAM-304's otherwise unexplained `Backlog → In Progress` at 02:23Z on 2026-08-10, which had no PR and no attachment) |
       | On open in coding tool → started status | account → Code & reviews | **ON**, deliberately — a stronger signal of intent than copying a branch name |
       | Auto-close stale issues | team → Auto-close automations | **OFF** — was ON at 6 months → `Canceled`; disabled by the owner 2026-08-11 |
       | Auto-close parent issues / sub-issues | team → Auto-close automations | OFF (both) |

       **Why that last one mattered: it was a machine able to close a
       `gate/human` issue**, which the label exists to forbid — and it would
       have fired on age alone, with no PR, no merge and no human act. `GAM-80`
       (Vercel go-live), `GAM-75` (MIG-06 cutover) and `GAM-62` (production
       email) were the live exposure: long-lived owner-gated rows are exactly
       the shape a staleness rule cancels. Found only because the owner
       screenshotted the settings page while disabling something else.
       **Generalise it: this workspace's state-writers are not enumerable from
       the repo, and three of the four found so far were found by accident.**

       **Reproduce this rather than trust it.** A prose enumeration goes stale
       silently the moment the owner changes a setting, which is the failure
       this item was corrected for once already:

       ```js
       gql('{ teams(first:5){ nodes{ key gitAutomationStates(first:30){ nodes{ event targetBranch{ id branchPattern isRegex } state{ name type } } } } } }')
       ```

       `targetBranch` scopes the PR's **base** branch, not its head, so no
       branch-naming scheme can be expressed there — vendor-confirmed:
       *"Branch rules apply only to target branches… Automations are not
       supported for source branches."* Whether to change any of this is the
       owner's decision, outside the repo — do not change it from here.

    **Authorized by the human owner 2026-08-09, and filed because the failure was
    measured rather than imagined.** The first agent dispatched through Linear
    found its issue correctly and unaided — and then did not claim it. The owner
    had to say "go update the ticket and claim it." The agent was not at fault:
    it read `AGENTS.md`, whose entry point still described the owner naming a row
    in chat, and **`constitution.md` contained the word "Linear" zero times.**
    Every rule above existed only in a plan document and a conversation, neither
    of which an agent reads at startup. The migration moved 296 rows of data and
    left the protocol behind. **A queue nobody is told to consume is a document,
    not a dispatch system** — and the atomic claim, which exists so two agents
    cannot take the same row, does not exist at all if it depends on a human
    asking for it.

29. **The ledger is frozen, the number blocks are retired, and the git-side
    record is generated rather than maintained.** `docs/swarm/task-ledger.md`
    stops growing. It remains in the repository as the pre-migration historical
    record — 301 rows whose cross-references are cited throughout the code,
    commits, PRDs and the verification log — and it is still authoritative for
    the provenance of anything filed before 2026-08-09. **Do not add rows to
    it, and do not edit a row's Status to reflect new work.** Linear is where
    state lives now.

    a. **Stop minting `Tnnn`.** The block table (`W1 T400-499`, `W3 T600-699`,
       …) existed for exactly one reason: collision avoidance between parallel
       agents, because a Markdown file has no allocator. Linear allocates
       `GAM-nnn` atomically server-side, so the scheme is obsolete. It was also
       actively misleading — `WORKFLOWS.md` states the block is *"a
       collision-avoidance reservation, not an ownership claim,"* and `T509`
       sits in W2's range while being W4's work, which forced hard-coded
       exceptions into the migration. New work is `GAM-nnn` and carries no
       `Tnnn`. Item 28b already keys agent identity to the `tier/*` label
       precisely so this is safe.

    b. **`scripts/linear-export.mjs` writes the git-side record**, as
       `docs/swarm/linear-export.json` (complete, what you restore from) and
       `docs/swarm/linear-export.md` (readable, what git diffs and a human
       greps). Both are **generated whole on every run and never hand-edited**;
       both carry a DO-NOT-EDIT banner. The export is **one-directional** —
       Linear is the source, these are a backup. Nothing writes back.

    c. **The export is refreshed by a scheduled job that commits, NOT by a gate
       that blocks.** `.github/workflows/linear-export.yml` runs on push to
       `main`, daily, and on demand; it commits the two files when they move and
       asserts `--check` afterwards. Without it the backup rots silently, which
       is the same failure as an unmaintained ledger wearing a different hat.

       **This item originally said "let CI enforce it" with `--check` on pull
       requests. That was wrong and is corrected here.** Such a gate would fail
       every task PR for a correct reason: claiming an issue moves it
       `Todo → In Progress`, which makes the committed export stale **by
       definition**, and the agent cannot fix it — the final state only exists
       after the merge closes the issue. The rule would have blocked work that
       was proceeding exactly as designed, and agents would have learned to
       ignore a red check. Heal, do not gate.

       Requires the `LINEAR_API_KEY` repository secret. **A read-only key is
       sufficient and is what should be used** — the export only reads, and a
       scheduled job holding a write-capable key is more blast radius than the
       work needs.

    **Authorized by the human owner 2026-08-09.** Rationale, all measured on the
    day this was written rather than argued: a hand-maintained table failed
    three independent ways in a single audit. **T063b** was merged, tested,
    live work with no row at all. **`WORKFLOWS.md`** claimed 40 open rows
    against a true 50, every workflow disagreeing. And **eleven rows recorded
    their closure in the Epic column** while Status still read `Filed`, so the
    migration made them live issues and an agent worked a row superseded four
    days earlier. None of these was carelessness — each edit reads correctly to
    a human. They are what a schema-less table does at 301 rows and four
    concurrent machines. **A generated file cannot put a closure in the wrong
    column, and a server-side allocator cannot hand two agents the same
    number.** The distinction that matters is not Markdown versus JSON; it is
    maintained versus generated.

    **What is deliberately NOT claimed:** that Linear is more durable than git.
    It is not — it is a hosted service on a free plan, and if the account lapses
    the history goes with it. That is precisely why (b) exists and why the
    ledger file is frozen rather than deleted.

30. **An issue nobody can prioritize is not filed, it is parked.** Every Linear
    issue an agent writes — a new filing, a deferral under item 20, a finding a
    skill produced — follows `.claude/skills/linear-task-writing`. Invoke the
    skill; do not reproduce its structure from memory.

    **The four rules that carry the weight:**

    a. **Lead with the defect, not the provenance.** The first sentence says what
       a user sees or what breaks. Who filed it, under which item, during which
       gate, belongs in the provenance table at the bottom.

    b. **State a priority and defend it.** Name who is affected today, whether
       anyone has actually seen it, what it blocks, what it costs, and the
       trigger that ends the deferral. "Critical" is not a priority; it does not
       help anyone choose between two rows. The owner can overrule a
       recommendation and cannot overrule its absence.

    c. **Verify before writing, and keep the corrections.** Re-check every line
       number and claim against current `main`. A recorded citation is historical
       evidence, not proof of current state. When re-verification contradicts the
       filing, the issue carries a `Verification note` saying what was wrong —
       deleting the error deletes the evidence that the check happened.

    d. **Rewriting preserves the original.** The pre-rewrite text goes in a
       `<details>` block at the bottom, verbatim. Item 29 makes Linear the source
       and git the backup; a rewrite that discards the original breaks the
       backup.

    **This binds the writer, not the reader.** Nothing here licenses reformatting
    someone else's open issue mid-flight. Rewrite an issue you are filing, one you
    have claimed, or one the owner asked you to fix.

    **Authorized by the human owner 2026-08-09**, whose words are the rationale:
    *"i have to know which ones to prioritize and i can't understand what it's
    saying."* The trigger was **T808/GAM-303**, a real defect whose filing opened
    with the harness that found it and reached the symptom in paragraph two.
    Rewriting it also surfaced three errors nobody had caught — a wrong line
    number, a second render site that does not exist, and a missing root cause
    that would have sent the implementer to a `round1` helper belonging to a
    function the render path no longer calls. **The rewrite was not cosmetic; the
    verification it forced is what found the errors.** Item 29 is why this is a
    rule rather than a preference: with the ledger frozen, the issue text is the
    whole record, and 46 rows migrated carrying `tier/unreviewed` in a house
    style written for the filer rather than the reader.
