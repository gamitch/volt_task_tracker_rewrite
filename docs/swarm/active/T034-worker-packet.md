# Worker Packet: T034

## Task ID
T034

## Objective
Build the Kiosk view at `src/pages/meetings/Kiosk.tsx` (MTG-07): a fullscreen display (shop TV/iPad) showing a rotating QR code + 6-character short code + a live tally ("12 of 18 checked in"). **No student names or any other PII may render on this screen** — it is a public-facing shared display.

## Dependencies (status)
- T032 (`checkin` Edge Function) — Passed. Defines the exact HMAC token/short-code derivation scheme this screen must reproduce for *display* purposes (it does not call `checkin` itself — that's what a scanning student's device does). Read `supabase/functions/checkin/hmac.ts` yourself (read-only reference) before starting; the full scheme is documented in its header comment and reproduced in Ground Truth below.
- Router: `/kiosk/:sessionId` is **already wired and role-guarded** in `src/app/router.tsx` (`RequireAuth` + `RequireRole(['coach','admin'])`, T005/T007, both Passed) — unlike T018/T035, there is no router-wiring gap for you to flag here. Confirm this yourself by reading the route table (read-only) before starting, but do not edit `router.tsx`.

## Allowed Files
- `src/pages/meetings/Kiosk.tsx` (new file — confirm via `Glob` that `src/pages/meetings/` doesn't exist yet).

## Forbidden Files
- `src/app/router.tsx`, `src/app/guards.tsx`, `src/app/AppShell.tsx`, `src/components/nav/**`.
- `supabase/functions/checkin/**` — **you may read this directory for reference but must not modify it.** See the critical architecture gap below — do not attempt to add a token-minting capability to `checkin` yourself; it is out of your Allowed Files.
- `supabase/migrations/**`.
- `docs/swarm/**`, `.claude/**`.

## CRITICAL Known Context / Trap — there is currently no safe way to mint a display token client-side, and no endpoint exists to mint one server-side either

Read this before writing any QR-generation code.

The QR code and short code this screen must display are HMAC-SHA256 outputs keyed by `CHECKIN_HMAC_SECRET` (PRD MTG-06; exact scheme in `supabase/functions/checkin/hmac.ts`). **`CHECKIN_HMAC_SECRET` may never appear in frontend code or any client bundle — this is constitution item 5, BLOCKER-class, no exceptions.** That means this page **cannot** compute `tokenFor(secret, sessionId, bucket)` / `shortCodeFor(secret, sessionId, bucket)` itself, because doing so would require the secret to exist in `src/`.

The `checkin` Edge Function (T032, already built) only **validates** a presented token/code — it has no endpoint that **mints/returns** the current token or short code for a given `sessionId`. There is currently **no Edge Function anywhere in the repo** that can safely hand this screen a display-ready token/code without exposing the secret. This is a genuine, unresolved infrastructure gap, not something solvable within `src/pages/meetings/Kiosk.tsx` alone (a new/extended Edge Function would be needed, and Edge Functions are outside this task's Allowed Files).

**What to do about it — do not silently invent a workaround:**
1. Build the complete, real UI: layout, the QR-code rendering component (using `qrcode.react`, the allowlisted dependency per constitution item 9 — do **not** hand-roll QR encoding), the short-code display, the `aria-live="polite"` tally region, and the ~45s client-side refresh cadence (MTG-06), against a clearly-named, obviously-a-placeholder **data-fetching seam** — e.g. a typed function/hook like `useKioskDisplayToken(sessionId): { qrUrl: string; shortCode: string; refreshesInSeconds: number } | null` whose real implementation would call a not-yet-built minting endpoint. Do not fabricate a fake HTTP call to a nonexistent URL and call it done; make the seam's placeholder-ness explicit (e.g. return clearly-fixture-labeled data from a local stub, or throw/return null with a visible "not wired yet" note in a dev-only render path — your call how to make this obviously provisional, just don't make it look production-real).
2. Build the live tally the same way: a `useKioskTally(sessionId): { checkedIn: number; expected: number } | null` seam. Note the RLS reality here too: `attendance` RLS is `staff_all` (full access) + `own_or_linked_read` (own rows only) — since this route is coach/admin-only, a real implementation *could* legitimately read a full per-session count once a real Supabase client exists (no RLS gap on this specific screen, unlike T035's tally problem) — but no shared Supabase client exists in `src/` anywhere yet (confirmed via grep, zero hits for `createClient`/`supabase-js` under `src/`), so you still cannot wire this live today. State this distinction explicitly in your output (Kiosk's tally is an RLS-clean read blocked only by "no shared client exists yet"; the token-minting problem in point 1 is a deeper architecture gap blocked by "no safe endpoint exists at all").
3. Flag both gaps explicitly and distinctly in your Required Worker Output as dispute candidates for the foreman/boss to schedule (most likely: a small new/extended Edge Function for token minting, and a separate shared-Supabase-client task that several Ready/Blocked tasks — T034, T035, T056, and eventually T033/T053-T060 — all need). Recommend, don't decide.

## Ground Truth — HMAC derivation scheme (verbatim from `supabase/functions/checkin/hmac.ts`'s header comment; do not re-derive independently, cite this exact scheme in your output so a future minting endpoint matches)
- Time bucket: `bucket = floor(unixSeconds / 60)`.
- QR token: first 16 bytes of `HMAC-SHA256(CHECKIN_HMAC_SECRET, "${sessionId}:${bucket}")`, lower-case hex (32 chars).
- Short code: bytes [16..22) of the *same* digest, each mapped via `byte % 34` into alphabet `ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789` (6 uppercase chars).
- QR encodes `https://portal.voltfrc.org/checkin?s=<sessionId>&t=<token>` (MTG-06).
- Client-side refresh cadence: ~45 seconds (independent of the 60s server-side bucket — this is a display refresh, not a security boundary; the server accepts the current and previous bucket regardless of when the display last refreshed).

## Acceptance Criteria
- **BLOCKER-class (constitution item 5 / SEC-04 / constitution item 6):** zero PII anywhere in the rendered DOM — no student names, no email addresses, nothing beyond the session title, QR, short code, and a numeric tally. Prove this with a real DOM grep/scan against your rendered output, not just a visual screenshot (a checker will independently re-derive this).
- `CHECKIN_HMAC_SECRET` does not appear anywhere in `src/` (grep-provable) — confirms the architecture-gap handling above didn't leak the secret in as a shortcut.
- `aria-live="polite"` on the tally region (DES-17/MTG-07).
- QR/code refresh cadence is ~45s and is clearly implemented (even against the placeholder seam — the *cadence logic* itself is real and testable independent of where the data ultimately comes from).
- `qrcode.react` used for QR rendering (constitution item 9 dependency allowlist) — no hand-built QR encoding.
- Both open architecture gaps (token-minting endpoint; shared Supabase client) explicitly flagged per the Known Context/Traps section above.
- Astryx component props (for layout/typography/`Section`/`Card` etc., whatever you use) cross-checked against `docs/swarm/astryx-api.md` directly (constitution item 2).
- `npm run build`/`typecheck`/`lint` all exit 0.

## Relevant Constitution Excerpts
> 5. No secrets in the repo: `.env*` gitignored; service-role keys never appear in frontend code or client bundles → BLOCKER. *(Applies equally to `CHECKIN_HMAC_SECRET` per SEC-03's "lives only in Supabase Edge Function secrets" — this is the load-bearing rule behind the entire Known Context/Traps section above.)*

> 6. No PII (student names, emails) in logs, URLs, analytics, commit messages, or test fixtures... Kiosk and public leaderboard surfaces follow PRD SEC-04/ROS-08 → BLOCKER.

> 9. Dependency allowlist: `@astryxdesign/*`, `@supabase/supabase-js`, `@tanstack/react-query`, `react-router-dom`, `qrcode.react`, `ical-generator`...

> 2. Astryx component props come **only** from `docs/swarm/astryx-api.md`. A prop absent from that file is presumed hallucinated → MAJOR.

## PRD Ground Truth (verbatim)
> **MTG-06 Rotating code:** "QR encodes `https://portal.voltfrc.org/checkin?s=<sessionId>&t=<token>`; alongside it a 6-character A–Z/2–9 short code... QR/code refresh client-side every 45 s."

> **MTG-07 Kiosk view** `/kiosk/:sessionId`: "fullscreen QR + short code + live tally ('12 of 18 checked in'), meant for a shop TV/iPad on the coach's session. No roster names shown (privacy)."

> 7.1 wireframe (structural intent only, do not render box-drawing characters):
> ```
> Tuesday Build Meeting
> [QR (rotates ~45s)]   Check in: code 7F4K29 (refreshes ~45s)
> 12 of 18 checked in   <- aria-live tally
> No student names on this screen.
> ```

## Most Recent Failure
None. This is attempt 1 for T034 (attempt count: 0).

## Required Worker Output
- Full contents of `Kiosk.tsx` (and any subcomponents).
- Explicit citation of the HMAC scheme you designed the QR/short-code display against (must match `hmac.ts` exactly, even though you cannot execute it directly).
- Explicit, clearly-separated flags for both architecture gaps (token-minting endpoint; shared Supabase client for the tally), each with your recommendation on how it should be scheduled.
- DOM grep/scan output proving zero PII rendered.
- Grep output proving `CHECKIN_HMAC_SECRET` (or any secret) does not appear in `src/`.
- Confirmation `aria-live="polite"` is present on the tally region.
- Confirmation of the ~45s refresh cadence implementation.
- Astryx prop-by-prop citations.
- `npm run build`/`typecheck`/`lint` output.
- Known risks; whether a dispute is needed.
