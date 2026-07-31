# T180 — premise gate round 1 (actionable findings, verbatim where it matters)

**Gate:** general-purpose agent with Write+Edit+Bash, 2026-07-31, measured at `95e6702` in an
isolated worktree (constitution item 23). **Shared tree never modified** — the only file this gate
writes there is this findings doc; HEAD unmoved, worktree removed.
**Verdict:** REVISE — 2 BLOCKER, 4 MAJOR, 6 MINOR. **Round 2 of 2 remains available** (item 19a).

It built the full prescribed design — Part A (mount at the placeholder's position), Part B (delete
the host's `Participation` `VStack`), the Trap 5 module-doc-only edit to `StudentMeetingView.tsx` —
wrote C1–C5 and C7 as literally worded, ran **9 mutations plus 6 instrumented probes**, and
reverted. Gates on the finished reference tree: `tsc --noEmit` exit 0 · `vite build` ✓ ·
`npm run format:check` clean · `eslint` **0 errors / 359 warnings** (base 359, **+0**) ·
`vitest` **70 files / 1695 tests** (base 70/1689, **+6**, all mine) ·
`vitest run src/pages/meetings/MeetingsList.test.tsx >/dev/null 2>&1; echo $?` → **0**.

**Four of seven criteria do not discriminate as written, and getting the reference tree to green at
all required work the packet says is unnecessary.** Recorded here so revision 2 is not written from
a summary.

---

## BLOCKER 1 — the mount has no test seam; it fires the real Supabase loader in every existing student test, and breaks three of them

`MeetingsListProps` has no `loadStripData`. `<StudentMeetingView variant="own" studentId={…} />`
therefore uses its own default, `loadStripData = loadConsistencyStripDataFromSupabase`
(`StudentMeetingView.tsx:1053`), which is the **real** `loaders/checkin.ts` query. With `.env.local`
absent it rejects with `SupabaseNotConfiguredError`, so the strip lands in its DES-12 **error**
branch in every student/parent test in the file.

Measured immediately after applying Part A + Part B exactly as the packet prescribes, with **no
test file changes at all**:

```
 FAIL  src/pages/meetings/MeetingsList.test.tsx > <MeetingsList /> student/parent view > populated state: own history + participation % sourced from the fixture row verbatim
AssertionError: expected 'MeetingsCouldn\'t load meeting consis…' to contain '57.1%'

Received: "MeetingsCouldn't load meeting consistencySomething went wrong loading this consistency
strip. Try refreshing the page.RetryUpcomingWeekly Build MeetingWed, Jul 22 · 6:00–8:00 PM · 2h…"
```

```
   × <MeetingsList /> student/parent view > resolveStudentId resolving a real id renders StudentMeetingsView scoped to that id 23ms
   × <MeetingsList /> student/parent view > populated state: own history + participation % sourced from the fixture row verbatim 14ms
   × <MeetingsList /> student/parent view > participation renders '—' (never a fabricated %) when the student has no metric row 15ms

 Test Files  1 failed (1)
      Tests  3 failed | 65 passed (68)
```

Three separate consequences, all of which the packet is silent on:

1. **C1, C2, C3 and C7 are unachievable as written.** Every one of them requires the strip's
   *populated* output (dot row / participation label). Against the default seam the strip renders
   `Couldn't load meeting consistency` and a `Retry` — zero dots, zero progressbars. A worker who
   cannot make the strip populate will either fake the criteria or write them against the error
   state, which is precisely failure shape (a).

2. **"Existing tests must pass unless the boss explicitly approves a test update"** (Non-Negotiables)
   is violated by the packet's own prescription. Two of the three breakages are the direct,
   unavoidable cost of Part B; the packet asserts the opposite (see MAJOR 5). Revision 2 must
   authorize the specific test edits by name.

3. **This is the third repeat of a failure shape the project has already paid for twice**, both
   recorded in the codebase itself. `DashboardPage.test.tsx:33-52`: *"both resolvers hit their real,
   unconfigured-in-jsdom defaults unless mocked at the module level — measured (T176 gate round 1,
   MAJOR 6)"*. `OutreachList.test.tsx:158-165`: *"the real `resolveCurrentStudentId` default would
   fire a genuine, unmocked Supabase query in every student/parent-view test below, landing the
   identity tier in its own `'error'` DES-12 state instead of ever reaching this file's existing
   fixture-driven assertions."* T180 reintroduces it and the packet does not mention it.

**The fix, measured.** A module-level mock in `MeetingsList.test.tsx` is sufficient and needs no
source change — this is the shape T176/T181 already settled on:

```tsx
const stripSeam = vi.hoisted(() => ({
  load: null as null | ((studentId: string) => Promise<ConsistencyStripData>),
}));
vi.mock('../../lib/supabase/loaders/checkin', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase/loaders/checkin')>();
  return { ...actual, loadConsistencyStripData: (studentId: string) => stripSeam.load!(studentId) };
});
// beforeEach: stripSeam.load = (id) => defaultLoadConsistencyStripData(id);
```

With that plus the three test repairs described in MAJOR 5, the file goes `74 passed (74)` and the
full suite `70 passed (70) / 1695 passed (1695)`.

Revision 2 must **decide and state** which of these it wants — the module-level `vi.mock`, or a new
`loadStripData?` prop threaded through `MeetingsListProps` — and put it in the build plan as a
numbered step. Note one live hazard if a worker reaches for the mock naively: a factory that
`await import('./StudentMeetingView')`s at factory level dies on the circular graph
(`TypeError: loadData is not a function`, and separately
`ReferenceError: Cannot access '__vi_import_6__' before initialization`). The lazy-holder shape
above avoids both.

---

## BLOCKER 2 — C3, the criterion that proves Part B, fails under both readings of its own wording

C3: *"Count the elements whose accessible name **or label text** contains "Participation" — expect
exactly **1**, and assert it is the strip's (its label reads `Participation: N%`, the host's read
`Your participation: N%`). **Mutation:** restore the host's `Participation` `VStack` → expect 2,
red."*

