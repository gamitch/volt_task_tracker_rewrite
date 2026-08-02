/**
 * T042: "Mark day complete" `Dialog` (OUT-05, coach-only), PRD line 296:
 *
 * "**OUT-05 Mark day complete (coach):** on/after a session date, **Mark day
 * complete** opens a `Dialog`: attendee checklist pre-checked from `going`
 * RSVPs (coach adjusts), actual **people reached** (`NumberInput`), optional
 * per-student hours override (`NumberInput`, defaults to session duration,
 * for partial attendance). Confirm -> session `completed`; checked students
 * get `attendance` rows (`method='coach'`, status `present`); hours computed
 * per MET-03. Not reversible without edit (audit-logged)."
 *
 * T309 UPDATE (module doc #10 below has the full writeup): this quotation
 * only ever described the CHECKED half of the checklist. This dialog now
 * also writes `status: 'absent'` for a student who is UNCHECKED but has a
 * recorded attending row -- the coach's uncheck is no longer a silent no-op.
 *
 * T305 UPDATE (module doc #9 below has the full writeup): the PRD quotation
 * above is left VERBATIM per constitution "Protected source text must remain
 * verbatim" -- it is superseded, not edited. The owner's T305 ruling
 * (`docs/swarm/auto-mode-decisions.md`, "2026-08-01 -- George's ruling on
 * T305") overrides the "pre-checked from `going` RSVPs" reading: the
 * checklist now seeds from RECORDED `attendance` when it exists for this
 * session, falling back to `going` RSVPs only where no attendance row exists
 * for a student.
 *
 * The PRD's own wireframe (line 469-481) additionally shows an "Adult
 * volunteers [4] count · [12] hours" row inside this same dialog (between
 * "People reached" and "Hours per student") -- this task's own packet
 * (Known Context/Traps #6) requires that field be built here too, WITH its
 * real event-vs-session granularity mismatch explicitly resolved (module doc
 * #3 below), not silently papered over.
 *
 * This is a standalone dialog component with its own injectable
 * `onMarkComplete` prop (Known Context/Traps #7). T179 UPDATE: `eventTitle`,
 * `session`, `roster`, `rsvps` and `currentUserProfileId` are no longer
 * optional-with-a-fixture-default -- see module doc #7 below for the full
 * writeup. `OutreachDetail.tsx` (T041) now mounts this dialog per-session,
 * staff-only, passing its own already-fetched session/roster/rsvps data and
 * the signed-in coach's real `profiles.id` straight through (T179, that
 * page's own module doc has the wiring writeup).
 *
 * -----------------------------------------------------------------------
 * 1. Ground truth -- `attendance`/`event_sessions`/`events` column shapes,
 *    cited directly from
 *    `supabase/migrations/20260717000000_scheduling_attendance.sql`
 *    (read-only), NOT redefined/renamed with invented fields:
 *
 *    `attendance` (lines 82-95): id, session_id fk `event_sessions`
 *    (restrict), student_id fk `students` (restrict), status text
 *    check(`'present'|'late'|'excused'|'absent'`), check_in_at timestamptz
 *    null, check_out_at timestamptz null, hours_override numeric null,
 *    method text check(`'qr'|'coach'|'import'`), recorded_by uuid references
 *    `profiles (id)` nullable, updated_at, created_at, unique(session_id,
 *    student_id).
 *
 *    `event_sessions` (lines 53-63): id, event_id, session_date (date),
 *    starts_at (timestamptz), ends_at (timestamptz), status (check:
 *    'scheduled' | 'completed' | 'canceled'), people_reached (int, null),
 *    notes, created_at.
 *
 *    `events` (lines 33-48): ..., adult_volunteers_count (int, not null
 *    default 0), adult_volunteer_hours (numeric, not null default 0), ...
 *    -- these two columns live on `events`, NOT `event_sessions` (module doc
 *    #3, the granularity mismatch).
 *
 *    `RosterStudent`/`RsvpRow`/`MarkDayCompleteSession` below are camelCase
 *    renames of the subset of these columns (plus `rsvps`, migration lines
 *    67-76) this dialog needs, matching `OutreachDetail.tsx`'s (T041,
 *    Forbidden Files, read-only reference per this task's own Dependencies)
 *    own field names/casing exactly (id, sessionId/eventId, studentId,
 *    status, respondedBy, updatedAt, createdAt / id, eventId, sessionDate,
 *    startsAt, endsAt, status, peopleReached, notes) so a future wiring task
 *    can pass its already-fetched objects straight through with no
 *    reshaping -- independently reimplemented here (not imported), since
 *    `OutreachDetail.tsx`/`RsvpControl.tsx` are both Forbidden Files for this
 *    task.
 *
 * -----------------------------------------------------------------------
 * 2. THE MET-03 FORMULA-OWNERSHIP TRAP (Known Context/Traps #1 -- the single
 *    most important distinction in this task, constitution item 3,
 *    BLOCKER-class if gotten wrong). Read `v_student_hours`
 *    (`supabase/migrations/20260717000003_metric_views.sql` lines 3-19,
 *    read-only, cited here for context only) BEFORE reading this section:
 *
 *      sum(coalesce(
 *        a.hours_override,
 *        case when check_in_at/check_out_at both present
 *          then clamp(check_out - check_in, session window)
 *        end,
 *        extract(epoch from (es.ends_at - es.starts_at)) / 3600.0
 *      ))
 *
 *    This dialog is a WRITE path, not a read path -- it does not compute a
 *    student's real confirmed-hours total, ever. It writes (up to) THREE of
 *    that coalesce chain's raw inputs per row it constructs (T309 UPDATE:
 *    no longer only "per checked student" -- an unchecked student with a
 *    recorded attending row now also gets a row, carrying these same three
 *    tiers through unchanged; module doc #10) -- `hours_override`
 *    (tier 1), `check_in_at`/`check_out_at` (tier 2, T305 UPDATE: no longer
 *    always `null` -- see module doc #9), and implicitly relies on
 *    `starts_at`/`ends_at` (tier 3,
 *    already stored on `event_sessions`, never rewritten by this dialog) --
 *    and NEVER reproduces the SQL `coalesce`/`case`/`greatest`/`extract`
 *    chain itself in TypeScript. Two, and only two, genuinely legitimate
 *    computations happen client-side, both exported and independently
 *    tested, neither a re-derivation of the view:
 *
 *    (a) `computeSessionDurationHours(session)` -- a single, plain
 *        subtraction, `(ends_at - starts_at) / 3600000`. This IS, verbatim,
 *        MET-03's own tier-3 fallback expression -- but it is computed here
 *        ONLY to seed the per-student `NumberInput`'s displayed starting
 *        value (a sensible default the coach can override for partial
 *        attendance, matching OUT-05's own literal "defaults to session
 *        duration" wording), never presented as a claim about a student's
 *        real confirmed-hours total, and never combined with a coalesce/case
 *        chain over `hours_override`/`check_in_at`/`check_out_at` the way
 *        the view's tier-3 branch actually is. Computing one arithmetic tier
 *        of a three-tier formula, in isolation, for a UI-default purpose, is
 *        not "duplicating a metric formula" in the sense constitution item 3
 *        forbids -- duplicating the formula would mean re-implementing the
 *        `coalesce`/conditional structure that decides WHICH tier wins for a
 *        given row, which this file does not do anywhere (grep-provable: no
 *        `??`/ternary chain here ever inspects `checkInAt`/`checkOutAt` to
 *        decide a fallback -- T305 UPDATE: this dialog still never COLLECTS
 *        check-in/check-out timestamps from the coach (no UI field for them
 *        exists anywhere in this file), but it now CARRIES a previously
 *        recorded pair through unchanged for a student whose row already had
 *        them -- see (c) below and module doc #9).
 *
 *    (b) `computeTotalHoursForCheckedStudents(checkedStudentIds,
 *        hoursByStudentId)` -- the BEH-07 confirm button's live "N attended
 *        · M h" total (module doc #4) is a plain `Array.reduce` SUM over the
 *        exact per-student hours values this dialog is ABOUT TO WRITE (each
 *        one either an explicit coach-entered override, or, when untouched,
 *        the same tier-3 default from (a)) -- a local aggregation of this
 *        dialog's OWN pending writes, never a query against
 *        `v_student_hours`, never a sum across other sessions/seasons, never
 *        anything resembling the view's `group by student_id, season_id`
 *        cross-session aggregation. It is legitimate specifically BECAUSE
 *        every value it sums is a value this exact submit is constructing --
 *        with one disclosed exception, T309 UPDATE: this submit now also
 *        constructs `'absent'` rows for unchecked students with a recorded
 *        attending row (module doc #10), and this sum deliberately EXCLUDES
 *        them (an absent student is not "attended" and contributes no
 *        hours) -- so "every value it sums" now describes the CHECKED
 *        subset of what this submit writes, not everything it writes.
 *
 *    (c) T305 UPDATE -- **genuinely weaker now, disclosed honestly rather
 *        than silently left stale (see module doc #9 and this task's own
 *        ledger deferral, T308).** Before this task, (a)+(b) could never
 *        silently drift from the real SQL result for ANY row this dialog
 *        wrote, because `buildAttendanceWriteRows` unconditionally wrote
 *        `checkInAt: null, checkOutAt: null` for every row, forcing
 *        `v_student_hours`'s own tier-2 CASE branch to evaluate to SQL
 *        `NULL` (its `when` clause literally requires both non-null) so
 *        `coalesce` always fell through to tier 3 -- a structural guarantee,
 *        not a coincidence. **That guarantee no longer holds.**
 *        `buildAttendanceWriteRows` now CARRIES a previously-recorded
 *        row's real `checkInAt`/`checkOutAt` through unchanged (module doc
 *        #9) -- so a checked student who already had both timestamps
 *        recorded (typically via QR check-in/out) can make tier 2 fire in
 *        the real SQL, while this file's own local sum ((a)+(b)) still only
 *        ever computes `hoursOverride ?? tier-3-duration` and has no way to
 *        evaluate tier 2 itself (doing so would be the actual re-derivation
 *        constitution item 3 forbids). The confirm button's total can
 *        therefore legitimately disagree with `v_student_hours` for such a
 *        student. This is disclosed, not fixed, here -- filed as T308 (see
 *        module doc #9); the alternative silently written by the PRE-T305
 *        code was "agrees with SQL only because the write destroyed the
 *        real timestamps first", which is a worse kind of agreement.
 *
 *    Per Ground Truth/module doc #1: T305 UPDATE -- `hoursOverrideByStudentId`
 *    no longer holds an entry ONLY for a student the coach has explicitly
 *    edited. On open, it is also seeded with every recorded row's own
 *    non-null `hoursOverride` (module doc #9), independent of whether that
 *    student starts checked -- so an untouched-by-the-coach student's write
 *    can now legitimately carry a real, previously-recorded, non-null
 *    `hoursOverride` that this dialog itself never invented (it is a
 *    read-then-preserve, not a fabrication). A student with genuinely no
 *    recorded override and no coach edit still writes `hoursOverride: null`,
 *    letting `v_student_hours` fall back to the real session-duration tier
 *    for that row exactly as before.
 *
 * -----------------------------------------------------------------------
 * 3. THE ADULT-VOLUNTEERS EVENT-VS-SESSION GRANULARITY MISMATCH (Known
 *    Context/Traps #6 -- explicit disclosure required, not silently papered
 *    over).
 *
 * `events.adult_volunteers_count`/`adult_volunteer_hours` (module doc #1)
 * are EVENT-level columns. PRD line 293 (OUT-02, already built by T039, a
 * Forbidden File here) also lists an "adult volunteers (NumberInput x2:
 * count and hours -- persisted on events for grant reporting)" field on the
 * event CREATE/EDIT dialog -- meaning the schema's real intent is a single
 * event-wide total, normally set once. But OUT-05's own wireframe (PRD line
 * 478, quoted at the top of this file) ALSO shows the identical two fields
 * inside THIS dialog, which completes exactly ONE `event_sessions` row at a
 * time. A multi-day outreach event (the same scenario `OutreachDetail.tsx`'s
 * own module doc #4 already flagged for per-session RSVP grouping) would
 * have this dialog opened once PER DAY -- so naively treating these fields
 * as "the event's total, coach edits it live" risks a second day's coach
 * overwriting a first day's already-recorded contribution if they don't
 * realize the field is shared across sessions (the packet's own option (b)
 * risk).
 *
 * RESOLUTION -- option (a) from this task's packet, chosen deliberately:
 * these fields are THIS SESSION'S OWN CONTRIBUTION, not the event's running
 * total. `MarkDayCompletePayload.adultVolunteersCountThisSession`/
 * `adultVolunteerHoursThisSession` (module doc #5) are DELTAS to be ADDED to
 * `events.adult_volunteers_count`/`adult_volunteer_hours`'s current value by
 * whoever performs the real persistence (an additive `UPDATE ... SET
 * adult_volunteers_count = adult_volunteers_count + $delta`, never a raw
 * overwrite) -- not the absolute values to `SET` those columns to. This
 * dialog therefore deliberately never reads/displays the event's current
 * cumulative total at all (no `eventAdultVolunteersCount` prop exists on
 * this component, grep-provable) -- it only ever asks "how many adult
 * volunteers helped, and how many hours did they contribute, TODAY", which
 * is genuinely session-scoped information a coach standing at this specific
 * session can answer accurately regardless of what any other day's coach
 * already recorded, and is honestly re-labeled in the rendered UI ("Adult
 * volunteers (this session)" / "Adult volunteer hours (this session)", not
 * OUT-02's bare "Adult volunteers" label) plus a standalone disclosure
 * `Text` line so a coach isn't misled into thinking they're viewing/editing
 * the event's already-recorded grand total. Both fields default to `0`
 * (module doc #7 -- no live volunteer headcount data source exists yet
 * either), never fetched from `events` (there is nothing to fetch under this
 * resolution). This is a disclosed, defensible judgment call per the
 * packet's own instruction, not a silent assumption -- option (b) (treat the
 * value as the event's live running total, letting the coach see/edit the
 * shared cumulative number directly) was considered and rejected specifically
 * because of the cross-session-overwrite risk described above, which a
 * per-session delta structurally cannot cause.
 *
 * -----------------------------------------------------------------------
 * 4. BEH-07 confirm button states the computed outcome (Known Context/Traps
 *    #2) -- never a bare "Confirm"/"Submit"/"OK" (DES-14, PRD line 210 also
 *    quotes this same discipline generally).
 *
 * `computeMarkCompleteConfirmLabel(attendedCount, totalHours)` is the ONE
 * place this label is produced: `"Mark complete — N attended · M h"`
 * (em dash + middle dot, matching the packet's own literal example text
 * verbatim). Both numbers are recomputed live from the checklist/hours-state
 * on every render (`checkedStudentIds.length` and
 * `computeTotalHoursForCheckedStudents`, module doc #2(b)) -- proven in the
 * test file by toggling a checklist row and asserting the button's own text
 * content changes accordingly, with no page reload/re-open required.
 *
 * -----------------------------------------------------------------------
 * 5. "Not reversible without an audit-logged edit" (Known Context/Traps #3).
 *
 * This dialog performs one one-way action per submit: `onMarkComplete`
 * (module doc #7) is called once, the caller is expected to flip
 * `event_sessions.status` to `'completed'` and insert the `attendance` rows
 * this file constructs -- this task does not build the separate
 * "audit-logged edit" flow itself (presumably `LiveConsole.tsx`/a future
 * task's post-completion-edit path, already noted elsewhere in this project
 * as "attendance remains coach-editable post-completion"). Two concrete,
 * disclosed guardrails this file DOES own:
 *   (i) The footer's only action button, when eligible, is labeled with the
 *       live outcome (module doc #4) -- never "Confirm"/"Undo"/anything
 *       implying reversibility.
 *   (ii) `isSessionEligible = session.status === 'scheduled'` (module doc
 *        #6): if this dialog is ever opened against a session that is
 *        already `'completed'` or `'canceled'`, it renders NO checklist, NO
 *        hours inputs, and NO "Mark complete" action at all -- only an
 *        informational `Banner` explaining the session isn't eligible to be
 *        (re-)completed from this dialog, plus a plain "Close" button. This
 *        prevents this dialog itself from ever being the surface a coach
 *        casually re-runs the one-way action from -- proven in the test file
 *        by rendering with a `'completed'`-status session fixture and
 *        asserting neither the checklist nor the confirm button exists in
 *        the DOM.
 *
 * -----------------------------------------------------------------------
 * 6. Attendee checklist pre-checked from `going` RSVPs, coach adjusts (Known
 *    Context/Traps #4). T305 UPDATE: this is now the FALLBACK derivation,
 *    not the checklist's one seeding entry point -- see module doc #9.
 *
 * `computeInitialAttendedStudentIds(sessionId, roster, rsvps)` remains
 * exported and behaviourally unchanged: a roster student with a `rsvps` row
 * `status === 'going'` for this session starts checked; a student with
 * `'maybe'`/`'declined'`/no `rsvps` row at all starts unchecked -- proven
 * directly in the test file with a four-student fixture spanning all four
 * cases. It is still directly tested, and `MarkEventCompleteDialog.tsx`
 * still imports it (its own bulk-mode seeding, unchanged -- see module doc
 * #9's T307 note). T305 UPDATE: within THIS dialog it is no longer the sole
 * derivation -- `computeInitialFormSeed` (module doc #9) calls it only as
 * the per-student "no recorded row" fallback and as the whole seed when no
 * attendance has been loaded yet or the load failed. `CheckboxList`'s own
 * `value`/`onChange` (module doc #8) still lets the coach freely re-check/
 * uncheck ANY row afterward regardless of its starting state, proven by
 * toggling both a pre-checked and a not-pre-checked row.
 *
 * -----------------------------------------------------------------------
 * 7. T101 (ED-1 Packet P10) UPDATE: `onMarkComplete` now defaults to a REAL
 *    mutation.
 *
 * The real `event_sessions` status flip + `attendance` upserts + `events`
 * additive adult-volunteer update (module doc #3) are represented as a
 * single injectable `onMarkComplete: (payload) => Promise<void>` prop, now
 * defaulting to `markDayComplete` (`../../lib/supabase/loaders/outreach.ts`)
 * -- that loader module's own module doc #4 has the full three-write
 * writeup, including the disclosed non-atomic read-modify-write for the
 * `events` adult-volunteer delta (Postgrest has no atomic `SET column =
 * column + $delta` expression without an RPC, which is out of this task's
 * Allowed Files). `defaultOnMarkComplete` (below) is KEPT as a named export
 * for callers/tests that want an explicit no-network, log-only stub, but is
 * no longer this component's own runtime default. `currentUserProfileId`
 * (attributed to `attendance.recorded_by`, a real `profiles.id`, module doc
 * #1) is a SEPARATE injectable prop.
 *
 * T179 UPDATE: `eventTitle`/`session`/`roster`/`rsvps`/`currentUserProfileId`
 * are now REQUIRED, not optional-with-a-fixture-default. Before this task
 * each one defaulted to its own hardcoded fixture value (a fabricated event
 * title, session, four-student roster, rsvp set, and a disclosed-but-fake
 * coach profile id, respectively -- deliberately not named here by their old
 * identifiers, since A3 of this task requires zero occurrences of those
 * identifiers anywhere in this file, prose included). A call site that
 * forgot one of these compiled cleanly and silently wrote real `attendance`
 * rows for fixture students under a fake `recorded_by`. Deleting the
 * defaults turns that omission into a `tsc` error instead. `OutreachDetail.tsx`
 * (T179) now mounts this dialog per-session, staff-only, and passes its own
 * real already-fetched session/roster/rsvps and the signed-in coach's real
 * `profiles.id` -- see that page's own module doc for the wiring writeup.
 * `defaultOnMarkComplete`/`onMarkComplete` are unaffected by this change and
 * remain optional (that seam has no fixture-fabrication risk: an omitted
 * `onMarkComplete` still resolves to the real `markDayComplete` mutation, not
 * a fake value).
 *
 * -----------------------------------------------------------------------
 * 8. Astryx prop sourcing (constitution item 2) -- every prop used below,
 *    cross-checked directly against `docs/swarm/astryx-api.md` (grepped live
 *    for this task):
 *
 *  - `Dialog` ("Dialog" section, Props table): `isOpen`, `onOpenChange`,
 *    `children`, `purpose` (`"form"`, matching `ScheduleMeetingsDialog.tsx`'s
 *    own citation for an input-collecting dialog) used.
 *  - `DialogHeader`: doc's own "Components > DialogHeader" subsection is
 *    `undefined` (same disclosed gap `ScheduleMeetingsDialog.tsx` already
 *    hit) -- props taken from the "Dialog" section's own worked `## Example`
 *    code block (`title`, `onOpenChange`) plus `subtitle`, independently
 *    confirmed directly against the installed source
 *    (`node_modules/@astryxdesign/core/dist/Dialog/DialogHeader.d.ts`):
 *    `title` (required), `subtitle`, `onOpenChange` used.
 *  - `Layout`/`LayoutContent`/`LayoutFooter`: "Layout" Props table +
 *    `node_modules/@astryxdesign/core/dist/Layout/LayoutContent.d.ts` /
 *    `LayoutFooter.d.ts` (doc's own Components subsections for both are
 *    `undefined`, confirmed directly). `header`, `content`, `footer`
 *    (Layout); `children` (LayoutContent); `children`, `hasDivider`
 *    (LayoutFooter) used.
 *  - `FormLayout` ("FormLayout" section, Props table): `children` used
 *    (default vertical direction, matching the doc's own "stack fields
 *    vertically for most forms" guidance).
 *  - `CheckboxList`/`CheckboxListItem` ("CheckboxList" section, Props table +
 *    `node_modules/@astryxdesign/core/dist/CheckboxList/CheckboxListItem.d.ts`,
 *    doc's own Components subsection is `undefined`, confirmed directly,
 *    same posture `ScheduleMeetingsDialog.tsx` already established for its
 *    own weekday `CheckboxList`). `label`, `value`, `onChange`, `hasDividers`
 *    (CheckboxList); `label`, `value` (CheckboxListItem) used.
 *  - `NumberInput` ("NumberInput" section, Props table): `label`, `value`,
 *    `onChange`, `min`, `step`, `units`, `isIntegerOnly`, `hasClear`,
 *    `isOptional` used.
 *  - `Button` ("Button" section, Props table): `label`, `variant`,
 *    `isDisabled`, `isLoading`, `clickAction`, `onClick` used.
 *  - `Banner` ("Banner" section, Props table): `status`, `title`,
 *    `description` used.
 *  - `HStack`/`VStack` ("Stack" section, `HStack`/`VStack` subsections):
 *    `gap`, `hAlign`, `wrap` used.
 *  - `Text` ("Text" section, Props table): `type` (`'supporting'`), `color`
 *    used.
 *
 * -----------------------------------------------------------------------
 * 9. T305 (owner ruling "show attendance for T305",
 *    `docs/swarm/auto-mode-decisions.md` "2026-08-01 -- George's ruling on
 *    T305") -- seed from RECORDED attendance, not just RSVP intent, and
 *    carry recorded provenance through the write. NOT authorized: writing
 *    `rsvps` rows from attendance (`OutreachList.tsx:1685-1687`'s T121
 *    finding, verbatim, still governs: "RSVP is intent, not a real
 *    attendance record.") -- attendance and RSVP stay separate records,
 *    only the display/seed changes.
 *
 * Load seam: `loadAttendance?: LoadAttendanceForSessionsFn`
 * (`../../lib/supabase/loaders/attendance.ts`), defaulting to the real
 * `loadAttendanceForSessions` -- the same real-default-injectable
 * convention `onMarkComplete` already established on this same props
 * interface. Loads THIS session only (`loadAttendance([session.id])`) on
 * open. On failure, or while still in flight, the checklist/hours state
 * falls back to exactly today's RSVP-only seeding -- no error banner, no
 * blocked confirm, no spinner. This is deliberately different from the
 * bulk "Mark event complete" path (`MarkEventCompleteDialog.tsx`, T307),
 * where a failed load must ABORT the write rather than fall back: THIS
 * dialog only ever *displays* the seed for a coach to confirm deliberately,
 * so a degraded display is recoverable; a silent bulk write under a failed
 * load is not.
 *
 * `computeInitialFormSeed(sessionId, roster, rsvps, recordedRows)` is the
 * new, single seeding entry point: `recordedRows === null` (not loaded yet,
 * or the load failed) reproduces `computeInitialAttendedStudentIds`'s
 * result verbatim with an empty hours map (today's behaviour, unchanged).
 * Otherwise, per roster student: a recorded row exists -> checked iff
 * `isAttendingStatus(row.status)` (imported from `./AttendancePanel`, the
 * semantic owner of that decision -- NOT re-derived here), and
 * independently, if that row's `hoursOverride` is non-null, the hours map
 * carries it regardless of checked state (this is load-bearing, not
 * tidiness -- see W6/§4's own writeup: seeding the hours map only for
 * students who start checked lets the confirm label and the actual write
 * diverge for a student the coach deliberately checks after the fact). No
 * recorded row -> checked iff a `going` RSVP exists (today's rule, applied
 * per student, not just as the null-branch fallback). A recorded `absent`
 * row starts UNCHECKED even if the student RSVP'd `going`. `recordedRows`
 * carries `AttendanceRow` from `../../lib/supabase/loaders/attendance.ts` --
 * note that file declares its OWN `AttendanceStatus`/`AttendanceMethod`
 * unions, textually identical to (but a distinct declaration from) this
 * file's own `AttendanceStatus`/`AttendanceMethod` below; values cross that
 * boundary and compile only because the unions are structurally identical.
 * Deliberately NOT unified/deleted -- that would be scope growth beyond
 * this task.
 *
 * Applying the seed without clobbering the coach: the hours map is merged
 * UNCONDITIONALLY on every load resolution (`setHoursOverrideByStudentId(
 * prev => ({ ...recordedOverrides, ...prev }))` -- recorded values win at
 * open (`prev` is `{}`), anything the coach has since typed is already in
 * `prev` and survives; this merge is NOT gated by the touched-ref below,
 * since gating it would reopen the exact label-vs-write divergence W6
 * exists to close for a late-arriving load). The checklist itself DOES need
 * an explicit guard -- "unchecked everyone" and "did nothing yet" are both
 * just an empty/partial array -- so a `useRef(false)` is set true by the
 * checklist's own `onChange` or by an hours edit, cleared on every
 * open/session-reset, and the recorded `checkedStudentIds` are only applied
 * if the dialog is still open, still showing the SAME session, and that ref
 * is still false. This guard governs the CHECKLIST ONLY -- loaded rows
 * still drive the write-preservation rule below whether or not the seed was
 * actually applied to the checklist.
 *
 * Write preservation: `buildAttendanceWriteRows` gains a REQUIRED fifth
 * parameter, the loaded rows keyed by student id -- required, not optional,
 * because a call site that forgets the recorded rows is the exact bug this
 * task exists to prevent, and it must not compile (same T151/T179
 * mechanism this file already uses for its other required props). Per
 * checked student, with `existing` its loaded row (may be absent): `status`
 * stays the recorded status iff `isAttendingStatus(existing.status)` (a
 * recorded `'late'` stays `'late'`; a recorded `'absent'` the coach
 * deliberately checks becomes `'present'`), else `'present'`; `checkInAt`/
 * `checkOutAt` carry the recorded values (`?? null` -- see module doc
 * #2(c)'s now-honest writeup); `hoursOverride` is the coach's own edit if
 * present, else the recorded override, else `null`; `method` is
 * `resolveAttendanceWriteMethod(existing?.method ?? null)`
 * (`../../lib/supabase/loaders/attendance.ts`) -- NEVER the hardcoded
 * `'coach'` this file wrote before T305; `recordedBy` stays
 * `currentUserProfileId`, the ACTING coach, deliberately UNCHANGED even
 * when `method` itself is preserved as `'qr'`/`'import'` (matching
 * `UpsertAttendanceParams.recordedBy`'s own doc and `AttendancePanel.tsx`'s
 * two write paths, `:718`/`:791`) -- so a later reader does not "fix" this
 * into the recorded row's own `recordedBy`. A student with NO recorded row
 * is written exactly as before this task: `status: 'present'`, both
 * timestamps `null`, `method: 'coach'`, `hoursOverride` from the coach's map
 * or `null`.
 *
 * Two consequences disclosed, not solved, here: (a) T308 -- the confirm
 * button's local hours sum (module doc #2(b)) can now legitimately disagree
 * with `v_student_hours` for a student whose preserved timestamps make the
 * SQL view's tier 2 fire, since this dialog computes only `hoursOverride ??
 * tier-3-duration` and must not re-derive the view's tier selection in
 * TypeScript (constitution item 3) -- see module doc #2(c)'s rewrite. (b)
 * T307 -- `MarkEventCompleteDialog.tsx`'s bulk path still seeds from RSVPs
 * only and writes an empty recorded-rows argument (its own module doc has
 * the three corrected clauses); it is a live, filed, deliberately
 * out-of-scope data-loss bug this task does not touch.
 *
 * -----------------------------------------------------------------------
 * 10. T309 (owner ruling `docs/swarm/auto-mode-decisions.md`, 2026-08-02) --
 *     unchecking a student who has a recorded attending row must actually
 *     record the absence, not silently do nothing.
 *
 * Before this task, `buildAttendanceWriteRows` (module doc #2/#5) maps ONLY
 * `checkedStudentIds` -- so unchecking a student shown as attending (module
 * doc #9's recorded-attendance seed) emitted NOTHING for them, and their
 * existing `attendance` row survived untouched. `AttendancePanel.tsx`'s own
 * uncheck path DELETEs the row (T119, under George's D-7 ruling, "coach is
 * ultimate authority" -- authority, not mechanism); this dialog does not
 * touch that path or reverse D-7. `v_student_hours` sums `where a.status in
 * ('present','late')`, so a `'absent'` row contributes zero hours exactly as
 * a deleted row does.
 *
 * `buildAttendanceAbsenceRows(sessionId, roster, checkedStudentIds,
 * recordedBy, recordedRowByStudentId)` is the new, second place `attendance`
 * rows are constructed (module doc #2/#5's `buildAttendanceWriteRows` stays
 * BYTE-IDENTICAL -- it is shared with `MarkEventCompleteDialog.tsx`'s bulk
 * mode, which has no check/uncheck UI at all and so cannot legitimately
 * emit an absence from any coach gesture). Per ROSTER student (never
 * `Object.keys(recordedRowByStudentId)` -- a recorded row for a student not
 * on this event's roster must never be demoted; `computeInitialFormSeed`
 * above never checks such a student either, so keying off the recorded map
 * would fabricate a write from a list the coach never saw): if the student
 * is checked, skip. Otherwise, if their recorded row's status is NOT
 * `isAttendingStatus` (imported from `./AttendancePanel`, same semantic
 * owner as module doc #9 -- a single guard, not a separate
 * `existing === undefined` arm, since `isAttendingStatus` already returns
 * `false` for `undefined`), skip -- no recorded row, or already
 * `'absent'`/`'excused'`, means nothing changed. Otherwise, write `status:
 * 'absent'`, carrying `checkInAt`/`checkOutAt`/`hoursOverride`/`method`
 * (via `resolveAttendanceWriteMethod`, provenance preserved) through
 * VERBATIM from the recorded row -- only `status` changes, which is the
 * entire reason `'absent'` was chosen over DELETE (a DELETE needs a second,
 * non-atomic write step in `markDayComplete`; `'absent'` rides the existing
 * single upsert). `recordedBy` is the ACTING coach (`currentUserProfileId`),
 * never the recorded row's own `recordedBy` -- matching module doc #9's same
 * rule for `buildAttendanceWriteRows`. The coach's live
 * `hoursOverrideByStudentId` map is deliberately NOT consulted here: an edit
 * typed before unchecking belongs to a student the coach has now said was
 * not present.
 *
 * `handleSubmit` concats both functions' output:
 * `[...buildAttendanceWriteRows(...), ...buildAttendanceAbsenceRows(...)]`.
 * The BEH-07 confirm label (module doc #4) is unaffected by design -- an
 * absent student is not "attended" and contributes no hours, so
 * `computeTotalHoursForCheckedStudents`/`checkedStudentIds.length` (which
 * this label is built from) must not, and do not, see these rows.
 * `loaders/outreach.ts`'s `markDayComplete` needs no change: it upserts
 * whatever `payload.attendance` contains, and its `> 0` length guard now
 * also (correctly) passes when the only rows present are absences.
 */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Banner,
  Button,
  CheckboxList,
  CheckboxListItem,
  Dialog,
  DialogHeader,
  FormLayout,
  HStack,
  Layout,
  LayoutContent,
  LayoutFooter,
  NumberInput,
  Text,
  VStack,
} from '@astryxdesign/core';
// T101 (ED-1 Packet P10): real `onMarkComplete` default -- module doc #7.
import { markDayComplete } from '../../lib/supabase/loaders/outreach';
// T305: recorded-attendance load seam + the write-method decision this file
// no longer hardcodes -- module doc #9.
import {
  loadAttendanceForSessions,
  resolveAttendanceWriteMethod,
  type AttendanceRow,
  type LoadAttendanceForSessionsFn,
} from '../../lib/supabase/loaders/attendance';
// T305: `isAttendingStatus` is imported, not re-derived -- `AttendancePanel.tsx`
// is the semantic owner of "which recorded statuses count as attending"
// (module doc #9). No import cycle: `AttendancePanel.tsx` never imports from
// this file.
import { isAttendingStatus } from './AttendancePanel';

