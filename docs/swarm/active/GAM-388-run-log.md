# GAM-388 — run log

**Issue:** [GAM-388](https://linear.app/gamitch/issue/GAM-388/the-checkin-token-edge-function-was-never-deployed-so-the-kiosk-qr-and)
— The `checkin-token` Edge Function was never deployed, so the kiosk QR and
short code silently never appear.
**Branch:** `claude/gam-388-checkin-token-deploy`
**Started:** 2026-08-14

This log is append-only and is pushed after every milestone. If it ends
mid-sentence or ends on a dispatch line with no matching verdict, the run was
killed at that point — read the last line as the cause of death, not as a
summary.

---

## Milestones

- **claimed** — 2026-08-14. Read `AGENTS.md` § "Where work comes from" and
  `docs/swarm/constitution.md` (items 16, 18, 19, 20, 22, 26, 27, 28) before
  opening any repository file. Fetched GAM-388 live from Linear (not from
  `linear-export.md`). Tier judged **STANDARD** *before* the state move, per
  item 28d; applied `tier/standard`, removed `tier/unreviewed`; moved
  `Todo → In Progress`; **re-read and confirmed** the row is held
  (`state: In Progress`, labels `other, w1, Bug, standard`,
  `updatedAt 2026-08-14T22:35:38.538Z`).

### Tier reasoning (item 26 — stated and defended, as item 26 requires)

Item 26's single question is *"can a mistake here corrupt data, or lie to a user
about their own data?"* The issue contains two halves and they answer it
differently, so they are tiered separately:

- **The code half** (acceptance criterion 4 — the kiosk must distinguish "the
  dependency is missing" from "no session right now") is a **read path**:
  `src/lib/supabase/loaders/kiosk.ts` and `src/pages/meetings/Kiosk.tsx`. No
  write path, no destructive operation, no schema/RLS/migration/`security
  definer`/metric-view SQL, no auth/session/role-resolution logic, and no export
  another session builds against. None of HEAVY's triggers fire.
- It is **not FAST**, because FAST forbids "a change to a signature another
  module imports" and this change alters the value the loader hands
  `Kiosk.tsx` so the component can tell the two states apart. Item 26: when two
  tiers are arguable, take the heavier one. → **STANDARD**: worker implements,
  orchestrator replays the named mutation, no separate checker round.
- **The deploy half** (criteria 1–3) is **not a tier question at all** — it is an
  authorization question, and it is escalated rather than tiered. See below.

### Deploy half — the authorization question, raised before any work

The issue itself flags this and declines to settle it: *"item 16 reserves
migrations to the owner; whether that extends to Edge Function deploys is not
settled anywhere and should be confirmed before an agent runs a deploy."*
Constitution item 16 names migration cutover, production email enablement and
Vercel domain go-live as human gates; an Edge Function deploy to the live
project is not in that list and is not excluded from it either. Resolving that
is the owner's call, not mine, and `AGENTS.md` § "Ownership and protected files"
independently forbids an unauthorized deploy. Measurement of what this container
can actually do follows in the premise gate below.

---

## Premise gate

(entries appended below as they are measured)
