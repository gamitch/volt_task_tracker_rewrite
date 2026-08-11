// Unit tests for scripts/linear-assert-released.mjs's two pure functions.
//
// Both are network-free and synchronous, so this file imports the module
// directly with no mocking of `fetch` and no import of `client.mjs`'s side
// effects — `classifyState` takes a state NAME and `isRetryableError` takes
// an `Error`, and neither reaches the network to answer.
//
// Every assertion checks the machine-readable outcome (`released` /
// `isRetryableError`'s boolean), not merely that a message string exists —
// the reason text is exercised too, because a `released` flag that flipped
// for the wrong reason is the same silent-failure shape GAM-314 is about.
import { describe, expect, it } from 'vitest';
import {
  classifyState,
  isIssueNotFoundError,
  isRetryableError,
} from './linear-assert-released.mjs';

describe('classifyState — the denylist of one', () => {
  it('In Progress is NOT released — the chain is unfinished', () => {
    const { released, reason } = classifyState('In Progress');
    expect(released).toBe(false);
    expect(reason).toMatch(/still In Progress/);
    // The three benign shapes named in the packet must all be legible in the
    // message, so the first person to hit one does not delete the check.
    expect(reason).toMatch(/deliberately near the wall clock/);
    expect(reason).toMatch(/Loop Limit/);
    expect(reason).toMatch(/Linear automation/);
  });

  it('matches case-insensitively and trims whitespace, same shape as filter.ts:273', () => {
    for (const variant of ['in progress', 'IN PROGRESS', ' In Progress ']) {
      expect(classifyState(variant).released).toBe(false);
    }
  });

  it("In Review is released — item 28e's finished state", () => {
    const { released, reason } = classifyState('In Review');
    expect(released).toBe(true);
    expect(reason).toMatch(/In Review/);
  });

  it('Todo is released — a correct refusal to proceed, not a resting failure', () => {
    const { released, reason } = classifyState('Todo');
    expect(released).toBe(true);
    expect(reason).toMatch(/refusal to proceed/);
  });

  it("Backlog, Done, Canceled and Duplicate are all released — not this assertion's business", () => {
    for (const state of ['Backlog', 'Done', 'Canceled', 'Duplicate']) {
      expect(classifyState(state).released).toBe(true);
    }
  });

  it('an unknown state name is released — a denylist of one, not an allowlist', () => {
    const { released, reason } = classifyState('Some Future Column Nobody Has Named Yet');
    expect(released).toBe(true);
    expect(reason).toMatch(/denylist of one/);
  });

  it('never keys off a state `type` — only In Review and In Progress share type "started" and must diverge', () => {
    expect(classifyState('In Review').released).toBe(true);
    expect(classifyState('In Progress').released).toBe(false);
  });
});

describe('isRetryableError — transport failures only, never a definite answer', () => {
  it('does not retry a missing API key', () => {
    expect(isRetryableError(new Error('LINEAR_API_KEY is not set.'))).toBe(false);
  });

  it('does not retry a reached rate floor', () => {
    expect(
      isRetryableError(
        new Error(
          'Rate-limit floor reached: 100 requests left this hour (floor 150).\nStopped after 2400 requests.',
        ),
      ),
    ).toBe(false);
  });

  it('does not retry a query-too-complex rejection', () => {
    expect(
      isRetryableError(new Error('GraphQL query too complex (cap 10,000 points): [...]')),
    ).toBe(false);
  });

  it('does not retry a 4xx userError wrapped as GraphQL: ', () => {
    const message =
      'GraphQL: [{"message":"Authentication required, not authenticated","extensions":{"statusCode":401,"userError":true}}]';
    expect(isRetryableError(new Error(message))).toBe(false);
  });

  it('does not retry "Entity not found: Issue"', () => {
    const message =
      'GraphQL: [{"message":"Entity not found: Issue","extensions":{"statusCode":400,"userError":true}}]';
    expect(isRetryableError(new Error(message))).toBe(false);
  });

  it('retries an unwrapped transport failure, e.g. TypeError: fetch failed', () => {
    const err = new TypeError('fetch failed');
    expect(isRetryableError(err)).toBe(true);
  });
});

describe('isIssueNotFoundError — the signal that tells "not found" apart from "undetermined"', () => {
  it('is true only for the Entity not found: Issue payload', () => {
    const message =
      'GraphQL: [{"message":"Entity not found: Issue","extensions":{"statusCode":400,"userError":true}}]';
    expect(isIssueNotFoundError(new Error(message))).toBe(true);
  });

  it('is false for a different GraphQL error, e.g. an authentication failure', () => {
    const message =
      'GraphQL: [{"message":"Authentication required, not authenticated","extensions":{"statusCode":401,"userError":true}}]';
    expect(isIssueNotFoundError(new Error(message))).toBe(false);
  });

  it('is false for a non-GraphQL transport error', () => {
    expect(isIssueNotFoundError(new TypeError('fetch failed'))).toBe(false);
  });
});
