# T180 — worker packet (revision 1)

**Task:** `StudentMeetingView`'s outer wrapper is finished, tested, and mounted nowhere. Its
intended host still renders an explicitly-labelled placeholder saying the feature "isn't built
yet." Mount it, and resolve the duplicate participation bar that mounting creates.

**Worker tier:** `sonnet`. **Checker:** `checker-reviewer` (`opus`).

**Tier reasoning.** Read-only: no mutations, no auth logic, no schema. Every seam already defaults
to a real loader. Item 18 does not fire on any trigger. Item 25 applies. The checker stays `opus`
because this task makes a **product-visible deletion** (see Trap 2) and because it edits a file
another session's task imports (see Trap 5).

**Base:** `main` = `95e6702`. Branch `claude/t180-student-meeting-view`.

---

## 1. Objective

**Part A — mount it.** Replace `MeetingsList.tsx`'s placeholder "Recent attendance" `Section` with
the real `StudentMeetingView`, passing the `studentId` the host has already resolved.

**Part B — one participation bar, not two.** Mounting the strip puts a second, independently
loaded "Participation" region directly beside the host's existing one. Delete the host's. See
Trap 2 — **this is a deliberate product decision, and it is the orchestrator's call, not the
owner's.** It is called out here so the checker grades it as a decision rather than a slip.

---

## 2. Allowed files

- `src/pages/meetings/MeetingsList.tsx`
- `src/pages/meetings/MeetingsList.test.tsx`
- `src/pages/meetings/StudentMeetingView.tsx` — **module doc corrections only** (see Trap 5)
- `src/pages/meetings/StudentMeetingView.test.tsx`

**Forbidden — everything else**, and specifically:

- `src/pages/home/ParentHome.tsx` and `src/lib/supabase/loaders/parentHome.ts` — **another session
  is actively editing both** (task T191). They import from `StudentMeetingView.tsx`. See Trap 5.
- `src/lib/supabase/loaders/checkin.ts` and `src/lib/supabase/loaders/meetings.ts` — both loaders
  are already real and already correct. You are wiring, not building.
- `supabase/migrations/**`, `docs/swarm/**` (except your own output doc at
  `docs/swarm/active/T180-worker-output.md`).

---

## 3. Known context and traps

### Trap 1 — the host has already resolved `studentId`; do not make it resolve twice

`MeetingsList.tsx`'s `StudentMeetingsView` always receives a **resolved** `studentId: string` —
either an explicit prop or the output of `ResolvedStudentMeetingsView`'s own `resolveStudentId`
load state (`:2440-2482`). `StudentMeetingView`'s `variant="own"` branch will resolve **again** if
you omit `studentId` (`StudentMeetingView.tsx:1052-1074`), costing a second round trip and a
second DES-12 state machine for an id the page already has.

**Mount it with the id passed explicitly:**

```tsx
<StudentMeetingView variant="own" studentId={studentId} />
```

An explicit `studentId` bypasses `resolveStudentId` entirely — that is the documented contract of
its `variant="own"` branch. Criterion C4 pins it.

**Do not use `variant="linked"` here.** That variant fans out to every linked student. This host
is already scoped to exactly one student for parents as well as students — `resolveCurrentStudentId`
resolves a parent to their linked student, and the host renders `EmptyState` ("No student account
linked yet") when it cannot. Rendering a fan-out inside a single-student page would show a parent
one child's history above every child's strip.

### Trap 2 — mounting creates two adjacent "Participation" regions; delete the host's

This is the finding that makes T180 more than a one-line mount. Measured on `main` at `95e6702`:

`MeetingsList.tsx:2355-2367` renders

```tsx
<Heading level={2}>Participation</Heading>
…
<ProgressBar label={`Your participation: ${participation.participationPct}%`} isLabelHidden
  value={participation.participationPct} hasValueLabel />
```

and `StudentMeetingView.tsx:735-749` — inside the `ConsistencyStrip` you are about to mount —
renders

```tsx
<Text type="label">Participation</Text>
…
<ProgressBar label={`Participation: ${participation.participationPct}%`} isLabelHidden
  value={participation.participationPct} hasValueLabel />
```

Same metric, near-identical markup, even the same em-dash empty-state pattern — but **two
different loaders**: the host's comes from `loadStudentMeetingsData` (`loaders/meetings.ts:613`),
the strip's from `loadConsistencyStripDataFromSupabase` (`loaders/checkin.ts`). Two queries, two
numbers, free to disagree on screen. That is the T188 defect shape, and shipping it deliberately
would be worse than T188, which at least happened by accident on two different screens.

**Decision: delete the host's `Participation` section** (the `VStack` containing the `Heading` and
its `ProgressBar`/empty-state). The strip is the purpose-built widget; BEH-06 places the
participation figure next to the dot row by design, and `StudentMeetingView.tsx:38`'s own module
doc already describes the host's bar as the thing the strip supersedes.

