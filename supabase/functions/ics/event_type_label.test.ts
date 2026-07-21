// T047: unit tests for event_type_label.ts. Run with `deno test supabase/functions/ics/`.
import assert from 'node:assert/strict';
import { mapEventTypeToSummaryPrefix } from './event_type_label.ts';

Deno.test('mapEventTypeToSummaryPrefix: meeting -> Meeting', () => {
  assert.equal(mapEventTypeToSummaryPrefix('meeting'), 'Meeting');
});

Deno.test('mapEventTypeToSummaryPrefix: outreach -> Outreach', () => {
  assert.equal(mapEventTypeToSummaryPrefix('outreach'), 'Outreach');
});

Deno.test('mapEventTypeToSummaryPrefix: competition -> Comp (not "Competition")', () => {
  assert.equal(mapEventTypeToSummaryPrefix('competition'), 'Comp');
});

Deno.test('mapEventTypeToSummaryPrefix: unknown value falls back to a capitalized raw value, not a crash', () => {
  assert.equal(mapEventTypeToSummaryPrefix('social'), 'Social');
});

Deno.test('mapEventTypeToSummaryPrefix: empty string falls back to itself', () => {
  assert.equal(mapEventTypeToSummaryPrefix(''), '');
});
