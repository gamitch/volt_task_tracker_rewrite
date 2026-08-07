# Worker Packet: T611 — stop a series edit from silently rewriting per-session meeting times

**Packet v4 — DISPATCHED, with four post-DISPATCH touch-ups.** The D017 ruling-6 conformance instrument
(§0.3) returned **DISPATCH** on v3, all six questions, and proved by execution that both previously-vacuous
criteria (MAJOR-A's third assertion, MAJOR-B's suffix criterion) can now actually fail: it built a faithful
implementation (62/62, all five §5 criteria green), re-ran round 2's own MAJOR-A mutation and watched
assertion 3 alone redden while 1-2 stayed green, and separately reddened the suffix criterion with D017
4(b)'s named mutation. It also re-ran everything under `T613`'s now-merged clock pin: still 62/62, still
reddens correctly. **This v4 revision is four one-line corrections plus the required updates from two
findings the conformance check made independently of the four (a stale-but-harmless second-party
recommendation that had not actually been filed; two citations orphaned by `T613`'s own merge) — it does
not reopen anything Q1-Q6 already cleared, and the diff stays confined to exactly those corrections.**
Item 19a's two `checker-premise`
rounds are spent (round 1: REVISE, 1 BLOCKER/4 MAJOR/7 minor-or-NIT — 12 findings total, corrected below,
not "6 minor/NIT" as v2's header miscounted; round 2: REVISE, 3 MAJOR/2 MINOR, **no BLOCKER**). Per item
19a's literal text a third REVISE escalates to the human owner, but a third round never ran — the gate
rounds ended at round 2, and the escalation went to `boss-arbiter` instead, under the same D015/D016
instrument (`dispute-log.md` **D017**, filed and ruled 2026-08-06; dated entry in
`auto-mode-decisions.md`, "2026-08-06 — D017: ..."). **D017 authorizes exactly one more revision (this
one) and forbids it from reopening anything settled by rounds 1-2** — see §0 for the full disposition of
both rounds plus D017's ruling 4(a)-(f), which this v3 implements point for point. **No third premise round
runs.** What runs next is a **fresh conformance-only `checker-premise` instance** (a different instance
from either prior one, per D017 ruling 6) answering six narrow questions (Q1-Q6, mapped to this packet in
§0.3) — DISPATCH on all six satisfies Definition of Ready item 1; REVISE returns to `boss-arbiter`, not into
a further loop.

Round 2's own headline finding, preserved here rather than re-litigated: **the core §3 fix genuinely
prevents the regression** — round 2 built the entire §3 prescription in an isolated worktree and ran it:
typecheck 0, full suite **2095/2095**, the dialog's own test file **64 passing (57 existing unmodified + 7
new)**, and the §6 mutation reddening with a real assertion failure (`AssertionError: expected 1790024400000
to be 1790031600000`). **D017 confirms this is settled and forbids v3 from touching §1-§3's design, §6, the
tier, the model, or the T611-before-T605 ordering** — the gap round 2 found is verification coverage, not
mechanism, and that is all v3 closes.

**Row:** T611 (`task-ledger.md`, filed 2026-08-06) · **Tier: HEAVY** (constitution item 26 — see §0.4 for
the full justification; **confirmed exact by round 1, re-confirmed settled by D017, not reopened**) ·
**Worker model: sonnet** (default — none of item 18's four opus triggers fire: no migration, no RLS/
`security definer` change, no metric-SQL view, no auth/session/role logic; item 25's second obligation also
applies — "silent data loss" sounds serious but is not on item 18's trigger list, so this does not get
bumped to opus on vibes). **Branch:** `claude/w3-meeting-workflow-0bl669`, HEAD `b6870ab`. This machine
holds **W1 + W3**.

**Dispatch precondition, new in v3 (D017 ruling 4(c)/5) — SATISFIED, confirmed against the ledger, not
relayed.** `task-ledger.md`'s **T613** row: "✅ MERGED 2026-08-06 — PR #110" — pins a Date-only fake clock
in `ScheduleMeetingsDialog.test.tsx` to quarantine a real calendar fuse in that file's own existing fixtures
(§5/§9 below have the full detail; corrected here from an earlier "§4," the same wrong-section citation
fixed in §0.3/§9 during this touch-up pass). **This precondition is now met** — re-confirm §8's baseline
(`npm test` full-suite exit code) is still green before proceeding regardless, since the fuse fix touched
this packet's own Allowed test file and its baseline is not assumed stable across that merge, it is
re-checked.

**Ledger "Deps" column reads `T605` — this is provenance, not a blocking prerequisite, and the two must
not be conflated.** T611 was *found by* T605's foreman and *confirmed by* T605's own `checker-premise`
round 1 (see §1.1's independent corroboration) — that is what the Deps cell is recording. **T605 is now at
v3, FINAL (`checker-premise` round 2: DISPATCH)** — not v2/not-yet-dispatched, which is what v1 of this
packet said and round 1 correctly flagged as stale. v3 makes **T611 a hard, owner-ruled blocking dependency
of T605's own dispatch**: per `docs/swarm/active/T605-worker-packet.md`'s own header, "T605 does not
dispatch to a worker until T611 has merged." This packet still does not require T605 to exist, does not
touch any file T605's own packet claims, and constructs its trigger state entirely through fixtures (§4)
rather than through any UI T605 would build.

**Ordering authority — corrected, not asserted (round 1's MAJOR-3).** v1 of this packet stated, in this
document's own voice, "the owner has ordered this row ahead of T605," with nothing behind it — round 1
measured that `T611` appeared **zero** times across `auto-mode-decisions.md`, `verification-log.md`, and
`dispute-log.md`, and correctly invoked this project's own standing rule that an agent-authored doc
asserting owner authorization is not itself owner consent. That gap is now closed, by the coordinator, not
by this foreman re-asserting itself: `auto-mode-decisions.md`, section **"2026-08-06 — George orders T611
ahead of T605,"** records his verbatim instruction — *"do T611 next, it needs to land before T605"* — plus
the merits reasoning independent of who asked. **Cite that section going forward; this document does not
restate the authorization as its own claim.**

**The D017 ruling-6 conformance instrument has already run and returned DISPATCH on v3, all six questions
(§0.3) — this is not pending.** It was not self-certified by the foreman that wrote v3; a fresh
`checker-premise` instance ran it, and proved by execution (not just review) that both previously-vacuous
criteria can now fail — see the top of this header for the specifics. **Both dispatch conditions are now
satisfied: the conformance DISPATCH, and `T613`'s merge** (header's "Dispatch precondition" paragraph,
confirmed against the ledger). This v4 layer is four accuracy touch-ups on top of the already-DISPATCHed
v3 content, requested by whoever ran that conformance check, before handoff to a worker — it does not
reopen the conformance result. A separate `checker-reviewer` round is still commissioned after the worker's
own diff exists — do not write that packet now and do not treat its absence here as this task being
unchecked.

---

## 0. Gate History — Round 1, Round 2, and D017

### 0.1 Round 1 (`checker-premise`) disposition — closed by v2, not reopened here

Round 1 ran §3's fix for real, in an isolated worktree — not merely reviewed it — and confirmed the
approach works (restated in the header). Two prescriptions could not be built as written and one rationale
was factually wrong about the vendor `TimeInput` component; all three were fixed in v2, plus seven
minor/NIT items (**12 findings total** — v2's own header said "6 minor/NIT," which undercounted the table
below by one; corrected in this header, not reopened as substance). Nothing marked "confirmed exact, not
reopened" below is revisited in this revision.

| # | Severity | Finding (short) | Disposition in v2 |
|---|---|---|---|
| B1 | BLOCKER | §5's clearing test cannot pass as written — `TimeInput` fires `onChange(undefined)` **only** from `handleBlur` (`TimeInput.js:215-227`); a change-to-empty calls `handleInputChange` (`:187-201`), which runs `parseTimeInput('')` → `null` and never reaches `fireChange`. Measured: `disabled=false` after change-to-empty, `disabled=true` only after a real focusout. The Title-field precedent §5 cited is a different component (`TextInput` fires on `input` alone) | **Fixed (§5, §7).** The clearing test now requires an explicit blur/focusout dispatch after emptying the pending input, via a new `blurInput` test helper (added to Allowed, §7). The false "mirrors the Title-clearing test" framing is removed. §3.4's "cover it with a component test, not a new exported pure function" is **kept**, now correct because the mechanism is. |
| M1 | MAJOR | §3.4's stated reason for choosing interaction-tracking over value-comparison — "re-typing the identical value would silently reintroduce the bug" — is false. `TimeInput.js:198`'s own `parsed !== value` guard already makes an identical retype a no-op **inside the vendor component**; the event never reaches this dialog. The behavior §3.4 promised was unreachable without ejecting `TimeInput` | **Fixed (§3.4).** Rationale rewritten to the true reason (interaction-tracking is trivially testable; the vendor's own guard is what makes a same-value retype a genuine no-op, not this dialog's design). Two measured consequences are now disclosed rather than left silent: change-then-change-back latches the flag and clobbers anyway; touching only Start rewrites both fields for every session. |
| M2 | MAJOR | §7 closed `ScheduleMeetingsDialog.tsx` to "every other line stays byte-identical," but §3.6 requires editing the `buildEditConfirmationDescription` call site (the `AlertDialog`'s `description` prop, ~`:1196`) — `MeetingSeriesReconcilePlan.toUpdate` (`:570`) carries only the *desired* session, so the original time cannot be derived from `plan` alone at that site | **Fixed (§3.6, §7).** The `AlertDialog` `description` call site is now named Allowed explicitly. Per the gate's own cheaper-path instruction: the suffix is computed at that call site from the component's own `timeFieldsTouched` state, already in scope there — **no new field is threaded through `PendingEditSave`**, since that state is not reset between submit and confirm and needs no snapshot. |
| M3 | MAJOR | Line 18's "the owner has ordered this row ahead of T605" was an unsourced claim in this document's own voice — `T611` appeared zero times in the decision/verification/dispute logs at gate time | **Fixed, sourced to the coordinator's own record, not re-asserted by this foreman.** Header now cites `auto-mode-decisions.md`, "2026-08-06 — George orders T611 ahead of T605," verbatim ("do T611 next, it needs to land before T605"), and states plainly that the citation — not this document — is the source of authority. |
| M4 | MAJOR | §4's fixture (`starts_at: '2026-08-10T21:00:00.000Z'`) sits 4 days from today (2026-08-06); `isMeetingSessionReconcilable` compares against a real `new Date()` and this test file installs no fake clock, so the fixture stops being reconcilable after 2026-08-10 and the regression test (plus §6's replay) breaks for reasons unrelated to the fix | **Fixed (§4), and strengthened beyond the literal ask.** Both new fixture sessions move to 2026-09-xx (same CDT regime, same wall times as originally chosen). Additionally, this revision stops pairing the new fixture with `RECONCILABLE_SESSION_B` (itself only ~11 days out) for this specific test, so the new coverage carries no inherited expiry risk from a pre-existing fixture either — disclosed as a self-imposed safety margin, not something round 1 asked for by name. |
| m1 | MINOR | §3.2's third bullet claimed the "opens prefilled" test already covers the time derivation — false; that test asserts Title/Location/Description/disclosure/confirm-label only, nothing about times | **Fixed (§3.2).** Bullet removed; the argument stands on the remaining two. |
| m2 | MINOR | §3.5 attributed handleSubmit's own `:925` comment ("extra guard; the button is already natively disabled") to `buildEventSessionsPayload`, whose own guard is `:481` | **Fixed (§3.5).** Citation corrected to `:481` (`buildEventSessionsPayload`'s own early return on an unset time). |
| m3 | MINOR | §5's disclosure-visibility bullet let a worker satisfy it without ever exercising the touched flag (an "either/or" framing between two coverage options) | **Fixed (§5).** The after-touch negative is now a separate, mandatory assertion, not one arm of an alternation. |
| m4 | MINOR | §4/§5 fixture times are written in 24-hour ISO, but `TimeInput` renders 12-hour by default (`formatDisplayTime12h`, e.g. "4:00 PM") | **Fixed (§4, §5).** Both sections now say so explicitly, so a worker asserting on a rendered `<input>` value is not chasing a 24-hour string that never appears in the DOM. |
| m5 | MINOR | §3.4 described the flag reset as living in "both branches" of `resetForm()` — it is one line, in the single shared reset point after the if/else | **Fixed (§3.4).** Wording corrected to name the single shared reset point. |
| m6 | MINOR | Worker needs a lint baseline for §8's comparison | **Added**, sourced to this gate round's own measurement, not re-derived here: 370 warnings / 0 errors baseline, 372 after a faithful §3 implementation (§8). |
| NIT | NIT | Header described T605 as "v2, not yet dispatched" — stale; v3 is FINAL/DISPATCH | **Fixed** (header, above). |

**Also adopted, non-binding implementation guidance from round 1 ("also worth taking"):** reuse this file's
own `formatChicagoWallTime` (`:694`, unexported — implement the divergence check in the same file rather
than exporting it elsewhere) for the divergence comparison in §3.3, and compute `originalTimesByDate`
together with the divergence boolean in one `useMemo` over `initialData`, the same way `resetForm()`
already computes (and currently discards) the reconcilable filter at `:806-808`. Both are suggestions, not
acceptance criteria — the worker may implement differently provided §3's observable behavior holds.

### 0.2 Round 2 (`checker-premise`) disposition and boss-arbiter ruling D017 — closed by v3

Round 2 **built and ran the entire v2 §3 prescription** in its own isolated worktree (item 23) — the
strongest form of verification this project has — and confirmed it works exactly as designed (header).
What it found was three MAJORs and two MINORs in the *verification coverage* v2 wrote around that working
mechanism, plus four NITs. Zero BLOCKERs. Round 2 itself judged the residue "worth one more revision rather
than a worker's first attempt," and because this was the *second* REVISE, item 19a's two rounds were spent
— the orchestrator escalated to `boss-arbiter` rather than looping a third gate round, exactly as item 19a's
text requires. **`boss-arbiter` ruling D017** (`dispute-log.md`) confirmed all three MAJORs and both MINORs,
replicating MAJOR-C independently in its own worktree before ruling (not taken from either side), and
authorized this one closure revision under the same instrument D015/D016 already established. Full ruling
text: `dispute-log.md` **D017**; dated summary: `auto-mode-decisions.md`, "2026-08-06 — D017: ...".

| # | Severity | Finding (short) | D017 ruling | Disposition in v3 |
|---|---|---|---|---|
| MAJOR-A | MAJOR | v2 §5's disclosure criterion asserts the §3.3 warning present on a divergent fixture and absent after touching it, but never absent on a *non-divergent* series — round 2 proved the gap by deleting the divergence term entirely (warning renders unconditionally); all 66 tests still passed | Confirmed by reading v2 §5 directly; ruling 4(a) | §5 gains a **third, mandatory** assertion: rendering the unmodified `EDIT_INITIAL_DATA` fixture (three sessions, one shared 18:00–20:00 CDT wall time by construction) with zero time-field interaction shows the §3.3 disclosure **absent**. All three assertions together are now stated as jointly required, not satisfiable by the divergent pair alone. v2's own steer away from `EDIT_INITIAL_DATA` for this purpose is corrected — that fixture is now named and required for this specific assertion. |
| MAJOR-B | MAJOR | v2 §3.3 item 2 / §3.6 mandate an additive second parameter on `buildEditConfirmationDescription` so an overwrite gets disclosed, but no §5 criterion tests the resulting suffix — the only existing tests of that function are one-argument calls, so the new parameter's only verified property is that it is inert | Confirmed by reading v2 §5 against §3.3/§3.6; ruling 4(b) | §5 gains two required criteria: (i) **component-level, at the real `AlertDialog` call site** — with the §4 divergent fixtures and a touched time field, the rendered confirmation description contains wording stating session times will be overwritten, proven by a **named red mutation** (e.g. reverting the call site to one argument, or hardcoding the suffix off); (ii) the untouched path reproduces today's exact one-argument output byte-for-byte (may be asserted at the two-argument call with the flag `false`; AC11/AC12 remain the untouched one-argument proof and are not edited). |
| MAJOR-C | MAJOR | `RECONCILABLE_SESSION_A.startsAt` (`2026-08-10T23:00:00.000Z`) is 4 days from 2026-08-06; three currently-green tests — including `AC-B1`, which v2 §5 told the worker to leave alone — go red on 2026-08-11 for purely calendar reasons, tripping v2 §9's stop-and-escalate on a worker who did nothing wrong | Confirmed and **independently replicated** by `boss-arbiter` in its own worktree with an opt-in Date-only fake clock (`2026-08-10T22:00:00Z` → 57/57; `2026-08-11T00:00:00Z` → 3 failed/54 passed, the exact three named); ruling 4(c) + ruling 5 | §5/§9 name `RECONCILABLE_SESSION_A`/`_B` and their real dates, cite D017 directly, list the three affected tests by name, and state the merge-before-dispatch precondition (header, above). **This packet does not prescribe or attempt the fixture fix** — D017 assigned that to a separate FAST-tier task, now filed and merged as **T613**, and forbids this row from touching `RECONCILABLE_SESSION_A`/`_B`. (Corrected in this touch-up pass: v3's own §4 still carried the vague "pre-existing condition in other already-passing tests" phrasing this cell claimed was dropped, and pointed to "§4" for the full detail when the disclosure actually landed in §5 — both fixed; this cell previously overstated what had landed.) |
| MINOR-D | MINOR (D017: "MAJOR-shaped, not re-graded because it lands in v3 either way") | v2 §7's Allowed enumeration for `ScheduleMeetingsDialog.tsx` never names `buildEditConfirmationDescription`'s own definition (`:716-723`), while §3.6 mandates changing its signature — the packet forbade an edit it required | Confirmed by reading; ruling 4(d) | §7's Allowed bullet now lists `:716-723` explicitly. |
| MINOR-E | MINOR | Touching only Start time can persist an **inverted span** (end before start) — measured with the §4 fixtures: `2026-09-21` came out `startsAt 2026-09-22T00:00:00.000Z` / `endsAt 2026-09-21T22:30:00.000Z`. Pre-existing (no `min` on the End `TimeInput`; today's shipped code inverts identically) and not this row's defect to fix, but undisclosed on a HEAVY silent-data-loss row | Confirmed; ruling 4(e) | §3.4's consequences list gains this as a third, explicitly pre-existing/out-of-scope disclosure, now citing **`T614`, filed**. (Corrected in this touch-up pass: v3 only *recommended* a filing and assigned it to the orchestrator; the conformance check found neither this foreman nor the coordinator had actually filed it — it caught this by checking whether the row existed, not whether the packet promised one. This cell, and §3.4 itself, previously overstated that as done.) |
| NIT | NIT | §3.5 cited `:951` as "create mode's own call" to `buildEventSessionsPayload` — `:951` is actually the *consumption* site (`sessions: sessionsPayload` inside the create payload); the real call is `:869` (the `sessionsPayload` `useMemo`) | — | **Fixed (§3.5).** Citation corrected to `:869`, with `:951` now named separately as the consumption site. |
| NIT | NIT | §7's Allowed bullet cited "doc-comment updates named in §3.5/§9" — §9 contains no doc-comment instruction, only the existing-tests stop condition | — | **Fixed (§7).** Reference narrowed to §3.5 alone. |
| NIT | NIT | v2's header tally said "6 minor/NIT" against a 12-row §0.1 table (7 minor/NIT rows) | — | **Fixed** (§0.1 above, and this header). |
| NIT | NIT | §1 said T609 "merged (12 lines inserted)" — the real diff is 14 insertions(+), 3 deletions(-) | — | **Fixed (§1).** |

**D017's own framing of what is settled, quoted because it governs this revision's scope:** *"What is
settled stays settled... the design (option 2, interaction-tracking), the HEAVY tier, the sonnet worker, the
T611-before-T605 ordering..., and the no-change findings on `computeMeetingSeriesReconcilePlan`,
`loaders/meetings.ts`, and `MeetingsList.tsx` are all confirmed by execution or byte-exact comparison. None
of it is reopened by this entry, and v3 may not touch it."* Nothing in this v3 revision touches §1, §2, §3's
design (only the listed disclosures/citations in 3.4/3.5), or §6.

### 0.3 D017 ruling 6 — conformance map (Q1-Q6), for the fresh gate instance

D017 charters a fresh `checker-premise` instance to run a **conformance-only** check (not a third premise
round) against exactly six questions. Mapped here so that check is quick and unambiguous, per the ruling's
own instruction:

- **Q1** (ruling 4(a): non-divergent absence assertion present and mandatory) → §5, the new third
  disclosure bullet using `EDIT_INITIAL_DATA`.
- **Q2** (ruling 4(b): two suffix criteria present, (i) at the real call site with a named red mutation) →
  §5's new "confirmation suffix" bullets, plus §6's second named mutation.
- **Q3** (ruling 4(c): fuse disclosure and merge-before-dispatch precondition present) → header's
  "Dispatch precondition" paragraph, §5's dedicated fuse note (not §4 — corrected below), §9's
  pre-authorization restatement.
- **Q4** (ruling 4(d): Allowed-list clause present) → §7's Allowed bullet, now including `:716-723`.
- **Q5** (ruling 4(e): disclosure present and item-20 row filed) → §3.4's third consequence, citing the
  now-filed **T614** (this §0.2 table's MINOR-E row records that neither v3's recommendation nor the
  coordinator's relay had actually filed it, until the conformance check caught the gap).
- **Q6** (ruling 4(f): v2→v3 diff confined to (a)-(e) plus mechanical §0/cross-reference updates) → this
  §0's own two disposition tables, which enumerate every change; nothing outside them, §3.4's third
  consequence, §3.5's citation fix, §4, §5, §6's second mutation, §7, and §9 moved in this revision.

---

## 0.4 Tier — stated and defended, not asserted

**HEAVY**, per item 26's own test: *"can a mistake here corrupt data, or lie to a user about their own
data?"* — yes on both halves. A mistake in this fix's logic changes what `desiredFutureSessions` carries
into `onSaveMeetingSeries` → `makeSaveMeetingSeries` → `updateSessionTime`
(`src/lib/supabase/loaders/meetings.ts:698-708`), a real `update event_sessions set starts_at = …, ends_at
= …` against production Postgres. The row is filed as "Defect (silent data loss, cross-row interaction)" —
the same class item 26 names T305 and T189 for: **"invisible to reading the code,"** proven only by running
a fixture that actually diverges, which is exactly what §4-§6 below require.

This is HEAVY even though, as verified in §2, **no line in `src/lib/supabase/loaders/meetings.ts` needs to
change.** Item 26's trigger is "touches a write path," not "edits the file containing the mutation call" —
the defect corrupts data that a real `UPDATE` statement will faithfully persist; the fact that the bug lives
one file upstream of that statement does not make it safer to under-process. Do not let "the loader is
unchanged" become an argument for downgrading tier — it is exactly why the loader is Forbidden (§7), not
why this task is lighter.

**Worker model: sonnet.** Confirmed against item 18's four triggers — none apply (no
`supabase/migrations/`, no RLS/`security definer`, no metric SQL view, no auth/session/role logic). Item 25
is on point: do not bump to opus because "data loss" sounds sensitive.

---

## 1. The defect, re-verified against the live tree at `b6870ab` (not relayed from the ledger)

The ledger row's five citations were written against `4ee5c02`, and T609 has since merged (a 14
insertions(+)/3 deletions(-) diff at the Notes-field gate — corrected here per round 2's own measurement;
this document previously said "12 lines inserted"). **Re-verified directly against `b6870ab` below — all
five sit above T609's insertion point (`:1142`) and are confirmed byte-identical, not merely re-trusted.**

