// Unit tests for scripts/dispatch-preflight.mjs -- GAM-403.
//
// NO NETWORK ANYWHERE IN THIS FILE, AND NO REAL `git push` (packet §2.2).
// Every test that exercises `runPreflight` injects `fetchImpl` and/or
// `gitImpl` as fakes; the pure classifiers are driven directly with
// hand-built { status, body } fixtures.
import { describe, expect, it, vi } from 'vitest';
import {
  classifyCiTrigger,
  classifyIdentity,
  classifyPrCreateProbe,
  classifyRefWrite,
  classifyRepoAccess,
  evaluate,
  formatReport,
  redact,
  runPreflight,
} from './dispatch-preflight.mjs';

function jsonResponse(status, body) {
  return { status, json: async () => body };
}

// ---------------------------------------------------------------------------
// Test 0 [R2-5] -- credential-present, and no network call with an empty one.
// ---------------------------------------------------------------------------
describe('check 1 (credential present)', () => {
  it('empty PREFLIGHT_PUSH_TOKEN -> FAIL, and stage=push never calls fetch or git', async () => {
    const fetchImpl = vi.fn();
    const gitImpl = vi.fn();
    const result = await runPreflight({
      stage: 'push',
      env: { GITHUB_REPOSITORY: 'gamitch/volt_task_tracker_rewrite', PREFLIGHT_PUSH_TOKEN: '' },
      fetchImpl,
      gitImpl,
    });
    const check1 = result.checks.find((c) => c.id === 1);
    expect(check1.verdict).toBe('FAIL');
    expect(result.exitCode).toBe(1);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(gitImpl).not.toHaveBeenCalled();
    // network-dependent checks still appear, as SKIP, not omitted.
    expect(result.checks.find((c) => c.id === 2).verdict).toBe('SKIP');
    expect(result.checks.find((c) => c.id === 3).verdict).toBe('SKIP');
    expect(result.checks.find((c) => c.id === 4).verdict).toBe('SKIP');
    expect(result.checks.find((c) => c.id === 6).verdict).toBe('SKIP');
  });

  it('missing PREFLIGHT_PR_TOKEN and GH_TOKEN -> FAIL, stage=pr never calls fetch', async () => {
    const fetchImpl = vi.fn();
    const result = await runPreflight({
      stage: 'pr',
      env: { GITHUB_REPOSITORY: 'gamitch/volt_task_tracker_rewrite' },
      fetchImpl,
    });
    expect(result.checks.find((c) => c.id === 1).verdict).toBe('FAIL');
    expect(result.exitCode).toBe(1);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.checks.find((c) => c.id === 5).verdict).toBe('SKIP');
  });
});

// ---------------------------------------------------------------------------
// Test 1 -- the whole point: 422 "No commits between" -> PR-create PASS.
// ---------------------------------------------------------------------------
describe('classifyPrCreateProbe', () => {
  it('422 with a "No commits between main and main" error -> PASS (the authorized case)', () => {
    const result = classifyPrCreateProbe({
      status: 422,
      body: {
        message: 'Validation Failed',
        errors: [{ resource: 'PullRequest', code: 'custom', message: 'No commits between main and main' }],
      },
    });
    expect(result.verdict).toBe('PASS');
  });

  // Test 2
  it('403 -> FAIL, reason names the credential', () => {
    const result = classifyPrCreateProbe({
      status: 403,
      body: { message: 'Resource not accessible by personal access token' },
    });
    expect(result.verdict).toBe('FAIL');
    expect(result.reason).toMatch(/personal access token/);
  });

  it('403 from an installation token -> FAIL, reason names that credential too', () => {
    const result = classifyPrCreateProbe({
      status: 403,
      body: { message: 'Resource not accessible by integration' },
    });
    expect(result.verdict).toBe('FAIL');
    expect(result.reason).toMatch(/integration/);
  });

  // Test 3
  it('2xx -> FAIL, and the reason says a PR may have been created', () => {
    const result = classifyPrCreateProbe({ status: 201, body: { number: 999 } });
    expect(result.verdict).toBe('FAIL');
    expect(result.reason).toMatch(/may have been created/);
  });

  // Test 4
  it('a 500 / unknown status -> FAIL, not a silent pass', () => {
    const result = classifyPrCreateProbe({ status: 500, body: { message: 'Internal Server Error' } });
    expect(result.verdict).toBe('FAIL');
  });

  // Test 5 [R1-6] -- the typo'd-base false-green guard.
  it('422 whose body is the typo\'d-base shape (field:base,code:invalid) -> FAIL, reason quotes the body', () => {
    const body = {
      message: 'Validation Failed',
      errors: [
        { resource: 'PullRequest', field: 'base', code: 'invalid' },
        { resource: 'PullRequest', field: 'head', code: 'invalid' },
      ],
    };
    const result = classifyPrCreateProbe({ status: 422, body });
    expect(result.verdict).toBe('FAIL');
    expect(result.reason).toContain('invalid');
    expect(result.reason).toMatch(/base/);
  });

  it('422 with a body that is bare (no message/errors at all) -> FAIL, never a silent pass', () => {
    const result = classifyPrCreateProbe({ status: 422, body: {} });
    expect(result.verdict).toBe('FAIL');
  });
});

