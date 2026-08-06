# T604 checker packet — stale "frozen" residue in `loaders/endMeeting.ts`

Assigned: **checker-reviewer**. Attempt: 1. No worker packet exists for this
task — the change is already sitting uncommitted in the working tree on
`claude/w3-meeting-workflow-0bl669`. Your job is to verify the artifact, not
a worker's claim about it. Render PASS / FAIL / REVISE with evidence; do not
merge, do not touch the ledger, do not write a verification-log entry — the
orchestrator does that once your verdict is in.

## 0. Also confirm T602 is dischargeable (evidence, not assertion)

T602 ("stale module doc says T196 is unwired and `EndMeetingDialog.tsx` is
frozen") is claimed already folded by T508, before this task touched
anything. Confirm independently, since T604's own fix sits on top of that
claim being true:

- `Read src/lib/supabase/loaders/endMeeting.ts` lines 1-30. Confirm the
  module doc states the mount **shipped** (cites `LiveConsole.tsx:1187`,
  "T196 closed 2026-08-04 at `6271ac6`") and that the one surviving "frozen"
  word there is the CORRECT historical note — "that file is no longer
  frozen/forbidden project-wide (T196 mounted it, T508 now edits it
  directly...)" — not a live claim that it's still frozen.
- `Grep -n "NOT wired|not yet wired|unwired|forbidden file" src/lib/supabase/loaders/endMeeting.ts`
  → must return **zero matches**. Any hit means a T602 stale claim survived.
- Do not trust the ledger's line numbers for T602's four ranges (`:8`,
  `:12-19`, `:113-118`, `:442-446`) — they have drifted under T508's and this
  task's own edits. Verify by symbol/content grep, per this file's own
  established convention (T506's fix explicitly moved from "trust a line
  number" to "grep the symbol").

If either check fails, T602 is not actually discharged — flag as a BLOCKER
independent of T604's own verdict, since T604's row text depends on it.

## 1. Objective

`loaders/endMeeting.ts` called `EndMeetingDialog.tsx` "frozen"/"forbidden" in
four places the T602 fix didn't touch: `:102`, `:105`, `:110`, `:297`
(ledger line numbers at filing time — re-locate by content, not number). Two
kinds of edit are claimed:
1. `:102`/`:105`/`:297` — drop the stale word only, prose otherwise intact.
2. `:110`'s sentence rewritten: the generic-error problem is still not
   fixable **from this file**, but the reason it was never fixed **at the
   other end** has expired (T196 mounted the dialog, T508 edited it
   directly), so it's now fixable there — filed as **T607**.

Comment-only. No behavior may change.

## 2. Acceptance criteria — each independently checkable

**C1 — no false "frozen" claim survives anywhere in the file.**
`Grep -n "frozen" src/lib/supabase/loaders/endMeeting.ts`. Expect exactly
two hits: the T602 historical note near the top (correct — leave alone, see
§0) and the corrected T604 sentence itself ("...is no longer frozen (T196
mounted it, T508 edited it directly), so it is fixable there now"). Any
other hit, or any hit asserting the dialog *is* frozen/forbidden, is FAIL.

**C2 — the four originally-cited spots are actually fixed, by content not
line number.** Locate the surrounding prose by symbol (`handleConfirmEndMeeting`,
`AlertDialog`, `Couldn't end this meeting`, the "id itself doesn't resolve"
sentence near `queryActiveStudentsForRoster`'s sibling doc) and confirm each
no longer calls `EndMeetingDialog.tsx` frozen/forbidden, and that the
non-"frozen" prose around each is otherwise unchanged (this is a targeted
word/sentence removal, not a rewrite of the surrounding paragraph, except at
the one sentence named in C3).

**C3 — the rewritten sentence is substantively correct, not just
de-worded.** Read the full paragraph containing the old `:110` claim. It
must say, in substance: (a) the generic-error problem is still not fixable
from *this* file, (b) the reason it was never fixed at the dialog's end has
expired — cite T196 (mount) and T508 (direct edit) by name, (c) point at a
task row for the fix. Confirm it does NOT simply delete the "still not
fixable here" disclosure — the underlying gap is real (see C5) and must stay
disclosed, only the false "frozen" reason for not fixing it must go.

**C4 — the cited row number is actually filed.**
`Grep -n "T607" src/lib/supabase/loaders/endMeeting.ts` (confirm the
citation exists) AND `Grep -n "\| T607 \|" docs/swarm/task-ledger.md`
(confirm a ledger row exists). **If the ledger grep returns nothing, this is
a FAIL** — the comment cites a task that was never filed, which is worse
than the stale claim it replaced (a dangling reference instead of a
false one). Do not accept "the orchestrator will file it shortly" as
evidence; check the ledger as it stands at review time.

**C5 — the comment's SUBSTANCE (not just its "frozen" framing) is still
true.** `Read src/pages/meetings/EndMeetingDialog.tsx` around its
`handleConfirmEndMeeting` catch block (grep `Something went wrong ending
this meeting` if the line has moved). Confirm it still reads
`error instanceof Error ? error.message : 'Something went wrong ending this
meeting.'` — i.e., loader rejections (never `Error` instances, since
`runMutation`/`toLoaderError` normalize to `SupabaseLoaderError`) still fall
through to the generic fallback and a coach still never sees the real
Postgres error. If this has *also* been fixed since the row was filed, the
comment's live-defect framing is now stale in a new way and C3 should be
re-checked against current reality, not the packet's assumption.

**C6 — the one correct "frozen" mention (§0) was not touched.** Confirm via
`git diff` (see §3) that the T602 historical-note lines near the top of the
file are byte-identical before/after this change. This task's allowed edits
are the four `:102`/`:105`/`:110`/`:297`-area spots only.

## 3. Scope check — allowed/forbidden files

Run `git status --short` and `git diff --stat` in the working tree.
**Allowed:** `src/lib/supabase/loaders/endMeeting.ts` only.
**Forbidden for this change:** `src/pages/meetings/EndMeetingDialog.tsx`
(read-only reference in C5 above, must show zero diff), anything under
`docs/swarm/` (the orchestrator files T607 separately from this diff — if
the working tree shows ledger changes bundled into the same uncommitted
diff, that's fine procedurally but confirm it doesn't get attributed to
this task's own evidence trail), any `supabase/migrations/**`, any other
`src/**` file. Any diff outside `endMeeting.ts` (excluding a separate,
clearly-labeled ledger addition for T607) is a scope violation — BLOCKER.

## 4. Comment-only proof — T506 precedent, by hash

T604's own ledger row cites this precedent by name: "prove by hash on the
T506 precedent (comment-stripped transpile byte-identical)." Reproduce it
for this file. `before` = last committed version (`git show
HEAD:src/lib/supabase/loaders/endMeeting.ts`); `after` = current working-tree
content, since the fix is uncommitted:

```
node -e "
const ts = require('typescript');
const { execSync } = require('child_process');
const fs = require('fs');
const before = execSync('git show HEAD:src/lib/supabase/loaders/endMeeting.ts').toString();
const after = fs.readFileSync('src/lib/supabase/loaders/endMeeting.ts', 'utf8');
const opts = { compilerOptions: { removeComments: true } };
const outBefore = ts.transpileModule(before, opts).outputText;
const outAfter = ts.transpileModule(after, opts).outputText;
const crypto = require('crypto');
const h = s => crypto.createHash('sha256').update(s).digest('hex');
console.log('before', outBefore.length, h(outBefore));
console.log('after ', outAfter.length, h(outAfter));
console.log(outBefore === outAfter ? 'IDENTICAL' : 'DIFFERS');
"
```

Expect `IDENTICAL`, matching lengths and hashes, exactly as T506's log entry
recorded (`verification-log.md`, T506 section: "both revisions transpiled
... byte-identical output"). If this prints `DIFFERS`, a behavior change
snuck into what's claimed as a comment-only edit — BLOCKER, do not treat as
comment-only regardless of how small the diff looks.

## 5. Gates — run directly, capture real exit codes

Do **not** pipe any of these through `tail` or similar — that already
swallowed an exit code once on this project and produced a false green.
Run each command standalone and check `$?` immediately after (or use
`command; echo "EXIT:$?"` inline), not after a pipe:

```
npm run typecheck   # tsc --noEmit
npm run format:check
npm run lint         # eslint .
npm test             # vitest run
```

All four must exit 0 with no new failures/warnings above whatever this
repo's current baseline is (check `npm run lint`'s warning count against the
pre-existing baseline, not just "0 errors" — a comment-only change should
not move it at all). Since this is comment-only, expect the same test count
and same pass count as before this file changed; any test-count delta is
unexpected and worth a note even if all still pass.

## 6. Relevant constitution excerpts

- Every checker inspects the actual artifact, not a worker's summary — there
  is no worker packet here; treat the orchestrator's change description in
  your dispatch the same way, as a claim to verify, not a fact.
- No task is complete on claim alone — C4 (row actually filed) and C4-style
  hash proof (§4) exist specifically so "comment-only, trust me" is never
  the final word.
- Citations must be verified before being repeated — apply this to your own
  output: if you quote a line number, re-derive it against the current file,
  since this file's own history (T506, T602) is full of citations going
  stale after the fact.

## 7. Failure severity

- **BLOCKER:** any behavior diff (§4 not IDENTICAL); any gate exit ≠ 0 or
  masked via a pipe; any forbidden-file touch (§3); the one correct "frozen"
  mention altered (C6); C4's ledger grep empty (dangling task citation).
- **MAJOR:** C3's rewritten sentence drops the still-true defect disclosure
  (C5) instead of only fixing the false "frozen" reason; any of the four
  original spots (C2) left un-fixed or only partially fixed.
- **MINOR:** wording quality issues that don't misstate a fact.
- **NIT:** cosmetic.

## 8. Required checker output

Files inspected, exact commands run (including the §4 hash script and its
real output, and each §5 gate's real exit code captured without a pipe),
pass/fail per criterion (C1-C6 plus §0's two T602 checks), severity per
finding, PASS/FAIL/REVISE verdict, and required rework if not PASS.
