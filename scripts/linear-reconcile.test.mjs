// Unit tests for scripts/linear-reconcile.mjs -- GAM-325 D4, the daily
// reconciliation sweep.
//
// NO NETWORK ANYWHERE IN THIS FILE (criterion 5). Every I/O boundary
// (`fetchImpl`/`listPRs`, `gqlImpl`, `postSlackImpl`, `loadParser`) is
// injected; `loadParser`'s default in a couple of tests below resolves via
// `import('./linear/declaration.mjs')`, which is a local file, not a
// network call.
import { describe, expect, it, vi } from 'vitest';
import {
  evaluateDrift,
  fetchIssueTruth,
  listRecentlyMergedPRs,
  resolveIssueTruth,
  runReconcile,
} from './linear-reconcile.mjs';

// ---------------------------------------------------------------------------
// The GAM-315 exhibit -- measured live (premise gate round 2) and
// re-confirmed by this lane against the real Linear API before writing this
// fixture (see the script's header comment for the raw numbers). History is
// newest-first; the non-state (`fromState: null, toState: null`) entries
// that appear alongside every real transition in the live response are
// included here too, so `resolveIssueTruth`'s filter is exercised against
// the shape it will actually see, not an idealised one.
// ---------------------------------------------------------------------------
const GAM_315_ISSUE = {
  identifier: 'GAM-315',
  completedAt: '2026-08-10T23:36:32.146Z',
  state: { name: 'Done' },
  history: {
    nodes: [
      { createdAt: '2026-08-11T00:47:24.360Z', fromState: null, toState: null, actor: null },
      {
        createdAt: '2026-08-11T00:47:24.148Z',
        fromState: { name: 'In Progress' },
        toState: { name: 'Done' },
        actor: { name: 'George Mitchom' },
      },
      { createdAt: '2026-08-11T00:27:44.126Z', fromState: null, toState: null, actor: null },
      {
        createdAt: '2026-08-11T00:27:43.816Z',
        fromState: { name: 'Done' },
        toState: { name: 'In Progress' },
        actor: { name: 'George Mitchom' },
      },
      { createdAt: '2026-08-10T23:36:32.322Z', fromState: null, toState: null, actor: null },
      {
        createdAt: '2026-08-10T23:36:31.815Z',
        fromState: { name: 'In Progress' },
        toState: { name: 'Done' },
        actor: { name: 'George Mitchom' },
      },
    ],
  },
};

// GAM-303, for contrast only -- NOT used to build the criterion-3 fixture
// (measured, its completedAt and its single Done transition agree to 33ms,
// so a fixture drawn from it would assert nothing; packet §4, E6).
const GAM_303_ISSUE = {
  identifier: 'GAM-303',
  completedAt: '2026-08-10T15:41:13.412Z',
  state: { name: 'Done' },
  history: {
    nodes: [
      {
        createdAt: '2026-08-10T15:41:13.379Z',
        fromState: { name: 'In Progress' },
        toState: { name: 'Done' },
        actor: { name: 'George Mitchom' },
      },
    ],
  },
};