**Two facts that make this cheaper than it looks, both measured:**

- **No test asserts on the host's bar.** `grep -rn "Your participation" src/` returns exactly one
  hit — the source line itself. Zero test references.
- **`participation` does not become unused.** It still feeds `isEmpty` at `MeetingsList.tsx:2340`
  (`history.length === 0 && participation === null`). Do **not** remove it from the loader, the
  type, or `buildStudentMeetingsData`. Deleting only the rendered section is the whole change.

**Flag this in your output doc** under a clear heading so the owner sees it in review: a visible
section is being removed from a live page. The reasoning is the orchestrator's, not George's.

### Trap 3 — the placeholder's copy is a claim that becomes false

`MeetingsList.tsx:2382-2390` currently renders, verbatim:

> **Recent attendance** — "A visual "last 5 meetings" view isn't built yet. Your full history is
> listed above in the meantime."

Delete it entirely, including the `// Module doc #7d -- deliberate "consistency strip"-shaped
reference only` comment above it. Leaving it beside a real strip would tell a student the feature
is missing while it renders directly below.

Update `MeetingsList.tsx`'s **module doc #7d** in the same edit — it documents the placeholder as
deliberate.

### Trap 4 — the strip brings its own DES-12 states; do not wrap it in another

`StudentConsistencyStripCard` already has loading (`Skeleton`), error (`Banner` + a real `Retry`)
and empty branches (`StudentMeetingView.tsx:766-810`). The host must not add a second loading
state, error banner, or `Suspense` boundary around it. One region, one state machine.

### Trap 5 — another session is editing files that import this one

`ParentHome.tsx:376` and `loaders/parentHome.ts` both import from `StudentMeetingView.tsx`, and
**task T191 in a parallel session is editing both right now.**

**Therefore: change no export signature in `StudentMeetingView.tsx`.** Not `ConsistencyStrip`, not
`StudentConsistencyStripCard`, not any type. Your edits to that file are **module doc text only**.
Criterion C6 makes this grep-provable, and it is the only thing standing between this task and a
cross-session compile break.

The module doc text that is now false and must be corrected:

- **`:10-30`** — states that `MeetingsList.tsx` "renders an explicitly-labeled placeholder
  `Section` ("Recent attendance") whose copy states, verbatim, that BEH-06's real … strip is
  T037's deliverable and is NOT built there." After this task the placeholder is gone and the
  strip *is* built there.
- **`:38`** — "Upcoming/Past history rows or its own participation `ProgressBar` -- this [task]
  doesn't build those." The host's own bar no longer exists after Part B.

Quote what you replace, so the checker can verify you corrected the real text rather than
paraphrasing it.

### Trap 6 — this file has a locator hazard, same family as T179's

`MeetingsList.tsx` is 2560 lines and renders both a coach and a student/parent view. After this
task the student view contains **two** `role="progressbar"`-adjacent regions' worth of history
markup and a dot row. When asserting, scope to the strip's own container rather than reaching
across the page, and prefer `textContent` over `innerHTML` — `innerHTML` matches generated Astryx
class names and produces false positives on bare numbers. T181's gate measured
`not.toContain('5')` matching `style="width: 65.079…%"`, and `not.toContain('41')` matching the
class `x141an7d`.

