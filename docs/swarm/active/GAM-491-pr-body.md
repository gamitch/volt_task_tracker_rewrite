Closes GAM-491

## What changed

`SchedulePanel` was mounted with no `roster`, so `SessionRow` took its
`!roster` branch and every session on the redesigned coach page read **"No
roster recorded"** — `AttendanceChips` never mounted and no coach could mark
anyone present. This adds the missing read side: a new loader
`src/lib/supabase/loaders/sessionRoster.ts` builds
`ReadonlyMap<sessionId, readonly SessionRosterEntry[]>` from `events.team_ids`,
`event_sessions`, active `students` and the existing
`makeLoadAttendanceForSessions`, and `CoachMeetingsView` threads `roster`,
`isRosterLoading` and `rosterError` into the panel it already mounts.

The write path is untouched. `setAttendanceStatus`, `clearAttendanceStatus`,
`recordedBy`, `SchedulePanel.tsx`, `SessionRow.tsx`, `AttendanceChips.tsx`,
`src/lib/meetings/types.ts` and `src/lib/supabase/loaders/attendance.ts` are all
byte-identical to `main` — verified per file by the checker, not asserted.

## What the issue got wrong

1. **The premise nearly read as false, and it is not.** This container cloned
   `main` at `8f0f1eee`, one merge behind: GAM-452's PR #242 landed as
   `5bf0cb78` about a minute before the run started. Against the stale tree
   `SchedulePanel` had **no caller anywhere in `src/`** and the issue's
   `CoachMeetingsView.tsx:760-790` citation resolved to unrelated code. After
   `git fetch` + rebase, the citation is exact. Recorded because "the issue's
   line numbers point at nothing" is a convincing-looking reason to refuse work
   that is in fact correctly specified.
2. **`SessionRow.tsx:50` / `:253` and `SchedulePanel.tsx:208-215` are
   approximate.** Live: `SchedulePanel.tsx:178` (`SessionRosterEntry`),
   `:209-215` (the three props), `SessionRow.tsx:181-190`
   (`buildInitialStatusMap`), `:368-384` (the empty state).
3. **`SchedulePanel.test.tsx:285-295`'s matchers are not what the issue
   implies.** They are a source-text grep on `SchedulePanel.tsx` for Supabase
   mutation calls — irrelevant here, because that file is untouched.

## What the issue did not know

`makeLoadAttendanceForSessions` is **the one attendance read in
`src/lib/supabase/loaders/` that does not apply `excludeUnmarked`**
(`attendance.ts:391-402` selects `*` raw; `:308-322` copies `row.status`
straight into a type declared as the four-value `AttendanceStatus`). GAM-479
stores a *cleared* mark as `status = 'unmarked'`, and `attendance.ts:224-231`
states the invariant that keeps that safe — the sentinel never crosses the
loader boundary. Six other queries enforce it; this one does not.

Had this loader trusted it, a student whose mark a coach had cleared would come
back looking marked with a value no consumer has an arm for. The new loader
filters the sentinel to `null` itself, and that guard is what the named mutation
below attacks. The upstream gap is filed as **GAM-496**.

## Tier, stated and defended

**STANDARD, with a required acceptance checker** (item 26; tiered under item 28d
as part of claiming, because the row arrived `tier/unreviewed`).

- No unconditional HEAVY trigger applies: one read-only loader plus three props
  at one call site — no migration, no RLS or `security definer` helper, no
  auth/session/role-resolution change, no metric SQL, and no write path at all.
- No contract change. `SessionRosterEntry` and the three props already existed
  and are exported; this supplies them rather than redefining them, so the
  frozen-contract trigger does not fire.
- The read seam is established, not novel: `endMeeting.ts:339` and
  `kiosk.ts:460` already read `students` + `attendance` for a session as a coach.
- **The losing argument was HEAVY** on "reports a user's own persisted records."
  Item 26 answers it directly: presenting values through an already-settled
  source-of-truth contract "is not this trigger — it routes to STANDARD with its
  required checker."
- A checker was required all the same, on three STANDARD triggers:
  role-sensitive presentation, user-data reporting whose mapping could mislead,
  and constitution item 6.

Worker model: the pinned default (sonnet). **No `model: "opus"` override** —
none of item 18's four triggers applies, and item 25's second obligation
forbids bumping a worker because a topic sounds sensitive.

## Verification

Six gates, run by the checker in a clean detached worktree at the committed
candidate:

```
GATE RUN — 86ca2a9a on HEAD — tree clean

  1 tsc                                                    exit 0  PASS
  2 vite build                                             exit 0  PASS
  3 format:check                                           exit 0  PASS
  4 eslint                                                 exit 0  PASS       0 errors, 382 warnings
  5 vitest (full)                                          exit 0  PASS       115 files / 2805 tests  (no baseline given — regression not checked)
  6 vitest src/lib/supabase/loaders/sessionRoster.test.ts  exit 0  PASS       1 files / 10 tests  (no baseline given — regression not checked)

VERDICT: PASS — all six gates exit 0
```

The gate runner disclaims "no baseline given", so the checker measured one at
the merge base `5bf0cb78` in a separate worktree: full suite **exit 0, 114 files
/ 2792 tests** (candidate 2805 = +13, all new; no test disappeared) and
`eslint .` **exit 0, 0 errors, 382 warnings** — so the candidate's 382 is **zero
new warnings**. Packet-scope gate 6 as worded (both touched test files, one
process): `2 passed / 40 passed`, `EXIT=0`.

### Mutations

| Mutation | Expected | Result |
| -- | -- | -- |
| Delete the `'unmarked'` sentinel guard in `sessionRoster.ts` | criterion 4 red, naming `'unmarked'` | **exit 1, 1 failed / 9 passed** — `AssertionError: expected 'unmarked' to be null`, on the criterion-4 mapping assertion. Not a compile error, no collateral. Reverted → green. |
| Item 27 probe: close the `rosterError` route, keep the real default loader | the `SupabaseNotConfiguredError` sentence must vanish from the DOM | **exit 1** — it did. The sentence reaches the DOM *only* through a genuine call to the real `loadSessionRoster`, not via `AuthProvider`'s identical console message. |
| Item 27 probe: swap the default for a fixture stub | criterion 10 red | **5 tests red**, criterion 10 among them. |

Both mutations ran in the checker's own disposable worktree (item 23); the
shared tree never left the committed candidate.

Constitution item 6 was measured rather than inferred: the checker ran the real
`makeLoadSessionRoster` over 11 adversarial `display_name` inputs the test suite
does not cover — multi-word surname (`Maria del Carmen Rivera` → `Maria R.`),
hyphenated (`Ana Ruiz-Martinez` → `Ana R.`), trailing/repeated whitespace,
whitespace-only (`"   "` → `Student`), single-token (`Cher` unchanged, no
fabricated initial). No full surname escapes on any input.

## Scope — item 27

**Passed, not Partial.** Criterion 10 is the item 27 test and it was graded on
the *connection*, not the render: `MeetingsList.tsx:173` mounts
`<CoachMeetingsView>` passing no `loadSessionRoster`, so the destructured
default — the real `sessionRoster.ts` singleton — is what production uses, and
the checker proved that with the mutation above rather than reading the props.
PRD DES-12's four states are all fed by that real loader.

## Follow-ups filed

- **GAM-496** (`Backlog`, `tier/unreviewed`, `Bug`) — item 20. The upstream gap:
  `makeLoadAttendanceForSessions` skips `excludeUnmarked`, so a cleared mark can
  read back as `'unmarked'` on four outreach surfaces and the end-meeting
  summary. Carries the two traps a fixer needs (call `excludeUnmarked` rather
  than adding a `.neq` this repo's query-builder fakes cannot see; the filter
  interacts with the T320 paging loop's short-page test).
- **GAM-497** (`Backlog`, `tier/unreviewed`) — the checker's two findings: the
  `?? []` reads that cannot distinguish "no rows" from "no answer", and the
  criterion-7 fixtures that under-cover the name rule they guard.

## Known gaps, disclosed

- `sessionRoster.ts` uses `(row.status as string) === UNMARKED_DB_STATUS`.
  `tsc` rejects the bare comparison as TS2367 because `AttendanceRow.status` is
  declared as a union that cannot hold the sentinel — the cast documents the
  finding above rather than hiding it. The checker removed the cast and
  confirmed TS2367 is real, and that the cast is scoped to the comparison only:
  the value stored into the map keeps its declared type, which is true because
  the sentinel was filtered one line earlier.
- The roster map materializes one entry per (session × student). The shape is
  mandated by the frozen `SchedulePanelProps.roster`.
- Out of scope and noted by the checker for triage: `endMeeting.ts:344` builds
  its roster entry as `{ studentId, name: student.display_name }` — the **full**
  name leaves that loader. It predates this branch and that file is forbidden
  here.

Linear-Issue: GAM-491
