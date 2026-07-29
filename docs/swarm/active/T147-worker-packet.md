# Worker Packet: T147 — the outreach team picker shows fixture teams to real users

**User-reported bug, found in manual testing.** Creating a new outreach shows
`Ravens` and `Titans` in the team dropdown instead of the teams the coach actually
created. This is not a test artifact; it is what production does today.

**Packet SHA: pin this.** Before writing your output doc, run
`git log -1 --format=%H -- docs/swarm/active/T147-worker-packet.md` and confirm it
matches the SHA in your dispatch prompt.

## FIRST — merge the working branch

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```

Report the result. **If it conflicts, stop and report.**

## Root cause — verified, and it is not an accident

`OutreachEventDialog` declares the prop as optional with a fixture default:

```ts
// OutreachEventDialog.tsx:964
teams?: readonly OutreachTeamOption[];
// :981
teams = DEFAULT_TEAMS,
```

```ts
// OutreachEventDialog.tsx:610-613
const DEFAULT_TEAMS: readonly OutreachTeamOption[] = [
  { id: 'team-ravens', name: 'Ravens' },
  { id: 'team-titans', name: 'Titans' },
];
```

**Neither call site passes `teams`,** so every real user gets the fixture:

- `OutreachList.tsx:3161-3171` — create/edit dialog
- `OutreachDetail.tsx:1430-1437` — edit dialog

Both omissions are deliberate and documented. `OutreachList.tsx:3153-3160`:

> `teams` deliberately NOT overridden -- module doc #11 (unchanged, out of this
> task's own Allowed Files).

`OutreachDetail.tsx:1420-1430` records the same, calling it a "still fixture-backed
posture". T101 and T121 each correctly stayed inside their Allowed Files. **The
defect is that nobody logged the follow-up**, so a scoping decision became a shipped
bug. Do not read either comment as a mistake by those workers; do delete both once
the wiring is real, since they will then describe something untrue.

## The fix is asymmetric — read both parts before starting

### Part A — `OutreachDetail.tsx`: one line

Real teams are **already there**. `:1299` destructures `teams` from `detailData`, and
it is already used at `:1360` (`formatScopeLabel`) and passed to `AttendancePanel` at
`:1385`. Pass it to the dialog too.

Types are compatible and you should verify that rather than assume it: `TeamOption`
(`OutreachDetail.tsx:402`) is `{ id, name, color }`; `OutreachTeamOption`
(`OutreachEventDialog.tsx:506`) is `{ id, name }`. The extra `color` is fine for
assignment.

### Part B — `OutreachList.tsx`: real threading

This page has **no team data at all**. `makeLoadOutreachData`
(`loaders/outreach.ts:802-830`) builds loaders for events, sessions, rsvps,
attendance, students and season goal — **no teams query**.

You do not need to write one. `queryAllTeams` already exists at
`loaders/outreach.ts:730` and is already consumed by `makeLoadOutreachDetail:865`.
Add a `createLoader<void, TeamDbRow[]>(queryAllTeams, getClient)` to
`makeLoadOutreachData`, map it with the existing `mapTeamDbRowToTeamOption` (`:607`),
add `teams` to the result payload, thread it to the page, and pass it to the dialog.

**Fetch it in parallel with the existing batch, not serially.** The loader already
uses `Promise.all` for independent queries; teams depends on nothing, so it must not
add a round trip. If you find yourself adding a sequential `await`, stop and
reconsider.

### Part C — close the hole so this cannot recur

Once both call sites pass real data, **make `teams` required and delete
`DEFAULT_TEAMS`.** With the prop optional, the next call site that forgets it gets
silent fixture data again — which is exactly how this bug shipped.

This is the same reasoning T143 applied when it made `TeamOption.color` required so
`tsc` forces every construction site to supply a real value. Two call sites makes
this cheap now.

`DEFAULT_STUDENTS` (`:617-623`) is a **separate** fixture that T121 already fixed by
wiring the real roster into `students`. Leave it alone — it is still the declared
default for that prop and changing it is not this task.

If making `teams` required breaks a test that relied on the default, update the test
to pass explicit teams. **Do not restore the default to keep a test green.**

## Acceptance Criteria

1. `OutreachDetail.tsx` passes its real `teams` to `OutreachEventDialog`.
2. `OutreachList.tsx` loads real teams and passes them to `OutreachEventDialog`.
3. The teams query in `makeLoadOutreachData` runs **in parallel** with the existing
   independent queries. State how you confirmed no extra round trip.
4. `teams` is a required prop; `DEFAULT_TEAMS` is deleted; no call site relies on a
   fixture fallback.
5. The two stale comments (`OutreachList.tsx:3153-3160`,
   `OutreachDetail.tsx:1420-1430`) are corrected — they currently assert the prop is
   deliberately fixture-backed, which will be false.
6. **Regression tests, one per call site**, asserting the dropdown renders the teams
   supplied by the loader and **not** `Ravens`/`Titans`.

   **Prove they discriminate:** revert each call site's prop pass, confirm the
   matching test fails, restore, confirm it passes. Report what you saw for each. A
   test that passes either way is worth less than none, and has cost this task set
   two rounds this session.
7. `npx tsc --noEmit`, `npx vite build`, `npm run format:check`, `npx eslint .` and
   `npx vitest run` all clean. Baselines at this packet's commit: **0 errors, 354
   warnings**, 63 test files, **1474 tests**. Report yours and explain any change.

## Allowed Files

- `src/pages/outreach/OutreachEventDialog.tsx`
- `src/pages/outreach/OutreachEventDialog.test.tsx`
- `src/pages/outreach/OutreachList.tsx`
- `src/pages/outreach/OutreachList.test.tsx`
- `src/pages/outreach/OutreachDetail.tsx`
- `src/pages/outreach/OutreachDetail.test.tsx`
- `src/lib/supabase/loaders/outreach.ts`
- `docs/swarm/active/T147-worker-output.md` (create)

## Forbidden Files

- `docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`,
  `dispute-log.md`, `auto-mode-decisions.md`
- Any other `docs/swarm/**` file, including other packets
- `.claude/**`
- Every other loader under `src/lib/supabase/loaders/`
- `src/pages/outreach/AttendancePanel.tsx` — T143 just landed here; do not disturb
- `src/pages/home/CoachHome.tsx` — **T142 is in flight against this file right now**
- Anything under `node_modules/`

## Relevant Constitution Excerpt

- **Item 6** — fixture data must use fabricated names. Relevant in reverse here: the
  fixtures are correctly fabricated, they are simply reaching real users.
- **Item 2** — component props come only from `docs/swarm/astryx-api.md`.
- **Item 19c** — verify a citation before asserting it. If anything here does not
  match the tree, **stop and report the mismatch rather than guessing at intent.**
  Three orchestrator citation errors reached workers this session; you are invited to
  find a fourth.

## Required Worker Output

Create `docs/swarm/active/T147-worker-output.md` covering: files changed; how you
threaded teams into `makeLoadOutreachData` and your evidence there is no extra round
trip; confirmation that `teams` is now required and `DEFAULT_TEAMS` is gone; which
tests you had to update because they relied on the default, and why updating each was
correct rather than a weakening; the discrimination proof for criterion 6 at both
call sites; full command output; and anything you could not verify, stated plainly as
unverified.

Do not mark this task complete. A checker verifies it.
