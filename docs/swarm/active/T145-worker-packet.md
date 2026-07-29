# Worker Packet: T145 — close the badge-map loose ends T138 left and exposed

Small. One real code change, three prose corrections, one test tightening.

**Packet SHA: pin this.** Before writing your output doc, run
`git log -1 --format=%H -- docs/swarm/active/T145-worker-packet.md` and confirm
it matches the SHA in your dispatch prompt.

## FIRST — merge the working branch

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```

Report the result. **If it conflicts, stop and report.**

## Why this exists

T138 consolidated three copies of the event-type badge map into
`src/lib/eventTypeBadge.ts`. Its checker then found a **fourth** copy it could not
touch, and two module docs T138 made stale — one of which was already asserting
something false.

Everything here was correctly outside T138's Allowed Files. None of it is that
worker's fault.

---

## Part 1 — the fourth copy (the only code change)

`src/pages/calendar/CalendarPage.tsx:837-839` hand-writes the DES-04 legend:

```jsx
<Badge variant="purple" label="Meeting" />
<Badge variant="blue" label="Outreach" />
<Badge variant="orange" label="Competition" />
```

Same three values as `EVENT_TYPE_BADGE`, written a fourth time, and **invisible to
T138's `grep`** because it is JSX rather than a map literal. UXC-05's "one
semantic colour system" is not closed while it stands.

**Drive the legend from `EVENT_TYPE_BADGE`.**

**Do not iterate with `Object.keys`/`Object.entries`.** JS object key order is
insertion order for string keys and would happen to work today, which is exactly
the kind of accidental correctness this task exists to remove. Add an **explicit
ordered tuple** to `src/lib/eventTypeBadge.ts` — something like:

```ts
export const EVENT_TYPE_ORDER = ['meeting', 'outreach', 'competition'] as const;
```

and render the legend from it. The rendered order must stay Meeting, Outreach,
Competition — that is the current order and DES-04's.

**Rendered output must be identical.** Same three badges, same variants, same
labels, same order. Prove it, don't assert it.

---

## Part 2 — three false or stale statements in prose

### 2a. `CalendarPage.tsx:107`

> `` `CALENDAR_TYPE_BADGE` below maps `meeting -> 'purple'` … ``

That constant no longer exists and is not "below". The mapping it describes is
still true, so this is a dangling reference, not a falsehood. Point it at
`EVENT_TYPE_BADGE` in `src/lib/eventTypeBadge.ts`.

### 2b. `EventsTab.tsx:29-46`

Two problems. It says `EVENT_TYPE_BADGE` was "derived directly from the PRD"
and is "below" — it is now imported and re-exported. And it asserts the two maps
were:

> both independently derived from the same DES-04 table … **not merely "reused"
> by import**

which is now the **opposite** of the truth. It also cites
`CalendarPage.tsx` lines 577-586, which was wrong even before T138.

Keep the history — that this mapping was once derived three times is worth
recording, and it is why `eventTypeBadge.ts` exists. Correct the tense and the
conclusion.

### 2c. `EventsTab.tsx:47-54` — this one is actually false, and has been for a long time

> this deliberately diverges from `src/pages/home/CoachHome.tsx`'s own
> `EVENT_TYPE_BADGE` constant (line ~1191 there: meeting=`blue`,
> outreach=`purple`, competition=`teal`), which does NOT match DES-04

**All of that is wrong.** `CoachHome` has mapped `meeting → purple`,
`outreach → blue`, `competition → orange` since **T080** corrected it; the line
number was wrong; and since T138 it has no local constant at all — it imports the
shared one. **This is a pre-existing defect T138 merely exposed**, not one it
created.

Replace it with the true state: there is no divergence, there is one shared
mapping, and DES-04 is satisfied. Note that the claim was false from T080 onward
so a future reader knows it was not a T138 regression.

---

## Part 3 — tighten one assertion (NIT, do it while you are here)

`src/pages/calendar/CalendarPage.test.tsx:264-271` asserts row badge variants with
**unpaired** `toContain`, so it would not catch a swapped label↔variant mapping
on its own. Mutation testing during T138's check showed the file *does* still fail
on a wrong colour via other assertions, so this is precision, not a hole.

Make the assertions **paired** — each variant asserted together with its label, so
a swap fails directly. If you add legend coverage for Part 1, pair that too.

---

## Allowed Files

- `src/lib/eventTypeBadge.ts` — the ordered tuple
- `src/pages/calendar/CalendarPage.tsx` — the legend (`:837-839`) and module doc
  `:107`
- `src/pages/reports/EventsTab.tsx` — **module doc only** (`:29-54`). Do not
  change its code.
- `src/pages/calendar/CalendarPage.test.tsx`
- `docs/swarm/active/T145-worker-output.md` (create)

## Forbidden Files

- `src/pages/home/CoachHome.tsx` — nothing here needs it, and T144 is in flight
  there.
- `src/pages/meetings/**`, `src/pages/home/**`, `src/pages/reports/HoursTab.tsx`,
  `src/pages/reports/ParticipationTab.tsx` — **T144's territory.**
- `src/pages/outreach/**`, `src/lib/supabase/loaders/outreach.ts` — **T143's.**
- `supabase/migrations/**`
- `docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`,
  `dispute-log.md`, `.claude/**`

## Acceptance Criteria

1. The legend renders from `EVENT_TYPE_BADGE` via an explicit ordered constant —
   **no `Object.keys`/`Object.entries`**, no hand-written variant or label.
2. The rendered legend is unchanged: three badges, Meeting/Outreach/Competition,
   `purple`/`blue`/`orange`, in that order. **State how you proved it** — a render
   assertion, not an eyeball.
3. `grep -rn "variant=\"purple\"\|variant=\"blue\"\|variant=\"orange\"" src/`
   returns **no hand-written event-type badge**. Report what it returns; other
   unrelated hardcoded variants may legitimately exist, so name any survivors and
   say why they are not event-type badges.
4. All three prose corrections (2a, 2b, 2c) are made, and 2c records that the
   false claim predates T138.
5. `CalendarPage.test.tsx`'s variant assertions are paired. Prove they
   discriminate: mutate one mapping so a label and variant are mismatched, confirm
   the test fails, revert, and verify byte-identity.
6. `npx tsc --noEmit`, `npx vite build`, `npm run format:check` clean;
   `npx eslint .` zero errors; state the warning count and explain any change.
7. `npx vitest run` green. **Reconcile against your own merge base**, not a number
   in this packet — T143 and T144 may land first. Say what you reconciled against.

**Do not certify your own work.**

**Commit on your worktree branch before reporting**, and end with
`git status --porcelain` — empty apart from anything gitignored.

## Relevant Constitution Excerpt

- **Item 2** — Astryx props only from documented sources. You are removing
  hand-written variants in favour of the shared constant; invent nothing.
- **Item 15** — accessibility. Each legend badge keeps its text label; colour is
  not the sole carrier of meaning. Confirm at the call site.
- **Item 1** — PRD IDs outrank packet text. DES-04 defines the palette; UXC-05
  requires one system.
- Non-Negotiables — existing tests pass unless explicitly approved; no worker
  self-certifies.

## Required Worker Output

`docs/swarm/active/T145-worker-output.md`:

- The packet SHA you verified.
- The ordered constant, and how the legend consumes it.
- Criterion 2's proof, and criterion 3's grep output with any survivors explained.
- The before/after of each prose correction.
- Criterion 5's mutation evidence and hashes.
- What you reconciled the test count against, and the numbers.
- Full output of the commands in criteria 6–7.
- Anything unverified, stated plainly as unverified.