// ---------------------------------------------------------------------------
// Test 6 -- repo access with a mismatched full_name.
// ---------------------------------------------------------------------------
describe('classifyRepoAccess', () => {
  it('200 with matching full_name -> PASS', () => {
    const result = classifyRepoAccess({
      status: 200,
      body: { full_name: 'gamitch/volt_task_tracker_rewrite' },
      expectedRepo: 'gamitch/volt_task_tracker_rewrite',
    });
    expect(result.verdict).toBe('PASS');
  });

  it('200 with a DIFFERENT full_name -> FAIL', () => {
    const result = classifyRepoAccess({
      status: 200,
      body: { full_name: 'someone-else/some-other-repo' },
      expectedRepo: 'gamitch/volt_task_tracker_rewrite',
    });
    expect(result.verdict).toBe('FAIL');
  });

  it('non-200 -> FAIL', () => {
    const result = classifyRepoAccess({
      status: 404,
      body: { message: 'Not Found' },
      expectedRepo: 'gamitch/volt_task_tracker_rewrite',
    });
    expect(result.verdict).toBe('FAIL');
  });
});

// ---------------------------------------------------------------------------
// Test 7 -- identity 403 is a PASS (§1.2 regression guard).
// ---------------------------------------------------------------------------
describe('classifyIdentity', () => {
  it('200 -> PASS, records the login', () => {
    const result = classifyIdentity({ status: 200, body: { login: 'gamitch' } });
    expect(result.verdict).toBe('PASS');
    expect(result.credentialClass).toBe('user:gamitch');
  });

  it('403 -> PASS, recorded as an installation token, never FAIL', () => {
    const result = classifyIdentity({
      status: 403,
      body: { message: 'Resource not accessible by integration' },
    });
    expect(result.verdict).toBe('PASS');
    expect(result.credentialClass).toBe('installation token');
    expect(result.reason).toMatch(/installation token/);
  });

  it('an unrelated failure status (e.g. 401) -> FAIL, identity undetermined', () => {
    const result = classifyIdentity({ status: 401, body: { message: 'Bad credentials' } });
    expect(result.verdict).toBe('FAIL');
  });
});

