# GAM-455 run log

Issue: Coach dashboard prints raw float hours — Hours by team and Top events render 3.999998805h
Tier (per dispatch label): `tier/fast` — confirmed against constitution item 26: two lines, one file,
no write path/schema/RLS/auth, no signature change, ~2 line production change, named mutation available
(revert either rounding call, guarding test goes red). FAST is correct; not tier/unreviewed so no re-tiering needed.

- 2026-08-21 · **claimed** GAM-455 Todo → In Progress via Linear API (issueUpdate), then re-read the
  issue by id and confirmed `state.name == "In Progress"`. This is the read-back item 28c requires.