// ---------------------------------------------------------------------------
// Types -- verbatim camelCase renames of real column subsets. Module doc #1.
// ---------------------------------------------------------------------------

export type SessionStatus = 'scheduled' | 'completed' | 'canceled';
export type RsvpStatus = 'going' | 'maybe' | 'declined';
/** `attendance.status` -- T305 UPDATE: this dialog now writes `'late'` too,
 * when preserving a recorded `'late'` row through a coach-confirmed submit
 * (module doc #9) -- `'excused'` remains real but not produced by this
 * file. T309 UPDATE: this dialog now writes `'absent'` too, for an
 * unchecked student with a recorded attending row (module doc #10).
 * Textually identical to, but a distinct declaration from,
 * `../../lib/supabase/loaders/attendance.ts`'s own `AttendanceStatus`
 * (module doc #9's shadowing note) -- deliberately not unified here. */
export type AttendanceStatus = 'present' | 'late' | 'excused' | 'absent';
/** `attendance.method` -- T305 UPDATE: this dialog now writes `'qr'`/
 * `'import'` too, when preserving a recorded row's real provenance (module
 * doc #9) via `resolveAttendanceWriteMethod`, never a hardcoded `'coach'`.
 * Textually identical to, but a distinct declaration from,
 * `../../lib/supabase/loaders/attendance.ts`'s own `AttendanceMethod`. */
