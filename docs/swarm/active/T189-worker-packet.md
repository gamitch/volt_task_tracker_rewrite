# T189 — a deactivated student's `/meetings` must stop contradicting itself

**Branch:** `claude/t189-inactive-copy` (already created, off `main` = `83a85e5`)
**Tier:** small build. One new seam, one new branch, tests.
**Owner ruling is already made — do not reopen it.** See "The ruling" below.

---

## 1. The defect, traced end to end (verified in source at `83a85e5`)

A deactivated student who reaches `/meetings` sees **their real last-5 attendance dots sitting
directly beside "— (no completed meetings recorded yet this season)"**. The dots prove completed
meetings exist; the sentence next to them denies it. One widget, two contradictory claims.

Why it happens — three links, each verified:

1. `queryStudentIdByProfileId` (`src/lib/supabase/loaders/meetings.ts:491`) filters on `profile_id`
   only. **No `is_active`.** A deactivated student resolves to a real `studentId` normally.
2. The strip's dot row comes from `queryAttendanceForStudent` (`loaders/checkin.ts:299`), a plain
   `attendance` select. **No `is_active`.** Real history renders.
3. Only the participation figure reads `v_student_participation`, whose definition
   (`supabase/migrations/20260722000000_membership_views.sql:59-80`) ends **`where s.is_active`**
   at `:67`. So participation alone comes back empty.

**Reachability is established, not assumed:** T184 verified `is_active` appears **zero** times in
`auth.ts` and `guards.tsx`, and nothing has added a sign-in block since.

**T180 did not cause this** — it raised its visibility by deleting the host's own participation
section, which moved the figure next to the dot row. The defect predates it.

---

## 2. The ruling (owner, verbatim: **"honest copy"**)

Recorded in `docs/swarm/auto-mode-decisions.md` (2026-07-31, T189).

Replace the contradictory pair with **one honest statement** that the student's account is inactive
and participation is therefore not tracked. **Their meeting history stays visible** — Upcoming and
Past are correct data and are NOT touched.

This settles what T184's ruling left open for this surface: the app will now say the same thing
about a deactivated student on `StudentHome` and on `/meetings`.

**Not authorized:** hiding the page, blanking it, or removing Upcoming/Past.

---

## 3. Detection — use the mechanism T184 already established, and understand why

**Do not read an `is_active` column.** T184's accepted design never does. It **infers**:
`resolveStudentId` confirms the student row is real, then `resolveStudentScope` — which reads an
`is_active`-filtered view — returns `null`. See `StudentHome.tsx:1556-1589`
(`StudentIdentityOutcome`, `resolveStudentIdentity`).

**Why `resolveStudentScope` is a valid detector and the participation figure is NOT.** This is the
trap in this task; get it wrong and you will ship a worse bug than the one you fixed.

- `v_student_goal_projection` (`20260723000001_dashboard_views.sql:322-334`) is a projection over
  `students` with `left join`s and `coalesce(..., 0)`, ending `where s.is_active`. **An active
  student with zero activity still gets a row.** Null ⇒ inactive. Sound.
- `v_student_participation` requires completed sessions to exist at all. **A brand-new active
  student with nothing completed also gets no row.** Null ⇏ inactive. Using it would tell an active
  newcomer their account was deactivated.

Use `resolveStudentScope` (`src/lib/supabase/loaders/students.ts:444`, type `ResolveStudentScopeFn`).

---

## 4. Where the change goes — scope is deliberately narrow

`MeetingsList.tsx` only. Specifically:

- `MeetingsListProps` gains **`resolveStudentScope?: ResolveStudentScopeFn`**, defaulting to the
  real singleton — exactly the convention `resolveStudentId`, `loadCoachData`, `loadStudentData`
  and `onCancelSession` already follow in that same props interface (`:2496-2516`).
- Thread it through `StudentMeetingsViewContainer` (`:2462`) into the resolved path.
- Resolve it **alongside** the existing id resolution, and branch on the outcome.

**Forbidden, and each for a concrete reason:**

