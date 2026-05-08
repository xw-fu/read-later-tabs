import { storage } from '../lib/storage';
import { extractDomain, isTrackableUrl } from '../lib/domain';
import { estimateReadingMinutes } from '../lib/recommender/reading-time';
import type { TabRecord } from '../lib/types';

interface Options {
  now?: () => number;
}

export class TabTracker {
  private now: () => number;
  private pending: Promise<unknown> = Promise.resolve();

  constructor(opts: Options = {}) {
    this.now = opts.now ?? (() => Date.now());
  }

  setNow(t: number) { this.now = () => t; }
  flush() { return this.pending; }

  attach() {
    chrome.tabs.onCreated.addListener(tab => this.enqueue(() => this.handleCreated(tab)));
    chrome.tabs.onUpdated.addListener((id, info, tab) => this.enqueue(() => this.handleUpdated(id, info, tab)));
    chrome.tabs.onActivated.addListener(info => this.enqueue(() => this.handleActivated(info.tabId)));
    chrome.tabs.onRemoved.addListener(id => this.enqueue(() => this.handleRemoved(id)));
  }

  async markArchived(tabId: number) {
    return this.enqueue(async () => {
      const tabs = await storage.getTabs();
      const idx = tabs.findIndex(t => t.tabId === tabId);
      if (idx >= 0) {
        tabs[idx] = { ...tabs[idx], isArchived: true };
        await storage.setTabs(tabs);
      }
    });
  }

  // Run a tabs read-modify-write inside the tracker's serialized queue, so it
  // can't race with a concurrent handleRemoved/handleUpdated and resurrect
  // (or drop) records. Always re-reads fresh tabs inside the enqueue.
  async updateTabs(
    updater: (tabs: TabRecord[]) => TabRecord[] | Promise<TabRecord[]>,
  ): Promise<void> {
    return this.enqueue(async () => {
      const current = await storage.getTabs();
      const next = await updater(current);
      await storage.setTabs(next);
    });
  }

  // Resync persisted records with the live tab set. Browser restarts assign
  // fresh tabIds to restored tabs, so storage tabIds go stale — chrome.tabs
  // API calls against them silently fail and onUpdated for a restored tab
  // routes through handleCreated, producing duplicates. Reconcile ports new
  // tabIds onto matching records by URL (preserving firstSeenAt), drops
  // orphaned non-archived records, and adds live tabs not yet recorded.
  // Output tabIds are guaranteed unique — duplicate stored records (legacy
  // handleCreated-on-restart fallout) are collapsed so the newtab page's
  // {#each ... (tab.tabId)} blocks don't throw each_key_duplicate.
  async reconcile() {
    return this.enqueue(async () => {
      const live = await chrome.tabs.query({});
      const stored = await storage.getTabs();
      const next: TabRecord[] = [];
      const usedLiveIds = new Set<number>();
      const usedNextIds = new Set<number>();

      for (const r of stored) {
        if (r.isArchived) {
          // Archived ids may collide with a reused live tabId; fixed up below.
          next.push(r);
          usedNextIds.add(r.tabId);
          continue;
        }
        const exact = live.find(t => t.id === r.tabId);
        if (exact?.id !== undefined && isTrackableUrl(exact.url ?? '')) {
          if (usedNextIds.has(exact.id)) continue; // dedupe legacy duplicate
          next.push(r);
          usedLiveIds.add(exact.id);
          usedNextIds.add(exact.id);
          continue;
        }
        const byUrl = live.find(t =>
          t.id !== undefined && !usedLiveIds.has(t.id) && (t.url ?? '') === r.url,
        );
        if (byUrl?.id !== undefined && isTrackableUrl(byUrl.url ?? '')) {
          if (usedNextIds.has(byUrl.id)) continue; // dedupe legacy duplicate
          next.push({ ...r, tabId: byUrl.id });
          usedLiveIds.add(byUrl.id);
          usedNextIds.add(byUrl.id);
        }
        // else: drop the stale record
      }

      let syntheticId = -1;
      for (const t of live) {
        if (t.id === undefined || usedLiveIds.has(t.id)) continue;
        const url = t.url ?? '';
        if (!isTrackableUrl(url)) continue;
        // Chrome reuses tabIds for new tabs after old ones are closed.  If an
        // archived record still holds this id, reassign it a synthetic negative
        // id so the new live tab can claim the real one without a collision.
        const archivedConflict = next.findIndex(r => r.isArchived && r.tabId === t.id);
        if (archivedConflict >= 0) {
          const newId = syntheticId--;
          next[archivedConflict] = { ...next[archivedConflict], tabId: newId };
          usedNextIds.delete(t.id);
          usedNextIds.add(newId);
        } else if (usedNextIds.has(t.id)) {
          // Defensive: a non-archived stored record already claimed this id.
          // Skip rather than emit a duplicate.
          continue;
        }
        next.push({
          tabId: t.id,
          windowId: t.windowId ?? 0,
          url,
          title: t.title ?? '',
          favIconUrl: t.favIconUrl ?? null,
          domain: extractDomain(url),
          firstSeenAt: this.now(),
          lastVisitedAt: this.now(),
          visitCount: 0,
          estimatedReadingMinutes: estimateReadingMinutes(url, 0),
          isTool: false,
          isPinned: t.pinned ?? false,
          isArchived: false,
        });
        usedNextIds.add(t.id);
      }

      if (!sameTabs(stored, next)) {
        await storage.setTabs(next);
      }
    });
  }