export type AttendanceMethod = 'qr' | 'coach' | 'import';

export interface RosterStudent {
  id: string;
  name: string;
  teamId: string;
}

export interface RsvpRow {
  id: string;
  sessionId: string;
  studentId: string;
  status: RsvpStatus;
  respondedBy: string | null;
  updatedAt: string;
  createdAt: string;
}

export interface MarkDayCompleteSession {
  id: string;
  eventId: string;
  sessionDate: string;
  startsAt: string;
  endsAt: string;
  status: SessionStatus;
  peopleReached: number | null;
  notes: string;
}

/** One real `attendance` row this dialog is about to write. Module doc #2. */
export interface AttendanceWriteRow {
  sessionId: string;
  studentId: string;
  status: AttendanceStatus;
  /** T305 UPDATE: no longer always `null` -- carries a preserved recorded
   * row's real value through unchanged (module doc #9); still never
   * COLLECTED from the coach in this dialog's own UI (module doc #2(c)). */
  checkInAt: string | null;
  checkOutAt: string | null;
  /** T305 UPDATE: `null` no longer means "the coach never touched this
   * student's row" -- it can also be a genuinely preserved recorded
   * override the coach never touched (module doc #9). MET-03's SQL falls
   * back to the real session-duration tier for a genuinely-null value,
   * never silently written here as a frozen numeric default. */
  hoursOverride: number | null;
  method: AttendanceMethod;
  recordedBy: string;
}

