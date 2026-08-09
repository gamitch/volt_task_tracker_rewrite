/**
 * A local, Supabase-compatible API server for end-to-end persona testing.
 *
 * WHY THIS EXISTS
 * ---------------
 * This sandbox has no Supabase project and no Docker daemon, so `supabase
 * start` is not available. Without a backend, `getSupabaseClient()` throws
 * `SupabaseNotConfiguredError` and every protected route bounces to /login —
 * which is exactly the ceiling `playwright.config.ts` documents for the
 * existing `tests/e2e/**` routing suite.
 *
 * This server removes that ceiling. It speaks the GoTrue and PostgREST wire
 * protocols that `@supabase/supabase-js` already emits, and executes each
 * request against a REAL PostgreSQL cluster carrying this repo's REAL
 * `supabase/migrations/*.sql` — same tables, same constraints, same triggers,
 * same views, same RLS policies.
 *
 * WHAT IS REAL AND WHAT IS NOT
 * ----------------------------
 * Real: the schema, the constraints, the triggers, the metric views, and the
 * RLS policies. Every request runs inside `set local role authenticated` +
 * `set local request.jwt.claim.sub`, so `auth.uid()`, `is_staff()` and
 * `my_student_ids()` resolve for real and a persona genuinely cannot read or
 * write past its policies. The React bundle under test is the real production
 * build; nothing in `src/` is stubbed, patched or aware this server exists.
 *
 * Not real: this is not GoTrue and not PostgREST. Passwords are compared as
 * SHA-256 (not bcrypt), tokens are HS256 JWTs minted here, and the
 * translation layer covers the query subset this repo uses rather than the
 * whole of PostgREST. `pg_cron` is unavailable locally, so
 * `20260719000000_cron.sql` is absent from the cluster — anything depending
 * on scheduled jobs is NOT represented here.
 */
import { createServer } from 'node:http';
import { createHash, randomUUID } from 'node:crypto';
import { psqlJson, adminJson, admin, asRole, lit, ident, PgError } from './lib/db.mjs';
import { sign, verify, ANON_KEY } from './lib/jwt.mjs';
import {
  buildSelect,
  buildInsert,
  buildUpdate,
  buildDelete,
  parsePrefer,
  parseRange,
  parseSelect,
  wrapRows,
  wrapWrite,
  UnsupportedQueryError,
} from './lib/postgrest.mjs';

const PORT = Number(process.env.HARNESS_PORT ?? 54321);
const OBJECT_STORE = new Map();

/* ------------------------------------------------------------------ utils */

function log(...args) {
  if (process.env.HARNESS_QUIET !== '1') console.log('[shim]', ...args);
}

function sha256(value) {
  return createHash('sha256').update(String(value)).digest('hex');
}

function corsHeaders(req) {
  return {
    'access-control-allow-origin': req.headers.origin ?? '*',
    'access-control-allow-credentials': 'true',
    'access-control-allow-methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS,HEAD',
    'access-control-allow-headers':
      req.headers['access-control-request-headers'] ??
      'authorization,apikey,content-type,prefer,accept,accept-profile,content-profile,range,x-client-info,x-upsert,x-supabase-api-version',
    'access-control-expose-headers': 'content-range,content-location,x-harness-sql',
    'access-control-max-age': '86400',
  };
}