### 1.1 `resetForm()` derives ONE `startTime`/`endTime` from the earliest reconcilable session

`src/pages/meetings/ScheduleMeetingsDialog.tsx:811-827` (exact, current content):

```tsx
      // `startTime`/`endTime` are DERIVED here, not read off `initialData` (that
      // interface deliberately carries no `startTime`/`endTime` fields -- see its
      // own doc comment): the earliest-`startsAt` reconcilable session's own wall
      // time, or this file's existing `DEFAULT_START_TIME`/`DEFAULT_END_TIME` for
      // a fully-past series (none reconcilable).
      const earliest = reconcilableSessions
        .slice()
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
      if (earliest !== undefined) {
        setStartTime(
          createISOTimeString(formatChicagoWallTime(earliest.startsAt)) ?? DEFAULT_START_TIME,
        );
        setEndTime(createISOTimeString(formatChicagoWallTime(earliest.endsAt)) ?? DEFAULT_END_TIME);
      } else {
        setStartTime(DEFAULT_START_TIME);
        setEndTime(DEFAULT_END_TIME);
      }
```

### 1.2 `handleSubmit`'s edit branch applies that ONE time to every date

`:932` (exact):

```tsx
      const desiredFutureSessions = buildEventSessionsPayload(sessionDates, startTime, endTime, '');
```

