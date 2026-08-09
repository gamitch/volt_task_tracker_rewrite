# Linear issue description template

Copy the body below. Delete any section that has nothing real to say — an empty
heading is worse than no heading. Angle brackets mark what you replace.

---

<One or two sentences: what a user sees, concretely. Use the real value, the real
screen, the real role. If the defect is internal, say what breaks and where.>

<Second sentence if a comparison makes it land: who else sees it differently.>

## Why it is worth fixing

<What breaks, and for whom. Name the class this belongs to — hours-honesty, data
integrity, test-quality, accessibility. Skip adjectives; give the consequence.>

## Why it happens

<The cause, in one paragraph. Where the value actually comes from. If a nearby
helper looks like the fix but is not, say so here.>

## Where it renders / lives

| File | Line | What it does |
| -- | -- | -- |
| `<path>` | `<line>` | <what this site does> |

<Anything on the same lines that shares the defect but is not yet visible.>

## The one constraint

<The trap. The thing that is correct-looking and wrong, or the invariant a fix
must not break. Cite the module doc or constitution item that says so.>

## Size and tier

<Rough size in the units that matter: display strings, functions, files, a
migration. Then: no schema change / no write path / no signature change, as
applicable.>

<Tier under item 26, named: FAST, STANDARD or HEAVY.>

<Any decision the implementer must make deliberately rather than drift into.>

## Suggested priority: <low / medium / high> urgency, <low / medium / high> cost

<Your recommendation in one line.>

1. <Reason it can wait — including whether any user has actually seen it, and what
   makes that true.>
2. <What it blocks, or "nothing is blocked on it".>

<When it stops being deferrable. A trigger, not a date.>

## Verification note

<Re-checked against `main` on YYYY-MM-DD. State whether the core claim holds.>

- **<What the filing got wrong>.** <Why it matters to the implementer.>

---

**Ledger provenance** — migrated verbatim from `docs/swarm/task-ledger.md`.

| Field | Value |
| -- | -- |
| Legacy ID | `<Tnnn>` |
| Epic | <epic> |
| Worker | <worker or *not yet packeted*> |
| Checker | <checker or —> |
| Attempts | <n> |
| Deps | <deps or —> |
| Escalated | <No / Yes> |
| Original status | <original status cell> |

<Drop the provenance table entirely on a newly filed issue — it has no ledger row.>

---

<details>
<summary>Original filing text, kept verbatim</summary>

<Paste the pre-rewrite description here, unedited. Required whenever you rewrite
an existing issue; omit on a new one.>

</details>
