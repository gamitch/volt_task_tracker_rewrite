# Constitution — the rebuild

The last constitution grew to 1,223 lines and was right about almost
everything while the app shipped broken. This one is deliberately small. It
keeps the rules that were paid for in real defects (each cites its tuition in
`LESSONS.md`) and drops the machinery. If a rule here stops earning its keep,
George deletes it.

**Spirit, in George's own words:** *"This is a volunteer group, not a
company... please keep it simple."* Every rule below is read through that
sentence. (P-5)

## Authority

1. Precedence: George's recorded rulings (`DECISIONS.md`) > `PRD.md` > this
   file > anyone's judgment. Conflicts get a one-line question to George,
   never an improvisation.
2. New rulings are recorded in `DECISIONS.md` verbatim, dated, at the time
   they're made. A claim of owner approval must cite its entry.
3. These three documents are edited in place. No parallel state docs, no
   append-only update stacks, no run logs in the repo. Git history and the
   tracker are the record.

## Hard floors — never traded away

- **H-1 · Minors' privacy.** RLS default-deny on every table; no public
  pages; full names/emails/contact info restricted to staff; first name +
  last-initial elsewhere (P-2, P-3). No PII in logs, URLs, fixtures, or
  commit messages.
- **H-2 · No secrets client-side.** Service-role keys exist only in Edge
  Functions; `.env*` never committed.
- **H-3 · Metric math lives only in SQL views** — one owning view per
  metric, every surface reads it, no TypeScript re-derivation (PR-1). The
  one rule from last time with a perfect record.
- **H-4 · No engagement mechanics aimed at minors** (P-4). Honest progress
  signals only.
- **H-5 · Migrations are additive once real data exists.** Before cutover,
  collapse into the baseline instead of layering corrections — the old repo
  needed 4 files to know one view's definition.
- **H-6 · Accessibility on core flows ships or the flow doesn't**: keyboard
  path, visible focus, measured contrast in both themes.

## Working software — the rules that would have saved the last app

- **C-1 · Done = driven in a real browser + read back from the database.**
  A user-facing change is finished when a persona walks the flow against
  the deployed (or e2e-harness) app and the resulting rows are verified by
  query. "The component renders" is not a completion state. *(Tuition: 2,792
  green tests over a core loop with no working path.)*
- **C-2 · No fixture data on live routes. No placeholder defaults.** A page
  has exactly one data path; identity/scope props are required;
  `PLACEHOLDER_*` in `src/` fails lint. Loading/empty/error states come from
  the real loader. *(Tuition: the ED-1 family — nearly every real bug.)*
- **C-3 · Vertical slices, one milestone in flight.** A feature ships with
  its schema, its writes, its wiring, and its fallback in one slice. No
  component merges unmounted. *(Tuition: six built-and-tested components
  mounted nowhere; tap-to-cycle chips that never once rendered.)*
- **C-4 · A schema change lands with its writer** — same slice, same PR,
  and applying the migration is part of done. *(Tuition: the writer-less
  `student_teams` junction silently zeroed every new student's
  participation.)*
- **C-5 · Deployed from week one; every milestone accepted on the deployed
  app by George.** Launch gates get dates, not open-ended tickets.
  *(Tuition: months of polish on an app whose launch gates never moved; an
  Edge Function written, tested, and never deployed.)*
- **C-6 · A backlog row exists only if a user hits it or it blocks launch.**
  Review observations get fixed in the moment or dropped — not filed.
  Follow-up chains cap at one link: a follow-up of a follow-up means stop
  and fix it now. *(Tuition: 496 issues in 21 days; 2 filed per merge; the
  backlog never converged.)*
- **C-7 · Run the check before writing the claim.** Any statement about
  schema, policies, data, or component capability that will direct work is
  verified by executing something — a query, a scratch cluster, a browser —
  first. *(Tuition: 3 of 3 premise-checked tickets defective; six wrong
  calls in one session, each "a plausible mechanism asserted before the
  cheap check was run.")*
- **C-8 · Proportionate verification.** One builder, one verification pass.
  CI = typecheck, build, lint, unit tests, and the persona e2e suite —
  green on a clean checkout, always. Mutation replay is reserved for the
  high-stakes zone: data loss, auth/RLS, metric SQL, destructive writes.
  Everything else ships on C-1 evidence. *(Tuition: ~$90 and 12 hours for a
  4-file change; 1.1M tokens for one assembly ticket.)*
- **C-9 · High-stakes work gets a second set of eyes; nothing else does.**
  Migrations, RLS, auth, metric SQL, and destructive writes get an
  independent review with C-7-style executed evidence. A CSS change does
  not. No tiers, no packets, no premise gates — judgment plus this one
  sentence. *(Tuition: the full packet → premise-gate → worker → checker
  chain charged full price for two-line fixes until George himself ordered
  a faster path.)*
- **C-10 · Code budget.** Page files ≤ ~500 lines (split at the seam:
  loader → pure model → view); one home per shared utility (dates, load
  state, formatters); duplication found = duplication removed in that PR.
  *(Tuition: a 4,506-line page file; one function copied 15 times.)*
- **C-11 · Comments explain the domain.** Why the grace rule is inclusive,
  why excused shrinks the denominator. Never ticket numbers, process
  narration, or line-number citations that rot. *(Tuition: ~45% of page
  lines were process archaeology.)*

## Working agreements

- **W-1 · One agent/session at a time** unless files are provably disjoint.
  *(Tuition: cross-machine collisions, manufactured merge conflicts, ×N
  record drift.)*
- **W-2 · Explicit pathspecs when staging; never `git add -A`** (PR-4).
- **W-3 · Small PRs, named for what they do.** The PR body states what a
  reviewer (or George) should click to see it work. If it can't be seen
  working, it isn't done (C-1).
- **W-4 · A deliberate deferral is a tracked issue that passes C-6, or it
  doesn't happen** (PR-2). Code comments are not a queue.
- **W-5 · Stop-the-line rule.** If a number on screen can be wrong about a
  user's own record (hours, participation, attendance), that outranks every
  feature in flight.
- **W-6 · When George reports a bug from live use, it is priority one and
  presumed correct** until a C-7 check shows otherwise. Live use was the
  best defect signal the last project ever had.

## Severity, kept simple

- **Blocker**: violates a hard floor, corrupts or loses data, shows a wrong
  number about a user's own record, breaks the build or a persona flow.
- **Fix now**: everything else worth doing — do it in the current slice
  (C-6).
- **Drop**: everything else. Write it nowhere.
