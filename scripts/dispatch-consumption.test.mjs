// Unit tests for scripts/dispatch-consumption.mjs. Every test drives the
// script's exported PURE functions, or `runDispatchConsumption` with both its
// I/O seams injected -- no network and no filesystem read anywhere in this
// file.
//
// The load-bearing group is "never invents a number". This script's entire
// reason to exist is that a consumption figure got lost; a version of it that
// silently reports `$0.00` when it cannot find one would be worse than the
// gap it replaces, and that is the failure shape this repository has hit most
// often (the `tier/*` filter matching nothing forever; the mutation run that
// printed nothing; the 224 tests nobody executed). Those tests are written to
// fail loudly if anyone ever "helpfully" defaults a missing cost to zero.

import { describe, expect, it, vi } from 'vitest';
import {
  COMMENT_MARKER,
  ROLLUP_END,
  ROLLUP_START,
  collectObjects,
  collectUsage,
  extractConsumption,
  fmtCost,
  fmtDuration,
  fmtInt,
  formatComment,
  formatRollup,
  parsePriorRuns,
  readExecutionFile,
  runDispatchConsumption,
  sumUsage,
  upsertRollup,
} from './dispatch-consumption.mjs';

/** The four usage keys read off a real Claude Code SDK transcript. */
const usage = (input, output, cacheRead, cacheWrite) => ({
  input_tokens: input,
  output_tokens: output,
  cache_read_input_tokens: cacheRead,
  cache_creation_input_tokens: cacheWrite,
});

const resultObject = (over = {}) => ({
  type: 'result',
  total_cost_usd: 28.58,
  num_turns: 54,
  duration_ms: 3_552_000,
  model: 'claude-opus-5',
  session_id: 'abc123',
  usage: usage(45_231, 88_102, 1_098_234, 3_000),
  ...over,
});

describe('collectObjects', () => {
  it('reads a JSON array', () => {
    expect(collectObjects(JSON.stringify([{ a: 1 }, { b: 2 }]))).toEqual([{ a: 1 }, { b: 2 }]);
  });

  it('reads a bare JSON object', () => {
    expect(collectObjects(JSON.stringify({ a: 1 }))).toEqual([{ a: 1 }]);
  });

  it('reads JSONL', () => {
    const text = `${JSON.stringify({ a: 1 })}\n${JSON.stringify({ b: 2 })}`;
    expect(collectObjects(text)).toEqual([{ a: 1 }, { b: 2 }]);
  });

  // A run killed at `timeout-minutes` is the most likely producer of a
  // half-written final line, and it is the run whose figures matter most.
  it('keeps earlier JSONL lines when the last one is truncated', () => {
    const text = `${JSON.stringify({ a: 1 })}\n{"b": 2, "trunc`;
    expect(collectObjects(text)).toEqual([{ a: 1 }]);
  });

  it('returns nothing for empty or non-string input', () => {
    expect(collectObjects('')).toEqual([]);
    expect(collectObjects('   ')).toEqual([]);
    expect(collectObjects(undefined)).toEqual([]);
  });
});

describe('sumUsage', () => {
  it('sums the four established counters and their total', () => {
    expect(sumUsage([usage(10, 20, 30, 40), usage(1, 2, 3, 4)])).toEqual({
      input: 11,
      output: 22,
      cacheRead: 33,
      cacheWrite: 44,
      total: 110,
    });
  });

  it('treats absent or non-numeric counters as zero rather than NaN', () => {
    expect(sumUsage([{ input_tokens: 5 }, {}, { output_tokens: 'nope' }])).toEqual({
      input: 5,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      total: 5,
    });
  });
});

describe('collectUsage', () => {
  it('finds usage objects at any depth', () => {
    const tree = { a: { usage: usage(1, 1, 1, 1) }, b: [{ usage: usage(2, 2, 2, 2) }] };
    expect(collectUsage(tree)).toHaveLength(2);
  });

  it('does not loop forever on a cyclic object', () => {
    const a = { usage: usage(1, 1, 1, 1) };
    a.self = a;
    expect(collectUsage(a)).toHaveLength(1);
  });
});

