#!/usr/bin/env bash
#
# Delete remote branches that are fully merged into main.
#
# A branch is only ever deleted when its tip is an ancestor of origin/main --
# i.e. it carries zero commits that main does not already have, so deleting the
# ref discards no work. Every check is re-run at execution time; nothing is
# trusted from a previously generated list.
#
# Usage:
#   scripts/delete-merged-branches.sh                 # dry run, 14-day cutoff
#   scripts/delete-merged-branches.sh --days 30       # dry run, 30-day cutoff
#   scripts/delete-merged-branches.sh --days 14 --yes # actually delete
#
# Notes:
#   - Requires full history. A shallow clone silently reports merged branches as
#     unmerged, so the script refuses to run against one.
#   - Branches with an open pull request are skipped when `gh` is available.
#   - Deleted branches are recoverable: every commit remains in main, and the
#     script writes a restore script before deleting anything.

set -euo pipefail

DAYS=14
APPLY=0
MAIN="origin/main"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --days) DAYS="$2"; shift 2 ;;
    --yes) APPLY=1; shift ;;
    -h|--help) sed -n '2,22p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

if [[ "$(git rev-parse --is-shallow-repository)" == "true" ]]; then
  echo "refusing to run against a shallow clone -- ancestry checks would be wrong." >&2
  echo "run: git fetch --unshallow origin" >&2
  exit 1
fi

git fetch origin --prune >/dev/null 2>&1

CUTOFF=$(date -u -d "$DAYS days ago" +%Y-%m-%d 2>/dev/null || date -u -v-"${DAYS}"d +%Y-%m-%d)

# Branches with an open PR are never candidates, even if they look merged.
PROTECTED=""
if command -v gh >/dev/null 2>&1; then
  PROTECTED=$(gh pr list --state open --json headRefName --jq '.[].headRefName' 2>/dev/null || true)
fi

RESTORE="$(git rev-parse --show-toplevel)/.git/restore-deleted-branches.sh"
printf '#!/usr/bin/env bash\n# Recreate branches deleted on %s.\nset -euo pipefail\n' \
  "$(date -u +%Y-%m-%d)" > "$RESTORE"
chmod +x "$RESTORE"

candidates=()
while read -r ref; do
  name="${ref#origin/}"
  [[ "$name" == "main" || "$name" == "HEAD" ]] && continue
  grep -Fxq "$name" <<<"$PROTECTED" && continue

  # Zero commits absent from main, or it is not a candidate.
  git merge-base --is-ancestor "$ref" "$MAIN" 2>/dev/null || continue
  [[ "$(git rev-list --count "$MAIN..$ref")" == "0" ]] || continue

  last=$(git log -1 --format='%cs' "$ref")
  [[ "$last" < "$CUTOFF" ]] || continue

  candidates+=("$name")
  echo "git push origin $(git rev-parse "$ref"):refs/heads/$name  # last commit $last" >> "$RESTORE"
done < <(git for-each-ref --format='%(refname:short)' refs/remotes/origin)

if [[ ${#candidates[@]} -eq 0 ]]; then
  echo "no merged branches older than $CUTOFF."
  exit 0
fi

printf '%s\n' "${candidates[@]}"
echo
echo "${#candidates[@]} branches, all fully merged into main, last commit before $CUTOFF."

if [[ $APPLY -eq 0 ]]; then
  echo "dry run -- re-run with --yes to delete. Restore script: $RESTORE"
  exit 0
fi

echo "restore script written to $RESTORE"

# Delete in batches so one oversized request cannot fail the whole run.
batch=()
for name in "${candidates[@]}"; do
  batch+=(":refs/heads/$name")
  if [[ ${#batch[@]} -eq 25 ]]; then
    git push origin "${batch[@]}"
    batch=()
  fi
done
[[ ${#batch[@]} -gt 0 ]] && git push origin "${batch[@]}"

echo "deleted ${#candidates[@]} branches."
