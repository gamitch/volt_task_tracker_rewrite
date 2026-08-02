// T320: tests for `loaders/attendance.ts`'s `.range()` pagination.
//
// Scoped deliberately to `makeLoadAttendanceForSessions` — this file has no
// pre-existing test module, and bringing all of `attendance.ts` under test is
// its own row (the mutation/`upsertAttendance` surface is untouched here).
// These tests exist to prove the truncation fix, not to backfill coverage.
//
// The defect: `supabase/config.toml:18` sets `[api] max_rows = 1000`, and
// PostgREST truncates at that cap with a **200 and a partial Content-Range**,
// not an error — so `createLoader` resolved a partial array that every caller
// read as complete.
//
// Mirrors `loaders/coachHome.test.ts`'s `.from(table)` dispatcher, extended
// with `.order().range()` so each page request can be asserted individually.
//
// T403 step 3 (worker packet, not this task's own Allowed Files list, but a
// natural extension of it — `attendance.ts` IS this task's own file, and this
// is its own pre-existing colocated test module, the exact pairing
// `LiveConsole.tsx`/`LiveConsole.test.tsx` already established for THIS same
// task): adds a `makeSetAttendanceStatus` `describe` block below, proving the
// EXACT payload it sends (module doc #5's Trap 1 fix — no `hours_override`
// key at all). This is the only place that payload can be captured directly;
// `LiveConsole.test.tsx` can only observe what it hands to the
// `SetAttendanceStatusFn` seam, one layer above the real `.upsert(...)` call
// this file makes. `makeUpsertAttendance` itself remains untested here, same
// as before this addition — not this task's job, and unmodified besides.
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import {
  ATTENDANCE_PAGE_SIZE,
  makeLoadAttendanceForSessions,
  makeSetAttendanceStatus,
} from './attendance';

interface AttendanceRowFixture {
  id: string;
  session_id: string;
  student_id: string;
  status: 'present' | 'late' | 'excused' | 'absent';
  check_in_at: string | null;
  check_out_at: string | null;
  hours_override: number | null;
  method: 'qr' | 'coach' | 'import';
  recorded_by: string | null;
  updated_at: string;
  created_at: string;
}

function row(id: string, overrides: Partial<AttendanceRowFixture> = {}): AttendanceRowFixture {
  return {
    id,
    session_id: 'session-1',
    student_id: `student-${id}`,
    status: 'present',
    check_in_at: null,
    check_out_at: null,
    hours_override: null,
    method: 'qr',
    recorded_by: null,
    updated_at: '2026-08-02T00:00:00Z',
    created_at: '2026-08-02T00:00:00Z',
    ...overrides,
  };
}

/** A full page of distinct rows, offset so page contents never collide. */
function fullPage(pageIndex: number): AttendanceRowFixture[] {
  return Array.from({ length: ATTENDANCE_PAGE_SIZE }, (_, i) =>
    row(`row-${pageIndex * ATTENDANCE_PAGE_SIZE + i}`),
  );
}

/**
 * Serves `pages` in order, one per `.range()` call, and records every call so
 * the request shape itself can be asserted. Any request past the end of
 * `pages` resolves empty, which is what a real server does past the last row.
 */
function makePagingClient(pages: AttendanceRowFixture[][]) {
  const rangeCalls: Array<[number, number]> = [];
  const orderSpy = vi.fn((column: string, opts: unknown) => {
    void column;
    void opts;
    return {
      range: vi.fn((from: number, to: number) => {
        rangeCalls.push([from, to]);
        const index = rangeCalls.length - 1;
        return Promise.resolve({ data: pages[index] ?? [], error: null });
      }),
    };
  });
  const inSpy = vi.fn(() => ({ order: orderSpy }));
  const selectSpy = vi.fn(() => ({ in: inSpy }));
  const fromSpy = vi.fn((table: string) => {
    if (table === 'attendance') return { select: selectSpy };
    throw new Error(`unexpected table: ${table}`);
  });
  return {
    client: { from: fromSpy } as unknown as SupabaseClient,
    fromSpy,
    selectSpy,
    inSpy,
    orderSpy,
    rangeCalls,
  };
}

