import { describe, it, expect } from 'vitest';
import { todayKey } from '../../src/lib/dates';

describe('todayKey', () => {
  it('formats local-time date as YYYY-MM-DD', () => {
    // Date constructor takes local-time components (year, monthIdx, day)
    expect(todayKey(new Date(2026, 0, 5))).toBe('2026-01-05');     // Jan 5
    expect(todayKey(new Date(2026, 11, 31))).toBe('2026-12-31');   // Dec 31
  });

  it('zero-pads single-digit months and days', () => {
    expect(todayKey(new Date(2026, 8, 9))).toBe('2026-09-09');
  });

  it('uses current date when no argument given', () => {
    const got = todayKey();
    const d = new Date();
    const expected =
      `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    expect(got).toBe(expected);
  });
});
