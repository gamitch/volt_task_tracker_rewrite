// Unit tests for scripts/required-checks-validate.mjs -- GAM-401.
//
// The last describe block is the real drift guard: it runs the validator
// against THIS repository's actual manifest and workflow files, so renaming
// a required job in ci.yml (or reformatting the workflows away from the
// 4-space job-key convention the extractor is pinned to) turns this file red
// instead of silently orphaning a branch-protection check name.
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractJobNames, runValidation, validateManifest } from './required-checks-validate.mjs';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const FIXTURE_YAML = [
  'name: CI',
  'on:',
  '  push:',
  'jobs:',
  '  ci:',
  '    name: Build and test',
  '    runs-on: ubuntu-latest',
  '    steps:',
  '      - name: Checkout', // step-level: must NOT be extracted
  '        uses: actions/checkout@v4',
  '      - name: Build',
  '        run: npm run build',
  '  gate:',
  "    name: 'Quoted gate'",
  '    runs-on: ubuntu-latest',
].join('\n');

describe('extractJobNames', () => {
  it('extracts job-level names and unquotes them', () => {
    expect(extractJobNames(FIXTURE_YAML)).toEqual(['Build and test', 'Quoted gate']);
  });

  it('excludes step-level names and the workflow-level name', () => {
    const names = extractJobNames(FIXTURE_YAML);
    expect(names).not.toContain('Checkout');
    expect(names).not.toContain('Build');
    expect(names).not.toContain('CI');
  });
});

describe('validateManifest', () => {
  const workflows = new Map([['wf.yml', ['Build and test', 'Quoted gate']]]);

  it('passes when every check resolves to exactly one job name', () => {
    const manifest = {
      requiredChecks: [
        { name: 'Build and test', workflow: 'wf.yml' },
        { name: 'Quoted gate', workflow: 'wf.yml' },
      ],
    };
    const result = validateManifest(manifest, workflows);
    expect(result.problems).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it('fails on a renamed job -- the drift this validator exists for', () => {
    const manifest = { requiredChecks: [{ name: 'Build & test', workflow: 'wf.yml' }] };
    const result = validateManifest(manifest, workflows);
    expect(result.ok).toBe(false);
    expect(result.problems.join('\n')).toMatch(/matches no job-level/);
  });

  it('fails on an unreadable workflow, a duplicate name, and an empty manifest', () => {
    expect(
      validateManifest({ requiredChecks: [{ name: 'X', workflow: 'gone.yml' }] }, workflows).ok,
    ).toBe(false);
    expect(
      validateManifest(
        {
          requiredChecks: [
            { name: 'Quoted gate', workflow: 'wf.yml' },
            { name: 'Quoted gate', workflow: 'wf.yml' },
          ],
        },
        workflows,
      ).ok,
    ).toBe(false);
    expect(validateManifest({ requiredChecks: [] }, workflows).ok).toBe(false);
    expect(validateManifest(undefined, workflows).ok).toBe(false);
  });

  it('warns, but does not fail, on jobs the manifest does not declare', () => {
    const manifest = { requiredChecks: [{ name: 'Build and test', workflow: 'wf.yml' }] };
    const result = validateManifest(manifest, workflows);
    expect(result.ok).toBe(true);
    expect(result.warnings.join('\n')).toMatch(/Quoted gate/);
  });
});

describe('runValidation against this repository (the live drift guard)', () => {
  it('the committed manifest matches the committed workflows', () => {
    const { exitCode, problems } = runValidation({ rootDir: REPO_ROOT });
    expect(problems).toEqual([]);
    expect(exitCode).toBe(0);
  });

  it('reports exit 1, not a throw, for a missing manifest', () => {
    const { exitCode, problems } = runValidation({ rootDir: path.join(REPO_ROOT, 'src') });
    expect(exitCode).toBe(1);
    expect(problems.join('\n')).toMatch(/cannot read or parse/);
  });
});
