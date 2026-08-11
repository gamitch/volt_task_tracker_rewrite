// supabase/functions/linear-dispatch/index.ts
//
// Linear -> Claude dispatch. One HTTP hop:
//
//   owner drags GAM-nnn from `Backlog` to `Todo`
//     -> Linear fires an Issue `update` webhook at this function
//     -> verify `Linear-Signature` over the RAW body (signature.ts)
//     -> verify `webhookTimestamp` freshness (signature.ts)
//     -> decide whether this delivery is dispatchable (filter.ts)
//     -> POST `repository_dispatch` to GitHub (dispatch.ts)
//     -> .github/workflows/claude-linear-dispatch.yml runs claude-code-action
//
// -----------------------------------------------------------------------
// THIS FUNCTION IS PUBLIC BY DESIGN, AND THAT IS THE INTERESTING PART
// -----------------------------------------------------------------------
// Supabase Edge Functions reject requests without a valid Supabase JWT by
// default (`verify_jwt` defaults to `true`). Linear does not send one and
// cannot be made to, so `supabase/config.toml` carries:
//
//     [functions.linear-dispatch]
//     verify_jwt = false
//
// "Public" is emphatically NOT "unauthenticated". Turning off the platform's
// check moves the entire burden of authenticating the caller into this
// handler, where it is discharged by the HMAC signature check below. The
// order is load-bearing and non-negotiable:
//
//   1. `await req.text()` --- read the raw body ONCE.
//   2. Verify the signature over that exact string.
//   3. Only then `JSON.parse`.
//
// Parsing first and verifying a re-serialised object would be a signature
// check that cannot fail for the right reasons: `JSON.stringify(JSON.parse(x))`
// is not byte-identical to `x`, so it would either always fail (and get
// "fixed" by weakening it) or be quietly comparing the wrong bytes.
//
// -----------------------------------------------------------------------
// STATUS CODES ARE A CONTRACT WITH LINEAR'S RETRY LOGIC
// -----------------------------------------------------------------------
// Linear retries non-2xx deliveries. So the codes here encode "is retrying
// this ever going to help?":
//
//   200 + {dispatched:false, reason} --- a correct, final decision not to
//        dispatch (wrong event, no `tier/*` label, state did not move).
//        Retrying would produce the identical decision, so this is a 2xx.
//        The body still names the reason, so a skip is never silent.
//   200 + {dispatched:true}          --- fired.
//   401                              --- bad or missing signature, or a
//        stale/absent `webhookTimestamp`. Not retryable in a useful sense,
//        but it must not be a 2xx: a 2xx would tell an attacker probing the
//        endpoint that their unsigned request was accepted.
//   400                              --- body was not JSON.
//   500                              --- this function is misconfigured
//        (a missing secret). Loud, because the alternative is a queue that
//        silently stops moving.
//   502                              --- GitHub rejected the dispatch.
//        Retryable, and Linear should retry it.
//
// -----------------------------------------------------------------------
// SECRETS
// -----------------------------------------------------------------------
// All read only via `Deno.env.get`, never hardcoded, never logged, never put
// in a response body:
//   LINEAR_WEBHOOK_SECRET     --- Linear's per-webhook signing secret.
//   GITHUB_DISPATCH_TOKEN     --- the PAT. Must belong to a HUMAN account;
//                                 see dispatch.ts for why that is a hard
//                                 requirement rather than a preference.
//   GITHUB_DISPATCH_REPO      --- `owner/name`.
//   GITHUB_DISPATCH_EVENT_TYPE--- optional; defaults below.
//   LINEAR_DISPATCH_STATE     --- optional; defaults to `Todo` (item 28).
//
// No CORS headers: this endpoint is server-to-server only. A browser has no
// business calling it, and advertising `Access-Control-Allow-Origin: *` on a
// dispatch trigger would invite exactly that.
import { SIGNATURE_HEADER, isFresh, verifySignature } from './signature.ts';
import { decideDispatch } from './filter.ts';
import { fireRepositoryDispatch } from './dispatch.ts';
// D5 (GAM-325 §6): posts every `dispatched: true` and every named skip
// reason to Slack, strictly AFTER the decision below. See notify.ts's
// header for the four rules this must never violate. Additive only ---
// nothing above this line changes.
import { scheduleDispatchNotification } from './notify.ts';

const DEFAULT_EVENT_TYPE = 'linear-issue-dispatch';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// Same error shape as checkin/index.ts: { error: { code, message } }.
function errorResponse(status: number, code: string, message: string): Response {
  return jsonResponse(status, { error: { code, message } });
}

