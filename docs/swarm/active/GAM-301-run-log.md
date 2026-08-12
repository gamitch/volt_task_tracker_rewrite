# GAM-301 run log

Issue: [GAM-301](https://linear.app/gamitch/issue/GAM-301/t407-the-outreach-nav-badge-is-a-hardcoded-0-while-the-page-it-links) (legacy `T407`)
Branch: `claude/gam-301-outreach-nav-badge`
Base: `3190342`

Append-only. One line per milestone, committed and pushed as it happens.

- claimed via `issueUpdate` (`Todo → In Progress`), read-back via a fresh
  `issues` query confirmed `state.name === "In Progress"` before any repo file
  was opened. Labels on the issue: `w1`, `standard`.
- issue body fetched live in the same claim call (title + description read
  back after the state mutation, not before). Full text held in this run's
  context; not re-pasted into this log since the issue itself is the durable
  copy.
- **tier: STANDARD, affirming the pre-set `tier/standard` label rather than
  re-judging from `tier/unreviewed` (item 28d does not apply here).** Reasoning
  per item 26: no write path or destructive operation, no schema/RLS/migration,
  no auth/role logic — this is wiring an existing read-only counter
  (`getUnansweredRsvpCount` in `OutreachList.tsx`) into the nav badge. The
  packet will likely touch more than one file (`SideNav.tsx` plus whatever
  supplies it data), which is above STANDARD's usual "single module"
  description, but item 26's HEAVY triggers are an enumerated list and none of
  them are present, so this stays STANDARD rather than escalating on file
  count alone ("it sounds important is not a trigger, and neither is the
  number of files touched").
- premise measured against `3190342`: `SideNav.tsx:117`'s
  `PLACEHOLDER_OUTREACH_BADGE_COUNT = 0` confirmed live; `getUnansweredRsvpCount`
  (`OutreachList.tsx:1459`) confirmed real, exported, tested, and already wired
  to real Supabase data via `loadOutreachData` (`loaders/outreach.ts:1122`,
  the actual production default, not the fixture seam). `resolveCurrentStudentId`
  (`loaders/meetings.ts:1120`) confirmed as the shared real viewer→student
  resolver already reused by three other files. No existing `SideNav.test.tsx`.
  No existing "unanswered"/"awaiting" Supabase view (grepped `supabase/`) —
  confirms a lighter read path does not already exist.
- **packet written**: `docs/swarm/active/GAM-301-packet.md`. Seam decision:
  `SideNav` owns its own badge fetch (mirrors `KpiStrip`'s precedent for
  chrome-level data), via two optional defaulted props so `AppShell.tsx`
  needs no changes. Two allowed files, 9 acceptance criteria including a
  named mutation, 5-entry least-confident-decisions list.
