// Unit tests for scripts/linear-declaration-check.mjs -- GAM-325 D3, the
// PR-time declaration gate.
//
// NO NETWORK ANYWHERE IN THIS FILE (criterion 5). Every test that exercises
// `loadParser` or `runGate` injects `fetchImpl`, `importModule`, `gqlImpl`
// (via `existenceCheck`) and/or `readEventFile`; the one subprocess test at
// the bottom spawns the real script but deliberately withholds
// `GITHUB_REPOSITORY` and `LINEAR_API_KEY` so its own two would-be network
// call sites (the remote parser fetch, the Also-fixes existence check) are
// never reached -- the fallback/no-key branches are themselves the
// network-free paths documented in the script.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as parser from './linear/declaration.mjs';
import {
  evaluateDeclaration,
  loadParser,
  runGate,
  validateAlsoFixes,
} from './linear-declaration-check.mjs';

const SCRIPT_PATH = fileURLToPath(new URL('./linear-declaration-check.mjs', import.meta.url));

function silentLog() {
  return { error: vi.fn(), log: vi.fn(), warn: vi.fn() };
}

// ---------------------------------------------------------------------------
// evaluateDeclaration -- one named test per gate rule 1-4, plus the green
// and red cases acceptance criterion 1 names explicitly.
// ---------------------------------------------------------------------------
describe('evaluateDeclaration -- rule 1: canonical-or-red, naming the canonical form', () => {
  it('HALF_DECLARATION on line 1 goes red naming "Closes GAM-nnn"', () => {
    const findings = evaluateDeclaration({ body: 'Fixes GAM-1', headRef: 'some-branch' }, parser);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe(1);
    expect(findings[0].message).toContain('nothing closes unless line 1 starts with "Closes GAM-nnn"');
  });

  it('a canonical line 1 produces no rule-1 finding', () => {
    const findings = evaluateDeclaration({ body: 'Closes GAM-42', headRef: 'some-branch' }, parser);
    expect(findings.find((f) => f.rule === 1)).toBeUndefined();
  });

  it('a bare mention on line 1 stays legal -- no rule-1 finding', () => {
    const findings = evaluateDeclaration({ body: 'See GAM-42 for context.', headRef: 'some-branch' }, parser);
    expect(findings.find((f) => f.rule === 1)).toBeUndefined();
  });
});

describe('evaluateDeclaration -- rule 2: GAM-000 is never a valid declaration', () => {
  it('Closes GAM-000 goes red', () => {
    const findings = evaluateDeclaration({ body: 'Closes GAM-000', headRef: 'some-branch' }, parser);
    expect(findings).toHaveLength(1);
    expect(findings[0].rule).toBe(2);
    expect(findings[0].message).toMatch(/GAM-000/);
  });
});

describe('evaluateDeclaration -- rule 3: a claude/gam-<n>- branch must declare that exact issue', () => {
  it("claude/gam-131-foo declaring GAM-130 is red -- acceptance criterion 1's named case", () => {
    const findings = evaluateDeclaration(
      { body: 'Closes GAM-130', headRef: 'claude/gam-131-foo' },
      parser,
    );
    const rule3 = findings.find((f) => f.rule === 3);
    expect(rule3).toBeDefined();
    expect(rule3.message).toMatch(/GAM-131/);
    expect(rule3.message).toMatch(/GAM-130/);
  });

  it('claude/gam-131-foo declaring GAM-131 is green on rule 3', () => {
    const findings = evaluateDeclaration(
      { body: 'Closes GAM-131', headRef: 'claude/gam-131-foo' },
      parser,
    );
    expect(findings.find((f) => f.rule === 3)).toBeUndefined();
  });

  it('claude/gam-131-foo with NO declaration at all is red on rule 3', () => {
    const findings = evaluateDeclaration(
      { body: 'No declaration here.', headRef: 'claude/gam-131-foo' },
      parser,
    );
    const rule3 = findings.find((f) => f.rule === 3);
    expect(rule3).toBeDefined();
    expect(rule3.message).toMatch(/GAM-131/);
  });

  it("GitHub's revert-NNN-claude/gam-... branches are not anchored matches -- no rule-3 finding", () => {
    const findings = evaluateDeclaration(
      { body: 'No declaration here.', headRef: 'revert-158-claude/gam-315-foo' },
      parser,
    );
    expect(findings.find((f) => f.rule === 3)).toBeUndefined();
  });
});