describe('extractConsumption', () => {
  it('extracts every figure from a well-formed result object', () => {
    const got = extractConsumption([{ type: 'assistant' }, resultObject()]);
    expect(got.ok).toBe(true);
    expect(got.cost).toBe(28.58);
    expect(got.turns).toBe(54);
    expect(got.durationMs).toBe(3_552_000);
    expect(got.model).toBe('claude-opus-5');
    expect(got.tokens.total).toBe(45_231 + 88_102 + 1_098_234 + 3_000);
    expect(got.tokenSource).toBe('result.usage');
    expect(got.missing).toEqual([]);
  });

  // The result object is found by the field we need, not by position or by
  // `type`, because neither of those is established about the file format.
  it('finds the result object regardless of position', () => {
    const got = extractConsumption([resultObject(), { type: 'assistant' }, { type: 'user' }]);
    expect(got.ok).toBe(true);
    expect(got.cost).toBe(28.58);
  });

  it('takes the LAST cost-bearing object when several exist', () => {
    const got = extractConsumption([resultObject(), resultObject({ total_cost_usd: 99.99 })]);
    expect(got.cost).toBe(99.99);
  });

  it('sums usage across messages when the result object carries none', () => {
    const got = extractConsumption([
      { type: 'assistant', usage: usage(10, 20, 30, 40) },
      { type: 'assistant', usage: usage(1, 2, 3, 4) },
      resultObject({ usage: undefined }),
    ]);
    expect(got.tokens.total).toBe(110);
    expect(got.tokenSource).toBe('summed:2');
  });

  it('reports turns and duration as missing rather than guessing them', () => {
    const got = extractConsumption([resultObject({ num_turns: undefined, duration_ms: undefined })]);
    expect(got.ok).toBe(true);
    expect(got.turns).toBeUndefined();
    expect(got.durationMs).toBeUndefined();
    expect(got.missing).toEqual(expect.arrayContaining(['turns', 'duration']));
  });
});

describe('never invents a number', () => {
  it('fails with NO_TOTAL_COST_USD rather than reporting zero', () => {
    const got = extractConsumption([{ type: 'assistant', usage: usage(1, 1, 1, 1) }]);
    expect(got.ok).toBe(false);
    expect(got.reason).toBe('NO_TOTAL_COST_USD');
    expect(got.cost).toBeUndefined();
    expect(got.cost).not.toBe(0);
  });

  it('fails with EMPTY_EXECUTION_FILE on an empty parse', () => {
    expect(extractConsumption([]).reason).toBe('EMPTY_EXECUTION_FILE');
    expect(extractConsumption(undefined).reason).toBe('EMPTY_EXECUTION_FILE');
  });

  it('renders no dollar figure at all in an unrecoverable comment', () => {
    const body = formatComment({
      consumption: { ok: false, reason: 'EXECUTION_FILE_UNREADABLE' },
      runId: '31358757094',
      repo: 'gamitch/volt_task_tracker_rewrite',
    });
    expect(body).toContain('UNRECOVERABLE');
    expect(body).toContain('EXECUTION_FILE_UNREADABLE');
    expect(body).not.toMatch(/\$\d/);
    expect(body).not.toContain('$0.00');
  });

  it('renders no dollar figure in an unrecoverable rollup', () => {
    const line = formatRollup([{ cost: undefined }, { cost: undefined }]);
    expect(line).toContain('none recoverable');
    expect(line).not.toMatch(/\$\d/);
  });

  it('surfaces a zero token total as missing instead of passing it off as real', () => {
    const got = extractConsumption([resultObject({ usage: usage(0, 0, 0, 0) })]);
    expect(got.missing).toContain('token counts');
  });
});

describe('the notional caveat travels with the number', () => {
  it('states NOT money charged in the comment', () => {
    const body = formatComment({
      consumption: extractConsumption([resultObject()]),
      runId: '1',
      repo: 'o/r',
    });
    expect(body).toContain('notional');
    expect(body).toContain('NOT money charged');
    expect(body).toContain('subscription auth');
  });

  it('states it again in the rollup, which is read on its own', () => {
    const line = formatRollup([{ cost: 28.58, tokens: { total: 100 }, durationMs: 1000 }]);
    expect(line).toContain('notional');
    expect(line).toContain('not money charged');
  });
});

describe('formatters', () => {
  it('formats durations at hour, minute and second scale', () => {
    expect(fmtDuration(3_552_000)).toBe('59m 12s');
    expect(fmtDuration(6_240_000)).toBe('1h 44m');
    expect(fmtDuration(8_000)).toBe('8s');
  });

  it('returns an em dash rather than a fake value for unusable durations', () => {
    expect(fmtDuration(undefined)).toBe('—');
    expect(fmtDuration(NaN)).toBe('—');
    expect(fmtDuration(-1)).toBe('—');
  });

  it('formats costs to two places and integers with separators', () => {
    expect(fmtCost(28.5)).toBe('$28.50');
    expect(fmtCost(undefined)).toBe('—');
    expect(fmtInt(1_234_567)).toBe('1,234,567');
    expect(fmtInt(undefined)).toBe('—');
  });
});

