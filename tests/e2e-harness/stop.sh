#!/usr/bin/env bash
#
# Tear down everything tests/e2e-harness/start.sh brought up: the API server,
# the scratch PostgreSQL cluster and its data directory, and the generated
# .env. A scratch cluster is an instrument, not a fixture — leaving one
# running holds a port and a few hundred MB for nothing.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PG_PORT="${SCRATCH_PG_PORT:-55432}"
API_PORT="${HARNESS_PORT:-54321}"
PIDFILE="/tmp/volt-e2e-harness-$API_PORT.pid"

if [ -f "$PIDFILE" ]; then
  kill "$(cat "$PIDFILE")" 2>/dev/null || true
  rm -f "$PIDFILE"
  echo "stopped API server on port $API_PORT"
fi

bash "$REPO_ROOT/.claude/skills/scratch-postgres/scripts/start.sh" --stop --port "$PG_PORT"

rm -f "$REPO_ROOT/.env.e2e"
echo "removed generated .env.e2e"
