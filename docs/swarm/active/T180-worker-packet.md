# T180 — worker packet (revision 2)

**Task:** `StudentMeetingView`'s outer wrapper is finished, tested, and mounted nowhere. Its host
still renders an explicitly-labelled placeholder saying the feature "isn't built yet." Mount it,
and resolve the duplicate participation region that mounting creates.

**Worker tier:** `sonnet`. **Checker:** `checker-reviewer` (`opus`).

**Revision 2 supersedes revision 1 entirely.** A premise gate built the whole prescribed design in
an isolated worktree, wrote every criterion literally, and ran 9 mutations plus 6 instrumented
probes (`docs/swarm/active/T180-gate-round1-findings.md`, measured at `95e6702`). Verdict: **2
BLOCKER, 4 MAJOR, 6 MINOR** — **four of seven criteria did not discriminate**, and applying
revision 1 verbatim left three pre-existing tests red with no instruction covering them. **Do not
work from revision 1.**

**Base:** `main` = `95e6702`. Branch `claude/t180-student-meeting-view`.
**Baseline, gate-confirmed exact:** `tsc` 0 · `vite build` ✓ · prettier clean ·
eslint **0 errors / 359 warnings** · vitest **70 files / 1689 tests**.

**Tier reasoning.** Read-only: no mutations, no auth logic, no schema. None of item 18's triggers
fire — this task *consumes* `resolveCurrentStudentId`, it does not modify it. The gate agreed the
`sonnet` tier stands **conditional on BLOCKER 1 being fixed**, since a worker handed revision 1
would have hit three red pre-existing tests with no authorization covering them — the situation
most likely to produce an unauthorized test deletion. That authorization is now §3a.

---

## 1. Objective

**Part A — mount it.** Replace `MeetingsList.tsx`'s placeholder "Recent attendance" block with the
real `StudentMeetingView`, passing the `studentId` the host has already resolved.

**Part B — one participation region, not two.** Mounting the strip adds a second, independently
loaded participation figure. Delete the host's. **This is the orchestrator's product call, not the
owner's**, and it is called out so the checker grades it as a decision.

**Part C — the test seam and the three test repairs Part A+B force.** §3a. This is not optional
cleanup; without it the file does not go green.

---

## 2. Allowed files

- `src/pages/meetings/MeetingsList.tsx`
- `src/pages/meetings/MeetingsList.test.tsx`
- `src/pages/meetings/StudentMeetingView.tsx` — **comment/module-doc text only** (Trap 5)
- `src/pages/meetings/StudentMeetingView.test.tsx`

**Forbidden — everything else**, and specifically:

- `src/pages/home/ParentHome.tsx` — task **T191 in a parallel session is editing it**, and it
  imports `ConsistencyStrip` from `StudentMeetingView.tsx` (`ParentHome.tsx:376`). See Trap 5.
- `src/lib/supabase/loaders/parentHome.ts` — also being edited by that session. **Correction to
  revision 1:** it does **not** import `StudentMeetingView`; its imports are `./checkin`,
  `./students`, `../loader`, `../client` and `../../../pages/home/ParentHome`. The forbidden-file
  rule stands; revision 1's stated reason was wrong.
- `src/lib/supabase/loaders/checkin.ts` and `src/lib/supabase/loaders/meetings.ts` — both loaders
  are already real and correct. You are wiring, not building. You may **mock** `checkin` at module
  level in the test file (§3a); that is not a write to it.
- `supabase/migrations/**`, `docs/swarm/**` except your own output doc at
  `docs/swarm/active/T180-worker-output.md`.

---

## 3. Known context and traps

### 3a — BLOCKER: the mount has no test seam, and it breaks three existing tests

`MeetingsListProps` has **no** `loadStripData`. So `<StudentMeetingView variant="own" … />` uses
its own default, `loadConsistencyStripData` (`StudentMeetingView.tsx:1053`) — the **real**
`loaders/checkin.ts` query. With `.env.local` absent it rejects, and the strip lands in its DES-12
**error** branch in every student/parent test in the file. Measured, applying Part A + Part B with
no test changes at all:

```
 FAIL src/pages/meetings/MeetingsList.test.tsx > … populated state: own history + participation %
AssertionError: expected 'MeetingsCouldn\'t load meeting consis…' to contain '57.1%'

 Test Files  1 failed (1)
      Tests  3 failed | 65 passed (68)
```

