# Worker Packet: T138 — finish UXC-05's "one semantic colour system"

Wave 5, packet **W5-P6**. Runs after T136, which landed the confirmed/planned
tokens and `GoalBar`.

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

UXC-05 asks for **one** semantic colour system. T136 delivered the
confirmed/planned half. What remains is that the rest of the colour decisions
are not one system — they are several copies and one outright contradiction.

Three parts, in descending order of user impact.

---

## Part B (do this first — it is the only user-visible bug)

**A coach can set a team's colour and the app ignores it.**

`teams.color` is a real column (`20260716000000_identity_roster.sql:34`,
`text not null`), editable through `TeamsTab`'s form, which offers the eleven
Astryx `TokenColor` values (`TeamsTab.tsx:583-603`). `TeamsTab` renders the
chosen swatch via `toKnownTeamColor(row.color)` (`:916-917`).

But `AttendancePanel.tsx:767` colours its team chips with
`pickTeamBadgeVariant(student.teamId)` (`:313`) — **a hash of the team's UUID,
which never reads `teams.color` at all.** So a coach sets Ravens to Red in the
roster and the attendance panel shows them in whatever the hash produced.

**Fix:** the stored colour wins. Derive the chip variant from `teams.color`,
falling back to the existing hash **only** when the stored value is not a usable
hue.

### The mapping, and the two values that have no hue

`TokenColor` (`node_modules/@astryxdesign/core/dist/Token/Token.d.ts:19`) is:

```
'default' | 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'cyan' | 'blue' | 'purple' | 'pink' | 'gray'
```

`BadgeVariant`'s non-semantic hues (`astryx-api.md:529`, Badge Props table) are:

```
blue | cyan | green | orange | pink | purple | red | teal | yellow
```

**Nine of the eleven map across exactly by name.** `'default'` and `'gray'` have
no hue equivalent — those are the fallback cases. Do **not** invent a hue for
them and do **not** silently pick one; either fall back to the hash or to
`'neutral'`, and say in your output which you chose and why.

**`teams.color` has no check constraint** — it is free text, and a fixture row
(`team-legacy-alpha`) deliberately stores an unrecognised string precisely to
exercise that path (`TeamsTab.tsx:220-228`). Your resolver must handle any
string without crashing.

### Trap — `pickTeamBadgeVariant` is exported and pinned

`AttendancePanel.test.tsx:232` asserts it is deterministic for the same id. Keep
that guarantee. You may keep the function as the fallback, but if you change its
signature you must update that assertion and say so. **Do not delete it** — it
is still the right answer when no usable colour is stored.

---

## Part A — three copies of the same map

The event-type badge mapping is declared **three times, independently**, and
they agree only by luck:

- `src/pages/home/CoachHome.tsx:1802` — `EVENT_TYPE_BADGE`, typed `BadgeVariant`
- `src/pages/reports/EventsTab.tsx:470` — `EVENT_TYPE_BADGE`, exported, typed
  `BadgeVariant`
- `src/pages/calendar/CalendarPage.tsx:594` — `CALENDAR_TYPE_BADGE`, typed
  **more narrowly** as `'purple' | 'blue' | 'orange'`, and carrying the PRD's
  colour names as comments (Meeting Violet / Circuit Blue / Comp Orange)

All three currently map `meeting → purple`, `outreach → blue`,
`competition → orange`. `EventsTab.tsx:31-48`'s own module doc already notes the
duplication and that both were "independently derived from the same PRD source".

**Fix:** one shared module, imported by all three. Put it in `src/lib/` —
`src/components/` holds components (`GoalBar`, `StatCell`), and this is data.
Preserve the PRD colour-name comments; they are the provenance.

**This must be a pure refactor.** Every rendered badge keeps its exact current
variant and label. If consolidating would change any rendered value, stop and
report rather than "improving" a colour — a colour change is a product decision
and is not in this packet.

Note `CalendarPage`'s narrower type is a deliberate constraint, not sloppiness.
If your shared type widens it, say what is lost.

---

## Part C — the last two default-accent bars

UXC-05 requires **zero default-accent bars**. Two remain, both omitting
`variant` and therefore defaulting to `accent`:

- `src/pages/meetings/MeetingsList.tsx:2344` — student participation
- `src/pages/meetings/StudentMeetingView.tsx:742` — participation

**Hard constraint, verified from the installed types.** `ProgressBar` has **no
hue variants**. `ProgressBarVariantMap`
(`node_modules/@astryxdesign/core/dist/ProgressBar/ProgressBar.d.ts`) is exactly:

```
accent | success | warning | neutral | error
```

