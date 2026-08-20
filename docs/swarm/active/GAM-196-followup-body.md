A dispatch run that stops and releases its issue to `Todo`, then applies
`gate/human` to stop the next machine, **immediately re-dispatches itself**. The
label arrives after the webhook that carries it, so the guard that exists to skip
gated rows never sees it. Measured on GAM-196 on 2026-08-20: the release move
landed at `03:18:47.099Z`, `gate/human` at `03:18:47.248Z`, and a second Claude
dispatch run started on the first of those and had to refuse the row by hand.

The fix is one sentence of ordering — **apply `gate/human` before the `-> Todo`
move, not after** — and it is worth writing down because the run that got it
wrong had read the rule, applied the label deliberately, and recorded in its own
log that doing so was what would stop the next machine.

## Why it is worth fixing

A `gate/human` row is one no machine may take (constitution item 28b). The
dispatch pipeline already enforces that for free: `filter.ts:358-361` skips the
delivery with reason `HUMAN_GATED` **before** `repository_dispatch` fires, so a
gated row normally costs no workflow run, no agent turns and no tokens.

Release-then-label forfeits that. The next run boots, burns its startup, reads
the constitution, discovers the gate and refuses — the correct outcome, arrived
at the expensive way. Worse, it is the *releasing* run that pays it forward: the
act intended to protect the queue is the act that fires the dispatch.

Class: process correctness / dispatch-cost. No data is affected and nothing
user-facing changes.

## Why it happens

`client_payload.labels` is a snapshot of a single Linear webhook body and is
never refreshed. `filter.ts:344` extracts the label names from `data.labels` on
the delivery, emits them at `:386-394`, and `index.ts:137-160` reads that body
once and never re-reads Linear. Only a state move into `Todo` can dispatch at all
(`filter.ts:312-341`) — a labels-only update returns `STATE_UNCHANGED`.

So the two events are asymmetric in a way that is easy to miss: **the state move
is the only one that can start a run, and the label add is the only one that can
stop it.** Sequenced move-then-label, the stopping event can never overtake the
starting one.

`hasHumanGate` is not the weak point and should not be touched. It already
matches both the path form `gate/human` and the bare child name `human`
(`filter.ts:253-259`, tested at `filter.test.ts:592-598`) — which matters,
because Linear's webhook labels carry **no parent**, so the bare form is the one
live in production. The guard is correct; it was handed a payload the label was
not in.

## Where it lives

| File | Line | What it does |
| -- | -- | -- |
| `supabase/functions/linear-dispatch/filter.ts` | `358-361` | Rule 8 — skips a `gate/human` delivery as `HUMAN_GATED` before dispatch. **Correct; do not change.** |
| `supabase/functions/linear-dispatch/filter.ts` | `312-341` | Only a state move into `Todo` dispatches; a labels-only update is `STATE_UNCHANGED`. |
| `supabase/functions/linear-dispatch/filter.ts` | `344`, `386-394` | Builds `client_payload.labels` from that one webhook body. |
| `supabase/functions/linear-dispatch/index.ts` | `137-160` | Reads the body once; never re-reads Linear. |
| `supabase/functions/linear-dispatch/filter.ts` | `253-259` | `hasHumanGate` — matches `gate/human` and bare `human`. |
| `docs/swarm/constitution.md` | item 28 | Where the ordering sentence belongs. Says `gate/human` forbids a claim; says nothing about *when* to apply it. |
| `.claude/skills/linear-task-writing/SKILL.md` | — | Contains no `gate/human` or `Todo` guidance today (grepped 2026-08-20, zero matches). Candidate second home. |

## The one constraint

**Do not file or build a dispatch-side `gate/human` guard — it exists.** The
first draft of this finding claimed *"nothing on the dispatch side filters it
either"*, reached that from grepping only `.github/workflows/`, and was refuted
by `checker-premise` against `filter.ts:358-361` and three green CI tests
(`filter.test.ts:289-294`, `:417-426`, `:562-576`). The workflow YAML genuinely
has no gate test, and correctly so: its own header says the edge function
already filters (`claude-linear-dispatch.yml:105-108`), and its `if:` at `:109`
is a defence against a hand-fired `repository_dispatch` bypassing `filter.ts`,
not a second gate.

**There is no code seam to change.** `scripts/linear/` holds only `client.mjs`,
`declaration.mjs` and `slack.mjs`; agents perform the release move by calling
GraphQL directly. The lever available is prose.

**The constitution is not the implementer's to edit.** Authority Boundaries
(`constitution.md:18-36`) reserve it for `boss-architect` and `boss-arbiter`.
The dispatch prompt is under `.github/workflows/**`, which a dispatch run cannot
push at all (`AGENTS.md` wall 1) — so if the ordering sentence is wanted there
too, it ships as a `git format-patch` artifact for an owner to apply.

## Size and tier

One or two sentences in `constitution.md` item 28, plus optionally the same
sentence in the release path a run actually reads. No schema change, no code
change, no test change.

