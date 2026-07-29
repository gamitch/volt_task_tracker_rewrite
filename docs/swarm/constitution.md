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

