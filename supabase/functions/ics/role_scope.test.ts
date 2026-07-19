// T047: unit tests for role_scope.ts. Run with `deno test supabase/functions/ics/`.
import assert from 'node:assert/strict';
import { isEventInScope, resolveRoleScope, type RoleScope } from './role_scope.ts';

const TEAM_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const TEAM_B = 'bbbbbbbb-0000-0000-0000-000000000002';
const TEAM_C = 'cccccccc-0000-0000-0000-000000000003';

Deno.test('resolveRoleScope: admin always resolves to all, ignoring any input teams', () => {
  assert.deepEqual(resolveRoleScope('admin', []), { kind: 'all' });
  assert.deepEqual(resolveRoleScope('admin', [TEAM_A]), { kind: 'all' });
});

Deno.test('resolveRoleScope: coach always resolves to all, ignoring any input teams', () => {
  assert.deepEqual(resolveRoleScope('coach', []), { kind: 'all' });
  assert.deepEqual(resolveRoleScope('coach', [TEAM_A]), { kind: 'all' });
});

Deno.test('resolveRoleScope: student resolves to a single-team scope', () => {
  assert.deepEqual(resolveRoleScope('student', [TEAM_A]), { kind: 'teams', teamIds: [TEAM_A] });
});

Deno.test('resolveRoleScope: student with no students row resolves to an empty (not "all") scope', () => {
  assert.deepEqual(resolveRoleScope('student', []), { kind: 'teams', teamIds: [] });
});

Deno.test('resolveRoleScope: parent with two linked students on different teams unions both', () => {
  const scope = resolveRoleScope('parent', [TEAM_A, TEAM_B]);
  assert.equal(scope.kind, 'teams');
  if (scope.kind === 'teams') {
    assert.deepEqual([...scope.teamIds].sort(), [TEAM_A, TEAM_B].sort());
  }
});

Deno.test('resolveRoleScope: parent with two linked students on the SAME team dedupes', () => {
  const scope = resolveRoleScope('parent', [TEAM_A, TEAM_A]);
  assert.deepEqual(scope, { kind: 'teams', teamIds: [TEAM_A] });
});

Deno.test('isEventInScope: "all" scope matches every event regardless of team_ids', () => {
  const scope: RoleScope = { kind: 'all' };
  assert.ok(isEventInScope(null, scope));
  assert.ok(isEventInScope([TEAM_A], scope));
  assert.ok(isEventInScope([TEAM_B, TEAM_C], scope));
});

Deno.test('isEventInScope: team_ids=null (all teams) matches any team-scoped caller', () => {
  const scope: RoleScope = { kind: 'teams', teamIds: [TEAM_A] };
  assert.ok(isEventInScope(null, scope));
});

Deno.test('isEventInScope: single-team student scope matches only overlapping events', () => {
  const scope: RoleScope = { kind: 'teams', teamIds: [TEAM_A] };
  assert.ok(isEventInScope([TEAM_A], scope));
  assert.ok(isEventInScope([TEAM_A, TEAM_B], scope));
  assert.ok(!isEventInScope([TEAM_B], scope));
  assert.ok(!isEventInScope([TEAM_B, TEAM_C], scope));
});

Deno.test('isEventInScope: parent multi-team union scope sees events for EITHER linked team', () => {
  const scope: RoleScope = { kind: 'teams', teamIds: [TEAM_A, TEAM_B] };
  assert.ok(isEventInScope([TEAM_A], scope)); // child 1's team only
  assert.ok(isEventInScope([TEAM_B], scope)); // child 2's team only
  assert.ok(isEventInScope([TEAM_A, TEAM_C], scope)); // overlaps on child 1's team
  assert.ok(!isEventInScope([TEAM_C], scope)); // neither child's team
});

Deno.test('isEventInScope: empty-team scope (no students row) matches nothing except team_ids=null', () => {
  const scope: RoleScope = { kind: 'teams', teamIds: [] };
  assert.ok(isEventInScope(null, scope));
  assert.ok(!isEventInScope([TEAM_A], scope));
});