`buildEventSessionsPayload` (`:475-488`) maps a single `startTime`/`endTime` pair across every date in
`dates` — there is no per-date time input anywhere in this call.

### 1.3 `isValid` in edit mode is `title.trim() !== ''` alone

`:879-881` (exact):

```tsx
  const isValid = isEditMode
    ? title.trim() !== ''
    : title.trim() !== '' && sessionsPayload.length > 0;
```

### 1.4 `buildEditConfirmationDescription` reports counts only, never a time diff

`:716-723` (exact):

```tsx
export function buildEditConfirmationDescription(plan: MeetingSeriesReconcilePlan): string {
  const base = `${plan.toInsert.length} session(s) added · ${plan.toRemove.length} session(s) removed · ${plan.toUpdate.length} session(s) kept.`;
  if (plan.toRemove.length === 0) return base;
  const removedDates = plan.toRemove
    .map((item) => WEEKDAY_DATE_FORMATTER.format(parseDateOnly(item.sessionDate)))
    .join(', ');
  return `${base} Removed: ${removedDates}.`;
}
```

Nothing here reads `session.startsAt`/`session.endsAt` at all — a save that silently rewrites every
session's time produces the exact same string as one that changes nothing.

### 1.5 The doc comment that predicted this, for the symmetric field (`session_date`, not time)

`:598-612` (exact, unchanged, **must stay unchanged — see §7**):

```
 * **Duplicate `session_date` among reconcilable sessions** -- not possible
 * via any existing create-mode path today (`generateCustomSessionDates`
 * dedupes; `single`/`weekly` modes cannot repeat a date within one event),
 * so this is a disclosed limitation for whoever builds T605 next (per-
 * session date edits are where a genuine duplicate could first appear):
 *   - If the shared date IS still desired: `toUpdate`'s `Map`-keyed lookup
 *     (`reconcilableByDate`) silently picks ONE of the duplicates (last
 *     one inserted into the `Map` wins); the other is excluded from every
 *     list -- neither updated nor removed, silently orphaned as a stale
 *     `'scheduled'` row.
 *   - If the shared date is NOT desired: `toRemove` is built by filtering
 *     the raw `reconcilable` ARRAY (never the date-keyed `Map`), so **both**
 *     duplicates independently satisfy the filter and **both** are removed.
 *   T605 must revisit this the moment per-session date edits make
 *   duplicates reachable.
```

