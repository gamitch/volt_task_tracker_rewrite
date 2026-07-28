# Worker Packet: T129 (rev. 2 — after premise check)

## Task ID
T129 — Wave 5 / W5-P1: app-wide mechanical sweep (UXC-01, UXC-10, UXC-11).

> **rev. 2** corrects six wrong line citations, adds two missed sites, resolves
> an impossible instruction (no shared date formatter exists), and hands the
> coach OutreachList heading to T130 so the two packets no longer collide.

## Objective
Three independent, mechanical fixes from `docs/swarm/VOLT_UX_Craft_PRD_v3.md`
(v3.1) §2. No layout redesign — that is T130's job.

### Item 1 — UXC-01: exactly one heading per section (MAJOR if violated)
An Astryx `List` renders `header` as **visible markup**
(`node_modules/@astryxdesign/core/src/List/List.tsx:194-201`), so a section
`Heading` plus a `List header` prints the title twice. Verified sites — these
line numbers were re-checked, use them:

| File | `Heading` | `List header` |
|---|---|---|
| `src/pages/home/CoachHome.tsx` | **2320** | 2328 ("Next up") |
| `src/pages/home/CoachHome.tsx` | 2342 | 2357 ("Activity feed") |
| `src/pages/home/CoachHome.tsx` | **2378** | 2386 ("Hours by team") |
| `src/pages/home/CoachHome.tsx` | **2402** | **2427** ("Goal projection…") |
| `src/pages/home/CoachHome.tsx` | **2439** | 2447 ("Top events…") |
| `src/pages/home/StudentHome.tsx` | **1283** | 1291 ("Next up") |
| `src/pages/home/StudentHome.tsx` | **1302** | 1310 ("Sign-up opportunities") |
| `src/pages/meetings/LiveConsole.tsx` | 1087 | 1112 ("Roster") |
| `src/pages/meetings/MeetingsList.tsx` | 1474 | 1485 (coach, ×2 sections) |
| `src/pages/meetings/MeetingsList.tsx` | 1825 | 1836 (student, ×2 sections) |
| `src/pages/outreach/OutreachList.tsx` | **2644** | **2652** (STUDENT view only) |

**The coach OutreachList section (`Heading` 2071 / `List header` 2079) is NOT
yours** — T130 is replacing that whole `List` with a `Table` and will
re-establish its heading. Do not touch `CoachOutreachSection`.

**CRITICAL — the obvious fix is wrong.** Do NOT drop `header` and pass
`aria-label`: `List` destructures a closed prop set and never spreads rest props
(`dist/List/List.js:81-93`), so `aria-label` type-checks and is **silently
discarded at runtime**. `List.tsx:169` sets `aria-labelledby` *only when
`header != null`* — a headerless `List` ends up with **no accessible name at
all** (constitution item 15 regression).

Per site use **(a)** keep the `List header` as the single visible title and
delete the outer `Heading`, or **(b)** wrap in a labelled `Section`/region and
drop the `header`. Prefer (a). Verify the **computed accessible name**, not the
markup.

Not duplicates — leave alone: `CalendarPage.tsx:829`, `Leaderboard.tsx:519`,
`EndMeetingDialog.tsx:880`, `ParentHome.tsx:1194/1203` (wording genuinely
differs).

### Item 2 — UXC-10: no internal jargon in user-facing copy (BLOCKER if violated)
**Eleven** rendered strings (not ten — the count in the PRD is being corrected).
Rewrite each in plain language a coach or student would understand.

- `src/pages/settings/SettingsPage.tsx:1138-1140` — "…not-yet-wired step -- module doc #2."
- `src/pages/meetings/LiveConsole.tsx:776-777` — "fixture data", "(constitution item 5)", "placeholders"
- `src/pages/meetings/LiveConsole.tsx:990` — "(T036)"
- `src/pages/meetings/LiveConsole.tsx:1020-1021` — "Live sync not wired" + "(no createClient/supabase-js usage exists anywhere in src/ yet)"
- `src/pages/meetings/LiveConsole.tsx:111` — the **module doc** carries the same stale createClient claim; correct it too
- `src/pages/meetings/MeetingsList.tsx:1568` — "(T031, MTG-02)"
- `src/pages/meetings/MeetingsList.tsx:1932-1935` — "(BEH-06)… ships with T037"
- `src/pages/roster/AdminToggles.tsx:391` — "(SEC-04)"
- `src/pages/roster/AdminToggles.tsx:403-405` — "Opens season settings (T029)."
- `src/pages/outreach/OutreachEventDialog.tsx:1301` — "(CMP-02)", "MET-01/02"
- `src/pages/outreach/OutreachEventDialog.tsx:1307` — "MET-03/04"
- **`src/pages/home/CoachHome.tsx:2133`** — via `showStub(...)`: "This action opens
  the new-outreach-event dialog (T039, OUT-01/OUT-02). That dialog hasn't shipped
  yet, so no event was created."