describe('makeLoadAttendanceForSessions — T320 pagination', () => {
  it('issues no query at all for an empty session list', async () => {
    const stub = makePagingClient([]);
    await expect(makeLoadAttendanceForSessions(() => stub.client)([])).resolves.toEqual([]);
    expect(stub.fromSpy).not.toHaveBeenCalled();
  });

  it('stops after ONE request when the first page is short', async () => {
    const stub = makePagingClient([[row('row-1'), row('row-2')]]);
    const result = await makeLoadAttendanceForSessions(() => stub.client)(['session-1']);
    expect(result).toHaveLength(2);
    expect(stub.rangeCalls).toEqual([[0, ATTENDANCE_PAGE_SIZE - 1]]);
  });

  it('fetches a SECOND page when the first comes back exactly full — the truncation bug', async () => {
    // The heart of T320. A full page means "at least this many", never
    // "exactly this many". Before the fix the loader stopped here and every
    // caller read 1000 rows as the complete set.
    const stub = makePagingClient([fullPage(0), [row('row-tail')]]);
    const result = await makeLoadAttendanceForSessions(() => stub.client)(['session-1']);
    expect(result).toHaveLength(ATTENDANCE_PAGE_SIZE + 1);
    expect(stub.rangeCalls).toEqual([
      [0, ATTENDANCE_PAGE_SIZE - 1],
      [ATTENDANCE_PAGE_SIZE, ATTENDANCE_PAGE_SIZE * 2 - 1],
    ]);
    // The row that used to be silently dropped.
    expect(result[result.length - 1].id).toBe('row-tail');
  });

  it('accumulates across three pages in request order, losing nothing', async () => {
    const stub = makePagingClient([fullPage(0), fullPage(1), [row('row-final')]]);
    const result = await makeLoadAttendanceForSessions(() => stub.client)(['session-1']);
    expect(result).toHaveLength(ATTENDANCE_PAGE_SIZE * 2 + 1);
    expect(result[0].id).toBe('row-0');
    expect(result[ATTENDANCE_PAGE_SIZE].id).toBe(`row-${ATTENDANCE_PAGE_SIZE}`);
    expect(result[result.length - 1].id).toBe('row-final');
  });

  it('costs exactly one extra empty request when the last page is exactly full', async () => {
    // Disclosed trade-off: a result set that is an exact multiple of the page
    // size cannot be recognised as complete without asking once more.
    const stub = makePagingClient([fullPage(0), []]);
    const result = await makeLoadAttendanceForSessions(() => stub.client)(['session-1']);
    expect(result).toHaveLength(ATTENDANCE_PAGE_SIZE);
    expect(stub.rangeCalls).toHaveLength(2);
  });

  it('orders by the uuid primary key — without it, paging can duplicate and skip rows', async () => {
    const stub = makePagingClient([[row('row-1')]]);
    await makeLoadAttendanceForSessions(() => stub.client)(['session-1']);
    expect(stub.orderSpy).toHaveBeenCalledWith('id', { ascending: true });
  });

  it('still scopes to the requested session ids', async () => {
    const stub = makePagingClient([[row('row-1')]]);
    await makeLoadAttendanceForSessions(() => stub.client)(['session-a', 'session-b']);
    expect(stub.selectSpy).toHaveBeenCalledWith('*');
    expect(stub.inSpy).toHaveBeenCalledWith('session_id', ['session-a', 'session-b']);
  });

  it('maps db rows to camelCase AttendanceRow shape', async () => {
    const stub = makePagingClient([
      [
        row('row-1', {
          session_id: 'session-9',
          student_id: 'student-remy-okafor',
          status: 'late',
          check_in_at: '2026-08-02T18:04:00Z',
          hours_override: 3,
          method: 'coach',
        }),
      ],
    ]);
    const [mapped] = await makeLoadAttendanceForSessions(() => stub.client)(['session-9']);
    expect(mapped).toMatchObject({
      id: 'row-1',
      sessionId: 'session-9',
      studentId: 'student-remy-okafor',
      status: 'late',
      checkInAt: '2026-08-02T18:04:00Z',
      hoursOverride: 3,
      method: 'coach',
    });
  });

  it('THROWS rather than returning a partial set if the pages never run short', async () => {
    // A server that ignores `.range()` would otherwise loop forever, or —
    // worse — return whatever was gathered, reintroducing the exact silent
    // truncation this row exists to remove.
    const alwaysFull = Array.from({ length: 200 }, (_, i) => fullPage(i));
    const stub = makePagingClient(alwaysFull);
    await expect(makeLoadAttendanceForSessions(() => stub.client)(['session-1'])).rejects.toThrow(
      /exceeded 100 pages/,
    );
  });
});

// ---------------------------------------------------------------------------
// makeSetAttendanceStatus — T403 step 3, module doc #5, Trap 1's fix.
// ---------------------------------------------------------------------------

