// Unit tests for scripts/linear-escalation-notify.mjs -- the Slack ping that
// tells the human owner a run escalated something to them.
//
// NO NETWORK ANYWHERE IN THIS FILE. Both I/O boundaries (`gqlImpl`,
// `postSlackImpl`) are injected in every test that reaches them.
//
// The fixtures below are the real GAM-301 shapes, not idealised ones: that
// issue carries a genuine item-19a escalation comment AND, two minutes later,
// a retraction comment that mentions "escalation" five times. The pair is the
// whole reason detection keys off the newest comment's opening rather than
// scanning bodies for /escalat/i, so both are exercised here.
import { describe, expect, it, vi } from 'vitest';
import {
  buildExcerpt,
  detectEscalation,
  runEscalationNotify,
} from './linear-escalation-notify.mjs';

/** GAM-301's real escalation comment, opening preserved verbatim. */
const ESCALATION_COMMENT = {
  body:
    '**Escalating per constitution item 19a — the premise gate’s two-round cap is ' +
    'reached, and round 2 still returned REVISE.** Not looping to a round 3; this needs ' +
    'the human owner (or `boss-architect`) to pick a direction.',
  createdAt: '2026-08-12T14:55:49.027Z',
  url: 'https://linear.app/gamitch/issue/GAM-301#comment-58713e76',
};

/** GAM-301's real retraction comment -- the false-positive trap. */
const RETRACTION_COMMENT = {
  body:
    '> ## ⚠️ RETRACTED — this call is wrong. Do not implement it.\n>\n> Posted 14:57, ' +
    'two minutes after the item-19a escalation above, without reading it first. The ' +
    'escalation had already **measured** the opposite, and it is right.',
  createdAt: '2026-08-12T14:57:46.829Z',
  url: 'https://linear.app/gamitch/issue/GAM-301#comment-d2797134',
};

/** `comments(orderBy: createdAt)` returns oldest-first. */
function issueWith(comments, { state = 'In Progress' } = {}) {
  return {
    identifier: 'GAM-301',
    title: 'T407 — The Outreach nav badge is a hardcoded `0`',
    url: 'https://linear.app/gamitch/issue/GAM-301',
    state: { name: state },
    comments: { nodes: comments },
  };
}

describe('detectEscalation', () => {
  it('fires when the newest comment opens with the escalation marker', () => {
    const verdict = detectEscalation(issueWith([ESCALATION_COMMENT]));
    expect(verdict.escalated).toBe(true);
    expect(verdict.reason).toBe('ESCALATED');
    expect(verdict.commentUrl).toBe(ESCALATION_COMMENT.url);
    expect(verdict.excerpt).toContain('Escalating per constitution item 19a');
  });

  it('does NOT fire when a later comment has answered the escalation', () => {
    // The real GAM-301 timeline. An escalation that has been replied to is
    // resolved by definition; re-pinging it trains the owner to ignore Slack.
    const verdict = detectEscalation(issueWith([ESCALATION_COMMENT, RETRACTION_COMMENT]));
    expect(verdict.escalated).toBe(false);
    expect(verdict.reason).toBe('NEWEST_COMMENT_NOT_AN_ESCALATION');
  });

  it('does NOT fire on prose that merely discusses an escalation', () => {
    // RETRACTION_COMMENT contains "escalation" repeatedly. A loose
    // /escalat/i scan over bodies would fire on it; the opening-marker rule
    // must not.
    expect(detectEscalation(issueWith([RETRACTION_COMMENT])).escalated).toBe(false);
  });

  it('does NOT fire on a comment that opens by quoting an escalation', () => {
    const quoting = {
      body: '> **Escalating per constitution item 19a** — answering this now: go with option B.',
      createdAt: '2026-08-12T15:10:00.000Z',
      url: 'https://linear.app/gamitch/issue/GAM-301#comment-quote',
    };
    expect(detectEscalation(issueWith([quoting])).escalated).toBe(false);
  });

  it('does not fire unless the issue is still In Progress', () => {
    const verdict = detectEscalation(issueWith([ESCALATION_COMMENT], { state: 'Done' }));
    expect(verdict.escalated).toBe(false);
    expect(verdict.reason).toBe('STATE_DONE');
  });

  it('handles an issue with no comments, and a missing issue', () => {
    expect(detectEscalation(issueWith([])).reason).toBe('NO_COMMENTS');
    expect(detectEscalation(null).reason).toBe('ISSUE_NOT_FOUND');
  });
});