**Two of these are factually stale, not just jargon-laden:**
1. `LiveConsole:1020-1021` + `:111` — T071 shipped `src/lib/supabase/client.ts`
   (real `createClient` at line 79). The *reason* is false; the *conclusion*
   (this screen runs on fixture seams) is still true. Keep an honest warning,
   fix the false reason. Do not delete the banner.
2. `CoachHome:2133` — `OutreachEventDialog` **has** shipped and is wired into
   `OutreachList` (T101). A plain-language rewrite that keeps "hasn't shipped
   yet" would still be false. Rewrite it to describe what the button actually
   does now; if you find it genuinely still stubbed on CoachHome, say so and
   flag a follow-up rather than inventing behavior.

**`src/pages/meetings/MeetingsList.test.tsx:889` asserts `'T037'` renders**
(`expect(container.textContent).toContain('T037')`). Updating that assertion is
**pre-authorized** — do it in the same change.

**Explicitly out of scope** (do not "fix", do not dispute):
`src/pages/checkin/CheckinResult.tsx:453-455` (gated by `isDevBuild()`, never
user-visible in production) and `src/pages/home/StudentHomeSlot.tsx:52` (dead
code — `StudentHome.tsx:47-49` documents it is never mounted).
`HoursTab.tsx:202`, `csvExport.ts:12`, `ParticipationTab.tsx:104` carry the same
stale createClient claim in module docs but are outside Allowed Files — note
them for follow-up, do not edit.

### Item 3 — UXC-11: friendly dates (MINOR if violated)
**There is no shared date formatter in this repo** — `src/lib/` contains only
`supabase/`, and ~15 near-duplicates live in page modules. You are therefore
**authorized to create `src/lib/format/dates.ts`** (added to Allowed Files).
Seed it from `CoachHome.tsx:1191` `formatSessionDateLabel`, which already
handles the `date`-typed UTC-midnight timezone trap correctly — copy that
handling, do not re-derive it.

Fix these sites (all inside Allowed Files):
- `src/pages/outreach/OutreachEventDialog.tsx:1388` (`label={date}`), `:1391`
  (`` label={`Remove ${date}`} ``), `:1422` (`<Text>{date}</Text>`), `:1425`
  (`Start time (${date})`), `:1431` (`End time (${date})`), `:1437`
  (`Expected people reached (${date})`)
- `src/pages/home/CoachHome.tsx:1876` (top-events "2026-06-01 → 2026-06-03")

**Do not** attempt a repo-wide sweep. Real ISO leaks exist at
`ScheduleMeetingsDialog.tsx:765,768` and `SeasonSettings.tsx:672` — both outside
Allowed Files. List them in your report as a follow-up. Acceptance is "the
enumerated sites", not "no ISO date anywhere".

## Allowed Files
- `src/pages/home/CoachHome.tsx` (+ `.test.tsx`)
- `src/pages/home/StudentHome.tsx` (+ `.test.tsx`)
- `src/pages/meetings/LiveConsole.tsx` (+ `.test.tsx`)
- `src/pages/meetings/MeetingsList.tsx` (+ `.test.tsx`)
- `src/pages/outreach/OutreachList.tsx` (+ `.test.tsx`) — **student section only**
- `src/pages/settings/SettingsPage.tsx` (+ `.test.tsx`)
- `src/pages/roster/AdminToggles.tsx` (+ `.test.tsx`)
- `src/pages/outreach/OutreachEventDialog.tsx` (+ `.test.tsx`)
- `src/lib/format/dates.ts` (+ test) — **new, authorized**

## Forbidden Files
- `CoachOutreachSection` and every coach row/`List` in `OutreachList.tsx` (T130).
- `ScheduleMeetingsDialog.tsx`, `SeasonSettings.tsx`, `CheckinResult.tsx`,
  `StudentHomeSlot.tsx`, `CalendarPage.tsx`, `ParentHome.tsx`, `Leaderboard.tsx`,
  `EndMeetingDialog.tsx`, `AttendancePanel.tsx`, all loaders, `supabase/**`,
  `docs/swarm/**`, `.claude/**`.

## Traps
1. **The aria-label trap in Item 1 is the point of that item.** A worker who
   deletes headers and adds `aria-label` ships an a11y regression that looks
   right in a screenshot. Verify computed accessible names.
2. Item 2 is user-facing copy → constitution item 17 (neutral, factual; users
   are minors). Do not replace jargon with cheerful filler.
3. Do not delete warning banners whose wording is bad but whose warning is real.
4. Astryx props verified against installed source or `astryx-api.md` (cite
   which). The api doc has been wrong twice — installed source wins on conflict.
5. Sibling T130 works in `OutreachList.tsx` concurrently on the **coach**
   section. Keep your diff to the student section there. Never `git stash`.

## Required Output
Full diff; per-item evidence (Item 1: computed accessible name per list and how
you verified it; Item 2: all eleven sites before/after plus the T037 test
update; Item 3: the new module, both trap-handling and every site changed);
gate output (tsc, eslint 0 errors, full vitest, build, prettier); the
out-of-scope follow-ups you found; risks; disclosed judgment calls.
