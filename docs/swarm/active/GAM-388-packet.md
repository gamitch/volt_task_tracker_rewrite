# GAM-388 — task packet (STANDARD) — **revision 2**

**Issue:** GAM-388 — the `checkin-token` Edge Function was never deployed, so
the kiosk QR and short code silently never appear.
**Tier:** STANDARD (item-26 reasoning in the run log).
**Gate history:** round 1 of the item-19 premise gate returned **REVISE**
(2 MAJOR, 6 MINOR, 1 NIT, no BLOCKER). This revision applies all nine findings.
The gate's central conclusion — *"the central discriminator itself is sound and
needs no change; do not re-derive it"* — is carried forward unchanged.

**Scope of THIS packet:** the issue's acceptance criterion **4 only**.

### The issue's criteria, quoted verbatim, and their disposition

> 1. `POST /functions/v1/checkin-token` **returns a non-404 status** against the live project.
> 2. **The kiosk renders a real QR and short code** for a live session, watched in a browser — not asserted from a stub. The `e2e-personas` skill covers this.
> 3. **The code rotates**, and a stale token stops working, which is the entire point of the function.
> 4. **A missing dependency is distinguishable from an empty session** on the kiosk display. *Mutation: point the loader at a function name that does not exist → the kiosk shows the dependency-missing state, not "no session".*
> 5. **Whether Edge Function deployment enters CI is decided and recorded**, either done here or filed.

- **1, 2, 3 — undeliverable in this container, handed to the owner.** Measured
  twice independently (orchestrator and premise gate): no `supabase` CLI, zero
  `SUPABASE*` environment variables, no `functions deploy` anywhere in
  `.github/`. The gate looked for an in-container delivery path and found none
  that does not require `.github/workflows/**` (which a dispatched run cannot
  push, by design) or a withheld credential. 2 and 3 depend on 1.
- **4 — this packet.**
- **5 — an orchestrator decision**, recorded in the run log and the PR body, not
  worker code.

*(Quoted here because GAM-388 is not yet in `docs/swarm/linear-export.{md,json}`,
so the drop would otherwise be unauditable without Linear access — gate MINOR 4.)*

---

## Step zero — `npm ci`

The shared tree has **no `node_modules`**, and the `gate-run` skill hard-refuses
with `UNTRUSTWORTHY: node_modules is missing` before running anything. Run
`npm ci --ignore-scripts` first (~8s, measured by the gate). *(Gate MINOR 5.)*

## The defect, in one paragraph

`invokeEdgeFunction` maps *every* unparsable non-2xx Edge Function response to
`code: 'UNKNOWN'` (`src/lib/supabase/functions.ts:141`). `Kiosk.tsx`'s
`usePolling` then swallows every rejection into `setValue(null)`
(`Kiosk.tsx:363-367`), which renders identically to a genuine empty resolve:
`QR not available yet.` and `------`. So "this function is not deployed"
(permanent, a deployment fault) and "no session right now" (normal) produce the
same pixels, forever, while the loop retries every ~45s.

## The one trap, and why the obvious fix is wrong

**Do not key the discriminator on HTTP status 404 alone.**
`supabase/functions/checkin-token/index.ts:424` returns **404** itself for
`SESSION_NOT_FOUND`. A status-only check would tell a coach opening a kiosk URL
for a deleted session that "this feature was never turned on" — a new lie
replacing the old one.

**The discriminator that works** — status 404 **AND** a body that does not parse
into the deployed functions' `{ error: { code, message } }` shape:

| Case | Status | Body | Parses? |
| -- | -- | -- | -- |
| Function absent (Supabase gateway) | 404 | `{"code":"NOT_FOUND","message":"Requested function was not found"}` | **No** — flat |
| The function's own "session not found" | 404 | `{"error":{"code":"SESSION_NOT_FOUND",…}}` via `errorResponse` (`index.ts:212-213`) | **Yes** |