That sentence has two readings and **both are broken**, in opposite directions.

### 2a — accessible-name reading: the prescribed mutation stays GREEN

Astryx's `ProgressBar` does **not** expose `label` as `aria-label`. Measured DOM:

```html
<div role="progressbar" aria-valuenow="85.7" aria-valuemin="0" aria-valuemax="100"
     aria-labelledby="_r_9_" aria-valuetext="86%" class="astryx-progressbar-track …">
```

so the accessible name has to be resolved through `aria-labelledby`. Written that way
(`expect(names).toEqual(['Participation: 85.7%'])`) the criterion passes on the reference tree —
and **also passes with the host's `Participation` `VStack` restored**:

```
$ # M3: host Participation VStack + ProgressBar import restored, mount kept
 Test Files  1 passed (1)
      Tests  74 passed (74)
```

The reason is a fixture collision the packet never discloses: **the two loaders' fixture id-spaces
are disjoint.** `MeetingsList.tsx:872-883`'s `FIXTURE_PARTICIPATION_METRICS` holds exactly one row,
keyed `PLACEHOLDER_CURRENT_STUDENT_ID` (`'student-placeholder-current-viewer'`, 57.1%).
`StudentMeetingView.tsx:497-518`'s holds `student-jordan-fixture` (85.7%) and
`student-morgan-fixture` (66.7%). **No student id populates both.** Any fixture that makes the
*strip* render its bar leaves the *host's* `participation === null`, so the host renders its em-dash
`Text` and never emits a second `[role="progressbar"]` for C3 to count.

### 2b — label-text reading: "expect exactly 1" is RED against a correct implementation (shape (d))

Counting leaf elements whose text matches `/participation/i`, on the **correct** reference tree:

```
GATE-PROBE C3-alt leaves: ["Participation","Participation: 85.7%"]
GATE-PROBE progressbar count: 1
```

Two, not one — the strip emits both a `Text type="label">Participation</Text>` and the
`aria-labelledby` target `Participation: 85.7%`. A worker who takes the "label text" half of C3
literally writes `toBe(1)` and it fails against correct code. Under the mutation it becomes:

