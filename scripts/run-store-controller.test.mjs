// Unit tests for scripts/run-store-controller.mjs — GAM-407 criterion 4.
//
// No network, no credentials, no import of anything that touches GitHub or
// Linear for real: `sinks.github` and `sinks.linear` are `vi.fn()` mocks, and
// every assertion here is checkable from their call counts and call order
// alone. A happy-path-only test proves nothing about ordering, so the bulk of
// this file is negative: on every one of the seven named rejection reasons,
// BOTH sinks must have been called zero times.
import { describe, expect, it, vi } from 'vitest';
import {
  attemptStoreCall,
  CONTROLLER_LOCAL_REJECTION_REASONS,
  publishExternal,
  REJECTION_REASONS,
  STORE_DERIVED_REJECTION_REASONS,
  STORE_OUTCOMES,
  validateCheckpointCandidate,
} from './run-store-controller.mjs';

const EXPECTED = { runId: 'run-aaaa' };

function validCandidate(overrides = {}) {
  return {
    runId: 'run-aaaa',
    headSha: 'deadbeefcafef00d',
    evidence: { note: 'checkpoint reached' },
    storeOutcome: 'ok',
    ...overrides,
  };
}

describe('name fidelity — the vocabulary split the packet pins as a hard contract', () => {
  it('has exactly three store-derived rejection reasons, matching schema.sql outcome names verbatim', () => {
    // A checker verifies these three against Worker A's schema.sql, not
    // against this file. They must read exactly as the packet spells them.
    expect(STORE_DERIVED_REJECTION_REASONS).toEqual([
      'stale_generation',
      'version_conflict',
      'no_such_capability',
    ]);
  });

  it('has exactly four controller-local rejection reasons, none of which has a store counterpart', () => {
    expect(CONTROLLER_LOCAL_REJECTION_REASONS).toEqual([
      'wrong_run',
      'missing_head_sha',
      'malformed_evidence',
      'store_unavailable',
    ]);
  });

  it('the full vocabulary is exactly the seven names the packet lists for Worker B', () => {
    expect(new Set(REJECTION_REASONS)).toEqual(
      new Set([
        'wrong_run',
        'stale_generation',
        'version_conflict',
        'no_such_capability',
        'missing_head_sha',
        'malformed_evidence',
        'store_unavailable',
      ]),
    );
    expect(REJECTION_REASONS.length).toBe(7);
  });

  it("STORE_OUTCOMES is the store's four-outcome vocabulary, ok plus the three rejections", () => {
    expect(STORE_OUTCOMES).toEqual([
      'ok',
      'stale_generation',
      'version_conflict',
      'no_such_capability',
    ]);
  });
});

