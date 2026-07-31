# T177 — Worker Packet

**Pinned to branch tip `3b6ad0f` on `claude/swarm-plan-zl575z`** (`git log -1`
re-verified live this session; `main` remains `f7ff055`, unrelated). All
citations below were read directly at this SHA, not carried from the ledger
row, which itself discloses it was not re-verified this session.

**Revision 2 of this packet.** Round 1 of `checker-premise` returned REVISE
(3 BLOCKER, 2 MAJOR, 4 MINOR, 4 NIT). Item 19a caps this at two rounds. All
findings are corrected below; corrections are marked inline as **[REV2]**.
The convention findings from round 1 (Functions-URL shape, the
no-uniqueness-on-`profile_id` schema fact, worker tier, security posture)
were all confirmed and are unchanged. Two of round 1's BLOCKERs were real
design gaps, not documentation errors, and are resolved by explicit decisions
below (§1, §2), not left for the worker to choose.

**Attempt:** 1 of 3 (constitution Loop Limit — a 4th attempt escalates to
`boss-arbiter`). **Tier: `worker-implementer`, sonnet, worktree** — reasoning
in §8. **Checker: `checker-reviewer`, opus** — reasoning in §8.

## 1. Objective

`SubscribePopover.tsx` (mounted at the live, reachable `/settings` route —
confirmed in §8, not assumed) shows every signed-in user a calendar
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
— only `profileId` — so every real user who opens Settings sees this fake
data today.

**[REV2] What "fixed" means here, stated plainly, per round 1's BLOCKER 2.**
`grep -rn "calendar_feeds" src supabase` finds **zero INSERT sites anywhere**
in this codebase — nothing except the out-of-scope `onResetFeedToken` stub
would ever create a `calendar_feeds` row. So once this task wires the real
loader, **every real user still gets no working link** — they get the
honest DES-12 error state (`"Couldn't load your calendar link"`) instead of
a fabricated one. **This task makes the widget honest, not functional.**
That is a real, worthwhile fix (a fabricated link that silently fails when a
calendar app tries to fetch it is worse than a visible error a user can
report), but it is not "the calendar feed now works," and the worker's own
output must say so in exactly those terms rather than imply the feature is
now working end-to-end. The provisioning gap itself is filed as a follow-up,
not fixed here — see §6 criterion 11.

**Fix both halves of the two-part bug named above. `onResetFeedToken` and
`calendar_feeds` row provisioning are both explicitly out of scope** — see
§2/§6 criteria 10/11.

## 2. Allowed / forbidden files

**Allowed:**
- `src/pages/calendar/SubscribePopover.tsx`
- `src/pages/calendar/SubscribePopover.test.tsx`
- `src/lib/supabase/loaders/calendarFeed.ts` (new file)
- `src/lib/supabase/loaders/calendarFeed.test.ts` (new file)
- `src/pages/settings/SettingsPage.test.tsx` — **[REV2] newly allowed, scope
  restricted to exactly one block.** See §6 criterion 9 for the required
  change and why it's required, and §3(f) for why this file cannot stay
  Forbidden without leaving an already-green test permanently broken.

**Forbidden, in addition to the constitution's standing list
(`docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`,
`dispute-log.md`, `.claude/**`, `node_modules/`):**
- `src/pages/settings/SettingsPage.tsx` (source) — **[REV2] still Forbidden,
  unchanged.** The call site (`:1207`) does not change: it still passes only
  `profileId`, and `SubscribePopover`'s own defaults do the rest. Only the
  *test* file changes (above), and only in the one place named in §6
  criterion 9. The checker independently confirms `SettingsPage.tsx` itself
  is zero-diff (item 23).
- `src/lib/supabase/client.ts`, `loader.ts`, `functions.ts` — read-only
  reference. Import from them; do not modify them.
- `src/lib/supabase/loaders/settings.ts` — read-only reference/pattern model
  (§3c). Do not edit.
