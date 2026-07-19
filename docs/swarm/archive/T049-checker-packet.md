# Checker Packet: T049 (Transactional email templates) — Check Attempt 1

## Task ID
T049 — Transactional email templates (EML-02 rows 1-5), Epic E8.

## Checker Agent
checker-content (per task-ledger.md T049 row). **Note**: this agent type has no Bash tool access
(Read/Glob/Grep only per its definition). If test execution is required and cannot be run, do
exhaustive hand-verification of the assertions against the source instead (same posture T050's
checker used) and flag live execution as a required follow-up rather than treating it as a defect
— the orchestrating session will independently run the suite to close that gap, as was already done
for T050.

## Objective
Verify five real EML-02 email templates (`invite`, `signup-confirm`, `event-reminder-48h`,
`event-reminder-3h`, `meeting-reminder-3h`), each producing `bodyHtml`/`previewText` consumable by
T048's `renderEmailLayout()`, with correct recipient framing, escaped dynamic content, BEH-08 date
rendering, DES-14 voice, and no cross-student data leakage (EML-05).

## Allowed Files (worker's literal permitted edit)
- `src/emails/templates/invite.tsx`
- `src/emails/templates/signup-confirm.tsx`
- `src/emails/templates/event-reminder-48h.tsx`
- `src/emails/templates/event-reminder-3h.tsx`
- `src/emails/templates/meeting-reminder-3h.tsx`

**Scope flag**: worker also created a colocated `*.test.tsx` for each — same disclosed pattern
already ruled in-scope by every prior checker in this batch. Re-derive the judgment yourself.

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commit (`2216eb0`) — do NOT
infer authorship from commit messages. **Critical check**: confirm `src/emails/layout/**`,
INCLUDING `inviteFixtureBody.ts`, is byte-unchanged (the worker's own module doc claims that file's
"T049 should replace/delete it" suggestion was deliberately NOT acted on since it's outside Allowed
Files — verify this literally). Confirm `supabase/functions/send-invite/**` untouched. Note: the
working tree may show other concurrently-running tasks' untracked files (`CalendarPage.tsx`,
`EndMeetingDialog.tsx`, `RsvpControl.tsx`, `EventsTab.tsx`, `HoursTab.tsx`) — not this task's
concern.

## Worker's Claimed Changes (do not trust — verify independently)
1. **`.tsx`-extension/no-JSX decision** — claims all five files are plain TypeScript template-
   literal functions, zero React/JSX, matching T048's `renderEmailLayout.ts`/`constants.ts`
   Deno-import-compatible precedent (a `.tsx` extension does not itself force JSX content). Claims
   this reasoning is written once in `invite.tsx`'s header and cross-referenced by the other four.
2. **`inviteFixtureBody.ts` correctly left untouched** — claims `invite.tsx` is the real
   replacement content, but wiring `send-invite/index.ts` to call it is explicitly out of scope
   (that file/directory is Forbidden here).
3. **Recipient/trigger framing matches EML-02's real table** (PRD line 318-326) — invite→invitee;
   signup-confirm→student(+linked parents), with `recipientRole: 'student'|'parent'` distinguishing
   the framing; event-reminder-48h/3h→`going` students+parents, with 48h promising one more
   reminder and 3h (the last one) not falsely promising another; meeting-reminder-3h→students in
   scope, explicitly disclosing its pref-gated/default-on nature.
4. **Escaping** — claims every template duplicates an `escapeHtml` helper mirroring
   `renderEmailLayout.ts`'s own, applied to every dynamic interpolated value (names, event titles,
   locations).
5. **EML-05** — claims every template accepts exactly one student's data (no list/array prop).
6. **BEH-08 date rendering** — claims independently reimplemented per-file (not imported from a
   forbidden file), producing e.g. `"Sat, Jul 25 · 1:00 PM–3:00 PM · 2 h"`.
7. Claims two of its own bugs found and fixed during verification (unused-var lint errors in two
   test files; a test assertion that didn't account for `renderEmailLayout`'s own escaping of
   `previewText`).
8. Claims 657/657 repo-wide test pass (73 tests across its 5 files + a concurrent T050 sibling
   file), typecheck/lint/build clean for its own 10 files; discloses whole-repo `format:check` was
   flaky due to concurrent sibling-task files, not its own.

## Required Verification Steps
1. **Read all five templates and their test files in full** — do not rely on the worker's module
   doc or this packet's paraphrasing.
2. **`inviteFixtureBody.ts` untouched — verify literally**, and confirm `invite.tsx` is genuinely a
   complete, real template (not a thin re-export of the fixture).
3. **`.tsx`-extension/no-JSX claim — confirm by grep** (no `<[A-Z]` JSX-element syntax, no `import
   ... from 'react'`/`@astryxdesign/*` in any of the five files).
4. **Recipient/trigger framing — cross-check against the PRD's literal EML-02 table yourself**
   (read it directly, don't trust the worker's transcription), especially the
   `signup-confirm`/`event-reminder-*` "who receives this" framing and the 48h-vs-3h
   promises-another-reminder distinction.
5. **Escaping — confirm each template's `escapeHtml` is genuinely applied to every dynamic value**,
   not just some. Grep for raw `${...}` interpolations that bypass it.
6. **EML-05 — confirm each template's props type accepts exactly one student's data**, no array/
   list prop anywhere across the five files.
7. **BEH-08 date rendering — spot-check the output format** against the PRD's own weekday-name/
   computed-duration requirement.
8. **DES-14 voice** — spot-check for sentence case, plain verbs, no "Submit"/"OK"/generic CTA
   filler, no "click here".
9. **Test-file scope question** — render an explicit verdict, independently re-derived.
10. **Test execution** — if you have Bash access, run each of the five test files (or the whole
    `src/emails/templates/` directory) yourself and report exact pass counts. If you do NOT have
    Bash access (checker-content's default tool set), hand-verify a representative sample of
    assertions against the source instead, and explicitly flag live execution as a required
    follow-up for the orchestrating session to close (same posture already used for T050 in this
    batch).
11. **No box-drawing/bracket characters, no fabricated real-looking PII** (fabricated names in test
    fixtures are fine and expected) — grep sweep yourself.

## Relevant Constitution Excerpts
- Item 9: dependencies are limited to the allowlist. *(Cited because the plain-TS/no-JSX decision
  is exactly what keeps this task off a disallowed dependency.)*
- Item 6: no PII; test fixtures use fabricated names only.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase)
- commands run (or explicit disclosure if Bash was unavailable, per Required Verification Steps #10)
- exact findings
- explicit verdict on the `.tsx`-extension/no-JSX decision
- explicit verdict on `inviteFixtureBody.ts` being left correctly untouched
- explicit verdict on EML-05 (single-student-only props) across all five templates
- explicit verdict on the test-file scope question
- required rework if failed
- follow-up tasks if passed with minor issues
