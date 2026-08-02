import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../client';
import { createLoader, type LoaderQueryResult } from '../loader';

export type CalendarEventType = 'meeting' | 'outreach' | 'competition';
export type CalendarSessionStatus = 'scheduled' | 'completed' | 'canceled';

export interface CalendarEventRow {
  id: string;
  seasonId: string;
  type: CalendarEventType;
  title: string;
  locationName: string;
}

export interface CalendarSessionRow {
  id: string;
  eventId: string;
  sessionDate: string;
  startsAt: string;
  endsAt: string;
  status: CalendarSessionStatus;
}

export interface CalendarLoadResult {
  events: readonly CalendarEventRow[];
  sessions: readonly CalendarSessionRow[];
}

export type LoadCalendarSessionsFn = (seasonId: string) => Promise<CalendarLoadResult>;

interface CalendarEventDbRow {
  id: string;
  season_id: string;
  type: CalendarEventType;
  title: string;
  location_name: string;
}

interface CalendarSessionDbRow {
  id: string;
  event_id: string;
  session_date: string;
  starts_at: string;
  ends_at: string;
  status: CalendarSessionStatus;
}

async function queryEvents(
  client: SupabaseClient,
  seasonId: string,
): Promise<LoaderQueryResult<CalendarEventDbRow[]>> {
  const result = await client
    .from('events')
    .select('id, season_id, type, title, location_name')
    .eq('season_id', seasonId);
  return { data: (result.data as CalendarEventDbRow[] | null) ?? null, error: result.error };
}

async function querySessions(
  client: SupabaseClient,
  eventIds: readonly string[],
): Promise<LoaderQueryResult<CalendarSessionDbRow[]>> {
  const result = await client
    .from('event_sessions')
    .select('id, event_id, session_date, starts_at, ends_at, status')
    .in('event_id', eventIds)
    .order('starts_at', { ascending: true });
  return { data: (result.data as CalendarSessionDbRow[] | null) ?? null, error: result.error };
}

function mapEvent(row: CalendarEventDbRow): CalendarEventRow {
  return {
    id: row.id,
    seasonId: row.season_id,
    type: row.type,
    title: row.title,
    locationName: row.location_name,
  };
}

function mapSession(row: CalendarSessionDbRow): CalendarSessionRow {
  return {
    id: row.id,
    eventId: row.event_id,
    sessionDate: row.session_date,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    status: row.status,
  };
}

export function makeLoadCalendarSessions(
  getClient: () => SupabaseClient = getSupabaseClient,
): LoadCalendarSessionsFn {
  const loadEvents = createLoader<string, CalendarEventDbRow[]>(queryEvents, getClient);
  const loadSessions = createLoader<readonly string[], CalendarSessionDbRow[]>(
    querySessions,
    getClient,
  );

  return async (seasonId: string): Promise<CalendarLoadResult> => {
    const eventRows = (await loadEvents(seasonId)) ?? [];
    if (eventRows.length === 0) return { events: [], sessions: [] };

    const sessionRows = (await loadSessions(eventRows.map((event) => event.id))) ?? [];
    return { events: eventRows.map(mapEvent), sessions: sessionRows.map(mapSession) };
  };
}

export const loadCalendarSessions: LoadCalendarSessionsFn = makeLoadCalendarSessions();