describe('resolveIssueTruth -- criterion 3: reads history, never completedAt', () => {
  it('GAM-315: the history-derived truth disagrees with completedAt by ~1h11m -- proves history, not completedAt, drives the answer', () => {
    const truth = resolveIssueTruth(GAM_315_ISSUE);

    expect(truth.completedAt).toBe('2026-08-10T23:36:32.146Z');
    // The RE-close, not the original close -- only visible in history.
    expect(truth.trueStateSince).toBe('2026-08-11T00:47:24.148Z');
    expect(truth.trueState).toBe('Done');
    // The two fields the packet says disagree, do disagree in this fixture:
    expect(truth.trueStateSince).not.toBe(truth.completedAt);
    expect(truth.completedAtIsStale).toBe(true);
  });

  it('filters out non-state history entries (fromState/toState both null) before picking the latest transition', () => {
    const truth = resolveIssueTruth(GAM_315_ISSUE);
    // If the null-state entry at 00:47:24.360Z (newer than the real
    // transition at 00:47:24.148Z) were not filtered, trueStateSince would
    // be wrong (there is no toState to read on that entry at all) --
    // asserting the exact value already proves the filter ran, but this
    // names the intent directly for a reader who has not memorised the
    // fixture.
    expect(truth.trueStateSince).toBe('2026-08-11T00:47:24.148Z');
  });

  it('GAM-303, for contrast: completedAt and history AGREE to 33ms -- not the fixture this rule is tested against', () => {
    const truth = resolveIssueTruth(GAM_303_ISSUE);
    // "Agree" per the packet means 33ms apart, not byte-identical -- that
    // gap is ordinary write lag between two separate fields, not a
    // reopen/re-close, so it must NOT register as stale.
    const gapMs = Math.abs(new Date(truth.trueStateSince) - new Date(truth.completedAt));
    expect(gapMs).toBe(33);
    expect(truth.completedAtIsStale).toBe(false);
  });

  it('an issue currently not Done has no completedAtIsStale claim (only meaningful when trueState is Done)', () => {
    const issue = {
      completedAt: null,
      state: { name: 'In Progress' },
      history: { nodes: [{ createdAt: 't1', fromState: { name: 'Todo' }, toState: { name: 'In Progress' }, actor: null }] },
    };
    const truth = resolveIssueTruth(issue);
    expect(truth.trueState).toBe('In Progress');
    expect(truth.completedAtIsStale).toBe(false);
  });

  it('no history at all falls back to the issue\'s current state.name', () => {
    const truth = resolveIssueTruth({ completedAt: null, state: { name: 'Backlog' }, history: { nodes: [] } });
    expect(truth.trueState).toBe('Backlog');
    expect(truth.trueStateSince).toBeNull();
  });
});

describe('evaluateDrift', () => {
  const pr = { number: 200, title: 'Some PR', mergedAt: '2026-08-11T01:00:00.000Z' };
  const declaration = { ok: true, issue: 'GAM-315' };

  it('Done via history -- no drift (OK)', () => {
    const result = evaluateDrift({ pr, declaration, issueTruth: GAM_315_ISSUE });
    expect(result.drift).toBe(false);
    // GAM-315's completedAt IS stale, so this is REOPENED_AFTER_COMPLETE,
    // not OK -- both are drift:false, both are still surfaced (informational).
    expect(result.code).toBe('REOPENED_AFTER_COMPLETE');
  });

  it('a clean Done match (GAM-303 shape) reports OK', () => {
    const result = evaluateDrift({ pr, declaration: { ok: true, issue: 'GAM-303' }, issueTruth: GAM_303_ISSUE });
    expect(result).toEqual({ drift: false, code: 'OK', message: expect.stringContaining('GAM-303') });
  });

  it('not currently Done -- drift, NOT_DONE', () => {
    const issueTruth = {
      completedAt: null,
      state: { name: 'In Progress' },
      history: { nodes: [] },
    };
    const result = evaluateDrift({ pr, declaration, issueTruth });
    expect(result.drift).toBe(true);
    expect(result.code).toBe('NOT_DONE');
    expect(result.message).toMatch(/GAM-315/);
    expect(result.message).toMatch(/In Progress/);
  });

  it('issue not found in Linear at all -- drift, UNKNOWN_ISSUE', () => {
    const result = evaluateDrift({ pr, declaration, issueTruth: null });
    expect(result.drift).toBe(true);
    expect(result.code).toBe('UNKNOWN_ISSUE');
  });
});

