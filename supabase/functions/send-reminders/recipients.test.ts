// supabase/functions/send-reminders/recipients.test.ts
//
// T051 -- real test proof for the worker packet's required
// "notification_prefs filtering (opted-out recipient skipped, no-row
// recipient defaults to sent)" case, plus the dedupe-by-profile helper used
// for weekly-digest recipient expansion.
import assert from 'node:assert/strict';
import {
  dedupeCandidatesByProfileId,
  filterByNotificationPrefs,
  indexNotificationPrefsByProfileId,
  type NotificationPrefsRow,
  type RecipientCandidate,
} from './recipients.ts';

function candidate(overrides: Partial<RecipientCandidate> = {}): RecipientCandidate {
  return {
    profileId: 'profile-1',
    email: 'student1@example.com',
    displayName: 'Student One',
    role: 'student',
    studentDisplayName: 'Student One',
    ...overrides,
  };
}

function prefsRow(overrides: Partial<NotificationPrefsRow> = {}): NotificationPrefsRow {
  return {
    profile_id: 'profile-1',
    event_reminder_48h: true,
    event_reminder_3h: true,
    meeting_reminder_3h: true,
    weekly_digest: true,
    ...overrides,
  };
}

Deno.test('filterByNotificationPrefs: an opted-out recipient (column explicitly false) is skipped', () => {
  const candidates = [candidate({ profileId: 'profile-opted-out' })];
  const prefs = indexNotificationPrefsByProfileId([prefsRow({ profile_id: 'profile-opted-out', event_reminder_48h: false })]);

  const result = filterByNotificationPrefs(candidates, prefs, 'event_reminder_48h');

  assert.deepEqual(result, []);
});

Deno.test('filterByNotificationPrefs: a recipient with NO notification_prefs row at all defaults to sending (absence of opt-out)', () => {
  const candidates = [candidate({ profileId: 'profile-no-row' })];
  const prefs = indexNotificationPrefsByProfileId([]); // no row for this profile at all

  const result = filterByNotificationPrefs(candidates, prefs, 'event_reminder_48h');

  assert.deepEqual(result, candidates);
});

Deno.test('filterByNotificationPrefs: a recipient with an explicit true row is kept', () => {
  const candidates = [candidate({ profileId: 'profile-opted-in' })];
  const prefs = indexNotificationPrefsByProfileId([prefsRow({ profile_id: 'profile-opted-in', event_reminder_48h: true })]);

  const result = filterByNotificationPrefs(candidates, prefs, 'event_reminder_48h');

  assert.deepEqual(result, candidates);
});

Deno.test('filterByNotificationPrefs: only the SPECIFIED column is consulted -- opted out of a different template does not affect this one', () => {
  const candidates = [candidate({ profileId: 'profile-1' })];
  // Opted out of meeting_reminder_3h specifically, but this call checks
  // event_reminder_48h -- must still be kept.
  const prefs = indexNotificationPrefsByProfileId([prefsRow({ profile_id: 'profile-1', meeting_reminder_3h: false, event_reminder_48h: true })]);

  const result = filterByNotificationPrefs(candidates, prefs, 'event_reminder_48h');

  assert.deepEqual(result, candidates);
});

Deno.test('filterByNotificationPrefs: mixed batch -- opted-out filtered, opted-in and no-row both kept', () => {
  const candidates = [
    candidate({ profileId: 'opted-out', email: 'a@example.com' }),
    candidate({ profileId: 'opted-in', email: 'b@example.com' }),
    candidate({ profileId: 'no-row', email: 'c@example.com' }),
  ];
  const prefs = indexNotificationPrefsByProfileId([
    prefsRow({ profile_id: 'opted-out', meeting_reminder_3h: false }),
    prefsRow({ profile_id: 'opted-in', meeting_reminder_3h: true }),
    // no row for 'no-row'
  ]);

  const result = filterByNotificationPrefs(candidates, prefs, 'meeting_reminder_3h');

  assert.deepEqual(
    result.map((c) => c.profileId),
    ['opted-in', 'no-row'],
  );
});

Deno.test('filterByNotificationPrefs: distinct columns are independent for the SAME profile (48h opt-out does not imply 3h opt-out)', () => {
  const candidates = [candidate({ profileId: 'profile-1' })];
  const prefs = indexNotificationPrefsByProfileId([prefsRow({ profile_id: 'profile-1', event_reminder_48h: false, event_reminder_3h: true })]);

  assert.deepEqual(filterByNotificationPrefs(candidates, prefs, 'event_reminder_48h'), []);
  assert.deepEqual(filterByNotificationPrefs(candidates, prefs, 'event_reminder_3h'), candidates);
});

// --- dedupeCandidatesByProfileId (weekly-digest recipient expansion) -----

Deno.test('dedupeCandidatesByProfileId: a parent linked to multiple students appears exactly once', () => {
  const candidates = [
    candidate({ profileId: 'parent-1', studentDisplayName: 'Kid One' }),
    candidate({ profileId: 'parent-1', studentDisplayName: 'Kid Two' }),
    candidate({ profileId: 'parent-2', studentDisplayName: 'Kid Three' }),
  ];

  const result = dedupeCandidatesByProfileId(candidates);

  assert.deepEqual(
    result.map((c) => c.profileId),
    ['parent-1', 'parent-2'],
  );
});

Deno.test('dedupeCandidatesByProfileId: keeps the first occurrence, preserves order otherwise', () => {
  const candidates = [
    candidate({ profileId: 'parent-2', email: 'second@example.com' }),
    candidate({ profileId: 'parent-1', email: 'first@example.com' }),
    candidate({ profileId: 'parent-2', email: 'second-again@example.com' }),
  ];

  const result = dedupeCandidatesByProfileId(candidates);

  assert.deepEqual(
    result.map((c) => c.email),
    ['second@example.com', 'first@example.com'],
  );
});

Deno.test('dedupeCandidatesByProfileId: empty input yields empty output', () => {
  assert.deepEqual(dedupeCandidatesByProfileId([]), []);
});
