# Worker Packet: T056

## Task ID
T056

## Objective
Build `src/pages/reports/ReportsShell.tsx` (a `TabList` shell: Participation | Hours | Events, RPT-01) and `src/pages/reports/ParticipationTab.tsx` (RPT-02): a team-grouped table of students with meetings expected/present/late/excused and participation % (with a `ProgressBar`), a `PowerSearch` filter (team/below-% threshold/name), and a "below 70%" quick-filter chip that must correctly answer persona question P-COACH2 ("which students are below 70%?"). Coach/admin-only route.

## Dependencies (status)
- T013 (metric views) — Passed. Defines `v_student_participation`, the **only** legitimate source for every number this tab renders (constitution item 3 — duplicating the formula in TypeScript is a BLOCKER).
- T014 (NFR-03 fixture tests) — Passed. Confirms `v_student_participation`'s behavior on the excused-shrinks-denominator and no-completed-sessions edge cases — relevant because your UI must render those cases sensibly (e.g. a "—" or similar for a student with zero expected sessions, not a divide-by-zero artifact or a fabricated 0%).

## Allowed Files
- `src/pages/reports/ReportsShell.tsx` (new — confirm via `Glob` that `src/pages/reports/` doesn't exist yet)
- `src/pages/reports/ParticipationTab.tsx`

## Forbidden Files
- `src/pages/reports/HoursTab.tsx`, `src/pages/reports/EventsTab.tsx`, `src/pages/reports/csvExport.ts` — these are separate, currently-Blocked tasks (T057, T058, T059). `ReportsShell.tsx`'s `TabList` should reference "Hours" and "Events" tabs structurally (per RPT-01's three-tab spec) but you are not building their content — render an obvious placeholder for those two tabs' panels and say so explicitly, do not attempt to build ahead.
- `src/app/router.tsx` — **read-only**. `/reports` is already wired (`RequireAuth` only, **no role restriction** — confirmed by reading the route table directly). See Known Context/Traps #1 below: RPT-06's coach/admin-only requirement is not enforced at the router level today, and `router.tsx` is forbidden to you.
- `src/app/guards.tsx` — **read-only** (import `useAuth`, `Role` from here; do not edit).
- `supabase/migrations/**` — the views are frozen (T013, Passed); do not alter them.
- `docs/swarm/**`, `.claude/**`.

## Ground Truth — `v_student_participation` (read directly from `supabase/migrations/20260717000003_metric_views.sql`, do not guess or re-derive)
```sql
create or replace view v_student_participation as
-- (verbatim PRD 8.4 SQL, T013-Passed, byte-checksummed against ground truth)
-- columns: student_id, season_id, team_id, expected_ct, present_ct, late_ct,
--          excused_ct, participation_pct
```
Read the actual file yourself for the exact column list and computation (do not transcribe it into your own code — constitution item 3, BLOCKER if the formula is re-derived in TypeScript anywhere). Your job is purely to **query and render** these columns; every number on this screen (expected/present/late/excused counts, participation %) must come directly from this view's output, never recomputed client-side.

RLS/read access: metric views in this project do not carry their own separate RLS policies (Postgres views run against the underlying tables' policies unless a view is explicitly `security_definer`/`security_barrier` — none of T013's views are). Confirm this yourself by reading the view definitions and `20260717000002_rls.sql`'s coverage of the underlying tables (`students`, `attendance`, `event_sessions`) before assuming a specific access story; state your finding explicitly in your output rather than assuming a specific RLS behavior you haven't verified.

## Known Context / Traps

**1. RPT-06 ("Students/parents do not access `/reports`") is not enforced at the router level today.** `router.tsx`'s `/reports` route is wrapped only in `RequireAuth`, with no `RequireRole` (confirmed by reading the file directly — unlike `/kiosk/:sessionId` and `/settings`, which both already have a nested `RequireRole`). Since `router.tsx` is forbidden to you, **you must implement the coach/admin-only restriction inside `ReportsShell.tsx` itself** — e.g. call `useAuth()` from `guards.tsx` (read-only import, already used this way by other pages) and render a "you don't have access" redirect/empty state for any role other than admin/coach, mirroring `RequireRole`'s own behavior (redirect to `/` + the standard access-denied toast, `pushToast(ACCESS_DENIED_TOAST_MESSAGE)` — both exported from `guards.tsx`, read-only import) so the UX is consistent with every other role-gated page in the app rather than inventing a different denial pattern. Flag this router-level gap explicitly in your output as a candidate for a future `router.tsx`-touching corrective task (same shape as T016a), since a component-level guard is a reasonable stopgap but not as robust as a route-level one (e.g. it still executes this component's own render logic before redirecting, however briefly).

**2. `guards.tsx`'s `Role` type does not match AUTH-05's vocabulary.** The DB's real roles are `admin | coach | student | parent` (AUTH-05). `guards.tsx`'s `Role` type is currently `'admin' | 'staff' | 'volunteer' | 'coach'` — a stale T005 placeholder, explicitly flagged in that file's own doc comment as provisional. Since you cannot edit `guards.tsx`, gate on whatever the *actual current* `Role` type contains (`'admin'`/`'coach'`) and flag the mismatch explicitly rather than silently assuming `'staff'`/`'volunteer'` map to anything in particular.

