// supabase/functions/ics/index.ts
//
// T047 -- PRD CAL-04/CAL-05. `GET /functions/v1/ics?token=<uuid>` returns a
// `text/calendar` feed of the caller's role-scoped meetings/outreach/
// competition sessions, for subscribing in an external calendar app (Google
// Calendar, Apple Calendar, etc. via "Add by URL").
//
// Unauthenticated-by-design, token-validated architecture -- PRD 8.3's own
// literal wording: "no `anon` access except the `ics` and `checkin` Edge
// Functions (which use service role internally after validating token/JWT)".
// Read checkin/index.ts in full before this file (per the T047 worker
// packet) -- it is the established, already-Passed pattern for exactly this
// shape of function. The one thing that's genuinely different here (not just
// re-skinned): checkin validates an HMAC-signed ROTATING token against a
// secret; this function looks up a STORED, STABLE `calendar_feeds.token` uuid
// directly from the database (service-role client), checking
// `revoked_at is null` -- see token.ts + the calendar_feeds query below.
//
// Single service-role client only (no caller-JWT client at all, unlike
// checkin/send-invite): there is no `Authorization` header on a real calendar
// app's subscription GET request to authenticate a *caller* with -- the
// `token` query parameter IS the entire credential, resolved against
// `calendar_feeds` under the service role. `SUPABASE_SERVICE_ROLE_KEY` is
// read only via `Deno.env.get(...)` (constitution item 5), never hardcoded,
// never echoed in any response or log.
//
// Role-scoping (PRD 8.3/8.4, Trap #2 of the worker packet) is delegated to
// role_scope.ts + feed.ts -- this file's own job is only the I/O needed to
// resolve "which team ids are relevant for this caller" (via `students` /
// `guardian_links`) and to fetch the candidate `events` / `event_sessions` /
// `rsvps` rows; see feed.ts's header for the full scoping write-up.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { type IcsRole } from './description.ts';
import { buildFeed, type FeedEventRow, type FeedSessionRow } from './feed.ts';
import { isValidTokenFormat } from './token.ts';
import { computeWindowStart } from './window.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  // GET, not POST (unlike checkin/send-invite) -- this is a read-only feed
  // fetched by a calendar client, not an action a browser POSTs.
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
};

