#!/usr/bin/env node
// GAM-325 D3 -- the PR-time declaration gate.
//
// Runs on `pull_request: [opened, edited, synchronize, ready_for_review]`
// (lane D's `.github/workflows/linear-declaration-gate.yml`). Metadata-only:
// it reads the PR's body and head branch out of the event payload and never
// checks out the PR's code.
//
// THE PARSER IT USES IS NOT THE PR'S OWN. A PR could otherwise rewrite
// scripts/linear/declaration.mjs to make its own declaration parse as
// canonical -- so this script loads the parse module's SOURCE from the
// default branch's ref via one GitHub Contents API fetch (§6.4) and only
// falls back to the local (checked-out) copy, loudly, when that fetch
// fails. `loadParser` below is the one place this happens.
//
// RULE 6 IS BINDING ON THIS FILE, NOT JUST ON LANE D'S WORKFLOW YAML: the
// gate never conditionally skips. Every path through `runGate` returns a
// plain object carrying a real, numeric `exitCode` (0 or 1) -- the outer
// try/catch in `runGate` makes that true even for a thrown error nobody
// anticipated, and `main` always calls `process.exit` with that number.
// There is no `return` anywhere in this file that leaves the process to
// fall off the end and exit 0 by default; a required job that reports
// Success without ever having run its check is exactly the trap this gate
// exists to close (see the packet's rule 6 and the AGENTS.md wall-1 note on
// `.github/workflows/**`, which is a different wall but the same "silent
// skip" failure shape).
//
// Nothing here writes to Linear or to GitHub. Rule 5's Also-fixes existence
// check is a read-only query and is always advisory (warn, never fail) --
// see `validateAlsoFixes` for the reasoning on why "existence-validated
// when a key is present" is read as "checked and reported accurately," not
// as "fails the gate."

import fs from 'node:fs';

const CONTENTS_API = (repo, ref) =>
  `https://api.github.com/repos/${repo}/contents/scripts/linear/declaration.mjs?ref=${encodeURIComponent(ref)}`;

const REQUIRED_PARSER_EXPORTS = ['parseDeclaration', 'branchIssue', 'parseAlsoFixes', 'CANONICAL'];

/**
 * Fetches scripts/linear/declaration.mjs's SOURCE from `repo`@`ref` (the
 * default branch, not the PR's head) and dynamically imports it via a
 * `data:` URL -- no temp file, no network beyond the one fetch below. Falls
 * back to the local module, with an explicit logged reason, when:
 *   - `repo`/`ref` are unavailable (no fetch is even attempted -- there is
 *     nothing to fetch from), or
 *   - the fetch fails (non-2xx, network error, or timeout), or
 *   - the fetched source does not export what this script needs.
 *
 * `fetchImpl`/`importModule`/`log` are injected so this is testable without
 * a real network call and without actually executing untrusted fetched code
 * inside the test process (a stub `importModule` returns a canned module).
 */
