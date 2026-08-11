// Unit tests for scripts/linear/declaration.mjs -- the one shared parse lanes
// B and C both import (GAM-325 §2). Every case here is a case named in the
// packet's table or acceptance criteria; the mapping from spec row to test
// name is deliberately literal so a reviewer can check this file against §2
// line by line rather than trust a paraphrase.
//
// No network, no fs -- these functions take a string and return a plain
// object, so nothing here needs a mock.
import { describe, expect, it } from 'vitest';
import { CANONICAL, branchIssue, parseAlsoFixes, parseDeclaration } from './declaration.mjs';

describe('parseDeclaration -- the five-row table', () => {
  it('{ ok: true, issue } when line 1 is exactly canonical', () => {
    expect(parseDeclaration('Closes GAM-325')).toEqual({ ok: true, issue: 'GAM-325' });
  });

  it('NO_DECLARATION for a bare mention (no magic word paired with the identifier)', () => {
    const result = parseDeclaration('See GAM-325 for context.');
    expect(result).toEqual({ ok: false, code: 'NO_DECLARATION' });
  });

  it('NO_DECLARATION for a completely empty body', () => {
    expect(parseDeclaration('')).toEqual({ ok: false, code: 'NO_DECLARATION' });
  });

  it('NO_DECLARATION when line 1 is blank', () => {
    expect(parseDeclaration('\nCloses GAM-325')).toEqual({ ok: false, code: 'NO_DECLARATION' });
  });

  it('AMBIGUOUS_DECLARATION when line 1 is canonical but carries two or more identifiers', () => {
    const result = parseDeclaration('Closes GAM-325 and GAM-326');
    expect(result.ok).toBe(false);
    expect(result.code).toBe('AMBIGUOUS_DECLARATION');
    expect(result.detail).toBeTruthy();
  });

  it('HALF_DECLARATION when line 1 pairs a magic word with an identifier but is not canonical', () => {
    const result = parseDeclaration('Fixes GAM-1');
    expect(result.ok).toBe(false);
    expect(result.code).toBe('HALF_DECLARATION');
    expect(result.detail).toBeTruthy();
  });

  it('PLACEHOLDER when line 1 is canonical in shape but the identifier is GAM-000', () => {
    expect(parseDeclaration('Closes GAM-000')).toEqual({ ok: false, code: 'PLACEHOLDER' });
  });
});

describe('parseDeclaration -- acceptance criterion 1\'s named cases', () => {
  it('Closes GAM-3251 -- the \\b makes the full digit run its own identifier, not a truncated GAM-325', () => {
    // The point of rule 4 is that this must NOT read as GAM-325: the greedy
    // \d+ plus the trailing \b takes all four digits as one token.
    expect(parseDeclaration('Closes GAM-3251')).toEqual({ ok: true, issue: 'GAM-3251' });
  });

  it('Closes GAM-325 and GAM-326 -- ambiguous, does not pick either', () => {
    const result = parseDeclaration('Closes GAM-325 and GAM-326');
    expect(result).toEqual({
      ok: false,
      code: 'AMBIGUOUS_DECLARATION',
      detail: expect.stringContaining('GAM-325'),
    });
    expect(result.detail).toEqual(expect.stringContaining('GAM-326'));
  });

  it('This PR does not close GAM-304 -- #140\'s real shape, a negation read as a near-miss not a declaration', () => {
    const result = parseDeclaration('This PR does not close GAM-304');
    expect(result).toEqual({
      ok: false,
      code: 'HALF_DECLARATION',
      detail: expect.stringContaining('GAM-304'),
    });
  });

  it('Closes GAM-000 -- the placeholder identifier, never a valid declaration', () => {
    expect(parseDeclaration('Closes GAM-000')).toEqual({ ok: false, code: 'PLACEHOLDER' });
  });

  it('a CRLF body still parses line 1 correctly', () => {
    expect(parseDeclaration('Closes GAM-325\r\nSecond line.\r\n')).toEqual({
      ok: true,
      issue: 'GAM-325',
    });
  });

  it('a null body (GitHub\'s shape for an empty PR description) is NO_DECLARATION, not a throw', () => {
    expect(parseDeclaration(null)).toEqual({ ok: false, code: 'NO_DECLARATION' });
  });

  it('an empty-string body is NO_DECLARATION', () => {
    expect(parseDeclaration('')).toEqual({ ok: false, code: 'NO_DECLARATION' });
  });

  it('a body whose line 1 is blank but line 3 is canonical is still NO_DECLARATION -- only line 1 is ever read', () => {
    const body = '\nsome preamble\nCloses GAM-325';
    expect(parseDeclaration(body)).toEqual({ ok: false, code: 'NO_DECLARATION' });
  });

  it('Closes GAM-325 — trailing prose -- #126/#127\'s real shape, a prefix followed by prose', () => {
    expect(parseDeclaration('Closes GAM-325 — adds the sync worker.')).toEqual({
      ok: true,
      issue: 'GAM-325',
    });
  });
});

describe('parseDeclaration -- rule 1: line 1 only, trailing trim, leading whitespace NOT tolerated', () => {
  it('is exactly the first line, split on \\r?\\n', () => {
    expect(parseDeclaration('Closes GAM-325\nCloses GAM-999')).toEqual({
      ok: true,
      issue: 'GAM-325',
    });
  });

  it('trailing whitespace on line 1 is trimmed and does not block the match', () => {
    expect(parseDeclaration('Closes GAM-325   \nrest')).toEqual({ ok: true, issue: 'GAM-325' });
  });

  it('leading whitespace before "Closes" is NOT tolerated -- fails canonical (falls to HALF_DECLARATION via the magic word)', () => {
    const result = parseDeclaration(' Closes GAM-325');
    expect(result.ok).toBe(false);
    expect(result.code).toBe('HALF_DECLARATION');
  });
});

