// Which Linear webhook deliveries become a Claude dispatch, and which do not.
//
// Pure and synchronous: no network, no clock, no env. `index.ts` owns the
// side effects; this module owns the judgement, so every rule below is
// directly testable and every rejection carries a reason.
//
// -----------------------------------------------------------------------
// WHY EVERY SKIP IS NAMED
// -----------------------------------------------------------------------
// The tracker-migration doc's section 6 records the failure this project
// keeps hitting: "a silent no-op that looks like success". A filter is
// exactly that shape --- a guard that never fires is indistinguishable from
// a guard that works, and a webhook that quietly drops everything looks
// identical to one with nothing to do.
//
// So `decideDispatch` never returns a bare boolean. Every rejection carries a
// machine-readable `reason` and a human-readable `detail`, `index.ts` puts
// both in the 200 response body and the log line, and the tests below assert
// the *reason*, not merely that dispatch did not happen. A rule that stopped
// working would change which reason comes back, and a test would see it.
//
// -----------------------------------------------------------------------
// THE RULES, IN ORDER, AND WHERE EACH COMES FROM
// -----------------------------------------------------------------------
// 1. `type === 'Issue'`. The webhook is subscribed to Issue events, but
//    Linear can deliver Comment/Reaction/Project payloads through the same
//    endpoint if the subscription is ever widened. Belt and braces.
//
// 2. `action === 'update'`. A dispatch is a *transition*, so `create` and
//    `remove` are not dispatchable --- an issue created directly in `Todo`
//    is deliberately NOT dispatched (see the open question in the design
//    doc; promotion is meant to be the owner's explicit signal).
//
// 3. The issue must carry an `id` and an `identifier`, or there is nothing
//    to hand a coding agent.
//
// 4. The new state must be the target state (default `Todo`), matched on
//    NAME, case-insensitively and trimmed. Constitution item 28 names the
//    column --- "the live queue is the `Todo` column" --- and the name is
//    what the owner actually drags a card into. Matched case-insensitively
//    because a state rename to `TODO` should not silently stop the queue.
//
// 5. `updatedFrom` must contain `stateId`. **This is the load-bearing
//    guard.** Linear sends an `update` for every edit --- a label added, a
//    description reworded, an estimate set --- and on all of those the
//    issue is still in `Todo`, so rule 4 alone would re-dispatch the same
//    issue on every keystroke-level change and start a second agent on work
//    already claimed. `updatedFrom` holds the *previous* values of exactly
//    the fields that changed, so `stateId` appearing in it is the precise
//    signal "the state moved in this event", and its absence is the precise
//    signal "something else about an issue already in Todo changed".
//
// 6. Labels must be present on the payload at all. Absent labels are their
//    own reason rather than being folded into rule 7: "no tier label" and
//    "the payload never carried labels" are different failures, one a
//    correct skip and one a payload-shape regression, and collapsing them
//    would hide the second behind the first.
//
// 7. The issue must carry a `tier/*` label. This is constitution item 28b's
//    identity test, quoted: "Our issues are the ones carrying a `tier/*`
//    label. Linear ships its own onboarding issues and they live in `Todo`
//    too; they carry no labels." Note it is deliberately NOT the `Tnnn`
//    title prefix --- item 28b rules that out explicitly, because a finding
//    filed by a skill has no `Tnnn` and is still ours.
//
//    `tier/unreviewed` IS dispatched. Item 28d says such a row "may not
//    enter `In Progress` until it is tiered", and that "judging the tier is
//    part of claiming, not part of finishing" --- so tiering is the
//    dispatched agent's first job, not a precondition for dispatching it.
//
// 8. `gate/human` is NOT dispatched. AGENTS.md defines it as "no machine may
//    close it". Starting an autonomous agent on a row explicitly gated on a
//    human is the kind of quiet over-reach the constitution exists to
//    prevent. This is the one rule here that is an inference rather than a
//    quotation, so it is called out as a decision in the design doc and the
//    skip is loud rather than silent.

/** The state name an issue must land in to be dispatched. Item 28's `Todo`. */
export const DEFAULT_TARGET_STATE = 'Todo';

/** Item 28b's identity test. */
export const TIER_LABEL_PREFIX = 'tier/';

/** AGENTS.md: "no machine may close it". */
export const HUMAN_GATE_LABEL = 'gate/human';

