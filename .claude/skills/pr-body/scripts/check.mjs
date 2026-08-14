#!/usr/bin/env node
// Check a PR body against the same parse the `Linear declaration` gate uses,
// before the PR is opened rather than after CI says no.
//
// THE PARSE IS IMPORTED, NEVER RE-DERIVED. `scripts/linear/declaration.mjs`
// is the one shared copy (GAM-325 §2) and its header forbids a second one by
// name: #131's branch/declaration mismatch class and #140's
// negation-read-as-declaration class are exactly what a second copy brings
// back, each in its own dialect. A regex in this file would BE that defect,
// in a script whose whole purpose is to prevent it.
//
// Usage:
//   node check.mjs <file> [--branch <head-ref>]
//   node check.mjs --stdin [--branch <head-ref>]
//
// Exit codes:
//   0  the declaration gate will accept this body (warnings may still print)
//   1  the declaration gate will reject it, or it contradicts its own branch
//   2  could not read the input

import { readFileSync } from 'node:fs';
import {
  branchIssue,
  parseAlsoFixes,
  parseDeclaration,
} from '../../../../scripts/linear/declaration.mjs';

// Why each rejection happens, in the words an author needs rather than the
// parser's. The parser's own `detail` is appended when it supplies one.
const EXPLANATIONS = {
  NO_DECLARATION:
    'line 1 is not `Closes GAM-<n>`. A blank or indented first line counts as no declaration.',
  HALF_DECLARATION:
    'line 1 names an issue but is not the canonical form. It must start with the literal `Closes`, capital C, nothing before it.',
  AMBIGUOUS_DECLARATION: 'line 1 must name exactly one issue. Use `Also-fixes:` for the others.',
  PLACEHOLDER: 'line 1 still carries the template default `GAM-000`. Put the real number in.',
};

// Sections the template prompts for. Missing ones are reported, never failed:
// a one-line infra PR legitimately has none of them, and a checker that cries
// wolf on those gets ignored on the PR where it matters.
const RECOMMENDED = [
  ['## What changed', 'what the code can now do that it could not before'],
  ['## Verification', 'the gate-run evidence block, pasted rather than retyped'],
];

/**
 * Judge a body. Pure: takes strings, returns a plain object, touches nothing.
 *
 * `branch` is optional. When given AND the branch names an issue AND the body
 * declares a different one, that is an error rather than a warning -- it is
 * #131's shape, and it closes the wrong row on merge.
 */
export function checkBody(body, { branch } = {}) {
  const errors = [];
  const warnings = [];

  const declaration = parseDeclaration(body);
  if (!declaration.ok) {
    const explanation = EXPLANATIONS[declaration.code] ?? declaration.code;
    errors.push(
      declaration.detail
        ? `${declaration.code}: ${explanation} (${declaration.detail})`
        : `${declaration.code}: ${explanation}`
    );
  }

  const fromBranch = branchIssue(branch);
  if (declaration.ok && fromBranch && fromBranch !== declaration.issue) {
    errors.push(
      `BRANCH_MISMATCH: the branch names ${fromBranch} but line 1 closes ${declaration.issue}. ` +
        `Both link on merge, so this closes a row the branch did not work.`
    );
  }

  const text = typeof body === 'string' ? body : '';

  if (declaration.ok && !new RegExp(`^Linear-Issue:.*\\b${declaration.issue}\\b`, 'm').test(text)) {
    warnings.push(
      `no \`Linear-Issue: ${declaration.issue}\` trailer. No automation reads it; it is the git-side record (AGENTS.md item 6).`
    );
  }

  for (const [heading, why] of RECOMMENDED) {
    if (!text.includes(heading)) warnings.push(`no \`${heading}\` section — ${why}.`);
  }

  // Not an error: a body may legitimately mention an identifier it does not
  // close. It is worth surfacing only because `Ignore GAM-nnn` is routinely
  // mistaken for a defect and deleted (AGENTS.md item 5).
  for (const line of text.split(/\r?\n/)) {
    if (/^\s*(ignore|skip|ref)\s+GAM-\d+/i.test(line)) {
      warnings.push(
        `\`${line.trim()}\` holds a linked row back from closing. This is deliberate — do not remove it.`
      );
    }
  }

  return {
    ok: errors.length === 0,
    issue: declaration.ok ? declaration.issue : null,
    alsoFixes: parseAlsoFixes(text),
    errors,
    warnings,
  };
}

/**
 * The first positional argument, skipping `--branch`'s value.
 *
 * Extracted and exported because the obvious one-liner is wrong: with no
 * `--branch` present, `indexOf` returns -1 and `argv[-1 + 1]` is `argv[0]`,
 * which is the filename -- so the CLI rejected every invocation that did not
 * also pass a branch. Compared by INDEX, not by value, so a file that happens
 * to share a name with a branch is still found.
 */
export function selectFile(argv) {
  const branchIndex = argv.indexOf('--branch');
  const valueIndex = branchIndex === -1 ? -1 : branchIndex + 1;
  return argv.find((arg, index) => index !== valueIndex && !arg.startsWith('--')) ?? null;
}

function readInput(argv) {
  if (argv.includes('--stdin')) return readFileSync(0, 'utf8');
  const file = selectFile(argv);
  if (!file) {
    process.stderr.write('usage: check.mjs <file> [--branch <head-ref>]\n');
    process.exit(2);
  }
  return readFileSync(file, 'utf8');
}

function main() {
  const argv = process.argv.slice(2);
  const branchIndex = argv.indexOf('--branch');
  const branch = branchIndex === -1 ? undefined : argv[branchIndex + 1];

  let body;
  try {
    body = readInput(argv);
  } catch (error) {
    process.stderr.write(`cannot read input: ${error.message}\n`);
    process.exit(2);
  }

  const result = checkBody(body, { branch });

  for (const error of result.errors) process.stdout.write(`ERROR   ${error}\n`);
  for (const warning of result.warnings) process.stdout.write(`warn    ${warning}\n`);

  if (result.ok) {
    const also = result.alsoFixes.length ? `, also-fixes ${result.alsoFixes.join(', ')}` : '';
    process.stdout.write(`OK      declaration closes ${result.issue}${also}\n`);
  }

  process.exit(result.ok ? 0 : 1);
}

// Only run the CLI when invoked directly, so the test file can import
// `checkBody` without the process exiting under it.
if (process.argv[1] && process.argv[1].endsWith('check.mjs')) main();
