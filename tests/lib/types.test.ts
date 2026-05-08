import { describe, it, expect } from 'vitest';
import type { TabRecord, DomainProfile, VerdictLog, Verdict, Settings } from '../../src/lib/types';

describe('types', () => {
  it('TabRecord has all required fields', () => {
    const r: TabRecord = {
      tabId: 1, windowId: 1, url: 'https://example.com',
      title: 'Example', favIconUrl: null, domain: 'example.com',
      firstSeenAt: 0, lastVisitedAt: 0, visitCount: 0,
      estimatedReadingMinutes: 5, isTool: false, isPinned: false, isArchived: false,
    };
    expect(r.tabId).toBe(1);
  });

  it('Verdict union covers all four outcomes', () => {
    const verdicts: Verdict[] = ['read', 'bookmark', 'trash', 'archive'];
    expect(verdicts).toHaveLength(4);
  });

  it('DomainProfile and VerdictLog construct cleanly', () => {
    const p: DomainProfile = {
      domain: 'a.com', totalVisitCount: 0, totalActiveSeconds: 0,
      isToolByHeuristic: false, userOverride: null,
    };
    const v: VerdictLog = { date: '2026-04-27', readCount: 0, bookmarkCount: 0, trashCount: 0, archivedCount: 0 };
    const s: Settings = { aiKey: null, aiProvider: 'none', aiCustom: null, excludedDomains: [], thresholds: { agedDays: 14, toolMinDailySeconds: 300 }, dailyTarget: 5 };
    expect(p.domain).toBe('a.com');
    expect(v.date).toBe('2026-04-27');
    expect(s.aiProvider).toBe('none');
  });
});