// -----------------------------------------------------------------------
// `tier/fast` IS NOT A LABEL NAME. THIS COST A REWRITE OF THIS FILE.
// -----------------------------------------------------------------------
// Every document in this project writes the tier labels as `tier/fast`,
// `tier/unreviewed`, and so on, and the generated `linear-export.json`
// contains exactly those strings. It is natural — and wrong — to conclude
// that a label named `tier/fast` exists in Linear.
//
// It does not. Read from the live workspace: Linear label GROUPS are a
// parent/child relation, and the children's names are BARE. The workspace
// holds a group `tier` whose children are named `fast`, `standard`, `heavy`
// and `unreviewed`; a group `gate` whose children are `human` and
// `unverified`; and a group `area` with `w1`..`w10`.
//
// The slashes come from `scripts/linear-export.mjs`, which SYNTHESISES them:
//
//     .map((l) => (l.parent ? `${l.parent.name}/${l.name}` : l.name))
//
// So a filter matching `name.startsWith('tier/')` against a webhook payload
// would match nothing, ever — and its failure mode is the worst available
// one: every issue skipped for a plausible-sounding reason (`NO_TIER_LABEL`),
// a queue that silently never dispatches, and a log full of lines that look
// like correct decisions. That is precisely the
// "silent no-op that looks like success" this project keeps recording, and it
// was one commit away from shipping.
//
// So label names are normalised to the export's `group/name` PATH form when
// the payload carries a parent, and matched against the bare child names when
// it does not. Both are accepted because Linear's webhook docs do not pin the
// serialised shape of `labels` — they only say the payload "reflects the
// corresponding GraphQL entity" — so whether `parent` is present in a webhook
// body is not something to bet the queue on.

/**
 * Bare child names of the `tier` group, read from the live workspace on
 * 2026-08-09. Used only when a payload gives no parent to build a path from.
 *
 * No collision risk here: the workspace's ungrouped labels are `escalated`,
 * `Bug`, `Improvement` and `Feature`.
 */
export const KNOWN_TIER_NAMES: readonly string[] = ['unreviewed', 'fast', 'standard', 'heavy'];

/** Bare child name of the `gate` group that blocks machine dispatch. */
const HUMAN_GATE_BARE_NAME = 'human';

export type SkipReason =
  | 'NOT_AN_ISSUE_EVENT'
  | 'NOT_AN_UPDATE'
  | 'MALFORMED_ISSUE'
  | 'NOT_TARGET_STATE'
  | 'STATE_UNCHANGED'
  | 'LABELS_UNAVAILABLE'
  | 'NO_TIER_LABEL'
  | 'HUMAN_GATED';

/**
 * What gets handed to GitHub as `client_payload`.
 *
 * Seven top-level properties, against a hard GitHub limit of 10 --- and the
 * whole object is a few hundred bytes against a 64KB limit.
 *
 * The issue DESCRIPTION is deliberately absent. It is the largest field and
 * the least useful one to freeze here: item 28c requires the dispatched
 * agent to re-read the issue and confirm it holds the claim before doing
 * anything, so it will fetch live text regardless. Shipping a copy would
 * only create a second, staler version of the description for the agent to
 * disagree with.
 */
export interface DispatchClientPayload {
  identifier: string;
  issueId: string;
  title: string;
  url: string;
  /** The `tier/*` label with its prefix stripped, e.g. `heavy`, `unreviewed`. */
  tier: string;
  labels: string[];
  priority: number | null;
}

export type DispatchDecision =
  | { dispatch: true; clientPayload: DispatchClientPayload }
  | { dispatch: false; reason: SkipReason; detail: string };

export interface DecideOptions {
  /** Defaults to `Todo`. Matched on name, case-insensitively. */
  targetState?: string;
}

function skip(reason: SkipReason, detail: string): DispatchDecision {
  return { dispatch: false, reason, detail };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Normalises a payload's labels into the same `group/name` path form that
 * `scripts/linear-export.mjs` writes, so one vocabulary covers the docs, the
 * export and this filter.
 *
 * Three input shapes are accepted:
 *   * `{ name: 'fast', parent: { name: 'tier' } }` -> `tier/fast`
 *   * `{ name: 'fast' }`                           -> `fast`
 *   * `'tier/fast'` (a plain string)               -> `tier/fast`
 *
 * Returns `null` (not `[]`) when labels are absent entirely, so rule 6 can
 * tell "no labels field" from "an empty label set".
 */
export function extractLabelNames(data: Record<string, unknown>): string[] | null {
  const raw = data.labels;
  if (!Array.isArray(raw)) return null;
  const names: string[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string') {
      names.push(entry);
    } else if (isRecord(entry) && typeof entry.name === 'string') {
      const parent = isRecord(entry.parent) && typeof entry.parent.name === 'string' ? entry.parent.name : null;
      names.push(parent ? `${parent}/${entry.name}` : entry.name);
    }
  }
  return names;
}