/** Module doc #3 -- `adultVolunteersCountThisSession`/
 * `adultVolunteerHoursThisSession` are DELTAS to be ADDED to
 * `events.adult_volunteers_count`/`adult_volunteer_hours`'s current value,
 * never absolute values to overwrite those columns with. */
export interface MarkDayCompletePayload {
  sessionId: string;
  peopleReached: number | null;
  attendance: readonly AttendanceWriteRow[];
  adultVolunteersCountThisSession: number;
  adultVolunteerHoursThisSession: number;
  /** `attendance.recorded_by` for every row above -- a real `profiles.id`. */
  recordedBy: string;
}

export type OnMarkDayCompleteFn = (payload: MarkDayCompletePayload) => Promise<void>;

// ---------------------------------------------------------------------------
// Pure functions -- exported for direct testing. Module docs #2/#4/#6.
// ---------------------------------------------------------------------------

/** Module doc #2(a) -- MET-03's own tier-3 fallback expression, computed
 * here ONLY as a UI default-value seed, never combined with a coalesce/case
 * chain over `hoursOverride`/`checkInAt`/`checkOutAt` the way the real SQL
 * view's tier-3 branch actually is. */
export function computeSessionDurationHours(session: { startsAt: string; endsAt: string }): number {
  const ms = new Date(session.endsAt).getTime() - new Date(session.startsAt).getTime();
  return Math.max(ms, 0) / (1000 * 60 * 60);
}

