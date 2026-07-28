// @vitest-environment jsdom
/**
 * T130 (UXC-03): tests for the extracted three-tier `StatCell` (micro-label /
 * value / optional secondary), the shape `OutreachList.tsx`'s coach `Table`
 * rows now render via this shared component instead of a fourth inline copy.
 * No `@testing-library/react` is installed in this repo (confirmed via
 * `package.json`) -- same raw `createRoot`/`act` pattern every other test
 * file in this codebase already uses.
 */
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { StatCell } from './StatCell';

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

describe('<StatCell />', () => {
  it('renders label immediately followed by value as adjacent text (no separator), matching the pre-extraction shape callers already assert on (e.g. "Planned3h")', () => {
    act(() => {
      root.render(<StatCell label="Planned" value="3h" />);
    });
    expect(container.textContent).toBe('Planned3h');
  });

  it('omits the secondary tier entirely when not supplied -- never an empty node', () => {
    act(() => {
      root.render(<StatCell label="Expected" value="1 students" />);
    });
    expect(container.textContent).toBe('Expected1 students');
    expect(container.querySelectorAll('p, span, div').length).toBeGreaterThan(0);
  });

  it('renders all three tiers, in order, when secondary is supplied', () => {
    act(() => {
      root.render(<StatCell label="Attended" value="2 students" secondary="Reached 45" />);
    });
    expect(container.textContent).toBe('Attended2 studentsReached 45');
  });
});
