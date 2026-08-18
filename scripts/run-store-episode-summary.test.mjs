// Unit tests for scripts/run-store-episode-summary.mjs — GAM-407 criterion 5.
//
// AC6/AC7 (packet, "Worker B — run-store-episode-summary.mjs" + acceptance
// criterion 7): determinism is asserted HERE, over an INLINE fixture — no
// separate fixture file exists (none is in Worker B's Allowed Files) — by
// rendering the same input twice and comparing byte-for-byte, plus comparing
// against a literal snapshot of the expected markdown so a regression in the
// exact bytes, not just in self-consistency, is caught too.
import { describe, expect, it } from 'vitest';
import { renderEpisodeSummary } from './run-store-episode-summary.mjs';

// The inline fixture. Deliberately exercises every determinism hazard named
// in the module's own header comment:
//   - `result_refs` keys handed in out of alphabetical order, with a nested
//     object (`alpha.nested_z` before `alpha.nested_a`) whose keys must also
//     end up sorted, and a nested ARRAY whose element order must NOT be
//     touched.
//   - `events` handed in out of chronological order (ev-2 before ev-1), so a
//     renderer that trusted array order would print them in the wrong
//     sequence.
//   - `capability_hash` present on the run record, to prove it never reaches
//     the rendered output (a deliberate omission, not an oversight).
//   - `active_executor: null` and `required_next_role: undefined` — two
//     different "nothing here" shapes that must render identically.
const FIXTURE_RUN = Object.freeze({
  run_id: '11111111-1111-4111-8111-111111111111',
  issue_identifier: 'GAM-407',
  todo_event_id: 'todo-evt-42',
  status: 'completed',
  phase: 'checkpoint',
  generation: 2,
  version: 5,
  pipeline_version: 'v3',
  constitution_sha: 'abc1234',
  branch: 'claude/gam-407-worker-b',
  base_sha: 'base0001',
  head_sha: 'head0002',
  active_executor: null,
  required_next_role: undefined,
  result_refs: Object.freeze({
    zebra: 1,
    alpha: Object.freeze({ nested_z: 1, nested_a: Object.freeze([3, 1, 2]) }),
    beta: 'value',
  }),
  capability_hash: 'sha256:should-never-appear-in-committed-markdown',
  failure_class: null,
  failure_detail: null,
  reserved_at: '2026-08-18T10:00:00Z',
  updated_at: '2026-08-18T10:05:00Z',
});

const FIXTURE_EVENTS = Object.freeze([
  Object.freeze({
    event_key: 'ev-2',
    kind: 'terminal',
    recorded_at: '2026-08-18T10:05:00Z',
    detail: Object.freeze({ z: 1, a: 2 }),
  }),
  Object.freeze({
    event_key: 'ev-1',
    kind: 'checkpoint',
    recorded_at: '2026-08-18T10:01:00Z',
    detail: null,
  }),
]);

// The literal snapshot of the expected markdown — built line by line so a
// reviewer (or a checker) can compare it against the module's rendering
// logic without running anything. `renderEpisodeSummary` joins with '\n', so
// this does too.
const EXPECTED_MARKDOWN = [
  '# Episode summary — run `11111111-1111-4111-8111-111111111111`',
  '',
  '- Issue: GAM-407 (todo event `todo-evt-42`)',
  '- Status: completed (phase: checkpoint)',
  '- Generation: 2, version: 5',
  '- Branch: `claude/gam-407-worker-b` — base `base0001` → head `head0002`',
  '- Active executor: (none)',
  '- Required next role: (none)',
  '- Pipeline version: v3',
  '- Constitution SHA: abc1234',
  '- Reserved at: 2026-08-18T10:00:00Z',
  '- Updated at: 2026-08-18T10:05:00Z',
  '',
  '## Failure',
  '',
  '- Class: (none)',
  '- Detail: (none)',
  '',
  '## Result refs',
  '',
  '```json',
  '{',
  '  "alpha": {',
  '    "nested_a": [',
  '      3,',
  '      1,',
  '      2',
  '    ],',
  '    "nested_z": 1',
  '  },',
  '  "beta": "value",',
  '  "zebra": 1',
  '}',
  '```',
  '',
  '## Events',
  '',
  '| event_key | kind | recorded_at | detail |',
  '|---|---|---|---|',
  '| ev-1 | checkpoint | 2026-08-18T10:01:00Z | (none) |',
  '| ev-2 | terminal | 2026-08-18T10:05:00Z | {"a":2,"z":1} |',
  '',
].join('\n');

