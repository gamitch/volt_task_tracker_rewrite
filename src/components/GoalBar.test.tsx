// @vitest-environment jsdom
/**
 * T136 (UXC-08): tests for the shared `GoalBar` -- one track, up to two
 * offset fills, the full ARIA shape, and the overflow clamp (BEH-01 coach
 * fixture: confirmed 9 + planned 7 vs a shrunk 15h goal,
 * `OutreachList.test.tsx:1354-1358`). No `@testing-library/react` is
 * installed in this repo -- same raw `createRoot`/`act` pattern every other
 * test file in this codebase already uses (see `StatCell.test.tsx`).
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { GoalBar, type GoalBarProps } from './GoalBar';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => {
    root.unmount();
  });
  container.remove();
});

function renderBar(overrides: Partial<GoalBarProps> = {}): GoalBarProps {
  const props: GoalBarProps = {
    confirmedPct: 25,
    plannedPct: 15,
    valueText: '2.5 of 10 hours confirmed; 1.5 more planned',
    labelledBy: 'heading-id',
    ...overrides,
  };
  act(() => {
    root.render(<GoalBar {...props} />);
  });
  return props;
}

function getBar(): HTMLElement {
  const bar = container.querySelector('[role="progressbar"]');
  expect(bar).toBeTruthy();
  return bar as HTMLElement;
}

// Excludes the boundary divider (`data-testid="goal-bar-divider"`, present
// only when both segments are non-zero -- packet revision 2's replacement
// for the withdrawn fill-vs-fill contrast demand) so every pre-existing
// fill-shape assertion below is unaffected by whether it renders.
function getFills(bar: HTMLElement): HTMLElement[] {
  return Array.from(bar.children).filter(
    (el) => (el as HTMLElement).dataset.testid !== 'goal-bar-divider',
  ) as HTMLElement[];
}

function getDivider(bar: HTMLElement): HTMLElement | null {
  return bar.querySelector('[data-testid="goal-bar-divider"]');
}

describe('<GoalBar />', () => {
  it('renders exactly one role="progressbar" -- never a second bar', () => {
    renderBar();
    expect(container.querySelectorAll('[role="progressbar"]').length).toBe(1);
  });

  it('carries the confirmed percentage as aria-valuenow on a 0-100 domain, with min/max set and a resolvable aria-labelledby', () => {
    renderBar({ confirmedPct: 42, labelledBy: 'goal-heading' });
    const bar = getBar();
    expect(bar.getAttribute('aria-valuenow')).toBe('42');
    expect(bar.getAttribute('aria-valuemin')).toBe('0');
    expect(bar.getAttribute('aria-valuemax')).toBe('100');
    expect(bar.getAttribute('aria-labelledby')).toBe('goal-heading');
  });

  it('aria-valuetext names the planned segment explicitly, not just the confirmed number', () => {
    renderBar({ valueText: '9 of 52 hours confirmed; 7 more planned' });
    expect(getBar().getAttribute('aria-valuetext')).toBe('9 of 52 hours confirmed; 7 more planned');
  });

  it('is not focusable -- a status indicator, not a control', () => {
    renderBar();
    expect(getBar().hasAttribute('tabindex')).toBe(false);
  });

  it('positions the planned fill by OFFSET at confirmedPct%, never by summing confirmed and planned', () => {
    renderBar({ confirmedPct: 30, plannedPct: 20 });
    const fills = getFills(getBar());
    expect(fills.length).toBe(2);
    const [confirmedFill, plannedFill] = fills;
    expect(confirmedFill.style.width).toBe('30%');
    expect(confirmedFill.style.left).toBe('0%');
    expect(plannedFill.style.left).toBe('30%');
    expect(plannedFill.style.width).toBe('20%');
  });

  it('colours the confirmed fill green and the planned fill purple via the T136 data-viz tokens', () => {
    renderBar({ confirmedPct: 30, plannedPct: 20 });
    const [confirmedFill, plannedFill] = getFills(getBar());
    expect(confirmedFill.style.backgroundColor).toBe('var(--color-data-categorical-green)');
    expect(plannedFill.style.backgroundColor).toBe('var(--color-data-categorical-purple)');
  });

  it('scopes the track to the astryx-progressbar class so --color-background-muted resolves to the solid, higher-contrast remap (theme.css:496-498), not the near-transparent unscoped default', () => {
    renderBar();
    const bar = getBar();
    expect(bar.classList.contains('astryx-progressbar')).toBe(true);
    expect(bar.style.backgroundColor).toBe('var(--color-background-muted)');
  });

  it('clamps the overflow case (BEH-01 fixture: confirmed 9/15=60%, planned 7/15=46.67% vs a 15h goal) so the fills never exceed the track combined and aria-valuenow never exceeds aria-valuemax', () => {
    const confirmedPct = (9 / 15) * 100; // 60
    const plannedPct = (7 / 15) * 100; // 46.666...7
    renderBar({ confirmedPct, plannedPct });
    const bar = getBar();
    const [confirmedFill, plannedFill] = getFills(bar);
    const confirmedWidth = parseFloat(confirmedFill.style.width);
    const plannedWidth = parseFloat(plannedFill.style.width);

    expect(confirmedWidth).toBeCloseTo(60, 5);
    // min(46.667, 100 - 60) = 40 -- clamped, not the raw 46.667%.
    expect(plannedWidth).toBeCloseTo(40, 5);
    expect(confirmedWidth + plannedWidth).toBeLessThanOrEqual(100);

    const valuenow = Number(bar.getAttribute('aria-valuenow'));
    const valuemax = Number(bar.getAttribute('aria-valuemax'));
    expect(valuenow).toBeLessThanOrEqual(valuemax);
    expect(valuenow).toBe(60);
  });

  it('clamps a confirmedPct at or above 100 to a full single segment with zero room left for planned', () => {
    renderBar({ confirmedPct: 100, plannedPct: 25 });
    const bar = getBar();
    const [confirmedFill, plannedFill] = getFills(bar);
    expect(confirmedFill.style.width).toBe('100%');
    expect(plannedFill.style.width).toBe('0%');
    expect(bar.getAttribute('aria-valuenow')).toBe('100');
  });

  it('renders a zero-width (not absent) planned fill when planned is zero -- exactly one progressbar either way', () => {
    renderBar({ confirmedPct: 20, plannedPct: 0 });
    const bar = getBar();
    const fills = getFills(bar);
    expect(fills.length).toBe(2);
    expect(fills[0].style.width).toBe('20%');
    expect(fills[1].style.width).toBe('0%');
    expect(container.querySelectorAll('[role="progressbar"]').length).toBe(1);
  });

  it('defensively clamps a negative confirmedPct to 0 -- percentage-domain clamping only, never hours arithmetic', () => {
    renderBar({ confirmedPct: -10, plannedPct: 15 });
    const bar = getBar();
    expect(bar.getAttribute('aria-valuenow')).toBe('0');
    const [confirmedFill] = getFills(bar);
    expect(confirmedFill.style.width).toBe('0%');
  });

  describe('boundary divider (packet revision 2 -- replaces the withdrawn fill-vs-fill contrast demand)', () => {
    it('renders when both segments are non-zero', () => {
      renderBar({ confirmedPct: 30, plannedPct: 20 });
      const divider = getDivider(getBar());
      expect(divider).toBeTruthy();
    });

    it('is absent when the planned segment is zero -- nothing to divide', () => {
      renderBar({ confirmedPct: 20, plannedPct: 0 });
      const divider = getDivider(getBar());
      expect(divider).toBeNull();
    });

    it('is absent when the confirmed segment is zero -- nothing to divide', () => {
      renderBar({ confirmedPct: 0, plannedPct: 15 });
      const divider = getDivider(getBar());
      expect(divider).toBeNull();
    });

    it('is absent when confirmed is clamped to a full 100% segment (planned forced to 0 by the overflow clamp)', () => {
      renderBar({ confirmedPct: 100, plannedPct: 25 });
      const divider = getDivider(getBar());
      expect(divider).toBeNull();
    });

    it('resolves to the SAME CSS variable as the track (--color-background-muted) -- so a future refactor that recolours it fails this assertion rather than silently restoring an invisible boundary', () => {
      renderBar({ confirmedPct: 30, plannedPct: 20 });
      const bar = getBar();
      const divider = getDivider(bar);
      expect(divider).toBeTruthy();
      expect(divider!.style.backgroundColor).toBe('var(--color-background-muted)');
      // Same variable as the track itself (not a coincidentally-equal but
      // separately-authored value) -- this is the property the packet says
      // makes the divider's own contrast follow for free from the two
      // already-measured fill-vs-track ratios, with no separate measurement.
      expect(divider!.style.backgroundColor).toBe(bar.style.backgroundColor);
    });

    it('is positioned at the confirmed/planned boundary (left: calc(<confirmedWidth>% - 1px)) and does not consume segment width -- both fills keep their full clamped widths with the divider present', () => {
      renderBar({ confirmedPct: 30, plannedPct: 20 });
      const bar = getBar();
      const divider = getDivider(bar);
      expect(divider).toBeTruthy();
      expect(divider!.style.left).toBe('calc(30% - 1px)');
      expect(divider!.style.width).toBe('2px');
      // The two fills are unaffected -- no width was reallocated to the
      // divider (it is an absolutely positioned overlay, not a third
      // track segment).
      const [confirmedFill, plannedFill] = getFills(bar);
      expect(confirmedFill.style.width).toBe('30%');
      expect(plannedFill.style.width).toBe('20%');
    });

    it('is positioned from confirmedWidth alone -- never from confirmedWidth + plannedWidth (the no-sum invariant)', () => {
      const confirmedPct = (9 / 15) * 100; // 60, overflow fixture
      const plannedPct = (7 / 15) * 100; // 46.667, clamped to 40
      renderBar({ confirmedPct, plannedPct });
      const bar = getBar();
      const divider = getDivider(bar);
      expect(divider).toBeTruthy();
      // If the divider's position were ever derived from confirmed+planned
      // (100%) instead of confirmed alone (60%), this would read
      // `calc(100% - 1px)` instead -- this assertion fails first if that
      // regression is reintroduced.
      expect(divider!.style.left).toBe(`calc(${confirmedPct}% - 1px)`);
    });
  });
});
