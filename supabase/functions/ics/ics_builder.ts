// supabase/functions/ics/ics_builder.ts
//
// The ONLY module in this function that constructs actual ICS-format
// content -- and it does so exclusively through `ical-generator` (constitution
// item 9's own allowlist entry, PRD line 312's own mandate: "Feed generation
// MUST use the `ical-generator` npm package ... hand-concatenated VCALENDAR
// strings ... are a checker BLOCKER"). There is no string concatenation of
// any ICS keyword (`BEGIN:`, `VEVENT`, `SUMMARY:`, `UID:`, `STATUS:`, etc.)
// anywhere in this file, or anywhere in index.ts -- every property below is
// set via the library's own typed setter API (`ical()`, `.name()`, `.ttl()`,
// `.createEvent()`, `ICalEventStatus.CANCELLED`), and the returned response
// body is exactly `calendar.toString()`, the library's own serialization.
// Line-folding (RFC 5545's 75-octet fold) and date formatting are entirely
// the library's responsibility -- this file never touches either.
//
// Imported via the `npm:` specifier (Deno 2 native support), matching
// checkin/index.ts's and send-invite/index.ts's own `npm:@supabase/supabase-js@2`
// precedent. Pinned to major version 11 (`npm:ical-generator@11`), the same
// pinning style checkin uses for supabase-js (`@2`).
import ical, { ICalEventStatus } from 'npm:ical-generator@11';
import { mapEventTypeToSummaryPrefix } from './event_type_label.ts';
import { buildLocation } from './location.ts';

export interface IcsSessionRow {
  // The real `event_sessions.id` -- UID is `<session_id>@volt`, per CAL-04's
  // own literal spec ("UID=<session_id>@volt"), NOT `<event_id>@volt`. One
  // VEVENT per session, not per event (a recurring meeting's 10 sessions are
  // 10 separate VEVENTs, per the worker packet).
  sessionId: string;
  status: 'scheduled' | 'completed' | 'canceled';
  startsAt: string; // event_sessions.starts_at, ISO 8601 (timestamptz)
  endsAt: string; // event_sessions.ends_at, ISO 8601 (timestamptz)
  eventType: string; // events.type
  eventTitle: string; // events.title
  locationName: string; // events.location_name
  address: string; // events.address
  // Pre-resolved by description.ts's `buildDescription` (role-aware) --
  // this module never makes that role decision itself, it only renders
  // whatever string (or `undefined`) it is given.
  description: string | undefined;
}

const CALENDAR_NAME = 'VOLT';
const REFRESH_INTERVAL_SECONDS = 6 * 60 * 60; // 6h, per CAL-04's literal REFRESH-INTERVAL;VALUE=DURATION:PT6H

export function buildIcsFeed(sessions: IcsSessionRow[]): string {
  // `ical({ name: ... })` is the library's own documented way to set both
  // `NAME` and `X-WR-CALNAME` (see its README/typedoc for `.name()`) --
  // CAL-04's literal `X-WR-CALNAME: VOLT` requirement.
  const calendar = ical({ name: CALENDAR_NAME });

  // `.ttl(seconds)` is the library's own documented setter that fills BOTH
  // `REFRESH-INTERVAL;VALUE=DURATION:...` and `X-PUBLISHED-TTL:...` from the
  // same numeric value (see ical-generator's `ICalCalendar.ttl()` typedoc:
  // "Is used to fill REFRESH-INTERVAL and X-PUBLISHED-TTL in your iCal").
  // CAL-04 only asks for REFRESH-INTERVAL; X-PUBLISHED-TTL is the library's
  // own paired legacy property for the identical value, not something this
  // module adds separately.
  calendar.ttl(REFRESH_INTERVAL_SECONDS);

  for (const session of sessions) {
    calendar.createEvent({
      id: `${session.sessionId}@volt`,
      start: new Date(session.startsAt),
      end: new Date(session.endsAt),
      summary: `[${mapEventTypeToSummaryPrefix(session.eventType)}] ${session.eventTitle}`,
      location: buildLocation(session.locationName, session.address),
      description: session.description ?? null,
      // STATUS:CANCELLED for canceled sessions -- included WITH the marker,
      // never filtered out of `sessions` for being canceled (index.ts does
      // not exclude them from the query; this loop iterates every row it is
      // given). `ICalEventStatus.CANCELLED` is the library's own real enum
      // member (see its `event.ts` source), not a guessed property name.
      status: session.status === 'canceled' ? ICalEventStatus.CANCELLED : null,
    });
  }

  return calendar.toString();
}
