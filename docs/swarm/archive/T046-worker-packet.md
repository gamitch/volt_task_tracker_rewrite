# Worker Packet: T046

## Task ID
T046 — Subscribe popover + reset link (CAL-03), Epic E7.

## Objective
Build `src/pages/calendar/SubscribePopover.tsx`: a "Subscribe" button opening a real `Popover`
with the user's personal ICS URL, a Copy link button, "Add to Google Calendar" helper text, and a
Reset link (revokes the old token, confirmed via a real `AlertDialog`).

## Dependencies (status)
- T045 (`/calendar` page) — Passed. Read `CalendarPage.tsx` (read-only) for established
  conventions (BEH-08 date helpers, DES-04 badge mapping) if relevant, though this task is a
  self-contained widget, not a list page.

## Allowed Files
- `src/pages/calendar/SubscribePopover.tsx` (new)
- A colocated `SubscribePopover.test.tsx` is acceptable per established precedent — disclose it.

## Forbidden Files
- `src/pages/calendar/CalendarPage.tsx` — read-only reference only.
- `supabase/functions/ics/**` — does not exist yet (a separate, parallel task, T047). This task
  does not build or call the real ICS-serving Edge Function; it only constructs and displays the
  URL a caller would use.
- `src/app/router.tsx`, `src/app/guards.tsx` (import-only, `pushToast` import permitted for the
  Copy-link toast) — read-only.
- `src/lib/supabase/**` — read-only reference only, do not import directly. Build against an
  injectable `loadCalendarFeed`/`onResetFeedToken`-style seam with an obviously-fake fixture
  default.
- `supabase/migrations/**` — read-only.
- `docs/swarm/**`, `.claude/**`, `src/theme/**`.

## Ground Truth — real schema (read the actual file yourself, do not guess column names)
`calendar_feeds`: `id`, `profile_id` (fk profiles), `token` (uuid, unique,
`default gen_random_uuid()`), `revoked_at` (nullable timestamptz) —
`supabase/migrations/20260717000001_support_audit.sql` lines 45-52. **Not** a `unique` constraint
on `profile_id` alone (unlike `notification_prefs`, which is) — a profile can accumulate multiple
rows over time (one per reset), each independently revocable. CAL-05's "one active per profile"
requirement is therefore an APPLICATION-level invariant your Reset flow must maintain (revoke the
old row, create exactly one new row), not something the schema enforces on its own the way
`seasons_single_active_idx` enforces "one active season" at the DB level (T029's precedent) — cite
this distinction explicitly, don't assume the DB does the same job here.

## Known Context / Traps

**1. THE CENTRAL DESIGN QUESTION — Reset is NOT an UPDATE, it's revoke-old + create-new.** Per
CAL-05 ("tokens are UUIDv4, revocable, one active per profile") and the schema's lack of a
uniqueness constraint on `profile_id`, your injectable `onResetFeedToken`-style callback should
represent the reset as one coherent action producing TWO effects: (a) the current active row's
`revoked_at` gets set (never deleted — a revoked row stays queryable, matching every other
soft-revoke pattern in this codebase, e.g. `invites.status='revoked'` from T027), and (b) a brand
new `calendar_feeds` row is created with a fresh `token`. Represent this the same way T029's
`SetActiveSeasonPayload` and T036's `EndMeetingPayload` represented their own multi-part atomic
actions — one payload/callback naming both effects, not two independently-dispatchable calls.

**2. The real ICS URL shape — you're constructing a URL for a function that doesn't exist yet
(T047, parallel task), so get the shape right from CAL-04's own literal spec, don't guess.** CAL-04
(PRD line 312): `GET /functions/v1/ics?token=<uuid>`. Your Popover's displayed URL should be the
real Supabase Edge Function invocation URL pattern:
`${SUPABASE_FUNCTIONS_URL}/ics?token=${token}` — since no shared Supabase client/config is wired in
yet, use an injectable base-URL constant/prop with an obviously-fake placeholder default (same
"honest placeholder" posture every prior page in this batch has used for its data seam), and
disclose exactly how a real wiring task would supply the real Supabase project's functions URL.

**3. `Popover` — real documented component.** Cite `content`/`label`/`isOpen`/`onOpenChange`
props from `astryx-api.md`'s real Props table (grep it yourself). The Popover's `content` should
show the read-only URL (a `Text`/monospace-styled display, not an editable input — this is a value
to copy, not to type), a Copy button, the literal helper text "Add to Google Calendar: Settings →
Add calendar → From URL" (CAL-03's own literal wording, cite verbatim), and the Reset link/button.

**4. Copy link — reuse the exact pattern T041 established (if it's landed) or build it fresh
following the same shape: `navigator.clipboard.writeText(...)` + `pushToast('Link copied')`
(imported read-only from `guards.tsx`, NAV-08's literal toast text).** Handle the clipboard-
unavailable case gracefully, same as T041's disclosed approach.

**5. Reset confirmation — a real `AlertDialog`, and BEH-09 "states what happens next."** CAL-03
requires the Reset flow to go through `AlertDialog` (not a bare button with no confirmation) since
it invalidates the OLD url — anyone who imported the previous feed link loses access, a real,
disclose-worthy consequence. The dialog copy should say so explicitly (BEH-09: "say what happens
next" — e.g. "Your old calendar link will stop working. Any calendar app using it will need the new
link." — not a bare "Are you sure?").

**6. BEH-09 — the Popover itself states what the feed contains**, per CAL-03's own literal
requirement ("popover states what the feed contains") — a short description of what syncs (e.g.
"Includes your meetings, outreach events, and competitions" — tailor to the real CAL-04 scope: 30
days past through all future, role-scoped).

**7. No shared Supabase client wired in — deliberate scope, not a gap for you to solve.** Same
posture as every prior content page.

## Acceptance Criteria
- Real `Popover` showing the constructed ICS URL, a Copy button, the literal "Add to Google
  Calendar..." helper text, and a Reset action.
- Reset represented as one coherent revoke-old+create-new action (not a plain token UPDATE),
  confirmed via a real `AlertDialog` with BEH-09-compliant copy stating the old link will stop
  working.
- Copy link writes the real URL to the clipboard and shows "Link copied".
- Popover states what the feed contains (BEH-09).
- No box-drawing/bracket characters (constitution item 13).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` all exit 0.

## Relevant Constitution Excerpts
> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md`. A prop absent from that
> file is presumed hallucinated → MAJOR.

> 10. Database changes are additive migrations via the Supabase CLI. *(Cited because the
> `calendar_feeds` schema already exists — do not write a migration to add a uniqueness constraint
> or otherwise change it; represent "one active per profile" at the application/callback level.)*

## Most Recent Failure
None. This is attempt 1 for T046 (attempt count: 0).

## Required Worker Output
- Full contents of `SubscribePopover.tsx`.
- Explicit write-up of the revoke-old+create-new atomicity design (Trap #1) and why it's not a
  plain UPDATE.
- Explicit write-up of the ICS URL construction and the injectable base-URL seam.
- Real test proof of the reset flow (old token/row marked revoked, new row/token created, exactly
  one active), the copy-link flow, and the AlertDialog confirmation copy.
- Astryx prop citations for every component used — grep `astryx-api.md` yourself, don't guess.
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