/**
 * The issue's tier, or `null` if it carries none. Item 28b's identity test.
 *
 * Matches the path form (`tier/fast`) when the payload carried a parent, and
 * falls back to the bare child names when it did not. See the long note above
 * for why accepting both is not defensive padding but the difference between
 * a working queue and one that silently never dispatches.
 *
 * The tier is returned lower-cased and without its group, so `clientPayload
 * .tier` is the same string whichever shape arrived.
 */
export function tierFromLabels(labelNames: readonly string[]): string | null {
  for (const name of labelNames) {
    const trimmed = name.trim().toLowerCase();
    if (trimmed.startsWith(TIER_LABEL_PREFIX)) {
      const tier = trimmed.slice(TIER_LABEL_PREFIX.length);
      if (tier.length > 0) return tier;
    }
    if (KNOWN_TIER_NAMES.includes(trimmed)) return trimmed;
  }
  return null;
}

/** True for `gate/human` in path form, or a bare `human` child label. */
export function hasHumanGate(labelNames: readonly string[]): boolean {
  return labelNames.some((n) => {
    const trimmed = n.trim().toLowerCase();
    return trimmed === HUMAN_GATE_LABEL || trimmed === HUMAN_GATE_BARE_NAME;
  });
}

/**
 * The whole filter. `payload` is the already-parsed Linear webhook body ---
 * `index.ts` must have verified the signature against the RAW body before
 * calling this.
 */
export function decideDispatch(payload: unknown, options: DecideOptions = {}): DispatchDecision {
  const targetState = (options.targetState ?? DEFAULT_TARGET_STATE).trim().toLowerCase();

  if (!isRecord(payload)) {
    return skip('MALFORMED_ISSUE', 'Webhook body was not a JSON object.');
  }

  // Rule 1.
  if (payload.type !== 'Issue') {
    return skip('NOT_AN_ISSUE_EVENT', `Event type was ${JSON.stringify(payload.type)}, not "Issue".`);
  }

  // Rule 2.
  if (payload.action !== 'update') {
    return skip('NOT_AN_UPDATE', `Action was ${JSON.stringify(payload.action)}, not "update".`);
  }

  // Rule 3.
  const data = payload.data;
  if (!isRecord(data) || typeof data.id !== 'string' || typeof data.identifier !== 'string') {
    return skip('MALFORMED_ISSUE', 'Issue payload is missing `data.id` or `data.identifier`.');
  }

  // Rule 4.
  const state = isRecord(data.state) ? data.state : null;
  const stateName = state && typeof state.name === 'string' ? state.name : null;
  if (stateName === null || stateName.trim().toLowerCase() !== targetState) {
    return skip(
      'NOT_TARGET_STATE',
      `Issue ${data.identifier} is in ${JSON.stringify(stateName)}, not the dispatch state ` +
        `${JSON.stringify(options.targetState ?? DEFAULT_TARGET_STATE)}.`,
    );
  }

  // Rule 5 --- the guard that stops an already-claimed issue re-dispatching.
  const updatedFrom = isRecord(payload.updatedFrom) ? payload.updatedFrom : null;
  if (updatedFrom === null || !('stateId' in updatedFrom)) {
    return skip(
      'STATE_UNCHANGED',
      `Issue ${data.identifier} is already in ${stateName} and this update did not move it ` +
        '(no `stateId` in `updatedFrom`).',
    );
  }

  // Rule 6.
  const labels = extractLabelNames(data);
  if (labels === null) {
    return skip('LABELS_UNAVAILABLE', `Issue ${data.identifier} payload carried no \`labels\` array.`);
  }

  // Rule 7 --- item 28b's identity test.
  const tier = tierFromLabels(labels);
  if (tier === null) {
    return skip(
      'NO_TIER_LABEL',
      `Issue ${data.identifier} carries no \`tier/*\` label, so it is not ours (constitution item 28b).`,
    );
  }

  // Rule 8.
  if (hasHumanGate(labels)) {
    return skip('HUMAN_GATED', `Issue ${data.identifier} carries \`${HUMAN_GATE_LABEL}\`; a machine may not take it.`);
  }

  return {
    dispatch: true,
    clientPayload: {
      identifier: data.identifier,
      issueId: data.id,
      title: typeof data.title === 'string' ? data.title : '',
      url: typeof payload.url === 'string' ? payload.url : '',
      tier,
      labels,
      priority: typeof data.priority === 'number' ? data.priority : null,
    },
  };
}