```
GATE-PROBE C3-alt leaves: ["Participation","Participation","Participation: 85.7%"]
   × C3-alt(label-text): leaf elements whose textContent starts with "Participation"
     → expected 3 to be 2
```

so this reading *does* discriminate — but only with the expected value **2**, not the packet's 1.

### 2c — what does hold up

The error-state check the task asked for: if the strip's loader rejects, C3 written as a
count/equality **is** red, so it is not shape (a):

```
GATE-PROBE error-state progressbar names: []
GATE-PROBE error-state dots: 0
GATE-PROBE error-state text: MeetingsUpcomingWeekly Build Meeting…
GATE-PROBE error-state: does absence-only "Your participation" assertion pass? true
```

Note the last line. The packet is **right** to forbid the absence-only form — measured, it passes
against a strip that failed to load. Keep that warning.

**Revision 2 must pick one mechanism and pin the number.** The cheapest honest discriminator
measured here is the raw progressbar count paired with the host-fixture id, e.g. render with
`studentId = PLACEHOLDER_CURRENT_STUDENT_ID` (host participation populated) *and* a stubbed strip
seam returning a populated participation, then assert
`expect(progressBarNames()).toEqual(['Participation: 85.7%'])`. That configuration is the one that
makes the mutation visible — measured under M3:

```
GATE-PROBE cross progressbar names: ["Your participation: 57.1%","Participation: 85.7%"]
GATE-PROBE cross text: MeetingsParticipationYour participation: 57.1%57%UpcomingWeekly Build Meeting…
```

That output is also the only real proof of Trap 2's premise anywhere in this gate — see MINOR 10.

---

## MAJOR 3 — C4's mutation does not move C4's observable (shape (c)), and "at most once" cannot discriminate even when fixed

C4: *"assert `resolveStudentId` is called **at most once** for the page render. **Mutation:** drop
`studentId` from the mount so the wrapper resolves for itself → the call count rises, red."*

The count does not rise. The mount does **not** forward `MeetingsList`'s `resolveStudentId` prop;
`StudentMeetingView` falls back to its own default, the module-level `resolveCurrentStudentId`
(`StudentMeetingView.tsx:1055`). A spy on the host's prop — the only `resolveStudentId` seam a test
of `MeetingsList` has — never sees the second resolution. Measured, same spy, both trees:

```
correct impl:      GATE-PROBE C4 host-prop resolve calls: 1   dots: 5
mutation (no id):  GATE-PROBE C4 host-prop resolve calls: 1   dots: 0
```

`toBeLessThanOrEqual(1)` is green in both. In the reference tree C4 only goes red under the mutation
because I added a paired positive (`stripDots().length === 5`) that the packet does not ask for —
and even then it is the strip's **error state** doing the work, not a call count:

```
GATE-PROBE C4 strip page text tail: …Couldn't find your student recordSomething went wrong looking
up which student this is for you. Try refreshing the page.Retry
```

**A discriminating C4 exists.** Spy at the module level and assert **zero**, not "at most one":

```tsx
vi.mock('../../lib/supabase/loaders/meetings', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/supabase/loaders/meetings')>();
  return { ...actual, resolveCurrentStudentId: spies.resolve };
});
```

```
correct impl:  GATE-PROBE C4b module-level resolveCurrentStudentId calls: 0   dots: 5   → passes toBe(0)
mutation:      GATE-PROBE C4b module-level resolveCurrentStudentId calls: 1   dots: 5
               × counts module-level resolution calls  → expected 1 to be +0
```

Note the wording is load-bearing: **"at most once" is satisfied by 1 even with the correct spy.**
Revision 2 must say `toBe(0)` against a module-level spy, and name the spy seam explicitly.

---

## MAJOR 4 — C5's prescribed mutation leaves C5 green, and the mutation ships a visible coach-page defect

C5: *"Signed in as coach: no strip, and the coach view's own content is present (paired positive).
**Mutation:** move the mount outside the student/parent branch → red."*

Applied literally (mount hoisted into the outer `VStack gap={6} padding={6}`), `tsc` exit 0, and:

