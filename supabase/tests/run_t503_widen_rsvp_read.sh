#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATIONS_DIR="$REPO_ROOT/supabase/migrations"
NEW_MIGRATION="20260804000001_widen_rsvp_read_all_authenticated.sql"
SKIPPED_MIGRATION="20260719000000_cron.sql"
DBNAME="volt_t503_widen_rsvp_read_$$_$(date +%s)"
SNAPSHOT_DIR="$(mktemp -d)"

PSQL=(psql -X -v ON_ERROR_STOP=1)

cleanup() {
  "${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS \"$DBNAME\" WITH (FORCE);" >/dev/null 2>&1 || true
  rm -rf "$SNAPSHOT_DIR"
}
trap cleanup EXIT

echo "==> creating scratch database $DBNAME"
"${PSQL[@]}" -d postgres -c "CREATE DATABASE \"$DBNAME\";"

echo "==> applying task-specific Supabase platform stub (T195 precedent, reused per T205/T322)"
"${PSQL[@]}" -d "$DBNAME" -f "$SCRIPT_DIR/calendar_feed_platform_stub.sql"

echo "==> creating service_role if missing (T205/T322's own default-privileges line"
echo "    names it but neither the shared platform stub nor any migration creates"
echo "    it -- harmless on a cluster where it already exists from a prior run,"
echo "    required on a fresh initdb'd cluster; not a change to the shared stub file)"
"${PSQL[@]}" -d "$DBNAME" -c "
do \$\$
begin
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin;
  end if;
end;
\$\$;
"

echo "==> simulating Supabase's stock default privileges (must run BEFORE the"
echo "    migrations create rsvps/the views under test, or the suite passes"
echo "    vacuously for the wrong reason -- T205 precedent)"
"${PSQL[@]}" -d "$DBNAME" -c \
  "alter default privileges in schema public grant all on tables to anon, authenticated, service_role;"

echo "==> applying every migration EXCEPT the widening migration (loop split,"
echo "    so a real BEFORE snapshot exists -- packet v2 F2(b))"
found_new=false
for migration in "$MIGRATIONS_DIR"/*.sql; do
  basename="$(basename "$migration")"

  if [[ "$basename" == "$SKIPPED_MIGRATION" ]]; then
    echo "==> skipping migration: 20260719000000_cron.sql (requires Supabase pg_cron, pg_net, and Vault)"
    continue
  fi

  if [[ "$basename" == "$NEW_MIGRATION" ]]; then
    found_new=true
    echo "==> holding back migration (applied after the BEFORE snapshot): $basename"
    continue
  fi

  echo "==> applying migration unchanged: $basename"
  "${PSQL[@]}" -d "$DBNAME" -f "$migration"
done

if [[ "$found_new" != true ]]; then
  echo "Missing required migration: $NEW_MIGRATION" >&2
  exit 1
fi

echo "==> loading T503 fixtures"
"${PSQL[@]}" -d "$DBNAME" -f "$SCRIPT_DIR/t503_widen_rsvp_read_fixture.sql"

echo "==> [BEFORE] direct rsvps read as Student One (shipped RLS, own row only)"
"${PSQL[@]}" -At -d "$DBNAME" -f "$SCRIPT_DIR/t503_widen_rsvp_read_before_direct_count.sql" \
  | tee "$SNAPSHOT_DIR/before_direct_count.txt"

before_direct_count="$(cat "$SNAPSHOT_DIR/before_direct_count.txt")"
if [[ "$before_direct_count" != "1" ]]; then
  echo "FAIL: expected exactly 1 row visible to Student One BEFORE widening (shipped RLS), got $before_direct_count" >&2
  exit 1
fi
echo "==> PASS before-direct-read-scoped (1 row, own only)"

echo "==> [BEFORE] snapshotting the three planned-hours views (C4) and the two"
echo "    rsvps write policies (C5)"
"${PSQL[@]}" -d "$DBNAME" -f "$SCRIPT_DIR/t503_widen_rsvp_read_views_snapshot.sql" > "$SNAPSHOT_DIR/views_before.txt"
"${PSQL[@]}" -d "$DBNAME" -f "$SCRIPT_DIR/t503_widen_rsvp_read_writepolicies_snapshot.sql" > "$SNAPSHOT_DIR/writepolicies_before.txt"

echo "==> applying the widening migration: $NEW_MIGRATION"
"${PSQL[@]}" -d "$DBNAME" -f "$MIGRATIONS_DIR/$NEW_MIGRATION"

echo "==> [AFTER] snapshotting the three planned-hours views (C4) and the two"
echo "    rsvps write policies (C5)"
"${PSQL[@]}" -d "$DBNAME" -f "$SCRIPT_DIR/t503_widen_rsvp_read_views_snapshot.sql" > "$SNAPSHOT_DIR/views_after.txt"
"${PSQL[@]}" -d "$DBNAME" -f "$SCRIPT_DIR/t503_widen_rsvp_read_writepolicies_snapshot.sql" > "$SNAPSHOT_DIR/writepolicies_after.txt"

echo "==> C4: comparing planned-hours view snapshots BEFORE vs AFTER (must be byte-identical)"
if ! diff -u "$SNAPSHOT_DIR/views_before.txt" "$SNAPSHOT_DIR/views_after.txt"; then
  echo "FAIL c4-views-unchanged: planned-hours view output differs before vs after widening" >&2
  exit 1
fi
sha256sum "$SNAPSHOT_DIR/views_before.txt" "$SNAPSHOT_DIR/views_after.txt"
echo "==> PASS c4-views-unchanged"

echo "==> C5: sha256 of the two rsvps write policies, BEFORE vs AFTER (must match)"
sha256sum "$SNAPSHOT_DIR/writepolicies_before.txt" "$SNAPSHOT_DIR/writepolicies_after.txt"
if ! diff -u "$SNAPSHOT_DIR/writepolicies_before.txt" "$SNAPSHOT_DIR/writepolicies_after.txt"; then
  echo "FAIL c5-write-policies-unchanged: own_or_linked_write/own_or_linked_update differ before vs after" >&2
  exit 1
fi
echo "==> PASS c5-write-policies-unchanged"

echo "==> running C1/C2/C3 assertions (post-widening)"
"${PSQL[@]}" -d "$DBNAME" -f "$SCRIPT_DIR/t503_widen_rsvp_read_assertions.sql"

echo "==> T503 widen-rsvp-read tests: ALL PASS"
