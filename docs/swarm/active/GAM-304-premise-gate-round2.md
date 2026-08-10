# Premise gate, round 2 of at most 2 (constitution item 19a) — GAM-304

Agent: `checker-premise` (opus, pinned in `.claude/agents/checker-premise.md`),
dispatched by the orchestrator with an explicit `model: "opus"` override.
Reviewed: `docs/swarm/active/GAM-304-worker-packet.md` **revision 2**, at HEAD
`5562e48` on branch `claude/gam-304-wire-rsvp-controls`.

**This was the last round item 19a allows.** Round 1 (REVISE) is preserved at
`GAM-304-premise-gate-round1.md`.

---

# Dispatch Verdict

**REVISE** — 1 BLOCKER, 0 MAJOR, 4 MINOR, 1 NIT.

**All nine of round 1's required revisions verified fixed.** The BLOCKER is
confined to §1d, which is text revision 2 *newly introduced* — and introduced in
response to round 1's own "cheaper paths" suggestion. Everything else in
revision 2 verified sound: the corrected citations, the RLS/uniqueness/D013
fold-ins, the whole `ParentHome` half of §2, and criteria 1-6.

---

## BLOCKER — §1d's `clickAction` adoption makes the optimistic update and the concurrency guard inert

The packet prescribes swapping `SignupOpportunityRowItem`'s two `Button`s from
`onClick` to Astryx's `clickAction`, and threading the component-wide
`isRsvpSubmitting` flag into sibling rows as `isDisabled`. Both fail, for one
shared mechanism.

`Button.tsx:601-610` (installed `@astryxdesign/core@0.1.6`) runs `clickAction`
inside `startTransition(async () => …)`. Under React 19 async-transition
(Action) semantics, **every `setState` made inside that action is deferred until
the action settles** — including the packet's optimistic `setRsvps(...)` and its
`setIsRsvpSubmitting(true)`. `props.onClick?.(e)` at `Button.tsx:600` is called
*outside* the transition, which is why the remedy below works.

Measured, in the gate's own worktree (item 23), with a probe rig driving the
packet's exact §1c + §1d combination:

```
RESULT mode=onClick     guard=state siblingDisabledDuringFlight=true  calls=["start:A"]
RESULT mode=clickAction guard=state siblingDisabledDuringFlight=false calls=["start:A","start:B"]
RESULT mode=clickAction guard=ref   siblingDisabledDuringFlight=false calls=["start:A","swallowed:B"]

LONGFLIGHT during (10 microtasks + 2 macrotasks):
  sibDisabled=false clickedDisabled=true clickedAriaBusy=true state=busy=false

OPT mode=onClick     DURING-FLIGHT status=going       busy=true
OPT mode=clickAction DURING-FLIGHT status=unanswered  busy=false   <-- optimistic paint lost
OPT mode=clickAction AFTER-REJECT  status=unanswered  err=Something went wrong saving your RSVP.

REMEDY (optimistic+flag in onClick, await in clickAction):
  during:       status=going busy=true sibDisabled=true clickedAriaBusy=true
  after-reject: status=unanswered busy=false err=Something went wrong saving your RSVP.
```

Three consequences, none of which a worker could resolve without disputing the
packet:

