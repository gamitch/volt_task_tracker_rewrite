# GAM-290 run log

**T614 — The End time field has no lower bound, so a series edit can persist a
meeting whose end is before its start**

Issue: <https://linear.app/gamitch/issue/GAM-290/t614-the-end-time-field-has-no-lower-bound-so-a-series-edit-can>
Branch: `claude/gam-290-end-time-lower-bound`

This file is appended to and pushed at every milestone. It is the only artifact
that survives if this container is killed. **If the last line of this file is a
subagent dispatch with no matching verdict line, the run died holding that
subagent** — that is the failure signature described in `AGENTS.md` § "Two walls
a dispatched run hits".

## Log

- **2026-08-14 10:14Z — claimed.** `GAM-290` moved `Todo → In Progress` via
  `issueUpdate`, then re-read (item 28c read-back): `state.name = "In Progress"`,
  `updatedAt 2026-08-14T10:14:26.642Z`. No compare-and-set exists; the read-back
  is the claim.
- **2026-08-14 10:14Z — tiered HEAVY** (item 28d: tiering is part of claiming,
  not of finishing; label was `tier/unreviewed`). Reasoning, per item 26's single
  question — *can a mistake here corrupt data, or lie to a user about their own
  data?*:
  - The change guards a **write path**: `updateSessionTime`
    (`src/lib/loaders/meetings.ts`) persists the `startsAt`/`endsAt` interval.
    Item 26 names "a write path or destructive operation" as a HEAVY trigger.
  - The corrupted value **feeds metric SQL**: `v_planned_rsvp_hours` derives
    from that interval, so an inverted span reaches the metric as negative
    planned hours for every RSVP'd student — the "lies to a user about their own
    data" half of the test, not merely the "corrupts data" half.
  - The issue's own Verification note records that **the effect was never
    reproduced** — only the missing-guard cause was checked by reading the field.
    An unmeasured premise is precisely what item 19's gate exists to attack, and
    item 26 notes a gate that *runs* is worth much more than one that reads.
  - Item 26: "If two tiers are arguable, take the heavier one." STANDARD vs
    HEAVY is arguable here on diff size alone; the write path settles it.
  - Item 18 (worker model override) assessed separately and **not** triggered on
    current scope: no migration, no RLS/`security definer`, no metric-view SQL,
    no auth/session/role logic. Revisit if the premise gate returns a scope that
    adds a `CHECK` constraint on `event_sessions`, which would be a migration and
    would trigger the `model: "opus"` override.
- **2026-08-14 10:15Z — branch created**, run log written, first push.
- **2026-08-14 10:20Z — packet written**, `docs/swarm/active/GAM-290-packet.md`.
  Author-verified citations before submitting (item 19c): the End `TimeInput` is
  at `:1376-1381` with no `min`; `isValid` at `:1045-1048` compares nothing;
  Astryx `min`/`status` are real props (`astryx-api.md:1747`/`:1755`), so the
  issue's prescription is feasible under item 2.
  **Packet's central finding: the issue's own prescription is incomplete.**
  `min={startTime}` bounds what may be *entered into* the End field, but the
  recorded reproduction touched only **Start**, leaving an already-set End
  unvalidated — so `min` alone leaves the reported defect live. Prescription is
  therefore a submit-time ordering guard mirroring `EditMeetingSessionDialog`'s
  already-shipped `computeFieldErrors` (`:300-323`), with `min` kept as a
  secondary affordance. Five Least confident decisions declared (item 19d), the
  first being that this central finding is *reasoned, not measured*.
- **2026-08-14 10:22Z — `checker-premise` DISPATCHED** (round 1 of the two-round
  cap, item 19a), `run_in_background: false`, blocking. **If this line is the
  last one in this file, the run died holding this subagent** — no verdict was
  ever received and nothing below it happened.
