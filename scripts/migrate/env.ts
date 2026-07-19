// T062 (MIG-03): env var loading for both Supabase projects. Values are
// read from process.env only -- never hardcoded, never committed. Env var
// names follow docs/swarm/COWORK-HANDOFF.md's already-documented
// convention for the old project (`OLD_SUPABASE_URL` / `OLD_SERVICE_ROLE_KEY`)
// and the parallel `NEW_SUPABASE_URL` / `NEW_SERVICE_ROLE_KEY` names for the
// new project (not documented anywhere else prior to this task -- flagged
// in the worker report as a naming choice, not a re-invention of the old
// names).
//
// BLOCKER-class constitution item 5: no service-role key (old or new) is
// ever hardcoded or logged in full here. `redactSecret` is used any time a
// secret-shaped value must appear in diagnostic output.

// Ambient declaration of Node's `process` global. This script runs under
// plain Node (not Vite/the browser bundle this repo's tsconfig.json/
// eslint.config.js otherwise target), and neither of those config files is
// in this task's Allowed Files list to extend with @types/node, so this
// narrow ambient declaration keeps the file self-contained without
// widening any shared config. See worker report "tsconfig/build path" note.
declare const process: {
  env: Record<string, string | undefined>;
  argv: string[];
  exit: (code?: number) => never;
};

export interface SupabaseProjectEnv {
  url: string;
  serviceRoleKey: string;
}

export class MissingEnvError extends Error {}

function readRequiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new MissingEnvError(`Missing required env var: ${name}`);
  }
  return value;
}

/** Old (Lovable Cloud) Supabase project -- read-only source. */
export function loadOldSupabaseEnv(): SupabaseProjectEnv {
  return {
    url: readRequiredEnv('OLD_SUPABASE_URL'),
    serviceRoleKey: readRequiredEnv('OLD_SERVICE_ROLE_KEY'),
  };
}

/** New (rewrite) Supabase project -- write target. */
export function loadNewSupabaseEnv(): SupabaseProjectEnv {
  return {
    url: readRequiredEnv('NEW_SUPABASE_URL'),
    serviceRoleKey: readRequiredEnv('NEW_SERVICE_ROLE_KEY'),
  };
}

/**
 * Redact a secret-shaped value for diagnostic logging: keep only enough of
 * the prefix to eyeball "yes, some value is set" without ever printing
 * anything usable. Never call this on a value you intend to print in full.
 */
export function redactSecret(value: string): string {
  if (value.length <= 8) {
    return '*'.repeat(value.length);
  }
  return `${value.slice(0, 4)}${'*'.repeat(value.length - 4)}`;
}
