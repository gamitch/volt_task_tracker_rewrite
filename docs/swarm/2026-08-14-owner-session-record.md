# 2026-08-14 — the owner-driven session: eleven rows landed, and what the process caught

**Scope.** An interactive session alongside the dispatch loop, 2026-08-12 16:23Z → 2026-08-14 10:47Z. The
session did three things: worked rows directly, opened pull requests for dispatched runs that could not
open their own, and premise-checked rows before they were queued.

**Not a substitute for the run logs.** Each row's own `docs/swarm/active/GAM-nnn-run-log.md` holds the
evidence. This records what the session decided and what it got wrong.

---

## 1. What landed

Sixteen pull requests, `#170`–`#185`. "Opened by" is the GitHub author of the pull request itself, not of the
work — `gamitch` means this session had to open it, in most cases for a dispatched run that had already
finished.

| Row | What | PR | Opened by |
| -- | -- | -- | -- |
| GAM-319 | write-flavoured RSVP save-failure copy | #170 | `claude[bot]` |
| GAM-320 | Next-up `MoreMenu` disables the item, not the trigger | #171 | `claude[bot]` |
| GAM-318 | deleted the unreachable per-row RSVP spinner | #172 | session |
| GAM-305 | archived teams excluded from the meeting/outreach scope pickers | #173 | session |
| GAM-283 | honest end-meeting failure copy | #174 | session |
| GAM-299 | additive `events`/`event_sessions` RLS on active memberships | #175 | session |
| GAM-342 | W1 check-in journey, driven end to end | #176 | session |
| GAM-343 | W2 outreach lifecycle, driven end to end | #177 | session |
| GAM-345 | W4 hours accounting, every number checked against the database | #178 | session |
| GAM-344 | W3 run-a-meeting, including the end-meeting write path | #179 | session |
| GAM-366 | dispatch job cap 120 → 180 minutes | #180 | session |
| GAM-355 | five persona tests that outlived the bugs they witnessed | #181 | session |
| GAM-338 | retry-idempotency tests for `makeOnEndMeeting` | #182 | `claude[bot]` |
| GAM-271 | login card clamped on narrow viewports | #183 | session |
| GAM-371 | overflow guard widened from 412px to 320px | #184 | `claude[bot]` |
| GAM-375 | reverted three commits pushed straight to `main` | #185 | session |

Four of the seven E2E workflow rows are done (W1–W4). W5–W7 remain.

---

## 2. Twelve of sixteen pull requests were opened by hand, and that was the session's main job

Of the sixteen, the session opened twelve. Three of those were its own work end to end (#172, #180,
#185). **The other nine were dispatched-run work the session had to deliver.** Eight of those stranded at
the same wall — the run completes its chain, pushes its branch, writes its PR body to
`docs/swarm/active/GAM-nnn-pr-body.md`, and stops there. The ninth, GAM-344, never reached that wall: it
was killed at the timeout instead. Each time, a human had to notice and ask.

**The convention that made this cheap emerged on its own.** No row asked runs to preserve a PR body;
stranded runs did it anyway. Eight such artifacts are on disk — GAM-271, 283, 299, 305, 342, 343, 345,
355 — one for each run that stranded, and each of those bodies was published verbatim. **GAM-344 had no
artifact**, because it died before writing one; its body was re-derived from the MAJOR recorded in its
run log. So the convention is eight for eight where it applies, and the one gap was covered only because
that failure mode happened to leave a run log behind. Nothing guarantees the artifact.

**GAM-333 was incomplete; the session has since updated it.** Its premise is that a dispatched run
*cannot* open a PR. **Five opened their own** — #169 (08-12 16:23Z), #170 (16:53Z), #171 (18:00Z), #182
(08-14 04:35Z) and #184 (10:31Z) — against **eight that stranded at the wall.** (The ninth hand-opened
PR, GAM-344, is not evidence either way: that run was killed at the timeout and never reached PR time.)

**The draft of this record claimed those failures occupied a clean window (08-12 21:28Z → 08-14 05:22Z);
checking the timestamps before committing falsified it.** #182 was opened by `claude[bot]` at 08-14
04:35Z, inside that window, 58 minutes after #181 stranded and had to be opened by hand. Two consecutive
runs, opposite outcomes, under an hour apart. **So the deciding variable is not time** — not a credential
that lapsed and was later renewed — **it is per-run.**

**Reading the workflow then narrowed it to three lines.** Authorship is the tell: `CLAUDE_PR_TOKEN` is a
human PAT, so a PR opened with it would author as the owner and be indistinguishable from a hand-opened
one. Every success authored as `claude[bot]`, an App identity — so the working path is definitively not
the PAT. In `claude-linear-dispatch.yml`, `:115` grants `id-token: write` for the action's own GitHub App
auth (the path that works); `:137` sets `GH_TOKEN` to `secrets.CLAUDE_PR_TOKEN || github.token`, so a run
that shells out to `gh` gets the PAT and the measured 403; and `:113` does grant `pull-requests: write`,
but that governs `GITHUB_TOKEN`, which the `||` shadows whenever the PAT is set. **That last line is why
the permission block looks correct and runs still fail.** The outcome therefore depends on which
mechanism a run reaches for at the last step, with nothing telling it which to prefer. GAM-333 now
carries this.