function jsonErrorResponse(status: number, code: string, message: string): Response {
  return new Response(JSON.stringify({ error: { code, message } }), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function icsResponse(body: string): Response {
  return new Response(body, {
    status: 200,
    headers: { ...CORS_HEADERS, 'Content-Type': 'text/calendar; charset=utf-8' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'GET') {
    return jsonErrorResponse(405, 'METHOD_NOT_ALLOWED', 'Use GET to fetch this calendar feed.');
  }

  // Supabase's own auto-injected Edge Function secrets (local and hosted).
  // Never project-defined, never committed, never hardcoded.
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    // Config/deployment problem, not a caller problem -- no detail on which
    // var is missing, to avoid leaking anything about the deployment.
    return jsonErrorResponse(500, 'CONFIG_ERROR', 'The calendar feed service is not configured correctly. Contact an administrator.');
  }

  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return jsonErrorResponse(400, 'MISSING_TOKEN', 'Add ?token=<your calendar token> to the feed URL.');
  }

  // Format check BEFORE the database query (token.ts) -- see its header for
  // why: an obviously-malformed value should never reach `.eq('token', ...)`
  // as a raw uuid-typed filter, which would otherwise surface a generic
  // Postgres "invalid input syntax" failure instead of a clean 401.
  if (!isValidTokenFormat(token)) {
    return jsonErrorResponse(
      401,
      'INVALID_TOKEN',
      'This calendar link is invalid. Get a fresh subscribe link from your VOLT calendar settings.',
    );
  }

  // Single service-role client, constructed only from
  // Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') -- never from a client-supplied
  // value, never logged, never returned in any response body. Every table
  // read below uses this client (calendar_feeds/profiles/students/
  // guardian_links/events/event_sessions/rsvps all deliberately bypass RLS
  // here -- see feed.ts/role_scope.ts for why that means THIS function's own
  // code, not RLS, is the only gate on which rows leave it).
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: feed, error: feedError } = await adminClient
    .from('calendar_feeds')
    .select('id, profile_id, revoked_at')
    .eq('token', token)
    .maybeSingle();

  if (feedError) {
    return jsonErrorResponse(500, 'FEED_LOOKUP_FAILED', 'Could not look up this calendar link. Try again in a moment.');
  }

  // Trap #3: not-found and revoked both collapse into the SAME generic 401
  // -- never a 200 with an empty-but-technically-valid feed (that would
  // ambiguously suggest "this token is fine, you just have no events" for
  // what is actually an invalid credential), and never a distinguishable
  // error message between "never existed" vs. "was revoked" (no legitimate
  // caller benefits from knowing which, and it avoids helping a token-
  // guessing attacker distinguish the two cases).
  if (!feed || feed.revoked_at !== null) {
    return jsonErrorResponse(
      401,
      'INVALID_TOKEN',
      'This calendar link is invalid or has been revoked. Get a fresh subscribe link from your VOLT calendar settings.',
    );
  }

  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('id, role')
    .eq('id', feed.profile_id)
    .maybeSingle();

  if (profileError || !profile) {
    // Should not happen given `calendar_feeds.profile_id`'s FK to `profiles`
    // (`on delete restrict`, T011 migration) -- defensively handled rather
    // than assumed, and logged with only the calendar_feeds row id (no PII,
    // constitution item 6).
    console.error('ics: profile lookup failed for a valid calendar_feeds token', { calendar_feed_id: feed.id });
    return jsonErrorResponse(500, 'PROFILE_LOOKUP_FAILED', 'Could not load this calendar. Try again in a moment.');
  }

  const role = profile.role as IcsRole;

  // Gather the "relevant team ids" input feed.ts's role_scope.ts needs --
  // see role_scope.ts's header for the full per-role write-up. admin/coach
  // never query students/guardian_links at all (resolveRoleScope ignores
  // this input for them).
  let relevantTeamIds: string[] = [];
  let ownStudentId: string | null = null;

  if (role === 'student') {
    const { data: student, error: studentError } = await adminClient
      .from('students')
      .select('id, team_id')
      .eq('profile_id', profile.id)
      .maybeSingle();

    if (studentError) {
      return jsonErrorResponse(500, 'STUDENT_LOOKUP_FAILED', 'Could not load this calendar. Try again in a moment.');
    }
    if (student) {
      relevantTeamIds = [student.team_id as string];
      ownStudentId = student.id as string;
    }
    // else: a student-role profile with no `students` row -- not an error
    // (the token itself is genuinely valid), see role_scope.ts's header for
    // why this resolves to a structurally valid, empty feed rather than a
    // failure.
  } else if (role === 'parent') {
    const { data: links, error: linksError } = await adminClient
      .from('guardian_links')
      .select('student_id')
      .eq('parent_profile_id', profile.id);

    if (linksError) {
      return jsonErrorResponse(500, 'GUARDIAN_LOOKUP_FAILED', 'Could not load this calendar. Try again in a moment.');
    }

    const linkedStudentIds = (links ?? []).map((link) => link.student_id as string);

    if (linkedStudentIds.length > 0) {
      const { data: linkedStudents, error: studentsError } = await adminClient
        .from('students')
        .select('id, team_id')
        .in('id', linkedStudentIds);

      if (studentsError) {
        return jsonErrorResponse(500, 'STUDENT_LOOKUP_FAILED', 'Could not load this calendar. Try again in a moment.');
      }

      // Union of every linked student's team -- a parent with children on
      // different teams sees both (role_scope.ts's resolveRoleScope dedupes
      // this list itself, so no dedup needed here).
      relevantTeamIds = (linkedStudents ?? []).map((student) => student.team_id as string);
    }
  }
  // admin/coach: relevantTeamIds stays [] and is simply unused downstream.

  const { data: events, error: eventsError } = await adminClient
    .from('events')
    .select('id, type, title, location_name, address, team_ids');

  if (eventsError) {
    return jsonErrorResponse(500, 'EVENTS_LOOKUP_FAILED', 'Could not load this calendar. Try again in a moment.');
  }

  const feedEvents: FeedEventRow[] = (events ?? []).map((event) => ({
    address: event.address as string,
    id: event.id as string,
    location_name: event.location_name as string,
    team_ids: event.team_ids as string[] | null,
    title: event.title as string,
    type: event.type as string,
  }));

  // 30-days-past through all future (window.ts) -- no upper bound on
  // `starts_at` at all, per CAL-04's "all future".
  const windowStart = computeWindowStart(new Date());

  let feedSessions: FeedSessionRow[] = [];
  if (feedEvents.length > 0) {
    const { data: sessions, error: sessionsError } = await adminClient
      .from('event_sessions')
      .select('id, event_id, starts_at, ends_at, status')
      .in(
        'event_id',
        feedEvents.map((event) => event.id),
      )
      .gte('starts_at', windowStart.toISOString())
      .order('starts_at', { ascending: true });

    if (sessionsError) {
      return jsonErrorResponse(500, 'SESSIONS_LOOKUP_FAILED', 'Could not load this calendar. Try again in a moment.');
    }

    feedSessions = (sessions ?? []).map((session) => ({
      ends_at: session.ends_at as string,
      event_id: session.event_id as string,
      id: session.id as string,
      starts_at: session.starts_at as string,
      status: session.status as 'canceled' | 'completed' | 'scheduled',
    }));
  }

  // rsvps only ever matter for the student DESCRIPTION case (description.ts)
  // -- skip the query entirely for every other role rather than fetching and
  // discarding it.
  const rsvpBySessionId = new Map<string, string>();
  if (role === 'student' && ownStudentId && feedSessions.length > 0) {
    const { data: rsvps, error: rsvpsError } = await adminClient
      .from('rsvps')
      .select('session_id, status')
      .eq('student_id', ownStudentId)
      .in(
        'session_id',
        feedSessions.map((session) => session.id),
      );

    if (rsvpsError) {
      return jsonErrorResponse(500, 'RSVP_LOOKUP_FAILED', 'Could not load this calendar. Try again in a moment.');
    }

    for (const rsvp of rsvps ?? []) {
      rsvpBySessionId.set(rsvp.session_id as string, rsvp.status as string);
    }
  }

  const icsBody = buildFeed({
    events: feedEvents,
    relevantTeamIds,
    role,
    rsvpBySessionId,
    sessions: feedSessions,
  });

  return icsResponse(icsBody);
});