---

## 4. Build plan

1. **`MeetingsList.tsx`** — import `StudentMeetingView`; replace the placeholder `VStack`
   (`:2382-2390`) and its comment with the mount from Trap 1; delete the `Participation` `VStack`
   (`:2355-2367`) per Trap 2, leaving `participation` itself and `isEmpty` untouched; update module
   doc #7d.
2. **`MeetingsList.test.tsx`** — criteria C1–C5, C7.
3. **`StudentMeetingView.tsx`** — module doc corrections only (Trap 5). No code, no exports.
4. **`StudentMeetingView.test.tsx`** — only if a criterion needs it; this file's existing 45
   blocks already cover the component itself. Do not restate its coverage.

---

## 5. Acceptance criteria

Every criterion names the mutation that must turn it **red**. Run each, capture the real failure
output, revert. **A criterion whose mutation leaves the suite green is not evidence** — rebuild it
and say so. Absence assertions must be paired with a positive; use `textContent`, never
`innerHTML`.

- **C1 — the strip renders for a student.** Signed in as a student on `/meetings`, the consistency
  strip's dot row is present. Pair it with a positive that the surrounding student view rendered
  (Upcoming/Past headings), so a failed load cannot satisfy it.
  **Mutation:** remove the mount → red.
- **C2 — the placeholder copy is gone, and the real thing is there.** Assert the string
  `"isn't built yet"` is absent **and**, in the same test, that the strip is present.
  **Mutation:** restore the placeholder `VStack` alongside the mount → the absence half goes red.
  *State plainly in your output doc that the absence half alone is not evidence — this project has
  shipped seven-plus absence assertions that passed for the wrong reason.*
- **C3 — exactly one participation region in the student view.** Count the elements whose
  accessible name or label text contains "Participation" — expect exactly **1**, and assert it is
  the strip's (its label reads `Participation: N%`, the host's read `Your participation: N%`).
  **Mutation:** restore the host's `Participation` `VStack` → expect 2, red.
  *This is the criterion that proves Part B, and it is the one most likely to be written
  vacuously. Do not assert only that "Your participation" is absent.*
- **C4 — no second id resolution.** With an explicit `studentId` reaching the host, assert
  `resolveStudentId` is called **at most once** for the page render.
  **Mutation:** drop `studentId` from the mount so the wrapper resolves for itself → the call
  count rises, red.
- **C5 — the coach view is untouched.** Signed in as coach: no strip, and the coach view's own
  content is present (paired positive).
  **Mutation:** move the mount outside the student/parent branch → red.
- **C6 — no export signature changed in `StudentMeetingView.tsx`** (Trap 5).
  `git diff main -- src/pages/meetings/StudentMeetingView.tsx` shows **only** comment lines
  changed. Paste the diff. If a single non-comment line appears there, stop and report it as a
  dispute rather than proceeding.
- **C7 — the parent path renders the strip too**, scoped to the one resolved student, not a
  fan-out. Assert exactly one dot row.
  **Mutation:** switch the mount to `variant="linked"` → more than one strip, red.

### Gates (all measured with `.env.local` **absent**)

`npx tsc --noEmit` exit 0 · `npx vite build` ✓ · `npm run format:check` clean ·
`npx eslint .` — **0 errors**; base is **359 warnings**, state the delta and explain any change ·
`npx vitest run` — base **70 files / 1689 tests** at `95e6702`; report the exact delta and justify
each added test · and `npx vitest run src/pages/meetings/MeetingsList.test.tsx >/dev/null 2>&1;
echo $?` must print **0** — a green pass count with a nonzero exit code is a real failure on this
project and has already bitten T179 once.

Report all six. A gate omitted from the report is treated as not run.

---

## 6. Deferral

Anything you find and do not fix goes in your output doc under **"Deferred — for the ledger"**
with file, line, what is wrong, and why it was out of scope (item 20). Reserved row numbers for
this task are **T302** and **T303** — the orchestrator files them; do not edit the ledger
yourself. Do not silently widen scope.