describe('listRecentlyMergedPRs -- network-free via injected fetchImpl', () => {
  it('maps search API items and follows the Link header for pagination', async () => {
    const page1 = {
      ok: true,
      headers: { get: (name) => (name === 'link' ? '<https://api.github.com/next?page=2>; rel="next"' : null) },
      json: async () => ({
        items: [
          { number: 1, title: 'First', body: 'Closes GAM-1', html_url: 'https://x/1', pull_request: { merged_at: '2026-08-10T00:00:00Z' } },
        ],
      }),
    };
    const page2 = {
      ok: true,
      headers: { get: () => null },
      json: async () => ({
        items: [
          { number: 2, title: 'Second', body: null, html_url: 'https://x/2', pull_request: { merged_at: '2026-08-10T01:00:00Z' } },
        ],
      }),
    };
    const fetchImpl = vi.fn().mockResolvedValueOnce(page1).mockResolvedValueOnce(page2);

    const prs = await listRecentlyMergedPRs({
      repo: 'gamitch/volt_task_tracker_rewrite',
      sinceISO: '2026-08-09T00:00:00Z',
      fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(prs).toEqual([
      { number: 1, title: 'First', body: 'Closes GAM-1', htmlUrl: 'https://x/1', mergedAt: '2026-08-10T00:00:00Z' },
      { number: 2, title: 'Second', body: null, htmlUrl: 'https://x/2', mergedAt: '2026-08-10T01:00:00Z' },
    ]);
  });

  it('throws on a non-2xx response rather than silently returning an empty list', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 503 });
    await expect(
      listRecentlyMergedPRs({ repo: 'gamitch/volt_task_tracker_rewrite', sinceISO: '2026-08-09T00:00:00Z', fetchImpl }),
    ).rejects.toThrow(/HTTP 503/);
  });

  it('requires a repo', async () => {
    await expect(listRecentlyMergedPRs({ repo: undefined, sinceISO: 'x', fetchImpl: vi.fn() })).rejects.toThrow(/repo is required/);
  });
});

describe('fetchIssueTruth -- network-free via injected gqlImpl', () => {
  it('returns the issue node from the injected gql result', async () => {
    const gqlImpl = vi.fn().mockResolvedValue({ data: { issue: GAM_315_ISSUE } });
    const issue = await fetchIssueTruth('GAM-315', { gqlImpl });
    expect(issue).toBe(GAM_315_ISSUE);
    expect(gqlImpl).toHaveBeenCalledWith(expect.stringContaining('history'), { id: 'GAM-315' });
  });

  it('returns null when Linear has no such issue', async () => {
    const gqlImpl = vi.fn().mockResolvedValue({ data: { issue: null } });
    expect(await fetchIssueTruth('GAM-999999', { gqlImpl })).toBeNull();
  });
});

