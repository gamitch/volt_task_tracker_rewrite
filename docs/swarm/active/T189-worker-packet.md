# T189 — a deactivated student's `/meetings` must stop contradicting itself

**Branch:** `claude/t189-inactive-copy` (off `main` = `83a85e5`)
**Tier:** small build — one narrow loader, one new prop, one branch, tests.
**Owner ruling is already made — do not reopen it.** See §2.

> **Packet v2.** v1 went through the premise gate (item 19) and came back **REVISE / BLOCKER**.
> The gate was right on both blockers and its findings are folded in below. The **detection
> mechanism has changed entirely** between v1 and v2 — if you have read v1, discard §3 of it.
> Full gate record: `docs/swarm/active/T189-gate-round1-findings.md`.

---

## 1. The defect, traced end to end (re-verified by the gate at `83a85e5`)

A deactivated student on `/meetings` sees **their real last-5 attendance dots directly beside
"— (no completed meetings recorded yet this season)"** (`StudentMeetingView.tsx:736-745` then
`:749-763`, the sentence at `:753`). One widget, two contradictory claims.

1. `queryStudentIdByProfileId` (`loaders/meetings.ts:491`, body `:495-499`) filters `profile_id`
   only. **No `is_active`.** A deactivated student resolves normally.
2. The dot row comes from `queryAttendanceForStudent` (`loaders/checkin.ts:299-307`), a plain
   `attendance` select. **No `is_active`.** Real history renders.
3. Only participation reads `v_student_participation` (`membership_views.sql:59-81`), whose
   `expected` CTE closes with **`where s.is_active`** at `:67`. Participation alone comes back empty.

`is_active` appears **zero** times in `auth.ts` and `guards.tsx`, so this is reachable. **T180 did
not cause it** — it raised visibility by moving the figure next to the dots.

---

## 2. The ruling (owner, verbatim: **"honest copy"**)

`docs/swarm/auto-mode-decisions.md:1151-1162`. Say **once**, honestly, that the account is inactive
and participation is therefore not tracked. **Upcoming and Past history stay visible.** Hiding the
page, blanking it, or dropping the history sections is **not authorized**.

---

## 3. Detection — read `students.is_active` directly. Do NOT infer.

**This reverses v1.** v1 said to reuse T184's inference (`resolveStudentScope` returning `null`).
The gate proved that unsound, and the reason is worth carrying:

`v_student_goal_projection` (`dashboard_views.sql:322-334`) contains
**`join seasons se on se.is_active`** at `:331` — an **inner** join. With **zero active seasons the
view returns no row for any student**, active or not, so `null ⇒ inactive` is false in a reachable
state. `SeasonProvider` models `'none'` as a real user-visible state (`SeasonProvider.tsx:118-121`),
and `seasons_single_active_idx` (`identity_roster.sql:53`) guarantees *at most* one active season,
not at least one. **`MeetingsList.tsx` consumes no season context at all** (grep: zero hits for
`useActiveSeason`/`SeasonProvider`), so it cannot gate on that the way `StudentHome.tsx:1791-1830`
does. Inferring here would tell **every** student their account was deactivated the moment a season
lapsed — strictly worse than the bug being fixed.

**Also do not infer from the participation figure.** `v_student_participation`'s `expected` CTE
inner-joins `event_sessions … and es.status = 'completed'`, so a **brand-new active student with
nothing completed** produces no row either. Null ⇏ inactive.

**Therefore: read the column.** `students.is_active boolean not null default true`
(`identity_roster.sql:65`). A student may read their own row — `own_or_linked_read`
(`rls.sql:100-102`, `id in (select my_student_ids())`). No migration, no season coupling, no
false positives.

Add one narrow loader to `src/lib/supabase/loaders/students.ts`, following that file's existing
`make*` + exported-singleton convention (see `makeResolveStudentScope`/`resolveStudentScope` at
`:422`/`:444`):

```ts
export type ResolveStudentIsActiveFn = (studentId: string) => Promise<boolean | null>;
```

`null` means "no such student row" — distinct from `false` ("row exists, deactivated"). Do not
collapse them; the caller needs the distinction and `ResolvedStudentMeetingsView` already has its
own separate "no student account linked" state at `:2449-2457`.

---

## 4. Where the change goes

- `MeetingsListProps` (`:2495-2516`) gains **`resolveStudentIsActive?: ResolveStudentIsActiveFn`**,
  defaulting to the new real singleton — the convention `resolveStudentId`, `loadCoachData`,
  `loadStudentData` and `onCancelSession` already follow there.
- Thread it through `StudentMeetingsViewContainer` (interface `:2462`, component `:2473`) and into
  **`StudentMeetingsView`'s own props** — the gate flagged that v1 omitted this and it is the one
  edit that makes the feature work. `StudentMeetingsViewProps` is exported but has **no consumer
  outside this file** (gate-verified), so this is safe.

**Forbidden, each for a measured reason:**

- **Do NOT widen `ResolveCurrentStudentIdFn`** (`:725`) — shared by `StudentMeetingView`,
  `OutreachList`, `StudentHome`; widening fans out to three pages.
- **Do NOT change `ConsistencyStrip`'s props.** `ParentHome.tsx:376` imports it, and T180's
  criterion C6 exists to protect that signature.
- **Do NOT change `v_student_participation` or `v_student_goal_projection`.** Both are correct for
  their real consumers; changing either needs a migration (item 18 trigger 1).
- **Do NOT touch `loaders/meetings.ts` or `loaders/checkin.ts`.**