```
GATE-PROBE C5 dots: 0
GATE-PROBE C5 coach content present: true
GATE-PROBE C5 strip error banner present: false
GATE-PROBE C5 text head: No student account linked yetWe couldn't find a student record linked to
your account yet. Once one is linked, your meeting consistency will show up here.MeetingsSchedule
meetingsUpcomingDateMeetingSession details (3)…
```

Both halves of C5 hold: **0 dots** ("no strip") and coach content present. C5 stays green while the
coach's `/meetings` page renders *"No student account linked yet"* as its first line, above the
schedule. This is failure shape (a) exactly — the absence assertion passes because the component
rendered an empty state, so the thing asserted "gone" was never going to render.

The mechanism: coach viewers reach `StudentMeetingView` with `studentId === undefined`, so
`ResolvedOwnStudentConsistencyStrip` calls the real `resolveCurrentStudentId`, whose coach/admin
branch returns `null` without a query (`loaders/meetings.ts:655-657`, *"Defensive only …"*) →
`EmptyState`.

**Fix, measured to discriminate:** C5's absence half must assert on the strip's own *vocabulary*,
which all three of its non-populated branches share, not on its populated output. The string
`meeting consistency` appears in the loading announcement (`:778-779`), the error banner (`:802`)
and the empty state (`:951`), and appears nowhere in the coach view at base. Pair it with the
existing dot count.

---

## MAJOR 5 — Trap 2's "two facts that make this cheaper than it looks" — the load-bearing one is wrong

> *"**No test asserts on the host's bar.** `grep -rn "Your participation" src/` returns exactly one
> hit — the source line itself. Zero test references."*

The grep is accurate:

```
$ grep -rn "Your participation" src/
src/pages/meetings/MeetingsList.tsx:2362:                label={`Your participation: ${participation.participationPct}%`}
```

**The conclusion drawn from it is not.** No test names the *label*; three tests assert on the bar's
*rendered output*. Two of them break on Part B alone and one on Trap 3:

- `MeetingsList.test.tsx:1111-1122` — `resolveStudentId resolving a real id renders
  StudentMeetingsView scoped to that id`. Its **only** assertion is
  `expect(container.textContent).toContain('57.1%')`, with the comment *"proves the resolved id was
  genuinely threaded through to `loadData`"*. Part B deletes the sole observable of the T096
  resolution proof. It needs a replacement (I used a `vi.fn` on `loadStudentData` +
  `toHaveBeenCalledWith(PLACEHOLDER_CURRENT_STUDENT_ID)`), not a deletion.
- `:1124-1150` — `populated state: …` asserts `toContain('57.1%')` **and**
  `toContain('A visual "last 5 meetings" view isn\'t built yet')`. Broken twice over.
- `:1152-1160` — `participation renders '—' …` asserts `toContain('—')` and
  `not.toMatch(/\d+%/)`. This one is worse than broken: once the strip is mounted **it passes again
  for a different reason** — the strip's own em-dash empty state, from a different loader. Shape (b),
  silently. The test title still says "when the student has no metric row" while the metric row it
  refers to is no longer rendered at all. Either retarget it explicitly or delete it.

> *"Deleting only the rendered section is the whole change."*

Also false. Measured, deleting only the JSX:

```
src/pages/meetings/MeetingsList.tsx(484,3): error TS6133: 'ProgressBar' is declared but its value is never read.
```

`ProgressBar` is imported at `:484` and, after Part B, used nowhere in the file
(`grep -n "ProgressBar" MeetingsList.tsx` → `:324` doc, `:454` doc, `:484` import, `:2361` the
deleted usage). `tsconfig.json` sets `"noUnusedLocals": true`. The import must go too — and with it,
the module doc entry at `:324-326` (see MAJOR 6).

Trap 2's second fact — *"`participation` does not become unused; it still feeds `isEmpty` at
`MeetingsList.tsx:2340`"* — **is correct**, confirmed by `tsc` exit 0 with the destructure retained.

---

## MAJOR 6 — the module-doc correction list is incomplete in both files, and one of its two quotes is a paraphrase

The packet names exactly two passages in `StudentMeetingView.tsx` and "module doc #7d" in
`MeetingsList.tsx`. Both files carry more now-false text, and the packet's own instruction is
*"Quote what you replace, so the checker can verify you corrected the real text rather than
paraphrasing it."*

