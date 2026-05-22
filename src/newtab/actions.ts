import { storage } from '../lib/storage';
import type { TabRecord, Verdict, VerdictLog } from '../lib/types';
import { todayKey } from '../lib/dates';

export async function switchToTab(tabId: number): Promise<void> {
  try {
    await chrome.tabs.get(tabId);
    await chrome.tabs.update(tabId, { active: true });
  } catch {
    // Tab is gone; caller should refresh recommendation.
    throw new Error('tab-not-found');
  }
}

export interface ApplyOpts {
  today?: string; // YYYY-MM-DD; testing hook
}

const BOOKMARK_FOLDER = 'Read Later';

async function ensureBookmarkFolder(): Promise<string> {
  const matches = await chrome.bookmarks.search({ title: BOOKMARK_FOLDER });
  const existing = matches.find(b => !b.url);
  if (existing) return existing.id;
  const created = await chrome.bookmarks.create({ title: BOOKMARK_FOLDER });
  return created.id;
}


async function bumpVerdictLog(field: keyof Omit<VerdictLog, 'date'>, today: string): Promise<void> {
  const logs = await storage.getVerdictLogs();
  let entry = logs.find(l => l.date === today);
  if (!entry) {
    entry = { date: today, readCount: 0, bookmarkCount: 0, trashCount: 0, archivedCount: 0 };
    logs.push(entry);
  }
  (entry[field] as number)++;
  await storage.setVerdictLogs(logs);
}

export async function applyVerdict(tab: TabRecord, verdict: Verdict, opts: ApplyOpts = {}): Promise<void> {
  const today = opts.today ?? todayKey();

  if (verdict === 'bookmark') {
    const parentId = await ensureBookmarkFolder();
    await chrome.bookmarks.create({ parentId, title: tab.title, url: tab.url });
  }

  if (verdict === 'archive') {
    const tabs = await storage.getTabs();
    const idx = tabs.findIndex(t => t.tabId === tab.tabId);
    if (idx >= 0) {
      tabs[idx] = { ...tabs[idx], isArchived: true };
      await storage.setTabs(tabs);
    }
  }

  try { await chrome.tabs.remove(tab.tabId); } catch { /* already gone */ }

  const fieldMap: Record<Verdict, keyof Omit<VerdictLog, 'date'>> = {
    read: 'readCount', bookmark: 'bookmarkCount', trash: 'trashCount', archive: 'archivedCount',
  };
  await bumpVerdictLog(fieldMap[verdict], today);
  await storage.pushVerdictEvent({
    ts: Date.now(),
    verdict,
    title: tab.title,
    domain: tab.domain,
  });
}

export async function setDomainOverride(
  domain: string,
  override: 'tool' | 'content' | null,
): Promise<void> {
  await storage.setDomainOverride(domain, override);
}

export async function reopenArchived(tab: TabRecord): Promise<void> {
  await chrome.tabs.create({ url: tab.url });
  const all = await storage.getTabs();
  await storage.setTabs(all.filter(t => !(t.tabId === tab.tabId && t.isArchived)));
}

export async function discardArchived(tab: TabRecord): Promise<void> {
  const all = await storage.getTabs();
  await storage.setTabs(all.filter(t => !(t.tabId === tab.tabId && t.isArchived)));
}
