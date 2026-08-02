# Resume here — state of play at `main` = `4b951c5` (read the UPDATE sections top-down; each supersedes the ones below it)

Written 2026-07-30 so this session's context can be cleared without losing anything.
Fresh orchestrator session: read this, then `constitution.md`, then the open rows in
`task-ledger.md`. Everything is on disk; nothing important lives only in a conversation.

**Several dated UPDATE sections sit near the top of this file. Read them top-down — the
newest is first and supersedes what follows it. Do not act on anything below an UPDATE
without checking whether that UPDATE moved it.**

## UPDATE — 2026-08-02 (later): the backlog is now also cut by WORKFLOW, for parallel machines

**`main` = `66776cd`.** No source changed in this update — it is a re-view of the same backlog plus
three bookkeeping corrections.

**`docs/swarm/WORKFLOWS.md` is new.** The owner intends to assign **different computers to different
workflows**, so the ~60 open rows are re-cut into ten user-facing workflows (check in, run an
outreach event, run a meeting, hours accounting, home dashboards, calendar, roster, email, migration,
cross-cutting hygiene). **Its most important content is not the grouping — it is which workflows can
safely run at the same time**, which is decided by file overlap, not topic. Three files are collision
magnets (`OutreachList.tsx` at 4164 lines, `OutreachDetail.tsx`, `StudentHome.tsx`) and the file
reserves **a row-number block of 100 per workflow** (W1 → T400-499, W2 → T500-599, and so on to
W10 → T1300-1399; owner's call) so the T196/T197 numbering collision cannot recur across N machines.
Blocks are deliberately over-sized: one that can run out reintroduces the failure it prevents.

**Best three-machine split: W1 (check in) + W4 (hours) + W7 (roster)** — no shared files. **Best
two-machine split: W1 + W2**, which between them hold every remaining data-loss row.

**`docs/swarm/KICKOFF-PROMPTS.md` is the operational half** — one copy-pasteable standalone prompt
per workflow, each carrying its owned files, row block, do-not-touch list, task order with tiers, and
the non-optional constitution rules (22/23/24/26). A fresh session starts cold, so each prompt
repeats what it needs rather than assuming any of this.

### Three bookkeeping corrections, all item-24 drift

Found while re-reading the ledger; **all three are the orchestrator's own process failing, not new
work**:

- **T323's row said "not yet packeted"** for work merged at `4fdcd1a` (PR #24), and it had **no
  `verification-log.md` entry at all** — Definition of Done items 3-4 unsatisfied. Row corrected, and
  the entry written as a backfill with the omission recorded rather than quietly closed.
- **T303's resolution was recorded into extra trailing table columns** instead of its Status cell, so
  the row read `Filed 2026-07-31` for work merged at `82da973`. Malformed row repaired.
- **`AUDIT-TRIAGE.md` still said T322 needed owner input.** He ruled the same day it was written.
  A dated UPDATE now sits above its tables.

**With N machines running, this drift multiplies by N.** Item 24 exists because the record step is
the one always dropped under time pressure.

### T322 is unblocked and is the one confirmed-wrong number on screen

The owner ruled meeting hours must **not** count toward volunteer hours. **The rule is by event
`type`, never by event name** — `GG FLL Team Meetings` and `P3 FLL Team Meetings` are typed
`outreach` and **do** count. It edits metric-view SQL → **HEAVY tier**, no matter how small the diff.

## UPDATE — 2026-08-02: T307 is FIXED. The migration has RUN. Two new docs own the state.

**`main` = `4b951c5`.** Gates measured there with `.env.local` absent: `tsc` 0 · `vite build` ✓ ·
prettier clean · eslint **0 errors / 361 warnings** · vitest **75 files / 1817 tests, exit 0**.
Ledger integrity verified: no duplicate row numbers. **Zero open PRs.**

### ⚠️ The section below this one is now HISTORICAL — do not act on it

**T307 is fixed and merged.** The next UPDATE down opens with *"T307 is LIVE DATA LOSS … Read this
first"*, which was true on 2026-08-01 and is **no longer true**. Both halves of that write path
shipped: **T305** (the per-day dialog seeds from recorded attendance and carries `hoursOverride`,
`checkInAt`, `checkOutAt` and `method` through the write) and **T307** (the bulk path no longer
destroys recorded rows). Read that section for the reasoning; do not re-open the work.

### Two documents now own state this file used to carry

- **`docs/migration/RUNBOOK.md`** — the migration end to end. **It has been RUN for real**
  (2026-08-02): 20 students, 4 teams, 16 events, 117 sessions, 254 rsvps, 79 attendance rows
  carrying **341.75 hours**, all in the owner's live project. Includes both failures encountered,
  the account-preserving teardown SQL with the reason behind every clause, and the known gaps.
- **`docs/swarm/AUDIT-TRIAGE.md`** — an external UX audit (4 P0 / 8 P1 / 3 P2) reconciled against
  the ledger. **Start here for what to work on next**, not the raw ledger: it dedupes three findings
  against existing rows, adjusts two severities with reasons, and records what the audit missed.

### The process changed — read constitution item 26 before picking up any task

**Three tiers, triggered by risk, not by topic or ticket size.** The full
packet → premise gate → worker → checker chain is the **heavy** tier and is **no longer the
default**. Authorized by the owner after he observed it was disproportionate for a few-line fix.
**T323 was the first fast-tier task** — direct edit, paired test, mutation, six gates, PR, done in
minutes — and it found something a packet round would have charged full price for: an existing
*passing* test was pinning the bug as correct behaviour.

**Heavy tier is still mandatory for write paths, auth/RLS, migrations, metric-view SQL, and exports
another session imports.** It earned that twice this session — on T305 and T189 the gate *built* the
prescription and caught a data-correctness defect invisible to reading the code.

### Merged since the last update

**T305**, **T307**, **T323**, **T063** (migration validation — the old-project credential blocker is
**closed permanently**; Lovable Cloud exposes no service-role key, so the ETL reads exported JSON via
`--from-dir`), **T063b** (write manifest + `--teardown`), plus the audit triage and constitution
item 26.

**T333** (migrated events landed on a new *inactive* season and were invisible) was **fixed by the
owner** with the repoint SQL. The ETL still hardcodes `is_active: false` — the row stays open for
the tooling half.

### Next, in order — full reasoning in `AUDIT-TRIAGE.md`

1. **T321** — manual short-code entry on `/checkin`. **Standard tier.** UI-only: T032 already
   shipped the short-code HMAC backend. Best effort-to-impact ratio on the list.
2. **T324** — the calendar renders fixture events on a live route. The *fabricated-data* family that
   caused nearly every real bug here, previously declared closed.
3. **T193** — a student changing their RSVP on `/outreach` writes nothing to the database. **The
   audit never found this one.**
4. **T196** — the live console is a fixture shell. **Still the one thing between this and a
   launchable product.** A project, not a ticket; bring `loaders/checkin.ts` (521 lines, zero tests)
   under test as part of it.

### Owner-only, still open

**~20 student email addresses** (T064 — the migration creates no accounts, so the roster is correct
and entirely unlinked) and **Vercel domain go-live** (T070).

## UPDATE — 2026-08-01: T307 is LIVE DATA LOSS, found while packeting T305. Read this first.

**`main` = `1aede0c`.** Gates there, measured twice independently with `.env.local` absent: `tsc` 0 ·
`vite build` ✓ · prettier clean · eslint **0 errors / 360 warnings** · vitest **72 files / 1746
tests, exit 0**. Merged since the last update: **T189**, **T203**, **T302**, **T303**; **T304**
closed by owner ruling as no-change.

### The one thing in this file that is actively costing the owner data

**T307 — "Mark event complete" destroys recorded attendance, today, with one click.**
`buildMarkEventCompletePayload` (`MarkEventCompleteDialog.tsx:176-192`) seeds its attendance rows
from `computeInitialAttendedStudentIds` — **`going` RSVPs** — and passes them to
`buildAttendanceWriteRows` with an empty hours map (`:187`). Those rows go to `markDayComplete`,
whose upsert (`loaders/outreach.ts:1136-1152`) names `check_in_at`/`check_out_at`/`hours_override`/
`method`/`recorded_by` and passes `{onConflict:'session_id,student_id'}` with **no
`ignoreDuplicates`** (`:1150`). Measured payload at unmodified HEAD:
`{status:'present', check_in_at:null, check_out_at:null, hours_override:null, method:'coach'}`.

So a student who RSVP'd `going` and then checked in by QR — or had hours typed into the
`AttendancePanel` — is overwritten the moment a coach clicks "Mark event complete". **No coach
intent beyond that click. This is the owner's own workflow**; T305 was filed off a screenshot of him
typing 3h into that panel.

**Why it went unnoticed for so long:** the *per-day* dialog has the identical defect but it is
latent — nobody with recorded attendance ever starts checked there, so no row is emitted for them.
Two packets in a row (T305 v1 and v2) reasoned about the per-day dialog and generalised its
accident-of-safety to the whole file. **The bulk path has no such accident.**

**The owner has ruled on sequencing (2026-08-01): finish T305's gate round 2 first, then T307.**
T305 does not make T307 worse and establishes the load seam and recorded-beats-intent rule that
T307's fix reuses. **Do not treat that as permission to leave T307 open indefinitely** — it is the
next task after T305, and it is a bug, not debt.

**When you packet it:** it needs its own load seam across N sessions and — critically — a
**different failure rule** from T305. The per-day dialog may fall back to RSVP seeding when the load
fails, because it only *displays* the seed to a coach who then confirms deliberately. The bulk path
has no display, so **a failed load must abort the write, not fall back.** Do not copy T305's
fallback into it. T307 also owns `loaders/outreach.ts:125-128`'s now-false *"`checkInAt`/`checkOutAt`
pass through as `null` verbatim"*, and the open question of whether the bulk path should also seed
from recorded attendance (the owner's T305 ruling is written in display terms and the bulk dialog
shows no checklist, so the ruling does not cleanly reach it).

### T305 — packet v3 written, gate round 2 of 2 in flight

Three packet revisions, two of them forced by the gate. **Both gate rounds earned their cost, and
both found things no amount of reading would have.** Sequence worth copying:

- **v1** claimed the change was non-destructive, citing `loaders/endMeeting.ts`'s
  `ignoreDuplicates: true`. Accurate citation, **wrong loader** — that is T178's meetings backend,
  not this dialog's write path.
- **v2** fixed that but was **not implementable inside its own Allowed Files**: making
  `buildAttendanceWriteRows`' new parameter required breaks a fifth, *production* call site at
  `MarkEventCompleteDialog.tsx:187`. Measured `TS2554`, `tsc` exit 2. Every worker would have hit a
  mandatory dispute on its first typecheck. v2 also had **four of fourteen criteria that could not
  fail**, two of which its own text argued were sound.
- **v3** adds that file under a two-line authorization, splits the vacuous criterion into a
  pure-function call with an explicitly empty hours map, replaces an impossible mutation, and
  inverts the mock-hardening list (measured: S6/I1 self-protect; S3/S4/S5/S8-late/W2/W3 silently
  pass a broken mock).

**The technique that produced every one of those findings: the gate BUILDS the prescription in its
own worktree instead of reading it.** A gate that only reads returns opinions. Budget for it.

### Process failures recorded this session, both the orchestrator's

- **A ruling that is not written down did not happen.** George's T305 ruling was given 2026-07-31,
  the orchestrator replied "both rulings recorded", and recorded only T304. The T305 packet then
  cited an `auto-mode-decisions.md` entry that did not exist and the gate caught the dangling
  citation. Now recorded, with the failure attached rather than quietly fixed.
- **A green pass count with a nonzero exit code is still the recurring trap.** T305's criterion S4
  reproduces it deliberately: dropping the `.catch` leaves every criterion green at suite **exit 1**.
  Assert exit codes, not just counts.

## UPDATE — 2026-07-31 evening: T179 and T180 merged; T189 diagnosed and waiting on the owner

**`main` = `79e159d`.** Gates there: `tsc` 0 · `vite build` ✓ · prettier clean · eslint
**0 errors / 359 warnings** · vitest **70 files / 1696 tests**. CI green on every merge.

**Merged since midday:** **T179** (PR #10) — `MarkDayCompleteDialog` mounted per-session on
`OutreachDetail`, and its five fixture/placeholder-defaulted props made required so a forgetful
call site cannot compile. **T180** (PR #11) — the real BEH-06 consistency strip mounted on
`/meetings`, and the host's duplicate participation region deleted. Two of the three
"mounted nowhere" rows are now closed; **T189 is the third and is blocked on a ruling.**

**Row numbers are namespaced now — see the ledger's Legend.** T300–T309 is this session's block,
T310–T319 the other session's, T206–T299 deliberately empty. **T300** (`OutreachEventDialog`'s own
placeholder copy), **T301** (three source comments claiming a null check is compiler-required —
measured false) and **T302** (`isEmpty`'s participation clause is asserted by nothing) are filed
and unstarted.

### T189 — DIAGNOSED, needs one owner decision before any packet is written

Traced end to end at `79e159d`. The id resolution and the strip's dot row carry **no `is_active`
filter**; only the participation figure reads `v_student_participation`, which ends
`where s.is_active`. So a deactivated student sees **their real attendance dots beside "no
completed meetings recorded yet this season"** — the two contradicting each other inside one
widget. Reachable: `is_active` appears zero times in `auth.ts` and `guards.tsx`, and nothing has
added a sign-in block since T184.

**The question:** the owner's standing ruling is *"a deactivated student should not be able to
login, if not possible, they should see nothing"* — but T184, which he accepted, shipped **honest
copy** rather than nothing. Four options were put to him (honest copy / hide the strip / blank the
page / close it under item 25); **he has not answered, and no packet should be written until he
does.** Recommendation on the row: follow T184's precedent.

**Scoping constraint that must survive into the packet:** the obvious fix touches either
`ResolveCurrentStudentIdFn`'s return type — shared by three pages — or `ConsistencyStrip`'s props,
an export the parallel T191 session imports and which T180's criterion C6 exists to protect. The
containable design resolves `is_active` alongside the id and branches in `MeetingsList.tsx` alone.

### Owner ruling recorded: T180 stands as shipped

He asked to see it rather than decide from prose. Both versions were rendered from their own
commits with the real stylesheet and shown side by side; he ruled **"keep it as shipped."**
`/meetings` carries one participation figure, inside the strip. The alternative is **closed**, not
deferred. **Process note worth keeping: when a UI decision goes to the owner, render the UI.**

### What the last two tasks cost, and what they bought

Both passed on the first attempt with no BLOCKER or MAJOR from their checkers, and between them
added **one** backlog row (T302) — the other six checker findings were closed in test-only
follow-up rounds rather than filed, because filing is more expensive than fixing at that size.

**The premise gate paid for itself twice and then some.** On T179 it found that the packet's own
prescribed `void reloadDetail()` left 86 tests green and the suite at **exit 1**. On T180 it found
four of seven criteria non-discriminating — including one that failed *both* ways at once. Then
the worker found that **the gate's own prescribed fix was also broken**, flagged it rather than
shipping it, and the checker confirmed the substitution. Gate → worker → checker each caught the
previous link's error.

**The orchestrator's recurring failure, stated plainly:** T180's missing test seam was the **third
repeat** of a shape already documented in `DashboardPage.test.tsx:33-52` and
`OutreachList.test.tsx:158-165`. Both were readable in seconds and neither was read. Criteria keep
getting written against a mental model of the harness instead of the harness.

## UPDATE — 2026-07-31 midday: T178 merged to `main`; T183 open; a T196/T197 number collision

**`main` = `534bdbf`.** PR #7 (T178) merged. CI green on the merge commit's parent
(`Typecheck, Lint, Test, Build, Bundle Size` → success). Gate figures now on `main`: `tsc`
exit 0 · eslint **0 errors / 358 warnings** · **70 files / 1668 tests** · `vite build` ✓ ·
`format:check` clean (all measured with `.env.local` **absent**, the mandated gate state).

### ⚠️ Two different tasks are both numbered T196, and both are numbered T197

This is the one thing in this file that will silently corrupt the ledger if ignored.

| Number | On `main` (from T178) | On `claude/t183-student-home-loader` (from T183) |
|---|---|---|
| **T196** | the parked `EndMeetingDialog` mount — **BLOCKED**, data-loss risk | `StudentHome`'s `events`/`sessions`/`rsvps`/`participation` still have no real loader |
| **T197** | `onEditAttendance`'s row scoping is unasserted — gate on *its* T196 | `students.test.ts`'s bare `rejects.toThrow()` is indistinguishable from a `TypeError` |

Both sessions filed follow-ups from the same next-free number at roughly the same time on
separate branches. **T178's pair is already on `main` and keeps the numbers.** Whoever merges
PR #6 must **renumber T183's pair to T310 (StudentHome loaders) and T311 (test assertion)**
before or during that merge — including the cross-references inside their own row text and in
T183's `verification-log.md` entry. Do not resolve the `task-ledger.md` merge conflict by
taking either side wholesale; both sets of rows are real and all four must survive.

**Root cause worth fixing, not just this instance:** "next free row number" is read from a
file that two branches edit independently, so it is not actually a reservation. Either
reserve numbers in a single place before branching, or namespace them per branch.

### T178 — RESOLVED, merged

Build half only. `src/lib/supabase/loaders/endMeeting.ts` (473 lines) + test (643 lines, 14
tests): a summary loader plus three **sequenced** mutations — absence backfill and checkout on
`attendance`, status flip on `event_sessions`. Plus a module-doc-only correction in
`EndMeetingDialog.tsx`. PASS, first attempt.

- **The ledger's original "wiring gap" framing was wrong.** All three of `EndMeetingDialog`'s
  seams were `console.warn` stubs and no end-meeting backend existed anywhere. This was a build.
- **The mount was split off and parked by owner ruling** (recorded in `auto-mode-decisions.md`).
  `LiveConsole`'s attendance marking is an intentional no-op (`LiveConsole.tsx:510-511`) and its
  roster is a fixture, so a real dialog on top would mark every checked-in student a real
  `absent` row on first use — a complete-looking flow that does something **wrong**. Filed as
  T196 (blocked); see the collision table above.
- **No RPC and no migration**, resolved against the repo's grep-provable no-`supabase.rpc()`
  convention and `makeSetActiveSeason` as precedent. `staff_all` already grants both writes.
- **Write order is load-bearing** — `trg_audit_attendance_post_completion` is `after update on
  attendance` with a live session-status lookup, so checkout must precede the flip. Because the
  flip is last, every reachable partial state fails safe; that, not a transaction, is why no RPC
  is needed. Verified three ways: dropping the `await`s fails 2/14, `Promise.all` fails 1/14,
  flip-before-checkout fails 2/14.
- **Two criteria previously passed against broken implementations** and were rebuilt: identity
  threading (passed when the coach's id was baked at factory-construction time) and write
  ordering (passed under `Promise.all`, because `runMutation` builds its PostgREST chain
  synchronously and a call-order spy cannot tell). Same shape as T170's and T181's BLOCKERs.
- **Known residual, disclosed:** two false "single transaction" claims remain at
  `EndMeetingDialog.tsx:588` and `:597`, inside a function body the task's scope forbids
  touching. Dev-console strings only, never rendered.

### T183 — RESOLVED, merged onto its own branch; PR #6 still open against `main`

Fixed `StudentHome`'s fabricated `'Ada Reyes'` greeting; real `students.display_name` is now
the production default. Checker PASS, ledger and verification-log recorded. **PR #6 has not
merged** — it is based on `a3b9f00` and `main` has since moved to `534bdbf`, so it needs an
update-from-`main` and will conflict on `task-ledger.md` and on this file's top section (both
branches inserted an UPDATE at the same anchor). Resolve by keeping **both** sets of rows and
both UPDATE sections, then apply the T310/T311 renumber above.

### T173 — in progress, other session

Packet finished its final revision. Round 2 of the premise gate found two real BLOCKERs, both
proven by executed tests and fixed; the owner authorized a bounded third round. Dispatching
straight to the worker — no third gate round. **T191 and T158 not started.**

### Branch/PR state right now

- `main` = `534bdbf`. **No open PR against `main` except #6.**
- `claude/t178-end-meeting-dialog` — merged via PR #7. **Do not reuse.**
- `claude/t183-student-home-loader` — PR #6, open, needs the update + renumber above.
- `claude/swarm-plan-zl575z` — restarted from `main` after PR #3 merged; carries doc updates only.

## UPDATE — 2026-07-31 (latest of the latest): `main` has moved far ahead; PR #6 needs real reconciliation, not just an update

**Read this before touching PR #6 or filing any new row on this branch.** `origin/main` is now at
`b0a62c3` (checked live, not from memory) — a parallel session ("session A"/"session B" split) has
landed T178, T179, T180, and pushed task numbering all the way to **T302**, plus a formal
**per-session row-numbering protocol** or in `main`'s own `task-ledger.md` header (search
"NAMESPACED PER SESSION"). Key facts:

- **`main` now names this branch "session A" and reserves it the block `T310–T319`**, with `main`'s
  own placeholder rows `T310`/`T311` explicitly annotated *"this is T183's renumbered 'T196'/'T197'"*.
  **This branch does not use that block.** Earlier in this session (before this discovery), the
  T196/T197 collision was resolved *locally* by renumbering to **T199/T200** instead — a
  reasonable, correct decision at the time (nothing on `main` used those numbers then), but it does
  not match what `main` came to expect afterward. **This is not a live collision** — `main`
  currently has no real content at T198–T205, only reservation placeholders — but it does mean the
  two branches' numbering schemes disagree, and reconciling them is real work for whoever merges
  PR #6, not a formality.
- **This branch's actual usage, for the record:** T198 (CoachHome team-linkage question, filed
  packeting T173), T199/T200 (renumbered T196/T197, filed packeting T183), T201 (`is_active`
  family, filed packeting T191), T202 (ProgressBar a11y clamp, checker-found on T191), T203
  (Leaderboard embed, filed packeting T158), T204 (stale RLS comment, filed packeting T158), T205
  (anon view exposure, checker-found on T158, owner-ruled "close it off"). All eight are real,
  filed, cross-referenced across `task-ledger.md`/`verification-log.md`/`auto-mode-decisions.md`
  many times each — **renumbering them now to fit `main`'s `T310–T319` block would be a large,
  error-prone rewrite for a problem that isn't actually a collision.** Recommend the merge-time
  reconciliation go the other way: delete `main`'s unclaimed `T310`/`T311`/`T312–T319` placeholder
  rows (`main`'s own stated rule already covers this: *"Delete any reserved row left unclaimed when
  a block closes"*) and note in `main`'s ledger that session A used T198–T205 instead, before the
  block protocol existed on this branch.
- **PR #6 (`claude/t183-student-home-loader` → `main`) is based on `main` @ `a3b9f00`, now well over
  a hundred commits behind `origin/main`.** This needs a real merge/rebase, not a fast-forward, and
  the conflict surface is large: both branches independently edited `task-ledger.md`'s row-numbering
  section, `RESUME-HERE.md`'s top-of-file UPDATE anchor (repeatedly, on both sides), and likely
  `state-summary.md`/`auto-mode-decisions.md` too. **Not attempted in this session** — it's a
  meaningfully bigger and riskier operation than the four tasks (T183/T173/T191/T158) this session
  was asked to run, and doing it unprompted risks silently dropping one side's history. Flagged for
  the orchestrating session/owner to decide how to proceed, not resolved here.
- **If you're a fresh session picking this up:** re-fetch `origin/main` yourself before trusting any
  commit SHA or task count in this file — both branches are moving, and the gap between them may
  have changed again since this note was written.

## UPDATE — 2026-07-31 (previous): T196/T197 collision resolved, `main` now carries T178 too

A **parallel session** operating on `main`/`claude/swarm-plan-zl575z` merged **PR #7 (T178)**
while this session was mid-flight on `claude/t183-student-home-loader` (PR #6) and flagged, via a
note relayed through the human owner, that both sessions had independently filed **T196 and T197**
for two entirely different tasks each — "next free number" is read from a file two branches edit
independently, so it was never actually a reservation.

- **`main` = `534bdbf`, carrying T178 (real end-meeting backend; mount deliberately parked as its
  own T196, blocked on `LiveConsole`'s own loaders becoming real).** `main`'s T196/T197 are now
  canonical (they landed first): **T196** = the parked `EndMeetingDialog` mount (blocked, data-loss
  risk), **T197** = `onEditAttendance` row-scoping unasserted (must land together with T196, not
  before).
- **This branch's own T196/T197 (filed while packeting T183) have been renumbered to T199/T200**
  in `task-ledger.md`/`verification-log.md` here — **T199** = `StudentHome`'s deliberately-deferred
  `events`/`sessions`/`rsvps`/`participation` real-loader work, **T200** = the MINOR
  `students.test.ts` assertion-tightening follow-up. T198 (this branch's own `CoachHome`
  team-linkage product question, filed while packeting T173) did not collide and keeps its number.
  **All four original rows are real and none were dropped** — this was a pure renumbering on this
  branch's copy, not a resolution-by-picking-a-side.
- **PR #6 is now behind `main`** (based on `a3b9f00`; `main` has moved to `534bdbf` via PR #7).
  It will need an update-from-`main` before it can merge, and that update **will conflict** on
  `task-ledger.md` (the T196/T197 numbers, now resolved by the renumbering above — take this
  branch's T198/T199/T200 rows AND main's T196/T197 rows, don't drop either side) and on this
  file's own top section (both branches independently inserted a dated UPDATE at the same anchor
  point — keep both blocks, don't pick one).
- **Two corrections to the still-open triage proposal further down this file**, both measured
  rather than guessed, from the same parallel session's work on T178: the "T178/T179/T180 — three
  finished components mounted nowhere" framing held for only one of the three.
  - **T179** (`MarkDayCompleteDialog`) is a real wiring gap, but not a simple mount: its
    persistence seam is already real (`markDayComplete`, shipped by T101), but four other props
    (`session`, `roster`, `rsvps`, `currentUserProfileId`) still default to fixtures/a placeholder.
    Mounting it as-is risks one forgotten prop writing real attendance rows for fixture students —
    T151's required-prop mechanism needs to land first.
  - **T180** is genuinely cheap and low-risk: all three of its seams already default to real
    loaders, and it's read-only. It was also **missing from every triage table entirely** — the
    proposal's "37 → 16" result should have been "37 → 17."
- **Backlog as it actually stands, this update:** of the ten original user-facing rows, seven have
  closed (T169, T177, T178, T183, T173, T191, and now **T158** — all merged on their own branches,
  T183/T173/T191/T158 on `claude/t183-student-home-loader`/PR #6, not yet merged to `main`). T173
  PASSED with 4 NIT (residue covered by T198); T191 PASSED with 3 NIT (residue filed as T202); T158
  PASSED with 1 MINOR (residue filed as T205, owner-ruled "close it off," not yet dispatched).
  Remaining: T179, T180, T189, plus the residue rows (T193, T194, T195, T198, T199, T200, T201,
  T202, T203, T204, T205, and whatever T178/T179's own follow-ups turn out to be) — **T158's own
  embed half, T203, is the most natural next pick** (its design/CSS-hazard investigation is already
  written into the row). **The triage proposal's cuts are still unapplied and still awaiting the
  owner's veto** — this update doesn't apply them either.
- **T173 also hit item 19a's 2-round cap — twice, on the same packet** (two separate
  owner-authorized bounded exceptions, both proven narrow by execution rather than open design
  disputes; see its `verification-log.md` entry and `auto-mode-decisions.md`). Adopted a cheaper
  design mid-packeting (thread `defaultGoalHours` from `activeSeason.season`, matching T176's
  shipped pattern) rather than a third Supabase query. `teamId` deliberately unresolved, filed as
  **T198** (product question, not a schema gap to guess at).
- **T191 was a genuine open product question, not a mid-flight gate escalation** — `RESUME-HERE.md`
  had already flagged it under "Awaiting the owner's answer" before this session began. George
  chose "no bar at all" over a season-default number (the latter would have needed a new SQL view
  and opus tier). Its own packet then hit item 19a's cap once (1 MAJOR: a naive page-wide
  progressbar count would have been vacuous by fixture coincidence — `ConsistencyStrip` renders its
  own bar independent of `isActive`, and both test fixtures happened to pin `participation: null`;
  fixed via a selector scoped to the Hours-vs-goal section specifically). Split off **T201**
  (`confirmedHours`/`is_active`, undiagnosed scope, same posture as T189) and **T202** (a sibling
  `ProgressBar` clamp elsewhere still fabricates `aria-valuemax` for assistive tech).
- **T158 was the highest-scrutiny task this session — a new database migration.** Split into the
  real data layer only (this row) vs. the embed (**T203**), since item 18's migration trigger
  forces opus/full-gate regardless of the UI half's size. Hit item 19a's 2-round cap **twice on one
  packet** (both owner-authorized): round 1→2 fixed a false supporting claim (only 1 of 3 cited
  "already-queried" views actually was) and extended the RLS trace to the loader's own unfiltered
  `v_student_hours` read; round 2→3, George asked a clarifying question about why a scratch Postgres
  was needed before authorizing (recorded in `auto-mode-decisions.md`), closing a vacuous
  live-DB-proof criterion. **The core RLS/view-visibility mechanism was empirically verified four
  times by three different agents** (`@electric-sql/pglite`, an in-process WASM Postgres, ~40s
  setup, no Docker) rather than reasoned about — this project had gotten a closely related RLS/view
  claim wrong twice before (`dashboard_views.sql`, then `loaders/students.ts`), so nothing here was
  taken on argument alone. **Follow-up: T205** — checker found the new view is also readable by
  Supabase's unauthenticated `anon` key (not just logged-in users), a different threat model than
  T185's already-settled "any authenticated caller" ruling; George ruled "close it off" (one-line
  revoke migration, not yet dispatched, needs its own full opus-tier gate per item 18 regardless of
  size). Also filed **T204** (a second, previously-undisclosed instance of the same stale-RLS-comment
  class T158 fixed once in `dashboard_views.sql`'s wake, found this time in `loaders/students.ts`).

## UPDATE — 2026-07-30 evening: T183 landed on its own branch, `main` unchanged

- **`main` is still `94267a0` / 69 files / 1654 tests** — nothing below in the 2026-07-31
  UPDATE section changed. T183 landed on a **separate** branch, `claude/t183-student-home-loader`
  (PR #6, draft, not yet merged into `main`), cut fresh from `main` for exactly this purpose.
  **On that branch only**, HEAD is `b21a603` and the suite is **69 files / 1660 tests** (+6, a
  disclosed, checker-ruled-correct delta from T183's own mandated new test coverage — see its
  `verification-log.md` entry). Do not read `1654` as the count on that branch, and do not read
  `1660` back onto `main` until it actually merges.
- T183 fixed `StudentHome`'s fabricated `'Ada Reyes'` greeting (real `students.display_name` now
  wired as the production default). Went through a full 2-round `checker-premise` cap (item 19a)
  — round 1 found a genuine BLOCKER, round 2 found only narrow packet-text mismatches after
  independently building and running the full fix clean — then one owner-authorized bounded
  revision round, same escalation shape as T177's earlier one this session. Follow-ups filed:
  **T196** (the deliberately-deferred `events`/`sessions`/`rsvps`/`participation` real-loader
  work), **T197** (MINOR test-assertion tightening).
- Same branch/PR is being used for T173, T191, T158 next (owner instruction, 2026-07-30) rather
  than opening a new branch per task — matching this project's own established convention of one
  PR accumulating several tasks before merging to `main` (see PR #3's 16-task history above).

## UPDATE — 2026-07-31: branch state, and two triage rows resolved

- **PR #3 and PR #4 are both merged into `main`.** `main` = `94267a0`, carrying everything
  through T177 plus the View As feature requirements/design docs (PR #4). No open PRs remain.
  `claude/swarm-plan-zl575z` (`f7e3143`) is content-equivalent to `main` but sits 2 commits
  "behind" it in graph terms — GitHub's PR-merge created `97398ff` on `main` directly, and a
  manual reconciling merge added `94267a0`, neither replayed onto the feature branch.
  Harmless, but `git pull origin main` into this branch before starting new work on it.
- Working tree clean. Gates re-measured green at `main`/`f7e3143`: `tsc` exit 0 · eslint
  **0 errors / 358 warnings** · **69 files / 1654 tests** (measured with `.env.local`
  **absent**, the mandated gate state) · `vite build` ✓. One pre-existing, unrelated
  `prettier --check` warning on `src/theme/volt.ts` predates this session (confirmed present
  at `fe62f88`, before any of today's commits) — not this session's to fix.
- **The `.claude/worktrees/agent-a640406e50762373c` preservation note above no longer
  applies.** That directory is empty in this checkout and `git worktree list` has no record
  of it — specific to whatever filesystem wrote the note, not something deleted here.
- **T169 and T177 both landed** (see below), resolving 2 of the triage proposal's "KEEP — a
  user hits this" rows. **The rest of the triage proposal (further down this file) is
  unchanged and still awaiting the owner's veto** — do not treat T169/T177 landing as any
  kind of signal about the other rows in that proposal.

### Landed 2026-07-30/31

- **T169 (OutreachDetail half) — merged `18b481c`.** PASS, attempt 1, no BLOCKER/MAJOR/MINOR
  (2 NIT, log-only). Mounted `RsvpControl` role-gated beside T157's `ParentRsvp` for the
  signed-in student's own roster row, via a new `resolveOwnRosterStudent`. 2 rounds of
  `checker-premise` (round 1 REVISE on a scope claim that went stale mid-session — T170 had
  merged — round 2 DISPATCH). **Follow-up filed: T193** — the `OutreachList.tsx` student
  half of T169 (the other row referenced in the old triage table below), now genuinely
  unblocked since T170 supplies a real `viewerStudentId`. Not yet packeted.
- **T177 — merged `18b481c` (source work), reconciled onto `main` at `94267a0`.** PASS,
  attempt 2 (attempt 1 FAILed on 1 MAJOR: a new test wasn't actually hermetic to the
  env-injection claim it made). Wired a real, injectable Functions-URL resolver and a new
  `loaders/calendarFeed.ts` replacing a placeholder host and a fixture feed. **Heaviest
  premise-gate history of any task yet** — 2 REVISE rounds (3 BLOCKER/2 MAJOR, then 1 new
  BLOCKER/2 new MAJOR introduced by the first round's own fixes), hit item 19a's 2-round
  cap, escalated to the human owner, who authorized one bounded revision-round exception
  (recorded in `auto-mode-decisions.md`, "George's ruling on T177's item-19a escalation" —
  a **structured-selection** ruling, not a verbatim quote; the entry says so explicitly).
  **Follow-ups filed: T195** (nothing anywhere provisions a `calendar_feeds` row — the real
  remaining gap; T177 makes the widget's failure *honest*, not the feature *functional*) and
  **T194** (`onResetFeedToken`, same defect family, sequence after T195).
- **Both merged via a deliberate test of running the packet → premise-gate → worker →
  checker pipeline through subagents**, to see whether it reduces context growth in the
  orchestrating session. **It worked** — each stage ran in its own subagent transcript; only
  dispatch prompts, file reads, and final summaries landed here. Worth repeating.
- **PR #3 and PR #4 both required manual intervention to merge.** PR #3 was initially
  blocked by GitHub's stacked-PR restriction (PR #4 had it as a base) — no CLI/API
  workaround found; the owner unstacked both in the GitHub UI, after which the normal merge
  API worked. PR #4 merged into the *feature branch* (its base ref), not `main`, so `main`
  needed a **second, separate, real merge** afterward (a raw fast-forward push was rejected
  as non-fast-forward, since `main`'s own PR-merge commit had diverged from the feature
  branch in the interim).

### New rows filed this session (not part of the pre-existing triage proposal below)

- **T193** — `OutreachList.tsx`'s student-facing RSVP control (T169's other half). A
  reusable pattern already exists from T169's OutreachDetail half — the packet should
  evaluate whether it transfers directly.
- **T195** — the `calendar_feeds` provisioning gap. Likely needs a migration (item 18
  trigger 1 → opus tier) alongside `fn_handle_invite_acceptance`. Sequence before T194.
- **T194** — `SubscribePopover.tsx`'s `onResetFeedToken`, same fixture-default defect family
  as T177 just fixed, one function over. Sequence after T195.

### New process lessons this session

- **A `git stash`/`git stash pop` cycle mid-merge silently destroys `MERGE_HEAD`.** Paid for
  on T177's merge: after `git merge --no-ff --no-commit`, a stash-and-pop used to spot-check
  an unrelated pre-existing prettier warning cleared `.git/MERGE_HEAD` without any error
  message, and the subsequent `git commit` landed a **single-parent commit** — correct file
  content, wrong lineage. Caught only by checking `git log --pretty=%P` out of habit. Fixed
  via `git commit-tree` with the correct two parents against the already-correct tree,
  rather than redoing the work. **Rule: never run `git stash` between `git merge --no-ff
  --no-commit` and the final `git commit`** — use a disposable worktree for any mid-merge
  spot-check instead.
- **GitHub's stacked-PR restriction blocks the merge API, not just a UI button.** PR #3
  couldn't be merged via `gh pr merge` while PR #4 (open, based on PR #3's head branch)
  existed. No workaround found short of the owner unstacking both in the GitHub UI. Check
  for other open PRs based on the same head branch before attempting a PR merge.
- **Merging a PR whose base is a feature branch (not `main`) does not update `main`.** Needs
  a second, real merge afterward — not something the original PR's merge does for you, and
  a raw ref push will be rejected non-fast-forward if `main` has since diverged.
- **The subagent-pipeline dispatch pattern measurably reduces orchestrator context growth**
  — validated deliberately as a test on T169 and T177. Default to it for future tasks.

---

## Where the repo is (as of 2026-07-30 — see the 2026-07-31 UPDATE section above for what changed)

- **PR #2 is merged** and must not be reused. `main` = `f7ff055`.
- **PR #3 is open** (`claude/swarm-plan-zl575z` → `main`), carrying **16 merged tasks**.
- Gates measured green at `3e967e6`: `tsc` exit 0 · eslint **0 errors / 356 warnings** ·
  **68 files / 1631 tests** · prettier clean · `vite build` ✓.
- One worktree is deliberately preserved: `.claude/worktrees/agent-a640406e50762373c`
  (T144's contrast evidence, D011). **Do not delete it.** All others cleaned up.
  **[2026-07-31: this worktree does not exist in the current checkout — see UPDATE.]**

## The headline: both defect families that produced every real bug are now closed

**1. Fabricated dashboards — CLOSED.** All three role dashboards rendered fixture data on
live routes. `CoachHome` (T155), `StudentHome` (T176), `ParentHome` (T181). All three now
show real data. Residuals are filed, not forgotten: T173, T183, T191.

**2. Placeholder-default props — mechanism closed on the dialogs.** T151 made `teams`
required and deleted all three fixtures, so a forgetful call site **cannot compile**.
T170 and T176 fixed the two live-route instances. T172 remains: generalise the mechanism.

## Landed this session (16 tasks)

T142–T151, T154, T155, T157, T170, T176, T181, T184. Full detail per task in
`verification-log.md`; every merge carries its ledger row in the same commit (item 24).

**User-visible fixes the owner reported or would notice:** the dashboard `22P02` failure
(T155), meeting creation (T147), the light/dark control (T148), per-user theming (T154),
self check-off on `/outreach` — which was silently failing against a nonexistent student
(T170), and honest copy for a deactivated student (T184).

## Ready to dispatch, in priority order

1. **T158** — Leaderboard, embedded in the dashboard per the owner's ruling. **Unblocked**
   now T155 landed; `CoachHome` sources a real `seasonId`, so the embed inherits it free.
   Two units: build a real `loadLeaderboardData` (none exists), then embed. Note T155
   restructured `CoachHome` into an outer/inner split — older line citations are stale.
2. ~~**T169**~~ — **DONE 2026-07-31** (OutreachDetail half, `18b481c`). Other half re-filed as
   **T193**, still open — see the 2026-07-31 UPDATE section at the top of this file.
3. **T172** — the mechanism fix, and **it should now absorb the vacuous-absence problem**
   (see below), not just the placeholder-default one.
4. ~~**T178**~~ / **T179** / **T180** — filed together as "three finished, tested components
   mounted nowhere, each with a 'not shipped yet' stub at the intended host." **That framing
   held for only one of the three. Probe each before packeting — measured 2026-07-31:**
   - **T178 — was not a wiring gap at all.** No backend existed; all three seams were
     `console.warn` stubs. It became a build, and its mount was parked (T196). **Merged.**
   - **T179 — a genuine wiring gap, but do not mount it as-is.** The persistence seam is
     already real: `onMarkComplete` defaults to `markDayComplete`
     (`loaders/outreach.ts:1200`, shipped by T101). The hazard is the *other* four props —
     `session`, `roster`, `rsvps` and `currentUserProfileId` all default to fixtures /
     `PLACEHOLDER_CURRENT_COACH_PROFILE_ID` (`MarkDayCompleteDialog.tsx:655-660`). Mounting
     while those defaults exist means one forgotten prop writes **real** attendance rows for
     **fixture** students. **Apply T151's mechanism first — make the four required and delete
     the defaults, so a forgetful call site cannot compile** — then mount. This is the
     placeholder-default family, not a new risk.
   - **T180 — the cheapest of the three, and genuinely low-risk.** All three seams already
     default to real loaders (`loadConsistencyStripDataFromSupabase`,
     `loadLinkedStudentsFromSupabase`, `resolveCurrentStudentId`,
     `StudentMeetingView.tsx:1052-1055`) and the component is **read-only — no mutations at
     all**, so neither T178's data-loss shape nor T179's fixture-write shape applies. Scope
     nuance from its ledger row still stands: this is the **outer wrapper only**; the same
     file's `ConsistencyStrip` export is already reachable via `ParentHome` and must not be
     disturbed.

## Blocked on the owner, not on us

`T052`, `T063`, `T064`, `T065`, `T070` — production email, MIG-04 validation, cutover,
Vercel go-live. **These are what stand between this app and being used.** Everything else
is polish on something not yet deployed.

## Owner rulings — cite the record, never a paraphrase

All verbatim in `auto-mode-decisions.md`. Packets have falsely promoted the orchestrator's
decisions to owner authority **three times, two shipped**. Rule: an owner-approval claim must
cite a section of that file, or it is the orchestrator's decision and must say so.

On record: keep the localStorage seed · ratify the `CoachHome.test.tsx:1194-1196` amendment ·
fix the shared-browser theme bleed properly · embed the leaderboard in the dashboard ·
`ParentRsvp` in `OutreachDetail` · `RsvpControl` on **both** surfaces · a deactivated student
should not be able to log in, or failing that should see nothing · **proportionality**
(constitution item 25 — grade security findings against a small volunteer team, not a company).

## Awaiting the owner's answer

- **T188** — two "confirmed hours" numbers that can legitimately disagree, so one student can
  see different totals on two screens. Naming or reconciling is a product call.
- **T191** — a deactivated child's card shows `0 / 1 h`, where the `1` is a UI clamp artifact
  in no data source. Season default, or no bar at all?

## Hard-won process lessons — each was paid for

- **The vacuous-absence assertion is now structural, not careless.** Seven instances across
  six tasks — and the seventh was **inside a criterion explicitly written to prevent it**
  (T181 revision 1: "state this ordering so the criterion cannot pass by accident"; it passed
  with the entire bug restored). Declaring an ordering does not make an absence assertion
  safe. Only pairing it with a positive does. **T172 should absorb this.**
- **A criterion that cannot fail is worse than no criterion.** Prescribe the mutation, run it,
  report the failure output. Watch for fixture collisions where the "real" and mutated values
  are the same string — that killed a T176 criterion outright.
- **Cite by symbol, not line number.** Ten-plus citation errors reached artifacts in one day,
  mostly line numbers lifted from grep output without checking which construct they belonged
  to. See `architecture-review-parallelism.md` §3.1.
- **Do not describe a screen from reading code — render it.** Three successive descriptions of
  one screen were wrong; every correction came from an agent that dumped the DOM.
- **Verify the fix's premise, not just its logic.** T154's prescribed remedy would never have
  fired — it assumed a non-null → non-null transition, but `logout()` sets `user: null` first.
  Measured: a green suite with the bug intact.
- **A false claim in a module doc has the same reach as one in a packet, and nothing gates
  module docs.** "MET-04's denominator has no SQL view" appeared in five artifacts and cost
  T176 a full round; it was still sitting in `ParentHome.tsx` when T181 started.
- **Agent worktrees are cut from `main`, not the branch tip — merge the branch in first.**
  T157's worker built ~320 lines against a superseded packet revision for want of this check.
- **Mutations run in the agent's own worktree** (item 23), never the shared tree.
- **Dispatch a gate that can write.** `checker-premise` has Bash but no Write/Edit, so it
  cannot run prescribed mutations. Gates that found BLOCKERs were general-purpose agents with
  write access in their own worktree.
- **Gate proportionately (item 25).** T151 skipped a gate (mechanical, compiler-enforced) and
  passed clean; T170 got a narrow one and it found a BLOCKER; T181 got a full one and it found
  two. Match the round to the risk, not to the topic.

---

# TRIAGE PROPOSAL — 2026-07-30, awaiting the owner's veto

**Written because the process was generating work faster than it closed it.** The owner
measured it: 27 open rows this morning, 37 by evening, 5 tasks merged in between — **2 new
rows filed per task merged** — against **54% of the token allowance spent**. T181 alone cost
roughly **1.1M tokens** (foreman 187K + gate 164K + foreman revision 267K + worker 346K +
checker 132K). At that rate the backlog never closes and the app never ships.

**The cause is a policy I chose and never checked with him:** checkers are instructed to find
things, and I filed *everything* they found. Most of those rows are artifacts of reviewing, not
defects a user meets.

**Nothing below is executed. The owner vetoes individually, then a session applies it.**

## Rule applied

A row survives only if **a user hits it, or it blocks deployment.** Everything else closes —
closed, not deferred. If a closed item ever bites, it gets re-filed with a real symptom
attached, which is cheaper than carrying it.

## KEEP — the deployment path (5). Only the owner can move these.

| Row | Why |
|---|---|
| T052 | production email enablement — HUMAN GATE |
| T063 | MIG-04 validation gates + sign-off — HUMAN GATE |
| T064 | roster → accounts post-migration verification (MIG-05) |
| T065 | MIG-06 cutover — HUMAN GATE |
| T070 | Vercel domain go-live — HUMAN GATE |

**The app is not deployed.** Polish on an undeployed app is unbounded, which is the real reason
the backlog grows. These five are the only path to "finished".

## KEEP — a user hits this (10 — was 9; T180 was missing, added 2026-07-31)

| Row | Why |
|---|---|
| T169 | **RESOLVED 2026-07-31, merged `18b481c` (OutreachDetail half).** The `OutreachList` half is re-filed as **T193**, still open. |
| T177 | **RESOLVED 2026-07-31, merged (see UPDATE section above).** Provisioning gap it exposed is re-filed as **T195**; `onResetFeedToken` as **T194**. |
| T183 | **RESOLVED 2026-07-31**, merged onto `claude/t183-student-home-loader`; **PR #6 still open against `main`** (see the midday UPDATE). Residue re-filed as that branch's T196/T197 — **renumber to T310/T311**. |
| T173 | **IN PROGRESS 2026-07-31** (other session) — packet final revision done, worker dispatching. `CoachHome`'s three fabricated surfaces (`0 / 38 hrs`, `Default goal 10h`, admin Season-setup card) |
| T191 | a deactivated child's card shows a `1 h` goal that exists in no data source |
| T158 | Leaderboard — owner-ruled to embed in the dashboard; unblocked |
| T178 | **RESOLVED 2026-07-31, merged `534bdbf` (PR #7) — build half only.** The ledger's "mounted nowhere" framing was wrong: there was no backend to mount. The mount is parked as **T196 (blocked, data-loss risk)**; its test-integrity gate is **T197**. See the midday UPDATE. |
| T179 | `MarkDayCompleteDialog` — a real coach workflow action. **"Same shape" as T178 turned out to be wrong** (measured 2026-07-31): its persistence seam is already real, but four props default to fixtures/placeholder. Must apply T151's required-prop mechanism *before* mounting. See "Ready to dispatch" item 4. |
| T180 | **Omission in this triage — it belongs here and was left out of every table below.** `StudentMeetingView`'s outer wrapper, mounted nowhere. Measured the cheapest of the three: all seams already default to real loaders, and it is read-only, so no write-path risk. Outer wrapper only. |
| T189 | `MeetingsList` participation reads an `is_active`-filtered view; **impact genuinely unknown** — investigate, then fix or close |

## KEEP — cheap and pays for itself (2)

| Row | Why |
|---|---|
| T156 | the loader throws away the real Postgres error. This is why diagnosing the dashboard bug needed DevTools and a screenshot. Makes every future bug cheaper. |
| T175 | add `format:check` to CI — minutes of work, closes a silent-drift class |

## CLOSE — process artifacts, no user impact (13)

| Row | Why it closes |
|---|---|
| T152 | a test guard that discriminates in one direction. No user meets a half-strength guard. |
| T171 | a true property that no test pins. The code is correct. |
| T190 | fixture id-space rekeying so *future* tests are discriminating by construction |
| T174 | `FIXTURE_RSVPS` id-space confusion — fixture-only |
| T186 | a view column's comment says display-only. A comment. |
| T160 | a type is still called `FixtureTeam`. Cosmetic. |
| T182 | delete `StudentHomeSlot.tsx` — dead code hurting nobody |
| T187 | dual-team narrowing, deliberate and disclosed. **Re-open when a student actually joins two teams.** |
| T192 | per-card full-table reads — fine at one team, one season (item 25) |
| T168 | the placeholder sweep. **The audits are done**; both families were found and closed. |
| T172 | the mechanism fix. T151 already made the dialogs compiler-enforced and every known instance is fixed; this now only prevents hypothetical future ones. |
| T144 | already closed as no-change (D011) — listed so it is not re-opened |
| T153 | already ruled by the owner (keep the seed) — listed so it is not re-opened |

## CLOSE — test coverage (7)

**T161, T162, T163, T164, T165, T166, T167** — seven loader files with no unit tests.

The risk is real and the cost is not worth it here. The suite is already **1631 tests**, and
every loader bug that actually mattered this project was caught by the owner using the app, not
by a unit test. **If a loader bug bites, write that loader's test then**, with a real symptom to
target. Carrying seven speculative rows costs more than it saves.

## ASK THE OWNER — one line each (2)

| Row | The question |
|---|---|
| T188 | Two "confirmed hours" numbers exist and can legitimately disagree — attendance-backed vs RSVP-backed — so one student can see different totals on two screens. Rename them, or make outreach read the attendance number? |
| T191 | (also in KEEP) A deactivated child's goal bar: season default, or no bar at all? |

## Result if accepted

**37 open → 17** (was stated as 16; T180 was missing from the tables — corrected 2026-07-31),
of which **5 are the owner's deployment gates** and **2 are cheap infrastructure**. Ten real
user-facing items remain, most of them small.

**Since this proposal was written, four of those ten have closed** — T169, T177, T178 and T183
(T183 pending PR #6's merge) — and **T173 is in progress**. The remaining user-facing work is
**T191, T158, T179, T180, T189**, plus the residue rows T193/T194/T195, T196/T197, and T183's pair at T310/T311.
That is the honest current shape of the backlog; **the proposal's cuts are still unapplied and
still awaiting the owner's veto.**

## And the process change that matters more than the cut

**Match weight to risk — constitution item 25 already permits this and I under-used it.**

- T151: no premise gate, sonnet worker, `checker-tests`. **Passed clean, roughly a tenth of
  T181's cost.** That should be the default.
- T170: narrow gate — found a BLOCKER. Worth it.
- T181: full gate — found two BLOCKERs. Worth it, but a 1.1M-token task.

**Reserve foreman + gate + opus checker for live-route bugs.** Everything else: packet, worker,
cheap checker. And **stop filing findings as rows** — a checker's observation gets fixed in the
moment or dropped, unless a user meets it.
