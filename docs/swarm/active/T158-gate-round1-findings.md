# T158 — premise gate round 1 (verbatim required revisions)

**Gate:** `checker-premise`, full round (item 19b: migration-touching + novel exposure pattern),
2026-07-31, measured against branch `claude/t183-student-home-loader` @ `4613908`.
**Verdict:** REVISE — 0 BLOCKER, 2 MAJOR, 6 smaller findings. **Round 2 of 2 remains available**
(item 19a).

The central prescription (the migration + loader design) is CONFIRMED correct. The gate installed
`@electric-sql/pglite` in a scratch directory (~40s, no Docker/psql needed) and empirically tested
the exact RLS/view-visibility mechanism the packet had flagged as "reasoned, not measured" —
definitively proving the prescription works. What failed round 1 is that the packet's own
*supporting evidence* for that prescription was partly wrong, and one paragraph needed a real fix,
not just tightening. Recorded here so revision 2 is not written from a summary.

## MAJOR 1 — §4's "what I rely on instead of re-deriving the mechanism" paragraph makes a false claim

It said `v_student_hours`/`v_team_participation`/`v_student_goal_projection` "are queried today
from surfaces reachable by every role" to justify the new view not being a novel exposure shape.
An exhaustive grep of every `.from('v_...')` call in `src/` found: **only `v_student_goal_projection`
is actually queried by a non-staff-gated surface** (`loaders/students.ts:407`, for `StudentHome`,
also reached by `ParentHome` via the same factory). `v_student_hours` has exactly ONE consumer in
the entire codebase — `loaders/reports.ts:395` — and that's the exact staff-gated surface
(`ReportsShell.tsx:173`'s `RequireRole(['coach','admin'])`) the packet already disqualified two
paragraphs earlier as NOT a valid precedent. `v_team_participation` has ZERO consumers anywhere in
`src/` — only comments/type declarations reference it.

**Required fix:** delete the false claim's paragraph and replace with the measured result (below).

## MAJOR 2 — §4 only traces half the RLS path, and the untraced half is the genuinely novel one

The loader design (§6b) queries `v_student_hours` completely unfiltered by student — the
first-ever non-staff-gated, program-wide read of every student's hours anywhere in this codebase.
The migration (`v_leaderboard_students`) only solves the NAME-visibility half; it does nothing for
the HOURS half, which depends on the same view-owner-RLS-bypass mechanism, just via
`v_student_hours` instead of the new view.

**Required fix:** add this explicitly to §4 — state that sufficiency depends on the mechanism
applying to BOTH queries, not just the new one — and cite item 25 (`constitution.md:287-290`, "a
leaderboard shows everyone's hours... is the feature") plus PRD 8.3 (`rls.sql:82-83`, "read own row
+ name/team of teammates (leaderboard)") together, as joint authorization for both halves, not just
the name half.

## The measured mechanism — fold in as now-proven fact, not a hedge

Ran the actual migration against a real Postgres (PGlite 18.3, non-superuser view owner matching
Supabase's real shape, `relforcerowsecurity=false`) and measured:

- Base `students` table, `student`-role session: 1 row (own).
- Same session querying the new view: all active students' names, deactivated student's row
  absent.
- Same session querying `v_student_hours` unfiltered: all students' hours rows — the proof for
  MAJOR 2.
- Counterfactual with `security_invoker=on`: collapses both back to 1 row — proving the mechanism
  is real and load-bearing, and proving `dashboard_views.sql:49-52`'s claim (views "run under the
  calling session's own RLS") is false, exactly as constitution item 25 already found.
- Stronger corroborating evidence already sitting in a file the packet cited:
  `student_teams.sql:62-70` (not `:47-53`, which is a different paragraph in the same file)
  contains the schema's own honest mechanism note, independently naming "view-owner RLS bypass
  (typical for a role applying migrations)" as the likely mechanism — the measured result confirms
  its prediction.

**Required fix:** rewrite §4 to present this as measured ("verified live via a scratch
PGlite/PostgreSQL instance, see verification-log for the exact script/output") rather than
"reasoned, disclosed as unverified."

## Smaller findings (all independently verified)

3. **§2's quote from `auto-mode-decisions.md` line 879 is a fabricated composite.** The phrase "is
   expected to be closed" appears ZERO times in `auto-mode-decisions.md` — spliced from
   `rls.sql:91`. Real text at `auto-mode-decisions.md:879-880`: *"Nothing else in T157/T158 —
   loader design, test shape, embedding position within the dashboard — is covered by this ruling.
   Those are mine."* The underlying conclusion (loader design is the orchestrator's to decide) is
   correct — just quote the real sentence, not a splice.
4. **Criterion 6 misattributes a test helper.** `parseSelectedColumns` does not live in
   `outreach.test.ts` alone — it also (and for this packet's purposes, correctly) lives in
   `parentHome.test.ts:94`. Fix the citation; substance of the criterion is unaffected.
5. **§4's "zero occurrences of `security_invoker`... or `security_barrier`... anywhere under
   `supabase/`" is wrong about the second term.** `security_barrier` occurs once, in prose, at
   `dashboard_views.sql:52` (mentioned, not set). Change to "no view *sets* `security_barrier`."
6. **Rewrite acceptance criterion 4.** A PGlite-based scratch check is trivially available — make
   it the prescribed method, not an optional fallback. Add a third sub-check (c): the same session
   querying `v_student_hours` unfiltered also returns more than its own row — closes MAJOR 2's gap.
   Disclose two environment deltas (PGlite PG18 vs. Supabase PG15/17 — irrelevant,
   `security_invoker` defaults off in both; and Supabase's `ALTER DEFAULT PRIVILEGES` granting
   `authenticated` SELECT, the same mechanism all 15 existing views depend on).
7. **Criterion 5's stub needs one more property than the template it points at.**
   `students.test.ts:26-62`'s pattern works because that chain ends in `.maybeSingle()`. The
   leaderboard hours query has no such terminator — it awaits `.eq(...)` directly. The stub's
   `select()` return must be both a thenable AND expose `.eq()`.
8. **Unedited self-correction artifact in §3.** "`loadData?`... each defaults to a real production
   value except `loadData` — wait, `loadData` **also** defaults to..." — state the correct fact
   directly. Also worth disclosing: `CoachHome.tsx:2094`'s own doc comment still says "Defaults to
   fixture data," which T173 made false.

## What held up — do not re-litigate

- Opus tier, full premise-gate scope (§9).
- The T203 split — the CSS `Section`-nesting hazard is real, `CoachHome.tsx:2271-2278`.
- The T204 split.
- The migration SQL itself — verified to actually execute and produce the claimed result.
- The loader design against `Leaderboard.tsx`'s real exported types — verified to match/compile.
- The Allowed/Forbidden file lists.

## Round-2 checklist

1. Fix MAJOR 1's false claim (§4).
2. Add MAJOR 2's both-halves framing + item 25/PRD 8.3 joint citation (§4).
3. Fold in the measured PGlite result as fact, not a hedge (§4 and the migration's own SQL
   comment, §6a — the same false claim was duplicated there too).
4. Fix §2's fabricated quote.
5. Fix criterion 6's citation.
6. Fix the `security_barrier` claim.
7. Rewrite acceptance criterion 4 (prescribe PGlite, add sub-check (c)).
8. Add the stub-shape sentence to criterion 5.
9. Clean up §3's self-correction artifact; disclose the stale `CoachHome.tsx:2094` comment
   (folded into T204).
