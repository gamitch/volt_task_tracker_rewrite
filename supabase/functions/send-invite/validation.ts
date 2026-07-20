// T017: pure request-validation logic for the `send-invite` Edge Function,
// extracted from index.ts so it can be exercised with `deno test` without a
// live Supabase project, Postgres, or network access (see the T017 worker
// packet's "External Blocker" section).
//
// `role_enum` is copied verbatim from
// supabase/migrations/20260716000000_identity_roster.sql:
//   create type role_enum as enum ('admin', 'coach', 'student', 'parent');
// Do not add/remove values here without a matching migration change.

export const ROLE_VALUES = ['admin', 'coach', 'student', 'parent'] as const;
export type InviteRole = (typeof ROLE_VALUES)[number];

export function isValidRole(value: unknown): value is InviteRole {
  return typeof value === 'string' && (ROLE_VALUES as readonly string[]).includes(value);
}

// Deliberately simple (not RFC 5322-complete): good enough to reject obvious
// typos before hitting Supabase Auth, which does its own real validation.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(value: unknown): value is string {
  return typeof value === 'string' && EMAIL_RE.test(value.trim());
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

export interface InviteRequestBody {
  email: string;
  role: InviteRole;
  /** Null for admin/coach invites; required for student/parent invites. */
  student_id: string | null;
}

export type InviteValidationErrorCode =
  | 'INVALID_BODY'
  | 'MISSING_EMAIL'
  | 'INVALID_EMAIL'
  | 'MISSING_ROLE'
  | 'INVALID_ROLE'
  | 'MISSING_STUDENT_ID'
  | 'INVALID_STUDENT_ID'
  | 'UNEXPECTED_STUDENT_ID'
  // T090 -- ED-1 Packet P3 resend branch (see this file's bottom section for
  // the resend-specific validation/eligibility functions that use these).
  | 'INVALID_INVITE_ID'
  | 'INVITE_NOT_FOUND'
  | 'INVITE_NOT_PENDING';

export interface InviteValidationError {
  code: InviteValidationErrorCode;
  /** DES-16 style: what happened + what to do. No apologies. */
  message: string;
}

export type InviteValidationResult =
  | { ok: true; value: InviteRequestBody }
  | { ok: false; error: InviteValidationError };

/**
 * Validates a parsed JSON request body against the `role_enum` vocabulary and
 * the student-linkage rules in the `invites` table (T010):
 *   - admin/coach invites: `student_id` must be absent/null.
 *   - student/parent invites: `student_id` is required and must look like a uuid.
 * Does not check that the referenced student actually exists -- that requires
 * a DB round-trip and is done separately in index.ts with the service-role
 * client, once the caller's staff role has already been confirmed.
 */
export function validateInviteRequest(body: unknown): InviteValidationResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return {
      ok: false,
      error: {
        code: 'INVALID_BODY',
        message: 'Send a JSON body with email, role, and student_id (if applicable).',
      },
    };
  }

  const raw = body as Record<string, unknown>;

  const emailPresent = raw.email !== undefined && raw.email !== null && raw.email !== '';
  if (!emailPresent) {
    return {
      ok: false,
      error: { code: 'MISSING_EMAIL', message: "Email is required. Enter the recipient's email address and try again." },
    };
  }
  if (!isValidEmail(raw.email)) {
    return {
      ok: false,
      error: { code: 'INVALID_EMAIL', message: 'That email address looks invalid. Check the spelling and try again.' },
    };
  }

  const rolePresent = raw.role !== undefined && raw.role !== null && raw.role !== '';
  if (!rolePresent) {
    return {
      ok: false,
      error: { code: 'MISSING_ROLE', message: 'Role is required. Choose admin, coach, student, or parent.' },
    };
  }
  if (!isValidRole(raw.role)) {
    return {
      ok: false,
      error: { code: 'INVALID_ROLE', message: 'That role is not recognized. Choose admin, coach, student, or parent.' },
    };
  }

  const role = raw.role;
  const studentIdRaw = raw.student_id;
  const hasStudentId = studentIdRaw !== undefined && studentIdRaw !== null && studentIdRaw !== '';

  if (role === 'student' || role === 'parent') {
    if (!hasStudentId) {
      return {
        ok: false,
        error: {
          code: 'MISSING_STUDENT_ID',
          message: `A linked student is required to invite a ${role}. Pick a student and try again.`,
        },
      };
    }
    if (!isValidUuid(studentIdRaw)) {
      return {
        ok: false,
        error: { code: 'INVALID_STUDENT_ID', message: 'That student could not be found. Refresh the roster and try again.' },
      };
    }
  } else if (hasStudentId) {
    return {
      ok: false,
      error: {
        code: 'UNEXPECTED_STUDENT_ID',
        message: `${role === 'admin' ? 'Admin' : 'Coach'} invites are not linked to a student. Remove the student selection and try again.`,
      },
    };
  }

  return {
    ok: true,
    value: {
      email: (raw.email as string).trim(),
      role,
      student_id: hasStudentId ? (studentIdRaw as string) : null,
    },
  };
}

