# T177 — Worker Packet

**Pinned to branch tip `3b6ad0f` on `claude/swarm-plan-zl575z`** (`git log -1`
re-verified live this session; `main` remains `f7ff055`, unrelated). All
citations below were read directly at this SHA, not carried from the ledger
row, which itself discloses it was not re-verified this session.

**Attempt:** 1 of 3 (constitution Loop Limit — a 4th attempt escalates to
`boss-arbiter`). **Tier: `worker-implementer`, sonnet, worktree** — reasoning
in §8. **Checker: `checker-reviewer`, opus** — reasoning in §8.

## 1. Objective

`SubscribePopover.tsx` (mounted at the live, reachable `/settings` route —
confirmed in §3d, not assumed) shows every signed-in user a calendar
subscription link that is fake in two independent ways:

1. **The host is fake.** `functionsBaseUrl` defaults to
   `PLACEHOLDER_SUPABASE_FUNCTIONS_URL` (`SubscribePopover.tsx:483`, constant
   at `:379-380` = `'https://volt-placeholder-project.functions.supabase.co'`
   — a non-existent host).
2. **The token is fake.** `loadCalendarFeed` defaults to
   `defaultLoadCalendarFeed` (`:481`, body `:392-394`), which returns
   `FIXTURE_ACTIVE_FEED` (`:382-388`), a hardcoded fixture row — never a real
   `calendar_feeds` read.

`SettingsPage.tsx:1207` renders `<SubscribePopover profileId={profile.id} />`
— only `profileId` — so every real user who opens Settings and clicks
"Subscribe" or "Copy link" gets a URL that is dead on both axes: wrong host,
fabricated token.

**Fix both. `onResetFeedToken` is explicitly out of scope** — see §2/§6
criterion 10.

## 2. Allowed / forbidden files

**Allowed:**
- `src/pages/calendar/SubscribePopover.tsx`
- `src/pages/calendar/SubscribePopover.test.tsx`
- `src/lib/supabase/loaders/calendarFeed.ts` (new file)
- `src/lib/supabase/loaders/calendarFeed.test.ts` (new file)

**Forbidden, in addition to the constitution's standing list
(`docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`,
`dispute-log.md`, `.claude/**`, `node_modules/`):**
- `src/pages/settings/SettingsPage.tsx`, `SettingsPage.test.tsx` — **do not
  edit the call site.** §5 explains why the fix lives entirely inside
  `SubscribePopover.tsx`'s own defaults, not in what `SettingsPage.tsx`
  passes it. Zero diff expected here; the checker verifies this
  independently (item 23).
- `src/lib/supabase/client.ts`, `loader.ts`, `functions.ts` — read-only
  reference. Import from them; do not modify them.
- `src/lib/supabase/loaders/settings.ts` — read-only reference/pattern model
  (§5, §3c). Do not edit.
- `src/lib/supabase/types.ts`, `src/lib/supabase/index.ts` — read-only. Note
  for context, not action: `types.ts:409-415` already declares a
  `CalendarFeedRow` field-for-field identical to `SubscribePopover.tsx`'s own
  local one (`:300-308`). Per the precedent `loaders/students.ts`/
  `loaders/invites.ts` already set (page-local types kept as-is, not switched
  to the shared ones, their own "Trap #1" doc), keep using
  `SubscribePopover.tsx`'s own local `CalendarFeedRow` — do not import from
  `types.ts` or touch either file.
- `supabase/functions/ics/**`, `supabase/migrations/**` — already-deployed,
  read-only reference (§3a/§3e). Do not touch.
- Any `loaders/*.ts` file other than the new `calendarFeed.ts`.

## 3. What's already established — carry these, don't re-derive them

