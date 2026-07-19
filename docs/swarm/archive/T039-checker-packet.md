# Checker Packet: T039 (New/edit outreach event dialog + competition flags) — Check Attempt 1

## Task ID
T039 — New/edit outreach event dialog (OUT-02, CMP-01/02), Epic E6.

## Checker Agent
checker-reviewer (per task-ledger.md T039 row).

## Objective
Verify a `Dialog` implementing OUT-02's exact field order, a real, disclosed resolution of the
OUT-02-vs-CMP-01 event-type tension (outreach vs. competition, not "meeting"), CMP-02's
competition-only flag gating sourced from the existing ETL's own defaults (not invented), and
the same `event_sessions.notes` nullability precedent T031 already established.

## Allowed Files (worker's literal permitted edit)
- `src/pages/outreach/OutreachEventDialog.tsx` (new)

**Scope flag**: worker also created `OutreachEventDialog.test.tsx`, outside the literal Allowed
Files line — same disclosed pattern already ruled in-scope by every prior checker in this batch.
Re-derive the judgment yourself.

## Forbidden Modification Check (run first, D001 method)
Compare Allowed Files above against the actual file tree / this task's commit (`569a5d9`, shared
with T029 — confirm the D001 boundary per-file, not by commit message). Confirm no migration file
was added or edited (constitution item 10 — the `event_sessions.notes` nullability question must
be resolved WITHOUT touching the applied migration, same as T031's precedent). Confirm
`OutreachList.tsx`, `router.tsx`, `guards.tsx` (import-only) untouched.

## Worker's Claimed Changes (do not trust — verify independently)
1. **OUT-02-vs-CMP-01 event-type tension — the central judgment call of this task.** OUT-02's field
   spec (PRD) describes a generic outreach-event dialog with no explicit "type" selector language,
   while CMP-01 (PRD line ~303) explicitly says "Competitions are `events.type='competition'`" and
   the ledger's own T039 Objective line names this exact file/dialog as where competition-type
   events get created (CMP-02's flags belong to this same dialog). Claims it resolved this by
   implementing a real `type` `Selector` (`OutreachDialogEventType = 'outreach' | 'competition'`,
   module line 304) defaulting to `'outreach'`, explicitly NOT offering `'meeting'` as an option
   (meetings are created elsewhere, per T031). Claims this was a disclosed judgment call, not a
   silent invention, flagged for review, no dispute filed.
2. **CMP-02 flag gating**: `counts_participation`/`counts_volunteer_hours` `Switch` toggles claimed
   rendered ONLY when `type === 'competition'` (both default `false` per CMP-02's own text); for
   `type === 'outreach'` the flags are claimed to be computed from a fixed pair
   (`OUTREACH_FIXED_FLAGS`) sourced from `scripts/migrate/transform.ts`'s own already-existing
   `eventTypeMetricDefaults` (an already-shipped ETL script, not invented), not user-editable at all
   for outreach events. Claims a single function `resolveMetricFlags(type, ...)` is the only place
   these two booleans are ever computed.
3. **`event_sessions.notes` nullability (T010's MINOR follow-up, shared with T031)** — claims it
   matched T031's exact established precedent: `buildOutreachSessionsPayload` always supplies
   `notes: ''` (never `null`/undefined), since OUT-02's own field spec has no notes field at all
   (stronger evidence than T031's case that it's meant to be always-empty-string, not schema-nullable)
   — no migration written, matching T031's choice so the nullability question isn't resolved twice.
4. **A found-and-fixed race-condition bug**: claims it discovered, during its own testing, a real bug
   where a `useEffect` syncing derived session-detail state raced with a separate edit-mode reset
   effect, wiping prefilled data on mount in edit mode. Claims it fixed this by replacing the
   effect-based sync with a pure `useMemo` derivation, `effectiveSessionDetails` (module line ~828),
   eliminating the race entirely (no interacting effects to order).
5. **Field order** claimed to match OUT-02 exactly: title, description, location name+address,
   category, schedule mode, per-session times, people-reached placeholder, adult volunteers
   count+hours, team scope, share-to-calendar default on.
6. **BEH-07 computed confirm-button copy** and a **disabled-until-title+≥1-dated-session** gate
   claimed implemented.
7. Claims its own test suite passes and typecheck/lint/build are clean for its own files; discloses
   the same T029-adjacent project-wide `npm run format` incident noted in T029's packet (shared
   commit) — not this task's file, but worth a quick sanity check that `OutreachEventDialog.tsx`
   itself wasn't affected by unrelated formatting drift beyond its own intended changes.

## Required Verification Steps
1. **Read `OutreachEventDialog.tsx` and `OutreachEventDialog.test.tsx` in full** — do not rely on
   the worker's module doc or this packet's paraphrasing.
2. **OUT-02-vs-CMP-01 tension — form your own explicit verdict.** Read the PRD's OUT-02 and CMP-01
   sections yourself (do not trust the worker's paraphrase) and judge whether offering a
   `'outreach'`/`'competition'` type `Selector` in this exact dialog is the correct, defensible
   resolution (as opposed to, e.g., a separate dedicated competition-creation flow that doesn't
   exist anywhere else in the ledger). Confirm by grep that no third value (`'meeting'`) is ever
   offered as an option here.
3. **CMP-02 flag gating — re-verify by source read.** Confirm `resolveMetricFlags`/equivalent is
   genuinely the sole place these two booleans are computed (grep for any second implementation),
   and confirm the fixed outreach-type default pair genuinely matches
   `scripts/migrate/transform.ts`'s real, already-shipped `eventTypeMetricDefaults` values — read
   that file yourself, don't trust the citation.
4. **`event_sessions.notes` — confirm the precedent match.** Verify `notes: ''` is always supplied
   (never `null`/`undefined`) in the actual INSERT-shaped payload builder, and confirm no migration
   file was touched.
5. **The claimed race-condition bug fix — verify it's real, not a fabricated selling point.** Read
   `effectiveSessionDetails` and confirm it is genuinely a `useMemo` derivation with no competing
   `useEffect` writing the same state. Reproduce or independently write an edit-mode-prefill test
   (open the dialog in edit mode with existing session data, confirm the fields are NOT wiped) to
   prove the fix actually holds, not just that the worker claims it does.
6. **Field order and BEH-07 confirm-button copy** — confirm by source/DOM-order read that OUT-02's
   field order is followed exactly, and that the confirm button's label/enabled-state is genuinely
   computed (title present AND ≥1 dated session), not a static string.
7. **Astryx prop citations** — spot-check `Dialog`, `Selector`, `Switch`, `DateRangeInput` or
   equivalent, `NumberInput`, `TextInput`/`TextArea` against `astryx-api.md`.
8. **Test-file scope question** — render an explicit verdict, independently re-derived.
9. **Re-run typecheck/lint/build/test yourself** — don't accept the worker's claimed pass counts
   without your own run. Given the disclosed shared-commit format-run incident, also confirm
   `OutreachEventDialog.tsx`/`.test.tsx` show no unexplained diff beyond the worker's own intended
   changes (there is no "before" commit to diff against since this is a new file — instead confirm
   internal consistency: no stray formatting-only artifacts, no box-drawing characters).
10. **No box-drawing/bracket characters, no fabricated real-looking PII** — grep sweep yourself.

## Relevant Constitution Excerpts
- Item 10 (BLOCKER-class): database changes are additive migrations via the Supabase CLI; editing
  an applied migration file is a BLOCKER. *(Cited because this task correctly did NOT touch the
  `event_sessions` migration to resolve the notes-nullability question, matching T031's precedent.)*
- Item 3 (BLOCKER-class): no re-deriving RLS/metric SQL formulas in TypeScript. *(Cited because
  CMP-02's flags are claimed sourced from an existing ETL default table, not a re-derived formula —
  confirm this citation is accurate.)*
- Item 2: Astryx component usage must stay within the documented API surface.

## Required Checker Output
- PASS or FAIL
- severity: BLOCKER, MAJOR, MINOR, or NIT
- evidence inspected (paste actual grep/read/test output, not paraphrase)
- commands run
- exact findings
- explicit verdict on the OUT-02-vs-CMP-01 event-type resolution
- explicit verdict on the CMP-02 flag-gating citation and non-reinvention
- explicit verdict on the `event_sessions.notes` precedent match
- explicit verdict on whether the claimed race-condition bug and its fix are real
- explicit verdict on the test-file scope question
- required rework if failed
- follow-up tasks if passed with minor issues
