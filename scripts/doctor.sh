#!/usr/bin/env bash
#
# Machine readiness check for a laptop joining the swarm.
#
#   bash scripts/doctor.sh          # check tooling only
#   bash scripts/doctor.sh --gates  # also run the six gates (slow, ~2-4 min)
#
# REQUIRED checks decide the exit code. OPTIONAL checks report only — each one
# is needed by some workflows and irrelevant to others, so a machine assigned
# W1 (check in) is fully ready with every optional line reading MISSING.
#
# Written because setting up an Nth machine was being done from memory, and the
# thing that actually bites is not a missing tool — it is a Node version that
# looks fine and fails only inside jsdom's ESM chain (see .github/workflows/ci.yml
# for that history), so the version floor here is checked, not eyeballed.

set -uo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.." || exit 1

RUN_GATES=0
[ "${1:-}" = "--gates" ] && RUN_GATES=1

FAILED=0
GREEN=$'\033[0;32m'; RED=$'\033[0;31m'; YELLOW=$'\033[0;33m'; DIM=$'\033[2m'; OFF=$'\033[0m'
[ -t 1 ] || { GREEN=""; RED=""; YELLOW=""; DIM=""; OFF=""; }

ok()   { printf '  %sOK%s       %s\n' "$GREEN" "$OFF" "$1"; }
bad()  { printf '  %sMISSING%s  %s\n' "$RED" "$OFF" "$1"; FAILED=1; }
warn() { printf '  %sMISSING%s  %s\n' "$YELLOW" "$OFF" "$1"; }
note() { printf '           %s%s%s\n' "$DIM" "$1" "$OFF"; }

echo
echo "Required — the six gates cannot run without these"
echo

# Node. The floor is 22.12.0: whatwg-url@16 (reached through jsdom) needs
# require(esm), which landed on 20.19.0 / 22.12.0. CI pins 22.22.2 exactly.
if command -v node >/dev/null 2>&1; then
  NODE_RAW=$(node -v)              # v22.22.2
  NODE_NUM=${NODE_RAW#v}
  NODE_MAJOR=${NODE_NUM%%.*}
  NODE_REST=${NODE_NUM#*.}
  NODE_MINOR=${NODE_REST%%.*}
  if [ "$NODE_MAJOR" -gt 22 ] 2>/dev/null; then
    ok "node $NODE_RAW"
    note "CI runs 22.22.2; a newer major is untested here"
  elif [ "$NODE_MAJOR" -eq 22 ] 2>/dev/null && [ "$NODE_MINOR" -ge 12 ] 2>/dev/null; then
    ok "node $NODE_RAW"
  else
    bad "node $NODE_RAW is below the 22.12.0 floor"
    note "vitest dies with ERR_REQUIRE_ESM below it — install 22.22.2 to match CI"
  fi
else
  bad "node — not on PATH (install 22.22.2)"
fi

command -v npm >/dev/null 2>&1 && ok "npm $(npm -v)" || bad "npm — not on PATH"
command -v git >/dev/null 2>&1 && ok "$(git --version)" || bad "git — not on PATH"

if [ -d node_modules ] && [ -d node_modules/vitest ]; then
  ok "node_modules installed"
else
  bad "node_modules — run: npm ci"
fi

echo
echo "Repo state"
echo

if [ -f .env.local ] || [ -f .env ]; then
  warn "an env file is present — gates are measured with .env.local ABSENT"
  note "every packet baseline in docs/swarm/ was taken without one; move it aside"
  note "before running gates, and put it back for npm run dev"
else
  ok "no .env / .env.local — matches how every gate baseline was measured"
  note "npm run dev needs one: cp .env.local.example .env.local, then fill it in"
fi

BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null)
[ -n "$BRANCH" ] && ok "on branch $BRANCH"

echo
echo "Optional — needed only by the workflow this machine is assigned"
echo

if command -v psql >/dev/null 2>&1; then
  ok "psql $(psql --version 2>/dev/null | awk '{print $3}')"
else
  warn "psql — needed for tests/rls/run.sh and supabase/tests/run.sh"
  note "any workflow touching RLS or metric-view SQL (W4, W9)"
fi

if command -v deno >/dev/null 2>&1; then
  ok "deno $(deno --version 2>/dev/null | head -1 | awk '{print $2}')"
else
  warn "deno — needed to run supabase/functions/**/*.test.ts (deno test)"
  note "vitest deliberately excludes those; W8 (email) needs it"
fi

if command -v supabase >/dev/null 2>&1; then
  ok "supabase CLI $(supabase --version 2>/dev/null | head -1)"
else
  warn "supabase CLI — needed to apply migrations and set function secrets"
  note "W9 (migration and go-live) needs it"
fi

if [ -d node_modules/@playwright/test ]; then
  ok "@playwright/test installed"
else
  warn "@playwright/test is not a dependency of this repo"
  note "playwright.config.ts and tests/e2e/** exist but cannot run until it is"
  note "added — that is a known gap, not something to fix during setup"
fi

if [ "$RUN_GATES" = "1" ]; then
  echo
  echo "Gates"
  echo

  gate() { # gate <name> <cmd...>
    local name="$1"; shift
    local out rc
    out=$("$@" 2>&1); rc=$?
    if [ "$rc" -eq 0 ]; then
      printf '  %sOK%s       %s (exit 0)\n' "$GREEN" "$OFF" "$name"
    else
      printf '  %sFAIL%s     %s (exit %s)\n' "$RED" "$OFF" "$name" "$rc"
      printf '%s\n' "$out" | tail -15 | sed 's/^/           /'
      FAILED=1
    fi
  }

  gate "tsc --noEmit"     npx tsc --noEmit
  gate "vite build"       npx vite build
  gate "format:check"     npm run format:check
  gate "eslint ."         npx eslint .
  gate "vitest run"       npx vitest run
  note "eslint carries a large, expected warning count — only errors fail"
  note "report the real vitest file/test counts in any PR; do not quote a doc"
fi

echo
if [ "$FAILED" = "0" ]; then
  printf '%sReady.%s Pick a workflow from docs/swarm/WORKFLOWS.md and paste its block\n' "$GREEN" "$OFF"
  printf 'from docs/swarm/KICKOFF-PROMPTS.md as the first message of a fresh session.\n'
else
  printf '%sNot ready.%s Fix the red lines above, then re-run.\n' "$RED" "$OFF"
fi
echo

exit "$FAILED"