---

## 3. What the process caught that reading would not have

**GAM-305 — the premise gate's own remedy destroyed data.** Round 1 prescribed re-adding the archived
team as a selectable option. Round 2 measured that prescription: two clicks of Select-all rewrote a
two-team scope to the all-teams sentinel. The gate caught its own previous round.

**GAM-355 — a test passing for the wrong reason.** `student-parent.spec.ts:66` went green in the full
suite only because another spec created an opportunity that took the slot `.first()` grabs — so "no write
happened" was satisfied by querying a row the user never touched. Isolation exposed it; the full-suite
run concealed it.

**GAM-343 — the checker falsified its own worker's "no findings".** It found the defect in the run's own
committed screenshot: the attendance panel still showed a student checked in at 1.5h after the spec had
proven him absent.

**GAM-345 — two rounds of careful reading refined a false claim; one mutation settled it.** A claim about
where `/meetings` sources its participation figure was asserted, corrected by gate round 1, confirmed by
gate round 2 — and was still wrong. Mutating `meetings.ts:519` left the test green; mutating
`checkin.ts:363-365` reddened it.

**GAM-271 — the issue's own suggested fix was a regression.** It proposed `maxWidth={400}` + `width="100%"`
on the Card while warning "measure it, do not assume it." Applied, overflow goes to zero *and the card
collapses to 247px at every viewport including desktop*. The number improves while the screen gets worse.

---

## 4. Where the session was wrong

**Stripping `Ignore GAM-nnn` from three PR bodies.** The session read those lines as a self-contradicting
defect and removed them from #173, #174 and #175 before merge. They are documented convention —
`AGENTS.md` item 5 — and one of the magic words that stops a linked PR closing a row it did not work. No
row was harmed (none of those branch names or PR titles carried the referenced identifiers), but the
edits were wrong and were made after saying the bodies would not be published sight-unseen. Every body
after that was published verbatim.

**Diagnosing a Linear state change as automation.** GAM-305 flipped to Done four seconds after a PR link
was attached; the session concluded Linear auto-closes on attachment and moved the row back to In Review.
The PR had in fact been merged seconds earlier and Linear was correct. The session had un-completed a
genuinely finished row.

**Attributing a Todo bounce to GAM-326.** GAM-338 moved In Progress → Todo → In Progress; the session
read this as an unfinished run releasing its own row. The owner had done it by hand after a failure.

**Over-claiming on the timeout.** GAM-366's argument included "a rework round costs 30–45 minutes, which
no completed run had left." GAM-355 later completed a checker round, an escalation, a worker attempt 2
and a re-check in 1h38m. The headroom data still supports the raise; that particular causal claim was too
strong.

**Asserting a credential window inside this document.** The draft of section 2 stated that every run
between 08-12 21:28Z and 08-14 05:22Z stranded on `401 Bad credentials`. Listing the pull requests'
authors and timestamps before committing showed #182 was opened by `claude[bot]` at 08-14 04:35Z, inside
that window — 58 minutes after the run before it stranded. The same pass found the table was missing two
merged pull requests, #176 and #184, and that section 2's "nothing had to be reconstructed" was false
because GAM-344's body was reconstructed.

**Declaring two correct rows wrong, in section 7 of this document.** The first published version said
"GAM-350 and GAM-372 are both wrong", citing two environments as disproof. Reading the two rows in order
to correct them showed there was nothing to correct. GAM-350 never mentions dispatched containers — its
subject is the `package.json` declaration, re-measured true. GAM-372 names the dispatched container in
its own title, and the symlink cited against it was made in a different container, where the paths it
calls absent are present. The third citation, GAM-371's `npm install --no-save playwright`, is the same
class of workaround GAM-372 recommends. **All three were evidence from one environment treated as
decisive about another.** Corrected in section 7 above; filed as GAM-380.

The pattern in all six: a plausible mechanism asserted from partial evidence, when the full evidence was
one query away. The last two are the most useful, because both were caught by running on this document
the check the document spends its length arguing for — the fifth before it was committed, the sixth only
after it had shipped, and only because acting on the false claim required reading the rows it was about.
**A wrong claim survives exactly as long as nobody tries to use it.**

---

## 5. Two runs died at the cap on one row, and that produced GAM-366

GAM-344 was killed by `timeout-minutes: 120` twice — attempt 1 holding its first worker dispatch, attempt
2 holding the checker's rework dispatch, thirteen minutes short of its deadline. Measured across every
HEAVY run: GAM-345 finished with 16 minutes spare, GAM-343 with 4, GAM-305 with ~2. **Not one completed
run had meaningful headroom**, so 120 was a cliff rather than a bound, and the variable deciding survival
was whether the checker returned PASS or FAIL.

