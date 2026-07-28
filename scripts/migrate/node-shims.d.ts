// T062 (MIG-03): minimal ambient type declarations for the one Node
// built-in export this script tree uses (`crypto.createHash`, in uuid.ts).
// `@types/node` is not a dependency of this repo (package.json is not in
// this task's Allowed Files list to extend), so this narrow declaration
// keeps scripts/migrate/** self-typed without widening any shared config.
// Node's `process` global is instead declared locally, per-file, in each
// file that reads it (env.ts, migrate.ts, verify-fixture.ts) -- narrow
// ambient module declarations like this one must live in their own
// non-module (no import/export) file to be recognized by TypeScript's
// `bundler` module resolution; declaring `crypto` inline in the same file
// that imports it fails with "Invalid module name in augmentation" under
// that resolution mode. This file is not part of the committed
// `npm run typecheck`/`build` path (scripts/ is outside tsconfig.json's
// `include`, see the worker report's tsconfig/build-path note) -- it only
// matters for ad hoc, standalone type-checking of this script tree.
declare module 'crypto' {
  interface Hash {
    update(data: Uint8Array): Hash;
    digest(): Uint8Array;
  }
  export function createHash(algorithm: string): Hash;
}
