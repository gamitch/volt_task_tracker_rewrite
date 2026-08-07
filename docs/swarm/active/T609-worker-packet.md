# Worker Packet: T609 — hide the dead Notes field in edit mode

**Packet v1.** Attempt count: 0 — no worker has run against this packet yet.

**Row:** T609 (`task-ledger.md`, filed 2026-08-06) · **Tier: STANDARD** (constitution item 26 — see §0
for the full justification, including why item 19b means this packet is going straight to a worker with
**no `checker-premise` gate**) · **Worker model: sonnet** (default — none of item 18's four opus triggers
fire: no migration, no RLS/`security definer` change, no metric-SQL view, no auth/session/role logic;
item 25's second obligation also applies — this does not get bumped to opus just because it touches a
form people type into). **Branch:** `claude/w3-meeting-workflow-0bl669`. This machine holds **W1 + W3**.
**Dependencies:** none per the ledger row. Related but not blocking: T605 (HEAVY, gated, not yet
dispatched) will eventually make per-session notes real; see §7 for what that means for this fix's
lifetime.

**A checker packet is commissioned separately, after this worker's diff exists — do not write one now
and do not treat the absence of one here as this task being unchecked.** Per the Non-Negotiables ("No
worker may mark its own work complete" / "Every checker must inspect the actual artifact"), this task is
not done until that separate checker round passes.

---

## 0. Tier — stated and defended, not asserted

**By the letter of item 26 this change also qualifies for FAST** (the orchestrator implementing directly,
no packet, no worker): no write path, no schema/RLS/auth/role logic, no signature another module imports,
the production diff is a single conditional wrapper (~4-6 lines), and a named mutation exists that turns
a test red (§5 below). **This packet exists anyway because a worker + a separately-commissioned checker
is the process actually being run for this row** — recording the tier as **STANDARD** (single module, no
write path, rolls out an idiom already proven in the same file — the exact shape item 26 describes for
T302/T303, "both passed first time") reflects that reality rather than the leaner FAST path this task
would also satisfy on the merits. If the orchestrator later chooses to fold this into a solo
implementation instead of dispatching it, FAST is the correct relabeling, not a violation of anything
here — evidence is not reduced either way (§5's mutation and full gate suite still run).

**Item 19b — the premise gate is skipped for this packet, not merely "light."** 19b's own text: *"Light
check or skip for packets that roll out an already-verified pattern to a new surface (e.g. applying a
proven table migration to a second list page)."* This is a tighter case than that example: it is not a
proven pattern moved to a *new* surface, it is the identical `isEditMode &&` conditional-render idiom
already shipped, in **this same file**, gating the Description field (`ScheduleMeetingsDialog.tsx:1021-
1029`) — inverted, since Description is edit-only and Notes needs to be create-only. **Correction to the
framing this packet was handed:** that framing described the two blocks as "twenty lines away." Measured
directly: Description's gate closes at `:1029`, Notes's block opens at `:1142` — **121 lines apart, not
twenty.** The distance does not change the 19b conclusion (a same-file, same-idiom precedent is a
same-file, same-idiom precedent at either distance), but the number was wrong and this packet is not
repeating it uncorrected — see the project's own repeated citation-error history in
`auto-mode-decisions.md` before deciding this kind of thing is safe to relay unchecked.

**No `checker-premise` round is commissioned for this packet.** Go straight from this packet to a
worker.

---

## 1. The defect, re-verified against the live tree at HEAD (not relayed)

`src/pages/meetings/ScheduleMeetingsDialog.tsx:1142-1144` (current HEAD `4ee5c02`):

```tsx
<EventFormSection title="Notes" hasDivider={false}>
  <TextArea label="Notes" value={notes} onChange={setNotes} isOptional rows={3} />
</EventFormSection>
```

renders unconditionally — confirmed no `isEditMode` (or any other) guard wraps it — in **both** create and
edit mode. Contrast the Description field, four lines above at `:1021-1029`, which is correctly gated:

```tsx
{isEditMode && (
  <TextArea
    label="Description"
    value={description}
    onChange={setDescription}
    isOptional
    rows={3}
  />
)}
```

`isEditMode` itself is `const isEditMode = initialData !== undefined;` (`:768`).

**The discard is deliberate and documented; the visible input is not.** `handleSubmit`'s edit-mode branch,
`:924-940`, specifically `:932`:

```tsx
const desiredFutureSessions = buildEventSessionsPayload(sessionDates, startTime, endTime, '');
```

with its own comment immediately above (`:927-931`): *"`notes` is fixed to `''` here regardless of this
dialog's own `notes` state -- per-session notes are T605's scope, and the loader itself never trusts this
to already be future-only..."* Also verified: the `notes` React state itself (`const [notes, setNotes] =
useState('')`, `:785`) is never seeded from `initialData` — there is no series-level notes field on
`EditMeetingSeriesInitialData` at all — so nothing about this state's initialization changes because of
this fix; it stays `''` through an edit session exactly as it does today.

**Net effect today:** a coach opens Edit, sees a Notes box, types into it, clicks Save, the save succeeds,
and the text is silently gone with no error and nothing on screen suggesting it was ever going to be
discarded.

**This repo has already ruled on exactly this class of defect.** `docs/swarm/auto-mode-decisions.md`,
section **"2026-07-30 — George's ruling on T169 (owner input, verbatim)"**, subsection *"What
investigating the placement turned up — three measured findings"*, finding 1 (`:903-908`), on a control
that accepted a value and dropped it on reload:

> "...replace a control that accepts the student's RSVP, shows it applied, and silently discards it on
> reload." That is worse than an absent UI, because the student believes they have responded.

Same shape here: a coach who successfully submits a form believes their note was saved.

---

## 2. Scope — this is the whole task, and it must stay the whole task

**The only change:** hide the Notes `EventFormSection` in edit mode, mirroring Description's existing
gate at `:1021` — inverted, since Description is edit-only and Notes must become create-only (`notes` is
never persisted in edit mode today, and this task does not change that).

```tsx
{!isEditMode && (
  <EventFormSection title="Notes" hasDivider={false}>
    <TextArea label="Notes" value={notes} onChange={setNotes} isOptional rows={3} />
  </EventFormSection>
)}
```

Add a short comment immediately above it, in this file's own established voice (see the many `// T510 --`
/ `// T125 module doc 9 --` comments already in this file for the idiom), stating: this task's id, that
edit-mode notes are never persisted today (cite `handleSubmit`'s own `:927-931` comment rather than
re-explaining the reason), that create mode is unaffected, and — per this project's own house rule — cite
the `auto-mode-decisions.md` finding above by section name rather than by inventing new prose for the same
point.

**Create mode must be completely unchanged.** No visual, textual, or behavioral change to create mode is
in scope, and none should occur — the gate only removes something that already never appeared in create
mode's own code path (`isEditMode` is `false` there today and stays `false`).

**Do not touch, under any circumstance, without stopping and filing a dispute first:**
- `handleSubmit` (`:924-964`) or `handleConfirmEditSave` (`:895-922`) — the `''`-hardcoding and the save
  path are T605's territory, not this task's. This task changes **rendering only**.
- The `notes`/`setNotes` state declaration (`:785`) or `sessionsPayload`'s construction (`:868-869`) — both
  stay exactly as they are; create mode's `notes` value still flows into `buildEventSessionsPayload`
  unchanged.
- `src/lib/supabase/loaders/meetings.ts` — no loader, no query, no mutation is part of this task.
- Anything under `supabase/migrations/`.
- `src/pages/meetings/MeetingsList.tsx` or its test file — that is T605's surface, not this one's.
- If, in the course of this work, anything appears to require more than the render gate above (e.g. you
  believe notes actually need to persist, or the gate alone does not fully solve the problem as you
  understand it) — **stop and file a dispute** describing exactly what you found and why the gate is
  insufficient. Do not widen the fix to cover it yourself. This packet's premise, verified above, is that
  the render gate is the complete, correct fix for the defect as filed; if your own investigation
  contradicts that, the packet's premise is wrong and needs a human/orchestrator decision, not a bigger
  diff.

---

## 3. The MTG-02 field-order tripwire — established here, not left for the worker to guess

`ScheduleMeetingsDialog.test.tsx`, describe block `'<ScheduleMeetingsDialog /> field order (MTG-02 /
constitution item 13)'`, test `'renders fields in the exact MTG-02 order: title, team scope, location,
schedule mode, date/time, notes'` (`:640-663`) renders the dialog with **no `initialData` prop**:

```tsx
root.render(<ScheduleMeetingsDialog isOpen onOpenChange={() => {}} teams={TEST_TEAMS} />);
```

Since `isEditMode = initialData !== undefined`, this render has `isEditMode === false` — it is **create
mode**, unconditionally. Its assertion, `labelTexts` ending in `'Notes ∙ Optional'`, exercises exactly the
branch this fix does **not** touch: `{!isEditMode && (...)}` evaluates to `true` in create mode, so the
Notes section renders exactly as it does today, in the same position, with the same label.

**Conclusion, stated explicitly rather than implied: this test stays green, unedited, because it never
renders edit mode.** If a worker's change ever made this test go red, that would mean create mode's own
render path had changed — which would mean the fix was wrong, not that the tripwire needed updating. Do
not touch this test.

Verified exhaustively, not assumed: a search for the literal string `Notes` across every `*.test.ts*` file
in this repository (`src/pages/meetings/ScheduleMeetingsDialog.test.tsx` plus every other test file in
`src/` plus both Playwright specs in `tests/e2e/`) returns **exactly one hit**, and it is this same MTG-02
line. **No other test anywhere in this codebase currently asserts anything about the Notes field, in
either mode.** State this finding explicitly in the worker's own output rather than merely relying on it
silently.

---

## 4. Required new test — named mutation, and why it must prove both directions

Add **one** new test to `ScheduleMeetingsDialog.test.tsx` (a new `it`, in a new small `describe` block, or
appended to the existing `describe('<ScheduleMeetingsDialog /> T510 edit mode', ...)` block — worker's
choice) proving: **Notes is absent when editing, present when creating.**

This file's own precedent for re-rendering the same root mid-test with different props already exists at
`:879-887` (`root.render(<ScheduleMeetingsDialog isOpen={false} .../>)` then `root.render(<ScheduleMeetingsDialog
isOpen .../>)` in the same `it`) — reuse that shape rather than inventing a new one. Use the file's own
`getFieldControl` helper (`:111-124`), which throws when a label is not found — the exact mechanism
already used at `:1131` to prove Description is absent from create mode, applied here in reverse:

```tsx
it('T609: Notes is create-mode only -- absent when editing, present when creating', () => {
  act(() => {
    root.render(
      <ScheduleMeetingsDialog
        isOpen
        onOpenChange={() => {}}
        teams={TEST_TEAMS}
        initialData={EDIT_INITIAL_DATA}
      />,
    );
  });
  expect(() => getFieldControl('Notes')).toThrow();

  act(() => {
    root.render(<ScheduleMeetingsDialog isOpen onOpenChange={() => {}} teams={TEST_TEAMS} />);
  });
  expect(getFieldControl('Notes')).toBeDefined();
});
```

(`EDIT_INITIAL_DATA` already exists in this file at `:929-936`, inside the `'T510 edit mode'` describe
block — if the new test is placed outside that block, either hoist a minimal `EditMeetingSeriesInitialData`
fixture or place the test inside that block so it is in scope; do not duplicate the fixture under a new
name.)

**Both directions are required, not just the edit-mode absence.** A test asserting only "Notes is absent
in edit mode" would also pass against a broken fix that hides Notes in *both* modes — this project has
paid for exactly this class of one-direction-only criterion before (see `auto-mode-decisions.md`'s
extended T147 retrospective on criteria that could not fail). The create-mode assertion is what makes this
test capable of catching that failure too.

**Named mutation, for the checker's `mutation-replay`:** revert the `!isEditMode &&` wrapper added in §2
(i.e., restore the Notes `EventFormSection` to unconditional rendering, byte-identical to its pre-fix
state). With that mutation applied, the edit-mode half of this new test — `expect(() =>
getFieldControl('Notes')).toThrow()` — must **fail**, because `getFieldControl('Notes')` would now find
the control instead of throwing. This is the proof the test is not vacuous. The worker should run this
mutation itself (in its own worktree per constitution item 23, never the shared tree) and report the real
red output, not a description of what it would show.

---

## 5. If any existing test contradicts this fix — stop, do not resolve it yourself

§3 already establishes, by exhaustive search, that no existing test anywhere in this repository asserts
Notes is present in edit mode. **If the worker's own investigation disagrees with that** — finds some test,
anywhere, that would need its assertions changed to make this fix's behavior true — **it must stop and
file a request for a `boss-architect` ruling. The worker (and the foreman) must NOT grant this itself.**

Quote the governing rule **verbatim, not by number** when filing that request. This project's own log
records "item 10" resolving to two different rules depending on which part of the constitution is read —
the Non-Negotiables bullet versus the numbered Project-Specific Standards item — and a live open row
(**T610**) tracks that ambiguity as unresolved. The rule that actually governs here is the
**Non-Negotiables** section of `docs/swarm/constitution.md`, verbatim:

> "Existing tests must pass unless the boss explicitly approves a test update."

Cite it exactly this way — by section name and verbatim text — never as "item 10," in either direction of
the ambiguity, until T610 resolves it.

---

## 6. Allowed Files

- `src/pages/meetings/ScheduleMeetingsDialog.tsx` — **only** the Notes `EventFormSection` block currently
  at `:1142-1144` (wrap it, add the explanatory comment per §2). No other line in this large file changes.
- `src/pages/meetings/ScheduleMeetingsDialog.test.tsx` — **only** an addition: the one new test from §4.
  Zero existing lines change. `git diff` for this file must show no removed (`-`) lines against any
  pre-existing test.
- `docs/swarm/active/T609-worker-output.md` (create — your evidence doc).

## 7. Forbidden Files

- `src/lib/supabase/loaders/meetings.ts` — no loader, query, or mutation work in this task.
- `src/pages/meetings/MeetingsList.tsx`, `src/pages/meetings/MeetingsList.test.tsx` — T605's surface.
- `src/pages/meetings/EditMeetingSessionDialog.tsx` / `.test.tsx` — do not create; that is T605's new file.
- `src/pages/meetings/LiveConsole*.tsx`, `LiveConsole*.test.tsx`, `Kiosk.tsx`, `EndMeetingDialog.tsx` —
  unrelated surfaces.
- `supabase/migrations/**` — no migration in this task.
- `src/pages/outreach/**` — unrelated; read-only reference only if needed, never edited.
- `docs/swarm/constitution.md`, `docs/swarm/task-ledger.md`, `docs/swarm/verification-log.md`,
  `docs/swarm/dispute-log.md`, `.claude/agents/`, `.claude/skills/`, `.claude/settings.json`.
- `package.json` / lockfiles.
- Within `ScheduleMeetingsDialog.tsx` itself: `handleSubmit`, `handleConfirmEditSave`, the `notes` state
  declaration, `sessionsPayload`'s construction, the top-of-file module doc block (`:990-1001`), and every
  other line not named in §6 — all Forbidden even though the file as a whole is Allowed.

**Note for whoever commissions the checker packet next:** T605's own worker packet (`docs/swarm/active/
T605-worker-packet.md`) lists `ScheduleMeetingsDialog.tsx` as **Forbidden** to that task's worker,
specifically because this file is "already through two arbitrated gate rounds (D015/D016)." T605 has not
been dispatched to a worker yet (still gating), so there is no live conflict today — but if T605's worker
starts before this task's checker finishes, the two tasks would be touching the same file concurrently.
Flagging this for the orchestrator's sequencing call, not resolving it here.

---

## 8. Verification requirements

Run every command directly and capture its real exit code on the **bare** command — never through a pipe.
House precedent, verified in this repo's own `verification-log.md` (`:10983`): *"Gates run standalone with
`$?` captured directly, never through a pipe."* Use `cmd; echo "EXIT:$?"` or capture `$?` immediately
after each bare command.

- **`npm run typecheck; echo "EXIT:$?"` → `EXIT:0`.** (`tsc --noEmit` per `package.json`.) No type change
  is expected from this fix; this is a regression check, not a proof of anything new.
- **`npm run format:check; echo "EXIT:$?"` → `EXIT:0`.**
- **`npm run lint; echo "EXIT:$?"` → `EXIT:0` errors.** Establish your own baseline **before** changing
  anything: `git rev-parse HEAD`, then `npm run lint`, record the warning count. This is a render-only
  change adding no new export — the warning count should not move; if it does, explain the delta rather
  than asserting it away.
- **`npm test; echo "EXIT:$?"` → `EXIT:0`.** (`vitest run` per `package.json`; this is the real
  test-runner script — confirmed by reading `package.json` directly rather than assumed.) Report
  file/test totals before and after your change against the same baseline SHA above. This task adds
  exactly one test, so the total test count should increase by exactly one and no existing test's
  pass/fail status should change.
- **The §4 named mutation, replayed in your own worktree (constitution item 23), with real before/after
  output** — not a description of what it would show.
- **`git diff` for `ScheduleMeetingsDialog.tsx` is confined to the Notes block region** (the wrapper +
  comment described in §2) — no other hunk anywhere else in the file.
- **`git diff` for `ScheduleMeetingsDialog.test.tsx` contains only added lines** — no existing test's
  content changes.
- Identify every test discussed in your own output **by describe/it name and content**, never by line
  range — this file's own line numbers will shift the moment your new test lands, and this project has
  been bitten by stale line-range citations repeatedly.

---

## 9. Relevant Constitution Excerpts

- **Non-Negotiables:** "The app must build successfully." "Existing tests must pass unless the boss
  explicitly approves a test update." "No worker may mark its own work complete." "Every checker must
  inspect the actual artifact, not just the worker's summary."
- **Item 19b** (quoted in full in §0): governs why this packet skips `checker-premise`.
- **Item 20:** a deliberate deferral must produce a ledger row, not just a comment. (This task is itself
  the discharge of exactly such a deferral — T605's own packet correctly declined to fix this in its
  Forbidden-files territory and named it in §2.6/§7.1 of that packet; the relay worked this time, which is
  why this row and this packet exist.)
- **Item 21:** your completion report must give the commit SHA your work landed in, and existence is
  verified, not assumed — "clean" and "committed" are different claims.
- **Item 22:** explicit pathspecs only — never `git add -A` or `git add .`.
- **Item 23:** mutation experiments (the §4 named mutation) run in your own worktree, never the shared
  tree.
- **Item 26** (STANDARD/FAST definitions quoted in §0).

## Most Recent Failure

None. No worker has run against this packet yet.

## Required Worker Output

- Files changed (exact list, matching §6 — should be exactly two source-adjacent files plus this output
  doc).
- The diff content for the Notes-block change in `ScheduleMeetingsDialog.tsx`, and the new test's full
  text in `ScheduleMeetingsDialog.test.tsx`.
- Confirmation of §3's MTG-02 tripwire staying green, with your own re-verification (not just trust of
  this packet) that the tripwire's render call carries no `initialData` prop.
- Confirmation of §5: either "no existing test needed modification" (expected) or a filed
  `boss-architect` ruling request, quoting the Non-Negotiables rule verbatim per §5 — never self-resolved.
- Every command from §8, with real captured exit codes and relevant output, including the named
  mutation's real before/after result.
- Baseline lint warning count and vitest totals (§8), before and after.
- Commit SHA (item 21) and confirmation of explicit pathspecs used (item 22).
- Known risks, if any (e.g., the T605-file-conflict sequencing note in §7).
- Whether a dispute is needed, and if so, exactly which packet section it concerns.
