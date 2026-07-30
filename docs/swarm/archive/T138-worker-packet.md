# Worker Packet: T138 — one shared event-type badge map (UXC-05, part 1 of 3)

Wave 5, packet **W5-P6a**. Small, pure refactor. One new module, three call
sites.

**Revision 2 (2026-07-29).** Revision 1 bundled three parts and its premise gate
returned **BLOCKER**. Both findings were mine, and both were serious enough that
the packet was cut down rather than patched:

- **Part B (team chips honour `teams.color`) was impossible in the Allowed
  Files.** `queryAllTeams` selects `'id, name'`
  (`src/lib/supabase/loaders/outreach.ts:713`); `TeamDbRow` (`:441-444`) and
  `AttendancePanelTeam` (`AttendancePanel.tsx:243-246`) are both `{id, name}`.
  **The colour never leaves the database.** A worker could only have satisfied
  the criterion by adding an optional `color` field production never populates —
  green tests, green build, real bug untouched. Now **T143**, with the loader in
  scope.
- **Part C undercounted by 5×.** The packet said "the last two default-accent
  bars". There are **ten** `<ProgressBar>` call sites in `src/` and **not one
  passes `variant`**, so all ten default to `accent`. Now **T144**.

What is left here is Part A, which the gate confirmed is safely dispatchable as
scoped.

**Packet SHA: pin this.** Before writing your output doc, run
`git log -1 --format=%H -- docs/swarm/active/T138-worker-packet.md` and confirm
it matches the SHA in your dispatch prompt.

## FIRST — merge the working branch

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```

Report the result. **If it conflicts, stop and report.**

## Why this exists

UXC-05 asks for **one** semantic colour system. The event-type badge mapping is
declared **three times, independently**:

| File | Constant | Type |
|---|---|---|
| `src/pages/home/CoachHome.tsx:1802` | `EVENT_TYPE_BADGE` | `BadgeVariant` |
| `src/pages/reports/EventsTab.tsx:470` | `EVENT_TYPE_BADGE` (exported) | `BadgeVariant` |
| `src/pages/calendar/CalendarPage.tsx:594` | `CALENDAR_TYPE_BADGE` | `'purple' \| 'blue' \| 'orange'` |

All three map `meeting → purple`, `outreach → blue`, `competition → orange`,
with identical labels. They agree **today**, by coincidence of independent
derivation from the same PRD line — `EventsTab.tsx:31-48`'s own module doc
already records that it and `CalendarPage` were "independently derived from the
same PRD source".

Three copies of one decision is exactly what UXC-05 exists to stop.

## The change

One shared module in `src/lib/`, imported by all three sites. `src/components/`
holds components (`GoalBar`, `StatCell`); this is data.

Preserve the PRD colour-name comments from `CalendarPage.tsx:594-600` (Meeting
Violet / Circuit Blue / Comp Orange) — they are the provenance and the reason
these values are what they are.

**This is a pure refactor.** Every rendered badge keeps its exact current variant
and label. If consolidating would change any rendered value, **stop and report**
— a colour change is a product decision and is not in this packet.

## Traps

1. **`CalendarPage`'s narrower type is deliberate, not sloppy.** It is
   `'purple' | 'blue' | 'orange'`, not `BadgeVariant`. If your shared type widens
   it, say plainly what constraint is lost. If you can preserve the narrowing at
   that call site while sharing the values, better — but do not contort the
   design for it.
2. **`EventsTab.tsx:470` is `export`ed and consumed by a test.**
   `EventsTab.test.tsx:249-251` imports the **value** (not its declaration site),
   so re-exporting it from `EventsTab.tsx` keeps that test green **as written**.
   Verify that rather than assuming it.
3. **A third team-colour render site exists and is out of scope.**
   `StudentsTab.tsx:247-252` deliberately renders team badges as flat
   `'neutral'`, a disclosed decision rather than an oversight. Leave it. It is
   not part of the event-type map.
4. Do not touch the two other UXC-05 parts — they are T143 and T144 now.

## Allowed Files

- `src/lib/**` — the new shared module (create)
- `src/pages/home/CoachHome.tsx`, `src/pages/reports/EventsTab.tsx`,
  `src/pages/calendar/CalendarPage.tsx` — **only** the map declaration and its
  import
- Tests for any of the above
- `docs/swarm/active/T138-worker-output.md` (create)

## Forbidden Files

- `src/pages/outreach/AttendancePanel.tsx`, `src/lib/supabase/loaders/outreach.ts`,
  `src/pages/outreach/OutreachDetail.tsx` — **T143's territory.**
- `src/pages/meetings/MeetingsList.tsx`, `src/pages/meetings/StudentMeetingView.tsx`,
  `src/pages/home/ParentHome.tsx`, `src/pages/home/StudentHome.tsx`,
  `src/pages/reports/HoursTab.tsx`, `src/pages/reports/ParticipationTab.tsx` —
  **T144's territory** (`ProgressBar` variants).
- `src/pages/roster/TeamsTab.tsx`, `src/pages/roster/StudentsTab.tsx`
- `supabase/migrations/**` — no schema change, at all.
- `src/components/GoalBar.tsx`, `src/theme/volt.ts`, `src/theme/theme.css` —
  T136 landed these and they are settled.
- `docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`,
  `dispute-log.md`, `.claude/**`.

## Acceptance Criteria

1. Exactly **one** declaration of the event-type map remains in `src/`. Prove it:
   `grep -rn "meeting: { variant:" src/` currently returns **3** hits and must
   return **1**. (Verified as the current count at this packet's SHA — if it does
   not return 3 when you start, stop and report.)
2. Every rendered badge variant and label is **unchanged**. State how you proved
   it, not that you believe it — a render-level assertion or an explicit
   value-by-value comparison, not an eyeball.
3. `CoachHome`, `EventsTab` and `CalendarPage` all import from the one module;
   none keeps a local copy.
4. Trap 2's test still passes **unmodified**.
5. `npx tsc --noEmit`, `npx vite build`, `npm run format:check` clean;
   `npx eslint .` zero errors and no new warnings (baseline **0 errors / 353
   warnings**).
6. `npx vitest run` green. Baseline **1469 across 63 files**. A pure refactor
   should not change the count; if you add a test for the shared module, say so
   and give the new number.

**Do not certify your own work.**

**Commit on your worktree branch before reporting**, and end with
`git status --porcelain` — it must be empty apart from anything gitignored. A
recent task left its work uncommitted and the branch merged without it.

## Relevant Constitution Excerpt

- **Item 2** — Astryx props only from `astryx-api.md`. Badge variants come from
  its Badge Props table (`:530`). Do not invent a variant.
- **Item 1** — PRD IDs outrank packet text. UXC-05 is the authority; this packet
  covers one third of what remains of it.
- **Item 15** — accessibility is a shipping requirement. Every badge keeps its
  text label; colour must not become the sole carrier of meaning. Nothing here
  should change that, so confirm it rather than claiming an audit.
- Non-Negotiables — existing tests pass unless explicitly approved; no worker
  self-certifies.

## Required Worker Output

`docs/swarm/active/T138-worker-output.md`:

- The packet SHA you verified.
- Where the shared module lives and why.
- Criterion 1's grep, before and after.
- Criterion 2's proof.
- What happened to `CalendarPage`'s narrower type (Trap 1).
- Test count started from and ended with.
- Full output of the commands in criteria 5–6.
- Anything unverified, stated plainly as unverified.
