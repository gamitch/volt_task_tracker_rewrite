// supabase/functions/ics/ics_structural_check.ts
//
// TEST-ONLY structural validator/parser. Never imported by index.ts or
// ics_builder.ts -- it is not part of the response path and never runs in
// production, only from `*.test.ts` files (see ics_builder.test.ts).
//
// Trap #5 of the T047 worker packet: "feed validates in Google Calendar"
// cannot be literally tested in this sandboxed environment (no network
// egress -- same documented class of gap as T017/T032/T048's Resend/
// Docker/deno.land blocks). The packet's own accepted practical substitute is
// "parsing your own generated output back with a real ICS parser (or
// ical-generator's own round-trip/serialization guarantees) and asserting
// well-formed BEGIN/END pairs, correct line-folding ..., and no malformed
// lines". `ical-generator` itself ships no parser (it is generation-only --
// confirmed by reading its published source: no `parse`/`unfold` export
// exists in its `index.ts`), and adding a third-party ICS-parsing dependency
// (e.g. `node-ical`/`ical.js`) is not on the constitution item 9 allowlist,
// so this file is a small hand-written structural verifier -- NOT a
// generator. It never constructs or emits ICS content; it only reads back
// content that `ical-generator` already produced (via `ics_builder.ts`) and
// checks it against RFC 5545's own structural rules (line folding, BEGIN/END
// balance, key:value shape). This is the same category of thing as a test
// assertion checking a substring of a string under test -- it references ICS
// keyword literals (`BEGIN:VCALENDAR`, `UID`, etc.) only as comparison
// targets for parsing/verification, never as content that gets sent to a
// caller. index.ts's actual response body is always exactly
// `ics_builder.ts`'s `calendar.toString()`, untouched by this file.

const CRLF = '\r\n';

export interface ParsedIcsEvent {
  description: string | null;
  location: string | null;
  status: string | null;
  summary: string | null;
  uid: string | null;
}

export interface IcsStructuralCheckResult {
  errors: string[];
  events: ParsedIcsEvent[];
  refreshInterval: string | null;
  valid: boolean;
  wrCalName: string | null;
}

function unescapeIcsText(value: string): string {
  return value.replace(/\\n/gi, '\n').replace(/\\,/g, ',').replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

export function checkIcsStructure(raw: string): IcsStructuralCheckResult {
  const errors: string[] = [];
  const encoder = new TextEncoder();

  // ical-generator's own `.toString()` does NOT append a trailing CRLF after
  // the final `END:VCALENDAR` line (confirmed directly against the real
  // library output, not assumed) -- RFC 5545 does not require one either, so
  // this is not treated as a structural error. Splitting on CRLF therefore
  // yields exactly the real physical lines with no synthetic trailing empty
  // element to strip.
  const physicalLines = raw.split(CRLF);

  // RFC 5545 section 3.1: "Lines of text SHOULD NOT be longer than 75
  // octets, excluding the line break." ical-generator handles this
  // internally (this file never folds/unfolds on the write side, only
  // verifies it on the read side here).
  for (const line of physicalLines) {
    const byteLength = encoder.encode(line).length;
    if (byteLength > 75) {
      errors.push(`physical line exceeds 75 octets (${byteLength})`);
    }
  }

  // Un-fold: a continuation physical line starts with a single space or tab.
  const logicalLines: string[] = [];
  for (const line of physicalLines) {
    if (logicalLines.length > 0 && (line.startsWith(' ') || line.startsWith('\t'))) {
      logicalLines[logicalLines.length - 1] += line.slice(1);
    } else {
      logicalLines.push(line);
    }
  }

  let wrCalName: string | null = null;
  let refreshInterval: string | null = null;
  let calendarDepth = 0;
  let inEvent = false;
  let current: ParsedIcsEvent = { description: null, location: null, status: null, summary: null, uid: null };
  const events: ParsedIcsEvent[] = [];

  for (const line of logicalLines) {
    if (line === 'BEGIN:VCALENDAR') {
      calendarDepth += 1;
      continue;
    }
    if (line === 'END:VCALENDAR') {
      calendarDepth -= 1;
      continue;
    }
    if (line === 'BEGIN:VEVENT') {
      if (inEvent) errors.push('nested BEGIN:VEVENT without a matching END:VEVENT');
      inEvent = true;
      current = { description: null, location: null, status: null, summary: null, uid: null };
      continue;
    }
    if (line === 'END:VEVENT') {
      if (!inEvent) errors.push('END:VEVENT without a matching BEGIN:VEVENT');
      inEvent = false;
      if (!current.uid || !current.summary) {
        errors.push('a VEVENT is missing a required UID or SUMMARY property');
      }
      events.push(current);
      continue;
    }

    const separatorIndex = line.indexOf(':');
    if (separatorIndex === -1) {
      errors.push(`malformed line with no ':' separator: ${line.slice(0, 30)}`);
      continue;
    }
    const rawKey = line.slice(0, separatorIndex);
    const value = line.slice(separatorIndex + 1);
    const key = rawKey.split(';')[0];

    if (!inEvent) {
      if (key === 'X-WR-CALNAME') wrCalName = value;
      if (key === 'REFRESH-INTERVAL') refreshInterval = rawKey.includes('VALUE=DURATION') ? value : refreshInterval;
    } else {
      if (key === 'UID') current.uid = value;
      if (key === 'SUMMARY') current.summary = unescapeIcsText(value);
      if (key === 'STATUS') current.status = value;
      if (key === 'LOCATION') current.location = unescapeIcsText(value);
      if (key === 'DESCRIPTION') current.description = unescapeIcsText(value);
    }
  }

  if (calendarDepth !== 0) errors.push('unbalanced BEGIN:VCALENDAR/END:VCALENDAR');
  if (inEvent) errors.push('unterminated VEVENT (missing END:VEVENT)');

  return { errors, events, refreshInterval, valid: errors.length === 0, wrCalName };
}
