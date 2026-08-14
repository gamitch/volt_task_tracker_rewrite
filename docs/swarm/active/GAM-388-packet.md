# GAM-388 — task packet (STANDARD)

**Issue:** GAM-388 — the `checkin-token` Edge Function was never deployed, so
the kiosk QR and short code silently never appear.
**Tier:** STANDARD (see run log for the item-26 reasoning).
**Scope of THIS packet:** acceptance criterion **4 only** — make a missing
dependency distinguishable from an empty session on the kiosk. Criteria 1–3
require a production deploy this container cannot perform (measured; see run
log § Premise gate ¶2) and are handed to the owner. Criterion 5 is a decision
the orchestrator records, not worker code.

---

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

**The discriminator that works** — verified against both live responses:

| Case | Status | Body | Parses as `{error:{code,message}}`? |
| -- | -- | -- | -- |
| Function not deployed (gateway) | 404 | `{"code":"NOT_FOUND","message":"Requested function was not found"}` | **No** — flat shape |
| Function's own "session not found" | 404 | `{"error":{"code":"SESSION_NOT_FOUND","message":"…"}}` via `errorResponse` (`index.ts:212-213`) | **Yes** |

So the rule is **status 404 AND the body did not parse into the deployed
functions' error shape**. `functions.ts:136-142` already isolates that exact
branch (`parsed === null`), so no new plumbing is needed — only a narrowing.

---

## Allowed Files

- `src/lib/supabase/functions.ts`
- `src/lib/supabase/functions.test.ts`
- `src/pages/meetings/Kiosk.tsx`
- `src/pages/meetings/Kiosk.test.tsx`

**Forbidden:** everything else. In particular do **not** touch
`src/lib/supabase/loaders/kiosk.ts` (it correctly does not catch, so the error
already propagates), `supabase/functions/**`, `.github/workflows/**` (a
dispatched run cannot push those — `AGENTS.md` § "Two walls"), `docs/swarm/**`,
`.claude/**`.

---

## Change 1 — `src/lib/supabase/functions.ts`

Add one exported error code and one narrowing in `toEdgeFunctionError`.

1. Export a new constant beside the existing message constants:

   ```ts
   /** Code rethrown when the Edge Function itself is absent from the project
    * (a deployment fault, permanent) rather than having rejected the call (a
    * normal, transient outcome). Callers that can render a distinct state for
    * "this dependency was never deployed" match on this. */
   export const FUNCTION_NOT_DEPLOYED_CODE = 'FUNCTION_NOT_DEPLOYED';
   ```

2. Add DES-16 copy for it (a caller may fall back to it, so it must not be
   developer jargon):

   ```ts
   const FUNCTION_NOT_DEPLOYED_MESSAGE =
     "This feature isn't available yet. Tell a coach — it needs to be turned on.";
   ```

3. In `toEdgeFunctionError`, inside the existing `raw instanceof
   FunctionsHttpError` block, replace **only** the `parsed === null` fallback
   (currently line 141) with a status-narrowed pair — leave the `if (parsed)`
   branch above it exactly as it is:

   ```ts
   if (raw.context.status === 404) {
     return { code: FUNCTION_NOT_DEPLOYED_CODE, message: FUNCTION_NOT_DEPLOYED_MESSAGE, cause: raw };
   }
   return { code: 'UNKNOWN', message: UNKNOWN_EDGE_FUNCTION_ERROR_MESSAGE, cause: raw };
   ```

   `raw.context` is the raw `Response` — the module already relies on this
   (`tryParseEdgeFunctionErrorBody` reads `httpError.context.json()`), so
   `.status` needs no new type assertion. If `context` can be typed as
   `unknown` in this SDK version, narrow it defensively rather than casting
   blindly; do not introduce `any`.

4. Update the module doc's error-mapping list (lines 32-45) to record the new
   branch **and the reason status alone is insufficient** — cite
   `checkin-token/index.ts:424` explicitly. That sentence is the whole defence
   against someone "simplifying" this back to a status check later.

## Change 2 — `src/pages/meetings/Kiosk.tsx`

1. `usePolling` currently discards the rejection. Change it to also surface the
   error code, keeping the existing behaviour otherwise (still sets `null`, so
   the empty rendering is unchanged):

   ```ts
   function usePolling<T>(…): { value: T | null; errorCode: string | null }
   ```

   In `.then`, set `{ value: result, errorCode: null }`. In `.catch(err)`, set
   `{ value: null, errorCode: <the error's `code` if it is a string, else null> }`.
   Read the code defensively — the rejection is a `SupabaseLoaderError`
   (a plain object, not an `Error` subclass), so use a small type guard, not a
   cast.

