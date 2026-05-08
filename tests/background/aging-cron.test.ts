import { describe, it, expect } from 'vitest';
import { runAgingCron } from '../../src/background/aging-cron';
import { TabTracker } from '../../src/background/tab-tracker';
import { storage } from '../../src/lib/storage';
import { tabsOnRemoved } from '../helpers/mock-chrome';
import type { TabRecord, DomainProfile } from '../../src/lib/types';

const DAY = 86400 * 1000;
const NOW = 100 * DAY;

function makeTab(o: Partial<TabRecord>): TabRecord {
  return {
    tabId: 1, windowId: 1, url: 'https://a.com', title: 'A',
    favIconUrl: null, domain: 'a.com',
    firstSeenAt: NOW - 5 * DAY, lastVisitedAt: NOW - 5 * DAY, visitCount: 0,
    estimatedReadingMinutes: 5, isTool: false, isPinned: false, isArchived: false,
    ...o,
  };
}

describe('aging-cron', () => {
  it('flips isTool on tabs whose domain profile says so', async () => {
    const profile: DomainProfile = {
      domain: 'mail.example.com', totalVisitCount: 99, totalActiveSeconds: 99999,
      isToolByHeuristic: true, userOverride: null,
    };
    await storage.setDomainProfiles({ 'mail.example.com': profile });
    await storage.setTabs([
      makeTab({ tabId: 1, domain: 'mail.example.com', isTool: false }),
      makeTab({ tabId: 2, domain: 'a.com' }),
    ]);
    await runAgingCron();
    const tabs = await storage.getTabs();
    expect(tabs.find(t => t.tabId === 1)!.isTool).toBe(true);
    expect(tabs.find(t => t.tabId === 2)!.isTool).toBe(false);
  });

  it('respects userOverride content (forces isTool=false)', async () => {
    const profile: DomainProfile = {
      domain: 'gmail.com', totalVisitCount: 99, totalActiveSeconds: 99999,
      isToolByHeuristic: true, userOverride: 'content',
    };
    await storage.setDomainProfiles({ 'gmail.com': profile });
    await storage.setTabs([makeTab({ tabId: 7, domain: 'gmail.com' })]);
    await runAgingCron();
    const tabs = await storage.getTabs();
    expect(tabs[0].isTool).toBe(false);
  });

  it('trims verdict logs older than 30 days', async () => {
    const old = { date: '2026-01-01', readCount: 1, bookmarkCount: 0, trashCount: 0, archivedCount: 0 };
    const recent = { date: '2026-04-26', readCount: 2, bookmarkCount: 0, trashCount: 0, archivedCount: 0 };
    await storage.setVerdictLogs([old, recent]);
    await runAgingCron({ now: new Date('2026-04-27').getTime() });
    const logs = await storage.getVerdictLogs();
    expect(logs).toHaveLength(1);
    expect(logs[0].date).toBe('2026-04-26');
  });

  it('does not resurrect a tab the tracker removes mid-run (post-reload bug)', async () => {
    // The post-reload bug: chrome.runtime.onInstalled fires runAgingCron,
    // which reads `tabs`, then writes `tabs` back. If the user closes a tab
    // between the read and the write, handleRemoved deletes the record from
    // storage — and runAgingCron's subsequent setTabs resurrects it. The
    // resurrected record then sits in the read-later list forever.
    //
    // Fix: route runAgingCron's tabs read-modify-write through the tracker's
    // serialized enqueue, so handleRemoved can't interleave between the read
    // and the write.
    const tab = makeTab({ tabId: 5, domain: 'a.com' });
    await storage.setTabs([tab]);

    const tracker = new TabTracker();
    tracker.attach();

    // Fire both at "the same time": cron is in flight when onRemoved arrives.
    // With the fix, both share the tracker queue and serialize correctly; the
    // tab must NOT be resurrected.
    const cronP = runAgingCron({ now: NOW }, tracker);
    tabsOnRemoved.trigger(5, { windowId: 1, isWindowClosing: false });
    await Promise.all([cronP, tracker.flush()]);

    expect(await storage.getTabs()).toEqual([]);
  });

  it('cron without a tracker still works (standalone path)', async () => {
    // Backwards-compat sanity check: the tracker arg is optional so existing
    // tests that don't construct one keep passing. (Production callers MUST
    // pass the tracker; the standalone path is racy.)
    await storage.setTabs([makeTab({ tabId: 1, domain: 'a.com' })]);
    await runAgingCron();
    const tabs = await storage.getTabs();
    expect(tabs).toHaveLength(1);
  });
});