**In `StudentMeetingView.tsx`, four further live references to the deleted placeholder:**

- `:32` — *"that a future wiring task can drop into `MeetingsList.tsx`'s named placeholder slot"*
- `:41-42` — *"the placeholder `Section` it points at is unambiguous about what it is deferring"*
- `:180` — *"`MeetingsList.tsx`'s own placeholder slot for that same student"*
- `:685` — *"This is the piece a future wiring task drops into `MeetingsList.tsx`'s placeholder
  `Section`"* (code comment above `ConsistencyStrip`)
- `:1022-1023` — *"the shape a future wiring task drops into `MeetingsList.tsx`'s placeholder slot"*
  (JSDoc on `StudentMeetingViewProps.variant`)

All are comments, so C6 still holds — but the packet's *"The module doc text that is now false and
must be corrected"* list presents itself as complete and is not.

**In `MeetingsList.tsx`, three further now-false passages the packet does not name:**

- `:22-27` — *"plus a participation % sourced from a `v_student_participation`-shaped fixture row"*,
  describing the student view. After Part B it renders no participation figure of its own.
- `:324-326` — the documented Astryx-components-used list still carries
  *"`ProgressBar`: "ProgressBar" Props table. `label` (required), `value`, `isLabelHidden`,
  `hasValueLabel` used"*. The import is deleted. Constitution item 2 makes this list the file's
  audit trail; leaving a component in it that the file no longer imports is exactly the kind of
  drift item 2 exists to prevent.
- `:453-454` — *"the single participation `ProgressBar` in the student view is one bar, not a
  stack"*, in the UXD-05 review. There is no bar in the student view after Part B.

`:264-266` (*"empty (zero history rows AND no participation row)"*) **stays true** — `participation`
still feeds `isEmpty`. Do not have the worker "fix" that one.

**The `:38` quote is not verbatim.** The packet writes:

> *"`:38` — "Upcoming/Past history rows or its own participation `ProgressBar` -- this [task]
> doesn't build those.""*

The real text at `:37-39` is:

```
 * This is NOT a second, competing rebuild of `MeetingsList.tsx`'s own
 * Upcoming/Past history rows or its own participation `ProgressBar` -- this
 * file does not render a session history list at all.
```

The bracketed `[task]` and *"doesn't build those"* are the packet's own words. A packet that orders
verbatim quoting must quote verbatim (item 19c).

---

## MINORs

- **7 — C7's stated mutation mechanism is false; the criterion still discriminates.** *"switch the
  mount to `variant="linked"` → **more than one strip**, red."* With `loadLinkedStudents` at its
  real default (unconfigured), `variant="linked"` renders an error banner, not a fan-out:
  ```
  GATE-PROBE C4 strip page text tail: …Couldn't load linked studentsSomething went wrong loading
  your linked students. Try refreshing the page.Retry
  ```
  C7 goes red (0 dots ≠ 5), so the mutation works — for the opposite reason to the one stated. The
  fan-out is real and worth keeping as the *product* argument; it is only observable with the linked
  loader stubbed, measured:
  ```
  GATE-PROBE linked dots: 9
  GATE-PROBE linked h3 headings: ["Jordan R.","Morgan R.","Alex R."]
  GATE-PROBE linked all headings: ["H1:Meetings","H2:Upcoming","H2:Past","H3:Jordan R.","H3:Morgan R.","H3:Alex R."]
  GATE-PROBE linked progressbars: ["Participation: 85.7%","Participation: 66.7%"]
  ```
  Say "red because the linked loader is a different, unstubbed seam" *or* stub it and say "9 dots,
  3 headings". Not "more than one strip" as if it fell out of the default harness.

