# Checker Packet: T034 (Kiosk view `/kiosk/:sessionId`) — Check Attempt 1

## Task ID
T034 — Kiosk view `/kiosk/:sessionId` (MTG-07), Epic E5.

## Checker Agent
checker-accessibility (per task-ledger.md T034 row).

## Objective
Verify a fullscreen kiosk screen: QR + short code + live tally, zero PII, `aria-live` tally,
~45s client refresh — nothing more.

## Allowed Files (worker's only permitted edit)
- `src/pages/meetings/Kiosk.tsx` (new)

Worker also touched `package.json`/`package-lock.json` (added `qrcode.react@^4.2.0`, an
allowlisted dependency per constitution item 9) and self-flagged this as outside its literal
Allowed Files list, required by the packet's own explicit instruction to use `qrcode.react` and by
the build/typecheck/lint-exit-0 acceptance criterion. Judge whether this is in-scope (mechanical,
necessary, minimal, allowlisted dependency) or a forbidden-file violation. Do not treat the
pre-existing "WIP snapshot" commit (`c7103f5`, made by me/harness, not the worker) as evidence one
way or the other — judge the dependency addition on its own merits.

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual current file tree / git diff for this task's
commit (`dc7aa52`) — do NOT infer authorship from commit messages or git history narrative.
Confirm no other file was created/modified by this task's commit beyond `Kiosk.tsx`.

## Worker's Claimed Changes (do not trust — verify independently)
1. `KioskPage` (default + named export): `Center` > `VStack` with two standing `Banner`s (one per
   flagged architecture gap), a `Heading`, `HStack` with `QRCodeSVG` (from `qrcode.react`) + short
   code, an `aria-live="polite"` tally region, and a "No student names are shown on this screen"
   disclosure.
2. Three ~45s-polling data seams (`useKioskDisplayToken`, `useKioskTally`, `useKioskSessionTitle`),
   each with an injectable loader prop defaulting to explicitly-fake/placeholder data (mirrors the
   T020 `loadData` prop-injection precedent).
3. HMAC/QR-URL scheme cited from `supabase/functions/checkin/hmac.ts` (read-only): bucket =
   floor(unixSeconds/60); token = first 16 bytes hex of HMAC-SHA256(secret, "sessionId:bucket");
   short code = bytes[16..22) mapped via `byte % 34` into `ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789`;
   QR encodes `https://portal.voltfrc.org/checkin?s=<sessionId>&t=<token>`.
4. **GAP #1 flagged**: no Edge Function exists to mint a display token; `CHECKIN_HMAC_SECRET`
   correctly never appears in `src/`. Default loader ships obviously-fake fixture data
   (`FIXTURE-NOT-A-REAL-CHECKIN-TOKEN`, short code `PLACEH`) plus a permanent warning `Banner`.
5. **GAP #2 flagged**: no shared Supabase client exists in `src/` at all (grep-confirmed zero
   `createClient`/`supabase-js` hits). `useKioskTally`/`useKioskSessionTitle` default to `null`
   ("not wired") rather than fabricating plausible numbers.
6. Claims a real DOM render/scan (vitest+jsdom) of both populated and "not wired" states found:
   zero PII sentinels, `aria-live="polite"` present verbatim, a real `<svg>` with actual QR module
   paths (not a static image/hand-rolled encoding), `CHECKIN_HMAC_SECRET` absent, tally text
   "12 of 18 checked in" / "Live count not available yet", short codes `AB3XQ9` / `PLACEH`, and the
   "No student names are shown" disclosure always present. Test file was temporary, deleted after.
7. Claims `npm run typecheck`/`lint`/`build` all exit 0 for this file **in isolation** via a
   temporary `git worktree` — NOT via the shared working tree, because concurrent workers'
   in-progress files (T035's `CheckinResult.tsx` specifically) currently break repo-root commands.
8. Confirms (read-only) `router.tsx`'s `/kiosk/:sessionId` role guard
   (`RequireAuth`+`RequireRole(['coach','admin'])`) is already correct, but the route still renders
   `router.tsx`'s own inline placeholder — `Kiosk.tsx` is not yet wired in. Same reachability gap
   pattern as T021/`RosterShell`. Editing `router.tsx` is forbidden here.

## Required Verification Steps
1. **Read `Kiosk.tsx` in full** — do not rely on the worker's module doc or this packet's
   paraphrasing.
2. **Zero PII — BLOCKER if violated (constitution item 6 / SEC-04).** Grep the file yourself for
   any name-shaped field, any fixture that looks like a real student name/email, any prop that
   could plausibly carry PII. Confirm the disclosure copy is present and accurate.
3. **Re-derive the HMAC/QR scheme claim yourself.** Open `supabase/functions/checkin/hmac.ts`
   (read-only) and confirm the bucket/token/short-code/URL scheme is reproduced correctly in
   `Kiosk.tsx`'s comments and `buildCheckinUrl()`-equivalent logic — do not accept the worker's
   citation without re-reading the source.
4. **`aria-live="polite"` — confirm by direct source read**, not just trusting the worker's grep
   claim. Confirm it's on the correct element (the tally region) and would actually be announced
   (not nested inside something that strips ARIA semantics).
5. **QR rendering — confirm `qrcode.react`'s `QRCodeSVG` is genuinely used**, not a fake/static SVG
   standing in for a real QR code. Render it yourself if feasible (vitest+jsdom or a quick script)
   and confirm real QR module-path output appears.
6. **~45s refresh cadence — confirm by source read** (`KIOSK_REFRESH_INTERVAL_MS` or equivalent,
   and that it's wired to a real `setInterval`/polling hook, not decorative).
7. **`package.json`/`package-lock.json` dependency addition** — confirm `qrcode.react@^4.2.0`
   matches constitution item 9's allowlist. Decide: in-scope mechanical necessity, or forbidden-
   file violation requiring rework? State your reasoning explicitly either way.
8. **Astryx prop citations** — spot-check `Center`, `VStack`/`HStack`, `Heading`, `Banner` against
   `astryx-api.md` (grep, don't read the whole file) for the props actually used in `Kiosk.tsx`.
9. **Build/typecheck/lint** — reproduce independently. If the shared working tree is genuinely
   broken by concurrent workers' unrelated in-progress files, use the same isolated-worktree
   technique the worker describes (or your own equivalent) to verify `Kiosk.tsx` alone is clean —
   state clearly which method you used and why.
10. **Router reachability gap** — confirm by reading `router.tsx` that this is real and correctly
    out of scope for this task (matches the T021 precedent), not something the worker should have
    fixed here.

## Relevant Constitution Excerpts
- Item 6: zero PII on kiosk/public-facing surfaces — BLOCKER if violated.
- Item 5: no secrets in frontend bundles — `CHECKIN_HMAC_SECRET` must never appear in `src/`.
- Item 9: dependency allowlist — `qrcode.react` is allowlisted; confirm nothing else was added.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read output, not paraphrase)
- commands run
- exact findings
- explicit verdict on the `package.json` scope question
- explicit verdict on whether GAP #1/#2 need a dispute filed, or are correctly deferred as
  follow-up tasks
- required rework if failed
- follow-up tasks if passed with minor issues
