#!/usr/bin/env node
// GAM-407 criterion 5 — durable git evidence.
//
// Pure module, no network, no credentials, matching the existing
// scripts/linear-*.test.mjs pattern (see scripts/linear-assert-released.mjs).
// Renders an `ops.run` record plus its `ops.run_event` rows (the tables
// Worker A's schema.sql defines) into a deterministic markdown episode
// summary — the artifact that lets a controller state survive the run store
// itself becoming unavailable (§7 scenario 15), by committing what happened
// to git rather than only to the store.
//
// DETERMINISTIC MEANS BYTE-IDENTICAL FOR IDENTICAL INPUT. That rules out
// three things this file deliberately never does:
//   - `Date.now()` / `new Date()` with no argument — every timestamp printed
//     here comes from the input record, never from the wall clock.
//   - Relying on the iteration order of a plain object's own keys — `result_
//     refs` is a `jsonb` column and its key order is not a property either
//     PostgreSQL or `JSON.parse` guarantees, so it is deep-sorted before
//     rendering (`sortKeysDeep` below).
//   - Trusting the order of the `events` array as handed in — a caller that
//     fetches events without an explicit `order by` cannot guarantee a
//     stable order, so this module sorts by `(recorded_at, event_key)`
//     itself rather than assuming the caller already did.
//
// `renderEpisodeSummary` never throws on a run with no events, no
// `result_refs`, or missing optional fields — every optional field renders
// as a literal placeholder rather than `undefined`/`null` leaking into the
// output, which would itself be a determinism hazard across two runs of the
// same *code* fed slightly different but semantically-empty inputs
// (`undefined` vs `null` vs `{}`).

/**
 * Recursively sorts the own-enumerable keys of every plain object reached
 * from `value`, leaving array element order untouched (arrays are already
 * order-deterministic — only object key ITERATION order is unspecified).
 * Primitives pass through unchanged.
 */
function sortKeysDeep(value) {
  if (Array.isArray(value)) {
    return value.map(sortKeysDeep);
  }
  if (value !== null && typeof value === 'object') {
    const sorted = {};
    for (const key of Object.keys(value).sort()) {
      sorted[key] = sortKeysDeep(value[key]);
    }
    return sorted;
  }
  return value;
}

/** Renders `undefined`/`null`/`''` as an explicit placeholder rather than the
 * string "undefined" or "null" leaking into committed markdown. */
function displayOrPlaceholder(value, placeholder = '(none)') {
  if (value === undefined || value === null) return placeholder;
  if (typeof value === 'string' && value.trim().length === 0) return placeholder;
  return String(value);
}

/** Escapes a value for use inside a markdown table cell: pipes would break
 * the table grid, and embedded newlines would split a logical cell across
 * rows, so both are neutralised deterministically. */
function tableCell(value, placeholder = '(none)') {
  const text = displayOrPlaceholder(value, placeholder);
  return text.replace(/\r?\n/g, '<br>').replace(/\|/g, '\\|');
}

/** Deterministic comparator over the fields that make each `ops.run_event`
 * row unique — `recorded_at` first (the narrative order the summary reads
 * best in), `event_key` as a stable tiebreaker (unique per run per schema,
 * so it never leaves two rows tied). Missing `recorded_at` sorts first, so a
 * malformed/unset timestamp cannot silently reorder the rest of the table. */
function compareEvents(a, b) {
  const aAt = a.recorded_at ?? '';
  const bAt = b.recorded_at ?? '';
  if (aAt !== bAt) return aAt < bAt ? -1 : 1;
  const aKey = a.event_key ?? '';
  const bKey = b.event_key ?? '';
  if (aKey !== bKey) return aKey < bKey ? -1 : 1;
  return 0;
}

function renderResultRefsSection(resultRefs) {
  const sorted = sortKeysDeep(resultRefs ?? {});
  const keys = Object.keys(sorted);
  if (keys.length === 0) {
    return '(none)\n';
  }
  // JSON.stringify iterates object keys in insertion order, so the object
  // handed to it here must already be key-sorted — sortKeysDeep guarantees
  // that at every level, not just the top one.
  return '```json\n' + JSON.stringify(sorted, null, 2) + '\n```\n';
}