// Factored out of the `Deno.serve(...)` call below and exported so
// notify.test.ts can drive it directly with a fabricated `Request` and
// assert on the returned `Response` --- proving the notifier's own success
// or failure never changes this function's status code or body (GAM-325
// §6 acceptance criterion 2). Behaviour is byte-for-byte identical to the
// previous inline handler; this is purely a name and an export, not a
// logic change.
export async function handleRequest(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Linear webhooks are delivered by POST.');
  }

  const webhookSecret = Deno.env.get('LINEAR_WEBHOOK_SECRET');
  const githubToken = Deno.env.get('GITHUB_DISPATCH_TOKEN');
  const githubRepo = Deno.env.get('GITHUB_DISPATCH_REPO');
  const eventType = Deno.env.get('GITHUB_DISPATCH_EVENT_TYPE') ?? DEFAULT_EVENT_TYPE;
  const targetState = Deno.env.get('LINEAR_DISPATCH_STATE') ?? undefined;

  // Name exactly which secret is missing --- but only the NAME, never a
  // value. A generic "misconfigured" here would cost an hour of guessing.
  const missing = [
    ['LINEAR_WEBHOOK_SECRET', webhookSecret],
    ['GITHUB_DISPATCH_TOKEN', githubToken],
    ['GITHUB_DISPATCH_REPO', githubRepo],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length > 0) {
    console.error(`linear-dispatch: missing required secret(s): ${missing.join(', ')}`);
    return errorResponse(
      500,
      'FUNCTION_MISCONFIGURED',
      `Missing required secret(s): ${missing.join(', ')}. Set them with \`supabase secrets set\`.`,
    );
  }

  // Step 1 --- the raw body, read exactly once. Everything downstream uses
  // this string; nothing re-reads the request.
  const rawBody = await req.text();

  // Step 2 --- authenticate the caller before trusting a single byte.
  const signatureValid = await verifySignature(webhookSecret!, rawBody, req.headers.get(SIGNATURE_HEADER));
  if (!signatureValid) {
    console.warn('linear-dispatch: rejected a delivery with a missing or invalid Linear-Signature.');
    return errorResponse(401, 'INVALID_SIGNATURE', 'The Linear-Signature header is missing or does not match.');
  }

  // Step 3 --- parse. Safe now: the bytes are provably Linear's.
  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return errorResponse(400, 'MALFORMED_JSON', 'Request body is not valid JSON.');
  }

  // Replay guard. The timestamp is inside the signed body, so a replayed
  // delivery carries its original timestamp and ages out on its own.
  const webhookTimestamp = (payload as { webhookTimestamp?: unknown } | null)?.webhookTimestamp;
  if (!isFresh(webhookTimestamp, Date.now())) {
    console.warn('linear-dispatch: rejected a delivery whose webhookTimestamp was stale, absent, or non-numeric.');
    return errorResponse(401, 'STALE_DELIVERY', 'The webhookTimestamp is missing or outside the accepted window.');
  }

  // Step 4 --- the judgement.
  const decision = decideDispatch(payload, { targetState });
  if (!decision.dispatch) {
    // 200, deliberately: a correct decision not to dispatch is a successful
    // delivery. The reason is in the body AND the log, so this is a visible
    // no-op rather than a silent one.
    console.log(`linear-dispatch: no dispatch [${decision.reason}] ${decision.detail}`);
    // Rides after the decision, never before it, never in place of it ---
    // and is scheduled, not awaited, so it cannot change this response.
    scheduleDispatchNotification({ dispatched: false, reason: decision.reason, detail: decision.detail });
    return jsonResponse(200, { dispatched: false, reason: decision.reason, detail: decision.detail });
  }

  // Step 5 --- fire.
  const { clientPayload } = decision;
  const result = await fireRepositoryDispatch(
    { repo: githubRepo!, token: githubToken!, eventType },
    clientPayload,
  );

  if (!result.ok) {
    console.error(
      `linear-dispatch: GitHub rejected repository_dispatch for ${clientPayload.identifier} ` +
        `(HTTP ${result.status}): ${result.detail ?? ''}`,
    );
    return errorResponse(
      502,
      'DISPATCH_FAILED',
      `GitHub returned HTTP ${result.status} for the repository_dispatch. Check GITHUB_DISPATCH_TOKEN's scope and expiry.`,
    );
  }

  console.log(
    `linear-dispatch: dispatched ${clientPayload.identifier} (tier/${clientPayload.tier}) as "${eventType}".`,
  );
  // Rides after the decision AND after GitHub confirmed the dispatch,
  // never before either --- and is scheduled, not awaited, so it cannot
  // change this response.
  scheduleDispatchNotification({
    dispatched: true,
    identifier: clientPayload.identifier,
    tier: clientPayload.tier,
    eventType,
  });
  return jsonResponse(200, {
    dispatched: true,
    identifier: clientPayload.identifier,
    tier: clientPayload.tier,
    eventType,
  });
}

// `if (import.meta.main)` --- the same guard `checkin-token/index.ts` uses
// and documents (Deno's own idiom for exactly this): `Deno.serve(...)` at
// unguarded top level would try to bind a network listener the moment ANY
// test imports this module for its exports, which trips `deno test`'s
// resource sanitizer under the `--allow-env --allow-read` permissions this
// suite runs with (no `--allow-net`). Guarding it changes nothing about
// production behaviour --- `import.meta.main` is true exactly when this
// file is the one Deno was told to run, which is how the Supabase Edge
// Runtime invokes it.
if (import.meta.main) {
  Deno.serve(handleRequest);
}
