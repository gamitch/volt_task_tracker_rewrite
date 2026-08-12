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
- **premise gate round 1 dispatched** (`checker-premise`). Dispatched with
  `run_in_background: false` — the orchestrator blocks on the verdict rather
  than ending its turn with the subagent in flight. If this line is the last
  one in this file, the run died holding this subagent.
- **premise gate round 1 verdict: REVISE.** 1 BLOCKER, 5 MAJOR, 3 MINOR.
  BLOCKER: value-importing `getUnansweredRsvpCount`/`filterOutreachEvents`
  from the lazy-loaded `OutreachList.tsx` into always-eager `SideNav.tsx`
  measured +71.5 kB gz on the entry chunk and collapsed 25 lazy chunks
  (T093's code-splitting reversed). MAJOR findings: self-referential
  acceptance criteria (mutation would go undetected), `getUnansweredRsvpCount`
  lacks BEH-04's future/team-scope filters that the *other* existing
  implementation (`StudentHome.tsx`'s `getUnansweredOutreachOpportunities`)
  already has, an undefined/fabricated coach-admin badge magnitude, a second
  file (`MobileNav.tsx`) carrying the identical placeholder left unaddressed,
  and the T140 injectable-loader testability seam broken for two currently-green
  `AppShell.test.tsx` cases. Full verdict recorded by the subagent; baseline
  measured by the gate on `3190342`: 89 files / 2363 tests green, build exit
  0, eager entry chunk 199.02 kB gz.
- **packet rewritten (round 2), not patched — full redesign.** Reuses
  `StudentHome.tsx`'s `getUnansweredOutreachOpportunities` (correct BEH-04
  semantics) instead of `OutreachList.tsx`'s function, relocates it plus 4
  related names into a new pure leaf module
  (`src/lib/outreach/unansweredOutreach.ts`) so neither `OutreachList.tsx`
  nor `StudentHome.tsx`'s page-level code is statically imported into eager
  chrome. Fetch moves to `AppShell.tsx` (one hook, one call site, threaded as
  a plain prop to both `SideNav` and `MobileNav`, since Astryx mounts both
  simultaneously and picks by CSS breakpoint — a shared fetch, not two).
  Coach/admin viewers now get no badge at all (BEH-04 defines none). 10
  Allowed Files (up from 2), 12 acceptance criteria with literal
  hand-computed integers, tier re-affirmed STANDARD with reasoning for the
  size increase.
- **premise gate round 2 dispatched** (`checker-premise`). Dispatched with
  `run_in_background: false` — the orchestrator blocks on the verdict rather
  than ending its turn with the subagent in flight. If this line is the last
  one in this file, the run died holding this subagent.
- **premise gate round 2 verdict: REVISE.** 2 BLOCKER, 3 MAJOR, 5 MINOR, 2 NIT
  — and the checker built the prescription and ran it rather than reading it
  (item 26's "a gate that only reads is worth much less than one that runs").
  BLOCKER 1: `useOutreachBadgeCount()` called from `AppShell`'s own body
  cannot work — `AppShell` is the component that *renders* `<SeasonProvider>`,
  so `useActiveSeason()` there throws outside a provider. Measured:
  `AppShell.test.tsx` **25/25 failed**, `useActiveSeason() must be called
  within a <SeasonProvider>`. This would crash the entire shell in production
  on every route. BLOCKER 2: the packet's claim that none of the new imports
  reach a lazy page component is false for `loaders/meetings.ts` — it
  value-imports from `MeetingsList.tsx`/`ScheduleMeetingsDialog.tsx` (its own
  header discloses the cycle). Measured: entry chunk 199.02 → **249.49 kB
  gz (+50.47 kB), 18 lazy chunks collapsed** — round 1's BLOCKER at ~70%
  magnitude, not fixed. Also: the "both navs mount simultaneously, so one
  shared fetch is required" premise is **false** — Astryx's real
  `AppShell.tsx` source shows the two are mutually exclusive, JS-media-query
  driven mounts, never both mounted at once. The checker verified a cheaper,
  working alternative in the same worktree: calling the hook from `SideNav`
  directly (same render position `KpiStrip` already occupies, inside
  `SeasonProvider`) — `AppShell.test.tsx` + `TopNav.test.tsx` **34/34 green**,
  zero `AppShell.tsx` edits needed. Full verdict text held in this run's
  transcript.
- **Per constitution item 19a, two rounds is the cap — this is round 2's
  REVISE, so it escalates to the human owner rather than looping to round 3.**
  I am not applying round 2's fixes myself and re-submitting a third time;
  that would make me my own gate on a design an independent check already
  caught real production-breaking defects in twice. Stopping here.
- **Escalation posted to the Linear issue** (comment below), issue left
  `In Progress` deliberately — per `scripts/linear-assert-released.mjs`'s own
  documented rule, an item-19a escalation is one of three named benign
  shapes that still legitimately fails that CI check (`released: false`),
  because "the chain is unfinished and nothing else will say so." The red
  check is the intended signal here, not a defect in this run.
- **No PR opened.** No source file was changed — only planning artifacts
  under `docs/swarm/active/`, already pushed to
  `claude/gam-301-outreach-nav-badge`. Nothing to merge yet.
- **Run complete (escalated, not delivered).** Delivered: confirmed-live
  defect measurement, a fully-designed and twice-independently-checked
  packet with a concrete, verified-working path forward (round 2's cheaper
  path A: call the badge hook from `SideNav`/`MobileNav` directly, not from
  `AppShell`; solve `loaders/meetings.ts`'s bundle cost by relocating its two
  page-value-imports the same way this packet already relocates the outreach
  predicate). Not delivered: working code — item 19a's cap stops this run
  one packet-revision short of a dispatchable plan. Next session: apply
  round 2's 10 required revisions (see packet + verdict), most of which are
  now narrow and mechanical, and this does not need a third premise-gate
  round if the human owner (or `boss-architect`) accepts the verified fixes
  directly.
- Escalation comment posted to GAM-301 (comment id `58713e76-dd96-4400-8b51-1523cce313c0`),
  linking both packet and this log on `claude/gam-301-outreach-nav-badge`. No
  `gate/human` label exists on this Linear team (checked live) — comment only,
  not fabricating a label. Issue state re-confirmed `In Progress`. Run ends here.
