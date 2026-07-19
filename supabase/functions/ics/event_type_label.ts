// supabase/functions/ics/event_type_label.ts
//
// SUMMARY = "[Meeting|Outreach|Comp] <title>" -- CAL-04's own literal example
// text (PRD line 312): "SUMMARY=[Meeting|Outreach|Comp] <title>". Note the
// literal "Comp", not "Competition", for `events.type = 'competition'` -- not
// a paraphrase or a guessed shorter form, this is exactly what the PRD spec
// text uses.
//
// `events.type` is a `check (type in ('meeting', 'outreach', 'competition'))`
// column (T010 migration), so a real database row can only ever be one of
// these three values.

const TYPE_LABELS: Record<string, string> = {
  meeting: 'Meeting',
  outreach: 'Outreach',
  competition: 'Comp',
};

export function mapEventTypeToSummaryPrefix(type: string): string {
  const label = TYPE_LABELS[type];
  if (label) return label;
  // Defensive fallback only -- unreachable for any row that actually passed
  // the `events.type` check constraint. Not thrown as a hard error, because
  // a single malformed row should not take down the entire feed for every
  // other session; capitalize the raw value instead so it is still visibly
  // wrong rather than silently mislabeled as one of the three real types.
  return type.length > 0 ? type[0].toUpperCase() + type.slice(1) : type;
}
