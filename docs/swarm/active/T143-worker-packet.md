# Worker Packet: T143 — team chips must honour `teams.color` (UXC-05, part 2 of 3)

Wave 5, packet **W5-P6b**. A real user-visible bug, not a refactor.

**Packet SHA: pin this.** Before writing your output doc, run
`git log -1 --format=%H -- docs/swarm/active/T143-worker-packet.md` and confirm
it matches the SHA in your dispatch prompt.

## FIRST — merge the working branch

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```

Report the result. **If it conflicts, stop and report.**

## The bug

**A coach sets a team's colour and the app ignores it.**

`teams.color` is a real column (`20260716000000_identity_roster.sql:34`,
`text not null`). `TeamsTab`'s form offers the eleven Astryx `TokenColor` values
(`TeamsTab.tsx:583-603`) and renders the chosen swatch via
`toKnownTeamColor(row.color)` (`:916-917`). That surface works.

But `AttendancePanel.tsx:767` colours its team chips with
`pickTeamBadgeVariant(student.teamId)` (`:313`) — **a hash of the team's UUID.**
Set Ravens to Red in the roster; the attendance panel shows whatever the hash
produced.

## Why this needs the loader, and why revision 1 of the earlier packet failed

The colour **never leaves the database on this path**:

```
client.from('teams').select('id, name')      loaders/outreach.ts:713
  → TeamDbRow { id, name }                   loaders/outreach.ts:441-444
  → mapTeamDbRowToTeamOption                 loaders/outreach.ts:592-594
  → TeamOption { id, name }                  OutreachDetail.tsx:402-405
  → AttendancePanelTeam { id, name }         AttendancePanel.tsx:243-246
