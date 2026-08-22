/**
 * @file AttendanceChips.tsx
 * @position GAM-448. MTG-01g's tap-to-cycle attendance control
 *   (`docs/swarm/VOLT_Portal_PRD.md:368-384`), rendered per roster row inside
 *   `SessionRow.tsx`'s `completed`-session expander. **Purely presentational**
 *   -- it renders one real `<button>`, computes which cycle stop a tap (or
 *   `Shift`-tap) resolves to, and calls whichever injected callback that stop
 *   maps to. It never calls a Supabase seam directly (criterion 13: no
 *   query-builder table access, no upsert/update/insert/delete call and no
 *   client-getter of any kind anywhere in this file) and never names the
 *   attendance-`UPDATE` factory the original issue pointed at (§0e of this
 *   ticket's packet; criterion 14 -- not even in a comment, checked by this
 *   file's own sibling test) -- `SessionRow.tsx` owns the real write, this
 *   file only decides WHAT to ask for.
 *
 * -----------------------------------------------------------------------
 * 1. The cycle is FIVE stops, not four -- MTG-01g verbatim (`:382`): "Cycle
 *    order is Present -> Late -> Excused -> Absent -> (unset),
 *    `Shift`-activation reverses." `(unset)` is `status: null` here -- no
 *    attendance row exists for this student on this session. `FORWARD_CYCLE`
 *    below encodes exactly that circular order; `buildEffectiveCycle` removes
 *    `'excused'` when `canSetExcused` is `false` (MTG-12,
 *    `VOLT_Portal_PRD.md:383-384` -- a student-facing surface skips that
 *    stop, it does not lose the control, mirroring `LiveConsole.tsx:908`'s
 *    identically-defaulted `canSetExcused` prop and its `:1073`
 *    defence-in-depth no-op). A tap with no `Shift` key walks the cycle
 *    forward (`direction: 1`); a `Shift`-tap walks it backward
 *    (`direction: -1`) -- read straight off the native `MouseEvent.shiftKey`
 *    the click handler already receives, so no separate key handler is
 *    needed for the reverse direction (constitution item 15 -- forward-only
 *    traversal with no reverse is a keyboard-path failure, and item 15 makes
 *    that a BLOCKER; reversing IS reachable from a keyboard, since a native
 *    `<button>` fires a synthetic click with `shiftKey` set for
 *    `Shift+Enter`/`Shift+Space` activation).
 *
 * -----------------------------------------------------------------------
 * 2. `(unset)` is a real stop, not a confirm-guarded edge case (packet §2).
 *
 *    Reaching `(unset)` calls the injected `onUnset` (which `SessionRow.tsx`
 *    wires to `makeRemoveAttendance`, `../../../lib/supabase/loaders/
 *    attendance.ts:544-562`) with **no confirm dialog**. DES-11's confirm set
 *    (`VOLT_Portal_PRD.md:219`) does not name an attendance un-mark, T119 /
 *    PRD v2 D-7 already ruled the un-mark an unconditional DELETE for every
 *    write method, and a confirm inside this loop would make criterion 3's
 *    full-cycle walk untestable. The `aria-live` region below announces the
 *    un-mark the same way it announces every other stop -- no special case.
 *
 *    **⚠ Disclosed asymmetry (packet §2, required disclosure):**
 *    `makeRemoveAttendance` deletes the ENTIRE `attendance` row, which
 *    carries `check_in_at`, `check_out_at`, `hours_override`, `method` and
 *    `recorded_by` (`attendance.ts:247,255-267`) -- so the fifth tap in this
 *    cycle discards a QR check-in timestamp and a coach-set hours override,
 *    the exact values `makeSetAttendanceStatus` (`attendance.ts:506-528`)
 *    goes out of its way to preserve on every OTHER stop. That asymmetry is
 *    real, undocumented anywhere else, and NOT a reason to invent a confirm
 *    here (nothing calls this component in the real app yet -- GAM-448
 *    packet §0a); it is filed as a follow-up instead (packet §6).
 *
 * -----------------------------------------------------------------------
 * 3. DES-17 direct-set keys `1`-`4` live on the ROW, not here (packet §2,
 *    settled in round 2 of this ticket's premise gate against
 *    `LiveConsole.tsx:937,940-941,1144-1164`'s own shipped roving-tabindex
 *    shape -- its module doc at `:161-186` records why the key handler sits
 *    on the roster `<li>`/row rather than the row's own interactive
 *    descendant: bubbling means a `1`-`4` press still lands "regardless of
 *    whether DOM focus is on the row or has drifted onto a descendant").
 *    `SessionRow.tsx` owns `focusedRowIndex`/`rowRefs`/the row `onKeyDown`
 *    and calls the SAME guarded write path this component's own click
 *    handler calls -- this file adds no `onKeyDown` of its own anywhere.
 *
 * -----------------------------------------------------------------------
 * 4. The four MTG-01g a11y rules, all real here:
 *      1. A real `<button>` -- a bare **native** `<button type="button">`,
 *         not an Astryx `Button`. Astryx's own `BaseProps`
 *         (`node_modules/@astryxdesign/core/dist/BaseProps.d.ts`, read
 *         directly) documents itself as deliberately OMITTING `title`
 *         ("Omits: title, contentEditable, and obscure/non-standard HTML
 *         attributes"), so `ButtonProps` (which extends it) has no typed
 *         `title` -- and rule 4 below needs a real `title` attribute to
 *         carry the disabled explanation while still leaving the native
 *         `disabled` DOM property genuinely `true` (this repo's own test
 *         convention reads `button.disabled` directly, e.g.
 *         `CoachMeetingsView.test.tsx:1018-1079`; Astryx `Button` only keeps
 *         `disabled` native when NO `tooltip` is set alongside `isDisabled`
 *         -- `Button.js`'s own `useAriaDisabled = tooltip != null &&
 *         buttonDisabled` switches to `aria-disabled` instead, specifically
 *         so a tooltip'd disabled button stays focusable, which is the
 *         opposite of what this control needs). A native element sidesteps
 *         both constraints with no Astryx-prop hallucination risk at all
 *         (item 2 is about ASTRYX component props; this is plain HTML).
 *      2. Accessible name = student name + current status ("Ada L.,
 *         present") -- a real `aria-label` set directly.
 *      3. Announced via `aria-live` -- a `VisuallyHidden as="div"
 *         role="status"` sibling (the same pass-through-`aria-*`,
 *         `role="status"` idiom `CoachMeetingsView.tsx:1540` and
 *         `SeriesCard.tsx`'s own module doc item 2 already establish) whose
 *         text content is the same `"${studentName}, ${statusWord}"` string
 *         -- so every re-render with a new `status` prop changes this
 *         node's text, which is what drives the live-region announcement (a
 *         static `aria-live` node that never mutates announces nothing).
 *      4. Target >=44px -- a plain inline `style` on the native `<button>`
 *         (`MIN_TOUCH_TARGET_STYLE` below), the same VALUE
 *         `OutreachList.tsx`'s own `MIN_TOUCH_TARGET_STYLE` precedent uses
 *         (`{ minHeight: '44px' }`, that file's own module doc has the full
 *         D004 record for why `style` is authorized on an Astryx `Button`
 *         there) -- widened here to both dimensions (`minWidth` too), since
 *         a chip's own visible content (a single `Badge`) can be narrower
 *         than 44px where a full-width table-row button's cannot. This is
 *         plain React inline style on a NATIVE element, not a DES-21
 *         escalation at all (DES-21 governs styling an ASTRYX component;
 *         there is no Astryx component here to escalate past).
 *
 * -----------------------------------------------------------------------
 * 5. DES-05 colors via Astryx semantic `Badge` variants only
 *    (`docs/swarm/VOLT_Portal_PRD.md:210`, `meetings-design` skill's
 *    "Status colors" section): present=`success`, late=`warning`,
 *    excused=`neutral`, absent=`error`. The colored `Badge`
 *    (`astryx-api.md:493-538` Props table: `variant`, `label`) is the
 *    button's only visible content -- so the color-coded indicator lives
 *    inside a real, focusable, named native control rather than as a bare
 *    clickable `Badge` on its own (which `astryx-api.md:524` explicitly
 *    says not to do).
 */
