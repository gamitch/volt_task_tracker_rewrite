#!/usr/bin/env node
// Tests for check.mjs. Run directly -- `vite.config.ts:42` excludes
// `**/.claude/**` from vitest, so a test placed here is collected by nothing
// unless CI invokes it by name. The `skill-scripts` job does exactly that,
// same as mutation-replay's and gate-run's parsers.
//
//   node .claude/skills/pr-body/scripts/check.test.mjs
//
// No network, no fixtures beyond the real template: these are string in,
// object out.

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { checkBody, selectFile } from './check.mjs';

const TEMPLATE = fileURLToPath(new URL('../../../../.github/pull_request_template.md', import.meta.url));

let failures = 0;
function test(name, fn) {
  try {
    fn();
    process.stdout.write(`  ok    ${name}\n`);
  } catch (error) {
    failures += 1;
    process.stdout.write(`  FAIL  ${name}\n        ${error.message.split('\n')[0]}\n`);
  }
}

const codeOf = (result) => result.errors.map((e) => e.split(':')[0]);

// --- the five declaration shapes, delegated to the shared parser -----------

test('canonical line 1 passes and reports the issue', () => {
  const result = checkBody('Closes GAM-325\n\n## What changed\n\nx\n\n## Verification\n\ny\n');
  assert.equal(result.ok, true);
  assert.equal(result.issue, 'GAM-325');
});

test('trailing prose on line 1 is still canonical', () => {
  assert.equal(checkBody('Closes GAM-325 — and here is why\n').ok, true);
});

test('an empty body is NO_DECLARATION', () => {
  assert.deepEqual(codeOf(checkBody('')), ['NO_DECLARATION']);
});

test('a null body is NO_DECLARATION rather than a crash', () => {
  assert.deepEqual(codeOf(checkBody(null)), ['NO_DECLARATION']);
});

test('`Fixes GAM-1` is HALF_DECLARATION, not accepted', () => {
  assert.deepEqual(codeOf(checkBody('Fixes GAM-1\n')), ['HALF_DECLARATION']);
});

test('a negation is HALF_DECLARATION, never a declaration (#140)', () => {
  assert.deepEqual(codeOf(checkBody('This PR does not close GAM-304\n')), ['HALF_DECLARATION']);
});

test('two identifiers on line 1 is AMBIGUOUS_DECLARATION', () => {
  assert.deepEqual(codeOf(checkBody('Closes GAM-1 and GAM-2\n')), ['AMBIGUOUS_DECLARATION']);
});

// The anchor is at position 0, so indentation breaks CANONICAL -- but the line
// still pairs a closing verb with an identifier, which is the near-miss the
// parser names rather than swallowing. Only a line carrying no identifier at
// all falls through to NO_DECLARATION.
test('an indented `Closes GAM-n` is HALF_DECLARATION, not accepted', () => {
  assert.deepEqual(codeOf(checkBody('  Closes GAM-325\n')), ['HALF_DECLARATION']);
});

test('a tab-indented line 1 is rejected the same way', () => {
  assert.deepEqual(codeOf(checkBody('\tCloses GAM-325\n')), ['HALF_DECLARATION']);
});

test('an indented line with no identifier is NO_DECLARATION', () => {
  assert.deepEqual(codeOf(checkBody('   just indented prose\n')), ['NO_DECLARATION']);
});

// --- the template itself ---------------------------------------------------

test('the shipped template is PLACEHOLDER, not NO_DECLARATION', () => {
  const result = checkBody(readFileSync(TEMPLATE, 'utf8'));
  assert.equal(result.ok, false);
  assert.deepEqual(codeOf(result), ['PLACEHOLDER']);
});

test('the template becomes valid once the number is filled in', () => {
  const filled = readFileSync(TEMPLATE, 'utf8').replace(/^Closes GAM-000/, 'Closes GAM-383');
  const result = checkBody(filled);
  assert.equal(result.ok, true, result.errors.join(' | '));
  assert.equal(result.issue, 'GAM-383');
});

// --- branch agreement (#131's class) ---------------------------------------

test('a branch naming a different issue than line 1 is an error', () => {
  const result = checkBody('Closes GAM-999\n', { branch: 'claude/gam-325-something' });
  assert.equal(result.ok, false);
  assert.ok(codeOf(result).includes('BRANCH_MISMATCH'));
});

test('a branch naming the same issue is fine', () => {
  assert.equal(checkBody('Closes GAM-325\n', { branch: 'claude/gam-325-x' }).ok, true);
});

test('a branch with no identifier is a normal, non-error case', () => {
  assert.equal(checkBody('Closes GAM-325\n', { branch: 'chore/tidy-readme' }).ok, true);
});

test('a revert branch does not match, so it raises no mismatch', () => {
  assert.equal(
    checkBody('Closes GAM-325\n', { branch: 'revert-12-claude/gam-999-x' }).ok,
    true
  );
});

// --- warnings, which must never fail a body --------------------------------

test('a missing Linear-Issue trailer warns but passes', () => {
  const result = checkBody('Closes GAM-325\n');
  assert.equal(result.ok, true);
  assert.ok(result.warnings.some((w) => w.includes('Linear-Issue')));
});

test('a present Linear-Issue trailer produces no such warning', () => {
  const result = checkBody('Closes GAM-325\n\nbody\n\nLinear-Issue: GAM-325\n');
  assert.ok(!result.warnings.some((w) => w.includes('Linear-Issue')));
});

test('`Ignore GAM-nnn` is surfaced as deliberate, and does not fail (item 5)', () => {
  const result = checkBody('Closes GAM-325\n\nIgnore GAM-123\n');
  assert.equal(result.ok, true);
  assert.ok(result.warnings.some((w) => w.includes('do not remove it')));
});

test('Also-fixes identifiers are reported and close nothing', () => {
  const result = checkBody('Closes GAM-325\n\nAlso-fixes: GAM-1, GAM-2\n');
  assert.equal(result.issue, 'GAM-325');
  assert.deepEqual(result.alsoFixes, ['GAM-1', 'GAM-2']);
});

// --- argument selection ----------------------------------------------------
// These exist because the first version of `selectFile` was wrong in exactly
// the case with no `--branch`: `argv[indexOf('--branch') + 1]` is `argv[0]`
// when indexOf returns -1, so the CLI rejected every plain `check.mjs <file>`.
// Caught by running the CLI, not by the checkBody tests, which never touch it.

test('a bare file argument is found', () => {
  assert.equal(selectFile(['body.md']), 'body.md');
});

test('a file argument is found when --branch follows it', () => {
  assert.equal(selectFile(['body.md', '--branch', 'claude/gam-1-x']), 'body.md');
});

test('a file argument is found when --branch precedes it', () => {
  assert.equal(selectFile(['--branch', 'claude/gam-1-x', 'body.md']), 'body.md');
});

test("--branch's value is never mistaken for the file", () => {
  assert.equal(selectFile(['--branch', 'body.md']), null);
});

test('a file sharing a name with the branch is still found, because index decides', () => {
  assert.equal(selectFile(['--branch', 'main', 'main']), 'main');
});

test('no positional argument yields null rather than a flag', () => {
  assert.equal(selectFile(['--stdin']), null);
});

process.stdout.write(`\n${failures === 0 ? 'PASS' : `FAIL — ${failures} failing`}\n`);
process.exit(failures === 0 ? 0 : 1);
