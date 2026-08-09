/**
 * PostgREST wire-protocol translation: turns the URL/headers/body that
 * `@supabase/supabase-js` emits into SQL for the scratch cluster.
 *
 * Scope is deliberately the subset this repo actually uses. Verified against
 * `src/lib/supabase/loaders/*.ts`: every `.select(...)` in this codebase is a
 * flat column list — no embedded/foreign-table selectors — which is what
 * makes a faithful shim tractable at all. Operators covered are the ones the
 * loaders call: eq, neq, gt, gte, lt, lte, like, ilike, is, in, cs, ov, or,
 * plus order/limit/offset/range, single/maybeSingle, insert, upsert
 * (merge-duplicates + on_conflict), update, delete and rpc.
 *
 * Anything outside that subset throws `UnsupportedQueryError` rather than
 * quietly guessing — a shim that silently mistranslates would manufacture
 * green tests against a database that never saw the query.
 */
import { ident, lit } from './db.mjs';

export class UnsupportedQueryError extends Error {
  constructor(message) {
    super(message);
    this.name = 'UnsupportedQueryError';
  }
}

const LOGIC_PARAMS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns']);

/** Parse `select=id,display_name,alias:col` into a SQL select list. */
export function parseSelect(raw) {
  if (!raw || raw.trim() === '' || raw.trim() === '*') return '*';
  return raw
    .split(',')
    .map((piece) => piece.trim())
    .filter(Boolean)
    .map((piece) => {
      if (piece.includes('(')) {
        throw new UnsupportedQueryError(`embedded resource selectors are not supported: ${piece}`);
      }
      const [left, right] = piece.split(':');
      return right ? `${ident(right.trim())} as ${ident(left.trim())}` : ident(left.trim());
    })
    .join(', ');
}

