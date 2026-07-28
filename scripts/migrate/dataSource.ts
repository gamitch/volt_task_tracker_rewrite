// T062 (MIG-03): the old-project read-only source interface + a
// Supabase-backed implementation. Per constitution item 16, this ETL only
// ever *reads* from the old project -- every method here is a SELECT, never
// a write. No method in this file issues an insert/update/delete against
// the old project's client.

import { createClient } from '@supabase/supabase-js';
import type { SupabaseProjectEnv } from './env.ts';
import type {
  OldAppSettings,
  OldEvent,
  OldEventSession,
  OldSessionAttendance,
  OldStudent,
  OldTeam,
} from './types.ts';

export interface OldDataSource {
  listTeams(): Promise<OldTeam[]>;
  listStudents(): Promise<OldStudent[]>;
  listEvents(): Promise<OldEvent[]>;
  listEventSessions(): Promise<OldEventSession[]>;
  listSessionAttendance(): Promise<OldSessionAttendance[]>;
  getAppSettings(): Promise<OldAppSettings>;
}

/**
 * Real old-project data source, built from OLD_SUPABASE_URL /
 * OLD_SERVICE_ROLE_KEY. Never used in --fixture mode (see
 * scripts/migrate/fixtures.ts's FixtureOldDataSource instead) -- this is
 * the path that remains blocked pending George's credentials (see
 * docs/migration/source-schema.md, cited rather than re-investigated here).
 */
export class SupabaseOldDataSource implements OldDataSource {
  private readonly client: ReturnType<typeof createClient>;

  constructor(env: SupabaseProjectEnv) {
    this.client = createClient(env.url, env.serviceRoleKey, {
      auth: { persistSession: false },
    });
  }

  async listTeams(): Promise<OldTeam[]> {
    const { data, error } = await this.client
      .from('teams')
      .select('id, name, short_name, color, archived, sort_order');
    if (error) {
      throw new Error(`Old project: failed to read teams: ${error.message}`);
    }
    return (data ?? []) as unknown as OldTeam[];
  }

  async listStudents(): Promise<OldStudent[]> {
    const { data, error } = await this.client
      .from('students')
      .select('id, name, team_affiliation, active, goal_hours');
    if (error) {
      throw new Error(`Old project: failed to read students: ${error.message}`);
    }
    return (data ?? []) as unknown as OldStudent[];
  }

  async listEvents(): Promise<OldEvent[]> {
    const { data, error } = await this.client
      .from('events')
      .select(
        'id, name, location, notes, category, adult_volunteers_count, adult_volunteer_hours, status, attendees',
      );
    if (error) {
      throw new Error(`Old project: failed to read events: ${error.message}`);
    }
    return (data ?? []) as unknown as OldEvent[];
  }

  async listEventSessions(): Promise<OldEventSession[]> {
    const { data, error } = await this.client
      .from('event_sessions')
      .select('id, event_id, date, start_time, end_time');
    if (error) {
      throw new Error(`Old project: failed to read event_sessions: ${error.message}`);
    }
    return (data ?? []) as unknown as OldEventSession[];
  }

  async listSessionAttendance(): Promise<OldSessionAttendance[]> {
    const { data, error } = await this.client
      .from('session_attendance')
      .select('id, session_id, student_id, hours, planned');
    if (error) {
      throw new Error(`Old project: failed to read session_attendance: ${error.message}`);
    }
    return (data ?? []) as unknown as OldSessionAttendance[];
  }

  async getAppSettings(): Promise<OldAppSettings> {
    const { data, error } = await this.client.from('app_settings').select('season_goal').limit(1);
    if (error) {
      throw new Error(`Old project: failed to read app_settings: ${error.message}`);
    }
    const row = (data ?? [])[0] as { season_goal: number } | undefined;
    if (!row) {
      throw new Error('Old project: app_settings singleton row not found');
    }
    return { season_goal: row.season_goal };
  }
}