export async function loadParser({
  repo,
  ref,
  token,
  fetchImpl = fetch,
  importModule = defaultImportModule,
  log = console.error,
} = {}) {
  if (repo && ref) {
    try {
      const headers = { Accept: 'application/vnd.github.raw+json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await fetchImpl(CONTENTS_API(repo, ref), {
        headers,
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const source = await res.text();
      const mod = await importModule(source);
      assertParserShape(mod);
      return { mod, source: 'remote', ref };
    } catch (err) {
      log(
        `WARNING: could not load scripts/linear/declaration.mjs from ${repo}@${ref} -- ` +
          `${err instanceof Error ? err.message : String(err)}. Falling back to the local ` +
          `(checked-out) module -- this run's parser is then the PR's own copy, not the ` +
          `default branch's.`,
      );
    }
  } else {
    log(
      'WARNING: no repo/ref available to fetch the default-branch parser (GITHUB_REPOSITORY ' +
        "unset, or the event payload's repository.default_branch is missing) -- falling back " +
        'to the local module without attempting a remote fetch.',
    );
  }
  const mod = await import('./linear/declaration.mjs');
  return { mod, source: 'local-fallback', ref: null };
}

function assertParserShape(mod) {
  const missing = REQUIRED_PARSER_EXPORTS.filter((key) => !(key in mod));
  if (missing.length > 0) {
    throw new Error(`fetched module is missing expected export(s): ${missing.join(', ')}`);
  }
}

async function defaultImportModule(source) {
  const url = `data:text/javascript;charset=utf-8,${encodeURIComponent(source)}`;
  return import(url);
}

/**
 * Pure. Applies §4 rules 1-4 to one PR's `{ body, headRef }` using the
 * loaded parser module (never re-implementing any part of the parse --
 * every check below is expressed in terms of `parseDeclaration`,
 * `branchIssue` and `CANONICAL`, all imported). Returns an array of
 * findings; the gate is green iff this array is empty.
 *
 * NOT HANDLED HERE, DELIBERATELY: `AMBIGUOUS_DECLARATION` (line 1 matches
 * `CANONICAL` by regex -- it IS the canonical anchored form -- but carries a
 * second identifier). §4's rule 1 text is scoped to "not the canonical
 * anchored form," which an ambiguous line 1 literally is not (it is), so it
 * is not added here. Lane B's sync already reports it (Slack ⚠, no state
 * move) at merge time. See this lane's worker report for the full reasoning
 * -- this is a judgment call, not a re-reading of an explicit rule.
 */
export function evaluateDeclaration({ body, headRef }, parser) {
  const { parseDeclaration, branchIssue, CANONICAL } = parser;
  const findings = [];
  const result = parseDeclaration(body);

  // Rule 1: a line-1 magic-word + identifier pairing that is not canonical
  // goes red, naming the canonical form.
  if (!result.ok && result.code === 'HALF_DECLARATION') {
    findings.push({
      rule: 1,
      message: `nothing closes unless line 1 starts with "Closes GAM-nnn" -- ${result.detail}`,
    });
  }

  // Rule 2: GAM-000 is never a valid declaration.
  if (!result.ok && result.code === 'PLACEHOLDER') {
    findings.push({
      rule: 2,
      message: 'line 1 is canonical in shape but declares GAM-000, the placeholder identifier -- never a valid declaration.',
    });
  }

  // Rule 3: a `claude/gam-<n>-...` head branch must carry a canonical
  // declaration for that EXACT issue, or the PR goes red -- the #131
  // mismatch class and the stale-branch class, caught before merge.
  const branchGam = branchIssue(headRef);
  if (branchGam && !(result.ok && result.issue === branchGam)) {
    const found = result.ok
      ? `line 1 canonically declares ${result.issue} instead`
      : `line 1 has no canonical declaration for it (${result.code})`;
    findings.push({
      rule: 3,
      message: `head branch ${JSON.stringify(headRef)} declares ${branchGam}, but ${found}.`,
    });
  }

  // Rule 4 (this packet's addition, ruled KEEP -- see the packet's LCD 3):
  // when line 1 has no canonical declaration, a LATER body line that
  // matches the canonical form exactly is a silent under-close waiting to
  // happen -- go red naming the line number rather than staying quiet.
  if (!result.ok) {
    const lines = typeof body === 'string' ? body.split(/\r?\n/) : [];
    for (let i = 1; i < lines.length; i += 1) {
      const line = lines[i].replace(/[ \t]+$/, '');
      if (CANONICAL.test(line)) {
        findings.push({
          rule: 4,
          message:
            `line 1 has no canonical declaration, but line ${i + 1} matches the canonical ` +
            `form exactly -- move it to line 1: ${JSON.stringify(line)}`,
        });
        break;
      }
    }
  }

  return findings;
}

/**
 * Rule 5. `identifiers` is `parseAlsoFixes(body)`'s output -- never used to
 * close anything (§6.3), read here purely to tell a contributor whether
 * each identifier actually exists in Linear.
 *
 * Always advisory: the return value is a list of warning strings, and this
 * function never throws in a way that changes the caller's exit code. Read
 * literally, §4 rule 5 draws a line between "existence-validated when a key
 * is present" and "advisory (warn, do not fail) when it is not" -- this
 * implementation reads that as "checked and accurately reported" vs.
 * "cannot be checked, so the warning is generic," not as "fails the gate
 * when a key is present." See this lane's worker report: that reading is a
 * judgment call the packet leaves open, not an explicit instruction either
 * way, and §6.3's "flag once" for Also-fixes elsewhere argues for never
 * failing.
 */
export async function validateAlsoFixes(identifiers, { apiKey, existenceCheck = defaultExistenceCheck } = {}) {
  if (identifiers.length === 0) return [];

  if (!apiKey) {
    return [
      `Also-fixes: ${identifiers.join(', ')} not existence-validated -- no read-only Linear key ` +
        'present (advisory only; this never fails the gate).',
    ];
  }

  const warnings = [];
  for (const id of identifiers) {
    try {
      const exists = await existenceCheck(id, apiKey);
      if (!exists) {
        warnings.push(`Also-fixes: ${id} does not exist in Linear (advisory only; this never fails the gate).`);
      }
    } catch (err) {
      warnings.push(
        `Also-fixes: ${id} could not be existence-validated (${err instanceof Error ? err.message : String(err)}) -- advisory only.`,
      );
    }
  }
  return warnings;
}

async function defaultExistenceCheck(identifier) {
  const { gql } = await import('./linear/client.mjs');
  try {
    const { data } = await gql('query($id: String!) { issue(id: $id) { identifier } }', { id: identifier });
    return Boolean(data?.issue);
  } catch (err) {
    if (err instanceof Error && /Entity not found: Issue/.test(err.message)) return false;
    // Any other failure (auth, rate limit, complexity) is UNDETERMINED, not
    // "confirmed missing" -- rethrow so the caller reports it as such rather
    // than wrongly claiming the identifier does not exist.
    throw err;
  }
}

async function defaultReadEventFile(path) {
  return fs.promises.readFile(path, 'utf8');
}

/**
 * The whole gate, wrapped in one try/catch so `exitCode` is ALWAYS a real
 * number by the time this resolves -- rule 6. Every early return below is
 * explicit; nothing here falls through to an implicit success.
 */
export async function runGate({
  env = process.env,
  fetchImpl = fetch,
  importModule = defaultImportModule,
  existenceCheck = defaultExistenceCheck,
  readEventFile = defaultReadEventFile,
  log = console,
} = {}) {
  const logError = (...args) => (log.error ?? log.log ?? (() => {}))(...args);
  const logInfo = (...args) => (log.log ?? log.error ?? (() => {}))(...args);

  try {
    const eventPath = env.GITHUB_EVENT_PATH;
    if (!eventPath) {
      logError('GITHUB_EVENT_PATH is not set -- nothing to check. Failing closed.');
      return { exitCode: 1, findings: [{ rule: 0, message: 'GITHUB_EVENT_PATH is not set' }] };
    }

    let payload;
    try {
      payload = JSON.parse(await readEventFile(eventPath));
    } catch (err) {
      logError(
        `Could not read/parse GITHUB_EVENT_PATH (${eventPath}): ${err instanceof Error ? err.message : String(err)}`,
      );
      return { exitCode: 1, findings: [{ rule: 0, message: 'could not read/parse the event payload' }] };
    }

    const pr = payload.pull_request;
    if (!pr) {
      logError('No pull_request object in the event payload -- nothing to check. Failing closed.');
      return { exitCode: 1, findings: [{ rule: 0, message: 'no pull_request in the event payload' }] };
    }

    const repo = env.GITHUB_REPOSITORY;
    const ref = payload.repository?.default_branch || 'main';
    const { mod: parser, source } = await loadParser({
      repo,
      ref,
      token: env.GITHUB_TOKEN,
      fetchImpl,
      importModule,
      log: logError,
    });
    logInfo(`Parser loaded from: ${source}${source === 'remote' ? ` (${repo}@${ref})` : ' (fallback)'}`);

    const findings = evaluateDeclaration({ body: pr.body, headRef: pr.head?.ref }, parser);
    for (const f of findings) logError(`RED [rule ${f.rule}] ${f.message}`);

    const alsoFixes = parser.parseAlsoFixes(pr.body);
    const warnings = await validateAlsoFixes(alsoFixes, { apiKey: env.LINEAR_API_KEY, existenceCheck });
    for (const w of warnings) logError(`WARN ${w}`);

    if (findings.length === 0) {
      logInfo('Declaration gate: green.');
    } else {
      logInfo(`Declaration gate: red (${findings.length} finding(s)).`);
    }

    return { exitCode: findings.length > 0 ? 1 : 0, findings, warnings, parserSource: source };
  } catch (err) {
    logError(`UNEXPECTED ERROR: ${err instanceof Error ? (err.stack ?? err.message) : String(err)}`);
    return { exitCode: 1, findings: [{ rule: -1, message: 'unexpected error' }], error: true };
  }
}

async function main() {
  const result = await runGate();
  process.exit(result.exitCode);
}

// Only run when invoked directly, so this module is import-safe for its test
// file (which imports the exported functions and nothing else). Wrapped in
// its own .catch so that even a throw main() never anticipated still ends in
// an explicit process.exit(1) rather than an unhandled rejection with no
// exit code at all.
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(`UNEXPECTED ERROR: ${err instanceof Error ? err.stack : err}`);
    process.exit(1);
  });
}