---

## 5. What to render, and **where the branch sits**

**The inactive check goes ABOVE the `isEmpty` ternary at `:2359`/`:2365`.** The gate measured that
placing it below leaves a deactivated student with zero history rows seeing "No meeting history yet"
instead of the honest copy — the branch is simply unreachable there.

When `resolveStudentIsActive` returns **`false`**:

- **Keep** `<Heading level={1}>Meetings</Heading>` and **both** `StudentHistorySection`s (Upcoming,
  Past) with their real rows.
- **Do not render** the `Recent attendance` heading or `<StudentMeetingView variant="own" …>`
  (`:2394-2395`).
- Render **one** `EmptyState`-shaped honest block, mirroring `StudentHome.tsx:1690-1694`. T184's
  shipped copy (`:1692-1693`) is title `"Your student account is inactive"`, description
  `"Your student account has been deactivated. If you think this is a mistake, contact your coach
  or team admin."` Extend the description here to also say participation is not tracked while the
  account is inactive. Do not invent a new component.

`true` and `null` both render exactly as today.

---

## 6. Acceptance criteria — with the code-level mutation for each

The gate measured that **C2–C5 pass against current code**; they are regression guards, not proofs
of the fix, and the packet must not pretend otherwise. Only C1 discriminates against today's
defect. Each still needs a **named production-code mutation** that turns it red — run it, paste the
real output.

- **C1** — inactive (`false`): honest copy renders; `no completed meetings recorded yet` **absent**.
  *Mutation: delete the `isActive === false` branch.* (Discriminates against current code.)
- **C2** — same student: **Upcoming and Past still render their rows** — assert a real row's text.
  *Mutation: drop the two `StudentHistorySection`s from the inactive branch.* This is the half of
  the owner's ruling most likely to be silently dropped.
- **C3** — active (`true`) with a real scope: page renders as today; honest copy **absent**.
  *Mutation: invert the branch to `isActive !== false`.*
- **C4** — active with **zero completed sessions** (participation `null`, `isActive === true`):
  honest copy **absent**. *Mutation: use `participation === null` as the detector instead of
  `isActive === false`* — the exact trap §3 describes.
- **C5** — `resolveStudentIsActive` is **never called** when an explicit `studentId` prop is
  supplied (the fixture path, `:2479-2481`). Assert a spy's call count.
  *Mutation: call it in that branch too.*
- **C6** — inactive **and** zero history rows and null participation: honest copy renders, and
  `No meeting history yet` is **absent**. This is MAJOR 3; it fails today.
  *Mutation: move the inactive check below the `isEmpty` ternary.*

`container.textContent`, never `innerHTML`. Pair presence with absence wherever both are meaningful;
C4 and C5 are absence-only by nature and that is fine — v1's blanket pairing rule was wrong.

---

## 7. Authorized harness change — read this before you touch the test file

**The gate measured that adding the defaulted prop turns five currently-green tests red**, taking
`MeetingsList.test.tsx` from **76 passed** to **5 failed | 71 passed**. This is expected, disclosed,
and **authorized** — it is a seam addition, not a behaviour change.

Cause: those five take the **resolved** path (they pass `resolveStudentId` but no explicit
`studentId`), so they reach the **real** defaulted loader, which with `.env.local` absent rejects
(`loader.ts:168-175`) and lands the tier in its error state. `DashboardPage.test.tsx:39-42` documents
this exact trap verbatim; `OutreachList.test.tsx:158-165` records the same lesson.

Inject a fake at these five call sites — `MeetingsList.test.tsx:1163`, `:1179`, `:1189`, `:1216`,
`:1276` — each returning `true`. Add a `fakeResolveStudentIsActive` helper beside
`fakeResolveStudentId` (`:261`), matching this file's own convention. **The gate verified this
remedy: 76/76 restored, `tsc` clean.**

`:1216` belongs to **T302** (merged `3fb44a7`) and `:1276` to **T096** (retargeted by T180). Do not
alter what either asserts — add the injection only. If you find yourself changing an assertion,
stop and file a dispute.

**Pin `MeetingsList.test.tsx` back to 76 passing before adding any new test.**

---

## 8. Gates — all six, `.env.local` ABSENT, report every one

```
npx tsc --noEmit                 (expect exit 0)
npx vite build                   (expect success)
npm run format:check             (expect clean)
npx eslint .                     (0 errors; report the warning count, explain any rise)
npx vitest run                   (base 72 files / 1732 tests — gate-measured; report new totals)
npx vitest run src/pages/meetings/MeetingsList.test.tsx >/dev/null 2>&1; echo $?   (must be 0)
```

A gate omitted from your report is treated as not run. **A green pass count with a nonzero exit code
is a real failure on this project and has bitten a task here before.**

---

## 9. Allowed files

- `src/pages/meetings/MeetingsList.tsx`
- `src/pages/meetings/MeetingsList.test.tsx`
- `src/lib/supabase/loaders/students.ts`
- `src/lib/supabase/loaders/students.test.ts`
- `docs/swarm/active/T189-worker-output.md` (create — evidence doc)

Everything else Forbidden. Work in your own git worktree (item 23); do not move the shared
checkout's HEAD. **Do not commit a `node_modules` symlink** — one reached `main` tonight exactly that
way and needed PR #14 to revert it. Stage with explicit pathspecs, never `git add -A`.

Commit to `claude/t189-inactive-copy`, push, report the SHA, and include a
"Deferred — for the ledger" section (item 20). You do not self-certify.