describe('evaluateDeclaration -- rule 4 (packet addition, ruled KEEP): a later-line canonical match is red', () => {
  it('no canonical declaration on line 1, but line 3 matches exactly -- red, naming the line number', () => {
    const body = 'No declaration here.\nsome context\nCloses GAM-325';
    const findings = evaluateDeclaration({ body, headRef: 'some-branch' }, parser);
    const rule4 = findings.find((f) => f.rule === 4);
    expect(rule4).toBeDefined();
    expect(rule4.message).toContain('line 3');
    expect(rule4.message).toContain('Closes GAM-325');
  });

  it('a canonical line 1 does not trigger rule 4, even if a later line also looks canonical', () => {
    const body = 'Closes GAM-325\nCloses GAM-999';
    const findings = evaluateDeclaration({ body, headRef: 'some-branch' }, parser);
    expect(findings.find((f) => f.rule === 4)).toBeUndefined();
  });

  it('no canonical declaration anywhere in the body -- no rule-4 finding', () => {
    const body = 'No declaration here.\nsome context\nnothing canonical either.';
    const findings = evaluateDeclaration({ body, headRef: 'some-branch' }, parser);
    expect(findings.find((f) => f.rule === 4)).toBeUndefined();
  });
});

describe('evaluateDeclaration -- the green and red cases acceptance criterion 1 names', () => {
  it('an infra PR: no declaration, non-identifier branch -- green (no findings at all)', () => {
    const findings = evaluateDeclaration(
      { body: 'Bumps a dependency. No issue to close.', headRef: 'chore/bump-deps' },
      parser,
    );
    expect(findings).toEqual([]);
  });

  it('claude/gam-131-foo declaring GAM-130 -- red (already covered above; repeated here as the literal criterion-1 name)', () => {
    const findings = evaluateDeclaration(
      { body: 'Closes GAM-130', headRef: 'claude/gam-131-foo' },
      parser,
    );
    expect(findings.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// loadParser -- the remote-fetch-with-logged-local-fallback contract.
// ---------------------------------------------------------------------------
describe('loadParser', () => {
  it('uses the remote fetch when it succeeds, and does not fall back', async () => {
    const fakeSource = 'export const CANONICAL = /x/; export function parseDeclaration(){} export function branchIssue(){} export function parseAlsoFixes(){}';
    const fetchImpl = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => fakeSource,
    });
    const fakeModule = {
      CANONICAL: /x/,
      parseDeclaration: () => {},
      branchIssue: () => {},
      parseAlsoFixes: () => {},
    };
    const importModule = vi.fn().mockResolvedValue(fakeModule);
    const log = vi.fn();

    const { mod, source } = await loadParser({
      repo: 'gamitch/volt_task_tracker_rewrite',
      ref: 'main',
      fetchImpl,
      importModule,
      log,
    });

    expect(source).toBe('remote');
    expect(mod).toBe(fakeModule);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(importModule).toHaveBeenCalledWith(fakeSource);
    expect(log).not.toHaveBeenCalled();
  });

  it('falls back to the local module, logging why, when the fetch rejects', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error('network down'));
    const log = vi.fn();

    const { mod, source } = await loadParser({
      repo: 'gamitch/volt_task_tracker_rewrite',
      ref: 'main',
      fetchImpl,
      log,
    });

    expect(source).toBe('local-fallback');
    expect(typeof mod.parseDeclaration).toBe('function');
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0]).toMatch(/WARNING/);
    expect(log.mock.calls[0][0]).toMatch(/network down/);
  });

  it('falls back to the local module, logging why, on a non-2xx response', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: false, status: 404 });
    const log = vi.fn();

    const { source } = await loadParser({
      repo: 'gamitch/volt_task_tracker_rewrite',
      ref: 'main',
      fetchImpl,
      log,
    });

    expect(source).toBe('local-fallback');
    expect(log.mock.calls[0][0]).toMatch(/HTTP 404/);
  });

  it('falls back to the local module, logging why, when the fetched module is missing an export', async () => {
    const fetchImpl = vi.fn().mockResolvedValue({ ok: true, text: async () => 'export const x = 1;' });
    const importModule = vi.fn().mockResolvedValue({ x: 1 });
    const log = vi.fn();

    const { source } = await loadParser({
      repo: 'gamitch/volt_task_tracker_rewrite',
      ref: 'main',
      fetchImpl,
      importModule,
      log,
    });

    expect(source).toBe('local-fallback');
    expect(log.mock.calls[0][0]).toMatch(/missing expected export/);
  });

  it('falls back without attempting a fetch at all when repo/ref are unavailable', async () => {
    const fetchImpl = vi.fn();
    const log = vi.fn();

    const { source } = await loadParser({ repo: undefined, ref: undefined, fetchImpl, log });

    expect(source).toBe('local-fallback');
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(log.mock.calls[0][0]).toMatch(/no repo\/ref available/);
  });
});

