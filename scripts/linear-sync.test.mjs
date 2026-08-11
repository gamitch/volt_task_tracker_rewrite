// Unit tests for scripts/linear-sync.mjs (GAM-325 §3). Every test here drives
// the script's exported PURE functions -- no network call anywhere in this
// file (AC7). `decide()` is tested with one named case per row of §3's
// behaviour table, asserting the exact code string, so a reviewer can check
// this file against the packet's table row by row rather than trust a
// paraphrase.
import { describe, expect, it } from 'vitest';
import {
  CLAIM_MARKER_RE,
  SyncTimeoutError,
  buildClaimComment,
  buildClosedWithoutMergeComment,
  buildUnexpectedStateComment,
  decide,
  evaluateShadowRun,
  extractClaims,
  fetchWithTimeout,
  filterStateChanges,
  hasIncumbentMergeToDone,
  parseClaimMarker,
  reconstructAutomationTransition,
  resolvePrNumber,
  resolveSyncMode,
} from './linear-sync.mjs';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function pr(overrides = {}) {
  return {
    number: 158,
    body: 'Closes GAM-325',
    merged: true,
    merged_at: '2026-08-11T12:00:00.000Z',
    base: { ref: 'main' },
    head: { ref: 'claude/gam-325-linear-closer' },
    merge_commit_sha: 'abc1234567',
    ...overrides,
  };
}