The premise gate verified this exhaustively: only three 404 emitters exist
across `supabase/functions/**` — `checkin-token:424`, `checkin:169`,
`send-invite:172` — all via `errorResponse`; `ics`, `send-reminders` and
`linear-dispatch` have no 404 path at all; `handleCheckinTokenRequest` has no
top-level `try`, so an unhandled throw is a 500, not a 404; the `OPTIONS`
preflight returns 200 (`:320`) and `invoke` never sends `OPTIONS`. **No deployed
function can emit a 404 that fails `isEdgeFunctionErrorBody`.**
`functions.ts:136-142` already isolates the `parsed === null` branch, so this is
a narrowing of existing code, not new plumbing.

---

## Allowed Files

- `src/lib/supabase/functions.ts`
- `src/lib/supabase/functions.test.ts`
- `src/pages/meetings/Kiosk.tsx`
- `src/pages/meetings/Kiosk.test.tsx`

**Forbidden:** everything else — in particular `src/lib/supabase/loaders/kiosk.ts`
(it correctly does not catch, so the error already propagates unwrapped),
`supabase/functions/**`, `tests/**`, `.github/workflows/**`, `docs/swarm/**`,
`.claude/**`.

---

## Change 1 — `src/lib/supabase/functions.ts`

1. Export the new code beside the existing message constants:

   ```ts
   /** Code rethrown when the Edge Function itself is absent from the project
    * (a deployment fault, permanent) rather than having rejected the call (a
    * normal, transient outcome). Callers that can render a distinct state for
    * "this dependency was never deployed" match on this. */
   export const FUNCTION_NOT_DEPLOYED_CODE = 'FUNCTION_NOT_DEPLOYED';
   ```

2. Add its DES-16 copy. **⚠ This string is the SHARED fallback for every
   `invokeEdgeFunction` caller, not kiosk copy.** `invokeEdgeFunction` is also
   called by `InviteParentDialog.tsx:366`, `StudentsTab.tsx:1235` and
   `loaders/invites.ts:237`, and `InviteParentDialog.tsx:477-483` renders
   `SupabaseLoaderError.message` **verbatim** on a coach/admin-only screen (same
   pattern at `StudentDialog.tsx:474`). So it must read correctly to a coach, an
   admin *and* a student — it may not name any one of them:

   ```ts
   const FUNCTION_NOT_DEPLOYED_MESSAGE =
     "This feature isn't available yet. It needs to be turned on for this site.";
   ```

   *(Gate MAJOR 2: revision 1's string said "Tell a coach", which told a coach
   to tell a coach on the two dialogs above.)*

3. In `toEdgeFunctionError`, inside the existing `raw instanceof
   FunctionsHttpError` block, replace **only** the `parsed === null` fallback
   (line 141). Leave the `if (parsed)` branch above it exactly as it is.

   **⚠ `FunctionsError.context` is declared `any`**, not `Response`
   (`node_modules/@supabase/functions-js/dist/module/types.d.ts`) — it is a
   `Response` at runtime, but `any` means a bare `raw.context.status === 404`
   compiles without ever being checked. Narrow it explicitly rather than relying
   on that; do not write `any` yourself and do not cast blindly:

   ```ts
   const status: unknown = (raw.context as { status?: unknown } | null)?.status;
   if (typeof status === 'number' && status === 404) {
     return { code: FUNCTION_NOT_DEPLOYED_CODE, message: FUNCTION_NOT_DEPLOYED_MESSAGE, cause: raw };
   }
   return { code: 'UNKNOWN', message: UNKNOWN_EDGE_FUNCTION_ERROR_MESSAGE, cause: raw };
   ```

   *(Gate MINOR 1. Adjust the exact expression to whatever typechecks cleanly —
   the requirement is that the `404` comparison is reached only after a real
   runtime check, not that these characters are copied.)*

4. Update the module doc's error-mapping list (lines 32-45) to record the new
   branch **and why status alone is insufficient**, citing
   `checkin-token/index.ts:424`. That sentence is the only thing standing
   between this and someone "simplifying" it back to a status check later.