Raised to 180 in #180, with the file's comment recording that this is the *second* measurement-backed
raise and that a third should raise the redesign — splitting worker and checker so neither races the
other's clock — rather than the integer.

**GAM-344's outstanding rework was finished by hand** rather than re-dispatched a third time. The
checker's prescription had died with the subagent, so it was re-derived from the MAJOR recorded in the run
log.

---

## 6. Rows premise-checked before dispatch

Three rows were checked against `main` before being queued, at the owner's request:

- **GAM-271** — measured in a browser at five viewports; reproduced the filed numbers exactly
  (40/20/13/5/0). Dispatched as filed.
- **GAM-290** — cause confirmed by reading the field; **line reference corrected `:1138` → `:1377`**, a
  239-line drift. The measured *effect* was not reproduced, and the row now says so.
- **GAM-340** — **premise held but scope was wrong.** The row described re-teamed students; both roster
  write paths (`createStudent`, `updateStudent`) write `students.team_id` alone, so *every* student added
  since the 2026-07-21 backfill has no membership row. Proved on a scratch cluster that such a student
  returns **zero rows** from `v_student_participation` — counterfactual run both directions. Rewritten,
  and its priority raised, because the live half is not the half it was filed for.

**Three of three had something wrong with them.** Stale line numbers, wrong scope, or an unreproduced
effect. That is the argument for the premise gate existing at all.

---

## 7. Open, and worth knowing

**GAM-299's migration is merged but unapplied.** Item 16 reserves cutover for the owner. Until it is
applied, dual-team students still cannot see their second team's events. This is the only outstanding
item with a live user-facing consequence.

**GAM-374** — nothing stopped a dispatched run pushing three commits straight to `main`. Every review
control is `pull_request`-triggered, so a direct push bypasses the declaration gate, the human merge
decision and the tier declaration at once; only `ci.yml` survived, because it also triggers on `push:`.
The outcome is measured; the branch-protection configuration was not readable from the session and is not
claimed.

**GAM-350 and GAM-372 are both correct as filed** — an earlier version of this section said they were
both wrong, and that was this session's sixth error (§ 4). Neither rests on "the e2e runner cannot run in
a dispatched container": GAM-350's subject is the `package.json` declaration, and GAM-372 scopes its
claim to a dispatched container in its own title.

**The useful finding underneath is an environment split.** Measured 2026-08-14:

| | dispatched GitHub Actions runner | Claude Code Remote interactive container |
| -- | -- | -- |
| `/opt/node22/lib/node_modules` | absent | **present**, contains `playwright` |
| `/opt/pw-browsers` | absent | **present**, `PLAYWRIGHT_BROWSERS_PATH` set to it |
| `playwright` in `package.json` / `node_modules` | absent | absent — identical, and GAM-350's subject |

Running `measure.cjs` in the interactive container resolves `playwright` and launches Chromium; it exits
2 only on page load, not on the `Cannot resolve playwright…` GAM-372 reports. **So GAM-372's warning not
to replace one hardcoded environment with another is load-bearing, not cautious** — a scratch
`playwright-core` rig would fix the dispatched runner and break the container where the owner's own
sessions and premise gates run. The fallback chain is the only acceptable shape, and two of its three
positions are each known to win somewhere real.

**`tests/e2e/**` is wired into no GitHub Actions workflow.** GAM-371 widened the overflow guard from 412px
to 320px, which is correct and necessary — but neither the old nor the new project can fail a pull
request, because nothing runs them in CI. That is unfiled and is arguably larger than the row that
surfaced it.

**Run-log timestamps are unreliable.** Three runs wrote timestamps that do not match their own commit
times — GAM-305 and GAM-344 by a consistent ~31 minutes, GAM-371 with entries out of chronological order.
Quoting a run log's clock as when something happened is unsafe; the commit timestamps are the record.

---

## 8. What this session should be remembered for

The premise gate and the checker were wrong-footed less often than the humans and orchestrators writing
the packets. On GAM-305, GAM-345, GAM-355 and GAM-271, the thing that changed the outcome was a
measurement contradicting something already written down and believed — usually by the person who had
just written it.

The corollary is the session's own failure mode: **six wrong calls, every one a plausible mechanism
asserted before the cheap check was run** — two of them inside this file, caught only because the check
was finally run on it too. The same discipline the process applies to code was applied inconsistently to
the session's own reasoning about process, and the fix is not more care. It is running the query.

The sixth is the one to keep. It shipped in the first published version of this record, in the section
listing what a future reader should act on, and it told that reader to rewrite two correct rows. It
survived gates, review and merge, because none of those check whether a claim about a Linear row is true.
**It was caught only when someone tried to act on it** — which means the document's real safeguard is not
its own care but the fact that its claims eventually get used.
