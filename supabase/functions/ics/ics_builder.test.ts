// T047: direct unit tests for ics_builder.ts -- the single module that
// imports `npm:ical-generator`. Run with `deno test supabase/functions/ics/`.
import assert from 'node:assert/strict';
import { buildIcsFeed, type IcsSessionRow } from './ics_builder.ts';
import { checkIcsStructure } from './ics_structural_check.ts';

Deno.test('buildIcsFeed with zero sessions still produces a valid, empty VCALENDAR', () => {
  const output = buildIcsFeed([]);
  const parsed = checkIcsStructure(output);
  assert.ok(parsed.valid);
  assert.equal(parsed.events.length, 0);
  assert.equal(parsed.wrCalName, 'VOLT');
  assert.equal(parsed.refreshInterval, 'PT6H');
});

Deno.test('buildIcsFeed: UID is exactly "<session_id>@volt", not the event id', () => {
  const row: IcsSessionRow = {
    address: '',
    description: undefined,
    endsAt: '2026-08-01T20:00:00.000Z',
    eventTitle: 'Build Session',
    eventType: 'meeting',
    locationName: 'VOLT Shop',
    sessionId: 'a1111111-0000-0000-0000-000000000001',
    startsAt: '2026-08-01T18:00:00.000Z',
    status: 'scheduled',
  };
  const output = buildIcsFeed([row]);
  const parsed = checkIcsStructure(output);
  assert.equal(parsed.events.length, 1);
  assert.equal(parsed.events[0].uid, 'a1111111-0000-0000-0000-000000000001@volt');
});

Deno.test('buildIcsFeed: one VEVENT emitted per session row (not per event) -- two sessions of the same event become two VEVENTs', () => {
  const makeRow = (sessionId: string): IcsSessionRow => ({
    address: '',
    description: undefined,
    endsAt: '2026-08-01T20:00:00.000Z',
    eventTitle: 'Recurring Meeting',
    eventType: 'meeting',
    locationName: 'VOLT Shop',
    sessionId,
    startsAt: '2026-08-01T18:00:00.000Z',
    status: 'scheduled',
  });
  const output = buildIcsFeed([makeRow('session-1'), makeRow('session-2'), makeRow('session-3')]);
  const parsed = checkIcsStructure(output);
  assert.equal(parsed.events.length, 3);
});

Deno.test('buildIcsFeed: description is omitted entirely (no DESCRIPTION line) when undefined, not emitted as empty string', () => {
  const row: IcsSessionRow = {
    address: '',
    description: undefined,
    endsAt: '2026-08-01T20:00:00.000Z',
    eventTitle: 'Build Session',
    eventType: 'meeting',
    locationName: 'VOLT Shop',
    sessionId: 'session-1',
    startsAt: '2026-08-01T18:00:00.000Z',
    status: 'scheduled',
  };
  const output = buildIcsFeed([row]);
  assert.ok(!output.includes('DESCRIPTION'));
});

Deno.test('buildIcsFeed: a location value containing a comma is correctly escaped by the library (not double-escaped or broken)', () => {
  const row: IcsSessionRow = {
    address: '',
    description: undefined,
    endsAt: '2026-08-01T20:00:00.000Z',
    eventTitle: 'Car Wash',
    eventType: 'outreach',
    locationName: 'Downtown Plaza, Suite 4',
    sessionId: 'session-1',
    startsAt: '2026-08-01T18:00:00.000Z',
    status: 'scheduled',
  };
  const output = buildIcsFeed([row]);
  const parsed = checkIcsStructure(output);
  assert.equal(parsed.events[0].location, 'Downtown Plaza, Suite 4');
});
