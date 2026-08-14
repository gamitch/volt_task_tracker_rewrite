# GAM-271 — run log

**Issue:** [GAM-271](https://linear.app/gamitch/issue/GAM-271/t507-the-login-card-overflows-the-viewport-on-every-phone-narrower)
— T507, the login card overflows the viewport on every phone narrower than ~400px.
**Branch:** `claude/gam-271-login-card-overflow`
**Started:** 2026-08-14

Append-only. Every line is written and pushed as it happens, because the
container is ephemeral and the transcript is not saved when the job is
cancelled (run 31358757094 lost roughly an hour of work exactly this way).

**Convention for delegation, and it is load-bearing:** a dispatch line is
written *before* the subagent is awaited, and its verdict is a separate line
written the moment the subagent returns. **If a dispatch line is the last line
in this file, the run died holding that subagent** — that is the signature of
the failure that killed runs 31354278407, 31385764526, 31514339272, 31523233268
and 31527801235, and it is the thing this wording exists to make unmistakable.

---

## Log

- **2026-08-14 04:21Z — read the binding docs.** `AGENTS.md` § "Where work comes
  from" and `docs/swarm/constitution.md` (items 18–30) read before any other
  file, per the dispatch instruction.
- **2026-08-14 04:22Z — fetched GAM-271 live from Linear.** State `Todo`,
  labels `unreviewed`, priority 0 (none). Description read from the tracker, not
  from any pasted copy.
- **2026-08-14 04:23Z — tiered `unreviewed` → `standard` (item 28d).**
  Reasoning, stated here and repeated in the PR per item 26: no write path, no
  schema/RLS/migration, no auth/session/role logic (item 25 forbids bumping tier
  because "login" *sounds* sensitive — a card's width prop is not session
  logic), no exported signature change, ~1–2 lines of production change. Every
  HEAVY trigger is clear. It is **not** FAST because FAST's fifth condition — a
  named mutation that turns a test red — cannot be met: jsdom has no layout, so
  the evidence form is a real-browser before/after measurement instead.
- **2026-08-14 04:23Z — CLAIMED.** `Todo → In Progress` written, then re-read:
  state `In Progress`, labels `[standard]`. Read-back confirms the claim (item
  28c — without it this is a hope, not a claim).
- **2026-08-14 04:24Z — branch `claude/gam-271-login-card-overflow` created**
  off `main` at `d5488c5`.
- **2026-08-14 04:30Z — citations re-verified against current `main` (item 19c).**
  `LoginPage.tsx:275` is exact and current: `<Card width={400} maxWidth="100%"
  padding={6} variant="default">`. `Card.width` / `Card.maxWidth` are both
  `SizeValue` (`docs/swarm/astryx-api.md:2988-2990`, "number = pixels, string =
  used as-is"), so the issue's candidate direction is prop-legal under
  constitution item 2 and is not a hallucinated prop.
- **2026-08-14 04:33Z — ENVIRONMENT DRIFT, worth its own follow-up.** The
  `layout-measurement` skill documents playwright as installed globally at
  `NODE_PATH=/opt/node22/lib/node_modules` with Chromium at
  `/opt/pw-browsers`. **In this dispatched container none of that exists** —
  no `/opt/node22`, no `/opt/pw-browsers`, no `playwright` in `node_modules`
  and none in `package.json`. `node_modules` was absent entirely until this run
  ran `npm ci`. `scripts/measure.cjs` therefore exits 2 here. The skill tells
  the reader to verify these facts rather than trust them, which is the only
  reason this was a ten-minute detour rather than a dead run. Worked around
  with `playwright-core` installed **outside the repo** in `/tmp/pwrig`
  (nothing added to `package.json` or `package-lock.json`) driving the system
  `/usr/bin/google-chrome` 151.0.7922.108 via `executablePath`. Follow-up filed
  under item 20 — see the "Deferrals filed" section below.
- **2026-08-14 04:38Z — PREMISE GATE: CONFIRMED, and it was measured, not read.**
  Throwaway CJS rig in `/tmp` (never committed), real `vite` dev server, real
  provider stack, real Chrome. **Every one of the issue's five numbers
  reproduces exactly:**

  | viewport | overflow | card rect | buttons | inputs |
  | -- | -- | -- | -- | -- |
  | 320 | **40px** | 400px | 3 | 2 |
  | 360 | **20px** | 400px | 3 | 2 |
  | 375 | **13px** | 400px | 3 | 2 |
  | 390 | **5px** | 400px | 3 | 2 |
  | 414 | **0px** | 400px | 3 | 2 |

  Presence paired with every number (T325's deleted-buttons trap): 3 buttons and
  2 inputs at all five widths, so the overflow is real content and not an
  artifact. **Mechanism confirmed by the computed ancestor chain at 390**, not
  inferred: card `rect=400 css-width=400px max-width=100%` → parent
  `.astryx-stack vertical` `rect=400 max-width:none` → first genuinely
  constrained ancestor `.astryx-center` at `rect=390`. The `maxWidth="100%"`
  resolves against a 400px box the card itself sized, so it is a no-op exactly
  as filed. **The issue is accurate in every particular; proceeding.**
- **2026-08-14 04:50Z — the issue's candidate direction is WRONG, and only a
  measurement that ran could have shown it.** Experiment in an isolated
  worktree `/tmp/gam271-exp` on `claude/gam-271-experiment` (item 23 — never the
  shared tree), second dev server on :5174. Applying the issue's literal
  suggestion — `maxWidth={400}` + `width="100%"` **on the Card alone** — gives
  `overflow: 0` at all five widths **and is a regression**: the card measures
  **247px at every viewport, including 414 and 1280**, where it was 400px
  before. `width:100%` resolves against the `VStack`, which is itself
  shrink-to-fit with `max-width:none`, so parent and child collapse together to
  min-content. **This is T325's deleted-buttons trap in a new costume — the
  number got better while the thing got worse** — and it was caught only
  because the rig records the card's own rect alongside the overflow figure.
  Had the packet carried the issue's wording verbatim, a worker would have
  shipped a login card that shrinks by 38% on every desktop.
- **2026-08-14 04:56Z — MEASURED prescription (this is what the packet carries).**
  The cap has to go where it can actually resolve: on the **stack**, because
  `hAlign="center"` means the stack does not stretch its children and the stack
  itself is shrink-to-fit. `VStack width="100%" maxWidth={400}` +
  `Card width="100%" maxWidth={400}`:

  | viewport | before | after | card rect before → after |
  | -- | -- | -- | -- |
  | 320 | 40px | **0px** | 400 → 320 |
  | 360 | 20px | **0px** | 400 → 360 |
  | 375 | 13px | **0px** | 400 → 375 |
  | 390 | 5px | **0px** | 400 → 390 |
  | 414 | 0px | **0px** | 400 → **400** |
  | 768 / 1280 / 1920 | 0px | **0px** | 400 → **400** (byte-identical) |

  Desktop is unchanged at every width — the fix is inert above 400px, which is
  the property the collapsing variant lacked. **Both content states of the card
  were measured, not just the default one:** the "Forgot password" reset panel
  behaves identically (320: 40px → 0px, 414/1280: 400px card preserved), with
  its heading and input asserted present at each width. Presence paired with
  every number throughout (3 buttons / 2 inputs on the login panel, reset
  heading + 1 input on the reset panel).
- **2026-08-14 04:58Z — experiment torn down.** `/tmp/gam271-exp` worktree and
  branch `claude/gam-271-experiment` removed, :5174 server stopped. Nothing
  from the rig is committed — it is an instrument, not a test (T131/T142
  convention).
- **2026-08-14 05:05Z — packet written** to `docs/swarm/active/GAM-271-packet.md`,
  carrying the *measured* prescription rather than the issue's wording, one
  Allowed File (`src/pages/login/LoginPage.tsx`), seven acceptance criteria —
  criterion 3 exists solely to catch the 247px collapse — and a Least confident
  decisions list (not required at STANDARD; included because the gate attacks it
  first and it is free).
- **2026-08-14 05:07Z — DISPATCHED `checker-premise`** on
  `docs/swarm/active/GAM-271-packet.md`, round 1 of the two-round cap (item 19a).
  Light-to-full scope per item 19b: the *premise* is already measured, but the
  *prescription* is mine rather than the issue's, so it has never been reviewed
  by anyone who did not write it. Dispatched with `run_in_background: false`;
  this line is written before the wait, deliberately.
  **If this line is the last one in this file, the run died holding this
  subagent** — that is the 31354278407 / 31385764526 / 31514339272 /
  31523233268 / 31527801235 failure, and nothing else looks like it.
- **2026-08-14 05:24Z — `checker-premise` round 1 returned: REVISE** (4 MAJOR,
  4 MINOR, 1 NIT; no BLOCKER — it confirmed the prescription works, having run
  it in three of its own worktrees). Subagent completed and its verdict is in
  hand; nothing left in flight. It confirmed every citation (lines 272/275, the
  `SizeValue` props on both Stack and Card, all five overflow numbers, the
  ancestor chain byte-for-byte, and the 247px collapse to the pixel). **The four
  findings that change the work:**
  1. **MAJOR — "Both lines are load-bearing" is FALSE, and it was my claim.**
     Line 272 *alone* — leaving the Card exactly as it is — gives 0 overflow at
     all five widths, card 400 at 414/768/1280/1920, and identical results in
     the reset panel and all three banner states. Line 275 is not load-bearing
     in any state the gate could produce. **Adopting the one-line fix.**
  2. **MAJOR — my eslint baseline was stale.** The packet quoted "0 errors / 364
     warnings" from `RESUME-HERE.md:110` (2026-08-04). Measured on the branch
     point in two independent trees: **378**. `MACHINE-SETUP.md:112` says
     measure, do not quote — I quoted. A worker taking 364 literally would have
     reported a phantom 14-warning regression.
  3. **MAJOR — the measurement route must be named in the packet.** The same
     environment drift I hit; the worker would have hit it with no stated way
     through, making criteria 2–5 unreachable.
  4. **MAJOR — T072 pattern inversion.** `verification-log.md:2095`/`:2220`
     record `width={N}` + `maxWidth="100%"` as an established pairing with
     **`LoginPage.tsx` named as the exemplar**; T072 shipped a change to
     `LiveConsole.tsx:1277` purely to conform to it. The one-line fix
     *preserves* that pairing — the pairing starts working the moment the stack
     is constrained — so this conflict disappears rather than needing a waiver.
     This is the strongest argument for the one-line form and I had missed it.
  Also: my least-confident #3 was right by luck (the reset rig measures the
  *idle* panel, so no banner state was actually covered — the gate measured all
  three and they are fine); three sibling pages carry the byte-identical defect
  (item 20 follow-ups owed); and `tests/e2e/public-routes.spec.ts:62-73`
  **already** asserts no overflow on `/login` in a real browser, blind here only
  because its narrowest project is Pixel 7 at 412px.
- **2026-08-14 05:31Z — replayed the gate's central claim myself before acting
  on it** (worktree `/tmp/gam271-v2`, :5175, item 23; torn down after).
  Line 272 alone, Card untouched: overflow **0 / 0 / 0 / 0 / 0** at
  320/360/375/390/414, card rect **320/360/375/390/400**, **400px at
  768/1280/1920**, reset panel 0 overflow at 320/390 with the card back to 400
  at 414/1280. Identical to the two-line form in every cell. **The gate was
  right and my claim was wrong.** Separately confirmed `npx eslint .` on this
  branch point: **0 errors / 378 warnings** — so the packet's "364" really was
  stale, quoted from `RESUME-HERE.md:110` dated 2026-08-04.
- **2026-08-14 05:34Z — packet revision 2 written.** Prescription reduced to
  **one line**; T072 pattern preserved rather than inverted; eslint baseline
  corrected to 378; the dead measurement route and its working replacement
  named explicitly for the worker; least-confident #3 corrected with the gate's
  banner-state numbers; in-repo precedent cited; three follow-up families
  recorded for item 20 filing.
- **2026-08-14 05:35Z — DISPATCHED `checker-premise` round 2** on packet
  revision 2, via `SendMessage` to the same agent so it re-reads its own round-1
  findings with context intact. This is the **second and final** round — item
  19a caps the gate at two, and a third REVISE escalates to the human owner
  rather than looping. Dispatched blocking; this line is written before the wait.
  **If this line is the last one in this file, the run died holding this
  subagent.**
- **2026-08-14 05:43Z — `checker-premise` round 2 returned: DISPATCH** (2 MINOR,
  4 NIT; no BLOCKER, no MAJOR). Subagent completed, verdict in hand, nothing in
  flight. All four round-1 MAJORs verified discharged rather than taken on my
  word. **The gate's best finding of the run, and it inverts my mental model:**
  it attacked the T072 argument by deleting the Card's `maxWidth="100%"` under
  the one-line fix and the page **re-breaks — 40 / 20 / 13 / 5 / 0 returns**,
  stack correctly capped at 320 but the card at 400 escaping it. So after the
  fix that prop is not "preserved but inert", it is **strictly load-bearing**:
  line 272 supplies a real percentage basis and `maxWidth="100%"` is the clamp
  that produces the 320/360/375/390 card. The pairing is switched **on**, not
  inverted — no reversal, no Definition-of-Ready-item-5 waiver owed. It also
  checked T072's own patch site, `LiveConsole.tsx:1277`, and found it sits in a
  genuinely constrained `HStack wrap="wrap"`, so the pairing works there for the
  same reason it was inert here. The argument holds at both ends.
  It also caught a **false "Measured:" claim I introduced in revision 2** — I
  wrote that the Card-only form collapses "with or without the stack change",
  and with the stack change it does not (0 overflow, card 400 at 414/1280).
  Five words that contradicted my own table twenty lines above. Exactly the
  claim class this gate exists for.
  Gate's own six-gate run on the one-line fix: tsc 0 · build 0 · prettier clean
  · eslint **0 errors / 378 warnings, no rise** · vitest **95 files / 2443
  tests, exit 0**. It also proved the packet's rig route works from an empty
  directory (`npm i playwright-core` exit 0, harness returned real numbers).
- **2026-08-14 05:50Z — packet revision 3 written**, folding in both round-2
  MINORs and all four NITs (the gate said no re-gate needed): the false "with or
  without the stack change" clause corrected in place rather than deleted; the
  T072 section rewritten around the load-bearing measurement; **a new criterion
  1a requiring one comment line above the `<Card>`**, because the gate's finding
  means line 275 is now live code that reads as dead and the next person to see
  this issue's title will be tempted to delete it; the rig-reuse line no longer
  assumes the worker inherits this container's `/tmp`; the `CheckinResult.tsx`
  follow-up marked reasoned-not-measured (that route is auth-gated here); a
  fifth follow-up added to re-measure T072's own `LiveConsole.tsx:1277`; and
  least-confident #2 and #3 restated as closed.
- **2026-08-14 05:52Z — DISPATCHED `worker-implementer`** on packet revision 3.
  Model: **pinned default (sonnet)** — constitution item 18's four override
  triggers are migrations, RLS/security-definers, metric-view SQL, and
  auth/session/permission logic, and a one-line layout prop on a presentational
  component is none of them. Item 25's second obligation forbids bumping to opus
  because a topic *sounds* sensitive, which "login" does. Recorded here per item
  18's "record the tier used". Dispatched with `run_in_background: false`; this
  line is written before the wait.
  **If this line is the last one in this file, the run died holding this
  subagent.**