This is the same root cause (a series-shaped model applied to per-session data) on the opposite field
(`session_date` there, `starts_at`/`ends_at` here). **Do not fold a fix for this into your work** — it
describes a different, still-open problem that is explicitly T605's, not T611's.

**Independent corroboration, not just this ledger row:** T605's own `checker-premise` round 1 (a live-cluster
gate, `docs/swarm/active/T605-worker-packet.md` §0, finding **M3**) independently found and confirmed the
identical citations (`:811-827`, `:932`, `:879-881`) against `4ee5c02`, and ruled explicitly that
"the real fix lives entirely inside `ScheduleMeetingsDialog.tsx`'s already-arbitrated (D015/D016) territory,
which is Forbidden [to T605's worker]." This packet is that fix.

---

## 2. What does NOT need to change — verified, not assumed

### 2.1 `computeMeetingSeriesReconcilePlan` (`:614-640`) is already correct and must not change

Read in full. It matches `desiredFutureSessions` to `existingSessions` **purely by `sessionDate` string
equality** and carries whatever `session.startsAt`/`session.endsAt` each desired item already has straight
into `toUpdate` (`:628-633`):

```tsx
  const toUpdate = desiredFuture
    .filter((s) => reconcilableByDate.has(s.sessionDate))
    .map((s) => ({
      sessionId: (reconcilableByDate.get(s.sessionDate) as ExistingMeetingSeriesSession).sessionId,
      session: s,
    }));
```

It never reads or compares a *previous* time — it has no opinion on where `s.startsAt` came from. Given a
`desiredFutureSessions` array whose entries genuinely diverge, this function already reconciles them
correctly today. **The defect is entirely upstream, in how the dialog builds that array.** Do not touch this
function. Your own diff must show it byte-identical (§8).

### 2.2 `loaders/meetings.ts`'s `updateSessionTime` is already correct and must not change

`src/lib/supabase/loaders/meetings.ts:698-708` (exact, current content):

```ts
  const updateSessionTime = runMutation<
    { sessionId: string; session: CreateMeetingsSessionPayload },
    void
  >(
    (client, args) =>
      client
        .from('event_sessions')
        .update({ starts_at: args.session.startsAt, ends_at: args.session.endsAt })
        .eq('id', args.sessionId),
    getClient,
  );
```

and it is invoked per-item, not once for the whole plan (`:839`):

```ts
    await Promise.all(plan.toUpdate.map((item) => updateSessionTime(item)));
```

**This already writes each `toUpdate` item's OWN `session.startsAt`/`session.endsAt`.** It has supported
genuinely divergent per-session times since it was written — nothing here forces uniformity. The uniformity
is manufactured earlier, by `ScheduleMeetingsDialog.tsx` always handing it a `desiredFutureSessions` array
where every entry was computed from the same two shared `startTime`/`endTime` values. **`loaders/meetings.ts`
does not change, and does not need to.** This is answered explicitly because the row asked for it by name:
the fix is **entirely a dialog-side fix.** `loaders/meetings.ts` is Forbidden (§7) precisely because nothing
in it is wrong.

### 2.3 No new write sequence, so no new partial-failure question

This fix changes only the **content** of a value (`desiredFutureSessions`) computed client-side, before any
network call. It introduces no new mutation, no new ordering of existing mutations, and no new sequential
write pair. `makeSaveMeetingSeries`'s existing disclosed partial-failure risks (D015/D016, the events-then-
sessions non-atomicity) are untouched and out of this task's scope. State this explicitly in your own output
rather than silently — "no new write sequence; N/A" is a real, checkable answer, not an omission.

---

## 3. Design decision — chosen, and why the alternative was rejected

Two shapes were sketched in the ledger row. **Chosen: refuse to rewrite a session's time unless the coach
affirmatively edited the shared time fields during this edit session** (option 2). Rejected: carrying a
fully independent per-session time *through the UI* (option 1, in the sense of building per-row time
inputs) — reasons below.

### 3.1 Why not option 1 (full per-session time UI)

T605's own ledger row is titled *"Edit ONE meeting inside a series — its date, time and notes"* — building a
UI where an individual session's date/time is independently editable is **T605's named deliverable**, not
this row's. T605 is now packet v3/DISPATCH-ready but **still not dispatched to a worker** — its own header
makes dispatch conditional on this row merging first (see this packet's own header). Pre-building that UI
here would be scope creep in the direction this project has already been burned by (constitution item 20's
rationale).
There is also no way to test a full per-row UI today without first inventing UI T605 hasn't built yet —
directly contradicting "whatever you choose must be testable now, before T605 exists."

There is a second, structural reason option 1 is unreachable *as a UI concept* today: the dialog presents
exactly one shared `Start time`/`End time` `HStack` (`:1131-1139`) for the whole series. Without new per-row
inputs (T605's job), there is no affordance for a coach to specify two different desired times for two
different dates in one edit. "Carrying per-session times through the edit path" therefore reduces, absent
new UI, to internally remembering each session's own time and not overwriting it unless the coach uses the
one shared control that exists — which **is** option 2. Option 2 is not a lesser version of option 1; given
today's UI, it is the only version of option 1 that is buildable and testable without also building T605.

### 3.2 What `resetForm()` shows when reconcilable sessions disagree

**Unchanged**: still the earliest reconcilable session's own wall time (§1.1, `:811-827` stays exactly as it
is). Reasons, not just convenience:

- The `TimeInput`s carry `isRequired` (`:1132-1138`). Leaving them blank when sessions disagree would render
  as an unmet-required-field state for a form that has nothing wrong with it — worse UX than a single
  representative value, and inconsistent with DES-12 (an async screen's states must be honest, not merely
  present).
- Because of §3.3's disclosure, "one representative value is shown" is no longer a silent lie — the coach is
  told, in the same section, that sessions disagree and what leaving the field alone versus editing it each
  do.

(Round 1, m1: a third bullet here previously claimed the existing "opens prefilled..." test already covers
this derivation. **False, and removed** — that test asserts Title, Location, Description, the "already
happened" disclosure, and the confirm label; it makes no assertion about the time fields at all. The
argument above stands on the two bullets that remain.)

### 3.3 The confirmation/disclosure copy must say something when times differ — yes, in two places

1. **A new inline disclosure**, edit mode only, next to the Start/End time inputs, shown only while
   reconcilable sessions' times genuinely disagree with each other AND the coach has not yet touched either
   time field this session. Mirrors the existing "already happened" disclosure pattern exactly (`:1048-1052`,
   `Text type="supporting"` — no new Astryx prop lookup needed; `type="supporting"` is already sourced in
   this file's own module doc item 8). Suggested copy (sentence case, DES-14; refine wording if needed, but
   preserve both halves — what happens if the coach does nothing, and what happens if they type a new time):
   > "Sessions in this series currently have different times. Leave these fields unchanged to keep each
   > session's own time, or enter a new time to apply it to every upcoming session."
2. **`buildEditConfirmationDescription`** gains an **optional, additive** second parameter so a save that is
   actually about to overwrite times says so. See §3.6 for the exact backward-compatibility constraint (this
   must not break either of its two existing tests, §5).

### 3.4 "Touched" is an interaction event, not a value comparison — resolved explicitly, per the row's own question

Track a single boolean, e.g. `timeFieldsTouched`, set `true` the moment **either** the Start time or End
time `TimeInput`'s `onChange` fires (wrap `setStartTime`/`setEndTime` rather than calling them directly from
JSX), reset to `false` inside `resetForm()` — **one line**, in the single shared reset point after the
if/else (currently `setSubmitError(null); setPendingEditSave(null);`), not duplicated inside either branch
above it.