So you **cannot** give these a data-viz hue, and you must not try. Pick a
semantic variant that is honest about what the bar means, and justify it in your
output.

**Do not replace these with `GoalBar`.** It exists for the two-fill
confirmed/planned case under F-3's narrow pre-approval; a single-value
participation bar is what Astryx's own `ProgressBar` is for. Substituting it
would be scope creep and would weaken F-3's boundary.

**Consider whether `accent` is actually wrong here.** UXC-05's target is "zero
default-accent **bars**" in the sense of bars that carry meaning through the
default brand accent rather than through the semantic system. If you conclude a
semantic variant genuinely misrepresents participation, say so and leave it —
with reasoning. A disclosed, argued non-change is a better outcome than a
misleading colour.

---

## Explicitly out of scope

- **UXC-06's dashboard two-up pairing.** Separate task, different files.
- **Changing any badge colour.** Parts A and B move where a colour comes from,
  not what it is.
- **`teams.color`'s schema.** No migration. It stays free text.
- Per-team hues anywhere beyond the render sites named above.

## Allowed Files

- `src/lib/**` — the new shared module (create)
- `src/pages/home/CoachHome.tsx`, `src/pages/reports/EventsTab.tsx`,
  `src/pages/calendar/CalendarPage.tsx` — **only** the badge-map declaration and
  its import
- `src/pages/outreach/AttendancePanel.tsx` and its test
- `src/pages/meetings/MeetingsList.tsx`, `src/pages/meetings/StudentMeetingView.tsx`
  — **only** the `ProgressBar` call
- Tests for any of the above
- `docs/swarm/active/T138-worker-output.md` (create)

## Forbidden Files

- `supabase/migrations/**` — no schema change, at all.
- `src/pages/roster/TeamsTab.tsx` — its swatch rendering already honours
  `teams.color` correctly and is the behaviour you are propagating, not
  changing.
- `src/components/GoalBar.tsx`, `src/theme/volt.ts`, `src/theme/theme.css` —
  T136 landed these and they are settled.
- `docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`,
  `dispute-log.md`, `.claude/**`.

## Acceptance Criteria

1. **Part B:** a team's chip colour is derived from `teams.color` where it maps
   to a hue, with a disclosed fallback otherwise. Prove it with a test where a
   team's stored colour and its hash colour **differ**, asserting the stored one
   wins — a test using a team whose two happen to agree proves nothing.
2. **Part B:** an unrecognised `teams.color` string does not crash and produces
   the disclosed fallback. Use the existing `team-legacy-alpha`-style fixture.
3. **Part A:** exactly **one** declaration of the event-type map remains in
   `src/`. Prove it: `grep -rn "meeting: { variant:" src/` returns one hit.
4. **Part A:** every rendered badge variant and label is **unchanged**. State
   how you proved it, not that you believe it.
5. **Part C:** neither `ProgressBar` renders with the default accent, **or** you
   have argued in writing why one should stay and left it.
6. `npx tsc --noEmit`, `npx vite build`, `npm run format:check` clean;
   `npx eslint .` zero errors and no new warnings (baseline **0 errors / 353
   warnings**).
7. `npx vitest run` green. Baseline **1469 across 63 files**. State your expected
   end count and whether you hit it. Any test outside your Allowed Files that
   changes is a regression — report it, don't silence it.

**Do not certify your own work.**

**Commit on your worktree branch before reporting**, and end with
`git status --porcelain` — it must be empty apart from anything gitignored. A
recent task left its work uncommitted and the branch merged without it.

## Relevant Constitution Excerpt

- **Item 2** — Astryx props only from `astryx-api.md`. Badge variants come from
  its Badge Props table (`:529`); `ProgressBar`'s variant set is quoted above
  from the installed types. Do not invent a variant.
- **Item 1** — PRD IDs outrank packet text. UXC-05 is the authority; this packet
  is my reading of what remains of it.
- **Item 15** — accessibility is a shipping requirement. Colour must not become
  the *only* carrier of meaning: every badge keeps its text label, and a team
  chip must still name the team. If any change here would make colour
  load-bearing on its own, stop and report.
- Non-Negotiables — existing tests pass unless explicitly approved; no worker
  self-certifies.

## Required Worker Output

`docs/swarm/active/T138-worker-output.md`:

- The packet SHA you verified.
- Part B: the resolver, the fallback you chose for `default`/`gray` and why, and
  the differing-colours test from criterion 1.
- Part A: where the shared module lives and why; your proof of criterion 4.
- Part C: the variant you chose and your reasoning — or your argument for
  leaving one alone.
- Test count started from and ended with.
- Full output of the commands in criteria 6–7.
- Anything unverified, stated plainly as unverified.
