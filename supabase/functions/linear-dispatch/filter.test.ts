// Unit tests for filter.ts --- which Linear deliveries become a Claude
// dispatch. Run with `deno test supabase/functions/linear-dispatch/`.
//
// Fully offline and fully synchronous: the filter takes a parsed payload and
// returns a decision, so there is nothing to stub.
//
// Every rejection test asserts the REASON, not merely that dispatch did not
// happen. Asserting `dispatch === false` alone would pass for a filter that
// rejected everything for one wrong reason --- precisely the
// silent-no-op-that-looks-like-success shape the tracker-migration doc's
// section 6 records. Naming the reason makes each guard prove itself.
import assert from 'node:assert/strict';
import {
  DEFAULT_TARGET_STATE,
  HUMAN_GATE_LABEL,
  KNOWN_TIER_NAMES,
  decideDispatch,
  extractLabelNames,
  hasHumanGate,
  tierFromLabels,
} from './filter.ts';

const ISSUE_UUID = '9f1c2d3e-4b5a-6789-0abc-def012345678';
const PRIOR_STATE_UUID = '11111111-2222-3333-4444-555555555555';

interface EventOverrides {
  type?: unknown;
  action?: unknown;
  stateName?: string | null;
  labels?: unknown;
  updatedFrom?: unknown;
  identifier?: unknown;
  id?: unknown;
  title?: string;
  priority?: unknown;
  url?: string;
}

const EVENT_DEFAULTS = {
  type: 'Issue' as unknown,
  action: 'update' as unknown,
  stateName: 'Todo' as string | null | undefined,
  labels: [{ id: 'l1', name: 'tier/standard', color: '#abc' }] as unknown,
  updatedFrom: { stateId: PRIOR_STATE_UUID } as unknown,
  identifier: 'GAM-308' as unknown,
  id: ISSUE_UUID as unknown,
  title: 'HoursTab renders 4.0 where CoachHome renders 4',
  priority: 2 as unknown,
  url: 'https://linear.app/gamitch/issue/GAM-308/hourstab-renders-40',
};

/**
 * A realistic Linear Issue `update` webhook body. Defaults describe the
 * canonical dispatchable case --- `Backlog -> Todo` on a tiered issue --- so
 * each test states only its own deviation from that.
 *
 * Overrides are applied by SPREAD, not by destructuring defaults, and that is
 * deliberate: `{ labels: undefined }` must actually produce a payload with no
 * labels. A destructuring default (`labels = [...]`) would substitute the
 * default back in, and the "missing field" tests below would then pass while
 * exercising the fully-populated happy path --- green for the wrong reason,
 * which is the failure mode this suite exists to rule out.
 */
function issueEvent(overrides: EventOverrides = {}): unknown {
  const o = { ...EVENT_DEFAULTS, ...overrides };

  return {
    action: o.action,
    type: o.type,
    createdAt: '2026-08-09T12:00:00.000Z',
    data: {
      id: o.id,
      identifier: o.identifier,
      title: o.title,
      priority: o.priority,
      state: o.stateName == null ? undefined : { id: 'state-uuid', name: o.stateName, type: 'unstarted' },
      labels: o.labels,
    },
    updatedFrom: o.updatedFrom,
    url: o.url,
    webhookTimestamp: 1_754_700_000_000,
    organizationId: '78884f5f-97f6-4d32-9856-a1739a3c26b9',
    webhookId: 'webhook-uuid',
  };
}

// --------------------------------------------------------------------
// The happy path
// --------------------------------------------------------------------

Deno.test('dispatches a tiered issue moved into Todo, with the expected client payload', () => {
  const decision = decideDispatch(issueEvent());
  assert.ok(decision.dispatch, 'Backlog -> Todo on a tier/* issue must dispatch');
  assert.deepEqual(decision.clientPayload, {
    identifier: 'GAM-308',
    issueId: ISSUE_UUID,
    title: 'HoursTab renders 4.0 where CoachHome renders 4',
    url: 'https://linear.app/gamitch/issue/GAM-308/hourstab-renders-40',
    tier: 'standard',
    labels: ['tier/standard'],
    priority: 2,
  });
});

