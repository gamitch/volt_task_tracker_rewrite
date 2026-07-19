// T071: `createLoader` unit tests against a STUBBED transport -- no real
// `getSupabaseClient()`/network call anywhere in this file. Every test
// supplies its own fake `getClient`/query function.
import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createLoader, isSupabaseLoaderError } from './loader.ts';

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
});