**(a) The real backend for this already exists and is deployed — you are
wiring the frontend to it, not designing a new contract.**
`supabase/functions/ics/index.ts` is a real, finished Edge Function (T047,
landed): service-role client only, no caller JWT (`:19-25`) — "the token
query parameter IS the entire credential" — resolved by
`.from('calendar_feeds').select('id, profile_id, revoked_at').eq('token',
token)` (`:110-113`), checking `revoked_at is null`. This is why
`invokeEdgeFunction` (`src/lib/supabase/functions.ts`) does **not** apply
here even though it's this repo's normal Edge-Function-calling convention:
`invokeEdgeFunction` requires an active Supabase session and attaches a
caller JWT (module doc `:1-17`) — but the ICS URL is fetched by an external
calendar app that never has a Supabase session at all. `buildIcsUrl`
(`SubscribePopover.tsx:340-343`, unchanged by this task) already builds the
right kind of artifact — a displayable URL, never invoked from this file.

**(b) The real Functions-base-URL convention is already established in this
repo, twice, independently — and it contradicts this file's own module doc.**
`SubscribePopover.tsx:104-105`'s doc assumed the legacy
`https://<project-ref>.functions.supabase.co` domain form. The two files that
already call a real deployed Edge Function do it differently, and agree with
each other: `CheckinResult.tsx:236,264` (`fetch(\`${supabaseUrl}/functions/v1/checkin\`,
...)`) and `StudentHome.tsx:167,546` (module doc citing the identical shape,
`POST {VITE_SUPABASE_URL}/functions/v1/checkin`) both build
`${VITE_SUPABASE_URL}/functions/v1/<name>` — no second env var, derived from
the one already committed to `.env.example` and already read by
`client.ts:66-74`. **Use this convention, not the one this file's own stale
doc assumed.** Concretely: `buildIcsUrl(base, token)` already appends
`/ics?token=...` to whatever base it's given (`:341-342`, unchanged) — so
passing `${VITE_SUPABASE_URL}/functions/v1` as `functionsBaseUrl` makes the
final URL `${VITE_SUPABASE_URL}/functions/v1/ics?token=...`, which is CAL-04's
own literal spec (module doc `:99-100`: "GET `/functions/v1/ics?token=<uuid>`")
satisfied exactly, with zero change needed to `buildIcsUrl` itself.

