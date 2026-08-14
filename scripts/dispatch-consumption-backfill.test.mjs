// Unit tests for scripts/dispatch-consumption-backfill.mjs. Every I/O seam is
// injected -- no real filesystem, no network.
//
// The two groups that carry weight:
//
//   "counts what it skipped"   -- a backfill that processed 4 of 37 files and
//                                 printed success would report coverage it does
//                                 not have. That is the same defect as the
//                                 `tier/*` filter that matched nothing and the
//                                 224 tests nobody ran.
//   "is idempotent"            -- this script will be run more than once (now,
//                                 to beat the expiry; again after later
//                                 dispatches). A second run must not double
//                                 every comment and every rollup.

import { describe, expect, it, vi } from 'vitest';
import { COMMENT_MARKER, ROLLUP_START, formatComment } from './dispatch-consumption.mjs';
import {
  formatLedger,
  groupByIssue,
  parseArtifactFilename,
  postIssueBackfill,
  readBackfillDir,
  runBackfill,
} from './dispatch-consumption-backfill.mjs';

const resultObject = (over = {}) => ({
  type: 'result',
  total_cost_usd: 28.58,
  num_turns: 54,
  duration_ms: 3_552_000,
  model: 'claude-opus-5',
  usage: {
    input_tokens: 1000,
    output_tokens: 2000,
    cache_read_input_tokens: 3000,
    cache_creation_input_tokens: 4000,
  },
  ...over,
});

const payload = (over) => JSON.stringify([resultObject(over)]);

/** A fake directory: { filename: contents }. */
const fakeDir = (files) => ({
  readDir: () => Object.keys(files),
  readFile: (p) => {
    const name = p.split('/').pop();
    if (!(name in files)) throw new Error(`ENOENT ${name}`);
    return files[name];
  },
});

describe('parseArtifactFilename', () => {
  it('splits the issue identifier from the run id', () => {
    expect(parseArtifactFilename('GAM-304-31391626696.json')).toEqual({
      identifier: 'GAM-304',
      runId: '31391626696',
    });
  });

  it('handles a full path, not just a bare name', () => {
    expect(parseArtifactFilename('/tmp/a/b/GAM-12-999999.json').identifier).toBe('GAM-12');
  });

  it('rejects names that do not carry both parts', () => {
    for (const bad of ['GAM-304.json', '31391626696.json', 'claude-run-GAM-304.json', 'notes.md', '']) {
      expect(parseArtifactFilename(bad)).toBeNull();
    }
  });

  // Real GitHub run ids are 11 digits. Requiring 6+ means a file like
  // `GAM-304-2.json` is SKIPPED AND COUNTED rather than silently accepted with
  // `2` invented as a run id -- an unreadable ledger row is recoverable, a
  // confidently wrong one is not.
  it('refuses a suffix too short to be a run id, rather than guessing', () => {
    expect(parseArtifactFilename('GAM-304-2.json')).toBeNull();
    expect(parseArtifactFilename('GAM-304-999999.json').runId).toBe('999999');
  });
});

describe('readBackfillDir', () => {
  it('reads every well-named payload', () => {
    const { runs, skipped } = readBackfillDir(
      '/d',
      fakeDir({ 'GAM-304-31391626696.json': payload(), 'GAM-345-31427832230.json': payload() }),
    );
    expect(runs).toHaveLength(2);
    expect(skipped).toHaveLength(0);
    expect(runs[0].consumption.cost).toBe(28.58);
  });

  it('records a payload with no cost as unrecoverable rather than dropping it', () => {
    const { runs } = readBackfillDir(
      '/d',
      fakeDir({ 'GAM-344-31433664584.json': JSON.stringify([{ type: 'assistant' }]) }),
    );
    expect(runs).toHaveLength(1);
    expect(runs[0].consumption.ok).toBe(false);
    expect(runs[0].consumption.reason).toBe('NO_TOTAL_COST_USD');
  });

  it('survives an unreadable directory without throwing', () => {
    const got = readBackfillDir('/nope', {
      readDir: () => {
        throw new Error('ENOENT');
      },
    });
    expect(got.runs).toEqual([]);
    expect(got.error).toContain('ENOENT');
  });
});