function issue(overrides = {}) {
  return {
    id: 'issue-uuid-1',
    state: { name: 'In Progress' },
    archivedAt: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// decide() -- one named test per row of §3's behaviour table
// ---------------------------------------------------------------------------

describe('decide() -- the behaviour table', () => {
  it('NON_MAIN_BASE -- base is not main, no action, checked before anything else', () => {
    const result = decide({ pr: pr({ base: { ref: 'develop' } }), issue: null, claims: [] });
    expect(result.code).toBe('NON_MAIN_BASE');
    expect(result.action).toBe('none');
  });

  it('CLOSED_WITHOUT_MERGE, declared -- audit-comment only, no state move', () => {
    const result = decide({
      pr: pr({ merged: false, body: 'Closes GAM-325' }),
      issue: null,
      claims: [],
    });
    expect(result.code).toBe('CLOSED_WITHOUT_MERGE');
    expect(result.action).toBe('audit-comment');
    expect(result.issue).toBe('GAM-325');
    expect(result.slackLevel).toBe('info');
  });

  it('CLOSED_WITHOUT_MERGE, no declaration -- no action at all', () => {
    const result = decide({
      pr: pr({ merged: false, body: 'just some notes' }),
      issue: null,
      claims: [],
    });
    expect(result.code).toBe('CLOSED_WITHOUT_MERGE');
    expect(result.action).toBe('none');
    expect(result.issue).toBeNull();
  });

  it('NO_DECLARATION -- merged, no line-1 declaration, skip info', () => {
    const result = decide({ pr: pr({ body: 'See GAM-325 for context.' }), issue: null, claims: [] });
    expect(result.code).toBe('NO_DECLARATION');
    expect(result.slackCode).toBe('NO_DECLARATION');
    expect(result.action).toBe('none');
    expect(result.slackLevel).toBe('info');
  });

  it('AMBIGUOUS_DECLARATION -- two identifiers on line 1, no move made for either', () => {
    const result = decide({
      pr: pr({ body: 'Closes GAM-325 and GAM-326' }),
      issue: null,
      claims: [],
    });
    expect(result.code).toBe('AMBIGUOUS_DECLARATION');
    expect(result.slackCode).toBe('AMBIGUOUS_DECLARATION');
    expect(result.action).toBe('none');
  });

  it('HALF_DECLARATION -- reported as AMBIGUOUS_DECLARATION on the Slack line, specific code in the log', () => {
    const result = decide({ pr: pr({ body: 'Fixes GAM-1' }), issue: null, claims: [] });
    expect(result.code).toBe('HALF_DECLARATION');
    expect(result.slackCode).toBe('AMBIGUOUS_DECLARATION');
    expect(result.action).toBe('none');
  });

  it('PLACEHOLDER -- GAM-000, reported as AMBIGUOUS_DECLARATION on the Slack line, specific code in the log', () => {
    const result = decide({ pr: pr({ body: 'Closes GAM-000' }), issue: null, claims: [] });
    expect(result.code).toBe('PLACEHOLDER');
    expect(result.slackCode).toBe('AMBIGUOUS_DECLARATION');
    expect(result.action).toBe('none');
  });

  it('DECLARATION_MISMATCH -- branch names a different issue than the body declares', () => {
    const result = decide({
      pr: pr({ body: 'Closes GAM-325', head: { ref: 'claude/gam-131-foo' } }),
      issue: null,
      claims: [],
    });
    expect(result.code).toBe('DECLARATION_MISMATCH');
    expect(result.action).toBe('none');
  });

  it('branch with no identifier passes the consistency check untouched (mention/infra PRs)', () => {
    const result = decide({
      pr: pr({ body: 'Closes GAM-325', head: { ref: 'claude/some-slug' } }),
      issue: issue(),
      claims: [],
    });
    expect(result.code).not.toBe('DECLARATION_MISMATCH');
  });

  it('UNKNOWN_ISSUE -- valid declaration but the issue does not exist in Linear', () => {
    const result = decide({ pr: pr(), issue: null, claims: [] });
    expect(result.code).toBe('UNKNOWN_ISSUE');
    expect(result.action).toBe('none');
    expect(result.issue).toBe('GAM-325');
  });

  it('ARCHIVED, info -- archivedAt set and state is Done', () => {
    const result = decide({
      pr: pr(),
      issue: issue({ archivedAt: '2026-08-01T00:00:00Z', state: { name: 'Done' } }),
      claims: [],
    });
    expect(result.code).toBe('ARCHIVED');
    expect(result.slackLevel).toBe('info');
    expect(result.action).toBe('none');
  });

  it('ARCHIVED, warn -- archivedAt set and state is not Done', () => {
    const result = decide({
      pr: pr(),
      issue: issue({ archivedAt: '2026-08-01T00:00:00Z', state: { name: 'Backlog' } }),
      claims: [],
    });
    expect(result.code).toBe('ARCHIVED');
    expect(result.slackLevel).toBe('warn');
    expect(result.action).toBe('none');
  });

  it('ALREADY_DONE -- Done, claim comment from this PR exists (benign re-delivery)', () => {
    const result = decide({
      pr: pr({ number: 158 }),
      issue: issue({ state: { name: 'Done' } }),
      claims: [{ pr: 158, run: '31358757094' }],
    });
    expect(result.code).toBe('ALREADY_DONE');
    expect(result.action).toBe('none');
    expect(result.slackLevel).toBe('info');
  });

  it('DUPLICATE_CLOSE_CLAIM -- Done, no claim from this PR', () => {
    const result = decide({
      pr: pr({ number: 158 }),
      issue: issue({ state: { name: 'Done' } }),
      claims: [{ pr: 159, run: '31358757099' }],
    });
    expect(result.code).toBe('DUPLICATE_CLOSE_CLAIM');
    expect(result.action).toBe('none');
    expect(result.slackLevel).toBe('warn');
  });

  it('DUPLICATE_CLOSE_CLAIM -- Done, no claim at all', () => {
    const result = decide({
      pr: pr({ number: 158 }),
      issue: issue({ state: { name: 'Done' } }),
      claims: [],
    });
    expect(result.code).toBe('DUPLICATE_CLOSE_CLAIM');
  });

  it('the act row -- issue in In Progress, no claims: claim, close, read back', () => {
    const result = decide({
      pr: pr({ number: 158 }),
      issue: issue({ state: { name: 'In Progress' } }),
      claims: [],
    });
    expect(result.code).toBe('CLOSE');
    expect(result.action).toBe('close');
    expect(result.resumed).toBe(false);
  });

  it('the act row -- issue in In Review, no claims: claim, close, read back', () => {
    const result = decide({
      pr: pr({ number: 158 }),
      issue: issue({ state: { name: 'In Review' } }),
      claims: [],
    });
    expect(result.code).toBe('CLOSE');
    expect(result.action).toBe('close');
  });

  it('RESUME_CLOSE -- a claim from THIS PR already exists and the issue is not yet Done: its own claim is not an obstacle', () => {
    const result = decide({
      pr: pr({ number: 158 }),
      issue: issue({ state: { name: 'In Review' } }),
      claims: [{ pr: 158, run: '31358757094' }],
    });
    expect(result.code).toBe('RESUME_CLOSE');
    expect(result.action).toBe('close');
    expect(result.resumed).toBe(true);
  });

  it('STALE_CLAIM -- a claim from a DIFFERENT PR exists and the issue is not yet Done: no move, names the stale PR and run', () => {
    const result = decide({
      pr: pr({ number: 158 }),
      issue: issue({ state: { name: 'In Progress' } }),
      claims: [{ pr: 999, run: '31358757000' }],
    });
    expect(result.code).toBe('STALE_CLAIM');
    expect(result.action).toBe('none');
    expect(result.stale).toEqual({ pr: 999, run: '31358757000' });
  });

  it('UNEXPECTED_STATE -- any other state, no move, audit comment, Slack warn', () => {
    const result = decide({
      pr: pr({ number: 158 }),
      issue: issue({ state: { name: 'Backlog' } }),
      claims: [],
    });
    expect(result.code).toBe('UNEXPECTED_STATE');
    expect(result.action).toBe('audit-comment');
    expect(result.slackLevel).toBe('warn');
  });

  it('UNEXPECTED_STATE -- Canceled is also "any other state"', () => {
    const result = decide({
      pr: pr({ number: 158 }),
      issue: issue({ state: { name: 'Canceled' } }),
      claims: [],
    });
    expect(result.code).toBe('UNEXPECTED_STATE');
  });
});

// ---------------------------------------------------------------------------
// SYNC_MODE -- fail toward shadow
// ---------------------------------------------------------------------------

describe('resolveSyncMode -- fail toward shadow (AC2)', () => {
  it('unset resolves to shadow', () => {
    expect(resolveSyncMode({})).toBe('shadow');
  });

  it('SYNC_MODE=shadow resolves to shadow', () => {
    expect(resolveSyncMode({ SYNC_MODE: 'shadow' })).toBe('shadow');
  });

  it('SYNC_MODE=Live (wrong case) resolves to shadow -- only the exact string "live" is live', () => {
    expect(resolveSyncMode({ SYNC_MODE: 'Live' })).toBe('shadow');
  });

  it('SYNC_MODE=garbage resolves to shadow', () => {
    expect(resolveSyncMode({ SYNC_MODE: 'garbage' })).toBe('shadow');
  });

  it('SYNC_MODE=live (exact) resolves to live', () => {
    expect(resolveSyncMode({ SYNC_MODE: 'live' })).toBe('live');
  });
});

// ---------------------------------------------------------------------------
// Shadow reconstruction -- fixture built from the GAM-303 probe's printed
// response (pasted verbatim in the worker's report). History is asserted
// newest-first; entries with fromState:null, toState:null are non-state
// edits and must be filtered out.
// ---------------------------------------------------------------------------

// Verbatim from the live probe:
//   query { issues(filter:{number:{eq:303}, team:{key:{eq:"GAM"}}}, first:1) {
//     nodes { id identifier completedAt history(first:50) {
//       nodes { createdAt fromState{name} toState{name} actor{name} } } } } }
const GAM_303_HISTORY_PROBE = [
  {
    createdAt: '2026-08-11T14:53:33.940Z',
    fromState: null,
    toState: null,
    actor: { name: 'George Mitchom' },
  },
  {
    createdAt: '2026-08-09T15:44:06.176Z',
    fromState: null,
    toState: null,
    actor: { name: 'George Mitchom' },
  },
  {
    createdAt: '2026-08-09T15:41:13.379Z',
    fromState: { name: 'In Progress' },
    toState: { name: 'Done' },
    actor: { name: 'George Mitchom' },
  },
  {
    createdAt: '2026-08-09T15:38:55.013Z',
    fromState: { name: 'In Review' },
    toState: { name: 'In Progress' },
    actor: { name: 'George Mitchom' },
  },
  {
    createdAt: '2026-08-09T15:38:55.013Z',
    fromState: null,
    toState: null,
    actor: { name: 'George Mitchom' },
  },
  {
    createdAt: '2026-08-09T15:38:55.013Z',
    fromState: null,
    toState: null,
    actor: { name: 'George Mitchom' },
  },
  {
    createdAt: '2026-08-09T15:30:19.848Z',
    fromState: { name: 'In Progress' },
    toState: { name: 'In Review' },
    actor: { name: 'George Mitchom' },
  },
  {
    createdAt: '2026-08-09T15:29:40.728Z',
    fromState: null,
    toState: null,
    actor: { name: 'George Mitchom' },
  },
  {
    createdAt: '2026-08-09T15:13:10.427Z',
    fromState: { name: 'Backlog' },
    toState: { name: 'In Progress' },
    actor: { name: 'George Mitchom' },
  },
];

describe('filterStateChanges -- drops fromState:null/toState:null non-state edits', () => {
  it('keeps only the four real transitions out of the nine raw GAM-303 probe entries', () => {
    // Raw probe: 9 nodes total, 5 of them fromState:null/toState:null
    // (non-state edits -- comments, label changes, etc.), 4 real state
    // transitions: Backlog->In Progress, In Progress->In Review,
    // In Review->In Progress, In Progress->Done.
    const kept = filterStateChanges(GAM_303_HISTORY_PROBE);
    expect(kept).toHaveLength(4);
    expect(kept.every((n) => n.fromState !== null && n.toState !== null)).toBe(true);
  });
});

describe('reconstructAutomationTransition -- AC3, fixture from the GAM-303 probe', () => {
  it('picks the pre-automation state (In Progress) for a merge coincident with the Done transition', () => {
    // The probe's Done transition is at 15:41:13.379Z; a merge 500ms later
    // is well inside the 120s window and is the only toState:"Done" entry.
    const mergedAt = '2026-08-09T15:41:13.879Z';
    const match = reconstructAutomationTransition(GAM_303_HISTORY_PROBE, mergedAt);
    expect(match).not.toBeNull();
    expect(match.fromState.name).toBe('In Progress');
    expect(match.toState.name).toBe('Done');
  });

  it('returns null when no toState:"Done" transition falls inside the window', () => {
    const mergedAt = '2026-08-09T15:30:19.848Z'; // coincides with In Progress -> In Review, not -> Done
    const match = reconstructAutomationTransition(GAM_303_HISTORY_PROBE, mergedAt);
    expect(match).toBeNull();
  });

  it('a synthetic fixture: a null/null entry positioned inside the window, closer to mergedAt than the real Done transition, is never picked -- proves the filter runs before the window match, not just that the real case happens to fall outside it', () => {
    const synthetic = [
      // Closer in time to mergedAt than the real transition below, and would
      // win a naive nearest-timestamp search -- but it is not a state change
      // at all and must never be returned.
      { createdAt: '2026-08-09T15:41:14.000Z', fromState: null, toState: null, actor: { name: 'x' } },
      {
        createdAt: '2026-08-09T15:41:10.000Z',
        fromState: { name: 'In Progress' },
        toState: { name: 'Done' },
        actor: { name: 'x' },
      },
    ];
    const mergedAt = '2026-08-09T15:41:13.379Z';
    const match = reconstructAutomationTransition(synthetic, mergedAt);
    expect(match).not.toBeNull();
    expect(match.fromState.name).toBe('In Progress');
    expect(match.toState.name).toBe('Done');
  });
});

// ---------------------------------------------------------------------------
// The incumbent assertion (F2 / AC3a)
// ---------------------------------------------------------------------------

describe('hasIncumbentMergeToDone', () => {
  it('true when a merge -> Done gitAutomationStates entry is present (live-measured shape)', () => {
    // Shape confirmed live: { event, targetBranch, state{ name type } }.
    const nodes = [{ event: 'merge', targetBranch: null, state: { name: 'Done', type: 'completed' } }];
    expect(hasIncumbentMergeToDone(nodes)).toBe(true);
  });

  it('false when the automation list is empty', () => {
    expect(hasIncumbentMergeToDone([])).toBe(false);
  });

  it('false when merge exists but targets a different state', () => {
    const nodes = [{ event: 'merge', targetBranch: null, state: { name: 'Canceled', type: 'canceled' } }];
    expect(hasIncumbentMergeToDone(nodes)).toBe(false);
  });

  it('false when only start/review automations are present, no merge', () => {
    const nodes = [
      { event: 'start', targetBranch: null, state: { name: 'In Progress', type: 'started' } },
      { event: 'review', targetBranch: null, state: { name: 'In Review', type: 'started' } },
    ];
    expect(hasIncumbentMergeToDone(nodes)).toBe(false);
  });
});

describe('evaluateShadowRun -- INCUMBENT_DISABLED voids the comparison (AC3a)', () => {
  it('INCUMBENT_DISABLED when the automation is not present -- emits neither MATCH nor MISMATCH', () => {
    const result = evaluateShadowRun({
      incumbentEnabled: false,
      intendedWouldClose: true,
      automationTransition: null,
    });
    expect(result.code).toBe('INCUMBENT_DISABLED');
    expect(result.void).toBe(true);
    expect(result.code).not.toBe('MATCH');
    expect(result.code).not.toBe('MISMATCH');
  });

  it('MATCH when the incumbent is enabled and intended/observed agree (both close)', () => {
    const result = evaluateShadowRun({
      incumbentEnabled: true,
      intendedWouldClose: true,
      automationTransition: { fromState: { name: 'In Progress' }, toState: { name: 'Done' } },
    });
    expect(result.code).toBe('MATCH');
    expect(result.void).toBe(false);
  });

  it('MATCH when the incumbent is enabled and intended/observed agree (neither closes)', () => {
    const result = evaluateShadowRun({
      incumbentEnabled: true,
      intendedWouldClose: false,
      automationTransition: null,
    });
    expect(result.code).toBe('MATCH');
  });

  it('MISMATCH when the incumbent is enabled and intended/observed disagree', () => {
    const result = evaluateShadowRun({
      incumbentEnabled: true,
      intendedWouldClose: true,
      automationTransition: null,
    });
    expect(result.code).toBe('MISMATCH');
    expect(result.void).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Claim detection (AC5)
// ---------------------------------------------------------------------------

describe('claim marker detection', () => {
  it('CLAIM_MARKER_RE matches the exact shape from §3', () => {
    const body = '<!-- linear-sync:claim pr=158 run=31358757094 -->\nrest of the comment';
    expect(CLAIM_MARKER_RE.test(body)).toBe(true);
  });

  it('parseClaimMarker reads pr and run from the marker, never from prose', () => {
    const body =
      '<!-- linear-sync:claim pr=158 run=31358757094 -->\n' +
      '**Closed by [#158](https://x) on merge** — `abc1234` → `Done`.';
    expect(parseClaimMarker(body)).toEqual({ pr: 158, run: '31358757094' });
  });

  it('a comment that only mentions closing in prose, with no marker, does not parse as a claim', () => {
    const body = 'PR #158 closed GAM-325 on merge, run 31358757094.';
    expect(parseClaimMarker(body)).toBeNull();
  });

  it('distinguishes pr=158 from pr=159', () => {
    const claim158 = parseClaimMarker('<!-- linear-sync:claim pr=158 run=1 -->');
    const claim159 = parseClaimMarker('<!-- linear-sync:claim pr=159 run=2 -->');
    expect(claim158.pr).toBe(158);
    expect(claim159.pr).toBe(159);
    expect(claim158.pr).not.toBe(claim159.pr);
  });

  it('extractClaims reads every marker across an issue\'s comments and skips non-matching ones', () => {
    const comments = [
      { body: 'unrelated comment' },
      { body: '<!-- linear-sync:claim pr=158 run=31358757094 -->\ntext' },
      { body: '<!-- linear-sync:claim pr=159 run=31358757099 -->\ntext' },
    ];
    expect(extractClaims(comments)).toEqual([
      { pr: 158, run: '31358757094' },
      { pr: 159, run: '31358757099' },
    ]);
  });

  it('extractClaims returns [] for no comments', () => {
    expect(extractClaims([])).toEqual([]);
    expect(extractClaims(undefined)).toEqual([]);
  });

  it('buildClaimComment reproduces the exact shape from §3', () => {
    const body = buildClaimComment({
      prNumber: 158,
      runId: '31358757094',
      prUrl: 'https://github.com/gamitch/volt_task_tracker_rewrite/pull/158',
      mergeSha: 'abc1234',
      runUrl: 'https://github.com/gamitch/volt_task_tracker_rewrite/actions/runs/31358757094',
    });
    expect(body).toContain('<!-- linear-sync:claim pr=158 run=31358757094 -->');
    expect(body).toMatch(CLAIM_MARKER_RE);
    expect(parseClaimMarker(body)).toEqual({ pr: 158, run: '31358757094' });
    expect(body).toContain('abc1234');
    expect(body).toContain('Done');
    expect(body).toContain('.github/workflows/linear-sync.yml');
    expect(body).toContain('scripts/linear-sync.mjs');
  });
});

describe('audit comments -- content only, no marker (never mistaken for a claim)', () => {
  it('buildClosedWithoutMergeComment names the PR and carries no claim marker', () => {
    const body = buildClosedWithoutMergeComment({
      prNumber: 158,
      prUrl: 'https://github.com/x/y/pull/158',
    });
    expect(body).toContain('PR closed without merge');
    expect(parseClaimMarker(body)).toBeNull();
  });

  it('buildUnexpectedStateComment names the issue, the state, and carries no claim marker', () => {
    const body = buildUnexpectedStateComment({
      prNumber: 158,
      prUrl: 'https://github.com/x/y/pull/158',
      issueId: 'GAM-325',
      stateName: 'Backlog',
    });
    expect(body).toContain('GAM-325');
    expect(body).toContain('Backlog');
    expect(parseClaimMarker(body)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Timeouts -- a rejecting fetch surfaces as a named failure (AC4)
// ---------------------------------------------------------------------------

describe('fetchWithTimeout -- a timeout is a named failure, not an unhandled rejection', () => {
  it('turns an AbortError from the injected fetch into a SyncTimeoutError the caller can catch', async () => {
    const abortingFetch = async () => {
      const err = new Error('The operation was aborted.');
      err.name = 'AbortError';
      throw err;
    };

    await expect(fetchWithTimeout(abortingFetch, 'https://example.invalid', {}, 20_000)).rejects.toBeInstanceOf(
      SyncTimeoutError,
    );
  });

  it('the surfaced error carries a named .code so a caller can branch on it without string-matching messages', async () => {
    const timingOutFetch = async () => {
      const err = new Error('Timed out.');
      err.name = 'TimeoutError';
      throw err;
    };

    try {
      await fetchWithTimeout(timingOutFetch, 'https://example.invalid', {}, 20_000);
      throw new Error('expected fetchWithTimeout to reject');
    } catch (err) {
      expect(err).toBeInstanceOf(SyncTimeoutError);
      expect(err.code).toBe('FETCH_TIMEOUT');
    }
  });

  it('a non-timeout rejection is rethrown unchanged, not wrapped', async () => {
    const failingFetch = async () => {
      throw new Error('DNS resolution failed');
    };
    await expect(fetchWithTimeout(failingFetch, 'https://example.invalid', {}, 20_000)).rejects.toThrow(
      'DNS resolution failed',
    );
  });

  it('resolves normally when the injected fetch resolves', async () => {
    const okFetch = async () => ({ ok: true, status: 200 });
    const res = await fetchWithTimeout(okFetch, 'https://example.invalid', {}, 20_000);
    expect(res.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// PR number resolution (step 1) -- event payload only, or PR_NUMBER on replay
// ---------------------------------------------------------------------------

describe('resolvePrNumber -- step 1, event only (no network: readFile is injected)', () => {
  it('workflow_dispatch reads PR_NUMBER from the environment, not any file', () => {
    const readFile = () => {
      throw new Error('should never be called for workflow_dispatch');
    };
    const n = resolvePrNumber(
      { GITHUB_EVENT_NAME: 'workflow_dispatch', PR_NUMBER: '158' },
      readFile,
    );
    expect(n).toBe(158);
  });

  it('pull_request reads payload.pull_request.number from GITHUB_EVENT_PATH', () => {
    const readFile = () => JSON.stringify({ pull_request: { number: 158 } });
    const n = resolvePrNumber(
      { GITHUB_EVENT_NAME: 'pull_request', GITHUB_EVENT_PATH: '/tmp/event.json' },
      readFile,
    );
    expect(n).toBe(158);
  });

  it('falls back to payload.number when pull_request is absent', () => {
    const readFile = () => JSON.stringify({ number: 158 });
    const n = resolvePrNumber(
      { GITHUB_EVENT_NAME: 'pull_request', GITHUB_EVENT_PATH: '/tmp/event.json' },
      readFile,
    );
    expect(n).toBe(158);
  });

  it('no PR_NUMBER on a workflow_dispatch resolves to null', () => {
    const n = resolvePrNumber({ GITHUB_EVENT_NAME: 'workflow_dispatch' }, () => '{}');
    expect(n).toBeNull();
  });

  it('no GITHUB_EVENT_PATH at all resolves to null', () => {
    const n = resolvePrNumber({}, () => '{}');
    expect(n).toBeNull();
  });
});
