#!/usr/bin/env bash
#
# Bring up everything the persona end-to-end suite needs:
#
#   1. a disposable PostgreSQL cluster carrying supabase/migrations/*.sql
#   2. the platform grants a hosted Supabase project applies by default
#   3. tests/e2e-harness/seed.sql (fabricated persona fixtures)
#   4. the Supabase-compatible API server on 127.0.0.1:54321
#   5. a .env pointing the Vite bundle at that server
#
# Then run:
#   npx playwright test -c tests/e2e-harness/playwright.personas.config.ts
#
# Tear down with:
#   bash tests/e2e-harness/stop.sh
#
# This is re-runnable: it recreates the cluster and reloads the seed each
# time, so a suite that dirtied the data starts clean again.
#
# Requirements: PostgreSQL server binaries under /usr/lib/postgresql/*/bin,
# psql on PATH, and Node. No Docker, no supabase CLI, and no new npm
# dependency (constitution item 9) — the API server is plain Node talking to
# psql, the same access pattern supabase/tests/run.sh already established.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
HARNESS_DIR="$REPO_ROOT/tests/e2e-harness"
PG_PORT="${SCRATCH_PG_PORT:-55432}"
PG_DB="${SCRATCH_PG_DB:-scratch}"
API_PORT="${HARNESS_PORT:-54321}"
PIDFILE="/tmp/volt-e2e-harness-$API_PORT.pid"

# The anon key the server mints deterministically (see lib/jwt.mjs) — a real
# HS256 JWT with a fixed `iat`, so this literal stays valid across restarts.
ANON_KEY='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE3ODAwMDAwMDAsImV4cCI6MjA5NTM2MDAwMCwiaXNzIjoidm9sdC1lMmUtaGFybmVzcyIsInJvbGUiOiJhbm9uIn0.MXU7Boz2_mwsHLpEe-nLmYVmU40gR-EHUoqIDU_FZPI'

echo "==> starting scratch PostgreSQL on port $PG_PORT"
bash "$REPO_ROOT/.claude/skills/scratch-postgres/scripts/start.sh" --port "$PG_PORT" --db "$PG_DB"

# The scratch cluster listens on a unix socket only. The API server runs as
# root and cannot use peer auth as the postgres user, so switch it to a
# loopback TCP listener (trust auth, localhost only — it is a scratch cluster
# holding fabricated fixtures and nothing else).
echo "==> enabling loopback TCP on the cluster"
PGBIN="$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)"
su postgres -c "PATH=$PGBIN:\$PATH psql -h /tmp -p $PG_PORT -U postgres -d postgres \
  -c \"alter system set listen_addresses = '127.0.0.1';\"" >/dev/null
su postgres -c "PATH=$PGBIN:\$PATH pg_ctl -D /tmp/scratch-pg-$PG_PORT/data \
  -o '-p $PG_PORT -k /tmp' -l /tmp/scratch-pg-$PG_PORT/log restart -m fast" >/dev/null
for _ in $(seq 1 20); do
  psql -h 127.0.0.1 -p "$PG_PORT" -U postgres -d "$PG_DB" -c 'select 1' >/dev/null 2>&1 && break
  sleep 0.5
done

PSQL=(psql -h 127.0.0.1 -p "$PG_PORT" -U postgres -d "$PG_DB" -X -q -v ON_ERROR_STOP=1)

# Hosted Supabase grants `anon`/`authenticated` usage on `auth` and `storage`
# and DML on every public table; a bare cluster does not. Without these the
# personas hit "permission denied" before any RLS policy is even consulted,
# which would look like a policy denial and prove the opposite of the truth.
echo "==> applying platform grants"
"${PSQL[@]}" -c "
  grant usage on schema auth to authenticated, anon;
  grant usage on schema storage to authenticated, anon;
  grant execute on function auth.uid() to authenticated, anon;
  grant execute on function auth.role() to authenticated, anon;
  grant select on auth.users to authenticated;
" >/dev/null
"${PSQL[@]}" -f "$REPO_ROOT/tests/rls/grants.sql" >/dev/null

echo "==> loading persona fixtures"
"${PSQL[@]}" -f "$HARNESS_DIR/seed.sql"

# `.env.e2e`, NOT `.env`: Vite only loads it for `--mode e2e`, which the
# persona config's build uses. A plain `.env` would also be picked up by
# `npm test` and by the root `playwright.config.ts` suite — and both of those
# deliberately assert the app's behaviour when Supabase is NOT configured, so a
# configured `.env` turns 16 of their tests red for no real reason.
echo "==> writing .env.e2e for the Vite bundle"
cat > "$REPO_ROOT/.env.e2e" <<EOF
# Written by tests/e2e-harness/start.sh — points the bundle at the local
# Supabase-compatible harness. Gitignored; never a real project's values.
VITE_SUPABASE_URL=http://127.0.0.1:$API_PORT
VITE_SUPABASE_ANON_KEY=$ANON_KEY
EOF

echo "==> starting the Supabase-compatible API server on 127.0.0.1:$API_PORT"
if [ -f "$PIDFILE" ] && kill -0 "$(cat "$PIDFILE")" 2>/dev/null; then
  kill "$(cat "$PIDFILE")" 2>/dev/null || true
  sleep 1
fi
HARNESS_PORT="$API_PORT" SCRATCH_PG_PORT="$PG_PORT" SCRATCH_PG_DB="$PG_DB" \
  nohup node "$HARNESS_DIR/server.mjs" > /tmp/volt-e2e-harness.log 2>&1 &
echo $! > "$PIDFILE"

for _ in $(seq 1 30); do
  curl -fsS --noproxy '*' "http://127.0.0.1:$API_PORT/__harness/health" >/dev/null 2>&1 && break
  sleep 0.5
done
curl -fsS --noproxy '*' "http://127.0.0.1:$API_PORT/__harness/health" >/dev/null || {
  echo "API server failed to start; log follows:" >&2
  tail -20 /tmp/volt-e2e-harness.log >&2
  exit 2
}

cat <<EOF

ready.
  database: psql -h 127.0.0.1 -p $PG_PORT -U postgres -d $PG_DB
  api:      http://127.0.0.1:$API_PORT   (log: /tmp/volt-e2e-harness.log)
  personas: admin@volt.test / coach@volt.test / student@volt.test / parent@volt.test
  password: VoltTest!2026

  next: npx playwright test -c tests/e2e-harness/playwright.personas.config.ts
  stop: bash tests/e2e-harness/stop.sh
EOF
