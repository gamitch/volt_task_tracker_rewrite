Closes GAM-410

## What changed

Added `### 5.2a Capability-model invariants (measured, GAM-407)` to
`docs/swarm/2026-08-15-durable-multi-agent-execution-plan.md`, carrying the four
BLOCKER-class defects GAM-407's premise gate measured against a real PostgreSQL
cluster into the plan as testable requirements, plus the in-repo
`supabase/config.toml` transport evidence and a sentence that these invariants
bind whatever store the GAM-407 spike selects (they do not pre-empt its
verdict). Added one forward-reference bullet in §5.1 and one clause on §11.1
decision 1 linking both back to §5.2a. Single-file diff: 39 insertions, 1
deletion.

## What the issue got wrong

Nothing measured — the issue's four invariants matched
`docs/swarm/active/GAM-407-interim-findings.md` Part 1 (findings F1-F4)
verbatim on inspection. The orchestrator's own packet, however, mis-stated
invariant 4: it wrote that a superuser-rooted `SET ROLE` rig "reports every
escalation as denied," when F4's transcript shows the opposite — `SET ROLE`
from a superuser session *succeeds* ("`<-- escalated`"), which is what makes an
"executor cannot escalate" assertion fail (a false FAIL, not a false pass).
Caught during the orchestrator's independent post-worker review, before this
PR opened, and corrected in the committed text. Recorded in
`docs/swarm/active/GAM-410-run-log.md`.

## Tier, stated and defended

**STANDARD** (constitution item 26). Trigger: doc-only change, no write path,
no schema/migration/RLS/auth *code* (the new text describes invariants a
future implementation must satisfy; it implements none), and the issue's own
sizing ("written by one agent and read by another") names exactly this tier.
The losing argument for HEAVY was that the content is security-relevant and
feeds Phase 2's design — true, but item 26's HEAVY trigger is a change that
*touches* a write path, RLS/auth/role logic, or migration/metric-view SQL, and
this change touches none; it is prose about future code, not the code.

Process deviation, declared rather than hidden: item 19 gates every packet
through `checker-premise` before it reaches a worker. This packet skipped that
gate under item 19b ("light check or skip for packets that roll out an
already-verified pattern to a new surface") — all four technical claims were
already adversarially measured by `checker-premise` across GAM-407's two gate
rounds on a real cluster; this task only transcribes them. In place of the
gate, the orchestrator independently verified every citation before writing
the packet (item 19c) and again against the worker's diff afterward — the
second pass is what caught the invariant-4 wording error above. Reasoning
recorded in `docs/swarm/active/GAM-410-packet.md` and the run log at dispatch
time, not after the fact.

## Verification

```
GATE RUN — bba17b5 on claude/gam-410-plan-capability-invariants — tree clean

  1 tsc              exit 0  PASS
  2 vite build       exit 0  PASS
  3 format:check     exit 0  PASS
  4 eslint           exit 0  PASS       0 errors, 379 warnings
  5 vitest (full)    exit 0  PASS       96 files / 2466 tests  (no baseline given — regression not checked)
  6 vitest (scoped)      –  SKIP
                            no scope given and none derivable from the diff -- pass --scope <path> to run it

VERDICT: PASS — 5 of 6 gates. NOT all six: 1 skipped.
```

Gate 6 skipped correctly: the diff touches no `src/` path, so there is no
defensible scope to derive. Test count (2466) matches the count last recorded
against this tree on GAM-407's packet, no regression.

No code changed, so there is no mutation-replay table — nothing here can turn
a test red. The equivalent verification for a planning-document change is
textual fidelity against the source measurement: every one of the four
invariants, the `supabase/config.toml:13` citation, and the two adjoining edits
(§5.1 bullet, §11.1 clause) were checked line-by-line against
`docs/swarm/active/GAM-407-interim-findings.md` Part 1 and the plan document's
own current text before this PR opened. That check is what surfaced and fixed
the invariant-4 defect described above.

## Scope: what this does and does not close

This closes GAM-410 in full — the issue asked for one document section (§5.1
or a new §5.2a) carrying four invariants, sized and scoped by its filer as
"one document section... written by one agent and read by another." Nothing
about this PR implements, tests, or ships the invariants against real
infrastructure — GAM-407 still owns that spike, entirely undecided by this
change, exactly as the issue's "one constraint" requires.

## Follow-ups filed

None. This is a self-contained plan amendment with no out-of-scope wiring
discovered during the work.

## Known gaps, disclosed

None beyond the one already corrected above (invariant 4's wording, fixed
before this PR opened, not left as a residual gap).

Linear-Issue: GAM-410
