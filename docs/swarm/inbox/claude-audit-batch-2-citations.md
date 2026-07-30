# Inbox — citation audit: T142-T150, T154 packets + ledger rows

**From branch:** `claude/audit-batch-2` (isolated worktree, separate session)
**Base commit SHA:** `f7ff055a83cc85513728ad14bc63279ec9a6f1de` (`f7ff055`, current tip of `origin/claude/swarm-plan-zl575z` at fetch time)
**Author:** same session as the other two files in this batch. Read-only; no source, packet, or ledger files touched.

**Scope, deliberately bounded:** `docs/swarm/active/{T142,T143,T144,T145,T146,T147,T148,T149,T150,T154}-worker-{packet,output}.md` (T144 has no output file — checked), their corresponding `task-ledger.md` rows, and T171's ledger row cross-checked against the app-owned-storage-key/theme files it describes. **Deliberately excludes T155/T157/T169/T170** — those packets/rows are moving under active revision by the other session right now; citation-checking a moving target either flags things about to be fixed or goes stale within minutes, so they're off-limits per the contention rule this batch is operating under.

**Method:** extracted every `file:line`/`file:line-line` citation from the in-scope files, then verified each against actual file content — using current worktree HEAD for claims about final/shipped state, and `git show <commit>~1:<file>` at the relevant pre-task commit for claims about "the structure before this task's change" (since all these tasks are already merged, a packet necessarily describes a pre-image that has since moved). A citation whose line number has since shifted because a *later* task edited the same file is **drift**, not an error, and is reported as such, not flagged. Only citations making a wrong claim about content — wrong function, wrong prop, wrong count, describing something that was never there — count as a mismatch.

---

## Result: one confirmed error, everything else clean

**~90 non-vendor citations checked in depth** (exact line reads, several cross-validated against historical commits at the relevant pre-task SHA). **88 verified exactly.** ~25 additional citations point into `node_modules/@astryxdesign/core/**` and `@supabase/supabase-js` internals, which aren't installed in this worktree (no `npm install` run) — these are flagged as **unverifiable in this checkout**, not guessed at either way.

### Confirmed mismatch — `constitution.md:11` should be `:10`, and the ledger row still carries it

- **`docs/swarm/active/T154-worker-packet.md:301`** and **`:367`** both cite `constitution.md:11` for the quote "existing tests must pass unless the boss explicitly approves a test update."
- **Actual content, verified directly** (read in an earlier step of this same session, independent of the agent that ran this audit): `constitution.md:10` = "Existing tests must pass unless the boss explicitly approves a test update." `constitution.md:11` = "No worker may mark its own work complete." — a different rule entirely. The citation is off by one.
- **Already self-corrected in the output doc:** `docs/swarm/active/T154-worker-output.md:477` cites `constitution.md:10` correctly, with an explicit note that it corrects the `:11` error from the packet.
- **Not yet corrected in the ledger:** `docs/swarm/task-ledger.md:183` (the T154 row, "Revision 2" paragraph) still reads: *"Fixed a citation error carried from revision 1: the existing-tests non-negotiable is `constitution.md:11`, not item 10..."* — this sentence is itself backwards. It asserts `:11` is the corrected citation and `:10`/"item 10" is the error, when the reverse is true (confirmed by direct read of `constitution.md` above). So the ledger's own narrative about having fixed the citation error is, itself, the citation error, persisting in the one document meant to be the authoritative record — even though the underlying output doc got it right.
- **Suggested correction, for the active session to apply (not applied here):** in `task-ledger.md:183`, change "the existing-tests non-negotiable is `constitution.md:11`, not item 10" to "the existing-tests non-negotiable is `constitution.md:10`, not `:11`" (or equivalent rewording) — a one-line ledger text fix, not a code change, not a new task.

### Everything else checked — verified, with drift correctly distinguished from error

