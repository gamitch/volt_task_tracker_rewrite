// T063 (MIG-04): unit tests for JsonFileOldDataSource. Each test builds its
// own throwaway directory under the OS temp dir (node:fs/promises
// mkdtemp/rm) rather than sharing fixtures across tests, so a failing
// assertion can never leave stale files for the next test to trip over.
// Covers: a good directory (all six files, matching the real export shape),
// a missing file, a malformed (non-array) file, and app_settings.json with
// zero rows or two rows (must be exactly one -- it's a singleton table).
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { JsonFileOldDataSource } from './jsonFileSource.ts';

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'volt-json-source-test-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function writeJson(fileName: string, contents: unknown): Promise<void> {
  await writeFile(join(dir, fileName), JSON.stringify(contents), 'utf8');
}

/** Writes all six files with minimal, well-formed contents matching the
 * real export shape (one row each is enough to exercise "reads and returns
 * as-is" without re-testing the transform layer, which isn't this file's
 * job). */
async function writeGoodDirectory(): Promise<void> {
  await writeJson('teams.json', [
    { id: 'team-1', name: 'Gear Girls', short_name: 'GG', color: '#abcdef', archived: false, sort_order: 1 },
  ]);
  await writeJson('students.json', [
    { id: 'student-1', name: 'Robin', team_affiliation: 'Gear Girls', active: true, goal_hours: null },
  ]);
  await writeJson('events.json', [
    {
      id: 'event-1',
      name: 'Build Night',
      location: 'Shop',
      notes: null,
      category: 'meeting',
      adult_volunteers_count: 1,
      adult_volunteer_hours: 2,
      status: 'completed',
      attendees: ['student-1'],
    },
  ]);
  await writeJson('event_sessions.json', [
    { id: 'session-1', event_id: 'event-1', date: '2026-01-10', start_time: '18:00', end_time: '20:00' },
  ]);
  await writeJson('session_attendance.json', [
    { id: 'attendance-1', session_id: 'session-1', student_id: 'student-1', hours: 2, planned: false },
  ]);
  await writeJson('app_settings.json', [{ id: 1, season_goal: 90 }]);
}

describe('JsonFileOldDataSource', () => {
  it('reads every table, unmodified, from a well-formed directory', async () => {
    await writeGoodDirectory();
    const source = new JsonFileOldDataSource(dir);

    await expect(source.listTeams()).resolves.toEqual([
      { id: 'team-1', name: 'Gear Girls', short_name: 'GG', color: '#abcdef', archived: false, sort_order: 1 },
    ]);
    await expect(source.listStudents()).resolves.toEqual([
      { id: 'student-1', name: 'Robin', team_affiliation: 'Gear Girls', active: true, goal_hours: null },
    ]);
    await expect(source.listEvents()).resolves.toEqual([
      {
        id: 'event-1',
        name: 'Build Night',
        location: 'Shop',
        notes: null,
        category: 'meeting',
        adult_volunteers_count: 1,
        adult_volunteer_hours: 2,
        status: 'completed',
        attendees: ['student-1'],
      },
    ]);
    await expect(source.listEventSessions()).resolves.toEqual([
      { id: 'session-1', event_id: 'event-1', date: '2026-01-10', start_time: '18:00', end_time: '20:00' },
    ]);
    await expect(source.listSessionAttendance()).resolves.toEqual([
      { id: 'attendance-1', session_id: 'session-1', student_id: 'student-1', hours: 2, planned: false },
    ]);
    await expect(source.getAppSettings()).resolves.toEqual({ id: 1, season_goal: 90 });
  });

  it('rejects with a clear, file-named error when a table file is missing', async () => {
    await writeGoodDirectory();
    await rm(join(dir, 'teams.json'));
    const source = new JsonFileOldDataSource(dir);

    await expect(source.listTeams()).rejects.toThrow(/teams\.json/);
    await expect(source.listTeams()).rejects.toThrow(/failed to read/);
  });

  it('rejects with a clear, file-named error when a table file is not a JSON array', async () => {
    await writeGoodDirectory();
    // A single object instead of an array -- the exact mistake a hand-edited
    // export could make (json_agg over zero rows and no wrapping array, or a
    // copy/paste of one row without brackets).
    await writeJson('students.json', { id: 'student-1', name: 'Robin' });
    const source = new JsonFileOldDataSource(dir);

    await expect(source.listStudents()).rejects.toThrow(/students\.json/);
    await expect(source.listStudents()).rejects.toThrow(/must contain a JSON array/);
  });

  it('rejects with a clear error when a table file contains invalid JSON', async () => {
    await writeGoodDirectory();
    await writeFile(join(dir, 'events.json'), '{not valid json', 'utf8');
    const source = new JsonFileOldDataSource(dir);

    await expect(source.listEvents()).rejects.toThrow(/events\.json/);
    await expect(source.listEvents()).rejects.toThrow(/not valid JSON/);
  });

  it('rejects when app_settings.json is an empty array (zero rows)', async () => {
    await writeGoodDirectory();
    await writeJson('app_settings.json', []);
    const source = new JsonFileOldDataSource(dir);

    await expect(source.getAppSettings()).rejects.toThrow(/app_settings\.json/);
    await expect(source.getAppSettings()).rejects.toThrow(/exactly one row/);
    await expect(source.getAppSettings()).rejects.toThrow(/got 0/);
  });

  it('rejects when app_settings.json contains more than one row (two rows)', async () => {
    await writeGoodDirectory();
    await writeJson('app_settings.json', [
      { id: 1, season_goal: 90 },
      { id: 2, season_goal: 100 },
    ]);
    const source = new JsonFileOldDataSource(dir);

    await expect(source.getAppSettings()).rejects.toThrow(/app_settings\.json/);
    await expect(source.getAppSettings()).rejects.toThrow(/exactly one row/);
    await expect(source.getAppSettings()).rejects.toThrow(/got 2/);
  });

  it('never writes to the source directory (read-only contract)', async () => {
    await writeGoodDirectory();
    const before = (await readdir(dir)).sort();
    const source = new JsonFileOldDataSource(dir);

    await Promise.all([
      source.listTeams(),
      source.listStudents(),
      source.listEvents(),
      source.listEventSessions(),
      source.listSessionAttendance(),
      source.getAppSettings(),
    ]);

    const after = (await readdir(dir)).sort();
    expect(after).toEqual(before);
  });
});
