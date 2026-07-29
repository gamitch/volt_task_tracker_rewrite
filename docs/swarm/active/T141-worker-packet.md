# Worker Packet: T141 — a chromeless-branch guard that can actually detect a provider wrap

Very small. One test file, one new test, one comment correction.

**Packet SHA: pin this.** Before writing your output doc, run
`git log -1 --format=%H -- docs/swarm/active/T141-worker-packet.md` and confirm
it matches the SHA in your dispatch prompt.

## FIRST — merge the working branch

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```

Report the result. **If it conflicts, stop and report.**

## Why this exists

`AppShell.tsx` deliberately early-returns `<>{children}</>` for chromeless routes
(`/login`, `/accept-invite`, `/kiosk/:sessionId`, `/meetings/live/:sessionId`)
**without** mounting `SeasonProvider`. `SeasonProvider.tsx:67-99` documents why:
those routes render pre-auth, so a season query there is RLS-denied and returns
an empty result indistinguishable from the real "zero seasons exist" state.

T140 added a test meant to guard that. **It cannot.** T140's checker wrapped the
chromeless branch in `<SeasonProvider>` — the exact forbidden regression — and
**all 23 tests still passed.** The provider is DOM-transparent
(`SeasonProvider.tsx:203` renders only a context Provider around `children`), and
no chromeless page consumes `useActiveSeason()` (`Kiosk.tsx:41` and
`LiveConsole.tsx:58` both document that they deliberately do not). So nothing
asserted against `container` can ever detect it.

The behaviour is correct today. What is missing is anything that would catch it
changing.

## The change

Render a probe child that calls `useActiveSeason()` on a chromeless route, and
assert it **throws**. That is the only observable difference between wrapped and
unwrapped, because `useActiveSeason()` (`SeasonProvider.tsx:209-215`) throws
`useActiveSeason() must be called within a <SeasonProvider>.` outside a provider.

Assert the **message**, not merely that something threw — a probe that throws for
an unrelated reason would otherwise pass and prove nothing.

Add a matching positive case on an ordinary chrome-bearing route, where the same
probe must **not** throw. Without it the test passes if the probe is broken.

**The acceptance test for your own work** — run it and report the output:

> Wrap the chromeless branch in
> `<SeasonProvider {...seasonProviderProps}>{children}</SeasonProvider>` in
> `AppShell.tsx`, run the suite, and confirm your new test **fails**. Then revert
> and confirm it passes again, verifying the file is byte-identical (`sha256sum`
> before and after).

If your test does not fail under that mutation it does not work, regardless of
what it asserts.

## Also fix — a comment that overclaims

`AppShell.test.tsx` currently carries a comment I wrote saying the existing
chromeless test does not prove provider absence and pointing at **T141** for the
version that would. Once your test lands, that is stale in the other direction.
Update it to describe what is now actually proven, and remove the forward
reference.

## Allowed Files

- `src/app/AppShell.test.tsx`
- `docs/swarm/active/T141-worker-output.md` (create)

## Forbidden Files

- `src/app/AppShell.tsx` — **except transiently, for the mutation above, which
  must be reverted and hash-verified.** It must be byte-identical when you
  finish. Do not ship any change to it.
- `src/app/SeasonProvider.tsx`, `src/components/kpi/KpiStrip.tsx`, `src/App.tsx`,
  `src/app/router.tsx`, `src/app/guards.tsx`.
- `docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`,
  `dispute-log.md`, `.claude/**`.

## Acceptance Criteria

1. A test renders a probe calling `useActiveSeason()` on a chromeless route and
   asserts it throws **with the expected message**.
2. A companion test proves the probe does not throw on a chrome-bearing route,
   so criterion 1 cannot pass because the probe is broken.
3. **You ran the mutation** in "The acceptance test" above, the new test failed,
   and `AppShell.tsx` is byte-identical afterwards. Report the before/after
   hashes and the failure output.
4. The overclaiming comment is corrected and no longer forward-references T141.
5. The existing **23** tests in `AppShell.test.tsx` pass unmodified — no `it(`
   body changed.
6. `npx tsc --noEmit`, `npx vite build`, `npm run format:check` clean;
   `npx eslint .` zero errors and no new warnings (baseline **0 errors / 353
   warnings**).
7. `npx vitest run` green. Baseline **1467 across 63 files**; state your expected
   end count and whether you hit it.

**Do not certify your own work.**

## Note on error-throwing tests

React logs error boundaries loudly. If the throw produces console noise that
makes the suite output unreadable, suppressing it **for that test only** is
acceptable — say so in your output. Do not add a global console mock.

## Required Worker Output

`docs/swarm/active/T141-worker-output.md`:

- The packet SHA you verified.
- The new tests, and what each proves.
- Criterion 3's mutation evidence: failure output, and before/after hashes of
  `AppShell.tsx`.
- Test count started from and ended with.
- Full output of the commands in criteria 6–7.
- Anything unverified, stated plainly as unverified.