describe('counts what it skipped', () => {
  it('skips AND reports files that do not match the naming convention', () => {
    const { runs, skipped } = readBackfillDir(
      '/d',
      fakeDir({ 'GAM-304-31391626696.json': payload(), 'README.md': 'x', 'claude-run-GAM-9.json': 'x' }),
    );
    expect(runs).toHaveLength(1);
    expect(skipped.map((s) => s.name).sort()).toEqual(['README.md', 'claude-run-GAM-9.json']);
    expect(skipped.every((s) => s.reason === 'FILENAME_NOT_ISSUE_RUNID')).toBe(true);
  });

  it('reports an unreadable individual file instead of counting it as done', () => {
    const { runs, skipped } = readBackfillDir('/d', {
      readDir: () => ['GAM-304-31391626696.json', 'GAM-305-31514339272.json'],
      readFile: (p) => {
        if (p.endsWith('GAM-305-31514339272.json')) throw new Error('EACCES');
        return payload();
      },
    });
    expect(runs).toHaveLength(1);
    expect(skipped[0]).toMatchObject({ name: 'GAM-305-31514339272.json', reason: 'UNREADABLE' });
  });

  it('surfaces skipped files in the ledger rather than leaving a silent gap', () => {
    const md = formatLedger(new Map([['GAM-304', []]]), {
      skipped: [{ name: 'README.md', reason: 'FILENAME_NOT_ISSUE_RUNID' }],
    });
    expect(md).toContain('## Files skipped');
    expect(md).toContain('README.md');
  });
});

describe('groupByIssue', () => {
  it('groups runs under their row and orders them by run id', () => {
    const grouped = groupByIssue([
      { identifier: 'GAM-344', runId: '20', consumption: { ok: true } },
      { identifier: 'GAM-304', runId: '5', consumption: { ok: true } },
      { identifier: 'GAM-344', runId: '3', consumption: { ok: true } },
    ]);
    expect([...grouped.keys()].sort()).toEqual(['GAM-304', 'GAM-344']);
    expect(grouped.get('GAM-344').map((r) => r.runId)).toEqual(['3', '20']);
  });
});

describe('formatLedger', () => {
  const grouped = groupByIssue([
    { identifier: 'GAM-344', runId: '1', consumption: { ok: false, reason: 'NO_TOTAL_COST_USD' } },
    {
      identifier: 'GAM-344',
      runId: '2',
      consumption: { ok: true, cost: 10, tokens: { total: 100 }, durationMs: 60_000, turns: 5 },
    },
    {
      identifier: 'GAM-304',
      runId: '3',
      consumption: { ok: true, cost: 28.58, tokens: { total: 900 }, durationMs: 60_000, turns: 54 },
    },
  ]);

  it('leads with the notional caveat, before any figure', () => {
    const md = formatLedger(grouped);
    expect(md).toContain('NOT money anyone was charged');
    expect(md.indexOf('NOT money anyone was charged')).toBeLessThan(md.indexOf('| notional consumption |'));
  });

  it('totals across every row', () => {
    const md = formatLedger(grouped);
    expect(md).toContain('| runs covered | 3 |');
    expect(md).toContain('| rows covered | 2 |');
    expect(md).toContain('$38.58');
  });

  it('keeps a per-run table, so runs that produced nothing stay visible', () => {
    const md = formatLedger(grouped);
    expect(md).toContain('## Per run');
    expect(md).toContain('**NO_TOTAL_COST_USD**');
    expect(md).toContain('| runs with no recoverable figure | 1 |');
  });

  // The ledger reads as settled fact, so a `$0.00` here would be a worse lie
  // than the same figure on a comment. When nothing was recoverable the totals
  // must say so, not report zero consumption.
  it('renders no total at all when no run yielded a figure', () => {
    const md = formatLedger(
      groupByIssue([{ identifier: 'GAM-1', runId: '1', consumption: { ok: false, reason: 'X' } }]),
    );
    expect(md).toContain('— no run yielded a figure');
    expect(md).not.toContain('$0.00');
    expect(md).not.toMatch(/\| GAM-1 \| \[1\][^|]*\| \$/);
  });

  it('says how many runs a partial total actually covers', () => {
    const md = formatLedger(grouped);
    expect(md).toContain('across 2 of 3 runs');
  });

  it('orders rows by consumption so the expensive ones are read first', () => {
    const md = formatLedger(grouped);
    expect(md.indexOf('| GAM-304 |')).toBeLessThan(md.indexOf('| GAM-344 |'));
  });
});

