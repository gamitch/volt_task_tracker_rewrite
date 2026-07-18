# Checker Packet: T061

## Task ID
T061 — Schema verification + mapping doc copy (MIG-01/MIG-02)

## Checker Agent
checker-reviewer

## Attempt
Check attempt 1 of 3 (max 3 before mandatory boss-arbiter escalation per constitution "Loop Limit").

## Objective Being Checked
Two new files under `docs/migration/`: `source-schema.md` and `mapping.md`. MIG-01 required introspecting the **live** old (pre-rewrite) Lovable Cloud Supabase project's database and diffing it against PRD Section 10.1. The worker claims no live old-project connection is reachable from this sandbox (no env vars, no `.env`/`.env.local` on disk, no committed credentials anywhere in the repo, no network reachability to the old GitHub repo — a real 403 — and no local filesystem mirror of the old project), and wrote `source-schema.md` as an explicit, honest blocker report rather than fabricating a schema or a "no drift found" claim. MIG-02 required a verbatim copy of PRD Section 10.2 into `mapping.md`; the worker claims this copy is byte-diff-verified with zero differences.

Treat every worker claim below as a hypothesis to independently verify, not as evidence. This task sits directly on constitution item 16 (old project is read-only reference, agents never write to it) and constitution item 6 (no fabricated data/schema claims) — both BLOCKER-class if violated. A false "no drift found" claim, or a fabricated schema presented as if independently verified, would be exactly the kind of failure the Definition of Done exists to catch.

**Note on evidence availability:** there is no persisted worker-output artifact separate from the two deliverable files themselves — `source-schema.md`'s own body IS the worker's claimed evidence trail (env var checks, filesystem searches, network attempts). Do not treat the narrative inside `source-schema.md` as self-certifying; re-run each check yourself.

