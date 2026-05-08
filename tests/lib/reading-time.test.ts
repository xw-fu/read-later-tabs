import { describe, it, expect } from 'vitest';
import { estimateReadingMinutes } from '../../src/lib/recommender/reading-time';

describe('estimateReadingMinutes', () => {
  it('returns 5 for github.com domains', () => {
    expect(estimateReadingMinutes('https://github.com/svelte/repo', 10000)).toBe(5);
  });

  it('returns longer for medium-style article based on text length', () => {
    expect(estimateReadingMinutes('https://medium.com/post', 11000)).toBeGreaterThanOrEqual(7);
  });

  it('returns fallback 8 when text length is 0 and domain unknown', () => {
    expect(estimateReadingMinutes('https://random.example.com/x', 0)).toBe(8);
  });

  it('caps at 30', () => {
    expect(estimateReadingMinutes('https://anywhere.com/x', 1_000_000)).toBe(30);
  });

  it('youtube returns video duration when provided in metadata seconds', () => {
    expect(estimateReadingMinutes('https://youtube.com/watch?v=abc', 0, { videoSeconds: 720 })).toBe(12);
  });

  it('youtube falls back to 10 minutes when no metadata', () => {
    expect(estimateReadingMinutes('https://youtube.com/watch?v=abc', 0)).toBe(10);
  });
});
