# GAM-315 run log

Issue: [GAM-315](https://linear.app/gamitch/issue/GAM-315/any-branch-named-claudegam-nnn-closes-that-issue-on-merge-item-28f) —
"Any branch named `claude/gam-nnn-*` closes that issue on merge — item 28f says
it only links, and that is false here"

Branch: `claude/gam-315-branch-link-closes` (base `43d99c7`)

Append-only. One line per milestone, committed and pushed immediately.

---

- **claimed** — read `AGENTS.md` § "Where work comes from" and constitution
  items 19, 26, 28. Fetched GAM-315 live from Linear. Set `tier/unreviewed` →
  `tier/standard`, then `Todo` → `In Progress`, then re-read: state
  `In Progress`, labels `other, standard`. Read-back confirms the claim.
- **tier judgement (item 28d / item 26)** — **STANDARD**. Trigger question:
  *can a mistake here corrupt data, or lie to a user about their own data?*
  No. The deliverable is a correction to a governance document; no code, no
  write path, no schema/RLS/migration/auth, no signature another module
  imports. **FAST is unavailable** because it requires "a named mutation exists
  that turns a test red" and a prose correction has no test to redden — the
  evidence FAST refuses to give up cannot be produced in that form here.
  **HEAVY's literal triggers do not apply** (no write path, no RLS/auth, no
  migration or metric SQL, no export another session builds against), and item
  26 forbids "it sounds important" as a trigger. So STANDARD — *but* the
  entire issue is a factual claim about an external system's behaviour that
  the filer twice marks unverified ("Hypothesis, not verified"; "Not verified:
  whether the automation is scoped or global"). That is precisely item 19's
  subject, so this row gets a **full** premise gate (item 19b) before any
  worker touches `constitution.md`, regardless of tier.
- **branch name** — follows `WORKFLOWS.md` rule 2 / item 28g deliberately,
  even though this issue is *about* that convention's hazard. Changing it
  unilaterally would pre-judge the fix. The hazard is live on this branch and
  is recorded here so the merge is not a surprise.
