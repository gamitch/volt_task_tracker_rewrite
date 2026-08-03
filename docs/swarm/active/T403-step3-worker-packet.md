# T403 step 3 — worker packet: `LiveConsole` records real attendance

**Workflow W1, branch `claude/w1-checkin`. HEAVY tier** (constitution item 26: this is a **write
path**, and a mistake here lies to a coach about whether a student's attendance was recorded).
Chain: this packet → `checker-premise` (on Fable, building) → `worker-implementer` →
`checker-reviewer`. Owner authorized the full chain for this step.

## 0. GATE VERDICT — `checker-premise` on Fable, gated `799827e`

**DISPATCH.** All five traps CONFIRMED by building; no false premise found. Severity MINOR (three
packet gaps, each with a built resolution, folded in below).

**Trap 1 is real and was reproduced on a real PostgreSQL 16 database** loaded with this repo's three
real migrations, running the exact `ON CONFLICT` statement PostgREST generates from
`makeUpsertAttendance`'s captured payload:

```
A-BEFORE  status present | check_in_at 18:05 | hours_override 2.5 | method qr    | recorded_by <null>
A-AFTER   status absent  | check_in_at 18:05 | hours_override      | method coach | recorded_by 1111…
```

**`hours_override` → NULL, and `method` `qr` → `coach` destroyed by the same payload.** `check_in_at`
survived, which proves the payload-key-omission mechanism the module doc banks (`:349-352`) works and
that `hours_override` is lost *purely because it is present in the payload*.

**Prescribed fix — do NOT modify `makeUpsertAttendance`.** Add a parallel
`makeSetAttendanceStatus` to `attendance.ts` whose payload is exactly
`{session_id, student_id, status, method, recorded_by}`. The insert path gets `hours_override` NULL
by column default; the update path cannot touch it. Verified: `B-AFTER` preserved `hours_override
2.5`, `check_in_at`, and `method qr` while re-attributing `recorded_by`.

**Blast radius of the prescription: ZERO.** `makeUpsertAttendance` stays byte-identical, so
`AttendancePanel` (W2's only real consumer) is untouched and T117/T119/T305/T307/T320 shipped
behaviour is unaffected. **No W2 coordination is required for this fix.**

Gate's own build: `tsc` 0, full suite **79 files / 1874 tests, exit 0**, and all four named mutations
red at exit 1.

## 1. The defect

`notWiredSetAttendanceStatus` (`src/pages/meetings/LiveConsole.tsx`) is an intentional no-op:

```ts
export async function notWiredSetAttendanceStatus(): Promise<void> {
  // Intentional no-op -- see module doc section 2/5.
}
```

It is the default for `onSetAttendanceStatus`. A coach can run an entire meeting through this
console — clicking `SegmentedControl` rows, using the DES-17 `1`-`4` keyboard path — and **zero
`attendance` rows are written**. The UI updates local state and looks correct throughout.

Step 2 (merged) made the roster and the displayed attendance real, which makes this worse, not
better: the console now shows real students with real recorded statuses, and silently discards every
change made to them.

## 2. Allowed files

- `src/pages/meetings/LiveConsole.tsx` (W1)
- `src/lib/supabase/loaders/attendance.ts` (W1 — **see the collision note below before editing**)
- `src/pages/meetings/LiveConsole.test.tsx`, `src/pages/meetings/Kiosk.test.tsx` (tests)

**Forbidden:** `src/pages/outreach/**` (W2 active), `src/pages/calendar/**` (W6 active),
`src/pages/home/**` (W5), `src/lib/supabase/loaders/endMeeting.ts` and
`src/pages/meetings/EndMeetingDialog.tsx` (W3), `supabase/migrations/**`, `supabase/functions/**`.

**⚠️ `loaders/attendance.ts` is imported at runtime by three other workflows** — `endMeeting.ts:191`
(W3) and W2's `AttendancePanel` / `MarkEventCompleteDialog` / `MarkDayCompleteDialog`. A change
correctly scoped to W1's own files broke six tests in two other workflows once already (T320).
**Prefer adding a new call site over changing an existing signature.** If a signature must change,
grep every importer first and say so in the worker output.

**This rule is necessary but NOT sufficient — see Trap 1.** A change to an existing function's
*behaviour* reaches every caller while leaving all signatures intact, so it slips past the rule
entirely. Any behavioural change to a shared loader requires enumerating its call sites explicitly.

## 3. The pieces that already exist (do not rebuild)

- `upsertAttendance` / `makeUpsertAttendance` (`loaders/attendance.ts:358-384`) —
  `onConflict: 'session_id,student_id'`, `.select().single()`, returns a mapped `AttendanceRow`.
- `removeAttendance` / `makeRemoveAttendance` (`:398-416`) — unconditional DELETE.
- `resolveAttendanceWriteMethod(existingMethod)` (`:218-222`) — a row carrying real external
  provenance (`'qr'` / `'import'`) **keeps** it; otherwise `'coach'`.
- `useAuth().user.id` is the acting coach's `profiles.id`. `loaders/checkin.ts` already uses the
  session user id as `parent_profile_id`, so this identification is established, not new.

## 4. Traps — each is a claim the premise gate must CONFIRM OR REFUTE BY BUILDING

These were found by reading, which is exactly why they are not yet trustworthy. **Do not accept any
of them on this packet's authority.**

### Trap 1 — `hours_override` may be nulled on every coach click (SUSPECTED DATA LOSS)

`makeUpsertAttendance`'s payload includes `hours_override: params.hoursOverride`, and
`UpsertAttendanceParams.hoursOverride` is a required `number | null`. PostgREST's
`ON CONFLICT DO UPDATE SET` touches every column present in the payload. So a `LiveConsole` call
passing `hoursOverride: null` against a row where a coach previously set a manual hours override
appears to **overwrite that override with `null`** — silent loss of a coach's manual correction.

Note the payload deliberately omits `check_in_at` / `check_out_at` *for exactly this reason*
(`:350-352` documents it as the history-preservation mechanism) — but `hours_override` is **not**
omitted.

**This is the same failure mode the constitution cites for T305**, where the premise gate built the
prescription, captured the real upsert payload, and proved the proposed fix would null a student's
recorded hours and method. Treat the resemblance as a lead, not a conclusion.

**✅ CONFIRMED — see §0 for the observed before/after on a real database.**

**A read-modify-write is NOT the fix and is struck from this packet.** The gate built and compared
both routes: the omission-payload fix (a parallel `makeSetAttendanceStatus` that simply never sends
`hours_override`) is strictly better — no extra round-trip, and no TOCTOU window in which a
concurrent QR scan is clobbered by a stale snapshot. Use it.

**⚠️ SCOPE DECISION THIS TRAP HIDES — the collision rule in §2 does NOT catch it.** If the fix lands
in `makeUpsertAttendance`, it changes **behaviour** for every existing caller **without changing any
signature**, so "prefer adding a new call site over changing an existing signature" gives no
protection here.

**The real blast radius is ONE consumer, not four.** An earlier revision of this packet said "four
call sites across three workflows." That was wrong, asserted without grepping — the same failure this
packet exists to prevent. Verified:

| File | Imports from `loaders/attendance.ts` | Affected by a `makeUpsertAttendance` behaviour change? |
|---|---|---|
| `AttendancePanel.tsx` (W2) | `loadAttendanceForSessions`, `removeAttendance`, `resolveAttendanceWriteMethod`, **`upsertAttendance`**, + types | **YES — the only real consumer** (default for `onUpsertAttendance` at `:641`) |
| `MarkEventCompleteDialog.tsx` (W2) | `loadAttendanceForSessions` + types only | No |
| `MarkDayCompleteDialog.tsx` (W2) | `loadAttendanceForSessions`, `resolveAttendanceWriteMethod` + types | No |

**🚨 DECOY — `loaders/outreach.ts:1136` declares its OWN `upsertAttendance` and is NOT a call site.**
Grepping `upsertAttendance` to find the blast radius lands on it. It is an unrelated local
`runMutation<readonly OutreachAttendanceWriteRow[], void>` — batch-of-rows in, `void` out, versus
`attendance.ts`'s single-`UpsertAttendanceParams` in, `AttendanceRow` out. This is the **third
same-name-different-thing on this branch**, after the two `AttendanceRecordState`s and the two
`queryAttendanceForSessions`. It lives in **W2's actively-edited files** and it is the
`markDayComplete` path that **T305 and T307 just repaired** — touching it reopens settled
destructive-write work. **Do not modify it. Do not count it.**

**Therefore: if your prescription touches `makeUpsertAttendance`'s behaviour, the enumeration is TWO
call sites — `AttendancePanel` (existing, W2's, must be told) and `LiveConsole` (new, W1's, yours).**
State explicitly whether a W1-local fix (a new function, or resolving the value at the `LiveConsole`
call site) is achievable instead, and what it costs. W2 is ACTIVE in `src/pages/outreach/**` right
now — a behaviour change under them is the T320 failure mode repeating.

**Sibling observation, NOT in scope for this step — report it, do not fix it.** That decoy's payload
also carries `hours_override: row.hoursOverride` under the same `onConflict: 'session_id,student_id'`.
If Trap 1 confirms, note in your report whether the same shape is reachable there so W2 can be told;
it is W2's file and W1 does not own it.

### Trap 2 — provenance is currently hardcoded, and `resolveAttendanceWriteMethod` is not reachable

`handleSetStatus` hardcodes `method: 'coach'` in both the local record and the
`onSetAttendanceStatus(...)` call. `resolveAttendanceWriteMethod` exists precisely to preserve
`'qr'` / `'import'` provenance, and nothing in this file calls it. A student who scanned in and is
then adjusted by a coach would appear to lose their QR provenance.

But `SetAttendanceStatusFn`'s signature passes only the NEW method — the existing row's method is
known to the caller (`prev[studentId]`) and not threaded through.

**✅ CONFIRMED. No signature change is needed** — `SetAttendanceStatusFn` already carries `method`.
Resolve provenance at the call site with `resolveAttendanceWriteMethod(existing?.method ?? null)`,
the identical idiom `AttendancePanel.tsx:717` and `MarkDayCompleteDialog.tsx:723` already use.

**⚠️ DECISION THIS PACKET LEFT OPEN, now settled — the local record and the wire diverge.**
Trap 2 as originally written did not say what the *local* record's `method` becomes, and the naive
answer (store the resolved `'qr'` locally) **changes MTG-11 merge behaviour**, because
`mergeAttendanceUpdate` keys precedence off `method === 'coach'`. Adopt explicitly:

- **On the wire:** `resolveAttendanceWriteMethod(existing?.method ?? null)` — preserves real external
  provenance in the database.
- **In local state:** `method: 'coach'` — preserves MTG-11's "a coach-recorded value wins over a
  later non-coach update" precedence and keeps its existing green tests honest.

Capture `previousRecord` **inside the functional state updater**, not in render scope — render-scope
capture loses races on rapid clicks (the gate hit this while building).

**On `recorded_by` — this is PARTLY PRE-ANSWERED, and you are checking a stated intent, not deriving
one.** `UpsertAttendanceParams.recordedBy`'s own docstring (`attendance.ts:339-342`) is unambiguous:

> `attendance.recorded_by` — always the ACTING coach's own `profiles.id` (module doc #2 — always
> re-attributed to whoever is editing right now, even when `method` itself is preserved as `'qr'`).

Confirm that against the real column semantics rather than trusting the comment — but **do not
re-litigate it as an open design question.** It is a settled decision with a recorded rationale. If
your evidence contradicts it, that is a finding worth raising loudly; if it agrees, say so briefly
and move on.

### Trap 3 — a failed write is currently swallowed, so the UI would lie

```ts
onSetAttendanceStatus(...).catch(() => {
  // Persistence seam rejection -- the local state above is already the source of truth this UI shows.
});
```

That comment is true **only while the seam is a no-op**. Once the write is real, a rejected write
leaves the console showing a status that was never persisted — the coach believes attendance was
recorded when it was not. **This is the "lie to a user about their own data" case item 26 names as
the HEAVY trigger, and it is the single most important part of this step.**

**Gate must:** prescribe the failure behaviour concretely (roll back the optimistic update, surface
an error, or both) and confirm the prescription actually renders something a coach sees. A silent
`.catch` must not survive this step in any form.

### Trap 4 — `removeAttendance` may have no call site here

The kickoff framed step 3 as using "`upsertAttendance` / `removeAttendance`". But `LiveConsole` has
no un-mark affordance — its `SegmentedControl` always sets one of four statuses, and
`grep -n "removeAttendance\|un-mark"` against `LiveConsole.tsx` returns nothing.

**Gate must:** confirm whether `removeAttendance` has any reachable call site in this step. If it
does not, say so plainly and drop it from scope rather than inventing an un-mark UI.

### Trap 5 — `recordedBy` is nullable at the call site but required by the loader

`handleSetStatus` passes `user?.id ?? null`. `UpsertAttendanceParams.recordedBy` is a non-nullable
`string`. `makeOnEditAttendance` (`endMeeting.ts:447-473`, read-only reference — the `:461-472` cited in an
earlier revision is its inner closure) handles the same mismatch by rejecting **before** any network
call when identity is unavailable.

**Gate must:** confirm the precondition path and that MTG-12's existing `canSetExcused` role check
is not bypassed by whatever it prescribes.

## 4b. Test-seam hazard the gate found — READ BEFORE TOUCHING THE TESTS

**The existing `LiveConsole.test.tsx` coach-action tests pass against a real failing default ONLY BY
MICROTASK TIMING.** With the seam made real, every test that drives a coach action without injecting
`onSetAttendanceStatus` triggers a genuine rejected write (no Supabase in the gate state), which
fires the rollback. All 43 existing tests still passed at exit 0 in the gate's build — but only
because tests like the MTG-11 one (`LiveConsole.test.tsx:566-599`) have **no `await` between
`dispatchKeyOn` and their assertions**, so the rejection microtasks land after the last assert.
**Adding a single `flushMicrotasks` flips them red.**

That is a green suite that proves nothing about the path it appears to cover — the same family as the
three exit-0 mutations already found this session.

**Required:** every test exercising a coach action injects an explicit resolving *or* rejecting seam.
Do not rely on the default in any coach-action test.

**Authorized deletion:** the `persistence seam default` describe
(`LiveConsole.test.tsx:1009-1013`, *"notWiredSetAttendanceStatus resolves without throwing"*) pins
the no-op this step removes by design. Delete it along with `notWiredSetAttendanceStatus` itself.

**Criterion 4 precision:** assert coach-visible errors by **rendered text**, not `data-testid` —
`Banner`'s `data-testid` pass-through is unverified.

## 4c. Standing instructions for the worker (owner-set, 2026-08-02)

**1. The PostgREST caveat stays a stated residual — do not let it harden into "verified."**
The gate could not run the PostgREST binary itself. The payload-keys → `DO UPDATE SET` translation
is **inferred**, not observed end to end. The inference is well grounded — the shipped `check_in_at`
preservation depends on the identical mechanism, and the gate exercised it from both directions on a
real database — but your worker output must carry it as a **disclosed limit**, in those terms, not as
a proven fact.

**2. Do NOT start rendering `updatedAt`.** T405 (filed) established that `attendance.updated_at`
never moves on conflict-update — there is no `moddatetime` trigger and `attendance.ts` omits the
column. So a coach's own edit would display a **stale** timestamp. Nothing renders it today; step 3
must not be the first thing that does. Local optimistic state may continue to stamp it, as it does
now.

**3. Treat every remaining number in this packet as a CLAIM, not a fact.** This packet carried a
false *"four call sites across three workflows"* that was asserted **without grepping** — the exact
failure the packet exists to prevent — and was corrected in place at `799827e`. Its own history is
the best argument for its rules. **Verify any count, line cite, or file list before you rely on it,
and report anything that does not hold.** Being right about the code beats being faithful to this
document.

## 5. Acceptance criteria

1. A coach action in `LiveConsole` writes a real `attendance` row with correct `status`, `method`,
   and `recorded_by`, verified against a stubbed client capturing the actual payload.
2. An existing `hours_override` is **not** destroyed by a status change (Trap 1).
3. External `'qr'` / `'import'` provenance is preserved (Trap 2).
4. A rejected write is visible to the coach and does not leave the UI asserting a status that was
   never persisted (Trap 3).
5. No write is attempted without a resolved acting-coach identity (Trap 5).
6. MTG-12 excused-gating still holds for non-coach/admin roles.
7. Named mutations, each run, each reported with its real exit code — at minimum: break the
   provenance resolution; null the `hours_override`; remove the error surfacing. **A mutation that
   passes at exit 0 is a finding about the test, not a pass** — three have already been found this
   session (T161, T403 step 1, T403 step 2).

## 6. Gates

`.env.local` absent. `tsc` 0 · `vite build` ✓ · prettier clean · eslint 0 errors / 363 warnings ·
vitest **77 files / 1868 tests, exit 0** at this packet's head (`4ee0c52`). Assert exit codes, never
pass counts.
