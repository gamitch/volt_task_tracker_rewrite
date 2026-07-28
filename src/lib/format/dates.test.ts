// T129 (UXC-11): tests for `dates.ts`. New module, new test file -- same
// colocated-test convention `src/lib/supabase/client.test.ts` already
// established for this directory tree.
//
// No `@types/node` is installed in this repo (confirmed via `tsc --noEmit`:
// referencing the bare `process` global fails to typecheck), so the
// UTC-midnight trap is proven by spying on the `Intl.DateTimeFormat`
// constructor call itself (asserting `timeZone: 'UTC'` was passed) rather
// than by mutating `process.env.TZ` and re-observing host-local output.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatFriendlyDate, formatFriendlyDateRange } from './dates.ts';

describe('formatFriendlyDate (UTC-midnight date-only trap)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('formats a plain YYYY-MM-DD date as a short, friendly label', () => {
    expect(formatFriendlyDate('2026-07-22')).toBe('Wed, Jul 22');
  });

  it('never renders the raw ISO string', () => {
    expect(formatFriendlyDate('2026-06-01')).not.toContain('2026-06-01');
  });

  it('pins timeZone: "UTC" explicitly on the underlying Intl.DateTimeFormat call (the trap `formatSessionDateLabel` was seeded to avoid -- a `date`-only string parsed by `Date` is UTC-midnight, so formatting in a negative-UTC-offset local zone would otherwise silently roll it back a day)', () => {
    const spy = vi.spyOn(Intl, 'DateTimeFormat');
    formatFriendlyDate('2026-06-01');
    expect(spy).toHaveBeenCalledWith('en-US', expect.objectContaining({ timeZone: 'UTC' }));
  });
});

describe('formatFriendlyDateRange', () => {
  it('collapses to a single friendly date when start === end (single-day convention)', () => {
    expect(formatFriendlyDateRange('2026-06-01', '2026-06-01')).toBe('Mon, Jun 1');
  });

  it('joins both friendly dates with an en dash for a real range', () => {
    expect(formatFriendlyDateRange('2026-06-01', '2026-06-03')).toBe('Mon, Jun 1 – Wed, Jun 3');
  });
});