- **2026-08-14 10:34Z — `checker-premise` round 1 VERDICT: REVISE.** 3 MAJOR,
  4 MINOR, 1 NIT, no BLOCKER. 147K tokens, 78 tool calls, ~11 min. The gate
  created its own worktree (`/tmp/gam290-gate`, item 23), ran `npm ci` — the
  shared tree's `node_modules/` was empty, so nothing here was measurable
  without it — and **ran the prescription rather than reading it** (item 26).
  **The premise HOLDS, and the gate closed the issue's own open gap.** The
  Linear description says the *effect* was never reproduced; it is now. Driving
  the real dialog in edit mode and typing into **Start only**, the gate captured
  the real payload: `startsAt 2026-09-15T00:00:00.000Z`,
  `endsAt 2026-09-14T22:30:00.000Z` — **−90 minutes, inverted.** It then added
  `min={startTime}` and re-ran: **byte-identical inverted payload**, End keeps
  its value, `aria-invalid` null, confirm still enabled. The packet's §2 central
  claim — that the issue's own prescription does not fix the issue's own
  reproduction — is **confirmed by measurement**, not reasoning. LCD #1 resolved
  SOUND; the §3 submit-time guard is load-bearing.
  Findings I must act on before round 2:
  1. **MAJOR — my §1 harm claim is FALSE.** Meetings are created
     `counts_volunteer_hours: false` and `v_planned_rsvp_hours` requires that
     flag, so a meeting session **cannot** reach the metric. I inherited that
     claim from the issue text and did not check it. Real measured harm: the
     **ICS feed** has no `counts_volunteer_hours` filter, so an inverted row
     emits a `VEVENT` with `DTEND` before `DTSTART` into a subscribed student's
     or parent's calendar. **Tier is unaffected** — HEAVY stands on item 26's
     write-path trigger alone — but my tiering entry above cites the metric and
     is corrected here rather than edited away (item 30c).
  2. **MAJOR — LCD #2 was wrong in the dangerous direction.** My fallback advice
     ("if in doubt use the sibling's UTC comparison") would **false-block a valid
     07:00–08:00 meeting on 2026-03-08**: `chicagoWallTimeToUtcIso` probes the
     zone offset at the naive-UTC instant, so spring-forward lands on wall
     07:00–07:59 and collapses 08:00 onto 07:00. 16 disagreeing pairs enumerated.
     Correct comparison is wall-clock minutes-since-midnight; that fallback must
     be struck.
  3. **MAJOR — create branch under-specified.** `isValid`'s two branches are
     separate expressions; a worker could gate edit only and pass all six ACs
     while create still inverts (measured: `22:00→00:30` persists −1290 min).
  4. **MAJOR — LCD #5 falsified: a second write path exists.**
     `OutreachEventDialog` → `loaders/outreach.ts`, same missing guard, and
     outreach **does** carry `counts_volunteer_hours: true` — so the harm I
     wrongly attributed to meetings is real on the surface I excluded.
  5. Two citations a worker would grep are wrong: `buildEditModeSessionsPayload`
     does not exist (it is `buildEditDesiredFutureSessions:784-812`), and the
     loader is `src/lib/supabase/loaders/meetings.ts:701-711`. 9 of 12 citations
     were exact; the two that failed are the two a worker would actually use.
  No currently-green test breaks under the prescription (82 passing baselined,
  four time-touching tests hand-checked). Item 18 opus override confirmed **not**
  triggered.
- **2026-08-14 10:36Z — packet revised for round 2** (all 8 required revisions
  applied), three item-20 follow-ups queued for filing.
- **2026-08-14 10:40Z — `checker-premise` round 2 DISPATCHED**, blocking
  (`run_in_background: false`). **If this line is the last one in this file, the
  run died holding this subagent.**
- **2026-08-14 10:53Z — `checker-premise` round 2 VERDICT: DISPATCH.** Severity
  ceiling MINOR (2 MINOR-with-teeth, 4 MINOR, 3 NIT; no BLOCKER, no MAJOR).
  115K tokens, 58 tool calls. Reused the round-1 worktree rather than paying for
  a second `npm ci`. All eight revisions verified as landed; the two wrong
  citations are gone from the packet everywhere (`grep` exit 1). Every round-2
  line number I asked it to check came back exact except four off-by-ones.
  **The gate found a false claim in my own round-2 text**, which is the point of
  a second round: §1 said an inverted row emits a `VEVENT` with `DTEND` before
  `DTSTART`. It does not — `ical-generator@11` calls `swapStartAndEndIfRequired()`
  in `toString()`, measured against the real package with round 1's own inverted
  payload. The harm surface is real (subscribers get a silently swapped span,
  zero-length on the DST date) but my mechanism was wrong, and I had labelled it
  "measured". Graded MINOR rather than MAJOR only because, unlike round 1's
  metric error, nothing rests on it — not the tier, not the scope, not an AC.
  **Ruling on LCD #6, which I will act on: `Passed`, not `Partial`.** Item 27 is
  scoped to a surface reading a fixture or stub; this dialog writes real rows.
  The unguarded outreach dialog is a *different surface*, and treating it as
  item 27 would turn that item into a horizontal-completeness rule its own text
  forbids. Two conditions attached: the outreach follow-up must be a real filed
  row before this one moves, and the closing note must state the narrowed claim.
  LCD #7 SOUND (leave the residual path; my "breaks T611" justification was
  overstated). LCD #8 SOUND, and for a better reason than I gave — an ICS
  assertion would have asserted the falsehood in finding 1.
  AC 4c confirmed **satisfiable and discriminating**: measured in create mode,
  a 07:00–08:00 session on 2026-03-08 is accepted today, passes under the
  prescribed wall-clock compare and goes **red** under a UTC one. Past dates are
  pickable with no clock manipulation, so it is cheap to write.
  Five text corrections folded in without a third round (item 19a: a third
  REVISE escalates, and the gate explicitly separated "must fix before a worker
  reads §1" from "a checker can catch later").
- **2026-08-14 10:56Z — five fold-in corrections applied; packet is DISPATCHABLE.**