**This is the third time this project has hit this exact shape**, and both prior instances are
documented in the codebase: `DashboardPage.test.tsx:33-52` (from T176's gate) and
`OutreachList.test.tsx:158-165`. Read one of them before writing yours.

**Decision — use a module-level mock. Do not add a prop.** No source change, and it matches the two
precedents above. Threading a new `loadStripData?` prop would add an optional seam to a props
interface this project has spent T151 and T179 narrowing.

```tsx
const stripSeam = vi.hoisted(() => ({
  load: null as null | ((studentId: string) => Promise<ConsistencyStripData>),
}));
vi.mock('../../lib/supabase/loaders/checkin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase/loaders/checkin')>();
  return { ...actual, loadConsistencyStripData: (studentId: string) => stripSeam.load!(studentId) };
});
```

**Hazard, measured — do not write the factory the obvious way.** A factory that
`await import('./StudentMeetingView')` at factory level dies on the circular module graph:
`TypeError: loadData is not a function`, and separately
`ReferenceError: Cannot access '__vi_import_6__' before initialization`. The lazy-holder shape
above avoids both.

**Three existing tests must be repaired. These edits are AUTHORIZED BY NAME; nothing else is.**

1. **`MeetingsList.test.tsx:1111-1122`** — *"resolveStudentId resolving a real id renders
   StudentMeetingsView scoped to that id."* Its **only** assertion is
   `toContain('57.1%')`, and its comment says that proves the resolved id was threaded to
   `loadData`. Part B deletes that observable. **Replace it, do not delete the test:** spy on
   `loadStudentData` with `vi.fn` and assert
   `toHaveBeenCalledWith(PLACEHOLDER_CURRENT_STUDENT_ID)`. The gate measured this works and keeps
   T096's resolution proof alive.
2. **`:1124-1150`** — asserts `toContain('57.1%')` **and** the placeholder copy. Broken twice.
   Retarget both halves onto the strip.
3. **`:1152-1160`** — *"participation renders '—' (never a fabricated %) when the student has no
   metric row."* **This one is the dangerous one: after the mount it passes again for a completely
   different reason** — the strip's own em-dash empty state, from a different loader. Failure shape
   (b), silently. **Retarget it explicitly**: rename the test to say it is the strip's empty state,
   drive it through `stripSeam`, and keep the `not.toMatch(/\d+%/)` guard. Do not leave the old
   title in place over new behaviour.

### Trap 1 — the host has already resolved `studentId`; do not make it resolve twice

`MeetingsList.tsx`'s `StudentMeetingsView` always receives a resolved `studentId: string`, from
`ResolvedStudentMeetingsView` (**`:2411-2455`** — revision 1 cited `:2440-2482`, which spans a
different component). Mount with the id passed explicitly:

```tsx
<StudentMeetingView variant="own" studentId={studentId} />
```

**All three of this trap's claims were tested by the gate, not read, and all three hold:** an
explicit `studentId` genuinely bypasses resolution (module-level spy: **0 calls**, strip fully
populated at 5 dots); a parent really does resolve to exactly one student
(`resolveCurrentStudentId`'s parent branch returns `rows[0].student_id`); and `variant="linked"`
really is wrong here (9 dots, 3 `<h3>`s, 2 participation bars on a page already scoped to one
student). Pre-existing nuance, not this task's problem: the one student a parent gets is the
*earliest-linked* one, which `loaders/meetings.ts:60-66` already discloses.

### Trap 2 — mounting creates two participation regions; delete the host's

`MeetingsList.tsx:2354-2368` renders a `Heading level={2}>Participation` plus
`<ProgressBar label={`Your participation: N%`} …>`. `StudentMeetingView.tsx:735-749` — inside the
strip you are mounting — renders `<Text type="label">Participation</Text>` plus
`<ProgressBar label={`Participation: N%`} …>`.

**Verified by the gate:** same metric, near-identical markup, and genuinely **two different
loaders** — the host's from `loadStudentMeetingsData` (`loaders/meetings.ts:613`), the strip's from
`loadConsistencyStripData` (`loaders/checkin.ts:455`). Two independent `createLoader` chains, three
queries versus one.

**Honest restatement of the risk, correcting revision 1.** Revision 1 said the two numbers are
"free to disagree on screen" and called that *measured*. The two-loaders half is measured; the
disagreement is an **inference**, and it is **not reproducible from the shipped fixtures** — their
id-spaces are disjoint (see Trap 3). The gate had to cross them by hand to produce the screen:

```
GATE-PROBE cross progressbar names: ["Your participation: 57.1%","Participation: 85.7%"]
```

The product decision stands — that screen is the T188 shape and must not ship — but state it as an
architectural argument, not a measurement.

**Delete the host's `VStack` at `:2354-2368`** (revision 1 said `:2355-2367`; `2355` is the
`Heading`, so the range was off at both ends).

**Two facts about the cost, one of which revision 1 got wrong:**

- ✅ **`participation` does not become unused.** It still feeds `isEmpty` at `:2340`. Leave the
  loader, the type and `buildStudentMeetingsData` alone. Gate-confirmed, `tsc` exit 0.
- ❌ **"No test asserts on the host's bar" was the wrong conclusion from a correct grep.** No test
  names the *label*; **three tests assert on its rendered output** — see §3a. And "deleting only
  the rendered section is the whole change" is false: `ProgressBar` is imported at
  **`MeetingsList.tsx:484`** and used nowhere else afterwards, so with `"noUnusedLocals": true` you
  get `error TS6133: 'ProgressBar' is declared but its value is never read.` **Delete the import
  too**, and its entry in the module doc's components list (Trap 7).

### Trap 3 — the two fixture id-spaces are disjoint, which is why C3 is written the way it is

`MeetingsList.tsx:872-883`'s `FIXTURE_PARTICIPATION_METRICS` holds one row keyed
`PLACEHOLDER_CURRENT_STUDENT_ID` (57.1%). `StudentMeetingView.tsx:497-518`'s holds
`student-jordan-fixture` (85.7%) and `student-morgan-fixture` (66.7%). **No student id populates
both.** So any fixture that makes the strip render its bar leaves the host's `participation` null —
the host renders its em-dash and never emits a second `[role="progressbar"]`.

Consequence: a naive "count the participation bars" test **passes with the host's section
restored**, because there was only ever one bar to count. C3 works around this by construction.

### Trap 4 — the strip brings its own DES-12 states; do not wrap it in another

`StudentConsistencyStripCard` already has `Skeleton` loading (`:773-796`), a `Banner` error with a
real `Retry` (`:798-807`), and an empty branch (`:713-716`). Gate-confirmed. Add no second loading
state, error banner or `Suspense` boundary.

### Trap 5 — another session is editing a file that imports this one

`ParentHome.tsx:376` imports `ConsistencyStrip` from `StudentMeetingView.tsx`, and **T191 is
editing `ParentHome.tsx` right now**.

**Change no export signature in `StudentMeetingView.tsx`.** Your edits there are comment text only.
Criterion C6 makes it grep-provable. The gate confirmed this is achievable: the component is
already exported, and the back-import at `StudentMeetingView.tsx:308` is `import type`, so the
cycle is erased at build time — its whole reference diff was 9 insertions / 6 deletions, every line
inside a `/** … */` block, with `tsc` 0 and `vite build` ✓.

### Trap 6 — placement, and a one-letter naming hazard

**Mount at the placeholder's position — bottom of the student view, after Past.** Deleting the
host's `Participation` section (top, above Upcoming) therefore moves the participation figure from
above the history to below it. That is intended; revision 1 left it ambiguous by saying both.

**The naming hazard, from the gate's own `tsc` output while building this:**

```
src/pages/meetings/MeetingsList.tsx(2354,12): error TS2552: Cannot find name 'StudentMeetingView'.
  Did you mean 'StudentMeetingsView'?
```

The host's own internal component is `StudentMeetingsView`; the thing you are importing is
`StudentMeetingView`. One letter, same file, same JSX block.

### Trap 7 — the module-doc corrections, complete this time and quoted verbatim

Revision 1 named two passages and paraphrased one of them. Its `:38` "quote" was the packet's own
words. The **real** text at `StudentMeetingView.tsx:37-39` is:

```
 * This is NOT a second, competing rebuild of `MeetingsList.tsx`'s own
 * Upcoming/Past history rows or its own participation `ProgressBar` -- this
 * file does not render a session history list at all.
```

**In `StudentMeetingView.tsx`** — all comments, so C6 still holds: `:16-19` (the placeholder
paragraph; revision 1 cited `:10-30`), `:32`, `:37-39`, `:41-42`, `:180`, `:685` (code comment
above `ConsistencyStrip`), `:1022-1023` (JSDoc on `StudentMeetingViewProps.variant`).

**In `MeetingsList.tsx`:** module doc **#7d** (the placeholder rationale), **`:22-27`** ("plus a
participation % sourced from a `v_student_participation`-shaped fixture row"), **`:324-326`** (the
Astryx components-used list still names `ProgressBar` after you delete the import — constitution
item 2 makes that list the file's audit trail), **`:453-454`** ("the single participation
`ProgressBar` in the student view is one bar, not a stack").

**`MeetingsList.tsx:264-266`** ("empty (zero history rows AND no participation row)") **stays
true** — `participation` still feeds `isEmpty`. Do not "fix" it.

### Trap 8 — keep a navigable heading; two `<h2>`s otherwise disappear

Measured, base versus the gate's reference tree, same student view and fixture:

```
BASE:       ["H1:Meetings","H2:Participation","H2:Upcoming","H2:Past","H2:Recent attendance"]
after T180: ["H1:Meetings","H2:Upcoming","H2:Past"]
```

The strip's `variant="own"` branch emits **no heading** (`studentLabel` is only passed by
`variant="linked"`). The nesting itself is fine — `<Section padding={4}>` renders a plain div, not
a `<section>` landmark, so there is no landmark nesting problem and no heading-level skip — but
this page's own module doc has a "one heading per section" rule, and silently dropping two
navigable headings is an item-15 regression.