Deno.test('the client payload stays within GitHub repository_dispatch limits', () => {
  const decision = decideDispatch(
    issueEvent({
      labels: [
        { id: 'l1', name: 'tier/heavy' },
        { id: 'l2', name: 'area/w4' },
        { id: 'l3', name: 'gate/unverified' },
      ],
    }),
  );
  assert.ok(decision.dispatch);
  const keys = Object.keys(decision.clientPayload);
  assert.ok(keys.length <= 10, `client_payload allows at most 10 top-level properties, got ${keys.length}`);
  const bytes = new TextEncoder().encode(JSON.stringify(decision.clientPayload)).length;
  assert.ok(bytes < 64 * 1024, `client_payload must be under 64KB, got ${bytes}`);
  // The description is deliberately not forwarded --- item 28c makes the
  // agent re-read the issue anyway, so a copy here would only ever be staler.
  assert.ok(!keys.includes('description'));
});

Deno.test('an issue with no Tnnn prefix still dispatches --- identity is the tier label (item 28b)', () => {
  const decision = decideDispatch(
    issueEvent({ identifier: 'GAM-412', title: 'Persona run: coach cannot save availability' }),
  );
  assert.ok(decision.dispatch, 'a skill-filed finding has no Tnnn and is still ours');
  assert.equal(decision.clientPayload.identifier, 'GAM-412');
});

// Item 28d: judging the tier is part of CLAIMING, not a precondition for
// dispatch. So an unreviewed row must reach an agent, which then tiers it
// before moving it to In Progress.
Deno.test('tier/unreviewed dispatches --- tiering is the agent\'s first job, not a gate (item 28d)', () => {
  const decision = decideDispatch(issueEvent({ labels: [{ id: 'l1', name: 'tier/unreviewed' }] }));
  assert.ok(decision.dispatch);
  assert.equal(decision.clientPayload.tier, 'unreviewed');
});

// --------------------------------------------------------------------
// Rule 1-3: shape
// --------------------------------------------------------------------

Deno.test('skips non-Issue resource types', () => {
  for (const type of ['Comment', 'Project', 'Reaction', 'IssueLabel']) {
    const decision = decideDispatch(issueEvent({ type }));
    assert.ok(!decision.dispatch);
    assert.equal(decision.reason, 'NOT_AN_ISSUE_EVENT', `type=${type}`);
  }
});

Deno.test('skips create and remove --- a dispatch is a transition', () => {
  for (const action of ['create', 'remove']) {
    const decision = decideDispatch(issueEvent({ action }));
    assert.ok(!decision.dispatch);
    assert.equal(decision.reason, 'NOT_AN_UPDATE', `action=${action}`);
  }
});

Deno.test('skips a payload that is not an object at all', () => {
  for (const body of [null, undefined, 'a string', 42, ['an', 'array']]) {
    const decision = decideDispatch(body);
    assert.ok(!decision.dispatch);
    assert.equal(decision.reason, 'MALFORMED_ISSUE');
  }
});

Deno.test('skips an issue missing its id or identifier', () => {
  const noId = decideDispatch(issueEvent({ id: undefined }));
  assert.ok(!noId.dispatch);
  assert.equal(noId.reason, 'MALFORMED_ISSUE');

  const noIdentifier = decideDispatch(issueEvent({ identifier: undefined }));
  assert.ok(!noIdentifier.dispatch);
  assert.equal(noIdentifier.reason, 'MALFORMED_ISSUE');
});

// --------------------------------------------------------------------
// Rule 4: the target state
// --------------------------------------------------------------------

