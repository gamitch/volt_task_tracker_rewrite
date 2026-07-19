# Worker Packet: T054

## Task ID
T054

## Objective
Build `src/pages/home/StudentHome.tsx` — Student Home (HOME-02), mobile-first. Live-meeting
check-in card (MTG-10: "Meeting live now" + 6-char code input + Check in button, same validation
path as QR) when a session is live; hours `ProgressBar` (MET-04) + participation % (MET-01); "Next
up" = the student's `going` sessions; "Sign-up opportunities" = future outreach sessions not yet
responded to, with inline **Sign up**/**Can't go**.

## Dependencies (status)
- T030 (`/meetings` list), T038 (`/outreach` list), T013 (metric views) — all Passed.
- T032 (`checkin` Edge Function) — Passed. **Read `supabase/functions/checkin/index.ts`/`hmac.ts`/
  `validation.ts` in full (read-only)** — MTG-10's "Check in button, same validation path as QR"
  means your 6-char code submission must call the exact same real contract T035's
  `CheckinResult.tsx`/`callCheckin()` already established (read `src/pages/checkin/CheckinResult.tsx`,
  read-only, already-Passed, for the exact request/response shape) — do not invent a second,
  different check-in contract.

## THE CENTRAL TRAP — read this before writing any code
`src/pages/home/StudentHomeSlot.tsx` (T008, already-Passed) is explicitly named in this task's own
ledger row ("wired into T008's slot"), but **read it in full first** — it has NO `children` prop and
no way to receive real content. It only accepts `hasLiveSession: boolean` and renders its own
hardcoded placeholder text when true. It structurally **cannot** be extended to show your real
6-char-code-entry UI. You must investigate this tension yourself and pick a defensible resolution:
- Most likely correct reading: `StudentHomeSlot` was only ever meant to prove the on/off *contract*
  a real card would need (per its own module doc, "T054 will render inside the real `StudentHome.tsx`
  it builds" — i.e., T054 builds its OWN real live-check-in card, matching the same on/off semantics
  `StudentHomeSlot` demonstrated, but does not literally reuse `StudentHomeSlot`'s JSX since it can't
  hold real content).
- Do NOT edit `StudentHomeSlot.tsx` (forbidden file) to add a `children` prop, even though that would
  be the "cleanest" fix — that's out of your Allowed Files.
- **State your resolution explicitly in your output** — this is a real, disclosed judgment call, not
  a silent assumption, same discipline every other scope-tension trap in this batch (T037/T030,
  T038/SideNav) has required.

## Allowed Files
- `src/pages/home/StudentHome.tsx` (new — confirm via `Glob` this doesn't exist yet)
- A colocated `StudentHome.test.tsx` is acceptable per established precedent — disclose it.

## Forbidden Files
- `src/pages/home/StudentHomeSlot.tsx` — **read-only**, see THE CENTRAL TRAP above. Do not edit it.
- `src/pages/home/CoachHome.tsx` — already-Passed sibling task's file, read-only reference for
  conventions only (e.g. its `KpiCard`/fixture-typing idiom).
- `src/pages/checkin/CheckinResult.tsx` — already-Passed sibling task's file, **read-only** — cite
  its `callCheckin()` contract, do not import from it or duplicate its file.
- `src/pages/meetings/**`, `src/pages/outreach/**`, `src/pages/reports/**` — read-only reference for
  conventions only.
- `src/app/router.tsx`, `src/app/guards.tsx` (import-only) — read-only. `/` (dashboard) is already
  wired to an inline placeholder; this task does not wire itself in.
- `src/lib/supabase/**` — read-only reference only, do not import directly. Build against an
  injectable `loadData`-style seam with obviously-fake fixture defaults.
- `supabase/migrations/**`, `supabase/functions/checkin/**` — read-only reference.
- `docs/swarm/**`, `.claude/**`, `src/theme/**`.

## Ground Truth — PRD 4.2 wireframe (verbatim, reproduce this exact structure)
```
STUDENT HOME (mobile, 375px)
┌──────────────────────────┐
│ ⚡ Hi Ada                 │
│ ┌──────────────────────┐ │
│ │ MEETING LIVE NOW     │ │  ← only while a session is live
│ │ [Scan QR] or code:   │ │
│ │ [ _ _ _ _ _ _ ] →    │ │
│ └──────────────────────┘ │
│ Your outreach hours      │
│ ▓▓▓▓▓▓▓░░░ 62 / 100 h    │
│ Participation: 87%       │
│ ── Next up ────────────  │
│ Sat · STEM Fair  [Going▾]│
│ Tue · Build Mtg  6–8 PM  │
│ ── Sign-up opportunities │
│ Jul 25 · Library demo    │
│            [Sign up]     │
└──────────────────────────┘
```

## Known Context / Traps

**1. THE CENTRAL TRAP** — see above, resolve and disclose explicitly.

**2. BEH-03 — the hero resolves to exactly ONE primary CTA, by strict priority, never two.**
Priority order: (1) live meeting check-in (if a session is live) → (2) oldest unanswered future RSVP
("You have 2 events to answer → Sign-up opportunities") → (3) quiet greeting, no CTA. Prove this with
a real test across all three states — a student with both a live session AND unanswered RSVPs must
see ONLY the live-check-in card as the hero, never both rendered as equally-weighted primary actions.

**3. BEH-02 — confirmed vs. planned hours never summed.** Same posture already established by
`OutreachList.tsx`/T038 and `CoachHome.tsx`/T053 — two visually distinct segments (confirmed=accent,
planned=lighter), legend text "62 h confirmed + 14 h planned", never collapsed into one number.

**4. MET-01/MET-04 sourcing (constitution item 3, BLOCKER-class).** Participation % must be a
`v_student_participation`-shaped fixture passthrough (read `20260717000003_metric_views.sql`,
read-only). Hours-vs-goal numerator must be `v_student_hours`-shaped confirmed hours (never
re-derive the hours-clamping/override formula in TS — same discipline `CoachHome.tsx`/T053's checker
already scrutinized closely); denominator is `goal_hours_override ?? season default_goal_hours`
(MET-04's literal formula, no corresponding view — legitimate aggregation, not a re-derivation).

**5. "Check in" reuses T032's real validation contract — do not re-implement it differently.** Read
`CheckinResult.tsx`'s `callCheckin()` (read-only) for the exact request shape (POST, `session_id` +
`token`/`code`). Your 6-char code entry submits through the same shape. No shared Supabase client
exists yet — inject the actual network call via a callback prop, obviously-fake default, same
posture as every prior content page.

**6. "Next up" = `going` sessions only** (both meetings and outreach the student has RSVP'd `going`
to, or meetings which don't use RSVP per MTG-03 — read `MeetingsList.tsx`, read-only, for how it
already modeled a student's own upcoming meeting attendance).

**7. Sign-up opportunities — inline Sign up/Can't go, real local-state update (not persisted, no
Supabase wiring), same posture as `OutreachList.tsx`/T038's own RSVP `SegmentedControl` stub.**

## Acceptance Criteria
- **BEH-03 (checker-enforced):** hero resolves to exactly one primary CTA by priority, proven across
  all three states with real tests.
- **BEH-02:** confirmed/planned hours never summed into one number.
- Check-in path reuses T032's real validation contract, not a re-implementation.
- MET-01/MET-04 sourced from view-shaped fixtures only, zero re-derivation (constitution item 3).
- THE CENTRAL TRAP resolution explicitly disclosed.
- Mobile-first layout matches the PRD wireframe structure.
- No box-drawing/bracket characters rendered (constitution item 13).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` all exit 0.

## Relevant Constitution Excerpts
> 3. RLS policies and metric SQL come **only** from PRD Section 8.4, copied verbatim. Re-deriving
> either, or duplicating a metric formula in TypeScript (PRD DATA-01) → BLOCKER.

> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md`. A prop absent from that
> file is presumed hallucinated → MAJOR.

> 6. No PII... test fixtures use fabricated names.

## Most Recent Failure
None. This is attempt 1 for T054 (attempt count: 0).

## Required Worker Output
- Full contents of `StudentHome.tsx`.
- Explicit write-up of THE CENTRAL TRAP resolution and reasoning.
- Real test proof of BEH-03's exactly-one-CTA priority logic across all three states.
- Real test proof of BEH-02's never-summed hours segments.
- Citation of the real `callCheckin()`/`v_student_participation`/`v_student_hours` shapes your
  fixtures are modeled on (file + line).
- Astryx prop citations for every component used — grep `astryx-api.md` yourself, don't guess.
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