describe('validateCheckpointCandidate — naming every rejection reason', () => {
  it('accepts a well-formed candidate whose store outcome is ok', () => {
    expect(validateCheckpointCandidate(validCandidate(), EXPECTED)).toEqual({ valid: true });
  });

  it('malformed_evidence — candidate is not an object', () => {
    expect(validateCheckpointCandidate(null, EXPECTED)).toMatchObject({
      valid: false,
      reason: 'malformed_evidence',
    });
    expect(validateCheckpointCandidate('not an object', EXPECTED)).toMatchObject({
      valid: false,
      reason: 'malformed_evidence',
    });
    expect(validateCheckpointCandidate(['array', 'not', 'object'], EXPECTED)).toMatchObject({
      valid: false,
      reason: 'malformed_evidence',
    });
  });

  it('malformed_evidence — runId missing or not a string', () => {
    const { runId, ...rest } = validCandidate();
    void runId;
    expect(validateCheckpointCandidate(rest, EXPECTED)).toMatchObject({
      valid: false,
      reason: 'malformed_evidence',
    });
    expect(validateCheckpointCandidate(validCandidate({ runId: 42 }), EXPECTED)).toMatchObject({
      valid: false,
      reason: 'malformed_evidence',
    });
  });

  it('malformed_evidence — evidence missing or not an object', () => {
    expect(
      validateCheckpointCandidate(validCandidate({ evidence: undefined }), EXPECTED),
    ).toMatchObject({ valid: false, reason: 'malformed_evidence' });
    expect(
      validateCheckpointCandidate(validCandidate({ evidence: 'nope' }), EXPECTED),
    ).toMatchObject({
      valid: false,
      reason: 'malformed_evidence',
    });
  });

  it('malformed_evidence — storeOutcome missing entirely', () => {
    expect(
      validateCheckpointCandidate(validCandidate({ storeOutcome: undefined }), EXPECTED),
    ).toMatchObject({ valid: false, reason: 'malformed_evidence' });
  });

  it('malformed_evidence — storeOutcome is a string but not one of the four named outcomes', () => {
    expect(
      validateCheckpointCandidate(
        validCandidate({ storeOutcome: 'definitely_not_real' }),
        EXPECTED,
      ),
    ).toMatchObject({ valid: false, reason: 'malformed_evidence' });
  });

  it('store_unavailable — storeOutcome is an Error, the store call never returned a named outcome', () => {
    const err = new Error('server closed the connection unexpectedly (57P01)');
    const result = validateCheckpointCandidate(validCandidate({ storeOutcome: err }), EXPECTED);
    expect(result).toMatchObject({ valid: false, reason: 'store_unavailable' });
    expect(result.detail).toMatch(/57P01/);
  });

  it('missing_head_sha — empty or absent headSha', () => {
    expect(validateCheckpointCandidate(validCandidate({ headSha: '' }), EXPECTED)).toMatchObject({
      valid: false,
      reason: 'missing_head_sha',
    });
    expect(validateCheckpointCandidate(validCandidate({ headSha: '   ' }), EXPECTED)).toMatchObject(
      {
        valid: false,
        reason: 'missing_head_sha',
      },
    );
    const { headSha, ...rest } = validCandidate();
    void headSha;
    expect(validateCheckpointCandidate(rest, EXPECTED)).toMatchObject({
      valid: false,
      reason: 'missing_head_sha',
    });
  });

  it('wrong_run — candidate claims a different run than the controller expects', () => {
    expect(
      validateCheckpointCandidate(validCandidate({ runId: 'run-bbbb' }), EXPECTED),
    ).toMatchObject({ valid: false, reason: 'wrong_run' });
  });

  it('stale_generation — passed through verbatim from the store', () => {
    expect(
      validateCheckpointCandidate(validCandidate({ storeOutcome: 'stale_generation' }), EXPECTED),
    ).toMatchObject({ valid: false, reason: 'stale_generation' });
  });

  it('version_conflict — passed through verbatim from the store', () => {
    expect(
      validateCheckpointCandidate(validCandidate({ storeOutcome: 'version_conflict' }), EXPECTED),
    ).toMatchObject({ valid: false, reason: 'version_conflict' });
  });

  it('no_such_capability — passed through verbatim from the store (the fencing outcome)', () => {
    expect(
      validateCheckpointCandidate(validCandidate({ storeOutcome: 'no_such_capability' }), EXPECTED),
    ).toMatchObject({ valid: false, reason: 'no_such_capability' });
  });

  it('checks in the documented order: malformed_evidence beats every later reason', () => {
    // headSha is also empty here, but the missing evidence object must be
    // reported first — order is a documented contract, not an accident.
    const result = validateCheckpointCandidate(
      { runId: 'run-aaaa', headSha: '', storeOutcome: 'ok' },
      EXPECTED,
    );
    expect(result.reason).toBe('malformed_evidence');
  });
});

describe('attemptStoreCall — the store error is thrown for real and caught here', () => {
  it('returns the outcome string on a successful call', () => {
    expect(attemptStoreCall(() => 'ok')).toBe('ok');
  });

  it('catches a thrown Error and returns it as storeOutcome data', () => {
    const thrown = new Error('connection terminated unexpectedly');
    const outcome = attemptStoreCall(() => {
      throw thrown;
    });
    expect(outcome).toBe(thrown);
  });

  it('wraps a thrown non-Error into an Error', () => {
    const outcome = attemptStoreCall(() => {
      throw 'raw string throw';
    });
    expect(outcome).toBeInstanceOf(Error);
    expect(outcome.message).toBe('raw string throw');
  });
});

