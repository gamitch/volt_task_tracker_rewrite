# GAM-446 — run log

Coach cards need attendance %, roster counts and a parent child-list the
meetings loaders don't return — extend `loadCoachMeetingsData` and add
`listGuardianChildren`.

Branch: `claude/gam-446-coach-card-loader-data`
Orchestrator: Claude (dispatched run, 2026-08-21)

Append-only. One line per milestone, pushed immediately. If this file ends
mid-chain, the last line names what the run was holding when it died.

## Timeline (UTC)

- **22:41 — dispatched.** Read `AGENTS.md` § "Where work comes from" and
  `docs/swarm/constitution.md` (items 18, 19, 22, 26, 28) before opening any
  other file.
- **22:44 — tiered HEAVY (item 28d, before the `In Progress` move).** The issue
  arrived `tier/unreviewed` and suggests STANDARD; I am overriding upward.
  Item 26's deciding question — *can a mistake here lie to a user about their
  own data?* — is yes: a wrong join against `v_event_attendance` shows a
  student a false attendance percentage. And item 26's explicit HEAVY trigger
  **"an export another session builds against"** is met literally: this
  ticket's row model is the frozen contract the parallel Wave-2 UI tickets and
  the integration ticket code against. Item 26 also says when two tiers are
  arguable, take the heavier one. Not FAST (changes a signature other modules
  import; >20 lines). Recorded as `tier/heavy`.
- **22:45 — claimed.** `Todo → In Progress` via `issueUpdate`, then re-read
  (item 28c): state reads `In Progress`, labels `tier/heavy`,
  `meetings-redesign`, `Improvement`. No `gate/human`; no executor label, which
  under item 28b is the legacy Claude-only route. **Correction made during the
  claim:** my first `issueUpdate` passed `labelIds` as a full replacement and
  dropped `meetings-redesign` and `Improvement`; the read-back caught it and the
  next write restored both. `executor/claude` deliberately NOT applied — the
  missing route already means Claude, and adding it would change routing beyond
  what item 28d asks of a claim.
- **22:46 — credential deadline measured (wall 3).** Decoded the live `ghs_`
  token: `iat 2026-08-21T22:40:39Z`, `exp 2026-08-21T23:40:39Z`. The PR must be
  opened well before 23:40Z. `git push` uses the long-lived PAT in the
  extraheader (confirmed present) and survives past it.
- **22:47 — run log created and pushed; draft PR next, before any source work.**
- **22:49 — draft PR #233 opened** at roughly minute 8, with ~52 minutes of PR
  credential left. Wall 3 discharged: the body artifact is on the branch, so
  even if this run dies the work is publishable by hand.
- **22:58 — STALE BASE CAUGHT AND CORRECTED.** The run started on `bdfafcf`
  (PR #221), but `origin/main` had already moved to `3d27d8a` — PRs #230
  (GAM-444, the MeetingsList decomposition) and #231 (GAM-445) merged in
  between. On the stale base `src/lib/meetings/types.ts` **did not exist**, and
  I was one step from reporting the issue's central premise ("code against the
  frozen `types.ts` contracts") as false. It is true; my checkout was wrong.
  Rebased onto `3d27d8a`. **Recorded because the failure was mine and the next
  reader deserves the correction, not a clean story.**
- **23:02 — reconnaissance complete, all citations verified against `3d27d8a`.**
  Findings that change the packet, all measured:
  1. `v_event_attendance` exists (`supabase/migrations/20260821000000_*.sql`),
     columns `event_id, held_ct, graded_marks_ct, excused_ct,
     attended_marks_ct, attendance_pct`.
  2. **The view's own catalog comment makes `graded_marks_ct` mandatory for any
     consumer**: "A CONSUMER THAT RENDERS attendance_pct WITHOUT ALSO RENDERING
     graded_marks_ct REINTRODUCES D014's KNOWN REGRESSION." The issue never
     mentions `graded_marks_ct`. GAM-460 (Backlog) owns the render side, so the
     loader must carry the value or GAM-460 is unimplementable.
  3. **The frozen `SeriesCardModel` has `attendancePct` but no `heldCt`, no
     `gradedMarksCt` and no roster field**, and `src/lib/meetings/types.ts` is
     NOT in the issue's Allowed Files. The issue's "exact field names per the
     frozen types.ts contracts" therefore names fields that do not exist. This
     is the packet's main open question and the premise gate's first target.
  4. `makeLoadCoachMeetingsData` (`meetings.ts:899-936`) really is six parallel
     queries; `queryTeams` (`:417`) is the select-string guard precedent
     (`meetings.test.ts:72`).
  5. `guardian_links` is `(id, parent_profile_id, student_id, relationship,
     created_at)` with `unique (parent_profile_id, student_id)`; the existing
     earliest-child query is `resolveCurrentStudentId.ts`'s
     `queryFirstLinkedStudentId`, ordered `created_at` asc `.limit(1)`.
  6. **Concurrency hazard: PR #232 (GAM-447, SeriesCard) is OPEN right now** on
     a sibling branch. Disjoint files from this ticket, but both are downstream
     of `types.ts`.
- **23:08 — packet revision 1 written and pushed** (`GAM-446-packet.md`),
  carrying three corrections to the issue text (mandatory `graded_marks_ct`;
  the frozen `SeriesCardModel` has nowhere to put the new fields so `types.ts`
  is added to Allowed Files additively; "roster size" disambiguated from the
  existing RSVP `expectedCt`) and a five-entry Least-confident-decisions list.
- **23:09 — DISPATCHING `checker-premise` (item 19), blocking, `run_in_background: false`.**
  *If this line is the last one in this file, the run died holding this subagent.*