describe('runReconcile -- read-only, exits 0 even when drift is found', () => {
  it('exits 0 and reports drift for a declared PR whose issue is not Done (the NON_MAIN_BASE-surfaced case)', async () => {
    const listPRs = vi.fn().mockResolvedValue([
      { number: 10, title: 'Stacked child', body: 'Closes GAM-500', mergedAt: '2026-08-10T12:00:00Z' },
    ]);
    const gqlImpl = vi.fn().mockResolvedValue({
      data: { issue: { completedAt: null, state: { name: 'In Progress' }, history: { nodes: [] } } },
    });
    const postSlackImpl = vi.fn().mockResolvedValue({ posted: true });

    const result = await runReconcile({
      env: { GITHUB_REPOSITORY: 'gamitch/volt_task_tracker_rewrite' },
      listPRs,
      gqlImpl,
      postSlackImpl,
      log: { error: vi.fn(), log: vi.fn() },
    });

    expect(result.exitCode).toBe(0);
    expect(result.drifted).toBe(1);
    expect(result.checked).toBe(1);
    expect(postSlackImpl).toHaveBeenCalledTimes(1);
    const [, message] = postSlackImpl.mock.calls[0];
    expect(message.level).toBe('warn');
    expect(message.lines.join('\n')).toMatch(/GAM-500/);
  });

  it('exits 0 with zero drift when nothing was declared in the window', async () => {
    const listPRs = vi.fn().mockResolvedValue([{ number: 11, title: 'No declaration', body: 'chore: bump deps', mergedAt: '2026-08-10T12:00:00Z' }]);
    const postSlackImpl = vi.fn().mockResolvedValue({ posted: true });

    const result = await runReconcile({
      env: { GITHUB_REPOSITORY: 'gamitch/volt_task_tracker_rewrite' },
      listPRs,
      postSlackImpl,
      log: { error: vi.fn(), log: vi.fn() },
    });

    expect(result.exitCode).toBe(0);
    expect(result.checked).toBe(0);
    expect(result.drifted).toBe(0);
  });

  it('never calls gqlImpl for a PR with no canonical declaration (nothing to check)', async () => {
    const listPRs = vi.fn().mockResolvedValue([{ number: 12, title: 'x', body: 'This PR does not close GAM-1', mergedAt: 't' }]);
    const gqlImpl = vi.fn();
    await runReconcile({
      env: { GITHUB_REPOSITORY: 'gamitch/volt_task_tracker_rewrite' },
      listPRs,
      gqlImpl,
      postSlackImpl: vi.fn().mockResolvedValue({ posted: true }),
      log: { error: vi.fn(), log: vi.fn() },
    });
    expect(gqlImpl).not.toHaveBeenCalled();
  });

  it('never calls fetch/listPRs when GITHUB_REPOSITORY is unset, and still exits 0', async () => {
    const listPRs = vi.fn();
    const result = await runReconcile({
      env: {},
      listPRs,
      postSlackImpl: vi.fn().mockResolvedValue({ posted: true }),
      log: { error: vi.fn(), log: vi.fn() },
    });
    expect(listPRs).not.toHaveBeenCalled();
    expect(result.exitCode).toBe(0);
    expect(result.checked).toBe(0);
  });

  it('exits 1 only when the run itself fails to complete (e.g. listPRs throws)', async () => {
    const listPRs = vi.fn().mockRejectedValue(new Error('GitHub API down'));
    const result = await runReconcile({
      env: { GITHUB_REPOSITORY: 'gamitch/volt_task_tracker_rewrite' },
      listPRs,
      postSlackImpl: vi.fn(),
      log: { error: vi.fn(), log: vi.fn() },
    });
    expect(result.exitCode).toBe(1);
    expect(result.error).toBe(true);
  });

  it('a Slack post failure never changes the exit code -- the tracker read is the job, not the notification', async () => {
    const listPRs = vi.fn().mockResolvedValue([]);
    const postSlackImpl = vi.fn().mockResolvedValue({ posted: false, reason: 'NO_WEBHOOK' });
    const result = await runReconcile({
      env: { GITHUB_REPOSITORY: 'gamitch/volt_task_tracker_rewrite' },
      listPRs,
      postSlackImpl,
      log: { error: vi.fn(), log: vi.fn() },
    });
    expect(result.exitCode).toBe(0);
  });

  it('writes nothing to Linear -- gqlImpl is only ever called with the read-only history query, never a mutation', async () => {
    const listPRs = vi.fn().mockResolvedValue([{ number: 13, title: 'x', body: 'Closes GAM-315', mergedAt: 't' }]);
    const gqlImpl = vi.fn().mockResolvedValue({ data: { issue: GAM_315_ISSUE } });
    await runReconcile({
      env: { GITHUB_REPOSITORY: 'gamitch/volt_task_tracker_rewrite' },
      listPRs,
      gqlImpl,
      postSlackImpl: vi.fn().mockResolvedValue({ posted: true }),
      log: { error: vi.fn(), log: vi.fn() },
    });
    for (const call of gqlImpl.mock.calls) {
      expect(call[0]).not.toMatch(/mutation/i);
      expect(call[0]).not.toMatch(/issueUpdate/i);
    }
  });
});
