# GAM-388 — run log

**Issue:** [GAM-388](https://linear.app/gamitch/issue/GAM-388/the-checkin-token-edge-function-was-never-deployed-so-the-kiosk-qr-and)
— The `checkin-token` Edge Function was never deployed, so the kiosk QR and
short code silently never appear.
**Branch:** `claude/gam-388-checkin-token-deploy`
**Started:** 2026-08-14

This log is append-only and is pushed after every milestone. If it ends
mid-sentence or ends on a dispatch line with no matching verdict, the run was
killed at that point — read the last line as the cause of death, not as a
summary.

---

## Milestones

- **claimed** — 2026-08-14. Read `AGENTS.md` § "Where work comes from" and
  `docs/swarm/constitution.md` (items 16, 18, 19, 20, 22, 26, 27, 28) before
  opening any repository file. Fetched GAM-388 live from Linear (not from
  `linear-export.md`). Tier judged **STANDARD** *before* the state move, per
  item 28d; applied `tier/standard`, removed `tier/unreviewed`; moved
  `Todo → In Progress`; **re-read and confirmed** the row is held
  (`state: In Progress`, labels `other, w1, Bug, standard`,
  `updatedAt 2026-08-14T22:35:38.538Z`).

### Tier reasoning (item 26 — stated and defended, as item 26 requires)

Item 26's single question is *"can a mistake here corrupt data, or lie to a user
about their own data?"* The issue contains two halves and they answer it
differently, so they are tiered separately:

- **The code half** (acceptance criterion 4 — the kiosk must distinguish "the
  dependency is missing" from "no session right now") is a **read path**:
  `src/lib/supabase/loaders/kiosk.ts` and `src/pages/meetings/Kiosk.tsx`. No
  write path, no destructive operation, no schema/RLS/migration/`security
  definer`/metric-view SQL, no auth/session/role-resolution logic, and no export
  another session builds against. None of HEAVY's triggers fire.
- It is **not FAST**, because FAST forbids "a change to a signature another
  module imports" and this change alters the value the loader hands
  `Kiosk.tsx` so the component can tell the two states apart. Item 26: when two
  tiers are arguable, take the heavier one. → **STANDARD**: worker implements,
  orchestrator replays the named mutation, no separate checker round.
- **The deploy half** (criteria 1–3) is **not a tier question at all** — it is an
  authorization question, and it is escalated rather than tiered. See below.

### Deploy half — the authorization question, raised before any work

The issue itself flags this and declines to settle it: *"item 16 reserves
migrations to the owner; whether that extends to Edge Function deploys is not
settled anywhere and should be confirmed before an agent runs a deploy."*
Constitution item 16 names migration cutover, production email enablement and
Vercel domain go-live as human gates; an Edge Function deploy to the live
project is not in that list and is not excluded from it either. Resolving that
is the owner's call, not mine, and `AGENTS.md` § "Ownership and protected files"
independently forbids an unauthorized deploy. Measurement of what this container
can actually do follows in the premise gate below.

---

## Premise gate

- **premise measured (orchestrator, run not read)** — 2026-08-14. Every claim
  below was executed, not taken from the issue text.

**1. The 404 is real, and it is a deployment fault — measured with two
controls, so the result is informative rather than merely consistent.**

| Probe (`POST …/functions/v1/<fn>`, no auth header) | Status |
| -- | -- |
| `checkin-token` | **404** |
| `checkin` (positive control — deployed) | 401 |
| `ics`, `send-invite`, `send-reminders`, `linear-dispatch` | 401 |
| `nope-does-not-exist` (negative control — never existed) | **404** |

The negative control is what makes this a measurement: an absent function and
`checkin-token` are indistinguishable from outside, and every deployed function
answers 401. Response bodies confirm the two channels are different systems:

- gateway 404 → `{"code":"NOT_FOUND","message":"Requested function was not found"}`,
  header `sb-error-code: NOT_FOUND`, `x-served-by: supabase-edge-runtime`
- deployed 401 → `{"code":"UNAUTHORIZED_NO_AUTH_HEADER","message":"Missing authorization header"}`

**2. The deploy half cannot be executed from this container, and that is a
boundary, not an obstacle to route around.** Measured: `supabase` CLI **absent**;
`SUPABASE_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_PASSWORD`,
`SUPABASE_PROJECT_ID`/`_REF`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` all
**absent**. `grep -rl "functions deploy" .github/` → **no match**, confirming the
issue's root cause: nothing in CI deploys Edge Functions. This is the same shape
as `AGENTS.md`'s § "Two walls a dispatched run hits" — the credential is withheld
deliberately, so acceptance criteria **1, 2 and 3 are undeliverable here** and are
handed over rather than faked.

**3. A trap in the prescription, found before the packet was written.** The
issue's criterion 4 proposes distinguishing a 404 from an empty session. **HTTP
status alone cannot do it:** `supabase/functions/checkin-token/index.ts:424`
makes the function return **404** itself for `SESSION_NOT_FOUND`. A discriminator
keyed on `status === 404` would report "this feature was never turned on" every
time a coach opened a kiosk URL for a deleted session — replacing one lie with a
worse one. The sound discriminator is **status 404 *and* a body that is not in
the deployed functions' `{ error: { code, message } }` shape**: every in-function
404 goes through `errorResponse` (`index.ts:212-213`) and parses; the gateway's
flat `{code,message}` does not. `functions.ts:136-142` already isolates exactly
that "unparsable body" branch, so the seam exists and needs no new plumbing.

**4. Call sites verified against current `main`** (item 19c — citations checked,
not copied): `src/lib/supabase/loaders/kiosk.ts:368-372` invokes
`'checkin-token'` and does **not** catch, so an error propagates;
`src/pages/meetings/Kiosk.tsx:363-367` (`usePolling`) swallows every rejection
into `setValue(null)`; `Kiosk.tsx:471-472,485` render `QR not available yet.` and
`------` for both the empty and error cases. The issue cited `kiosk.ts:369` and
`Kiosk.tsx ~202` — both correct (`Kiosk.tsx:201-206` is the module doc recording
the deliberate decision; the code implementing it is at 363-367).

**Verdict: premise HOLDS.** The bug is real and still present. Proceeding on the
code half only; deploy half escalated to the owner.

---

## Packet

- **packet written** — 2026-08-14, `docs/swarm/active/GAM-388-packet.md`.
  Scope: acceptance criterion 4 only (criteria 1-3 blocked on a deploy this
  container cannot perform; criterion 5 is an orchestrator decision). Allowed
  Files: `src/lib/supabase/functions.ts` + its test,
  `src/pages/meetings/Kiosk.tsx` + its test. Checked at packet time, per
  `AGENTS.md`: **no `.github/workflows/**` in Allowed Files**, so the packet
  does not walk the run into the push wall at its integration boundary.

- **checker-premise DISPATCHED** — 2026-08-14, item 19 gate, round 1 of a
  maximum 2 (item 19a). Dispatched with `run_in_background: false` and the
  orchestrator is blocking on it now.
  **If this line is the last one in this file, the run died holding this
  subagent** — the packet was written, no worker was ever dispatched, and no
  source file was modified. Resume by re-reading the packet and re-running the
  gate; nothing is half-applied.

- **checker-premise VERDICT: REVISE** — 2026-08-14, round 1. Subagent returned;
  the run did not die holding it. 2 MAJOR, 6 MINOR, 1 NIT, **no BLOCKER**. The
  gate ran rather than read: it created its own worktree (`/tmp/pcheck-388`,
  item 23), `npm ci`'d, **implemented the whole prescription**, ran
  `tsc --noEmit` (0), `eslint` (0) and the **full suite (95 files / 2463 tests,
  all green)**, wrote a probe test per acceptance criterion, and **executed the
  packet's named mutation**. It removed its worktree and left the shared tree
  clean.

  **The central discriminator survived** — explicitly "sound and needs no
  change; do not re-derive it". Exhaustively confirmed: only three 404 emitters
  exist in `supabase/functions/**` (`checkin-token:424`, `checkin:169`,
  `send-invite:172`), all via `errorResponse`; `ics`, `send-reminders` and
  `linear-dispatch` have no 404 path; `handleCheckinTokenRequest` has no
  top-level `try` so an unhandled throw is a 500, not a 404; `OPTIONS` returns
  200 and `invoke` never sends it. So no *deployed* function can emit a 404 that
  fails `isEdgeFunctionErrorBody`.

  **MAJOR 1 — my named mutation's stated outcome was false, and it was measured
  false.** Deleting the `status === 404` narrowing turns criterion 1 red but
  leaves criterion 4 **green** (`1 failed | 30 passed`), because criterion 4
  stubs the loader seam and never traverses `toEdgeFunctionError`. Replaying it
  faithfully, I would have seen a green test my own packet condemns and sent a
  correct implementation into rework. This is exactly the failure item 26's
  "a gate that runs is worth much more than one that reads" predicts.

  **MAJOR 2 — the shared error copy was written for the wrong audience.**
  `invokeEdgeFunction` is not kiosk-only: `InviteParentDialog.tsx:366`,
  `StudentsTab.tsx:1235` and `loaders/invites.ts:237` also call it, and
  `InviteParentDialog.tsx:477-483` renders `SupabaseLoaderError.message`
  verbatim on a **coach/admin-only** screen. My prescribed string told a coach
  to "Tell a coach", and the packet mandated it verbatim so the worker could not
  have fixed it.

  Also corrected: `FunctionsError.context` is declared **`any`**, not
  `Response` — my prescription compiles for the wrong reason and my hedge could
  never fire (MINOR 1); the repo already has `isSupabaseLoaderError`
  (`loader.ts:125-133`) so "a small type guard" invited a duplicate (MINOR 6);
  criterion 4's "sole signal" was not a falsifiable predicate (MINOR 3); the
  shared tree has **no `node_modules`**, so `gates.py` refuses with
  `UNTRUSTWORTHY` until `npm ci` runs (MINOR 5); and the persona harness
  (`tests/e2e-harness/server.mjs:503`) already returns a flat-bodied 404 for
  `checkin-token`, so the new Banner will render there too (MINOR 2 — no
  assertion breaks; Playwright is not one of the six gates).

- **packet revised to r2** — 2026-08-14. All nine gate findings applied: shared
  error copy re-authored for an unknown audience (MAJOR 2); the single wrong
  mutation replaced by **two** mutations with individually correct expected-red
  sets (MAJOR 1); `context` narrowed through a real runtime check because it is
  declared `any` (MINOR 1); persona-harness consequence recorded as known and
  accepted (MINOR 2); criterion 4 made falsifiable (MINOR 3); the dropped
  criteria 1-3/5 quoted verbatim since GAM-388 is not yet in the export
  (MINOR 4); `npm ci` added as step zero (MINOR 5); `isSupabaseLoaderError`
  named and the test made to import `FUNCTION_NOT_DEPLOYED_CODE` (MINOR 6);
  module-doc citation corrected to `:201-209` (NIT).

- **checker-premise DISPATCHED (round 2 of 2)** — 2026-08-14, item 19a cap.
  Dispatched with `run_in_background: false`; the orchestrator is blocking now.
  **If this line is the last one in this file, the run died holding this
  subagent** — packet r2 exists, no worker was dispatched, and no source file
  has been modified. A third REVISE escalates to the human owner (item 19a); it
  does not loop.