describe('is idempotent', () => {
  const runs = [
    { identifier: 'GAM-304', runId: '111111', consumption: { ok: true, cost: 10, tokens: { total: 1 }, durationMs: 0 } },
    { identifier: 'GAM-304', runId: '222222', consumption: { ok: true, cost: 5, tokens: { total: 1 }, durationMs: 0 } },
  ];

  const stub = (issue) => {
    const calls = [];
    const impl = vi.fn(async (query, variables) => {
      calls.push({ query, variables });
      if (query.includes('BackfillTarget')) return { data: { issue } };
      return { data: {} };
    });
    return { impl, calls };
  };

  it('posts one comment per run on a clean row', async () => {
    const { impl, calls } = stub({ id: 'u', description: '', comments: { nodes: [] } });
    const got = await postIssueBackfill('GAM-304', runs, { gqlImpl: impl, repo: 'o/r', log: () => {} });
    expect(got.posted).toBe(2);
    expect(calls.filter((c) => c.query.includes('PostBackfill'))).toHaveLength(2);
  });

  it('skips runs that already have a consumption comment', async () => {
    const already = formatComment({ consumption: runs[0].consumption, runId: '111111', repo: 'o/r' });
    const { impl, calls } = stub({ id: 'u', description: '', comments: { nodes: [{ body: already }] } });

    const got = await postIssueBackfill('GAM-304', runs, { gqlImpl: impl, repo: 'o/r', log: () => {} });
    expect(got.posted).toBe(1);
    const posted = calls.filter((c) => c.query.includes('PostBackfill'));
    expect(posted).toHaveLength(1);
    expect(posted[0].variables.body).toContain('222222');
  });

  it('posts nothing new when every run is already recorded', async () => {
    const nodes = runs.map((r) => ({
      body: formatComment({ consumption: r.consumption, runId: r.runId, repo: 'o/r' }),
    }));
    const { impl, calls } = stub({ id: 'u', description: '', comments: { nodes } });

    const got = await postIssueBackfill('GAM-304', runs, { gqlImpl: impl, repo: 'o/r', log: () => {} });
    expect(got.posted).toBe(0);
    expect(calls.filter((c) => c.query.includes('PostBackfill'))).toHaveLength(0);
    // The rollup is still refreshed -- it is derived, so rewriting it is safe
    // and keeps the total correct if a comment was deleted by hand.
    expect(calls.filter((c) => c.query.includes('UpdateBackfillRollup'))).toHaveLength(1);
  });

  it('leaves exactly one rollup block however many times it runs', async () => {
    let description = 'Body.';
    const impl = vi.fn(async (query, variables) => {
      if (query.includes('BackfillTarget')) {
        return { data: { issue: { id: 'u', description, comments: { nodes: [] } } } };
      }
      if (query.includes('UpdateBackfillRollup')) description = variables.description;
      return { data: {} };
    });

    await postIssueBackfill('GAM-304', runs, { gqlImpl: impl, repo: 'o/r', log: () => {} });
    await postIssueBackfill('GAM-304', runs, { gqlImpl: impl, repo: 'o/r', log: () => {} });

    expect(description.match(new RegExp(ROLLUP_START, 'g'))).toHaveLength(1);
    expect(description).toContain('Body.');
    expect(description).toContain('$15.00');
  });

  it('marks its comments so a later run can recognise them', async () => {
    const { impl, calls } = stub({ id: 'u', description: '', comments: { nodes: [] } });
    await postIssueBackfill('GAM-304', [runs[0]], { gqlImpl: impl, repo: 'o/r', log: () => {} });
    expect(calls.find((c) => c.query.includes('PostBackfill')).variables.body).toContain(COMMENT_MARKER);
  });
});

describe('runBackfill', () => {
  const files = { 'GAM-304-31391626696.json': payload(), 'GAM-345-31427832230.json': payload(), 'junk.txt': 'x' };

  it('writes the ledger and posts nothing without --post', async () => {
    const writeFile = vi.fn();
    const gqlImpl = vi.fn();
    const got = await runBackfill({
      dir: '/d',
      out: '/out.md',
      ...fakeDir(files),
      writeFile,
      gqlImpl,
      log: () => {},
    });

    expect(got.reason).toBe('LEDGER_ONLY');
    expect(got.runs).toBe(2);
    expect(got.issues).toBe(2);
    expect(writeFile).toHaveBeenCalledOnce();
    expect(writeFile.mock.calls[0][1]).toContain('# Dispatch consumption ledger');
    expect(gqlImpl).not.toHaveBeenCalled();
  });

  it('posts to Linear when asked', async () => {
    const gqlImpl = vi.fn(async (query) => {
      if (query.includes('BackfillTarget')) {
        return { data: { issue: { id: 'u', description: '', comments: { nodes: [] } } } };
      }
      return { data: {} };
    });
    const got = await runBackfill({
      dir: '/d',
      out: '/out.md',
      post: true,
      ...fakeDir(files),
      writeFile: vi.fn(),
      gqlImpl,
      log: () => {},
    });
    expect(got.reason).toBe('POSTED');
    expect(got.posted).toBe(2);
  });

  it('does nothing, loudly, when the directory holds no payloads', async () => {
    const writeFile = vi.fn();
    const got = await runBackfill({
      dir: '/d',
      ...fakeDir({ 'README.md': 'x' }),
      writeFile,
      log: () => {},
    });
    expect(got.reason).toBe('NOTHING_TO_DO');
    expect(got.skipped).toHaveLength(1);
    expect(writeFile).not.toHaveBeenCalled();
  });

  it('never gates — a missing directory still exits 0', async () => {
    const got = await runBackfill({
      dir: '/nope',
      readDir: () => {
        throw new Error('ENOENT');
      },
      log: () => {},
    });
    expect(got.exitCode).toBe(0);
    expect(got.reason).toBe('DIR_UNREADABLE');
  });

  it('does nothing without --dir', async () => {
    const got = await runBackfill({ log: () => {} });
    expect(got.reason).toBe('NO_DIR');
  });
});
