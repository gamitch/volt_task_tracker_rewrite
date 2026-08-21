// @vitest-environment jsdom
/**
 * Tests for `SeriesCard.tsx` (GAM-447). No `@testing-library/react` is
 * installed in this repo -- these tests use the same raw `createRoot`/`act`
 * pattern `CheckinResult.test.tsx` and `CoachMeetingsView.test.tsx` already
 * established. DOM reads follow precedents already in this repo:
 *   - `element.style.getPropertyValue('--x-height')` to read a `SizeValue`
 *     prop back out of the DOM, exactly as `CoachHome.test.tsx:2094` reads
 *     `--x-gridTemplateColumns` off `Grid`.
 *   - `element.style.getPropertyValue('-webkit-line-clamp')` reads the title
 *     clamp back out the same way -- `Heading`'s own runtime only sets this
 *     inline style when `maxLines > 1` (empirically confirmed; `maxLines={1}`
 *     applies an opaque StyleX atomic class with zero DOM-observable signal,
 *     which is why `SeriesCard.tsx` uses `TITLE_MAX_LINES = 2`, see its
 *     module doc item 4).
 *   - `element.style.outline`/`outlineOffset` reads the selection-ring style
 *     back the same way `--x-height` is read, just off React's own applied
 *     `style` object instead of an Astryx dynamic-style custom property.
 *   - focusing a real `<button>` then dispatching a `click` (not a
 *     `keydown`) to prove keyboard reachability, exactly as
 *     `LiveConsole.test.tsx`'s "reachable and activatable via keyboard"
 *     test already does -- jsdom does not itself simulate the browser's
 *     native Enter/Space-to-click activation of a real `<button>`, so the
 *     click is dispatched directly at the focused element. The load-bearing
 *     assertion for "keyboard access" is `tagName === 'BUTTON'` (a native
 *     button is unconditionally Enter/Space-activatable per the HTML spec,
 *     a browser guarantee this suite cannot re-simulate in jsdom) plus DOM
 *     focus actually landing on it.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SeriesCard, type SeriesCardProps } from './SeriesCard';
import type { SeriesCardModel } from '../../../lib/meetings/types';

// ---------------------------------------------------------------------------
// Render harness
// ---------------------------------------------------------------------------

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
  vi.restoreAllMocks();
});

function renderCard(props: SeriesCardProps): void {
  act(() => {
    root.render(<SeriesCard {...props} />);
  });
}

function baseModel(overrides: Partial<SeriesCardModel> = {}): SeriesCardModel {
  return {
    eventId: 'event-1',
    title: 'Varsity Robotics Build',
    teamScopeLabel: 'Team 1234 · Varsity',
    scheduleChips: ['Tue 6–8 PM'],
    sessionsCompleted: 3,
    sessionsTotal: 12,
    attendancePct: 87,
    nextSessionLabel: 'Tue, Aug 26 · 6–8 PM',
    paletteIndex: 2,
    ...overrides,
  };
}

function cardEl(): HTMLElement {
  const el = container.querySelector('.astryx-card');
  expect(el, 'expected a rendered Card').toBeTruthy();
  return el as HTMLElement;
}

function badgeEls(): HTMLElement[] {
  return Array.from(container.querySelectorAll('.astryx-badge'));
}

function scheduleButton(): HTMLButtonElement {
  const buttons = Array.from(container.querySelectorAll('button'));
  const found = buttons.find((btn) => btn.textContent?.includes('View full schedule'));
  expect(found, 'expected the "View full schedule" button').toBeTruthy();
  return found as HTMLButtonElement;
}

function titleHeadingEl(): HTMLElement {
  const el = container.querySelector('h3');
  expect(el, 'expected a rendered <h3> title').toBeTruthy();
  return el as HTMLElement;
}

/** The `Attendance` block's three `Text` nodes, in DOM order, scoped to the
 * `[data-type="label"]` node whose text is exactly "Attendance" (there are
 * other `label`/`supporting` `Text` nodes elsewhere on the card). */
