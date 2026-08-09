/**
 * psql-backed SQL execution for the E2E harness.
 *
 * Deliberately shells out to `psql` rather than adding a Postgres client
 * package: constitution item 9 keeps the dependency allowlist closed, and
 * `supabase/tests/run.sh` / `tests/rls/run.sh` already established plain
 * psql as this repo's scratch-database access pattern.
 *
 * Every statement runs inside an explicit transaction that first does
 * `set local role` + `set local request.jwt.claim.*`, so the REAL row-level
 * security policies from `supabase/migrations/*.sql` decide what each
 * request can see and write. Nothing here re-implements or relaxes a policy.
 */
import { spawn } from 'node:child_process';

const PGHOST = process.env.SCRATCH_PG_HOST ?? '127.0.0.1';
const PGPORT = process.env.SCRATCH_PG_PORT ?? '55432';
const PGDB = process.env.SCRATCH_PG_DB ?? 'scratch';

export class PgError extends Error {
  constructor(code, message, detail, hint) {
    super(message);
    this.name = 'PgError';
    this.code = code;
    this.detail = detail ?? null;
    this.hint = hint ?? null;
  }
}

/** Quote a JS value as a SQL literal. `standard_conforming_strings` is on by
 * default, so doubling single quotes is sufficient — backslashes are literal. */
export function lit(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  // A JS array must become a Postgres ARRAY literal, not JSON: `events.team_ids`
  // is `uuid[]`, and `'["…"]'` fails with 22P02 "malformed array literal".
  if (Array.isArray(value)) {
    const elements = value
      .map((element) => {
        if (element === null || element === undefined) return 'NULL';
        const text = typeof element === 'string' ? element : JSON.stringify(element);
        return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
      })
      .join(',');
    const arrayLiteral = `{${elements}}`;
    return `'${arrayLiteral.replace(/'/g, "''")}'`;
  }
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return `'${text.replace(/'/g, "''")}'`;
}

/** Quote a SQL identifier. */
export function ident(name) {
  return `"${String(name).replace(/"/g, '""')}"`;
}

function parseError(stderr) {
  const match = /ERROR:\s+([0-9A-Za-z]{5}):\s+(.*)/.exec(stderr);
  if (match) {
    const detail = /DETAIL:\s+(.*)/.exec(stderr);
    const hint = /HINT:\s+(.*)/.exec(stderr);
    return new PgError(match[1], match[2].trim(), detail?.[1] ?? null, hint?.[1] ?? null);
  }
  const first = stderr.trim().split('\n')[0] ?? 'psql invocation failed';
  return new PgError('XX000', first, stderr.trim());
}

/** Run raw SQL, resolving with trimmed stdout. Rejects with a PgError. */
export function psql(sql) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      'psql',
      [
        '-h', PGHOST,
        '-p', PGPORT,
        '-U', 'postgres',
        '-d', PGDB,
        '-X', '-q', '-A', '-t',
        '-v', 'ON_ERROR_STOP=1',
        '-v', 'VERBOSITY=verbose',
        '-f', '-',
      ],
      { stdio: ['pipe', 'pipe', 'pipe'] },
    );
    let out = '';
    let err = '';
    child.stdout.on('data', (chunk) => {
      out += chunk;
    });
    child.stderr.on('data', (chunk) => {
      err += chunk;
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) reject(parseError(err));
      else resolve(out.trim());
    });
    child.stdin.end(sql);
  });
}

/** Run SQL whose final statement emits exactly one JSON text value. */
export async function psqlJson(sql) {
  const out = await psql(sql);
  if (!out) return null;
  return JSON.parse(out);
}

/**
 * Wrap a statement in a transaction carrying the caller's identity.
 *
 * `set local role` is what makes RLS apply at all: the harness connects as
 * the `postgres` superuser (which bypasses RLS), so without this every
 * policy would be silently inert and the whole persona exercise would prove
 * nothing.
 */
export function asRole({ role, sub, claims }, body) {
  const lines = ['begin;'];
  lines.push(`set local role ${role === 'authenticated' ? 'authenticated' : 'anon'};`);
  lines.push(`set local request.jwt.claim.role = ${lit(role)};`);
  if (sub) lines.push(`set local request.jwt.claim.sub = ${lit(sub)};`);
  lines.push(`set local request.jwt.claims = ${lit(JSON.stringify(claims ?? {}))};`);
  lines.push(body);
  lines.push('commit;');
  return lines.join('\n');
}

/** Run SQL as the superuser (harness bookkeeping only, never a request path). */
export function admin(sql) {
  return psql(sql);
}

export async function adminJson(sql) {
  return psqlJson(sql);
}
