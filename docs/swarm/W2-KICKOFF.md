# W2 kickoff — run an outreach event

**Authoritative handoff for a fresh W2 orchestrator session. Written 2026-08-02 at
`main` = `7c7eb30`.** Everything you need is on disk; nothing important lives only in a
conversation. `KICKOFF-PROMPTS.md`'s W2 block points here — **this file supersedes it.**

---

## 1. What you are working on

**Volt Task Tracker** — a volunteer-hours and attendance app for one FIRST robotics team: about
**20 students**, their parents, and the owner/coach (George). It is real software with real data in
it, not a demo. **341.75 hours of real volunteer history were migrated into the live Supabase
project on 2026-08-02.** Bugs here mean a student's hours are wrong on a real goal bar.

The team's students are also *student coaches* for younger FLL teams, so **"FLL Team Meetings"
events are `type = 'outreach'`, not meetings**, and they **do** count toward volunteer hours. This
has been proposed wrongly twice. **The rule is by event `type`, never by event name.**

**Stack:** React + TypeScript + Vite + Vitest, Astryx design system (`@astryxdesign/core`),
Supabase (RLS, PostgREST, Edge Functions).

**You are the orchestrator**, not the implementer. You write task packets, dispatch a premise gate
and a worker as subagents, and **you personally replay every mutation** rather than trusting a
worker's report.

## 2. Your workflow, and the ones you must not touch

**W2 — "a coach creates an event, students RSVP, they attend, the coach marks the day complete, and
hours land in the students' totals."** The most-worked path in the project and still the most
defect-dense.

**Files you own — do not edit source outside this list:**

```
src/pages/outreach/**                       (20 files = 10 components + 10 tests; OutreachList.tsx is 4164 lines)
src/lib/supabase/loaders/outreach.ts
src/lib/supabase/loaders/selfCheckoff.ts
```

**Do NOT touch — other machines are live in these right now:**

| Path | Owner | Note |
|---|---|---|
| `src/lib/supabase/loaders/attendance.ts` | **W1** | Actively edited in **PR #28**. **Import from it freely; never modify it.** |
| `src/pages/checkin/**`, `src/pages/meetings/LiveConsole.tsx`, `Kiosk.tsx`, `loaders/checkin.ts`, `loaders/kiosk.ts` | **W1** | Another laptop. T321, T161, T320 already done there. |
| `src/pages/home/**` | W5 | |
| `supabase/migrations/*metric_views.sql`, `*kpi_views.sql` | W4 | W4 owns the numbers; you own the screens that display them. |
| Anything in a `codex/*` branch | third machine | It runs the Codex adapter and W6. |

**Your row-number block is T500–T599.** File every new ledger row inside it. Never take "the next
free number" from outside your block — that is exactly how the T196/T197 collision happened.

## 3. State of play — what is already done

`main` = **`76f8792`**, green: `tsc` 0 · `vite build` ✓ · prettier clean · eslint **0 errors / 362
warnings** · vitest **78 files / 1928 tests**.

**Measure the baseline yourself on your own branch point — do not quote this table.** It moved five
times on 2026-08-03 alone (361→362 warnings, 1842→1928 tests) as W1, W4, W5 and W6 merged. Every
stale figure in this project has cost someone a confused gate run.

Six W2 rows have now landed. **Read their `verification-log.md` entries before touching the same
code** — each records a trap that is still live.