**Keep the host's `<Heading level={2}>Recent attendance</Heading>` and render the strip beneath
it.** Only the placeholder's `Text` copy is deleted, not its heading. The `Participation` `<h2>` is
genuinely gone — that figure now lives inside the strip as a `Text type="label"` — and that is the
accepted cost of Part B. Net: one `<h2>` lost, deliberately. Criterion C8 pins the result.

### Trap 9 — locator hazards on this page

Use `textContent`, never `innerHTML`: the gate's own DOM dump of this view contained
`<span class="xv1l7n4 x141an7d x1ltkj2j">`, so bare-number and short-string absence assertions
match generated class names. Astryx `ProgressBar` exposes its label through **`aria-labelledby`,
not `aria-label`** — measured:

```html
<div role="progressbar" aria-valuenow="85.7" aria-labelledby="_r_9_" aria-valuetext="86%" …>
```

Resolve accessible names through `aria-labelledby` wherever you assert on them.

---

## 4. Build plan

1. **`MeetingsList.test.tsx`** — add the §3a module-level `checkin` mock **first**, before touching
   source, so you can see the three failures appear and disappear deliberately rather than
   discovering them.
2. **`MeetingsList.tsx`** — import `StudentMeetingView`; replace the placeholder's `Text` copy and
   its `// Module doc #7d …` comment with the mount (Trap 1), keeping the `Recent attendance`
   heading (Trap 8); delete the `Participation` `VStack` at `:2354-2368` and the now-unused
   `ProgressBar` import at `:484`; update module docs per Trap 7.