Deno.test('skips transitions into any state other than Todo', () => {
  for (const stateName of ['Backlog', 'In Progress', 'In Review', 'Done', 'Canceled', 'Triage']) {
    const decision = decideDispatch(issueEvent({ stateName }));
    assert.ok(!decision.dispatch);
    assert.equal(decision.reason, 'NOT_TARGET_STATE', `state=${stateName}`);
  }
});

Deno.test('skips an issue whose state object is missing entirely', () => {
  const decision = decideDispatch(issueEvent({ stateName: null }));
  assert.ok(!decision.dispatch);
  assert.equal(decision.reason, 'NOT_TARGET_STATE');
});

Deno.test('state matching is case-insensitive and trimmed, so a rename does not stop the queue', () => {
  for (const stateName of ['todo', 'TODO', 'ToDo', ' Todo ']) {
    const decision = decideDispatch(issueEvent({ stateName }));
    assert.ok(decision.dispatch, `state=${JSON.stringify(stateName)} should still dispatch`);
  }
});

Deno.test('the target state is configurable and defaults to Todo', () => {
  assert.equal(DEFAULT_TARGET_STATE, 'Todo');
  const ready = decideDispatch(issueEvent({ stateName: 'Ready' }), { targetState: 'Ready' });
  assert.ok(ready.dispatch);
  // ...and the default no longer matches once the target moves.
  const todo = decideDispatch(issueEvent({ stateName: 'Todo' }), { targetState: 'Ready' });
  assert.ok(!todo.dispatch);
  assert.equal(todo.reason, 'NOT_TARGET_STATE');
});

// --------------------------------------------------------------------
// Rule 5: the load-bearing re-dispatch guard
// --------------------------------------------------------------------

// Without this rule, every edit to an issue sitting in Todo --- adding a
// label, fixing a typo in the description, setting an estimate --- would fire
// a fresh dispatch and start a second agent on work already claimed.
Deno.test('skips an edit to an issue ALREADY in Todo, because the state did not move', () => {
  const labelAdded = decideDispatch(issueEvent({ updatedFrom: { labelIds: ['old'] } }));
  assert.ok(!labelAdded.dispatch, 'a label edit on a Todo issue must not re-dispatch');
  assert.equal(labelAdded.reason, 'STATE_UNCHANGED');

  const descriptionEdited = decideDispatch(issueEvent({ updatedFrom: { description: 'previous text' } }));
  assert.ok(!descriptionEdited.dispatch);
  assert.equal(descriptionEdited.reason, 'STATE_UNCHANGED');

  const titleEdited = decideDispatch(issueEvent({ updatedFrom: { title: 'previous title' } }));
  assert.ok(!titleEdited.dispatch);
  assert.equal(titleEdited.reason, 'STATE_UNCHANGED');
});

Deno.test('skips when updatedFrom is absent, empty, or not an object', () => {
  for (const updatedFrom of [undefined, {}, null, 'nonsense', []]) {
    const decision = decideDispatch(issueEvent({ updatedFrom }));
    assert.ok(!decision.dispatch, `updatedFrom=${JSON.stringify(updatedFrom)}`);
    assert.equal(decision.reason, 'STATE_UNCHANGED');
  }
});

Deno.test('dispatches when stateId is present in updatedFrom even alongside other changed fields', () => {
  const decision = decideDispatch(
    issueEvent({ updatedFrom: { stateId: PRIOR_STATE_UUID, sortOrder: 12.5, updatedAt: '2026-08-09T11:59:00.000Z' } }),
  );
  assert.ok(decision.dispatch, 'a drag between columns also moves sortOrder; that must not mask the state change');
});

// --------------------------------------------------------------------
// Rules 6-7: item 28b's identity test
// --------------------------------------------------------------------

Deno.test('skips with a DISTINCT reason when the payload carried no labels array at all', () => {
  const decision = decideDispatch(issueEvent({ labels: undefined }));
  assert.ok(!decision.dispatch);
  // Not NO_TIER_LABEL: "the payload shape changed" and "this issue is not
  // ours" are different failures and must not be collapsed into one.
  assert.equal(decision.reason, 'LABELS_UNAVAILABLE');
});