Each of `CheckinResult.tsx`/`StudentHome.tsx` independently re-implements its
own private `readViteEnvVar` rather than importing one shared helper
(`StudentHome.tsx`'s own module doc: "INDEPENDENTLY-AUTHORED... never
imported from... same envs"). Follow that established per-file convention:
add a small private `readViteEnvVar`/`resolveFunctionsBaseUrl` pair inside
`SubscribePopover.tsx` itself, not a new shared module.

**Constitution item 5 check, explicit:** `VITE_SUPABASE_URL` is not a secret
— it is already committed (blank) to `.env.example`, already read client-side
by `client.ts`, `CheckinResult.tsx`, and `StudentHome.tsx`, and `client.ts`'s
own module doc (`:9-12`) draws the actual line: "Anon (public) key only...
this module never references a service-role key." A Supabase project URL is
public by design; only the service-role key is the secret, and nothing in
this task touches it. Threading `VITE_SUPABASE_URL` through `functionsBaseUrl`
introduces no new exposure.

**(c) The loader-file shape to follow, verbatim convention, one real
precedent read in full: `src/lib/supabase/loaders/settings.ts`.** Every
`loaders/*.ts` file in this repo follows the same shape (`createLoader`/
`runMutation` from `../loader.ts`, injectable `getClient`, a `make*` factory
plus a real-singleton-bound default export, snake_case DB row interface +
explicit-column `select()` + a `mapXDbRowToRow` function, types imported from
the page file it serves). **The most directly relevant precedent for this
exact task's shape is `settings.ts`'s own history, not a hypothetical:**
`SettingsPage.tsx` itself used to default its own `loadSettingsData` prop to
a `console.warn` fixture stub; T105 wired it to
`loadSettingsDataReal` (`settings.ts`'s own real export) and — the load-bearing
precedent — **kept the old fixture stub as a named export, updated its doc
comment to say it is no longer the default, rather than deleting it or
leaving it claiming "not wired anywhere"** (`SettingsPage.tsx:297-317`, T105's
own module doc, quoting: "The original T060 fixture/`console.warn`-stub
implementations... are KEPT as named exports — same... precedent
`SeasonSettings.tsx`'s own T091 wiring already established... their own doc
comments... are updated below to say so accurately, rather than left claiming
'not wired anywhere' now that they no longer are the default.") **Do the
identical thing here**, one file down: `defaultLoadCalendarFeed`/
`FIXTURE_ACTIVE_FEED`/`PLACEHOLDER_SUPABASE_FUNCTIONS_URL` stay exported,
their doc comments get corrected, and `SubscribePopover`'s own destructured
prop defaults switch to the real implementations — exactly as
`SettingsPage`'s own `loadSettingsData = loadSettingsDataReal` (`:814`)
already does for itself.

**This is also why `SettingsPage.tsx` is Forbidden here (§2), stated
plainly:** `SettingsPage.tsx`'s own module doc #10 (`:320-333`) already
disclaims responsibility for `SubscribePopover`'s internal seams verbatim:
"This file passes only the one prop it can genuinely supply... this file
does not re-decide or override any of `SubscribePopover`'s own internal
seams." That design was correct; the bug was that `SubscribePopover`'s own
defaults hadn't caught up to it yet. Fixing this entirely inside
`SubscribePopover.tsx` makes that already-correct disclosed design true
instead of buggy, the same shape T105 used for `SettingsPage` itself one
layer up.

**(d) The multi-row hazard is real, already documented at length in this
file's own module doc, and is the one place a naive fix breaks.**
`calendar_feeds` (`supabase/migrations/20260717000001_support_audit.sql:47-53`)
has a `unique` constraint on `token` but **none on `profile_id`**
(`SubscribePopover.tsx:29-42`, its own module doc, already establishes this
in detail: "a profile CAN accumulate multiple `calendar_feeds` rows over
time... nothing in Postgres stops a caller from inserting a second
non-revoked row"). A bare `.eq('profile_id', profileId).is('revoked_at',
null).maybeSingle()` **throws** the moment two non-revoked rows exist for one
profile (Postgrest's "multiple (or no) rows returned" error under
`.maybeSingle()`/`.single()`), which is a real, reachable state given nothing
in the DB prevents it. The correct shape orders and limits **before**
`maybeSingle()`, so Postgrest itself never sees more than one row:
`.select(...).eq('profile_id', profileId).is('revoked_at', null)
.order('created_at', { ascending: false }).limit(1).maybeSingle()` — resolves
the most-recently-created active row, never throws on a duplicate, and still
resolves `null` cleanly for zero rows (the "no feed provisioned yet" case,
module doc section 10, `:271-279` — a genuine fail-loud case per (e) below,
not a fixture fallback).

**(e) Missing-row posture: fail loud, matching `loadSettingsData`'s own
"profiles row must already exist" precedent.** `SubscribePopover.tsx`'s own
module doc section 10 (`:271-279`) already assumes a `calendar_feeds` row
exists for `profileId` by the time this widget renders (no "create one" UI
here, disclosed scope). `settings.ts`'s `loadSettingsData` throws a plain,
DES-16-shaped `Error` when the analogous "should always exist" `profiles` row
is missing (`settings.ts:358-360`) rather than fabricating a row. Do the same
here: zero active rows for a profile is a genuine, fail-loud error (routed
into the existing DES-12 error Banner, `SubscribePopover.tsx:541-554`,
untouched), never bridged to fixture data.

## 4. Constitution items checked, findings below — do not re-litigate

**Item 3 (metric SQL / RLS from PRD 8.4 only):** does not block this task.
No metric formula is involved — this is a single-table identity read, not a
computed value. No SQL view over `calendar_feeds` exists to read instead of
the base table (`grep -rn "calendar_feeds" supabase/migrations/` returns only
the table's own creation and RLS policy — confirmed this session). RLS
itself is pre-existing and unedited by this task (below).

**RLS, read-only reference, not reimplemented:** `self_all` on
`calendar_feeds` (`supabase/migrations/20260717000002_rls.sql:250-252`):
`for all to authenticated using (profile_id = auth.uid())` (PRD 8.3: "own |
own | own"). Same posture `settings.ts`'s own module doc draws for
`notification_prefs`'s identical policy shape: RLS alone would already scope
this correctly, but the loader still supplies an explicit `.eq('profile_id',
profileId)` rather than relying on RLS alone to narrow an otherwise-open
query — same defense-in-depth discipline `settings.ts:55-64` states
explicitly for its own analogous case.

**Item 5 (no secrets):** checked in §3b. `VITE_SUPABASE_URL` is public;
nothing in this task references a service-role key.

**Item 6 (no PII in fixtures):** the new loader's test file needs its own
fabricated `profile_id`/feed rows, distinct from `SubscribePopover.test.tsx`'s
existing `TEST_PROFILE_ID`/`TEST_FEED` fixtures — fabricated strings only
(e.g. `profile-test-...`, matching the existing file's own naming idiom at
`:148-156`), never anything resembling a real name/email.

**Item 19b (premise-gate scope, your own recommendation, not your call):**
this task threads an already-established convention (§3b's env-var pattern,
§3c's loader-file pattern) onto a new surface rather than inventing a novel
one — closer to "rolling out an already-verified pattern" than a from-scratch
design. Recommend a light premise check; `checker-premise` decides.

## 5. Design — summary (full reasoning is §3, this is the checklist)

**Inside `SubscribePopover.tsx`:**
1. Add a private `readViteEnvVar(key): string | undefined` (same idiom as
   `CheckinResult.tsx:211-214`/`StudentHome.tsx`, independently authored, not
   imported).
2. Add `export function resolveFunctionsBaseUrl(): string` — reads
   `VITE_SUPABASE_URL`, trims, strips trailing slashes, returns
   `${url}/functions/v1}` when non-blank, else falls back to
   `PLACEHOLDER_SUPABASE_FUNCTIONS_URL` (defensive; unreachable in practice
   once `loadCalendarFeed` is real, since an unconfigured Supabase client
   already throws `SupabaseNotConfiguredError` before the URL line is ever
   reached — `SubscribePopover.tsx:556` runs only in the `'success'`
   branch). Export it, same "pure helpers exported for direct testing"
   convention this file already uses for `buildIcsUrl` (`:334-336`).
3. Change the destructured default: `functionsBaseUrl = resolveFunctionsBaseUrl()`
   (was `= PLACEHOLDER_SUPABASE_FUNCTIONS_URL`, `:483`).
4. Import `{ loadCalendarFeed as loadCalendarFeedReal } from
   '../../lib/supabase/loaders/calendarFeed'`; change the destructured
   default: `loadCalendarFeed = loadCalendarFeedReal` (was `=
   defaultLoadCalendarFeed`, `:481`).
5. Keep `defaultLoadCalendarFeed`/`FIXTURE_ACTIVE_FEED`/
   `PLACEHOLDER_SUPABASE_FUNCTIONS_URL` exported; correct their doc comments
   per §3c (T105 precedent) — they are no longer the defaults, say so.
6. Update module doc sections 2/7/10 (`:94-120`, `:197-220`, `:266-279`) to
   describe the real wiring instead of the "no shared Supabase client wired
   in yet" disclosure, matching T105's own "updated... which is now stale and
   has been removed" convention (`SettingsPage.tsx:297-301`).
7. `onResetFeedToken`/`defaultOnResetFeedToken` are **untouched** — same
   family of bug (a fixture-shaped default), explicitly not this task's
   scope (§1). State this plainly in your output and recommend a follow-up
   ledger row (item 20) — do not silently leave it as only a code comment,
   and do not fix it here either.

**New file `src/lib/supabase/loaders/calendarFeed.ts`**, following
`settings.ts`'s shape (§3c):
- `CalendarFeedDbRow` (snake_case: `id`, `profile_id`, `token`, `revoked_at`,
  `created_at`), `mapCalendarFeedDbRowToRow` → the `CalendarFeedRow` type
  imported from `'../../../pages/calendar/SubscribePopover'` (matching
  `settings.ts:193-209`'s own convention of importing types from the page
  file it serves).
- `queryActiveCalendarFeedByProfileId(client, profileId)`: explicit-column
  `select('id, profile_id, token, revoked_at, created_at')`, `.eq('profile_id',
  profileId)`, `.is('revoked_at', null)`, `.order('created_at', { ascending:
  false })`, `.limit(1)`, `.maybeSingle()` — exact shape from §3d, in that
  order (`order`/`limit` before `maybeSingle`).
- `makeLoadCalendarFeed(getClient = getSupabaseClient): LoadCalendarFeedFn`
  built on `createLoader`, throwing a plain `Error('No calendar feed was
  found for your account.')` on a `null` result (§3e).
- `export const loadCalendarFeed: LoadCalendarFeedFn = makeLoadCalendarFeed();`

**Nothing in `SettingsPage.tsx` changes** (§2/§3c).

## 6. Acceptance criteria — prescribed mutation, expected result, for each

Run every mutation in your own worktree only (item 23), revert with
`git checkout -- <file>` after each, re-confirm green before the next.

1. **`resolveFunctionsBaseUrl` derives the real Functions URL from
   `VITE_SUPABASE_URL`.** Test via `vi.stubEnv('VITE_SUPABASE_URL',
   'https://example.supabase.co')` (same idiom `client.test.ts:67` already
   uses for this exact env var): expect `'https://example.supabase.co/functions/v1'`.
   Also cover a trailing slash on the stubbed URL (stripped) and a blank/unset
   env var (falls back to `PLACEHOLDER_SUPABASE_FUNCTIONS_URL`). **Mutation:**
   hardcode the function to always return `PLACEHOLDER_SUPABASE_FUNCTIONS_URL`
   regardless of the env var. **Expect RED** on the "env var set" case.
2. **`SubscribePopover`'s own default `functionsBaseUrl` is
   `resolveFunctionsBaseUrl()`, not the placeholder literal.** Diff-based:
   the destructured default at the former `:483` no longer reads
   `PLACEHOLDER_SUPABASE_FUNCTIONS_URL` directly. Inspection-level, label it
   as such.
3. **The multi-row hazard (§3d) is handled, not just described.** Fake-client
   test (same `makeFakeSelectClient`-shaped harness this directory's other
   loader tests use — see `students.ts`'s own doc pointer to that pattern)
   constructing **two** non-revoked rows for one `profileId` with different
   `created_at` values: assert the loader resolves the **more recent** one,
   without throwing. **Mutation:** remove `.order(...)`/`.limit(1)` and call
   `.maybeSingle()` directly against the unfiltered multi-row result. **Expect
   RED** — either the wrong row resolves, or the mutated query throws where
   the test expected a clean resolve (assert on whichever your harness
   produces; state which).
4. **Zero active rows fails loud, not fixture-shaped (§3e).** Fake-client
   test with zero matching rows: assert the loader **rejects** with a real
   `Error`, never resolves anything shaped like `FIXTURE_ACTIVE_FEED`.
   **Mutation:** replace the throw with a fixture-shaped fallback return.
   **Expect RED.**
5. **Explicit `profile_id`/`revoked_at` filters, not RLS-only (§4).**
   Inspection-level: the query chain includes `.eq('profile_id', ...)` and
   `.is('revoked_at', null)` explicitly (grep-provable against the committed
   source).
6. **`SubscribePopover`'s own default `loadCalendarFeed` is
   `loadCalendarFeedReal`, not `defaultLoadCalendarFeed`.** Diff-based, same
   shape as criterion 2.
7. **Old fixture exports survive, corrected, not deleted (§3c/T105
   precedent).** `defaultLoadCalendarFeed`/`FIXTURE_ACTIVE_FEED`/
   `PLACEHOLDER_SUPABASE_FUNCTIONS_URL` still exported; their doc comments no
   longer claim to be the active default. Inspection-level.
8. **`SubscribePopover.test.tsx`'s existing suite passes with a minimal
   diff.** Every existing render call already injects explicit
   `loadCalendarFeed`/`functionsBaseUrl` stubs (verified this session — no
   existing test relies on either default), so changing the internal
   defaults should not require rewriting existing assertions. Report the
   actual diff on this file; if it's larger than "one new `describe` block
   for the two new pure functions," explain why.
9. **`SettingsPage.tsx`/`SettingsPage.test.tsx` zero-diff (§2).** Confirmed
   independently by the checker (item 23), not just claimed by you.
10. **`onResetFeedToken` explicitly untouched, and named as a follow-up, not
    silently dropped (item 20, §5 point 7).** Your own output must state this
    plainly and recommend a follow-up ledger row describing it (same
    fixture-default shape as this task's other half, `console.warn` stub
    fabricating a locally-generated row) — you do not create the ledger row
    yourself; that's the foreman's job on merge.
11. **No regression elsewhere.** Full repo suite stays green outside the two
    changed/new files' own additions.

## 7. Required evidence / gates

All five gates, measured at your own worktree SHA, before and after
(orientation only, re-measure, do not assume): `npx tsc --noEmit`,
`npx vite build`, `npx prettier --check ...`, `npx eslint .`,
`npx vitest run`. As of this packet's pin (`3b6ad0f`): 69 files / 1644 tests
tracked in the ledger's T169 row — your own merge may move this; report your
own numbers before and after.

State your commit SHA (item 21) — the orchestrator verifies HEAD actually
moved and the change is in the committed blob before treating this as
mergeable. Stage explicit pathspecs only, never `git add -A`/`git add .`
(item 22): `src/pages/calendar/SubscribePopover.tsx`,
`src/pages/calendar/SubscribePopover.test.tsx`,
`src/lib/supabase/loaders/calendarFeed.ts`,
`src/lib/supabase/loaders/calendarFeed.test.ts`.

## 8. Tiering and gate recommendation (for the record, not yours to act on)

**Worker: sonnet.** None of item 18's four triggers apply — no migration
file, no new/edited RLS policy or `security definer` helper (§4's RLS is
pre-existing and read-only), no new metric SQL view, no auth/session/
role-resolution/permission-logic change (`profileId` is a caller-supplied
value threaded unchanged, same posture the file already had). Per item 25's
second, narrower obligation: a calendar-subscription token is not sensitive
enough to justify opus on "sounds sensitive" grounds — the deployed `ics`
function already treats the opaque token itself as the entire credential
(§3a), unrelated to and unmoved by this task.

**Checker: opus.** Two reasons, neither "topic sounds sensitive": (1) **this
is a confirmed-live, reachable route** — `router.tsx:283-286` renders
`<SettingsPage />` at `/settings` behind `RequireAuth` only (T074), and
`SettingsPage.tsx`'s own defaults are already real (T105) — so this bug
reaches every real signed-in user today, the same "live route" bar T170/T176
used for their own opus checker calls, verified here rather than assumed.
(2) **the multi-row hazard in §3d is exactly the class of subtle correctness
trap that has cost this project multiple rounds before** (a naive
`.maybeSingle()` looks correct, passes a happy-path test, and breaks the
moment the documented-but-easy-to-forget "no uniqueness constraint" edge case
occurs) — worth independent, adversarial verification rather than a single
opus-light read-through.

## 9. Escalation

Attempt count starts at 0 (pre-dispatch). Three failed worker/checker rounds
escalate to `boss-arbiter` (constitution Loop Limit). Any dispute the worker
files goes through the standard Dispute Rule — do not improvise around a
standard believed wrong, impossible, contradictory, or harmful.
