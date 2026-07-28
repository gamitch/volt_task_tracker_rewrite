# Worker Packet: T049

## Task ID
T049 — Transactional email templates (EML-02, rows 1-5), Epic E8.

## Objective
Build five real email body templates under `src/emails/templates/`: `invite.tsx`,
`signup-confirm.tsx`, `event-reminder-48h.tsx`, `event-reminder-3h.tsx`,
`meeting-reminder-3h.tsx`. Each produces the `bodyHtml`/`previewText` pair that
`renderEmailLayout()` (T048, already Passed) wraps into a complete branded email.

## Dependencies (status)
- T048 (Resend integration + branded layout + `email_log`) — Passed. **Read
  `src/emails/layout/renderEmailLayout.ts`, `constants.ts`, and `inviteFixtureBody.ts` in full
  before writing anything.** `renderEmailLayout({ previewText, bodyHtml })` is your wrapper — each
  template you build exports a function returning `{ previewText, bodyHtml }` (or two functions,
  matching `inviteFixtureBody.ts`'s own `buildInviteFixtureBodyHtml`/`buildInviteFixturePreviewText`
  split — your call, disclose it) that a caller passes into `renderEmailLayout`. `bodyHtml` is
  trusted HTML the layout does NOT re-escape — YOU own escaping any dynamic value you interpolate
  (student names, dates, etc.) before building the string; grep `renderEmailLayout.ts`'s own
  `escapeHtml` helper and either import a shared escaping utility if one exists or write your own
  equivalent — do not interpolate raw untrusted-shaped strings unescaped.
- `inviteFixtureBody.ts`'s own module doc explicitly states it is a T048-owned placeholder and that
  "T049 should very likely replace or delete this fixture outright once it lands" — **you cannot
  literally replace or delete it**, since `src/emails/layout/**` is outside your Allowed Files (see
  below) and is forbidden to you. Build your own real `invite.tsx` under your own allowed directory
  instead; a future wiring task decides which one `send-invite`'s Edge Function actually calls.
  State this explicitly in your output so it's not mistaken for an oversight.

## Allowed Files
- `src/emails/templates/invite.tsx`
- `src/emails/templates/signup-confirm.tsx`
- `src/emails/templates/event-reminder-48h.tsx`
- `src/emails/templates/event-reminder-3h.tsx`
- `src/emails/templates/meeting-reminder-3h.tsx`
- Colocated `*.test.tsx` files for each are acceptable per established precedent — disclose them.

## Forbidden Files
- `src/emails/layout/**` — read-only reference only (import `renderEmailLayout`/its constants, do
  not edit or delete anything there, including `inviteFixtureBody.ts`).
- `src/emails/templates/weekly-digest.tsx` — does not exist yet (a separate, currently-Ready-but-
  parallel task, T050). Do not build it here.
- `supabase/functions/send-invite/**`, `send-reminders/**` — read-only reference/out of scope; no
  wiring of these templates into any real send path is required or expected by this task.
- `src/lib/supabase/**` — read-only reference only, do not import directly.
- `supabase/migrations/**` — read-only.
- `docs/swarm/**`, `.claude/**`, `src/theme/**`.

## Known Context / Traps