/** Split `in.(a,"b,c")` style csv respecting double quotes. */
function splitCsv(input) {
  const out = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (ch === '"' && input[i - 1] !== '\\') {
      quoted = !quoted;
      continue;
    }
    if (ch === ',' && !quoted) {
      out.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  out.push(current);
  return out.map((piece) => piece.trim()).filter((piece) => piece !== '');
}

const COMPARATORS = {
  eq: '=',
  neq: '<>',
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
  like: 'like',
  ilike: 'ilike',
};

/** Build one `column <op> value` predicate from a PostgREST filter string. */
export function buildPredicate(column, spec) {
  let negate = false;
  let rest = spec;
  if (rest.startsWith('not.')) {
    negate = true;
    rest = rest.slice(4);
  }
  const dot = rest.indexOf('.');
  if (dot === -1) throw new UnsupportedQueryError(`malformed filter for ${column}: ${spec}`);
  const op = rest.slice(0, dot);
  const value = rest.slice(dot + 1);
  const col = ident(column);
  let sql;

  if (op === 'is') {
    const token = value.toLowerCase();
    if (token === 'null') sql = `${col} is null`;
    else if (token === 'true' || token === 'false') sql = `${col} is ${token}`;
    else if (token === 'unknown') sql = `${col} is unknown`;
    else throw new UnsupportedQueryError(`unsupported is.${value}`);
  } else if (op === 'in') {
    const inner = value.replace(/^\(/, '').replace(/\)$/, '');
    const items = splitCsv(inner);
    // `in ()` is not valid SQL and PostgREST treats an empty list as matching
    // nothing, which is exactly what `where false` expresses.
    sql = items.length === 0 ? 'false' : `${col} in (${items.map((v) => lit(v)).join(', ')})`;
  } else if (op === 'cs' || op === 'cd' || op === 'ov') {
    const operator = op === 'cs' ? '@>' : op === 'cd' ? '<@' : '&&';
    sql = `${col} ${operator} ${lit(value)}`;
  } else if (op in COMPARATORS) {
    const comparator = COMPARATORS[op];
    if (value.toLowerCase() === 'null') {
      // PostgREST maps `eq.null` to IS NULL semantics rather than `= NULL`.
      sql = op === 'eq' ? `${col} is null` : `${col} is not null`;
    } else if (op === 'like' || op === 'ilike') {
      sql = `${col} ${comparator} ${lit(value.replace(/\*/g, '%'))}`;
    } else {
      sql = `${col} ${comparator} ${lit(value)}`;
    }
  } else {
    throw new UnsupportedQueryError(`unsupported operator "${op}" on ${column}`);
  }
  return negate ? `not (${sql})` : sql;
}

/** Parse `or=(a.eq.1,b.is.null)` into a disjunction. */
function buildOr(raw) {
  const inner = raw.replace(/^\(/, '').replace(/\)$/, '');
  const parts = splitCsv(inner).map((clause) => {
    const first = clause.indexOf('.');
    if (first === -1) throw new UnsupportedQueryError(`malformed or() clause: ${clause}`);
    return buildPredicate(clause.slice(0, first), clause.slice(first + 1));
  });
  if (parts.length === 0) return 'true';
  return `(${parts.join(' or ')})`;
}

export function buildWhere(searchParams) {
  const clauses = [];
  for (const [key, value] of searchParams.entries()) {
    if (LOGIC_PARAMS.has(key)) continue;
    if (key === 'or') {
      clauses.push(buildOr(value));
      continue;
    }
    if (key === 'and' || key === 'not') {
      throw new UnsupportedQueryError(`top-level ${key}() is not supported`);
    }
    clauses.push(buildPredicate(key, value));
  }
  return clauses.length ? `where ${clauses.join(' and ')}` : '';
}

/** Parse `order=col.desc.nullslast,other.asc`. */
export function buildOrder(raw) {
  if (!raw) return '';
  const parts = raw
    .split(',')
    .map((piece) => piece.trim())
    .filter(Boolean)
    .map((piece) => {
      const [column, ...modifiers] = piece.split('.');
      let sql = ident(column);
      const lowered = modifiers.map((m) => m.toLowerCase());
      if (lowered.includes('desc')) sql += ' desc';
      else if (lowered.includes('asc')) sql += ' asc';
      if (lowered.includes('nullsfirst')) sql += ' nulls first';
      else if (lowered.includes('nullslast')) sql += ' nulls last';
      return sql;
    });
  return parts.length ? `order by ${parts.join(', ')}` : '';
}

/**
 * Emit a statement whose single result column is a JSON document
 * `{ "rows": [...], "count": n|null }`.
 *
 * `array(subquery)` (not `json_agg`) is used so the rows keep the inner
 * query's ORDER BY — an aggregate over an unordered scan is free to reorder,
 * and an order-sensitive UI assertion would then fail intermittently.
 */
export function wrapRows(innerSql, countSql) {
  return `select json_build_object(
  'rows', coalesce(array_to_json(array(select row_to_json(t) from (${innerSql}) t)), '[]'::json),
  'count', ${countSql ?? 'null'}
)::text;`;
}

export function buildSelect({ table, searchParams, range }) {
  const selectList = parseSelect(searchParams.get('select'));
  const where = buildWhere(searchParams);
  const order = buildOrder(searchParams.get('order'));
  const limitParam = searchParams.get('limit');
  const offsetParam = searchParams.get('offset');

  let limit = limitParam ? Number(limitParam) : null;
  let offset = offsetParam ? Number(offsetParam) : null;
  if (range) {
    offset = range.from;
    if (range.to !== null) limit = range.to - range.from + 1;
  }

  const base = `select ${selectList} from ${ident(table)} ${where} ${order}`.trim();
  const paged = [
    base,
    limit !== null && Number.isFinite(limit) ? `limit ${Math.max(0, limit)}` : '',
    offset !== null && Number.isFinite(offset) && offset > 0 ? `offset ${offset}` : '',
  ]
    .filter(Boolean)
    .join(' ');

  const countSql = `(select count(*) from ${ident(table)} ${where})`;
  return { paged, countSql };
}

/** `Prefer: return=representation, count=exact, resolution=merge-duplicates` */
export function parsePrefer(header) {
  const raw = (header ?? '')
    .split(',')
    .map((piece) => piece.trim().toLowerCase())
    .filter(Boolean);
  return {
    representation: raw.includes('return=representation'),
    minimal: raw.includes('return=minimal'),
    count: raw.find((piece) => piece.startsWith('count='))?.slice('count='.length) ?? null,
    mergeDuplicates: raw.includes('resolution=merge-duplicates'),
    ignoreDuplicates: raw.includes('resolution=ignore-duplicates'),
  };
}

/** `Range: 0-9` */
export function parseRange(header) {
  if (!header) return null;
  const match = /^(\d+)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  return { from: Number(match[1]), to: match[2] === '' ? null : Number(match[2]) };
}

function columnUnion(rows) {
  const seen = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.includes(key)) seen.push(key);
    }
  }
  return seen;
}

