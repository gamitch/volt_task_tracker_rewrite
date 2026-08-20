Closes GAM-388 — but see **Scope** below: this ships **Partial**, not Passed, and the deployment half is filed separately.

## What changed

The kiosk can now tell "the `checkin-token` Edge Function was never deployed" (a permanent deployment fault) apart from "no session right now" (normal). `invokeEdgeFunction` rethrows a new `FUNCTION_NOT_DEPLOYED` code, and `Kiosk.tsx` renders one honest Banner for it instead of folding it into the same silent "QR not available yet." empty state it has shown, and retried every ~45s, forever.

Two files plus their tests. No schema, no migration, no write path, no RLS.

## What the issue got wrong

**The issue's own prescription would have introduced a second, worse lie**, and the premise gate caught it before a worker saw the packet.

The issue proposes distinguishing a missing dependency by its 404. But `supabase/functions/checkin-token/index.ts:424` returns **404 itself** for `SESSION_NOT_FOUND`. A discriminator keyed on status alone would have told a coach opening a kiosk URL for a deleted session that "this feature was never turned on."

The discriminator that ships is **status 404 *and* a body that does not parse into the deployed functions' `{ error: { code, message } }` shape**. Every in-function 404 goes through `errorResponse` (`checkin-token/index.ts:213-215`) and parses; the Supabase gateway's flat `{"code":"NOT_FOUND",...}` does not. The gate confirmed this exhaustively: only three 404 emitters exist across `supabase/functions/**` (`checkin-token:424`, `checkin:169`, `send-invite:172`), all via `errorResponse`; `ics`, `send-reminders` and `linear-dispatch` have no 404 path at all.

Everything else in the issue held. Its 404 claim, its `kiosk.ts:369` call site, and its reading of `Kiosk.tsx`'s deliberate silent-failure decision were all re-measured and correct.

## Tier: STANDARD, and the deploy half is not a tier question at all

**Trigger:** item 26 asks whether a mistake here can corrupt data or lie to a user about their own data. The code half is a **read path** — no write path, no destructive operation, no schema/RLS/`security definer`/metric-view SQL, no auth/session/role logic, no export another session builds against. None of HEAVY's triggers fire.

**The losing argument was FAST.** It loses because FAST forbids changing a signature another module imports, and `usePolling`'s return type changes so the component can tell the two states apart. Item 26: when two tiers are arguable, take the heavier one.

**Worker model: the pinned default (sonnet), not opus.** Item 18's four override triggers were checked and none fires. Item 25's second obligation is the live one here — this was not bumped because "check-in" sounds sensitive.

**Declared process deviation:** STANDARD does not require a separate checker round, and none was run. Item 19's premise gate *is* mandatory for anything reaching a worker and was run in full — two rounds, REVISE then DISPATCH.

## Verification

```
GATE RUN — aca7d55 on claude/gam-388-checkin-token-deploy — tree clean

  1 tsc                       exit 0  PASS
  2 vite build                exit 0  PASS
  3 format:check              exit 0  PASS
  4 eslint                    exit 0  PASS       0 errors, 379 warnings
  5 vitest (full)             exit 0  PASS       95 files / 2463 tests  baseline 2458 (+5)
  6 vitest src/lib/supabase/  exit 0  PASS       18 files / 293 tests  baseline 290 (+3)

VERDICT: PASS — all six gates exit 0
```

Gate 6's scope was chosen (`src/lib/supabase/`) rather than derived: the change spans two unrelated trees, so the derived scope would be `src/` — gate 5 again — and the script would honestly report SKIPPED and "5 of 6". **Three agents ran these gates independently — premise gate round 2, the worker, and the orchestrator — and all three report these same figures.**

### Mutations

| Mutation | Expected red | Observed | Exit |
| -- | -- | -- | -- |
| **A** — delete the `status === 404` narrowing in `functions.ts` | criterion 1 only | `1 failed \| 30 passed`, red on criterion 1; 2/3/4/5 green as designed | 1 |
| **B** — hardcode `errorCode: null` in `usePolling`'s catch | criterion 4 only | `1 failed \| 30 passed`, red on criterion 4; criterion 5 green | 1 |
| **C** — *orchestrator's own, named by no packet:* implement the naive discriminator (check 404 **before** parsing the body) | criterion 2 | `1 failed \| 10 passed`, red on criterion 2 | 1 |

Mutation C is the one that matters. The entire change exists to prevent one specific wrong implementation, so that wrong implementation was written and run:

```
× still rejects with code SESSION_NOT_FOUND (not FUNCTION_NOT_DEPLOYED) for a 404
  whose body IS the deployed function's own parseable error shape
  → expected { code: 'FUNCTION_NOT_DEPLOYED', …} to match object { code: 'SESSION_NOT_FOUND', …}
```

The trap test is not decorative — it actively guards the mistake.

