# Worker Packet: T140 — give `AppShell` the pass-through props its providers already accept

Small, additive task. One component signature, two optional props, no behaviour
change for any existing caller. **This is T139's shape one level up** — read
`docs/swarm/archive/T139-worker-packet.md` and its output first; the pattern,
the traps and the test approach all transfer.

**Packet SHA: pin this.** Before writing your output doc, run
`git log -1 --format=%H -- docs/swarm/active/T140-worker-packet.md` and confirm
it matches the SHA named in your dispatch prompt.

## FIRST — merge the working branch

```
git fetch origin
git merge origin/claude/swarm-plan-zl575z
```

Report the result. **If it conflicts, stop and report.**

## Why this exists

T139 gave `RosterShell` pass-through props so the roster tabs can take fixture
loaders. It closed half the problem. **The KPI strip above them still renders a
Supabase-not-configured error**, so a `/roster` capture is still not clean — and
the same is true of every other chrome-bearing page, since `KpiStrip` is mounted
once for all of them.

The cause is identical to T139's: the seams already exist and `AppShell` swallows
them.

- `SeasonProvider` exposes `loadActiveSeason?: LoadActiveSeasonFn`
  (`SeasonProvider.tsx:165`), defaulting to the real loader at `:170`.
- `KpiStrip` exposes `loadKpiStripData?: LoadKpiStripDataFn`
  (`KpiStrip.tsx:146`), defaulting to the real loader at `:149`.
- `AppShell` renders `<SeasonProvider>` (`:135`) and `<KpiStrip />` (`:141`) with
  **no props at all**, and `AppShellProps` (`:92-94`) declares only `children`.

## The change

```ts
export interface AppShellProps {
  children: ReactNode;
  seasonProviderProps?: Omit<SeasonProviderProps, 'children'>;
  kpiStripProps?: KpiStripProps;
}
```

`SeasonProviderProps` includes `children`, which `AppShell` supplies itself —
hence the `Omit`. `KpiStripProps` has no `children`, so it passes through whole.
Import both types; do not restate either shape.

Spread each into its element. Every prop optional; every default stays the real
loader. `src/App.tsx:30` renders `<AppShell>` with no props and is a forbidden
file — it must keep compiling and behaving identically.

## Trap — the chromeless branch must stay unwrapped

`AppShell.tsx:130-132` returns `<>{children}</>` for chromeless routes
(`/login`, `/accept-invite`, `/kiosk/:sessionId`, `/meetings/live/:sessionId`),
**before** the `SeasonProvider`-wrapped branch. That is deliberate and load-
bearing: `SeasonProvider.tsx:67-99` documents at length why those routes must not
mount it — they render pre-auth, `public.seasons`' only read policy is
`is_staff()`, so an anonymous query returns an RLS-denied empty result that is
indistinguishable from the real "zero seasons exist" state.

**Do not wrap the chromeless branch**, and do not add a provider there "so the
props work everywhere". Adding pass-through props is not a reason to change which
routes get a provider. If a chromeless route ever needs season data that is a
separate decision with its own packet.

Note also that `useActiveSeason()` **throws** outside a provider
(`SeasonProvider.tsx:209-215`) — that fail-loud posture is intentional and must
survive.

## Explicitly out of scope

- **Actually capturing any screenshot.** This task ships the seam. The capture is
  whatever task next needs a figure.
- **Changing what the KPI strip renders in its error state.** Its DES-12 states
  are already built and checked.
- **Wiring real Supabase config into the test/capture environment.** Not the
  approach; injection is.

## Allowed Files

- `src/app/AppShell.tsx`
- `src/app/AppShell.test.tsx`
- `docs/swarm/active/T140-worker-output.md` (create)

## Forbidden Files

- `src/App.tsx` — the no-props call site must keep working untouched.
- `src/app/SeasonProvider.tsx`, `src/components/kpi/KpiStrip.tsx` — their props
  already exist. If one genuinely does not expose what you need, **stop and
  report**; do not add a prop to a child.
- `src/app/router.tsx`, `src/app/guards.tsx`.
- `docs/swarm/constitution.md`, `task-ledger.md`, `verification-log.md`,
  `dispute-log.md`, `.claude/**`.

## Acceptance Criteria

1. `AppShellProps` gains two optional props, each typed from the child's own
   exported interface (with `Omit<..., 'children'>` on the provider). No invented
   or restated prop shapes.
2. `<AppShell>{children}</AppShell>` with no other props renders exactly as it
   does today. The existing **19** tests in `AppShell.test.tsx` pass
   **unmodified** — if the shared render harness at `:83`/`:86` needs a signature
   change, that is allowed, but no `it(` body may change.
3. **The chromeless branch is byte-identical in behaviour**: still an early
   return of `<>{children}</>`, still no `SeasonProvider`. Prove it with a test,
   not an assertion in prose.
4. New tests prove each pass-through reaches its child — at minimum one per prop.
   Injecting a fixture loader must render that fixture's data, **not** an error
   state. This is the whole point; a seam with no test proving it conducts is not
   a seam.
5. `npx tsc --noEmit`, `npx vite build`, `npm run format:check` clean;
   `npx eslint .` zero errors and no new warnings (baseline **0 errors / 353
   warnings**).
6. `npx vitest run` green. Baseline is **1445 across 62 files**; this is a pure
   addition, so state your expected end count and whether you hit it. Any test
   outside `AppShell.test.tsx` that changes is a regression — report it, don't
   silence it.

**Do not certify your own work.**

## Relevant Constitution Excerpt

- Item 2 — Astryx props only from `astryx-api.md`. This task adds none; the
  `AstryxAppShell` call is unchanged.
- Item 15 — accessibility is a shipping requirement. The default render tree is
  unchanged, so there is no new a11y surface — say that rather than claiming an
  audit you did not run.
- Non-Negotiables — existing tests pass unless explicitly approved; no worker
  self-certifies.

## Required Worker Output

`docs/swarm/active/T140-worker-output.md`:

- The packet SHA you verified.
- The `AppShellProps` declaration as shipped.
- Proof criterion 2 held: the 19 existing tests, no `it(` body changed.
- How you proved criterion 3 (chromeless branch unchanged).
- Each new test, and what injection it proves.
- Test count started from and ended with.
- Full output of the commands in criteria 5–6.
- Anything unverified, stated plainly as unverified.
