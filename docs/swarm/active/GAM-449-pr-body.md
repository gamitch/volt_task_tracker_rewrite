Closes GAM-449

**Draft — opened at minute ~5 so the PR credential is spent while it is alive.**
The body below is finalized before the draft flag is cleared. See
`docs/swarm/active/GAM-449-run-log.md` for the live state of this run.

## What changed

Builds the coach view's right rail — `src/pages/meetings/coach/MeetingsRail.tsx`
plus its CSS and tests: a season-bounded single-month Astryx `Calendar` with
generic has-meeting day marking, a per-series color legend, and an agenda of the
next few meeting days that emits `MeetingsFocusRequest` on click.

## What the issue got wrong

_To be filled in once measured._

## Tier, stated and defended

**STANDARD.** Item 26's HEAVY triggers are all absent: no write path or
destructive operation, no RLS/auth/role logic, no migration or metric-view SQL.
It is not FAST either — FAST is bounded at roughly ≤20 lines of production
change and forbids changing a signature another module imports, and this ships a
new component whose frozen props a sibling integration ticket codes against.
The losing argument for HEAVY was that the frozen props are a contract other
sessions build against; it loses because this ticket *consumes* a contract the
decomposition already froze rather than defining one.

## Verification

_To be filled in from the `gate-run` evidence block._

## Scope

_To be filled in._

Linear-Issue: GAM-449