// ---------------------------------------------------------------------------
// validateAlsoFixes -- rule 5, always advisory.
// ---------------------------------------------------------------------------
describe('validateAlsoFixes -- rule 5, advisory only', () => {
  it('returns [] for no identifiers', async () => {
    expect(await validateAlsoFixes([], { apiKey: undefined })).toEqual([]);
    expect(await validateAlsoFixes([], { apiKey: 'lin_api_x' })).toEqual([]);
  });

  it('is advisory (a warning string, not a throw) when no key is present', async () => {
    const warnings = await validateAlsoFixes(['GAM-40'], { apiKey: undefined });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/not existence-validated/);
    expect(warnings[0]).toMatch(/advisory only/);
  });

  it('with a key present, warns (never throws) when an identifier does not exist', async () => {
    const existenceCheck = vi.fn().mockResolvedValue(false);
    const warnings = await validateAlsoFixes(['GAM-999999'], { apiKey: 'lin_api_x', existenceCheck });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toMatch(/GAM-999999/);
    expect(warnings[0]).toMatch(/does not exist/);
  });

  it('with a key present, is silent when every identifier exists', async () => {
    const existenceCheck = vi.fn().mockResolvedValue(true);
    const warnings = await validateAlsoFixes(['GAM-1'], { apiKey: 'lin_api_x', existenceCheck });
    expect(warnings).toEqual([]);
  });

  it('a failed existence check (not a confirmed absence) is reported as undetermined, not "does not exist"', async () => {
    const existenceCheck = vi.fn().mockRejectedValue(new Error('rate limit'));
    const warnings = await validateAlsoFixes(['GAM-1'], { apiKey: 'lin_api_x', existenceCheck });
    expect(warnings[0]).toMatch(/could not be existence-validated/);
    expect(warnings[0]).not.toMatch(/does not exist/);
  });
});

