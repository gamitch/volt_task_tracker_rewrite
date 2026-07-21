// supabase/functions/ics/token.ts
//
// Pure token-format validation for the `?token=<uuid>` query parameter,
// extracted from index.ts so it is exercisable with `deno test` without a
// running Supabase project (same convention as checkin/validation.ts and
// send-invite/validation.ts).
//
// This is a FORMAT check only ("does this look like a uuid"). It is
// deliberately checked before the `calendar_feeds` table lookup (Trap #3 of
// the T047 worker packet) so a malformed value never reaches the database as
// a raw `.eq('token', token)` filter (which would otherwise surface a
// Postgres "invalid input syntax for type uuid" error rather than a clean
// 401). It says nothing about whether the token actually exists or has been
// revoked -- that is `calendar_feeds.revoked_at is null` + row-existence,
// checked separately in index.ts against the real table.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidTokenFormat(token: string): boolean {
  return UUID_RE.test(token);
}
