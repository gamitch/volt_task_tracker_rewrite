#!/usr/bin/env node
// GAM-407 criterion 4 — validate-then-write ordering.
//
// Pure module, no network, no credentials, matching the existing
// scripts/linear-*.test.mjs pattern (see scripts/linear-assert-released.mjs).
// This is the CONTROLLER half of the run store spike: given a checkpoint
// candidate the executor claims to have published (the store's own half of
// that publication is Worker A's `ops.publish_checkpoint`, exercised on a
// scratch PostgreSQL cluster in supabase/tests/run_gam407_run_store_spike.sh),
// decide whether the controller may act on it — and, if it may, make the
// GitHub and Linear writes only *after* that decision, never before.
//
// THE CANDIDATE SHAPE. A checkpoint candidate is:
//
//   {
//     runId: string,          // which run this evidence claims to be for
//     headSha: string,        // the commit the executor claims to have landed
//     evidence: object,       // arbitrary structured evidence payload
//     storeOutcome: 'ok' | 'stale_generation' | 'version_conflict'
//                   | 'no_such_capability' | Error,
//   }
//
// `storeOutcome` is what reached the controller after the executor called
// `ops.publish_checkpoint`: one of the four named outcomes the store itself
// returns (see D2/AC2 in the packet), OR an Error instance if that call never
// returned an outcome at all — the store was unreachable mid-statement
// (§7 scenario 15's store-side half, which Worker A's harness exercises
// directly against Postgres; `attemptStoreCall` below is how a caller of this
// module turns that failure into `storeOutcome` data without this module ever
// touching a socket itself).
//
// THE REJECTION VOCABULARY IS A HARD CONTRACT (packet, "Name fidelity").
// Three names are STORE-DERIVED and must match `schema.sql`'s outcome names
// verbatim — a checker verifies these three against Worker A's SQL, not
// against this file's own tests:
//
//   stale_generation, version_conflict, no_such_capability
//
// Four names are CONTROLLER-LOCAL and have no store counterpart at all —
// checking them against `schema.sql` would be wrong, not merely redundant:
//
//   wrong_run, missing_head_sha, malformed_evidence, store_unavailable
//
// `STORE_DERIVED_OUTCOMES` and `CONTROLLER_LOCAL_REASONS` below exist so a
// checker (or a future reader) can see that split as data, not just prose.

/** The store's own outcome vocabulary — exactly what `ops.publish_checkpoint`
 * returns per the packet's D2 spec, plus `ok` for the success case. Kept as
 * one array so `stale_generation`, `version_conflict` and `no_such_capability`
 * each appear as a single source string, copied verbatim from the packet
 * rather than retyped at each call site. */
export const STORE_OUTCOMES = Object.freeze([
  'ok',
  'stale_generation',
  'version_conflict',
  'no_such_capability',
]);

/** The subset of STORE_OUTCOMES that are REJECTIONS — i.e. every store
 * outcome except `ok`. These three, and only these three, are checked against
 * `schema.sql` by a separate checker. */
export const STORE_DERIVED_REJECTION_REASONS = Object.freeze(
  STORE_OUTCOMES.filter((outcome) => outcome !== 'ok'),
);

/** Rejection reasons this controller invents on its own. None of these has a
 * store counterpart — `schema.sql` never returns any of them, and a checker
 * that went looking for them there would be checking the wrong artifact. */
export const CONTROLLER_LOCAL_REJECTION_REASONS = Object.freeze([
  'wrong_run',
  'missing_head_sha',
  'malformed_evidence',
  'store_unavailable',
]);

/** The full vocabulary `validateCheckpointCandidate` can name, store-derived
 * and controller-local together — the exact seven names the packet's Worker B
 * section lists. */
export const REJECTION_REASONS = Object.freeze([
  ...CONTROLLER_LOCAL_REJECTION_REASONS,
  ...STORE_DERIVED_REJECTION_REASONS,
]);

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function rejected(reason, detail) {
  return { valid: false, reason, detail };
}

/**
 * Validates a checkpoint candidate against what the controller expects for
 * this run, WITHOUT touching any write sink. Synchronous and pure: given the
 * same `candidate`/`expected`, it always returns the same result.
 *
 * Checks run in a fixed, documented order, each one only reached if every
 * earlier one passed:
 *
 *   1. malformed_evidence  — is the candidate even shaped like evidence?
 *   2. store_unavailable   — did the store call that produced this candidate
 *                            ever return an outcome at all?
 *   3. missing_head_sha    — is there a commit to point external systems at?
 *   4. wrong_run           — does this evidence even claim to be for the run
 *                            the controller is tracking?
 *   5. stale_generation / version_conflict / no_such_capability / ok
 *                          — the store's own compare-and-set verdict,
 *                            passed through unchanged.
 *
 * @param {{runId:string, headSha:string, evidence:object,
 *           storeOutcome:(string|Error)}} candidate
 * @param {{runId:string}} expected
 * @returns {{valid:true} | {valid:false, reason:string, detail:string}}
 */
