# T169 checker packet — `OutreachDetail` half, round 1

**This is a test run.** Render a PASS / FAIL / REVISE verdict with full evidence,
exactly as you normally would — but stop there. **Do not merge this work, do not
update `docs/swarm/task-ledger.md`, and do not treat T169 as closed.** The
orchestrator, not you, decides what happens with your verdict.

## 1. Dispatch context

- **Task:** T169, `OutreachDetail` half only (the other half, `OutreachList.tsx`, is
  a separate, un-dispatched follow-up — not your concern here, and it is Forbidden
  in the worker packet's own scope).
- **Worker packet:** `docs/swarm/active/T169-worker-packet.md` (pinned to
  `de6ae13` on `claude/swarm-plan-zl575z`).
- **Worker artifact location — inspect here, not the shared tree:**
  worktree `.claude/worktrees/agent-abad62a58020a93b9`, branch
  `worktree-agent-abad62a58020a93b9`, work committed at `7647820`, on top of
  packet-pin commit `9dd4e1f`. **Confirm this worktree and commit actually exist
  and that `7647820`'s parent chain includes `9dd4e1f` before relying on anything
  below** — do not assume the dispatch description is accurate.
- **Attempt count:** round 1. No prior checker verdict exists for this packet.
- **Most recent verification failure:** none — first checker pass.
- **Worker:** `worker-implementer`, tier sonnet (per worker packet §7's own
  trigger-4 analysis).
- **You are:** `checker-reviewer`, tier opus — matching the worker packet's own §7
  assignment for this artifact class (live route, multiple mutation-provable
  criteria, this project's documented history of vacuous absence-only assertions —
  T170's BLOCKER-1 is the reference case, findings recorded in
  `docs/swarm/active/T170-worker-output.md` if you want the shape of what that
  failure mode looked like there).

## 2. Objective (what you are verifying)

The worker packet asked for `RsvpControl` to be mounted in
`src/pages/outreach/OutreachDetail.tsx`, role-gated beside `ParentRsvp`, visible
only to a signed-in **student** viewer, for their own roster row only, with a real
`profiles.id` threaded into `currentUserProfileId` (replacing
`RsvpControl`'s disclosed placeholder default). Full design is worker packet §5;
full criteria are §6. **Do not re-derive the worker's self-report as fact below —
it is reproduced only so you know what to check, not as evidence.**

## 3. Worker's self-report — unverified, reproduce nothing from it as established fact

- Files touched: claims only `OutreachDetail.tsx` + `OutreachDetail.test.tsx`.
- Claims zero-length diff (`git diff 9dd4e1f 7647820 --stat`) against
  `loaders/outreach.ts`, `RsvpControl.tsx`/`.test.tsx`, `ParentRsvp.tsx`/`.test.tsx`,
  `OutreachList.tsx`/`.test.tsx`.
- Claims all 6 mutation-marked criteria (1, 2, 3, 4, 6, 7) run live, RED confirmed,
  restored via `git checkout --`.
- Claims `npm run typecheck` clean; `npm run lint` 0 errors, +1
  `react-refresh/only-export-components` warning on the newly-exported
  `resolveOwnRosterStudent` (worker frames this as expected, matching T157's own
  precedent — verify this framing, don't just accept it); `npm run format:check`
  clean.
- Claims `OutreachDetail.test.tsx` 60 → 73 (13 new, 0 broken); full repo 1631 →
  1644 (same +13 delta, 0 failures).
- Discloses a self-caught stale-worktree start (HEAD initially at `f7ff055`/main,
  24 commits behind, fast-forwarded to `9dd4e1f` before writing any code). This is
  the exact failure mode item 24/T157's process history warns about — **already
  self-corrected per the worker's account, not a new problem to chase — but verify
  the final worktree state is sound** (§1's "confirm this worktree and commit
  actually exist" instruction) rather than trusting the self-report that the
  correction happened cleanly.
- No `FOLLOW-UP NEEDED` items filed; no deviations from §5's design disclosed; no
  dispute filed.

## 4. What to actually do

### 4a. Sanity-check the worktree first
Confirm the worktree path, branch, and commit `7647820` exist and that
`7647820`'s parent chain includes `9dd4e1f`. If anything here does not match, stop
and report a BLOCKER before inspecting further — an artifact that doesn't exist
where claimed cannot be checked.

### 4b. Forbidden-file scope — proof by diff, run first, independent of the worker's own claim
```
git diff 9dd4e1f 7647820 --stat
```
Confirm this touches only `src/pages/outreach/OutreachDetail.tsx` and
`OutreachDetail.test.tsx`. Confirm directly, by name, that
`src/lib/supabase/loaders/outreach.ts`, `src/pages/outreach/RsvpControl.tsx`,
`src/pages/outreach/ParentRsvp.tsx`, and `src/pages/outreach/OutreachList.tsx` are
**absent** from that stat output (worker packet criterion 9). If any Forbidden
file appears, this is a scope violation — BLOCKER per the constitution's Failure
Severity ("modifies forbidden files").

### 4c. Re-run mutations independently, in your own worktree copy (item 23)
Do not trust "confirmed RED, restored" from the self-report. Prioritize, in order:
- **Criterion 3** (worker packet §6.3) — self-only vs. cross-student. This is the
  actual security-relevant proof: a session with 2+ roster students, the signed-in
  student's `user.id` matching only one `profileId`. Confirm (a) exactly one
  self-RSVP control renders per session, not double, and (b) clicking it and
  reading the `submitRsvpChange` spy's call arguments shows `studentId` equal to
  the viewer's own roster row's id, never the other student's. Apply the
  prescribed mutation (loosen the matching predicate, or hardcode a different
  roster index) and confirm RED before restoring.
- **Criterion 6** (worker packet §6.6) — real `currentUserProfileId` threading,
  the placeholder-defect class this whole task exists to close. Click a segment
  button, assert `mockedSubmitRsvpChange` was called with the real student
  `AuthUser.id` as `respondedBy` and the real roster row's id as `studentId`.
  Mutation: revert `currentUserProfileId={user.id}` to an omitted prop; confirm
  the call now carries `PLACEHOLDER_CURRENT_USER_PROFILE_ID` instead of the real
  id before restoring.
- Time permitting, spot-check at least one more of criteria 1, 2, 4, 7 (worker
  packet §6) the same way — mutate, confirm RED, restore. Do not accept "worker
  says RED" as evidence for any of the 6 mutation-marked criteria without running
  at least the two above yourself.

### 4d. Independently verify test counts
Re-measure `OutreachDetail.test.tsx` and the full repo suite at commit `7647820`
yourself. Do not reuse the worker's reported 60→73 / 1631→1644 numbers without
re-running — numbers move, and item 21's spirit (verify existence, don't assume
it) applies equally to counts.

### 4e. Check all 14 acceptance criteria, not only the 6 mutation-marked ones
Worker packet §6 lists 14. The mutation-marked ones are 1, 2, 3, 4, 6, 7 — covered
by §4c above and your own spot-checks. The remaining 8 are inspection-level, not
mutation-provable, and are easy to wave through on a summary alone — check each
directly against the artifact:
- **5** — role gating, paired with a positive control (per T170's BLOCKER-1
  lesson: absence alone is not proof). Confirm coach, admin, parent, and
  signed-out renders each show no `RsvpControl` **and** their own expected other
  content genuinely rendered (not just "nothing crashed").
- **8** — empty case: a student viewer with no matching roster row sees no
  self-RSVP section, no stray loading/error UI, nothing else on the page
  disturbed. Confirm the required `loadRoster: async () => []` stub is actually
  used in this test (worker packet §6.8 flags why its absence would fail for the
  wrong reason).
- **9** — covered by §4b above; do not double-count it as passing without having
  actually run the diff.
- **10** — the stale `:349-350`-region doc-comment sentence (*"RsvpControl.tsx...
  is deliberately NOT mounted here — separate task, separate host ruling"*) is
  actually corrected or removed, not merely claimed corrected. Cite the current
  sentence by its own text when you check this, not a line number (the file has
  changed; a bare pre-change line number is not a reliable locator here — item
  19c's citation discipline applies to you too).
- **11** — build/type safety and full-repo gates: confirm `typecheck` exit 0,
  `lint` 0 errors (the one new `react-refresh/only-export-components` warning on
  `resolveOwnRosterStudent` is expected per T157's own precedent — verify this
  precedent claim is real, not just asserted, before accepting it), `format:check`
  clean. Record both the per-file and full-repo test counts.
- **12** — regression baseline: confirm no pre-existing `STUDENT_USER`-based test
  changed its rendered output (worker packet §6's "fixture trap" note explains
  why this should hold by construction — measure it, don't assume it).
- **13** — no PII: any new fixture names are fabricated (item 6).
- **14** — accessibility (item 15): confirm the page-side wiring introduces no new
  keyboard trap or unlabeled element; confirm whether a page-owned heading was
  added and, if so, whether the worker disclosed why (worker packet §5e argues
  none is needed — check whether that reasoning was followed or silently
  overridden without disclosure).

### 4f. Scope discipline beyond the diff stat
Beyond 4b's file-list check, confirm `OutreachList.tsx` is genuinely untouched —
not imported from, not referenced, nothing added there — and that nothing outside
the two Allowed Files (worker packet §3) was touched, including
`docs/swarm/**`/`.claude/**`/ledger/verification-log/dispute-log/constitution,
which workers may never edit (constitution Authority Boundaries).

## 5. Constitution excerpts relevant to this check

- **Non-Negotiables:** "Every checker must inspect the actual artifact, not just
  the worker's summary." "No worker may mark its own work complete." Applies
  directly — §3 above is what the worker claims; §4 is what you must actually do.
- **Item 6:** no PII in fixtures — fabricated names only (criterion 13).
- **Item 12:** every async screen ships loading/empty/error/populated — worker
  packet §5f argues this task adds no new async state machine and relies on the
  page's existing one; sanity-check that claim rather than accepting it outright.
- **Item 15:** accessibility is a shipping requirement (criterion 14).
- **Item 19c:** verify your own citations before submitting — applies to you as
  much as to the worker. Cite by symbol/component/test name, not by bare
  pre-change line numbers, since the file has been edited since the worker packet
  was written.
- **Item 20:** a deliberate deferral must produce a follow-up task, never just a
  comment. If you find an undisclosed deferral, it is a MAJOR-or-worse finding,
  not something to note and pass.
- **Item 22:** explicit pathspecs only, never `git add -A`/`git add .` — check the
  worker's own commit for this if you inspect its history.
- **Item 23:** your own mutation experiments run in your own worktree/copy, never
  the shared tree.
- **Item 25:** grade any security-adjacent finding (e.g. criterion 3's
  cross-student proof) against Volt's actual small-team threat model, not a
  corporate one — do not manufacture severity because the topic sounds sensitive,
  but do not wave off a genuine cross-student data leak either; criterion 3 is a
  real, in-scope proof obligation regardless.

## 6. Failure Severity — apply directly

- **BLOCKER:** any Forbidden-file modification, any broken build/typecheck, any
  criterion-3/6 mutation that fails to go RED (i.e. the proof doesn't actually
  prove anything), any accessibility keyboard-path break, any regression in a
  pre-existing test.
- **MAJOR:** a criterion claimed satisfied that is actually vacuous or
  absence-only without a positive control (the T170 BLOCKER-1 shape), an
  undisclosed deviation from worker packet §5's design, an undisclosed deferral
  (item 20).
- **MINOR:** acceptable-for-now issues that should become a follow-up task —
  e.g. a real but low-consequence gap not already covered by §8's pre-authorized
  deferrals in the worker packet.
- **NIT:** cosmetic only.

## 7. Required checker output

Per the constitution's Evidence Requirements, your response must include:
- files inspected
- commands run (including the exact mutation diffs applied and reverted, per
  criterion)
- relevant output (paste the actual RED/GREEN transcripts for §4c's re-run
  mutations, not a paraphrase)
- pass/fail result per criterion (all 14, not just the 6 you mutation-tested)
- exact failure reason, if any
- severity classification per finding (§6 above)
- recommended next action

**Restated: PASS/FAIL/REVISE verdict only. No merge, no ledger update, no
verification-log entry, no treating T169 as closed.** That decision belongs to
the orchestrator once your verdict is in hand.