// ---------------------------------------------------------------------------
// Test 8 -- CI-trigger.
// ---------------------------------------------------------------------------
describe('classifyCiTrigger', () => {
  it('push token identical to PREFLIGHT_BUILTIN_TOKEN -> FAIL', () => {
    const result = classifyCiTrigger({ pushToken: 'ghs_same', builtInToken: 'ghs_same' });
    expect(result.verdict).toBe('FAIL');
  });

  it('push token different from PREFLIGHT_BUILTIN_TOKEN -> PASS, labelled DERIVED', () => {
    const result = classifyCiTrigger({ pushToken: 'github_pat_abc', builtInToken: 'ghs_builtin' });
    expect(result.verdict).toBe('PASS');
    expect(result.derived).toBe(true);
  });

  it('PREFLIGHT_BUILTIN_TOKEN absent -> SKIP, never PASS', () => {
    const result = classifyCiTrigger({ pushToken: 'github_pat_abc', builtInToken: undefined });
    expect(result.verdict).toBe('SKIP');
    expect(result.derived).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Test 9 [R2-1] -- redact() strips ghs_/ghp_/github_pat_ values, dots and all.
// ---------------------------------------------------------------------------
describe('redact', () => {
  // JWT-shaped, matching the packet's own fixture -- a live App installation
  // token has dots in it, and a dot-free fake proves nothing about the leak
  // this test guards against.
  const GHS_FIXTURE = 'ghs_1234567_eyJhbGciOiJFUzI1NiJ9.eyJhdWQiOiJ4In0.SIGNATURE';
  const GHP_FIXTURE = 'ghp_FAKEfakeFAKEfake1234567890abcdefgh';
  const PAT_FIXTURE = 'github_pat_11ABCDEFG0abcdefghijklmnopqrstuvwxyz1234567890ABCDEFGHIJKLMNOPQR';

  function no20CharSubstringSurvives(fixture, redacted) {
    for (let i = 0; i + 20 <= fixture.length; i += 1) {
      const chunk = fixture.slice(i, i + 20);
      expect(redacted.includes(chunk)).toBe(false);
    }
  }

  it('removes a ghs_ token embedded in a longer string, no 20-char substring survives', () => {
    const text = `some prefix ${GHS_FIXTURE} some suffix`;
    const redacted = redact(text);
    no20CharSubstringSurvives(GHS_FIXTURE, redacted);
  });

  it('removes a ghs_ token embedded inside a git remote URL inside a captured git error string', () => {
    const text = `fatal: unable to access 'https://x-access-token:${GHS_FIXTURE}@github.com/gamitch/volt_task_tracker_rewrite.git/': The requested URL returned error: 403`;
    const redacted = redact(text);
    no20CharSubstringSurvives(GHS_FIXTURE, redacted);
  });

  it('removes a ghp_ token, no 20-char substring survives', () => {
    const redacted = redact(`token=${GHP_FIXTURE}`);
    no20CharSubstringSurvives(GHP_FIXTURE, redacted);
  });

  it('removes a github_pat_ token, no 20-char substring survives', () => {
    const redacted = redact(`token=${PAT_FIXTURE}`);
    no20CharSubstringSurvives(PAT_FIXTURE, redacted);
  });

  it('leaves ordinary text untouched', () => {
    expect(redact('  PASS(DERIVED)   [push:6] ci-trigger -- push credential differs')).toBe(
      '  PASS(DERIVED)   [push:6] ci-trigger -- push credential differs',
    );
  });

  it('passes undefined/null through unchanged (defensive -- callers may pass either)', () => {
    expect(redact(undefined)).toBeUndefined();
    expect(redact(null)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Test 10 -- evaluate: exit 1 on any FAIL, exit 0 when the rest is SKIP/PASS.
// ---------------------------------------------------------------------------
describe('evaluate', () => {
  it('exit 1 if any check FAILs', () => {
    const result = evaluate([{ verdict: 'PASS' }, { verdict: 'FAIL' }, { verdict: 'SKIP' }]);
    expect(result.ok).toBe(false);
    expect(result.exitCode).toBe(1);
  });

  it('exit 0 when the only non-PASS verdicts are SKIP', () => {
    const result = evaluate([{ verdict: 'PASS' }, { verdict: 'SKIP' }, { verdict: 'PASS' }]);
    expect(result.ok).toBe(true);
    expect(result.exitCode).toBe(0);
  });

  it('exit 0 for an all-PASS stage', () => {
    const result = evaluate([{ verdict: 'PASS' }, { verdict: 'PASS' }]);
    expect(result.exitCode).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// formatReport -- every check appears on both success and failure, and the
// whole thing is redacted (belt-and-suspenders with the per-value redact()
// tests above: a reason string that happens to embed a token must not
// survive into the printed report).
// ---------------------------------------------------------------------------
describe('formatReport', () => {
  it('prints every check, and redacts any token that leaked into a reason string', () => {
    const token = 'ghs_leaked_eyJhbGciOiJFUzI1NiJ9.eyJhdWQiOiJ4In0.SIGNATURE';
    const checks = [
      { id: 1, name: 'credential-present', stage: 'push', verdict: 'PASS', reason: 'ok' },
      { id: 4, name: 'ref-write', stage: 'push', verdict: 'FAIL', reason: `push failed for ${token}` },
    ];
    const report = formatReport(checks);
    expect(report).toMatch(/credential-present/);
    expect(report).toMatch(/ref-write/);
    expect(report).not.toContain(token);
    expect(report.includes(token.slice(0, 20))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// classifyRefWrite -- unit-level shape (runPreflight tests below cover the
// wiring through gitImpl).
// ---------------------------------------------------------------------------
describe('classifyRefWrite', () => {
  it('push failure -> FAIL, names ref-write not branch-create', () => {
    const result = classifyRefWrite({
      pushResult: { status: 1, stdout: '', stderr: 'fatal: Authentication failed' },
      deleteResult: undefined,
    });
    expect(result.verdict).toBe('FAIL');
    expect(result.reason).toMatch(/ref-write/);
  });

  it('push ok, delete fails -> FAIL, littered-ref reason', () => {
    const result = classifyRefWrite({
      pushResult: { status: 0, stdout: '', stderr: '' },
      deleteResult: { status: 1, stdout: '', stderr: 'fatal: could not delete' },
    });
    expect(result.verdict).toBe('FAIL');
    expect(result.reason).toMatch(/littered/);
  });

  it('push and delete both ok -> PASS', () => {
    const result = classifyRefWrite({
      pushResult: { status: 0, stdout: '', stderr: '' },
      deleteResult: { status: 0, stdout: '', stderr: '' },
    });
    expect(result.verdict).toBe('PASS');
  });
});

// ---------------------------------------------------------------------------
// runPreflight -- stage=push wiring through fakes. No network, no real git.
// ---------------------------------------------------------------------------
describe('runPreflight stage=push', () => {
  function passingFetch() {
    return vi.fn(async (url) => {
      if (String(url).endsWith('/user')) {
        return jsonResponse(403, { message: 'Resource not accessible by integration' });
      }
      return jsonResponse(200, { full_name: 'gamitch/volt_task_tracker_rewrite' });
    });
  }

  // Test 11
  it('a fake gitImpl whose delete fails -> exit 1', async () => {
    const gitImpl = vi.fn((args) => {
      if (args.includes('--delete')) return { status: 1, stdout: '', stderr: 'fatal: delete failed' };
      return { status: 0, stdout: '', stderr: '' };
    });
    const result = await runPreflight({
      stage: 'push',
      env: {
        GITHUB_REPOSITORY: 'gamitch/volt_task_tracker_rewrite',
        PREFLIGHT_PUSH_TOKEN: 'github_pat_fake',
        GITHUB_RUN_ID: '999',
      },
      fetchImpl: passingFetch(),
      gitImpl,
    });
    expect(result.exitCode).toBe(1);
    expect(result.checks.find((c) => c.id === 4).verdict).toBe('FAIL');
  });

  // Test 12 [R1-1] -- the -c guard is asserted, not assumed.
  it('both push and delete are invoked with the -c extraheader-clear flag, before the push/--delete argument', async () => {
    const gitImpl = vi.fn(() => ({ status: 0, stdout: '', stderr: '' }));
    await runPreflight({
      stage: 'push',
      env: {
        GITHUB_REPOSITORY: 'gamitch/volt_task_tracker_rewrite',
        PREFLIGHT_PUSH_TOKEN: 'github_pat_fake',
        GITHUB_RUN_ID: '999',
      },
      fetchImpl: passingFetch(),
      gitImpl,
    });

    expect(gitImpl).toHaveBeenCalledTimes(2);
    const [pushArgs, deleteArgs] = gitImpl.mock.calls.map((c) => c[0]);

    const FLAG = 'http.https://github.com/.extraheader=';
    expect(pushArgs[0]).toBe('-c');
    expect(pushArgs[1]).toBe(FLAG);
    const pushCmdIdx = pushArgs.indexOf('push');
    expect(pushCmdIdx).toBeGreaterThan(pushArgs.indexOf(FLAG));

    expect(deleteArgs[0]).toBe('-c');
    expect(deleteArgs[1]).toBe(FLAG);
    expect(deleteArgs).toContain('--delete');
    const deleteFlagIdx = deleteArgs.indexOf('--delete');
    expect(deleteFlagIdx).toBeGreaterThan(deleteArgs.indexOf(FLAG));

    // Never targets `origin` [R2-3] -- the URL is built explicitly from
    // GITHUB_REPOSITORY and the token under test.
    const pushUrl = pushArgs[pushArgs.indexOf('push') + 1];
    expect(pushUrl).not.toBe('origin');
    expect(pushUrl).toContain('github_pat_fake');
    expect(pushUrl).toContain('gamitch/volt_task_tracker_rewrite');
  });

  it('a fully healthy push stage exits 0 and reports all six push-relevant checks', async () => {
    const gitImpl = vi.fn(() => ({ status: 0, stdout: '', stderr: '' }));
    const result = await runPreflight({
      stage: 'push',
      env: {
        GITHUB_REPOSITORY: 'gamitch/volt_task_tracker_rewrite',
        PREFLIGHT_PUSH_TOKEN: 'github_pat_real',
        PREFLIGHT_BUILTIN_TOKEN: 'ghs_builtin',
        GITHUB_RUN_ID: '123',
      },
      fetchImpl: passingFetch(),
      gitImpl,
    });
    expect(result.exitCode).toBe(0);
    expect(result.checks.map((c) => c.id).sort()).toEqual([1, 2, 3, 4, 6]);
    expect(result.checks.every((c) => c.verdict === 'PASS')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// runPreflight -- stage=pr wiring through fakes.
// ---------------------------------------------------------------------------
describe('runPreflight stage=pr', () => {
  it('the authorized case end to end: 422 No-commits-between -> exit 0', async () => {
    const fetchImpl = vi.fn(async (url, opts) => {
      const u = String(url);
      if (u.endsWith('/user')) return jsonResponse(403, { message: 'Resource not accessible by integration' });
      if (opts && opts.method === 'POST') {
        return jsonResponse(422, {
          message: 'Validation Failed',
          errors: [{ message: 'No commits between main and main' }],
        });
      }
      return jsonResponse(200, { full_name: 'gamitch/volt_task_tracker_rewrite' });
    });
    const result = await runPreflight({
      stage: 'pr',
      env: { GITHUB_REPOSITORY: 'gamitch/volt_task_tracker_rewrite', GH_TOKEN: 'ghs_agent' },
      fetchImpl,
    });
    expect(result.exitCode).toBe(0);
    const prCheck = result.checks.find((c) => c.id === 5);
    expect(prCheck.verdict).toBe('PASS');
    // R1-7: the report names the credential class on the PR-create line.
    expect(prCheck.reason).toMatch(/installation token/);
  });

  it('a broken token (403 everywhere) -> exit 1, names the failing check', async () => {
    const fetchImpl = vi.fn(async (url) => {
      const u = String(url);
      if (u.endsWith('/user')) return jsonResponse(403, { message: 'Bad credentials' });
      if (u.includes('/pulls')) return jsonResponse(403, { message: 'Resource not accessible' });
      return jsonResponse(404, { message: 'Not Found' });
    });
    const result = await runPreflight({
      stage: 'pr',
      env: { GITHUB_REPOSITORY: 'gamitch/volt_task_tracker_rewrite', PREFLIGHT_PR_TOKEN: 'ghp_deadbeef' },
      fetchImpl,
    });
    expect(result.exitCode).toBe(1);
    const failing = result.checks.filter((c) => c.verdict === 'FAIL').map((c) => c.name);
    expect(failing).toContain('repo-access');
  });
});

// ---------------------------------------------------------------------------
// runPreflight -- stage=all runs both stages' checks.
// ---------------------------------------------------------------------------
describe('runPreflight stage=all', () => {
  it('runs both push and pr checks', async () => {
    const gitImpl = vi.fn(() => ({ status: 0, stdout: '', stderr: '' }));
    const fetchImpl = vi.fn(async (url) => {
      if (String(url).endsWith('/user')) return jsonResponse(200, { login: 'gamitch' });
      return jsonResponse(200, { full_name: 'gamitch/volt_task_tracker_rewrite' });
    });
    const result = await runPreflight({
      stage: 'all',
      env: {
        GITHUB_REPOSITORY: 'gamitch/volt_task_tracker_rewrite',
        PREFLIGHT_PUSH_TOKEN: 'github_pat_x',
        PREFLIGHT_PR_TOKEN: 'ghs_y',
      },
      fetchImpl,
      gitImpl,
    });
    expect(result.checks.some((c) => c.stage === 'push' && c.id === 4)).toBe(true);
    expect(result.checks.some((c) => c.stage === 'pr' && c.id === 5)).toBe(true);
  });
});

describe('runPreflight -- unknown stage', () => {
  it('an unrecognised --stage value fails rather than silently passing', async () => {
    const result = await runPreflight({ stage: 'bogus', env: {}, fetchImpl: vi.fn(), gitImpl: vi.fn() });
    expect(result.exitCode).toBe(1);
  });
});
