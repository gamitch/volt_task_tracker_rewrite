# GAM-410 — carry GAM-407's four measured capability-model defects into plan §5.1/§5.2

Issue: [GAM-410](https://linear.app/gamitch/issue/GAM-410/plan-51s-capability-model-has-four-measured-defects-the-durable)
Tier: **STANDARD** (item 26). Doc-only, no code, no write path, no schema/migration/RLS/auth
*code* change — this edits prose that *describes* invariants for a future implementation, it does
not implement any. Matches the issue's own sizing: "written by one agent and read by another."

Plan doc: `docs/swarm/2026-08-15-durable-multi-agent-execution-plan.md`
Source evidence (read-only, do not edit): `docs/swarm/active/GAM-407-interim-findings.md`

## Premise-gate scoping (item 19b) — recorded by the orchestrator before dispatch

This packet transcribes four findings (F1-F4) that were **already** adversarially measured by
`checker-premise` across two GAM-407 gate rounds on a real PostgreSQL cluster (transcripts:
`docs/swarm/active/GAM-407-gate-round1.md`, `-round2.md`). No new technical claim is introduced
here — this is "an already-verified pattern rolled out to a new surface" (item 19b), so the
orchestrator is skipping a separate `checker-premise` round and instead independently verified,
before writing this packet:

- The four findings (F1: GUC-keyed RLS is forgeable; F2: `security definer` under a `BYPASSRLS`
  owner runs with RLS off; F3: PostgreSQL grants `EXECUTE` to `PUBLIC` by default; F4: `SET ROLE`
  from a superuser session is authorized against `session_user` and cannot measure escalation) —
  read verbatim from `GAM-407-interim-findings.md` Part 1, confirmed present at that path.
- Current plan text: `docs/swarm/2026-08-15-durable-multi-agent-execution-plan.md`
  §5.1 = lines 229-269 (spike prerequisites + run-record schema),
  §5.2 = lines 271-293 (external-write boundary; line 278 is the exact "run-scoped capability"
  sentence the four findings attack), §11.1 decision 1 = lines 798-800 (names Supabase-as-run-store
  the least confident decision). All three line ranges confirmed current on this branch.
- `supabase/config.toml:13` reads `schemas = ["public", "graphql_public"]` — confirmed current,
  supports the in-repo transport evidence the issue asks to also record.

## Task

Add a new subsection **5.2a "Capability-model invariants (measured, GAM-407)"** immediately after
§5.2 (after line 293, before the `### 5.3 Credential paths` heading), containing the four
invariants below as requirements a design **must** satisfy, not as narrative prose. Each invariant
must be phrased as a testable requirement (mechanically assertable or measured against a real
connection), matching the issue's own wording:

1. A capability must not be carried in a settable GUC. Name `request.jwt.claims` as the concrete
   example: it is `USERSET`, and `REVOKE SET ON PARAMETER` does not restrain it — a claims-keyed
   capability's security lives entirely in PostgREST, not in the database, and any design relying
   on it must say so in its threat model.
2. Every `security definer` helper must be owned by a `NOSUPERUSER NOBYPASSRLS` role, and this must
   be asserted mechanically (e.g. `select rolbypassrls from pg_roles where rolname =
   pg_get_userbyid(proowner)` reads `false` for every such object) — `force row level security`
   binds the table owner and does not defeat the `BYPASSRLS` role attribute.
3. Every function grant must be explicit and preceded by `revoke execute … from public`, asserted
   against `pg_proc.proacl` (a null `proacl` means `EXECUTE TO PUBLIC`, PostgreSQL's default for
   every new function).
4. Escalation negatives must be measured from a real `LOGIN` connection, never via `SET ROLE` from
   a superuser session — `SET ROLE` is authorized against `session_user`, so a superuser-rooted rig
   reports every escalation as denied regardless of whether the design actually denies it.

After the four invariants, add one short paragraph recording the in-repo transport evidence: cite
`supabase/config.toml`'s `schemas = ["public", "graphql_public"]` and state that exposing an `ops`
schema through PostgREST — which invariant 1 shows is where a claims-keyed capability's security
actually lives — requires a config change, which is checkable evidence for the Edge-Function-vs-RLS
comparison §5.1 leaves open.

Close the new subsection with one sentence stating explicitly that these invariants constrain
**whatever store §5.1's spike selects** — they do not presuppose Supabase and must not be read as
pre-empting GAM-407's verdict (the issue's "one constraint").

Cite the source: end the subsection with a line pointing to
`docs/swarm/active/GAM-407-interim-findings.md` (findings F1-F4) as the evidence these invariants
are drawn from.

**Also touch §5.1** (inside the existing bounded-spike bullet list, lines 235-242): add a
one-line forward reference after the third bullet (the run-scoped-capability bullet, line 239-240)
pointing to the new §5.2a, so a reader of §5.1 does not miss the invariants.

**Also touch §11.1 decision 1** (lines 798-800): append one clause to the existing sentence (do
not rewrite it) noting that "acceptable operational isolation" is now specifically bounded by
§5.2a's four invariants, so the least-confident-decision entry and the invariants stay linked.

## Allowed files

- `docs/swarm/2026-08-15-durable-multi-agent-execution-plan.md` — the only file to edit.

Do not edit `docs/swarm/active/GAM-407-interim-findings.md`, any other GAM-407 artifact, or this
packet. Do not touch `docs/swarm/constitution.md`, `docs/swarm/task-ledger.md`, `AGENTS.md`, or
`.claude/**` (worker ownership boundary, `AGENTS.md` "Ownership and protected files").

## Acceptance criteria (the orchestrator replays these directly — item 26 STANDARD, no separate
checker round)

1. §5.2a exists, sits between §5.2 and §5.3, and states all four invariants as requirements (not
   narrative), matching the technical content of F1-F4 in `GAM-407-interim-findings.md` — no
   invariant may contradict or soften what was actually measured there.
2. The `supabase/config.toml` transport-evidence paragraph is present and the schemas value quoted
   matches the live file.
3. The "whatever store is chosen" / does-not-pre-empt-GAM-407 sentence is present.
4. §5.1's bullet list gains exactly one forward-reference line; no existing bullet's wording changes.
5. §11.1 decision 1's existing sentence is preserved verbatim with one clause appended — not
   replaced.
6. No other section of the plan document changes. `git diff --stat` shows exactly one file changed.
7. This is a Markdown-only, prose-only change: no code, no test, no build/typecheck/lint impact
   expected, but the orchestrator still runs the repo's standard gates to confirm nothing broke
   (a stray unmatched fence or heading can still break doc tooling if any exists).

## Least confident decisions (item 19d is HEAVY-only, but recorded anyway since this feeds Phase 2)

1. Placement as a new §5.2a rather than folding the invariants into §5.1's existing bullet list.
   Wrong if a future reader expects invariants to live where the spike prerequisites are, not
   after the boundary section that names the capability.
2. Treating this as STANDARD rather than a light-checked HEAVY. Wrong if the owner reads
   "no code" as insufficient justification given the artifact governs Phase 2's design — the
   orchestrator's mitigation is doing the citation verification itself before dispatch (item 19c)
   rather than skipping verification entirely.