**1. THE `.tsx` EXTENSION VS. T048's CROSS-RUNTIME PLAIN-TS PRECEDENT — a real tension, your call,
disclose it.** The ledger literally names these five files with a `.tsx` extension. T048's own
`renderEmailLayout.ts`/`constants.ts` are deliberately PLAIN TypeScript — zero React/JSX, zero
`@astryxdesign/*` import — specifically so the same source file is importable byte-unchanged from
BOTH the src/ Vite/tsc toolchain AND the Deno runtime (`supabase/functions/send-invite/index.ts`
reaches it via a relative import); T048's module doc explicitly says a React/JSX-based email
renderer is not on the constitution item 9 dependency allowlist and has no build step wired to make
it Deno-consumable. You must decide: (a) follow T048's own precedent and write these five files as
plain template-literal-returning TS functions (same shape as `inviteFixtureBody.ts`), just saved
with a `.tsx` extension as the ledger literally names (a `.tsx` file is not REQUIRED to contain
JSX — the extension alone doesn't force it), which keeps them Deno-import-compatible the same way
T048's files are; or (b) use real JSX, accepting that these five files would then NOT be safely
importable from the Deno Edge Function without new build-step infrastructure this task is not
scoped to build. Given EML-01/EML-02 describe these as emails actually sent by
`supabase/functions/send-invite`/`send-reminders` (Deno runtimes), **(a) is very likely the
correct, consistent choice** — but state your reasoning explicitly either way; do not silently pick
one without disclosing the tension.

**2. Escaping dynamic content — no template renders raw, unescaped interpolated data.** Every
template interpolates at least one dynamic value (a name, a date, an event title). Follow
`renderEmailLayout.ts`'s own `escapeHtml` pattern; do not assume upstream data is pre-sanitized.

**3. EML-02's real recipient/trigger table (PRD line 318-326) — cite verbatim, don't paraphrase**:

| Template | Trigger | Recipient |
|---|---|---|
| `invite` | AUTH-03 (invite sent) | invitee |
| `signup-confirm` | RSVP set to `going` | student (+ linked parents) |
| `event-reminder-48h` | 48h before outreach/competition session | `going` students + their parents |
| `event-reminder-3h` | 3h before same | same |
| `meeting-reminder-3h` | 3h before meeting session | students in scope (pref-gated, default on) |

You are not building the actual send/scheduling logic (that's T051, separate, currently Blocked) —
only the template's rendered content — but each template's props/interface should make the
recipient context obvious (e.g. accept a `recipientName`, not assume a generic "Hi there").

**4. `signup-confirm`, `event-reminder-*`, `meeting-reminder-3h` say what happens next (BEH-09,
extends DES-14/16)** — e.g. "You're signed up — we'll remind you 2 days before" is the PRD's own
literal example. Copy should be honest about which reminders actually exist as scheduled system
behavior once T051 lands (this task doesn't need T051 built to write honest forward-looking copy,
same posture T035 already took for its own "no real tally source" disclosure).

**5. DES-14 voice**: sentence case, plain verbs, no "Submit"/"OK". Cite the PRD's own copy voice
rules directly (PRD line 210) rather than inventing your own tone.

**6. EML-05 — no cross-student data leakage.** None of these five templates are the weekly digest
(T050 owns EML-05's multi-child case), but `signup-confirm`/`event-reminder-*` sent "to student (+
linked parents)" must still only ever reference the ONE relevant student/event in their props — no
template here should accept or render a list of other students' data.

**7. No shared Supabase client wired in, no real send path — deliberate scope.** Each template is a
pure function of its own typed props (recipient name, event/session details, dates) with an
obviously-fake fixture example in its own test file — same posture as every prior content-page task,
adapted to email templates instead of React pages.

## Acceptance Criteria
- All five templates exist, each producing `bodyHtml`/`previewText` consumable by
  `renderEmailLayout()`.
- BEH-08 date/duration rendering (weekday names, computed durations) used wherever a template shows
  a date/time.
- DES-14 copy voice followed; BEH-09 "what happens next" framing present where applicable.
- No other-student data leakage (EML-05) in any template's rendered output.
- All dynamic interpolation escaped.
- No box-drawing/bracket characters (constitution item 13).
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` all exit 0.

## Relevant Constitution Excerpts
> 9. Dependencies are limited to the allowlist; a new dependency not on it requires a disclosed
> dispute, not silent addition. *(Cited because Trap #1 turns on this exact rule — a JSX-based email
> renderer is not on the allowlist.)*

## Most Recent Failure
None. This is attempt 1 for T049 (attempt count: 0).

## Required Worker Output
- Full contents of all five template files.
- Explicit write-up of your Trap #1 decision (plain-TS-with-.tsx-extension vs. real JSX) and why.
- Explicit note that `inviteFixtureBody.ts` was left untouched and why (Dependencies section).
- Real test proof for each template: renders correctly, escapes dynamic content, matches EML-02's
  recipient framing.
- `npm run build`/`typecheck`/`lint`/`format:check`/`test` output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
