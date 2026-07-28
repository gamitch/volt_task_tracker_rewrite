/**
 * T132: extracted verbatim from `src/pages/outreach/OutreachList.tsx` (T130's
 * own UXC-13 responsive hook), so the next consumer (`MeetingsList`, T135)
 * can import this instead of copying it. There was exactly one copy of this
 * code before this move (`OutreachList.tsx`'s own `useIsNarrowViewport`) --
 * this file prevents a second one, it does not deduplicate two pre-existing
 * copies. `OutreachList.tsx` now imports `useIsNarrowViewport` from here; no
 * behaviour changed in the move (constant, `getIsNarrowViewport`, and
 * `useIsNarrowViewport` bodies are byte-identical to what they replaced).
 *
 * Why this is a real `window.matchMedia` SUBSCRIPTION, not a one-time read
 * (reasoning carried across from `OutreachList.tsx`'s own module doc, which
 * recorded it for this same hook): Astryx exports no breakpoint hook (zero
 * `useMediaQuery`/`useBreakpoint` occurrences in `astryx-api.md`) and there
 * is no CSS/`xstyle` escalation available for a pure-CSS collapse (F-2), so
 * reacting to a LIVE viewport change (not just the size at first render)
 * requires a real subscription. `CheckinResult.tsx`'s own
 * `usePrefersReducedMotion` (`getPrefersReducedMotion`/`usePrefersReducedMotion`,
 * lines 357-387) is the in-repo precedent for this exact subscription shape,
 * for a different media feature (`prefers-reduced-motion`, not a width
 * breakpoint) -- this hook independently reimplements the same pattern for
 * `(max-width: 767px)` rather than importing that one, since it lives in a
 * different, unrelated page.
 *
 * `LiveConsole.tsx`'s own module doc records a DELIBERATE prior *non*-use of
 * `matchMedia` for a different question (a manual, always-present toggle
 * button, not automatic breakpoint behaviour, because that file's own jsdom-
 * only test toolchain has no real layout engine and could not prove a real
 * subscription either way) -- that is not a precedent against using
 * `matchMedia` here, where the question genuinely is a live CSS breakpoint
 * and the caveat below already explains what jsdom actually lets a test
 * prove about it.
 *
 * Test-ability caveat (also carried across, still true here): this repo's
 * `src/test-setup.ts:14-25` ships a GUARDED `matchMedia` polyfill every jsdom
 * test environment gets for free, whose `matches` is hardcoded `false` --
 * and jsdom itself evaluates no media queries at all. So no test anywhere in
 * this repo can assert "a 768px viewport behaves narrow" against a real
 * layout; this hook's own test file pins the QUERY STRING it asks for
 * instead (via a query-PARSING `vi.stubGlobal('matchMedia', ...)`), and
 * separately, consumer-level tests (`OutreachList.test.tsx`'s own T130
 * responsive tests) drive the narrow/wide branch by stubbing `matches`
 * directly, the same override idiom `CheckinResult.test.tsx` established.
 */
import { useEffect, useState } from 'react';

export const NARROW_VIEWPORT_QUERY = '(max-width: 767px)';

export function getIsNarrowViewport(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia(NARROW_VIEWPORT_QUERY).matches;
}

export function useIsNarrowViewport(): boolean {
  const [isNarrow, setIsNarrow] = useState<boolean>(getIsNarrowViewport);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mediaQueryList = window.matchMedia(NARROW_VIEWPORT_QUERY);
    setIsNarrow(mediaQueryList.matches);

    const handleChange = (event: MediaQueryListEvent) => setIsNarrow(event.matches);
    if (typeof mediaQueryList.addEventListener === 'function') {
      mediaQueryList.addEventListener('change', handleChange);
      return () => mediaQueryList.removeEventListener('change', handleChange);
    }
    // Safari < 14 fallback API.
    mediaQueryList.addListener(handleChange);
    return () => mediaQueryList.removeListener(handleChange);
  }, []);

  return isNarrow;
}
