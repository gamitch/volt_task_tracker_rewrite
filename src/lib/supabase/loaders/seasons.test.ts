/**
 * GAM-439: loader tests for `makeUpdateSeasonGoal` / `updateSeasonGoal`, the
 * new column-scoped write this task adds to `./seasons.ts` (see that file's
 * module doc entry above `makeUpdateSeasonGoal` for the full rationale).
 *
 * This file did not exist before GAM-439 -- `seasons.ts` previously had no
 * sibling test file; `makeUpdateSeason`'s own coverage lives in
 * `../../../pages/settings/SeasonSettings.test.tsx`. This file is scoped to
 * ONLY the new `updateSeasonGoal` surface -- it is not a general-purpose
 * `seasons.ts` test file.
 *
 * Fake-client harness modeled on `SeasonSettings.test.tsx`'s own
 * `makeFakeUpdateClient` (that file, `:972-985`) -- the minimal fake
 * supporting exactly the chain
 * `client.from('seasons').update({...}).eq('id', ...)` this loader uses.
 */
import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { makeUpdateSeasonGoal } from './seasons';

/** Minimal fake `SupabaseClient` supporting exactly the chain
 * `client.from('seasons').update({...}).eq('id', ...)`. Modeled on
 * `SeasonSettings.test.tsx`'s `makeFakeUpdateClient`. */
function makeFakeUpdateClient(result: { data: unknown; error: unknown }): {
  client: SupabaseClient;
  fromSpy: ReturnType<typeof vi.fn>;
  updateSpy: ReturnType<typeof vi.fn>;
  eqSpy: ReturnType<typeof vi.fn>;
} {
  const eqSpy = vi.fn().mockResolvedValue(result);
  const updateSpy = vi.fn(() => ({ eq: eqSpy }));
  const fromSpy = vi.fn(() => ({ update: updateSpy }));
  const client = { from: fromSpy } as unknown as SupabaseClient;
  return { client, fromSpy, updateSpy, eqSpy };
}

describe('makeUpdateSeasonGoal (GAM-439)', () => {
  it('A2: writes .update() with EXACTLY ONE key, default_goal_hours -- never name/starts_on/ends_on', async () => {
    const { client, fromSpy, updateSpy, eqSpy } = makeFakeUpdateClient({ data: null, error: null });
    const updateSeasonGoal = makeUpdateSeasonGoal(() => client);

    await updateSeasonGoal({ id: 'season-2024-2025', defaultGoalHours: 120 });

    expect(fromSpy).toHaveBeenCalledWith('seasons');
    // Asserting the KEY SET, not merely that `default_goal_hours` is present
    // -- a test that only checked for `default_goal_hours`'s presence would
    // still pass if a second key (e.g. a stale `name`) were added alongside
    // it, which is exactly the corruption GAM-439 was filed for. This
    // `toHaveBeenCalledWith` assertion is vitest deep-equality, so it also
    // fails on any extra key -- both forms of the assertion the packet
    // names are satisfied by this one call.
    expect(updateSpy).toHaveBeenCalledWith({ default_goal_hours: 120 });
    expect(Object.keys(updateSpy.mock.calls[0][0])).toEqual(['default_goal_hours']);
    expect(eqSpy).toHaveBeenCalledWith('id', 'season-2024-2025');
  });

  it('resolves undefined on success (no trailing .select())', async () => {
    const { client } = makeFakeUpdateClient({ data: null, error: null });
    const updateSeasonGoal = makeUpdateSeasonGoal(() => client);

    await expect(
      updateSeasonGoal({ id: 'season-2024-2025', defaultGoalHours: 120 }),
    ).resolves.toBeUndefined();
  });

  it('rejects with the real SupabaseLoaderError on a genuine update error', async () => {
    const { client } = makeFakeUpdateClient({
      data: null,
      error: { message: 'permission denied for table seasons', code: '42501' },
    });
    const updateSeasonGoal = makeUpdateSeasonGoal(() => client);

    await expect(updateSeasonGoal({ id: 'season-x', defaultGoalHours: 50 })).rejects.toMatchObject({
      code: '42501',
    });
  });
});
