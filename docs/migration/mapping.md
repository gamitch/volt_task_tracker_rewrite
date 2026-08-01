# MIG-02: Column Mapping (verbatim copy of PRD Section 10.2)

This document is a verbatim copy of PRD Section 10.2 ("Column mapping (normative — deviations
require boss-arbiter)"), transcribed from `docs/swarm/VOLT_Portal_PRD.md` lines 693–710 on
2026-07-18, with no edits, additions, or omissions.

### 10.2 Column mapping (normative — deviations require boss-arbiter)

| Old | New | Rule |
|---|---|---|
| `teams.*` | `teams.*` | 1:1 including short_name, archived, sort_order; `program` left null for George to set later |
| `students.name` | `students.display_name` | direct |
| `students.team_affiliation` | `students.team_id` | join on `teams.name`; unmatched values create an archived team and appear in the migration report |
| `students.goal_hours` | `students.goal_hours_override` | direct |
| `students.active` | `students.is_active` | direct |
| `app_settings.season_goal` | `seasons.default_goal_hours` | create season "2025–2026" spanning min→max session dates, `is_active=false`; George creates the new active season at cutover (SET-04) |
| `events.name / location / notes / category / adult_volunteers_count / adult_volunteer_hours` | `events.title / location_name / description / type / adult_volunteers_count / adult_volunteer_hours` | direct (category vocabulary is identical); `team_ids = null` (all-team scope); counts flags per type defaults (CMP-02); `season_id` assigned by date; `created_by = null` |
| `events.date / start_time / end_time / is_multi_day / attendees / status / duration_hours` | — | dropped: sessions are authoritative. ETL asserts migration 2's backfill covered every event and every `attendees[]` uuid before dropping |
| `event_sessions.date + start_time/end_time` (text) | `event_sessions.starts_at / ends_at` (timestamptz) | parse in America/Chicago; unparseable strings fall back to 00:00 and are flagged in the migration report |
| parent `events.status` | `event_sessions.status` | 'completed' when old event status='completed' AND session date ≤ cutover date, else 'scheduled' |
| `session_attendance` where `planned=true` | `rsvps` | status `going`, `responded_by = null` |
| `session_attendance` where `planned=false` | `attendance` | status `present`, `method='import'`, `check_in_at/check_out_at = null`, **`hours_override = old hours`, always set** — guarantees hour totals match the old views exactly |

Mapping notes: (a) migrated meetings carry all-team scope, so pre-cutover participation % is approximate — Reports label imported seasons "imported"; (b) no historical late/excused/absent data exists; imported attendance is present-only; (c) `notes` on old events lands in `events.description`.

---

## Domain note — "FLL Team Meetings" events are outreach, NOT meetings (owner, 2026-08-01)

**Do not recategorize them. This has already been proposed once, on a wrong assumption.**

Two of the owner's largest events — `GG FLL Team Meetings` and `P3 FLL Team Meetings`, **72 of 117
sessions between them (62%)** — carry `category = 'outreach'` in the old system. Because the old
schema has no `meeting` category at all (only `outreach` and `competition`), this looks like a
workaround where meetings were filed under outreach for want of anywhere better. **It is not.**

**The owner's correction, verbatim:** *"Our FTC/FRC team members are student coaches for FLL teams.
so for them, these FLL meetings are outreach."*

The team's own students **run** those FLL sessions for younger participants. Attending one is
volunteer service performed for someone else — exactly what outreach means here — not the team's
own internal meeting. The old categorization is **correct**, and `category → type` maps **1:1** with
no special case.

**Why this matters enough to write down.** The new schema treats the two domains differently:
meetings produce a participation percentage, outreach produces volunteer hours toward the season
goal. Recategorizing these 72 sessions as `meeting` would **remove the majority of the team's
volunteer hours** from every student's goal progress. The proposal to do so was made from the event
*titles* alone, without knowing who runs the sessions.

**A `meeting`-type event is a genuine gap in the old data, not a mapping error.** The old system
could not represent the team's own internal meetings, so none were tracked. The new app's meetings
feature starts empty and fills going forward. That is expected — do not synthesize meeting rows to
fill it.
