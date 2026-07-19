// T062 (MIG-03): deterministic UUIDv5 derivation, used as the idempotency
// mechanism for new-project tables that have no natural-key unique
// constraint to upsert against (students, events, event_sessions -- see
// Known Context/Traps #1 and the "Natural-key / upsert strategy" section
// of the worker report). Implemented by hand against RFC 4122 section 4.3
// using only Node's built-in `node:crypto` (no new dependency -- package.json
// is not in this task's Allowed Files list).
//
// Given the same (namespace, name) pair, this always produces the same
// UUID, so re-running the ETL against the same old-project row always
// derives the same new-project primary key, which is what makes
// `.upsert(rows, { onConflict: 'id' })` idempotent for these tables.

// Ambient module declaration for the one `node:crypto` export this file
// uses. `@types/node` is not a dependency of this repo (package.json is
// not in this task's Allowed Files list to extend), so this narrow
// declaration keeps the file self-typed without widening any shared
// config -- same reasoning as the local `declare const process` in env.ts.
declare module 'node:crypto' {
  interface Hash {
    update(data: Uint8Array): Hash;
    digest(): Uint8Array;
  }
  export function createHash(algorithm: string): Hash;
}

import { createHash } from 'node:crypto';

// Fixed, arbitrary namespace UUID for this migration (generated once,
// never changes -- changing it would break idempotency across ETL runs).
// Not a secret; safe to commit.
const MIGRATION_NAMESPACE = '9b7f8b2e-9c1d-4a3a-8b2a-2f6d6f9a7c10';

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.replace(/-/g, '');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToUuid(bytes: Uint8Array): string {
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join('-');
}

/**
 * Deterministically derive a UUIDv5 from `name`, scoped under a
 * migration-specific sub-namespace (`kind`, e.g. "student", "event") so
 * that e.g. a student and an event that happen to share the same old id
 * value never collide on the same derived new-project uuid.
 */
export function deterministicId(kind: string, oldId: string): string {
  const namespaceBytes = hexToBytes(MIGRATION_NAMESPACE);
  const nameBytes = new TextEncoder().encode(`${kind}:${oldId}`);
  const combined = new Uint8Array(namespaceBytes.length + nameBytes.length);
  combined.set(namespaceBytes, 0);
  combined.set(nameBytes, namespaceBytes.length);
  // `createHash(...).update()` accepts any TypedArray/Uint8Array directly --
  // no Buffer needed (Buffer is a Node global this repo's browser-scoped
  // eslint config, shared across the whole TS toolchain, does not know
  // about; see worker report's tsconfig/build-path note).
  const hash = createHash('sha1');
  hash.update(combined);
  // `.digest()` returns a Node Buffer, which is itself a Uint8Array
  // subclass, so it can be indexed directly without importing the Buffer
  // global.
  const digest: Uint8Array = hash.digest();
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) {
    bytes[i] = digest[i] as number;
  }
  // Set version (5) and variant (RFC 4122) bits per spec section 4.1.3/4.1.1.
  bytes[6] = ((bytes[6] as number) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] as number) & 0x3f) | 0x80;
  return bytesToUuid(bytes);
}
