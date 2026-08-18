#!/usr/bin/env node
// GAM-401 -- validates .github/required-checks.json against the workflow
// files that define the checks it names.
//
// WHY THIS EXISTS. Branch protection keys on a check-run's NAME -- the
// job-level `name:` field of a workflow -- not on the job id. Renaming a job
// therefore silently detaches it from the protection rule: the old name
// simply stops reporting, and to GitHub a check that never reports on a PR is
// indistinguishable from a check that was never required. The manifest is the
// repository's one machine-readable statement of which names are load-bearing
// (durable-execution plan §5.8 forbids the steward from inferring them from
// whichever jobs happened to report), and this script fails visibly the
// moment a workflow edit orphans one of those names.
//
// WHAT IT DOES NOT DO. It cannot read the live branch-protection settings --
// no agent session can (GAM-374's verification note measured the 403) -- so
// it validates INTERNAL consistency only: every manifest entry must resolve
// to exactly one job-level `name:` in the workflow file it cites. Whether the
// manifest matches the live required set is the owner's diff (GAM-399
// decision 4); the manifest's own `status` field says "provisional" until
// then.
//
// NO YAML PARSER. The repository deliberately has no YAML dependency, so
// `extractJobNames` is a narrow line-scanner pinned to this repository's
// workflow formatting: `jobs:` at column 0, job ids at 2 spaces, job keys at
// 4 -- so a job-level name is exactly /^ {4}name: /. Step-level names sit
// deeper (`      - name:` and beyond) and never match. That convention is a
// real assumption, so the test file pins the extractor against the REAL
// workflow files; if the formatting convention ever changes, the test goes
// red rather than this script silently extracting nothing.
//
// Exit contract (the declaration gate's rule 6, same reasoning): every path
// ends in an explicit numeric exit code -- 0 valid, 1 invalid or unreadable.
// A validator that dies silently and lets CI report green is the same trap
// as a required check that stops reporting.

import fs from 'node:fs';
import path from 'node:path';

/**
 * Extracts job-level `name:` values from workflow YAML text. Pinned to the
 * repo convention documented in the header: exactly four spaces of indent.
 * Quoted values are unquoted; trailing comments are NOT stripped (a job name
 * with ` # ...` in it would be a formatting defect the tests catch first).
 */
export function extractJobNames(yamlText) {
  const names = [];
  for (const line of yamlText.split('\n')) {
    const m = /^ {4}name: (.+)$/.exec(line);
    if (!m) continue;
    let value = m[1].trim();
    const quote = value[0];
    if ((quote === '"' || quote === "'") && value.endsWith(quote) && value.length >= 2) {
      value = value.slice(1, -1);
    }
    names.push(value);
  }
  return names;
}

/**
 * Validates the parsed manifest against a map of workflow path -> job names.
 * Returns { ok, problems, warnings }; never throws on bad shapes -- a
 * malformed manifest is a named problem, not a crash.
 */
export function validateManifest(manifest, jobNamesByWorkflow) {
  const problems = [];
  const warnings = [];

  const checks = manifest?.requiredChecks;
  if (!Array.isArray(checks) || checks.length === 0) {
    problems.push('manifest has no non-empty `requiredChecks` array');
    return { ok: false, problems, warnings };
  }

  const seen = new Set();
  for (const [i, check] of checks.entries()) {
    const label = `requiredChecks[${i}]`;
    if (typeof check?.name !== 'string' || check.name.trim() === '') {
      problems.push(`${label} has no \`name\` string`);
      continue;
    }
    if (typeof check?.workflow !== 'string' || check.workflow.trim() === '') {
      problems.push(`${label} ("${check.name}") has no \`workflow\` string`);
      continue;
    }
    if (seen.has(check.name)) {
      problems.push(`${label} duplicates the check name "${check.name}"`);
      continue;
    }
    seen.add(check.name);

    const jobNames = jobNamesByWorkflow.get(check.workflow);
    if (jobNames === undefined) {
      problems.push(`${label} cites unreadable workflow ${check.workflow}`);
      continue;
    }
    const hits = jobNames.filter((n) => n === check.name).length;
    if (hits === 0) {
      problems.push(
        `"${check.name}" matches no job-level \`name:\` in ${check.workflow} -- ` +
          'a rename here silently detaches the check from branch protection',
      );
    } else if (hits > 1) {
      problems.push(
        `"${check.name}" matches ${hits} jobs in ${check.workflow} -- check-run names must be unambiguous`,
      );
    }
  }

  // Advisory only: jobs that exist but are not declared required. Not every
  // job must be required -- but the owner should decide that, not silence.
  for (const [workflow, jobNames] of jobNamesByWorkflow) {
    for (const name of jobNames) {
      if (!seen.has(name)) {
        warnings.push(`job "${name}" in ${workflow} is not declared in the manifest`);
      }
    }
  }

  return { ok: problems.length === 0, problems, warnings };
}

/**
 * Reads the manifest and every workflow it cites from `rootDir`, then
 * validates. `readFile` is injected for tests. Returns
 * { exitCode, problems, warnings } -- see the exit contract in the header.
 */
export function runValidation({ rootDir, readFile = fs.readFileSync } = {}) {
  const manifestPath = path.join(rootDir, '.github', 'required-checks.json');
  let manifest;
  try {
    manifest = JSON.parse(readFile(manifestPath, 'utf8'));
  } catch (err) {
    return {
      exitCode: 1,
      problems: [`cannot read or parse ${manifestPath}: ${err.message}`],
      warnings: [],
    };
  }

  const jobNamesByWorkflow = new Map();
  for (const check of Array.isArray(manifest?.requiredChecks) ? manifest.requiredChecks : []) {
    if (typeof check?.workflow !== 'string' || jobNamesByWorkflow.has(check.workflow)) continue;
    try {
      jobNamesByWorkflow.set(
        check.workflow,
        extractJobNames(readFile(path.join(rootDir, check.workflow), 'utf8')),
      );
    } catch {
      // Leave the workflow unreadable; validateManifest names it as a problem.
    }
  }

  const { ok, problems, warnings } = validateManifest(manifest, jobNamesByWorkflow);
  return { exitCode: ok ? 0 : 1, problems, warnings };
}

const invokedDirectly =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);

if (invokedDirectly) {
  const { exitCode, problems, warnings } = runValidation({ rootDir: process.cwd() });
  for (const w of warnings) console.warn(`warning: ${w}`);
  for (const p of problems) console.error(`error: ${p}`);
  console.log(
    exitCode === 0
      ? 'required-checks manifest is internally consistent with the workflow files'
      : 'required-checks manifest FAILED validation',
  );
  process.exit(exitCode);
}
