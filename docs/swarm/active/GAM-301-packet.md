# GAM-301 (T407) worker packet — STANDARD

## Defect, measured against `3190342`

`src/components/nav/SideNav.tsx:117` — `const PLACEHOLDER_OUTREACH_BADGE_COUNT = 0;`,
passed as `<Badge variant="neutral" label={PLACEHOLDER_OUTREACH_BADGE_COUNT} />`
at line 175. The comment on the constant says "the real count is wired by
T038"; T038 passed without doing it (checker note: "independently confirmed
`SideNav.tsx` byte-unchanged"). The real computation already exists and is
already wired to real Supabase data on two other surfaces:

- `src/pages/outreach/OutreachList.tsx:1459` —
  `getUnansweredRsvpCount(sessions, rsvps, studentIds)`, exported, pure,
  tested (`OutreachList.test.tsx:1027`). "Unanswered" = an upcoming
  (`status === 'scheduled'`) session with no `rsvps` row at all for that
  student.
- `OutreachList.tsx`'s own `CoachOutreachView` (line 3232) calls it with
  every roster student's id (`data.students.map(s => s.id)`, `data` from
  `loadOutreachData(seasonId)`); `StudentParentOutreachView` (line 3912) calls
  it with `[viewerStudentId]` alone (this codebase currently resolves exactly
  one linked student per viewer, not a list — do not add multi-child support,
  out of scope).
- `data.students`/`data.sessions`/`data.rsvps` all come from
  `loadOutreachData` (`src/lib/supabase/loaders/outreach.ts:1122`, the real,
  non-fixture default — `OutreachList`'s injectable `loadData` prop defaults
  to it at line 4430; the fixture loader (`defaultLoadOutreachData`) is a test
  seam only, never the production default).
- `resolveCurrentStudentId` (`src/lib/supabase/loaders/meetings.ts:1120`) is
  the shared real resolver for "which `students.id` does this signed-in
  student/parent map to" — already reused verbatim by
  `StudentHome.tsx`/`MeetingsList.tsx`/`OutreachList.tsx`. Its input type is
  `CurrentViewerIdentity` (`{ id: string; role: Role }`,
  `MeetingsList.tsx:803`), its output `string | null`.

**Do not re-derive any of the above** (constitution item 3) — import and call
them.

## Seam decision (orchestrator's call, per the issue's own framing)

`SideNav` currently takes no props and no data. It is mounted once, inside
`SeasonProvider`, and persists across route changes (`AppShell.tsx` — same
persistent-mount property `KpiStrip.tsx`'s own module doc documents and
relies on for "one fetch per page load, not a refetch storm").

**Decision: `SideNav` owns its own badge fetch, the same shape `KpiStrip`
already established for chrome-level data** (own `useActiveSeason()` call,
own load-state, own role branch) — not threaded down from `AppShell`.
Rationale: `AppShell.tsx` has no outreach-domain knowledge today and adding
it there would leak an outreach concept into the shell for one badge: the
same reasoning `KpiStrip`'s own module doc gives for being mounted as an
`AppShell` sibling rather than folded into `TopNav`/`SideNav`. Add two
**optional, defaulted** props to `SideNav` purely as a test seam (the same
"real default, injectable for tests" idiom every loader-consuming component
in this codebase uses — see `OutreachList`'s `loadData`/`resolveStudentId`
props) so `AppShell.tsx` needs **zero changes** — `<SideNav />` with no props
keeps working:

```ts
export interface SideNavProps {
  loadOutreachBadgeData?: LoadOutreachDataFn; // defaults to the real loadOutreachData
  resolveViewerStudentId?: ResolveCurrentStudentIdFn; // defaults to the real resolveCurrentStudentId
}
export function SideNav(props: SideNavProps = {}): ReactNode
```

## Required behavior

1. On mount (and whenever the resolved season id or signed-in viewer
   changes), resolve the badge count:
   - `useActiveSeason()` status `'loading'` → badge count is **not yet
     known**; do not render the `<Badge>` for Outreach (no badge is honest;
     re-rendering the placeholder `0` is exactly the defect this task fixes).
     Rules of Hooks: `useActiveSeason()` and `useAuth()` are both called
     unconditionally, same as `KpiStrip`'s own precedent.
   - `'none'` (no active season) → resolve to a count of `0` (there is
     nothing to RSVP to with no active season) and render the Badge with
     `0`. This is a real, computed zero, not the old placeholder.
   - `'error'` → do not render the Badge (never fabricate a number; do not
     crash the nav).
   - `'ready'` → call `loadOutreachBadgeData(season.id)` (defaulted to the
     real `loadOutreachData`). In parallel: if `useAuth().user` is
     `admin`/`coach` (same `isStaffRole` check already at `SideNav.tsx:143`),
     student ids = every id in the result's `students`; otherwise call
     `resolveViewerStudentId({ id: user.id, role: user.role })` (defaulted to
     the real `resolveCurrentStudentId`) and use `[studentId]` if non-null,
     `[]` if `null` (no linked student → a real `0`, not an error). Filter
     the loaded `sessions` to outreach-type sessions the same way
     `OutreachListLoaded` does (`filterOutreachEvents(data.events)` →
     build the outreach event id set → filter `data.sessions` by
     `eventId` membership) before calling `getUnansweredRsvpCount`. A
     rejected fetch → same as `'error'` above: no Badge, no crash.
   - `useAuth().user === null` (session still resolving / signed out): do not
     render the Badge (mirrors `TopNav`'s own null-safe `isStaffRole` check
     degrading to the non-staff path, `SideNav.tsx:143` unchanged elsewhere).