function renderEventsSection(events) {
  const rows = [...(events ?? [])].sort(compareEvents);
  if (rows.length === 0) {
    return '(no events recorded)\n';
  }
  const header = '| event_key | kind | recorded_at | detail |\n|---|---|---|---|\n';
  const body = rows
    .map((event) => {
      const detail =
        event.detail === undefined || event.detail === null
          ? '(none)'
          : tableCell(JSON.stringify(sortKeysDeep(event.detail)));
      return `| ${tableCell(event.event_key)} | ${tableCell(event.kind)} | ${tableCell(event.recorded_at)} | ${detail} |`;
    })
    .join('\n');
  return header + body + '\n';
}

/**
 * Renders one `ops.run` record and its `ops.run_event` rows into a
 * deterministic markdown episode summary. Byte-identical for byte-identical
 * input — no wall clock, no key-iteration-order dependence.
 *
 * `run` mirrors `ops.run`'s columns (snake_case, as a PostgreSQL client
 * returns them): `run_id`, `issue_identifier`, `todo_event_id`, `status`,
 * `phase`, `generation`, `version`, `pipeline_version`, `constitution_sha`,
 * `branch`, `base_sha`, `head_sha`, `active_executor`, `required_next_role`,
 * `result_refs`, `failure_class`, `failure_detail`, `reserved_at`,
 * `updated_at`. `capability_hash` is deliberately never rendered — this
 * summary is committed to git history, and even a hash of a capability
 * secret has no narrative value here.
 *
 * `events` mirrors `ops.run_event` rows: `event_key`, `kind`, `detail`,
 * `recorded_at`.
 *
 * @param {object} run
 * @param {object[]} events
 * @returns {string} markdown
 */
export function renderEpisodeSummary(run, events) {
  if (run === null || typeof run !== 'object') {
    throw new TypeError('renderEpisodeSummary: run must be an object');
  }

  const lines = [];
  lines.push(`# Episode summary — run \`${displayOrPlaceholder(run.run_id, '(unknown run)')}\``);
  lines.push('');
  lines.push(
    `- Issue: ${displayOrPlaceholder(run.issue_identifier)} (todo event \`${displayOrPlaceholder(run.todo_event_id)}\`)`,
  );
  lines.push(
    `- Status: ${displayOrPlaceholder(run.status)} (phase: ${displayOrPlaceholder(run.phase)})`,
  );
  lines.push(
    `- Generation: ${displayOrPlaceholder(run.generation)}, version: ${displayOrPlaceholder(run.version)}`,
  );
  lines.push(
    `- Branch: \`${displayOrPlaceholder(run.branch)}\` — base \`${displayOrPlaceholder(run.base_sha)}\` → head \`${displayOrPlaceholder(run.head_sha)}\``,
  );
  lines.push(`- Active executor: ${displayOrPlaceholder(run.active_executor)}`);
  lines.push(`- Required next role: ${displayOrPlaceholder(run.required_next_role)}`);
  lines.push(`- Pipeline version: ${displayOrPlaceholder(run.pipeline_version)}`);
  lines.push(`- Constitution SHA: ${displayOrPlaceholder(run.constitution_sha)}`);
  lines.push(`- Reserved at: ${displayOrPlaceholder(run.reserved_at)}`);
  lines.push(`- Updated at: ${displayOrPlaceholder(run.updated_at)}`);
  lines.push('');
  lines.push('## Failure');
  lines.push('');
  lines.push(`- Class: ${displayOrPlaceholder(run.failure_class)}`);
  lines.push(`- Detail: ${displayOrPlaceholder(run.failure_detail)}`);
  lines.push('');
  lines.push('## Result refs');
  lines.push('');
  lines.push(renderResultRefsSection(run.result_refs).trimEnd());
  lines.push('');
  lines.push('## Events');
  lines.push('');
  lines.push(renderEventsSection(events).trimEnd());
  lines.push('');

  return lines.join('\n');
}
