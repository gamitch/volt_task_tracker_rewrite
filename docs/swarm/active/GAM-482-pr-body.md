Closes GAM-482

## What changed

Constitution item 2 was one sentence restating PRD DES-19, and it was being read as the wall around the entire design system. It now separates the two questions it had been answering with one answer — *what props does an Astryx component have* (item 2's business) and *may we use a component Astryx does not ship* (items 8, 9 and 11's business) — and supplies the procedure the second question never had.

- **2a — the prop rule, unchanged.** `astryx-api.md` is still the only legal source for an Astryx prop; an absent prop is still presumed hallucinated → MAJOR. DES-19 is not deviated from.
- **2b — correcting `astryx-api.md` is legal for any agent**, gated on evidence rather than rank: installed source cited by path and line, DES-20 CLI cross-check, marked dated annotation leaving vendor text intact, same PR as the use, and independent re-verification by the checker.
- **2c — a non-Astryx component is legal when the gap is measured first**, on D021's standard: cite what Astryx ships, state what it cannot do. The record carries the measured gap, the alternatives and why they lost, and the disclosed divergence.
- **2d** holds substitute components to the same citation discipline against their own installed source.
- **2e — item 8 is untouched and still BLOCKER.** One component is not a design system, and "the Astryx one is awkward to style" is a DES-21 escalation, not a gap.

Items 9 and 11 gained cross-references to 2c. D004 Ruling C gained a dated addendum: its reasoning is superseded, its outcome stands until someone runs the 2b route on `useAppShellMobile`.

## What the issue got wrong

Nothing — GAM-482 was filed after the work, so no premise gate ran against it and it makes no claim this PR falsified. Two things verification surfaced while writing it, both recorded in the issue's own `Verification note` rather than quietly fixed:

- **`VOLT_Portal_PRD.md` is not at the repo root**, where constitution item 1's "Authoritative spec: `VOLT_Portal_PRD.md` v1.5" implies. It is at `docs/swarm/`, beside a `VOLT_Portal_PRD_v2.md`. A `find` at root returns nothing. Not fixed here — item 1 is out of this PR's scope, and the ambiguity is worth someone's deliberate attention rather than a drive-by edit.
- **The issue's line numbers are pre-change** and item 2 now spans ~95 lines instead of one, so items 9 and 11 have shifted. Anyone citing those numbers later is reading history.

One correction to my own reasoning, made mid-task and worth stating because it changed the shape of the work: this looked like it needed a PRD deviation on the D002/D013/D020 pattern. It does not. DES-19's subject is "the authoritative component API" and its presumption is about a prop name in a file — it is prop-scoped and never governed components. So no dispute entry recording a deviation was required, only a scope clarification plus the missing procedure.

## Tier, stated and defended

**FAST**, with one criterion declared inapplicable rather than quietly passed.

Item 26's FAST gate requires "a named mutation exists that turns a test red." **No mutation was run and none is claimed** — no test covers a governance document, so there is nothing to turn red. Every other FAST condition holds: no write path, no schema/RLS/migration/auth logic, no signature another module imports, and zero lines of production change.

STANDARD's argument was that the amendment governs how every future UI task is graded, so a second reader has value. It loses on mechanism: a worker cannot check a constitution amendment against anything, because the constitution *is* the standard a checker would check against. The real review for this change is the owner reading it, which is what this PR is for.

HEAVY was never arguable — no write path, no destructive operation, no migration, no metric SQL.

**A process deviation to declare:** Authority Boundaries names `boss-architect` and `boss-arbiter` as the only agents who may modify `constitution.md`. This was edited by the orchestrator on the owner's direct authorization. That is how items 6, 19d, 25 and 27 arrived, and it matches commits `f166306` and `3494e51` — but the rule's text does not describe that path, only the practice does. Flagged rather than assumed; if formal boss-architect ratification is wanted before this binds checkers, it should happen before merge.

## Verification

```
GATE RUN — bb59e6a on claude/astryx-prop-source-precedence-60bfby — tree clean

  1 tsc              exit 0  PASS
  2 vite build       exit 0  PASS
  3 format:check     exit 0  PASS
  4 eslint           exit 0  PASS       0 errors, 380 warnings
  5 vitest (full)    exit 0  PASS       109 files / 2666 tests  (no baseline given — regression not checked)
  6 vitest (scoped)      –  SKIP
                            no scope given and none derivable from the diff -- pass --scope <path> to run it

VERDICT: PASS — 5 of 6 gates. NOT all six: 1 skipped.
```

**5 of 6, and gate 6's SKIP is correct here** — the diff touches only `docs/swarm/**`, so no scope is derivable and there is no source path to scope to. The gates ran against `bb59e6a`; the later commit on this branch is the D004 addendum's GAM-483 cross-reference, also docs-only.

The gates first refused to run at all — `node_modules` was missing in this fresh clone and `gates.py` correctly reported `UNTRUSTWORTHY` rather than passing a green run against nothing. `npm ci` then reran them. Recording it because a skipped-because-broken run and a skipped-because-inapplicable run look identical in a summary.

**Mutations: none.** There is no code under test in this diff.

**What was measured by hand instead**, since the gates cannot speak to a governance change:

| Claim | How it was checked | Result |
| -- | -- | -- |
| DES-19 is prop-scoped | Read `docs/swarm/VOLT_Portal_PRD.md:239` | Confirmed — its subject is the component API and its presumption is about a prop name |
| `astryx-api.md` is not on the forbidden-files list | Read Authority Boundaries in `constitution.md` | Confirmed absent — the file was already worker-writable with no gate |
| `useAppShellMobile` is absent from the doc | `grep -c` on `astryx-api.md` | `0` |
| …but exists in the installed package | `grep -rl` on `node_modules/@astryxdesign/core/src/` | Present in 3 files, exported at `AppShell/index.ts:23`, defined at `AppShell/AppShellMobileContext.tsx:52` |
| The drawer defect is still live | Read `src/components/nav/MobileNav.tsx:100-115` | The deferral comment is intact and still cites item 2 as the blocker |

## Scope

No user-visible surface, so item 27 does not apply — nothing on screen changes and there is no data path to connect. This closes **Passed**, not Partial.

## Follow-ups filed

- **GAM-483** — the mobile nav drawer stays open after you tap a destination. `Backlog`, `tier/unreviewed`, filed before this PR opened.

  This is item 20's failure shape found in the act of citing it. D004 Ruling C classified the defect MINOR and logged it as a "follow-up candidate"; no row was ever created, so for a month the deferral lived only in a dispute entry and a code comment. My own addendum initially asserted the follow-up "stays open" — against nothing in the queue. Filing GAM-483 and rewording the addendum to cite it is the fix.

## Known gaps, disclosed

- **2b has never been run.** Its five bullets are written but no annotation has been produced under them, so the procedure is unexercised. GAM-483 is deliberately the first use and is tiered STANDARD for that reason — a checker should replay the first instance rather than the orchestrator self-certifying it.
- **`useAppShellMobile` is not authorized by this PR.** 2b makes it fixable rather than forbidden; it stays unusable until someone actually produces the citation, cross-check, annotation and re-verification.
- **2c's "Astryx ships nothing that can do the job" is a judgement, not a measurement**, and 2e is the only thing standing between it and item 8. The gap record is what makes the judgement reviewable, but a determined reader could still argue a UI kit in one component at a time. If that starts happening, 2e needs teeth rather than prose.
- **Nothing enforces any of this mechanically.** No lint rule, no CI check — it binds only agents who read the constitution, which is the same footing every other item stands on.

Linear-Issue: GAM-482
