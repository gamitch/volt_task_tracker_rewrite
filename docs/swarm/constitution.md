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