  private enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const next = this.pending.then(fn, fn);
    this.pending = next.catch(() => undefined);
    return next;
  }

  private async handleCreated(tab: chrome.tabs.Tab) {
    if (tab.id === undefined) return;
    const url = tab.url ?? tab.pendingUrl ?? '';
    // Skip the extension's own newtab page and any other internal/blank URL.
    // Real URLs that arrive later via onUpdated will be added then.
    if (!isTrackableUrl(url)) return;
    const record: TabRecord = {
      tabId: tab.id,
      windowId: tab.windowId,
      url,
      title: tab.title ?? '',
      favIconUrl: tab.favIconUrl ?? null,
      domain: extractDomain(url),
      firstSeenAt: this.now(),
      lastVisitedAt: this.now(),
      visitCount: 0,
      estimatedReadingMinutes: estimateReadingMinutes(url, 0),
      isTool: false,
      isPinned: tab.pinned ?? false,
      isArchived: false,
    };
    await storage.upsertTab(record);
  }

  private async handleUpdated(id: number, info: chrome.tabs.TabChangeInfo, tab: chrome.tabs.Tab) {
    const tabs = await storage.getTabs();
    const idx = tabs.findIndex(t => t.tabId === id);
    if (idx < 0) return this.handleCreated(tab);
    // Tab navigated to an internal/blank page (e.g. the extension's own newtab).
    // Drop the record so it disappears from the read-later list. Archived
    // records are kept since users may want to revisit them later.
    if (info.url && !isTrackableUrl(info.url)) {
      if (tabs[idx].isArchived) return;
      await storage.setTabs(tabs.filter(t => t.tabId !== id));
      return;
    }
    const url = info.url ?? tabs[idx].url;
    tabs[idx] = {
      ...tabs[idx],
      title: info.title ?? tab.title ?? tabs[idx].title,
      url,
      domain: extractDomain(url),
      favIconUrl: info.favIconUrl ?? tab.favIconUrl ?? tabs[idx].favIconUrl,
      isPinned: tab.pinned ?? tabs[idx].isPinned,
      estimatedReadingMinutes: info.url ? estimateReadingMinutes(url, 0) : tabs[idx].estimatedReadingMinutes,
    };
    await storage.setTabs(tabs);
  }

  private async handleActivated(tabId: number) {
    const tabs = await storage.getTabs();
    const idx = tabs.findIndex(t => t.tabId === tabId);
    if (idx < 0) return;
    tabs[idx] = { ...tabs[idx], lastVisitedAt: this.now(), visitCount: tabs[idx].visitCount + 1 };
    await storage.setTabs(tabs);
  }

  private async handleRemoved(tabId: number) {
    const tabs = await storage.getTabs();
    const idx = tabs.findIndex(t => t.tabId === tabId);
    if (idx < 0) return;
    if (tabs[idx].isArchived) return; // keep archived records
    await storage.setTabs(tabs.filter(t => t.tabId !== tabId));
  }
}

function sameTabs(a: TabRecord[], b: TabRecord[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]; const y = b[i];
    if (x.tabId !== y.tabId || x.url !== y.url || x.title !== y.title ||
        x.isArchived !== y.isArchived || x.isPinned !== y.isPinned ||
        x.firstSeenAt !== y.firstSeenAt || x.lastVisitedAt !== y.lastVisitedAt) {
      return false;
    }
  }
  return true;
}