function send(req, res, status, body, extraHeaders = {}) {
  const headers = { ...corsHeaders(req), ...extraHeaders };
  if (body === null || body === undefined) {
    res.writeHead(status, headers);
    res.end();
    return;
  }
  if (Buffer.isBuffer(body)) {
    res.writeHead(status, headers);
    res.end(body);
    return;
  }
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...headers });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function readJson(buffer) {
  if (!buffer || buffer.length === 0) return null;
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * Map a Postgres SQLSTATE onto the HTTP status PostgREST would return.
 * `42501` (insufficient_privilege) is the one that matters most: it is how an
 * RLS-denied INSERT surfaces, and the app's error UI branches on the 403.
 */
function statusForPgError(error) {
  switch (error.code) {
    case '42501':
      return 403;
    case '23505':
      return 409;
    case '23503':
    case '23514':
    case '23502':
      return 400;
    case '22P02':
    case '22007':
    case '22008':
      return 400;
    case '42P01':
    case '42703':
      return 404;
    default:
      return 400;
  }
}

function pgErrorBody(error) {
  return {
    code: error.code,
    message: error.message,
    details: error.detail,
    hint: error.hint,
  };
}

/* ------------------------------------------------------------------- auth */

function identityFor(req) {
  const header = req.headers.authorization ?? '';
  const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : null;
  const token = bearer && bearer !== ANON_KEY ? bearer : null;
  const claims = token ? verify(token) : null;
  if (claims?.sub) {
    return { role: 'authenticated', sub: claims.sub, claims };
  }
  return { role: 'anon', sub: null, claims: { role: 'anon' } };
}

const USER_COLUMNS = `json_build_object(
  'id', u.id,
  'aud', 'authenticated',
  'role', 'authenticated',
  'email', u.email,
  'phone', '',
  'email_confirmed_at', u.email_confirmed_at,
  'confirmed_at', u.email_confirmed_at,
  'last_sign_in_at', u.last_sign_in_at,
  'app_metadata', json_build_object('provider', 'email', 'providers', json_build_array('email')),
  'user_metadata', coalesce(u.raw_user_meta_data, '{}'::jsonb),
  'identities', json_build_array(),
  'created_at', coalesce(u.email_confirmed_at, now()),
  'updated_at', coalesce(u.updated_at, now())
)`;

async function findUserByEmail(email) {
  const doc = await adminJson(
    `select coalesce(json_build_object('user', ${USER_COLUMNS}, 'password', u.harness_password), 'null'::json)::text
     from auth.users u where lower(u.email) = lower(${lit(email)}) limit 1;`,
  );
  return doc;
}

async function findUserById(id) {
  const doc = await adminJson(
    `select coalesce(json_build_object('user', ${USER_COLUMNS}, 'password', u.harness_password), 'null'::json)::text
     from auth.users u where u.id = ${lit(id)} limit 1;`,
  );
  return doc;
}

function sessionFor(user) {
  const { token, payload } = sign(
    {
      iss: 'volt-e2e-harness',
      sub: user.id,
      aud: 'authenticated',
      role: 'authenticated',
      email: user.email,
      app_metadata: user.app_metadata,
      user_metadata: user.user_metadata,
      session_id: randomUUID(),
    },
    { expiresIn: 3600 },
  );
  return {
    access_token: token,
    token_type: 'bearer',
    expires_in: 3600,
    expires_at: payload.exp,
    refresh_token: `harness-refresh-${user.id}`,
    user,
  };
}

function authError(res, req, status, message, errorCode) {
  send(req, res, status, {
    code: status,
    error_code: errorCode,
    msg: message,
    message,
    error: errorCode,
    error_description: message,
  });
}

async function handleAuth(req, res, url, bodyBuffer) {
  const path = url.pathname.replace(/^\/auth\/v1/, '');
  const body = readJson(bodyBuffer) ?? {};

  if (path === '/token' && req.method === 'POST') {
    const grant = url.searchParams.get('grant_type');
    if (grant === 'password') {
      const record = await findUserByEmail(body.email ?? '');
      if (!record || record.password !== sha256(body.password ?? '')) {
        log('login failed for', body.email);
        return authError(res, req, 400, 'Invalid login credentials', 'invalid_credentials');
      }
      await admin(`update auth.users set last_sign_in_at = now() where id = ${lit(record.user.id)};`);
      log('login ok', body.email);
      return send(req, res, 200, sessionFor(record.user));
    }
    if (grant === 'refresh_token') {
      const raw = String(body.refresh_token ?? '');
      const userId = raw.startsWith('harness-refresh-') ? raw.slice('harness-refresh-'.length) : null;
      const record = userId ? await findUserById(userId) : null;
      if (!record) return authError(res, req, 400, 'Invalid Refresh Token', 'refresh_token_not_found');
      return send(req, res, 200, sessionFor(record.user));
    }
    return authError(res, req, 400, `Unsupported grant_type: ${grant}`, 'unsupported_grant_type');
  }

  if (path === '/user') {
    const identity = identityFor(req);
    if (!identity.sub) return authError(res, req, 401, 'invalid claim: missing sub claim', 'bad_jwt');
    const record = await findUserById(identity.sub);
    if (!record) return authError(res, req, 401, 'User from sub claim in JWT does not exist', 'user_not_found');

    if (req.method === 'PUT') {
      const updates = [];
      if (typeof body.password === 'string' && body.password.length > 0) {
        updates.push(`harness_password = ${lit(sha256(body.password))}`);
      }
      if (body.data && typeof body.data === 'object') {
        updates.push(`raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || ${lit(JSON.stringify(body.data))}::jsonb`);
      }
      if (typeof body.email === 'string' && body.email.length > 0) {
        updates.push(`email = ${lit(body.email)}`);
      }
      if (updates.length) {
        updates.push('updated_at = now()');
        await admin(`update auth.users set ${updates.join(', ')} where id = ${lit(identity.sub)};`);
      }
      const refreshed = await findUserById(identity.sub);
      return send(req, res, 200, refreshed.user);
    }
    return send(req, res, 200, record.user);
  }

  if (path === '/logout' && req.method === 'POST') return send(req, res, 204, null);
  if (path === '/recover' && req.method === 'POST') return send(req, res, 200, {});
  if (path === '/settings' && req.method === 'GET') {
    return send(req, res, 200, {
      external: { email: true, google: true },
      disable_signup: true,
      mailer_autoconfirm: true,
    });
  }
  return send(req, res, 404, { message: `harness: unhandled auth route ${req.method} ${path}` });
}

/* ------------------------------------------------------------------- rest */

const pkCache = new Map();

async function primaryKeyColumns(table) {
  if (pkCache.has(table)) return pkCache.get(table);
  const doc = await adminJson(
    `select coalesce(array_to_json(array(
       select a.attname from pg_index i
       join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
       where i.indrelid = ${lit(`public.${table}`)}::regclass and i.indisprimary
     )), '[]'::json)::text;`,
  );
  pkCache.set(table, doc ?? []);
  return doc ?? [];
}

async function handleRest(req, res, url, bodyBuffer) {
  const identity = identityFor(req);
  const segments = url.pathname.replace(/^\/rest\/v1\/?/, '').split('/').filter(Boolean);
  if (segments.length === 0) return send(req, res, 404, { message: 'harness: no relation in path' });

  if (segments[0] === 'rpc') {
    return handleRpc(req, res, url, bodyBuffer, identity, segments[1]);
  }

  const table = segments[0];
  const prefer = parsePrefer(req.headers.prefer);
  const range = parseRange(req.headers.range);
  const singular = String(req.headers.accept ?? '').includes('application/vnd.pgrst.object+json');

  let statement;
  try {
    if (req.method === 'GET' || req.method === 'HEAD') {
      const { paged, countSql } = buildSelect({ table, searchParams: url.searchParams, range });
      statement = wrapRows(paged, prefer.count === 'exact' ? countSql : null);
    } else if (req.method === 'POST') {
      const payload = readJson(bodyBuffer);
      const conflictColumns = await primaryKeyColumns(table);
      statement = wrapWrite(
        buildInsert({ table, rows: payload, searchParams: url.searchParams, prefer, conflictColumns }),
      );
    } else if (req.method === 'PATCH') {
      statement = wrapWrite(buildUpdate({ table, patch: readJson(bodyBuffer), searchParams: url.searchParams }));
    } else if (req.method === 'DELETE') {
      statement = wrapWrite(buildDelete({ table, searchParams: url.searchParams }));
    } else {
      return send(req, res, 405, { message: `harness: ${req.method} not supported on /rest/v1` });
    }
  } catch (error) {
    if (error instanceof UnsupportedQueryError) {
      log('UNSUPPORTED', req.method, url.pathname + url.search, '->', error.message);
      return send(req, res, 400, { code: 'HARNESS_UNSUPPORTED', message: error.message, details: null, hint: null });
    }
    throw error;
  }

  let doc;
  try {
    doc = await psqlJson(asRole(identity, statement));
  } catch (error) {
    if (error instanceof PgError) {
      log('PGERROR', req.method, url.pathname + url.search, error.code, error.message);
      return send(req, res, statusForPgError(error), pgErrorBody(error));
    }
    throw error;
  }

  const rows = doc?.rows ?? [];
  const total = doc?.count ?? null;
  const headers = {};
  if (prefer.count === 'exact') {
    const from = range?.from ?? 0;
    headers['content-range'] = rows.length
      ? `${from}-${from + rows.length - 1}/${total ?? '*'}`
      : `*/${total ?? 0}`;
  }

  if (req.method === 'HEAD') {
    res.writeHead(200, { ...corsHeaders(req), ...headers });
    return res.end();
  }

  if (singular) {
    if (rows.length !== 1) {
      return send(req, res, 406, {
        code: 'PGRST116',
        message: 'JSON object requested, multiple (or no) rows returned',
        details: `Results contain ${rows.length} rows`,
        hint: null,
      });
    }
    return send(req, res, req.method === 'POST' ? 201 : 200, rows[0], headers);
  }

  if (req.method !== 'GET' && !prefer.representation) {
    return send(req, res, 204, null, headers);
  }
  return send(req, res, req.method === 'POST' ? 201 : 200, rows, headers);
}

async function handleRpc(req, res, url, bodyBuffer, identity, fnName) {
  if (!fnName) return send(req, res, 404, { message: 'harness: rpc name missing' });
  const args = readJson(bodyBuffer) ?? {};
  const argSql = Object.entries(args)
    .map(([key, value]) => `${ident(key)} => ${lit(value)}`)
    .join(', ');

  const meta = await adminJson(
    `select coalesce(json_build_object('setof', p.proretset, 'composite', t.typtype = 'c'), 'null'::json)::text
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     join pg_type t on t.oid = p.prorettype
     where n.nspname = 'public' and p.proname = ${lit(fnName)} limit 1;`,
  );
  if (!meta) return send(req, res, 404, { code: 'PGRST202', message: `Could not find the function public.${fnName}` });

  const call = `${ident(fnName)}(${argSql})`;
  const statement =
    meta.setof || meta.composite
      ? wrapRows(`select ${parseSelect(url.searchParams.get('select'))} from ${call} t`, null)
      : `select json_build_object('rows', json_build_array(to_json(${call})), 'count', null)::text;`;

  try {
    const doc = await psqlJson(asRole(identity, statement));
    const rows = doc?.rows ?? [];
    // A scalar-returning function answers with the bare value, not an array —
    // this is what `supabase.rpc()` callers destructure as `data`.
    if (!meta.setof && !meta.composite) return send(req, res, 200, rows[0] ?? null);
    if (String(req.headers.accept ?? '').includes('application/vnd.pgrst.object+json')) {
      if (rows.length !== 1) {
        return send(req, res, 406, {
          code: 'PGRST116',
          message: 'JSON object requested, multiple (or no) rows returned',
          details: `Results contain ${rows.length} rows`,
          hint: null,
        });
      }
      return send(req, res, 200, rows[0]);
    }
    return send(req, res, 200, rows);
  } catch (error) {
    if (error instanceof PgError) {
      log('PGERROR rpc', fnName, error.code, error.message);
      return send(req, res, statusForPgError(error), pgErrorBody(error));
    }
    throw error;
  }
}

/* ---------------------------------------------------------------- storage */

async function handleStorage(req, res, url, bodyBuffer) {
  const path = url.pathname.replace(/^\/storage\/v1/, '');
  const publicMatch = /^\/object\/public\/([^/]+)\/(.+)$/.exec(path);
  if (publicMatch && req.method === 'GET') {
    const stored = OBJECT_STORE.get(`${publicMatch[1]}/${decodeURIComponent(publicMatch[2])}`);
    if (!stored) return send(req, res, 404, { message: 'Object not found' });
    return send(req, res, 200, stored.body, { 'content-type': stored.contentType });
  }
  const objectMatch = /^\/object\/([^/]+)\/(.+)$/.exec(path);
  if (objectMatch && (req.method === 'POST' || req.method === 'PUT')) {
    const key = `${objectMatch[1]}/${decodeURIComponent(objectMatch[2])}`;
    OBJECT_STORE.set(key, {
      body: bodyBuffer,
      contentType: req.headers['content-type'] ?? 'application/octet-stream',
    });
    log('storage upload', key, `${bodyBuffer.length}b`);
    return send(req, res, 200, { Key: key, Id: randomUUID() });
  }
  return send(req, res, 404, { message: `harness: unhandled storage route ${req.method} ${path}` });
}

/* -------------------------------------------------------- edge  functions */

/**
 * Edge Functions run on Deno in production (`supabase/functions/**`) and
 * cannot execute here. These stand-ins implement the same request/response
 * contract the callers in `src/lib/supabase/loaders/**` depend on, backed by
 * the same real tables. Anything asserted through one of these is asserting
 * the app's handling of the contract, NOT the deployed function's body.
 */
const EDGE_FUNCTIONS = {
  async checkin(payload, identity) {
    if (!identity.sub) return { status: 401, body: { error: 'unauthenticated' } };
    const sessionId = payload?.sessionId ?? payload?.session_id ?? null;
    if (!sessionId) return { status: 400, body: { error: 'sessionId is required' } };
    const issuedAt = Date.now();
    const token = createHash('sha256').update(`${sessionId}:${issuedAt}:harness`).digest('hex').slice(0, 32);
    return {
      status: 200,
      body: {
        token,
        sessionId,
        issuedAt: new Date(issuedAt).toISOString(),
        expiresAt: new Date(issuedAt + 60_000).toISOString(),
        rotateAfterMs: 60_000,
        url: `http://127.0.0.1:${PORT}/checkin/${token}`,
      },
    };
  },
  async 'send-invite'(payload, identity) {
    if (!identity.sub) return { status: 401, body: { error: 'unauthenticated' } };
    log('send-invite (stand-in) for', payload?.email);
    return { status: 200, body: { ok: true, email: payload?.email ?? null, delivered: false, harness: true } };
  },
};

async function handleFunctions(req, res, url, bodyBuffer) {
  const name = url.pathname.replace(/^\/functions\/v1\/?/, '').split('/')[0];
  const handler = EDGE_FUNCTIONS[name];
  if (!handler) return send(req, res, 404, { message: `harness: no stand-in for Edge Function "${name}"` });
  const result = await handler(readJson(bodyBuffer), identityFor(req));
  return send(req, res, result.status, result.body);
}

/* ----------------------------------------------------------------- server */

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders(req));
    return res.end();
  }
  try {
    const bodyBuffer = await readBody(req);
    if (url.pathname === '/__harness/health') return send(req, res, 200, { ok: true, anonKey: ANON_KEY });
    if (url.pathname.startsWith('/auth/v1')) return await handleAuth(req, res, url, bodyBuffer);
    if (url.pathname.startsWith('/rest/v1')) return await handleRest(req, res, url, bodyBuffer);
    if (url.pathname.startsWith('/storage/v1')) return await handleStorage(req, res, url, bodyBuffer);
    if (url.pathname.startsWith('/functions/v1')) return await handleFunctions(req, res, url, bodyBuffer);
    return send(req, res, 404, { message: `harness: unhandled route ${req.method} ${url.pathname}` });
  } catch (error) {
    log('UNCAUGHT', req.method, url.pathname, error?.message ?? error);
    return send(req, res, 500, { message: String(error?.message ?? error) });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  log(`listening on http://127.0.0.1:${PORT}`);
  log(`anon key: ${ANON_KEY}`);
});
