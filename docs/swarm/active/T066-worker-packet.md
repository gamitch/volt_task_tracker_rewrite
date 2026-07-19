# Worker Packet: T066

## Task ID
T066 — Playwright persona smoke tests + login + RLS-denial (NFR-02), Epic E11.

**Status note**: this task's real ledger dependency is `T033,T037,T042,T053–T060` — as of this
packet being written, T042 and T060 are still In Progress (dispatched, not yet Passed). Do NOT
dispatch a worker against this packet until the full dependency range shows Passed in
`task-ledger.md`. This packet is being pre-built now so it's ready to dispatch immediately once
the range clears, per the swarm's established "write ahead, dispatch when unblocked" practice.

## Objective
Build Playwright smoke tests for the four persona flows named in PRD Section 3 (P-COACH,
P-STUDENT, P-COACH2, P-PARENT), plus login and an RLS-denial assertion (student fetching another
student's attendance gets zero rows), satisfying PRD Section 14's acceptance criteria #1, #3, #4,
#9.

## Dependencies (status)
- By dispatch time, every page this suite needs to click through (`/login`, Home variants,
  `/meetings/live/:sessionId`, `/kiosk/:sessionId`, `/checkin`, `/reports`, `/outreach/*`) should be
  Passed. **Read the actual files for each flow you're testing** — do not guess prop shapes or
  copy.

## Allowed Files
- `tests/e2e/**` (new directory)
- `playwright.config.ts` (new, project root)

## Forbidden Files
- Every `src/**` file — read-only reference only. This task does not fix application code; any
  real defect found is a candidate follow-up task, flagged in your output, not fixed here.
- `tests/rls/**` (T020's existing scratch-Postgres RLS harness) — read-only reference only. Your
  RLS-denial assertion is a DIFFERENT mechanism (a real browser session hitting a real/mocked
  backend, not a `psql` scratch-DB scenario) — read `tests/rls/assertions.sql`'s existing
  "student fetching another student's attendance gets zero rows"-shaped scenario for the SEMANTIC
  behavior to reproduce, but do not literally reuse or extend that SQL harness; this task's
  mechanism is Playwright, not `psql`.
- `supabase/migrations/**`, `docs/swarm/**`, `.claude/**`.

## KNOWN CONTEXT / THE CENTRAL BLOCKER — READ THIS FIRST, BEFORE WRITING ANY TEST

**As of this packet's writing, ZERO pages in this application are wired into real routes with a
real backend.** Confirm this yourself before proceeding: `router.tsx` still renders inline
placeholders for every real page component built across E4–E9 (a recurring, explicitly-disclosed
gap named in nearly every prior content-page task's own worker output — search
`docs/swarm/verification-log.md` for "router-wiring gap" if you want the full history). No shared
Supabase client is wired into any page's data path either (`T071` built the client but deliberately
left every consumer unwired — same disclosed, deliberate scope decision repeated across this
entire project). This means: **a literal "click through the real running app in a browser and
assert on a real backend's data" Playwright test, as PRD Section 14's acceptance criteria #1
literally describes, is currently impossible to build and pass.** This is not a testing-technique
problem you can engineer around — the application genuinely does not have these code paths
connected yet.

You have three honest options; pick one, implement it, and disclose your reasoning explicitly and
prominently in your output — do not silently choose one without flagging the tension:

1. **Build the full Playwright suite AGAINST A LOCALLY-RUN DEV BUILD OF THE APP AS-IS**, accepting
   that most assertions will legitimately fail today (not because your test is wrong, but because
   the app isn't wired), and mark those specific assertions `test.fixme()`/`test.skip()` with a
   comment citing the exact missing wiring, so the suite becomes a real, growing regression harness
   that starts passing incrementally as future wiring tasks land — never comment out or silently
   weaken an assertion to force a false green.
2. **Escalate this as a dispute/boss-arbiter question**: is T066 prematurely scheduled ahead of the
   T016a-pattern wiring series this project has repeatedly flagged as needed but not yet
   dispatched? State clearly that you believe the task's own literal acceptance criteria cannot be
   satisfied without that wiring landing first, and recommend the swarm sequence a wiring wave
   before re-attempting this task for real.
3. **Some combination**: build what CAN genuinely be tested today (the real, already-Passed
   `/login` page's rendered DOM in isolation, individual already-Passed page components mounted
   directly via Playwright's component-testing mode or a thin standalone HTML harness rather than
   through `router.tsx`) while explicitly scoping out and disclosing what cannot yet be tested
   end-to-end.

Whichever you choose, the worst outcome is a suite that reports green without actually exercising
real behavior — that would be a constitution item 1 ("no worker self-certifies... every PASS
requires independent... evidence") violation in spirit, since a fake-green Playwright suite is
exactly the kind of unverified claim this whole project's checker discipline exists to catch.

## Known Context / Traps (assuming you proceed with some real test-writing, per above)

**1. The four persona flows, cited from PRD Section 3 verbatim:**
- P-COACH: "From Home, a coach can start tonight's meeting check-in in ≤ 2 taps and see live
  status for every roster member on one screen."
- P-STUDENT: "A student scanning the shop QR goes from camera to 'You're checked in' in ≤ 10
  seconds with no typing (when already signed in)."
- P-COACH2: "A second coach can open Reports and answer 'which students are below 70%
  participation this season?' without exporting anything."
- P-PARENT: "A parent opening the app sees, above the fold on a phone, each linked kid's next
  event and current hours/participation."

**2. Section 14 acceptance criteria this task must satisfy, cited verbatim:**
- #1: "All four persona smoke tests (Section 3) pass on production build, mobile and desktop,
  light and dark."
- #3: "A QR check-in with an expired token fails with the DES-16 message; a valid one lands within
  the grace rule (MTG-08)."
- #4: "Coach override survives a subsequent QR write (MTG-11)."
- #9: "An uninvited Google sign-in reaches no data (AUTH-04 + RLS test)."

**3. RLS-denial assertion — semantic target, cited from NFR-02**: "student fetching another
student's attendance gets zero rows." Given the central blocker above, decide and disclose how you
represent this in a Playwright context (e.g., a real network-request assertion against a mocked
backend that mirrors the real RLS policy's behavior, versus a genuine live-backend test) — do not
claim you tested against real Supabase RLS policies if you did not.

**4. Both color modes, both mobile and desktop viewports** — Playwright's `colorScheme`/`viewport`
context options, cited from `docs/swarm/astryx-api.md`'s theming conventions if relevant, or
Playwright's own real API (this is standard Playwright config, not an Astryx concern).

**5. Coach-override-survives-QR-write (MTG-11)** — read `LiveConsole.tsx` (already Passed, T033)
for the real client-side logic this criterion maps to; decide whether this needs a real backend
round-trip or can be verified at the component level given the central blocker.

## Acceptance Criteria
- A clear, prominently-disclosed resolution of the central blocker (Known Context section above) —
  this is the single most important thing this task's checker will scrutinize.
- Whatever suite IS built passes for real, with zero fake-green assertions.
- RLS-denial semantic behavior addressed and its verification method honestly disclosed.
- No box-drawing/bracket characters (constitution item 13).

## Relevant Constitution Excerpts
> No task is ever marked complete on worker self-report — every PASS requires independent
> checker-inspected evidence, not trust of worker claims. *(Cited because this task is at genuine
> risk of a worker producing a suite that "passes" only because it asserts nothing meaningful — the
> checker will scrutinize this specifically.)*

## Most Recent Failure
None. This is attempt 1 for T066 (attempt count: 0) — not yet dispatched.

## Required Worker Output
- Full contents of every file under `tests/e2e/**` and `playwright.config.ts`.
- Explicit, prominent write-up of which of the three central-blocker options (or combination) you
  chose, and why.
- Explicit mapping of each Section 14 acceptance criterion (#1, #3, #4, #9) to the specific
  test(s) addressing it, or an explicit statement that it cannot be tested yet and why.
- Real run output (not just "should pass" — actual `npx playwright test` output).
- Known risks; whether a dispute is needed (you flag, you don't resolve — and per the Known
  Context section, a dispute here is a live, expected possibility, not a last resort).
