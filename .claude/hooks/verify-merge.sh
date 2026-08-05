#!/usr/bin/env bash
# PostToolUse hook for PR merges: read the PR back and report its ACTUAL state.
#
# A merge call returning {"merged": true} is the API's word for what it did, not
# proof the branch landed. This session reported PR #59 merged while it was still
# open; the check below is what would have caught it.
#
# Design rule: when this cannot verify, it says so loudly. A verification step
# that silently succeeds when it did not run is worse than no step at all --
# it manufactures the confidence it exists to prevent.
#
# Never blocks (always exits 0). It reports; the human or agent decides.
set -uo pipefail

payload=$(cat 2>/dev/null || true)
have() { command -v "$1" >/dev/null 2>&1; }

field() {  # field <jq-path> -- tolerate absent jq
  if have jq; then printf '%s' "$payload" | jq -r "$1 // empty" 2>/dev/null; fi
}

owner=$(field '.tool_input.owner')
repo=$(field '.tool_input.repo')
num=$(field '.tool_input.pullNumber')

if [ -z "${num:-}" ]; then
  # Non-jq fallback: pull the first pullNumber out of the raw payload.
  num=$(printf '%s' "$payload" | grep -oE '"pullNumber"[[:space:]]*:[[:space:]]*[0-9]+' | grep -oE '[0-9]+$' | head -1)
fi
[ -n "${num:-}" ] || { echo "[verify-merge] no pullNumber in payload; nothing to verify"; exit 0; }

label="PR #$num"
[ -n "${owner:-}" ] && [ -n "${repo:-}" ] && label="$owner/$repo#$num"

if have gh; then
  out=$(gh pr view "$num" ${owner:+--repo "$owner/$repo"} \
          --json state,mergedAt,mergeCommit 2>&1) || {
    echo "[verify-merge] COULD NOT VERIFY $label -- gh failed:"
    echo "$out" | head -3 | sed 's/^/  /'
    echo "  Treat the merge as UNCONFIRMED and check it by hand."
    exit 0
  }
  state=$(printf '%s' "$out" | { have jq && jq -r '.state // "?"' || grep -oE '"state":"[A-Z]+"' | cut -d'"' -f4; })
  sha=$(printf '%s' "$out" | { have jq && jq -r '.mergeCommit.oid // ""' || true; })
  if [ "$state" = "MERGED" ] && [ -n "$sha" ]; then
    echo "[verify-merge] $label CONFIRMED MERGED (commit ${sha:0:12})"
  else
    echo "[verify-merge] *** $label IS NOT MERGED *** state=$state"
    echo "  The merge call may have returned success. The PR did not land."
    echo "  Do not report this as merged, and do not build on it."
  fi
  exit 0
fi

# No gh. Do not fake it -- in this container outbound calls to api.github.com are
# denied by egress policy (HTTP 403), so a curl fallback would fail silently and
# look like a pass.
cat <<EOF
[verify-merge] COULD NOT VERIFY $label -- 'gh' is not available here.
  This is expected in the cloud sandbox (no gh; api.github.com is blocked by
  egress policy). Verify with the GitHub MCP tool instead, and confirm three
  things rather than one:
    1. the change is present in origin/main
    2. the ledger/status doc says MERGED
    3. the branch is an ancestor of origin/main
  Until then the merge is UNCONFIRMED.
EOF
exit 0