| Row | What shipped | The trap it left behind |
|---|---|---|
| **T193** (PR #30) | A student's RSVP on `/outreach` now actually persists. It was writing nothing. | The optimistic row sets `respondedBy: studentId` — a `students.id` in a `profiles.id` field. **That is T174, still open.** |
| **T309** (PR #33) | Unchecking a student in "Mark day complete" now writes `status: 'absent'` instead of doing nothing. | `buildAttendanceWriteRows` must stay **byte-identical** — bulk mode shares it and has no uncheck UI, so emitting absences there would fabricate them from no coach gesture. |
| **T327** (PR #35) | Completion writes attendance **before** flipping the session to `completed`, so a failed write is retryable. | **Step (3), the adult-volunteer read-modify-write, must stay LAST.** It is additive and non-idempotent; moving it above the flip makes a retry double-count a grant-reporting figure. |
| **T330** (PR #43) | A dateless (zero-session) event is now a visible, badged, em-dashed row pinned to the top of Upcoming, on **both** views — it used to be dropped from both buckets and unreachable. | **`buildEventGroups` routes zero-session events to `upcoming` and NOTHING may send them to `past`** — that comparator dereferences the last session and is safe only because of the routing. Its comment says so; do not "harden" it into a guard that does nothing (T301). |
| **T402** (PR #44) | `loaders/outreach.ts`'s own `queryAttendanceForSessions` now pages, like T320 did for `attendance.ts`. | `.order('id')` is load-bearing. Paginating an unordered query duplicates and loses rows — measured at 1463 of 1500. |
| **T401** (PR #47) | `ATTENDANCE_ROW_CAP` is gone; T320's pagination made it a false positive that blocked legitimate writes. | It was **blocked on PR #28** until T320 actually reached `main`. A premise can be true on the branch that states it and false on the branch that would act on it. |
| **T306** (PR #51) | A session with recorded attendance shows who actually came, not who said they would. | The trigger is **whether attendance rows exist** — NOT the date, NOT `session.status`. The owner records attendance on the day, so both of those fail him. C6/C7 pin exactly those two wrong implementations. The attendance view is **staff-only**: RLS is `own_or_linked_read`, so ungated a student would be told every teammate has no record. |
| **T174** (PR #52) | `OutreachDetail`'s `FIXTURE_RSVPS.respondedBy` now holds `profiles.id` values. | It reddened **nothing** — no test had ever looked at those values. "No test broke" is not evidence when nothing was watching. |
| **T190** (PR #54) | `OutreachList`'s fixtures no longer key to `PLACEHOLDER_CURRENT_STUDENT_ID`, so a no-stub render sees an empty viewer. | Fixing the affected tests by **stubbing the viewer they need** — never by editing expected figures, which would have silently weakened T193's C3/C6. |

**Also live from earlier work (do not undo):** T305 and T307 fixed two destructive bugs in this exact
write path — "Mark event complete" was overwriting real check-in times, hours overrides and QR
provenance with nulls. Their protections are load-bearing.

## 4. Your remaining rows, in order

**T300 is in flight; T325 is the best-scoped row left** — its defect is now measured rather than
alleged, so it can be packeted against a known mechanism instead of a guess. See §4a.

| Row | What | Tier |
|---|---|---|
| **T300** | `OutreachEventDialog`'s own placeholder-coach copy | STANDARD |
| **T325** | **VERIFIED by measurement** — 213px horizontal overflow at 390×844, and the mechanism is NOT what the audit says | STANDARD |
| **T165** | `loaders/outreach.ts`: 21 of 23 exports untested | STANDARD |
| **T152** | T147's parallel-load guard only discriminates in one direction | STANDARD |
| **T301** | Three `OutreachDetail.tsx` comments call a `user !== null` check compiler-required — measured false | FAST |

### T325 — MEASURED, and the audit's description is misleading (§4a)

Verified in **real Chromium at 390×844** via a throwaway Playwright rig (the T131/T142 convention —
real dev server, real provider stack, rig deleted afterwards). **213px of horizontal overflow**:
`document.scrollWidth` **603** vs `clientWidth` **390**.

- **Nothing "collapses" — the row OVERFLOWS.** The audit's wording sends you looking for the wrong thing.
- **It is NOT the RSVP `SegmentedControl`**, which is the obvious suspect from reading the source. The
  orchestrator guessed that and was wrong.
- **It IS the `endContent` action span:** `display: flex` with **`flex-shrink: 0`**, measured **563px
  wide inside a 342px `ListItem`** whose own `flex-shrink` is 1. It refuses to compress or wrap.
- It is wide because the labels embed the full event title — *"Hide session details – Canned Food
  Drive"* — which is the accessible-name pattern **T131/T132 deliberately established**. **The labels
  are correct. Do not truncate them.** The shrink/wrap behaviour is the bug.
- **Structural root cause:** the coach table got a full `isNarrow` branch under T130/T132. The
  **student view has none** — `isNarrow` appears nowhere in it.

**Rig recipe, so nobody rebuilds it from scratch:** playwright is installed globally
(`NODE_PATH=/opt/node22/lib/node_modules`), Chromium is at
`/opt/pw-browsers/chromium-1194/chrome-linux/chrome`, the harness must be **CJS** (ESM ignores
`NODE_PATH`), and the rig **must inject `defaultLoadOutreachData`** or it renders the error state
against a missing Supabase config and you measure nothing.

### T306 — CLOSED (PR #51). The display question was the owner's and he answered it

The owner's T305 ruling covers this surface but leaves one thing undecided: show attendance
**in place of**, or **explicitly alongside**, the RSVP tallies. That is why this half was deferred
rather than packeted with T305. **Ask before building.** And **do not sync the two records** —
`OutreachList.tsx:1685-1687` records T121's finding that *"RSVP is intent, not a real attendance
record"*; writing a `going` RSVP because a coach ticked an attendance box falsifies the intent record.

### T330 — CLOSED (PR #43). Kept because its lesson generalises

**The prescription below was WRONG and shipped in this file for a day.** It is left here as the
worked example of failure mode #2, not as instruction.

A previous packet proposed **closing T330 as no-change**, arguing an orphan event (an `events` row
whose `event_sessions` insert failed) renders as `'No sessions scheduled yet.'` and the coach can
reopen it and add days. **The premise gate refuted that and the refutation was verified.**

- **`buildEventGroups` drops the event from BOTH buckets** — `OutreachList.tsx:1730`,
  `if (eventSessions.length === 0) continue;`, stated in its own module doc at `:1711-1712`.
- So the `'No sessions scheduled yet.'` branch at `OutreachList.tsx:1565` is **dead code on the
  coach list.** It renders only on `OutreachDetail` (`:1131`, `:2015`) — reachable only if you
  already have the URL.
- **Every navigation affordance to `/outreach/:eventId` lives on a list row.** No row, no link.
  **"Self-correctable" is false in-app.**
- **Not an RLS problem** — `staff_all` on `events` (`rls.sql:149-151`) lets the coach read the row
  fine. The list omits it, which is worse: nothing signals anything is wrong.
- **Wrong-number path:** the create dialog collects adult-volunteer count/hours
  (`OutreachEventDialog.tsx:1000-1001`), and `HoursTab` sums those across **all** season events
  **with no session filter** (`HoursTab.tsx:580-596`, called `:1094`; `reports.ts:401-411`). A
  failed create plus a successful retry leaves **two** events carrying the same figures —
  double-counted in the season adult totals, invisible, uneditable.

**The cheapest credible fix is not a transaction:** delete the `continue` at
`OutreachList.tsx:1730` so a zero-session event renders as a visible "needs dates" row, activating
the already-shipped `:1565` branch and restoring the edit path (`:1384-1386` already inserts missing
sessions on save). **The real design work is deciding what that row shows for date/hours/count** —
which is exactly what `buildEventGroups` currently dodges by skipping it.

**Owner ruling needed** on what a dateless event row should display — but **T304 already narrows
the question.** On 2026-07-31 the owner ruled against a third bucket, verbatim: *"having a 3rd
bucket may make things more difficult. keep the current two buckets and i'll have to remember to
close the days as they go by"* (`auto-mode-decisions.md:1320-1333`). So **do not ask whether to add
a "needs dates" bucket** — that is settled. Ask instead: *inside the existing two buckets, which
one holds a dateless event, and what do its date / hours / count cells show?*

## 5. Process — constitution item 26's three tiers

**Read `docs/swarm/constitution.md`.** Item 26 decides how much process a task gets. Tier is about
**risk, not diff size**.

| Tier | When | Who runs |
|---|---|---|
| **FAST** | No write path, no schema/RLS/auth, no cross-module signature, ≤~20 lines, and you can name the mutation | You implement it directly. **Verification is NOT reduced.** |
| **STANDARD** | Everything else that isn't HEAVY | Worker + you replay mutations. No separate checker. |
| **HEAVY** | **Required** for write paths, RLS/auth, migrations, metric-view SQL, shared exports | **Packet + premise gate + worker + checker** (constitution item 26's exact words), with **you replaying every mutation yourself**. The gate is capped at two rounds; a third escalates to the owner (item 19a). |

**The premise gate is the highest-leverage slot in this process and must BUILD, not read.** Every
save it has produced came from executing the prescription in its own worktree. On T305 it proved the
proposed fix would null a student's recorded hours. On T193 it measured a claimed hazard as false.
On T309 and T327 it caught the orchestrator's own errors. *A gate that only reads is worth much less
than one that runs.*

**Recommended model allocation** (the owner's, and it has paid off): **Fable** on the premise gate,
**Sonnet** on the worker, **you** replaying the mutations.

## 6. Verification standards — these are not negotiable

**Every acceptance criterion must name a production-code mutation that turns it red, and you must
run it yourself.** A criterion whose mutation leaves the suite green is not evidence.

**Paired assertions.** An absence-only assertion passes for the wrong reason. This repo has shipped
**7+** of them. Pair "X is not there" with "the thing that would have produced X *was* attempted".

**A count delta answers "did anything break", not "is anything now passing for the wrong reason."**
On T193 a test stayed green *only by racing a rejection*; one added `flushMicrotasks()` turned it red.

**Six gates, `.env.local` ABSENT, report every one:**

```
npx tsc --noEmit
npx vite build
npm run format:check
npx eslint .            (0 errors; report the warning count and explain any rise)
npx vitest run
npx vitest run <the targeted files>; echo $?     # assert the exit code, not just the count
```

Baselines at `7c7eb30`: tsc 0 · eslint **0 errors / 361 warnings** · **76 files / 1842 tests**.
**Measure them yourself on your branch point and report real numbers.**

### Three failure modes this project keeps repeating — check yourself against them

1. **Writing criteria against an imagined harness instead of the real one.** This happened on **four
   consecutive tasks**, despite the trap being documented verbatim in two test files. **Open the
   test file and read its `vi.mock` block before writing a single criterion.**
2. **Citing code that exists but does not run.** T330's closure was proposed on a real line
   (`OutreachList.tsx:1565`) that is dead on the surface that mattered. **Reading that a branch
   exists is not evidence that it renders.**
3. **Recommending on a question that was already settled.** T309's storage question had been ruled
   on months earlier (D-7). **Search `auto-mode-decisions.md` and the target module's own doc header
   before framing any owner question.**

## 7. Git — how to work

**Branch per task, task-scoped, never session-scoped** (`WORKFLOWS.md` rule 2):
`claude/t330-orphan-events`, not `claude/swarm-plan-xyz`.

```bash
git fetch origin main
git checkout -b claude/t<row>-<slug> origin/main
```

- **Work in your own git worktree** (item 23). Do not move the shared checkout's HEAD.
- **Commit before running any mutation** — reverting a mutation with `git checkout --` also reverts
  uncommitted work. This has bitten this project.
- **Stage named paths only. Never `git add -A` or `git add .`** (item 22). **The recorded rationale**
  (`constitution.md:213-217`): a subagent modified `OutreachEventDialog.tsx` **without authorization**
  during a documentation commit, and a habitual `git add -A` would have swept that source change into
  a commit whose message described packet authoring — no packet defining it, no checker verifying it.
  **The mechanism is indifferent to severity.** (Separately, a `node_modules` symlink once reached
  `main` this way: `.gitignore`'s `node_modules/` has a trailing slash and matches directories, not
  symlinks.)
- **Never commit to `main` directly.** Open a PR. `main` is protected by CI (typecheck, lint, test,
  build, bundle size) — **wait for it to be green before merging.**
- **Use a merge, not a squash**, if your verification log cites an implementation SHA — a squash
  makes your own documentation point at a commit that does not exist.
- **Item 24: the ledger row and the verification-log entry go in the SAME work as the merge.** Write
  the bookkeeping **before** the PR, not after. T323 merged without either and another session had
  to backfill it. **Item 26 removes coordination, not bookkeeping.**

## 8. Security and privacy constraints — hard rules

- **Constitution item 6: no PII** — no student names or emails in logs, URLs, analytics, commit
  messages, docs, or test fixtures. **Fixtures use fabricated names.** This is a BLOCKER, and it
  applies to a runbook exactly as much as to a fixture.
- **Never paste a service-role key** into a chat, a doc, or a commit. It bypasses RLS entirely.
- **The migration JSON exports must never be committed** — `students.json` holds twenty real
  children's first names.
- **The teardown SQL in `docs/migration/RUNBOOK.md` is safe only before go-live.** After cutover it
  must never run.

## 9. Owner-only items — you cannot do these

- **~20 student email addresses** (T064). The migration created **zero accounts** because the old
  data has no emails. The roster is correct and entirely unlinked.
- **Vercel domain go-live** (T070) and **cutover** (T065) — constitution item 16, owner's decision.

## 10. Reading order for your first ten minutes

1. **This file.**
2. `docs/swarm/constitution.md` — especially items 6, 19, 20, 22, 23, 24, 25, 26.
3. `docs/swarm/WORKFLOWS.md` § W2 — the file-ownership map and why the split is by file, not topic.
4. `docs/swarm/task-ledger.md` — the **T330** row (it carries the corrected facts in full), then
   your other open rows.
5. `docs/swarm/verification-log.md` — the **T327**, **T309**, **T193**, **T307** and **T305**
   entries. They are the last five things that touched your code.
6. `docs/swarm/auto-mode-decisions.md` — the owner's rulings. **Cite this file, never a paraphrase.**

**Do not start writing code in your first ten minutes.** Every expensive mistake in this project's
history came from acting on a premise nobody had checked.