Deno.test("skips Linear's own onboarding issues, which sit in Todo carrying no labels (item 28b)", () => {
  const decision = decideDispatch(issueEvent({ labels: [], identifier: 'GAM-1', title: 'Welcome to Linear' }));
  assert.ok(!decision.dispatch);
  assert.equal(decision.reason, 'NO_TIER_LABEL');
});

Deno.test('skips an issue carrying labels but no tier/* label', () => {
  const decision = decideDispatch(issueEvent({ labels: [{ id: 'l1', name: 'area/w4' }, { id: 'l2', name: 'escalated' }] }));
  assert.ok(!decision.dispatch);
  assert.equal(decision.reason, 'NO_TIER_LABEL');
});

Deno.test('a label list given as plain strings is still understood', () => {
  const decision = decideDispatch(issueEvent({ labels: ['tier/fast', 'area/w2'] }));
  assert.ok(decision.dispatch);
  assert.equal(decision.clientPayload.tier, 'fast');
  assert.deepEqual(decision.clientPayload.labels, ['tier/fast', 'area/w2']);
});

// --------------------------------------------------------------------
// Rule 8: gate/human
// --------------------------------------------------------------------

Deno.test('skips gate/human --- a machine may not take a row gated on a person', () => {
  const decision = decideDispatch(
    issueEvent({ labels: [{ id: 'l1', name: 'tier/standard' }, { id: 'l2', name: HUMAN_GATE_LABEL }] }),
  );
  assert.ok(!decision.dispatch);
  assert.equal(decision.reason, 'HUMAN_GATED');
});

Deno.test('gate/unverified is NOT a human gate --- re-measuring a premise is work an agent can do', () => {
  const decision = decideDispatch(
    issueEvent({ labels: [{ id: 'l1', name: 'tier/heavy' }, { id: 'l2', name: 'gate/unverified' }] }),
  );
  assert.ok(decision.dispatch);
});

// --------------------------------------------------------------------
// The exported helpers
// --------------------------------------------------------------------

Deno.test('extractLabelNames distinguishes "no labels field" (null) from "no labels" ([])', () => {
  assert.equal(extractLabelNames({}), null);
  assert.equal(extractLabelNames({ labels: 'not an array' }), null);
  assert.deepEqual(extractLabelNames({ labels: [] }), []);
  assert.deepEqual(extractLabelNames({ labels: [{ name: 'tier/fast' }, 'area/w1'] }), ['tier/fast', 'area/w1']);
  // Entries that carry no usable name are dropped rather than becoming
  // `undefined` in the list.
  assert.deepEqual(extractLabelNames({ labels: [{ id: 'no-name' }, 42, null, { name: 'tier/heavy' }] }), [
    'tier/heavy',
  ]);
});

Deno.test('tierFromLabels strips the group, is case-insensitive, and rejects a bare "tier/"', () => {
  assert.equal(tierFromLabels(['tier/heavy']), 'heavy');
  assert.equal(tierFromLabels(['area/w1', 'tier/fast']), 'fast');
  assert.equal(tierFromLabels(['TIER/Standard']), 'standard', 'normalised to lower case');
  assert.equal(tierFromLabels([' tier/unreviewed ']), 'unreviewed');
  assert.equal(tierFromLabels([]), null);
  assert.equal(tierFromLabels(['area/w1']), null);
  assert.equal(tierFromLabels(['tier/']), null, 'a prefix with nothing after it is not a tier');
});

// --------------------------------------------------------------------
// The grouped-label shape --- the real one
// --------------------------------------------------------------------
//
// `tier/fast` is NOT a label name in Linear. The workspace holds a label
// GROUP `tier` whose children are named bare: `fast`, `standard`, `heavy`,
// `unreviewed`. The slashes everywhere in this project's docs are synthesised
// by `scripts/linear-export.mjs` (`${l.parent.name}/${l.name}`).
//
// A filter matching only `startsWith('tier/')` would therefore reject every
// real issue with reason NO_TIER_LABEL --- a queue that never dispatches and
// logs a plausible reason each time. These tests pin the real shape.

