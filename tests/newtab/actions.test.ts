import { describe, it, expect, beforeEach } from 'vitest';
import { applyVerdict, switchToTab, setDomainOverride } from '../../src/newtab/actions';
import { storage } from '../../src/lib/storage';
import type { TabRecord } from '../../src/lib/types';

const tab: TabRecord = {
  tabId: 5, windowId: 1, url: 'https://a.com/x', title: 'A',
  favIconUrl: null, domain: 'a.com',
  firstSeenAt: 0, lastVisitedAt: 0, visitCount: 0,
  estimatedReadingMinutes: 5, isTool: false, isPinned: false, isArchived: false,
};

describe('actions', () => {
  beforeEach(() => {
    (chrome.tabs.update as any).mockReset();
    (chrome.tabs.remove as any).mockReset();
    (chrome.bookmarks.create as any).mockReset();
    (chrome.bookmarks.create as any).mockResolvedValue({ id: 'bm1' });
  });

  it('switchToTab calls chrome.tabs.update with active=true', async () => {
    await switchToTab(5);
    expect(chrome.tabs.update).toHaveBeenCalledWith(5, { active: true });
  });

  it('applyVerdict("read") removes tab and increments readCount in todays log', async () => {
    await applyVerdict(tab, 'read', { today: '2026-04-27' });
    expect(chrome.tabs.remove).toHaveBeenCalledWith(5);
    const logs = await storage.getVerdictLogs();
    expect(logs.find(l => l.date === '2026-04-27')!.readCount).toBe(1);
  });

  it('applyVerdict("bookmark") creates bookmark then removes tab', async () => {
    await applyVerdict(tab, 'bookmark', { today: '2026-04-27' });
    expect(chrome.bookmarks.create).toHaveBeenCalled();
    expect(chrome.tabs.remove).toHaveBeenCalledWith(5);
    const logs = await storage.getVerdictLogs();
    expect(logs[0].bookmarkCount).toBe(1);
  });

  it('applyVerdict("trash") just removes tab', async () => {
    await applyVerdict(tab, 'trash', { today: '2026-04-27' });
    expect(chrome.tabs.remove).toHaveBeenCalledWith(5);
    const logs = await storage.getVerdictLogs();
    expect(logs[0].trashCount).toBe(1);
  });

  it('applyVerdict("archive") sets isArchived true and removes tab', async () => {
    await storage.setTabs([tab]);
    await applyVerdict(tab, 'archive', { today: '2026-04-27' });
    const tabs = await storage.getTabs();
    expect(tabs[0].isArchived).toBe(true);
    expect(chrome.tabs.remove).toHaveBeenCalledWith(5);
  });

  it('setDomainOverride writes the override into the domain profile', async () => {
    await setDomainOverride('foo.com', 'tool');
    const profiles = await storage.getDomainProfiles();
    expect(profiles['foo.com']?.userOverride).toBe('tool');
  });

  it('setDomainOverride(null) clears the override', async () => {
    await setDomainOverride('foo.com', 'tool');
    await setDomainOverride('foo.com', null);
    const profiles = await storage.getDomainProfiles();
    expect(profiles['foo.com']?.userOverride).toBeNull();
  });

  it('applyVerdict records a VerdictEvent with title, domain, verdict, ts', async () => {
    const t0 = Date.now();
    await applyVerdict(tab, 'read', { today: '2026-04-30' });
    const events = await storage.getVerdictEvents();
    expect(events).toHaveLength(1);
    expect(events[0].title).toBe('A');
    expect(events[0].domain).toBe('a.com');
    expect(events[0].verdict).toBe('read');
    expect(events[0].ts).toBeGreaterThanOrEqual(t0);
  });

  it('applyVerdict appends a VerdictEvent for every call (no dedupe)', async () => {
    await applyVerdict(tab, 'bookmark', { today: '2026-04-30' });
    await applyVerdict({ ...tab, tabId: 6, title: 'B', domain: 'b.com' }, 'trash', { today: '2026-04-30' });
    const events = await storage.getVerdictEvents();
    expect(events.map(e => e.verdict)).toEqual(['bookmark', 'trash']);
    expect(events.map(e => e.title)).toEqual(['A', 'B']);
  });

  it('reopenArchived opens a new tab with the url and removes the archived record', async () => {
    const archived = { ...tab, tabId: 99, isArchived: true };
    await storage.setTabs([archived, { ...tab, tabId: 100, isArchived: false }]);
    (chrome.tabs.create as any).mockReset();
    (chrome.tabs.create as any).mockResolvedValue({ id: 999 });

    const { reopenArchived } = await import('../../src/newtab/actions');
    await reopenArchived(archived);

    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: archived.url });
    const tabs = await storage.getTabs();
    expect(tabs.find(t => t.tabId === 99)).toBeUndefined();
    expect(tabs.find(t => t.tabId === 100)).toBeDefined(); // unrelated record untouched
  });

  it('discardArchived removes the archived record without opening a tab', async () => {
    const archived = { ...tab, tabId: 77, isArchived: true };
    await storage.setTabs([archived, { ...tab, tabId: 78, isArchived: false }]);
    (chrome.tabs.create as any).mockReset();

    const { discardArchived } = await import('../../src/newtab/actions');
    await discardArchived(archived);

    expect(chrome.tabs.create).not.toHaveBeenCalled();
    const tabs = await storage.getTabs();
    expect(tabs.find(t => t.tabId === 77)).toBeUndefined();
    expect(tabs.find(t => t.tabId === 78)).toBeDefined();
  });
});
