import { describe, it, expect } from 'vitest';
import { HeuristicRecommender } from '../../../src/lib/recommender/heuristic';
import type { TabRecord } from '../../../src/lib/types';

const DAY = 86400 * 1000;
const NOW = 100 * DAY;

function makeTab(overrides: Partial<TabRecord>): TabRecord {
  return {
    tabId: 1, windowId: 1, url: 'https://a.com/x', title: 'A',
    favIconUrl: null, domain: 'a.com',
    firstSeenAt: NOW - 5 * DAY, lastVisitedAt: NOW - 5 * DAY, visitCount: 0,
    estimatedReadingMinutes: 10, isTool: false, isPinned: false, isArchived: false,
    ...overrides,
  };
}

describe('HeuristicRecommender', () => {
  it('returns null when there are no candidates', () => {
    const r = new HeuristicRecommender({ now: NOW });
    expect(r.pick([], {}, [])).toBeNull();
  });

  it('filters out tool / pinned / archived / too-long tabs', () => {
    const r = new HeuristicRecommender({ now: NOW });
    const tabs = [
      makeTab({ tabId: 1, isTool: true }),
      makeTab({ tabId: 2, isPinned: true }),
      makeTab({ tabId: 3, isArchived: true }),
      makeTab({ tabId: 4, estimatedReadingMinutes: 60 }),
    ];
    expect(r.pick(tabs, {}, [])).toBeNull();
  });

  it('prefers older over newer', () => {
    const r = new HeuristicRecommender({ now: NOW });
    const tabs = [
      makeTab({ tabId: 1, firstSeenAt: NOW - 1 * DAY }),
      makeTab({ tabId: 2, firstSeenAt: NOW - 10 * DAY }),
    ];
    expect(r.pick(tabs, {}, [])!.tabId).toBe(2);
  });

  it('shorter reading wins among same-age tabs', () => {
    const r = new HeuristicRecommender({ now: NOW });
    const tabs = [
      makeTab({ tabId: 1, estimatedReadingMinutes: 25 }),
      makeTab({ tabId: 2, estimatedReadingMinutes: 5 }),
    ];
    expect(r.pick(tabs, {}, [])!.tabId).toBe(2);
  });

  it('penalizes tabs visited within last 24h', () => {
    const r = new HeuristicRecommender({ now: NOW });
    const tabs = [
      makeTab({ tabId: 1, firstSeenAt: NOW - 5 * DAY, lastVisitedAt: NOW - 2 * 3600_000 }),
      makeTab({ tabId: 2, firstSeenAt: NOW - 5 * DAY, lastVisitedAt: NOW - 5 * DAY }),
    ];
    expect(r.pick(tabs, {}, [])!.tabId).toBe(2);
  });

  it('avoids repeating the last recommended domain when scores are close', () => {
    const r = new HeuristicRecommender({ now: NOW, lastDomain: 'a.com' });
    const tabs = [
      makeTab({ tabId: 1, domain: 'a.com', firstSeenAt: NOW - 5 * DAY }),
      makeTab({ tabId: 2, domain: 'b.com', firstSeenAt: NOW - 5 * DAY }),
    ];
    expect(r.pick(tabs, {}, [])!.tabId).toBe(2);
  });

  it('ranked() returns candidates sorted by score (for "换一个")', () => {
    const r = new HeuristicRecommender({ now: NOW });
    const tabs = [
      makeTab({ tabId: 1, firstSeenAt: NOW - 10 * DAY }),
      makeTab({ tabId: 2, firstSeenAt: NOW - 5 * DAY }),
      makeTab({ tabId: 3, firstSeenAt: NOW - 1 * DAY }),
    ];
    const ranked = r.ranked(tabs, {}, []);
    expect(ranked.map(t => t.tabId)).toEqual([1, 2, 3]);
  });
});
