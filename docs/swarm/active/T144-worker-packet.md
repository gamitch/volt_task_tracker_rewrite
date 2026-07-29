# Worker Packet: T144 — the ten default-accent progress bars (UXC-05, part 3 of 3)

Wave 5, packet **W5-P6c**. Mechanically small — one prop at ten call sites — but
it carries one real ethics ruling and one honest disclosure.

**Packet SHA: pin this.** Before writing your output doc, run
`git log -1 --format=%H -- docs/swarm/active/T144-worker-packet.md` and confirm
it matches the SHA in your dispatch prompt.

## FIRST — merge the working branch

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```

Report the result. **If it conflicts, stop and report.**

## Why this exists

UXC-05 requires **zero default-accent bars**. Every `<ProgressBar>` in `src/`
omits `variant` and therefore renders `accent`. There are **ten**, not the two an
earlier packet claimed:

| File:line | What it measures |
|---|---|
| `src/pages/meetings/MeetingsList.tsx:2344` | your participation % |
| `src/pages/meetings/StudentMeetingView.tsx:742` | participation % |
| `src/pages/home/ParentHome.tsx:1181` | your child's hours vs. goal |
| `src/pages/home/CoachHome.tsx:1857` | a team's hours |
| `src/pages/home/CoachHome.tsx:1886` | an event's hours |
| `src/pages/home/CoachHome.tsx:1913` | a named student's hours vs. goal |
| `src/pages/home/CoachHome.tsx:2183` | hours vs. team goal |
| `src/pages/home/StudentHome.tsx:1278` | your outreach hours vs. your goal |
| `src/pages/reports/HoursTab.tsx:938` | confirmed hours vs. goal |
| `src/pages/reports/ParticipationTab.tsx:818` | a named student's participation % |

Confirm the count yourself before starting — `grep -rn "<ProgressBar" src/`
excluding tests returned 10 at this packet's SHA. If it does not, stop and report.

## The ruling — read this before choosing anything

`ProgressBar` has **no hue variants**. Verified from the installed types
(`node_modules/@astryxdesign/core/dist/ProgressBar/ProgressBar.d.ts`,
`ProgressBarVariantMap`), the complete set is:

```
accent | success | warning | neutral | error
```

Those are **status** colours. Every bar in the table above is a **measurement**.
That distinction decides this task.

### 1. Use `neutral`, at all ten sites

A measurement is not a status. `neutral` states the value without editorialising
about it, and it removes the brand accent, which is what UXC-05 asks for.

### 2. Do NOT make the colour depend on the value — this is a hard prohibition

Do not write anything of the form "green above goal, amber below, red if far
behind". It is the obvious idea and it is forbidden here.

**Constitution item 17 (motivation ethics).** This app's users are **minors**,
and six of these ten bars show a *named individual's* hours or participation —
several of them visible to a coach or a parent, not only to the student. A bar
that turns amber or red because a fourteen-year-old is behind on volunteer hours
is precisely the guilt mechanic item 17 prohibits. The PRD's BEH-02 makes the
same point from the other direction: "progress is never artificially inflated,
no fake head starts" — honesty in both directions, encouragement in neither.

If you believe a value-dependent variant is right somewhere, **stop and report**.
Do not ship it.

### 3. Disclose what this does not achieve

Say this plainly in your output rather than letting the ledger imply otherwise:

> Setting `variant="neutral"` satisfies UXC-05's "zero default-accent bars"
> literally, but it does **not** bring these bars into the confirmed=green /
> planned=purple semantic system T136 established. It cannot: `ProgressBar`
> exposes no data-viz hues, which is the same F-3 limitation that required
> `GoalBar` to exist in the first place.

Whether some of these should become `GoalBar` instead is a **product decision for
the human owner**, not yours and not mine. Note it; do not act on it. `GoalBar`
is pre-approved under F-3 for the two-fill case only, and widening that is out of
scope.

## Traps

1. **`CoachHome.tsx` has four of the ten**, at `:1857`, `:1886`, `:1913` and
   `:2183`. Miss one and criterion 1 fails. Re-grep after editing.
2. **T138 has just landed changes in `CoachHome.tsx`** (the event-type badge map).
   Merge first, as instructed above, and expect the line numbers in the table to
   have shifted. **Locate the bars by their `label` text, not by line number.**
3. Do not change any `label`, `value`, `max`, `hasValueLabel` or
   `isLabelHidden` prop. The only edit is adding `variant`.
4. **Check the rendered contrast.** `neutral` against the track must still be
   visible in both themes. If it is not, report it — do not silently pick a
   different variant to work around it.

## Allowed Files

- The eight files in the table above
- Their tests
- `docs/swarm/active/T144-worker-output.md` (create)

## Forbidden Files

- `src/components/GoalBar.tsx` — not a substitute here; see the ruling.
- `src/theme/volt.ts`, `src/theme/theme.css` — T136 settled these.
- `src/pages/outreach/AttendancePanel.tsx`, `src/lib/supabase/loaders/outreach.ts`,
  `src/pages/outreach/OutreachDetail.tsx` — **T143's territory.**
- `supabase/migrations/**`
- `docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`,
  `dispute-log.md`, `.claude/**`

## Acceptance Criteria

1. **Zero `<ProgressBar>` call sites in `src/` render the default accent.** Prove
   it: every one of the ten passes an explicit `variant`. State the grep you used
   and its output.
2. Every variant is `neutral`, **or** you stopped and reported instead.
3. **No colour anywhere depends on the bar's value.** State that you checked, and
   that you introduced no conditional variant.
4. No other `ProgressBar` prop changed at any site.
5. The disclosure in "3. Disclose what this does not achieve" appears in your
   output doc, in substance.
6. `npx tsc --noEmit`, `npx vite build`, `npm run format:check` clean;
   `npx eslint .` zero errors; state the warning count against the baseline
   (**0 errors / 353 warnings**) and explain any difference.
7. `npx vitest run` green. Baseline **1469 across 63 files** — but T138 and T143
   may land first, so **reconcile against your own merge base**, not this number,
   and say what you reconciled against. Any test that changes is a regression:
   report it, don't silence it.

**Do not certify your own work.**

**Commit on your worktree branch before reporting**, and end with
`git status --porcelain` — empty apart from anything gitignored.

## Relevant Constitution Excerpt

- **Item 17 — motivation ethics.** The governing item for this task. No streaks,
  guilt, or urgency; the users are minors. Colour must not become a judgement
  about a named child's effort.
- **Item 2** — Astryx props only from documented sources. The variant set above
  is quoted from the installed types; do not invent one.
- **Item 15** — accessibility is a shipping requirement. Colour is not the only
  carrier of meaning here: every bar keeps its text label and value. Confirm the
  `neutral` fill remains visible in both themes rather than assuming it.
- **Item 1** — PRD IDs outrank packet text. UXC-05 is the authority; this packet
  is the last third of it.
- Non-Negotiables — existing tests pass unless explicitly approved; no worker
  self-certifies.

## Required Worker Output

`docs/swarm/active/T144-worker-output.md`:

- The packet SHA you verified.
- Your grep before and after, showing ten sites and ten explicit variants.
- Confirmation that no variant is value-dependent (criterion 3).
- The disclosure from ruling 3.
- Your contrast check for `neutral` in both themes, with what you measured.
- What you reconciled the test count against, and the before/after numbers.
- Full output of the commands in criteria 6–7.
- Anything unverified, stated plainly as unverified.
