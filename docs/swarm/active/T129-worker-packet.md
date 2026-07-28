# Worker Packet: T129

## Task ID
T129 — Wave 5 / W5-P1: app-wide mechanical sweep (UXC-01, UXC-10, UXC-11).

## Objective
Three independent, mechanical fixes from `docs/swarm/VOLT_UX_Craft_PRD_v3.md`
(v3.1). No layout redesign in this packet — that is T130's job. Read the PRD's
§2 entries for UXC-01, UXC-10, UXC-11 before starting.

### Item 1 — UXC-01: exactly one heading per section (MAJOR if violated)
An Astryx `List` renders its `header` prop as **visible markup**
(`node_modules/@astryxdesign/core/src/List/List.tsx:190-198`), so a section
`Heading` followed by a `List header` prints the title twice. Confirmed sites:

- `src/pages/home/CoachHome.tsx` — 2327+2328 ("Next up"), 2342+2357
  ("Activity feed"), 2385+2386 ("Hours by team"), 2446+2447 ("Top events by
  student hours")
- `src/pages/home/StudentHome.tsx` — 1290+1291 ("Next up"), 1309+1310
  ("Sign-up opportunities")
- `src/pages/meetings/LiveConsole.tsx` — 1087+1112 ("Roster")
- `src/pages/meetings/MeetingsList.tsx` — 1474+1485 and 1825+1836
  (`{title}` vs `` `${title} meetings` ``, coach + student views, 2 sections each)
- `src/pages/outreach/OutreachList.tsx` — 2078+2079 and 2651+2652
  (`{title}` vs `` `${title} outreach events` ``, coach + student views)

**CRITICAL — the obvious fix is wrong.** Do NOT drop the `header` and pass
`aria-label` instead: `List` destructures a closed prop set and never spreads
rest props (`dist/List/List.js:81-92`), so `aria-label` type-checks and is
**silently discarded at runtime**, leaving the list with no accessible name at
all. That would be an a11y regression (constitution item 15).

Use, per site, whichever fits: **(a)** keep the `List header` as the section's
single visible title and delete the outer `Heading`; or **(b)** wrap the list in
a labelled `Section`/region and drop the `header`. Prefer (a). Do NOT migrate
anything to `Table` here — T130 owns that.

Note: `CalendarPage.tsx:829`, `ParentHome.tsx:1202/1203`, `Leaderboard.tsx:519`
and `EndMeetingDialog.tsx:880` are **not** duplicates (deliberately different
wording, or no adjacent heading). Leave them alone.

### Item 2 — UXC-10: no internal jargon in user-facing copy (BLOCKER if violated)
Ten rendered strings leak task IDs, requirement IDs, and swarm vocabulary to
coaches and students. Rewrite each in plain language a team member would
understand. Keep the *information* where it is still true; drop it where it is
merely internal.

- `src/pages/settings/SettingsPage.tsx:1139` — "…a separate, not-yet-wired step
  -- module doc #2."
- `src/pages/meetings/LiveConsole.tsx:776-777` — "QR/code below use fixture
  data" + "(constitution item 5)" + "placeholders"
- `src/pages/meetings/LiveConsole.tsx:1020-1021` — "Live sync not wired" +
  "attendance's RLS…" + "(no createClient/supabase-js usage exists anywhere in
  src/ yet)". **This justification is factually stale** — T071 shipped
  `src/lib/supabase/client.ts`. The banner's *conclusion* is still true (this
  screen genuinely runs on fixture seams), so keep an honest warning and fix the
  false reason.
- `src/pages/meetings/LiveConsole.tsx:990` — "(T036)"
- `src/pages/meetings/MeetingsList.tsx:1568` — "(T031, MTG-02)"
- `src/pages/meetings/MeetingsList.tsx:1932-1935` — "(BEH-06)… ships with T037"
- `src/pages/roster/AdminToggles.tsx:391` — "(SEC-04)"
- `src/pages/roster/AdminToggles.tsx:403-405` — "Opens season settings (T029)."
- `src/pages/outreach/OutreachEventDialog.tsx:1301` — "(CMP-02)", "MET-01/02"
- `src/pages/outreach/OutreachEventDialog.tsx:1307` — "MET-03/04"

**`src/pages/meetings/MeetingsList.test.tsx:889` asserts the string `'T037'`
renders.** Update that assertion in the same change.

### Item 3 — UXC-11: friendly dates (MINOR if violated)
No raw `YYYY-MM-DD` visible to users. Known sites: `OutreachEventDialog`'s
"Picked dates" list and its "Remove 2026-07-26" control labels; `CoachHome`'s
top-events rows ("2026-06-01 → 2026-06-03"). Use the app's existing friendly
date formatter — find it, do not write a new one. Sweep for other occurrences.

## Allowed Files
- `src/pages/home/CoachHome.tsx` (+ `.test.tsx`)
- `src/pages/home/StudentHome.tsx` (+ `.test.tsx`)
- `src/pages/meetings/LiveConsole.tsx` (+ `.test.tsx`)
- `src/pages/meetings/MeetingsList.tsx` (+ `.test.tsx`)
- `src/pages/outreach/OutreachList.tsx` (+ `.test.tsx`)
- `src/pages/settings/SettingsPage.tsx` (+ `.test.tsx`)
- `src/pages/roster/AdminToggles.tsx` (+ `.test.tsx`)
- `src/pages/outreach/OutreachEventDialog.tsx` (+ `.test.tsx`)

## Forbidden Files
- Everything else. Specifically: no `Table` migration, no row restructuring, no
  new components, no `supabase/**`, no `docs/swarm/**`, no `.claude/**`.
- Do not touch `CalendarPage.tsx`, `ParentHome.tsx`, `Leaderboard.tsx`,
  `EndMeetingDialog.tsx` for Item 1 (their headings are correctly distinct).

## Traps
1. **The aria-label trap in Item 1 is the whole point of that item** — a worker
   who "fixes" the duplication by deleting headers and adding `aria-label` has
   shipped an a11y regression that looks correct in a screenshot. Verify the
   computed accessible name, not the markup.
2. Item 2 changes user-facing copy → constitution item 17 applies (neutral,
   factual; users are minors). Do not replace jargon with cheerful filler.
3. Do not silently delete a warning banner because its wording is bad. Two of
   the LiveConsole banners describe real, current limitations.
4. Astryx props verified against installed source or `docs/swarm/astryx-api.md`
   (cite which). Note the api doc has been wrong twice — installed source wins.
5. Sibling T130 is working in `OutreachList.tsx` concurrently. **You own the
   headings and copy in that file; T130 owns row structure.** Keep your diff
   surgical and attribute any unrelated noise honestly.

## Required Output
Full diff; per-item evidence (Item 1: the accessible name each list still has,
and how you verified it; Item 2: all ten sites with before/after copy plus the
test update; Item 3: the formatter you reused and every site changed); gate
output (tsc, eslint 0 errors, full vitest, build, prettier on your files);
risks; disclosed judgment calls.