- **8 — the heading/labelling delta is real and undisclosed (item 15).** Measured, base vs reference
  tree, same student view, same fixture:
  ```
  GATE-PROBE BASE headings:  ["H1:Meetings","H2:Participation","H2:Upcoming","H2:Past","H2:Recent attendance"]
  after T180:                ["H1:Meetings","H2:Upcoming","H2:Past"]
  ```
  Two `<h2>`s disappear. The participation figure survives, but demoted from a `Heading level={2}`
  to a `Text type="label">Participation</Text>`, and the strip's `variant="own"` branch emits **no**
  heading at all (`studentLabel` is only passed by `variant="linked"`,
  `StudentMeetingView.tsx:705`). Answering the packet-review question directly: **the nesting is
  valid and heading order is not violated** — `<Section padding={4}>` renders
  `<div class="astryx-section section">`, a plain div, not a `<section>` landmark
  (`container.querySelectorAll('section').length === 0`), so nothing lands inside a landmark
  incorrectly and there is no h1→h3 skip. But a screen-reader user loses two navigable headings from
  a page whose own module doc has a "T129/UXC-01: one heading per section" section, and the packet
  describes Part B only as *"Deleting only the rendered section"*. Disclose it; decide whether the
  strip should take a `studentLabel`/heading on this surface.

- **9 — citation drift, six instances.** `MeetingsList.tsx:2355-2367` — the `VStack` to delete is
  **`:2354-2368`** (`2355` is the `Heading`). `:2382-2390` — the placeholder `VStack` is
  **`:2384-2390`**; `2381-2383` is the comment. `:2440-2482` for *"`ResolvedStudentMeetingsView`'s
  own `resolveStudentId` load state"* — that component is **`:2411-2455`**; `2456-2484` is a
  different component (`StudentMeetingsViewContainer`). `StudentMeetingView.tsx:10-30` for the
  placeholder paragraph — it is **`:16-19`**. *"`loaders/parentHome.ts` … imports from
  `StudentMeetingView.tsx`"* — **it does not**; its imports are `./checkin`, `./students`,
  `../loader`, `../client` and `../../../pages/home/ParentHome` (`:180-199`), and
  `StudentMeetingView` appears there only in comments (`:13`, `:24`). The forbidden-file rule is
  still right, the stated reason is not. *"this file's existing **45** blocks"* —
  `StudentMeetingView.test.tsx` has **42** `it(` blocks.
  Exact and confirmed: `StudentMeetingView.tsx:735-749`, `MeetingsList.tsx:2340`,
  `loaders/meetings.ts:613`, `ParentHome.tsx:376`, "2560 lines".

- **10 — Trap 2's headline claim is an inference labelled as a measurement.** *"Measured on `main`
  at `95e6702`: … Two queries, two numbers, **free to disagree on screen**."* The two-loaders half
  is true and verified. The disagreement half is **not measurable from the shipped fixtures** —
  their id-spaces are disjoint (BLOCKER 2a), so on the fixture path the host shows `57.1%` and the
  strip shows an em-dash, or the strip shows `85.7%` and the host shows an em-dash. Never two
  numbers. I had to cross the id-spaces by hand to produce the screen the trap describes:
  ```
  GATE-PROBE cross progressbar names: ["Your participation: 57.1%","Participation: 85.7%"]
  GATE-PROBE cross text: MeetingsParticipationYour participation: 57.1%57%Upcoming…
  ```
  **The product decision is correct** — that screen is the T188 shape and should not ship. Just say
  "architecturally free to disagree; not reproducible from the current fixtures, demonstrated by
  crossing them" rather than "measured".

- **11 — the mount's position on the page is unspecified, and the two instructions disagree.** Build
  plan step 1 says replace the placeholder `VStack` (bottom of the student view, after Past). Trap 2
  says *"BEH-06 places the participation figure next to the dot row by design"* and that the strip
  *supersedes* the host's `Participation` section — which sits at the **top**, above Upcoming. So
  Part B moves the participation figure from above the history to below it, silently. I built it at
  the placeholder's position (bottom) per the build plan. State the intended order.

- **12 — undisclosed naming hazard in the one file being edited.** The host's own internal component
  is `StudentMeetingsView`; the thing being imported is `StudentMeetingView`. One letter, same file,
  same JSX block. `tsc`'s own diagnostic while I was building this:
  ```
  src/pages/meetings/MeetingsList.tsx(2354,12): error TS2552: Cannot find name 'StudentMeetingView'. Did you mean 'StudentMeetingsView'?
  ```
  One sentence in Trap 6 prevents a confusing round-trip.