describe('renderEpisodeSummary — determinism over an inline fixture (AC6/AC7)', () => {
  it('renders byte-identically for byte-identical input, called twice', () => {
    const first = renderEpisodeSummary(FIXTURE_RUN, FIXTURE_EVENTS);
    const second = renderEpisodeSummary(FIXTURE_RUN, FIXTURE_EVENTS);
    expect(first).toBe(second);
    expect(first.length).toBe(second.length);
  });

  it('matches a literal snapshot of the expected markdown byte-for-byte', () => {
    const rendered = renderEpisodeSummary(FIXTURE_RUN, FIXTURE_EVENTS);
    expect(rendered).toBe(EXPECTED_MARKDOWN);
  });

  it('sorts result_refs keys alphabetically at every nesting level, without touching array element order', () => {
    const rendered = renderEpisodeSummary(FIXTURE_RUN, FIXTURE_EVENTS);
    const alphaIndex = rendered.indexOf('"alpha"');
    const betaIndex = rendered.indexOf('"beta"');
    const zebraIndex = rendered.indexOf('"zebra"');
    expect(alphaIndex).toBeGreaterThan(-1);
    expect(alphaIndex).toBeLessThan(betaIndex);
    expect(betaIndex).toBeLessThan(zebraIndex);
    // The nested array [3, 1, 2] must survive unsorted.
    expect(rendered).toContain('3,\n      1,\n      2');
  });

  it('renders events in (recorded_at, event_key) order regardless of the input array order', () => {
    const rendered = renderEpisodeSummary(FIXTURE_RUN, FIXTURE_EVENTS);
    expect(rendered.indexOf('ev-1')).toBeLessThan(rendered.indexOf('ev-2'));

    // Feeding the SAME two events in the opposite array order must produce
    // the identical rendering — the renderer, not the caller, owns event
    // order, which is the stronger determinism guarantee (packet: "no
    // dependence on hash iteration order" generalises to "no dependence on
    // caller-supplied order the schema does not itself guarantee").
    const reversed = [...FIXTURE_EVENTS].reverse();
    expect(renderEpisodeSummary(FIXTURE_RUN, reversed)).toBe(rendered);
  });

  it('never renders capability_hash, even though the run record carries one', () => {
    const rendered = renderEpisodeSummary(FIXTURE_RUN, FIXTURE_EVENTS);
    expect(rendered).not.toContain('capability_hash');
    expect(rendered).not.toContain(FIXTURE_RUN.capability_hash);
  });

  it('contains no Date.now()/new Date() dependence: two renders one process tick apart are still identical', async () => {
    const first = renderEpisodeSummary(FIXTURE_RUN, FIXTURE_EVENTS);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = renderEpisodeSummary(FIXTURE_RUN, FIXTURE_EVENTS);
    expect(first).toBe(second);
  });
});

describe('renderEpisodeSummary — placeholder rendering on a minimal run', () => {
  const MINIMAL_RUN = Object.freeze({
    run_id: 'run-minimal',
    issue_identifier: 'GAM-000',
    todo_event_id: 'todo-1',
    status: 'reserved',
  });

  it('renders (none) for every unset optional field and (no events recorded) for an empty event list', () => {
    const rendered = renderEpisodeSummary(MINIMAL_RUN, []);
    expect(rendered).toContain('Branch: `(none)` — base `(none)` → head `(none)`');
    expect(rendered).toContain('Active executor: (none)');
    expect(rendered).toContain('Result refs\n\n(none)');
    expect(rendered).toContain('(no events recorded)');
  });

  it('is deterministic on the minimal shape too, rendered twice', () => {
    const first = renderEpisodeSummary(MINIMAL_RUN, []);
    const second = renderEpisodeSummary(MINIMAL_RUN, undefined);
    expect(first).toBe(second);
  });

  it('throws a clear TypeError rather than silently rendering garbage when run is not an object', () => {
    expect(() => renderEpisodeSummary(null, [])).toThrow(TypeError);
    expect(() => renderEpisodeSummary(undefined, [])).toThrow(TypeError);
  });
});

describe('renderEpisodeSummary — table-cell escaping', () => {
  it('escapes pipe characters and newlines inside event detail so the markdown table stays well-formed', () => {
    const run = { ...FIXTURE_RUN };
    const events = [
      {
        event_key: 'ev-pipe',
        kind: 'checkpoint',
        recorded_at: '2026-08-18T10:02:00Z',
        detail: 'a | value\nwith a newline',
      },
    ];
    const rendered = renderEpisodeSummary(run, events);
    const lines = rendered.split('\n');
    const tableLine = lines.find((line) => line.includes('ev-pipe'));
    expect(tableLine).toBeDefined();
    // The embedded '|' inside the detail cell must be escaped as '\|', not
    // left bare as a fifth unescaped column delimiter.
    expect(tableLine).toContain('a \\| value');
    // And the whole rendering is still exactly one physical line for this
    // row — an embedded newline in the detail must not have split it across
    // two lines of the table.
    expect(lines.filter((line) => line.includes('ev-pipe')).length).toBe(1);
  });
});
