# GAM-491 — run log

Coach attendance chips can never be tapped — `SchedulePanel` ships with no roster.

Branch: `claude/gam-491-schedulepanel-roster`
Orchestrator: claude (dispatched run, 2026-08-23)
PR credential `exp` decoded at minute ~1: `1787487911` (58 minutes of budget from
minute 1). Draft PR to be opened well before minute 53 (AGENTS.md wall 3).

Append-only. One line per milestone. Pushed immediately after each append.

---

- **11:26Z — claimed.** `GAM-491` moved `Todo → In Progress` and read back
  (`state.name = "In Progress"`). `tier/unreviewed` replaced with `tier/standard`;
  `meetings-redesign` added. No `gate/human`, no executor label → legacy
  Claude-only route (item 28b), and this runtime is Claude.
- **11:26Z — tier judged STANDARD** (item 28d, defended in the claim comment).
  Measured, not assumed: the change is a read-only loader plus three props at one
  call site. No unconditional HEAVY trigger applies — no migration, no RLS or
  security-definer, no auth/session/role-resolution change, no metric SQL, no
  write path at all (the write seams are already connected and are explicitly out
  of scope), and no contract change (`SessionRosterEntry` and the `roster` /
  `isRosterLoading` / `rosterError` props already exist and are exported on
  `main`). The read seam is established: `loaders/kiosk.ts:460` and
  `loaders/endMeeting.ts:339` already read `students` + `attendance` for one
  session as a coach, so no new view or policy is implied. Item 26's
  presented-values carve-out routes this to STANDARD **with a required acceptance
  checker** (role-sensitive presentation; user-data reporting whose mapping could
  mislead; item 6's first-name + last-initial rule).
- **11:29Z — claim comment posted** to GAM-491 (`comment-3863a292`), carrying the
  tier defence in full.
- **11:31Z — draft PR #245 opened** at ~minute 5, with the branch carrying only
  the run log and the PR-body artifact. `check.mjs` on the artifact: `OK
  declaration closes GAM-491`, exit 0.
- **11:38Z — premise re-measured; a stale checkout nearly produced a false
  refusal, recorded here because the next reader deserves the correction.** The
  dispatch container cloned `main` at `8f0f1eee` (PR #244), which is **one merge
  behind**: GAM-452's PR #242 merged at `2026-08-23T11:25:19Z`, roughly one minute
  before this run started, landing as `5bf0cb78`. Against the stale tree
  `SchedulePanel` had **no caller anywhere in `src/`**, and the issue's
  `CoachMeetingsView.tsx:760-790` citation resolved to unrelated code — which
  reads exactly like a false premise. It is not one. After
  `git fetch origin main` + rebase onto `5bf0cb78`, `CoachMeetingsView.tsx:760`
  mounts `<SchedulePanel` as the issue describes. **Premise holds.** Branch
  rebased onto `origin/main`; all further measurement is against `5bf0cb78`.
- **11:52Z — packet written** (`docs/swarm/active/GAM-491-packet.md`), every
  citation verified against `5bf0cb78` by the orchestrator (item 19c). Two of the
  issue's own citations were corrected in §2. **§3 is the finding that decides the
  packet:** `makeLoadAttendanceForSessions` (`attendance.ts:412`) is the only
  attendance read in `loaders/` that does **not** apply `excludeUnmarked`
  (`attendance.ts:391-402` selects `*` raw; `:308-322` copies `row.status`
  straight into a type that cannot hold `'unmarked'`), so GAM-479's cleared-mark
  sentinel can escape the loader boundary the invariant at `attendance.ts:224-231`
  says it never does. The new roster loader must map it to `null` itself; the
  upstream gap is an item 20 follow-up the orchestrator files.
- **11:54Z — DISPATCHED `worker-implementer`** on the GAM-491 packet, with
  `run_in_background: false`; this orchestrator is blocking on it. Model: the
  agent's pinned default (sonnet) — **no `model: "opus"` override**, because none
  of item 18's four triggers applies (no file under `supabase/migrations/`, no RLS
  or `security definer` helper, no metric-view SQL, no auth/session/role or
  permission logic). Item 25's second obligation is the reason that is written
  down rather than assumed: a topic sounding sensitive is not a tier trigger.
  **If this line is the last one in this file, the run died holding this
  subagent.**
- **12:11Z — worker VERDICT: complete, reported as `86ca2a9a`.** Existence
  verified by the orchestrator rather than taken on trust (item 21): HEAD moved to
  `86ca2a9a`, `git status --porcelain` is empty, and `git diff --stat origin/main`
  shows the four Allowed Files in the committed blob (`sessionRoster.ts` +240,
  `sessionRoster.test.ts` +360, `CoachMeetingsView.tsx` +96,
  `CoachMeetingsView.test.tsx` +200) and nothing else under `src/`. Worker's own
  gates: `typecheck` 0, `lint` 0, `format:check` 0, scoped `vitest` 0 (40/40), and
  a volunteered full-suite run 0 (2805 tests). Worker declares one deferral (the
  §3 upstream `attendance.ts` gap, correctly left for the orchestrator to file)
  and one design disclosure (a `(row.status as string)` cast, because `tsc` rejects
  the comparison as TS2367 when the declared union cannot hold `'unmarked'`).
  Not self-certified — a `checker-reviewer` grades this next.
- **12:16Z — item 20 follow-up filed: GAM-496**, `Backlog`, `tier/unreviewed` +
  `Bug`, written through `.claude/skills/linear-task-writing` per item 30. It
  carries the packet's §3 finding as its own row, plus two traps the fixer needs:
  `excludeUnmarked` must be called rather than replaced by a `.neq` clause (this
  repo's query-builder fakes are passthroughs and cannot see a `.neq`), and the
  filter interacts with the T320 paging loop's short-page test. Its verification
  note is explicit that what each of the five consumers *renders* when handed
  `'unmarked'` was **not** measured.
- **12:17Z — DISPATCHED `checker-reviewer`** against committed SHA `86ca2a9a`,
  with `run_in_background: false`; this orchestrator is blocking on it.
  **If this line is the last one in this file, the run died holding this
  subagent.**
