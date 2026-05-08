import { describe, it, expect, beforeEach } from 'vitest';
import { TabTracker } from '../../src/background/tab-tracker';
import { storage } from '../../src/lib/storage';
import { tabsOnCreated, tabsOnRemoved, tabsOnUpdated, tabsOnActivated } from '../helpers/mock-chrome';

describe('TabTracker', () => {
  let tracker: TabTracker;
  beforeEach(() => {
    tracker = new TabTracker({ now: () => 1000 });
    tracker.attach();
  });

  it('records new tabs on tabs.onCreated', async () => {
    tabsOnCreated.trigger({
      id: 5, windowId: 1, url: 'https://example.com/x', title: 'Example',
      favIconUrl: 'https://example.com/favicon.ico', pinned: false,
    });
    await tracker.flush();
    const tabs = await storage.getTabs();
    expect(tabs).toHaveLength(1);
    expect(tabs[0].tabId).toBe(5);
    expect(tabs[0].domain).toBe('example.com');
    expect(tabs[0].firstSeenAt).toBe(1000);
  });

  it('updates existing tab on tabs.onUpdated (changeInfo merge)', async () => {
    tabsOnCreated.trigger({ id: 5, windowId: 1, url: 'https://a.com', title: 'old', pinned: false });
    await tracker.flush();
    tabsOnUpdated.trigger(5, { title: 'new', url: 'https://b.com/y' }, { id: 5, windowId: 1, pinned: false });
    await tracker.flush();
    const tabs = await storage.getTabs();
    expect(tabs[0].title).toBe('new');
    expect(tabs[0].domain).toBe('b.com');
  });

  it('removes tab from storage on tabs.onRemoved (unless we set isArchived)', async () => {
    tabsOnCreated.trigger({ id: 5, windowId: 1, url: 'https://a.com', title: 'A', pinned: false });
    await tracker.flush();
    tabsOnRemoved.trigger(5, { windowId: 1, isWindowClosing: false });
    await tracker.flush();
    const tabs = await storage.getTabs();
    expect(tabs).toEqual([]);
  });

  it('preserves archived tab when chrome closes it', async () => {
    tabsOnCreated.trigger({ id: 5, windowId: 1, url: 'https://a.com', title: 'A', pinned: false });
    await tracker.flush();
    await tracker.markArchived(5);
    tabsOnRemoved.trigger(5, { windowId: 1, isWindowClosing: false });
    await tracker.flush();
    const tabs = await storage.getTabs();
    expect(tabs).toHaveLength(1);
    expect(tabs[0].isArchived).toBe(true);
  });

  it('updates lastVisitedAt and visitCount on activation', async () => {
    tabsOnCreated.trigger({ id: 5, windowId: 1, url: 'https://a.com', title: 'A', pinned: false });
    await tracker.flush();
    tracker.setNow(5000);
    tabsOnActivated.trigger({ tabId: 5, windowId: 1 });
    await tracker.flush();
    const tabs = await storage.getTabs();
    expect(tabs[0].lastVisitedAt).toBe(5000);
    expect(tabs[0].visitCount).toBe(1);
  });

  it('does not record the extension new tab page (chrome-extension://)', async () => {
    tabsOnCreated.trigger({
      id: 7, windowId: 1,
      url: 'chrome-extension://abcdefghij/newtab.html',
      title: 'Read Later Tabs', pinned: false,
    });
    await tracker.flush();
    expect(await storage.getTabs()).toEqual([]);
  });

  it('does not record chrome:// internal pages', async () => {
    tabsOnCreated.trigger({ id: 8, windowId: 1, url: 'chrome://newtab/', title: '', pinned: false });
    tabsOnCreated.trigger({ id: 9, windowId: 1, url: 'about:blank', title: '', pinned: false });
    await tracker.flush();
    expect(await storage.getTabs()).toEqual([]);
  });

  it('removes a tab record when it navigates into a non-trackable URL', async () => {
    tabsOnCreated.trigger({ id: 5, windowId: 1, url: 'https://a.com', title: 'A', pinned: false });
    await tracker.flush();
    tabsOnUpdated.trigger(
      5,
      { url: 'chrome-extension://abcdefghij/newtab.html' },
      { id: 5, windowId: 1, url: 'chrome-extension://abcdefghij/newtab.html', pinned: false },
    );
    await tracker.flush();
    expect(await storage.getTabs()).toEqual([]);
  });

  it('starts tracking when a new tab navigates from blank to a real URL', async () => {
    // Create event with empty URL — typical for newly opened tabs before navigation.
    tabsOnCreated.trigger({ id: 5, windowId: 1, url: '', title: '', pinned: false });
    await tracker.flush();
    expect(await storage.getTabs()).toEqual([]);
    // Then the real URL arrives via onUpdated.
    tabsOnUpdated.trigger(
      5,
      { url: 'https://example.com/x' },
      { id: 5, windowId: 1, url: 'https://example.com/x', title: 'Example', pinned: false },
    );
    await tracker.flush();
    const tabs = await storage.getTabs();
    expect(tabs).toHaveLength(1);
    expect(tabs[0].domain).toBe('example.com');
  });

  describe('reconcile', () => {
    // Reconcile is the post-restart resync: storage holds tabIds from before the
    // browser restart, but the browser assigns NEW tabIds when it restores tabs.
    // Without reconcile, every chrome.tabs.get/update/remove on a stale tabId
    // silently fails (Bug 1: click does nothing, right-click verdict bumps logs
    // but the card stays); and the user's first onUpdated for a restored tab
    // gets routed through handleCreated, producing a duplicate record per URL
    // (Bug 2). Both bugs are fixed by reconciling once at SW startup.
    it('drops a stored record whose tabId is gone and not in chrome.tabs', async () => {
      await storage.setTabs([{
        tabId: 100, windowId: 1, url: 'https://stale.com', title: 'gone', favIconUrl: null,
        domain: 'stale.com', firstSeenAt: 100, lastVisitedAt: 100, visitCount: 0,
        estimatedReadingMinutes: 5, isTool: false, isPinned: false, isArchived: false,
      }]);
      (chrome.tabs.query as any).mockResolvedValueOnce([]);
      await tracker.reconcile();
      expect(await storage.getTabs()).toEqual([]);
    });

    it('keeps an archived record even if its tabId is no longer live', async () => {
      const archived = {
        tabId: 100, windowId: 1, url: 'https://saved.com', title: 'saved', favIconUrl: null,
        domain: 'saved.com', firstSeenAt: 100, lastVisitedAt: 100, visitCount: 0,
        estimatedReadingMinutes: 5, isTool: false, isPinned: false, isArchived: true,
      };
      await storage.setTabs([archived]);
      (chrome.tabs.query as any).mockResolvedValueOnce([]);
      await tracker.reconcile();
      expect(await storage.getTabs()).toEqual([archived]);
    });

    it('ports a new tabId onto an existing record matched by URL (preserves firstSeenAt)', async () => {
      // Browser restart scenario: storage record from a previous session has
      // tabId 100; the same URL is now live as tabId 200. Reconcile must port
      // tabId 200 onto the record without resetting firstSeenAt.
      await storage.setTabs([{
        tabId: 100, windowId: 1, url: 'https://example.com/x', title: 'old',
        favIconUrl: null, domain: 'example.com',
        firstSeenAt: 12345, lastVisitedAt: 12345, visitCount: 3,
        estimatedReadingMinutes: 5, isTool: false, isPinned: false, isArchived: false,
      }]);
      (chrome.tabs.query as any).mockResolvedValueOnce([
        { id: 200, windowId: 1, url: 'https://example.com/x', title: 'fresh', pinned: false },
      ]);
      await tracker.reconcile();
      const tabs = await storage.getTabs();
      expect(tabs).toHaveLength(1);
      expect(tabs[0].tabId).toBe(200);
      expect(tabs[0].firstSeenAt).toBe(12345);
      expect(tabs[0].visitCount).toBe(3);
    });

    it('adds a record for a live tab that has no matching storage entry', async () => {
      (chrome.tabs.query as any).mockResolvedValueOnce([
        { id: 7, windowId: 1, url: 'https://newone.com/a', title: 'New', pinned: false, favIconUrl: null },
      ]);
      await tracker.reconcile();
      const tabs = await storage.getTabs();
      expect(tabs).toHaveLength(1);
      expect(tabs[0].tabId).toBe(7);
      expect(tabs[0].domain).toBe('newone.com');
    });

    it('skips non-trackable URLs (chrome://, extension pages, blank tabs)', async () => {
      (chrome.tabs.query as any).mockResolvedValueOnce([
        { id: 1, windowId: 1, url: 'chrome://newtab/', title: '', pinned: false },
        { id: 2, windowId: 1, url: 'chrome-extension://abc/x.html', title: '', pinned: false },
        { id: 3, windowId: 1, url: '', title: '', pinned: false },
        { id: 4, windowId: 1, url: 'https://real.com', title: 'Real', pinned: false },
      ]);
      await tracker.reconcile();
      const tabs = await storage.getTabs();
      expect(tabs).toHaveLength(1);
      expect(tabs[0].tabId).toBe(4);
    });

    it('does not produce duplicate tabIds when Chrome reuses an archived tab\'s id for a new live tab', async () => {
      // Regression: archived records were pushed to `next` without claiming their
      // tabId in usedLiveIds, so the live-tabs loop added a second record for the
      // reused id → each_key_duplicate in Svelte.
      await storage.setTabs([{
        tabId: 7, windowId: 1, url: 'https://archived.com', title: 'Archived', favIconUrl: null,
        domain: 'archived.com', firstSeenAt: 100, lastVisitedAt: 100, visitCount: 2,
        estimatedReadingMinutes: 5, isTool: false, isPinned: false, isArchived: true,
      }]);
      (chrome.tabs.query as any).mockResolvedValueOnce([
        { id: 7, windowId: 1, url: 'https://newpage.com', title: 'New', pinned: false },
      ]);
      await tracker.reconcile();
      const tabs = await storage.getTabs();
      const ids = tabs.map(t => t.tabId);
      expect(new Set(ids).size).toBe(ids.length); // no duplicate tabIds
      expect(tabs.some(t => t.isArchived && t.url === 'https://archived.com')).toBe(true);
      expect(tabs.some(t => !t.isArchived && t.url === 'https://newpage.com')).toBe(true);
    });

    it('drops a duplicate non-archived stored record that maps to a live tab already claimed (handleCreated-on-restart aftermath)', async () => {
      // Pre-fix bug: handleCreated could add a SECOND record for a URL that
      // already had a stale-tabId record in storage (the user's first onUpdated
      // for a restored tab routed through handleCreated). Both stored records
      // then resolve to the same live tabId in reconcile — producing two
      // records with identical tabId in the non-archived bucket → Svelte's
      // TabGrid `{#each ... (tab.tabId)}` throws each_key_duplicate and the
      // newtab page fails to render past "Loading…".
      await storage.setTabs([
        // Stale record from before the browser restart (tabId 5 is gone).
        { tabId: 5, windowId: 1, url: 'https://example.com/x', title: 'X', favIconUrl: null,
          domain: 'example.com', firstSeenAt: 100, lastVisitedAt: 100, visitCount: 3,
          estimatedReadingMinutes: 5, isTool: false, isPinned: false, isArchived: false },
        // Duplicate added by handleCreated when onUpdated fired with the new id.
        { tabId: 20, windowId: 1, url: 'https://example.com/x', title: 'X', favIconUrl: null,
          domain: 'example.com', firstSeenAt: 200, lastVisitedAt: 200, visitCount: 0,
          estimatedReadingMinutes: 5, isTool: false, isPinned: false, isArchived: false },
      ]);
      (chrome.tabs.query as any).mockResolvedValueOnce([
        { id: 20, windowId: 1, url: 'https://example.com/x', title: 'X', pinned: false },
      ]);
      await tracker.reconcile();
      const tabs = await storage.getTabs();
      expect(tabs).toHaveLength(1);
      expect(tabs[0].tabId).toBe(20);
      // The first occurrence wins so the older firstSeenAt is preserved.
      expect(tabs[0].firstSeenAt).toBe(100);
      const ids = tabs.map(t => t.tabId);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('does NOT setTabs when storage is already in sync (avoids gratuitous onChanged churn)', async () => {
      const record = {
        tabId: 9, windowId: 1, url: 'https://example.com', title: 'E', favIconUrl: null,
        domain: 'example.com', firstSeenAt: 100, lastVisitedAt: 100, visitCount: 0,
        estimatedReadingMinutes: 5, isTool: false, isPinned: false, isArchived: false,
      };
      await storage.setTabs([record]);
      (chrome.tabs.query as any).mockResolvedValueOnce([
        { id: 9, windowId: 1, url: 'https://example.com', title: 'E', pinned: false },
      ]);
      let writes = 0;
      const originalSet = chrome.storage.local.set.bind(chrome.storage.local);
      (chrome.storage.local as any).set = async (items: any) => { writes++; return originalSet(items); };
      try {
        await tracker.reconcile();
        expect(writes).toBe(0);
      } finally {
        (chrome.storage.local as any).set = originalSet;
      }
    });
  });
});