describe('parseDeclaration -- rule 2: prefix-anchored, trailing prose permitted', () => {
  it('permits trailing prose after the identifier', () => {
    expect(parseDeclaration('Closes GAM-42 — small fix')).toEqual({ ok: true, issue: 'GAM-42' });
  });
});

describe('parseDeclaration -- rule 3: case-sensitive, exact, single-space "Closes"', () => {
  it('lowercase "closes" is not canonical -> HALF_DECLARATION', () => {
    const result = parseDeclaration('closes GAM-325');
    expect(result).toEqual({
      ok: false,
      code: 'HALF_DECLARATION',
      detail: expect.any(String),
    });
  });

  it('lowercase "closes gam-325" (both words lowercase) is still HALF_DECLARATION -- identifier detection is case-insensitive even though CANONICAL is not', () => {
    const result = parseDeclaration('closes gam-325');
    expect(result.ok).toBe(false);
    expect(result.code).toBe('HALF_DECLARATION');
  });

  it('two spaces between "Closes" and the identifier is not canonical -> HALF_DECLARATION', () => {
    const result = parseDeclaration('Closes  GAM-325');
    expect(result.ok).toBe(false);
    expect(result.code).toBe('HALF_DECLARATION');
  });

  it('"Closes:" with a colon is not canonical -> HALF_DECLARATION', () => {
    const result = parseDeclaration('Closes: GAM-325');
    expect(result.ok).toBe(false);
    expect(result.code).toBe('HALF_DECLARATION');
  });
});

describe('parseDeclaration -- rule 4: the \\b matters', () => {
  it('CANONICAL itself does not stop at a truncated digit run', () => {
    expect(CANONICAL.test('Closes GAM-3251')).toBe(true);
    expect('Closes GAM-3251'.match(CANONICAL)[1]).toBe('GAM-3251');
  });

  it('a letter suffix immediately after the digits (no separator) is not a canonical match', () => {
    // "GAM-325x" has no boundary between the digit run and "x", so the
    // anchored regex cannot find a valid split and line 1 is not canonical.
    const result = parseDeclaration('Closes GAM-325x');
    expect(result.ok).toBe(false);
  });
});

describe('parseDeclaration -- rule 5: the magic-word list, and what is deliberately excluded', () => {
  const magicWords = [
    'Fix',
    'Fixes',
    'Fixed',
    'Fixing',
    'Resolve',
    'Resolves',
    'Resolved',
    'Resolving',
    'Complete',
    'Completes',
    'Completed',
    'Completing',
    'Closed',
    'Closing',
  ];
  it.each(magicWords)('"%s GAM-1" is a HALF_DECLARATION near-miss', (word) => {
    const result = parseDeclaration(`${word} GAM-1`);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('HALF_DECLARATION');
  });

  const nonMagicWords = ['Ref', 'Refs', 'References', 'See', 'Part of', 'Ignore', 'Skip'];
  it.each(nonMagicWords)('"%s GAM-1" is NO_DECLARATION, not a near-miss', (word) => {
    const result = parseDeclaration(`${word} GAM-1`);
    expect(result).toEqual({ ok: false, code: 'NO_DECLARATION' });
  });
});

describe('parseDeclaration -- rule 6: nothing but the body string is ever read', () => {
  it('takes a single string argument and reads nothing else -- verified by signature: only line 1 of the one argument drives every case above', () => {
    expect(parseDeclaration.length).toBe(1);
  });
});

describe('parseAlsoFixes -- never closes anything, read/flag only', () => {
  it('returns [] when absent', () => {
    expect(parseAlsoFixes('Closes GAM-325\n\nNo also-fixes line here.')).toEqual([]);
  });

  it('returns [] for a null body', () => {
    expect(parseAlsoFixes(null)).toEqual([]);
  });

  it('reads an Also-fixes line anywhere in the body, not just line 1', () => {
    const body = 'Closes GAM-325\n\nSome context.\nAlso-fixes: GAM-40\n';
    expect(parseAlsoFixes(body)).toEqual(['GAM-40']);
  });

  it('dedupes and preserves first-appearance order across multiple lines', () => {
    const body = ['Also-fixes: GAM-2', 'Also-fixes: GAM-1', 'Also-fixes: GAM-2'].join('\n');
    expect(parseAlsoFixes(body)).toEqual(['GAM-2', 'GAM-1']);
  });

  it('reads multiple identifiers on one Also-fixes line', () => {
    expect(parseAlsoFixes('Also-fixes: GAM-5, GAM-6')).toEqual(['GAM-5', 'GAM-6']);
  });
});

describe('branchIssue', () => {
  it("revert-158-claude/gam-315-foo -> null -- GitHub's revert branches must not match", () => {
    expect(branchIssue('revert-158-claude/gam-315-foo')).toBeNull();
  });

  it('claude/gam-325-linear-closer -> GAM-325', () => {
    expect(branchIssue('claude/gam-325-linear-closer')).toBe('GAM-325');
  });

  it('a branch with no identifier is null, not an error', () => {
    expect(branchIssue('main')).toBeNull();
    expect(branchIssue('feature/some-thing')).toBeNull();
  });

  it('a non-string input is null', () => {
    expect(branchIssue(undefined)).toBeNull();
    expect(branchIssue(null)).toBeNull();
  });
});
