# ClickUp import — all 33 rows in

> **RESOLVED 2026-08-07.** All 33 rows are now in ClickUp: 9 by API before the rate limit, the
> remaining 24 by CSV through the UI. The history below is kept because it records how the state was
> reached and the IDs a later session needs — but the "not yet imported" list is **no longer
> outstanding**.
>
> **Still outstanding, all requiring either the API or the UI:**
> - The **4 native dependency links** — `T064→T063`, `T065→T064`, `T070→T065`, `T172→T168`.
>   Addable by hand today via *Relate items or add dependencies* on each task; the API is still
>   rate limited (~20 hours as of this note).
> - **Delete the default `List`** (`901114287846`). No delete-List tool exists in the MCP set, so
>   this is a UI action regardless.
> - ~~**Verify the import by count**~~ — **done 2026-08-07 from the Space sidebar**, since the API
>   still refuses reads. Every list matches the payload exactly and the total is **33**:
>   W3 3 · W4 1 · W5 5 · W7 5 · W8 1 · W9 1 · W10 3 · Unassigned 10 · Human Gate 4.
>   W1, W2 and W6 are empty, which is correct — the payload places no open rows in them. A
>   duplicated row would have pushed one list over its expected count, and none did.
> - **`T407`'s `Tier`** should read `STANDARD`; it is the only row that exercises Tier through CSV.

**W1, 2026-08-07.** The full import stopped partway. ClickUp returned
`Rate limit exceeded. Please wait 1325 minutes` — roughly **22 hours** — on the 7th create of the
session, and reads are refused too, so the state below is taken from the create calls' own
responses rather than read back from the API. **Verify against the Space before resuming.**

Nothing is corrupted. Every task that was created landed complete; the limit refused whole calls
rather than truncating any.

## In ClickUp — 9 tasks

| Legacy | Task | List | Status |
|---|---|---|---|
| T606 | `868knpv4c` | W3 | filed |
| T607 | `868knpv72` | W3 | filed |
| T608 | `868knpvad` | W3 | filed |
| T188 | `868knqfct` | W4 | blocked on owner |
| T166 | `868knqfft` | W5 | filed |
| T182 | `868knqfk5` | W5 | filed |
| T200 | `868knqfte` | W5 | filed |
| T328 | `868knqfw8` | W5 | filed |
| T331 | `868knqg1f` | W5 | filed |

## Not yet imported — 24

`T064` `T159` `T167` `T168` — W7
`T326` — W7 · `T329` — W8 · `T333` — W9
`T171` `T172` `T332` — W10
`T407` `T507` `T512` `T600` `T610` `T612` `T614` `T705` `T806` `T807` — Unassigned
`T052` `T063` `T065` `T070` — Human gates

Resume by taking `docs/swarm/active/clickup-migration-payload.json`, skipping the 9 legacy IDs
above, and creating the rest. `Legacy ID` makes a duplicate detectable, so a re-run that overlaps
is recoverable rather than destructive — but check before re-creating.

## Also outstanding

**The 4 native dependency links are not made.** Every one has at least one end still unimported, so
none could have been created yet:

`T064→T063` · `T065→T064` · `T070→T065` · `T172→T168`

**The default `List` (`901114287846`) still exists** and should be deleted once the import lands.

## IDs needed to resume

Space `VOLT Portal` = `90114256006`

| List | ID | | List | ID |
|---|---|---|---|---|
| W1 | `901114288148` | | W7 | `901114288159` |
| W2 | `901114288153` | | W8 | `901114288160` |
| W3 | `901114288154` | | W9 | `901114288163` |
| W4 | `901114288155` | | W10 | `901114288166` |
| W5 | `901114288157` | | Unassigned | `901114288171` |
| W6 | `901114288158` | | Human Gate | `901114288213` |

Note the Human gates list is named **`Human Gate`** in ClickUp, singular, where the payload's key is
`Human gates`. Map by ID, not by name.

| Custom field | ID | Values |
|---|---|---|
| `Legacy ID` | `b2099100-bfae-470d-9c24-14df3751c598` | the `T…` string |
| `Attempts` | `78f9e05c-2f32-423c-bd0c-fb995a1b18ea` | the number as a string |
| `Blocked by (legacy)` | `3d54da5f-2fa5-4feb-bccd-f2bec21ca9c2` | comma-joined `T…` list |
| `Tier` | `1e78aeed-44e2-4fb5-a17d-23295665f577` | FAST `d0f91e32-b896-43f1-afd2-550b47bba6ea` · STANDARD `253295a9-08b9-4ee8-8897-3e60b377de1f` · HEAVY `2d9b2001-3605-481f-9788-4b985917f327` |
| `Provenance` | `4a91fce6-9b09-4e04-b462-78ae476aedf1` | owner-live-testing `7026cb3c-ff50-4f1d-9ba3-1ddfd43493ea` · premise-gate `a868c4c1-bde3-4628-9f92-4ea55ba6c0ee` · checker `45d65833-9a16-403c-a3d8-6ff27e9121fb` · audit `9e2cbce5-43e2-44ae-9522-4ed5db906f51` · other `6a322966-9cb3-4c11-a30a-a44565f73c2c` |
| `Premise gate` | `bb5db1fe-75cd-4a2f-a14e-9b0a6976bb57` | not-run `fd313f1c-d770-4408-be33-564e3ea3281b` (used for every migrated row) |

