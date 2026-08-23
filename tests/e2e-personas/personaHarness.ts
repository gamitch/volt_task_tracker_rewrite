/**
 * Shared helpers for the persona end-to-end suite.
 *
 * These specs drive the REAL production bundle in a REAL browser against a
 * REAL PostgreSQL cluster carrying this repo's REAL migrations, through the
 * Supabase-compatible server in `tests/e2e-harness/server.mjs`. Nothing in
 * `src/` is stubbed or aware the suite exists.
 *
 * Start the backing services first:
 *   bash tests/e2e-harness/start.sh
 *   npx playwright test -c tests/e2e-harness/playwright.personas.config.ts
 *
 * Two rules this file exists to enforce:
 *
 * 1. Assert POST-WRITE ROW STATE, never the request the app issued. `readRows`
 *    goes straight to Postgres as the superuser, so a UI assertion and a
 *    database assertion are genuinely independent witnesses.
 * 2. Read back through a PERSONA where visibility is the point. A superuser
 *    read bypasses RLS entirely, so it can never show that a policy denied
 *    anything — `readRowsAs` sets the role and JWT claim the way a real
 *    request does.
 */
import { execFileSync } from 'node:child_process';
import { expect, type Page } from 'playwright/test';

/** Matches `tests/e2e-harness/start.sh`'s cluster. */
const PG_PORT = '55432';
const PG_DB = 'scratch';

export const PERSONA_PASSWORD = 'VoltTest!2026';

export interface Persona {
  readonly email: string;
  readonly displayName: string;
  /** `role_enum` value on the persona's `profiles` row. */
  readonly role: 'admin' | 'coach' | 'student' | 'parent';
  /** `profiles.id` / `auth.users.id`, fixed by `tests/e2e-harness/seed.sql`. */
  readonly profileId: string;
}

export const PERSONAS = {
  admin: {
    email: 'admin@volt.test',
    displayName: 'Marcus Webb',
    role: 'admin',
    profileId: 'a0000000-0000-4000-8000-000000000001',
  },
  coach: {
    email: 'coach@volt.test',
    displayName: 'Dana Reyes',
    role: 'coach',
    profileId: 'a0000000-0000-4000-8000-000000000002',
  },
  student: {
    email: 'student@volt.test',
    displayName: 'Priya Raman',
    role: 'student',
    profileId: 'a0000000-0000-4000-8000-000000000003',
  },
  parent: {
    email: 'parent@volt.test',
    displayName: 'Alex Raman',
    role: 'parent',
    profileId: 'a0000000-0000-4000-8000-000000000004',
  },
} as const satisfies Record<string, Persona>;

export type PersonaKey = keyof typeof PERSONAS;

/** Fixed seed ids the specs reference by name rather than by magic string. */
export const SEED = {
  teamFrc: '7ea11000-0000-4000-8000-000000000001',
  teamFtc: '7ea11000-0000-4000-8000-000000000002',
  teamArchived: '7ea11000-0000-4000-8000-000000000003',
  activeSeason: '50000000-0000-4000-8000-000000000001',
  meetingEvent: 'e0e00000-0000-4000-8000-000000000001',
  liveSession: '5e550000-0000-4000-8000-000000000004',
  studentPriya: '57000000-0000-4000-8000-000000000001',
  studentNina: '57000000-0000-4000-8000-000000000004',
  studentJordan: '57000000-0000-4000-8000-000000000002',
} as const;

function psql(sqlText: string): string {
  return execFileSync(
    'psql',
    // VERBOSITY=verbose puts the SQLSTATE in the error text, so an RLS denial
    // can be asserted as 42501 rather than by matching English prose.
    [
      '-h',
      '127.0.0.1',
      '-p',
      PG_PORT,
      '-U',
      'postgres',
      '-d',
      PG_DB,
      '-X',
      '-q',
      '-A',
      '-t',
      '-v',
      'ON_ERROR_STOP=1',
      '-v',
      'VERBOSITY=verbose',
      '-c',
      sqlText,
    ],
    { encoding: 'utf8' },
  ).trim();
}

/**
 * Run a SELECT as the superuser and return its rows. Bypasses RLS by design —
 * use it to check what actually landed in the table, not what a persona can see.
 */
export function readRows<T = Record<string, unknown>>(selectStatement: string): T[] {
  return JSON.parse(
    psql(`select coalesce(json_agg(t), '[]'::json)::text from (${selectStatement}) t`) || '[]',
  );
}

/**
 * Run a SELECT the way a request from `persona` would run it: as the
 * `authenticated` role with that persona's `auth.uid()`. This is the only
 * form that can demonstrate an RLS policy actually filtering something.
 */
export function readRowsAs<T = Record<string, unknown>>(
  persona: PersonaKey,
  selectStatement: string,
): T[] {
  const uid = PERSONAS[persona].profileId;
  const out = psql(
    [
      'begin',
      'set local role authenticated',
      `set local request.jwt.claim.sub = '${uid}'`,
      `set local request.jwt.claim.role = 'authenticated'`,
      `select coalesce(json_agg(t), '[]'::json)::text from (${selectStatement}) t`,
      'commit',
    ].join(';\n'),
  );
  return JSON.parse(out || '[]');
}

/** Run a statement as the superuser. Harness bookkeeping, never an assertion. */
export function execAdmin(statement: string): void {
  psql(statement);
}

/**
 * Run a statement as `persona` at the top level of the transaction, and return
 * nothing. Needed for writes: a data-modifying CTE is only legal at the top
 * level, so it cannot go through `readRowsAs`'s `json_agg` wrapper.
 *
 * Throws when Postgres rejects the statement — which is the point for an
 * INSERT blocked by RLS, since that raises 42501 rather than writing 0 rows.
 */
export function execAs(persona: PersonaKey, statement: string): void {
  const uid = PERSONAS[persona].profileId;
  psql(
    [
      'begin',
      'set local role authenticated',
      `set local request.jwt.claim.sub = '${uid}'`,
      `set local request.jwt.claim.role = 'authenticated'`,
      statement,
      'commit',
    ].join(';\n'),
  );
}

/** Sign in through the real login form and wait for the role dispatcher. */
export async function signIn(page: Page, persona: PersonaKey): Promise<void> {
  await page.goto('/login');
  await page.locator('input[name="email"]').fill(PERSONAS[persona].email);
  await page.locator('input[name="password"]').fill(PERSONA_PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect.poll(() => new URL(page.url()).pathname, { timeout: 20_000 }).not.toBe('/login');
}

/**
 * Screenshot into `tests/e2e-personas/screenshots/`, and attach the same image
 * to the Playwright report so a failure carries its own evidence.
 */
export async function capture(page: Page, name: string): Promise<void> {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `tests/e2e-personas/screenshots/${name}.png`, fullPage: true });
}

/** The nav destinations a persona is offered in the side navigation. */
export async function visibleNavLinks(page: Page): Promise<string[]> {
  const nav = page.getByRole('navigation', { name: 'Side navigation' });
  await nav.waitFor();
  return (await nav.getByRole('link').allInnerTexts()).map((text) => text.split('\n')[0].trim());
}