/** Module doc #6 -- T305 UPDATE: no longer the one place the checklist's
 * starting state is derived (that is now `computeInitialFormSeed`, module
 * doc #9) -- this is its RSVP-only fallback branch, still exported,
 * behaviourally unchanged, and still directly tested/imported by
 * `MarkEventCompleteDialog.tsx`. A roster student with a `'going'` `rsvps`
 * row for this session starts checked; `'maybe'`/`'declined'`/no row at all
 * starts unchecked. */
export function computeInitialAttendedStudentIds(
  sessionId: string,
  roster: readonly RosterStudent[],
  rsvps: readonly RsvpRow[],
): string[] {
  const goingStudentIds = new Set(
    rsvps
      .filter((rsvp) => rsvp.sessionId === sessionId && rsvp.status === 'going')
      .map((rsvp) => rsvp.studentId),
  );
  return roster.filter((student) => goingStudentIds.has(student.id)).map((student) => student.id);
}

/** T305, module doc #9 -- filters the loaded rows to THIS session and keys
 * them by student id. Does not trust the caller to have pre-filtered
 * (§4/module doc #9). Not exported -- internal to this file's own seeding/
 * write-preservation, both of which take the raw `recordedRows` array. */
function buildRecordedRowsByStudentId(
  sessionId: string,
  recordedRows: readonly AttendanceRow[],
): Record<string, AttendanceRow> {
  const rowsByStudentId: Record<string, AttendanceRow> = {};
  for (const row of recordedRows) {
    if (row.sessionId === sessionId) rowsByStudentId[row.studentId] = row;
  }
  return rowsByStudentId;
}

