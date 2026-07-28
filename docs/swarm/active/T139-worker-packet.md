# Worker Packet: T139 — give `RosterShell` the pass-through props its four tabs already accept (D-2 / D006)

Small, additive task. One component signature, five optional props, no behaviour
change for any existing caller.

**Numbering note:** T138 is reserved for the colour/composition rollout planned
after T136. This packet was written first because its files are disjoint from
both tasks currently in flight; it does not depend on T136 or T137.

**Packet SHA: pin this.** Before writing your output doc, run
`git log -1 --format=%H -- docs/swarm/active/T139-worker-packet.md` and confirm
it matches the SHA named in your dispatch prompt. A sibling task shipped against
a superseded packet revision; this step exists because of it.

## FIRST — merge the working branch

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```

Report the result. **If it conflicts, stop and report.**

## Why this exists

**D-2, decided by George on 2026-07-28: add the loader seam.**

`/roster` cannot be captured with real-looking data. Every tab under it already
exposes an injectable `loadData` seam — `StudentsTab.tsx:1067`,
`ParentsTab.tsx:943`, `TeamsTab.tsx:1104`, `InvitesTab.tsx:707` — and
`AdminToggles.tsx:318` exposes `loadPrivacySetting`. But `RosterShell.tsx`
renders all five with **no props at all** (`:200-207`), so nothing outside the
shell can reach those seams. With no Supabase configuration in the capture
environment, every tab falls to its error state and a roster screenshot shows a
"Supabase isn't configured" banner instead of a table.

T134 shipped exactly that as the canonical `new-roster.webp`; its checker
correctly failed it. Every future task needing a roster capture hits this
identically.

This is **not** "add a seam" — the seams exist. It is pass-through plumbing on
the one component that swallows them.

## The change

Give `RosterShell` an optional props object that forwards to each child.

```ts
export interface RosterShellProps {
  studentsTabProps?: StudentsTabProps;
  parentsTabProps?: ParentsTabProps;
  teamsTabProps?: TeamsTabProps;
  invitesTabProps?: InvitesTabProps;
  adminTogglesProps?: AdminTogglesProps;
}
```

Spread each into its child. `RosterShell` currently has the signature
`RosterShell(): ReactNode` (`:178`); it becomes
`RosterShell({ ... }: RosterShellProps = {}): ReactNode`.

**Every prop must be optional and every default must remain the real loader.**
`router.tsx` renders `<RosterShell />` with no props and is a forbidden file
here — it must keep compiling and behaving identically. Each tab already
defaults each of its own props individually, so spreading `undefined` or `{}` is
equally safe; do not over-engineer this.

`ParentsTab.tsx:1223-1229` is the precedent to copy — the gated wrapper takes
`props: ParentsTabProps = {}` and spreads `{...props}` into the body. Same shape,
one level up.

## Trap — the import cycle is real, verified, and easy to reopen

`RosterShell.tsx:161` imports `AdminToggles` via `lazy(() => import(...))`, not
statically. Module doc #6 (`:115-150`) documents why: a static import closes a
three-file cycle `router.tsx → RosterShell.tsx → AdminToggles.tsx → router.tsx`,
and it was verified live — **five unrelated suites failed** with
`TypeError: Cannot read properties of undefined (reading 'settings')`.

You need `AdminTogglesProps` as a **type**. Import it with `import type`, which
is erased at compile time and creates no runtime edge:

```ts
import type { AdminTogglesProps } from './AdminToggles';
```

A value import (`import { AdminToggles, type AdminTogglesProps }`) reopens the
cycle. Do not convert the `lazy()` call to a static import for any reason.

Run the full suite and confirm those five suites are still green — the failure
mode is in files that look unrelated to roster (e.g. `theme.smoke.test.tsx`), so
a scoped test run will not catch it.

## Explicitly out of scope

- **The KPI strip's error banner.** It comes from `SeasonProvider` in
  `AppShell`, not from anything this shell renders. A roster capture will still
  show it. That is a separate task; do not touch `AppShell` or `SeasonProvider`.
  A checker must not fail this task for it.
- **An `initialTab` prop.** A capture harness that wants Parents/Teams/Invites
  can click the tab — `RosterShell.test.tsx` already exercises tab switching.
  Adding a prop for it is unrequested scope.
- **Actually taking any screenshot.** This task ships the seam. The capture is
  whatever task next needs a roster figure.
- **Deduplicating `useLoadState`.** It is defined module-locally in at least
  eight files (`StudentsTab.tsx:794` and siblings). Real, but not this task.

## Allowed Files

- `src/pages/roster/RosterShell.tsx`
- `src/pages/roster/RosterShell.test.tsx`
- `docs/swarm/active/T139-worker-output.md` (create)

## Forbidden Files

- `src/app/router.tsx` — the no-props call site must keep working untouched.
- `src/pages/roster/StudentsTab.tsx`, `ParentsTab.tsx`, `TeamsTab.tsx`,
  `InvitesTab.tsx`, `AdminToggles.tsx` — their props already exist. If one of
  them genuinely does not expose what you need, **stop and report**; do not add
  a prop to a child.
- `src/app/AppShell.tsx`, `src/app/SeasonProvider.tsx` — see out of scope.
- `docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`,
  `dispute-log.md`, `.claude/**`.

## Acceptance Criteria

1. `RosterShellProps` is exported, all five props optional, each typed as the
   child's own exported props interface — **no invented or restated prop
   shapes**. Import the types; do not redeclare them.
2. `<RosterShell />` with no props renders exactly as it does today. The
   existing 14 tests in `RosterShell.test.tsx` pass **unmodified** — including
   the module-boundary `loadStudentsTabData` mock at `:136-139`, which must keep
   working, since it proves the real default is still in place.
3. `AdminToggles` is still `lazy()`-imported and its props type is imported with
   `import type`. State in your output that you checked the previously-cycle-
   sensitive suites, and name them.
4. New tests prove each pass-through actually reaches its child — at minimum one
   per prop (five). Injecting a fixture loader for a tab must render that
   fixture's data, not an error state. This is the whole point of the task; a
   seam with no test proving it conducts is not a seam.
5. `npx tsc --noEmit`, `npx vite build`, `npm run format:check` clean;
   `npx eslint .` zero errors and no new warnings (baseline **0 errors / 353
   warnings**).
6. `npx vitest run` green. Baseline is **1440 across 62 files**; this task is a
   pure addition, so state your expected end count and whether you hit it. Any
   test outside `RosterShell.test.tsx` that changes is a regression — report it,
   don't silence it.

**Do not certify your own work.**

## Relevant Constitution Excerpt

- Item 2 — Astryx props come only from `astryx-api.md`. This task adds no Astryx
  props; the JSX below the `TabList` is unchanged in shape.
- Item 15 — accessibility is a shipping requirement. Nothing here changes the
  rendered tree for the default call, so no new a11y surface — say so rather
  than claiming an audit you did not run.
- Non-Negotiables — existing tests pass unless explicitly approved; no worker
  self-certifies.

## Required Worker Output

`docs/swarm/active/T139-worker-output.md`:

- The packet SHA you verified.
- The `RosterShellProps` declaration as shipped.
- Proof criterion 2 held: the 14 existing tests untouched and passing.
- The named cycle-sensitive suites and their result (criterion 3).
- Each new test, and what injection it proves.
- Test count started from and ended with.
- Full output of the commands in criteria 5–6.
- Anything unverified, stated plainly as unverified.
