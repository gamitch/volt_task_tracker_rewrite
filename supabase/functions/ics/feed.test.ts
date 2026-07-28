// T047: integration-style tests for feed.ts, exercising the REAL
// `ical-generator`-backed pipeline end to end (role scoping -> description
// decision -> ics_builder.ts -> ical-generator's own `.toString()`), then
// round-trip-verifying the actual generated output with
// ics_structural_check.ts (see that file's header for why this is the
// practical substitute for live Google Calendar validation, per Trap #5).
// Run with `deno test supabase/functions/ics/`.
//
// No ICS-format string is ever hand-typed as fixture "expected calendar
// text" anywhere in this file -- every assertion either checks a plain data
// value (event count, a UID string, a status enum-string) or is derived from
// parsing the library's own real output back with checkIcsStructure().
import assert from 'node:assert/strict';
import { buildFeed, type FeedEventRow, type FeedSessionRow } from './feed.ts';
import { checkIcsStructure } from './ics_structural_check.ts';

const TEAM_A = 'aaaaaaaa-0000-0000-0000-000000000001';
const TEAM_B = 'bbbbbbbb-0000-0000-0000-000000000002';

const EVENT_ALL: FeedEventRow = {
  address: '',
  id: 'event-all',
  location_name: 'VOLT Shop',
  team_ids: null,
  title: 'All-Teams Kickoff',
  type: 'meeting',
};
const EVENT_A: FeedEventRow = {
  address: '456 Oak Ave',
  id: 'event-a',
  location_name: 'Downtown Plaza',
  team_ids: [TEAM_A],
  title: 'Team A Car Wash',
  type: 'outreach',
};
const EVENT_B: FeedEventRow = {
  address: '',
  id: 'event-b',
  location_name: 'Regional Arena',
  team_ids: [TEAM_B],
  title: 'Team B Regional',
  type: 'competition',
};
const EVENTS = [EVENT_ALL, EVENT_A, EVENT_B];

const SESSION_ALL_1: FeedSessionRow = {
  ends_at: '2026-08-01T20:00:00.000Z',
  event_id: 'event-all',
  id: 'session-all-1',
  starts_at: '2026-08-01T18:00:00.000Z',
  status: 'scheduled',
};
const SESSION_A_1: FeedSessionRow = {
  ends_at: '2026-08-02T14:00:00.000Z',
  event_id: 'event-a',
  id: 'session-a-1',
  starts_at: '2026-08-02T10:00:00.000Z',
  status: 'scheduled',
};
const SESSION_A_2_CANCELED: FeedSessionRow = {
  ends_at: '2026-08-09T14:00:00.000Z',
  event_id: 'event-a',
  id: 'session-a-2',
  starts_at: '2026-08-09T10:00:00.000Z',
  status: 'canceled',
};
const SESSION_B_1: FeedSessionRow = {
  ends_at: '2026-08-15T18:00:00.000Z',
  event_id: 'event-b',
  id: 'session-b-1',
  starts_at: '2026-08-15T09:00:00.000Z',
  status: 'completed',
};
const SESSIONS = [SESSION_ALL_1, SESSION_A_1, SESSION_A_2_CANCELED, SESSION_B_1];

Deno.test('feed round-trips as structurally valid ICS (practical substitute for live Google Calendar validation)', () => {
  const output = buildFeed({
    events: EVENTS,
    relevantTeamIds: [],
    role: 'admin',
    rsvpBySessionId: new Map(),
    sessions: SESSIONS,
  });

  const parsed = checkIcsStructure(output);
  assert.deepEqual(parsed.errors, []);
  assert.ok(parsed.valid);
});

Deno.test('feed sets X-WR-CALNAME=VOLT and REFRESH-INTERVAL=PT6H (CAL-04 literal requirements)', () => {
  const output = buildFeed({ events: EVENTS, relevantTeamIds: [], role: 'admin', rsvpBySessionId: new Map(), sessions: SESSIONS });
  const parsed = checkIcsStructure(output);
  assert.equal(parsed.wrCalName, 'VOLT');
  assert.equal(parsed.refreshInterval, 'PT6H');
});

Deno.test('role scenario 1/4 -- admin sees every session across every team', () => {
  const output = buildFeed({ events: EVENTS, relevantTeamIds: [], role: 'admin', rsvpBySessionId: new Map(), sessions: SESSIONS });
  const parsed = checkIcsStructure(output);
  assert.equal(parsed.events.length, 4);
  const uids = parsed.events.map((e) => e.uid).sort();
  assert.deepEqual(uids, ['session-a-1@volt', 'session-a-2@volt', 'session-all-1@volt', 'session-b-1@volt']);
});

Deno.test('role scenario 2/4 -- coach sees every session across every team (same as admin)', () => {
  const output = buildFeed({ events: EVENTS, relevantTeamIds: [], role: 'coach', rsvpBySessionId: new Map(), sessions: SESSIONS });
  const parsed = checkIcsStructure(output);
  assert.equal(parsed.events.length, 4);
});

