# T177 checker packet — calendar-feed subscription fix, round 1

Render a PASS / FAIL / REVISE verdict with full evidence, exactly as you
normally would — but stop there. **Do not merge this work, do not update
`docs/swarm/task-ledger.md`, do not write a `docs/swarm/verification-log.md`
entry, and do not treat T177 as closed.** The orchestrator decides what
happens with your verdict, including whether any FOLLOW-UP NEEDED items the
worker disclosed become new ledger rows.

## 0. Why this check carries more weight than a normal round-1 check

T177's packet is unusually load-bearing and was **never re-gated by
`checker-premise` after its final revision.** History, so you don't
underweight this: round 1 of premise-gating this packet returned REVISE (3
BLOCKER, 2 MAJOR); round 2's own fixes introduced 1 new BLOCKER and 2 new
MAJOR and also returned REVISE — hitting item 19a's two-round cap. Per item
19a that escalated to the human owner (George) rather than looping a third
gate round; he authorized one bounded final revision pass with **no further
`checker-premise` round to follow** (`docs/swarm/auto-mode-decisions.md`,
"2026-07-30 — George's ruling on T177's item-19a escalation"). Revision 3
(what the worker actually implemented, pinned `fe62f88`) applied that pass
and was dispatched straight to `worker-implementer`. **You are the first
independent verification this revision has ever received.** Treat that as
raising the bar, not lowering it: where the worker packet asserts something
was "verified this round" or "measured directly," re-derive it yourself
rather than importing the packet's own confidence — the packet's own history
(2 rounds of REVISE, including a round-2 fix that itself introduced new
defects) is direct evidence that confident-sounding packet text in this task
has been wrong before.

## 1. Dispatch context

- **Task:** T177 — `SubscribePopover.tsx`'s calendar-subscription link has a
  fake host (`functionsBaseUrl` defaults to a placeholder domain) and a fake
  token (`loadCalendarFeed` defaults to a hardcoded fixture row), reachable
  today at every real signed-in user's `/settings`.
- **Worker packet:** `docs/swarm/active/T177-worker-packet.md`, **revision
  3**, pinned `fe62f88` on `claude/swarm-plan-zl575z`. Read it in full — it
  is dense and self-referential (REV2/REV3 markers matter; §3d's
  cardinality-mechanism correction and §6 criterion 9's REV3 rewrite are both
  places where an earlier revision's reasoning was wrong and later corrected
  in text you should not re-litigate, only verify was actually followed).
- **Worker artifact location — inspect here, not the shared tree:** worktree
  `.claude/worktrees/agent-aaef544d042c8665d`, branch
  `worktree-agent-aaef544d042c8665d`, work committed at
  `19be7394581afb0c3929d7e4d7be1cdd68f6dac7` (short `19be739`), on top of
  packet-pin `fe62f88`. **Confirm this worktree and commit actually exist and
  that `19be739`'s parent chain includes `fe62f88` before relying on anything
  below** — do not assume the dispatch description is accurate (item 21).
- **Attempt count:** round 1 of the worker/checker loop on this packet. No
  prior checker verdict exists for this artifact.
- **Most recent verification failure:** none on this artifact — this is its
  first check. (Do not confuse this with the packet's own two premise-gate
  REVISE rounds above, which checked the *plan*, not this *artifact*.)
- **Worker:** `worker-implementer`, tier sonnet (per worker packet §8 — no
  migration, RLS, metric-SQL, or auth/session/role-resolution trigger; item
  25's narrower obligation not to bump tier on "sounds sensitive" grounds
  applies and the packet already reasons through it).
- **You are:** `checker-reviewer`, tier opus — matching worker packet §8's
  own assignment: (1) confirmed-live route (`/settings`, `RequireAuth` only,
  every real signed-in user reaches it), (2) the multi-row cardinality hazard
  in §3d/criterion 3 is exactly the class of subtle correctness trap that has
  cost this project multiple rounds before, (3) this packet's own premise
  gate needed a full round to catch two real design gaps a light check would
  have missed — the same signal argues against going light here either.

## 2. Objective (what you are verifying)