- **Do NOT widen `ResolveCurrentStudentIdFn`'s return type** (`:725`). It is shared by
  `StudentMeetingView`, `OutreachList` and `StudentHome`; widening fans out to three pages.
- **Do NOT change `ConsistencyStrip`'s or `StudentMeetingView`'s props.** That export is imported by
  the parallel session's `ParentHome.tsx:376`, and T180's criterion C6 exists precisely to protect
  that signature.
- **Do NOT change `v_student_participation`.** `where s.is_active` is *correct* for aggregate team
  metrics and wrong only for a student viewing themselves. Removing it needs a migration
  (item 18 trigger 1) and silently changes every other consumer.
- **Do NOT touch `loaders/meetings.ts` or `loaders/checkin.ts`.**

---

## 5. What to render

When the student resolves but `resolveStudentScope` returns `null`:

- **Keep** `<Heading level={1}>Meetings</Heading>`, and **keep both** `StudentHistorySection`s
  (Upcoming and Past) with their real rows.
- **Replace** the `Recent attendance` heading + `<StudentMeetingView variant="own" …>` block
  (`:2384-2395`) with a single honest statement.
- Match T184's wording so the two surfaces agree. T184 shipped (`StudentHome.tsx:1687-1689`):
  title `"Your student account is inactive"`, description `"Your student account has been
  deactivated. If you think this is a mistake, contact your coach or team admin."`
  Here the account is not the whole page, so the copy must ALSO say participation is not tracked
  while the account is inactive. Keep it to one short block; do not invent a new component.
- The empty-state/`isEmpty` path must be unaffected for **active** students.

---

## 6. Acceptance criteria — every one must be falsifiable by a named mutation

For each, state the mutation you ran and paste the real red output. **A criterion whose mutation
leaves the suite green is not a criterion — report that instead of shipping it.**

- **C1** Inactive student (id resolves, `resolveStudentScope` → `null`): the honest copy renders,
  and the string `no completed meetings recorded yet` is **absent**.
- **C2** Same student: **Upcoming and Past still render their rows.** Assert a real row's text is
  present — this is the half of the ruling most likely to be silently dropped.
- **C3** Active student with a real scope: page renders exactly as today — strip present, honest
  copy **absent**. Mutation: force the scope resolver to return `null` and watch C3 go red.
- **C4** Active student with **zero completed sessions** (scope non-null, participation null): the
  honest copy is **absent**. This is the newcomer-misclassification trap in §3; it must be a
  standalone test.
- **C5** `resolveStudentScope` is **never called** when an explicit `studentId` prop is supplied
  (the fixture path, `:2478`). Assert on a spy's call count.

Assertions use `container.textContent`, never `innerHTML`. Every presence assertion must be paired
with the corresponding absence assertion.

---

## 7. Gates — run all six, `.env.local` ABSENT, report every one

```
npx tsc --noEmit                 (expect exit 0)
npx vite build                   (expect success)
npm run format:check             (expect clean)
npx eslint .                     (0 errors; report the warning count and explain any rise)
npx vitest run                   (base 72 files / 1732 tests; report new totals)
npx vitest run src/pages/meetings/MeetingsList.test.tsx >/dev/null 2>&1; echo $?   (must be 0)
```

A gate omitted from your report is treated as not run. **A green pass count with a nonzero exit
code is a real failure on this project and has bitten a task here before.**

---

## 8. Allowed files

- `src/pages/meetings/MeetingsList.tsx`
- `src/pages/meetings/MeetingsList.test.tsx`
- `docs/swarm/active/T189-worker-output.md` (create — evidence doc)

Everything else Forbidden. Work in your own git worktree (item 23) — do not move the shared
checkout's HEAD. **Do not commit a `node_modules` symlink**; one reached `main` tonight exactly that
way and needed PR #14 to revert. Stage with explicit pathspecs, never `git add -A`.

Commit to `claude/t189-inactive-copy`, push, report the SHA, and include a
"Deferred — for the ledger" section (item 20). You do not self-certify.
