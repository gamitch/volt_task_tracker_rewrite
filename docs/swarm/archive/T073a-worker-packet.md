# Worker Packet: T073a

## Task ID
T073a — Role vocabulary reconciliation (`guards.tsx`'s stale `Role` type), Epic E3.

## Objective
`src/app/guards.tsx`'s `Role` type (line 43) is `'admin' | 'staff' | 'volunteer' | 'coach'` — a
stale T005 placeholder, explicitly disclosed as provisional in that file's own module doc since it
was written. The real AUTH-05 role vocabulary, matching `role_enum` verbatim
(`supabase/migrations/20260716000000_identity_roster.sql`: `create type role_enum as enum
('admin', 'coach', 'student', 'parent');`), is already correctly defined and exported as
`src/lib/supabase/types.ts`'s `Role` (built by T071, already Passed). `'student'` and `'parent'`
do not exist in `guards.tsx`'s union today — this blocks any route that needs to distinguish those
two roles (most notably a future `/` dashboard dispatcher and a future
`/meetings/live/:sessionId` dispatcher, neither of which exist yet and are NOT part of this task).

This task is purely a **vocabulary correction**, not an auth-backend wiring task. `AuthProvider`
stays exactly as in-memory/placeholder as it is today — only the *type* and the handful of
concrete role literals that are actually invalid under the corrected type get fixed. Real Supabase
auth wiring is a separate, later, larger task (not this one — do not attempt it here).

Boss-architect confirmed this design via consultation: reconciling the type first, as its own
small, fully-deterministic task, is a hard prerequisite for everything else in the eventual
router-wiring series.

## Allowed Files
- `src/app/guards.tsx`
- `src/pages/login/LoginPage.tsx`
- `src/pages/accept-invite/AcceptInvitePage.tsx`
- `src/pages/home/StudentHome.test.tsx`
- `src/pages/home/ParentHome.test.tsx`
- `src/pages/meetings/LiveConsole.test.tsx`
- `src/pages/meetings/MeetingsList.test.tsx`
- `src/pages/roster/ParentsTab.test.tsx`
- `src/pages/outreach/OutreachList.test.tsx`
- The following files ONLY for a targeted one-line correction to a stale module-doc citation of
  the old `'admin' | 'staff' | 'volunteer' | 'coach'` union (see Trap #3 — do not rewrite these
  docs beyond the specific stale citation):
  `src/components/nav/SideNav.tsx`, `src/pages/roster/RosterShell.tsx`,
  `src/pages/roster/AdminToggles.tsx`, `src/pages/settings/SettingsPage.tsx`,
  `src/pages/settings/SeasonSettings.tsx`, `src/pages/home/CoachHome.tsx`,
  `src/pages/reports/ReportsShell.tsx`, `src/pages/meetings/LiveConsole.tsx`,
  `src/pages/meetings/MeetingsList.tsx`, `src/pages/outreach/OutreachList.tsx`

## Forbidden Files
Everything else, per the ledger-wide rule. In particular: do not touch `router.tsx` (no route
wiring in this task), any Astryx source, `src/lib/supabase/**` (already correct, built by T071 —
read-only reference here), or any file's actual component logic/JSX beyond the specific role
literal / doc-citation fixes below.

## Known Context / Traps

**1. Fix the type definition.** Change `guards.tsx` line 43 from the stale inline union to
re-export/reuse the real, already-correct `Role` from `src/lib/supabase/types.ts` (built by T071),
rather than hand-retyping a second union that can drift from `role_enum` again. Check how other
files in this codebase already import from `src/lib/supabase` (direct file import vs. the
`src/lib/supabase/index.ts` barrel) and follow the established convention. State your import choice
explicitly in your output. If re-exporting genuinely creates a layering problem you can articulate
concretely (it shouldn't — `lib/supabase` has zero dependency on `app/guards`, confirmed by boss
during scoping), fall back to a local redefinition (`'admin' | 'coach' | 'student' | 'parent'`)
with a comment citing `role_enum` as the source of truth, and explain why you chose that path.

**2. Fix every now-invalid role LITERAL (not every string mentioning "staff"/"volunteer" — most
hits in this codebase are doc-comment citations of the known gap, not live code).** Exact list,
confirmed by direct grep before this packet was written:
- `guards.tsx:77` — `PLACEHOLDER_GOOGLE_USER`'s `role: 'staff'`. This is the placeholder Google
  OAuth simulation's assigned role — pick a valid replacement (`'admin'` or `'coach'` are
  reasonable; state your choice and reasoning).
- `LoginPage.tsx:103` — `const PLACEHOLDER_SIGN_IN_ROLE: Role = 'staff';`. Same fix — pick a valid
  replacement role, update the adjacent doc comment (lines 92-102) to stop citing `'staff'` as the
  shared placeholder value if you change what the shared value actually is.