Worker packet §1/§5: fix both independently-fake halves of
`SubscribePopover.tsx`'s calendar link — (a) `functionsBaseUrl` derived from
the real `VITE_SUPABASE_URL` via an injectable `resolveFunctionsBaseUrl`
seam, not env-stubbing, and (b) `loadCalendarFeed` wired to a new, real
`src/lib/supabase/loaders/calendarFeed.ts` that queries `calendar_feeds` with
explicit `order`/`limit` before `.maybeSingle()` (the cardinality guard, §3d)
and fails loud on zero rows (§3e/§3f — this is the honest state every real
user is in today, since nothing anywhere provisions a `calendar_feeds` row).
`SettingsPage.tsx` (source) must stay zero-diff; `SettingsPage.test.tsx` may
change in exactly three named places (§6 criterion 9). Full design is worker
packet §5; full criteria are §6 (12 numbered items). **Do not re-derive the
worker's self-report below as fact — it is reproduced only so you know what
to check.**

## 3. Worker's self-report — unverified, reproduce nothing from it as established fact

- Files touched: claims only `SubscribePopover.tsx`,
  `SubscribePopover.test.tsx`, new `loaders/calendarFeed.ts`, new
  `loaders/calendarFeed.test.ts`, and exactly three named changes inside
  `SettingsPage.test.tsx` (one rewritten `it` block, one new top-level
  `vi.mock` block, one corrected module-doc bullet). Claims
  `SettingsPage.tsx` (source) is zero-diff.
- Claims all 4 mutation-marked criteria (1, 3, 4, 9) run live, RED confirmed,
  restored via `git checkout --` against the committed baseline.
- Discloses a mid-task process error: ran a mutation before committing its
  own implementation; `git checkout --` wiped the uncommitted work back to
  `fe62f88`; caught via `git status`/`git diff --stat`; redid the
  implementation, committed first this time, then ran mutations. Claims the
  final committed state (`19be739`) was re-verified complete via `git diff
  fe62f88 19be739 --stat` plus a full gate re-run. **What matters to you is
  whether `19be739` itself is sound and complete — not whether the process
  hiccup happened**, but note it: it is exactly the kind of thing that could
  leave a half-redone file if the worker's own recovery was imperfect, so
  check completeness with fresh eyes rather than assuming the recovery was
  clean because the worker says so.
- Claims gates (measured with `.env.local` absent, per packet §7's mandated
  state): `tsc --noEmit` clean; `vite build` succeeds; `prettier --check`
  clean; `eslint` 0 errors, 358 warnings (357 baseline + 1 new, claimed same
  already-tolerated `react-refresh/only-export-components` class); `vitest
  run` 69 files / 1654 tests, 0 failures (baseline claimed 68 files / 1644
  tests, 0 failures — so +1 file / +10 tests: 4 new `resolveFunctionsBaseUrl`
  tests + 6 new `calendarFeed.ts` loader tests, `SettingsPage.test.tsx`'s
  rewritten test being a 1-for-1 replacement, not a net addition).
- Two FOLLOW-UP NEEDED items disclosed per item 20, not touched, no ledger
  row created by the worker itself: `onResetFeedToken` (pre-existing, same
  fixture-default defect class, explicitly out of scope — §6 criterion 10),
  and the provisioning gap (nothing anywhere inserts a `calendar_feeds` row,
  so this fix makes the widget fail honestly rather than making the feature
  end-to-end functional — §6 criterion 11).

## 4. What to actually do

### 4a. Sanity-check the worktree first
Confirm the worktree path, branch, and commit `19be739` exist and that its
parent chain includes `fe62f88`. If anything here does not match, stop and
report a BLOCKER before inspecting further.