// ---------------------------------------------------------------------------
// runGate -- criterion 2: exit code 1 on red, 0 on green, and NO code path
// returns without an explicit exitCode. Every scenario below asserts
// `typeof result.exitCode === 'number'` in addition to the specific value,
// so a future edit that forgets to set it on some new branch fails loudly.
// ---------------------------------------------------------------------------
describe('runGate -- explicit exit codes on every path (criterion 2)', () => {
  const passingDeps = () => ({
    env: { GITHUB_EVENT_PATH: '/fake/event.json' },
    readEventFile: vi.fn().mockResolvedValue(
      JSON.stringify({ pull_request: { number: 1, body: 'Closes GAM-1', head: { ref: 'chore/x' } } }),
    ),
    fetchImpl: vi.fn(), // must never be called -- no GITHUB_REPOSITORY
    log: silentLog(),
  });

  it('exit 1 when GITHUB_EVENT_PATH is not set', async () => {
    const result = await runGate({ env: {}, log: silentLog() });
    expect(typeof result.exitCode).toBe('number');
    expect(result.exitCode).toBe(1);
  });

  it('exit 1 when the event file cannot be read/parsed', async () => {
    const result = await runGate({
      env: { GITHUB_EVENT_PATH: '/fake/event.json' },
      readEventFile: vi.fn().mockRejectedValue(new Error('ENOENT')),
      log: silentLog(),
    });
    expect(typeof result.exitCode).toBe('number');
    expect(result.exitCode).toBe(1);
  });

  it('exit 1 when the event payload has no pull_request', async () => {
    const result = await runGate({
      env: { GITHUB_EVENT_PATH: '/fake/event.json' },
      readEventFile: vi.fn().mockResolvedValue(JSON.stringify({ action: 'opened' })),
      log: silentLog(),
    });
    expect(typeof result.exitCode).toBe('number');
    expect(result.exitCode).toBe(1);
  });

  it('exit 1 when something inside the gate throws unexpectedly (a genuinely malformed event: valid JSON `null`)', async () => {
    // JSON.parse('null') succeeds (it IS valid JSON), so the inner
    // read/parse try/catch does not fire -- but `payload.pull_request` on a
    // `null` payload then throws a TypeError, which only the OUTER
    // try/catch can catch. This is the case the outer catch exists for:
    // a shape nobody wrote an explicit branch for still ends in exitCode 1,
    // never an unhandled rejection.
    const result = await runGate({
      env: { GITHUB_EVENT_PATH: '/fake/event.json' },
      readEventFile: vi.fn().mockResolvedValue('null'),
      log: silentLog(),
    });
    expect(typeof result.exitCode).toBe('number');
    expect(result.exitCode).toBe(1);
    expect(result.error).toBe(true);
  });

  it('exit 0 on a green PR (no GITHUB_REPOSITORY -- confirms no network is attempted)', async () => {
    const deps = passingDeps();
    const result = await runGate(deps);
    expect(typeof result.exitCode).toBe('number');
    expect(result.exitCode).toBe(0);
    expect(result.findings).toEqual([]);
    expect(deps.fetchImpl).not.toHaveBeenCalled();
  });

  it('exit 1 on a red PR (GAM-000 placeholder)', async () => {
    const result = await runGate({
      env: { GITHUB_EVENT_PATH: '/fake/event.json' },
      readEventFile: vi.fn().mockResolvedValue(
        JSON.stringify({ pull_request: { number: 2, body: 'Closes GAM-000', head: { ref: 'chore/x' } } }),
      ),
      fetchImpl: vi.fn(),
      log: silentLog(),
    });
    expect(typeof result.exitCode).toBe('number');
    expect(result.exitCode).toBe(1);
    expect(result.findings.some((f) => f.rule === 2)).toBe(true);
  });

  it("exit 0 when Also-fixes: names a nonexistent issue -- advisory never fails the gate, with a key present", async () => {
    const result = await runGate({
      env: { GITHUB_EVENT_PATH: '/fake/event.json', LINEAR_API_KEY: 'lin_api_x' },
      readEventFile: vi.fn().mockResolvedValue(
        JSON.stringify({
          pull_request: {
            number: 3,
            body: 'Closes GAM-1\n\nAlso-fixes: GAM-999999',
            head: { ref: 'chore/x' },
          },
        }),
      ),
      fetchImpl: vi.fn(),
      existenceCheck: vi.fn().mockResolvedValue(false),
      log: silentLog(),
    });
    expect(result.exitCode).toBe(0);
    expect(result.warnings.some((w) => w.includes('GAM-999999'))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The real process, spawned for real -- proves the exit code is what a CI
// job would actually see, not merely what the exported function returns.
// No GITHUB_REPOSITORY / LINEAR_API_KEY in the child's env, so the parser
// fetch and the Also-fixes existence check both take their no-network path.
// ---------------------------------------------------------------------------
describe('the actual CLI process (spawned, no network reachable from its env)', () => {
  const tmpFiles = [];

  afterEach(() => {
    while (tmpFiles.length > 0) {
      const f = tmpFiles.pop();
      fs.rmSync(f, { force: true });
    }
  });

  function writeEventFixture(pullRequest) {
    const file = path.join(os.tmpdir(), `gam-325-gate-fixture-${Math.random().toString(36).slice(2)}.json`);
    fs.writeFileSync(file, JSON.stringify({ pull_request: pullRequest }));
    tmpFiles.push(file);
    return file;
  }

  function runScript(eventFile) {
    return spawnSync(process.execPath, [SCRIPT_PATH], {
      env: {
        PATH: process.env.PATH,
        GITHUB_EVENT_PATH: eventFile,
        // Deliberately absent: GITHUB_REPOSITORY, GITHUB_TOKEN, LINEAR_API_KEY.
      },
      encoding: 'utf8',
      timeout: 15_000,
    });
  }

  it('exits 1 for a red PR (a claude/gam-131-foo branch declaring GAM-130)', () => {
    const file = writeEventFixture({
      number: 42,
      body: 'Closes GAM-130',
      head: { ref: 'claude/gam-131-foo' },
    });
    const result = runScript(file);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/RED \[rule 3\]/);
  });

  it('exits 0 for a green PR (canonical declaration, matching branch)', () => {
    const file = writeEventFixture({
      number: 43,
      body: 'Closes GAM-131 — small fix.',
      head: { ref: 'claude/gam-131-foo' },
    });
    const result = runScript(file);
    expect(result.status).toBe(0);
    // Informational lines (parser source, the green verdict) go to stdout;
    // only findings/warnings go to stderr -- see runGate's logInfo/logError.
    expect(result.stdout).toMatch(/green/);
  });

  it('exits 0 for an infra PR with no declaration and no claude/gam-nnn- branch', () => {
    const file = writeEventFixture({
      number: 44,
      body: 'Bumps a dependency.',
      head: { ref: 'chore/bump-deps' },
    });
    const result = runScript(file);
    expect(result.status).toBe(0);
  });
});
