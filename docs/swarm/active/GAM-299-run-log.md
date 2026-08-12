# GAM-299 run log

`T806 — events/event_sessions RLS scopes by the legacy students.team_id`

Dispatched from Linear 2026-08-12. Branch `claude/gam-299-events-rls-memberships`.

Append-only. Every line is written **before** the thing it describes is waited on,
so that if a line is the last one in this file, the run died holding whatever that
line names.

---

- **Claimed.** Read `AGENTS.md` § "Where work comes from" and `docs/swarm/constitution.md`
  (items 18, 19, 26, 28) first. Fetched GAM-299 live from Linear.
- **Tier judged HEAVY** (item 26; done before `In Progress` per item 28d). Reasoning:
  the change is a new `supabase/migrations/` file that drops and recreates two RLS
  `select` policies. Item 26 names "RLS/auth/role logic" and "a migration" as
  HEAVY triggers directly, and item 18's first two bullets (creates a file under
  `supabase/migrations/`, creates or modifies an RLS policy) both fire, so the
  worker also carries a `model: "opus"` override. The heavier reading is also the
  correct one on consequences: the issue itself records that moving the policy onto
  memberships without handling the missing-membership gap turns "one team's events
  are missing" into "every event is missing", which is a lie-to-the-user-about-their-
  own-data failure — item 26's exact test.
- **Label swapped** `tier/unreviewed` → `tier/heavy`, then state `Todo → In Progress`,
  then re-read: state `In Progress`, labels `w5` + `heavy`. Claim confirmed (item 28c).
