# T613 — Pin a Date-only fake clock in `ScheduleMeetingsDialog.test.tsx` (D017 ruling 5)

## 0. Identity, tier, authority

| | |
|---|---|
| Task ID | T613 (filed in the ledger by the orchestrator, not this packet) |
| Tier | **FAST** (constitution item 26) |
| Worker | orchestrator implements directly — no separate worker agent |
| Checker | **none** — FAST tier has no checker round; this packet substitutes for coordination, not for evidence |
| Authority | `docs/swarm/dispute-log.md` **D017**, ruling 5 (boss-arbiter, 2026-08-06). Existing-test-file modification is explicitly boss-approved there under the Non-Negotiable's own override mechanism (D003 precedent). Also see `docs/swarm/auto-mode-decisions.md`, entry "2026-08-06 — D017: T611's gate rounds exhausted…". |
| Machine / branch | This machine (W1+W3), `claude/w3-meeting-workflow-0bl669` |
| Blocking | **T611, then T605 — both queued, cannot dispatch until this merges.** Treat as urgent. |
| Attempt count | 0 (first attempt) |
| Escalation | See §12 — a failure here is a report back, not a Dispute Rule event (no worker/checker loop exists at FAST tier) |

## 1. Objective

Remove a real-clock-relative calendar fuse in `src/pages/meetings/ScheduleMeetingsDialog.test.tsx` by pinning **only** the global `Date` constructor to a fixed instant, once, at module load. Zero fixture edits, zero assertion edits — only the clock the file runs against changes. This is the ruling's proven **primary remedy**; do not substitute the fallback (static fixture refresh) unless the primary remedy demonstrably fails the proof in §7, and if you do, state why (ruling 5 requires this).

## 2. The defect (context only — do not re-litigate; settled by D017)

`ScheduleMeetingsDialog.tsx`'s own production code calls **unseeded** `new Date()` at three sites (cited by D017 as `:807`, `:888`, `:936` — re-locate at your own HEAD by content, not line number: inside `resetForm`'s `isMeetingSessionReconcilable(s, new Date())` filter, inside the `nonReconcilableSessionCount` computation, and inside `handleSubmit`'s edit-mode branch feeding `computeMeetingSeriesReconcilePlan`). The test file's `'<ScheduleMeetingsDialog /> T510 edit mode'` describe block builds fixtures with fixed 2026 ISO literals and no fake clock anywhere in the file or in `src/test-setup.ts`. `RECONCILABLE_SESSION_A.startsAt` is `'2026-08-10T23:00:00.000Z'`; today is 2026-08-06. Independently replicated twice (checker-premise round 2, boss-arbiter) against an **unmodified** file:

| faked clock | result |
|---|---|
| `2026-08-10T22:00:00Z` | `Tests 57 passed (57)` |
| `2026-08-11T00:00:00Z` | `Tests 3 failed \| 54 passed (57)` |

## 3. Allowed / forbidden

**Allowed — exactly one file, and only the region described:**
`src/pages/meetings/ScheduleMeetingsDialog.test.tsx` — add **one** new module-level statement (with its explanatory comment) immediately after the top import block. For the primary remedy, make **no other change** to this file.