---

## What held up — do not re-litigate

- **The baseline is exactly as stated.** At `95e6702`, `.env.local` absent:
  ```
   Test Files  70 passed (70)
        Tests  1689 passed (1689)
  ✖ 359 problems (0 errors, 359 warnings)
  ```
  `tsc --noEmit` exit 0, `vite build` ✓, `format:check` clean. No drift.

- **Both `ProgressBar`s are exactly what Trap 2 says they are, and they come from different
  loaders.** `StudentMeetingView.tsx:735-749` is verbatim as quoted. `MeetingsList.tsx`'s is the
  `VStack` at `:2354-2368` with the `Heading level={2}>Participation` and the
  `Your participation: N%` bar, quoted correctly apart from the range. The host's data comes from
  `loadStudentMeetingsData` (`MeetingsList.tsx:2515`, real query at `loaders/meetings.ts:613`); the
  strip's from `loadConsistencyStripData` (`StudentMeetingView.tsx:1053`, `loaders/checkin.ts:455`).
  Two independent `createLoader` chains, three queries vs one. Same metric, two round trips.

- **`participation` really does stay in use, and only the rendered section needs deleting from the
  data path.** `isEmpty` at `:2340` still consumes it; `tsc` exit 0 with the loader, the type and
  `buildStudentMeetingsData` untouched, exactly as Trap 2 says. (The `ProgressBar` *import* is the
  one thing that also has to go — MAJOR 5.)

