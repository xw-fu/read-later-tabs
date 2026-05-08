import { describe, it, expect } from 'vitest';
import { pickTodayReadCount } from '../../src/lib/verdicts';
import type { VerdictLog } from '../../src/lib/types';

describe('pickTodayReadCount', () => {
  const today = '2026-04-28';
  const yesterday = '2026-04-27';

  it('returns 0 when log is empty', () => {
    expect(pickTodayReadCount([], today)).toBe(0);
  });

  it('returns 0 when no entry matches today', () => {
    const logs: VerdictLog[] = [
      { date: yesterday, readCount: 3, bookmarkCount: 0, trashCount: 0, archivedCount: 0 },
    ];
    expect(pickTodayReadCount(logs, today)).toBe(0);
  });

  it('returns the readCount for todays entry', () => {
    const logs: VerdictLog[] = [
      { date: yesterday, readCount: 9, bookmarkCount: 0, trashCount: 0, archivedCount: 0 },
      { date: today, readCount: 2, bookmarkCount: 5, trashCount: 1, archivedCount: 0 },
    ];
    expect(pickTodayReadCount(logs, today)).toBe(2);
  });

  it('only counts read, not bookmark/trash/archive', () => {
    const logs: VerdictLog[] = [
      { date: today, readCount: 0, bookmarkCount: 99, trashCount: 99, archivedCount: 99 },
    ];
    expect(pickTodayReadCount(logs, today)).toBe(0);
  });
});
