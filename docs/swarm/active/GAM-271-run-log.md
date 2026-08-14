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