function valuesTuple(row, columns) {
  return `(${columns
    .map((column) => (Object.prototype.hasOwnProperty.call(row, column) ? lit(row[column]) : 'default'))
    .join(', ')})`;
}

export function buildInsert({ table, rows, searchParams, prefer, conflictColumns }) {
  const list = Array.isArray(rows) ? rows : [rows];
  if (list.length === 0) throw new UnsupportedQueryError('insert with an empty payload');
  const columns = columnUnion(list);
  if (columns.length === 0) throw new UnsupportedQueryError('insert with no columns');

  const selectList = parseSelect(searchParams.get('select'));
  let sql = `insert into ${ident(table)} (${columns.map(ident).join(', ')}) values ${list
    .map((row) => valuesTuple(row, columns))
    .join(', ')}`;

  if (prefer.mergeDuplicates || prefer.ignoreDuplicates) {
    const target = searchParams.get('on_conflict')
      ? searchParams
          .get('on_conflict')
          .split(',')
          .map((c) => ident(c.trim()))
          .join(', ')
      : conflictColumns.map(ident).join(', ');
    if (!target) {
      throw new UnsupportedQueryError(`upsert on ${table} with no conflict target and no primary key`);
    }
    if (prefer.ignoreDuplicates) {
      sql += ` on conflict (${target}) do nothing`;
    } else {
      const assignable = columns.filter((c) => !target.includes(ident(c)));
      sql += assignable.length
        ? ` on conflict (${target}) do update set ${assignable
            .map((c) => `${ident(c)} = excluded.${ident(c)}`)
            .join(', ')}`
        : ` on conflict (${target}) do nothing`;
    }
  }

  sql += ` returning ${selectList}`;
  return sql;
}

export function buildUpdate({ table, patch, searchParams }) {
  const columns = Object.keys(patch ?? {});
  if (columns.length === 0) throw new UnsupportedQueryError('update with an empty payload');
  const where = buildWhere(searchParams);
  const selectList = parseSelect(searchParams.get('select'));
  return `update ${ident(table)} set ${columns
    .map((c) => `${ident(c)} = ${lit(patch[c])}`)
    .join(', ')} ${where} returning ${selectList}`;
}

export function buildDelete({ table, searchParams }) {
  const where = buildWhere(searchParams);
  const selectList = parseSelect(searchParams.get('select'));
  return `delete from ${ident(table)} ${where} returning ${selectList}`;
}

/** Wrap a data-modifying statement so it still yields the `{rows,count}` doc. */
export function wrapWrite(writeSql) {
  return `with w as (${writeSql})
select json_build_object(
  'rows', coalesce(array_to_json(array(select row_to_json(x) from w x)), '[]'::json),
  'count', (select count(*) from w)
)::text;`;
}
