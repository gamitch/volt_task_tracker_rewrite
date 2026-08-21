Closes GAM-445

**DRAFT — opened early on purpose.** `AGENTS.md` wall 3: the `ghs_` token that
opens a PR lives exactly 3600s, and this run decoded its own at minute 1
(`iat 2026-08-21T19:17:31Z`, `exp 2026-08-21T20:17:31Z`). The body below is
filled in as the work lands; the draft flag clears when the gates are green.

## What changed

`ScheduleMeetingsDialog`'s weekly mode applies one start/end time to every
selected weekday, so a series like Weekly P3 (Tue 6:00–8:00 PM **and** Sun
3:30–6:30 PM) cannot be created in one pass. This PR gives weekly mode a
per-weekday time row when more than one weekday is selected.

*(Filled in on completion.)*

## Tier, stated and defended (item 26)

**HEAVY**, against the issue's own suggestion of STANDARD.

`ScheduleMeetingsDialog` is the sole producer of the `starts_at`/`ends_at`
values persisted into `event_sessions`. A wrong per-day or DST-crossing
conversion silently writes wrong session times and then shows coaches and
students the wrong meeting time — item 26's test ("can a mistake here corrupt
data, or lie to a user about their own data?") answers yes. FAST is excluded on
size alone. The losing argument for STANDARD is real and worth recording: the
dialog does not itself perform the database write — `onCreateMeetings` in the
loader does, and that file is out of scope. Item 26's tiebreak decides it:
when two tiers are arguable, take the heavier one.

Worker model tier stays on the pinned default. None of item 18's four triggers
(migration, RLS or `security definer`, metric-view SQL, auth/role logic) is
present, and item 25 explicitly forbids bumping a worker because a topic sounds
sensitive.

## Verification

*(gate-run evidence block pasted verbatim on completion.)*

## Scope (item 27)

*(Filled in on completion.)*

Linear-Issue: GAM-445
