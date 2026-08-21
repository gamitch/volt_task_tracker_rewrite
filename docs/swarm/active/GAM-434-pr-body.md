Closes GAM-434

## What changed

Clarifies constitution item 6 (Security & privacy): the PII bar is a
student's **full** name (and email), not any name. First name +
last-initial is explicitly permitted, and a student seeing other team
members — on a leaderboard, an event signup, or any other authenticated
surface — is explicitly permitted. Kiosk and public leaderboard surfaces
are unaffected: they still follow PRD SEC-04/ROS-08. The amendment quotes
the owner's ruling verbatim, per this document's existing house style for
authorized clarifications.

## What the issue got wrong

Nothing — this is a direct owner clarification of ambiguous wording, not a
correction of a mistaken premise.

## Tier, stated and defended

N/A — constitution item 26's FAST/STANDARD/HEAVY tiers govern production
code changes judged by write-path/schema/auth risk. This is a one-line
prose clarification to `docs/swarm/constitution.md` itself, directly
authorized and dictated by the human owner (the only party who may amend
this document per its own Authority Boundaries section, alongside
boss-architect/boss-arbiter). No code, schema, or test surface is touched.

## Verification

No gates apply — no source, test, or config file changed, only
`docs/swarm/constitution.md` prose. `git diff --stat` confirms the change
is a single line in that one file.

## Scope: what this does and does not close

Closes GAM-434 in full: the requested clarification (first name +
last-initial permitted; team visibility permitted) is now recorded
verbatim in constitution item 6.

## Follow-ups filed

None.

## Known gaps, disclosed

None.

Linear-Issue: GAM-434
