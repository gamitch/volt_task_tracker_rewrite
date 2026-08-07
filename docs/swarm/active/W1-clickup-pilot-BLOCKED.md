# ClickUp pilot — verification failed, nothing created

**W1, 2026-08-07.** Ran the pre-flight check in `CLICKUP-MIGRATION.md` "Order of operations" step 2.
It fails. **No Lists were created and no tasks were migrated.** The Space's statuses and custom
fields are not where step 1 needed to put them, and new Lists would inherit almost none of them.

Space: `VOLT Portal` = `90114256006`. It currently holds one List, ClickUp's default `List` =
`901114287846`. That List is where the configuration actually landed.

---

## 1. Custom fields — 1 of 5 is on the Space

The API partitions fields by scope, so this is a direct read, not an inference:

| Query | Returns |
|---|---|
| `get_custom_fields(space_id=90114256006)` | **`Tier` only** |
| `get_custom_fields(list_id=901114287846)` | `Tier` + `Provenance` + `Attempts` + `Legacy ID` + `Premise gate` |

`Tier` appears in both because a List inherits its Space's fields. The other four appear *only* in
the List query, which means they are defined on the default `List`, not on the Space.

**The definitions themselves are all correct** — this is purely a scope problem:

- `Tier` — dropdown, `FAST` / `STANDARD` / `HEAVY` ✓ (id `1e78aeed-…f577`)
- `Provenance` — dropdown, `owner-live-testing` / `premise-gate` / `checker` / `audit` / `other` ✓
- `Attempts` — number ✓
- `Legacy ID` — short text ✓
- `Premise gate` — dropdown, `not-run` / `REVISE` / `DISPATCH` ✓

## 2. Statuses — List-level, and there are 10, not 8

`get_list(901114287846)` returns ten statuses in this order:

`to do`(0) · `in progress`(1) · `filed`(2) · `ready to work`(3) · `in review`(4) ·
`blocked on owner`(5) · `human gate`(6) · `merged`(7) · `won't fix`(8) · `complete`(9)

Three findings:

**a. They are scoped to the List, not the Space.** Every status id is `sc901114287846_…` and every
`status_group` is `subcat_901114287846`. Both are keyed to the List's own id — ClickUp's marker for
statuses a List defines for itself, rather than ones inherited from the Space.

**b. All 8 required names are present**, plus two ClickUp defaults that were never removed: `to do`
(type `open`) and `complete` (type `closed`). The spec's 8 are meant to be the complete set; two
spare columns for "not started" and "closed" will collect rows that belong in `Filed` and `Merged`.

**c. The order does not match the spec table**, which says order matters. `to do` and `in progress`
both sit ahead of `filed` and `ready to work`, so the left edge of the board runs backwards — work
appears to start before it is filed or approved. The `Filed → Ready to work` gate is the whole
point of the status design, and it should be the first thing the board shows.

## 3. Why this blocks Lists W1–W10, `Unassigned`, `Human gates`

A new List inherits Space-level configuration only. Created against the Space as it stands today,
each of the 12 Lists would come up with `Tier` and **none of the other four fields**, including
`Legacy ID` — which `CLICKUP-MIGRATION.md` §3 calls the mapping that must survive, because every
doc and commit in the repo references `T…` numbers. Statuses would be the Space defaults, not the 8.

Creating them now produces 12 Lists that each need manual repair, and the ClickUp MCP toolset has
**no tool to delete a List** — so that mistake is not cheaply reversible in the owner's workspace.
That is why this stopped here rather than creating and fixing up afterwards.

I also cannot repair the scope myself, exactly as the doc's Setup section predicted: there is no
status setter and no custom-field setter in the toolset (`get_custom_fields` only), and
`create_list` accepts no status override. These stay owner UI steps.

---

## 4. What the owner needs to do

1. **Define the 5 custom fields at Space level** on `VOLT Portal`. Note that ClickUp fixes a
   field's scope when the field is created — check in the UI whether these four can be moved; if
   not, recreate them on the Space and delete the List-level copies, or new Lists will not see them.
2. **Define the 8 statuses at Space level**, in the spec's order, and drop the two leftovers
   (`to do`, `complete`).
3. **Delete the default `List`** once its configuration is no longer needed. It is scaffolding, and
   leaving it in place invites tasks into a List the migration does not know about.

Then this resumes at step 2 with no further input: 12 Lists, then the 3-row W3 pilot.

---

## 5. Two things to settle while the config is being fixed

**The stated reason for piloting W3 does not hold.** "Order of operations" step 3 picks W3 because
"its rows carry `owner-live-testing` provenance, so the field is exercised immediately." They do
not. All three W3 rows carry `other`:

| Row | Provenance | Tier |
|---|---|---|
| T606 | `other` | `HEAVY` |
| T607 | `other` | *(blank)* |
| T608 | `other` | *(blank)* |

The three `owner-live-testing` rows in the payload are **T333** (W9), **T806** and **T407** (both
`Unassigned`). So the pilot as specified exercises `Provenance` at one value only, and leaves
`Tier` blank on two of three rows.

W3 is still defensible as the pilot on the doc's other ground — it is the most active workflow.
But if exercising the fields is the actual goal, add T333 to the pilot, and either way the doc's
stated reason should be corrected so it does not get cited later as fact.

**Payload integrity: verified, no action needed.** 33 tasks, and the distribution matches the doc's
table exactly — Unassigned 10 · W7 5 · W5 5 · Human gates 4 · W10 3 · W3 3 · W4 1 · W8 1 · W9 1;
Filed 26 · Human gate 4 · Blocked on owner 3. Every task carries all 11 specified keys. `Tier` is
blank on 31 of 33, which is the gap the doc already documents, not a defect in the build.