2. `useKioskTally` and `useKioskSessionTitle` return `…​.value` so their
   **public signatures are unchanged**. `useKioskDisplayToken` returns the pair
   (verified: no module outside `Kiosk.tsx` imports any of the three, and
   `Kiosk.test.tsx` does not import them either — so this is contained).

3. In `KioskPage`, derive one boolean and render one Banner:

   ```tsx
   const { value: token, errorCode: tokenErrorCode } = useKioskDisplayToken(safeSessionId, loadDisplayToken);
   const isCheckinUnavailable = tokenErrorCode === FUNCTION_NOT_DEPLOYED_CODE;
   ```

   Directly below the `<Heading>` (line 467) and above the `<HStack>`, render
   **only when `isCheckinUnavailable`**:

   ```tsx
   <Banner
     status="warning"
     title="Check-in codes are unavailable"
     description="This kiosk's check-in service isn't set up yet. Ask a coach to check you in."
   />
   ```

   `Banner` with `status` / `title` / `description` is verified in
   `docs/swarm/astryx-api.md:2700-2733` (constitution item 2) and this file
   already uses that exact prop set at lines 450-454. `Banner` is already
   imported.

**Deliberately unchanged:** no retry button, no polling change. `Kiosk.tsx`'s
module doc (lines 195-206) records the passive shop-TV decision, and this
packet does not reverse it — the display stays passive; it just stops claiming
a permanent fault is a temporary emptiness. Add one sentence to that module doc
noting the narrow exception, so the doc and the code do not disagree.

**Copy rules:** sentence case, no jargon, no student PII, no countdown or
urgency framing (item 17). The words above are the prescribed copy — use them
verbatim.

---

## Acceptance criteria (all must be evidenced)

1. **`functions.ts`**: a `FunctionsHttpError` whose `context` is a 404 with the
   flat gateway body `{"code":"NOT_FOUND","message":"Requested function was not
   found"}` rejects with `code: 'FUNCTION_NOT_DEPLOYED'`. New test in
   `functions.test.ts`.
2. **The trap is covered**: a `FunctionsHttpError` whose `context` is a 404
   carrying `{"error":{"code":"SESSION_NOT_FOUND","message":"…"}}` still
   rejects with `code: 'SESSION_NOT_FOUND'` — **not** `FUNCTION_NOT_DEPLOYED`.
   This test is the point of the packet; a change that passes (1) and fails (2)
   is worse than no change.
3. **Non-404 unparsable bodies are untouched**: an unparsable 500 still yields
   `code: 'UNKNOWN'`.
4. **`Kiosk.tsx`**: with a `loadDisplayToken` stub rejecting
   `{ code: 'FUNCTION_NOT_DEPLOYED', message: …, cause: null }`, the kiosk
   renders "Check-in codes are unavailable" **and does not** render only the
   bare "QR not available yet." state as its sole signal.
5. **The empty case is unregressed**: with a stub resolving `null`, the kiosk
   renders "QR not available yet." and `------` and **no** Banner. The existing
   assertions at `Kiosk.test.tsx:179-183` must still pass unmodified.
6. All six gates green (use the `gate-run` skill; do not run tsc/eslint/vitest
   as separate piped calls).

## Named mutation (item 26 — required, and it must be *run*)

Commit the fix first (fast-tier working rule: commit before mutating), then in
**your own git worktree** (item 23 — never the shared tree):

> Revert the `status === 404` narrowing in `toEdgeFunctionError` so the
> fallback returns `code: 'UNKNOWN'` again.

**Expected:** acceptance test (1) and the Kiosk test (4) turn **red**. Capture
the real failure output and the exit code. Restore, re-run green. A test that
stays green under this mutation is not testing the change.

## Least confident decisions

Not required at STANDARD (item 19d binds HEAVY packets), but recorded because
declaring a doubt costs nothing:

1. **Rendering a Banner at all on a passive display.** The `Kiosk.tsx` module
   doc argues against error chrome. Wrong if the owner considers *any* banner
   on a projected wall display unacceptable — in which case the right answer is
   quieter copy in the QR slot, not a Banner. The issue text ("a passive
   display still shouldn't lie") is what tips it.
2. **Changing `usePolling`'s return type** rather than adding a second hook.
   Wrong if something outside `Kiosk.tsx` imports these hooks — grep says
   nothing does, and that grep is the whole basis.
3. **Treating every unparsable 404 as "not deployed."** Wrong if some other
   deployed function can return a 404 with a non-conforming body. Checked:
   all five deployed functions use the shared `errorResponse` shape.