describe('upsertRollup', () => {
  it('appends a block to a description that has none', () => {
    const got = upsertRollup('Original body.', 'LINE');
    expect(got).toContain('Original body.');
    expect(got).toContain(`${ROLLUP_START}\nLINE\n${ROLLUP_END}`);
  });

  // GAM-344 ran twice and GAM-304 more; a rollup that appended would leave one
  // block per attempt and no single running total.
  it('replaces in place rather than stacking, and is idempotent', () => {
    const once = upsertRollup('Body.', 'FIRST');
    const twice = upsertRollup(once, 'SECOND');
    expect(twice).toContain('SECOND');
    expect(twice).not.toContain('FIRST');
    expect(twice.match(new RegExp(ROLLUP_START, 'g'))).toHaveLength(1);
    expect(upsertRollup(twice, 'SECOND')).toBe(twice);
  });

  it('preserves text on both sides of an existing block', () => {
    const seeded = `BEFORE\n\n${ROLLUP_START}\nOLD\n${ROLLUP_END}\n\nAFTER`;
    const got = upsertRollup(seeded, 'NEW');
    expect(got).toContain('BEFORE');
    expect(got).toContain('AFTER');
    expect(got).toContain('NEW');
    expect(got).not.toContain('OLD');
  });

  it('recovers from a half-block left by truncation or a hand edit', () => {
    const got = upsertRollup(`Body.\n${ROLLUP_START}\norphaned`, 'LINE');
    expect(got.match(new RegExp(ROLLUP_END, 'g'))).toHaveLength(1);
    expect(got).toContain('LINE');
  });

  it('handles an empty or absent description', () => {
    expect(upsertRollup('', 'LINE')).toBe(`${ROLLUP_START}\nLINE\n${ROLLUP_END}`);
    expect(upsertRollup(undefined, 'LINE')).toBe(`${ROLLUP_START}\nLINE\n${ROLLUP_END}`);
  });
});

describe('formatRollup', () => {
  it('totals cost, tokens and wall clock across runs', () => {
    const line = formatRollup([
      { cost: 10, tokens: { total: 1000 }, durationMs: 60_000 },
      { cost: 5.5, tokens: { total: 500 }, durationMs: 60_000 },
    ]);
    expect(line).toContain('$15.50');
    expect(line).toContain('1,500 tokens');
    expect(line).toContain('2m 0s');
  });

  it('counts unrecoverable runs without letting them drag the total to zero', () => {
    const line = formatRollup([
      { cost: 10, tokens: { total: 1000 }, durationMs: 0 },
      { cost: undefined },
    ]);
    expect(line).toContain('$10.00');
    expect(line).toContain('1 run(s) unrecoverable');
  });
});

describe('parsePriorRuns', () => {
  it('recovers run id, cost and tokens from prior consumption comments', () => {
    const body = formatComment({
      consumption: extractConsumption([resultObject()]),
      runId: '31385764526',
      repo: 'o/r',
    });
    const got = parsePriorRuns([{ body }, { body: 'unrelated comment' }]);
    expect(got).toHaveLength(1);
    expect(got[0].runId).toBe('31385764526');
    expect(got[0].cost).toBe(28.58);
    expect(got[0].tokens.total).toBe(1_234_567);
  });

  it('marks an unrecoverable prior run as having no cost', () => {
    const body = formatComment({
      consumption: { ok: false, reason: 'EXECUTION_FILE_UNREADABLE' },
      runId: '999999',
      repo: 'o/r',
    });
    expect(parsePriorRuns([{ body }])[0].cost).toBeUndefined();
  });

  it('ignores comments without the marker', () => {
    expect(parsePriorRuns([{ body: 'A human wrote this. $28.58 was mentioned.' }])).toEqual([]);
    expect(parsePriorRuns(undefined)).toEqual([]);
  });
});

describe('readExecutionFile', () => {
  it('reports NO_EXECUTION_PATH when given nothing', () => {
    expect(readExecutionFile(undefined).reason).toBe('NO_EXECUTION_PATH');
  });

  it('reports EXECUTION_FILE_UNREADABLE instead of throwing', () => {
    const got = readExecutionFile('/nope', {
      readFile: () => {
        throw new Error('ENOENT');
      },
    });
    expect(got.ok).toBe(false);
    expect(got.reason).toBe('EXECUTION_FILE_UNREADABLE');
    expect(got.detail).toContain('ENOENT');
  });
});