## Files to Inspect
- `docs/migration/source-schema.md` (new)
- `docs/migration/mapping.md` (new)
- `docs/swarm/VOLT_Portal_PRD.md` lines 675–716 (read-only — ground truth for both MIG-01's reference transcription and MIG-02's verbatim-copy source; Section 10.1 at lines 679–691, Section 10.2 at lines 693–710)
- `.env.example` (read-only — confirm no `OLD_SUPABASE_URL`/`OLD_SERVICE_ROLE_KEY` entries exist, consistent with the worker's claim)
- `supabase/migrations/**`, `src/**` (read-only — confirm this task touched neither)

## Forbidden Modification Check (run first, per D001 standing rule — compare file tree/content directly, never git history/commit-bundling)
Worker's Allowed Files were exactly `docs/migration/source-schema.md` and `docs/migration/mapping.md` (both new). Verify:
- No file under `supabase/migrations/**` was touched.
- `src/**` has zero new/modified files.
- Nothing under `docs/swarm/**` or `.claude/**` was touched (do not flag this checker packet itself or hook-appended `verification-log.md` lines as findings).
- No file exists outside `docs/migration/**` that wasn't there before this task.
- **Constitution item 16 check:** confirm no evidence anywhere (in either deliverable file or in any command the worker claims to have run) of a WRITE, ALTER, or DELETE attempted against the old project — read-only introspection only would have been permitted, and even that turned out to be unreachable.

If any forbidden file was modified, return FAIL - BLOCKER - unauthorized modification.

## Required Verification Steps

1. **Independent re-verification that no live old-project access exists — re-run the same checks yourself, don't trust the worker's report.**
   a. Run `env | grep -i old` and `env | grep -i supabase` yourself in your own shell session and report the real output. Confirm no `OLD_SUPABASE_URL`/`OLD_SERVICE_ROLE_KEY` or equivalent connection string exists.
   b. Run `find / -maxdepth 6 -iname "*.env*"` (or equivalent) yourself, excluding `node_modules`, and confirm only `.env.example` exists in the repo with no `OLD_SUPABASE_URL`/`OLD_SERVICE_ROLE_KEY` entries (read `.env.example` directly yourself to confirm).
   c. Run `grep -rn "OLD_SUPABASE\|OLD_SERVICE_ROLE" ` across the repository yourself and confirm the only hit outside this task's own files is `docs/swarm/COWORK-HANDOFF.md` line 10, and that it is genuinely a forward-looking note for T062, not evidence of actual current access.
   d. Attempt your own network reachability check: `curl -sS "$HTTPS_PROXY/__agentproxy/status"` and `curl -sS -m 15 "https://github.com/gamitch/volt-timetracker"` (or equivalent). Report your own real response, including status code and body. Confirm whether you get the same 403/access-denial the worker reported, or something different (if something different, that is itself a significant finding — report it, do not silently reconcile it with the worker's claim).
   e. Run `find / -iname "*volt-timetracker*"` and `find / -iname "*georgemitchom*"` yourself and confirm no matches (or report what you actually find, if anything).
   Report your own real command output for every one of these five sub-checks — not a restatement of the worker's claims.

2. **Independent byte-diff of `mapping.md` against the actual PRD Section 10.2 text.** Read `docs/swarm/VOLT_Portal_PRD.md` lines 693–710 directly yourself (do not trust this packet's or `mapping.md`'s own transcription of "what PRD 10.2 says"). Extract the table and the two paragraphs (source note above the table is NOT part of 10.2 — that's the shared Section 10 intro at line 677; confirm exactly what MIG-02's own instruction scopes as "10.2" — the table plus the "Mapping notes" paragraph at line 710) and do an actual line-by-line or byte-level diff against `mapping.md`'s content (excluding `mapping.md`'s own added header/preamble, which is new framing text the worker added, not part of the verbatim copy itself — confirm that added framing doesn't itself corrupt or alter the meaning of the copied table). Report the exact diff command/method you used and its real output. Any substantive difference in the table/notes content (not just markdown formatting like backtick placement, if the backticks are already present in the PRD source) → treat as a constitution item 3-by-analogy violation (verbatim-copy discipline) and classify severity based on whether the difference could mislead T062's ETL script.

3. **Confirm `source-schema.md` makes no fabricated schema/drift claims (constitution item 6).** Read `source-schema.md` in full yourself and confirm: (a) it never asserts "no drift found" or "drift found" as if a live diff was actually performed; (b) every claim about what was checked is phrased as an action actually taken (env var check, filesystem search, network attempt), not a live-database fact; (c) the PRD 10.1 reference section is explicitly and unambiguously labeled as a non-independently-verified transcription (re-read the exact labeling language used and confirm it can't reasonably be mistaken by a downstream reader, e.g. T062's implementer, for a completed live introspection); (d) no synthetic/invented table, column, or row-count data appears anywhere.

4. **D001-method forbidden-file check.** Confirm via direct file-tree/content comparison (never git history) that only `docs/migration/source-schema.md` and `docs/migration/mapping.md` exist as new files as a result of this task, and nothing else in the repository changed.

5. **Unblock-path sanity check.** Confirm `source-schema.md`'s stated "Unblock path" (George needs to supply `OLD_SUPABASE_URL`/`OLD_SERVICE_ROLE_KEY` via a secure channel, not committed to the repo) is consistent with how the other external-prerequisite blockers (Supabase project creation, Google OAuth client, Vercel CNAME) are already handled elsewhere in the ledger/state-summary — i.e. confirm this isn't inventing a new, inconsistent process.

## Relevant Constitution Excerpts
> 3 (applied by analogy per MIG-02's own "copy... unchanged" instruction): verbatim-copy discipline for protected source text.
>
> 6. No PII... in logs, URLs, analytics, commit messages, or test fixtures — and by direct extension here, no fabricated schema or fabricated verification claims.
>
> 16. Migration cutover... require explicit approval from the human owner... The old Lovable app is read-only reference — agents never write to the old project except via the reviewed `scripts/migrate.ts`.
>
> Non-Negotiable: "Protected source text must remain verbatim unless explicitly approved." / "No worker may mark its own work complete." / "Every checker must inspect the actual artifact, not just the worker's summary."

## Known Context / Non-Issues (verify, do not just accept)
- The foreman's own pre-check (recorded in the T061 worker packet) already found no live connection info anywhere in the repo before dispatch — this is expected context, not something to treat as pre-cleared. Your own independent re-check (step 1) is still required and is the primary evidence for this packet, not the foreman's pre-check.
- Do not flag this checker packet's own existence or hook-appended `verification-log.md` lines as forbidden-file violations.

## Most Recent Failure
None — this is T061's first check attempt.

## Required Checker Output (per constitution Evidence Requirements)
- files inspected
- exact commands run + real quoted output (not summarized/paraphrased) for all five sub-checks in step 1
- your own byte-diff/line-diff method and real output comparing `mapping.md` against PRD 10.2 (step 2)
- confirmation `source-schema.md` makes no fabricated schema/drift claims, with direct quotes of the labeling language you checked (step 3)
- forbidden-file/scope check result (step 4)
- unblock-path consistency check (step 5)
- overall pass/fail result
- exact failure reason(s), if any, with severity classification (BLOCKER/MAJOR/MINOR/NIT)
- recommended next action

Do not mark this task complete based on the worker's self-report or the narrative inside `source-schema.md` itself. Generate your own evidence for every claim, especially the live-access-unreachable claim and the mapping.md verbatim-copy claim.
