# Worker Output: T510 — series edit for scheduled meetings

**Packet:** `docs/swarm/active/T510-worker-packet.md` (v4, final, committed `eaa9070`).
**Baseline SHA:** `eaa907092c35a23c8634c6ab0e31ba567a6d319e` (`git rev-parse HEAD` before this change; still
`HEAD` — this worker does not commit, per instructions).
**Branch:** `claude/w3-meeting-workflow-0bl669`.

## Files changed (exact list, matching §5)

- `src/pages/meetings/ScheduleMeetingsDialog.tsx`
- `src/pages/meetings/ScheduleMeetingsDialog.test.tsx`
- `src/pages/meetings/MeetingsList.tsx`
- `src/pages/meetings/MeetingsList.test.tsx` (the ONE authorized pre-existing-test change, §9 — see below)
- `src/lib/supabase/loaders/meetings.ts`
- `docs/swarm/active/T510-worker-output.md` (this file — created)

No other file was touched. `git status --short` shows exactly the five `src/` files above as modified.

```
 M src/lib/supabase/loaders/meetings.ts
 M src/pages/meetings/MeetingsList.test.tsx
 M src/pages/meetings/MeetingsList.tsx
 M src/pages/meetings/ScheduleMeetingsDialog.test.tsx
 M src/pages/meetings/ScheduleMeetingsDialog.tsx
```

## AC1 — additive-only guarantee, with diff excerpt

`CreateMeetingsEventPayload`, `CreateMeetingsSessionPayload`, `CreateMeetingsPayload`,
`OnCreateMeetingsFn`, and `defaultOnCreateMeetings` were extracted from both the baseline (`eaa9070`)
and the current tree and diffed byte-for-byte — **all five are IDENTICAL**:

```
=== CreateMeetingsEventPayload ===  IDENTICAL
=== CreateMeetingsSessionPayload === IDENTICAL
=== CreateMeetingsPayload ===       IDENTICAL
=== OnCreateMeetingsFn ===          IDENTICAL
=== defaultOnCreateMeetings ===     IDENTICAL
```

`computeConfirmLabel` gained a leading required `isEditMode: boolean` parameter — six call sites
changed, not five:
- Five in `ScheduleMeetingsDialog.test.tsx` gain a literal `false` as a new leading argument (Grant B,
  exact lines below). Zero asserted strings changed.
- The component's own internal render call, `ScheduleMeetingsDialog.tsx` (now `:878`,
  `const confirmLabel = computeConfirmLabel(isEditMode, sessionsPayload.length);`), gains the REAL
  `isEditMode` variable, not a literal `false`.

Create-mode output is pixel-identical: `computeConfirmLabel(false, 0) === 'Create 0 meetings'`, etc.
(proven by the pre-existing, re-derived test at `ScheduleMeetingsDialog.test.tsx`'s
`describe('computeConfirmLabel (BEH-07)', ...)`). Edit-mode output is the literal string
`'Save changes'`, regardless of count (proven by the new
`it('T510: edit mode always renders "Save changes", regardless of count', ...)` in the same describe
block).

The rest of the `git diff` on `ScheduleMeetingsDialog.tsx` against baseline is additive: new
types/functions inserted after `defaultOnCreateMeetings`, new state/branches inside the component, and
JSX additions gated behind `isEditMode &&`. No line inside the five frozen declarations above was
touched.

## Every new/changed exported symbol's final signature

`src/pages/meetings/ScheduleMeetingsDialog.tsx` (all additive except `computeConfirmLabel` and
`ScheduleMeetingsDialogProps`, both noted):

