// supabase/functions/linear-dispatch/notify.ts
//
// Slack visibility for the dispatch DECISION. This closes the design's
// sharpest open item (proposal §6.6 item 1): before this file, a wrongly
// SKIPPED dispatch looked identical to a quiet week --- the only trace was a
// 200 response nobody was watching. This module posts a Slack line for
// EVERY `dispatched: true` AND every named skip reason, so a regression in
// `filter.ts` shows up as "the messages stopped", not as silence that looks
// like nothing happened.
//
// -----------------------------------------------------------------------
// FOUR RULES, ALL FROM THE PACKET (GAM-325 §6), ALL LOAD-BEARING
// -----------------------------------------------------------------------
// 1. RIDES AFTER THE DECISION. This module never decides anything --- it is
//    called by `index.ts` only once `decideDispatch` (and, for an actual
//    dispatch, `fireRepositoryDispatch`) has already produced its outcome.
//    Nothing here can turn a dispatch into a skip or vice versa.
//
// 2. TOLERATES ITS OWN FAILURE. Every path through `notifyDispatchDecision`
//    RESOLVES, never rejects: a missing webhook, a network error, and a
//    non-2xx Slack response are all caught and logged, never thrown. The
//    dispatch is the job; the notification is not, and index.ts's response
//    status and body must be identical whether Slack is up, down, or
//    unconfigured (proven in notify.test.ts against the real `index.ts`).
//
// 3. NEVER TOUCHES THE 5s BUDGET.
//      a) The POST itself carries `AbortSignal.timeout(SLACK_TIMEOUT_MS)`,
//         well inside the function's overall budget.
//      b) `index.ts` never `await`s the notification before building its
//         response. `dispatch.ts`'s GitHub call has NO timeout of its own
//         (unbounded, pre-existing, not touched by this lane), so a second
//         sequential await here --- even one bounded to a few seconds ---
//         would still risk pushing the *total* request past the budget in
//         the worst case. So `scheduleDispatchNotification` below hands the
//         already-in-flight promise to the Supabase Edge Runtime's
//         background-task mechanism (`EdgeRuntime.waitUntil`, see
//         https://supabase.com/docs/guides/functions/background-tasks) when
//         it is available, and otherwise leaves it to run detached. Either
//         way the HTTP response is built and returned without waiting on
//         Slack at all. See the comment on `scheduleDispatchNotification`
//         for the exact mechanism and why a detached promise is safe here.
//
// 4. NO-OPS SILENTLY WHEN `SLACK_WEBHOOK_URL` IS ABSENT. The secret is
//    deliberately not created yet (proposal §8a defers it to Phase 2), so
//    absent is the NORMAL, quiet path here --- unlike the secrets
//    `index.ts` checks at the top of the handler, this one never appears in
//    the `FUNCTION_MISCONFIGURED` list and never logs anything.

/** Bounds the Slack POST. Well inside the function's overall 5s budget. */
const SLACK_TIMEOUT_MS = 3_000;

export interface DispatchedNotification {
  dispatched: true;
  identifier: string;
  tier: string;
  eventType: string;
}

export interface SkippedNotification {
  dispatched: false;
  reason: string;
  detail: string;
}

/** What `index.ts` has already decided, by the time this module sees it. */
export type NotificationInput = DispatchedNotification | SkippedNotification;

function buildSlackText(input: NotificationInput): string {
  if (input.dispatched) {
    return (
      `:white_check_mark: linear-dispatch: dispatched ${input.identifier} ` +
      `(tier/${input.tier}) as "${input.eventType}".`
    );
  }
  return `:information_source: linear-dispatch: no dispatch [${input.reason}] ${input.detail}`;
}

/**
 * Posts one Slack line for a dispatch decision. NEVER throws and the
 * returned promise NEVER rejects --- every failure path (absent webhook,
 * network error, non-2xx response) is caught here and logged, so a caller
 * can treat the result as fire-and-forget without risking an unhandled
 * rejection.
 *
 * `fetchImpl` is injectable so this is testable without network access
 * (matches the pattern `dispatch.ts` already uses for the same reason).
 */
export async function notifyDispatchDecision(
  input: NotificationInput,
  fetchImpl: typeof fetch = fetch,
): Promise<void> {
  const webhookUrl = Deno.env.get('SLACK_WEBHOOK_URL');
  if (!webhookUrl) {
    // Rule 4 --- absent is the normal, quiet path. Not an error, not a log
    // line: the secret is deliberately not created yet.
    return;
  }

  try {
    const response = await fetchImpl(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: buildSlackText(input) }),
      signal: AbortSignal.timeout(SLACK_TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn(
        `linear-dispatch: Slack notification returned HTTP ${response.status}; the dispatch decision itself is unaffected.`,
      );
    }
  } catch (err) {
    // Network error, abort/timeout, or Slack unreachable. Swallowed by
    // design (rule 2) --- logged so it is visible somewhere, never rethrown.
    console.warn(
      `linear-dispatch: Slack notification failed (${err instanceof Error ? err.message : String(err)}); the dispatch decision itself is unaffected.`,
    );
  }
}

// -----------------------------------------------------------------------
// `EdgeRuntime` is a Supabase Edge Runtime global, not a Deno one --- it
// does not exist under plain `deno test` or `deno run`. Declared as
// possibly-`undefined` so `typeof EdgeRuntime !== 'undefined'` type-checks
// AND is safe at runtime even when the identifier was never declared by the
// host at all: `typeof` on an unknown global never throws, unlike a bare
// reference to it would.
// -----------------------------------------------------------------------
declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void } | undefined;

/**
 * Schedules the Slack notification WITHOUT delaying the caller. This is the
 * only entry point `index.ts` calls, and it calls it unawaited (see rule 3
 * above and the comment block just above this function).
 *
 * On the real Supabase Edge Runtime, `EdgeRuntime.waitUntil` keeps the
 * isolate alive long enough for the notification's `fetch` to finish AFTER
 * the response has already been sent to the caller --- exactly the
 * "platform's background mechanism" the packet asks for, chosen over a
 * bounded `await` because the request already contains one unbounded
 * network call (`dispatch.ts`'s GitHub POST) and stacking a second
 * sequential wait behind it risks the 5s budget in the worst case.
 *
 * Outside that runtime (`deno test`, or any future host that does not
 * expose `EdgeRuntime`), the promise is simply left to run detached.
 * `notifyDispatchDecision` never rejects, so there is nothing for an
 * unobserved promise to throw --- it is safe, not merely unwatched.
 */
export function scheduleDispatchNotification(input: NotificationInput, fetchImpl: typeof fetch = fetch): void {
  const notified = notifyDispatchDecision(input, fetchImpl);
  if (typeof EdgeRuntime !== 'undefined') {
    EdgeRuntime.waitUntil(notified);
  } else {
    void notified;
  }
}