2. Every other existing `SideNav` behavior (role-filtered items, active-item
   highlight, `document.title`, collapsibility) is unchanged. Do not touch
   `NAV_ITEMS`, the active-item logic, or non-Outreach items.
3. `variant="neutral"` stays hardcoded on the Badge (BEH-04's "never
   error/red" requirement — unrelated to this task, do not change it).

## Allowed Files

- `src/components/nav/SideNav.tsx` (edit)
- `src/components/nav/SideNav.test.tsx` (new — no such file exists today,
  confirmed by `ls`)

Nothing else. In particular: do not edit `AppShell.tsx` (the defaulted-props
seam above makes that unnecessary), do not edit `OutreachList.tsx` or
`loaders/outreach.ts`/`loaders/meetings.ts` (only import from them), no
migration, no new Supabase view.

## Acceptance criteria

1. `PLACEHOLDER_OUTREACH_BADGE_COUNT` is gone from `SideNav.tsx` (grep-clean).
2. A coach/admin viewer's Outreach badge equals
   `getUnansweredRsvpCount(outreachSessions, rsvps, allStudentIds)` computed
   from the same fixture data the test supplies via `loadOutreachBadgeData`.
3. A student/parent viewer's Outreach badge equals
   `getUnansweredRsvpCount(outreachSessions, rsvps, [resolvedStudentId])`.
4. A student/parent viewer with no resolvable student id (`resolveViewerStudentId`
   resolves `null`) sees a `0` badge, not a crash and not the old placeholder
   constant.
5. `useActiveSeason()` `'loading'` and `'error'` states, and a rejected
   `loadOutreachBadgeData`, each render `SideNav` with **no** Outreach Badge
   (assert the Badge is absent, not that it shows `0` — a hidden badge and a
   fabricated `0` are different claims and only the first is honest here).
6. `useActiveSeason()` `'none'` renders the Outreach Badge with `0`.
7. Every other `SideNav` test-observable behavior (item visibility by role,
   active-item highlight/`document.title`, non-Outreach items never get a
   Badge) is unchanged — add at least one regression assertion per existing
   behavior category since no prior `SideNav.test.tsx` existed to inherit
   coverage from.
8. `npm run typecheck`, `npm run lint`, `npm run format:check`,
   `npm run test` (full suite) and `npm run build` all exit 0. Report the
   file/test counts.
9. **Mutation replay for criterion 2 or 3** (constitution item 26's "commit
   before mutating" — commit first): change `getUnansweredRsvpCount`'s
   `!hasResponse` to `hasResponse` (inverts the logic) or similarly break the
   student-id branch used, confirm the new `SideNav.test.tsx` assertion goes
   red, then revert and confirm green again. Report the red output.

## Least confident decisions

1. **Hiding the Badge entirely on `loading`/`error` (criterion 5), rather
   than showing a `0`.** What would make this wrong: if a human reviewer
   considers "badge briefly disappears and reappears" a worse UX than a
   momentarily-stale `0` — but a stale/fabricated `0` is the literal defect
   on this issue, so I judge honesty over layout stability here. Revisit if
   `checker-premise` or the human owner disagrees.
2. **Calling the full `loadOutreachData(seasonId)` for a nav badge**, the
   same heavy query `OutreachList`'s whole page uses, rather than a cheaper
   dedicated query. What would make this wrong: if this turns out to be a
   real perf problem in practice. No lighter read path exists today (grep
   confirmed no `unanswered`/`awaiting` view in `supabase/`), and adding one
   is metric-view SQL — a HEAVY-tier change per item 26 — out of bounds for
   this STANDARD packet. Filing a follow-up item-20 deferral if this is
   judged a real cost, not silently absorbing it.
3. **A parent/student with no linked student resolves to `0`, not a hidden
   badge.** What would make this wrong: if "0 unanswered" reads to a user as
   "you're all caught up" when the true state is "we don't know who you are
   yet." `StudentHome.tsx`'s own DES-12 identity-tier already treats this as
   its own distinct state elsewhere on that page; the nav badge has no room
   for a fourth visual state, so collapsing it to `0` is the least-wrong
   simplification available at this size, not a claim it's ideal.
4. **No test seam for `useAuth()` itself** — the packet reuses
   `test-utils/authHarness`'s `LoginAs`/`AuthProvider` precedent from
   `TopNav.test.tsx` rather than inventing a new one. What would make this
   wrong: if that harness has since changed shape. Verify it still exists
   and still exports `LoginAs` before relying on it.
5. **Treating this as STANDARD, not HEAVY**, despite two files being touched
   and a new data-loading seam being introduced. What would make this wrong:
   if a reviewer judges "new data dependency in the app chrome" itself as
   HEAVY-worthy regardless of the enumerated trigger list. Item 26's triggers
   (write path, RLS/auth/role logic, migration/metric SQL, an export another
   session builds against) are the named test and none apply — this is a
   read-only wiring task reusing an existing, already-tested pure function.