**Forbidden, including inside the allowed file:**
- `RECONCILABLE_SESSION_A` / `RECONCILABLE_SESSION_B` object literals (the `const` declarations inside the `'<ScheduleMeetingsDialog /> T510 edit mode'` describe). **Do not touch their dates under the pin route** — T611's own packet reasons about these exact fixtures; a concurrent edit invalidates it.
- Any `it(...)`/`describe(...)` name, any `expect(...)` assertion, or any other constant in this file.
- `src/test-setup.ts` — its own doc comment is explicit: "intentionally narrow… do not add other global mocks here." Do not add a clock mock there.
- `src/pages/meetings/ScheduleMeetingsDialog.tsx`, or any other production file. Test infrastructure only, no write path.
- Any other test file — **unless** the sweep in §8 finds a genuine fuse under ~60 days; if so, stop, cite it here, and fix only that file under this same boss approval. Do not silently expand scope.
- `docs/swarm/task-ledger.md`, `docs/swarm/dispute-log.md`, `docs/swarm/auto-mode-decisions.md`, T611's or T605's packets, or any other shared doc. Ledger filing (T613's row) is the orchestrator's job, not this packet's.

## 4. Fixture enumeration and the chosen pin — do not pick a date by intuition

Every describe block in the file, and whether it reads a real/faked clock at all:

| Describe / test | Date source | Real-clock dependency |
|---|---|---|
| `generateSingleSessionDates`, `generateRecurringSessionDates`, `generateCustomSessionDates`, `computeScheduleSessionDates` | explicit literal date strings only | **none** — immune to any pin |
| `chicagoWallTimeToUtcIso`, `buildEventSessionsPayload`, `resolveTeamScope`, `computeConfirmLabel` | explicit literals only | **none** |
| `isMeetingSessionReconcilable` | local `const NOW = new Date('2026-08-06T12:00:00.000Z')`, passed **explicitly** as the function's 2nd argument | **none** — parsing an explicit ISO string is unaffected by a faked `now`; never reads a no-arg `new Date()` |
| `computeMeetingSeriesReconcilePlan` (+ its duplicate-`session_date` sibling describe) | same pattern: local explicit `NOW = new Date('2026-08-06T12:00:00.000Z')`. Fixtures `PAST_DATE` (2026-07-01), `FUTURE_DATE_1` (2026-08-10), `FUTURE_DATE_2` (2026-08-17), `SHARED_DATE` (2026-08-10) compared only against that explicit local `NOW` | **none** |
| `<ScheduleMeetingsDialog /> disabled/enabled confirm button` → "Weekly recurring mode" test | `const today = new Date().toISOString().slice(0, 10)` — a **no-arg** call, does read the pin — but the test derives its **own** expected value relative to that same `today`, and the component's internal "Next 6 weeks" preset reads the identical pinned `Date` in the same JS realm. Self-relative. | reads the pin, but is immune to **which** value it is chosen |
| `'<ScheduleMeetingsDialog /> T510 edit mode'` — **the fuse** | Production code's unseeded `new Date()` (§2) reconciles against: `RECONCILABLE_SESSION_A.startsAt` = `2026-08-10T23:00:00.000Z` (must stay **strictly future**), `RECONCILABLE_SESSION_B.startsAt` = `2026-08-17T23:00:00.000Z` (must stay **strictly future**), `PAST_SESSION.startsAt` = `2026-07-01T23:00:00.000Z`, status `completed` (must stay **strictly past** — its own comment already documents this intent) | **the only real boundary constraint in the file** |

Boundary the pin must satisfy: `2026-07-01T23:00:00.000Z < pin < 2026-08-10T23:00:00.000Z`.

**Chosen pin: `2026-08-06T12:00:00.000Z`.** Not a new value — it is the exact literal already used as the local `NOW` constant in three other describes in this same file (`isMeetingSessionReconcilable`, `computeMeetingSeriesReconcilePlan`, its duplicate-session_date sibling). Reusing the file's own existing anchor is not intuition. It clears both boundaries with comfortable margin (>4 days before SESSION_A, >11 days before SESSION_B, >5 weeks after PAST_SESSION), and it happens to equal today's real date, so nothing about the file's stated fixture era changes.

## 5. The exact change

Locate the end of the top import block — the line `} from './ScheduleMeetingsDialog';` — by that exact content (not a line number: this file may have moved under concurrent edits). Insert the following **new module-level statement** immediately after it, before the `TEST_TEAMS` comment/constant:

```ts
// ---------------------------------------------------------------------------
// D017 ruling 5 (docs/swarm/dispute-log.md) -- the "T510 edit mode" describe
// below builds fixtures (RECONCILABLE_SESSION_A/_B) whose startsAt are fixed
// 2026 ISO literals, reconciled by this dialog's own production code against
// an unseeded `new Date()`. Left alone, RECONCILABLE_SESSION_A.startsAt
// ('2026-08-10T23:00:00.000Z') silently flips three currently-green tests
// red the moment real wall-clock time crosses it. Pinning ONLY `Date` (never
// other timers -- this file relies on real setTimeout/microtask scheduling
// via `act`/`flushMicrotasks`/genuine promise resolution, and faking those
// too would likely hang it) removes the fuse with zero fixture or assertion
// edits. `2026-08-06T12:00:00.000Z` is not a new value -- it is the same
// literal already used as the local NOW constant in the
// isMeetingSessionReconcilable/computeMeetingSeriesReconcilePlan describes
// below. Boss approval for this existing-test-file modification: D017
// ruling 5 (Non-Negotiable override mechanism, D003 precedent). This is a
// ONE-TIME module-level pin, deliberately NOT inside beforeEach -- there
// must be no `vi.useRealTimers()` call anywhere in this file, or the clock
// silently un-pins after the first test.
// ---------------------------------------------------------------------------
vi.useFakeTimers({ toFake: ['Date'], now: new Date('2026-08-06T12:00:00.000Z') });
```

No other line changes for the primary remedy. `vi` is already imported (`import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';`).

## 6. Constraint: Date-only, not full fake timers (state this explicitly in the PR)

Use `toFake: ['Date']` — **never** a bare `vi.useFakeTimers()`, which also fakes `setTimeout`/`setInterval`. This file's harness (`flushMicrotasks`, `act(async () => …)`, and the dialog's real promise-returning `onCreateMeetings`/`onSaveMeetingSeries` mocks) depends on real timer/microtask scheduling. Fully faking timers would likely hang these `await` chains rather than fail cleanly.