/** T305, module doc #9 -- THE new single entry point for the checklist's
 * starting state and its seeded hours overrides. `recordedRows === null`
 * (not loaded yet, or the load failed) reproduces
 * `computeInitialAttendedStudentIds`'s result verbatim with an empty hours
 * map -- today's behaviour, unchanged. Otherwise, per roster student: a
 * recorded row -> checked iff `isAttendingStatus(row.status)`,
 * INDEPENDENTLY seeding the hours map with that row's own non-null
 * `hoursOverride` regardless of checked state (load-bearing -- see module
 * doc #9's W6 writeup); no recorded row -> checked iff a `going` RSVP
 * exists for this session (today's per-student rule). Filters by
 * `sessionId` itself -- does not trust the caller. */
export function computeInitialFormSeed(
  sessionId: string,
  roster: readonly RosterStudent[],
  rsvps: readonly RsvpRow[],
  recordedRows: readonly AttendanceRow[] | null,
): { checkedStudentIds: string[]; hoursOverrideByStudentId: Record<string, number> } {
  if (recordedRows === null) {
    return {
      checkedStudentIds: computeInitialAttendedStudentIds(sessionId, roster, rsvps),
      hoursOverrideByStudentId: {},
    };
  }
  const recordedRowByStudentId = buildRecordedRowsByStudentId(sessionId, recordedRows);
  const goingStudentIds = new Set(
    rsvps
      .filter((rsvp) => rsvp.sessionId === sessionId && rsvp.status === 'going')
      .map((rsvp) => rsvp.studentId),
  );
  const checkedStudentIds: string[] = [];
  const hoursOverrideByStudentId: Record<string, number> = {};
  for (const student of roster) {
    const recorded = recordedRowByStudentId[student.id];
    if (recorded !== undefined) {
      if (isAttendingStatus(recorded.status)) checkedStudentIds.push(student.id);
      if (recorded.hoursOverride !== null) {
        hoursOverrideByStudentId[student.id] = recorded.hoursOverride;
      }
    } else if (goingStudentIds.has(student.id)) {
      checkedStudentIds.push(student.id);
    }
  }
  return { checkedStudentIds, hoursOverrideByStudentId };
}

/** Module doc #2(b) -- a plain local SUM over the exact per-student hours
 * values this dialog is about to write (each one either an explicit
 * override, or the tier-3 default), never a query against
 * `v_student_hours`, never a cross-session aggregation. */
export function computeTotalHoursForCheckedStudents(
  checkedStudentIds: readonly string[],
  hoursOverrideByStudentId: Readonly<Record<string, number>>,
  defaultDurationHours: number,
): number {
  return checkedStudentIds.reduce(
    (sum, studentId) => sum + (hoursOverrideByStudentId[studentId] ?? defaultDurationHours),
    0,
  );
}

/** Rounds to one decimal place and trims a trailing ".0" -- "7 h" reads
 * better than "7.0 h" for the common whole-hour case, while a genuine
 * partial value (e.g. a 3.5h override) still renders precisely. */
export function formatHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

/** Module doc #4 -- THE ONE place the BEH-07 confirm button's label is
 * produced. Never a bare "Confirm"/"Submit"/"OK". */
export function computeMarkCompleteConfirmLabel(attendedCount: number, totalHours: number): string {
  return `Mark complete — ${attendedCount} attended · ${formatHours(totalHours)} h`;
}

/** Module doc #2/#5 -- one of now TWO places `attendance` rows are
 * constructed (T309 UPDATE: `buildAttendanceAbsenceRows`, module doc #10, is
 * the other -- this function itself stays byte-identical to before T309;
 * it constructs rows for CHECKED students only).
 * T305 UPDATE (module doc #9): gains a REQUIRED fifth parameter, the loaded
 * recorded rows keyed by student id -- required, not optional, so a call
 * site that forgets the recorded rows does not compile (T151/T179's own
 * mechanism). For a student with NO recorded row, this writes exactly what
 * it always did: `status: 'present'`, `method: 'coach'`, `checkInAt`/
 * `checkOutAt: null`, `hoursOverride` from the coach's own map or `null`.
 * For a student WITH a recorded row, real provenance (`status` when
 * attending, `checkInAt`/`checkOutAt`, `method` via
 * `resolveAttendanceWriteMethod`) is carried through; `hoursOverride`
 * prefers the coach's own edit over the recorded value; `recordedBy` is
 * always `recordedBy` (the acting coach), never the recorded row's own
 * value. */
export function buildAttendanceWriteRows(
  sessionId: string,
  checkedStudentIds: readonly string[],
  hoursOverrideByStudentId: Readonly<Record<string, number>>,
  recordedBy: string,
  recordedRowByStudentId: Readonly<Record<string, AttendanceRow>>,
): AttendanceWriteRow[] {
  return checkedStudentIds.map((studentId) => {
    const existing = recordedRowByStudentId[studentId];
    return {
      sessionId,
      studentId,
      status:
        existing !== undefined && isAttendingStatus(existing.status) ? existing.status : 'present',
      checkInAt: existing?.checkInAt ?? null,
      checkOutAt: existing?.checkOutAt ?? null,
      hoursOverride: hoursOverrideByStudentId[studentId] ?? existing?.hoursOverride ?? null,
      method: resolveAttendanceWriteMethod(existing?.method ?? null),
      recordedBy,
    };
  });
}

/** Module doc #10 -- the second (and only other) place `attendance` rows are
 * constructed. Writes `status: 'absent'` for a roster student who is
 * UNCHECKED but has a recorded attending row -- the coach's uncheck is no
 * longer a silent no-op. Iterates `roster`, NEVER
 * `Object.keys(recordedRowByStudentId)` (a recorded row for a student not on
 * this event's roster must never be demoted). `isAttendingStatus` is a
 * single guard -- it already returns `false` for `undefined`, so a separate
 * `existing === undefined` arm would be dead code. Only `status` changes:
 * `checkInAt`/`checkOutAt`/`hoursOverride`/`method` carry through verbatim
 * from the recorded row, never from the coach's live
 * `hoursOverrideByStudentId` map (those hours belong to a student the coach
 * has now said was not present). `recordedBy` is the ACTING coach, never
 * the recorded row's own `recordedBy` (same rule as
 * `buildAttendanceWriteRows` above). */