## Change 2 — `src/pages/meetings/Kiosk.tsx`

1. `usePolling` discards the rejection today. Change it to surface the code
   while keeping every existing behaviour (it still sets `null`, so the empty
   rendering is untouched):

   ```ts
   function usePolling<T>(…): { value: T | null; errorCode: string | null }
   ```

   `.then` → `{ value: result, errorCode: null }`. `.catch(err)` →
   `{ value: null, errorCode: isSupabaseLoaderError(err) ? err.code : null }`.

   **Use the existing `isSupabaseLoaderError`** (`src/lib/supabase/loader.ts:125-133`,
   re-exported from `src/lib/supabase/index.ts`) — do **not** write a new type
   guard. This is the established idiom for exactly this read, already used at
   `InviteParentDialog.tsx:237,477` and `StudentsTab.tsx:435`. The rejection is a
   plain object, not an `Error` subclass, so `err.code` without a guard is wrong.
   *(Gate MINOR 6.)*

2. `useKioskTally` and `useKioskSessionTitle` return `.value`, so their public
   signatures are **unchanged**. `useKioskDisplayToken` returns the pair. The
   gate independently confirmed the blast radius: those three hooks and
   `usePolling` appear only in `Kiosk.tsx` (lines 342, 385, 394, 403, 443-445),
   and `Kiosk.test.tsx:40-49` imports none of them.

3. In `KioskPage`:

   ```tsx
   const { value: token, errorCode: tokenErrorCode } = useKioskDisplayToken(safeSessionId, loadDisplayToken);
   const isCheckinUnavailable = tokenErrorCode === FUNCTION_NOT_DEPLOYED_CODE;
   ```

   Directly below `<Heading>` (line 467) and above `<HStack>` (line 469), render
   **only when `isCheckinUnavailable`**:

   ```tsx
   <Banner
     status="warning"
     title="Check-in codes are unavailable"
     description="This kiosk's check-in service isn't set up yet. Ask a coach to check you in."
   />
   ```

   `Banner`'s `status`/`title`/`description` are verified in
   `docs/swarm/astryx-api.md:2711-2716` (item 2); `Banner` is already imported at
   `Kiosk.tsx:216` and this exact prop set is already used at `:450-454`. This
   copy **is** kiosk-specific and is addressed to a student at the display, so
   "Ask a coach" is correct here — unlike the shared string in Change 1.

**Deliberately unchanged:** no retry control, no polling change.
`Kiosk.tsx:201-209` records the passive shop-TV decision (the Error bullet;
`:195-200` is the Empty bullet). This packet does not reverse it — the display
stays passive, it just stops presenting a permanent fault as a temporary
emptiness. Add one sentence to that module doc noting the narrow exception, so
doc and code do not disagree.

**Copy rules:** sentence case, no student PII (item 6), no urgency, guilt,
countdown or scarcity framing (item 17). Both strings above are prescribed —
use them verbatim.

---

## Acceptance criteria

1. **`functions.ts`** — a `FunctionsHttpError` whose `context` is a 404 with the
   flat gateway body `{"code":"NOT_FOUND","message":"Requested function was not
   found"}` rejects with `code: 'FUNCTION_NOT_DEPLOYED'`.
2. **The trap is covered** — a `FunctionsHttpError` whose `context` is a 404
   carrying `{"error":{"code":"SESSION_NOT_FOUND","message":"…"}}` still rejects
   with `code: 'SESSION_NOT_FOUND'`, **not** `FUNCTION_NOT_DEPLOYED`. *This test
   is the point of the packet: a change that passes (1) and fails (2) is worse
   than no change.*
3. **Non-404s untouched** — an unparsable 500 still yields `code: 'UNKNOWN'`.
4. **`Kiosk.tsx` dependency-missing state** — with a `loadDisplayToken` stub
   rejecting `{ code: FUNCTION_NOT_DEPLOYED_CODE, message: …, cause: null }`,
   `container.textContent` **contains** `Check-in codes are unavailable`.
   The test **imports `FUNCTION_NOT_DEPLOYED_CODE`** from
   `src/lib/supabase/functions.ts` rather than hard-coding the literal, so
   renaming the constant cannot leave both sides silently green.
   *(Gate MINOR 3 + 6: revision 1's "does not render only … as its sole signal"
   was not a falsifiable predicate and has been replaced.)*
