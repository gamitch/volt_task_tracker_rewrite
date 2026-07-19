# Worker Packet: T051

## Task ID
T051 — `send-reminders` Edge Function + `pg_cron` + dedupe (EML-03), Epic E8.

## Objective
Build `supabase/functions/send-reminders/**` plus a `supabase/migrations/<timestamp>_cron.sql`
migration: a `pg_cron` job every 15 minutes invokes the Edge Function, which selects due sessions,
expands recipients, filters by `notification_prefs`, dedupes against `email_log` (never the same
template+session+recipient twice), and batches sends to Resend.

## Dependencies (status)
- T048 (Resend integration + branded layout) — Passed. **Read `supabase/functions/send-invite/resend.ts`
  and `email_log.ts` in full (read-only)** — `resend.ts`'s `resolveSendMode()`/`sendBrandedEmail()`
  is the established constitution-item-7 test-mode gate (plain `fetch`, not the `resend` npm
  package, since that package isn't allowlisted); `email_log.ts` establishes the real
  `email_log` write shape. This task cannot import from `send-invite/**` (see Forbidden Files) —
  independently reimplement the same fetch-based Resend client and gate logic in this function's
  own directory, matching the established design exactly (same fail-closed `RESEND_SEND_MODE`
  gate, same env-var names) rather than inventing a different one.
- T049, T050 (email templates) — Passed. Read `src/emails/templates/*.tsx` (read-only) — each
  exports a `build*BodyHtml`/`build*PreviewText` pair consumable by `renderEmailLayout()`
  (`src/emails/layout/renderEmailLayout.ts`, also read-only reference — this Deno function CAN
  import it directly via the same cross-directory relative-import pattern `send-invite/index.ts`
  already established and uses in production, reaching from `supabase/functions/X/` up to
  `src/emails/layout/**`/`src/emails/templates/**`).
- T011 (support/audit migration) — Passed. Ground truth for `notification_prefs`/`email_log`, see
  below.

## Allowed Files
- `supabase/functions/send-reminders/**` (new directory)
- `supabase/migrations/<timestamp>_cron.sql` (new, additive-only — enables `pg_cron` and schedules
  the job; must NOT alter any existing table/column)

## Forbidden Files
- `supabase/functions/send-invite/**`, `checkin/**` — read-only reference only, do not edit or
  import from directly (reimplement the Resend client independently in your own directory, per
  Dependencies above).
- `src/emails/layout/**`, `src/emails/templates/**` — read-only reference only; IMPORTING from
  these (not editing) is explicitly permitted and expected, matching `send-invite/index.ts`'s own
  precedent for `src/emails/layout/**`.
- `src/pages/**` — no frontend work in this task.
- `supabase/migrations/2026071*` (all pre-existing migration files) — read-only, do not edit.
- `docs/swarm/**`, `.claude/**`, `src/theme/**`.

## Ground Truth — real schema (read the actual files yourself, do not guess column names)
- `notification_prefs`: `id`, `profile_id` (fk, unique), `invite`, `signup_confirm`,
  `event_reminder_48h`, `event_reminder_3h`, `meeting_reminder_3h`, `weekly_digest`,
  `digest_enabled` (all boolean, default true) — `20260717000001_support_audit.sql` lines 26-41.
- `email_log`: `id`, `to_email`, `template` (text), `session_id` (nullable, NO fk constraint —
  deliberately, per that migration's own design note, so log rows survive session deletion),
  `profile_id` (nullable, same reasoning), `status` (text, unconstrained), `sent_at` —
  same migration, lines 62-73.
- `event_sessions`: `starts_at`, `status` — `20260717000000_scheduling_attendance.sql`.
- `events`: `type`, `title`, `team_ids` — same migration.
- `rsvps`: `session_id`, `student_id`, `status='going'` — same migration (recipient expansion for
  outreach/competition reminders is `going`-RSVP'd students only, per EML-02's own table: "`going`
  students + their parents").
- `guardian_links`: `parent_profile_id`, `student_id` — `20260716000000_identity_roster.sql`
  (parent recipient expansion).

## Known Context / Traps

**1. Dedupe is a correctness requirement, not an optimization (constitution item 7's own explicit
framing) — the central safety property of this task.** Before sending ANY reminder, query
`email_log` for an existing row matching `(template, session_id, to_email)` (or `profile_id`,
whichever you use as the recipient key — disclose and be consistent) with a `status` indicating a
successful/attempted send, and skip sending if found. This must hold even if the cron job runs
twice in the same 15-minute window for the same due session (e.g. a retry, a clock skew, an
overlapping invocation) — write a real test that invokes your dedupe-check-then-send logic twice
for the identical (template, session, recipient) tuple and asserts exactly one `email_log` row/one
send attempt results, not two.

**2. "Selects due sessions" — define your own due-window logic per template, cited from EML-02's
own trigger column, don't invent different thresholds.** `event-reminder-48h`: sessions whose
`starts_at` falls within [48h, 48h+15min) from now (the cron's own 15-minute cadence is your
natural window granularity — a session becomes "due" for a given template exactly once per that
window, which the dedupe check backs up as a second line of defense). `event-reminder-3h`: same
shape at the 3h mark. `meeting-reminder-3h`: same shape, 3h mark, meeting-type events only.
`weekly-digest` is EXPLICITLY OUT OF SCOPE for a per-session due-window (it is a whole-Sunday-5pm-CT
batch job across ALL of a parent's linked students, not a per-session reminder) — disclose this
clearly: implement it as a separate, simpler "is it currently within 15 minutes after Sunday 5pm
CT" check that fires once per profile per week, or explicitly flag it as a dispute candidate/
follow-up if you judge it out of this task's practical scope given the packet's Allowed Files.
`invite`/`signup-confirm` are NOT this function's job at all (those fire at their own trigger events
— T017's `send-invite` and a real-time RSVP-write path respectively — not on a cron schedule); do
not include them in the due-session query.

**3. Recipient expansion + `notification_prefs` filtering — two distinct steps, don't conflate
them.** First expand WHO is in scope for a due session/template (e.g. `event-reminder-48h` →
`going`-RSVP'd students for that session + each of THEIR linked parents via `guardian_links`;
`meeting-reminder-3h` → students in the session's team scope, per EML-02's own "students in scope"
wording — no parent expansion for this one, matching T049's own already-Passed template's
deliberate no-parent-branching design). THEN, for each expanded recipient, check their own
`notification_prefs` row for the matching boolean column (`event_reminder_48h`,
`meeting_reminder_3h`, etc.) — skip sending to anyone whose relevant preference is `false`. A
recipient with no `notification_prefs` row at all should default to sending (the column's own
`default true`, i.e., absence of an explicit opt-out) — cite this reasoning explicitly.

**4. `pg_cron` migration — additive only, and this is the FIRST task in the whole project to touch
`pg_cron`/scheduling infrastructure; investigate the real Supabase/Postgres `pg_cron` extension API
yourself rather than guessing syntax.** A `create extension if not exists pg_cron;` (if not already
enabled — check whether it needs enabling at all, or is preinstalled on Supabase's platform,
disclose your finding) plus a `select cron.schedule(...)` call invoking the Edge Function on a
15-minute cadence. Supabase's own documented pattern for invoking an Edge Function from `pg_cron`
typically goes through `pg_net`'s `net.http_post` targeting the function's URL with a service-role
bearer token — investigate and cite the real, current mechanism (you may not have live network
access to verify against a real Supabase project in this sandbox, same class of External Blocker
already documented for T017/T032/T048 — disclose this explicitly rather than fabricating an
unverified claim as certain).

**5. Batching to Resend — reuse T048's fail-closed test-mode gate exactly, reimplemented in this
function's own directory (Forbidden Files bars importing `send-invite/resend.ts` directly).** Every
send must go through the same `resolveSendMode()`-gated path — outside `RESEND_SEND_MODE=
'production'`, zero real network calls to `api.resend.com`, same as every other email-sending path
in this codebase. This is BLOCKER-class (constitution item 7) if violated.

**6. Every send (successful or not) writes a real `email_log` row**, same shape T048 established —
this is also how the dedupe check in Trap #1 has something to query against.

## Acceptance Criteria
- Dedupe genuinely prevents a duplicate send for the same (template, session, recipient) tuple,
  proven with a real re-run test.
- Due-session selection logic correct per template's own trigger timing (48h/3h/3h), with
  `weekly-digest`'s out-of-scope-for-per-session-logic status explicitly disclosed.
- Recipient expansion and `notification_prefs` filtering are two distinct, correctly-ordered steps.
- `pg_cron` migration is additive-only and its real invocation mechanism is investigated and cited
  (not guessed), with any unverifiable-in-sandbox claims explicitly flagged.
- Every send goes through the same fail-closed `RESEND_SEND_MODE` gate as T048 (BLOCKER if
  violated).
- `SUPABASE_SERVICE_ROLE_KEY`/`RESEND_API_KEY` read only via `Deno.env.get` (constitution item 5,
  BLOCKER if violated).
- `npm run build`/`typecheck`/`lint`/`test` all exit 0 for this function.

## Relevant Constitution Excerpts
> 7. Test-mode-only sending until T052's human sign-off; production requires explicit gate. →
> BLOCKER if violated. *(Cited because dedupe AND the send-mode gate are both explicitly named
> correctness requirements, not optimizations, in this exact task's own PRD text.)*

> 5. No secrets/service-role keys hardcoded anywhere. → BLOCKER if violated.

> 10. Database changes are additive migrations only. *(Cited for the new `_cron.sql` migration —
> must not alter any existing table.)*

## Most Recent Failure
None. This is attempt 1 for T051 (attempt count: 0).

## Required Worker Output
- Full contents of every file under `supabase/functions/send-reminders/**` and the new
  `_cron.sql` migration.
- Explicit write-up of the dedupe key/logic and its real re-run test proof.
- Explicit write-up of the due-window logic per template and the `weekly-digest` scope disclosure.
- Explicit write-up of the `pg_cron`/`pg_net` invocation mechanism investigation, with any
  unverified claims clearly flagged as such.
- Real test proof: dedupe re-run, per-template due-window boundary, notification_prefs filtering
  (opted-out recipient skipped, no-row recipient defaults to sent), test-mode gate never reaching
  `api.resend.com` outside production mode.
- `npm run build`/`typecheck`/`lint`/`test` output.
- Known risks; whether a dispute is needed (you flag, you don't resolve).
