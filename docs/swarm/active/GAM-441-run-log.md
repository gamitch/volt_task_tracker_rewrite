# GAM-441 — run log

**Issue:** [GAM-441](https://linear.app/gamitch/issue/GAM-441/prd-still-mandates-the-table-based-meetings-page-amend-mtg-0171-for)
**Branch:** `claude/gam-441-prd-meetings-card-redesign`
**Runtime:** Claude (dispatched run)
**PR credential:** `iat 2026-08-21T05:02:24Z`, `exp 2026-08-21T06:02:24Z` — decoded, not guessed
  (AGENTS.md wall 3). Draft PR must be opened well before `exp`.

Append-only. One line per milestone, pushed immediately. If the last line of this
file is a dispatch with no matching verdict, **the run died holding that subagent** —
that is the AGENTS.md wall-2 signature, not an ambiguous ending.

---

- **05:03Z — claimed.** Read `AGENTS.md` § "Where work comes from" and
  `docs/swarm/constitution.md` items 19/26/28 before opening any other file.
  Fetched GAM-441 live from Linear (no Linear MCP tool in this runtime; used
  `scripts/linear/client.mjs` + `LINEAR_API_KEY`, the same GraphQL path the repo's
  own `linear-*.mjs` scripts use).
  Route check (item 28b): labels were `meetings-redesign`, `tier/unreviewed`,
  `Improvement` — no `gate/human`, no `executor/*`, so the missing route is the
  legacy Claude-only path and this runtime may claim it.
  **Tier judged before the state move (item 28d): `tier/fast`.** Label swapped
  `tier/unreviewed` → `tier/fast`, then `Todo → In Progress`, then **re-read**:
  `state = In Progress`, `labels = meetings-redesign, Improvement, tier/fast`.
  The claim is confirmed, not hoped for.

## Tier defence (item 26 requires this be stated and defended)

**FAST**, with an independent premise round added on top. Three legs:

1. **The FAST preconditions hold at zero.** No write path or destructive
   operation; no schema, RLS, migration, auth/role or metric-view SQL; no change
   to a signature another module imports; and *zero* lines of production change —
   the deliverables are two documentation files, two figure files and one skill
   file. Item 26's question ("can a mistake here corrupt data, or lie to a user
   about their own data?") answers no.
2. **STANDARD and HEAVY are structurally unavailable, not merely surplus.** Every
   Allowed File on this issue sits under `docs/swarm/**` or `.claude/skills/**`.
   AGENTS.md § "Ownership and protected files" is explicit: *"Workers and checkers
   must not edit `.claude/**`, `docs/swarm/**` … The primary orchestrator owns
   those records."* The constitution's Authority Boundaries say the same. So a
   tier whose defining act is "a worker implements it" cannot be executed here.
   The orchestrator implementing directly is the only lawful shape.
3. **Item 26 says take the heavier tier when two are arguable — so I take the
   heaviest verification that is actually available.** The counter-argument to
   FAST is real and worth naming: this artifact becomes the *premise* that eleven
   sibling `meetings-redesign` packets are graded against, which is precisely the
   exposure item 19 exists for (*"the planning layer is otherwise unverified …
   plans were the sole exception"*). The answer is to put an independent
   `checker-premise` round on the drafted amendment **before** it is final.
   `checker-premise` is read-only, so it does not collide with the protected-path
   rule in leg 2. That is strictly more checking than either FAST or STANDARD
   nominally provides, and it lands on the thing that can actually be wrong — the
   text's correctness as a premise — rather than on a worker's diff.

**One FAST clause I cannot satisfy, stated rather than faked:** item 26 requires
"a named mutation exists that turns a test red." A documentation and governance
change has no test to turn red, and I am not going to invent one to tick the box.
The clause's purpose is to guarantee the verification is real; the substitutes here
are the independent premise round above and the full six gates, both recorded below.

---

## 05:20Z — premise measured (before drafting a single word)

Every claim the issue rests on, re-checked against this branch's tree rather than
taken from the issue text (item 30c / AGENTS.md orientation step 6):

| Claim in GAM-441 | Measured | Verdict |
| -- | -- | -- |
| MTG-01 at ~:294 specifies `Section` "Upcoming"/"Past" + per-session `Item` rows | `VOLT_Portal_PRD.md:294`, exact | **holds** |
| §7.1 `/meetings` row at ~:389 lists `Section, Item, Badge` | `:389` — <code>\| `/meetings` \| all \| List page \| `Section`, `Item`, `Badge` \| MTG-01, MTG-14 \|</code> | **holds** |
| Edit-chip dated-blockquote amendment precedent at ~:286 | blockquote spans `:287–292`, owner-attributed, dated 2026-07-28 | **holds** (off by one line) |
| `docs/swarm/figures/ux-craft/` exists; `old-*.webp` are the prior standard | 71 figures; 8 `old-*.webp` present | **holds** |
| No `meetings-design` skill exists | `.claude/skills/` has 11 skills, none named `meetings-design` | **holds** |
| MTG-13 keeps attendance editable post-completion | `:310`, explicit, plus a 2026-08-03 owner ruling | **holds** |
| BEH-08 is date-rendering wayfinding | `:252` | **holds** |
| DES-05 status colors | `:210` — Present/Late/Excused/Absent → success/warning/neutral/error | **holds** |
| `src/pages/meetings/**` and `src/lib/meetings/**` exist (skill trigger paths) | both present; `MeetingsList.tsx` is 2997 lines exactly | **holds** |
| "Six UI tickets blocked" | **eleven** siblings carry `meetings-redesign` (GAM-442…452) | **understated, not wrong** |

**The premise holds. The run proceeds.** Two findings that change the work, both
recorded here before drafting so neither can be quietly absorbed:

### Finding A — the two figures cannot be produced, and must not be faked (BLOCKS deliverable 3)

The issue's design-canvas attachment is
`https://claude.ai/code/artifact/d5ea5a27-eee6-4196-b895-63b85b5790ba`. Measured
from this container:

- `GET` the canvas → **HTTP 200, 14,081 bytes of SPA skeleton** (`skel-logo`,
  `skel-title`, `hdr-degraded`, `robots: noindex, nofollow`). Occurrences of
  `meetings`, `artboard`, `seriescard`, `volt` in the payload: **0**. The artboards
  are client-rendered behind a claude.ai login this run does not hold.
- `GET /api/artifacts/<id>` → **HTTP 403**.

So the artboards are not reachable, and GAM-441's own binding constraint is
*"The figures must be exported from the approved canvas, not re-drawn."*
Re-drawing them would manufacture a **binding craft standard the owner never
approved**, which eleven sibling tickets and every `checker-accessibility` round
would then be graded against — strictly worse than having no figure, because it
launders an agent's guess into the authority position. Deliverable 3 is therefore
**declined, not attempted**, and filed as its own row under item 20. Deliverables
1, 2 and 4 are unaffected and ship in full.

### Finding B — UXC-02/UXC-07 are in a different PRD, and it is not in Allowed Files

GAM-441 step 1 requires noting that UXC-02/UXC-07 are superseded for this page.
The issue's "Where it renders / lives" table cites only `VOLT_Portal_PRD.md`, and
its Allowed Files list matches. But **neither ID exists in that file**:

- `docs/swarm/VOLT_UX_Craft_PRD_v3.md:77` — UXC-02, `List`→**`Table`** migration, graded **MAJOR**
- `docs/swarm/VOLT_UX_Craft_PRD_v3.md:82` — UXC-07, collapsed coach rows **≤72px measured**

The filer appears to have believed the UXC IDs lived in the portal PRD. Writing the
supersession only where the issue says to would leave a **MAJOR-graded requirement
sitting unqualified in the file a checker actually opens to grade UXC-02** — which
is this ticket's own defect, reproduced one file over. Handling and the
scope-expansion question go to the premise gate as least-confident decision #1
rather than being decided unilaterally.

- **05:22Z — pushed premise measurement.** No subagent in flight at this line.