```ts
export interface ExistingMeetingSeriesSession {
  sessionId: string;
  sessionDate: string;
  startsAt: string;
  endsAt: string;
  status: 'scheduled' | 'completed' | 'canceled';
}

export function isMeetingSessionReconcilable(
  session: Pick<ExistingMeetingSeriesSession, 'status' | 'startsAt'>,
  now: Date,
): boolean;

export interface MeetingSeriesReconcilePlan {
  toUpdate: Array<{ sessionId: string; session: CreateMeetingsSessionPayload }>;
  toInsert: CreateMeetingsSessionPayload[];
  toRemove: Array<{ sessionId: string; sessionDate: string }>;
}

export function computeMeetingSeriesReconcilePlan(
  existingSessions: readonly ExistingMeetingSeriesSession[],
  desiredFutureSessions: readonly CreateMeetingsSessionPayload[],
  now: Date,
): MeetingSeriesReconcilePlan;

export interface EditMeetingSeriesInitialData {
  eventId: string;
  title: string;
  teamIds: readonly string[] | null;
  locationName: string;
  description: string;
  sessions: readonly ExistingMeetingSeriesSession[];
}

export interface SaveMeetingSeriesPayload {
  eventId: string;
  event: CreateMeetingsEventPayload;
  desiredFutureSessions: CreateMeetingsSessionPayload[];
}

export type OnSaveMeetingSeriesFn = (payload: SaveMeetingSeriesPayload) => Promise<void>;

export const defaultOnSaveMeetingSeries: OnSaveMeetingSeriesFn;

export function buildEditConfirmationDescription(plan: MeetingSeriesReconcilePlan): string;

// CHANGED (was `(sessionCount: number): string`):
export function computeConfirmLabel(isEditMode: boolean, sessionCount: number): string;

// CHANGED (gained two optional fields):
export interface ScheduleMeetingsDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  teams: readonly ScheduleTeamOption[];
  onCreateMeetings?: OnCreateMeetingsFn;
  initialData?: EditMeetingSeriesInitialData;
  onSaveMeetingSeries?: OnSaveMeetingSeriesFn;
}
```

(`formatChicagoWallTime`, `CHICAGO_24H_TIME_FORMATTER`, `WEEKDAY_DATE_FORMATTER` are deliberately NOT
exported, per D015 disposition MINOR 6 and §4a.)

`src/lib/supabase/loaders/meetings.ts` (additive; `makeCreateMeetings`/`createMeetings` untouched):

```ts
export function makeSaveMeetingSeries(
  getClient?: () => SupabaseClient,
): OnSaveMeetingSeriesFn;

export const saveMeetingSeries: OnSaveMeetingSeriesFn;
```

`src/pages/meetings/MeetingsList.tsx` (changed):

```ts
// CoachMeetingRow gained two optional fields:
export interface CoachMeetingRow {
  eventId: string;
  title: string;
  locationName: string;
  teamScopeLabel: string;
  sessions: CoachMeetingSessionDetail[];
  teamIds?: readonly string[] | null;
  description?: string;
}

// CoachMeetingsViewProps gained a required prop (component always supplies a default):
export interface CoachMeetingsViewProps {
  loadData: LoadCoachMeetingsDataFn;
  onCancelSession: CancelMeetingSessionFn;
  onCreateMeetings: OnCreateMeetingsFn;
  onSaveMeetingSeries: OnSaveMeetingSeriesFn;
}

// MeetingsListProps gained one optional prop:
export interface MeetingsListProps {
  loadCoachData?: LoadCoachMeetingsDataFn;
  loadStudentData?: LoadStudentMeetingsDataFn;
  onCancelSession?: CancelMeetingSessionFn;
  onCreateMeetings?: OnCreateMeetingsFn;
  onSaveMeetingSeries?: OnSaveMeetingSeriesFn;
  resolveStudentId?: ResolveCurrentStudentIdFn;
  resolveStudentIsActive?: ResolveStudentIsActiveFn;
  studentId?: string;
}
```

`FixtureEvent` (unexported, internal) gained `description?: string;`; `buildCoachMeetingRows`'s own
exported signature is unchanged (its 3 hand-built fixture literal counts stay 3/3, per §2 — no
existing call site needed editing).

## AC9 — the fake-client mock's actual call sequence for all six branches (A–F)

