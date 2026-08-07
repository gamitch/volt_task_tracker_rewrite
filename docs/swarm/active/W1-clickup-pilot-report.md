# ClickUp pilot — done, and one defect that must be fixed before the other 30

**W1, 2026-08-07.** Space configuration verified, 12 Lists created, and the 3 W3 rows migrated per
`CLICKUP-MIGRATION.md` "Order of operations" steps 2–3. **Do not import the remaining 30 yet** —
the payload builder has a defect that silently truncates task descriptions, described in §4.

Space `VOLT Portal` = `90114256006`.

---

## 1. Configuration — verified Space-level

The first check failed: `Provenance`, `Attempts`, `Legacy ID` and `Premise gate` were defined on
the default `List`, and `get_custom_fields(space_id)` returned `Tier` alone. The owner moved them.
Re-checked, all five now return at Space scope, **with their original field IDs**, so they were
moved rather than recreated:

| Field | ID | Type |
|---|---|---|
| `Tier` | `1e78aeed-44e2-4fb5-a17d-23295665f577` | dropdown — FAST / STANDARD / HEAVY |
| `Provenance` | `4a91fce6-9b09-4e04-b462-78ae476aedf1` | dropdown — 5 options |
| `Attempts` | `78f9e05c-2f32-423c-bd0c-fb995a1b18ea` | number |
| `Legacy ID` | `b2099100-bfae-470d-9c24-14df3751c598` | short text |
| `Premise gate` | `bb5db1fe-75cd-4a2f-a14e-9b0a6976bb57` | dropdown — not-run / REVISE / DISPATCH |

**Statuses are Space-level too, and this is the proof.** There is no `get_space` tool, so scope was
established by creating a List and reading what it inherited. `W1` returns eight statuses whose ids
are `p90114256006_…` with `status_group: proj_90114256006` — keyed to the **Space**. The old default
`List` still returns its own ten, ids `sc901114287846_…`, group `subcat_901114287846` — keyed to the
**list**. Two different sets from two different scopes, which is what confirms the read.

Inherited order matches the spec exactly: `filed` · `ready to work` · `in progress` · `in review` ·
`blocked by owner` · `human gate` · `merged`(done) · `won't fix`(closed).

## 2. Lists — 12 created

| List | ID | | List | ID |
|---|---|---|---|---|
| W1 | `901114288148` | | W7 | `901114288159` |
| W2 | `901114288153` | | W8 | `901114288160` |
| W3 | `901114288154` | | W9 | `901114288163` |
| W4 | `901114288155` | | W10 | `901114288166` |
| W5 | `901114288157` | | Unassigned | `901114288171` |
| W6 | `901114288158` | | Human Gate | `901114288213` |

`Human Gate` was created by the owner in the UI after the API call was refused twice by this
session's permission classifier. Note it is **singular**; the payload's list key is `Human gates`.
The importer maps by ID so this is harmless, but the 4 rows targeting `Human gates` need that
mapping made explicit, not inferred by name.

**Still to delete:** the original default `List` (`901114287846`). It is the scaffolding the
configuration was first built on, it carries its own competing ten-status override, and anything
filed into it is invisible to the migration.

## 3. Pilot — 3 W3 rows migrated

| Legacy | Task | Status | Tier |
|---|---|---|---|
| T606 | [`868knpv4c`](https://app.clickup.com/t/868knpv4c) | filed | HEAVY |
| T607 | [`868knpv72`](https://app.clickup.com/t/868knpv72) | filed | *(blank in source)* |
| T608 | [`868knpvad`](https://app.clickup.com/t/868knpvad) | filed | *(blank in source)* |

Verified by re-reading each task: correct List, status `filed`, 5 custom fields attached, full
descriptions intact including literal `|` characters.

**One thing to eyeball during review.** No tool in this MCP set returns custom *field values* on
read — `get_task` gives `custom_fields_count: 5`, which proves the fields are attached, not what
they hold. The writes returned success, but the values are unconfirmed from this side. Please spot
check `Legacy ID`, `Provenance`, `Attempts` and `Premise gate` on one task in the UI.

`Premise gate` was set to `not-run` on all three. The payload carries no value for it — `not-run` is
the accurate state for a filed row, but it is this session's inference, not migrated data.

---

## 4. The defect — the payload builder loses text at escaped pipes

`task-ledger.md` is a Markdown table, so any `|` inside a cell is escaped as `\|`. **The payload
builder split rows on `|` without honouring that escape**, so a description ends at the first
escaped pipe and everything after it is dropped. Silently — the JSON is well-formed and the field
is populated, just short.

T608 is the proof, and it is why the pilot caught this. Its `description_md` was **729 characters,
ending mid-token** at ``'qr' \``. Re-parsed from the ledger with an escape-aware split, the real
cell is **1,591 characters**. What was missing:

> (3) `supabase/functions/checkin/attendance_upsert.ts:43` — **The dangerous one of the three:** it
> is a production QR check-in path, and `tsconfig.json` includes only `["src", "vite.config.ts"]`
> while `eslint.config.js:19` ignores `supabase/functions/**`, so **no gate in this repo will ever
> catch it.**

The single most operationally important sentence in the row, gone, in the artifact that was about
to become the system of record. **T807 has the identical signature** (ends at ``number \``), and any
row whose prose contains a pipe is suspect — the union types in this codebase mean that is not rare.

**Second defect, same origin: task names are capped at 117 characters**, mid-word. 10 of 33 rows hit
it. Recovery is easy — every description carries a full `**Title:**` line, and for 18 of 33 rows
that title is longer than the truncated name.

**The pilot's three rows were imported from a corrected re-parse of `task-ledger.md`, not from the
payload**, so what is in ClickUp now is right. T606 and T607 came out byte-identical to the payload;
only T608 differed. But the payload file itself is still wrong and must be rebuilt with an
escape-aware parser before the other 30 are touched.

## 5. Three smaller things the pilot surfaced

**`blocked by owner` vs `Blocked on owner`.** The Space status reads *by*; the payload sends *on*
for 3 rows (T333, T806, T407). Not a pilot issue — all three W3 rows are `Filed` — but those three
will fail or mis-set on the full import. Either rename the status or map it in the importer; the
ledger's own prose says *on*.

**Nowhere to put `worker` and `checker`.** The payload carries both for every row, and the Space has
5 custom fields, none of which is either. They are currently dropped. They are not real assignees
(`*not yet packeted*`, `—`), so a text field or nothing are both defensible — but it should be a
decision, not an omission.

**Dependencies cannot be wired for this pilot.** T606 depends on T605 and T608 on T603; both targets
are merged rows, deliberately excluded from the 33. Native ClickUp dependency links need both ends
to exist, so each was recorded as a description footnote instead. Any dep pointing at a closed row
has the same problem across the full import.

## 6. Recommended order from here

1. Owner reviews the three tasks — especially the custom field values noted in §3.
2. Rebuild the payload with an escape-aware parser; restore full titles from the `**Title:**` line.
3. Diff the rebuilt payload against the current one and confirm only truncations changed.
4. Resolve §5's three items.
5. Import the remaining 30, then wire dependencies among imported rows only.
6. Delete the default `List`.
