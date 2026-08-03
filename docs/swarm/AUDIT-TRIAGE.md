# External UX audit — triaged against the ledger

**Source:** an independent evidence-based UX audit of the running app, 2026-08-01 (live screenshots,
DOM measurements, source inspection). Its verdict: **ship recommendation `hold`** — 4 P0, 8 P1, 3 P2.

**This file is the reconciliation, not the audit.** Every finding is mapped to an existing ledger
row, a new one, or a closed decision. **The audit's own severities are its opinion; the Verdict
column is ours**, and where they differ the reason is stated.

**Ship recommendation assessment: the `hold` is justified** — but on **three** grounds, not four.
See LIVE-015, whose severity depends on a server behaviour the audit could not observe and which was
subsequently verified.

---

## UPDATE — 2026-08-02: two rows have moved since this file was written. Read this before the tables.

- **T323 (LIVE-015) is FIXED and merged** (`4fdcd1a`, PR #24). Ignore its row in the P0 table and
  item 2 of the suggested order.
- **T322 (LIVE-003) is no longer waiting on the owner.** The P0 table below says *"Owner input
  needed"* and the suggested order ranks it last, *"after the owner rules."* **He ruled the same day**
  (`auto-mode-decisions.md`, "George's ruling on T322"): meeting hours must **not** count toward
  volunteer hours. T322 is a **confirmed bug**, not a product question, and it is unblocked now.

  **The rule is by event `type`, never by event name — this has already confused two reviewers.**
  `type = 'meeting'` (the team's own internal meetings) does not count and produces a participation
  percentage instead; `type = 'outreach'` counts, and that **includes** `GG FLL Team Meetings` and
  `P3 FLL Team Meetings` despite the word *Meetings* in their titles — they are service the students
  run for the community. **Not authorized:** retyping any event, or touching the FLL events.

  T322 edits metric-view SQL, so constitution item 26 puts it at **HEAVY** tier regardless of how
  small the diff looks.

---

## The one-line summary

**The core attendance loop has no working path.** Roll call and QR check-in are a fixture shell
(LIVE-001), and a student who cannot scan has no fallback (LIVE-002). Everything else on this list
is smaller than those two together.

---

## P0 — the audit's blockers

| Audit | Finding | Ledger | Verdict |
|---|---|---|---|
| **LIVE-001** | Roll call / check-in is a non-persistent fixture shell; an invalid session id still renders seven fixture students | **T196** (existing, **BLOCKED**) | **CONFIRMED — agreed P0.** Independent confirmation of what our own ledger already says. `LiveConsole`'s attendance marking is an intentional no-op and its roster is a fixture. **The single biggest thing between this app and being usable.** |
| **LIVE-002** | `/checkin` has no manual short-code entry; expiry offers only "Try again", replaying the same credential | **NEW → T321** | **CONFIRMED — agreed P0, and cheaper than it looks.** The source comment calls it *"T054's future manual-entry sub-path"* — **but T054 is Student Home (HOME-02)**, an unrelated task. That reference points nowhere, so this was **untracked entirely**. T032 already shipped the short-code HMAC backend, so this is a **UI-only gap on a working backend**. Best effort-to-impact ratio on the list. |
| **LIVE-003** | Global staff KPI card labels meeting and outreach hours together under "Season hours" | **NEW → T322**, cross-ref **T188** | **PARTLY CONFIRMED.** The arithmetic claim is **true and verified**: `total_hours = sum(type_hours)` across *all* types including `meeting`, so meeting hours inflate "% toward season goal". The audit calls it a *locked-rule* violation; **that rule was not found stated as locked anywhere in the repo** — so this is a real correctness question, not a proven rule breach. **Owner input needed:** should meeting hours count toward the volunteer goal? Currently moot — the team records no meetings (see the FLL note in `../migration/mapping.md`), so the figure is 0.0h today. |
| **LIVE-015** | A parent on `/outreach/:id` receives real **Edit** and **Cancel event** actions | **NEW → T323** | **CONFIRMED as a defect, DOWNGRADED from P0.** The UI claim is exact — `menuItems` unconditionally includes both; only "Mark event complete" is behind `isStaffViewer`. **But the audit flagged server enforcement as unobserved, and it was then checked: `events` and `event_sessions` both carry `staff_all … using (is_staff()) with check (is_staff())`, so a parent's action is rejected by RLS.** Not a data-integrity emergency — a role-inappropriate control that errors out. Still must ship before launch; it is a two-line gating fix. |

---

## P1 — the audit's majors

| Audit | Finding | Ledger | Verdict |
|---|---|---|---|
| **LIVE-004** | Calendar shows hard-coded fixture events in production | **NEW → T324** | **CONFIRMED-BY-FAMILY, treat as high.** This is the *fabricated-data* family that produced nearly every real bug in this project (CoachHome T155, StudentHome T176, ParentHome T181). That family was declared closed; **this is a surviving member on a live route.** Rank it above the rest of P1. |
| **LIVE-005** | Past scheduled sessions remain under "Upcoming" | **T304 — CLOSED, no change** | **CONFIRMED but ALREADY DECIDED.** The owner reversed on a third bucket and accepted this: *"keep the current two buckets and i'll have to remember to close the days as they go by."* **Do not re-file.** If the accepted risk bites — unclosed days mean hours never reach `v_student_hours` — the cheaper middle ground is recorded on T304. |
| **LIVE-006** | Mobile student RSVP row collapses its content | **NEW → T325** | Plausible; not independently verified. Responsive defect at 390×844. |
| **LIVE-007** | Roster actions begin 560px offscreen on mobile | **NEW → T326** | Plausible; not independently verified. A measured DOM offset, so likely real. |
| **SRC-009** | Outreach completion is non-atomic | **NEW → T327**, cross-ref **T305/T307** | **CONFIRMED-BY-ADJACENCY.** T305/T307 worked this exact write path and found it destructive in two places; the sequencing concern is consistent with what was measured there. Scope carefully — that path now has protections T305/T307 added. |
| **LIVE-010** | Calendar feed has no first-use recovery | **T194 + T195** (existing) | **CONFIRMED, and our rows are stronger.** Ours record the deeper cause: **nothing anywhere creates a `calendar_feeds` row**, and the reset button fabricates a token locally instead of writing one. The feature is non-functional end to end, not merely lacking recovery. |
| **SRC-012** | Meetings and Outreach collapse a two-child parent to unlabeled single-child context | **NEW → T328** | Plausible. Note the owner **deliberately maintains a two-child parent fixture** (his `Test` student) precisely to exercise this path — so it is testable and worth fixing. |
| **SRC-016** | Duplicate digest switches leave email preference authority unresolved | **NEW → T329** | **PARTLY SETTLED.** The owner already ruled on the underlying ambiguity (2026-07-19): `weekly_digest` alone gates the send; `digest_enabled` is vestigial. The *data* question is closed; if two switches still render, that is a UI cleanup, not an authority question. |

---

## P2 — the audit's minors

| Audit | Finding | Ledger | Verdict |
|---|---|---|---|
| **SRC-011** | Event and session creation is not transactional | **NEW → T330** | **CORRECTED 2026-08-02 — this row's original verdict misapplied item 25 and is withdrawn.** It read *"Real but proportionate to a volunteer team of ~20 (constitution item 25)."* **Item 25 does not reach this finding.** Its own text (`constitution.md:272-273`) says *"Correctness, data integrity and honest on-screen values are **unaffected** by this item — it lowers no bar other than the security threat model."* T330 is a data-integrity and wrong-number finding, not a security one, so item 25 cannot down-grade it — and invoking a rule outside its scope is the exact move item 25's own closing sentence warns against. **The audit also graded a narrower claim than what T330 turned out to be:** it graded "creation is not transactional" (robustness). The two live defects are that the orphan event is **invisible on the coach list** (`OutreachList.tsx:1730` drops zero-session events from both buckets) and that its adult-volunteer figures **double-count in the season totals** (`reports.ts:401-411` filters on `season_id` alone; `HoursTab.tsx:580-596` sums across all season events with no session filter) — **the audit found neither**, which is what the "What the audit missed" section below exists to record. See the T330 ledger row for the full corrected facts. **T330 stays OPEN, tiered HEAVY.** |
| **LIVE-013** | Staff KPI strip dominates small viewports | **NEW → T331** | Cosmetic. |
| **LIVE-014** | Login shell has slight overflow and weak landmarks | **NEW → T332** | Cosmetic + minor a11y. |

---

## What the audit missed

Worth stating, because it bounds how much weight to put on a clean audit result. These are ours,
found by using the app or by checkers:

- **T193 — a student changing their RSVP on `/outreach` writes nothing to the database.** Silent data
  loss on a core action, invisible from the UI. **Arguably as severe as LIVE-002**, and the audit did
  not find it.
- **T309** — unchecking a student in "Mark day complete" is a silent no-op.
- **T320** — `queryAttendanceForSessions` has no `.range()`/`.limit()`; a >1000-row response is
  silently truncated by PostgREST.
- **T307** — the bulk "Mark event complete" path was **destroying recorded attendance in
  production**. Found while scoping T305, fixed, merged.

**The audit is complementary, not complete.** It found things we had not; we found things it did
not. Neither list alone is the state of the app.

---

## Suggested order

1. **LIVE-002 (T321)** — UI-only on a working backend; unblocks the check-in fallback.
2. **LIVE-015 (T323)** — two-line gating fix, removes an alarming control.
3. **LIVE-004 (T324)** — fixture data on a live route; the family that has burned this project most.
4. **T193** — silent RSVP data loss (ours, not the audit's).
5. **LIVE-001 (T196)** — the big one. Make `LiveConsole` real. This is a project, not a ticket, and
   `loaders/checkin.ts` (521 lines, **zero tests**) should come under test as part of it.
6. **LIVE-003 (T322)** — after the owner rules on whether meeting hours count toward the goal.

Everything below that is P1-responsive and P2-cosmetic, and none of it blocks a launch.