All six live in `MeetingsList.test.tsx`, `describe('saveMeetingSeries (T510, AC9 ...)', ...)`, using a
shared `buildAC9FakeClient` helper that records every call onto one ordered `log` (so per-id
sequencing is checkable) and implements the FULL four-deep `event_sessions.delete().eq(...).gt(...)
.select(...)` chain — nothing resolves a `{data, error}` shape until `.select(...)` is actually
reached, so a mutation that drops `.select('id')` changes the MOCK's own observable behavior too, not
only the production code's (D016 §5/Q4).

- **Branch A** (2 ids, `session-x`/`session-y`, no attendance): for each id, `log` contains a
  `rsvpsDelete` entry BEFORE that same id's `sessionDeleteEqGtSelect` entry (asserted via
  `findIndex`/`toBeLessThan`); zero `cancelEq`/`cancelBatchIn` entries anywhere.
- **Branch B** (`session-attend` has attendance): exactly one `cancelBatchIn` entry with
  `ids: ['session-attend']`; zero `rsvpsDelete`/`sessionDeleteEqGtSelect` entries for it at all.
- **Branch C** (`session-safe` still future, `session-raced` is not, per `stillFutureIds`): zero log
  entries of any type reference `session-raced`; `session-safe` reaches a genuine
  `sessionDeleteEqGtSelect`.
- **Branch D** (`session-x` → `23503`, `session-y` → `ok`): `cancelEq` entries equal EXACTLY
  `[{ id: 'session-x' }]` (X only, never a batch covering both — `cancelBatchIn` never fires);
  `session-y` gets its own independent `rsvpsDelete` AND a genuine `sessionDeleteEqGtSelect`; the
  overall `save(...)` promise resolves (`.resolves.toBeUndefined()`).
- **Branch E** (a non-`23503` error, `code: 'UNEXPECTED'`, on the session-delete half of the only
  pair): `save(...)` rejects, and the rejection is asserted directly
  (`.rejects.toMatchObject({ code: 'UNEXPECTED' })`), not the absence of sibling effects.
- **Branch F** (`session-x` → `'zero'` i.e. `{ data: [], error: null }`, `session-y` → `ok`):
  `cancelEq` entries equal EXACTLY `[{ id: 'session-x' }]`; `session-y` gets a genuine
  `sessionDeleteEqGtSelect` and NO `cancelEq`; the overall promise resolves.

**Branch D's and Branch F's independence assertions, called out explicitly:** both assert, identically
in shape, (i) the cancel-entry array equals exactly one entry for X and never includes Y, (ii) Y's own
delete chain was genuinely invoked (`sessionDeleteEqGtSelect` logged for Y) and Y never appears in any
`cancelEq`, (iii) no `cancelBatchIn` entry ever appears (ruling out "a batch call covering both" for
either trigger), and (iv) the overall save resolves. The only difference between the two tests is the
`deleteOutcomeById` value for X (`'23503'` vs `'zero'`) — proving the two triggers now produce
identical, identically-visible outcomes per D016 §5/Q5.

**Full four-deep chain coverage, confirmed by mutation** (packet's own two named mutations for Branch
F, both applied and reverted live against the real source during this work, not merely reasoned about):

1. Dropped `.select('id')` from `deleteSessionIfStillFuture` (`loaders/meetings.ts`) — ran
   `npm test -- --run src/pages/meetings/MeetingsList.test.tsx -t AC9`: **5 of 6 branch tests went
   RED** (A, C, D, E, F — the mutation's blast radius is broader than Branch F alone, since Branch A's
   own chain-depth assertion and Branch C's own delete-reached assertion are equally sensitive to it;
   Branch B is unaffected, correctly, since it never reaches the delete path). Branch D's and F's own
   failures were exactly the packet's own predicted shape: `cancelEq` fired for BOTH `session-x` AND
   `session-y` (X is still canceled — that assertion alone would still pass — but "X ONLY" and "Y
   receives NO update call" both failed, matching the packet's own warning not to read a passing
   "X is canceled" as this mutation having no effect).
