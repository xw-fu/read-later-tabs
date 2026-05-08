import { describe, it, expect } from 'vitest';

describe('test harness', () => {
  it('runs and matches truth', () => {
    expect(1 + 1).toBe(2);
  });

  it('has chrome global mocked', () => {
    expect(typeof chrome).toBe('object');
    expect(typeof chrome.storage.local.get).toBe('function');
  });
});