Deno.test('tierFromLabels recognises bare child names, which is what Linear actually stores', () => {
  for (const bare of KNOWN_TIER_NAMES) {
    assert.equal(tierFromLabels([bare]), bare, `bare group-child name "${bare}"`);
  }
  assert.equal(tierFromLabels(['Standard']), 'standard', 'and case-insensitively');
  // An ungrouped label that merely sits alongside them is still not a tier.
  assert.equal(tierFromLabels(['escalated', 'Bug', 'Improvement']), null);
});

Deno.test('extractLabelNames rebuilds the group/name path when the payload carries a parent', () => {
  assert.deepEqual(
    extractLabelNames({
      labels: [
        { id: 'l1', name: 'standard', parent: { name: 'tier' } },
        { id: 'l2', name: 'w4', parent: { name: 'area' } },
        { id: 'l3', name: 'escalated' },
      ],
    }),
    ['tier/standard', 'area/w4', 'escalated'],
    'matches the path form scripts/linear-export.mjs writes',
  );
});

Deno.test('dispatches an issue whose labels arrive in the real grouped shape', () => {
  const decision = decideDispatch(
    issueEvent({
      labels: [
        { id: 'l1', name: 'heavy', parent: { name: 'tier' } },
        { id: 'l2', name: 'w4', parent: { name: 'area' } },
      ],
    }),
  );
  assert.ok(decision.dispatch, 'a grouped tier label must be recognised');
  assert.equal(decision.clientPayload.tier, 'heavy');
  assert.deepEqual(decision.clientPayload.labels, ['tier/heavy', 'area/w4']);
});

Deno.test('dispatches when the payload gives bare child names with no parent object', () => {
  const decision = decideDispatch(issueEvent({ labels: [{ id: 'l1', name: 'unreviewed' }] }));
  assert.ok(decision.dispatch, 'a webhook that omits `parent` must still work');
  assert.equal(decision.clientPayload.tier, 'unreviewed');
});

Deno.test('gate/human is caught in both the grouped and the bare shape', () => {
  const grouped = decideDispatch(
    issueEvent({
      labels: [
        { id: 'l1', name: 'standard', parent: { name: 'tier' } },
        { id: 'l2', name: 'human', parent: { name: 'gate' } },
      ],
    }),
  );
  assert.ok(!grouped.dispatch);
  assert.equal(grouped.reason, 'HUMAN_GATED');

  const bare = decideDispatch(issueEvent({ labels: [{ id: 'l1', name: 'standard' }, { id: 'l2', name: 'human' }] }));
  assert.ok(!bare.dispatch);
  assert.equal(bare.reason, 'HUMAN_GATED');
});

Deno.test('a grouped gate/unverified still dispatches --- only gate/human blocks', () => {
  const decision = decideDispatch(
    issueEvent({
      labels: [
        { id: 'l1', name: 'fast', parent: { name: 'tier' } },
        { id: 'l2', name: 'unverified', parent: { name: 'gate' } },
      ],
    }),
  );
  assert.ok(decision.dispatch);
  assert.equal(decision.clientPayload.tier, 'fast');
});

Deno.test('hasHumanGate matches exactly, case-insensitively, and does not match by prefix', () => {
  assert.ok(hasHumanGate(['gate/human']));
  assert.ok(hasHumanGate(['GATE/Human']));
  assert.ok(hasHumanGate([' gate/human ']));
  assert.ok(!hasHumanGate(['gate/unverified']));
  assert.ok(!hasHumanGate(['gate/human-ish']), 'a longer label that merely starts the same is a different label');
  assert.ok(!hasHumanGate([]));
});
