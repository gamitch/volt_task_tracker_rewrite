# GAM-338 run log

Tier at dispatch: `tier/fast`. Labels: Improvement, fast, w3.

- 2026-08-14: Read `AGENTS.md` § "Where work comes from" and constitution.md
  item 28 first, per binding order. Claimed GAM-338 via direct Linear GraphQL
  mutation (`issueUpdate`, Todo → In Progress), then re-read the issue
  (`issue(id:...)`) and confirmed `state.name == "In Progress"` before opening
  any other file. If this line is the last one in this file, the run died
  holding the claim but before fetching the issue body.