2. Reverted (1), then dropped the `(deletedRows ?? []).length === 0` routing check entirely — re-ran
   the same command: **exactly Branch F went RED** (`cancelEntries` was `[]`, not
   `[{ cancelEq: 'session-x' }]`), all other five branches stayed green. Then reverted this mutation
   too; `git diff eaa9070 -- src/lib/supabase/loaders/meetings.ts` was inspected afterward to confirm
   the file returned to its intended, committed-in-this-session state (both temporary mutations were
   applied via a saved-and-restored copy of the file, never left in place).

## Baseline SHA and before/after totals

Baseline SHA: `eaa907092c35a23c8634c6ab0e31ba567a6d319e`.

**Lint** (`npm run lint`): baseline `0 errors, 366 warnings`; after this task `0 errors, 370 warnings`
— both `EXIT:0`. The +4 delta is entirely `react-refresh/only-export-components` on
`ScheduleMeetingsDialog.tsx`'s four newly-exported pure functions/consts (`isMeetingSessionReconcilable`,
`computeMeetingSeriesReconcilePlan`, `buildEditConfirmationDescription`, `defaultOnSaveMeetingSeries`)
— the identical warning category that file's own pre-existing create-mode pure exports (e.g.
`generateSingleSessionDates`, `resolveTeamScope`) already carried before this task; no new warning
category, no error.

**Vitest** (`npm test -- --run`): baseline `81 files / 2055 tests`, all passed; after this task
`81 files / 2087 tests`, all passed (`EXIT:0` both). File count is UNCHANGED (no new test file was
added — every new test lives in an already-existing, already-Allowed test file). The +32 test delta:
`MeetingsList.test.tsx` 88 → 95 (+7: 1 AC8 test + 6 AC9 branch tests; the one Grant A replacement is a
1-for-1 swap, net 0); `ScheduleMeetingsDialog.test.tsx` 31 → 56 (+25: 1 edit-mode `computeConfirmLabel`
test, 4 `isMeetingSessionReconcilable` tests, 9 `computeMeetingSeriesReconcilePlan` tests, 2 duplicate-
`session_date` tests, 2 `buildEditConfirmationDescription` tests, 7 edit-mode component tests).

## Commands run (§7/§8), exit codes captured on the bare command, never through a pipe

```
npm run typecheck; echo "EXIT:$?"        -> EXIT:0
npm run format:check; echo "EXIT:$?"     -> EXIT:0 (after one `prettier --write` pass on the 4 files
                                             it flagged; re-checked clean afterward)
npm run lint; echo "EXIT:$?"             -> EXIT:0 (0 errors, 370 warnings; see above)
npm test -- --run; echo "EXIT:$?"        -> EXIT:0 (81 files / 2087 tests passed)
```

