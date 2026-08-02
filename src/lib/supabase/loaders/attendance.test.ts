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
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { ATTENDANCE_PAGE_SIZE, makeLoadAttendanceForSessions } from './attendance';

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