### 4b. Forbidden-file scope — proof by diff, run first, independent of the worker's own claim
```
git diff fe62f88 19be739 --stat
```
Confirm this touches only the 5 Allowed Files (worker packet §2): the 4 new/
existing `SubscribePopover.tsx`/`.test.tsx`/`loaders/calendarFeed.ts`/
`.test.ts`, plus `SettingsPage.test.tsx`. Then, specifically:
```
git diff fe62f88 19be739 -- src/pages/settings/SettingsPage.tsx
```
must be **empty** — this is worker packet §2/§6 criterion 9's explicit
Forbidden-file claim; confirm it directly rather than trusting the stat
output alone (a zero-diff claim deserves its own targeted check). Also
confirm by name that none of `src/lib/supabase/client.ts`, `loader.ts`,
`functions.ts`, `settings.ts`, `types.ts`, `index.ts`, any
`supabase/functions/ics/**` or `supabase/migrations/**` file, or any other
`loaders/*.ts` file appear in the stat output. If any Forbidden file is
touched, this is a scope violation — BLOCKER per the constitution's Failure
Severity ("modifies forbidden files").

### 4c. Verify `SettingsPage.test.tsx`'s diff is limited to exactly the three permitted changes
Worker packet §6 criterion 9 is explicit that only three things may differ
from the pre-task file: (a) the rewritten `it` block asserting the real
DES-12 error banner, (b) one new top-level `vi.mock('../../lib/supabase/
loaders/calendarFeed', ...)` block, (c) the corrected module-doc bullet at
the file's proof-#4 claim (originally citing a "Subscribe" success button,
now describing the honest error state). Run
```
git diff fe62f88 19be739 -- src/pages/settings/SettingsPage.test.tsx
```
yourself and confirm the diff hunks map onto exactly these three changes and
nothing else — no other assertion, import, or fixture in the file moved.
Anything beyond these three is a MAJOR-or-worse scope violation per the
packet's own explicit restriction, even though the file itself is Allowed.

### 4d. Re-run mutations independently, in your own worktree copy (item 23)
Do not trust "confirmed RED, restored" from the self-report. Prioritize, in
order:
- **Criterion 3** (worker packet §6.3) — the multi-row cardinality hazard,
  the closest thing this task has to a security/correctness-critical proof.
  Confirm the loader's fake client (a) genuinely slices to `.limit(1)`
  rather than no-op-recording it, (b) genuinely resolves the more-recent of
  two constructed non-revoked rows with different `created_at`, and (c) that
  removing `.order(...)`/`.limit(1)` from the query function (the packet's
  own prescribed mutation) makes the fake's cardinality emulation synthesize
  a `PGRST116`-shaped error against the unfiltered two-row array, which
  `createLoader` turns into a rejection the test observes as failure.
  **Expect RED under the mutation; restore and confirm GREEN after.** Also
  independently check the fake itself is a genuine cardinality emulation and
  not a differently-worded tautology — worker packet §6.3 names this exact
  failure mode as the thing round 1's original fake fell into (MAJOR 5).