- `AcceptInvitePage.tsx:201` — `const PLACEHOLDER_SIGN_IN_ROLE: Role = 'staff';`. Same fix; keep it
  consistent with whatever you chose for `LoginPage.tsx` and `guards.tsx`'s
  `PLACEHOLDER_GOOGLE_USER` (all three are meant to represent the same kind of "no real backend
  yet" placeholder — pick ONE value and use it in all three, don't invent three different ones).
- `StudentHome.test.tsx:59` — `STUDENT_USER: AuthUser = { ..., role: 'staff' }`. This should become
  `role: 'student'` — the test fixture's own name/purpose already makes clear this is meant to
  represent a student viewer; `'staff'` was only ever a workaround for the missing role.
- `ParentHome.test.tsx:49` — `PARENT_USER: AuthUser = { ..., role: 'staff' }`. Should become
  `role: 'parent'`, same reasoning.
- `LiveConsole.test.tsx:70` — `STAFF_USER: AuthUser = { ..., role: 'staff' }`. Read the test(s)
  that use this fixture first: it stands in generically for "a signed-in user who is NOT
  coach/admin" (per that file's own doc comment). Change the literal to a valid role that preserves
  this "not coach/admin" test intent — `'student'` is the natural choice unless reading the actual
  test assertions reveals a reason to prefer `'parent'` instead. Rename the constant too if you
  change its semantic value (e.g. `STAFF_USER` → `NON_COACH_USER` or `STUDENT_USER`, your call, but
  don't leave a `STAFF_USER` constant holding a `'student'` role — that's confusing for the next
  reader).
- `MeetingsList.test.tsx:77` (and its doc comment at line ~71) — same "stands in for not
  coach/admin" pattern, same fix approach.
- `ParentsTab.test.tsx:436` — same "stands in for not coach/admin" pattern (`STAFF_USER`), same fix
  approach.
- `OutreachList.test.tsx:65` (and its doc comment at line ~59) — same pattern, same fix approach.

**3. Stale doc-comment citations (lower priority, but should be corrected while you're touching
these files anyway) — the 10 files listed in Allowed Files' second group.** Each has exactly ONE
line citing the old `'admin' | 'staff' | 'volunteer' | 'coach'` union as a disclosed known gap
(e.g. `CoachHome.tsx:199`, `RosterShell.tsx:40`). Once the type is fixed, these citations become
inaccurate. Fix each cited line to reflect the corrected union (or simply note the gap is now
resolved, citing this task). Do NOT rewrite any of these files' docs beyond the one stale citation
line each — this is a targeted accuracy fix, not a doc overhaul. If a file's stale citation is
embedded in a longer paragraph that would read awkwardly with just the union swapped in, use your
judgment to reword that one sentence minimally — but do not touch anything else in that doc block
or any of that file's actual code.

**4. Do not touch any file's actual component logic, JSX, or non-role-literal test assertions.**
This task is a scoped, mechanical vocabulary fix. If you find yourself wanting to change behavior
(not just a literal value or a doc citation), stop and flag it as a follow-up instead.

**5. Run the full repo-wide test suite, typecheck, and lint after your changes** — changing a
shared type will surface any OTHER place in the codebase that silently depended on the stale union
in a way this packet's grep sweep didn't catch (grep only catches direct string literals, not e.g.
an exhaustiveness `switch` that TypeScript would now flag as needing a new case). If typecheck
surfaces anything beyond the files listed in Allowed Files, do NOT expand scope yourself — stop and
report it as a finding requiring a packet update, per this project's standing rule against
self-expanding scope.

## Acceptance Criteria
- `guards.tsx`'s `Role` type matches `role_enum` exactly: `'admin' | 'coach' | 'student' |
  'parent'`.
- Zero remaining `'staff'`/`'volunteer'` role-VALUE literals anywhere in `src/` (a fresh
  `grep -rn "role: 'staff'\|role: 'volunteer'\|Role = 'staff'\|Role = 'volunteer'"` across `src/`
  returns zero hits) — doc-comment citations of the OLD union as historical fact are fine to leave
  if genuinely necessary for context, but should generally be updated per Trap #3.
- `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`, `npm run format:check` all
  clean, zero regressions.
- No behavior change beyond the type/literal corrections — every existing test that passed before
  still passes with an updated (not new) role value; no new test logic invented.

## Relevant Constitution Excerpts
> No worker may mark its own work complete; every PASS requires independent checker-inspected
> evidence.

> Constitution item 3: never re-derive RLS/metric SQL formulas in TypeScript. (Not directly
> applicable — flagged for completeness since this task touches auth-adjacent code.)

## Most Recent Failure
None. This is attempt 1 for T073a (attempt count: 0) — first dispatch.

## Required Worker Output
- Full diff summary, file by file, with a one-line justification per file for why it needed to
  change.
- Your chosen "shared placeholder role" value (used consistently across `guards.tsx`'s
  `PLACEHOLDER_GOOGLE_USER`, `LoginPage.tsx`'s `PLACEHOLDER_SIGN_IN_ROLE`, and
  `AcceptInvitePage.tsx`'s `PLACEHOLDER_SIGN_IN_ROLE`) and why.
- Your import choice for `Role` in `guards.tsx` (re-export vs. local redefinition) and why.
- Confirmation of the zero-remaining-invalid-literal grep sweep, run fresh.
- Full test/typecheck/lint/build output.
- Known risks; whether a dispute is needed (you flag, you don't resolve) — in particular, flag
  immediately if typecheck surfaces any file outside this packet's Allowed Files that needs a
  change, rather than expanding scope yourself.