describe('runDispatchConsumption', () => {
  const executionText = JSON.stringify([resultObject()]);

  /** A gql stub that records calls and answers the issue read. */
  const stubGql = (issue = { id: 'uuid-1', identifier: 'GAM-304', description: 'Body.' }) => {
    const calls = [];
    const impl = vi.fn(async (query, variables) => {
      calls.push({ query, variables });
      if (query.includes('ConsumptionTarget')) return { data: { issue } };
      return { data: {} };
    });
    return { impl, calls };
  };

  it('posts a comment and a description rollup', async () => {
    const { impl, calls } = stubGql();
    const got = await runDispatchConsumption({
      identifier: 'GAM-304',
      executionPath: '/exec.json',
      runId: '31385764526',
      repo: 'o/r',
      gqlImpl: impl,
      readFile: () => executionText,
      log: () => {},
    });

    expect(got.recorded).toBe(true);
    expect(got.reason).toBe('RECORDED');
    expect(got.exitCode).toBe(0);

    const comment = calls.find((c) => c.query.includes('PostConsumption'));
    expect(comment.variables.body).toContain('$28.58');
    expect(comment.variables.body).toContain(COMMENT_MARKER);

    const update = calls.find((c) => c.query.includes('UpdateConsumptionRollup'));
    expect(update.variables.description).toContain(ROLLUP_START);
    expect(update.variables.description).toContain('Body.');
  });

  it('still comments when the execution file is missing, and records no figure', async () => {
    const { impl, calls } = stubGql();
    const got = await runDispatchConsumption({
      identifier: 'GAM-304',
      executionPath: '/gone.json',
      runId: '1',
      repo: 'o/r',
      gqlImpl: impl,
      readFile: () => {
        throw new Error('ENOENT');
      },
      log: () => {},
    });

    expect(got.recorded).toBe(true);
    const comment = calls.find((c) => c.query.includes('PostConsumption'));
    expect(comment.variables.body).toContain('UNRECOVERABLE');
    expect(comment.variables.body).not.toMatch(/\$\d/);
  });

  it('accumulates the run count across attempts instead of resetting it', async () => {
    const seeded = `Body.\n\n${ROLLUP_START}\n**Dispatch consumption:** 2 runs · $10.00 notional (not money charged — subscription auth) · 1,000 tokens · 1m 0s\n${ROLLUP_END}`;
    const { impl, calls } = stubGql({ id: 'uuid-1', identifier: 'GAM-344', description: seeded });

    await runDispatchConsumption({
      identifier: 'GAM-344',
      executionPath: '/exec.json',
      runId: '3',
      repo: 'o/r',
      gqlImpl: impl,
      readFile: () => executionText,
      log: () => {},
    });

    const update = calls.find((c) => c.query.includes('UpdateConsumptionRollup'));
    expect(update.variables.description).toContain('3 runs');
    expect(update.variables.description).toContain('$38.58');
    expect(update.variables.description.match(new RegExp(ROLLUP_START, 'g'))).toHaveLength(1);
  });

  it('is never a gate — a Linear read failure still exits 0', async () => {
    const got = await runDispatchConsumption({
      identifier: 'GAM-304',
      executionPath: '/exec.json',
      gqlImpl: async () => {
        throw new Error('Linear down');
      },
      readFile: () => executionText,
      log: () => {},
    });
    expect(got.exitCode).toBe(0);
    expect(got.reason).toBe('READ_FAILED');
  });

  it('is never a gate — a comment failure still exits 0', async () => {
    const impl = vi.fn(async (query) => {
      if (query.includes('ConsumptionTarget')) return { data: { issue: { id: 'u', description: '' } } };
      throw new Error('mutation refused');
    });
    const got = await runDispatchConsumption({
      identifier: 'GAM-304',
      executionPath: '/exec.json',
      gqlImpl: impl,
      readFile: () => executionText,
      log: () => {},
    });
    expect(got.exitCode).toBe(0);
    expect(got.reason).toBe('COMMENT_FAILED');
  });

  it('writes nothing at all under --dry-run', async () => {
    const { impl } = stubGql();
    const got = await runDispatchConsumption({
      identifier: 'GAM-304',
      executionPath: '/exec.json',
      dryRun: true,
      gqlImpl: impl,
      readFile: () => executionText,
      log: () => {},
    });
    expect(got.reason).toBe('DRY_RUN');
    expect(impl).not.toHaveBeenCalled();
  });

  it('does nothing without an issue identifier', async () => {
    const { impl } = stubGql();
    const got = await runDispatchConsumption({ gqlImpl: impl, log: () => {} });
    expect(got.reason).toBe('NO_IDENTIFIER');
    expect(impl).not.toHaveBeenCalled();
  });
});
