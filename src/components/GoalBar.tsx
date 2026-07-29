/**
 * T136 (VOLT UX Craft PRD v3.1, UXC-05 foundation / UXC-08) -- the one small
 * custom bar component F-3 pre-authorizes (`VOLT_UX_Craft_PRD_v3.md:66-70`):
 * "one small custom bar component -- track, one or two fills, optional
 * ticks -- approved under DES-21's final rung for UXC-05 and UXC-08 only.
 * Presentation only, no metric math, one shared module, contrast verified
 * in both themes." Astryx's own `ProgressBar` cannot segment (F-3: "One
 * scalar `value`, one fill div... its doc forbids stacked bars"), so this
 * is a plain two-`<div>` fill inside one track, not a second `ProgressBar`.
 *
 * Shared by both `OutreachList.tsx` role variants (coach + student/parent)
 * via `GoalProgressBar`, per that file's own `:1763` section header.
 *
 * BEH-02 (`VOLT_Portal_PRD.md:239`): confirmed hours plus "a visually
 * lighter second segment... never summed into one number." This component
 * NEVER adds `confirmedPct` and `plannedPct` -- each is an independently
 * -computed percentage supplied by the caller (`OutreachList.tsx`'s
 * `confirmedPercent`, called twice, once per segment). The only arithmetic
 * performed here is percentage-domain clamping of the two already-computed
 * percentages against the 0-100 track and against each other for overflow
 * (`width: min(plannedPct, 100 - confirmedPct)`), never hours arithmetic.
 *
 * Colour: `--color-data-categorical-green` (confirmed) / `-purple` (planned)
 * -- the two data-viz tokens `volt.ts` overrides (T136 same task). Track:
 * `var(--color-background-muted)`, scoped by the `astryx-progressbar` class
 * so it resolves via the existing `.astryx-progressbar { --color-background
 * -muted: var(--color-border-emphasized) }` remap already shipped in
 * `theme.css:496-498` (from `neutralTheme`, F-2's own sanctioned "astryx-*
 * class + data-* contract" CSS surface) -- the same solid, higher-contrast
 * value Astryx's real `ProgressBar` track uses, not the near-transparent
 * unscoped default.
 *
 * ARIA: `role="progressbar"` with a real accessible name via
 * `aria-labelledby` (caller passes the id of an existing heading -- see
 * `OutreachList.tsx`'s `GoalProgressBar`), `aria-valuenow`/`min`/`max` on
 * the 0-100 percentage domain (confirmed value only -- planned hours are
 * provisional, so they never contribute to the reported value, same rule
 * `OutreachList.tsx:96-99` already applies to milestone crossing), and an
 * explicit `aria-valuetext` naming the planned segment (present, so it is
 * announced INSTEAD of the numeric value -- a visible-but-unannounced
 * planned segment would be the real accessibility defect). Not focusable:
 * a status indicator, not a control, so no `tabIndex`.
 */
import type { ReactNode } from 'react';

export interface GoalBarProps {
  /** Percentage (0-100) of the goal reached by CONFIRMED hours only.
   * Caller supplies this pre-computed (e.g. `confirmedPercent(confirmedHours,
   * goalHours)`); this component clamps it into the 0-100 track but performs
   * no hours arithmetic of its own. */
  confirmedPct: number;
  /** Percentage (0-100) of the goal reached by PLANNED hours, computed
   * INDEPENDENTLY of `confirmedPct` (never `confirmedHours + plannedHours`
   * anywhere upstream or in this component -- BEH-02). Rendered as an
   * offset second segment continuing where the confirmed segment ends,
   * clamped so the two fills never exceed the track combined. */
  plannedPct: number;
  /** Pre-formatted, human-readable value text -- e.g. "9 of 52 hours
   * confirmed; 7 more planned". Built by the caller (`GoalProgressBar`),
   * which is where the hour figures live; this component never formats or
   * computes hour values, only percentages-to-widths. */
  valueText: string;
  /** `id` of the element that names this bar (an existing heading in the
   * caller) -- wired to `aria-labelledby` for a resolvable accessible name. */
  labelledBy: string;
}

/** Track height, in px -- a thin strip, matching Astryx's own `ProgressBar`
 * track proportions. */
const TRACK_HEIGHT = 8;

export function GoalBar({
  confirmedPct,
  plannedPct,
  valueText,
  labelledBy,
}: GoalBarProps): ReactNode {
  // Percentage-domain clamping only (Trap 1 / packet section 2): never
  // hours arithmetic. `confirmedWidth` is bounded to the 0-100 track;
  // `plannedWidth` is bounded so the two segments never exceed the track
  // combined (the overflow case, BEH-01 coach fixture: confirmed 9 + planned
  // 7 vs a shrunk 15h goal).
  const confirmedWidth = Math.min(100, Math.max(0, confirmedPct));
  const plannedWidth = Math.min(Math.max(0, plannedPct), 100 - confirmedWidth);

  return (
    <div
      role="progressbar"
      aria-labelledby={labelledBy}
      aria-valuenow={Math.round(confirmedWidth)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={valueText}
      className="astryx-progressbar"
      style={{
        position: 'relative',
        width: '100%',
        height: TRACK_HEIGHT,
        borderRadius: 'var(--radius-full)',
        backgroundColor: 'var(--color-background-muted)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          insetBlock: 0,
          left: '0%',
          width: `${confirmedWidth}%`,
          backgroundColor: 'var(--color-data-categorical-green)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          insetBlock: 0,
          left: `${confirmedWidth}%`,
          width: `${plannedWidth}%`,
          backgroundColor: 'var(--color-data-categorical-purple)',
        }}
      />
    </div>
  );
}
