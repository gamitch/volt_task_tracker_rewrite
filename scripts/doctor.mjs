// Machine readiness check for a laptop joining the swarm.
//
//   node scripts/doctor.mjs          check tooling only
//   node scripts/doctor.mjs --gates  also run the five repo gates (~2-4 min)
//
// Node rather than bash: machines joining the swarm run Windows too, and
// Windows has no bash outside Git's bundled one. Node is already a hard
// requirement of this project, so a Node script is the one thing guaranteed to
// run everywhere a checkout can exist. It is dependency-free and stdlib-only,
// so it works before `npm ci` has been run — which is exactly when a machine
// most needs to be told what is missing.
//
// REQUIRED checks decide the exit code. OPTIONAL checks report only — each is
// needed by some workflows and irrelevant to others, so a machine assigned W1
// (check in) is fully ready with every optional line reading MISSING.

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RUN_GATES = process.argv.includes('--gates');

// Windows resolves `npx`/`npm`/`supabase` as .cmd shims, which spawn cannot
// execute without a shell. Everything run here is a hardcoded literal, so
// there is no injection surface to weigh against that.
const WIN = process.platform === 'win32';

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code, s) => (useColor ? `\u001b[${code}m${s}\u001b[0m` : s);
const GREEN = (s) => c('0;32', s);
const RED = (s) => c('0;31', s);
const YELLOW = (s) => c('0;33', s);
const DIM = (s) => c('2', s);

let failed = false;

const ok = (m) => console.log(`  ${GREEN('OK')}       ${m}`);
const bad = (m) => {
  failed = true;
  console.log(`  ${RED('MISSING')}  ${m}`);
};
const warn = (m) => console.log(`  ${YELLOW('MISSING')}  ${m}`);
const note = (m) => console.log(`           ${DIM(m)}`);

// Returns trimmed stdout, or null when the command is absent or fails. Absence
// surfaces as ENOENT without a shell and as a non-zero exit with one, so both
// are treated the same.
function probe(cmd, args) {
  try {
    const r = spawnSync(cmd, args, { encoding: 'utf8', shell: WIN, cwd: ROOT });
    if (r.error || r.status !== 0) {
      return null;
    }
    return String(r.stdout || r.stderr || '').trim();
  } catch {
    return null;
  }
}

console.log('');
console.log('Required — the gates cannot run without these');
console.log('');

// The floor is 22.12.0: whatwg-url@16 (reached through jsdom) needs
// require(esm), which landed on 20.19.0 / 22.12.0. CI pins 22.22.2 exactly.
const [major, minor] = process.versions.node.split('.').map(Number);
if (major > 22) {
  ok(`node v${process.versions.node}`);
  note('CI runs 22.22.2; a newer major is untested here');
} else if (major === 22 && minor >= 12) {
  ok(`node v${process.versions.node}`);
} else {
  bad(`node v${process.versions.node} is below the 22.12.0 floor`);
  note('vitest dies with ERR_REQUIRE_ESM below it — install 22.22.2 to match CI');
}

const npmVersion = probe('npm', ['-v']);
if (npmVersion) {
  ok(`npm ${npmVersion}`);
  // Node 22.22.2 bundles npm 10.9.x. A different major means npm was installed
  // separately, or this is not the pinned Node — worth knowing, not a failure.
  if (Number(npmVersion.split('.')[0]) >= 11 && major === 22) {
    note('Node 22.22.2 bundles npm 10.9.x — npm 11+ here means a separate install');
  }
} else {
  bad('npm — not on PATH');
}

const gitVersion = probe('git', ['--version']);
gitVersion ? ok(gitVersion) : bad('git — not on PATH');

if (existsSync(join(ROOT, 'node_modules', 'vitest'))) {
  ok('node_modules installed');
} else {
  bad('node_modules — run: npm ci');
}

console.log('');
console.log('Repo state');
console.log('');

if (existsSync(join(ROOT, '.env.local')) || existsSync(join(ROOT, '.env'))) {
  warn('an env file is present — gates are measured with .env.local ABSENT');
  note('every packet baseline in docs/swarm/ was taken without one; move it aside');
  note('before running gates, and put it back for npm run dev');
} else {
  ok('no .env / .env.local — matches how every gate baseline was measured');
  note('npm run dev needs one: copy .env.local.example to .env.local and fill it in');
}

const branch = probe('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
if (branch) {
  ok(`on branch ${branch}`);
}

console.log('');
console.log('Optional — needed only by the workflow this machine is assigned');
console.log('');

const psql = probe('psql', ['--version']);
if (psql) {
  ok(psql);
} else {
  warn('psql — needed for tests/rls/run.sh and supabase/tests/run.sh');
  note('any workflow touching RLS or metric-view SQL (W4, W9)');
}

const deno = probe('deno', ['--version']);
if (deno) {
  ok(deno.split('\n')[0]);
} else {
  warn('deno — needed to run supabase/functions/**/*.test.ts (deno test)');
  note('vitest deliberately excludes those; W8 (email) needs it');
}

const supabase = probe('supabase', ['--version']);
if (supabase) {
  ok(`supabase CLI ${supabase.split('\n')[0]}`);
} else {
  warn('supabase CLI — needed to apply migrations and set function secrets');
  note('W9 (migration and go-live) needs it');
}

if (existsSync(join(ROOT, 'node_modules', '@playwright', 'test'))) {
  ok('@playwright/test installed');
} else {
  warn('@playwright/test is not a dependency of this repo');
  note('playwright.config.ts and tests/e2e/** exist but cannot run until it is');
  note('added — that is a known gap, not something to fix during setup');
}

if (RUN_GATES) {
  console.log('');
  console.log('Gates');
  console.log('');

  const gate = (name, cmd, args) => {
    const r = spawnSync(cmd, args, { encoding: 'utf8', shell: WIN, cwd: ROOT });
    const status = r.error ? 1 : r.status;
    if (status === 0) {
      console.log(`  ${GREEN('OK')}       ${name} (exit 0)`);
    } else {
      failed = true;
      console.log(`  ${RED('FAIL')}     ${name} (exit ${status})`);
      const out = r.error ? String(r.error.message) : `${r.stdout || ''}${r.stderr || ''}`;
      out
        .split('\n')
        .filter(Boolean)
        .slice(-15)
        .forEach((line) => console.log(`           ${line}`));
    }
  };

  gate('tsc --noEmit', 'npx', ['tsc', '--noEmit']);
  gate('vite build', 'npx', ['vite', 'build']);
  gate('format:check', 'npm', ['run', 'format:check']);
  gate('eslint .', 'npx', ['eslint', '.']);
  gate('vitest run', 'npx', ['vitest', 'run']);
  note('eslint carries a large, expected warning count — only errors fail');
  note('report the real vitest file/test counts in any PR; do not quote a doc');
}

console.log('');
if (failed) {
  console.log(`${RED('Not ready.')} Fix the red lines above, then re-run.`);
} else {
  console.log(
    `${GREEN('Ready.')} Pick a workflow from docs/swarm/WORKFLOWS.md and paste its block`,
  );
  console.log('from docs/swarm/KICKOFF-PROMPTS.md as the first message of a fresh session.');
}
console.log('');

process.exit(failed ? 1 : 0);
