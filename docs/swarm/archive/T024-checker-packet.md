# Checker Packet: T024 (Invite parent dialog) — Check Attempt 1

## Task ID
T024 — Invite parent dialog (ROS-05), Epic E4.

## Checker Agent
checker-reviewer (per task-ledger.md T024 row).

## Objective
Verify a `Dialog` per ROS-05's fields, a data-shape resolution for "additional linked students"
grounded in real, already-applied schema/trigger evidence (not invented), BEH-07/DES-14 copy, and
required-relationship-label validation.

## Allowed Files (worker's literal permitted edit)
- `src/pages/roster/InviteParentDialog.tsx` (new)

**Scope flag**: worker also created `InviteParentDialog.test.tsx`, outside the literal Allowed
Files line — same disclosed pattern already ruled in-scope by every prior checker in this batch.
Re-derive the judgment yourself.

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commit (`a155680`, which
also includes T027's files — confirm the D001 boundary per-file, not per-commit) — do NOT infer
authorship from commit messages. Confirm `StudentsTab.tsx`, `RosterShell.tsx`,
`supabase/functions/send-invite/**`, `router.tsx`, `guards.tsx` (import-only) untouched, and no
migration file added. Note: the working tree may show other concurrently-running tasks' untracked
files — not this task's concern.

## Worker's Claimed Changes (do not trust — verify independently)
1. **THE CENTRAL DATA-SHAPE DECISION — grounded in real evidence, not invented.** Worker claims it
   found the deciding ground truth already exists in `supabase/migrations/20260718000000_invite_trigger.sql`
   (T019, already-Passed): a comment (claimed lines 166-176) stating a parent invited for N students
   produces N separate `invites` rows sharing one email, each getting its own `guardian_links` row.
   Claims `buildInviteParentSubmission` produces one `send-invite`-shaped request
   (`{email, role:'parent', student_id}`) per selected student (primary + each additional pick,
   de-duplicated), matching this pre-existing server-side design rather than inventing a competing
   shape.
2. **Relationship label — a genuine, disclosed downstream gap found.** Worker claims it traced
   further and found the SAME T019 trigger currently hardcodes `guardian_links.relationship =
   'guardian'` (claimed line 263), with its own comment (claimed lines 197-201) flagging this as "an
   assumption pending any future task that collects a real relationship value... at invite-creation
   time" — i.e., this task. Since `invites`/`send-invite`'s validated body has no relationship
   column at all, and migrations/`send-invite/**` are forbidden here, claims the collected value is
   carried in `InviteParentSubmission.relationship` but explicitly documented as having NO
   destination column in today's schema/pipeline — disclosed as a real gap, not silently dropped.
3. **BEH-07/DES-14**: `computeSendInviteLabel(count)` claimed to return "Send invite" for the base
   case, "Send N invites" once additional students are picked. Toast body claimed exactly
   `` `Invite sent to ${email}` ``, rendered as a bare `<Toast>` sibling (no `ToastViewport` wired
   anywhere — same disclosed gap `OutreachList.tsx`/T038 established).
4. **Required relationship validation**: `isInviteParentFormValid` claimed to gate the confirm
   button's `isDisabled` with no `tooltip` prop, producing a genuine native-disabled button (proven
   via a dispatched-click-doesn't-invoke-handler test).
5. **A genuine `Toast` doc gap re-confirmed**: claims `onHide`/`uniqueID`/`collisionBehavior` belong
   to a separate `ToastOptions` type, not `<Toast>`'s own props — same finding `OutreachList.tsx`
   already made, independently re-verified against the installed `.d.ts` files.
6. Claims 18/18 new tests pass, 426/426 repo-wide; typecheck/lint(scoped)/format(scoped) clean.
   Discloses several repo-wide build/lint/format failures at the time of its run, all attributed to
   other concurrent workers' in-progress files (`TeamsTab.tsx`, `SeasonSettings.tsx`,
   `ParentsTab.tsx`), none in its own Allowed Files.

## Required Verification Steps
1. **Read `InviteParentDialog.tsx` and `InviteParentDialog.test.tsx` in full** — do not rely on the
   worker's module doc or this packet's paraphrasing.
2. **THE CENTRAL DATA-SHAPE DECISION — re-verify the cited evidence directly, don't trust the line
   numbers.** Open `supabase/migrations/20260718000000_invite_trigger.sql` yourself and confirm the
   claimed comment about "N separate invites rows sharing one email" genuinely exists and says what
   the worker claims. This is the single most important verification in this check — the worker's
   entire data-shape design rests on this citation being accurate.
3. **Relationship-hardcoded-to-'guardian' claim — re-verify directly.** Open the same file and
   confirm the trigger genuinely hardcodes `relationship = 'guardian'` with the claimed
   self-aware comment. Confirm this task's `relationship` field genuinely has nowhere to persist
   given the real `invites`/`send-invite` contract (re-read `send-invite/validation.ts`,
   read-only) — judge whether this is a real, correctly-disclosed gap or something the worker should
   have handled differently.
4. **BEH-07/DES-14 — confirm by source read**, not just the test claim.
5. **Required-validation — confirm genuinely native-disabled**, same standard every dialog in this
   batch has been held to.
6. **`Toast` doc-gap claim — re-verify against the installed source yourself.**
7. **Astryx prop citations** — spot-check `Dialog`, `TextInput`, `MultiSelector`, `Button`,
   `Banner` against `astryx-api.md`.
8. **Test-file scope question** — render an explicit verdict, independently re-derived.
9. **Re-run typecheck/lint/build/test yourself** (scoped appropriately given concurrent-worker
   noise) — don't accept "18/18"/"426/426" without your own run.
10. **No box-drawing/bracket characters, no fabricated real-looking PII** — grep sweep yourself.

## Relevant Constitution Excerpts
- Item 2: Astryx component usage must stay within the documented API surface.
- Item 6: no PII... test fixtures use fabricated names.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase)
- commands run
- exact findings
- explicit verdict on the data-shape decision's grounding in T019's real trigger comment
- explicit verdict on the relationship-persistence gap disclosure
- explicit verdict on the test-file scope question
- required rework if failed
- follow-up tasks if passed with minor issues
