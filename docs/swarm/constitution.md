# Project Constitution

## Mission

A private, role-aware portal for VOLT (FRC Team 11195) that separates meeting attendance (participation %) from outreach attendance (volunteer hours toward season goals), makes check-in dead simple via rotating QR codes with coach override, and keeps students and parents informed through email reminders and a subscribable calendar feed. Authoritative spec: `VOLT_Portal_PRD.md` v1.5 — requirement IDs (e.g., MTG-08) outrank everything below except safety.

## Non-Negotiables

- The app must build successfully.
- Existing tests must pass unless the boss explicitly approves a test update.
- No worker may mark its own work complete.
- Every task must be checked by a separate checker agent.
- Every checker must inspect the actual artifact, not just the worker's summary.
- Protected source text must remain verbatim unless explicitly approved.
- Accessibility, security, data integrity, and usability outrank cosmetic preferences.
- No agent is above verification, including the boss.

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
2. Astryx component props come **only** from `docs/swarm/astryx-api.md` (PRD DES-19). A prop absent from that file is presumed hallucinated → MAJOR. The CLI (`npm run astryx -- component <Name>`) is a cross-check, not a source.
3. RLS policies and metric SQL come **only** from PRD Section 8.4, copied verbatim. Re-deriving either, or duplicating a metric formula in TypeScript (PRD DATA-01) → BLOCKER.

### Security & privacy (students are minors)
4. RLS is default-deny; any table without policies → BLOCKER. Policies use only the 8.4 `security definer` helpers; a policy subquerying its own table → BLOCKER.
5. No secrets in the repo: `.env*` gitignored; service-role keys never appear in frontend code or client bundles → BLOCKER.
6. No PII (student names, emails) in logs, URLs, analytics, commit messages, or test fixtures — fixtures use fabricated names. Kiosk and public leaderboard surfaces follow PRD SEC-04/ROS-08 → BLOCKER.
7. No email sends outside Resend test mode until E8's checker approves production sending; reminder dedupe per PRD EML-03 is a correctness requirement, not an optimization.

### Stack locks
8. Vite + React 19 + TypeScript strict + Supabase. **No Tailwind, no shadcn, no alternate UI/CSS libraries** (PRD D2/D3) → BLOCKER. *React 19 is an approved, human-authorized deviation from PRD D2's "React 18" — see dispute-log D002 for the ruling and evidence (`@astryxdesign/core` requires React 19 at runtime, not just in peer metadata). The PRD text itself is intentionally unedited; D002 is the record of the deviation.*
9. Dependency allowlist: `@astryxdesign/*`, `@supabase/supabase-js`, `@tanstack/react-query`, `react-router-dom`, `qrcode.react`, `ical-generator` (Edge Function), plus dev tooling (vitest, playwright, eslint, prettier). Anything else requires boss-architect approval recorded in the ledger.
10. Database changes are additive migrations via the Supabase CLI; editing an applied migration file → BLOCKER.

### UI & quality
11. UI is built from Astryx components; styling escalation order per PRD DES-21 (component → theme token → xstyle → custom CSS); ejecting component source needs boss approval.
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

19. **Planning artifacts are checked before dispatch.** No PRD, packet set, or
    task packet reaches a worker until `checker-premise` has returned
    **DISPATCH** on it. The planning layer is otherwise unverified: every other
    artifact in this process is checked by someone who did not write it, and
    plans were the sole exception. A REVISE verdict is not advisory — the
    author revises and re-submits. Record the verdict alongside the plan.
    Rationale: a real PRD in this project reached the approval gate carrying
    two false defect claims, one physically impossible prescription, one "fix"
    that would have stripped accessible names off six screens, and a silent
    reversal of a passed task's green test.

    **19a. The gate is capped at two rounds.** A third REVISE escalates to the
    human owner instead of looping. Measured on wave 5's first packets: round 1
    cost ~130K opus tokens and caught 4 BLOCKERs; round 2 cost ~105K and caught
    2 MAJORs. One round costs roughly one prevented rework cycle, so two rounds
    is break-even-to-positive and a third is net negative. A plan still failing
    after two rounds has something wrong with the plan, not the wording.

    **19b. Scope the gate by risk.** Full premise check for novel patterns and
    for anything touching migrations, RLS, or metric SQL. Light check or skip
    for packets that roll out an already-verified pattern to a new surface
    (e.g. applying a proven table migration to a second list page). The gate
    exists to catch unverified premises, not to re-audit settled ones.

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

A plan may be dispatched to workers only when:

1. `checker-premise` returned DISPATCH (item 19).
2. Every factual claim it relies on was verified against the real repository.
3. Every prescription is feasible, or its escalation is named and pre-approved.
4. Every acceptance criterion is measurable with fixtures that exist today.
5. Any reversal of previously-passed work is explicit and authorized.

## Definition of Done

A task is done only when:

1. The worker produces the requested change.
2. The checker validates the actual artifact.
3. The checker records evidence.
4. The foreman updates the task ledger.
5. The boss or foreman accepts the checked result.

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

26. **Three process tiers, triggered by risk — not by topic, ticket size, or
    habit.** The full chain (packet → `checker-premise` → worker →
    `checker-reviewer`) is the *heavy* tier and must not be the default. Choose
    by asking one question: **can a mistake here corrupt data, or lie to a user
    about their own data?** Authorized by the human owner 2026-08-02, verbatim:
    *"For small fixes like items T321 and T323 is there a faster path we can
    take to get those done? the Boss->Checker->Foreman->Worker->Checker path
    seems to eat up alot of time for a few line bug fix"*.

    **FAST — the orchestrator implements directly. No packet, no worker, no
    checker.** Permitted only when **all** hold: no write path or destructive
    operation; no schema, RLS, migration, or auth/role logic; no change to a
    signature another module imports; roughly ≤20 lines of production change;
    and a named mutation exists that turns a test red. **Verification is not
    reduced** — the mutation is run and its real red output reported, all six
    gates are run, and the result goes through a PR. What is removed is
    *coordination*, not evidence.

    **STANDARD — worker implements, orchestrator replays the mutation. No
    separate checker round.** Single module, may add a test seam, still no
    write path. This is what T302 (one test) and T303 (one noun) received;
    both passed first time.

    **HEAVY — packet + premise gate + worker + checker.** Required when the
    change touches a **write path or destructive operation**, RLS/auth/role
    logic, a migration or metric-view SQL, or an export another session builds
    against. **This tier has earned its cost and must not be diluted:** on T305
    the gate *built* the prescription and captured the real upsert payload,
    proving the proposed fix would null a student's recorded hours and method;
    on T189 it proved the proposed detector relied on a view that inner-joins on
    an active season, so a lapsed season would have told **every** student their
    account was deactivated. Both were data-correctness defects invisible to
    reading the code.

    **A gate that only reads is worth much less than one that runs.** Every
    finding that changed an outcome this session came from an agent that
    executed the prescription in its own worktree (item 23), not from one that
    reviewed it.

    **Fast-tier working rule, learned the hard way: commit before mutating.**
    T323's mutation was reverted with `git checkout --`, which also reverted the
    uncommitted fix; only the full suite revealed it. Commit, mutate, revert,
    re-verify.

    **Choosing the tier is a judgement the orchestrator must state and defend in
    the PR**, so a wrong call is visible and correctable rather than silent. If
    two tiers are arguable, take the heavier one — but "it sounds important" is
    not a trigger, and neither is the number of files touched.

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
       ready. Promotion to `Todo` is the owner's signal and the only one.

    b. **Our issues are the ones carrying a `tier/*` label.** Linear ships its
       own onboarding issues and they live in `Todo` too; they carry no labels.
       Migrated rows also begin `Tnnn — `, and that prefix is worth preserving
       because 300 rows of cross-references depend on it — but it is **not** the
       identity test. A finding filed by a skill has no `Tnnn` and is still
       ours. Keying identity to the title would make newly filed work invisible
       to every agent, which is a queue nobody may take from.

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

    f. **Put the identifier in the PR title, and keep the commit trailer.**
       Both, because they serve different readers:

       - **PR title** — `GAM-nnn` anywhere in it. This is what Linear's GitHub
         integration reads to link the issue and, with the workflow automation
         enabled, to move it to `Done` on merge. **Linear does not read commit
         trailers**, so the trailer alone gives traceability and no automation.
         Using the issue's own `gitBranchName` for the branch links it too.
       - **Commit trailer** — `Linear-Issue: GAM-nnn (Tnnn)`. This survives in
         git history independently of any hosted account, which is the same
         reason item 29 keeps an export. Item 24 joins recording to merging;
         this is that rule's Linear form.

       **Owner action, once, outside the repo:** enable the Linear workflow
       automation *PR merged → Done* for the `Gamitch` team. Until that is on,
       issues will sit in `In Review` after their PR lands and must be closed
       by hand.

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

    c. **Run the export after any batch of work, and let CI enforce it.**
       `--check` fails when the committed export is stale. Without that the
       backup rots silently, which is the same failure as an unmaintained
       ledger wearing a different hat.

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