function attendanceBlockTexts(): string[] {
  const labelEl = Array.from(container.querySelectorAll('[data-type="label"]')).find(
    (el) => el.textContent === 'Attendance',
  );
  expect(labelEl, 'expected an Attendance label node').toBeTruthy();
  const block = labelEl?.parentElement;
  expect(block, 'expected the Attendance label to have a parent block').toBeTruthy();
  return Array.from(block?.children ?? []).map((el) => el.textContent ?? '');
}

// ---------------------------------------------------------------------------
// 1. Height invariance
// ---------------------------------------------------------------------------

describe('height invariance', () => {
  it('the applied fixed-height style is identical across 1 vs 12 chips', () => {
    renderCard({ model: baseModel({ scheduleChips: ['Tue 6–8 PM'] }) });
    const oneChipHeight = cardEl().style.getPropertyValue('--x-height');

    renderCard({
      model: baseModel({
        scheduleChips: Array.from({ length: 12 }, (_, i) => `Mon ${i + 1}–${i + 2} PM`),
      }),
    });
    const twelveChipHeight = cardEl().style.getPropertyValue('--x-height');

    expect(oneChipHeight).toBeTruthy();
    expect(twelveChipHeight).toBe(oneChipHeight);
  });

  it('the applied fixed-height style is identical across a short title vs a 300-character title', () => {
    renderCard({ model: baseModel({ title: 'Short' }) });
    const shortTitleHeight = cardEl().style.getPropertyValue('--x-height');

    renderCard({ model: baseModel({ title: 'x'.repeat(300) }) });
    const longTitleHeight = cardEl().style.getPropertyValue('--x-height');

    expect(shortTitleHeight).toBeTruthy();
    expect(longTitleHeight).toBe(shortTitleHeight);
  });

  it('the applied fixed-height style is identical across 4 vs 56 sessions', () => {
    renderCard({ model: baseModel({ sessionsCompleted: 1, sessionsTotal: 4 }) });
    const fourSessionsHeight = cardEl().style.getPropertyValue('--x-height');

    renderCard({ model: baseModel({ sessionsCompleted: 40, sessionsTotal: 56 }) });
    const fiftySixSessionsHeight = cardEl().style.getPropertyValue('--x-height');

    expect(fourSessionsHeight).toBeTruthy();
    expect(fiftySixSessionsHeight).toBe(fourSessionsHeight);
  });

  it('never renders more chip-related badges than the cap, regardless of scheduleChips.length', () => {
    renderCard({
      model: baseModel({
        scheduleChips: Array.from({ length: 12 }, (_, i) => `Mon ${i + 1}–${i + 2} PM`),
      }),
    });
    // 4 visible chip badges + 1 "+8 more" badge = 5, never 12.
    const chipRelatedBadges = badgeEls().filter((b) => !b.textContent?.includes('overlap'));
    expect(chipRelatedBadges.length).toBe(5);
    expect(container.textContent).toContain('+8 more');
  });

  it('renders all 5 chips (no "+N more") when exactly one chip would otherwise be hidden', () => {
    const chips = ['Mon 1–2 PM', 'Tue 2–3 PM', 'Wed 3–4 PM', 'Thu 4–5 PM', 'Fri 5–6 PM'];
    renderCard({ model: baseModel({ scheduleChips: chips }) });
    const chipTexts = badgeEls()
      .filter((b) => !b.textContent?.includes('overlap'))
      .map((b) => b.textContent);
    expect(chipTexts).toEqual(chips);
    expect(container.textContent).not.toContain('more');
  });

  it('pins the title clamp: the rendered <h3> carries a real, DOM-observable line-clamp style', () => {
    renderCard({ model: baseModel({ title: 'x'.repeat(300) }) });
    const heading = titleHeadingEl();
    expect(heading.style.getPropertyValue('-webkit-line-clamp')).toBe('2');
  });
});

// ---------------------------------------------------------------------------
// 2/3. attendancePct null vs 0
// ---------------------------------------------------------------------------