Deno.test('role scenario 3/4 -- student on team A sees team-A-scoped + null-team_ids sessions, not team B', () => {
  const output = buildFeed({
    events: EVENTS,
    relevantTeamIds: [TEAM_A],
    role: 'student',
    rsvpBySessionId: new Map([['session-a-1', 'going']]),
    sessions: SESSIONS,
  });
  const parsed = checkIcsStructure(output);
  const uids = parsed.events.map((e) => e.uid).sort();
  assert.deepEqual(uids, ['session-a-1@volt', 'session-a-2@volt', 'session-all-1@volt']);
  assert.ok(!uids.includes('session-b-1@volt'));

  const sessionA1 = parsed.events.find((e) => e.uid === 'session-a-1@volt');
  assert.equal(sessionA1?.description, 'Your RSVP: Going');

  // No rsvp on record for this session -- description omitted, not fabricated.
  const sessionAll1 = parsed.events.find((e) => e.uid === 'session-all-1@volt');
  assert.equal(sessionAll1?.description, null);
});

Deno.test('role scenario 4/4 -- parent linked to students on BOTH team A and team B sees the union, with no description', () => {
  const output = buildFeed({
    events: EVENTS,
    relevantTeamIds: [TEAM_A, TEAM_B],
    role: 'parent',
    rsvpBySessionId: new Map(),
    sessions: SESSIONS,
  });
  const parsed = checkIcsStructure(output);
  assert.equal(parsed.events.length, 4); // union of both linked children's teams + null-team_ids
  for (const event of parsed.events) {
    assert.equal(event.description, null);
  }
});

Deno.test('a student on a team with no matching team-scoped events still sees the null-team_ids ("all teams") event', () => {
  const unrelatedTeam = 'cccccccc-0000-0000-0000-000000000003';
  const output = buildFeed({
    events: EVENTS,
    relevantTeamIds: [unrelatedTeam],
    role: 'student',
    rsvpBySessionId: new Map(),
    sessions: SESSIONS,
  });
  const parsed = checkIcsStructure(output);
  const uids = parsed.events.map((e) => e.uid);
  assert.deepEqual(uids, ['session-all-1@volt']);
});

Deno.test('canceled sessions are INCLUDED with STATUS:CANCELLED, not excluded from the feed', () => {
  const output = buildFeed({ events: EVENTS, relevantTeamIds: [], role: 'admin', rsvpBySessionId: new Map(), sessions: SESSIONS });
  const parsed = checkIcsStructure(output);
  const canceled = parsed.events.find((e) => e.uid === 'session-a-2@volt');
  assert.ok(canceled, 'canceled session must still be present in the feed');
  assert.equal(canceled?.status, 'CANCELLED');

  const scheduled = parsed.events.find((e) => e.uid === 'session-a-1@volt');
  assert.equal(scheduled?.status, null); // no STATUS line for a non-canceled session
});

Deno.test('SUMMARY uses the literal [Meeting|Outreach|Comp] prefix per event type', () => {
  const output = buildFeed({ events: EVENTS, relevantTeamIds: [], role: 'admin', rsvpBySessionId: new Map(), sessions: SESSIONS });
  const parsed = checkIcsStructure(output);
  assert.equal(parsed.events.find((e) => e.uid === 'session-all-1@volt')?.summary, '[Meeting] All-Teams Kickoff');
  assert.equal(parsed.events.find((e) => e.uid === 'session-a-1@volt')?.summary, '[Outreach] Team A Car Wash');
  assert.equal(parsed.events.find((e) => e.uid === 'session-b-1@volt')?.summary, '[Comp] Team B Regional');
});

Deno.test('LOCATION concatenates location_name and address when both are present', () => {
  const output = buildFeed({ events: EVENTS, relevantTeamIds: [], role: 'admin', rsvpBySessionId: new Map(), sessions: SESSIONS });
  const parsed = checkIcsStructure(output);
  assert.equal(parsed.events.find((e) => e.uid === 'session-a-1@volt')?.location, 'Downtown Plaza, 456 Oak Ave');
  // empty address -> location_name alone
  assert.equal(parsed.events.find((e) => e.uid === 'session-all-1@volt')?.location, 'VOLT Shop');
});

Deno.test('an empty scope (no sessions in scope) still produces a structurally valid, empty-but-not-error feed', () => {
  const unrelatedTeam = 'dddddddd-0000-0000-0000-000000000004';
  const output = buildFeed({
    events: [EVENT_A, EVENT_B], // deliberately no null-team_ids event this time
    relevantTeamIds: [unrelatedTeam],
    role: 'student',
    rsvpBySessionId: new Map(),
    sessions: [SESSION_A_1, SESSION_B_1],
  });
  const parsed = checkIcsStructure(output);
  assert.ok(parsed.valid);
  assert.equal(parsed.events.length, 0);
  assert.equal(parsed.wrCalName, 'VOLT');
});