**Tier: FAST** — but the edit lands in a boss-authority file, so it needs a
`boss-architect` dispatch rather than a worker.

Decision left open, deliberately: whether the sentence belongs in item 28e (the
completion/release rule) or as a new 28h. 28e is where a run looks when it is
finishing; a run that *refuses* may not read 28e at all, since it never got to
completion. That argues for 28b, beside the rule the label enforces.

## Suggested priority: low urgency, low cost

Write it the next time item 28 is opened for any other reason; it does not
justify its own dispatch.

1. **No user is affected and no data is at risk.** The cost is one wasted
   dispatch run per mis-sequenced release, and the wasted run still reaches the
   correct outcome — it refuses. GAM-196's second run is the only measured
   instance.
2. **Nothing is blocked on it.** GAM-196 itself is unaffected: it now sits in
   `Todo` *carrying* `gate/human`, so any future move into `Todo` carries the
   label into the payload and is skipped. This is a one-shot window at the moment
   of release, not a standing loop.
3. **Prior art:** GAM-326 (`Done`, 2026-08-11) — *"An unfinished dispatch run can
   turn its own job green by moving the issue to `Todo` — which re-dispatches it
   four seconds later"* — is the parent phenomenon, and `GAM-404-packet.md:374-382`
   records it as still unmitigated and unmeasured in code. This row is the
   label-ordering increment on it, not a rediscovery.

It stops being deferrable if `gate/human` is ever used at volume — a queue where
several rows are owner-gated makes every release a coin-flip on one wasted run.

## Verification note

Measured 2026-08-20 against `main` @ `b9396c9`, by the second Claude dispatch run
on GAM-196. Every line number above was opened. The core claim holds; one earlier
limb of it did not, and the correction is the reason this row is worth reading.

- **What the first draft got wrong.** It claimed no dispatch-side filter existed,
  from a grep of `.github/workflows/` alone. `checker-premise` refuted it against
  `filter.ts:358-361` and the CI tests. Had the row shipped as drafted, it would
  have asked someone to build a guard that has shipped since `697c0df`
  (2026-08-09).
- **What the previous GAM-196 run got wrong, and what it got right.** Its log
  says `gate/human` *"is what stops the `Todo` move from re-dispatching another
  machine into the same wall."* The **mechanism** is right — rule 8 is precisely
  that. The **application** was wrong: applied 149 ms after the move. Both
  statements are true at once.

**Executed against the committed `decideDispatch`** — reconstructed webhook
bodies, not reasoning about the code:

| Probe | Body | Result |
| -- | -- | -- |
| A | payload as observed on this dispatch, `labels: [heavy]` | `dispatch: true`, `labels: ["heavy"]` |
| B | same + bare `human` | `HUMAN_GATED` |
| C | same + grouped `human` under parent `gate` | `HUMAN_GATED` |
| D | label-add only (`updatedFrom: {labelIds}`) | `STATE_UNCHANGED` |

Probe A reproduces the second run's dispatch-prompt line `Labels:   heavy`
exactly — one label, not two. B and C prove the payload cannot have contained
`human`, or the run would never have started.

**Measured, derived and inferred, kept apart:**

- *Measured*: the two Linear history timestamps, read live via the Linear GraphQL
  API on 2026-08-20 — **not reproducible from this repository**; the second run's
  dispatch prompt printing `Labels:   heavy`; the four probe outcomes.
- *Derived from repo source*: that the trigger was the state move and not the
  label add; that `client_payload.labels` is one webhook body's snapshot and
  nothing re-reads Linear; that the payload therefore did not contain `human`.
- *Inferred, not established*: that Linear serialises `data.labels` at event time
  rather than delivery time — i.e. that the 149 ms is the *cause*. Most
  parsimonious, consistent with everything measured, but this repository cannot
  prove Linear's serialisation moment. Also inferred: that the deployed edge
  function matches the committed source. `HUMAN_GATED` has been present since the
  function's first commit, so any deployment able to dispatch at all contains it
  — but deployment is not verifiable from here.

**Side-finding worth keeping.** The prompt printed bare `heavy`, not
`tier/heavy`. That is live evidence that Linear's webhook labels carry no
`parent`, so `filter.ts`'s parentless fallback (`:137-140`, `:247`, `:256`) is
the branch actually running in production — which makes that file's warning at
`:97-128` a load-bearing measurement rather than defensive padding.

---

**Provenance**

| Field | Value |
| -- | -- |
| Filed | 2026-08-20, by the second Claude dispatch run on GAM-196, which refused the row under item 28b and measured this on the way out |
| Found by | `checker-premise` (BLOCKER on the run's own first wording), then re-verified by the run |
| Artifacts | `docs/swarm/active/GAM-196-run-log.md` § "The release move outran its own guard by 149 ms", on branch `claude/gam-196-confirmed-hours-divergence` |
| Related | GAM-326 (parent phenomenon, `Done`), GAM-196 (where it was measured, `gate/human`) |