describe('attendancePct rendering (DATA-01 -- never computed, never fabricated)', () => {
  it('renders the em dash "—" when attendancePct is null, and never "0%"', () => {
    renderCard({ model: baseModel({ attendancePct: null }) });
    expect(container.textContent).toContain('—');
    expect(container.textContent).not.toContain('0%');
  });

  it('renders "0%" (a real zero) when attendancePct is 0', () => {
    renderCard({ model: baseModel({ attendancePct: 0 }) });
    expect(container.textContent).toContain('0%');
    expect(container.textContent).not.toContain('—');
  });

  it('renders a real non-integer value verbatim, e.g. "96.5%", never rounded', () => {
    renderCard({ model: baseModel({ attendancePct: 96.5 }) });
    expect(container.textContent).toContain('96.5%');
  });

  it('splits into three nodes -- label, prominent value, supporting caption -- not one flat sentence', () => {
    renderCard({ model: baseModel({ attendancePct: 87, sessionsCompleted: 3 }) });
    const [label, value, caption] = attendanceBlockTexts();
    expect(label).toBe('Attendance');
    expect(value).toBe('87%');
    expect(caption).toBe('across 3 held');
  });
});

// ---------------------------------------------------------------------------
// 4. DES-12 four states
// ---------------------------------------------------------------------------