**Why interaction-based, not value-based — corrected in v2 (round 1's MAJOR-1).** v1 rejected
value-comparison on the theory that "a coach re-typing the exact value already shown would silently
reintroduce the bug." **That is false, and the claim is withdrawn.** `TimeInput`'s own `handleInputChange`
(`node_modules/@astryxdesign/core/dist/TimeInput/TimeInput.js:198`) only calls `fireChange` when `parsed !==
value` — the vendor component **already performs value-comparison itself**, before this dialog's `onChange`
prop is ever invoked. Measured directly: re-typing the identical displayed value leaves this dialog's
`timeFieldsTouched` flag unset, because the event never arrives. So the design actually shipped **is** a
value-comparison design, performed inside `TimeInput`, not an interaction-tracking design that avoids one.
The real reason to track by interaction (an `onChange` firing) rather than re-deriving a value diff in this
dialog is narrower and true: it is trivially testable, requires no re-implementation of `TimeInput`'s own
parsing/range logic, and correctly treats a change that round-trips to the *same effective value* as
"nothing to do," which is exactly what the vendor guard already gives for free.

**Three consequences of this design, measured and disclosed rather than left silent (round 1's MAJOR-1;
consequence 3 added per D017 ruling 4(e)/MINOR-E):**
1. **Change-then-change-back still latches and clobbers.** If a coach changes Start time to a new value and
   then changes it back to the original displayed value, **two** distinct `onChange` events fire (the first
   because the new value differs from the original `value`; the second because, by then, `value` itself has
   already updated to the intermediate one, so changing back differs from *that*). `timeFieldsTouched` is set
   `true` by the first event and never unset by the second — the final save still overwrites every session's
   time with the (now-restored) displayed value, even though nothing looks different on screen. This is a
   real, accepted limitation of interaction-based tracking, not a bug to fix in this task: undoing a genuine
   edit back to its starting value does not undo the fact that the coach edited the field.
2. **Touching only Start rewrites both fields for every session.** Because one shared flag covers the paired
   control (rationale below), changing Start alone and leaving End alone still applies **both** the (changed)
   Start and the (unchanged, but now "touched") End to every future session once submitted — including
   sessions whose original End time differed from what's displayed. This is the direct consequence of the
   "why one shared flag" design choice immediately below, not a separate defect; disclosing it here so it is
   a decision, not a surprise.
3. **Touching only Start can persist an inverted span (end before start) — pre-existing, not this row's to
   fix.** Measured directly against the §4 fixtures during round 2's gate: changing only Start time on the
   `2026-09-21` session produced `startsAt: '2026-09-22T00:00:00.000Z'` / `endsAt:
   '2026-09-21T22:30:00.000Z'` — an end 90 minutes *before* its own start. Root cause is unrelated to this
   task's fix: the End `TimeInput` (`:1138`) carries no `min={startTime}` today, so a coach can already
   independently set an end before a start in create mode too — this fix neither introduces nor repairs that
   gap, it only makes the same pre-existing behavior reachable via the new touched-based apply path. **Do not
   fix this in this task** — no `min` prop change, no cross-field validation is in scope here. **Filed as
   `T614`** (constitution item 20) — this packet's own v3 revision only recommended filing it and left the
   actual filing to the orchestrator; the D017-ruling-6 conformance check caught that neither had happened by
   checking whether the row existed, not whether this packet promised one. `T614` is now filed, with the
   measurement above. See §0.2's MINOR-E entry for the correction record.

**Why one shared flag, not two independent ones (Start vs. End):** `updateSessionTime` (§2.2) always writes
`starts_at` and `ends_at` together, for the same session, in the same call — there is no code path that
persists one without the other. The UI already presents them as one paired control (one `HStack`, both
`isRequired`, both derived together in `resetForm()`). Splitting the dirty-tracking in two would let a coach
end up with a session whose start comes from "touched" state and whose end comes from "untouched, preserved"
state — a span that matches neither the original schedule nor anything the coach saw on screen. One flag
avoids inventing that hybrid, unrepresentable state; consequence 2 above is the accepted cost of avoiding it.

**Consequence for `isValid`:** in edit mode, `isValid` must become `title.trim() !== '' && (!timeFieldsTouched
|| (startTime !== undefined && endTime !== undefined))`. Untouched fields never gate validity on a value
(untouched sessions reuse their own stored time regardless of what the shared fields currently display);
touched fields must still resolve to real values before the coach can save, because §3.5's resolver depends
on them for every date that needs the new value. This is a real, currently-absent edge case (today, in edit
mode, clearing the time field cannot ever disable the button) — cover it with a new component test (§5), not
a new exported pure function; the existing file tests every other edit-mode validity state (`AC-B2a`) the
same way, through the rendered button, not through a standalone `isValid` unit. **Round 1's BLOCKER-1
established that this specific test requires an explicit blur/focusout dispatch to be reachable at all —
see §5 for the corrected mechanism; this section's instruction to use a component test, not a pure function,
still stands.**

### 3.5 Required new pure, exported, independently testable function

This file's own convention (module doc item 3; `computeMeetingSeriesReconcilePlan`'s own doc: *"Pure,
exported, directly testable without a fake `SupabaseClient`"*) is: branching logic that decides what gets
persisted lives in a pure function, not inline inside a handler. Add one, alongside `buildEventSessionsPayload`
(do not modify that function — it stays exactly as-is and is still used unmodified by create mode's own call
site, `:869` (the `sessionsPayload` `useMemo`; `:951` is where that already-computed value is consumed,
`sessions: sessionsPayload`, inside the create payload — corrected here per D017's NIT, which caught this
packet citing `:951` as if it were the call site itself), and by this new function for any date needing a
freshly-computed time):

```ts
/** T611 -- for a series edit, resolves each desired date's own starts_at/ends_at. When
 * `timeFieldsTouched` is false, a date matching an existing RECONCILABLE session's own
 * `sessionDate` reuses THAT session's own starts_at/ends_at verbatim (no re-derivation,
 * no Chicago-wall-time round trip) -- preserving whatever value it already has, including
 * a value that diverges from every other session's. A date with no such match (newly
 * added), or every date once `timeFieldsTouched` is true, uses the currently displayed
 * startTime/endTime via the same chicagoWallTimeToUtcIso conversion buildEventSessionsPayload
 * already performs. Pure, exported, independently testable without a DOM -- same convention
 * computeMeetingSeriesReconcilePlan documents for itself. */
export function buildEditDesiredFutureSessions(
  dates: readonly string[],
  startTime: string | undefined,
  endTime: string | undefined,
  timeFieldsTouched: boolean,
  originalTimesByDate: ReadonlyMap<string, { startsAt: string; endsAt: string }>,
): CreateMeetingsSessionPayload[]
```

Exact name/signature is not sacred — the worker may refine it — but the decomposition itself (a pure,
exported function separate from `handleSubmit`, taking the divergent-time fixture as plain data) **is
required**, because it is what makes §4's "test it before T605 exists" instruction possible without a DOM.

`originalTimesByDate` should be built from `initialData.sessions` filtered to `isMeetingSessionReconcilable`
(the same filter `resetForm()` already applies, `:806-808`) keyed by `sessionDate` — inherits the same
last-one-wins duplicate-date behavior §1.5 already discloses for `computeMeetingSeriesReconcilePlan`'s own
`reconcilableByDate` map; do not invent new dedup handling, that is T605's territory.

`handleSubmit`'s edit branch (`:932`) becomes a call to this new function instead of a direct call to
`buildEventSessionsPayload`. Update the comment immediately above it (currently `:927-931`, "`notes` is
fixed to `''` here…") to also state, in this file's own established comment voice, why the time resolution
changed and cite this section.

**Precondition, document it on the function:** by the time `handleSubmit` calls this, §3.4's revised
`isValid` guarantees that if `timeFieldsTouched` is true, `startTime`/`endTime` are both defined — the
function does not need its own fallback-to-default branch for that case, but should not silently produce
wrong output if it is ever called outside that guarantee (e.g., drop the date rather than fabricate a
value). Mirror `buildEventSessionsPayload`'s **own** posture for this, not `handleSubmit`'s: its early
return on an unset time (`:481`, `if (startTime === undefined || endTime === undefined) return [];`,
documented as "Returns `[]` (no valid sessions) when either time is unset") is the precedent for "skip
rather than fabricate," not `handleSubmit`'s own `:925` guard comment ("extra guard; the button is already
natively disabled"), which is a different thing — a redundant belt-and-suspenders check before the handler
does anything at all, not a per-field fallback. (Round 1's m2: v1 conflated these two citations; corrected
here.)

### 3.6 `buildEditConfirmationDescription` — additive signature only, at its one real call site

Add an optional second argument (exact shape is the worker's call — e.g. a label string to append, or a
boolean plus the two new time strings) whose **absence must reproduce today's exact output, byte for byte.**
This is a hard constraint, not a suggestion — see §5's two existing tests that call this function with a
single argument.

**Where this actually gets used — named explicitly per round 1's MAJOR-2.** `buildEditConfirmationDescription`
has exactly one call site in the whole file: the `AlertDialog`'s `description` prop (currently ~`:1195-1197`,
`pendingEditSave !== null ? buildEditConfirmationDescription(pendingEditSave.plan) : ''`). `plan.toUpdate`
(`MeetingSeriesReconcilePlan`, `:570`) carries only the *desired* session for each date — it does not carry
that date's *original* time — so whether times are actually changing cannot be derived from `plan` alone at
that site. **Do not solve this by threading a new field through `PendingEditSave`.** The component's own
`timeFieldsTouched` state (§3.4) is not reset between `handleSubmit` setting `pendingEditSave` and the coach
confirming — it is only reset inside `resetForm()` — so the call site can simply read it directly:
`buildEditConfirmationDescription(pendingEditSave.plan, timeFieldsTouched)` (or whatever the worker's chosen
second-argument shape is). This is the cheaper path and the one required here: **`PendingEditSave`'s own
shape does not change.** The `AlertDialog`'s `description` prop is therefore an Allowed edit region (§7),
not a violation of "every other line stays byte-identical."

---

## 4. Constructing the currently-unreachable trigger state — say exactly how (per the row's own demand)

The UI cannot produce two sessions with genuinely different wall-clock times today (§1's own premise). Build
the trigger state as **fixture data**, the same way `ScheduleMeetingsDialog.test.tsx`'s existing
`RECONCILABLE_SESSION_A`/`RECONCILABLE_SESSION_B`/`PAST_SESSION` constants already construct
`ExistingMeetingSeriesSession` objects by hand and feed them into `initialData.sessions` — bypassing the
create flow entirely, exactly as those constants already do.

**Corrected in v2 (round 1's MAJOR-4).** v1 proposed `starts_at: '2026-08-10T21:00:00.000Z'` — 4 days from
this packet's own date (2026-08-06). `isMeetingSessionReconcilable` compares against a real `new Date()`,
and — **at the time v1/v2 were written** this test file installed no fake clock anywhere, so that fixture
would have stopped being reconcilable after 2026-08-10, breaking both the new regression test and §6's
mutation replay for a reason that had nothing to do with this fix. **This is now historical, not current:
`T613` has since merged a Date-only fake clock into this same file (full detail: §5's dedicated fuse
disclosure) — the sentence above no longer describes HEAD.** This packet's own new fixtures below still use
safely-future dates regardless, since that choice cost nothing and does not depend on `T613`'s pin holding
forever.

**Concretely, use two dedicated new fixture sessions, both dated well clear of any near-term expiry, and do
not reuse `RECONCILABLE_SESSION_B` for this specific test** (that fixture carries its own real fuse, now
quarantined by `T613`'s fake clock rather than by this task — full detail in §5, not summarized further
here — and a self-contained alternative costs nothing extra):

- `starts_at: '2026-09-14T21:00:00.000Z'` / `ends_at: '2026-09-14T22:30:00.000Z'` — 16:00–17:30 CDT.
- `starts_at: '2026-09-21T23:00:00.000Z'` / `ends_at: '2026-09-22T01:00:00.000Z'` — 18:00–20:00 CDT (same
  wall time as `DEFAULT_START_TIME`/`DEFAULT_END_TIME` and as `RECONCILABLE_SESSION_A`/`_B`, on a different,
  safely-future date — this is deliberate: it proves the fix by *date*, not only by an unusual time value).

Both dates are in the same CDT DST regime as the existing fixtures (Sept, before the November fallback), so
the only variable between the two new sessions is wall time, not UTC-offset arithmetic. Status `'scheduled'`
for both, matching the reconcilable shape.

**Display-format note (round 1's m4):** these times are written above as 24-hour ISO for precision, but
`TimeInput` renders in 12-hour format by default (`hourFormat` defaults to `'12h'`, `formatDisplayTime12h`
— e.g. 16:00 displays as `"4:00 PM"`, not `"16:00"`). Any assertion against a rendered `<input>` element's
`value` must use the 12-hour string; assertions against `onSaveMeetingSeries`'s payload (real ISO
timestamps) are unaffected and are the primary evidence this task's tests should rely on.

This construction technique is exactly what makes this task **testable now, before T605 exists**: real
sessions with genuinely different times can be handed to the pure function (§3.5) and to `initialData`
(exercising `resetForm()` and the full submit path) via plain object literals, with no dependency on any
per-session editing UI.

---

## 5. Required tests — by name and content, never by line range

**Do not modify any existing test's fixtures or assertions.** Add new tests only. Per-test rationale below;
exact wording of `it(...)` strings is the worker's call, but each bullet's *coverage* is mandatory.

**Pure-function level** (new `describe` block, e.g. `describe('buildEditDesiredFutureSessions (T611 per-
session time preservation)', ...)`), no DOM:
- Preserves each matching date's own original `starts_at`/`ends_at` when `timeFieldsTouched` is `false`,
  even when two dates' originals genuinely diverge (feed both fixture sessions from §4 directly).
- Applies the new shared `startTime`/`endTime` to every date when `timeFieldsTouched` is `true`, overriding
  any prior divergence.
- Uses the currently displayed `startTime`/`endTime` for a date with no entry in `originalTimesByDate`
  (a newly added custom date), regardless of `timeFieldsTouched`.

**Component level**, inside or alongside the existing `describe('<ScheduleMeetingsDialog /> T510 edit
mode', ...)` block, using the §4 fixtures via `initialData`:
- **The direct regression proof for this row:** submitting with no interaction with either time field
  preserves each session's own original time in the `onSaveMeetingSeries` payload — assert via `getTime()`
  equality per session, following the existing `"AC-B1: saving with no schedule change preserves every
  toUpdate session's starts_at/ends_at as the SAME instant (heterogeneous-time no-op proof)"` test's own
  shape, but with the two genuinely-divergent, safely-dated fixtures from §4 (unlike that existing test —
  see the note below). This is the test the §6 mutation must redden.
- Explicitly changing the Start time and/or End time field, then submitting, applies the new time to every
  future session, including ones whose original times previously diverged from each other.
- **The §3.3 disclosure — THREE mandatory assertions, all three required, not any two (D017 ruling
  4(a)/MAJOR-A).** v2 required only two (present when divergent+untouched; absent once touched) and round 2
  proved that pair alone is not enough: deleting the divergence check entirely — so the warning renders on
  **every** edit of **every** series, untouched or not — still left **all 66 tests green**, because nothing
  asserted the warning's absence on a *non-divergent* series. The third assertion closes exactly that gap:
  1. **Present** — the §4 divergent fixtures, zero time-field interaction → disclosure shown.
  2. **Absent after touch** — the §4 divergent fixtures, a time field edited → disclosure gone.
  3. **Absent on a non-divergent series — new, mandatory, and required to use `EDIT_INITIAL_DATA`
     specifically, not a third custom fixture:** render with the existing, unmodified `EDIT_INITIAL_DATA`
     fixture (its three sessions, `RECONCILABLE_SESSION_A`/`_B`/`PAST_SESSION`, share one 18:00–20:00 CDT
     wall time by construction) with zero time-field interaction → disclosure **absent**. `EDIT_INITIAL_DATA`
     is exactly the fixture the existing `"AC10 (other direction): no disclosure line when every session is
     still reconcilable"` test already renders (for AC10's own, different, "already happened" disclosure —
     do not conflate the two disclosures; this new assertion is about §3.3's divergence warning, not AC10's
     reconcilability warning, even though they can share a render). **v2 wrongly steered the worker away from
     `EDIT_INITIAL_DATA` for this purpose ("do not substitute…") — that instruction is withdrawn; this
     fixture is now the required and sufficient vehicle for assertion 3.** Use the §4 divergent fixtures for
     assertions 1-2, `EDIT_INITIAL_DATA` for assertion 3. **Assertion 3 must query for the exact same
     disclosure string (or matcher) assertion 1 asserts present** — do not write a second, independently-
     worded absence check. A mismatched query (e.g. matching different copy, or a substring loose enough to
     match something else) would let assertion 3 pass vacuously even with the divergence check still broken,
     which is the identical failure mode this whole revision exists to close.
- **The `buildEditConfirmationDescription` overwrite suffix — required, with no criterion in v2 at all
  (D017 ruling 4(b)/MAJOR-B).** v2 mandated an additive second parameter (§3.3 item 2/§3.6) so a save that
  is about to overwrite times says so, but no test anywhere exercised it — the only existing calls to that
  function (`AC11`/`AC12`) are one-argument, so the sole verification of the new parameter in v2 was that it
  compiles. Two required criteria:
  1. **Component-level, at the real call site.** Using the §4 divergent fixtures, touch a time field, submit,
     and inspect the confirmation `AlertDialog`'s own rendered description (`document.querySelector('dialog
     [role="alertdialog"]')`, the exact harness the regression test above already builds) — it must contain
     wording stating that session times will be overwritten (exact copy is the worker's call; it must say
     this plainly, not imply it). **A named mutation must redden this assertion** — e.g. reverting the
     `AlertDialog`'s `description` call site back to the one-argument form, or hardcoding the new suffix off
     — run in your own worktree per §6's own convention, with the real red output reported.
  2. **The untouched path reproduces today's output byte-for-byte.** May be asserted at the unit level
     (calling `buildEditConfirmationDescription(plan, false)` or equivalent and comparing to the one-argument
     result) rather than through the component. `AC11`/`AC12` remain the untouched-path, one-argument
     back-compat proof and are **not** edited — this criterion is additive coverage of the two-argument form
     with the flag off, not a replacement for them.
- **Clearing a touched time field disables the Save changes button in edit mode — corrected mechanism
  (round 1's BLOCKER-1).** `TimeInput` fires `onChange(undefined)` **only from its own `handleBlur`**
  (`TimeInput.js:215-227`); emptying the input's text via `handleInputChange` alone (`:187-201`) parses to
  `null` and never calls `fireChange` — confirmed by running this exact scenario: `disabled` stays `false`
  after a change-to-empty and only becomes `true` after a real blur/focusout. **v1's framing that this
  "mirrors" the existing Title-clearing test is wrong and withdrawn** — that test clears a `TextInput`, which
  fires on `input` alone; `TimeInput` does not. The correct sequence is: `setNativeInputValue(startTimeInput,
  '')` (sets `pendingInput` to empty, matching real typing), then a new `blurInput` helper (§7) that
  dispatches a real blur so `handleBlur` runs and calls `fireChange(undefined)`:
  ```tsx
  function blurInput(input: HTMLInputElement): void {
    act(() => {
      input.dispatchEvent(new FocusEvent('focusout', { bubbles: true }));
    });
  }
  ```
  (React delegates `onBlur` via the bubbling native `focusout` event, not the non-bubbling `blur` event —
  confirmed against this file's own `clickButton` precedent for dispatching a bubbling native event that
  React's delegated listener picks up.) Only after both steps does the Save changes button become disabled.

**A note on the existing `"AC-B1"` test, for your own understanding — do not edit it:** its two fixture
sessions (`RECONCILABLE_SESSION_A`/`RECONCILABLE_SESSION_B`) happen to share the exact same Chicago wall
time (both 18:00–20:00 CDT, only the calendar date differs), so despite its "heterogeneous-time" name it
does not actually exercise divergent times, and will not catch this row's regression on its own — that is
exactly why §4/§5 require a *new*, genuinely divergent fixture. `AC-B1` itself is expected to keep passing
unmodified under your fix (verified: your change makes it an exact passthrough of the original ISO strings,
which is a stronger guarantee than what it tests today, not a weaker one) — do not touch it, do not rename
it, just leave it green.

**A real calendar fuse in these SAME two fixtures — disclosed, not this row's to fix (D017 ruling
4(c)/MAJOR-C).** `RECONCILABLE_SESSION_A.startsAt` is `'2026-08-10T23:00:00.000Z'` (test file `:928` — was
`:907` before **T613** merged and shifted this file's own lines; re-locate by content, not this number, if
it has drifted again) and `RECONCILABLE_SESSION_B.startsAt` is `'2026-08-17T23:00:00.000Z'` (`:935`, was
`:914`) — both real, calendar-relative dates compared against a genuine `new Date()` inside the dialog
(`:807`, `:888`, `:936`, unaffected — those citations are in `ScheduleMeetingsDialog.tsx`, not the test
file `T613` touched). **`T613` has now merged and pins a Date-only fake clock at the top of this same test
file** — "no fake clock anywhere in this test file" (this packet's own earlier wording) is therefore no
longer true at HEAD; it described the state before `T613`, not the state a worker will actually see. The
fuse itself is still real in these two fixtures' own values — `T613`'s clock quarantines it, it does not
remove it — which is why this disclosure and the pre-authorization below still matter. `boss-arbiter` (D017)
independently replicated the fuse in its own worktree, before `T613` existed, via an opt-in fake clock: at
`2026-08-10T22:00:00Z` the file was 57/57 green (the real count at that time); at `2026-08-11T00:00:00Z` —
one day later — it dropped to **3 failed / 54 passed**, naming exactly:
1. `"opens prefilled from initialData, edit-mode title, and the 'already happened' disclosure (AC10,
   prefill)"` — the non-reconcilable count flips from 1 to 2.
2. `"AC10 (other direction): no disclosure line when every session is still reconcilable"` — `SESSION_A` is
   no longer reconcilable, so the "already happened" disclosure now appears.
3. `"AC-B1: saving with no schedule change preserves every toUpdate session's starts_at/ends_at as the SAME
   instant (heterogeneous-time no-op proof)"` — `toUpdate` drops the now-expired session.

**Do not fix this fixture yourself. `RECONCILABLE_SESSION_A`/`_B` are Forbidden to this row (§7)** — D017
assigns the fix to a separate FAST-tier task (referred to as **T613** by the coordinator relaying this
ruling; header has the full dispatch-precondition detail), which pins a Date-only fake clock at the top of
this test file and merges **before** this packet's worker is dispatched. **If, despite that precondition,
you ever observe exactly these three tests red at an unmodified HEAD:** this is D017's own pre-authorized,
named calendar condition, not a defect you introduced and not a §9 stop (see §9's own restatement of this).
Confirm the cause in your own worktree (fake the clock to a date before 2026-08-10, per D017's own method,
and watch all three go green) and pause for the fuse fix rather than treating it as a `boss-architect`-ruling
matter — do not edit these two fixtures under any circumstance, this pre-authorization included.

---

## 6. Mutation-replay requirement

In your own worktree (constitution item 23 — never the shared tree), after your fix is committed:

1. Revert `handleSubmit`'s edit branch to call `buildEventSessionsPayload(sessionDates, startTime, endTime,
   '')` directly again (i.e., undo §3.5's call-site change only — the smallest revert that reproduces the
   original defect).
2. Re-run the new "direct regression proof" test named in §5. It must go **red** with a real assertion
   failure (a `getTime()` mismatch on the divergent session), not a hang, not a false pass, not an
   `UNTRUSTWORTHY` verdict from `mutation-replay`'s `replay.py` (per **T612**, that tool has a known false-
   negative on focused `-t` runs as of 2026-08-06 — if it reports `UNTRUSTWORTHY` here, do not trust that
   verdict either way; re-run the file directly with `vitest run <path>` and read the real output yourself,
   exactly as T609's checker did).
3. Restore the fix and re-run to confirm green again.
4. Report the real red output from step 2 verbatim in your worker output — not a description of what it
   would show.

**Second, independent mutation — additive, required by D017 ruling 4(b) for the confirmation-suffix
criterion. Steps 1-4 above are unmodified and still the primary regression proof; this is a second,
separate mutation for the second required deliverable, not a replacement:**

5. In your own worktree, mutate the `AlertDialog`'s `description` call site (§3.6) back to its one-argument
   form (or hardcode the new suffix off, whichever your implementation makes the smaller, more targeted
   revert).
6. Re-run the MAJOR-B component-level criterion (§5: the real-call-site suffix assertion). It must go
   **red** — the assertion expecting overwrite wording in the rendered `AlertDialog` description must fail
   for real, not pass vacuously.
7. Restore the fix and re-run to confirm green again.
8. Report the real red output from step 6 verbatim, alongside step 2's, in your worker output.

---

## 7. Allowed Files / Forbidden Files

**Allowed:**
- `src/pages/meetings/ScheduleMeetingsDialog.tsx` — §3's changes only (the new pure function, the
  `timeFieldsTouched` state + wrapped `onChange` handlers, `resetForm()`'s reset of that flag, `isValid`'s
  new condition, `handleSubmit`'s call-site swap, the new disclosure `Text`, and the doc-comment updates
  named in §3.5), **plus the `AlertDialog`'s `description` prop / `buildEditConfirmationDescription` call
  site (~`:1195-1197`, named explicitly per round 1's MAJOR-2 — §3.6), plus
  `buildEditConfirmationDescription`'s own definition (`:716-723`, the additive second parameter itself —
  named explicitly per D017 ruling 4(d)/MINOR-D, which found v2's Allowed list forbade the very edit §3.6
  mandated)**. Every other line, including `:598-612` (§1.5) and `:614-640` (§2.1), stays byte-identical.
  `PendingEditSave`'s own interface (§3.6) does **not** change — do not add a field to it.
- `src/pages/meetings/ScheduleMeetingsDialog.test.tsx` — additions only, per §5, including the new
  `blurInput` helper (§5, round 1's BLOCKER-1) alongside the file's existing `getFieldControl`/
  `findButtonByText`/`setNativeInputValue`/`clickButton` helpers. Zero existing lines change.
- `docs/swarm/active/T611-worker-output.md` (create — your evidence doc).

**Forbidden:**
- `src/lib/supabase/loaders/meetings.ts` — verified correct and unchanged in §2.2. If your own investigation
  disagrees and you believe this file must change, **stop and file a dispute** rather than editing it —
  that would also change this task's tier classification (a genuine loader edit is unambiguously HEAVY on
  its own terms and needs its own premise-gate scrutiny of the write path itself).
- `src/pages/meetings/MeetingsList.tsx` / `MeetingsList.test.tsx` — confirmed at `b6870ab:2361-2367` to pass
  each session's `startsAt`/`endsAt` straight through from the loader with no transformation of its own; not
  part of the defect, not part of this fix.
- `src/pages/meetings/EditMeetingSessionDialog.tsx` (does not exist) — do not create it; that is T605's file.
- `supabase/migrations/**` — no migration in this task.
- `docs/swarm/constitution.md`, `docs/swarm/task-ledger.md`, `docs/swarm/verification-log.md`,
  `docs/swarm/dispute-log.md`, `.claude/agents/`, `.claude/skills/`, `.claude/settings.json`.
- `package.json` / lockfiles.
- Within `ScheduleMeetingsDialog.tsx` itself: `computeMeetingSeriesReconcilePlan` (§2.1), the `:598-612`
  doc comment (§1.5), `buildEventSessionsPayload`'s own body (reused, not modified), `handleConfirmEditSave`,
  and the top-of-file module doc block — all Forbidden even though the file as a whole is Allowed.

---

## 8. Verification requirements — every exit code captured on the bare command, never through a pipe

- **`npm run typecheck; echo "EXIT:$?"` → `EXIT:0`.**
- **`npm run format:check; echo "EXIT:$?"` → `EXIT:0`.**
- **`npm run lint; echo "EXIT:$?"` → `EXIT:0` errors.** Record the baseline warning count at `b6870ab` before
  changing anything, and the count after. **Round 1 already measured this on a faithful §3 implementation in
  its own isolated worktree: 370 warnings / 0 errors baseline, 372 after.** Treat that as the expected
  delta (+2), not a target to hit exactly if your own implementation differs in shape — but if your own count
  diverges meaningfully from that, explain the delta, don't assert it away.
- **`npm test; echo "EXIT:$?"` → `EXIT:0`.** Record file/test totals at `b6870ab` and after your change, via
  **two independent shapes**, not one — e.g. `vitest run`'s own summary line AND a count of `it(`/`test(`
  occurrences added to `ScheduleMeetingsDialog.test.tsx` via `grep -c`. This project has had counts be wrong
  four times in three days because a single search shape couldn't see the real answer (per the current
  governing guidance) — do not repeat that with this task's own test-count claim.
- **Post-`T613`-merge re-read, before you rely on any citation this packet gives into
  `ScheduleMeetingsDialog.test.tsx`.** `T613` (merged, PR #110) both pinned a fake clock in that file and
  shifted its own line numbers — this packet's own `RECONCILABLE_SESSION_A`/`_B` citations (§5/§9) were
  updated once already (`:907`→`:928`, `:914`→`:935`) but are pinned to a single post-merge snapshot, not
  guaranteed current by the time you read this. Before using any line-numbered citation into that file,
  re-locate it **by content** (the fixture/test names this packet already gives you resolve regardless of
  drift) and confirm the number, rather than trusting the number alone — the same discipline §8's own next
  bullet already requires when discussing tests in your own output.
- **§6's mutation, replayed in your own worktree, with real before/after output.**
- **`git diff` for `ScheduleMeetingsDialog.tsx`** is confined to the regions named in §7's Allowed bullet
  (including the `AlertDialog` `description` call site, round 1's MAJOR-2) — no hunk anywhere in
  `computeMeetingSeriesReconcilePlan`, the `:598-612` comment, `buildEventSessionsPayload`'s body, or
  `PendingEditSave`'s own interface definition.
- **`git diff` for `ScheduleMeetingsDialog.test.tsx`** contains only added lines — no existing test's content
  changes (confirm this with the diff itself, not by memory).
- Identify every test you discuss **by describe/it name and content**, never by line range — T609's own merge
  already proved how fast this file's line numbers drift.

---

## 9. If any existing test would need to change — stop, do not resolve it yourself

**Investigated in this packet, not left for the worker to discover cold — and independently re-confirmed by
round 1 on five search shapes, not just the two below.** Verified via two independent search shapes across
`ScheduleMeetingsDialog.test.tsx`: (1) `grep -n 'Start time|End time'` — the only hits are the field-order
label assertions (`'Start time ∙ Required'`, `'End time ∙ Required'`), not interactive use; (2) every
`setNativeInputValue(`/`getFieldControl(` call site in the file, enumerated exhaustively — none targets a
time input, in either mode. **Conclusion: no existing test currently interacts with the Start time/End time
controls at all**, and §3.6 requires `buildEditConfirmationDescription`'s signature change to be additive so
its two existing call sites (`"AC11: no \"Removed:\" segment when toRemove.length === 0"` and `"AC12:
\"Removed:\" followed by each removed date, human-readable"`) keep passing unmodified. On this analysis,
**zero existing tests require modification** — and round 1's own worktree run confirmed it directly: all 57
existing tests passed unmodified against a faithful §3 implementation.

**One named, pre-authorized exception — read before treating any red here as a stop condition (D017 ruling
4(c)/MAJOR-C).** `RECONCILABLE_SESSION_A`/`_B` in this SAME test file carry a real calendar fuse, unrelated
to this fix (full detail: §5's dedicated disclosure). If exactly these three tests are red at an unmodified
HEAD —
1. `"opens prefilled from initialData, edit-mode title, and the 'already happened' disclosure (AC10,
   prefill)"`,
2. `"AC10 (other direction): no disclosure line when every session is still reconcilable"`,
3. `"AC-B1: saving with no schedule change preserves every toUpdate session's starts_at/ends_at as the SAME
   instant (heterogeneous-time no-op proof)"`

— **that is a dated calendar condition `boss-arbiter` (D017) has already pre-ruled is NOT a §9 stop and NOT
a violation of "Existing tests must pass…".** It is not this worker's to escalate for a ruling and not
this worker's to fix — do not file a `boss-architect` request for it, and do not touch either fixture.
Confirm the cause in your own worktree (item 23: a Date-only fake clock set before 2026-08-10 turns all
three green with zero edits) and pause for the separate fuse-fix task's merge (header's dispatch
precondition) rather than proceeding or escalating. **This exception is exactly these three tests and
nothing else** — any other existing test going red is still a full stop under this section as written above.

**If your own implementation contradicts the "zero existing tests require modification" finding in any
other way** — if making this fix real would require changing any existing test's assertions or fixtures,
for a reason other than the named calendar exception above, to keep it green — **you must stop and file a
request for a `boss-architect` ruling. Neither you nor the foreman may grant this yourselves.**

Quote the governing rule **verbatim, not by number**, exactly as follows — this project has an open,
unresolved ambiguity (**T610**, filed 2026-08-06) where "item 10" resolves to two different rules depending
on which part of the constitution is read (the Non-Negotiables bullet below versus the numbered
Project-Specific Standards item, *"10. Database changes are additive migrations via the Supabase CLI;
editing an applied migration file → BLOCKER"* — a completely different rule, about migrations, not tests).
The rule that actually governs here is the **Non-Negotiables** section of `docs/swarm/constitution.md`,
verbatim:

> "Existing tests must pass unless the boss explicitly approves a test update."

Cite it exactly this way — by section name and verbatim text — never as "item 10," in either direction of
the ambiguity, until T610 resolves it.

---

## 10. Relevant Constitution Excerpts

- **Non-Negotiables:** "The app must build successfully." **"Existing tests must pass unless the boss
  explicitly approves a test update."** "No worker may mark its own work complete." "Every checker must
  inspect the actual artifact, not just the worker's summary."
- **Item 18 / 25:** worker tier stays sonnet — no migration/RLS/metric-SQL/auth trigger fires; do not bump
  for "sounds sensitive" (§0.4).
- **Item 19 / 19a / 19c:** this packet must clear a fresh `checker-premise` conformance instance (D017
  ruling 6, §0.3) before any worker sees it — not self-certified here. Verify your own citations before
  submitting anything downstream of this packet (19c) — everything in §1/§2 was re-read against `b6870ab`
  directly, not relayed.
- **Dispute Rule / D017:** item 19a's two premise rounds were spent with no worker ever having attempted
  this task; `boss-arbiter` resolved the resulting gate-rounds exhaustion under the same instrument as D015/
  D016, not a worker-vs-checker dispute. This is why v3 exists and why what runs next is a narrow
  conformance check, not a third premise round — see §0.2/§0.3 for the full mechanics.
- **Item 21:** your completion report must give the commit SHA your work landed in; existence is verified,
  not assumed.
- **Item 22:** explicit pathspecs only — never `git add -A` or `git add .`.
- **Item 23:** mutation experiments (§6) run in your own worktree, never the shared tree.
- **Item 26** (HEAVY definition quoted and applied in §0.4).
- **Definition of Ready item 5:** "Any reversal of previously-passed work is explicit and authorized." This
  fix reverses previously-shipped T510 behavior (`isValid`'s edit-mode condition, the single-time submit
  path). Authorization is the ledger filing itself (T611, a Defect row, plus T605's own gate independently
  confirming the same defect) — this is a correctness fix, not a preference change, and needs no further
  owner sign-off beyond the ledger record already in place.

## Most Recent Failure

None. No worker has run against this packet yet.

## Required Worker Output

- Confirmation the header's Dispatch precondition (the fuse fix, D017 ruling 5) had merged before you
  started, and that you re-ran §8's baseline fresh afterward rather than assuming it still held.
- Files changed (exact list, matching §7 — should be exactly two source-adjacent files plus this output
  doc).
- The new function's full text and signature actually used (§3.5), and confirmation it is exported.
- Confirmation of §2: `computeMeetingSeriesReconcilePlan` and `loaders/meetings.ts`'s `updateSessionTime`
  are byte-identical to `b6870ab` (paste the `git diff` — or its absence — for both).
- Confirmation of §9: either "no existing test needed modification" (expected, per this packet's own
  analysis), the D017 pre-authorized calendar exception observed and its cause confirmed in your own
  worktree (name which of the three tests, if any, and do not treat it as a stop), or a filed
  `boss-architect` ruling request for anything else, quoting the Non-Negotiables rule verbatim — never
  self-resolved.
- Every command from §8, with real captured exit codes and relevant output, including both independent
  test-count shapes.
- Both §6 mutations, replayed in your own worktree: the regression-proof mutation (steps 1-4, with the
  real red output from step 2 and the real green output from step 3) and the confirmation-suffix mutation
  (steps 5-8, with the real red output from step 6 and the real green output from step 7).
- Commit SHA (item 21) and confirmation of explicit pathspecs used (item 22).
- Known risks, if any.
- Whether a dispute is needed, and if so, exactly which packet section it concerns.