/** AUTH-06: invites expire 14 days after creation. */
export const INVITE_EXPIRY_DAYS = 14;

export function computeExpiresAt(now: Date = new Date()): string {
  const expires = new Date(now.getTime() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
  return expires.toISOString();
}

// ---------------------------------------------------------------------------
// T090 -- ED-1 Packet P3: resend branch. `send-invite`'s only prior path
// (`auth.admin.inviteUserByEmail`, above) creates the `auth.users` row
// immediately, so calling it again for the same email always 409s -- this
// section adds the request-validation and pure eligibility-decision logic
// for a genuinely separate resend path (`index.ts` owns the actual
// DB-lookup/`generateLink`/branded-email orchestration; kept out of this
// file, same "pure logic vs. I/O" split this file's own header comment
// already established for the send path).
//
// HOW A CALLER SIGNALS "THIS IS A RESEND": the existing `InviteRequestBody`
// shape (`{email, role, student_id}`) is left completely untouched above --
// no `invite_id` field was added to it, and `validateInviteRequest`'s own
// return value/behavior for the send path is unchanged (verified by every
// pre-existing test in validation.test.ts still passing unmodified,
// including the two `toEqual`-exact-shape tests for `.value` on a
// successful send). Instead, `index.ts` calls `isResendRequestBody(body)`
// FIRST, right after parsing the JSON body: a request body carrying any
// truthy `invite_id` field takes the resend branch (this function only,
// below); everything else (including a body with no `invite_id` at all,
// or malformed non-object bodies) falls through unchanged to the existing
// `validateInviteRequest` call. This keeps the two request shapes/paths
// fully disjoint rather than folding `invite_id` into `InviteRequestBody`
// as an optional field, which would have forced every existing "exact
// object shape" assertion in validation.test.ts to grow an always-`undefined`
// key for no reason.
// ---------------------------------------------------------------------------

export interface ResendInviteRequestBody {
  invite_id: string;
}

export interface ResendInviteValidationError {
  code: InviteValidationErrorCode;
  /** DES-16 style: what happened + what to do. No apologies. */
  message: string;
}

export type ResendInviteValidationResult =
  | { ok: true; value: ResendInviteRequestBody }
  | { ok: false; error: ResendInviteValidationError };

/**
 * Cheap, pure "is this a resend request" detector -- `index.ts`'s own
 * branch point. Deliberately permissive about the invite_id's *shape* here
 * (only checks presence/non-emptiness) -- `validateResendInviteRequest`
 * below is what actually rejects a malformed value, with a real
 * `INVALID_INVITE_ID` error, once the caller is already committed to the
 * resend branch. This mirrors `validateInviteRequest`'s own
 * presence-then-shape two-step for `email`/`role` above.
 */
export function isResendRequestBody(body: unknown): body is Record<string, unknown> {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return false;
  const raw = body as Record<string, unknown>;
  return raw.invite_id !== undefined && raw.invite_id !== null && raw.invite_id !== '';
}

/**
 * Validates a parsed JSON request body for the resend branch: only
 * `invite_id` is required, and it must look like a uuid (this file has no
 * way to confirm a matching row actually exists -- that is `index.ts`'s
 * service-role DB lookup, exactly the same "shape-only here, existence
 * checked separately with the admin client" split `validateInviteRequest`
 * already uses for `student_id` above).
 */
export function validateResendInviteRequest(body: unknown): ResendInviteValidationResult {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return {
      ok: false,
      error: { code: 'INVALID_BODY', message: 'Send a JSON body with invite_id.' },
    };
  }

  const raw = body as Record<string, unknown>;
  if (!isValidUuid(raw.invite_id)) {
    return {
      ok: false,
      error: {
        code: 'INVALID_INVITE_ID',
        message: 'That invite could not be found. Refresh the invites list and try again.',
      },
    };
  }

  return { ok: true, value: { invite_id: raw.invite_id as string } };
}

