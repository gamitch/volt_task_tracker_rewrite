# Deliverable B — Linear filing draft (item 20 deferral from GAM-315)

Written per item 30 / `.claude/skills/linear-task-writing`. Label `gate/human`
(no machine may close it — the action is in Linear's settings, outside the
repository). Tier `tier/fast` for the repo-side work, which is nil; the owner
action is the whole task.

**Title**

> Three unscoped Linear git automations are live where item 28g asked for one — `start → In Progress` is the rule that moved GAM-304 backwards

**Body**

---

Merging a pull request whose branch is named after an issue moves that issue,
whatever the PR body says. On 2026-08-10 that closed `GAM-304` four times from
branches carrying none of its work, and on the fifth — the PR that actually
fixed it, `Closes GAM-304` on body line 1 — it moved the issue *backwards* from
`In Review` to `In Progress`. The owner closed it by hand.

Both behaviours come from the same place: team `GAM` has **three** git
automations enabled, and all three are unscoped.

```
event=start   targetBranch=null (ANY) -> In Progress (started)
event=review  targetBranch=null (ANY) -> In Review   (started)
event=merge   targetBranch=null (ANY) -> Done        (completed)
```

Constitution item 28g asked the owner to enable one of these, *PR merged →
Done*. Three are on, and the other two are recorded nowhere.

## Why it is worth fixing

`Done` is the one state nobody re-reads. An issue that reaches it silently is
this tracker's worst failure mode, and `GAM-304` reached it four times on the
strength of a substring in a branch name. It stayed closed for twenty seconds
on the first occasion and was rescued by an unrelated move back to `Todo`.

The second failure is subtler and cost real owner time: `start → In Progress`
outranks `merge → Done` when any other linked PR is still open, so the merge of
an issue's own fix can move it backwards. That is what happened at 14:00:04Z,
with `#142` still open.

Nothing is blocked on this. Every issue with more than one linked PR is
exposed, and that is now common.

## Why it happens

Linear puts a PR in an issue's linked set when the branch name carries the
identifier, when the body carries a magic word, and — measured, though
confounded with the negated-magic-word case — when the title carries the
identifier. The three automations then compute the issue's state from the
**aggregate** of that set rather than from the merge event, so `merge → Done`
fires only when the merging PR is the last one open.

`GAM-315` fixes the documentation side of this: it corrects item 28f, which
claimed a branch-name identifier "links only", and adds a convention keeping
mention-branches out of the linked set. **That is a mitigation, not a fix.** It
depends on every future agent naming branches correctly. Scoping or disabling
the automations is the only control that does not.

## Where it lives

| Where | What |
| -- | -- |
| Linear → Settings → Team `GAM` → Integrations → GitHub → pull request automation | The three rules above. Not in the repository. |
| `docs/swarm/constitution.md` item 28g | Asked for one automation; corrected by GAM-315 to record all three |
| `docs/swarm/constitution.md` item 28f | The "links only" claim GAM-315 removes |

Reproduce the configuration without opening the UI — `LINEAR_API_KEY` is
already what `scripts/linear/*.mjs` use:

```js
import { gql } from './scripts/linear/client.mjs';
await gql('{ teams(first:5){ nodes{ key gitAutomationStates(first:30){ nodes{ event targetBranch{ id branchPattern isRegex } state{ name type } } } } } }');
```

## The one constraint

**`targetBranch` cannot express this.** It scopes the PR's *base* branch — the
branch being merged into — not its head. Every PR here targets `main`, so no
`targetBranch` pattern can distinguish a branch that does an issue's work from
one that merely mentions it. Do not reach for it as the fix.

That leaves three real options, and the choice is a judgement about which
failure is cheaper:

1. **Disable `start → In Progress`.** Stops the backwards move. Does not stop a
   wrong close, and gives up automatic `In Progress` on first push.
2. **Disable `merge → Done`.** Stops every wrong close. Also stops every right
   one — issues sit in `In Review` until closed by hand, which is what item 28e
   already asks agents to do, so the cost falls on the owner rather than on
   correctness.
3. **Leave all three on** and rely on GAM-315's branch-naming convention. Zero
   setup, and it fails the first time an agent names a branch carelessly.

## Size and tier

No repository change. One decision and a few clicks in Linear settings, plus a
one-line update to item 28g afterwards to record what was chosen. `gate/human`:
no agent may change a workspace setting, and no machine may close this row.

## Suggested priority

**Medium urgency, near-zero cost — but decide it, do not let it sit.**

GAM-315's documentation fix lands first and removes the surprise, which is the
part that actually hurt. After that this is a defence-in-depth question rather
than a live bug, so it can wait weeks.

It stops being deferrable the first time an agent needs a branch that mentions
an issue it is not implementing and gets the naming wrong — which has already
happened four times in one day, before the convention existed to be got wrong.

Recommendation: **option 1, disable `start → In Progress`.** It removes the
failure that cost owner time and could not have been caught by reading, keeps
automatic closing (which agents rely on under item 28e/28f), and leaves the
wrong-close risk to the naming convention, where a mistake is visible in the
branch name rather than invisible in a state history.

## Verification note

Measured 2026-08-10 against `main` `43d99c7`. The automation configuration is
**read from Linear's `gitAutomationStates`**, not inferred from behaviour — the
filing that raised this (GAM-315) listed "whether the automation is scoped or
global" as unverified, and it is now answered: unscoped.

- The aggregate-state hypothesis was GAM-315's, marked unverified. It is
  confirmed: `merge → Done` fired on each of #138, #139, #140, #141, #144 (each
  the last open linked PR at its merge) and not on #143, the only merge with
  another linked PR open.
- **Correction to GAM-315's own figures.** It states four wrong closes; there
  are five. Of GAM-304's seven linked PRs, six intended no magic word and three
  contain no magic-word token at all.
- **Unverified, deliberately.** Whether a PR *title* identifier links on its
  own cannot be separated from the negated-magic-word case by any data in this
  repository — the only two candidate PRs (#132, #131) carry a magic-word token
  in the body. Settling it means firing a live automation against the tracker,
  and it changes no prescription, so it was not run.
- **Untested channels.** Whether a commit message or a PR comment can create a
  link was not measured. If either can, the branch-naming convention has a hole
  and option 3 is weaker than it looks.