describe('buildExcerpt', () => {
  it('flattens whitespace and strips bold markers', () => {
    expect(buildExcerpt('**Escalating**\n\nper   item 19a')).toBe('Escalating per item 19a');
  });

  it('truncates with an ellipsis past the limit', () => {
    const out = buildExcerpt('x'.repeat(400), 20);
    expect(out).toHaveLength(21);
    expect(out.endsWith('…')).toBe(true);
  });
});

describe('runEscalationNotify', () => {
  const gqlReturning = (issue) => vi.fn().mockResolvedValue({ data: { issue } });

  it('posts a warn-level Slack message naming the issue and what is needed', async () => {
    const postSlackImpl = vi.fn().mockResolvedValue({ posted: true });
    const result = await runEscalationNotify({
      identifier: 'GAM-301',
      env: { SLACK_WEBHOOK_URL: 'https://hooks.example/abc' },
      gqlImpl: gqlReturning(issueWith([ESCALATION_COMMENT])),
      postSlackImpl,
      log: () => {},
    });

    expect(result).toMatchObject({ exitCode: 0, notified: true, reason: 'ESCALATED' });
    expect(postSlackImpl).toHaveBeenCalledTimes(1);

    const [webhook, message] = postSlackImpl.mock.calls[0];
    expect(webhook).toBe('https://hooks.example/abc');
    expect(message.level).toBe('warn');
    expect(message.title).toBe('GAM-301 escalated to you — needs your comment');
    expect(message.lines.join('\n')).toContain('waiting on your comment');
    expect(message.lines.join('\n')).toContain(ESCALATION_COMMENT.url);
  });

  it('stays silent when the newest comment is not an escalation', async () => {
    const postSlackImpl = vi.fn();
    const result = await runEscalationNotify({
      identifier: 'GAM-301',
      env: { SLACK_WEBHOOK_URL: 'https://hooks.example/abc' },
      gqlImpl: gqlReturning(issueWith([ESCALATION_COMMENT, RETRACTION_COMMENT])),
      postSlackImpl,
      log: () => {},
    });

    expect(result.notified).toBe(false);
    expect(postSlackImpl).not.toHaveBeenCalled();
  });

  it('exits 0 when Linear cannot be read -- never a second red cause', async () => {
    const result = await runEscalationNotify({
      identifier: 'GAM-301',
      env: {},
      gqlImpl: vi.fn().mockRejectedValue(new Error('LINEAR_API_KEY is not set.')),
      postSlackImpl: vi.fn(),
      log: () => {},
    });
    expect(result).toMatchObject({ exitCode: 0, notified: false, reason: 'READ_FAILED' });
  });

  it('exits 0 and reports when the webhook is not configured', async () => {
    // slack.mjs returns {posted:false, reason:'NO_WEBHOOK'} rather than
    // throwing when SLACK_WEBHOOK_URL is absent -- an owner action that may
    // not have been taken yet must stay the quiet path.
    const result = await runEscalationNotify({
      identifier: 'GAM-301',
      env: {},
      gqlImpl: gqlReturning(issueWith([ESCALATION_COMMENT])),
      postSlackImpl: vi.fn().mockResolvedValue({ posted: false, reason: 'NO_WEBHOOK' }),
      log: () => {},
    });
    expect(result).toMatchObject({ exitCode: 0, notified: false, reason: 'NOT_POSTED_NO_WEBHOOK' });
  });

  it('exits 0 with no identifier', async () => {
    const postSlackImpl = vi.fn();
    const result = await runEscalationNotify({ postSlackImpl, log: () => {} });
    expect(result).toMatchObject({ exitCode: 0, notified: false, reason: 'NO_IDENTIFIER' });
    expect(postSlackImpl).not.toHaveBeenCalled();
  });
});
