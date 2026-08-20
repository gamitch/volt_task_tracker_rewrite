# GAM-421 task packet — `pr-window` preflight check

**Tier:** HEAVY (item 26). **Gate:** item 19 — no worker until `checker-premise`
returns DISPATCH.

## Context the worker needs, and nothing more

A dispatched run holds a GitHub App installation token that lives **exactly
3600 seconds**. Measured in this run from the token's own JWT claims:
`iat 2026-08-20T00:46:26Z`, `exp 2026-08-20T01:46:26Z`. The run is bounded at
`timeout-minutes: 180`. The credential the run needs at its *last* step is
therefore usually dead by the time it gets there.

`scripts/dispatch-preflight.mjs` (GAM-403) already proves *capability* at minute
1 by attempting the real operations. It cannot see this: the credential is alive
when it is checked and dead when it is used.

**This task does not fix that.** GAM-421 says so explicitly and it is right —
the fix is one of four options and the choice is the owner's, and three of them
need a file this run cannot write. This task ships the one thing the preflight
*can* contribute and currently does not: **it reports the deadline.** The
credential states its own expiry, so a run can know at minute 1 exactly how long
it has. Today nothing reads that claim and every run discovers the clock by
running out of it.

## Allowed Files — these two only

- `scripts/dispatch-preflight.mjs`
- `scripts/dispatch-preflight.test.mjs`

**Forbidden, and check before you edit:** `.github/workflows/**` is behind the
credential wall (GAM-328) — a dispatched run cannot push it, so do not edit it.
Also forbidden per the constitution: `docs/swarm/**`, `.claude/**`, `AGENTS.md`.

## The change

Add a seventh check, `pr-window`, to the **`pr` stage only**.

1. `CHECK_NAMES[7] = 'pr-window'`.
2. A new exported **pure** classifier, beside the other `classify*` functions:

   ```js
   export function classifyPrWindow({ token, now })
   ```

   - Returns `{ verdict, reason }`, and additionally `expiresAt` (ISO string)
     and `remainingMinutes` (integer) when a deadline is readable.
   - A GitHub App installation token is shaped
     `ghs_<id>_<b64url header>.<b64url payload>.<sig>`. Parse the payload for
     numeric `exp` (and `iat` when present).
   - **`PASS`** when `exp` parses and is in the future. `reason` names the
     absolute deadline and the minutes remaining, e.g.
     `PR window closes 2026-08-20T01:46:26Z -- 57 min left of a 60 min token;
     open the PR before then, not after the work.`
   - **`WARN`** when `exp` parses and is already in the past.
   - **`INFO`** when no deadline can be read — an opaque token, a PAT, a
     malformed payload, a payload with no numeric `exp`, or a missing token.
     `reason` says the credential is opaque and no deadline is available.

3. Wire it into `runPrStage` as `{ id: 7, name: CHECK_NAMES[7], stage: 'pr', ...}`
   after the existing `pr-create` check. In the early-return branch (credential
   absent, check 1 FAIL) push it as `SKIP`, matching how checks 2/3/5 behave
   there.

### Hard constraints

- **Never `FAIL`.** `evaluate()` fails the whole preflight on any `FAIL`, and an
  unreadable expiry is not a reason to abort a run — a long-lived PAT is
  legitimately opaque. An expired token is already caught by `repo-access`.
- **No I/O in the classifier.** It matches the file's existing discipline: pure
  `classify*` functions, all network/git behind `fetchImpl`/`gitImpl`. Take
  `now` as a parameter so the test is deterministic — do not call `Date.now()`
  inside it.
- **Never put the token in `reason`.** `redact()` is a backstop, not a licence;
  the string must not contain token material in the first place.
- **Node standard library only.** A dispatch checkout has no `node_modules`.
- Decoding must not throw on any input. Malformed base64, absent segments, a
  payload that is not JSON, `exp` not a number → `INFO`, never an exception.

## Acceptance criteria — each is measurable with what exists today

1. `node --test scripts/dispatch-preflight.test.mjs` passes, including new cases
   for: a live token (`PASS`, correct `remainingMinutes`), an expired token
   (`WARN`), an opaque `ghp_`/non-JWT token (`INFO`), a malformed payload
   (`INFO`, no throw), a missing/empty token (`INFO`), and a payload whose `exp`
   is a string rather than a number (`INFO`).
2. `runPreflight({ stage: 'pr', ... })` returns a check with `id: 7` and
   `exitCode` is unchanged from before this task for every existing fixture —
   i.e. adding this check cannot turn a green preflight red. Assert it.
3. `formatReport` renders the new check without breaking the existing layout.
4. `redact(formatReport(...))` on a report built from a real-shaped token emits
   no token substring. Assert against a JWT-shaped fixture, since
   `REDACT_PATTERN`'s handling of `.` and `-` is exactly what this file's header
   records as previously broken.
5. **Named mutation, to be replayed by the orchestrator:** change the `PASS`
   branch's comparison so an expired token also returns `PASS`. The expired-token
   test must go red. Report the real red output and exit code.

## Least confident decisions (item 19d) — attack these first

1. **That this belongs in the preflight at all.** GAM-421 states "the fix does
   not live in the preflight" and rules out a second capability check as
   "moving discovery two minutes earlier". I claim reporting a *deadline* is a
   different kind of thing from re-checking *capability*. **Wrong if** the gate
   judges it the same thing wearing a new name, or if shipping it lets anyone
   read GAM-421 as addressed when the actual fix is untouched.
2. **That the check must never `FAIL`.** **Wrong if** a run holding an
   already-expired credential ought to hard-stop at minute 1 rather than
   proceed — in which case `WARN` is too weak and the expired case should fail.
3. **That `exp` is the operative deadline.** **Wrong if** GitHub revokes the
   installation token earlier than `exp` (e.g. at job end), or if the token the
   agent holds at PR time is not the one it held at preflight time. Note the
   file's own header asserts `claude-code-action` *replaces* `GH_TOKEN` — so
   the preflight may be measuring a credential that is later swapped.
4. **That the `ghs_<id>_<jwt>` shape is stable enough to parse.** **Wrong if**
   older or future installation tokens are opaque rather than JWT-shaped, which
   would silently degrade every run to `INFO`. The `INFO` fallback is designed
   for exactly this, but if it is the *common* path the check is worthless.
5. **That the scope stops here.** I am shipping a diagnostic plus doctrine and
   deliberately not choosing among GAM-421's four options. **Wrong if** the
   owner expected this run to come back with a recommendation, or with the
   workflow patch for option 1 or 3 preserved as a `format-patch` artifact.
