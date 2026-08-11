// The one shared parse for "does this PR close a Linear issue" (GAM-325 §2).
//
// Lanes B (scripts/linear-sync.mjs) and C (scripts/linear-declaration-check.mjs,
// scripts/linear-reconcile.mjs) both import this module and must not
// re-implement any part of it -- a second copy is exactly how #131's
// branch/declaration mismatch class and #140's negation-read-as-declaration
// class come back, each in its own dialect.
//
// Pure and synchronous throughout: no fetch, no fs, no env. That is
// deliberate -- these functions run inside a sync worker that has already
// paid for its network calls (client.mjs) and inside a gate script that must
// finish in well under its five-minute timeout, so nothing here should ever
// be a reason either caller needs a mock beyond a plain string.

// Canonical shape: line 1 starts with the literal word "Closes", one ASCII
// space, then a GAM identifier. Anchored at the START ONLY -- rule 2 below
// permits trailing prose on the same line, so there is no trailing anchor.
export const CANONICAL = /^Closes (GAM-\d+)\b/;

// Every GAM identifier token, scanned case-insensitively so a near-miss like
// "closes gam-325" is still recognised as *carrying* an identifier for
// HALF_DECLARATION purposes, even though it fails the case-sensitive
// CANONICAL match above. `\b` on both sides keeps "GAM-3251" one token (not
// "GAM-325" + "1") and keeps a token from being read out of a larger word.
const IDENTIFIER_RE = /\bGAM-\d+\b/gi;

// The GitHub + Linear closing verbs (§2 rule 5), case-insensitively. This
// list is deliberately narrow: `ref`, `refs`, `references`, `see`, `part of`,
// `ignore`, `skip` are NOT here, so a line-1 mention paired with an
// identifier via one of those words is NO_DECLARATION, not a near-miss. A
// wider list would turn ordinary cross-references into gate failures.
const MAGIC_WORD_RE =
  /\b(close|closes|closed|closing|fix|fixes|fixed|fixing|resolve|resolves|resolved|resolving|complete|completes|completed|completing)\b/i;

// Every line matching this is a secondary, non-closing reference -- read
// anywhere in the body, never just line 1. See parseAlsoFixes below.
const ALSO_FIXES_RE = /^Also-fixes:\s*(.+)$/;

/**
 * Line 1 only, trailing whitespace trimmed, LEADING whitespace preserved
 * (and therefore NOT tolerated by CANONICAL's `^` anchor -- a body that
 * opens with a blank or indented line has no declaration; §2 rule 1 calls
 * this the fail-safe direction, since under-closing costs one push through
 * lane C's gate rather than silently mis-closing the wrong issue).
 *
 * `body` may be `null` (GitHub returns that for an empty PR description) or
 * use CRLF line endings -- both are handled here so every caller gets a
 * plain string back.
 */
function firstLine(body) {
  if (typeof body !== 'string') return '';
  const [line] = body.split(/\r?\n/);
  return line.replace(/[ \t]+$/, '');
}

/** Every GAM identifier on `line`, deduped-by-nothing (raw occurrence order), uppercased. */
function identifiersOn(line) {
  return [...line.matchAll(IDENTIFIER_RE)].map((m) => m[0].toUpperCase());
}

/**
 * Classify a PR body's declaration. Never throws -- every input, including
 * `null` and an empty string, resolves to one of the five shapes in §2's
 * table. See the packet for the full rationale on each; the short version:
 * this function would rather return NO_DECLARATION on a body it cannot read
 * than guess, because a guess that is wrong in the "closes" direction writes
 * to Linear.
 */
export function parseDeclaration(body) {
  const line1 = firstLine(body);

  if (CANONICAL.test(line1)) {
    const identifiers = identifiersOn(line1);
    if (identifiers.length > 1) {
      return {
        ok: false,
        code: 'AMBIGUOUS_DECLARATION',
        detail: `line 1 names ${identifiers.length} issues (${identifiers.join(', ')}), not one`,
      };
    }
    const [issue] = identifiers;
    // Canonical shape, single token, but the token is the placeholder GitHub
    // suggests in PR templates before an author fills in the real number.
    if (issue === 'GAM-000') {
      return { ok: false, code: 'PLACEHOLDER' };
    }
    return { ok: true, issue };
  }

  // Not the canonical anchored form. If line 1 still pairs a closing verb
  // with an identifier, that is a near-miss worth naming (HALF_DECLARATION)
  // rather than silently treating as no declaration at all -- this is what
  // catches `Fixes GAM-1`, `This closes GAM-1`, and negations like
  // `This PR does not close GAM-304` (#140's real shape), where reading the
  // magic word alone would wrongly treat the sentence as a declaration.
  const identifiers = identifiersOn(line1);
  if (identifiers.length > 0 && MAGIC_WORD_RE.test(line1)) {
    return {
      ok: false,
      code: 'HALF_DECLARATION',
      detail: `line 1 pairs a closing verb with ${identifiers.join(', ')} but is not the canonical "Closes GAM-<n>" form: ${JSON.stringify(line1)}`,
    };
  }

  return { ok: false, code: 'NO_DECLARATION' };
}

/**
 * `Also-fixes:` is read from ANY body line (not just line 1) and never
 * closes anything -- §6.3 is explicit that this function's identifiers are
 * for existence-validation and human awareness only. A caller that ever
 * makes an `issueUpdate` off this list has reintroduced the confound §6.3
 * cut deliberately.
 */
export function parseAlsoFixes(body) {
  if (typeof body !== 'string') return [];

  const seen = new Set();
  const out = [];
  for (const line of body.split(/\r?\n/)) {
    const m = ALSO_FIXES_RE.exec(line);
    if (!m) continue;
    for (const id of identifiersOn(m[1])) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

/**
 * The issue a branch name declares, or `null`. Anchored at the START, so
 * GitHub's own `revert-NNN-claude/gam-…` revert branches -- which contain
 * the pattern but not at position 0 -- do not match (§6.3). A branch with no
 * identifier at all is a normal, non-error case: infra and mention PRs use
 * branches this function has nothing to say about.
 */
export function branchIssue(headRef) {
  if (typeof headRef !== 'string') return null;
  const m = /^claude\/gam-(\d+)-/.exec(headRef);
  if (!m) return null;
  return `GAM-${m[1]}`;
}