export function buildAttendanceAbsenceRows(
  sessionId: string,
  roster: readonly RosterStudent[],
  checkedStudentIds: readonly string[],
  recordedBy: string,
  recordedRowByStudentId: Readonly<Record<string, AttendanceRow>>,
): AttendanceWriteRow[] {
  const checked = new Set(checkedStudentIds);
  const rows: AttendanceWriteRow[] = [];
  for (const student of roster) {
    if (checked.has(student.id)) continue;
    const existing = recordedRowByStudentId[student.id];
    if (!isAttendingStatus(existing?.status)) continue;
    rows.push({
      sessionId,
      studentId: student.id,
      status: 'absent',
      checkInAt: existing.checkInAt,
      checkOutAt: existing.checkOutAt,
      hoursOverride: existing.hoursOverride,
      method: resolveAttendanceWriteMethod(existing.method),
      recordedBy,
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// NFR-09 date/time formatting -- timestamps stored UTC, displayed
// America/Chicago. Independently reimplemented here (not imported) --
// `OutreachDetail.tsx`/`RsvpControl.tsx` are not in this task's Allowed
// Files (module doc #1).
// ---------------------------------------------------------------------------

const CHICAGO_TIME_ZONE = 'America/Chicago';

const WEEKDAY_DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  weekday: 'short',
  month: 'short',
  day: 'numeric',
  timeZone: CHICAGO_TIME_ZONE,
});

const CLOCK_TIME_FORMATTER = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: CHICAGO_TIME_ZONE,
});

function parseDateOnly(isoDate: string): Date {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12)); // noon UTC avoids DST edge cases
}

export function formatSessionDateTime(session: MarkDayCompleteSession): string {
  const dateText = WEEKDAY_DATE_FORMATTER.format(parseDateOnly(session.sessionDate));
  const startText = CLOCK_TIME_FORMATTER.format(new Date(session.startsAt));
  const endText = CLOCK_TIME_FORMATTER.format(new Date(session.endsAt));
  return `${dateText} · ${startText}–${endText}`;
}

// ---------------------------------------------------------------------------
// Default injectable seam -- module doc #7.
// ---------------------------------------------------------------------------

export const defaultOnMarkComplete: OnMarkDayCompleteFn = async (payload) => {
  console.warn(
    '[MarkDayCompleteDialog] No Supabase client wired in yet (module doc #7) -- this stub only ' +
      'logs the event_sessions status flip + attendance inserts + events additive adult-volunteer ' +
      'update that would have been persisted.',
    payload,
  );
};

// ---------------------------------------------------------------------------
// Component.
// ---------------------------------------------------------------------------

export interface MarkDayCompleteDialogProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  /** Display context only, e.g. `events.title`. T179: required -- see module
   * doc #7's "T179 UPDATE" paragraph. */
  eventTitle: string;
  /** T179: required -- see module doc #7's "T179 UPDATE" paragraph. */
  session: MarkDayCompleteSession;
  /** The session's resolvable roster (module doc #1 -- already resolved by
   * the caller the same way `OutreachDetail.tsx`'s own `resolveEventRoster`
   * does; not re-derived here since that logic is a Forbidden File). T179:
   * required -- see module doc #7's "T179 UPDATE" paragraph. */
  roster: readonly RosterStudent[];
  /** Every `rsvps` row for this session (and, harmlessly, any others --
   * `computeInitialAttendedStudentIds` filters by `sessionId` itself). T179:
   * required -- see module doc #7's "T179 UPDATE" paragraph. */
  rsvps: readonly RsvpRow[];
  /** Injectable auth seam (module doc #7). T179: required, no longer
   * defaults to a placeholder `profiles.id` -- see module doc #7's "T179
   * UPDATE" paragraph. */
  currentUserProfileId: string;
  /** Injectable persistence seam (module doc #7). T101: defaults to a real
   * mutation (`markDayComplete`, `../../lib/supabase/loaders/outreach.ts`);
   * `defaultOnMarkComplete` (log-only) remains exported for callers/tests
   * that want to inject it explicitly. */
  onMarkComplete?: OnMarkDayCompleteFn;
  /** T305 (module doc #9) -- injectable load seam for this session's
   * recorded attendance, mirroring `AttendancePanelProps.loadAttendance`.
   * Defaults to the real `loadAttendanceForSessions`
   * (`../../lib/supabase/loaders/attendance.ts`). NOT the placeholder-
   * default family T151/T179 closed -- an omitted value still resolves to
   * the real query, not a fixture. */
  loadAttendance?: LoadAttendanceForSessionsFn;
}