```

Note `loaders/teams.ts:173` uses `select('*')` and **does** map `color` — that is
the roster path, and it is why `TeamsTab` works. There are two team loaders with
two shapes, and the outreach one drops the colour.

T138's revision 1 tried to fix the chip without the loader. Its premise gate
returned a BLOCKER: the only way to satisfy it was to add an optional `color`
that production never populates — **green tests, green build, coach still sees
the hash colour.** That is the failure mode this packet is shaped to prevent.

## The change

Thread `color` down the chain, then resolve it to a `BadgeVariant`.

**Make the new field required, not optional.** `teams.color` is `not null`, so
there is always a value, and a required field makes the compiler force every
construction site to supply it. An optional field would let the whole bug
survive silently — which is precisely what happened last time.

`AttendancePanelTeam` is constructed in exactly two places: the fixture at
`AttendancePanel.test.tsx:140`, and structurally (duck-typed, not imported —
`OutreachDetail.tsx:297-299` explains why) from `TeamOption`. So the chain is
short and the compiler will police it.

**`TeamOption` itself has two further object-literal sites**, both of which must
gain the field for `tsc` to pass, and both of which are in scope:
`OutreachDetail.tsx:493-496` (`FIXTURE_TEAMS`) and
`OutreachDetail.test.tsx:471`. Named explicitly so the "nothing else in this
file" restriction below is not ambiguous about them.

Useful coincidence: `FIXTURE_TEAMS` already contains `team-ravens`, which is the
id the worked example in criterion 3 uses.

### The resolver

`TokenColor` (`node_modules/@astryxdesign/core/dist/Token/Token.d.ts:19`):

```
'default' | 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'cyan' | 'blue' | 'purple' | 'pink' | 'gray'
```

`BadgeVariant`'s non-semantic hues (`astryx-api.md:530`, Badge Props table):

```
blue | cyan | green | orange | pink | purple | red | teal | yellow
```

**Nine of the eleven map across exactly by name.** `'default'` and `'gray'` have
no hue equivalent.

**Rule:** a stored colour that maps to a hue wins. Anything else — `'default'`,
`'gray'`, or an unrecognised string — falls back to
`pickTeamBadgeVariant(teamId)`, so multiple teams on one event stay
distinguishable rather than collapsing to one neutral.

**`teams.color` has no check constraint.** It is free text, and `TeamsTab.tsx:545`
has a fixture (`team-legacy-alpha`) storing a deliberately unrecognised string to
exercise that path (`TeamsTab.tsx:220-228` explains it). `TeamsTab` is forbidden
here, so build your own equivalent fixture — do not import theirs.

### Trap — `pickTeamBadgeVariant` stays

It is exported and `AttendancePanel.test.tsx:232` pins its determinism. **Do not
delete it** — it is still the right answer when no usable colour is stored. Keep
that guarantee; if you change its signature, update that assertion and say so.

## Explicitly out of scope

- **`StudentsTab.tsx:247-252`**, which renders team badges as flat `'neutral'`.
  That is a disclosed, considered decision, not an oversight. Leave it.
- **The roster path.** `loaders/teams.ts` and `TeamsTab` already work.
- **`teams.color`'s schema.** No migration. It stays free text.
- The event-type badge map (T138) and the default-accent `ProgressBar`s (T144).

## Allowed Files

- `src/lib/supabase/loaders/outreach.ts` — the team query's `select()`,
  `TeamDbRow`, `mapTeamDbRowToTeamOption`. **Nothing else in this file.**
- `src/pages/outreach/OutreachDetail.tsx` — `TeamOption`, the team-mapping call
  site, **and `FIXTURE_TEAMS` (`:493-496`)**, which constructs `TeamOption`
  literals and therefore must gain the field too. **Nothing else in this file.**
- `src/pages/outreach/AttendancePanel.tsx` — `AttendancePanelTeam`, the resolver,
  the `:767` render site
- `src/lib/**` — if you put the `TokenColor → BadgeVariant` resolver in its own
  module (reasonable; T138 is creating a sibling there)
- Tests for any of the above
- `docs/swarm/active/T143-worker-output.md` (create)

## Forbidden Files

- `src/pages/roster/TeamsTab.tsx`, `src/pages/roster/StudentsTab.tsx`
- `src/lib/supabase/loaders/teams.ts` — the roster path is correct already
- `supabase/migrations/**` — **no schema change, at all.**
- `src/pages/home/CoachHome.tsx`, `src/pages/reports/EventsTab.tsx`,
  `src/pages/calendar/CalendarPage.tsx` — **T138's territory**, in flight
- `src/components/GoalBar.tsx`, `src/theme/volt.ts`, `src/theme/theme.css`
- `docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`,
  `dispute-log.md`, `.claude/**`

## Acceptance Criteria

1. `color` is selected by the outreach team query and carried through every hop
   to the chip. **Quote the new `select()` string in your output.**
2. The new field is **required**, not optional, at every hop. If you make it
   optional anywhere, justify it explicitly — the default answer is required.
3. **The decisive test:** a team whose stored colour and hash colour **differ**,
   asserting the stored one wins. A team where they coincide proves nothing —
   compute both, confirm they differ, and say so in your output.

   **A worked example, verified by running the real hash:** `team-ravens` hashes
   to `cyan`. Give it a stored colour of `'red'` and the chip must render `red`,
   not `cyan`. You may use this or construct your own, but state both values
   either way. If you find the hash does **not** produce `cyan` for that id, stop
   and report — something has changed under us.
4. A stored colour of `'default'`, `'gray'`, or an unrecognised string falls back
   to `pickTeamBadgeVariant` and does not crash. Test each of the three.
5. `pickTeamBadgeVariant`'s determinism assertion still passes.
6. `npx tsc --noEmit`, `npx vite build`, `npm run format:check` clean;
   `npx eslint .` zero errors, and state the warning count against the baseline
   (**0 errors / 353 warnings** — say plainly if yours differs and why).
7. `npx vitest run` green. Baseline **1469 across 63 files**; state your expected
   end count and whether you hit it.

**Do not certify your own work.**

**Commit on your worktree branch before reporting**, and end with
`git status --porcelain` — empty apart from anything gitignored.

## Relevant Constitution Excerpt

- **Item 2** — Astryx props only from `astryx-api.md`. Badge variants come from
  its Badge Props table (`:530`). Do not invent a variant.
- **Item 15** — accessibility is a shipping requirement. **Colour must not become
  the sole carrier of meaning:** the chip must still name the team in text. If
  your change would make colour load-bearing on its own, stop and report.
- **Item 5/6** — no secrets, no PII. Team names are fine; do not add student
  names to any new fixture.
- Non-Negotiables — existing tests pass unless explicitly approved; no worker
  self-certifies.

## Required Worker Output

`docs/swarm/active/T143-worker-output.md`:

- The packet SHA you verified.
- The new `select()` string, and each hop the field passes through.
- Criterion 3: the team you used, its stored colour, its hash colour, proof they
  differ, and the assertion.
- The fallback behaviour for all three cases in criterion 4.
- Test count started from and ended with.
- Full output of the commands in criteria 6–7.
- Anything unverified, stated plainly as unverified.