5. **The empty case is unregressed** — with a stub resolving `null`,
   `container.textContent` contains `QR not available yet.` and `------`, and
   does **not** contain `Check-in codes are unavailable`. The existing
   assertions at `Kiosk.test.tsx:179-183` must still pass **unmodified**.
6. **All six gates green** — use the `gate-run` skill (after step zero). Do not
   run tsc/eslint/vitest as separate piped calls.

## Named mutations — TWO, and both must be *run* (item 26)

Revision 1 specified one mutation and **stated its outcome wrongly**; the gate
measured it and got `1 failed | 30 passed`, with criterion 4 **staying green**
because criterion 4 stubs the loader seam and never traverses
`toEdgeFunctionError`. Corrected (gate MAJOR 1). Commit the fix first — the
fast-tier working rule, "commit before mutating" — and run both in **your own
git worktree** (item 23), never the shared tree.

- **Mutation A — `functions.ts`:** delete the `status === 404` narrowing so the
  fallback returns `'UNKNOWN'` again.
  **Expected red: acceptance criterion 1 only.** Criteria 2, 3, 4 and 5 stay
  green *by design* — 2 and 3 exercise other branches, and 4/5 stub above this
  layer. Do not treat their staying green as a failure.
- **Mutation B — `Kiosk.tsx`:** hardcode `errorCode: null` in `usePolling`'s
  `.catch`, so the code never reaches the component.
  **Expected red: acceptance criterion 4.** Criterion 5 stays green (it asserts
  the Banner's *absence*, which this mutation preserves).

Capture the real failure output and exit code for each, restore, and re-verify
green. Report both.

## Least confident decisions

1. **Rendering a Banner at all on a passive display.** The gate could not settle
   this (owner preference, not fact) but added weight the packet had missed:
   item 12 requires all four DES-12 states and `Kiosk.tsx:201-209` folds Error
   into Empty, so today's code is arguably already an item-12 gap that this
   narrows. Wrong if the owner rejects *any* banner on a projected wall display
   — in which case the answer is quieter copy in the QR slot, not a Banner.
2. **Changing `usePolling`'s return type** rather than adding a second hook.
   Independently verified sound by the gate, which implemented it and ran the
   full 2463-test suite green.
3. **Treating every unparsable 404 as "not deployed."** The in-function half is
   exhaustively confirmed, but **the rule fires on any 404 anywhere in the
   request path**, not only on the six functions — a proxy, a misconfigured
   `VITE_SUPABASE_URL`, or the persona harness. That is arguably correct
   behaviour (all of those genuinely mean "the dependency is not reachable as
   deployed"), but it is broader than "the function was never deployed" and is
   worth knowing. *(Gate MINOR 2, widened from revision 1.)*

## Known and accepted consequence (not a defect)

`tests/e2e-harness/server.mjs:503` already returns a **flat-bodied 404**
(`{"message":"harness: no stand-in for Edge Function \"checkin-token\""}`) for
`checkin-token`, so `tests/e2e-personas/student-checkin.spec.ts:287-329` will now
render the new Banner too. **No assertion breaks** — they are all `toBeVisible`,
`personaHarness.ts:167`'s `capture` is a plain screenshot rather than
`toHaveScreenshot`, and Playwright is not one of the six gates. `tests/**` is
Forbidden in this packet, so that spec's describe name and `server.mjs:474-500`'s
comment go stale and are left so deliberately; the underlying gap is already
filed as `e2e-personas/harness-missing-checkin-token-stand-in`
(`docs/swarm/inbox/claude-gam-342-e2e-w1-checkin-findings.json:44-56`) and is
GAM-354's subject. Do not "fix" it here.
