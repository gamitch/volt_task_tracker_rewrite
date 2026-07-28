// T032: unit tests for rate_limit.ts -- MTG-06's 5/min/user short-code
// attempt limit. See the module's own header comment for the flagged
// in-memory-only limitation (not re-litigated here, just exercised).
import assert from 'node:assert/strict';
import { InMemoryRateLimiter, SHORT_CODE_RATE_LIMIT, SHORT_CODE_RATE_WINDOW_MS } from './rate_limit.ts';

Deno.test('SHORT_CODE_RATE_LIMIT / WINDOW match the documented 5/min', () => {
  assert.equal(SHORT_CODE_RATE_LIMIT, 5);
  assert.equal(SHORT_CODE_RATE_WINDOW_MS, 60_000);
});

Deno.test('allows exactly 5 attempts within the window, denies the 6th', () => {
  const limiter = new InMemoryRateLimiter();
  const key = 'user-1';
  const t0 = 1_000_000;
  for (let i = 0; i < 5; i++) {
    assert.ok(limiter.attempt(key, t0 + i), `attempt ${i + 1} should be allowed`);
  }
  assert.ok(!limiter.attempt(key, t0 + 5), 'attempt 6 should be denied');
  assert.ok(!limiter.attempt(key, t0 + 6), 'attempt 7 should also be denied');
});

Deno.test('sliding window: an attempt becomes allowed again once the oldest hit ages out', () => {
  const limiter = new InMemoryRateLimiter();
  const key = 'user-2';
  const t0 = 0;
  for (let i = 0; i < 5; i++) {
    assert.ok(limiter.attempt(key, t0 + i * 1000)); // hits at 0,1000,2000,3000,4000
  }
  assert.ok(!limiter.attempt(key, t0 + 4500), 'still within the window of all 5 prior hits');
  // 60_000ms after the FIRST hit (t=0), that hit ages out of the window.
  const justAfterFirstAgesOut = 60_001;
  assert.ok(limiter.attempt(key, justAfterFirstAgesOut), 'oldest hit should have aged out, freeing a slot');
});

Deno.test('rate limiting is scoped independently per key (per user)', () => {
  const limiter = new InMemoryRateLimiter();
  const t0 = 0;
  for (let i = 0; i < 5; i++) {
    assert.ok(limiter.attempt('user-a', t0 + i));
  }
  assert.ok(!limiter.attempt('user-a', t0 + 5), 'user-a should now be limited');
  assert.ok(limiter.attempt('user-b', t0 + 5), 'user-b has a fully independent counter');
});

Deno.test('a lower custom limit/window is respected', () => {
  const limiter = new InMemoryRateLimiter(2, 1000);
  const key = 'user-3';
  assert.ok(limiter.attempt(key, 0));
  assert.ok(limiter.attempt(key, 100));
  assert.ok(!limiter.attempt(key, 200), 'third attempt within 1s window denied for a limit of 2');
  assert.ok(limiter.attempt(key, 1001), 'window fully elapsed, allowed again');
});

Deno.test('rawCount reflects recorded (unfiltered) hits for debugging', () => {
  const limiter = new InMemoryRateLimiter();
  const key = 'user-4';
  assert.equal(limiter.rawCount(key), 0);
  limiter.attempt(key, 0);
  limiter.attempt(key, 1);
  assert.equal(limiter.rawCount(key), 2);
});