**3. No shared Supabase client exists anywhere in `src/` yet** (confirmed via grep, zero hits for `createClient`/`supabase-js` under `src/` — the same gap every other Ready UI task in this batch hits). Build the real, complete UI (table, grouping, `PowerSearch` config, "below 70%" chip logic, `ProgressBar`) against a clearly-typed data shape matching `v_student_participation`'s real columns, driven through an obviously-a-placeholder data-fetching seam (e.g. a typed `useParticipationData(seasonId): ParticipationRow[] | null` hook whose real implementation would be a Supabase query once a shared client exists). Prove your grouping/filtering/threshold logic works correctly against realistic **fixture** data (fabricated names only, constitution item 6) covering: a student below 70%, a student at exactly 70% (boundary — decide and document whether "below 70%" is strictly `<` or `<=` 70, since PRD's own wording is "below 70%" which reads as strict `<`), a student with `expected_ct = 0` (the T014-tested no-completed-sessions case — must not divide-by-zero or fabricate a percentage), and students across at least two different teams (to prove grouping is real, not just a flat list with a team column). Flag the shared-client gap explicitly as a dispute candidate (same recommendation other tasks in this batch are making — likely one shared-client task would unblock several Ready/Blocked UI tasks at once).

**4. No "Grouped Table" documented Astryx component exists.** Grepped `docs/swarm/astryx-api.md` directly — there is no `# Grouped Table` (or similarly named) component entry, the same category of gap T016 hit with "Basic Login" (a CLI **template** name, not a documented component with a props table). Build the grouped/team-sectioned table using the real, documented `Table` component (props: `data`, `columns`, `density`, `dividers`, etc. — cite `astryx-api.md`'s `Table` section directly) composed with `Section` (for the team-level grouping regions) rather than inventing a bespoke "Grouped Table" component from scratch or fabricating props on `Table` that aren't documented. State this explicitly in your output, following the same "template name vs. documented component" reconciliation T016 did for `Basic Login`.

## Acceptance Criteria
- **BLOCKER-class (constitution item 3):** every number rendered (expected/present/late/excused counts, participation %) is read directly from `v_student_participation`'s columns — zero re-derivation of the MET-01 formula in TypeScript anywhere in this task's files. Grep-provable.
- `TabList`: Participation | Hours | Events (RPT-01), with the latter two rendering clearly-labeled placeholders (not fake data) since their content is out of scope (see Forbidden Files).
- Grouped by team (RPT-02); `PowerSearch` filter supports team/below-%-threshold/name (cite `astryx-api.md`'s `PowerSearch` `config`/`filters`/`onChange` props); "below 70%" quick-filter chip returns correct rows against fixture data, proven with a real test, not just a screenshot.
- `ProgressBar` used for participation % (cite props from `astryx-api.md`'s `ProgressBar` section — required `label`, `value`, etc.).
- Coach/admin-only restriction implemented at the component level per Known Context/Traps #1, with the gap explicitly flagged.
- No box-drawing/bracket characters rendered (constitution item 13).
- `npm run build`/`typecheck`/`lint` all exit 0.

## Relevant Constitution Excerpts
> 3. RLS policies and metric SQL come **only** from PRD Section 8.4, copied verbatim. Re-deriving either, or duplicating a metric formula in TypeScript (PRD DATA-01) → BLOCKER.

> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md`. A prop absent from that file is presumed hallucinated → MAJOR.

> 6. No PII... test fixtures use fabricated names.

> 13. Wireframes are structural intent... Routes marked "template as-is" get the named Astryx template; inventing custom layout there → MAJOR. *(Note: RPT-01/02 is not marked "template as-is" with a documented component in this case — see Known Context/Traps #4 — so build from documented primitives, this constitution item is cited for the general principle of not inventing undocumented structure, not because a literal named template exists here.)*

Non-Negotiable: "No worker may mark its own work complete." Every checker inspects the actual artifact.

## PRD Ground Truth (verbatim)
> **RPT-01** "`/reports` (coach/admin), season-scoped, `TabList`: **Participation | Hours | Events**."

> **RPT-02 Participation tab:** "`Grouped Table`-style table grouped by team: student, meetings expected / present / late / excused, participation % (MET-01) with `ProgressBar`, sortable; `PowerSearch` filter (team, below-% threshold, name). A 'below 70%' quick filter chip answers P-COACH2."

> **RPT-06** "Students/parents do not access `/reports`; their equivalents live on Home and `/meetings`."

> 7.1: "**Template as-is:** ... `/reports` → `Grouped Table` per tab (columns per RPT-02…04)."

## Most Recent Failure
None. This is attempt 1 for T056 (attempt count: 0).

## Required Worker Output
- Full contents of `ReportsShell.tsx` and `ParticipationTab.tsx`.
- Astryx prop-by-prop citations (`Table`, `Section`, `PowerSearch`, `ProgressBar`, `TabList`, whatever else you use).
- Explicit statement reconciling "Grouped Table" (template name, no documented component) against the real components you used (Known Context/Traps #4).
- Explicit statement of your RLS-on-views finding (Ground Truth section) rather than an assumption.
- Explicit flag of the router-level RPT-06 gap and the shared-Supabase-client gap, each with your recommendation.
- Test output: P-COACH2 "below 70%" scenario walkthrough against fixture data covering the boundary/zero-expected/multi-team cases described in Known Context/Traps #3.
- Grep confirming zero TypeScript re-derivation of the participation formula.
- `npm run build`/`typecheck`/`lint` output.
- Known risks; whether a dispute is needed.