- **Criterion 9** (worker packet §6.9) — the DES-12 error-banner test. This
  criterion went through 3 packet revisions to land (round 2's own version
  used a live network call and was itself found broken under real
  `.env.local`), so it is the most likely place for a subtle residual issue.
  Confirm: (a) the test asserts `container.textContent` contains "Couldn't
  load your calendar link" (the real Banner copy, `SubscribePopover.tsx:544-
  546`, unchanged by this task); (b) the `vi.mock` of
  `'../../lib/supabase/loaders/calendarFeed'` makes zero network calls in
  either `.env.local` state (test it in both, see §4f below); (c) the
  prescribed mutation — pointing `SubscribePopover`'s default
  `loadCalendarFeed` back at `defaultLoadCalendarFeed` (the fixture) —
  produces RED (the error banner disappears, the fixture's fake success
  state and old "Subscribe" button reappear). **Run the mutation yourself;
  do not accept the worker's claim that it goes RED.**
- Time permitting, spot-check criterion 1 (`resolveFunctionsBaseUrl` mutation
  — hardcode it to always return the placeholder regardless of argument,
  expect RED on the "real URL passed" case) and criterion 4 (zero-active-rows
  fail-loud mutation — replace the throw with a fixture-shaped fallback,
  expect RED) the same way. Do not accept "worker says RED" as evidence for
  any of the 4 mutation-marked criteria without running at least the two
  prioritized above yourself.

### 4e. Independently re-measure gates and test counts, in both env states
Re-run all five gates (`tsc --noEmit`, `vite build`, `prettier --check`,
`eslint .`, `vitest run`) at commit `19be739` yourself, **with `.env.local`
absent** — the state worker packet §7/§6 criterion 12 mandates as the gated
baseline. Confirm 0 pre-existing failures, and independently derive the
before/after file and test counts rather than reusing the worker's reported
68→69 files / 1644→1654 tests. This packet's own history is full of
env-state confusion — round 2's own baseline text was self-contradictory
about which failures belong to which `.env.local` state, which is exactly
what triggered the criterion-9 rewrite in the first place. **Also run the
suite once with `.env.local` present**, even though that is not the gated
state, specifically to (a) confirm the criterion-9 mock genuinely prevents a
live network call in that state too (the property round 2's fix was built to
guarantee) and (b) note whether the same four pre-existing, task-unrelated
failures the packet names (`AppShell.test.tsx` x2, `CoachHome.test.tsx`,
`ParentHome.test.tsx`) are still the only differences, or whether anything
about this task's own change surfaces something new under that state. Flag
anything surprising; do not treat the present-`.env.local` run as gating.

### 4f. Check all 12 acceptance criteria, not only the 4 mutation-marked ones
Worker packet §6 lists 12. Mutation-marked: 1, 3, 4, 9 — covered above.
Regression baseline: 12 — covered by §4e above. The remaining 7 are
inspection-level, easy to wave through on a summary alone — check each
directly against the artifact:
- **2** — `SubscribePopover`'s destructured default for `functionsBaseUrl` is
  `resolveFunctionsBaseUrl()` (no argument), not the placeholder literal.
  Diff-based; cite the actual line.
- **5** — the query chain includes explicit `.eq('profile_id', ...)` and
  `.is('revoked_at', null)`, not relying on RLS alone (§4 of the worker
  packet explains why explicit filters are still required even though RLS
  alone would already scope correctly). Grep-provable against the committed
  source.
- **6** — `SubscribePopover`'s destructured default for `loadCalendarFeed` is
  `loadCalendarFeedReal` (imported from the new loader), not
  `defaultLoadCalendarFeed`. Diff-based, same shape as criterion 2.
- **7** — `defaultLoadCalendarFeed` and `PLACEHOLDER_SUPABASE_FUNCTIONS_URL`
  (the two symbols actually exported today, per worker packet §5 point 5)
  remain exported, with doc comments corrected to say they are no longer the
  active default, matching T105's own precedent (worker packet §3c).
  `FIXTURE_ACTIVE_FEED` stays a private, unexported `const`, unchanged — not
  newly exported. Confirm both halves: nothing deleted, nothing over-exported.
- **8** — `SubscribePopover.test.tsx`'s existing suite passes with a minimal
  diff (worker packet §6.8 predicts "one new `describe` block for the two new
  pure functions" as the expected shape, since every existing render call
  already injects explicit stubs). If the actual diff is materially larger
  than that, the worker's own output must explain why — check whether it
  does.
- **10** — `onResetFeedToken`/`defaultOnResetFeedToken` are genuinely
  untouched (diff-confirm), and the worker's own output states this plainly
  and recommends a follow-up (item 20) rather than only leaving a code
  comment. You do not create the ledger row; confirm the recommendation was
  actually made in the worker's output.
- **11** — the provisioning-gap follow-up (distinct from criterion 10) is
  similarly named plainly in the worker's own output: after this merges,
  every real user's Settings page shows the honest error Banner, not a
  working link, until a provisioning path exists — and a follow-up
  recommendation for that gap specifically. Confirm the worker's output says
  this in those terms, not merely implies the feature now works end-to-end
  (worker packet §1's explicit warning against that framing).

### 4g. Scope discipline beyond the diff stat
Beyond §4b/§4c, confirm nothing outside the 5 Allowed Files was touched,
including `docs/swarm/**`, `.claude/**`, ledger/verification-log/dispute-log/
constitution, which workers may never edit (constitution Authority
Boundaries). Confirm the worker's commit staged explicit pathspecs, never
`git add -A`/`git add .` (item 22) — check the actual commit.

## 5. Constitution excerpts relevant to this check

- **Non-Negotiables:** "Every checker must inspect the actual artifact, not
  just the worker's summary." "No worker may mark its own work complete."
  Applies directly — §3 above is what the worker claims; §4 is what you must
  actually do.
- **Item 5 (no secrets):** worker packet §3b argues `VITE_SUPABASE_URL` is
  public, not a secret, and nothing in this task references a service-role
  key. Spot-check this claim rather than accepting it outright — confirm no
  service-role key or other secret was introduced anywhere in the diff.
- **Item 6:** no PII in fixtures — confirm any new fixture `profile_id`/feed
  rows in `calendarFeed.test.ts` are fabricated strings, not anything
  resembling a real name/email.
- **Item 12:** every async screen ships loading/empty/error/populated
  (DES-12). This task's fail-loud path (criterion 4) is specifically the
  error state for this widget — confirm the DES-12 Banner is what actually
  renders, not a generic crash or blank state.
- **Item 19a:** this packet already exhausted its two-round premise-gate cap
  and received an owner-authorized final pass with no further gate round —
  §0 above. This is context for why your independent verification here
  matters more than usual, not something you are re-litigating.
- **Item 19c:** verify your own citations before submitting — applies to you
  as much as to the worker. Cite by symbol/line against the actual committed
  state at `19be739`, not by trusting a packet line number that may have
  drifted (the packet itself moved through 3 revisions).
- **Item 20:** a deliberate deferral must produce a follow-up task, never
  just a comment. Criteria 10 and 11 both test this. If you find an
  undisclosed deferral beyond these two, it is a MAJOR-or-worse finding.
- **Item 22:** explicit pathspecs only, never `git add -A`/`git add .` —
  check the worker's own commit for this.
- **Item 23:** your own mutation experiments run in your own worktree/copy,
  never the shared tree or the worker's worktree directly.
- **Item 25:** grade any security-adjacent framing (e.g. the
  `VITE_SUPABASE_URL` exposure claim, or the opaque-token-as-credential
  design in `supabase/functions/ics`) against Volt's actual small-team threat
  model, not a corporate one — do not manufacture severity because the topic
  sounds sensitive (the packet's own §3b/§8 reasoning already applies this;
  verify it, don't second-guess it into something stricter).

## 6. Failure Severity — apply directly

- **BLOCKER:** any Forbidden-file modification (including any diff at all on
  `SettingsPage.tsx` source, or any change to `SettingsPage.test.tsx` beyond
  the three named places), any broken build/typecheck, any criterion-3/9
  mutation that fails to go RED (i.e. the proof doesn't actually prove
  anything), any regression in a pre-existing test under the mandated
  `.env.local`-absent state, any secret exposed.
- **MAJOR:** a criterion claimed satisfied that is actually vacuous or
  absence-only without a positive control, an undisclosed deviation from
  worker packet §5's design, an undisclosed deferral (item 20 — criteria 10/
  11 not actually stated in the worker's output), the worker's own output
  implying the feature is now functional end-to-end rather than honestly
  erroring (worker packet §1's explicit framing requirement).
- **MINOR:** acceptable-for-now issues that should become a follow-up task —
  e.g. a real but low-consequence gap not already covered by the two
  pre-authorized follow-ups (criteria 10/11).
- **NIT:** cosmetic only.

## 7. Required checker output

Per the constitution's Evidence Requirements, your response must include:
- files inspected
- commands run (including the exact mutation diffs applied and reverted, per
  criterion, and both `.env.local` states for the gate re-run)
- relevant output (paste the actual RED/GREEN transcripts for §4d's re-run
  mutations, not a paraphrase)
- pass/fail result per criterion (all 12, not just the 4 you mutation-tested)
- exact failure reason, if any
- severity classification per finding (§6 above)
- recommended next action

**Restated: PASS/FAIL/REVISE verdict only. No merge, no ledger update, no
verification-log entry, no treating T177 as closed.** That decision belongs
to the orchestrator once your verdict is in hand.