Revision 1 of the packet specified **one** mutation and stated its outcome wrongly; the premise gate measured it, found criterion 4 stayed green, and made me split it into A and B. Replaying that unrevised mutation would have shown a green test the packet itself condemned and sent correct work into rework.

## Scope — this closes **Partial**, not Passed (item 27)

The issue has five acceptance criteria. **Two are delivered here; three are not, and they are the ones that make the kiosk actually work.**

| Criterion | Status |
| -- | -- |
| 1. `checkin-token` returns non-404 against the live project | **not done → GAM-395** |
| 2. Kiosk renders a real QR and short code, watched in a browser | **not done → GAM-395** (depends on 1) |
| 3. The code rotates; a stale token stops working | **not done → GAM-395** (depends on 1) |
| 4. A missing dependency is distinguishable from an empty session | **done here** |
| 5. Whether Edge Function deployment enters CI is decided and recorded | **decided → GAM-396** |

**Criteria 1-3 are undeliverable by any dispatched run, and this was measured rather than assumed:** no `supabase` CLI, and `SUPABASE_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID`/`_REF` all unset. The premise gate independently searched for an in-container delivery path and found none that does not require `.github/workflows/**` or a withheld credential. The issue itself flagged the authorization question and declined to settle it: item 16 reserves migration cutover, production email and domain go-live to the owner, and whether an Edge Function deploy joins that list is not settled anywhere. **That call is the owner's, not mine.**

⚠ **Reviewer, please read this before merging.** Line 1 says `Closes GAM-388` because the `Linear declaration` gate requires that exact anchor at position 0 and is wired into branch protection — a contributing word like `Part of` fails the gate and blocks the merge. So merging **will close GAM-388 while `checkin-token` is still not deployed.** GAM-395 carries the remainder, is linked from GAM-388, and is priority Urgent. If you would rather GAM-388 stay open until the deploy lands, reopen it after merge — the machinery here cannot express "link but do not close" and satisfy the gate at the same time. Flagging it rather than quietly letting a closed row imply working kiosk check-in.

## Follow-ups filed

Both filed **before** this PR opened, both to `Backlog` carrying `unreviewed`, both written through the `linear-task-writing` skill (item 30) and re-verified against current `main`.

- **GAM-395** *(Urgent)* — deploy `checkin-token`, then verify in a browser and confirm rotation. Carries the constraint that would otherwise bite: **do not add a `[functions.checkin-token]` block with `verify_jwt = false`.** `config.toml:261` sets that for `linear-dispatch` alone, because it is webhook-called with no session; `checkin-token` reads the caller's JWT to require coach/admin (`index.ts:348`, `:395`). Copying that block would publish live check-in codes to anyone who can reach the URL.
- **GAM-396** *(Medium)* — the CI gap. Criterion 5 asked for a decision, so one was made rather than deferred: **a drift detector, not an auto-deployer.** Auto-deploying on merge hands CI standing production deploy rights and makes every merge a deploy — disproportionate for one small volunteer team (item 25). A detector comparing `supabase/functions/` against the project's deployed set catches exactly what went unnoticed here and needs only a read-scoped credential.

I deliberately did **not** write that workflow file, even as a preserved patch. `.github/workflows/**` is unpushable by a dispatched run by design, I hold no credential to execute it against, and its central question — grant CI a Supabase credential at all, and at what scope — is the owner's under item 16 and changes the file's content.

## Known gaps, disclosed

- **The new Banner is not verified in a real browser.** It cannot be until GAM-395 lands: reaching it requires the live 404, and the persona harness has no `checkin-token` stand-in (GAM-354). It is verified by unit test and by mutation B.
- **The persona harness will now render this Banner too.** `tests/e2e-harness/server.mjs:503` already returns a flat-bodied 404 for `checkin-token`, which is exactly the new condition. No assertion breaks — they are all `toBeVisible`, the `capture` helper is a plain screenshot rather than `toHaveScreenshot`, and Playwright is not one of the six gates. `tests/**` was Forbidden for this packet, so that spec's describe name and `server.mjs`'s comment go stale deliberately; GAM-354 owns the underlying gap.
- **The rule fires on any unparsable 404 in the request path**, not only on a genuinely undeployed function — a proxy or a misconfigured `VITE_SUPABASE_URL` would also reach it. Arguably correct (all of those mean "not reachable as deployed"), but broader than the name suggests. A true Supabase *relay* 404 does **not** reach it: it carries `x-relay-error` and becomes `FunctionsRelayError` → `NETWORK` first.
- **`FUNCTION_NOT_DEPLOYED_MESSAGE` is a shared fallback**, not kiosk copy — `InviteParentDialog.tsx:477-483` and `StudentDialog.tsx:474` render it verbatim on coach/admin screens. Revision 1 of the packet had it say "Tell a coach", which told a coach to tell a coach; the gate caught it.

Full run log, including both premise-gate verdicts and every measurement: `docs/swarm/active/GAM-388-run-log.md`.

Linear-Issue: GAM-388