Rules applied on every row so far: status comes from the payload verbatim, `Premise gate` is set to
`not-run`, `Tier` is omitted when the source is blank, `worker` and `checker` are dropped per the
owner's ruling, and `Blocked by (legacy)` is set only when a row has dependencies on rows outside
the 33.

## One discrepancy worth a ruling

`CLICKUP-MIGRATION.md` describes the Human gates list as "T063–T065, T070", which reads as
including **T064**. The payload puts T064 in **W7** with status `Filed`, and the ledger supports the
payload: T063, T065 and T070 all carry a literal `**HUMAN GATE**` marker in their titles, and T064
does not — its title is "Roster → accounts post-migration verification (MIG-05)". The fourth human
gate is **T052**, which the doc's parenthetical omits.

So the payload is right and the doc's shorthand is loose. Worth correcting in the doc, because the
consequence of believing it is putting a human-only row where an agent can claim it.

## What actually tripped the limit — pace the resume

ClickUp documents **100 requests per minute per token** on Free/Unlimited/Business, and a window
that size resets in a minute. It cannot produce the ~22 hour cooldown seen here, and volume was not
the cause either: about 44 tool calls reached ClickUp across a 90-minute session.

The likely trigger is **burst shape, not total volume** — this session fired 11 `create_list` calls
in one parallel batch and later 5 `create_task` calls in another. If each tool call fans out into
several underlying requests, a batch like that can exceed 100 in a single second.

The penalty is far harsher than the documented rule (it locks reads too, and counts down in
minutes), so it appears to come from the MCP connector rather than ClickUp's published limit. That
could not be confirmed from inside the session, because every read was refused as well.

**When resuming: issue creates sequentially, not in parallel batches.** 24 rows one at a time stays
comfortably inside 100/min even if each call costs several requests.

## CSV route: the W9 test, and why Tier looked broken

`W9.csv` imported cleanly, with one apparent gap — `Tier` did not map. **It is not a mapping
failure.** Its only row, T333, has no Tier in the source, so there was nothing to map.

Only **2 of the 33 rows carry a Tier at all**: T606 (HEAVY, already imported by API and confirmed
rendering) and T407 (STANDARD, in `Unassigned.csv`). Every row in `W9`, `W7`, `W8`, `W10` and
`Human-gates` is blank at source. So **T407 is the only row that can test Tier through CSV**, and if
it lands blank the fix is one field on one task.

Do not read the 31 blank Tiers as migration damage. It is the gap `CLICKUP-MIGRATION.md` already
records — invisible as optional prose in Markdown, obvious as 31 blanks in a field — and it is owner
review work, not an import defect.

## COMPLETE 2026-08-08 — dependencies wired, CSV Markdown repaired

**All four native dependency links created and verified** by re-reading each task's
`dependencies_count`, not by trusting the success flag: `T064→T063`, `T065→T064`, `T070→T065`,
`T172→T168`, all as `waiting_on`.

**All 24 CSV-imported descriptions repaired.** The importer had escaped every Markdown special
character, storing `\*\*bold\*\*`, `` \`code\` `` and even `v\_student\_goal\_projection`, so the
formatting rendered as literal backslashes and asterisks. Each was rewritten from
`clickup-migration-payload.json` via `update_task`.

**How the repair was proven, since "it looks right" is not evidence here:** ClickUp's
`text_content` field renders the description as plain text. While the Markdown was escaped,
`text_content` still contained the literal `**` and backtick markers, because they were data. After
the repair it contains none of them — the markers are consumed as syntax. That flip is what
distinguishes parsed Markdown from escaped text, and it was checked on T070, T512 and T063.

T063 was the sharpest check: it is the 9-cell row whose columns are shifted, and it came through
with the correct title (`**HUMAN GATE** — MIG-04 validation gates + sign-off`) rather than the
`worker-implementer (sonnet)` a fixed-index parse produces, with its dependency intact.

**Pacing held.** Roughly 32 calls across the session, issued at most two at a time, and the limit
was never approached — against the 11-parallel burst that triggered the 22-hour lockout.

### Still open

- **Delete the default `List`** (`901114287846`) — empty, still carries a competing 10-status
  override, and no delete-List tool exists in the MCP set, so it is a UI action.
- **`T407`'s `Tier`** should read `STANDARD` — the only row that exercises Tier through CSV.
- **Four task names carry literal `**HUMAN GATE**` markers** (T052, T063, T065, T070), because the
  ledger titles use bold and ClickUp names are plain text. The `human gate` status already carries
  that meaning, so the markers are redundant and could be stripped. Not done — awaiting a decision.