1. **The in-flight guard is inert, not merely cosmetic.** `isRsvpSubmitting`
   never reads `true` during the flight, so a click on a *second* row is not
   swallowed — it starts a genuinely concurrent second write
   (`calls=["start:A","start:B"]`). That is precisely the case §1c says the flag
   exists to prevent ("without it a click on a second row could snapshot an
   array already mutated by a first in-flight write"). Only a `useRef` guard
   survives (`swallowed:B`).
2. **The optimistic update silently becomes pessimistic.** The control does not
   move until the write settles. §1c's "optimistic" wording and criterion 3's
   rollback semantics both become false-in-spirit while still compiling.
3. **Sibling `isDisabled` is dead code as specified** — never `true` during the
   flight. The prop itself works; it is the flag feeding it that is invisible.

**Why this is not a `checker-reviewer` catch.** The resulting code compiles, and
the suite goes green with a slightly weaker criterion-7 assertion, while the app
loses both its optimistic paint and its cross-row concurrency guard.

**Also an unflagged conflict with shipped work:** the packet says "Copy T193's
shape … do not invent a second one" (`:154`), but T193 shipped a plain handler
with an ordinary state flag (`OutreachList.tsx:3930-3951`). Adopting
`clickAction` *is* the second shape, and it is the one that loses the optimistic
paint.

---

## Least-confident list verdicts (charter §0, attacked first)

1. **`clickAction` composes with the component-wide guard** — **WRONG**, and
   worse than the author's own falsifying condition. The author feared a spinner
   flash; the measured failure is that the guard is inert. (The stated
   falsifying condition is separately refuted: `Button.tsx:393-397, 559-564`
   delay the spinner reveal, so a fast/early-return action shows no spinner.)
2. **Sibling `isDisabled` is worth two new props** — **WRONG as specified**, for
   a reason not on the author's list: it is dead code, not noise-vs-signal.
3. **The no-prop `SupabaseNotConfiguredError` test is a fair item-27 check, not
   a tautology** — **SOUND.** Falsifiable by its named mutation, and in-repo
   precedent rather than a novel artifact: `vite.config.ts:16-24` records seven
   existing tests asserting the app fails safely with no Supabase configured,
   and pins `VITE_SUPABASE_URL=''` to make them deterministic. The copy to match
   is `client.ts:32-34`. No escalation to `e2e-personas` warranted.
4. **Asymmetric banner placement** — **SOUND** as far as a gate can grade: the
   decision is stated with its reason and the underlying fact is confirmed
   (`StudentHome.tsx:1519`, `:1545` both feed one handler). Not a finding.

---

## MINOR/NIT findings

- **MINOR-2 — three off-by-one citations, one with teeth.** The failing `it(` is
  `StudentHome.test.tsx:1106`, not `:1107`. `loadData: defaultLoadStudentHomeData,`
  is at **`:142`**, not `:143` — and `:143` is `...props,`, so inserting the new
  harness default "immediately after `:143`" would place it **after the spread**
  and silently override every per-test `onRsvpChange` spy, breaking the new
  payload tests. The file's own comment at `:141` says so ("An individual test's
  own `props.loadData` (spread after, below) always wins"). T183's authorizing
  comment is `:132-141`, not `:135-143`. `PARENT_USER.id` is
  `ParentHome.test.tsx:56`, not `:57`.
- **MINOR-3 — `NextUpRowItem` renders no `Button`.** Its control is a
  `MoreMenu` over `DropdownMenuOption[]` (`StudentHome.tsx:1242-1249`), so the
  affordance must cite `DropdownMenuOption.isDisabled` (`astryx-api.md:1884`) or
  `MoreMenu.isDisabled` (`:4822`), not `Button.isDisabled` (`:1820`).
- **MINOR-4 — criterion 7 is unverifiable as written.** It cannot be made to
  pass for the sibling-row case at all; it can pass for the clicked button, but
  that is a strictly weaker claim than §1d argues for, and the packet does not
  say which one the checker measures.
- **MINOR-5 — the no-prop test needs a stated mechanism.** With the harness
  injecting a default, it must be requested as
  `renderAsUser(STUDENT_USER, { onRsvpChange: undefined })` (the signature
  default still fires on `undefined`) or rendered outside `renderAsUser`.
- **NIT-6 — widen the row prop types.** `onCantGo`/`onRespond`
  (`StudentHome.tsx:1236`, `:1261`) are typed `=> void`; the promise reaches
  `clickAction` only because the concise arrow body forwards it at runtime.
  Widen to `=> void | Promise<void>` so the loading state does not depend on a
  type-erased accident.

---

## Cheaper paths the gate measured

1. **Keep `onClick`; drive the affordance from state you already have.**
   `Button.isLoading` (`astryx-api.md:1818`) + `isDisabled` (`:1820`), both fed
   from `isRsvpSubmitting` (plus a `pendingSessionId`), gives spinner,
   `aria-busy` and sibling-disable with zero new semantics and **preserves the
   optimistic paint T193 shipped.** Measured working.
2. **If `clickAction` is kept, split across the two hooks Astryx already gives
   you:** `onClick` (outside the transition, `Button.tsx:600`) does the snapshot
   + optimistic `setRsvps` + `setIsRsvpSubmitting(true)`; `clickAction` does the
   `await` and the rollback. Measured working end-to-end.
3. **A `useRef` guard is the only guard that works under `clickAction`.** Astryx
   already dedupes the *same* button via `actionInFlightRef`
   (`Button.tsx:557, 596`), so the ref need only cover cross-row clicks.

---

## Verified sound, needing no further work

All nine round-1 required revisions (1-9); the four corrected citations
(`ParentHome.tsx:1346-1353`; `OutreachDetail.tsx:2363`;
`OutreachList.tsx:3972-3980`; the `user === null` early return at
`ParentHome.tsx:1366`); the `guardian_links` uniqueness, D013 and executed-RLS
fold-ins; the entire `ParentHome` half of §2 (verified by execution —
`isDisabled` + `disabledMessage` yields `aria-disabled=true`,
`aria-describedby`, blocked `onChange`, rendered message, and `SegmentedControl`
is unaffected by the transition defect); criterion 6's two grep strings
(both present, exit 0); and criteria 1-6 as measurable.

---

## Evidence

**Commands (exit codes):** `git worktree add /tmp/gate2-gam304 HEAD` (0) ·
`npm ci` (0) · four probe suites via `npx vitest run src/pages/home/gate2probe*.test.tsx`
(all 0) · `grep -rn "no Supabase write happens" …` (0, 1 match) ·
`grep -rn "no Supabase write/persistence" …` (0, 1 match) ·
`git worktree remove --force` (0) · `git status --short` (0). No scratch
PostgreSQL cluster started — round 1's RLS results reused per instruction.

**Cleanup:** experiment worktree removed; shared tree left carrying only the
orchestrator's own packet edit.

---

## Orchestrator's independent spot-check

I did **not** re-execute the probe rig — `node_modules` is absent from the
shared tree by design, and the gate correctly installed into its own worktree.
I did independently verify every cheaply-checkable claim, and all of them hold:

- `StudentHome.test.tsx:142` is `loadData: defaultLoadStudentHomeData,` and
  `:143` is `...props,`, with the "spread after, below, always wins" comment at
  `:141`. The off-by-one has real teeth.
- `it(` at `:1106`, `describe` at `:1105`. `PARENT_USER.id` at
  `ParentHome.test.tsx:56`.
- `NextUpRowItem` (`StudentHome.tsx:1242-1249`) renders `MoreMenu` over
  `DropdownMenuOption[]` and no `Button`.
- `astryx-api.md` `:1818` `isLoading`, `:1819` `isInterruptible`, `:1820`
  `isDisabled`, `:1827` `clickAction`, `:1884` `DropdownMenuOption`,
  `:4822` `MoreMenu.isDisabled`, `:5614-5615` `SegmentedControl.isDisabled` /
  `disabledMessage` — all present and as described.

The BLOCKER's mechanism (React 19 deferring `setState` inside
`startTransition(async …)`) is standard React 19 Action semantics and the probe
output is internally consistent across its three modes. **Accepted as measured,
not independently re-executed** — stated so the reader knows which parts carry
my own verification and which carry the gate's.
