#!/usr/bin/env bash
# Stand up (or tear down) a disposable PostgreSQL cluster with this repo's
# migrations applied.
#
#   start.sh [--port 55432] [--db scratch] [--skip-last N] [--no-migrations]
#   start.sh --stop [--port 55432]
#
# --skip-last N applies all but the last N migrations, for before/after
# comparisons: apply all-but-yours, snapshot, apply yours, snapshot, diff.
#
# initdb refuses to run as root, so everything runs as the postgres user.
set -euo pipefail

PORT=55432
DB=scratch
SKIP_LAST=0
STOP=0
MIGRATIONS=1
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../../.." && pwd)"

while [ $# -gt 0 ]; do
  case "$1" in
    --port) PORT="$2"; shift 2 ;;
    --db) DB="$2"; shift 2 ;;
    --skip-last) SKIP_LAST="$2"; shift 2 ;;
    --no-migrations) MIGRATIONS=0; shift ;;
    --stop) STOP=1; shift ;;
    --repo) REPO="$2"; shift 2 ;;
    *) echo "unknown arg: $1" >&2; exit 2 ;;
  esac
done

PGBIN=$(ls -d /usr/lib/postgresql/*/bin 2>/dev/null | sort -V | tail -1 || true)
[ -n "$PGBIN" ] || { echo "no PostgreSQL server binaries found under /usr/lib/postgresql" >&2; exit 2; }
DATA="/tmp/scratch-pg-$PORT"
export PATH="$PGBIN:$PATH"

as_pg() { su postgres -c "PATH=$PGBIN:\$PATH $1"; }

if [ "$STOP" = 1 ]; then
  as_pg "pg_ctl -D $DATA/data stop -m immediate" >/dev/null 2>&1 || true
  rm -rf "$DATA"
  echo "stopped and deleted $DATA"
  exit 0
fi

# A cluster killed without pg_ctl leaves /tmp/.s.PGSQL.<port>{,.lock} behind,
# and the next start fails with "lock file already exists" even though nothing
# is listening. Clear ours -- but only when no live postmaster holds it.
if [ -S "/tmp/.s.PGSQL.$PORT" ] && ! as_pg "pg_isready -h /tmp -p $PORT" >/dev/null 2>&1; then
  echo "clearing stale socket for port $PORT"
  rm -f "/tmp/.s.PGSQL.$PORT" "/tmp/.s.PGSQL.$PORT.lock"
elif as_pg "pg_isready -h /tmp -p $PORT" >/dev/null 2>&1; then
  echo "a live postmaster already holds port $PORT -- stop it first, or pick another --port" >&2
  exit 2
fi

rm -rf "$DATA"; mkdir -p "$DATA"; chown postgres "$DATA"
as_pg "initdb -D $DATA/data -U postgres --auth=trust" >/dev/null
# Unix socket only. Binding TCP invites "address already in use" from an
# unrelated cluster and buys nothing -- psql reaches it via -h /tmp.
as_pg "pg_ctl -D $DATA/data -o \"-p $PORT -k /tmp -c listen_addresses=''\" -l $DATA/log start" >/dev/null

# Leave nothing running if setup fails partway; a surviving cluster blocks the retry.
cleanup_on_error() {
  [ "$?" = 0 ] && return
  as_pg "pg_ctl -D $DATA/data stop -m immediate" >/dev/null 2>&1 || true
  echo "setup failed -- cluster stopped, $DATA left for inspection" >&2
}
trap cleanup_on_error EXIT
for _ in $(seq 1 20); do
  as_pg "pg_isready -h /tmp -p $PORT" >/dev/null 2>&1 && break
  sleep 0.5
done
as_pg "pg_isready -h /tmp -p $PORT" >/dev/null 2>&1 || {
  echo "server did not start; log follows:" >&2; tail -20 "$DATA/log" >&2; exit 2; }

as_pg "psql -h /tmp -p $PORT -U postgres -c 'create database $DB'" >/dev/null
PSQL="psql -h /tmp -p $PORT -U postgres -d $DB -v ON_ERROR_STOP=1"

# Supabase manages `auth` on hosted projects; migrations reference it but the
# repo does not define it. Stub the minimum they touch.
as_pg "$PSQL -q -c \"
  create schema if not exists auth;
  -- Columns the repo's migrations actually reference on auth.users. Hosted
  -- Supabase owns this table; the stub only needs to satisfy the triggers.
  create table if not exists auth.users (
    id uuid primary key,
    email text,
    email_confirmed_at timestamptz,
    last_sign_in_at timestamptz,
    raw_user_meta_data jsonb default '{}'::jsonb,
    updated_at timestamptz default now()
  );
  create or replace function auth.uid() returns uuid language sql stable as
    \\\$\\\$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid \\\$\\\$;
  create or replace function auth.role() returns text language sql stable as
    \\\$\\\$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') \\\$\\\$;
  -- storage is Supabase-managed too; migrations create policies against it.
  create schema if not exists storage;
  create table if not exists storage.buckets (
    id text primary key, name text, public boolean default false
  );
  create table if not exists storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text, owner uuid, metadata jsonb
  );
  create or replace function storage.foldername(name text) returns text[]
    language sql immutable as \\\$\\\$ select string_to_array(name, '/') \\\$\\\$;
  do \\\$\\\$ begin
    if not exists (select 1 from pg_roles where rolname = 'authenticated') then
      create role authenticated nologin; end if;
    if not exists (select 1 from pg_roles where rolname = 'anon') then
      create role anon nologin; end if;
  end \\\$\\\$;
\"" >/dev/null

if [ "$MIGRATIONS" = 1 ]; then
  mapfile -t FILES < <(ls "$REPO"/supabase/migrations/*.sql | sort)
  TOTAL=${#FILES[@]}
  APPLY=$((TOTAL - SKIP_LAST))
  echo "applying $APPLY of $TOTAL migrations (skipping last $SKIP_LAST)"
  # Stage into the cluster's own dir: the repo may live somewhere the postgres
  # user cannot traverse (a scratchpad, a worktree under /tmp/<uuid>/...), and
  # `chmod a+r` on the file alone does not fix a non-traversable parent.
  STAGE="$DATA/migrations"; mkdir -p "$STAGE"
  for ((i = 0; i < APPLY; i++)); do
    cp "${FILES[$i]}" "$STAGE/$(printf '%03d' "$i")-$(basename "${FILES[$i]}")"
  done
  chmod -R a+rX "$STAGE"; chown -R postgres "$STAGE"
  # Some hosted-only extensions cannot be installed locally. Skip the migrations
  # that need them -- and print which, loudly. A harness that silently drops part
  # of the schema will happily "prove" things about a database you do not have.
  SKIPPED=()
  for f in "$STAGE"/*.sql; do
    NEED=$(grep -ioE 'create extension (if not exists )?"?(pg_cron|pg_net|pgsodium)"?' "$f" \
             | grep -oiE 'pg_cron|pg_net|pgsodium' | head -1 || true)
    if [ -n "$NEED" ] && [ ! -f "/usr/share/postgresql/${PGBIN%/bin}/extension/$NEED.control" ] \
       && ! ls /usr/share/postgresql/*/extension/"$NEED".control >/dev/null 2>&1; then
      SKIPPED+=("$(basename "$f") [needs $NEED]"); continue
    fi
    as_pg "$PSQL -q -f $f" >/dev/null 2>"$DATA/last-err" || {
      echo "FAILED applying $(basename "$f"):" >&2; tail -5 "$DATA/last-err" >&2; exit 2; }
  done
  if [ ${#SKIPPED[@]} -gt 0 ]; then
    echo "SKIPPED ${#SKIPPED[@]} migration(s) needing extensions unavailable locally:"
    printf '  - %s\n' "${SKIPPED[@]}"
    echo "  Anything depending on them is NOT represented in this cluster. Say so in"
    echo "  your findings rather than generalising past it."
  fi
fi

cat <<EOF
ready: postgres $(as_pg "psql -h /tmp -p $PORT -U postgres -tAc 'show server_version'" | tr -d '[:space:]')
  connect: su postgres -c "psql -h /tmp -p $PORT -U postgres -d $DB"
  data dir: $DATA
  stop:     $0 --stop --port $PORT

Reminders: assert post-write ROW STATE, not the SQL you issued. Run the
counterfactual in both directions. A cross-user UPDATE blocked by RLS reports
UPDATE 0 rather than raising -- an exception-catching assertion will pass while
proving nothing.
EOF