- **Trap 1 is right on all three of its claims, tested rather than read.**
  (a) An explicit `studentId` genuinely bypasses `resolveStudentId`: module-level spy,
  `GATE-PROBE C4b module-level resolveCurrentStudentId calls: 0` with the strip fully populated
  (`dots: 5`). (b) The parent path really does resolve to exactly one student —
  `resolveCurrentStudentId`'s `parent` branch returns `rows[0].student_id`, a single id
  (`loaders/meetings.ts:652-654`), and `StudentMeetingsViewContainer` takes `studentId: string`
  singular. (c) `variant="linked"` really is wrong here — 9 dots, 3 `<h3>`s, 2 participation bars
  inside a page already scoped to one student (MINOR 7's dump). The only nuance worth adding is that
  the single student a parent gets is the *earliest-linked* one, a limitation
  `loaders/meetings.ts:60-66` already discloses; that is pre-existing, not this task's problem.

- **Trap 5 is right and C6 is achievable.** No non-comment change to `StudentMeetingView.tsx` is
  needed to mount it: the component is already exported, and the back-import at
  `StudentMeetingView.tsx:308` is `import type`, so the cycle is erased at build time.
  `tsc --noEmit` exit 0 and `vite build ✓ built in 5.08s` on the finished tree. My whole diff:
  ```
   src/pages/meetings/StudentMeetingView.tsx | 15 +++++++++------
   1 file changed, 9 insertions(+), 6 deletions(-)
  ```
  every changed line inside the leading `/** … */` block. Two mechanical notes for C6's wording:
  the check must look only at `+`/`-` lines (context lines are code), and `main` must be a resolvable
  local ref in the worker's tree.

- **Trap 4 is right.** `StudentConsistencyStripCard` ships its own `Skeleton` loading
  (`:773-796`), `Banner` error with a real `Retry` (`:798-807`) and the strip's own empty branch
  (`:713-716`). Wrapping it in a second state machine would double every one of those; I did not,
  and nothing in the host needed one.

- **Trap 6's `innerHTML` hazard is real on this exact page.** The class name T181's gate cited turned
  up unprompted in my own DOM dump of the student view:
  `<span class="xv1l7n4 x141an7d x1ltkj2j">`. Keep the `textContent`-not-`innerHTML` instruction.

- **C1 and C2 discriminate as written.** Removing the mount:
  ```
     × C1: the consistency strip renders for a student, inside the real student view  → expected +0 to be 5
     × C2: the placeholder copy is gone AND the real strip is there                   → expected +0 to be 5
  ```
  Restoring the placeholder alongside the mount reddens exactly C2's absence half and nothing else
  (`2 failed | 72 passed`), and the paired positive C2 mandates is what keeps it honest. C2's
  instruction to state plainly that the absence half alone is not evidence is correct and is
  independently confirmed by BLOCKER 2c.

- **The `sonnet` tier is defensible**, conditional on the packet being fixed. None of item 18's four
  triggers fire: no migration, no RLS, no metric SQL, no change to auth/session/role-resolution
  logic — the task *consumes* `resolveCurrentStudentId`, it does not modify it. Item 25's second
  obligation applies and says not to bump on how the topic sounds. What this gate found is a
  packet problem, not a tier problem — but note that a sonnet worker handed the packet as written
  runs into three red pre-existing tests with no instruction covering them, which is the situation
  most likely to produce an unauthorized test deletion. Fix BLOCKER 1 and the tier stands.

---

## Not measured

Real Supabase behaviour of `loadConsistencyStripData` (no live DB; unconfigured in jsdom, which is
the point of BLOCKER 1). Whether task T191 is genuinely in flight in a parallel session — I verified
the import graph, not the other session. Browser/visual rendering: everything here is jsdom, so
"two adjacent participation regions" is confirmed as DOM structure and accessible names, not as a
screenshot. Manual keyboard/screen-reader walkthrough beyond the heading and accessible-name dumps
in MINOR 8 and BLOCKER 2a.

---

## Round-2 checklist

1. Add a build-plan step for the strip's test seam, and decide between the module-level
   `vi.mock('../../lib/supabase/loaders/checkin')` and a new `loadStripData?` prop on
   `MeetingsListProps`. Warn about the circular-init trap in the mock factory. **BLOCKER 1.**
2. Authorize, by name, the three existing-test repairs Part A+B force —
   `MeetingsList.test.tsx:1111`, `:1124`, `:1152` — and say what replaces `57.1%` as the T096
   resolution proof at `:1111`. Decide explicitly what happens to `:1152`, which otherwise starts
   passing off the strip's em-dash. **BLOCKER 1 / MAJOR 5.**
3. Rewrite C3 with one mechanism and the right number: `[role="progressbar"]` accessible names
   resolved through `aria-labelledby` (not `aria-label`), asserted with a fixture where the **host's**
   participation is non-null so the mutation is visible. Disclose the disjoint fixture id-spaces.
   **BLOCKER 2.**
4. Rewrite C4 as `toBe(0)` against a module-level spy on `resolveCurrentStudentId`; drop "at most
   once", which cannot discriminate. Name the spy seam. **MAJOR 3.**
5. Rewrite C5's absence half to assert on the strip's shared vocabulary (`meeting consistency`),
   which its loading/error/empty branches all carry, so hoisting the mount out of the branch is
   caught. **MAJOR 4.**
6. Delete "Deleting only the rendered section is the whole change"; add the `ProgressBar` import
   removal (`MeetingsList.tsx:484`, TS6133) to the build plan. Restate the "no test asserts on the
   host's bar" fact as what it is: no test names the *label*; three assert on its *output*.
   **MAJOR 5.**
7. Extend the module-doc list: `MeetingsList.tsx:22-27`, `:324-326` (the `ProgressBar` entry in the
   Astryx-components-used list), `:453-454`; `StudentMeetingView.tsx:32`, `:41-42`, `:180`, `:685`,
   `:1022-1023`. Replace the `:38` paraphrase with the verbatim text. Say `:264-266` stays. **MAJOR 6.**
8. Fix C7's stated mutation mechanism — the real default `loadLinkedStudents` produces an error
   banner, not a fan-out. **MINOR 7.**
9. Disclose the heading delta (two `<h2>`s removed) and decide whether the strip carries a heading
   on this surface. **MINOR 8.**
10. Correct the six citations in MINOR 9, including the `loaders/parentHome.ts` import claim and the
    "45 blocks" count.
11. Restate Trap 2's disagreement claim as an inference plus the crossed-fixture demonstration, not
    as "measured on main". **MINOR 10.**
12. State where the mount goes relative to Upcoming/Past, and add the
    `StudentMeetingsView`/`StudentMeetingView` naming hazard to Trap 6. **MINOR 11/12.**