export function validateCheckpointCandidate(candidate, expected) {
  // (1) malformed_evidence — structural well-formedness first. Everything
  // after this point assumes these fields exist and are the right shape.
  if (!isPlainObject(candidate)) {
    return rejected('malformed_evidence', 'candidate is not an object');
  }
  if (typeof candidate.runId !== 'string' || candidate.runId.length === 0) {
    return rejected('malformed_evidence', 'candidate.runId is missing or not a string');
  }
  if (!isPlainObject(candidate.evidence)) {
    return rejected('malformed_evidence', 'candidate.evidence is missing or not an object');
  }
  const outcome = candidate.storeOutcome;
  const outcomeIsError = outcome instanceof Error;
  if (!outcomeIsError && (typeof outcome !== 'string' || outcome.length === 0)) {
    return rejected(
      'malformed_evidence',
      'candidate.storeOutcome is missing — neither a store outcome string nor an Error',
    );
  }
  if (!isPlainObject(expected) || typeof expected.runId !== 'string') {
    return rejected('malformed_evidence', 'expected.runId is missing or not a string');
  }

  // (2) store_unavailable — the store call never returned a named outcome at
  // all (§7 scenario 15's store-side half: a killed connection, a paused
  // free-tier project, a dead port). This has no counterpart in schema.sql
  // because the store cannot itself report a failure to respond — the
  // *absence* of a returned outcome is what this branch is naming.
  if (outcomeIsError) {
    return rejected(
      'store_unavailable',
      `store call did not return an outcome: ${outcome.message}`,
    );
  }

  // (3) missing_head_sha — required evidence field (revision 1 omitted it
  // from ops.run while the validator named it; packet MINOR-7).
  if (typeof candidate.headSha !== 'string' || candidate.headSha.trim().length === 0) {
    return rejected('missing_head_sha', 'candidate.headSha is missing or empty');
  }

  // (4) wrong_run — controller-local sanity check: this evidence must claim
  // to be for the run the controller is tracking. The store never makes this
  // comparison itself (it derives run_id from the token, not from a
  // caller-supplied run id) — that is exactly why this reason has no store
  // counterpart.
  if (candidate.runId !== expected.runId) {
    return rejected(
      'wrong_run',
      `candidate is for run ${candidate.runId}, controller expected ${expected.runId}`,
    );
  }

  // (5) store-derived outcomes, passed through verbatim. These three strings
  // are pinned to schema.sql's outcome names and must not be respelled here.
  if (outcome === 'ok') {
    return { valid: true };
  }
  if (STORE_DERIVED_REJECTION_REASONS.includes(outcome)) {
    return rejected(outcome, `store reported ${outcome}`);
  }

  // Defensive: a store outcome string that is neither 'ok' nor one of the
  // three named rejections is malformed input, not a new kind of rejection.
  return rejected(
    'malformed_evidence',
    `candidate.storeOutcome is not a recognised outcome: ${outcome}`,
  );
}

/**
 * Calls `callStore()` and turns whatever happens into the `storeOutcome`
 * shape `validateCheckpointCandidate` expects: the returned outcome string on
 * success, or the caught Error itself if `callStore` throws. This is the one
 * place in this module that models "the store call threw during
 * publication" (§7 scenario 15, MAJOR-4) — the throw happens for real, right
 * here, and is caught rather than propagated, so a caller building a
 * candidate from a dead connection gets `storeOutcome` data, never an
 * uncaught rejection.
 *
 * `callStore` is caller-supplied and is never a real network call inside
 * this module — this module has no credentials and makes none. In tests it
 * is a function that throws synchronously to model a killed connection.
 *
 * @param {() => string} callStore
 * @returns {string | Error}
 */
export function attemptStoreCall(callStore) {
  try {
    return callStore();
  } catch (err) {
    return err instanceof Error ? err : new Error(String(err));
  }
}

/**
 * The validate-then-write contract itself (criterion 4). Validates first;
 * `sinks.github` and `sinks.linear` are invoked ONLY if validation passed,
 * and only in that order — never the reverse, and never both when validation
 * failed. Returns a result recording exactly what happened, including the
 * call order, so a test can assert the negative (zero invocations) as well
 * as the positive.
 *
 * @param {object} candidate
 * @param {{runId:string}} expected
 * @param {{github: Function, linear: Function}} sinks
 * @returns {Promise<{published:boolean, reason?:string, detail?:string, callOrder:string[]}>}
 */
export async function publishExternal(candidate, expected, sinks) {
  const callOrder = [];
  const validation = validateCheckpointCandidate(candidate, expected);

  if (!validation.valid) {
    // The whole point of this function: neither sink is touched here.
    return { published: false, reason: validation.reason, detail: validation.detail, callOrder };
  }

  callOrder.push('github');
  await sinks.github(candidate);

  callOrder.push('linear');
  await sinks.linear(candidate);

  return { published: true, callOrder };
}