describe('publishExternal — validate-then-write ordering (criterion 4)', () => {
  function makeSinks() {
    return {
      github: vi.fn().mockResolvedValue(undefined),
      linear: vi.fn().mockResolvedValue(undefined),
    };
  }

  it('happy path: both sinks are called, github before linear, in that order', async () => {
    const sinks = makeSinks();
    const result = await publishExternal(validCandidate(), EXPECTED, sinks);

    expect(result.published).toBe(true);
    expect(result.callOrder).toEqual(['github', 'linear']);
    expect(sinks.github).toHaveBeenCalledTimes(1);
    expect(sinks.linear).toHaveBeenCalledTimes(1);
    expect(sinks.github.mock.invocationCallOrder[0]).toBeLessThan(
      sinks.linear.mock.invocationCallOrder[0],
    );
  });

  // THE NEGATIVE. A happy-path-only test proves nothing about ordering — the
  // packet requires the zero-invocation assertion explicitly (AC6), and it is
  // repeated once per rejection reason so no single named reason can regress
  // silently through a gap in the others.
  describe('invalid candidates: github and linear are called ZERO times', () => {
    const cases = [
      ['malformed_evidence', validCandidate({ evidence: undefined })],
      ['missing_head_sha', validCandidate({ headSha: '' })],
      ['wrong_run', validCandidate({ runId: 'run-zzzz' })],
      ['stale_generation', validCandidate({ storeOutcome: 'stale_generation' })],
      ['version_conflict', validCandidate({ storeOutcome: 'version_conflict' })],
      ['no_such_capability', validCandidate({ storeOutcome: 'no_such_capability' })],
    ];

    it.each(cases)('%s → zero sink invocations', async (expectedReason, candidate) => {
      const sinks = makeSinks();
      const result = await publishExternal(candidate, EXPECTED, sinks);

      expect(result.published).toBe(false);
      expect(result.reason).toBe(expectedReason);
      expect(sinks.github).not.toHaveBeenCalled();
      expect(sinks.linear).not.toHaveBeenCalled();
      expect(sinks.github.mock.calls.length).toBe(0);
      expect(sinks.linear.mock.calls.length).toBe(0);
      expect(result.callOrder).toEqual([]);
    });
  });

  // Scenario 15's controller half (MAJOR-4): the store call genuinely throws
  // during publication — the throw happens for real inside this test, is
  // caught by `attemptStoreCall`, and the resulting candidate must still
  // reach publishExternal as a named failure with zero external writes.
  it('scenario 15 (controller half): a store error thrown during publication yields store_unavailable and zero external writes', async () => {
    const sinks = makeSinks();
    function callStoreThatDies() {
      throw new Error('FATAL: 57P01: terminating connection due to administrator command');
    }
    const storeOutcome = attemptStoreCall(callStoreThatDies);
    expect(storeOutcome).toBeInstanceOf(Error);

    const candidate = validCandidate({ storeOutcome });
    const result = await publishExternal(candidate, EXPECTED, sinks);

    expect(result.published).toBe(false);
    expect(result.reason).toBe('store_unavailable');
    expect(result.detail).toMatch(/57P01/);
    expect(sinks.github).not.toHaveBeenCalled();
    expect(sinks.linear).not.toHaveBeenCalled();
    expect(result.callOrder).toEqual([]);
  });

  it('validation runs before either sink is even referenced: an invalid candidate never touches sinks even if they would throw', async () => {
    const explodingSinks = {
      github: vi.fn().mockRejectedValue(new Error('github must not be called')),
      linear: vi.fn().mockRejectedValue(new Error('linear must not be called')),
    };
    await expect(
      publishExternal(
        validCandidate({ storeOutcome: 'no_such_capability' }),
        EXPECTED,
        explodingSinks,
      ),
    ).resolves.toMatchObject({ published: false });
    expect(explodingSinks.github).not.toHaveBeenCalled();
    expect(explodingSinks.linear).not.toHaveBeenCalled();
  });
});
