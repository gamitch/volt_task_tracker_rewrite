# Checker Packet: T046 (Subscribe popover + reset link) — Check Attempt 1

## Task ID
T046 — Subscribe popover + reset link (CAL-03), Epic E7.

## Checker Agent
checker-reviewer (per task-ledger.md T046 row).

## Objective
Verify a real `Popover` showing a constructed ICS URL, Copy link, "Add to Google Calendar" helper
text, and a Reset flow that correctly represents "revoke old token + create new token" as one
coherent action (not a plain UPDATE), confirmed via a real `AlertDialog` with BEH-09-compliant copy.

## Allowed Files (worker's literal permitted edit)
- `src/pages/calendar/SubscribePopover.tsx` (new)

**Scope flag**: worker also created `SubscribePopover.test.tsx`, outside the literal Allowed Files
line — same disclosed pattern already ruled in-scope by every prior checker in this batch. Re-derive
the judgment yourself.

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commit (`14b5318`) — do NOT
infer authorship from commit messages. Confirm `CalendarPage.tsx` untouched, no migration
added/edited (`calendar_feeds` already exists). Note: the working tree may show other concurrently-
running tasks' files (`OutreachDetail.tsx`, `ParentRsvp.tsx`, `supabase/functions/ics/**`,
`supabase/functions/send-reminders/**`) — not this task's concern.

## Worker's Claimed Changes (do not trust — verify independently)
1. **`calendar_feeds` has no uniqueness constraint on `profile_id`** (unlike `notification_prefs`)
   — claims this is confirmed by direct migration read, making CAL-05's "one active per profile" an
   application-level invariant, not DB-enforced.
2. **Reset represented as a real revoke-old+create-new callback**, `ResetFeedTokenPayload
   { profileId, revokeFeedId }` → `Promise<CalendarFeedRow>`, mirroring T029/T036's payload shape
   with one DISCLOSED, necessary deviation: it resolves to the new row (not `void`) because the new
   `token` is DB-generated (`default gen_random_uuid()`) and can't be predicted client-side. Claims
   local `feed` state is only swapped to the new row after the call resolves — never optimistic.
3. **ICS URL construction**: `buildIcsUrl(functionsBaseUrl, token)` → trims trailing slashes,
   produces `${base}/ics?token=${token}` matching CAL-04's literal `GET /functions/v1/ics?
   token=<uuid>` shape. Injectable `functionsBaseUrl` prop defaults to an obviously-fake placeholder
   URL.
4. **AlertDialog kept at its documented `'destructive'` `actionVariant` default** (a DELIBERATE
   choice, disclosed as differing from T036's override) — claims reasoning that Reset genuinely
   breaks existing calendar-app integrations, unlike ending a meeting.
5. **BEH-09 copy**: "Your old calendar link will stop working. Any calendar app using it will need
   the new link." — claims this states what happens next, not a bare "Are you sure?".
6. **Copy link**: `navigator.clipboard.writeText` + `pushToast('Link copied')`; claims a disclosed,
   real clipboard-unavailable fallback (confirmed via this repo's real jsdom gap) shows a Banner
   instead of throwing.
7. Claims 11/11 new tests pass; 815/816 or 816/816 repo-wide (fluctuating due to concurrent
   workers, disclosed). typecheck/lint/build clean for its own file.

## Required Verification Steps
1. **Read `SubscribePopover.tsx` and `SubscribePopover.test.tsx` in full** — do not rely on the
   worker's module doc or this packet's paraphrasing.
2. **`calendar_feeds` schema claim — re-verify directly.** Open the migration yourself and confirm
   `profile_id` genuinely has no uniqueness constraint, and `token` does.
3. **Revoke-old+create-new atomicity — the central design check.** Confirm by source read that
   Reset is genuinely represented as one coherent callback, not two independently-dispatchable
   calls. Render your own explicit verdict on the disclosed `Promise<CalendarFeedRow>` deviation
   from the T029/T036 `Promise<void>` shape — is returning the new row a reasonable, necessary
   adaptation given the DB-generated token, or does it introduce a design smell worth flagging?
4. **`actionVariant='destructive'` retention — form your own explicit verdict** on whether keeping
   the documented default (vs. T036's override) is the correct call here, given Reset's real
   consequence (breaking existing calendar subscriptions) differs meaningfully from T036's "ending a
   meeting is normal workflow completion" reasoning.
5. **ICS URL construction — reproduce or independently verify** against CAL-04's literal spec text.
6. **Copy link / clipboard-unavailable fallback — confirm by source read** that the fallback is
   real (not silently swallowed) and reproduce the toast-firing test.
7. **Astryx prop citations** — spot-check `Popover`, `AlertDialog`, `Button`, `Text`, `Banner`,
   `Spinner`, `VStack`/`HStack` against `astryx-api.md`.
8. **Test-file scope question** — render an explicit verdict, independently re-derived.
9. **Re-run typecheck/lint/build/test yourself** — don't accept the worker's claimed counts without
   your own run.
10. **No box-drawing/bracket characters** (constitution item 13) — grep sweep yourself.

## Relevant Constitution Excerpts
- Item 10: database changes are additive migrations via the Supabase CLI. *(Cited because this task
  correctly did NOT add a uniqueness constraint or otherwise migrate `calendar_feeds` — it handled
  "one active per profile" at the application level instead.)*
- Item 2: Astryx component usage must stay within the documented API surface.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase)
- commands run
- exact findings
- explicit verdict on the revoke-old+create-new atomicity design and its `Promise<CalendarFeedRow>`
  deviation
- explicit verdict on the `actionVariant='destructive'` retention decision
- explicit verdict on the test-file scope question
- required rework if failed
- follow-up tasks if passed with minor issues
