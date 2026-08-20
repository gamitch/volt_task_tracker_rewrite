Closes GAM-196

**Read this first — one judgement call is yours to reverse, and it is one commit's worth of copy.**

`/outreach`'s season-goal bar now says **`Signed up`** where it said `Confirmed`. That word is the whole substance of this PR, and PRD `BEH-02` prescribes `confirmed` as the label on that bar. I changed it on the strength of your comment on GAM-196 at `11:16:18Z` — *"We should use option A"* — because option (a) as GAM-196 defines it says verbatim that `/outreach` should say *"hours you signed up for" rather than "confirmed"*. **If you meant the principle but not the word, say so and it reverts in one commit:** `OutreachList.tsx` `:2157`, `:2163`, `:2166` and `:2007`. Nothing else depends on it.

## What was wrong

On `/outreach`, **both** hours figures are computed from RSVPs (`OutreachList.tsx:1380-1399`): `confirmedHours` = a `going` RSVP on a **completed** session, and it never opens the `attendance` table. Everywhere else in the app — home, leaderboard, reports, the weekly digest — *confirmed* means the attendance-backed `v_student_hours`. One word, two different quantities, and no screen said which was which.

## What changed

Wording and comments only, in one component and its test. **No arithmetic changed** — that was route (b), which you did not choose, and a byte-level check proves it: the five functions that compute hours are `md5sum`-identical before and after.

- `Confirmed` → `Signed up`; `{n} hrs confirmed` → `{n} hrs signed up`; the bar's `aria-valuetext` and the milestone toast follow.
- `Planned`, `Goal` and `% of goal` are untouched — PRD `MET-04` defines planned hours as future `going` sessions, which is exactly what the page computes. That half was already right.
- One new line under the tiles: **"From outreach sign-ups, not attendance. Confirmed hours from attendance appear on the home page and in reports."** This is the half of the fix that renaming alone does not deliver — GAM-196's actual complaint was that *neither screen says which is which*.
- Comments that claimed the divergence was unreconciled now name GAM-196 and GAM-431.

## What this PR deliberately does NOT fix, and where it went instead

**GAM-431 — the real defect is still open, and this PR is a label over it.** PRD `OUT-05` (`:319`), `MET-04` (`:566`) and OUT-01's own wireframe (`:485`) all specify `/outreach`'s hours as attendance-backed. They are not. So a no-show still accrues hours, a walk-in accrues none, your `hours_override` adjustments are invisible to this page, and late arrivals get the full session length. Route (a) makes that honest on screen; it does not make it go away. **Recommended next.**

**GAM-432 — the coach's past-event row still reads `Logged 0h` beside `Attended 2 students`.** Those come from different sources. Renaming it was in my first draft; the premise gate cut it, because OUT-01 specifies that cell as *"hours awarded"* — neither `Logged` nor `Signed up` — and that word is your call, not mine.

## Tier, and its defence (item 26)

**HEAVY**, matching `tier/heavy`. The deciding question is *"can a mistake here lie to a user about their own data?"* — this row is that question in its pure form: a student's own volunteer-hours total. Full chain run: packet → `checker-premise` (two rounds) → `worker-implementer` → `checker-reviewer`. Six subagents in total; the owner's request for parallel execution was honoured by dispatching recon three-wide and the gate/content checks two-wide, every one with `run_in_background: false` and waited on.

Arguably STANDARD once the scope collapsed to display copy — I kept HEAVY because item 26 says take the heavier tier when two are arguable, and because the gate then found a BLOCKER I had missed. It earned its cost.

## Evidence

| Gate | Result |
| -- | -- |
| `npx tsc --noEmit` | exit 0 |
| `npm run format:check` | exit 0 |
| `npx eslint .` | exit 0 (380 pre-existing warnings, 0 errors) |
| `npx vitest run` (full) | exit 0 — **2583 passed / 101 files**, the exact pre-change baseline |
| scoped vitest | exit 0 — **129 passed / 3 files** |

All run twice, independently: once by the worker, once by `checker-reviewer`, which read the committed blob rather than the report.

**Mutation proof, and it failed the first time.** The worker ran the packet's named mutation and reported that it **did not go red** — reverting the label left the suite green, because `textContent` concatenates the label and its value, so `Confirmed9 hrs signed up` still contains `9 hrs signed up`. That is a real coverage hole and the worker was right to report it rather than quietly write an assertion that made the criterion look satisfied. I authorized one more assertion to close it. Re-run:

```
AssertionError: expected 'Outreach4 pending RSVPsNew outreach e…' to contain 'Signed up9 hrs signed up'
Received: "...Team season goalConfirmed9 hrs signed upPlanned7 hrs planned..."
 ❯ src/pages/outreach/OutreachList.test.tsx:1634:35
 Test Files  1 failed | 2 passed (3)
      Tests  1 failed | 128 passed (129)
exit code 1
```

Restored, re-run green. `checker-reviewer` reproduced both the surviving mutant at `c2c18c7` and the red one at HEAD.

## Checker verdict

`checker-reviewer`: **PASS**, no BLOCKER, no MAJOR, no MINOR — four NITs, two of which are folded into GAM-432. It proved criterion 5 byte-level (`md5sum` per function body), recomputed the old line numbers of every removed test line to confirm none of the 20 protected green assertions was touched, and verified the new comments' citation of `HoursTab.tsx:743` by opening it.

## Records

- `docs/swarm/active/GAM-196-run-log.md` — append-only, pushed at every milestone including each subagent dispatch *before* waiting on it.
- `docs/swarm/active/GAM-196-packet-round2.md` — the packet, revision B, with the premise gate's ten required revisions applied.
- `docs/swarm/active/GAM-196-packet.md`, `GAM-196-premise-gate-round1.md`, `GAM-196-pr-body-run2-closed.md` — the two earlier runs' records, which correctly refused this row before you decided it.

Linear-Issue: GAM-196 (T188)