describe('DES-12 four states', () => {
  it('loading: renders a Skeleton-based branch, announces via aria-busy/role=status, no populated content', () => {
    renderCard({ model: baseModel(), isLoading: true });
    expect(container.querySelectorAll('.astryx-skeleton').length).toBeGreaterThan(0);
    expect(container.querySelector('button')).toBeNull();
    expect(cardEl().getAttribute('aria-busy')).toBe('true');
    expect(container.querySelector('[role="status"]')).toBeTruthy();
  });

  it('empty: sessionsTotal === 0 renders an EmptyState, no progress bar, no next-session line', () => {
    renderCard({ model: baseModel({ sessionsTotal: 0, sessionsCompleted: 0 }) });
    expect(container.querySelector('.astryx-empty-state')).toBeTruthy();
    expect(container.querySelector('.astryx-progressbar')).toBeNull();
    expect(container.textContent).not.toContain('Next session');
  });

  it('error: renders a Banner with the given errorMessage', () => {
    renderCard({ model: baseModel(), errorMessage: 'Could not load attendance data.' });
    const banner = container.querySelector('.astryx-banner');
    expect(banner).toBeTruthy();
    expect(container.textContent).toContain('Could not load attendance data.');
  });

  it('error: an empty-string errorMessage does not render an empty-description Banner', () => {
    renderCard({ model: baseModel(), errorMessage: '' });
    expect(container.querySelector('.astryx-banner')).toBeNull();
    // Falls through to the populated branch instead.
    expect(scheduleButton()).toBeTruthy();
  });

  it('populated: renders the full card', () => {
    renderCard({ model: baseModel() });
    expect(container.querySelector('.astryx-progressbar')).toBeTruthy();
    expect(container.textContent).toContain('Next session');
    expect(scheduleButton()).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// 5. onSelect
// ---------------------------------------------------------------------------

describe('onSelect', () => {
  it('is called with exactly { eventId } when the schedule button is activated, and the label carries sessionsTotal', () => {
    const onSelect = vi.fn();
    renderCard({
      model: baseModel({ eventId: 'event-xyz', sessionsTotal: 12 }),
      onSelect,
    });
    const button = scheduleButton();
    expect(button.textContent).toContain('12 sessions');

    act(() => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith({ eventId: 'event-xyz' });
  });
});

// ---------------------------------------------------------------------------
// 6. Overlap badge
// ---------------------------------------------------------------------------

describe('overlap badge', () => {
  it('appears in the chip row for overlapCount > 0, with no error/urgency variant', () => {
    renderCard({ model: baseModel(), overlapCount: 2 });
    const overlapBadge = badgeEls().find((b) => b.textContent?.includes('overlap'));
    expect(overlapBadge).toBeTruthy();
    expect(overlapBadge?.textContent).toContain('2 overlap');
    expect(overlapBadge?.getAttribute('data-variant')).toBe('neutral');
    // Lives in the chip row, not the (now overlap-badge-free) title block.
    expect(titleHeadingEl().parentElement?.contains(overlapBadge ?? null)).toBe(false);
  });

  it('is absent for overlapCount === 0', () => {
    renderCard({ model: baseModel(), overlapCount: 0 });
    expect(badgeEls().some((b) => b.textContent?.includes('overlap'))).toBe(false);
  });

  it('is absent for overlapCount === undefined', () => {
    renderCard({ model: baseModel() });
    expect(badgeEls().some((b) => b.textContent?.includes('overlap'))).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 7. nextSessionLabel: null
// ---------------------------------------------------------------------------

describe('nextSessionLabel', () => {
  it('renders the finished copy, not an empty line, when null', () => {
    renderCard({ model: baseModel({ nextSessionLabel: null }) });
    expect(container.textContent).toContain('No sessions remaining');
  });

  it('renders the label verbatim when non-null', () => {
    renderCard({ model: baseModel({ nextSessionLabel: 'Tue, Aug 26 · 6–8 PM' }) });
    expect(container.textContent).toContain('Tue, Aug 26 · 6–8 PM');
  });
});

// ---------------------------------------------------------------------------
// 8. paletteIndex -> data-series-palette-index
// ---------------------------------------------------------------------------

describe('paletteIndex', () => {
  it('reaches the DOM as data-series-palette-index', () => {
    renderCard({ model: baseModel({ paletteIndex: 5 }) });
    expect(cardEl().getAttribute('data-series-palette-index')).toBe('5');
  });
});

// ---------------------------------------------------------------------------
// 9. Chips rendered verbatim
// ---------------------------------------------------------------------------

describe('schedule chips', () => {
  it('renders chip strings verbatim from the model, with no re-formatting', () => {
    const chips = ['Tue 6–8 PM', 'Sun 3:30–6:30 PM'];
    renderCard({ model: baseModel({ scheduleChips: chips }) });
    const chipTexts = badgeEls()
      .filter((b) => !b.textContent?.includes('overlap'))
      .map((b) => b.textContent);
    expect(chipTexts).toEqual(chips);
  });
});

// ---------------------------------------------------------------------------
// 10. Keyboard reachability
// ---------------------------------------------------------------------------

describe('keyboard access', () => {
  it("the schedule button is a real, focusable <button> (native Enter/Space activation is a <button>'s own browser guarantee, not re-simulated in jsdom)", () => {
    const onSelect = vi.fn();
    renderCard({ model: baseModel(), onSelect });
    const button = scheduleButton();

    // Load-bearing: a real <button>, not a div with a click handler.
    expect(button.tagName).toBe('BUTTON');

    act(() => {
      button.focus();
    });
    expect(document.activeElement).toBe(button);

    // A real native <button> natively activates on Enter/Space; jsdom does
    // not itself simulate that browser behavior, so the click is dispatched
    // directly at the focused element (see module doc above).
    act(() => {
      button.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onSelect).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Selected state
// ---------------------------------------------------------------------------

describe('isSelected', () => {
  it('marks the schedule button programmatically with aria-current when true', () => {
    renderCard({ model: baseModel(), isSelected: true });
    expect(scheduleButton().getAttribute('aria-current')).toBe('true');
  });

  it('does not set aria-current when false/undefined', () => {
    renderCard({ model: baseModel() });
    expect(scheduleButton().getAttribute('aria-current')).toBeNull();
  });

  it('renders a visible selection ring (outline) on the Card when true', () => {
    renderCard({ model: baseModel(), isSelected: true });
    expect(cardEl().style.outline).toBeTruthy();
    expect(cardEl().style.outlineOffset).toBeTruthy();
  });

  it('renders no selection ring when false/undefined', () => {
    renderCard({ model: baseModel() });
    expect(cardEl().style.outline).toBeFalsy();
  });
});