All four were run as bare commands with `echo "EXIT:$?"` immediately after — never piped through
`tail`/`grep` for the exit-code check itself (output was separately captured to scratch log files for
inspection, but the reported exit code above is always the bare command's own `$?`).

## Grant A — the six required properties, and the mutation used for property 6

Replaces the old test at `MeetingsList.test.tsx` (previously `:1082-1095`,
`'Edit shows an honest stub explaining the dialog has no edit mode (not the old misleading copy)'`)
with `'T510: Edit opens the real dialog in edit mode, prefilled from the clicked row (not the old
stub)'`, per the boss ruling cited in the packet (`auto-mode-decisions.md`, "2026-08-06 — Boss ruling
(constitution item 10)").

1. **Real accessible name.** Finds the Edit control via
   `btn.getAttribute('aria-label')?.startsWith('Edit – Weekly Build Meeting')` (en dash) — the same
   lookup the T135 rewrite already established.
2. **Prefill, not presence.** Asserts `findEditDialogElement()?.hasAttribute('open')` is `true` where
   `findEditDialogElement` locates the `<dialog>` containing `'Edit meeting series'`, AND asserts
   `Title`'s and `Location`'s own `.value` equal the clicked row's real values (`'Weekly Build
   Meeting'` / `'Robotics Lab'`, from `FIXTURE_EVENTS`'s `event-weekly-build`).
3. **Negative space, widened by one.** Asserts `container.textContent` does NOT contain
   `"Editing an existing meeting isn't supported yet"` and does NOT contain `'not built yet'`.
4. **Inherits the stub's real duty.** Asserts `onCreateMeetings` (injected as a `vi.fn()`) is NOT
   called by the edit interaction.
5. **No net loss.** One `it` replaced by one `it` — file test count is UNCHANGED by this specific swap
   (88 baseline test-file total minus this one plus its replacement = 88; the file's overall +7 comes
   entirely from the new AC8/AC9 additions, never from this swap). The provenance comment above the
   test is re-derived (T096/T135's own history is KEPT, a "T510 UPDATE" paragraph appended citing the
   boss ruling) — not deleted.
6. **Provably fails.** Verified live (not merely asserted): reverted `onEdit={openEditDialog}` back to
   a stub call (`onEdit={() => {}}`) at BOTH `CoachMeetingsSection` mounts inside `MeetingsList.tsx`,
   re-ran `npm test -- --run src/pages/meetings/MeetingsList.test.tsx -t "T510: Edit opens"` — the
   replacement test went RED (clicking Edit no longer opens any dialog, so the `hasAttribute('open')`
   assertion failed). Reverted the mutation immediately afterward and re-ran the full meetings suite to
   confirm green again before proceeding.

## Confirmation that Grant B's five call sites are exact and no others changed

`ScheduleMeetingsDialog.test.tsx`'s five pre-existing `computeConfirmLabel(...)` call sites (originally
`:353`, `:354`, `:355`, `:356` in the BEH-07 describe block, and `:480` inside the Weekly-recurring
disabled/enabled test) each gained a literal `false` as the new leading argument. Zero asserted
strings changed at any of the five. The MTG-02 field-order tripwire
(`describe('<ScheduleMeetingsDialog /> field order (MTG-02 / constitution item 13)', ...)`) was NOT
touched — `git diff eaa9070 -- src/pages/meetings/ScheduleMeetingsDialog.test.tsx` shows zero changed
lines inside that describe block. The four AC15-frozen `MeetingsList.test.tsx` blocks (`"Schedule
meetings" opens the real ScheduleMeetingsDialog`, the injected-`onCreateMeetings`-seam test and its
sibling, and `describe('createMeetings (T096, Trap #3 real onCreateMeetings default)', ...)`) were
likewise not touched — confirmed both by `git diff` inspection and by all of them passing unmodified in
the final test run above.

## Genuine out-of-scope defects found

None beyond what the packet itself already discloses and scopes (the D015/D016 merged residual race and
the `chicagoWallTimeToUtcIso` DST edge case — both restated in Known Risks below, per the packet's own
explicit instruction NOT to re-file either as a new item-20 deferral).

## Known Risks (restated, with this worker's own verification evidence)

1. **The D015/D016 residual race — ONE merged class, two triggers, one identical outcome.** Implemented
   exactly as specified: `deleteSessionIfStillFuture` chains `.gt('starts_at', 'now').select('id')`;
   `removeOneSession` routes BOTH an empty (`.length === 0`) result AND a caught `23503` to the same
   `cancelSession(sessionId)` fallback. Verified directly via AC9 Branch D (the `23503` trigger) and
   Branch F (the zero-row trigger) in `MeetingsList.test.tsx` — both produce identical, identically
   visible outcomes (X canceled, X only; Y genuinely deleted; the save resolves). `cancelSession` itself
   is deliberately, permanently time-UNGUARDED — verified by reading the final source
   (`loaders/meetings.ts`) directly: its own mutation function is
   `client.from('event_sessions').update({ status: 'canceled' }).eq('id', sessionId)`, no `.gt(...)`
   chained, with a code comment explaining why one must never be added. This worker did NOT add a
   symmetric time guard to it, per the packet's explicit, repeated instruction.
