import { describe, it, expect } from 'vitest';
import { ageDays, agingClass, agingDecoration } from '../../src/lib/aging';

const DAY = 86400 * 1000;

describe('aging', () => {
  it('ageDays computes whole days from firstSeenAt', () => {
    const now = 10 * DAY;
    expect(ageDays(0, now)).toBe(10);
    expect(ageDays(9 * DAY, now)).toBe(1);
    expect(ageDays(now, now)).toBe(0);
  });

  it('ageDays clamps negatives to 0 (defensive)', () => {
    expect(ageDays(2 * DAY, 1 * DAY)).toBe(0);
  });

  it('agingClass picks the right tier', () => {
    expect(agingClass(0)).toBe('paper-fresh');
    expect(agingClass(2)).toBe('paper-fresh');
    expect(agingClass(3)).toBe('paper-aged-3');
    expect(agingClass(6)).toBe('paper-aged-3');
    expect(agingClass(7)).toBe('paper-aged-7');
    expect(agingClass(13)).toBe('paper-aged-7');
    expect(agingClass(14)).toBe('paper-aged-14');
    expect(agingClass(99)).toBe('paper-aged-14');
  });

  it('agingDecoration returns emoji for old/withered tabs', () => {
    expect(agingDecoration(0)).toBe('');
    expect(agingDecoration(6)).toBe('');
    expect(agingDecoration(7)).toBe('📎');
    expect(agingDecoration(13)).toBe('📎');
    expect(agingDecoration(14)).toBe('🥀');
    expect(agingDecoration(99)).toBe('🥀');
  });
});
