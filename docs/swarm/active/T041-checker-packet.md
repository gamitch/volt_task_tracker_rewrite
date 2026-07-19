# Checker Packet: T041 (Outreach detail) — Check Attempt 1

## Task ID
T041 — Outreach detail `/outreach/:eventId` (OUT-04), Epic E6.

## Checker Agent
checker-accessibility (per task-ledger.md T041 row).

## Objective
Verify a `MetadataList` (when/where/scope/creator), per-session signup lists correctly grouped
into all four buckets (Going/Maybe/Can't go/No response), a plain (non-embedded) Google Maps link,
edit/cancel via `MoreMenu`, and a Copy link action that reveals nothing about invalid/inaccessible
events (DES-12/NAV-08).

## Allowed Files (worker's literal permitted edit)
- `src/pages/outreach/OutreachDetail.tsx` (new)

**Scope flag**: worker also created `OutreachDetail.test.tsx`, outside the literal Allowed Files
line — same disclosed pattern already ruled in-scope by every prior checker in this batch. Re-derive
the judgment yourself.

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commit (`fe49f1b`) — do NOT
infer authorship from commit messages. Confirm `OutreachList.tsx`, `OutreachEventDialog.tsx`,
`RsvpControl.tsx`, `router.tsx`, `guards.tsx` untouched. Note: the working tree may show other
concurrently-running tasks' files (`ParentRsvp.tsx`, `SubscribePopover.tsx`,
`supabase/functions/ics/**`, `supabase/functions/send-reminders/**`) — not this task's concern.

## Worker's Claimed Changes (do not trust — verify independently)
1. **Per-session grouping decision (disclosed judgment call)** — claims `groupSessionSignups`
   structurally only ever accepts a single `sessionId` (never an `eventId`), rendering one
   `SessionSignupList` per `event_sessions` row, chronologically ordered — cites OUT-04's own "per-
   session signup lists" wording as the basis.
2. **"No response" derivation — the central trap.** Claims `resolveEventRoster` (respecting
   `events.team_ids` NULL="all teams" vs. array semantics) is diffed against real `rsvps` rows for
   that SPECIFIC session; a roster student with no row → "No response," a real `'declined'` row →
   "Can't go," never conflated, no fourth stored status anywhere (grep-provable). Claims a test
   proves team-scoped roster exclusion (an out-of-scope-team student entirely absent, not even
   shown as "No response").
3. **DES-12/NAV-08 "reveal nothing" — claims proven via `null`-as-designed-not-found-signal.**
   `LoadOutreachDetailFn` resolves to `OutreachDetailData | null`, kept distinct from a rejected
   promise (a separate, different-copy transient-error `Banner`). Claims a test asserts the
   container's `textContent` contains ONLY the generic EmptyState copy — explicitly checked absence
   of title/address/student names/"Signups"/"Copy link"/any `MetadataList` DOM.
4. **Google Maps link** — `buildGoogleMapsUrl(address)` → plain
   `https://www.google.com/maps/search/?api=1&query=<encoded>`, claims a fixture address with
   space/comma/`#` characters proves correct encoding, and a test asserts no `<iframe>` exists.
5. **Copy link** — real `navigator.clipboard.writeText` + literal "Link copied" `Toast`; claims a
   disclosed safe no-op fallback when clipboard is unavailable (never throws).
6. **Edit/Cancel — disclosed stub `Banner`s**, NOT real mutations. Claims this was a deliberate
   judgment call: real event-wide cancel semantics for a multi-session event (which session(s)?
   all of them?) are under-specified by OUT-04's own text, and the packet's own Forbidden Files
   explicitly sanctioned stubs as the safer default.
7. Claims 20/20 new tests pass; 816/816 repo-wide. typecheck/lint/build clean; `format:check`
   failure disclosed as isolated to `Kiosk.tsx`, an untouched, out-of-scope file.

## Required Verification Steps
1. **Read `OutreachDetail.tsx` and `OutreachDetail.test.tsx` in full** — do not rely on the
   worker's module doc or this packet's paraphrasing.
2. **"No response" derivation — the single most important check in this packet.** Confirm by
   source read that the roster-minus-rsvps diff is genuine (grep for any fourth stored status
   string). Reproduce the team-scoped-exclusion test yourself.
3. **DES-12/NAV-08 reveal-nothing — reproduce the zero-event-data assertion yourself.** Confirm the
   `null`-vs-rejected-promise distinction is genuine and that the two error paths render distinctly
   different, appropriately-scoped copy (neither leaks event-specific data).
4. **Per-session-vs-per-event grouping — render your own explicit verdict** on whether this is the
   correct reading of OUT-04's "per-session signup lists" wording.
5. **Google Maps URL encoding — reproduce or independently verify** the fixture address's exact
   encoded output, and confirm no iframe/embedded-map SDK is used anywhere.
6. **Copy link — confirm the clipboard-unavailable fallback is real** (doesn't throw, doesn't
   silently fail in a way that misleads the user).
7. **Edit/Cancel stub scope — render your own explicit verdict** on whether leaving both as
   disclosure banners (rather than building a real Cancel mutation, which this task's packet
   explicitly permitted as a fallback but did not forbid a real implementation for) was the correct
   call, given the packet's own FYI about `trg_audit_session_cancellation` being available if the
   worker had chosen to implement it for real.
8. **Astryx prop citations** — spot-check `MetadataList`/`MetadataListItem`, `MoreMenu`, `Link`,
   `Button`, `Banner`, `EmptyState`, `Spinner`, `Toast`, `List`/`ListItem`, `Heading` against
   `astryx-api.md`.
9. **Test-file scope question** — render an explicit verdict, independently re-derived.
10. **Re-run typecheck/lint/build/test yourself** — don't accept the worker's claimed counts
    without your own run. Confirm the `format:check` failure is genuinely isolated to `Kiosk.tsx`.
11. **No box-drawing/bracket characters, no fabricated real-looking PII** — grep sweep yourself.

## Relevant Constitution Excerpts
- Item 2: Astryx component usage must stay within the documented API surface.
- Item 6: no PII; test fixtures use fabricated names only.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase)
- commands run
- exact findings
- explicit verdict on the "No response" derivation safety property
- explicit verdict on the DES-12/NAV-08 "reveal nothing" proof
- explicit verdict on the Edit/Cancel stub-vs-real-mutation scope decision
- explicit verdict on the test-file scope question
- required rework if failed
- follow-up tasks if passed with minor issues
