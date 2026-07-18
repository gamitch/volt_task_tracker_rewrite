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
  | 'UNEXPECTED_STUDENT_ID';

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
