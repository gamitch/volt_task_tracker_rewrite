// supabase/functions/ics/location.ts
//
// LOCATION from `events.location_name` (+ `address`). The worker packet
// explicitly leaves the exact concatenation shape as the worker's call, to
// be disclosed. Decision made here: `"<location_name>, <address>"` when
// `address` is present and not just a repeat of `location_name`; otherwise
// `location_name` alone. Both columns are `not null` (T010 migration) but
// `address` may legitimately be an empty string for an event that only has a
// venue name (e.g. "VOLT Shop") with no separately-tracked street address --
// an empty/whitespace-only address is treated as "no address to add", not as
// a literal empty second line.

export function buildLocation(locationName: string, address: string): string {
  const trimmedName = locationName.trim();
  const trimmedAddress = address.trim();

  if (!trimmedAddress || trimmedAddress === trimmedName) {
    return trimmedName;
  }

  return `${trimmedName}, ${trimmedAddress}`;
}
