// T047: unit tests for description.ts. Run with `deno test supabase/functions/ics/`.
import assert from 'node:assert/strict';
import { buildDescription } from './description.ts';

Deno.test('buildDescription: student with a "going" rsvp gets a labeled description', () => {
  assert.equal(buildDescription('student', 'going'), 'Your RSVP: Going');
});

Deno.test('buildDescription: student with a "maybe" rsvp gets a labeled description', () => {
  assert.equal(buildDescription('student', 'maybe'), 'Your RSVP: Maybe');
});

Deno.test('buildDescription: student with a "declined" rsvp gets a labeled description', () => {
  assert.equal(buildDescription('student', 'declined'), 'Your RSVP: Declined');
});

Deno.test('buildDescription: student with no rsvp on record omits (not fabricates) a description', () => {
  assert.equal(buildDescription('student', null), undefined);
});

Deno.test('buildDescription: admin never gets a description, even if a status were passed in', () => {
  assert.equal(buildDescription('admin', 'going'), undefined);
});

Deno.test('buildDescription: coach never gets a description', () => {
  assert.equal(buildDescription('coach', 'going'), undefined);
});

Deno.test('buildDescription: parent never gets a description (multi-child ambiguity, disclosed)', () => {
  assert.equal(buildDescription('parent', 'going'), undefined);
});

Deno.test('buildDescription: unrecognized rsvp status string still renders, not silently dropped', () => {
  assert.equal(buildDescription('student', 'tentative'), 'Your RSVP: tentative');
});