3. **`MeetingsList.test.tsx`** — repair the three named tests (§3a), then add C1–C5, C7, C8.
4. **`StudentMeetingView.tsx`** — comment text only, per Trap 7.
5. **`StudentMeetingView.test.tsx`** — only if a criterion needs it. Its **42** `it(` blocks
   (revision 1 said 45) already cover the component; do not restate that coverage.

---

## 5. Acceptance criteria

Every criterion names the mutation that must turn it **red**. Run each, capture real output,
revert. **A criterion whose mutation leaves the suite green is not evidence** — rebuild it and say
so in your output doc. Absence assertions must be paired with a positive; `textContent`, never
`innerHTML`.

- **C1 — the strip renders for a student.** Dot row present, paired with the surrounding view's
  Upcoming/Past headings. **Mutation:** remove the mount → `expected +0 to be 5`.
  *Gate-confirmed discriminating as written.*
- **C2 — the placeholder copy is gone and the real strip is there.** Assert `"isn't built yet"`
  absent **and** the strip present, in one test. **Mutation:** restore the placeholder `Text`
  alongside the mount → the absence half reddens, nothing else.
  *Gate-confirmed. State plainly in your output doc that the absence half alone is not evidence —
  it was measured passing against a strip that failed to load.*
- **C3 — exactly one participation bar, proven where it can actually be seen.** Render with
  `studentId = PLACEHOLDER_CURRENT_STUDENT_ID` so the **host's** participation is non-null, **and**
  stub `stripSeam` to return a populated participation. Then collect every `[role="progressbar"]`,
  resolve its accessible name through `aria-labelledby`, and assert exactly
  `['Participation: 85.7%']`.
  **Mutation:** restore the host's `Participation` `VStack` → `["Your participation: 57.1%",
  "Participation: 85.7%"]`, red.
  *Revision 1's version failed both ways: under the accessible-name reading its mutation stayed
  green (74 passed) because the fixture id-spaces are disjoint; under the label-text reading
  "expect exactly 1" was **red against correct code**, because the strip emits both a
  `Participation` label and a `Participation: N%` name. This configuration is the only one the gate
  found where the mutation is visible.*
- **C4 — no second id resolution.** Spy at **module level** on `resolveCurrentStudentId` and assert
  **`toBe(0)`**.
  **Mutation:** drop `studentId` from the mount → `expected 1 to be +0`.
  *Not "at most once", and not a spy on the host's prop. The mount does not forward the host's
  `resolveStudentId`, so a prop spy reads 1 in both trees, and `toBeLessThanOrEqual(1)` is
  satisfied by 1 anyway. Both were measured.*
- **C5 — the coach view is untouched.** Assert the strip's shared vocabulary string
  `meeting consistency` — which its loading, error **and** empty branches all carry, and which
  appears nowhere in the coach view at base — is absent, paired with the dot count and with coach
  content present.
  **Mutation:** hoist the mount out of the student/parent branch → red.
  *Revision 1's version stayed green under its own mutation while the coach's page rendered "No
  student account linked yet" as its first line — because a coach resolves to `null`, so the strip
  rendered an EmptyState and the thing asserted "gone" was never going to render. Failure shape (a),
  exactly.*
- **C6 — no export signature changed in `StudentMeetingView.tsx`.** `git diff main --
  src/pages/meetings/StudentMeetingView.tsx` shows only comment lines. **Check `+`/`-` lines only**
  — context lines are code — and make sure `main` resolves as a local ref in your worktree. Paste
  the diff. If one non-comment line appears, stop and file a dispute rather than proceeding.
- **C7 — the parent path renders one strip, not a fan-out.** Exactly one dot row.
  **Mutation:** switch the mount to `variant="linked"` → red **because the linked path uses a
  different, unstubbed seam** (`loadLinkedStudents`) and renders `Couldn't load linked students`,
  giving 0 dots. Say that. *Revision 1 claimed the mutation produces "more than one strip"; it does
  not, under the default harness. The fan-out is real — stubbed, it gives 9 dots and 3 `<h3>`s —
  and that remains the product argument, but it is not what the mutation shows.*
- **C8 — the heading structure is what Trap 8 decided.** Collect the rendered heading outline for
  the student view and assert exactly
  `["H1:Meetings","H2:Upcoming","H2:Past","H2:Recent attendance"]`.
  **Mutation:** drop the `Recent attendance` heading → red.

### Gates (all with `.env.local` **absent**)

`npx tsc --noEmit` exit 0 · `npx vite build` ✓ · `npm run format:check` clean ·
`npx eslint .` — **0 errors**; base **359 warnings**, state the delta (the gate's reference tree
measured **+0**) · `npx vitest run` — base **70 files / 1689 tests**; report the exact delta and
justify each added test · and
`npx vitest run src/pages/meetings/MeetingsList.test.tsx >/dev/null 2>&1; echo $?` must print
**0** — a green pass count with a nonzero exit is a real failure here and has already bitten T179.

Report all six.

---

## 6. Deferral

Anything found and not fixed goes in your output doc under **"Deferred — for the ledger"** with
file, line, what is wrong, and why it was out of scope (item 20). Reserved rows for this task are
**T302** and **T303**; the orchestrator files them. Do not edit the ledger, and do not silently
widen scope.
