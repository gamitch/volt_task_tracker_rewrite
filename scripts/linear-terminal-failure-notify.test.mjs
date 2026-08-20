// Unit tests for scripts/linear-terminal-failure-notify.mjs -- the Slack
// ping for terminal CI failures the escalation-notify sibling does not
// cover (timeout, crash, cancellation).
//
// NO NETWORK ANYWHERE IN THIS FILE. Both I/O boundaries (`gqlImpl`,
// `postSlackImpl`) are injected in every test that reaches them.
//
// This file does NOT import fixtures from
// `scripts/linear-escalation-notify.test.mjs` (that file exports nothing).
// The escalation-shaped fixture below is defined inline, and `ESCALATED`
// classification is exercised by calling the real, imported
// `detectEscalation` against it -- so these tests still prove the real
// sibling function decides `ESCALATED`, not a reimplementation.
import { describe, expect, it, vi } from 'vitest';
import {
  classifyTerminalFailure,
  runTerminalFailureNotify,
} from './linear-terminal-failure-notify.mjs';

/** A comment whose body opens with the escalation marker, shaped like
 * `linear-escalation-notify.mjs`'s `ESCALATION_MARKER` expects. */
const ESCALATION_COMMENT = {
  body: '**Escalating per constitution item 19a** — needs the owner.',
  createdAt: '2026-08-12T14:55:49.027Z',
  url: 'https://linear.app/gamitch/issue/GAM-404#comment-esc',
};

function issueWith({ state = 'In Progress', comments = [], title, url } = {}) {
  return {
    identifier: 'GAM-404',
    title: title ?? 'Notify on every terminal failure',
    url: url ?? 'https://linear.app/gamitch/issue/GAM-404',
    state: { name: state },
    comments: { nodes: comments },
  };
}

describe('classifyTerminalFailure', () => {
  it('returns ESCALATED via the real, imported detectEscalation', () => {
    const issue = issueWith({ state: 'In Progress', comments: [ESCALATION_COMMENT] });
    expect(classifyTerminalFailure(issue, { workResult: 'failure' })).toEqual({
      shape: 'ESCALATED',
      notify: false,
    });
  });

  it('returns STRANDED for In Progress with no escalation comment, including zero comments', () => {
    const issue = issueWith({ state: 'In Progress', comments: [] });
    expect(classifyTerminalFailure(issue, {})).toEqual({ shape: 'STRANDED', notify: true });

    const nonEscalationComment = { body: 'just a status update', url: 'x' };
    const issueWithComment = issueWith({
      state: 'In Progress',
      comments: [nonEscalationComment],
    });
    expect(classifyTerminalFailure(issueWithComment, {})).toEqual({
      shape: 'STRANDED',
      notify: true,
    });
  });

  it('returns WORK_JOB_FAILURE and WORK_JOB_CANCELLED when released but the work job did not finish cleanly', () => {
    const todo = issueWith({ state: 'Todo' });
    expect(classifyTerminalFailure(todo, { workResult: 'failure' })).toEqual({
      shape: 'WORK_JOB_FAILURE',
      notify: true,
    });

    const inReview = issueWith({ state: 'In Review' });
    expect(classifyTerminalFailure(inReview, { workResult: 'cancelled' })).toEqual({
      shape: 'WORK_JOB_CANCELLED',
      notify: true,
    });
  });

  it('returns NOT_FOUND for a null issue with readFailed:false, and READ_FAILED when readFailed:true', () => {
    expect(classifyTerminalFailure(null, { readFailed: false })).toEqual({
      shape: 'NOT_FOUND',
      notify: true,
    });
    expect(classifyTerminalFailure(null, { readFailed: true })).toEqual({
      shape: 'READ_FAILED',
      notify: true,
    });
    // readFailed short-circuits ahead of everything else, even a non-null issue.
    expect(classifyTerminalFailure(issueWith({ state: 'Todo' }), { readFailed: true })).toEqual({
      shape: 'READ_FAILED',
      notify: true,
    });
  });

  it('returns ASSERT_FAILED when released, workResult is success/undefined, and assertOutcome is failure', () => {
    const inReview = issueWith({ state: 'In Review' });
    expect(
      classifyTerminalFailure(inReview, { workResult: 'success', assertOutcome: 'failure' }),
    ).toEqual({ shape: 'ASSERT_FAILED', notify: true });
    expect(
      classifyTerminalFailure(inReview, { workResult: undefined, assertOutcome: 'failure' }),
    ).toEqual({ shape: 'ASSERT_FAILED', notify: true });

    // Round 2 measured this shape too: a null state name is still "released"
    // per classifyState's denylist-of-one, so ASSERT_FAILED must fire here too.
    const nullState = { ...issueWith(), state: null };
    expect(
      classifyTerminalFailure(nullState, { workResult: 'success', assertOutcome: 'failure' }),
    ).toEqual({ shape: 'ASSERT_FAILED', notify: true });
    expect(
      classifyTerminalFailure(nullState, { workResult: undefined, assertOutcome: 'failure' }),
    ).toEqual({ shape: 'ASSERT_FAILED', notify: true });
  });

  it('returns NO_FAILURE only when released, workResult is success/undefined, and assertOutcome is not failure', () => {
    const inReview = issueWith({ state: 'In Review' });
    expect(
      classifyTerminalFailure(inReview, { workResult: 'success', assertOutcome: 'success' }),
    ).toEqual({ shape: 'NO_FAILURE', notify: false });
    expect(classifyTerminalFailure(inReview, { workResult: undefined, assertOutcome: undefined })).toEqual(
      { shape: 'NO_FAILURE', notify: false },
    );
  });
});

