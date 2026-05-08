import { TabTracker } from './tab-tracker';
import { runAgingCron } from './aging-cron';
import { storage } from '../lib/storage';
import { recordVisit, classifyDomain } from './domain-profiler';
import { extractDomain } from '../lib/domain';

const tracker = new TabTracker();
tracker.attach();
// Resync persisted records with the live tab set every time the SW boots.
// Without this, tabIds from a previous browser session go stale after restart
// and chrome.tabs.get/remove silently no-op (cards don't switch / verdicts
// don't close), and the user's first onUpdated for a restored tab routes
// through handleCreated → duplicate per URL.
void tracker.reconcile();

const ACTIVE_TICK_MS = 60_000;
let lastActiveTabId: number | null = null;
let lastActiveAt: number = Date.now();

chrome.tabs.onActivated.addListener(({ tabId }) => {
  void rotateActiveTab(tabId);
});

setInterval(() => {
  if (lastActiveTabId !== null) void rotateActiveTab(lastActiveTabId);
}, ACTIVE_TICK_MS);

async function rotateActiveTab(tabId: number) {
  const now = Date.now();
  if (lastActiveTabId !== null) {
    try {
      const prev = await chrome.tabs.get(lastActiveTabId);
      const domain = extractDomain(prev.url ?? '');
      if (domain) {
        const seconds = Math.round((now - lastActiveAt) / 1000);
        const profiles = await storage.getDomainProfiles();
        const next = recordVisit(profiles, domain, seconds);
        const updated = classifyDomain(next[domain], {
          visitWindowDays: 7,
          recentVisits: next[domain].totalVisitCount,
          recentActiveSeconds: next[domain].totalActiveSeconds,
        });
        next[domain] = updated;
        await storage.setDomainProfiles(next);
      }
    } catch { /* tab gone */ }
  }
  lastActiveTabId = tabId;
  lastActiveAt = now;
}

chrome.alarms.create('aging-cron', { periodInMinutes: 60 * 6 });
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name === 'aging-cron') void runAgingCron({}, tracker);
});

chrome.runtime.onInstalled.addListener(() => {
  void runAgingCron({}, tracker);
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'archive-tab' && typeof msg.tabId === 'number') {
    (async () => {
      await tracker.markArchived(msg.tabId);
      try { await chrome.tabs.remove(msg.tabId); } catch { /* already gone */ }
      sendResponse({ ok: true });
    })();
    return true;
  }
  return false;
});