- `src/lib/supabase/types.ts`, `src/lib/supabase/index.ts` — read-only. Note
  for context, not action: `types.ts:409-415` already declares a
  `CalendarFeedRow` field-for-field identical to `SubscribePopover.tsx`'s own
  local one (`:300-308`). Per the precedent `loaders/students.ts`/
  `loaders/invites.ts` already set (page-local types kept as-is, not switched
  to the shared ones, their own "Trap #1" doc), keep using
  `SubscribePopover.tsx`'s own local `CalendarFeedRow` — do not import from
  `types.ts` or touch either file.
- `supabase/functions/ics/**`, `supabase/migrations/**` — already-deployed,
  read-only reference (§3a/§3d). Do not touch.
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
...)`) and `StudentHome.tsx:167,546` (`src/pages/home/StudentHome.tsx` —
module doc citing the identical shape, `POST {VITE_SUPABASE_URL}/functions/v1/checkin`)
both build `${VITE_SUPABASE_URL}/functions/v1/<name>` — no second env var,
derived from the one already committed to `.env.example` and already read by
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
add a small private `readViteEnvVar` inside `SubscribePopover.tsx` itself,
not a new shared module — full shape in §5.

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
identical thing here**, one file down — see §5, §6 criterion 7 for the
precise, narrowed scope of what stays exported.

**(d) The multi-row hazard is real, already documented at length in this
file's own module doc, and is the one place a naive fix breaks. [REV2 —
mechanism corrected; conclusion unchanged.]** `calendar_feeds`
(`supabase/migrations/20260717000001_support_audit.sql:47-53`) has a
`unique` constraint on `token` but **none on `profile_id`**
(`SubscribePopover.tsx:29-42`, its own module doc, already establishes this
in detail: "a profile CAN accumulate multiple `calendar_feeds` rows over
time... nothing in Postgres stops a caller from inserting a second
non-revoked row"). **Round 1 was wrong about the mechanism: PostgREST (the
server) does not enforce single-row cardinality, and `.maybeSingle()` does
not "throw."** `postgrest-js` (the installed client library, verified
directly this round) fetches the response as an ordinary list and enforces
cardinality **client-side**: `PostgrestTransformBuilder.ts:737-744` sets the
`Accept: application/vnd.pgrst.object+json` header for `.maybeSingle()`, and
`PostgrestBuilder.ts:519-537` is where the client-side check actually lives —
if the returned array has more than one element, it synthesizes an error
response shaped `{ code: 'PGRST116', message: 'JSON object requested,
multiple (or no) rows returned', ... }` rather than a genuine thrown
exception; `createLoader` (`loader.ts:174-176`) already turns any non-null
`result.error` into a rejected `SupabaseLoaderError`, so the practical effect
is the same (a rejection) even though the earlier "PostgREST throws" framing
was mechanically wrong. **The fix prescription is unchanged and still
necessary**: order and limit **before** `.maybeSingle()`, so the client-side
array your fake (and the real client) ever hands to the cardinality check
never has more than one element: `.select(...).eq('profile_id', profileId)
.is('revoked_at', null).order('created_at', { ascending: false }).limit(1)
.maybeSingle()` — resolves the most-recently-created active row, never
synthesizes a `PGRST116` error on a real duplicate, and still resolves
`null` cleanly for zero rows (the "no feed provisioned yet" case, module doc
section 10, `:271-279` — a genuine fail-loud case per (e) below, and, per
§1's `[REV2]`, the state every real user is actually in today).

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

**(f) [REV2, new — the provisioning gap, round 1's BLOCKER 2.]** Nothing
anywhere inserts a `calendar_feeds` row for a profile — not the invite
trigger, not any migration backfill, not any app code. `onResetFeedToken`
would create one (`SubscribePopover.tsx`'s own `defaultOnResetFeedToken`,
untouched by this task, §1) but only from an already-active row that must
already exist, so it cannot be the first row either. This means (e)'s
fail-loud path is not a rare edge case this task defends against — **it is
the outcome for every real profile today**, until a provisioning path is
built (most likely: a trigger alongside `fn_handle_invite_acceptance`, the
same mechanism `notification_prefs`' own missing-backfill gap (`settings.ts`
module doc, T109) was diagnosed against, though designing that fix is
explicitly not this task's job). Filed as a follow-up per item 20 — see §6
criterion 11. Do not attempt to build provisioning in this task; the
Allowed Files above do not include a migration, and item 18's tier trigger
for migrations would apply if you did.

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
own | own"). Same posture `settings.ts`'s own module doc draws for its
`profiles`/`notification_prefs` reads (`settings.ts:52-64`, its own "Known
Context/Traps #1" bullets on `profiles_self_update`/`self_all`/
`profiles_read`, and the reasoning immediately following them that
`loadSettingsData` must not rely on RLS alone to narrow an otherwise-open
`profiles` query): RLS alone would already scope this table correctly given
`self_all`'s own `using (profile_id = auth.uid())`, but the loader still
supplies an explicit `.eq('profile_id', profileId)` rather than relying on
RLS alone — same defense-in-depth discipline, applied here even though this
table (unlike `profiles`) has no wide-open companion policy to defend
against; stated for consistency with the established convention, not because
a specific hole exists.

**Item 5 (no secrets):** checked in §3b. `VITE_SUPABASE_URL` is public;
nothing in this task references a service-role key.

**Item 6 (no PII in fixtures):** the new loader's test file needs its own
fabricated `profile_id`/feed rows, distinct from `SubscribePopover.test.tsx`'s
existing `TEST_PROFILE_ID`/`TEST_FEED` fixtures — fabricated strings only
(e.g. `profile-test-...`, matching the existing file's own naming idiom at
`:148-156`), never anything resembling a real name/email.

**Item 19b (premise-gate scope). [REV2 — corrected, round 1 was right to
override this.]** The original recommendation here ("light check") was
wrong for this shape, and round 1's own finding is why: this packet flips a
component's default from a fixture to a real loader, and this project's
recurring failure mode is exactly "something else silently depended on the
fixture default" — which is precisely what BLOCKER 1 turned out to be
(`SettingsPage.test.tsx:541-547` only passed because of the fixture).
**Recommend a full premise check for any packet with this shape** ("flips an
existing default from fixture to real"), not a light one — `checker-premise`
still decides, but the recommendation itself is corrected here rather than
left standing.

## 5. Design — summary (full reasoning is §3, this is the checklist)

**Inside `SubscribePopover.tsx`:**

1. Add a private `readViteEnvVar(key): string | undefined` (same idiom as
   `CheckinResult.tsx:211-214`/`StudentHome.tsx`, independently authored, not
   imported).
2. **[REV2, BLOCKER 3 fix.] Add `export function resolveFunctionsBaseUrl(
   rawSupabaseUrl: string | undefined = readViteEnvVar('VITE_SUPABASE_URL'),
   ): string`** — an **injectable-parameter seam**, matching
   `CheckinResult.tsx`'s own established shape for this exact problem
   (`CallCheckinConfig.supabaseUrl?: string`, `:197-198`, defaulting to
   `readViteEnvVar('VITE_SUPABASE_URL')` when the caller passes nothing,
   `:236`) — **not** environment stubbing. Round 1 built and ran the
   `vi.stubEnv('VITE_SUPABASE_URL', ...)` version this packet originally
   prescribed and confirmed it does not work: `vi.stubEnv` does not reach
   `import.meta.env` as read inside `SubscribePopover.tsx`, in either the
   bracket-cast or dot-access form, measured directly, real `.env.local`
   values leak through regardless. Tests call `resolveFunctionsBaseUrl(
   'https://example.supabase.co')` with a **plain string argument** — no env
   stubbing anywhere in this file's test suite. Body: trims the input,
   strips a trailing slash (matching `CheckinResult.tsx:236-239`'s own
   `.replace(/\/+$/, '')` on the raw `VITE_SUPABASE_URL` value, done here for
   the same reason — avoiding a double slash before `/functions/v1`, a
   distinct concern from `buildIcsUrl`'s own separate, already-existing
   trailing-slash strip on the *final* `functionsBaseUrl` right before
   appending `/ics`, `:341` — you are not re-implementing that, just
   cleaning the raw env value the same way `CheckinResult.tsx` already
   does), returns `${trimmed}/functions/v1` when non-blank, else falls back
   to `PLACEHOLDER_SUPABASE_FUNCTIONS_URL` (defensive; unreachable in
   practice once `loadCalendarFeed` is real, since an unconfigured Supabase
   client already throws `SupabaseNotConfiguredError` before the URL line is
   ever reached — `SubscribePopover.tsx:556` runs only in the `'success'`
   branch). Export it, same "pure helpers exported for direct testing"
   convention this file already uses for `buildIcsUrl` (`:334-336`).
3. Change the destructured default: `functionsBaseUrl = resolveFunctionsBaseUrl()`
   (was `= PLACEHOLDER_SUPABASE_FUNCTIONS_URL`, `:483`) — called with no
   argument here, so it reads the real env var by default; the component's
   own `functionsBaseUrl` prop remains independently overridable, unchanged
   (it already was — this task doesn't add that seam, it just fixes what it
   defaults to).
4. Import `{ loadCalendarFeed as loadCalendarFeedReal } from
   '../../lib/supabase/loaders/calendarFeed'`; change the destructured
   default: `loadCalendarFeed = loadCalendarFeedReal` (was `=
   defaultLoadCalendarFeed`, `:481`).
5. **[REV2, MINOR 7 fix — scope narrowed to what's actually exported
   today.]** Keep `defaultLoadCalendarFeed` (`:392`, currently exported) and
   `PLACEHOLDER_SUPABASE_FUNCTIONS_URL` (`:379`, currently exported) as named
   exports; correct their doc comments per §3c (T105 precedent) — they are
   no longer the defaults, say so. **`FIXTURE_ACTIVE_FEED` (`:382`) is a
   bare, unexported `const` today, not an export** — leave it exactly as it
   is (still used internally by `defaultLoadCalendarFeed`); do not newly
   export it, nothing in this task needs that.
6. Update module doc sections 2/7/10 (`:94-120`, `:197-220`, `:266-279`) to
   describe the real wiring instead of the "no shared Supabase client wired
   in yet" disclosure, matching T105's own "updated... which is now stale and
   has been removed" convention (`SettingsPage.tsx:297-301`), and to state
   §1's "honest, not functional" posture (no provisioning path exists yet).
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
- **[REV2, MINOR 8/9 fix — spelled out explicitly rather than left for the
  worker to discover.]** `makeLoadCalendarFeed(getClient: () => SupabaseClient
  = getSupabaseClient): LoadCalendarFeedFn`, built as:

  ```ts
  const loadRow = createLoader<string, CalendarFeedDbRow>(
    queryActiveCalendarFeedByProfileId, // query first
    getClient,                          // getClient second
  );
  ```

  — `createLoader`'s own signature is `(query, getClient)`, query first
  (`loader.ts:159-161`), not the reverse. `createLoader` resolves
  `Promise<TData | null>` (`loader.ts:162`), but `LoadCalendarFeedFn`
  (`SubscribePopover.tsx:312`) is `Promise<CalendarFeedRow>` — **non-null**.
  So `makeLoadCalendarFeed`'s returned function is not `loadRow` directly; it
  must be a thin wrapper: call `loadRow(profileId)`, and if the result is
  `null`, throw the fail-loud `Error` from §3e/(f) instead of returning it —
  this null-check is a **type requirement**, not just a design preference,
  since `loadRow`'s own return type does not satisfy `LoadCalendarFeedFn`
  without it.
- `export const loadCalendarFeed: LoadCalendarFeedFn = makeLoadCalendarFeed();`

**`SettingsPage.tsx` (source) is unchanged** (§2/§3c). **`SettingsPage.test.tsx`
gets exactly one scoped change** — §6 criterion 9.

## 6. Acceptance criteria — prescribed mutation, expected result, for each

Run every mutation in your own worktree only (item 23), revert with
`git checkout -- <file>` after each, re-confirm green before the next.

1. **`resolveFunctionsBaseUrl` derives the real Functions URL from its
   input, via direct parameter injection, not env stubbing. [REV2, BLOCKER 3
   fix.]** Call `resolveFunctionsBaseUrl('https://example.supabase.co')` and
   expect `'https://example.supabase.co/functions/v1'`. Cover a trailing
   slash on the input (stripped) and a blank/`undefined` input (falls back to
   `PLACEHOLDER_SUPABASE_FUNCTIONS_URL`). **No `vi.stubEnv` anywhere in this
   criterion or this file's tests** — round 1 measured that idiom does not
   reach this module's `import.meta.env` read; do not reintroduce it.
   **Mutation:** hardcode the function to always return
   `PLACEHOLDER_SUPABASE_FUNCTIONS_URL` regardless of its argument. **Expect
   RED** on the "real URL passed" case.
2. **`SubscribePopover`'s own default `functionsBaseUrl` is
   `resolveFunctionsBaseUrl()`, not the placeholder literal.** Diff-based:
   the destructured default at the former `:483` no longer reads
   `PLACEHOLDER_SUPABASE_FUNCTIONS_URL` directly. Inspection-level, label it
   as such.
3. **The multi-row hazard (§3d) is handled by a fake that actually
   enforces cardinality, not one that just differs textually. [REV2, MAJOR 5
   fix.]** The closest existing precedent is
   `src/lib/supabase/loaders/parentHome.test.ts:20-67`'s `makeRecordingChain`
   — **not** `makeFakeSelectClient` (that name lives in
   `src/pages/roster/InvitesTab.test.tsx:513`, a different directory, and
   only models `.from().select().order()`, no `.limit()`; do not point the
   worker at it as this packet's round-1 draft mistakenly did). Even
   `parentHome.test.ts`'s own chain is not a drop-in match: it has no
   `.is()` and no `.limit()`, and its `.maybeSingle()` just resolves
   whatever fixed `result` object it was constructed with — it does **not**
   emulate real cardinality checking. **Build a fake that does, because
   nothing is reproduced for free:** the fake needs (a) an `.is()` recorder
   (same shape as its existing `.eq()`), (b) a `.limit(n)` that actually
   slices the fake's underlying row array to its first `n` elements (not
   just a no-op recorder — the mutation below depends on this being real),
   and (c) a `.maybeSingle()` terminal that inspects the (possibly-limited)
   array's length: 0 → `{ data: null, error: null }`; 1 → `{ data: row,
   error: null }`; **more than 1 → synthesize `{ data: null, error: { code:
   'PGRST116', message: 'JSON object requested, multiple (or no) rows
   returned' } }`** — the real shape `postgrest-js` produces (§3d, verified
   against the installed source this round). Construct **two** non-revoked
   rows for one `profileId` with different `created_at` values: assert the
   loader resolves the **more recent** one, without rejecting. **Mutation:**
   remove `.order(...)`/`.limit(1)` from the query function, leaving
   `.maybeSingle()` to run against the unfiltered two-row array. **Expect
   RED** — your fake's own cardinality emulation now synthesizes `PGRST116`,
   which `createLoader` turns into a rejection, which the test must observe
   as a failure against its "resolves the more recent row" expectation.
4. **Zero active rows fails loud, not fixture-shaped (§3e), and this is the
   state every real profile is in today (§1/§3f). [REV2, framing tied to
   BLOCKER 2.]** Fake-client test with zero matching rows: assert the loader
   **rejects** with a real `Error`, never resolves anything shaped like
   `FIXTURE_ACTIVE_FEED`. **Mutation:** replace the throw with a
   fixture-shaped fallback return. **Expect RED.**
5. **Explicit `profile_id`/`revoked_at` filters, not RLS-only (§4).**
   Inspection-level: the query chain includes `.eq('profile_id', ...)` and
   `.is('revoked_at', null)` explicitly (grep-provable against the committed
   source).
6. **`SubscribePopover`'s own default `loadCalendarFeed` is
   `loadCalendarFeedReal`, not `defaultLoadCalendarFeed`.** Diff-based, same
   shape as criterion 2.
7. **Old fixture exports survive, corrected, not deleted, scope narrowed to
   what's actually exported today (§3c/T105 precedent). [REV2, MINOR 7
   fix.]** `defaultLoadCalendarFeed` and `PLACEHOLDER_SUPABASE_FUNCTIONS_URL`
   — the two symbols actually exported today — still exported; their doc
   comments no longer claim to be the active default. `FIXTURE_ACTIVE_FEED`
   stays a private, unexported `const`, unchanged. Inspection-level.
8. **`SubscribePopover.test.tsx`'s existing suite passes with a minimal
   diff.** Every existing render call already injects explicit
   `loadCalendarFeed`/`functionsBaseUrl` stubs (verified this session — no
   existing test relies on either default), so changing the internal
   defaults should not require rewriting existing assertions. Report the
   actual diff on this file; if it's larger than "one new `describe` block
   for the two new pure functions," explain why.
9. **[REV2, BLOCKER 1 fix, replaces the old "zero-diff" criterion.]
   `SettingsPage.tsx` (source) is zero-diff; `SettingsPage.test.tsx` changes
   in exactly one place, and the change is decided here, not left to you.**
   `SettingsPage.test.tsx:541-547` ("renders the real, imported
   SubscribePopover (its own 'Subscribe' trigger)") currently passes only
   because the fixture default resolves instantly to a success state. Once
   `loadCalendarFeed`'s real default is wired, that test fails in **every**
   env state — round 1 reproduced this both with and without `.env.local`
   present, since (§3f) no `calendar_feeds` row exists for the test's fixture
   profile either way. **Required change, decided:** rewrite that one `it`
   block to assert the real, honest DES-12 error banner instead of the
   `Subscribe` button — `expect(container.textContent).toContain("Couldn't
   load your calendar link")` (the fixed Banner copy at
   `SubscribePopover.tsx:544-546`, unchanged by this task) — and rename the
   test to describe what it now proves (e.g. "renders the real, imported
   SubscribePopover, which honestly errors because no calendar_feeds row is
   provisioned yet"). **Pair it with a mutation proving genuine sensitivity,
   not just a differently-worded tautology:** temporarily point
   `SubscribePopover`'s default `loadCalendarFeed` back at
   `defaultLoadCalendarFeed` (the fixture) — **expect this test to go RED**
   (the error banner is gone; the fixture's fake success state, and the old
   "Subscribe" button, reappear instead). This is the proof that the test is
   actually reading which default is wired, not merely restating a fact
   about the fixed Banner copy. **Every other line in `SettingsPage.test.tsx`
   must be byte-identical** — the checker diffs the whole file, not just this
   block, and confirms `SettingsPage.tsx` itself has zero diff (item 23).
10. **`onResetFeedToken` explicitly untouched, and named as a follow-up, not
    silently dropped (item 20, §5 point 7).** Your own output must state this
    plainly and recommend a follow-up ledger row describing it (same
    fixture-default shape as this task's other half, `console.warn` stub
    fabricating a locally-generated row) — you do not create the ledger row
    yourself; that's the foreman's job on merge.
11. **[REV2, new — BLOCKER 2's follow-up, distinct from criterion 10.] The
    `calendar_feeds` provisioning gap (§3f) is named as its own follow-up,
    separately from `onResetFeedToken`.** Your own output must state plainly
    that after this task merges, every real user's Settings page will show
    the honest error Banner (not a working link) until a provisioning path
    exists, and must recommend a follow-up ledger row for that gap
    specifically (a trigger alongside `fn_handle_invite_acceptance`, or
    equivalent — design left to that future task, not sketched further here).
12. **No regression elsewhere, baseline stated precisely. [REV2, MAJOR 4
    fix.]** Full repo suite stays green outside the two changed/new files'
    own additions **and outside four already-failing, pre-existing tests
    unrelated to this task**, named explicitly so they are not mistaken for
    a regression you introduced: `AppShell.test.tsx` (two tests),
    `CoachHome.test.tsx`, `ParentHome.test.tsx` — all env-dependent (pass
    with `.env.local` absent, fail with it present; the same class of
    real-default-vs-fixture-default env sensitivity this task's own fix
    exhibits, per BLOCKER 1). **Measure your own before/after gates with
    `.env.local` absent** — this repo's canonical, reproducible state (no
    real Supabase project exists yet, per `client.ts`'s own "External-
    Prerequisite Posture" module doc), and the state under which the four
    pre-existing failures' count and identity is stable rather than
    dependent on whichever real credentials happen to be in a given
    developer's local file. State explicitly in your report which env state
    you measured under. Do not attempt to fix the four pre-existing
    failures — out of scope, not introduced by this task.

## 7. Required evidence / gates

All five gates, measured at your own worktree SHA, **with `.env.local`
absent** (criterion 12), before and after: `npx tsc --noEmit`,
`npx vite build`, `npx prettier --check ...`, `npx eslint .`,
`npx vitest run`. **[REV2, MAJOR 4 fix.]** Orientation only, re-measure, do
not assume: **68 files / 1644 tests, with 4 pre-existing failures** (criterion
12's list) as of this packet's pin (`3b6ad0f`) — not the "69 files / 1644
tests, all green" figure the round-1 draft of this packet stated, which was
wrong. Your own merge may move the file/test counts; the four pre-existing
failures should still be present and unchanged in identity unless you have
independent reason to believe otherwise (report if so, rather than silently
absorbing a changed count).

State your commit SHA (item 21) — the orchestrator verifies HEAD actually
moved and the change is in the committed blob before treating this as
mergeable. Stage explicit pathspecs only, never `git add -A`/`git add .`
(item 22): `src/pages/calendar/SubscribePopover.tsx`,
`src/pages/calendar/SubscribePopover.test.tsx`,
`src/lib/supabase/loaders/calendarFeed.ts`,
`src/lib/supabase/loaders/calendarFeed.test.ts`,
`src/pages/settings/SettingsPage.test.tsx`.

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

**Checker: opus.** Three reasons now, not two — round 1 added one. (1)
**This is a confirmed-live, reachable route** — `router.tsx:283-286` renders
`<SettingsPage />` at `/settings` behind `RequireAuth` only (T074), and
`SettingsPage.tsx`'s own defaults are already real (T105) — so this bug
reaches every real signed-in user today, the same "live route" bar T170/T176
used for their own opus checker calls, verified here rather than assumed.
(2) **The multi-row hazard in §3d is exactly the class of subtle correctness
trap that has cost this project multiple rounds before** (a naive
`.maybeSingle()` looks correct, passes a happy-path test, and synthesizes a
client-side `PGRST116` rejection the moment the documented-but-easy-to-forget
"no uniqueness constraint" edge case occurs) — worth independent, adversarial
verification, and criterion 3's fake-client cardinality emulation is exactly
the kind of thing worth a second, adversarial read. (3) **[REV2, new.] This
packet's own round 1 needed a full premise check to catch two real design
gaps (BLOCKER 1, BLOCKER 2) that a light check would have missed** — direct,
measured evidence for item 19b's corrected recommendation in §4, and the same
signal argues for the checker not going light on the worker's output either.

## 9. Escalation

Attempt count starts at 0 (pre-dispatch). Three failed worker/checker rounds
escalate to `boss-arbiter` (constitution Loop Limit). Any dispute the worker
files goes through the standard Dispute Rule — do not improvise around a
standard believed wrong, impossible, contradictory, or harmful.
