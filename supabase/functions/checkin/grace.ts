// T032: MTG-08 / OQ-3 auto present/late status computation.
//
// OQ-3 resolves the 10-minute grace period as a hardcoded constant (not
// user-configurable in v1) -- named here rather than inlined as a magic
// number.

export const LATE_GRACE_MIN = 10;

export type AttendanceAutoStatus = 'present' | 'late';

/**
 * `checkInAt` at or before `startsAt + LATE_GRACE_MIN` minutes -> 'present'.
 * Strictly after that boundary -> 'late'. The boundary is inclusive on the
 * 'present' side: exactly 10:00:00 after `startsAt` counts as present; one
 * second later is late.
 */
export function computeAutoStatus(startsAt: Date, checkInAt: Date): AttendanceAutoStatus {
  const deadlineMs = startsAt.getTime() + LATE_GRACE_MIN * 60_000;
  return checkInAt.getTime() <= deadlineMs ? 'present' : 'late';
}
