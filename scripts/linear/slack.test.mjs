// Unit tests for scripts/linear/slack.mjs.
//
// The one property every test here is really checking: postSlack must never
// throw and must never let a Slack-side failure escape as anything other
// than `{ posted: false, reason }`. Every caller (sync worker, gate,
// reconcile sweep) treats the tracker write as the job and the notification
// as best-effort, so this file asserts that contract directly rather than
// trusting a docstring.
//
// No real network: `fetch` is stubbed per test and restored afterward.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { postSlack } from './slack.mjs';

describe('postSlack -- no-webhook path', () => {
  it('returns { posted: false, reason: "NO_WEBHOOK" } rather than throwing when webhookUrl is falsy', async () => {
    await expect(
      postSlack(undefined, { level: 'info', title: 'test' }),
    ).resolves.toEqual({ posted: false, reason: 'NO_WEBHOOK' });
  });

  it('treats an empty string the same as undefined -- both are "no webhook configured"', async () => {
    await expect(postSlack('', { level: 'ok', title: 'test' })).resolves.toEqual({
      posted: false,
      reason: 'NO_WEBHOOK',
    });
  });

  it('never calls fetch on the no-webhook path', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await postSlack(null, { level: 'warn', title: 'test' });
    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe('postSlack -- swallows transport and HTTP failures', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('a rejected fetch (network failure) is swallowed into { posted: false }, not thrown', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('fetch failed')),
    );
    const result = await postSlack('https://hooks.slack.example/x', {
      level: 'warn',
      title: 'sync failed',
    });
    expect(result).toEqual({ posted: false, reason: 'fetch failed' });
  });

  it('a non-2xx response is swallowed into { posted: false } naming the status', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );
    const result = await postSlack('https://hooks.slack.example/x', {
      level: 'warn',
      title: 'sync failed',
    });
    expect(result).toEqual({ posted: false, reason: 'HTTP 500' });
  });

  it('an abort (timeout) is swallowed the same as any other rejection', async () => {
    const abortError = new DOMException('The operation was aborted.', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abortError));
    const result = await postSlack('https://hooks.slack.example/x', {
      level: 'info',
      title: 'test',
    });
    expect(result.posted).toBe(false);
    expect(result.reason).toMatch(/aborted/i);
  });
});

describe('postSlack -- success path and level prefixes', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns { posted: true } and posts JSON with the ok prefix on level "ok"', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchSpy);

    const result = await postSlack('https://hooks.slack.example/x', {
      level: 'ok',
      title: 'sync complete',
      lines: ['GAM-325 -> Done'],
    });

    expect(result).toEqual({ posted: true });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe('https://hooks.slack.example/x');
    expect(init.method).toBe('POST');
    const body = JSON.parse(init.body);
    expect(body.text).toContain('✅');
    expect(body.text).toContain('sync complete');
    expect(body.text).toContain('GAM-325 -> Done');
  });

  it('prefixes with ℹ️ on level "info" and ⚠️ on level "warn"', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchSpy);

    await postSlack('https://hooks.slack.example/x', { level: 'info', title: 'a' });
    expect(JSON.parse(fetchSpy.mock.calls[0][1].body).text).toContain('ℹ️');

    await postSlack('https://hooks.slack.example/x', { level: 'warn', title: 'b' });
    expect(JSON.parse(fetchSpy.mock.calls[1][1].body).text).toContain('⚠️');
  });

  it('bounds the request with an AbortSignal', async () => {
    const fetchSpy = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchSpy);

    await postSlack('https://hooks.slack.example/x', { level: 'ok', title: 'a' });

    const init = fetchSpy.mock.calls[0][1];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});