describe('runTerminalFailureNotify', () => {
  const gqlReturning = (issue) => vi.fn().mockResolvedValue({ data: { issue } });

  it('does not call postSlackImpl for ESCALATED or NO_FAILURE', async () => {
    const postSlackImpl = vi.fn();
    const escalated = issueWith({ state: 'In Progress', comments: [ESCALATION_COMMENT] });
    const escalatedResult = await runTerminalFailureNotify({
      identifier: 'GAM-404',
      runUrl: 'https://example/run/1',
      workResult: 'failure',
      gqlImpl: gqlReturning(escalated),
      postSlackImpl,
      log: () => {},
    });
    expect(escalatedResult).toMatchObject({ notified: false, reason: 'ESCALATED' });

    const noFailure = issueWith({ state: 'In Review' });
    const noFailureResult = await runTerminalFailureNotify({
      identifier: 'GAM-404',
      runUrl: 'https://example/run/1',
      workResult: 'success',
      assertOutcome: 'success',
      gqlImpl: gqlReturning(noFailure),
      postSlackImpl,
      log: () => {},
    });
    expect(noFailureResult).toMatchObject({ notified: false, reason: 'NO_FAILURE' });

    expect(postSlackImpl).not.toHaveBeenCalled();
  });

  it('does call postSlackImpl for STRANDED, WORK_JOB_FAILURE, ASSERT_FAILED, NOT_FOUND, and READ_FAILED', async () => {
    const cases = [
      {
        name: 'STRANDED',
        issue: issueWith({ state: 'In Progress' }),
        workResult: 'failure',
      },
      {
        name: 'WORK_JOB_FAILURE',
        issue: issueWith({ state: 'Todo' }),
        workResult: 'failure',
      },
      {
        name: 'ASSERT_FAILED',
        issue: issueWith({ state: 'In Review' }),
        workResult: 'success',
        assertOutcome: 'failure',
      },
    ];

    for (const { issue, workResult, assertOutcome } of cases) {
      const postSlackImpl = vi.fn().mockResolvedValue({ posted: true });
      const result = await runTerminalFailureNotify({
        identifier: 'GAM-404',
        title: 'payload-title-unused-when-read-succeeds',
        runUrl: 'https://example/run/1',
        workResult,
        assertOutcome,
        gqlImpl: gqlReturning(issue),
        postSlackImpl,
        log: () => {},
      });
      expect(result.notified).toBe(true);
      expect(postSlackImpl).toHaveBeenCalledTimes(1);
      const [, message] = postSlackImpl.mock.calls[0];
      expect(message.level).toBe('warn');
      expect(message.lines.join('\n')).toContain('GAM-404');
      expect(message.lines.join('\n')).toContain(issue.title);
      expect(message.lines.join('\n')).toContain('https://example/run/1');
    }

    // NOT_FOUND: a null issue.
    {
      const postSlackImpl = vi.fn().mockResolvedValue({ posted: true });
      const result = await runTerminalFailureNotify({
        identifier: 'GAM-404',
        title: 'payload title for not-found',
        runUrl: 'https://example/run/1',
        workResult: 'failure',
        gqlImpl: gqlReturning(null),
        postSlackImpl,
        log: () => {},
      });
      expect(result).toMatchObject({ notified: true, reason: 'NOT_FOUND' });
      const [, message] = postSlackImpl.mock.calls[0];
      expect(message.lines.join('\n')).toContain('GAM-404');
      // Falls back to the payload title when the read produced no issue.
      expect(message.lines.join('\n')).toContain('payload title for not-found');
      expect(message.lines.join('\n')).toContain('https://example/run/1');
    }

    // READ_FAILED: a simulated Linear-read throw for a non-not-found reason.
    {
      const postSlackImpl = vi.fn().mockResolvedValue({ posted: true });
      const result = await runTerminalFailureNotify({
        identifier: 'GAM-404',
        title: 'payload title for read-failed',
        runUrl: 'https://example/run/1',
        workResult: 'failure',
        gqlImpl: vi.fn().mockRejectedValue(new Error('LINEAR_API_KEY is not set.')),
        postSlackImpl,
        log: () => {},
      });
      expect(result).toMatchObject({ notified: true, reason: 'READ_FAILED' });
      const [, message] = postSlackImpl.mock.calls[0];
      const text = message.lines.join('\n');
      expect(text).toContain('GAM-404');
      expect(text).toContain('payload title for read-failed');
      expect(text).toContain('https://example/run/1');
      expect(text).toContain('duplicate');
    }
  });

  it('reaches NOT_FOUND from a real thrown not-found error, not only a hand-passed null', async () => {
    const notFoundError = new Error(
      'GraphQL: [{"message":"Entity not found: Issue","path":["issue"]}]',
    );
    const postSlackImpl = vi.fn().mockResolvedValue({ posted: true });
    const result = await runTerminalFailureNotify({
      identifier: 'GAM-404',
      title: 'payload title',
      runUrl: 'https://example/run/1',
      workResult: 'failure',
      gqlImpl: vi.fn().mockRejectedValue(notFoundError),
      postSlackImpl,
      log: () => {},
    });
    expect(result).toMatchObject({ notified: true, reason: 'NOT_FOUND' });
  });

  it('a Linear read failure does not prevent a Slack post', async () => {
    const postSlackImpl = vi.fn().mockResolvedValue({ posted: true });
    const result = await runTerminalFailureNotify({
      identifier: 'GAM-404',
      runUrl: 'https://example/run/1',
      workResult: 'failure',
      gqlImpl: vi.fn().mockRejectedValue(new Error('LINEAR_API_KEY is not set.')),
      postSlackImpl,
      log: () => {},
    });
    expect(result.notified).toBe(true);
    expect(postSlackImpl).toHaveBeenCalledTimes(1);
  });

  it('always resolves exitCode: 0, including when postSlackImpl throws or reports posted:false', async () => {
    const stranded = issueWith({ state: 'In Progress' });

    const throwingPost = vi.fn().mockRejectedValue(new Error('network down'));
    const throwResult = await runTerminalFailureNotify({
      identifier: 'GAM-404',
      runUrl: 'https://example/run/1',
      workResult: 'failure',
      gqlImpl: gqlReturning(stranded),
      postSlackImpl: throwingPost,
      log: () => {},
    });
    expect(throwResult).toMatchObject({ exitCode: 0, notified: false });

    const noWebhookPost = vi.fn().mockResolvedValue({ posted: false, reason: 'NO_WEBHOOK' });
    const result = await runTerminalFailureNotify({
      identifier: 'GAM-404',
      runUrl: 'https://example/run/1',
      workResult: 'failure',
      gqlImpl: gqlReturning(stranded),
      postSlackImpl: noWebhookPost,
      log: () => {},
    });
    expect(result).toMatchObject({ exitCode: 0, notified: false, reason: 'NOT_POSTED_NO_WEBHOOK' });
  });

  it('exits 0 with no identifier', async () => {
    const postSlackImpl = vi.fn();
    const result = await runTerminalFailureNotify({ postSlackImpl, log: () => {} });
    expect(result).toMatchObject({ exitCode: 0, notified: false, reason: 'NO_IDENTIFIER' });
    expect(postSlackImpl).not.toHaveBeenCalled();
  });
});