## 7. Mandatory proof — commit before mutating (item 26)

Run in this order:

1. *(optional sanity)* `npx vitest run src/pages/meetings/ScheduleMeetingsDialog.test.tsx; echo "EXIT:$?"` on unmodified HEAD.
2. Implement §5 exactly. **Commit it** — the mutation step below must be revertible with a clean `git checkout --` without losing the real fix (T323's lesson, item 26).
3. **RED proof.** Temporarily change only the `now:` argument to `new Date('2026-08-11T00:00:00.000Z')`. Run:
   `npx vitest run src/pages/meetings/ScheduleMeetingsDialog.test.tsx; echo "EXIT:$?"`
   ($? captured directly on this bare command — never through a pipe.) Required: `EXIT:1`, summary `Tests 3 failed | 54 passed (57)`, with these three tests failing **by exact name**:
   - `opens prefilled from initialData, edit-mode title, and the "already happened" disclosure (AC10, prefill)`
   - `AC10 (other direction): no disclosure line when every session is still reconcilable`
   - `AC-B1: saving with no schedule change preserves every toUpdate session's starts_at/ends_at as the SAME instant (heterogeneous-time no-op proof)` — with `expected [ … ] to have a length of 2 but got 1` (`toUpdate` drops `session-a`)
   Quote the real, unparaphrased vitest output.
4. Revert the mutation: `git checkout -- src/pages/meetings/ScheduleMeetingsDialog.test.tsx`. Confirm via `git diff`/`git status` that the file now matches the §5 commit, nothing more (safe here only because step 2 already committed the real fix).
5. **GREEN proof, file-scoped:** `npx vitest run src/pages/meetings/ScheduleMeetingsDialog.test.tsx; echo "EXIT:$?"`. Required: `EXIT:0`, `Tests 57 passed (57)`. (This is gate 6 of MACHINE-SETUP.md's six gates.)
6. **GREEN proof, full suite** (gate 5): `npx vitest run; echo "EXIT:$?"`. Required: `EXIT:0`. Quote the real summary line — do not quote a stale count from any doc.
7. Remaining gates, bare commands, `$?` captured directly (never through a pipe):
   - `npx tsc --noEmit; echo "EXIT:$?"` → required `EXIT:0`
   - `npx vite build; echo "EXIT:$?"` → required `EXIT:0`
   - `npm run format:check; echo "EXIT:$?"` → required clean / `EXIT:0`
   - `npx eslint .; echo "EXIT:$?"` → required 0 errors (nonzero warning count is expected and not a failure)

## 8. Sweep — search the rest of the suite for other short fuses (same PR)

Required by D017 ruling 5. Separately: four separate counts in this project have been wrong because a search's *shape* couldn't see the answer — run **more than one shape**, and cross-reference.

**Shape 1 — files with a no-arg `new Date()` inside a test (the actual hazard: reads the clock at call time):**
```
grep -rn "new Date()" --include="*.test.ts" --include="*.test.tsx" .
```
**Shape 2 — files that already defend against this (precedent; confirm you don't need to touch these, and use them as the model for "already fixed"):**
```
grep -rln "useFakeTimers\|setSystemTime" src
```
**Shape 3 — hardcoded near-future ISO literals in test files (most are pure-function inputs and immune; Shape 1 tells you which files even have a real clock to compare against):**
```
grep -rln "'202[5-9]-[0-9]\{2\}-[0-9]\{2\}T[0-9]\{2\}:[0-9]\{2\}:[0-9]\{2\}" --include="*.test.ts" --include="*.test.tsx" .
```
A file is a live-fuse candidate only if it is in **Shape 1 ∩ Shape 3, minus Shape 2** — reads a real clock, has a fixed near-future literal, and has no existing fake-clock defense.

This office's own pass (**re-run independently — do not take this on claim**):
- `src/pages/meetings/ScheduleMeetingsDialog.test.tsx` — the fuse, fixed here.
- `supabase/functions/send-reminders/send_reminder.test.ts` (two `const now = new Date()` sites) — immune: each builds a window *centered on that same* `now` (self-relative, never compared to a fixed literal); the file's own comments say so ("brackets the real insert timestamp … regardless of what the sandbox's wall clock happens to read"). No fix.
- `src/pages/settings/SeasonSettings.test.tsx` (`computeCurrentSchoolYearRange` test) — immune: derives its own expected value from that same `now`. No fix.
- `src/pages/outreach/OutreachDetail.test.tsx` (`todayIso = new Date().toISOString().slice(0, 10)`) — immune: builds a "today"-dated fixture dynamically. No fix.
- `src/pages/meetings/MeetingsList.test.tsx` — no bare `new Date()`; its `saveMeetingSeries` describes deliberately use **year-2099** literals, with a comment naming this exact hazard class and stating the mitigation ("must stay 'future' regardless of when this suite actually runs"). Already immune by ~70 years of margin. No fix.
- `src/pages/outreach/RsvpControl.test.tsx`, `src/pages/meetings/Kiosk.test.tsx`, `src/pages/calendar/CalendarPage.test.tsx` — all three already pin via `vi.useFakeTimers()`/`vi.setSystemTime()` around any near-future literal (`CalendarPage.test.tsx`'s own file header names this identical hazard and states this mitigation — the established precedent this task's fix follows). No fix.
- No other file fell in Shape 1 ∩ Shape 3 minus Shape 2 in this pass.

Confirm or correct every line above with your own output. If you find a genuine fuse under ~60 days not listed, fix it under this same D017 approval and report it here. If ≥~60 days out, do **not** fix it — flag it for an item-20 ledger row (filed by the orchestrator, not you).

## 9. Anti-patterns — do not do these

- Do not wrap the `vi.useFakeTimers(...)` call in `beforeEach` — must run once at module load, like the file's existing `HTMLDialogElement` polyfill guard above it.
- Do not add `vi.useRealTimers()` anywhere in this file (including `afterEach`) — it would silently un-pin the clock after the first test, reintroducing the fuse for every test after it. The existing `afterEach`'s `vi.restoreAllMocks()` only restores `vi.fn()`/`vi.spyOn()` mocks, not fake-timer state — leave it as-is.
- Do not touch `RECONCILABLE_SESSION_A`/`_B` — reserved for T611.
- Do not run `git checkout --` on the RED-proof mutation unless the real fix is already committed (§7 step 2/4).
- Do not report a pass count as your accept criterion — report the exit code of the bare command (MACHINE-SETUP.md: "assert exit codes, not pass counts").
- Identify every test by its exact `it(...)` string in all evidence — never by line range.

## 10. Required evidence

- The diff (should be a single-hunk insertion in one file).
- RED-proof output (§7.3): full unparaphrased vitest output, `EXIT:1`, `3 failed | 54 passed (57)`, three tests named exactly as in §7.3.
- GREEN-proof, file-scoped (§7.5): `EXIT:0`, `57 passed (57)`.
- GREEN-proof, full suite (§7.6): `EXIT:0`, real summary line.
- The four remaining gate outputs (§7.7) with exit codes.
- The sweep report (§8), independently re-run, with your own dispositions.
- Any item-20 candidate found, flagged (not filed) for the orchestrator.
- `git diff --stat` confirming only `ScheduleMeetingsDialog.test.tsx` changed.

## 11. Sequencing

Merge before T611 or T605 dispatch (D017 ruling 5). No other dependency beyond an unmodified HEAD on `claude/w3-meeting-workflow-0bl669`.

## 12. Escalation

If the chosen pin does not yield 57/57 on the file, or the full suite does not exit 0 afterward, **stop** — do not switch to the fallback (static fixture refresh) without recording why the pin route failed, per ruling 5. Report back to the foreman/orchestrator; there is no worker/checker loop at FAST tier, so this is a report, not a Dispute Rule escalation.