Representative sample of what was checked (full per-file breakdown available on request, kept out of this file to stay scannable): `CalendarPage.tsx`, `CoachHome.tsx`/`CoachHome.test.tsx`, `KpiStrip.tsx`, `HoursTab.tsx`, `TeamsTab.tsx`, `outreach.ts`, `OutreachDetail.tsx`/`.test.tsx`, `AttendancePanel.tsx`/`.test.tsx`, `teams.ts`/`students.ts`, `client.ts`, `EventsTab.tsx`, `MeetingsList.tsx`, `OutreachEventDialog.tsx`, `StudentsTab.tsx`, `App.tsx`, `theme.css`, `guards.tsx`, `SeasonProvider.tsx`, `ThemeModeProvider.tsx`/`.test.tsx`, `astryx-api.md`, `VOLT_Portal_PRD.md`/`VOLT_UX_Craft_PRD_v3.md`, plus cross-references between packets themselves (e.g. `T149-worker-packet.md` quoting `T142-worker-packet.md:60-65` verbatim — checked against the actual source file, matches).

Two specific multi-count claims worth calling out because they're the kind of thing most likely to be wrong and weren't: T144's packet claims "there are ten `ProgressBar` call sites, not the two an earlier packet claimed" with all ten cited individually — re-ran `grep -rn "<ProgressBar" src` independently and it still returns exactly 10 today. T143's packet claims "eleven Astryx `TokenColor` values" at a specific `TeamsTab.tsx` range — counted the table rows directly, exactly 11.

Several citations in this range are themselves *self-corrections of earlier citation errors*, already caught and fixed within the worker/checker loop before landing (e.g. T146's packet documents correcting a `client.ts:23`→`:79` citation; T145's output doc documents correcting a line-range for `CALENDAR_TYPE_BADGE`). Those are working-as-intended, not new findings — noted here only so the active session doesn't mistake "the packet mentions a citation error" for "this audit found a new one."

### T171's ledger row — no literal citations to check, but one clarification worth flagging

T171's row (`task-ledger.md`) describes the stale-theme-frame test-integrity issue entirely in prose, without a single `file:line` citation — so there's nothing to mismatch-check in the row itself. Verified the underlying factual claims anyway against source: `useMemo(() => ({mode, refresh}), [mode, refresh])` at `src/app/ThemeModeProvider.tsx:417` — confirmed verbatim. The failing `.filter((m) => m !== 'dark')` pattern in the test named "the stale theme never reaches the DOM even for one frame during the switch" — confirmed verbatim, at `src/app/ThemeModeProvider.test.tsx:826`. "36 tests passing" — confirmed exactly (26 plain cases + 3 + 7 from two `it.each` blocks). **One clarification, not an error in the row itself:** if anyone's mental model has this material living in `src/App.test.tsx`, that's incorrect — it's in `src/app/ThemeModeProvider.test.tsx`. `App.test.tsx` exists and covers T148's basic theme wiring but contains none of the RecordingProbe/stale-frame material T171 describes.

## Overall assessment

This batch's citation quality is well above what "citations have repeatedly been wrong" would suggest on its own — the gate/checker process visibly worked here, catching and correcting several citation errors *before* they landed (the `client.ts` and `CALENDAR_TYPE_BADGE` corrections are documented in the packets' own text). The one surviving error is a reference-doc line number, not a code claim, already fixed in the output doc, and just never made it back into the ledger row. Given the user's report of "ten citation errors today, nine by the other agent," this suggests those nine are concentrated in the more recent, faster-moving material (T151-T153, and the T155/T157/T169/T170 prose this audit deliberately stayed off of) rather than in this settled T142-T150/T154 range — worth keeping in mind if a citation-audit pass on the newer material is wanted next.

## Handoff note

Same as the other two files in this batch: diagnosis only. The one-line ledger correction above is small enough that the active session may just want to apply it directly rather than route it through a full task packet — flagging it as a suggestion, not asserting how it should be handled.
