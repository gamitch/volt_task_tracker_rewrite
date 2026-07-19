// T071/T086: `createLoader`/`runMutation` unit tests against a STUBBED
// transport -- no real `getSupabaseClient()`/network call anywhere in this
// file. Every test supplies its own fake `getClient`/query function.
import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SupabaseNotConfiguredError } from './client.ts';
import { createLoader, isSupabaseLoaderError, runMutation } from './loader.ts';

// A stand-in "client" -- `createLoader` never inspects it beyond passing it
// through to the caller-supplied query function, so an empty object cast is
// sufficient and never touches the network.
const FAKE_CLIENT = {} as SupabaseClient;

describe('createLoader (T071 typed loader seam)', () => {
  it('resolves typed data on success', async () => {
    const query = vi.fn().mockResolvedValue({ data: { id: 'row-1' }, error: null });
    const load = createLoader<string, { id: string }>(query, () => FAKE_CLIENT);

    const result = await load('arg-1');

    expect(result).toEqual({ id: 'row-1' });
    expect(query).toHaveBeenCalledWith(FAKE_CLIENT, 'arg-1');
  });

  it('resolves null for "no rows" (data: null, error: null)', async () => {
    const query = vi.fn().mockResolvedValue({ data: null, error: null });
    const load = createLoader<string, { id: string }>(query, () => FAKE_CLIENT);

    const result = await load('missing-id');

    expect(result).toBeNull();
  });

  it('rejects with a typed SupabaseLoaderError (DES-16-compatible fields) on a query error', async () => {
    const query = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'relation does not exist', code: '42P01' },
    });
    const load = createLoader<string, { id: string }>(query, () => FAKE_CLIENT);

    await expect(load('arg-1')).rejects.toMatchObject({
      code: '42P01',
      message: expect.any(String),
    });
  });

  it('rejected error message is DES-16 style (states what happened + what to do, no raw Postgrest text leaked)', async () => {
    const query = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'permission denied for table students', code: '42501' },
    });
    const load = createLoader<string, { id: string }>(query, () => FAKE_CLIENT);

    try {
      await load('arg-1');
      expect.unreachable('load() should have rejected');
    } catch (error) {
      expect(isSupabaseLoaderError(error)).toBe(true);
      const loaderError = error as { message: string; cause: unknown };
      expect(loaderError.message).not.toContain('permission denied');
      expect(loaderError.message.toLowerCase()).not.toContain('sorry');
      expect(loaderError.cause).toEqual({
        message: 'permission denied for table students',
        code: '42501',
      });
    }
  });

  it('rejects with a typed SupabaseLoaderError when the query function itself throws (transport failure)', async () => {
    const query = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const load = createLoader<string, { id: string }>(query, () => FAKE_CLIENT);

    await expect(load('arg-1')).rejects.toMatchObject({
      code: 'UNKNOWN',
      message: expect.any(String),
    });
  });

  it('uses the default UNKNOWN code when the underlying error has no code field', async () => {
    const query = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });
    const load = createLoader<string, { id: string }>(query, () => FAKE_CLIENT);

    await expect(load('arg-1')).rejects.toMatchObject({ code: 'UNKNOWN' });
  });

  it('isSupabaseLoaderError distinguishes this module errors from arbitrary values', () => {
    expect(isSupabaseLoaderError({ code: 'X', message: 'y', cause: null })).toBe(true);
    expect(isSupabaseLoaderError(new Error('plain error'))).toBe(false);
    expect(isSupabaseLoaderError(null)).toBe(false);
    expect(isSupabaseLoaderError('a string')).toBe(false);
  });

  // T086 bug fix: `getClient()` used to be called OUTSIDE `createLoader`'s
  // `try` block, so a thrown `SupabaseNotConfiguredError` (the "no .env
  // file" case) propagated raw/uncaught instead of becoming a
  // `SupabaseLoaderError` -- a dev with no `.env` would see a crash instead
  // of every wired page's normal DES-12 error state.
  it('rejects with a SupabaseLoaderError (not a raw thrown error) when getClient() throws SupabaseNotConfiguredError', async () => {
    const notConfiguredError = new SupabaseNotConfiguredError();
    const getClient = vi.fn((): SupabaseClient => {
      throw notConfiguredError;
    });
    const query = vi.fn();
    const load = createLoader<string, { id: string }>(query, getClient);

    await expect(load('arg-1')).rejects.toMatchObject({
      code: 'UNKNOWN',
      message: notConfiguredError.message,
      cause: notConfiguredError,
    });
    // The query function must never even be called -- getClient() throws
    // before it would be reached.
    expect(query).not.toHaveBeenCalled();

    try {
      await load('arg-1');
      expect.unreachable('load() should have rejected');
    } catch (error) {
      expect(isSupabaseLoaderError(error)).toBe(true);
    }
  });
});

describe('runMutation (T086 mutation seam, shares createLoader error-normalization)', () => {
  it('resolves the typed data on success when the caller supplies a concrete TResult', async () => {
    const mutation = vi.fn().mockResolvedValue({ data: { id: 'row-1' }, error: null });
    const run = runMutation<string, { id: string }>(mutation, () => FAKE_CLIENT);

    const result = await run('arg-1');

    expect(result).toEqual({ id: 'row-1' });
    expect(mutation).toHaveBeenCalledWith(FAKE_CLIENT, 'arg-1');
  });

  it('resolves undefined for the default TResult = void (data: null, error: null -- the "no return payload" case)', async () => {
    const mutation = vi.fn().mockResolvedValue({ data: null, error: null });
    const run = runMutation<string>(mutation, () => FAKE_CLIENT);

    const result = await run('arg-1');

    expect(result).toBeUndefined();
  });

  it('rejects with a typed SupabaseLoaderError on a mutation error', async () => {
    const mutation = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'permission denied for table invites', code: '42501' },
    });
    const run = runMutation<string, { id: string }>(mutation, () => FAKE_CLIENT);

    await expect(run('arg-1')).rejects.toMatchObject({
      code: '42501',
      message: expect.any(String),
    });
  });

  it('rejects with a typed SupabaseLoaderError when the mutation function itself throws (transport failure)', async () => {
    const mutation = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const run = runMutation<string, { id: string }>(mutation, () => FAKE_CLIENT);

    await expect(run('arg-1')).rejects.toMatchObject({
      code: 'UNKNOWN',
      message: expect.any(String),
    });
  });

  // T086 bug fix (same fix as createLoader's above, applied identically here).
  it('rejects with a SupabaseLoaderError (not a raw thrown error) when getClient() throws SupabaseNotConfiguredError', async () => {
    const notConfiguredError = new SupabaseNotConfiguredError();
    const getClient = vi.fn((): SupabaseClient => {
      throw notConfiguredError;
    });
    const mutation = vi.fn();
    const run = runMutation<string, { id: string }>(mutation, getClient);

    await expect(run('arg-1')).rejects.toMatchObject({
      code: 'UNKNOWN',
      message: notConfiguredError.message,
      cause: notConfiguredError,
    });
    expect(mutation).not.toHaveBeenCalled();
  });
});
