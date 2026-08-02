import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { makeLoadCalendarSessions } from './calendar';

const EVENT_SELECT = 'id, season_id, type, title, location_name';
const SESSION_SELECT = 'id, event_id, session_date, starts_at, ends_at, status';

function makeClient(
  eventResult: { data: unknown; error: { message: string; code?: string } | null },
  sessionResult: { data: unknown; error: { message: string; code?: string } | null } = {
    data: [],
    error: null,
  },
) {
  const eventsEq = vi.fn().mockResolvedValue(eventResult);
  const eventsSelect = vi.fn(() => ({ eq: eventsEq }));
  const sessionsOrder = vi.fn().mockResolvedValue(sessionResult);
  const sessionsIn = vi.fn(() => ({ order: sessionsOrder }));
  const sessionsSelect = vi.fn(() => ({ in: sessionsIn }));
  const from = vi.fn((table: string) => {
    if (table === 'events') return { select: eventsSelect };
    if (table === 'event_sessions') return { select: sessionsSelect };
    throw new Error(`unexpected table ${table}`);
  });
  return {
    client: { from } as unknown as SupabaseClient,
    eventsEq,
    eventsSelect,
    sessionsIn,
    sessionsOrder,
    sessionsSelect,
  };
}

describe('makeLoadCalendarSessions', () => {
  it('scopes events to the supplied season, uses only screen fields, and maps both query results', async () => {
    const stub = makeClient(
      {
        data: [
          {
            id: 'event-1',
            season_id: 'season-324',
            type: 'meeting',
            title: 'Build Night',
            location_name: 'Workshop',
          },
        ],
        error: null,
      },
      {
        data: [
          {
            id: 'session-1',
            event_id: 'event-1',
            session_date: '2026-08-05',
            starts_at: '2026-08-05T23:00:00.000Z',
            ends_at: '2026-08-06T01:00:00.000Z',
            status: 'scheduled',
          },
        ],
        error: null,
      },
    );

    const result = await makeLoadCalendarSessions(() => stub.client)('season-324');

    expect(stub.eventsSelect).toHaveBeenCalledWith(EVENT_SELECT);
    expect(stub.eventsEq).toHaveBeenCalledWith('season_id', 'season-324');
    expect(stub.sessionsSelect).toHaveBeenCalledWith(SESSION_SELECT);
    expect(stub.sessionsIn).toHaveBeenCalledWith('event_id', ['event-1']);
    expect(stub.sessionsOrder).toHaveBeenCalledWith('starts_at', { ascending: true });
    expect(result).toEqual({
      events: [
        {
          id: 'event-1',
          seasonId: 'season-324',
          type: 'meeting',
          title: 'Build Night',
          locationName: 'Workshop',
        },
      ],
      sessions: [
        {
          id: 'session-1',
          eventId: 'event-1',
          sessionDate: '2026-08-05',
          startsAt: '2026-08-05T23:00:00.000Z',
          endsAt: '2026-08-06T01:00:00.000Z',
          status: 'scheduled',
        },
      ],
    });
  });

  it('returns two empty arrays and skips the dependent query when no visible events exist', async () => {
    const stub = makeClient({ data: [], error: null });

    await expect(makeLoadCalendarSessions(() => stub.client)('season-empty')).resolves.toEqual({
      events: [],
      sessions: [],
    });
    expect(stub.sessionsSelect).not.toHaveBeenCalled();
  });

  it('rejects when the season-scoped events query fails', async () => {
    const stub = makeClient({
      data: null,
      error: { message: 'events unavailable', code: 'PGRST' },
    });

    await expect(makeLoadCalendarSessions(() => stub.client)('season-error')).rejects.toMatchObject(
      {
        code: 'PGRST',
      },
    );
  });

  it('rejects when the dependent sessions query fails', async () => {
    const stub = makeClient(
      {
        data: [
          {
            id: 'event-1',
            season_id: 'season-324',
            type: 'outreach',
            title: 'Drive',
            location_name: 'Park',
          },
        ],
        error: null,
      },
      { data: null, error: { message: 'sessions unavailable', code: 'PGRST' } },
    );

    await expect(makeLoadCalendarSessions(() => stub.client)('season-324')).rejects.toMatchObject({
      code: 'PGRST',
    });
  });
});