/** The only field `evaluateResendEligibility` needs off a fetched `invites`
 * row -- kept minimal/structural (not the full DB row shape) so this stays
 * testable without importing supabase-js, same DI posture `email_log.ts`'s
 * `EmailLogWriter` already established for the analogous problem. */
export interface ResendEligibilityInput {
  status: string;
}

export type ResendEligibilityResult =
  | { ok: true }
  | { ok: false; error: ResendInviteValidationError };

/**
 * Pure decision: given the fetched `invites` row for the requested
 * `invite_id` (or `null` if no row was found), decides whether a resend is
 * allowed. `index.ts` is the only caller -- it does the actual
 * `adminClient` lookup, then hands the result (or `null`) here so this
 * decision itself stays unit-testable with `deno test` and no live
 * Supabase project, same reasoning as every other function in this file.
 *
 * Only stored `status === 'pending'` is resendable (AUTH-06/this task's own
 * packet, Known Context/Traps #2) -- 'accepted'/'revoked'/'expired' each get
 * their own DES-16 copy explaining why, per status, rather than one generic
 * "invalid" message:
 *   - not found at all -> `INVITE_NOT_FOUND` (404-class).
 *   - `'expired'` -> distinct copy steering the caller to send a *new*
 *     invite instead (this task's packet explicitly calls this out).
 *   - `'accepted'` -> the invitee already has an account; nothing to resend.
 *   - `'revoked'` -> a deliberately-canceled invite; resending would
 *     silently un-cancel it through the back door.
 */
export function evaluateResendEligibility(invite: ResendEligibilityInput | null): ResendEligibilityResult {
  if (!invite) {
    return {
      ok: false,
      error: {
        code: 'INVITE_NOT_FOUND',
        message: 'That invite could not be found. Refresh the invites list and try again.',
      },
    };
  }

  if (invite.status === 'pending') {
    return { ok: true };
  }

  if (invite.status === 'expired') {
    return {
      ok: false,
      error: {
        code: 'INVITE_NOT_PENDING',
        message: 'This invite has already expired and can no longer be resent. Send a new invite instead.',
      },
    };
  }

  if (invite.status === 'accepted') {
    return {
      ok: false,
      error: {
        code: 'INVITE_NOT_PENDING',
        message: 'This invite has already been accepted. There is nothing left to resend.',
      },
    };
  }

  if (invite.status === 'revoked') {
    return {
      ok: false,
      error: {
        code: 'INVITE_NOT_PENDING',
        message: 'This invite was revoked and cannot be resent. Send a new invite instead.',
      },
    };
  }

  // Defensive fallback -- `invites.status`'s real check constraint only
  // allows the four values handled above (verified against
  // supabase/migrations/20260717000000_scheduling_attendance.sql line 24),
  // so this should be unreachable against a real database row.
  return {
    ok: false,
    error: { code: 'INVITE_NOT_PENDING', message: 'This invite cannot be resent right now.' },
  };
}