2. **`chicagoWallTimeToUtcIso` DST edge case** — unmodified, unexported, untouched by this task
   (confirmed: `git diff eaa9070` shows zero changed lines inside that function). AC-B1's own test
   fixture (`ScheduleMeetingsDialog.test.tsx`, the T510 edit-mode describe block) deliberately uses
   August 2026 dates at 18:00–20:00 Chicago — outside the disclosed `[02:00, 04:00)` window on the
   March 8, 2026 transition date — so the no-op proof does not exercise this pre-existing gap.
3. **Confirmation-preview vs. real-save race.** `ScheduleMeetingsDialog.tsx`'s own `handleSubmit` calls
   `computeMeetingSeriesReconcilePlan(initialData.sessions, desiredFutureSessions, new Date())` at
   confirm-click time; `makeSaveMeetingSeries`'s returned function calls the SAME pure function again
   with its OWN fresh `new Date()` at actual-save time (`loaders/meetings.ts`) — two independent clock
   reads, exactly as specified. Not unit-tested directly (it is a real-clock race, not a deterministic
   behavior), disclosed as designed.
4. **Cancel-vs-delete distinction not surfaced in the confirmation copy.** Confirmed:
   `buildEditConfirmationDescription`'s own output (tested directly, AC11/AC12) only ever states counts
   added/removed/kept plus the removed dates — it carries no field distinguishing a hard delete from an
   attendance-driven cancel-fallback, matching the packet's explicit "do not build this speculatively"
   instruction.
5. **Duplicate `session_date` among reconcilable sessions.** Verified directly against
   `computeMeetingSeriesReconcilePlan`'s own documented behavior via the two AC-Bdup tests
   (`ScheduleMeetingsDialog.test.tsx`): when the shared date IS still desired, exactly one duplicate
   lands in `toUpdate` and the other in neither list; when it is NOT desired, both duplicates land in
   `toRemove`. Not reachable via any existing UI path today (`generateCustomSessionDates` dedupes;
   `single`/`weekly` modes cannot repeat a date within one event) — disclosed for T605.

## Commit SHA (item 21) / explicit pathspecs (item 22)

**No commit was made.** The invoking instructions for this run explicitly override the packet's own
§6 text ("completion report states a commit SHA"): *"Do not commit, do not push, and do not update any
ledger or log — the orchestrator handles all of that."* This worker complied with that explicit
instruction rather than the packet's, since a direct instruction from the invoking agent about commit/
push mechanics is exactly the kind of process step packets do not themselves control and the
orchestrator does. Consequently there is no commit SHA to report, and item 22's "stage named paths
only" is the orchestrator's own responsibility at commit time — this worker's own edits are confined to
the five `src/` files named in §5 above (`git status --short` at the end of this session shows exactly
those five, plus this new output document; nothing else in the working tree is modified).

## Disputes

None filed. The packet's design, as specified, compiled, typechecked, and passed every gate; every
Acceptance Criterion in §8 was independently checkable and checked (pure-function tests for
AC2–AC7/AC-B2b/AC-B3a-c/AC-Bdup/AC11/AC12, component tests for AC-B1/AC-B2a/AC10, loader fake-client
tests for AC8/AC9, direct diff/grep checks for AC1/AC14/AC15, and the Grant A test for AC13/AC16).

One interpretive note, disclosed rather than disputed: the orchestrating instructions referenced "two
W2 files authorized for exactly one line each," which does not correspond to any section this worker
could locate in the T510 packet itself (§5's Allowed Files list is not one-line-scoped for any of its
five `src/` entries, and §9's Grant B is a five-line, not one-line, mechanical change). This worker
treated the packet's own §5/§9/AC1 text as authoritative per the explicit instruction to trust the
packet over its own reading, and did not restrict scope beyond what §5/§9 state. No dispute is filed
over this — the packet's own text was unambiguous and was followed exactly.