/** A `.upsert(payload, options).select().single()` stub, recording every
 * `upsert` call so the exact payload/options this file sends can be
 * asserted directly, the same "capture the real call" discipline
 * `makePagingClient` above uses for `.range()`. */
function makeUpsertStubClient(resolved: {
  data: unknown;
  error: { message: string; code?: string } | null;
}) {
  const singleSpy = vi.fn(() => Promise.resolve(resolved));
  const selectSpy = vi.fn(() => ({ single: singleSpy }));
  const upsertSpy = vi.fn((payload: unknown, options: unknown) => {
    void payload;
    void options;
    return { select: selectSpy };
  });
  const fromSpy = vi.fn((table: string) => {
    if (table === 'attendance') return { upsert: upsertSpy };
    throw new Error(`unexpected table: ${table}`);
  });
  return {
    client: { from: fromSpy } as unknown as SupabaseClient,
    fromSpy,
    upsertSpy,
    selectSpy,
    singleSpy,
  };
}

const SET_STATUS_DB_ROW = {
  id: 'row-1',
  session_id: 'session-1',
  student_id: 'student-1',
  status: 'present' as const,
  check_in_at: '2026-08-02T18:05:00Z',
  check_out_at: null,
  hours_override: 2.5,
  method: 'qr' as const,
  recorded_by: 'coach-1',
  updated_at: '2026-08-02T00:00:00Z',
  created_at: '2026-08-02T00:00:00Z',
};

describe('makeSetAttendanceStatus — T403 step 3 (Trap 1 fix)', () => {
  it('sends a payload with EXACTLY session_id, student_id, status, method, recorded_by — no hours_override key at all', async () => {
    const stub = makeUpsertStubClient({ data: SET_STATUS_DB_ROW, error: null });
    const setStatus = makeSetAttendanceStatus(() => stub.client);

    await setStatus({
      sessionId: 'session-1',
      studentId: 'student-1',
      status: 'present',
      method: 'coach',
      recordedBy: 'coach-1',
    });

    expect(stub.fromSpy).toHaveBeenCalledWith('attendance');
    expect(stub.upsertSpy).toHaveBeenCalledTimes(1);
    const [payload, options] = stub.upsertSpy.mock.calls[0];
    // The exact payload, captured — not described. This is Trap 1's fix: no
    // `hours_override` key at all, so Postgrest's generated `ON CONFLICT DO
    // UPDATE SET` cannot touch that column on an existing row.
    expect(payload).toEqual({
      session_id: 'session-1',
      student_id: 'student-1',
      status: 'present',
      method: 'coach',
      recorded_by: 'coach-1',
    });
    expect(Object.keys(payload as object)).not.toContain('hours_override');
    // Same conflict target as `makeUpsertAttendance` (module doc #3) — same
    // table, same real `unique (session_id, student_id)` constraint.
    expect(options).toEqual({ onConflict: 'session_id,student_id' });
  });

  it('resolves the freshly-written row, mapped to the camelCase AttendanceRow shape', async () => {
    const stub = makeUpsertStubClient({ data: SET_STATUS_DB_ROW, error: null });
    const setStatus = makeSetAttendanceStatus(() => stub.client);

    const result = await setStatus({
      sessionId: 'session-1',
      studentId: 'student-1',
      status: 'present',
      method: 'coach',
      recordedBy: 'coach-1',
    });

    expect(result).toEqual({
      id: 'row-1',
      sessionId: 'session-1',
      studentId: 'student-1',
      status: 'present',
      checkInAt: '2026-08-02T18:05:00Z',
      checkOutAt: null,
      // The server's own returned value, unmodified — proving this loader
      // never re-sends/re-derives `hours_override` itself; it only reflects
      // back whatever the row already had.
      hoursOverride: 2.5,
      method: 'qr',
      recordedBy: 'coach-1',
      updatedAt: '2026-08-02T00:00:00Z',
      createdAt: '2026-08-02T00:00:00Z',
    });
    expect(stub.selectSpy).toHaveBeenCalledTimes(1);
    expect(stub.singleSpy).toHaveBeenCalledTimes(1);
  });

  it('propagates a mutation error as a SupabaseLoaderError, same normalization every other write in this file uses', async () => {
    const stub = makeUpsertStubClient({
      data: null,
      error: { message: 'db exploded', code: 'XX000' },
    });
    const setStatus = makeSetAttendanceStatus(() => stub.client);

    await expect(
      setStatus({
        sessionId: 'session-1',
        studentId: 'student-1',
        status: 'absent',
        method: 'coach',
        recordedBy: 'coach-1',
      }),
    ).rejects.toMatchObject({ code: 'XX000' });
  });
});
