# Worker Packet: T048

## Task ID
T048

## Objective
Build the shared branded email layout (EML-01: wordmark, violet accent, footer with a manage-preferences link) under `src/emails/layout/**`, and extend the already-Passed `send-invite` Edge Function (do **not** create a new function) to actually send that branded email via Resend and log every send to `email_log`. **This task must not cause any real email to reach a real inbox outside Resend's test mode — that is a BLOCKER-class constraint (constitution item 7), independent of and in addition to every other acceptance criterion below.**

## Dependencies (status)
- T017 (`send-invite` Edge Function) — Passed. Built the exact extension point this task plugs into. Read `supabase/functions/send-invite/index.ts` yourself (you will edit it, so read the whole file, not just the excerpt below) — its own header comment and its `EXTENSION POINT` comment (immediately before the final `return jsonResponse(201, ...)`) were written specifically to hand off to this task. Reproduced verbatim below so you don't have to re-derive it.

## Allowed Files
- `src/emails/layout/**` (new directory — confirm via `Glob` it doesn't exist yet).
- `supabase/functions/send-invite/**` (existing directory from T017 — **extend, do not create a new function**; you may add new files inside this directory, e.g. a `resend.ts` client helper or an `email_log.ts` write helper, alongside editing `index.ts` at its marked extension point).

## Forbidden Files
- Any other `supabase/functions/**` directory (e.g. `checkin/`, `ics/` don't exist yet, but this task's Allowed Files are scoped to `send-invite` only — do not touch `supabase/functions/checkin/**`).
- `supabase/migrations/**` — the `email_log` table already exists (T011, Passed); do not alter its schema. See Ground Truth below for its exact columns.
- `src/emails/templates/**` — that directory (and the actual per-template content: invite, signup-confirm, etc.) is **T049's** job, not yours. You build the *shared layout wrapper*, not the invite template's own content. If your layout needs a minimal illustrative "invite" body to prove the layout renders end-to-end, keep it clearly scoped as the layout's own test fixture, not a real T049 deliverable — flag this distinction explicitly in your output.
- `docs/swarm/**`, `.claude/**`.

## Ground Truth — the exact T017 extension point (verbatim from `supabase/functions/send-invite/index.ts`, immediately before the function's final `return`)
```ts
  // EXTENSION POINT for T048 ("Resend integration + branded layout +
  // email_log"; depends on T017; Allowed Files include "wiring in
  // supabase/functions/send-invite/** (extend, not new function)"):
  // `inviteUserByEmail` has just succeeded and Supabase's own default invite
  // email is already on its way. T048 adds, right here, before the response
  // below:
  //   1. A branded Resend send (template='invite') using `RESEND_API_KEY`
  //      (SEC-03: lives only in Supabase Edge Function secrets, never in src/).
  //   2. An `email_log` insert recording template/recipient/invite_id, per
  //      EML-03's "dedupe against email_log" requirement for the reminder
  //      pipeline (send-invite itself is not on a cron, but should still log
  //      consistently once T048 defines that table's write contract).
  // Nothing below this comment should need to change for that extension.

  return jsonResponse(201, {
    invite: { id: invite.id, email: invite.email, role: invite.role, student_id: invite.student_id,
      status: invite.status, expires_at: invite.expires_at, created_at: invite.created_at },
  });
```
The function already has: an `adminClient` (service-role, in scope at that point), the just-inserted `invite` row (`id`, `email`, `role`, `student_id`, `status`, `expires_at`, `created_at`), and `callerProfile.id`. Insert your Resend call + `email_log` write between the extension-point comment and the final `return`. Do not change anything above that point in the file (T017's existing authorization/validation/insert logic is already Passed and out of scope).

## Ground Truth — `email_log` table (read directly from `supabase/migrations/20260717000001_support_audit.sql`, do not guess)
```sql
create table public.email_log (
  id uuid primary key default gen_random_uuid(),
  to_email text not null,
  template text not null,
  session_id uuid,        -- nullable, no FK (deliberate — see migration's own design note)
  profile_id uuid,         -- nullable, no FK (deliberate — see migration's own design note)
  status text not null,    -- unconstrained text; no check constraint (no enumerated vocabulary given anywhere available to this task)
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
```
RLS on `email_log` (from `20260717000002_rls.sql`): `staff_read` only (admin/coach can read; there is **no** insert policy for any authenticated role — "Populated exclusively by future service-role Edge Functions, which bypass RLS as table owner"). This confirms your `email_log` insert must go through the same service-role `adminClient` already in scope at the extension point — it will bypass RLS as intended, this is not a gap, it's the designed mechanism.

**`status` has no enumerated vocabulary in any excerpt available to this task or prior migrations.** Choose a small, clear vocabulary (e.g. `'sent'`, `'failed'`, `'skipped_test_mode'` — see the test-mode requirement below for why a third value may be useful) and state your choice explicitly in your output, since T050/T051 (weekly digest, reminders — both currently Blocked, depend on this table too) will need to interoperate with whatever vocabulary you pick.

## CRITICAL — Constitution item 7 (BLOCKER-class): test-mode-only sending

> "No email sends outside Resend test mode until E8's checker approves production sending; reminder dedupe per PRD EML-03 is a correctness requirement, not an optimization." (constitution item 7)

> "**Test-mode sending only; production requires T052 sign-off (constitution item 7).**" (this task's own ledger row, E8)

**No prior task and no PRD excerpt available to this packet defines a single canonical mechanism for "Resend test mode."** This is a real ambiguity you must resolve deliberately, not guess past. You must implement an explicit, code-level gate that makes it structurally impossible for this task's work to cause a real email to land in a real recipient's inbox before T052 (the human gate — "George reviews T048–T051 test-mode output and approves flipping Resend out of test mode," currently Blocked) grants sign-off. Concretely, at minimum:
1. Read the actual `resend` npm/Deno package (or call Resend's HTTP API directly via `fetch` — either is fine, state which you used and why, similar to how T017 documented its `npm:@supabase/supabase-js@2` import choice) and determine what mechanisms Resend itself offers for safe non-production testing (e.g. sending only to Resend's own documented test/sandbox recipient addresses, or a test-mode API key if your research finds one exists). Cite what you found.
2. **Regardless of what Resend's own mechanism offers**, add your own defense-in-depth application-level gate: an explicit environment variable (e.g. `RESEND_SEND_MODE`, defaulting to `'test'` when unset or any value other than an explicit `'production'`) that this function reads via `Deno.env.get(...)` (never hardcoded, never client-supplied) and checks **before** ever calling Resend's send API. When not in production mode, either (a) route the send to a Resend-documented test-only recipient/mechanism instead of the real invitee email, or (b) skip the actual Resend API call entirely and write an `email_log` row with a status that makes this explicit (e.g. `'skipped_test_mode'`) — your call which, document it clearly. **Flipping this gate to allow real production sends is explicitly NOT your decision to make** — do not implement a code path that defaults to or silently allows production sending; state plainly in your output that enabling real sends is T052's job (a human sign-off task), not something this task activates.
3. Prove this gate cannot be bypassed by a caller-supplied value — the send-invite function's own request body (email/role/student_id) must have zero influence over which Resend mode is used.

If you have any doubt about whether your design satisfies this constraint, flag it explicitly as a dispute candidate rather than shipping something ambiguous — this is the single highest-severity acceptance criterion in this task (BLOCKER-class, same tier as a secret leak).

## Known Context / Traps

**1. `RESEND_API_KEY` handling** mirrors `CHECKIN_HMAC_SECRET`/`SUPABASE_SERVICE_ROLE_KEY` exactly (SEC-03, constitution item 5): read only via `Deno.env.get('RESEND_API_KEY')`, never hardcoded, never logged, never echoed in any response body.

**2. Dependency allowlist (constitution item 9).** `resend` (the npm package) is **not** on the explicit allowlist (`@astryxdesign/*`, `@supabase/supabase-js`, `@tanstack/react-query`, `react-router-dom`, `qrcode.react`, `ical-generator`, plus dev tooling). You have two defensible options: (a) call Resend's HTTP API directly via `fetch` (no new dependency needed at all — Deno's runtime `fetch` is built in), or (b) request boss-architect approval to add `resend` to the allowlist (constitution item 9's own escalation path) before importing it. Given `ical-generator`'s allowlisting was specifically because hand-rolling ICS is a checker BLOCKER (CAL-04) — a materially different, format-correctness risk than a simple JSON POST to Resend's send endpoint — a plain `fetch` call is very likely the lower-risk, no-approval-needed path. State explicitly which you chose and why; if you chose to add a dependency, flag the constitution item 9 approval requirement explicitly as unresolved rather than silently proceeding as if it were pre-approved.

**3. `src/emails/layout/**` cannot itself execute inside a Deno Edge Function.** Your shared branded layout is presumably React/TSX (email templates are commonly built with a React-based renderer, e.g. `@react-email/*`-style patterns) to be reused by T049/T050's future templates — but the actual HTML string that gets sent via Resend from inside `supabase/functions/send-invite/index.ts` (a Deno runtime) needs to be renderable/importable from that Deno context, or you need a build step that produces static HTML for the Edge Function to import/inline. Neither `@react-email/*` nor any HTML-email-rendering package is on the constitution item 9 allowlist. Decide and document explicitly how `src/emails/layout/**` (built for the `src/` frontend TS toolchain) actually gets used by the Deno-runtime `send-invite` function — e.g. a plain template-literal HTML string module with no React dependency at all (simplest, most likely to pass a checker's dependency-allowlist scrutiny), vs. some cross-runtime rendering scheme. If you conclude a genuinely clean solution requires a new dependency, flag it per point 2 above rather than silently adding one.

**4. EML-01's specific layout requirements**: VOLT wordmark, violet accent (`#5B2EE5` light / `#9B7BFF` dark — cite `src/theme/volt.ts`, read-only reference, do not import it directly into a Deno function; email HTML needs its own literal color values since it cannot load the Astryx theme provider), and a footer with a "manage preferences" link. EML-04 says this link should eventually point to `/settings#notifications` — that page doesn't exist yet (T060, Blocked), so use the literal path `/settings#notifications` as a forward-compatible link even though the route isn't live yet; state this explicitly.

## External Blocker — flag this explicitly, do not fabricate live verification
No live Supabase project and no live Resend send have been exercised anywhere in this repo yet (same category of blocker as T015/T017). You cannot prove a real branded email was actually delivered by Resend. What you can and must do: write structurally correct, secret-free, test-mode-gated code; unit-test the layout's HTML output (e.g. snapshot/string-contains assertions for wordmark/accent-color/footer-link presence) and the test-mode gating logic (assert Resend's real send path is never reached when the mode isn't explicitly `'production'`) without needing a live Resend account. If you can reach Resend's API from this sandbox in a genuinely safe test-only way (e.g. their documented test endpoint/recipient, if one exists per your research in the Constitution-item-7 section above), do so and report real output; otherwise state plainly what wasn't verifiable and why.

## Acceptance Criteria
- **BLOCKER-class (constitution item 7):** no code path in this task can cause a real email to reach a real recipient outside Resend's test mode before T052's sign-off — proven via the explicit gate design above, not merely asserted.
- **BLOCKER-class (constitution item 5):** `RESEND_API_KEY` never hardcoded/logged/echoed; read only via `Deno.env.get`.
- Every send (including test-mode-skipped sends, per your chosen `status` vocabulary) writes an `email_log` row (EML-01: "Every send logged to `email_log`").
- Shared branded layout under `src/emails/layout/**`: VOLT wordmark, violet accent, footer with a manage-preferences link (EML-01).
- Sender is `VOLT Robotics <notifications@mail.voltfrc.org>` (EML-01) — wherever this is set, source it from a single named constant, not inline duplicated strings, since T049/T050/T051 will all need the same value.
- Dependency choice (constitution item 9) explicitly justified per Known Context/Traps #2 and #3.
- T017's existing logic above the extension point is byte-unchanged (confirm via diff).
- `npm run build`/`typecheck`/`lint` all exit 0 for the `src/` portion; Deno-side tests (or a Node port, following T017/T032's established precedent when Deno/Docker aren't reachable in-sandbox) pass for the `supabase/functions/send-invite/**` portion.

## Relevant Constitution Excerpts
> 7. No email sends outside Resend test mode until E8's checker approves production sending; reminder dedupe per PRD EML-03 is a correctness requirement, not an optimization.

> 5. No secrets in the repo: `.env*` gitignored; service-role keys never appear in frontend code or client bundles → BLOCKER.

> 9. Dependency allowlist: `@astryxdesign/*`, `@supabase/supabase-js`, `@tanstack/react-query`, `react-router-dom`, `qrcode.react`, `ical-generator`, plus dev tooling. Anything else requires boss-architect approval recorded in the ledger.

> 6. No PII (student names, emails) in logs, URLs, analytics, commit messages, or test fixtures.

Non-Negotiable: "No worker may mark its own work complete." Every checker inspects the actual artifact.

## PRD Ground Truth (verbatim)
> **EML-01** "All email through Resend as `VOLT Robotics <notifications@mail.voltfrc.org>` — the `mail.voltfrc.org` subdomain is verified in Resend (SPF + DKIM + DMARC records added at the voltfrc.org DNS host); env `RESEND_API_KEY`. Shared branded layout (wordmark, violet accent, footer with manage-preferences link). Every send logged to `email_log`."

> **SEC-03** "`CHECKIN_HMAC_SECRET`, `RESEND_API_KEY` live only in Supabase Edge Function secrets."

> **T052 (ledger, E8 HUMAN GATE):** "George reviews T048–T051 test-mode output and approves flipping Resend out of test mode for `mail.voltfrc.org`... no automated checker may approve this."

## Most Recent Failure
None. This is attempt 1 for T048 (attempt count: 0).

## Required Worker Output
- Full contents of everything created under `src/emails/layout/**`.
- Diff of `supabase/functions/send-invite/index.ts` (and any new files added alongside it) — confirm everything above the extension-point comment is byte-unchanged.
- Explicit statement of your Resend-integration mechanism (`fetch` vs. a package) and dependency-allowlist reasoning (Known Context/Traps #2).
- Explicit statement of how `src/emails/layout/**` is actually consumed by the Deno `send-invite` function (Known Context/Traps #3).
- Explicit, detailed description of your test-mode gate design (the Constitution-item-7 section above) — this is the single most scrutinized part of this packet.
- Your chosen `email_log.status` vocabulary and why.
- Test output: layout HTML content assertions, test-mode-gate assertions (real send path unreachable outside explicit production mode), `email_log` row shape.
- Confirmation no `RESEND_API_KEY` literal appears anywhere (grep evidence).
- Known risks; whether a dispute is needed.