export function MarkDayCompleteDialog({
  isOpen,
  onOpenChange,
  eventTitle,
  session,
  roster,
  rsvps,
  currentUserProfileId,
  onMarkComplete = markDayComplete,
  loadAttendance = loadAttendanceForSessions,
}: MarkDayCompleteDialogProps): ReactNode {
  // Module doc #5(ii) -- only a scheduled session can be (re-)completed from
  // this dialog.
  const isSessionEligible = session.status === 'scheduled';

  const [checkedStudentIds, setCheckedStudentIds] = useState<string[]>([]);
  const [peopleReached, setPeopleReached] = useState<number | null>(null);
  // Module doc #3 -- THIS SESSION'S OWN contribution, not the event's
  // running total; never fetched from `events`.
  const [adultVolunteersCount, setAdultVolunteersCount] = useState<number | null>(0);
  const [adultVolunteerHours, setAdultVolunteerHours] = useState<number | null>(0);
  const [hoursOverrideByStudentId, setHoursOverrideByStudentId] = useState<Record<string, number>>(
    {},
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // T305 (module doc #9) -- this session's loaded recorded attendance, or
  // `null` while in flight/on failure (the RSVP-only seed stands, §3).
  const [recordedRows, setRecordedRows] = useState<readonly AttendanceRow[] | null>(null);
  // T305 -- "unchecked everyone" and "did nothing yet" are both just an
  // array; this distinguishes them so a late-arriving load never clobbers a
  // coach's own edit (module doc #9).
  const hasCoachTouchedChecklistRef = useRef(false);
  // T305 -- updated every render (not in an effect) so a `.then()` callback
  // from a stale in-flight load can read the truly CURRENT `isOpen`/
  // `session.id`, not the value closed over when that load started (S8b).
  const latestIsOpenRef = useRef(isOpen);
  const latestSessionIdRef = useRef(session.id);
  latestIsOpenRef.current = isOpen;
  latestSessionIdRef.current = session.id;

  function resetForm(): void {
    setCheckedStudentIds(computeInitialAttendedStudentIds(session.id, roster, rsvps));
    setPeopleReached(session.peopleReached ?? null);
    setAdultVolunteersCount(0);
    setAdultVolunteerHours(0);
    setHoursOverrideByStudentId({});
    setSubmitError(null);
    setRecordedRows(null);
    hasCoachTouchedChecklistRef.current = false;
  }

  // Nothing persists across opens -- every fresh open re-derives the
  // checklist from the current `going` RSVPs (module doc #6), same
  // "reset-on-open-transition" pattern `ScheduleMeetingsDialog.tsx` already
  // established. T305: this is the RSVP-only seed; the effect below layers
  // the recorded-attendance seed on top once/if it loads (module doc #9).
  useEffect(() => {
    if (isOpen) resetForm();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset only on the isOpen transition.
  }, [isOpen, session.id]);

  // T305 (module doc #9) -- load this ONE session's recorded attendance.
  // Shape mirrors `useAttendanceLoadState` (`AttendancePanel.tsx`): `let
  // isMounted`, `.then`/`.catch`, cleanup sets `isMounted = false`; no
  // `retryToken`/three-state union needed here (§3 -- failure falls back
  // silently, it never surfaces a retry). Dependency array is deliberately
  // `[isOpen, session.id, loadAttendance]`, NOT including `roster`/`rsvps`:
  // those are unmemoized page-level arrays at the live call site
  // (`OutreachDetail.tsx:2183-2190`), so including them would re-fire this
  // load on every parent render.
  useEffect(() => {
    if (!isOpen) return undefined;
    let isMounted = true;
    const loadedSessionId = session.id;
    loadAttendance([loadedSessionId])
      .then((rows) => {
        if (!isMounted) return;
        setRecordedRows(rows);
        const seed = computeInitialFormSeed(loadedSessionId, roster, rsvps, rows);
        // Hours map: merge unconditionally, the coach's own edits win --
        // NOT gated by the touched-ref below (module doc #9; gating it
        // would reopen the exact label-vs-write divergence W6 closes).
        setHoursOverrideByStudentId((prev) => ({ ...seed.hoursOverrideByStudentId, ...prev }));
        // Checklist: only if still open, still the SAME session, and the
        // coach hasn't already touched it. This guard governs the
        // checklist only -- `recordedRows` above still drives §5's write
        // preservation whether or not this branch actually applies.
        //
        // DELIBERATELY REDUNDANT with the `if (!isMounted) return;` above,
        // and both must stay. T305's checker measured that deleting EITHER
        // one alone leaves the whole suite green (44/44) and only deleting
        // BOTH reddens the anti-clobber assertion -- so a future reader who
        // drops one will see green and may then drop the other. They cover
        // different windows: `isMounted` only wins the race here because
        // `act()` flushes passive effects synchronously in tests, whereas
        // under React 18's real async passive-effect scheduling the refs
        // below are updated during render while cleanup is still pending.
        // That window is exactly what the same-session check covers.
        if (
          latestIsOpenRef.current &&
          latestSessionIdRef.current === loadedSessionId &&
          !hasCoachTouchedChecklistRef.current
        ) {
          setCheckedStudentIds(seed.checkedStudentIds);
        }
      })
      .catch(() => {
        // Graceful (§3): `recordedRows` stays `null`, so the RSVP-only seed
        // `resetForm` already applied stands -- no error surface, no
        // blocked confirm, no spinner over the checklist.
      });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- roster/rsvps intentionally excluded, see comment above.
  }, [isOpen, session.id, loadAttendance]);

  const defaultDurationHours = useMemo(() => computeSessionDurationHours(session), [session]);

  const totalHours = useMemo(
    () =>
      computeTotalHoursForCheckedStudents(
        checkedStudentIds,
        hoursOverrideByStudentId,
        defaultDurationHours,
      ),
    [checkedStudentIds, hoursOverrideByStudentId, defaultDurationHours],
  );

  const confirmLabel = computeMarkCompleteConfirmLabel(checkedStudentIds.length, totalHours);

  const checkedStudents = useMemo(
    () => roster.filter((student) => checkedStudentIds.includes(student.id)),
    [roster, checkedStudentIds],
  );

  function handleClose(): void {
    resetForm();
    onOpenChange(false);
  }

  // T305 -- marks the touched-ref so a late-arriving recorded-attendance
  // load never clobbers the coach's own checklist edit (module doc #9).
  function handleCheckedStudentIdsChange(next: string[]): void {
    hasCoachTouchedChecklistRef.current = true;
    setCheckedStudentIds(next);
  }

  function setStudentHoursOverride(studentId: string, value: number): void {
    hasCoachTouchedChecklistRef.current = true;
    setHoursOverrideByStudentId((prev) => ({ ...prev, [studentId]: value }));
  }

  async function handleSubmit(): Promise<void> {
    if (!isSessionEligible || isSubmitting) return; // extra guard; button already natively disabled.
    setIsSubmitting(true);
    setSubmitError(null);
    // T309, module doc #10 -- hoisted so both write-path functions share the
    // exact same recorded-rows snapshot for this submit.
    const recordedRowByStudentId = buildRecordedRowsByStudentId(session.id, recordedRows ?? []);
    const payload: MarkDayCompletePayload = {
      sessionId: session.id,
      peopleReached,
      attendance: [
        ...buildAttendanceWriteRows(
          session.id,
          checkedStudentIds,
          hoursOverrideByStudentId,
          currentUserProfileId,
          recordedRowByStudentId,
        ),
        ...buildAttendanceAbsenceRows(
          session.id,
          roster,
          checkedStudentIds,
          currentUserProfileId,
          recordedRowByStudentId,
        ),
      ],
      adultVolunteersCountThisSession: adultVolunteersCount ?? 0,
      adultVolunteerHoursThisSession: adultVolunteerHours ?? 0,
      recordedBy: currentUserProfileId,
    };
    try {
      await onMarkComplete(payload);
      resetForm();
      onOpenChange(false);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Something went wrong marking this day complete.',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form">
      <Layout
        header={
          <DialogHeader
            title="Mark day complete"
            subtitle={`${eventTitle} · ${formatSessionDateTime(session)}`}
            onOpenChange={onOpenChange}
          />
        }
        content={
          <LayoutContent>
            {!isSessionEligible ? (
              // Module doc #5(ii) -- reveals nothing else: no checklist, no
              // hours inputs, no confirm action.
              <Banner
                status="info"
                title="This session can't be marked complete from here"
                description={`This session's status is "${session.status}" -- only a scheduled session can be marked complete this way. Once completed, attendance stays coach-editable through a separate audit-logged edit flow, not this dialog.`}
              />
            ) : (
              <FormLayout>
                {/* Field order per OUT-05's own wireframe (module doc, top
                    of file / constitution item 13): attendee checklist ->
                    people reached -> adult volunteers count + hours ->
                    per-student hours override. */}
                <CheckboxList
                  label="Attendee checklist"
                  value={checkedStudentIds}
                  onChange={handleCheckedStudentIdsChange}
                  hasDividers
                >
                  {roster.map((student) => (
                    <CheckboxListItem key={student.id} label={student.name} value={student.id} />
                  ))}
                </CheckboxList>

                <NumberInput
                  label="People reached"
                  value={peopleReached}
                  onChange={setPeopleReached}
                  min={0}
                  isIntegerOnly
                  hasClear
                  isOptional
                />

                <VStack gap={1}>
                  <HStack gap={2} wrap="wrap">
                    <NumberInput
                      label="Adult volunteers (this session)"
                      value={adultVolunteersCount}
                      onChange={setAdultVolunteersCount}
                      min={0}
                      isIntegerOnly
                    />
                    <NumberInput
                      label="Adult volunteer hours (this session)"
                      value={adultVolunteerHours}
                      onChange={setAdultVolunteerHours}
                      min={0}
                      step={0.25}
                      units="h"
                    />
                  </HStack>
                  {/* Module doc #3 -- the disclosed event-vs-session
                      resolution, stated to the coach, not just in code
                      comments. */}
                  <Text type="supporting" color="secondary">
                    These are added to the event&rsquo;s running adult-volunteer totals, not the
                    event&rsquo;s total itself -- each session you mark complete contributes its own
                    count and hours.
                  </Text>
                </VStack>

                {checkedStudents.length > 0 && (
                  <VStack gap={2}>
                    <Text type="supporting">
                      Hours per student (default {formatHours(defaultDurationHours)} h, for partial
                      attendance)
                    </Text>
                    {checkedStudents.map((student) => (
                      <NumberInput
                        key={student.id}
                        label={`${student.name} hours`}
                        value={hoursOverrideByStudentId[student.id] ?? defaultDurationHours}
                        onChange={(value) => setStudentHoursOverride(student.id, value)}
                        min={0}
                        step={0.25}
                        units="h"
                      />
                    ))}
                  </VStack>
                )}

                {submitError !== null && (
                  <Banner
                    status="error"
                    title="Couldn't mark this day complete"
                    description={submitError}
                  />
                )}
              </FormLayout>
            )}
          </LayoutContent>
        }
        footer={
          <LayoutFooter hasDivider>
            <HStack hAlign="end" gap={2}>
              {isSessionEligible ? (
                <>
                  <Button label="Cancel" variant="secondary" onClick={handleClose} />
                  <Button
                    label={confirmLabel}
                    variant="primary"
                    isDisabled={isSubmitting}
                    isLoading={isSubmitting}
                    clickAction={handleSubmit}
                  />
                </>
              ) : (
                <Button label="Close" variant="secondary" onClick={handleClose} />
              )}
            </HStack>
          </LayoutFooter>
        }
      />
    </Dialog>
  );
}

export default MarkDayCompleteDialog;