import { type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { Badge, VisuallyHidden } from '@astryxdesign/core';
import type { AttendanceStatus } from '../../../lib/supabase/loaders/attendance';

/** Module doc item 1 -- the ONE circular cycle definition. `null` is the
 * "(unset)" stop. */
const FORWARD_CYCLE: readonly (AttendanceStatus | null)[] = [
  'present',
  'late',
  'excused',
  'absent',
  null,
];

/** MTG-12 gating (module doc item 1) -- removes the `'excused'` stop from the
 * cycle entirely when `canSetExcused` is `false`, rather than skipping over
 * it at click time; this keeps `computeNextStop` below a single, uniform
 * index walk with no special-cased stop. */
function buildEffectiveCycle(canSetExcused: boolean): readonly (AttendanceStatus | null)[] {
  return canSetExcused ? FORWARD_CYCLE : FORWARD_CYCLE.filter((stop) => stop !== 'excused');
}

/** Walks `cycle` one step from `current` in `direction` (`1` = forward /
 * `Present -> Late -> ... -> (unset) -> Present`, `-1` = `Shift`-reverse).
 * `current` not present in `cycle` (e.g. a stale `'excused'` read while
 * `canSetExcused` is `false`) is treated as the "(unset)" stop -- the same
 * defensive fallback `Array.prototype.indexOf`'s `-1` already forces onto the
 * cycle's own last slot, so the very next tap lands on `Present`, never on
 * the gated stop. */
function computeNextStop(
  cycle: readonly (AttendanceStatus | null)[],
  current: AttendanceStatus | null,
  direction: 1 | -1,
): AttendanceStatus | null {
  const currentIndex = cycle.indexOf(current);
  const baseIndex = currentIndex === -1 ? cycle.length - 1 : currentIndex;
  const nextIndex = (baseIndex + direction + cycle.length) % cycle.length;
  return cycle[nextIndex];
}

const STATUS_WORD: Record<AttendanceStatus, string> = {
  present: 'present',
  late: 'late',
  excused: 'excused',
  absent: 'absent',
};

const STATUS_BADGE_LABEL: Record<AttendanceStatus, string> = {
  present: 'Present',
  late: 'Late',
  excused: 'Excused',
  absent: 'Absent',
};

/** Module doc item 5 -- DES-05's literal mapping, Astryx semantic variants
 * only. */
const STATUS_BADGE_VARIANT: Record<AttendanceStatus, 'success' | 'warning' | 'neutral' | 'error'> =
  {
    present: 'success',
    late: 'warning',
    excused: 'neutral',
    absent: 'error',
  };

const NOT_RECORDED_WORD = 'not recorded';
const NOT_RECORDED_BADGE_LABEL = 'Not recorded';

function statusWord(status: AttendanceStatus | null): string {
  return status === null ? NOT_RECORDED_WORD : STATUS_WORD[status];
}

/** Module doc item 4, rule 4 -- `OutreachList.tsx`'s own
 * `MIN_TOUCH_TARGET_STYLE` precedent, widened to both dimensions. */
const MIN_TOUCH_TARGET_STYLE: CSSProperties = { minHeight: '44px', minWidth: '44px' };

/** Props for {@link AttendanceChips}. */
export interface AttendanceChipsProps {
  /** Already first-name + last-initial shortened by the caller (item 6) --
   * this component never re-derives it from a full name. */
  studentName: string;
  /** `null` = the "(unset)" stop -- no attendance row exists yet. */
  status: AttendanceStatus | null;
  /** MTG-12 -- defaults to `false` (module doc item 1). */
  canSetExcused?: boolean;
  /** Renders a disabled `<button>` with `disabledTitle` as its real `title`
   * attribute and emits no write -- the caller (`SessionRow.tsx`) sets this
   * when no `recordedBy` identity is available (criterion 10). */
  isDisabled?: boolean;
  disabledTitle?: string;
  /** Called with the resolved next status for every stop EXCEPT
   * "(unset)". */
  onSetStatus: (status: AttendanceStatus) => void;
  /** Called instead of `onSetStatus` when the cycle resolves to
   * "(unset)". */
  onUnset: () => void;
}

export function AttendanceChips({
  studentName,
  status,
  canSetExcused = false,
  isDisabled = false,
  disabledTitle,
  onSetStatus,
  onUnset,
}: AttendanceChipsProps): ReactNode {
  function handleActivate(event: MouseEvent<HTMLButtonElement>): void {
    const cycle = buildEffectiveCycle(canSetExcused);
    const direction: 1 | -1 = event.shiftKey ? -1 : 1;
    const next = computeNextStop(cycle, status, direction);
    if (next === null) {
      onUnset();
    } else {
      onSetStatus(next);
    }
  }

  const accessibleName = `${studentName}, ${statusWord(status)}`;
  const badgeVariant = status === null ? 'neutral' : STATUS_BADGE_VARIANT[status];
  const badgeLabel = status === null ? NOT_RECORDED_BADGE_LABEL : STATUS_BADGE_LABEL[status];

  return (
    <>
      <button
        type="button"
        onClick={handleActivate}
        disabled={isDisabled}
        title={isDisabled ? disabledTitle : undefined}
        aria-label={accessibleName}
        style={MIN_TOUCH_TARGET_STYLE}
      >
        <Badge variant={badgeVariant} label={badgeLabel} />
      </button>
      {/* Module doc item 4, rule 3 -- the announcement region. Its text
          content is derived purely from `status`/`studentName` props, so a
          re-render with a new `status` (optimistic update, rollback, or the
          "(unset)" stop) changes this node's text and drives the
          announcement; nothing here mutates its own state. */}
      <VisuallyHidden as="div" role="status">
        {accessibleName}
      </VisuallyHidden>
    </>
  );
}
